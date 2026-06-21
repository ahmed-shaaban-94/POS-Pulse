import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { CatalogueSalePane } from '../CatalogueSalePane.js';
import { useCatalogueSearchStore } from '../../../stores/catalogueSearchStore.js';
import { useCartStore } from '../../../stores/cart-store.js';
import type { CartBridgeAPI, CatalogueBridgeAPI } from '../../../../shared/bridge-api.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

/**
 * POS v3.5 Slice 2 — catalogue sale-pane VISUAL recompose to the prototype
 * `SaleScreen` (catalogue side). These assertions pin the recompose contract
 * (the existing wiring/engine tests stay in `CatalogueSalePane.test.tsx`):
 *
 *   - the pane root + results region are RTL (Arabic-first systemic direction),
 *   - the search input carries an Arabic placeholder,
 *   - a result row shows `display_name_ar` (primary) + an LTR-isolated price,
 *   - an Rx / controlled product surfaces the NON-blocking awareness badge AND
 *     can still be confirmed-added (enforcement is out of scope — display only),
 *   - the deferred enrichment area renders an honest "not available yet" shell
 *     (POS-013: stock / expiry / interactions / bought-together / browse-grid
 *     have no contract data — the layout slot is present, the data is not
 *     fabricated).
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

const RX_PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-rx',
  display_name_ar: 'أموكسيسيلين 500 مجم',
  display_name_en: 'Amoxicillin 500mg',
  price_minor: 5200,
  unit_pack_label: '×16 كبسولة',
  selling_barcode: '6221000000048',
  active: true,
  controlled_substance: false,
  prescription_required: true,
};

function okAdd(over: Record<string, unknown> = {}) {
  return {
    kind: 'ok' as const,
    line_id: 'line-1',
    merged: false,
    version: 1,
    display_name: RX_PRODUCT.display_name_ar,
    unit_price_minor: RX_PRODUCT.price_minor,
    line_subtotal_minor: RX_PRODUCT.price_minor,
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
    refresh: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, reason: 'no_session' as const }),
    ),
    freshness: vi.fn(() =>
      Promise.resolve({ kind: 'ok' as const, last_success_at: null, is_empty: true }),
    ),
    counts: vi.fn(() => Promise.resolve({ kind: 'ok' as const, products: 0, barcodes: 0 })),
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

describe('v3.5 recompose — RTL + Arabic-first sale pane', () => {
  it('the pane root is RTL', () => {
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge()}
        cartBridge={cartBridge()}
      />,
    );
    expect(screen.getByTestId('catalogue-sale-pane')).toHaveAttribute('dir', 'rtl');
  });

  it('the search input carries an Arabic placeholder', () => {
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge()}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    // Arabic-first prompt — the placeholder begins with the Arabic verb "ابحث".
    expect(input.getAttribute('placeholder') ?? '').toMatch(/^ابحث/u);
  });

  it('the results region is RTL', async () => {
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
      expect(screen.getByTestId('search-result-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('search-result-list')).toHaveAttribute('dir', 'rtl');
  });
});

describe('v3.5 recompose — result row Arabic name + LTR-isolated price', () => {
  async function renderResults(product: ProductSnapshotDisplay) {
    const search = vi
      .fn()
      .mockResolvedValue({ kind: 'results', items: [product], truncated: false });
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
  }

  it('shows the Arabic display name as the primary line', async () => {
    await renderResults(PRODUCT);
    expect(screen.getByText('بنادول إكسترا 500 مجم')).toBeInTheDocument();
  });

  it('renders the price LTR-isolated (dir=ltr) so the numeral never mirrors', async () => {
    await renderResults(PRODUCT);
    const price = screen.getByText('¤ 15.00');
    expect(price).toHaveAttribute('dir', 'ltr');
  });

  it('renders the English secondary name LTR-isolated (dir=ltr)', async () => {
    await renderResults(PRODUCT);
    const en = screen.getByText('Panadol Extra 500mg');
    expect(en).toHaveAttribute('dir', 'ltr');
  });
});

describe('v3.5 recompose — Rx/controlled badge is NON-blocking', () => {
  it('surfaces the Rx awareness badge on the result row for a prescription product', async () => {
    const search = vi
      .fn()
      .mockResolvedValue({ kind: 'results', items: [RX_PRODUCT], truncated: false });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'أموكسيسيلين' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByTestId('flag-prescription-required')).toBeInTheDocument();
    });
  });

  it('an Rx product can STILL be confirmed-added — the badge gates nothing', async () => {
    const user = userEvent.setup();
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'one', product: RX_PRODUCT });
    const add = vi.fn().mockResolvedValue(okAdd());
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge({ add })}
      />,
    );
    const scan = screen.getByTestId('scan-capture-field');
    scan.focus();
    await user.keyboard('6221000000048{Enter}');

    // The confirm panel opens and STILL surfaces the Rx badge (awareness only)…
    await screen.findByRole('dialog');
    expect(screen.getByTestId('flag-prescription-required')).toBeInTheDocument();

    // …and the Add affordance is enabled and adds the Rx line (no Rx-ref capture,
    // no enforcement gate — out of scope per the 009 contract).
    const addBtn = screen.getByRole('button', { name: /إضافة|Add/ });
    expect(addBtn).not.toBeDisabled();
    addBtn.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ item_ref: 'p-rx', quantity: 1 }));
    });
  });
});

describe('v3.5 recompose — deferred enrichment shell (POS-013)', () => {
  it('renders an honest "not available yet" enrichment slot in idle (no fabricated data)', () => {
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge()}
        cartBridge={cartBridge()}
      />,
    );
    const shell = screen.getByTestId('catalogue-enrichment-shell');
    expect(shell).toBeInTheDocument();
    // The honesty copy: surfaced as "not available yet", NOT as live data.
    expect(shell).toHaveTextContent(/غير متاح بعد/);
    expect(shell).toHaveTextContent(/not available yet/i);
  });
});
