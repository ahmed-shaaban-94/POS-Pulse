import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNetwork, TransportError, type NetworkDeps } from '../network.js';

/**
 * 002-terminal-pairing T019 / T021a / T021b — `network.pair()` tests.
 *
 * The network module is the only `fetch` site in the pairing slice.
 * Contract (locked from MVP onward, T021):
 *
 *   - Resolve on EVERY reachable backend response, including non-2xx.
 *     Non-2xx becomes `{ ok: false, status, body }`.
 *   - Reject ONLY on transport failure: DNS / TLS / connection refused,
 *     `fetch` rejection, or `AbortSignal` abort. Rejection is a typed
 *     `TransportError`.
 *   - 30 s client-side timeout via `AbortSignal.timeout(30_000)`. The
 *     resulting rejection is a `TransportError` with `timed_out: true`.
 *   - Neither the request nor any retained reference (observer log,
 *     error message) contains the `pairing_code`.
 *
 * Tests run against an in-process fake `fetch` injected via `NetworkDeps`.
 * No real network is touched. R1 — better-sqlite3 native binding is not
 * involved here (the pairing store is not a dependency of network.ts).
 */

const BASE_URL = 'https://api.example.test';
const PAIR_PATH = '/api/v1/terminals/pair';

interface ObservedCall {
  url: string;
  init: RequestInit;
}

/**
 * Fake fetch that records every call and returns whatever Response the
 * test queues up. Tests can also configure it to reject with a chosen
 * error to drive the transport-failure path.
 */
function makeFakeFetch(opts: {
  response?: Response;
  rejection?: unknown;
  // When set, ignore opts.response and let the abort signal drive the rejection.
  hangForever?: boolean;
}): {
  fetch: NetworkDeps['fetch'];
  observed: ObservedCall[];
} {
  const observed: ObservedCall[] = [];

  const fetchImpl: NetworkDeps['fetch'] = (input, init) => {
    const url = stringifyFetchInput(input);
    const initSafe = init ?? {};
    observed.push({ url, init: initSafe });

    if (opts.rejection !== undefined) {
      return Promise.reject(toError(opts.rejection));
    }

    if (opts.hangForever === true) {
      return new Promise<Response>((_resolve, reject) => {
        const signal = initSafe.signal;
        if (signal) {
          if (signal.aborted) {
            reject(toError(signalAbortError(signal)));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(toError(signalAbortError(signal)));
          });
        }
      });
    }

    return Promise.resolve(opts.response ?? new Response(null, { status: 204 }));
  };

  return { fetch: fetchImpl, observed };
}

/**
 * Replicate the DOMException-shaped rejection that `fetch` produces when
 * the AbortSignal is aborted, so the unit tests exercise the same
 * branch as the runtime would.
 */
function signalAbortError(signal: AbortSignal): unknown {
  const reason = signal.reason as unknown;
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  // Always restore real timers so a fake-timers test cannot leak into the
  // next test. T021b uses fake timers explicitly.
  vi.useRealTimers();
});

describe('network.pair() — success path (T019)', () => {
  it('POSTs to ${baseUrl}/api/v1/terminals/pair with the right method, headers, and body', async () => {
    const { fetch, observed } = makeFakeFetch({
      response: makeJsonResponse({
        device_token: 'opaque-token',
        tenant_id: 't',
        branch_id: 'b',
        terminal_id: 'term',
        terminal_label: 'Counter 1',
      }),
    });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    await network.pair('VALIDCODE');

    expect(observed).toHaveLength(1);
    const call = observed[0];
    if (!call) throw new Error('no call observed');
    expect(call.url).toBe(`${BASE_URL}${PAIR_PATH}`);
    expect(call.init.method).toBe('POST');
    expect(getHeader(call.init, 'Content-Type')).toBe('application/json');
    expect(typeof call.init.body).toBe('string');
    expect(JSON.parse(call.init.body as string)).toEqual({ pairing_code: 'VALIDCODE' });
  });

  it('resolves with { ok: true, status: 200, body: <typed envelope> } on a 200 success', async () => {
    const successBody = {
      device_token: 'opaque-token',
      tenant_id: 'tenant-A',
      branch_id: 'branch-B',
      terminal_id: 'terminal-C',
      terminal_label: 'Counter 1',
    };
    const { fetch } = makeFakeFetch({ response: makeJsonResponse(successBody) });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    const result = await network.pair('VALIDCODE');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.body).toEqual(successBody);
    }
  });

  it('does not log, retain, or expose the pairing_code via any observer reference', async () => {
    const code = 'SUPER-SECRET-CODE-9876';
    const { fetch, observed } = makeFakeFetch({
      response: makeJsonResponse({
        device_token: 'opaque-token',
        tenant_id: 't',
        branch_id: 'b',
        terminal_id: 'term',
        terminal_label: 'Counter',
      }),
    });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    await network.pair(code);

    // The body itself contains the code (that's the contract — we POST it).
    // The assertion: no OTHER retained reference does. We strip the body
    // from the observer record before stringifying.
    const sanitised = observed.map((c) => ({ url: c.url, init: { ...c.init, body: undefined } }));
    expect(JSON.stringify(sanitised)).not.toContain(code);
  });

  it('resolves with { ok: false, status, body } for a reachable non-2xx response (T021 contract)', async () => {
    // The catch-all behaviour locked at MVP: every reachable response
    // resolves; only transport failure rejects.
    const { fetch } = makeFakeFetch({
      response: new Response(JSON.stringify({ code: 'INVALID_CODE', message: 'nope' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    const result = await network.pair('BADCODE');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: 'INVALID_CODE' });
    }
  });

  it('handles a non-2xx with no body (e.g., 502 with empty body) without throwing', async () => {
    const { fetch } = makeFakeFetch({ response: new Response(null, { status: 502 }) });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    const result = await network.pair('CODE');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      // Body MUST be a defensive object (not null, not undefined) so the
      // service can read .code without a guard. The spec contract says
      // "body" is the parsed JSON; an empty body becomes {}.
      expect(typeof result.body).toBe('object');
      expect(result.body).not.toBeNull();
    }
  });

  it('handles a reachable non-2xx with malformed (non-JSON) body without throwing', async () => {
    const { fetch } = makeFakeFetch({
      response: new Response('<html>not json</html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      }),
    });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    const result = await network.pair('CODE');
    expect(result.ok).toBe(false);
  });
});

