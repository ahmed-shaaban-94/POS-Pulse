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
 * 009 T046 (FR-21) — duplicate scan INCREMENTS the existing line, not a 2nd line.
 *
 * 009 owns NO merge logic: a re-scan of the same product re-calls 005's
 * `cart.lines.add` with the SAME `item_ref` (= product_id). 005's Q4
 * merge-by-`item_ref` (cart-bridge.ts) increments the existing line and returns
 * `merged: true`. The controller simply forwards that confirmed result to
 * CartPane's `addLine`, which already handles the merged case (updates qty +
 * version in place). This test pins that the controller passes `merged: true`
 * through unchanged and re-uses the same `item_ref` on each scan.
 */

const PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-1',
  display_name_ar: 'بنادول',
  price_minor: 1500,
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

function makeBridge(responses: CartLinesAddResponse[]): {
  bridge: CartBridgeAPI;
  add: ReturnType<typeof vi.fn>;
} {
  const add = vi.fn();
  for (const r of responses) add.mockResolvedValueOnce(r);
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

function enterConfirmPending(product = PRODUCT): void {
  const store = useCatalogueSearchStore.getState();
  act(() => {
    store.beginSearch('بناد');
    store.resolveSingleMatch(product);
  });
}

beforeEach(() => {
  useCatalogueSearchStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('duplicate scan increments via 005 merge (FR-21 / T046)', () => {
  it('forwards a merged:true result through to onLineAdded with the incremented quantity', async () => {
    const user = userEvent.setup();
    const merged: CartLinesAddResponse = {
      kind: 'ok',
      line_id: 'line-1', // SAME line — 005 merged onto the existing one
      merged: true,
      version: 2,
      display_name: 'بنادول',
      unit_price_minor: 1500,
      line_subtotal_minor: 3000,
      quantity: 2,
    };
    const { bridge, add } = makeBridge([merged]);
    const addLine = vi.fn();

    enterConfirmPending();
    render(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={addLine} />);
    await user.click(screen.getByRole('button', { name: /إضافة|Add/ }));

    await waitFor(() => {
      expect(addLine).toHaveBeenCalledWith(
        expect.objectContaining({ line_id: 'line-1', merged: true, quantity: 2 }),
      );
    });
    // 009 added no special-casing — the same item_ref is what 005 merges on.
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ item_ref: 'p-1' }));
  });

  it('a second confirm-add of the same product re-uses the same item_ref (drives the merge)', async () => {
    const user = userEvent.setup();
    const first: CartLinesAddResponse = {
      kind: 'ok',
      line_id: 'line-1',
      merged: false,
      version: 1,
      display_name: 'بنادول',
      unit_price_minor: 1500,
      line_subtotal_minor: 1500,
      quantity: 1,
    };
    const second: CartLinesAddResponse = {
      ...first,
      merged: true,
      version: 2,
      quantity: 2,
      line_subtotal_minor: 3000,
    };
    const { bridge, add } = makeBridge([first, second]);
    const addLine = vi.fn();

    // First scan → confirm → add.
    enterConfirmPending();
    const view = render(
      <CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={addLine} />,
    );
    await user.click(screen.getByRole('button', { name: /إضافة|Add/ }));
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    // Second scan of the SAME product → confirm → add (re-render same controller).
    enterConfirmPending();
    view.rerender(<CatalogueAddController cartId="cart-1" bridge={bridge} onLineAdded={addLine} />);
    await user.click(screen.getByRole('button', { name: /إضافة|Add/ }));

    await waitFor(() => {
      expect(add).toHaveBeenCalledTimes(2);
    });
    // Both adds carry the same item_ref — 005 merges them into one line.
    expect(add.mock.calls[0]?.[0]).toMatchObject({ item_ref: 'p-1' });
    expect(add.mock.calls[1]?.[0]).toMatchObject({ item_ref: 'p-1' });
    // The second forwarded result is the merge.
    expect(addLine).toHaveBeenLastCalledWith(
      expect.objectContaining({ merged: true, quantity: 2 }),
    );
  });
});
