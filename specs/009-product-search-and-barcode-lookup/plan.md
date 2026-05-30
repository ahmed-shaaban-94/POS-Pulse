# Implementation Plan: Product Search & Barcode Lookup

**Feature ID:** 009-product-search-and-barcode-lookup
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-05-30
**Last Updated:** 2026-05-30
**Constitution version pinned:** v1.5.1
**Branch:** `009-product-search-and-barcode-lookup` (spec dir; git branch independent)

> **Constitution-version note (2026-05-30, revised per PR review):** 009 pins **v1.5.1** to match the
> latest recorded amendment and the convention of sibling specs (`005/plan.md:8`,
> `008/data-model.md:8`). The constitution **does** record this amendment in its header SYNC IMPACT
> REPORT (`constitution.md:4`, "Version change: 1.5.0 → 1.5.1" — a PATCH clarification of Principle
> VIII). Note an **inconsistency in the constitution itself**: its footer (`constitution.md:1329`)
> still reads `**Version:** 1.5.0` while the header records 1.5.1 — i.e. the footer was not bumped.
> The authoritative version is 1.5.1 (latest recorded amendment); the stale footer is flagged for a
> separate governance correction (out of scope for this feature). The v1.5.1 amendment only clarifies
> Principle VIII (custom user-DB vs local terminal unlock factor); 009 introduces no identity
> primitive, so the Constitution Check below holds verbatim under either version.

> ⚠️ **Planning artifact only.** `/speckit-plan` writes NO source, NO migrations, NO codegen, NO
> package installs. Phase 0 ([research.md](./research.md)) and Phase 1 ([data-model.md](./data-model.md),
> [contracts/](./contracts/), [quickstart.md](./quickstart.md)) are co-resident with this plan.
> Implementation slices S0–S5 are held behind the per-slice approval gates (§A0–§A5) below.

---

## Summary

Feature 009 is the **product read/search/resolve layer** that sits *upstream* of the 005 cart. It is
the feature 005's research §R7 named as "the future item-catalogue feature" — it **implements the
`cart.resolveItemRef` seam** that 005 stubbed with a fixture (005 quickstart `cart-bridge.ts:85-86`
`DEFAULT_ITEM_REF_RESOLVER` refuses generically; production leaves it unwired). 009 wires a *real*
resolver behind that fixed seam and adds the two cashier-facing ways to find a product at the till:
**barcode scan** (keyboard-wedge) and **typed search** (SKU, barcode, Arabic/English name, alias).

009 owns: a local, offline-first **product read model** (schema + indexes + read/query/resolve path);
exact barcode/SKU lookup; normalization-insensitive Arabic+English substring name search; the
sellable guard; the confirm-first add flow; and the resolution that produces the snapshot the cart
consumes. 009 does **NOT** own: catalogue population / sync / ingestion (the table ships empty;
production shows the "catalogue unavailable" state until a future sourcing feature fills it); cart
mutation (005 owns `cart.lines.add` + merge); inventory / batch / FEFO / expiry; controlled-substance
enforcement; or any change to payment (006), finalization, or receipt (008) logic.

**Spec ↔ plan reconciliation (explicit, per 005-plan precedent).** The spec says "009 assumes a
*pre-existing* local product read model… it reads it, does not author it." This plan **authors the
read-model schema + indexes** (R1 below). The two are consistent: *"pre-existing"* means **009 does
not populate or sync the table** — that is the future sourcing feature's job; it does NOT mean 009
declines to *define* the table it reads. Without 009 defining the schema, the table is orphaned (no
`010-catalogue-sourcing` feature exists). 009 defines the read model and ships it empty; a future
feature fills it. This mirrors 005's R7-fixture pattern one layer down.

## Technical Context

009 is a renderer + main-process feature on the existing 001–008 Electron foundation. It expands the
preload bridge under a new read-only namespace (`catalogue.*`), introduces a new main-process module
`src/main/catalogue/`, and adds one new local SQLite table (the product read model) plus its search
index. It introduces **no** money arithmetic (it is a *conduit* for `price_minor`), no new identity
primitive, and no new connection-state visual.

