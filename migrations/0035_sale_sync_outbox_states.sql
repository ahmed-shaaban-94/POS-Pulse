-- @no-wrap-transaction
-- 008 sale-sync flush — relax sale_sync_outbox for state transitions.
--
-- Background. `0024_create_sale_sync_outbox.sql` created the table with a
-- `state = 'pending'`-only CHECK and append-only UPDATE/DELETE triggers (008
-- AD-3 — the capture-UP engine was enqueue-only). Its own comment foresaw this:
-- "the future sync engine MAY relax these via additive migration to allow state
-- transitions". This is that migration: the flush worker (option (c)) must
-- transition a row pending → synced (on captureSale 201/200) or pending →
-- failed (on a non-retryable refusal), and bump attempt_count / last_error for
-- backoff + observability.
--
-- Changes:
--   1. Relax the state CHECK to {pending, synced, failed}.
--   2. Add attempt_count INTEGER NOT NULL DEFAULT 0 + last_error TEXT (nullable).
--   3. Replace the no-UPDATE trigger with a GUARDED one that permits ONLY
--      state/attempt_count/last_error to change, and ONLY forward transitions
--      (pending → synced|failed). Immutable provenance columns (sale_id,
--      tenant/branch/terminal, enqueued_at, …) stay frozen, and a synced/failed
--      row can never be re-mutated. DELETE stays denied (append-only history).
--
-- Why a table rebuild. SQLite cannot ALTER a CHECK constraint in place
-- (https://www.sqlite.org/lang_altertable.html); the canonical recipe is the
-- table-rebuild dance (mirrors 0019_extend_payment_failure_reason_enum.sql):
-- create new table with the corrected schema, copy every row, drop old, rename.
--
-- Why `-- @no-wrap-transaction` + explicit `PRAGMA foreign_keys = OFF`. The
-- table carries `FOREIGN KEY (sale_id) REFERENCES sales(sale_id)`. With
-- `PRAGMA foreign_keys = ON` (set by src/main/db/client.ts on every connection)
-- the DROP would raise `FOREIGN KEY constraint failed` at drop time even though
-- INSERT…SELECT already copied the parent rows — the only working primitive is
-- `PRAGMA foreign_keys = OFF` BEFORE the transaction (a no-op inside one). The
-- runner reads the `-- @no-wrap-transaction` marker and skips its default
-- transaction wrap; this file emits its own BEGIN/COMMIT.

PRAGMA foreign_keys = OFF;

BEGIN;

-- Step 1. New table: relaxed CHECK + attempt_count + last_error. Every other
-- column is byte-for-byte identical to 0024.
CREATE TABLE sale_sync_outbox_new (
  outbox_row_id                TEXT     NOT NULL PRIMARY KEY,
  sale_id                      TEXT     NOT NULL,
  envelope_handoff_action_id   TEXT     NOT NULL,
  tenant_id                    TEXT     NOT NULL,
  branch_id                    TEXT     NOT NULL,
  terminal_id                  TEXT     NOT NULL,
  state                        TEXT     NOT NULL
                               CHECK (state IN ('pending', 'synced', 'failed')),
  enqueued_at                  TEXT     NOT NULL,
  attempt_count                INTEGER  NOT NULL DEFAULT 0
                               CHECK (attempt_count >= 0),
  last_error                   TEXT,

  FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Step 2. Copy every existing row (all 'pending'). attempt_count/last_error
-- take their DEFAULT/NULL. Explicit column list so a future column drift fails
-- loud rather than silently losing data.
INSERT INTO sale_sync_outbox_new (
  outbox_row_id, sale_id, envelope_handoff_action_id,
  tenant_id, branch_id, terminal_id, state, enqueued_at
)
SELECT
  outbox_row_id, sale_id, envelope_handoff_action_id,
  tenant_id, branch_id, terminal_id, state, enqueued_at
FROM sale_sync_outbox;

-- Step 3. Drop the old table (removes its indexes + the two append-only
-- triggers from 0024). Safe under foreign_keys = OFF.
DROP TABLE sale_sync_outbox;

-- Step 4. Rename into place — child/parent FK references resolve by name.
ALTER TABLE sale_sync_outbox_new RENAME TO sale_sync_outbox;

-- Step 5. Re-create the indexes from 0024 (verbatim).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_sync_outbox_sale_id
  ON sale_sync_outbox (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_sync_outbox_tenant_branch_terminal_state_enqueued
  ON sale_sync_outbox (tenant_id, branch_id, terminal_id, state, enqueued_at);

-- Step 6. Guarded UPDATE trigger — replaces 0024's blanket no-UPDATE.
-- Permits ONLY a forward transition from 'pending', and ONLY mutation of
-- state / attempt_count / last_error. Immutable provenance columns must not
-- change; a non-pending row is terminal.
CREATE TRIGGER trg_sale_sync_outbox_guarded_update
BEFORE UPDATE ON sale_sync_outbox
BEGIN
  SELECT CASE
    WHEN OLD.state <> 'pending'
      THEN RAISE(ABORT, 'sale_sync_outbox: row already terminal — no further UPDATE')
    WHEN NEW.state NOT IN ('pending', 'synced', 'failed')
      THEN RAISE(ABORT, 'sale_sync_outbox: invalid target state')
    WHEN NEW.outbox_row_id <> OLD.outbox_row_id
      OR NEW.sale_id <> OLD.sale_id
      OR NEW.envelope_handoff_action_id <> OLD.envelope_handoff_action_id
      OR NEW.tenant_id <> OLD.tenant_id
      OR NEW.branch_id <> OLD.branch_id
      OR NEW.terminal_id <> OLD.terminal_id
      OR NEW.enqueued_at <> OLD.enqueued_at
      THEN RAISE(ABORT, 'sale_sync_outbox: provenance columns are immutable')
  END;
END;

-- DELETE stays denied — the outbox is append-only history (008 AD-3).
CREATE TRIGGER trg_sale_sync_outbox_no_delete
BEFORE DELETE ON sale_sync_outbox
BEGIN
  SELECT RAISE(ABORT, 'sale_sync_outbox is append-only — DELETE denied (008 AD-3)');
END;

PRAGMA foreign_key_check;

COMMIT;

PRAGMA foreign_keys = ON;
