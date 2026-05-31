import { beforeAll, describe, expect, it } from 'vitest';

import { createCatalogueBridge } from '../catalogue-bridge.js';
import { createProductRepo } from '../product-repo.js';
import type { OperatorSessionForCatalogue } from '../require-catalogue-session.js';
import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedBarcode,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import type { Database as SqlJsDatabase } from 'sql.js';

/**
 * 009 T025 — `catalogue.lookupBarcode` / `catalogue.lookupSku` handlers wired
 * to the read repo.
 *
 * The handler: gate first (NFR-6a) → pass the session's `tenant_id` to the
 * tenant-scoped repo → map the repo result to the bridge response. The handler
 * is what folds nothing extra: the repo folds the raw query via `normalize()`.
 * The repo's `unavailable` becomes `{ kind: 'catalogue_unavailable' }` — DISTINCT
 * from `not_found`. Tenant scoping is enforced by the session tenant flowing
 * into the repo's `WHERE tenant_id = ?` (P17), so a tenant-A session never sees
 * a tenant-B product.
 */

const SESSION: OperatorSessionForCatalogue = {
  role: 'cashier',
  operator_id: 'op-1',
  operator_session_id: 'sess-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
};

beforeAll(async () => {
  await initCatalogueSql();
});

function bridgeFor(db: SqlJsDatabase, session: OperatorSessionForCatalogue | null = SESSION) {
  return createCatalogueBridge({
    getCurrentSession: () => session,
    productRepo: createProductRepo(handleFor(db)),
  });
}

describe('T025 — catalogue.lookupBarcode wired to the repo', () => {
  it('returns one with the product snapshot for an exact active match', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', name_ar: 'بنادول', price_minor: 1500 });
    seedBarcode(db, { product_id: 'p-1', barcode: '6221000000001' });

    const r = await bridgeFor(db).lookupBarcode({ barcode: '6221000000001' });

    expect(r.kind).toBe('one');
    if (r.kind === 'one') {
      expect(r.product.product_id).toBe('p-1');
      expect(r.product.display_name_ar).toBe('بنادول');
      expect(r.product.price_minor).toBe(1500);
    }
    db.close();
  });

  it('folds the raw barcode (whitespace/case) via normalize() round trip', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1' });
    seedBarcode(db, { product_id: 'p-1', barcode: 'AB-12' });

    expect((await bridgeFor(db).lookupBarcode({ barcode: '  ab-12 ' })).kind).toBe('one');
    db.close();
  });

  it('returns not_found for an unknown barcode against a populated catalogue', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1' });
    seedBarcode(db, { product_id: 'p-1', barcode: '6221000000001' });

    expect((await bridgeFor(db).lookupBarcode({ barcode: '0000' })).kind).toBe('not_found');
    db.close();
  });

  it('returns ambiguous when one barcode maps to two distinct active products', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'S1' });
    seedProduct(db, { product_id: 'p-2', sku: 'S2' });
    seedBarcode(db, { barcode_id: 'b1', product_id: 'p-1', barcode: 'DUP' });
    seedBarcode(db, { barcode_id: 'b2', product_id: 'p-2', barcode: 'DUP' });

    expect((await bridgeFor(db).lookupBarcode({ barcode: 'DUP' })).kind).toBe('ambiguous');
    db.close();
  });

  it('returns catalogue_unavailable for an empty read model (distinct from not_found)', async () => {
    const db = freshCatalogueDb(); // empty

    expect((await bridgeFor(db).lookupBarcode({ barcode: '6221000000001' })).kind).toBe(
      'catalogue_unavailable',
    );
    db.close();
  });

  it('never returns a tenant-B product to a tenant-A session (P17)', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-2', tenant_id: 'tenant-2' });
    seedBarcode(db, { product_id: 'p-2', tenant_id: 'tenant-2', barcode: '6221000000001' });

    // Session is tenant-1; the only product is tenant-2 → not its catalogue row,
    // but the catalogue is non-empty globally, so this is not_found, not unavailable.
    expect((await bridgeFor(db).lookupBarcode({ barcode: '6221000000001' })).kind).toBe(
      'not_found',
    );
    db.close();
  });

  it('still refuses no_session before touching the repo', async () => {
    const db = freshCatalogueDb();
    seedProduct(db);
    seedBarcode(db);

    await expect(bridgeFor(db, null).lookupBarcode({ barcode: '6221000000001' })).resolves.toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
    db.close();
  });
});

describe('T025 — catalogue.lookupSku wired to the repo', () => {
  it('returns one for an exact active SKU match', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-PARA-500', price_minor: 1500 });

    const r = await bridgeFor(db).lookupSku({ sku: 'SKU-PARA-500' });
    expect(r.kind).toBe('one');
    if (r.kind === 'one') expect(r.product.sku).toBe('SKU-PARA-500');
    db.close();
  });

  it('folds a case-variant SKU via normalize() round trip', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-PARA-500' });

    expect((await bridgeFor(db).lookupSku({ sku: 'sku-para-500' })).kind).toBe('one');
    db.close();
  });

  it('returns not_found for an unknown SKU', async () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-PARA-500' });

    expect((await bridgeFor(db).lookupSku({ sku: 'NOPE' })).kind).toBe('not_found');
    db.close();
  });

  it('returns catalogue_unavailable for an empty read model', async () => {
    const db = freshCatalogueDb();
    expect((await bridgeFor(db).lookupSku({ sku: 'SKU-X' })).kind).toBe('catalogue_unavailable');
    db.close();
  });
});
