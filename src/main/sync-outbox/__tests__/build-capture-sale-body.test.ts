import { describe, expect, it } from 'vitest';

import { buildCaptureSaleBody } from '../build-capture-sale-body.js';
import type { SaleRow } from '../../sales/repositories/sales.repository.js';

/**
 * 008 sale-sync flush — SaleRow → DP-2 CaptureSaleRequest mapper.
 *
 * Verifies the minor-unit-int → exact-decimal-STRING conversion (gate A.6 —
 * never a float), the lines_json → lines[] mapping, the stable per-sale
 * externalId (= sale_id, so captureSale's (tenant, sourceSystem, externalId)
 * dedup makes retries safe), and currency/scale injection (no hardcoding).
 */

const LINES = JSON.stringify([
  {
    line_id: 'l1',
    item_ref: 'p-para',
    display_name: 'Paracetamol',
    quantity: 1,
    unit_price_minor: 1250,
    line_subtotal_minor: 1250,
    note: null,
    version: 1,
    last_action_id: 'a1',
  },
  {
    line_id: 'l2',
    item_ref: 'p-amox',
    display_name: 'Amoxicillin',
    quantity: 2,
    unit_price_minor: 4500,
    line_subtotal_minor: 9000,
    note: null,
    version: 1,
    last_action_id: 'a2',
  },
]);

function makeSaleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    sale_id: 'sale-abc',
    sale_number: 'S-001',
    receipt_number: 'R-001',
    envelope_handoff_action_id: 'hoa-1',
    payment_attempt_id: 'pa-1',
    envelope_cart_id: 'cart-1',
    tenant_id: 't-1',
    branch_id: 'b-1',
    terminal_id: 'term-1',
    terminal_label: 'Till 1',
    selling_operator_id: 'op-1',
    selling_operator_display_name: 'Op One',
    selling_operator_session_id: 'sess-1',
    subtotal_minor: 10250,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    tender_lines_summary_json: '[]',
    settled_at: '2026-06-11T10:00:00.000Z',
    finalized_at: '2026-06-11T10:00:01.000Z',
    tenant_tax_registration_id: 'trn-1',
    branch_name: 'Branch 1',
    branch_address: 'Addr',
    local_calendar_day: '2026-06-11',
    lines_json: LINES,
    ...overrides,
  };
}

const EGP = { currencyCode: 'EGP', minorDigits: 2 } as const;

describe('buildCaptureSaleBody', () => {
  it('maps a SaleRow to a CaptureSaleRequest with exact-decimal string money', () => {
    const body = buildCaptureSaleBody(makeSaleRow(), EGP);
    expect(body.currencyCode).toBe('EGP');
    // posTotal = (subtotal + tax) minor → decimal: (10250 + 0) / 100 = 102.5000
    expect(body.posTotal).toBe('102.5000');
    expect(typeof body.posTotal).toBe('string');
    expect(body.occurredAt).toBe('2026-06-11T10:00:01.000Z'); // finalized_at
    expect(body.sourceSystem).toBe('pos-pulse');
  });

  it('derives a STABLE externalId from sale_id (so captureSale retries dedup)', () => {
    const body = buildCaptureSaleBody(makeSaleRow({ sale_id: 'sale-xyz' }), EGP);
    expect(body.externalId).toBe('sale-xyz');
    // Same sale → same externalId every time (idempotent re-flush).
    expect(buildCaptureSaleBody(makeSaleRow({ sale_id: 'sale-xyz' }), EGP).externalId).toBe(
      'sale-xyz',
    );
  });

  it('maps lines_json (LineSnapshot[]) to lines[] with exact-decimal money', () => {
    const body = buildCaptureSaleBody(makeSaleRow(), EGP);
    expect(body.lines).toHaveLength(2);
    expect(body.lines[0]).toEqual({
      lineName: 'Paracetamol',
      unitPrice: '12.5000',
      currencyCode: 'EGP',
      quantity: '1',
      lineAmount: '12.5000',
      unit: 'ea',
    });
    expect(body.lines[1]).toEqual({
      lineName: 'Amoxicillin',
      unitPrice: '45.0000',
      currencyCode: 'EGP',
      quantity: '2',
      lineAmount: '90.0000', // line_subtotal_minor 9000 / 100
      unit: 'ea',
    });
  });

  it('includes tax in posTotal', () => {
    const body = buildCaptureSaleBody(
      makeSaleRow({ subtotal_minor: 10000, total_tax_minor: 250 }),
      EGP,
    );
    expect(body.posTotal).toBe('102.5000'); // (10000 + 250) / 100
  });

  it('respects the injected currency code + minor-digit scale (no hardcoding)', () => {
    // A 3-minor-digit currency (e.g. some dinar) scales by 1000.
    const body = buildCaptureSaleBody(makeSaleRow({ subtotal_minor: 102500, total_tax_minor: 0 }), {
      currencyCode: 'BHD',
      minorDigits: 3,
    });
    expect(body.currencyCode).toBe('BHD');
    expect(body.posTotal).toBe('102.5000'); // 102500 / 1000, formatted to 4dp
    expect(body.lines[0]?.currencyCode).toBe('BHD');
  });

  it('handles an empty lines_json defensively (no lines)', () => {
    expect(() => buildCaptureSaleBody(makeSaleRow({ lines_json: '[]' }), EGP)).not.toThrow();
    const body = buildCaptureSaleBody(makeSaleRow({ lines_json: '[]' }), EGP);
    expect(body.lines).toEqual([]);
  });

  it('throws a typed error on structurally-invalid lines_json (engine-written, defence-in-depth)', () => {
    expect(() => buildCaptureSaleBody(makeSaleRow({ lines_json: 'not-json' }), EGP)).toThrow();
  });

  it('never emits a float for any money field (all strings matching the decimal pattern)', () => {
    const body = buildCaptureSaleBody(makeSaleRow(), EGP);
    const decimal = /^[0-9]+\.[0-9]{4}$/;
    expect(body.posTotal).toMatch(decimal);
    for (const l of body.lines) {
      expect(l.unitPrice).toMatch(decimal);
      expect(l.lineAmount).toMatch(decimal);
    }
  });
});
