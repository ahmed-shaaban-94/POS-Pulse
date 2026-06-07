---
description: "Task list for 010-pos-catalog-read-down-consumption — slice/story-organised, test-first per Constitution VI; held behind gates §A2/§A4/§A5/§A6. Generated 2026-06-04."
---

# Tasks: 010-pos-catalog-read-down-consumption

**Feature:** 010-pos-catalog-read-down-consumption — Catalog Read-Down Consumption
**Plan:** [./plan.md](./plan.md) (v1.0, 2026-06-04)
**Spec:** [./spec.md](./spec.md) (`/speckit-clarify` ✅ 2026-06-04; 7 questions resolved)
**Research:** [./research.md](./research.md)
**Data model:** [./data-model.md](./data-model.md)
**Contracts:** [./contracts/backend-catalogue-snapshot.md](./contracts/backend-catalogue-snapshot.md) (PROPOSED) · [./contracts/catalogue-bridge-additions.md](./contracts/catalogue-bridge-additions.md)
**Quickstart:** [./quickstart.md](./quickstart.md)
**Constitution version pinned:** v1.5.1
**Created:** 2026-06-04
**Status:** **S1+S2 correctness core MERGED** — commit `5895eba` (`feat(010): offline read-down S1+S2 correctness core (migrations + writer)`) shipped the migrations `0031`–`0033`, the read-down writer (stage+promote), `mapSellableRow`, `validateRecord`, the `catalogue_sync_state` repo, and 13 test files (**64 tests green**, verified 2026-06-07). Tasks ticked below reflect that commit. Gates §A4 / §A5 remain; **§A6 is NARROWED to D-DEPLOY only** (see below). Still open: T018 (read-down redaction smoke), T036 (no-outbound-write), T037/T038 (driver), all of US3 (T040–T046), polish (T051–T056); plus the #349-blocked T002/T020/T021/T039.

---

