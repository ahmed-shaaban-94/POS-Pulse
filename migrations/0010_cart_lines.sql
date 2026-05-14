-- T042 — `cart_lines` table for 005-sales-cart S2 (§A2-gated).
-- Schema per specs/005-sales-cart/data-model.md §"Entity: CartLine".
--
-- MUTABLE (Constitution P4): cart lifecycle includes update, line-edit,
-- line-removal, void; the append-only constraint applies only to
-- `cart_action_outbox`, not to this table.
--
-- `removed_at` is the soft-remove marker. Rows are NEVER hard-deleted
-- (audit continuity). Q4 uniqueness on (cart_id, item_ref) for non-removed
-- rows is enforced at the application layer in `cart.lines.add` — NOT via
-- a SQL UNIQUE constraint (so a soft-removed line can coexist with a later
-- non-removed re-add as a fresh line_id).
--
-- Money columns (`unit_price_minor`, `line_subtotal_minor`) are INTEGER
-- minor units only (P1 / NFR-002). `line_subtotal_minor = quantity ×
-- unit_price_minor` is recomputed on every successful mutation.
--
-- `version` is the optimistic-concurrency token (R2). Starts at 1; advances
-- by exactly one on each successful mutation, including Q4 merges.

CREATE TABLE IF NOT EXISTS cart_lines (
  line_id                   TEXT    NOT NULL PRIMARY KEY,
  cart_id                   TEXT    NOT NULL,

  -- Catalogue reference. Resolved via the R7 seam (`cart.resolveItemRef`).
  item_ref                  TEXT    NOT NULL,
  -- Snapshot at add-time per FR-013; immutable for the life of the line.
  display_name              TEXT    NOT NULL,

  quantity                  INTEGER NOT NULL
                            CHECK (quantity > 0),
  unit_price_minor          INTEGER NOT NULL
                            CHECK (unit_price_minor >= 0),
  line_subtotal_minor       INTEGER NOT NULL
                            CHECK (line_subtotal_minor >= 0),

  -- Free-text note, length ≤ 200 chars (Q1). Bridge enforces length cap
  -- and forbidden-pattern refusal; this column is intentionally permissive
  -- to keep the schema independent of policy parameters.
  note                      TEXT,

  -- Optimistic-concurrency token; advances by 1 per mutation, incl. merges.
  version                   INTEGER NOT NULL DEFAULT 1
                            CHECK (version >= 1),

  -- Pointer into cart_action_outbox for the action that produced current state.
  last_action_id            TEXT    NOT NULL,

  created_at                TEXT    NOT NULL,
  updated_at                TEXT    NOT NULL,
  -- Soft-remove marker. NULL = active line; NOT NULL = removed.
  removed_at                TEXT
);

CREATE INDEX IF NOT EXISTS idx_cart_lines_cart
  ON cart_lines (cart_id);

-- Q4 merge lookup: find existing non-removed line for the same item_ref.
-- Partial index for efficiency; application layer enforces uniqueness.
CREATE INDEX IF NOT EXISTS idx_cart_lines_cart_item_active
  ON cart_lines (cart_id, item_ref)
  WHERE removed_at IS NULL;
