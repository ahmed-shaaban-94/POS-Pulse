/**
 * 005-sales-cart T051 — LineNotePopover unit tests.
 *
 * Covers:
 *   1. Renders a textarea for note entry when open=true.
 *   2. Enforces 200-character maxLength (Q1).
 *   3. Calls onSave with trimmed note when Save is clicked.
 *   4. Calls onSave with null when Clear is clicked.
 *   5. Calls onClose when Cancel is clicked.
 *   6. Does not render when open=false.
 *   7. textarea value reflects currentNote prop.
 *   8. Save button disabled when value matches currentNote (no change).
 *   9. data-testid="line-note-popover" when open.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { LineNotePopover } from '../../../../../src/renderer/ui/cart/LineNotePopover.js';

const BASE_PROPS = {
  open: true,
  currentNote: null as string | null,
  onSave: vi.fn(),
  onClose: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('T051 — LineNotePopover visibility', () => {
  it('renders when open=true', () => {
    render(<LineNotePopover {...BASE_PROPS} open={true} />);
    expect(screen.getByTestId('line-note-popover')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<LineNotePopover {...BASE_PROPS} open={false} />);
    expect(screen.queryByTestId('line-note-popover')).not.toBeInTheDocument();
  });
});

describe('T051 — LineNotePopover textarea', () => {
  it('renders a textarea', () => {
    render(<LineNotePopover {...BASE_PROPS} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('textarea has maxLength of 200', () => {
    render(<LineNotePopover {...BASE_PROPS} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '200');
  });

  it('textarea is empty when currentNote is null', () => {
    render(<LineNotePopover {...BASE_PROPS} currentNote={null} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('textarea shows currentNote when provided', () => {
    render(<LineNotePopover {...BASE_PROPS} currentNote="Crush tablet" />);
    expect(screen.getByRole('textbox')).toHaveValue('Crush tablet');
  });
});

describe('T051 — LineNotePopover save action', () => {
  it('calls onSave with trimmed text on Save click', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<LineNotePopover {...BASE_PROPS} currentNote={null} onSave={onSave} />);
    await user.type(screen.getByRole('textbox'), '  Crush tablet  ');
    await user.click(screen.getByTestId('note-save-btn'));
    expect(onSave).toHaveBeenCalledWith('Crush tablet');
  });

  it('Save button is disabled when value has not changed from currentNote', () => {
    render(<LineNotePopover {...BASE_PROPS} currentNote="Crush tablet" />);
    expect(screen.getByTestId('note-save-btn')).toBeDisabled();
  });

  it('Save button is enabled after editing', async () => {
    const user = userEvent.setup();
    render(<LineNotePopover {...BASE_PROPS} currentNote={null} />);
    await user.type(screen.getByRole('textbox'), 'New note');
    expect(screen.getByTestId('note-save-btn')).not.toBeDisabled();
  });
});

describe('T051 — LineNotePopover clear action', () => {
  it('calls onSave with null when Clear is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<LineNotePopover {...BASE_PROPS} currentNote="Existing note" onSave={onSave} />);
    await user.click(screen.getByTestId('note-clear-btn'));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('Clear button is disabled when currentNote is null', () => {
    render(<LineNotePopover {...BASE_PROPS} currentNote={null} />);
    expect(screen.getByTestId('note-clear-btn')).toBeDisabled();
  });

  it('Clear button is enabled when currentNote is non-null', () => {
    render(<LineNotePopover {...BASE_PROPS} currentNote="Some note" />);
    expect(screen.getByTestId('note-clear-btn')).not.toBeDisabled();
  });
});

describe('T051 — LineNotePopover cancel action', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LineNotePopover {...BASE_PROPS} onClose={onClose} />);
    await user.click(screen.getByTestId('note-cancel-btn'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('T051 — LineNotePopover error display', () => {
  it('shows error message when error prop is set', () => {
    render(<LineNotePopover {...BASE_PROPS} error="Note rejected" />);
    expect(screen.getByTestId('note-error')).toHaveTextContent('Note rejected');
  });

  it('does not render error element when error prop is null', () => {
    render(<LineNotePopover {...BASE_PROPS} error={null} />);
    expect(screen.queryByTestId('note-error')).not.toBeInTheDocument();
  });

  it('does not render error element when error prop is omitted', () => {
    render(<LineNotePopover {...BASE_PROPS} />);
    expect(screen.queryByTestId('note-error')).not.toBeInTheDocument();
  });
});
