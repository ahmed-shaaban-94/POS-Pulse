import { useCallback, useEffect, useRef } from 'react';

/**
 * 009-product-search-and-barcode-lookup T037 — debounce + scanner-bypass.
 *
 * Owns the ~150 ms typed-search debounce (NFR-3) and the wedge-scanner bypass
 * (FR-8). The timer lives HERE, deliberately NOT in `catalogueSearchStore` — the
 * FSM is input-source-agnostic and holds no timers, so the debounce belongs in
 * the input layer.
 *
 *   • `onType(value)`  — debounced. Fires `onSearch(value)` once the input
 *     settles for the window. A value shorter than the 2-char minimum (FR-16)
 *     never fires and CANCELS any pending search (so deleting back below the
 *     minimum, or clearing the field, drops the pending typed search).
 *   • `onScanSubmit(value)` — the terminator (Enter) path. Fires `onSearch`
 *     IMMEDIATELY, with no debounce, and cancels any pending typed search so a
 *     scan never races a stale keystroke.
 *
 * The renderer-side min-length here is defense-in-UX; the bridge re-checks the
 * NORMALIZED length (FR-16) as the load-bearing guard.
 */

/** Typed-search debounce window (NFR-3, ~150 ms). */
export const SEARCH_DEBOUNCE_MS = 150;

/** Minimum query length before a typed name search fires (FR-16). */
const MIN_TYPED_LENGTH = 2;

export interface DebouncedSearch {
  /** Debounced typed-input handler. */
  onType(value: string): void;
  /** Immediate scanner-terminator handler (bypasses debounce). */
  onScanSubmit(value: string): void;
  /** Cancel any pending debounced search (e.g. on unmount or clear). */
  cancel(): void;
}

export function useDebouncedSearch(onSearch: (query: string) => void): DebouncedSearch {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest callback without re-creating the handlers each render.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onType = useCallback(
    (value: string) => {
      cancel();
      // Below the minimum (incl. empty) → no search; the cancel() above already
      // dropped any pending one.
      if (value.length < MIN_TYPED_LENGTH) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onSearchRef.current(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancel],
  );

  const onScanSubmit = useCallback(
    (value: string) => {
      // A scan supersedes any pending typed search and fires immediately.
      cancel();
      onSearchRef.current(value);
    },
    [cancel],
  );

  // Drop a pending timer if the component unmounts mid-window.
  useEffect(() => cancel, [cancel]);

  return { onType, onScanSubmit, cancel };
}
