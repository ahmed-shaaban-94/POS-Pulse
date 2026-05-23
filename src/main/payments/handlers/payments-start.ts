/**
 * T133 — `payments.start` bridge handler (Wave H GREEN).
 *
 * Trust boundary between the renderer and the main process for the
 * "open a payment attempt" intent. The handler is responsible for:
 *
 *   1. Session gate via `requireOperatorSession` (no_session / role_denied).
 *   2. Input shape validation at the bridge boundary
 *      (envelope_version === 'v1'; envelope_subtotal_minor is a safe
 *      non-negative integer per Constitution §II).
 *   3. Idempotency replay via the helper:
 *        • `fresh`    → call FSM, write outbox row on commit.
 *        • `replay`   → reconstruct the original outcome from the
 *                       partial-unique-index probe (started attempt on the
 *                       same terminal whose last_action_id === idempotency_key).
 *        • `mismatch` → refuse with idempotency_payload_mismatch.
 *   4. FSM call with the session-scoped tuple. FSM refusals
 *      (attempt_already_started_on_terminal, invalid_input) pass through
 *      to the response unchanged.
 *   5. NO audit emission. Per FR-025, `payment.*` audit categories fire
 *      on terminal transitions only. `payments.start` is the entry, not
 *      a terminal transition.
 *
 * SECURITY:
 *   • Refusals use the closed RefusalReason enum — no factor-distinguishing
 *     leakage (NFR-003 / PR-2).
 *   • The handler never logs envelope payload fields; the outbox stores
 *     a redacted-and-hashed payload only (R-10).
 *   • Session fields (operator_id, session_id, tenant/branch/terminal)
 *     come from the trusted session source, never from the renderer
 *     request payload (FR-013).
 */

import { requireOperatorSession } from '../require-operator-session.js';
import type { OperatorSessionForPayments } from '../require-operator-session.js';
import type { PaymentAttemptFsm } from '../fsm/payment-attempt-fsm.js';
import type { IdempotencyHelper } from '../idempotency.js';
import type { PaymentAuditEmitter } from '../audit-emitter.js';
import type { PaymentAttemptsRepository } from '../repositories/payment-attempts.repository.js';
import type { PaymentsStartRequest, PaymentsStartResponse } from '../../../shared/bridge-api.js';

export interface PaymentsStartHandlerDeps {
  getCurrentSession: () => OperatorSessionForPayments | null;
  attemptsRepo: Pick<PaymentAttemptsRepository, 'findStartedByTerminal'>;
  paymentAttemptFsm: Pick<PaymentAttemptFsm, 'start'>;
  idempotency: IdempotencyHelper;
  /**
   * Wave-G T100 expects the handler to instantiate the audit emitter
   * dependency even though `payments.start` does not emit (FR-025). The
   * dep is injected so future maintenance keeps the trust-boundary
   * topology uniform across handlers.
   */
  auditEmitter: PaymentAuditEmitter;
  /** Returns a new UUID v4 — production wiring uses `crypto.randomUUID`. */
  uuid: () => string;
  /** Clock for testability — production wiring uses `() => new Date()`. */
  clock: () => Date;
}

export type PaymentsStartHandler = (req: PaymentsStartRequest) => Promise<PaymentsStartResponse>;

