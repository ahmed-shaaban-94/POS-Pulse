/**
 * T134 — `payments.confirm` bridge handler (Wave H GREEN).
 *
 * Confirms a `started` PaymentAttempt by handing control to the FSM,
 * which evaluates the settlement invariant inside one SQLite
 * transaction. On `ok` the handler emits a `payment.settled` audit
 * event with the full tender-line breakdown (AD-9 / R-8).
 *
 * Trust-boundary responsibilities (mirror of payments-start.ts §1–5):
 *
 *   1. Session gate AND attempt-binding gate via `requireOperatorSession`
 *      with the gating projection (tenant_isolation / wrong_owner /
 *      attempt_terminal collapse into the closed RefusalReason enum).
 *   2. Idempotency replay BEFORE the terminal-state guard so a retry of
 *      a previously-successful confirm returns the persisted settled_at,
 *      not `attempt_terminal`.
 *   3. FSM call → refusal pass-through (tender_underpaid / internal_error /
 *      attempt_terminal).
 *   4. Audit `payment.settled` with all applied lines on FSM ok.
 *      `external_reference` redaction lives inside the emitter — the
 *      handler forwards raw row data.
 *
 * SECURITY:
 *   • Replay outcome reconstructed from row state, never from outbox
 *     payload (the outbox is hashed only — R-10).
 *   • Audit emission is the only place `external_reference` would
 *     surface in a payload; the emitter redacts it to `'*****'`.
 *   • Operator attribution comes from the attempt row's
 *     `acting_operator_id`, which 005's handoff bridge stamped from
 *     the trusted main-side session (FR-013).
 */

import { requireOperatorSession } from '../require-operator-session.js';
import type { OperatorSessionForPayments } from '../require-operator-session.js';
import type { PaymentAttemptFsm } from '../fsm/payment-attempt-fsm.js';
import type { IdempotencyHelper } from '../idempotency.js';
import type { EmitTenderLineBreakdown, PaymentAuditEmitter } from '../audit-emitter.js';
import type {
  PaymentAttemptsRepository,
  PaymentAttemptRow,
} from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';
import type {
  PaymentsConfirmRequest,
  PaymentsConfirmResponse,
} from '../../../shared/bridge-api.js';

export interface PaymentsConfirmHandlerDeps {
  getCurrentSession: () => OperatorSessionForPayments | null;
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findById'>;
  linesRepo: Pick<PaymentTenderLinesRepository, 'findByAttempt'>;
  paymentAttemptFsm: Pick<PaymentAttemptFsm, 'confirm'>;
  idempotency: IdempotencyHelper;
  auditEmitter: Pick<PaymentAuditEmitter, 'emitPaymentSettled'>;
  clock: () => Date;
}

export type PaymentsConfirmHandler = (
  req: PaymentsConfirmRequest,
) => Promise<PaymentsConfirmResponse>;

