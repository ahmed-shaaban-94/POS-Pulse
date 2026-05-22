/**
 * T120 — PaymentAttempt FSM (main-process Slice 3 implementation).
 *
 * The 5-state attempt FSM (data-model §"PaymentAttempt"):
 *
 *   started → settled    (via confirm, gated on settlement invariant)
 *   started → cancelled  (via cancel; reverses applied lines LIFO)
 *   started → failed     (via fail; carries a closed FR-006 reason)
 *   started → force_failed (Slice 4 — not implemented here)
 *
 * Each transition writes one row to `payment_action_outbox` in the same
 * SQLite transaction as the state-row update, so a partial write is
 * impossible (Constitution §P4 / §P5; research §R-10). The settlement
 * invariant is evaluated against the canonical SQL aggregate exposed by
 * the tender-lines repository — `Σ amount − COALESCE(change, 0)` over
 * the `applied` lines, equal to `envelope_subtotal_minor`.
 *
 * The FSM does NOT emit audit events. The bridge handlers (S3c) wire
 * each successful transition to the audit emitter — keeping audit
 * emission at the trust-boundary layer (Constitution §VII; advisor
 * note: "audit emitter is NOT injected into FSMs").
 */

import type { DatabaseHandle } from '../../db/client.js';
import type {
  PaymentAttemptsRepository,
  PaymentFailureReason,
} from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLinesRepository } from '../repositories/payment-tender-lines.repository.js';
import type { PaymentActionOutboxRepository } from '../repositories/payment-action-outbox.repository.js';
import { computeActionPayloadHash } from '../repositories/payment-action-outbox.repository.js';
import type { RefusalReason } from '../../../shared/payments/types.js';
import { isLegalPaymentAttemptTransition } from '../../../shared/payments/fsm-types.js';
import { createTenderLineFsm } from './tender-line-fsm.js';

// ── Public types ────────────────────────────────────────────────────────────

export interface PaymentAttemptFsmDependencies {
  db: DatabaseHandle;
  attempts: PaymentAttemptsRepository;
  lines: PaymentTenderLinesRepository;
  outbox: PaymentActionOutboxRepository;
}

export interface StartPaymentAttemptInput {
  payment_attempt_id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  acting_operator_id: string;
  operator_session_id: string;
  envelope_handoff_action_id: string;
  envelope_cart_id: string;
  envelope_subtotal_minor: number;
  started_at: string;
  action_id: string;
}

export interface ConfirmPaymentAttemptInput {
  payment_attempt_id: string;
  settled_at: string;
  action_id: string;
}

export interface CancelPaymentAttemptInput {
  payment_attempt_id: string;
  cancelled_at: string;
  action_id: string;
}

export interface FailPaymentAttemptInput {
  payment_attempt_id: string;
  failed_at: string;
  failure_reason: PaymentFailureReason;
  action_id: string;
}

export type StartOutcome =
  | { kind: 'ok'; payment_attempt_id: string }
  | { kind: 'refused'; reason: RefusalReason };

export type ConfirmOutcome =
  | { kind: 'ok'; settled_at: string }
  | { kind: 'refused'; reason: RefusalReason };

export type CancelOutcome =
  | {
      kind: 'ok';
      cancelled_at: string;
      reversed_tender_line_ids: readonly string[];
      reversal_pending_tender_line_ids: readonly string[];
    }
  | { kind: 'refused'; reason: RefusalReason };

export type FailOutcome =
  | { kind: 'ok'; failed_at: string }
  | { kind: 'refused'; reason: RefusalReason };

