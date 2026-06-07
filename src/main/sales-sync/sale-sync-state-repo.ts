/**
 * 011-sale-sync-capture-up T021 — `sale-sync-state-repo`.
 *
 * Tenant-scoped read/write of the `sale_sync_state` bookkeeping table (migration
 * 0034; data-model.md §"sale_sync_state"). This is 011's OWN mutable state store;
 * 008's `sale_sync_outbox` is read-only here and is never written (it is
 * enqueue-only — CHECK + UPDATE/DELETE-refusing triggers, 008 AD-3).
 *
 * The `eligible()` query is the heart of the drain. It MUST start from the
 * outbox, not from `sale_sync_state`: a freshly-finalized sale has an outbox row
 * but NO state row yet (the state row is created on first attempt). A query that
 * read only `sale_sync_state` would skip every brand-new sale forever. So:
 *
 *   sale_sync_outbox  LEFT JOIN  sale_sync_state  ON sale_id
 *   WHERE no state row yet  OR  (pending AND next_retry_at due/null)
 *   ORDER BY enqueued_at   (FIFO)
 *
 * Mirrors 010's `catalogue-sync-state-repo` DI discipline — `DatabaseHandle` is
 * injected so tests run on sql.js without the native better-sqlite3 binding.
 *
 * No secrets: timestamps + an opaque error category only (P7).
 */

import type { DatabaseHandle } from '../db/client.js';

export type SaleSyncStatus = 'pending' | 'synced' | 'dead_letter';
export type SaleSyncErrorCategory = 'transient' | 'permanent' | 'no_connection';

/** The stored bookkeeping row (one per sale that has begun syncing). */
export interface SaleSyncStateRow {
  sale_id: string;
  tenant_id: string;
  branch_id: string;
  sync_status: SaleSyncStatus;
  attempt_count: number;
  next_retry_at: string | null;
  last_error_category: string | null;
  last_attempt_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A sale that is due for a (re)send: an outbox row, FIFO-ordered by enqueue time. */
export interface EligibleSale {
  sale_id: string;
  tenant_id: string;
  branch_id: string;
  enqueued_at: string;
}

export interface TenantScope {
  tenantId: string;
  branchId: string;
}

export interface MarkSyncedInput extends TenantScope {
  saleId: string;
  /** ISO-8601 UTC. */
  now: string;
}

export interface MarkDeadLetterInput extends TenantScope {
  saleId: string;
  now: string;
}

export interface RecordTransientInput extends TenantScope {
  saleId: string;
  now: string;
  /** ISO-8601 UTC when this sale becomes eligible again (backoff). */
  nextRetryAt: string;
  errorCategory: SaleSyncErrorCategory;
}

export interface SaleSyncStateRepo {
  read(saleId: string): SaleSyncStateRow | null;
  /** Sales due for a send now: outbox rows with no terminal state and (if pending) a due retry. */
  eligible(scope: TenantScope, now: string): EligibleSale[];
  markSynced(input: MarkSyncedInput): void;
  markDeadLetter(input: MarkDeadLetterInput): void;
  recordTransient(input: RecordTransientInput): void;
}

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}
interface PrepareAll<Row> {
  all(...params: unknown[]): Row[];
}
interface PrepareRun {
  run(...params: unknown[]): unknown;
}

export function createSaleSyncStateRepo(db: DatabaseHandle): SaleSyncStateRepo {
  function read(saleId: string): SaleSyncStateRow | null {
    const stmt = db.prepare(
      `SELECT sale_id, tenant_id, branch_id, sync_status, attempt_count, next_retry_at,
              last_error_category, last_attempt_at, synced_at, created_at, updated_at
       FROM sale_sync_state WHERE sale_id = ?`,
    ) as PrepareGet<SaleSyncStateRow>;
    return stmt.get(saleId) ?? null;
  }

  function eligible(scope: TenantScope, now: string): EligibleSale[] {
    // Start from the outbox so first-drain (no state row) is included. A sale is
    // due when it has no state row, OR it is still pending and its next_retry_at
    // is null/<= now. synced / dead_letter are terminal → excluded. FIFO.
    const stmt = db.prepare(
      `SELECT o.sale_id AS sale_id, o.tenant_id AS tenant_id, o.branch_id AS branch_id,
              o.enqueued_at AS enqueued_at
       FROM sale_sync_outbox o
       LEFT JOIN sale_sync_state s ON s.sale_id = o.sale_id
       WHERE o.tenant_id = ? AND o.branch_id = ?
         AND (
           s.sale_id IS NULL
           OR (s.sync_status = 'pending' AND (s.next_retry_at IS NULL OR s.next_retry_at <= ?))
         )
       ORDER BY o.enqueued_at ASC`,
    ) as PrepareAll<EligibleSale>;
    return stmt.all(scope.tenantId, scope.branchId, now);
  }

  /** UPSERT the terminal/transition state for a sale, tenant-scoped. */
  function upsert(
    input: TenantScope & {
      saleId: string;
      status: SaleSyncStatus;
      now: string;
      bumpAttempt: boolean;
      nextRetryAt: string | null;
      errorCategory: string | null;
      syncedAt: string | null;
    },
  ): void {
    const stmt = db.prepare(
      `INSERT INTO sale_sync_state
         (sale_id, tenant_id, branch_id, sync_status, attempt_count, next_retry_at,
          last_error_category, last_attempt_at, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sale_id) DO UPDATE SET
         sync_status         = excluded.sync_status,
         attempt_count       = attempt_count + ?,
         next_retry_at       = excluded.next_retry_at,
         last_error_category = excluded.last_error_category,
         last_attempt_at     = excluded.last_attempt_at,
         synced_at           = COALESCE(excluded.synced_at, synced_at),
         updated_at          = excluded.updated_at
       WHERE tenant_id = excluded.tenant_id`,
    ) as PrepareRun;
    const initialAttempt = input.bumpAttempt ? 1 : 0;
    const conflictBump = input.bumpAttempt ? 1 : 0;
    stmt.run(
      input.saleId,
      input.tenantId,
      input.branchId,
      input.status,
      initialAttempt,
      input.nextRetryAt,
      input.errorCategory,
      input.now,
      input.syncedAt,
      input.now,
      input.now,
      conflictBump,
    );
  }

  function markSynced(input: MarkSyncedInput): void {
    upsert({
      ...input,
      status: 'synced',
      bumpAttempt: false,
      nextRetryAt: null,
      errorCategory: null,
      syncedAt: input.now,
    });
  }

  function markDeadLetter(input: MarkDeadLetterInput): void {
    upsert({
      ...input,
      status: 'dead_letter',
      bumpAttempt: false,
      nextRetryAt: null,
      errorCategory: 'permanent',
      syncedAt: null,
    });
  }

  function recordTransient(input: RecordTransientInput): void {
    upsert({
      tenantId: input.tenantId,
      branchId: input.branchId,
      saleId: input.saleId,
      status: 'pending',
      bumpAttempt: true,
      nextRetryAt: input.nextRetryAt,
      errorCategory: input.errorCategory,
      now: input.now,
      syncedAt: null,
    });
  }

  return { read, eligible, markSynced, markDeadLetter, recordTransient };
}
