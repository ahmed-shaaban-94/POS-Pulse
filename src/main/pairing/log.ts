import type { Logger } from 'pino';

import type { PairingAttemptLogRecord } from './service.js';

/**
 * 002-terminal-pairing US6 (T058-T059) — schema-restricted `pairingLog` emitter.
 *
 * Replaces the US2 thin wrapper with a strict two-layer guard:
 *
 *   Layer 1 (runtime, T059): iterates the actual keys of the incoming
 *     record and throws an Error if any key is not in the allow-list.
 *     This happens BEFORE pino is called, so a forbidden-key record
 *     produces zero log output (no partial emission).
 *
 *   Layer 2 (pino redaction, T009a): the base logger's `redact` option
 *     already scrubs `pairing_code` and `device_token` at any depth.
 *     That layer is belt-and-braces; Layer 1 is the primary defence.
 *
 * Security policy (Constitution VII + spec NFR-4 / FR-9 / FR-10):
 *   - Only fields in ALLOWED_KEYS may appear in the emitted record.
 *   - The function NEVER spreads arbitrary objects into pino.
 *   - Forbidden keys cause an immediate throw, not a silent drop.
 */

const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'event',
  'outcome',
  'at',
  'terminal_id',
  'retry_after_s',
  'timed_out',
]);

export function createPairingLog(logger: Logger): (record: PairingAttemptLogRecord) => void {
  return (record: PairingAttemptLogRecord) => {
    // Runtime guard: reject any key outside the allow-list before
    // touching pino. Throwing guarantees zero log output on a bad call.
    for (const key of Object.keys(record)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new Error(
          `pairingLog: unknown key "${key}" is forbidden in PairingAttemptLogRecord. ` +
            `Allowed keys: ${[...ALLOWED_KEYS].join(', ')}.`,
        );
      }
    }

    // Rebuild from the typed schema — explicit field assignment ensures
    // tsc catches any future schema drift even if the runtime guard were
    // somehow bypassed.
    const safe: PairingAttemptLogRecord = {
      event: record.event,
      outcome: record.outcome,
      at: record.at,
    };
    if (record.terminal_id !== undefined) safe.terminal_id = record.terminal_id;
    if (record.retry_after_s !== undefined) safe.retry_after_s = record.retry_after_s;
    if (record.timed_out !== undefined) safe.timed_out = record.timed_out;

    logger.info(safe, 'pairing_attempt');
  };
}
