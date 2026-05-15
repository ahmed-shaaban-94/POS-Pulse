/**
 * 004-operator-session T049 — Per-action-category payload schemas.
 *
 * Type-only definitions for the `payload` field of each `AuditEvent`
 * action category (data-model.md §"Action Category Catalogue").
 *
 * Rules (FR-027 / PR-1):
 *   - PIN values MUST NEVER appear in any payload field.
 *   - Raw cardholder data, full PII, credential fragments, and session
 *     tokens MUST NEVER appear in any payload field.
 *   - The emitter (T046, S3) enforces these rules at the bridge-handler
 *     insertion point; these types are the structural complement.
 *
 * The §A1-gated categories (`cashier.pin.reset`, `cashier.pin.unlock`)
 * ship here as types only; their handlers land in S4.
 */

import type { SessionEndCause } from '../operator/session-end-cause.js';
import type { ActionCategory } from './event-shape.js';

// ─── shift.open ────────────────────────────────────────────────────────────

export interface ShiftOpenPayload {
  /** FK into shifts table. */
  shift_id: string;
  /** ISO 8601 UTC timestamp the shift was opened. */
  opened_at: string;
}

// ─── shift.close ───────────────────────────────────────────────────────────

export interface ShiftClosePayload {
  /** FK into shifts table. */
  shift_id: string;
  /** ISO 8601 UTC timestamp the shift was closed. */
  closed_at: string;
  /**
   * Whether the cashier entered a numeric count or used the
   * "matched" shortcut. The actual integer value lives on the Shift
   * row (drawer-math field), not in the audit payload — the audit
   * records only *that* a close happened and which declaration mode
   * was used (FR-024 blind-close discipline).
   */
  declared_count_state: 'numeric' | 'matched';
}

// ─── shift.forced_close ────────────────────────────────────────────────────

export const FORCED_CLOSE_REASONS = [
  'takeover_supersession',
  'cashier_no_show',
  'cashier_illness',
  'terminal_failure',
  'other',
] as const;
export type ForcedCloseReason = (typeof FORCED_CLOSE_REASONS)[number];

export interface ShiftForcedClosePayload {
  /** FK into shifts table. */
  shift_id: string;
  /** Clerk user id of the absent cashier whose shift is being closed. */
  shift_owner_id: string;
  /**
   * Clerk user id of the executing manager / admin.
   * Mirrors `acting_operator_id` on the AuditEvent envelope; duplicated
   * here so the payload is self-contained for the SC-005 review.
   */
  forced_close_actor_id: string;
  /** Structured reason — MUST be set; free-text annotation is a supplement, not a replacement. */
  forced_close_reason: ForcedCloseReason;
  /**
   * Optional free-text annotation for support context. MUST NOT
   * contain PIN values, credential fragments, or raw PII (PR-1 /
   * FR-027). The emitter validates forbidden field names.
   */
  annotation?: string;
}

// ─── operator.session.takeover ─────────────────────────────────────────────

export interface OperatorSessionTakeoverPayload {
  /** Session id of the session that was superseded on the prior terminal. */
  superseded_session_id: string;
  /**
   * Opaque internal reference to the prior terminal. MUST NOT be a
   * user-visible terminal label — only an internal id (FR-013 minimum-
   * disclosure guarantee). The renderer MUST NOT receive or display this.
   */
  prior_terminal_reference: string;
}

// ─── cashier.pin.reset (§A1-gated; handler lands in S4) ───────────────────

export interface CashierPinResetPayload {
  /** Clerk user id of the cashier whose PIN is being reset. */
  target_cashier_id: string;
  /** Terminal id on which the PIN record lives (PR-4 per-terminal scope). */
  terminal_id: string;
  // PIN value MUST NEVER appear here (PR-1 / FR-027).
  [key: string]: unknown;
}

// ─── cashier.pin.unlock (§A1-gated; handler lands in S4) ──────────────────

export interface CashierPinUnlockPayload {
  /** Clerk user id of the locked-out cashier being unlocked. */
  target_cashier_id: string;
  /** Terminal id on which the lockout state lives (PR-4 per-terminal scope). */
  terminal_id: string;
  // PIN value MUST NEVER appear here (PR-1 / FR-027).
  [key: string]: unknown;
}

// ─── 005-sales-cart §A3 categories (type-only; emitters land in S3) ──────

