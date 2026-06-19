/**
 * POS v3.5 Phase 3 — <MoneyRoll> presentational change-due display.
 *
 * MoneyRoll takes a PRECOMPUTED minor-unit value (e.g. change-due from
 * computeChangeDueMinor) and shows it as mono/tabular, dir="ltr" money. With
 * motion enabled it animates from the prior value; with prefers-reduced-motion
 * it shows the value immediately. It performs NO money math of its own.
 *
 * The animation path uses requestAnimationFrame; jsdom does not drive rAF, so
 * these tests assert the observable contract (final value, formatting,
 * direction, reduced-motion immediacy), not intermediate frames.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { MoneyRoll } from '../../../../src/renderer/ui/payments/MoneyRoll.js';

function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MoneyRoll', () => {
  beforeEach(() => {
    stubReducedMotion(true); // default to reduced-motion → deterministic, no rAF
  });

  it('renders the value in major units with two fraction digits', () => {
    render(<MoneyRoll valueMinor={12550} />);
    expect(screen.getByTestId('money-roll')).toHaveTextContent('125.50');
  });

  it('renders zero correctly', () => {
    render(<MoneyRoll valueMinor={0} />);
    expect(screen.getByTestId('money-roll')).toHaveTextContent('0.00');
  });

  it('isolates direction as ltr (money is Latin/mono even in an RTL shell)', () => {
    render(<MoneyRoll valueMinor={500} />);
    expect(screen.getByTestId('money-roll')).toHaveAttribute('dir', 'ltr');
  });

  it('applies the mono utility class for tabular numerals', () => {
    render(<MoneyRoll valueMinor={500} />);
    expect(screen.getByTestId('money-roll').className).toContain('mono');
  });

  it('shows the value immediately under prefers-reduced-motion (no animation)', () => {
    stubReducedMotion(true);
    render(<MoneyRoll valueMinor={9900} />);
    expect(screen.getByTestId('money-roll')).toHaveTextContent('99.00');
  });

  it('renders a dash for a non-safe-integer value (defensive, never NaN money)', () => {
    render(<MoneyRoll valueMinor={Number.NaN} />);
    expect(screen.getByTestId('money-roll')).toHaveTextContent('—');
  });

  it('merges an extra className when provided', () => {
    render(<MoneyRoll valueMinor={500} className="cash-entry__change-roll" />);
    expect(screen.getByTestId('money-roll').className).toContain('cash-entry__change-roll');
  });
});

describe('MoneyRoll — animation path (motion enabled)', () => {
  let now = 0;
  const rafCbs: FrameRequestCallback[] = [];

  beforeEach(() => {
    stubReducedMotion(false); // motion ON → exercise the rAF branch
    now = 1000;
    rafCbs.length = 0;
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('animates toward a CHANGED value and lands exactly on it at the end', () => {
    // Mount at 0, then change to 10000 — the change is what triggers animation
    // (first paint animates from the value to itself, i.e. no movement).
    const { rerender } = render(<MoneyRoll valueMinor={0} />);
    act(() => {
      rerender(<MoneyRoll valueMinor={10000} />);
    });
    // Advance the clock past the full 520ms duration, then drain every queued
    // frame (the no-op first-paint frame + the real 0→10000 frame). Any frame
    // run at t>=1 hits the completion branch and settles exactly on target.
    // act() flushes the rAF-driven setShown into the DOM.
    now = 5000;
    act(() => {
      let guard = 0;
      while (rafCbs.length > 0 && guard < 50) {
        const cb = rafCbs.shift();
        cb?.(now);
        guard++;
      }
    });
    expect(screen.getByTestId('money-roll')).toHaveTextContent('100.00');
  });

  it('cancels the animation frame on unmount', () => {
    const { unmount } = render(<MoneyRoll valueMinor={10000} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('renders an intermediate (eased) value before completion', () => {
    const { rerender } = render(<MoneyRoll valueMinor={0} />);
    rafCbs.length = 0; // discard the no-op first-paint frame
    act(() => {
      rerender(<MoneyRoll valueMinor={10000} />);
    });
    // Invoke ONLY the first frame of the 0 → 10000 animation, partway through.
    now = 1100;
    act(() => {
      const firstFrame = rafCbs.shift();
      firstFrame?.(now);
    });
    const el = screen.getByTestId('money-roll');
    expect(el).not.toHaveTextContent('100.00'); // below target mid-animation
    expect(el).not.toHaveTextContent('—');
    expect(rafCbs.length).toBeGreaterThan(0); // continuation queued
  });
});
