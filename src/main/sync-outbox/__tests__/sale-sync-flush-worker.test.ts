import { describe, expect, it, vi } from 'vitest';

import { createSaleSyncFlushWorker } from '../sale-sync-flush-worker.js';
import type { SaleSyncFlushWorkerDeps } from '../sale-sync-flush-worker.js';
import type { SaleSyncOutboxRow } from '../sale-sync-outbox.repository.js';
import type { SaleRow } from '../../sales/repositories/sales.repository.js';
import type { SaleSyncFlushRequest, SaleSyncFlushResult } from '../sale-sync-flush-client-types.js';

/**
 * 008 sale-sync flush worker (option c — synchronous-while-signed-in).
 *
 * Drains pending outbox rows ONLY when a live operator session JWT is
 * available (the 60-second Clerk session JWT can't survive a deferred queue, so
 * flush runs inside the live session window). Per row: load the SaleRow, build
 * the body, flush via the client, transition state:
 *   ok            → markSynced
 *   refused (4xx) → markFailed (non-retryable)
 *   no_connection → bumpAttempt, leave pending (retry later)
 * No JWT available → no-op (don't attempt; nothing to mark).
 */

function outboxRow(overrides: Partial<SaleSyncOutboxRow> = {}): SaleSyncOutboxRow {
  return {
    outbox_row_id: 'ob-1',
    sale_id: 'sale-1',
    envelope_handoff_action_id: 'hoa-1',
    tenant_id: 't-1',
    branch_id: 'b-1',
    terminal_id: 'term-1',
    state: 'pending',
    enqueued_at: '2026-06-11T10:00:00.000Z',
    attempt_count: 0,
    last_error: null,
    ...overrides,
  };
}

function saleRow(sale_id: string): SaleRow {
  return {
    sale_id,
    sale_number: 'S-1',
    receipt_number: 'R-1',
    envelope_handoff_action_id: 'hoa-1',
    payment_attempt_id: 'pa-1',
    envelope_cart_id: 'cart-1',
    tenant_id: 't-1',
    branch_id: 'b-1',
    terminal_id: 'term-1',
    terminal_label: 'Till 1',
    selling_operator_id: 'op-1',
    selling_operator_display_name: 'Op',
    selling_operator_session_id: 'sess-1',
    subtotal_minor: 1250,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    tender_lines_summary_json: '[]',
    settled_at: '2026-06-11T10:00:00.000Z',
    finalized_at: '2026-06-11T10:00:01.000Z',
    tenant_tax_registration_id: 'trn-1',
    branch_name: 'B',
    branch_address: 'A',
    local_calendar_day: '2026-06-11',
    lines_json: '[]',
  };
}

interface Mocks {
  pending: SaleSyncOutboxRow[];
  markSynced: ReturnType<typeof vi.fn<(id: string) => void>>;
  markFailed: ReturnType<typeof vi.fn<(id: string, e: string) => void>>;
  bumpAttempt: ReturnType<typeof vi.fn<(id: string) => void>>;
  flush: ReturnType<typeof vi.fn<(req: SaleSyncFlushRequest) => Promise<SaleSyncFlushResult>>>;
  getJwt: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
}

function build(opts: {
  pending: SaleSyncOutboxRow[];
  flushResults: SaleSyncFlushResult[] | ((sale_id: string) => SaleSyncFlushResult);
  jwt?: string | null;
  attestation?: string | null;
}): { worker: ReturnType<typeof createSaleSyncFlushWorker>; m: Mocks } {
  let i = 0;
  const flush = vi.fn<(req: SaleSyncFlushRequest) => Promise<SaleSyncFlushResult>>((req) =>
    Promise.resolve(
      typeof opts.flushResults === 'function'
        ? opts.flushResults(req.idempotencyKey)
        : (opts.flushResults[i++] ?? { kind: 'ok' }),
    ),
  );
  const jwtValue = opts.jwt === undefined ? 'jwt-1' : opts.jwt;
  const getJwt = vi.fn<() => Promise<string | null>>(() => Promise.resolve(jwtValue));
  const m: Mocks = {
    pending: opts.pending,
    markSynced: vi.fn<(id: string) => void>(),
    markFailed: vi.fn<(id: string, e: string) => void>(),
    bumpAttempt: vi.fn<(id: string) => void>(),
    flush,
    getJwt,
  };
  const attValue = opts.attestation === undefined ? 'att-1' : opts.attestation;
  const deps: SaleSyncFlushWorkerDeps = {
    outbox: {
      readPending: () => m.pending,
      markSynced: (id: string) => {
        m.markSynced(id);
      },
      markFailed: (id: string, e: string) => {
        m.markFailed(id, e);
      },
      bumpAttempt: (id: string) => {
        m.bumpAttempt(id);
      },
    },
    loadSale: (id: string) => saleRow(id),
    flushClient: { flushSale: flush },
    getOperatorJwt: getJwt,
    getDeviceAttestation: (): Promise<string | null> => Promise.resolve(attValue),
    currency: { currencyCode: 'EGP', minorDigits: 2 },
  };
  return { worker: createSaleSyncFlushWorker(deps), m };
}

