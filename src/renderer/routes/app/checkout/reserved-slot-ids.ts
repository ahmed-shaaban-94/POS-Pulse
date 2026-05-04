/**
 * T052 — Frozen slot ids for the Checkout / Receipt placeholder.
 *
 * These eleven ids are the ONLY surface 003-pos-ui-shell exposes for
 * future feature 005-checkout-payments. They are frozen per
 * contracts/shell-routes.ts and MUST NOT be renamed (additive only).
 *
 * Hard non-implementation list (003 scope):
 *   - No payment logic, totals math, or change calculation.
 *   - No money type, currency formatter, or value-bearing prop.
 *   - No IPC, no API call, no persistence, no printing.
 *
 * Enforced by T049 (order + length) and T051 (no-op guard).
 */

export const reservedSlotIds = [
  'tender.cash',
  'tender.card',
  'tender.bank-transfer',
  'tender.voucher',
  'tender.insurance',
  'tender.split',
  'totals.amount-due',
  'totals.amount-paid',
  'totals.remaining',
  'totals.change-due',
  'receipt.breakdown',
] as const;

/** Union of all frozen slot ids. */
export type ReservedSlotId = (typeof reservedSlotIds)[number];

/**
 * Props for a reserved slot component.
 *
 * Deliberately devoid of value-bearing props. Forbidden:
 *   amount, currency, value, total, paid, due, change,
 *   onSubmit, onChange, onConfirm, onPay.
 *
 * The `label` is a display string (e.g. "Cash", "Amount due") — NEVER a
 * formatted amount. TypeScript (strict) rejects any extra prop.
 */
export type ReservedSlotProps = {
  readonly slotId: ReservedSlotId;
  readonly label: string;
};
