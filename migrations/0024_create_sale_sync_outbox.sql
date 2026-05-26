-- T024 — 008 Slice 1a: create sale_sync_outbox table + UNIQUE(sale_id) + append-only triggers + FK.
-- Schema per data-model.md §"Entity: SaleSyncOutbox".
-- §A3 sign-off: coordination.md §"§A3 migration reviewer thread (T003)" (Ahmed 2026-05-26).
--
-- Exactly one outbox row per finalized sale (FR-060). Append-only by 008's
-- lifecycle; the future sync engine may relax the triggers via additive
-- migration. AD-11 enqueue-only.

CREATE TABLE IF NOT EXISTS sale_sync_outbox (
  outbox_row_id                TEXT     NOT NULL PRIMARY KEY,
  sale_id                      TEXT     NOT NULL,
  envelope_handoff_action_id   TEXT     NOT NULL,
  tenant_id                    TEXT     NOT NULL,
  branch_id                    TEXT     NOT NULL,
  terminal_id                  TEXT     NOT NULL,
  state                        TEXT     NOT NULL CHECK (state = 'pending'),
  enqueued_at                  TEXT     NOT NULL,

  FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Exactly one outbox row per sale (FR-060).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_sync_outbox_sale_id
  ON sale_sync_outbox (sale_id);

-- Future sync-engine scan path (data-model.md indices).
CREATE INDEX IF NOT EXISTS idx_sale_sync_outbox_tenant_branch_terminal_state_enqueued
  ON sale_sync_outbox (tenant_id, branch_id, terminal_id, state, enqueued_at);

-- Append-only triggers (AD-3). Note: the future sync engine MAY relax these
-- via additive migration to allow state transitions; 008 itself does not.
CREATE TRIGGER IF NOT EXISTS trg_sale_sync_outbox_no_update
BEFORE UPDATE ON sale_sync_outbox
BEGIN
  SELECT RAISE(ABORT, 'sale_sync_outbox is append-only — UPDATE denied (008 AD-3)');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_sync_outbox_no_delete
BEFORE DELETE ON sale_sync_outbox
BEGIN
  SELECT RAISE(ABORT, 'sale_sync_outbox is append-only — DELETE denied (008 AD-3)');
END;
