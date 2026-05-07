/**
 * T048 — Production AuditEventsStore DB adapter.
 *
 * Adapts the `AuditEventsStore` interface (from audit-emitter.ts) to
 * better-sqlite3. Lazy statement preparation mirrors `bindPairingStoreDb`:
 * the `audit_events` table does not exist until migration T045 runs, so
 * eager preparation would crash on a fresh DB.
 *
 * `insertIgnore` uses `INSERT OR IGNORE` so a duplicate `(event_id, tenant_id)`
 * pair silently no-ops — idempotency enforced at the SQL layer (AD-3).
 */

import type { DatabaseHandle } from '../db/client.js';
import type { AuditEventsStore } from './audit-emitter.js';
import type { AuditEvent } from '../../shared/audit/event-shape.js';

type RunStmt = { run(...params: unknown[]): unknown };

export function bindAuditEventsStoreDb(handle: DatabaseHandle): AuditEventsStore {
  let insertStmt: RunStmt | null = null;

  return {
    insertIgnore(event: AuditEvent): void {
      insertStmt ??= handle.prepare(
        `INSERT OR IGNORE INTO audit_events
           (event_id, tenant_id, branch_id, originating_terminal_id,
            acting_operator_id, session_id, shift_id, action_category,
            created_at, approving_supervisor_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ) as RunStmt;
      insertStmt.run(
        event.event_id,
        event.tenant_id,
        event.branch_id,
        event.originating_terminal_id,
        event.acting_operator_id,
        event.session_id,
        event.shift_id,
        event.action_category,
        event.created_at,
        event.approving_supervisor_id,
        JSON.stringify(event.payload),
      );
    },
  };
}
