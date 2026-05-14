export type CartRefusalReason =
  | 'no_session'
  | 'role_denied'
  | 'wrong_owner'
  | 'tenant_isolation'
  | 'frozen'
  | 'closed'
  | 'stale_version'
  | 'empty_cart'
  | 'note_too_long'
  | 'note_forbidden_pattern'
  | 'manager_attribution_required'
  | 'idempotency_payload_mismatch'
  | 'not_implemented';

export interface CartRefusal {
  readonly kind: 'refused';
  readonly reason: CartRefusalReason;
}
