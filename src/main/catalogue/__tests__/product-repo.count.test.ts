import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';

/**
 * 010 (freshness wiring) — `productRepo.countByTenant` (FR-16b `is_empty`).
 *
 * The freshness surface needs a tenant-scoped live-product count to compute
 * `is_empty` (a successful-but-EMPTY promote → non-null `last_success_at` + 0
 * products, SC-10). The count MUST be tenant-scoped (P17) and degrade to 0 on a
 * missing/unreadable read model (mirrors the repo's `unavailable`→safe discipline
 * — never throws across the boundary).
 */

beforeAll(async () => {
  await initCatalogueSql();
});

describe('productRepo.countByTenant', () => {
  it('returns 0 on an empty read model', () => {
    const db = freshCatalogueDb();
    const repo = createProductRepo(handleFor(db));
    expect(repo.countByTenant('tenant-1')).toBe(0);
    db.close();
  });

  it('counts only the given tenant rows (P17 scoped)', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', tenant_id: 'tenant-1', sku: 'SKU-1' });
    seedProduct(db, { product_id: 'p-2', tenant_id: 'tenant-1', sku: 'SKU-2' });
    seedProduct(db, { product_id: 'p-3', tenant_id: 'tenant-OTHER', sku: 'SKU-3' });
    const repo = createProductRepo(handleFor(db));
    expect(repo.countByTenant('tenant-1')).toBe(2);
    expect(repo.countByTenant('tenant-OTHER')).toBe(1);
    expect(repo.countByTenant('tenant-NONE')).toBe(0);
    db.close();
  });
});
