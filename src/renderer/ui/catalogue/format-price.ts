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
  // P1 guard: monetary values are integer minor units. An invalid price never
  // reaches display in practice — the resolver blocks it generically (FR-19) —
  // but guard defensively so a stray NaN / Infinity / float / unsafe integer
  // renders a neutral placeholder, never a wrong amount.
  if (!Number.isSafeInteger(minor)) {
    return '¤ —';
  }
  const whole = Math.trunc(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `¤ ${String(whole)}.${frac}`;
}
