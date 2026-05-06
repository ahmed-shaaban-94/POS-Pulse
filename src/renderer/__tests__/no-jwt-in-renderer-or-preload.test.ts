import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * 004-operator-session — no-JWT-in-renderer-or-preload guard.
 *
 * Wave 1 path (b) invariant: the Clerk JWT is acquired in the main
 * process and held there. It NEVER crosses the preload bridge to the
 * renderer. This static guard asserts that no source file under
 * `src/renderer/` or `src/preload/` references JWT-shaped vocabulary
 * — `jwt`, `Bearer`, `clerk_jwt`, `clerk_session_token`,
 * `Authorization` (case-insensitive on the latter only — the others
 * are deliberately case-sensitive so we don't false-positive on a
 * future `JwtError` import path).
 *
 * The bridge-api type contract (`OperatorSessionBridgeView`) has no
 * JWT field by construction — this test is the cross-file
 * regression gate.
 */

const RENDERER_ROOT = resolve(__dirname, '../');
const PRELOAD_ROOT = resolve(__dirname, '../../preload/');

function collectFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      result.push(...collectFiles(full));
    } else if (
      ['.ts', '.tsx'].includes(extname(entry)) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      result.push(full);
    }
  }
  return result;
}

const FORBIDDEN_PATTERNS = [
  /\bjwt\b/, // case-sensitive — `Jwt` / `JWT` allowed (e.g., a future `JwtError` import)
  /\bBearer\b/,
  /\bclerk_jwt\b/i,
  /\bclerk_session_token\b/i,
  /\bAuthorization\b/i,
] as const;

function violationsFor(file: string): string[] {
  const content = readFileSync(file, 'utf-8');
  const found: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const m = content.match(pattern);
    if (m !== null) {
      found.push(
        `${file.replace(RENDERER_ROOT, 'src/renderer/').replace(PRELOAD_ROOT, 'src/preload/')}: ${m[0]}`,
      );
    }
  }
  return found;
}

describe('no-JWT-in-renderer-or-preload guard (004 PR-1)', () => {
  it('zero JWT-shaped references in src/renderer/', () => {
    const files = collectFiles(RENDERER_ROOT);
    const violations: string[] = [];
    for (const file of files) {
      violations.push(...violationsFor(file));
    }
    expect(violations, `JWT-shaped references in renderer:\n${violations.join('\n')}`).toEqual([]);
  });

  it('zero JWT-shaped references in src/preload/', () => {
    const files = collectFiles(PRELOAD_ROOT);
    const violations: string[] = [];
    for (const file of files) {
      violations.push(...violationsFor(file));
    }
    expect(violations, `JWT-shaped references in preload:\n${violations.join('\n')}`).toEqual([]);
  });
});
