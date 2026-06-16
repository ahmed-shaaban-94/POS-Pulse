import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
  seedBarcode,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';

/**
 * 010 diagnostics — `productRepo.countBarcodesByTenant`.
 *
 * The diagnostics counts panel needs a tenant-scoped product_barcodes (alias)
 * count alongside the product count. Same discipline as `countByTenant`:
 * tenant-scoped (P17), degrades to 0 on a missing/unreadable read model, never
 * throws across the boundary.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

describe('productRepo.countBarcodesByTenant', () => {
  it('returns 0 on an empty read model', () => {
    const db = freshCatalogueDb();
    const repo = createProductRepo(handleFor(db));
    expect(repo.countBarcodesByTenant('tenant-1')).toBe(0);
    db.close();
  });

  it('counts only the given tenant barcode rows (P17 scoped)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', tenant_id: 'tenant-1', sku: 'SKU-1' });
    seedProduct(db, { product_id: 'p-2', tenant_id: 'tenant-OTHER', sku: 'SKU-2' });
    seedBarcode(db, {
      barcode_id: 'bc-1',
      product_id: 'p-1',
      tenant_id: 'tenant-1',
      barcode: '6223000000001',
    });
    seedBarcode(db, {
      barcode_id: 'bc-2',
      product_id: 'p-1',
      tenant_id: 'tenant-1',
      barcode: '6223000000002',
    });
    seedBarcode(db, {
      barcode_id: 'bc-3',
      product_id: 'p-2',
      tenant_id: 'tenant-OTHER',
      barcode: '6223000000003',
    });
    const repo = createProductRepo(handleFor(db));
    expect(repo.countBarcodesByTenant('tenant-1')).toBe(2);
    expect(repo.countBarcodesByTenant('tenant-OTHER')).toBe(1);
    expect(repo.countBarcodesByTenant('tenant-NONE')).toBe(0);
    db.close();
  });
});
