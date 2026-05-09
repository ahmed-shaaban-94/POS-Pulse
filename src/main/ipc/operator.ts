import { randomUUID } from 'node:crypto';

import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import type {
  CancelTakeoverRequest,
  CancelTakeoverResponse,
  CashierSignInRequest,
  ConfirmTakeoverRequest,
  ConfirmTakeoverResponse,
  EmitAuditEventRequest,
  EmitAuditEventResponse,
  ListBranchRosterResponse,
  ManagerAdminSignInRequest,
  OperatorSessionBridgeView,
  SignInResponse,
  SignOutResponse,
} from '../../shared/bridge-api.js';
import { OPERATOR_IPC_CHANNELS } from '../../shared/operator/channels.js';
import type { CashierSignInHandler, SignInHandler } from '../operator/sign-in-handler.js';
import type { SignOutHandler } from '../operator/sign-out-handler.js';
import type { RosterHandler } from '../operator/roster-handler.js';
import type { SessionManager } from '../operator/session-manager.js';
import type { InactivityMonitor } from '../operator/inactivity-monitor.js';
import type { PairingStore } from '../pairing/store.js';
import {
  OperatorRefusalError,
  type OperatorRefusal,
  type ActionCategory,
} from '../../shared/audit/event-shape.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import type { TakeoverHandler } from '../operator/takeover-handler.js';

/**
 * 004-operator-session — `operator:*` IPC handlers (S1 wave 1 + T048).
 *
 * Mirrors the pattern from `src/main/ipc/pairing.ts`. Boundary input
 * validation refuses generically (PR-2 / NFR-003) — we never echo the
 * rejected payload into the thrown error message (Constitution VII).
 */

export interface OperatorHandlerDeps {
  signInHandler: SignInHandler;
  /** S4 / T075 — cashier PIN sign-in handler. */
  cashierSignInHandler: CashierSignInHandler;
  signOutHandler: SignOutHandler;
  /** T070b — branch roster handler. */
  rosterHandler: RosterHandler;
  sessionManager: SessionManager;
  inactivityMonitor: InactivityMonitor;
  /** T048 — audit-event emission. */
  auditEmitter: AuditEmitter;
  /** T048 — source of originating_terminal_id (trusted enrichment). */
  pairingStore: PairingStore;
  /** T070 / T071 — takeover confirm and cancel handler. */
  takeoverHandler: TakeoverHandler;
}

function refuseInvalid(): OperatorRefusal {
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

function asCashierRequest(value: unknown): CashierSignInRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v['kind'] !== 'cashier') return null;
  if (
    typeof v['cashier_clerk_user_id'] !== 'string' ||
    v['cashier_clerk_user_id'].length === 0 ||
    typeof v['pin'] !== 'string' ||
    v['pin'].length === 0 ||
    typeof v['display_name'] !== 'string'
  )
    return null;
  return {
    kind: 'cashier',
    cashier_clerk_user_id: v['cashier_clerk_user_id'],
    pin: v['pin'],
    display_name: v['display_name'],
  };
}

function asEmitAuditEventRequest(value: unknown): EmitAuditEventRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['event_id'] !== 'string') return null;
  if (typeof v['action_category'] !== 'string') return null;
  if (typeof v['payload'] !== 'object' || v['payload'] === null || Array.isArray(v['payload'])) {
    return null;
  }
  const req: EmitAuditEventRequest = {
    event_id: v['event_id'],
    action_category: v['action_category'],
    payload: v['payload'] as Record<string, unknown>,
  };
  if (typeof v['shift_id'] === 'string') req.shift_id = v['shift_id'];
  if (typeof v['approving_supervisor_id'] === 'string') {
    req.approving_supervisor_id = v['approving_supervisor_id'];
  }
  return req;
}

function asConfirmTakeoverRequest(value: unknown): ConfirmTakeoverRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['pending_takeover_id'] !== 'string' || v['pending_takeover_id'].length === 0) {
    return null;
  }
  return { pending_takeover_id: v['pending_takeover_id'] };
}

function asCancelTakeoverRequest(value: unknown): CancelTakeoverRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['pending_takeover_id'] !== 'string') return null;
  return { pending_takeover_id: v['pending_takeover_id'] };
}

