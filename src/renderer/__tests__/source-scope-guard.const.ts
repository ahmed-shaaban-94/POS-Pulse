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
  'scripts/codegen-api.ts',
  'scripts/openapi-snapshot.json',
  '.github/workflows/',
] as const satisfies readonly string[];

export type ForbiddenPathPrefix = (typeof FORBIDDEN_PATH_PREFIXES)[number];

/**
 * CI-maintenance branches (prefix `ci/`) are the sole exception to the
 * `.github/workflows/` block — their purpose IS CI config.  All other
 * forbidden prefixes remain blocked even on `ci/` branches.
 */
export const CI_MAINTENANCE_BRANCH_PREFIX = 'ci/' as const;
export const CI_MAINTENANCE_EXEMPT_PREFIXES = [
  '.github/workflows/',
] as const satisfies readonly ForbiddenPathPrefix[];

/**
 * `feat/002-dev-skip-pairing-fixture` is an explicitly approved 002
 * terminal-pairing dev fixture branch.  Its sole purpose is to add
 * `POS_PULSE_DEV_SKIP_PAIRING` dev-only support inside `src/main/pairing/`.
 *
 * `src/main/pairing/` remains forbidden for all other feature slices.
 * This exemption is NOT a general permission for future pairing changes —
 * any future branch touching `src/main/pairing/` must add its own
 * justified exemption here.
 */
export const PAIRING_DEV_FIXTURE_BRANCH_PREFIX = 'feat/002-dev-skip-pairing-fixture' as const;
export const PAIRING_DEV_FIXTURE_EXEMPT_PREFIXES = [
  'src/main/pairing/',
] as const satisfies readonly ForbiddenPathPrefix[];
