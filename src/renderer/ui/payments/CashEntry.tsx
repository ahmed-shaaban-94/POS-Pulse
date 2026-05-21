import { useMemo, useState, type JSX } from 'react';

import { computeChangeDueMinor } from '../../../shared/payments/money-math.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * 006-payments-tender Slice 2 — <CashEntry>.
 *
 * Display + input collection only. No bridge, no FSM, no audit emission —
 * those are Slice 3 territory. The component captures cash_received in
 * integer minor units, displays change-due (when earned) for the cashier,
 * and surfaces a generic "amount is not enough" message on under-tender.
 *
 * SECURITY:
 *   - No card data of any kind (this is the cash surface).
 *   - No sensitive IDs rendered.
 *   - The structured refusal name `tender_underpaid` (FR-006) never crosses
 *     into the DOM — only the generic copy from FR-005 / US1-AS3.
 *   - Money is integer minor units only (Constitution §II); the displayed
 *     change-due major-unit string is for the cashier's eye only.
 */

export interface CashEntryProps {
  remainingBalanceMinor: number;
  onConfirm: (applied: { amountAppliedMinor: number; changeDueMinor: number }) => void;
  onBack?: () => void;
}

function formatMinorUnits(minor: number): string {
  if (!Number.isSafeInteger(minor)) {
    return '—';
  }
  const whole = Math.floor(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `¤${whole.toString()}.${frac}`;
}

function parseIntegerMinorUnits(input: string): number | null {
  // Allow only an all-digit non-empty string; reject leading minus, decimal
  // point, alphabetic, scientific notation, anything else. This is the
  // keystroke-level guard FR-004 / Constitution §II demand.
  if (input === '' || !/^\d+$/.test(input)) {
    return null;
  }
  const parsed = Number.parseInt(input, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function CashEntry({
  remainingBalanceMinor,
  onConfirm,
  onBack,
}: CashEntryProps): JSX.Element {
  const [rawInput, setRawInput] = useState<string>('');

  const amountAppliedMinor = useMemo(() => parseIntegerMinorUnits(rawInput), [rawInput]);

  const isSufficient = amountAppliedMinor !== null && amountAppliedMinor >= remainingBalanceMinor;
  const isUnderTender = amountAppliedMinor !== null && amountAppliedMinor < remainingBalanceMinor;

  // Only compute change-due when sufficient. Under-tender path never calls
  // computeChangeDueMinor — that function throws on under-tender by design
  // (the renderer's confirm-enabled predicate is the gate).
  const changeDueMinor = isSufficient
    ? computeChangeDueMinor(amountAppliedMinor, remainingBalanceMinor)
    : null;

  // handleConfirm is only reachable when the Confirm button is enabled
  // (isSufficient === true), so amountAppliedMinor and changeDueMinor are
  // both non-null at this point. Trust the button's disabled gate.
  function handleConfirm(): void {
    if (isSufficient && changeDueMinor !== null) {
      onConfirm({ amountAppliedMinor, changeDueMinor });
    }
  }

  return (
    <section className="cash-entry" data-testid="cash-entry" aria-label="Cash entry">
      <h3 className="cash-entry__heading">Cash payment</h3>

      <div className="cash-entry__remaining">
        <span className="cash-entry__remaining-label">Amount due</span>
        <span className="cash-entry__remaining-value" data-testid="cash-entry-remaining">
          {formatMinorUnits(remainingBalanceMinor)}
        </span>
      </div>

      <label className="cash-entry__amount-label" htmlFor="cash-entry-amount-input">
        Amount received (minor units)
      </label>
      <input
        id="cash-entry-amount-input"
        data-testid="cash-entry-amount-input"
        className="cash-entry__amount-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={rawInput}
        onChange={(e) => {
          const next = e.target.value;
          // Accept only all-digit values (and empty). Otherwise refuse the
          // change — the value in state stays as it was, so floats / signs /
          // alphabetic input simply don't land.
          if (next === '' || /^\d+$/.test(next)) {
            setRawInput(next);
          }
        }}
      />

      {changeDueMinor !== null && changeDueMinor > 0 && (
        <div className="cash-entry__change-due" data-testid="cash-entry-change-due">
          <span className="cash-entry__change-due-label">Change due</span>
          <span className="cash-entry__change-due-value">{formatMinorUnits(changeDueMinor)}</span>
        </div>
      )}

      {isUnderTender && (
        <div
          className="cash-entry__refusal"
          data-testid="cash-entry-refusal"
          role="status"
          aria-live="polite"
        >
          The amount is not enough to settle this payment.
        </div>
      )}

      <div className="cash-entry__actions">
        <button
          type="button"
          className="cash-entry__confirm"
          data-testid="cash-entry-confirm"
          style={{ minHeight: touchTarget.min }}
          disabled={!isSufficient}
          aria-disabled={!isSufficient ? 'true' : undefined}
          onClick={handleConfirm}
        >
          Confirm cash payment
        </button>
        {onBack !== undefined && (
          <button
            type="button"
            className="cash-entry__back"
            data-testid="cash-entry-back"
            style={{ minHeight: touchTarget.min }}
            onClick={onBack}
          >
            Back
          </button>
        )}
      </div>
    </section>
  );
}
