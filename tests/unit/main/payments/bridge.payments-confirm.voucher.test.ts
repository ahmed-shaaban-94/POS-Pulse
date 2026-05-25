/* eslint-disable @typescript-eslint/unbound-method --
 * See bridge.tender-apply.test.ts for rationale.
 */
/**
 * 006 T221 — `payments.confirm` voucher path test (RED).
 *
 * Wave 4 extension to T101's coverage. Asserts (per
 * `contracts/bridge-api.md` §"payments.confirm" voucher branch +
 * §A4-B brief §3.6 / §3.8):
 *
 *   1. For each `internal_voucher` `applied` line on the attempt, the
 *      handler calls the injected `redeemVoucher` V-A client BEFORE
 *      driving the PaymentAttempt FSM. HTTP cannot live inside a SQLite
 *      transaction, so the redeem sweep is pre-FSM and the
 *      `fsm.confirm` call follows only if every redeem returned
 *      `redeemed`.
 *   2. On success: each voucher line is stamped with the V-A
 *      `redemption_id` via `linesRepo.persistAuthorityRedemptionId`;
 *      the attempt transitions to `settled` and `payment.settled` is
 *      emitted with the voucher line in the breakdown.
 *   3. On any redeem `authority_unreachable`: the attempt transitions
 *      to `failed` with `failure_reason: 'dependency_unavailable'`;
 *      each affected voucher line transitions to `reversal_pending`
 *      via `fsm.markReversalPending`; a `tender.reversal_pending`
 *      audit event is emitted per voucher line. `payment.settled` is
 *      NOT emitted; `payment.failed` IS.
 *   4. **FR-017 guard:** `voucher_authority_redemption_id` MAY appear
 *      in the projection / audit payload; `voucher_redemption_intent_token`
 *      MUST NOT appear anywhere in the bridge response or audit
 *      breakdown.
 */

import { describe, expect, it, vi } from 'vitest';

import { createPaymentsConfirmHandler } from '../../../../src/main/payments/handlers/payments-confirm.js';

import {
  makeAttemptRow,
  makeAttemptsRepoDouble,
  makeAuditEmitterDouble,
  makeIdempotencyHelperDouble,
  makeLineRow,
  makeLinesRepoDouble,
  makePaymentAttemptFsmDouble,
  makeSession,
  makeSessionSource,
  makeTenderLineFsmDouble,
} from './__fixtures__/bridge-handler-deps.js';
import type { PaymentsConfirmRequest } from '../../../../src/shared/bridge-api.js';
import type {
  RedeemVoucherInput,
  RedeemVoucherOutcome,
} from '../../../../src/main/payments/voucher-authority/redeem.js';

function validRequest(overrides: Partial<PaymentsConfirmRequest> = {}): PaymentsConfirmRequest {
  return {
    payment_attempt_id: 'pa-1',
    idempotency_key: 'idem-confirm-voucher-1',
    ...overrides,
  };
}

function makeRedeemVoucherDouble(...outcomes: ReadonlyArray<RedeemVoucherOutcome>) {
  let i = 0;
  return vi.fn<(input: RedeemVoucherInput) => Promise<RedeemVoucherOutcome>>(() => {
    const slot = outcomes[Math.min(i, outcomes.length - 1)] ?? {
      kind: 'redeemed',
      idempotent_replayed: false,
      redeemed_at: '2026-05-25T10:00:05.000Z',
      redemption_id: 'redemption-default',
    };
    i += 1;
    return Promise.resolve(slot);
  });
}

