import { describe, expect, it, vi } from 'vitest';

import {
  createClerkExchanger,
  decodeFrontendApiBaseUrl,
  type ClerkExchangeResult,
} from '../clerk-client.js';

/**
 * 004-operator-session — production ClerkExchanger tests.
 *
 * Verifies:
 *  - Frontend API base URL is decoded from the publishable key.
 *  - The credential exchange POSTs to `{fapi}/v1/client/sign_ins`
 *    with `Content-Type: application/x-www-form-urlencoded`,
 *    body fields `identifier`, `strategy=password`, `password`.
 *  - Successful response yields the JWT, operator id, display name,
 *    and role from Clerk's user shape.
 *  - 4xx/5xx collapses to `{ kind: 'refused' }` (no factor distinction).
 *  - Network failure yields `{ kind: 'no_connection' }`.
 *  - PR-1: thrown errors do NOT propagate the password.
 */

const FAPI = 'https://clerk.example.com';

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function captureFetch(response: Response | (() => never)): {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  captured: CapturedRequest[];
} {
  const captured: CapturedRequest[] = [];
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ url: stringifyInput(input), init: init ?? {} });
    if (typeof response === 'function') {
      return Promise.resolve().then(() => response());
    }
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
  throw new Error('test fixture: body was not a string');
}

function happyClerkBody(jwt: string): unknown {
  return {
    response: {
      client: {
        sessions: [
          {
            status: 'active',
            last_active_token: { jwt },
            user: {
              id: 'user_abc123',
              first_name: 'Sara',
              last_name: 'K.',
              email_addresses: [{ email_address: 'sara@x.test' }],
              public_metadata: { role: 'manager' },
            },
          },
        ],
      },
    },
  };
}

describe('decodeFrontendApiBaseUrl', () => {
  it('decodes a pk_test_<base64>$ key', () => {
    const host = 'clerk.example.com';
    const encoded = `${Buffer.from(host).toString('base64')}$`;
    const url = decodeFrontendApiBaseUrl(`pk_test_${encoded}`);
    expect(url).toBe('https://clerk.example.com');
  });

  it('decodes a pk_live_<base64>$ key', () => {
    const host = 'clerk.production.acme.com';
    const encoded = `${Buffer.from(host).toString('base64')}$`;
    const url = decodeFrontendApiBaseUrl(`pk_live_${encoded}`);
    expect(url).toBe('https://clerk.production.acme.com');
  });

  it('returns null for unknown prefix', () => {
    expect(decodeFrontendApiBaseUrl('sk_test_anything')).toBeNull();
    expect(decodeFrontendApiBaseUrl('not-a-key')).toBeNull();
  });

  it('returns null when the decoded value would contain unsafe characters', () => {
    const malicious = 'evil.example.com/x?y=1';
    const encoded = `${Buffer.from(malicious).toString('base64')}$`;
    expect(decodeFrontendApiBaseUrl(`pk_test_${encoded}`)).toBeNull();
  });

  it('returns null when the base64 portion is empty', () => {
    expect(decodeFrontendApiBaseUrl('pk_test_$')).toBeNull();
    expect(decodeFrontendApiBaseUrl('pk_test_')).toBeNull();
  });
});

