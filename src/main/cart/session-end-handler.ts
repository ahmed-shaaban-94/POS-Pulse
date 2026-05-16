/**
 * 005-sales-cart T070 — Session-end cart discard handler.
 *
 * Implements Q3 policy (a): when an operator session ends, any draft cart
 * owned by that session is cancelled (cancellation_reason = 'session_ended')
 * and a `cart.discarded_on_session_end` audit event is emitted.
 *
 * SECURITY:
 * - No session credentials, PINs, tokens, or raw sensitive payloads are
 *   written to the outbox or the audit payload.
 * - The audit payload is validated by AuditEmitter before persistence.
 */

import { randomUUID } from 'node:crypto';

import type { CartStore } from './cart-store.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import type { SessionEndCause } from '../../shared/operator/session-end-cause.js';
import { CartState } from '../../shared/cart/cart-state.js';
import type { SessionManager } from '../operator/session-manager.js';

export interface DiscardDraftCartForSessionEndParams {
  /** The cart to potentially discard. */
  cart_id: string;
  /** The operator session that is ending. */
  operator_session_id: string;
  /** The operator_id of the session owner (becomes acting_operator_id on the audit event). */
  acting_operator_id: string;
  /** Why the session is ending — stored in the audit payload. */
  discard_cause: SessionEndCause;
  /** Cart persistence handle. */
  cartStore: CartStore;
  /** Audit emitter (may be mocked in tests). */
  auditEmitter: AuditEmitter;
}

/**
 * Discards a draft cart on session end per Q3 policy (a).
 *
 * Safe to call speculatively: a no-op if the cart is already terminal
 * (`frozen_handed_off` or `cancelled`) or not found.
 *
 * The cancel + outbox write + audit emission are atomic within the
 * SQLite transaction provided by `cancelCartAndOutbox`.
 */
export async function discardDraftCartForSessionEnd(
  params: DiscardDraftCartForSessionEndParams,
): Promise<void> {
  const { cart_id, operator_session_id, acting_operator_id, discard_cause, cartStore, auditEmitter } =
    params;

  const cart = cartStore.getCart(cart_id);
  if (cart === undefined) return;

  // Only discard mutable (draft) carts — frozen and cancelled are terminal.
  const mutableStates: ReadonlySet<string> = new Set([
    CartState.empty,
    CartState.editing,
    CartState.discount_pending_attribution,
    CartState.handing_off,
  ]);
  if (!mutableStates.has(cart.state)) return;

  const now = new Date().toISOString();
  const event_id = randomUUID();
  const action_id = randomUUID();

  cartStore.cancelCartAndOutbox(
    {
      cart_id,
      cancelled_at: now,
      cancellation_reason: 'session_ended',
      last_action_id: action_id,
      updated_at: now,
    },
    {
      action_id,
      cart_id,
      line_id: null,
      action_kind: 'cart.discarded_on_session_end',
      acting_operator_id,
      attribution_operator_id: null,
      operator_session_id,
      payload_json: JSON.stringify({ cart_id, operator_session_id, discard_cause }),
      applied_at: now,
    },
    () => {
      auditEmitter.emit({
        event_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        originating_terminal_id: cart.terminal_id,
        acting_operator_id,
        session_id: operator_session_id,
        shift_id: null,
        action_category: 'cart.discarded_on_session_end',
        created_at: now,
        approving_supervisor_id: null,
        payload: { cart_id, operator_session_id, discard_cause },
      });
    },
  );
}

export interface RegisterSessionEndCartDiscardSubscriberParams {
  sessionManager: SessionManager;
  cartStore: CartStore;
  auditEmitter: AuditEmitter;
}

/**
 * Wires session-end → cart discard: registers a subscriber on `sessionManager`
 * that looks up the ending session's active draft cart and discards it per Q3
 * policy (a). Fire-and-forget — session end is not blocked by cart discard.
 */
export function registerSessionEndCartDiscardSubscriber(
  params: RegisterSessionEndCartDiscardSubscriberParams,
): void {
  const { sessionManager, cartStore, auditEmitter } = params;
  sessionManager.onEnded((record, cause) => {
    const cart = cartStore.findDraftCartBySession(record.id);
    if (cart === undefined) return;
    void discardDraftCartForSessionEnd({
      cart_id: cart.cart_id,
      operator_session_id: record.id,
      acting_operator_id: record.operator_id,
      discard_cause: cause ?? 'signed_out',
      cartStore,
      auditEmitter,
    }).catch(() => {
      // discard failure must not propagate to callers of sessionManager.end()
    });
  });
}
