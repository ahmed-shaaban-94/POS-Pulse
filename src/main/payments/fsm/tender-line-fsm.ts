/**
 * T121 — TenderLine FSM (main-process Slice 3 implementation).
 *
 * Per-tender-type apply rules + reverse helper. Each public method runs
 * inside a single SQLite transaction so a partial write is impossible
 * (data-model §"Migration sequencing" + Constitution §P5). The FSM owns
 * apply_order assignment and LIFO reversal ordering — the bridge handlers
 * (S3c) simply call these methods.
 *
 * **Slice-3 scope.** voucher apply / reverse returns
 * `tender_not_yet_supported`; Slice 4 extends the same module additively.
 *
 * SECURITY (Constitution §P6 / §P7 / §P11):
 *   • No card data is captured at all (the bridge surface itself never
 *     accepts a PAN — `external_reference` is the only non-cash field, and
 *     it is regex-validated to a 0–6 uppercase-alphanumeric token that
 *     cannot represent a PAN).
 *   • Voucher tokens stay main-side; the renderer never sees them.
 */

import type { DatabaseHandle } from '../../db/client.js';
import type {
  PaymentAttemptsRepository,
  PaymentAttemptRow,
} from '../repositories/payment-attempts.repository.js';
import type {
  PaymentTenderLinesRepository,
  PaymentTenderLineRow,
} from '../repositories/payment-tender-lines.repository.js';
import type {
  PaymentActionKind,
  PaymentActionOutboxRepository,
} from '../repositories/payment-action-outbox.repository.js';
import { computeActionPayloadHash } from '../repositories/payment-action-outbox.repository.js';
import type { RefusalReason, TenderType } from '../../../shared/payments/types.js';
import { isLegalTenderLineTransition } from '../../../shared/payments/fsm-types.js';

// ── External-reference regex (data-model §"PaymentTenderLine" Invariant 3) ──

const EXTERNAL_REFERENCE_REGEX = /^[A-Z0-9]{0,6}$/;

// ── Public types ────────────────────────────────────────────────────────────

export interface TenderLineFsmDependencies {
  db: DatabaseHandle;
  attempts: PaymentAttemptsRepository;
  lines: PaymentTenderLinesRepository;
  outbox: PaymentActionOutboxRepository;
}

export interface ApplyTenderLineInput {
  tender_line_id: string;
  payment_attempt_id: string;
  tender_type: TenderType;
  amount_applied_minor: number;
  external_reference?: string;
  voucher_code?: string;
  attribution_operator_id: string;
  applied_at: string;
  action_id: string;
}

export interface ReverseTenderLineInput {
  tender_line_id: string;
  /** Required so the FSM can resolve the bound attempt without a repo extension. */
  payment_attempt_id: string;
  reversed_at: string;
  attribution_operator_id: string;
  action_id: string;
}

export type ApplyOutcome =
  | { kind: 'ok'; tender_line_id: string; applied_at: string; change_due_minor?: number }
  | { kind: 'refused'; reason: RefusalReason };

export type ReverseOutcome =
  | {
      kind: 'ok';
      reversed_at: string;
      state: 'reversed' | 'reversal_pending';
      tender_type: TenderType;
      manual_void_required: boolean;
    }
  | { kind: 'refused'; reason: RefusalReason };

