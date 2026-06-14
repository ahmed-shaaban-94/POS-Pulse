-- 017-offline-pin-reanchor T032 — re-anchor `cashier_pin_records`'s PRIMARY KEY
-- off the provider-coupled `cashier_clerk_user_id` onto the provider-neutral
-- `user_id` (028 §16). The offline-PIN store's local unlock factor is keyed on
-- a provider-independent identifier (Principle VIII — advanced; removes Clerk
-- lock-in from the key).
--
-- ## Why a table rebuild
--
-- SQLite cannot ALTER a PRIMARY KEY in place
-- (https://www.sqlite.org/lang_altertable.html). The canonical recipe is the
-- table-rebuild dance: create a new table with the target PK, copy every row,
-- drop the old, rename the new into place, then re-create the covering index
-- (indexes follow the old table on DROP). Mirrors migration 0019's pattern.
--
-- ## Why NO `-- @no-wrap-transaction` (unlike 0019)
--
-- 0019 needed `PRAGMA foreign_keys = OFF` outside a transaction because
-- `payment_attempts` had child FK references. `cashier_pin_records` has **no FK
-- constraints** (see 0006: "No FK constraints") and no child table references
-- it. So the runner's DEFAULT transaction wrap (`src/main/db/migrate.ts`) is
-- sufficient and correct: the whole rebuild commits atomically or rolls back —
-- which is exactly the crash-safety + P3 "no sealed row left unretrievable"
-- guarantee. This file therefore carries NO opt-out marker and emits NO manual
-- BEGIN/COMMIT.
--
-- ## OQ-D6-1 collapsed — direct rebuild, NO transition window (verified 2026-06-14)
--
-- The ONLY writer of `cashier_pin_records` is 019's provision handler
-- (`src/main/operator/pin-management.ts`), which ALWAYS sets a non-null
-- `user_id` (born-neutral). No other INSERT exists anywhere in `src/`; 0006 is
-- DDL and 0035 an ALTER. So when this migration runs, the table holds ONLY
-- non-null-`user_id` rows (or is empty) — the legacy clerk-only rows the
-- original plan's dual-key / backfill / re-enrollment options (R-3) existed to
-- migrate CANNOT exist. The migration is therefore a direct rebuild to a
-- `user_id NOT NULL` PK, with no transition machinery.
--
-- ## P3 fail-loud (no silent drop of a sealed credential row)
--
-- The copy uses an explicit column list and does NOT filter
-- (`WHERE user_id IS NOT NULL` would silently drop a row — forbidden by P3).
-- If an unexpected NULL-`user_id` row existed, the `INSERT…SELECT` into the
-- `user_id NOT NULL` PK column raises a NOT NULL constraint violation, the
-- runner's transaction rolls back, and the migration aborts loudly — the
-- correct behaviour (never lose a sealed row, never strand a cashier).
--
-- ## Runner-guaranteed single run
--
-- Like 0019/0035, this file is NOT file-level idempotent (SQLite has no
-- `CREATE TABLE IF NOT EXISTS`-style guard that would make a partial re-run
-- safe across DROP/RENAME). The runner skips already-applied migrations by name
-- in `schema_migrations`, so it executes exactly once per database.

-- Step 1. New table keyed on the provider-neutral `user_id`. Schema is
-- byte-identical to 0006 + 0035's `user_id` column EXCEPT:
--   • PK is now (tenant_id, branch_id, terminal_id, user_id), user_id NOT NULL.
--   • cashier_clerk_user_id is demoted to a NULLABLE, NON-key bridge column
--     (G-3 / A-3) — retained for provider-side correlation; retired later by
--     OQ-D6-2 (a separate migration, not this one).
-- Secret columns (pin_hash/pin_salt BLOB) and lockout columns
-- (failed_attempt_count/lockout_until) are unchanged.
CREATE TABLE cashier_pin_records_new (
  tenant_id                 TEXT    NOT NULL,
  branch_id                 TEXT    NOT NULL,
  terminal_id               TEXT    NOT NULL,
  user_id                   TEXT    NOT NULL,

  -- Demoted bridge column: nullable, non-key (was the PK component in 0006).
  cashier_clerk_user_id     TEXT,

  pin_hash                  BLOB    NOT NULL,
  pin_salt                  BLOB    NOT NULL,

  failed_attempt_count      INTEGER NOT NULL DEFAULT 0
                            CHECK (failed_attempt_count >= 0),
  lockout_until             TEXT,

  created_at                TEXT    NOT NULL,
  created_by_operator_id    TEXT    NOT NULL,

  PRIMARY KEY (tenant_id, branch_id, terminal_id, user_id)
);

-- Step 2. Copy every row. Explicit column list so an unmirrored future column
-- addition fails loud rather than silently dropping data. NO row filter: a
-- NULL user_id (which cannot occur, per the OQ-D6-1 note above) would abort the
-- rebuild on the NOT NULL PK constraint — fail-loud, never silent-drop (P3).
INSERT INTO cashier_pin_records_new (
  tenant_id,
  branch_id,
  terminal_id,
  user_id,
  cashier_clerk_user_id,
  pin_hash,
  pin_salt,
  failed_attempt_count,
  lockout_until,
  created_at,
  created_by_operator_id
)
SELECT
  tenant_id,
  branch_id,
  terminal_id,
  user_id,
  cashier_clerk_user_id,
  pin_hash,
  pin_salt,
  failed_attempt_count,
  lockout_until,
  created_at,
  created_by_operator_id
FROM cashier_pin_records;

-- Step 3. Drop the old table (SQLite removes its owned covering index with it).
DROP TABLE cashier_pin_records;

-- Step 4. Rename the new table into the original name.
ALTER TABLE cashier_pin_records_new RENAME TO cashier_pin_records;

-- Step 5. Re-create the covering index on the TARGET tuple (…, user_id), in
-- lockstep with the re-keyed PK. Replaces the 0006 index that keyed on
-- cashier_clerk_user_id.
CREATE INDEX IF NOT EXISTS idx_cashier_pin_records_cashier
  ON cashier_pin_records (tenant_id, branch_id, terminal_id, user_id);