| Area | Choice | Source |
|:--|:--|:--|
| Runtime / packaging | Electron `^40` Windows 10/11 x64 (inherited) | constitution v1.5.1 / plan 001 |
| Renderer | React `^19` + Vite `^8` + TypeScript `^5.6`+ strict (inherited) | plan 001 |
| Styling | Tailwind `^4` (CSS-first); design tokens from 003/007 (`src/renderer/ui/tokens/`) | 003 / 007 |
| Routing | The search/lookup surface is **embedded in 003's `/app/*` shell** alongside the 005 cart pane; no new top-level route. Guarded by 004's `<OperatorRouteGuard>` (renderer-side, **secondary**; bridge gate is primary). | 003 / 004 |
| Renderer state (query, debounce, result list, pending-confirm product, focus) | Existing `zustand`. New slice `catalogueSearchStore`: query/normalized-query, in-flight flag, ranked results (capped), selected index, pending-confirm product, state ∈ {`idle`, `searching`, `results`, `not_found`, `ambiguous`, `catalogue_unavailable`, `confirm_pending`}. Mirrors **only** what the bridge confirms. | research §R8 |
| Server-state hooks | Existing `@tanstack/react-query` MAY wrap the bridge calls for caching; **no live backend** in 009's scope (offline-first; the read model is local). | NFR-3 / R1 |
| Component primitives | Reuse 003/007 `src/renderer/ui/` (Input, Card, ListBox, Toast, StatusBanner, Dialog). NEW under `src/renderer/ui/catalogue/`: `ProductSearchInput`, `ScanCaptureField`, `SearchResultList`, `SearchResultRow` (≥ 44×44 CSS px hit areas), `ProductConfirmPanel`, `NotFoundState`, `CatalogueUnavailableState`, `AmbiguousBarcodeState`. **Layout-only / Slice 0** until §A0 lifts. | constitution P14 / spec FR-14, FR-17a |
| Density / touch targets | Inherit 003/007 `comfortable` density + the 44×44 CSS-px floor. Result rows, confirm-panel buttons, retry affordances MUST honour it. | constitution Platform §Hardware / spec NFR-5 |
| Localization | **Load-bearing.** Arabic-first RTL default; Latin numerals in receipts unaffected (009 prints nothing). Search normalization (Arabic letter folding + English case/accent folding + numeral folding, both-sided) is the feature's hardest correctness surface (R4). | constitution Localization / spec FR-12a/b |
| Connection-state model | Inherit 003's four states. 009 introduces none. Search/scan work fully offline (R1); a disconnected network never blocks lookup. | 003 / spec FR-23 |
| Identity / role model | Inherit verbatim from 004. No 009-specific identity. Every lookup gates on the active operator session. | 004 / spec NFR-6a |
| Bridge surface (NEW, gated) | `src/shared/bridge-api.ts` extended with a read-only `catalogue.*` namespace (`catalogue.lookupBarcode`, `catalogue.lookupSku`, `catalogue.search`, `catalogue.resolve`). Each handler's first instruction is `requireOperatorSession` (NFR-6a). Authored in `contracts/bridge-api.md`; wired post-§A0. | spec NFR-6a / R6 |
| R7-seam wiring | 009 wires the **production** `resolveItemRef` resolver into the 005 cart bridge — the injection point 005 left unwired (`cart-bridge.ts` constructor option; `src/main/index.ts`). The seam signature `{ display_name, unit_price_minor, version } \| { kind:'refused', … }` is **fixed by 005** and NOT redesigned (R7). | 005 contracts/bridge-api.md:416 / R7 |
| Local persistence | NEW SQLite table: `products` (the read model) + a search index (FTS5 vs normalized-fold column decided in R4). **No migration authored by `/speckit-plan`** — gated on §A2. The table ships **empty**; tests inject fixtures; production shows "catalogue unavailable" until a future sourcing feature populates it. | data-model.md / R1 / R4 |
| Money | **Conduit only.** 009 carries `price_minor` as integer minor units end-to-end and performs **zero** arithmetic. No subtotal, no tax, no rounding. | constitution P1 / R5 |
| Tests | Vitest only. Coverage gates: ≥ 95 % on the bridge-side `catalogue.*` gate; ≥ 95 % on the normalization/folding module (load-bearing correctness, R4); ≥ 90 % on `catalogueSearchStore`; cross-process redaction smoke extends to `catalogue.*` payloads (no PII/raw-catalogue leakage). Per-surface axe pass on idle / searching / results / not-found / catalogue-unavailable / confirm variants. | constitution VI / Test Strategy |
| CI | No workflow changes; the existing `codegen:verify → typecheck → lint → test → package:dir` pipeline gates this feature. | 001 |

### Hard Non-Implementation Boundaries

Any task drifting into these MUST be filed as a separate feature, not folded into 009:

- **No catalogue population / sync / ingestion.** 009 defines + reads the `products` table; it never
  fills it, syncs it from the backend, or authors an import path. The future catalogue-sourcing
  feature owns that. The table ships empty.
- **No catalogue write / "add product" creation.** An unknown barcode routes to a recoverable
  not-found state; *creating* a product record is a future catalogue-management feature.
- **No cart mutation.** 009 calls 005's existing `cart.lines.add` through the renderer; it adds no
  parallel mutation path and changes no cart behavior (including the Q4 merge that powers duplicate-scan
  increment).
- **No payment / finalization / receipt changes.** 006 and 008 are consumed unchanged; 009 only
  *produces* the line snapshot they read downstream.
- **No inventory / stock / batch / FEFO / expiry / returns / discounts / loyalty / reports / analytics.**
- **No backend / OpenAPI surface.** No new endpoint designed or pinned. Offline-first; no live catalogue
  fetch from within 009 (unless the owner explicitly approves a sync surface — out of scope here).
