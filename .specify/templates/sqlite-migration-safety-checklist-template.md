> **Optional reference template — not a mandatory gate.**
> Use only when it reduces risk or clarifies a non-trivial change.

# SQLite Migration Safety Checklist: [Migration name]

## When to use

- Any new migration file under `migrations/`
- Any change to the migration runner itself (`src/main/db/`)
- Any feature that introduces new tables, indexes, triggers, or alters existing schema

## When NOT to use

- No migration is involved (app-logic-only changes)
- Migration is a trivial index-only addition with no data or trigger impact
- Documentation-only changes

---

## Migration metadata

| Field | Value |
|:--|:--|
| Migration file | `migrations/<nnnn>_<name>.sql` |
| Feature / task | T0XX |
| Tables created | |
| Tables altered | |
| Columns added | |
| Indexes created | |
| Triggers created | |
| Backfill required | Yes / No |
| Reversible | Yes / No / Partial |

---

## DDL safety

- [ ] `CREATE TABLE IF NOT EXISTS` used (idempotent)
- [ ] `CREATE INDEX IF NOT EXISTS` used (idempotent)
- [ ] No `DROP TABLE` or `DROP COLUMN` unless this is an explicit destructive migration and it has been reviewed
- [ ] `ALTER TABLE ADD COLUMN` is SQLite-safe (SQLite supports add column; rename column requires SQLite ≥ 3.25)
- [ ] New `NOT NULL` columns have a `DEFAULT` value, OR the migration includes a backfill before the constraint is enforced
- [ ] No use of `FOREIGN KEY` constraints unless FK enforcement (`PRAGMA foreign_keys = ON`) is explicitly enabled in the migration runner and this has been reviewed

---

## Composite keys and uniqueness

- [ ] `PRIMARY KEY (col1, col2)` or `UNIQUE (col1, col2)` is intentional — reviewed against the expected idempotency key for this table
- [ ] Unique constraint covers the correct grain (e.g., `(tenant_id, event_id)` for audit events)
- [ ] `INSERT OR IGNORE` / `INSERT OR REPLACE` behavior is explicitly tested when a uniqueness constraint exists

---

## Append-only enforcement (if applicable)

If this table must be append-only (e.g., `audit_events`):

- [ ] `BEFORE UPDATE` trigger added with `RAISE(ABORT, 'audit_events is append-only')`
- [ ] `BEFORE DELETE` trigger added with `RAISE(ABORT, 'audit_events is append-only')`
- [ ] Trigger names are unique and follow project convention (`<table>_no_update`, `<table>_no_delete`)
- [ ] Test confirms that `UPDATE` on this table raises an error
- [ ] Test confirms that `DELETE` on this table raises an error
- [ ] `RAISE(ABORT, ...)` is used (not `FAIL` or `ROLLBACK`) — `ABORT` rolls back only the triggering statement, not the outer transaction, which is the correct behavior for an append-only guard

---

## Transaction and crash safety

- [ ] Migration is wrapped in a single transaction (`BEGIN` / `COMMIT`) or the migration runner guarantees transactional application
- [ ] If the process crashes mid-migration, the migration runner will re-attempt the same migration on next startup without corrupt state
- [ ] Migration is idempotent: re-running on an already-migrated DB produces no error and no duplicate data
- [ ] Any backfill is safe to re-run (uses `INSERT OR IGNORE` or `UPDATE WHERE NOT EXISTS` pattern)

---

## Outbox / sync impact

- [ ] Does this migration add or alter a column that participates in the outbox sync query? If so, the sync adapter has been updated.
- [ ] Does altering the table change the `synced_at IS NULL` / `retry_count` logic? If so, existing queued rows are accounted for.
- [ ] No queued (unsynced) rows will be silently dropped or left in an un-retryable state after this migration.
- [ ] `(tenant_id, event_id)` or equivalent idempotency key is preserved if it exists.

---

## Runtime binding checks

- [ ] Migration was tested with `better-sqlite3` (the production binding)
- [ ] If `sql.js` is used in tests as a fallback, the migration SQL is confirmed to be compatible with both
- [ ] No SQLite extension or pragma is used that is unavailable in the `better-sqlite3` build shipped with the app
- [ ] `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys` settings are applied by the migration runner before migrations run, not inside individual migration files

---

## Final checks

- [ ] `git diff --name-only` for this PR shows only the expected migration file(s) and associated source/test changes
- [ ] Migration file name follows project convention: `<zero-padded-sequence>_<snake_case_description>.sql`
- [ ] Migration has been reviewed by a second pair of eyes if it touches tables with live outbox data
- [ ] `npm test -- --coverage` passes with the new migration applied in integration tests
