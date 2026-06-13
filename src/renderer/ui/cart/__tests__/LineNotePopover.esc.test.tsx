import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { LineNotePopover } from '../LineNotePopover.js';

/**
 * Primitive-bypass audit P1 (#3) — LineNotePopover declares
 * role="dialog" aria-modal="true" but had no Escape handler. A keyboard-only
 * cashier could not dismiss it. WCAG 2.1.1. This asserts the Dialog-primitive
 * Esc behavior (Escape → onClose) now exists.
 */
afterEach(cleanup);

describe('LineNotePopover — Escape to close (audit P1)', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <LineNotePopover open currentNote={null} onSave={vi.fn()} onClose={onClose} />,
    );
    expect(screen.getByTestId('line-note-popover')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    render(<LineNotePopover open currentNote={null} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not register the handler when closed', () => {
    const onClose = vi.fn();
    render(<LineNotePopover open={false} currentNote={null} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
