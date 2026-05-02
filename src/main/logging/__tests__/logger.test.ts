import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';

import { createLogger, type PinoRollFactory } from '../logger.js';

/**
 * T059 — main-process logger tests.
 *
 * The real `pino-roll` writes daily-rotated files to disk. Tests inject a
 * `PinoRollFactory` that returns an in-memory `PassThrough` stream so we
 * can read records out as JSON-per-line without any fs writes (R9).
 */

const APP_VERSION = '0.1.0-test';

/**
 * Build a fake pinoRollFactory that captures every line written and
 * exposes them via `read()`. Each test gets its own.
 */
function makeCapturingFactory(): { factory: PinoRollFactory; read: () => string[] } {
  const stream = new PassThrough();
  const buf: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => {
    buf.push(chunk);
  });
  // The factory returns the same stream every call (one logger per test).
  const factory: PinoRollFactory = () => Promise.resolve(stream);
  return {
    factory,
    read: () => {
      const text = Buffer.concat(buf).toString('utf8');
      return text.split('\n').filter((l) => l.length > 0);
    },
  };
}

function parseRecord(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

function firstLine(lines: string[]): string {
  if (lines.length === 0) throw new Error('expected at least one log line');
  return lines[0] as string;
}

describe('createLogger', () => {
  it('returns a pino-shaped logger with .info / .warn / .error / .debug / .trace / .fatal', async () => {
    const { factory } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/pos-pulse-fake',
      pinoRollFactory: factory,
    });

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.trace).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('includes process="main" in every record', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.info('app:ready');
    await flush();

    const lines = read();
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const record = parseRecord(firstLine(lines));
    expect(record['process']).toBe('main');
  });

  it('includes process="renderer" when constructed with that tag', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'renderer',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.info('renderer:ready');
    await flush();

    expect(parseRecord(firstLine(read()))['process']).toBe('renderer');
  });

  it('includes app_version in every record', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.info('any');
    await flush();

    expect(parseRecord(firstLine(read()))['app_version']).toBe(APP_VERSION);
  });

  it('includes a `time` field that is ISO-8601 UTC', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.info('any');
    await flush();

    const record = parseRecord(firstLine(read()));
    expect(record['time']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('includes the level and msg fields', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.warn('disk:near-full');
    await flush();

    const record = parseRecord(firstLine(read()));
    // pino emits `level` as a numeric value when not configured otherwise;
    // we configure it as the string label so downstream tooling reads it
    // without translation.
    expect(record['level']).toBe('warn');
    expect(record['msg']).toBe('disk:near-full');
  });

  it('emits valid JSON-per-line for every record (no concatenation issues)', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.info('one');
    logger.info('two');
    logger.info('three');
    await flush();

    const lines = read();
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      // Throws if not parseable
      expect(() => parseRecord(line)).not.toThrow();
    }
  });

  it('merges custom structured fields into the record', async () => {
    const { factory, read } = makeCapturingFactory();
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/tmp/x',
      pinoRollFactory: factory,
    });
    logger.info({ migration: '0001_init', applied_at: '2026-05-02T00:00:00Z' }, 'db:migrated');
    await flush();

    const record = parseRecord(firstLine(read()));
    expect(record['migration']).toBe('0001_init');
    expect(record['applied_at']).toBe('2026-05-02T00:00:00Z');
    expect(record['msg']).toBe('db:migrated');
  });

  it('falls back to a console-backed logger when pinoRollFactory throws (R4)', async () => {
    // Spec edge case (spec.md:130): "Log directory is not writable. The
    // app surfaces the error to console once, falls back to console-only
    // logging, and continues."
    const failingFactory: PinoRollFactory = () =>
      Promise.reject(new Error('EACCES: permission denied'));

    // Should NOT throw — instead returns a degraded logger.
    const logger = await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/var/locked/should-fail',
      pinoRollFactory: failingFactory,
    });

    // The returned logger MUST still be functional — calling .info etc.
    // must not throw, even though no file rotation is happening.
    expect(() => {
      logger.info('after-fallback');
    }).not.toThrow();
    expect(typeof logger.info).toBe('function');
  });

  it('uses the injected logsDir verbatim (no app.getPath in the unit)', async () => {
    // Regression: createLogger MUST NOT import or call electron's `app`
    // directly. The dbPath/logsDir is always injected (mirrors Phase 4's R2).
    const calls: string[] = [];
    const factory: PinoRollFactory = (opts) => {
      calls.push(opts.file);
      return Promise.resolve(new PassThrough());
    };

    await createLogger({
      process: 'main',
      appVersion: APP_VERSION,
      logsDir: '/explicitly/injected',
      pinoRollFactory: factory,
    });

    expect(calls).toHaveLength(1);
    // path.join uses platform separators; check segments individually to
    // stay portable across Windows ('\\') and POSIX ('/').
    expect(calls[0]).toContain('explicitly');
    expect(calls[0]).toContain('injected');
    expect(calls[0]).toContain('main-');
  });
});

/**
 * pino writes asynchronously through SonicBoom; tests need a microtask
 * tick before reading. We use a small queue-microtask-sized await rather
 * than setImmediate so vitest can run with a fake timer if needed later.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
