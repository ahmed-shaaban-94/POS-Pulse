/**
 * 005-sales-cart T052 — CartPane live line list tests.
 *
 * Covers:
 *   1. When cart is empty, EmptyCartPlaceholder is shown (regression guard).
 *   2. When cart has lines in local state, renders LineItemRow for each.
 *   3. Subtotal footer shows computed Σ of line subtotals when lines present.
 *   4. Subtotal shows "—" placeholder when cart is empty.
 *   5. When sessionKind !== 'signedIn', CartPane returns null (regression guard).
 *   6. onLineAdded callback appends a new line when merged=false.
 *   7. onLineAdded callback updates existing line subtotal+version when merged=true.
 *
 * NOTE: CartPane manages its own useState<LineItem[]> for the live line list.
 * These tests use CartPane's exported addLineToDisplay / replaceLines helpers
 * via test-only props OR test the rendered output after a simulated add call.
 *
 * Architecture: CartPane maintains a local line list updated from bridge call
 * results. The Zustand cartStore tracks only FSM state. This test validates
 * the rendered output without coupling to internals.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CartPane } from '../../../../../src/renderer/ui/cart/CartPane.js';
import { useCartStore } from '../../../../../src/renderer/stores/cart-store.js';
import { useOperatorSessionStore } from '../../../../../src/renderer/stores/operator-session-store.js';

function setSignedIn() {
  useOperatorSessionStore.setState({
    state: {
      kind: 'signedIn',
      session: {
        id: 'sess-1',
        operator_id: 'op-1',
        display_name: 'Ali',
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

afterEach(() => {
  cleanup();
  useCartStore.getState().reset();
  setSignedOut();
});

describe('T052 — CartPane empty cart state', () => {
  it('renders null when operator is not signed in', () => {
    setSignedOut();
    const { container } = render(<CartPane />);
    expect(container.firstChild).toBeNull();
  });

  it('shows EmptyCartPlaceholder when no active cart', () => {
    setSignedIn();
    render(<CartPane />);
    expect(screen.getByTestId('cart-empty-placeholder')).toBeInTheDocument();
  });

  it('shows "—" subtotal when cart is empty', () => {
    setSignedIn();
    render(<CartPane />);
    // The span has aria-label="subtotal placeholder"; use querySelector
    const span = document.querySelector('[aria-label="subtotal placeholder"]');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('—');
  });
});

describe('T052 — CartPane with lines (via initialLines test prop)', () => {
  it('renders a LineItemRow for each initialLine when cart is in editing state', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    render(
      <CartPane
        _testInitialLines={[
          {
            lineId: 'line-1',
            displayName: 'Paracetamol 500mg',
            quantity: 2,
            unitPriceMinor: 150,
            lineSubtotalMinor: 300,
            note: null,
            version: 1,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('renders correct subtotal when lines are present', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    render(
      <CartPane
        _testInitialLines={[
          {
            lineId: 'line-1',
            displayName: 'Paracetamol 500mg',
            quantity: 2,
            unitPriceMinor: 150,
            lineSubtotalMinor: 300,
            note: null,
            version: 1,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤3.00');
  });

  it('does not show EmptyCartPlaceholder when lines are present', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    render(
      <CartPane
        _testInitialLines={[
          {
            lineId: 'line-1',
            displayName: 'Item A',
            quantity: 1,
            unitPriceMinor: 100,
            lineSubtotalMinor: 100,
            note: null,
            version: 1,
          },
        ]}
      />,
    );
    expect(screen.queryByTestId('cart-empty-placeholder')).not.toBeInTheDocument();
  });

  it('renders multiple LineItemRows for multiple lines', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    render(
      <CartPane
        _testInitialLines={[
          {
            lineId: 'line-1',
            displayName: 'Item A',
            quantity: 1,
            unitPriceMinor: 100,
            lineSubtotalMinor: 100,
            note: null,
            version: 1,
          },
          {
            lineId: 'line-2',
            displayName: 'Item B',
            quantity: 2,
            unitPriceMinor: 200,
            lineSubtotalMinor: 400,
            note: null,
            version: 1,
          },
        ]}
      />,
    );
    expect(screen.getAllByTestId('line-item-row')).toHaveLength(2);
  });

  it('shows correct Σ subtotal for multiple lines', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    render(
      <CartPane
        _testInitialLines={[
          {
            lineId: 'line-1',
            displayName: 'Item A',
            quantity: 1,
            unitPriceMinor: 100,
            lineSubtotalMinor: 100,
            note: null,
            version: 1,
          },
          {
            lineId: 'line-2',
            displayName: 'Item B',
            quantity: 2,
            unitPriceMinor: 200,
            lineSubtotalMinor: 400,
            note: null,
            version: 1,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤5.00');
  });
});

describe('T052 — CartPane FSM state: editing with empty initialLines', () => {
  it('does not show empty placeholder when cart is in editing state (no local lines yet)', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');
    render(<CartPane />);
    // Cart is editing (not empty) → placeholder is hidden; empty <ol> is shown instead.
    expect(screen.queryByTestId('cart-empty-placeholder')).not.toBeInTheDocument();
  });
});

describe('T052 — CartPane onLineAdded callback (cart.lines.add wiring)', () => {
  it('appends a new LineItemRow when onLineAdded called with merged=false', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    let addLine!: (res: {
      line_id: string;
      display_name: string;
      unit_price_minor: number;
      line_subtotal_minor: number;
      version: number;
      merged: boolean;
    }) => void;

    render(
      <CartPane
        onLineAdded={(fn) => {
          addLine = fn;
        }}
      />,
    );

    act(() => {
      addLine({
        line_id: 'line-1',
        display_name: 'Paracetamol 500mg',
        unit_price_minor: 150,
        line_subtotal_minor: 150,
        version: 1,
        merged: false,
      });
    });

    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('updates existing line subtotal and version when onLineAdded called with merged=true', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    let addLine!: (res: {
      line_id: string;
      display_name: string;
      unit_price_minor: number;
      line_subtotal_minor: number;
      version: number;
      merged: boolean;
    }) => void;

    render(
      <CartPane
        _testInitialLines={[
          {
            lineId: 'line-1',
            displayName: 'Paracetamol 500mg',
            quantity: 1,
            unitPriceMinor: 150,
            lineSubtotalMinor: 150,
            note: null,
            version: 1,
          },
        ]}
        onLineAdded={(fn) => {
          addLine = fn;
        }}
      />,
    );

    act(() => {
      addLine({
        line_id: 'line-1',
        display_name: 'Paracetamol 500mg',
        unit_price_minor: 150,
        line_subtotal_minor: 300,
        version: 2,
        merged: true,
      });
    });

    // Subtotal should reflect the merged line_subtotal_minor from the response
    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤3.00');
    // Still only one row
    expect(screen.getAllByTestId('line-item-row')).toHaveLength(1);
  });

  it('renders multiple rows when onLineAdded called twice with different line_ids', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    let addLine!: (res: {
      line_id: string;
      display_name: string;
      unit_price_minor: number;
      line_subtotal_minor: number;
      version: number;
      merged: boolean;
    }) => void;

    render(
      <CartPane
        onLineAdded={(fn) => {
          addLine = fn;
        }}
      />,
    );

    act(() => {
      addLine({
        line_id: 'line-1',
        display_name: 'Item A',
        unit_price_minor: 100,
        line_subtotal_minor: 100,
        version: 1,
        merged: false,
      });
      addLine({
        line_id: 'line-2',
        display_name: 'Item B',
        unit_price_minor: 200,
        line_subtotal_minor: 200,
        version: 1,
        merged: false,
      });
    });

    expect(screen.getAllByTestId('line-item-row')).toHaveLength(2);
    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤3.00');
  });
});
