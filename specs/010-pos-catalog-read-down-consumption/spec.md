# Feature Specification: Catalog Read-Down Consumption

**Feature ID:** 010-pos-catalog-read-down-consumption
**Status:** Draft — `/speckit-clarify` complete (2026-06-04; 7 questions resolved, 0 markers remain); ready for `/speckit-plan`
**Created:** 2026-06-04
**Last Updated:** 2026-06-04
**Owner:** POS-Pulse desktop team

---

## Overview

POS-Pulse can already *find and resolve* a product at the till — feature 009 shipped barcode/SKU
lookup and Arabic/English search over a local SQLite product read model (`products` /
`product_barcodes`). But 009 deliberately shipped those tables **empty**: it owns the read shape, not
the population. Today, on a real terminal, every lookup returns "catalogue unavailable" because nothing
has ever filled the read model (009 R-RISK-2).

**010 is the feature 009's plan named as the future catalogue-sourcing feature** (009 AD-2 / AD-3,
R-RISK-2). It delivers the **read-down**: pulling a resolved, sellable product catalogue from the
SmartDataPulse backend down into the local read model, so 009's lookup and search operate over **real
catalogue data, offline**. 010 is strictly a **read path** (backend → local terminal). It does not send
anything from the POS back to the backend, and it does not implement sales, payments, inventory, or any
other POS domain.

## Clarifications

### Session 2026-06-04

> **Provenance:** Q1 (storage shape) was owner-chosen (Option A, with a §A2 confirmation condition). Q2–Q5
> and the Q-RD-STATE sub-decision were resolved by **owner blanket-delegation** ("do recommended for all")
> to the agent's recommended options. **Q4 (freshness MVP — timestamp-only, no stale-price alarm) was
> explicitly re-confirmed by the owner 2026-06-04** after being flagged for its P1 (financial-correctness)
> dimension: a passive "last updated" timestamp is the accepted MVP signal; a stale-price warning/alarm is
> deferred (additive future work, not a blocker).

