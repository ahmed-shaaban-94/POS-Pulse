import type { IpcMain } from 'electron';

/**
 * T031 — `ping` IPC handler.
 *
 * Establishes the request/response IPC pattern. Returns the literal `"pong"`
 * after a round-trip through the main process. Used by the bridge-typing test
 * (T029) and the T034 manual smoke gate to prove the bridge surface works
 * end-to-end.
 */
export const PING_CHANNEL = 'app:ping';

export function registerPingHandler(ipcMain: IpcMain): void {
  ipcMain.handle(PING_CHANNEL, () => 'pong' as const);
}
