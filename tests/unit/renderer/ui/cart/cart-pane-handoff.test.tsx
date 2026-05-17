/**
 * T090 — CartPane handoff affordance tests.
 *
 * Covers:
 *   - "Hand off to payment" button is disabled when cart is empty.
 *   - "Hand off to payment" button is disabled when cart is editing but has no lines.
 *   - "Hand off to payment" button is enabled when cart is editing and has ≥1 line.
 *   - Button is absent/disabled when cart is already handing_off.
 *   - Button is absent when cart is frozen_handed_off.
 *   - Button is absent when cart is cancelled.
 *   - Clicking calls bridge.handoff with cart_id, per_line_versions, and an idempotency_key.
 *   - ok response calls cartStore.applyFrozen() and renders HandoffSummary.
 *   - Refusal response shows generic error copy — no IDs, no envelope contents.
 *   - HandoffSummary is rendered (not the regular line list) when cart is frozen.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { CartBridgeAPI } from '../../../../../src/shared/bridge-api.js';
import { CartPane } from '../../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../../src/renderer/stores/operator-session-store.js';
import { CartState } from '../../../../../src/shared/cart/cart-state.js';
import type { CartLineItem } from '../../../../../src/renderer/ui/cart/CartPane.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function setSignedIn() {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-t090',
        operator_id: 'op-t090',
        display_name: 'Test User',
        role: 'cashier',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        started_at: new Date().toISOString(),
      },
    },
  });
}

function setSignedOut() {
  useOperatorSessionStore.setState({ state: { kind: 'signedOut' } });
}

function setCartEditing(cartId = 'cart-t090') {
  useCartStore.setState({
    activeCart: { cart_id: cartId, state: CartState.editing, lastLineId: null },
  });
}

function setCartHandingOff() {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t090', state: CartState.handing_off, lastLineId: null },
  });
}

function setCartFrozen() {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t090', state: CartState.frozen_handed_off, lastLineId: null },
  });
}

function setCartCancelled() {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t090', state: CartState.cancelled, lastLineId: null },
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

function makeEnvelope() {
  return {
    envelope_version: 'v1' as const,
    cart_id: 'cart-t090',
    operator_session_id: 'sess-t090',
    owning_operator_id: 'op-t090',
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

afterEach(() => {
  cleanup();
  useCartStore.getState().reset();
  setSignedOut();
  vi.clearAllMocks();
});

// ── Button visibility by cart state ───────────────────────────────────────────

describe('CartPane handoff button — empty / no-lines', () => {
  it('renders the handoff button disabled when cart is empty (no activeCart)', () => {
    setSignedIn();
    // activeCart is null (reset state)
    render(<CartPane _testBridge={makeBridge()} />);
    const btn = screen.getByTestId('cart-handoff-button');
    expect(btn).toBeDisabled();
  });

  it('renders the handoff button disabled when cart is editing but has no lines', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={[]} />);
    const btn = screen.getByTestId('cart-handoff-button');
    expect(btn).toBeDisabled();
  });
});

describe('CartPane handoff button — editing with lines', () => {
  it('renders the handoff button enabled when cart is editing and has ≥1 line', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    const btn = screen.getByTestId('cart-handoff-button');
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('CartPane handoff button — frozen/cancelled states', () => {
  it('does not render the handoff button when cart is frozen_handed_off', () => {
    setSignedIn();
    setCartFrozen();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    expect(screen.queryByTestId('cart-handoff-button')).toBeNull();
  });

  it('does not render the handoff button when cart is cancelled', () => {
    setSignedIn();
    setCartCancelled();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    expect(screen.queryByTestId('cart-handoff-button')).toBeNull();
  });

  it('renders the handoff button disabled when cart is handing_off', () => {
    setSignedIn();
    setCartHandingOff();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    const btn = screen.getByTestId('cart-handoff-button');
    expect(btn).toBeDisabled();
  });
});

// ── Handoff call payload ───────────────────────────────────────────────────────

describe('CartPane handoff — bridge call', () => {
  it('calls bridge.handoff with cart_id, per_line_versions, and idempotency_key on click', async () => {
    const handoffMock = vi.fn().mockResolvedValue({ kind: 'ok', envelope: makeEnvelope() });
    setSignedIn();
    setCartEditing('cart-t090');
    render(
      <CartPane
        _testBridge={makeBridge({ handoff: handoffMock })}
        _testInitialLines={ONE_LINE}
      />,
    );
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(handoffMock).toHaveBeenCalledTimes(1);
    });
    const [req] = handoffMock.mock.calls[0] as [
      { cart_id: string; per_line_versions: Array<{ line_id: string; version: number }>; idempotency_key: string },
    ];
    expect(req.cart_id).toBe('cart-t090');
    expect(req.per_line_versions).toEqual([{ line_id: 'line-1', version: 1 }]);
    expect(typeof req.idempotency_key).toBe('string');
    expect(req.idempotency_key.length).toBeGreaterThan(0);
  });
});

// ── Successful handoff response ────────────────────────────────────────────────

describe('CartPane handoff — ok response', () => {
  it('transitions store to frozen_handed_off on ok response', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(useCartStore.getState().activeCart?.state).toBe(CartState.frozen_handed_off);
    });
  });

  it('renders HandoffSummary after ok response (handoff-summary present)', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(document.querySelector('.handoff-summary')).not.toBeNull();
    });
  });

  it('HandoffSummary banner says "Cart sent to payment" after ok response', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      const banner = document.querySelector('.handoff-summary__banner');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toMatch(/cart sent to payment/i);
    });
  });

  it('hides the regular line list after handoff', async () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(document.querySelector('.cart-pane__line-list')).toBeNull();
    });
  });
});

// ── Refusal response — security ────────────────────────────────────────────────

describe('CartPane handoff — refusal response', () => {
  it('shows generic error copy when bridge returns a refusal', async () => {
    const refusalBridge = makeBridge({
      handoff: vi.fn().mockResolvedValue({
        kind: 'refusal',
        code: 'CART_NOT_FOUND',
        message: 'Cart cart-secret-id not found for operator sess-secret-id',
      }),
    });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={refusalBridge} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(screen.getByTestId('cart-handoff-error')).toBeInTheDocument();
    });
    const errorEl = screen.getByTestId('cart-handoff-error');
    // Must show generic message
    expect(errorEl.textContent).toMatch(/could not hand off/i);
  });

  it('does not expose IDs or refusal reason detail on refusal', async () => {
    const refusalBridge = makeBridge({
      handoff: vi.fn().mockResolvedValue({
        kind: 'refusal',
        code: 'VERSION_CONFLICT',
        message: 'line-secret-id version mismatch: expected 3 got 2',
      }),
    });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={refusalBridge} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(screen.getByTestId('cart-handoff-error')).toBeInTheDocument();
    });
    const text = document.body.textContent;
    expect(text).not.toContain('line-secret-id');
    expect(text).not.toContain('VERSION_CONFLICT');
    expect(text).not.toContain('mismatch');
    expect(text).not.toContain('cart-t090');
  });

  it('does not claim payment succeeded on refusal', async () => {
    const refusalBridge = makeBridge({
      handoff: vi.fn().mockResolvedValue({ kind: 'refusal', code: 'EMPTY_CART', message: 'empty' }),
    });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={refusalBridge} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(screen.getByTestId('cart-handoff-error')).toBeInTheDocument();
    });
    const text = document.body.textContent;
    expect(text).not.toMatch(/payment success|paid|payment complete/i);
  });

  it('does not transition store to frozen on refusal', async () => {
    const refusalBridge = makeBridge({
      handoff: vi.fn().mockResolvedValue({ kind: 'refusal', code: 'EMPTY_CART', message: 'empty' }),
    });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={refusalBridge} _testInitialLines={ONE_LINE} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    await waitFor(() => {
      expect(screen.getByTestId('cart-handoff-error')).toBeInTheDocument();
    });
    expect(useCartStore.getState().activeCart?.state).toBe(CartState.editing);
  });
});

// ── HandoffSummary rendered for pre-frozen cart (via prop test setup) ──────────

describe('CartPane — HandoffSummary shown when cart already frozen at mount', () => {
  it('renders HandoffSummary when cart state is frozen_handed_off at mount', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    expect(document.querySelector('.handoff-summary')).not.toBeNull();
  });

  it('does not render the regular line list when HandoffSummary is shown', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    expect(document.querySelector('.cart-pane__line-list')).toBeNull();
  });
});
