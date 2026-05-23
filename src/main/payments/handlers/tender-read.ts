/**
 * T141 — `tender.read` bridge handler (Wave H GREEN).
 *
 * Single-line projection of `TenderLineRendererView`. The request
 * carries only `tender_line_id`; the handler resolves the bound attempt
 * via `linesRepo.findByLineId` (F-005 — added in S3c per cart pattern)
 * and applies the same tenant/owner isolation as `payments.read`.
 * Reads are NOT terminal-state gated.
 *
 * `line_not_applied` is the refusal when the line id is unknown — same
 * generic envelope as `tender.reverse`, since both surfaces collapse
 * any "we don't have this id" condition to the same closed reason.
 */

import { requireOperatorSession } from '../require-operator-session.js';
import type { OperatorSessionForPayments } from '../require-operator-session.js';
import type { PaymentAttemptsRepository } from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';
import type { TenderReadRequest, TenderReadResponse } from '../../../shared/bridge-api.js';
import { projectTenderLineRendererView } from './projection.js';

export interface TenderReadHandlerDeps {
  getCurrentSession: () => OperatorSessionForPayments | null;
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findById'>;
  linesRepo: Pick<PaymentTenderLinesRepository, 'findByLineId'>;
}

export type TenderReadHandler = (req: TenderReadRequest) => Promise<TenderReadResponse>;

export function createTenderReadHandler(deps: TenderReadHandlerDeps): TenderReadHandler {
  const { getCurrentSession, attemptsRepo, linesRepo } = deps;

  return async function tenderRead(req): Promise<TenderReadResponse> {
    const session = getCurrentSession();
    if (session === null) {
      return await Promise.resolve({ kind: 'refused', reason: 'no_session' });
    }

    const line = linesRepo.findByLineId(req.tender_line_id);
    if (line === undefined) {
      return await Promise.resolve({ kind: 'refused', reason: 'line_not_applied' });
    }

    const row = attemptsRepo.findById(line.payment_attempt_id);
    if (row === undefined) {
      // Defence-in-depth — a tender line without its bound attempt is a
      // schema violation (FK constraint in migration 0014). Refuse generically.
      return await Promise.resolve({ kind: 'refused', reason: 'line_not_applied' });
    }

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      attempt: {
        operator_session_id: row.operator_session_id,
        tenant_id: row.tenant_id,
        branch_id: row.branch_id,
        terminal_id: row.terminal_id,
        // Reads ignore the terminal-state guard.
        state: 'started',
      },
    });
    if (gate.kind === 'refused' && gate.reason !== 'attempt_terminal') {
      return await Promise.resolve({ kind: 'refused', reason: gate.reason });
    }

    return await Promise.resolve({
      kind: 'ok',
      tender_line: projectTenderLineRendererView(line),
    });
  };
}
