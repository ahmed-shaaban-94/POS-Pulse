import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  nn,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createProductRepo } from '../../product-repo.js';
import { createReadDownWriter, ABORT_THRESHOLD_REJECTED_FRACTION } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';
import type { DatabaseHandle } from '../../../db/client.js';

/**
 * 010 T033 (RED) — failure preservation (US2, SC-5 / FR-7).
 *
 * An over-threshold rejection → no promote; the prior catalogue stays 100%
 * usable; `last_success_at` is unchanged; the failure is recorded for diagnostics.
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

/** A row that fails validation (empty name post-mapping). */
function bad(id: string): SellableCatalogRow {
  return { ...good(id), name: '' };
}

function countRows(handle: DatabaseHandle, table: string): number {
  const stmt = handle.prepare(`SELECT COUNT(*) AS n FROM ${table}`) as {
    get(): { n: number } | undefined;
  };
  return stmt.get()?.n ?? 0;
}

describe('T033 — failure preservation (over-threshold rejection)', () => {
  it('an over-threshold malformed run does NOT promote and preserves the prior catalogue', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });

    // Seed a working catalogue first.
    writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [good('p-1')],
    });
    expect(countRows(handle, 'products')).toBe(1);

    // Now a snapshot that is mostly malformed (> threshold rejected).
    const result = writer.run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-2',
      now: '2026-06-05T11:00:00.000Z',
      rows: [bad('a'), bad('b'), bad('c'), good('d')], // 75% rejected
    });

    expect(result.outcome).toBe('failed');
    expect(result.failureCategory).toBe('threshold-exceeded');
    // Prior catalogue intact — original product still resolves.
    const repo = createProductRepo(handle);
    expect(repo.lookupBySku(TENANT, 'SKU-p-1').kind).toBe('one');
    expect(countRows(handle, 'products')).toBe(1);

    // last_success_at unchanged; failure recorded.
    const state = nn(syncStateRepo.read(TENANT));
    expect(state.last_success_at).toBe('2026-06-05T10:00:00.000Z');
    expect(state.last_outcome).toBe('failed');
    db.close();
  });

  it('the abort-threshold is a configurable constant carrying a placeholder', () => {
    // Documents that the value is intentionally provisional (FR-9 / R-RISK-4,
    // owner decision pending). The mechanism is implemented; the value is not final.
    expect(typeof ABORT_THRESHOLD_REJECTED_FRACTION).toBe('number');
    expect(ABORT_THRESHOLD_REJECTED_FRACTION).toBeGreaterThan(0);
    expect(ABORT_THRESHOLD_REJECTED_FRACTION).toBeLessThanOrEqual(1);
  });
});
