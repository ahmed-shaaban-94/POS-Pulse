/**
 * T070 — Session-end cart discard subscriber wiring (S3 contract).
 *
 * Verifies that `registerSessionEndCartDiscardSubscriber` correctly wires
 * `SessionManager.end()` → cart discard. Tests exercise the full path:
 * `sessionManager.end()` → subscriber lookup via `findDraftCartBySession` →
 * `discardDraftCartForSessionEnd` → DB mutation + audit emission.
 *
 * Tests do NOT call `discardDraftCartForSessionEnd` directly — that is
 * T063's domain. Here the discard must flow through the wired subscriber.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { CartBridgeHandlers } from '../../../../src/main/cart/cart-bridge.js';
import { bindCartStore } from '../../../../src/main/cart/cart-store.js';
import { SessionManager } from '../../../../src/main/operator/session-manager.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';
import { AuditEmitter } from '../../../../src/main/audit/audit-emitter.js';
import type { AuditEvent } from '../../../../src/shared/audit/event-shape.js';
import { registerSessionEndCartDiscardSubscriber } from '../../../../src/main/cart/session-end-handler.js';
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

interface WiringFixture {
  db: SqlJsDatabase;
  sessionManager: SessionManager;
  cart_id: string;
  session: OperatorSessionRecord;
  auditEmitter: AuditEmitter;
  emitSpy: ReturnType<typeof vi.spyOn>;
}

async function newWiredFixture(): Promise<WiringFixture> {
  const db = new SQL.Database();
  for (const sql of MIGRATIONS) db.run(sql);
  const handle = makeSqlJsHandle(db);
  const cartStore = bindCartStore(handle);
  const sessionManager = new SessionManager();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditEmitter = new AuditEmitter(null as any);

  vi.clearAllMocks();
  const emitSpy = vi.spyOn(AuditEmitter.prototype, 'emit');

  registerSessionEndCartDiscardSubscriber({ sessionManager, cartStore, auditEmitter });

  const session = sessionManager.create({
    operator_id: 'cashier-1',
    display_name: 'Cashier One',
    role: 'cashier',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    backend_session_id: 'b-sess-wiring',
    started_at: '2026-05-16T08:00:00.000Z',
  });

  const handlers = new CartBridgeHandlers({
    getCurrentSession: () => sessionManager.getCurrent(),
    cartStore,
    clock: () => new Date('2026-05-16T10:00:00.000Z'),
  });

  const createRes = await handlers.create({ idempotency_key: 'create-wiring' });
  if (createRes.kind !== 'ok') throw new Error('create failed');
  db.run(`UPDATE carts SET state = 'editing' WHERE cart_id = ?`, [createRes.cart_id]);

  return { db, sessionManager, cart_id: createRes.cart_id, session, auditEmitter, emitSpy };
}

function readCartState(db: SqlJsDatabase, cart_id: string): string | null {
  const stmt = db.prepare('SELECT state FROM carts WHERE cart_id = ?');
  stmt.bind([cart_id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? (row['state'] as string) : null;
}

describe('session-end cart discard subscriber — wiring (T070)', () => {
  let f: WiringFixture;

  beforeEach(async () => {
    f = await newWiredFixture();
  });

  it('discards the draft cart when sessionManager.end() is called', async () => {
    f.sessionManager.end('signed_out');
    await Promise.resolve(); // flush microtask queue
    expect(readCartState(f.db, f.cart_id)).toBe('cancelled');
  });

  it('emits audit event with category cart.discarded_on_session_end via session end', async () => {
    f.sessionManager.end('signed_out');
    await Promise.resolve();
    expect(f.emitSpy).toHaveBeenCalledOnce();
    const event = f.emitSpy.mock.calls[0]?.[0] as AuditEvent;
    expect(event.action_category).toBe('cart.discarded_on_session_end');
  });

  it('defaults discard_cause to signed_out when end() is called with no cause', async () => {
    f.sessionManager.end(); // no cause — simulates SignOutHandler / InactivityMonitor
    await Promise.resolve();
    const event = f.emitSpy.mock.calls[0]?.[0] as AuditEvent;
    expect(event.payload['discard_cause']).toBe('signed_out');
    expect(readCartState(f.db, f.cart_id)).toBe('cancelled');
  });

  it('passes the correct discard_cause through to the audit event', async () => {
    f.sessionManager.end('inactivity_timeout');
    await Promise.resolve();
    const event = f.emitSpy.mock.calls[0]?.[0] as AuditEvent;
    expect(event.payload['discard_cause']).toBe('inactivity_timeout');
  });

  it('does not discard a frozen_handed_off cart on session end', async () => {
    f.db.run(`UPDATE carts SET state = 'frozen_handed_off' WHERE cart_id = ?`, [f.cart_id]);
    f.sessionManager.end('signed_out');
    await Promise.resolve();
    expect(readCartState(f.db, f.cart_id)).toBe('frozen_handed_off');
    expect(f.emitSpy).not.toHaveBeenCalled();
  });

  it('does nothing when no cart exists for the ending session', async () => {
    // End a session that owns no cart (create fresh session manager with no cart seeded).
    const db2 = new SQL.Database();
    for (const sql of MIGRATIONS) db2.run(sql);
    const store2 = bindCartStore(makeSqlJsHandle(db2));
    const sm2 = new SessionManager();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ae2 = new AuditEmitter(null as any);
    const spy2 = vi.spyOn(AuditEmitter.prototype, 'emit');
    registerSessionEndCartDiscardSubscriber({ sessionManager: sm2, cartStore: store2, auditEmitter: ae2 });
    sm2.create({
      operator_id: 'cashier-empty',
      display_name: 'Empty',
      role: 'cashier',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      backend_session_id: 'b-empty',
    });
    sm2.end('signed_out');
    await Promise.resolve();
    expect(spy2).not.toHaveBeenCalled();
  });
});