- Q: How does the read-down apply its data to the local read model (Q-RD-TABLES)? → A: **Stage-and-promote** — the read-down writes to separate staging tables, then promotes to 009's live `products` / `product_barcodes` in one atomic transaction (or table-swap), so 009's hot read path only ever sees a complete, internally-consistent catalogue and a failed/interrupted run never touches the live tables. **§A2 confirmation:** staging/delta tables fit the §A2 migration-safety gate under 009's existing conventions (new migrations land at `0031+`, FK-safe, single-PR so the schema is never half-installed; logical FKs only — no SQL `FOREIGN KEY`; no append-only triggers — these are read models per 009 §A2 §6; `price_minor INTEGER CHECK(>=0)`, every row/index tenant-scoped, redaction preserved). Per the 009 §A2 review's closing rule, 010's staging migration + promote transaction (and any extension to `products`/`product_barcodes`) MUST run their **own §A2-class migration-safety review** — they do not inherit 009's sign-off.
- Q: Which sync model, and what source shape must the backend provide (Q-RD-SHAPE + Q-RD-MODEL)? → A: **Full-snapshot replace.** Each read-down obtains the complete current sellable catalogue for the terminal's tenant/branch and stages it, then atomically promotes a whole-catalogue swap (pairs with the stage-and-promote decision). No per-row cursor, version-ordering, or conflict-resolution logic — out-of-order/replayed changes cannot regress the catalogue, so FR-13 (idempotent apply) and FR-14 (no interleave) hold by construction. The backend must therefore expose a full per-tenant/branch sellable-catalogue snapshot; whether that endpoint exists or must be defined (pulling in an OpenAPI/codegen contract dependency, Constitution V/P8) is a planning item. Incremental-delta sync is explicitly deferred as a future wire-efficiency optimization (its own feature-scope decision), to be considered only if a measured wire-size/latency problem appears.
- Q: On a malformed/invalid backend product record, fail the whole read-down or skip it (Q-RD-BATCH)? → A: **Skip-and-log the bad record; apply the rest.** A single malformed record (missing Arabic name, non-safe-integer price, etc. — FR-9) MUST NOT deny the terminal an otherwise-usable catalogue (Constitution P3). The record is rejected and recorded for diagnostics; the atomic promote proceeds over the validated set. (Threshold guard: if the rejected fraction is implausibly high — suggesting a source-format break rather than one bad row — the run SHOULD be treated as a failed read-down and the prior catalogue preserved per FR-7; the exact threshold is a planning detail.)
- Q: Is a cashier-facing freshness/last-updated indicator in scope, and what does it promise (Q-RD-FRESHNESS)? → A: **Minimal truthful "last updated" timestamp; no further promise.** 010 surfaces a "catalogue last updated <time>" derived from the last *successful* read-down promote — honest provenance (Constitution P9), available where it does not distract from selling. It MUST NOT imply live/continuous sync, and MUST NOT show a "synced" claim the code does not back. No stale-alarm, no auto-refresh promise, and no blocking behaviour in MVP. (009 FR-24a explicitly deferred any freshness marker to this feature; this is that decision.)
- Q: What triggers a read-down, and is it operator-session-gated or paired-terminal-gated (Q-RD-TRIGGER)? → A: **Background read-down on a paired terminal (NOT operator-session-gated), on app-start / post-pairing and on a periodic interval, plus a manual "refresh catalogue" affordance.** Catalogue data is terminal-scoped (keyed by the device's tenant/branch identity, Constitution VIII), so the read-down runs on a paired terminal even before a cashier signs in — the "unattended terminal MAY perform background sync" allowance (Principle VIII). It MUST never block selling (FR-12). A manual "refresh catalogue" affordance is in scope for the known-price-changed case. The periodic interval value and the exact app-start/pairing hook points are planning details.
- Q: Where does read-down sync state live — new columns on 009's tables or a separate table (Q-RD-STATE)? → A: **A small separate read-down-state table**, holding at least the last-successful-promote timestamp and the source/snapshot identifier, kept out of 009's hot read path so lookup performance (NFR-1) is untouched. 009's existing `row_version` / `created_at` / `updated_at` provenance columns on `products` are populated by the read-down (they were reserved for "the sourcing feature") but are NOT widened with sync-bookkeeping columns. The freshness timestamp (Q-RD-FRESHNESS) reads from this state table.

## User Scenarios & Testing

### Primary User Story

A paired POS terminal belonging to a pharmacy branch is brought online for the first time. In the
background — without the cashier doing anything and without blocking the till — the terminal obtains the
branch's sellable product catalogue from the backend and writes it into the local product read model.
Once the read-down completes, a cashier signs in, scans a real product barcode, and 009's lookup
resolves it to the correct product with its real Arabic name and price; a typed Arabic name search now
returns real products. The terminal can then be disconnected from the network entirely and every lookup
still works against the locally stored catalogue. Later, when the backend catalogue changes (a new
product, a price update, a deactivation), the terminal picks up those changes on a subsequent read-down
and the local catalogue reflects them — again without interrupting selling.

### Acceptance Scenarios

Each scenario uses Given / When / Then phrasing and is testable without naming an implementation.

1. **First read-down populates an empty catalogue**
   - **Given** a paired terminal whose local product read model is empty (009 "catalogue unavailable"
     state)
   - **When** a catalogue read-down runs successfully against the backend for the terminal's tenant/branch
   - **Then** the local `products` and `product_barcodes` tables hold the backend's sellable catalogue,
     009's search folding columns are populated so search works, and 009 lookups stop returning
     "catalogue unavailable" for products that exist.

2. **Lookups work fully offline after a successful read-down**
   - **Given** a terminal that has completed at least one successful read-down
   - **When** the network is disconnected and a cashier scans or searches
   - **Then** every lookup resolves from local data with no network round-trip (009 FR-23 preserved);
     the read-down's absence of connectivity never blocks a lookup or a sale.

3. **Catalogue change is reflected on a later read-down**
   - **Given** a populated local catalogue and a backend catalogue that has since changed (added,
     updated, or deactivated products)
   - **When** a subsequent read-down runs successfully
   - **Then** the local catalogue reflects the backend changes (new products become findable, updated
     prices/names appear, deactivated products stop resolving for selling per 009 FR-18) and 009's fold
     columns are kept consistent so search still matches.

3a. **Read-down updates are atomic and never expose a half-written catalogue**
   - **Given** a populated local catalogue and a read-down in progress
   - **When** lookups occur during the read-down, or the read-down is interrupted (crash, kill, power
     loss) partway through
   - **Then** lookups only ever see a complete, internally consistent catalogue state — either the prior
     state or the new one — never a partially-applied mix; an interrupted read-down leaves the prior
     catalogue intact and recoverable (Constitution P3 — no silent data loss).

4. **Read-down failure leaves the existing catalogue usable**
   - **Given** a terminal with a previously populated catalogue
   - **When** a read-down attempt fails (backend unreachable, timeout, malformed payload, partial
     transfer)
   - **Then** the existing local catalogue remains intact and fully usable for offline lookup; the
     failure is recorded for diagnostics; nothing the cashier is doing is interrupted or shown a hard
     error.

5. **Tenant/branch isolation of read-down data**
   - **Given** a terminal paired to tenant A / branch X
   - **When** a read-down runs
   - **Then** only tenant A's (and, where branch-scoped, branch X's) sellable catalogue is written
     locally; no other tenant's or other branch's products are ever stored on or visible from this
     terminal (Constitution P17).

