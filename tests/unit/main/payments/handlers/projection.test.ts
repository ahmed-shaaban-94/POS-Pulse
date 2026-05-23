/**
 * S3c — Projection helper unit tests.
 *
 * `projection.ts` is consumed by `payments.read`, `payments.subscribe`,
 * and `tender.read`. The existing handler tests cover the common cases
 * (cash with change_due_minor, external_card_terminal with
 * external_reference, an attempt in started/settled state) but leave
 * the optional-field branches uncovered:
 *
 *   • voucher_authority_redemption_id (only voucher lines)
 *   • refused_at / reversed_at / reversal_pending_since
 *   • refusal_reason (refused lines)
 *   • Attempt-level failed_at / force_failed_at
 *
 * These targeted tests lift `src/main/payments/handlers/projection.ts`
 * from ~62% to 100% branch coverage. They also document the
 * FR-017 minimisation guarantee at a single, isolated seam — every
 * field that may cross from main to renderer is enumerated here.
 */

import { describe, expect, it } from 'vitest';

import {
  projectPaymentAttemptRendererView,
  projectTenderLineRendererView,
} from '../../../../../src/main/payments/handlers/projection.js';
import { makeAttemptRow, makeLineRow } from '../__fixtures__/bridge-handler-deps.js';

describe('projectTenderLineRendererView — required fields', () => {
  it('includes only the 5 mandatory fields for a bare line', () => {
    const line = makeLineRow({
      change_due_minor: null,
      external_reference: null,
      voucher_authority_redemption_id: null,
      applied_at: null,
      refused_at: null,
      reversed_at: null,
      reversal_pending_since: null,
      refusal_reason: null,
    });
    const view = projectTenderLineRendererView(line);
    expect(view).toEqual({
      tender_line_id: 'tl-1',
      tender_type: 'cash',
      amount_applied_minor: 1500,
      state: 'applied',
      apply_order: 1,
    });
  });
});

describe('projectTenderLineRendererView — optional fields (one per branch)', () => {
  it('includes change_due_minor when non-null', () => {
    const view = projectTenderLineRendererView(makeLineRow({ change_due_minor: 500 }));
    expect(view.change_due_minor).toBe(500);
  });

  it('includes external_reference when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({ tender_type: 'external_card_terminal', external_reference: 'AB12XY' }),
    );
    expect(view.external_reference).toBe('AB12XY');
  });

  it('includes voucher_authority_redemption_id when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({
        tender_type: 'internal_voucher',
        voucher_authority_redemption_id: 'AUTH-7XQ',
      }),
    );
    expect(view.voucher_authority_redemption_id).toBe('AUTH-7XQ');
  });

  it('includes applied_at when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({ applied_at: '2026-05-23T11:00:01.000Z' }),
    );
    expect(view.applied_at).toBe('2026-05-23T11:00:01.000Z');
  });

  it('includes refused_at when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({
        state: 'refused',
        applied_at: null,
        refused_at: '2026-05-23T11:00:02.000Z',
      }),
    );
    expect(view.refused_at).toBe('2026-05-23T11:00:02.000Z');
  });

  it('includes reversed_at when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({
        state: 'reversed',
        applied_at: '2026-05-23T11:00:01.000Z',
        reversed_at: '2026-05-23T11:00:03.000Z',
      }),
    );
    expect(view.reversed_at).toBe('2026-05-23T11:00:03.000Z');
  });

  it('includes reversal_pending_since when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({
        state: 'reversal_pending',
        applied_at: '2026-05-23T11:00:01.000Z',
        reversal_pending_since: '2026-05-23T11:00:04.000Z',
      }),
    );
    expect(view.reversal_pending_since).toBe('2026-05-23T11:00:04.000Z');
  });

  it('narrows refusal_reason from string to RefusalReason when non-null', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({
        state: 'refused',
        applied_at: null,
        refused_at: '2026-05-23T11:00:02.000Z',
        refusal_reason: 'non_cash_overpayment_refused',
      }),
    );
    expect(view.refusal_reason).toBe('non_cash_overpayment_refused');
  });

  it('omits server-side fields (attribution_operator_id, last_action_id) regardless of row content', () => {
    const view = projectTenderLineRendererView(
      makeLineRow({
        attribution_operator_id: 'op-clerk-user-abc',
        last_action_id: 'apply-tl-1',
      }),
    );
    expect(view).not.toHaveProperty('attribution_operator_id');
    expect(view).not.toHaveProperty('last_action_id');
    // And the voucher intent token must never appear regardless of row state.
    expect(view).not.toHaveProperty('voucher_redemption_intent_token');
  });
});

describe('projectPaymentAttemptRendererView — terminal-state branches', () => {
  it('returns only the 5 mandatory fields for a bare started attempt', () => {
    const row = makeAttemptRow();
    const view = projectPaymentAttemptRendererView(row, []);
    expect(view).toEqual({
      payment_attempt_id: 'pa-1',
      state: 'started',
      envelope_subtotal_minor: 1500,
      started_at: '2026-05-23T11:00:00.000Z',
      tender_lines: [],
    });
  });

  it('includes settled_at when the attempt is settled', () => {
    const row = makeAttemptRow({ state: 'settled', settled_at: '2026-05-23T11:00:05.000Z' });
    const view = projectPaymentAttemptRendererView(row, []);
    expect(view.settled_at).toBe('2026-05-23T11:00:05.000Z');
    expect(view).not.toHaveProperty('cancelled_at');
    expect(view).not.toHaveProperty('failed_at');
    expect(view).not.toHaveProperty('force_failed_at');
  });

  it('includes cancelled_at when the attempt is cancelled', () => {
    const row = makeAttemptRow({ state: 'cancelled', cancelled_at: '2026-05-23T11:00:05.000Z' });
    const view = projectPaymentAttemptRendererView(row, []);
    expect(view.cancelled_at).toBe('2026-05-23T11:00:05.000Z');
  });

  it('includes failed_at when the attempt is failed', () => {
    const row = makeAttemptRow({ state: 'failed', failed_at: '2026-05-23T11:00:10.000Z' });
    const view = projectPaymentAttemptRendererView(row, []);
    expect(view.failed_at).toBe('2026-05-23T11:00:10.000Z');
  });

  it('includes force_failed_at when the attempt is force_failed (Slice 4 type-only)', () => {
    const row = makeAttemptRow({
      state: 'force_failed',
      force_failed_at: '2026-05-23T11:00:12.000Z',
    });
    const view = projectPaymentAttemptRendererView(row, []);
    expect(view.force_failed_at).toBe('2026-05-23T11:00:12.000Z');
  });
});

describe('projectPaymentAttemptRendererView — line ordering', () => {
  it('sorts lines by apply_order ASC regardless of input order', () => {
    const row = makeAttemptRow();
    const lines = [
      makeLineRow({ tender_line_id: 'tl-3', apply_order: 3 }),
      makeLineRow({ tender_line_id: 'tl-1', apply_order: 1 }),
      makeLineRow({ tender_line_id: 'tl-2', apply_order: 2 }),
    ];
    const view = projectPaymentAttemptRendererView(row, lines);
    expect(view.tender_lines.map((l) => l.tender_line_id)).toEqual(['tl-1', 'tl-2', 'tl-3']);
  });
});
