/**
 * T092 — Audit emitter — payment.settled payload test (RED).
 *
 * Asserts (data-model §"Extension to 004's audit_events"):
 *   • payment.settled payload carries: payment_attempt_id, cart_id,
 *     handoff_action_id, settled_at, attribution_operator_id, tender_lines[]
 *     (full breakdown per AD-9 / R-8).
 *   • Each tender_lines[] entry carries: tender_line_id, tender_type,
 *     amount_applied_minor, change_due_minor (cash only), external_reference
 *     **redacted to ******* for external_card_terminal**, applied_at,
 *     attribution_operator_id.
 *   • No raw external_reference value, voucher token, PII, or card data
 *     appears anywhere in the payload tree.
 */

import { describe, expect, it } from 'vitest';
import { createPaymentAuditEmitter } from '../../../../src/main/payments/audit-emitter.js';

describe('T092 — payment.settled audit payload', () => {
  it('emits the full tender breakdown with external_reference redacted to *****', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: { write: (evt) => captured.push(evt) },
    });
    emitter.emitPaymentSettled({
      payment_attempt_id: 'pa-1',
      cart_id: 'cart-1',
      handoff_action_id: 'handoff-1',
      settled_at: '2026-05-22T10:00:05.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      originating_terminal_id: 'terminal-1',
      session_id: 'sess-1',
      tender_lines: [
        {
          tender_line_id: 'tl-1',
          tender_type: 'cash',
          amount_applied_minor: 2000,
          change_due_minor: 500,
          applied_at: '2026-05-22T10:00:01.000Z',
          attribution_operator_id: 'op-clerk-user-abc',
        },
        {
          tender_line_id: 'tl-2',
          tender_type: 'external_card_terminal',
          amount_applied_minor: 1500,
          external_reference: 'AB12XY',
          applied_at: '2026-05-22T10:00:02.000Z',
          attribution_operator_id: 'op-clerk-user-abc',
        },
      ],
    });
    expect(captured).toHaveLength(1);
    const evt = captured[0] as Record<string, unknown>;
    expect(evt.action_category).toBe('payment.settled');
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.payment_attempt_id).toBe('pa-1');
    expect(payload.cart_id).toBe('cart-1');
    expect(payload.handoff_action_id).toBe('handoff-1');
    expect(payload.attribution_operator_id).toBe('op-clerk-user-abc');
    const lines = payload.tender_lines as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    // Cash line — no external_reference key at all.
    expect(lines[0]?.tender_type).toBe('cash');
    expect(lines[0]?.change_due_minor).toBe(500);
    expect(lines[0]?.external_reference).toBeUndefined();
    // External card line — external_reference redacted.
    expect(lines[1]?.tender_type).toBe('external_card_terminal');
    expect(lines[1]?.external_reference).toBe('*****');
    // Raw value must not appear anywhere in the payload tree.
    expect(JSON.stringify(payload)).not.toContain('AB12XY');
  });

  it('carries selling_operator_display_name in the payload (008 T094b source)', () => {
    // 008's finalize worker runs session-independently (boot recovery, no
    // live session), so the selling operator's human-readable name MUST be
    // persisted into the payment.settled payload at confirm-time — sourced
    // from the live session, where it is the only place the name exists.
    // Ahmed's persist-at-settlement decision (2026-05-29).
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: { write: (evt) => captured.push(evt) },
    });
    emitter.emitPaymentSettled({
      payment_attempt_id: 'pa-1',
      cart_id: 'cart-1',
      handoff_action_id: 'handoff-1',
      settled_at: '2026-05-22T10:00:05.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
      selling_operator_display_name: 'Layla Hassan',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      originating_terminal_id: 'terminal-1',
      session_id: 'sess-1',
      tender_lines: [
        {
          tender_line_id: 'tl-1',
          tender_type: 'cash',
          amount_applied_minor: 2000,
          change_due_minor: 0,
          applied_at: '2026-05-22T10:00:01.000Z',
          attribution_operator_id: 'op-clerk-user-abc',
        },
      ],
    });
    const evt = captured[0] as Record<string, unknown>;
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.selling_operator_display_name).toBe('Layla Hassan');
  });

  it('omits change_due_minor on non-cash lines', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitPaymentSettled({
      payment_attempt_id: 'pa-1',
      cart_id: 'cart-1',
      handoff_action_id: 'handoff-1',
      settled_at: '2026-05-22T10:00:05.000Z',
      attribution_operator_id: 'op-abc',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      originating_terminal_id: 'terminal-1',
      session_id: 'sess-1',
      tender_lines: [
        {
          tender_line_id: 'tl-1',
          tender_type: 'external_card_terminal',
          amount_applied_minor: 1500,
          applied_at: '2026-05-22T10:00:01.000Z',
          attribution_operator_id: 'op-abc',
        },
      ],
    });
    const evt0 = captured[0] as Record<string, unknown>;
    const lines = (evt0.payload as Record<string, unknown>).tender_lines as Array<
      Record<string, unknown>
    >;
    expect(lines[0]?.change_due_minor).toBeUndefined();
  });

  it('refuses payloads containing forbidden field names anywhere in the tree', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    // The emitter must refuse to write any payload whose tree contains a
    // forbidden key (defence-in-depth against accidental token leakage).
    expect(() => {
      emitter.emitRaw({
        action_category: 'payment.settled',
        payment_attempt_id: 'pa-1',
        attribution_operator_id: 'op-abc',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        originating_terminal_id: 'terminal-1',
        session_id: 'sess-1',
        created_at: '2026-05-22T10:00:00.000Z',
        payload: { tender_lines: [{ token: 'leak-attempt' }] },
      });
    }).toThrow(/forbidden/i);
    expect(captured).toHaveLength(0);
  });
});
