import { contextBridge, ipcRenderer } from 'electron';
import type { PairingBridgeAPI, PreloadBridgeAPI } from '../shared/bridge-api';
import type { LogRecord } from '../shared/log-record';
import type { AppConfig } from '../shared/app-config';
import {
  PAIRING_IPC_CHANNELS,
  type PairingStatus,
  type PairingSubmitResult,
} from '../shared/pairing-types';

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

const api: PreloadBridgeAPI = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<'pong'>,
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  log: (record: LogRecord) => ipcRenderer.invoke('app:log', record) as Promise<void>,
  appConfig: () => ipcRenderer.invoke('app:config') as Promise<AppConfig>,
  pairing,
};

contextBridge.exposeInMainWorld('api', api);
