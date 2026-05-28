/**
 * T094c regression — AD-2 scan scope must match what 006 writes into
 * `audit_events.originating_terminal_id`.
 *
 * 006's `paymentsSessionAdapter` sets the payment attempt's `terminal_id`
 * to `session.branch_id` (the documented F-007 shortcut — 004's session
 * record carries no separate terminal id). `payments-confirm` then emits
 * the `payment.settled` audit row with `originating_terminal_id =
 * row.terminal_id` — i.e. the BRANCH id value, not the pairing row's real
 * terminal_id.
 *
 * The AD-2 worker scans `WHERE originating_terminal_id = ?`. If index.ts
 * scopes the listener with the pairing row's real terminal_id (which
 * differs from branch_id in any real install), the scan matches ZERO
 * settled rows and finalizes nothing — silently breaking the happy path
 * (T111). Every unit fixture elsewhere uses a self-consistent terminal_id,
 * so this cross-component disagreement is invisible to them.
 *
 * This test pins the seam with DISTINCT branch_id and terminal_id values:
 *   • Positive: scoping the listener with the branch_id value (matching
 *     006) dispatches the settled row.
 *   • Negative: scoping with the real terminal_id value matches nothing —
 *     the exact bug this guards against.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createFinalizeListener } from '../../../../src/main/sales/finalize-listener.js';
import { makeSqlJsHandle } from '../cart/__helpers__/sql-js-handle.js';

const __dirnameForFile = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirnameForFile, '..', '..', '..', '..');
const MIGRATIONS = [
  '0004_audit_events.sql',
  '0020_create_sales.sql',
  '0021_sales_append_only_trigger.sql',
].map((f) => readFileSync(path.join(REPO_ROOT, 'migrations', f), 'utf8'));

// DISTINCT identifiers — this is the whole point of the test.
const TENANT_ID = 'tenant-1';
const BRANCH_ID = 'branch-XYZ';
const REAL_TERMINAL_ID = 'terminal-ABC'; // pairing row's real terminal_id

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

/**
 * Seed a `payment.settled` audit row EXACTLY as 006 writes it: the
 * `originating_terminal_id` column holds the branch_id value (the F-007
 * shortcut), NOT the real terminal_id.
 */
function seedSettledAs006Writes(handoff_action_id: string): void {
  const payload = JSON.stringify({
    handoff_action_id,
    payment_attempt_id: `pa-${handoff_action_id}`,
    cart_id: `cart-${handoff_action_id}`,
    settled_at: '2026-05-28T10:00:00.000Z',
  });
  db.run(
    `INSERT INTO audit_events (
       event_id, tenant_id, branch_id, originating_terminal_id, acting_operator_id,
       session_id, action_category, created_at, payload
     ) VALUES (?, ?, ?, ?, 'op-abc', 'sess-1', 'payment.settled', '2026-05-28T10:00:00.000Z', ?)`,
    [`evt-${handoff_action_id}`, TENANT_ID, BRANCH_ID, BRANCH_ID, payload],
  );
}

describe('T094c — AD-2 scan scope alignment with 006 (F-007)', () => {
  it('dispatches when the listener is scoped with the branch_id value (matches 006)', () => {
    seedSettledAs006Writes('handoff-1');
    const dispatched: string[] = [];
    const listener = createFinalizeListener({
      db: makeSqlJsHandle(db),
      tenant_id: TENANT_ID,
      branch_id: BRANCH_ID,
      // index.ts scopes with branch_id (the value 006 wrote) per F-007.
      terminal_id: BRANCH_ID,
      dispatch: (handoff) => dispatched.push(handoff),
      tickIntervalMs: 200,
      now: () => '2026-05-28T10:00:01.000Z',
    });
    listener.runTickOnce();
    expect(dispatched).toEqual(['handoff-1']);
  });

  it('matches NOTHING when scoped with the real terminal_id (the bug this guards)', () => {
    seedSettledAs006Writes('handoff-1');
    const dispatched: string[] = [];
    const listener = createFinalizeListener({
      db: makeSqlJsHandle(db),
      tenant_id: TENANT_ID,
      branch_id: BRANCH_ID,
      // The WRONG scope — pairing row's real terminal_id, which 006 never
      // wrote into originating_terminal_id. Proves the mismatch is silent.
      terminal_id: REAL_TERMINAL_ID,
      dispatch: (handoff) => dispatched.push(handoff),
      tickIntervalMs: 200,
      now: () => '2026-05-28T10:00:01.000Z',
    });
    listener.runTickOnce();
    expect(dispatched).toEqual([]);
  });
});