- **No native scanner SDK.** Keyboard-wedge HID only (constitution Hardware Matrix).
- **No controlled-substance / Rx enforcement.** 009 MAY *surface* the flags on a result; enforcement
  (supervisor override at sale time) is out of scope.
- **No money arithmetic.** 009 carries `price_minor`; it computes nothing.
- **No Data-Pulse legacy copy-paste** (Principle IX); re-derive from constitution + 005/006/008 plans.
- **No weakening of 001–008 security boundaries** (`contextIsolation`/`nodeIntegration`/`sandbox`,
  no upward-of-bridge IPC, integer-minor-units money, log/Sentry redaction, bridge-side role gating).

## Architectural Decisions

### AD-1. Lookup gated at the bridge surface (primary); renderer store is secondary UX defence

**Choice.** Every `catalogue.*` bridge handler's first executable instruction is
`requireOperatorSession({ /* no role restriction beyond an active session */ })`, delegating to 004's
`src/main/operator/role-enforcement.ts` (the same helper 005 uses). The `products` table lives in the
main process (SQLite is main-process per Constitution Principle III); the renderer reaches it only
through the bridge. `catalogueSearchStore` mirrors only bridge-confirmed results.

**Why.** Spec NFR-6a (clarified 2026-05-30). The read model is main-process, so *every* lookup crosses
the bridge regardless — there is no renderer-only path to leave ungated. Gating on an active operator
session (not merely a paired terminal) matches the cart's add path; a looser gate would create a
search-but-can't-add dead window. Generic refusal on no-session / wrong-tenant, reason logged for
diagnostics, never echoed to the cashier (004 PR-2 discipline inherited).

**Alternative rejected: renderer-store-only gate.** Trivially bypassed by direct preload calls;
forbidden by Principle III. **Alternative rejected: gate on paired terminal only.** Creates the dead
window above; rejected per NFR-6a.

### AD-2. 009 owns the product read-model **schema**, not its **population**

**Choice.** 009 authors one new SQLite table `products` (read model) + its search index (R4). The
table ships **empty**. Tests inject a fixture set; production shows the FR-24 "catalogue unavailable"
state until a future catalogue-sourcing feature populates the table. 009 exposes **read-only** bridge
handlers; it has **no** insert/update/delete path for product rows.

**Why.** No `010-catalogue-sourcing` feature exists, so an unauthored table would be orphaned
(Constitution P12 — artifacts are source of truth; a table nobody defines cannot be the truth). Yet
*sourcing* (sync semantics, server-of-truth pricing, price-change auditing) is a distinct scope
(Constitution P16) that 009 must not absorb. Owning the read shape while deferring the write shape is
the honest split — identical in spirit to 005's R7 fixture-seam.

**Alternative rejected: assume the table exists, author nothing.** Orphaned schema; `/speckit-analyze`
flags the spec↔plan gap. **Alternative rejected: 009 also owns sourcing/sync.** Scope creep across the
P16 boundary; sync + price-authority + price-change audit are their own feature.

### AD-3. New `src/main/catalogue/` module wires the production R7 resolver behind 005's fixed seam

**Choice.** The resolver implementation lives in a **new** `src/main/catalogue/` module (resolver,
read queries, normalization, search), NOT in `src/main/cart/`. 009 wires its production resolver into
the 005 cart bridge at the injection point 005 left unwired — the `cart-bridge.ts` `resolveItemRef`
constructor option (currently falling back to `DEFAULT_ITEM_REF_RESOLVER`, which refuses generically).
The seam signature is **fixed by 005** and is NOT changed.

**Why.** Separation of modules keeps 005's cart surface stable and 009's catalogue surface
self-contained (Constitution coding-style: small, single-purpose modules). The seam is a published
cross-feature contract (005 contracts/bridge-api.md:416-427); 009 satisfies the signature and
implements behind it — it does not renegotiate it. This is the keystone integration of the feature.

**Alternative rejected: extend `src/main/cart/` with catalogue logic.** Bloats 005's module and
couples the two features' internals. **Alternative rejected: change the seam signature.** Breaks 005's
published contract and its fixture tests; rejected.

### AD-4. The resolver `version` token = product row-version provenance, currently unconsumed

**Choice.** The 005 seam returns `version: string` per line; 009 populates it with a **product
row-version / updated-at token** (a stable per-product change marker from the read model). The cart
consumes only `display_name` + `unit_price_minor` from the seam into the line snapshot
(005 bridge-api.md:131); `CartLine.version` is a **separate** monotonic optimistic-concurrency token,
NOT this resolver `version`. The resolver `version` is therefore **carried but currently unconsumed**
provenance — reserved for a future cache-invalidation / staleness use.

