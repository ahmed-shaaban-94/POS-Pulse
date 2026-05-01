# Data Model: Foundation

**Feature:** 001-foundation
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-05-01

This feature introduces three data shapes. None are domain entities — they are infrastructure
records the substrate needs to function.

---

## SchemaMigration (SQLite table)

Tracks which migration files have been applied to the local database.

**Table:** `schema_migrations`

| Column        | Type      | Constraints                                  | Purpose                                          |
|:--------------|:----------|:---------------------------------------------|:--------------------------------------------------|
| `name`        | TEXT      | PRIMARY KEY, NOT NULL                        | The migration file's basename, e.g. `0001_init`. |
| `applied_at`  | TEXT      | NOT NULL, DEFAULT (CURRENT_TIMESTAMP, ISO-8601) | When the migration's transaction committed.    |
| `checksum`    | TEXT      | NULL                                          | Optional content hash of the file as applied. Reserved for future drift detection; populated when present. |

**Invariants:**
- One row per file ever applied. Re-running the runner is idempotent: a file whose `name` already
  appears in this table is skipped.
- Rows are written inside the same transaction that applies the migration. A rolled-back migration
  leaves no row behind.
- `name` is lexically comparable; the runner orders pending files by sorting filesystem entries.

**State transitions:** none. Rows are created and never updated or deleted by the application.
Manual intervention to delete a row is a deliberate operator decision (e.g., to re-apply after a
schema reset on a development machine).

**Bootstrap migration `0001_init.sql`:** creates this table itself. It is the only file that, by
design, executes against a database where this table does not yet exist. The runner detects the
absence of the table and creates it at the start of the first run before applying `0001_init.sql`.

---

## SecretEntry (in-memory + SQLite-backed)

Opaque key→value pair held by the secret-storage abstraction. In this feature, only test
placeholders are written; no real terminal device token, user token, or other production credential
is stored.

**TypeScript shape (in-process):**

```ts
interface SecretEntry {
  key: string;     // canonical name, e.g. "test.placeholder"
  value: string;   // opaque, plaintext at the call site only
}
```

**Persistence:**

| Layer        | Form                                                    |
|:-------------|:---------------------------------------------------------|
| In transit   | `string` at the `SecretStore.set(key, value)` call site. |
| At rest      | `BLOB` in a `secrets(key TEXT PRIMARY KEY, value BLOB NOT NULL)` SQLite table; ciphertext is the output of Electron `safeStorage.encryptString(value)`. The `NOT NULL` constraint enforces the call-site invariant (`set` rejects empty values; `delete` is the only path that removes a row). |
| In memory    | Decrypted on demand via `safeStorage.decryptString` and not retained beyond the scope of the caller's `get` call. |

**Backend selection:** the `SecretStore` constructor checks `safeStorage.isEncryptionAvailable()`:

| `isEncryptionAvailable()` | Build profile | Behavior                                                                |
|:-------------------------:|:--------------|:-------------------------------------------------------------------------|
| `true`                    | any           | Use `safeStorage` (DPAPI on Windows). This is the only production path. |
| `false`                   | dev / test    | Fall back to an in-memory map; log a clear warning.                     |
| `false`                   | production    | **Refuse to start.** The main process exits with a fatal error.          |

**Invariants:**
- A `set` overwrites any prior value for the same `key`. `delete` removes the row.
- Plaintext values exist only inside the calling function's stack frame and the OS's protected
  memory; they are never logged.
- The dev/test backend is never selected when `app.isPackaged === true`.

**Validation rules (constructor / set):**
- `key` MUST match `/^[a-z][a-z0-9_.-]{0,63}$/`. Rejects empty, whitespace, mixed-case, and overly
  long keys.
- `value` MUST be a non-empty string. Empty values are not stored; callers MUST `delete` instead.

---

## LogRecord (pino JSON output)

Every log record emitted by the application has a stable shape so downstream tooling (later
features, ops dashboards) can rely on it.

**Shape (one record = one JSON line):**

```json
{
  "level": "info",
  "time": "2026-05-01T08:23:45.123Z",
  "process": "main",
  "app_version": "0.1.0",
  "msg": "app:ready",
  "..."
}
```

| Field          | Type                                | Notes                                                             |
|:---------------|:-------------------------------------|:-------------------------------------------------------------------|
| `level`        | `"trace"|"debug"|"info"|"warn"|"error"|"fatal"` | pino's standard levels.                              |
| `time`         | string (ISO-8601, UTC)              | pino's `timestamp` set to ISO format.                             |
| `process`      | `"main"|"renderer"`                  | Set at logger construction.                                       |
| `app_version`  | string                              | Read from `package.json`'s `version` at startup; baked into base. |
| `msg`          | string                              | Short event identifier in `area:event` form (e.g., `db:migrated`). |
| `tx_id`?       | string (UUID)                       | Per Constitution VII; absent in 001 (no transactions yet).        |
| `terminal_id`? | string                              | Absent in 001 (no pairing yet).                                   |
| `cashier_user_id`? | string                          | Absent in 001 (no login yet).                                     |
| `request_id`?  | string                              | Absent in 001.                                                     |
| arbitrary structured fields                   |                                | Whatever the call site adds.                                       |

**Output destination:**
- `app.getPath('logs')` directory.
- File pattern: `pos-pulse-YYYYMMDD.log` rotated daily by `pino-roll`, kept for 14 days.
- One log file per day per process: main and renderer write to separate files (`main-…`,
  `renderer-…`) to avoid interleaving.

**Validation rules:**
- PII / card data / cashier passwords MUST NOT appear in any field. Enforced by code review +
  scrub layer in a later feature; in 001 there are no such values to scrub.
- Each line MUST be valid JSON. pino guarantees this.

---

## Notes

- No domain entities (Tenant, Branch, Terminal, Product, Inventory, Sale, etc.) are introduced in
  this feature. They land in 002 and onward.
- The `SchemaMigration` and `SecretEntry` rows live in the same SQLite database file. They are
  separate tables; future domain tables share the same DB.
