import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  DEFAULT_THEME,
  initTheme,
  readPersistedTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  useThemeStore,
} from '../theme-store.js';

/**
 * POS v3.5 Phase 1 (ADR-0004) — theme-store unit coverage.
 *
 * The theme-contract guard and ThemeToggle test exercise the store
 * indirectly; this suite covers the store's own branches directly —
 * notably `setTheme` and the defensive `localStorage`/`document` catch
 * paths that keep the terminal launching when storage/DOM is unavailable.
 */

afterEach(() => {
  vi.restoreAllMocks();
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('theme-store — readPersistedTheme', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('returns the default theme when nothing is stored', () => {
    expect(readPersistedTheme()).toBe(DEFAULT_THEME);
  });

  it('returns a valid stored theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(readPersistedTheme()).toBe('light');
  });

  it('falls back to default for a corrupt stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readPersistedTheme()).toBe(DEFAULT_THEME);
  });

  it('degrades to default when localStorage.getItem throws (catch path)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(readPersistedTheme()).toBe(DEFAULT_THEME);
  });

  it('returns default when localStorage is undefined (headless guard)', () => {
    vi.stubGlobal('localStorage', undefined);
    try {
      expect(readPersistedTheme()).toBe(DEFAULT_THEME);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('theme-store — applyTheme', () => {
  it('sets the root attribute and persists', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('is non-fatal when localStorage.setItem throws (storage catch path)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => {
      applyTheme('dark');
    }).not.toThrow();
    // DOM still updated even though persistence failed.
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('is non-fatal when document is undefined (non-render guard)', () => {
    vi.stubGlobal('document', undefined);
    try {
      expect(() => {
        applyTheme('dark');
      }).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is non-fatal when localStorage is undefined (headless guard)', () => {
    vi.stubGlobal('localStorage', undefined);
    try {
      expect(() => {
        applyTheme('light');
      }).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('theme-store — store actions', () => {
  afterEach(() => {
    useThemeStore.setState({ theme: DEFAULT_THEME });
  });

  it('setTheme switches to an explicit theme, applies + persists', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('toggleTheme flips dark -> light', () => {
    useThemeStore.setState({ theme: 'dark' });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('toggleTheme flips light -> dark', () => {
    useThemeStore.setState({ theme: 'light' });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});

describe('theme-store — initTheme', () => {
  it('reconciles store + DOM with the persisted value and returns it', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const result = initTheme();
    expect(result).toBe('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });

  it('defaults when nothing is persisted', () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    expect(initTheme()).toBe(DEFAULT_THEME);
  });
});
