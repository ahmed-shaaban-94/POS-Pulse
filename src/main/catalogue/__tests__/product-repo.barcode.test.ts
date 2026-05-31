import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedBarcode,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';

/**
 * 009 T022 (RED) — `product-repo` exact BARCODE lookup.
 *
 * Contract (data-model.md §"Entity: ProductBarcode" invariants + §A2 DDL):
 *   • one active match            → { kind: 'one', product }
 *   • zero matches (populated)    → { kind: 'not_found' }   (distinct from unavailable)
 *   • >1 DISTINCT active product  → { kind: 'ambiguous' }   (FR-7; COUNT(DISTINCT product_id))
 *   • inactive product            → excluded (not-found-for-selling, FR-18)
 *   • tenant-scoped               → a tenant-A barcode never resolves for a tenant-B session (P17)
 *
 * The repo folds the raw barcode with the SAME `normalize()` the sourcing
 * feature used for `barcode_norm` (FR-12b), so matching is normalization-
 * insensitive on both sides. The product surface carries the matched barcode
 * (`selling_barcode`) for confirm-panel display.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';

describe('T022 — product-repo exact barcode lookup', () => {
  it('returns the single active product for an exact barcode match', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', price_minor: 1500 });
    seedBarcode(db, { barcode_id: 'bc-1', product_id: 'p-1', barcode: '6221000000001' });
    const repo = createProductRepo(handleFor(db));

    const r = repo.lookupByBarcode(TENANT, '6221000000001');

    expect(r.kind).toBe('one');
    if (r.kind === 'one') {
      expect(r.product.product_id).toBe('p-1');
      expect(r.product.price_minor).toBe(1500);
      expect(r.product.active).toBe(true);
      expect(r.product.selling_barcode).toBe('6221000000001');
    }
    db.close();
  });

  it('returns not_found for an unknown barcode against a populated catalogue', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1' });
    seedBarcode(db, { product_id: 'p-1', barcode: '6221000000001' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '0000000000000').kind).toBe('not_found');
    db.close();
  });

  it('treats one barcode mapping to TWO distinct active products as ambiguous (FR-7)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-1' });
    seedProduct(db, { product_id: 'p-2', sku: 'SKU-2' });
    seedBarcode(db, { barcode_id: 'bc-1', product_id: 'p-1', barcode: 'DUP123' });
    seedBarcode(db, { barcode_id: 'bc-2', product_id: 'p-2', barcode: 'DUP123' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, 'DUP123').kind).toBe('ambiguous');
    db.close();
  });

  it('is NOT ambiguous when the same barcode maps to one active + one INACTIVE product (FR-18)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-active', sku: 'SKU-A', active: 1 });
    seedProduct(db, { product_id: 'p-dead', sku: 'SKU-D', active: 0 });
    seedBarcode(db, { barcode_id: 'bc-1', product_id: 'p-active', barcode: 'DUP123' });
    seedBarcode(db, { barcode_id: 'bc-2', product_id: 'p-dead', barcode: 'DUP123' });
    const repo = createProductRepo(handleFor(db));

    const r = repo.lookupByBarcode(TENANT, 'DUP123');
    expect(r.kind).toBe('one');
    if (r.kind === 'one') expect(r.product.product_id).toBe('p-active');
    db.close();
  });

  it('treats multiple barcodes for ONE product (pack + unit) as a single match, not ambiguous', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1' });
    seedBarcode(db, { barcode_id: 'bc-unit', product_id: 'p-1', barcode: 'UNIT-1' });
    seedBarcode(db, { barcode_id: 'bc-pack', product_id: 'p-1', barcode: 'PACK-1' });
    const repo = createProductRepo(handleFor(db));

    const r = repo.lookupByBarcode(TENANT, 'PACK-1');
    expect(r.kind).toBe('one');
    if (r.kind === 'one') expect(r.product.product_id).toBe('p-1');
    db.close();
  });

  it('excludes an inactive-only product (not-found-for-selling, FR-18)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-dead', active: 0 });
    seedBarcode(db, { product_id: 'p-dead', barcode: '6221000000001' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('not_found');
    db.close();
  });

  it('never returns a product belonging to another tenant (P17 tenant isolation)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-other', tenant_id: 'tenant-2' });
    seedBarcode(db, { product_id: 'p-other', tenant_id: 'tenant-2', barcode: '6221000000001' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('not_found');
    db.close();
  });

  it('omits display_name_en / unit_pack_label from the snapshot when the row has none', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', name_en: null, unit_pack_label: null });
    seedBarcode(db, { product_id: 'p-1', barcode: '6221000000001' });
    const repo = createProductRepo(handleFor(db));

    const r = repo.lookupByBarcode(TENANT, '6221000000001');
    expect(r.kind).toBe('one');
    if (r.kind === 'one') {
      expect('display_name_en' in r.product).toBe(false);
      expect('unit_pack_label' in r.product).toBe(false);
    }
    db.close();
  });

  it('matches case/whitespace-variant barcodes via normalize() round trip (FR-12b)', () => {
    const db = freshCatalogueDb();
    // Stored barcode_norm is normalize('AB-12'); querying with surrounding
    // whitespace + uppercase must still resolve.
    seedProduct(db, { product_id: 'p-1' });
    seedBarcode(db, { product_id: 'p-1', barcode: 'AB-12' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '  AB-12  ').kind).toBe('one');
    db.close();
  });
});
