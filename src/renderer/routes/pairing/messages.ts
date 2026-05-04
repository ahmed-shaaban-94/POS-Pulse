import type { PairingOutcome } from '../../../shared/pairing-types';

/**
 * 002-terminal-pairing T043 + T051 — operator-facing messages for the
 * recoverable failure outcomes US3/US4 own.
 *
 * Scope-fence: this module only owns copy for outcomes US3 + US4 land.
 * The four constants below match the message families documented in
 * `contracts/pairing-http.md`. Outcomes still NOT owned here:
 *
 *   - rate_limited    (US5)         — must NOT appear here; the timer
 *                                     surface is also US5.
 *   - network_error   (T074)        — generic fallback only at this
 *                                     stage; T074 lands the friendly
 *                                     copy.
 *   - unknown_error   (T074)        — generic fallback only.
 *
 * The dictionary is intentionally a *function* (`messageFor`) rather
 * than a `Record<PairingOutcome, string>`. A record would force the
 * dictionary to be exhaustive across every outcome category, which
 * violates the scope-fence — the outcomes still deferred would either
 * need placeholder copy (which could ship to operators) or a
 * non-exhaustive record (which the type-checker would reject under
 * strict TS). The function form lets US3+US4 own four keys and route
 * every other outcome through a generic fallback that US5 / T074 will
 * refine.
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
 * Message for `outcome: 'branch_mismatch'` (HTTP 409 BRANCH_MISMATCH).
 * Per the 2026-05-03 clarification (Option B), recovery is admin-driven
 * — the operator's action is to escalate, not to retry the same code.
 * Copy is from `contracts/pairing-http.md` § Failure responses.
 */
export const BRANCH_MISMATCH_MESSAGE =
  'Terminal registered to another branch — ask admin to release it.';

/**
 * Generic failure copy for any outcome the dictionary does not yet own.
 * T074 will land friendlier per-category copy for `network_error` and
 * `unknown_error`; this string is the placeholder until then. Used by
 * the form when an outcome still in the catch-all lands (currently
 * `network_error` and `unknown_error`; `rate_limited` will be replaced
 * by US5 BEFORE that fallback fires).
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
 * Returns the matching message for the four recoverable outcomes this
 * module owns (three from US3, one from US4). Every other outcome —
 * including outcomes the dictionary has explicitly NOT taught itself
 * about — falls through to the generic fallback. This keeps the
 * function safe to call across the full `PairingOutcome` union without
 * coupling US3/US4 to outcomes US5 / T074 will own.
 */
export function messageFor(outcome: PairingOutcome): string {
  switch (outcome) {
    case 'invalid_code':
      return INVALID_CODE_MESSAGE;
    case 'expired_code':
      return EXPIRED_CODE_MESSAGE;
    case 'already_paired':
      return ALREADY_PAIRED_MESSAGE;
    case 'branch_mismatch':
      return BRANCH_MISMATCH_MESSAGE;
    case 'success':
      // The form navigates on success and the message region unmounts;
      // it is never observed. Returning the generic fallback keeps the
      // function total without a misleading "success" copy.
      return GENERIC_FAILURE_MESSAGE;
    case 'rate_limited':
    case 'network_error':
    case 'unknown_error':
      // Outcomes still in the catch-all route to the generic fallback.
      // US5 / T074 will replace specific cases here as they land.
      return GENERIC_FAILURE_MESSAGE;
  }
}
