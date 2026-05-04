import type { JSX } from 'react';

import { ReservedTenderRow } from './ReservedTenderRow';
import { ReservedTotalsRow } from './ReservedTotalsRow';

/**
 * T052 — CheckoutPlaceholder
 *
 * US6: Visually reserves the eleven payment-tender slots for future
 * feature 005-checkout-payments. Layout capacity only — zero values,
 * zero callbacks, zero side-effects.
 *
 * Slot order (fixed per contracts/shell-routes.ts + T049):
 *   1. tender.cash        — Cash
 *   2. tender.card        — Card
 *   3. tender.bank-transfer — Bank Transfer
 *   4. tender.voucher     — Gift Voucher
 *   5. tender.insurance   — Insurance
 *   6. tender.split       — Split Tender
 *   7. totals.amount-due  — Amount Due
 *   8. totals.amount-paid — Amount Paid
 *   9. totals.remaining   — Remaining Balance
 *  10. totals.change-due  — Change Due
 *  11. receipt.breakdown  — Receipt Breakdown
 *
 * Hard non-implementation list (003 scope):
 *   No payment logic, totals math, IPC, API, persistence, or printing.
 *   See contracts/shell-routes.ts §"Payment-tender visual reservation".
 */
export function CheckoutPlaceholder(): JSX.Element {
  return (
    <section
      aria-labelledby="checkout-heading"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}
    >
      <h1 id="checkout-heading">Checkout</h1>
      <p>Payment tender slots are reserved for feature 005-checkout-payments.</p>

      {/* Six payment-tender rows */}
      <ReservedTenderRow slotId="tender.cash" label="Cash" />
      <ReservedTenderRow slotId="tender.card" label="Card" />
      <ReservedTenderRow slotId="tender.bank-transfer" label="Bank Transfer" />
      <ReservedTenderRow slotId="tender.voucher" label="Gift Voucher" />
      <ReservedTenderRow slotId="tender.insurance" label="Insurance" />
      <ReservedTenderRow slotId="tender.split" label="Split Tender" />

      {/* Four totals / amount fields */}
      <ReservedTotalsRow slotId="totals.amount-due" label="Amount Due" />
      <ReservedTotalsRow slotId="totals.amount-paid" label="Amount Paid" />
      <ReservedTotalsRow slotId="totals.remaining" label="Remaining Balance" />
      <ReservedTotalsRow slotId="totals.change-due" label="Change Due" />

      {/* Receipt breakdown — last slot, keeps receipt prefix (Plan §"Note B") */}
      <ReservedTotalsRow slotId="receipt.breakdown" label="Receipt Breakdown" />
    </section>
  );
}
