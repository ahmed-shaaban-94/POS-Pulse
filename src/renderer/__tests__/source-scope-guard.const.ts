/**
 * T005 — Frozen forbidden allowlist for the 003-pos-ui-shell static
 * no-touch source-scope guard.  Any file matching these glob prefixes
 * must NOT appear in `git diff --name-only origin/main...HEAD` for the
 * 003 implementation branch.  The list is a `readonly` const so it
 * cannot be mutated at runtime.
 */
export const FORBIDDEN_PATH_PREFIXES = [
  'src/preload/',
  'src/main/ipc/',
  'src/main/pairing/',
  'src/main/secrets/',
  'src/shared/bridge-api.ts',
  'src/shared/api-types.ts',
  'migrations/',
  'scripts/codegen-api.ts',
  'scripts/openapi-snapshot.json',
  '.github/workflows/',
] as const satisfies readonly string[];

export type ForbiddenPathPrefix = (typeof FORBIDDEN_PATH_PREFIXES)[number];
