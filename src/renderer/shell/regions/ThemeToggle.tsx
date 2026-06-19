import type { JSX } from 'react';

import { useTheme } from '../../hooks/useTheme';

/**
 * POS v3.5 Phase 1 — TopBar theme toggle (ADR-0004).
 *
 * Flips the terminal between the dark default and the light register.
 * It is a presentation control only: it mutates the theme store, which
 * applies a `data-theme` attribute to the document root and persists the
 * choice. No new component family is introduced — this is a single shell
 * affordance built from the established `.btn` vocabulary (ghost intent),
 * mirroring how OperatorSlot renders its `.btn btn--ghost` action.
 *
 * The control names its TARGET state ("Switch to light theme") so the
 * label survives a greyscale / screen-reader render; the glyph is a
 * decorative dot-mark, never the sole signal. No emoji (DESIGN.md / v3.5
 * brand rule).
 */
export function ThemeToggle(): JSX.Element {
  const { isDark, toggleTheme } = useTheme();
  const targetLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className="btn btn--ghost btn--md theme-toggle"
      onClick={toggleTheme}
      aria-label={targetLabel}
      title={targetLabel}
      aria-pressed={isDark}
      data-theme-toggle=""
      data-touch-target="44"
    >
      <span
        aria-hidden="true"
        className="theme-toggle__glyph"
        data-theme-state={isDark ? 'dark' : 'light'}
      />
      <span className="theme-toggle__label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
