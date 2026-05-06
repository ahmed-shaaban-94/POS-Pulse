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
 * wraps `fetch` with the device-token + Authorization headers; tests
 * inject a fake.
 */
export interface BackendClient {
  signIn(req: BackendSignInRequest, jwt: string): Promise<BackendSignInResponse>;
  signOut(req: BackendSignOutRequest, jwt: string): Promise<BackendSignOutResponse>;
}
