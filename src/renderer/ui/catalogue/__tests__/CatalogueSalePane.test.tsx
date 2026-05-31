import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CatalogueSalePane } from '../CatalogueSalePane.js';
import { useCatalogueSearchStore } from '../../../stores/catalogueSearchStore.js';
import { useCartStore } from '../../../stores/cart-store.js';
import type { CartBridgeAPI, CatalogueBridgeAPI } from '../../../../shared/bridge-api.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

const PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-1',
  display_name_ar: 'بنادول إكسترا',
  price_minor: 1500,
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

function catalogueBridge(over: Partial<CatalogueBridgeAPI> = {}): CatalogueBridgeAPI {
  return {
    lookupBarcode: vi.fn(),
    lookupSku: vi.fn(),
    search: vi.fn(),
    resolve: vi.fn(),
    ...over,
  };
}

function cartBridge(): CartBridgeAPI {
  return {
    create: vi.fn().mockResolvedValue({ kind: 'ok', cart_id: 'cart-1' }),
    lines: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
    discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
    void: vi.fn(),
    handoff: vi.fn(),
    subscribe: vi.fn(),
  };
}

beforeEach(() => {
  useCatalogueSearchStore.getState().reset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CatalogueSalePane — typed search → FSM (T049a wiring a)', () => {
  it('a typed search calls catalogue.search and drives the FSM to results', async () => {
    const search = vi
      .fn()
      .mockResolvedValue({ kind: 'results', items: [PRODUCT], truncated: false });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'بنادول' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith({ query: 'بنادول' });
    });
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('results');
    });
  });

  it('maps catalogue_unavailable search response to the FSM', async () => {
    const search = vi.fn().mockResolvedValue({ kind: 'catalogue_unavailable' });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('catalogue_unavailable');
    });
  });

  it('maps not_found search response to the FSM', async () => {
    const search = vi.fn().mockResolvedValue({ kind: 'not_found' });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('not_found');
    });
  });
});

describe('CatalogueSalePane — scan → exact lookup → FSM (T049a wiring a)', () => {
  it('a scan calls catalogue.lookupBarcode and a single match → confirm_pending', async () => {
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
    fireEvent.change(scan, { target: { value: '6221000000001' } });
    fireEvent.keyDown(scan, { key: 'Enter' });
    await waitFor(() => {
      expect(lookupBarcode).toHaveBeenCalledWith({ barcode: '6221000000001' });
    });
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('confirm_pending');
    });
  });

  it('an ambiguous scan → ambiguous state (FR-7)', async () => {
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'ambiguous' });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge()}
      />,
    );
    const scan = screen.getByTestId('scan-capture-field');
    fireEvent.change(scan, { target: { value: '111' } });
    fireEvent.keyDown(scan, { key: 'Enter' });
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('ambiguous');
    });
  });

  it('a result-row click → selectResult → confirm_pending', async () => {
    const search = vi
      .fn()
      .mockResolvedValue({ kind: 'results', items: [PRODUCT], truncated: false });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'بنادول' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option'));
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('confirm_pending');
    });
  });
});

describe('CatalogueSalePane — eager cart lifecycle (T049a wiring b)', () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it('creates a cart on mount when none exists, then records it in the store', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'ok', cart_id: 'cart-new' });
    const cb = {
      create,
      lines: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
      discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
      void: vi.fn(),
      handoff: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as CartBridgeAPI;

    render(
      <CatalogueSalePane
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge()}
        cartBridge={cb}
      />,
    );

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(useCartStore.getState().activeCart?.cart_id).toBe('cart-new');
    });
  });

  it('does NOT create a cart when one already exists', async () => {
    useCartStore.getState().applyCartCreated('cart-existing');
    const create = vi.fn();
    const cb = {
      create,
      lines: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
      discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
      void: vi.fn(),
      handoff: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as CartBridgeAPI;

    render(
      <CatalogueSalePane
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge()}
        cartBridge={cb}
      />,
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(create).not.toHaveBeenCalled();
  });
});
