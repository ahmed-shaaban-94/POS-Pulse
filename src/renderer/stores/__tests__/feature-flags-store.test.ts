import { afterEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '../feature-flags-store.js';

afterEach(() => {
  useFeatureFlagsStore.getState().reset();
});

describe('feature-flags-store — productSearch (009 T049a)', () => {
  it('defaults productSearch to false (fail-closed)', () => {
    expect(useFeatureFlagsStore.getState().productSearch).toBe(false);
  });

  it('hydrates productSearch from the flag map', () => {
    useFeatureFlagsStore.getState().hydrate({ productSearch: true });
    expect(useFeatureFlagsStore.getState().productSearch).toBe(true);
  });

  it('hydrate without productSearch leaves it false', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true });
    expect(useFeatureFlagsStore.getState().productSearch).toBe(false);
  });

  it('reset restores productSearch to false', () => {
    useFeatureFlagsStore.getState().hydrate({ productSearch: true });
    useFeatureFlagsStore.getState().reset();
    expect(useFeatureFlagsStore.getState().productSearch).toBe(false);
  });
});
