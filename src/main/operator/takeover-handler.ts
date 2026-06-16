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
  /**
   * JWT holder (`operator-identity` scheme). After a confirmed takeover this
   * holds the new operator's provider JWT (proto.jwt) so sign-out + stuck-shifts
   * keep authenticating (028 §6 CM-1). 016 (review HIGH): MUST NOT hold the
   * opaque sale-sync envelope — those routes would 401.
   */
  jwtHolder: JwtHolder;
  /**
   * Envelope holder (`operatorAuthorization` scheme) — the SECOND credential
   * seam (016 review HIGH). After a confirmed takeover this holds the opaque
   * `pos_operator` ENVELOPE (#559) from the takeover-confirm success, keyed on
   * the new backend session id. Authorizes ONLY the sale-sync POSTs. Optional
   * so existing tests that don't exercise sale-sync may omit it; production
   * wires it. An absent/null envelope normalizes to '' (M-1 gate sees absent).
   */
  envelopeHolder?: JwtHolder;
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
 * Cashier path — Endpoint 4 is skipped (AD-2, permanent decision):
 *   Cashier sessions are local-only. Cashier operators have no Clerk JWT to
 *   present to Endpoint 4's `Authorization: Bearer` header, so calling
 *   `backend.confirmTakeover` for the cashier path is permanently excluded
 *   under AD-2. The cashier takeover creates the new session locally without
 *   a backend round-trip, mirroring the cashier sign-in path. This is an
 *   architectural invariant, not a deferred gap: a future backend contract
 *   providing a non-Clerk-JWT cashier-safe confirmation path would require
 *   an approved AD amendment before this handler may call any backend
 *   endpoint for the cashier path. Decision recorded in
 *   `specs/004-operator-session/coordination.md` (2026-05-11, issue 85).
 *
 * Terminal-A passive polling (T069c):
 *   Terminal A discovers the takeover at its next `getCurrentSession` poll,
 *   when the backend has terminated the superseded session (Endpoint 4 side
 *   effect). The local `SessionManager` on terminal A's process is
 *   independent and is NOT ended by this handler. A backend-driven
 *   invalidation or push notification is deferred to a follow-up task
 *   (see issue filed from PR #100).
 *
 * Audit emission (FR-025 / FR-026):
 *   `emitTakeoverAudit` is best-effort: audit failure does NOT abort the
 *   sign-in flow. This mirrors the backend contract (Endpoint 4's audit
 *   event is emitted client-side via Endpoint 5 — Endpoint 4 itself does
 *   not guarantee audit delivery). The try/catch is intentional; the catch
 *   body is deliberately empty per PR-1 (no credential detail in logs).
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

    // 016 (review HIGH) — two credential seams, contract-correct. A takeover
    // installs the NEW operator's authority, so re-key BOTH holders on the new
    // backend session id:
    //
    //   • jwtHolder ← proto.jwt (the NEW operator's provider JWT, `operator-identity`
    //     scheme). This is the same JWT presented to the confirm CALL above; it must
    //     remain available for the new session's sign-out + stuck-shifts (028 §6 CM-1).
    //     If this held the envelope, those routes would 401 (silent regression).
    //
    //   • envelopeHolder ← the opaque pos_operator ENVELOPE (#559,
    //     `operatorAuthorization` scheme) from the takeover-confirm success. Authorizes
    //     ONLY the sale-sync POSTs. An absent/null envelope normalizes to '' so the
    //     envelope-present gate (M-1) treats it as absent and pauses the drain.
    //
    // Both held in main-process memory only — NEVER bridged, NEVER logged (P7/P8).
    this.deps.jwtHolder.set(record.backend_session_id, proto.jwt ?? '');
    this.deps.envelopeHolder?.set(
      record.backend_session_id,
      backendResult.pos_operator_envelope ?? '',
    );

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
    // AD-2: cashier sessions are local-only; no Clerk JWT exists for the
    // cashier identity, so Endpoint 4 cannot be called. See class-level JSDoc.
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
    } catch (err: unknown) {
      // Audit failure must not abort the sign-in flow (best-effort).
      this.deps.logger?.warn(
        { event: 'operator.takeover.audit_emit_failed', error: err instanceof Error ? err.message : String(err) },
        'takeover audit emit failed',
      );
    }
  }

  private log(outcome: string, stage: string): void {
    this.deps.logger?.info(
      { event: 'operator.takeover.outcome', outcome, stage },
      'takeover outcome',
    );
  }
}
