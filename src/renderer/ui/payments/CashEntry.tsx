import { useMemo, useState, type JSX } from 'react';

import { computeChangeDueMinor } from '../../../shared/payments/money-math.js';
import type { TenderApplyRequest, TenderApplyResponse } from '../../../shared/bridge-api.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * 006-payments-tender Slice 2 + S3d T151 — <CashEntry>.
 *
 * Modes:
 *   • Slice-2 (display-only): caller passes `onConfirm`. Confirm fires with
 *     `{ amountAppliedMinor, changeDueMinor }`.
 *   • S3d (bridged): caller additionally passes `paymentAttemptId`,
 *     `tenderApply`, `onApplied`. Confirm builds a `TenderApplyRequest`
 *     with a fresh UUID v4 idempotency_key (R-10), calls the bridge, and
 *     either fires `onApplied(response)` on success or renders generic
 *     refusal copy on `{ kind: 'refused' }`.
 *
 * SECURITY:
 *   - No card data of any kind (this is the cash surface).
 *   - No sensitive IDs rendered.
 *   - Structured `refusal.reason` strings never enter the DOM — only the
 *     generic copy required by FR-005 / US1-AS3.
 *   - Money is integer minor units only (Constitution §II).
 */

export interface CashEntryProps {
  remainingBalanceMinor: number;
  /**
   * Slice-2 callback. Called with the parsed amount + computed change when
   * the cashier confirms a sufficient cash amount. When `tenderApply` is
   * provided, this callback is NOT invoked — the bridge response is
   * surfaced through `onApplied` instead.
   */
  onConfirm?: (applied: { amountAppliedMinor: number; changeDueMinor: number }) => void;
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
  paymentAttemptId,
  tenderApply,
  onApplied,
}: CashEntryProps): JSX.Element {
  const [rawInput, setRawInput] = useState<string>('');
  const [bridgeRefusal, setBridgeRefusal] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const amountAppliedMinor = useMemo(() => parseIntegerMinorUnits(rawInput), [rawInput]);

  const isRemainingValid =
    Number.isSafeInteger(remainingBalanceMinor) && remainingBalanceMinor >= 0;
  const isSufficient =
    isRemainingValid && amountAppliedMinor !== null && amountAppliedMinor >= remainingBalanceMinor;
  const isUnderTender =
    isRemainingValid && amountAppliedMinor !== null && amountAppliedMinor < remainingBalanceMinor;

  // T154 split-tender: in bridged mode (tenderApply provided) the cashier may
  // apply a partial cash line for less than the remaining balance — the main
  // process accepts the line and the surface returns to tender selection for
  // the rest. The settlement invariant is enforced at payments.confirm time.
  // In Slice-2 mode (no tenderApply) the legacy "must be >= remaining" gate
  // stays in force.
  const isBridged = tenderApply !== undefined && paymentAttemptId !== undefined;
  const isPositive = amountAppliedMinor !== null && amountAppliedMinor > 0;
  const canConfirm = isBridged ? isPositive : isSufficient;

  // computeChangeDueMinor throws on under-tender; only compute it when the
  // cash amount actually covers the remaining balance.
  const changeDueMinor = isSufficient
    ? computeChangeDueMinor(amountAppliedMinor, remainingBalanceMinor)
    : null;

  async function handleConfirm(): Promise<void> {
    if (!canConfirm || amountAppliedMinor === null) {
      return;
    }

    if (tenderApply !== undefined && paymentAttemptId !== undefined) {
      setBridgeRefusal(false);
      setIsApplying(true);
      try {
        const response = await tenderApply({
          payment_attempt_id: paymentAttemptId,
          tender_type: 'cash',
          amount_applied_minor: amountAppliedMinor,
          idempotency_key: crypto.randomUUID(),
        });
        if (response.kind === 'ok') {
          onApplied?.(response);
        } else {
          setBridgeRefusal(true);
        }
      } catch {
        // CR-6: bridge rejection (network / IPC layer error). Treat the same
        // as a structured refusal — surface generic copy, never let the
        // promise reject up through `void handleConfirm()` as an unhandled
        // rejection.
        setBridgeRefusal(true);
      } finally {
        setIsApplying(false);
      }
      return;
    }

    if (changeDueMinor !== null) {
      onConfirm?.({ amountAppliedMinor, changeDueMinor });
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
          if (next === '' || /^\d+$/.test(next)) {
            setRawInput(next);
            setBridgeRefusal(false);
          }
        }}
      />

      {changeDueMinor !== null && changeDueMinor > 0 && (
        <div className="cash-entry__change-due" data-testid="cash-entry-change-due">
          <span className="cash-entry__change-due-label">Change due</span>
          <span className="cash-entry__change-due-value">{formatMinorUnits(changeDueMinor)}</span>
        </div>
      )}

      {/* Slice-2 under-tender banner. In S3d bridged mode the cashier may
          apply a partial cash line (split tender), so the banner is hidden;
          the main process owns the settlement invariant. */}
      {isUnderTender && !isBridged && (
        <div
          className="cash-entry__refusal"
          data-testid="cash-entry-refusal"
          role="status"
          aria-live="polite"
        >
          The amount is not enough to settle this payment.
        </div>
      )}

      {bridgeRefusal && (
        <div
          className="cash-entry__bridge-refusal"
          data-testid="cash-entry-bridge-refusal"
          role="status"
          aria-live="polite"
        >
          This payment could not be applied. Please try again.
        </div>
      )}

      <div className="cash-entry__actions">
        <button
          type="button"
          className="cash-entry__confirm"
          data-testid="cash-entry-confirm"
          style={{ minHeight: touchTarget.min }}
          disabled={!canConfirm || isApplying}
          aria-disabled={!canConfirm || isApplying ? 'true' : undefined}
          onClick={() => {
            void handleConfirm();
          }}
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
