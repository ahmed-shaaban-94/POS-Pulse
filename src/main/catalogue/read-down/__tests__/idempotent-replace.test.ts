import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  nn,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createProductRepo } from '../../product-repo.js';
import { createReadDownWriter, type ReadDownWriter } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';
import type { DatabaseHandle } from '../../../db/client.js';

/**
 * 010 T030 (RED) — idempotent, full-replace refresh (US2, SC-3 / FR-13).
 *
 * Re-running with the same snapshot converges to identical state (no duplicate
 * products/barcodes). Re-running with a changed snapshot reflects adds,
 * price-updates and deactivations.
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
    aliases: ['BC-1'],
    price: { amount: '10.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: 'cur-1',
    ...overrides,
  };
}

function countRows(handle: DatabaseHandle, table: string): number {
  const stmt = handle.prepare(`SELECT COUNT(*) AS n FROM ${table}`) as {
    get(): { n: number } | undefined;
  };
  return stmt.get()?.n ?? 0;
}

function setup(): { handle: DatabaseHandle; writer: ReadDownWriter; close: () => void } {
  const db = freshCatalogueDb();
  const handle = handleFor(db);
  const writer = createReadDownWriter({
    db: handle,
    syncStateRepo: createCatalogueSyncStateRepo(handle),
  });
  return {
    handle,
    writer,
    close: () => {
      db.close();
    },
  };
}

function run(writer: ReadDownWriter, rows: SellableCatalogRow[], snap: string) {
  return writer.run({
    tenantId: TENANT,
    branchId: BRANCH,
    sourceSnapshotId: snap,
    now: '2026-06-05T10:00:00.000Z',
    rows,
  });
}

describe('T030 — idempotent full-replace refresh', () => {
  it('re-running the same snapshot converges to identical state (no duplicates)', () => {
    const { handle, writer, close } = setup();

    run(writer, [row()], 'snap-1');
    run(writer, [row()], 'snap-1'); // same snapshot again

    expect(countRows(handle, 'products')).toBe(1);
    expect(countRows(handle, 'product_barcodes')).toBe(1);
    close();
  });

  it('reflects a price update on the next run', () => {
    const { handle, writer, close } = setup();

    run(writer, [row({ price: { amount: '10.00', currency_code: 'EGP' } })], 'snap-1');
    run(writer, [row({ price: { amount: '12.50', currency_code: 'EGP' } })], 'snap-2');

    const p = handle.prepare(`SELECT price_minor FROM products WHERE product_id='p-1'`) as {
      get(): { price_minor: number } | undefined;
    };
    expect(nn(p.get()).price_minor).toBe(1250);
    expect(countRows(handle, 'products')).toBe(1);
    close();
  });

  it('reflects an added product and a removed product (full replace)', () => {
    const { handle, writer, close } = setup();

    run(
      writer,
      [row({ product_id: 'p-1' }), row({ product_id: 'p-2', aliases: ['BC-2'] })],
      'snap-1',
    );
    expect(countRows(handle, 'products')).toBe(2);

    // p-2 dropped from the snapshot; p-3 added.
    run(
      writer,
      [row({ product_id: 'p-1' }), row({ product_id: 'p-3', aliases: ['BC-3'] })],
      'snap-2',
    );

    const repo = createProductRepo(handle);
    expect(countRows(handle, 'products')).toBe(2);
    // p-2 should no longer resolve (removed by the full replace).
    const ids = handle.prepare(`SELECT product_id FROM products ORDER BY product_id`) as {
      all(): { product_id: string }[];
    };
    expect(ids.all().map((r) => r.product_id)).toEqual(['p-1', 'p-3']);
    void repo;
    close();
  });

  it('reflects a deactivation (active flag carried; 009 excludes inactive)', () => {
    const { handle, writer, close } = setup();

    run(writer, [row({ active: true })], 'snap-1');
    const repo = createProductRepo(handle);
    expect(repo.lookupBySku(TENANT, 'SKU-1').kind).toBe('one');

    run(writer, [row({ active: false })], 'snap-2');
    expect(repo.lookupBySku(TENANT, 'SKU-1').kind).toBe('not_found'); // inactive excluded
    close();
  });
});
