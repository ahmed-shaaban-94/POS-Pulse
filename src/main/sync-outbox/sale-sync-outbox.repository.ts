/**
 * T084 — `sale_sync_outbox` repository.
 *
 * Owns SQL access for the `sale_sync_outbox` table (008 Slice 1c). Wraps the
 * production `DatabaseHandle` interface so tests can inject sql.js.
 *
 * Surface:
 *   - insert(row)
 *   - readBySale(sale_id)
 *   - readPending()                         — 008 sale-sync flush
 *   - markSynced(sale_id)                   — pending → synced
 *   - markFailed(sale_id, error)            — pending → failed
 *
 * The flush engine (008 sale-sync, migration 0035) added the state-transition
 * path that 008-Slice-1c deliberately omitted: the original enqueue-only design
 * (AD-11) is now relaxed by 0035, which swaps the blanket no-UPDATE trigger for
 * a GUARDED one (forward transitions from `pending`, immutable provenance) and
 * widens the CHECK to {pending, synced, failed}.
 *
 * UNIQUE(sale_id): exactly one outbox row per finalized sale (FR-060).
 */

import type { DatabaseHandle } from '../db/client.js';

interface PrepareRun {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}

interface PrepareAll<Row> {
  all(...params: unknown[]): Row[];
}

export type SaleSyncOutboxState = 'pending' | 'synced' | 'failed';

export interface SaleSyncOutboxRow {
  outbox_row_id: string;
  sale_id: string;
  envelope_handoff_action_id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  state: SaleSyncOutboxState;
  enqueued_at: string;
  /** Bumped on each transport-failed flush attempt (migration 0035). */
  attempt_count: number;
  /** Last non-retryable refusal detail; null while pending/synced (0035). */
  last_error: string | null;
}

/** Insert input — new rows are always `pending` with attempt_count 0 / no error. */
export type InsertSaleSyncOutboxInput = Pick<
  SaleSyncOutboxRow,
  | 'outbox_row_id'
  | 'sale_id'
  | 'envelope_handoff_action_id'
  | 'tenant_id'
  | 'branch_id'
  | 'terminal_id'
  | 'state'
  | 'enqueued_at'
>;

export interface SaleSyncOutboxRepository {
  insert(row: InsertSaleSyncOutboxInput): void;
  readBySale(sale_id: string): SaleSyncOutboxRow | null;
  /** All rows still awaiting sync, oldest first (the flush worker's queue). */
  readPending(): SaleSyncOutboxRow[];
  /** pending → synced (captureSale 201/200). Idempotent: a synced row stays synced. */
  markSynced(sale_id: string): void;
  /** pending → failed with a refusal detail (non-retryable 4xx). */
  markFailed(sale_id: string, error: string): void;
  /** Bump attempt_count after a retryable (no_connection) attempt; row stays pending. */
  bumpAttempt(sale_id: string): void;
}

export function bindSaleSyncOutboxRepository(db: DatabaseHandle): SaleSyncOutboxRepository {
  const insertStmt = db.prepare(
    `INSERT INTO sale_sync_outbox (
       outbox_row_id, sale_id, envelope_handoff_action_id,
       tenant_id, branch_id, terminal_id, state, enqueued_at
     ) VALUES (
       ?, ?, ?,
       ?, ?, ?, ?, ?
     )`,
  ) as PrepareRun;

  const readBySaleStmt = db.prepare(
    `SELECT * FROM sale_sync_outbox WHERE sale_id = ?`,
  ) as PrepareGet<SaleSyncOutboxRow>;

  // Oldest pending first — the flush worker drains in enqueue order.
  const readPendingStmt = db.prepare(
    `SELECT * FROM sale_sync_outbox WHERE state = 'pending' ORDER BY enqueued_at ASC`,
  ) as PrepareAll<SaleSyncOutboxRow>;

  // Forward transitions only; guarded at the SQL layer by 0035's trigger
  // (terminal rows reject further UPDATE). `state = 'pending'` in the WHERE
  // makes each transition idempotent + race-safe.
  const markSyncedStmt = db.prepare(
    `UPDATE sale_sync_outbox SET state = 'synced', last_error = NULL
       WHERE sale_id = ? AND state = 'pending'`,
  ) as PrepareRun;

  const markFailedStmt = db.prepare(
    `UPDATE sale_sync_outbox SET state = 'failed', last_error = ?
       WHERE sale_id = ? AND state = 'pending'`,
  ) as PrepareRun;

  const bumpAttemptStmt = db.prepare(
    `UPDATE sale_sync_outbox SET attempt_count = attempt_count + 1
       WHERE sale_id = ? AND state = 'pending'`,
  ) as PrepareRun;

  return {
    insert(row: InsertSaleSyncOutboxInput): void {
      insertStmt.run(
        row.outbox_row_id,
        row.sale_id,
        row.envelope_handoff_action_id,
        row.tenant_id,
        row.branch_id,
        row.terminal_id,
        row.state,
        row.enqueued_at,
      );
    },

    readBySale(sale_id: string): SaleSyncOutboxRow | null {
      const row = readBySaleStmt.get(sale_id);
      return row ?? null;
    },

    readPending(): SaleSyncOutboxRow[] {
      return readPendingStmt.all();
    },

    markSynced(sale_id: string): void {
      markSyncedStmt.run(sale_id);
    },

    markFailed(sale_id: string, error: string): void {
      markFailedStmt.run(error, sale_id);
    },

    bumpAttempt(sale_id: string): void {
      bumpAttemptStmt.run(sale_id);
    },
  };
}
