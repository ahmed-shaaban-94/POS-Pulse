/**
 * T094 — axe-clean smoke for each cart subcomponent in realistic fixtures.
 *
 * Mirrors the axe-smoke pattern in src/renderer/ui/primitives/__tests__/.
 * Each component is rendered with minimal but realistic props; the entire
 * subtree must produce zero axe-core violations under the default rules
 * (color-contrast and meta-viewport disabled per axe-config rationale).
 *
 * Components covered:
 *   - LineItemRow (T049)
 *   - QuantityStepper (T050)
 *   - LineNotePopover (T051)
 *   - VoidConfirmation (T071)
 *   - ManagerAttributionPrompt (T072)
 *   - DiscountPlaceholderRow (T073)
 *   - HandoffSummary (T089)
 *
 * No source edits. A real axe violation must be escalated.
 */

import { afterEach, describe, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { LineItemRow } from '../../../../src/renderer/ui/cart/LineItemRow.js';
import { QuantityStepper } from '../../../../src/renderer/ui/cart/QuantityStepper.js';
import { LineNotePopover } from '../../../../src/renderer/ui/cart/LineNotePopover.js';
import { VoidConfirmation } from '../../../../src/renderer/ui/cart/VoidConfirmation.js';
import { ManagerAttributionPrompt } from '../../../../src/renderer/ui/cart/ManagerAttributionPrompt.js';
import { DiscountPlaceholderRow } from '../../../../src/renderer/ui/cart/DiscountPlaceholderRow.js';
import { HandoffSummary } from '../../../../src/renderer/ui/cart/HandoffSummary.js';
import type { PaymentIntentEnvelope } from '../../../../src/shared/cart/handoff-envelope.js';
import { expectNoAxeViolations } from '../../../../src/renderer/ui/primitives/__tests__/axe-config.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── LineItemRow ────────────────────────────────────────────────────────────────

describe('T094 — LineItemRow axe', () => {
  it('LineItemRow without note: no axe violations', async () => {
    const { container } = render(
      <LineItemRow
        lineId="line-1"
        displayName="Paracetamol 500mg"
        quantity={2}
        unitPriceMinor={150}
        lineSubtotalMinor={300}
        note={null}
        hasNote={false}
        onQuantityIncrement={vi.fn()}
        onQuantityDecrement={vi.fn()}
        onRemove={vi.fn()}
        onNoteOpen={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it('LineItemRow with note chip: no axe violations', async () => {
    const { container } = render(
      <LineItemRow
        lineId="line-1"
        displayName="Paracetamol 500mg"
        quantity={1}
        unitPriceMinor={150}
        lineSubtotalMinor={150}
        note="Crush before dispensing"
        hasNote={true}
        onQuantityIncrement={vi.fn()}
        onQuantityDecrement={vi.fn()}
        onRemove={vi.fn()}
        onNoteOpen={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── QuantityStepper ────────────────────────────────────────────────────────────

describe('T094 — QuantityStepper axe', () => {
  it('QuantityStepper at qty 1, no note: no axe violations', async () => {
    const { container } = render(
      <QuantityStepper
        quantity={1}
        hasNote={false}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemoveRequest={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it('QuantityStepper at qty 5: no axe violations', async () => {
    const { container } = render(
      <QuantityStepper
        quantity={5}
        hasNote={false}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemoveRequest={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── LineNotePopover ────────────────────────────────────────────────────────────

describe('T094 — LineNotePopover axe', () => {
  it('LineNotePopover open with no existing note: no axe violations', async () => {
    const { container } = render(
      <LineNotePopover
        open={true}
        currentNote={null}
        error={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it('LineNotePopover open with existing note: no axe violations', async () => {
    const { container } = render(
      <LineNotePopover
        open={true}
        currentNote="Existing note text"
        error={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it('LineNotePopover with generic error: no axe violations', async () => {
    const { container } = render(
      <LineNotePopover
        open={true}
        currentNote={null}
        error="Note rejected"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── VoidConfirmation ───────────────────────────────────────────────────────────

describe('T094 — VoidConfirmation axe', () => {
  it('VoidConfirmation dialog open: no axe violations', async () => {
    const { container } = render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await expectNoAxeViolations(container);
  });
});

// ── ManagerAttributionPrompt ──────────────────────────────────────────────────

describe('T094 — ManagerAttributionPrompt axe', () => {
  it('ManagerAttributionPrompt dialog open: no axe violations', async () => {
    const { container } = render(
      <ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── DiscountPlaceholderRow ────────────────────────────────────────────────────

describe('T094 — DiscountPlaceholderRow axe', () => {
  it('DiscountPlaceholderRow row: no axe violations', async () => {
    const { container } = render(
      <DiscountPlaceholderRow placeholderId="ph-1" onRemove={vi.fn()} />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── HandoffSummary ────────────────────────────────────────────────────────────

function makeEnvelope(overrides: Partial<PaymentIntentEnvelope> = {}): PaymentIntentEnvelope {
  const base: PaymentIntentEnvelope = {
    envelope_version: 'v1',
    cart_id: 'cart-t094',
    operator_session_id: 'sess-t094',
    owning_operator_id: 'op-t094',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'terminal-1',
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
    handoff_action_id: 'handoff-action-id',
    ...overrides,
  };
  return Object.freeze(base);
}

describe('T094 — HandoffSummary axe', () => {
  it('HandoffSummary with one line: no axe violations', async () => {
    const { container } = render(<HandoffSummary envelope={makeEnvelope()} />);
    await expectNoAxeViolations(container);
  });

  it('HandoffSummary with a discount placeholder: no axe violations', async () => {
    const envelope = makeEnvelope({
      discount_placeholders: Object.freeze([
        Object.freeze({
          placeholder_id: 'ph-1',
          line_id: 'line-1',
          placeholder_kind: 'FLAT_10',
          requires_manager_attribution: false,
          attribution_operator_id: null,
        }),
      ]),
    });
    const { container } = render(<HandoffSummary envelope={envelope} />);
    await expectNoAxeViolations(container);
  });
});
