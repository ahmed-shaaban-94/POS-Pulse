import { describe, it, expect } from 'vitest';
import { CartBridgeHandlers } from '../../../../src/main/cart/cart-bridge.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';
import type { Role } from '../../../../src/shared/operator/role.js';

/**
 * T021 — `cart.lines.add` role gating, tenant isolation, wrong-owner refusal.
 *
 * Phase 1 S1 scope: persistence is NOT wired (S2/§A2). The bridge MUST
 * still run the role + ownership + tenant gate before refusing with
 * `not_implemented`. The gate must short-circuit BEFORE `not_implemented`
 * so an unauthorized caller never learns whether persistence exists.
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
    id: 'sess-t021',
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

async function createCart(handlers: CartBridgeHandlers): Promise<string> {
  const res = await handlers.create({ idempotency_key: 'create-k' });
  if (res.kind !== 'ok') throw new Error('expected ok cart.create');
  return res.cart_id;
}

describe('cart.lines.add — role gating', () => {
  it('refuses with no_session when not signed in', async () => {
    const handlers = makeHandlers(null);
    const res = await handlers.linesAdd({
      cart_id: 'cart-x',
      item_ref: 'SKU-1',
      quantity: 1,
      idempotency_key: 'k1',
    });
    expect(res.kind).toBe('refused');
    if (res.kind === 'refused') {
      expect(res.reason).toBe('no_session');
    }
  });

  it('with valid session + unknown cart returns refused (no_session-equivalent generic)', async () => {
    // Unknown cart_id → bridge cannot resolve; refuses generically.
    const handlers = makeHandlers(makeSession('cashier'));
    const res = await handlers.linesAdd({
      cart_id: 'nonexistent-cart',
      item_ref: 'SKU-1',
      quantity: 1,
      idempotency_key: 'k2',
    });
    expect(res.kind).toBe('refused');
  });

  it('refuses with wrong_owner when cashier targets another cashier cart', async () => {
    const ownerSession = makeSession('cashier', {
      id: 'sess-owner',
      operator_id: 'cashier-owner',
    });
    const handlers = makeHandlers(ownerSession);
    const cart_id = await createCart(handlers);

    // Switch to a different cashier session (different session id).
    const otherHandlers = new CartBridgeHandlers({
      getCurrentSession: () =>
        makeSession('cashier', { id: 'sess-other', operator_id: 'cashier-other' }),
      shareStateWith: handlers,
    });

    const res = await otherHandlers.linesAdd({
      cart_id,
      item_ref: 'SKU-1',
      quantity: 1,
      idempotency_key: 'k3',
    });
    expect(res.kind).toBe('refused');
    if (res.kind === 'refused') {
      expect(res.reason).toBe('wrong_owner');
    }
  });

  it('refuses with tenant_isolation when session tenant differs from cart tenant', async () => {
    const t1Session = makeSession('cashier', { tenant_id: 'tenant-1' });
    const handlers = makeHandlers(t1Session);
    const cart_id = await createCart(handlers);

    const t2Handlers = new CartBridgeHandlers({
      getCurrentSession: () =>
        makeSession('cashier', { tenant_id: 'tenant-2', branch_id: 'branch-1' }),
      shareStateWith: handlers,
    });

    const res = await t2Handlers.linesAdd({
      cart_id,
      item_ref: 'SKU-1',
      quantity: 1,
      idempotency_key: 'k4',
    });
    expect(res.kind).toBe('refused');
    if (res.kind === 'refused') {
      expect(res.reason).toBe('tenant_isolation');
    }
  });

  it('with valid session on own cart returns not_implemented (persistence is S2)', async () => {
    const session = makeSession('cashier');
    const handlers = makeHandlers(session);
    const cart_id = await createCart(handlers);

    const res = await handlers.linesAdd({
      cart_id,
      item_ref: 'SKU-1',
      quantity: 1,
      idempotency_key: 'k5',
    });
    expect(res.kind).toBe('refused');
    if (res.kind === 'refused') {
      expect(res.reason).toBe('not_implemented');
    }
  });

  it('refusal shape is exactly { kind, reason } — no payload echo', async () => {
    const handlers = makeHandlers(null);
    const res = await handlers.linesAdd({
      cart_id: 'cart-x',
      item_ref: 'SKU-1',
      quantity: 1,
      idempotency_key: 'k6',
    });
    if (res.kind === 'refused') {
      expect(Object.keys(res).sort()).toEqual(['kind', 'reason']);
    }
  });
});
