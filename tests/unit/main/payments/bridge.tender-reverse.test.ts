/* eslint-disable @typescript-eslint/unbound-method --
 * See bridge.payments-start.test.ts for rationale.
 */
/**
 * T106 — `tender.reverse` bridge handler test (RED).
 *
 * Asserts (contracts/bridge-api.md §"tender.reverse"):
 *
 *   1. Session gate (no_session / role_denied).
 *   2. The handler looks up the line's bound attempt to enforce
 *      tenant_isolation / wrong_owner / attempt_terminal — the request
 *      carries only `tender_line_id`, so the handler must resolve the
 *      attempt via the lines repo first, then apply the gating helper
 *      against that attempt's projection.
 *   3. Idempotency: identical retry returns the prior outcome
 *      (`reversed_at` + `state` reconstructed from the persisted line);
 *      mismatch refuses with `idempotency_payload_mismatch`.
 *   4. The handler routes through `tenderLineFsm.reverse`. FSM refusals
 *      (`line_not_applied`, `tender_not_yet_supported` for voucher in
 *      Slice 3) pass through.
 *   5. On FSM ok:
 *        • Response `state` is the FSM's outcome state (`reversed` for
 *          cash + external_card_terminal in Slice 3; `reversal_pending`
 *          forwarded but not exercised here).
 *        • Audit `tender.reversed` event emitted with
 *          `manual_void_required: true` on external_card_terminal,
 *          `false` on cash.
 *
 * **Wave G — TDD RED.** Forward-references the Wave H module.
 */

import { describe, expect, it, vi } from 'vitest';

import { createTenderReverseHandler } from '../../../../src/main/payments/handlers/tender-reverse.js';

import {
  makeAttemptRow,
  makeAttemptsRepoDouble,
  makeAuditEmitterDouble,
  makeIdempotencyHelperDouble,
  makeLineRow,
  makeLinesRepoDouble,
  makeSession,
  makeSessionSource,
  makeTenderLineFsmDouble,
} from './__fixtures__/bridge-handler-deps.js';
import type { TenderReverseRequest } from '../../../../src/shared/bridge-api.js';

function validRequest(overrides: Partial<TenderReverseRequest> = {}): TenderReverseRequest {
  return {
    tender_line_id: 'tl-1',
    idempotency_key: 'idem-reverse-1',
    ...overrides,
  };
}

function setup(
  opts: { lineTenderType?: 'cash' | 'external_card_terminal' | 'internal_voucher' } = {},
) {
  const sessionSource = makeSessionSource(makeSession());
  const row = makeAttemptRow();
  const attemptsRepo = makeAttemptsRepoDouble([row]);
  const linesRepo = makeLinesRepoDouble([
    makeLineRow({
      tender_line_id: 'tl-1',
      tender_type: opts.lineTenderType ?? 'cash',
      state: 'applied',
    }),
  ]);
  const fsm = makeTenderLineFsmDouble();
  const idempotency = makeIdempotencyHelperDouble();
  const auditEmitter = makeAuditEmitterDouble();
  const clock = vi.fn<() => Date>(() => new Date('2026-05-23T11:00:05.000Z'));
  const handler = createTenderReverseHandler({
    getCurrentSession: sessionSource.getCurrentSession,
    attemptsRepo,
    linesRepo,
    tenderLineFsm: fsm,
    idempotency,
    auditEmitter,
    clock,
  });
  return { sessionSource, attemptsRepo, linesRepo, fsm, idempotency, auditEmitter, clock, handler };
}

