/**
 * T136 — `payments.subscribe` bridge handler (Wave H GREEN).
 *
 * In Slice 3 the typed seam is `Promise<PaymentsSubscribeResponse>` —
 * a one-shot read identical to `payments.read`. Any future push-stream
 * mechanism would land on a separate channel + `webContents.send`; the
 * Slice-3 contract is "subscribe ≡ read" (T103 asserts byte-identical
 * projection for the same attempt id).
 *
 * This module reuses the projection helpers in `projection.ts` so the
 * read and subscribe handlers cannot drift in shape.
 */

import { requireOperatorSession } from '../require-operator-session.js';
import type { OperatorSessionForPayments } from '../require-operator-session.js';
import type { PaymentAttemptsRepository } from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';
import type {
  PaymentsSubscribeRequest,
  PaymentsSubscribeResponse,
} from '../../../shared/bridge-api.js';
import { projectPaymentAttemptRendererView } from './projection.js';

export interface PaymentsSubscribeHandlerDeps {
  getCurrentSession: () => OperatorSessionForPayments | null;
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findById'>;
  linesRepo: Pick<PaymentTenderLinesRepository, 'findByAttempt'>;
}

export type PaymentsSubscribeHandler = (
  req: PaymentsSubscribeRequest,
) => Promise<PaymentsSubscribeResponse>;

export function createPaymentsSubscribeHandler(
  deps: PaymentsSubscribeHandlerDeps,
): PaymentsSubscribeHandler {
  const { getCurrentSession, attemptsRepo, linesRepo } = deps;

  return async function paymentsSubscribe(req): Promise<PaymentsSubscribeResponse> {
    const session = getCurrentSession();
    if (session === null) {
      return await Promise.resolve({ kind: 'refused', reason: 'no_session' });
    }

    const row = attemptsRepo.findById(req.payment_attempt_id);
    if (row === undefined) {
      return await Promise.resolve({ kind: 'refused', reason: 'attempt_terminal' });
    }

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
