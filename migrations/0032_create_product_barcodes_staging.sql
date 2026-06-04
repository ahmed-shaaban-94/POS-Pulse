-- 010-pos-catalog-read-down-consumption Slice S1 (T012) — create
-- product_barcodes_staging.
-- Schema per specs/010-pos-catalog-read-down-consumption/data-model.md §"Entity:
-- ProductBarcodesStaging" and the §A2-class migration-review (migration-review/
-- s1-migration-review.md §4 / §0a, owner-ratified 2026-06-05).
--
-- TRANSIENT bulk-write target for the read-down's barcode rows. COLUMN-IDENTICAL
-- to 009's live `product_barcodes` (0030) so the promote is a straight
-- INSERT … SELECT. Unlike products_staging it has NO branch/store column of its
-- own (§A2): barcode rows are store-scoped TRANSITIVELY via `tenant_id` + their
-- `product_id` link to a (store-scoped) products_staging row. NO new column is
-- added vs 0030.
--
-- D-BARCODE (owner-ratified 2026-06-04): the backend `aliases[]` is an UNTYPED
-- bag; the writer explodes each entry into one row here (barcode := alias,
-- barcode_norm := normalize(alias), barcode_kind := NULL) and SYNTHESIZES
-- `barcode_id` (bag entries carry no upstream id; fine under the full-replace
-- promote — ids need not be stable across runs). `barcode_kind` stays nullable,
-- always NULL in v1 (the bag carries no type discriminator — lossy, owner-accepted).
--
-- WRITTEN by 010; NEVER read by 009. NOT an audit anchor → NO append-only trigger.
-- Logical FK `product_id` → products_staging.product_id is NOT a SQL FOREIGN KEY
-- (0004 precedent). Ships EMPTY.
--
-- Staging carries NO lookup indexes (009 never reads it; the live 0030 carries
-- the (tenant_id, barcode_norm) scan index).

CREATE TABLE IF NOT EXISTS product_barcodes_staging (
  barcode_id    TEXT NOT NULL PRIMARY KEY,
  product_id    TEXT NOT NULL,            -- logical FK → products_staging.product_id (NOT SQL-enforced)
  tenant_id     TEXT NOT NULL,            -- denormalized; barcode rows scoped via tenant_id + product_id
  barcode       TEXT NOT NULL,            -- raw value from the untyped aliases[] bag (D-BARCODE)
  barcode_norm  TEXT NOT NULL,            -- normalize(barcode)
  barcode_kind  TEXT,                     -- nullable; always NULL in v1 (untyped backend aliases)
  created_at    TEXT NOT NULL
);
-- Staging carries NO lookup indexes (009 never reads it). Indexes live only on the live tables.
