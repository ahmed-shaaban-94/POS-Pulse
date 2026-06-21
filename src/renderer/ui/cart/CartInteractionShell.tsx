import type { JSX } from 'react';

/**
 * POS v3.5 Slice 3 — drug-interaction ENRICHMENT honesty shell.
 *
 * The prototype `SaleScreen` cart pane (docs/design/pos-v3.5/design-reference/
 * pos-app.jsx) renders a `.callout--warning` drug-interaction alert above the
 * line list. There is NO interaction data anywhere in the live `cart` (or
 * `catalogue`) contract — no interaction field, no interaction lookup method
 * (POS-013, deferred). Asserting a real "تنبيه تداخل دوائي" would be a lie.
 *
 * So this keeps the prototype's layout footprint (so the real surface can drop
 * in later) while telling the truth: a single, bilingual "not available yet"
 * placeholder. It fetches nothing, invents nothing, gates nothing — and it is
 * a polite `note`, never a `role="alert"` claiming a live interaction.
 *
 * Mirrors the catalogue-side `CatalogueEnrichmentShell` posture and copy.
 */
export function CartInteractionShell(): JSX.Element {
  return (
    <div className="cart-interaction-shell" data-testid="cart-interaction-shell" role="note">
      <span className="cart-interaction-shell__icon" aria-hidden="true">
        ▭
      </span>
      <p className="cart-interaction-shell__label">
        تنبيهات التداخل الدوائي
        <span className="cart-interaction-shell__status" dir="ltr">
          {' '}
          غير متاح بعد · not available yet
        </span>
      </p>
    </div>
  );
}
