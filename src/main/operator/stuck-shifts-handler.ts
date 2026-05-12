/**
 * 004-operator-session T090 — stuck-shifts handler.
 *
 * Lists stuck cashier shifts for manager/admin operators. Enforces the
 * role gate (AD-1), delegates to BackendClient.getStuckShifts, and
 * applies an allowlist redaction so only display-safe fields reach the
 * renderer (FR-013 / FR-032).
 */

import type { SessionManager } from './session-manager.js';
import type { BackendClient, BackendStuckShiftRow } from './backend-client.js';
import type { JwtHolder } from './jwt-holder.js';
import type { ListStuckShiftsResponse, StuckShiftSummary } from '../../shared/bridge-api.js';

export interface StuckShiftsHandlerDeps {
  sessionManager: Pick<SessionManager, 'getCurrent'>;
  backendClient: Pick<BackendClient, 'getStuckShifts'>;
  jwtHolder: JwtHolder;
}

function toSummary(row: BackendStuckShiftRow): StuckShiftSummary {
  return {
    shift_id: row.shift_id,
    cashier_display_name: row.cashier_display_name,
    terminal_label: row.terminal_label,
    opened_at: row.opened_at,
    duration_minutes: row.duration_minutes,
  };
}

export class StuckShiftsHandler {
  constructor(private readonly deps: StuckShiftsHandlerDeps) {}

  async listStuckShifts(): Promise<ListStuckShiftsResponse> {
    const { sessionManager, backendClient, jwtHolder } = this.deps;

    const session = sessionManager.getCurrent();
    if (session === null) {
      return { kind: 'refused', category: 'not_signed_in' };
    }
    if (session.role === 'cashier') {
      return { kind: 'refused', category: 'role_mismatch' };
    }

    const jwt = jwtHolder.get(session.backend_session_id) ?? '';
    const result = await backendClient.getStuckShifts(session.branch_id, jwt);

    if (result.kind === 'no_connection') {
      return { kind: 'refused', category: 'no_connection' };
    }
    if (result.kind === 'refused') {
      return { kind: 'refused', category: 'invalid_input' };
    }

    return { kind: 'stuck_shifts', shifts: result.shifts.map(toSummary) };
  }
}
