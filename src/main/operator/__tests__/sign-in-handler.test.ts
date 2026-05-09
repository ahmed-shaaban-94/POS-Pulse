import { describe, expect, it, vi } from 'vitest';

import { SignInHandler } from '../sign-in-handler.js';
import { SessionManager } from '../session-manager.js';
import { createJwtHolder } from '../jwt-holder.js';
import type { ClerkExchanger, ClerkExchangeResult } from '../clerk-client.js';
import type { BackendClient, BackendSignInResponse } from '../backend-client.js';
import { ProtoSessionStore } from '../takeover-handler.js';

/**
 * 004-operator-session T026 + T023 + T025 — sign-in handler, manager/admin path.
 *
 * Verifies:
 *  - Wave 1 path (b): password is consumed by the Clerk exchanger and
 *    NEVER reaches the backend client (AD-2 — backend body has no
 *    `password` / `identifier`; Authorization carries the JWT).
 *  - Generic refusal posture: every factor-distinguishable failure
 *    becomes `{ kind: 'refused', category: 'invalid_input' }` except
 *    network unreachability (`no_connection`).
 *  - Successful sign-in creates a SessionManager record and surfaces
 *    only the bridge view to the renderer.
 *  - Cashier-role identities returned by the backend are refused
 *    locally (defence in depth — backend already refuses them on this
 *    endpoint).
 *  - PR-1 redaction: password / identifier / JWT do NOT appear in any
 *    log line (we capture all logger calls and assert no field
 *    contains the secret values).
 */

function fakeClerk(result: ClerkExchangeResult, calls: unknown[] = []): ClerkExchanger {
  return {
    exchange: vi.fn((req) => {
      calls.push(req);
      return Promise.resolve(result);
    }),
  };
}

function fakeBackend(
  signInResult: BackendSignInResponse,
  capture: { lastBody?: unknown; lastJwt?: string } = {},
): BackendClient {
  const signIn: BackendClient['signIn'] = (body, jwt) => {
    capture.lastBody = body;
    capture.lastJwt = jwt;
    return Promise.resolve(signInResult);
  };
  const signOut: BackendClient['signOut'] = () => Promise.resolve({ kind: 'signed_out' as const });
  return {
    signIn: vi.fn(signIn),
    signOut: vi.fn(signOut),
    listRoster: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    confirmTakeover: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    getActiveSession: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
  };
}

const SUCCESS_BACKEND_RESPONSE: BackendSignInResponse = {
  kind: 'signed_in',
  operator: {
    id: 'clerk-user-1',
    display_name: 'Manager One',
    role: 'manager',
    tenant_id: 't1',
    branch_id: 'b1',
  },
  operator_session: {
    id: 'be-sess-1',
    issued_at: '2026-05-06T00:00:00.000Z',
  },
};

const HAPPY_JWT = 'eyJhbGciOiJSUzI1NiJ9.fake.jwt';
const HAPPY_CLERK_RESULT: ClerkExchangeResult = {
  kind: 'ok',
  jwt: HAPPY_JWT,
  operator_id: 'clerk-user-1',
  display_name: 'Manager One',
  role: 'manager',
};

