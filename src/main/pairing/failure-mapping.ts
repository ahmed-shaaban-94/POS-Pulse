import type { PairingOutcome } from '../../shared/pairing-types.js';

/**
 * 002-terminal-pairing T020 — pure mapping from a non-2xx HTTP envelope
 * to a `PairingOutcome` category.
 *
 * US2 ships ONLY:
 *   - the success-path guard ("called with 2xx is a programmer error"),
 *   - a defensive default of `'unknown_error'` for any non-2xx whose
 *     body code is not yet recognised.
 *
 * US3 / US4 / US5 extend this function with per-outcome branches:
 *   - INVALID_CODE   -> 'invalid_code'    (US3)
 *   - EXPIRED_CODE   -> 'expired_code'    (US3)
 *   - ALREADY_PAIRED -> 'already_paired'  (US3)
 *   - BRANCH_MISMATCH-> 'branch_mismatch' (US4)
 *   - RATE_LIMITED   -> 'rate_limited'    (US5)
 *
 * The function is pure: same input -> same output, no side effects, no
 * I/O. That makes it trivial to test exhaustively per case once the
 * branches land.
 *
 * Security: this function never receives the `pairing_code` and does not
 * log. The body argument is structurally typed and only the `code`
 * field is read.
 */

/**
 * Body shape `mapFailure` reads. Modelled loosely so we can also accept
 * arbitrary shapes without throwing — the spec contract calls for a
 * `{ code, message }` envelope, but we defensively tolerate anything.
 */
export interface FailureBody {
  code?: string;
  // Other backend-supplied fields are tolerated but ignored.
  [key: string]: unknown;
}

/**
 * Translate a non-2xx HTTP response (status + parsed body) into a
 * PairingOutcome category. Throws ONLY when called with a 2xx status —
 * that is a programmer error (the service has the success branch and
 * MUST NOT route 2xx through here).
 *
 * @param status — HTTP status code from the response. MUST be non-2xx.
 * @param body   — Parsed JSON body. May be any shape; we read `code`
 *                 defensively.
 */
export function mapFailure(status: number, body: FailureBody): PairingOutcome {
  if (status >= 200 && status < 300) {
    throw new Error(
      'mapFailure called with success status (2xx) — programmer error. ' +
        'The service must route 2xx responses down the success path.',
    );
  }

  // US3 / US4 / US5 will extend this switch. US2 ships only the
  // defensive default so the bridge contract holds from MVP onward.
  // `body` is reserved for the future per-outcome branches (it carries
  // `code` for the typed envelope); ignored at this stage.
  void body;
  return 'unknown_error';
}
