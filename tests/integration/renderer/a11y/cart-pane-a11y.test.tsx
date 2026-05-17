/**
 * T093 — CartPane axe-clean across visible states.
 *
 * Mirrors the S2 axe-baseline-smoke pattern (axe-smoke.test.tsx) for the
 * cart pane: every visible state must produce zero axe-core violations
 * under the default ruleset (color-contrast and meta-viewport disabled
 * per axe-config.ts rationale).
 *
 * States covered (per CartPane FSM-visible regions):
 *   - default / empty (signed-in, no active cart)
 *   - loading (cart in handing_off — bridge call in flight)
 *   - error (handoff refusal surfaced as generic alert)
 *   - editing with lines
 *   - editing with a discount placeholder row
 *   - frozen / handed-off (HandoffSummary visible)
 *
 * If a real axe violation surfaces, STOP — escalate, do not patch
 * source from this test file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { CartPane } from '../../../../src/renderer/ui/cart/CartPane.js';
import type { CartLineItem } from '../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../src/renderer/stores/operator-session-store.js';
import { CartState } from '../../../../src/shared/cart/cart-state.js';
import type { CartBridgeAPI } from '../../../../src/shared/bridge-api.js';
import type { PaymentIntentEnvelope } from '../../../../src/shared/cart/handoff-envelope.js';
import { expectNoAxeViolations } from '../../../../src/renderer/ui/primitives/__tests__/axe-config.js';

function setSignedIn(): void {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-t093',
        operator_id: 'op-t093',
        display_name: 'Test User',
        role: 'cashier',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        started_at: '2026-05-17T08:00:00.000Z',
      },
    },
  });
}

function setCartEditing(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t093', state: CartState.editing, lastLineId: null },
  });
}

function setCartHandingOff(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t093', state: CartState.handing_off, lastLineId: null },
  });
}

function setCartFrozen(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t093', state: CartState.frozen_handed_off, lastLineId: null },
  });
}

const ONE_LINE: CartLineItem[] = [
  {
    lineId: 'line-1',
    displayName: 'Paracetamol 500mg',
    quantity: 2,
    unitPriceMinor: 150,
    lineSubtotalMinor: 300,
    note: null,
    version: 1,
  },
];

const LINES_WITH_NOTE: CartLineItem[] = [
  {
    lineId: 'line-1',
    displayName: 'Paracetamol 500mg',
    quantity: 2,
    unitPriceMinor: 150,
    lineSubtotalMinor: 300,
    note: 'Crush before dispensing',
    version: 1,
  },
];

function makeEnvelope(): PaymentIntentEnvelope {
  const base: PaymentIntentEnvelope = {
    envelope_version: 'v1',
    cart_id: 'cart-t093',
    operator_session_id: 'sess-t093',
    owning_operator_id: 'op-t093',
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
  };
  return Object.freeze(base);
}

function makeBridge(overrides: Partial<CartBridgeAPI> = {}): CartBridgeAPI {
  return {
    create: vi.fn(),
    void: vi.fn().mockResolvedValue({ kind: 'ok' }),
    handoff: vi.fn().mockResolvedValue({ kind: 'ok', envelope: makeEnvelope() }),
    lines: {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      setNote: vi.fn(),
    },
    discountPlaceholders: {
      add: vi.fn(),
      remove: vi.fn().mockResolvedValue({ kind: 'ok' }),
    },
    ...overrides,
  } as unknown as CartBridgeAPI;
}

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
  useCartStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Default / empty ────────────────────────────────────────────────────────────

describe('T093 — CartPane default / empty state', () => {
  it('signed-in empty cart pane: no axe violations', async () => {
    setSignedIn();
    const { container } = render(<CartPane _testBridge={makeBridge()} _testInitialLines={[]} />);
    await expectNoAxeViolations(container);
  });
});

// ── Loading (handing_off) ──────────────────────────────────────────────────────

describe('T093 — CartPane loading state', () => {
  it('handing_off state (handoff in flight): no axe violations', async () => {
    setSignedIn();
    setCartHandingOff();
    const { container } = render(
      <CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── Error / refusal ────────────────────────────────────────────────────────────

describe('T093 — CartPane error state', () => {
  it('after handoff refusal, generic error alert is axe-clean', async () => {
    const refusalBridge = makeBridge({
      handoff: vi.fn().mockResolvedValue({
        kind: 'refusal',
        code: 'EMPTY_CART',
        message: 'empty',
      }),
    });
    setSignedIn();
    setCartEditing();
    const { container } = render(
      <CartPane _testBridge={refusalBridge} _testInitialLines={ONE_LINE} />,
    );
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(screen.getByTestId('cart-handoff-error')).toBeInTheDocument();
    });
    await expectNoAxeViolations(container);
  });
});

// ── Editing with lines ─────────────────────────────────────────────────────────

describe('T093 — CartPane editing with lines', () => {
  it('editing state with one line: no axe violations', async () => {
    setSignedIn();
    setCartEditing();
    const { container } = render(
      <CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />,
    );
    await expectNoAxeViolations(container);
  });

  it('editing state with a line that has a note: no axe violations', async () => {
    setSignedIn();
    setCartEditing();
    const { container } = render(
      <CartPane _testBridge={makeBridge()} _testInitialLines={LINES_WITH_NOTE} />,
    );
    await expectNoAxeViolations(container);
  });

  it('editing state with a discount placeholder row: no axe violations', async () => {
    setSignedIn();
    setCartEditing();
    const { container } = render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={ONE_LINE}
        _testDiscountPlaceholders={[{ placeholderId: 'ph-1', attribution_operator_id: null }]}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

// ── Frozen ─────────────────────────────────────────────────────────────────────

describe('T093 — CartPane frozen state (HandoffSummary visible)', () => {
  it('frozen state via _testInitialEnvelope: no axe violations', async () => {
    setSignedIn();
    setCartFrozen();
    const { container } = render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it('frozen state with manager + Void in HandoffSummary footer: no axe violations (Dev3)', async () => {
    useOperatorSessionStore.setState({
      state: {
        kind: 'signedIn',
        session: {
          id: 'sess-t093',
          operator_id: 'op-t093',
          display_name: 'Test User',
          role: 'manager',
          tenant_id: 'tenant-1',
          branch_id: 'branch-1',
          started_at: '2026-05-17T08:00:00.000Z',
        },
      },
    });
    setCartFrozen();
    const { container } = render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
