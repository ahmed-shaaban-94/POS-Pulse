// Canonical source of truth from T022 onward. specs/001-foundation/contracts/preload-bridge.ts
// is a planning snapshot and is NOT re-synced after this file exists.
import type { LogRecord } from './log-record.js';
import type { AppConfig } from './app-config.js';
import type { PairingStatus, PairingSubmitResult } from './pairing-types.js';
import type { Role } from './operator/role.js';
import type { OperatorRefusal } from './audit/event-shape.js';
import type { ForcedCloseReason } from './audit/payload-schemas.js';

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
  /**
   * Capability token for the pending takeover. Must be supplied to
   * `confirmTakeover` or `cancelTakeover`. Expires after 60 seconds.
   * Opaque to the renderer — do not inspect or log its value (PR-1).
   */
  pending_takeover_id: string;
}

/**
 * T070 — request to confirm a pending takeover.
 * The renderer supplies only the capability token; all session material
 * comes from the main-process proto-session store (FR-013 / PR-1).
 */
export interface ConfirmTakeoverRequest {
  pending_takeover_id: string;
}

export type ConfirmTakeoverResponse = SignInSuccessResponse;

/**
 * T071 — request to cancel a pending takeover.
 */
export interface CancelTakeoverRequest {
  pending_takeover_id: string;
}

export interface CancelTakeoverResponse {
  kind: 'cancelled';
}

/**
 * T072 — manager/admin PIN reset for a cashier on this terminal (§A1-gated).
 *
 * `new_pin` crosses the bridge ONCE on input and is consumed by the
 * main-process handler. It MUST NOT be persisted, logged, snapshotted,
 * or surfaced in any thrown error (PR-1). 4–6 digit constraint is
 * validated main-side; invalid shape returns `invalid_input` refusal.
 */
export interface ResetCashierPinRequest {
  /** Client-generated UUID v4 (P5 idempotency key). */
  event_id: string;
  /** Clerk user id of the cashier whose PIN is being reset. */
  target_cashier_id: string;
  /** Plaintext 4–6 digit PIN — consumed by the main-process verifier, never persisted or logged. */
  new_pin: string;
}

export interface ResetCashierPinResponse {
  kind: 'pin_reset';
  /** Echoes the client-supplied event_id for idempotency confirmation. */
  audit_event_id: string;
}

/**
 * T073 — manager/admin unlock of a locked-out cashier on this terminal (§A1-gated).
 *
 * This call MUST NOT accept any PIN field — it only clears lockout state.
 */
export interface UnlockCashierRequest {
  /** Client-generated UUID v4 (P5 idempotency key). */
  event_id: string;
  /** Clerk user id of the locked-out cashier. */
  target_cashier_id: string;
}

export interface UnlockCashierResponse {
  kind: 'unlocked';
  /** Echoes the client-supplied event_id for idempotency confirmation. */
  audit_event_id: string;
}

/**
 * T089 — manager/admin forced-close of a stuck cashier shift.
 *
 * `event_id` is the caller-generated UUID v4 idempotency key.
 * `declared_count` is intentionally absent — forced-close always leaves it
 * NULL (FR-024(a) blind-close / absent state).
 */
export interface ForceCloseShiftRequest {
  /** Client-generated UUID v4 (P5 idempotency key). */
  event_id: string;
  /** Local shift id to force-close. */
  shift_id: string;
  /** Structured reason; must be one of the FORCED_CLOSE_REASONS enum members. */
  reason: ForcedCloseReason;
  /** Optional free-text annotation for support context (PR-1: no PIN/PII). */
  annotation?: string;
}

export interface ForceCloseShiftResponse {
  kind: 'forced_closed';
  /** Echoes the caller-supplied event_id for idempotency confirmation. */
  audit_event_id: string;
}

/**
 * Manager/admin sign-in request shape.
 */
export interface ManagerAdminSignInRequest {
  kind: 'manager_admin';
  /** Identifier (email or username) the operator typed. */
  identifier: string;
  /** Cleartext password — crosses the bridge ONCE on input (PR-1). */
  password: string;
}

/**
 * S4 / T075 — cashier sign-in request shape.
 *
 * AD-2: PIN verified locally via Argon2id. The plaintext PIN NEVER
 * reaches the backend, any logger, or the renderer response (PR-1).
 * Crosses the bridge ONCE on input; consumed by CashierSignInHandler.
 */
