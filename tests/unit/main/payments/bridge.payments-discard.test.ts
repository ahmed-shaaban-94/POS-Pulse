/**
 * T104 — `payments.discardOnSessionEnd` (internal, main-process-only) test (RED).
 *
 * Per contracts/bridge-api.md §"payments.discardOnSessionEnd": this
 * handler is called by the main process when an operator session ends
 * with a `started` attempt still bound. It is **never exposed to the
 * renderer** (T142 must NOT register it via contextBridge).
 *
 * Asserts:
 *   1. The factory does NOT return an `ipcMain.handle` registration
 *      callable. The handler signature is
 *      `discardOnSessionEnd(payment_attempt_id, options) → DiscardOutcome`.
 *      No `idempotency_key`, no session lookup (the session is gone by
 *      construction).
 *   2. The handler transitions the attempt to `failed` with reason
 *      `operator_session_terminated` (FailureReason enum value).
 *   3. The handler reverses every applied tender line using the same
 *      LIFO + reversal_pending pattern as `payments.cancel` — that is,
 *      it delegates to the PaymentAttempt FSM's cancel-style path,
 *      then `fail`s the attempt. (Implementation choice: a single FSM
 *      method that combines both is acceptable; this test asserts the
 *      observable contract — final state + audit events — not the
 *      sequence of FSM calls.)
 *   4. Audit emission:
 *        • One `tender.reversed` per reversed line.
 *        • One `payment.failed` with `failure_reason:
 *          operator_session_terminated` and the attribution operator id
 *          taken from the persisted row (NOT from any "current session"
 *          since there isn't one).
 *   5. Idempotency by row state: calling the handler twice on an
 *      already-`failed` attempt is a no-op (`{ kind: 'noop' }`) — no
 *      duplicate audit events, no second FSM call.
 *
 * **Wave G — TDD RED.** Forward-references the Wave H module.
 */

import { describe, expect, it, vi } from 'vitest';

import { createPaymentsDiscardOnSessionEndHandler } from '../../../../src/main/payments/handlers/payments-discard-on-session-end.js';

import {
  makeAttemptRow,
  makeAttemptsRepoDouble,
  makeAuditEmitterDouble,
  makeLineRow,
  makeLinesRepoDouble,
  makePaymentAttemptFsmDouble,
  makeTenderLineFsmDouble,
} from './__fixtures__/bridge-handler-deps.js';

function setup() {
  const row = makeAttemptRow();
  const attemptsRepo = makeAttemptsRepoDouble([row]);
  const linesRepo = makeLinesRepoDouble([
    makeLineRow({ tender_line_id: 'tl-1', apply_order: 1, tender_type: 'cash' }),
    makeLineRow({
      tender_line_id: 'tl-2',
      apply_order: 2,
      tender_type: 'external_card_terminal',
    }),
  ]);
  const paymentFsm = makePaymentAttemptFsmDouble();
  const tenderFsm = makeTenderLineFsmDouble();
  const auditEmitter = makeAuditEmitterDouble();
  const uuid = vi.fn<() => string>(() => 'discard-action-1');
  const clock = vi.fn<() => Date>(() => new Date('2026-05-23T11:00:10.000Z'));
  const handler = createPaymentsDiscardOnSessionEndHandler({
    attemptsRepo,
    linesRepo,
    paymentAttemptFsm: paymentFsm,
    tenderLineFsm: tenderFsm,
    auditEmitter,
    uuid,
    clock,
  });
  return { attemptsRepo, linesRepo, paymentFsm, tenderFsm, auditEmitter, uuid, clock, handler };
}

