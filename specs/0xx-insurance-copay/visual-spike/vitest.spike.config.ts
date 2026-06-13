import { defineConfig } from 'vitest/config';

/**
 * Throwaway vitest config for the insurance co-pay VISUAL SPIKE only.
 * The project's root vitest config scopes `include` to src/ — this lets the
 * spike's math test run in place under specs/ without touching that config.
 *
 * Run from repo root:
 *   npx vitest run -c specs/0xx-insurance-copay/visual-spike/vitest.spike.config.ts
 */
export default defineConfig({
  test: {
    include: ['specs/0xx-insurance-copay/visual-spike/**/*.test.{ts,tsx}'],
    // Default env is node (pure-math test); the render test opts into happy-dom
    // via its own `@vitest-environment happy-dom` docblock.
    environment: 'node',
  },
});
