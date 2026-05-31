import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { freshCatalogueDb, handleFor, initCatalogueSql } from './__helpers__/catalogue-fixture.js';
import { createProductRepo, type ProductRepo } from '../product-repo.js';
import { normalize } from '../normalize.js';
import type { Database as SqlJsDatabase } from 'sql.js';

/**
 * 009 T035 — folded substring search at scale (~50k rows). NFR-2 correctness.
 *
 * ⚠️ NO TIMING ASSERTION — by design, and more so than T028. The matcher is
 * `name_fold LIKE '%q%'`, a LEADING-WILDCARD scan that research §R4 explicitly
 * documents as a deliberate full-table scan (NOT index-served). Under sql.js in
 * the parallel Vitest runner, a 50k-row LIKE scan is both slow and high-variance
 * — a wall-clock p95 here would be the worst flake candidate in the suite. The
 * NFR-2 budget (≤150 ms p95) is a property of production better-sqlite3 on the
 * target Windows terminal; its authoritative bring-up is **T054 at §A5** (same
 * 008 bench-smoke posture as T028). If §A5 misses the budget, R-RISK-1 triggers
 * the FTS5-fallback review.
 *
 * What this DOES guarantee: search stays CORRECT at a realistic ~50k-row scale —
 * the ranked/capped/truncated contract holds and the right product surfaces.
 */

const TENANT = 'tenant-1';
const ROWS = 50_000;
// Seed the ~50k-row catalogue ONCE (the full-migration apply + 50k inserts is
// expensive); doing it per-`it` (×3) risks the 5000ms default timeout under
// `--coverage` in the full parallel suite. The DB is read-only across the cases.
const SUITE_TIMEOUT_MS = 60_000;

let db: SqlJsDatabase;
let repo: ProductRepo;

beforeAll(async () => {
  await initCatalogueSql();
  db = freshCatalogueDb();
  seedLargeCatalogue(db);
  repo = createProductRepo(handleFor(db));
}, SUITE_TIMEOUT_MS);

afterAll(() => {
  db.close();
});

/**
 * Bulk-seed ~50k active products in one transaction. Most names share a common
 * token ("منتج"/"Product") so a query hits the cap; a single uniquely-named
 * product ("زنكتابليت-فريد") lets us assert an exact, ranked single match.
 */
function seedLargeCatalogue(db: SqlJsDatabase): void {
  db.run('BEGIN');
  const product = db.prepare(
    `INSERT INTO products
       (product_id, tenant_id, branch_id, sku, sku_norm, name_ar, name_en, name_fold,
        aliases_json, alias_fold, price_minor, tax_category, unit_pack_label, active,
        controlled_substance, prescription_required, row_version, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const ts = '2026-05-31T00:00:00.000Z';
  for (let i = 0; i < ROWS; i++) {
    const id = String(i);
    const isUnique = i === Math.floor(ROWS / 2);
    const nameAr = isUnique ? 'زنكتابليت فريد' : `منتج ${id}`;
    const nameEn = isUnique ? 'Zinctablet Unique' : `Product ${id}`;
    product.run([
      `p-${id}`,
      TENANT,
      null,
      `SKU-${id}`,
      normalize(`SKU-${id}`),
      nameAr,
      nameEn,
      normalize(`${nameAr} ${nameEn}`),
      null,
      null,
      100 + (i % 1000),
      'standard',
      null,
      1,
      0,
      0,
      'v1',
      ts,
      ts,
    ] as never[]);
  }
  product.free();
  db.run('COMMIT');
}

describe('T035 — folded search correctness @ ~50k rows (sql.js; NFR-2 p95 bring-up = T054)', () => {
  it('caps a broad match at 20 and flags truncated against a 50k-row table', () => {
    // "منتج" / "product" matches ~50k rows → capped, truncated.
    const r = repo.search(TENANT, 'product');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items).toHaveLength(20);
      expect(r.truncated).toBe(true);
    }
  });

  it('surfaces the one uniquely-named product among 50k rows (no false negatives at scale)', () => {
    const r = repo.search(TENANT, 'zinctablet');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items).toHaveLength(1);
      expect(r.items[0]?.product_id).toBe(`p-${String(Math.floor(ROWS / 2))}`);
      expect(r.truncated).toBe(false);
    }
  });

  it('returns not_found (not a false positive) for an absent token at scale', () => {
    expect(repo.search(TENANT, 'zzzznomatchanywhere').kind).toBe('not_found');
  });
});
