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
import { computeLineSubtotal, LineSubtotalError } from './line-subtotal.js';
import { requireOperatorSession } from './require-operator-session.js';
import type { CartStore, InsertDiscountPlaceholderInput } from './cart-store.js';
import { AuditEmitter } from '../audit/audit-emitter.js';

/**
 * 005-sales-cart S2 — `cart.*` bridge handlers (T025/T026 from S1 +
 * T045–T048 added in S2).
 *
 * Every handler is gated by `requireOperatorSession` as its FIRST trust
 * boundary (AD-1). All cart mutations go through this class.
 *
 * Persistence:
 * - When a `CartStore` is supplied via `deps.cartStore`, the handlers
 *   write to SQLite via the four cart tables (§A2-cleared schema).
 * - When `deps.cartStore` is omitted, the handlers fall back to an
 *   in-memory `Map<cart_id, CartRecord>` — used by S1 unit tests for
 *   pure role-gate coverage. Production wiring (in `src/main/index.ts`)
 *   always supplies a `CartStore`.
 *
 * SECURITY:
 * - `requireOperatorSession` runs first; persistence/business logic
 *   never short-circuits ahead of the gate.
 * - Refusals are generic — no factor-distinguishing detail leaks.
 * - No payload values (note content, attribution identity, secrets)
 *   are logged here.
 * - Q4 merge uniqueness is application-layer only; no SQL UNIQUE.
 */

interface InMemoryCartRecord {
  readonly cart_id: string;
  readonly operator_session_id: string;
  readonly owning_operator_id: string;
  readonly tenant_id: string;
  readonly branch_id: string;
  state: CartState;
}

/**
 * R7 seam — resolve a catalogue item-ref into the snapshot fields
 * cart_lines persists at add-time (FR-011 / FR-013).
 *
 * S2 ships a stubbed default resolver that refuses generically; tests
 * inject a fixture resolver. A production resolver lands when the
 * future item-catalogue feature ships (T053).
 */
export type ItemRefResolver = (
  item_ref: string,
) => Promise<
  | { kind: 'ok'; display_name: string; unit_price_minor: number }
  | { kind: 'refused'; reason: 'unknown_item' | 'disabled' | 'no_connection' | 'generic' }
>;

const DEFAULT_ITEM_REF_RESOLVER: ItemRefResolver = () =>
  Promise.resolve({ kind: 'refused', reason: 'generic' });

/**
 * Forbidden-pattern check for `cart.lines.setNote` (NFR-006 / FR-021).
 *
 * Minimal S2 list — refuses notes that contain credential-like fragments.
 * The full allowlist + regex catalogue lands in T054 (pino redaction
 * extension is the load-bearing layer; this is the bridge-side gate).
 */
const FORBIDDEN_NOTE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:pin|password|passwd|secret|token|jwt|credential|authorization)\b/i,
  /\b\d{13,19}\b/, // bare card-number-shaped sequences
  /-----BEGIN/i, // PEM key headers
];

function noteHasForbiddenPattern(note: string): boolean {
  return FORBIDDEN_NOTE_PATTERNS.some((re) => re.test(note));
}

/**
 * Strip forbidden payload-field NAMES from a payload tree before it is
 * serialised into `cart_action_outbox.payload_json`. This is the cart-
 * layer mirror of `src/main/audit/audit-emitter.ts`'s `findForbiddenKey`.
 * S2 inlines a minimal version; T054 may extend it.
 */
const FORBIDDEN_PAYLOAD_FIELD_NAMES: ReadonlySet<string> = new Set([
  'pin',
  'pin_hash',
  'password',
  'password_hash',
  'clerk_jwt',
  'clerk_session_token',
  'device_token',
  'device_token_attestation',
  'pairing_code',
  'token',
  'secret',
  'credential',
]);

