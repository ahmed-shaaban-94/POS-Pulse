/**
 * POS v3.5 Slice 3 — cart-pane VISUAL recompose to the prototype `SaleScreen`
 * (cart side, docs/design/pos-v3.5/design-reference/pos-app.jsx ~480–635).
 *
 * These assertions pin the recompose contract. The existing wiring/engine
 * tests (cart-pane-live-lines / -handoff / -sensitive-actions) stay green and
 * keep owning the FSM/bridge behaviour — this file only asserts the recomposed
 * SHAPE bound to the SAME engine:
 *
 *   - the pane is RTL (Arabic-first systemic direction), Arabic-first title,
 *   - the totals footer renders Subtotal (REAL, from lineSubtotalMinor) +
 *     VAT (tax-pending PLACEHOLDER — NOT a computed 14% figure) + Total
 *     (== subtotal until tax lands), money LTR-isolated mono,
 *   - the drug-interaction callout is an honest ENRICHMENT SHELL
 *     ("غير متاح بعد · not available yet") — INTERACTIONS data is not in the
 *     contract, so it is never fetched/fabricated,
 *   - the hold-sale (F3) affordance has NO engine path: it is rendered
 *     disabled (shell only), never functional,
 *   - hand-off binds to the EXISTING cart.handoff path,
 *   - the empty cart is the prototype's branded empty state.
 *
 * Money/ID isolation: under the RTL shell every money figure is dir="ltr".
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { CartBridgeAPI } from '../../../../../src/shared/bridge-api.js';
import { CartPane } from '../../../../../src/renderer/ui/cart/CartPane.js';
import type { CartLineItem } from '../../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../../src/renderer/stores/operator-session-store.js';
import { CartState } from '../../../../../src/shared/cart/cart-state.js';

function setSignedIn(role: 'cashier' | 'manager' | 'admin' = 'cashier') {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-r',
        operator_id: 'op-r',
        display_name: 'Test User',
        role,
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

function setCartEditing() {
  useCartStore.setState({
    activeCart: { cart_id: 'cart-r', state: CartState.editing, lastLineId: null },
  });
}

function makeBridge(overrides: Partial<CartBridgeAPI> = {}): CartBridgeAPI {
  return {
    create: vi.fn(),
    void: vi.fn().mockResolvedValue({ kind: 'ok' }),
    handoff: vi.fn().mockResolvedValue({ kind: 'ok', envelope: makeEnvelope() }),
    lines: {
      add: vi.fn(),
      update: vi.fn().mockResolvedValue({ kind: 'ok', version: 2 }),
      remove: vi.fn().mockResolvedValue({ kind: 'ok' }),
      setNote: vi.fn(),
    },
    discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
    ...overrides,
  } as unknown as CartBridgeAPI;
}

function makeEnvelope() {
  return {
    envelope_version: 'v1' as const,
    cart_id: 'cart-r',
    operator_session_id: 'sess-r',
    owning_operator_id: 'op-r',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'terminal-1',
    lines: [],
    discount_placeholders: [],
    subtotal_minor: 300,
    created_at: '2026-06-21T10:30:00.000Z',
    handoff_action_id: 'handoff-action-id',
  };
}

const oneLine: CartLineItem[] = [
  {
    lineId: 'line-1',
    displayName: 'باراسيتامول 500 مجم',
    quantity: 2,
    unitPriceMinor: 150,
    lineSubtotalMinor: 300,
    note: null,
    version: 1,
  },
];

afterEach(() => {
  cleanup();
  useCartStore.getState().reset();
  setSignedOut();
  vi.clearAllMocks();
});

// ── RTL shell + Arabic-first title ──────────────────────────────────────────

describe('v3.5 cart recompose — RTL shell + Arabic-first title', () => {
  it('the pane root is RTL (systemic Arabic-first direction)', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.getByTestId('cart-pane')).toHaveAttribute('dir', 'rtl');
  });

  it('the title is Arabic-first (نقطة البيع / السلة) yet retains a "Cart" companion for AT/parity', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} />);
    const title = document.querySelector('.cart-pane__title');
    expect(title?.textContent ?? '').toMatch(/السلة/u);
    // Bilingual companion keeps the accessible/region name parity (Cart).
    expect(title?.textContent ?? '').toMatch(/cart/i);
  });

  it('the section keeps its accessible name "Cart" (region parity)', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} />);
    expect(screen.getByTestId('cart-pane')).toHaveAttribute('aria-label', 'Cart');
  });
});

// ── Totals footer: real subtotal + tax-pending VAT placeholder + total ──────

describe('v3.5 cart recompose — totals footer (tax-pending, NOT a computed 14%)', () => {
  function renderWithLines() {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={oneLine} />);
  }

  it('renders the prototype .totals-rows footer with three rows', () => {
    renderWithLines();
    expect(document.querySelector('.totals-rows')).not.toBeNull();
    expect(document.querySelectorAll('.totals-rows .totals-row').length).toBe(3);
  });

  it('Subtotal row shows the REAL subtotal (Σ lineSubtotalMinor) LTR-isolated mono', () => {
    renderWithLines();
    const sub = screen.getByTestId('cart-subtotal-value');
    expect(sub).toHaveTextContent('¤3.00');
    expect(sub).toHaveAttribute('dir', 'ltr');
  });

  it('VAT row is an explicit tax-pending PLACEHOLDER — never a computed figure', () => {
    renderWithLines();
    const vat = screen.getByTestId('cart-vat-value');
    const vatText = vat.textContent;
    // The placeholder reads honestly as pending (em dash / tax-pending copy)…
    expect(vatText).toMatch(/—|tax-pending|قيد/u);
    // …and is NOT a money figure (no ¤/$ + digits) and NOT a 14% computation.
    expect(vatText).not.toMatch(/[¤$]\s?\d/u);
  });

  it('does NOT render the live 14% VAT figure the prototype computes (¤0.42 on a ¤3.00 base)', () => {
    renderWithLines();
    // 14% of 300 minor = 42 minor = ¤0.42. It must never appear.
    expect(document.body.textContent).not.toContain('¤0.42');
    // No row anywhere should claim a percentage-based VAT figure.
    const totals = document.querySelector('.totals-rows');
    expect(totals?.textContent ?? '').not.toMatch(/\d+(\.\d+)?\s*%/u);
  });

  it('Total row equals the subtotal (tax-pending: no fake VAT added) LTR-isolated mono', () => {
    renderWithLines();
    const total = screen.getByTestId('cart-total-value');
    expect(total).toHaveTextContent('¤3.00');
    expect(total).toHaveAttribute('dir', 'ltr');
  });

  it('the totals rows carry Arabic labels (subtotal / VAT / total)', () => {
    renderWithLines();
    const totals = document.querySelector('.totals-rows');
    expect(totals?.textContent ?? '').toMatch(/المجموع/u);
    expect(totals?.textContent ?? '').toMatch(/VAT|ض\.?ق\.?م|قيمة مضافة/u);
    expect(totals?.textContent ?? '').toMatch(/الإجمالي/u);
  });
});

// ── Drug-interaction callout: honest enrichment shell ───────────────────────

describe('v3.5 cart recompose — drug-interaction enrichment shell (no contract data)', () => {
  it('renders an honest "not available yet" interaction shell when lines are present', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={oneLine} />);
    const shell = screen.getByTestId('cart-interaction-shell');
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveTextContent(/غير متاح بعد/u);
    expect(shell).toHaveTextContent(/not available yet/i);
  });

  it('the interaction shell does NOT assert a live interaction warning (no fabricated data)', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={oneLine} />);
    const shell = screen.getByTestId('cart-interaction-shell');
    // It is a placeholder note, never an active alert claiming a real interaction.
    expect(shell).not.toHaveAttribute('role', 'alert');
  });
});

// ── Hold-sale (F3): shell only, NO engine path ──────────────────────────────

describe('v3.5 cart recompose — hold-sale is a disabled shell (no engine path)', () => {
  it('renders the cart-actions row with hold + hand-off', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={oneLine} />);
    expect(document.querySelector('.cart-actions-row')).not.toBeNull();
  });

  it('the hold-sale affordance is rendered DISABLED (never functional — no suspend/park action exists)', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={oneLine} />);
    const hold = screen.getByTestId('cart-hold-button');
    expect(hold).toBeDisabled();
  });

  it('clicking the hold shell does nothing (no bridge method is invoked)', async () => {
    const voidFn = vi.fn();
    const handoffFn = vi.fn();
    const bridge = makeBridge({ void: voidFn, handoff: handoffFn });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={bridge} _testInitialLines={oneLine} />);
    const hold = screen.getByTestId('cart-hold-button');
    // Disabled button: the click is a no-op. Assert no cart bridge method fired.
    await userEvent.click(hold);
    expect(voidFn).not.toHaveBeenCalled();
    expect(handoffFn).not.toHaveBeenCalled();
  });
});

// ── Hand-off binds to the EXISTING engine path ──────────────────────────────

describe('v3.5 cart recompose — hand-off binds to the existing cart.handoff', () => {
  it('the recomposed hand-off button still drives bridge.handoff', async () => {
    const handoff = vi.fn().mockResolvedValue({ kind: 'ok', envelope: makeEnvelope() });
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge({ handoff })} _testInitialLines={oneLine} />);
    await userEvent.click(screen.getByTestId('cart-handoff-button'));
    expect(handoff).toHaveBeenCalledTimes(1);
  });

  it('the hand-off button carries Arabic-first copy', () => {
    setSignedIn();
    setCartEditing();
    render(<CartPane _testBridge={makeBridge()} _testInitialLines={oneLine} />);
    expect(screen.getByTestId('cart-handoff-button').textContent).toMatch(/الدفع|انتقال/u);
  });
});

// ── Branded empty state ─────────────────────────────────────────────────────

describe('v3.5 cart recompose — branded empty state', () => {
  it('renders the prototype branded empty cart (Arabic title + bilingual hint)', () => {
    setSignedIn();
    render(<CartPane _testBridge={makeBridge()} />);
    const empty = screen.getByTestId('cart-empty-placeholder');
    expect(empty).toHaveTextContent(/السلة فارغة/u);
    expect(empty).toHaveTextContent(/Scan or tap an item to begin/i);
  });
});
