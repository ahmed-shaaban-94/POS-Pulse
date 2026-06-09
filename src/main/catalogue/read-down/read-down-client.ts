/**
 * 010-pos-catalog-read-down-consumption T020/T021 — `createReadDownClient`.
 *
 * The CONCRETE live HTTP client behind the `ReadDownClient` DI seam
 * (`read-down-client-types.ts`). It fetches the SHIPPED backend catalogue
 * snapshot (`GET /api/pos/v1/catalog/snapshot`, Data-Pulse-2 PR #490) and maps the
 * transport outcome onto the contract union (`ok` / `no_connection` / `failed`).
 *
 * Established repo pattern (mirrors `operator/backend-client.ts` + the
 * voucher-authority clients):
 *   • Factory `{ baseUrl, fetch, getDeviceToken, timeoutMs }`; `fetch` injected
 *     (production binds `globalThis.fetch`).
 *   • `AbortSignal.timeout(timeoutMs)`.
 *   • Resolve on EVERY reachable response (incl. non-2xx); reject ONLY on a
 *     transport fault → mapped to `{ kind:'no_connection' }`. NEVER throws.
 *   • Non-2xx / malformed body → `{ kind:'failed' }` (FR-7: prior catalogue
 *     preserved by the driver — the writer never runs on a non-`ok` result).
 *
 * Auth (the load-bearing reversal, contracts/backend-catalogue-snapshot.md banner
 * + plan AD-7): `Authorization: Bearer <device_token>`. The backend has NO
 * `X-Terminal-Token` seam — the guard reads `Authorization` only. The device token
 * is read main-process-side via the injected `getDeviceToken` and attached to the
 * outbound request only; it is a secret — NEVER logged and NEVER surfaced on the
 * returned union (P7 / NFR-3). The read-down driver is non-session-gated
 * (Constitution VIII), so the device token is the SOLE credential — no operator JWT.
 *
 * Contract note: the response shape is the backend's `SellableCatalogRow` (mirrored
 * locally in `map-sellable-row.ts`); `api-types.ts` is NOT yet re-pinned from the
 * deployed contract (#349) and MUST NOT be hand-edited, so the response is validated
 * structurally here. When the re-pin lands, the local shape is replaced by the
 * generated type and this validation can defer to it.
 */

import type { SellableCatalogRow } from './map-sellable-row.js';
import type { ReadDownClient, ReadDownFetchResult } from './read-down-client-types.js';

const SNAPSHOT_PATH = '/api/pos/v1/catalog/snapshot';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface CreateReadDownClientDeps {
  /** Data-Pulse-2 base URL, e.g. `https://api-preprod.smartdatapulse.tech`. */
  baseUrl: string;
  /** `fetch` implementation. Production binds the global; tests inject. */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /**
   * In-process read of the device token (the paired-terminal credential). Returns
   * `null`/`''` when the terminal is not paired — the request is not attempted.
   * The token is read here main-process-side and never crosses the bridge.
   */
  getDeviceToken: () => Promise<string | null>;
  /** Override the request timeout in tests. */
  timeoutMs?: number;
}

/** The reachable snapshot envelope. Shape mirrors the backend contract (see header). */
interface SnapshotEnvelope {
  snapshot_id?: string | null;
  rows?: unknown;
}

/** Narrow an unknown value to a `SellableCatalogRow` (structural; never throws). */
function isSellableCatalogRow(value: unknown): value is SellableCatalogRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  const price = row['price'];
  if (typeof price !== 'object' || price === null) return false;
  const priceObj = price as Record<string, unknown>;
  return (
    typeof row['product_id'] === 'string' &&
    typeof row['sku'] === 'string' &&
    typeof row['name'] === 'string' &&
    typeof priceObj['amount'] === 'string' &&
    typeof priceObj['currency_code'] === 'string' &&
    typeof row['tax_category'] === 'string' &&
    typeof row['active'] === 'boolean' &&
    typeof row['row_cursor'] === 'string'
  );
}

export function createReadDownClient(deps: CreateReadDownClientDeps): ReadDownClient {
  const { fetch: fetchImpl, baseUrl, getDeviceToken } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const root = baseUrl.replace(/\/$/, '');

  return {
    async fetchSnapshot(): Promise<ReadDownFetchResult> {
      // The device token is the sole credential. No token (unpaired) → treat as a
      // reached-but-failed request: the driver records a failed attempt and the
      // working catalogue is preserved (the writer never runs).
      let deviceToken: string | null;
      try {
        deviceToken = await getDeviceToken();
      } catch {
        return { kind: 'failed' };
      }
      if (deviceToken === null || deviceToken.length === 0) {
        return { kind: 'failed' };
      }

      let response: Response;
      try {
        response = await fetchImpl(`${root}${SNAPSHOT_PATH}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${deviceToken}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Transport fault (DNS / TLS / refused / timeout) — backend unreachable.
        return { kind: 'no_connection' };
      }

      if (!response.ok) {
        // Reached but non-2xx (401/403/404/5xx). Collapse to `failed` — the raw
        // body is never surfaced (P7); the driver preserves the prior catalogue.
        return { kind: 'failed' };
      }

      let parsed: unknown;
      try {
        parsed = (await response.json()) as unknown;
      } catch {
        return { kind: 'failed' };
      }

      if (typeof parsed !== 'object' || parsed === null) {
        return { kind: 'failed' };
      }
      const envelope = parsed as SnapshotEnvelope;
      if (!Array.isArray(envelope.rows)) {
        return { kind: 'failed' };
      }
      // A single malformed row poisons the snapshot: the full-snapshot-replace
      // model (R3) requires a complete, trustworthy set, so reject the whole
      // fetch rather than silently dropping rows. Per-row money/shape mapping
      // (mapSellableRow) still guards downstream in the writer.
      if (!envelope.rows.every(isSellableCatalogRow)) {
        return { kind: 'failed' };
      }

      return {
        kind: 'ok',
        sourceSnapshotId: typeof envelope.snapshot_id === 'string' ? envelope.snapshot_id : null,
        rows: envelope.rows,
      };
    },
  };
}
