/**
 * T072 — ManagerAttributionPrompt dialog (S3 contract).
 *
 * Verifies:
 *   - Renders with generic copy per S0 contact sheet Surface 6.
 *   - Manager identity is NEVER shown to cashier (no names/IDs in display copy).
 *   - Manager ID and Credential inputs present (layout placeholder, no auth).
 *   - Cancel triggers onCancel; Approve triggers onApprove with entered Manager ID.
 *   - Approve button uses primary styling.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { ManagerAttributionPrompt } from '../../../../../src/renderer/ui/cart/ManagerAttributionPrompt.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ManagerAttributionPrompt — generic copy (S0 Surface 6)', () => {
  it('renders "Manager approval required"', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Manager approval required')).toBeInTheDocument();
  });

  it('renders "This action needs a manager."', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('This action needs a manager.')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Approve button', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('has a Manager ID input field', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Manager ID')).toBeInTheDocument();
  });

  it('has a Credential input field', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Credential')).toBeInTheDocument();
  });

  it('does not disclose manager name or identity in copy', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    const text = document.body.textContent ?? '';
    // Must not contain operator IDs, session IDs, or UUIDs
    expect(text).not.toMatch(/operator[-_]id|session[-_]id|[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});

describe('ManagerAttributionPrompt — interactions', () => {
  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onApprove with entered manager ID when Approve is clicked', async () => {
    const onApprove = vi.fn();
    render(<ManagerAttributionPrompt onApprove={onApprove} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Manager ID'), 'mgr-007');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledWith('mgr-007');
  });

  it('Approve button carries primary data attribute', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Approve' });
    expect(btn).toHaveAttribute('data-variant', 'primary');
  });
});

describe('ManagerAttributionPrompt — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
