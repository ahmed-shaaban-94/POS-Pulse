import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { SearchResultList } from '../SearchResultList.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

/**
 * 009 T038 — result-list keyboard navigation + row content (FR-14 / FR-17a).
 *
 * Keyboard model (aria-activedescendant): the listbox is focusable, ArrowDown/Up
 * move the active option, Enter selects the active row → `onSelect(product)`.
 * Each row shows the selling data: Arabic-first name, English fallback, price,
 * unit/pack, and the barcode or SKU where useful. When truncated, a refine hint
 * is shown.
 */

const A: ProductSnapshotDisplay = {
  product_id: 'p-a',
  display_name_ar: 'بنادول',
  display_name_en: 'Panadol',
  price_minor: 1500,
  unit_pack_label: '×20 أقراص',
  sku: 'SKU-A',
  selling_barcode: '6221000000001',
  active: true,
  controlled_substance: false,
  prescription_required: false,
};
const B: ProductSnapshotDisplay = {
  product_id: 'p-b',
  display_name_ar: 'أسبرين',
  price_minor: 800,
  sku: 'SKU-B',
  active: true,
  controlled_substance: false,
  prescription_required: false,
};
const C: ProductSnapshotDisplay = {
  product_id: 'p-c',
  display_name_ar: 'فيتامين سي',
  price_minor: 500,
  sku: 'SKU-C',
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

afterEach(() => {
  cleanup();
});

/** The nth option element, with a presence assertion (no non-null assertion). */
function optionAt(index: number): HTMLElement {
  const options = screen.getAllByRole('option');
  const option = options.at(index);
  if (option === undefined) throw new Error(`no option at index ${String(index)}`);
  return option;
}

/** The id of the active option, per the listbox's aria-activedescendant. */
function activeDescendantId(): string | null {
  return screen.getByRole('listbox').getAttribute('aria-activedescendant');
}

describe('SearchResultList — row content (FR-17a)', () => {
  it('renders the Arabic-first name, English fallback, price and unit/pack', () => {
    render(<SearchResultList items={[A]} onSelect={vi.fn()} />);
    const option = screen.getByRole('option');
    expect(within(option).getByText('بنادول')).toBeInTheDocument();
    expect(within(option).getByText('Panadol')).toBeInTheDocument();
    expect(within(option).getByText(/1500|15\.00|¤ 15\.00/)).toBeInTheDocument();
    expect(within(option).getByText('×20 أقراص')).toBeInTheDocument();
  });

  it('shows the barcode or SKU on the row where useful', () => {
    render(<SearchResultList items={[A, B]} onSelect={vi.fn()} />);
    // A has a selling barcode; B has only an SKU.
    expect(within(optionAt(0)).getByText(/6221000000001/)).toBeInTheDocument();
    expect(within(optionAt(1)).getByText(/SKU-B/)).toBeInTheDocument();
  });
});

describe('SearchResultList — keyboard navigation (FR-14)', () => {
  it('marks the first row active on mount via aria-activedescendant', () => {
    render(<SearchResultList items={[A, B, C]} onSelect={vi.fn()} />);
    expect(activeDescendantId()).toBe(optionAt(0).id);
    expect(optionAt(0)).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown moves the active option to the next row', () => {
    render(<SearchResultList items={[A, B, C]} onSelect={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });

    expect(activeDescendantId()).toBe(optionAt(1).id);
    expect(optionAt(1)).toHaveAttribute('aria-selected', 'true');
    expect(optionAt(0)).toHaveAttribute('aria-selected', 'false');
  });

  it('ArrowUp moves the active option to the previous row', () => {
    render(<SearchResultList items={[A, B, C]} onSelect={vi.fn()} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' }); // → B
    fireEvent.keyDown(listbox, { key: 'ArrowUp' }); // → A

    expect(activeDescendantId()).toBe(optionAt(0).id);
  });

  it('does not move past the last row (ArrowDown clamps at the end)', () => {
    render(<SearchResultList items={[A, B]} onSelect={vi.fn()} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' }); // → B (last)
    fireEvent.keyDown(listbox, { key: 'ArrowDown' }); // clamp

    expect(activeDescendantId()).toBe(optionAt(1).id);
  });

  it('does not move before the first row (ArrowUp clamps at the start)', () => {
    render(<SearchResultList items={[A, B]} onSelect={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowUp' }); // clamp at A

    expect(activeDescendantId()).toBe(optionAt(0).id);
  });

  it('Enter selects the active row via onSelect', () => {
    const onSelect = vi.fn();
    render(<SearchResultList items={[A, B, C]} onSelect={onSelect} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' }); // active → B
    fireEvent.keyDown(listbox, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(B);
  });

  it('clicking a row selects that product', () => {
    const onSelect = vi.fn();
    render(<SearchResultList items={[A, B]} onSelect={onSelect} />);
    fireEvent.click(optionAt(1));
    expect(onSelect).toHaveBeenCalledWith(B);
  });
});

describe('SearchResultList — truncation hint (FR-17)', () => {
  it('shows the refine hint when truncated', () => {
    render(<SearchResultList items={[A]} truncated onSelect={vi.fn()} />);
    expect(screen.getByText(/حسّن البحث|refine/i)).toBeInTheDocument();
  });

  it('does not show the refine hint when not truncated', () => {
    render(<SearchResultList items={[A]} onSelect={vi.fn()} />);
    expect(screen.queryByText(/حسّن البحث|refine/i)).not.toBeInTheDocument();
  });
});

describe('SearchResultList — defensive branches', () => {
  it('renders an empty-state placeholder (no listbox) when there are no items', () => {
    render(<SearchResultList items={[]} onSelect={vi.fn()} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('لا توجد نتائج لعرضها')).toBeInTheDocument();
  });

  it('does not throw on Enter/arrow with no onSelect handler (optional-call arm)', () => {
    render(<SearchResultList items={[A, B]} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    // Enter with no onSelect must be a safe no-op.
    expect(() => fireEvent.keyDown(listbox, { key: 'Enter' })).not.toThrow();
  });

  it('clicking a row with no onSelect handler is a safe no-op', () => {
    render(<SearchResultList items={[A]} />);
    expect(() => fireEvent.click(optionAt(0))).not.toThrow();
  });

  it('ignores unrelated keys on the listbox (no active-index change)', () => {
    render(<SearchResultList items={[A, B, C]} onSelect={vi.fn()} />);
    const listbox = screen.getByRole('listbox');
    const before = activeDescendantId();
    fireEvent.keyDown(listbox, { key: 'Tab' });
    expect(activeDescendantId()).toBe(before);
  });
});