export function createPaymentsStartHandler(deps: PaymentsStartHandlerDeps): PaymentsStartHandler {
  const { getCurrentSession, attemptsRepo, paymentAttemptFsm, idempotency, uuid, clock } = deps;

  return async function paymentsStart(req): Promise<PaymentsStartResponse> {
    // 1. Session gate (no attempt yet — no ownership/isolation check).
    const gate = requireOperatorSession({
      session: getCurrentSession(),
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    if (gate.kind === 'refused') {
      return await Promise.resolve({ kind: 'refused', reason: gate.reason });
    }
    const session = gate.session;

    // 2. Input validation. The renderer-facing contract types
    // envelope_version as the literal 'v1', so a value other than 'v1'
    // can only arrive via an out-of-contract caller (e.g., a renderer
    // that bypasses the typed bridge). The runtime check defends against
    // that out-of-contract case; the compile-time invariant is the
    // happy-path guarantee. Cast through `unknown` so eslint's
    // no-unnecessary-condition rule does not collapse the check away
    // (it would, because the static type is the singleton 'v1').
    const envelopeVersionRaw = req.envelope_version as unknown;
    if (envelopeVersionRaw !== 'v1') {
      return await Promise.resolve({ kind: 'refused', reason: 'invalid_input' });
    }
    if (!Number.isSafeInteger(req.envelope_subtotal_minor) || req.envelope_subtotal_minor < 0) {
      return await Promise.resolve({ kind: 'refused', reason: 'invalid_input' });
    }

    const now = clock().toISOString();
    const payment_attempt_id = uuid();

    // 3. Idempotency check. The helper consults the outbox by
    // `action_id = idempotency_key` and returns one of fresh/replay/mismatch.
    const reservation = idempotency.checkOrReserve({
      action_id: req.idempotency_key,
      payment_attempt_id,
      tender_line_id: null,
      action_kind: 'payment.attempt.start',
      payload: {
        envelope_handoff_action_id: req.envelope_handoff_action_id,
        envelope_cart_id: req.envelope_cart_id,
        envelope_subtotal_minor: req.envelope_subtotal_minor,
        envelope_version: req.envelope_version,
      },
      acting_operator_id: session.operator_id,
      created_at: now,
    });

    if (reservation.kind === 'mismatch') {
      return await Promise.resolve({
        kind: 'refused',
        reason: 'idempotency_payload_mismatch',
      });
    }

    if (reservation.kind === 'replay') {
      // Reconstruct the original outcome by probing the partial-unique-index:
      // a started attempt on this terminal whose `last_action_id` matches the
      // idempotency_key is the row this replay refers to. The S3b idempotency
      // contract: "the row is the source of truth".
      const existing = attemptsRepo.findStartedByTerminal(session.terminal_id);
      if (existing !== undefined && existing.last_action_id === req.idempotency_key) {
        return await Promise.resolve({
          kind: 'ok',
          payment_attempt_id: existing.payment_attempt_id,
        });
      }
      // The outbox row exists but no matching started row is queryable — this
      // is a defence-in-depth path. The S3b idempotency module + FSM run
      // both inside one transaction, so a missing started row alongside a
      // committed outbox row is impossible in production. Refuse generically
      // rather than fabricate a response.
      return await Promise.resolve({ kind: 'refused', reason: 'internal_error' });
    }

    // 4. Fresh path — invoke the FSM. The FSM itself opens a SQLite
    // transaction, inserts the attempt row, and writes the outbox row.
    // The helper's `commit()` is owned by the FSM in S3b's design (the
    // FSM does its own outbox.insert), so the handler does NOT call
    // `reservation.commit()` here — that would double-write the outbox.
    const fsmOutcome = paymentAttemptFsm.start({
      payment_attempt_id,
      tenant_id: session.tenant_id,
      branch_id: session.branch_id,
      terminal_id: session.terminal_id,
      acting_operator_id: session.operator_id,
      operator_session_id: session.operator_session_id,
      envelope_handoff_action_id: req.envelope_handoff_action_id,
      envelope_cart_id: req.envelope_cart_id,
      envelope_subtotal_minor: req.envelope_subtotal_minor,
      started_at: now,
      action_id: req.idempotency_key,
    });

    if (fsmOutcome.kind === 'refused') {
      return await Promise.resolve({ kind: 'refused', reason: fsmOutcome.reason });
    }

    return await Promise.resolve({
      kind: 'ok',
      payment_attempt_id: fsmOutcome.payment_attempt_id,
    });
  };
}
