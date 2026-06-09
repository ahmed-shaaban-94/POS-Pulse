/**
 * 011-sale-sync-capture-up T023 — `buildCapturePayload`.
 *
 * Maps a durable `SaleRow` → the `CaptureSalePayload` body POSTed to DP2
 * `captureSale` (`POST /api/pos/v1/sales`). Pure: no I/O, no clock, no float.
 *
 * Invariants (spec FR-2/FR-9/FR-10):
 *   • `externalId` is DETERMINISTIC from the sale — derived from the existing
 *     008 idempotency anchor `envelope_handoff_action_id` — so every retry of the
 *     same sale carries the same key and the backend dedup `(tenant, sourceSystem,
 *     externalId)` collapses retries to one record.
 *   • Money is the Sale's integer minor units VERBATIM. The `sales` columns are
 *     already `INTEGER` at rest (migrations 0020/0028); there is no float anywhere.
 *   • NO tender / payment fields (gate A.5). `tender_lines_summary_json` from the
 *     Sale is deliberately NOT read.
 *   • Lines come from the frozen `lines_json` snapshot (LineSnapshot[]).
 */

import type { SaleRow } from '../sales/repositories/sales.repository.js';

/** A single line in the capture payload. Money is integer minor units. */
export interface CaptureSaleLine {
  lineRef: string;
  productRef: string;
  /** Human-readable line label, frozen from the cart snapshot's `display_name`. */
  lineName: string;
  quantity: number;
  unitPriceMinor: number;
  lineAmountMinor: number;
}

/** The `captureSale` request body (v1 — no tender). Money is integer minor units. */
export interface CaptureSalePayload {
  externalId: string;
  sourceSystem: 'pos-pulse';
  tenantId: string;
  branchId: string;
  terminalId: string;
  operatorId: string;
  occurredAt: string;
  totalMinor: number;
  lines: CaptureSaleLine[];
}

const SOURCE_SYSTEM = 'pos-pulse' as const;

/** The frozen line snapshot shape persisted in `sales.lines_json` (008 T028a). */
interface PersistedLineSnapshot {
  line_id: string;
  item_ref: string;
  display_name: string;
  quantity: number;
  unit_price_minor: number;
  line_subtotal_minor: number;
}

/**
 * Deterministic external id from the sale. The handoff action id is 008's
 * one-Sale-per-handoff idempotency anchor (unique index), so it is a stable,
 * collision-free basis. Namespaced to make the POS origin explicit on the wire.
 */
export function deriveExternalId(sale: SaleRow): string {
  return `pos-pulse:${sale.envelope_handoff_action_id}`;
}

export function buildCapturePayload(sale: SaleRow): CaptureSalePayload {
  const snapshots = JSON.parse(sale.lines_json) as PersistedLineSnapshot[];
  const lines: CaptureSaleLine[] = snapshots.map((s) => ({
    lineRef: s.line_id,
    productRef: s.item_ref,
    lineName: s.display_name,
    quantity: s.quantity,
    unitPriceMinor: s.unit_price_minor,
    lineAmountMinor: s.line_subtotal_minor,
  }));

  return {
    externalId: deriveExternalId(sale),
    sourceSystem: SOURCE_SYSTEM,
    tenantId: sale.tenant_id,
    branchId: sale.branch_id,
    terminalId: sale.terminal_id,
    operatorId: sale.selling_operator_id,
    occurredAt: sale.finalized_at,
    totalMinor: sale.subtotal_minor,
    lines,
  };
}
