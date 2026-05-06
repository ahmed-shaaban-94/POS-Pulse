import type { Logger } from 'pino';

import type { SignOutResponse } from '../../shared/bridge-api.js';

import type { BackendClient } from './backend-client.js';
import type { SessionManager } from './session-manager.js';

/**
 * 004-operator-session T027 — sign-out handler.
 *
 * Best-effort backend call; the local session is torn down within 1 s
 * regardless of backend reachability (FR-008 / NFR-007). The backend
 * call timeout is short and its outcome is intentionally swallowed —
 * the client cannot leave the operator on the shell because
 * Data-Pulse-2 is unreachable.
 */

const BACKEND_TIMEOUT_MS = 750;

export interface SignOutHandlerDeps {
  backend: BackendClient;
  sessionManager: SessionManager;
  /** Held JWT for the active session; production wires from a holder. */
  jwtFor: (backendSessionId: string) => string | null;
  /**
   * Clear the JWT for the ended session id. Production wires
   * `jwtHolder.clear`; tests may omit. Called immediately after
   * local tear-down so the JWT is no longer held in main-process
   * memory regardless of the backend POST outcome.
   */
  clearJwt?: (backendSessionId: string) => void;
  logger?: Logger;
}

export class SignOutHandler {
  constructor(private readonly deps: SignOutHandlerDeps) {}

  signOut(): Promise<SignOutResponse> {
    const current = this.deps.sessionManager.getCurrent();
    if (current === null) {
      // Idempotent no-op (client may double-tap sign-out).
      this.deps.logger?.info({ event: 'operator.sign_out.noop' }, 'sign-out no-op');
      return Promise.resolve({ kind: 'signed_out' });
    }

    const backendSessionId = current.backend_session_id;
    const jwt = this.deps.jwtFor(backendSessionId);

    // Tear down LOCAL state first — the local sign-out MUST return
    // within 1 s regardless of backend reachability (NFR-007). The
    // backend call below is fire-and-forget with a short timeout.
    this.deps.sessionManager.end();
    this.deps.clearJwt?.(backendSessionId);

    if (jwt !== null) {
      void this.fireBackendSignOut(backendSessionId, jwt);
    }

    this.deps.logger?.info({ event: 'operator.sign_out.local_done' }, 'sign-out local done');
    return Promise.resolve({ kind: 'signed_out' });
  }

  private async fireBackendSignOut(sessionId: string, jwt: string): Promise<void> {
    try {
      const result = await Promise.race([
        this.deps.backend.signOut({ session_id: sessionId }, jwt),
        new Promise<{ kind: 'no_connection' }>((resolve) =>
          setTimeout(() => {
            resolve({ kind: 'no_connection' });
          }, BACKEND_TIMEOUT_MS),
        ),
      ]);
      this.deps.logger?.info(
        { event: 'operator.sign_out.backend_outcome', kind: result.kind },
        'sign-out backend outcome',
      );
    } catch {
      // Best-effort. The local state has already been cleared.
      this.deps.logger?.info(
        { event: 'operator.sign_out.backend_threw' },
        'sign-out backend threw',
      );
    }
  }
}
