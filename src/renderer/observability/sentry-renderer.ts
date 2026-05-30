import type { BrowserOptions, ErrorEvent, EventHint } from '@sentry/electron/renderer';

import { isForbiddenSentryKey } from '../../shared/audit/forbidden-keys.js';

/**
 * Phase 9 / US7 — renderer-process Sentry init.
 *
 * Mirror of `src/main/observability/sentry-main.ts` with two
 * renderer-specific differences:
 *
 * 1. **DSN source (D3).** The renderer cannot read `process.env`
 *    safely under sandbox. The DSN comes from the main process via the
 *    typed preload bridge (`window.api.appConfig()`), not from
 *    `import.meta.env.VITE_*`. Vite would otherwise inline the DSN
 *    into the renderer bundle at build time, which means anyone who
 *    unpacks the asar reads it.
 *
 * 2. **Failure sink.** The renderer has no pino instance. Init failures
 *    fall back to `console.warn`, which is the pattern Phase 8's
 *    renderer logger uses for IPC failures.
 *
 * Posture (D1) is identical to main: `sendDefaultPii: false`,
 * `integrations: []`, `tracesSampleRate: 0`, and a `beforeSend`
 * scrubber that strips `request`, `user`, and any extra/contexts key
 * matching the denylist.
 */

export interface SentryRendererInitFn {
  (options: BrowserOptions): void;
}

export interface AppConfigShape {
  sentryDsn?: string;
}

export interface FetchConfigFn {
  (): Promise<AppConfigShape>;
}

/**
 * Minimal console shape — only `warn` is required. Defined as an
 * arbitrary `(...args) => void` to match both Vitest's `vi.fn()` and
 * the global `console` object without the structural-mismatch noise
 * `Mock<...>` would otherwise produce.
 */
export type RendererConsoleLike = {
  warn(...args: unknown[]): void;
};

export interface InitSentryRendererOptions {
  /** R9 DI seam — defaults to `Sentry.init` from `@sentry/electron/renderer`. */
  sentryInit: SentryRendererInitFn;
  /**
   * Pulls the DSN from the main process. Production wires this to
   * `window.api.appConfig()`; tests pass a fake.
   */
  fetchConfig: FetchConfigFn;
  /**
   * Console sink. In production this is the global `console`; tests
   * pass a `vi.fn()` recorder.
   */
  console: RendererConsoleLike;
  appVersion: string;
}

export async function initSentryRenderer(opts: InitSentryRendererOptions): Promise<void> {
  let config: AppConfigShape;
  try {
    config = await opts.fetchConfig();
  } catch {
    // Bridge unavailable, IPC handler missing, etc. Sentry stays inert.
    opts.console.warn('[pos-pulse] sentry:config-fetch-failed');
    return;
  }

  const dsn = config.sentryDsn;
  if (typeof dsn !== 'string' || dsn.trim().length === 0) {
    return;
  }

  try {
    opts.sentryInit({
      dsn,
      release: opts.appVersion,
      sendDefaultPii: false,
      integrations: [],
      tracesSampleRate: 0,
      beforeSend: scrubRendererEvent,
    });
  } catch {
    // Like main, deliberately do NOT include the underlying error
    // string — it can echo the DSN.
    opts.console.warn('[pos-pulse] sentry:init-failed');
  }
}

/**
 * Key denylist for renderer Sentry scrubbing lives in the shared single source
 * of truth: `isForbiddenSentryKey` (exact-key over `FORBIDDEN_PAYLOAD_KEYS` ∪
 * the frozen curated substring supplement). See `shared/audit/forbidden-keys.ts`.
 *
 * Deriving from the shared symbol (import-only — the forbidden literals live in
 * `shared/`, outside renderer source) also removes this file's prior need to
 * spell credential vocabulary in upper-case to dodge the renderer's static
 * no-credential-token-vocabulary guard (the `004 PR-1` static test): no such
 * literal appears in this file anymore.
 */

/**
 * Renderer-side `beforeSend`. Same posture as main's `scrubEvent` but
 * typed against `@sentry/browser`'s `ErrorEvent`. Sentry's beforeSend
 * signature requires returning the same kind of event passed in (or
 * `null`); we keep that contract.
 *
 * Strips: `request`, `user`, denylisted keys in `extra` and `contexts`.
 * Does NOT touch: `event.tags`, `event.breadcrumbs`, `event.transaction`,
 * `event.fingerprint`. These are guaranteed empty in 001 because
 * (a) `integrations: []` disables every auto-population source and
 * (b) no caller uses `Sentry.setTag()` / `Sentry.addBreadcrumb()` /
 * `Sentry.setUser()`. Reviewers MUST extend this scrubber if a future
 * feature breaks either precondition.
 */
export function scrubRendererEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  void _hint;
  const cleaned: ErrorEvent = { ...event };
  delete cleaned.request;
  delete cleaned.user;

  if (cleaned.extra !== undefined) {
    cleaned.extra = stripDenylistedKeys(cleaned.extra) as Record<string, unknown>;
  }

  if (cleaned.contexts !== undefined) {
    const cleanedContexts: Record<string, Record<string, unknown>> = {};
    for (const [name, value] of Object.entries(cleaned.contexts)) {
      if (typeof value === 'object') {
        cleanedContexts[name] = stripDenylistedKeys(value) as Record<string, unknown>;
      }
    }
    // After scrubbing we hold a plain string-keyed bag; Sentry's
    // Contexts type is structurally compatible.
    cleaned.contexts = cleanedContexts;
  }

  const hasPayload =
    typeof cleaned.message === 'string' ||
    cleaned.exception !== undefined ||
    (Array.isArray(cleaned.breadcrumbs) && cleaned.breadcrumbs.length > 0);
  return hasPayload ? cleaned : null;
}

/**
 * Recursively strip denylisted keys from a nested object tree.
 *
 * 004-operator-session T050 — mirrors the recursion in
 * `src/main/observability/sentry-main.ts`. Audit-event payloads are
 * nested under `extra.audit.event.payload.<field>` shapes; the prior
 * shallow strip would have let them through.
 */
function stripDenylistedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripDenylistedKeys(item));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenSentryKey(key)) continue;
      out[key] = stripDenylistedKeys(child);
    }
    return out;
  }
  return value;
}
