/**
 * 005-sales-cart T050 — QuantityStepper component.
 *
 * Renders [−] [qty] [+] stepper for a cart line quantity.
 *
 * Remove-on-decrement logic (S0 contact sheet §Surface 4):
 *   - qty > 1: decrement always calls onDecrement.
 *   - qty = 1, hasNote = false: decrement calls onRemoveRequest (direct remove).
 *   - qty = 1, hasNote = true: decrement calls onDecrement so the parent can
 *     show a confirm dialog before removing (note would be lost).
 *
 * Both buttons honour the 44 × 44 px touch-target floor (Constitution §P3).
 * Renderer-side role logic here is UX-only; bridge is the load-bearing gate.
 */

import type { JSX } from 'react';
import { touchTarget } from '../tokens/touch.js';

export interface QuantityStepperProps {
  quantity: number;
  hasNote: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemoveRequest: () => void;
}

const MIN_TOUCH = touchTarget.min;

export function QuantityStepper({
  quantity,
  hasNote,
  onIncrement,
  onDecrement,
  onRemoveRequest,
}: QuantityStepperProps): JSX.Element {
  function handleDecrement(): void {
    if (quantity <= 1 && !hasNote) {
      onRemoveRequest();
    } else {
      onDecrement();
    }
  }

  return (
    <div className="qty-stepper" data-testid="qty-stepper">
      <button
        type="button"
        className="qty-stepper__btn qty-stepper__btn--decrement"
        data-testid="qty-decrement"
        aria-label="Decrease quantity"
        style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH }}
        onClick={handleDecrement}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleDecrement();
          }
        }}
      >
        −
      </button>
      <span className="qty-stepper__qty" data-testid="qty-display" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="qty-stepper__btn qty-stepper__btn--increment"
        data-testid="qty-increment"
        aria-label="Increase quantity"
        style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH }}
        onClick={onIncrement}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onIncrement();
          }
        }}
      >
        +
      </button>
    </div>
  );
}
