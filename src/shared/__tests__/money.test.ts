import { describe, it, expect } from 'vitest';

import {
  type Money,
  of,
  zero,
  add,
  subtract,
  multiply,
  allocate,
  equals,
  compare,
  format,
} from '../money.js';

/**
 * T056 — exhaustive Money test suite.
 *
 * Per Constitution Principle II: every monetary value is an integer
 * count of minor units; no float arithmetic; no silent rounding.
 * Per spec NFR-2 / SC-5: ≥95% line + branch coverage on src/shared/money.ts
 * (gate enforced in vitest.config.ts).
 *
 * No real money flows in 001 — all values are illustrative.
 */

const MAX = Number.MAX_SAFE_INTEGER; // 2^53 - 1

// =============================================================================
// of — construction validation
// =============================================================================

describe('of', () => {
  it('accepts a positive safe integer with EGP', () => {
    const m = of(12345, 'EGP');
    expect(m).toEqual({ amount: 12345, currency: 'EGP' });
  });

  it('accepts zero', () => {
    expect(of(0, 'EGP')).toEqual({ amount: 0, currency: 'EGP' });
  });

  it('accepts negative integers (refunds, voids)', () => {
    expect(of(-12345, 'EGP')).toEqual({ amount: -12345, currency: 'EGP' });
  });

  it('accepts MAX_SAFE_INTEGER', () => {
    expect(of(MAX, 'EGP').amount).toBe(MAX);
  });

  it('accepts -MAX_SAFE_INTEGER', () => {
    expect(of(-MAX, 'EGP').amount).toBe(-MAX);
  });

  it.each([
    ['non-integer 1.5', 1.5],
    ['non-integer 0.1', 0.1],
    ['non-integer -2.5', -2.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['MAX_SAFE_INTEGER + 1 (non-safe)', MAX + 1],
    ['-MAX_SAFE_INTEGER - 1 (non-safe)', -MAX - 1],
  ])('rejects amount: %s', (_label, amount) => {
    expect(() => of(amount, 'EGP')).toThrow(/safe integer/);
  });

  it.each([
    ['USD', 'USD'],
    ['EUR', 'EUR'],
    ['lowercase egp', 'egp'],
    ['empty string', ''],
  ])('rejects unsupported currency: %s', (_label, currency) => {
    expect(() => of(100, currency as 'EGP')).toThrow(/currency/);
  });

  it('returns a frozen object (immutable)', () => {
    const m = of(100, 'EGP');
    expect(Object.isFrozen(m)).toBe(true);
  });
});

// =============================================================================
// zero
// =============================================================================

describe('zero', () => {
  it('returns { amount: 0, currency: "EGP" }', () => {
    expect(zero('EGP')).toEqual({ amount: 0, currency: 'EGP' });
  });

  it('rejects unsupported currency', () => {
    expect(() => zero('USD' as 'EGP')).toThrow(/currency/);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(zero('EGP'))).toBe(true);
  });
});

// =============================================================================
// add
// =============================================================================

describe('add', () => {
  it('adds two positive values', () => {
    expect(add(of(100, 'EGP'), of(250, 'EGP'))).toEqual({ amount: 350, currency: 'EGP' });
  });

  it('adds zero', () => {
    expect(add(of(100, 'EGP'), zero('EGP'))).toEqual({ amount: 100, currency: 'EGP' });
  });

  it('adds two zeros', () => {
    expect(add(zero('EGP'), zero('EGP'))).toEqual({ amount: 0, currency: 'EGP' });
  });

  it('adds negatives', () => {
    expect(add(of(100, 'EGP'), of(-30, 'EGP'))).toEqual({ amount: 70, currency: 'EGP' });
  });

  it('adds two negatives', () => {
    expect(add(of(-100, 'EGP'), of(-50, 'EGP'))).toEqual({ amount: -150, currency: 'EGP' });
  });

  it('throws on currency mismatch', () => {
    const a = of(100, 'EGP');
    const b: Money = { amount: 100, currency: 'USD' as 'EGP' };
    expect(() => add(a, b)).toThrow(/currency mismatch/);
  });

  it('throws on overflow (positive)', () => {
    expect(() => add(of(MAX, 'EGP'), of(1, 'EGP'))).toThrow(/safe integer/);
  });

  it('throws on overflow (negative)', () => {
    expect(() => add(of(-MAX, 'EGP'), of(-1, 'EGP'))).toThrow(/safe integer/);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(add(of(1, 'EGP'), of(2, 'EGP')))).toBe(true);
  });
});

