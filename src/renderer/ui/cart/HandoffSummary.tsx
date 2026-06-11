/**
 * T089 — HandoffSummary component.
 *
 * Renders the frozen/handed-off state of a sales cart.
 * Consumes a PaymentIntentEnvelope snapshot — read-only, no cart mutations.
 *
 * Security invariants (FR-035):
 *   - No sensitive IDs (cart_id, operator_session_id, etc.) are rendered.
 *   - Discount placeholders are opaque: "Discount applied" only — no magnitude.
 *   - "Continue to payment" is disabled UNTIL the payments feature wires it:
 *     enabled iff an `onContinue` handler is supplied (006-payments). 005 owns
 *     the handoff; the payments feature owns everything downstream.
 *   - No success/paid/complete copy — the cart is sent, not paid.
 */

import type { JSX } from 'react';
import type { PaymentIntentEnvelope } from '../../../shared/cart/handoff-envelope.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * Discriminated union enforcing that `onVoidRequest` is supplied iff
 * `showVoid` is true. TypeScript will refuse a `showVoid: true` prop set
 * without a handler — preventing a silently broken Void affordance from
 * shipping. Manager/admin only — the parent (CartPane) gates on session
 * role per FR-032 (cashier-forbidden post-handoff). When omitted or
 * false, the button is rendered absent, not disabled, so it never
 * enters the tab order or the cashier's awareness.
 *
 * Contact-sheet Surface 8: post-handoff Void sits at the bottom of the
 * frozen summary, subordinate to the disabled "Continue to payment"
 * button — not in the CartPane header.
 */
export type HandoffSummaryVoidProps =
  | { showVoid?: false; onVoidRequest?: never }
  | { showVoid: true; onVoidRequest: () => void };

export type HandoffSummaryProps = {
  envelope: PaymentIntentEnvelope;
  /**
   * 006-payments-tender S1 — when provided, the "Continue to payment" button
   * becomes enabled and invokes this callback. When omitted (default), the
   * button remains disabled (pre-006 behaviour preserved for existing tests).
   */
  onContinue?: () => void;
} & HandoffSummaryVoidProps;

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

export function HandoffSummary(props: HandoffSummaryProps): JSX.Element {
  const { envelope, onContinue } = props;
  return (
    <div className="handoff-summary" data-testid="handoff-summary">
      <div className="handoff-summary__banner" role="status">
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
          disabled={onContinue === undefined}
          aria-disabled={onContinue === undefined ? 'true' : undefined}
          style={{ minHeight: touchTarget.min }}
          onClick={onContinue}
        >
          Continue to payment
        </button>
        {props.showVoid && (
          <button
            type="button"
            className="handoff-summary__void"
            data-testid="cart-void-button"
            data-variant="danger"
            style={{ minHeight: touchTarget.min }}
            onClick={props.onVoidRequest}
          >
            Void (post-handoff)
          </button>
        )}
      </div>

      <div className="handoff-summary__meta">
        <span>Sent at {formatTimestamp(envelope.created_at)}</span>
      </div>
    </div>
  );
}
