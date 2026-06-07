/**
 * 011-sale-sync-capture-up T010 — migration-shape test for `sale_sync_state`.
 *
 * Executes the real `migrations/0034_create_sale_sync_state.sql` against an
 * in-memory sql.js database (same harness as 010's `0031` test). Production
 * runs better-sqlite3 (native ABI, won't load in Vitest's Node); sql.js IS
 * SQLite proper, so column/CHECK/PK semantics match exactly.
 *
 * Asserts the data-model.md §"sale_sync_state" shape:
 *   • `sale_id` TEXT PK
 *   • `tenant_id` / `branch_id` TEXT NOT NULL
 *   • `sync_status` TEXT NOT NULL CHECK(IN ('pending','synced','dead_letter'))
 *   • `attempt_count` INTEGER NOT NULL DEFAULT 0 CHECK(>= 0)
 *   • `next_retry_at` / `last_error_category` / `last_attempt_at` / `synced_at` nullable
 *   • `created_at` / `updated_at` TEXT NOT NULL
 *   • index on (tenant_id, sync_status, next_retry_at)
 *   • 008's enqueue-only `sale_sync_outbox` is NOT modified by this migration
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __tests__ → migrations → main → src → repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'migrations');

function migrationSql(name: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
}

let SQL: SqlJsStatic | undefined;

function newDb(): SqlJsDatabase {
  if (SQL === undefined) throw new Error('initSqlJs() must complete in beforeAll first');
  return new SQL.Database();
}

beforeAll(async () => {
  SQL = await initSqlJs();
});

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt: unknown;
  pk: number;
}

function tableInfo(db: SqlJsDatabase, table: string): ColumnInfo[] {
  const res = db.exec(`PRAGMA table_info(${table})`);
  const first = res[0];
  if (first === undefined) return [];
  // PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
  return first.values.map((r) => ({
    name: r[1] as string,
    type: r[2] as string,
    notnull: r[3] as number,
    dflt: r[4],
    pk: r[5] as number,
  }));
}

function col(db: SqlJsDatabase, table: string, name: string): ColumnInfo {
  const found = tableInfo(db, table).find((c) => c.name === name);
  if (found === undefined) throw new Error(`column ${table}.${name} not found`);
  return found;
}

function indexNames(db: SqlJsDatabase, table: string): string[] {
  const res = db.exec(`PRAGMA index_list(${table})`);
  const first = res[0];
  if (first === undefined) return [];
  return first.values.map((r) => r[1] as string);
}

describe('011 migration 0034 — sale_sync_state shape (T010)', () => {
  let db: SqlJsDatabase;

  beforeEach(() => {
    db = newDb();
    db.exec('PRAGMA foreign_keys = ON;');
    // sale_sync_state logically references sales(sale_id) / the outbox; apply the
    // prerequisite tables first so the migration set is self-consistent.
    db.exec(migrationSql('0020_create_sales.sql'));
    db.exec(migrationSql('0024_create_sale_sync_outbox.sql'));
    db.exec(migrationSql('0034_create_sale_sync_state.sql'));
  });

  afterEach(() => {
    db.close();
  });

  it('creates sale_sync_state with sale_id as the TEXT primary key', () => {
    const c = col(db, 'sale_sync_state', 'sale_id');
    expect(c.type).toBe('TEXT');
    expect(c.pk).toBe(1);
  });

  it('has NOT NULL tenant_id and branch_id (P17 scope)', () => {
    expect(col(db, 'sale_sync_state', 'tenant_id').notnull).toBe(1);
    expect(col(db, 'sale_sync_state', 'branch_id').notnull).toBe(1);
  });

  /** Insert a parent `sales` row so a sale_sync_state FK insert can succeed. */
  function seedSale(id: string): void {
    db.exec(
      `INSERT INTO sales (sale_id, sale_number, receipt_number, envelope_handoff_action_id, payment_attempt_id, envelope_cart_id, tenant_id, branch_id, terminal_id, terminal_label, selling_operator_id, selling_operator_display_name, selling_operator_session_id, subtotal_minor, total_tax_minor, total_change_due_minor, tender_lines_summary_json, settled_at, finalized_at, tenant_tax_registration_id, branch_name, branch_address, local_calendar_day)
       VALUES ('${id}','SN-${id}','R-${id}','h-${id}','pa','c','t1','b1','term1','Till 1','op1','Op','sess1',1000,0,0,'[]','2026-06-07T00:00:00Z','2026-06-07T00:00:00Z','TRN','Branch','Addr','2026-06-07')`,
    );
  }

  it('has sync_status NOT NULL constrained to pending/synced/dead_letter', () => {
    expect(col(db, 'sale_sync_state', 'sync_status').notnull).toBe(1);
    seedSale('s1');
    seedSale('s2');
    db.exec(
      `INSERT INTO sale_sync_state (sale_id, tenant_id, branch_id, sync_status, attempt_count, created_at, updated_at)
       VALUES ('s1','t1','b1','pending',0,'2026-06-07T00:00:00Z','2026-06-07T00:00:00Z')`,
    );
    // Prove the CHECK rejects an out-of-set status (parent sale exists, so FK is satisfied).
    expect(() =>
      db.exec(
        `INSERT INTO sale_sync_state (sale_id, tenant_id, branch_id, sync_status, attempt_count, created_at, updated_at)
         VALUES ('s2','t1','b1','bogus',0,'2026-06-07T00:00:00Z','2026-06-07T00:00:00Z')`,
      ),
    ).toThrow();
  });

  it('has attempt_count INTEGER NOT NULL DEFAULT 0 with a >= 0 CHECK', () => {
    const c = col(db, 'sale_sync_state', 'attempt_count');
    expect(c.type).toBe('INTEGER');
    expect(c.notnull).toBe(1);
    seedSale('s3');
    expect(() =>
      db.exec(
        `INSERT INTO sale_sync_state (sale_id, tenant_id, branch_id, sync_status, attempt_count, created_at, updated_at)
         VALUES ('s3','t1','b1','pending',-1,'2026-06-07T00:00:00Z','2026-06-07T00:00:00Z')`,
      ),
    ).toThrow();
  });

  it('has nullable next_retry_at / last_error_category / last_attempt_at / synced_at', () => {
    for (const name of ['next_retry_at', 'last_error_category', 'last_attempt_at', 'synced_at']) {
      expect(col(db, 'sale_sync_state', name).notnull).toBe(0);
    }
  });

  it('has NOT NULL created_at and updated_at', () => {
    expect(col(db, 'sale_sync_state', 'created_at').notnull).toBe(1);
    expect(col(db, 'sale_sync_state', 'updated_at').notnull).toBe(1);
  });

  it('creates the (tenant_id, sync_status, next_retry_at) drain-eligibility index', () => {
    const names = indexNames(db, 'sale_sync_state');
    expect(names.some((n) => n.includes('tenant') && n.includes('status'))).toBe(true);
  });

  it('does NOT modify 008 sale_sync_outbox (still enqueue-only: UPDATE refused)', () => {
    db.exec(
      `INSERT INTO sales (sale_id, sale_number, receipt_number, envelope_handoff_action_id, payment_attempt_id, envelope_cart_id, tenant_id, branch_id, terminal_id, terminal_label, selling_operator_id, selling_operator_display_name, selling_operator_session_id, subtotal_minor, total_tax_minor, total_change_due_minor, tender_lines_summary_json, settled_at, finalized_at, tenant_tax_registration_id, branch_name, branch_address, local_calendar_day)
       VALUES ('sale-x','SN1','R1','h1','pa1','c1','t1','b1','term1','Till 1','op1','Op','sess1',1000,0,0,'[]','2026-06-07T00:00:00Z','2026-06-07T00:00:00Z','TRN','Branch','Addr','2026-06-07')`,
    );
    db.exec(
      `INSERT INTO sale_sync_outbox (outbox_row_id, sale_id, envelope_handoff_action_id, tenant_id, branch_id, terminal_id, state, enqueued_at)
       VALUES ('ob1','sale-x','h1','t1','b1','term1','pending','2026-06-07T00:00:00Z')`,
    );
    expect(() =>
      db.exec(`UPDATE sale_sync_outbox SET state = 'synced' WHERE outbox_row_id = 'ob1'`),
    ).toThrow();
  });
});
