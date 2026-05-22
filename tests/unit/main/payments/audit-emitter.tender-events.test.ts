/**
 * T094 — Audit emitter — tender.* per-line event payloads test (RED).
 *
 * Asserts:
 *   • tender.applied / tender.refused / tender.reversed payloads carry
 *     `tender_line_id`, `payment_attempt_id`, `tender_type`,
 *     `attribution_operator_id`.
 *   • external_reference is **redacted to `*****` in all non-payload log
 *     sinks** — and is the redacted form in the audit payload itself
 *     (data-model §"Extension to 004's audit_events" table row).
 *   • Voucher token never crosses into any payload (no
 *     `voucher_redemption_intent_token` key).
 *   • Constitution §P11 — no card data anywhere.
 */

import { describe, expect, it } from 'vitest';
import { createPaymentAuditEmitter } from '../../../../src/main/payments/audit-emitter.js';

const fixedBase = {
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  originating_terminal_id: 'terminal-1',
  session_id: 'sess-1',
};

describe('T094 — tender.applied per-line event', () => {
  it('emits tender.applied with attribution + redacted external_reference', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitTenderApplied({
      ...fixedBase,
      tender_line_id: 'tl-1',
      payment_attempt_id: 'pa-1',
      tender_type: 'external_card_terminal',
      amount_applied_minor: 1500,
      external_reference: 'AB12XY',
      applied_at: '2026-05-22T10:00:01.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
    });
    const evt = captured[0] as Record<string, unknown>;
    expect(evt.action_category).toBe('tender.applied');
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.tender_line_id).toBe('tl-1');
    expect(payload.attribution_operator_id).toBe('op-clerk-user-abc');
    expect(payload.external_reference).toBe('*****');
    // The cleartext must not appear anywhere in the payload.
    expect(JSON.stringify(payload)).not.toContain('AB12XY');
  });

  it('omits external_reference key entirely for cash applied event', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitTenderApplied({
      ...fixedBase,
      tender_line_id: 'tl-1',
      payment_attempt_id: 'pa-1',
      tender_type: 'cash',
      amount_applied_minor: 1500,
      change_due_minor: 0,
      applied_at: '2026-05-22T10:00:01.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
    });
    const payload = (captured[0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect(payload.external_reference).toBeUndefined();
    expect(payload.change_due_minor).toBe(0);
  });
});

describe('T094 — tender.refused per-line event', () => {
  it('emits tender.refused with refusal_reason and line id', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitTenderRefused({
      ...fixedBase,
      tender_line_id: 'tl-1',
      payment_attempt_id: 'pa-1',
      tender_type: 'external_card_terminal',
      refusal_reason: 'non_cash_overpayment_refused',
      refused_at: '2026-05-22T10:00:01.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
    });
    const payload = (captured[0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect((captured[0] as Record<string, unknown>).action_category).toBe('tender.refused');
    expect(payload.refusal_reason).toBe('non_cash_overpayment_refused');
  });
});

describe('T094 — tender.reversed per-line event', () => {
  it('emits tender.reversed for cash without manual_void_required', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitTenderReversed({
      ...fixedBase,
      tender_line_id: 'tl-1',
      payment_attempt_id: 'pa-1',
      tender_type: 'cash',
      reversed_at: '2026-05-22T10:00:30.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
      manual_void_required: false,
    });
    const payload = (captured[0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect(payload.manual_void_required).toBe(false);
  });

  it('emits tender.reversed for external_card_terminal with manual_void_required=true', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitTenderReversed({
      ...fixedBase,
      tender_line_id: 'tl-2',
      payment_attempt_id: 'pa-1',
      tender_type: 'external_card_terminal',
      reversed_at: '2026-05-22T10:00:31.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
      manual_void_required: true,
    });
    const payload = (captured[0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect(payload.manual_void_required).toBe(true);
  });
});

describe('T094 — voucher token never crosses into payload', () => {
  it('emitter strips voucher_redemption_intent_token even if accidentally passed', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    // Pass a payload that smuggles a forbidden key — emitRaw must refuse.
    expect(() => {
      emitter.emitRaw({
        action_category: 'tender.applied',
        payment_attempt_id: 'pa-1',
        attribution_operator_id: 'op-abc',
        ...fixedBase,
        created_at: '2026-05-22T10:00:01.000Z',
        payload: {
          tender_line_id: 'tl-1',
          tender_type: 'internal_voucher',
          voucher_redemption_intent_token: 'tok-leak',
        },
      });
    }).toThrow();
    expect(captured).toHaveLength(0);
  });
});
