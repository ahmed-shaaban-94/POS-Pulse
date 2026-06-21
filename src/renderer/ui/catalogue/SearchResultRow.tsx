import type { JSX } from 'react';

import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';
import { formatPriceMinor } from './format-price.js';
import { ControlledFlags } from './ControlledFlags.js';

export interface SearchResultRowProps {
  product: ProductSnapshotDisplay;
  /** DOM id, referenced by the listbox `aria-activedescendant` (FR-14). */
  id: string;
  active: boolean;
  onSelect: (product: ProductSnapshotDisplay) => void;
}

/**
 * 009 T039 — a single search-result row (FR-17a).
 *
 * Shows the selling data the cashier needs to pick: the Arabic-first name (with
 * the English name as a secondary line when present), the price, the unit/pack
 * label, and the barcode or SKU where useful. It is an `option` inside the
 * list's `listbox`; selection is driven by the parent (Enter on the active row,
 * or a click here) — focus stays on the listbox (aria-activedescendant model),
 * so the row is not itself focusable.
 *
 * ≥ 44×44 touch target via `catalogue-result-row` (003/007 token); RTL on the
 * Arabic name.
 */
export function SearchResultRow({
  product,
  id,
  active,
  onSelect,
}: SearchResultRowProps): JSX.Element {
  // Barcode first (the row is reached via scan or name search where the barcode
  // is the operator's reference), else the SKU. Display-only.
  const code = product.selling_barcode ?? product.sku;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className="catalogue-result-row"
      onClick={() => {
        onSelect(product);
      }}
    >
      <span className="catalogue-result-row__name" dir="rtl">
        {product.display_name_ar}
      </span>
      {product.display_name_en !== undefined && (
        <span className="catalogue-result-row__name-en">{product.display_name_en}</span>
      )}
      <span className="catalogue-result-row__price" dir="ltr">
        {formatPriceMinor(product.price_minor)}
      </span>
      {product.unit_pack_label !== undefined && (
        <span className="catalogue-result-row__pack">{product.unit_pack_label}</span>
      )}
      {code !== undefined && (
        <span className="catalogue-result-row__code" dir="ltr">
          {code}
        </span>
      )}
      <ControlledFlags product={product} className="catalogue-result-row__flags" />
    </div>
  );
}
