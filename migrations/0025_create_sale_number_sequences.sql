-- T025 — 008 Slice 1a: create sale_number_sequences table (intentionally MUTABLE).
-- Schema per data-model.md §"Entity: SaleNumberSequences".
-- §A3 sign-off: coordination.md §"§A3 migration reviewer thread (T003)" (Ahmed 2026-05-26).
--
-- THE ONLY MUTABLE 008 TABLE. No append-only trigger — UPSERT-and-increment
-- is the AD-7 allocator contract. Composite primary key
-- (terminal_id, calendar_day_local) is the load-bearing collision-impossibility
-- guarantee.

CREATE TABLE IF NOT EXISTS sale_number_sequences (
  terminal_id           TEXT     NOT NULL,
  calendar_day_local    TEXT     NOT NULL,
  next_sequence         INTEGER  NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),
  updated_at            TEXT     NOT NULL,

  PRIMARY KEY (terminal_id, calendar_day_local)
);
