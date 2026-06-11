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

/**
 * Fake fetch that returns a queued sequence of responses in call order — the
 * exchange is a TWO-call flow (sign_ins → /tokens), so a single canned response
 * can't model it. Each call shifts the next response off the queue.
 */
function sequenceFetch(responses: Array<Response | (() => never)>): {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  captured: CapturedRequest[];
} {
  const captured: CapturedRequest[] = [];
  let i = 0;
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ url: stringifyInput(input), init: init ?? {} });
    const next = responses[i++];
    if (next === undefined) {
      throw new Error(
        `test fixture: no queued response for call #${String(i)} to ${stringifyInput(input)}`,
      );
    }
    if (typeof next === 'function') return Promise.resolve().then(() => next());
    // Return the response as-is (no .clone()): each queued response is consumed
    // exactly once, and clone() would drop the fixture's getSetCookie override.
    return Promise.resolve(next);
  };
  return { fetchImpl, captured };
}

/**
 * REAL Clerk sign_ins 200 shape: a created session with id + user, but NO
 * inline jwt (Clerk mints the session JWT via a separate POST
 * /v1/client/sessions/{sid}/tokens call). The client identity that the mint
 * call needs is returned in the `Authorization` RESPONSE header (a rotating
 * client token), NOT a cookie — verified against live preprod Clerk.
 */
function signInsBody(opts: { sessionId?: string; user?: Record<string, unknown> } = {}): unknown {
  return {
    response: {
      client: {
        sessions: [
          {
            id: opts.sessionId ?? 'sess_abc123',
            status: 'active',
            user: opts.user ?? {
              id: 'user_abc123',
              first_name: 'Sara',
              last_name: 'K.',
              email_addresses: [{ email_address: 'sara@x.test' }],
              public_metadata: {}, // REAL operators have EMPTY metadata — no role.
            },
          },
        ],
      },
    },
  };
}

/** REAL Clerk token-mint response: POST /v1/client/sessions/{sid}/tokens → { jwt }. */
function tokenMintBody(jwt: string): unknown {
  return { jwt };
}

/** The rotating client token Clerk returns in the sign_ins `Authorization` header. */
const CLIENT_TOKEN = 'client.token.abc123';

function signInsResponse(body: unknown, clientToken: string = CLIENT_TOKEN): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', Authorization: clientToken },
  });
}

/** Full happy 2-call sequence: sign_ins (no inline jwt) then /tokens (jwt). */
function happySequence(jwt: string, opts?: { sessionId?: string; user?: Record<string, unknown> }) {
  return sequenceFetch([
    signInsResponse(signInsBody(opts)),
    new Response(JSON.stringify(tokenMintBody(jwt)), { status: 200 }),
  ]);
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

  it('decodes a REAL Clerk key where the `$` delimiter is INSIDE the base64 payload', () => {
    // The production format (verified against a live pk_live_ key): the base64
    // decodes to `<host>$` — the `$` is part of the encoded payload, NOT appended
    // to the key. Earlier the decoder only stripped `$` at the encoded level and
    // left the decoded `host$` intact → regex-rejected → "malformed".
    const host = 'clerk.smartdatapulse.tech';
    const encoded = Buffer.from(`${host}$`).toString('base64'); // $ INSIDE base64
    const url = decodeFrontendApiBaseUrl(`pk_live_${encoded}`);
    expect(url).toBe('https://clerk.smartdatapulse.tech');
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
    const { fetchImpl, captured } = happySequence('jwt-1');
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    await exchanger.exchange({ identifier: 'sara@x.test', password: 'p455' });

    const call = captured[0];
    expect(call).toBeDefined();
    expect(call?.url).toBe(`${FAPI}/v1/client/sign_ins`);
    expect(call?.init.method).toBe('POST');
    expect((call?.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const parsed = new URLSearchParams(bodyAsString(call?.init.body));
    expect(parsed.get('identifier')).toBe('sara@x.test');
    expect(parsed.get('strategy')).toBe('password');
    expect(parsed.get('password')).toBe('p455');
  });

  it('mints the session JWT via POST /v1/client/sessions/{sid}/tokens, carrying the client token', async () => {
    const { fetchImpl, captured } = happySequence('minted.jwt', { sessionId: 'sess_xyz789' });
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    await exchanger.exchange({ identifier: 'i', password: 'p' });

    expect(captured).toHaveLength(2);
    const mint = captured[1];
    expect(mint?.url).toBe(`${FAPI}/v1/client/sessions/sess_xyz789/tokens`);
    expect(mint?.init.method).toBe('POST');
    // The client token from sign_ins' Authorization RESPONSE header must travel
    // to the mint call as `Authorization: Bearer <client-token>` — without it
    // Clerk's mint returns `signed_out` (verified against live preprod Clerk).
    const auth = (mint?.init.headers as Record<string, string>)['Authorization'];
    expect(auth).toBe(`Bearer ${CLIENT_TOKEN}`);
  });

  it('strips trailing slash from frontendApiBaseUrl when constructing the URL', async () => {
    const { fetchImpl, captured } = happySequence('jwt-1');
    const exchanger = createClerkExchanger({
      frontendApiBaseUrl: 'https://clerk.example.com/',
      fetch: fetchImpl,
    });
    await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(captured[0]?.url).toBe('https://clerk.example.com/v1/client/sign_ins');
  });
});

describe('createClerkExchanger — happy path', () => {
  it('returns the minted JWT, operator id, and display name from the 2-call exchange', async () => {
    const { fetchImpl } = happySequence('eyJ.minted.jwt');
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'sara@x.test', password: 'p' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.jwt).toBe('eyJ.minted.jwt');
      expect(result.operator_id).toBe('user_abc123');
      expect(result.display_name).toBe('Sara K.');
    }
  });

  it('succeeds even when Clerk public_metadata has NO role (DP-2 owns the authoritative role)', async () => {
    // Real operators have empty public_metadata; the role gate must NOT block
    // sign-in — DP-2 resolves the role from the DB at /operators/sign-in.
    const { fetchImpl } = happySequence('j', {
      user: { id: 'u', public_metadata: {} },
    });
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result.kind).toBe('ok');
  });

  it('defaults a missing/unknown role to `manager`, NEVER `cashier` (takeover-path safety)', async () => {
    // This exchanger serves ONLY the manager_admin Clerk surface. Defaulting to
    // `cashier` would make TakeoverHandler.confirmTakeover take the local-only
    // cashier branch (skipping backend.confirmTakeover) → malformed session.
    for (const meta of [{}, { role: 'owner' }, { role: 'not-a-role' }]) {
      const { fetchImpl } = happySequence('j', { user: { id: 'u', public_metadata: meta } });
      const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
      const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') expect(result.role).toBe('manager');
    }
  });

  it('falls back from first/last name to username, then email, then id', async () => {
    const cases: Array<{ user: Record<string, unknown>; expected: string }> = [
      { user: { id: 'u1', username: 'sara' }, expected: 'sara' },
      {
        user: { id: 'u2', email_addresses: [{ email_address: 'omar@x.test' }] },
        expected: 'omar@x.test',
      },
      { user: { id: 'u3' }, expected: 'u3' },
    ];
    for (const c of cases) {
      const { fetchImpl } = happySequence('j', { user: c.user });
      const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
      const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') expect(result.display_name).toBe(c.expected);
    }
  });

  it('reads `client` from either response.client or top-level client', async () => {
    const { fetchImpl } = sequenceFetch([
      signInsResponse({
        client: {
          sessions: [{ id: 'sess_d', status: 'active', user: { id: 'u', public_metadata: {} } }],
        },
      }),
      new Response(JSON.stringify(tokenMintBody('jwt-direct')), { status: 200 }),
    ]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result.kind).toBe('ok');
  });
});

