// Canonical source of truth from T022 onward. specs/001-foundation/contracts/preload-bridge.ts
// is a planning snapshot and is NOT re-synced after this file exists.
import type { LogRecord } from './log-record.js';
import type { AppConfig } from './app-config.js';
import type { PairingStatus, PairingSubmitResult } from './pairing-types.js';
import type { Role } from './operator/role.js';
import type { OperatorRefusal } from './audit/event-shape.js';

/**
 * T048 — `operator.emitAuditEvent` bridge surface.
 *
 * The renderer supplies only the fields it owns. Trusted enrichment
 * (acting_operator_id, tenant_id, branch_id, originating_terminal_id,
 * session_id, created_at) is applied by the main-process handler
 * from SessionManager and PairingStore — these MUST NOT cross the
 * renderer→main direction (FR-013 / Constitution VII).
 *
 * `action_category` is typed as `string` here (not `ActionCategory`)
 * so the preload layer remains forward-compatible if new categories
 * are added to the server contract before a client rebuild. The
 * main-process handler validates it at the AuditEmitter boundary.
 */
export interface EmitAuditEventRequest {
  /** Client-generated UUID v4 (P5 idempotency key). */
  event_id: string;
  /** Closed-set action category (validated main-side). */
  action_category: string;
  /** Shift id; omit for non-shift-scoped categories. */
  shift_id?: string;
  /** Optional second identity for supervisor-approved actions. */
  approving_supervisor_id?: string;
  /** Per-category structured payload. Forbidden keys refused main-side. */
  payload: Record<string, unknown>;
}

export interface EmitAuditEventResponse {
  kind: 'emitted';
  /** Echoes the client-supplied event_id for idempotency confirmation. */
  event_id: string;
}

/**
 * 002-terminal-pairing: the `pairing` namespace exposed by the preload
 * bridge. Interface-only at the foundational layer — the preload stub
 * throws "not implemented" until US1 (getStatus) and US2 (submit) wire
 * the real handlers. Types are canonical; specs/002-terminal-pairing/
 * contracts/preload-bridge.ts is a planning snapshot and is NOT re-synced.
 */
export interface PairingBridgeAPI {
  /**
   * Inspect local pairing state. Cheap; backed by a single SecretStore
   * read + single SQL row read. Renderer calls this on application boot
   * to decide between routing to /pairing or /paired (US1).
   */
  getStatus(): Promise<PairingStatus>;

  /**
   * Submit a pairing code (manual entry or wedge scan — bridge does not
   * care which). Resolves with a discriminated PairingSubmitResult for
   * every outcome, including failures. Rejects ONLY on programmer error
   * (invalid argument shape) — backend / network failures resolve with
   * the appropriate outcome category (US2 + US3-7).
   */
  submit(pairing_code: string): Promise<PairingSubmitResult>;
}

/**
 * 004-operator-session T014 — `operator.*` namespace skeleton.
 *
 * Per `specs/004-operator-session/contracts/bridge-api.md`. S1 wires
 * only the manager/admin Clerk path; cashier-PIN, takeover-confirm,
 * roster, audit-event-emit, and PIN management are §A1-gated and land
 * in S3/S4. Their typed signatures are intentionally absent here —
 * a future task adds them rather than adding stubs that throw
 * "not implemented" (a stub is a contract claim that the call exists,
 * which is misleading when the gate is closed).
 */

export interface OperatorSessionBridgeView {
  /** Operator session id (UUID v4). */
  id: string;
  /** Clerk user id of the operator. */
  operator_id: string;
  /** Display name as held by Clerk. */
  display_name: string;
  /** Closed-set role from Clerk metadata. */
  role: Role;
  /** Opaque tenant identifier from the device-token scope. */
  tenant_id: string;
  /** Opaque branch identifier from the device-token scope. */
  branch_id: string;
  /** ISO 8601 UTC timestamp the session was issued. */
  started_at: string;
}

export interface SignInSuccessResponse {
  kind: 'signed_in';
  session: OperatorSessionBridgeView;
}

export interface TakeoverRequiredResponse {
  kind: 'takeover_required';
  // No identification of the prior terminal/operator/timestamp (FR-013).
}

/**
 * Manager/admin sign-in request shape. The cashier branch
 * `{ kind: 'cashier'; ... }` is §A1-gated and added in S4.
 */
export interface ManagerAdminSignInRequest {
  kind: 'manager_admin';
  /** Identifier (email or username) the operator typed. */
  identifier: string;
  /** Cleartext password — crosses the bridge ONCE on input (PR-1). */
  password: string;
}

export type SignInRequest = ManagerAdminSignInRequest;

export type SignInResponse = SignInSuccessResponse | TakeoverRequiredResponse | OperatorRefusal;

export interface SignOutResponse {
  kind: 'signed_out';
}

