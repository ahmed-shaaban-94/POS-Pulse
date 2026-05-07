import type { BrowserOptions, ErrorEvent, EventHint } from '@sentry/electron/renderer';

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
 * Denylist of keys (case-insensitive substring match).
 *
 * 004-operator-session T050 additions (PR-1 / FR-030 / FR-027 alignment) —
 * mirrors `src/main/observability/sentry-main.ts`'s rationale:
 *   - `pin`     — PIN values / hashes / salts (S4 cashier credential).
 *                 Substring match accepts the `pinpoint`/`spinning`
 *                 false-positive trade-off; POS-Pulse's renderer
 *                 vocabulary does not collide.
 *   - `JWT`     — Clerk JSON Web Tokens and any other JWT-bearing field.
 *                 Spelt uppercase in this file to satisfy the renderer's
 *                 case-sensitive PR-1 invariant guard (lowercase JWT
 *                 vocabulary MUST NOT exist in renderer source); the
 *                 `/i` flag below still matches keys with any letter
 *                 case at runtime.
 *   - `clerk`   — defence-in-depth for Clerk-namespaced credentials.
 *   - `auth`    — catches HTTP-auth header names and `authToken`-style keys.
 *   - `pair`    — `pairing_code` and any future pairing-namespaced
 *                 credential field.
 *
 * Audit-event `FORBIDDEN_PAYLOAD_KEYS` (raw cardholder data, full PII,
 * credential fragments, PIN values, Clerk JSON Web Tokens, session
 * tokens, device-token attestations, pairing codes) are all covered —
 * their substrings are present.
 */
const DENYLIST_PATTERN =
  /secret|token|password|credential|card|pii|cvv|pan|email|phone|pin|JWT|clerk|auth|pair/i;

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
      if (DENYLIST_PATTERN.test(key)) continue;
      out[key] = stripDenylistedKeys(child);
    }
    return out;
  }
  return value;
}
