import type { Logger } from 'pino';

import type {
  ManagerAdminSignInRequest,
  SignInResponse,
  SignInSuccessResponse,
  TakeoverRequiredResponse,
} from '../../shared/bridge-api.js';
import type { OperatorRefusal } from '../../shared/audit/event-shape.js';

import type { ClerkExchanger } from './clerk-client.js';
import type { BackendClient } from './backend-client.js';
import type { SessionManager } from './session-manager.js';

/**
 * 004-operator-session T026 — manager/admin sign-in handler.
 *
 * Wave 1 path (b): POS terminal exchanges the password against Clerk
 * directly to obtain a fresh Clerk session JWT, then posts that JWT in
 * `Authorization: Bearer …` to Data-Pulse-2 along with a
 * `device_token_attestation` body. Data-Pulse-2 verifies the JWT via
 * Clerk JWKS — the password NEVER reaches Data-Pulse-2 (AD-2 /
 * Constitution v1.5.1).
 *
 * Refusal posture (NFR-003 / PR-2): every factor-distinguishable cause
 * collapses to `OperatorRefusal { category: 'invalid_input' }`. The
 * sole exceptions are network unreachability (`no_connection`) and the
 * cashier-PIN-only `rate_limited` carve-out (S4 only). The renderer
 * maps the category to a single generic Surface-6 message family.
 *
 * Redaction (PR-1): the `password` field is consumed by the Clerk
 * exchanger and IS NEVER persisted, logged, snapshotted, or surfaced
 * in any thrown error. The JWT is held only in-memory inside this
 * handler's call frame and the SessionManager record's
 * `backend_session_id` (the JWT itself is not stored — the backend
 * session id is the durable handle).
 */

export interface SignInHandlerDeps {
  clerk: ClerkExchanger;
  backend: BackendClient;
  sessionManager: SessionManager;
  /** Terminal-side proof of device-token possession (per 002). */
  deviceTokenAttestation: () => Promise<string> | string;
  /** Optional logger. Tests omit it. */
  logger?: Logger;
}

const REFUSE_INVALID: OperatorRefusal = { kind: 'refused', category: 'invalid_input' };
const REFUSE_NO_CONN: OperatorRefusal = { kind: 'refused', category: 'no_connection' };

export class SignInHandler {
  constructor(private readonly deps: SignInHandlerDeps) {}

  async signIn(req: ManagerAdminSignInRequest): Promise<SignInResponse> {
    // Boundary input validation — generic refusal on shape miss; we
    // never echo the rejected payload (Constitution VII).
    if (
      typeof req.identifier !== 'string' ||
      req.identifier.length === 0 ||
      typeof req.password !== 'string' ||
      req.password.length === 0
    ) {
      this.logRefusal('invalid_input', 'shape');
      return REFUSE_INVALID;
    }

    // 1. Clerk credential exchange — happens in main process; password
    //    is consumed by the exchanger and discarded after this call.
    const exchange = await this.deps.clerk.exchange({
      identifier: req.identifier,
      password: req.password,
    });
    if (exchange.kind === 'no_connection') {
      this.logRefusal('no_connection', 'clerk');
      return REFUSE_NO_CONN;
    }
    if (exchange.kind === 'refused') {
      this.logRefusal('invalid_input', 'clerk');
      return REFUSE_INVALID;
    }

    // 2. Backend sign-in — JWT in Authorization header; body carries
    //    NO credential material (Wave 1 path b). The role-eligibility,
    //    tenant/branch scope, and takeover detection happen
    //    server-side; the client treats every refusal mode as the
    //    single generic category.
    const attestation = await Promise.resolve(this.deps.deviceTokenAttestation());
    const backend = await this.deps.backend.signIn(
      { kind: 'manager_admin', device_token_attestation: attestation },
      exchange.jwt,
    );
    if (backend.kind === 'no_connection') {
      this.logRefusal('no_connection', 'backend');
      return REFUSE_NO_CONN;
    }
    if (backend.kind === 'refused') {
      this.logRefusal('invalid_input', 'backend');
      return REFUSE_INVALID;
    }
    if (backend.kind === 'takeover_required') {
      this.logSuccess('takeover_required');
      return { kind: 'takeover_required' } satisfies TakeoverRequiredResponse;
    }

    // 3. Manager / admin only at S1. Cashier-role identities cannot
    //    sign in via this endpoint per the backend contract; the
    //    backend already refuses them, but a defence-in-depth check
    //    here keeps the local trust boundary explicit.
    if (backend.operator.role === 'cashier') {
      this.logRefusal('invalid_input', 'role');
      return REFUSE_INVALID;
    }

    // 4. Create local in-memory session. S3 makes this durable.
    const record = this.deps.sessionManager.create({
      operator_id: backend.operator.id,
      display_name: backend.operator.display_name,
      role: backend.operator.role,
      tenant_id: backend.operator.tenant_id,
      branch_id: backend.operator.branch_id,
      backend_session_id: backend.operator_session.id,
      started_at: backend.operator_session.issued_at,
    });

    this.logSuccess('signed_in');
    return {
      kind: 'signed_in',
      session: {
        id: record.id,
        operator_id: record.operator_id,
        display_name: record.display_name,
        role: record.role,
        tenant_id: record.tenant_id,
        branch_id: record.branch_id,
        started_at: record.started_at,
      },
    } satisfies SignInSuccessResponse;
  }

  private logRefusal(category: 'invalid_input' | 'no_connection', stage: string): void {
    // PR-1 / FR-030 redaction: log only the category and stage; never
    // the identifier, never the password, never the JWT.
    this.deps.logger?.info(
      { event: 'operator.sign_in.refused', category, stage },
      'sign-in refused',
    );
  }

  private logSuccess(kind: 'signed_in' | 'takeover_required'): void {
    this.deps.logger?.info({ event: 'operator.sign_in.outcome', kind }, 'sign-in outcome');
  }
}
