import { describe, it, expect, beforeEach } from 'vitest';
import { CartBridgeHandlers } from '../../../../src/main/cart/cart-bridge.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';
import type { Role } from '../../../../src/shared/operator/role.js';

/**
 * T020 — `cart.create` role gating + happy path.
 *
 * Phase 1 S1 scope: in-memory cart creation. No persistence (that is S2/§A2).
 * Every handler MUST call `requireOperatorSession` as its first instruction;
 * a missing session returns the generic `no_session` refusal.
 */

const DISPLAY_NAMES: Record<Role, string> = {
  cashier: 'Cashier One',
  manager: 'Manager One',
  admin: 'Admin One',
};

function makeSession(
  role: Role,
  overrides?: Partial<OperatorSessionRecord>,
): OperatorSessionRecord {
  return {
    id: 'sess-t020',
    operator_id: `op-${role}-1`,
    display_name: DISPLAY_NAMES[role],
    role,
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    started_at: '2026-05-14T08:00:00.000Z',
    backend_session_id: 'backend-sess-1',
    last_activity_at: '2026-05-14T08:00:00.000Z',
    ...overrides,
  };
}

function makeHandlers(currentSession: OperatorSessionRecord | null): CartBridgeHandlers {
  return new CartBridgeHandlers({
    getCurrentSession: () => currentSession,
  });
}

describe('cart.create — role gating', () => {
  let req: { idempotency_key: string };

  beforeEach(() => {
    req = { idempotency_key: 'idempotency-key-t020-1' };
  });

  it('succeeds for cashier with active session', async () => {
    const handlers = makeHandlers(makeSession('cashier'));
    const res = await handlers.create(req);
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(typeof res.cart_id).toBe('string');
      expect(res.cart_id.length).toBeGreaterThan(0);
    }
  });

  it('succeeds for manager with active session', async () => {
    const handlers = makeHandlers(makeSession('manager'));
    const res = await handlers.create(req);
    expect(res.kind).toBe('ok');
  });

  it('succeeds for admin with active session', async () => {
    const handlers = makeHandlers(makeSession('admin'));
    const res = await handlers.create(req);
    expect(res.kind).toBe('ok');
  });

  it('refuses with no_session when no operator is signed in', async () => {
    const handlers = makeHandlers(null);
    const res = await handlers.create(req);
    expect(res.kind).toBe('refused');
    if (res.kind === 'refused') {
      expect(res.reason).toBe('no_session');
    }
  });

  it('emits no factor-distinguishing detail in the no_session refusal', async () => {
    const handlers = makeHandlers(null);
    const res = await handlers.create(req);
    if (res.kind === 'refused') {
      // Only kind + reason in the response object — no echo of payload.
      expect(Object.keys(res).sort()).toEqual(['kind', 'reason']);
    }
  });

  it('returns distinct cart_ids for two successful create calls', async () => {
    const handlers = makeHandlers(makeSession('cashier'));
    const r1 = await handlers.create({ idempotency_key: 'k1' });
    const r2 = await handlers.create({ idempotency_key: 'k2' });
    if (r1.kind === 'ok' && r2.kind === 'ok') {
      expect(r1.cart_id).not.toBe(r2.cart_id);
    }
  });
});

describe('cart.* — remaining stub handlers refuse generically after gate (S1)', () => {
  async function withCart(): Promise<{
    handlers: CartBridgeHandlers;
    cart_id: string;
  }> {
    const session = makeSession('cashier');
    const handlers = makeHandlers(session);
    const r = await handlers.create({ idempotency_key: 'create-k' });
    if (r.kind !== 'ok') throw new Error('create failed');
    return { handlers, cart_id: r.cart_id };
  }

  it('linesUpdate gated: no_session when signed out', async () => {
    const h = makeHandlers(null);
    const r = await h.linesUpdate({
      cart_id: 'c',
      line_id: 'l',
      op: 'increment',
      delta: 1,
      version: 1,
      idempotency_key: 'k',
    });
    expect(r).toEqual({ kind: 'refused', reason: 'no_session' });
  });

  it('linesUpdate on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.linesUpdate({
      cart_id,
      line_id: 'l1',
      op: 'set',
      absolute: 2,
      version: 1,
      idempotency_key: 'k',
    });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('linesRemove on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.linesRemove({
      cart_id,
      line_id: 'l1',
      version: 1,
      idempotency_key: 'k',
    });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('linesSetNote on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.linesSetNote({
      cart_id,
      line_id: 'l1',
      note: 'n',
      version: 1,
      idempotency_key: 'k',
    });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('discountPlaceholdersAdd on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.discountPlaceholdersAdd({
      cart_id,
      line_id: 'l',
      placeholder_kind: 'X',
      idempotency_key: 'k',
    });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('discountPlaceholdersRemove on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.discountPlaceholdersRemove({
      cart_id,
      placeholder_id: 'p',
      idempotency_key: 'k',
    });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('void on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.void({ cart_id, idempotency_key: 'k' });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('handoff on own cart returns not_implemented', async () => {
    const { handlers, cart_id } = await withCart();
    const r = await handlers.handoff({ cart_id, per_line_versions: [], idempotency_key: 'k' });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('subscribe returns not_implemented when signed in', async () => {
    const h = makeHandlers(makeSession('cashier'));
    const r = await h.subscribe({ cart_id: 'c' });
    expect(r).toEqual({ kind: 'refused', reason: 'not_implemented' });
  });

  it('subscribe refuses with no_session when signed out', async () => {
    const h = makeHandlers(null);
    const r = await h.subscribe({ cart_id: 'c' });
    expect(r).toEqual({ kind: 'refused', reason: 'no_session' });
  });
});
