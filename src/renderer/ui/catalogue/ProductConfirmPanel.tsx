import type { JSX } from 'react';

import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';
import { formatPriceMinor } from './format-price.js';
import { ControlledFlags } from './ControlledFlags.js';

export interface ProductConfirmPanelProps {
  product?: ProductSnapshotDisplay;
  onAdd?: () => void;
  onCancel?: () => void;
}

/**
 * 009 Slice S1 layout-only shell — Surface 4 (confirm-first panel, FR-5).
 *
 * Renders the dialog with the product summary + Add/Cancel. The actual add flow
 * (005 `cart.lines.add`, FR-20), the missing-required-field guard (FR-19/22),
 * and controlled/Rx flag surfacing (C1) land in S4 (T045/T045b). Nothing is
 * added before the cashier confirms; Add is the primary affordance. Renders
 * nothing when there is no pending product.
 */
export function ProductConfirmPanel({
  product,
  onAdd,
  onCancel,
}: ProductConfirmPanelProps): JSX.Element | null {
  if (product === undefined) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalogue-confirm-title"
      className="catalogue-confirm"
      data-testid="product-confirm-panel"
    >
      <h2 id="catalogue-confirm-title" className="catalogue-confirm__title">
        تأكيد الإضافة
      </h2>
      <p className="catalogue-confirm__name" dir="rtl">
        {product.display_name_ar}
      </p>
      {product.display_name_en !== undefined && (
        <p className="catalogue-confirm__name-en">{product.display_name_en}</p>
      )}
      <dl className="catalogue-confirm__details">
        <dt>السعر</dt>
        <dd>{formatPriceMinor(product.price_minor)}</dd>
        {product.unit_pack_label !== undefined && (
          <>
            <dt>العبوة</dt>
            <dd>{product.unit_pack_label}</dd>
          </>
        )}
      </dl>
      <ControlledFlags product={product} className="catalogue-confirm__flags" />
      <div className="catalogue-confirm__actions">
        <button type="button" className="btn btn--ghost btn--md" onClick={onCancel}>
          إلغاء (Cancel)
        </button>
        <button type="button" className="btn btn--primary btn--md" onClick={onAdd}>
          إضافة (Add)
        </button>
      </div>
    </div>
  );
}
