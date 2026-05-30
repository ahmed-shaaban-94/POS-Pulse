import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  ProductSearchInput,
  ScanCaptureField,
  SearchResultList,
  ProductConfirmPanel,
  NotFoundState,
  CatalogueUnavailableState,
  AmbiguousBarcodeState,
} from '../index.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

/**
 * 009-product-search-and-barcode-lookup T017 — S1 component shells render.
 *
 * Layout-only shells (S1): they render their structure, role, and copy with no
 * persistence/search/bridge logic (that lands S2–S4). The shells map 1:1 to the
 * S0 contact-sheet surfaces. This suite proves each renders in isolation with
 * the correct landmark role / test handle; the a11y + keyboard guarantees are in
 * `a11y.test.tsx` (T019).
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

// A product carrying only the required fields — exercises the optional-field
// (English name / unit-pack) false branches in the row + confirm panel.
const MINIMAL_PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-min',
  display_name_ar: 'دواء بسيط',
  price_minor: 700,
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

afterEach(() => {
  cleanup();
});

describe('T017 — catalogue component shells render', () => {
  it('ProductSearchInput renders a search input (idle)', () => {
    render(<ProductSearchInput />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('ScanCaptureField renders a wedge-capture field', () => {
    render(<ScanCaptureField />);
    expect(screen.getByTestId('scan-capture-field')).toBeInTheDocument();
  });

  it('SearchResultList renders the container with an empty placeholder when no items', () => {
    render(<SearchResultList />);
    // Empty: the container renders but NO listbox (a listbox with zero options
    // would violate aria-required-children). The listbox appears with results.
    expect(screen.getByTestId('search-result-list')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('SearchResultList renders a listbox with an option per item (Arabic-first name + price)', () => {
    render(<SearchResultList items={[PRODUCT]} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(screen.getByText('بنادول إكسترا 500 مجم')).toBeInTheDocument();
    expect(screen.getByText('¤ 15.00')).toBeInTheDocument(); // 1500 minor → integer-safe format
  });

  it('ProductConfirmPanel renders a dialog with the product + Add/Cancel (confirm-first)', () => {
    render(<ProductConfirmPanel product={PRODUCT} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('بنادول إكسترا 500 مجم')).toBeInTheDocument();
    expect(screen.getByText('¤ 15.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add|إضافة/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel|إلغاء/i })).toBeInTheDocument();
  });

  it('ProductConfirmPanel renders nothing when there is no pending product', () => {
    render(<ProductConfirmPanel />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ProductConfirmPanel handles a product without optional English name / pack label', () => {
    render(<ProductConfirmPanel product={MINIMAL_PRODUCT} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('دواء بسيط')).toBeInTheDocument();
    expect(screen.getByText('¤ 7.00')).toBeInTheDocument();
    expect(screen.queryByText('Panadol Extra 500mg')).not.toBeInTheDocument();
  });

  it('SearchResultList shows the refine hint when results are truncated', () => {
    render(<SearchResultList items={[MINIMAL_PRODUCT]} truncated />);
    expect(screen.getByText(/حسّن البحث/)).toBeInTheDocument();
  });

  it('NotFoundState renders a status surface echoing the scanned value', () => {
    render(<NotFoundState query="6221000000000" />);
    expect(screen.getByTestId('catalogue-not-found')).toBeInTheDocument();
    expect(screen.getByText(/6221000000000/)).toBeInTheDocument();
  });

  it('CatalogueUnavailableState renders an alert surface (system not ready)', () => {
    render(<CatalogueUnavailableState />);
    expect(screen.getByTestId('catalogue-unavailable')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('AmbiguousBarcodeState renders a resolve-in-catalogue surface', () => {
    render(<AmbiguousBarcodeState />);
    expect(screen.getByTestId('catalogue-ambiguous')).toBeInTheDocument();
  });
});
