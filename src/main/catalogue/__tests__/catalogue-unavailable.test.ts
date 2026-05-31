import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedBarcode,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';
import type { DatabaseHandle } from '../../db/client.js';

/**
 * 009 T026 (RED) — catalogue-unavailable detection (SC-10 matrix).
 *
 * The read model being EMPTY, MISSING, or UNREADABLE all collapse to ONE
 * generic `unavailable` signal (FR-24) — and it is **DISTINCT from
 * `not_found`** (a populated, readable catalogue with no matching row). The
 * repo owns this detection because it owns the DB handle; the bridge maps the
 * repo's `unavailable` to `{ kind: 'catalogue_unavailable' }`.
 *
 * Staleness is NOT surfaced (FR-24a) — there is no "stale" state, only
 * available / unavailable.
 *
 *   • EMPTY      — migrations applied, zero product rows → unavailable
 *   • MISSING    — `products` table absent (no such table) → unavailable
 *   • UNREADABLE — the handle throws on query → unavailable
 *   • POPULATED + no match → not_found (the control — proves the distinction)
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';

describe('T026 — catalogue-unavailable detection (distinct from not_found)', () => {
  it('returns unavailable when the read model is EMPTY (ships empty, FR-24)', () => {
    const db = freshCatalogueDb(); // migrations applied, zero rows
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('unavailable');
    expect(repo.lookupBySku(TENANT, 'SKU-X').kind).toBe('unavailable');
    db.close();
  });

  it('returns unavailable when the products table is MISSING (no such table)', () => {
    const db = freshCatalogueDb();
    db.run('DROP TABLE product_barcodes');
    db.run('DROP TABLE products');
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('unavailable');
    expect(repo.lookupBySku(TENANT, 'SKU-X').kind).toBe('unavailable');
    db.close();
  });

  it('returns unavailable when the handle is UNREADABLE (query throws)', () => {
    const throwing: DatabaseHandle = {
      pragma: () => null,
      prepare: () => {
        throw new Error('disk I/O error');
      },
      exec: () => undefined,
      transaction: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
      close: () => undefined,
    };
    const repo = createProductRepo(throwing);

    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('unavailable');
    expect(repo.lookupBySku(TENANT, 'SKU-X').kind).toBe('unavailable');
  });

  it('returns NOT_FOUND (not unavailable) when the catalogue is populated but has no match', () => {
    const db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', sku: 'SKU-REAL' });
    seedBarcode(db, { product_id: 'p-1', barcode: '6221000000001' });
    const repo = createProductRepo(handleFor(db));

    expect(repo.lookupByBarcode(TENANT, '0000000000000').kind).toBe('not_found');
    expect(repo.lookupBySku(TENANT, 'SKU-MISSING').kind).toBe('not_found');
    db.close();
  });
});
