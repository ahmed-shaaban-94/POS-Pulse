import type { JSX } from 'react';

/**
 * POS v3.5 Slice 2 — deferred-enrichment HONESTY shell (POS-013).
 *
 * The prototype `SaleScreen` (docs/design/pos-v3.5/design-reference/pos-app.jsx)
 * fills the catalogue pane below the search with a category-chip row, a
 * quick-item browse grid, and (cart-side) stock / batch-expiry / drug-interaction
 * / frequently-bought-together affordances. NONE of that data exists in the live
 * `catalogue` contract — there is no list/browse/by-category method, and no
 * stock / expiry / interaction / bought-together field on `ProductSnapshotDisplay`
 * (POS-013, deferred). Fabricating it would be a lie in the UI.
 *
 * So this slot keeps the LAYOUT footprint (so the recomposed screen matches the
 * prototype's shape and the real surfaces can drop in later) while telling the
 * truth: a single, bilingual "not available yet" placeholder. It fetches
 * nothing, invents nothing, and gates nothing.
 *
 * It is purely decorative-status (`aria-hidden` would hide it from AT, but the
 * honest copy is useful to a screen-reader user too, so it is a polite,
 * non-interactive region with no controls). No colour-only meaning — the text
 * carries it.
 */
export function CatalogueEnrichmentShell(): JSX.Element {
  return (
    <div
      className="catalogue-enrichment-shell"
      data-testid="catalogue-enrichment-shell"
      role="note"
    >
      <span className="catalogue-enrichment-shell__icon" aria-hidden="true">
        ▭
      </span>
      <p className="catalogue-enrichment-shell__label">
        التصفّح بالفئات والأصناف السريعة وبيانات المخزون والصلاحية والتداخلات
        <span className="catalogue-enrichment-shell__status" dir="ltr">
          {' '}
          غير متاح بعد · not available yet
        </span>
      </p>
    </div>
  );
}
