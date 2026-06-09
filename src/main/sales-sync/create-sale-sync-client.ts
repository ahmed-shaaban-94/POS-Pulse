/**
 * 011-sale-sync-capture-up T061 — `createSaleSyncClient`.
 *
 * The CONCRETE live HTTP client behind the `SaleSyncClient` DI seam
 * (`sale-sync-client-types.ts`). POSTs a capture payload to DP2 `captureSale`
 * (`POST /api/pos/v1/sales`) and maps the HTTP outcome onto the engine's union
 * (`ok` / `duplicate` / `transient` / `permanent` / `no_connection`).
 *
 * Established repo pattern (mirrors `operator/backend-client.ts`):
 *   • Factory `{ baseUrl, fetch, getOperatorToken, timeoutMs }`; `fetch` injected.
 *   • `AbortSignal.timeout(timeoutMs)`.
 *   • Resolve on EVERY reachable response; reject ONLY on a transport fault →
 *     `{ kind:'no_connection' }`. NEVER throws.
 *
 * Outcome mapping (contracts/README.md):
 *   200/201 → ok ·  409 → duplicate (idempotent success) ·  5xx / timeout →
 *   transient (retry) ·  400/422 (and other 4xx) → permanent (dead-letter) ·
 *   network/DNS/refused/timeout-before-response → no_connection.
 *
 * Auth (contracts/README.md): `Authorization: Bearer <operator_session_token>`
 * (the Clerk operator JWT — NOT the device token). The token is read fresh per
 * POST via the injected `getOperatorToken` (the engine already gates the drain on
 * a present session and re-checks mid-drain; this is the per-request attach). It is
 * a secret — attached to the outbound request only, NEVER logged, NEVER placed in
 * the payload, NEVER crossing the bridge (P7/P8). `Idempotency-Key` is the
 * deterministic `payload.externalId` (REQUIRED on the write); the backend dedups on
 * `(tenant, sourceSystem, externalId)` so retries collapse to one record.
 *
 * Wire-shape boundary: the internal `CaptureSalePayload` is flat (`totalMinor`,
 * numeric `quantity`); the DP2 wire body is nested (`total:{amountMinor,
 * currencyCode}`, top-level `currencyCode`, string `quantity`). This client is the
 * conversion boundary. NOTE (#349 reconcile): the wire shape is implemented against
 * the 011 contract README, which marks its body ILLUSTRATIVE — the binding truth is
 * the generated `api-types.ts` once re-pinned from the deployed DP2 contract (not
 * yet done; the live snapshot at api-preprod serves no /openapi.json). The live
 * smoke test is the validation gate: a correct POST returns 200/201/409; a shape
 * mismatch returns 400/422 (→ dead-letter, observable). Currency is single-store
 * EGP in v1 (assumption matching the read-down mapper).
 */

import type { CaptureSalePayload } from './capture-payload.js';
import type { SaleSyncClient, SaleSyncResult } from './sale-sync-client-types.js';

const SALES_PATH = '/api/pos/v1/sales';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CURRENCY_CODE = 'EGP';

export interface CreateSaleSyncClientDeps {
  /** Data-Pulse-2 base URL, e.g. `https://api-preprod.smartdatapulse.tech`. */
  baseUrl: string;
  /** `fetch` implementation. Production binds the global; tests inject. */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /**
   * In-process read of the operator session JWT. The engine already pauses the
   * drain when this is null; defensively, a null here maps to `no_connection`
   * (treated as retryable — the sale stays pending) rather than a POST without auth.
   */
  getOperatorToken: () => string | null;
  /** ISO-4217 currency for the store (v1 single-currency). Defaults to EGP. */
  currencyCode?: string;
  /** Override the request timeout in tests. */
  timeoutMs?: number;
}

/** The DP2 `captureSale` wire body (nested totals, string quantity, currencyCode). */
interface CaptureSaleWireBody {
  externalId: string;
  sourceSystem: 'pos-pulse';
  tenantId: string;
  branchId: string;
  terminalId: string;
  operatorId: string;
  occurredAt: string;
  currencyCode: string;
  total: { amountMinor: number; currencyCode: string };
  lines: Array<{
    lineRef: string;
    productRef: string;
    quantity: string;
    unitPriceMinor: number;
    lineAmountMinor: number;
  }>;
}

/** Pure transform: internal payload → DP2 wire body (the conversion boundary). */
export function toWireBody(payload: CaptureSalePayload, currencyCode: string): CaptureSaleWireBody {
  return {
    externalId: payload.externalId,
    sourceSystem: payload.sourceSystem,
    tenantId: payload.tenantId,
    branchId: payload.branchId,
    terminalId: payload.terminalId,
    operatorId: payload.operatorId,
    occurredAt: payload.occurredAt,
    currencyCode,
    total: { amountMinor: payload.totalMinor, currencyCode },
    lines: payload.lines.map((line) => ({
      lineRef: line.lineRef,
      productRef: line.productRef,
      quantity: String(line.quantity),
      unitPriceMinor: line.unitPriceMinor,
      lineAmountMinor: line.lineAmountMinor,
    })),
  };
}

/** Map an HTTP status onto the engine's outcome union (contracts/README.md). */
export function classifyStatus(status: number): SaleSyncResult {
  if (status === 200 || status === 201) return { kind: 'ok' };
  if (status === 409) return { kind: 'duplicate' };
  if (status >= 500) return { kind: 'transient' };
  // Any other 4xx (400/401/403/422/…) is permanent — the request will not
  // succeed on retry without intervention; dead-letter it.
  if (status >= 400) return { kind: 'permanent' };
  // Unexpected 2xx/3xx — treat as transient (don't lose the sale).
  return { kind: 'transient' };
}

export function createSaleSyncClient(deps: CreateSaleSyncClientDeps): SaleSyncClient {
  const { fetch: fetchImpl, baseUrl, getOperatorToken } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const currencyCode = deps.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const root = baseUrl.replace(/\/$/, '');

  return {
    async postSale(payload: CaptureSalePayload): Promise<SaleSyncResult> {
      const token = getOperatorToken();
      if (token === null || token.length === 0) {
        // No session token: do not POST unauthenticated. The engine gate should
        // have paused already; map to no_connection so the sale stays pending.
        return { kind: 'no_connection' };
      }

      const body = toWireBody(payload, currencyCode);

      let response: Response;
      try {
        response = await fetchImpl(`${root}${SALES_PATH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': payload.externalId,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Transport fault (DNS / TLS / refused / timeout) — retryable.
        return { kind: 'no_connection' };
      }

      // Body is intentionally not read: outcome is derived from status only, and
      // the raw response body is never surfaced (P7).
      return classifyStatus(response.status);
    },
  };
}