**Why.** Resolves the item deferred from `/speckit-clarify` (the signature was the spec decision; the
*meaning* is this plan's). Defining it minimally satisfies the seam signature without inventing a
consumer that doesn't exist (Constitution P16 — don't build unused machinery; just don't lie about the
field's provenance either).

### AD-5. Money is a pass-through; 009 performs zero arithmetic

**Choice.** 009 carries `price_minor` (integer minor units) from the read model into the resolver
output and the search-result display. It computes **no** subtotal, tax, discount, rounding, or change.
The cart computes `line_subtotal_minor = quantity × unit_price_minor` (005 AD-4); 006/008 compute
sale-level VAT and totals.

**Why.** Constitution P1 (money is integer minor units; floats forbidden). 009 sits in the same trust
line as a sales total — a wrong `price_minor` propagates into a wrong sale — so the *integrity* of the
carried value is load-bearing even though 009 does no math. Carry-only keeps the boundary clean.

### AD-6. The Product Snapshot carries the full sellable surface; only `display_name`+`unit_price_minor` are threaded downstream **today**

**Choice.** The resolved Product Snapshot (Key Entities) carries the brief's minimum sellable surface:
`product_id`, selling barcode + SKU, Arabic **and** English display names, `price_minor`, tax/category
metadata, unit/pack label, sellable flag — PLUS the seam's `display_name` + `unit_price_minor` +
`version`. **However**, only `display_name` (a *single* name) + `unit_price_minor` are threaded into
the cart line and onward through the `PaymentIntentEnvelope` to 008 **today**.

**Why (verified against 008).** 008 locked **OQ-3 → sale-level VAT only for MVP** (no per-line tax
through the envelope) and **slice2-mapping-pass §Gap-2 → a single `display_name` per line** (bilingual
per-line names considered and *deferred for v1*). So per-line tax/category and the second (English)
name are **not** consumed downstream yet. 009's read model still carries them because (a) the brief
requires them as minimum fields and (b) search/display/confirm need them. They are **forward-looking
provenance** for when 008/receipts choose to consume them — the same honest pattern as AD-4's
`version`. The plan states this so `/speckit-analyze` does not read "tax metadata in the snapshot" as a
claim that tax flows to the receipt today.

**Implication for `/speckit-tasks`.** The Arabic-first display name fed to `cart.lines.add` is the
single `display_name` the cart/receipt render; the English name and tax/category live in the read
model and the resolver output for *search and confirm*, not in the cart line.

## Constitution Check (Initial)

Walked across Core Principles I–IX and Cross-Feature POS Principles P1–P18 (constitution v1.5.1).

### Core Principles (I–IX)

| Principle | Status | Notes |
|:--|:--:|:--|
| I. Offline-First (NON-NEGOTIABLE) | **PASS-load-bearing** | Search/scan/resolve run entirely against the local `products` read model; no network round-trip in the lookup path (FR-23). The "catalogue unavailable" state (FR-24) is the honest offline answer when the table is empty/unreadable. |
| II. Financial Precision — No Floats | **PASS-conduit** | AD-5: `price_minor` carried as integer minor units; zero arithmetic. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | **PASS** | `products` SQLite access is main-process only. New IPC is the enumerable `catalogue.*` namespace; renderer never imports Node modules. Resolver wiring respects 005's bridge boundary. |
| IV. Hardware Loud, Not Silent | **PASS** | Wedge scanner = keyboard input (no driver). Unknown scan surfaces a loud, recoverable not-found state (never a silent failure or hard error). Focus-management keeps stray scans out of unrelated fields (NFR-6). |
| V. Type Safety End-to-End | **PASS** | `catalogue.*` calls typed in `src/shared/bridge-api.ts`. The resolver satisfies 005's typed seam. No `any`. |
| VI. Test-First, Coverage-Gated | **PASS** | Failing tests first per slice. ≥ 95 % on bridge gate + normalization module; ≥ 90 % on the store. |
| VII. Observability | **PASS-with-extension** | New pino sites: lookup outcome category (hit / not-found / ambiguous / catalogue-unavailable), search latency. **Each site pairs with redaction** — no product PII beyond permitted snapshot fields, no raw query echo containing potential PII, no credential fragment (NFR-7). Sentry scrubber updated symmetrically. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | **PASS-inherited** | No new identity primitive. Lookup attributes to the active operator session (Clerk-backed); the local PIN factor plays no role. |
| IX. Reference, Not Inheritance | **PASS** | No legacy catalogue code consulted; re-derived from constitution + 005/006/008. No copy-paste from `_reference/Data-Pulse/`. |

### Cross-Feature POS Principles (P1–P18)

| Principle | Status | Notes |
|:--|:--:|:--|
| P1. Financial Correctness First | **PASS-conduit** | AD-5. `price_minor` integrity preserved; no math. |
| P2. No Fake Success States | **PASS** | A product is shown as added only after the bridge confirms the cart add (005 owns the confirm); confirm-first flow shows the resolved product *before* commit, never a fake "added". |
| P3. No Silent Data Loss | **PASS** | 009 is read-only on the catalogue; no write to lose. A failed lookup yields a recoverable state, never a silent drop. |
| P4. Auditability / Non-Destructive | **N/A-read-only** | 009 mutates no financial state; lookups are not audit-eligible sensitive actions (no void/discount/override here). Surfacing a controlled-substance flag is read-only. |
| P5. Idempotency for Retried Operations | **PASS-inherited** | Lookups are pure reads (naturally idempotent). The *add* carries 005's idempotency key (005 owns it); a duplicate scan increments via the Q4 merge, not a double-add. |
| P6. No Raw Cardholder Data | **N/A** | No card data at the lookup layer. |
| P7. Secrets Never Reach Renderer/Logs | **PASS** | No secrets in `catalogue.*` payloads. Query text and product fields are redacted per NFR-7 before logging. |
| P8. Electron Security Boundary | **PASS-with-justified-expansion** | 009 owns the `catalogue.*` bridge expansion explicitly; S2 security-review walks the diff line-by-line (mirrors 005 S2). |
| P9. Truthful Offline / Degraded / Sync States | **PASS** | No new connection visual. "Catalogue unavailable" is distinct from "product not found" (FR-24) — an honest state, not a degraded-network lie. Staleness is NOT surfaced (009 owns no freshness marker, FR-24a). |
| P10. Operator Accountability | **N/A-read-only** | No sensitive action originates in 009. |
| P11. Supportability Without Secret Leakage | **PASS** | New log sites pair with redaction; support-bundle export runs the same pipeline; query text redacted. |
| P12. Spec Kit Artifacts Are Source of Truth | **PASS** | This plan + spec + future tasks are the truth. The spec↔plan "pre-existing vs authored" reconciliation is stated explicitly (Summary + AD-2). |
| P13. Small, Scoped Implementation PRs | **PASS** | Slice strategy below produces small PRs; S0 non-code; S1–S5 each ≤ ~600 LOC target. |
| P14. Accessibility / Cashier Ergonomics | **PASS-load-bearing** | Fully keyboard-operable: scan + arrow-navigate results + Enter-select + confirm, no mouse (NFR-5, SC-1). Result rows + confirm buttons ≥ 44×44 CSS px. axe-clean across all states. RTL Arabic-first. |
| P15. Production Readiness Gates | **PASS-with-deferral** | 009 is production-affecting (lookup is on the checkout critical path). Production-readiness subsection names the test plan / rollback / runbook / failure-mode catalogue. **The production-rollout PR cannot deliver end-user value until a catalogue-sourcing feature populates the table** — products can't be found if the catalogue is never filled (mirrors 005's "carts opened but not paid"). §A5 codifies. |
| P16. Feature Scope Discipline | **PASS** | Hard Non-Implementation Boundaries restate the spec's Out-of-Scope. AD-2 prevents sourcing creep; AD-3 prevents cart-module creep. |
| P17. Privacy and Tenant Isolation | **PASS** | `products` carries `tenant_id` (+ `branch_id` if branch-scoped per R1). Lookups are tenant-scoped at the bridge; a tenant-A product is invisible to a tenant-B session. |
| P18. Local Durability Before Offline Promises | **PASS** | The read model is local SQLite; lookups survive restart. 009 makes no promise it cannot keep offline (the only "promise" is read availability, which is local). |

