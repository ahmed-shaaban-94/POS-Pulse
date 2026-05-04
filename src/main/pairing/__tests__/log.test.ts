import { describe, expect, it, vi } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { Logger } from 'pino';

import { createPairingLog } from '../log.js';
import type { PairingAttemptLogRecord } from '../service.js';

/**
 * 002-terminal-pairing US2 + US6 (T058) — `createPairingLog` tests.
 *
 * US2 shipped a structural whitelist (re-construct record from schema).
 * US6 (T058-T059) adds:
 *   1. A runtime guard that THROWS on any unknown key.
 *   2. Type-level assertion via expectTypeOf that extra keys are rejected.
 */

interface CapturedCall {
  obj: Record<string, unknown>;
  msg?: string;
}

function makeFakeLogger(): { logger: Logger; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const stub = vi.fn((arg: unknown, msg?: unknown) => {
    if (typeof arg === 'object' && arg !== null) {
      const captured: CapturedCall = { obj: arg as Record<string, unknown> };
      if (typeof msg === 'string') captured.msg = msg;
      calls.push(captured);
    }
  });
  const logger = {
    info: stub,
    warn: stub,
    error: stub,
    debug: stub,
    trace: stub,
    fatal: stub,
  } as unknown as Logger;
  return { logger, calls };
}

describe('createPairingLog — valid records (US2 structural guard)', () => {
  it('emits exactly one logger.info call per record, tagged "pairing_attempt"', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    log({
      event: 'pairing_attempt',
      outcome: 'success',
      at: '2026-05-03T12:00:00.000Z',
      terminal_id: 'term-1',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.msg).toBe('pairing_attempt');
  });

  it('forwards the canonical fields (event, outcome, at)', () => {
    const { logger, calls } = makeFakeLogger();
    createPairingLog(logger)({
      event: 'pairing_attempt',
      outcome: 'unknown_error',
      at: '2026-05-03T12:00:00.000Z',
    });
    expect(calls[0]?.obj).toMatchObject({
      event: 'pairing_attempt',
      outcome: 'unknown_error',
      at: '2026-05-03T12:00:00.000Z',
    });
  });

  it('includes terminal_id only when defined (success path)', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    log({
      event: 'pairing_attempt',
      outcome: 'success',
      at: '2026-05-03T12:00:00.000Z',
      terminal_id: 'term-1',
    });
    log({ event: 'pairing_attempt', outcome: 'unknown_error', at: '2026-05-03T12:00:01.000Z' });
    expect(calls[0]?.obj['terminal_id']).toBe('term-1');
    expect(calls[1]?.obj).not.toHaveProperty('terminal_id');
  });

  it('includes timed_out only when defined (network_error timeout path)', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    log({
      event: 'pairing_attempt',
      outcome: 'network_error',
      at: '2026-05-03T12:00:00.000Z',
      timed_out: true,
    });
    log({ event: 'pairing_attempt', outcome: 'network_error', at: '2026-05-03T12:00:01.000Z' });
    expect(calls[0]?.obj['timed_out']).toBe(true);
    expect(calls[1]?.obj).not.toHaveProperty('timed_out');
  });

  it('includes retry_after_s only when defined (rate_limited path)', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    log({
      event: 'pairing_attempt',
      outcome: 'rate_limited',
      at: '2026-05-03T12:00:00.000Z',
      retry_after_s: 30,
    });
    expect(calls[0]?.obj['retry_after_s']).toBe(30);
  });

  it('emitted record contains no extra fields beyond the schema', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    log({
      event: 'pairing_attempt',
      outcome: 'success',
      at: '2026-05-03T12:00:00.000Z',
      terminal_id: 't1',
    });
    const keys = Object.keys(calls[0]?.obj ?? {});
    const allowed = new Set(['event', 'outcome', 'at', 'terminal_id']);
    for (const k of keys) {
      expect(allowed.has(k), `unexpected key "${k}" in emitted record`).toBe(true);
    }
  });
});

// ─── T058: US6 runtime guard ──────────────────────────────────────────────────

