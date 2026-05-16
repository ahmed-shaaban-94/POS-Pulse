/**
 * T073 — DiscountPlaceholderRow (S3 sensitive action).
 *
 * "Discount applied" pill per S0 contact sheet Surface 7.
 * No numeric value — magnitude is never shown to cashier.
 */

import type { JSX } from 'react';
import { touchTarget } from '../tokens/touch.js';

export interface DiscountPlaceholderRowProps {
  placeholderId: string;
  onRemove: () => void;
}

export function DiscountPlaceholderRow({
  placeholderId,
  onRemove,
}: DiscountPlaceholderRowProps): JSX.Element {
  return (
    <div className="discount-placeholder-row" data-placeholder-id={placeholderId}>
      <span className="discount-placeholder-row__label">Discount applied</span>
      <button
        type="button"
        aria-label="Remove discount"
        onClick={onRemove}
        style={{ minWidth: touchTarget.min, minHeight: touchTarget.min }}
      >
        ×
      </button>
    </div>
  );
}
