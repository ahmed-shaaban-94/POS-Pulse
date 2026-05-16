/**
 * T074 — CartPane sensitive actions: void affordance + discount wiring (S3).
 *
 * Covers:
 *   - Void button visible to cashier when cart is in editing state (pre-handoff).
 *   - Void button visible to manager when cart is editing.
 *   - Void button hidden for cashier when cart is frozen_handed_off (post-handoff).
 *   - Void button visible to manager when cart is frozen_handed_off.
 *   - VoidConfirmation modal opens when Void button is clicked.
 *   - VoidConfirmation Cancel closes the modal without voiding.
 *   - VoidConfirmation Confirm calls bridge.void and calls applyCancelled on ok.
 *   - DiscountPlaceholderRow is rendered per discount in _testDiscountPlaceholders.
 *   - DiscountPlaceholderRow shows no numeric magnitude.
 *   - No sensitive info (shift totals, manager identity) exposed to cashier.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { CartBridgeAPI } from '../../../../../src/shared/bridge-api.js';
import { CartPane } from '../../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../../src/renderer/stores/operator-session-store.js';
import type { OperatorSessionView } from '../../../../../src/renderer/stores/operator-session-store.js';
import { CartState } from '../../../../../src/shared/cart/cart-state.js';

function setSignedIn(overrides: Partial<OperatorSessionView> = {}) {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-t074',
        operator_id: 'op-t074',
        display_name: 'Test User',
        role: 'cashier',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        started_at: new Date().toISOString(),
        ...overrides,
      },
    },
  });
}

function setSignedOut() {
  useOperatorSessionStore.setState({ state: { kind: 'signedOut' } });
}

function setCartEditing() {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t074', state: CartState.editing, lastLineId: null },
  });
}

function setCartFrozen() {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t074', state: CartState.frozen_handed_off, lastLineId: null },
  });
}

function makeBridge(overrides: Partial<CartBridgeAPI> = {}): CartBridgeAPI {
  return {
    create: vi.fn(),
    void: vi.fn().mockResolvedValue({ kind: 'ok' }),
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

afterEach(() => {
  cleanup();
  useCartStore.getState().reset();
  setSignedOut();
  vi.clearAllMocks();
});

// ── Void button visibility by role + cart state ────────────────────────────

describe('CartPane void button — pre-handoff visibility', () => {
  it('shows Void button for cashier when cart is editing', () => {
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.getByTestId('cart-void-button')).toBeInTheDocument();
  });

  it('shows Void button for manager when cart is editing', () => {
    setSignedIn({ role: 'manager' });
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.getByTestId('cart-void-button')).toBeInTheDocument();
  });
});

describe('CartPane void button — post-handoff visibility', () => {
  it('hides Void button for cashier when cart is frozen_handed_off', () => {
    setSignedIn({ role: 'cashier' });
    setCartFrozen();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.queryByTestId('cart-void-button')).toBeNull();
  });

  it('shows Void button for manager when cart is frozen_handed_off', () => {
    setSignedIn({ role: 'manager' });
    setCartFrozen();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.getByTestId('cart-void-button')).toBeInTheDocument();
  });

  it('shows Void button for admin when cart is frozen_handed_off', () => {
    setSignedIn({ role: 'admin' });
    setCartFrozen();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.getByTestId('cart-void-button')).toBeInTheDocument();
  });
});

// ── VoidConfirmation modal wiring ──────────────────────────────────────────

describe('CartPane — VoidConfirmation modal', () => {
  it('opens VoidConfirmation when Void button is clicked', async () => {
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} />);
    await userEvent.click(screen.getByTestId('cart-void-button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Void this cart?')).toBeInTheDocument();
  });

  it('closes modal without voiding when Cancel is clicked', async () => {
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} />);
    await userEvent.click(screen.getByTestId('cart-void-button'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls bridge.void and applyCancelled when "Void cart" is confirmed', async () => {
    const voidMock = vi.fn().mockResolvedValue({ kind: 'ok' });
    const bridge = makeBridge({ void: voidMock });
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(<CartPane _testBridge={bridge} />);
    await userEvent.click(screen.getByTestId('cart-void-button'));
    await userEvent.click(screen.getByRole('button', { name: 'Void cart' }));
    await waitFor(() => {
      expect(voidMock).toHaveBeenCalledWith(expect.objectContaining({ cart_id: 'cart-t074' }));
    });
    expect(useCartStore.getState().activeCart?.state).toBe(CartState.cancelled);
  });
});

// ── DiscountPlaceholderRow rendering ──────────────────────────────────────

describe('CartPane — DiscountPlaceholderRow', () => {
  it('renders a DiscountPlaceholderRow for each discount placeholder', () => {
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testDiscountPlaceholders={[
          { placeholderId: 'dp-1', attribution_operator_id: null },
          { placeholderId: 'dp-2', attribution_operator_id: null },
        ]}
      />,
    );
    expect(screen.getAllByText('Discount applied')).toHaveLength(2);
  });

  it('does not show numeric discount magnitudes inside discount rows', () => {
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testDiscountPlaceholders={[{ placeholderId: 'dp-1', attribution_operator_id: null }]}
      />,
    );
    // Discount rows must not contain numeric percentage or currency values.
    const discountRows = document.querySelectorAll('.discount-placeholder-row');
    discountRows.forEach((row) => {
      const rowText = row.textContent;
      expect(rowText).not.toMatch(/\d+%/);
      expect(rowText).not.toMatch(/[¤$]\d/);
    });
  });
});

// ── Cashier-forbidden information gate ─────────────────────────────────────

describe('CartPane — cashier-forbidden info', () => {
  it('does not expose shift totals or manager identity to cashier', () => {
    setSignedIn({ role: 'cashier' });
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} />);
    const text = document.body.textContent;
    expect(text).not.toMatch(/shift total|expected.*cash|shortage|overage|report|KPI/i);
    expect(text).not.toMatch(/manager.*id|operator.*id/i);
  });
});
