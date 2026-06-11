import { describe, expect, it, vi } from 'vitest';

import { createSaleSyncFlushClient } from '../sale-sync-flush-client.js';
import type { SaleSyncFlushRequest } from '../sale-sync-flush-client-types.js';
import type { CaptureSaleBody } from '../build-capture-sale-body.js';

const BASE = 'https://api-preprod.smartdatapulse.tech';

const BODY: CaptureSaleBody = {
  sourceSystem: 'pos-pulse',
  externalId: 'sale-abc',
  currencyCode: 'EGP',
  posTotal: '102.5000',
  occurredAt: '2026-06-11T10:00:01.000Z',
  lines: [
    {
      lineName: 'Paracetamol',
      unitPrice: '12.5000',
      currencyCode: 'EGP',
      quantity: '1',
      lineAmount: '12.5000',
      unit: 'ea',
    },
  ],
};

function req(overrides: Partial<SaleSyncFlushRequest> = {}): SaleSyncFlushRequest {
  return {
    jwt: 'clerk.jwt.value',
    deviceAttestation: 'device-attestation-xyz',
    idempotencyKey: 'sale-abc',
    body: BODY,
    ...overrides,
  };
}

interface Captured {
  url: string;
  init: RequestInit;
}
function captureFetch(responder: (n: number) => Response | (() => never)): {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  captured: Captured[];
} {
  const captured: Captured[] = [];
  let n = 0;
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    captured.push({ url, init: init ?? {} });
    const r = responder(n++);
    if (typeof r === 'function') return Promise.resolve().then(() => r());
    return Promise.resolve(r);
  };
  return { fetchImpl, captured };
}

describe('createSaleSyncFlushClient — request shape', () => {
  it('POSTs to /api/pos/v1/sales with Bearer JWT + X-Device-Attestation + Idempotency-Key + JSON body', async () => {
    const { fetchImpl, captured } = captureFetch(() => new Response('{}', { status: 201 }));
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    await client.flushSale(req());

    expect(captured).toHaveLength(1);
    const c = captured[0];
    expect(c).toBeDefined();
    expect(c?.url).toBe(`${BASE}/api/pos/v1/sales`);
    expect(c?.init.method).toBe('POST');
    const h = c?.init.headers as Record<string, string>;
    expect(h['Authorization']).toBe('Bearer clerk.jwt.value');
    expect(h['X-Device-Attestation']).toBe('device-attestation-xyz');
    expect(h['Idempotency-Key']).toBe('sale-abc');
    expect(h['Content-Type']).toBe('application/json');
    // Body is the pure sale data — NO credential field rides in it.
    const sent = JSON.parse(c?.init.body as string) as Record<string, unknown>;
    expect(sent['externalId']).toBe('sale-abc');
    expect(sent).not.toHaveProperty('deviceTokenAttestation');
    expect(sent).not.toHaveProperty('jwt');
    expect(JSON.stringify(sent)).not.toContain('clerk.jwt.value');
    expect(JSON.stringify(sent)).not.toContain('device-attestation-xyz');
  });

  it('strips a trailing slash from baseUrl', async () => {
    const { fetchImpl, captured } = captureFetch(() => new Response('{}', { status: 201 }));
    const client = createSaleSyncFlushClient({ baseUrl: `${BASE}/`, fetch: fetchImpl });
    await client.flushSale(req());
    expect(captured[0]?.url).toBe(`${BASE}/api/pos/v1/sales`);
  });
});

describe('createSaleSyncFlushClient — outcomes', () => {
  it('201 fresh capture → ok', async () => {
    const { fetchImpl } = captureFetch(() => new Response('{"saleRef":"x"}', { status: 201 }));
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    expect(await client.flushSale(req())).toEqual({ kind: 'ok' });
  });

  it('200 idempotent replay → ok (a re-flush of an already-captured sale)', async () => {
    const { fetchImpl } = captureFetch(
      () =>
        new Response('{"saleRef":"x"}', {
          status: 200,
          headers: { 'Idempotent-Replayed': 'true' },
        }),
    );
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    expect(await client.flushSale(req())).toEqual({ kind: 'ok' });
  });

  it.each([400, 404, 409, 422])('validation 4xx (%i) → refused (non-retryable)', async (status) => {
    const { fetchImpl } = captureFetch(() => new Response('{"error":{}}', { status }));
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    expect(await client.flushSale(req())).toEqual({ kind: 'refused' });
  });

  it.each([401, 403])(
    'auth %i (expired/invalid JWT) → no_connection (RETRYABLE, never lose the sale)',
    async (status) => {
      const { fetchImpl } = captureFetch(
        () => new Response('{"error":{"code":"unauthorized"}}', { status }),
      );
      const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
      expect(await client.flushSale(req())).toEqual({ kind: 'no_connection' });
    },
  );

  it.each([500, 502, 503])('5xx (%i) → no_connection (retryable)', async (status) => {
    const { fetchImpl } = captureFetch(() => new Response('oops', { status }));
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    expect(await client.flushSale(req())).toEqual({ kind: 'no_connection' });
  });

  it('transport fault → no_connection (retryable)', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    expect(await client.flushSale(req())).toEqual({ kind: 'no_connection' });
  });
});

describe('createSaleSyncFlushClient — redaction', () => {
  it('a thrown transport error never carries the JWT or attestation', async () => {
    let thrown: unknown = null;
    const fetchImpl = vi.fn(() => {
      const e = new Error('ECONNREFUSED');
      thrown = e;
      return Promise.reject(e);
    });
    const client = createSaleSyncFlushClient({ baseUrl: BASE, fetch: fetchImpl });
    await client.flushSale(req({ jwt: 'SECRET-JWT', deviceAttestation: 'SECRET-ATT' }));
    const dump = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
    expect(dump).not.toContain('SECRET-JWT');
    expect(dump).not.toContain('SECRET-ATT');
  });
});
