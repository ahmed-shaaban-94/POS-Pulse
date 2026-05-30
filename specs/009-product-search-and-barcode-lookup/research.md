# Phase 0 Research: Product Search & Barcode Lookup

**Feature ID:** 009-product-search-and-barcode-lookup
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-30
**Constitution version pinned:** v1.5.1

> Format per research item: **Decision** · **Rationale** · **Alternatives considered (rejected).**
> No SQL, source, codegen, or packages are produced by this document.

---

## R1. Product read-model schema & ownership

**Decision.** 009 authors one new local SQLite table `products` (the read model) + a child
`product_barcodes` table + a normalized search column/index (R4). The table **ships empty**; 009
exposes **read-only** paths only; population/sync is deferred to a future catalogue-sourcing feature.
Scoping: `tenant_id` is mandatory on every row and every query; `branch_id` is an **optional**
forward-looking column (MVP is tenant-scoped — all branches see the same catalogue; per-branch
availability/pricing is deferred, R-RISK-4).

**Rationale.** No `010-catalogue-sourcing` feature exists, so an unauthored table would be orphaned
(Constitution P12). Yet sourcing (sync semantics, server-of-truth pricing, price-change auditing) is a
distinct scope (P16) 009 must not absorb. Owning the *read shape* while deferring the *write shape* is
the honest split — the same pattern 005 used for its R7 fixture seam, one layer down. The spec's
"pre-existing read model" wording means "009 does not *populate* it," reconciled explicitly in
plan.md Summary + AD-2.

**Alternatives rejected.**
- *Assume the table exists, author no schema.* Orphaned schema; `/speckit-analyze` flags the gap; the
  table would never be created by anyone.
- *009 owns sourcing/sync too.* Scope creep across P16; sync + price-authority + price-change audit
  are their own feature with their own audit rules.

## R2. Barcode → product mapping & one-to-many ambiguity

**Decision.** A product has **≥1 barcode**, modelled as a child `product_barcodes(product_id,
barcode, …)` with an index on `barcode`. A barcode lookup matches rows by exact, normalized barcode
value joined to **active** products. **Zero matches → not-found (FR-6); exactly one → resolve; more
than one active product → ambiguity block (FR-7)**, detected by the lookup returning >1 distinct
`product_id`. A single product carrying several barcodes (pack + unit) is *not* ambiguous — that's one
`product_id` from several `product_barcodes` rows.

