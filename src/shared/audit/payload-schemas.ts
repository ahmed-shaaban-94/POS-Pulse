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
}

// ─── cashier.pin.unlock (§A1-gated; handler lands in S4) ──────────────────

export interface CashierPinUnlockPayload {
  /** Clerk user id of the locked-out cashier being unlocked. */
  target_cashier_id: string;
  /** Terminal id on which the lockout state lives (PR-4 per-terminal scope). */
  terminal_id: string;
  // PIN value MUST NEVER appear here (PR-1 / FR-027).
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
