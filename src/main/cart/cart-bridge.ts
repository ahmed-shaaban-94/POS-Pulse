import { randomUUID } from 'node:crypto';

import type { Logger } from 'pino';

import type { OperatorSessionRecord } from '../operator/session-manager.js';
import type {
  CartCreateRequest,
  CartCreateResponse,
  CartDiscountPlaceholdersAddRequest,
  CartDiscountPlaceholdersAddResponse,
  CartDiscountPlaceholdersRemoveRequest,
  CartDiscountPlaceholdersRemoveResponse,
  CartHandoffRequest,
  CartHandoffResponse,
  CartLinesAddRequest,
  CartLinesAddResponse,
  CartLinesRemoveRequest,
  CartLinesRemoveResponse,
  CartLinesSetNoteRequest,
  CartLinesSetNoteResponse,
  CartLinesUpdateRequest,
  CartLinesUpdateResponse,
  CartSubscribeRequest,
  CartSubscribeResponse,
  CartVoidRequest,
  CartVoidResponse,
} from '../../shared/cart/bridge-types.js';
import { CartState } from '../../shared/cart/cart-state.js';
import type { CartRefusalReason } from '../../shared/cart/refusal.js';
import { requireOperatorSession } from './require-operator-session.js';

/**
 * 005-sales-cart S1 — `cart.*` bridge handlers (T025 + T026).
 *
 * S1 scope: every handler is gated by `requireOperatorSession` (the
 * load-bearing trust boundary — AD-1). Only `cart.create` performs real
 * work; the remaining mutating handlers run the gate, then refuse with
 * `not_implemented` until S2 wires durable persistence + the idempotency
 * outbox under §A2.
 *
 * Persistence in S1 is intentionally in-memory only (a `Map<cart_id, …>`).
 * Cart drafts do NOT survive a restart at S1 (FR-028 is satisfied by S2
 * + §A2). The renderer's `cartStore` is the source-of-truth mirror for
 * the visible UI and is cleared on session end (Q3) via the renderer-side
 * sign-out hook (`src/renderer/stores/cart-signout-hook.ts`).
 *
 * SECURITY:
 * - `requireOperatorSession` runs as the FIRST instruction of every
 *   handler; persistence paths NEVER short-circuit ahead of the gate.
 * - Refusals are generic — no factor-distinguishing variants leak to the
 *   renderer (NFR-003 / PR-2 inherited).
 * - No payload values are logged here; only event metadata.
 */

interface CartRecord {
  readonly cart_id: string;
  readonly operator_session_id: string;
  readonly owning_operator_id: string;
  readonly tenant_id: string;
  readonly branch_id: string;
  state: CartState;
}

export interface CartBridgeHandlersDeps {
  /** Returns the currently-authenticated operator session, or null. */
  getCurrentSession: () => OperatorSessionRecord | null;
  /**
   * Optional shared state — when set, this instance reuses the cart
   * store of the provided instance. Used by tests that swap sessions
   * mid-test while continuing to operate on the same cart store.
   * Not exposed to production callers (production has one singleton).
   */
  shareStateWith?: CartBridgeHandlers;
  /** Optional logger. Cart payload values are NEVER logged. */
  logger?: Logger;
}

function refuse(reason: CartRefusalReason): { kind: 'refused'; reason: CartRefusalReason } {
  return { kind: 'refused', reason };
}

export class CartBridgeHandlers {
  private readonly carts: Map<string, CartRecord>;
  private readonly deps: CartBridgeHandlersDeps;

  constructor(deps: CartBridgeHandlersDeps) {
    this.deps = deps;
    this.carts = deps.shareStateWith?.carts ?? new Map<string, CartRecord>();
  }

  // ── cart.create ─────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(_req: CartCreateRequest): Promise<CartCreateResponse> {
    const gate = requireOperatorSession({
      session: this.deps.getCurrentSession(),
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    const session = gate.session;
    const cart_id = randomUUID();
    this.carts.set(cart_id, {
      cart_id,
      operator_session_id: session.id,
      owning_operator_id: session.operator_id,
      tenant_id: session.tenant_id,
      branch_id: session.branch_id,
      state: CartState.empty,
    });
    this.deps.logger?.info({ event: 'cart.create.ok', cart_id }, 'cart.create');
    return Promise.resolve({ kind: 'ok', cart_id });
  }

  // ── cart.lines.* ────────────────────────────────────────────────────

  linesAdd(req: CartLinesAddRequest): Promise<CartLinesAddResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  linesUpdate(req: CartLinesUpdateRequest): Promise<CartLinesUpdateResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  linesRemove(req: CartLinesRemoveRequest): Promise<CartLinesRemoveResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  linesSetNote(req: CartLinesSetNoteRequest): Promise<CartLinesSetNoteResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  // ── cart.discountPlaceholders.* ─────────────────────────────────────

  discountPlaceholdersAdd(
    req: CartDiscountPlaceholdersAddRequest,
  ): Promise<CartDiscountPlaceholdersAddResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  discountPlaceholdersRemove(
    req: CartDiscountPlaceholdersRemoveRequest,
  ): Promise<CartDiscountPlaceholdersRemoveResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  // ── cart.void ───────────────────────────────────────────────────────

  void(req: CartVoidRequest): Promise<CartVoidResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  // ── cart.handoff ────────────────────────────────────────────────────

  handoff(req: CartHandoffRequest): Promise<CartHandoffResponse> {
    return Promise.resolve(this.gateMutating(req.cart_id) ?? refuse('not_implemented'));
  }

  // ── cart.subscribe ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribe(_req: CartSubscribeRequest): Promise<CartSubscribeResponse> {
    // No mutation; only role/session gate. S1 has no runtime subscription.
    const gate = requireOperatorSession({
      session: this.deps.getCurrentSession(),
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    if (gate.kind !== 'ok') return Promise.resolve(refuse(gate.reason));
    return Promise.resolve(refuse('not_implemented'));
  }

  // ── Internal: shared gate for mutating handlers ────────────────────

  /**
   * Runs requireOperatorSession with full cart-aware checks.
   * Returns a refusal envelope on gate failure; `null` if the caller
   * may proceed (S1: always followed by `not_implemented`).
   */
  private gateMutating(cart_id: string): { kind: 'refused'; reason: CartRefusalReason } | null {
    const session = this.deps.getCurrentSession();
    if (session === null) {
      return refuse('no_session');
    }
    const cart = this.carts.get(cart_id);
    // Unknown cart: refuse generically (do NOT reveal that the cart_id
    // does not exist; the response shape is the same as wrong-owner).
    if (cart === undefined) {
      return refuse('wrong_owner');
    }
    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);
    return null;
  }
}
