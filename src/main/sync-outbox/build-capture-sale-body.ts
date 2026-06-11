/**
 * 008 sale-sync flush — map a persisted SaleRow to the DP-2 `captureSale`
 * request body (`POST /api/pos/v1/sales`, Option-Y contract).
 *
 * Pure + side-effect-free so it is exhaustively unit-testable. The hard part is
 * money: SaleRow stores MINOR-UNIT INTEGERS (e.g. 1250 piastres), and DP-2
 * requires EXACT-DECIMAL STRINGS at 4 fractional digits (`numeric(19,4)`, gate
 * A.6 — never a float). The conversion is done with integer/string arithmetic
 * only: `123456` minor at 2 digits → `"1234.5600"`. No `Number` division, no
 * `toFixed`, so no binary-float rounding ever touches a money value.
 *
 * Currency code + minor-unit scale are INJECTED (`SaleCurrencyConfig`) — the
 * POS app does not persist a per-sale currency, and the scale is currency-
 * dependent (EGP=2, BHD=3). No hardcoding.
 */
import type { SaleRow } from '../sales/repositories/sales.repository.js';

/** ISO-4217 code + the number of minor-unit digits for that currency. */
export interface SaleCurrencyConfig {
  /** ISO-4217 alphabetic code, e.g. `EGP`. */
  readonly currencyCode: string;
  /** Minor-unit digits, e.g. 2 for EGP (piastres), 3 for BHD (fils). */
  readonly minorDigits: number;
}

/** One line of the captureSale request (mirrors DP-2 CaptureSaleLine). */
export interface CaptureSaleLine {
  readonly lineName: string;
  readonly unitPrice: string;
  readonly currencyCode: string;
  readonly quantity: string;
  readonly lineAmount: string;
  readonly unit: string;
}

/** The captureSale request body (mirrors DP-2 CaptureSaleRequest). */
export interface CaptureSaleBody {
  readonly sourceSystem: string;
  readonly externalId: string;
  readonly currencyCode: string;
  readonly posTotal: string;
  readonly occurredAt: string;
  readonly lines: readonly CaptureSaleLine[];
}

/** Provenance system id — the source half of the `(tenant, sourceSystem, externalId)` dedup key. */
const SOURCE_SYSTEM = 'pos-pulse';

/** DP-2 money is `numeric(19,4)` — always render to 4 fractional digits. */
const TARGET_DECIMALS = 4;

/** Raised when a SaleRow's engine-written JSON column is structurally unparseable (defence-in-depth). */
export class MalformedSaleJsonError extends Error {
  constructor(column: string, cause?: unknown) {
    super(`build-capture-sale-body: ${column} is not valid JSON`);
    this.name = 'MalformedSaleJsonError';
    if (cause !== undefined) this.cause = cause;
  }
}

interface PersistedLineSnapshot {
  display_name?: unknown;
  quantity?: unknown;
  unit_price_minor?: unknown;
  line_subtotal_minor?: unknown;
}

/**
 * Convert a non-negative minor-unit integer to an exact-decimal string at 4
 * fractional digits, using only integer/string ops (no float). `minorDigits`
 * is where the decimal point sits in the minor integer; we then pad/extend to
 * `TARGET_DECIMALS`.
 *
 *   minorToDecimal(1250, 2)   → "12.5000"
 *   minorToDecimal(102500, 3) → "102.5000"
 *   minorToDecimal(0, 2)      → "0.0000"
 */
export function minorToDecimal(minor: number, minorDigits: number): string {
  if (!Number.isInteger(minor) || minor < 0) {
    throw new RangeError(
      `build-capture-sale-body: minor amount must be a non-negative integer (got ${String(minor)})`,
    );
  }
  if (!Number.isInteger(minorDigits) || minorDigits < 0 || minorDigits > TARGET_DECIMALS) {
    throw new RangeError(
      `build-capture-sale-body: minorDigits must be 0..${String(TARGET_DECIMALS)} (got ${String(minorDigits)})`,
    );
  }
  const digits = String(minor);
  // Left-pad so there is at least one integer digit before the minor part.
  const padded = digits.padStart(minorDigits + 1, '0');
  const cut = padded.length - minorDigits;
  const intPart = padded.slice(0, cut);
  const fracMinor = minorDigits === 0 ? '' : padded.slice(cut);
  // Extend the fractional part from `minorDigits` to TARGET_DECIMALS with zeros.
  const frac = (fracMinor + '0'.repeat(TARGET_DECIMALS)).slice(0, TARGET_DECIMALS);
  return `${intPart}.${frac}`;
}

function asNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`build-capture-sale-body: ${field} must be a non-negative integer`);
  }
  return value;
}

/**
 * Build the captureSale body from a finalized SaleRow.
 *
 * - `externalId` = `sale_id` (STABLE per sale → DP-2 dedups `(tenant,
 *   sourceSystem, externalId)`, so re-flushing the same sale never creates a
 *   second sale — safe retries / idempotency).
 * - `posTotal` = (subtotal + tax) minor → exact decimal. Change-due is NOT part
 *   of the sale total.
 * - `occurredAt` = `finalized_at` (the sale's business-event time).
 * - `lines` = `lines_json` (LineSnapshot[]) mapped 1:1; quantity as an integer
 *   string; unit defaults to `ea` (the POS cart has no per-line unit).
 */
export function buildCaptureSaleBody(sale: SaleRow, currency: SaleCurrencyConfig): CaptureSaleBody {
  const { currencyCode, minorDigits } = currency;

  const subtotal = asNonNegativeInt(sale.subtotal_minor, 'subtotal_minor');
  const tax = asNonNegativeInt(sale.total_tax_minor, 'total_tax_minor');
  const posTotal = minorToDecimal(subtotal + tax, minorDigits);

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(sale.lines_json);
  } catch (err) {
    throw new MalformedSaleJsonError('lines_json', err);
  }
  if (!Array.isArray(rawLines)) {
    throw new MalformedSaleJsonError('lines_json');
  }

  const lines: CaptureSaleLine[] = rawLines.map((entry): CaptureSaleLine => {
    const l = entry as PersistedLineSnapshot;
    const unitMinor = asNonNegativeInt(l.unit_price_minor, 'line.unit_price_minor');
    const subtotalMinor = asNonNegativeInt(l.line_subtotal_minor, 'line.line_subtotal_minor');
    const quantity = asNonNegativeInt(l.quantity, 'line.quantity');
    const lineName =
      typeof l.display_name === 'string' && l.display_name.length > 0 ? l.display_name : 'Item';
    return {
      lineName,
      unitPrice: minorToDecimal(unitMinor, minorDigits),
      currencyCode,
      quantity: String(quantity),
      lineAmount: minorToDecimal(subtotalMinor, minorDigits),
      unit: 'ea',
    };
  });

  return {
    sourceSystem: SOURCE_SYSTEM,
    externalId: sale.sale_id,
    currencyCode,
    posTotal,
    occurredAt: sale.finalized_at,
    lines,
  };
}
