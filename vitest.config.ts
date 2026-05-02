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
        // T055 generated file: pure types, no runtime — coverage of it
        // is meaningless and would always show 0/0.
        'src/shared/api-types.ts',
        'node_modules/**',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        // src/shared/money.ts gate: ≥95% enforced by T056-T058 (Phase 7)
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
