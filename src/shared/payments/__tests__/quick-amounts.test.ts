import { describe, expect, it } from 'vitest';

import { quickAmounts } from '../quick-amounts.js';

/**
 * POS v3.5 Phase 3 — cash quick-amount suggestions.
 *
 * Pure UI affordance: from a total (integer minor units) produce up to 5
 * ascending "round it up to the next banknote" suggestions, always >= total,
 * exact-total included first. This is NOT settlement math — change-due stays
 * in money-math.ts (computeChangeDueMinor). Banknote ladder mirrors the v3.5
 * reference (EGP notes in piasters): 50, 100, 200, 500, 1000.
 */

describe('quickAmounts', () => {
  it('always includes the exact total as the first suggestion', () => {
    const out = quickAmounts(19925);
    expect(out[0]).toBe(19925);
  });

  it('every suggestion is >= total', () => {
    const out = quickAmounts(19925);
    for (const v of out) expect(v).toBeGreaterThanOrEqual(19925);
  });

  it('suggestions are strictly ascending and de-duplicated', () => {
    const out = quickAmounts(19925);
    const sorted = [...out].sort((a, b) => a - b);
    expect(out).toEqual(sorted);
    expect(new Set(out).size).toBe(out.length);
  });

  it('caps the list at 5 suggestions', () => {
    const out = quickAmounts(137);
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('rounds up to the next banknote multiples', () => {
    // total 19925 → next 50 (20000), 100 (20000), 200 (20000), 500 (20000), 1000 (20000)
    const out = quickAmounts(19925);
    expect(out).toContain(20000);
  });

  it('includes the exact value first when the total is already a banknote multiple', () => {
    // 50000 is a clean 500-note, so it leads; larger-note round-ups (e.g. the
    // next 200-multiple 60000, the next 1000-multiple 100000) still follow as
    // valid higher-denomination options for the cashier.
    const out = quickAmounts(50000);
    expect(out[0]).toBe(50000);
    expect(out).toContain(50000);
    for (const v of out) expect(v).toBeGreaterThanOrEqual(50000);
  });

  it('returns [0] for a zero total', () => {
    expect(quickAmounts(0)).toEqual([0]);
  });

  it('throws on a non-integer total', () => {
    expect(() => quickAmounts(19.5)).toThrow(RangeError);
  });

  it('throws on a negative total', () => {
    expect(() => quickAmounts(-1)).toThrow(RangeError);
  });
});
