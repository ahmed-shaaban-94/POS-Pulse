import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import { useDebouncedSearch } from '../../stores/useDebouncedSearch.js';

/** Imperative handle: lets a parent return focus to the input (FR-6 recovery). */
export interface ProductSearchInputHandle {
  focus(): void;
}

export interface ProductSearchInputProps {
  /**
   * Fired with the query when a search should run: debounced after typing
   * settles (~150 ms, NFR-3), or immediately when the wedge terminator (Enter)
   * submits (FR-8). The caller drives `catalogueSearchStore.beginSearch` + the
   * `catalogue.search` bridge call. Sub-2-char typed input never fires (FR-16).
   */
  onSearch?: (query: string) => void;
  defaultValue?: string;
  disabled?: boolean;
}

/**
 * 009 Surface 1 — search/scan input. S1 shipped the layout shell; S3 (T037)
 * wires the debounce + scanner-bypass hook:
 *   - typing → `onType` (debounced ~150 ms, min-2-char), and
 *   - Enter  → `onScanSubmit` (immediate; the wedge scanner appends a terminator),
 * both routed through `useDebouncedSearch`. The FSM (`catalogueSearchStore`)
 * holds no timers; the debounce lives here.
 *
 * The input is controlled so the Enter handler reads the live value
 * synchronously (a wedge fires keys + terminator fast; a ref/controlled read
 * avoids a stale-closure submit).
 */
export const ProductSearchInput = forwardRef<ProductSearchInputHandle, ProductSearchInputProps>(
  function ProductSearchInput({ onSearch, defaultValue = '', disabled = false }, ref) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));
    // Hold the hook result as one object (rather than destructuring its methods)
    // so the `@typescript-eslint/unbound-method` rule doesn't flag the extracted
    // handlers — they are `this`-free arrows, but the lint is conservative.
    const search = useDebouncedSearch((q) => onSearch?.(q));

    function handleChange(event: ChangeEvent<HTMLInputElement>): void {
      const next = event.target.value;
      setValue(next);
      search.onType(next);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
      if (event.key === 'Enter') {
        // Wedge terminator (or manual Enter): submit the current value now,
        // bypassing the debounce (FR-8). Preventing default keeps a stray Enter
        // from submitting an enclosing form.
        event.preventDefault();
        search.onScanSubmit(value);
      }
    }

    return (
      <div className="catalogue-search" data-testid="product-search-input">
        <input
          ref={inputRef}
          type="search"
          className="catalogue-search__input"
          dir="rtl"
          aria-label="ابحث عن منتج بالاسم أو امسح الباركود (search products by name or scan a barcode)"
          aria-describedby="catalogue-search-hint"
          placeholder="ابحث بالاسم أو امسح الباركود…"
          autoComplete="off"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <p className="catalogue-search__hint" id="catalogue-search-hint">
          اكتب حرفين على الأقل للبحث بالاسم
        </p>
      </div>
    );
  },
);
