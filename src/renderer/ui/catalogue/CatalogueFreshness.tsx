import { useCallback, useEffect, useState, type JSX } from 'react';

import type {
  CatalogueBridgeAPI,
  CatalogueFreshnessResponse,
  CatalogueRefreshResponse,
  PreloadBridgeAPI,
} from '../../../shared/bridge-api.js';

/**
 * 010 T046 — `CatalogueFreshness` indicator + manual-refresh affordance
 * (US3, FR-16 / FR-16b / SC-10; §A4 P9-1).
 *
 * A COMPACT INLINE status line (not a card, not a metric tile, not a hero block:
 * DESIGN.md bans those) that reads `catalogue.freshness` and renders the true
 * last-updated state, plus a ghost "refresh" button that calls
 * `catalogue.refresh`. The four states each carry an ICON + Arabic-first TEXT,
 * so colour is never the only signal (PRODUCT.md a11y). `data-state` exposes the
 * machine state for tests / styling hooks.
 *
 * The three truthful freshness states (FR-16b / P9-1), distinct so a synced-but-
 * EMPTY promote can never read as "data exists":
 *   • never-synced  (last_success_at null)             → "لم يُنزّل الكتالوج بعد"
 *   • updated       (non-null + is_empty false)        → "آخر تحديث: <absolute time>"
 *   • synced-empty  (non-null + is_empty true, SC-10)  → "تم التحديث، لكن لا توجد منتجات"
 * plus `unavailable` for a refusal (the reason is NEVER echoed to the cashier).
 *
 * ABSOLUTE timestamp only (owner decision): a relative "منذ ٥ دقائق" needs a
 * ticking clock to stay truthful, and a stale relative label would lie. An
 * absolute time is auditable and cannot drift (PRODUCT.md "honest surfaces").
 * Rendered in a <time> element carrying the raw ISO value for machine-readable
 * provenance; the visible label is the Arabic-locale absolute time.
 *
 * Refresh is NON-BLOCKING and HONEST (P9-2): it reports `started` /
 * `already_running` exactly as the bridge does, and never claims completion
 * (the promote's result surfaces on the next freshness read, not here).
 *
 * The `bridge` prop mirrors the 009 `_testBridge` seam (tests inject a scripted
 * bridge; production reads `window.api.catalogue`). `role="status"` + polite
 * live region: it announces without stealing focus mid-transaction.
 */

/** Just the read-down slice of the catalogue bridge this component needs. */
type FreshnessBridge = Pick<CatalogueBridgeAPI, 'freshness' | 'refresh'>;

/* v8 ignore start — only reachable in Electron; jsdom never sets window.api (tests inject `bridge`) */
function readCatalogueBridge(): FreshnessBridge {
  const api = (window as unknown as { api?: PreloadBridgeAPI }).api;
  if (!api || api.catalogue === undefined) {
    throw new Error(
      'CatalogueFreshness: window.api.catalogue missing — preload bridge not initialised.',
    );
  }
  return api.catalogue;
}
/* v8 ignore stop */

type FreshnessState = 'loading' | 'never-synced' | 'updated' | 'synced-empty' | 'unavailable';
type RefreshFeedback = 'idle' | 'started' | 'already-running';

export interface CatalogueFreshnessProps {
  /** Test-only bridge injection (mirrors 009 `_testBridge`). MUST NOT be used in production. */
  bridge?: FreshnessBridge;
}

/** Map a freshness response to the machine state + the timestamp to display. */
function toState(res: CatalogueFreshnessResponse): {
  state: FreshnessState;
  lastSuccessAt: string | null;
} {
  // Defensive at the renderer↔main trust boundary: a malformed/undefined response
  // (a non-conforming bridge result) must degrade to `unavailable`, never crash
  // the pane (PRODUCT.md: failures are loud-but-handled, never a white screen).
  // `res` is statically typed as conforming, but the IPC boundary can lie, so we
  // re-check at runtime through `unknown`.
  const raw = res as unknown;
  if (raw === null || typeof raw !== 'object' || !('kind' in raw))
    return { state: 'unavailable', lastSuccessAt: null };
  if (res.kind === 'refused') return { state: 'unavailable', lastSuccessAt: null };
  if (res.last_success_at === null) return { state: 'never-synced', lastSuccessAt: null };
  return {
    state: res.is_empty ? 'synced-empty' : 'updated',
    lastSuccessAt: res.last_success_at,
  };
}

