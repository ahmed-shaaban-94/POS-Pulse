import { randomUUID } from 'node:crypto';

import type { Role } from '../../shared/operator/role.js';
import type { OperatorSessionBridgeView } from '../../shared/bridge-api.js';
import type { SessionEndCause } from '../../shared/operator/session-end-cause.js';

/**
 * 004-operator-session T028 — main-process session manager (in-memory).
 *
 * S1 holds the active operator session entirely in memory. Crash =
 * session lost; the operator signs in again. Durable persistence is
 * S3/S4 territory under §A3 (the `operator_sessions` migration).
 *
 * The session is the source of truth for the renderer-side store; the
 * renderer mirrors the FSM but the visible session shape (no JWT, no
 * tokens) comes from this manager.
 */

export interface OperatorSessionRecord {
  id: string;
  operator_id: string;
  display_name: string;
  role: Role;
  tenant_id: string;
  branch_id: string;
  started_at: string;
  /** Server-side session id minted by Data-Pulse-2. */
  backend_session_id: string;
  /** ISO timestamp of last genuine renderer-side activity (T028b). */
  last_activity_at: string;
}

export interface CreateSessionInput {
  operator_id: string;
  display_name: string;
  role: Role;
  tenant_id: string;
  branch_id: string;
  backend_session_id: string;
  started_at?: string;
}

export class SessionManager {
  private current: OperatorSessionRecord | null = null;
  private lastEndCause: SessionEndCause | null = null;

  getCurrent(): OperatorSessionRecord | null {
    return this.current;
  }

  /**
   * Renderer-facing projection. Strips the backend session id and the
   * activity timestamp — the renderer never sees those.
   */
  getCurrentBridgeView(): OperatorSessionBridgeView | null {
    if (this.current === null) return null;
    return {
      id: this.current.id,
      operator_id: this.current.operator_id,
      display_name: this.current.display_name,
      role: this.current.role,
      tenant_id: this.current.tenant_id,
      branch_id: this.current.branch_id,
      started_at: this.current.started_at,
    };
  }

  create(input: CreateSessionInput): OperatorSessionRecord {
    const now = input.started_at ?? new Date().toISOString();
    const record: OperatorSessionRecord = {
      id: randomUUID(),
      operator_id: input.operator_id,
      display_name: input.display_name,
      role: input.role,
      tenant_id: input.tenant_id,
      branch_id: input.branch_id,
      backend_session_id: input.backend_session_id,
      started_at: now,
      last_activity_at: now,
    };
    this.current = record;
    return record;
  }

  /**
   * End the active session. The optional `cause` is stored in-memory for
   * test inspection and will be written to the `operator_sessions` SQL row
   * once §A3 (T065) lands. Matches data-model.md §"Entity 2 — OperatorSession".
   */
  end(cause?: SessionEndCause): OperatorSessionRecord | null {
    const ending = this.current;
    if (ending !== null && cause !== undefined) {
      this.lastEndCause = cause;
    }
    this.current = null;
    return ending;
  }

  /** Returns the end_cause recorded for the most recently ended session. */
  getLastEndCause(): SessionEndCause | null {
    return this.lastEndCause;
  }

  noteActivity(at: string): void {
    if (this.current === null) return;
    this.current.last_activity_at = at;
  }
}
