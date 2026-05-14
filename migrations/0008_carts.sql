-- T040 — `carts` table for 005-sales-cart S2 (§A2-gated).
-- Schema per specs/005-sales-cart/data-model.md §"Entity: Cart" and the
-- review record at specs/005-sales-cart/security-review/s2-migration-review.md.
--
-- No FK constraints: this project deliberately omits FOREIGN KEY clauses in
-- SQLite migrations (mirrors migrations/0004_audit_events.sql line 3 and
-- 0006_cashier_pin_records.sql line 4). Enforcement lives at the
-- application layer in `src/main/cart/cart-bridge.ts`.
--
-- `cart_subtotal_minor` is stored in INTEGER minor units only (P1 / NFR-002).
-- The cart layer recomputes it as Σ line_subtotal_minor over non-removed
-- cart_lines on each successful mutation; no floating-point math anywhere.
--
-- Carts are mutable through the cart-bridge handlers (P4: append-only
-- constraint applies to `cart_action_outbox` only; cart lifecycle is
-- intentionally mutable to terminal states `cancelled` / `frozen_handed_off`).

CREATE TABLE IF NOT EXISTS carts (
  cart_id                   TEXT    NOT NULL PRIMARY KEY,
  tenant_id                 TEXT    NOT NULL,
  branch_id                 TEXT    NOT NULL,
  terminal_id               TEXT    NOT NULL,
  owning_operator_id        TEXT    NOT NULL,
  operator_session_id       TEXT    NOT NULL,

  -- FSM state (six values). Application layer enforces legal transitions.
  state                     TEXT    NOT NULL
                            CHECK (state IN (
                              'empty', 'editing', 'discount_pending_attribution',
                              'handing_off', 'frozen_handed_off', 'cancelled'
                            )),

  -- Σ line_subtotal_minor over non-removed cart_lines. Integer minor units.
  cart_subtotal_minor       INTEGER NOT NULL DEFAULT 0
                            CHECK (cart_subtotal_minor >= 0),

  created_at                TEXT    NOT NULL,
  updated_at                TEXT    NOT NULL,
  frozen_at                 TEXT,
  cancelled_at              TEXT,
  cancellation_reason       TEXT
                            CHECK (cancellation_reason IS NULL OR cancellation_reason IN (
                              'cashier_voided', 'manager_voided_post_handoff', 'session_ended'
                            )),

  -- JSON serialisation of the PaymentIntentEnvelope; null until frozen.
  handoff_envelope_json     TEXT,

  -- Pointer into cart_action_outbox for read-after-write verification.
  last_action_id            TEXT
);

-- Lookups by tenant/branch and by owning operator for support queries.
CREATE INDEX IF NOT EXISTS idx_carts_tenant_branch
  ON carts (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_carts_owning_operator
  ON carts (owning_operator_id);

CREATE INDEX IF NOT EXISTS idx_carts_state
  ON carts (state);
