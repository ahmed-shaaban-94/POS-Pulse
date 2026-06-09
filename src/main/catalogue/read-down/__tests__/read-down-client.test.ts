import { describe, expect, it } from 'vitest';

import { createReadDownClient } from '../read-down-client.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';

/**
 * 010-pos-catalog-read-down-consumption T021 — live `ReadDownClient` tests.
 *
 * Verifies the request shape (path, device-token Authorization header) and the
 * transport-result union mapping (ok / no_connection / failed). The device token
 * is the sole credential; it is attached to the outbound request and never
 * surfaced on the returned union (P7). Resolve-on-reachable / reject-only-on-
 * transport: every reachable response resolves to a typed result; only a transport
 * fault maps to `no_connection`.
 */

const BASE = 'https://api-preprod.smartdatapulse.tech';
const SNAPSHOT_PATH = '/api/pos/v1/catalog/snapshot';
const TOKEN = 'device-token-xyz';

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
    if (typeof response === 'function') return Promise.reject(new Error('network down'));
    return Promise.resolve(response.clone());
  };
  return { fetchImpl, captured };
}

function stringifyInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function headerValue(init: RequestInit, name: string): string | null {
  const headers = init.headers as Record<string, string> | undefined;
  return headers?.[name] ?? null;
}

const ROW: SellableCatalogRow = {
  product_id: 'p1',
  sku: 'SKU-1',
  name: 'Paracetamol 500mg',
  aliases: ['6223000000001'],
  price: { amount: '12.50', currency_code: 'EGP' },
  tax_category: 'standard',
  active: true,
  row_cursor: 'rc-1',
};

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('createReadDownClient — request shape', () => {
  it('GETs the snapshot path with the device token as a Bearer Authorization header', async () => {
    const { fetchImpl, captured } = captureFetch(okResponse({ snapshot_id: 's1', rows: [ROW] }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    await client.fetchSnapshot();

    expect(captured).toHaveLength(1);
    const req = captured[0];
    if (req === undefined) throw new Error('test: no request captured');
    expect(req.url).toBe(`${BASE}${SNAPSHOT_PATH}`);
    expect(req.init.method).toBe('GET');
    expect(headerValue(req.init, 'Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('normalizes a trailing slash on the base URL', async () => {
    const { fetchImpl, captured } = captureFetch(okResponse({ snapshot_id: null, rows: [] }));
    const client = createReadDownClient({
      baseUrl: `${BASE}/`,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    await client.fetchSnapshot();

    expect(captured[0]?.url).toBe(`${BASE}${SNAPSHOT_PATH}`);
  });
});

describe('createReadDownClient — outcome mapping', () => {
  it('maps a reachable valid snapshot to ok with rows + snapshot id', async () => {
    const { fetchImpl } = captureFetch(okResponse({ snapshot_id: 's9', rows: [ROW] }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.sourceSnapshotId).toBe('s9');
      expect(result.rows).toEqual([ROW]);
    }
  });

  it('treats a missing snapshot_id as a null source id (still ok)', async () => {
    const { fetchImpl } = captureFetch(okResponse({ rows: [ROW] }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.sourceSnapshotId).toBeNull();
  });

  it('maps a transport fault (fetch rejects) to no_connection', async () => {
    const { fetchImpl } = captureFetch(() => {
      throw new Error('unused');
    });
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('no_connection');
  });

  it('maps a non-2xx response to failed', async () => {
    const { fetchImpl } = captureFetch(new Response('nope', { status: 401 }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('failed');
  });

  it('maps a malformed (non-array rows) body to failed', async () => {
    const { fetchImpl } = captureFetch(okResponse({ snapshot_id: 's1', rows: 'not-an-array' }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('failed');
  });

  it('rejects the whole snapshot (failed) when any row is structurally invalid', async () => {
    const { fetchImpl } = captureFetch(okResponse({ rows: [ROW, { product_id: 'bad' }] }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('failed');
  });

  it('maps non-JSON body to failed', async () => {
    const { fetchImpl } = captureFetch(new Response('<<not json>>', { status: 200 }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(TOKEN),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('failed');
  });
});

describe('createReadDownClient — device token gating', () => {
  it('does not POST and returns failed when the device token is null (unpaired)', async () => {
    const { fetchImpl, captured } = captureFetch(okResponse({ rows: [] }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.resolve(null),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('failed');
    expect(captured).toHaveLength(0);
  });

  it('returns failed (no request) when the token read throws', async () => {
    const { fetchImpl, captured } = captureFetch(okResponse({ rows: [] }));
    const client = createReadDownClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getDeviceToken: () => Promise.reject(new Error('secret store error')),
    });

    const result = await client.fetchSnapshot();
    expect(result.kind).toBe('failed');
    expect(captured).toHaveLength(0);
  });
});
