import { create } from 'zustand';

/**
 * 005-sales-cart T001 — renderer-side feature flags store.
 *
 * Mirrors `AppConfig.features` (`src/shared/app-config.ts`). Populated
 * once at renderer boot from `window.api.appConfig()`; never mutated
 * afterwards in production. Test-only `set` is exposed for unit/integration
 * tests via `useFeatureFlagsStore.setState({ ... })`.
 *
 * Defaults are fail-closed — every flag starts as `false`. The cart flag
 * enables CartPane in 003's reserved cart slot. Flipping it in production
 * is a §A5 sign-off.
 */
export interface FeatureFlagsState {
  cart: boolean;
  /** Whether the flag map has been hydrated from main (vs. boot defaults). */
  hydrated: boolean;
}

export interface FeatureFlagsStore extends FeatureFlagsState {
  hydrate(flags: { cart?: boolean }): void;
  reset(): void;
}

const INITIAL: FeatureFlagsState = {
  cart: false,
  hydrated: false,
};

export const useFeatureFlagsStore = create<FeatureFlagsStore>((set) => ({
  ...INITIAL,
  hydrate: (flags) => {
    set({
      cart: flags.cart === true,
      hydrated: true,
    });
  },
  reset: () => {
    set({ ...INITIAL });
  },
}));
