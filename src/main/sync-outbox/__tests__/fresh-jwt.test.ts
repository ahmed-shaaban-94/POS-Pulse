import { describe, expect, it } from 'vitest';

import { freshJwtOrNull } from '../fresh-jwt.js';

/** Build an unsigned JWT (header.payload.sig) whose payload carries `exp`. */
function jwtWithExp(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds, sub: 'user_x' })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

const NOW_MS = 1_781_160_000_000; // fixed clock
const NOW_S = Math.floor(NOW_MS / 1000);

describe('freshJwtOrNull', () => {
  it('returns the JWT when it has ample life left', () => {
    const jwt = jwtWithExp(NOW_S + 50);
    expect(freshJwtOrNull(jwt, NOW_MS)).toBe(jwt);
  });

  it('returns null when the JWT is already expired', () => {
    expect(freshJwtOrNull(jwtWithExp(NOW_S - 1), NOW_MS)).toBeNull();
  });

  it('returns null when the JWT is within the safety margin of expiry', () => {
    expect(freshJwtOrNull(jwtWithExp(NOW_S + 3), NOW_MS, 5)).toBeNull(); // 3s left < 5s margin
  });

  it('returns the JWT exactly at the margin boundary', () => {
    expect(freshJwtOrNull(jwtWithExp(NOW_S + 5), NOW_MS, 5)).not.toBeNull();
  });

  it('returns null for a null/empty token', () => {
    expect(freshJwtOrNull(null, NOW_MS)).toBeNull();
    expect(freshJwtOrNull('', NOW_MS)).toBeNull();
  });

  it('fails closed (null) for a token with no decodable exp or wrong shape', () => {
    expect(freshJwtOrNull('not-a-jwt', NOW_MS)).toBeNull();
    const noExp = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url')}.s`;
    expect(freshJwtOrNull(noExp, NOW_MS)).toBeNull();
  });
});
