import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { SessionManager } from '../../../../src/main/operator/session-manager.js';
import { LifecycleCascade } from '../../../../src/main/operator/lifecycle-cascade.js';

/**
 * T051c — account-disabled-mid-session cascade (C2 addendum / Edge Cases).
 *
 * When the operator's Clerk account becomes disabled (detected on the next
 * privileged bridge call returning a generic 401/disabled-account refusal),
 * `LifecycleCascade.notifyAccountDisabled()` must:
 *   1. Terminate the active session.
 *   2. Record end_cause = 'account_disabled_mid_session'.
 *   3. The renderer receives NO disclosure of WHY the session ended beyond
 *      the generic "credentials not recognised" path (NFR-003 / PR-2) —
 *      verified here by checking getCurrent() === null so the next
 *      getCurrentSession() bridge call returns null and the route guard
 *      redirects to /sign-in.
 *   4. The cascade is "durable across application restart" in the sense
 *      that once end() is called the session is gone; a restart finds no
 *      session in memory (the SQL row, once T065 lands, will carry the
 *      end_cause persistently).
 *
 * The terminal remains paired (only the operator account is disabled,
 * not the device token). Asserting the cascade does NOT clear pairing
 * state is out of scope for this test (PairingStore is not injected).
 */

function makeFakeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

function makeFilledManager(): SessionManager {
  const sm = new SessionManager();
  sm.create({
    operator_id: 'op-2',
    display_name: 'Cashier',
    role: 'cashier',
    tenant_id: 't1',
    branch_id: 'b1',
    backend_session_id: 'be-2',
    started_at: '2026-05-07T00:00:00.000Z',
  });
  return sm;
}

describe('LifecycleCascade.notifyAccountDisabled() — T051c (Edge Cases)', () => {
  it('terminates the active session', () => {
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm });

    cascade.notifyAccountDisabled();

    expect(sm.getCurrent()).toBeNull();
  });

  it('records end_cause = account_disabled_mid_session', () => {
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm });

    cascade.notifyAccountDisabled();

    expect(sm.getLastEndCause()).toBe('account_disabled_mid_session');
  });

  it('is a no-op when no session is active (idempotent)', () => {
    const sm = new SessionManager(); // empty
    const cascade = new LifecycleCascade({ sessionManager: sm });

    expect(() => {
      cascade.notifyAccountDisabled();
    }).not.toThrow();
    expect(sm.getCurrent()).toBeNull();
    expect(sm.getLastEndCause()).toBeNull();
  });

  it('emits a diagnostic log with opaque operator_id (FR-032)', () => {
    const logger = makeFakeLogger();
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm, logger });

    cascade.notifyAccountDisabled();

    const infoMock = logger.info as ReturnType<typeof vi.fn>;
    expect(infoMock).toHaveBeenCalledTimes(1);
    const [payload] = infoMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toHaveProperty('event', 'operator.session.account_disabled');
    // Opaque operator id present but no credential fragments.
    expect(payload).toHaveProperty('operator_id');
    expect(JSON.stringify(payload)).not.toContain('be-2'); // no backend session id
  });

  it('does not log when no session is active', () => {
    const logger = makeFakeLogger();
    const sm = new SessionManager();
    const cascade = new LifecycleCascade({ sessionManager: sm, logger });

    cascade.notifyAccountDisabled();

    expect(logger.info as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('getCurrentSession returns null after cascade — renderer gets generic sign-out (NFR-003)', () => {
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm });

    cascade.notifyAccountDisabled();

    // The renderer's next getCurrentSession() call resolves to null.
    // The bridge handler maps null → "not signed in" and the route guard
    // redirects to /sign-in. No hint of "account disabled" crosses the bridge.
    expect(sm.getCurrentBridgeView()).toBeNull();
  });

  it('cascade is durable across simulated restart (no in-memory session after end)', () => {
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm });

    cascade.notifyAccountDisabled();

    // Simulate a fresh manager (new process), which starts with null.
    const freshSm = new SessionManager();
    expect(freshSm.getCurrent()).toBeNull();
    // The original session is also gone from memory.
    expect(sm.getCurrent()).toBeNull();
  });
});
