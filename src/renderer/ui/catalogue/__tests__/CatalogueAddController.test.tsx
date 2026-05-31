import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { CatalogueAddController } from '../CatalogueAddController.js';
import { useCatalogueSearchStore } from '../../../stores/catalogueSearchStore.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';
import type { CartBridgeAPI } from '../../../../shared/bridge-api.js';
import type { CartLinesAddResponse } from '../../../../shared/cart/bridge-types.js';

/**
 * 009 T044 — confirm-first add flow (FR-5 / FR-19 / FR-20 / FR-22).
 *
 * The `CatalogueAddController` wraps `ProductConfirmPanel`. It renders the panel
 * only while the catalogue FSM is in `confirm_pending`. On Add it calls 005's
 * `cart.lines.add` (the ONLY cart-mutation path, FR-20) with
 * `item_ref = product.product_id`, quantity 1 (confirm-first, FR-5). On a
 * bridge `ok` it forwards the result to CartPane's `addLine` (the `onLineAdded`
 * contract) and clears the FSM to idle. On a `refused` it stays in
 * `confirm_pending`, shows a GENERIC block, and adds NOTHING (no partial line).
 *
 * Tests inject the bridge (`bridge` prop, mirroring CartPane's `_testBridge`)
 * and the `addLine` callback — so S4b stays decoupled from S4a's real resolver.
 */

const PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-1',
  display_name_ar: 'بنادول إكسترا',
  display_name_en: 'Panadol Extra',
  price_minor: 1500,
  unit_pack_label: '×20 أقراص',
  sku: 'SKU-PARA-500',
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

const OK_RESPONSE: CartLinesAddResponse = {
  kind: 'ok',
  line_id: 'line-1',
  merged: false,
  version: 1,
  display_name: 'بنادول إكسترا',
  unit_price_minor: 1500,
  line_subtotal_minor: 1500,
  quantity: 1,
};

/** A bridge whose `lines.add` returns a scripted response; other methods throw. */
function bridgeWith(addResponse: CartLinesAddResponse): {
  bridge: CartBridgeAPI;
  add: ReturnType<typeof vi.fn>;
} {
  const add = vi.fn().mockResolvedValue(addResponse);
  const bridge = {
    create: vi.fn(),
    lines: { add, update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
    discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
    void: vi.fn(),
    handoff: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as CartBridgeAPI;
  return { bridge, add };
}

beforeEach(() => {
  useCatalogueSearchStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Put the FSM into confirm_pending for PRODUCT (the path the cashier reaches). */
function enterConfirmPending(product = PRODUCT): void {
  const store = useCatalogueSearchStore.getState();
  act(() => {
    store.beginSearch('بناد');
    store.resolveSingleMatch(product);
  });
}

describe('CatalogueAddController — render gating', () => {
  it('renders nothing when the FSM is idle (no pending product)', () => {
    const { bridge } = bridgeWith(OK_RESPONSE);
    const { container } = render(
      <CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the confirm panel for the pending product', () => {
    const { bridge } = bridgeWith(OK_RESPONSE);
    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={vi.fn()} />);
    expect(screen.getByTestId('product-confirm-panel')).toBeInTheDocument();
    expect(screen.getByText('بنادول إكسترا')).toBeInTheDocument();
  });
});

describe('CatalogueAddController — confirm-first add (FR-5 / FR-20)', () => {
  it('does NOT call the bridge before the cashier confirms (no add on render)', () => {
    const { bridge, add } = bridgeWith(OK_RESPONSE);
    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={vi.fn()} />);
    expect(add).not.toHaveBeenCalled();
  });

  it('on Add → calls cart.lines.add with item_ref=product_id, quantity 1', async () => {
    const user = userEvent.setup();
    const { bridge, add } = bridgeWith(OK_RESPONSE);
    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /إضافة|Add/ }));

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ cart_id: 'cart-1', item_ref: 'p-1', quantity: 1 }),
    );
    // A real idempotency key is supplied.
    const arg = add.mock.calls[0]?.[0] as { idempotency_key?: string };
    expect(typeof arg.idempotency_key).toBe('string');
    expect(arg.idempotency_key?.length).toBeGreaterThan(0);
  });

  it('on bridge ok → forwards the result to onLineAdded then clears the FSM to idle', async () => {
    const user = userEvent.setup();
    const { bridge } = bridgeWith(OK_RESPONSE);
    const addLine = vi.fn();
    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={addLine} />);

    await user.click(screen.getByRole('button', { name: /إضافة|Add/ }));

    await waitFor(() => {
      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ line_id: 'line-1', display_name: 'بنادول إكسترا', quantity: 1 }),
      );
    });
    expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
  });
});

describe('CatalogueAddController — refusal (FR-19 / FR-22)', () => {
  it('on bridge refused → shows a generic block, adds nothing, stays in confirm_pending', async () => {
    const user = userEvent.setup();
    const { bridge } = bridgeWith({ kind: 'refused', reason: 'wrong_owner' });
    const addLine = vi.fn();
    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={addLine} />);

    await user.click(screen.getByRole('button', { name: /إضافة|Add/ }));

    // A generic, non-leaking block is shown (no reason detail).
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // No partial line, no FSM advance.
    expect(addLine).not.toHaveBeenCalled();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('confirm_pending');
  });
});

describe('CatalogueAddController — re-entrancy', () => {
  it('guards against a double-tap: two clicks before the first add resolves call the bridge once', async () => {
    const user = userEvent.setup();
    // A deferred add: resolves only when we release it, so a second click lands
    // while the first is still in-flight (exercises the `if (adding) return`).
    let release!: (r: CartLinesAddResponse) => void;
    const pending = new Promise<CartLinesAddResponse>((res) => {
      release = res;
    });
    const add = vi.fn().mockReturnValue(pending);
    const bridge = {
      create: vi.fn(),
      lines: { add, update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
      discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
      void: vi.fn(),
      handoff: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as CartBridgeAPI;
    const addLine = vi.fn();

    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={addLine} />);
    const addBtn = screen.getByRole('button', { name: /إضافة|Add/ });

    await user.click(addBtn); // first add — now in-flight
    await user.click(addBtn); // second tap while in-flight — must be a no-op

    expect(add).toHaveBeenCalledTimes(1);

    // Release the first add; it completes normally.
    await act(async () => {
      release(OK_RESPONSE);
      await pending;
    });
    await waitFor(() => {
      expect(addLine).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CatalogueAddController — cancel', () => {
  it('on Cancel → clears the FSM to idle without calling the bridge', async () => {
    const user = userEvent.setup();
    const { bridge, add } = bridgeWith(OK_RESPONSE);
    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /إلغاء|Cancel/ }));

    expect(add).not.toHaveBeenCalled();
    expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
  });
});