**Gate result: PASS-with-deferral.** Implementation slices are held on §A0 (visual-direction + 005
seam-wiring coordination), §A1–§A5 below. The two deferrals (P15 needs a future sourcing feature for
end-user value; AD-6 forward-looking snapshot fields) are documented, not silent.

## Phase 0 — Research

See [research.md](./research.md). Summary (decision; rationale + alternatives in research.md):

- **R1. Product read-model schema & ownership — RESOLVED (AD-2): 009 authors `products` schema +
  indexes; ships empty; read-only; population deferred to a future sourcing feature.** Fields per
  data-model.md. Scoping: `tenant_id` mandatory; `branch_id` optional (branch-scoped availability is a
  future concern — MVP is tenant-scoped, all-branch).
- **R2. Barcode → product mapping & one-to-many ambiguity — RESOLVED: a `product_barcodes` child table
  (a product has ≥1 barcode) with an index on the barcode value; a barcode resolving to >1 active
  product is the ambiguity block (FR-7), detected by a `COUNT(*)>1` on the indexed lookup.**
- **R3. Exact lookup performance — RESOLVED: covered B-tree indexes on `barcode` and `sku` give the
  ≤50 ms p95 exact-lookup budget trivially at 50k rows (effectively O(1), the constitutional bound).**
- **R4. Folded substring search mechanism — RESOLVED (the hard one): a precomputed
  normalized-fold column (`name_fold`) populated at row-write time, queried with a bounded substring
  scan, with FTS5 evaluated and rejected for MVP.** Both query and stored name are folded identically
  (FR-12b). The fold covers Arabic letter forms + English case/accent + numerals + whitespace (FR-12a).
  See research.md R4 for the FTS5-vs-fold-column trade study and the better-sqlite3 / no-FTS5-in-repo
  finding.
