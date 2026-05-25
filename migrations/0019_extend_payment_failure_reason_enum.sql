-- T299 — extend `payment_attempts.failure_reason` CHECK enum with
-- `manager_force_failed` (Wave 5e closes F-W5D-001).
--
-- Background. The Wave 5b-main spec amendment added `manager_force_failed`
-- to FR-006's `PaymentFailureReason` union (see
-- `src/shared/payments/types.ts` + Slice 4 coordination ledger), and
-- `PaymentAttemptFsm.forceFail()` writes that value into
-- `payment_attempts.failure_reason` at
-- `src/main/payments/fsm/payment-attempt-fsm.ts:358`. The original
-- migration `0012_create_payment_attempts.sql` was authored before the
-- amendment and its CHECK enum did NOT list `manager_force_failed`, so
-- every real force-fail raised:
--
--   CHECK constraint failed: failure_reason IS NULL OR failure_reason IN (...)
--
-- Unit tests masked the bug by mocking the repository layer. The Wave 5d
-- integration test `tests/integration/payments/force-fail.test.ts`
-- discovered it; finding F-W5D-001 in
-- `specs/006-payments-tender/coordination.md` records the deferral and
-- this migration is the resolution.
--
-- Why a table rebuild. SQLite cannot ALTER a CHECK constraint in place
-- (https://www.sqlite.org/lang_altertable.html). The canonical recipe is
-- the table-rebuild dance: create a new table with the corrected schema,
-- copy every row from the old table, drop the old, and rename the new
-- into place. Indexes follow the old table on DROP and must be
-- re-created.
--
-- FK safety. Two child tables reference `payment_attempts(payment_attempt_id)`:
--   - `payment_tender_lines` (migration 0014)
--   - `payment_action_outbox` (migration 0015)
-- Both declare bare `REFERENCES` clauses (no ON DELETE) → SQLite default
-- is NO ACTION. Because this migration copies EVERY row from the old
-- table into the new before dropping the old, the parent rows that the
-- child tables reference are continuously present from any FK enforcer's
-- point of view; no orphan-creating delete occurs.
--
-- `PRAGMA foreign_keys=OFF` is intentionally NOT used: the migration
-- runner (`src/main/db/migrate.ts:95`) wraps each migration file in
-- `db.transaction(...)`, and SQLite documents `PRAGMA foreign_keys` as a
-- no-op inside a transaction. Including it would be dead text.
--
-- App-layer schema is unchanged. `PaymentAttemptRow.failure_reason` in
-- `src/main/payments/repositories/payment-attempts.repository.ts` already
-- accepts the broader union via `PaymentFailureReason` from the shared
-- types; only the storage-layer CHECK lagged.

-- Step 1. Create the new table with the corrected CHECK enum. The schema
-- is byte-for-byte identical to 0012 (PK, columns, type/NOT NULL
-- declarations, all other CHECK clauses, the two state-coupled invariant
-- CHECKs at the bottom) except the failure_reason CHECK now lists
-- `manager_force_failed` as the 15th value.
CREATE TABLE payment_attempts_new (
  payment_attempt_id                  TEXT    NOT NULL PRIMARY KEY,
  tenant_id                           TEXT    NOT NULL,
  branch_id                           TEXT    NOT NULL,
  terminal_id                         TEXT    NOT NULL,
  acting_operator_id                  TEXT    NOT NULL,
  operator_session_id                 TEXT    NOT NULL,

  envelope_handoff_action_id          TEXT    NOT NULL,
  envelope_cart_id                    TEXT    NOT NULL,
  envelope_subtotal_minor             INTEGER NOT NULL
                                      CHECK (envelope_subtotal_minor >= 0),

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

  -- Closed enum — now 15 values (was 14 in migration 0012). The new
  -- value `manager_force_failed` is the only addition; every other
  -- value is preserved in its original order so deployed databases
  -- continue to satisfy the constraint against existing rows.
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
                                        'split_tender_rollback',
                                        'manager_force_failed'
                                      )),

  force_fail_attribution_operator_id  TEXT,

  last_action_id                      TEXT    NOT NULL,

  CHECK (
    (state IN ('failed', 'force_failed') AND failure_reason IS NOT NULL)
    OR (state NOT IN ('failed', 'force_failed') AND failure_reason IS NULL)
  ),
  CHECK (
    (state = 'force_failed' AND force_fail_attribution_operator_id IS NOT NULL)
    OR (state <> 'force_failed' AND force_fail_attribution_operator_id IS NULL)
  )
);

-- Step 2. Copy every row from the old table into the new. Explicit column
-- list so a future column addition to the old table that hasn't been
-- mirrored here fails loud rather than silently dropping data.
INSERT INTO payment_attempts_new (
  payment_attempt_id,
  tenant_id,
  branch_id,
  terminal_id,
  acting_operator_id,
  operator_session_id,
  envelope_handoff_action_id,
  envelope_cart_id,
  envelope_subtotal_minor,
  state,
  started_at,
  settled_at,
  cancelled_at,
  failed_at,
  force_failed_at,
  failure_reason,
  force_fail_attribution_operator_id,
  last_action_id
)
SELECT
  payment_attempt_id,
  tenant_id,
  branch_id,
  terminal_id,
  acting_operator_id,
  operator_session_id,
  envelope_handoff_action_id,
  envelope_cart_id,
  envelope_subtotal_minor,
  state,
  started_at,
  settled_at,
  cancelled_at,
  failed_at,
  force_failed_at,
  failure_reason,
  force_fail_attribution_operator_id,
  last_action_id
FROM payment_attempts;

-- Step 3. Drop the old table. SQLite removes the table's owned indexes
-- with it (idx_payment_attempts_envelope_handoff_action_id +
-- idx_payment_attempts_state_branch from 0012, and
-- payment_attempts_one_started_per_terminal from 0013). They are
-- re-created in Step 5.
DROP TABLE payment_attempts;

-- Step 4. Rename the new table into the original name. Child-table FK
-- references resolve by name, so this restores the FK linkage with no
-- further action.
ALTER TABLE payment_attempts_new RENAME TO payment_attempts;

-- Step 5. Re-create the three indexes that lived on the old table.
-- Definitions are copied verbatim from 0012 + 0013 to preserve query
-- planner behaviour.

CREATE INDEX IF NOT EXISTS idx_payment_attempts_envelope_handoff_action_id
  ON payment_attempts (envelope_handoff_action_id);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_state_branch
  ON payment_attempts (state, branch_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_started_per_terminal
  ON payment_attempts (terminal_id)
  WHERE state = 'started';
