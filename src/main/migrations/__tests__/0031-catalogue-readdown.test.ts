/**
 * 010-pos-catalog-read-down-consumption T010 — migration-shape test for the
 * read-down staging + sync-state tables (`0031`/`0032`/`0033`).
 *
 * Executes the real `migrations/0031..0033_*.sql` against an in-memory sql.js
 * database (the same sql.js + `readFileSync` harness 009's `0004` append-only
 * test uses). Production runs better-sqlite3 (native ABI) which won't load in
 * Vitest's system Node (R1); sql.js IS SQLite proper, so column/CHECK/PK
 * semantics match exactly.
 *
 * Asserts the §A2-ratified shape (2026-06-05):
 *   • `products_staging.branch_id`        → TEXT NOT NULL  (§A2 D6)
 *   • `catalogue_sync_state.branch_id`    → TEXT NOT NULL  (§A2 D6)
 *   • `product_barcodes_staging`          → mirrors 0030, NO branch/store column
 *   • money INTEGER NOT NULL CHECK (>= 0); booleans 0/1; staging carries NO
 *     lookup indexes; logical FKs only.
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
    pk: r[5] as number,
  }));
}

/** A column that MUST exist; throws (failing the test) if absent — no `!` needed. */
function col(db: SqlJsDatabase, table: string, name: string): ColumnInfo {
  const found = tableInfo(db, table).find((c) => c.name === name);
  if (found === undefined) throw new Error(`column ${table}.${name} not found`);
  return found;
}

describe('010 migrations 0031/0032/0033 — read-down staging + sync-state shape (T010)', () => {
  let db: SqlJsDatabase;

  beforeEach(() => {
    db = newDb();
    db.exec('PRAGMA foreign_keys = ON;');
    // The staging tables logically reference the live 0029/0030 tables; apply
    // those first so the migration set is self-consistent (the promote
    // INSERT…SELECT targets them). No SQL FOREIGN KEY, so order is not strictly
    // required, but mirrors production migration order.
    db.exec(migrationSql('0029_create_products.sql'));
    db.exec(migrationSql('0030_create_product_barcodes.sql'));
    db.exec(migrationSql('0031_create_products_staging.sql'));
    db.exec(migrationSql('0032_create_product_barcodes_staging.sql'));
    db.exec(migrationSql('0033_create_catalogue_sync_state.sql'));
  });

  afterEach(() => {
    db.close();
  });

  it('all three migrations apply cleanly and create the expected tables', () => {
    const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    const names = (res[0]?.values.flat() ?? []) as string[];
    expect(names).toContain('products_staging');
    expect(names).toContain('product_barcodes_staging');
    expect(names).toContain('catalogue_sync_state');
  });

  it('products_staging mirrors the 009 products columns', () => {
    const liveCols = tableInfo(db, 'products').map((c) => c.name);
    const stagingCols = tableInfo(db, 'products_staging').map((c) => c.name);
    expect(stagingCols).toEqual(liveCols);
  });

  it('products_staging.branch_id is TEXT NOT NULL (§A2 D6 — store-scoped)', () => {
    const branch = col(db, 'products_staging', 'branch_id');
    expect(branch.type).toBe('TEXT');
    expect(branch.notnull).toBe(1);
  });

  it('products_staging.price_minor is INTEGER NOT NULL and rejects a negative value (P1)', () => {
    const price = col(db, 'products_staging', 'price_minor');
    expect(price.type).toBe('INTEGER');
    expect(price.notnull).toBe(1);
    expect(() =>
      db.run(
        `INSERT INTO products_staging
           (product_id, tenant_id, branch_id, sku, sku_norm, name_ar, name_fold,
            price_minor, tax_category, active, controlled_substance, prescription_required,
            row_version, created_at, updated_at)
         VALUES ('p','t','b','s','s','n','n', -1, 'standard', 1, 0, 0, 'v1', 'x', 'x')`,
      ),
    ).toThrow(/CHECK constraint/i);
  });

  it('products_staging carries NO lookup indexes (009 never reads staging)', () => {
    const res = db.exec(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='products_staging' AND sql IS NOT NULL`,
    );
    const idx = (res[0]?.values.flat() ?? []) as string[];
    expect(idx).toHaveLength(0);
  });

  it('product_barcodes_staging mirrors 0030 exactly — no branch/store column', () => {
    const liveCols = tableInfo(db, 'product_barcodes').map((c) => c.name);
    const stagingCols = tableInfo(db, 'product_barcodes_staging').map((c) => c.name);
    expect(stagingCols).toEqual(liveCols);
    // §A2: barcode rows are store-scoped transitively via tenant_id + product_id;
    // NO branch/store column of its own.
    expect(stagingCols).not.toContain('branch_id');
    expect(stagingCols).not.toContain('store_id');
    // barcode_kind stays nullable (always NULL in v1 — untyped backend aliases).
    expect(col(db, 'product_barcodes_staging', 'barcode_kind').notnull).toBe(0);
  });

  it('product_barcodes_staging carries NO lookup indexes', () => {
    const res = db.exec(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='product_barcodes_staging' AND sql IS NOT NULL`,
    );
    const idx = (res[0]?.values.flat() ?? []) as string[];
    expect(idx).toHaveLength(0);
  });

  it('catalogue_sync_state has tenant_id PK and branch_id TEXT NOT NULL', () => {
    const tenant = col(db, 'catalogue_sync_state', 'tenant_id');
    expect(tenant.pk).toBe(1);
    const branch = col(db, 'catalogue_sync_state', 'branch_id');
    expect(branch.type).toBe('TEXT');
    expect(branch.notnull).toBe(1);
  });

  it('catalogue_sync_state bookkeeping columns are nullable (null until first success)', () => {
    for (const c of ['last_success_at', 'source_snapshot_id', 'last_attempt_at', 'last_outcome']) {
      expect(col(db, 'catalogue_sync_state', c).notnull).toBe(0);
    }
  });

  it('catalogue_sync_state allows a row with only tenant_id + branch_id (rest null)', () => {
    expect(() =>
      db.run(`INSERT INTO catalogue_sync_state (tenant_id, branch_id) VALUES ('t', 'b')`),
    ).not.toThrow();
    const res = db.exec(`SELECT last_success_at FROM catalogue_sync_state WHERE tenant_id='t'`);
    expect(res[0]?.values[0]?.[0]).toBeNull();
  });

  it('all three staging/state tables ship empty', () => {
    for (const t of ['products_staging', 'product_barcodes_staging', 'catalogue_sync_state']) {
      const res = db.exec(`SELECT COUNT(*) FROM ${t}`);
      expect(res[0]?.values[0]?.[0]).toBe(0);
    }
  });
});
