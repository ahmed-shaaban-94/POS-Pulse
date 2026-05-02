import { contextBridge, ipcRenderer } from 'electron';
import type { PreloadBridgeAPI } from '../shared/bridge-api';

/**
 * T033 — preload bridge wired to ipcRenderer.invoke.
 *
 * Channel names mirror the constants in `src/main/ipc/{ping,app-version}.ts`.
 * Drift between this file and the handler-side channel names will surface as
 * an unhandled-promise / "no handler for channel" error in DevTools, caught
 * by the T034 manual smoke gate.
 */
const api: PreloadBridgeAPI = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<'pong'>,
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
};

contextBridge.exposeInMainWorld('api', api);
