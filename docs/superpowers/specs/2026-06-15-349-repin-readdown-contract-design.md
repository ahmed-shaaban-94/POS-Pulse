# #349 — Re-pin `api-types.ts` to the deployed read-down contract (design)

**Date:** 2026-06-15
**Issue:** #349 (POS) — "re-pin api-types.ts to deployed read-down contract"
**Scope:** #349 ONLY (the re-pin). NOT #360/T039 (live client + driver wiring) — that is the next, separate effort built on the seam this enables.
**Status:** DESIGN — awaiting owner approval before any implementation.

## Problem

POS's generated `src/shared/api-types.ts` is pinned to a **pharmacy-era, wrong-domain** OpenAPI snapshot. The catalogue read-down feature (010) needs types for the **deployed** contract `/api/pos/v1/catalog/snapshot` + `/deltas`, but the pin still carries the stale `/api/v1/pos/catalog/products` (+ `/stock`) shape (`drug_code`, `stg_batches` — a different backend's domain). The concrete read-down HTTP client (`createReadDownClient`, 010 T020/T021) cannot be written until the generated types reflect the real contract.

**Now unblocked (2026-06-15):** DP-2 `main` (incl. #490's read-down contract) is deployed to preprod; `/api/pos/v1/catalog/snapshot` + `/deltas` serve (verified 401; stale `/catalog/products` → 404). The D-DEPLOY blocker that gated #349 is cleared.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| **Scope** | #349 only (re-pin) | Clean seam from #360/T039 (the 010 team decoupled them via the `ReadDownClient` interface). Contract/codegen change has different risk + verification (codegen:verify + typecheck) than runtime client wiring. Smaller reviewable PR; land the keystone solid first. |
| **Pin source** | DP-2 `packages/contracts/openapi/catalog/read-down.yaml` | The ratified G2 contract the backend implements — version-controlled source of truth (Constitution V: codegen from a pinned snapshot), not a fragile runtime endpoint. Read from the WSL DP-2 checkout (on current `main`). |
| **Realization** | **Merge read-down paths+schemas into the existing snapshot + drop the stale catalogue paths** | (see Approach analysis) |

## Approach analysis

The codegen runner (`scripts/codegen-api.ts`) has a **single hardcoded snapshot → single output** pipeline (`openapi-snapshot.json` → `api-types.ts`), determinism-gated by `verify-codegen`. It is NOT built for multiple contracts. The snapshot is a standard OpenAPI 3.1.0 doc (281 paths, 379 schemas).

**Blast-radius finding (decisive):** `api-types.ts` has **4 live consumers** — `src/main/pairing/network.ts` + `src/main/payments/voucher-authority/{redeem,reverse,validate}.ts` — using schemas like `ActiveShiftResponse`, voucher schemas. The pharmacy paths (`drug_code`/`stg_batches`) are referenced by **no live code**. So the snapshot carries types other features actively use; it CANNOT simply be replaced.

- **A (separate pinned contract + generated module):** rejected — requires extending the determinism-critical codegen runner to a 2nd contract→output. More surface than #349 warrants.
- **B (replace whole snapshot with read-down):** rejected — breaks the 4 live consumers (pairing + voucher) that need schemas absent from read-down.yaml.
- **C — CHOSEN — merge read-down into the snapshot:** splice read-down.yaml's 2 paths + its `components.schemas` into `openapi-snapshot.json`; drop the stale `/api/v1/pos/catalog/products` + `/api/v1/pos/catalog/stock` paths (+ any schemas exclusively theirs, only if unreferenced). Fits the existing single-pipeline runner unchanged; preserves all live-consumer schemas; emits the read-down types `createReadDownClient` needs. The merge is mechanical + reviewable (JSON), NOT a hand-edit of generated output (that would be C-bad). The snapshot is the *source*; `api-types.ts` is regenerated from it via `npm run codegen:api`.

## Components / data flow

1. **Source fetch:** read `read-down.yaml` from WSL DP-2 (current `main`); convert YAML→JSON (the snapshot is JSON).
2. **Merge (a small, reviewable script or deterministic manual splice):**
   - Add `read-down.yaml` `paths['/api/pos/v1/catalog/snapshot']` + `['/api/pos/v1/catalog/deltas']` into the snapshot `paths`.
   - Add read-down `components.schemas.*` (e.g. `SellableCatalogRow`, `SellablePrice`, the snapshot/delta response wrappers, params) into snapshot `components.schemas`, namespacing/renaming on any collision with the existing 379 (collision check is part of the work).
   - Remove the stale `/api/v1/pos/catalog/products` + `/api/v1/pos/catalog/stock` paths. Remove schemas exclusively referenced by those paths **only after** confirming no live consumer + no other snapshot path references them (conservative: when in doubt, keep).
3. **Regenerate:** `npm run codegen:api` → new `api-types.ts` (deterministic, header sentinel, LF).
4. **Verify:** `npm run codegen:verify` (regen→diff clean) + `npm run typecheck` (the 4 live consumers still compile; read-down types now present).

## Out of scope (#360/T039, next effort)

- Writing `createReadDownClient` (the concrete HTTP client).
- Composition-root driver wiring; `catalogue:refresh` going live.
- Any runtime behavior, auth-header attachment, error mapping (the `ReadDownClient` interface + fake already cover the driver's tests).

## Error handling / risks

- **Schema-name collision** between read-down and the 379 existing schemas → resolve by namespacing read-down schemas (e.g. a prefix) or confirming identical shape. Detected during merge (collision check is explicit).
- **Dropping a still-referenced schema** → mitigated by the conservative rule: only drop schemas exclusively owned by the removed stale paths AND referenced by no live code. Default to keep.
- **Determinism gate** → the whole point of regenerating (not hand-editing `api-types.ts`); `codegen:verify` enforces it.
- **YAML→JSON fidelity** → use a standard converter; spot-check the 2 paths + `SellableCatalogRow` survive intact.

## Testing / verification

- `npm run codegen:verify` — regenerate→diff is clean (determinism).
- `npm run typecheck` — both tsconfigs; the 4 live consumers compile; `components["schemas"]["SellableCatalogRow"]` (and siblings) resolvable.
- Grep proof: the new snapshot contains `/api/pos/v1/catalog/snapshot` + `/deltas` and NO `/api/v1/pos/catalog/products`.
- Existing 010 read-down unit tests (mapper/writer/driver against the fake) still green — they depend on the local `SellableCatalogRow`/`ReadDownClient` types, not `api-types.ts`, so they should be unaffected (a guard that scope held).

## Deliverable

One PR: updated `scripts/openapi-snapshot.json` (merged) + regenerated `src/shared/api-types.ts` + (if used) the small merge helper. Commit both the snapshot and the regenerated types together (codegen runner's own instruction). Closes the codegen half of #349; #360/T039 follows.
