import { useEffect, useState, type JSX } from 'react';

import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import { usePaymentStore } from '../../stores/payment-store.js';
import { OperatorBadge } from '../operator/OperatorBadge.js';
import { TenderSelection, type TenderKind } from './TenderSelection.js';
import { PaymentCartSummary } from './PaymentCartSummary.js';
import { CashEntry } from './CashEntry.js';
import { ExternalCardTerminalEntry } from './ExternalCardTerminalEntry.js';
import type { PaymentsBridgeAPI, TenderBridgeAPI } from '../../../shared/bridge-api.js';

/**
 * 006-payments-tender S1 + S3d T152 — PaymentSurface.
 *
 * Route guard: returns null unless both a signed-in operator session and a
 * non-null payment envelope exist. This prevents the surface from mounting
 * in an inconsistent state.
 *
 * Modes:
 *   • Slice-1 (no bridge): renders TenderSelection + PaymentCartSummary +
 *     a "tender selected" status banner. No bridge calls. Backwards
 *     compatible with existing tests + Slice-1/Slice-2 callers.
 *   • S3d (bridge wired): when `_testBridge` (tests) or `window.api`
 *     (production) provides `payments` + `tender`, picking a tender
 *     triggers `payments.start`, mounts the entry component with the T151
 *     bridge wiring, and surfaces a "Confirm payment" button when at
 *     least one tender line is applied. Confirm click → `payments.confirm`.
 *     On settled, transitions to a placeholder per FR-031.
 *
 * SECURITY:
 *   - No sensitive IDs in DOM (FR-035).
 *   - No card data (PAN, CVV, cardholder name) of any kind.
 *   - No raw bridge reason strings displayed to cashier. Refusal copy is
 *     generic per FR-005 / FR-006B.
 *   - Manager identity never in cashier-visible UI.
 */

export interface PaymentSurfaceProps {
  /**
   * Test seam: injects payments + tender bridge in place of `window.api`.
   * Mirrors the `_testBridge` pattern from CartPane (cart-pane-live-lines).
   * When omitted, the surface degrades to Slice-1 behaviour.
   */
  _testBridge?: {
    payments: PaymentsBridgeAPI;
    tender: TenderBridgeAPI;
  };
}

type Phase = 'tender_selection' | 'entry' | 'settled';