describe('T106 — tender.reverse bridge handler', () => {
  it('refuses no_session when there is no active session', async () => {
    const handler = createTenderReverseHandler({
      getCurrentSession: makeSessionSource(null).getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble(),
      linesRepo: makeLinesRepoDouble(),
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-23T11:00:05.000Z'),
    });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('refuses line_not_applied when the line is unknown', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const handler = createTenderReverseHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([makeAttemptRow()]),
      linesRepo: makeLinesRepoDouble(),
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-23T11:00:05.000Z'),
    });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'line_not_applied',
    });
  });

  it('refuses tenant_isolation when the line is bound to an attempt in another tenant', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ tenant_id: 'tenant-OTHER' });
    const linesRepo = makeLinesRepoDouble([makeLineRow({ tender_line_id: 'tl-1' })]);
    const handler = createTenderReverseHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-23T11:00:05.000Z'),
    });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'tenant_isolation',
    });
  });

  it('refuses wrong_owner when the bound attempt belongs to another session', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ operator_session_id: 'sess-OTHER' });
    const linesRepo = makeLinesRepoDouble([makeLineRow({ tender_line_id: 'tl-1' })]);
    const handler = createTenderReverseHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-23T11:00:05.000Z'),
    });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'wrong_owner',
    });
  });

  it('reverses a cash line and returns ok with state=reversed', async () => {
    const { handler, fsm } = setup({ lineTenderType: 'cash' });
    fsm.reverse.mockReturnValueOnce({
      kind: 'ok',
      reversed_at: '2026-05-23T11:00:05.000Z',
      state: 'reversed',
      tender_type: 'cash',
      manual_void_required: false,
    });
    const result = await handler(validRequest());
    expect(result).toEqual({
      kind: 'ok',
      reversed_at: '2026-05-23T11:00:05.000Z',
      state: 'reversed',
    });
    expect(fsm.reverse).toHaveBeenCalledTimes(1);
    expect(fsm.reverse.mock.calls[0]?.[0]).toMatchObject({
      tender_line_id: 'tl-1',
      payment_attempt_id: 'pa-1',
      reversed_at: '2026-05-23T11:00:05.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
      action_id: 'idem-reverse-1',
    });
  });

  it('reverses an external_card_terminal line with manual_void_required: true in the audit payload', async () => {
    const { handler, fsm, auditEmitter } = setup({ lineTenderType: 'external_card_terminal' });
    fsm.reverse.mockReturnValueOnce({
      kind: 'ok',
      reversed_at: '2026-05-23T11:00:05.000Z',
      state: 'reversed',
      tender_type: 'external_card_terminal',
      manual_void_required: true,
    });
    const result = await handler(validRequest());
    expect(result.kind).toBe('ok');
    expect(auditEmitter.captured).toHaveLength(1);
    expect(auditEmitter.captured[0]?.action_category).toBe('tender.reversed');
    expect(auditEmitter.captured[0]?.payload).toMatchObject({
      tender_line_id: 'tl-1',
      tender_type: 'external_card_terminal',
      manual_void_required: true,
    });
  });

  it('emits tender.reversed with manual_void_required: false on cash reverse', async () => {
    const { handler, fsm, auditEmitter } = setup({ lineTenderType: 'cash' });
    fsm.reverse.mockReturnValueOnce({
      kind: 'ok',
      reversed_at: '2026-05-23T11:00:05.000Z',
      state: 'reversed',
      tender_type: 'cash',
      manual_void_required: false,
    });
    await handler(validRequest());
    expect(auditEmitter.captured).toHaveLength(1);
    expect(auditEmitter.captured[0]?.payload).toMatchObject({
      manual_void_required: false,
    });
  });

  it('passes FSM line_not_applied through unchanged when the line is not in applied state', async () => {
    const { handler, fsm } = setup();
    fsm.reverse.mockReturnValueOnce({ kind: 'refused', reason: 'line_not_applied' });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'line_not_applied',
    });
  });

  // Removed in Wave 4: the voucher reverse pass-through is no longer
  // an FSM `tender_not_yet_supported` refusal — the handler now routes
  // through V-A `vouchers.reverse` (T262). Voucher reverse paths are
  // covered exhaustively by `bridge.tender-reverse.voucher.test.ts`
  // (T222).

  it('returns the prior outcome on idempotency replay', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const linesRepo = makeLinesRepoDouble([
      makeLineRow({
        tender_line_id: 'tl-1',
        state: 'reversed',
        reversed_at: '2026-05-23T10:59:50.000Z',
        last_action_id: 'idem-reverse-1',
      }),
    ]);
    const fsm = makeTenderLineFsmDouble();
    const handler = createTenderReverseHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([makeAttemptRow()]),
      linesRepo,
      tenderLineFsm: fsm,
      idempotency: makeIdempotencyHelperDouble({ kind: 'replay' }),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-23T11:00:05.000Z'),
    });
    const result = await handler(validRequest());
    expect(result).toEqual({
      kind: 'ok',
      reversed_at: '2026-05-23T10:59:50.000Z',
      state: 'reversed',
    });
    expect(fsm.reverse).not.toHaveBeenCalled();
  });

  it('refuses idempotency_payload_mismatch when the helper signals mismatch', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const handler = createTenderReverseHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([makeAttemptRow()]),
      linesRepo: makeLinesRepoDouble([makeLineRow({ tender_line_id: 'tl-1' })]),
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble({ kind: 'mismatch' }),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-23T11:00:05.000Z'),
    });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'idempotency_payload_mismatch',
    });
  });

  it('does NOT emit any audit event on FSM refusal', async () => {
    const { handler, fsm, auditEmitter } = setup();
    fsm.reverse.mockReturnValueOnce({ kind: 'refused', reason: 'line_not_applied' });
    await handler(validRequest());
    expect(auditEmitter.captured).toHaveLength(0);
  });
});
