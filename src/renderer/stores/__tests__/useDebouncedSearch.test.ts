import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useDebouncedSearch, SEARCH_DEBOUNCE_MS } from '../useDebouncedSearch.js';

/**
 * 009 T036 (RED) — debounce + scanner-bypass.
 *
 * NFR-3 / FR-8 / FR-16. Typed input is debounced (~150 ms) so a fast typist
 * fires ONE search after the input settles. A wedge scanner submits its whole
 * code followed by a terminator (Enter); that path BYPASSES the debounce and
 * fires immediately, cancelling any pending typed-debounce. Queries shorter than
 * the 2-char minimum never fire (FR-16) and cancel any pending search.
 *
 * The timer lives in this hook, NOT in `catalogueSearchStore` (the FSM is
 * timer-free by design). All four timer tests use fake timers consistently in
 * this one describe — no fake/real mixing (the PairingForm flake lesson).
 */

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire on the first keystroke — only after the input settles for the debounce window', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onSearch));

    act(() => {
      result.current.onType('pa');
    });
    expect(onSearch).not.toHaveBeenCalled();

    // Just before the window closes: still not fired.
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(onSearch).not.toHaveBeenCalled();

    // Cross the window: fires once with the latest value.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('pa');
  });

  it('coalesces rapid typing into a single search with the final value', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onSearch));

    act(() => {
      result.current.onType('p');
      result.current.onType('pa');
      result.current.onType('pan');
    });
    // Window restarts on each keystroke → nothing yet.
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('pan');
  });

  it('scanner submit fires immediately (no debounce wait) and cancels a pending typed search', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onSearch));

    act(() => {
      result.current.onType('pan'); // pending typed-debounce
      result.current.onScanSubmit('6221000000001'); // wedge terminator
    });

    // Immediate, with the scanned value — no timer advance needed.
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('6221000000001');

    // The pending typed-debounce must have been cancelled (no second fire).
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('does not fire a typed search shorter than 2 chars (FR-16) and cancels a pending one', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onSearch));

    act(() => {
      result.current.onType('pa'); // valid, pending
      result.current.onType('p'); // back below min → cancels
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('an empty typed value cancels a pending search (cleared input)', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onSearch));

    act(() => {
      result.current.onType('pan');
      result.current.onType('');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).not.toHaveBeenCalled();
  });
});
