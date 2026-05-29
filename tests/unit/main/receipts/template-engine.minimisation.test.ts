/**
 * T130-T134 — receipt payload minimisation (RED).
 *
 * Security-critical (Constitution §P6 / §P7, FR-070 / FR-071). The rendered
 * receipt (HTML AND ESC/POS bytes) must NEVER contain card data, voucher
 * secrets, or PII beyond the selling-operator display name — across every
 * tender mix. Conditional reference fields appear ONLY when the Sale row
 * carries them. Tender rows use generic bilingual labels.
 *
 * These tests render through the real engine; they are the proof that a
 * leaked field in the payload cannot reach the slip.
 */

import { describe, expect, it } from 'vitest';
import { renderReceipt } from '../../../../src/main/receipts/template-engine.js';
import type { ReceiptPayload } from '../../../../src/shared/receipts/types.js';
import type { SaleId, SaleNumber } from '../../../../src/shared/sales/types.js';

function payload(overrides: Partial<ReceiptPayload> = {}): ReceiptPayload {
  return {
    variant: 'first_print',
    sale_id: 'sale-1' as SaleId,
    sale_number: 'TERM-01-2026-05-27-000001' as SaleNumber,
    receipt_number: 'TERM-01-2026-05-27-000001',
    tenant_tax_registration_id: '100123456789012',
    branch_name: 'صيدلية',
    branch_address: 'العنوان',
    terminal_label: 'TERM-01',
    selling_operator_display_name: 'Mohamed Ahmed',
    subtotal_minor: 10000,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    lines: [
      {
        item_ref: 'SKU-001',
        display_name: 'Some Drug 500mg',
        quantity: 1,
        unit_price_minor: 10000,
        line_subtotal_minor: 10000,
        note: null,
      },
    ],
    tender_lines_summary: [
      { tender_type: 'cash', amount_applied_minor: 10000, change_due_minor: 0 },
    ],
    settled_at: '2026-05-27T08:42:18.000Z',
    finalized_at: '2026-05-27T08:42:19.000Z',
    local_calendar_day: '2026-05-27',
    ...overrides,
  };
}

function rendered(p: ReceiptPayload): string {
  const out = renderReceipt(p);
  return new TextDecoder().decode(out.escpos) + '\n' + out.html;
}

describe('T130 — card-data minimisation', () => {
  it('never renders PAN / CVV / track / cardholder / expiry / auth / cryptogram', () => {
    // Even if a (forbidden) caller smuggled these into a tender summary object,
    // the engine reads only the typed fields — none of these reach the slip.
    const dirty = payload({
      tender_lines_summary: [
        {
          tender_type: 'external_card_terminal',
          amount_applied_minor: 10000,
          // @ts-expect-error — these keys are NOT on TenderLineSummary; this
          // test proves the engine ignores any extra keys a caller injects.
          pan: '4111111111111111',
          cvv: 'CVV787',
          cardholder_name: 'JOHN SMITH',
          expiry: '12/29',
        },
      ],
    });
    const text = rendered(dirty);
    expect(text).not.toContain('4111111111111111');
    expect(text).not.toContain('CVV787');
    expect(text).not.toContain('JOHN SMITH');
    expect(text).not.toContain('12/29');
  });
});

describe('T131 — voucher-data minimisation', () => {
  it('never renders voucher code / balance / token / authority payload', () => {
    const dirty = payload({
      tender_lines_summary: [
        {
          tender_type: 'internal_voucher',
          amount_applied_minor: 10000,
          // @ts-expect-error — forbidden keys not on the type; engine ignores.
          voucher_code: 'VCHR-SECRET-9999',
          voucher_balance: 50000,
          voucher_redemption_intent_token: 'tok-leak',
        },
      ],
    });
    const text = rendered(dirty);
    expect(text).not.toContain('VCHR-SECRET-9999');
    expect(text).not.toContain('50000');
    expect(text).not.toContain('tok-leak');
  });
});

describe('T134 — generic bilingual tender labels', () => {
  it('uses generic labels with no tender-specific identifier beyond conditionals', () => {
    const text = rendered(
      payload({
        tender_lines_summary: [
          { tender_type: 'cash', amount_applied_minor: 5000, change_due_minor: 0 },
          { tender_type: 'external_card_terminal', amount_applied_minor: 3000 },
          { tender_type: 'internal_voucher', amount_applied_minor: 2000 },
        ],
      }),
    );
    expect(text).toContain('نقدًا — Cash');
    expect(text).toContain('بطاقة — Card');
    expect(text).toContain('قسيمة — Voucher');
  });
});

describe('T132/T133 — conditional reference fields gated on Sale presence', () => {
  it('omits external_reference and voucher_authority_redemption_id when absent', () => {
    const text = rendered(
      payload({
        tender_lines_summary: [
          { tender_type: 'cash', amount_applied_minor: 10000, change_due_minor: 0 },
        ],
      }),
    );
    // No stray reference labels when the sale carries none.
    expect(text).not.toMatch(/Ref:/i);
    expect(text).not.toMatch(/Voucher ref/i);
  });

  it('renders external_reference ONLY when the Sale row carries it', () => {
    const withRef = rendered(
      payload({
        tender_lines_summary: [
          {
            tender_type: 'external_card_terminal',
            amount_applied_minor: 10000,
            external_reference: 'AB12XY',
          },
        ],
      }),
    );
    expect(withRef).toContain('AB12XY');
  });

  it('renders voucher_authority_redemption_id ONLY when the Sale row carries it', () => {
    const withVid = rendered(
      payload({
        tender_lines_summary: [
          {
            tender_type: 'internal_voucher',
            amount_applied_minor: 10000,
            voucher_authority_redemption_id: 'VAR-99',
          },
        ],
      }),
    );
    expect(withVid).toContain('VAR-99');
  });
});
