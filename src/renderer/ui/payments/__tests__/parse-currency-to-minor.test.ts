/**
 * Cash entry input — accept the natural currency amount the customer pays
 * (e.g. "12.50"), convert to integer minor units at the input boundary.
 *
 * Cashiers think in currency, not minor units. Requiring "1250" for ¤12.50
 * hesitates them and invites mis-entry. This parser is the inverse of the
 * existing `formatMinorUnits` display conversion: a display-layer boundary
 * conversion, NOT a relaxation of Constitution §II (storage + math stay minor
 * units). It MUST refuse anything that can't be represented exactly in 2
 * decimals — no rounding (rounding money is a §II violation).
 */

import { describe, it, expect } from 'vitest';

import { parseCurrencyToMinor, formatMinorToInput } from '../parse-currency-to-minor.js';

describe('parseCurrencyToMinor — currency string → integer minor units', () => {
  it('parses a two-decimal amount: "12.50" → 1250', () => {
    expect(parseCurrencyToMinor('12.50')).toBe(1250);
  });

  it('parses a whole number with no decimal: "12" → 1200', () => {
    expect(parseCurrencyToMinor('12')).toBe(1200);
  });

  it('parses a single-decimal amount: "12.5" → 1250', () => {
    expect(parseCurrencyToMinor('12.5')).toBe(1250);
  });

  it('parses a leading-dot amount: ".50" → 50', () => {
    expect(parseCurrencyToMinor('.50')).toBe(50);
  });

  it('parses zero: "0" → 0 and "0.00" → 0', () => {
    expect(parseCurrencyToMinor('0')).toBe(0);
    expect(parseCurrencyToMinor('0.00')).toBe(0);
  });

  it('rejects empty input → null', () => {
    expect(parseCurrencyToMinor('')).toBeNull();
  });

  it('rejects more than 2 decimal places (no rounding) → null', () => {
    expect(parseCurrencyToMinor('12.555')).toBeNull();
    expect(parseCurrencyToMinor('12.501')).toBeNull();
  });

  it('rejects negatives → null', () => {
    expect(parseCurrencyToMinor('-5')).toBeNull();
    expect(parseCurrencyToMinor('-12.50')).toBeNull();
  });

  it('rejects non-numeric / malformed → null', () => {
    expect(parseCurrencyToMinor('abc')).toBeNull();
    expect(parseCurrencyToMinor('12.5.0')).toBeNull();
    expect(parseCurrencyToMinor('12,50')).toBeNull();
    expect(parseCurrencyToMinor('1e3')).toBeNull();
    expect(parseCurrencyToMinor('12.')).toBeNull();
    expect(parseCurrencyToMinor(' 12.50 ')).toBeNull();
  });

  it('returns a safe integer (no float artifacts): "0.10" → 10, not 10.000000001', () => {
    const v = parseCurrencyToMinor('0.10');
    expect(v).toBe(10);
    expect(Number.isSafeInteger(v)).toBe(true);
  });
});

describe('formatMinorToInput — minor units → plain editable currency string (no ¤ symbol)', () => {
  it('formats with 2 decimals: 1250 → "12.50"', () => {
    expect(formatMinorToInput(1250)).toBe('12.50');
  });

  it('pads single-digit minor: 5 → "0.05"', () => {
    expect(formatMinorToInput(5)).toBe('0.05');
  });

  it('formats zero: 0 → "0.00"', () => {
    expect(formatMinorToInput(0)).toBe('0.00');
  });

  it('formats a large value: 12550 → "125.50"', () => {
    expect(formatMinorToInput(12550)).toBe('125.50');
  });

  it('returns empty string for an unsafe / negative value (cannot prefill)', () => {
    expect(formatMinorToInput(Number.MAX_SAFE_INTEGER + 1)).toBe('');
    expect(formatMinorToInput(-1)).toBe('');
  });

  it('round-trips with parseCurrencyToMinor: parse(format(n)) === n', () => {
    for (const n of [0, 5, 99, 100, 1250, 12550, 99999]) {
      expect(parseCurrencyToMinor(formatMinorToInput(n))).toBe(n);
    }
  });
});
