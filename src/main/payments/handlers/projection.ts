/**
 * S3c — Shared renderer-projection helpers (FR-017).
 *
 * Consumed by `payments-read.ts`, `payments-subscribe.ts`, and
 * `tender-read.ts`. Centralising the projection here ensures the three
 * read paths return byte-identical shapes for the same row state — the
 * T103 contract test asserts this directly.
 *
 * SECURITY: the projections are the closed allow-list of fields that
 * may cross from main to renderer. Any new field added to the
 * underlying row shape that should NOT cross MUST be explicitly omitted
 * here; the `as` cast at the return statement deliberately uses the
 * narrow renderer-view type rather than the wide row type so a
 * forgotten field surfaces as a TypeScript error.
 */

import type { PaymentAttemptRow } from '../repositories/payment-attempts.repository.js';
import type { PaymentTenderLineRow } from '../repositories/payment-tender-lines.repository.js';
import type {
  PaymentAttemptRendererView,
  RefusalReason,
  TenderLineRendererView,
} from '../../../shared/payments/types.js';

export function projectTenderLineRendererView(line: PaymentTenderLineRow): TenderLineRendererView {
  const view: {
    -readonly [K in keyof TenderLineRendererView]: TenderLineRendererView[K];
  } = {
    tender_line_id: line.tender_line_id,
    tender_type: line.tender_type,
    amount_applied_minor: line.amount_applied_minor,
    state: line.state,
    apply_order: line.apply_order,
  };
  if (line.change_due_minor !== null) view.change_due_minor = line.change_due_minor;
  if (line.external_reference !== null) view.external_reference = line.external_reference;
  if (line.voucher_authority_redemption_id !== null) {
    view.voucher_authority_redemption_id = line.voucher_authority_redemption_id;
  }
  if (line.applied_at !== null) view.applied_at = line.applied_at;
  if (line.refused_at !== null) view.refused_at = line.refused_at;
  if (line.reversed_at !== null) view.reversed_at = line.reversed_at;
  if (line.reversal_pending_since !== null) {
    view.reversal_pending_since = line.reversal_pending_since;
  }
  if (line.refusal_reason !== null) {
    // The DB column is `string | null` (it's a string-typed CHECK column).
    // The renderer view narrows it to the closed RefusalReason enum. The
    // FSM only writes values from that enum, so the cast is safe; the
    // type system catches any future widening at the FSM seam.
    view.refusal_reason = line.refusal_reason as RefusalReason;
  }
  return view;
}

export function projectPaymentAttemptRendererView(
  row: PaymentAttemptRow,
  lines: readonly PaymentTenderLineRow[],
): PaymentAttemptRendererView {
  const tender_lines: readonly TenderLineRendererView[] = [...lines]
    .sort((a, b) => a.apply_order - b.apply_order)
    .map(projectTenderLineRendererView);
  const view: {
    -readonly [K in keyof PaymentAttemptRendererView]: PaymentAttemptRendererView[K];
  } = {
    payment_attempt_id: row.payment_attempt_id,
    state: row.state,
    envelope_subtotal_minor: row.envelope_subtotal_minor,
    started_at: row.started_at,
    tender_lines,
  };
  if (row.settled_at !== null) view.settled_at = row.settled_at;
  if (row.cancelled_at !== null) view.cancelled_at = row.cancelled_at;
  if (row.failed_at !== null) view.failed_at = row.failed_at;
  if (row.force_failed_at !== null) view.force_failed_at = row.force_failed_at;
  return view;
}
