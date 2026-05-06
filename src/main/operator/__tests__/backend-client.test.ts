import { describe, expect, it, vi } from 'vitest';

import { createBackendClient } from '../backend-client.js';

/**
 * 004-operator-session — production BackendClient request-shape tests.
 *
 * Load-bearing for Wave 1 path (b): the password and identifier MUST
 * NEVER appear in any backend request. The Clerk JWT travels in
 * `Authorization: Bearer …`. The body of `/sign-in` is exactly
 * `{ kind: 'manager_admin', device_token_attestation }`. The body of
 * `/sign-out` is exactly `{ session_id }`.
 *
 * Resolve-on-reachable / reject-only-on-transport contract: every
 * backend response (including 4xx/5xx) resolves to a typed result;
 * network failures resolve to `{ kind: 'no_connection' }`.
 */

const BASE = 'https://api.smartdatapulse.tech';

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function captureFetch(response: Response): {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  captured: CapturedRequest[];
} {
  const captured: CapturedRequest[] = [];
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ url: stringifyInput(input), init: init ?? {} });
    return Promise.resolve(response.clone());
  };
  return { fetchImpl, captured };
}

function stringifyInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function bodyAsString(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body === null || body === undefined) return '';
  // Tests only ever pass strings (URLSearchParams.toString() / JSON.stringify).
  throw new Error('test fixture: body was not a string');
}

const HAPPY_SIGN_IN_BODY = {
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

describe('createBackendClient — sign-in request shape', () => {
  it('POSTs to /api/pos/v1/operators/sign-in with Authorization Bearer and the locked body', async () => {
    const { fetchImpl, captured } = captureFetch(
      new Response(JSON.stringify(HAPPY_SIGN_IN_BODY), { status: 200 }),
    );
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    await client.signIn(
      { kind: 'manager_admin', device_token_attestation: 'attest-123' },
      'eyJ.fake.jwt',
    );

    expect(captured).toHaveLength(1);
    const call = captured[0];
    expect(call?.url).toBe(`${BASE}/api/pos/v1/operators/sign-in`);
    expect(call?.init.method).toBe('POST');
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer eyJ.fake.jwt');
    expect(headers['Content-Type']).toBe('application/json');
    // Body MUST be exactly { kind, device_token_attestation } — nothing else.
    const body = JSON.parse(bodyAsString(call?.init.body)) as Record<string, unknown>;
    expect(body).toEqual({ kind: 'manager_admin', device_token_attestation: 'attest-123' });
  });

  it('NEVER includes password / identifier / pin in the request body or headers', async () => {
    const { fetchImpl, captured } = captureFetch(
      new Response(JSON.stringify(HAPPY_SIGN_IN_BODY), { status: 200 }),
    );
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    await client.signIn({ kind: 'manager_admin', device_token_attestation: 'attest' }, 'jwt-1');
    const call = captured[0];
    const serialized = JSON.stringify({ headers: call?.init.headers, body: call?.init.body });
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('identifier');
    expect(serialized).not.toContain('pin');
  });

  it('strips trailing slash from baseUrl when constructing the URL', async () => {
    const { fetchImpl, captured } = captureFetch(
      new Response(JSON.stringify(HAPPY_SIGN_IN_BODY), { status: 200 }),
    );
    const client = createBackendClient({ baseUrl: `${BASE}/`, fetch: fetchImpl });
    await client.signIn({ kind: 'manager_admin', device_token_attestation: 'a' }, 'j');
    expect(captured[0]?.url).toBe(`${BASE}/api/pos/v1/operators/sign-in`);
  });

  it('parses signed_in response and surfaces operator + session', async () => {
    const { fetchImpl } = captureFetch(
      new Response(JSON.stringify(HAPPY_SIGN_IN_BODY), { status: 200 }),
    );
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signIn({ kind: 'manager_admin', device_token_attestation: 'a' }, 'j');
    expect(res.kind).toBe('signed_in');
    if (res.kind === 'signed_in') {
      expect(res.operator.id).toBe('clerk-user-1');
      expect(res.operator.role).toBe('manager');
      expect(res.operator_session.id).toBe('be-sess-1');
    }
  });

  it('surfaces takeover_required from the body', async () => {
    const { fetchImpl } = captureFetch(
      new Response(JSON.stringify({ kind: 'takeover_required' }), { status: 200 }),
    );
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signIn({ kind: 'manager_admin', device_token_attestation: 'a' }, 'j');
    expect(res.kind).toBe('takeover_required');
  });

  it('collapses any 4xx/5xx to refused', async () => {
    for (const status of [400, 401, 403, 409, 422, 500]) {
      const { fetchImpl } = captureFetch(new Response('{}', { status }));
      const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
      const res = await client.signIn(
        { kind: 'manager_admin', device_token_attestation: 'a' },
        'j',
      );
      expect(res.kind).toBe('refused');
    }
  });

  it('returns no_connection on network failure', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signIn({ kind: 'manager_admin', device_token_attestation: 'a' }, 'j');
    expect(res.kind).toBe('no_connection');
  });

  it('returns refused on malformed JSON body', async () => {
    const { fetchImpl } = captureFetch(new Response('not-json', { status: 200 }));
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signIn({ kind: 'manager_admin', device_token_attestation: 'a' }, 'j');
    expect(res.kind).toBe('refused');
  });

  it('returns refused on missing operator/operator_session/role-shape fields', async () => {
    const cases: unknown[] = [
      { kind: 'signed_in' },
      { kind: 'signed_in', operator: { id: 'x' } },
      {
        kind: 'signed_in',
        operator: { id: 'x', display_name: 'd', role: 'owner', tenant_id: 't', branch_id: 'b' },
        operator_session: { id: 's', issued_at: 'i' },
      },
      {
        kind: 'signed_in',
        operator: HAPPY_SIGN_IN_BODY.operator,
        operator_session: { id: 'x' },
      },
    ];
    for (const body of cases) {
      const { fetchImpl } = captureFetch(new Response(JSON.stringify(body), { status: 200 }));
      const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
      const res = await client.signIn(
        { kind: 'manager_admin', device_token_attestation: 'a' },
        'j',
      );
      expect(res.kind).toBe('refused');
    }
  });
});

