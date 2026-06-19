/**
 * POS v3.5 Phase 3 — cash quick-amount suggestions.
 *
 * Pure UI affordance. From a sale total (integer minor units) produce up to 5
 * ascending "round up to the next banknote" suggestions, each >= total, with
 * the exact total first. This is presentation help for the cashier — it is NOT
 * settlement math. Change-due is computed only by `computeChangeDueMinor`
 * (money-math.ts); nothing here subtracts or settles.
 *
 * Banknote ladder (EGP notes, in piasters): 50, 100, 200, 500, 1000.
 * Mirrors the v3.5 design reference's `quickAmounts`. Recreated against the
 * repo's safe-integer money discipline (Constitution §II), not copied.
 */

const BANKNOTES_MINOR = [5000, 10000, 20000, 50000, 100000] as const;
const MAX_SUGGESTIONS = 5;

export function quickAmounts(totalMinor: number): number[] {
  if (!Number.isSafeInteger(totalMinor)) {
    throw new RangeError(`totalMinor must be a safe integer (got ${String(totalMinor)})`);
  }
  if (totalMinor < 0) {
    throw new RangeError(`totalMinor must be non-negative (got ${String(totalMinor)})`);
  }

  const candidates = [totalMinor];
  for (const note of BANKNOTES_MINOR) {
    candidates.push(Math.ceil(totalMinor / note) * note);
  }

  return [...new Set(candidates)]
    .filter((v) => v >= totalMinor)
    .sort((a, b) => a - b)
    .slice(0, MAX_SUGGESTIONS);
}
