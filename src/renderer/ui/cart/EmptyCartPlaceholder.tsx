import type { JSX } from 'react';

/**
 * 005-sales-cart S1 / T028 — Empty cart placeholder.
 * POS v3.5 Slice 3 — recomposed to the prototype's branded `.cart-empty` state.
 *
 * Surface 1 of the S0 contact sheet (`Empty cart pane`). Renders inside
 * `CartPane` when there is no active cart or the active cart is in the
 * `empty` state.
 *
 * Recompose: a branded mark + an Arabic-first title ("السلة فارغة") + a
 * bilingual start hint + the prototype's key-hint chips. The key chips are
 * DISPLAY-ONLY affordance hints (F2 دفع / F3 تعليق / "/" بحث) — they are not
 * interactive controls and bind to nothing here (hold/F3 has no engine path;
 * the real F2/search shortcuts live on their owning surfaces).
 *
 * The brand mark is a CSS-styled glyph (no <img> to an unbundled asset / no
 * remote fetch) so the empty state renders self-contained.
 *
 * Copy: generic, pharmacy-POS appropriate. No shift totals, drawer cash,
 * reports, KPIs, or any other cashier-forbidden information surfaces.
 *
 * Tokens: existing surface/ink tokens only. No new tokens introduced.
 */
export function EmptyCartPlaceholder(): JSX.Element {
  return (
    <div className="cart-empty" data-testid="cart-empty-placeholder" aria-live="polite">
      <span className="cart-empty__mark" aria-hidden="true">
        ⬡
      </span>
      <p className="cart-empty__title">السلة فارغة</p>
      <p className="cart-empty__hint">
        امسح باركود الصنف أو اختر من الأصناف السريعة للبدء.
        <span dir="ltr"> (Scan or tap an item to begin.)</span>
      </p>
      <div className="cart-empty__keys" aria-hidden="true">
        <span className="kbd">
          F2 <small>دفع</small>
        </span>
        <span className="kbd">
          F3 <small>تعليق</small>
        </span>
        <span className="kbd">
          / <small>بحث</small>
        </span>
      </div>
    </div>
  );
}
