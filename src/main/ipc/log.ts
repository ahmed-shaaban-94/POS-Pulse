import type { IpcMain } from 'electron';
import type { LogLevel } from '../../shared/log-record.js';

/**
 * Phase 8 / US6 — `app:log` IPC handler.
 *
 * Validates a forged-input-tolerant `LogRecord` shape and routes the
 * record to the renderer-tagged pino instance in main. The handler is
 * defensive: invalid level, malformed records, and non-object payloads
 * all resolve to a no-op rather than throw — logging must never crash
 * the app, and we don't trust forged records enough to route them.
 *
 * SECURITY: this handler does not redact `record.fields`. Callers are
 * responsible for not shipping secrets/PII. A scrub layer is deferred
 * to a later feature (data-model.md § LogRecord).
 */

export const LOG_CHANNEL = 'app:log';

const VALID_LEVELS: ReadonlySet<LogLevel> = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
]);

/**
 * Narrow surface of pino we depend on. Production binds to the
 * renderer-tagged pino instance from `createLogger`; tests pass a fake
 * (see src/main/ipc/__tests__/log.test.ts).
 */
export interface RendererLoggerLike {
  trace(fields: Record<string, unknown>, msg: string): void;
  debug(fields: Record<string, unknown>, msg: string): void;
  info(fields: Record<string, unknown>, msg: string): void;
  warn(fields: Record<string, unknown>, msg: string): void;
  error(fields: Record<string, unknown>, msg: string): void;
  fatal(fields: Record<string, unknown>, msg: string): void;
}

/**
 * Internal shape — `fields` is required (defaulted to `{}` for missing
 * input) so the dispatcher does not need to handle `undefined`.
 */
interface ValidatedRecord {
  level: LogLevel;
  msg: string;
  fields: Record<string, unknown>;
}

export function registerLogHandler(ipcMain: IpcMain, rendererLogger: RendererLoggerLike): void {
  // Returns a Promise so callers can `await ipcRenderer.invoke('app:log', …)`
  // and receive a settled Promise even when the record is rejected
  // defensively (no logging happens, but the IPC round-trip resolves
  // cleanly so the renderer can move on). Synchronous body — no `await`
  // — so we use Promise.resolve() rather than `async` (which would
  // trip ESLint's require-await rule).
  ipcMain.handle(LOG_CHANNEL, (_event, payload: unknown): Promise<void> => {
    const record = parseRecord(payload);
    if (record === null) return Promise.resolve();
    rendererLogger[record.level](record.fields, record.msg);
    return Promise.resolve();
  });
}

/**
 * Defensive validator. Returns a normalized record if the payload
 * matches the contract; `null` otherwise. We never throw — a bad
 * record is silently dropped rather than crashing the renderer.
 *
 * Note: the public `LogRecord` contract has `fields?` optional; the
 * normalized internal shape sets it to `{}` so the dispatcher always
 * has a concrete object to forward.
 */
function parseRecord(payload: unknown): ValidatedRecord | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Record<string, unknown>;

  const level = obj['level'];
  if (typeof level !== 'string' || !VALID_LEVELS.has(level as LogLevel)) return null;

  const msg = obj['msg'];
  if (typeof msg !== 'string') return null;

  const rawFields = obj['fields'];
  const fields =
    typeof rawFields === 'object' && rawFields !== null && !Array.isArray(rawFields)
      ? (rawFields as Record<string, unknown>)
      : {};

  return { level: level as LogLevel, msg, fields };
}
