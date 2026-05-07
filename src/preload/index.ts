import { contextBridge, ipcRenderer } from 'electron';
import type {
  EmitAuditEventRequest,
  EmitAuditEventResponse,
  OperatorBridgeAPI,
  OperatorSessionBridgeView,
  PairingBridgeAPI,
  PreloadBridgeAPI,
  SignInRequest,
  SignInResponse,
  SignOutResponse,
} from '../shared/bridge-api';
import type { OperatorRefusal } from '../shared/audit/event-shape';
import type { LogRecord } from '../shared/log-record';
import type { AppConfig } from '../shared/app-config';
import {
  PAIRING_IPC_CHANNELS,
  type PairingStatus,
  type PairingSubmitResult,
} from '../shared/pairing-types';
import { OPERATOR_IPC_CHANNELS } from '../shared/operator/channels';

/**
 * T033 + T061 + T067 — preload bridge wired to ipcRenderer.invoke.
 *
 * Channel names mirror the constants in
 * `src/main/ipc/{ping,app-version,log,app-config}.ts`. Drift between
 * this file and the handler-side channel names surfaces as an
 * unhandled-promise / "no handler for channel" error in DevTools,
 * caught by the manual smoke gate.
 *
 * 002-terminal-pairing US1 (T014): `pairing.getStatus()` wired to
 * `ipcRenderer.invoke(PAIRING_IPC_CHANNELS.GET_STATUS)`.
 * 002-terminal-pairing US2 (T026): `pairing.submit()` wired to
 * `ipcRenderer.invoke(PAIRING_IPC_CHANNELS.SUBMIT, code)`. The
 * placeholder rejection from PR #16 is gone; the main-side handler
 * (T025) validates the argument shape and forwards the result of the
 * `PairingService.submit` orchestrator (PR #17). The result is a
 * typed `PairingSubmitResult` whose success branch omits
 * `device_token` by design — the renderer never sees the token.
 */
const pairing: PairingBridgeAPI = {
  getStatus: () => ipcRenderer.invoke(PAIRING_IPC_CHANNELS.GET_STATUS) as Promise<PairingStatus>,
  submit: (pairing_code: string) =>
    ipcRenderer.invoke(PAIRING_IPC_CHANNELS.SUBMIT, pairing_code) as Promise<PairingSubmitResult>,
};

/**
 * 004-operator-session T014/T029 + F-01 — `operator.*` namespace exposed
 * by preload. S1 wires sign-in (manager/admin only), sign-out, and
 * getCurrentSession. F-01 (s1-review) wires `_reportActivity` so the
 * renderer can report genuine user input to the inactivity monitor
 * (T028b / FR-009).
 *
 * The bridge handler validates input shapes; the preload layer is a
 * thin wire-up matching the established 002 pattern.
 */
const operator: OperatorBridgeAPI = {
  signIn: (req: SignInRequest) =>
    ipcRenderer.invoke(OPERATOR_IPC_CHANNELS.SIGN_IN, req) as Promise<SignInResponse>,
  signOut: () => ipcRenderer.invoke(OPERATOR_IPC_CHANNELS.SIGN_OUT) as Promise<SignOutResponse>,
  getCurrentSession: () =>
    ipcRenderer.invoke(
      OPERATOR_IPC_CHANNELS.GET_CURRENT_SESSION,
    ) as Promise<OperatorSessionBridgeView | null>,
  _reportActivity: () => void ipcRenderer.invoke(OPERATOR_IPC_CHANNELS.REPORT_ACTIVITY),
  emitAuditEvent: (req: EmitAuditEventRequest) =>
    ipcRenderer.invoke(OPERATOR_IPC_CHANNELS.EMIT_AUDIT_EVENT, req) as Promise<
      EmitAuditEventResponse | OperatorRefusal
    >,
};

const api: PreloadBridgeAPI = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<'pong'>,
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  log: (record: LogRecord) => ipcRenderer.invoke('app:log', record) as Promise<void>,
  appConfig: () => ipcRenderer.invoke('app:config') as Promise<AppConfig>,
  pairing,
  operator,
};

contextBridge.exposeInMainWorld('api', api);
