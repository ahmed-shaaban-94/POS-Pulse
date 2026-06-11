/**
 * `sale_sync_outbox` repository tests.
 *
 * Surface:
 *   - insert(row) / readBySale(sale_id)
 *   - readPending() / markSynced / markFailed / bumpAttempt   (008 sale-sync flush)
 *
 * Migration 0035 relaxed the original append-only design (0024): the state CHECK
 * is now {pending,synced,failed} and the blanket no-UPDATE trigger is replaced by
 * a GUARDED one (forward transitions from pending; immutable provenance; DELETE
 * still denied). These tests exercise the SQL + that trigger against a real DB.
 * UNIQUE(sale_id): exactly one outbox row per finalized sale (FR-060).
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { bindSaleSyncOutboxRepository } from '../../../../src/main/sync-outbox/sale-sync-outbox.repository.js';
import { makeSqlJsHandle } from '../cart/__helpers__/sql-js-handle.js';

const __dirnameForFile = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirnameForFile, '..', '..', '..', '..');
// 0035 strips its `-- @no-wrap-transaction` directives + PRAGMA/BEGIN/COMMIT
// lines for the in-memory sql.js harness (the directive + foreign_keys toggle
// are the production migrate-runner's concern; here we exec the DDL directly).
const M0035 = readFileSync(
  path.join(REPO_ROOT, 'migrations', '0035_sale_sync_outbox_states.sql'),
  'utf8',
)
  .split('\n')
  .filter(
    (l) =>
      !/^\s*PRAGMA foreign_keys/.test(l) &&
      !/^\s*BEGIN;\s*$/.test(l) &&
      !/^\s*COMMIT;\s*$/.test(l) &&
      !/^\s*PRAGMA foreign_key_check;\s*$/.test(l),
  )
  .join('\n');
const MIGRATIONS = [
  readFileSync(path.join(REPO_ROOT, 'migrations', '0020_create_sales.sql'), 'utf8'),
  readFileSync(path.join(REPO_ROOT, 'migrations', '0021_sales_append_only_trigger.sql'), 'utf8'),
  readFileSync(path.join(REPO_ROOT, 'migrations', '0024_create_sale_sync_outbox.sql'), 'utf8'),
  M0035,
];

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

let db: SqlJsDatabase;
beforeEach(() => {
  db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of MIGRATIONS) db.exec(sql);
  db.exec(
    `INSERT INTO sales (
       sale_id, sale_number, receipt_number, envelope_handoff_action_id, payment_attempt_id,
       envelope_cart_id, tenant_id, branch_id, terminal_id, terminal_label,
       selling_operator_id, selling_operator_display_name, selling_operator_session_id,
       subtotal_minor, total_tax_minor, total_change_due_minor, tender_lines_summary_json,
       settled_at, finalized_at, tenant_tax_registration_id, branch_name, branch_address,
       local_calendar_day
     ) VALUES (
       'sale-1', 'TERM-01-2026-05-27-000001', 'TERM-01-2026-05-27-000001', 'handoff-1', 'pa-1',
       'cart-1', 'tenant-1', 'branch-1', 'terminal-1', 'TERM-01',
       'op-abc', 'Ahmed', 'sess-1',
       1500, 0, 0, '[]',
       '2026-05-27T10:00:00.000Z', '2026-05-27T10:00:00.500Z', 'TRN', 'B', 'A',
       '2026-05-27'
     )`,
  );
});

function buildOutboxRow(overrides: Record<string, unknown> = {}) {
  return {
    outbox_row_id: 'ob-1',
    sale_id: 'sale-1',
    envelope_handoff_action_id: 'handoff-1',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'terminal-1',
    state: 'pending' as const,
    enqueued_at: '2026-05-27T10:00:00.600Z',
    ...overrides,
  };
}

describe('T084 — sale_sync_outbox repository: insert + readBySale', () => {
  it('inserts and reads back an outbox row', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    const row = repo.readBySale('sale-1');
    expect(row).toBeDefined();
    expect(row?.outbox_row_id).toBe('ob-1');
    expect(row?.state).toBe('pending');
    expect(row?.envelope_handoff_action_id).toBe('handoff-1');
  });

  it('readBySale returns null when sale has no outbox row', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    expect(repo.readBySale('sale-1')).toBeNull();
  });

  it('UNIQUE(sale_id) prevents a second outbox row per sale (FR-060)', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    expect(() => {
      repo.insert(buildOutboxRow({ outbox_row_id: 'ob-2' }));
    }).toThrow(/UNIQUE constraint failed/);
  });

  it('CHECK constraint forbids an unknown state (not in {pending,synced,failed}) at insert', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    expect(() => {
      repo.insert(buildOutboxRow({ state: 'sent' as unknown as 'pending' }));
    }).toThrow(/CHECK constraint failed/);
  });
});

describe('sale_sync_outbox repository: flush state transitions (0035)', () => {
  it('readPending returns pending rows oldest-first; excludes synced/failed', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    // Two sales (the fixture seeds sale-1; add sale-2).
    db.exec(
      `INSERT INTO sales (sale_id, sale_number, receipt_number, envelope_handoff_action_id, payment_attempt_id,
         envelope_cart_id, tenant_id, branch_id, terminal_id, terminal_label,
         selling_operator_id, selling_operator_display_name, selling_operator_session_id,
         subtotal_minor, total_tax_minor, total_change_due_minor, tender_lines_summary_json,
         settled_at, finalized_at, tenant_tax_registration_id, branch_name, branch_address, local_calendar_day)
       VALUES ('sale-2','TERM-01-2026-05-27-000002','TERM-01-2026-05-27-000002','handoff-2','pa-2',
         'cart-2','tenant-1','branch-1','terminal-1','TERM-01','op-abc','Ahmed','sess-1',
         2000,0,0,'[]','2026-05-27T11:00:00.000Z','2026-05-27T11:00:00.500Z','TRN','B','A','2026-05-27')`,
    );
    repo.insert(
      buildOutboxRow({
        outbox_row_id: 'ob-2',
        sale_id: 'sale-2',
        enqueued_at: '2026-05-27T11:00:00.600Z',
      }),
    );
    repo.insert(buildOutboxRow()); // sale-1, earlier enqueued_at

    const pending = repo.readPending();
    expect(pending.map((r) => r.sale_id)).toEqual(['sale-1', 'sale-2']); // oldest first
    expect(pending[0]?.attempt_count).toBe(0);
    expect(pending[0]?.last_error).toBeNull();

    repo.markSynced('sale-1');
    expect(repo.readPending().map((r) => r.sale_id)).toEqual(['sale-2']);
  });

  it('markSynced transitions pending → synced (and is idempotent)', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    repo.markSynced('sale-1');
    expect(repo.readBySale('sale-1')?.state).toBe('synced');
    // Idempotent: re-marking a synced row is a no-op (WHERE state='pending'), not a throw.
    expect(() => {
      repo.markSynced('sale-1');
    }).not.toThrow();
    expect(repo.readBySale('sale-1')?.state).toBe('synced');
  });

  it('markFailed transitions pending → failed and records last_error', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    repo.markFailed('sale-1', 'captureSale refused (4xx)');
    const row = repo.readBySale('sale-1');
    expect(row?.state).toBe('failed');
    expect(row?.last_error).toBe('captureSale refused (4xx)');
  });

  it('bumpAttempt increments attempt_count, leaving the row pending', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    repo.bumpAttempt('sale-1');
    repo.bumpAttempt('sale-1');
    const row = repo.readBySale('sale-1');
    expect(row?.state).toBe('pending');
    expect(row?.attempt_count).toBe(2);
  });

  it('a terminal (synced) row rejects further transition — guarded trigger', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    repo.markSynced('sale-1');
    // Direct UPDATE attempting to mutate a terminal row is aborted by the trigger.
    expect(() =>
      db.exec("UPDATE sale_sync_outbox SET state = 'failed' WHERE sale_id = 'sale-1'"),
    ).toThrow(/already terminal/);
  });

  it('the guarded trigger rejects mutation of immutable provenance columns', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    expect(() =>
      db.exec("UPDATE sale_sync_outbox SET tenant_id = 'tampered' WHERE sale_id = 'sale-1'"),
    ).toThrow(/provenance columns are immutable/);
  });

  it('DELETE is still denied (append-only history, 008 AD-3)', () => {
    const repo = bindSaleSyncOutboxRepository(makeSqlJsHandle(db));
    repo.insert(buildOutboxRow());
    expect(() => db.exec("DELETE FROM sale_sync_outbox WHERE sale_id = 'sale-1'")).toThrow(
      /append-only — DELETE denied/,
    );
  });
});
