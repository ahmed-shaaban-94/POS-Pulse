import type { OperatorRefusal } from '../../shared/audit/event-shape.js';
import type { BackendClient } from './backend-client.js';

/**
 * 004-operator-session T069b — internal-only active-session helper.
 *
 * AD-2: PIN data MUST NEVER cross to the backend; this helper accepts
 * only operatorId — no PIN parameter by construction.
 *
 * FR-013: Minimum-disclosure binary response — callers receive only
 * { kind: 'none' } or { kind: 'active' }; no operator metadata,
 * terminal id, or timestamps are propagated.
 *
 * Internal-only: NOT exposed via IPC bridge or preload. Consumed
 * exclusively by the cashier sign-in handler (T069).
 */

export type CheckActiveSessionResult = { kind: 'none' } | { kind: 'active' } | OperatorRefusal;

export interface CheckActiveSessionHandlerDeps {
  backend: BackendClient;
}

const REFUSE_INVALID: OperatorRefusal = { kind: 'refused', category: 'invalid_input' };
const REFUSE_NO_CONN: OperatorRefusal = { kind: 'refused', category: 'no_connection' };

export class CheckActiveSessionHandler {
  constructor(private readonly deps: CheckActiveSessionHandlerDeps) {}

  async checkActiveSession(operatorId: string): Promise<CheckActiveSessionResult> {
    if (operatorId.length === 0) return REFUSE_INVALID;

    const result = await this.deps.backend.getActiveSession(operatorId);

    if (result.kind === 'none') return { kind: 'none' };
    if (result.kind === 'active') return { kind: 'active' };
    if (result.kind === 'no_connection') return REFUSE_NO_CONN;
    return REFUSE_INVALID;
  }
}
