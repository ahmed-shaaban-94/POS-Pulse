/**
 * 009-product-search-and-barcode-lookup T024/T027 — `product-repo`.
 *
 * Read-only SQL access to the `products` / `product_barcodes` read model
 * (data-model.md §"Entity: Product" / §"Entity: ProductBarcode"). 009 NEVER
 * writes these tables (AD-2) — there is no insert/update/delete here.
 *
 * Surface (exact lookup only — folded search is S3, the 005 seam is S4):
 *   • lookupByBarcode(tenant, rawBarcode) — exact barcode match (FR-4)
 *   • lookupBySku(tenant, rawSku)         — exact SKU match (FR-9)
 *
 * Both fold the raw query with the SAME `normalize()` the sourcing feature used
 * for `barcode_norm` / `sku_norm`, so matching is normalization-insensitive on
 * both sides (FR-12b). Every query is tenant-scoped IN SQL (`WHERE tenant_id = ?`,
 * P17) — a cross-tenant row never leaves the query — and restricted to active
 * products (`active = 1`, FR-18); inactive products are not-found-for-selling.
 *
 * Result discrimination (the spine of S2):
 *   • catalogue empty / missing / unreadable → `unavailable` (FR-24; the bridge
 *     maps this to `catalogue_unavailable`, DISTINCT from `not_found`).
 *   • zero active matches against a populated, readable catalogue → `not_found`.
 *   • exactly one DISTINCT active product → `one`.
 *   • > 1 DISTINCT active product for the key → `ambiguous` (FR-7; never picks one).
 *
 * Mirrors the DI'd `DatabaseHandle` repo discipline of `sales.repository.ts`:
 * the handle is injected so tests run on sql.js without the native binding.
 */

import type { DatabaseHandle } from '../db/client.js';
import type { ProductSnapshotDisplay } from '../../shared/catalogue/product-snapshot.js';
import { normalize } from './normalize.js';

// ── Narrow better-sqlite3 statement surfaces (no native binding at test time) ──

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}
interface PrepareAll<Row> {
  all(...params: unknown[]): Row[];
}

/** The product columns the display snapshot + the (S4) seam are built from. */
interface ProductRow {
  product_id: string;
  sku: string;
  name_ar: string;
  name_en: string | null;
  price_minor: number;
  unit_pack_label: string | null;
  // NOT NULL in the schema (D3) — always a string at runtime.
  tax_category: string;
  active: number;
  controlled_substance: number;
  prescription_required: number;
}

/** The discriminated read result. `unavailable` is the repo's infra signal. */
export type ProductLookupResult =
  | { kind: 'one'; product: ProductSnapshotDisplay }
  | { kind: 'not_found' }
  | { kind: 'ambiguous' }
  | { kind: 'unavailable' };

export interface ProductRepo {
  /** Exact barcode lookup (FR-4). `rawBarcode` is folded via `normalize()`. */
  lookupByBarcode(tenantId: string, rawBarcode: string): ProductLookupResult;
  /** Exact SKU lookup (FR-9). `rawSku` is folded via `normalize()`. */
  lookupBySku(tenantId: string, rawSku: string): ProductLookupResult;
}

// Qualified with the `p.` alias: in the barcode JOIN, `products` and
// `product_barcodes` share column names (product_id, tenant_id, created_at), so
// an unqualified list raises "ambiguous column name". The SKU query aliases its
// table `p` too, so the same list serves both.
const PRODUCT_COLUMNS = `
  p.product_id, p.sku, p.name_ar, p.name_en, p.price_minor, p.unit_pack_label,
  p.tax_category, p.active, p.controlled_substance, p.prescription_required`;

