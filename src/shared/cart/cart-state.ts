export enum CartState {
  empty = 'empty',
  editing = 'editing',
  discount_pending_attribution = 'discount_pending_attribution',
  handing_off = 'handing_off',
  frozen_handed_off = 'frozen_handed_off',
  cancelled = 'cancelled',
}

/**
 * Allowed FSM transitions: Map<from, Set<to>>.
 * Terminal states (cancelled, frozen_handed_off) have no outbound edges
 * except that any state can transition to cancelled.
 */
export const CART_FSM_TRANSITIONS: Readonly<Record<CartState, ReadonlySet<CartState>>> = {
  [CartState.empty]: new Set([CartState.editing, CartState.cancelled]),
  [CartState.editing]: new Set([
    CartState.discount_pending_attribution,
    CartState.handing_off,
    CartState.cancelled,
  ]),
  [CartState.discount_pending_attribution]: new Set([CartState.editing, CartState.cancelled]),
  [CartState.handing_off]: new Set([CartState.frozen_handed_off, CartState.editing, CartState.cancelled]),
  [CartState.frozen_handed_off]: new Set([CartState.cancelled]),
  [CartState.cancelled]: new Set(),
};

export function isValidTransition(from: CartState, to: CartState): boolean {
  return CART_FSM_TRANSITIONS[from].has(to);
}