export interface CashierSignInRequest {
  kind: 'cashier';
  /** Clerk user id of the cashier (from the branch roster). */
  cashier_clerk_user_id: string;
  /** Plaintext PIN — consumed by the verifier, never persisted or logged. */
  pin: string;
  /** Display name used to populate the local session record. */
  display_name: string;
}

export type SignInRequest = ManagerAdminSignInRequest | CashierSignInRequest;

export type SignInResponse = SignInSuccessResponse | TakeoverRequiredResponse | OperatorRefusal;

export interface SignOutResponse {
  kind: 'signed_out';
}

/**
 * T070b — bridge view of a single cashier on the branch roster.
 *
 * Strict minimum-disclosure: only `{id, display_name, role}` cross the
 * bridge (FR-006, FR-031). Email, phone, password hash, PIN material,
 * and audit history MUST NOT appear here.
 */
export interface BranchRosterCashier {
  id: string;
  display_name: string;
  role: 'cashier';
}

export interface ListBranchRosterSuccess {
  kind: 'roster';
  cashiers: BranchRosterCashier[];
}

export type ListBranchRosterResponse = ListBranchRosterSuccess | OperatorRefusal;

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

  /**
   * T070b — list cashiers on the terminal's paired branch.
   *
   * Manager and admin roles only (cashier → `role_mismatch`). Returns only
   * `{id, display_name, role: 'cashier'}` per entry — no email, phone,
   * PIN material, or audit history crosses the bridge (FR-006, FR-031).
   * Branch scope comes from the active operator session (trusted main-side).
   */
  listBranchRoster(): Promise<ListBranchRosterResponse>;

  /**
   * T070 — confirm a pending takeover using the capability token returned
   * by `signIn`. Creates the new session and emits the
   * `operator.session.takeover` audit event.
   *
   * On success: `{ kind: 'signed_in', session }`.
   * On `no_connection`: proto-session is retained; caller may retry.
   * On any other failure: `{ kind: 'refused', category: 'invalid_input' }`.
   * Token expires after 60 seconds (NFR-003).
   */
  confirmTakeover(req: ConfirmTakeoverRequest): Promise<ConfirmTakeoverResponse | OperatorRefusal>;

  /**
   * T071 — cancel a pending takeover. Discards the proto-session;
   * returns `{ kind: 'cancelled' }` idempotently even if the token is
   * unknown or already expired. No audit event. No session change.
   */
  cancelTakeover(req: CancelTakeoverRequest): Promise<CancelTakeoverResponse>;

  /**
   * T072 — PR-5 manager/admin PIN reset for a cashier on this terminal.
   *
   * Role gate: `manager` or `admin` only — `cashier` → `role_mismatch`.
   * `new_pin` must be 4–6 digits; invalid shape → `invalid_input`.
   * `target_cashier_id` must have an existing pin record on this terminal;
   * unknown cashier → `invalid_input`.
   *
   * Emits `cashier.pin.reset` audit event (manager attributed, cashier
   * referenced by id only; PIN value never in payload — PR-1).
   * Resets `failed_attempt_count` to 0 and `lockout_until` to null.
   */
  resetCashierPin(req: ResetCashierPinRequest): Promise<ResetCashierPinResponse | OperatorRefusal>;

  /**
   * T073 — PR-3 manager/admin unlock of a locked-out cashier on this terminal.
   *
   * Role gate: `manager` or `admin` only — `cashier` → `role_mismatch`.
   * Resets `failed_attempt_count` to 0 and `lockout_until` to null.
   *
   * If the cashier is not currently locked out, still emits the
   * `cashier.pin.unlock` audit event and returns `state_invalid`
   * (the renderer interprets this as "already unlocked, no-op").
   *
   * This call MUST NOT accept any PIN field — it only clears lockout state.
   */
  unlockCashier(req: UnlockCashierRequest): Promise<UnlockCashierResponse | OperatorRefusal>;

  /**
   * T089 — manager/admin forced-close of a stuck cashier shift.
   *
   * Role gate: `manager` or `admin` only — `cashier` → `role_mismatch`.
   * Branch isolation: manager can only close shifts on their own branch
   * (P17 — mismatch returns `role_mismatch`, not `state_invalid`).
   * declared_count is left NULL (FR-024(a) blind-close / absent state).
   *
   * Idempotent: calling with the same `event_id` on an already-closed
   * shift returns `{ kind: 'forced_closed', audit_event_id }` without
   * re-emitting the audit event.
   */
  forceCloseShift(req: ForceCloseShiftRequest): Promise<ForceCloseShiftResponse | OperatorRefusal>;
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
