import { describe, expect, it } from 'vitest';

import { createSaleSyncClient, toWireBody, classifyStatus } from '../create-sale-sync-client.js';
import type { CaptureSalePayload } from '../capture-payload.js';

/**
 * 011-sale-sync-capture-up T061 — live `SaleSyncClient` tests.
 *
 * Locks down (a) the internal→wire transform shape (the closest guard we have on
 * the consumed DP2 captureSale contract before the live smoke / api-types re-pin):
 * nested `total:{amountMinor,currencyCode}`, top-level `currencyCode`, STRING
 * `quantity`; (b) the HTTP→outcome union mapping; (c) the per-POST operator-token
 * Authorization header + the deterministic `Idempotency-Key`; (d) no-token and
 * transport-fault paths. The token is attached to the request and never surfaced.
 */

const BASE = 'https://api-preprod.smartdatapulse.tech';
const SALES_PATH = '/api/pos/v1/sales';
const TOKEN = 'operator-jwt-abc';

const PAYLOAD: CaptureSalePayload = {
  externalId: 'pos-pulse:handoff-1',
  sourceSystem: 'pos-pulse',
  tenantId: 't1',
  branchId: 'b1',
  terminalId: 'term-1',
  operatorId: 'op-1',
  occurredAt: '2026-06-09T10:00:00.000Z',
  totalMinor: 2550,
  lines: [
    { lineRef: 'l1', productRef: 'p1', quantity: 2, unitPriceMinor: 1000, lineAmountMinor: 2000 },
    { lineRef: 'l2', productRef: 'p2', quantity: 1, unitPriceMinor: 550, lineAmountMinor: 550 },
  ],
};

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function captureFetch(status: number | 'reject'): {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  captured: CapturedRequest[];
} {
  const captured: CapturedRequest[] = [];
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ url: stringifyInput(input), init: init ?? {} });
    if (status === 'reject') return Promise.reject(new Error('network down'));
    return Promise.resolve(new Response(null, { status }));
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

describe('toWireBody — internal → DP2 wire shape', () => {
  it('nests total, adds top-level currencyCode, and stringifies quantity', () => {
    const wire = toWireBody(PAYLOAD, 'EGP');

    expect(wire.currencyCode).toBe('EGP');
    expect(wire.total).toEqual({ amountMinor: 2550, currencyCode: 'EGP' });
    expect(wire.lines[0]?.quantity).toBe('2'); // STRING on the wire
    expect(wire.lines[1]?.quantity).toBe('1');
    // Money stays integer minor units; identity fields pass through verbatim.
    expect(wire.lines[0]?.unitPriceMinor).toBe(1000);
    expect(wire.lines[0]?.lineAmountMinor).toBe(2000);
    expect(wire.externalId).toBe('pos-pulse:handoff-1');
    expect(wire.sourceSystem).toBe('pos-pulse');
    expect(wire.tenantId).toBe('t1');
    expect(wire.operatorId).toBe('op-1');
    expect(wire.occurredAt).toBe('2026-06-09T10:00:00.000Z');
  });
});

describe('classifyStatus — HTTP → outcome union', () => {
  it('maps 200/201 → ok', () => {
    expect(classifyStatus(200)).toEqual({ kind: 'ok' });
    expect(classifyStatus(201)).toEqual({ kind: 'ok' });
  });
  it('maps 409 → duplicate (idempotent success)', () => {
    expect(classifyStatus(409)).toEqual({ kind: 'duplicate' });
  });
  it('maps 5xx → transient', () => {
    expect(classifyStatus(500)).toEqual({ kind: 'transient' });
    expect(classifyStatus(503)).toEqual({ kind: 'transient' });
  });
  it('maps other 4xx → permanent', () => {
    expect(classifyStatus(400)).toEqual({ kind: 'permanent' });
    expect(classifyStatus(401)).toEqual({ kind: 'permanent' });
    expect(classifyStatus(422)).toEqual({ kind: 'permanent' });
  });
  it('maps an unexpected 3xx → transient (never lose the sale)', () => {
    expect(classifyStatus(302)).toEqual({ kind: 'transient' });
  });
});

describe('createSaleSyncClient — request shape', () => {
  it('POSTs the sales path with operator Bearer auth + deterministic Idempotency-Key + wire body', async () => {
    const { fetchImpl, captured } = captureFetch(200);
    const client = createSaleSyncClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getOperatorToken: () => TOKEN,
    });

    await client.postSale(PAYLOAD);

    expect(captured).toHaveLength(1);
    const req = captured[0];
    if (req === undefined) throw new Error('test: no request captured');
    expect(req.url).toBe(`${BASE}${SALES_PATH}`);
    expect(req.init.method).toBe('POST');
    expect(headerValue(req.init, 'Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headerValue(req.init, 'Idempotency-Key')).toBe(PAYLOAD.externalId);
    expect(headerValue(req.init, 'Content-Type')).toBe('application/json');

    const body = JSON.parse(req.init.body as string) as { total: unknown; lines: unknown[] };
    expect(body.total).toEqual({ amountMinor: 2550, currencyCode: 'EGP' });
  });

  it('normalizes a trailing slash on the base URL', async () => {
    const { fetchImpl, captured } = captureFetch(200);
    const client = createSaleSyncClient({
      baseUrl: `${BASE}/`,
      fetch: fetchImpl,
      getOperatorToken: () => TOKEN,
    });

    await client.postSale(PAYLOAD);
    expect(captured[0]?.url).toBe(`${BASE}${SALES_PATH}`);
  });
});

describe('createSaleSyncClient — outcome mapping', () => {
  const cases: Array<[number, string]> = [
    [200, 'ok'],
    [201, 'ok'],
    [409, 'duplicate'],
    [500, 'transient'],
    [400, 'permanent'],
    [422, 'permanent'],
  ];
  for (const [status, kind] of cases) {
    it(`maps HTTP ${String(status)} → ${kind}`, async () => {
      const { fetchImpl } = captureFetch(status);
      const client = createSaleSyncClient({
        baseUrl: BASE,
        fetch: fetchImpl,
        getOperatorToken: () => TOKEN,
      });

      const result = await client.postSale(PAYLOAD);
      expect(result.kind).toBe(kind);
    });
  }

  it('maps a transport fault to no_connection', async () => {
    const { fetchImpl } = captureFetch('reject');
    const client = createSaleSyncClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getOperatorToken: () => TOKEN,
    });

    const result = await client.postSale(PAYLOAD);
    expect(result.kind).toBe('no_connection');
  });
});

describe('createSaleSyncClient — operator-token gating', () => {
  it('does not POST and returns no_connection when no operator token is present', async () => {
    const { fetchImpl, captured } = captureFetch(200);
    const client = createSaleSyncClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getOperatorToken: () => null,
    });

    const result = await client.postSale(PAYLOAD);
    expect(result.kind).toBe('no_connection');
    expect(captured).toHaveLength(0);
  });

  it('honors a custom currencyCode in the wire body', async () => {
    const { fetchImpl, captured } = captureFetch(200);
    const client = createSaleSyncClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      getOperatorToken: () => TOKEN,
      currencyCode: 'USD',
    });

    await client.postSale(PAYLOAD);
    const req = captured[0];
    if (req === undefined) throw new Error('test: no request captured');
    const body = JSON.parse(req.init.body as string) as {
      currencyCode: string;
      total: { currencyCode: string };
    };
    expect(body.currencyCode).toBe('USD');
    expect(body.total.currencyCode).toBe('USD');
  });
});
