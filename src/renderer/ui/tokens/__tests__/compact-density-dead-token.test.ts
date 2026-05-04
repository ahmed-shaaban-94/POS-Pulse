import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * T009 — Compact-density dead-token guard.
 *
 * Parses the source tree under src/renderer/ (TS + TSX + CSS) and asserts
 * every reference to density.compact (or the string literal 'compact' typed
 * as Density) lives in exactly two files:
 *   1. src/renderer/ui/tokens/density.ts
 *   2. src/renderer/ui/tokens/__tests__/tokens.test.ts
 *
 * Any third reference is a build failure.
 * (Plan Test Strategy + design-tokens contract §"Density".)
 */

const SRC_ROOT = resolve(__dirname, '../../../');

function collectFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      result.push(...collectFiles(full));
    } else if (['.ts', '.tsx', '.css'].includes(extname(entry))) {
      result.push(full);
    }
  }
  return result;
}

const AUTHORISED_SUFFIXES = [
  'ui/tokens/density.ts',
  'ui/tokens/__tests__/tokens.test.ts',
  // This guard file itself is authorised (it references 'compact' as a string in comments)
  'ui/tokens/__tests__/compact-density-dead-token.test.ts',
];

const COMPACT_PATTERN = /density\.compact\b|['"]compact['"]/g;

describe('compact-density dead-token guard (T009)', () => {
  it('density.compact is only referenced in the two authorised files', () => {
    const files = collectFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const relPath = file.replace(SRC_ROOT, 'src/renderer/').replace(/\\/g, '/');
      const isAuthorised = AUTHORISED_SUFFIXES.some((suffix) => relPath.endsWith(suffix));
      if (isAuthorised) continue;

      const content = readFileSync(file, 'utf-8');
      const matches = content.match(COMPACT_PATTERN);
      if (matches) {
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }

    expect(
      violations,
      `density.compact referenced outside the two authorised files:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
