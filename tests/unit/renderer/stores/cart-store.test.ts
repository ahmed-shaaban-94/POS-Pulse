import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../../../../src/renderer/stores/cart-store.js';
import { CartState } from '../../../../src/shared/cart/cart-state.js';

beforeEach(() => {
  useCartStore.getState().reset();
});

describe('cartStore — initial state', () => {
  it('starts with no active cart', () => {
    const { activeCart } = useCartStore.getState();
    expect(activeCart).toBeNull();
  });
});

describe('cartStore — empty → editing transition', () => {
  it('applyCartCreated sets activeCart with state=empty and the given cart_id', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    const { activeCart } = useCartStore.getState();
    expect(activeCart).not.toBeNull();
    expect(activeCart?.cart_id).toBe('cart-uuid-1');
    expect(activeCart?.state).toBe(CartState.empty);
  });

  it('applyLineAdded transitions empty → editing', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.editing);
  });

  it('applyLineAdded records the line_id in the active cart', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.lastLineId).toBe('line-uuid-1');
  });
});

describe('cartStore — editing → handing_off transition', () => {
  it('applyHandoffStarted transitions editing → handing_off', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyHandoffStarted();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.handing_off);
  });
});

describe('cartStore — handing_off → frozen_handed_off transition', () => {
  it('applyFrozen transitions handing_off → frozen_handed_off', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyHandoffStarted();
    useCartStore.getState().applyFrozen();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.frozen_handed_off);
  });
});

describe('cartStore — any state → cancelled', () => {
  it('applyCancelled from empty sets state to cancelled', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyCancelled();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.cancelled);
  });

  it('applyCancelled from editing sets state to cancelled', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyCancelled();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.cancelled);
  });

  it('applyCancelled from handing_off sets state to cancelled', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyHandoffStarted();
    useCartStore.getState().applyCancelled();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.cancelled);
  });
});

describe('cartStore — terminal state guards', () => {
  it('applyLineAdded does nothing when state is frozen_handed_off', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyHandoffStarted();
    useCartStore.getState().applyFrozen();
    // Attempt to add a line after frozen — must be no-op
    useCartStore.getState().applyLineAdded('line-uuid-2');
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.frozen_handed_off);
  });

  it('applyLineAdded does nothing when state is cancelled', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyCancelled();
    useCartStore.getState().applyLineAdded('line-uuid-1');
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.cancelled);
  });

  it('applyHandoffStarted does nothing when state is cancelled', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyCancelled();
    useCartStore.getState().applyHandoffStarted();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.cancelled);
  });

  it('applyHandoffStarted does nothing when state is frozen_handed_off', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyHandoffStarted();
    useCartStore.getState().applyFrozen();
    useCartStore.getState().applyHandoffStarted();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.frozen_handed_off);
  });
});

describe('cartStore — discount_pending_attribution transitions', () => {
  it('applyDiscountAttributionRequired transitions editing → discount_pending_attribution', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyDiscountAttributionRequired();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.discount_pending_attribution);
  });

  it('applyDiscountAttributionResolved transitions discount_pending_attribution → editing', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyDiscountAttributionRequired();
    useCartStore.getState().applyDiscountAttributionResolved();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.editing);
  });
});

describe('cartStore — no activeCart guard', () => {
  it('applyLineAdded does nothing when no activeCart exists', () => {
    useCartStore.getState().applyLineAdded('line-uuid-1');
    const { activeCart } = useCartStore.getState();
    expect(activeCart).toBeNull();
  });

  it('applyHandoffStarted does nothing when no activeCart exists', () => {
    useCartStore.getState().applyHandoffStarted();
    const { activeCart } = useCartStore.getState();
    expect(activeCart).toBeNull();
  });

  it('applyCancelled does nothing when no activeCart exists', () => {
    useCartStore.getState().applyCancelled();
    const { activeCart } = useCartStore.getState();
    expect(activeCart).toBeNull();
  });
});

describe('cartStore — reset', () => {
  it('reset clears activeCart', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().reset();
    const { activeCart } = useCartStore.getState();
    expect(activeCart).toBeNull();
  });
});

describe('cartStore — applyLineAdded while already editing (branch coverage)', () => {
  it('updates lastLineId when a second line is added in editing state', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-2');
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.editing);
    expect(activeCart?.lastLineId).toBe('line-uuid-2');
  });
});

describe('cartStore — invalid transition no-ops (branch coverage for transition() null path)', () => {
  it('applyDiscountAttributionRequired is no-op when state is not editing', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    // empty state → discount_pending_attribution is invalid
    useCartStore.getState().applyDiscountAttributionRequired();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.empty);
  });

  it('applyDiscountAttributionResolved is no-op when state is not discount_pending_attribution', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    // editing → editing via resolved is invalid per FSM (no self-transition)
    useCartStore.getState().applyDiscountAttributionResolved();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.editing);
  });

  it('applyFrozen is no-op when state is not handing_off', () => {
    useCartStore.getState().applyCartCreated('cart-uuid-1');
    useCartStore.getState().applyLineAdded('line-uuid-1');
    // editing → frozen_handed_off is invalid per FSM
    useCartStore.getState().applyFrozen();
    const { activeCart } = useCartStore.getState();
    expect(activeCart?.state).toBe(CartState.editing);
  });

  it('applyDiscountAttributionRequired is no-op when no activeCart', () => {
    useCartStore.getState().applyDiscountAttributionRequired();
    expect(useCartStore.getState().activeCart).toBeNull();
  });

  it('applyDiscountAttributionResolved is no-op when no activeCart', () => {
    useCartStore.getState().applyDiscountAttributionResolved();
    expect(useCartStore.getState().activeCart).toBeNull();
  });

  it('applyFrozen is no-op when no activeCart', () => {
    useCartStore.getState().applyFrozen();
    expect(useCartStore.getState().activeCart).toBeNull();
  });
});
