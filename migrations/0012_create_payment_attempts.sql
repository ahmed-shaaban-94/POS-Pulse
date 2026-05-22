-- T060 — `payment_attempts` table for 006-payments-tender Slice 3a (§A3-gated).
-- Schema per specs/006-payments-tender/data-model.md §"Entity: PaymentAttempt".
-- §A3 reviewer Ahmed signed off on the data-model shape on 2026-05-21
-- (coordination.md §"Sign-off — 2026-05-21").
--
-- Migration naming follows the bare numeric sequence per owner decision PR #200
-- (continuing 0001–0011), NOT the feature-prefixed `006-0001_*` proposal in
-- tasks.md (advisory per Maestro task-marking — see execution-map.yaml F-001).
--
-- Money is stored in INTEGER minor units only (Constitution §II).
-- FSM enforcement (legal vs illegal transitions) lives in the application layer
-- under src/main/payments/fsm/; the SQL surface enforces CHECK constraints only.
--
-- FKs are declared even though earlier cart migrations omitted them: §A3
-- sign-off explicitly approved data-model.md's FK design. PRAGMA foreign_keys
-- is set ON by src/main/db/client.ts on every connection.

CREATE TABLE IF NOT EXISTS payment_attempts (
  payment_attempt_id                  TEXT    NOT NULL PRIMARY KEY,
  tenant_id                           TEXT    NOT NULL,
  branch_id                           TEXT    NOT NULL,
  terminal_id                         TEXT    NOT NULL,
  acting_operator_id                  TEXT    NOT NULL,
  operator_session_id                 TEXT    NOT NULL,

  -- Snapshot from the bound PaymentIntentEnvelope v1 (005's cart.handoff).
  envelope_handoff_action_id          TEXT    NOT NULL,
  envelope_cart_id                    TEXT    NOT NULL,
  envelope_subtotal_minor             INTEGER NOT NULL
                                      CHECK (envelope_subtotal_minor >= 0),

  -- Five-state FSM. Terminal states block all further mutation (app-layer rule).
  state                               TEXT    NOT NULL
                                      CHECK (state IN (
                                        'started',
                                        'settled',
                                        'cancelled',
                                        'failed',
                                        'force_failed'
                                      )),

  started_at                          TEXT    NOT NULL,
  settled_at                          TEXT,
  cancelled_at                        TEXT,
  failed_at                           TEXT,
  force_failed_at                     TEXT,

  -- Closed enum of 14 failure-reason categories (FR-006). NULL in non-failed
  -- states; the application layer fills it on transition into `failed`.
  failure_reason                      TEXT
                                      CHECK (failure_reason IS NULL OR failure_reason IN (
                                        'cart_lost',
                                        'operator_session_terminated',
                                        'dependency_unavailable',
                                        'internal_error',
                                        'stale_handoff',
                                        'tender_underpaid',
                                        'non_cash_overpayment_refused',
                                        'voucher_not_found',
                                        'voucher_expired',
                                        'voucher_cancelled',
                                        'voucher_already_redeemed',
                                        'voucher_tenant_mismatch',
                                        'voucher_branch_mismatch',
                                        'split_tender_rollback'
                                      )),

  -- Manager identity for force-failed attempts (FR-021). Never echoed to
  -- renderer; audit-event payload + this column are the only sinks.
  force_fail_attribution_operator_id  TEXT,

  -- Restart-survival pointer into payment_action_outbox.
  last_action_id                      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_envelope_handoff_action_id
  ON payment_attempts (envelope_handoff_action_id);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_state_branch
  ON payment_attempts (state, branch_id);
