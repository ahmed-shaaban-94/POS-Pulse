/**
 * 004-operator-session — Clerk credential exchange (Wave 1, path b).
 *
 * The POS terminal exchanges the operator-supplied identifier +
 * password against Clerk's public sign-in API to obtain a fresh Clerk
 * session JWT. Data-Pulse-2 then verifies that JWT via JWKS — the
 * password NEVER reaches Data-Pulse-2 (AD-2 / Constitution v1.5.1).
 *
 * The exchange happens in the main process so credentials never live
 * in the renderer beyond the single bridge hop. The published
 * `@clerk/clerk-js` package is a browser-shaped library that requires
 * `window`/`document` globals on first construction — it cannot be
 * instantiated from the Electron main process (Node context, no DOM).
 * The production exchanger therefore calls Clerk's documented public
 * Frontend API directly via `fetch`. The spec authorises both paths
 * ("Frontend SDK / public APIs" — see contracts/backend-endpoints.md
 * Endpoint 2 revision note + coordination/wave1-alignment-decision.md).
 *
 * The exchanger MUST NOT echo the password into any thrown error,
 * console line, log line, or returned value (PR-1). Success returns a
 * JWT + minimal operator metadata; failure returns a generic refusal
 * marker — `kind: 'refused'` with NO factor-distinguishing detail
 * (NFR-003 / PR-2).
 */

import { isRole, type Role } from '../../shared/operator/role.js';

export interface ClerkExchangeRequest {
  identifier: string;
  password: string;
}

export interface ClerkExchangeSuccess {
  kind: 'ok';
  /** Clerk session JWT (Bearer token for Data-Pulse-2). */
  jwt: string;
  /** Clerk user id (== `sub` claim). */
  operator_id: string;
  /** Best display name from Clerk's user record. */
  display_name: string;
  /** Role from Clerk's public metadata, mapped to the closed Role set. */
  role: Role;
}

export type ClerkExchangeResult =
  | ClerkExchangeSuccess
  | { kind: 'refused' }
  | { kind: 'no_connection' };

/**
 * Protocol the sign-in handler depends on. Tests inject a simple
 * fake; production wires `createClerkExchanger` below.
 */
