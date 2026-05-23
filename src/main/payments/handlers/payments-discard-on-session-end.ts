/**
 * T138 — `payments.discardOnSessionEnd` (internal handler, Wave H GREEN).
 *
 * Per contracts/bridge-api.md §"payments.discardOnSessionEnd": called
 * by the main process when an operator session ends with a `started`
 * attempt still bound. **NEVER exposed to the renderer** (T142 must
 * NOT register this via contextBridge).
 *
 * Behavioural contract:
 *   1. No-op when the attempt is unknown or already in a terminal state
 *      (idempotency-by-row-state — the operator-session-end signal can
 *      fire multiple times during shutdown).
 *   2. LIFO-reverses every applied tender line (cash + external_card_terminal
 *      in Slice 3; voucher lines deferred to Slice 4's reversal-pending
 *      path).
 *   3. Transitions the attempt to `failed` with reason
 *      `operator_session_terminated`.
 *   4. Emits `tender.reversed` per reversed line + `payment.failed` for
 *      the attempt. Attribution comes from the persisted row's
 *      `acting_operator_id` — there is no live session by construction
 *      (the session has just ended).
 *
 * The factory signature deliberately omits `getCurrentSession` — the
 * type system enforces "no session lookup in this handler" at compile
 * time, preventing a maintenance regression that wires a stale session
 * into a post-session-end action.
 */

import type { PaymentAttemptFsm } from '../fsm/payment-attempt-fsm.js';
import type { TenderLineFsm } from '../fsm/tender-line-fsm.js';
import type { PaymentAuditEmitter } from '../audit-emitter.js';
import type { PaymentAttemptsRepository } from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';

export interface PaymentsDiscardOnSessionEndDeps {
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findById'>;
  linesRepo: Pick<PaymentTenderLinesRepository, 'findByAttempt'>;
  paymentAttemptFsm: Pick<PaymentAttemptFsm, 'fail'>;
  tenderLineFsm: Pick<TenderLineFsm, 'reverse'>;
  auditEmitter: Pick<PaymentAuditEmitter, 'emitTenderReversed' | 'emitPaymentFailed'>;
  uuid: () => string;
  clock: () => Date;
}

export interface DiscardOnSessionEndInput {
  payment_attempt_id: string;
}

export type DiscardOnSessionEndOutcome = { kind: 'noop' } | { kind: 'ok'; failed_at: string };

export type PaymentsDiscardOnSessionEndHandler = (
  input: DiscardOnSessionEndInput,
) => Promise<DiscardOnSessionEndOutcome>;

export function createPaymentsDiscardOnSessionEndHandler(
  deps: PaymentsDiscardOnSessionEndDeps,
): PaymentsDiscardOnSessionEndHandler {
  const { attemptsRepo, linesRepo, paymentAttemptFsm, tenderLineFsm, auditEmitter, uuid, clock } =
    deps;

  return async function paymentsDiscardOnSessionEnd(input): Promise<DiscardOnSessionEndOutcome> {
    const row = attemptsRepo.findById(input.payment_attempt_id);
    if (row === undefined) {
      return await Promise.resolve({ kind: 'noop' });
    }
    if (row.state !== 'started') {
      // Already terminal — the session-end signal must be idempotent.
      return await Promise.resolve({ kind: 'noop' });
    }

    const failed_at = clock().toISOString();

    // LIFO sweep of applied lines. The bridge handler iterates explicitly
    // (rather than delegating to the FSM's cancel sweep) because the
    // post-session-end audit attribution differs from cancel: the operator
    // who ended the session does not exist anymore; the attribution is the
    // attempt's acting_operator_id from the persisted row.
    const lines = linesRepo.findByAttempt(input.payment_attempt_id);
    const applied = [...lines]
      .filter((l) => l.state === 'applied')
      .sort((a, b) => b.apply_order - a.apply_order); // LIFO

    const reversedIds: string[] = [];
    for (const line of applied) {
      const outcome = tenderLineFsm.reverse({
        tender_line_id: line.tender_line_id,
        payment_attempt_id: input.payment_attempt_id,
        reversed_at: failed_at,
        attribution_operator_id: row.acting_operator_id,
        action_id: `${uuid()}:rev:${line.tender_line_id}`,
      });
      if (outcome.kind === 'ok') {
        reversedIds.push(line.tender_line_id);
        auditEmitter.emitTenderReversed({
          tender_line_id: line.tender_line_id,
          payment_attempt_id: input.payment_attempt_id,
          tender_type: line.tender_type,
          reversed_at: outcome.reversed_at,
          attribution_operator_id: row.acting_operator_id,
          tenant_id: row.tenant_id,
          branch_id: row.branch_id,
          originating_terminal_id: row.terminal_id,
          // No live session — session_id is the operator's last-known
          // session for audit-correlation purposes. The row carries this
          // already (operator_session_id is the at-start binding).
          session_id: row.operator_session_id,
          manual_void_required: line.tender_type === 'external_card_terminal',
        });
      }
      // tender_not_yet_supported (voucher) — Slice 3 cannot reverse voucher
      // lines synchronously; the line stays `applied` and the Slice-4
      // deferred-reversal resolver picks it up on app restart.
    }

    const fsmOutcome = paymentAttemptFsm.fail({
      payment_attempt_id: input.payment_attempt_id,
      failed_at,
      failure_reason: 'operator_session_terminated',
      action_id: uuid(),
    });

    if (fsmOutcome.kind === 'refused') {
      // The fail transition can only be refused on an already-terminal
      // attempt, which the row-state guard above rules out. Defence-in-depth:
      // return noop so a race with another writer doesn't surface as a
      // partial discard. The reversed lines stay reversed — that's still
      // safe (no double-charge).
      return await Promise.resolve({ kind: 'noop' });
    }

    auditEmitter.emitPaymentFailed({
      payment_attempt_id: input.payment_attempt_id,
      cart_id: row.envelope_cart_id,
      handoff_action_id: row.envelope_handoff_action_id,
      failed_at: fsmOutcome.failed_at,
      failure_reason: 'operator_session_terminated',
      attribution_operator_id: row.acting_operator_id,
      tenant_id: row.tenant_id,
      branch_id: row.branch_id,
      originating_terminal_id: row.terminal_id,
      session_id: row.operator_session_id,
    });

    // Touch the unused capture so downstream maintenance can swap to a
    // bulk-reverse pattern; the local also serves as documentation that
    // the FSM call doesn't need to know which lines we reversed.
    void reversedIds;

    return await Promise.resolve({ kind: 'ok', failed_at: fsmOutcome.failed_at });
  };
}