describe('SignInHandler — manager/admin path', () => {
  it('happy path: returns signed_in with bridge view', async () => {
    const sessionManager = new SessionManager();
    const clerk = fakeClerk(HAPPY_CLERK_RESULT);
    const captured: { lastBody?: unknown; lastJwt?: string } = {};
    const backend = fakeBackend(SUCCESS_BACKEND_RESPONSE, captured);

    const handler = new SignInHandler({
      clerk,
      backend,
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest-123',
    });

    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'manager@pharmacy.test',
      password: 'correct-horse-battery-staple',
    });

    expect(res.kind).toBe('signed_in');
    if (res.kind === 'signed_in') {
      expect(res.session.role).toBe('manager');
      expect(res.session.operator_id).toBe('clerk-user-1');
      expect(res.session).not.toHaveProperty('backend_session_id');
    }
    expect(sessionManager.getCurrent()?.operator_id).toBe('clerk-user-1');
  });

  it('records the Clerk JWT in the JwtHolder keyed by backend session id', async () => {
    const sessionManager = new SessionManager();
    const jwtHolder = createJwtHolder();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend(SUCCESS_BACKEND_RESPONSE),
      sessionManager,
      jwtHolder,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    await handler.signIn({
      kind: 'manager_admin',
      identifier: 'm@x.test',
      password: 'p',
    });
    // The Clerk JWT is held in main-process memory keyed by the
    // backend session id from Data-Pulse-2's response. NEVER crosses
    // the bridge to the renderer.
    expect(jwtHolder.get('be-sess-1')).toBe(HAPPY_JWT);
  });

  it('does NOT record the JWT on takeover_required (no local session created)', async () => {
    const sessionManager = new SessionManager();
    const jwtHolder = createJwtHolder();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend({ kind: 'takeover_required' }),
      sessionManager,
      jwtHolder,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    await handler.signIn({
      kind: 'manager_admin',
      identifier: 'm@x.test',
      password: 'p',
    });
    // No backend session id was returned; nothing to key the JWT
    // against. The jwtHolder remains empty.
    expect(jwtHolder.get('be-sess-1')).toBeNull();
  });

  it('Wave 1 path (b): password NEVER appears in the backend body', async () => {
    const sessionManager = new SessionManager();
    const clerk = fakeClerk(HAPPY_CLERK_RESULT);
    const captured: { lastBody?: unknown; lastJwt?: string } = {};
    const backend = fakeBackend(SUCCESS_BACKEND_RESPONSE, captured);

    const handler = new SignInHandler({
      clerk,
      backend,
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest-123',
    });

    await handler.signIn({
      kind: 'manager_admin',
      identifier: 'm@x.test',
      password: 'never-leaks',
    });

    // The body MUST contain only `kind` and `device_token_attestation`.
    expect(captured.lastBody).toEqual({
      kind: 'manager_admin',
      device_token_attestation: 'attest-123',
    });
    // The JWT travels in Authorization (Bearer), not in the body.
    expect(captured.lastJwt).toBe(HAPPY_JWT);
    // Defence in depth: serialize the body and assert the password
    // string does not appear anywhere in it.
    const bodyJson = JSON.stringify(captured.lastBody);
    expect(bodyJson).not.toContain('never-leaks');
    expect(bodyJson).not.toContain('m@x.test');
    expect(bodyJson).not.toContain('password');
    expect(bodyJson).not.toContain('identifier');
  });

  it('refuses generically on empty identifier or password', async () => {
    const sessionManager = new SessionManager();
    const clerk = fakeClerk(HAPPY_CLERK_RESULT);
    const backend = fakeBackend(SUCCESS_BACKEND_RESPONSE);
    const handler = new SignInHandler({
      clerk,
      backend,
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });

    for (const bad of [
      { identifier: '', password: 'p' },
      { identifier: 'i', password: '' },
    ]) {
      const res = await handler.signIn({ kind: 'manager_admin', ...bad });
      expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    }
    expect(sessionManager.getCurrent()).toBeNull();
  });

  it('refuses generically when Clerk refuses', async () => {
    const sessionManager = new SessionManager();
    const handler = new SignInHandler({
      clerk: fakeClerk({ kind: 'refused' }),
      backend: fakeBackend(SUCCESS_BACKEND_RESPONSE),
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('returns no_connection when Clerk is unreachable', async () => {
    const sessionManager = new SessionManager();
    const handler = new SignInHandler({
      clerk: fakeClerk({ kind: 'no_connection' }),
      backend: fakeBackend(SUCCESS_BACKEND_RESPONSE),
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'no_connection' });
  });

  it('returns no_connection when backend is unreachable', async () => {
    const sessionManager = new SessionManager();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend({ kind: 'no_connection' }),
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'no_connection' });
  });

  it('refuses generically when backend rejects (any cause)', async () => {
    const sessionManager = new SessionManager();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend({ kind: 'refused' }),
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('surfaces takeover_required with capability token, no identifying detail (FR-013)', async () => {
    const sessionManager = new SessionManager();
    const protoStore = new ProtoSessionStore();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend({ kind: 'takeover_required' }),
      sessionManager,
      protoStore,
      deviceTokenAttestation: () => 'attest',
    });
    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res.kind).toBe('takeover_required');
    if (res.kind !== 'takeover_required') return;
    // pending_takeover_id is an opaque token; verify shape only.
    expect(typeof res.pending_takeover_id).toBe('string');
    expect(res.pending_takeover_id.length).toBeGreaterThan(0);
    // FR-013: no operator identity, no prior-terminal id in the response.
    expect(res).not.toHaveProperty('operator_id');
    expect(res).not.toHaveProperty('tenant_id');
    // No new session was created; the prompt UX (S4) must run before confirmation.
    expect(sessionManager.getCurrent()).toBeNull();
  });

  it('refuses generically when backend returns cashier role (defence in depth)', async () => {
    // The backend already refuses cashier-role identities on this
    // endpoint, but local defence in depth keeps the trust boundary
    // explicit.
    const cashierBackend: BackendSignInResponse = {
      ...SUCCESS_BACKEND_RESPONSE,
      operator: { ...SUCCESS_BACKEND_RESPONSE.operator, role: 'cashier' },
    };
    const sessionManager = new SessionManager();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend(cashierBackend),
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
    });
    const res = await handler.signIn({
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    expect(sessionManager.getCurrent()).toBeNull();
  });

  it('PR-1 redaction: logger never receives the password / identifier / JWT', async () => {
    const calls: unknown[] = [];
    const logger = {
      info: (...args: unknown[]) => calls.push(...args),
      warn: (...args: unknown[]) => calls.push(...args),
      error: (...args: unknown[]) => calls.push(...args),
      debug: (...args: unknown[]) => calls.push(...args),
      trace: (...args: unknown[]) => calls.push(...args),
      fatal: (...args: unknown[]) => calls.push(...args),
      child: () =>
        ({
          info: () => undefined,
          warn: () => undefined,
        }) as unknown,
    } as unknown as NonNullable<ConstructorParameters<typeof SignInHandler>[0]['logger']>;
    const sessionManager = new SessionManager();
    const handler = new SignInHandler({
      clerk: fakeClerk(HAPPY_CLERK_RESULT),
      backend: fakeBackend(SUCCESS_BACKEND_RESPONSE),
      sessionManager,
      protoStore: new ProtoSessionStore(),
      deviceTokenAttestation: () => 'attest',
      logger,
    });
    await handler.signIn({
      kind: 'manager_admin',
      identifier: 'leaky@example.com',
      password: 'this-must-not-appear',
    });
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain('this-must-not-appear');
    expect(serialized).not.toContain('leaky@example.com');
    expect(serialized).not.toContain('eyJhbGciOiJSUzI1NiJ9.fake.jwt');
  });
});
