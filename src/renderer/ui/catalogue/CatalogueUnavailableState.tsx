import type { JSX } from 'react';

/**
 * 009 Slice S1 layout-only shell — Surface 6 (catalogue unavailable, FR-24).
 *
 * The visually-distinct "system not ready" state — empty/missing/unreadable read
 * model collapsed to ONE generic message (the specific reason is logged for
 * diagnostics only). The most prominent error treatment (danger), signalling
 * *escalate*, not *retype* (SC-10 — never confused with not-found). `role="alert"`
 * announces it; the icon is decorative (`aria-hidden`), the heading carries the
 * meaning. This is a local read-model state, NOT a connection state.
 */
export function CatalogueUnavailableState(): JSX.Element {
  return (
    <div
      role="alert"
      className="catalogue-state catalogue-state--unavailable"
      data-testid="catalogue-unavailable"
    >
      <span className="catalogue-state__icon" aria-hidden="true">
        ⛔
      </span>
      <h2 className="catalogue-state__heading">
        كتالوج المنتجات غير متاح حاليًا (Product catalogue unavailable)
      </h2>
      <p className="catalogue-state__hint">النظام غير جاهز للبحث — أبلغ المسؤول.</p>
    </div>
  );
}
