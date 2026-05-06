import type { RefusalCategory } from '../../../shared/audit/event-shape.js';

/**
 * 004-operator-session T033 — Surface 6 generic-failure copy.
 *
 * Single generic message family per refusal category (NFR-003 / PR-2).
 * The renderer maps the bridge's RefusalCategory to one of these
 * strings; nothing else is rendered. No factor-distinguishing
 * sub-detail. No interpolated user input.
 *
 * `rate_limited` is the cashier-PIN-lockout exception (PR-2 carve-out).
 * Reachable in S4. The S1 surface never produces it; the string
 * exists here so the mapping is complete and a future S4 reviewer can
 * find the canonical copy in one place.
 */

export const SIGN_IN_REFUSAL_COPY: Readonly<Record<RefusalCategory, string>> = Object.freeze({
  invalid_input: 'Credentials not recognised. Please try again.',
  no_connection: "Can't reach the server. Please try again.",
  rate_limited: 'Too many attempts. Please wait and try again.',
  role_mismatch: 'You do not have access to this surface.',
  not_signed_in: 'Please sign in to continue.',
});

export const EMPTY_INPUT_MESSAGE = 'Enter your credentials to sign in.';
