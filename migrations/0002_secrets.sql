-- T042 — secrets storage table.
--
-- Stores opaque key→ciphertext pairs for the SecretStore abstraction
-- (src/main/secrets/). The production backend writes Electron
-- `safeStorage.encryptString(value)` output here; in 001 only test
-- placeholders are stored. Real terminal/device tokens land in 002+.
--
-- Columns:
--   key   — canonical lowercase-dotted-kebab name. Validated at the
--           SecretStore boundary against /^[a-z][a-z0-9_.-]{0,63}$/.
--           PRIMARY KEY enforces uniqueness; `set` overwrites via
--           INSERT OR REPLACE.
--   value — DPAPI ciphertext bytes. NOT NULL constraint pairs with the
--           SecretStore's empty-value rejection: callers MUST `delete`
--           rather than `set(key, '')`.
CREATE TABLE IF NOT EXISTS secrets (
  key   TEXT PRIMARY KEY,
  value BLOB NOT NULL
);
