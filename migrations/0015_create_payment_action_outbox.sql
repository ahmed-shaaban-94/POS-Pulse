-- T063 — `payment_action_outbox` table for 006-payments-tender Slice 3a (§A3-gated).
-- Schema per specs/006-payments-tender/data-model.md §"Entity: PaymentActionOutbox".
-- §A3 reviewer Ahmed signed off on the data-model shape on 2026-05-21.
--
-- Append-only history of every payment-mutating action. UPDATE and DELETE are
-- denied by trigger in the sibling migration 0016 (Constitution §P4).
--
-- `action_id` doubles as the P5 idempotency key (research §R-10):
--   • lookup by action_id → identical payload returns the prior outcome
--   • lookup by action_id → differing payload (compared via action_payload_hash)
--     refuses with `idempotency_payload_mismatch`
--
-- `action_payload_hash` is the SHA-256 of the redacted canonical JSON payload;
-- the bridge layer is responsible for the redaction (external_reference -> '*****',
-- voucher tokens excluded entirely — Constitution §P6 / §P7).

CREATE TABLE IF NOT EXISTS payment_action_outbox (
  action_id              TEXT    NOT NULL PRIMARY KEY,
  payment_attempt_id     TEXT    NOT NULL
                         REFERENCES payment_attempts (payment_attempt_id),
  -- Nullable: attempt-level action kinds carry no line.
  tender_line_id         TEXT
                         REFERENCES payment_tender_lines (tender_line_id),

  action_kind            TEXT    NOT NULL
                         CHECK (action_kind IN (
                           'payment.attempt.start',
                           'payment.confirm',
                           'payment.cancel',
                           'payment.fail',
                           'payment.force_fail',
                           'payment.discarded_on_session_end',
                           'tender.apply',
                           'tender.reverse'
                         )),

  -- SHA-256 hex (64 lowercase hex chars) of the redacted canonical request
  -- payload. The GLOB CHECK enforces the hex character set so corrupt or
  -- non-canonical strings cannot enter the idempotency-lookup table.
  action_payload_hash    TEXT    NOT NULL
                         CHECK (
                           length(action_payload_hash) = 64
                           AND action_payload_hash NOT GLOB '*[^0-9a-f]*'
                         ),

  acting_operator_id     TEXT    NOT NULL,
  created_at             TEXT    NOT NULL,

  -- tender_line_id presence is biconditional on action_kind (data-model.md
  -- §"Entity: PaymentActionOutbox" — per-line actions reference a line;
  -- attempt-level actions do not). Enforced at the SQL layer so the outbox
  -- replay path cannot encounter a malformed row.
  CHECK (
    (action_kind IN ('tender.apply', 'tender.reverse') AND tender_line_id IS NOT NULL)
    OR (action_kind NOT IN ('tender.apply', 'tender.reverse') AND tender_line_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_action_outbox_attempt_created
  ON payment_action_outbox (payment_attempt_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_action_outbox_line_created
  ON payment_action_outbox (tender_line_id, created_at);
