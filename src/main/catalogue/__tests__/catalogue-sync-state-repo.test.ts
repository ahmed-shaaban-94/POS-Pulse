import { beforeAll, describe, expect, it } from 'vitest';

import { freshCatalogueDb, handleFor, initCatalogueSql } from './__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../catalogue-sync-state-repo.js';

/**
 * 010 T014 (RED) — `catalogue-sync-state-repo`.
 *
 * Contract (data-model.md §"Entity: CatalogueSyncState" / §A2 review §5):
 *   • `read(tenant)` → null before the first write; the stored row afterwards.
 *   • `recordSuccess(...)` sets `last_success_at` + `source_snapshot_id` +
 *     `last_outcome='succeeded'`; callable INSIDE the promote tx (no internal tx).
 *   • `recordAttempt(...)` sets `last_attempt_at` + `last_outcome` and MUST NOT
 *     touch `last_success_at` (so a failed run never advances freshness — SC-10).
 *   • tenant-scoped: a write for tenant A never leaks into tenant B's row.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const T = 'tenant-1';
const B = 'branch-1';

/** Narrow a possibly-null read to a row (fails the test if null) — no `!` needed. */
function assertRow<R>(row: R | null): R {
  if (row === null) throw new Error('expected a sync-state row, got null');
  return row;
}

describe('T014 — catalogue-sync-state-repo', () => {
  it('read returns null before the first write', () => {
    const db = freshCatalogueDb();
    const repo = createCatalogueSyncStateRepo(handleFor(db));
    expect(repo.read(T)).toBeNull();
    db.close();
  });

  it('recordSuccess sets last_success_at, source_snapshot_id and outcome=succeeded', () => {
    const db = freshCatalogueDb();
    const repo = createCatalogueSyncStateRepo(handleFor(db));

    repo.recordSuccess({
      tenantId: T,
      branchId: B,
      lastSuccessAt: '2026-06-05T10:00:00.000Z',
      sourceSnapshotId: 'snap-1',
    });

    const row = assertRow(repo.read(T));
    expect(row.last_success_at).toBe('2026-06-05T10:00:00.000Z');
    expect(row.source_snapshot_id).toBe('snap-1');
    expect(row.last_outcome).toBe('succeeded');
    db.close();
  });

  it('recordSuccess is callable inside a promote transaction (no nested tx)', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const repo = createCatalogueSyncStateRepo(handle);

    // Simulate the promote: open a tx, call recordSuccess inside it, commit.
    expect(() => {
      const tx = handle.transaction(() => {
        repo.recordSuccess({
          tenantId: T,
          branchId: B,
          lastSuccessAt: '2026-06-05T10:00:00.000Z',
          sourceSnapshotId: 'snap-1',
        });
      });
      tx();
    }).not.toThrow();

    expect(assertRow(repo.read(T)).last_success_at).toBe('2026-06-05T10:00:00.000Z');
    db.close();
  });

  it('recordAttempt records last_attempt_at + outcome WITHOUT touching last_success_at', () => {
    const db = freshCatalogueDb();
    const repo = createCatalogueSyncStateRepo(handleFor(db));

    // First a success, then a failed attempt — last_success_at must NOT regress.
    repo.recordSuccess({
      tenantId: T,
      branchId: B,
      lastSuccessAt: '2026-06-05T10:00:00.000Z',
      sourceSnapshotId: 'snap-1',
    });
    repo.recordAttempt({
      tenantId: T,
      branchId: B,
      lastAttemptAt: '2026-06-05T11:00:00.000Z',
      outcome: 'failed',
    });

    const row = assertRow(repo.read(T));
    expect(row.last_success_at).toBe('2026-06-05T10:00:00.000Z'); // unchanged
    expect(row.last_attempt_at).toBe('2026-06-05T11:00:00.000Z');
    expect(row.last_outcome).toBe('failed');
    db.close();
  });

  it('recordAttempt before any success leaves last_success_at null', () => {
    const db = freshCatalogueDb();
    const repo = createCatalogueSyncStateRepo(handleFor(db));

    repo.recordAttempt({
      tenantId: T,
      branchId: B,
      lastAttemptAt: '2026-06-05T11:00:00.000Z',
      outcome: 'failed',
    });

    const row = assertRow(repo.read(T));
    expect(row.last_success_at).toBeNull();
    expect(row.last_outcome).toBe('failed');
    db.close();
  });

  it('is tenant-scoped — a write for tenant A never appears under tenant B', () => {
    const db = freshCatalogueDb();
    const repo = createCatalogueSyncStateRepo(handleFor(db));

    repo.recordSuccess({
      tenantId: T,
      branchId: B,
      lastSuccessAt: '2026-06-05T10:00:00.000Z',
      sourceSnapshotId: 'snap-1',
    });

    expect(repo.read('tenant-2')).toBeNull();
    db.close();
  });

  it('re-running recordSuccess upserts the single row (no duplicate PK)', () => {
    const db = freshCatalogueDb();
    const repo = createCatalogueSyncStateRepo(handleFor(db));

    repo.recordSuccess({
      tenantId: T,
      branchId: B,
      lastSuccessAt: '2026-06-05T10:00:00.000Z',
      sourceSnapshotId: 'snap-1',
    });
    expect(() => {
      repo.recordSuccess({
        tenantId: T,
        branchId: B,
        lastSuccessAt: '2026-06-05T12:00:00.000Z',
        sourceSnapshotId: 'snap-2',
      });
    }).not.toThrow();

    const row = assertRow(repo.read(T));
    expect(row.last_success_at).toBe('2026-06-05T12:00:00.000Z');
    expect(row.source_snapshot_id).toBe('snap-2');
    db.close();
  });
});
