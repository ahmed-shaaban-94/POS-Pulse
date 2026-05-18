import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createCartBridgeHandlers } from '../../../../src/main/cart/wire-cart-handlers.js';
import { makeSqlJsHandle } from './__helpers__/sql-js-handle.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';

/**
 * T100 regression — production `createCartBridgeHandlers` wires a
 * DB-backed CartStore so that `cart.create` writes a row to SQLite.
 *
 * Before the fix, `src/main/index.ts` constructed `CartBridgeHandlers`
 * without `cartStore`, causing the handler to fall back to the in-memory
 * Map. This test would fail in that configuration because the `carts`
 * table would remain empty even after a successful `create` response.
 *
 * After the fix, `createCartBridgeHandlers` supplies `bindCartStore(dbHandle)`
 * and the INSERT lands in SQLite.
 */

const __dirnameForFile = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirnameForFile, '..', '..', '..', '..');

const MIGRATIONS = [
  '0008_carts.sql',
  '0009_cart_action_outbox.sql',
  '0010_cart_lines.sql',
  '0011_cart_line_discount_placeholders.sql',
].map((f) => readFileSync(path.join(REPO_ROOT, 'migrations', f), 'utf8'));

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

function freshDb(): SqlJsDatabase {
  const db = new SQL.Database();
  for (const sql of MIGRATIONS) db.run(sql);
  return db;
}

function makeSession(): OperatorSessionRecord {
  return {
    id: 'sess-t100-wiring',
    operator_id: 'cashier-wiring',
    display_name: 'Wiring Test Cashier',
    role: 'cashier',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    started_at: '2026-05-14T08:00:00.000Z',
    backend_session_id: 'bsess-wiring',
    last_activity_at: '2026-05-14T08:00:00.000Z',
  };
}

describe('production cart wiring (T100 regression)', () => {
  it('createCartBridgeHandlers writes a row to SQLite on cart.create', async () => {
    const sqlJsDb = freshDb();
    const dbHandle = makeSqlJsHandle(sqlJsDb);
    const session = makeSession();

    // createCartBridgeHandlers is the production entry point used by
    // src/main/index.ts — it must wire cartStore or this assertion fails.
    const handlers = createCartBridgeHandlers({
      dbHandle,
      getCurrentSession: () => session,
      // pino logger not needed; wire-cart-handlers accepts Logger type
      // but CartBridgeHandlersDeps marks it optional — pass undefined cast
      logger: undefined as never,
      auditEmitter: undefined as never,
    });

    const result = await handlers.create({ idempotency_key: 'ikey-t100-wiring' });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;

    const cartId = result.cart_id;

    // Query the live SQLite database to verify the row was persisted.
    // If cartStore was not wired (in-memory fallback), this query returns
    // zero rows and the test fails — which is the pre-fix failure mode.
    const stmt = sqlJsDb.prepare('SELECT cart_id, state FROM carts WHERE cart_id = ?');
    stmt.bind([cartId]);
    const rows: { cart_id: string; state: string }[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as { cart_id: string; state: string });
    }
    stmt.free();

    expect(rows).toHaveLength(1);
    expect(rows[0].cart_id).toBe(cartId);
    // CartState.empty is the initial state for a newly-created cart.
    expect(rows[0].state).toBe('empty');
  });
});
