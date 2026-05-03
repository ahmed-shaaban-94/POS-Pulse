import type { Logger } from 'pino';

import type { PairingAttemptLogRecord } from './service.js';

/**
 * 002-terminal-pairing US2 — thin wrapper around the existing pino base
 * logger from 001 to satisfy the `pairingLog` dependency in the
 * `PairingService` interface.
 *
 * US6 (T058-T059) replaces this with a schema-restricted emitter that
 * adds a runtime guard against extra fields. For US2 the
 * TypeScript-level shape (`PairingAttemptLogRecord`) is sufficient,
 * because the only call site is `service.ts` and every record is
 * constructed inline from a fixed schema.
 *
 * Belt-and-braces: PR #15's redaction list already scrubs
 * `pairing_code` and `device_token` at any reachable depth (logger.ts
 * `PAIRING_REDACTED_KEYS`), so even if a future caller passes a record
 * containing one of those keys the log line will not leak.
 *
 * Security policy (Constitution VII + spec NFR-4 / FR-9 / FR-10):
 *   - Only the fields enumerated in PairingAttemptLogRecord are passed
 *     through to pino. The wrapper does NOT spread arbitrary objects.
 *   - The wrapper namespace-tags every record with `pairing_log: true`
 *     so cross-process redaction tests (US6) can filter the stream
 *     deterministically.
 */
export function createPairingLog(logger: Logger): (record: PairingAttemptLogRecord) => void {
  return (record: PairingAttemptLogRecord) => {
    // Re-build the record explicitly so a future caller cannot smuggle
    // extra fields through. US6 will tighten this with a runtime guard
    // (T058-T059) and a `pairingLog` channel namespace.
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
