/**
 * 005-sales-cart T044 — `line-subtotal` pure function (P1 + NFR-002).
 *
 * Computes `quantity × unit_price_minor` in integer minor units only.
 * Refuses non-integer or negative inputs, and refuses any result that
 * would exceed `Number.MAX_SAFE_INTEGER` (overflow → silent precision loss
 * in JS doubles). The thrown `LineSubtotalError` is generic; it does NOT
 * echo the offending numeric values (PR-1 / Constitution VII).
 *
 * This is the ONLY money arithmetic 005 performs at the line level. No
 * discount math, no tax, no rounding. Cart aggregate (cart_subtotal_minor)
 * is computed as Σ of these results.
 */

export class LineSubtotalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineSubtotalError';
  }
}

/**
 * Compute `quantity × unit_price_minor`.
 *
 * - `quantity` MUST be a positive safe integer (> 0).
 * - `unit_price_minor` MUST be a non-negative safe integer (≥ 0).
 * - The result MUST be a safe integer; overflow is refused, not truncated.
 *
 * On any rule violation, throws `LineSubtotalError` with a generic message.
 */
export function computeLineSubtotal(quantity: number, unit_price_minor: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new LineSubtotalError('invalid quantity');
  }
  if (!Number.isInteger(unit_price_minor) || unit_price_minor < 0) {
    throw new LineSubtotalError('invalid unit_price_minor');
  }
  const result = quantity * unit_price_minor;
  if (!Number.isSafeInteger(result)) {
    throw new LineSubtotalError('subtotal overflow');
  }
  return result;
}