6. **Read-down never rings up or mutates a sale**
   - **Given** any read-down activity (in progress, succeeded, or failed)
   - **When** it runs
   - **Then** it performs no cart mutation, no sale, no payment, no inventory change, and sends nothing
     from the POS to the backend — it is a one-directional read into the local catalogue only.

### Edge Cases

- **Read model unreadable / corrupt before read-down** — if the local store cannot be read or written,
  the read-down records the failure for diagnostics and the cashier surface continues to show 009's
  generic "catalogue unavailable" state; no hard error, no crash.
- **Backend returns an empty catalogue** — a successful read-down that legitimately contains zero
  sellable products results in an empty-but-present catalogue; lookups behave per 009 (not-found per
  query, or "catalogue unavailable" if the model is genuinely empty — the distinction is 009's, not
  re-litigated here).
- **Malformed / incomplete product record from the backend** — a record missing a field the read model
  requires (e.g. no Arabic name, or a non-integer/unsafe price) MUST NOT corrupt the local catalogue;
  the record is rejected/skipped and the rejection is recorded for diagnostics, without aborting the
  whole read-down. (Whether one bad record fails the batch or is skipped is a clarify decision — see
  Open Questions.)
- **Interrupted read-down** — see Acceptance Scenario 3a: the prior catalogue is preserved; no
  partially-applied state is ever observable.
- **Very large catalogue** — the read-down must complete (or chunk) without exhausting memory or
  locking the read model long enough to block lookups beyond an acceptable window.
- **Two read-downs triggered close together** — concurrent or overlapping read-downs MUST NOT corrupt
  the local catalogue or interleave writes (single-writer discipline; the second is coalesced, queued,
  or refused — a clarify/plan decision).
- **Clock / ordering skew on deltas** — if an incremental model is chosen, out-of-order or replayed
  changes MUST NOT regress the catalogue to an older state (ordering/idempotency — see Open Questions).

## Requirements

### Functional Requirements

Each requirement is testable, unambiguous, and uses MUST/SHOULD/MAY.

**Read-down population (the core)**

- **FR-1.** The system MUST obtain the sellable product catalogue for the terminal's tenant (and branch,
  where branch-scoped) from the SmartDataPulse backend and write it into the **local product read
  model** that 009 defined (`products` / `product_barcodes`), such that 009's existing lookup and search
  operate over the populated data with no change to 009's read paths.
- **FR-2.** A successful read-down MUST populate every field 009's read model and resolver require to
  make a product findable and resolvable: stable product identity, one-or-more barcodes, SKU, Arabic
  display name, English display name (when available), integer minor-unit price, tax/category metadata,
  unit/pack label (when available), aliases (when available), and the active/sellable flag — consistent
  with 009's data-model field set.
- **FR-3.** The read-down MUST populate and maintain 009's precomputed search-fold columns
  (`name_fold` / `alias_fold`) for every written row, using **009's published normalization/fold rules**
  (the same rules 009 applies to a query), so that 009's both-sided folded search matches correctly.
  Divergence between the stored fold and 009's query fold is a correctness defect.
- **FR-4.** The read-down MUST preserve 009's barcode model: a product MAY carry several barcodes (pack,
  unit), and a single barcode value mapping to more than one active product remains 009's ambiguity case
  — the read-down MUST NOT silently dedupe or collapse such conflicts; it stores the data faithfully and
  lets 009's lookup surface the ambiguity.
- **FR-5.** Integer minor-unit prices MUST be carried verbatim from the backend into the read model with
  no arithmetic, rounding, or float conversion (Constitution II / P1); a price that is not a safe
  integer MUST be treated as a malformed record (see FR-9), never coerced.

**Truthfulness, durability, and isolation**

