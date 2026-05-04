import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { CheckoutPlaceholder } from '../CheckoutPlaceholder';
import { reservedSlotIds } from '../reserved-slot-ids';
import { expectNoAxeViolations } from '../../../../ui/primitives/__tests__/axe-config';

afterEach(cleanup);

/**
 * T050 — CheckoutPlaceholder: asserts all eleven reserved slots render
 * in the documented order with the correct body text, no input controls,
 * and no value-bearing data attributes.
 */
describe('CheckoutPlaceholder (T050)', () => {
  it('renders all eleven reserved slot ids', () => {
    render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );
    for (const slotId of reservedSlotIds) {
      const el = document.querySelector(`[data-slot-id="${slotId}"]`);
      expect(el).not.toBeNull();
    }
  });

  it('slots appear in documented order: six tenders → four totals → receipt.breakdown last', () => {
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );
    const slots = container.querySelectorAll('[data-slot-id]');
    const renderedIds = Array.from(slots).map((el) => el.getAttribute('data-slot-id'));
    expect(renderedIds).toStrictEqual([...reservedSlotIds]);
  });

  it('each slot body equals the literal reserved string', () => {
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );
    const slots = container.querySelectorAll('[data-slot-id]');
    for (const slot of Array.from(slots)) {
      const body = slot.querySelector('[data-slot-body]');
      expect(body).not.toBeNull();
      // Safe: the preceding assertion guarantees body is non-null before this line.
      if (body !== null) {
        expect(body.textContent).toBe('Reserved for 005-checkout-payments');
      }
    }
  });

  it('no input controls inside any slot', () => {
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );
    const slots = container.querySelectorAll('[data-slot-id]');
    for (const slot of Array.from(slots)) {
      expect(within(slot as HTMLElement).queryAllByRole('button')).toHaveLength(0);
      expect(within(slot as HTMLElement).queryAllByRole('textbox')).toHaveLength(0);
      expect(within(slot as HTMLElement).queryAllByRole('spinbutton')).toHaveLength(0);
      expect((slot as HTMLElement).querySelectorAll('[contenteditable]')).toHaveLength(0);
    }
  });

  it('no slot DOM node carries amount/currency/value data attributes', () => {
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );
    const slots = container.querySelectorAll('[data-slot-id]');
    for (const slot of Array.from(slots)) {
      const el = slot as HTMLElement;
      expect(el.dataset['amount']).toBeUndefined();
      expect(el.dataset['currency']).toBeUndefined();
      expect(el.dataset['value']).toBeUndefined();
    }
  });

  it('passes axe accessibility check', async () => {
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );
    await expectNoAxeViolations(container);
  });
});
