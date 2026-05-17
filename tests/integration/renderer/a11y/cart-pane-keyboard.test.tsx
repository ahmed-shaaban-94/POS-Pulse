/**
 * T095 — Keyboard-only navigation through CartPane.
 *
 * Asserts the FR-033 keyboard-operability mandate: every cart-pane
 * interaction must be reachable via the keyboard alone — Tab/Shift+Tab
 * for focus movement, ArrowUp/ArrowDown for quantity stepper, Escape
 * for the void dialog.
 *
 * Verified properties:
 *   - In an editing cart with lines, Tab reaches each interactive
 *     control in the expected order: Void → remove(s) → qty stepper(s)
 *     → note-add(s) → discount remove (if present) → handoff.
 *   - QuantityStepper increments on ArrowUp, decrements on ArrowDown
 *     (when qty > 1).
 *   - The disabled "Continue to payment" button on a frozen cart is
 *     NOT reachable by Tab.
 *   - Cashier-forbidden controls (manager-attribution UI on a cashier
 *     session) are not keyboard-reachable on the default cart view.
 *
 * No source edits. If a control is keyboard-unreachable or the disabled
 * "Continue to payment" steals focus, STOP and report.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { CartPane } from '../../../../src/renderer/ui/cart/CartPane.js';
import type { CartLineItem } from '../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../src/renderer/stores/operator-session-store.js';
import { CartState } from '../../../../src/shared/cart/cart-state.js';
import type { CartBridgeAPI } from '../../../../src/shared/bridge-api.js';
import type { PaymentIntentEnvelope } from '../../../../src/shared/cart/handoff-envelope.js';

function setSignedIn(role: 'cashier' | 'manager' | 'admin' = 'cashier'): void {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-t095',
        operator_id: 'op-t095',
        display_name: 'Test User',
        role,
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        started_at: '2026-05-17T08:00:00.000Z',
      },
    },
  });
}

function setCartEditing(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t095', state: CartState.editing, lastLineId: null },
  });
}

function setCartFrozen(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t095', state: CartState.frozen_handed_off, lastLineId: null },
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

function makeEnvelope(): PaymentIntentEnvelope {
  const base: PaymentIntentEnvelope = {
    envelope_version: 'v1',
    cart_id: 'cart-t095',
    operator_session_id: 'sess-t095',
    owning_operator_id: 'op-t095',
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

function makeBridge(overrides: Partial<{ update: ReturnType<typeof vi.fn> }> = {}): CartBridgeAPI {
  return {
    create: vi.fn(),
    void: vi.fn().mockResolvedValue({ kind: 'ok' }),
    handoff: vi.fn(),
    lines: {
      add: vi.fn(),
      update: overrides.update ?? vi.fn().mockResolvedValue({ kind: 'ok', version: 2 }),
      remove: vi.fn().mockResolvedValue({ kind: 'ok' }),
      setNote: vi.fn(),
    },
    discountPlaceholders: {
      add: vi.fn(),
      remove: vi.fn().mockResolvedValue({ kind: 'ok' }),
    },
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

// ── Reachability ───────────────────────────────────────────────────────────────

describe('T095 — keyboard reach in editing CartPane', () => {
  it('every interactive control in the editing cart is reachable via Tab', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);

    const expectedTestIds = [
      'cart-void-button',
      'line-remove-btn',
      'qty-decrement',
      'qty-increment',
      'line-note-add-btn',
      'cart-handoff-button',
    ];

    const focused = new Set<string>();
    const user = userEvent.setup();

    // Walk Tab at most 20 times — covers the editing cart's affordances
    // with some headroom for incidental focusables we don't enumerate.
    for (let i = 0; i < 20; i++) {
      await user.tab();
      const active = document.activeElement;
      const id = active?.getAttribute('data-testid');
      if (id !== null && id !== undefined) {
        focused.add(id);
      }
      if (expectedTestIds.every((eid) => focused.has(eid))) break;
    }

    for (const eid of expectedTestIds) {
      expect(focused, `${eid} must be keyboard-reachable`).toContain(eid);
    }
  });

  it('Void button is the first cart-affordance reached by Tab from document.body', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);

    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByTestId('cart-void-button')).toHaveFocus();
  });

  it('after Void, Tab order proceeds through the line item (remove → qty- → qty+ → note-add)', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);

    const user = userEvent.setup();
    await user.tab(); // void
    expect(screen.getByTestId('cart-void-button')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('line-remove-btn')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('qty-decrement')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('qty-increment')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('line-note-add-btn')).toHaveFocus();
  });

  it('the handoff button is reachable as the final tab stop in the editing footer', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);

    const handoffButton = screen.getByTestId('cart-handoff-button');
    expect(handoffButton).not.toBeDisabled();

    const user = userEvent.setup();
    let reachedHandoff = false;
    for (let i = 0; i < 20; i++) {
      await user.tab();
      if (document.activeElement === handoffButton) {
        reachedHandoff = true;
        break;
      }
    }
    expect(reachedHandoff, 'cart-handoff-button must be reachable via Tab').toBe(true);
  });
});

// ── QuantityStepper ArrowUp / ArrowDown ──────────────────────────────────────

describe('T095 — QuantityStepper keyboard arrows', () => {
  it('ArrowUp on the + button fires increment (bridge update called)', async () => {
    const updateMock = vi.fn().mockResolvedValue({ kind: 'ok', version: 2 });
    const bridge = makeBridge({ update: updateMock });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={bridge} _testInitialLines={ONE_LINE} />);

    const user = userEvent.setup();
    const incBtn = screen.getByTestId('qty-increment');
    // Tab through the cart until we land on qty-increment (deterministic
    // since tab order is enforced by source DOM order).
    for (let i = 0; i < 10; i++) {
      await user.tab();
      if (document.activeElement === incBtn) break;
    }
    expect(document.activeElement).toBe(incBtn);
    await user.keyboard('{ArrowUp}');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_id: 'line-1',
        op: 'increment',
      }),
    );
  });

  it('ArrowDown on the − button fires decrement (bridge update called) when qty > 1', async () => {
    const updateMock = vi.fn().mockResolvedValue({ kind: 'ok', version: 2 });
    const bridge = makeBridge({ update: updateMock });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={bridge} _testInitialLines={ONE_LINE} />);

    const user = userEvent.setup();
    const decBtn = screen.getByTestId('qty-decrement');
    for (let i = 0; i < 10; i++) {
      await user.tab();
      if (document.activeElement === decBtn) break;
    }
    expect(document.activeElement).toBe(decBtn);
    await user.keyboard('{ArrowDown}');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_id: 'line-1',
        op: 'decrement',
      }),
    );
  });
});

// ── Disabled "Continue to payment" is not focusable ───────────────────────────

describe('T095 — disabled Continue to payment is keyboard-skipped', () => {
  it('Tab walk through the frozen cart never lands on the disabled continue button', async () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );

    const continueBtn = screen.getByTestId('handoff-continue-button');
    expect(continueBtn).toBeDisabled();

    const user = userEvent.setup();
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(
        document.activeElement,
        'disabled Continue to payment must NEVER receive focus',
      ).not.toBe(continueBtn);
    }
  });
});

// ── Cashier-forbidden controls ────────────────────────────────────────────────

describe('T095 — cashier-forbidden controls are not keyboard-reachable on default cart view', () => {
  it('ManagerAttributionPrompt is NOT rendered or reachable in default cashier view', async () => {
    setSignedIn('cashier');
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);

    // The prompt is only triggered by above-threshold discount flow,
    // which is not in the default rendered tree. Confirm it is absent.
    expect(document.querySelector('#mgr-attr-title')).toBeNull();
    expect(screen.queryByText(/manager approval required/i)).toBeNull();

    const user = userEvent.setup();
    for (let i = 0; i < 15; i++) {
      await user.tab();
      const active = document.activeElement;
      const text = active?.textContent ?? '';
      expect(text, 'no focused control should mention manager approval').not.toMatch(
        /manager approval/i,
      );
    }
  });

  it('no rendered control reveals shift, drawer, or report copy', () => {
    setSignedIn('cashier');
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);

    const bodyText = document.body.textContent;
    expect(bodyText).not.toMatch(/shift total/i);
    expect(bodyText).not.toMatch(/drawer cash/i);
    expect(bodyText).not.toMatch(/expected drawer/i);
    expect(bodyText).not.toMatch(/shortage/i);
    expect(bodyText).not.toMatch(/overage/i);
    expect(bodyText).not.toMatch(/x[- ]?report/i);
    expect(bodyText).not.toMatch(/z[- ]?report/i);
  });

  it('no rendered control exposes sensitive IDs or credential strings', () => {
    setSignedIn('cashier');
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    const bodyText = document.body.textContent;
    // Sentinel IDs from the test fixture envelope:
    expect(bodyText).not.toContain('cart-t095');
    expect(bodyText).not.toContain('sess-t095');
    expect(bodyText).not.toContain('op-t095');
    expect(bodyText).not.toContain('tenant-1');
    expect(bodyText).not.toContain('terminal-1');
    expect(bodyText).not.toContain('handoff-action-id');
    // Generic sensitive strings that must never appear:
    expect(bodyText).not.toMatch(/jwt/i);
    expect(bodyText).not.toMatch(/device_token/i);
    expect(bodyText).not.toMatch(/pin[- ]?hash/i);
    expect(bodyText).not.toMatch(/password/i);
    expect(bodyText).not.toMatch(/credential/i);
  });
});
