/**
 * 005-sales-cart T049 — LineItemRow component.
 *
 * Renders a single cart line per the S0 contact sheet §Surface 3:
 *   - display_name (text).
 *   - [×] remove button (≥ 44 × 44 px touch target).
 *   - QuantityStepper ([−] qty [+]).
 *   - unit price (mono, ¤ prefix, 2 decimal places).
 *   - line subtotal (mono, ¤ prefix, 2 decimal places).
 *   - note chip (if non-null, muted, truncated at 40 chars).
 *
 * Currency format: integer minor units / 100, rendered with ¤ prefix.
 * No floats are produced — formatting only divides by 100 for display.
 *
 * SECURITY: Note chip displays raw note text — this is display-only and does
 * not feed back into any IPC call. No note content is logged (NFR-006).
 */

import type { JSX } from 'react';
import { QuantityStepper } from './QuantityStepper.js';
import { touchTarget } from '../tokens/touch.js';

export interface LineItemRowProps {
  lineId: string;
  displayName: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  note: string | null;
  hasNote: boolean;
  onQuantityIncrement: () => void;
  onQuantityDecrement: () => void;
  onRemove: () => void;
  onNoteOpen: () => void;
}

const NOTE_TRUNCATE_LENGTH = 40;
const MIN_TOUCH = touchTarget.min;

function formatMinorUnits(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `¤${String(whole)}.${frac}`;
}

function truncateNote(note: string): string {
  if (note.length <= NOTE_TRUNCATE_LENGTH) return note;
  return `${note.slice(0, NOTE_TRUNCATE_LENGTH)}...`;
}

export function LineItemRow({
  lineId,
  displayName,
  quantity,
  unitPriceMinor,
  lineSubtotalMinor,
  note,
  hasNote,
  onQuantityIncrement,
  onQuantityDecrement,
  onRemove,
  onNoteOpen,
}: LineItemRowProps): JSX.Element {
  return (
    <div className="line-item-row" data-testid="line-item-row" data-line-id={lineId}>
      <div className="line-item-row__main">
        <span className="line-item-row__name">{displayName}</span>
        <button
          type="button"
          className="line-item-row__remove"
          data-testid="line-remove-btn"
          aria-label={`Remove ${displayName} from cart`}
          style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH }}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      <div className="line-item-row__qty-price">
        <QuantityStepper
          quantity={quantity}
          hasNote={hasNote}
          onIncrement={onQuantityIncrement}
          onDecrement={onQuantityDecrement}
          onRemoveRequest={onRemove}
        />
        <span className="line-item-row__unit-price mono" data-testid="line-unit-price">
          {formatMinorUnits(unitPriceMinor)}
        </span>
        <span className="line-item-row__subtotal mono" data-testid="line-subtotal">
          {formatMinorUnits(lineSubtotalMinor)}
        </span>
      </div>
      {note !== null ? (
        <button
          type="button"
          className="line-item-row__note-chip"
          data-testid="line-note-chip"
          aria-label="Edit note"
          onClick={onNoteOpen}
        >
          {truncateNote(note)}
        </button>
      ) : (
        <button
          type="button"
          className="line-item-row__note-add"
          data-testid="line-note-add-btn"
          aria-label="Add note"
          onClick={onNoteOpen}
        >
          Add note
        </button>
      )}
    </div>
  );
}
