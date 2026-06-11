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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { CartBridgeAPI } from '../../../../../src/shared/bridge-api.js';
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
  vi.clearAllMocks();
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
      quantity: number;
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
        quantity: 1,
        version: 1,
        merged: false,
      });
    });

    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByTestId('qty-display')).toHaveTextContent('1');
  });

  it('updates existing line subtotal, quantity, and version when onLineAdded called with merged=true', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    let addLine!: (res: {
      line_id: string;
      display_name: string;
      unit_price_minor: number;
      line_subtotal_minor: number;
      quantity: number;
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
        quantity: 2,
        version: 2,
        merged: true,
      });
    });

    // Subtotal reflects the merged line_subtotal_minor
    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤3.00');
    // Quantity display updates from 1 to 2
    expect(screen.getByTestId('qty-display')).toHaveTextContent('2');
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
      quantity: number;
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
        quantity: 1,
        version: 1,
        merged: false,
      });
      addLine({
        line_id: 'line-2',
        display_name: 'Item B',
        unit_price_minor: 200,
        line_subtotal_minor: 200,
        quantity: 1,
        version: 1,
        merged: false,
      });
    });

    expect(screen.getAllByTestId('line-item-row')).toHaveLength(2);
    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤3.00');
  });
});

describe('T052 — CartPane add-to-cart advances FSM empty → editing (regression)', () => {
  // Regression for the production bug: clicking "Add" in the catalogue did
  // nothing visible. The bridge add succeeded and onLineAdded populated the
  // local `lines` array, but the cart FSM stayed `empty` because nothing
  // called applyLineAdded(). CartPane gates its render on activeCart.state
  // (showEmpty / canHandoff), NOT on lines.length — so the line list,
  // subtotal, and handoff button were all suppressed.
  //
  // These tests start from a freshly CREATED cart (state = empty), exactly as
  // CatalogueSalePane leaves it after cart.create — and DO NOT pre-seed the
  // FSM with applyLineAdded(). That is the difference from the tests above,
  // which masked the bug by advancing the FSM manually in setup.
  function makeAddedLine(over: Partial<Record<string, unknown>> = {}) {
    return {
      line_id: 'line-1',
      display_name: 'Paracetamol 500mg Tablets',
      unit_price_minor: 1250,
      line_subtotal_minor: 1250,
      quantity: 1,
      version: 1,
      merged: false,
      ...over,
    } as {
      line_id: string;
      display_name: string;
      unit_price_minor: number;
      line_subtotal_minor: number;
      quantity: number;
      version: number;
      merged: boolean;
    };
  }

  it('shows the added line row after onLineAdded on a freshly-created (empty) cart', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1'); // state = empty (NOT editing)

    let addLine!: (res: ReturnType<typeof makeAddedLine>) => void;
    render(<CartPane onLineAdded={(fn) => (addLine = fn)} />);

    // Precondition: empty cart shows the placeholder, hides the line list.
    expect(screen.getByTestId('cart-empty-placeholder')).toBeInTheDocument();

    act(() => {
      addLine(makeAddedLine());
    });

    expect(screen.queryByTestId('cart-empty-placeholder')).not.toBeInTheDocument();
    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg Tablets')).toBeInTheDocument();
    expect(screen.getByTestId('qty-display')).toHaveTextContent('1');
  });

  it('shows the computed subtotal (12.50) after the first add on an empty cart', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');

    let addLine!: (res: ReturnType<typeof makeAddedLine>) => void;
    render(<CartPane onLineAdded={(fn) => (addLine = fn)} />);

    act(() => {
      addLine(makeAddedLine());
    });

    expect(screen.getByTestId('cart-subtotal-value')).toHaveTextContent('¤12.50');
  });

  it('enables the handoff button after the first add on an empty cart', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');

    let addLine!: (res: ReturnType<typeof makeAddedLine>) => void;
    render(<CartPane onLineAdded={(fn) => (addLine = fn)} />);

    // Precondition: handoff disabled while empty.
    expect(screen.getByTestId('cart-handoff-button')).toBeDisabled();

    act(() => {
      addLine(makeAddedLine());
    });

    expect(screen.getByTestId('cart-handoff-button')).toBeEnabled();
  });

  it('advances the cart FSM from empty to editing on the first add', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    expect(useCartStore.getState().activeCart?.state).toBe('empty');

    let addLine!: (res: ReturnType<typeof makeAddedLine>) => void;
    render(<CartPane onLineAdded={(fn) => (addLine = fn)} />);

    act(() => {
      addLine(makeAddedLine());
    });

    expect(useCartStore.getState().activeCart?.state).toBe('editing');
    expect(useCartStore.getState().activeCart?.lastLineId).toBe('line-1');
  });
});

