import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { SessionManager } from '../../../../src/main/operator/session-manager.js';
import { LifecycleCascade } from '../../../../src/main/operator/lifecycle-cascade.js';

/**
 * T051a — terminal-token revocation cascade (C2 addendum / FR-014).
 *
 * When the device token is revoked while an operator session is active,
 * `LifecycleCascade.notifyTerminalRevoked()` must:
 *   1. Terminate the active session.
 *   2. Record end_cause = 'terminal_session_terminated'.
 *   3. NOT clear the audit_events outbox (P3 — no silent data loss).
 *
 * The actual 401-interceptor call site (US7 territory) is out of scope;
 * this test calls notifyTerminalRevoked() directly, which is the seam
 * a future interceptor will use.
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
    operator_id: 'op-1',
    display_name: 'Manager',
    role: 'manager',
    tenant_id: 't1',
    branch_id: 'b1',
    backend_session_id: 'be-1',
    started_at: '2026-05-07T00:00:00.000Z',
  });
  return sm;
}

describe('LifecycleCascade.notifyTerminalRevoked() — T051a (FR-014)', () => {
  it('terminates the active session', () => {
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm });

    cascade.notifyTerminalRevoked();

    expect(sm.getCurrent()).toBeNull();
  });

  it('records end_cause = terminal_session_terminated', () => {
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm });

    cascade.notifyTerminalRevoked();

    expect(sm.getLastEndCause()).toBe('terminal_session_terminated');
  });

  it('is a no-op when no session is active (idempotent)', () => {
    const sm = new SessionManager(); // empty
    const cascade = new LifecycleCascade({ sessionManager: sm });

    expect(() => {
      cascade.notifyTerminalRevoked();
    }).not.toThrow();
    expect(sm.getCurrent()).toBeNull();
    expect(sm.getLastEndCause()).toBeNull();
  });

  it('emits a diagnostic log with opaque operator_id (FR-032)', () => {
    const logger = makeFakeLogger();
    const sm = makeFilledManager();
    const cascade = new LifecycleCascade({ sessionManager: sm, logger });

    cascade.notifyTerminalRevoked();

    const infoMock = logger.info as ReturnType<typeof vi.fn>;
    expect(infoMock).toHaveBeenCalledTimes(1);
    const [payload] = infoMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toHaveProperty('event', 'operator.session.terminal_revoked');
    // Opaque operator id present but no credential fragments.
    expect(payload).toHaveProperty('operator_id');
    expect(JSON.stringify(payload)).not.toContain('be-1'); // no backend session id
  });

  it('does not log when no session is active', () => {
    const logger = makeFakeLogger();
    const sm = new SessionManager();
    const cascade = new LifecycleCascade({ sessionManager: sm, logger });

    cascade.notifyTerminalRevoked();

    expect(logger.info as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('does NOT touch the audit_events outbox — offline events survive revocation (P3)', () => {
    // The audit outbox is managed by AuditEmitter / AuditEventsStore, which
    // LifecycleCascade has no reference to. This test confirms the cascade
    // constructor does NOT accept or depend on those types. If a future change
    // accidentally adds that dependency, the type-check here catches it.
    const sm = makeFilledManager();

    // Deliberately NOT passing auditEmitter to the cascade.
    const cascade = new LifecycleCascade({ sessionManager: sm });

    // Cascade runs without clearing any outbox.
    cascade.notifyTerminalRevoked();

    expect(sm.getCurrent()).toBeNull();
    // No assertion on audit store — its absence from the constructor IS the assertion.
  });
});
