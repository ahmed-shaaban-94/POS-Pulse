/**
 * Phase 8 / US6 — log record contract.
 *
 * The shape callers ship over the preload bridge to the main-process
 * logger. Base fields (`process`, `app_version`, `time`) are injected by
 * the main-side pino instance; the caller only supplies `level`, `msg`,
 * and optional structured `fields`.
 *
 * IMPORTANT: callers MUST NOT include secrets, tokens, plaintext
 * credentials, passwords, card data, PII, or SecretStore values in any
 * field. A redaction layer is deferred to a later feature
 * (data-model.md § LogRecord); in 001 enforcement is by code review.
 */

/**
 * pino's standard levels. Listed in ascending severity so a future
 * level-threshold check can compare against this order.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogRecord {
  level: LogLevel;
  msg: string;
  fields?: Record<string, unknown>;
}
