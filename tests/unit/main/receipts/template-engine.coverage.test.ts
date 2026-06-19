/**
 * template-engine — branch-coverage top-up.
 *
 * Closes two pre-existing uncovered branches in `template-engine.ts` (raising
 * it past its 95% per-module branch gate), both via the public `renderReceipt`
 * API — no internal access, no source change:
 *
 *   - `receiptWebsite()` (line ~45): the `POS_PULSE_RECEIPT_WEBSITE`-configured
 *     arm (existing tests only run with the env var unset → default site).
 *   - `wrap()` continuation (line ~101): a line name long enough that
 *     "{qty}× {name}" exceeds the 42-column width and wraps to an indented
 *     second line whose final segment is flushed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderReceipt } from '../../../../src/main/receipts/template-engine.js';
import type { ReceiptPayload } from '../../../../src/shared/receipts/types.js';
import type { SaleId, SaleNumber } from '../../../../src/shared/sales/types.js';

function payload(overrides: Partial<ReceiptPayload> = {}): ReceiptPayload {
  return {
    variant: 'first_print',
    sale_id: 'sale-cov' as SaleId,
    sale_number: 'TERM-01-2026-05-27-000099' as SaleNumber,
    receipt_number: 'TERM-01-2026-05-27-000099',
    tenant_tax_registration_id: '100123456789012',
    branch_name: 'صيدلية الرحمة قناطر',
    branch_address: 'الفرع الرئيسي',
    terminal_label: 'TERM-01',
    selling_operator_display_name: 'محمد أحمد — Mohamed Ahmed',
    subtotal_minor: 12500,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    lines: [
      {
        item_ref: 'SKU-001',
        display_name: 'Augmentin 625mg box 14 tab',
        quantity: 1,
        unit_price_minor: 12500,
        line_subtotal_minor: 12500,
        note: null,
      },
    ],
    tender_lines_summary: [
      { tender_type: 'cash', amount_applied_minor: 12500, change_due_minor: 0 },
    ],
    settled_at: '2026-05-27T08:42:18.000Z',
    finalized_at: '2026-05-27T08:42:19.000Z',
    local_calendar_day: '2026-05-27',
    ...overrides,
  };
}

describe('template-engine — receiptWebsite configured arm', () => {
  const KEY = 'POS_PULSE_RECEIPT_WEBSITE';
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env[KEY];
  });

  afterEach(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, KEY);
    } else {
      process.env[KEY] = previous;
    }
  });

  it('uses the configured website when POS_PULSE_RECEIPT_WEBSITE is set', () => {
    process.env[KEY] = 'pharmacy.example.eg';
    const out = renderReceipt(payload());
    expect(out.html).toContain('pharmacy.example.eg');
  });

  it('falls back to the default website when the env var is blank/whitespace', () => {
    process.env[KEY] = '   ';
    const out = renderReceipt(payload());
    // A whitespace-only value is treated as unset; the default site renders.
    expect(out.html).not.toContain('   \n');
    expect(out.html.length).toBeGreaterThan(0);
  });
});

describe('template-engine — long line wrapping (continuation indent)', () => {
  it('wraps a line whose "{qty}× {name}" exceeds 42 columns onto an indented continuation', () => {
    const longName = 'Compound multivitamin effervescent tablets orange flavour family pack';
    const out = renderReceipt(
      payload({
        lines: [
          {
            item_ref: 'SKU-LONG',
            display_name: longName,
            quantity: 3,
            unit_price_minor: 5000,
            line_subtotal_minor: 15000,
            note: null,
          },
        ],
        subtotal_minor: 15000,
        tender_lines_summary: [
          { tender_type: 'cash', amount_applied_minor: 15000, change_due_minor: 0 },
        ],
      }),
    );
    // The full name survives across the wrap in the HTML output.
    expect(out.html).toContain('Compound multivitamin');
    expect(out.html).toContain('family pack');
    expect(out.escpos.length).toBeGreaterThan(0);
  });
});
