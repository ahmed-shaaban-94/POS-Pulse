/**
 * T093 — 008 Slice 1c audit emitter (sale-events test, RED).
 *
 * Asserts the 008-side audit emitter contract:
 *
 *   1. `emitSaleFinalized` writes an event with `action_category='sale.finalized'`
 *      and the payload shape from data-model.md §"audit_events extension".
 *
 *   2. `emitSaleFinalizationRefused` writes `action_category='sale.finalization_refused'`
 *      with a closed-set `refusal_reason` per spec FR-005/FR-045/FR-046/FR-047 +
 *      FR-070..FR-074 and the canonical `SALES_REFUSAL_REASONS` tuple from
 *      `src/shared/sales/types.ts` (added in S1b).
 *
 *   3. Forbidden-field defence-in-depth: the emitter refuses any payload tree
 *      containing voucher tokens, raw envelope bodies, secret credentials, or
 *      raw card data — via 008's local `SALES_FORBIDDEN_KEYS` set composed with
 *      004's shared `FORBIDDEN_PAYLOAD_KEYS` (per Constitution §P6/§P7 + FR-070..FR-074).
 *
 *   4. `external_reference` substitution: when present in the tender_lines_summary
 *      of `emitSaleFinalized`, the audit payload carries the literal string
 *      `*****` rather than the cleartext value (mirrors 006's `tender.applied`
 *      pattern at src/main/payments/audit-emitter.ts:299).
 *
 * Out of scope for THIS test file (covered in S2/S3/S4 when their callers land):
 *   - emitSaleReceiptPrinted / Reprinted / PrintFailed / PrintRetriedSuccess / ManualOverride
 *   - emitSaleDrawerOpened / Suppressed / Failed
 */

import { describe, expect, it } from 'vitest';

import { createSaleAuditEmitter } from '../../../../src/main/sales/audit-emitter.js';

const fixedBase = {
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  originating_terminal_id: 'terminal-1',
  session_id: 'sess-1',
  attribution_operator_id: 'op-clerk-user-abc',
};

describe('T093 — sale.finalized event', () => {
  it('emits sale.finalized with the canonical payload shape', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createSaleAuditEmitter({
      sink: { write: (e) => captured.push(e) },
    });
    emitter.emitSaleFinalized({
      ...fixedBase,
      sale_id: 'sale-1',
      sale_number: 'TERM-01-2026-05-27-000001',
      payment_attempt_id: 'pa-1',
      envelope_handoff_action_id: 'handoff-1',
      finalized_at: '2026-05-27T10:00:00.000Z',
      subtotal_minor: 1500,
      total_tax_minor: 0,
      tender_lines_summary: [
        {
          tender_type: 'cash',
          amount_applied_minor: 2000,
          change_due_minor: 500,
        },
      ],
    });
    expect(captured).toHaveLength(1);
    const evt = captured[0] as Record<string, unknown>;
    expect(evt.action_category).toBe('sale.finalized');
    expect(evt.attribution_operator_id).toBe('op-clerk-user-abc');
    expect(evt.created_at).toBe('2026-05-27T10:00:00.000Z');
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.sale_id).toBe('sale-1');
    expect(payload.sale_number).toBe('TERM-01-2026-05-27-000001');
    expect(payload.payment_attempt_id).toBe('pa-1');
    expect(payload.envelope_handoff_action_id).toBe('handoff-1');
  });

  it('substitutes external_reference with ***** for card tender lines', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createSaleAuditEmitter({
      sink: { write: (e) => captured.push(e) },
    });
    emitter.emitSaleFinalized({
      ...fixedBase,
      sale_id: 'sale-2',
      sale_number: 'TERM-01-2026-05-27-000002',
      payment_attempt_id: 'pa-2',
      envelope_handoff_action_id: 'handoff-2',
      finalized_at: '2026-05-27T10:01:00.000Z',
      subtotal_minor: 1500,
      total_tax_minor: 0,
      tender_lines_summary: [
        {
          tender_type: 'external_card_terminal',
          amount_applied_minor: 1500,
          external_reference: 'CARD-AUTH-AB12XY',
        },
      ],
    });
    const evt = captured[0] as Record<string, unknown>;
    const payload = evt.payload as Record<string, unknown>;
    const lines = payload.tender_lines_summary as Array<Record<string, unknown>>;
    expect(lines[0]?.external_reference).toBe('*****');
    // The cleartext must never appear in the audit payload.
    expect(JSON.stringify(payload)).not.toContain('CARD-AUTH-AB12XY');
  });

  it('omits external_reference key entirely for cash tender lines', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createSaleAuditEmitter({
      sink: { write: (e) => captured.push(e) },
    });
    emitter.emitSaleFinalized({
      ...fixedBase,
      sale_id: 'sale-3',
      sale_number: 'TERM-01-2026-05-27-000003',
      payment_attempt_id: 'pa-3',
      envelope_handoff_action_id: 'handoff-3',
      finalized_at: '2026-05-27T10:02:00.000Z',
      subtotal_minor: 1500,
      total_tax_minor: 0,
      tender_lines_summary: [{ tender_type: 'cash', amount_applied_minor: 1500 }],
    });
    const payload = (captured[0] as Record<string, unknown>).payload as Record<string, unknown>;
    const lines = payload.tender_lines_summary as Array<Record<string, unknown>>;
    const firstLine = lines[0];
    expect(firstLine).toBeDefined();
    expect('external_reference' in (firstLine ?? {})).toBe(false);
  });
});

