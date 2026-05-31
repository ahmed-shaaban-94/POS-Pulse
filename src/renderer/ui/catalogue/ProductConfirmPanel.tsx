import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react';

import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';
import { formatPriceMinor } from './format-price.js';
import { ControlledFlags } from './ControlledFlags.js';

export interface ProductConfirmPanelProps {
  product?: ProductSnapshotDisplay;
  onAdd?: () => void;
  onCancel?: () => void;
}

/**
 * 009 — Surface 4 (confirm-first panel, FR-5). Presentational: the add flow
 * (005 `cart.lines.add`, FR-20) and the missing-required-field guard
 * (FR-19/22) live in `CatalogueAddController`; controlled/Rx badges via
 * `ControlledFlags` (C1). Nothing is added before the cashier confirms; Add is
 * the primary affordance. Renders nothing when there is no pending product.
 *
 * Keyboard operability (T056 / SC-1): on open, focus moves to the **Add**
 * button so a keyboard-only cashier is never stranded outside this `aria-modal`
 * surface; **Escape** triggers `onCancel`. Tab naturally cycles the two buttons
 * within the dialog. Focus-return to the search input after Add/Cancel is the
 * controller's job (it owns the FSM transition back to idle).
 */
export function ProductConfirmPanel({
  product,
  onAdd,
  onCancel,
}: ProductConfirmPanelProps): JSX.Element | null {
  const addRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open (SC-1) — the primary affordance (Add).
  useEffect(() => {
    addRef.current?.focus();
  }, []);

  if (product === undefined) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel?.();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalogue-confirm-title"
      className="catalogue-confirm"
      data-testid="product-confirm-panel"
      onKeyDown={handleKeyDown}
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
        <button ref={addRef} type="button" className="btn btn--primary btn--md" onClick={onAdd}>
          إضافة (Add)
        </button>
      </div>
    </div>
  );
}
