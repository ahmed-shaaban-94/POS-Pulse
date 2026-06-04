/**
 * 010-pos-catalog-read-down-consumption T015 — `catalogue-sync-state-repo`.
 *
 * Tenant-scoped read/write of the `catalogue_sync_state` bookkeeping table
 * (migration `0033`; data-model.md §"Entity: CatalogueSyncState"). One row per
 * tenant, off 009's hot read path (R4) — read only by the freshness surface
 * (FR-16), never by lookup/search/resolve.
 *
 * Two write paths, deliberately distinct so a FAILED run can never advance the
 * freshness clock (SC-10 / P2 truthfulness):
 *   • `recordSuccess` — sets `last_success_at` + `source_snapshot_id` +
 *     `last_outcome='succeeded'`. Called INSIDE the promote transaction so the
 *     freshness time can never claim a promote that did not commit. It does NOT
 *     open its own transaction (the caller owns the tx; SQLite has no nested
 *     BEGIN, so an inner tx would throw inside the promote).
 *   • `recordAttempt` — sets `last_attempt_at` + `last_outcome` for diagnostics
 *     and explicitly LEAVES `last_success_at` untouched. Called OUTSIDE any
 *     transaction (there is no promote on a failed run).
 *
 * Both use a targeted UPSERT on the `tenant_id` PK: a blanket "write the whole
 * row" would clobber `last_success_at` on a failure write. `branch_id` is part of
 * the row's store scope (NOT NULL in the schema) and is always supplied.
 *
 * No secrets: this table holds timestamps + an opaque snapshot id only (P7).
 *
 * Mirrors the 009 `product-repo` DI discipline — the `DatabaseHandle` is injected
 * so tests run on sql.js without the native better-sqlite3 binding.
 */

import type { DatabaseHandle } from '../db/client.js';

/** Read-down outcome recorded for diagnostics. */
export type CatalogueSyncOutcome = 'succeeded' | 'failed' | 'skipped_with_rejections';

/** The stored bookkeeping row (one per tenant). */
export interface CatalogueSyncStateRow {
  tenant_id: string;
  branch_id: string;
  last_success_at: string | null;
  source_snapshot_id: string | null;
  last_attempt_at: string | null;
  last_outcome: CatalogueSyncOutcome | null;
}

/** Inputs for a successful promote's bookkeeping (written inside the promote tx). */
export interface RecordSuccessInput {
  tenantId: string;
  branchId: string;
  /** ISO-8601 UTC timestamp of the committed promote. */
  lastSuccessAt: string;
  /** Opaque backend snapshot/version id (provenance). */
  sourceSnapshotId: string | null;
  /**
   * The committed outcome — `'succeeded'` for a clean promote or
   * `'skipped_with_rejections'` when the valid set promoted but some records were
   * skipped (FR-9). A promote NEVER carries `'failed'` (a failed run does not
   * promote). Defaults to `'succeeded'` when omitted.
   */
  outcome?: Extract<CatalogueSyncOutcome, 'succeeded' | 'skipped_with_rejections'>;
}

/** Inputs for a (success-or-fail) attempt's diagnostics (written outside any tx). */
export interface RecordAttemptInput {
  tenantId: string;
  branchId: string;
  /** ISO-8601 UTC timestamp of the attempt. */
  lastAttemptAt: string;
  outcome: CatalogueSyncOutcome;
}

export interface CatalogueSyncStateRepo {
  /** The bookkeeping row for `tenantId`, or null if no read-down has ever run. */
  read(tenantId: string): CatalogueSyncStateRow | null;
  /**
   * Record a SUCCESSFUL promote. Sets `last_success_at`, `source_snapshot_id` and
   * `last_outcome='succeeded'`. MUST be called inside the promote transaction.
   */
  recordSuccess(input: RecordSuccessInput): void;
  /**
   * Record an ATTEMPT (success or fail) for diagnostics. Sets `last_attempt_at`
   * and `last_outcome`; LEAVES `last_success_at` and `source_snapshot_id`
   * untouched so a failed run never advances the freshness clock (SC-10).
   */
  recordAttempt(input: RecordAttemptInput): void;
}

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}
interface PrepareRun {
  run(...params: unknown[]): unknown;
}

export function createCatalogueSyncStateRepo(db: DatabaseHandle): CatalogueSyncStateRepo {
  function read(tenantId: string): CatalogueSyncStateRow | null {
    const stmt = db.prepare(`
      SELECT tenant_id, branch_id, last_success_at, source_snapshot_id,
             last_attempt_at, last_outcome
      FROM catalogue_sync_state
      WHERE tenant_id = ?
    `) as PrepareGet<CatalogueSyncStateRow>;
    const row = stmt.get(tenantId);
    return row ?? null;
  }

  function recordSuccess(input: RecordSuccessInput): void {
    // Targeted UPSERT: on conflict, advance ONLY the success-related columns.
    // `last_attempt_at` is left to `recordAttempt`; `branch_id` is refreshed
    // (store scope of the row that just promoted). `last_outcome` carries the
    // committed outcome — 'succeeded' or 'skipped_with_rejections' (FR-9) — so
    // the freshness surface (FR-16) can distinguish a clean promote from a
    // promote that dropped some bad rows.
    const outcome = input.outcome ?? 'succeeded';
    const stmt = db.prepare(`
      INSERT INTO catalogue_sync_state
        (tenant_id, branch_id, last_success_at, source_snapshot_id, last_outcome)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        branch_id          = excluded.branch_id,
        last_success_at    = excluded.last_success_at,
        source_snapshot_id = excluded.source_snapshot_id,
        last_outcome       = excluded.last_outcome
    `) as PrepareRun;
    stmt.run(input.tenantId, input.branchId, input.lastSuccessAt, input.sourceSnapshotId, outcome);
  }

  function recordAttempt(input: RecordAttemptInput): void {
    // Targeted UPSERT that NEVER writes last_success_at / source_snapshot_id —
    // a failed/skipped run must not advance the freshness clock (SC-10). On a
    // first-ever attempt the row is inserted with a null last_success_at.
    const stmt = db.prepare(`
      INSERT INTO catalogue_sync_state
        (tenant_id, branch_id, last_attempt_at, last_outcome)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        branch_id       = excluded.branch_id,
        last_attempt_at = excluded.last_attempt_at,
        last_outcome    = excluded.last_outcome
    `) as PrepareRun;
    stmt.run(input.tenantId, input.branchId, input.lastAttemptAt, input.outcome);
  }

  return { read, recordSuccess, recordAttempt };
}
