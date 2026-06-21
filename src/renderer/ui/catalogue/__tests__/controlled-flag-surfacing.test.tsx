import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ProductConfirmPanel } from '../ProductConfirmPanel.js';
import { SearchResultRow } from '../SearchResultRow.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

/**
 * 009 T045a (C1) — controlled / Rx flag SURFACING (display only).
 *
 * The confirm panel and the result row must SHOW the `controlled_substance` /
 * `prescription_required` flags so the cashier is aware. This is surfacing
 * ONLY — 009 enforces nothing (controlled-substance / prescription workflow is
 * explicitly Out-of-Scope in the spec). A product with both flags false shows
 * no badge.
 */

function product(overrides: Partial<ProductSnapshotDisplay> = {}): ProductSnapshotDisplay {
  return {
    product_id: 'p-1',
    display_name_ar: 'مورفين',
    price_minor: 5000,
    active: true,
    controlled_substance: false,
    prescription_required: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('ProductConfirmPanel — controlled/Rx surfacing (C1)', () => {
  it('shows a controlled-substance badge when the flag is set', () => {
    render(
      <ProductConfirmPanel product={product({ controlled_substance: true })} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId('flag-controlled-substance')).toBeInTheDocument();
  });

  it('shows a prescription-required badge when the flag is set', () => {
    render(
      <ProductConfirmPanel product={product({ prescription_required: true })} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId('flag-prescription-required')).toBeInTheDocument();
  });

  it('shows both badges when both flags are set', () => {
    render(
      <ProductConfirmPanel
        product={product({ controlled_substance: true, prescription_required: true })}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByTestId('flag-controlled-substance')).toBeInTheDocument();
    expect(screen.getByTestId('flag-prescription-required')).toBeInTheDocument();
  });

  it('shows no badge when neither flag is set', () => {
    render(<ProductConfirmPanel product={product()} onAdd={vi.fn()} />);
    expect(screen.queryByTestId('flag-controlled-substance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flag-prescription-required')).not.toBeInTheDocument();
  });
});

describe('SearchResultRow — controlled/Rx surfacing (C1)', () => {
  function renderRow(p: ProductSnapshotDisplay) {
    return render(<SearchResultRow product={p} id="opt-1" active={false} onSelect={vi.fn()} />);
  }

  it('shows a controlled-substance badge on the row when the flag is set', () => {
    renderRow(product({ controlled_substance: true }));
    const row = screen.getByRole('option');
    expect(within(row).getByTestId('flag-controlled-substance')).toBeInTheDocument();
  });

  it('shows a prescription-required badge on the row when the flag is set', () => {
    renderRow(product({ prescription_required: true }));
    const row = screen.getByRole('option');
    expect(within(row).getByTestId('flag-prescription-required')).toBeInTheDocument();
  });

  it('shows no badge on the row when neither flag is set', () => {
    renderRow(product());
    expect(screen.queryByTestId('flag-controlled-substance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flag-prescription-required')).not.toBeInTheDocument();
  });
});

describe('SearchResultRow — LTR-isolated numerics under RTL shell (PR #434 FIX 3)', () => {
  function renderRow(p: ProductSnapshotDisplay) {
    return render(<SearchResultRow product={p} id="opt-1" active={false} onSelect={vi.fn()} />);
  }

  it('the price span is dir="ltr" (money is Latin/mono — must not bidi-reorder)', () => {
    const { container } = renderRow(product({ price_minor: 12345 }));
    const price = container.querySelector('.catalogue-result-row__price');
    expect(price).not.toBeNull();
    expect(price).toHaveAttribute('dir', 'ltr');
  });

  it('the code (barcode/SKU) span is dir="ltr" (Latin/mono — must not bidi-reorder)', () => {
    const { container } = renderRow(product({ selling_barcode: '6224000123456' }));
    const code = container.querySelector('.catalogue-result-row__code');
    expect(code).not.toBeNull();
    expect(code).toHaveAttribute('dir', 'ltr');
  });
});
