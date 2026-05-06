import { describe, expect, it } from 'vitest';

import { createJwtHolder } from '../jwt-holder.js';

/**
 * 004-operator-session — main-process JwtHolder tests.
 */

describe('JwtHolder', () => {
  it('returns null for an unknown session id', () => {
    const h = createJwtHolder();
    expect(h.get('unknown')).toBeNull();
  });

  it('stores and retrieves a JWT keyed by backend session id', () => {
    const h = createJwtHolder();
    h.set('be-1', 'jwt-a');
    h.set('be-2', 'jwt-b');
    expect(h.get('be-1')).toBe('jwt-a');
    expect(h.get('be-2')).toBe('jwt-b');
  });

  it('overwrites an existing entry on subsequent set', () => {
    const h = createJwtHolder();
    h.set('be-1', 'old');
    h.set('be-1', 'new');
    expect(h.get('be-1')).toBe('new');
  });

  it('clear removes the entry; further get returns null', () => {
    const h = createJwtHolder();
    h.set('be-1', 'jwt');
    h.clear('be-1');
    expect(h.get('be-1')).toBeNull();
  });

  it('clear is idempotent on an unknown id', () => {
    const h = createJwtHolder();
    expect(() => {
      h.clear('unknown');
    }).not.toThrow();
  });
});
