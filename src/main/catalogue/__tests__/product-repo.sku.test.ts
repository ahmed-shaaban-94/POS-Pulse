import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';

/**
 * 009 T023 (RED) — `product-repo` exact SKU lookup.
 *
 * Contract (data-model.md §"Entity: Product" + FR-9 / §A2 D1):
 *   • one active match  → { kind: 'one', product }
 *   • zero matches      → { kind: 'not_found' }
 *   • inactive          → excluded (FR-18)
 *   • tenant-scoped     → P17
 *
 * An SKU is unique per tenant (application-enforced by the sourcing feature), so
 * `ambiguous` should not normally occur — but the response shape carries it for
 * safety, and a misseeded duplicate active SKU is reported as ambiguous rather
 * than silently picking one. The repo folds the raw SKU via `normalize()`
 * (matches the stored `sku_norm`, FR-12b).
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';

describe('T023 — product-repo exact SKU lookup', () => {
  it('returns the single active product for an exact SKU match', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-PARA-500', price_minor: 1500 });
    const repo = createProductRepo(handleFor(db));

    const r = repo.lookupBySku(TENANT, 'SKU-PARA-500');

    expect(r.kind).toBe('one');
    if (r.kind === 'one') {
      expect(r.product.product_id).toBe('p-1');
      expect(r.product.sku).toBe('SKU-PARA-500');
      expect(r.product.price_minor).toBe(1500);
    }
    db.close();
  });

  it('matches a case-variant SKU via normalize() round trip (FR-12b)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-PARA-500' });
    const repo = createProductRepo(handleFor(db));

    // sku_norm stored is normalize('SKU-PARA-500') === 'sku-para-500'.
    expect(repo.lookupBySku(TENANT, 'sku-para-500').kind).toBe('one');
    db.close();
  });

  it('returns not_found for an unknown SKU against a populated catalogue', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-PARA-500' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupBySku(TENANT, 'SKU-DOES-NOT-EXIST').kind).toBe('not_found');
    db.close();
  });

  it('excludes an inactive product (not-found-for-selling, FR-18)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-dead', sku: 'SKU-DEAD', active: 0 });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupBySku(TENANT, 'SKU-DEAD').kind).toBe('not_found');
    db.close();
  });

  it('never returns a product belonging to another tenant (P17)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-other', tenant_id: 'tenant-2', sku: 'SKU-X' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupBySku(TENANT, 'SKU-X').kind).toBe('not_found');
    db.close();
  });

  it('reports a duplicate active SKU as ambiguous rather than silently picking one', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-DUP' });
    seedProduct(db, { product_id: 'p-2', sku: 'SKU-DUP' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupBySku(TENANT, 'SKU-DUP').kind).toBe('ambiguous');
    db.close();
  });
});
