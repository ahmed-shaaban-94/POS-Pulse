import { describe, it, expect } from 'vitest';

import { ROLES, ROLE_DISPLAY_NAME, isRole, roleDisplayName, type Role } from '../role.js';

/**
 * 004-operator-session T006 — Role enum closed-set assertion (FR-002).
 *
 * The Role enum is exactly `{cashier, manager, admin}`. No other value
 * is admitted at the trust boundary; a future contributor adding a
 * fourth role would silently break the role-visibility matrix and the
 * primary `requireRole` gate. This test fails closed if that happens.
 */

describe('operator/role (T006 — FR-002)', () => {
  it('exposes exactly three roles', () => {
    expect(ROLES).toEqual(['cashier', 'manager', 'admin']);
    expect(ROLES).toHaveLength(3);
  });

  it('isRole accepts cashier / manager / admin', () => {
    expect(isRole('cashier')).toBe(true);
    expect(isRole('manager')).toBe(true);
    expect(isRole('admin')).toBe(true);
  });

  it('isRole rejects every non-role value', () => {
    expect(isRole('owner')).toBe(false);
    expect(isRole('supervisor')).toBe(false);
    expect(isRole('CASHIER')).toBe(false);
    expect(isRole('')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(0)).toBe(false);
    expect(isRole({})).toBe(false);
  });

  it('exposes a 1:1 machine → business-name mapping (FR-002)', () => {
    expect(ROLE_DISPLAY_NAME).toEqual({
      cashier: 'Cashier',
      manager: 'Manager',
      admin: 'Admin',
    });
  });

  it('roleDisplayName returns the business name for each role', () => {
    const cases: ReadonlyArray<[Role, string]> = [
      ['cashier', 'Cashier'],
      ['manager', 'Manager'],
      ['admin', 'Admin'],
    ];
    for (const [role, expected] of cases) {
      expect(roleDisplayName(role)).toBe(expected);
    }
  });

  it('display-name map is frozen (no runtime mutation)', () => {
    expect(Object.isFrozen(ROLE_DISPLAY_NAME)).toBe(true);
  });
});
