-- T023 — 008 Slice 1a: create drawer_events table + UNIQUE(sale_id) + append-only triggers + FK.
-- Schema per data-model.md §"Entity: DrawerEvent".
-- §A3 sign-off: coordination.md §"§A3 migration reviewer thread (T003)" (Ahmed 2026-05-26).
--
-- AT MOST ONE row per sale (FR-053 double-kick suppression at schema layer).
-- Append-only; FK to sales(sale_id).

CREATE TABLE IF NOT EXISTS drawer_events (
  drawer_event_id                       TEXT     NOT NULL PRIMARY KEY,
  sale_id                               TEXT     NOT NULL,
  outcome                               TEXT     NOT NULL CHECK (outcome IN ('opened', 'suppressed', 'failed')),
  suppression_reason                    TEXT              CHECK (suppression_reason IS NULL OR suppression_reason = 'cashless_tender_mix'),
  failure_reason                        TEXT              CHECK (failure_reason IS NULL OR failure_reason IN (
                                                      'printer_dk_failure',
                                                      'os_error',
                                                      'no_drawer_configured'
                                                    )),
  last_successful_open_at_for_terminal  TEXT,
  triggering_print_event_id             TEXT     NOT NULL,
  terminal_id                           TEXT     NOT NULL,
  attempted_at                          TEXT     NOT NULL,

  FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
  FOREIGN KEY (triggering_print_event_id) REFERENCES print_events(print_event_id),

  -- suppression_reason is biconditional with outcome='suppressed'.
  CHECK (
    (outcome = 'suppressed' AND suppression_reason IS NOT NULL)
    OR (outcome <> 'suppressed' AND suppression_reason IS NULL)
  ),

  -- failure_reason is biconditional with outcome='failed'.
  CHECK (
    (outcome = 'failed' AND failure_reason IS NOT NULL)
    OR (outcome <> 'failed' AND failure_reason IS NULL)
  )
);

-- FR-053 double-kick suppression: at most one DrawerEvent per sale.
CREATE UNIQUE INDEX IF NOT EXISTS idx_drawer_events_sale_id
  ON drawer_events (sale_id);

-- last_successful_open_at_for_terminal lookup on failure-event INSERT.
CREATE INDEX IF NOT EXISTS idx_drawer_events_terminal_attempted_at
  ON drawer_events (terminal_id, attempted_at DESC);

-- Append-only triggers (AD-3).
CREATE TRIGGER IF NOT EXISTS trg_drawer_events_no_update
BEFORE UPDATE ON drawer_events
BEGIN
  SELECT RAISE(ABORT, 'drawer_events is append-only — UPDATE denied (008 AD-3)');
END;

CREATE TRIGGER IF NOT EXISTS trg_drawer_events_no_delete
BEFORE DELETE ON drawer_events
BEGIN
  SELECT RAISE(ABORT, 'drawer_events is append-only — DELETE denied (008 AD-3)');
END;
