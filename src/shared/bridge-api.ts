// Canonical source of truth from T022 onward. specs/001-foundation/contracts/preload-bridge.ts
// is a planning snapshot and is NOT re-synced after this file exists.
import type { LogRecord } from './log-record.js';
import type { AppConfig } from './app-config.js';
import type { PairingStatus, PairingSubmitResult } from './pairing-types.js';

/**
 * 002-terminal-pairing: the `pairing` namespace exposed by the preload
 * bridge. Interface-only at the foundational layer — the preload stub
 * throws "not implemented" until US1 (getStatus) and US2 (submit) wire
 * the real handlers. Types are canonical; specs/002-terminal-pairing/
 * contracts/preload-bridge.ts is a planning snapshot and is NOT re-synced.
 */
export interface PairingBridgeAPI {
  /**
   * Inspect local pairing state. Cheap; backed by a single SecretStore
   * read + single SQL row read. Renderer calls this on application boot
   * to decide between routing to /pairing or /paired (US1).
   */
  getStatus(): Promise<PairingStatus>;

  /**
   * Submit a pairing code (manual entry or wedge scan — bridge does not
   * care which). Resolves with a discriminated PairingSubmitResult for
   * every outcome, including failures. Rejects ONLY on programmer error
   * (invalid argument shape) — backend / network failures resolve with
   * the appropriate outcome category (US2 + US3-7).
   */
  submit(pairing_code: string): Promise<PairingSubmitResult>;
}

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
  /**
   * 002-terminal-pairing: terminal-pairing namespace. Interface-only at
   * the foundational layer; the preload stub throws "not implemented"
   * until US1 / US2 wire the real handlers.
   */
  pairing: PairingBridgeAPI;
}

declare global {
  interface Window {
    api: PreloadBridgeAPI;
  }
}
