/**
 * Contract: Money
 *
 * Per Constitution Principle II ("Financial Precision — No Floats for Money"),
 * every monetary value in POS-Pulse is represented as an integer count of
 * minor units (e.g. piastres for EGP) wrapped in a `Money` value.
 *
 * In feature 001-foundation no domain code yet uses Money — the module exists
 * so that every later feature consumes a single, well-tested arithmetic seam
 * instead of inventing its own.
 */

/**
 * ISO-4217-style currency code. The MVP supports EGP only; additional codes
 * MUST go through an explicit constitution amendment if introduced (multi-
 * currency rounding rules differ across jurisdictions).
 */
export type CurrencyCode = "EGP";

/**
 * Immutable monetary value.
 *
 *  - `amount` is an INTEGER number of minor units. Non-integer or non-safe-
 *     integer inputs MUST be rejected at construction time.
 *  - `currency` MUST match across the operands of any arithmetic op; mixing
 *    currencies MUST throw.
 */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/**
 * Module surface. Implementations live in `src/shared/money.ts` and are
 * exhaustively tested in `tests/money.test.ts` (≥ 95% line + branch coverage).
 */
export interface MoneyModule {
  /**
   * Construct a Money value. Throws on:
   *   - non-integer `amount`
   *   - amount outside `Number.isSafeInteger` range
   *   - unsupported `currency`
   */
  of(amount: number, currency: CurrencyCode): Money;

  /** Convenience: zero in the given currency. */
  zero(currency: CurrencyCode): Money;

  /** `a + b`. Throws on currency mismatch. */
  add(a: Money, b: Money): Money;

  /** `a - b`. Throws on currency mismatch. */
  subtract(a: Money, b: Money): Money;

  /**
   * Multiply by an integer quantity. Throws on non-integer or non-safe-integer
   * `quantity`. The result MUST satisfy `Number.isSafeInteger`.
   */
  multiply(value: Money, quantity: number): Money;

  /**
   * Distribute `value` into `n` parts whose sum equals `value` exactly.
   * Rounding is "remainder-to-the-front": if `value.amount = 100` and `n = 3`,
   * the result is `[34, 33, 33]`. This is the deterministic, audit-friendly
   * rule pharmacy receipts use for tax-and-discount line distribution.
   */
  allocate(value: Money, n: number): readonly Money[];

  /**
   * Comparators.
   *   - `equals` returns true for same-currency, same-amount values.
   *   - `compare` returns -1 / 0 / 1; throws on currency mismatch.
   */
  equals(a: Money, b: Money): boolean;
  compare(a: Money, b: Money): -1 | 0 | 1;

  /**
   * Format for display. ASCII output only at this layer (locale-aware
   * formatting belongs in the renderer's `formatters` module, not here).
   * Example: `format({ amount: 12345, currency: "EGP" })` → `"123.45 EGP"`.
   */
  format(value: Money): string;
}
