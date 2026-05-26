-- T020 — 008 Slice 1a: create sales table.
-- Schema per data-model.md §"Entity: Sale".
-- §A3 sign-off: coordination.md §"§A3 migration reviewer thread (T003)" (Ahmed 2026-05-26).
--
-- The Sale row is physically immutable after INSERT. The append-only triggers
-- are authored in the next migration (0021) so this file is the schema-only
-- declaration; sister migration 0021 enforces the append-only invariant.

CREATE TABLE IF NOT EXISTS sales (
  sale_id                          TEXT     NOT NULL PRIMARY KEY,
  sale_number                      TEXT     NOT NULL,
  receipt_number                   TEXT     NOT NULL,
  envelope_handoff_action_id       TEXT     NOT NULL,
  payment_attempt_id               TEXT     NOT NULL,
  envelope_cart_id                 TEXT     NOT NULL,
  tenant_id                        TEXT     NOT NULL,
  branch_id                        TEXT     NOT NULL,
  terminal_id                      TEXT     NOT NULL,
  terminal_label                   TEXT     NOT NULL,
  selling_operator_id              TEXT     NOT NULL,
  selling_operator_display_name    TEXT     NOT NULL,
  selling_operator_session_id      TEXT     NOT NULL,
  subtotal_minor                   INTEGER  NOT NULL CHECK (subtotal_minor >= 0),
  total_tax_minor                  INTEGER  NOT NULL CHECK (total_tax_minor >= 0),
  total_change_due_minor           INTEGER  NOT NULL CHECK (total_change_due_minor >= 0),
  tender_lines_summary_json        TEXT     NOT NULL,
  settled_at                       TEXT     NOT NULL,
  finalized_at                     TEXT     NOT NULL,
  tenant_tax_registration_id       TEXT     NOT NULL,
  branch_name                      TEXT     NOT NULL,
  branch_address                   TEXT     NOT NULL,
  local_calendar_day               TEXT     NOT NULL
);

-- AD-2 idempotency anchor (FR-001 / SC-009): one Sale per envelope-handoff.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_envelope_handoff_action_id
  ON sales (envelope_handoff_action_id);

-- AD-7 allocator output uniqueness (FR-010): one sale_number per terminal per day.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_terminal_sale_number
  ON sales (terminal_id, sale_number);

-- Tenant-isolation query path (Constitution §P17).
CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch_terminal
  ON sales (tenant_id, branch_id, terminal_id);

-- "Sales finalized today on this terminal" — receipt re-lookup for cashier.
CREATE INDEX IF NOT EXISTS idx_sales_terminal_local_calendar_day
  ON sales (terminal_id, local_calendar_day);
