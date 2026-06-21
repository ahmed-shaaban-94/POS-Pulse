import { useEffect, useState, type KeyboardEvent, type JSX } from 'react';

import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';
import { SearchResultRow } from './SearchResultRow.js';

export interface SearchResultListProps {
  items?: readonly ProductSnapshotDisplay[];
  truncated?: boolean;
  /** Called when a row is chosen (Enter on the active row, or a click). */
  onSelect?: (product: ProductSnapshotDisplay) => void;
}

const OPTION_ID_PREFIX = 'catalogue-result-option-';

/**
 * The DOM id of the active option for `aria-activedescendant`. Only called from
 * the populated-listbox branch with a clamped `activeIndex`, so the row is
 * always present; the `?? ''` is an unreachable type-narrowing fallback for
 * `noUncheckedIndexedAccess` and is exempt from coverage.
 */
function activeOptionId(items: readonly { product_id: string }[], activeIndex: number): string {
  /* v8 ignore next */
  const productId = items[activeIndex]?.product_id ?? '';
  return `${OPTION_ID_PREFIX}${productId}`;
}

/**
 * 009 Surface 3 — the ranked, keyboard-navigable result list (FR-14 / FR-17).
 *
 * Keyboard model: `aria-activedescendant` (focus stays on the listbox; the
 * active option is referenced by id) rather than roving tabindex — vertical
 * arrows are RTL-independent and the model fits the type → arrow → Enter flow.
 * ArrowDown/Up move the active option (clamped at the ends), Enter selects it.
 * A click selects directly.
 *
 * Renders a `listbox` of `option`s ONLY when there are results (an empty listbox
 * violates `aria-required-children`); the empty case shows a placeholder. When
 * truncated, a refine hint is shown (FR-17).
 */
export function SearchResultList({
  items = [],
  truncated = false,
  onSelect,
}: SearchResultListProps): JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset the active row whenever the result set changes (a new search), so the
  // selection never points past the end of a shorter list.
  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    // Only ever attached to the populated listbox (the empty case renders a
    // placeholder, not a listbox), so `items` is non-empty here.
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const product = items[activeIndex];
      if (product !== undefined) onSelect?.(product);
    }
  }

  return (
    <div className="catalogue-results" data-testid="search-result-list" dir="rtl">
      {items.length === 0 ? (
        <p className="catalogue-results__empty">لا توجد نتائج لعرضها</p>
      ) : (
        <div
          role="listbox"
          aria-label="نتائج البحث عن المنتجات (product search results)"
          tabIndex={0}
          aria-activedescendant={activeOptionId(items, activeIndex)}
          onKeyDown={handleKeyDown}
        >
          {items.map((product, index) => (
            <SearchResultRow
              key={product.product_id}
              id={`${OPTION_ID_PREFIX}${product.product_id}`}
              product={product}
              active={index === activeIndex}
              onSelect={(p) => onSelect?.(p)}
            />
          ))}
        </div>
      )}
      {truncated && (
        <p className="catalogue-results__refine">عرض أفضل 20 — حسّن البحث لعرض المزيد</p>
      )}
    </div>
  );
}