export interface ClerkExchanger {
  exchange(req: ClerkExchangeRequest): Promise<ClerkExchangeResult>;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export interface CreateClerkExchangerDeps {
  /** Clerk Frontend API base URL, e.g. `https://clerk.example.com`. */
  frontendApiBaseUrl: string;
  /** `fetch` implementation. Production binds the global; tests inject a fake. */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Override the request timeout in tests. */
  timeoutMs?: number;
}

/**
 * Decode the Frontend API host from a Clerk publishable key.
 *
 * Format (Clerk public docs): `pk_(test|live)_<base64-url-encoded
 * frontend-api-host>$`. The terminating `$` is part of the base64
 * payload (a Clerk delimiter), not the host itself. Returns `null`
 * if the key is malformed.
 *
 * The publishable key itself is NOT a secret — it is intended for
 * client-side embedding. Surfacing it in logs is acceptable; we still
 * keep it out of error messages by convention.
 */
export function decodeFrontendApiBaseUrl(publishableKey: string): string | null {
  const prefix = publishableKey.startsWith('pk_test_')
    ? 'pk_test_'
    : publishableKey.startsWith('pk_live_')
      ? 'pk_live_'
      : null;
  if (prefix === null) return null;
  const encoded = publishableKey.slice(prefix.length);
  // Strip Clerk's terminating `$` if present.
  const stripped = encoded.endsWith('$') ? encoded.slice(0, -1) : encoded;
  if (stripped.length === 0) return null;
  let decoded: string;
  try {
    // Buffer is available in the Electron main process (Node context).
    decoded = Buffer.from(stripped, 'base64').toString('utf-8').trim();
  } catch {
    return null;
  }
  // The decoded value is a hostname like `clerk.acme.com`. Validate
  // shape defensively — refuse anything containing whitespace, slash,
  // or scheme markers (no protocol-confusion attacks via env-var
  // tampering).
  if (!/^[a-z0-9.-]+$/i.test(decoded)) return null;
  return `https://${decoded}`;
}

/**
 * Production `ClerkExchanger` backed by Clerk's public Frontend API.
 *
 * Two-step exchange:
 *
 *   1. POST {fapi}/v1/client/sign_ins
 *      body: identifier=<email>&strategy=password&password=<pw>
 *      Content-Type: application/x-www-form-urlencoded
 *      Returns a `client` object with the active sign-in attempt,
 *      its created session, and a `last_active_token.jwt` field.
 *      A failed attempt (wrong password, unknown identifier, etc.)
 *      surfaces as 4xx — collapsed to `{ kind: 'refused' }` per
 *      NFR-003.
 *
 *   2. The session JWT lives in `response.client.sessions[0].
 *      last_active_token.jwt` for the standard happy path. Clerk's
 *      JWT shape is JWS with the user id in the `sub` claim and
 *      role in `public_metadata.role` (per Wave 1 alignment).
 *
 * Network failures resolve to `{ kind: 'no_connection' }`. Any thrown
 * error path is swallowed and mapped to `refused` so the renderer
 * cannot distinguish among factor-level causes (PR-2).
 *
 * The password input is consumed by `URLSearchParams.set(...)` and
 * `JSON.stringify` is NEVER called on the request body, so the
 * password cannot be enumerated through error.cause. The function
 * returns no field that contains the password.
 */
export function createClerkExchanger(deps: CreateClerkExchangerDeps): ClerkExchanger {
  const { fetch: fetchImpl, frontendApiBaseUrl } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async exchange(req: ClerkExchangeRequest): Promise<ClerkExchangeResult> {
      const url = `${frontendApiBaseUrl.replace(/\/$/, '')}/v1/client/sign_ins`;
      const body = new URLSearchParams();
      body.set('identifier', req.identifier);
      body.set('strategy', 'password');
      body.set('password', req.password);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Transport failure (DNS/TLS/refused/timeout). The thrown error
        // MUST NOT propagate — it can carry the URL with the body
        // visible in `cause`. Map to no_connection.
        return { kind: 'no_connection' };
      }

      if (!response.ok) {
        // Any 4xx/5xx — collapse to generic refusal. PR-2 forbids
        // distinguishing among credential-shape, account-disabled,
        // unknown-identifier, etc.
        return { kind: 'refused' };
      }

      // Parse defensively. A malformed body becomes `refused`, never
      // an exception.
      let parsed: unknown;
      try {
        parsed = (await response.json()) as unknown;
      } catch {
        return { kind: 'refused' };
      }

      const extracted = extractSession(parsed);
      if (extracted === null) return { kind: 'refused' };
      return extracted;
    },
  };
}

interface ClerkSignInResponse {
  response?: {
    client?: ClerkClient;
  };
  client?: ClerkClient;
}

interface ClerkClient {
  sessions?: ClerkSession[];
}

interface ClerkSession {
  status?: string;
  last_active_token?: { jwt?: string };
  user?: ClerkUser;
}

interface ClerkUser {
  id?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email_addresses?: Array<{ email_address?: string }>;
  public_metadata?: { role?: string };
}

function extractSession(parsed: unknown): ClerkExchangeSuccess | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const root = parsed as ClerkSignInResponse;
  // Clerk wraps client in `response.client` for some endpoints and
  // `client` for others. Read both defensively.
  const client = root.response?.client ?? root.client;
  const session = client?.sessions?.[0];
  if (session === undefined) return null;
  if (session.status !== undefined && session.status !== 'active') return null;
  const jwt = session.last_active_token?.jwt;
  const user = session.user;
  if (typeof jwt !== 'string' || jwt.length === 0) return null;
  if (user === undefined) return null;
  if (typeof user.id !== 'string' || user.id.length === 0) return null;
  const role = user.public_metadata?.role;
  if (!isRole(role)) return null;
  return {
    kind: 'ok',
    jwt,
    operator_id: user.id,
    display_name: deriveDisplayName(user),
    role,
  };
}

function deriveDisplayName(user: ClerkUser): string {
  const first = (user.first_name ?? '').trim();
  const last = (user.last_name ?? '').trim();
  if (first.length > 0 || last.length > 0) {
    return [first, last].filter((s) => s.length > 0).join(' ');
  }
  if (typeof user.username === 'string' && user.username.length > 0) return user.username;
  const email = user.email_addresses?.[0]?.email_address;
  if (typeof email === 'string' && email.length > 0) return email;
  return user.id ?? 'Operator';
}
