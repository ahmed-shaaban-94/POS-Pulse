/**
 * 004-operator-session T089 — forced-close handler.
 *
 * Handles manager/admin-initiated forced close of a stuck cashier shift.
 * Enforces: role gate (AD-1), branch isolation (P17), lifecycle guard,
 * idempotency, and audit emission (FR-028 / FR-025).
 *
 * declared_count is NOT written — it remains NULL (absent state, FR-024(a)).
 */

import type { DatabaseHandle } from '../db/client.js';
import type { SessionManager, OperatorSessionRecord } from './session-manager.js';
import type { PairingStore } from '../pairing/store.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import type { OperatorRefusal, AuditEvent } from '../../shared/audit/event-shape.js';
import { OperatorRefusalError } from '../../shared/audit/event-shape.js';
import type { ForceCloseShiftRequest, ForceCloseShiftResponse } from '../../shared/bridge-api.js';
import { requireRole } from './role-enforcement.js';

// ─── Local prepare shapes ─────────────────────────────────────────────────────

type PrepareGet<T> = { get(...p: unknown[]): T | undefined };
type PrepareRun = { run(...p: unknown[]): unknown };

// ─── DB rows ──────────────────────────────────────────────────────────────────

interface ShiftRow {
  branch_id: string;
  opening_operator_id: string;
  lifecycle_state: string;
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

export interface ForcedCloseHandlerDeps {
  db: DatabaseHandle;
  sessionManager: Pick<SessionManager, 'getCurrent'>;
  pairingStore: Pick<PairingStore, 'getStatus'>;
  auditEmitter: AuditEmitter;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export class ForcedCloseHandler {
  constructor(private readonly deps: ForcedCloseHandlerDeps) {}

  async forceCloseShift(
    req: ForceCloseShiftRequest,
  ): Promise<ForceCloseShiftResponse | OperatorRefusal> {
    const { db, sessionManager, pairingStore, auditEmitter } = this.deps;

    const session = sessionManager.getCurrent();

    try {
      requireRole(['manager', 'admin'], session);
    } catch (err) {
      if (err instanceof OperatorRefusalError) {
        return { kind: 'refused', category: err.category };
      }
      return { kind: 'refused', category: 'invalid_input' };
    }

    // requireRole throws on null session — safe to narrow here.
    const actor = session as OperatorSessionRecord;

    const shiftRow = (
      db.prepare(
        `SELECT branch_id, opening_operator_id, lifecycle_state FROM shifts WHERE id = ?`,
      ) as PrepareGet<ShiftRow>
    ).get(req.shift_id);

    if (shiftRow === undefined) {
      return { kind: 'refused', category: 'state_invalid' };
    }

    // P17 — branch isolation: mismatch returns role_mismatch, not state_invalid,
    // to avoid leaking cross-branch shift existence.
    if (shiftRow.branch_id !== actor.branch_id) {
      return { kind: 'refused', category: 'role_mismatch' };
    }

    // Idempotency (AD-3): same event_id on already-closed shift → success no-op.
    // Must check before the lifecycle guard so a retry with the same event_id
    // returns forced_closed rather than state_invalid.
    const existingAudit = (
      db.prepare(
        `SELECT 1 FROM audit_events
         WHERE event_id = ? AND tenant_id = ? AND shift_id = ?
           AND action_category = 'shift.forced_close'`,
      ) as PrepareGet<{ '1': number }>
    ).get(req.event_id, actor.tenant_id, req.shift_id);

    if (existingAudit !== undefined) {
      return { kind: 'forced_closed', audit_event_id: req.event_id };
    }

    if (shiftRow.lifecycle_state !== 'open') {
      return { kind: 'refused', category: 'state_invalid' };
    }

    // Pre-fetch async work before entering the synchronous transaction.
    const pairingStatus = await pairingStore.getStatus();
    const originating_terminal_id =
      pairingStatus.kind === 'paired' ? pairingStatus.terminal_id : '';

    const closedAt = new Date().toISOString();

    const event: AuditEvent = {
      event_id: req.event_id,
      tenant_id: actor.tenant_id,
      branch_id: actor.branch_id,
      originating_terminal_id,
      acting_operator_id: actor.operator_id,
      session_id: actor.id,
      shift_id: req.shift_id,
      action_category: 'shift.forced_close',
      created_at: new Date().toISOString(),
      approving_supervisor_id: null,
      payload: {
        shift_id: req.shift_id,
        shift_owner_id: shiftRow.opening_operator_id,
        forced_close_actor_id: actor.operator_id,
        forced_close_reason: req.reason,
        ...(req.annotation !== undefined ? { annotation: req.annotation } : {}),
      },
    };

    // Atomic: emit audit FIRST, then update shift.
    // If auditEmitter.emit() throws, the UPDATE never runs — shift stays open.
    try {
      db.transaction(() => {
        auditEmitter.emit(event);
        (
          db.prepare(
            `UPDATE shifts
             SET lifecycle_state = 'closed_forced',
                 declared_count  = NULL,
                 closed_at       = ?
             WHERE id = ?`,
          ) as PrepareRun
        ).run(closedAt, req.shift_id);
      })();
    } catch {
      return { kind: 'refused', category: 'invalid_input' };
    }

    return { kind: 'forced_closed', audit_event_id: req.event_id };
  }
}
