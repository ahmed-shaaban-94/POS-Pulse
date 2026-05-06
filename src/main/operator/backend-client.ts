/**
 * 004-operator-session — Data-Pulse-2 client for Wave 1 endpoints.
 *
 * Defines the local request/response types matching the merged
 * Wave 1 contract (per owner decision: do NOT regenerate
 * `src/shared/api-types.ts` from OpenAPI in S1). The shapes here
 * mirror `specs/004-operator-session/contracts/backend-endpoints.md`
 * Endpoints 2 + 3 verbatim.
 *
 *   POST /api/pos/v1/operators/sign-in
 *   POST /api/pos/v1/operators/sign-out
 *
 * The Clerk JWT travels in the `Authorization: Bearer …` header; the
 * device token travels in the platform's existing terminal-token
 * header (defined once at the platform level by 001/002). The
 * password NEVER appears anywhere in this layer (Wave 1 path b /
 * AD-2). The body of `/sign-in` carries `kind` + a
 * `device_token_attestation` — no `password`, no `identifier`,
 * no `pin`.
 */

import type { Role } from '../../shared/operator/role.js';

export interface BackendSignInRequest {
  /** Discriminator. Wave 1 only ships `manager_admin`. */
  kind: 'manager_admin';
  /** Terminal-side proof of device-token possession (per 002). */
  device_token_attestation: string;
}

export interface BackendSignInOperator {
  id: string;
  display_name: string;
  role: Role;
  tenant_id: string;
  branch_id: string;
}

export interface BackendSignInSuccess {
  kind: 'signed_in';
  operator: BackendSignInOperator;
  operator_session: {
    id: string;
    issued_at: string;
  };
}

export interface BackendTakeoverRequired {
  kind: 'takeover_required';
}

export type BackendSignInResponse =
  | BackendSignInSuccess
  | BackendTakeoverRequired
  | { kind: 'refused' }
  | { kind: 'no_connection' };

export interface BackendSignOutRequest {
  session_id: string;
}

export type BackendSignOutResponse =
  | { kind: 'signed_out' }
  | { kind: 'refused' }
  | { kind: 'no_connection' };

/**
 * Protocol the handler depends on. The production implementation
 * (`createBackendClient` below) wraps `fetch` with the device-token +
 * Authorization headers; tests inject a fake.
 */
export interface BackendClient {
  signIn(req: BackendSignInRequest, jwt: string): Promise<BackendSignInResponse>;
  signOut(req: BackendSignOutRequest, jwt: string): Promise<BackendSignOutResponse>;
}

const SIGN_IN_PATH = '/api/pos/v1/operators/sign-in';
const SIGN_OUT_PATH = '/api/pos/v1/operators/sign-out';
const DEFAULT_TIMEOUT_MS = 15_000;

export interface CreateBackendClientDeps {
  /** Data-Pulse-2 base URL, e.g. `https://api.smartdatapulse.tech`. */
  baseUrl: string;
  /** `fetch` implementation. Production binds the global; tests inject. */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Override the request timeout in tests. */
  timeoutMs?: number;
}

/**
 * Production `BackendClient` for Data-Pulse-2 Wave 1 endpoints.
 *
 * - `POST /api/pos/v1/operators/sign-in`
 *     Headers: `Authorization: Bearer <jwt>`, `Content-Type: application/json`.
 *     Body (verbatim per Wave 1 contract): `{ kind: 'manager_admin',
 *     device_token_attestation }`. **NEVER** sends `password`,
 *     `identifier`, or `pin`.
 *
 * - `POST /api/pos/v1/operators/sign-out`
 *     Headers: `Authorization: Bearer <jwt>`, `Content-Type: application/json`.
 *     Body: `{ session_id }`.
 *
 * Resolve-on-reachable / reject-only-on-transport contract (matching
 * 002's `network.ts`): every backend response — including 4xx/5xx —
 * resolves to a typed result. Network errors (DNS/TLS/refused/timeout)
 * resolve to `{ kind: 'no_connection' }`. The function NEVER throws,
 * so the sign-in handler does not need a try/catch wrapper.
 *
 * Failure-mode collapse: every 4xx/5xx maps to `refused` (PR-2 — no
 * factor distinction). The single exception is `takeover_required`,
 * which Data-Pulse-2 returns as `{ kind: 'takeover_required' }` in
 * the success body per the Wave 1 contract — surfaced verbatim.
 *
 * Redaction: the `Authorization` header value (the JWT) is held only
 * in the `init.headers` object passed to fetch and never logged.
 */
export function createBackendClient(deps: CreateBackendClientDeps): BackendClient {
  const { fetch: fetchImpl, baseUrl } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const root = baseUrl.replace(/\/$/, '');

  return {
    async signIn(req: BackendSignInRequest, jwt: string): Promise<BackendSignInResponse> {
      let response: Response;
      try {
        response = await fetchImpl(`${root}${SIGN_IN_PATH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(req),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return { kind: 'no_connection' };
      }
      if (!response.ok) return { kind: 'refused' };
      let parsed: unknown;
      try {
        parsed = (await response.json()) as unknown;
      } catch {
        return { kind: 'refused' };
      }
      return interpretSignInResponse(parsed);
    },

    async signOut(req: BackendSignOutRequest, jwt: string): Promise<BackendSignOutResponse> {
      let response: Response;
      try {
        response = await fetchImpl(`${root}${SIGN_OUT_PATH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(req),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return { kind: 'no_connection' };
      }
      if (!response.ok) return { kind: 'refused' };
      // Body is informational — sign-out is idempotent and the
      // client treats the local tear-down as authoritative
      // regardless of body shape.
      return { kind: 'signed_out' };
    },
  };
}

function interpretSignInResponse(parsed: unknown): BackendSignInResponse {
  if (typeof parsed !== 'object' || parsed === null) return { kind: 'refused' };
  const v = parsed as Record<string, unknown>;
  if (v['kind'] === 'takeover_required') return { kind: 'takeover_required' };
  if (v['kind'] !== 'signed_in') return { kind: 'refused' };
  const op = v['operator'] as Record<string, unknown> | undefined;
  const sess = v['operator_session'] as Record<string, unknown> | undefined;
  if (op === undefined || sess === undefined) return { kind: 'refused' };
  if (
    typeof op['id'] !== 'string' ||
    typeof op['display_name'] !== 'string' ||
    typeof op['role'] !== 'string' ||
    typeof op['tenant_id'] !== 'string' ||
    typeof op['branch_id'] !== 'string'
  ) {
    return { kind: 'refused' };
  }
  if (op['role'] !== 'cashier' && op['role'] !== 'manager' && op['role'] !== 'admin') {
    return { kind: 'refused' };
  }
  if (typeof sess['id'] !== 'string' || typeof sess['issued_at'] !== 'string') {
    return { kind: 'refused' };
  }
  return {
    kind: 'signed_in',
    operator: {
      id: op['id'],
      display_name: op['display_name'],
      role: op['role'],
      tenant_id: op['tenant_id'],
      branch_id: op['branch_id'],
    },
    operator_session: {
      id: sess['id'],
      issued_at: sess['issued_at'],
    },
  };
}
