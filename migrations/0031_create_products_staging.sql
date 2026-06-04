-- 010-pos-catalog-read-down-consumption Slice S1 (T011) — create products_staging.
-- Schema per specs/010-pos-catalog-read-down-consumption/data-model.md §"Entity:
-- ProductsStaging" and the §A2-class migration-review (migration-review/
-- s1-migration-review.md §4, owner-ratified 2026-06-05).
--
-- TRANSIENT bulk-write target for the read-down. Column-identical to 009's live
-- `products` (0029) so the promote is a straight INSERT … SELECT — EXCEPT the
-- store/branch scope, which is STRICTER here:
--   • `branch_id` is TEXT NOT NULL (§A2 D6, ratified 2026-06-05): read-down is
--     store-scoped by the device principal (Data-Pulse-2 PR #490; device scope =
--     (tenant_id, store_id)). A staged catalogue row WITHOUT store scope is
--     invalid (price/availability/tax vary by store). 009's live products.branch_id
--     stays nullable (0029, unchanged); staging being stricter than live is
--     intended — the promote INSERT … SELECT carries the non-null staged value
--     into the nullable live column (fully compatible). The writer rejects any
--     source row lacking resolvable store scope before it reaches staging.
--
-- WRITTEN by 010 (bulk write per run); NEVER read by 009 (no lookup/search/resolve
-- query references it). NOT an audit anchor → NO append-only trigger (P4 N/A);
-- the whole-replace promote (DELETE live + INSERT … SELECT) is the intended
-- mutation pattern. Ships EMPTY — the read model is filled at runtime.
--
-- Money: `price_minor` is INTEGER minor units, non-negative (P1). 010 converts the
-- backend decimal+currency to integer minor units at the ingest validation
-- boundary (string → integer, NEVER a float); the promote is a pure row-move.
--
-- No FOREIGN KEY clauses (logical FKs only — `0004_audit_events.sql` precedent).
--
-- Staging carries NO lookup indexes: 009 never reads it, so an index would only
-- slow the bulk write (§A2 D1). Indexes live solely on the live `products` table.
--
-- `*_fold` / `*_norm` columns are computed by the writer with the SAME 009
-- `src/main/catalogue/normalize.ts` rules the bridge folds queries with, so
-- matching is normalization-insensitive on both sides (R1 / FR-3).

CREATE TABLE IF NOT EXISTS products_staging (
  product_id            TEXT    NOT NULL PRIMARY KEY,
  tenant_id             TEXT    NOT NULL,
  branch_id             TEXT    NOT NULL,                                   -- §A2 D6: store/branch scope NOT NULL (device scope = (tenant_id, store_id), PR #490). Stricter than live 0029 (nullable) — promote non-null→nullable is fine.
  sku                   TEXT    NOT NULL,
  sku_norm              TEXT    NOT NULL,                                   -- normalize(sku)
  name_ar               TEXT    NOT NULL,                                  -- D-NAME: := backend single `name` (stays NOT NULL; ingest always supplies name)
  name_en               TEXT,                                              -- D-NAME: := NULL in v1 (no English name available)
  name_fold             TEXT    NOT NULL,                                  -- R1: normalize(name_ar + ' ' + (name_en ?? '')) — collapses to normalize(name_ar) when name_en is NULL
  aliases_json          TEXT,                                              -- nullable JSON array of alias strings
  alias_fold            TEXT,                                              -- nullable; normalize(aliases.join(' '))
  price_minor           INTEGER NOT NULL CHECK (price_minor >= 0),         -- integer minor units (P1); converted at ingest, never computed here
  tax_category          TEXT    NOT NULL,
  unit_pack_label       TEXT,                                              -- nullable; not in backend v1 — always NULL until a backend spec adds it
  active                INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  controlled_substance  INTEGER NOT NULL DEFAULT 0 CHECK (controlled_substance IN (0, 1)),     -- not in backend v1 — defaults until added
  prescription_required INTEGER NOT NULL DEFAULT 0 CHECK (prescription_required IN (0, 1)),    -- not in backend v1
  row_version           TEXT    NOT NULL,                                  -- backend row_cursor / updated_at provenance
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);
-- Staging carries NO lookup indexes (009 never reads it). Indexes live only on the live tables.
