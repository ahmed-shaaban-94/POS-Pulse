/**
 * 010-pos-catalog-read-down-consumption T015b — `mapSellableRow`.
 *
 * Maps the SHIPPED backend `SellableCatalogRow` (Data-Pulse-2 PR #490,
 * `GET /api/pos/v1/catalog/snapshot`) to the internal `{ product, barcodes[] }`
 * record 009's read model needs. Pure (no I/O); the ONLY arithmetic is the exact
 * decimal-string → integer-minor-unit parse — NEVER a JS float.
 *
 * The backend `SellableCatalogRow` shape is mirrored here as a LOCAL structural
 * type. The generated `src/shared/api-types.ts` is NOT yet re-pinned from the
 * deployed contract (T002 is blocked on D-DEPLOY / issue #349) — re-pinning is
 * out of this slice's scope and api-types.ts MUST NOT be hand-edited. When the
 * re-pin lands, this local type is replaced by the generated one.
 *
 * Three owner-ratified GAP mappings (a6-reconciliation-findings.md):
 *   • GAP-1 (money): `price{amount,currency_code}` → integer `price_minor`. Parse
 *     the decimal STRING and scale by 10^exponent using integer/string math
 *     (EGP exponent 2, keyed off `currency_code` for forward-compat — v1 is
 *     single-currency-per-store = EGP, NOT a multi-currency feature). Reject
 *     non-representable amounts (too many fractional digits, non-numeric,
 *     negative, or > Number.MAX_SAFE_INTEGER) as malformed (FR-9) — returned as
 *     `{ ok:false }`, never thrown, so the writer counts it uniformly.
 *   • D-NAME: single `name` → `name_ar := name`, `name_en := null`. Fold
 *     composition is the writer's job (R1); the mapper only carries the names.
 *   • D-BARCODE: each untyped `aliases[]` entry → one barcode record
 *     (`barcode := alias`, `barcode_kind := null`, `barcode_id` synthesized).
 *     `sku` is a distinct typed field and is NOT treated as a barcode.
 */

/** The SHIPPED backend catalogue row (local mirror; see file header re: api-types). */
export interface SellableCatalogRow {
  product_id: string;
  sku: string;
  /** Single language-neutral name (no ar/en split in v1 — GAP-3 / D-NAME). */
  name: string;
  /** Opaque non-sku terms (barcode | plu | supplier_code | …); untyped (D-BARCODE). */
  aliases?: string[];
  /** Exact-decimal string amount + ISO-4217 currency; NEVER a float. */
  price: { amount: string; currency_code: string };
  tax_category: string;
  active: boolean;
  /** Opaque per-row provenance token (carried into `row_version`). */
  row_cursor: string;
}

/**
 * The internal product record (pre-fold). Fold columns (`name_fold`,
 * `alias_fold`, `sku_norm`) are computed by the WRITER via 009's `normalize()`
 * (R1) — the mapper does not fold. `tenant_id` / `branch_id` are stamped by the
 * writer from the injected device-principal scope (the source row carries neither).
 */
export interface MappedProduct {
  product_id: string;
  sku: string;
  name_ar: string;
  name_en: string | null;
  aliases_json: string | null;
  price_minor: number;
  tax_category: string;
  unit_pack_label: string | null;
  active: 0 | 1;
  controlled_substance: 0 | 1;
  prescription_required: 0 | 1;
  row_version: string;
  created_at: string;
  updated_at: string;
}

/** The internal barcode record (pre-fold). `barcode_norm` is the writer's job. */
export interface MappedBarcode {
  barcode_id: string;
  product_id: string;
  barcode: string;
  barcode_kind: string | null;
}

/** The internal `{ product, barcodes[] }` record the writer stages. */
export interface MappedRecord {
  product: MappedProduct;
  barcodes: MappedBarcode[];
}

export type MapResult = { ok: true; value: MappedRecord } | { ok: false; reason: string };

/** Minor-unit exponent by ISO-4217 currency (v1 single-currency-per-store = EGP). */
const CURRENCY_MINOR_UNIT_EXPONENT: Readonly<Record<string, number>> = {
  EGP: 2,
  USD: 2,
  JPY: 0,
  KWD: 3,
  BHD: 3,
};
const DEFAULT_MINOR_UNIT_EXPONENT = 2;

