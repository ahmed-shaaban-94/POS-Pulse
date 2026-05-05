import type { JSX } from 'react';
import type { ReservedSlotProps } from './reserved-slot-ids';

/**
 * T052 — ReservedTotalsRow
 *
 * Generic labelled rectangle that visually reserves one of the four
 * amount-totals fields (amount due, amount paid, remaining, change due)
 * or the receipt breakdown row for future feature 005-checkout-payments.
 *
 * Same prop shape as ReservedTenderRow: only `slotId` + `label`.
 * No callbacks, no value-bearing props, no payment logic.
 *
 * The `data-slot-id` attribute enables deterministic query in tests;
 * `data-slot-body` marks the reserved-body paragraph for T050.
 */
export function ReservedTotalsRow({ slotId, label }: ReservedSlotProps): JSX.Element {
  return (
    <div className="reserved-slot reserved-slot--totals" data-slot-id={slotId} aria-label={label}>
      <span className="reserved-slot__label">{label}</span>
      <span className="reserved-slot__body" data-slot-body>
        Reserved for 005-checkout-payments
      </span>
    </div>
  );
}