export function registerOperatorHandlers(ipcMain: IpcMain, deps: OperatorHandlerDeps): void {
  const {
    signInHandler,
    cashierSignInHandler,
    signOutHandler,
    rosterHandler,
    sessionManager,
    inactivityMonitor,
    auditEmitter,
    pairingStore,
    takeoverHandler,
  } = deps;

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.SIGN_IN,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<SignInResponse> => {
      try {
        const cashierReq = asCashierRequest(request);
        if (cashierReq !== null) {
          return await cashierSignInHandler.signIn(cashierReq);
        }
        const managerAdminReq = asManagerAdminRequest(request);
        if (managerAdminReq !== null) {
          return await signInHandler.signIn(managerAdminReq);
        }
        return refuseInvalid();
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

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.EMIT_AUDIT_EVENT,
    async (
      _event: IpcMainInvokeEvent,
      request: unknown,
    ): Promise<EmitAuditEventResponse | OperatorRefusal> => {
      // Session gate: acting_operator_id comes from main-process session only.
      const session = sessionManager.getCurrent();
      if (session === null) {
        return { kind: 'refused', category: 'not_signed_in' };
      }

      const req = asEmitAuditEventRequest(request);
      if (req === null) {
        return refuseInvalid();
      }

      // Trusted enrichment: terminal_id comes from pairing state.
      const pairingStatus = await pairingStore.getStatus();
      const originating_terminal_id =
        pairingStatus.kind === 'paired' ? pairingStatus.terminal_id : '';

      try {
        auditEmitter.emit({
          event_id: req.event_id,
          tenant_id: session.tenant_id,
          branch_id: session.branch_id,
          originating_terminal_id,
          acting_operator_id: session.operator_id,
          session_id: session.id,
          shift_id: req.shift_id ?? null,
          action_category: req.action_category as ActionCategory,
          created_at: new Date().toISOString(),
          approving_supervisor_id: req.approving_supervisor_id ?? null,
          payload: req.payload,
        });
        return { kind: 'emitted', event_id: req.event_id };
      } catch {
        // Generic refusal — error message MUST NOT cross the bridge (PR-2 / NFR-003).
        return refuseInvalid();
      }
    },
  );

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.LIST_BRANCH_ROSTER,
    async (): Promise<ListBranchRosterResponse> => {
      // Pre-sign-in roster: sourced from pairing state, not an operator session.
      // The /sign-in route fetches the roster before any operator has signed in;
      // the paired terminal_id provides the branch scope.
      const pairingStatus = await pairingStore.getStatus();
      if (pairingStatus.kind !== 'paired') {
        return refuseInvalid();
      }
      return rosterHandler.listRoster(pairingStatus.branch_id);
    },
  );

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.EMIT_AUDIT_EVENT_SMOKE,
    async (): Promise<EmitAuditEventResponse | OperatorRefusal> => {
      // Production guard: this path is for S3 quickstart smoke only.
      if (process.env['NODE_ENV'] === 'production') {
        return refuseInvalid();
      }

      const session = sessionManager.getCurrent();
      if (session === null) {
        return { kind: 'refused', category: 'not_signed_in' };
      }

      // Manager-tier gate: cashier cannot call this debug path.
      if (session.role === 'cashier') {
        return { kind: 'refused', category: 'role_mismatch' };
      }

      const pairingStatus = await pairingStore.getStatus();
      const originating_terminal_id =
        pairingStatus.kind === 'paired' ? pairingStatus.terminal_id : '';

      const event_id = randomUUID();
      try {
        auditEmitter.emit({
          event_id,
          tenant_id: session.tenant_id,
          branch_id: session.branch_id,
          originating_terminal_id,
          acting_operator_id: session.operator_id,
          session_id: session.id,
          shift_id: null,
          action_category: 'shift.open',
          created_at: new Date().toISOString(),
          approving_supervisor_id: null,
          payload: { smoke: true },
        });
        return { kind: 'emitted', event_id };
      } catch {
        return refuseInvalid();
      }
    },
  );

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.TAKEOVER_CONFIRM,
    async (
      _event: IpcMainInvokeEvent,
      request: unknown,
    ): Promise<ConfirmTakeoverResponse | OperatorRefusal> => {
      const req = asConfirmTakeoverRequest(request);
      if (req === null) return refuseInvalid();
      try {
        return await takeoverHandler.confirmTakeover(req);
      } catch {
        return refuseInvalid();
      }
    },
  );

  ipcMain.handle(
    OPERATOR_IPC_CHANNELS.TAKEOVER_CANCEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<CancelTakeoverResponse> => {
      const req = asCancelTakeoverRequest(request);
      if (req === null) return { kind: 'cancelled' };
      return takeoverHandler.cancelTakeover(req);
    },
  );
}
