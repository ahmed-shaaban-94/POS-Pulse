import type { JSX } from 'react';

/**
 * 005-sales-cart S1 / T028 — Empty cart placeholder.
 *
 * Surface 1 of the S0 contact sheet (`Empty cart pane`). Renders inside
 * `CartPane` when there is no active cart or the active cart is in the
 * `empty` state.
 *
 * Copy: generic, pharmacy-POS appropriate. No shift totals, drawer cash,
 * reports, KPIs, or any other cashier-forbidden information surfaces.
 *
 * Tokens: `--color-surface-sunken` for the placeholder tint, `--color-text-muted`
 * for the body copy. No new tokens introduced.
 */
export function EmptyCartPlaceholder(): JSX.Element {
  return (
    <div className="cart-empty-placeholder" data-testid="cart-empty-placeholder" aria-live="polite">
      <p className="cart-empty-placeholder__body">Add items to begin</p>
    </div>
  );
}
