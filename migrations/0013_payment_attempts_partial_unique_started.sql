-- T061 — partial unique index on `payment_attempts(terminal_id) WHERE state='started'`.
-- Per data-model.md §"Entity: PaymentAttempt" Invariant 2 and research §R-6.
--
-- Each cashier terminal has one cash drawer; concurrent `started` attempts
-- on the same terminal would race the drawer hardware. The partial unique
-- index makes the database authoritative: a second `payments.start` against
-- a terminal that already has an in-flight attempt is rejected, mapped at
-- the bridge to refusal reason `attempt_already_started_on_terminal`.
--
-- Diverges from 005's analogous "one editing cart per session" rule (which
-- 005 enforces at the application layer; see research §R-6); 006 chooses
-- DB-level enforcement because the hardware coupling makes the stronger
-- guarantee load-bearing.

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_started_per_terminal
  ON payment_attempts (terminal_id)
  WHERE state = 'started';
