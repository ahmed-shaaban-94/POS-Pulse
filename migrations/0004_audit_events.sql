-- T045 — audit_events table with append-only triggers + audit_events_sync_state sibling
-- Schema per data-model.md §"Entity 5 — AuditEvent"
-- No FK constraints: operator_sessions and shifts tables do not exist until S4.

CREATE TABLE IF NOT EXISTS audit_events (
  event_id                   TEXT    NOT NULL,
  tenant_id                  TEXT    NOT NULL,
  branch_id                  TEXT    NOT NULL,
  originating_terminal_id    TEXT    NOT NULL,
  acting_operator_id         TEXT    NOT NULL,
  session_id                 TEXT,
  shift_id                   TEXT,
  action_category            TEXT    NOT NULL,
  created_at                 TEXT    NOT NULL,
  approving_supervisor_id    TEXT,
  payload                    TEXT,

  PRIMARY KEY (event_id, tenant_id)
);

-- Composite uniqueness is already enforced by the composite PRIMARY KEY above.
-- Explicit unique index for query-planner visibility.
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_events_pk
  ON audit_events (event_id, tenant_id);

-- Append-only: deny UPDATE
CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is denied');
END;

-- Append-only: deny DELETE
CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is denied');
END;

-- Sibling table for the mutable synced_at column.
-- Keyed identically to audit_events; updated by the sync loop (T047).
-- No append-only constraint — sync-state is deliberately mutable.
CREATE TABLE IF NOT EXISTS audit_events_sync_state (
  tenant_id   TEXT    NOT NULL,
  event_id    TEXT    NOT NULL,
  synced_at   TEXT,

  PRIMARY KEY (tenant_id, event_id)
);
