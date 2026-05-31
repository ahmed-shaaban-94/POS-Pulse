---
description: "Task list for 009-product-search-and-barcode-lookup — slice-organised (S0–S5), test-first per Constitution VI; held behind gates §A0–§A5. Generated 2026-05-30; C1/C2 remediation applied."
---

# Tasks: 009-product-search-and-barcode-lookup

**Feature:** 009-product-search-and-barcode-lookup — Product Search & Barcode Lookup
**Spec:** [./spec.md](./spec.md) (`/speckit-clarify` ✅ 2026-05-30; 5 Q locked)
**Plan:** [./plan.md](./plan.md) (v1.0, 2026-05-30)
**Research:** [./research.md](./research.md)
**Data model:** [./data-model.md](./data-model.md)
**Contracts:** [./contracts/bridge-api.md](./contracts/bridge-api.md) · [./contracts/resolver-seam.md](./contracts/resolver-seam.md)
**Quickstart:** [./quickstart.md](./quickstart.md)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-30
**Last updated:** 2026-05-30 (C1 controlled/Rx surfacing + C2 alias-hit test added per `/speckit-analyze`)
**Status:** Draft — held behind gates §A0–§A5 (see Approval Gates). `/speckit-plan` authored no code.

---

> ✅ **§A0 + §A1 RATIFIED 2026-05-30**; **§A2 RATIFIED 2026-05-31** (D1–D6 accepted; migrations at `0029`/`0030`).
> **S1 done (PRs #317–#320); S2a migrations done (PR #322); S2 read-repo done (PR #323); S3 folded search done (T031–T039 — this PR).** S4 unblocked (resolve + 005 seam). Only **§A5** (production readiness) remains — it gates S5.
> Seam approach (§A1) = match 005's live `{display_name, unit_price_minor}`; `version` deferred.
> **S2 read-repo note:** exact `lookupBarcode`/`lookupSku` wired to `product-repo.ts` (tenant-scoped in SQL, active-only, ambiguity via COUNT DISTINCT, catalogue-unavailable distinct from not-found). **Not yet renderer-reachable** — the `catalogue.*` `ipcMain` registration + repo construction in `index.ts` (deferred from T016) is owned by S4/T043; no task between S2 and S4 currently registers it (flagged for the reviewer).

---

## Locked decisions (informational — do not re-open)

| Decision (Clarifications 2026-05-30) | Locked value |
|:--|:--|
| Single-match behaviour | **Confirm-first** — show product, cashier taps Add (FR-5) |
| Duplicate-scan behaviour | **Increment quantity** via 005's Q4 merge-by-`item_ref` (FR-21) |
| Lookup gating | **Active operator session**, bridge-enforced, generic refusal (NFR-6a) |
| Arabic search folding | alef أإآٱ→ا · alef-maqsura ى→ي · taa-marbuta ة→ه · strip harakat+tatweel; **both-sided** (FR-12a/b) |
| English search folding | case + accent/diacritic + whitespace; **both-sided** (FR-12) |
| Catalogue-unavailable | **one generic state** (empty/missing/unreadable), distinct from not-found; staleness deferred (FR-24/24a) |
| Performance budgets | exact ≤50 ms p95 · search ≤150 ms p95 · render ≤16 ms · min query 2 · max 20 · debounce ~150 ms @ ~50k rows |

**`catalogue.*` bridge handlers** (read-only; from `contracts/bridge-api.md`):
`catalogue.lookupBarcode` · `catalogue.lookupSku` · `catalogue.search` · `catalogue.resolve`

**R7 seam wired (NOT redesigned):** `cart.resolveItemRef` → `{ display_name, unit_price_minor }` (005 owns signature; **§A1 ratified — no `version`**, matching 005's live `ItemRefResolver`; `version` deferred per R9).

**Two SQLite tables** (read-only from 009; ship empty; migration order per `data-model.md`):
1. `products` 2. `product_barcodes` (+ `name_fold`/`alias_fold` search columns/indexes)

**Search store FSM** (7): `idle` · `searching` · `results` · `not_found` · `ambiguous` · `catalogue_unavailable` · `confirm_pending`

---

## Format

```text
- [ ] T### [P?] [US?] Description — `file/path/here`
```

- `[P]` = parallelizable with other `[P]` tasks in the same phase (independent files, no shared state).
- **`[US?]` = traceability tag** (phases are *slices*, not stories — mirrors 005's convention):
  - **US1** = Scan / exact-lookup a product and add to cart (the MVP: barcode + SKU → confirm → add).
  - **US2** = Type-search by Arabic/English name + alias and add (folded substring search).
  - **US3** = Catalogue-unavailable + offline resilience (cross-cutting; tested across every lookup).
- Gate suffixes where a slice-specific gate applies: **(§A1)**, **(§A2)**, **(§A5)**.

Per **Constitution VI** (test-first, coverage-gated), **every implementation task is preceded by its
TDD test task(s)**; test tasks carry the same `[US?]` tag. (The skill's "tests optional" default is
overridden by the constitution — same posture as 005 tasks.md.)

---

## Approval gates — current status

| Gate | Blocks | Status |
|:--|:--|:--|
| **§A0** — S0 visual-direction review + 005 seam-wiring coordination | every slice | ✅ **RATIFIED 2026-05-30** (on merge of PR #318 — S0 contact-sheet + review-record, T009–T013, checklist 1–13 all PASS). |
| **§A1** — R7 seam-wiring approach ratified with 005 owner | S1, S2, S4 | ✅ **RATIFIED 2026-05-30** — 009 satisfies 005's **live** `{ display_name, unit_price_minor }` seam; **`version` deferred** (forward-looking provenance, R9; binds in code at S4). No 005 change. |
| **§A2** — `products`/`product_barcodes`/fold-column migration review | S2, S3 | ✅ **RATIFIED 2026-05-31** — see [`migration-review/s2-migration-review.md`](./migration-review/s2-migration-review.md); decisions D1–D6 accepted (sku_norm, name_fold incl. en, tax_category NOT NULL, app-enforced uniqueness, partial `active=1` indexes, fold-scan + FTS5 fallback). Migrations land at `0029`/`0030`. |
| **§A5** — production readiness (runbook, rollback, perf bring-up @ 50k) | S5 / rollout PR | ⏳ open |

---

## Phase 1 — Setup

- [X] T001 Create the `src/main/catalogue/` module directory and an index barrel — `src/main/catalogue/index.ts`
- [X] T002 Create the renderer component directory `src/renderer/ui/catalogue/` with a barrel — `src/renderer/ui/catalogue/index.ts`
- [X] T003 [P] Add the `ProductSnapshot` cross-module type stub (display surface + seam subset per data-model.md) — `src/shared/catalogue/product-snapshot.ts`
- [X] T004 [P] Reserve the `catalogue.*` namespace block in the bridge-API type surface (types only; no handlers yet) — `src/shared/bridge-api.ts`

## Phase 2 — Foundational (blocking prerequisites)

- [X] T005 Test (RED): `normalize.ts` folding contract — Arabic alef/yaa/taa-marbuta/harakat/tatweel + English case/accent + numeral + whitespace, **both-sided idempotence** — `src/main/catalogue/__tests__/normalize.test.ts`
- [X] T006 Implement `normalize.ts` to GREEN the folding contract (load-bearing; ≥95% coverage target) — `src/main/catalogue/normalize.ts`
- [X] T007 [P] Test (RED): `catalogueSearchStore` 7-state FSM transitions (idle→searching→results/not_found/ambiguous/catalogue_unavailable/confirm_pending), mirrors-only-bridge-confirmed — `src/renderer/stores/__tests__/catalogueSearchStore.test.ts`
- [X] T008 Implement `catalogueSearchStore` (zustand; 7-state FSM; ~150 ms debounce on typed only; scanner bypass) to GREEN — `src/renderer/stores/catalogueSearchStore.ts` *(FSM core; debounce + scanner-bypass wiring deferred to T036/T037 in S3 per task graph)*

## Phase 3 — Slice S0: Visual Direction (non-code) · gate §A0

**Goal:** A reviewed contact sheet for every search/lookup surface, recorded before any code slice.
**Independent test:** the review document exists and is signed off under `visual-direction/`.

- [X] T009 [US1] Produce the contact sheet: search input + scan-capture field (focused, wedge-ready), 003/007 tokens, RTL Arabic-first, 44×44 floor — `specs/009-product-search-and-barcode-lookup/visual-direction/contact-sheet.md`
- [X] T010 [P] [US2] Add result-list + result-row mock: Arabic-first name, price, unit/pack, barcode/SKU where useful; keyboard selection highlight (FR-17a) — `specs/009-product-search-and-barcode-lookup/visual-direction/contact-sheet.md`
- [X] T011 [P] [US1] Add confirm-panel mock (single-match, confirm-first: name/price/unit-pack; Add/Cancel; controlled/Rx flag badge per C1) — `specs/009-product-search-and-barcode-lookup/visual-direction/contact-sheet.md`
- [X] T012 [P] [US3] Add not-found, **catalogue-unavailable (visually distinct)**, ambiguous-barcode, and empty/too-short idle mocks — `specs/009-product-search-and-barcode-lookup/visual-direction/contact-sheet.md`
- [X] T013 [US1] Record the S0 review (against 003/007 tokens, RTL, role-indicator slot, keyboard path, axe-clean) — `specs/009-product-search-and-barcode-lookup/visual-direction/review-record.md` **(§A0)** — *review recorded; checklist 1–13 all PASS; **recommends** §A0 sign-off. Owner (Ahmed) ratification + 005 seam-wiring coordination still pending; gate stays open until ratified.*

## Phase 4 — Slice S1: `catalogue.*` bridge skeleton + session gating + store wiring · gates §A0, §A1

**Goal:** A typed, session-gated `catalogue.*` namespace (handlers stubbed) and component shells.
**Independent test:** every handler refuses generically without an active session; shells render; store transitions on bridge confirmation. No persistence/search logic yet.

- [X] T014 [US1] Test (RED): every `catalogue.*` handler calls the session gate (`requireCatalogueSession`, gating on an active operator session per NFR-6a) first and refuses generically with no session / on tenant mismatch — `src/main/catalogue/__tests__/catalogue-bridge.gating.test.ts` — *gate unit (no_session / tenant_isolation / ok) + all 4 handlers session-gated. Tenant-isolation vs real product rows binds at S2.*
- [X] T015 [US1] Implement the `catalogue.*` bridge skeleton: typed handlers `lookupBarcode`/`lookupSku`/`search`/`resolve`, each `requireCatalogueSession`-first (the catalogue-side active-operator-session gate, mirrors 005/008), all returning a stub refusal — `src/main/catalogue/catalogue-bridge.ts` (+ `require-catalogue-session.ts` gate) — *gate-first then honest `catalogue_unavailable` stub (read model lands S2). Resolve refusal widened to carry the gate reasons (NFR-6a).*
- [X] T016 [US1] Wire the typed `catalogue.*` surface into the preload bridge (renderer-reachable, contextIsolation preserved) — `src/shared/bridge-api.ts`, `src/preload/index.ts` (+ `src/shared/catalogue/channels.ts`, `src/preload/catalogue.ts`) — *types + `catalogue?` member + thin preload wiring done. **Main-process `ipcMain.handle` registration in the composition root is deferred to S2** (needs session-manager wiring; nothing calls `catalogue.*` in S1 — shells are layout-only).*
- [X] T017 [P] [US1] Test (RED): component shells render in the cart-bearing shell (search input, scan-capture, result-list placeholder) — `src/renderer/ui/catalogue/__tests__/shells.test.tsx`
- [X] T018 [US1] Implement layout-only component shells (`ProductSearchInput`, `ScanCaptureField`, `SearchResultList`, `ProductConfirmPanel`, `NotFoundState`, `CatalogueUnavailableState`, `AmbiguousBarcodeState`) — `src/renderer/ui/catalogue/*.tsx` (+ `format-price.ts` integer-safe display helper; barrel `index.ts`) — *RTL Arabic-first; 3 distinct error tones; controlled/Rx badges + keyboard-nav deferred to S3/S4 per the slice plan.*
- [X] T019 [P] [US1] axe-clean + keyboard-path smoke on idle/error shell states — `src/renderer/ui/catalogue/__tests__/a11y.test.tsx` — *axe-clean on idle + 3 error states + confirm panel + populated list; 44×44 floor; no-focus-steal; colour-independence (icon decorative + heading text).*

## Phase 5 — Slice S2: `products`/`product_barcodes` migration + exact lookup + read repo + security review · gates §A0, §A1, §A2

**Goal:** Exact barcode/SKU lookup against the (empty-shipped) read model, tenant-scoped, with the ambiguity block and the catalogue-unavailable state.
**Independent test:** fixture-injected, exact barcode/SKU resolves the right single product; unknown→not-found; same-barcode-two-products→ambiguous-block; empty read model→catalogue-unavailable (distinct from not-found).

- [X] T020 [US1] Test (RED): migration creates `products` + `product_barcodes` + `name_fold`/`alias_fold` columns + indexes (barcode_norm, sku_norm, name_fold) — `tests/integration/catalogue/migrations.test.ts` **(§A2)**
- [X] T021 [US1] Author the migrations for `products` + `product_barcodes` + search-fold columns/indexes; tables ship **empty** (no seed rows) — `migrations/0029_create_products.sql` + `migrations/0030_create_product_barcodes.sql` **(§A2)**
- [X] T022 [US1] Test (RED): `product-repo` exact barcode lookup — one match / zero (not_found) / >1 active product (ambiguous) / inactive excluded / tenant-scoped — `src/main/catalogue/__tests__/product-repo.barcode.test.ts` — *also covers active+inactive-share-a-barcode → `one` (not ambiguous) and the normalize() round trip.*
- [X] T023 [US1] Test (RED): `product-repo` exact SKU lookup (one / zero / inactive / tenant-scoped) — `src/main/catalogue/__tests__/product-repo.sku.test.ts`
- [X] T024 [US1] Implement `product-repo.ts` read-only queries (barcode_norm + sku exact lookup; tenant filter; active guard; ambiguity detection via COUNT distinct product_id) — `src/main/catalogue/product-repo.ts` — *folds the raw query via `normalize()` internally (single `_norm` contract); columns `p.`-qualified to avoid the JOIN ambiguous-column trap; 100% stmt/func coverage.*
- [X] T025 [US1] Implement `catalogue.lookupBarcode` + `catalogue.lookupSku` handlers (normalize → repo → `one`/`not_found`/`ambiguous`/`catalogue_unavailable`) — `src/main/catalogue/catalogue-bridge.ts` — *`productRepo` is an OPTIONAL dep — absent ⇒ honest `catalogue_unavailable` (keeps the S1 gating test green); gate-first preserved.*
- [X] T026 [US3] Test (RED): catalogue-unavailable detection — empty / missing / unreadable read model all return ONE generic `catalogue_unavailable`, **distinct from `not_found`** (SC-10 matrix) — `src/main/catalogue/__tests__/catalogue-unavailable.test.ts`
- [X] T027 [US3] Implement the empty/missing/unreadable detection path feeding the `catalogue_unavailable` state (FR-24; staleness NOT surfaced, FR-24a) — `src/main/catalogue/product-repo.ts` — *empty = `catalogueHasRows()` false (**global**, not tenant-scoped — valid for the single-tenant-per-terminal MVP; see PR/security-review); missing/unreadable = caught query throw → `unavailable`, never rethrown across IPC.*
- [X] T028 [US1] Performance test: exact barcode/SKU lookup ≤50 ms p95 @ ~50k-row fixture (NFR-1) — `src/main/catalogue/__tests__/perf.exact.test.ts` — **as-built: correctness-at-scale, NO timing assertion.** A wall-clock p95 (absolute OR ratio) is irreducibly flaky under the parallel Vitest runner / sql.js; the test asserts the repo stays correct at ~50k rows. The authoritative ≤50 ms p95 is **T054 at §A5** on target hardware (008 bench-smoke precedent).
- [X] T029 [P] [US1] Extend cross-process redaction smoke to `catalogue.*` payloads (no raw query/PII/credential leakage; NFR-7) — `src/main/catalogue/__tests__/redaction.smoke.test.ts` — *asserts (a) central pino redaction scrubs forbidden keys nested in a catalogue payload, (b) the `one` snapshot surface carries zero forbidden keys (display-only allowlist). No new redaction key needed; the bridge logs nothing in S2.*
- [X] T030 [US1] Bridge-surface **security review** (mirrors 005 S2): walk the `catalogue.*` diff line-by-line; record findings — `specs/009-product-search-and-barcode-lookup/security-review/s2-review.md` — *CLEARED; risks R-WIRING / R-PERF-FIDELITY / R-CATCH-BREADTH logged (all LOW).*

## Phase 6 — Slice S3: folded substring search + ranking + cap + debounce + result list · gates §A0, §A2

**Goal:** Type-search by Arabic/English name + alias with both-sided folding, ranked, capped, keyboard-navigable.
**Independent test:** partial Arabic name (different alef form) and partial English (case/accent variant) both surface the product; an alias-only query surfaces its product; min-query-length guarded; results capped at 20 with a refine indicator; full keyboard navigation.

- [X] T031 [US2] Test (RED): `search.ts` folded substring match + ranking (exact-prefix > mid-string) + active-only + 20-cap + `truncated` flag — `src/main/catalogue/__tests__/search.test.ts` — *also covers LIKE-metachar escaping (pharma `%` literal), deterministic total order, and the unavailable-vs-not_found split.*
- [X] T031a [US2] Test (RED, **C2**): an **alias-only** query (matches `alias_fold` but not `name_fold`) returns the product; cross-script common name via alias resolves (FR-13) — `src/main/catalogue/__tests__/search.alias.test.ts`
- [X] T032 [US2] Test (RED): **SC-9 folding-recall corpus** — Arabic alef/yaa/taa-marbuta/harakat/tatweel variants + English case/accent variants → 100% recall, both-sided (FR-12a/b) — `src/main/catalogue/__tests__/search.folding-corpus.test.ts` — *14-case corpus incl. reverse (query carries the diacritic, stored bare).*
- [X] T033 [US2] Implement `search.ts` (fold query via `normalize.ts`; substring scan of `name_fold`/`alias_fold`; rank; cap 20; tenant + active filter) — `src/main/catalogue/search.ts` — *single-table on `products` (both fold cols); `ORDER BY rank(prefix-CASE), name_fold, product_id LIMIT 21` (21→truncated); `LIKE … ESCAPE '\'`. Wired via `ProductRepo.search`, reusing S2 `catalogueHasRows()`/try-catch→unavailable.*
- [X] T034 [US2] Implement `catalogue.search` handler (min-2-char/too_short guard FR-16; results/not_found/catalogue_unavailable) — `src/main/catalogue/catalogue-bridge.ts` — *guards on the NORMALIZED length (whitespace/diacritic-only → too_short).*
- [X] T035 [US2] Performance test: folded substring search ≤150 ms p95 @ ~50k-row fixture (NFR-2) — `src/main/catalogue/__tests__/perf.search.test.ts` — **as-built: correctness-at-scale, NO timing assertion** (LIKE `%q%` is a deliberate full scan, R4; wall-clock p95 is flaky under sql.js/parallel runner). Authoritative ≤150 ms p95 = **T054 §A5**. Seeds 50k ONCE (`beforeAll`/`afterAll`) — per-`it` re-seed timed out the 5000ms default under `--coverage`.
- [X] T036 [P] [US2] Test (RED): debounce (~150 ms typed only) + scanner bypass (terminator submits immediately, no debounce) (NFR-3, FR-8) — `src/renderer/stores/__tests__/useDebouncedSearch.test.ts` *(hook, not the FSM store — the FSM stays timer-free by design)*
- [X] T037 [US2] Wire debounce + scanner-bypass into the store and the search input — `src/renderer/stores/useDebouncedSearch.ts`, `src/renderer/ui/catalogue/ProductSearchInput.tsx` — *debounce lives in the `useDebouncedSearch` hook (FSM holds no timers); input is controlled, Enter = `onScanSubmit` (immediate, cancels pending), typing = `onType` (debounced, min-2).*
- [X] T038 [US2] Test (RED): result-list keyboard navigation (arrow moves selection, Enter selects) + result-row content (name Arabic-first, price, unit/pack, barcode/SKU) (FR-14, FR-17a) — `src/renderer/ui/catalogue/__tests__/SearchResultList.test.tsx`
- [X] T039 [US2] Implement `SearchResultList` + `SearchResultRow` (keyboard nav, ≥44×44, RTL, refine-indicator when truncated) — `src/renderer/ui/catalogue/SearchResultList.tsx`, `SearchResultRow.tsx` — *`aria-activedescendant` model (focus on listbox, Arrow moves active option clamped, Enter→onSelect, click selects); axe-clean.*

## Phase 7 — Slice S4: production R7 resolver wired into 005 cart seam + confirm-first add + duplicate-scan increment · gates §A0, §A1

**Goal:** Resolve a chosen/scanned product to the cart snapshot and add it through 005's existing path; duplicate scan increments via Q4 merge.
**Independent test:** with the resolver wired, scanning/selecting a known active product, confirming, adds it to the cart (Arabic `display_name` + `unit_price_minor` snapshotted); a re-scan increments the existing line; 005's fixture tests stay green; missing-field blocks add.

- [X] T040 [US1] Test (RED): production resolver satisfies the **§A1-ratified** 005 seam signature `{ display_name, unit_price_minor }` (no `version` — matches 005's live `ItemRefResolver`) and the `unknown_item`/`disabled`/`generic` refusals (resolver-seam.md) — `src/main/catalogue/__tests__/resolve-item-ref.test.ts` **(§A1)** — *also covers tenant isolation (P17) + catalogue-unavailable→generic (FR-24); asserts NO `version` field.*
- [X] T041 [US1] Implement `resolve-item-ref.ts` production resolver (map `name_ar`→display_name, `price_minor`→unit_price_minor; active guard→disabled; missing field→generic; `row_version` stays in the read model — `version` deferred per §A1/R9, NOT threaded) — `src/main/catalogue/resolve-item-ref.ts` **(§A1)** — *`item_ref` = `product_id` (exported `CATALOGUE_ITEM_REF_KIND` pins the scheme so T044/T046 can't drift). **As-built: a new `ProductRepo.resolveForSeam(tenant, productId)` was added to `product-repo.ts`** — the S2 `lookupBySku`/`lookupByBarcode` are `active=1`-filtered and structurally CANNOT produce `disabled`; the resolver needs the raw `active` flag, so a non-active-filtered tenant-scoped read was required. Money guard (`Number.isSafeInteger`, FR-19) lives on this resolve path, not on the read. unavailable→generic (no `no_connection` use; local lookup).*
- [X] T042 [US1] Test (RED): wiring 009's resolver into `cart-bridge.ts` `resolveItemRef` option replaces `DEFAULT_ITEM_REF_RESOLVER` in production; **005's existing cart fixture tests stay green** (seam unchanged) — `src/main/cart/__tests__/resolve-item-ref.wiring.test.ts` **(§A1)** — *packaged build + production resolver → known `product_id` resolves + line persists; unknown/inactive → generic cart refusal (reasons collapse to `wrong_owner` at `linesAdd`, locked at resolver level in T040); duplicate-scan → 005 merge (FR-21, one line). 005's `cart-wiring-production.test.ts` 3-case fixture matrix unchanged (they pass no `productionResolver`).*
- [X] T043 [US1] Wire 009's resolver into the cart bridge composition root (production path; fixture stays test-only) — `src/main/index.ts` **(§A1)** — *added optional `productionResolver?: ItemRefResolver` to `wire-cart-handlers.ts` `CartHandlersDeps` (cart factory stays ignorant of catalogue internals); **additive precedence**: dev+fixture-flag → fixture (unchanged), else → production resolver, else → DEFAULT (refuses). `index.ts` builds `createCatalogueResolver({ repo: createProductRepo(dbHandle), getTenantId: () => session?.tenant_id ?? '' })`. **Shipped as PR S4a (keystone); renderer add-flow T044–T049 follows as S4b.***
- [X] T044 [US1] Test (RED): confirm-first add — confirm panel → 005 `cart.lines.add`; no add before confirm (FR-5); missing required field → generic block, no partial line (FR-19/22) — `src/renderer/ui/catalogue/__tests__/CatalogueAddController.test.tsx` — *as-built: add-flow lives in the thin **`CatalogueAddController`** (per S4b plan), NOT in the presentational panel; test file named for the controller. Also covers render-gating (renders only in `confirm_pending`) + cancel + double-tap re-entrancy guard. Bridge injected via `bridge` prop (mirrors CartPane `_testBridge`).*
- [X] T045 [US1] Implement the add flow calling 005 `cart.lines.add` (no parallel mutation path; FR-20) — `src/renderer/ui/catalogue/CatalogueAddController.tsx` — *on `ok` → `onLineAdded`'s `addLine(res)` (CartPane's single write path) + `catalogueSearchStore.confirmAdd()`; on `refused` → stay `confirm_pending` + GENERIC block (no reason leak, FR-19), no partial line (FR-22). `item_ref = product_id`, quantity 1. `ProductConfirmPanel` stays presentational (`onAdd`/`onCancel`).*
- [X] T045a [US1] Test (RED, **C1**): the confirm panel and result row **surface** the `controlled_substance` / `prescription_required` flags (display only — NO enforcement; spec Out-of-Scope) — `src/renderer/ui/catalogue/__tests__/controlled-flag-surfacing.test.tsx`
- [X] T045b [US1] Implement controlled/Rx flag surfacing on the confirm panel + result row (badge/label; read-only; enforcement remains out of scope) — `src/renderer/ui/catalogue/ProductConfirmPanel.tsx`, `SearchResultRow.tsx` — *shared **`ControlledFlags.tsx`** badge component (colour-independent — each badge carries text, not colour alone); renders nothing when both flags false.*
- [X] T046 [US1] Test (RED): duplicate scan of an in-cart product **increments** the existing line via 005 Q4 merge, not a duplicate line (FR-21) — `src/renderer/ui/catalogue/__tests__/duplicate-scan.test.tsx` — *verifies the controller forwards `merged:true` through unchanged + re-uses the same `item_ref` on each scan (drives 005's merge). Surfaced a real bug: the in-flight `adding` guard was never reset on the success path → second add dead-locked; fixed by releasing `adding` on every exit.*
- [X] T047 [US1] Verify/implement duplicate-scan path delegating to 005's merge-by-`item_ref` (009 changes no cart behaviour) — `src/renderer/ui/catalogue/CatalogueAddController.tsx` — *no new merge logic: a re-scan re-calls `cart.lines.add` with the same `item_ref`; 005 merges + returns `merged:true`; CartPane's `handleAddLine` updates qty/version in place. 009 changes no cart behaviour.*
- [X] T048 [P] [US1] Test (RED): scanner Enter-suffix submits the lookup safely; does not leak into cart or trigger an unrelated default action (FR-8) — `src/renderer/ui/catalogue/__tests__/scan-terminator.test.tsx`
- [X] T049 [US1] Implement scan-terminator handling in `ScanCaptureField` (focus-confined wedge input; NFR-6) — `src/renderer/ui/catalogue/ScanCaptureField.tsx` — *controlled field; Enter → `preventDefault` (no leak to a surrounding form) + submit buffered value via `onScan` once + clear buffer; empty buffer / non-Enter keys submit nothing. `inputMode="none"` retained.*

> **S4b note (2026-05-31):** the confirm-add bridge call lives in a thin container **`CatalogueAddController.tsx`** (reads `cart_id` from `useCartStore().activeCart`, calls `cart.lines.add` via a `_testBridge`/`readCartBridge()` seam mirroring `CartPane`, then on `ok` → `onLineAdded`'s `addLine(res)` + `catalogueSearchStore.confirmAdd()`; on `refused`/rejection → stay `confirm_pending` + generic block, FR-19/22). `ProductConfirmPanel` stays presentational (`onAdd`/`onCancel`). No parallel cart-mutation path (FR-20). S4b is **decoupled from S4a** — tests mock the bridge response; the resolver is never imported.

## Phase 8 — Slice S5: final polish + production readiness · gate §A5

**Goal:** Runnable end-to-end add (T049a), consistency with S0, docs, perf bring-up on target hardware, agent-context update.
**Independent test:** scan→confirm→add runs live next to `CartPane`; all prior tests green; axe-clean across all states; full keyboard walkthrough; NFR-1/NFR-2 bring-up evidence recorded.

- [X] T049a [US1] **(folded into S5 from S4b planning, 2026-05-31 — owner decision)** Wire the catalogue surface into a cart-bearing route next to `CartPane`: mount the search/scan/result/confirm surfaces, thread `CartPane.onLineAdded` so a confirmed add appends/merges a line, and add the renderer cart-lifecycle entry point — `src/renderer/ui/catalogue/CatalogueSalePane.tsx` (new), `src/renderer/routes/app/CartPlaceholder.tsx`, `src/renderer/stores/feature-flags-store.ts`, `src/shared/app-config.ts`, `src/main/index.ts` — *as-built (spec [`2026-05-31-009-t049a-catalogue-live-wiring-design.md`], plan [`2026-05-31-009-t049a-catalogue-live-wiring.md`]; subagent-driven, 5 tasks): closed **two** missing wirings, not one. **(a) search/scan→FSM execution:** new `CatalogueSalePane` container — typed `ProductSearchInput.onSearch`→`catalogue.search`, scan `ScanCaptureField.onScan`→`catalogue.lookupBarcode`, each response mapped to `catalogueSearchStore` (results/one→confirm_pending/not_found/ambiguous/catalogue_unavailable; too_short/refused→idle; bridge-rejection→idle). Nothing drove the FSM before, so the S4b confirm→add half never fired live. **(b) confirm→cart:** eager `cart.create` on mount (`creatingRef`-deduped; the SOLE renderer `cart.create` caller; refusal/rejection leaves `activeCart` null, retried on a later mount); `cartId` sourced from the cart store; mounted in the **Cart workspace** (`CartPlaceholder`) behind a NEW fail-closed **`productSearch`** flag, gated `cart && productSearch`. A `CartWorkspace` child bridges CartPane's `onLineAdded` REGISTER-callback (`(addLine)=>void`) to the controller's actual `(res)=>void` via a stable ref wrapper (no parallel cart mutation, FR-20). `ProductConfirmPanel`/`CatalogueAddController` UNCHANGED. Session-gating is enforced by layering (CartPane renders only when signed in; main-process `cart.create` gates on `requireOperatorSession`). **Empty-catalogue caveat:** `products` ships empty, so a live build exercises only `catalogue_unavailable`/`not_found` — fixture/seed data for a happy-path demo is a DEFERRED prerequisite for T050/T056 (see below), NOT in T049a. Tests inject the bridge — decoupled from the real read model.*
- [ ] T049b [US1] **(added 2026-05-31 — T049a out-of-scope seed prerequisite)** Dev-only fixture seed for `products`/`product_barcodes` so the live happy-path (scan/search→confirm→add) and the S5 review tasks can exercise real rows. `products` ships empty by design (AD-2); a packaged build only shows `catalogue_unavailable`/`not_found` until seeded. Approach TBD (dev-flag seed loader vs documented manual insert) — **gates T050 (screenshot review) + T056 (keyboard walkthrough)**. — `src/main/catalogue/*` (dev seed) or `docs/`
- [ ] T050 [US1] Screenshot/contact-sheet review of the live surfaces against S0; record consistency fixes — `specs/009-product-search-and-barcode-lookup/visual-direction/s5-screenshot-review.md`
- [ ] T051 [P] axe-clean across all states (idle/searching/results/not-found/catalogue-unavailable/ambiguous/confirm) — `src/renderer/ui/catalogue/__tests__/a11y.full.test.tsx`
- [ ] T052 [P] Author the support runbook + failure-mode catalogue — `docs/runbook/product-search.md` **(§A5)**
- [ ] T053 [P] Author the rollback strategy note (forward-fix preferred; read-only schema is low-risk) — `specs/009-product-search-and-barcode-lookup/rollback.md` **(§A5)**
- [ ] T054 Performance bring-up on target Windows hardware @ ~50k-row fixture; record NFR-1/NFR-2 evidence; if search misses ≤150 ms, trigger R4 FTS5-fallback review (R-RISK-1) — `specs/009-product-search-and-barcode-lookup/perf-bringup.md` **(§A5)**
- [ ] T055 Update the `<!-- SPECKIT START -->` active-feature block in `CLAUDE.md` to reflect 009 implementation status — `CLAUDE.md`

## Phase Final — Polish & cross-cutting

- [ ] T056 [P] Full keyboard-only walkthrough of every story (scan→confirm→add, search→select→add, duplicate-scan) with no mouse (SC-1) — manual + `src/renderer/ui/catalogue/__tests__/keyboard-walkthrough.test.tsx`
- [ ] T057 [P] Coverage-gate verification: ≥95% `catalogue-bridge.ts`, ≥95% `normalize.ts`, ≥90% `catalogueSearchStore` (Constitution VI) — CI report
- [ ] T058 Final `npm run codegen:verify && npm run typecheck && npm run lint && npm test` green with the full 009 diff — CI

---

## Dependency Graph

```
Setup (T001–T004)
   │
Foundational (T005–T008: normalize.ts + store FSM)  ← blocks S2/S3
   │
S0 visual direction (T009–T013)  ──§A0──┐
   │                                     │ (every slice waits on §A0)
S1 bridge skeleton + gating (T014–T019) ─┤ §A1
   │                                     │
S2 migration + exact lookup (T020–T030) ─┤ §A2  ← US1 exact-lookup + US3 catalogue-unavailable
   │                                     │
S3 folded search (T031–T039) ────────────┤ §A2  ← US2 search (needs normalize.ts from Foundational)
   │                                     │
S4 resolver wiring + add (T040–T049) ────┘ §A1  ← US1+US2 add-to-cart (shared path); needs S2 repo
   │     • S4a = R7 resolver + cart wiring (main-process, PR #325)
   │     • S4b = confirm-first add + flags + scan terminator (renderer, PR #326)
   │
S5 polish + readiness (T049a, T050–T055) ── §A5
   │     • T049a = screen composition + cart lifecycle (makes scan→confirm→add RUNNABLE;
   │               prerequisite for T050 screenshot review + T056 keyboard walkthrough)
   │
Final (T056–T058)
```

**Cross-cutting note:** US1 ("add") and US2 ("search→add") both complete only at **S4** (shared
add-to-cart path). US3 (catalogue-unavailable + offline) is detected in S2 and asserted across every
lookup phase — it is not a standalone increment. This is why phases = slices, not stories (mirrors 005).

## Parallel Execution Examples

- **Setup:** T003 + T004 run in parallel (different files: snapshot type vs bridge-API types).
- **Foundational:** T007 (store test) is `[P]` with T005/T006 (normalize) — different files.
- **S0:** T010/T011/T012 are `[P]` (independent mock sections) after T009 seeds the sheet.
- **S2:** T029 (redaction smoke) is `[P]` with the lookup-impl tests; migration (T020/T021) must
  precede repo tests (T022+).
- **S5:** T049a (screen composition) runs FIRST — it makes the live path exist; T051/T052/T053 then
  run in parallel (a11y vs runbook vs rollback — different files); T050/T056 need T049a's mounted surface.

## Implementation Strategy

**MVP = Foundational + S0 + S1 + S2 + S4-(US1 subset).** That yields the constitutional primary path:
*scan a barcode → confirm → add to cart*, offline, session-gated, with the not-found / ambiguous /
catalogue-unavailable states. **S3 (folded text search)** is the next increment (US2). **S5** is
production-readiness hardening.

**Incremental delivery order:** S0 → S1 → S2 → S4 (US1 scan-to-cart MVP) → S3 (search) → S5 (readiness).
Each slice is an independently reviewable PR (≤ ~600 LOC target, P13). No slice merges before its gate
clears and its S0-review/axe/redaction/`npm test` per-slice gates pass.

**Gate reminder:** nothing starts until §A0 lifts; S2/S3 also need §A2 (migration), S1/S2/S4 need §A1
(seam ratified), S5 needs §A5 (readiness). 009 is NOT gated by 008's open §A5 (009 *produces* the
snapshot 008 consumes; no dependency the other way).
