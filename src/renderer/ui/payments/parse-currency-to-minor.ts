/**
 * Parse a cashier-entered currency string (e.g. "12.50") into integer minor
 * units (1250). The inverse of `formatMinorUnits` — a display-layer boundary
 * conversion so cashiers enter the natural amount the customer pays, while
 * storage + math stay in integer minor units (Constitution §II).
 *
 * Strict by design (money): accepts up to 2 decimal places only. Anything that
 * cannot be represented EXACTLY in minor units (3+ decimals, negatives,
 * thousands separators, scientific notation, whitespace, multiple dots) returns
 * null — never rounds. The caller treats null as "no valid amount entered".
 *
 * Implementation note: integer and fractional parts are parsed SEPARATELY and
 * combined with integer arithmetic. `parseFloat("0.10") * 100` yields
 * 10.000000000000002 (a float artifact); this avoids it entirely.
 */
export function parseCurrencyToMinor(input: string): number | null {
  // Whole number (no decimal) — e.g. "12", "0".
  // Optional integer part + optional 1–2 decimal places — e.g. "12.50",
  // "12.5", ".50". A trailing bare dot ("12.") is rejected.
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(input)) {
    return null;
  }

  const [wholeRaw = '', fracRaw = ''] = input.split('.');
  const whole = wholeRaw === '' ? 0 : Number.parseInt(wholeRaw, 10);
  // Pad the fractional part to exactly 2 digits: "5" → 50, "" → 00, "50" → 50.
  const frac = fracRaw === '' ? 0 : Number.parseInt(fracRaw.padEnd(2, '0'), 10);

  const minor = whole * 100 + frac;
  return Number.isSafeInteger(minor) ? minor : null;
}
