import { describe, it, expect } from 'vitest';
import { requireOperatorSession } from '../../../../src/main/cart/require-operator-session.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';
import { CartState } from '../../../../src/shared/cart/cart-state.js';

function makeSession(overrides?: Partial<OperatorSessionRecord>): OperatorSessionRecord {
  return {
    id: 'session-uuid-1',
    operator_id: 'op-id-1',
    display_name: 'Test Cashier',
    role: 'cashier',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    started_at: '2026-05-14T08:00:00.000Z',
    backend_session_id: 'backend-session-1',
    last_activity_at: '2026-05-14T08:05:00.000Z',
    ...overrides,
  };
}

describe('requireOperatorSession', () => {
  // ── No-session ──────────────────────────────────────────────────────────────

  it('returns refused/no_session when session is null', () => {
    const result = requireOperatorSession({ session: null });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('no_session');
    }
  });

  it('returns ok when session is present and no role restriction', () => {
    const session = makeSession();
    const result = requireOperatorSession({ session });
    expect(result.kind).toBe('ok');
  });

  // ── Role gating ─────────────────────────────────────────────────────────────

  it('returns ok when session role is in the allowed set', () => {
    const session = makeSession({ role: 'cashier' });
    const result = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    expect(result.kind).toBe('ok');
  });

  it('returns refused/role_denied when session role is NOT in the allowed set', () => {
    const session = makeSession({ role: 'cashier' });
    const result = requireOperatorSession({
      session,
      allowedRoles: ['manager', 'admin'],
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('role_denied');
    }
  });

  it('allows manager when manager is in the allowed set', () => {
    const session = makeSession({ role: 'manager' });
    const result = requireOperatorSession({
      session,
      allowedRoles: ['manager', 'admin'],
    });
    expect(result.kind).toBe('ok');
  });

  it('allows admin when admin is in the allowed set', () => {
    const session = makeSession({ role: 'admin' });
    const result = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    expect(result.kind).toBe('ok');
  });

  // ── Tenant isolation ─────────────────────────────────────────────────────────

  it('returns refused/tenant_isolation when cart tenant_id does not match session', () => {
    const session = makeSession({ tenant_id: 'tenant-1', branch_id: 'branch-1' });
    const result = requireOperatorSession({
      session,
      cart: {
        operator_session_id: 'session-uuid-1',
        tenant_id: 'tenant-OTHER',
        branch_id: 'branch-1',
        state: CartState.editing,
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('tenant_isolation');
    }
  });

  it('returns refused/tenant_isolation when cart branch_id does not match session', () => {
    const session = makeSession({ tenant_id: 'tenant-1', branch_id: 'branch-1' });
    const result = requireOperatorSession({
      session,
      cart: {
        operator_session_id: 'session-uuid-1',
        tenant_id: 'tenant-1',
        branch_id: 'branch-OTHER',
        state: CartState.editing,
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('tenant_isolation');
    }
  });

  // ── Wrong owner ──────────────────────────────────────────────────────────────

  it('returns refused/wrong_owner when cart session does not match and role is cashier', () => {
    const session = makeSession({ id: 'session-uuid-1', role: 'cashier' });
    const result = requireOperatorSession({
      session,
      cart: {
        operator_session_id: 'session-uuid-DIFFERENT',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        state: CartState.editing,
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('wrong_owner');
    }
  });

  it('does NOT return wrong_owner for manager accessing another cashier cart', () => {
    const session = makeSession({ id: 'session-uuid-manager', role: 'manager' });
    const result = requireOperatorSession({
      session,
      cart: {
        operator_session_id: 'session-uuid-cashier',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        state: CartState.editing,
      },
    });
    // Manager should NOT be wrong_owner; could be ok or role_denied depending on allowedRoles
    if (result.kind === 'refused') {
      expect(result.reason).not.toBe('wrong_owner');
    }
  });

  // ── Cart state guards ────────────────────────────────────────────────────────

  it('returns refused/frozen when cart state is frozen_handed_off and requireMutable is true', () => {
    const session = makeSession();
    const result = requireOperatorSession({
      session,
      cart: {
        operator_session_id: 'session-uuid-1',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        state: CartState.frozen_handed_off,
      },
      requireMutable: true,
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('frozen');
    }
  });

  it('returns refused/closed when cart state is cancelled and requireMutable is true', () => {
    const session = makeSession();
    const result = requireOperatorSession({
      session,
      cart: {
        operator_session_id: 'session-uuid-1',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        state: CartState.cancelled,
      },
      requireMutable: true,
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('closed');
    }
  });

  // ── ok result shape ──────────────────────────────────────────────────────────

  it('ok result contains the session object', () => {
    const session = makeSession();
    const result = requireOperatorSession({ session });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.session).toBe(session);
    }
  });

  it('refused result does NOT contain a session field', () => {
    const result = requireOperatorSession({ session: null });
    expect(result.kind).toBe('refused');
    expect(Object.keys(result)).not.toContain('session');
  });

  it('refused reason uses "reason" field — NOT "category" (OperatorRefusal shape)', () => {
    const result = requireOperatorSession({ session: null });
    expect(result).toHaveProperty('reason');
    expect(result).not.toHaveProperty('category');
  });
});
