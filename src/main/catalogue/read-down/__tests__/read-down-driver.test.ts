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
import { createReadDownDriver } from '../read-down-driver.js';
import type { ReadDownClient, ReadDownFetchResult } from '../read-down-client-types.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';
import type { DatabaseHandle } from '../../../db/client.js';

/**
 * 010 T037 (RED) — read-down driver (US2, R8 / FR-12 / FR-14).
 *
 * The driver orchestrates one read-down tick: fetch via the injected client →
 * (on `ok`) writer.run → result; (on transport failure) record a failed attempt
 * WITHOUT calling the writer, so a working catalogue is preserved and the
 * freshness clock never advances on a fetch that didn't land.
 *
 * Two load-bearing behaviours under test:
 *   1. ASYNC SINGLE-FLIGHT (FR-14). `runTickOnce()` ADMITS synchronously —
 *      returning `{ kind: 'started', completed }` for the first call and
 *      `{ kind: 'already_running' }` for a concurrent call — but the read-down
 *      itself completes on the `completed` promise. The bridge maps on `kind`
 *      immediately (FR-12 non-blocking, contract Addition 1); the test awaits
 *      `completed` to assert the write landed.
 *   2. TRANSPORT-FAILURE PATH (the driver's own responsibility — the writer only
 *      sees writer-side failures). A client `no_connection` / `failed` → the
 *      writer is NOT called, `recordAttempt('failed')` is recorded, and any prior
 *      catalogue is preserved (SC-5 / FR-7 at the fetch boundary).
 *
 * The real HTTP `createReadDownClient` (T020/T021) is BLOCKED on D-DEPLOY (#349),
 * so the driver depends on the `ReadDownClient` INTERFACE and the test injects a
 * controllable fake — the canonical DI seam (mirrors finalize-listener).
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
    row_cursor: `cur-${id}`,
  };
}

function countRows(handle: DatabaseHandle, table: string): number {
  const stmt = handle.prepare(`SELECT COUNT(*) AS n FROM ${table}`) as {
    get(): { n: number } | undefined;
  };
  return stmt.get()?.n ?? 0;
}

/** A controllable fake client: each call resolves the next queued result. */
function fakeClient(results: ReadDownFetchResult[]): {
  client: ReadDownClient;
  calls: () => number;
} {
  let i = 0;
  let calls = 0;
  return {
    client: {
      fetchSnapshot(): Promise<ReadDownFetchResult> {
        calls += 1;
        const idx = Math.min(i, results.length - 1);
        const r = results[idx] ?? { kind: 'failed' };
        i += 1;
        return Promise.resolve(r);
      },
    },
    calls: () => calls,
  };
}

/** A fake client whose fetch is gated on a manually-resolved promise (hold a tick in-flight). */
function gatedClient(result: ReadDownFetchResult): {
  client: ReadDownClient;
  release: () => void;
} {
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  return {
    client: {
      async fetchSnapshot(): Promise<ReadDownFetchResult> {
        await gate;
        return result;
      },
    },
    release,
  };
}

