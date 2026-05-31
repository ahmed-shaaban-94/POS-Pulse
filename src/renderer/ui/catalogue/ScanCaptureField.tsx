import { useState, type JSX, type KeyboardEvent } from 'react';

export interface ScanCaptureFieldProps {
  /**
   * Called with the buffered barcode when the scanner sends its Enter
   * terminator (FR-8). Omitted in layout-only contexts (the field is then inert
   * but still renders).
   */
  onScan?: (barcode: string) => void;
}

/**
 * 009 Slice S4b (T049) — focus-confined keyboard-wedge capture field (NFR-6).
 *
 * A keyboard-wedge scanner types the barcode then sends an Enter terminator. On
 * Enter the field submits the buffered value via `onScan` exactly once and
 * `preventDefault`s the event so it never bubbles to a surrounding form / default
 * action (no leak into the cart or an unrelated submit, FR-8). The buffer clears
 * after each submit, ready for the next scan. An empty buffer submits nothing.
 *
 * `inputMode="none"` keeps the on-screen keyboard suppressed (wedge HID only);
 * the field is the sanctioned capture target so a scan never lands in another
 * control.
 */
export function ScanCaptureField({ onScan }: ScanCaptureFieldProps = {}): JSX.Element {
  const [buffer, setBuffer] = useState('');

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') return;
    // Confine the terminator — never let Enter trigger a surrounding form submit
    // or default action (FR-8 / NFR-6).
    event.preventDefault();
    const barcode = buffer.trim();
    setBuffer(''); // ready for the next scan, regardless of whether we submit
    if (barcode.length === 0) return; // empty buffer → nothing to submit
    onScan?.(barcode);
  }

  return (
    <input
      type="text"
      className="catalogue-scan-capture"
      data-testid="scan-capture-field"
      aria-label="حقل التقاط مسح الباركود (barcode scan capture)"
      autoComplete="off"
      inputMode="none"
      value={buffer}
      onChange={(e) => {
        setBuffer(e.target.value);
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