- **R5. Money pass-through — RESOLVED (AD-5): `price_minor` carried, never computed.**
- **R6. `catalogue.*` bridge namespace shape — RESOLVED: read-only handlers `lookupBarcode`,
  `lookupSku`, `search`, `resolve`; each gates on the active session (AD-1).** See contracts/bridge-api.md.
- **R7. R7-seam wiring — RESOLVED (AD-3): production resolver in `src/main/catalogue/` wired into
  005's `cart-bridge.ts` `resolveItemRef` constructor option; signature fixed by 005.**
- **R8. Search-store FSM & debounce — RESOLVED: 7-state store; ~150 ms debounce on typed search only;
  scanner input (terminator-submitted) bypasses debounce and submits immediately (NFR-3).**
- **R9. Resolver `version` semantics — RESOLVED (AD-4): product row-version provenance, currently
  unconsumed.**

## Phase 1 — Design & Contracts

Phase 1 deliverables co-resident with this plan:

- **[data-model.md](./data-model.md)** — entities `Product`, `ProductBarcode`, `ProductSnapshot`
  (resolver output), `SearchQuery`, `SearchResult`. One new SQLite table `products` + child
  `product_barcodes` + the `name_fold` search column/index (conceptual; SQL gated on §A2).
- **[contracts/bridge-api.md](./contracts/bridge-api.md)** — the read-only `catalogue.*` namespace and
  the wiring of the **fixed** 005 `cart.resolveItemRef` seam.
- **[contracts/resolver-seam.md](./contracts/resolver-seam.md)** — the exact 005 seam signature 009
  satisfies, the injection point, and the field-mapping (read-model → resolver output → cart line),
  including the AD-6 "carried but not threaded downstream today" boundary.
- **[quickstart.md](./quickstart.md)** — reviewer's per-story walkthrough.

## Project Layout

```
src/
  main/
    catalogue/                 NEW (009)
      catalogue-bridge.ts      catalogue.* handlers (requireOperatorSession first)
      product-repo.ts          read-only queries against products / product_barcodes
      resolve-item-ref.ts      production resolver wired into 005's cart seam
      normalize.ts             Arabic + English folding (load-bearing; ≥95% cov)
      search.ts                folded substring search + ranking + cap
    migrations/                NEW migration for products + product_barcodes + name_fold (gated §A2)
  shared/
    bridge-api.ts              extended: catalogue.* namespace types
    catalogue/
      product-snapshot.ts      ProductSnapshot type (cross-module shape)
  renderer/
    ui/catalogue/              NEW components (S0 layout-only first)
    stores/catalogueSearchStore.ts   NEW zustand slice (7-state FSM)
specs/009-product-search-and-barcode-lookup/   this plan + artifacts
```

## Test Strategy

- **Vitest only** (renderer + main + logic), `happy-dom` DOM env, `@testing-library/react`,
  `expectNoAxeViolations` for a11y smoke.
- **Coverage gates:** ≥ 95 % on `catalogue-bridge.ts` (session-gate, generic refusal, tenant isolation,
  not-found, ambiguous, catalogue-unavailable paths); ≥ 95 % on `normalize.ts` (the load-bearing
  folding module — Arabic alef/yaa/taa-marbuta/harakat/tatweel + English case/accent + numerals +
  whitespace, both-sided); ≥ 90 % on `catalogueSearchStore`.
- **Folding test corpus** (SC-9): a representative set of Arabic name variants (alef/yaa/taa-marbuta
  forms, with/without harakat/tatweel) and English case/accent variants, asserting 100 % recall.
- **State-distinction tests** (SC-10): empty / missing / unreadable read model all resolve to the
  single "catalogue unavailable" state, *distinct* from per-query "product not found" — zero
  misclassification across the matrix.
- **Performance tests:** exact lookup ≤ 50 ms p95 and folded search ≤ 150 ms p95 at a ~50k-row fixture
  catalogue on target hardware (NFR-1/NFR-2). Bring-up is part of §A5.
- **Cross-process redaction smoke:** query text + product fields absent from logs/Sentry/support
  bundle beyond the permitted snapshot fields (NFR-7).
- **Seam contract test:** the production resolver satisfies 005's seam signature; 005's existing
  fixture tests remain green (no seam change).

## CI / Build / Package

No workflow changes. The existing `codegen:verify → typecheck → lint → test → package:dir` pipeline on
`windows-latest` (self-hosted) gates this feature. New `catalogue.*` types flow through the existing
`bridge-api.ts` typecheck.

## Phase 2 — Visual Direction (Slice 0)

