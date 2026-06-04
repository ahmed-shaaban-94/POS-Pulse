import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createProductRepo } from '../../product-repo.js';
import { createReadDownWriter } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';

/**
 * 010 T025 (RED) — offline after first success (US1, SC-2).
 *
 * After one promote, 009's lookups/search resolve purely from local data with
 * ZERO further work — the writer touches no network and the read path is the
 * local SQLite read model. (There is no network in this slice; the assertion is
 * that reads are satisfied entirely from the promoted local rows.)
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function row(overrides: Partial<SellableCatalogRow> = {}): SellableCatalogRow {
  return {
    product_id: 'p-1',
    sku: 'SKU-1',
    name: 'Aspirin',
    aliases: ['6221000000001'],
    price: { amount: '10.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: 'cur-1',
    ...overrides,
  };
}

describe('T025 — offline after success', () => {
  it('009 resolves products from local data after a single promote', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const writer = createReadDownWriter({
      db: handle,
      syncStateRepo: createCatalogueSyncStateRepo(handle),
    });

    writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [
        row({ product_id: 'p-1', sku: 'SKU-1' }),
        row({ product_id: 'p-2', sku: 'SKU-2', aliases: ['BC-2'] }),
      ],
    });

    // No further read-down. Reads are satisfied from the local read model.
    const repo = createProductRepo(handle);
    expect(repo.lookupBySku(TENANT, 'SKU-1').kind).toBe('one');
    expect(repo.lookupBySku(TENANT, 'SKU-2').kind).toBe('one');
    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('one');
    expect(repo.search(TENANT, 'aspirin').kind).toBe('results');
    db.close();
  });
});
