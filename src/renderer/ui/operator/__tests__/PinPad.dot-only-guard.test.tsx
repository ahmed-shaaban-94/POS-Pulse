import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { PinPad, PIN_MAX_LENGTH } from '../PinPad.js';

/**
 * 004-operator-session T071 [S5] — PinPad dot-only guard test (TEST-FIRST).
 *
 * Security invariant (PR-1): The PIN dot row MUST carry only structural
 * markers — `data-state` and a count-based `aria-label`. It must NEVER
 * expose the PIN value itself through `value`, `data-value`, `title`, or
 * any other attribute that echoes the digit string.
 *
 * aria-label format required: "N of 6 entered" (e.g. "4 of 6 entered").
 */

function renderPinPad(value = '') {
  return render(<PinPad value={value} onChange={vi.fn()} onSubmit={vi.fn()} />);
}

afterEach(() => {
  cleanup();
});

describe('PinPad dot-only guard — PR-1 security invariant', () => {
  it('dot elements have no "value" attribute', () => {
    renderPinPad('1234');
    const dots = Array.from(screen.getByTestId('pin-pad-dots').querySelectorAll('.pin-pad__dot'));
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot).not.toHaveAttribute('value');
    }
  });

  it('dot elements have no "data-value" attribute', () => {
    renderPinPad('1234');
    const dots = Array.from(screen.getByTestId('pin-pad-dots').querySelectorAll('.pin-pad__dot'));
    for (const dot of dots) {
      expect(dot).not.toHaveAttribute('data-value');
    }
  });

  it('dot elements have no "title" attribute', () => {
    renderPinPad('1234');
    const dots = Array.from(screen.getByTestId('pin-pad-dots').querySelectorAll('.pin-pad__dot'));
    for (const dot of dots) {
      expect(dot).not.toHaveAttribute('title');
    }
  });

  it('dot elements carry only data-state (empty | filled)', () => {
    renderPinPad('123');
    const filled = Array.from(
      screen.getByTestId('pin-pad-dots').querySelectorAll('[data-state="filled"]'),
    );
    const empty = Array.from(
      screen.getByTestId('pin-pad-dots').querySelectorAll('[data-state="empty"]'),
    );
    expect(filled.length + empty.length).toBe(PIN_MAX_LENGTH);
  });

  it('dot-region aria-label is "N of 6 entered" format (zero-length)', () => {
    renderPinPad('');
    const dotsEl = screen.getByTestId('pin-pad-dots');
    expect(dotsEl).toHaveAttribute('aria-label', `0 of ${String(PIN_MAX_LENGTH)} entered`);
  });

  it('dot-region aria-label is "N of 6 entered" format (partial)', () => {
    renderPinPad('1234');
    const dotsEl = screen.getByTestId('pin-pad-dots');
    expect(dotsEl).toHaveAttribute('aria-label', `4 of ${String(PIN_MAX_LENGTH)} entered`);
  });

  it('dot-region aria-label is "N of 6 entered" format (max-length)', () => {
    renderPinPad('123456');
    const dotsEl = screen.getByTestId('pin-pad-dots');
    expect(dotsEl).toHaveAttribute(
      'aria-label',
      `${String(PIN_MAX_LENGTH)} of ${String(PIN_MAX_LENGTH)} entered`,
    );
  });

  it('dot-region inner text contains no digit characters', () => {
    renderPinPad('9876');
    const dotsEl = screen.getByTestId('pin-pad-dots');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const dotsText = dotsEl.textContent ?? '';
    expect(dotsText).not.toMatch(/[0-9]/);
  });

  it('dot-region innerHTML does not contain the PIN value', () => {
    renderPinPad('9876');
    const dotsEl = screen.getByTestId('pin-pad-dots');
    expect(dotsEl.innerHTML).not.toContain('9876');
  });
});
