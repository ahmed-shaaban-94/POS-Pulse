/**
 * T082 — `print_events` repository.
 *
 * Owns SQL access for the `print_events` table (008 Slice 1c). Wraps the
 * production `DatabaseHandle` interface so tests can inject sql.js.
 *
 * Surface per tasks.md T082:
 *   - insert(row)
 *   - readBySale(sale_id) — ordered by printed_at DESC (latest first)
 *   - hasSuccessfulPrint(sale_id) — boolean; AD-10 reprint precondition
 *   - countReprints(sale_id) — used by S5 to allocate
 *     duplicate_copy_sequence_number on the next reprint
 *
 * No update / no delete — append-only at the SQL layer (migration 0022
 * triggers). The repository surface enforces this at the type level by
 * omitting those methods.
 */

import type { DatabaseHandle } from '../../db/client.js';
import type { PrintEventOutcome, PrintEventPurpose } from '../../../shared/sales/types.js';

interface PrepareRun {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}

interface PrepareAll<Row> {
  all(...params: unknown[]): Row[];
}

// ── Closed enums ─────────────────────────────────────────────────────────────
//
// PrintEventOutcome + PrintEventPurpose live in `src/shared/sales/types.ts`
// (S1b) — re-using the canonical tuples keeps repository row shape and the
// renderer-facing summary projection in lockstep (per Nit1 on PR #264).
// PrintEventRenderPath stays local because it's a main-only field
// (Constitution §P15 minimisation; never crosses the bridge).

export type PrintEventRenderPath = 'escpos_direct' | 'os_print';
export type PrintEventFailureReason =
  | 'printer_offline'
  | 'printer_out_of_paper'
  | 'printer_jam'
  | 'os_print_error'
  | 'escpos_write_failure'
  | 'escpos_status_unknown';

export interface PrintEventRow {
  print_event_id: string;
  sale_id: string;
  outcome: PrintEventOutcome;
  purpose: PrintEventPurpose;
  render_path: PrintEventRenderPath | null;
  acting_operator_id: string;
  acting_operator_session_id: string;
  duplicate_copy_sequence_number: number | null;
  failure_reason: PrintEventFailureReason | null;
  previous_failed_print_event_ids: string | null;
  printed_at: string;
}

export type InsertPrintEventInput = PrintEventRow;

export interface PrintEventsRepository {
  insert(row: InsertPrintEventInput): void;
  readBySale(sale_id: string): PrintEventRow[];
  hasSuccessfulPrint(sale_id: string): boolean;
  countReprints(sale_id: string): number;
}

export function bindPrintEventsRepository(db: DatabaseHandle): PrintEventsRepository {
  const insertStmt = db.prepare(
    `INSERT INTO print_events (
       print_event_id, sale_id, outcome, purpose, render_path,
       acting_operator_id, acting_operator_session_id, duplicate_copy_sequence_number,
       failure_reason, previous_failed_print_event_ids, printed_at
     ) VALUES (
       ?, ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?
     )`,
  ) as PrepareRun;

  const readBySaleStmt = db.prepare(
    `SELECT * FROM print_events WHERE sale_id = ? ORDER BY printed_at DESC`,
  ) as PrepareAll<PrintEventRow>;

  const hasSuccessfulPrintStmt = db.prepare(
    `SELECT 1 AS hit FROM print_events
      WHERE sale_id = ? AND outcome = 'success'
      LIMIT 1`,
  ) as PrepareGet<{ hit: number }>;

  const countReprintsStmt = db.prepare(
    `SELECT COUNT(*) AS count_reprints FROM print_events
      WHERE sale_id = ? AND purpose = 'reprint' AND outcome = 'success'`,
  ) as PrepareGet<{ count_reprints: number }>;

  return {
    insert(row: InsertPrintEventInput): void {
      insertStmt.run(
        row.print_event_id,
        row.sale_id,
        row.outcome,
        row.purpose,
        row.render_path,
        row.acting_operator_id,
        row.acting_operator_session_id,
        row.duplicate_copy_sequence_number,
        row.failure_reason,
        row.previous_failed_print_event_ids,
        row.printed_at,
      );
    },

    readBySale(sale_id: string): PrintEventRow[] {
      return readBySaleStmt.all(sale_id);
    },

    hasSuccessfulPrint(sale_id: string): boolean {
      const row = hasSuccessfulPrintStmt.get(sale_id);
      return row !== undefined;
    },

    countReprints(sale_id: string): number {
      // SQLite COUNT(*) always returns exactly one row with one column;
      // row cannot be undefined and count_reprints cannot be null. The
      // defensive `?? 0` would inflate the uncovered-branch count without
      // adding any real safety — instead we assert and propagate the
      // SQLite contract.
      /* c8 ignore start — defensive throw on impossible SQLite contract violation */
      const row = countReprintsStmt.get(sale_id);
      if (row === undefined) {
        throw new Error('SQLite invariant violation: COUNT(*) returned no row');
      }
      /* c8 ignore stop */
      return row.count_reprints;
    },
  };
}
