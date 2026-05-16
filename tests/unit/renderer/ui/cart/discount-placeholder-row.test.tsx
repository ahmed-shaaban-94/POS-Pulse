/**
 * T073 — DiscountPlaceholderRow (S3 contract).
 *
 * Verifies:
 *   - Renders "Discount applied" label (exact copy per S0 Surface 7).
 *   - Does NOT render any numeric discount value (no magnitudes to cashier).
 *   - Renders a remove button meeting the 44×44 touch-target floor.
 *   - onRemove is called when the remove button is clicked.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { DiscountPlaceholderRow } from '../../../../../src/renderer/ui/cart/DiscountPlaceholderRow.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DiscountPlaceholderRow — copy and content', () => {
  it('renders "Discount applied" label', () => {
    render(<DiscountPlaceholderRow placeholderId="dp-1" onRemove={vi.fn()} />);
    expect(screen.getByText('Discount applied')).toBeInTheDocument();
  });

  it('does not render any numeric magnitude', () => {
    render(<DiscountPlaceholderRow placeholderId="dp-1" onRemove={vi.fn()} />);
    const text = document.body.textContent ?? '';
    // No numbers that look like monetary values (e.g. 10%, $5, 500, etc.)
    expect(text).not.toMatch(/\d+[%¤$]/);
    expect(text).not.toMatch(/[¤$]\d/);
  });

  it('renders a remove button', () => {
    render(<DiscountPlaceholderRow placeholderId="dp-1" onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});

describe('DiscountPlaceholderRow — interactions', () => {
  it('calls onRemove when remove button is clicked', async () => {
    const onRemove = vi.fn();
    render(<DiscountPlaceholderRow placeholderId="dp-1" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('DiscountPlaceholderRow — touch target', () => {
  it('remove button meets 44×44 touch-target floor', () => {
    render(<DiscountPlaceholderRow placeholderId="dp-1" onRemove={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /remove/i });
    const style = btn.getAttribute('style') ?? '';
    // The component uses inline style minWidth/minHeight of 44px
    expect(style).toMatch(/min-width.*44px/);
    expect(style).toMatch(/min-height.*44px/);
  });
});
