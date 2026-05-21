/**
 * 006-payments-tender Slice 2 — money-math helper.
 *
 * Constitution §II "Money is integer minor units only" makes this module
 * load-bearing: any float, NaN, Infinity, or negative slipping through
 * silently would be a constitutional violation. The Number.isSafeInteger
 * guards on every input + the output make the contract explicit.
 *
 * Throws on under-tender by design: callers must already know
 * amountAppliedMinor ≥ remainingBalanceMinor before invoking (the renderer
 * gates the call behind the Confirm-enabled predicate). Throwing here is
 * the belt to the renderer's braces — the cash line cannot be settled
 * under-tendered (FR-005 / US1-AS3).
 */

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer (got ${String(value)})`);
  }
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative (got ${String(value)})`);
  }
}

export function computeChangeDueMinor(
  amountAppliedMinor: number,
  remainingBalanceMinor: number,
): number {
  assertSafeNonNegativeInteger(amountAppliedMinor, 'amountAppliedMinor');
  assertSafeNonNegativeInteger(remainingBalanceMinor, 'remainingBalanceMinor');

  if (amountAppliedMinor < remainingBalanceMinor) {
    throw new RangeError(
      `amountAppliedMinor (${String(amountAppliedMinor)}) is less than remainingBalanceMinor ` +
        `(${String(remainingBalanceMinor)}); under-tender is refused at the FR-005 boundary`,
    );
  }

  return amountAppliedMinor - remainingBalanceMinor;
}
