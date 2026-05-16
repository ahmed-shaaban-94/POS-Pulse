/**
 * T071 — VoidConfirmation dialog (S3 contract).
 *
 * Verifies:
 *   - Renders with generic copy per S0 contact sheet Surface 5.
 *   - No cart ID, session ID, or item list in rendered output.
 *   - Cancel triggers onCancel; Void cart triggers onConfirm.
 *   - Escape key triggers onCancel.
 *   - "Void cart" button has danger styling indicator.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { VoidConfirmation } from '../../../../../src/renderer/ui/cart/VoidConfirmation.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('VoidConfirmation — generic copy (S0 Surface 5)', () => {
  it('renders the exact headline', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Void this cart?')).toBeInTheDocument();
  });

  it('renders "This action cannot be undone."', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('renders "All items will be removed."', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('All items will be removed.')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders "Void cart" button', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Void cart' })).toBeInTheDocument();
  });

  it('does not leak cart ID or session ID', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const text = document.body.textContent;
    expect(text).not.toMatch(/cart[-_]id|session[-_]id|[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});

describe('VoidConfirmation — interactions', () => {
  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when "Void cart" is clicked', async () => {
    const onConfirm = vi.fn();
    render(<VoidConfirmation onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Void cart' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Escape key is pressed', async () => {
    const onCancel = vi.fn();
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel for non-Escape key presses', async () => {
    const onCancel = vi.fn();
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Enter}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('"Void cart" button carries danger data attribute', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Void cart' });
    expect(btn).toHaveAttribute('data-variant', 'danger');
  });
});

describe('VoidConfirmation — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    render(<VoidConfirmation onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
