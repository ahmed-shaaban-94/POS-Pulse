import type { JSX } from 'react';

import type { PaymentIntentEnvelope } from '../../../shared/cart/handoff-envelope.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * 006-payments-tender S1 — TenderSelection.
 *
 * Renders the three tender options:
 *   - cash: enabled and selectable.
 *   - external_card_terminal: enabled and selectable.
 *   - internal_voucher: reserved — always visible, always disabled,
 *     with a "(not available)" sub-label per visual-direction spec.
 *
 * Returns null when no envelope is provided (route guard — caller must
 * not mount this component without a valid handoff envelope).
 *
 * SECURITY: no card data, no PAN, no CVV. No sensitive IDs in the DOM.
 */

export type TenderKind = 'cash' | 'external_card_terminal';

export interface TenderSelectionProps {
  envelope: Readonly<PaymentIntentEnvelope> | null;
  onTenderSelect: (tender: TenderKind) => void;
}

export function TenderSelection({
  envelope,
  onTenderSelect,
}: TenderSelectionProps): JSX.Element | null {
  if (envelope === null) {
    return null;
  }

  return (
    <section
      className="tender-selection"
      data-testid="tender-selection"
      aria-label="Select payment method"
    >
      <h3 className="tender-selection__heading">Payment method</h3>

      <div className="tender-selection__options">
        <button
          type="button"
          className="tender-selection__option"
          data-testid="tender-cash"
          aria-label="Cash"
          style={{ minHeight: touchTarget.min }}
          onClick={() => {
            onTenderSelect('cash');
          }}
        >
          <span className="tender-selection__option-label">Cash</span>
        </button>

        <button
          type="button"
          className="tender-selection__option"
          data-testid="tender-external-card"
          aria-label="Card terminal"
          style={{ minHeight: touchTarget.min }}
          onClick={() => {
            onTenderSelect('external_card_terminal');
          }}
        >
          <span className="tender-selection__option-label">Card terminal</span>
        </button>

        {/* Voucher slot — always visible, always reserved for Contract V-A */}
        <button
          type="button"
          className="tender-selection__option tender-selection__option--reserved"
          data-testid="tender-voucher"
          aria-label="Voucher (not available)"
          aria-disabled="true"
          style={{ minHeight: touchTarget.min, opacity: 0.5 }}
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          <span className="tender-selection__option-label">Voucher</span>
          <span className="tender-selection__option-hint" data-testid="tender-voucher-hint">
            (not available)
          </span>
        </button>
      </div>
    </section>
  );
}
