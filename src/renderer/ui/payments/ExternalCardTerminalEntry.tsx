import { useMemo, useState, type JSX } from 'react';

import { validateExternalReference } from '../../../shared/payments/external-reference-format.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * 006-payments-tender Slice 2 — <ExternalCardTerminalEntry>.
 *
 * Record-only entry surface for an external_card_terminal TenderLine. The
 * cashier confirms the external terminal already processed the amount; the
 * surface captures the exact amount applied and an optional non-sensitive
 * reference string. No payment gateway, no card data of any kind.
 *
 * SECURITY (FR-007 / FR-008 / Constitution §P6 / §P7):
 *   - No PAN / CVV / track / cardholder / expiry / auth-payload fields.
 *   - external_reference is regex-bounded to ^[A-Z0-9]{0,6}$ which makes
 *     a PAN literally unrepresentable in this field.
 *   - Generic refusal copy at the renderer; the structured reason names
 *     (`non_cash_overpayment_refused`, `invalid_input`) never cross into
 *     the DOM — Slice 3 will surface them via audit payload only.
 *
 * NOTE on visual-direction §State 3 vs tasks.md T044/T049:
 *   The visual sketch in `specs/006-payments-tender/visual-direction/README.md`
 *   §State 3 does NOT show an editable amount field — only the instructional
 *   copy + optional reference + confirm. tasks.md T044 / T049 require the
 *   amount field. Maestro source-of-truth order
 *   (`docs/maestro/README.md §"Source of truth"`) places tasks.md above the
 *   visual direction; this implementation follows the executable layer.
 *   The mismatch is recorded as a Spec-Kit follow-up in the closeout.
 */

export interface ExternalCardTerminalEntryProps {
  remainingBalanceMinor: number;
  onConfirm: (applied: { amountAppliedMinor: number; externalReference: string | null }) => void;
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
  if (input === '' || !/^\d+$/.test(input)) {
    return null;
  }
  const parsed = Number.parseInt(input, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function ExternalCardTerminalEntry({
  remainingBalanceMinor,
  onConfirm,
  onBack,
}: ExternalCardTerminalEntryProps): JSX.Element {
  // Default amount to the exact remaining balance — the cashier's expected
  // happy-path input. FR-010: non-cash tenders MUST NOT overpay.
  const [amountInput, setAmountInput] = useState<string>(() =>
    Number.isSafeInteger(remainingBalanceMinor) && remainingBalanceMinor >= 0
      ? remainingBalanceMinor.toString()
      : '',
  );
  const [referenceInput, setReferenceInput] = useState<string>('');

  const amountAppliedMinor = useMemo(() => parseIntegerMinorUnits(amountInput), [amountInput]);
  const isExactAmount = amountAppliedMinor === remainingBalanceMinor;
  const isOverpay = amountAppliedMinor !== null && amountAppliedMinor > remainingBalanceMinor;
  const isUnderpay = amountAppliedMinor !== null && amountAppliedMinor < remainingBalanceMinor;

  const isReferenceValid = validateExternalReference(referenceInput);
  const isReferenceProvided = referenceInput !== '';

  const canConfirm = isExactAmount && isReferenceValid;

  // handleConfirm is only reachable when the Confirm button is enabled
  // (canConfirm === true), so amountAppliedMinor is non-null at this point.
  function handleConfirm(): void {
    if (amountAppliedMinor !== null) {
      onConfirm({
        amountAppliedMinor,
        externalReference: isReferenceProvided ? referenceInput : null,
      });
    }
  }

  return (
    <section
      className="external-card-terminal-entry"
      data-testid="external-card-terminal-entry"
      aria-label="External card terminal entry"
    >
      <h3 className="external-card-terminal-entry__heading">Card terminal payment</h3>

      <p className="external-card-terminal-entry__instructional">
        Process {formatMinorUnits(remainingBalanceMinor)} on the card terminal, then confirm here.
      </p>

      <label
        className="external-card-terminal-entry__amount-label"
        htmlFor="external-card-amount-input"
      >
        Amount applied (minor units)
      </label>
      <input
        id="external-card-amount-input"
        data-testid="external-card-amount-input"
        className="external-card-terminal-entry__amount-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={amountInput}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '' || /^\d+$/.test(next)) {
            setAmountInput(next);
          }
        }}
      />

      {isOverpay && (
        <div
          className="external-card-terminal-entry__refusal"
          data-testid="external-card-refusal"
          role="status"
          aria-live="polite"
        >
          The amount must be exact for a card-terminal payment.
        </div>
      )}

      {isUnderpay && (
        <div
          className="external-card-terminal-entry__refusal"
          data-testid="external-card-refusal-underpay"
          role="status"
          aria-live="polite"
        >
          The amount must match the remaining balance.
        </div>
      )}

      <label
        className="external-card-terminal-entry__reference-label"
        htmlFor="external-card-reference-input"
      >
        Reference (optional, 6 chars max)
      </label>
      <input
        id="external-card-reference-input"
        data-testid="external-card-reference-input"
        className="external-card-terminal-entry__reference-input"
        type="text"
        inputMode="text"
        autoComplete="off"
        maxLength={6}
        placeholder="e.g. T1A2B3"
        value={referenceInput}
        onChange={(e) => {
          setReferenceInput(e.target.value);
        }}
      />

      {isReferenceProvided && !isReferenceValid && (
        <div
          className="external-card-terminal-entry__reference-error"
          data-testid="external-card-reference-error"
          role="status"
          aria-live="polite"
        >
          Reference format is invalid. Use up to 6 uppercase letters or digits.
        </div>
      )}

      <div className="external-card-terminal-entry__actions">
        <button
          type="button"
          className="external-card-terminal-entry__confirm"
          data-testid="external-card-confirm"
          style={{ minHeight: touchTarget.min }}
          disabled={!canConfirm}
          aria-disabled={!canConfirm ? 'true' : undefined}
          onClick={handleConfirm}
        >
          Confirm terminal processed payment
        </button>
        {onBack !== undefined && (
          <button
            type="button"
            className="external-card-terminal-entry__back"
            data-testid="external-card-back"
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
