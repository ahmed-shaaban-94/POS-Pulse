/**
 * T073 — 006 Slice 3b FSM-helper types (compile-time transition matrix).
 *
 * Encodes the legal transitions for the PaymentAttempt FSM (5 states) and
 * the TenderLine FSM (5 states) at the type-level **and** as a runtime
 * lookup table. Two consumers:
 *
 *   • `src/main/payments/fsm/payment-attempt-fsm.ts` and
 *     `tender-line-fsm.ts` use this module to refuse illegal transitions
 *     deterministically (runtime invariant per data-model.md §"Invariant 1"
 *     and §"TenderLine state FSM").
 *
 *   • Tests assert the matrix is exhaustive (every legal transition listed,
 *     every illegal pair refused) — see T083 + T087.
 *
 * The matrix is intentionally readable as a 2-D map so reviewers can diff
 * a single edge instead of decoding code. Constitution §IV / §V.
 */

import type { PaymentAttemptState, TenderLineState } from './types.js';

// ── PaymentAttempt FSM ───────────────────────────────────────────────────────

/**
 * For every source state, the closed set of legal target states. An empty
 * set means the state is terminal — no further mutation is permitted
 * (data-model §"PaymentAttempt" Invariant 1).
 */
export const PAYMENT_ATTEMPT_LEGAL_TRANSITIONS: Readonly<
  Record<PaymentAttemptState, ReadonlyArray<PaymentAttemptState>>
> = Object.freeze({
  started: ['settled', 'cancelled', 'failed', 'force_failed'] as const,
  // Terminal states.
  settled: [] as const,
  cancelled: [] as const,
  failed: [] as const,
  force_failed: [] as const,
});

export function isLegalPaymentAttemptTransition(
  from: PaymentAttemptState,
  to: PaymentAttemptState,
): boolean {
  return PAYMENT_ATTEMPT_LEGAL_TRANSITIONS[from].includes(to);
}

// ── TenderLine FSM ───────────────────────────────────────────────────────────

/**
 * TenderLine FSM legal transitions per research §R-11.
 *
 *   applying          → applied | refused
 *   applied           → reversed | reversal_pending
 *   reversal_pending  → reversed                  (Slice 4 deferred resolver)
 *   refused           → (terminal)
 *   reversed          → (terminal)
 *
 * Slice 3 owns `applying → applied|refused` and `applied → reversed`.
 * Slice 4 adds `applied → reversal_pending` and `reversal_pending → reversed`.
 * They are listed here so the FSM can refuse illegal transitions in both
 * slices via the same module.
 */
export const TENDER_LINE_LEGAL_TRANSITIONS: Readonly<
  Record<TenderLineState, ReadonlyArray<TenderLineState>>
> = Object.freeze({
  applying: ['applied', 'refused'] as const,
  applied: ['reversed', 'reversal_pending'] as const,
  reversal_pending: ['reversed'] as const,
  // Terminal states.
  refused: [] as const,
  reversed: [] as const,
});

export function isLegalTenderLineTransition(from: TenderLineState, to: TenderLineState): boolean {
  return TENDER_LINE_LEGAL_TRANSITIONS[from].includes(to);
}
