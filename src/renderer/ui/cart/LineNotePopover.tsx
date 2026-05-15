/**
 * 005-sales-cart T051 — LineNotePopover component.
 *
 * Inline popover for editing a line item note (Q1: max 200 chars).
 *
 * - Renders only when `open` is true.
 * - Save: calls onSave with trimmed note text. Disabled when value equals
 *   the current saved note (no change).
 * - Clear: calls onSave(null). Disabled when currentNote is already null.
 * - Cancel: calls onClose without saving.
 *
 * SECURITY: Note content is a UX concern only — the renderer-side
 * forbidden-pattern check is advisory; cart-bridge.ts is the authoritative
 * gate (FORBIDDEN_NOTE_PATTERNS + bridge contract). Note content MUST NOT
 * be logged here (NFR-006 / Constitution VII).
 */

import { useState, type JSX } from 'react';

export interface LineNotePopoverProps {
  open: boolean;
  currentNote: string | null;
  /** Generic bridge refusal message — "Note rejected" when bridge refuses setNote. */
  error?: string | null;
  onSave: (note: string | null) => void;
  onClose: () => void;
}

const NOTE_MAX_LENGTH = 200;

export function LineNotePopover({
  open,
  currentNote,
  error,
  onSave,
  onClose,
}: LineNotePopoverProps): JSX.Element | null {
  const [draft, setDraft] = useState<string>(currentNote ?? '');

  if (!open) return null;

  const trimmed = draft.trim();
  const isUnchanged = trimmed === (currentNote ?? '');
  const hasExistingNote = currentNote !== null;

  function handleSave(): void {
    onSave(trimmed.length === 0 ? null : trimmed);
  }

  function handleClear(): void {
    onSave(null);
  }

  return (
    <div
      className="line-note-popover"
      data-testid="line-note-popover"
      role="dialog"
      aria-modal="true"
    >
      <textarea
        className="line-note-popover__textarea"
        maxLength={NOTE_MAX_LENGTH}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        aria-label="Line note"
        rows={3}
      />
      {error != null && (
        <p className="line-note-popover__error" data-testid="note-error" role="alert">
          {error}
        </p>
      )}
      <div className="line-note-popover__actions">
        <button
          type="button"
          className="line-note-popover__btn line-note-popover__btn--save"
          data-testid="note-save-btn"
          disabled={isUnchanged}
          onClick={handleSave}
        >
          Save
        </button>
        <button
          type="button"
          className="line-note-popover__btn line-note-popover__btn--clear"
          data-testid="note-clear-btn"
          disabled={!hasExistingNote}
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="line-note-popover__btn line-note-popover__btn--cancel"
          data-testid="note-cancel-btn"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
