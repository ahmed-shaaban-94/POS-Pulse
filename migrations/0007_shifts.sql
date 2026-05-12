-- T089 prerequisite — local shifts table.
-- Schema per data-model.md §"Entity 4 — Shift"
-- The drawer-math fields (expected_total, variance, shortage, overage, change_fund)
-- are out of scope for 004 and are NOT included here.
-- declared_count is nullable: NULL = absent state (closed_forced path, FR-024(a)).
-- No FK constraints: operator_sessions uses TEXT ids; SQLite FK enforcement is per-connection.

CREATE TABLE IF NOT EXISTS shifts (
  id                        TEXT    NOT NULL PRIMARY KEY,
  tenant_id                 TEXT    NOT NULL,
  branch_id                 TEXT    NOT NULL,
  originating_terminal_id   TEXT    NOT NULL,
  opening_operator_id       TEXT    NOT NULL,
  lifecycle_state           TEXT    NOT NULL DEFAULT 'open',
  declared_count            INTEGER,
  opened_at                 TEXT    NOT NULL,
  closed_at                 TEXT,

  CHECK (
    lifecycle_state IN ('open', 'closed_normal', 'closed_forced')
  ),

  -- Temporal consistency: closed_at only meaningful when shift is closed
  CHECK (
    (lifecycle_state = 'open' AND closed_at IS NULL) OR
    (lifecycle_state IN ('closed_normal', 'closed_forced') AND closed_at IS NOT NULL)
  ),

  -- declared_count semantics: NULL = absent (required for closed_forced per FR-024(a));
  -- a numeric value is only valid on closed_normal
  CHECK (
    lifecycle_state != 'closed_forced' OR declared_count IS NULL
  )
);

-- Lookup by branch for the stuck-shift query (T089 / Wave 4.1 endpoint)
CREATE INDEX IF NOT EXISTS idx_shifts_branch_open
  ON shifts (tenant_id, branch_id, lifecycle_state);

-- Lookup by opening operator for cashier-returns-banner (T091)
CREATE INDEX IF NOT EXISTS idx_shifts_opening_operator
  ON shifts (tenant_id, opening_operator_id);

-- No UPDATE trigger: lifecycle transitions (open → closed_*) are legitimate mutations.
-- No DELETE trigger: local shifts are not audit-level immutable records; the
-- backend is the authoritative record for shift history.