/**
 * `operator.*` namespace. Manager/admin paths only at S1; cashier,
 * takeover-confirm, roster, audit-event-emit, and PIN management land
 * in later slices behind their gates.
 */
export interface OperatorBridgeAPI {
  /**
   * Authenticate an operator and create an operator session. S1 wires
   * the manager/admin variant only. Resolves with one of:
   *   - { kind: 'signed_in', session }
   *   - { kind: 'takeover_required' }                    // S4 wires the prompt UX
   *   - { kind: 'refused', category: RefusalCategory }   // single generic family
   *
   * The bridge handler MUST refuse generically (NFR-003 / PR-2): every
   * factor-distinguishable cause maps to `invalid_input` except the
   * cashier-PIN-only `rate_limited` case (S4) and the network-only
   * `no_connection` case.
   *
   * Redaction: the `password` field is consumed by the verifier and
   * MUST NOT be persisted, logged, snapshotted, or surfaced in any
   * thrown error (PR-1).
   */
  signIn(req: SignInRequest): Promise<SignInResponse>;

  /**
   * End the current operator session. Best-effort backend call; the
   * local session is torn down within 1 s regardless of backend
   * reachability (FR-008 / NFR-007).
   */
  signOut(): Promise<SignOutResponse>;

  /**
   * Read-only inquiry for the current session. Returns the session if
   * one is active, otherwise `null`.
   */
  getCurrentSession(): Promise<OperatorSessionBridgeView | null>;

  /**
   * Notify-only: the renderer reports genuine user input (mousemove,
   * keypress, touch) to the inactivity monitor (T028b / FR-009). Fire-
   * and-forget — the caller MUST NOT await or use the return value. No
   * new IPC channel: reuses `operator:_report-activity` registered in S1.
   * Wired by F-01 (s1-review finding — was registered main-side but
   * missing from the bridge surface).
   */
  _reportActivity(): void;

  /**
   * T048 — Emit one audit event to the local outbox.
   *
   * The renderer supplies only the fields it owns (`EmitAuditEventRequest`);
   * the main-process handler enriches the trusted fields from session
   * state and pairing state before delegating to `AuditEmitter.emit()`.
   *
   * Resolves with `{ kind: 'emitted', event_id }` on success.
   * Resolves with `{ kind: 'refused', category }` on any failure
   * (no session → `not_signed_in`; bad payload / forbidden key →
   * `invalid_input`). Never rejects.
   *
   * Idempotent: submitting the same `event_id` twice is a no-op (P5 /
   * INSERT OR IGNORE at the SQL layer).
   */
  emitAuditEvent(req: EmitAuditEventRequest): Promise<EmitAuditEventResponse | OperatorRefusal>;

  /**
   * T051 — Debug bridge smoke. Main generates the event_id; renderer
   * supplies nothing. Gated by `process.env.NODE_ENV !== 'production'`
   * in the main-process handler — returns `invalid_input` refusal in
   * production builds. Manager / admin roles only; cashier → `role_mismatch`.
   * Hardcoded `action_category: 'shift.open'`, `payload: { smoke: true }`.
   */
  _emitAuditEventSmoke(): Promise<EmitAuditEventResponse | OperatorRefusal>;
}

export interface PreloadBridgeAPI {
  ping(): Promise<'pong'>;
  appVersion(): Promise<string>;
  /**
   * Phase 8 / US6: ship a structured log record to the main-process
   * logger. Sandboxed renderers cannot write files directly; this is
   * the only path from renderer code to the on-disk log stream.
   * Resolves on successful enqueue; never rejects with a value the
   * caller is expected to surface — logging must not crash the app.
   */
  log(record: LogRecord): Promise<void>;
  /**
   * Phase 9 / US7: pull renderer-relevant runtime configuration from
   * main. Currently the only field is `sentryDsn` — used to decide
   * whether to initialise renderer-side Sentry. Sandboxed renderers
   * cannot read `process.env`, and `import.meta.env.VITE_*` would
   * inline the DSN into the bundle at build time — neither is
   * acceptable, so config crosses the typed bridge instead (D3).
   */
  appConfig(): Promise<AppConfig>;
  /**
   * 002-terminal-pairing: terminal-pairing namespace. Interface-only at
   * the foundational layer; the preload stub throws "not implemented"
   * until US1 / US2 wire the real handlers.
   */
  pairing: PairingBridgeAPI;
  /**
   * 004-operator-session: operator-session namespace. S1 wires the
   * manager/admin Clerk path; cashier-PIN, takeover-confirm, roster,
   * audit-event-emit, and PIN management are §A1-gated and land
   * later.
   */
  operator: OperatorBridgeAPI;
}

declare global {
  interface Window {
    api: PreloadBridgeAPI;
  }
}
