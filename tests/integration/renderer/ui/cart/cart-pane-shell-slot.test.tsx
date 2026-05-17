/**
 * T092 — CartPane shell-slot regression.
 *
 * Per S0 contact sheet §"Layout strategy": the cart pane is a narrow
 * fixed-width column (003's reserved cart slot, ~320–380 px). Every
 * surface uses the same three-region vertical stack:
 *   1. Header strip (label + contextual Void)
 *   2. Scrollable body (line list / empty / frozen summary)
 *   3. Footer strip (subtotal + handoff button)
 *
 * jsdom/happy-dom does NOT compute layout — pixel-perfect dimensions
 * cannot be asserted here. T096 (screenshot review) and manual Electron
 * smoke own pixel verification. This file asserts **structural shell
 * constraints only**:
 *   - CartPane root has the expected class hooks.
 *   - When mounted inside a 003-shaped slot wrapper, the pane is the
 *     only direct child of that slot.
 *   - Across every FSM-visible state, the pane keeps the same shell:
 *     header strip is present (when applicable), body region is
 *     present, footer or frozen-body is present, but never both at
 *     once (mutual exclusion).
 *   - The frozen summary renders inside the same `.cart-pane` shell.
 *
 * No source edits. If a structural assertion fails, the source has
 * regressed and the failure should be escalated, not patched here.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CartPane } from '../../../../../src/renderer/ui/cart/CartPane.js';
import type { CartLineItem } from '../../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../../src/renderer/stores/operator-session-store.js';
import { CartState } from '../../../../../src/shared/cart/cart-state.js';
import type { CartBridgeAPI } from '../../../../../src/shared/bridge-api.js';
import type { PaymentIntentEnvelope } from '../../../../../src/shared/cart/handoff-envelope.js';
import { vi } from 'vitest';

// ── helpers ────────────────────────────────────────────────────────────────────

function setSignedIn(): void {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-t092',
        operator_id: 'op-t092',
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
    activeCart: { cart_id: 'cart-t092', state: CartState.editing, lastLineId: null },
  });
}

function setCartFrozen(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t092', state: CartState.frozen_handed_off, lastLineId: null },
  });
}

function setCartCancelled(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t092', state: CartState.cancelled, lastLineId: null },
  });
}

function setCartHandingOff(): void {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-t092', state: CartState.handing_off, lastLineId: null },
  });
}

const SAMPLE_LINES: CartLineItem[] = [
  {
    lineId: 'line-1',
    displayName: 'Paracetamol 500mg',
    quantity: 2,
    unitPriceMinor: 150,
    lineSubtotalMinor: 300,
    note: null,
    version: 1,
  },
  {
    lineId: 'line-2',
    displayName: 'Ibuprofen 200mg',
    quantity: 1,
    unitPriceMinor: 200,
    lineSubtotalMinor: 200,
    note: 'Crush before dispensing',
    version: 1,
  },
];

function makeEnvelope(): PaymentIntentEnvelope {
  const base: PaymentIntentEnvelope = {
    envelope_version: 'v1',
    cart_id: 'cart-t092',
    operator_session_id: 'sess-t092',
    owning_operator_id: 'op-t092',
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

function makeBridge(): CartBridgeAPI {
  return {
    create: vi.fn(),
    void: vi.fn().mockResolvedValue({ kind: 'ok' }),
    handoff: vi.fn(),
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
  } as unknown as CartBridgeAPI;
}

/**
 * 003-style slot wrapper. The shell layout reserves a narrow column at
 * the right of the workspace for the cart. Tests render CartPane inside
 * this wrapper and assert structural constraints — never pixel size.
 */
function CartSlot({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="shell__cart-slot" data-testid="shell-cart-slot">
      {children}
    </div>
  );
}

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
  useCartStore.getState().reset();
});

afterEach(() => {
  cleanup();
});

// ── Shell composition ──────────────────────────────────────────────────────────

describe('T092 — CartPane is the only child of the cart slot', () => {
  it('renders as the sole direct child of the 003 cart slot wrapper (empty cart)', () => {
    setSignedIn();
    render(
      <CartSlot>
        <CartPane _testBridge={makeBridge()} _testInitialLines={[]} />
      </CartSlot>,
    );
    const slot = document.querySelector('[data-testid="shell-cart-slot"]');
    expect(slot).not.toBeNull();
    expect(slot?.children.length).toBe(1);
    expect(slot?.firstElementChild).toBe(document.querySelector('[data-testid="cart-pane"]'));
  });

  it('renders as the sole direct child of the slot (editing with lines)', () => {
    setSignedIn();
    setCartEditing();
    render(
      <CartSlot>
        <CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />
      </CartSlot>,
    );
    const slot = document.querySelector('[data-testid="shell-cart-slot"]');
    expect(slot?.children.length).toBe(1);
  });

  it('renders as the sole direct child of the slot (frozen with envelope)', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartSlot>
        <CartPane
          _testBridge={makeBridge()}
          _testInitialLines={[]}
          _testInitialEnvelope={makeEnvelope()}
        />
      </CartSlot>,
    );
    const slot = document.querySelector('[data-testid="shell-cart-slot"]');
    expect(slot?.children.length).toBe(1);
  });
});

