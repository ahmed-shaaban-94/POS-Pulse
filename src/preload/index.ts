import { contextBridge, ipcRenderer } from 'electron';
import type { PairingBridgeAPI, PreloadBridgeAPI } from '../shared/bridge-api';
import type { LogRecord } from '../shared/log-record';
import type { AppConfig } from '../shared/app-config';

/**
 * T033 + T061 + T067 — preload bridge wired to ipcRenderer.invoke.
 *
 * Channel names mirror the constants in
 * `src/main/ipc/{ping,app-version,log,app-config}.ts`. Drift between
 * this file and the handler-side channel names surfaces as an
 * unhandled-promise / "no handler for channel" error in DevTools,
 * caught by the manual smoke gate.
 *
 * 002-terminal-pairing T006: the `pairing` namespace is declared at the
 * foundational layer with placeholder methods that reject with a typed
 * Error. Real wiring against PAIRING_IPC_CHANNELS lands in US1
 * (getStatus) and US2 (submit). Rejecting keeps the typed surface honest
 * while preventing accidental use before the handlers exist.
 */
const notImplementedError = (method: string): Error =>
  new Error(`pairing.${method} not implemented yet — wired in 002-terminal-pairing US1/US2.`);

const pairing: PairingBridgeAPI = {
  getStatus: () => Promise.reject(notImplementedError('getStatus')),
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