describe('T093 — sale.finalization_refused event', () => {
  it('emits sale.finalization_refused with a closed-set refusal_reason', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createSaleAuditEmitter({
      sink: { write: (e) => captured.push(e) },
    });
    emitter.emitSaleFinalizationRefused({
      ...fixedBase,
      envelope_handoff_action_id: 'handoff-refused-1',
      refused_at: '2026-05-27T10:03:00.000Z',
      refusal_reason: 'force_failed_attempt',
    });
    const evt = captured[0] as Record<string, unknown>;
    expect(evt.action_category).toBe('sale.finalization_refused');
    expect(evt.created_at).toBe('2026-05-27T10:03:00.000Z');
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.refusal_reason).toBe('force_failed_attempt');
    expect(payload.envelope_handoff_action_id).toBe('handoff-refused-1');
  });

  it('accepts all canonical refusal_reason values', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createSaleAuditEmitter({
      sink: { write: (e) => captured.push(e) },
    });
    const reasons = [
      'force_failed_attempt',
      'reversal_pending_line',
      'source_attempt_not_settled',
      'forbidden_field_in_tender_summary',
    ] as const;
    for (const reason of reasons) {
      emitter.emitSaleFinalizationRefused({
        ...fixedBase,
        envelope_handoff_action_id: `handoff-${reason}`,
        refused_at: '2026-05-27T10:04:00.000Z',
        refusal_reason: reason,
      });
    }
    expect(captured).toHaveLength(reasons.length);
  });
});

describe('T093 — forbidden-field defence-in-depth', () => {
  it('refuses emitRaw payload containing voucher token at any depth', () => {
    const emitter = createSaleAuditEmitter({ sink: { write: () => {} } });
    expect(() => {
      emitter.emitRaw({
        action_category: 'sale.finalized',
        attribution_operator_id: 'op-x',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        originating_terminal_id: 'terminal-1',
        session_id: 'sess-1',
        created_at: '2026-05-27T10:05:00.000Z',
        payload: {
          sale_id: 'sale-x',
          nested: { deeper: { voucher_redemption_intent_token: 'TOKEN-LEAK' } },
        },
      });
    }).toThrow(/forbidden field name: voucher_redemption_intent_token/);
  });

  it('refuses emitRaw payload containing PIN', () => {
    const emitter = createSaleAuditEmitter({ sink: { write: () => {} } });
    expect(() => {
      emitter.emitRaw({
        action_category: 'sale.finalized',
        attribution_operator_id: 'op-x',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        originating_terminal_id: 'terminal-1',
        session_id: 'sess-1',
        created_at: '2026-05-27T10:06:00.000Z',
        payload: { sale_id: 'sale-x', pin: '1234' },
      });
    }).toThrow(/forbidden field name: pin/);
  });

  it('refuses emitRaw payload containing raw envelope body', () => {
    const emitter = createSaleAuditEmitter({ sink: { write: () => {} } });
    expect(() => {
      emitter.emitRaw({
        action_category: 'sale.finalized',
        attribution_operator_id: 'op-x',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        originating_terminal_id: 'terminal-1',
        session_id: 'sess-1',
        created_at: '2026-05-27T10:07:00.000Z',
        payload: { sale_id: 'sale-x', envelope_payload: { secret: 'leak' } },
      });
    }).toThrow(/forbidden field name: envelope_payload/);
  });

  it('refuses emitRaw payload containing voucher_code', () => {
    const emitter = createSaleAuditEmitter({ sink: { write: () => {} } });
    expect(() => {
      emitter.emitRaw({
        action_category: 'sale.finalized',
        attribution_operator_id: 'op-x',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        originating_terminal_id: 'terminal-1',
        session_id: 'sess-1',
        created_at: '2026-05-27T10:08:00.000Z',
        payload: { sale_id: 'sale-x', voucher_code: 'VC-LEAK' },
      });
    }).toThrow(/forbidden field name: voucher_code/);
  });
});
