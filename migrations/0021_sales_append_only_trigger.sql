-- T021 — 008 Slice 1a: sales append-only triggers (AD-3).
-- Schema per data-model.md §"Append-only triggers (plan-pinned)".
-- §A3 sign-off: coordination.md §"§A3 migration reviewer thread (T003)" (Ahmed 2026-05-26).
--
-- The Sale row is physically immutable after INSERT. UPDATE and DELETE are
-- denied at the schema layer. Application-layer code MUST NOT attempt either;
-- the triggers are the defense-in-depth guard.
--
-- Pattern mirrors 006's payment_action_outbox triggers (migrations/0016) and
-- 004's audit_events triggers (migrations/0004).

CREATE TRIGGER IF NOT EXISTS trg_sales_no_update
BEFORE UPDATE ON sales
BEGIN
  SELECT RAISE(ABORT, 'sales is append-only — UPDATE denied (008 AD-3)');
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_no_delete
BEFORE DELETE ON sales
BEGIN
  SELECT RAISE(ABORT, 'sales is append-only — DELETE denied (008 AD-3)');
END;
