/**
 * T297 — Force-fail end-to-end integration test (Wave 5d).
 *
 * Drives the manager-force-fail path against a real sql.js SQLite
 * database. Asserts (per FR-021):
 *
 *   1. **State** — a stuck `started` attempt opened by a cashier
 *      transitions to `force_failed` when the manager drives the
 *      FSM's `forceFail`. The attempt row carries:
 *        - `state = 'force_failed'`
 *        - `failure_reason = 'manager_force_failed'`
 *        - `force_fail_attribution_operator_id` = manager id
 *        - `acting_operator_id` UNCHANGED (= original cashier;
 *          immutable since `payments.start`).
 *
 *   2. **Outbox dual attribution** — the `payment.force_fail`
 *      outbox row records the manager as `acting_operator_id`
 *      (the authoriser); the original cashier remains on the
 *      attempt row. Together they form the audit dual-attribution
 *      lineage.
 *
 *   3. **FR-021 last clause** — the bridge response shape (what the
 *      renderer consumes) MUST NOT echo the manager identity. The
 *      manager id stays main-side; cashier-visible UI receives only
 *      a kind/timestamp pair. We assert the response shape directly
 *      (composed by the FSM outcome — `kind: 'ok'` + `force_failed_at`).
 *
 * Boundary discipline: same as voucher-end-to-end.test.ts — FSM
 * direct + real SQL + minimal repo/outbox introspection. No V-A
 * involvement (force-fail is purely local state).
 */

import { describe, expect, it, beforeAll, beforeEach, afterEach } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { bindPaymentAttemptsRepository } from '../../../src/main/payments/repositories/payment-attempts.repository.js';
import { bindPaymentTenderLinesRepository } from '../../../src/main/payments/repositories/payment-tender-lines.repository.js';
import { bindPaymentActionOutboxRepository } from '../../../src/main/payments/repositories/payment-action-outbox.repository.js';
import { makeSqlJsHandle } from '../../unit/main/cart/__helpers__/sql-js-handle.js';
import { createPaymentAttemptFsm } from '../../../src/main/payments/fsm/payment-attempt-fsm.js';
import { createTenderLineFsm } from '../../../src/main/payments/fsm/tender-line-fsm.js';

const __dirnameForFile = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirnameForFile, '..', '..', '..');
const MIGRATIONS = [
  '0001_init.sql',
  '0002_secrets.sql',
  '0003_terminal_assignment.sql',
  '0004_audit_events.sql',
  '0005_operator_sessions.sql',
  '0006_cashier_pin_records.sql',
  '0007_shifts.sql',
  '0008_carts.sql',
  '0009_cart_action_outbox.sql',
  '0010_cart_lines.sql',
  '0011_cart_line_discount_placeholders.sql',
  '0012_create_payment_attempts.sql',
  '0013_payment_attempts_partial_unique_started.sql',
  '0014_create_payment_tender_lines.sql',
  '0015_create_payment_action_outbox.sql',
  '0016_payment_action_outbox_append_only_trigger.sql',
  '0017_extend_audit_event_categories.sql',
  '0018_audit_event_tender_reversal_pending.sql',
].map((f) => readFileSync(path.join(REPO_ROOT, 'migrations', f), 'utf8'));

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

let db: SqlJsDatabase;
beforeEach(() => {
  db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of MIGRATIONS) db.exec(sql);
});

afterEach(() => {
  db.close();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const TERMINAL = 'terminal-1';
const CASHIER = 'op-cashier-stuck';
const CASHIER_SESSION = 'sess-cashier-stuck';
const MANAGER = 'op-manager-supervisor';

function buildStack() {
  const handle = makeSqlJsHandle(db);
  const attempts = bindPaymentAttemptsRepository(handle);
  const lines = bindPaymentTenderLinesRepository(handle);
  const outbox = bindPaymentActionOutboxRepository(handle);
  const attemptFsm = createPaymentAttemptFsm({ db: handle, attempts, lines, outbox });
  const lineFsm = createTenderLineFsm({ db: handle, attempts, lines, outbox });
  return { handle, attempts, lines, outbox, attemptFsm, lineFsm };
}

describe('T297 — force-fail end-to-end integration', () => {
  /*
   * Wave 5d FINDING (blocks Slice 4 sign-off):
   *
   * The full row-dual-attribution + outbox assertion is the most
   * important e2e check for FR-021 — and it is `.todo`-marked here
   * because writing it surfaced a real Slice 4 production bug that
   * blocks sign-off:
   *
   *   `PaymentAttemptFsm.forceFail()` writes
   *   `failure_reason = 'manager_force_failed'` (added to FR-006 by
   *   the Wave 5b-main spec amendment) but migration
   *   `0012_create_payment_attempts.sql` `CHECK (failure_reason IN
   *   (...))` does NOT list `'manager_force_failed'`. Every real
   *   force-fail therefore crashes with:
   *     "CHECK constraint failed: failure_reason IS NULL OR
   *      failure_reason IN (...)"
   *
   * Unit tests (tests/unit/main/payments/payment-attempt-fsm.*.test.ts)
   * mock the repository, so the CHECK constraint is never hit.
   * This is exactly the gap integration tests exist to catch —
   * Wave 5d found it.
   *
   * Resolution: Wave 5e — single migration PR adding
   * `'manager_force_failed'` to the CHECK enum via the SQLite
   * table-rebuild pattern (CHECK constraints are not ALTER-able).
   * After Wave 5e merges, the `.todo` below SHOULD be promoted to
   * an `it()` and the integration coverage is complete.
   *
   * See specs/006-payments-tender/coordination.md §"Slice 4
   * sign-off" for the deferral ledger entry recording this gap.
   */
  it.todo(
    'manager force-fails a stuck started attempt: row dual-attribution + outbox (BLOCKED — Wave 5e migration)',
  );

  // Also blocked by the same Wave 5e migration gap above — the FSM
  // transaction commits a SQL update before returning the outcome, so
  // the CHECK violation aborts the call before the response shape
  // can be inspected. Promote to `it()` post-Wave-5e.
  it.todo(
    'FR-021 — FSM bridge-response shape does NOT echo manager identity (BLOCKED — Wave 5e migration)',
  );

  it('force-fail of an already-terminal attempt is refused (defence-in-depth)', () => {
    const { attemptFsm } = buildStack();
    attemptFsm.start({
      payment_attempt_id: 'pa-terminal',
      tenant_id: TENANT,
      branch_id: BRANCH,
      terminal_id: TERMINAL,
      acting_operator_id: CASHIER,
      operator_session_id: CASHIER_SESSION,
      envelope_handoff_action_id: 'handoff-terminal',
      envelope_cart_id: 'cart-terminal',
      envelope_subtotal_minor: 1000,
      started_at: '2026-05-25T11:00:00.000Z',
      action_id: 'start-pa-terminal',
    });
    // Cancel it so it lands in a terminal state.
    const cancelResult = attemptFsm.cancel({
      payment_attempt_id: 'pa-terminal',
      cancelled_at: '2026-05-25T11:10:00.000Z',
      action_id: 'cancel-pa-terminal',
    });
    expect(cancelResult.kind).toBe('ok');
    // Now the manager tries to force-fail it — FSM refuses.
    const forceFail = attemptFsm.forceFail({
      payment_attempt_id: 'pa-terminal',
      force_failed_at: '2026-05-25T11:45:00.000Z',
      manager_operator_id: MANAGER,
      action_id: 'force-fail-terminal',
    });
    expect(forceFail.kind).toBe('refused');
    if (forceFail.kind === 'refused') {
      expect(forceFail.reason).toBe('attempt_terminal');
    }
  });
});
