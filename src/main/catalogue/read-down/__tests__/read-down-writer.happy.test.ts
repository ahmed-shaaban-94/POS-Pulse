import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  nn,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createProductRepo } from '../../product-repo.js';
import { normalize } from '../../normalize.js';
import { createReadDownWriter } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';
import type { DatabaseHandle } from '../../../db/client.js';

/**
 * 010 T023 (RED) — read-down writer happy path (US1, SC-1).
 *
 * A validated snapshot → staging populated (fold columns via `normalize()`) →
 * promote → live `products`/`product_barcodes` hold the set; `last_success_at`
 * is set INSIDE the promote tx.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function row(overrides: Partial<SellableCatalogRow> = {}): SellableCatalogRow {
  return {
    product_id: 'p-1',
    sku: 'SKU-PARA-500',
    name: 'بنادول إكسترا',
    aliases: ['6221000000001'],
    price: { amount: '15.00', currency_code: 'EGP' },
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

describe('T023 — read-down writer happy path', () => {
  it('promotes a validated snapshot into the live read model and sets freshness', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });

    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [row()],
    });

    expect(result.outcome).toBe('succeeded');
    expect(result.productsWritten).toBe(1);
    expect(result.recordsRejected).toBe(0);

    // Live tables hold the set.
    expect(countRows(handle, 'products')).toBe(1);
    expect(countRows(handle, 'product_barcodes')).toBe(1);

    // 009's repo resolves the product (lookup by sku + barcode).
    const repo = createProductRepo(handle);
    expect(repo.lookupBySku(TENANT, 'SKU-PARA-500').kind).toBe('one');
    expect(repo.lookupByBarcode(TENANT, '6221000000001').kind).toBe('one');

    // Freshness was written inside the promote tx.
    const state = nn(syncStateRepo.read(TENANT));
    expect(state.last_success_at).toBe('2026-06-05T10:00:00.000Z');
    expect(state.source_snapshot_id).toBe('snap-1');
    expect(state.last_outcome).toBe('succeeded');

    db.close();
  });

  it('stamps tenant_id and branch_id from the injected scope onto promoted rows', () => {
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
      rows: [row()],
    });

    const p = handle.prepare(
      `SELECT tenant_id, branch_id, name_ar, name_en, name_fold, sku_norm, aliases_json, alias_fold FROM products WHERE product_id='p-1'`,
    ) as { get(): Record<string, unknown> | undefined };
    const stored = nn(p.get());
    expect(stored.tenant_id).toBe(TENANT);
    expect(stored.branch_id).toBe(BRANCH);
    // D-NAME: name_ar := name, name_en := null.
    expect(stored.name_ar).toBe('بنادول إكسترا');
    expect(stored.name_en).toBeNull();
    // R1 fold composition: name_fold = normalize(name_ar + ' ' + '') = normalize(name_ar).
    expect(stored.name_fold).toBe(normalize('بنادول إكسترا'));
    expect(stored.sku_norm).toBe(normalize('SKU-PARA-500'));

    db.close();
  });

  it('clears staging after a successful promote (staging never leaks)', () => {
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
      rows: [row()],
    });

    expect(countRows(handle, 'products_staging')).toBe(0);
    expect(countRows(handle, 'product_barcodes_staging')).toBe(0);

    db.close();
  });
});
