/**
 * POS v3.5 Phase 3 — <AmountPad> controlled cash keypad.
 *
 * A presentational, CONTROLLED keypad: the caller owns `valueMinor` and gets
 * updates via `onChange`. Digits fill from the right like a register
 * (1·0·0·0·0 ⇒ 100.00). Includes 0, 00, delete, and quick-amount buttons
 * sourced from the shared `quickAmounts` helper. It performs NO settlement
 * math (no change-due) — it only edits the entered amount.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { AmountPad } from '../../../../src/renderer/ui/payments/AmountPad.js';

afterEach(cleanup);

describe('AmountPad', () => {
  it('shows the controlled value in major units, dir=ltr', () => {
    render(<AmountPad valueMinor={12550} onChange={vi.fn()} totalMinor={0} />);
    const display = screen.getByTestId('amount-pad-display');
    expect(display).toHaveTextContent('125.50');
    expect(display).toHaveAttribute('dir', 'ltr');
  });

  it('pressing a digit right-fills (value*10 + d)', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={5} onChange={onChange} totalMinor={0} />);
    fireEvent.click(screen.getByTestId('amount-pad-key-7'));
    expect(onChange).toHaveBeenCalledWith(57);
  });

  it('pressing 0 appends a zero', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={5} onChange={onChange} totalMinor={0} />);
    fireEvent.click(screen.getByTestId('amount-pad-key-0'));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('pressing 00 appends two zeros (value*100)', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={5} onChange={onChange} totalMinor={0} />);
    fireEvent.click(screen.getByTestId('amount-pad-key-00'));
    expect(onChange).toHaveBeenCalledWith(500);
  });

  it('delete removes the last digit (floor(value/10))', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={57} onChange={onChange} totalMinor={0} />);
    fireEvent.click(screen.getByTestId('amount-pad-delete'));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('treats a null/undefined value as 0 for editing', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={undefined} onChange={onChange} totalMinor={0} />);
    fireEvent.click(screen.getByTestId('amount-pad-key-3'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('caps the value at the 8-digit register ceiling', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={99999999} onChange={onChange} totalMinor={0} />);
    fireEvent.click(screen.getByTestId('amount-pad-key-9'));
    // Already at ceiling — does not overflow past it.
    expect(onChange).toHaveBeenCalledWith(99999999);
  });

  it('renders quick-amount buttons from the total and emits the chosen amount', () => {
    const onChange = vi.fn();
    render(<AmountPad valueMinor={0} onChange={onChange} totalMinor={19925} />);
    // The exact total is always the first quick amount.
    const exact = screen.getByTestId('amount-pad-quick-19925');
    expect(exact).toBeInTheDocument();
    fireEvent.click(exact);
    expect(onChange).toHaveBeenCalledWith(19925);
  });

  it('digit keys meet the 44px touch-target floor', () => {
    render(<AmountPad valueMinor={0} onChange={vi.fn()} totalMinor={0} />);
    const key = screen.getByTestId('amount-pad-key-1');
    expect(key.style.minHeight).toBe('44px');
  });

  it('displays 0.00 for a non-safe-integer value (defensive)', () => {
    render(<AmountPad valueMinor={Number.NaN} onChange={vi.fn()} totalMinor={0} />);
    // NaN is not null, so `current` is NaN; the formatter guards it to 0.00.
    expect(screen.getByTestId('amount-pad-display')).toHaveTextContent('0.00');
  });

  it('degrades quick amounts to a single exact-0 suggestion when total is non-integer (guard)', () => {
    render(<AmountPad valueMinor={0} onChange={vi.fn()} totalMinor={Number.NaN} />);
    // The total guard coerces a non-safe-integer to 0 before quickAmounts,
    // so the only suggestion is the exact 0.
    expect(screen.getByTestId('amount-pad-quick-0')).toBeInTheDocument();
  });
});
