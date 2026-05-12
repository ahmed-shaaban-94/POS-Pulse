import { useState, type JSX } from 'react';

import {
  FORCED_CLOSE_REASONS,
  type ForcedCloseReason,
} from '../../../shared/audit/payload-schemas.js';

// ─── ForcedCloseSurface ───────────────────────────────────────────────────────

export interface ForcedCloseSurfaceProps {
  cashier_display_name: string;
  terminal_label: string;
  /** ISO 8601 UTC timestamp string. */
  opened_at: string;
  duration_minutes: number;
}

/**
 * 004-operator-session T083 — read-only summary row for a stuck shift.
 *
 * FR-013 minimum-disclosure: renders only the four Wave 4.1 stub fields.
 * FR-024 blind-close discipline: NO drawer count, expected total, variance,
 * shortage, overage, change fund, or any financial/KPI field.
 *
 * Card-stack layout (div rows, not table).
 */
export function ForcedCloseSurface({
  cashier_display_name,
  terminal_label,
  opened_at,
  duration_minutes,
}: ForcedCloseSurfaceProps): JSX.Element {
  return (
    <div data-testid="forced-close-surface">
      <div data-testid="fcs-cashier-name">{cashier_display_name}</div>
      <div data-testid="fcs-terminal-label">{terminal_label}</div>
      <div data-testid="fcs-opened-at">{opened_at}</div>
      <div data-testid="fcs-duration">{duration_minutes}</div>
    </div>
  );
}

// ─── ForcedCloseForm ──────────────────────────────────────────────────────────

export interface ForcedCloseFormSubmitPayload {
  forced_close_reason: ForcedCloseReason;
  annotation?: string;
}

export interface ForcedCloseFormProps {
  onSubmit: (payload: ForcedCloseFormSubmitPayload) => void;
}

/**
 * 004-operator-session T084 — forced-close reason picker form.
 *
 * - Submit is disabled until a reason radio is selected.
 * - Exactly the five FORCED_CLOSE_REASONS values are offered.
 * - Free-text annotation captured in payload.annotation only;
 *   payload.forced_close_reason contains only the enum value.
 * - No financial or PII fields.
 */
export function ForcedCloseForm({ onSubmit }: ForcedCloseFormProps): JSX.Element {
  const [reason, setReason] = useState<ForcedCloseReason | null>(null);
  const [annotation, setAnnotation] = useState('');

  function handleSubmit(e: React.SubmitEvent): void {
    e.preventDefault();
    /* v8 ignore next 1 */
    if (reason == null) return;
    onSubmit(
      annotation ? { forced_close_reason: reason, annotation } : { forced_close_reason: reason },
    );
  }

  return (
    <form data-testid="forced-close-form" onSubmit={handleSubmit}>
      <fieldset>
        <legend>Reason for forced close</legend>
        {FORCED_CLOSE_REASONS.map((r) => (
          <label key={r}>
            <input
              type="radio"
              name="forced_close_reason"
              value={r}
              checked={reason === r}
              onChange={() => {
                setReason(r);
              }}
            />
            {r}
          </label>
        ))}
      </fieldset>

      <label htmlFor="forced-close-annotation">Annotation (optional)</label>
      <textarea
        id="forced-close-annotation"
        value={annotation}
        onChange={(e) => {
          setAnnotation(e.target.value);
        }}
      />

      <button type="submit" disabled={reason == null}>
        Confirm forced close
      </button>
    </form>
  );
}
