/**
 * 004-operator-session T072 + T073 — PIN management handler.
 *
 * T072: `resetCashierPin` — manager/admin-attributable PIN reset for a
 *   cashier on this terminal. Writes a fresh Argon2id hash+salt, resets
 *   lockout state, emits `cashier.pin.reset` audit event.
 *
 * T073: `unlockCashier` — manager/admin-attributable unlock of a
 *   locked-out cashier. Resets lockout state, emits `cashier.pin.unlock`
 *   audit event. Does NOT accept a PIN field.
 *
 * Security invariants (PR-1 / FR-030):
 *   - `new_pin` is consumed here and never passed to the logger,
 *     never stored as plaintext, never appears in thrown errors.
 *   - No JWT, device_token, device_token_attestation, or Clerk credential
 *     is logged or returned to the renderer.
 *   - Audit payloads contain only allowlisted identifiers — no PIN values,
 *     no hashes, no credential fragments.
 *
 * Role gate (AD-1): `requireRole` is the first executable call in each
 * public method. A cashier session calling either method returns
 * `role_mismatch` generically.
 *
 * PR-4 per-terminal scope: `cashier_pin_records` rows are keyed by
 * `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)`. The scope
 * comes from the paired terminal's device-token state, never from the
 * renderer (Constitution VII).
 */

import type { Logger } from 'pino';

import type {
  ResetCashierPinRequest,
  ResetCashierPinResponse,
  UnlockCashierRequest,
  UnlockCashierResponse,
} from '../../shared/bridge-api.js';
import type { OperatorRefusal } from '../../shared/audit/event-shape.js';
import { OperatorRefusalError } from '../../shared/audit/event-shape.js';
import type { DatabaseHandle } from '../db/client.js';
import type { SafeStorageLike } from '../secrets/safe-storage.js';
import type { PairingStore } from '../pairing/store.js';
import type { SessionManager, OperatorSessionRecord } from './session-manager.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import { requireRole } from './role-enforcement.js';
import { hashPin } from './pin-credential.js';
import { sealPinMaterial } from './pin-seal.js';
import type {
  CashierPinResetPayload,
  CashierPinUnlockPayload,
} from '../../shared/audit/payload-schemas.js';

// ─── PIN validation ────────────────────────────────────────────────────────

const PIN_RE = /^\d{4,6}$/;

function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

// ─── DB row shape ─────────────────────────────────────────────────────────

interface PinRecordRow {
  failed_attempt_count: number;
  lockout_until: string | null;
}

type PrepareRun = { run(...p: unknown[]): unknown };
type PrepareGet = { get(...p: unknown[]): PinRecordRow | undefined };

// ─── Refusal sentinels ────────────────────────────────────────────────────

const REFUSE_INVALID: OperatorRefusal = { kind: 'refused', category: 'invalid_input' };
const REFUSE_STATE_INVALID: OperatorRefusal = { kind: 'refused', category: 'state_invalid' };

// ─── Dependencies ─────────────────────────────────────────────────────────

export interface PinManagementHandlerDeps {
  db: DatabaseHandle;
  safeStorage: SafeStorageLike;
  sessionManager: SessionManager;
  pairingStore: PairingStore;
  auditEmitter: AuditEmitter;
  /** Optional logger. Tests omit it. */
  logger?: Logger;
}

// ─── Handler ──────────────────────────────────────────────────────────────

export class PinManagementHandler {
  constructor(private readonly deps: PinManagementHandlerDeps) {}

  /**
   * T072 — manager/admin PIN reset for a cashier on this terminal.
   *
   * Validates role, PIN shape, and cashier existence; hashes and seals
   * the new PIN; upserts the cashier_pin_records row (creates or
   * overwrites); resets lockout state; emits cashier.pin.reset audit event.
   */
  async resetCashierPin(
    req: ResetCashierPinRequest,
  ): Promise<ResetCashierPinResponse | OperatorRefusal> {
    const session = this.deps.sessionManager.getCurrent();

    try {
      requireRole(['manager', 'admin'], session);
    } catch (err) {
      if (err instanceof OperatorRefusalError) {
        this.log('info', 'reset_cashier_pin.refused', err.category);
        return { kind: 'refused', category: err.category };
      }
      this.log('info', 'reset_cashier_pin.refused', 'invalid_input');
      return REFUSE_INVALID;
    }
    // requireRole throws on null session — safe to narrow here.
    const activeSession = session as OperatorSessionRecord;

    // Input validation — generic refusal; never echo the rejected value
    if (
      typeof req.event_id !== 'string' ||
      req.event_id.length === 0 ||
      typeof req.target_cashier_id !== 'string' ||
      req.target_cashier_id.length === 0 ||
      typeof req.new_pin !== 'string' ||
      !isValidPin(req.new_pin)
    ) {
      this.log('info', 'reset_cashier_pin.refused', 'invalid_input');
      return REFUSE_INVALID;
    }

    const pairingStatus = await this.deps.pairingStore.getStatus();
    if (pairingStatus.kind !== 'paired') {
      this.log('info', 'reset_cashier_pin.refused', 'invalid_input');
      return REFUSE_INVALID;
    }

    const { tenant_id, branch_id, terminal_id } = pairingStatus;
    const { target_cashier_id } = req;

    // Verify the cashier has an existing pin record on this terminal.
    // If no record exists, the manager cannot reset an uninitialized PIN
    // (the cashier must be onboarded first — invalid_input).
    const existing = (
      this.deps.db.prepare(
        `SELECT failed_attempt_count, lockout_until
           FROM cashier_pin_records
          WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND cashier_clerk_user_id = ?`,
      ) as PrepareGet
    ).get(tenant_id, branch_id, terminal_id, target_cashier_id);

    if (existing === undefined) {
      this.log('info', 'reset_cashier_pin.refused', 'invalid_input');
      return REFUSE_INVALID;
    }

    // Hash the new PIN — plaintext is consumed here and never stored.
    const raw = await hashPin(req.new_pin);
    const sealed = sealPinMaterial(raw, this.deps.safeStorage);

    // Upsert: overwrite hash/salt, reset lockout state.
    (
      this.deps.db.prepare(
        `UPDATE cashier_pin_records
            SET pin_hash = ?, pin_salt = ?,
                failed_attempt_count = 0, lockout_until = NULL,
                created_by_operator_id = ?
          WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND cashier_clerk_user_id = ?`,
      ) as PrepareRun
    ).run(
      sealed.pin_hash,
      sealed.pin_salt,
      activeSession.operator_id,
      tenant_id,
      branch_id,
      terminal_id,
      target_cashier_id,
    );

    // Emit audit event — PIN value MUST NOT appear in payload (PR-1).
    const payload: CashierPinResetPayload = {
      target_cashier_id,
      terminal_id,
    };

    this.deps.auditEmitter.emit({
      event_id: req.event_id,
      tenant_id,
      branch_id,
      originating_terminal_id: terminal_id,
      acting_operator_id: activeSession.operator_id,
      session_id: activeSession.id,
      shift_id: null,
      action_category: 'cashier.pin.reset',
      created_at: new Date().toISOString(),
      approving_supervisor_id: null,
      payload,
    });

    this.log('info', 'reset_cashier_pin.success', undefined);
    return { kind: 'pin_reset', audit_event_id: req.event_id };
  }