export function createProductRepo(db: DatabaseHandle): ProductRepo {
  /**
   * Is the read model present and non-empty? This is the discriminator between
   * `unavailable` (empty/missing) and `not_found` (populated, no match). Any
   * throw (missing table / unreadable handle) is itself an unavailable signal,
   * surfaced by the caller's try/catch.
   */
  function catalogueHasRows(): boolean {
    const stmt = db.prepare('SELECT 1 FROM products LIMIT 1') as PrepareGet<{ 1: number }>;
    return stmt.get() !== undefined;
  }

  function toSnapshot(row: ProductRow, sellingBarcode?: string): ProductSnapshotDisplay {
    return {
      product_id: row.product_id,
      display_name_ar: row.name_ar,
      ...(row.name_en !== null ? { display_name_en: row.name_en } : {}),
      // `price_minor` is carried verbatim (AD-5). The migration's NOT NULL
      // CHECK(>= 0) guarantees a non-negative integer; the `Number.isSafeInteger`
      // refusal for a corrupt row lives on the resolve path (S4 / FR-19), not on
      // the read — surfacing a display snapshot does not commit money.
      price_minor: row.price_minor,
      ...(row.unit_pack_label !== null ? { unit_pack_label: row.unit_pack_label } : {}),
      // `tax_category` is NOT NULL in the schema (D3), so it is always present.
      tax_category: row.tax_category,
      ...(sellingBarcode !== undefined ? { selling_barcode: sellingBarcode } : {}),
      sku: row.sku,
      active: row.active === 1,
      controlled_substance: row.controlled_substance === 1,
      prescription_required: row.prescription_required === 1,
    };
  }

  function lookupByBarcode(tenantId: string, rawBarcode: string): ProductLookupResult {
    const barcodeNorm = normalize(rawBarcode);
    try {
      if (!catalogueHasRows()) return { kind: 'unavailable' };

      // Join active products to the barcode mapping within tenant. Multiple rows
      // for ONE product (pack + unit) collapse via DISTINCT product_id; ≥ 2
      // distinct active products is the ambiguity block (FR-7).
      const stmt = db.prepare(`
        SELECT DISTINCT ${PRODUCT_COLUMNS}, pb.barcode AS selling_barcode
        FROM product_barcodes pb
        JOIN products p ON p.product_id = pb.product_id AND p.tenant_id = pb.tenant_id
        WHERE pb.tenant_id = ? AND pb.barcode_norm = ? AND p.active = 1
      `) as PrepareAll<ProductRow & { selling_barcode: string }>;
      const rows = stmt.all(tenantId, barcodeNorm);

      return discriminate(rows, (r) => toSnapshot(r, r.selling_barcode));
    } catch {
      // Missing table / unreadable handle → the catalogue is unavailable, not
      // an error echoed across the bridge (FR-24; never throws across IPC).
      return { kind: 'unavailable' };
    }
  }

  function lookupBySku(tenantId: string, rawSku: string): ProductLookupResult {
    const skuNorm = normalize(rawSku);
    try {
      if (!catalogueHasRows()) return { kind: 'unavailable' };

      const stmt = db.prepare(`
        SELECT ${PRODUCT_COLUMNS}
        FROM products p
        WHERE p.tenant_id = ? AND p.sku_norm = ? AND p.active = 1
      `) as PrepareAll<ProductRow>;
      const rows = stmt.all(tenantId, skuNorm);

      return discriminate(rows, (r) => toSnapshot(r));
    } catch {
      return { kind: 'unavailable' };
    }
  }

  return { lookupByBarcode, lookupBySku };
}

/**
 * Map matched product rows to a lookup result by DISTINCT product_id count.
 * Zero → not_found; one distinct product → one; more → ambiguous (never picks).
 */
function discriminate<R extends { product_id: string }>(
  rows: R[],
  toProduct: (row: R) => ProductSnapshotDisplay,
): ProductLookupResult {
  const [first] = rows;
  if (first === undefined) return { kind: 'not_found' };
  const distinctIds = new Set(rows.map((r) => r.product_id));
  if (distinctIds.size > 1) return { kind: 'ambiguous' };
  return { kind: 'one', product: toProduct(first) };
}
