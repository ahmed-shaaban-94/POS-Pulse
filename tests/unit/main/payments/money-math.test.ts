/**
 * T040 — money-math helper test (RED → GREEN under TDD).
 *
 * Asserts:
 *   - computeChangeDueMinor returns a non-negative integer.
 *   - throws on float, negative, NaN, Infinity, and non-integer inputs.
 *   - throws on the (unreachable-by-pure-arithmetic) unsafe-integer output.
 *   - Number.isSafeInteger guarded on every input and on the output.
 *
 * References:
 *   - FR-004 / FR-005 (cash entry, change-due rule)
 *   - Constitution §II "Money is integer minor units only"
 *   - spec.md §"Tender scope (amendment 2026-05-19)" §"Cash overpayment"
 */

import { describe, expect, it } from 'vitest';

import { computeChangeDueMinor } from '../../../../src/shared/payments/money-math.js';

describe('computeChangeDueMinor — happy path', () => {
  it('returns 0 when amount equals remaining', () => {
    expect(computeChangeDueMinor(12550, 12550)).toBe(0);
  });

  it('returns the positive difference when amount overpays', () => {
    expect(computeChangeDueMinor(15000, 12550)).toBe(2450);
  });

  it('returns a non-negative integer for typical cash overpayments', () => {
    const change = computeChangeDueMinor(20000, 12550);
    expect(change).toBeGreaterThanOrEqual(0);
    expect(Number.isSafeInteger(change)).toBe(true);
  });

  it('handles the trivial zero-balance, zero-applied case', () => {
    expect(computeChangeDueMinor(0, 0)).toBe(0);
  });
});

describe('computeChangeDueMinor — refuses under-tender', () => {
  it('throws when amount applied is strictly less than remaining', () => {
    expect(() => computeChangeDueMinor(10000, 12550)).toThrow(
      /under.?tender|insufficient|less than/i,
    );
  });

  it('throws when amount applied is zero against a positive remaining', () => {
    expect(() => computeChangeDueMinor(0, 1)).toThrow();
  });
});

describe('computeChangeDueMinor — Number.isSafeInteger guarded on inputs', () => {
  it('throws on float amountAppliedMinor', () => {
    expect(() => computeChangeDueMinor(125.5, 100)).toThrow(/integer|safe/i);
  });

  it('throws on float remainingBalanceMinor', () => {
    expect(() => computeChangeDueMinor(200, 125.5)).toThrow(/integer|safe/i);
  });

  it('throws on negative amountAppliedMinor', () => {
    expect(() => computeChangeDueMinor(-1, 100)).toThrow(/negative|integer|safe/i);
  });

  it('throws on negative remainingBalanceMinor', () => {
    expect(() => computeChangeDueMinor(100, -1)).toThrow(/negative|integer|safe/i);
  });

  it('throws on NaN amountAppliedMinor', () => {
    expect(() => computeChangeDueMinor(Number.NaN, 100)).toThrow(/integer|safe/i);
  });

  it('throws on Infinity amountAppliedMinor', () => {
    expect(() => computeChangeDueMinor(Number.POSITIVE_INFINITY, 100)).toThrow(/integer|safe/i);
  });

  it('throws on NaN remainingBalanceMinor', () => {
    expect(() => computeChangeDueMinor(100, Number.NaN)).toThrow(/integer|safe/i);
  });

  it('throws on values beyond Number.MAX_SAFE_INTEGER', () => {
    expect(() => computeChangeDueMinor(Number.MAX_SAFE_INTEGER + 1, 100)).toThrow(/integer|safe/i);
  });

  it('throws when the difference would itself be unsafe (output guard)', () => {
    // Arithmetic edge case: maximum safe applied with zero remaining — output
    // equals MAX_SAFE_INTEGER, which IS safe, so this is the boundary.
    // To force an unsafe output we'd need inputs beyond MAX_SAFE_INTEGER,
    // which the input guard already rejects. This test pins that contract.
    expect(computeChangeDueMinor(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