function scrubPayloadForOutbox(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_PAYLOAD_FIELD_NAMES.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export interface CartBridgeHandlersDeps {
  /** Returns the currently-authenticated operator session, or null. */
  getCurrentSession: () => OperatorSessionRecord | null;
  /**
   * Optional shared state — when set, this instance reuses the cart
   * store of the provided instance. Used by tests that swap sessions
   * mid-test while continuing to operate on the same cart store.
   */
  shareStateWith?: CartBridgeHandlers;
  /** Optional logger. Cart payload values are NEVER logged. */
  logger?: Logger;
  /**
   * Optional DB-backed cart store. When omitted, handlers fall back to
   * the in-memory Map (S1 mode). Production always supplies one.
   */
  cartStore?: CartStore;
  /**
   * Optional R7 seam. When omitted, defaults to a refusing stub.
   * Production wiring + tests inject a real resolver.
   */
  resolveItemRef?: ItemRefResolver;
  /** Optional clock for testability. Defaults to `() => new Date()`. */
  clock?: () => Date;
  /**
   * Optional audit emitter. Required for post-handoff cancel audit emission.
   * When omitted, pre-handoff void still works (no audit for cashier_voided).
   */
  auditEmitter?: AuditEmitter;
}

function refuse(reason: CartRefusalReason): { kind: 'refused'; reason: CartRefusalReason } {
  return { kind: 'refused', reason };
}

export class CartBridgeHandlers {
  /** S1 fallback — used only when deps.cartStore is omitted. */
  private readonly inMemCarts: Map<string, InMemoryCartRecord>;
  private readonly deps: CartBridgeHandlersDeps;
  private readonly clock: () => Date;

  constructor(deps: CartBridgeHandlersDeps) {
    this.deps = deps;
    this.inMemCarts = deps.shareStateWith?.inMemCarts ?? new Map<string, InMemoryCartRecord>();
    this.clock = deps.clock ?? ((): Date => new Date());
  }

  // ── cart.create ─────────────────────────────────────────────────────

  async create(req: CartCreateRequest): Promise<CartCreateResponse> {
    const gate = requireOperatorSession({
      session: this.deps.getCurrentSession(),
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    const session = gate.session;

    // Idempotency: replay-safe when a CartStore is wired.
    if (this.deps.cartStore !== undefined) {
      const existing = this.deps.cartStore.getOutboxRow(req.idempotency_key);
      if (existing !== undefined) {
        if (existing.action_kind !== 'cart.create') {
          return refuse('idempotency_payload_mismatch');
        }
        return Promise.resolve({ kind: 'ok', cart_id: existing.cart_id });
      }
    }

    const cart_id = randomUUID();
    const now = this.clock().toISOString();

    if (this.deps.cartStore !== undefined) {
      this.deps.cartStore.insertCartAndOutbox(
        {
          cart_id,
          tenant_id: session.tenant_id,
          branch_id: session.branch_id,
          // Terminal id is part of the session record's branch context;
          // the operator session does not carry a separate terminal_id
          // column. Use branch_id as the support-bundle scope.
          terminal_id: session.branch_id,
          owning_operator_id: session.operator_id,
          operator_session_id: session.id,
          state: CartState.empty,
          created_at: now,
          last_action_id: req.idempotency_key,
        },
        {
          action_id: req.idempotency_key,
          cart_id,
          line_id: null,
          action_kind: 'cart.create',
          acting_operator_id: session.operator_id,
          attribution_operator_id: null,
          operator_session_id: session.id,
          payload_json: JSON.stringify({}),
          applied_at: now,
        },
      );
    } else {
      this.inMemCarts.set(cart_id, {
        cart_id,
        operator_session_id: session.id,
        owning_operator_id: session.operator_id,
        tenant_id: session.tenant_id,
        branch_id: session.branch_id,
        state: CartState.empty,
      });
    }

    this.deps.logger?.info({ event: 'cart.create.ok', cart_id }, 'cart.create');
    return Promise.resolve({ kind: 'ok', cart_id });
  }

  // ── cart.lines.add ──────────────────────────────────────────────────

  async linesAdd(req: CartLinesAddRequest): Promise<CartLinesAddResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      // S1-compat path: gate then refuse not_implemented.
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    // Idempotency: replay-safe.
    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.line.add' && replay.action_kind !== 'cart.line.merge') {
        return refuse('idempotency_payload_mismatch');
      }
      const replayLineId = replay.line_id;
      if (replayLineId === null) return refuse('idempotency_payload_mismatch');
      const replayLine = store.getLine(req.cart_id, replayLineId);
      if (replayLine === undefined) return refuse('idempotency_payload_mismatch');
      return {
        kind: 'ok',
        line_id: replayLineId,
        merged: replay.action_kind === 'cart.line.merge',
        version: replayLine.version,
        display_name: replayLine.display_name,
        unit_price_minor: replayLine.unit_price_minor,
        line_subtotal_minor: replayLine.line_subtotal_minor,
        quantity: replayLine.quantity,
      };
    }

    if (!Number.isInteger(req.quantity) || req.quantity <= 0) {
      return refuse('not_implemented'); // generic-refusal posture; bridge contract has no 'invalid_quantity' reason
    }

    // R7 seam — resolve item_ref to display_name + unit_price_minor snapshot.
    const resolver = this.deps.resolveItemRef ?? DEFAULT_ITEM_REF_RESOLVER;
    const resolved = await resolver(req.item_ref);
    if (resolved.kind !== 'ok') {
      // The bridge contract has no per-resolver reason; collapse to generic.
      return refuse('wrong_owner');
    }

    // Q4 merge path — application-layer uniqueness on (cart_id, item_ref) among active lines.
    const existing = store.findActiveLineByItemRef(req.cart_id, req.item_ref);
    const now = this.clock().toISOString();

    if (existing !== undefined) {
      const newQuantity = existing.quantity + req.quantity;
      let newSubtotal: number;
      try {
        newSubtotal = computeLineSubtotal(newQuantity, existing.unit_price_minor);
      } catch (err) {
        if (err instanceof LineSubtotalError) return refuse('not_implemented');
        throw err;
      }
      store.mergeLineAndOutbox(
        {
          line_id: existing.line_id,
          quantity: newQuantity,
          line_subtotal_minor: newSubtotal,
          last_action_id: req.idempotency_key,
          updated_at: now,
        },
        {
          action_id: req.idempotency_key,
          cart_id: req.cart_id,
          line_id: existing.line_id,
          action_kind: 'cart.line.merge',
          acting_operator_id: session.operator_id,
          attribution_operator_id: null,
          operator_session_id: session.id,
          payload_json: JSON.stringify(
            scrubPayloadForOutbox({
              item_ref: req.item_ref,
              quantity_added: req.quantity,
            }),
          ),
          applied_at: now,
        },
      );
      return {
        kind: 'ok',
        line_id: existing.line_id,
        merged: true,
        version: existing.version + 1,
        display_name: existing.display_name,
        unit_price_minor: existing.unit_price_minor,
        line_subtotal_minor: newSubtotal,
        quantity: newQuantity,
      };
    }

    // New-line path.
    let subtotal: number;
    try {
      subtotal = computeLineSubtotal(req.quantity, resolved.unit_price_minor);
    } catch (err) {
      if (err instanceof LineSubtotalError) return refuse('not_implemented');
      /* v8 ignore next */
      throw err;
    }
    const line_id = randomUUID();
    store.insertLineAndOutbox(
      {
        line_id,
        cart_id: req.cart_id,
        item_ref: req.item_ref,
        display_name: resolved.display_name,
        quantity: req.quantity,
        unit_price_minor: resolved.unit_price_minor,
        line_subtotal_minor: subtotal,
        note: null,
        last_action_id: req.idempotency_key,
        created_at: now,
      },
      {
        action_id: req.idempotency_key,
        cart_id: req.cart_id,
        line_id,
        action_kind: 'cart.line.add',
        acting_operator_id: session.operator_id,
        attribution_operator_id: null,
        operator_session_id: session.id,
        payload_json: JSON.stringify(
          scrubPayloadForOutbox({ item_ref: req.item_ref, quantity: req.quantity }),
        ),
        applied_at: now,
      },
    );
    return {
      kind: 'ok',
      line_id,
      merged: false,
      version: 1,
      display_name: resolved.display_name,
      unit_price_minor: resolved.unit_price_minor,
      line_subtotal_minor: subtotal,
      quantity: req.quantity,
    };
  }

  // ── cart.lines.update ───────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async linesUpdate(req: CartLinesUpdateRequest): Promise<CartLinesUpdateResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    // Idempotency replay (mirrors linesAdd).
    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.line.update' && replay.action_kind !== 'cart.line.remove') {
        return refuse('idempotency_payload_mismatch');
      }
      const replayLine = store.getLine(req.cart_id, req.line_id);
      if (replayLine === undefined) return refuse('idempotency_payload_mismatch');
      if (replay.action_kind === 'cart.line.remove')
        return { kind: 'ok', version: replayLine.version };
      return { kind: 'ok', version: replayLine.version };
    }

    const line = store.getLine(req.cart_id, req.line_id);
    if (line === undefined) return refuse('wrong_owner');
    if (line.removed_at !== null) return refuse('wrong_owner');
    if (line.version !== req.version) return refuse('stale_version');

    let newQty: number;
    if (req.op === 'increment') {
      const delta = req.delta ?? 1;
      if (!Number.isInteger(delta) || delta <= 0) return refuse('stale_version');
      newQty = line.quantity + delta;
    } else if (req.op === 'decrement') {
      const delta = req.delta ?? 1;
      if (!Number.isInteger(delta) || delta <= 0) return refuse('stale_version');
      newQty = line.quantity - delta;
      if (newQty <= 0) {
        // set(0) / decrement-past-zero → delegate to remove (FR-016).
        const r = this.removeLineInternal(
          req.cart_id,
          req.line_id,
          req.version,
          req.idempotency_key,
          session,
        );
        if (r.kind !== 'ok') return r;
        return { kind: 'ok', version: line.version + 1 };
      }
    } else {
      const abs = req.absolute;
      if (abs === undefined || !Number.isInteger(abs) || abs < 0) return refuse('stale_version');
      if (abs === 0) {
        const r = this.removeLineInternal(
          req.cart_id,
          req.line_id,
          req.version,
          req.idempotency_key,
          session,
        );
        if (r.kind !== 'ok') return r;
        return { kind: 'ok', version: line.version + 1 };
      }
      newQty = abs;
    }

    let newSubtotal: number;
    try {
      newSubtotal = computeLineSubtotal(newQty, line.unit_price_minor);
    } catch (err) {
      if (err instanceof LineSubtotalError) return refuse('stale_version');
      /* v8 ignore next */
      throw err;
    }

    const now = this.clock().toISOString();
    store.updateLineQuantityAndOutbox(
      {
        line_id: req.line_id,
        quantity: newQty,
        line_subtotal_minor: newSubtotal,
        last_action_id: req.idempotency_key,
        updated_at: now,
      },
      {
        action_id: req.idempotency_key,
        cart_id: req.cart_id,
        line_id: req.line_id,
        action_kind: 'cart.line.update',
        acting_operator_id: session.operator_id,
        attribution_operator_id: null,
        operator_session_id: session.id,
        payload_json: JSON.stringify(scrubPayloadForOutbox({ op: req.op, new_quantity: newQty })),
        applied_at: now,
      },
    );
    return { kind: 'ok', version: line.version + 1 };
  }

  // ── cart.lines.remove ───────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async linesRemove(req: CartLinesRemoveRequest): Promise<CartLinesRemoveResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    return this.removeLineInternal(
      req.cart_id,
      req.line_id,
      req.version,
      req.idempotency_key,
      session,
    );
  }

  private removeLineInternal(
    cart_id: string,
    line_id: string,
    version: number,
    idempotency_key: string,
    session: OperatorSessionRecord,
  ): { kind: 'ok' } | { kind: 'refused'; reason: CartRefusalReason } {
    const store = this.deps.cartStore;
    if (store === undefined) return refuse('not_implemented');

    const replay = store.getOutboxRow(idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.line.remove') {
        return refuse('idempotency_payload_mismatch');
      }
      return { kind: 'ok' };
    }

    const line = store.getLine(cart_id, line_id);
    if (line === undefined) return refuse('wrong_owner');
    if (line.removed_at !== null) {
      // Replay-equivalent: line already removed; idempotent no-op.
      return { kind: 'ok' };
    }
    if (line.version !== version) return refuse('stale_version');

    const now = this.clock().toISOString();
    store.softRemoveLineAndOutbox(
      {
        line_id,
        removed_at: now,
        last_action_id: idempotency_key,
      },
      {
        action_id: idempotency_key,
        cart_id,
        line_id,
        action_kind: 'cart.line.remove',
        acting_operator_id: session.operator_id,
        attribution_operator_id: null,
        operator_session_id: session.id,
        payload_json: JSON.stringify({}),
        applied_at: now,
      },
    );
    return { kind: 'ok' };
  }

  // ── cart.lines.setNote ──────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async linesSetNote(req: CartLinesSetNoteRequest): Promise<CartLinesSetNoteResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    // Idempotency replay.
    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.line.note_set')
        return refuse('idempotency_payload_mismatch');
      const replayLine = store.getLine(req.cart_id, req.line_id);
      if (replayLine === undefined) return refuse('idempotency_payload_mismatch');
      return { kind: 'ok', version: replayLine.version };
    }

    // Length cap (Q1: ≤200 chars). Partial overwrite is forbidden — full
    // replacement only. Bridge enforces; column is intentionally permissive.
    if (req.note !== null && req.note.length > 200) {
      return refuse('note_too_long');
    }

    // Forbidden-pattern check.
    if (req.note !== null && noteHasForbiddenPattern(req.note)) {
      return refuse('note_forbidden_pattern');
    }

    const line = store.getLine(req.cart_id, req.line_id);
    if (line === undefined) return refuse('wrong_owner');
    if (line.removed_at !== null) return refuse('wrong_owner');
    if (line.version !== req.version) return refuse('stale_version');

    const now = this.clock().toISOString();
    store.setLineNoteAndOutbox(
      {
        line_id: req.line_id,
        note: req.note,
        last_action_id: req.idempotency_key,
        updated_at: now,
      },
      {
        action_id: req.idempotency_key,
        cart_id: req.cart_id,
        line_id: req.line_id,
        action_kind: 'cart.line.note_set',
        acting_operator_id: session.operator_id,
        attribution_operator_id: null,
        operator_session_id: session.id,
        // NOTE: bridge MUST NOT echo the note value into payload_json.
        // The redaction set (T054) is the load-bearing layer; here we
        // intentionally store only the length, never the content.
        payload_json: JSON.stringify({ note_length: req.note?.length ?? 0 }),
        applied_at: now,
      },
    );
    return { kind: 'ok', version: line.version + 1 };
  }

  // ── cart.discountPlaceholders.* ─────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async discountPlaceholdersAdd(
    req: CartDiscountPlaceholdersAddRequest,
  ): Promise<CartDiscountPlaceholdersAddResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    // Threshold: percent_NN where NN > 10 is above-threshold.
    const pctMatch = /^percent_(\d+)$/.exec(req.placeholder_kind);
    const pctDigits = pctMatch?.[1] ?? null;
    const isAboveThreshold = pctDigits !== null && parseInt(pctDigits, 10) > 10;

    if (isAboveThreshold) {
      // Attribution must be present and must not be the acting cashier.
      if (
        !req.attribution_operator_id ||
        req.attribution_operator_id === session.operator_id
      ) {
        return refuse('manager_attribution_required');
      }
    }

    // Narrowed after the guard above — safe to use without assertion in the isAboveThreshold branch.
    const attributionOperatorId = req.attribution_operator_id ?? null;

    // Idempotency: the idempotency_key doubles as placeholder_id.
    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.discount_placeholder.add')
        return refuse('idempotency_payload_mismatch');
      return {
        kind: 'ok',
        placeholder_id: req.idempotency_key,
        requires_manager_attribution: isAboveThreshold,
      };
    }

    const now = this.clock().toISOString();
    const placeholder: InsertDiscountPlaceholderInput = {
      placeholder_id: req.idempotency_key,
      cart_id: req.cart_id,
      line_id: req.line_id,
      placeholder_kind: req.placeholder_kind,
      requires_manager_attribution: isAboveThreshold ? 1 : 0,
      attribution_operator_id: attributionOperatorId,
      created_at: now,
    };

    if (isAboveThreshold && attributionOperatorId !== null) {
      const event_id = randomUUID();
      store.insertDiscountPlaceholderAndOutbox(
        placeholder,
        {
          action_id: req.idempotency_key,
          cart_id: req.cart_id,
          line_id: req.line_id,
          action_kind: 'cart.discount_placeholder.add',
          acting_operator_id: session.operator_id,
          attribution_operator_id: attributionOperatorId,
          operator_session_id: session.id,
          payload_json: JSON.stringify({ cart_id: req.cart_id, cart_line_id: req.line_id }),
          applied_at: now,
        },
        () => {
          this.deps.auditEmitter?.emit({
            event_id,
            tenant_id: cart.tenant_id,
            branch_id: cart.branch_id,
            originating_terminal_id: cart.terminal_id,
            acting_operator_id: session.operator_id,
            session_id: session.id,
            shift_id: null,
            action_category: 'cart.discount.above_threshold',
            created_at: now,
            approving_supervisor_id: attributionOperatorId,
            payload: { cart_id: req.cart_id, cart_line_id: req.line_id },
          });
        },
      );
    } else {
      store.insertDiscountPlaceholderAndOutbox(placeholder, {
        action_id: req.idempotency_key,
        cart_id: req.cart_id,
        line_id: req.line_id,
        action_kind: 'cart.discount_placeholder.add',
        acting_operator_id: session.operator_id,
        attribution_operator_id: null,
        operator_session_id: session.id,
        payload_json: JSON.stringify({ cart_id: req.cart_id, cart_line_id: req.line_id }),
        applied_at: now,
      });
    }

    return {
      kind: 'ok',
      placeholder_id: req.idempotency_key,
      requires_manager_attribution: isAboveThreshold,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async discountPlaceholdersRemove(
    req: CartDiscountPlaceholdersRemoveRequest,
  ): Promise<CartDiscountPlaceholdersRemoveResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.discount_placeholder.remove')
        return refuse('idempotency_payload_mismatch');
      return { kind: 'ok' };
    }

    const placeholder = store.getDiscountPlaceholder(req.placeholder_id);
    if (placeholder === undefined) return refuse('wrong_owner');

    const now = this.clock().toISOString();
    store.removeDiscountPlaceholderAndOutbox(req.placeholder_id, {
      action_id: req.idempotency_key,
      cart_id: req.cart_id,
      line_id: placeholder.line_id,
      action_kind: 'cart.discount_placeholder.remove',
      acting_operator_id: session.operator_id,
      attribution_operator_id: null,
      operator_session_id: session.id,
      payload_json: JSON.stringify({ cart_id: req.cart_id, placeholder_id: req.placeholder_id }),
      applied_at: now,
    });

    return { kind: 'ok' };
  }

  // ── cart.void ───────────────────────────────────────────────────────

  /**
   * T067 — Pre-handoff void (any role, no audit).
   * Post-handoff cancel is `cancelPostHandoff` below.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async void(req: CartVoidRequest): Promise<CartVoidResponse> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) {
      const guard = this.gateMutatingInMem(req.cart_id);
      return guard ?? refuse('not_implemented');
    }

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    // Idempotency check before terminal state — replaying after cancel succeeds.
    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.void') return refuse('idempotency_payload_mismatch');
      return { kind: 'ok' };
    }

    // Terminal states (after idempotency so replays work on closed carts).
    const cartState = cart.state as CartState;
    if (cartState === CartState.frozen_handed_off) return refuse('frozen');
    if (cartState === CartState.cancelled) return refuse('closed');

    const now = this.clock().toISOString();
    store.cancelCartAndOutbox(
      {
        cart_id: req.cart_id,
        cancelled_at: now,
        cancellation_reason: 'cashier_voided',
        last_action_id: req.idempotency_key,
        updated_at: now,
      },
      {
        action_id: req.idempotency_key,
        cart_id: req.cart_id,
        line_id: null,
        action_kind: 'cart.void',
        acting_operator_id: session.operator_id,
        attribution_operator_id: req.attribution_operator_id ?? null,
        operator_session_id: session.id,
        payload_json: JSON.stringify(scrubPayloadForOutbox({ cart_id: req.cart_id })),
        applied_at: now,
      },
    );
    return { kind: 'ok' };
  }

  // ── cart.cancelPostHandoff ──────────────────────────────────────────

  /**
   * T067 — Post-handoff cancel (manager/admin or cashier+attribution).
   * Emits a `cart.cancel.post_handoff` audit event atomically with the
   * cancellation (FR-031/FR-033). The cart must be in `frozen_handed_off`.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async cancelPostHandoff(req: {
    cart_id: string;
    handoff_action_id: string;
    attribution_operator_id?: string;
    idempotency_key: string;
  }): Promise<{ kind: 'ok' } | { kind: 'refused'; reason: CartRefusalReason }> {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');

    if (this.deps.cartStore === undefined) return refuse('not_implemented');

    const store = this.deps.cartStore;
    const cart = store.getCart(req.cart_id);
    if (cart === undefined) return refuse('wrong_owner');

    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);

    // Cashier must supply attribution; manager/admin may act directly.
    const isManagerOrAdmin = session.role === 'manager' || session.role === 'admin';
    if (!isManagerOrAdmin && !req.attribution_operator_id) {
      return refuse('manager_attribution_required');
    }

    // Idempotency check before terminal-state guard.
    const replay = store.getOutboxRow(req.idempotency_key);
    if (replay !== undefined) {
      if (replay.action_kind !== 'cart.cancel.post_handoff')
        return refuse('idempotency_payload_mismatch');
      return { kind: 'ok' };
    }

    // Only frozen_handed_off carts may be post-handoff cancelled.
    const cancelCartState = cart.state as CartState;
    if (cancelCartState !== CartState.frozen_handed_off) return refuse('closed');

    const now = this.clock().toISOString();
    const event_id = randomUUID();
    const approvingSupervisorId = isManagerOrAdmin
      ? session.operator_id
      : (req.attribution_operator_id ?? session.operator_id);

    store.cancelCartAndOutbox(
      {
        cart_id: req.cart_id,
        cancelled_at: now,
        cancellation_reason: 'manager_voided_post_handoff',
        last_action_id: req.idempotency_key,
        updated_at: now,
      },
      {
        action_id: req.idempotency_key,
        cart_id: req.cart_id,
        line_id: null,
        action_kind: 'cart.cancel.post_handoff',
        acting_operator_id: session.operator_id,
        attribution_operator_id: req.attribution_operator_id ?? null,
        operator_session_id: session.id,
        payload_json: JSON.stringify(
          scrubPayloadForOutbox({
            cart_id: req.cart_id,
            handoff_action_id: req.handoff_action_id,
          }),
        ),
        applied_at: now,
      },
      () => {
        this.deps.auditEmitter?.emit({
          event_id,
          tenant_id: cart.tenant_id,
          branch_id: cart.branch_id,
          originating_terminal_id: cart.terminal_id,
          acting_operator_id: cart.owning_operator_id,
          session_id: session.id,
          shift_id: null,
          action_category: 'cart.cancel.post_handoff',
          created_at: now,
          approving_supervisor_id: approvingSupervisorId,
          payload: {
            cart_id: req.cart_id,
            handoff_action_id: req.handoff_action_id,
          },
        });
      },
    );
    return { kind: 'ok' };
  }

  // ── cart.handoff ────────────────────────────────────────────────────

  handoff(req: CartHandoffRequest): Promise<CartHandoffResponse> {
    return Promise.resolve(this.gateMutatingS2(req.cart_id) ?? refuse('not_implemented'));
  }

  // ── cart.subscribe ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribe(_req: CartSubscribeRequest): Promise<CartSubscribeResponse> {
    const gate = requireOperatorSession({
      session: this.deps.getCurrentSession(),
      allowedRoles: ['cashier', 'manager', 'admin'],
    });
    if (gate.kind !== 'ok') return Promise.resolve(refuse(gate.reason));
    return Promise.resolve(refuse('not_implemented'));
  }

  // ── Internal gates ──────────────────────────────────────────────────

  /** S1-compat: in-memory cart map gate (used when no DB cartStore). */
  private gateMutatingInMem(
    cart_id: string,
  ): { kind: 'refused'; reason: CartRefusalReason } | null {
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');
    const cart = this.inMemCarts.get(cart_id);
    if (cart === undefined) return refuse('wrong_owner');
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

  /** S2 DB-aware gate for handlers that aren't yet implemented (discount/void/handoff). */
  private gateMutatingS2(cart_id: string): { kind: 'refused'; reason: CartRefusalReason } | null {
    if (this.deps.cartStore === undefined) {
      return this.gateMutatingInMem(cart_id);
    }
    const session = this.deps.getCurrentSession();
    if (session === null) return refuse('no_session');
    const cart = this.deps.cartStore.getCart(cart_id);
    if (cart === undefined) return refuse('wrong_owner');
    const gate = requireOperatorSession({
      session,
      allowedRoles: ['cashier', 'manager', 'admin'],
      cart: {
        operator_session_id: cart.operator_session_id,
        tenant_id: cart.tenant_id,
        branch_id: cart.branch_id,
        state: cart.state as CartState,
      },
      requireMutable: true,
    });
    if (gate.kind !== 'ok') return refuse(gate.reason);
    return null;
  }
}
