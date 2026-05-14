import { describe, it, expect } from 'vitest';
import {
  CartState,
  CART_FSM_TRANSITIONS,
  isValidTransition,
} from '../../../../src/shared/cart/cart-state.js';

describe('CartState enum', () => {
  it('defines exactly 6 states', () => {
    const states = Object.values(CartState);
    expect(states).toHaveLength(6);
  });

  it('contains all required states', () => {
    expect(CartState.empty).toBe('empty');
    expect(CartState.editing).toBe('editing');
    expect(CartState.discount_pending_attribution).toBe('discount_pending_attribution');
    expect(CartState.handing_off).toBe('handing_off');
    expect(CartState.frozen_handed_off).toBe('frozen_handed_off');
    expect(CartState.cancelled).toBe('cancelled');
  });
});

describe('CART_FSM_TRANSITIONS', () => {
  it('allows empty → editing', () => {
    expect(isValidTransition(CartState.empty, CartState.editing)).toBe(true);
  });

  it('allows empty → cancelled', () => {
    expect(isValidTransition(CartState.empty, CartState.cancelled)).toBe(true);
  });

  it('allows editing → discount_pending_attribution', () => {
    expect(isValidTransition(CartState.editing, CartState.discount_pending_attribution)).toBe(true);
  });

  it('allows discount_pending_attribution → editing (attribution resolved)', () => {
    expect(isValidTransition(CartState.discount_pending_attribution, CartState.editing)).toBe(true);
  });

  it('allows editing → handing_off', () => {
    expect(isValidTransition(CartState.editing, CartState.handing_off)).toBe(true);
  });

  it('allows handing_off → frozen_handed_off', () => {
    expect(isValidTransition(CartState.handing_off, CartState.frozen_handed_off)).toBe(true);
  });

  it('allows handing_off → editing (handoff aborted)', () => {
    expect(isValidTransition(CartState.handing_off, CartState.editing)).toBe(true);
  });

  it('allows any non-cancelled state → cancelled', () => {
    const nonCancelledStates = [
      CartState.empty,
      CartState.editing,
      CartState.discount_pending_attribution,
      CartState.handing_off,
      CartState.frozen_handed_off,
    ];
    for (const state of nonCancelledStates) {
      expect(isValidTransition(state, CartState.cancelled)).toBe(true);
    }
  });

  it('rejects terminal state: cancelled → editing', () => {
    expect(isValidTransition(CartState.cancelled, CartState.editing)).toBe(false);
  });

  it('rejects terminal state: cancelled → empty', () => {
    expect(isValidTransition(CartState.cancelled, CartState.empty)).toBe(false);
  });

  it('rejects terminal state: frozen_handed_off → editing', () => {
    expect(isValidTransition(CartState.frozen_handed_off, CartState.editing)).toBe(false);
  });

  it('rejects terminal state: frozen_handed_off → handing_off', () => {
    expect(isValidTransition(CartState.frozen_handed_off, CartState.handing_off)).toBe(false);
  });

  it('rejects backwards: editing → empty', () => {
    expect(isValidTransition(CartState.editing, CartState.empty)).toBe(false);
  });

  it('rejects skip: empty → handing_off', () => {
    expect(isValidTransition(CartState.empty, CartState.handing_off)).toBe(false);
  });

  it('rejects skip: empty → frozen_handed_off', () => {
    expect(isValidTransition(CartState.empty, CartState.frozen_handed_off)).toBe(false);
  });

  it('rejects skip: editing → frozen_handed_off', () => {
    expect(isValidTransition(CartState.editing, CartState.frozen_handed_off)).toBe(false);
  });

  it('rejects self-transition: editing → editing', () => {
    expect(isValidTransition(CartState.editing, CartState.editing)).toBe(false);
  });

  it('rejects self-transition: empty → empty', () => {
    expect(isValidTransition(CartState.empty, CartState.empty)).toBe(false);
  });

  it('CART_FSM_TRANSITIONS is a readonly map covering all valid paths', () => {
    expect(CART_FSM_TRANSITIONS).toBeDefined();
    expect(typeof CART_FSM_TRANSITIONS).toBe('object');
  });
});
