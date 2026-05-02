import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // T051: scripts/__tests__/* contains codegen tooling tests; add the
    // pattern so vitest collects them.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/main/index.ts',
        'src/renderer/main.tsx',
        // Phase 8: preload is a thin contextBridge wire-up file with no
        // logic worth unit-testing; correctness is proven by the
        // bridge-typing test and the manual Electron smoke. Same posture
        // as src/main/index.ts.
        'src/preload/index.ts',
        // T055 generated file: pure types, no runtime — coverage of it
        // is meaningless and would always show 0/0.
        'src/shared/api-types.ts',
        // Phase 8: type-only ambient declaration for pino-roll.
        'src/main/logging/pino-roll.d.ts',
        'node_modules/**',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        // T058 — Money module strict gate per Constitution II + spec NFR-2.
        // Vitest v4.1 per-glob thresholds layer on top of the globals; this
        // entry raises the bar to ≥95% on src/shared/money.ts only.
        'src/shared/money.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
});