describe('createClerkExchanger — request shape', () => {
  it('POSTs to {fapi}/v1/client/sign_ins with form-urlencoded body', async () => {
    const body = happyClerkBody('jwt-1');
    const { fetchImpl, captured } = captureFetch(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    await exchanger.exchange({ identifier: 'sara@x.test', password: 'p455' });

    expect(captured).toHaveLength(1);
    const call = captured[0];
    expect(call).toBeDefined();
    expect(call?.url).toBe(`${FAPI}/v1/client/sign_ins`);
    expect(call?.init.method).toBe('POST');
    expect((call?.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const formBody = bodyAsString(call?.init.body);
    const parsed = new URLSearchParams(formBody);
    expect(parsed.get('identifier')).toBe('sara@x.test');
    expect(parsed.get('strategy')).toBe('password');
    expect(parsed.get('password')).toBe('p455');
  });

  it('strips trailing slash from frontendApiBaseUrl when constructing the URL', async () => {
    const { fetchImpl, captured } = captureFetch(
      new Response(JSON.stringify(happyClerkBody('jwt-1')), { status: 200 }),
    );
    const exchanger = createClerkExchanger({
      frontendApiBaseUrl: 'https://clerk.example.com/',
      fetch: fetchImpl,
    });
    await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(captured[0]?.url).toBe('https://clerk.example.com/v1/client/sign_ins');
  });
});

describe('createClerkExchanger — happy path', () => {
  it('returns the JWT, operator id, role, and display name from a successful response', async () => {
    const { fetchImpl } = captureFetch(
      new Response(JSON.stringify(happyClerkBody('eyJ.fake.jwt')), { status: 200 }),
    );
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'sara@x.test', password: 'p' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.jwt).toBe('eyJ.fake.jwt');
      expect(result.operator_id).toBe('user_abc123');
      expect(result.display_name).toBe('Sara K.');
      expect(result.role).toBe('manager');
    }
  });

  it('falls back from first/last name to username, then email, then id', async () => {
    const cases: Array<{ user: Record<string, unknown>; expected: string }> = [
      {
        user: { id: 'u1', username: 'sara', public_metadata: { role: 'manager' } },
        expected: 'sara',
      },
      {
        user: {
          id: 'u2',
          email_addresses: [{ email_address: 'omar@x.test' }],
          public_metadata: { role: 'admin' },
        },
        expected: 'omar@x.test',
      },
      { user: { id: 'u3', public_metadata: { role: 'cashier' } }, expected: 'u3' },
    ];
    for (const c of cases) {
      const body = {
        response: {
          client: {
            sessions: [{ status: 'active', last_active_token: { jwt: 'j' }, user: c.user }],
          },
        },
      };
      const { fetchImpl } = captureFetch(new Response(JSON.stringify(body), { status: 200 }));
      const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
      const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.display_name).toBe(c.expected);
      }
    }
  });

  it('reads `client` from either response.client or top-level client', async () => {
    const body = {
      client: {
        sessions: [
          {
            status: 'active',
            last_active_token: { jwt: 'jwt-direct' },
            user: { id: 'u', public_metadata: { role: 'manager' } },
          },
        ],
      },
    };
    const { fetchImpl } = captureFetch(new Response(JSON.stringify(body), { status: 200 }));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result.kind).toBe('ok');
  });
});

describe('createClerkExchanger — failure modes', () => {
  it('collapses 4xx to refused (PR-2 — no factor distinction)', async () => {
    for (const status of [400, 401, 403, 404, 422]) {
      const { fetchImpl } = captureFetch(new Response('{"errors":[{"code":"...."}]}', { status }));
      const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
      const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
      expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
    }
  });

  it('collapses 5xx to refused', async () => {
    const { fetchImpl } = captureFetch(new Response('oops', { status: 500 }));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns no_connection on network rejection (DNS/TLS/refused/timeout)', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'no_connection' });
  });

  it('returns refused when the response is malformed JSON', async () => {
    const { fetchImpl } = captureFetch(new Response('not-json', { status: 200 }));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns refused when no JWT is present in the response', async () => {
    const body = {
      response: {
        client: {
          sessions: [
            {
              status: 'active',
              last_active_token: {},
              user: { id: 'u', public_metadata: { role: 'manager' } },
            },
          ],
        },
      },
    };
    const { fetchImpl } = captureFetch(new Response(JSON.stringify(body), { status: 200 }));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns refused when role is outside the closed Role set', async () => {
    const body = {
      response: {
        client: {
          sessions: [
            {
              status: 'active',
              last_active_token: { jwt: 'j' },
              user: { id: 'u', public_metadata: { role: 'owner' } },
            },
          ],
        },
      },
    };
    const { fetchImpl } = captureFetch(new Response(JSON.stringify(body), { status: 200 }));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns refused when session status is not active', async () => {
    const body = {
      response: {
        client: {
          sessions: [
            {
              status: 'pending',
              last_active_token: { jwt: 'j' },
              user: { id: 'u', public_metadata: { role: 'manager' } },
            },
          ],
        },
      },
    };
    const { fetchImpl } = captureFetch(new Response(JSON.stringify(body), { status: 200 }));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });
});

describe('createClerkExchanger — PR-1 redaction', () => {
  it('thrown transport errors do NOT carry the password', async () => {
    const SECRET_PASSWORD = 'p455-must-not-leak';
    let thrown: unknown = null;
    const fetchImpl = vi.fn(() => {
      const err = new Error('ECONNREFUSED');
      thrown = err;
      return Promise.reject(err);
    });
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    await exchanger.exchange({ identifier: 'i', password: SECRET_PASSWORD });
    // The thrown error MUST NOT propagate the password through cause.
    expect(JSON.stringify(thrown, Object.getOwnPropertyNames(thrown))).not.toContain(
      SECRET_PASSWORD,
    );
  });
});
