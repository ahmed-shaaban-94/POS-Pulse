-- T065 — operator_sessions table.
-- Schema per data-model.md §"Entity 2 — OperatorSession"
-- No FK constraints: shifts table does not exist yet; cashier_pin_records lands in 0006.

CREATE TABLE IF NOT EXISTS operator_sessions (
  id                        TEXT    NOT NULL PRIMARY KEY,
  acting_operator_id        TEXT    NOT NULL,
  role                      TEXT    NOT NULL,
  tenant_id                 TEXT    NOT NULL,
  branch_id                 TEXT    NOT NULL,
  originating_terminal_id   TEXT    NOT NULL,
  start_at                  TEXT    NOT NULL,
  end_at                    TEXT,
  end_cause                 TEXT,

  CHECK (
    end_cause IN (
      'signed_out',
      'inactivity_timeout',
      'superseded_by_takeover',
      'terminal_session_terminated',
      'account_disabled_mid_session'
    ) OR end_cause IS NULL
  ),

  -- Biconditional: end_at null ⟺ end_cause null
  CHECK (
    (end_at IS NULL AND end_cause IS NULL) OR
    (end_at IS NOT NULL AND end_cause IS NOT NULL)
  ),

  -- Temporal consistency
  CHECK (end_at IS NULL OR end_at >= start_at)
);

-- Lookup by operator for takeover detection and session restore
CREATE INDEX IF NOT EXISTS idx_operator_sessions_operator
  ON operator_sessions (tenant_id, acting_operator_id);

-- Lookup by terminal for FR-011 (at most one active session per terminal)
CREATE INDEX IF NOT EXISTS idx_operator_sessions_terminal
  ON operator_sessions (tenant_id, originating_terminal_id);

-- Partial unique index enforcing single-active-session per operator per tenant
-- (FR-013 / data-model.md §"Validation rules")
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_sessions_one_active_per_operator
  ON operator_sessions (tenant_id, acting_operator_id)
  WHERE end_at IS NULL;

-- Immutability of ended sessions: deny UPDATE on rows where end_at is already set.
-- Active→ended transition (end_at IS NULL → NOT NULL) is intentionally permitted.
CREATE TRIGGER IF NOT EXISTS trg_operator_sessions_no_update_ended
BEFORE UPDATE ON operator_sessions
WHEN OLD.end_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'operator_sessions: ended rows are immutable');
END;

-- No DELETE allowed — session history is the durable audit trail
CREATE TRIGGER IF NOT EXISTS trg_operator_sessions_no_delete
BEFORE DELETE ON operator_sessions
BEGIN
  SELECT RAISE(ABORT, 'operator_sessions: DELETE is denied');
END;
