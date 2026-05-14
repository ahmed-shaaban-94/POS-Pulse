import type { JSX } from 'react';

import { EmptyCartPlaceholder } from './EmptyCartPlaceholder.js';
import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import { useCartStore } from '../../stores/cart-store.js';
import { CartState } from '../../../shared/cart/cart-state.js';

/**
 * 005-sales-cart S1 / T027 — Cart pane shell.
 *
 * Surface 1 + 2 of the S0 contact sheet, restricted to the empty / no-cart
 * states. Populated states (line-item rows, quantity stepper, void, handoff)
 * land in S2 and beyond, behind their respective gates.
 *
 * Layout: three-region vertical stack per contact sheet §"Layout strategy":
 *   - Header strip (pane label; Void hidden in empty state).
 *   - Scrollable body (empty-state placeholder for S1).
 *   - Footer strip (subtotal placeholder "—"; hand-off disabled).
 *
 * Visibility rules:
 *   - Pane is rendered only when an operator session is signed in.
 *     When signed out, the component returns `null` so the 003 shell
 *     does not leak a cart-shaped region to an unauthenticated screen.
 *   - All interactive controls in this slice are disabled by design
 *     (cart is always empty in S1). The 44 × 44 px touch-target floor
 *     is honored via shared utility CSS.
 *
 * The renderer-side role gate here is a UX defence; the main-process
 * `requireOperatorSession` is the load-bearing trust boundary (AD-1).
 */
export function CartPane(): JSX.Element | null {
  const sessionKind = useOperatorSessionStore((s) => s.state.kind);
  const activeCart = useCartStore((s) => s.activeCart);

  if (sessionKind !== 'signedIn') {
    return null;
  }

  const showEmpty = activeCart === null || activeCart.state === CartState.empty;

  return (
    <section className="cart-pane" data-testid="cart-pane" aria-label="Cart">
      <header className="cart-pane__header">
        <h2 className="cart-pane__title">Cart</h2>
      </header>
      <div className="cart-pane__body">{showEmpty ? <EmptyCartPlaceholder /> : null}</div>
      <footer className="cart-pane__footer">
        <div className="cart-pane__subtotal">
          <span className="cart-pane__subtotal-label">Subtotal</span>
          <span className="cart-pane__subtotal-value" aria-label="subtotal placeholder">
            —
          </span>
        </div>
        <button
          type="button"
          className="cart-pane__handoff"
          disabled
          aria-disabled="true"
          data-testid="cart-handoff-button"
        >
          Hand off to payment
        </button>
      </footer>
    </section>
  );
}
