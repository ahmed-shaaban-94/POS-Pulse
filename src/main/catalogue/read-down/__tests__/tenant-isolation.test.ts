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
 * 010 T026 (RED) — tenant isolation (US1, SC-6 / P17).
 *
 * The writer stages/promotes for the injected terminal tenant ONLY. A snapshot
 * carrying a foreign-tenant row never reaches the live tables. The source rows
 * carry no tenant of their own — scope is the injected device-principal
 * `(tenant_id, branch_id)`. A run with NO resolvable store scope is rejected.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function row(
  overrides: Partial<SellableCatalogRow & { source_tenant_id: string }> = {},
): SellableCatalogRow {
  const { source_tenant_id, ...rest } = overrides;
  void source_tenant_id;
  return {
    product_id: 'p-1',
    sku: 'SKU-1',
    name: 'Aspirin',
    aliases: ['BC-1'],
    price: { amount: '10.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: 'cur-1',
    ...rest,
  };
}

function countRows(handle: DatabaseHandle, table: string): number {
  const stmt = handle.prepare(`SELECT COUNT(*) AS n FROM ${table}`) as {
    get(): { n: number } | undefined;
  };
  return stmt.get()?.n ?? 0;
}

describe('T026 — tenant isolation', () => {
  it('promoted rows are stamped with the injected tenant only (never the source tenant)', () => {
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

    // Every promoted row carries the injected tenant.
    const foreign = handle.prepare(`SELECT COUNT(*) AS n FROM products WHERE tenant_id != ?`) as {
      get(t: string): { n: number } | undefined;
    };
    expect(nn(foreign.get(TENANT)).n).toBe(0);

    // A foreign-tenant query resolves nothing (009 is tenant-scoped, P17).
    const repo = createProductRepo(handle);
    expect(repo.lookupBySku('tenant-2', 'SKU-1').kind).toBe('not_found');
    db.close();
  });

  it('does not disturb another tenant’s catalogue when present', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);

    // Seed tenant-2 directly into the live table (simulating its own read-down).
    handle.exec(`
      INSERT INTO products
        (product_id, tenant_id, branch_id, sku, sku_norm, name_ar, name_fold,
         price_minor, tax_category, active, controlled_substance, prescription_required,
         row_version, created_at, updated_at)
      VALUES ('p-t2','tenant-2','b2','SKU-T2','sku-t2','Other','other',
              500,'standard',1,0,0,'v1','x','x')
    `);

    // tenant-1 read-down must leave tenant-2's row alone (promote is tenant-scoped).
    createReadDownWriter({ db: handle, syncStateRepo }).run({
      tenantId: TENANT,
      branchId: BRANCH,
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [row({ product_id: 'p-1', sku: 'SKU-1' })],
    });

    expect(countRows(handle, 'products')).toBe(2); // tenant-2 row preserved + tenant-1 row added
    const t2 = handle.prepare(`SELECT COUNT(*) AS n FROM products WHERE tenant_id='tenant-2'`) as {
      get(): { n: number } | undefined;
    };
    expect(nn(t2.get()).n).toBe(1);
    db.close();
  });

  it('rejects a run with no resolvable store scope (branchId missing)', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const writer = createReadDownWriter({
      db: handle,
      syncStateRepo: createCatalogueSyncStateRepo(handle),
    });

    const result = writer.run({
      tenantId: TENANT,
      branchId: '', // unresolved store scope — NOT NULL staging forbids this
      sourceSnapshotId: 'snap-1',
      now: '2026-06-05T10:00:00.000Z',
      rows: [row()],
    });

    expect(result.outcome).toBe('failed');
    expect(countRows(handle, 'products')).toBe(0); // nothing promoted
    db.close();
  });
});
