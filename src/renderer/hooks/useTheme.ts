import { useThemeStore, type Theme } from '../stores/theme-store';

/**
 * POS v3.5 Phase 1 — convenience hook over the theme store (ADR-0004).
 *
 * A thin selector wrapper so components read the active theme and the
 * mutators without reaching into the store shape directly. The store is
 * the single source of truth; this hook adds no state of its own.
 *
 * Only `theme` is selected reactively (it changes); the action references
 * are stable for the store's lifetime, so they are read once from
 * `getState()` — this matches the repo idiom (`useStore.getState().action`,
 * e.g. AppShell) and avoids selecting bound methods through the hook.
 */
export interface UseThemeResult {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const theme = useThemeStore((s) => s.theme);
  const { setTheme, toggleTheme } = useThemeStore.getState();
  return { theme, isDark: theme === 'dark', setTheme, toggleTheme };
}
