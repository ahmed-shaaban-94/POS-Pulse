import { describe, it, expect } from 'vitest';

import { requireRole } from '../role-enforcement.js';
import { OperatorRefusalError } from '../../../shared/audit/event-shape.js';

/**
 * 004-operator-session T009 — `requireRole` refuses generically on
 * mismatch (FR-016 / FR-019 / AD-1).
 *
 * The first executable instruction of every operator-aware bridge
 * handler delegates to this. A role mismatch surfaces as
 * `OperatorRefusalError('role_mismatch')` with no factor-distinguishing
 * detail (PR-2 / NFR-003).
 */

describe('main/operator/role-enforcement (T009 — AD-1)', () => {
  it('passes silently when the session role is in the allowed list', () => {
    expect(() => {
      requireRole(['manager', 'admin'], { role: 'manager' });
    }).not.toThrow();
    expect(() => {
      requireRole(['manager', 'admin'], { role: 'admin' });
    }).not.toThrow();
    expect(() => {
      requireRole(['cashier'], { role: 'cashier' });
    }).not.toThrow();
  });

  it('throws role_mismatch when the role is not allowed', () => {
    try {
      requireRole(['manager', 'admin'], { role: 'cashier' });
      throw new Error('requireRole should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OperatorRefusalError);
      expect((err as OperatorRefusalError).category).toBe('role_mismatch');
    }
  });

  it('throws not_signed_in when no session is present', () => {
    for (const session of [null, undefined]) {
      try {
        requireRole(['manager'], session);
        throw new Error('requireRole should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(OperatorRefusalError);
        expect((err as OperatorRefusalError).category).toBe('not_signed_in');
      }
    }
  });

  it('error message MUST NOT echo the rejected role or allowed roles (PR-2)', () => {
    try {
      requireRole(['manager', 'admin'], { role: 'cashier' });
      throw new Error('unreachable');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain('cashier');
      expect(message).not.toContain('manager');
      expect(message).not.toContain('admin');
      // The closed-set category is the only dynamic substring.
      expect(message).toBe('operator refusal: role_mismatch');
    }
  });
});
