import type { CartRefusal } from './refusal.js';
import type { PaymentIntentEnvelope } from './handoff-envelope.js';

// ── cart.create ───────────────────────────────────────────────────────────────

export interface CartCreateRequest {
  readonly idempotency_key: string;
}

export type CartCreateResponse =
  | { readonly kind: 'ok'; readonly cart_id: string }
  | CartRefusal;

// ── cart.lines.add ────────────────────────────────────────────────────────────

export interface CartLinesAddRequest {
  readonly cart_id: string;
  readonly item_ref: string;
  readonly quantity: number;
  readonly idempotency_key: string;
}

export type CartLinesAddResponse =
  | { readonly kind: 'ok'; readonly line_id: string; readonly merged: boolean; readonly version: number }
  | CartRefusal;

// ── cart.lines.update ─────────────────────────────────────────────────────────

export interface CartLinesUpdateRequest {
  readonly cart_id: string;
  readonly line_id: string;
  readonly op: 'increment' | 'decrement' | 'set';
  readonly delta?: number;
  readonly absolute?: number;
  readonly version: number;
  readonly idempotency_key: string;
}

export type CartLinesUpdateResponse =
  | { readonly kind: 'ok'; readonly version: number }
  | CartRefusal;

// ── cart.lines.remove ─────────────────────────────────────────────────────────

export interface CartLinesRemoveRequest {
  readonly cart_id: string;
  readonly line_id: string;
  readonly version: number;
  readonly idempotency_key: string;
}

export type CartLinesRemoveResponse =
  | { readonly kind: 'ok' }
  | CartRefusal;

// ── cart.lines.setNote ────────────────────────────────────────────────────────

export interface CartLinesSetNoteRequest {
  readonly cart_id: string;
  readonly line_id: string;
  readonly note: string | null;
  readonly version: number;
  readonly idempotency_key: string;
}

export type CartLinesSetNoteResponse =
  | { readonly kind: 'ok'; readonly version: number }
  | CartRefusal;

// ── cart.discountPlaceholders.add ─────────────────────────────────────────────

export interface CartDiscountPlaceholdersAddRequest {
  readonly cart_id: string;
  readonly line_id: string;
  readonly placeholder_kind: string;
  readonly attribution_operator_id?: string;
  readonly idempotency_key: string;
}

export type CartDiscountPlaceholdersAddResponse =
  | { readonly kind: 'ok'; readonly placeholder_id: string; readonly requires_manager_attribution: boolean }
  | CartRefusal;

// ── cart.discountPlaceholders.remove ──────────────────────────────────────────

export interface CartDiscountPlaceholdersRemoveRequest {
  readonly cart_id: string;
  readonly placeholder_id: string;
  readonly attribution_operator_id?: string;
  readonly idempotency_key: string;
}

export type CartDiscountPlaceholdersRemoveResponse =
  | { readonly kind: 'ok' }
  | CartRefusal;

// ── cart.void ─────────────────────────────────────────────────────────────────

export interface CartVoidRequest {
  readonly cart_id: string;
  readonly attribution_operator_id?: string;
  readonly idempotency_key: string;
}

export type CartVoidResponse =
  | { readonly kind: 'ok' }
  | CartRefusal;

// ── cart.handoff ──────────────────────────────────────────────────────────────

export interface CartHandoffRequest {
  readonly cart_id: string;
  readonly per_line_versions: ReadonlyArray<{ readonly line_id: string; readonly version: number }>;
  readonly idempotency_key: string;
}

export type CartHandoffResponse =
  | { readonly kind: 'ok'; readonly envelope: PaymentIntentEnvelope }
  | CartRefusal;

// ── cart.subscribe ────────────────────────────────────────────────────────────

export interface CartSubscribeRequest {
  readonly cart_id: string;
}

export interface CartSubscribeUpdate {
  readonly cart_id: string;
  readonly state: string;
  readonly last_action_id: string;
}

export type CartSubscribeResponse =
  | { readonly kind: 'ok'; readonly update: CartSubscribeUpdate }
  | CartRefusal;
