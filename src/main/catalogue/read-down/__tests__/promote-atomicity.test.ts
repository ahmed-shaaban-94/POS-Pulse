import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  nn,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createReadDownWriter } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';
import type { DatabaseHandle } from '../../../db/client.js';

/**
 * 010 T031 (RED) — promote atomicity / rollback-on-throw (US2, SC-4 / FR-6).
 *
 * A throw INSIDE the promote tx rolls the whole thing back: the live tables are
 * unchanged and `last_success_at` is not advanced — 009 never sees staging rows.
 * We force the throw by injecting a `syncStateRepo.recordSuccess` that throws
 * (it is called inside the promote tx).
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

describe('T031 — promote atomicity (rollback on throw)', () => {
  it('a throw inside the promote tx leaves the prior catalogue intact', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const realRepo = createCatalogueSyncStateRepo(handle);

    // First, a clean promote seeds a working catalogue.
    createReadDownWriter({ db: handle, syncStateRepo: realRepo }).run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [row({ product_id: 'p-1', sku: 'SKU-1' })],
    });
    expect(countRows(handle, 'products')).toBe(1);

    // Now a writer whose recordSuccess throws mid-promote.
    const throwingRepo = {
      ...realRepo,
      recordSuccess: () => {
        throw new Error('boom inside promote tx');
      },
    };
    const writer = createReadDownWriter({ db: handle, syncStateRepo: throwingRepo });

    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-2',
      now: '2026-06-05T11:00:00.000Z',
      rows: [row({ product_id: 'p-NEW', sku: 'SKU-NEW' })],
    });

    // The run failed (db error), but the prior catalogue is 100% intact.
    expect(result.outcome).toBe('failed');
    expect(countRows(handle, 'products')).toBe(1);
    const p = handle.prepare(`SELECT product_id FROM products`) as {
      get(): { product_id: string } | undefined;
    };
    expect(nn(p.get()).product_id).toBe('p-1'); // original product, NOT p-NEW

    // last_success_at unchanged (the failed promote rolled back its sync-state write).
    expect(nn(realRepo.read(TENANT)).last_success_at).toBe('2026-06-05T10:00:00.000Z');

    db.close();
  });

  it('staging holds no leaked rows after a rolled-back promote', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const realRepo = createCatalogueSyncStateRepo(handle);
    const throwingRepo = {
      ...realRepo,
      recordSuccess: () => {
        throw new Error('boom');
      },
    };
    const writer = createReadDownWriter({ db: handle, syncStateRepo: throwingRepo });

    writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [row()],
    });

    // Staging is cleared at the start of the next run regardless; assert the
    // failed run did not leave its staged rows visible to a subsequent reader.
    // (Promote rolled back; staging clear happens outside the tx at run start.)
    expect(countRows(handle, 'products')).toBe(0);
    db.close();
  });
});
