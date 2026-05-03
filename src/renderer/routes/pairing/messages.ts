import type { PairingOutcome } from '../../../shared/pairing-types';

/**
 * 002-terminal-pairing T043 — operator-facing messages for the
 * recoverable failure outcomes US3 owns.
 *
 * Scope-fence: this module only owns copy for outcomes US3 lands. The
 * three constants below match the message families documented in
 * `contracts/pairing-http.md`. Outcomes US3 does NOT own:
 *
 *   - branch_mismatch (US4)         — must NOT appear here.
 *   - rate_limited    (US5)         — must NOT appear here; the timer
 *                                     surface is also US5.
 *   - network_error   (T074)        — generic fallback only at this
 *                                     stage; T074 lands the friendly
 *                                     copy.
 *   - unknown_error   (T074)        — generic fallback only.
 *
 * The dictionary is intentionally a *function* (`messageFor`) rather
 * than a `Record<PairingOutcome, string>`. A record would force US3
 * to be exhaustive across every outcome category, which violates the
 * scope-fence — the outcomes US3 does not own would either need
 * placeholder copy (which could ship to operators) or a non-exhaustive
 * record (which the type-checker would reject under strict TS). The
 * function form lets US3 own three keys and route every other outcome
 * (including outcomes US3 has explicitly NOT seen) through a generic
 * fallback that T074 will refine.
 *
 * Security: nothing in this module reads the `pairing_code` or any
 * device-side identity. Copy is fixed and includes no user-supplied
 * substitutions — there is no place a secret could be interpolated.
 */

/** Message for `outcome: 'invalid_code'` (HTTP 400 INVALID_CODE). */
export const INVALID_CODE_MESSAGE = 'Code not recognised — check and try again.';

/** Message for `outcome: 'expired_code'` (HTTP 410 EXPIRED_CODE). */
export const EXPIRED_CODE_MESSAGE = 'Code expired — generate a new one.';

/** Message for `outcome: 'already_paired'` (HTTP 409 ALREADY_PAIRED). */
export const ALREADY_PAIRED_MESSAGE = 'This code has already been used.';

/**
 * Generic failure copy for any outcome US3 does not own. T074 will
 * land friendlier per-category copy for `network_error` and
 * `unknown_error`; this string is the placeholder until then. Used by
 * the form when a non-US3 outcome lands (currently `network_error` and
 * `unknown_error`; later `branch_mismatch` will be replaced by US4 and
 * `rate_limited` by US5 BEFORE that fallback fires).
 */
export const GENERIC_FAILURE_MESSAGE = 'Pairing failed — try again.';

/**
 * Client-side validation copy for an empty / whitespace-only submit.
 * Surfaces visibly via `role="status"` so the operator sees a reason
 * instead of a silent no-op (T045).
 */
export const EMPTY_INPUT_MESSAGE = 'Enter a pairing code.';

/**
 * Resolve a `PairingOutcome` to its operator-facing message.
 *
 * Returns the matching US3 message for the three recoverable outcomes
 * this module owns. Every other outcome — including outcomes US3 has
 * explicitly NOT taught the dictionary about — falls through to the
 * generic fallback. This keeps the function safe to call across the
 * full `PairingOutcome` union without coupling US3 to outcomes US4 /
 * US5 / T074 will own.
 */
export function messageFor(outcome: PairingOutcome): string {
  switch (outcome) {
    case 'invalid_code':
      return INVALID_CODE_MESSAGE;
    case 'expired_code':
      return EXPIRED_CODE_MESSAGE;
    case 'already_paired':
      return ALREADY_PAIRED_MESSAGE;
    case 'success':
      // The form navigates on success and the message region unmounts;
      // it is never observed. Returning the generic fallback keeps the
      // function total without a misleading "success" copy.
      return GENERIC_FAILURE_MESSAGE;
    case 'branch_mismatch':
    case 'rate_limited':
    case 'network_error':
    case 'unknown_error':
      // Every non-US3 outcome routes to the generic fallback. US4 / US5
      // / T074 will replace specific cases here as they land.
      return GENERIC_FAILURE_MESSAGE;
  }
}