// ── Three-region shell across states ───────────────────────────────────────────

describe('T092 — empty / default state shell', () => {
  it('renders the .cart-pane root with header, body, and footer', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={[]} />);
    expect(document.querySelector('.cart-pane')).not.toBeNull();
    expect(document.querySelector('.cart-pane__header')).not.toBeNull();
    expect(document.querySelector('.cart-pane__body')).not.toBeNull();
    expect(document.querySelector('.cart-pane__footer')).not.toBeNull();
  });

  it('does NOT render the frozen-body region when not frozen', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={[]} />);
    expect(document.querySelector('.cart-pane__frozen-body')).toBeNull();
  });
});

describe('T092 — editing state with lines', () => {
  it('renders the line list inside the body region', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />);
    const body = document.querySelector('.cart-pane__body');
    expect(body).not.toBeNull();
    expect(body?.querySelector('.cart-pane__line-list')).not.toBeNull();
  });

  it('keeps the footer present with the handoff button visible', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />);
    expect(document.querySelector('.cart-pane__footer')).not.toBeNull();
    expect(document.querySelector('[data-testid="cart-handoff-button"]')).not.toBeNull();
  });

  it('renders one line-item-row per seeded line', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />);
    const rows = document.querySelectorAll('[data-testid="line-item-row"]');
    expect(rows.length).toBe(SAMPLE_LINES.length);
  });
});

// ── Handing_off state ─────────────────────────────────────────────────────────

describe('T092 — handing_off state', () => {
  it('keeps the three-region shell and disables the handoff button', () => {
    setSignedIn();
    setCartHandingOff();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />);
    expect(document.querySelector('.cart-pane__header')).not.toBeNull();
    expect(document.querySelector('.cart-pane__body')).not.toBeNull();
    expect(document.querySelector('.cart-pane__footer')).not.toBeNull();
    const handoffButton = document.querySelector('[data-testid="cart-handoff-button"]');
    expect(handoffButton).not.toBeNull();
    expect(handoffButton).toBeDisabled();
  });

  it('does NOT show the frozen body in handing_off state', () => {
    setSignedIn();
    setCartHandingOff();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />);
    expect(document.querySelector('.cart-pane__frozen-body')).toBeNull();
  });
});

// ── Frozen state ──────────────────────────────────────────────────────────────

describe('T092 — frozen state', () => {
  it('renders the frozen body inside the same .cart-pane shell', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    const pane = document.querySelector('.cart-pane');
    expect(pane).not.toBeNull();
    expect(pane?.querySelector('.cart-pane__frozen-body')).not.toBeNull();
  });

  it('mutual exclusion: line list and frozen body are never both present', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    const lineList = document.querySelector('.cart-pane__line-list');
    const frozenBody = document.querySelector('.cart-pane__frozen-body');
    expect(frozenBody).not.toBeNull();
    expect(lineList).toBeNull();
  });

  it('hides the regular footer (handoff button) when frozen — frozen-body owns the bottom region', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    expect(document.querySelector('.cart-pane__footer')).toBeNull();
    expect(document.querySelector('[data-testid="cart-handoff-button"]')).toBeNull();
  });

  it('renders the handoff-summary inside the frozen body', () => {
    setSignedIn();
    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    expect(document.querySelector('[data-testid="handoff-summary"]')).not.toBeNull();
  });
});

// ── Cancelled state ────────────────────────────────────────────────────────────

describe('T092 — cancelled state', () => {
  it('keeps the .cart-pane shell present', () => {
    setSignedIn();
    setCartCancelled();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={[]} />);
    expect(document.querySelector('.cart-pane')).not.toBeNull();
  });

  it('omits the handoff button in cancelled state', () => {
    setSignedIn();
    setCartCancelled();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />);
    expect(document.querySelector('[data-testid="cart-handoff-button"]')).toBeNull();
  });
});

// ── Shell-slot invariants ──────────────────────────────────────────────────────

describe('T092 — shell invariants across states', () => {
  it('CartPane is a <section> element with aria-label="Cart"', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={[]} />);
    const pane = document.querySelector('.cart-pane');
    expect(pane?.tagName).toBe('SECTION');
    expect(pane?.getAttribute('aria-label')).toBe('Cart');
  });

  it('Cart header label is present in editing and frozen states', () => {
    setSignedIn();
    setCartEditing();
    const { unmount } = render(
      <CartPane _testBridge={makeBridge()} _testInitialLines={SAMPLE_LINES} />,
    );
    expect(document.querySelector('.cart-pane__title')?.textContent).toMatch(/cart/i);
    unmount();

    setCartFrozen();
    render(
      <CartPane
        _testBridge={makeBridge()}
        _testInitialLines={[]}
        _testInitialEnvelope={makeEnvelope()}
      />,
    );
    expect(document.querySelector('.cart-pane__title')?.textContent).toMatch(/cart/i);
  });
});
