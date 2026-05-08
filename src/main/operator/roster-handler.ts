import type { Logger } from 'pino';

import type { ListBranchRosterResponse } from '../../shared/bridge-api.js';
import type { OperatorRefusal } from '../../shared/audit/event-shape.js';

import type { BackendClient } from './backend-client.js';

/**
 * 004-operator-session T070b — main-side handler for operator.listBranchRoster.
 *
 * Calls the backend roster endpoint and applies an explicit allowlist
 * that strips every field except {id, display_name, role} per cashier.
 * Defence in depth: even if the backend accidentally returns extra
 * fields they never cross the bridge (FR-006 / FR-031).
 *
 * FR-032 — opaque references only: cashier display names MUST NOT
 * appear in pino lifecycle logs. Only the count is logged.
 */

export interface RosterHandlerDeps {
  backend: BackendClient;
  logger?: Logger;
}

const REFUSE_INVALID: OperatorRefusal = { kind: 'refused', category: 'invalid_input' };
const REFUSE_NO_CONN: OperatorRefusal = { kind: 'refused', category: 'no_connection' };

export class RosterHandler {
  constructor(private readonly deps: RosterHandlerDeps) {}

  async listRoster(branchId: string): Promise<ListBranchRosterResponse> {
    const result = await this.deps.backend.listRoster(branchId);

    if (result.kind === 'no_connection') {
      return REFUSE_NO_CONN;
    }
    if (result.kind === 'refused') {
      return REFUSE_INVALID;
    }

    // Explicit allowlist filter — {id, display_name, role} only.
    // Destructure to discard any extra fields the backend may return.
    const cashiers = result.cashiers.map(({ id, display_name, role }) => ({
      id,
      display_name,
      role,
    }));

    // FR-032: log count only — never log display_name values.
    this.deps.logger?.info(
      { event: 'operator.roster.fetched', count: cashiers.length },
      'roster fetched',
    );

    return { kind: 'roster', cashiers };
  }
}
