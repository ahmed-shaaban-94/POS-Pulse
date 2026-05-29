/**
 * Relative-time formatting for receipt/banner surfaces (008 Slice 4).
 *
 * `formatRelativeTime` renders a "last opened: 2 hours ago"-style string for the
 * `<DrawerFailureBanner>` (§A1 brief sub-item (g)). Constraints:
 *
 *   • Latin digits only (FR-066) — the output is built from JS number literals,
 *     which are always ASCII, so it is digit-safe regardless of locale.
 *   • `now` is injected (never `Date.now()`) — the renderer passes a stable
 *     reference and the function stays pure/deterministic under test.
 *   • Null / unparseable input returns a safe `'unknown'` fallback, never throws
 *     (the banner must render even with a missing/corrupt timestamp).
 *   • A future `iso` (clock skew) clamps to `'just now'`, never "in N minutes".
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function pluralize(n: number, unit: string): string {
  return `${String(n)} ${unit}${n === 1 ? '' : 's'} ago`;
}

/**
 * @param iso  An ISO-8601 UTC timestamp, or null (e.g. a drawer that never
 *             successfully opened on this terminal).
 * @param now  The reference "now" as an ISO-8601 string (injected for purity).
 */
export function formatRelativeTime(iso: string | null, now: string): string {
  if (iso === null || iso === '') return 'unknown';
  const then = Date.parse(iso);
  const ref = Date.parse(now);
  if (Number.isNaN(then) || Number.isNaN(ref)) return 'unknown';

  // Clock skew / future timestamp → clamp to "just now".
  const deltaMs = ref - then;
  if (deltaMs < MINUTE_MS) return 'just now';

  if (deltaMs < HOUR_MS) {
    return pluralize(Math.floor(deltaMs / MINUTE_MS), 'minute');
  }
  if (deltaMs < DAY_MS) {
    return pluralize(Math.floor(deltaMs / HOUR_MS), 'hour');
  }
  const days = Math.floor(deltaMs / DAY_MS);
  if (days === 1) return 'yesterday';
  return pluralize(days, 'day');
}
