import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/main/index.ts',
        'src/renderer/main.tsx',
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
