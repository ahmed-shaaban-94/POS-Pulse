/**
 * 011 T026/T030-T034/T040 (RED) — `sale-sync-engine`.
 *
 * The engine drains eligible sales (stateRepo.eligible), reads each durable Sale,
 * builds the payload, POSTs via the injected SaleSyncClient, and records the
 * outcome in sale_sync_state. Single-flight admission (010 driver precedent):
 * `runTickOnce()` returns `{ kind:'started', completed }` or `{ kind:'already_running' }`.
 *
 * Outcome handling:
 *   • ok / duplicate(409)  → markSynced (idempotent success)
 *   • transient(5xx/timeout)→ recordTransient (stay pending, attempt++, backoff)
 *   • permanent(4xx)       → markDeadLetter + onDeadLetter notification
 *   • no_connection        → recordTransient-style stay-pending, no count loss
 * Operator-session gate: no token → drain pauses (no POST), resumes when present.
 * FIFO + tenant scope inherited from eligible().
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshSalesSyncDb,
  handleFor,
  initSalesSyncSql,
  nn,
  seedOutbox,
  seedSale,
} from './__helpers__/sales-sync-fixture.js';
import { createSaleSyncStateRepo } from '../sale-sync-state-repo.js';
import { createFakeSaleSyncClient, type SaleSyncResult } from '../sale-sync-client-types.js';
import { bindSalesRepository } from '../../sales/repositories/sales.repository.js';
import { createSaleSyncEngine, type SaleSyncEngineDeps } from '../sale-sync-engine.js';

beforeAll(async () => {
  await initSalesSyncSql();
});

const SCOPE = { tenantId: 'tenant-1', branchId: 'branch-1' };

interface Harness {
  deps: SaleSyncEngineDeps;
  stateRepo: ReturnType<typeof createSaleSyncStateRepo>;
  deadLetters: string[];
  db: ReturnType<typeof freshSalesSyncDb>;
}

function harness(opts: {
  script?: SaleSyncResult[];
  token?: string | null;
  now?: () => string;
}): Harness {
  const db = freshSalesSyncDb();
  const handle = handleFor(db);
  const stateRepo = createSaleSyncStateRepo(handle);
  const salesRepo = bindSalesRepository(handle);
  const client = createFakeSaleSyncClient(opts.script);
  const deadLetters: string[] = [];
  const deps: SaleSyncEngineDeps = {
    client,
    stateRepo,
    salesRepo,
    tenantId: SCOPE.tenantId,
    branchId: SCOPE.branchId,
    getOperatorToken: () => (opts.token === undefined ? 'tok-1' : opts.token),
    now: opts.now ?? (() => '2026-06-07T10:05:00.000Z'),
    backoff: { baseMs: 1000, maxMs: 300_000 },
    onDeadLetter: (saleId) => deadLetters.push(saleId),
  };
  return { deps, stateRepo, deadLetters, db };
}

async function runOnce(deps: SaleSyncEngineDeps): Promise<void> {
  const engine = createSaleSyncEngine(deps);
  const admission = engine.runTickOnce();
  if (admission.kind === 'started') await admission.completed;
}

describe('sale-sync-engine', () => {
  it('T026 happy path: a freshly-enqueued sale (no state row) syncs to synced', async () => {
    const h = harness({ script: [{ kind: 'ok' }] });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' }); // outbox row, NO state row — first drain
    await runOnce(h.deps);
    expect(nn(h.stateRepo.read('sale-1')).sync_status).toBe('synced');
    h.db.close();
  });

  it('T030 duplicate (409) is treated as idempotent success (synced, no retry)', async () => {
    const h = harness({ script: [{ kind: 'duplicate' }] });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    await runOnce(h.deps);
    const row = nn(h.stateRepo.read('sale-1'));
    expect(row.sync_status).toBe('synced');
    expect(row.attempt_count).toBe(0);
    h.db.close();
  });

  it('T031 transient stays pending, increments attempt, sets a future next_retry_at', async () => {
    const h = harness({ script: [{ kind: 'transient' }] });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    await runOnce(h.deps);
    const row = nn(h.stateRepo.read('sale-1'));
    expect(row.sync_status).toBe('pending');
    expect(row.attempt_count).toBe(1);
    expect(row.next_retry_at).not.toBeNull();
    expect(nn(row.next_retry_at) > '2026-06-07T10:05:00.000Z').toBe(true);
    h.db.close();
  });

  it('T031b backoff grows with attempt_count (second attempt waits longer)', async () => {
    const at = ['2026-06-07T10:05:00.000Z', '2026-06-07T10:06:00.000Z'];
    let i = 0;
    const h = harness({
      script: [{ kind: 'transient' }, { kind: 'transient' }],
      now: () => nn(at[Math.min(i, at.length - 1)]),
    });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    await runOnce(h.deps);
    const firstRetry = nn(nn(h.stateRepo.read('sale-1')).next_retry_at);
    i = 1;
    // force eligibility (next_retry_at due) by advancing the clock past it
    const h2now = '2026-06-08T00:00:00.000Z';
    const engine2 = createSaleSyncEngine({ ...h.deps, now: () => h2now });
    const a = engine2.runTickOnce();
    if (a.kind === 'started') await a.completed;
    const row = nn(h.stateRepo.read('sale-1'));
    expect(row.attempt_count).toBe(2);
    // second backoff window (from h2now) is larger than the first (from 10:05)
    const secondDelta = Date.parse(nn(row.next_retry_at)) - Date.parse(h2now);
    const firstDelta = Date.parse(firstRetry) - Date.parse('2026-06-07T10:05:00.000Z');
    expect(secondDelta).toBeGreaterThan(firstDelta);
    h.db.close();
  });

  it('T032 permanent (4xx) → dead_letter + onDeadLetter notification', async () => {
    const h = harness({ script: [{ kind: 'permanent' }] });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    await runOnce(h.deps);
    expect(nn(h.stateRepo.read('sale-1')).sync_status).toBe('dead_letter');
    expect(h.deadLetters).toEqual(['sale-1']);
    h.db.close();
  });

  it('T033 no_connection stays pending (no loss), retried next tick', async () => {
    const h = harness({ script: [{ kind: 'no_connection' }] });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    await runOnce(h.deps);
    expect(nn(h.stateRepo.read('sale-1')).sync_status).toBe('pending');
    // still eligible after a no-connection (next_retry_at due/null)
    expect(h.stateRepo.eligible(SCOPE, '2026-06-09T00:00:00.000Z').map((e) => e.sale_id)).toEqual([
      'sale-1',
    ]);
    h.db.close();
  });

  it('T034 drains in FIFO order by enqueued_at', async () => {
    const h = harness({ script: [{ kind: 'ok' }, { kind: 'ok' }] });
    seedSale(h.db, { sale_id: 'sale-A' });
    seedSale(h.db, { sale_id: 'sale-B' });
    seedOutbox(h.db, { sale_id: 'sale-B', enqueued_at: '2026-06-07T10:00:02.000Z' });
    seedOutbox(h.db, { sale_id: 'sale-A', enqueued_at: '2026-06-07T10:00:01.000Z' });
    const client = createFakeSaleSyncClient([{ kind: 'ok' }, { kind: 'ok' }]);
    const deps = { ...h.deps, client };
    await runOnce(deps);
    expect(client.calls.map((c) => c.externalId)).toEqual([
      'pos-pulse:handoff-sale-A',
      'pos-pulse:handoff-sale-B',
    ]);
    h.db.close();
  });

  it('T040 operator-session gate: no token → no POST, sale stays unsynced', async () => {
    const h = harness({ script: [{ kind: 'ok' }], token: null });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    await runOnce(h.deps);
    // No state row written (nothing attempted) and still eligible.
    expect(h.stateRepo.read('sale-1')).toBeNull();
    expect(h.stateRepo.eligible(SCOPE, '2026-06-09T00:00:00.000Z').map((e) => e.sale_id)).toEqual([
      'sale-1',
    ]);
    h.db.close();
  });

  it('single-flight: a second runTickOnce while one is in flight returns already_running', async () => {
    const h = harness({ script: [{ kind: 'ok' }] });
    seedSale(h.db, { sale_id: 'sale-1' });
    seedOutbox(h.db, { sale_id: 'sale-1' });
    const engine = createSaleSyncEngine(h.deps);
    const first = engine.runTickOnce();
    const second = engine.runTickOnce();
    expect(first.kind).toBe('started');
    expect(second.kind).toBe('already_running');
    // Await the in-flight drain before closing the db (no out-of-band rejection).
    if (first.kind === 'started') await first.completed;
    h.db.close();
  });
});
