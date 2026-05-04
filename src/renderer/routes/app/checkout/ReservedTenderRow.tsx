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
    <div
      data-slot-id={slotId}
      aria-label={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '12px',
        border: '1px dashed #ccc',
        borderRadius: '4px',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</span>
      <span data-slot-body style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
        Reserved for 005-checkout-payments
      </span>
    </div>
  );
}
