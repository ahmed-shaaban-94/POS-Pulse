-- T064 — cashier_pin_records table.
-- Schema per data-model.md §"Entity 6 — CashierPinRecord"
-- §A1-gated: table creation is safe regardless of §A1 resolution; the
-- PIN verifier logic (S4) is what requires the §A1 decision.
-- No FK constraints: operator_sessions table lands in 0005; shifts in a future migration.

CREATE TABLE IF NOT EXISTS cashier_pin_records (
  tenant_id                 TEXT    NOT NULL,
  branch_id                 TEXT    NOT NULL,
  terminal_id               TEXT    NOT NULL,
  cashier_clerk_user_id     TEXT    NOT NULL,

  -- Argon2id hash of the PIN. BLOB, never TEXT, never NULL.
  pin_hash                  BLOB    NOT NULL,
  -- 16 random bytes per-record salt. BLOB, never TEXT, never NULL.
  pin_salt                  BLOB    NOT NULL,

  -- PR-3 lockout tracking
  failed_attempt_count      INTEGER NOT NULL DEFAULT 0
                            CHECK (failed_attempt_count >= 0),
  lockout_until             TEXT,

  created_at                TEXT    NOT NULL,
  created_by_operator_id    TEXT    NOT NULL,

  PRIMARY KEY (tenant_id, branch_id, terminal_id, cashier_clerk_user_id)
);

-- Lookup by cashier for sign-in path and lockout check
CREATE INDEX IF NOT EXISTS idx_cashier_pin_records_cashier
  ON cashier_pin_records (tenant_id, branch_id, terminal_id, cashier_clerk_user_id);
