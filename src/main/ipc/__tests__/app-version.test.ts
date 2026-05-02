import { describe, it, expect, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

vi.mock('electron', () => ({
  app: { getVersion: (): string => '0.1.0-test' },
}));

import { APP_VERSION_CHANNEL, registerAppVersionHandler } from '../app-version.js';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/**
 * T030 (D1 extension) — failing IPC unit test for the `appVersion` handler.
 *
 * `app.getVersion()` is mocked at the module boundary so the test does not
 * need a real Electron runtime.
 */
describe('registerAppVersionHandler', () => {
  it('registers exactly one handler on the app:version channel', () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;

    registerAppVersionHandler(ipcMain);

    expect(APP_VERSION_CHANNEL).toBe('app:version');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(APP_VERSION_CHANNEL, expect.any(Function));
  });

  it('the registered handler returns app.getVersion()', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;

    registerAppVersionHandler(ipcMain);

    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('app-version handler was not registered');

    const result = await captured({} as IpcMainInvokeEvent);
    expect(result).toBe('0.1.0-test');
  });
});
