/**
 * T089 — HandoffSummary component.
 *
 * Renders the frozen/handed-off state of a sales cart.
 * Consumes a PaymentIntentEnvelope snapshot — read-only, no cart mutations.
 *
 * Security invariants (FR-035):
 *   - No sensitive IDs (cart_id, operator_session_id, etc.) are rendered.
 *   - Discount placeholders are opaque: "Discount applied" only — no magnitude.
 *   - "Continue to payment" button is permanently disabled. 005 owns the
 *     handoff; the future payments feature owns everything downstream.
 *   - No success/paid/complete copy — the cart is sent, not paid.
 */

import type { JSX } from 'react';
import type { PaymentIntentEnvelope } from '../../../shared/cart/handoff-envelope.js';
import { touchTarget } from '../tokens/touch.js';

export interface HandoffSummaryProps {
  envelope: PaymentIntentEnvelope;
}

function formatMinorUnits(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `¤${String(whole)}.${frac}`;
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HandoffSummary({ envelope }: HandoffSummaryProps): JSX.Element {
  return (
    <div className="handoff-summary" data-testid="handoff-summary">
      <div
        className="handoff-summary__banner"
        role="status"
        style={{ background: 'var(--color-success-soft, #e7f5ee)' }}
      >
        <span className="handoff-summary__banner-icon" aria-hidden="true">
          ✓
        </span>
        <span>Cart sent to payment</span>
      </div>

      <div className="handoff-summary__title">Order summary</div>

      <ol className="handoff-summary__line-list" aria-label="Cart items">
        {envelope.lines.map((line) => (
          <li key={line.line_id} className="handoff-summary__line">
            <span className="handoff-summary__line-name">{line.display_name}</span>
            <span className="handoff-summary__line-qty" aria-label="quantity">
              ×{line.quantity}
            </span>
            <span className="handoff-summary__line-subtotal">
              {formatMinorUnits(line.line_subtotal_minor)}
            </span>
            {line.note !== null && <span className="handoff-summary__line-note">{line.note}</span>}
          </li>
        ))}
      </ol>

      {envelope.discount_placeholders.length > 0 && (
        <ul className="handoff-summary__discount-list" aria-label="Discounts">
          {envelope.discount_placeholders.map((dp) => (
            <li key={dp.placeholder_id} className="handoff-summary__discount-row">
              <span>Discount applied</span>
            </li>
          ))}
        </ul>
      )}

      <div className="handoff-summary__footer">
        <div className="handoff-summary__subtotal">
          <span className="handoff-summary__subtotal-label">Subtotal</span>
          <span className="handoff-summary__subtotal-value" data-testid="handoff-subtotal-value">
            {formatMinorUnits(envelope.subtotal_minor)}
          </span>
        </div>
        <button
          type="button"
          className="handoff-summary__continue"
          data-testid="handoff-continue-button"
          disabled
          aria-disabled="true"
          style={{ minHeight: touchTarget.min }}
        >
          Continue to payment
        </button>
      </div>

      <div className="handoff-summary__meta">
        <span>Sent at {formatTimestamp(envelope.created_at)}</span>
      </div>
    </div>
  );
}
