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

  it('hydrate({ cart: true }) flips cart=true and hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true });
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(true);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate({}) leaves cart=false but marks hydrated=true', () => {
    useFeatureFlagsStore.getState().hydrate({});
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.hydrated).toBe(true);
  });

  it('reset() returns the store to initial defaults', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true });
    useFeatureFlagsStore.getState().reset();
    const s = useFeatureFlagsStore.getState();
    expect(s.cart).toBe(false);
    expect(s.hydrated).toBe(false);
  });
});