- **FR-6.** A read-down MUST apply atomically from the perspective of lookups via **stage-and-promote**:
  it writes the validated catalogue to staging tables and then promotes to 009's live `products` /
  `product_barcodes` in a single atomic transaction (or table-swap). A lookup MUST observe either the
  complete prior catalogue or the complete new catalogue, never a partially-applied mix (Constitution
  P3). An interrupted read-down MUST leave the prior (live) catalogue intact and usable; staging content
  from an incomplete run MUST NOT be visible to lookups.
- **FR-7.** A failed read-down MUST NOT degrade or destroy the existing local catalogue; the prior
  catalogue MUST remain available for offline lookup, and the failure MUST be recorded for diagnostics.
- **FR-8.** All read-down writes MUST be tenant-scoped (and branch-scoped where the chosen model is
  branch-scoped) so the local store never holds or exposes another tenant's or another branch's products
  (Constitution P17). 009's tenant-scoped read remains the enforcing boundary at lookup time.
- **FR-9.** A backend product record missing a field the read model requires, or carrying an invalid
  value (e.g. missing Arabic name, non-safe-integer price), MUST NOT corrupt the catalogue: the record is
  **skipped and recorded for diagnostics**, and the read-down promotes the remaining validated set (a
  single bad record MUST NOT deny the terminal an otherwise-usable catalogue — Constitution P3). As a
  guard, if the rejected fraction of a read-down exceeds a defined threshold (suggesting a source-format
  break rather than isolated bad rows), the run MUST be treated as a **failed** read-down (FR-7 — prior
  catalogue preserved) rather than promoting a largely-empty catalogue. The threshold value is a planning
  detail.

**Strictly read-direction (one-way)**

- **FR-10.** 010 MUST be strictly **backend → local**. It MUST NOT send sales, carts, inventory
  movements, prices, or any POS-originated data back to the backend; it MUST NOT implement, trigger, or
  prepare any POS → backend write path.
- **FR-11.** 010 MUST NOT mutate the cart, ring up or finalize a sale, compute or store tax/VAT, change
  inventory/stock/batch state, post to any ERP, print or alter receipts, handle tender, or produce
  reports/analytics. It only fills the local catalogue read model.

**Triggering & lifecycle**

- **FR-12.** The read-down MUST run without blocking the cashier: it MUST NOT freeze, delay, or
  interrupt lookup, search, confirm, or any selling path while it runs (offline-first; Constitution I).
- **FR-13.** The read-down MUST be safe to run repeatedly; running it again on an up-to-date terminal
  MUST converge to the same catalogue state without duplicating products or barcodes (idempotent apply;
  Constitution P5 in spirit, read-side).
- **FR-14.** Overlapping/concurrent read-downs MUST NOT corrupt or interleave the local catalogue; the
  system MUST enforce single-writer discipline (coalesce, queue, or refuse the redundant run).
- **FR-15.** A read-down MUST be triggered automatically on **app start and after pairing**, and on a
  **periodic interval**, and MUST also be invokable via a **manual "refresh catalogue" affordance**. The
  read-down runs on a **paired terminal** and MUST NOT require an active operator session (a paired but
  signed-out terminal MAY read down — Constitution VIII "unattended terminal MAY perform background
  sync"). Triggers MUST never block selling (FR-12). The exact interval value and the precise app-start /
  pairing hook points are planning details.
- **FR-15a.** The source the read-down consumes MUST be a **full per-tenant/branch sellable-catalogue
  snapshot** (full-snapshot replace model — see Clarifications). Whether the backend already exposes such
  an endpoint or one must be defined — which would introduce an OpenAPI/codegen contract dependency
  (Constitution V / P8) — MUST be resolved in `/speckit-plan`. Incremental-delta sourcing is out of scope
  for this feature (deferred optimization).

**Freshness / staleness surface (009 deferred this to "the sourcing feature" — that is 010)**

- **FR-16.** 010 MUST surface a minimal, truthful **"catalogue last updated &lt;time&gt;"** indicator,
  derived from the timestamp of the last *successful* read-down promote, on a cashier-visible surface
  where it does not distract from selling. It MUST NOT imply live/continuous sync, MUST NOT show a
  "synced" claim the code does not back (Constitution P9), and MUST NOT block any selling path. No
  stale-alarm, no auto-refresh promise, and no countdown are in scope for MVP — the timestamp only.
  (009 FR-24a explicitly deferred any freshness marker to this feature; this is that decision.)
- **FR-16a.** Read-down sync state (at minimum the last-successful-promote timestamp and the
  source/snapshot identifier) MUST be persisted in a **separate read-down-state store**, kept out of
  009's hot lookup/search path so lookup performance (NFR-1) is unaffected. 009's existing `row_version`
  / `created_at` / `updated_at` provenance columns on `products` MUST be populated by the read-down but
  MUST NOT be widened with sync-bookkeeping columns. FR-16's freshness indicator reads from this state
  store.

### Non-Functional Requirements

- **NFR-1.** A read-down MUST NOT regress 009's lookup performance budgets (exact lookup ≤ 50 ms p95;
  folded search ≤ 150 ms p95 at ~50,000 active products on target Windows hardware). Any read-model
  schema/index change 010 introduces MUST keep 009's lookup/search within those budgets.