/**
 * `cart.handoff_to_payment` — emitted when a draft cart hands off to the
 * future payment / checkout feature (spec FR-026, AC #6). Manager
 * attribution is NOT required for the handoff itself; the cashier
 * attribution lives on the AuditEvent envelope. Subtotal is in integer
 * minor units (NFR-002); the emitter MUST enforce `Number.isSafeInteger`.
 */
export interface CartHandoffToPaymentPayload {
  /** FK into carts table. */
  cart_id: string;
  /** UUID v4 of the cart_action_outbox row whose action_kind = cart.handoff_to_payment. */
  handoff_action_id: string;
  /** Non-negative count of non-removed cart lines at handoff. */
  line_count: number;
  /** Integer minor units; MUST satisfy Number.isSafeInteger at emit time. */
  subtotal_minor: number;
}

/**
 * `cart.cancel.post_handoff` — manager-attributed cancellation of a cart
 * that has already entered `handed_off_to_payment` (spec FR-033). The
 * cashier is the requester (envelope `acting_operator_id`); the manager
 * is the approver (envelope `approving_supervisor_id`).
 */
export interface CartCancelPostHandoffPayload {
  /** FK into carts table. */
  cart_id: string;
  /** UUID of the prior `cart.handoff_to_payment` outbox row this cancel reverses. */
  handoff_action_id: string;
}

/**
 * `cart.discount.above_threshold` — manager-attributed discount placeholder
 * whose magnitude exceeds the Q2 tenant-configured threshold (spec FR-023).
 * The cart layer records only the placeholder; the discounted amount is
 * computed by the future payment / checkout feature. The cashier is the
 * requester; the manager is the approver (envelope `approving_supervisor_id`).
 */
export interface CartDiscountAboveThresholdPayload {
  /** FK into carts table. */
  cart_id: string;
  /** FK into cart_lines table — the line bearing the discount placeholder. */
  cart_line_id: string;
}

/**
 * `cart.discarded_on_session_end` — fires when Q3 policy (a) discards a
 * draft cart on session end (spec Q5 LOCKED 2026-05-14). Non-attributed
 * lifecycle event; the cashier whose session is ending is the
 * `acting_operator_id` on the envelope. `discard_cause` reuses the
 * canonical operator-session end-cause union so the discard reason and
 * the session end cause stay in lockstep.
 */
export interface CartDiscardedOnSessionEndPayload {
  /** FK into carts table. */
  cart_id: string;
  /** Session id whose end triggered the discard. */
  operator_session_id: string;
  /** Reuses the canonical operator-session end-cause union. */
  discard_cause: SessionEndCause;
}

// ─── Discriminated map (ActionCategory → payload type) ────────────────────

/**
 * Maps every `ActionCategory` to its typed payload shape.
 * Consumers use this as `AuditPayloadMap[ActionCategory]` to derive
 * the correct payload type for a given category.
 *
 * Extend this map (and `ActionCategory` in event-shape.ts) when future
 * features introduce new audit categories. MUST NOT shrink the existing
 * entries (FR-026 — catalogue is append-only).
 */
export type AuditPayloadMap = {
  'shift.open': ShiftOpenPayload;
  'shift.close': ShiftClosePayload;
  'shift.forced_close': ShiftForcedClosePayload;
  'operator.session.takeover': OperatorSessionTakeoverPayload;
  'cashier.pin.reset': CashierPinResetPayload;
  'cashier.pin.unlock': CashierPinUnlockPayload;
  // 005-sales-cart §A3 (FR-026 / Q5)
  'cart.handoff_to_payment': CartHandoffToPaymentPayload;
  'cart.cancel.post_handoff': CartCancelPostHandoffPayload;
  'cart.discount.above_threshold': CartDiscountAboveThresholdPayload;
  'cart.discarded_on_session_end': CartDiscardedOnSessionEndPayload;
};

// Compile-time assertions: AuditPayloadMap and ActionCategory are in sync.
// If a new category is added to ActionCategory without updating this map,
// or vice-versa, TypeScript will surface a type error on one of these lines.
type _AssertMapCoversCategory =
  AuditPayloadMap extends Record<ActionCategory, unknown> ? true : false;
type _AssertCategoryCoversMap = keyof AuditPayloadMap extends ActionCategory ? true : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _m: _AssertMapCoversCategory = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _c: _AssertCategoryCoversMap = true;
