/**
 * T047 — Audit sync loop (outbox → Data-Pulse-2).
 *
 * `AuditSync.flush()` reads unsynced audit events from the local store,
 * POSTs them to Data-Pulse-2 via `AuditSyncClient`, and marks events as
 * synced only when the backend confirms receipt:
 *
 *   accepted[]   → mark synced immediately (backend persisted the row)
 *   duplicates[] → mark synced (backend already has the row; idempotent)
 *   rejected[]   → leave in outbox (stay retry-safe; backend refused)
 *   network_error → leave in outbox (will be retried on the next flush)
 *
 * Fail-safe on malformed responses: if the backend body is missing or
 * contains non-array `accepted`/`duplicates`, zero events are marked
 * synced — the entire batch stays in the outbox for the next attempt.
 *
 * Out of scope for this task: T048 (bridge wiring), T050 (pino/Sentry
 * redaction), scheduling / interval management.
 */

import type { AuditEvent } from '../../shared/audit/event-shape.js';

// ─── Rejection categories (Endpoint 5 contract) ────────────────────────────

export type AuditRejectionCategory = 'invalid_input' | 'tenant_mismatch' | 'schema_violation';

export interface AuditRejectedEvent {
  event_id: string;
  category: AuditRejectionCategory;
}

// ─── Backend response envelope (Endpoint 5) ────────────────────────────────

/**
 * The response body returned by `POST /api/pos/v1/audit-events`.
 * Mirrors `specs/004-operator-session/contracts/backend-endpoints.md`
 * Endpoint 5 verbatim. Typed locally (no OpenAPI regen per project rule).
 */
export interface AuditSyncBatchResponse {
  accepted: string[];
  duplicates: string[];
  rejected: AuditRejectedEvent[];
}

// ─── DI interfaces ─────────────────────────────────────────────────────────

/**
 * Data-access seam for the sync loop. Production code binds to
 * better-sqlite3; tests inject a fake.
 */
export interface AuditSyncStore {
  /**
   * Return up to `limit` events that have not yet been synced to the
   * backend. Events appear in `audit_events` but NOT in
   * `audit_events_sync_state`.
   */
  listUnsynced(limit: number): AuditEvent[];

  /**
   * Record that `(tenant_id, event_id)` was successfully synced at
   * `synced_at`. Inserts a row into `audit_events_sync_state`.
   */
  markSynced(tenant_id: string, event_id: string, synced_at: string): void;
}

/**
 * HTTP seam for the sync loop. Production code wraps the global `fetch`
 * with the device-token + Authorization headers. Tests inject a fake.
 *
 * `sendBatch` NEVER throws. It resolves to the parsed response envelope,
 * or `'network_error'` on any transport / timeout / parse failure.
 */
export interface AuditSyncClient {
  sendBatch(events: AuditEvent[]): Promise<AuditSyncBatchResponse | 'network_error'>;
}

// ─── Options ───────────────────────────────────────────────────────────────

export interface AuditSyncOptions {
  store: AuditSyncStore;
  client: AuditSyncClient;
  /** Maximum events sent per flush call. Defaults to 100. */
  batchLimit?: number;
}

const DEFAULT_BATCH_LIMIT = 100;

// ─── AuditSync ─────────────────────────────────────────────────────────────

export class AuditSync {
  private readonly store: AuditSyncStore;
  private readonly client: AuditSyncClient;
  private readonly batchLimit: number;

  constructor(options: AuditSyncOptions) {
    this.store = options.store;
    this.client = options.client;
    this.batchLimit = options.batchLimit ?? DEFAULT_BATCH_LIMIT;
  }

  /**
   * Flush one batch of unsynced events to the backend.
   *
   * Never throws — network errors and malformed responses are handled
   * defensively (events remain in the outbox for the next attempt).
   */
  async flush(): Promise<void> {
    const events = this.store.listUnsynced(this.batchLimit);
    if (events.length === 0) return;

    const result = await this.client.sendBatch(events);
    if (result === 'network_error') return;

    const syncedAt = new Date().toISOString();
    const { toSyncIds } = interpretResponse(result, events);

    for (const { tenant_id, event_id } of toSyncIds) {
      this.store.markSynced(tenant_id, event_id, syncedAt);
    }
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Interpret the backend response envelope defensively.
 *
 * Returns the set of (tenant_id, event_id) pairs to mark synced.
 * Fails safe: any non-array `accepted` or `duplicates` → empty result.
 *
 * Cross-tenant lookup: `accepted`/`duplicates` contain event_ids only;
 * the tenant_id is resolved from the local `events` array by matching
 * event_id. Events not found locally (e.g., backend echoed an unknown
 * id) are silently ignored.
 */
function interpretResponse(
  response: AuditSyncBatchResponse,
  events: AuditEvent[],
): { toSyncIds: Array<{ tenant_id: string; event_id: string }> } {
  if (!Array.isArray(response.accepted) || !Array.isArray(response.duplicates)) {
    return { toSyncIds: [] };
  }

  const confirmedIds = new Set<string>([...response.accepted, ...response.duplicates]);

  const toSyncIds: Array<{ tenant_id: string; event_id: string }> = [];
  for (const event of events) {
    if (confirmedIds.has(event.event_id)) {
      toSyncIds.push({ tenant_id: event.tenant_id, event_id: event.event_id });
    }
  }

  return { toSyncIds };
}