describe('createSaleSyncFlushWorker.flushPending — option c', () => {
  it('no-ops when no operator JWT is available (do not attempt a flush)', async () => {
    const { worker, m } = build({ pending: [outboxRow()], flushResults: [], jwt: null });
    const summary = await worker.flushPending();
    expect(m.flush).not.toHaveBeenCalled();
    expect(m.markSynced).not.toHaveBeenCalled();
    expect(summary).toEqual({
      attempted: 0,
      synced: 0,
      failed: 0,
      deferred: 0,
      skipped_no_jwt: true,
    });
  });

  it('no-ops when no device attestation is available', async () => {
    const { worker, m } = build({ pending: [outboxRow()], flushResults: [], attestation: null });
    await worker.flushPending();
    expect(m.flush).not.toHaveBeenCalled();
  });

  it('held-but-expired JWT (getOperatorJwt returns null) → row stays pending, NEVER markFailed', async () => {
    // The unit proxy for the live "aged-row" acceptance bar: a stale 60s JWT
    // must NOT be attempted (the provider returns null when near/at expiry) and
    // must NOT be marked failed — it stays pending for the next sign-in to drain.
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 's' })],
      flushResults: [],
      jwt: null,
    });
    const summary = await worker.flushPending();
    expect(m.flush).not.toHaveBeenCalled();
    expect(m.markFailed).not.toHaveBeenCalled();
    expect(m.markSynced).not.toHaveBeenCalled();
    expect(summary.skipped_no_jwt).toBe(true);
  });

  it('an expired JWT that slips through → 401 → no_connection → bumpAttempt, stays pending (NOT markFailed)', async () => {
    // Defence-in-depth: if a JWT expires AFTER the null-check but before DP-2
    // verifies it, the 401 maps to no_connection (retryable), not refused. The
    // sale must stay pending, never permanently failed.
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 's' })],
      flushResults: [{ kind: 'no_connection' }],
    });
    await worker.flushPending();
    expect(m.bumpAttempt).toHaveBeenCalledWith('s');
    expect(m.markFailed).not.toHaveBeenCalled();
  });

  it('ok → markSynced; sends Bearer JWT + attestation + stable idempotency key = sale_id', async () => {
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 'sale-9' })],
      flushResults: [{ kind: 'ok' }],
    });
    const summary = await worker.flushPending();
    expect(m.flush).toHaveBeenCalledTimes(1);
    const sentReq = m.flush.mock.calls[0]?.[0];
    expect(sentReq?.jwt).toBe('jwt-1');
    expect(sentReq?.deviceAttestation).toBe('att-1');
    expect(sentReq?.idempotencyKey).toBe('sale-9'); // stable per-sale
    expect(sentReq?.body.externalId).toBe('sale-9');
    expect(m.markSynced).toHaveBeenCalledWith('sale-9');
    expect(summary).toMatchObject({ attempted: 1, synced: 1, failed: 0, deferred: 0 });
  });

  it('refused (4xx) → markFailed (non-retryable)', async () => {
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 's' })],
      flushResults: [{ kind: 'refused' }],
    });
    const summary = await worker.flushPending();
    expect(m.markFailed).toHaveBeenCalledWith('s', expect.any(String));
    expect(m.markSynced).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ failed: 1 });
  });

  it('no_connection → bumpAttempt, leave pending (retry later)', async () => {
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 's' })],
      flushResults: [{ kind: 'no_connection' }],
    });
    const summary = await worker.flushPending();
    expect(m.bumpAttempt).toHaveBeenCalledWith('s');
    expect(m.markSynced).not.toHaveBeenCalled();
    expect(m.markFailed).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ deferred: 1 });
  });

  it('drains multiple rows in order; ok + refused continue, then a no_connection stops the drain', async () => {
    // ok and refused are terminal per-row → the drain continues; no_connection
    // short-circuits (see the next test), so it is ordered LAST here.
    const { worker, m } = build({
      pending: [
        outboxRow({ sale_id: 'a' }),
        outboxRow({ sale_id: 'c' }),
        outboxRow({ sale_id: 'b' }),
      ],
      flushResults: [{ kind: 'ok' }, { kind: 'refused' }, { kind: 'no_connection' }],
    });
    const summary = await worker.flushPending();
    expect(m.markSynced).toHaveBeenCalledWith('a');
    expect(m.markFailed).toHaveBeenCalledWith('c', expect.any(String));
    expect(m.bumpAttempt).toHaveBeenCalledWith('b');
    expect(summary).toMatchObject({ attempted: 3, synced: 1, deferred: 1, failed: 1 });
  });

  it('stops attempting further rows once the JWT/connection drops (no_connection short-circuits the drain)', async () => {
    // If the backend goes unreachable mid-drain, the remaining rows are almost
    // certainly also unreachable — stop early to avoid hammering, leave pending.
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 'a' }), outboxRow({ sale_id: 'b' })],
      flushResults: [{ kind: 'no_connection' }, { kind: 'ok' }],
    });
    await worker.flushPending();
    expect(m.flush).toHaveBeenCalledTimes(1); // stopped after the first no_connection
    expect(m.bumpAttempt).toHaveBeenCalledWith('a');
  });

  it('a sale row that fails to build (malformed) → markFailed, continues', async () => {
    const { worker, m } = build({
      pending: [outboxRow({ sale_id: 'bad' })],
      flushResults: [{ kind: 'ok' }],
    });
    // Override loadSale to return a row whose lines_json is malformed.
    const summary = await worker.flushPendingWith({
      loadSale: () => ({ ...saleRow('bad'), lines_json: 'not-json' }),
    });
    expect(m.flush).not.toHaveBeenCalled();
    expect(m.markFailed).toHaveBeenCalledWith('bad', expect.stringContaining('lines_json'));
    expect(summary).toMatchObject({ failed: 1 });
  });
});
