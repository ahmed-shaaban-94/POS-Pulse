import type { JSX } from 'react';

import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';

/**
 * 009 T045b (C1) — controlled-substance / prescription-required SURFACING.
 *
 * Display-only awareness badges shared by the confirm panel and the result row.
 * 009 ENFORCES NOTHING — the controlled-substance / prescription workflow is
 * explicitly Out-of-Scope in the spec; these badges only make the cashier aware.
 *
 * Colour-independence (a11y): each badge carries its own text label (not colour
 * alone), so the meaning survives for colour-blind users and in high-contrast
 * mode. Renders nothing when neither flag is set.
 */
export function ControlledFlags({
  product,
  className,
}: {
  product: Pick<ProductSnapshotDisplay, 'controlled_substance' | 'prescription_required'>;
  className?: string;
}): JSX.Element | null {
  if (!product.controlled_substance && !product.prescription_required) return null;
  return (
    <span className={className ?? 'catalogue-flags'}>
      {product.controlled_substance && (
        <span
          className="catalogue-flag catalogue-flag--controlled"
          data-testid="flag-controlled-substance"
        >
          مادة خاضعة للرقابة (controlled)
        </span>
      )}
      {product.prescription_required && (
        <span
          className="catalogue-flag catalogue-flag--rx"
          data-testid="flag-prescription-required"
        >
          بوصفة طبية (Rx)
        </span>
      )}
    </span>
  );
}