describe('createBackendClient — sign-out request shape', () => {
  it('POSTs to /api/pos/v1/operators/sign-out with Authorization Bearer and the locked body', async () => {
    const { fetchImpl, captured } = captureFetch(
      new Response(JSON.stringify({ kind: 'signed_out' }), { status: 200 }),
    );
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    await client.signOut({ session_id: 'be-sess-1' }, 'eyJ.fake.jwt');

    expect(captured).toHaveLength(1);
    const call = captured[0];
    expect(call?.url).toBe(`${BASE}/api/pos/v1/operators/sign-out`);
    expect(call?.init.method).toBe('POST');
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer eyJ.fake.jwt');
    const body = JSON.parse(bodyAsString(call?.init.body)) as Record<string, unknown>;
    expect(body).toEqual({ session_id: 'be-sess-1' });
  });

  it('returns signed_out on 2xx (idempotent — body shape ignored)', async () => {
    const { fetchImpl } = captureFetch(new Response('{}', { status: 200 }));
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signOut({ session_id: 's' }, 'j');
    expect(res).toEqual({ kind: 'signed_out' });
  });

  it('collapses 4xx/5xx to refused', async () => {
    const { fetchImpl } = captureFetch(new Response('{}', { status: 401 }));
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signOut({ session_id: 's' }, 'j');
    expect(res).toEqual({ kind: 'refused' });
  });

  it('returns no_connection on network failure', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ETIMEDOUT')));
    const client = createBackendClient({ baseUrl: BASE, fetch: fetchImpl });
    const res = await client.signOut({ session_id: 's' }, 'j');
    expect(res).toEqual({ kind: 'no_connection' });
  });
});
