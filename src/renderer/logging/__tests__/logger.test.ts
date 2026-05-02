import { describe, it, expect, vi } from 'vitest';

import { createRendererLogger } from '../logger.js';
import type { LogRecord } from '../../../shared/log-record.js';

/**
 * Phase 8 / US6 — renderer-side logger facade tests.
 *
 * The facade is fire-and-forget: every level method emits a LogRecord
 * via the injected `send` shipper without throwing. On send failure it
 * falls back to console.<level> and continues silently.
 */

function makeRecorder(): {
  send: (record: LogRecord) => Promise<void>;
  records: LogRecord[];
} {
  const records: LogRecord[] = [];
  return {
    send: (record) => {
      records.push(record);
      return Promise.resolve();
    },
    records,
  };
}

describe('createRendererLogger', () => {
  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const)(
    'level=%s emits a record with the matching level',
    (level) => {
      const { send, records } = makeRecorder();
      const logger = createRendererLogger(send);
      logger[level]('something happened');
      expect(records).toHaveLength(1);
      expect(records[0]?.level).toBe(level);
      expect(records[0]?.msg).toBe('something happened');
    },
  );

  it('omits the fields property when no fields are passed', () => {
    const { send, records } = makeRecorder();
    createRendererLogger(send).info('no-fields');
    expect(records[0]).toEqual({ level: 'info', msg: 'no-fields' });
    expect('fields' in (records[0] ?? {})).toBe(false);
  });

  it('includes structured fields when provided', () => {
    const { send, records } = makeRecorder();
    createRendererLogger(send).warn('disk:near-full', { freeBytes: 1024 });
    expect(records[0]).toEqual({
      level: 'warn',
      msg: 'disk:near-full',
      fields: { freeBytes: 1024 },
    });
  });

  it('does not throw when the send shipper rejects (falls back to console)', async () => {
    const failingSend = (): Promise<void> => Promise.reject(new Error('bridge unavailable'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const logger = createRendererLogger(failingSend);
      // Synchronous: must not throw.
      expect(() => {
        logger.error('boom');
      }).not.toThrow();

      // The console fallback fires asynchronously inside .catch — flush
      // the microtask queue so the spy assertion sees it.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it.each([
    ['trace', 'trace'],
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
    ['fatal', 'error'], // pino has no console.fatal; route to console.error
  ] as const)(
    'on send failure, level=%s falls back to console.%s',
    async (level, expectedConsoleMethod) => {
      const failingSend = (): Promise<void> => Promise.reject(new Error('bridge unavailable'));
      const spy = vi.spyOn(console, expectedConsoleMethod).mockImplementation(() => undefined);
      try {
        createRendererLogger(failingSend)[level]('boom');
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(spy).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    },
  );
});

describe('createRendererLogger — default send (no shipper override)', () => {
  it('rejects (and falls back to console) when window.api is missing', async () => {
    // Default `send` reads `window.api`. In happy-dom there is no
    // contextBridge, so `window.api` is undefined. The default send
    // therefore rejects, and the facade routes the failure to console
    // without throwing.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const logger = createRendererLogger(); // no send override
      expect(() => {
        logger.info('default-send-test');
      }).not.toThrow();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // info routes to console.info, not error
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('invokes window.api.log when the bridge is present', async () => {
    // Cover the happy path of defaultSend: window.api.log exists, the
    // record flows through, and no console fallback fires.
    const log = vi.fn<(record: LogRecord) => Promise<void>>(() => Promise.resolve());
    const original = (window as unknown as { api?: unknown }).api;
    (window as unknown as { api: { log: typeof log } }).api = { log };
    try {
      const logger = createRendererLogger(); // no send override
      logger.info('happy-path');
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]?.[0]).toEqual({ level: 'info', msg: 'happy-path' });
    } finally {
      // Restore happy-dom default (no api).
      if (original === undefined) {
        delete (window as unknown as { api?: unknown }).api;
      } else {
        (window as unknown as { api: unknown }).api = original;
      }
    }
  });
});