describe('createClerkExchanger — failure modes', () => {
  it('collapses sign_ins 4xx to refused (PR-2 — no factor distinction)', async () => {
    for (const status of [400, 401, 403, 404, 422]) {
      const { fetchImpl } = sequenceFetch([
        new Response('{"errors":[{"code":"...."}]}', { status }),
      ]);
      const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
      const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
      expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
    }
  });

  it('collapses sign_ins 5xx to refused', async () => {
    const { fetchImpl } = sequenceFetch([new Response('oops', { status: 500 })]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('collapses a token-mint 4xx/5xx (e.g. signed_out) to refused', async () => {
    const { fetchImpl } = sequenceFetch([
      signInsResponse(signInsBody()),
      new Response('{"errors":[{"code":"signed_out"}]}', { status: 401 }),
    ]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns no_connection on sign_ins network rejection (DNS/TLS/refused/timeout)', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'no_connection' });
  });

  it('returns no_connection on token-mint network rejection', async () => {
    const { fetchImpl } = sequenceFetch([
      signInsResponse(signInsBody()),
      (): never => {
        throw new Error('ECONNRESET');
      },
    ]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'no_connection' });
  });

  it('returns refused when the sign_ins response is malformed JSON', async () => {
    const { fetchImpl } = sequenceFetch([new Response('not-json', { status: 200 })]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns refused when the mint response carries no jwt', async () => {
    const { fetchImpl } = sequenceFetch([
      signInsResponse(signInsBody()),
      new Response(JSON.stringify({ jwt: '' }), { status: 200 }),
    ]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns refused when sign_ins has no resolvable session id', async () => {
    const { fetchImpl } = sequenceFetch([
      signInsResponse({ response: { client: { sessions: [] } } }),
    ]);
    const exchanger = createClerkExchanger({ frontendApiBaseUrl: FAPI, fetch: fetchImpl });
    const result = await exchanger.exchange({ identifier: 'i', password: 'p' });
    expect(result).toEqual<ClerkExchangeResult>({ kind: 'refused' });
  });

  it('returns refused when session status is not active', async () => {
    const { fetchImpl } = sequenceFetch([
      signInsResponse({
        response: {
          client: {
            sessions: [{ id: 's', status: 'pending', user: { id: 'u', public_metadata: {} } }],
          },
        },
      }),
    ]);
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
