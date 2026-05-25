import { useMemo, useRef, useState, type JSX } from 'react';

import type { TenderApplyRequest, TenderApplyResponse } from '../../../shared/bridge-api.js';
import { touchTarget } from '../tokens/touch.js';

/**
 * 006-payments-tender Slice 4 T290 — <VoucherEntry>.
 *
 * Wave 5c renderer surface. Mounts inside PaymentSurface when the
 * cashier selects the `internal_voucher` tender slot. Calls
 * `tender.apply` with `tender_type: 'internal_voucher'` + the typed
 * voucher code + the cashier-supplied amount.
 *
 * The bridge handler (T263 — extended in Wave 4) routes the call to
 * the voucher-authority V-A client (T250 — Wave 3) which validates
 * against Data-Pulse-2. On success the line is persisted with state
 * `applied` and the intent token stays main-side (FR-017).
 *
 * SECURITY:
 *   - F-A4B-003 enforcement: all 8 voucher refusal reasons map to
 *     ONE generic renderer copy string. The structured `refusal.reason`
 *     NEVER enters the DOM — that's the §A4-B reviewer decision
 *     recorded in `reviews/a4b-vouchers-bridge-brief.md` §6.
 *   - FR-017: no voucher tokens, no voucher balance, no holder PII,
 *     no campaign metadata in props or rendered output. The voucher
 *     code IS rendered (it's the cashier's own input).
 *   - Money is integer minor units only (Constitution §P9 / P-II).
 *   - No factor-distinguishing copy on refusal (FR-022 / NFR-003 /
 *     PR-2 inherited from 004).
 */

export interface VoucherEntryProps {
  /** Remaining cart balance in minor units; defines the cashier's amount ceiling. */
  remainingBalanceMinor: number;
  /** Payment attempt id from the main process. */
  paymentAttemptId: string;
  /** Bridge callback. Receives a fully-formed TenderApplyRequest. */
  tenderApply: (req: TenderApplyRequest) => Promise<TenderApplyResponse>;
  /** Fires with the `{ kind: 'ok', ... }` response on successful apply. */
  onApplied?: (response: Extract<TenderApplyResponse, { kind: 'ok' }>) => void;
}

/**
 * F-A4B-003 reviewer decision: every voucher refusal reason — closed
 * enum from `contracts/bridge-api.md` §"vouchers.*" + spec FR-006 —
 * maps to this single renderer string. An attacker cannot enumerate
 * voucher validity, balance, or holder existence by probing codes
 * against the POS surface; only the audit log distinguishes.
 */
const GENERIC_VOUCHER_REFUSAL_COPY = 'This voucher cannot be used right now.';

const VOUCHER_CODE_PATTERN = /^[A-Z0-9_-]+$/;

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

function generateIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function VoucherEntry({
  remainingBalanceMinor,
  paymentAttemptId,
  tenderApply,
  onApplied,
}: VoucherEntryProps): JSX.Element {
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [rawAmountInput, setRawAmountInput] = useState<string>('');
  const [bridgeRefusal, setBridgeRefusal] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // CR-1 (PR #226): React's `disabled` reflects state asynchronously,
  // so two rapid clicks can dispatch two bridge calls before
  // `isApplying` re-renders the button. Because each submission
  // generates a FRESH UUID v4 idempotency_key, the main-process
  // §P5 dedup would NOT collapse the duplicates — each call looks
  // like a distinct intent. The synchronous ref-lock guards against
  // double-fire deterministically; the render-state `disabled` stays
  // as secondary UX feedback.
  const submitLockRef = useRef<boolean>(false);

  const amountAppliedMinor = useMemo(
    () => parseIntegerMinorUnits(rawAmountInput),
    [rawAmountInput],
  );

  const codeIsWellFormed = voucherCode.length >= 3 && VOUCHER_CODE_PATTERN.test(voucherCode);
  // CR-2 (PR #226): defence-in-depth — a malformed `remainingBalanceMinor`
  // prop (NaN / Infinity / negative / non-integer) would otherwise let
  // `amountIsWellFormed` evaluate `<=` against a non-money value. The
  // upstream caller (PaymentSurface) already guards this, but the
  // Constitution §P-II posture is "validate at every layer that
  // consumes money".
  const remainingBalanceIsValid =
    Number.isSafeInteger(remainingBalanceMinor) && remainingBalanceMinor >= 0;
  const amountIsWellFormed =
    remainingBalanceIsValid &&
    amountAppliedMinor !== null &&
    amountAppliedMinor > 0 &&
    amountAppliedMinor <= remainingBalanceMinor;

  const canSubmit = codeIsWellFormed && amountIsWellFormed && !isApplying;

  const handleSubmit = (): void => {
    // Synchronous ref-lock first — beats React's render-state lag
    // against rapid double-clicks.
    if (submitLockRef.current) {
      return;
    }
    // Use the raw `amountAppliedMinor` null-check as the guard — this
    // narrows the type cleanly. `canSubmit` is a downstream boolean
    // derived from the same value plus the upper-bound check; checking
    // both `amountAppliedMinor !== null` AND `canSubmit` gives the
    // narrowing without tripping eslint's no-unnecessary-condition.
    if (amountAppliedMinor === null || !canSubmit) {
      return;
    }
    submitLockRef.current = true;
    const amount = amountAppliedMinor;
    setBridgeRefusal(false);
    setIsApplying(true);
    void (async (): Promise<void> => {
      try {
        const response = await tenderApply({
          payment_attempt_id: paymentAttemptId,
          tender_type: 'internal_voucher',
          amount_applied_minor: amount,
          voucher_code: voucherCode,
          idempotency_key: generateIdempotencyKey(),
        });
        if (response.kind === 'ok') {
          onApplied?.(response);
          return;
        }
        // F-A4B-003: every refusal reason collapses to one generic copy.
        // The structured `response.reason` is intentionally NOT rendered.
        setBridgeRefusal(true);
      } catch {
        // A rejected bridge call (IPC error / main-process crash /
        // timeout) MUST NOT leave the surface stuck in `isApplying`.
        // Same generic refusal copy — error details stay upstream.
        setBridgeRefusal(true);
      } finally {
        setIsApplying(false);
        submitLockRef.current = false;
      }
    })();
  };

  return (
    <section className="voucher-entry" data-testid="voucher-entry" aria-label="Apply voucher">
      <div className="voucher-entry__remaining" data-testid="voucher-entry-remaining">
        Remaining: {formatMinorUnits(remainingBalanceMinor)}
      </div>

      <label className="voucher-entry__field">
        <span className="voucher-entry__label">Voucher code</span>
        <input
          type="text"
          data-testid="voucher-entry-code-input"
          value={voucherCode}
          onChange={(e) => {
            // Voucher codes are case-sensitive per the OpenAPI snapshot;
            // the cashier types them in upper-case per receipt convention.
            setVoucherCode(e.target.value.toUpperCase());
            if (bridgeRefusal) setBridgeRefusal(false);
          }}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={voucherCode.length > 0 && !codeIsWellFormed ? 'true' : undefined}
        />
      </label>

      <label className="voucher-entry__field">
        <span className="voucher-entry__label">Amount to apply</span>
        <input
          type="text"
          data-testid="voucher-entry-amount-input"
          value={rawAmountInput}
          onChange={(e) => {
            setRawAmountInput(e.target.value);
            if (bridgeRefusal) setBridgeRefusal(false);
          }}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={rawAmountInput.length > 0 && !amountIsWellFormed ? 'true' : undefined}
        />
      </label>

      <button
        type="button"
        className="voucher-entry__confirm"
        data-testid="voucher-entry-confirm"
        style={{ minHeight: touchTarget.min }}
        disabled={!canSubmit}
        aria-disabled={!canSubmit ? 'true' : undefined}
        onClick={handleSubmit}
      >
        Apply voucher
      </button>

      {isApplying && (
        <div data-testid="voucher-entry-applying" aria-busy="true">
          Applying…
        </div>
      )}

      {bridgeRefusal && (
        <div data-testid="voucher-entry-refused" role="alert">
          {GENERIC_VOUCHER_REFUSAL_COPY}
        </div>
      )}
    </section>
  );
}
