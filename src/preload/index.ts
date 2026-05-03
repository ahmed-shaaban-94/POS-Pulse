import { contextBridge, ipcRenderer } from 'electron';
import type { PairingBridgeAPI, PreloadBridgeAPI } from '../shared/bridge-api';
import type { LogRecord } from '../shared/log-record';
import type { AppConfig } from '../shared/app-config';
import { PAIRING_IPC_CHANNELS, type PairingStatus } from '../shared/pairing-types';

/**
 * T033 + T061 + T067 — preload bridge wired to ipcRenderer.invoke.
 *
 * Channel names mirror the constants in
 * `src/main/ipc/{ping,app-version,log,app-config}.ts`. Drift between
 * this file and the handler-side channel names surfaces as an
 * unhandled-promise / "no handler for channel" error in DevTools,
 * caught by the manual smoke gate.
 *
 * 002-terminal-pairing US1 (T014): `pairing.getStatus()` is wired to
 * `ipcRenderer.invoke(PAIRING_IPC_CHANNELS.GET_STATUS)`. The
 * `pairing.submit` method REMAINS a "not implemented" placeholder until
 * US2 (T026) lands the matching IPC handler — the typed surface stays
 * honest while preventing accidental use before the handler exists.
 */
const notImplementedError = (method: string): Error =>
  new Error(`pairing.${method} not implemented yet — wired in 002-terminal-pairing US2.`);

const pairing: PairingBridgeAPI = {
  getStatus: () => ipcRenderer.invoke(PAIRING_IPC_CHANNELS.GET_STATUS) as Promise<PairingStatus>,
  submit: () => Promise.reject(notImplementedError('submit')),
};

const api: PreloadBridgeAPI = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<'pong'>,
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  log: (record: LogRecord) => ipcRenderer.invoke('app:log', record) as Promise<void>,
  appConfig: () => ipcRenderer.invoke('app:config') as Promise<AppConfig>,
  pairing,
};

contextBridge.exposeInMainWorld('api', api);
