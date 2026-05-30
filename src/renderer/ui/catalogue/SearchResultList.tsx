import type { JSX } from 'react';

import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';
import { formatPriceMinor } from './format-price.js';

export interface SearchResultListProps {
  items?: readonly ProductSnapshotDisplay[];
  truncated?: boolean;
  selectedIndex?: number;
}

/**
 * 009 Slice S1 layout-only shell — Surface 3 (result list + rows).
 *
 * Renders a `listbox` of `option`s ONLY when there are results (an empty
 * listbox would violate `aria-required-children`); the empty case shows a
 * placeholder instead. Keyboard navigation (arrow/Enter) and the full row
 * content (controlled/Rx badges, barcode/SKU) land in S3 (T038/T039); this
 * shell renders the core row — Arabic-first name, English fallback, price,
 * unit/pack — plus the refine hint when truncated.
 */
export function SearchResultList({
  items = [],
  truncated = false,
  selectedIndex,
}: SearchResultListProps): JSX.Element {
  return (
    <div className="catalogue-results" data-testid="search-result-list">
      {items.length === 0 ? (
        <p className="catalogue-results__empty">لا توجد نتائج لعرضها</p>
      ) : (
        <div role="listbox" aria-label="نتائج البحث عن المنتجات (product search results)">
          {items.map((product, index) => (
            <div
              key={product.product_id}
              role="option"
              aria-selected={selectedIndex === index}
              className="catalogue-result-row"
            >
              <span className="catalogue-result-row__name" dir="rtl">
                {product.display_name_ar}
              </span>
              {product.display_name_en !== undefined && (
                <span className="catalogue-result-row__name-en">{product.display_name_en}</span>
              )}
              <span className="catalogue-result-row__price">
                {formatPriceMinor(product.price_minor)}
              </span>
              {product.unit_pack_label !== undefined && (
                <span className="catalogue-result-row__pack">{product.unit_pack_label}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {truncated && (
        <p className="catalogue-results__refine">عرض أفضل 20 — حسّن البحث لعرض المزيد</p>
      )}
    </div>
  );
}
