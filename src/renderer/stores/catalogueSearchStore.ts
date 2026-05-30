import { create } from 'zustand';

import type { ProductSnapshotDisplay } from '../../shared/catalogue/product-snapshot.js';

/**
 * 009-product-search-and-barcode-lookup T008 — `catalogueSearchStore` FSM.
 *
 * The renderer-side projection of a product lookup. The main process (the
 * `catalogue.*` bridge) is the source of truth; this store mirrors ONLY
 * bridge-confirmed outcomes (P2) — terminal/result states are reachable solely
 * as a response to an in-flight `searching`, never fabricated renderer-side.
 *
 *   idle ── beginSearch ──► searching ─┬─► results              (≥1 match, FR-11)
 *                                       ├─► not_found            (0 matches, FR-6)
 *                                       ├─► ambiguous            (>1 product/barcode, FR-7)
 *                                       ├─► catalogue_unavailable (empty/missing, FR-24)
 *                                       └─► confirm_pending      (exact one → confirm-first, FR-5)
 *     results ── selectResult ────────────► confirm_pending      (pick a row, then confirm)
 *     confirm_pending ── confirmAdd / cancelConfirm ──► idle
 *     any ── clear ──────────────────────────────────► idle      (too-short / cleared input)
 *
 * Every transition guards on its source state (a stale bridge response that
 * arrives after the state has advanced is a no-op). Debounce (~150 ms,
 * typed-only) + scanner-bypass live in the input layer (S3 / T036–T037); this
 * FSM is input-source-agnostic and holds no timers.
 *
 * The add itself goes through 005's `cart.lines.add` (FR-20) — `confirmAdd`
 * here only clears 009's search state for the next item; it performs no cart
 * mutation.
 */

export type CatalogueSearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: string }
  | { kind: 'results'; items: readonly ProductSnapshotDisplay[]; truncated: boolean }
  | { kind: 'not_found' }
  | { kind: 'ambiguous' }
  | { kind: 'catalogue_unavailable' }
  | { kind: 'confirm_pending'; product: ProductSnapshotDisplay };

export interface CatalogueSearchStore {
  state: CatalogueSearchState;
  /** Start (or supersede) a lookup; any state → searching, carrying the query. */
  beginSearch(query: string): void;
  /** Bridge confirmed ≥1 match; searching → results. */
  resolveResults(items: readonly ProductSnapshotDisplay[], truncated: boolean): void;
  /** Bridge confirmed zero matches; searching → not_found. */
  resolveNotFound(): void;
  /** Bridge confirmed >1 active product for a barcode; searching → ambiguous (FR-7). */
  resolveAmbiguous(): void;
  /** Read model empty / missing / unreadable; searching → catalogue_unavailable (FR-24). */
  resolveCatalogueUnavailable(): void;
  /** Exact lookup matched exactly one active product; searching → confirm_pending (FR-5). */
  resolveSingleMatch(product: ProductSnapshotDisplay): void;
  /** Cashier picks a result row; results → confirm_pending. */
  selectResult(product: ProductSnapshotDisplay): void;
  /** Cashier confirms the add (005 owns the cart mutation); confirm_pending → idle. */
  confirmAdd(): void;
  /** Cashier dismisses the confirm panel; confirm_pending → idle. */
  cancelConfirm(): void;
  /** Cleared / too-short input; any state → idle. */
  clear(): void;
  /** Test-only reset hook — restores the store to its initial state. */
  reset(): void;
}

const INITIAL_STATE: CatalogueSearchState = { kind: 'idle' };

export const useCatalogueSearchStore = create<CatalogueSearchStore>((set) => ({
  state: INITIAL_STATE,
  beginSearch: (query) => {
    set({ state: { kind: 'searching', query } });
  },
  resolveResults: (items, truncated) => {
    set((s) => {
      if (s.state.kind !== 'searching') return s;
      return { state: { kind: 'results', items, truncated } };
    });
  },
  resolveNotFound: () => {
    set((s) => {
      if (s.state.kind !== 'searching') return s;
      return { state: { kind: 'not_found' } };
    });
  },
  resolveAmbiguous: () => {
    set((s) => {
      if (s.state.kind !== 'searching') return s;
      return { state: { kind: 'ambiguous' } };
    });
  },
  resolveCatalogueUnavailable: () => {
    set((s) => {
      if (s.state.kind !== 'searching') return s;
      return { state: { kind: 'catalogue_unavailable' } };
    });
  },
  resolveSingleMatch: (product) => {
    set((s) => {
      if (s.state.kind !== 'searching') return s;
      return { state: { kind: 'confirm_pending', product } };
    });
  },
  selectResult: (product) => {
    set((s) => {
      if (s.state.kind !== 'results') return s;
      return { state: { kind: 'confirm_pending', product } };
    });
  },
  confirmAdd: () => {
    set((s) => {
      if (s.state.kind !== 'confirm_pending') return s;
      return { state: INITIAL_STATE };
    });
  },
  cancelConfirm: () => {
    set((s) => {
      if (s.state.kind !== 'confirm_pending') return s;
      return { state: INITIAL_STATE };
    });
  },
  clear: () => {
    set({ state: INITIAL_STATE });
  },
  reset: () => {
    set({ state: INITIAL_STATE });
  },
}));
