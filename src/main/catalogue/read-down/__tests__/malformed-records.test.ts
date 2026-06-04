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
import type { DatabaseHandle } from '../../../db/client.js';

/**
 * 010 T034 (RED) — skip-and-log + threshold (US2, SC-11 / FR-9).
 *
 * Below-threshold invalid records are skipped + counted; the valid set promotes.
 * Above-threshold → the run fails and the prior catalogue is preserved.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function good(id: string): SellableCatalogRow {
  return {
    product_id: id,
    sku: `SKU-${id}`,
    name: `Name ${id}`,
    aliases: [],
    price: { amount: '10.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: 'cur-1',
  };
}

/** Money rejection (too many fractional digits → mapping rejects). */
function badMoney(id: string): SellableCatalogRow {
  return { ...good(id), price: { amount: '9.999', currency_code: 'EGP' } };
}

/** Validation rejection (empty name post-mapping). */
function badName(id: string): SellableCatalogRow {
  return { ...good(id), name: '' };
}

function countRows(handle: DatabaseHandle, table: string): number {
  const stmt = handle.prepare(`SELECT COUNT(*) AS n FROM ${table}`) as {
    get(): { n: number } | undefined;
  };
  return stmt.get()?.n ?? 0;
}

describe('T034 — skip-and-log + threshold', () => {
  it('skips one bad record (below threshold) and promotes the valid set', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });

    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [good('p-1'), good('p-2'), good('p-3'), badName('p-bad')], // 1/4 rejected
    });

    expect(result.outcome).toBe('skipped_with_rejections');
    expect(result.productsWritten).toBe(3);
    expect(result.recordsRejected).toBe(1);
    expect(countRows(handle, 'products')).toBe(3);

    const repo = createProductRepo(handle);
    expect(repo.lookupBySku(TENANT, 'SKU-p-1').kind).toBe('one');
    expect(repo.lookupBySku(TENANT, 'SKU-p-bad').kind).toBe('not_found');

    // Skipped-with-rejections still advances the success clock (the valid set
    // promoted) AND the PERSISTED outcome reflects the skip (FR-9 / FR-16) — not
    // a bare 'succeeded' that hides the dropped rows.
    const state = nn(syncStateRepo.read(TENANT));
    expect(state.last_success_at).toBe('2026-06-05T10:00:00.000Z');
    expect(state.last_outcome).toBe('skipped_with_rejections');
    db.close();
  });

  it('counts BOTH mapping rejections and validation rejections uniformly', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const writer = createReadDownWriter({
      db: handle,
      syncStateRepo: createCatalogueSyncStateRepo(handle),
    });

    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [good('p-1'), good('p-2'), good('p-3'), badMoney('p-m')], // 1/4 rejected (money)
    });

    expect(result.recordsRejected).toBe(1);
    expect(result.productsWritten).toBe(3);
    db.close();
  });

  it('a fully-valid snapshot promotes with outcome=succeeded', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const writer = createReadDownWriter({
      db: handle,
      syncStateRepo: createCatalogueSyncStateRepo(handle),
    });

    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [good('p-1'), good('p-2')],
    });

    expect(result.outcome).toBe('succeeded');
    expect(result.recordsRejected).toBe(0);
    db.close();
  });

  it('an empty snapshot is a successful EMPTY promote (truthful, not a failure)', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });

    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [],
    });

    expect(result.outcome).toBe('succeeded');
    expect(result.productsWritten).toBe(0);
    expect(countRows(handle, 'products')).toBe(0);
    // A successful empty promote DOES set last_success_at (FR-16b truthfulness).
    expect(nn(syncStateRepo.read(TENANT)).last_success_at).toBe('2026-06-05T10:00:00.000Z');
    db.close();
  });
});
