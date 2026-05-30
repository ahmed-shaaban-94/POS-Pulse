import type { JSX } from 'react';

export interface ProductSearchInputProps {
  defaultValue?: string;
  disabled?: boolean;
}

/**
 * 009 Slice S1 layout-only shell — Surface 1 (search/scan input).
 *
 * The wedge-ready, RTL Arabic-first input the cashier scans or types into.
 * Debounce (~150 ms, typed-only) + scanner-bypass + `catalogueSearchStore`
 * binding land in S3 (T037); this shell renders the field + the min-length idle
 * hint. Auto-focus on mount is wired when the shell is mounted into the cart
 * shell (S2+).
 */
export function ProductSearchInput({
  defaultValue,
  disabled = false,
}: ProductSearchInputProps): JSX.Element {
  return (
    <div className="catalogue-search" data-testid="product-search-input">
      <input
        type="search"
        className="catalogue-search__input"
        dir="rtl"
        aria-label="ابحث عن منتج بالاسم أو امسح الباركود (search products by name or scan a barcode)"
        aria-describedby="catalogue-search-hint"
        placeholder="ابحث بالاسم أو امسح الباركود…"
        autoComplete="off"
        defaultValue={defaultValue}
        disabled={disabled}
      />
      <p className="catalogue-search__hint" id="catalogue-search-hint">
        اكتب حرفين على الأقل للبحث بالاسم
      </p>
    </div>
  );
}
