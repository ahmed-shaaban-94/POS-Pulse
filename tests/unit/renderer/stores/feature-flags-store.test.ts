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

  it('defaults payments=false (fail-closed)', () => {
    const s = useFeatureFlagsStore.getState();
    expect(s.payments).toBe(false);
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

  it('hydrate({ payments: true }) flips payments=true and hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({ payments: true });
    const s = useFeatureFlagsStore.getState();
    expect(s.payments).toBe(true);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate({ saleFinalization: true }) flips saleFinalization=true and hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({ saleFinalization: true });
    const s = useFeatureFlagsStore.getState();
    expect(s.saleFinalization).toBe(true);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate({}) leaves cart=false, payments=false, saleFinalization=false but marks hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({});
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.payments).toBe(false);
    expect(s.saleFinalization).toBe(false);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate flags are independent — cart / payments / saleFinalization toggle separately', () => {
    useFeatureFlagsStore
      .getState()
      .hydrate({ cart: true, payments: false, saleFinalization: false });
    let s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(true);
    expect(s.payments).toBe(false);
    expect(s.saleFinalization).toBe(false);

    useFeatureFlagsStore
      .getState()
      .hydrate({ cart: false, payments: true, saleFinalization: false });
    s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.payments).toBe(true);
    expect(s.saleFinalization).toBe(false);

    useFeatureFlagsStore
      .getState()
      .hydrate({ cart: false, payments: false, saleFinalization: true });
    s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.payments).toBe(false);
    expect(s.saleFinalization).toBe(true);
  });

  it('reset() returns the store to initial defaults across all flags', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true, payments: true, saleFinalization: true });
    useFeatureFlagsStore.getState().reset();
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.payments).toBe(false);
    expect(s.saleFinalization).toBe(false);
    expect(s.hydrated).toBe(false);
  });
});
