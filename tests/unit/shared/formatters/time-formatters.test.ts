/**
 * formatRelativeTime — relative "last opened" timestamp for the Slice-4
 * `<DrawerFailureBanner>` (§A1 brief sub-item (g): "last opened: 2 hours ago").
 *
 * Contract:
 *   • Relative, human-readable, Latin digits only (FR-066 — no Arabic-Indic
 *     numerals regardless of locale).
 *   • `now` is INJECTED (never `Date.now()`) so the renderer passes a stable
 *     reference and the formatter is deterministic under test.
 *   • A null / unparseable input returns a safe fallback string, never throws —
 *     the banner must render even if the timestamp is missing/corrupt.
 *   • Future timestamps (clock skew) clamp to "just now" rather than "in N…".
 */

import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from '../../../../src/shared/formatters/time-formatters.js';

const NOW = '2026-05-29T12:00:00.000Z';

describe('formatRelativeTime', () => {
  it('returns "just now" for < 60s ago', () => {
    expect(formatRelativeTime('2026-05-29T11:59:30.000Z', NOW)).toBe('just now');
    expect(formatRelativeTime('2026-05-29T12:00:00.000Z', NOW)).toBe('just now');
  });

  it('formats minutes (singular + plural)', () => {
    expect(formatRelativeTime('2026-05-29T11:59:00.000Z', NOW)).toBe('1 minute ago');
    expect(formatRelativeTime('2026-05-29T11:45:00.000Z', NOW)).toBe('15 minutes ago');
  });

  it('formats hours (singular + plural)', () => {
    expect(formatRelativeTime('2026-05-29T11:00:00.000Z', NOW)).toBe('1 hour ago');
    expect(formatRelativeTime('2026-05-29T09:00:00.000Z', NOW)).toBe('3 hours ago');
  });

  it('says "yesterday" for ~1 day ago and N days for more', () => {
    expect(formatRelativeTime('2026-05-28T12:00:00.000Z', NOW)).toBe('yesterday');
    expect(formatRelativeTime('2026-05-26T12:00:00.000Z', NOW)).toBe('3 days ago');
  });

  it('uses Latin digits only (FR-066) — never Arabic-Indic numerals', () => {
    const out = formatRelativeTime('2026-05-29T11:45:00.000Z', NOW);
    // No Arabic-Indic digit range (U+0660–U+0669) appears.
    expect(/[٠-٩]/.test(out)).toBe(false);
    expect(out).toMatch(/^\d/); // begins with an ASCII digit
  });

  it('clamps a future timestamp (clock skew) to "just now"', () => {
    expect(formatRelativeTime('2026-05-29T12:05:00.000Z', NOW)).toBe('just now');
  });

  it('returns a safe fallback for null / unparseable input (never throws)', () => {
    expect(formatRelativeTime(null, NOW)).toBe('unknown');
    expect(formatRelativeTime('not-a-date', NOW)).toBe('unknown');
    expect(formatRelativeTime('', NOW)).toBe('unknown');
  });
});
