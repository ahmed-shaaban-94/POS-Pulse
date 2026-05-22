-- T064 — append-only trigger on `payment_action_outbox`.
-- Per Constitution §P4 / §P16 and data-model.md §"Entity: PaymentActionOutbox"
-- Invariant 1. Mirrors the pattern in migrations/0009_cart_action_outbox.sql
-- (cart-side outbox) and 0004_audit_events.sql (audit-event store).

CREATE TRIGGER IF NOT EXISTS trg_payment_action_outbox_no_update
BEFORE UPDATE ON payment_action_outbox
BEGIN
  SELECT RAISE(ABORT, 'payment_action_outbox is append-only: UPDATE is denied');
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_action_outbox_no_delete
BEFORE DELETE ON payment_action_outbox
BEGIN
  SELECT RAISE(ABORT, 'payment_action_outbox is append-only: DELETE is denied');
END;