describe('T221 — payments.confirm voucher path', () => {
  // ── 1. Successful voucher redeem → settle ─────────────────────────────────

  it('calls vouchers.redeem for each internal_voucher applied line before confirming the attempt', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ envelope_subtotal_minor: 1500 });
    const voucherLine = makeLineRow({
      tender_line_id: 'tl-voucher-1',
      tender_type: 'internal_voucher',
      amount_applied_minor: 1500,
      voucher_redemption_intent_token: 'TOKEN-SECRET',
      applied_at: '2026-05-25T10:00:01.000Z',
    });
    const linesRepo = makeLinesRepoDouble([voucherLine]);
    const fsm = makePaymentAttemptFsmDouble();
    const tenderFsm = makeTenderLineFsmDouble();
    const auditEmitter = makeAuditEmitterDouble();
    const redeemVoucher = makeRedeemVoucherDouble({
      kind: 'redeemed',
      idempotent_replayed: false,
      redeemed_at: '2026-05-25T10:00:05.000Z',
      redemption_id: 'redemption-ABC',
    });
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
      paymentAttemptFsm: fsm,
      tenderLineFsm: tenderFsm,
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter,
      redeemVoucher,
      uuid: () => 'uuid-confirm-v',
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    const result = await handler(validRequest());
    expect(result).toEqual({ kind: 'ok', settled_at: '2026-05-25T10:00:05.000Z' });
    expect(redeemVoucher).toHaveBeenCalledTimes(1);
    expect(redeemVoucher.mock.calls[0]?.[0]).toEqual({
      payment_attempt_id: 'pa-1',
      redemption_intent_token: 'TOKEN-SECRET',
    });
    expect(fsm.confirm).toHaveBeenCalledTimes(1);
    // The redemption_id is stamped on the line via the new repo setter.
    expect(linesRepo.persistAuthorityRedemptionId).toHaveBeenCalledWith({
      tender_line_id: 'tl-voucher-1',
      voucher_authority_redemption_id: 'redemption-ABC',
      last_action_id: 'idem-confirm-voucher-1',
    });
  });

  it('does NOT call redeemVoucher when the attempt has no internal_voucher applied lines', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow();
    const linesRepo = makeLinesRepoDouble([
      makeLineRow({ tender_line_id: 'tl-cash', tender_type: 'cash', amount_applied_minor: 1500 }),
    ]);
    const fsm = makePaymentAttemptFsmDouble();
    const redeemVoucher = makeRedeemVoucherDouble();
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
      paymentAttemptFsm: fsm,
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      redeemVoucher,
      uuid: () => 'uuid-confirm-v',
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    await handler(validRequest());
    expect(redeemVoucher).not.toHaveBeenCalled();
    expect(fsm.confirm).toHaveBeenCalledTimes(1);
  });

  // ── 2. authority_unreachable → fail + reversal_pending ────────────────────

  it('fails the attempt and marks voucher lines reversal_pending on V-A authority_unreachable', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ envelope_subtotal_minor: 1500 });
    const voucherLine = makeLineRow({
      tender_line_id: 'tl-voucher-1',
      tender_type: 'internal_voucher',
      amount_applied_minor: 1500,
      voucher_redemption_intent_token: 'TOKEN-SECRET',
      applied_at: '2026-05-25T10:00:01.000Z',
    });
    const linesRepo = makeLinesRepoDouble([voucherLine]);
    const fsm = makePaymentAttemptFsmDouble();
    const tenderFsm = makeTenderLineFsmDouble();
    const auditEmitter = makeAuditEmitterDouble();
    const redeemVoucher = makeRedeemVoucherDouble({ kind: 'authority_unreachable' });
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
      paymentAttemptFsm: fsm,
      tenderLineFsm: tenderFsm,
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter,
      redeemVoucher,
      uuid: () => 'uuid-confirm-v',
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    const result = await handler(validRequest());
    // Bridge response is the closed refusal envelope.
    expect(result).toEqual({ kind: 'refused', reason: 'dependency_unavailable' });
    // Attempt FSM was driven to `failed` with the dependency reason.
    expect(fsm.fail).toHaveBeenCalledTimes(1);
    expect(fsm.fail.mock.calls[0]?.[0]).toMatchObject({
      payment_attempt_id: 'pa-1',
      failure_reason: 'dependency_unavailable',
    });
    expect(fsm.confirm).not.toHaveBeenCalled();
    // Each affected voucher line transitioned to reversal_pending via the FSM.
    expect(tenderFsm.markReversalPending).toHaveBeenCalledTimes(1);
    expect(tenderFsm.markReversalPending.mock.calls[0]?.[0]).toMatchObject({
      tender_line_id: 'tl-voucher-1',
      payment_attempt_id: 'pa-1',
    });
    // Audit emits payment.failed AND tender.reversal_pending per line.
    const categories = auditEmitter.captured.map((e) => e.action_category);
    expect(categories).toContain('payment.failed');
    expect(categories).toContain('tender.reversal_pending');
  });

  it('does NOT emit payment.settled when redeem fails', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ envelope_subtotal_minor: 1500 });
    const voucherLine = makeLineRow({
      tender_line_id: 'tl-voucher-1',
      tender_type: 'internal_voucher',
      amount_applied_minor: 1500,
      voucher_redemption_intent_token: 'TOKEN',
      applied_at: '2026-05-25T10:00:01.000Z',
    });
    const auditEmitter = makeAuditEmitterDouble();
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble([voucherLine]),
      paymentAttemptFsm: makePaymentAttemptFsmDouble(),
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter,
      redeemVoucher: makeRedeemVoucherDouble({ kind: 'authority_unreachable' }),
      uuid: () => 'uuid-confirm-v',
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    await handler(validRequest());
    expect(
      auditEmitter.captured.find((e) => e.action_category === 'payment.settled'),
    ).toBeUndefined();
  });

  it('fails the attempt when V-A redeem refuses (e.g., intent_token_expired)', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ envelope_subtotal_minor: 1500 });
    const voucherLine = makeLineRow({
      tender_line_id: 'tl-voucher-1',
      tender_type: 'internal_voucher',
      amount_applied_minor: 1500,
      voucher_redemption_intent_token: 'TOKEN-SECRET',
      applied_at: '2026-05-25T10:00:01.000Z',
    });
    const fsm = makePaymentAttemptFsmDouble();
    const auditEmitter = makeAuditEmitterDouble();
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble([voucherLine]),
      paymentAttemptFsm: fsm,
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter,
      redeemVoucher: makeRedeemVoucherDouble({
        kind: 'refused',
        reason: 'intent_token_expired',
      }),
      uuid: () => 'uuid-confirm-v',
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    const result = await handler(validRequest());
    expect(result).toEqual({ kind: 'refused', reason: 'dependency_unavailable' });
    expect(fsm.fail).toHaveBeenCalledTimes(1);
    expect(fsm.confirm).not.toHaveBeenCalled();
  });

  it('refuses dependency_unavailable when voucher lines exist but redeemVoucher dep is missing (pre-Wave-4)', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ envelope_subtotal_minor: 1500 });
    const voucherLine = makeLineRow({
      tender_line_id: 'tl-voucher-1',
      tender_type: 'internal_voucher',
      amount_applied_minor: 1500,
      voucher_redemption_intent_token: 'TOKEN-SECRET',
      applied_at: '2026-05-25T10:00:01.000Z',
    });
    const fsm = makePaymentAttemptFsmDouble();
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble([voucherLine]),
      paymentAttemptFsm: fsm,
      // tenderLineFsm + redeemVoucher + uuid omitted (pre-Wave-4).
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter: makeAuditEmitterDouble(),
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    expect(await handler(validRequest())).toEqual({
      kind: 'refused',
      reason: 'dependency_unavailable',
    });
    expect(fsm.confirm).not.toHaveBeenCalled();
  });

  // ── 3. FR-017 guard ───────────────────────────────────────────────────────

  it('redemption_intent_token NEVER appears in the bridge response or audit payload', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ envelope_subtotal_minor: 1500 });
    const voucherLine = makeLineRow({
      tender_line_id: 'tl-voucher-1',
      tender_type: 'internal_voucher',
      amount_applied_minor: 1500,
      voucher_redemption_intent_token: 'TOKEN-SECRET-LEAK-TEST',
      applied_at: '2026-05-25T10:00:01.000Z',
    });
    const auditEmitter = makeAuditEmitterDouble();
    const handler = createPaymentsConfirmHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble([voucherLine]),
      paymentAttemptFsm: makePaymentAttemptFsmDouble(),
      tenderLineFsm: makeTenderLineFsmDouble(),
      idempotency: makeIdempotencyHelperDouble(),
      auditEmitter,
      redeemVoucher: makeRedeemVoucherDouble({
        kind: 'redeemed',
        idempotent_replayed: false,
        redeemed_at: '2026-05-25T10:00:05.000Z',
        redemption_id: 'redemption-ABC',
      }),
      uuid: () => 'uuid-confirm-v',
      clock: () => new Date('2026-05-25T10:00:05.000Z'),
    });
    const result = await handler(validRequest());
    expect(JSON.stringify(result)).not.toContain('TOKEN-SECRET-LEAK-TEST');
    for (const evt of auditEmitter.captured) {
      expect(JSON.stringify(evt)).not.toContain('TOKEN-SECRET-LEAK-TEST');
      expect(JSON.stringify(evt)).not.toContain('voucher_redemption_intent_token');
    }
  });
});
