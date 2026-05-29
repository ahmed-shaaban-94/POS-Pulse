/**
 * Banner-state projector (008 follow-up slice — sales.subscribe banner_state).
 *
 * Computes the current terminal's `BannerState` for the renderer's persistent
 * banner. Snapshot-style (mirrors 005/006 `subscribe ≡ read`): the renderer
 * polls this on an interval; no push channel.
 *
 * PER-SALE rule (coordination §S3c projection rule — load-bearing against
 * silent failure, PRODUCT.md Principle 3): a sale is in `printer_failure` iff
 * ITS OWN latest print event is `outcome='failure'`. A newer sale's success
 * must NOT clear an older sale's unresolved failure. The terminal surfaces the
 * most-recently-finalized sale whose own latest print event is a failure.
 *
 * `print_events` / `drawer_events` are sale-scoped (no `terminal_id`), so the
 * query JOINs to `sales` on the session (tenant, branch, terminal) triple.
 * Drawer-failure projection is included so the Slice-4 `<DrawerFailureBanner>`
 * can consume the same snapshot; printer-failure takes precedence when both
 * are present on the freshest sale (printer is the more general fault).
 *
 * Correlated `NOT EXISTS` "latest event per sale" form (no window functions —
 * portable to the sql.js test adapter, mirroring the finalize-listener scan).
 */

import type { DatabaseHandle } from '../db/client.js';
import type { BannerState, RecentSaleSummary } from '../../shared/sales/types.js';

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}

export interface BannerStateScope {
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
}

export interface BannerStateProjector {
  projectBannerState(scope: BannerStateScope): BannerState;
  /** The terminal's most-recently-finalized sale summary, or null (topic='recent'). */
  projectRecentSale(scope: BannerStateScope): RecentSaleSummary | null;
}

interface PrinterFailureRow {
  sale_id: string;
  failure_reason: string;
  has_successful_print: number;
}

interface DrawerFailureRow {
  sale_id: string;
}

interface RecentSaleRow {
  sale_id: string;
  sale_number: string;
  finalized_at: string;
}

export function bindBannerStateProjector(db: DatabaseHandle): BannerStateProjector {
  // Most-recently-finalized sale (for this terminal) whose OWN latest print
  // event is a failure. "Latest for its sale" = no other print_events row for
  // the same sale_id with a strictly greater printed_at.
  const printerFailureStmt = db.prepare(
    `SELECT pe.sale_id AS sale_id,
            pe.failure_reason AS failure_reason,
            EXISTS (
              SELECT 1 FROM print_events pe2
               WHERE pe2.sale_id = pe.sale_id AND pe2.outcome = 'success'
            ) AS has_successful_print
       FROM print_events pe
       JOIN sales s ON s.sale_id = pe.sale_id
      WHERE pe.outcome = 'failure'
        AND s.tenant_id = ? AND s.branch_id = ? AND s.terminal_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM print_events later
           WHERE later.sale_id = pe.sale_id
             AND later.printed_at > pe.printed_at
        )
      ORDER BY s.finalized_at DESC, pe.printed_at DESC
      LIMIT 1`,
  ) as PrepareGet<PrinterFailureRow>;

  // Same shape for drawer: a sale whose drawer event outcome is 'failed'.
  // drawer_events has UNIQUE(sale_id), so there is at most one row per sale —
  // no "latest event" sub-scan needed.
  const drawerFailureStmt = db.prepare(
    `SELECT de.sale_id AS sale_id
       FROM drawer_events de
       JOIN sales s ON s.sale_id = de.sale_id
      WHERE de.outcome = 'failed'
        AND s.tenant_id = ? AND s.branch_id = ? AND s.terminal_id = ?
      ORDER BY s.finalized_at DESC
      LIMIT 1`,
  ) as PrepareGet<DrawerFailureRow>;

  // Most-recently-finalized sale for the terminal (topic='recent').
  const recentSaleStmt = db.prepare(
    `SELECT sale_id, sale_number, finalized_at
       FROM sales
      WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ?
      ORDER BY finalized_at DESC
      LIMIT 1`,
  ) as PrepareGet<RecentSaleRow>;

  return {
    projectRecentSale(scope: BannerStateScope): RecentSaleSummary | null {
      const row = recentSaleStmt.get(scope.tenant_id, scope.branch_id, scope.terminal_id);
      if (row === undefined) return null;
      return {
        sale_id: row.sale_id,
        sale_number: row.sale_number,
        finalized_at: row.finalized_at,
      };
    },

    projectBannerState(scope: BannerStateScope): BannerState {
      const printerRow = printerFailureStmt.get(
        scope.tenant_id,
        scope.branch_id,
        scope.terminal_id,
      );
      if (printerRow !== undefined) {
        return {
          kind: 'printer_failure',
          sale_id: printerRow.sale_id,
          failure_reason: printerRow.failure_reason,
          has_successful_print: printerRow.has_successful_print === 1,
        };
      }

      const drawerRow = drawerFailureStmt.get(scope.tenant_id, scope.branch_id, scope.terminal_id);
      if (drawerRow !== undefined) {
        return { kind: 'drawer_failure', sale_id: drawerRow.sale_id };
      }

      return { kind: 'none' };
    },
  };
}
