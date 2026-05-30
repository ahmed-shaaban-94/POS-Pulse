-- T021 — 009 Slice S2: create the product_barcodes mapping (barcode → product).
-- Schema per specs/009-product-search-and-barcode-lookup/data-model.md
--   §"Entity: ProductBarcode" and the §A2-ratified DDL
--   (migration-review/s2-migration-review.md §4, Ahmed 2026-05-31).
--
-- READ-ONLY from 009 (AD-2); MUTABLE by the future sourcing feature; NOT an
-- audit anchor → NO append-only trigger. Ships EMPTY.
--
-- Logical FK `product_id` → `products.product_id` is NOT a SQL FOREIGN KEY
-- (per the `0004_audit_events.sql` precedent); the repo joins to active products
-- and treats a dangling/inactive mapping as not-found-for-selling.

CREATE TABLE IF NOT EXISTS product_barcodes (
  barcode_id    TEXT NOT NULL PRIMARY KEY,
  product_id    TEXT NOT NULL,            -- logical FK → products.product_id (NOT SQL-enforced)
  tenant_id     TEXT NOT NULL,            -- denormalized for tenant-scoped index lookups
  barcode       TEXT NOT NULL,            -- raw EAN/GTIN value
  barcode_norm  TEXT NOT NULL,            -- normalized (trim + numeral-fold via normalize.ts) — indexed exact-lookup key (R2/R3)
  barcode_kind  TEXT,                     -- nullable; 'pack' | 'unit' informational
  created_at    TEXT NOT NULL
);

-- Exact barcode lookup, tenant-scoped (R2/R3 / P17). NON-unique by design (D4):
--   • one barcode → several rows for ONE product (pack + unit) is normal;
--   • one barcode → ≥2 DISTINCT active product_id is the ambiguity block (FR-7),
--     detected via COUNT(DISTINCT product_id) at the repo — NOT prevented here.
CREATE INDEX IF NOT EXISTS idx_product_barcodes_tenant_norm
  ON product_barcodes (tenant_id, barcode_norm);

-- Reverse lookup: all barcodes for a product.
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product
  ON product_barcodes (product_id);