describe('T037 — read-down driver', () => {
  it('a successful tick fetches then writes; completed resolves with the outcome', async () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });
    const { client } = fakeClient([
      { kind: 'ok', sourceSnapshotId: 'snap-1', rows: [good('p-1'), good('p-2')] },
    ]);

    const driver = createReadDownDriver({
      client,
      writer,
      tenantId: TENANT,
      branchId: BRANCH,
      now: () => '2026-06-07T10:00:00.000Z',
      tickIntervalMs: 60_000,
    });

    const admission = driver.runTickOnce();
    expect(admission.kind).toBe('started');
    const outcome = await nn(admission.kind === 'started' ? admission.completed : null);

    expect(outcome.outcome).toBe('succeeded');
    expect(outcome.productsWritten).toBe(2);
    expect(countRows(handle, 'products')).toBe(2);

    // Freshness advanced inside the promote tx.
    const state = nn(syncStateRepo.read(TENANT));
    expect(state.last_success_at).toBe('2026-06-07T10:00:00.000Z');
    db.close();
  });

  it('single-flight: a concurrent call while a tick is in-flight is refused as already_running', async () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });
    const { client, release } = gatedClient({
      kind: 'ok',
      sourceSnapshotId: 'snap-1',
      rows: [good('p-1')],
    });

    const driver = createReadDownDriver({
      client,
      writer,
      tenantId: TENANT,
      branchId: BRANCH,
      now: () => '2026-06-07T10:00:00.000Z',
      tickIntervalMs: 60_000,
    });

    const first = driver.runTickOnce();
    expect(first.kind).toBe('started');

    // Second call WHILE the first is gated mid-fetch → already_running.
    const second = driver.runTickOnce();
    expect(second.kind).toBe('already_running');

    // Release the gate; the first tick completes and writes.
    release();
    const outcome = await nn(first.kind === 'started' ? first.completed : null);
    expect(outcome.outcome).toBe('succeeded');
    expect(countRows(handle, 'products')).toBe(1);

    // After completion a fresh tick is admitted again.
    const third = driver.runTickOnce();
    expect(third.kind).toBe('started');
    await nn(third.kind === 'started' ? third.completed : null);
    db.close();
  });

  it('transport failure: the writer is NOT called, a failed attempt is recorded, prior catalogue preserved', async () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });

    // Seed a working catalogue with a successful first tick.
    {
      const { client } = fakeClient([
        { kind: 'ok', sourceSnapshotId: 'snap-1', rows: [good('p-1')] },
      ]);
      const seedDriver = createReadDownDriver({
        client,
        writer,
        tenantId: TENANT,
        branchId: BRANCH,
        now: () => '2026-06-07T09:00:00.000Z',
        tickIntervalMs: 60_000,
      });
      const a = seedDriver.runTickOnce();
      await nn(a.kind === 'started' ? a.completed : null);
    }
    expect(countRows(handle, 'products')).toBe(1);

    // Now a transport failure. The writer must NOT run; the prior catalogue stays.
    const { client: failing, calls } = fakeClient([{ kind: 'no_connection' }]);
    const driver = createReadDownDriver({
      client: failing,
      writer,
      tenantId: TENANT,
      branchId: BRANCH,
      now: () => '2026-06-07T10:00:00.000Z',
      tickIntervalMs: 60_000,
    });

    const admission = driver.runTickOnce();
    expect(admission.kind).toBe('started');
    const outcome = await nn(admission.kind === 'started' ? admission.completed : null);

    expect(outcome.outcome).toBe('failed');
    expect(outcome.failureCategory).toBe('transport');
    expect(calls()).toBe(1);

    // Prior catalogue intact + still resolvable.
    const repo = createProductRepo(handle);
    expect(repo.lookupBySku(TENANT, 'SKU-p-1').kind).toBe('one');
    expect(countRows(handle, 'products')).toBe(1);

    // Freshness clock NOT advanced; failure recorded for diagnostics.
    const state = nn(syncStateRepo.read(TENANT));
    expect(state.last_success_at).toBe('2026-06-07T09:00:00.000Z');
    expect(state.last_outcome).toBe('failed');
    expect(state.last_attempt_at).toBe('2026-06-07T10:00:00.000Z');
    db.close();
  });
});

describe('T038 — driver lifecycle (start/stop)', () => {
  it('start installs an interval and stop clears it (idempotent)', () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });
    const { client } = fakeClient([{ kind: 'ok', sourceSnapshotId: 's', rows: [] }]);

    const driver = createReadDownDriver({
      client,
      writer,
      tenantId: TENANT,
      branchId: BRANCH,
      now: () => '2026-06-07T10:00:00.000Z',
      tickIntervalMs: 60_000,
    });

    const handle1 = driver.start();
    // Calling start again returns the same handle (no second interval).
    expect(driver.start()).toBe(handle1);
    driver.stop();
    // stop is safe to call again.
    driver.stop();
    db.close();
  });
});
