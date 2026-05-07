import type { Logger } from 'pino';

import type { SessionManager } from './session-manager.js';

/**
 * 004-operator-session T051b + T051d — lifecycle cascade handlers.
 *
 * Two termination paths that originate outside the operator's own action:
 *
 *   notifyTerminalRevoked()  — FR-014 / Edge Case "Terminal token revoked
 *     while operator signed in". Called by the future 401-interceptor (US7)
 *     when 002's device token is revoked. Ends the session with
 *     end_cause = 'terminal_session_terminated'. The shell then returns to
 *     002's pre-pairing surface (NOT /sign-in; the terminal is no longer
 *     paired). This module does NOT clear pairing state — 002 owns that.
 *
 *   notifyAccountDisabled()  — Edge Case "Operator account disabled mid-
 *     session". Called by any privileged bridge handler that receives a
 *     generic 401/disabled-account response. Ends the session with
 *     end_cause = 'account_disabled_mid_session'. The shell returns to
 *     /sign-in (the terminal IS still paired).
 *
 * Neither path emits a sensitive-action audit event (FR-014 governs
 * session termination, not action attribution). A low-severity diagnostic
 * pino log is written with the opaque operator_id per FR-032. The
 * `operator_sessions` row is the durable record.
 *
 * The cascade does NOT depend on AuditEmitter — offline-queued audit
 * events survive both cascades intact (P3 / no silent data loss).
 */

export interface LifecycleCascadeDeps {
  sessionManager: SessionManager;
  logger?: Logger;
}

export class LifecycleCascade {
  constructor(private readonly deps: LifecycleCascadeDeps) {}

  /**
   * T051b — device-token revocation cascade (FR-014).
   * Idempotent: no-op when no session is active.
   */
  notifyTerminalRevoked(): void {
    const { sessionManager, logger } = this.deps;
    const current = sessionManager.getCurrent();
    if (current === null) return;

    const operatorId = current.operator_id;
    sessionManager.end('terminal_session_terminated');

    logger?.info(
      { event: 'operator.session.terminal_revoked', operator_id: operatorId },
      'session ended — terminal token revoked',
    );
  }

  /**
   * T051d — operator-account-disabled cascade.
   * Idempotent: no-op when no session is active.
   */
  notifyAccountDisabled(): void {
    const { sessionManager, logger } = this.deps;
    const current = sessionManager.getCurrent();
    if (current === null) return;

    const operatorId = current.operator_id;
    sessionManager.end('account_disabled_mid_session');

    logger?.info(
      { event: 'operator.session.account_disabled', operator_id: operatorId },
      'session ended — operator account disabled',
    );
  }
}
