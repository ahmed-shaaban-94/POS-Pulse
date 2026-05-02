import { app } from 'electron';
import type { IpcMain } from 'electron';

/**
 * T032 — `appVersion` IPC handler.
 *
 * Returns the application version reported by the main process via
 * `app.getVersion()`. Used by the renderer to display version metadata.
 */
export const APP_VERSION_CHANNEL = 'app:version';

export function registerAppVersionHandler(ipcMain: IpcMain): void {
  ipcMain.handle(APP_VERSION_CHANNEL, () => app.getVersion());
}
