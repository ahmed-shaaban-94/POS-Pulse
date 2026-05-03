import { useRef, useState, type SyntheticEvent, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageFor, EMPTY_INPUT_MESSAGE } from './messages';
import type { PairingBridgeAPI, PreloadBridgeAPI } from '../../../shared/bridge-api';

/**
 * 002-terminal-pairing T029 + T034 + T043 + T045 — `PairingForm`.
 *
 * Single-input form that drives the pairing submit flow. Accepts both
 * manual entry (operator types code + Enter or click) and wedge-scanner
 * input (keystrokes followed by Enter, treated as a regular keyboard;
 * research §6).
 *
 * Critical implementation choices:
 *
 *   1. The current input value is read via a `ref`, not via `useState`.
 *      `userEvent.keyboard('CODE{Enter}')` and a real wedge scanner
 *      both fire keys synchronously; React 19's batched state updates
 *      mean a stale `useState` read can produce an empty submit. The
 *      ref always reflects the live DOM value.
 *
 *   2. `useState` holds two pieces of state:
 *      - `submitting` — gates re-entry (a second Enter while the first
 *        call is still pending is dropped) and disables the submit
 *        button.
 *      - `statusMessage` — the operator-facing message rendered in a
 *        `role="status"` region. `null` when the form is idle; the
 *        empty-input validation copy on a no-content submit (T045);
 *        the outcome's message family on a non-success result (T043).
 *
 *   3. On `outcome === 'success'` the form calls
 *      `navigate('/paired', { replace: true })`. PairedScreen calls
 *      `getStatus()` itself on mount, so the navigation lands on a
 *      route that fetches its own data — we are not coupling the form
 *      to the boot router's state.
 *
 *   4. Per-outcome copy lives in `./messages.ts`. US3 owns the three
 *      recoverable-failure outcomes (invalid_code / expired_code /
 *      already_paired); every other non-success outcome (network_error,
 *      unknown_error, the future US4/US5 outcomes) routes through the
 *      generic fallback in `messageFor()` until T074 / US4 / US5 land
 *      their own copy.
 *
 * Security policy (Constitution VII + spec NFR-4 / FR-9 / FR-10):
 *   - The `pairing_code` lives in the input element's value (controlled
 *     uncontrolled hybrid: ref-driven, but the input IS what holds it).
 *     It is never written to a logger, never interpolated into the
 *     status message, never echoed to any text node outside the input.
 *   - On success the form navigates away; the input unmounts and React
 *     drops the value.
 *   - The bridge's submit return type omits `device_token` by
 *     construction (PR #15 / PR #17), so even if the form rendered
 *     `result` it could not leak the token. The status message comes
 *     from a fixed string table in `./messages.ts` — there is no place
 *     to interpolate a secret.
 */

export interface PairingFormProps {
  /**
   * Bridge to the main process. Tests inject a fake; production reads
   * from `window.api.pairing`.
   */
  pairing?: PairingBridgeAPI;
}

export function PairingForm(props: PairingFormProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const pairing = props.pairing ?? readBridge();

  async function performSubmit(): Promise<void> {
    if (submitting) return;
    const code = inputRef.current?.value.trim() ?? '';
    if (code.length === 0) {
      // T045: visible client-side validation. Replaces the silent
      // no-op the form had in US2. No bridge call; the operator sees
      // why nothing happened.
      setStatusMessage(EMPTY_INPUT_MESSAGE);
      return;
    }

    setSubmitting(true);
    // Clear any prior message so a stale failure copy does not visually
    // stack with the in-flight state.
    setStatusMessage(null);
    try {
      const result = await pairing.submit(code);
      if (result.outcome === 'success') {
        void navigate('/paired', { replace: true });
        return;
      }
      // Non-success outcomes (US3 wires invalid_code / expired_code /
      // already_paired; other categories route through the generic
      // fallback until T074 / US4 / US5 land their copy). The form
      // re-enables and stays editable so the operator can retry.
      setStatusMessage(messageFor(result.outcome));
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void performSubmit();
  }

  return (
    <form onSubmit={onSubmit} aria-label="Pair terminal">
      <label htmlFor="pairing-code">Pairing code</label>
      <input
        id="pairing-code"
        ref={inputRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Pairing…' : 'Pair terminal'}
      </button>
      {statusMessage !== null ? (
        <p role="status" data-testid="pairing-message">
          {statusMessage}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Read `window.api.pairing` defensively. The bridge is exposed by the
 * preload script before the renderer mounts, so this read is safe in
 * production. In test environments without a bridge, callers MUST pass
 * the `pairing` prop — we throw a clear error rather than coerce.
 */
function readBridge(): PairingBridgeAPI {
  const api = (window as unknown as { api?: PreloadBridgeAPI }).api;
  if (!api) {
    throw new Error('PairingForm: window.api missing — preload bridge not initialised.');
  }
  return api.pairing;
}
