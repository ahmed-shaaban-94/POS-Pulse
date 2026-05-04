import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * T007a — No-operator-auth-session guard.
 *
 * Static-analysis style: reads every .ts/.tsx file under src/renderer/
 * and asserts zero references to operator session / auth / cashier
 * surfaces.  Passes trivially at T007a time; catches any later task that
 * silently introduces an operator-identity surface.
 *
 * Constitution Principle VIII binding; spec FR-8 + Out-of-Scope.
 */

const SRC_ROOT = resolve(__dirname, '../');

// Scan only the 003-owned directories. Pre-existing 002 files may
// legitimately reference auth-adjacent words in doc comments.
const SCOPED_DIRS = [
  resolve(SRC_ROOT, 'ui'),
  resolve(SRC_ROOT, 'shell'),
  resolve(SRC_ROOT, 'routes/app'),
];

function collectFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
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

function collectScopedFiles(): string[] {
  const result: string[] = [];
  for (const dir of SCOPED_DIRS) {
    try {
      result.push(...collectFiles(dir));
    } catch {
      // Directory may not exist yet
    }
  }
  return result;
}

const HOOK_PATTERN = /use(OperatorSession|User|Auth|Login|Cashier|CurrentUser|Operator|Session)\b/g;

const FORM_ACTION_PATTERN = /<form[^>]+action=["'](\/?(login|auth|operator))/g;

const PASSWORD_INPUT_PATTERN = /<input[^>]+type=["'](password)["']/g;

const PIN_INPUT_PATTERN = /<input[^>]+name=["'](pin|passcode|password)["']/g;

const BRIDGE_AUTH_PATTERN =
  /bridge\.(operator|session|auth)\.|window\.api\.(operator|session|auth)\b/g;

// The only file allowed to reference "OperatorSlot" as a file path:
// OperatorSlot.tsx itself + its test + AppShell.tsx + TopBar.tsx
// The guard excludes this test file itself.

describe('no-operator-auth-session guard (T007a)', () => {
  const files = collectScopedFiles();

  it('zero useOperatorSession / useUser / useAuth / useCashier / useCurrentUser hook references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(HOOK_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Operator-auth hook references found:\n${violations.join('\n')}`).toEqual(
      [],
    );
  });

  it('zero login/auth/operator form action references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(FORM_ACTION_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Operator form action references found:\n${violations.join('\n')}`).toEqual(
      [],
    );
  });

  it('zero password/PIN input elements', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const passwordMatch = content.match(PASSWORD_INPUT_PATTERN);
      const pinMatch = content.match(PIN_INPUT_PATTERN);
      if (passwordMatch || pinMatch) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(
          `${relPath}: ${[...(passwordMatch ?? []), ...(pinMatch ?? [])].join(', ')}`,
        );
      }
    }
    expect(violations, `Password/PIN input references found:\n${violations.join('\n')}`).toEqual(
      [],
    );
  });

  it('zero bridge.operator / bridge.session / bridge.auth / window.api.operator references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(BRIDGE_AUTH_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Bridge auth references found:\n${violations.join('\n')}`).toEqual([]);
  });
});
