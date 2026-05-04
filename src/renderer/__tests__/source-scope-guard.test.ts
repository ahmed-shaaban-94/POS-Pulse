import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { FORBIDDEN_PATH_PREFIXES } from './source-scope-guard.const';

/**
 * T006 — Static no-touch source-scope guard.
 *
 * Shells out to `git diff --name-only origin/main...HEAD` (triple-dot,
 * squash-merge-safe) and asserts the diff does not touch any path in the
 * forbidden allowlist (T005).  Covers additions, modifications, AND
 * deletions (git diff lists all three).
 *
 * Fallback: if `origin/main` is unreachable, the test skips with an
 * explicit warning AND records a CI failure signal so the PR-review
 * checklist in quickstart.md §6 becomes the manual gate.
 */
describe('source-scope guard (T006)', () => {
  it('003-pos-ui-shell diff must not touch forbidden paths', () => {
    let diffOutput: string;

    try {
      // Triple-dot: diff from the merge-base of origin/main and HEAD,
      // squash-merge-safe (works even when main has been squash-merged).
      diffOutput = execSync('git diff --name-only origin/main...HEAD', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // origin/main unreachable (shallow clone / no remote).
      const reachable = (() => {
        try {
          execSync('git rev-parse origin/main', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      })();

      if (!reachable) {
        // Skip with warning but DO NOT pass silently — the PR checklist
        // in quickstart.md §6 is the manual fallback for this environment.
        console.warn(
          '[source-scope-guard] SKIP: origin/main unreachable. ' +
            'Manual gate required: run `git diff --name-only origin/main...HEAD` ' +
            'and verify zero intersection with the forbidden allowlist (T005).',
        );
        // Re-throw so CI marks the test as skipped/errored, not passed.
        throw new Error(
          'source-scope guard: origin/main unreachable; manual check required per quickstart.md §6.',
        );
      }

      // origin/main is reachable but the diff command itself failed —
      // surface the raw error.
      throw new Error('source-scope guard: git diff command failed; see stderr above.');
    }

    const changedFiles = diffOutput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const violations = changedFiles.filter((file) =>
      FORBIDDEN_PATH_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix)),
    );

    expect(violations, `Forbidden paths modified by this branch: ${violations.join(', ')}`).toEqual(
      [],
    );
  });
});
