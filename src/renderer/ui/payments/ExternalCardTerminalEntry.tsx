import { useMemo, useState, type JSX } from 'react';

import { validateExternalReference } from '../../../shared/payments/external-reference-format.js';
import type { TenderApplyRequest, TenderApplyResponse } from '../../../shared/bridge-api.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * 006-payments-tender Slice 2 + S3d T151 — <ExternalCardTerminalEntry>.
 *
 * Modes:
 *   • Slice-2 (display-only): caller passes `onConfirm`. Confirm fires with
 *     `{ amountAppliedMinor, externalReference }`.
 *   • S3d (bridged): caller additionally passes `paymentAttemptId`,
 *     `tenderApply`, `onApplied`. Confirm builds a `TenderApplyRequest`
 *     with a fresh UUID v4 idempotency_key, calls the bridge, and either
 *     fires `onApplied(response)` on success or renders generic refusal
 *     copy on `{ kind: 'refused' }`.
 *
 * SECURITY (FR-007 / FR-008 / Constitution §P6 / §P7):
 *   - No PAN / CVV / track / cardholder / expiry / auth-payload fields.
 *   - external_reference is regex-bounded to ^[A-Z0-9]{0,6}$ which makes
 *     a PAN literally unrepresentable in this field.
 *   - Generic refusal copy at the renderer; the structured reason names
 *     never cross into the DOM.
 */

export interface ExternalCardTerminalEntryProps {
  remainingBalanceMinor: number;
  /**
   * Slice-2 callback. When `tenderApply` is provided, this is NOT invoked —
   * the bridge response is surfaced through `onApplied` instead.
   */
  onConfirm?: (applied: { amountAppliedMinor: number; externalReference: string | null }) => void;
  onBack?: () => void;
  /** Payment attempt id from the main process (required when `tenderApply` is set). */
  paymentAttemptId?: string;
  /** Bridge callback. Receives a fully-formed TenderApplyRequest. */
  tenderApply?: (req: TenderApplyRequest) => Promise<TenderApplyResponse>;
  /** Fires with the `{ kind: 'ok', ... }` response on successful apply. */
  onApplied?: (response: Extract<TenderApplyResponse, { kind: 'ok' }>) => void;
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
  paymentAttemptId,
  tenderApply,
  onApplied,
}: ExternalCardTerminalEntryProps): JSX.Element {
  const [amountInput, setAmountInput] = useState<string>(() =>
    Number.isSafeInteger(remainingBalanceMinor) && remainingBalanceMinor >= 0
      ? remainingBalanceMinor.toString()
      : '',
  );
  const [referenceInput, setReferenceInput] = useState<string>('');
  const [bridgeRefusal, setBridgeRefusal] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const amountAppliedMinor = useMemo(() => parseIntegerMinorUnits(amountInput), [amountInput]);
  const isExactAmount = amountAppliedMinor === remainingBalanceMinor;
  const isOverpay = amountAppliedMinor !== null && amountAppliedMinor > remainingBalanceMinor;
  const isUnderpay = amountAppliedMinor !== null && amountAppliedMinor < remainingBalanceMinor;

  const isReferenceValid = validateExternalReference(referenceInput);
  const isReferenceProvided = referenceInput !== '';

  const canConfirm = isExactAmount && isReferenceValid && !isApplying;

  async function handleConfirm(): Promise<void> {
    if (amountAppliedMinor === null || !isExactAmount) {
      return;
    }

    if (tenderApply !== undefined && paymentAttemptId !== undefined) {
      setBridgeRefusal(false);
      setIsApplying(true);
      try {
        const request: TenderApplyRequest = {
          payment_attempt_id: paymentAttemptId,
          tender_type: 'external_card_terminal',
          amount_applied_minor: amountAppliedMinor,
          idempotency_key: crypto.randomUUID(),
          ...(isReferenceProvided ? { external_reference: referenceInput } : {}),
        };
        const response = await tenderApply(request);
        if (response.kind === 'ok') {
          onApplied?.(response);
        } else {
          setBridgeRefusal(true);
        }
      } catch {
        // CR-7: bridge rejection (network / IPC layer error). Surface generic
        // copy; never let the promise reject up as an unhandled rejection
        // through `void handleConfirm()`.
        setBridgeRefusal(true);
      } finally {
        setIsApplying(false);
      }
      return;
    }

    onConfirm?.({
      amountAppliedMinor,
      externalReference: isReferenceProvided ? referenceInput : null,
    });
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
            setBridgeRefusal(false);
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
          setBridgeRefusal(false);
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

      {bridgeRefusal && (
        <div
          className="external-card-terminal-entry__bridge-refusal"
          data-testid="external-card-bridge-refusal"
          role="status"
          aria-live="polite"
        >
          This payment could not be applied. Please try again.
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
          onClick={() => {
            void handleConfirm();
          }}
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
