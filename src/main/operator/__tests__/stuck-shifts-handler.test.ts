import { describe, expect, it, vi } from 'vitest';

import { StuckShiftsHandler } from '../stuck-shifts-handler.js';
import { SessionManager } from '../session-manager.js';
import { createJwtHolder } from '../jwt-holder.js';
import type { BackendStuckShiftsResponse } from '../backend-client.js';

/**
 * 016-operator-envelope-adoption (review HIGH) — stuck-shifts regression.
 *
 * GET /api/pos/v1/shifts/stuck (pos-shifts.openapi.yaml) uses the
 * `operator-identity` scheme — the provider JWT, NOT the opaque pos_operator
 * envelope. 028 §6 CM-1: the provider JWT is identity proof at sign-in AND on
 * subsequent operator-identity calls. After 016 split the credential seam,
 * StuckShiftsHandler MUST read the JWT holder (operatorJwtHolder) and send the
 * JWT — sending the envelope would 401 against this route (silent regression).
 */

const JWT = 'eyJhbGciOiJSUzI1NiJ9.identity.jwt';
const ENVELOPE = 'opaque-pos-operator-envelope-stuck-001';

function fakeBackend(
  result: BackendStuckShiftsResponse,
  capture: { lastJwt?: string; lastBranch?: string } = {},
): { getStuckShifts: (branchId: string, jwt: string) => Promise<BackendStuckShiftsResponse> } {
  return {
    getStuckShifts: vi.fn((branchId: string, jwt: string) => {
      capture.lastBranch = branchId;
      capture.lastJwt = jwt;
      return Promise.resolve(result);
    }),
  };
}

function makeManager(): SessionManager {
  const m = new SessionManager();
  m.create({
    operator_id: 'op-1',
    display_name: 'Manager',
    role: 'manager',
    tenant_id: 't1',
    branch_id: 'b1',
    backend_session_id: 'be-sess-1',
  });
  return m;
}

describe('StuckShiftsHandler — operator-identity JWT (016 review HIGH regression)', () => {
  it('sends the JWT from the jwt holder, NOT the pos_operator envelope', async () => {
    const sessionManager = makeManager();
    // The jwt holder holds the provider JWT (operator-identity); a SEPARATE
    // envelope holder holds the sale-sync envelope. stuck-shifts reads the JWT.
    const jwtHolder = createJwtHolder();
    jwtHolder.set('be-sess-1', JWT);
    const capture: { lastJwt?: string; lastBranch?: string } = {};
    const handler = new StuckShiftsHandler({
      sessionManager,
      backendClient: fakeBackend({ kind: 'ok', shifts: [] }, capture),
      jwtHolder,
    });

    const res = await handler.listStuckShifts();
    expect(res.kind).toBe('stuck_shifts');
    // The route is operator-identity: it MUST receive the JWT.
    expect(capture.lastJwt).toBe(JWT);
    // It MUST NOT receive the opaque sale-sync envelope (would 401).
    expect(capture.lastJwt).not.toBe(ENVELOPE);
    expect(capture.lastBranch).toBe('b1');
  });

  it('refuses when not signed in (no holder read at all)', async () => {
    const handler = new StuckShiftsHandler({
      sessionManager: new SessionManager(),
      backendClient: fakeBackend({ kind: 'ok', shifts: [] }),
      jwtHolder: createJwtHolder(),
    });
    const res = await handler.listStuckShifts();
    expect(res).toEqual({ kind: 'refused', category: 'not_signed_in' });
  });
});
