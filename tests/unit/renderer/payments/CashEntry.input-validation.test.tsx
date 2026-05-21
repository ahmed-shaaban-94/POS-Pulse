/**
 * T041 — <CashEntry> input validation test.
 *
 * Asserts:
 *   - the input rejects float / negative / non-integer keystrokes;
 *   - the computed change-due is displayed in major units (display only);
 *   - "Confirm" is enabled only when amountAppliedMinor ≥ remainingBalanceMinor.
 *
 * No bridge calls. No FSM. The component is display + input only.
 *
 * References: FR-004; visual-direction §State 2 (Cash entry).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';

afterEach(cleanup);

import { CashEntry } from '../../../../src/renderer/ui/payments/CashEntry.js';

function setup(props: Partial<ComponentProps<typeof CashEntry>> = {}) {
  const onConfirm = props.onConfirm ?? vi.fn();
  const remainingBalanceMinor = props.remainingBalanceMinor ?? 12550;
  const view = render(
    <CashEntry
      remainingBalanceMinor={remainingBalanceMinor}
      onConfirm={onConfirm}
      {...(props.onBack ? { onBack: props.onBack } : {})}
    />,
  );
  const input = screen.getByTestId('cash-entry-amount-input');
  const confirm = screen.getByTestId('cash-entry-confirm');
  return { ...view, onConfirm, input, confirm };
}

describe('<CashEntry> — input only accepts non-negative integer minor units', () => {
  it('rejects a leading minus sign keystroke (negative input refused)', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '-100' } });
    // Either the component refuses the change entirely (value stays '')
    // or it strips the minus. Either is acceptable; what's forbidden is
    // a negative numeric ending up in the displayed value.
    expect(input.value).not.toMatch(/^-/);
  });

  it('rejects float input (decimal point not a valid keystroke)', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '125.50' } });
    expect(input.value).not.toContain('.');
  });

  it('rejects alphabetic input', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('');
  });

  it('accepts a valid integer-minor keystroke', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '15000' } });
    expect(input.value).toBe('15000');
  });

  it('keeps the value empty until a valid integer is entered', () => {
    const { input } = setup();
    expect(input.value).toBe('');
  });
});

describe('<CashEntry> — confirm enablement', () => {
  it('disables confirm by default (empty input)', () => {
    const { confirm } = setup({ remainingBalanceMinor: 12550 });
    expect(confirm).toBeDisabled();
  });

  it('disables confirm when amount < remaining', () => {
    const { input, confirm } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '10000' } });
    expect(confirm).toBeDisabled();
  });

  it('enables confirm when amount == remaining', () => {
    const { input, confirm } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '12550' } });
    expect(confirm).toBeEnabled();
  });

  it('enables confirm when amount > remaining (overpay → change due)', () => {
    const { input, confirm } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '15000' } });
    expect(confirm).toBeEnabled();
  });
});

describe('<CashEntry> — change-due display (display only, major units)', () => {
  it('hides change-due row when not earned (amount < remaining)', () => {
    const { input } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '10000' } });
    expect(screen.queryByTestId('cash-entry-change-due')).toBeNull();
  });

  it('hides change-due row when amount == remaining (exact change)', () => {
    const { input } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '12550' } });
    expect(screen.queryByTestId('cash-entry-change-due')).toBeNull();
  });

  it('renders change-due in major units when overpay (15000 − 12550 = 2450 → ¤24.50)', () => {
    const { input } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '15000' } });
    const changeDue = screen.getByTestId('cash-entry-change-due');
    expect(changeDue).toHaveTextContent('¤24.50');
  });

  it('renders change-due as ¤1.00 for amount=12650 remaining=12550', () => {
    const { input } = setup({ remainingBalanceMinor: 12550 });
    fireEvent.change(input, { target: { value: '12650' } });
    const changeDue = screen.getByTestId('cash-entry-change-due');
    expect(changeDue).toHaveTextContent('¤1.00');
  });
});

describe('<CashEntry> — onConfirm callback', () => {
  it('calls onConfirm with integer minor units when confirmed', () => {
    const onConfirm = vi.fn();
    const { input, confirm } = setup({ remainingBalanceMinor: 12550, onConfirm });
    fireEvent.change(input, { target: { value: '15000' } });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ amountAppliedMinor: 15000, changeDueMinor: 2450 });
  });

  it('does not call onConfirm when amount is under', () => {
    const onConfirm = vi.fn();
    const { input, confirm } = setup({ remainingBalanceMinor: 12550, onConfirm });
    fireEvent.change(input, { target: { value: '10000' } });
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('<CashEntry> — accessibility floor', () => {
  it('input is keyboard-operable (input element receives focus)', () => {
    const { input } = setup();
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('confirm button meets 44px touch-target floor', () => {
    const { confirm } = setup();
    const minHeight = confirm.style.minHeight;
    expect(minHeight).toBe('44px');
  });
});

describe('<CashEntry> — formatMinorUnits safe-integer guard on remaining', () => {
  it('renders the em-dash placeholder when remainingBalanceMinor is unsafe', () => {
    const unsafe = Number.MAX_SAFE_INTEGER + 1;
    render(<CashEntry remainingBalanceMinor={unsafe} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('cash-entry-remaining')).toHaveTextContent('—');
  });
});

describe('<CashEntry> — onBack', () => {
  it('renders the Back button when onBack is provided and invokes it on click', () => {
    const onBack = vi.fn();
    render(<CashEntry remainingBalanceMinor={12550} onConfirm={vi.fn()} onBack={onBack} />);
    const backBtn = screen.getByTestId('cash-entry-back');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render the Back button when onBack is omitted', () => {
    render(<CashEntry remainingBalanceMinor={12550} onConfirm={vi.fn()} />);
    expect(screen.queryByTestId('cash-entry-back')).toBeNull();
  });
});
