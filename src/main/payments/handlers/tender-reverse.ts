/**
 * T140 — `tender.reverse` bridge handler (Wave H GREEN).
 *
 * Reverses an `applied` tender line. The request carries only
 * `tender_line_id` + `idempotency_key`; the handler resolves the bound
 * attempt via `linesRepo.findByLineId` (F-005) to apply the tenant /
 * owner / terminal-state gate.
 *
 * The TenderLine FSM owns the per-tender-type reverse rules:
 *   • cash                    → state='reversed'; manual_void_required=false
 *   • external_card_terminal  → state='reversed'; manual_void_required=true
 *   • internal_voucher        → returns tender_not_yet_supported in Slice 3
 *
 * Audit emission policy (T106):
 *   • FSM ok                  → emit `tender.reversed`
 *   • FSM refused             → NO audit (the line wasn't transitioned)
 */

import { requireOperatorSession } from '../require-operator-session.js';
import type { OperatorSessionForPayments } from '../require-operator-session.js';
import type { TenderLineFsm } from '../fsm/tender-line-fsm.js';
import type { IdempotencyHelper } from '../idempotency.js';
import type { PaymentAuditEmitter } from '../audit-emitter.js';
import type { PaymentAttemptsRepository } from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';
import type { TenderReverseRequest, TenderReverseResponse } from '../../../shared/bridge-api.js';

export interface TenderReverseHandlerDeps {
  getCurrentSession: () => OperatorSessionForPayments | null;
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findById'>;
  linesRepo: Pick<PaymentTenderLinesRepository, 'findByLineId'>;
  tenderLineFsm: Pick<TenderLineFsm, 'reverse'>;
  idempotency: IdempotencyHelper;
  auditEmitter: Pick<PaymentAuditEmitter, 'emitTenderReversed'>;
  clock: () => Date;
}

export type TenderReverseHandler = (req: TenderReverseRequest) => Promise<TenderReverseResponse>;

export function createTenderReverseHandler(deps: TenderReverseHandlerDeps): TenderReverseHandler {
  const {
    getCurrentSession,
    attemptsRepo,
    linesRepo,
    tenderLineFsm,
    idempotency,
    auditEmitter,
    clock,
  } = deps;

  return async function tenderReverse(req): Promise<TenderReverseResponse> {
    const session = getCurrentSession();
    if (session === null) {
      return await Promise.resolve({ kind: 'refused', reason: 'no_session' });
    }

    const line = linesRepo.findByLineId(req.tender_line_id);
    if (line === undefined) {
      return await Promise.resolve({ kind: 'refused', reason: 'line_not_applied' });
    }

    const attempt = attemptsRepo.findById(line.payment_attempt_id);
    if (attempt === undefined) {
      // FK violation — defence-in-depth (migration 0014 declares the FK).
      return await Promise.resolve({ kind: 'refused', reason: 'line_not_applied' });
    }

    // Reverse is allowed on attempts whose state is `started` (cashier
    // changed their mind mid-tender). We pass `state: 'started'` to the
    // gating helper so isolation+ownership fire normally; if the real row
    // is in a terminal state we still want to allow reverse-on-cancel
    // through the FSM's own line-state check, which refuses
    // `line_not_applied` if the line itself isn't reversible.
    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      attempt: {
        operator_session_id: attempt.operator_session_id,
        tenant_id: attempt.tenant_id,
        branch_id: attempt.branch_id,
        terminal_id: attempt.terminal_id,
        state: 'started',
      },
    });
    if (gate.kind === 'refused' && gate.reason !== 'attempt_terminal') {
      return await Promise.resolve({ kind: 'refused', reason: gate.reason });
    }

    const now = clock().toISOString();

    const reservation = idempotency.checkOrReserve({
      action_id: req.idempotency_key,
      payment_attempt_id: line.payment_attempt_id,
      tender_line_id: req.tender_line_id,
      action_kind: 'tender.reverse',
      payload: {
        tender_line_id: req.tender_line_id,
        payment_attempt_id: line.payment_attempt_id,
      },
      acting_operator_id: session.operator_id,
      created_at: now,
    });

    if (reservation.kind === 'mismatch') {
      return await Promise.resolve({ kind: 'refused', reason: 'idempotency_payload_mismatch' });
    }

    if (reservation.kind === 'replay') {
      if (
        (line.state === 'reversed' || line.state === 'reversal_pending') &&
        line.reversed_at !== null
      ) {
        return await Promise.resolve({
          kind: 'ok',
          reversed_at: line.reversed_at,
          state: line.state,
        });
      }
      // Replay-but-no-reverse: line is still applied → outbox row exists
      // but FSM call didn't transition the state. Refuse generically.
      return await Promise.resolve({ kind: 'refused', reason: 'internal_error' });
    }

    const fsmOutcome = tenderLineFsm.reverse({
      tender_line_id: req.tender_line_id,
      payment_attempt_id: line.payment_attempt_id,
      reversed_at: now,
      attribution_operator_id: session.operator_id,
      action_id: req.idempotency_key,
    });

    if (fsmOutcome.kind === 'refused') {
      return await Promise.resolve({ kind: 'refused', reason: fsmOutcome.reason });
    }

    auditEmitter.emitTenderReversed({
      tender_line_id: req.tender_line_id,
      payment_attempt_id: line.payment_attempt_id,
      tender_type: fsmOutcome.tender_type,
      reversed_at: fsmOutcome.reversed_at,
      attribution_operator_id: session.operator_id,
      tenant_id: attempt.tenant_id,
      branch_id: attempt.branch_id,
      originating_terminal_id: attempt.terminal_id,
      session_id: session.operator_session_id,
      manual_void_required: fsmOutcome.manual_void_required,
    });

    return await Promise.resolve({
      kind: 'ok',
      reversed_at: fsmOutcome.reversed_at,
      state: fsmOutcome.state,
    });
  };
}