export function createPaymentsConfirmHandler(
  deps: PaymentsConfirmHandlerDeps,
): PaymentsConfirmHandler {
  const {
    getCurrentSession,
    attemptsRepo,
    linesRepo,
    paymentAttemptFsm,
    idempotency,
    auditEmitter,
    clock,
  } = deps;

  return async function paymentsConfirm(req): Promise<PaymentsConfirmResponse> {
    const session = getCurrentSession();
    if (session === null) {
      return await Promise.resolve({ kind: 'refused', reason: 'no_session' });
    }

    const row = attemptsRepo.findById(req.payment_attempt_id);
    if (row === undefined) {
      return await Promise.resolve({ kind: 'refused', reason: 'attempt_terminal' });
    }

    // Idempotency replay is checked BEFORE the terminal-state guard so a
    // retry of a successful confirm returns the persisted settled_at, not
    // `attempt_terminal`. We still need session-level isolation/ownership
    // checks to fire first — a cross-tenant probe of a guessed attempt id
    // must collapse to tenant_isolation, never leak existence through an
    // idempotency check. So: session/isolation gate first, then idempotency,
    // then FSM.
    const gateIsolation = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      attempt: {
        operator_session_id: row.operator_session_id,
        tenant_id: row.tenant_id,
        branch_id: row.branch_id,
        terminal_id: row.terminal_id,
        // Force the non-terminal-state guard to pass for the isolation pass —
        // the real terminal-state decision belongs to the idempotency replay
        // path below + the FSM.
        state: 'started',
      },
    });
    if (gateIsolation.kind === 'refused' && gateIsolation.reason !== 'attempt_terminal') {
      return await Promise.resolve({ kind: 'refused', reason: gateIsolation.reason });
    }

    const reservation = idempotency.checkOrReserve({
      action_id: req.idempotency_key,
      payment_attempt_id: req.payment_attempt_id,
      tender_line_id: null,
      action_kind: 'payment.confirm',
      payload: { payment_attempt_id: req.payment_attempt_id },
      acting_operator_id: row.acting_operator_id,
      created_at: clock().toISOString(),
    });

    if (reservation.kind === 'mismatch') {
      return await Promise.resolve({ kind: 'refused', reason: 'idempotency_payload_mismatch' });
    }

    if (reservation.kind === 'replay') {
      // Reconstruct from row state. The settled_at column is the source of
      // truth — `state='settled'` AND `settled_at IS NOT NULL` always
      // co-occur (data-model §"PaymentAttempt" Invariant 2).
      if (row.state === 'settled' && row.settled_at !== null) {
        return await Promise.resolve({ kind: 'ok', settled_at: row.settled_at });
      }
      // Outbox row exists but row state is not settled — impossible under
      // atomic-transaction guarantees (R-10). Refuse generically.
      return await Promise.resolve({ kind: 'refused', reason: 'internal_error' });
    }

    // Now apply the terminal-state guard. attempt_terminal here is the only
    // legitimate refusal that can fire after the isolation+idempotency
    // checks — replay would have returned above; the row is non-`started`
    // for some other reason (cancelled / failed / force_failed).
    if (row.state !== 'started') {
      return await Promise.resolve({ kind: 'refused', reason: 'attempt_terminal' });
    }

    const settled_at = clock().toISOString();
    const fsmOutcome = paymentAttemptFsm.confirm({
      payment_attempt_id: req.payment_attempt_id,
      settled_at,
      action_id: req.idempotency_key,
    });

    if (fsmOutcome.kind === 'refused') {
      return await Promise.resolve({ kind: 'refused', reason: fsmOutcome.reason });
    }

    // Audit `payment.settled` with the full tender breakdown (AD-9 / R-8).
    // Lines are pulled after the FSM transaction so they reflect the final
    // committed state. Only `applied` lines participate in the breakdown —
    // refused/reversed lines were either non-contributing or rolled back.
    const lines = linesRepo.findByAttempt(req.payment_attempt_id);
    const appliedLines: EmitTenderLineBreakdown[] = lines
      .filter((l) => l.state === 'applied')
      .sort((a, b) => a.apply_order - b.apply_order)
      .map((l) => {
        const breakdown: EmitTenderLineBreakdown = {
          tender_line_id: l.tender_line_id,
          tender_type: l.tender_type,
          amount_applied_minor: l.amount_applied_minor,
          applied_at: l.applied_at ?? settled_at,
          attribution_operator_id: l.attribution_operator_id,
        };
        if (l.change_due_minor !== null) breakdown.change_due_minor = l.change_due_minor;
        if (l.external_reference !== null) breakdown.external_reference = l.external_reference;
        return breakdown;
      });

    auditEmitter.emitPaymentSettled({
      payment_attempt_id: req.payment_attempt_id,
      cart_id: row.envelope_cart_id,
      handoff_action_id: row.envelope_handoff_action_id,
      settled_at: fsmOutcome.settled_at,
      attribution_operator_id: row.acting_operator_id,
      tenant_id: row.tenant_id,
      branch_id: row.branch_id,
      originating_terminal_id: row.terminal_id,
      session_id: session.operator_session_id,
      tender_lines: appliedLines,
    });

    return await Promise.resolve({ kind: 'ok', settled_at: fsmOutcome.settled_at });
  };
}

// Re-export the row type for downstream handlers that depend on the same
// projection (e.g., payments-cancel uses the same gating shape).
export type { PaymentAttemptRow };
