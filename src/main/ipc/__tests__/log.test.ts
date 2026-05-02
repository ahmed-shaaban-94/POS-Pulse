import { describe, it, expect, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { LOG_CHANNEL, registerLogHandler, type RendererLoggerLike } from '../log.js';
import type { LogRecord } from '../../../shared/log-record.js';

/**
 * Phase 8 / US6 — IPC handler test (R1).
 *
 * Mirrors src/main/ipc/__tests__/ping.test.ts: pass a fake IpcMain,
 * capture the registered handler, assert routing and defensive
 * validation. No real Electron, no real pino instance.
 */

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface CapturedCall {
  level: string;
  fields: Record<string, unknown> | undefined;
  msg: string;
}

function makeFakeRendererLogger(): { logger: RendererLoggerLike; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const captureFn = (level: string) => (fields: Record<string, unknown>, msg: string) => {
    calls.push({ level, fields, msg });
  };
  const logger: RendererLoggerLike = {
    trace: captureFn('trace'),
    debug: captureFn('debug'),
    info: captureFn('info'),
    warn: captureFn('warn'),
    error: captureFn('error'),
    fatal: captureFn('fatal'),
  };
  return { logger, calls };
}

describe('registerLogHandler', () => {
  it('registers exactly one handler on the app:log channel', () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const { logger } = makeFakeRendererLogger();

    registerLogHandler(ipcMain, logger);

    expect(LOG_CHANNEL).toBe('app:log');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(LOG_CHANNEL, expect.any(Function));
  });

  it('routes a known level to the matching renderer logger method', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const { logger, calls } = makeFakeRendererLogger();

    registerLogHandler(ipcMain, logger);
    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('log handler was not registered');

    const record: LogRecord = {
      level: 'info',
      msg: 'renderer:ready',
      fields: { stage: 'mount' },
    };
    await captured({} as IpcMainInvokeEvent, record);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ level: 'info', fields: { stage: 'mount' }, msg: 'renderer:ready' });
  });

  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const)(
    'routes level=%s correctly',
    async (level) => {
      const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
      const ipcMain = { handle } as unknown as IpcMain;
      const { logger, calls } = makeFakeRendererLogger();

      registerLogHandler(ipcMain, logger);
      const captured = handle.mock.calls[0]?.[1];
      if (!captured) throw new Error('log handler was not registered');

      const record: LogRecord = { level, msg: `m:${level}` };
      await captured({} as IpcMainInvokeEvent, record);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.level).toBe(level);
    },
  );

  it('rejects an unknown level defensively (does NOT throw, does NOT log)', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const { logger, calls } = makeFakeRendererLogger();

    registerLogHandler(ipcMain, logger);
    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('log handler was not registered');

    // Forge a malformed record with an invalid `level` value. The handler
    // must not throw, and must not invoke any renderer logger method —
    // logging must never crash the app, but we also don't trust forged
    // input enough to route it.
    const forged = { level: 'silent', msg: 'oops' } as unknown as LogRecord;
    await expect(captured({} as IpcMainInvokeEvent, forged)).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('does not crash on a malformed record (missing fields)', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const { logger, calls } = makeFakeRendererLogger();

    registerLogHandler(ipcMain, logger);
    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('log handler was not registered');

    // Caller forgot `msg` (or it's not a string).
    const malformed = { level: 'info' } as unknown as LogRecord;
    await expect(captured({} as IpcMainInvokeEvent, malformed)).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('does not crash on a non-object payload', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const { logger, calls } = makeFakeRendererLogger();

    registerLogHandler(ipcMain, logger);
    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('log handler was not registered');

    await expect(captured({} as IpcMainInvokeEvent, null)).resolves.toBeUndefined();
    await expect(captured({} as IpcMainInvokeEvent, 'a string')).resolves.toBeUndefined();
    await expect(captured({} as IpcMainInvokeEvent, 42)).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('passes optional fields through; absent fields become an empty bindings object', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const { logger, calls } = makeFakeRendererLogger();

    registerLogHandler(ipcMain, logger);
    const captured = handle.mock.calls[0]?.[1];
    if (!captured) throw new Error('log handler was not registered');

    const record: LogRecord = { level: 'info', msg: 'no-fields' };
    await captured({} as IpcMainInvokeEvent, record);
    expect(calls[0]?.fields).toEqual({});
  });
});
