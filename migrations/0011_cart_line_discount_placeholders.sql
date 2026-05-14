-- T043 — `cart_line_discount_placeholders` table for 005-sales-cart S2.
-- Schema per specs/005-sales-cart/data-model.md §"Entity: CartLineDiscountPlaceholder".
--
-- MUTABLE (Constitution P4). The cart layer does NOT compute the discounted
-- amount; the placeholder is informational until the future payment /
-- checkout feature applies discount math (FR-022, FR-024).
--
-- `requires_manager_attribution = 1` AND `attribution_operator_id IS NULL`
-- places the cart in state `discount_pending_attribution` (handled at the
-- bridge layer, not in SQL).
--
-- No FK constraints (mirrors precedent). Application layer enforces that
-- (cart_id, line_id) reference a real row.

CREATE TABLE IF NOT EXISTS cart_line_discount_placeholders (
  placeholder_id                   TEXT    NOT NULL PRIMARY KEY,
  cart_id                          TEXT    NOT NULL,
  line_id                          TEXT    NOT NULL,

  -- Opaque token; magnitude catalogue owned by the future payments feature.
  placeholder_kind                 TEXT    NOT NULL,

  -- 0/1 boolean. True when magnitude exceeds the tenant-configured threshold.
  requires_manager_attribution     INTEGER NOT NULL
                                   CHECK (requires_manager_attribution IN (0, 1)),

  -- Manager Clerk-backed identity. Non-null only when attribution recorded.
  attribution_operator_id          TEXT,

  created_at                       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cart_line_discount_placeholders_cart
  ON cart_line_discount_placeholders (cart_id);

CREATE INDEX IF NOT EXISTS idx_cart_line_discount_placeholders_line
  ON cart_line_discount_placeholders (line_id);