// =============================================================================
// subtract
// =============================================================================

describe('subtract', () => {
  it('subtracts two positives', () => {
    expect(subtract(of(250, 'EGP'), of(100, 'EGP'))).toEqual({ amount: 150, currency: 'EGP' });
  });

  it('subtract to zero', () => {
    expect(subtract(of(100, 'EGP'), of(100, 'EGP'))).toEqual({ amount: 0, currency: 'EGP' });
  });

  it('subtract negative is addition', () => {
    expect(subtract(of(100, 'EGP'), of(-50, 'EGP'))).toEqual({ amount: 150, currency: 'EGP' });
  });

  it('subtract producing negative result', () => {
    expect(subtract(of(50, 'EGP'), of(100, 'EGP'))).toEqual({ amount: -50, currency: 'EGP' });
  });

  it('throws on currency mismatch', () => {
    const a = of(100, 'EGP');
    const b: Money = { amount: 100, currency: 'EUR' as 'EGP' };
    expect(() => subtract(a, b)).toThrow(/currency mismatch/);
  });

  it('throws on overflow', () => {
    expect(() => subtract(of(-MAX, 'EGP'), of(1, 'EGP'))).toThrow(/safe integer/);
  });
});

// =============================================================================
// multiply
// =============================================================================

describe('multiply', () => {
  it('multiplies by 1 returns equal value', () => {
    expect(multiply(of(100, 'EGP'), 1)).toEqual({ amount: 100, currency: 'EGP' });
  });

  it('multiplies by 0 returns zero', () => {
    expect(multiply(of(100, 'EGP'), 0)).toEqual({ amount: 0, currency: 'EGP' });
  });

  it('multiplies by positive integer', () => {
    expect(multiply(of(99, 'EGP'), 5)).toEqual({ amount: 495, currency: 'EGP' });
  });

  it('multiplies by negative quantity flips sign', () => {
    expect(multiply(of(100, 'EGP'), -3)).toEqual({ amount: -300, currency: 'EGP' });
  });

  it('multiplies negative value by negative quantity', () => {
    expect(multiply(of(-100, 'EGP'), -3)).toEqual({ amount: 300, currency: 'EGP' });
  });

  it('multiplies zero amount by anything', () => {
    expect(multiply(zero('EGP'), 1000000)).toEqual({ amount: 0, currency: 'EGP' });
  });

  it.each([
    ['1.5', 1.5],
    ['0.1', 0.1],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['MAX_SAFE_INTEGER + 1', MAX + 1],
  ])('rejects non-safe-integer quantity: %s', (_label, qty) => {
    expect(() => multiply(of(100, 'EGP'), qty)).toThrow(/quantity.*safe integer/);
  });

  it('throws on result overflow (positive)', () => {
    // 2^52 × 5 = 5 × 2^52 ≈ 2.25 × 10^16 > MAX_SAFE_INTEGER (≈ 9.007e15)
    expect(() => multiply(of(2 ** 52, 'EGP'), 5)).toThrow(/safe integer/);
  });

  it('throws on result overflow (negative)', () => {
    expect(() => multiply(of(-(2 ** 52), 'EGP'), 5)).toThrow(/safe integer/);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(multiply(of(100, 'EGP'), 2))).toBe(true);
  });
});

// =============================================================================
// allocate
// =============================================================================

