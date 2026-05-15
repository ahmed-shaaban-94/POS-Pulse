/**
 * 005-sales-cart T050 — QuantityStepper unit tests.
 *
 * Covers:
 *   1. Renders current quantity in qty display.
 *   2. + button fires onIncrement.
 *   3. − button at qty > 1 fires onDecrement.
 *   4. − button at qty=1 with no note fires onRemoveRequest (direct remove).
 *   5. − button at qty=1 with note does NOT fire onRemoveRequest directly;
 *      fires onDecrement so the parent can show a confirm dialog.
 *   6. ArrowUp key fires onIncrement.
 *   7. ArrowDown key fires onDecrement (or onRemoveRequest when qty=1, no note).
 *   8. Both buttons have min 44×44 touch target (aria-label present).
 *   9. data-testid attributes: qty-increment, qty-decrement, qty-display.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { QuantityStepper } from '../../../../../src/renderer/ui/cart/QuantityStepper.js';

const BASE_PROPS = {
  quantity: 2,
  hasNote: false,
  onIncrement: vi.fn(),
  onDecrement: vi.fn(),
  onRemoveRequest: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('T050 — QuantityStepper rendering', () => {
  it('renders the current quantity', () => {
    render(<QuantityStepper {...BASE_PROPS} quantity={3} />);
    expect(screen.getByTestId('qty-display')).toHaveTextContent('3');
  });

  it('renders + and − buttons', () => {
    render(<QuantityStepper {...BASE_PROPS} />);
    expect(screen.getByTestId('qty-increment')).toBeInTheDocument();
    expect(screen.getByTestId('qty-decrement')).toBeInTheDocument();
  });

  it('+ button has an aria-label', () => {
    render(<QuantityStepper {...BASE_PROPS} />);
    expect(screen.getByTestId('qty-increment')).toHaveAttribute('aria-label');
  });

  it('− button has an aria-label', () => {
    render(<QuantityStepper {...BASE_PROPS} />);
    expect(screen.getByTestId('qty-decrement')).toHaveAttribute('aria-label');
  });
});

describe('T050 — QuantityStepper increment', () => {
  it('calls onIncrement when + is clicked', async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    render(<QuantityStepper {...BASE_PROPS} onIncrement={onIncrement} />);
    await user.click(screen.getByTestId('qty-increment'));
    expect(onIncrement).toHaveBeenCalledOnce();
  });

  it('calls onIncrement on ArrowUp keydown', async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    render(<QuantityStepper {...BASE_PROPS} onIncrement={onIncrement} />);
    screen.getByTestId('qty-increment').focus();
    await user.keyboard('{ArrowUp}');
    expect(onIncrement).toHaveBeenCalledOnce();
  });
});

describe('T050 — QuantityStepper decrement at qty > 1', () => {
  it('calls onDecrement when − is clicked and qty > 1', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    render(<QuantityStepper {...BASE_PROPS} quantity={2} onDecrement={onDecrement} />);
    await user.click(screen.getByTestId('qty-decrement'));
    expect(onDecrement).toHaveBeenCalledOnce();
  });

  it('does not call onRemoveRequest when qty > 1 and − is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveRequest = vi.fn();
    render(<QuantityStepper {...BASE_PROPS} quantity={2} onRemoveRequest={onRemoveRequest} />);
    await user.click(screen.getByTestId('qty-decrement'));
    expect(onRemoveRequest).not.toHaveBeenCalled();
  });
});

describe('T050 — QuantityStepper decrement at qty=1 (no note)', () => {
  it('calls onRemoveRequest when qty=1 and hasNote=false', async () => {
    const user = userEvent.setup();
    const onRemoveRequest = vi.fn();
    render(
      <QuantityStepper
        {...BASE_PROPS}
        quantity={1}
        hasNote={false}
        onRemoveRequest={onRemoveRequest}
      />,
    );
    await user.click(screen.getByTestId('qty-decrement'));
    expect(onRemoveRequest).toHaveBeenCalledOnce();
  });

  it('does not call onDecrement when qty=1 and hasNote=false', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    render(
      <QuantityStepper {...BASE_PROPS} quantity={1} hasNote={false} onDecrement={onDecrement} />,
    );
    await user.click(screen.getByTestId('qty-decrement'));
    expect(onDecrement).not.toHaveBeenCalled();
  });
});

describe('T050 — QuantityStepper decrement at qty=1 (with note)', () => {
  it('calls onDecrement (not onRemoveRequest) when qty=1 and hasNote=true', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    const onRemoveRequest = vi.fn();
    render(
      <QuantityStepper
        {...BASE_PROPS}
        quantity={1}
        hasNote={true}
        onDecrement={onDecrement}
        onRemoveRequest={onRemoveRequest}
      />,
    );
    await user.click(screen.getByTestId('qty-decrement'));
    expect(onDecrement).toHaveBeenCalledOnce();
    expect(onRemoveRequest).not.toHaveBeenCalled();
  });
});

describe('T050 — QuantityStepper keyboard navigation', () => {
  it('ArrowDown calls onDecrement when qty > 1', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    render(<QuantityStepper {...BASE_PROPS} quantity={3} onDecrement={onDecrement} />);
    screen.getByTestId('qty-decrement').focus();
    await user.keyboard('{ArrowDown}');
    expect(onDecrement).toHaveBeenCalledOnce();
  });
});
