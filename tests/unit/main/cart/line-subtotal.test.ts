import { describe, it, expect } from 'vitest';
import { computeLineSubtotal, LineSubtotalError } from '../../../../src/main/cart/line-subtotal.js';

/**
 * T030 — line-subtotal pure-function tests.
 *
 * `quantity × unit_price_minor` in integer minor units only. Constitution P1
 * + NFR-002: NO floats, NO BigInt result (must remain a safe JS integer for
 * SQLite INTEGER column storage), NO rounding. Overflow refused via
 * `Number.isSafeInteger` guard.
 *
 * ≥ 95% branch coverage is required for this module (load-bearing money rule).
 */

describe('computeLineSubtotal — happy paths', () => {
  it('returns quantity × unit_price_minor for positive integers', () => {
    expect(computeLineSubtotal(2, 150)).toBe(300);
  });

  it('handles quantity=1', () => {
    expect(computeLineSubtotal(1, 999)).toBe(999);
  });

  it('handles unit_price_minor=0 (free item)', () => {
    expect(computeLineSubtotal(5, 0)).toBe(0);
  });

  it('handles large but safe-integer result', () => {
    // (Number.MAX_SAFE_INTEGER ≈ 9.007e15). 1_000_000 × 1_000_000 = 1e12, well inside.
    expect(computeLineSubtotal(1_000_000, 1_000_000)).toBe(1_000_000_000_000);
  });
});

describe('computeLineSubtotal — invalid inputs refused', () => {
  it('throws LineSubtotalError on negative quantity', () => {
    expect(() => computeLineSubtotal(-1, 100)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on zero quantity (must be positive)', () => {
    expect(() => computeLineSubtotal(0, 100)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on negative unit_price_minor', () => {
    expect(() => computeLineSubtotal(1, -50)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on non-integer quantity', () => {
    expect(() => computeLineSubtotal(1.5, 100)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on non-integer unit_price_minor', () => {
    expect(() => computeLineSubtotal(2, 99.99)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on NaN quantity', () => {
    expect(() => computeLineSubtotal(NaN, 100)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on Infinity quantity', () => {
    expect(() => computeLineSubtotal(Infinity, 100)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on NaN unit_price_minor', () => {
    expect(() => computeLineSubtotal(1, NaN)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError on Infinity unit_price_minor', () => {
    expect(() => computeLineSubtotal(1, Infinity)).toThrow(LineSubtotalError);
  });
});

describe('computeLineSubtotal — safe integer overflow guard', () => {
  it('throws LineSubtotalError when result exceeds Number.MAX_SAFE_INTEGER', () => {
    // 2^27 × 2^27 = 2^54, well above MAX_SAFE_INTEGER (2^53 − 1).
    const huge = 2 ** 27;
    expect(() => computeLineSubtotal(huge, huge)).toThrow(LineSubtotalError);
  });

  it('throws LineSubtotalError when only the multiplication overflows', () => {
    // Both operands are safe integers; product exceeds MAX_SAFE_INTEGER.
    expect(() => computeLineSubtotal(Number.MAX_SAFE_INTEGER, 2)).toThrow(LineSubtotalError);
  });

  it('does not throw at the safe-integer boundary', () => {
    // 1 × MAX_SAFE_INTEGER stays safe.
    expect(computeLineSubtotal(1, Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('LineSubtotalError — type', () => {
  it('LineSubtotalError instances are Error subclasses', () => {
    const e = new LineSubtotalError('test');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('LineSubtotalError');
  });

  it('carries a generic message — no payload-value echo', () => {
    try {
      computeLineSubtotal(-1, 5);
    } catch (err) {
      expect(err).toBeInstanceOf(LineSubtotalError);
      // Generic message; MUST NOT echo the offending numeric value.
      expect((err as Error).message).not.toContain('-1');
      expect((err as Error).message).not.toContain('5');
    }
  });
});
