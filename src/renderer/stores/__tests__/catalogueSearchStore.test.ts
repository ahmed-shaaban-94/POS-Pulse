import { afterEach, describe, expect, it } from 'vitest';

import { useCatalogueSearchStore } from '../catalogueSearchStore.js';
import type { ProductSnapshotDisplay } from '../../../shared/catalogue/product-snapshot.js';

/**
 * 009-product-search-and-barcode-lookup T007 — `catalogueSearchStore` 7-state FSM.
 *
 * The renderer-side projection of a lookup. It mirrors ONLY bridge-confirmed
 * outcomes (P2): result/terminal states are reachable solely as a response to
 * an in-flight search (`searching`), never fabricated. The seven states map 1:1
 * to the spec's outcomes (research §R8):
 *
 *   idle ─ beginSearch ─► searching ─┬─► results            (≥1 match, FR-11)
 *                                     ├─► not_found          (0 matches, FR-6)
 *                                     ├─► ambiguous          (>1 product/barcode, FR-7)
 *                                     ├─► catalogue_unavailable (empty/missing, FR-24)
 *                                     └─► confirm_pending    (exact one → confirm-first, FR-5)
 *           results ─ selectResult ─────► confirm_pending    (pick a row, then confirm)
 *           confirm_pending ─ confirmAdd / cancelConfirm ──► idle
 *           any ─ clear ─────────────────────────────────► idle (too-short / cleared input)
 *
 * Debounce (~150 ms typed-only) + scanner-bypass wiring are S3 (T036/T037);
 * this FSM core is input-source-agnostic.
 */

const SAMPLE_PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-1',
  display_name_ar: 'بنادول 500',
  price_minor: 1500,
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

const OTHER_PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-2',
  display_name_ar: 'أسبرين',
  price_minor: 800,
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

afterEach(() => {
  useCatalogueSearchStore.getState().reset();
});

describe('catalogueSearchStore FSM (T007)', () => {
  it('starts in idle', () => {
    expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
  });

  it('idle → searching carries the query', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('بناد');
    const state = useCatalogueSearchStore.getState().state;
    expect(state.kind).toBe('searching');
    if (state.kind === 'searching') {
      expect(state.query).toBe('بناد');
    }
  });

  it('searching → results carries items + truncated flag', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('بناد');
    store.resolveResults([SAMPLE_PRODUCT, OTHER_PRODUCT], true);
    const state = useCatalogueSearchStore.getState().state;
    expect(state.kind).toBe('results');
    if (state.kind === 'results') {
      expect(state.items).toHaveLength(2);
      expect(state.truncated).toBe(true);
    }
  });

  it('searching → not_found', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('zzz');
    store.resolveNotFound();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('not_found');
  });

  it('searching → ambiguous', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('6221000000000');
    store.resolveAmbiguous();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('ambiguous');
  });

  it('searching → catalogue_unavailable', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('بناد');
    store.resolveCatalogueUnavailable();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('catalogue_unavailable');
  });

  it('searching → confirm_pending on an exact single match (confirm-first, FR-5)', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('6221000000001');
    store.resolveSingleMatch(SAMPLE_PRODUCT);
    const state = useCatalogueSearchStore.getState().state;
    expect(state.kind).toBe('confirm_pending');
    if (state.kind === 'confirm_pending') {
      expect(state.product.product_id).toBe('p-1');
    }
  });

  it('results → confirm_pending when a row is selected', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('asp');
    store.resolveResults([SAMPLE_PRODUCT, OTHER_PRODUCT], false);
    store.selectResult(OTHER_PRODUCT);
    const state = useCatalogueSearchStore.getState().state;
    expect(state.kind).toBe('confirm_pending');
    if (state.kind === 'confirm_pending') {
      expect(state.product.product_id).toBe('p-2');
    }
  });

  it('confirm_pending → idle on confirmAdd', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('6221000000001');
    store.resolveSingleMatch(SAMPLE_PRODUCT);
    store.confirmAdd();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
  });

  it('confirm_pending → idle on cancelConfirm', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('6221000000001');
    store.resolveSingleMatch(SAMPLE_PRODUCT);
    store.cancelConfirm();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
  });

  it('clear returns to idle from any state (too-short / cleared input)', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('بناد');
    store.resolveResults([SAMPLE_PRODUCT], false);
    store.clear();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
  });

  it('a new beginSearch supersedes any state (e.g. a scan during confirm)', () => {
    const store = useCatalogueSearchStore.getState();
    store.beginSearch('6221000000001');
    store.resolveSingleMatch(SAMPLE_PRODUCT);
    store.beginSearch('6221000000002');
    const state = useCatalogueSearchStore.getState().state;
    expect(state.kind).toBe('searching');
    if (state.kind === 'searching') {
      expect(state.query).toBe('6221000000002');
    }
  });

  describe('mirrors-only-bridge-confirmed — out-of-graph transitions are no-ops (P2)', () => {
    it('resolveResults while idle is a no-op (cannot fabricate results)', () => {
      const store = useCatalogueSearchStore.getState();
      store.resolveResults([SAMPLE_PRODUCT], false);
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    it('selectResult while idle is a no-op', () => {
      const store = useCatalogueSearchStore.getState();
      store.selectResult(SAMPLE_PRODUCT);
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    it('resolveSingleMatch while in results is a no-op (only from searching)', () => {
      const store = useCatalogueSearchStore.getState();
      store.beginSearch('asp');
      store.resolveResults([SAMPLE_PRODUCT], false);
      store.resolveSingleMatch(OTHER_PRODUCT);
      expect(useCatalogueSearchStore.getState().state.kind).toBe('results');
    });

    it('confirmAdd while idle is a no-op', () => {
      const store = useCatalogueSearchStore.getState();
      store.confirmAdd();
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    it('resolveNotFound while idle is a no-op (only from searching)', () => {
      const store = useCatalogueSearchStore.getState();
      store.resolveNotFound();
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    it('resolveAmbiguous while idle is a no-op (only from searching)', () => {
      const store = useCatalogueSearchStore.getState();
      store.resolveAmbiguous();
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    it('resolveCatalogueUnavailable while idle is a no-op (only from searching)', () => {
      const store = useCatalogueSearchStore.getState();
      store.resolveCatalogueUnavailable();
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    it('cancelConfirm while idle is a no-op (only from confirm_pending)', () => {
      const store = useCatalogueSearchStore.getState();
      store.cancelConfirm();
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });
  });
});