/** Arabic-locale ABSOLUTE time (no relative clock). Latin numerals stay off-screen. */
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const STATE_ICON: Record<Exclude<FreshnessState, 'loading'>, string> = {
  'never-synced': '⃝', // hollow — nothing downloaded yet
  updated: '●', // solid success dot
  'synced-empty': '⚠', // warning glyph (icon + text, never colour-only)
  unavailable: '⛔',
};

export function CatalogueFreshness({ bridge }: CatalogueFreshnessProps): JSX.Element {
  const [state, setState] = useState<FreshnessState>('loading');
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RefreshFeedback>('idle');
  const [refreshing, setRefreshing] = useState(false);

  const resolveBridge = useCallback((): FreshnessBridge => {
    /* v8 ignore next — production arm only reachable in Electron; tests inject `bridge` */
    return bridge ?? readCatalogueBridge();
  }, [bridge]);

  const loadFreshness = useCallback(async (): Promise<void> => {
    try {
      const res = await resolveBridge().freshness({});
      const next = toState(res);
      setState(next.state);
      setLastSuccessAt(next.lastSuccessAt);
    } catch {
      // A rejected freshness invoke (IPC transport edge) degrades to the
      // unavailable state — never leaves the indicator stuck on `loading`.
      setState('unavailable');
      setLastSuccessAt(null);
    }
  }, [resolveBridge]);

  useEffect(() => {
    void loadFreshness();
  }, [loadFreshness]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      const res: CatalogueRefreshResponse = await resolveBridge().refresh({});
      // Honest feedback only — never a fake "completed". The promote's outcome
      // surfaces on the next freshness read, which we kick off opportunistically.
      if (res.kind === 'already_running') setFeedback('already-running');
      else if (res.kind === 'started') setFeedback('started');
      else setFeedback('idle'); // refused — stay silent (no leaked reason)
      // KNOWN-LIMITATION (deferred to T039 / #349): `started` means the tick was
      // ADMITTED, not committed (the bridge drops `completed`, WR-2/P9-2), so this
      // immediate re-read sees the PRE-tick timestamp. There is no later poll —
      // the owner shape brief scoped OUT a polling clock (absolute-time decision).
      // This is not a lie (the in-flight "جارٍ التحديث…" feedback is the honest
      // surface; the timestamp is accurate to *now*, just not yet advanced), and
      // it is UNREACHABLE today (`refresh` refuses with no driver wired). When the
      // driver lands (T039), decide the post-commit refresh mechanism then, against
      // the driver's real async timing and the owner's no-poll constraint — and
      // re-check under §A4 (s4-review §11). Flagged by Codex review on PR #358.
      await loadFreshness();
    } finally {
      setRefreshing(false);
    }
  }, [resolveBridge, loadFreshness]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="catalogue-freshness"
      data-testid="catalogue-freshness"
      data-state={state}
    >
      {state !== 'loading' && (
        <span className="catalogue-freshness__icon" aria-hidden="true">
          {STATE_ICON[state]}
        </span>
      )}

      <span className="catalogue-freshness__label">
        {state === 'loading' && 'جارٍ القراءة…'}
        {state === 'never-synced' && 'لم يُنزّل الكتالوج بعد'}
        {state === 'updated' && lastSuccessAt !== null && (
          <>
            آخر تحديث:{' '}
            <time dateTime={lastSuccessAt} data-testid="catalogue-freshness-time">
              {formatAbsolute(lastSuccessAt)}
            </time>
          </>
        )}
        {state === 'synced-empty' && lastSuccessAt !== null && (
          <>
            تم التحديث، لكن لا توجد منتجات (
            <time dateTime={lastSuccessAt} data-testid="catalogue-freshness-time">
              {formatAbsolute(lastSuccessAt)}
            </time>
            )
          </>
        )}
        {state === 'unavailable' && 'حالة الكتالوج غير متاحة'}
      </span>

      {feedback !== 'idle' && (
        <span className="catalogue-freshness__feedback">
          {feedback === 'started' && 'جارٍ التحديث…'}
          {feedback === 'already-running' && 'جارٍ التحديث بالفعل'}
        </span>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--md catalogue-freshness__refresh"
        onClick={() => void onRefresh()}
        disabled={refreshing}
      >
        تحديث الكتالوج (Refresh)
      </button>
    </div>
  );
}
