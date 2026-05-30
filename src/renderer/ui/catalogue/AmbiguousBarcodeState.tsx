import type { JSX } from 'react';

export interface AmbiguousBarcodeStateProps {
  onEdit?: () => void;
}

/**
 * 009 Slice S1 layout-only shell — Surface 7 (ambiguous barcode, FR-7).
 *
 * The data-conflict block: one barcode mapped to >1 active product. The system
 * refuses to guess and adds nothing — generic "resolve in catalogue" copy
 * (warning treatment, distinct from both not-found and catalogue-unavailable).
 * `role="status"` (polite); the icon is decorative, the heading carries meaning.
 */
export function AmbiguousBarcodeState({ onEdit }: AmbiguousBarcodeStateProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="catalogue-state catalogue-state--ambiguous"
      data-testid="catalogue-ambiguous"
    >
      <span className="catalogue-state__icon" aria-hidden="true">
        ⚠
      </span>
      <h2 className="catalogue-state__heading">
        هذا الباركود مرتبط بأكثر من منتج (matches more than one product)
      </h2>
      <p className="catalogue-state__hint">يجب حلّ التعارض في الكتالوج — لم تتم الإضافة.</p>
      <button type="button" className="btn btn--ghost btn--md" onClick={onEdit}>
        تعديل (Edit)
      </button>
    </div>
  );
}
