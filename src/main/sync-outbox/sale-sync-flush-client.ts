/**
 * 008 sale-sync flush — production `SaleSyncFlushClient`.
 *
 * Mirrors `catalogue/read-down/read-down-client.ts`: a factory taking an
 * injected `fetch` (production binds the global), `AbortSignal.timeout`, and a
 * resolve-on-reachable / reject-only-on-transport contract — the method NEVER
 * throws, so the worker needs no try/catch.
 *
 * POSTs one finalized sale to DP-2 `POST /api/pos/v1/sales` (captureSale,
 * Option-Y auth): `Authorization: Bearer <clerk-jwt>` +
 * `X-Device-Attestation: <attestation>` + `Idempotency-Key: <stable>` + a pure
 * sale-data JSON body. Outcome mapping:
 *   - 201 (fresh) / 200 (idempotent replay)      → ok
 *   - 401 / 403 (auth — expired/invalid JWT)     → no_connection (RETRYABLE)
 *   - other 4xx (400/404/409/422 — validation)   → refused   (NON-retryable)
 *   - 5xx / transport fault                      → no_connection (retryable)
 *
 * Why 401/403 are RETRYABLE, not refused: the Clerk session JWT lives ~60s, so
 * a flush attempted with a stale-but-present JWT legitimately 401s. Treating
 * that as `refused` → the worker would `markFailed` (terminal) and the sale
 * would NEVER sync — silent lost revenue. A fresh sign-in (the option-(c)
 * trigger) re-acquires a valid JWT and the still-`pending` row drains. Only a
 * genuine validation/dedup error (a malformed body) is permanently refused.
 *
 * Redaction (AD-2 / PR-1): the JWT + attestation live only in the `init.headers`
 * object passed to fetch; they are never logged, never put in the body, and a
 * thrown transport error cannot carry them (the body — the only thing
 * JSON.stringify touches — contains no credential).
 */
import type {
  SaleSyncFlushClient,
  SaleSyncFlushRequest,
  SaleSyncFlushResult,
} from './sale-sync-flush-client-types.js';

const SALES_PATH = '/api/pos/v1/sales';
const DEFAULT_TIMEOUT_MS = 15_000;

export interface CreateSaleSyncFlushClientDeps {
  /** Data-Pulse-2 base URL, e.g. `https://api-preprod.smartdatapulse.tech`. */
  baseUrl: string;
  /** `fetch` implementation. Production binds the global; tests inject. */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Override the request timeout in tests. */
  timeoutMs?: number;
}

export function createSaleSyncFlushClient(
  deps: CreateSaleSyncFlushClientDeps,
): SaleSyncFlushClient {
  const { fetch: fetchImpl, baseUrl } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const root = baseUrl.replace(/\/$/, '');

  return {
    async flushSale(req: SaleSyncFlushRequest): Promise<SaleSyncFlushResult> {
      let response: Response;
      try {
        response = await fetchImpl(`${root}${SALES_PATH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${req.jwt}`,
            'X-Device-Attestation': req.deviceAttestation,
            'Idempotency-Key': req.idempotencyKey,
          },
          // Only the pure sale body is serialized — no credential field.
          body: JSON.stringify(req.body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Transport fault (DNS / TLS / refused / timeout) — backend unreachable.
        // Retryable: leave the outbox row pending. The thrown error MUST NOT
        // propagate (it can carry the request init); map to no_connection.
        return { kind: 'no_connection' };
      }

      if (response.ok) {
        // 201 fresh capture OR 200 idempotent replay — both are success.
        return { kind: 'ok' };
      }
      if (response.status === 401 || response.status === 403) {
        // Auth — almost always an EXPIRED 60s session JWT. RETRYABLE: keep the
        // row pending so a fresh sign-in re-drains it. Marking it refused here
        // would lose the sale permanently.
        return { kind: 'no_connection' };
      }
      if (response.status >= 500) {
        // Reached but the server erred — retryable.
        return { kind: 'no_connection' };
      }
      // Other 4xx (400/404/409/422) — genuine validation / dedup error. The
      // sale will not succeed as-is; non-retryable. Raw body never surfaced.
      return { kind: 'refused' };
    },
  };
}