> ✅ **§A6 NARROWED (2026-06-04).** The backend catalogue contract + device-principal auth are **SHIPPED**
> (Data-Pulse-2 PR #490 / issue #488). The **correctness core is UNBLOCKED and buildable now** — migrations
> (Phase 2, §A2-gated) and the read-down writer/validation/promote (US1 non-network) are all fixture-built
> against the known `SellableCatalogRow` shape, no backend needed.
> **The ONLY remaining §A6 item is D-DEPLOY:** re-pinning `src/shared/api-types.ts` from the *deployed*
> contract — blocked because the backend isn't yet serving at the edge (HTTP 521; tracked in **issue #349**).
> So only the **live HTTP client + its wiring** (T020/T021/T039, tagged `[BLOCKED:D-DEPLOY #349]`) wait;
> everything else proceeds. Auth on those tasks = **`Authorization: Bearer <device_token>`** (the backend has
> no `X-Terminal-Token` seam — plan AD-7).
>
> **Test-first (Constitution VI, NON-NEGOTIABLE).** Every implementation task is preceded by its failing
> test task (RED → GREEN). Test tasks are not optional for this feature.
>
> **Gate numbering:** parallels 009's review *types* — §A2 migration-safety, §A4 P8 bridge-security, §A5
> production readiness; §A6 (backend contract + Constitution V) is new to 010. 009's §A0/§A1/§A3 are N/A.

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description — file path`
- **`[P]`** = parallelizable (different files, no dependency on an incomplete task). Source-author hint;
  same-file pairs run sequentially regardless.
- **`[USn]`** maps a task to a user story phase. Setup / Foundational / Polish carry no story label.
- **`[BLOCKED:D-DEPLOY #349]`** = task may not start until `api-types.ts` is re-pinned from the deployed backend contract (blocked on backend deploy; issue #349). Only the live HTTP client + its wiring carry this.
- File paths are repository-relative.

## User-story map (derived from spec scenarios + plan slice strategy)

| Story | Title | Spec scenarios | Priority |
|:--|:--|:--|:--|
| **US1** | First read-down populates an empty terminal (the MVP) | 1, 2 | **P1** |
| **US2** | Catalogue refresh: idempotent, atomic, failure-safe | 3, 3a, 4 | P2 |
| **US3** | Cashier freshness surface + manual refresh | FR-15/FR-16 | P3 |

Cross-cutting invariants (tenant isolation P17, read-direction-only FR-10/11, redaction NFR-3) are
enforced in Foundational + woven through every story's tests.

---

## Phase 1 — Setup

- [x] T001 Backend-contract coordination (non-code): ✅ **DONE 2026-06-04.** Contract finalized + shipped by the backend — `GET /api/pos/v1/catalog/snapshot` + `/deltas`, `SellableCatalogRow`, device-principal auth via **`Authorization: Bearer <device_token>`** (NO `X-Terminal-Token` — backend has no such seam), scope from the `devices` row (Data-Pulse-2 PR #490 / issue #488). Endpoint/verb/shape/auth all CONFIRMED. **§A6 part 1 cleared.**
- [ ] T002 [BLOCKED:D-DEPLOY #349] Re-pin `src/shared/api-types.ts` from the **deployed** contract: confirm D-DEPLOY (`/openapi.json` → 200 with `/api/pos/v1/catalog/snapshot`), then `tsx scripts/codegen-api.ts --source=live` (or a local backend URL) → commit the new `scripts/openapi-snapshot.json` + regenerated types; `npm run codegen:verify` green. **Blocked: backend not yet deployed to the edge (HTTP 521; issue #349). Do NOT hand-edit the snapshot.** **Clears §A6 (part 2 = the only residual).**
- [x] T003 Author the §A2-class migration-safety review package — `specs/010-pos-catalog-read-down-consumption/migration-review/s1-migration-review.md`. **✅ DONE + owner-RATIFIED 2026-06-05** (`3abaade`; `branch_id`/store scope = `NOT NULL TEXT`). Cleared the migration tasks T011–T013 (merged in `5895eba`).

## Phase 2 — Foundational (Blocking Prerequisites)

> Migrations are US-agnostic (shared by every story) and gated on §A2, not §A6.

- [x] T010 [P] RED: migration test — `0031`/`0032`/`0033` create `products_staging`, `product_barcodes_staging`, `catalogue_sync_state` with the expected columns + indexes; mirror the sql.js + `readFileSync('migrations/00NN_*.sql')` pattern used by 009's `0029`/cart durability tests — `src/main/migrations/__tests__/0031-catalogue-readdown.test.ts`
- [x] T011 GREEN (§A2 ratified `3abaade`): author `migrations/0031_create_products_staging.sql` (mirror `products` columns incl. fold columns; money `INTEGER CHECK(>=0)`; booleans 0/1; logical FK only; no append-only trigger; `CREATE … IF NOT EXISTS`; ships empty)
- [x] T012 GREEN (§A2 ratified `3abaade`): author `migrations/0032_create_product_barcodes_staging.sql` (mirror `product_barcodes`; `(tenant_id, barcode_norm)` index; logical FK only; ships empty). NOTE: `barcode_kind` stays nullable — D-BARCODE populates it NULL from the untyped backend `aliases[]` (the writer synthesizes `barcode_id`; lossy, owner-accepted v1)
- [x] T013 GREEN (§A2 ratified `3abaade`): author `migrations/0033_create_catalogue_sync_state.sql` (one row per tenant: `tenant_id` PK, `branch_id?`, `last_success_at?`, `source_snapshot_id?`, `last_attempt_at?`, `last_outcome?`; ships empty)
- [x] T014 RED: `catalogue_sync_state` repo test — read returns null before first success; write inside a transaction; tenant-scoped — `src/main/catalogue/__tests__/catalogue-sync-state-repo.test.ts`
- [x] T015 GREEN: `createCatalogueSyncStateRepo(db)` — read/write `catalogue_sync_state`, tenant-scoped, write callable inside the promote transaction — `src/main/catalogue/catalogue-sync-state-repo.ts`
- [x] T015a [P] RED: backend-row mapping test — `mapSellableRow(SellableCatalogRow)` → internal record. Asserts the three resolved GAP mappings (fixture-built; no backend): **GAP-1 money** decimal string + `currency_code` → integer `price_minor` via exact string→int (×10^exponent; **v1 is single-currency-per-store = EGP, exponent 2** per the backend spec — the exponent is keyed off `currency_code` for forward-compat, NOT a multi-currency feature in v1), **never a float**, rejects non-representable; **D-NAME** single `name` → `name_ar := name`, `name_en := null`; **D-BARCODE** untyped `aliases[]` → one `product_barcodes` record per entry with `barcode_kind := null` (lossy, owner-accepted) + the `sku` typed field kept distinct — `src/main/catalogue/read-down/__tests__/map-sellable-row.test.ts`
- [x] T015b [P] GREEN: `mapSellableRow(row)` → `{ product, barcodes[] }` internal shape implementing the GAP-1/D-NAME/D-BARCODE mappings above; pure (no I/O), no arithmetic beyond the exact decimal→minor parse — `src/main/catalogue/read-down/map-sellable-row.ts`
- [x] T016 [P] RED: per-record validation test — required fields present; `price_minor` rejected unless `Number.isSafeInteger` and ≥ 0; empty `name_ar` rejected (post-mapping `name_ar` is the backend `name`, so empty ⇒ a bad source row); valid record passes — `src/main/catalogue/read-down/__tests__/validate-record.test.ts`
- [x] T017 [P] GREEN: `validateRecord(mapped)` → `{ ok, value } | { ok:false, reason }`; safe-integer money guard (P1); validates the mapped internal record (runs after T015b); no arithmetic — `src/main/catalogue/read-down/validate-record.ts`
- [ ] T018 [P] Extend the cross-process redaction allowlist + Sentry scrubber for any read-down secret-shaped field (append-only) and add a read-down redaction-smoke fixture — `src/shared/audit/forbidden-keys.ts` + `src/main/catalogue/read-down/__tests__/redaction.smoke.test.ts`

---

## Phase 3 — US1: First read-down populates an empty terminal (P1 — MVP)

**Goal:** A fresh terminal, after one successful read-down, has 009 resolving real products offline.
**Independent test:** Seed an empty read model; run one read-down against a fixture snapshot; assert
`products`/`product_barcodes` hold the set, fold columns match 009's query fold, and 009's
`product-repo` lookup/search resolve real products — with the network then disconnected (SC-1, SC-2).

- [ ] T020 [BLOCKED:D-DEPLOY #349] RED [US1] read-down HTTP client test — resolve-on-reachable / reject-on-transport → typed outcome (`ok` / `no_connection` / `failed`); `AbortSignal.timeout`; raw body never logged; consumes generated `api-types.ts` snapshot type — `src/main/catalogue/read-down/__tests__/read-down-client.test.ts`
- [ ] T021 [BLOCKED:D-DEPLOY #349] GREEN [US1] `createReadDownClient({ baseUrl, fetch, timeoutMs })` — GET `/api/pos/v1/catalog/snapshot`, attach the device token via the **`Authorization: Bearer <device_token>` header** (D-AUTH-2 / plan AD-7 — the backend has no `X-Terminal-Token` seam; read from `secretStore.get(DEVICE_TOKEN_KEY)`; no operator JWT — Constitution VIII), map to typed outcome; token never bridged/logged — `src/main/catalogue/read-down/read-down-client.ts`
- [x] T022 [P] [US1] RED: fold-parity test — rows written via the writer are found by 009's `product-repo.search` across the Arabic/English folded-variant corpus (proves write-time `normalize()` == read-time) (SC-9) — `src/main/catalogue/read-down/__tests__/fold-parity.test.ts`
- [x] T023 [US1] RED: writer happy-path test — validated snapshot → staging populated (fold columns via `normalize()`) → promote → live `products`/`product_barcodes` hold the set; `catalogue_sync_state.last_success_at` set inside the promote tx (SC-1) — `src/main/catalogue/read-down/__tests__/read-down-writer.happy.test.ts`
- [x] T024 [US1] GREEN: `createReadDownWriter({ db, syncStateRepo })` — stage validated rows computing the fold columns per the **R1 composition rule** (`name_fold = normalize(name_ar + ' ' + (name_en ?? ''))`, `alias_fold = normalize(aliases.join(' '))`, `sku_norm`/`barcode_norm` per raw value — verified against 009 `search.ts`), promote in one transaction (`DELETE` live + `INSERT … SELECT` from staging), write `last_success_at` in the same tx — `src/main/catalogue/read-down/read-down-writer.ts`
- [x] T025 [P] [US1] RED: offline-after-success test — after one promote, disconnect fetch; 009 lookups/search resolve from local data, 0 network calls (SC-2) — `src/main/catalogue/read-down/__tests__/offline-after-success.test.ts`
- [x] T026 [P] [US1] RED: tenant-isolation test — a snapshot containing a foreign-tenant row never reaches the live tables; cross-tenant rows rejected (SC-6, P17) — `src/main/catalogue/read-down/__tests__/tenant-isolation.test.ts`
- [x] T027 [US1] GREEN: enforce tenant-scoping in the writer (stage + promote filter the terminal's tenant; reject cross-tenant rows). The `tenant_id`/`branch_id` come from **`pairingStore`** (injected at wire-up — there is no operator session; R8/AD-8), NOT from a session manager — `src/main/catalogue/read-down/read-down-writer.ts`

## Phase 4 — US2: Catalogue refresh — idempotent, atomic, failure-safe (P2)

**Goal:** Re-running a read-down converges to the backend state; an interrupted/failed run never
corrupts or empties a working catalogue.
**Independent test:** From a populated catalogue, (a) re-run with changed snapshot → changes reflected,
no dupes; (b) throw mid-promote → live unchanged, staging invisible; (c) force transport/malformed/
over-threshold failure → prior catalogue intact, `last_success_at` unchanged (SC-3/SC-4/SC-5/SC-11).

- [x] T030 [US2] RED: idempotent-replace test — re-running with the same snapshot converges to identical state (no duplicate products/barcodes); with a changed snapshot, adds/price-updates/deactivations reflected (SC-3, FR-13) — `src/main/catalogue/read-down/__tests__/idempotent-replace.test.ts`
- [x] T031 [US2] RED: atomicity test — a thrown error inside the promote tx rolls back; live tables unchanged; `product-repo` never sees staging rows (SC-4, FR-6) — `src/main/catalogue/read-down/__tests__/promote-atomicity.test.ts`
- [x] T031a [P] [US2] RED: barcode-ambiguity preservation test — a snapshot with two active products sharing barcode B → post-promote `product_barcodes` has both rows → 009's `lookupByBarcode` returns `ambiguous` (the read-down MUST NOT dedupe/collapse the conflict, FR-4) — `src/main/catalogue/read-down/__tests__/barcode-ambiguity.test.ts`
- [x] T032 [US2] GREEN: harden the promote — single transaction, rollback-on-throw, staging cleared per run so a prior failed run never leaks into a later promote; preserve duplicate-barcode rows faithfully (FR-4, satisfies T031a) — `src/main/catalogue/read-down/read-down-writer.ts`
- [x] T033 [P] [US2] RED: failure-preservation test — transport failure / malformed snapshot / over-threshold rejection → no promote, prior catalogue 100% usable, `last_success_at` unchanged, failure recorded (SC-5, FR-7) — `src/main/catalogue/read-down/__tests__/failure-preservation.test.ts`
- [x] T034 [P] [US2] RED: skip-and-log + threshold test — below-threshold invalid records skipped + counted, valid set promotes; above-threshold → run fails, prior catalogue preserved (SC-11, FR-9) — `src/main/catalogue/read-down/__tests__/malformed-records.test.ts`
- [x] T035 [US2] GREEN: writer rejection handling — collect per-record skips, apply the abort-threshold (value from plan R-RISK-4), record `last_outcome` (`succeeded`/`failed`/`skipped_with_rejections`) — `src/main/catalogue/read-down/read-down-writer.ts`
- [ ] T036 [P] [US2] RED: no-outbound-write test — across the full read-down lifecycle the client issues only the snapshot GET; assert 0 other backend calls / 0 POS→backend writes (SC-7, FR-10) — `src/main/catalogue/read-down/__tests__/no-outbound-write.test.ts`
- [ ] T037 [US2] RED: driver test — `runTickOnce` runs one read-down; single-flight (`already_running` while in progress); `start`/`stop` install/clear the interval; stop before db close — `src/main/catalogue/read-down/__tests__/read-down-driver.test.ts`
- [ ] T038 [US2] GREEN: `createReadDownDriver({ client, writer, logger, tickIntervalMs })` → `{ runTickOnce, start, stop }`; single-flight; structured redacted diagnostics (R7) — `src/main/catalogue/read-down/read-down-driver.ts`
- [ ] T039 [BLOCKED:D-DEPLOY #349] [US2] Wire the driver into the composition root: instantiate `createReadDownClient` + `createReadDownWriter` + `createReadDownDriver`, injecting `tenant_id`/`branch_id` from **`pairingStore`** (not a session); run once on app-start / post-pairing; `start()` the interval; call `stop()` in `closeDbHandle()` **before** `dbHandle.close()` (mirror `finalize-listener` wiring) — `src/main/index.ts`

## Phase 5 — US3: Cashier freshness surface + manual refresh (P3)

**Goal:** A cashier sees a truthful "catalogue last updated" time and can trigger a refresh.
**Independent test:** `catalogue.freshness` returns null before any success, then the committed promote
time; `catalogue.refresh` kicks a tick and returns `started`/`already_running`; both gate on session;
the renderer shows the timestamp + a refresh affordance, keyboard-operable + axe-clean (SC-10, FR-15/16).

- [ ] T040 [US3] RED: bridge contract test — `catalogue:refresh` → `started` / `already_running` / `refused(no_session|tenant_isolation)`; `catalogue:freshness` → `ok{last_success_at|null, is_empty}` / `refused`; assert the three freshness states (never-synced / synced-with-products / **synced-but-empty**, FR-16b/SC-10); both gate on session first; neither returns data/secret — `src/main/catalogue/__tests__/catalogue-bridge.readdown.test.ts`
- [ ] T041 [US3] GREEN: add `CATALOGUE_IPC_CHANNELS.REFRESH` + `FRESHNESS` and the request/response types (freshness response carries `last_success_at` + `is_empty`) — `src/shared/catalogue/channels.ts` + `src/shared/bridge-api.ts`
- [ ] T042 [US3] GREEN: extend `createCatalogueBridge` with `refresh` (session-gated → `driver.runTickOnce()`, single-flight status) and `freshness` (session-gated → `syncStateRepo` read + a tenant-scoped `products`-has-rows check for `is_empty`; tenant-scoped) — `src/main/catalogue/catalogue-bridge.ts`
- [ ] T043 [BLOCKED:§A4] [US3] GREEN: register the two new channels — `src/main/ipc/catalogue.ts` (+ wire in `src/main/index.ts`)
- [ ] T044 [BLOCKED:§A4] [US3] GREEN: expose `catalogue.refresh` / `catalogue.freshness` on the preload surface — `src/preload/*` (the typed `catalogue.*` exposure)
- [ ] T045 [P] [US3] RED: freshness-indicator a11y/render test — shows the three FR-16b states ("not yet downloaded" when null; "last updated &lt;time&gt;" when non-empty; "updated &lt;time&gt; — no products available" when `is_empty`); no live-sync wording; keyboard-operable refresh affordance; axe-clean; RTL Arabic-first; ≥44×44 (SC-10, FR-16/16b, P14) — `src/renderer/ui/catalogue/__tests__/CatalogueFreshness.test.tsx`
- [ ] T046 [US3] GREEN: `CatalogueFreshness` indicator + refresh affordance, reading `catalogue.freshness` (rendering all three `is_empty`/null states truthfully) and calling `catalogue.refresh`; truthful copy only — `src/renderer/ui/catalogue/CatalogueFreshness.tsx`

---

## Phase Final — Polish & Cross-Cutting

- [ ] T050 §A4 P8 bridge-security review of `catalogue:refresh` / `catalogue:freshness` — `specs/010-pos-catalog-read-down-consumption/security-review/s4-review.md`. **PARTIAL: the pre-implementation review (threat model + 13 binding required-controls) is authored and the lane is OPEN** (`2fb565b`, conditional verdict). **Remaining: the post-implementation walk** — re-run the §4 matrix against the actual S4 diff and flip the verdict to CLEARED before S4 merges. Keep `[ ]` until that walk lands.
- [ ] T051 [P] Support runbook entry (read-down failure modes, manual-refresh, "catalogue unavailable" triage) — `docs/runbook/catalogue-read-down.md`
- [ ] T052 [P] Rollback note (disable the driver / revert migrations `0031`–`0033` / behaviour with an empty read model) — `specs/010-pos-catalog-read-down-consumption/rollback.md`
- [ ] T053 [P] Failure-mode catalogue (transport / malformed / over-threshold / interrupted-promote / tenant-drift → operator-visible + diagnostic behaviour) — `specs/010-pos-catalog-read-down-consumption/failure-modes.md`
- [ ] T054 §A5 performance bring-up on target Windows hardware: read-down completion + promote-window at ~50k products; confirm 009's lookup budgets (NFR-1) hold against a read-down-populated catalogue **AND that lookups issued concurrently with an in-flight promote stay within budget** (WAL concurrent-reader check — SC-8; not just promote duration) — `specs/010-pos-catalog-read-down-consumption/perf-bringup.md`
- [ ] T055 Coverage gate: ≥95% on `read-down-writer.ts` + `read-down-client.ts`; ≥90% on `read-down-driver.ts` + `catalogue-sync-state-repo.ts` — verify via `npx vitest run <paths> --coverage --coverage.include=<paths>`
- [ ] T056 Final-green: `npm run codegen:verify && npm run typecheck && npm run lint && npx vitest run` all exit 0
- [ ] T057 Update `CLAUDE.md` `<!-- SPECKIT START -->` slice status for 010 (**owner-performed or explicitly authorized — CLAUDE.md is otherwise out of scope**)

---

## Dependency Graph

```
§A6 (backend contract, EXTERNAL) ──blocks──> T020/T021 (client), T039 (driver wiring), all network code
§A2 (migration review, T003) ───────────────blocks──> T011/T012/T013 (migrations)

Setup:        T001 ✅done ; T002 (§A6=D-DEPLOY #349, blocked) ; T003 (§A2)
Foundational: T010→[T011,T012,T013] ; T014→T015 ; T015a→T015b→[T016→T017] ; T018
US1 (P1):     [T020→T021] ; T022,T023 → T024 → T027 ; T025,T026   (writer needs migrations + map(T015b) + validate + syncStateRepo + normalize)
              ⮑ ✅ DONE (`5895eba`): T015a/b mapping, T016/T017 validate, T022–T027 writer/fold/promote/isolation, T030–T035 of US2. STILL OPEN: T036 no-outbound-write, T037/T038 driver. T020/T021/T039 wait on D-DEPLOY (#349).
US2 (P2):     depends on US1 writer — T030,T031→T032 ; T033,T034→T035 ; T036 ; T037→T038→T039
US3 (P3):     depends on US2 driver — T040→[T041,T042,T043,T044] ; T045→T046
Polish:       T050 (after US3 bridge) ; T051,T052,T053 [P] ; T054 (after US1/US2) ; T055,T056 ; T057
```

Stories are **incrementally dependent** (not independent): US1 builds the writer the others extend; US2
adds refresh-safety to it; US3 surfaces it. This mirrors the read-down's single-writer nature.

## Parallel Execution Examples

- **Foundational batch:** T010, T016, T018 are different files / no shared state → `[P]`. (T011–T013 are
  the same migration concern, authored together in one PR; T014/T015 and T016/T017 are RED→GREEN pairs,
  sequential within each pair.)
- **US1 tests batch:** T022, T025, T026 are independent test files → `[P]` (all RED before their GREEN).
- **US2 tests batch:** T033, T034, T036 are independent test files → `[P]`.
- **Polish batch:** T051, T052, T053 are independent docs → `[P]`.
- **Process-boundary caution:** T021/T039 (client + composition-root wiring) and T041–T044 (bridge +
  channels + preload + index) cross the renderer↔preload↔main boundary → **single-agent, sequential**
  (Constitution P8; plan §A4). Do NOT parallelize bridge/preload/main edits.

## Implementation Strategy

- **MVP = US1.** US1's *correctness core* — the writer (stage/promote/atomicity), validation, fold-parity,
  tenant-isolation — is **unit-testable against fixture snapshots with no backend** (the writer consumes
  already-validated internal records per data-model.md). Only US1's *integration completion* (the real
  fetch via T020/T021 + live wiring T039) is §A6-gated. At end of US1 a fresh terminal can be populated and
  009 resolves real products offline — the core value.
- **Increment US2** (refresh safety: idempotent/atomic/failure-safe + the background driver) → the
  catalogue stays current without risking a working one.
- **Increment US3** (freshness surface + manual refresh) → the cashier-visible affordance.
- **Polish** clears §A4 (bridge-security), §A5 (production readiness + perf), and the final-green gate.
- **Sequencing note:** only the **live-fetch HTTP client (T020/T021)** and the **composition-root wiring
  (T039)** truly wait on §A6 — they touch the real backend. *In parallel with* the backend §A6
  coordination (T001/T002), the team can build almost the entire correctness core against fixtures:
  migrations (T011–T013, §A2-gated, 009's known shape), the sync-state repo (T014/T015), validation
  (T016/T017), the writer + promote/atomicity/failure-safety (T023/T024/T027/T030–T035), fold-parity
  (T022), and tenant-isolation (T026). This is the real pre-§A6 work surface.

---

*This task list derives from plan.md v1.0. Changes to scope or approach MUST update the plan and re-run
`/speckit-tasks`. Next: `/speckit-analyze` (cross-artifact validation) before implementation.*
