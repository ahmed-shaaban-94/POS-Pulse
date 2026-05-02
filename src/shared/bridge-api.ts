// Canonical source of truth from T022 onward. specs/001-foundation/contracts/preload-bridge.ts
// is a planning snapshot and is NOT re-synced after this file exists.
import type { LogRecord } from './log-record.js';
import type { AppConfig } from './app-config.js';

export interface PreloadBridgeAPI {
  ping(): Promise<'pong'>;
  appVersion(): Promise<string>;
  /**
   * Phase 8 / US6: ship a structured log record to the main-process
   * logger. Sandboxed renderers cannot write files directly; this is
   * the only path from renderer code to the on-disk log stream.
   * Resolves on successful enqueue; never rejects with a value the
   * caller is expected to surface — logging must not crash the app.
   */
  log(record: LogRecord): Promise<void>;
  /**
   * Phase 9 / US7: pull renderer-relevant runtime configuration from
   * main. Currently the only field is `sentryDsn` — used to decide
   * whether to initialise renderer-side Sentry. Sandboxed renderers
   * cannot read `process.env`, and `import.meta.env.VITE_*` would
   * inline the DSN into the bundle at build time — neither is
   * acceptable, so config crosses the typed bridge instead (D3).
   */
  appConfig(): Promise<AppConfig>;
}

declare global {
  interface Window {
    api: PreloadBridgeAPI;
  }
}
