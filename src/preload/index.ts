import { contextBridge, ipcRenderer } from 'electron';
import type { PreloadBridgeAPI } from '../shared/bridge-api';
import type { LogRecord } from '../shared/log-record';

/**
 * T033 + T061 — preload bridge wired to ipcRenderer.invoke.
 *
 * Channel names mirror the constants in
 * `src/main/ipc/{ping,app-version,log}.ts`. Drift between this file and
 * the handler-side channel names surfaces as an unhandled-promise /
 * "no handler for channel" error in DevTools, caught by the manual
 * smoke gate.
 */
const api: PreloadBridgeAPI = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<'pong'>,
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  log: (record: LogRecord) => ipcRenderer.invoke('app:log', record) as Promise<void>,
};

contextBridge.exposeInMainWorld('api', api);
