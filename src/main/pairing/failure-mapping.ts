import type { PairingOutcome } from '../../shared/pairing-types.js';

/**
 * 002-terminal-pairing T020 + T037 — pure mapping from a non-2xx HTTP
 * envelope to a `PairingOutcome` category.
 *
 * US2 (T020) shipped:
 *   - the success-path guard ("called with 2xx is a programmer error"),
 *   - a defensive default of `'unknown_error'` for any non-2xx whose
 *     body code is not yet recognised.
 *
 * US3 (T037) adds the recoverable-failure branches documented in
 * `contracts/pairing-http.md`:
 *   - INVALID_CODE   -> 'invalid_code'
 *   - EXPIRED_CODE   -> 'expired_code'
 *   - ALREADY_PAIRED -> 'already_paired'
 *
 * Still deferred (intentionally — the catch-all keeps the door open):
 *   - BRANCH_MISMATCH-> 'branch_mismatch' (US4)
 *   - RATE_LIMITED   -> 'rate_limited'    (US5; will also surface
 *                                          retry_after_s on the failure
 *                                          envelope, parsed by network.ts)
 *
 * Discriminator policy: the function reads `body.code` only. HTTP status
 * is NOT the routing key — `409` is shared between `ALREADY_PAIRED` (US3)
 * and the future `BRANCH_MISMATCH` (US4), so a status-based switch would
 * conflate them. Routing on `body.code` keeps the two branches distinct
 * and lets US4 land cleanly without touching this function's contract.
 *
 * The function is pure: same input -> same output, no side effects, no
 * I/O. That makes it trivial to test exhaustively per case.
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

  // Body-code switch (NOT a status switch). US3 lands the three
  // recoverable-failure branches; US4/US5 extend this list without
  // changing the function's contract. The catch-all 'unknown_error'
  // covers every unrecognised body code, including BRANCH_MISMATCH
  // (US4) and RATE_LIMITED (US5) until those tasks land.
  switch (body.code) {
    case 'INVALID_CODE':
      return 'invalid_code';
    case 'EXPIRED_CODE':
      return 'expired_code';
    case 'ALREADY_PAIRED':
      return 'already_paired';
    default:
      return 'unknown_error';
  }
}
