-- T035 — bootstrap migration.
--
-- Creates the schema_migrations table. The migration runner (src/main/db/migrate.ts)
-- itself ensures this table exists via raw SQL before applying any file, so this
-- migration is the formal record that the table belongs to the schema. The
-- IF NOT EXISTS guard keeps the file idempotent against an already-prepared DB
-- (e.g., a developer who wiped schema_migrations rows but left the table intact).
--
-- Columns:
--   name        — basename of the migration file (e.g. "0001_init"). Primary key.
--   applied_at  — ISO-8601 timestamp captured at commit time of the migration's transaction.
--   checksum    — sha256 of the file content as applied. Reserved for future drift detection.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum   TEXT
);