**Rationale.** Pharmacy products legitimately carry multiple barcodes (constitution Domain: "SKU +
barcode (EAN/GTIN)"; pack vs unit). The ambiguity that must block is a *data* conflict — the same
barcode mapped to two different sellable products — which the constitution says must never be guessed
("unknown barcode flows to a manual-entry path, never a hard error"; by extension, an *ambiguous*
barcode must not silently pick one).

**Alternatives rejected.**
- *Single `barcode` column on `products`.* Cannot represent multi-barcode products; forces duplicate
  product rows. Rejected.
- *Treat multi-match as "pick the first."* Violates the no-silent-guess rule; a mis-scan could ring up
  the wrong drug. Rejected.

## R3. Exact barcode / SKU lookup performance

**Decision.** Covered B-tree indexes on the normalized `product_barcodes.barcode` value and on
`products.sku` satisfy the **≤ 50 ms p95** exact-lookup budget (NFR-1) trivially at a 50k-row
catalogue — effectively the constitution's "O(1) against the local index" bound. Exact lookups are
equality matches on indexed, normalized columns; no scan.

**Rationale.** better-sqlite3 is synchronous and embedded; an indexed equality lookup over 50k rows is
sub-millisecond at the DB layer. The 50 ms budget is the *end-to-end* figure (renderer → IPC →
main-process query → IPC → render), leaving generous headroom for the IPC round-trip on low-end till
hardware.

**Alternatives rejected.** *In-memory hash map of all barcodes.* Faster in theory but duplicates the
DB as source of truth, must be rebuilt on every catalogue change, and complicates the empty/unreadable
state. The indexed DB lookup already meets the budget; rejected as premature.

## R4. Folded substring name search mechanism (the hard one)

**Decision.** A **precomputed normalized-fold column** `products.name_fold` (and an alias-fold
equivalent), populated at row-write time by the future sourcing feature using 009's published
`normalize.ts` rules, queried with a **bounded substring scan** filtered by `tenant_id` and `active`,
ranked (exact-prefix > mid-string), and **capped at 20** results (NFR-4). The query value is folded by
the *same* `normalize.ts` before comparison, so matching is normalization-insensitive on **both
sides** (FR-12b). **FTS5 is evaluated and rejected for MVP** (below).

The fold covers (FR-12a):
- **Arabic letter folding:** alef variants أ/إ/آ/ٱ → ا; alef-maqsura ى → ي; taa-marbuta ة → ه; strip
  harakat (diacritics) and tatweel.
- **English folding:** lowercase; strip accents/diacritics (NFD → drop combining marks); collapse
  whitespace.
- **Numerals:** Arabic-Indic ↔ Latin digit folding.
- Applied identically to the stored `name_fold`/`alias_fold` and to the query.

**Rationale.**
- The exact lookups (R3) are trivial; the *only* non-trivial budget is folded **substring** name
  search (`contains`) at ≤ 150 ms p95 over 50k rows (NFR-2). A plain B-tree does not serve
  `LIKE '%…%'` (leading-wildcard defeats the index), so the mechanism is a real decision, not an
  assertion.
- A precomputed fold column means the expensive normalization happens **once at write time** (done by
  the sourcing feature), not per query. The runtime query folds only the short query string and scans
  the prefolded column. At 50k rows a single-column substring scan in synchronous better-sqlite3 is
  within the 150 ms p95 budget on target hardware (to be confirmed at §A5 bring-up).
- **No FTS5 anywhere in the repo today** (`grep -ri "fts5|virtual table|USING fts"` → no matches).
  Introducing an FTS5 virtual table touches the frozen better-sqlite3 stack (constitution Tech Stack
  is locked; a substitution needs an amendment). better-sqlite3 *usually* bundles SQLite with FTS5
  compiled in, but that is unconfirmed for the pinned build, and FTS5's tokenizer would need a custom
  Arabic-folding tokenizer to honour FR-12a — more moving parts than the fold-column scan for an MVP
  whose budget the simpler approach already meets.

**Alternatives rejected.**
- *SQLite FTS5 virtual table with a custom Arabic tokenizer.* More powerful (relevance ranking, large
  corpora) but: (a) not in the repo → frozen-stack amendment + rationale; (b) needs a custom folding
  tokenizer to satisfy FR-12a; (c) over-engineered for 50k rows where a fold-column scan meets the
  budget. **Held as the documented fallback** (R-RISK-1): if §A5 bring-up shows the fold-column scan
  misses NFR-2 at 50k, revisit FTS5 with an explicit stack-amendment.
- *In-memory inverted index built at load.* Fast queries but rebuild cost on catalogue change, memory
  footprint, and a second source of truth to keep consistent with the empty/unreadable states.
  Rejected as premature; the DB scan meets the budget.
- *Fold only the query (not the stored name).* Silently half-works — "بنادول" matches only if the
  stored form already happens to match. Explicitly non-compliant (FR-12b). Rejected.

## R5. Money pass-through

**Decision.** `price_minor` (integer minor units) is carried from the read model into the resolver
output and the result-row display unchanged; 009 performs **no** arithmetic (AD-5).

**Rationale.** Constitution P1. 009 is a conduit in the same trust line as a sales total; the carried
value's *integrity* is load-bearing, but computing nothing keeps the boundary with 005 (per-line
subtotal) and 006/008 (tax, totals) clean.

**Alternatives rejected.** *Compute a display subtotal in 009.* Duplicates 005's `line_subtotal_minor`
and risks divergence. Rejected.

