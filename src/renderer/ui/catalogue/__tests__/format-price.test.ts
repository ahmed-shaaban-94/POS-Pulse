import { describe, expect, it } from 'vitest';

import { formatPriceMinor } from '../format-price.js';

/**
 * 009 T018 — `formatPriceMinor` display helper.
 *
 * Integer-safe (Constitution P1): no float arithmetic; `Number.isSafeInteger`
 * guarded. `¤` is the placeholder currency mark (final formatting owned
 * downstream). Display-only — never used for money arithmetic or storage.
 */

describe('formatPriceMinor', () => {
  it('formats integer minor units as whole.frac', () => {
    expect(formatPriceMinor(1500)).toBe('¤ 15.00');
    expect(formatPriceMinor(700)).toBe('¤ 7.00');
    expect(formatPriceMinor(99)).toBe('¤ 0.99');
    expect(formatPriceMinor(0)).toBe('¤ 0.00');
    expect(formatPriceMinor(123456)).toBe('¤ 1234.56');
  });

  it('renders a neutral placeholder for non-safe-integer input (P1 guard)', () => {
    expect(formatPriceMinor(Number.NaN)).toBe('¤ —');
    expect(formatPriceMinor(Number.POSITIVE_INFINITY)).toBe('¤ —');
    expect(formatPriceMinor(15.5)).toBe('¤ —'); // float
    expect(formatPriceMinor(Number.MAX_SAFE_INTEGER + 1)).toBe('¤ —');
  });

  it('rejects a negative price (non-negative catalogue domain) → placeholder', () => {
    // A catalogue price is never negative (data-model invariant); a negative
    // value is a data error, not a credit — render the neutral placeholder
    // rather than a misleading "¤ -15.00".
    expect(formatPriceMinor(-1500)).toBe('¤ —');
    expect(formatPriceMinor(-1)).toBe('¤ —');
  });
});