**Mandated by 003 FR-033 inheritance. Non-code. Required before Slices S1–S5 begin.** 009 has a
genuine UI surface, so this is a real early-visual milestone. Contact sheet (003/007 tokens,
`comfortable` density, RTL Arabic-first, four-state connection visual, role-indicator slot) covering:

1. **Product search input + scan-capture field** in the cart-bearing shell (focused, ready for wedge).
2. **Ranked result list** — keyboard-navigable rows showing Arabic-first name, price, unit/pack,
   barcode/SKU where useful (FR-17a); ≥ 44×44 CSS px hit areas; selection highlight.
3. **Product confirm panel** (single-match, confirm-first) — name, price, unit/pack; Add / Cancel.
4. **Not-found state** — clear, recoverable, retry/manual-edit; returns focus to input.
5. **Catalogue-unavailable state** — *visually distinct* from not-found ("system not ready"), per FR-24.
6. **Ambiguous-barcode state** — generic "resolve in catalogue"; nothing added.
7. **Empty / too-short query** — no result list; quiet idle state.

### Visual-direction review gate

Reviewed against 003/007 tokens, navigation rail, connection-state visuals, 004's role-indicator slot,
RTL correctness, and accessibility (keyboard path through every state, axe-clean, focus rings, 44×44
floor). **No implementation slice merges before the S0 review is recorded** under
`specs/009-product-search-and-barcode-lookup/visual-direction/`.

## Phase 3 — Implementation Slice Strategy

Each slice is a small reviewable PR. S0 is non-code. `/speckit-plan` begins no slice; all hold on §A0.

| Slice | Deliverable | Approval gates | Indicative test surface |
|:--|:--|:--|:--|
| **S0: Visual Direction** (non-code) | Contact sheet (7 surfaces above); review recorded. | §A0 | Review document. |
| **S1: `catalogue.*` bridge skeleton + session gating + search store FSM + component shells** | Typed `catalogue.*` namespace, all handlers stubbed + `requireOperatorSession`; `catalogueSearchStore` 7-state FSM; component shells filling the search slot. **No persistence/search logic.** | §A0; §A1 (seam-wiring coordination with 005) | Bridge unit tests (every handler refuses without session); store transitions on bridge confirmation; keyboard-path + axe-clean idle/error states. |
| **S2: `products` + `product_barcodes` + `name_fold` migration; exact lookup; normalization module; read repo; security review** | Migrations (gated §A2); `lookupBarcode`/`lookupSku` handlers; `normalize.ts` (≥95%); `product-repo.ts` read queries; redaction smoke extension; **bridge-surface security review** merge gate → `security-review/s2-review.md`. | §A0; §A2 (migrations); §A1 | Exact lookup ≤50 ms; normalization both-sided ≥95% incl. folding corpus; tenant-isolation refusal; ambiguous-barcode block; catalogue-unavailable vs not-found distinction; redaction smoke. |
| **S3: Folded substring search + ranking + cap + debounce; result list wiring** | `search.ts` (folded substring + ranking + 20-cap); `catalogue.search` handler; debounce (~150 ms typed only; scanner bypasses); result-list render + keyboard nav (FR-14/17/17a). | §A0; §A2 | Search ≤150 ms p95 @ 50k; SC-9 recall corpus; min-query-length guard (FR-16); cap + refine indication (FR-17); keyboard navigation; Arabic+English folded search. |
| **S4: Production R7 resolver wired into 005's cart seam; confirm-first add; duplicate-scan increment** | `resolve-item-ref.ts` production resolver; wire into `cart-bridge.ts` `resolveItemRef` injection point; `ProductConfirmPanel` → 005 `cart.lines.add`; missing-required-field block (FR-19/22); duplicate scan → Q4 increment (FR-21). | §A0; §A1 (seam wiring ratified with 005 owner) | Resolver satisfies 005 seam (005 fixture tests stay green); confirm-then-add round-trip; missing-field generic refusal; duplicate-scan increments existing line; scanner Enter-suffix safety (FR-8). |
| **S5: Final polish + production readiness** | Screenshot review vs S0; consistency fixes; `docs/runbook/product-search.md`; failure-mode catalogue; performance bring-up on target hardware; `<!-- SPECKIT START -->` update in `CLAUDE.md`. | §A0; §A5 | Smoke pass of all prior tests; axe-clean across all variants; full keyboard walkthrough; NFR-1/NFR-2 bring-up evidence. |

**Per-slice non-functional gates** (every slice): pre-merge screenshot review vs S0; axe-clean on all
state variants (P14); cross-process redaction smoke passes with the diff (P7/P11);
`npm test`/`codegen:verify`/`typecheck`/`lint` all pass; no `git add -A`, no `--no-verify`, no scope
creep beyond the slice's task IDs (P13).

## Approval Gates

### §A0. Visual-direction + seam-wiring coordination (parent gate)

**Description.** (1) Slice S0 visual direction reviewed and recorded (003 FR-033 inheritance). (2) The
R7 seam-wiring coordination with 005 confirmed: 009 wires the production resolver into the existing,
unwired `cart-bridge.ts` injection point **without changing the seam signature**, and 005's fixture
tests stay green. **Blocks every slice.**

