/**
 * 004-operator-session — Clerk credential exchange (Wave 1, path b).
 *
 * The POS terminal exchanges the operator-supplied identifier +
 * password against Clerk's public sign-in API to obtain a fresh Clerk
 * session JWT. Data-Pulse-2 then verifies that JWT via JWKS — the
 * password NEVER reaches Data-Pulse-2 (AD-2 / Constitution v1.5.1).
 *
 * The exchange happens in the main process so credentials never live
 * in the renderer beyond the single bridge hop. This module is a thin
 * Protocol-style abstraction over the Clerk JS SDK (which is a
 * browser-shaped library); the production wiring will instantiate the
 * SDK in main with a window-shim, or call Clerk's REST endpoints
 * directly. Either way, tests inject a fake exchanger.
 *
 * The exchanger MUST NOT echo the password into any thrown error,
 * console line, log line, or returned value (PR-1). Success returns a
 * JWT + minimal operator metadata; failure returns a generic refusal
 * marker — `kind: 'refused'` with NO factor-distinguishing detail
 * (NFR-003 / PR-2).
 */

import type { Role } from '../../shared/operator/role.js';

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
 * Protocol the sign-in handler depends on. Production implementations
 * wrap `@clerk/clerk-js`; tests inject a simple fake.
 */
export interface ClerkExchanger {
  exchange(req: ClerkExchangeRequest): Promise<ClerkExchangeResult>;
}