export function PaymentSurface({ _testBridge }: PaymentSurfaceProps = {}): JSX.Element | null {
  const sessionState = useOperatorSessionStore((s) => s.state);
  const envelope = usePaymentStore((s) => s.envelope);
  const paymentSlice = usePaymentStore((s) => s.paymentSlice);

  const [selectedTender, setSelectedTender] = useState<TenderKind | null>(null);
  const [phase, setPhase] = useState<Phase>('tender_selection');
  const [bridgeRefusalCopy, setBridgeRefusalCopy] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [reversalPending, setReversalPending] = useState<boolean>(false);

  // paymentAttemptId is the source-of-truth from the paymentSlice projection
  // (set by payments.start → payments.read flow, or seeded by tests via
  // applyAttemptSnapshot). Keeping a single source avoids drift.
  const paymentAttemptId = paymentSlice?.payment_attempt_id ?? null;

  // Reset surface state when envelope or session context changes; otherwise a
  // stale "tender selected" status banner could carry across a new payment
  // attempt.
  const envelopeHandoffId = envelope?.handoff_action_id ?? null;
  useEffect(() => {
    setSelectedTender(null);
    setPhase('tender_selection');
    setBridgeRefusalCopy(null);
    setIsConfirming(false);
    setIsCancelling(false);
    setReversalPending(false);
    usePaymentStore.getState().clearAttempt();
  }, [sessionState.kind, envelopeHandoffId]);

  if (sessionState.kind !== 'signedIn' || envelope === null) {
    return null;
  }

  const { display_name, role } = sessionState.session;

  async function handleTenderSelect(tender: TenderKind): Promise<void> {
    setSelectedTender(tender);
    setBridgeRefusalCopy(null);

    if (_testBridge === undefined || envelope === null) {
      // Slice-1 behaviour: status banner only.
      return;
    }

    // Split-tender path: an attempt is already started (paymentSlice holds the
    // attempt id from a prior payments.start). Calling payments.start again
    // would be refused with `attempt_already_started_on_terminal`. Skip
    // straight to mounting the new entry component for the remaining balance.
    if (paymentAttemptId !== null) {
      setPhase('entry');
      return;
    }

    const startResponse = await _testBridge.payments.start({
      envelope_handoff_action_id: envelope.handoff_action_id,
      envelope_cart_id: envelope.cart_id,
      envelope_subtotal_minor: envelope.subtotal_minor,
      envelope_version: 'v1',
      idempotency_key: crypto.randomUUID(),
    });

    if (startResponse.kind === 'refused') {
      setBridgeRefusalCopy('We could not start this payment. Please try again.');
      return;
    }

    setPhase('entry');

    // Seed the paymentSlice with an initial read so the surface can react to
    // applied lines as they land. This also populates the paymentAttemptId
    // derivation above.
    const readResponse = await _testBridge.payments.read({
      payment_attempt_id: startResponse.payment_attempt_id,
    });
    if (readResponse.kind === 'ok') {
      usePaymentStore.getState().applyAttemptSnapshot(readResponse.payment_attempt);
    }
  }

  async function handleLineApplied(): Promise<void> {
    if (_testBridge === undefined || paymentAttemptId === null || envelope === null) {
      return;
    }
    const readResponse = await _testBridge.payments.read({
      payment_attempt_id: paymentAttemptId,
    });
    if (readResponse.kind === 'ok') {
      usePaymentStore.getState().applyAttemptSnapshot(readResponse.payment_attempt);
      // Split-tender (T154): if the running sum is still below the subtotal,
      // return to tender selection so the cashier may add another line. When
      // the sum equals the subtotal, the surface stays put and the confirm
      // button becomes visible. The settlement invariant itself is enforced
      // on the main process at payments.confirm time.
      const sumApplied = readResponse.payment_attempt.tender_lines
        .filter((l) => l.state === 'applied')
        .reduce((acc, l) => acc + l.amount_applied_minor, 0);
      if (sumApplied < envelope.subtotal_minor) {
        setSelectedTender(null);
        setPhase('tender_selection');
      }
    }
  }

  async function handleCancel(): Promise<void> {
    if (_testBridge === undefined || paymentAttemptId === null) {
      return;
    }
    setBridgeRefusalCopy(null);
    setIsCancelling(true);
    try {
      const response = await _testBridge.payments.cancel({
        payment_attempt_id: paymentAttemptId,
        idempotency_key: crypto.randomUUID(),
      });
      if (response.kind === 'ok') {
        setReversalPending(response.reversal_pending_tender_line_ids.length > 0);
        setSelectedTender(null);
        setPhase('tender_selection');
        usePaymentStore.getState().clearAttempt();
      } else {
        setBridgeRefusalCopy('This payment could not be cancelled. Please try again.');
      }
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (_testBridge === undefined || paymentAttemptId === null) {
      return;
    }
    setBridgeRefusalCopy(null);
    setIsConfirming(true);
    try {
      const response = await _testBridge.payments.confirm({
        payment_attempt_id: paymentAttemptId,
        idempotency_key: crypto.randomUUID(),
      });
      if (response.kind === 'ok') {
        setPhase('settled');
      } else {
        setBridgeRefusalCopy('This payment could not be settled. Please try again.');
      }
    } finally {
      setIsConfirming(false);
    }
  }

  const appliedLines = (paymentSlice?.tender_lines ?? []).filter((l) => l.state === 'applied');
  const hasAppliedLine = appliedLines.length > 0;
  // Split-tender remaining-balance derivation (T154). Pass to entry components
  // so each successive line is scoped to what's still owed, not the full
  // subtotal.
  const sumAppliedMinor = appliedLines.reduce((acc, l) => acc + l.amount_applied_minor, 0);
  const remainingBalanceMinor = Math.max(envelope.subtotal_minor - sumAppliedMinor, 0);

  if (phase === 'settled') {
    return (
      <main className="payment-surface" data-testid="payment-surface" aria-label="Payment">
        <header className="payment-surface__header">
          <h2 className="payment-surface__title">Payment</h2>
          <OperatorBadge display_name={display_name} role={role} />
        </header>
        <div
          className="payment-surface__settled"
          data-testid="payment-surface-settled"
          role="status"
          aria-live="polite"
        >
          Payment settled.
        </div>
      </main>
    );
  }

  return (
    <main className="payment-surface" data-testid="payment-surface" aria-label="Payment">
      <header className="payment-surface__header">
        <h2 className="payment-surface__title">Payment</h2>
        <OperatorBadge display_name={display_name} role={role} />
      </header>

      <div className="payment-surface__body">
        <TenderSelection
          envelope={envelope}
          onTenderSelect={(tender) => {
            void handleTenderSelect(tender);
          }}
        />
        <PaymentCartSummary envelope={envelope} />
      </div>

      {/* Slice-1 mode: status banner only (no bridge wiring). */}
      {_testBridge === undefined && selectedTender !== null && (
        <div
          className="payment-surface__tender-selected"
          data-testid="payment-surface-tender-selected"
          role="status"
          aria-live="polite"
        >
          {selectedTender === 'cash' ? 'Cash selected' : 'Card terminal selected'}
        </div>
      )}

      {/* S3d mode: entry component for the selected tender. */}
      {_testBridge !== undefined && phase === 'entry' && paymentAttemptId !== null && (
        <div className="payment-surface__entry" data-testid="payment-surface-entry">
          {selectedTender === 'cash' && (
            <CashEntry
              remainingBalanceMinor={remainingBalanceMinor}
              paymentAttemptId={paymentAttemptId}
              tenderApply={(req) => _testBridge.tender.apply(req)}
              onApplied={() => {
                void handleLineApplied();
              }}
            />
          )}
          {selectedTender === 'external_card_terminal' && (
            <ExternalCardTerminalEntry
              remainingBalanceMinor={remainingBalanceMinor}
              paymentAttemptId={paymentAttemptId}
              tenderApply={(req) => _testBridge.tender.apply(req)}
              onApplied={() => {
                void handleLineApplied();
              }}
            />
          )}
        </div>
      )}

      {/* S3d mode: confirm button shows once any line is applied. */}
      {_testBridge !== undefined && hasAppliedLine && (
        <button
          type="button"
          className="payment-surface__confirm"
          data-testid="payment-surface-confirm"
          disabled={isConfirming}
          aria-disabled={isConfirming ? 'true' : undefined}
          onClick={() => {
            void handleConfirm();
          }}
        >
          Confirm payment
        </button>
      )}

      {/* S3d mode: cancel button visible during the entry phase. */}
      {_testBridge !== undefined && phase === 'entry' && (
        <button
          type="button"
          className="payment-surface__cancel"
          data-testid="payment-surface-cancel"
          disabled={isCancelling}
          aria-disabled={isCancelling ? 'true' : undefined}
          onClick={() => {
            void handleCancel();
          }}
        >
          Cancel
        </button>
      )}

      {/* Slice-4 voucher path: hint shown when reversal_pending_tender_line_ids
          was non-empty in the most recent cancel response. Copy is fixed (no
          id interpolation) per FR-017 / token minimisation. */}
      {reversalPending && (
        <div
          className="payment-surface__reversal-pending-hint"
          data-testid="payment-surface-reversal-pending-hint"
          role="status"
          aria-live="polite"
        >
          Some reversals are pending and will be processed shortly.
        </div>
      )}

      {bridgeRefusalCopy !== null && (
        <div
          className="payment-surface__bridge-refusal"
          data-testid="payment-surface-bridge-refusal"
          role="status"
          aria-live="polite"
        >
          {bridgeRefusalCopy}
        </div>
      )}
    </main>
  );
}
