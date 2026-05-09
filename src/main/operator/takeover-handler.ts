import { randomUUID } from 'node:crypto';

import type { Logger } from 'pino';

import type {
  ConfirmTakeoverRequest,
  ConfirmTakeoverResponse,
  CancelTakeoverRequest,
  CancelTakeoverResponse,
  SignInSuccessResponse,
} from '../../shared/bridge-api.js';
import type { OperatorRefusal } from '../../shared/audit/event-shape.js';
import type { Role } from '../../shared/operator/role.js';

import type { BackendClient } from './backend-client.js';
import type { SessionManager } from './session-manager.js';
import type { JwtHolder } from './jwt-holder.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import type { PairingStore } from '../pairing/store.js';

/** TTL for proto-sessions: 60 seconds. */
const PROTO_SESSION_TTL_MS = 60_000;

const REFUSE_INVALID: OperatorRefusal = { kind: 'refused', category: 'invalid_input' };
const REFUSE_NO_CONN: OperatorRefusal = { kind: 'refused', category: 'no_connection' };

/**
 * An in-memory record minted by signIn when the backend (or local check)
 * reports `takeover_required`. Holds everything needed to complete or
 * abandon the takeover without re-submitting credentials.
 *
 * `jwt` is `null` for the cashier path — cashier sessions are local-only
 * (AD-2) and never call Endpoint 4.
 */
export interface ProtoSession {
  pending_takeover_id: string;
  operator_id: string;
  display_name: string;
  role: Role;
  tenant_id: string;
  branch_id: string;
  jwt: string | null;
  /** `Date.now()` at creation; used to enforce the 60-second TTL. */
  created_at: number;
}

/**
 * In-memory capability-token store for pending takeover confirmations.
 *
 * `get()` enforces TTL by returning `undefined` for expired entries and
 * evicting them in place. This keeps the expiry policy in one location.
 */
export class ProtoSessionStore {
  private readonly map = new Map<string, ProtoSession>();

  set(proto: ProtoSession): void {
    this.map.set(proto.pending_takeover_id, proto);
  }

  /** Returns the proto-session if it exists and is within TTL, else `undefined`. */
  get(pending_takeover_id: string): ProtoSession | undefined {
    const entry = this.map.get(pending_takeover_id);
    if (entry === undefined) return undefined;
    if (Date.now() - entry.created_at > PROTO_SESSION_TTL_MS) {
      this.map.delete(pending_takeover_id);
      return undefined;
    }
    return entry;
  }

  delete(pending_takeover_id: string): void {
    this.map.delete(pending_takeover_id);
  }
}

export interface TakeoverHandlerDeps {
  protoStore: ProtoSessionStore;
  sessionManager: SessionManager;
  backend: BackendClient;
  jwtHolder: JwtHolder;
  auditEmitter: AuditEmitter;
  pairingStore: PairingStore;
  deviceTokenAttestation: () => Promise<string> | string;
  logger?: Logger;
}

/**
 * 004-operator-session T070 + T071 — takeover confirm / cancel handler.
 *
 * T070: `confirmTakeover` — validates the pending_takeover_id capability
 * token, calls Endpoint 4 for manager/admin paths (skipped for cashier
 * per AD-2), creates a new local session, emits the
 * `operator.session.takeover` audit event, and discards the proto-session.
 *
 * T071: `cancelTakeover` — pure local discard. No backend call, no audit
 * event, no session change. Returns `{ kind: 'cancelled' }` idempotently.
 *
 * Security invariants:
 *   - No JWT, PIN, or credential material crosses the bridge (PR-1).
 *   - No factor-distinguishing refusal categories (NFR-003 / PR-2).
 *   - Proto-session is discarded after use (no replay).
 *   - On `no_connection`: proto-session is retained to allow retry.
 */
export class TakeoverHandler {
  constructor(private readonly deps: TakeoverHandlerDeps) {}