describe('allocate', () => {
  it('n=1 returns [value]', () => {
    expect(allocate(of(100, 'EGP'), 1)).toEqual([{ amount: 100, currency: 'EGP' }]);
  });

  it('n=2 over even amount divides evenly', () => {
    expect(allocate(of(100, 'EGP'), 2)).toEqual([
      { amount: 50, currency: 'EGP' },
      { amount: 50, currency: 'EGP' },
    ]);
  });

  it('n=2 over odd amount distributes remainder to the front', () => {
    expect(allocate(of(101, 'EGP'), 2)).toEqual([
      { amount: 51, currency: 'EGP' },
      { amount: 50, currency: 'EGP' },
    ]);
  });

  it('n=3 over 100 returns [34, 33, 33] (canonical example)', () => {
    expect(allocate(of(100, 'EGP'), 3)).toEqual([
      { amount: 34, currency: 'EGP' },
      { amount: 33, currency: 'EGP' },
      { amount: 33, currency: 'EGP' },
    ]);
  });

  it('n=10 over 100 divides evenly', () => {
    const parts = allocate(of(100, 'EGP'), 10);
    expect(parts).toHaveLength(10);
    for (const p of parts) expect(p.amount).toBe(10);
  });

  it('n=10 over 103 distributes 3 leftover to first three', () => {
    const parts = allocate(of(103, 'EGP'), 10);
    expect(parts.map((p) => p.amount)).toEqual([11, 11, 11, 10, 10, 10, 10, 10, 10, 10]);
  });

  it('amount=0 with any n returns all-zero parts', () => {
    expect(allocate(zero('EGP'), 5)).toEqual([
      { amount: 0, currency: 'EGP' },
      { amount: 0, currency: 'EGP' },
      { amount: 0, currency: 'EGP' },
      { amount: 0, currency: 'EGP' },
      { amount: 0, currency: 'EGP' },
    ]);
  });

  it('negative amount: allocate(-100, 3) → [-34, -33, -33]', () => {
    expect(allocate(of(-100, 'EGP'), 3)).toEqual([
      { amount: -34, currency: 'EGP' },
      { amount: -33, currency: 'EGP' },
      { amount: -33, currency: 'EGP' },
    ]);
  });

  it('negative amount divides evenly with no remainder', () => {
    expect(allocate(of(-300, 'EGP'), 3)).toEqual([
      { amount: -100, currency: 'EGP' },
      { amount: -100, currency: 'EGP' },
      { amount: -100, currency: 'EGP' },
    ]);
  });

  it.each([
    ['0', 0],
    ['-1', -1],
    ['-3', -3],
  ])('throws on n=%s (must be positive)', (_label, n) => {
    expect(() => allocate(of(100, 'EGP'), n)).toThrow(/n.*positive integer/);
  });

  it.each([
    ['1.5', 1.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['MAX_SAFE_INTEGER + 1', MAX + 1],
  ])('throws on n=%s (must be integer)', (_label, n) => {
    expect(() => allocate(of(100, 'EGP'), n)).toThrow(/n.*positive integer/);
  });

  it('invariant: sum of parts equals original amount (positive cases)', () => {
    const cases: Array<[number, number]> = [
      [100, 1],
      [100, 2],
      [100, 3],
      [100, 7],
      [100, 10],
      [12345, 4],
      [1, 100],
      [0, 5],
    ];
    for (const [amount, n] of cases) {
      const parts = allocate(of(amount, 'EGP'), n);
      const sum = parts.reduce((acc, m) => acc + m.amount, 0);
      expect(sum).toBe(amount);
      expect(parts).toHaveLength(n);
    }
  });

  it('invariant: sum of parts equals original amount (negative cases)', () => {
    const cases: Array<[number, number]> = [
      [-100, 3],
      [-100, 7],
      [-12345, 4],
      [-1, 3],
    ];
    for (const [amount, n] of cases) {
      const parts = allocate(of(amount, 'EGP'), n);
      const sum = parts.reduce((acc, m) => acc + m.amount, 0);
      expect(sum).toBe(amount);
    }
  });

  it('returned parts are frozen', () => {
    const parts = allocate(of(100, 'EGP'), 3);
    for (const p of parts) expect(Object.isFrozen(p)).toBe(true);
  });
});

// =============================================================================
// equals
// =============================================================================

describe('equals', () => {
  it('returns true for same currency, same amount', () => {
    expect(equals(of(100, 'EGP'), of(100, 'EGP'))).toBe(true);
  });

  it('returns true for two zeros', () => {
    expect(equals(zero('EGP'), zero('EGP'))).toBe(true);
  });

  it('returns false for different amounts', () => {
    expect(equals(of(100, 'EGP'), of(101, 'EGP'))).toBe(false);
  });

  it('returns false for cross-currency (per contract — does NOT throw)', () => {
    // Source-of-truth policy: src/shared/secret-store.ts and
    // src/shared/money.ts are canonical; the spec's contracts/money.ts is
    // a planning snapshot. tasks.md has drifted ("equals cross-currency
    // throws") but the contract says equals returns false on mismatch.
    // We implement per the contract.
    const a = of(100, 'EGP');
    const b: Money = { amount: 100, currency: 'USD' as 'EGP' };
    expect(equals(a, b)).toBe(false);
  });

  it('returns false for sign mismatch', () => {
    expect(equals(of(100, 'EGP'), of(-100, 'EGP'))).toBe(false);
  });
});

// =============================================================================
// compare
// =============================================================================

describe('compare', () => {
  it('returns 0 for equal values', () => {
    expect(compare(of(100, 'EGP'), of(100, 'EGP'))).toBe(0);
  });

  it('returns -1 when a < b', () => {
    expect(compare(of(99, 'EGP'), of(100, 'EGP'))).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compare(of(101, 'EGP'), of(100, 'EGP'))).toBe(1);
  });

  it('handles negatives correctly', () => {
    expect(compare(of(-100, 'EGP'), of(0, 'EGP'))).toBe(-1);
    expect(compare(of(0, 'EGP'), of(-100, 'EGP'))).toBe(1);
    expect(compare(of(-100, 'EGP'), of(-100, 'EGP'))).toBe(0);
  });

  it('throws on currency mismatch', () => {
    const a = of(100, 'EGP');
    const b: Money = { amount: 100, currency: 'USD' as 'EGP' };
    expect(() => compare(a, b)).toThrow(/currency mismatch/);
  });
});