export interface PaymentAttemptFsm {
  start(input: StartPaymentAttemptInput): StartOutcome;
  confirm(input: ConfirmPaymentAttemptInput): ConfirmOutcome;
  cancel(input: CancelPaymentAttemptInput): CancelOutcome;
  fail(input: FailPaymentAttemptInput): FailOutcome;
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createPaymentAttemptFsm(deps: PaymentAttemptFsmDependencies): PaymentAttemptFsm {
  const { db, attempts, lines, outbox } = deps;
  const tenderFsm = createTenderLineFsm({ db, attempts, lines, outbox });

  return {
    start(input: StartPaymentAttemptInput): StartOutcome {
      // The partial unique index on (terminal_id) WHERE state='started' is the
      // authoritative guard (R-6) — a race between two main-process callers
      // resolves at SQL. We pre-check to surface the closed refusal reason
      // cleanly without taking a SQL error path.
      const existing = attempts.findStartedByTerminal(input.terminal_id);
      if (existing !== undefined) {
        return { kind: 'refused', reason: 'attempt_already_started_on_terminal' };
      }
      const txn = db.transaction((): StartOutcome => {
        try {
          attempts.insert({
            payment_attempt_id: input.payment_attempt_id,
            tenant_id: input.tenant_id,
            branch_id: input.branch_id,
            terminal_id: input.terminal_id,
            acting_operator_id: input.acting_operator_id,
            operator_session_id: input.operator_session_id,
            envelope_handoff_action_id: input.envelope_handoff_action_id,
            envelope_cart_id: input.envelope_cart_id,
            envelope_subtotal_minor: input.envelope_subtotal_minor,
            started_at: input.started_at,
            last_action_id: input.action_id,
          });
        } catch (err) {
          // Race with another caller — partial unique index fires.
          if (isUniqueViolation(err)) {
            return { kind: 'refused', reason: 'attempt_already_started_on_terminal' };
          }
          throw err;
        }
        const hash = computeActionPayloadHash({
          payment_attempt_id: input.payment_attempt_id,
          envelope_handoff_action_id: input.envelope_handoff_action_id,
          envelope_subtotal_minor: input.envelope_subtotal_minor,
          action_kind: 'payment.attempt.start',
        });
        outbox.insert({
          action_id: input.action_id,
          payment_attempt_id: input.payment_attempt_id,
          tender_line_id: null,
          action_kind: 'payment.attempt.start',
          action_payload_hash: hash,
          acting_operator_id: input.acting_operator_id,
          created_at: input.started_at,
        });
        return { kind: 'ok', payment_attempt_id: input.payment_attempt_id };
      });
      return txn();
    },

    confirm(input: ConfirmPaymentAttemptInput): ConfirmOutcome {
      const row = attempts.findById(input.payment_attempt_id);
      if (row === undefined) {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }
      if (!isLegalPaymentAttemptTransition(row.state, 'settled')) {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }
      const sum = lines.settlementSumMinor(input.payment_attempt_id);
      if (sum < row.envelope_subtotal_minor) {
        return { kind: 'refused', reason: 'tender_underpaid' };
      }
      if (sum > row.envelope_subtotal_minor) {
        // Defence-in-depth — per-line refusals make this unreachable, but the
        // FSM refuses rather than ship a phantom settlement (Constitution §IV).
        return { kind: 'refused', reason: 'internal_error' };
      }
      const txn = db.transaction((): ConfirmOutcome => {
        attempts.updateState({
          payment_attempt_id: input.payment_attempt_id,
          state: 'settled',
          timestamp: input.settled_at,
          last_action_id: input.action_id,
        });
        const hash = computeActionPayloadHash({
          payment_attempt_id: input.payment_attempt_id,
          action_kind: 'payment.confirm',
        });
        outbox.insert({
          action_id: input.action_id,
          payment_attempt_id: input.payment_attempt_id,
          tender_line_id: null,
          action_kind: 'payment.confirm',
          action_payload_hash: hash,
          acting_operator_id: row.acting_operator_id,
          created_at: input.settled_at,
        });
        return { kind: 'ok', settled_at: input.settled_at };
      });
      return txn();
    },

    cancel(input: CancelPaymentAttemptInput): CancelOutcome {
      const row = attempts.findById(input.payment_attempt_id);
      if (row === undefined) {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }
      if (!isLegalPaymentAttemptTransition(row.state, 'cancelled')) {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }
      const lifoIds = tenderFsm.listAppliedLifoIds(input.payment_attempt_id);
      const txn = db.transaction((): CancelOutcome => {
        const reversed: string[] = [];
        const pending: string[] = [];
        for (const tender_line_id of lifoIds) {
          const r = tenderFsm.reverseInTransaction({
            tender_line_id,
            payment_attempt_id: input.payment_attempt_id,
            reversed_at: input.cancelled_at,
            attribution_operator_id: row.acting_operator_id,
            action_id: `${input.action_id}:rev:${tender_line_id}`,
          });
          if (r.kind === 'ok') {
            if (r.state === 'reversed') reversed.push(tender_line_id);
            else pending.push(tender_line_id);
          }
          // Cash / external_card_terminal cannot refuse reverse on the LIFO
          // sweep (they were `applied` by definition). Voucher reverse is a
          // Slice-4 path and won't appear in Slice-3 cancel scope.
        }
        attempts.updateState({
          payment_attempt_id: input.payment_attempt_id,
          state: 'cancelled',
          timestamp: input.cancelled_at,
          last_action_id: input.action_id,
        });
        const hash = computeActionPayloadHash({
          payment_attempt_id: input.payment_attempt_id,
          reversed_tender_line_ids: reversed,
          action_kind: 'payment.cancel',
        });
        outbox.insert({
          action_id: input.action_id,
          payment_attempt_id: input.payment_attempt_id,
          tender_line_id: null,
          action_kind: 'payment.cancel',
          action_payload_hash: hash,
          acting_operator_id: row.acting_operator_id,
          created_at: input.cancelled_at,
        });
        return {
          kind: 'ok',
          cancelled_at: input.cancelled_at,
          reversed_tender_line_ids: reversed,
          reversal_pending_tender_line_ids: pending,
        };
      });
      return txn();
    },

    fail(input: FailPaymentAttemptInput): FailOutcome {
      const row = attempts.findById(input.payment_attempt_id);
      if (row === undefined) {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }
      if (!isLegalPaymentAttemptTransition(row.state, 'failed')) {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }
      const txn = db.transaction((): FailOutcome => {
        attempts.updateState({
          payment_attempt_id: input.payment_attempt_id,
          state: 'failed',
          timestamp: input.failed_at,
          last_action_id: input.action_id,
          failure_reason: input.failure_reason,
        });
        const hash = computeActionPayloadHash({
          payment_attempt_id: input.payment_attempt_id,
          failure_reason: input.failure_reason,
          action_kind: 'payment.fail',
        });
        outbox.insert({
          action_id: input.action_id,
          payment_attempt_id: input.payment_attempt_id,
          tender_line_id: null,
          action_kind: 'payment.fail',
          action_payload_hash: hash,
          acting_operator_id: row.acting_operator_id,
          created_at: input.failed_at,
        });
        return { kind: 'ok', failed_at: input.failed_at };
      });
      return txn();
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const msg = (err as { message?: string }).message ?? '';
  return /UNIQUE|constraint failed/i.test(msg);
}
