-- T041 — `cart_action_outbox` table for 005-sales-cart S2 (§A2-gated).
-- Schema per specs/005-sales-cart/data-model.md §"Entity: CartActionOutbox".
--
-- APPEND-ONLY (Constitution P4). UPDATE and DELETE are denied by trigger.
-- This is the cart layer's audit-equivalent surface (sensitive cart actions
-- additionally emit into 004's `audit_events` table — but that emission
-- lands in S3, NOT here).
--
-- `line_id` is NULLABLE: four action_kind values are cart-level and carry
-- no line: cart.create, cart.void, cart.handoff_to_payment,
-- cart.discarded_on_session_end (see data-model.md line 149).
--
-- `action_id` doubles as the P5 idempotency key (FR-018). Two replays with
-- the same action_id and identical canonicalised payload return the
-- original outcome; same action_id with a different payload is refused
-- generically at the bridge layer.
--
-- No FK constraints: app-layer enforcement only (mirrors 0004_audit_events
-- precedent).

CREATE TABLE IF NOT EXISTS cart_action_outbox (
  action_id                 TEXT    NOT NULL PRIMARY KEY,
  cart_id                   TEXT    NOT NULL,
  -- Nullable: cart-level action kinds carry no line.
  line_id                   TEXT,

  action_kind               TEXT    NOT NULL
                            CHECK (action_kind IN (
                              'cart.create',
                              'cart.line.add',
                              'cart.line.update',
                              'cart.line.merge',
                              'cart.line.remove',
                              'cart.line.note_set',
                              'cart.discount_placeholder.add',
                              'cart.discount_placeholder.remove',
                              'cart.void',
                              'cart.handoff_to_payment',
                              'cart.cancel.post_handoff',
                              'cart.discount.above_threshold',
                              'cart.discarded_on_session_end'
                            )),

  acting_operator_id        TEXT    NOT NULL,
  -- Manager identity for manager-attributed actions; otherwise NULL.
  attribution_operator_id   TEXT,
  operator_session_id       TEXT    NOT NULL,

  -- Canonicalised JSON of the action input, post-redaction (NFR-006).
  payload_json              TEXT    NOT NULL,

  applied_at                TEXT    NOT NULL,
  -- Reserved for a future backend-sync pipeline; not used in 005.
  synced_at                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_cart_action_outbox_cart
  ON cart_action_outbox (cart_id);

CREATE INDEX IF NOT EXISTS idx_cart_action_outbox_line
  ON cart_action_outbox (line_id);

CREATE INDEX IF NOT EXISTS idx_cart_action_outbox_action_kind
  ON cart_action_outbox (action_kind);

-- Append-only: deny UPDATE. Mirrors trg_audit_events_no_update.
CREATE TRIGGER IF NOT EXISTS trg_cart_action_outbox_no_update
BEFORE UPDATE ON cart_action_outbox
BEGIN
  SELECT RAISE(ABORT, 'cart_action_outbox is append-only: UPDATE is denied');
END;

-- Append-only: deny DELETE. Mirrors trg_audit_events_no_delete.
CREATE TRIGGER IF NOT EXISTS trg_cart_action_outbox_no_delete
BEFORE DELETE ON cart_action_outbox
BEGIN
  SELECT RAISE(ABORT, 'cart_action_outbox is append-only: DELETE is denied');
END;
