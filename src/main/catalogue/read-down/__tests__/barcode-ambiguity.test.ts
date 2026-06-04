import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  nn,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createProductRepo } from '../../product-repo.js';
import { createReadDownWriter } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';

/**
 * 010 T031a (RED) — barcode-ambiguity preservation (US2, FR-4).
 *
 * A snapshot with two ACTIVE products sharing barcode B → post-promote
 * `product_barcodes` has BOTH rows → 009's `lookupByBarcode` returns `ambiguous`.
 * The read-down MUST NOT dedupe/collapse the conflict (preserving the ambiguity
 * block is the whole point — FR-7 never silently picks one).
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
    aliases: ['SHARED-BC'],
    price: { amount: '10.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: 'cur-1',
    ...overrides,
  };
}

describe('T031a — barcode ambiguity preserved (no dedupe)', () => {
  it('keeps both rows when two active products share a barcode → ambiguous', () => {
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
        row({ product_id: 'p-1', sku: 'SKU-1', aliases: ['SHARED-BC'] }),
        row({ product_id: 'p-2', sku: 'SKU-2', aliases: ['SHARED-BC'] }),
      ],
    });

    // Both barcode rows present (no dedupe across distinct products).
    const cnt = handle.prepare(
      `SELECT COUNT(*) AS n FROM product_barcodes WHERE barcode='SHARED-BC'`,
    ) as { get(): { n: number } | undefined };
    expect(nn(cnt.get()).n).toBe(2);

    // 009 reports the ambiguity block — never picks one.
    const repo = createProductRepo(handle);
    expect(repo.lookupByBarcode(TENANT, 'SHARED-BC').kind).toBe('ambiguous');
    db.close();
  });

  it('preserves the pack+unit duplicate barcode for ONE product (still resolves to one)', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const writer = createReadDownWriter({
      db: handle,
      syncStateRepo: createCatalogueSyncStateRepo(handle),
    });

    // One product, same code appears twice in the bag (pack + unit).
    writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [row({ product_id: 'p-1', aliases: ['DUP-BC', 'DUP-BC'] })],
    });

    const cnt = handle.prepare(
      `SELECT COUNT(*) AS n FROM product_barcodes WHERE barcode='DUP-BC'`,
    ) as { get(): { n: number } | undefined };
    expect(nn(cnt.get()).n).toBe(2); // preserved, not deduped

    // One distinct product → resolves to one (DISTINCT product_id collapses).
    const repo = createProductRepo(handle);
    expect(repo.lookupByBarcode(TENANT, 'DUP-BC').kind).toBe('one');
    db.close();
  });
});
