/**
 * 008 sale-sync flush — fresh-JWT guard for the option-(c) worker.
 *
 * The flush worker must NOT attempt captureSale with a stale Clerk session JWT
 * (they live ~60s): an expired JWT 401s, and although the client now treats
 * 401 as retryable, attempting with a known-dead credential is wasted work and
 * risks a mid-drain expiry. This helper decodes the JWT's `exp` (no signature
 * verification — DP-2 does that authoritatively) and returns the token only if
 * it has at least `minRemainingSeconds` of life left; otherwise null, so the
 * worker no-ops and the rows stay pending for the next sign-in to drain.
 *
 * Pure (clock injected) so it is deterministically testable.
 */

/** Default safety margin: don't use a JWT with under 5s of life — a flush call + round-trip needs headroom. */
const DEFAULT_MIN_REMAINING_SECONDS = 5;

interface JwtExpClaim {
  exp?: unknown;
}

/** Decode the `exp` (seconds since epoch) from a JWT without verifying it. Returns null if absent/unparseable. */
function decodeExp(jwt: string): number | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (payload === undefined || payload.length === 0) return null;
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    const claims = JSON.parse(json) as JwtExpClaim;
    return typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp : null;
  } catch {
    return null;
  }
}

/**
 * Return `jwt` if it is present and has at least `minRemainingSeconds` of life
 * left at `nowMs`; otherwise null. A token with no decodable `exp` is treated
 * as unusable (null) — fail closed.
 */
export function freshJwtOrNull(
  jwt: string | null,
  nowMs: number,
  minRemainingSeconds: number = DEFAULT_MIN_REMAINING_SECONDS,
): string | null {
  if (jwt === null || jwt.length === 0) return null;
  const exp = decodeExp(jwt);
  if (exp === null) return null;
  const remainingSeconds = exp - Math.floor(nowMs / 1000);
  return remainingSeconds >= minRemainingSeconds ? jwt : null;
}
