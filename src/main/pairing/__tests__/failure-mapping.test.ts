import { describe, expect, it } from 'vitest';

import { mapFailure } from '../failure-mapping.js';

/**
 * 002-terminal-pairing T018 + T036 — `mapFailure` tests.
 *
 * `mapFailure` is the pure function the service uses to translate a
 * non-2xx backend envelope into a `PairingOutcome`. US2 (T018) lands the
 * success-path guard + the defensive default. US3 (T036) extends it
 * with the three recoverable-failure body codes documented in
 * `contracts/pairing-http.md`:
 *
 *   400 INVALID_CODE   -> 'invalid_code'
 *   410 EXPIRED_CODE   -> 'expired_code'
 *   409 ALREADY_PAIRED -> 'already_paired'
 *
 * BRANCH_MISMATCH (US4) and RATE_LIMITED (US5) are deliberately NOT
 * tested here — those branches must remain unrecognised at this stage
 * and route through the catch-all 'unknown_error' default. That keeps
 * the body-code switch open for US4/US5 to extend without touching
 * US3's contract.
 *
 * Discriminator: `body.code`, not the HTTP status. The status comes
 * along for parity with the contract, but routing is body-code driven —
 * `409` is shared between `ALREADY_PAIRED` and the future US4
 * `BRANCH_MISMATCH`, so the function MUST NOT key off status alone.
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

/* ------------------------- T036 ------------------------- */

describe('mapFailure — recoverable failure branches (T036)', () => {
  it('INVALID_CODE -> "invalid_code"', () => {
    expect(mapFailure(400, { code: 'INVALID_CODE' })).toBe('invalid_code');
  });

  it('INVALID_CODE with the documented {code, message} envelope -> "invalid_code"', () => {
    expect(mapFailure(400, { code: 'INVALID_CODE', message: 'Code not recognised.' })).toBe(
      'invalid_code',
    );
  });

  it('EXPIRED_CODE -> "expired_code"', () => {
    expect(mapFailure(410, { code: 'EXPIRED_CODE' })).toBe('expired_code');
  });

  it('EXPIRED_CODE with the documented {code, message} envelope -> "expired_code"', () => {
    expect(mapFailure(410, { code: 'EXPIRED_CODE', message: 'Code expired.' })).toBe(
      'expired_code',
    );
  });

  it('ALREADY_PAIRED -> "already_paired"', () => {
    expect(mapFailure(409, { code: 'ALREADY_PAIRED' })).toBe('already_paired');
  });

  it('ALREADY_PAIRED with the documented {code, message} envelope -> "already_paired"', () => {
    expect(mapFailure(409, { code: 'ALREADY_PAIRED', message: 'Code already used.' })).toBe(
      'already_paired',
    );
  });

  it('routes by body.code, not HTTP status (e.g., INVALID_CODE on a non-400 status)', () => {
    // Defensive: if the backend ever returns INVALID_CODE on a different
    // status (e.g., 422), the body code MUST still drive the outcome.
    // Status is informational, not the discriminator.
    expect(mapFailure(422, { code: 'INVALID_CODE' })).toBe('invalid_code');
    expect(mapFailure(500, { code: 'INVALID_CODE' })).toBe('invalid_code');
  });

  it('shares HTTP status 409 between ALREADY_PAIRED and the future BRANCH_MISMATCH (US4)', () => {
    // 409 is documented for BOTH ALREADY_PAIRED (US3) and BRANCH_MISMATCH
    // (US4). US3 must recognise ALREADY_PAIRED only; BRANCH_MISMATCH
    // remains unrecognised here and routes through the catch-all
    // 'unknown_error'. US4 will add the BRANCH_MISMATCH branch.
    expect(mapFailure(409, { code: 'ALREADY_PAIRED' })).toBe('already_paired');
    expect(mapFailure(409, { code: 'BRANCH_MISMATCH' })).toBe('unknown_error');
  });

  it('does NOT recognise BRANCH_MISMATCH (US4 scope) — falls through to "unknown_error"', () => {
    // Explicit US3 scope-fence: BRANCH_MISMATCH must remain in the
    // catch-all until US4 lands its branch.
    expect(mapFailure(409, { code: 'BRANCH_MISMATCH' })).toBe('unknown_error');
  });

  it('does NOT recognise RATE_LIMITED (US5 scope) — falls through to "unknown_error"', () => {
    // Explicit US3 scope-fence: RATE_LIMITED must remain in the catch-all
    // until US5 lands its branch (and the Retry-After parsing).
    expect(mapFailure(429, { code: 'RATE_LIMITED' })).toBe('unknown_error');
  });

  it('unknown body shape -> "unknown_error", never throws (catch-all preserved)', () => {
    // Belt-and-braces re-assertion of the US2 catch-all from T018: any
    // body shape the function does not recognise becomes 'unknown_error',
    // and the function never throws on a non-2xx status.
    expect(mapFailure(400, { code: 'WHATEVER' })).toBe('unknown_error');
    expect(mapFailure(400, {})).toBe('unknown_error');
    expect(mapFailure(500, { weird: 'shape' })).toBe('unknown_error');
    expect(mapFailure(503, { code: null as unknown as string })).toBe('unknown_error');
    expect(() => mapFailure(400, { code: 'WHATEVER' })).not.toThrow();
    expect(() => mapFailure(500, {})).not.toThrow();
  });

  it('case-sensitive body.code matching (lowercase variants are NOT recognised)', () => {
    // The contract specifies UPPER_CASE codes verbatim. A lowercase
    // variant is treated as unknown rather than silently coerced.
    expect(mapFailure(400, { code: 'invalid_code' })).toBe('unknown_error');
    expect(mapFailure(410, { code: 'expired_code' })).toBe('unknown_error');
    expect(mapFailure(409, { code: 'already_paired' })).toBe('unknown_error');
  });
});
