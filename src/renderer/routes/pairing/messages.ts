import type { PairingOutcome } from '../../../shared/pairing-types';

/**
 * 002-terminal-pairing T043 + T051 + T057 — operator-facing messages
 * for the recoverable failure outcomes US3/US4/US5 own.
 *
 * Scope-fence: this module only owns copy for outcomes US3 + US4 + US5
 * land. The five constants below match the message families documented
 * in `contracts/pairing-http.md`. Outcomes still NOT owned here:
 *
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
 * strict TS). The function form lets US3+US4+US5 own five keys and
 * route every other outcome through a generic fallback that T074 will
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
 * Message for `outcome: 'rate_limited'` (HTTP 429 RATE_LIMITED). Pairs
 * with the disabled-submit timer in `PairingForm`: the message stays
 * visible while the button is disabled; both clear when the timer
 * expires (button re-enables; the message persists until the next
 * submit). Copy MUST contain the phrase "too many attempts" so the
 * operator-recognisable family is stable across copy edits — pinned
 * by the case-insensitive regex in PairingForm.test.tsx (T056).
 */
export const RATE_LIMITED_MESSAGE = 'Too many attempts — wait a moment and try again.';

/**
 * Generic failure copy for any outcome the dictionary does not yet own.
 * T074 will land friendlier per-category copy for `network_error` and
 * `unknown_error`; this string is the placeholder until then. Used by
 * the form when an outcome still in the catch-all lands (currently
 * `network_error` and `unknown_error`).
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
 * Returns the matching message for the five recoverable outcomes this
 * module owns (three from US3, one from US4, one from US5). Every
 * other outcome — including outcomes the dictionary has explicitly
 * NOT taught itself about — falls through to the generic fallback.
 * This keeps the function safe to call across the full `PairingOutcome`
 * union without coupling US3/US4/US5 to outcomes T074 will own.
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
    case 'rate_limited':
      return RATE_LIMITED_MESSAGE;
    case 'success':
      // The form navigates on success and the message region unmounts;
      // it is never observed. Returning the generic fallback keeps the
      // function total without a misleading "success" copy.
      return GENERIC_FAILURE_MESSAGE;
    case 'network_error':
    case 'unknown_error':
      // Outcomes still in the catch-all route to the generic fallback.
      // T074 will replace specific cases here as they land.
      return GENERIC_FAILURE_MESSAGE;
  }
}
