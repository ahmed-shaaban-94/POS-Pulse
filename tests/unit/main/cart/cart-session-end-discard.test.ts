/**
 * T063 — Cart discard on session end (S3 contract).
 *
 * When a cashier session ends and Q3 policy (a) is in effect, any draft
 * cart owned by that session MUST be discarded (state → 'cancelled') and
 * an audit event with category `cart.discarded_on_session_end` MUST be
 * emitted (spec Q5 LOCKED 2026-05-14).
 *
 * The subscriber/handler that wires session-end → discard lives in T070
 * (`src/main/cart/session-end-handler.ts`). That file does NOT exist yet.
 * This test does NOT import it. Instead, tests use:
 *   - Direct SQL to set up state (a draft cart owned by a closing session).
 *   - A vi.mock on AuditEmitter to intercept the audit call.
 *   - A thin "discard" helper function that represents the contract the
 *     T070 handler will satisfy — tests assert the DB mutation + audit.
 *
 * The strategy:
 *   1. Seed a draft cart in 'editing' state via CartBridgeHandlers.create().
 *   2. Call a `discardDraftCartForSessionEnd` helper (to be implemented in T070).
 *      If the function doesn't exist yet, the test itself is RED.
 *   3. Assert: cart state = 'cancelled', audit event emitted with correct shape.
 *
 * All tests are RED until T070 provides the `discardDraftCartForSessionEnd`
 * function (or equivalent session-end integration point).
 *
 * Audit-emission seam: `AuditEmitter` is vi.mock'd; the spy captures calls
 * without requiring the audit_events migration to be loaded.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { CartBridgeHandlers } from '../../../../src/main/cart/cart-bridge.js';
import { bindCartStore, type CartStore } from '../../../../src/main/cart/cart-store.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';
import { AuditEmitter } from '../../../../src/main/audit/audit-emitter.js';
import type { AuditEvent } from '../../../../src/shared/audit/event-shape.js';
import { discardDraftCartForSessionEnd } from '../../../../src/main/cart/session-end-handler.js';
import { makeSqlJsHandle } from './__helpers__/sql-js-handle.js';

vi.mock('../../../../src/main/audit/audit-emitter.js');

const __dirname0 = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname0, '..', '..', '..', '..');
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

function makeSession(overrides?: Partial<OperatorSessionRecord>): OperatorSessionRecord {
  return {
    id: 'sess-t063',
    operator_id: 'cashier-1',
    display_name: 'Cashier One',
    role: 'cashier',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    started_at: '2026-05-16T08:00:00.000Z',
    backend_session_id: 'b-sess-1',
    last_activity_at: '2026-05-16T08:00:00.000Z',
    ...overrides,
  };
}

interface SessionEndFixture {
  db: SqlJsDatabase;
  cartStore: CartStore;
  cart_id: string;
  session: OperatorSessionRecord;
}

async function newEditingCart(session = makeSession()): Promise<SessionEndFixture> {
  const db = new SQL.Database();
  for (const sql of MIGRATIONS) db.run(sql);
  const handle = makeSqlJsHandle(db);
  const store = bindCartStore(handle);
  const handlers = new CartBridgeHandlers({
    getCurrentSession: () => session,
    getTerminalId: () => 'terminal-test-380',
    cartStore: store,
    clock: () => new Date('2026-05-16T10:00:00.000Z'),
  });

  const createRes = await handlers.create({ idempotency_key: 'create-t063' });
  if (createRes.kind !== 'ok') throw new Error('create failed');

  db.run(`UPDATE carts SET state = 'editing' WHERE cart_id = ?`, [createRes.cart_id]);

  return { db, cartStore: store, cart_id: createRes.cart_id, session };
}

function readCartState(db: SqlJsDatabase, cart_id: string): string | null {
  const stmt = db.prepare('SELECT state FROM carts WHERE cart_id = ?');
  stmt.bind([cart_id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? (row['state'] as string) : null;
}

// ── S3 contract: session-end discard (T063 — RED until T070) ──────────────

describe('cart session-end discard — S3 contract (RED until T070)', () => {
  let f: SessionEndFixture;
  let auditEmitter: AuditEmitter;
  let emitFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    f = await newEditingCart();
    emitFn = vi.fn();
    auditEmitter = { emit: emitFn } as unknown as AuditEmitter;
  });

  it('discards the draft cart (state → cancelled)', async () => {
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: f.cart_id,
        operator_session_id: f.session.id,
        acting_operator_id: f.session.operator_id,
        discard_cause: 'signed_out',
        cartStore: f.cartStore,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    expect(readCartState(f.db, f.cart_id)).toBe('cancelled');
  });

  it('emits audit event with category cart.discarded_on_session_end', async () => {
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: f.cart_id,
        operator_session_id: f.session.id,
        acting_operator_id: f.session.operator_id,
        discard_cause: 'signed_out',
        cartStore: f.cartStore,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    expect(emitFn).toHaveBeenCalledOnce();
    const emittedEvent = emitFn.mock.calls[0][0] as AuditEvent;
    expect(emittedEvent.action_category).toBe('cart.discarded_on_session_end');
  });

  it('audit event payload carries cart_id, operator_session_id, and discard_cause', async () => {
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: f.cart_id,
        operator_session_id: f.session.id,
        acting_operator_id: f.session.operator_id,
        discard_cause: 'inactivity_timeout',
        cartStore: f.cartStore,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    const emittedEvent = emitFn.mock.calls[0][0] as AuditEvent;
    expect(emittedEvent.payload['cart_id']).toBe(f.cart_id);
    expect(emittedEvent.payload['operator_session_id']).toBe(f.session.id);
    expect(emittedEvent.payload['discard_cause']).toBe('inactivity_timeout');
  });

  it('audit event acting_operator_id matches the ending session owner', async () => {
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: f.cart_id,
        operator_session_id: f.session.id,
        acting_operator_id: f.session.operator_id,
        discard_cause: 'superseded_by_takeover',
        cartStore: f.cartStore,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    const emittedEvent = emitFn.mock.calls[0][0] as AuditEvent;
    expect(emittedEvent.acting_operator_id).toBe(f.session.operator_id);
  });

  it('audit event satisfies FR-025 mandatory attributes', async () => {
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: f.cart_id,
        operator_session_id: f.session.id,
        acting_operator_id: f.session.operator_id,
        discard_cause: 'signed_out',
        cartStore: f.cartStore,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    const emittedEvent = emitFn.mock.calls[0][0] as AuditEvent;
    expect(emittedEvent.acting_operator_id).toBeTruthy();
    expect(emittedEvent.originating_terminal_id).toBeTruthy();
    expect(emittedEvent.created_at).toBeTruthy();
    expect(emittedEvent.action_category).toBeTruthy();
    expect('shift_id' in emittedEvent).toBe(true);
  });

  it('does not discard a frozen_handed_off cart (only draft carts are discarded)', async () => {
    // Seed a frozen cart for the same session.
    const db2 = new SQL.Database();
    for (const sql of MIGRATIONS) db2.run(sql);
    const session2 = makeSession({ id: 'sess-t063-b', operator_id: 'cashier-2' });
    const handle2 = makeSqlJsHandle(db2);
    const store2 = bindCartStore(handle2);
    const handlers2 = new CartBridgeHandlers({
      getCurrentSession: () => session2,
      getTerminalId: () => 'terminal-test-380',
      cartStore: store2,
    });
    const createRes2 = await handlers2.create({ idempotency_key: 'create-t063-b' });
    if (createRes2.kind !== 'ok') throw new Error('create failed');
    db2.run(`UPDATE carts SET state = 'frozen_handed_off' WHERE cart_id = ?`, [createRes2.cart_id]);

    // A frozen cart should NOT be discarded by session-end policy (it's already in payment flow).
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: createRes2.cart_id,
        operator_session_id: session2.id,
        acting_operator_id: session2.operator_id,
        discard_cause: 'signed_out',
        cartStore: store2,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    // State must remain frozen — T070 must check state before discarding.
    expect(readCartState(db2, createRes2.cart_id)).toBe('frozen_handed_off');
    // No audit event for a frozen cart skip.
    expect(emitFn).not.toHaveBeenCalled();
  });

  it('handles the superseded_by_takeover discard_cause correctly', async () => {
    await expect(
      discardDraftCartForSessionEnd({
        cart_id: f.cart_id,
        operator_session_id: f.session.id,
        acting_operator_id: f.session.operator_id,
        discard_cause: 'superseded_by_takeover',
        cartStore: f.cartStore,
        auditEmitter,
      }),
    ).resolves.not.toThrow();

    const emittedEvent = emitFn.mock.calls[0][0] as AuditEvent;
    expect(emittedEvent.payload['discard_cause']).toBe('superseded_by_takeover');
    expect(readCartState(f.db, f.cart_id)).toBe('cancelled');
  });
});
