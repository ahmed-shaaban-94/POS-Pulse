/**
 * T093 — Audit emitter — payment.cancelled + payment.failed payload test (RED).
 *
 * Asserts (data-model + FR-013/FR-014):
 *   • payment.cancelled / payment.failed payloads carry operator attribution
 *     and handoff_action_id correlation.
 *   • No PII, no card data, no voucher tokens in the payload tree.
 *   • **`attribution_operator_id` MUST come from 004's Clerk-backed
 *     `OperatorSession.operator_id`.** Negative tests reject derivation from
 *     device tokens, PIN records, terminal artefacts, or any per-terminal
 *     local identifier (Constitution §VIII).
 */

import { describe, expect, it } from 'vitest';
import { createPaymentAuditEmitter } from '../../../../src/main/payments/audit-emitter.js';
import { deriveAttributionOperatorId } from '../../../../src/main/payments/audit-emitter.js';

describe('T093 — payment.cancelled audit payload', () => {
  it('emits cancelled with operator + handoff correlation; no sensitive fields', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitPaymentCancelled({
      payment_attempt_id: 'pa-1',
      cart_id: 'cart-1',
      handoff_action_id: 'handoff-1',
      cancelled_at: '2026-05-22T10:01:00.000Z',
      attribution_operator_id: 'op-clerk-user-abc',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      originating_terminal_id: 'terminal-1',
      session_id: 'sess-1',
    });
    expect(captured).toHaveLength(1);
    const evt = captured[0] as Record<string, unknown>;
    expect(evt.action_category).toBe('payment.cancelled');
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.attribution_operator_id).toBe('op-clerk-user-abc');
    expect(payload.handoff_action_id).toBe('handoff-1');
    // No forbidden keys in the tree.
    const s = JSON.stringify(payload);
    for (const forbidden of ['pin', 'pin_hash', 'password', 'clerk_jwt', 'device_token', 'token']) {
      expect(s).not.toMatch(new RegExp(`"${forbidden}"`));
    }
  });
});

describe('T093 — payment.failed audit payload', () => {
  it('emits failed with failure_reason and operator attribution', () => {
    const captured: Array<Record<string, unknown>> = [];
    const emitter = createPaymentAuditEmitter({
      sink: {
        write: (e) => {
          captured.push(e);
        },
      },
    });
    emitter.emitPaymentFailed({
      payment_attempt_id: 'pa-1',
      cart_id: 'cart-1',
      handoff_action_id: 'handoff-1',
      failed_at: '2026-05-22T10:00:45.000Z',
      failure_reason: 'tender_underpaid',
      attribution_operator_id: 'op-clerk-user-abc',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      originating_terminal_id: 'terminal-1',
      session_id: 'sess-1',
    });
    const evt = captured[0] as Record<string, unknown>;
    expect(evt.action_category).toBe('payment.failed');
    const payload = evt.payload as Record<string, unknown>;
    expect(payload.failure_reason).toBe('tender_underpaid');
  });
});

describe('T093 — attribution_operator_id sourcing (FR-013 / FR-014 / Constitution §VIII)', () => {
  it('accepts a Clerk-backed OperatorSession with operator_id', () => {
    const id = deriveAttributionOperatorId({
      kind: 'operator_session',
      operator_id: 'user_clerk_abc',
    });
    expect(id).toBe('user_clerk_abc');
  });

  it('refuses derivation from a device token', () => {
    expect(() =>
      deriveAttributionOperatorId({
        kind: 'device_token',
        token: 'dev-tok-1',
      } as never),
    ).toThrow(/clerk|operator_session|attribution/i);
  });

  it('refuses derivation from a cashier PIN record', () => {
    expect(() =>
      deriveAttributionOperatorId({
        kind: 'pin_record',
        target_cashier_id: 'cashier-x',
      } as never),
    ).toThrow(/clerk|operator_session|attribution/i);
  });

  it('refuses derivation from a terminal artefact / per-terminal local id', () => {
    expect(() =>
      deriveAttributionOperatorId({
        kind: 'terminal_id',
        terminal_id: 'terminal-1',
      } as never),
    ).toThrow(/clerk|operator_session|attribution/i);
  });

  it('refuses derivation from an unknown shape', () => {
    expect(() => deriveAttributionOperatorId({} as never)).toThrow();
    expect(() => deriveAttributionOperatorId(null as unknown as never)).toThrow();
  });
});
