/**
 * T071 — VoidConfirmation dialog (S3 sensitive action).
 *
 * Generic copy per S0 contact sheet Surface 5 (FR-033 gate).
 * No cart ID, session ID, or item list exposed.
 */

import { useEffect, type JSX } from 'react';

export interface VoidConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function VoidConfirmation({ onConfirm, onCancel }: VoidConfirmationProps): JSX.Element {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="void-dialog-title">
      <h2 id="void-dialog-title">Void this cart?</h2>
      <p>This action cannot be undone.</p>
      <p>All items will be removed.</p>
      <div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" data-variant="danger" onClick={onConfirm}>
          Void cart
        </button>
      </div>
    </div>
  );
}
