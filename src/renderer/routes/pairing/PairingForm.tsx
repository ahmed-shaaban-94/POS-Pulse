import { useRef, useState, type SyntheticEvent, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';

import type { PairingBridgeAPI, PreloadBridgeAPI } from '../../../shared/bridge-api';

/**
 * 002-terminal-pairing T029 + T034 — `PairingForm`.
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
 *   2. The only `useState` is the in-flight `submitting` flag. That flag
 *      gates re-entry (a second Enter while the first call is still
 *      pending is dropped) and disables the submit button.
 *
 *   3. On `outcome === 'success'` the form calls
 *      `navigate('/paired', { replace: true })`. PairedScreen calls
 *      `getStatus()` itself on mount, so the navigation lands on a
 *      route that fetches its own data — we are not coupling the form
 *      to the boot router's state.
 *
 *   4. NO outcome-specific copy. T029 / T034 do not require it; T074
 *      (Phase Final) lands the message dictionary. The form is
 *      correct-but-coarse on every non-success outcome — re-enables
 *      and stays editable so the operator can retry.
 *
 * Security policy (Constitution VII + spec NFR-4 / FR-9 / FR-10):
 *   - The `pairing_code` lives in the input element's value (controlled
 *     uncontrolled hybrid: ref-driven, but the input IS what holds it).
 *     It is never written to a logger, never echoed to a status line.
 *   - On success the form navigates away; the input unmounts and React
 *     drops the value.
 *   - The bridge's submit return type omits `device_token` by
 *     construction (PR #15 / PR #17), so even if the form rendered
 *     `result` it could not leak the token.
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
  const navigate = useNavigate();

  const pairing = props.pairing ?? readBridge();

  async function performSubmit(): Promise<void> {
    if (submitting) return;
    const code = inputRef.current?.value.trim() ?? '';
    if (code.length === 0) return; // empty / whitespace-only is a no-op

    setSubmitting(true);
    try {
      const result = await pairing.submit(code);
      if (result.outcome === 'success') {
        void navigate('/paired', { replace: true });
        return;
      }
      // Non-success outcomes (network_error / unknown_error in US2; US3+
      // adds typed branches). The form re-enables; the operator can
      // retry. No outcome-specific copy here — that lands in T074.
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
