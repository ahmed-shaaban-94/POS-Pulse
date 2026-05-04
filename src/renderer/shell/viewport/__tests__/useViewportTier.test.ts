import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useViewportTier } from '../useViewportTier';

/**
 * T025 — useViewportTier boundary tests.
 * Fakes window.matchMedia and asserts documented breakpoints.
 */

type ChangeListener = (e: MediaQueryListEvent) => void;

interface FakeMqlSlot {
  matches: boolean;
  listeners: ChangeListener[];
  removeEventListenerSpy: ReturnType<typeof vi.fn>;
}

interface SetupResult {
  expanded: FakeMqlSlot;
  iconOnly: FakeMqlSlot;
}

function setupMatchMedia(width: number): SetupResult {
  const expanded: FakeMqlSlot = {
    matches: width >= 1280,
    listeners: [],
    removeEventListenerSpy: vi.fn(),
  };
  const iconOnly: FakeMqlSlot = {
    matches: width >= 1024,
    listeners: [],
    removeEventListenerSpy: vi.fn(),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const slot = query.includes('min-width: 1280px') ? expanded : iconOnly;
      return {
        get matches() {
          return slot.matches;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_: string, listener: ChangeListener) => {
          slot.listeners.push(listener);
        }),
        removeEventListener: slot.removeEventListenerSpy,
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    }),
  );

  return { expanded, iconOnly };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useViewportTier (T025)', () => {
  it('1023px → "too-small"', () => {
    setupMatchMedia(1023);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('too-small');
  });

  it('1024px → "icon-only"', () => {
    setupMatchMedia(1024);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('icon-only');
  });

  it('1279px → "icon-only"', () => {
    setupMatchMedia(1279);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('icon-only');
  });

  it('1280px → "expanded"', () => {
    setupMatchMedia(1280);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('expanded');
  });

  it('1920px → "expanded"', () => {
    setupMatchMedia(1920);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('expanded');
  });

  it('fires update listener and debounces tier change', () => {
    const { expanded, iconOnly } = setupMatchMedia(1023);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('too-small');

    // The fake mql object uses a getter that reads slot.matches, so
    // mutating slot.matches is sufficient for the hook's closure to see
    // the new value when it calls setTier(getTier(mql.matches, ...)).
    act(() => {
      iconOnly.matches = true;
      iconOnly.listeners.forEach((l) => {
        l({} as MediaQueryListEvent);
      });
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('icon-only');

    act(() => {
      expanded.matches = true;
      expanded.listeners.forEach((l) => {
        l({} as MediaQueryListEvent);
      });
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('expanded');
  });

  it('cleans up listeners on unmount', () => {
    const { expanded, iconOnly } = setupMatchMedia(1280);
    const { unmount } = renderHook(() => useViewportTier());
    unmount();
    expect(expanded.removeEventListenerSpy).toHaveBeenCalled();
    expect(iconOnly.removeEventListenerSpy).toHaveBeenCalled();
  });
});
