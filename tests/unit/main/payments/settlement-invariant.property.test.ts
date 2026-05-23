/**
 * T163 — Settlement-invariant property test (vitest + fast-check).
 *
 * Property: across any random tender-line mix the cashier can input
 * (cash + external_card_terminal), the running sum of `amount_applied_minor`
 * must remain a safe non-negative integer (Constitution §II). When the
 * running sum equals the envelope subtotal, the settlement invariant
 * holds; when it falls short, `payments.confirm` will refuse with
 * `tender_underpaid`; it can never exceed the subtotal because the
 * external_card_terminal path forbids overpayment per FR-010 and the
 * cash path that overpays records the excess as change_due_minor rather
 * than crediting the running sum.
 *
 * What's fuzzed:
 *   - envelope subtotal (safe non-negative integer, capped at 10^7 minor)
 *   - per-line tender kind (cash | external_card_terminal)
 *   - per-line amount (safe non-negative integer)
 *   - per-line cash overpay (only when remaining > 0)
 *
 * Invariants asserted (every iteration):
 *   1. Every running sum is Number.isSafeInteger.
 *   2. The running sum never exceeds the envelope subtotal (FR-010
 *      contract — external_card_terminal rejected on over; cash records
 *      the overpay as change_due instead of adding to the running sum).
 *   3. The running sum is monotonically non-decreasing.
 *   4. When all lines are applied, sum + total_change_due ==
 *      total_cash_input + total_external_card_input.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { computeChangeDueMinor } from '../../../../src/shared/payments/money-math.js';

// Cap subtotal to keep the property test bounded and well within the safe
// integer range. 10^7 minor units = 100 000 major units; ample for a single
// pharmacy transaction and many orders of magnitude under Number.MAX_SAFE_INTEGER.
const SUBTOTAL_MAX_MINOR = 10_000_000;

interface LineInput {
  readonly tender: 'cash' | 'external_card_terminal';
  /** Cashier-entered amount in integer minor units. */
  readonly cashierInputMinor: number;
}

/**
 * Simulate the renderer-side per-line acceptance with the same gates the
 * entry components apply:
 *   - cash: any amount > 0 in bridged mode; under-tender is allowed
 *     (split-tender); over-tender → change_due records the excess.
 *   - external_card_terminal: amount MUST equal remainingBalanceMinor;
 *     anything else is refused (FR-010).
 *
 * Returns the per-line outcome plus the new running sum + change_due delta.
 */
function applyLine(
  remaining: number,
  line: LineInput,
): {
  accepted: boolean;
  appliedToSumMinor: number;
  changeDueMinor: number;
} {
  if (remaining === 0) {
    // Nothing left to pay — no further line can be applied.
    return { accepted: false, appliedToSumMinor: 0, changeDueMinor: 0 };
  }
  if (line.cashierInputMinor <= 0) {
    return { accepted: false, appliedToSumMinor: 0, changeDueMinor: 0 };
  }
  if (line.tender === 'external_card_terminal') {
    if (line.cashierInputMinor !== remaining) {
      return { accepted: false, appliedToSumMinor: 0, changeDueMinor: 0 };
    }
    return { accepted: true, appliedToSumMinor: remaining, changeDueMinor: 0 };
  }
  // cash
  if (line.cashierInputMinor <= remaining) {
    // Partial or exact cash apply — entire input contributes to the running sum.
    return {
      accepted: true,
      appliedToSumMinor: line.cashierInputMinor,
      changeDueMinor: 0,
    };
  }
  // Cash overpay: the running sum gets `remaining`, the rest is change due.
  const changeDue = computeChangeDueMinor(line.cashierInputMinor, remaining);
  return {
    accepted: true,
    appliedToSumMinor: remaining,
    changeDueMinor: changeDue,
  };
}

describe('T163 — settlement-invariant property (fast-check)', () => {
  it('running sum is always a safe non-negative integer and never exceeds the subtotal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: SUBTOTAL_MAX_MINOR }),
        fc.array(
          fc.record<LineInput>({
            tender: fc.constantFrom('cash', 'external_card_terminal'),
            cashierInputMinor: fc.integer({ min: 0, max: SUBTOTAL_MAX_MINOR * 2 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (subtotal, lines) => {
          let runningSum = 0;
          for (const line of lines) {
            const remaining = subtotal - runningSum;
            const out = applyLine(remaining, line);
            if (!out.accepted) {
              continue;
            }
            const nextSum = runningSum + out.appliedToSumMinor;
            expect(Number.isSafeInteger(nextSum)).toBe(true);
            expect(nextSum).toBeGreaterThanOrEqual(0);
            expect(nextSum).toBeLessThanOrEqual(subtotal);
            // Monotonically non-decreasing.
            expect(nextSum).toBeGreaterThanOrEqual(runningSum);
            runningSum = nextSum;
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('total cashier input equals running sum + total change due', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: SUBTOTAL_MAX_MINOR }),
        fc.array(
          fc.record<LineInput>({
            tender: fc.constantFrom('cash', 'external_card_terminal'),
            cashierInputMinor: fc.integer({ min: 0, max: SUBTOTAL_MAX_MINOR * 2 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (subtotal, lines) => {
          let runningSum = 0;
          let totalChangeDue = 0;
          let totalAcceptedInput = 0;
          for (const line of lines) {
            const remaining = subtotal - runningSum;
            const out = applyLine(remaining, line);
            if (!out.accepted) {
              continue;
            }
            // Only the lines we accepted contribute on either side.
            totalAcceptedInput += line.cashierInputMinor;
            runningSum += out.appliedToSumMinor;
            totalChangeDue += out.changeDueMinor;
          }
          // Per-line: applied + changeDue = cashierInput  →  sum + changeDue = totalInput.
          expect(runningSum + totalChangeDue).toBe(totalAcceptedInput);
          expect(Number.isSafeInteger(runningSum)).toBe(true);
          expect(Number.isSafeInteger(totalChangeDue)).toBe(true);
          expect(Number.isSafeInteger(totalAcceptedInput)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('an exact-amount external_card_terminal apply always brings the sum to the subtotal', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: SUBTOTAL_MAX_MINOR }), (subtotal) => {
        const out = applyLine(subtotal, {
          tender: 'external_card_terminal',
          cashierInputMinor: subtotal,
        });
        expect(out.accepted).toBe(true);
        expect(out.appliedToSumMinor).toBe(subtotal);
        expect(out.changeDueMinor).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it('an external_card_terminal overpay or underpay is rejected (FR-010)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: SUBTOTAL_MAX_MINOR }),
        fc.integer({ min: -1, max: 1 }).filter((d) => d !== 0),
        (remaining, delta) => {
          const input = remaining + delta;
          if (input <= 0) {
            return; // outside the test's gates; already covered by accepted: false on 0.
          }
          const out = applyLine(remaining, {
            tender: 'external_card_terminal',
            cashierInputMinor: input,
          });
          expect(out.accepted).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('cash overpay records the change due (sum hits remaining, excess becomes change)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: SUBTOTAL_MAX_MINOR }),
        fc.integer({ min: 1, max: SUBTOTAL_MAX_MINOR }),
        (remaining, excess) => {
          const out = applyLine(remaining, {
            tender: 'cash',
            cashierInputMinor: remaining + excess,
          });
          expect(out.accepted).toBe(true);
          expect(out.appliedToSumMinor).toBe(remaining);
          expect(out.changeDueMinor).toBe(excess);
        },
      ),
      { numRuns: 200 },
    );
  });
});
