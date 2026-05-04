import { describe, expect, it } from 'vitest';

import { mapFailure } from '../failure-mapping.js';

/**
 * 002-terminal-pairing T018 + T036 + T046 + T054 — `mapFailure` tests.
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
 * US4 (T046) adds:
 *
 *   409 BRANCH_MISMATCH -> 'branch_mismatch'
 *
 * US5 (T054) adds:
 *
 *   429 RATE_LIMITED   -> 'rate_limited'
 *
 * Discriminator: `body.code`, not the HTTP status. The status comes
 * along for parity with the contract, but routing is body-code driven —
 * `409` is shared between `ALREADY_PAIRED` (US3) and `BRANCH_MISMATCH`
 * (US4), so the function MUST NOT key off status alone. Note also
 * that `mapFailure` is a pure status+body→outcome function: it does
 * NOT touch `retry_after_s` (which lives on the surrounding
 * `PairResult` envelope, parsed by `network.ts`).
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

  it('shares HTTP status 409 between ALREADY_PAIRED (US3) and BRANCH_MISMATCH (US4)', () => {
    // 409 is documented for BOTH ALREADY_PAIRED and BRANCH_MISMATCH.
    // The two MUST resolve to distinct outcomes via body.code routing —
    // a status-only switch would conflate them. US4 (T046) lands the
    // BRANCH_MISMATCH branch; this test pins both 409 mappings.
    expect(mapFailure(409, { code: 'ALREADY_PAIRED' })).toBe('already_paired');
    expect(mapFailure(409, { code: 'BRANCH_MISMATCH' })).toBe('branch_mismatch');
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

/* ------------------------- T046 ------------------------- */

describe('mapFailure — BRANCH_MISMATCH branch (T046)', () => {
  it('BRANCH_MISMATCH -> "branch_mismatch"', () => {
    expect(mapFailure(409, { code: 'BRANCH_MISMATCH' })).toBe('branch_mismatch');
  });

  it('BRANCH_MISMATCH with the documented {code, message} envelope -> "branch_mismatch"', () => {
    expect(
      mapFailure(409, {
        code: 'BRANCH_MISMATCH',
        message: 'Terminal registered to a different branch.',
      }),
    ).toBe('branch_mismatch');
  });

  it('routes by body.code, not HTTP status (BRANCH_MISMATCH on a non-409 status)', () => {
    // Defensive: if the backend ever returns BRANCH_MISMATCH on a
    // different status, the body code MUST still drive the outcome.
    // Status is informational, not the discriminator (status 409 is
    // shared with ALREADY_PAIRED — body.code is what splits them).
    expect(mapFailure(422, { code: 'BRANCH_MISMATCH' })).toBe('branch_mismatch');
    expect(mapFailure(500, { code: 'BRANCH_MISMATCH' })).toBe('branch_mismatch');
  });

  it('BRANCH_MISMATCH does NOT throw (catch-all invariant preserved)', () => {
    // The function only throws on programmer error (2xx status). The
    // new BRANCH_MISMATCH branch MUST keep that invariant.
    expect(() => mapFailure(409, { code: 'BRANCH_MISMATCH' })).not.toThrow();
    expect(() => mapFailure(409, { code: 'BRANCH_MISMATCH', message: 'x' })).not.toThrow();
  });

  it('case-sensitive matching (lowercase "branch_mismatch" NOT recognised)', () => {
    // The contract specifies the UPPER_CASE code verbatim. Lowercase
    // variants are treated as unknown rather than silently coerced.
    expect(mapFailure(409, { code: 'branch_mismatch' })).toBe('unknown_error');
    expect(mapFailure(409, { code: 'Branch_Mismatch' })).toBe('unknown_error');
  });

  it('US3 + US4 outcomes coexist: each body.code resolves to its own outcome', () => {
    // Cross-test that adding the BRANCH_MISMATCH branch did not
    // accidentally re-route any of the three US3 outcomes.
    expect(mapFailure(400, { code: 'INVALID_CODE' })).toBe('invalid_code');
    expect(mapFailure(410, { code: 'EXPIRED_CODE' })).toBe('expired_code');
    expect(mapFailure(409, { code: 'ALREADY_PAIRED' })).toBe('already_paired');
    expect(mapFailure(409, { code: 'BRANCH_MISMATCH' })).toBe('branch_mismatch');
  });
});

/* ------------------------- T054 ------------------------- */

describe('mapFailure — RATE_LIMITED branch (T054)', () => {
  it('RATE_LIMITED -> "rate_limited"', () => {
    expect(mapFailure(429, { code: 'RATE_LIMITED' })).toBe('rate_limited');
  });

  it('RATE_LIMITED with the documented {code, message} envelope -> "rate_limited"', () => {
    expect(
      mapFailure(429, {
        code: 'RATE_LIMITED',
        message: 'Too many attempts.',
      }),
    ).toBe('rate_limited');
  });

  it('routes by body.code, not HTTP status (RATE_LIMITED on a non-429 status)', () => {
    // Defensive: even if the backend mis-issues RATE_LIMITED on a
    // different status, the body code drives the outcome. Note that
    // network.ts gates retry_after_s on status === 429 specifically,
    // so the timer surface won't fire here — but the outcome category
    // is still routed correctly.
    expect(mapFailure(503, { code: 'RATE_LIMITED' })).toBe('rate_limited');
    expect(mapFailure(400, { code: 'RATE_LIMITED' })).toBe('rate_limited');
  });

  it('RATE_LIMITED does NOT throw (catch-all invariant preserved)', () => {
    expect(() => mapFailure(429, { code: 'RATE_LIMITED' })).not.toThrow();
    expect(() => mapFailure(429, { code: 'RATE_LIMITED', message: 'x' })).not.toThrow();
  });

  it('case-sensitive matching (lowercase "rate_limited" NOT recognised)', () => {
    // The contract specifies the UPPER_CASE code verbatim.
    expect(mapFailure(429, { code: 'rate_limited' })).toBe('unknown_error');
    expect(mapFailure(429, { code: 'Rate_Limited' })).toBe('unknown_error');
  });

  it('mapFailure does NOT touch retry_after_s (pure status+body->outcome)', () => {
    // Belt-and-braces: the function signature accepts only (status,
    // body) — it never sees retry_after_s. This test pins the surface
    // by passing a body with a `retry_after_s` field and asserting
    // the function still routes purely on `code`. The field flows
    // around mapFailure via the surrounding PairResult envelope.
    const bodyWithExtra = {
      code: 'RATE_LIMITED',
      message: 'slow down',
      retry_after_s: 99, // ignored by mapFailure
    };
    expect(mapFailure(429, bodyWithExtra)).toBe('rate_limited');
  });

  it('US3 + US4 + US5 outcomes coexist: each body.code resolves to its own outcome', () => {
    // Cross-test that adding the RATE_LIMITED branch did not
    // accidentally re-route any of the previously-shipped outcomes.
    expect(mapFailure(400, { code: 'INVALID_CODE' })).toBe('invalid_code');
    expect(mapFailure(410, { code: 'EXPIRED_CODE' })).toBe('expired_code');
    expect(mapFailure(409, { code: 'ALREADY_PAIRED' })).toBe('already_paired');
    expect(mapFailure(409, { code: 'BRANCH_MISMATCH' })).toBe('branch_mismatch');
    expect(mapFailure(429, { code: 'RATE_LIMITED' })).toBe('rate_limited');
  });
});
