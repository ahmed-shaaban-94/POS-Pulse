import { describe, expect, it } from 'vitest';

import {
  ALREADY_PAIRED_MESSAGE,
  BRANCH_MISMATCH_MESSAGE,
  EMPTY_INPUT_MESSAGE,
  EXPIRED_CODE_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
  INVALID_CODE_MESSAGE,
  RATE_LIMITED_MESSAGE,
  messageFor,
} from '../messages';
import type { PairingOutcome } from '../../../../shared/pairing-types';

/**
 * 002-terminal-pairing T043 + T051 + T057 — `messageFor` direct coverage.
 *
 * The form-level tests in `PairingForm.test.tsx` cover the user-facing
 * paths through `messageFor` (US3 + US4 + US5 outcomes + the generic
 * fallback for network_error / unknown_error). This file pins every
 * branch of the function directly so the dictionary's contract stays
 * stable as T074 adds per-outcome copy for the remaining categories.
 *
 * Critical scope-fence assertions:
 *   - Outcomes still in the catch-all (T074 network_error /
 *     unknown_error) must route through GENERIC_FAILURE_MESSAGE —
 *     they MUST NOT silently reuse a US3/US4/US5 message.
 *   - The success outcome (which the form never observes — it
 *     navigates first) returns the generic fallback rather than a
 *     misleading "success" string.
 */

describe('messageFor — US3 outcomes (T043)', () => {
  it('invalid_code -> INVALID_CODE_MESSAGE', () => {
    expect(messageFor('invalid_code')).toBe(INVALID_CODE_MESSAGE);
  });

  it('expired_code -> EXPIRED_CODE_MESSAGE', () => {
    expect(messageFor('expired_code')).toBe(EXPIRED_CODE_MESSAGE);
  });

  it('already_paired -> ALREADY_PAIRED_MESSAGE', () => {
    expect(messageFor('already_paired')).toBe(ALREADY_PAIRED_MESSAGE);
  });
});

describe('messageFor — US4 outcome (T051)', () => {
  it('branch_mismatch -> BRANCH_MISMATCH_MESSAGE', () => {
    expect(messageFor('branch_mismatch')).toBe(BRANCH_MISMATCH_MESSAGE);
  });
});

describe('messageFor — US5 outcome (T057)', () => {
  it('rate_limited -> RATE_LIMITED_MESSAGE', () => {
    expect(messageFor('rate_limited')).toBe(RATE_LIMITED_MESSAGE);
  });

  it('RATE_LIMITED_MESSAGE matches the /too many attempts/i family copy', () => {
    // Pin the action-oriented family so a future copy edit cannot
    // silently drop the operator-recognisable phrase. Same regex used
    // in PairingForm.test.tsx (T056).
    expect(RATE_LIMITED_MESSAGE).toMatch(/too many attempts/i);
  });
});

describe('messageFor — outcomes still in the catch-all (route to generic fallback)', () => {
  it('network_error (T074) -> GENERIC_FAILURE_MESSAGE', () => {
    expect(messageFor('network_error')).toBe(GENERIC_FAILURE_MESSAGE);
  });

  it('unknown_error (T074) -> GENERIC_FAILURE_MESSAGE', () => {
    expect(messageFor('unknown_error')).toBe(GENERIC_FAILURE_MESSAGE);
  });

  it('success outcome -> GENERIC_FAILURE_MESSAGE (never observed; form navigates first)', () => {
    // The form never renders messageFor('success') because it navigates
    // away on the success branch. The function nevertheless covers the
    // case totally so the type is exhaustive — the chosen string is
    // intentionally the generic fallback rather than misleading copy.
    expect(messageFor('success')).toBe(GENERIC_FAILURE_MESSAGE);
  });
});

describe('messages dictionary — distinct constants', () => {
  it('the three US3 messages are pairwise distinct', () => {
    const set = new Set([INVALID_CODE_MESSAGE, EXPIRED_CODE_MESSAGE, ALREADY_PAIRED_MESSAGE]);
    expect(set.size).toBe(3);
  });

  it('the four US3+US4 messages are pairwise distinct', () => {
    const set = new Set([
      INVALID_CODE_MESSAGE,
      EXPIRED_CODE_MESSAGE,
      ALREADY_PAIRED_MESSAGE,
      BRANCH_MISMATCH_MESSAGE,
    ]);
    expect(set.size).toBe(4);
  });

  it('the five US3+US4+US5 messages are pairwise distinct', () => {
    const set = new Set([
      INVALID_CODE_MESSAGE,
      EXPIRED_CODE_MESSAGE,
      ALREADY_PAIRED_MESSAGE,
      BRANCH_MISMATCH_MESSAGE,
      RATE_LIMITED_MESSAGE,
    ]);
    expect(set.size).toBe(5);
  });

  it('the generic failure fallback is distinct from the five US3+US4+US5 messages', () => {
    const set = new Set([
      INVALID_CODE_MESSAGE,
      EXPIRED_CODE_MESSAGE,
      ALREADY_PAIRED_MESSAGE,
      BRANCH_MISMATCH_MESSAGE,
      RATE_LIMITED_MESSAGE,
      GENERIC_FAILURE_MESSAGE,
    ]);
    expect(set.size).toBe(6);
  });

  it('the empty-input validation message is distinct from every failure message', () => {
    const set = new Set([
      EMPTY_INPUT_MESSAGE,
      INVALID_CODE_MESSAGE,
      EXPIRED_CODE_MESSAGE,
      ALREADY_PAIRED_MESSAGE,
      BRANCH_MISMATCH_MESSAGE,
      RATE_LIMITED_MESSAGE,
      GENERIC_FAILURE_MESSAGE,
    ]);
    expect(set.size).toBe(7);
  });

  it('every message is a non-empty string (operator must always see something)', () => {
    for (const msg of [
      INVALID_CODE_MESSAGE,
      EXPIRED_CODE_MESSAGE,
      ALREADY_PAIRED_MESSAGE,
      BRANCH_MISMATCH_MESSAGE,
      RATE_LIMITED_MESSAGE,
      GENERIC_FAILURE_MESSAGE,
      EMPTY_INPUT_MESSAGE,
    ]) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('every PairingOutcome maps to a non-empty message (totality)', () => {
    const all: PairingOutcome[] = [
      'success',
      'invalid_code',
      'expired_code',
      'already_paired',
      'branch_mismatch',
      'rate_limited',
      'network_error',
      'unknown_error',
    ];
    for (const outcome of all) {
      const msg = messageFor(outcome);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
