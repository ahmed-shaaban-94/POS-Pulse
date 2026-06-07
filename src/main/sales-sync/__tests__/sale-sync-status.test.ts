/**
 * 011 T050 (RED) — sale-sync status reader (the read-only surface source).
 *
 * `readSyncStatus(scope)` returns the tenant-scoped counts the renderer shows:
 *   • pending      — sales not yet synced (state pending OR no state row yet)
 *   • deadLetter   — sales in dead_letter
 *   • lastSuccessAt — the most recent synced_at, or null if none ever synced
 * No secrets, no token, no PII — counts + one timestamp only (P7).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshSalesSyncDb,
  handleFor,
  initSalesSyncSql,
  seedOutbox,
  seedSale,
} from './__helpers__/sales-sync-fixture.js';
import { createSaleSyncStateRepo } from '../sale-sync-state-repo.js';

beforeAll(async () => {
  await initSalesSyncSql();
});

const SCOPE = { tenantId: 'tenant-1', branchId: 'branch-1' };

describe('T050 — readSyncStatus', () => {
  it('reports zero/null on an empty terminal', () => {
    const db = freshSalesSyncDb();
    const repo = createSaleSyncStateRepo(handleFor(db));
    expect(repo.readSyncStatus(SCOPE)).toEqual({ pending: 0, deadLetter: 0, lastSuccessAt: null });
    db.close();
  });

  it('counts a freshly-enqueued (no state row) sale as pending', () => {
    const db = freshSalesSyncDb();
    seedSale(db, { sale_id: 'sale-1' });
    seedOutbox(db, { sale_id: 'sale-1' });
    const repo = createSaleSyncStateRepo(handleFor(db));
    expect(repo.readSyncStatus(SCOPE).pending).toBe(1);
    db.close();
  });

  it('reports the most recent synced_at as lastSuccessAt', () => {
    const db = freshSalesSyncDb();
    seedSale(db, { sale_id: 'sale-1' });
    seedSale(db, { sale_id: 'sale-2' });
    const repo = createSaleSyncStateRepo(handleFor(db));
    repo.markSynced({ saleId: 'sale-1', ...SCOPE, now: '2026-06-07T10:00:00.000Z' });
    repo.markSynced({ saleId: 'sale-2', ...SCOPE, now: '2026-06-07T11:00:00.000Z' });
    const status = repo.readSyncStatus(SCOPE);
    expect(status.lastSuccessAt).toBe('2026-06-07T11:00:00.000Z');
    expect(status.pending).toBe(0);
    db.close();
  });

  it('counts dead_letter sales', () => {
    const db = freshSalesSyncDb();
    seedSale(db, { sale_id: 'sale-1' });
    const repo = createSaleSyncStateRepo(handleFor(db));
    repo.markDeadLetter({ saleId: 'sale-1', ...SCOPE, now: '2026-06-07T10:00:00.000Z' });
    expect(repo.readSyncStatus(SCOPE).deadLetter).toBe(1);
    db.close();
  });

  it('is tenant-scoped: tenant-B counts exclude tenant-A rows', () => {
    const db = freshSalesSyncDb();
    seedSale(db, { sale_id: 'sale-1', tenant_id: 'tenant-1' });
    seedOutbox(db, { sale_id: 'sale-1', tenant_id: 'tenant-1' });
    const repo = createSaleSyncStateRepo(handleFor(db));
    expect(repo.readSyncStatus({ tenantId: 'tenant-2', branchId: 'branch-9' }).pending).toBe(0);
    db.close();
  });
});
