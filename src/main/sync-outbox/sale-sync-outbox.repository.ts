/**
 * T084 — `sale_sync_outbox` repository.
 *
 * Owns SQL access for the `sale_sync_outbox` table (008 Slice 1c). Wraps the
 * production `DatabaseHandle` interface so tests can inject sql.js.
 *
 * Surface per tasks.md T084:
 *   - insert(row)
 *   - readBySale(sale_id)
 *
 * NO `update` method. AD-11 is enqueue-only — 008 never transitions the
 * `state` column. The future sync engine MAY add an update path via additive
 * migration; until then the SQL-layer trigger (migration 0024) refuses any
 * UPDATE attempt as defence-in-depth.
 *
 * UNIQUE(sale_id): exactly one outbox row per finalized sale (FR-060).
 * CHECK(state = 'pending'): the only state 008 writes is `pending`.
 */

import type { DatabaseHandle } from '../db/client.js';

interface PrepareRun {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}

export type SaleSyncOutboxState = 'pending';

export interface SaleSyncOutboxRow {
  outbox_row_id: string;
  sale_id: string;
  envelope_handoff_action_id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  state: SaleSyncOutboxState;
  enqueued_at: string;
}

export type InsertSaleSyncOutboxInput = SaleSyncOutboxRow;

export interface SaleSyncOutboxRepository {
  insert(row: InsertSaleSyncOutboxInput): void;
  readBySale(sale_id: string): SaleSyncOutboxRow | null;
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
  };
}
