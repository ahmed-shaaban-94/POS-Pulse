import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ManagerAttributionPrompt } from '../ManagerAttributionPrompt.js';

/**
 * Primitive-bypass audit P1 (#3) — ManagerAttributionPrompt declares
 * role="dialog" aria-modal="true" but had no Escape handler. WCAG 2.1.1.
 * Escape must call onCancel (the non-destructive dismiss).
 */
afterEach(cleanup);

describe('ManagerAttributionPrompt — Escape to cancel (audit P1)', () => {
  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel for other keys', () => {
    const onCancel = vi.fn();
    render(<ManagerAttributionPrompt onApprove={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'a' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