describe('network.pair() — transport failure (T021a)', () => {
  it('rejects with TransportError when the fake fetch rejects (DNS / TLS / refused)', async () => {
    const { fetch } = makeFakeFetch({ rejection: new TypeError('Failed to fetch') });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    await expect(network.pair('CODE')).rejects.toBeInstanceOf(TransportError);
  });

  it('TransportError message contains neither the pairing_code nor any token-shaped string', async () => {
    const code = 'SECRET-PAIR-CODE-XYZ-1234';
    const tokenLike = 'opaque-device-token-7890';
    // Malicious inner error trying to smuggle the code/token into the
    // outer TransportError. The wrapper MUST scrub these.
    const inner = new TypeError(`fetch failed; remote echoed ${code} ${tokenLike}`);
    const { fetch } = makeFakeFetch({ rejection: inner });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    let captured: unknown = null;
    try {
      await network.pair(code);
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(TransportError);
    if (captured instanceof TransportError) {
      expect(captured.message).not.toContain(code);
      expect(captured.message).not.toContain(tokenLike);
      // Stack and JSON.stringify of the error MUST also be free of the
      // values — defensive against logger flow that string-coerces.
      expect(JSON.stringify(captured)).not.toContain(code);
      expect(JSON.stringify(captured)).not.toContain(tokenLike);
    }
  });

  it('TransportError carries timed_out: false for non-timeout rejections', async () => {
    const { fetch } = makeFakeFetch({ rejection: new TypeError('Failed to fetch') });
    const network = createNetwork({ fetch, baseUrl: BASE_URL });

    let captured: TransportError | null = null;
    try {
      await network.pair('CODE');
    } catch (err) {
      if (err instanceof TransportError) captured = err;
    }
    expect(captured).not.toBeNull();
    expect(captured?.timed_out).toBe(false);
  });
});

describe('network.pair() — client-side timeout (T021b)', () => {
  // Note: `AbortSignal.timeout` is implemented in the JS runtime (Node)
  // and does NOT honour vitest's fake-timer patch — the underlying
  // timer is owned by libuv. We exercise the timeout path with REAL
  // timers + an injected short `timeoutMs` so the test runs in tens of
  // milliseconds. The 30_000 ms default is asserted in a separate
  // module-constant test below.

  it('exposes a 30s default timeout (DEFAULT_TIMEOUT_MS)', async () => {
    // Capture the original BEFORE replacing it so the spy can call
    // through without recursing. The deps API exposes `timeoutMs` as
    // an override; this test pins the default value by observing the
    // single AbortSignal.timeout call the factory makes when the
    // override is omitted.
    const original = AbortSignal.timeout.bind(AbortSignal);
    const observed: number[] = [];
    AbortSignal.timeout = (ms: number): AbortSignal => {
      observed.push(ms);
      return original(ms);
    };
    try {
      const network = createNetwork({
        fetch: () => Promise.resolve(new Response(null, { status: 204 })),
        baseUrl: BASE_URL,
      });
      await network.pair('CODE');
    } finally {
      AbortSignal.timeout = original;
    }
    expect(observed).toEqual([30_000]);
  });

  it('aborts via AbortSignal.timeout and rejects with TransportError(timed_out: true)', async () => {
    const { fetch } = makeFakeFetch({ hangForever: true });
    // Inject a tiny timeout so the test completes in real-time without
    // adding seconds to the suite. The behaviour under test is the
    // contract — "fired timeout -> TransportError with timed_out: true" —
    // not the literal 30_000 ms value (covered by the previous test).
    const network = createNetwork({ fetch, baseUrl: BASE_URL, timeoutMs: 25 });

    let captured: TransportError | null = null;
    try {
      await network.pair('CODE');
    } catch (err) {
      if (err instanceof TransportError) captured = err;
    }
    expect(captured).not.toBeNull();
    expect(captured?.timed_out).toBe(true);
    expect(captured?.message).toMatch(/timed out|30s/i);
  });

  it('does NOT abort if the response arrives before the timeout', async () => {
    const successBody = {
      device_token: 'opaque',
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
    };
    const { fetch } = makeFakeFetch({ response: makeJsonResponse(successBody) });
    const network = createNetwork({ fetch, baseUrl: BASE_URL, timeoutMs: 1000 });

    const result = await network.pair('CODE');
    expect(result.ok).toBe(true);
  });
});

/* ---------- helpers ---------- */

function stringifyFetchInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  // Request — use its `url` property directly. Avoid `toString()` which
  // would yield "[object Request]" under stricter eslint rules.
  return input.url;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'fake fetch rejection');
}

function getHeader(init: RequestInit, name: string): string | null {
  const h = init.headers;
  if (!h) return null;
  if (h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) {
    const found = h.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return found ? found[1] : null;
  }
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === name.toLowerCase()) return h[k] ?? null;
  }
  return null;
}
