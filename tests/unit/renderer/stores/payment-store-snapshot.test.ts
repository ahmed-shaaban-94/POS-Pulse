import { describe, it, expect, beforeEach } from 'vitest';

import { usePaymentStore } from '../../../../src/renderer/stores/payment-store.js';
import type { PaymentAttemptRendererView } from '../../../../src/shared/payments/types.js';
import type { PaymentIntentEnvelope } from '../../../../src/shared/cart/handoff-envelope.js';

/**
 * T150 — paymentSlice FSM mirror (RED → GREEN).
 *
 * The store holds the latest main-process projection returned by
 * `payments.read` / `payments.subscribe`. The store is a pure state-machine:
 * components own the bridge calls and dispatch into the store on each
 * response. This mirrors `cart-store.ts` posture (AD-1: main owns FSM).
 *
 * Scope:
 *   - `paymentSlice` initial state is null (no active attempt).
 *   - `applyAttemptSnapshot(view)` stores the latest projection.
 *   - Re-calling `applyAttemptSnapshot` replaces the prior snapshot (state may
 *     transition started → settled → cancelled etc.).
 *   - `clearAttempt()` resets `paymentSlice` to null (but does NOT touch the
 *     Slice-1 envelope state — those are independent slices).
 *   - `reset()` clears both `envelope` and `paymentSlice`.
 *   - The envelope mount/reset surface introduced in Slice 1 remains intact.
 */

const ENVELOPE: PaymentIntentEnvelope = {
  envelope_version: 'v1',
  handoff_action_id: 'h-1',
  cart_id: 'cart-1',
  tenant_id: 't-1',
  branch_id: 'b-1',
  terminal_id: 'term-1',
  operator_session_id: 'sess-1',
  owning_operator_id: 'op-1',
  lines: [],
  discount_placeholders: [],
  subtotal_minor: 1500,
  created_at: '2026-05-23T12:00:00.000Z',
};

function makeAttemptView(
  state: PaymentAttemptRendererView['state'],
  overrides: Partial<PaymentAttemptRendererView> = {},
): PaymentAttemptRendererView {
  return {
    payment_attempt_id: 'pa-1',
    state,
    envelope_subtotal_minor: 1500,
    started_at: '2026-05-23T12:00:01.000Z',
    tender_lines: [],
    ...overrides,
  };
}

beforeEach(() => {
  usePaymentStore.getState().reset();
});

describe('paymentStore — paymentSlice initial state', () => {
  it('starts with no active attempt (paymentSlice === null)', () => {
    const { paymentSlice } = usePaymentStore.getState();
    expect(paymentSlice).toBeNull();
  });

  it('Slice-1 envelope state is preserved alongside paymentSlice', () => {
    usePaymentStore.getState().mount(ENVELOPE);
    expect(usePaymentStore.getState().envelope).not.toBeNull();
    expect(usePaymentStore.getState().paymentSlice).toBeNull();
  });
});

describe('paymentStore — applyAttemptSnapshot', () => {
  it('stores a started snapshot', () => {
    const view = makeAttemptView('started');
    usePaymentStore.getState().applyAttemptSnapshot(view);
    expect(usePaymentStore.getState().paymentSlice).toEqual(view);
  });

  it('replaces a prior snapshot on a subsequent call (started → settled)', () => {
    usePaymentStore.getState().applyAttemptSnapshot(makeAttemptView('started'));
    const settled = makeAttemptView('settled', {
      settled_at: '2026-05-23T12:00:05.000Z',
    });
    usePaymentStore.getState().applyAttemptSnapshot(settled);
    expect(usePaymentStore.getState().paymentSlice?.state).toBe('settled');
    expect(usePaymentStore.getState().paymentSlice?.settled_at).toBe('2026-05-23T12:00:05.000Z');
  });

  it('replaces a prior snapshot on a subsequent call (started → cancelled)', () => {
    usePaymentStore.getState().applyAttemptSnapshot(makeAttemptView('started'));
    usePaymentStore.getState().applyAttemptSnapshot(
      makeAttemptView('cancelled', {
        cancelled_at: '2026-05-23T12:00:10.000Z',
      }),
    );
    expect(usePaymentStore.getState().paymentSlice?.state).toBe('cancelled');
  });

  it('exposes tender_lines from the snapshot read-only', () => {
    const view = makeAttemptView('started', {
      tender_lines: [
        {
          tender_line_id: 'tl-1',
          tender_type: 'cash',
          amount_applied_minor: 500,
          state: 'applied',
          apply_order: 1,
          applied_at: '2026-05-23T12:00:02.000Z',
        },
      ],
    });
    usePaymentStore.getState().applyAttemptSnapshot(view);
    const slice = usePaymentStore.getState().paymentSlice;
    expect(slice?.tender_lines).toHaveLength(1);
    expect(slice?.tender_lines[0]?.tender_line_id).toBe('tl-1');
    expect(slice?.tender_lines[0]?.tender_type).toBe('cash');
  });
});

describe('paymentStore — clearAttempt', () => {
  it('clears paymentSlice without touching the Slice-1 envelope', () => {
    usePaymentStore.getState().mount(ENVELOPE);
    usePaymentStore.getState().applyAttemptSnapshot(makeAttemptView('started'));
    expect(usePaymentStore.getState().paymentSlice).not.toBeNull();
    expect(usePaymentStore.getState().envelope).not.toBeNull();

    usePaymentStore.getState().clearAttempt();
    expect(usePaymentStore.getState().paymentSlice).toBeNull();
    // Slice-1 envelope state survives — independent slice.
    expect(usePaymentStore.getState().envelope).not.toBeNull();
  });

  it('is a no-op when paymentSlice is already null', () => {
    usePaymentStore.getState().clearAttempt();
    expect(usePaymentStore.getState().paymentSlice).toBeNull();
  });
});

describe('paymentStore — reset clears both slices', () => {
  it('reset clears both the envelope and the paymentSlice', () => {
    usePaymentStore.getState().mount(ENVELOPE);
    usePaymentStore.getState().applyAttemptSnapshot(makeAttemptView('started'));
    usePaymentStore.getState().reset();
    expect(usePaymentStore.getState().envelope).toBeNull();
    expect(usePaymentStore.getState().paymentSlice).toBeNull();
  });
});

describe('paymentStore — selector views', () => {
  it('paymentAttemptId selector returns the attempt id when set', () => {
    usePaymentStore.getState().applyAttemptSnapshot(makeAttemptView('started'));
    expect(usePaymentStore.getState().paymentSlice?.payment_attempt_id).toBe('pa-1');
  });

  it('reversal_pending_tender_line_ids defaults to empty when no cancelled snapshot', () => {
    // The cancel-response-side hint ("Some reversals are pending") is driven by
    // the cancel-response object, not by the projection itself. The projection
    // does not carry reversal_pending_tender_line_ids — per-line state lives
    // inside tender_lines[*].state.
    usePaymentStore.getState().applyAttemptSnapshot(makeAttemptView('started'));
    const slice = usePaymentStore.getState().paymentSlice;
    const reversalPending = (slice?.tender_lines ?? []).filter(
      (l) => l.state === 'reversal_pending',
    );
    expect(reversalPending).toEqual([]);
  });
});
