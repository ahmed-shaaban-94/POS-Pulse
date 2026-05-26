-- T022 — 008 Slice 1a: create print_events table + append-only triggers + FK.
-- Schema per data-model.md §"Entity: PrintEvent".
-- §A3 sign-off: coordination.md §"§A3 migration reviewer thread (T003)" (Ahmed 2026-05-26).
--
-- Many rows per sale (first_print + retries + reprints + manual_override).
-- Append-only at the physical layer; FK to sales(sale_id).

CREATE TABLE IF NOT EXISTS print_events (
  print_event_id                  TEXT     NOT NULL PRIMARY KEY,
  sale_id                         TEXT     NOT NULL,
  outcome                         TEXT     NOT NULL CHECK (outcome IN ('success', 'failure', 'manual_override')),
  purpose                         TEXT     NOT NULL CHECK (purpose IN ('first_print', 'reprint', 'retry_after_failure')),
  render_path                     TEXT              CHECK (render_path IS NULL OR render_path IN ('escpos_direct', 'os_print')),
  acting_operator_id              TEXT     NOT NULL,
  acting_operator_session_id      TEXT     NOT NULL,
  duplicate_copy_sequence_number  INTEGER           CHECK (duplicate_copy_sequence_number IS NULL OR duplicate_copy_sequence_number >= 1),
  failure_reason                  TEXT              CHECK (failure_reason IS NULL OR failure_reason IN (
                                              'printer_offline',
                                              'printer_out_of_paper',
                                              'printer_jam',
                                              'os_print_error',
                                              'escpos_write_failure',
                                              'escpos_status_unknown'
                                            )),
  previous_failed_print_event_ids TEXT,
  printed_at                      TEXT     NOT NULL,

  FOREIGN KEY (sale_id) REFERENCES sales(sale_id),

  -- manual_override has no render path (no actual print happened).
  CHECK (
    (outcome = 'manual_override' AND render_path IS NULL)
    OR (outcome IN ('success', 'failure') AND render_path IS NOT NULL)
  ),

  -- failure_reason is biconditional with outcome='failure'.
  CHECK (
    (outcome = 'failure' AND failure_reason IS NOT NULL)
    OR (outcome <> 'failure' AND failure_reason IS NULL)
  ),

  -- duplicate_copy_sequence_number is non-null only for successful reprints.
  CHECK (
    (purpose = 'reprint' AND outcome = 'success' AND duplicate_copy_sequence_number IS NOT NULL)
    OR (NOT (purpose = 'reprint' AND outcome = 'success') AND duplicate_copy_sequence_number IS NULL)
  ),

  -- previous_failed_print_event_ids only on retry_after_failure.
  CHECK (
    (purpose = 'retry_after_failure' AND previous_failed_print_event_ids IS NOT NULL)
    OR (purpose <> 'retry_after_failure' AND previous_failed_print_event_ids IS NULL)
  )
);

-- Reprint precondition check + "latest print event" projection (data-model.md indices).
CREATE INDEX IF NOT EXISTS idx_print_events_sale_id
  ON print_events (sale_id);

CREATE INDEX IF NOT EXISTS idx_print_events_sale_purpose_outcome_printed_at
  ON print_events (sale_id, purpose, outcome, printed_at DESC);

-- Append-only triggers (AD-3).
CREATE TRIGGER IF NOT EXISTS trg_print_events_no_update
BEFORE UPDATE ON print_events
BEGIN
  SELECT RAISE(ABORT, 'print_events is append-only — UPDATE denied (008 AD-3)');
END;

CREATE TRIGGER IF NOT EXISTS trg_print_events_no_delete
BEFORE DELETE ON print_events
BEGIN
  SELECT RAISE(ABORT, 'print_events is append-only — DELETE denied (008 AD-3)');
END;