// =============================================================================
// format
// =============================================================================

describe('format', () => {
  it('formats 12345 as "123.45 EGP" (canonical example)', () => {
    expect(format(of(12345, 'EGP'))).toBe('123.45 EGP');
  });

  it('formats 0 as "0.00 EGP"', () => {
    expect(format(zero('EGP'))).toBe('0.00 EGP');
  });

  it('formats 5 (5 piastres) as "0.05 EGP" (zero-padded fraction)', () => {
    expect(format(of(5, 'EGP'))).toBe('0.05 EGP');
  });

  it('formats 99 as "0.99 EGP"', () => {
    expect(format(of(99, 'EGP'))).toBe('0.99 EGP');
  });

  it('formats 100 as "1.00 EGP" (boundary at full unit)', () => {
    expect(format(of(100, 'EGP'))).toBe('1.00 EGP');
  });

  it('formats 199 as "1.99 EGP"', () => {
    expect(format(of(199, 'EGP'))).toBe('1.99 EGP');
  });

  it('formats negative -12345 as "-123.45 EGP" (sign prefix)', () => {
    expect(format(of(-12345, 'EGP'))).toBe('-123.45 EGP');
  });

  it('formats negative -5 as "-0.05 EGP"', () => {
    expect(format(of(-5, 'EGP'))).toBe('-0.05 EGP');
  });

  it('formats negative -100 as "-1.00 EGP"', () => {
    expect(format(of(-100, 'EGP'))).toBe('-1.00 EGP');
  });

  it('formats large value', () => {
    expect(format(of(99999900, 'EGP'))).toBe('999999.00 EGP');
  });
});
