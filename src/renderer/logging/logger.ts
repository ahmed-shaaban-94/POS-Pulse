import type { LogLevel, LogRecord } from '../../shared/log-record.js';

/**
 * Phase 8 / US6 — renderer-side logging facade.
 *
 * The sandboxed renderer cannot write files. This facade serializes a
 * `LogRecord` and ships it over the preload bridge to the main-process
 * IPC handler at `app:log`, which writes through the renderer-tagged
 * pino instance to `renderer-YYYYMMDD.log`.
 *
 * If the IPC call fails (e.g., main process unavailable or the bridge
 * isn't ready yet), the call falls back to `console[level]` and does
 * NOT throw — logging must never crash the app per spec edge case
 * (spec.md:130).
 *
 * SECURITY: callers MUST NOT log secrets, tokens, plaintext credentials,
 * passwords, card data, PII, or SecretStore values. Redaction is
 * deferred to a later feature (data-model.md § LogRecord).
 */

export interface RendererLogger {
  trace(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  fatal(msg: string, fields?: Record<string, unknown>): void;
}

/**
 * Build a renderer logger. The default `send` shipper invokes
 * `window.api.log`; tests inject a fake to avoid the bridge.
 */
export function createRendererLogger(
  send: (record: LogRecord) => Promise<void> = defaultSend,
): RendererLogger {
  function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    const record: LogRecord = fields !== undefined ? { level, msg, fields } : { level, msg };
    // Fire-and-forget; never await on the call site. Failure routes to
    // the local console fallback so the renderer continues normally.
    send(record).catch((err: unknown) => {
      // pino has no `fatal` on console; route fatal → console.error.
      const consoleLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace' =
        level === 'fatal' ? 'error' : level;
      console[consoleLevel](`[pos-pulse] log ipc failed; falling back: ${msg}`, fields, err);
    });
  }

  return {
    trace(msg, fields) {
      emit('trace', msg, fields);
    },
    debug(msg, fields) {
      emit('debug', msg, fields);
    },
    info(msg, fields) {
      emit('info', msg, fields);
    },
    warn(msg, fields) {
      emit('warn', msg, fields);
    },
    error(msg, fields) {
      emit('error', msg, fields);
    },
    fatal(msg, fields) {
      emit('fatal', msg, fields);
    },
  };
}

function defaultSend(record: LogRecord): Promise<void> {
  // Defensive: in tests or pre-bridge contexts, window.api may be missing.
  // The `typeof window === 'undefined'` branch is unreachable from happy-dom
  // (which always exposes window) but matters for any future SSR-style
  // build target — keeping the guard is cheap.
  /* v8 ignore next 3 */
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('preload bridge not available'));
  }
  const api = window.api as unknown as { log?: (r: LogRecord) => Promise<void> } | undefined;
  if (api === undefined || typeof api.log !== 'function') {
    return Promise.reject(new Error('preload bridge not available'));
  }
  return api.log(record);
}
