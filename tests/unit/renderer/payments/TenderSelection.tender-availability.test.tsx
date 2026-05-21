/**
 * T021 — TenderSelection tender availability.
 *
 * Cash and external_card_terminal are enabled and selectable.
 * internal_voucher is always reserved (aria-disabled + "(not available)" sub-label).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import { TenderSelection } from '../../../../src/renderer/ui/payments/TenderSelection.js';
import type { PaymentIntentEnvelope } from '../../../../src/shared/cart/handoff-envelope.js';

function makeEnvelope(overrides: Partial<PaymentIntentEnvelope> = {}): PaymentIntentEnvelope {
  return {
    envelope_version: 'v1',
    cart_id: 'cart-001',
    operator_session_id: 'sess-001',
    owning_operator_id: 'op-001',
    tenant_id: 'tenant-001',
    branch_id: 'branch-001',
    terminal_id: 'terminal-001',
    lines: [
      {
        line_id: 'line-1',
        item_ref: 'SKU-001',
        display_name: 'Paracetamol 500mg',
        quantity: 2,
        unit_price_minor: 150,
        line_subtotal_minor: 300,
        note: null,
        version: 1,
        last_action_id: 'action-1',
      },
    ],
    discount_placeholders: [],
    subtotal_minor: 300,
    created_at: '2026-05-21T10:00:00.000Z',
    handoff_action_id: 'handoff-001',
    ...overrides,
  };
}

describe('TenderSelection — cash', () => {
  it('renders a cash tender button that is enabled', () => {
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={() => {}} />);
    const btn = screen.getByTestId('tender-cash');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onTenderSelect with "cash" when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={handler} />);
    await user.click(screen.getByTestId('tender-cash'));
    expect(handler).toHaveBeenCalledWith('cash');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('TenderSelection — external_card_terminal', () => {
  it('renders an external card terminal button that is enabled', () => {
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={() => {}} />);
    const btn = screen.getByTestId('tender-external-card');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onTenderSelect with "external_card_terminal" when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={handler} />);
    await user.click(screen.getByTestId('tender-external-card'));
    expect(handler).toHaveBeenCalledWith('external_card_terminal');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('TenderSelection — internal_voucher reserved', () => {
  it('renders the voucher slot as always visible', () => {
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={() => {}} />);
    expect(screen.getByTestId('tender-voucher')).toBeInTheDocument();
  });

  it('marks voucher slot aria-disabled', () => {
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={() => {}} />);
    expect(screen.getByTestId('tender-voucher')).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows "(not available)" sub-label on voucher slot', () => {
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={() => {}} />);
    expect(screen.getByTestId('tender-voucher-hint')).toHaveTextContent('(not available)');
  });

  it('does not call onTenderSelect when voucher slot is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={handler} />);
    // Click the button directly — since it's aria-disabled, userEvent won't
    // fire the click handler by default. Use pointer event.
    const voucherBtn = screen.getByTestId('tender-voucher');
    await user.pointer({ keys: '[MouseLeft]', target: voucherBtn });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('TenderSelection — touch targets', () => {
  it('renders all tender buttons with minimum 44px height', () => {
    render(<TenderSelection envelope={makeEnvelope()} onTenderSelect={() => {}} />);
    for (const id of ['tender-cash', 'tender-external-card', 'tender-voucher']) {
      const btn = screen.getByTestId(id);
      const style = btn.getAttribute('style') ?? '';
      // minHeight set inline via touchTarget.min (44)
      expect(style).toMatch(/min-height:\s*44/);
    }
  });
});
