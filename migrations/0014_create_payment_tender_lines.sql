-- T062 — `payment_tender_lines` table for 006-payments-tender Slice 3a (§A3-gated).
-- Schema per specs/006-payments-tender/data-model.md §"Entity: PaymentTenderLine".
-- §A3 reviewer Ahmed signed off on the data-model shape on 2026-05-21.
--
-- Per-tender-type line state; zero-or-more rows per attempt. Settlement
-- invariant evaluated at `payments.confirm` time over Σ amount_applied_minor
-- minus Σ change_due_minor (cash overpay) over rows in state='applied'.
--
-- CHECK constraints enforce the per-type field-presence rules from
-- data-model §Invariants 2-4 + 6 + Invariant 6:
--   • change_due_minor non-null ONLY when tender_type='cash'
--   • external_reference non-null ONLY when tender_type='external_card_terminal'
--     and matches ^[A-Z0-9]{0,6}$ (research §R-5; makes a PAN structurally
--     unrepresentable — Constitution §P6)
--   • voucher_* fields non-null ONLY when tender_type='internal_voucher'

CREATE TABLE IF NOT EXISTS payment_tender_lines (
  tender_line_id                    TEXT    NOT NULL PRIMARY KEY,
  payment_attempt_id                TEXT    NOT NULL
                                    REFERENCES payment_attempts (payment_attempt_id),

  tender_type                       TEXT    NOT NULL
                                    CHECK (tender_type IN (
                                      'cash',
                                      'external_card_terminal',
                                      'internal_voucher'
                                    )),

  amount_applied_minor              INTEGER NOT NULL
                                    CHECK (amount_applied_minor >= 0),

  -- Five-state FSM per research §R-11. `reversal_pending` is Slice 4 only,
  -- but the enum entry lands here so S3 schema is stable across the slice
  -- boundary.
  state                             TEXT    NOT NULL
                                    CHECK (state IN (
                                      'applying',
                                      'applied',
                                      'refused',
                                      'reversed',
                                      'reversal_pending'
                                    )),

  -- Cash-only: positive when amount_applied_minor > remaining_balance_at_apply_time.
  -- Bounded above by amount_applied_minor so the settlement formula
  -- Σ (amount_applied_minor − COALESCE(change_due_minor, 0)) is always ≥ 0
  -- (data-model.md §"Entity: PaymentTenderLine" Invariant 5).
  change_due_minor                  INTEGER
                                    CHECK (
                                      (change_due_minor IS NULL)
                                      OR (
                                        tender_type = 'cash'
                                        AND change_due_minor BETWEEN 0 AND amount_applied_minor
                                      )
                                    ),

  -- external_card_terminal-only; uppercase alphanumeric ≤ 6 chars (FR-009).
  -- `NOT GLOB '*[^A-Z0-9]*'` enforces "every char is A–Z or 0–9" (the prior
  -- `GLOB '[A-Z0-9]*'` only constrained the first character because `*` in
  -- SQLite GLOB is "any chars" — making a PAN structurally unrepresentable
  -- required the negative-glob form).
  external_reference                TEXT
                                    CHECK (
                                      (external_reference IS NULL)
                                      OR (
                                        tender_type = 'external_card_terminal'
                                        AND external_reference NOT GLOB '*[^A-Z0-9]*'
                                        AND length(external_reference) BETWEEN 1 AND 6
                                      )
                                    ),

  -- internal_voucher-only; short-lived authority-bound token. Never crosses
  -- to renderer (data-model.md Invariant 8).
  voucher_redemption_intent_token   TEXT
                                    CHECK (
                                      voucher_redemption_intent_token IS NULL
                                      OR tender_type = 'internal_voucher'
                                    ),

  -- internal_voucher-only; the single voucher field that may cross to renderer
  -- via the minimised projection.
  voucher_authority_redemption_id   TEXT
                                    CHECK (
                                      voucher_authority_redemption_id IS NULL
                                      OR tender_type = 'internal_voucher'
                                    ),

  applied_at                        TEXT,
  refused_at                        TEXT,
  reversed_at                       TEXT,
  reversal_pending_since            TEXT,

  refusal_reason                    TEXT,

  attribution_operator_id           TEXT    NOT NULL,

  -- Monotonic within an attempt; LIFO reversal iterates `apply_order DESC`.
  apply_order                       INTEGER NOT NULL
                                    CHECK (apply_order >= 1),

  last_action_id                    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_tender_lines_attempt_apply_order
  ON payment_tender_lines (payment_attempt_id, apply_order);

CREATE INDEX IF NOT EXISTS idx_payment_tender_lines_attempt_state
  ON payment_tender_lines (payment_attempt_id, state);

-- Filtered index supporting the Slice 4 deferred-reversal resolver.
CREATE INDEX IF NOT EXISTS idx_payment_tender_lines_reversal_pending
  ON payment_tender_lines (state)
  WHERE state = 'reversal_pending';
