-- T021 — 009 Slice S2: create the products read model.
-- Schema per specs/009-product-search-and-barcode-lookup/data-model.md
--   §"Entity: Product" and the §A2-ratified DDL
--   (migration-review/s2-migration-review.md §4, decisions D1–D6, Ahmed 2026-05-31).
--
-- READ-ONLY from 009: this feature never INSERTs/UPDATEs/DELETEs a row (AD-2).
-- The table is MUTABLE by a future catalogue-sourcing feature (populate / update
-- / deactivate). It is NOT an audit anchor, so — unlike `sales` / `cart_action_outbox`
-- — it carries NO append-only trigger (Constitution P4 = N/A here).
--
-- Ships EMPTY: zero seed rows. Production shows "catalogue unavailable" (FR-24 /
-- R-RISK-2) until the sourcing feature populates it.
--
-- Money: `price_minor` is INTEGER minor units, non-negative (P1). 009 carries it
-- verbatim and does NO arithmetic (AD-5).
--
-- No FOREIGN KEY clauses (logical FKs only; enforced at the application layer) —
-- per the `0004_audit_events.sql` precedent. Tenant isolation (P17) is the
-- repo's job; the tenant-prefixed indexes below are its query path.
--
-- `*_fold` / `*_norm` columns are precomputed by the sourcing feature using the
-- SAME `src/main/catalogue/normalize.ts` rules the bridge folds queries with, so
-- matching is normalization-insensitive on both sides (FR-12b).

CREATE TABLE IF NOT EXISTS products (
  product_id            TEXT    NOT NULL PRIMARY KEY,
  tenant_id             TEXT    NOT NULL,
  branch_id             TEXT,                                              -- nullable; forward-looking (MVP tenant-scoped, R-RISK-4)
  sku                   TEXT    NOT NULL,                                  -- raw SKU, for display
  sku_norm              TEXT    NOT NULL,                                  -- D1: normalized SKU; the exact-lookup key (FR-9)
  name_ar               TEXT    NOT NULL,                                  -- Arabic-first display name (AD-6)
  name_en               TEXT,                                              -- nullable; English when available
  name_fold             TEXT    NOT NULL,                                  -- D2: fold of name_ar (+ name_en) — substring-search column
  aliases_json          TEXT,                                              -- nullable JSON array of alias strings (FR-13)
  alias_fold            TEXT,                                              -- nullable; fold of aliases for substring search
  price_minor           INTEGER NOT NULL CHECK (price_minor >= 0),         -- integer minor units (P1); carried, never computed
  tax_category          TEXT    NOT NULL,                                  -- D3: carried; NOT threaded downstream today (AD-6)
  unit_pack_label       TEXT,                                              -- nullable; e.g. "×20 أقراص"
  active                INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),                   -- sellable guard (FR-18)
  controlled_substance  INTEGER NOT NULL DEFAULT 0 CHECK (controlled_substance IN (0, 1)),     -- surfaced for awareness only (C1; no enforcement)
  prescription_required INTEGER NOT NULL DEFAULT 0 CHECK (prescription_required IN (0, 1)),    -- surfaced only
  row_version           TEXT    NOT NULL,                                  -- per-product change marker (R9); stays in read model (§A1: NOT threaded through the seam)
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

-- D1/D5: exact SKU lookup, tenant-scoped (FR-9 / P17), restricted to sellable
-- products. NON-unique (D4): per-tenant SKU uniqueness is application-enforced by
-- the sourcing feature, not a SQL constraint (mirrors 005's app-layer Q4 rule).
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku_norm
  ON products (tenant_id, sku_norm)
  WHERE active = 1;

-- D2/D5/D6: folded substring name search, tenant-scoped, sellable-only (FR-11/12,
-- R4). A leading-wildcard `contains` is not index-served; this narrows the scan
-- set by tenant + active and the column is the prefolded scan target. FTS5 is the
-- documented fallback (R-RISK-1) only if §A5 bring-up misses NFR-2.
CREATE INDEX IF NOT EXISTS idx_products_tenant_name_fold
  ON products (tenant_id, name_fold)
  WHERE active = 1;

CREATE INDEX IF NOT EXISTS idx_products_tenant_alias_fold
  ON products (tenant_id, alias_fold)
  WHERE active = 1;
