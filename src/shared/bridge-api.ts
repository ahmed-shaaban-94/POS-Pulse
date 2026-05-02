// Canonical source of truth from T022 onward. specs/001-foundation/contracts/preload-bridge.ts
// is a planning snapshot and is NOT re-synced after this file exists.
import type { LogRecord } from './log-record.js';

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
}

declare global {
  interface Window {
    api: PreloadBridgeAPI;
  }
}
