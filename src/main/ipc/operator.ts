import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import type {
  ManagerAdminSignInRequest,
  OperatorSessionBridgeView,
  SignInResponse,
  SignOutResponse,
} from '../../shared/bridge-api.js';
import { OPERATOR_IPC_CHANNELS } from '../../shared/operator/channels.js';
import type { SignInHandler } from '../operator/sign-in-handler.js';
import type { SignOutHandler } from '../operator/sign-out-handler.js';
import type { SessionManager } from '../operator/session-manager.js';
import type { InactivityMonitor } from '../operator/inactivity-monitor.js';
import { OperatorRefusalError } from '../../shared/audit/event-shape.js';

/**
 * 004-operator-session — `operator:*` IPC handlers (S1 wave 1 surface).
 *
 * Mirrors the pattern from `src/main/ipc/pairing.ts`. Boundary input
 * validation refuses generically (PR-2 / NFR-003) — we never echo the
 * rejected payload into the thrown error message (Constitution VII).
 *
 * Cashier-PIN, takeover-confirm, roster, audit-event-emit, and PIN
 * management channels are §A1-gated and intentionally NOT registered
 * here; their handlers land in S3 / S4 with their slices.
 */

export interface OperatorHandlerDeps {
  signInHandler: SignInHandler;
  signOutHandler: SignOutHandler;
  sessionManager: SessionManager;
  inactivityMonitor: InactivityMonitor;
}

function refuseInvalid(): SignInResponse {
  return { kind: 'refused', category: 'invalid_input' };
}

function asManagerAdminRequest(value: unknown): ManagerAdminSignInRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v['kind'] !== 'manager_admin') return null;
  if (typeof v['identifier'] !== 'string' || typeof v['password'] !== 'string') return null;
  return {
    kind: 'manager_admin',
    identifier: v['identifier'],
    password: v['password'],
  };
}

export function registerOperatorHandlers(ipcMain: IpcMain, deps: OperatorHandlerDeps): void {
  const { signInHandler, signOutHandler, sessionManager, inactivityMonitor } = deps;

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.SIGN_IN,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<SignInResponse> => {
      const req = asManagerAdminRequest(request);
      if (req === null) {
        return refuseInvalid();
      }
      try {
        return await signInHandler.signIn(req);
      } catch (err) {
        // Generic refusal on any unexpected throw. The error MUST NOT
        // surface its message via the bridge (Constitution VII). We
        // never re-throw the underlying error.
        if (err instanceof OperatorRefusalError) {
          return { kind: 'refused', category: err.category };
        }
        return refuseInvalid();
      }
    },
  );

  ipcMain.handle(OPERATOR_IPC_CHANNELS.SIGN_OUT, async (): Promise<SignOutResponse> => {
    return signOutHandler.signOut();
  });

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.GET_CURRENT_SESSION,
    (): OperatorSessionBridgeView | null => {
      return sessionManager.getCurrentBridgeView();
    },
  );

  ipcMain.handle(OPERATOR_IPC_CHANNELS.REPORT_ACTIVITY, (): void => {
    inactivityMonitor.reportActivity();
  });
}
