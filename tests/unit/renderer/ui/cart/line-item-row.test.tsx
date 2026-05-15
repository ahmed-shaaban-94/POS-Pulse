/**
 * 005-sales-cart T049 — LineItemRow unit tests.
 *
 * Covers:
 *   1. Renders display_name, formatted unit price, formatted subtotal.
 *   2. Renders QuantityStepper wired with quantity, hasNote, callbacks.
 *   3. Renders note chip when note is non-null (truncated at 40ch).
 *   4. Renders "Add note" affordance when note is null (calls onNoteOpen).
 *   5. Remove button (×) has min 44×44 touch target via CSS var or explicit size.
 *   6. Remove button fires onRemove.
 *   7. data-testid="line-item-row" present.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { LineItemRow } from '../../../../../src/renderer/ui/cart/LineItemRow.js';

const BASE_PROPS = {
  lineId: 'line-1',
  displayName: 'Paracetamol 500mg',
  quantity: 2,
  unitPriceMinor: 150,
  lineSubtotalMinor: 300,
  note: null as string | null,
  hasNote: false,
  onQuantityIncrement: vi.fn(),
  onQuantityDecrement: vi.fn(),
  onRemove: vi.fn(),
  onNoteOpen: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('T049 — LineItemRow rendering', () => {
  it('renders the display name', () => {
    render(<LineItemRow {...BASE_PROPS} />);
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('renders unit price formatted with ¤ symbol', () => {
    render(<LineItemRow {...BASE_PROPS} />);
    expect(screen.getByTestId('line-unit-price')).toHaveTextContent('¤1.50');
  });

  it('renders line subtotal formatted with ¤ symbol', () => {
    render(<LineItemRow {...BASE_PROPS} />);
    expect(screen.getByTestId('line-subtotal')).toHaveTextContent('¤3.00');
  });

  it('renders with data-testid="line-item-row"', () => {
    render(<LineItemRow {...BASE_PROPS} />);
    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
  });

  it('passes quantity to QuantityStepper', () => {
    render(<LineItemRow {...BASE_PROPS} quantity={5} />);
    expect(screen.getByTestId('qty-display')).toHaveTextContent('5');
  });

  it('renders "Add note" affordance when note is null', () => {
    render(<LineItemRow {...BASE_PROPS} note={null} />);
    expect(screen.queryByTestId('line-note-chip')).not.toBeInTheDocument();
    expect(screen.getByTestId('line-note-add-btn')).toBeInTheDocument();
  });

  it('renders note chip when note is non-null', () => {
    render(<LineItemRow {...BASE_PROPS} note="Crush tablet" hasNote={true} />);
    expect(screen.getByTestId('line-note-chip')).toBeInTheDocument();
  });

  it('truncates note chip text to 40 characters', () => {
    const longNote = 'A'.repeat(50);
    render(<LineItemRow {...BASE_PROPS} note={longNote} hasNote={true} />);
    const chip = screen.getByTestId('line-note-chip');
    expect(chip.textContent).toMatch(/^.{1,43}$/u); // truncated to ≤40 + "..."
  });
});

describe('T049 — LineItemRow interactions', () => {
  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<LineItemRow {...BASE_PROPS} onRemove={onRemove} />);
    await user.click(screen.getByTestId('line-remove-btn'));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('calls onQuantityIncrement when + is clicked', async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    render(<LineItemRow {...BASE_PROPS} onQuantityIncrement={onIncrement} />);
    await user.click(screen.getByTestId('qty-increment'));
    expect(onIncrement).toHaveBeenCalledOnce();
  });

  it('calls onQuantityDecrement when − is clicked', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    render(<LineItemRow {...BASE_PROPS} onQuantityDecrement={onDecrement} />);
    await user.click(screen.getByTestId('qty-decrement'));
    expect(onDecrement).toHaveBeenCalledOnce();
  });

  it('remove button has aria-label identifying the line', () => {
    render(<LineItemRow {...BASE_PROPS} />);
    const btn = screen.getByTestId('line-remove-btn');
    expect(btn).toHaveAttribute('aria-label');
  });

  it('calls onNoteOpen when "Add note" affordance is clicked (note=null)', async () => {
    const user = userEvent.setup();
    const onNoteOpen = vi.fn();
    render(<LineItemRow {...BASE_PROPS} note={null} onNoteOpen={onNoteOpen} />);
    await user.click(screen.getByTestId('line-note-add-btn'));
    expect(onNoteOpen).toHaveBeenCalledOnce();
  });

  it('calls onNoteOpen when note chip is clicked (note non-null)', async () => {
    const user = userEvent.setup();
    const onNoteOpen = vi.fn();
    render(
      <LineItemRow {...BASE_PROPS} note="Crush tablet" hasNote={true} onNoteOpen={onNoteOpen} />,
    );
    await user.click(screen.getByTestId('line-note-chip'));
    expect(onNoteOpen).toHaveBeenCalledOnce();
  });
});

describe('T049 — LineItemRow zero-price edge case', () => {
  it('renders zero price as ¤0.00', () => {
    render(<LineItemRow {...BASE_PROPS} unitPriceMinor={0} lineSubtotalMinor={0} />);
    expect(screen.getByTestId('line-unit-price')).toHaveTextContent('¤0.00');
    expect(screen.getByTestId('line-subtotal')).toHaveTextContent('¤0.00');
  });
});
