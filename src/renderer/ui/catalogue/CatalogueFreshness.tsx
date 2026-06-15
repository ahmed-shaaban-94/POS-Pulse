import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

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

/**
 * T039 (#360) — bounded delay for the ONE-SHOT post-commit re-read.
 *
 * The driver admits a tick synchronously (`started`) and commits the promote
 * LATER on its own `completed` promise — which the bridge deliberately drops
 * (WR-2/P9-2). So the immediate post-`started` `loadFreshness()` reads the
 * PRE-commit timestamp. The owner shape brief scoped OUT a polling clock, so the
 * fix is a SINGLE deferred re-read (NOT a repeating poll): one re-read, ~3s
 * after admission, catches the committed timestamp in the common fast case. If
 * the tick is still running by then, the read is simply truthful-to-now again
 * and the next NATURAL read (next mount / next refresh) corrects it — no clock
 * ticks in the background. Cancelled on unmount and superseded by any new
 * refresh (no overlap). Sized to comfortably clear a typical promote without
 * leaving the cashier staring at a stale stamp.
 */
const POST_COMMIT_REREAD_DELAY_MS = 3_000;

export function CatalogueFreshness({ bridge }: CatalogueFreshnessProps): JSX.Element {
  const [state, setState] = useState<FreshnessState>('loading');
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RefreshFeedback>('idle');
  const [refreshing, setRefreshing] = useState(false);

  // T039 (#360) — the single pending post-commit re-read timer. Held in a ref so
  // it survives re-renders, can be superseded by a new refresh, and is cancelled
  // on unmount (no setState-after-unmount). `null` when none is scheduled.
  const rereadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // T039 (#360) — cancel any pending post-commit re-read on unmount, so a tick
  // admitted just before the pane closes never fires a setState into a dead
  // component (React warns + it is a latent leak). Idempotent.
  useEffect(() => {
    return () => {
      if (rereadTimerRef.current !== null) {
        clearTimeout(rereadTimerRef.current);
        rereadTimerRef.current = null;
      }
    };
  }, []);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    // Supersede any in-flight re-read from a prior click: only the latest tick's
    // re-read should land (no overlapping timers, no double-read).
    if (rereadTimerRef.current !== null) {
      clearTimeout(rereadTimerRef.current);
      rereadTimerRef.current = null;
    }
    try {
      const res: CatalogueRefreshResponse = await resolveBridge().refresh({});
      // Honest feedback only — never a fake "completed". The promote's outcome
      // surfaces on the next freshness read, which we kick off opportunistically.
      if (res.kind === 'already_running') setFeedback('already-running');
      else if (res.kind === 'started') setFeedback('started');
      else setFeedback('idle'); // refused — stay silent (no leaked reason)
      // The immediate re-read sees the PRE-commit timestamp: `started` means the
      // tick was ADMITTED, not committed (the bridge drops `completed`, WR-2/P9-2).
      await loadFreshness();
      // T039 (#360) — schedule ONE bounded deferred re-read to catch the committed
      // timestamp, but ONLY when THIS click admitted the tick (`started`). On
      // `already_running` another caller owns the tick; on `refused` nothing ran.
      // This is NOT a poll: a single setTimeout, superseded by a later refresh and
      // cancelled on unmount. If the promote is still running when it fires, the
      // read is simply truthful-to-now again and the next natural read corrects it
      // — no background clock (respects the owner's no-poll / absolute-time brief).
      if (res.kind === 'started') {
        rereadTimerRef.current = setTimeout(() => {
          rereadTimerRef.current = null;
          void loadFreshness();
        }, POST_COMMIT_REREAD_DELAY_MS);
      }
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
