import type { JSX } from 'react';
import type { ReservedSlotProps } from './reserved-slot-ids';

/**
 * T052 — ReservedTenderRow
 *
 * Generic labelled rectangle that visually reserves one of the six
 * payment-tender slots for future feature 005-checkout-payments.
 *
 * Accepts only `slotId` + `label` (ReservedSlotProps). No callbacks,
 * no value-bearing props, no payment logic of any kind.
 *
 * The `data-slot-id` attribute enables deterministic query in tests;
 * `data-slot-body` marks the reserved-body paragraph for T050.
 */
export function ReservedTenderRow({ slotId, label }: ReservedSlotProps): JSX.Element {
  return (
    <div className="reserved-slot reserved-slot--tender" data-slot-id={slotId} aria-label={label}>
      <span className="reserved-slot__label">{label}</span>
      <span className="reserved-slot__body" data-slot-body>
        Reserved for 005-checkout-payments
      </span>
    </div>
  );
}
