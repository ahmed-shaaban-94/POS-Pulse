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

/**
 * `feat/006-*` branches implement 006-payments-tender Slice 4 §A2 voucher
 * V-A contract pin (T200–T203) and may regenerate the two codegen artefacts.
 *
 * Authority: §A2 voucher contract sign-off recorded in
 * `specs/006-payments-tender/coordination.md` (Plan v1.0 — Slice 4 §A2
 * verification subsection). Upstream contract: Data-Pulse-2 PR #316,
 * merge commit 90261f2 (source commit aedb757).
 *
 * Exemption is narrow: only the two codegen artefacts. All other forbidden
 * prefixes (`src/main/pairing/`, `src/main/secrets/`, `scripts/codegen-api.ts`,
 * `.github/workflows/`) remain blocked on `feat/006-*` branches.
 */
export const FEAT_006_PAYMENTS_BRANCH_PREFIX = 'feat/006-' as const;
export const FEAT_006_PAYMENTS_EXEMPT_PREFIXES = [
  'src/shared/api-types.ts',
  'scripts/openapi-snapshot.json',
] as const satisfies readonly ForbiddenPathPrefix[];

/**
 * `feat/008-t094a-*` branches implement 008 T094a's POS-Pulse-side
 * pairing extension: six new `TerminalAssignmentRow` fields
 * (branch_name, branch_address, tenant_tax_registration_id,
 * printer_vendor_id, printer_product_id, printer_com_port) populated
 * from the post-PR #272 pinned `TerminalPairResponse`. Touches
 * `src/main/pairing/` store + service + dev fixture (002's territory)
 * because the contract pin from #272 cannot be consumed without
 * extending the row shape it's projected into.
 *
 * Authority: 008 plan §AD-12 + Slice 1 closeout-gap audit (POS-Pulse
 * PRs #267 / #268 / #271) + Slice 3 prep audit (PR #270) + the
 * contract pin landed in PR #272. Upstream contract: Data-Pulse-2
 * PR #388, merge commit 6c9dda2.
 *
 * Exemption is narrow: ONLY `src/main/pairing/`. All other forbidden
 * prefixes (`src/main/secrets/`, `src/shared/api-types.ts`,
 * `scripts/codegen-api.ts`, `scripts/openapi-snapshot.json`,
 * `.github/workflows/`) remain blocked on `feat/008-t094a-*`
 * branches. This exemption does NOT extend to other 008 work
 * (T094b/T094c/T028a etc. all touch their own non-forbidden
 * territory and need no exemption).
 */
export const FEAT_008_T094A_BRANCH_PREFIX = 'feat/008-t094a-' as const;
export const FEAT_008_T094A_EXEMPT_PREFIXES = [
  'src/main/pairing/',
] as const satisfies readonly ForbiddenPathPrefix[];
