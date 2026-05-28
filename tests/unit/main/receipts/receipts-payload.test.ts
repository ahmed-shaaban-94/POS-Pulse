/**
 * T164 — receipts-payload derivation (RED).
 *
 * `deriveReceiptPayload(saleRow, opts)` turns a persisted `sales` row into the
 * canonical `ReceiptPayload` the template engine (T160) renders from. It reads
 * ONLY the durable Sale row — never re-reads cart_lines, never calls the
 * catalogue API, never re-validates a voucher (FR-015). The item body comes
 * from parsing the row's `lines_json` snapshot (T028a).
 *
 * v1 decisions (Ahmed 2026-05-28, slice2-mapping-pass.md): single display_name
 * per line (no bilingual split), no shift line.
 */

import { describe, expect, it } from 'vitest';
import { deriveReceiptPayload } from '../../../../src/main/receipts/receipts-payload.js';
import type { SaleRow } from '../../../../src/main/sales/repositories/sales.repository.js';

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    sale_id: 'sale-1',
    sale_number: 'TERM-01-2026-05-27-000001',
    receipt_number: 'TERM-01-2026-05-27-000001',
    envelope_handoff_action_id: 'handoff-1',
    payment_attempt_id: 'pa-1',
    envelope_cart_id: 'cart-1',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'terminal-1',
    terminal_label: 'TERM-01',
    selling_operator_id: 'op-abc',
    selling_operator_display_name: 'Mohamed Ahmed',
    selling_operator_session_id: 'sess-1',
    subtotal_minor: 5500,
    total_tax_minor: 0,
    total_change_due_minor: 75,
    tender_lines_summary_json: JSON.stringify([
      { tender_type: 'cash', amount_applied_minor: 5575, change_due_minor: 75 },
    ]),
    settled_at: '2026-05-27T10:00:05.000Z',
    finalized_at: '2026-05-27T10:00:06.000Z',
    tenant_tax_registration_id: 'TRN-100',
    branch_name: 'Maadi Branch',
    branch_address: '12 Road 9, Maadi',
    local_calendar_day: '2026-05-27',
    lines_json: JSON.stringify([
      {
        line_id: 'line-1',
        item_ref: 'SKU-001',
        display_name: 'Paracetamol 500mg',
        quantity: 2,
        unit_price_minor: 1500,
        line_subtotal_minor: 3000,
        note: null,
        version: 1,
        last_action_id: 'a1',
      },
      {
        line_id: 'line-2',
        item_ref: 'SKU-002',
        display_name: 'Vitamin C',
        quantity: 1,
        unit_price_minor: 2500,
        line_subtotal_minor: 2500,
        note: 'fridge',
        version: 1,
        last_action_id: 'a2',
      },
    ]),
    ...overrides,
  };
}

describe('T164 — deriveReceiptPayload', () => {
  it('maps identity + header + operator + totals from the Sale row', () => {
    const p = deriveReceiptPayload(saleRow(), { variant: 'first_print' });
    expect(p.sale_id).toBe('sale-1');
    expect(p.sale_number).toBe('TERM-01-2026-05-27-000001');
    expect(p.receipt_number).toBe('TERM-01-2026-05-27-000001');
    expect(p.tenant_tax_registration_id).toBe('TRN-100');
    expect(p.branch_name).toBe('Maadi Branch');
    expect(p.branch_address).toBe('12 Road 9, Maadi');
    expect(p.terminal_label).toBe('TERM-01');
    expect(p.selling_operator_display_name).toBe('Mohamed Ahmed');
    expect(p.subtotal_minor).toBe(5500);
    expect(p.total_tax_minor).toBe(0);
    expect(p.total_change_due_minor).toBe(75);
    expect(p.settled_at).toBe('2026-05-27T10:00:05.000Z');
    expect(p.finalized_at).toBe('2026-05-27T10:00:06.000Z');
    expect(p.local_calendar_day).toBe('2026-05-27');
  });

  it('parses lines_json into the canonical item body (v1 single display_name)', () => {
    const p = deriveReceiptPayload(saleRow(), { variant: 'first_print' });
    expect(p.lines).toHaveLength(2);
    expect(p.lines[0]).toEqual({
      item_ref: 'SKU-001',
      display_name: 'Paracetamol 500mg',
      quantity: 2,
      unit_price_minor: 1500,
      line_subtotal_minor: 3000,
      note: null,
    });
    expect(p.lines[1]?.note).toBe('fridge');
    // Snapshot-only fields (line_id, version, last_action_id) are NOT
    // projected onto the receipt — the slip never shows them.
    expect(p.lines[0]).not.toHaveProperty('line_id');
    expect(p.lines[0]).not.toHaveProperty('version');
  });

  it('parses the tender summary from tender_lines_summary_json', () => {
    const p = deriveReceiptPayload(saleRow(), { variant: 'first_print' });
    expect(p.tender_lines_summary).toHaveLength(1);
    expect(p.tender_lines_summary[0]?.tender_type).toBe('cash');
    expect(p.tender_lines_summary[0]?.amount_applied_minor).toBe(5575);
    expect(p.tender_lines_summary[0]?.change_due_minor).toBe(75);
  });

  it('sets variant=first_print with no duplicate-copy fields', () => {
    const p = deriveReceiptPayload(saleRow(), { variant: 'first_print' });
    expect(p.variant).toBe('first_print');
    expect(p.duplicate_copy_sequence_number).toBeUndefined();
    expect(p.reprinted_at).toBeUndefined();
  });

  it('carries duplicate-copy fields on the reprint_duplicate variant', () => {
    const p = deriveReceiptPayload(saleRow(), {
      variant: 'reprint_duplicate',
      duplicate_copy_sequence_number: 2,
      reprinted_at: '2026-05-28T09:00:00.000Z',
    });
    expect(p.variant).toBe('reprint_duplicate');
    expect(p.duplicate_copy_sequence_number).toBe(2);
    expect(p.reprinted_at).toBe('2026-05-28T09:00:00.000Z');
  });

  it('omits duplicate-copy fields on reprint_duplicate when opts do not supply them', () => {
    // Defensive: a reprint variant called without the sequence/timestamp
    // leaves both fields undefined rather than writing `undefined` keys.
    const p = deriveReceiptPayload(saleRow(), { variant: 'reprint_duplicate' });
    expect(p.variant).toBe('reprint_duplicate');
    expect(p.duplicate_copy_sequence_number).toBeUndefined();
    expect(p.reprinted_at).toBeUndefined();
  });

  it('handles an empty lines_json (pre-T028a / line-less sale)', () => {
    const p = deriveReceiptPayload(saleRow({ lines_json: '[]' }), { variant: 'preview' });
    expect(p.lines).toEqual([]);
  });

  it('derivation is pure — same row yields a deeply-equal payload each call', () => {
    const row = saleRow();
    const a = deriveReceiptPayload(row, { variant: 'first_print' });
    const b = deriveReceiptPayload(row, { variant: 'first_print' });
    expect(a).toEqual(b);
  });
});