// ── Bridge handler tests (use _testBridge to avoid window.api) ──────────────

const INITIAL_LINE = {
  lineId: 'line-1',
  displayName: 'Paracetamol 500mg',
  quantity: 2,
  unitPriceMinor: 150,
  lineSubtotalMinor: 300,
  note: null as string | null,
  version: 1,
};

type BridgeLineOverrides = {
  remove?: CartBridgeAPI['lines']['remove'];
  update?: CartBridgeAPI['lines']['update'];
  setNote?: CartBridgeAPI['lines']['setNote'];
};

function makeTestBridge(overrides: BridgeLineOverrides = {}): CartBridgeAPI {
  return {
    lines: {
      remove: overrides.remove ?? vi.fn().mockResolvedValue({ kind: 'ok' }),
      update: overrides.update ?? vi.fn().mockResolvedValue({ kind: 'ok', version: 2 }),
      setNote: overrides.setNote ?? vi.fn().mockResolvedValue({ kind: 'ok', version: 2 }),
      add: vi.fn(),
    },
    create: vi.fn(),
    subscribe: vi.fn(),
    void: vi.fn(),
    discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
    handoff: vi.fn(),
  };
}

function renderWithLine(bridgeOverrides?: BridgeLineOverrides): { bridge: CartBridgeAPI } {
  setSignedIn();
  useCartStore.getState().applyCartCreated('cart-1');
  useCartStore.getState().applyLineAdded('line-1');
  const bridge = makeTestBridge(bridgeOverrides);
  render(<CartPane _testInitialLines={[INITIAL_LINE]} _testBridge={bridge} />);
  return { bridge };
}

describe('T052 — CartPane bridge: remove line', () => {
  it('removes the line row after remove ok response', async () => {
    const user = userEvent.setup();
    renderWithLine();
    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
    await user.click(screen.getByTestId('line-remove-btn'));
    expect(screen.queryByTestId('line-item-row')).not.toBeInTheDocument();
  });

  it('keeps the row when remove returns refusal', async () => {
    const user = userEvent.setup();
    renderWithLine({
      remove: vi.fn().mockResolvedValue({ kind: 'refused', reason: 'version_conflict' }),
    });
    await user.click(screen.getByTestId('line-remove-btn'));
    expect(screen.getByTestId('line-item-row')).toBeInTheDocument();
  });
});

describe('T052 — CartPane bridge: increment line', () => {
  it('increments displayed quantity after update ok response', async () => {
    const user = userEvent.setup();
    renderWithLine();
    expect(screen.getByTestId('qty-display')).toHaveTextContent('2');
    await user.click(screen.getByTestId('qty-increment'));
    expect(screen.getByTestId('qty-display')).toHaveTextContent('3');
  });

  it('keeps quantity unchanged when increment returns refusal', async () => {
    const user = userEvent.setup();
    renderWithLine({
      update: vi.fn().mockResolvedValue({ kind: 'refused', reason: 'version_conflict' }),
    });
    await user.click(screen.getByTestId('qty-increment'));
    expect(screen.getByTestId('qty-display')).toHaveTextContent('2');
  });
});

describe('T052 — CartPane bridge: decrement line', () => {
  it('decrements displayed quantity after update ok response', async () => {
    const user = userEvent.setup();
    renderWithLine();
    await user.click(screen.getByTestId('qty-decrement'));
    expect(screen.getByTestId('qty-display')).toHaveTextContent('1');
  });

  it('removes the row when decrement ok response and qty was 1', async () => {
    const user = userEvent.setup();
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');
    const bridge = makeTestBridge();
    render(
      <CartPane
        _testInitialLines={[{ ...INITIAL_LINE, quantity: 1, lineSubtotalMinor: 150 }]}
        _testBridge={bridge}
      />,
    );
    await user.click(screen.getByTestId('qty-decrement'));
    expect(screen.queryByTestId('line-item-row')).not.toBeInTheDocument();
  });

  it('keeps rows unchanged when decrement returns refusal', async () => {
    const user = userEvent.setup();
    renderWithLine({
      update: vi.fn().mockResolvedValue({ kind: 'refused', reason: 'version_conflict' }),
    });
    await user.click(screen.getByTestId('qty-decrement'));
    expect(screen.getByTestId('qty-display')).toHaveTextContent('2');
  });
});

