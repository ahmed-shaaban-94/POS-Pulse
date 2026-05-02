import { describe, it, expect, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { PING_CHANNEL, registerPingHandler } from '../ping.js';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/**
 * T030 — failing IPC unit test for the `ping` handler.
 *
 * Tests are runtime-mocked: we pass a fake IpcMain, capture the registered
 * handler function, and assert behavior. No real Electron runtime needed.
 */
describe('registerPingHandler', () => {
  it('registers exactly one handler on the app:ping channel', () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;

    registerPingHandler(ipcMain);

    expect(PING_CHANNEL).toBe('app:ping');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(PING_CHANNEL, expect.any(Function));
  });

  it('the registered handler returns "pong"', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;

    registerPingHandler(ipcMain);

    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('ping handler was not registered');

    const result = await captured({} as IpcMainInvokeEvent);
    expect(result).toBe('pong');
  });
});
