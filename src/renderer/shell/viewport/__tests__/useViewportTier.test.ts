import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useViewportTier } from '../useViewportTier';

/**
 * T025 — useViewportTier boundary tests.
 * Fakes window.matchMedia and asserts documented breakpoints.
 */

function setupMatchMedia(width: number): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const listeners: Array<(e: MediaQueryListEvent) => void> = [];
      const matches = query.includes('min-width: 1280px')
        ? width >= 1280
        : query.includes('min-width: 1024px')
          ? width >= 1024
          : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_: string, listener: (e: MediaQueryListEvent) => void) => {
          listeners.push(listener);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    }),
  );
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
});
