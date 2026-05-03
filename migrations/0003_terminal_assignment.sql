-- 002-terminal-pairing T008 — terminal_assignment table.
--
-- Persists the configuration half of "this terminal's identity": the
-- (tenant, branch, terminal) tuple plus a human label and the unix-epoch
-- timestamp at which the pair completed. The secret half (device_token)
-- lives in the SecretStore (Electron safeStorage / DPAPI) and is never
-- mirrored here.
--
-- Single-row invariant — the CHECK (id = 1) clause and the integer PK
-- together guarantee at most one row. A re-pair (admin-driven, per the
-- 2026-05-03 clarification of the spec) DELETEs the row and INSERTs a
-- fresh one as part of the new ceremony; UPDATEs are not used.
--
-- All ID-bearing columns are stored as opaque strings; the terminal does
-- not parse or validate their format. paired_at is unix epoch seconds for
-- sorting and human display only — it is never used as an expiry or as
-- part of authentication.
--
-- Writes happen exclusively through src/main/pairing/store.ts (lands in
-- US1 / US2). No other module gets a SQL cursor for this table.

CREATE TABLE terminal_assignment (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  tenant_id       TEXT    NOT NULL,
  branch_id       TEXT    NOT NULL,
  terminal_id     TEXT    NOT NULL,
  terminal_label  TEXT    NOT NULL,
  paired_at       INTEGER NOT NULL          -- unix epoch seconds
);
