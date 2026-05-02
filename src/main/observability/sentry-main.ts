import type { ElectronMainOptions, ErrorEvent, EventHint } from '@sentry/electron/main';

/**
 * Phase 9 / US7 — main-process Sentry init.
 *
 * Posture (D1): Sentry ships data over the network to a remote service,
 * so the no-secrets/no-PII rule MUST be enforced at `init` time, not
 * deferred. The init options below are the only safe baseline:
 *
 *   - `sendDefaultPii: false`         → Sentry's own opt-in for PII.
 *   - `integrations: []`              → no auto-instrumentation. Each
 *                                       integration that captures DOM
 *                                       events / fetch / xhr / console
 *                                       must be reviewed individually
 *                                       before enablement.
 *   - `tracesSampleRate: 0`           → no perf sampling in 001.
 *   - `beforeSend: scrubEvent`        → strips request, user, and any
 *                                       extra/contexts key matching the
 *                                       denylist regex.
 *
 * R9 DI seam: `sentryInit` defaults to `Sentry.init` in production but
 * is injectable so unit tests can pass `vi.fn()` and assert WHEN/WITH
 * WHAT it is called. Same pattern as `DatabaseFactory` (Phase 4),
 * `SafeStorageLike` (Phase 5), and `pinoRollFactory` (Phase 8).
 *
 * R4 mitigation (Phase 8 lesson + spec.md:132): if `sentryInit` itself
 * throws (e.g., DSN is set but malformed), the error is caught, logged
 * once via the main logger, and the app continues. Sentry being broken
 * MUST NOT be a launch-halt.
 *
 * SECURITY: callers MUST NOT supply a logger that writes elsewhere than
 * the local pino sink. The error string from a thrown init may contain
 * the DSN — we deliberately drop the underlying `err` before logging
 * (see `try/catch` below) so a forged DSN cannot leak to disk.
 */

export interface SentryInitFn {
  (options: ElectronMainOptions): void;
}

export interface InitSentryMainLogger {
  warn(fields: Record<string, unknown>, msg: string): void;
}

export interface InitSentryMainOptions {
  /** R9 DI seam — defaults to `Sentry.init`. */
  sentryInit: SentryInitFn;
  /** Main-process logger; only `warn` is used. Phase 8's pino instance fits. */
  logger: InitSentryMainLogger;
  /**
   * Environment-variable bag. In production the caller passes
   * `process.env`; in tests we pass a plain object so the test never
   * mutates the real environment.
   */
  env: Record<string, string | undefined>;
  /** Stamped into the Sentry `release` field. */
  appVersion: string;
}

/**
 * Initialise Sentry in the main process.
 *
 * - Empty / missing / whitespace-only DSN → no-op (never calls
 *   `sentryInit`). The app launches cleanly with crash reporting
 *   inert. This is the default state: `SENTRY_DSN=` in `.env.example`.
 * - Non-empty DSN → call `sentryInit` with the locked-down option set
 *   and a `beforeSend` scrubber. If `sentryInit` throws, log a single
 *   warn line and continue.
 */
export function initSentryMain(opts: InitSentryMainOptions): void {
  const dsn = opts.env['SENTRY_DSN'];
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
      beforeSend: scrubEvent,
    });
  } catch {
    // Deliberately do NOT pass the underlying error to the logger — its
    // message can echo the DSN, which would land in `main-YYYYMMDD.log`
    // on disk. A stable identifier is enough for triage.
    opts.logger.warn({ reason: 'init-threw' }, 'sentry:init-failed');
  }
}

/**
 * Denylist of keys that MUST be removed from `event.extra` and from
 * every per-context bag in `event.contexts`. Matches case-insensitively
 * via substring, so `ApiToken`, `userPassword`, `cardReaderId`, etc. are
 * all stripped.
 *
 * NOTE: `phone` is intentionally substring-matched — it catches
 * `phoneNumber`, `customerPhone`, etc. The trade-off is false positives
 * on words that contain "phone" coincidentally; in practice nothing in
 * POS-Pulse's domain vocabulary collides.
 */
const DENYLIST_PATTERN = /secret|token|password|credential|card|pii|cvv|pan|email|phone/i;

/**
 * Sentry `beforeSend` hook. Returns `null` to drop the event entirely
 * (Sentry treats null as "do not send"); otherwise returns a scrubbed
 * copy. Exported for unit tests.
 *
 * The scrubber is intentionally conservative:
 *   - drops `event.request` entirely (URLs, headers, query params, body)
 *   - drops `event.user` entirely (id, email, ip_address, username)
 *   - removes denylisted keys from `event.extra`
 *   - removes denylisted keys from every nested object in `event.contexts`
 *
 * What it does NOT touch:
 *   - `event.exception` (the actual stack trace — needed for triage)
 *   - `event.message` (the human-readable summary)
 *   - non-denylisted keys in extra/contexts
 *   - `event.tags`        ← guaranteed-empty in 001 because no caller
 *                            uses `Sentry.setTag()`. If a future feature
 *                            starts tagging events, extend this scrubber.
 *   - `event.breadcrumbs` ← guaranteed-empty in 001 because
 *                            `integrations: []` disables every
 *                            auto-breadcrumb source AND no caller uses
 *                            `Sentry.addBreadcrumb()`. Same proviso.
 *   - `event.transaction` ← guaranteed-empty in 001: no perf sampling.
 *   - `event.fingerprint` ← never set by any caller in 001.
 *
 * The no-PII guarantee depends on TWO preconditions holding:
 *   (a) `integrations: []` stays in the init options (D1).
 *   (b) callers never invoke `Sentry.setTag()`, `Sentry.setUser()`,
 *       `Sentry.setContext()`, or `Sentry.addBreadcrumb()` with PII.
 * Reviewers MUST flag any future caller that violates (b) and either
 * extend this scrubber or stop the call.
 */
export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint;
  // Work on a shallow copy so we never mutate Sentry's internal object.
  const cleaned: ErrorEvent = { ...event };
  delete cleaned.request;
  delete cleaned.user;

  if (cleaned.extra !== undefined) {
    cleaned.extra = stripDenylistedKeys(cleaned.extra);
  }

  if (cleaned.contexts !== undefined) {
    const cleanedContexts: Record<string, Record<string, unknown>> = {};
    for (const [ctxName, ctxValue] of Object.entries(cleaned.contexts)) {
      if (typeof ctxValue === 'object') {
        cleanedContexts[ctxName] = stripDenylistedKeys(ctxValue);
      }
    }
    // After scrubbing we hold a plain string-keyed bag; Sentry's
    // Contexts type is structurally compatible.
    cleaned.contexts = cleanedContexts;
  }

  // After scrubbing, if the event has nothing left worth shipping
  // (no message, no exception, no breadcrumbs), drop it.
  const hasPayload =
    typeof cleaned.message === 'string' ||
    cleaned.exception !== undefined ||
    (Array.isArray(cleaned.breadcrumbs) && cleaned.breadcrumbs.length > 0);
  return hasPayload ? cleaned : null;
}

function stripDenylistedKeys(bag: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bag)) {
    if (DENYLIST_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out;
}