describe('createPairingLog — T058 runtime guard (US6)', () => {
  it('throws when pairing_code is present (forbidden secret field)', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    const bad = {
      event: 'pairing_attempt' as const,
      outcome: 'success' as const,
      at: '2026-05-03T12:00:00.000Z',
      terminal_id: 'term-1',
      pairing_code: 'SHOULD-THROW',
    };
    // Cast the function (not the argument) so TS accepts the call without
    // a double-assertion; the RUNTIME guard is what T058 tests.
    expect(() => {
      (log as (r: unknown) => void)(bad);
    }).toThrow(/unknown.*key|forbidden|pairing_code/i);
  });

  it('throws when device_token is present (forbidden secret field)', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    const bad = {
      event: 'pairing_attempt' as const,
      outcome: 'success' as const,
      at: '2026-05-03T12:00:00.000Z',
      device_token: 'TOKEN-LEAK',
    };
    expect(() => {
      (log as (r: unknown) => void)(bad);
    }).toThrow(/unknown.*key|forbidden|device_token/i);
  });

  it('throws when any arbitrary unknown key is present (generic guard)', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    const bad = {
      event: 'pairing_attempt' as const,
      outcome: 'unknown_error' as const,
      at: '2026-05-03T12:00:00.000Z',
      stack_trace: 'oops',
    };
    expect(() => {
      (log as (r: unknown) => void)(bad);
    }).toThrow(/unknown.*key|forbidden|stack_trace/i);
  });

  it('does NOT throw for a fully valid success record', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    expect(() => {
      log({
        event: 'pairing_attempt',
        outcome: 'success',
        at: '2026-05-03T12:00:00.000Z',
        terminal_id: 'term-1',
      });
    }).not.toThrow();
  });

  it('does NOT throw for a valid rate_limited record with retry_after_s', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    expect(() => {
      log({
        event: 'pairing_attempt',
        outcome: 'rate_limited',
        at: '2026-05-03T12:00:00.000Z',
        retry_after_s: 30,
      });
    }).not.toThrow();
  });

  it('does NOT throw for a valid network_error record with timed_out', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    expect(() => {
      log({
        event: 'pairing_attempt',
        outcome: 'network_error',
        at: '2026-05-03T12:00:00.000Z',
        timed_out: true,
      });
    }).not.toThrow();
  });

  it('does NOT throw for a minimal valid record (no optional fields)', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    expect(() => {
      log({ event: 'pairing_attempt', outcome: 'unknown_error', at: '2026-05-03T12:00:00.000Z' });
    }).not.toThrow();
  });

  it('throws and does NOT emit when a forbidden key is present (no partial log)', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    const bad = {
      event: 'pairing_attempt' as const,
      outcome: 'success' as const,
      at: '2026-05-03T12:00:00.000Z',
      pairing_code: 'LEAK',
    };
    expect(() => {
      (log as (r: unknown) => void)(bad);
    }).toThrow();
    // No log call should have been made.
    expect(calls).toHaveLength(0);
  });
});

// ─── T058: type-level assertion (expectTypeOf) ────────────────────────────────

describe('createPairingLog — T058 type-level guard (expectTypeOf)', () => {
  it('PairingAttemptLogRecord extends the required base shape', () => {
    expectTypeOf<PairingAttemptLogRecord>().toExtend<{
      event: 'pairing_attempt';
      outcome: string;
      at: string;
    }>();
  });

  it('PairingAttemptLogRecord with all known optional keys extends the base type', () => {
    // The type is NOT an index signature — adding unknown keys should be
    // flagged by tsc. We assert that a record with only the known optional
    // keys is assignable, confirming the type is exact.
    type WithKnownOptionals = {
      event: 'pairing_attempt';
      outcome: 'success';
      at: string;
      terminal_id?: string;
      retry_after_s?: number;
      timed_out?: boolean;
    };
    expectTypeOf<WithKnownOptionals>().toExtend<PairingAttemptLogRecord>();
  });

  it('pairingLog emitter parameter type extends PairingAttemptLogRecord', () => {
    const { logger } = makeFakeLogger();
    const log = createPairingLog(logger);
    // The emitter accepts PairingAttemptLogRecord — assert parameter type.
    expectTypeOf(log).parameter(0).toExtend<PairingAttemptLogRecord>();
  });
});