  /**
   * T073 — manager/admin unlock of a locked-out cashier on this terminal.
   *
   * Clears lockout state; emits cashier.pin.unlock audit event.
   * If the cashier is not locked out, still emits the event and returns
   * `state_invalid` (renderer interprets as "already unlocked, no-op").
   */
  async unlockCashier(req: UnlockCashierRequest): Promise<UnlockCashierResponse | OperatorRefusal> {
    const session = this.deps.sessionManager.getCurrent();

    try {
      requireRole(['manager', 'admin'], session);
    } catch (err) {
      if (err instanceof OperatorRefusalError) {
        this.log('info', 'unlock_cashier.refused', err.category);
        return { kind: 'refused', category: err.category };
      }
      this.log('info', 'unlock_cashier.refused', 'invalid_input');
      return REFUSE_INVALID;
    }
    // requireRole throws on null session — safe to narrow here.
    const activeSession = session as OperatorSessionRecord;

    if (
      typeof req.event_id !== 'string' ||
      req.event_id.length === 0 ||
      typeof req.target_cashier_id !== 'string' ||
      req.target_cashier_id.length === 0
    ) {
      this.log('info', 'unlock_cashier.refused', 'invalid_input');
      return REFUSE_INVALID;
    }

    const pairingStatus = await this.deps.pairingStore.getStatus();
    if (pairingStatus.kind !== 'paired') {
      this.log('info', 'unlock_cashier.refused', 'invalid_input');
      return REFUSE_INVALID;
    }

    const { tenant_id, branch_id, terminal_id } = pairingStatus;
    const { target_cashier_id } = req;

    const existing = (
      this.deps.db.prepare(
        `SELECT failed_attempt_count, lockout_until
           FROM cashier_pin_records
          WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND cashier_clerk_user_id = ?`,
      ) as PrepareGet
    ).get(tenant_id, branch_id, terminal_id, target_cashier_id);

    const notLockedOut =
      existing === undefined ||
      existing.lockout_until === null ||
      new Date(existing.lockout_until) <= new Date();

    if (existing !== undefined) {
      // Clear lockout state unconditionally.
      (
        this.deps.db.prepare(
          `UPDATE cashier_pin_records
              SET failed_attempt_count = ?, lockout_until = ?
            WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND cashier_clerk_user_id = ?`,
        ) as PrepareRun
      ).run(0, null, tenant_id, branch_id, terminal_id, target_cashier_id);
    }

    // Emit audit event regardless of prior lockout state (support trail).
    const payload: CashierPinUnlockPayload = {
      target_cashier_id,
      terminal_id,
    };

    this.deps.auditEmitter.emit({
      event_id: req.event_id,
      tenant_id,
      branch_id,
      originating_terminal_id: terminal_id,
      acting_operator_id: activeSession.operator_id,
      session_id: activeSession.id,
      shift_id: null,
      action_category: 'cashier.pin.unlock',
      created_at: new Date().toISOString(),
      approving_supervisor_id: null,
      payload,
    });

    if (notLockedOut) {
      this.log('info', 'unlock_cashier.state_invalid', undefined);
      return REFUSE_STATE_INVALID;
    }

    this.log('info', 'unlock_cashier.success', undefined);
    return { kind: 'unlocked', audit_event_id: req.event_id };
  }

  private log(level: 'info' | 'warn', event: string, category: string | undefined): void {
    if (category !== undefined) {
      this.deps.logger?.[level]({ event, category }, event.replace('.', ' '));
    } else {
      this.deps.logger?.[level]({ event }, event.replace('.', ' '));
    }
  }
}
