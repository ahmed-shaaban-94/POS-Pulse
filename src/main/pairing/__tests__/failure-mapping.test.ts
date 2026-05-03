import { describe, expect, it } from 'vitest';

import { mapFailure } from '../failure-mapping.js';

/**
 * 002-terminal-pairing T018 — `mapFailure` success-path guard.
 *
 * `mapFailure` is the pure function the service uses to translate a
 * non-2xx backend envelope into a `PairingOutcome`. US2 lands ONLY the
 * success-path guard: calling it with a 2xx status is a programmer
 * error and MUST throw — that protects the service from accidentally
 * routing a successful response down a "failure" code path.
 *
 * Per-outcome branches (INVALID_CODE, EXPIRED_CODE, ALREADY_PAIRED,
 * BRANCH_MISMATCH, RATE_LIMITED) land in US3 / US4 / US5 and are NOT
 * tested here. The catch-all "unknown body shape -> unknown_error,
 * never throws" is the service's responsibility (T023a) at this stage.
 *
 * Tasks: T018 (test) -> T020 (impl).
 */

describe('mapFailure — success-path guard (T018)', () => {
  it('throws when called with status === 200 (programmer error)', () => {
    expect(() => mapFailure(200, { code: 'anything' })).toThrow(/programmer error|2xx|success/i);
  });

  it('throws for any 2xx status (the contract is "non-success only")', () => {
    for (const status of [200, 201, 202, 204, 206, 299]) {
      expect(() => mapFailure(status, {})).toThrow(/programmer error|2xx|success/i);
    }
  });

  it('returns "unknown_error" for an unrecognised body code on a non-2xx response', () => {
    // Defensive default: any body code that US3/US4/US5 has not yet
    // taught the function to recognise becomes "unknown_error". US2 only
    // ships the guard + this default; per-outcome branches are deferred.
    expect(mapFailure(400, { code: 'WHATEVER' })).toBe('unknown_error');
    expect(mapFailure(500, {})).toBe('unknown_error');
    expect(mapFailure(409, { code: 'NOT_YET_RECOGNISED' })).toBe('unknown_error');
  });

  it('never throws for a non-2xx status (always returns a PairingOutcome)', () => {
    // The function only throws on programmer error (2xx). Every other
    // input MUST resolve to a typed outcome. This pins the catch-all
    // shape for US3+: future code MUST extend the recognised-codes
    // table without ever reintroducing a throw on non-2xx.
    for (const status of [400, 401, 403, 404, 409, 410, 422, 429, 500, 502, 503]) {
      expect(() => mapFailure(status, { code: 'UNKNOWN' })).not.toThrow();
      expect(() => mapFailure(status, {})).not.toThrow();
      expect(() => mapFailure(status, { weird: 'shape' })).not.toThrow();
    }
  });
});
