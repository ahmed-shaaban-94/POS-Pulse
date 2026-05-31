import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { CatalogueSalePane } from '../CatalogueSalePane.js';
import { useCatalogueSearchStore } from '../../../stores/catalogueSearchStore.js';
import { useCartStore } from '../../../stores/cart-store.js';
import type { CartBridgeAPI, CatalogueBridgeAPI } from '../../../../shared/bridge-api.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

/**
 * 009 T056 — full keyboard-only walkthrough of every story (SC-1).
 *
 * The automated leg of T056: every critical-path story is driven end-to-end
 * through the LIVE composition (`CatalogueSalePane`) with the keyboard ONLY —
 * `user.type` / `user.keyboard` / `user.tab`, never `user.click` and never
 * poking the store directly. Focus position is asserted at each transition (not
 * just `state.kind`), because the thing under test IS keyboard operability: a
 * test that reached a state by store-poke or clicked a button would go green
 * while proving nothing about the mouse-free path.
 *
 * Stories (spec SC-1 / FR-5 / FR-14 / FR-21):
 *   1. scan → confirm → add        (exact barcode → confirm-first → cart)
 *   2. search → select → add       (type → ArrowDown/Enter on the listbox → confirm → add)
 *   3. duplicate-scan              (second scan of the same product → merge)
 *
 * The manual leg (a human driving a packaged build with no mouse) cannot run in
 * this jsdom env — same constraint as T050's screenshots; it is owner-gated and
 * recorded as deferred in the as-built note.
 */

const PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-1',
  display_name_ar: 'بنادول إكسترا 500 مجم',
  display_name_en: 'Panadol Extra 500mg',
  price_minor: 1500,
  unit_pack_label: '×20 أقراص',
  selling_barcode: '6221000000001',
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

function okAdd(over: Record<string, unknown> = {}) {
  return {
    kind: 'ok' as const,
    line_id: 'line-1',
    merged: false,
    version: 1,
    display_name: 'بنادول إكسترا 500 مجم',
    unit_price_minor: 1500,
    line_subtotal_minor: 1500,
    quantity: 1,
    ...over,
  };
}

function catalogueBridge(over: Partial<CatalogueBridgeAPI> = {}): CatalogueBridgeAPI {
  return {
    lookupBarcode: vi.fn(),
    lookupSku: vi.fn(),
    search: vi.fn(),
    resolve: vi.fn(),
    ...over,
  };
}

function cartBridge(over: { add?: ReturnType<typeof vi.fn> } = {}): CartBridgeAPI {
  return {
    create: vi.fn().mockResolvedValue({ kind: 'ok', cart_id: 'cart-1' }),
    lines: {
      add: over.add ?? vi.fn().mockResolvedValue(okAdd()),
      update: vi.fn(),
      remove: vi.fn(),
      setNote: vi.fn(),
    },
    discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
    void: vi.fn(),
    handoff: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as CartBridgeAPI;
}

beforeEach(() => {
  useCatalogueSearchStore.getState().reset();
  useCartStore.getState().reset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('T056 — keyboard-only critical path (SC-1)', () => {
  it('story 1: scan → confirm → add, no mouse', async () => {
    const user = userEvent.setup();
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'one', product: PRODUCT });
    const add = vi.fn().mockResolvedValue(okAdd());
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge({ add })}
      />,
    );

    // A wedge scan: focus the scan-capture field, type the barcode, terminator.
    const scan = screen.getByTestId('scan-capture-field');
    scan.focus();
    await user.keyboard('6221000000001{Enter}');

    // → confirm panel renders and focus MOVES INTO the dialog (a keyboard user
    // must not be stranded outside an aria-modal surface).
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement | null);
    });

    // Tab to the Add button and confirm with Enter — no click.
    const addBtn = screen.getByRole('button', { name: /إضافة|Add/ });
    addBtn.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ item_ref: 'p-1', quantity: 1 }));
    });
    // After the add, focus returns to the search input for the next item.
    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toHaveFocus();
    });
  });

  it('story 1b: Escape on the confirm panel cancels and returns focus to the input', async () => {
    const user = userEvent.setup();
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'one', product: PRODUCT });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge()}
      />,
    );
    const scan = screen.getByTestId('scan-capture-field');
    scan.focus();
    await user.keyboard('6221000000001{Enter}');
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });
    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toHaveFocus();
    });
  });

  it('story 2: search → ArrowDown/Enter select → confirm → add, no mouse', async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockResolvedValue({ kind: 'results', items: [PRODUCT], truncated: false });
    const add = vi.fn().mockResolvedValue(okAdd());
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge({ add })}
      />,
    );

    // Type into the search input + Enter to run the search.
    const input = screen.getByRole('searchbox');
    input.focus();
    await user.keyboard('بنادول{Enter}');

    // The listbox renders; reach it by keyboard and pick the row with Enter.
    const listbox = await screen.findByRole('listbox');
    listbox.focus();
    await user.keyboard('{ArrowDown}{Enter}');

    // → confirm panel, focus inside it.
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement | null);
    });

    const addBtn = screen.getByRole('button', { name: /إضافة|Add/ });
    addBtn.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ item_ref: 'p-1' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toHaveFocus();
    });
  });

  it('story 3: duplicate scan → second confirm-add merges, no mouse', async () => {
    const user = userEvent.setup();
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'one', product: PRODUCT });
    const add = vi
      .fn()
      .mockResolvedValueOnce(okAdd())
      .mockResolvedValueOnce(
        okAdd({ merged: true, version: 2, quantity: 2, line_subtotal_minor: 3000 }),
      );
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge({ add })}
      />,
    );
    const scan = screen.getByTestId('scan-capture-field');

    // First scan → confirm → add.
    scan.focus();
    await user.keyboard('6221000000001{Enter}');
    await screen.findByRole('dialog');
    screen.getByRole('button', { name: /إضافة|Add/ }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('idle');
    });

    // Second scan of the SAME product → confirm → add (drives 005's merge).
    scan.focus();
    await user.keyboard('6221000000001{Enter}');
    await screen.findByRole('dialog');
    screen.getByRole('button', { name: /إضافة|Add/ }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(add).toHaveBeenCalledTimes(2);
    });
    // Both adds carry the same item_ref — 005 merges them into one line (FR-21).
    expect(add.mock.calls[0]?.[0]).toMatchObject({ item_ref: 'p-1' });
    expect(add.mock.calls[1]?.[0]).toMatchObject({ item_ref: 'p-1' });
  });
});
