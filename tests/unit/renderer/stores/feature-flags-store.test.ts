import { afterEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '../../../../src/renderer/stores/feature-flags-store.js';

afterEach(() => {
  useFeatureFlagsStore.getState().reset();
});

describe('feature-flags-store', () => {
  it('defaults cart=false and hydrated=false', () => {
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.hydrated).toBe(false);
  });

  it('defaults saleFinalization=false (fail-closed)', () => {
    const s = useFeatureFlagsStore.getState();
    expect(s.saleFinalization).toBe(false);
  });

  it('hydrate({ cart: true }) flips cart=true and hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true });
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(true);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate({ saleFinalization: true }) flips saleFinalization=true and hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({ saleFinalization: true });
    const s = useFeatureFlagsStore.getState();
    expect(s.saleFinalization).toBe(true);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate({}) leaves cart=false and saleFinalization=false but marks hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({});
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.saleFinalization).toBe(false);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate flags are independent — cart and saleFinalization toggle separately', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true, saleFinalization: false });
    let s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(true);
    expect(s.saleFinalization).toBe(false);

    useFeatureFlagsStore.getState().hydrate({ cart: false, saleFinalization: true });
    s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.saleFinalization).toBe(true);
  });

  it('reset() returns the store to initial defaults across all flags', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true, saleFinalization: true });
    useFeatureFlagsStore.getState().reset();
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.saleFinalization).toBe(false);
    expect(s.hydrated).toBe(false);
  });
});
