import { contextBridge } from 'electron';
import type { PreloadBridgeAPI } from '../shared/bridge-api';

// Phase 2 stub — methods are wired via IPC handlers in US1 (Phase 3).
const api: PreloadBridgeAPI = {
  ping: () => Promise.resolve('pong' as const),
  appVersion: () => Promise.resolve(''),
};

contextBridge.exposeInMainWorld('api', api);
