// 009-product-search-and-barcode-lookup — `ProductSnapshot` cross-module types.
//
// T003 (Phase 1 / Setup). Pure type surface, no logic — the read repo (S2),
// the bridge handlers (S1), and the production resolver (S4) all consume these.
// Source of truth: specs/009-product-search-and-barcode-lookup/data-model.md
//   §"Entity: ProductSnapshot (resolver output — in-memory, not a table)"
// and contracts/{bridge-api,resolver-seam}.md.
//
// `src/shared` is the lowest dependency layer (main + renderer depend on it,
// never the reverse), so the 005 seam shape is MIRRORED here with a note rather
// than imported from `src/main/cart`.

/**
 * (b) The rich display surface the 009 search/confirm UI consumes — for result
 * rows and the confirm panel. This is NOT the cart-line snapshot; only
 * `display_name_ar` + `price_minor` thread downstream today (008 single
 * `display_name`, AD-6). The remaining fields are display-only or
 * forward-looking provenance (data-model.md §"Entity: ProductSnapshot" (b)).
 *
 * Frozen at confirm-time: the cart freezes its own line snapshot at add-time
 * (005 FR-011/FR-013), so later catalogue drift never rewrites a cart line.
 */
export interface ProductSnapshotDisplay {
  /** `products.product_id` — identity for the lookup; not threaded to the cart. */
  readonly product_id: string;
  /** `products.name_ar` — Arabic-first display name; threaded as the cart line `display_name` (AD-6). */
  readonly display_name_ar: string;
  /** `products.name_en` — English display name when available; NOT threaded downstream (008 single-name). */
  readonly display_name_en?: string;
  /** `products.price_minor` — integer minor units, carried verbatim (AD-5); `Number.isSafeInteger`-guarded on read in S2, never here. */
  readonly price_minor: number;
  /** `products.unit_pack_label` — e.g. "×20 tablets"; result/confirm display only. */
  readonly unit_pack_label?: string;
  /** `products.tax_category` — carried for the sale line that would need it; NOT threaded today (008 sale-level VAT, AD-6). */
  readonly tax_category?: string;
  /** The matched `product_barcodes.barcode` for a barcode hit; result/confirm display only. */
  readonly selling_barcode?: string;
  /** `products.sku` — exact-lookup key; result/confirm display only. */
  readonly sku?: string;
  /** `products.active` — sellable guard (FR-18); an inactive product never resolves to a cart line. */
  readonly active: boolean;
  /** `products.controlled_substance` — surfaced for cashier awareness only; enforcement is out of scope. */
  readonly controlled_substance: boolean;
  /** `products.prescription_required` — surfaced only; enforcement is out of scope. */
  readonly prescription_required: boolean;
}

/**
 * (a) The seam subset the 005 cart consumes at add-time.
 *
 * **§A1 ratified 2026-05-30 (Ahmed):** this mirrors 005's **live**
 * `ItemRefResolver` success shape `{ display_name, unit_price_minor }`
 * (`src/main/cart/cart-bridge.ts:81`) — there is **no `version` field**.
 *
 * 009's contracts originally documented a `version` token (←
 * `products.row_version`, forward-looking provenance per research §R9), but
 * 005's live seam never carried or consumed it. The ratified decision is to
 * match the live signature and **defer `version`** until a real consumer
 * exists — adding it later is an additive change agreed with the 005 owner,
 * not assumed by 009. The production resolver (S4 / T040–T041) satisfies this
 * exact shape, so 005's fixture tests stay green.
 */
export interface ResolvedSeam {
  /** ← `products.name_ar` (the single Arabic-first name, AD-6). */
  readonly display_name: string;
  /** ← `products.price_minor` (integer minor units, AD-5). */
  readonly unit_price_minor: number;
}
