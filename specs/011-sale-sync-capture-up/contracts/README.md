# Contracts — Sale Sync (Capture-UP)

Three contract surfaces. The DP2 one is **consumed, not owned** (authoritative upstream); the other
two are 011-internal seams.

## 1. Consumed: DP2 `captureSale` (authoritative upstream)

> **Source of truth:** `Data-Pulse-2/packages/contracts/openapi/pos-sales/sales.yaml` —
> `captureSale` → `POST /api/pos/v1/sales`. Mirrored here for reference only; 011 pins it via
> `src/shared/api-types.ts` (the `captureSale` shape is already in the pinned snapshot; the live
> re-pin is gated on #349 alongside the deploy).

- **Method/path:** `POST /api/pos/v1/sales`
- **Auth:** `PosOperatorAuthGuard` — `Authorization: Bearer <operator_session_token>` (NOT the device
  token). The operator token is read in-process from 004's session store (AD-2).
- **Headers:** `Idempotency-Key: <stable, derived from sale_id>` (REQUIRED on the write).
- **Dedup:** backend-side on `(tenant, sourceSystem, externalId)`.
- **Request body (v1, NO tender):**
  ```jsonc
  {
    "externalId": "<deterministic from sale_id>",
    "sourceSystem": "pos-pulse",            // fixed constant
    "tenantId": "<from durable Sale>",
    "branchId": "<from durable Sale / pairing>",
    "terminalId": "<from pairing>",
    "operatorId": "<from operator session>",
    "occurredAt": "<ISO-8601 UTC sale finalization time>",
    "currencyCode": "EGP",
    "total":  { "amountMinor": 0, "currencyCode": "EGP" },   // integer minor units
    "lines": [
      {
        "lineRef": "...",
        "productRef": "...",
        "quantity": "1",
        "unitPriceMinor": 0,                 // integer minor units
        "lineAmountMinor": 0                  // integer minor units
      }
    ]
    // NO tender/payment fields in v1 (AD-4)
  }
  ```
  > Field names above are illustrative of the consumed shape; the binding truth is the generated
  > `api-types.ts` once re-pinned (#349). Money is always integer minor units on our side; the wire
  > encoding follows the pinned contract (exact-decimal string per DP2 — converted at the boundary,
  > never a float).
- **Responses 011 handles:** `200/201` → synced · `409` → idempotent success (synced) · `5xx` /
  timeout → transient (retry) · `400/422` → permanent (dead-letter).

## 2. Internal seam: `SaleSyncClient` (DI)

```ts
// src/main/sales-sync/sale-sync-client-types.ts
export type SaleSyncResult =
  | { kind: 'ok' }                  // 200/201
  | { kind: 'duplicate' }           // 409 — already captured (idempotent success)
  | { kind: 'transient' }           // 5xx / timeout — retry with backoff
  | { kind: 'permanent' }           // 400/422 — dead-letter
  | { kind: 'no_connection' };      // offline / DNS / refused

export interface SaleSyncClient {
  /** Resolves to a typed outcome; NEVER rejects. Raw response body NEVER surfaced (P7).
   *  The operator token is attached main-process-side and never passed through here. */
  postSale(payload: CaptureSalePayload): Promise<SaleSyncResult>;
}
```
The engine depends only on this interface. Tests inject a fake; `create-sale-sync-client` (live HTTP)
implements it unchanged when #349 lands.

## 3. Internal seam: `sales:syncStatus` bridge channel (read-only)

```ts
// preload bridge — READ ONLY (reviewed under §A4 P8 bridge-security)
sales: {
  syncStatus(): Promise<{
    pending: number;
    deadLetter: number;
    lastSuccessAt: string | null;   // ISO-8601 UTC, absolute (no "x ago")
  }>;
}
```
- No write/trigger handler is exposed to the renderer (the renderer cannot start/stop the drain).
- No operator token, PII, card data, or raw error body crosses the bridge (redaction smoke test).
- Counts are tenant-scoped (P17).
