import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  ProductSearchInput,
  SearchResultList,
  ProductConfirmPanel,
  NotFoundState,
  CatalogueUnavailableState,
  AmbiguousBarcodeState,
} from '../index.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';
import { expectNoAxeViolations } from '../../primitives/__tests__/axe-config.js';

/**
 * 009-product-search-and-barcode-lookup T019 — S1 shell accessibility.
 *
 * axe-clean across the idle + the three error surfaces (plus the confirm panel
 * and a populated result list), keyboard-operable actions at the 44×44 floor
 * (P14 / NFR-5), and colour-independence (icon decorative + text carries the
 * meaning). Error surfaces must NOT steal focus on mount (the cashier may be
 * mid-entry) — same posture as 008's failure banners.
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

afterEach(() => {
  cleanup();
});

describe('T019 — catalogue shell accessibility (axe-clean)', () => {
  it('ProductSearchInput (idle) is axe-clean', async () => {
    const { container } = render(<ProductSearchInput />);
    await expectNoAxeViolations(container);
  });

  it('NotFoundState is axe-clean', async () => {
    const { container } = render(<NotFoundState query="6221000000000" onEdit={() => {}} />);
    await expectNoAxeViolations(container);
  });

  it('CatalogueUnavailableState is axe-clean', async () => {
    const { container } = render(<CatalogueUnavailableState />);
    await expectNoAxeViolations(container);
  });

  it('AmbiguousBarcodeState is axe-clean', async () => {
    const { container } = render(<AmbiguousBarcodeState onEdit={() => {}} />);
    await expectNoAxeViolations(container);
  });

  it('ProductConfirmPanel is axe-clean', async () => {
    const { container } = render(
      <ProductConfirmPanel product={PRODUCT} onAdd={() => {}} onCancel={() => {}} />,
    );
    await expectNoAxeViolations(container);
  });

  it('SearchResultList (populated) is axe-clean', async () => {
    const { container } = render(<SearchResultList items={[PRODUCT]} selectedIndex={0} />);
    await expectNoAxeViolations(container);
  });
});

describe('T019 — keyboard operability + 44×44 floor (NFR-5 / P14)', () => {
  it('NotFoundState Edit button carries the 44×44 size modifier and is focusable', () => {
    render(<NotFoundState query="x" onEdit={() => {}} />);
    const btn = screen.getByRole('button', { name: /edit|تعديل/i });
    expect(btn.className).toMatch(/btn--md/);
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it('ProductConfirmPanel Add + Cancel both carry the 44×44 size modifier', () => {
    render(<ProductConfirmPanel product={PRODUCT} onAdd={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /add|إضافة/i }).className).toMatch(/btn--md/);
    expect(screen.getByRole('button', { name: /cancel|إلغاء/i }).className).toMatch(/btn--md/);
  });
});

describe('T019 — error surfaces do not steal focus on mount', () => {
  it('NotFoundState does not auto-focus its Edit button', () => {
    render(<NotFoundState query="x" onEdit={() => {}} />);
    expect(screen.getByRole('button', { name: /edit|تعديل/i })).not.toHaveFocus();
  });

  it('AmbiguousBarcodeState does not auto-focus its Edit button', () => {
    render(<AmbiguousBarcodeState onEdit={() => {}} />);
    expect(screen.getByRole('button', { name: /edit|تعديل/i })).not.toHaveFocus();
  });
});

describe('T019 — colour-independence (icon decorative, text carries meaning)', () => {
  it('CatalogueUnavailableState conveys state via heading text, not colour alone', () => {
    const { container } = render(<CatalogueUnavailableState />);
    // The icon is aria-hidden (decorative); meaning lives in the heading text.
    expect(container.querySelector('.catalogue-state__icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByRole('heading', { name: /unavailable|غير متاح/i })).toBeInTheDocument();
  });

  it('AmbiguousBarcodeState conveys state via heading text, not colour alone', () => {
    const { container } = render(<AmbiguousBarcodeState />);
    expect(container.querySelector('.catalogue-state__icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(
      screen.getByRole('heading', { name: /more than one product|أكثر من منتج/i }),
    ).toBeInTheDocument();
  });
});
