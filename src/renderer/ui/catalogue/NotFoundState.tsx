import type { JSX } from 'react';

export interface NotFoundStateProps {
  /** The scanned/typed value to echo back (FR-6 recovery). */
  query?: string;
  onEdit?: () => void;
}

/**
 * 009 Slice S1 layout-only shell — Surface 5 (product not found, FR-6).
 *
 * The calmest of the three error states (muted) — it means "retype", not
 * "system broken" (contrast `CatalogueUnavailableState`). Echoes the scanned
 * value, offers retry. `role="status"` (polite) — it does not steal focus
 * (the cashier may be mid-entry). The icon is decorative (`aria-hidden`); the
 * heading text carries the meaning (never colour-only).
 */
export function NotFoundState({ query, onEdit }: NotFoundStateProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="catalogue-state catalogue-state--not-found"
      data-testid="catalogue-not-found"
    >
      <span className="catalogue-state__icon" aria-hidden="true">
        ⊘
      </span>
      <h2 className="catalogue-state__heading">لم يتم العثور على المنتج (Product not found)</h2>
      {query !== undefined && <p className="catalogue-state__value">{query}</p>}
      <p className="catalogue-state__hint">جرّب مرة أخرى أو عدّل الإدخال</p>
      <button type="button" className="btn btn--ghost btn--md" onClick={onEdit}>
        تعديل (Edit)
      </button>
    </div>
  );
}
