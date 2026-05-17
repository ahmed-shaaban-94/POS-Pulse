/**
 * T089 — HandoffSummary component tests.
 *
 * Covers:
 *   - Renders the frozen/handoff status banner.
 *   - Renders read-only line snapshots (display_name, subtotal).
 *   - Renders subtotal_minor using placeholder currency format.
 *   - Renders discount_placeholders as opaque "Discount applied" rows.
 *   - Does NOT render quantity steppers, remove buttons, note editing, or discount editing.
 *   - "Continue to payment" button is disabled/no-op and does not claim success.
 *   - created_at timestamp is rendered without exposing IDs or sensitive fields.
 *   - No sensitive IDs (cart_id, operator_session_id, etc.) are rendered.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import { HandoffSummary } from '../../../../../src/renderer/ui/cart/HandoffSummary.js';
import type { PaymentIntentEnvelope } from '../../../../../src/shared/cart/handoff-envelope.js';

function makeEnvelope(overrides: Partial<PaymentIntentEnvelope> = {}): PaymentIntentEnvelope {
  return {
    envelope_version: 'v1',
    cart_id: 'cart-secret-id',
    operator_session_id: 'sess-secret-id',
    owning_operator_id: 'op-secret-id',
    tenant_id: 'tenant-secret-id',
    branch_id: 'branch-secret-id',
    terminal_id: 'terminal-secret-id',
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
    created_at: '2026-05-17T10:30:00.000Z',
    handoff_action_id: 'handoff-action-secret',
    ...overrides,
  };
}

// ── Status banner ──────────────────────────────────────────────────────────────

describe('HandoffSummary — status banner', () => {
  it('renders the handoff status banner', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    const banner = document.querySelector('.handoff-summary__banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toMatch(/cart sent to payment/i);
  });

  it('banner does not expose cart_id, operator_session_id, or handoff_action_id', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    const banner = document.querySelector('.handoff-summary__banner');
    const text = banner?.textContent ?? '';
    expect(text).not.toContain('cart-secret-id');
    expect(text).not.toContain('sess-secret-id');
    expect(text).not.toContain('handoff-action-secret');
  });
});

// ── Line snapshots — read-only ─────────────────────────────────────────────────

describe('HandoffSummary — read-only line snapshots', () => {
  it('renders display_name of each line', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('renders line_subtotal_minor formatted with ¤ prefix', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    // 300 minor units = ¤3.00 — appears in line subtotal (subtotal footer may also show same value)
    const matches = screen.getAllByText('¤3.00');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders multiple lines when envelope has multiple lines', () => {
    const envelope = makeEnvelope({
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
        {
          line_id: 'line-2',
          item_ref: 'SKU-002',
          display_name: 'Ibuprofen 200mg',
          quantity: 1,
          unit_price_minor: 200,
          line_subtotal_minor: 200,
          note: null,
          version: 1,
          last_action_id: 'action-2',
        },
      ],
      subtotal_minor: 500,
    });
    render(<HandoffSummary envelope={envelope} />);
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen 200mg')).toBeInTheDocument();
  });

  it('renders note text when line has a note', () => {
    const envelope = makeEnvelope({
      lines: [
        {
          line_id: 'line-1',
          item_ref: 'SKU-001',
          display_name: 'Paracetamol 500mg',
          quantity: 1,
          unit_price_minor: 150,
          line_subtotal_minor: 150,
          note: 'Crush tablet before dispensing',
          version: 1,
          last_action_id: 'action-1',
        },
      ],
      subtotal_minor: 150,
    });
    render(<HandoffSummary envelope={envelope} />);
    expect(screen.getByText('Crush tablet before dispensing')).toBeInTheDocument();
  });
});

// ── No interactive controls in frozen state ────────────────────────────────────

describe('HandoffSummary — no interactive controls', () => {
  it('does not render quantity stepper buttons', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    expect(screen.queryByTestId('qty-increment')).toBeNull();
    expect(screen.queryByTestId('qty-decrement')).toBeNull();
  });

  it('does not render line remove buttons', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    expect(screen.queryByTestId('line-remove-btn')).toBeNull();
  });

  it('does not render note editing affordances', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    expect(screen.queryByTestId('line-note-add-btn')).toBeNull();
    // Even if a note exists, there should be no "Edit note" button
    const envelopeWithNote = makeEnvelope({
      lines: [
        {
          line_id: 'line-1',
          item_ref: 'SKU-001',
          display_name: 'Item',
          quantity: 1,
          unit_price_minor: 100,
          line_subtotal_minor: 100,
          note: 'some note',
          version: 1,
          last_action_id: 'action-1',
        },
      ],
      subtotal_minor: 100,
    });
    const { unmount } = render(<HandoffSummary envelope={envelopeWithNote} />);
    expect(screen.queryByRole('button', { name: /edit note/i })).toBeNull();
    unmount();
  });
});

// ── Subtotal ───────────────────────────────────────────────────────────────────

describe('HandoffSummary — subtotal', () => {
  it('renders subtotal_minor from the envelope', () => {
    render(<HandoffSummary envelope={makeEnvelope({ subtotal_minor: 750 })} />);
    // 750 minor units = ¤7.50
    expect(screen.getByTestId('handoff-subtotal-value')).toHaveTextContent('¤7.50');
  });
});

// ── Discount placeholders ──────────────────────────────────────────────────────

describe('HandoffSummary — discount placeholders', () => {
  it('renders "Discount applied" for each discount placeholder', () => {
    const envelope = makeEnvelope({
      discount_placeholders: [
        {
          placeholder_id: 'ph-1',
          line_id: 'line-1',
          placeholder_kind: 'FLAT_10',
          requires_manager_attribution: false,
          attribution_operator_id: null,
        },
        {
          placeholder_id: 'ph-2',
          line_id: 'line-1',
          placeholder_kind: 'PERCENT_5',
          requires_manager_attribution: true,
          attribution_operator_id: 'mgr-1',
        },
      ],
    });
    render(<HandoffSummary envelope={envelope} />);
    expect(screen.getAllByText('Discount applied')).toHaveLength(2);
  });

  it('does not render numeric percentage or currency for discount placeholders', () => {
    const envelope = makeEnvelope({
      discount_placeholders: [
        {
          placeholder_id: 'ph-1',
          line_id: 'line-1',
          placeholder_kind: 'FLAT_500',
          requires_manager_attribution: false,
          attribution_operator_id: null,
        },
      ],
    });
    render(<HandoffSummary envelope={envelope} />);
    const discountRows = document.querySelectorAll('.handoff-summary__discount-row');
    discountRows.forEach((row) => {
      expect(row.textContent).not.toMatch(/\d+%/);
      expect(row.textContent).not.toMatch(/[¤$]\d/);
    });
  });

  it('does not render a remove button for discount placeholders', () => {
    const envelope = makeEnvelope({
      discount_placeholders: [
        {
          placeholder_id: 'ph-1',
          line_id: 'line-1',
          placeholder_kind: 'FLAT_10',
          requires_manager_attribution: false,
          attribution_operator_id: null,
        },
      ],
    });
    render(<HandoffSummary envelope={envelope} />);
    expect(screen.queryByRole('button', { name: /remove discount/i })).toBeNull();
  });
});

// ── Continue to payment placeholder ───────────────────────────────────────────

describe('HandoffSummary — Continue to payment', () => {
  it('renders a "Continue to payment" button', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    const btn = screen.getByTestId('handoff-continue-button');
    expect(btn).toBeInTheDocument();
  });

  it('"Continue to payment" button is disabled', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    const btn = screen.getByTestId('handoff-continue-button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not contain success/paid/complete copy', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    const text = document.body.textContent;
    expect(text).not.toMatch(/payment success|paid|payment complete/i);
  });
});

// ── Created at / context ───────────────────────────────────────────────────────

describe('HandoffSummary — created_at context', () => {
  it('renders the created_at timestamp', () => {
    render(<HandoffSummary envelope={makeEnvelope({ created_at: '2026-05-17T10:30:00.000Z' })} />);
    const meta = document.querySelector('.handoff-summary__meta');
    expect(meta).not.toBeNull();
    if (meta !== null) {
      expect(meta.textContent).toBeTruthy();
    }
  });

  it('does not expose cart_id, operator_session_id, or handoff_action_id in meta', () => {
    render(<HandoffSummary envelope={makeEnvelope()} />);
    const text = document.body.textContent;
    expect(text).not.toContain('cart-secret-id');
    expect(text).not.toContain('sess-secret-id');
    expect(text).not.toContain('op-secret-id');
    expect(text).not.toContain('tenant-secret-id');
    expect(text).not.toContain('branch-secret-id');
    expect(text).not.toContain('terminal-secret-id');
    expect(text).not.toContain('handoff-action-secret');
  });
});