- **NFR-2.** A read-down MUST complete within an acceptable window and MUST NOT hold the local store in a
  state that blocks lookups beyond a brief, bounded apply window, at the constitutional catalogue scale
  (~50,000 active products). The stage-and-promote model (FR-6) confines lookup contention to the promote
  transaction; staging writes MUST NOT block lookups. Concrete completion-time and maximum
  promote-window targets are set in `/speckit-plan` and validated at the production-readiness bring-up
  (no contractual target is fixed at the spec layer).
- **NFR-3.** No backend credential, device token, raw transport payload beyond the permitted catalogue
  fields, or PII MUST appear in logs, Sentry, or support bundles; read-down diagnostics MUST follow the
  project's existing redaction allowlist discipline (Constitution VII / P7 / P11), extending 009's
  `catalogue.*` redaction posture rather than replacing it.
- **NFR-4.** The read-down MUST be tenant/branch correct under the device-identity model: it MUST use the
  terminal's own paired identity and MUST reject or refuse data that does not match the terminal's tenant
  (and branch, where branch-scoped) — never widening 009's tenant-isolation guarantee.
- **NFR-5.** The read-down MUST fail loudly into diagnostics but quietly to the cashier: a failure
  records structured diagnostics (Constitution IV/VII) yet never raises a hard error on the selling
  surface (it falls back to the existing catalogue or to 009's "catalogue unavailable" state).

## Success Criteria

Measurable, technology-agnostic outcomes. The feature is "done" when these are demonstrably true.

- **SC-1.** After one successful read-down on a fresh terminal, a cashier can scan a real backend product
  and have 009 resolve it to the correct product (correct Arabic name and price) — moving the terminal
  from "catalogue unavailable" to "fully searchable" with no manual data entry.
- **SC-2.** **100 %** of lookups succeed with the network disconnected after a successful read-down (009
  offline-first guarantee preserved end-to-end with real data).
- **SC-3.** A backend catalogue change (add / price-update / deactivate) is reflected locally after the
  next successful read-down — **0** stale resolutions for products that changed, once the read-down
  completes.
- **SC-4.** **0** observations of a partially-applied catalogue: across an interrupted-read-down test
  matrix (crash / kill / power-loss mid-apply), every lookup sees either the complete prior or the
  complete new catalogue, and the prior catalogue is always recoverable.
- **SC-5.** A failed read-down leaves **100 %** of a previously populated catalogue usable for offline
  lookup — **0** cases where a failed refresh empties or corrupts a working catalogue.
- **SC-6.** **0** cross-tenant or cross-branch products are ever stored on or returned from a terminal,
  across the read-down isolation test matrix (Constitution P17).
- **SC-7.** **0** POS → backend writes occur from this feature — verified by inspection and test that
  010 issues no outbound write/sale/inventory traffic.
- **SC-8.** 009's lookup/search performance budgets (NFR-1) still hold against a catalogue populated by a
  real read-down at ~50,000 products on target hardware — **0** regressions versus 009's bring-up.
- **SC-9.** Folded search recall is preserved on read-down-populated data: **100 %** of 009's
  Arabic/English folded-variant corpus still returns its product after a read-down (the stored fold
  matches 009's query fold).
- **SC-10.** The "catalogue last updated" indicator always reflects a **real** last-successful-promote
  timestamp — **0** cases where it shows a time not backed by a completed read-down, and **0** cases
  where it implies sync while the catalogue is actually empty/unavailable (Constitution P9 truthfulness).
- **SC-11.** A malformed-record test batch promotes the **valid** records and skips the invalid ones with
  a diagnostic entry — **0** catalogue corruptions and **0** whole-batch failures from isolated bad rows
  (below the rejection threshold).

## Key Entities

[Detailed schemas belong in the plan, not the spec.]

- **Sellable Product (read-down input → local read-model row)** — the backend's representation of a
  sellable product, carrying the fields 009's read model requires (identity, barcodes, SKU, Arabic +
  English names, integer minor-unit price, tax/category, unit/pack label, aliases, active flag). Staged,
  then promoted into 009's `products` / `product_barcodes` shape.
- **Catalogue Source Snapshot** — the **full per-tenant/branch sellable-catalogue snapshot** the backend
  delivers each read-down (full-snapshot replace model). Exact field shape and transport are a planning
  detail; the snapshot-vs-delta question is resolved (full snapshot).
- **Staging tables** — transient tables the read-down writes the validated snapshot into before the
  atomic promote to the live read model. Not visible to 009 lookups; subject to their own §A2-class
  migration-safety review.
- **Read-down Run** — one attempt to pull and apply the catalogue: outcome (succeeded / failed /
  skipped-with-rejections), a recorded promote timestamp on success, and redacted diagnostics on failure
  (including the per-record skip list).
- **Read-down State store** — a small separate store (out of 009's hot read path) holding at least the
  last-successful-promote timestamp and the source/snapshot identifier; the FR-16 freshness indicator
  reads from it.

## Assumptions

- **010 consumes 009's read model as its write target conceptually.** 009 explicitly defined `products`
  / `product_barcodes` as "read-only from 009; mutable by a future sourcing feature" and named that
  feature's job (009 data-model "Mutability (future sourcing feature) = Mutable"; AD-2). 010 is that
  feature. *Whether* it writes those exact tables directly or stages into separate tables and promotes is
  an open architectural question (Q-RD-TABLES), but the **target read model 009 lookups query is the same
  one 010 fills**.
- **009's fold rules are the contract for searchability.** 009's data-model states the fold columns are
  "maintained at write-time by the sourcing feature using 009's published fold rules." 010 honours that:
  it does not invent a second normalization; it applies 009's rules (FR-3).
- **The R7 resolver seam and `catalogue.*` lookup surface are unchanged by 010.** 010 changes *what data
  is present*, not *how it is read or resolved*. 009's lookup, search, resolve, and the 005 cart seam are
  consumed as-is; 010 adds no parallel read path.
- **Offline-first is non-negotiable and already proven by 009.** 010 only *fills* the local store; it
  never makes a lookup depend on the network (Constitution I; 009 FR-23).
- **Branch scoping is forward-looking in 009 (tenant-scoped MVP, optional `branch_id`, R-RISK-4).** 010's
  scoping (tenant-only vs tenant+branch) is tied to the catalogue source's shape and is surfaced as part
  of the model question (Q-RD-MODEL / Q-RD-SHAPE), not silently assumed.
- **No backend OpenAPI surface is assumed to exist yet.** Whether the read-down consumes an existing
  backend endpoint, a new one, or another delivery mechanism is part of Q-RD-SHAPE; this spec does not
  presume a contract that has not been confirmed.
- **Constitution v1.5.1** is the pinned version, consistent with 005 / 008 / 009.

## Out of Scope

Explicitly NOT delivered by this feature. Items here block scope creep and inform the next feature's
planning. (These map to the Constitution P16 future-domain list and the owner's hard-scope statement.)

- **Sale sync / any POS → backend write path** — 010 is read-direction only. The local outbox, sale
  upload, refund upload, and reconciliation are a separate future feature and MUST NOT be started here.
- **VAT / fiscal computation or storage** — owned by 008 / a future fiscal feature; 010 carries
  tax/category metadata as data only and computes nothing.
- **Inventory / stock / batch / lot / FEFO / expiry awareness or mutation** — out of scope; 010 sources a
  *sellable product catalogue*, not stock levels.
- **ERP posting / integration.**
- **Receipts, tender, payment** — owned by 006 / 008; unchanged and untouched.
- **Reports / KPIs / analytics.**
- **Auto-update / app-update wiring** (`electron-updater`) — a separate packaging concern.
- **Catalogue authoring / "add product" creation on the terminal** — 010 ingests; it does not create or
  edit catalogue records locally (an unknown barcode remains 009's recoverable not-found).
- **Changes to 009's lookup / search / resolve behaviour or the 005 cart seam** — 010 supplies data; it
  does not redesign how data is read.
- **Pricing rules engine** (member/insurance/promotional pricing math) — 010 carries the price the
  backend resolved; it computes no pricing.
- **Controlled-substance / prescription enforcement** — 010 MAY carry the flags 009 surfaces; enforcement
  remains out of scope (as in 009).

## Dependencies

- **009-product-search-and-barcode-lookup** — owns the local read model (`products` /
  `product_barcodes`), the published fold rules, the `catalogue.*` read surface, and the R7 resolver
  seam that 010's data flows into. 010 is the catalogue-sourcing feature 009 named (009 AD-2 / AD-3,
  R-RISK-2). 010 MUST NOT change 009's read paths.
- **002-terminal-pairing** — the per-terminal device identity (tenant + branch + terminal) that scopes
  which catalogue this terminal is entitled to read down (Constitution VIII / P17).
- **004-operator-session** — gates the cashier-facing surfaces 009 runs on. **The read-down itself is
  NOT operator-session-gated** (clarified): it runs on a paired terminal even when signed out
  (Constitution VIII background-sync allowance). 004 remains the gate for the lookup/search/confirm
  surfaces that consume the data.
- **002-terminal-pairing** — supplies the paired-terminal identity the read-down runs under and triggers
  on (post-pairing trigger; FR-15).
- **SmartDataPulse backend (api.smartdatapulse.tech)** — the source of the **full per-tenant/branch
  sellable-catalogue snapshot** (full-snapshot replace, clarified). Whether the snapshot endpoint already
  exists or must be defined (an OpenAPI/codegen contract dependency, Constitution V/P8) is resolved in
  `/speckit-plan`; no specific endpoint is assumed at the spec layer.
- **Constitution v1.5.1** — Principle I (offline-first), II/P1 (integer minor-unit money, no floats),
  III (process-boundary discipline), VII (observability + redaction), VIII (terminal/tenant identity),
  P3 (no silent data loss), P5 (idempotency), P8 (Electron security boundary — a read-down touches the
  main process and likely the bridge and a migration), P9 (truthful states), P16 (feature scope
  discipline), P17 (tenant isolation), P18 (local durability before offline promises).

## Open Questions

All seven owner-named architectural questions are **resolved** in the [Clarifications](#clarifications)
section (Session 2026-06-04) and encoded into the requirements above:

| Question | Resolution | Encoded in |
|:--|:--|:--|
| Q-RD-TABLES (storage shape) | Stage-and-promote into 009's live tables | FR-6, Clarifications |
| Q-RD-STATE (sync-state location) | Separate read-down-state store; don't widen 009's tables | FR-16a |
| Q-RD-SHAPE (source shape) | Full per-tenant/branch sellable-catalogue snapshot | FR-15a |
| Q-RD-MODEL (sync model) | Full-snapshot replace (delta deferred) | FR-15a, FR-6 |
| Q-RD-BATCH (malformed record) | Skip-and-log; threshold guard fails the run | FR-9 |
| Q-RD-FRESHNESS (cashier surface) | Minimal truthful "last updated" timestamp only | FR-16, SC-10 |
| Q-RD-TRIGGER (trigger + gating) | Paired-terminal (not session-gated); app-start/post-pairing + interval + manual refresh | FR-15 |

**No `[NEEDS CLARIFICATION]` markers remain.** The following are deliberately left as **planning-level**
mechanism details for `/speckit-plan` (not clarify-level ambiguities — they do not change scope or
acceptance shape): the exact backend snapshot endpoint/transport (and whether it pulls in an
OpenAPI/codegen dependency); the periodic read-down interval value and precise app-start/pairing hook
points; the malformed-record rejection threshold; and the concrete read-down completion-time /
promote-window targets validated at the production-readiness bring-up.

---

*Constitution alignment:* This spec MUST satisfy the principles of `.specify/memory/constitution.md`
(version pinned at **v1.5.1**). The plan and tasks artifacts will perform the explicit "Constitution
Check." Note for planning: a catalogue read-down is **production-affecting** (it feeds the checkout
critical path) and inherently touches the **main process**, **likely the preload bridge**, and **likely
a SQLite migration** — so it engages Constitution P8 (Electron security boundary, explicit review), P15
(production readiness gates), and a migration-safety gate. These are flagged for `/speckit-plan`, not
resolved here.