function exponentFor(currencyCode: string): number {
  return CURRENCY_MINOR_UNIT_EXPONENT[currencyCode] ?? DEFAULT_MINOR_UNIT_EXPONENT;
}

/**
 * Exact decimal-string → integer minor units. Pure string/integer math; never
 * touches a JS float. Returns null for any non-representable input (the caller
 * maps null → a rejected record, FR-9).
 *
 * Accepts an optional leading '-', digits, an optional single '.' with at most
 * `exponent` fractional digits. Pads/validates the fraction against the exponent
 * so a value with MORE fractional digits than the currency supports is rejected
 * (it cannot be represented in whole minor units).
 */
export function decimalStringToMinorUnits(amount: string, exponent: number): number | null {
  if (typeof amount !== 'string') return null;
  const trimmed = amount.trim();
  // Strict grammar: optional sign, integer part, optional fractional part.
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (match === null) return null;

  const [, signGroup, intGroup, fracGroup] = match;
  // `intGroup` is guaranteed by the required `(\d+)` group, but the type is
  // `string | undefined`; guard explicitly rather than assert.
  if (intGroup === undefined) return null;
  const sign = signGroup === '-' ? -1 : 1;
  const intPart = intGroup;
  const fracPart = fracGroup ?? '';

  // More fractional digits than the currency exponent → not representable in
  // whole minor units (e.g. "9.999" for EGP/exp-2). Reject (FR-9).
  if (fracPart.length > exponent) return null;

  // Pad the fraction out to exactly `exponent` digits, then concatenate.
  const fracPadded = fracPart.padEnd(exponent, '0');
  const minorDigits = `${intPart}${fracPadded}`;

  // Parse as an integer via Number on a pure-digit string (no float rounding for
  // values within the safe-integer range; we reject anything outside it).
  const magnitude = Number(minorDigits);
  if (!Number.isSafeInteger(magnitude)) return null;

  const minor = sign * magnitude;
  // Negative price is invalid (P1: price_minor >= 0). Zero is allowed.
  if (minor < 0) return null;
  return minor;
}

let barcodeSeq = 0;
/** Synthesize a per-run-unique barcode id (bag entries carry no upstream id). */
function synthesizeBarcodeId(productId: string): string {
  barcodeSeq += 1;
  return `bc::${productId}::${String(barcodeSeq)}`;
}

export function mapSellableRow(row: SellableCatalogRow): MapResult {
  // GAP-1: money — exact decimal string → integer minor units, never a float.
  const exponent = exponentFor(row.price.currency_code);
  const priceMinor = decimalStringToMinorUnits(row.price.amount, exponent);
  if (priceMinor === null) {
    return {
      ok: false,
      reason: `money_not_representable: amount=${JSON.stringify(row.price.amount)} currency=${row.price.currency_code}`,
    };
  }

  const aliases = row.aliases ?? [];

  // D-NAME: single name → name_ar; name_en := null (no English name in v1).
  const product: MappedProduct = {
    product_id: row.product_id,
    sku: row.sku,
    name_ar: row.name,
    name_en: null,
    aliases_json: aliases.length > 0 ? JSON.stringify(aliases) : null,
    price_minor: priceMinor,
    tax_category: row.tax_category,
    unit_pack_label: null, // not in backend v1
    active: row.active ? 1 : 0,
    controlled_substance: 0, // not in backend v1 — defaults
    prescription_required: 0, // not in backend v1
    row_version: row.row_cursor, // opaque provenance token
    created_at: row.row_cursor, // no backend timestamps in v1; carry the cursor as provenance
    updated_at: row.row_cursor,
  };

  // D-BARCODE: explode each untyped alias into one barcode record (kind null,
  // synthesized id). `sku` is NOT included (it is a distinct typed field).
  const barcodes: MappedBarcode[] = aliases.map((alias) => ({
    barcode_id: synthesizeBarcodeId(row.product_id),
    product_id: row.product_id,
    barcode: alias,
    barcode_kind: null,
  }));

  return { ok: true, value: { product, barcodes } };
}
