import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { createPairingLog } from '../log.js';

/**
 * 002-terminal-pairing US2 — `createPairingLog` thin-wrapper tests.
 *
 * The wrapper is the only seam between the pairing service and the
 * pino base logger. US2 ships a structural guard (re-construct the
 * record from a fixed schema); US6 (T058-T059) lands the runtime
 * guard. Tests here pin the structural guard.
 */

interface CapturedCall {
  obj: Record<string, unknown>;
  msg?: string;
}

function makeFakeLogger(): { logger: Logger; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  // Only `info` is exercised by the pairing log; the rest are stubs.
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

describe('createPairingLog', () => {
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

  it('includes retry_after_s only when defined (US5 rate-limit path; not emitted in US2)', () => {
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

  it('does NOT spread arbitrary fields (structural guard)', () => {
    const { logger, calls } = makeFakeLogger();
    const log = createPairingLog(logger);
    // A future caller MIGHT cast a non-record into PairingAttemptLogRecord;
    // the wrapper rebuilds the record from the typed fields ONLY, so
    // anything else is dropped on the floor.
    const malicious = {
      event: 'pairing_attempt' as const,
      outcome: 'success' as const,
      at: '2026-05-03T12:00:00.000Z',
      terminal_id: 'term-1',
      // Unknown / dangerous fields — wrapper drops these.
      pairing_code: 'LEAK-1234',
      device_token: 'TOKEN-LEAK',
      stack_trace: 'something',
    };
    log(malicious);

    const obj = calls[0]?.obj ?? {};
    expect(obj).not.toHaveProperty('pairing_code');
    expect(obj).not.toHaveProperty('device_token');
    expect(obj).not.toHaveProperty('stack_trace');
    // The pino redaction list (PR #15) provides a SECOND layer for the
    // two known-secret keys; this test pins the FIRST layer (the
    // wrapper's whitelist).
  });
});
