/**
 * T130 — `requireOperatorSession` payments wrapper test (RED).
 *
 * Asserts the wrapper delegates to 004's `role-enforcement.ts` semantics
 * and maps every failure mode to the closed RefusalReason set per
 * contracts/bridge-api.md §"Bridge gating":
 *
 *   no session             → no_session
 *   wrong role             → role_denied
 *   attempt's session_id   ≠ active session    → wrong_owner
 *   attempt tenant/branch/terminal mismatch    → tenant_isolation
 *   attempt in terminal state (settled/...)    → attempt_terminal
 *
 * The wrapper is the only authorised seam for 006 bridge handlers to
 * resolve the active operator session. It MUST refuse with the closed
 * generic reasons above; nothing factor-distinguishing crosses to the
 * renderer (FR-022, 004 NFR-003).
 */

import { describe, expect, it } from 'vitest';
import {
  requireOperatorSession,
  type RequireOperatorSessionResult,
} from '../../../../src/main/payments/require-operator-session.js';

function buildSession() {
  return {
    role: 'cashier' as const,
    operator_id: 'op-clerk-user-abc',
    operator_session_id: 'sess-1',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'terminal-1',
    display_name: 'Test Operator',
  };
}

describe('T130 — requireOperatorSession', () => {
  it('refuses with no_session when there is no active session', () => {
    const result: RequireOperatorSessionResult = requireOperatorSession({
      session: null,
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('no_session');
  });

  it('refuses with role_denied when session role is outside allowedRoles', () => {
    const result = requireOperatorSession({
      session: { ...buildSession(), role: 'cashier' },
      allowedRoles: ['manager', 'admin'],
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('role_denied');
  });

  it('returns the session when role matches', () => {
    const session = buildSession();
    const result = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.session).toBe(session);
  });

  it('refuses with wrong_owner when attempt.operator_session_id differs', () => {
    const result = requireOperatorSession({
      session: buildSession(),
      allowedRoles: ['cashier'],
      attempt: {
        operator_session_id: 'sess-OTHER',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        terminal_id: 'terminal-1',
        state: 'started',
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('wrong_owner');
  });

  it('refuses with tenant_isolation on tenant mismatch', () => {
    const result = requireOperatorSession({
      session: buildSession(),
      allowedRoles: ['cashier'],
      attempt: {
        operator_session_id: 'sess-1',
        tenant_id: 'tenant-OTHER',
        branch_id: 'branch-1',
        terminal_id: 'terminal-1',
        state: 'started',
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('tenant_isolation');
  });

  it('refuses with tenant_isolation on branch mismatch', () => {
    const result = requireOperatorSession({
      session: buildSession(),
      allowedRoles: ['cashier'],
      attempt: {
        operator_session_id: 'sess-1',
        tenant_id: 'tenant-1',
        branch_id: 'branch-OTHER',
        terminal_id: 'terminal-1',
        state: 'started',
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('tenant_isolation');
  });

  it('refuses with tenant_isolation on terminal mismatch', () => {
    const result = requireOperatorSession({
      session: buildSession(),
      allowedRoles: ['cashier'],
      attempt: {
        operator_session_id: 'sess-1',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        terminal_id: 'terminal-OTHER',
        state: 'started',
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('tenant_isolation');
  });

  it.each(['settled', 'cancelled', 'failed', 'force_failed'] as const)(
    'refuses with attempt_terminal when attempt is in %s state',
    (state) => {
      const result = requireOperatorSession({
        session: buildSession(),
        allowedRoles: ['cashier'],
        attempt: {
          operator_session_id: 'sess-1',
          tenant_id: 'tenant-1',
          branch_id: 'branch-1',
          terminal_id: 'terminal-1',
          state,
        },
      });
      expect(result.kind).toBe('refused');
      if (result.kind === 'refused') expect(result.reason).toBe('attempt_terminal');
    },
  );

  it('prefers tenant_isolation over wrong_owner when both diverge (no existence side-channel)', () => {
    // An out-of-scope probe with a guessed payment_attempt_id must NOT
    // reveal whether the row belongs to a real operator outside the
    // caller's scope. Isolation is checked first, so the refusal reason
    // is the same regardless of ownership outside scope.
    const result = requireOperatorSession({
      session: buildSession(),
      allowedRoles: ['cashier'],
      attempt: {
        operator_session_id: 'sess-OTHER',
        tenant_id: 'tenant-OTHER',
        branch_id: 'branch-1',
        terminal_id: 'terminal-1',
        state: 'started',
      },
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('tenant_isolation');
  });

  it('returns the session + attempt on a fully-valid call', () => {
    const session = buildSession();
    const attempt = {
      operator_session_id: 'sess-1',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      terminal_id: 'terminal-1',
      state: 'started' as const,
    };
    const result = requireOperatorSession({
      session,
      allowedRoles: ['cashier'],
      attempt,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.session).toBe(session);
    }
  });
});