export interface TenderLineFsm {
  apply(input: ApplyTenderLineInput): ApplyOutcome;
  reverse(input: ReverseTenderLineInput): ReverseOutcome;
  /**
   * Non-transactional reverse variant. Used by callers that have already
   * opened an outer transaction (e.g., the PaymentAttempt FSM's cancel
   * path, which iterates LIFO and reverses every applied line within a
   * single SQLite transaction so the attempt and all per-line state move
   * atomically). The caller MUST be inside a db.transaction(...) scope.
   */
  reverseInTransaction(input: ReverseTenderLineInput): ReverseOutcome;
  listAppliedLifoIds(payment_attempt_id: string): readonly string[];
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createTenderLineFsm(deps: TenderLineFsmDependencies): TenderLineFsm {
  const { db, attempts, lines, outbox } = deps;

  function nextApplyOrder(payment_attempt_id: string): number {
    const existing = lines.findByAttempt(payment_attempt_id);
    if (existing.length === 0) return 1;
    return Math.max(...existing.map((l) => l.apply_order)) + 1;
  }

  function computeRemainingBalance(
    attempt: PaymentAttemptRow,
    existing: readonly PaymentTenderLineRow[],
  ): number {
    let appliedNetSum = 0;
    for (const line of existing) {
      if (line.state !== 'applied') continue;
      appliedNetSum += line.amount_applied_minor - (line.change_due_minor ?? 0);
    }
    return attempt.envelope_subtotal_minor - appliedNetSum;
  }

  function findLineRow(
    payment_attempt_id: string,
    tender_line_id: string,
  ): PaymentTenderLineRow | undefined {
    return lines.findByAttempt(payment_attempt_id).find((l) => l.tender_line_id === tender_line_id);
  }

  function writeApplyOutbox(action_kind: PaymentActionKind, input: ApplyTenderLineInput): void {
    const redactedPayload: Record<string, unknown> = {
      tender_line_id: input.tender_line_id,
      payment_attempt_id: input.payment_attempt_id,
      tender_type: input.tender_type,
      amount_applied_minor: input.amount_applied_minor,
    };
    if (input.tender_type === 'external_card_terminal' && input.external_reference !== undefined) {
      // P-VII redaction at the hash boundary so the stored hash cannot encode
      // the raw reference value.
      redactedPayload.external_reference = '*****';
    }
    const hash = computeActionPayloadHash({ ...redactedPayload, action_kind });
    outbox.insert({
      action_id: input.action_id,
      payment_attempt_id: input.payment_attempt_id,
      tender_line_id: input.tender_line_id,
      action_kind,
      action_payload_hash: hash,
      acting_operator_id: input.attribution_operator_id,
      created_at: input.applied_at,
    });
  }

  function preflightReverse(
    input: ReverseTenderLineInput,
  ): { kind: 'ok'; tender_type: TenderType } | { kind: 'refused'; reason: RefusalReason } {
    const row = findLineRow(input.payment_attempt_id, input.tender_line_id);
    if (row === undefined) {
      return { kind: 'refused', reason: 'line_not_applied' };
    }
    if (row.tender_type === 'internal_voucher') {
      return { kind: 'refused', reason: 'tender_not_yet_supported' };
    }
    if (!isLegalTenderLineTransition(row.state, 'reversed')) {
      return { kind: 'refused', reason: 'line_not_applied' };
    }
    return { kind: 'ok', tender_type: row.tender_type };
  }

  function commitReverse(input: ReverseTenderLineInput, tender_type: TenderType): ReverseOutcome {
    lines.updateState({
      tender_line_id: input.tender_line_id,
      state: 'reversed',
      timestamp: input.reversed_at,
      last_action_id: input.action_id,
    });
    const hash = computeActionPayloadHash({
      tender_line_id: input.tender_line_id,
      payment_attempt_id: input.payment_attempt_id,
      action_kind: 'tender.reverse',
    });
    outbox.insert({
      action_id: input.action_id,
      payment_attempt_id: input.payment_attempt_id,
      tender_line_id: input.tender_line_id,
      action_kind: 'tender.reverse',
      action_payload_hash: hash,
      acting_operator_id: input.attribution_operator_id,
      created_at: input.reversed_at,
    });
    return {
      kind: 'ok',
      reversed_at: input.reversed_at,
      state: 'reversed',
      tender_type,
      manual_void_required: tender_type === 'external_card_terminal',
    };
  }

  return {
    apply(input: ApplyTenderLineInput): ApplyOutcome {
      // Defensive amount guard (data-model §"PaymentTenderLine" Invariant 2 /
      // money-math §Constitution II).
      if (!Number.isSafeInteger(input.amount_applied_minor) || input.amount_applied_minor < 0) {
        return { kind: 'refused', reason: 'invalid_input' };
      }

      // Slice-3 voucher gate.
      if (input.tender_type === 'internal_voucher') {
        return { kind: 'refused', reason: 'tender_not_yet_supported' };
      }

      // external_reference regex gate (only on external_card_terminal).
      if (
        input.tender_type === 'external_card_terminal' &&
        input.external_reference !== undefined &&
        !EXTERNAL_REFERENCE_REGEX.test(input.external_reference)
      ) {
        return { kind: 'refused', reason: 'invalid_input' };
      }

      const attempt = attempts.findById(input.payment_attempt_id);
      if (attempt === undefined || attempt.state !== 'started') {
        return { kind: 'refused', reason: 'attempt_terminal' };
      }

      const existing = lines.findByAttempt(input.payment_attempt_id);
      const remaining = computeRemainingBalance(attempt, existing);
      const apply_order = nextApplyOrder(input.payment_attempt_id);

      const txn = db.transaction((): ApplyOutcome => {
        // external_card_terminal exact-only.
        if (input.tender_type === 'external_card_terminal') {
          if (input.amount_applied_minor > remaining) {
            lines.insert({
              tender_line_id: input.tender_line_id,
              payment_attempt_id: input.payment_attempt_id,
              tender_type: 'external_card_terminal',
              amount_applied_minor: input.amount_applied_minor,
              state: 'refused',
              change_due_minor: null,
              external_reference: input.external_reference ?? null,
              voucher_redemption_intent_token: null,
              voucher_authority_redemption_id: null,
              applied_at: null,
              refused_at: input.applied_at,
              reversed_at: null,
              reversal_pending_since: null,
              refusal_reason: 'non_cash_overpayment_refused',
              attribution_operator_id: input.attribution_operator_id,
              apply_order,
              last_action_id: input.action_id,
            });
            writeApplyOutbox('tender.apply', input);
            return { kind: 'refused', reason: 'non_cash_overpayment_refused' };
          }
        }

        // cash: may overpay; change_due_minor handles the overage.
        let change_due_minor: number | null = null;
        if (input.tender_type === 'cash' && input.amount_applied_minor > remaining) {
          change_due_minor = input.amount_applied_minor - remaining;
        }

        lines.insert({
          tender_line_id: input.tender_line_id,
          payment_attempt_id: input.payment_attempt_id,
          tender_type: input.tender_type,
          amount_applied_minor: input.amount_applied_minor,
          state: 'applied',
          change_due_minor,
          external_reference:
            input.tender_type === 'external_card_terminal'
              ? (input.external_reference ?? null)
              : null,
          voucher_redemption_intent_token: null,
          voucher_authority_redemption_id: null,
          applied_at: input.applied_at,
          refused_at: null,
          reversed_at: null,
          reversal_pending_since: null,
          refusal_reason: null,
          attribution_operator_id: input.attribution_operator_id,
          apply_order,
          last_action_id: input.action_id,
        });
        writeApplyOutbox('tender.apply', input);

        const ok: ApplyOutcome = {
          kind: 'ok',
          tender_line_id: input.tender_line_id,
          applied_at: input.applied_at,
        };
        if (change_due_minor !== null && change_due_minor > 0) {
          ok.change_due_minor = change_due_minor;
        }
        return ok;
      });
      return txn();
    },

    reverse(input: ReverseTenderLineInput): ReverseOutcome {
      const preflight = preflightReverse(input);
      if (preflight.kind === 'refused') return preflight;
      const txn = db.transaction((): ReverseOutcome => commitReverse(input, preflight.tender_type));
      return txn();
    },

    reverseInTransaction(input: ReverseTenderLineInput): ReverseOutcome {
      const preflight = preflightReverse(input);
      if (preflight.kind === 'refused') return preflight;
      return commitReverse(input, preflight.tender_type);
    },

    listAppliedLifoIds(payment_attempt_id: string): readonly string[] {
      return lines
        .findByAttempt(payment_attempt_id)
        .filter((l) => l.state === 'applied')
        .sort((a, b) => b.apply_order - a.apply_order)
        .map((l) => l.tender_line_id);
    },
  };
}
