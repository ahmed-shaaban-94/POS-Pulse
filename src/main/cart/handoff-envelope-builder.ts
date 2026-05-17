/**
 * 005-sales-cart T087 — PaymentIntentEnvelope builder.
 *
 * Collects non-removed lines and all discount placeholders from the cart store,
 * computes subtotal_minor as the integer sum of non-removed line_subtotal_minor
 * values, and returns a frozen PaymentIntentEnvelope v1.
 *
 * SECURITY:
 * - No session credentials, PINs, or sensitive payload fragments are written
 *   into the envelope.
 * - subtotal_minor is guarded by Number.isSafeInteger before construction.
 */

import type { CartStore, CartLineRow, DiscountPlaceholderRow } from './cart-store.js';
import type { OperatorSessionRecord } from '../operator/session-manager.js';
import {
  freezeEnvelope,
  type PaymentIntentEnvelope,
  type LineSnapshot,
  type DiscountPlaceholderSnapshot,
} from '../../shared/cart/handoff-envelope.js';

export interface BuildEnvelopeParams {
  cart_id: string;
  handoff_action_id: string;
  session: OperatorSessionRecord;
  /** Branch/terminal identifier (sourced from cart row, not session). */
  terminal_id: string;
  tenant_id: string;
  branch_id: string;
  created_at: string;
  store: CartStore;
}

export interface BuildEnvelopeResult {
  readonly kind: 'ok';
  readonly envelope: Readonly<PaymentIntentEnvelope>;
  readonly line_count: number;
}

export type BuildEnvelopeFailure =
  | { readonly kind: 'empty_cart' }
  | { readonly kind: 'subtotal_unsafe' };

/**
 * Builds and freezes a PaymentIntentEnvelope v1 from the current cart state.
 *
 * Returns a failure discriminant if:
 * - No non-removed lines exist (empty_cart)
 * - subtotal_minor overflows Number.isSafeInteger (subtotal_unsafe)
 *
 * The caller is responsible for providing only non-removed lines (via store
 * query); this function re-filters to be defensive.
 */
export function buildPaymentIntentEnvelope(
  params: BuildEnvelopeParams,
): BuildEnvelopeResult | BuildEnvelopeFailure {
  const {
    cart_id,
    handoff_action_id,
    session,
    terminal_id,
    tenant_id,
    branch_id,
    created_at,
    store,
  } = params;

  // Collect all non-removed lines for this cart.
  const allLines = store.getActiveLines(cart_id);
  if (allLines.length === 0) {
    return { kind: 'empty_cart' };
  }

  // Compute subtotal_minor as integer sum.
  let subtotal = 0;
  for (const line of allLines) {
    subtotal += line.line_subtotal_minor;
  }
  if (!Number.isSafeInteger(subtotal)) {
    return { kind: 'subtotal_unsafe' };
  }

  // Build line snapshots.
  const lines: LineSnapshot[] = allLines.map(
    (line: CartLineRow): LineSnapshot => ({
      line_id: line.line_id,
      item_ref: line.item_ref,
      display_name: line.display_name,
      quantity: line.quantity,
      unit_price_minor: line.unit_price_minor,
      line_subtotal_minor: line.line_subtotal_minor,
      note: line.note,
      version: line.version,
      last_action_id: line.last_action_id,
    }),
  );

  // Collect discount placeholders for this cart.
  const rawPlaceholders = store.getDiscountPlaceholdersForCart(cart_id);
  const discount_placeholders: DiscountPlaceholderSnapshot[] = rawPlaceholders.map(
    (ph: DiscountPlaceholderRow): DiscountPlaceholderSnapshot => ({
      placeholder_id: ph.placeholder_id,
      line_id: ph.line_id,
      placeholder_kind: ph.placeholder_kind,
      requires_manager_attribution: ph.requires_manager_attribution !== 0,
      attribution_operator_id: ph.attribution_operator_id,
    }),
  );

  const envelope: PaymentIntentEnvelope = {
    envelope_version: 'v1',
    cart_id,
    operator_session_id: session.id,
    owning_operator_id: session.operator_id,
    tenant_id,
    branch_id,
    terminal_id,
    lines,
    discount_placeholders,
    subtotal_minor: subtotal,
    created_at,
    handoff_action_id,
  };

  return {
    kind: 'ok',
    envelope: freezeEnvelope(envelope),
    line_count: allLines.length,
  };
}