  async confirmTakeover(
    req: ConfirmTakeoverRequest,
  ): Promise<ConfirmTakeoverResponse | OperatorRefusal> {
    if (typeof req.pending_takeover_id !== 'string' || req.pending_takeover_id.length === 0) {
      return REFUSE_INVALID;
    }

    const proto = this.deps.protoStore.get(req.pending_takeover_id);
    if (proto === undefined) {
      this.log('refused', 'proto_not_found_or_expired');
      return REFUSE_INVALID;
    }

    if (proto.role === 'cashier') {
      return this.confirmCashierTakeover(proto);
    }
    return this.confirmManagerAdminTakeover(proto);
  }

  cancelTakeover(req: CancelTakeoverRequest): Promise<CancelTakeoverResponse> {
    if (typeof req.pending_takeover_id === 'string' && req.pending_takeover_id.length > 0) {
      this.deps.protoStore.delete(req.pending_takeover_id);
    }
    this.log('cancelled', 'user_cancelled');
    return Promise.resolve({ kind: 'cancelled' });
  }

  // --- private helpers ---

  private async confirmManagerAdminTakeover(
    proto: ProtoSession,
  ): Promise<ConfirmTakeoverResponse | OperatorRefusal> {
    const event_id = randomUUID();
    const attestation = await Promise.resolve(this.deps.deviceTokenAttestation());

    const backendResult = await this.deps.backend.confirmTakeover(
      { event_id, operator_id: proto.operator_id, device_token_attestation: attestation },
      proto.jwt ?? '',
    );

    if (backendResult.kind === 'no_connection') {
      // Retain proto-session so the renderer can retry without re-authenticating.
      this.log('refused', 'backend_no_connection');
      return REFUSE_NO_CONN;
    }

    if (backendResult.kind === 'refused') {
      this.deps.protoStore.delete(proto.pending_takeover_id);
      this.log('refused', 'backend_refused');
      return REFUSE_INVALID;
    }

    // backend returned signed_in — create local session
    const record = this.deps.sessionManager.create({
      operator_id: backendResult.operator.id,
      display_name: backendResult.operator.display_name,
      role: backendResult.operator.role,
      tenant_id: backendResult.operator.tenant_id,
      branch_id: backendResult.operator.branch_id,
      backend_session_id: backendResult.operator_session.id,
      started_at: backendResult.operator_session.issued_at,
    });

    this.deps.jwtHolder.set(record.backend_session_id, proto.jwt ?? '');

    await this.emitTakeoverAudit(event_id, record);

    this.deps.protoStore.delete(proto.pending_takeover_id);
    this.log('signed_in', 'manager_admin_confirm');

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

  private async confirmCashierTakeover(
    proto: ProtoSession,
  ): Promise<ConfirmTakeoverResponse | OperatorRefusal> {
    // AD-2: cashier sessions are local-only; Endpoint 4 is skipped.
    const event_id = randomUUID();

    const record = this.deps.sessionManager.create({
      operator_id: proto.operator_id,
      display_name: proto.display_name,
      role: 'cashier',
      tenant_id: proto.tenant_id,
      branch_id: proto.branch_id,
      backend_session_id: '',
    });

    await this.emitTakeoverAudit(event_id, record);

    this.deps.protoStore.delete(proto.pending_takeover_id);
    this.log('signed_in', 'cashier_confirm');

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

  private async emitTakeoverAudit(
    event_id: string,
    record: ReturnType<SessionManager['create']>,
  ): Promise<void> {
    const pairingStatus = await this.deps.pairingStore.getStatus();
    const originating_terminal_id =
      pairingStatus.kind === 'paired' ? pairingStatus.terminal_id : '';

    try {
      this.deps.auditEmitter.emit({
        event_id,
        tenant_id: record.tenant_id,
        branch_id: record.branch_id,
        originating_terminal_id,
        acting_operator_id: record.operator_id,
        session_id: record.id,
        shift_id: null,
        action_category: 'operator.session.takeover',
        created_at: new Date().toISOString(),
        approving_supervisor_id: null,
        payload: {},
      });
    } catch {
      // Audit failure must not abort the sign-in flow (best-effort).
      // Error detail is intentionally swallowed (PR-1 / NFR-003).
    }
  }

  private log(outcome: string, stage: string): void {
    this.deps.logger?.info(
      { event: 'operator.takeover.outcome', outcome, stage },
      'takeover outcome',
    );
  }
}
