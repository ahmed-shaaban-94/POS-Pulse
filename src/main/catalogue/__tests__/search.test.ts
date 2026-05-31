import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';

/**
 * 009 T031 (RED) — folded substring name/alias search.
 *
 * Contract (spec FR-11/12/14/17 + research §R4):
 *   • substring match against the prefolded `name_fold` OR `alias_fold`
 *     (both produced by the same `normalize()` the query is folded with — FR-12b);
 *   • ranked: exact-PREFIX matches before mid-string matches (FR-14);
 *   • deterministic TOTAL order within a tier (fold text, then product_id) so the
 *     list is stable — SQLite returns rows unordered otherwise;
 *   • active-only (FR-18) and tenant-scoped (P17);
 *   • capped at 20; `truncated = true` when matches EXCEED the cap (FR-17);
 *   • `unavailable` when the read model is empty/missing/unreadable (FR-24),
 *     distinct from `not_found` (populated, zero matches);
 *   • LIKE metacharacters in the query (`%`, `_`) match LITERALLY (pharma names
 *     carry `%`, e.g. "0.9%").
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';

function items(r: ReturnType<ReturnType<typeof createProductRepo>['search']>): string[] {
  return r.kind === 'results' ? r.items.map((p) => p.product_id) : [];
}

describe('T031 — folded substring search', () => {
  it('returns active products whose name contains the (folded) query', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', name_ar: 'بنادول اكسترا', name_en: 'Panadol Extra' });
    seedProduct(db, { product_id: 'p-2', name_ar: 'اوجمنتين', name_en: 'Augmentin' });
    const repo = createProductRepo(handleFor(db));

    const r = repo.search(TENANT, 'بنادول');
    expect(r.kind).toBe('results');
    expect(items(r)).toEqual(['p-1']);
    db.close();
  });

  it('matches mid-string, not only prefix (substring, not prefix-only)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', name_ar: 'علاج', name_en: 'Extra Strength Panadol' });
    const repo = createProductRepo(handleFor(db));

    // "panadol" appears mid-string in the English name fold.
    expect(items(repo.search(TENANT, 'panadol'))).toEqual(['p-1']);
    db.close();
  });

  it('ranks exact-prefix matches before mid-string matches (FR-14)', () => {
    const db = freshCatalogueDb();
    // p-mid: query is mid-string; p-prefix: query is the start of the name.
    seedProduct(db, { product_id: 'p-mid', name_ar: 'سيتال بنادول', name_en: 'Cetal panadol' });
    seedProduct(db, { product_id: 'p-prefix', name_ar: 'بنادول', name_en: 'panadol forte' });
    const repo = createProductRepo(handleFor(db));

    // Prefix match must come first regardless of insertion order.
    expect(items(repo.search(TENANT, 'panadol'))).toEqual(['p-prefix', 'p-mid']);
    db.close();
  });

  it('orders same-tier matches deterministically (stable total order)', () => {
    const db = freshCatalogueDb();
    // Two prefix matches with the same fold text — tie-break must be stable.
    seedProduct(db, { product_id: 'p-bbb', name_ar: 'دواء', name_en: 'aspirin' });
    seedProduct(db, { product_id: 'p-aaa', name_ar: 'دواء', name_en: 'aspirin' });
    const repo = createProductRepo(handleFor(db));

    // Deterministic: same fold text → tie-break on product_id ascending.
    expect(items(repo.search(TENANT, 'aspirin'))).toEqual(['p-aaa', 'p-bbb']);
    db.close();
  });

  it('excludes inactive products (FR-18)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-dead', name_en: 'Aspirin', active: 0 });
    const repo = createProductRepo(handleFor(db));

    expect(repo.search(TENANT, 'aspirin').kind).toBe('not_found');
    db.close();
  });

  it('never returns a product from another tenant (P17)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-2', tenant_id: 'tenant-2', name_en: 'Aspirin' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.search(TENANT, 'aspirin').kind).toBe('not_found');
    db.close();
  });

  it('caps results at 20 and sets truncated=true when matches exceed the cap (FR-17)', () => {
    const db = freshCatalogueDb();
    for (let i = 0; i < 25; i++) {
      const id = String(i).padStart(2, '0');
      seedProduct(db, { product_id: `p-${id}`, name_en: `Aspirin ${id}` });
    }
    const repo = createProductRepo(handleFor(db));

    const r = repo.search(TENANT, 'aspirin');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items).toHaveLength(20);
      expect(r.truncated).toBe(true);
    }
    db.close();
  });

  it('does NOT set truncated when matches are at or below the cap', () => {
    const db = freshCatalogueDb();
    for (let i = 0; i < 20; i++) {
      const id = String(i).padStart(2, '0');
      seedProduct(db, { product_id: `p-${id}`, name_en: `Aspirin ${id}` });
    }
    const repo = createProductRepo(handleFor(db));

    const r = repo.search(TENANT, 'aspirin');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items).toHaveLength(20);
      expect(r.truncated).toBe(false);
    }
    db.close();
  });

  it('returns not_found for a populated catalogue with zero matches (distinct from unavailable)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', name_en: 'Aspirin' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.search(TENANT, 'zzzznomatch').kind).toBe('not_found');
    db.close();
  });

  it('returns unavailable for an empty read model (FR-24, distinct from not_found)', () => {
    const db = freshCatalogueDb();
    const repo = createProductRepo(handleFor(db));

    expect(repo.search(TENANT, 'aspirin').kind).toBe('unavailable');
    db.close();
  });

  it('treats LIKE metacharacters in the query literally (% / _ are not wildcards)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-saline', name_ar: 'محلول ملحي', name_en: 'Saline 0.9%' });
    seedProduct(db, { product_id: 'p-other', name_ar: 'دواء', name_en: 'Aspirin' });
    const repo = createProductRepo(handleFor(db));

    // "0.9%" must match only the saline product, NOT every row (an unescaped
    // trailing % would make "%0.9%%" match everything).
    expect(items(repo.search(TENANT, '0.9%'))).toEqual(['p-saline']);
    // A bare "%" must not match-all either.
    const bare = repo.search(TENANT, '%a');
    expect(bare.kind).toBe('not_found');
    db.close();
  });
});
