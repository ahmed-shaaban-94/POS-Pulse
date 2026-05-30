import type { JSX } from 'react';

/**
 * 009 Slice S1 layout-only shell — the focus-confined keyboard-wedge capture
 * field (Surface 1 companion; NFR-6).
 *
 * The Enter-terminator safe-submit + focus-confinement wiring land in S4
 * (T049); this shell renders the sanctioned wedge input target. `inputMode`
 * `none` keeps the on-screen keyboard suppressed (wedge HID only).
 */
export function ScanCaptureField(): JSX.Element {
  return (
    <input
      type="text"
      className="catalogue-scan-capture"
      data-testid="scan-capture-field"
      aria-label="حقل التقاط مسح الباركود (barcode scan capture)"
      autoComplete="off"
      inputMode="none"
    />
  );
}
