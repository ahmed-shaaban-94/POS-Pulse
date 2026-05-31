import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ProductSearchInput } from '../ProductSearchInput.js';
import { SEARCH_DEBOUNCE_MS } from '../../../stores/useDebouncedSearch.js';

/**
 * 009 T037 — `ProductSearchInput` wired to the debounce + scanner-bypass hook.
 *
 * Typing fires a single debounced `onSearch` after the input settles; pressing
 * Enter (the wedge terminator) fires immediately with the current value,
 * bypassing the debounce (FR-8). Sub-2-char input never fires (FR-16).
 *
 * Fake timers throughout this describe (consistent — no fake/real mixing);
 * `fireEvent` is synchronous so no microtask pumping is needed.
 */

describe('ProductSearchInput — debounced typing + scanner bypass (T037)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  function typeInto(value: string): HTMLElement {
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value } });
    return input;
  }

  it('fires a single debounced onSearch with the typed value after the window', () => {
    const onSearch = vi.fn();
    render(<ProductSearchInput onSearch={onSearch} />);

    typeInto('بنادول');
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('بنادول');
  });

  it('pressing Enter fires onSearch immediately (scanner bypass) with the current value', () => {
    const onSearch = vi.fn();
    render(<ProductSearchInput onSearch={onSearch} />);

    const input = typeInto('6221000000001');
    fireEvent.keyDown(input, { key: 'Enter' });

    // Immediate — no timer advance.
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('6221000000001');

    // The pending typed-debounce was cancelled by the scan submit.
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a sub-2-char typed value (FR-16)', () => {
    const onSearch = vi.fn();
    render(<ProductSearchInput onSearch={onSearch} />);

    typeInto('a');
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('still renders the layout shell (input + min-length hint)', () => {
    render(<ProductSearchInput onSearch={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByTestId('product-search-input')).toBeInTheDocument();
  });

  it('is inert (does not throw) when no onSearch prop is supplied', () => {
    // The `onSearch?.(...)` optional-call arm: typing + Enter with no handler
    // must be a safe no-op, not a crash.
    render(<ProductSearchInput />);
    const input = typeInto('بنادول');
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow();
  });

  it('honours defaultValue and the disabled prop', () => {
    render(<ProductSearchInput onSearch={vi.fn()} defaultValue="بادئ" disabled />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('بادئ');
    expect(input).toBeDisabled();
  });

  it('ignores non-Enter keys (no scanner submit on other keys)', () => {
    const onSearch = vi.fn();
    render(<ProductSearchInput onSearch={onSearch} />);
    const input = typeInto('بنادول');
    fireEvent.keyDown(input, { key: 'Escape' });
    // No immediate fire; only the pending debounce remains.
    expect(onSearch).not.toHaveBeenCalled();
  });
});