**Resolution paths:** (1) S0 reviewed + seam-wiring approach confirmed → §A0 lifts. (2) S0 review
surfaces an RTL / forbidden-information conflict → spec re-clarified, plan revised. (3) Priorities
shift → 009 deferred (no code).

### §A1. R7 seam-wiring approach ratified with 005

**Description.** Confirm with the 005 surface owner that 009 implements `resolveItemRef` behind the
fixed seam (signature unchanged), wired at the `cart-bridge.ts` constructor option, replacing the
`DEFAULT_ITEM_REF_RESOLVER` generic-refusal fallback in production. **Blocks S1, S2, S4.**

### §A2. `products` / `product_barcodes` / `name_fold` migration review

**Description.** The new-table migrations (+ the search index) reviewed under the migration-safety
discipline (mirrors 005 §A2 / 008 §A3). Read model is **mutable by a future sourcing feature** but
009 ships only read paths; the migration installs the schema + indexes only. **Blocks S2, S3.**

### §A5. Production readiness

**Description.** Test plan, rollback strategy, support-runbook entry (`docs/runbook/product-search.md`),
failure-mode catalogue, and the NFR-1/NFR-2 **performance bring-up on target Windows hardware** at a
~50k-row fixture catalogue. **PASS-with-deferral**: end-user value also requires a future
catalogue-sourcing feature to populate the table (named, not silently assumed). **Blocks S5 / the
production-rollout PR.**

> **Note — 009 is NOT gated by 008's open §A5.** 009 *produces* the line snapshot 008 consumes; it
> does not depend on 008's finalization gates closing. The only real cross-feature coordination is the
> 005 seam-wiring (§A1).

## Constitution Check (Post-Design)

Re-evaluated after Phase 1. No status regressed.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | **PASS-load-bearing** | Local read model; no network in lookup; "catalogue unavailable" is the honest empty state. |
| II / P1. Financial Precision | **PASS-conduit** | `price_minor` carried, never computed (AD-5). |
| III. Process-Boundary | **PASS** | `products` main-process; `catalogue.*` enumerable; resolver respects 005's bridge. |
| V. Type Safety | **PASS** | Typed namespace + typed seam satisfaction. |
| VI. Test-First | **PASS** | Coverage gates set; folding + state-distinction corpora defined. |
| Localization | **PASS-load-bearing** | Both-sided Arabic + English folding (R4); RTL Arabic-first display. |
| Domain — Products / Barcode | **PASS-implemented** | O(1) exact lookup (R3); unknown barcode → recoverable not-found, never hard error (FR-6); single `display_name` threaded to cart/receipt per 008 (AD-6). |
| Hardware Matrix | **PASS** | Wedge HID only; focus-management (NFR-6); no native SDK. |
| Security | **PASS** | Bridge-gated lookups; redaction (NFR-7); S2 security review. |
| P15. Production Readiness | **PASS-with-deferral** | §A5; end-user value needs a future sourcing feature. |
| P16. Scope Discipline | **PASS** | AD-2 / AD-3 boundaries; no sourcing/sync/cart-mutation creep. |

## Risks & Open Items

- **R-RISK-1 — Folded search performance at scale (owner: 009 S3/S5).** Both-sided Arabic+English
  folded *substring* search over 50k rows is the one budget not trivially satisfied by an index. R4
  picks a normalized-fold column + bounded scan and rejects FTS5 for MVP (no FTS5 in repo; touches the
  frozen better-sqlite3 stack). **Mitigation:** §A5 perf bring-up on target hardware; if the
  fold-column scan misses NFR-2 at 50k, R4 revisits FTS5 with an explicit stack-amendment rationale.
- **R-RISK-2 — Orphaned read model until a sourcing feature ships (owner: product).** 009 defines and
  ships the `products` table empty; without a future catalogue-sourcing feature, production shows
  "catalogue unavailable" indefinitely and the feature delivers no end-user value. **Mitigation:** §A5
  P15-deferral names this explicitly; the rollout PR should be sequenced with (or after) a sourcing
  capability.
- **R-RISK-3 — Snapshot fields carried but not threaded downstream (owner: 009 + future 008 rev).**
  English name + per-line tax/category are in the read model but NOT consumed by the cart line /
  envelope / receipt today (008 OQ-3 sale-level VAT; slice2 single `display_name`). **Mitigation:**
  AD-6 documents this as forward-looking provenance; a future 008 revision that wants per-line tax or
  bilingual receipts consumes them additively.
- **R-RISK-4 — Branch-scoped availability deferred (owner: product).** MVP read model is tenant-scoped
  (all branches see the same catalogue). Per-branch sellability/pricing is a future concern. **Mitigation:**
  R1 carries an optional `branch_id`; the schema is additive-ready.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