describe('T052 — CartPane bridge: note popover', () => {
  it('opens note popover when note affordance clicked', async () => {
    const user = userEvent.setup();
    renderWithLine();
    await user.click(screen.getByTestId('line-note-add-btn'));
    expect(screen.getByTestId('line-note-popover')).toBeInTheDocument();
  });

  it('closes popover on cancel', async () => {
    const user = userEvent.setup();
    renderWithLine();
    await user.click(screen.getByTestId('line-note-add-btn'));
    await user.click(screen.getByTestId('note-cancel-btn'));
    expect(screen.queryByTestId('line-note-popover')).not.toBeInTheDocument();
  });

  it('saves note and closes popover on save ok', async () => {
    const user = userEvent.setup();
    renderWithLine();
    await user.click(screen.getByTestId('line-note-add-btn'));
    await user.type(screen.getByRole('textbox'), 'Crush tablet');
    await user.click(screen.getByTestId('note-save-btn'));
    expect(screen.queryByTestId('line-note-popover')).not.toBeInTheDocument();
    expect(screen.getByTestId('line-note-chip')).toHaveTextContent('Crush tablet');
  });

  it('shows error and keeps popover open when setNote returns refusal', async () => {
    const user = userEvent.setup();
    renderWithLine({
      setNote: vi.fn().mockResolvedValue({ kind: 'refused', reason: 'forbidden_content' }),
    });
    await user.click(screen.getByTestId('line-note-add-btn'));
    await user.type(screen.getByRole('textbox'), 'bad content');
    await user.click(screen.getByTestId('note-save-btn'));
    expect(screen.getByTestId('note-error')).toHaveTextContent('Note rejected');
    expect(screen.getByTestId('line-note-popover')).toBeInTheDocument();
  });
});

describe('T052 — CartPane bridge: multi-line non-target branches', () => {
  const SECOND_LINE = {
    lineId: 'line-2',
    displayName: 'Ibuprofen 200mg',
    quantity: 1,
    unitPriceMinor: 200,
    lineSubtotalMinor: 200,
    note: null as string | null,
    version: 1,
  };

  function renderWithTwoLines(): CartBridgeAPI {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');
    const bridge = makeTestBridge();
    render(<CartPane _testInitialLines={[INITIAL_LINE, SECOND_LINE]} _testBridge={bridge} />);
    return bridge;
  }

  it('increment on line-1 leaves line-2 unchanged (covers non-target map arm)', async () => {
    const user = userEvent.setup();
    renderWithTwoLines();
    const rows = screen.getAllByTestId('line-item-row');
    const increments = screen.getAllByTestId('qty-increment');
    await user.click(increments[0]);
    const qtyDisplays = screen.getAllByTestId('qty-display');
    expect(qtyDisplays[0]).toHaveTextContent('3');
    expect(qtyDisplays[1]).toHaveTextContent('1');
    expect(rows).toHaveLength(2);
  });

  it('decrement on line-1 leaves line-2 unchanged (covers non-target map arm)', async () => {
    const user = userEvent.setup();
    renderWithTwoLines();
    const decrements = screen.getAllByTestId('qty-decrement');
    await user.click(decrements[0]);
    const qtyDisplays = screen.getAllByTestId('qty-display');
    expect(qtyDisplays[0]).toHaveTextContent('1');
    expect(qtyDisplays[1]).toHaveTextContent('1');
  });

  it('save note on line-1 leaves line-2 unchanged (covers non-target setNote map arm)', async () => {
    const user = userEvent.setup();
    renderWithTwoLines();
    const addNoteButtons = screen.getAllByTestId('line-note-add-btn');
    await user.click(addNoteButtons[0]);
    await user.type(screen.getByRole('textbox'), 'note for line-1');
    await user.click(screen.getByTestId('note-save-btn'));
    expect(screen.getByTestId('line-note-chip')).toHaveTextContent('note for line-1');
    expect(screen.getAllByTestId('line-note-add-btn')).toHaveLength(1);
  });

  it('onLineAdded merged=true on line-1 leaves line-2 unchanged (covers non-target add map arm)', () => {
    setSignedIn();
    useCartStore.getState().applyCartCreated('cart-1');
    useCartStore.getState().applyLineAdded('line-1');

    let addLine!: (res: {
      line_id: string;
      display_name: string;
      unit_price_minor: number;
      line_subtotal_minor: number;
      quantity: number;
      version: number;
      merged: boolean;
    }) => void;

    render(
      <CartPane
        _testInitialLines={[INITIAL_LINE, SECOND_LINE]}
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
        line_subtotal_minor: 450,
        quantity: 3,
        version: 2,
        merged: true,
      });
    });

    const qtyDisplays = screen.getAllByTestId('qty-display');
    expect(qtyDisplays[0]).toHaveTextContent('3');
    expect(qtyDisplays[1]).toHaveTextContent('1');
  });
});
