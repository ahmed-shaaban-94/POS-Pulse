/**
 * 011 T022 (RED) — `buildCapturePayload`.
 *
 * Maps a durable `SaleRow` → the `CaptureSalePayload` POSTed to DP2 `captureSale`.
 * Pure (no I/O). Invariants (spec FR-2/FR-9/FR-10, contracts/README.md):
 *   • `externalId` is deterministic from the sale (stable across restarts/retries)
 *     — derived from `envelope_handoff_action_id`, the existing 008 idempotency anchor.
 *   • `sourceSystem` is the fixed constant 'pos-pulse'.
 *   • Identity (tenant/branch/terminal/operator) comes from the Sale row.
 *   • Money is integer minor units verbatim from the Sale — NO float, NO conversion.
 *   • NO tender / payment fields anywhere in the payload (v1, gate A.5).
 *   • Lines come from the frozen `lines_json` snapshot.
 */
import { describe, expect, it } from 'vitest';

import { buildCapturePayload } from '../capture-payload.js';
import type { SaleRow } from '../../sales/repositories/sales.repository.js';

function saleRow(over: Partial<SaleRow> = {}): SaleRow {
  return {
    sale_id: 'sale-1',
    sale_number: 'SN-1',
    receipt_number: 'R-1',
    envelope_handoff_action_id: 'handoff-abc',
    payment_attempt_id: 'pa-1',
    envelope_cart_id: 'cart-1',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'term-1',
    terminal_label: 'Till 1',
    selling_operator_id: 'op-1',
    selling_operator_display_name: 'Operator One',
    selling_operator_session_id: 'sess-1',
    subtotal_minor: 1500,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    tender_lines_summary_json: JSON.stringify([{ kind: 'cash', amount_minor: 1500 }]),
    settled_at: '2026-06-07T10:00:00.000Z',
    finalized_at: '2026-06-07T10:00:00.000Z',
    tenant_tax_registration_id: 'TRN-123',
    branch_name: 'Main',
    branch_address: 'Cairo',
    local_calendar_day: '2026-06-07',
    lines_json: JSON.stringify([
      {
        line_id: 'l-1',
        item_ref: 'p-1',
        display_name: 'Panadol',
        quantity: 2,
        unit_price_minor: 750,
        line_subtotal_minor: 1500,
      },
    ]),
    ...over,
  };
}

describe('T022 — buildCapturePayload', () => {
  it('derives a deterministic externalId from the handoff action id', () => {
    const a = buildCapturePayload(saleRow());
    const b = buildCapturePayload(saleRow());
    expect(a.externalId).toBe(b.externalId);
    expect(a.externalId).toContain('handoff-abc');
  });

  it('sets the fixed sourceSystem constant', () => {
    expect(buildCapturePayload(saleRow()).sourceSystem).toBe('pos-pulse');
  });

  it('carries identity from the Sale row', () => {
    const p = buildCapturePayload(saleRow());
    expect(p.tenantId).toBe('tenant-1');
    expect(p.branchId).toBe('branch-1');
    expect(p.terminalId).toBe('term-1');
    expect(p.operatorId).toBe('op-1');
    expect(p.occurredAt).toBe('2026-06-07T10:00:00.000Z');
  });

  it('carries integer-minor totals verbatim (no float)', () => {
    const p = buildCapturePayload(saleRow({ subtotal_minor: 1999 }));
    expect(p.totalMinor).toBe(1999);
    expect(Number.isInteger(p.totalMinor)).toBe(true);
  });

  it('maps lines from the frozen lines_json snapshot with integer-minor money', () => {
    const p = buildCapturePayload(saleRow());
    expect(p.lines).toHaveLength(1);
    const [line] = p.lines;
    if (line === undefined) throw new Error('expected one line');
    expect(line.lineRef).toBe('l-1');
    expect(line.productRef).toBe('p-1');
    expect(line.lineName).toBe('Panadol');
    expect(line.quantity).toBe(2);
    expect(line.unitPriceMinor).toBe(750);
    expect(line.lineAmountMinor).toBe(1500);
  });

  it('emits NO tender / payment fields anywhere in the payload', () => {
    const p = buildCapturePayload(saleRow());
    const serialized = JSON.stringify(p).toLowerCase();
    expect(serialized).not.toContain('tender');
    expect(serialized).not.toContain('payment');
    expect(serialized).not.toContain('cash');
    expect(serialized).not.toContain('change');
    // and the typed object exposes no tender key
    expect('tender' in p).toBe(false);
    expect('tenderLines' in p).toBe(false);
  });

  it('handles an empty lines_json snapshot as zero lines', () => {
    const p = buildCapturePayload(saleRow({ lines_json: '[]' }));
    expect(p.lines).toEqual([]);
  });
});
