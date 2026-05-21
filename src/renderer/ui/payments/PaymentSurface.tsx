import { useState, type JSX } from 'react';

import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import { usePaymentStore } from '../../stores/payment-store.js';
import { OperatorBadge } from '../operator/OperatorBadge.js';
import { TenderSelection, type TenderKind } from './TenderSelection.js';
import { PaymentCartSummary } from './PaymentCartSummary.js';

/**
 * 006-payments-tender S1 — PaymentSurface.
 *
 * Route guard: returns null unless both a signed-in operator session and a
 * non-null payment envelope exist. This prevents the surface from mounting
 * in an inconsistent state.
 *
 * Renderer-only: no bridge calls, no FSM. Main process owns all payment
 * FSM transitions (AD-1). This surface is display + input collection only.
 *
 * Layout:
 *   - Header: OperatorBadge (no operator_id in DOM — display_name + role only).
 *   - Body: TenderSelection + PaymentCartSummary side by side.
 *
 * SECURITY:
 *   - No sensitive IDs in DOM (FR-035).
 *   - No card data (PAN, CVV, cardholder name) of any kind.
 *   - No raw bridge reason strings displayed to cashier.
 *   - Manager identity never in cashier-visible UI.
 */
export function PaymentSurface(): JSX.Element | null {
  const sessionState = useOperatorSessionStore((s) => s.state);
  const envelope = usePaymentStore((s) => s.envelope);
  const [selectedTender, setSelectedTender] = useState<TenderKind | null>(null);

  if (sessionState.kind !== 'signedIn' || envelope === null) {
    return null;
  }

  const { display_name, role } = sessionState.session;

  return (
    <main className="payment-surface" data-testid="payment-surface" aria-label="Payment">
      <header className="payment-surface__header">
        <h2 className="payment-surface__title">Payment</h2>
        <OperatorBadge display_name={display_name} role={role} />
      </header>

      <div className="payment-surface__body">
        <TenderSelection
          envelope={envelope}
          onTenderSelect={(tender) => {
            setSelectedTender(tender);
          }}
        />
        <PaymentCartSummary envelope={envelope} />
      </div>

      {selectedTender !== null && (
        <div
          className="payment-surface__tender-selected"
          data-testid="payment-surface-tender-selected"
          role="status"
          aria-live="polite"
        >
          {selectedTender === 'cash' ? 'Cash selected' : 'Card terminal selected'}
        </div>
      )}
    </main>
  );
}
