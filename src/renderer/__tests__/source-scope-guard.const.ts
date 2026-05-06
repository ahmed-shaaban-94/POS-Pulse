/**
 * T005 — Frozen forbidden allowlist for the source-scope guard.
 *
 * Originally authored for 003-pos-ui-shell, which had a strict no-touch
 * contract over the preload / IPC / bridge layers (those belonged to
 * 002 and were stable). 004-operator-session legitimately extends
 * those same layers (T014 extends `src/shared/bridge-api.ts` with the
 * `operator.*` namespace; T026–T028 add `src/main/ipc/operator.ts` and
 * `src/main/operator/*`; T032 wires the preload bridge), so the
 * 003-era prefixes for those layers are removed here. Any future
 * feature that wants to extend them MUST update this list with
 * justification.
 *
 * Permanently-forbidden paths (still off-limits to 004 S1 per the
 * user's hard constraints + the constitution):
 *
 *   - `src/main/pairing/`         — 002's territory; do not edit.
 *   - `src/main/secrets/`         — 001's safeStorage layer.
 *   - `src/shared/api-types.ts`   — generated; only `npm run codegen:api`
 *                                   may regenerate it (NOT in S1).
 *   - `migrations/`               — §A3 gate; S1 has no migrations.
 *   - `scripts/codegen-api.ts`    — the codegen tool itself.
 *   - `scripts/openapi-snapshot.json` — pinned snapshot; S1 owner
 *                                   decision (b) keeps it untouched.
 *   - `.github/workflows/`        — CI config; S1 does not change CI.
 *
 * The list is a `readonly` const so it cannot be mutated at runtime.
 */
export const FORBIDDEN_PATH_PREFIXES = [
  'src/main/pairing/',
  'src/main/secrets/',
  'src/shared/api-types.ts',
  'migrations/',
  'scripts/codegen-api.ts',
  'scripts/openapi-snapshot.json',
  '.github/workflows/',
] as const satisfies readonly string[];

export type ForbiddenPathPrefix = (typeof FORBIDDEN_PATH_PREFIXES)[number];