## R6. `catalogue.*` bridge namespace shape

**Decision.** A new **read-only** preload-bridge namespace `catalogue.*` with handlers
`lookupBarcode`, `lookupSku`, `search`, `resolve`. Every handler's first executable instruction is
`requireOperatorSession` (AD-1); all refusals are generic (reason logged, not echoed). See
contracts/bridge-api.md.

**Rationale.** Mirrors 005's `cart.*` discipline. A dedicated namespace keeps the surface enumerable
(Principle III) and the read-only intent explicit (no write handlers exist).

**Alternatives rejected.** *Fold lookup into the `cart.*` namespace.* Couples 009 to 005's surface and
blurs read-vs-mutate intent. Rejected.

## R7. R7-seam wiring

**Decision.** 009's production resolver (`src/main/catalogue/resolve-item-ref.ts`) is wired into 005's
existing cart bridge at the `cart-bridge.ts` `resolveItemRef` constructor option — the injection point
005 deliberately left unwired (production falls back to `DEFAULT_ITEM_REF_RESOLVER`, which refuses
generically). The seam signature
`resolveItemRef(item_ref) → { display_name, unit_price_minor, version } | { kind:'refused', reason }`
is **fixed by 005** (005 contracts/bridge-api.md:416-427) and is NOT changed by 009.

**Rationale.** The seam is a published cross-feature contract; 009 satisfies the signature and
implements behind it (Constitution P12 — artifacts are source of truth; the contract is one). 005's
fixture tests stay green because the signature is untouched.

**Alternatives rejected.** *Change the seam signature to carry richer fields.* Breaks 005's published
contract + fixture tests; the richer fields live in 009's read model / resolver output, threaded to
the cart only as the seam allows (AD-6). Rejected.

## R8. Search-store FSM & debounce

**Decision.** A renderer `catalogueSearchStore` (zustand) with 7 states: `idle`, `searching`,
`results`, `not_found`, `ambiguous`, `catalogue_unavailable`, `confirm_pending`. Typed search is
**debounced ~150 ms** (NFR-3) and only fires past the 2-char minimum (FR-16). **Scanner input bypasses
debounce** — a complete scan + terminator (Enter suffix) submits an exact lookup immediately (FR-8).
The store mirrors only bridge-confirmed results (P2).

**Rationale.** Debounce prevents a query per keystroke (NFR-3) but must not delay a scan (a scan is a
single atomic event, not incremental typing). Distinguishing the two input paths in the store is the
clean way to honour both. The 7-state set maps 1:1 to the spec's outcome states (FR-6/7/24 + confirm).

**Alternatives rejected.** *Single debounced path for both typed and scanned input.* Adds ~150 ms to
every scan — fails the "feels instant" intent (SC-1/SC-7). Rejected.

## R9. Resolver `version` token semantics

**Decision.** 009 populates the seam's `version: string` with a **product row-version / updated-at
token** from the read model — a stable per-product change marker. It is **carried but currently
unconsumed**: the cart snapshots only `display_name` + `unit_price_minor` (005 bridge-api.md:131);
`CartLine.version` is a separate monotonic optimistic-concurrency token (005 data-model.md:107), NOT
this resolver `version`. Reserved for a future cache-invalidation / staleness use.

**Rationale.** Resolves the item deferred from `/speckit-clarify`: the seam *signature* (which carries
`version`) was the spec decision; the *meaning* of the token is this plan's. Defining it minimally
satisfies the signature without inventing an unused consumer (P16) — while being honest about its
current non-consumption (rather than over-claiming it threads anywhere).

**Alternatives rejected.** *Return an empty/garbage `version`.* Dishonest provenance; a future
staleness consumer would have nothing stable to key on. *Build cache-invalidation now.* Unused
machinery; deferred until a consumer exists.

---

**End of Phase 0.** All plan-layer unknowns resolved. The one residual performance risk (R4 fold-column
scan vs FTS5 at scale) is tracked as R-RISK-1 and validated at the §A5 bring-up.
