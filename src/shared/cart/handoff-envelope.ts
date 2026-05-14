export interface LineSnapshot {
  readonly line_id: string;
  readonly item_ref: string;
  readonly display_name: string;
  readonly quantity: number;
  readonly unit_price_minor: number;
  readonly line_subtotal_minor: number;
  readonly note: string | null;
  readonly version: number;
  readonly last_action_id: string;
}

export interface DiscountPlaceholderSnapshot {
  readonly placeholder_id: string;
  readonly line_id: string;
  readonly placeholder_kind: string;
  readonly requires_manager_attribution: boolean;
  readonly attribution_operator_id: string | null;
}

export interface PaymentIntentEnvelope {
  readonly envelope_version: 'v1';
  readonly cart_id: string;
  readonly operator_session_id: string;
  readonly owning_operator_id: string;
  readonly tenant_id: string;
  readonly branch_id: string;
  readonly terminal_id: string;
  readonly lines: readonly LineSnapshot[];
  readonly discount_placeholders: readonly DiscountPlaceholderSnapshot[];
  readonly subtotal_minor: number;
  readonly created_at: string;
  readonly handoff_action_id: string;
}

/**
 * Recursively applies Object.freeze to the envelope, all line snapshots,
 * and all discount placeholder snapshots. Object.freeze is shallow, so
 * this function walks every nested array and object.
 */
export function freezeEnvelope(envelope: PaymentIntentEnvelope): Readonly<PaymentIntentEnvelope> {
  for (const line of envelope.lines) {
    Object.freeze(line);
  }
  Object.freeze(envelope.lines);

  for (const placeholder of envelope.discount_placeholders) {
    Object.freeze(placeholder);
  }
  Object.freeze(envelope.discount_placeholders);

  return Object.freeze(envelope);
}