describe('T104 — payments.discardOnSessionEnd (internal)', () => {
  it('returns { kind: "noop" } when the attempt is unknown', async () => {
    const handler = createPaymentsDiscardOnSessionEndHandler({
      attemptsRepo: makeAttemptsRepoDouble([]),
      linesRepo: makeLinesRepoDouble(),
      paymentAttemptFsm: makePaymentAttemptFsmDouble(),
      tenderLineFsm: makeTenderLineFsmDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      uuid: () => 'discard-action-1',
      clock: () => new Date('2026-05-23T11:00:10.000Z'),
    });
    expect(await handler({ payment_attempt_id: 'pa-unknown' })).toEqual({ kind: 'noop' });
  });

  it('returns { kind: "noop" } when the attempt is already in a terminal state', async () => {
    const attemptsRepo = makeAttemptsRepoDouble([makeAttemptRow({ state: 'settled' })]);
    const paymentFsm = makePaymentAttemptFsmDouble();
    const handler = createPaymentsDiscardOnSessionEndHandler({
      attemptsRepo,
      linesRepo: makeLinesRepoDouble(),
      paymentAttemptFsm: paymentFsm,
      tenderLineFsm: makeTenderLineFsmDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      uuid: () => 'discard-action-1',
      clock: () => new Date('2026-05-23T11:00:10.000Z'),
    });
    expect(await handler({ payment_attempt_id: 'pa-1' })).toEqual({ kind: 'noop' });
    expect(paymentFsm.fail).not.toHaveBeenCalled();
  });

  it('transitions a started attempt to failed with operator_session_terminated', async () => {
    const { handler, paymentFsm } = setup();
    const result = await handler({ payment_attempt_id: 'pa-1' });
    expect(result).toMatchObject({
      kind: 'ok',
      failed_at: '2026-05-23T11:00:10.000Z',
    });
    expect(paymentFsm.fail).toHaveBeenCalledTimes(1);
    expect(paymentFsm.fail.mock.calls[0]?.[0]).toMatchObject({
      payment_attempt_id: 'pa-1',
      failed_at: '2026-05-23T11:00:10.000Z',
      failure_reason: 'operator_session_terminated',
    });
  });

  it('reverses every applied tender line in LIFO order before failing the attempt', async () => {
    const { handler, tenderFsm } = setup();
    await handler({ payment_attempt_id: 'pa-1' });
    // Two applied lines (tl-1 apply_order 1, tl-2 apply_order 2) → LIFO is tl-2, tl-1.
    const reverseCalls = tenderFsm.reverse.mock.calls.concat(
      tenderFsm.reverseInTransaction.mock.calls,
    );
    expect(reverseCalls.length).toBeGreaterThanOrEqual(2);
    const reversedIds = reverseCalls.map((c) => c[0].tender_line_id);
    // LIFO assertion — tl-2 reversed before tl-1.
    const firstIdx = reversedIds.indexOf('tl-2');
    const secondIdx = reversedIds.indexOf('tl-1');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('emits tender.reversed per reversed line + one payment.failed', async () => {
    const { handler, auditEmitter } = setup();
    await handler({ payment_attempt_id: 'pa-1' });
    const evts = auditEmitter.captured;
    const reversed = evts.filter((e) => e.action_category === 'tender.reversed');
    const failed = evts.filter((e) => e.action_category === 'payment.failed');
    expect(reversed).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.payload).toMatchObject({
      payment_attempt_id: 'pa-1',
      failed_at: '2026-05-23T11:00:10.000Z',
      failure_reason: 'operator_session_terminated',
      // Attribution comes from the persisted row, not a live session.
      attribution_operator_id: 'op-clerk-user-abc',
    });
  });

  it('does NOT call any session-source helper (this handler is internal)', async () => {
    // The factory signature MUST omit `getCurrentSession` entirely. This
    // test compiles only if the factory does not require it.
    const handler = createPaymentsDiscardOnSessionEndHandler({
      attemptsRepo: makeAttemptsRepoDouble([makeAttemptRow()]),
      linesRepo: makeLinesRepoDouble(),
      paymentAttemptFsm: makePaymentAttemptFsmDouble(),
      tenderLineFsm: makeTenderLineFsmDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      uuid: () => 'discard-action-1',
      clock: () => new Date('2026-05-23T11:00:10.000Z'),
    });
    const result = await handler({ payment_attempt_id: 'pa-1' });
    expect(result.kind).toBe('ok');
  });
});
