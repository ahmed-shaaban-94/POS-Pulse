/**
 * T137 — `payments.read` bridge handler (Wave H GREEN).
 *
 * One-shot read of the renderer-minimised projection for a
 * PaymentAttempt (FR-017, contracts/bridge-api.md §"payments.read").
 * Returns the same shape as `payments.subscribe`; in Slice 3 the seam
 * is one-shot Promise<...> for both.
 *
 * Reads are tenant-/owner-isolated but NOT attempt-terminal-gated — a
 * settled / cancelled / failed attempt is still readable so the
 * receipt-handoff UX (AD-9) can render the final state.
 *
 * SECURITY (FR-017 minimisation):
 *   • The projection NEVER contains voucher_redemption_intent_token,
 *     voucher_code, attribution_operator_id, last_action_id, or any
 *     other server-side audit field. The renderer-facing
 *     TenderLineRendererView / PaymentAttemptRendererView shapes are
 *     the closed allow-list (src/shared/payments/types.ts).
 *   • `external_reference` MAY appear (it is the cashier's own input,
 *     regex-validated to ≤6 uppercase alphanumeric — cannot represent
 *     a PAN). Audit-log redaction is the load-bearing layer (R-5);
 *     the renderer projection passes through.
 */

import { requireOperatorSession } from '../require-operator-session.js';
import type { OperatorSessionForPayments } from '../require-operator-session.js';
import type { PaymentAttemptsRepository } from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';
import type { PaymentsReadRequest, PaymentsReadResponse } from '../../../shared/bridge-api.js';
import { projectPaymentAttemptRendererView } from './projection.js';

export interface PaymentsReadHandlerDeps {
  getCurrentSession: () => OperatorSessionForPayments | null;
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findById'>;
  linesRepo: Pick<PaymentTenderLinesRepository, 'findByAttempt'>;
}

export type PaymentsReadHandler = (req: PaymentsReadRequest) => Promise<PaymentsReadResponse>;

export function createPaymentsReadHandler(deps: PaymentsReadHandlerDeps): PaymentsReadHandler {
  const { getCurrentSession, attemptsRepo, linesRepo } = deps;

  return async function paymentsRead(req): Promise<PaymentsReadResponse> {
    const session = getCurrentSession();
    if (session === null) {
      return await Promise.resolve({ kind: 'refused', reason: 'no_session' });
    }

    const row = attemptsRepo.findById(req.payment_attempt_id);
    if (row === undefined) {
      return await Promise.resolve({ kind: 'refused', reason: 'attempt_terminal' });
    }

    // Reads are isolation/owner gated but NOT terminal-state gated. Pass
    // `state: 'started'` to the helper so the non-terminal guard always
    // passes; isolation + ownership decisions still fire.
    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      attempt: {
        operator_session_id: row.operator_session_id,
        tenant_id: row.tenant_id,
        branch_id: row.branch_id,
        terminal_id: row.terminal_id,
        state: 'started',
      },
    });
    if (gate.kind === 'refused' && gate.reason !== 'attempt_terminal') {
      return await Promise.resolve({ kind: 'refused', reason: gate.reason });
    }

    const lines = linesRepo.findByAttempt(req.payment_attempt_id);
    return await Promise.resolve({
      kind: 'ok',
      payment_attempt: projectPaymentAttemptRendererView(row, lines),
    });
  };
}
