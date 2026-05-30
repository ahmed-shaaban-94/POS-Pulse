/**
 * 009 — display-only price formatter for the catalogue surfaces.
 *
 * Integer-safe: NO float arithmetic (Constitution P1). `whole = trunc(minor/100)`
 * and `frac = |minor % 100|` zero-padded. `¤` is the placeholder currency mark —
 * final locale/symbol formatting is owned downstream (same placeholder
 * convention as 005's cart surfaces). This value is for DISPLAY only and is
 * never used for money arithmetic or storage.
 */
export function formatPriceMinor(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `¤ ${String(whole)}.${frac}`;
}
