import { describe, expect, it } from 'vitest';
import { resolveSessionScope } from '../../../../src/main/operator/resolve-session-scope.js';
import type { OperatorSessionRecord } from '../../../../src/main/operator/session-manager.js';

/**
 * #380 (F-007) — the extracted session-scope resolver shared by the payments
 * and sales session adapters in index.ts. This is the literal fix site: it
 * stamps the REAL terminal_id (resolved from the pairing store), NOT
 * session.branch_id (the retired F-007 shortcut). Extracted so the wiring is
 * testable (the index.ts closures were not) and deduplicated.
 */

const BRANCH = 'branch-637af303';
const REAL_TERMINAL = 'terminal-0556bfa4';

function session(overrides: Partial<OperatorSessionRecord> = {}): OperatorSessionRecord {
  return {
    id: 'sess-1',
    operator_id: 'op-1',
    display_name: 'Cashier One',
    role: 'cashier',
    tenant_id: 'tenant-1',
    branch_id: BRANCH,
    backend_session_id: 'be-1',
    started_at: '2026-06-14T00:00:00.000Z',
    last_activity_at: '2026-06-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('#380 resolveSessionScope', () => {
  it('stamps the REAL terminal_id (not branch_id) when paired', () => {
    const scope = resolveSessionScope(session(), REAL_TERMINAL);
    expect(scope).not.toBeNull();
    expect(scope?.terminal_id).toBe(REAL_TERMINAL);
    expect(scope?.terminal_id).not.toBe(BRANCH); // the F-007 bug
    expect(scope?.branch_id).toBe(BRANCH); // branch_id unchanged
  });

  it('carries through the session identity + display_name', () => {
    const scope = resolveSessionScope(
      session({ operator_id: 'op-x', display_name: 'Manager' }),
      REAL_TERMINAL,
    );
    expect(scope).toMatchObject({
      role: 'cashier',
      operator_id: 'op-x',
      operator_session_id: 'sess-1',
      tenant_id: 'tenant-1',
      display_name: 'Manager',
    });
  });

  it('returns null when there is no operator session', () => {
    expect(resolveSessionScope(null, REAL_TERMINAL)).toBeNull();
  });

  it('returns null when the terminal is unpaired (terminalId null) even with a session', () => {
    // An operator can be signed in on an unpaired terminal; it cannot transact.
    expect(resolveSessionScope(session(), null)).toBeNull();
  });
});
