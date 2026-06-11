/**
 * 008 sale-sync flush worker — option (c): synchronous-while-signed-in.
 *
 * Drains pending `sale_sync_outbox` rows by POSTing each sale to DP-2
 * captureSale. Runs ONLY when a live operator session JWT is available: a
 * minted Clerk session JWT lives ~60s (verified live), so it cannot survive a
 * deferred queue — flush therefore happens inside the live session window
 * (triggered on sign-in + after each finalized sale; see index.ts wiring). When
 * no JWT (or no device attestation) is available, the worker no-ops: a
 * signed-out terminal's sales stay pending until the next sign-in drains them.
 * (Owner-ratified option (c); the offline-survivable alternatives (a)/(b) were
 * deferred — see docs P-POS-sale-sync-flush.)
 *
 * Per row: build the captureSale body (stable externalId = sale_id → DP-2
 * dedups, so retries are safe), flush, transition state:
 *   ok            → markSynced
 *   refused (4xx) → markFailed (non-retryable: validation/auth/conflict)
 *   no_connection → bumpAttempt, leave pending, AND stop the drain (the backend
 *                   is unreachable / the JWT just expired — the remaining rows
 *                   would fail the same way; retry on the next trigger).
 *
 * Credentials are read here main-process-side and handed to the flush client;
 * they never cross the bridge and are never logged.
 */
import {
  buildCaptureSaleBody,
  MalformedSaleJsonError,
  type SaleCurrencyConfig,
} from './build-capture-sale-body.js';
import type { SaleRow } from '../sales/repositories/sales.repository.js';
import type { SaleSyncOutboxRow } from './sale-sync-outbox.repository.js';
import type { SaleSyncFlushClient } from './sale-sync-flush-client-types.js';

/** The repo surface the worker needs (subset of SaleSyncOutboxRepository). */
export interface FlushOutboxPort {
  readPending(): SaleSyncOutboxRow[];
  markSynced(sale_id: string): void;
  markFailed(sale_id: string, error: string): void;
  bumpAttempt(sale_id: string): void;
}

export interface SaleSyncFlushWorkerDeps {
  outbox: FlushOutboxPort;
  /** Load the persisted SaleRow for a sale_id (the outbox row holds only IDs). */
  loadSale: (sale_id: string) => SaleRow | null;
  flushClient: SaleSyncFlushClient;
  /** A FRESH operator session JWT, or null if no operator is signed in. */
  getOperatorJwt: () => Promise<string | null>;
  /** The paired-terminal device attestation, or null if not paired. */
  getDeviceAttestation: () => Promise<string | null>;
  /** Currency code + minor-unit scale for the body's money fields. */
  currency: SaleCurrencyConfig;
}

/** Outcome of one drain pass — for logging/observability (no credential data). */
export interface FlushPassSummary {
  attempted: number;
  synced: number;
  failed: number;
  deferred: number;
  skipped_no_jwt: boolean;
}

export interface SaleSyncFlushWorker {
  /** Drain all pending rows once (option c: only while signed in). */
  flushPending(): Promise<FlushPassSummary>;
  /** Same as flushPending but with per-call dep overrides (test hook). */
  flushPendingWith(overrides: Partial<SaleSyncFlushWorkerDeps>): Promise<FlushPassSummary>;
}

export function createSaleSyncFlushWorker(baseDeps: SaleSyncFlushWorkerDeps): SaleSyncFlushWorker {
  async function run(deps: SaleSyncFlushWorkerDeps): Promise<FlushPassSummary> {
    const summary: FlushPassSummary = {
      attempted: 0,
      synced: 0,
      failed: 0,
      deferred: 0,
      skipped_no_jwt: false,
    };

    const jwt = await deps.getOperatorJwt();
    const attestation = await deps.getDeviceAttestation();
    if (jwt === null || jwt.length === 0 || attestation === null || attestation.length === 0) {
      // Option (c): no live credential → do not attempt. Rows stay pending.
      summary.skipped_no_jwt = true;
      return summary;
    }

    for (const row of deps.outbox.readPending()) {
      // Build the body first — a malformed sale is a non-retryable failure that
      // must NOT consume a network attempt.
      let body;
      try {
        const sale = deps.loadSale(row.sale_id);
        if (sale === null) {
          deps.outbox.markFailed(row.sale_id, 'sale row not found for outbox entry');
          summary.failed += 1;
          continue;
        }
        body = buildCaptureSaleBody(sale, deps.currency);
      } catch (err) {
        const msg =
          err instanceof MalformedSaleJsonError
            ? err.message
            : `build-capture-sale-body failed: ${err instanceof Error ? err.message : 'unknown'}`;
        deps.outbox.markFailed(row.sale_id, msg);
        summary.failed += 1;
        continue;
      }

      summary.attempted += 1;
      const result = await deps.flushClient.flushSale({
        jwt,
        deviceAttestation: attestation,
        idempotencyKey: row.sale_id, // stable per sale → DP-2 dedup-safe retries
        body,
      });

      if (result.kind === 'ok') {
        deps.outbox.markSynced(row.sale_id);
        summary.synced += 1;
      } else if (result.kind === 'refused') {
        deps.outbox.markFailed(row.sale_id, 'captureSale refused (4xx — validation/auth/conflict)');
        summary.failed += 1;
      } else {
        // no_connection — retryable. Bump + leave pending, and STOP the drain:
        // the backend is unreachable (or the JWT just expired) so the remaining
        // rows would fail identically; retry on the next trigger.
        deps.outbox.bumpAttempt(row.sale_id);
        summary.deferred += 1;
        break;
      }
    }

    return summary;
  }

  return {
    flushPending(): Promise<FlushPassSummary> {
      return run(baseDeps);
    },
    flushPendingWith(overrides: Partial<SaleSyncFlushWorkerDeps>): Promise<FlushPassSummary> {
      return run({ ...baseDeps, ...overrides });
    },
  };
}
