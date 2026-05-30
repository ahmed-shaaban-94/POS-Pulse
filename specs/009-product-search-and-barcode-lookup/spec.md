# Feature Specification: Product Search & Barcode Lookup

**Feature ID:** 009-product-search-and-barcode-lookup
**Status:** Draft — `/speckit-clarify` complete (2026-05-30; 5 questions resolved)
**Created:** 2026-05-30
**Last Updated:** 2026-05-30
**Owner:** POS-Pulse desktop team

---

## Overview

POS-Pulse has shipped the cart (005) and sale finalization / receipts (008), but the cart can only
*resolve* a product once it already knows its catalogue reference (`item_ref`). 005 deliberately
stubbed that resolution behind the **R7 `cart.resolveItemRef` seam** with a test-only fixture and
named "a future item-catalogue feature" as its real owner. **009 is that feature.**

009 owns the cashier's two ways of finding a sellable product at the till — **scanning a barcode**
(the primary input modality at checkout) and **typing a search** (by SKU, barcode, or Arabic/English
product name) — and resolving the chosen product into the exact snapshot the cart consumes at
add-time. It also provides the local, offline-first **product read model** that lookups query.

009 deliberately stops at *finding and resolving* a product. It DOES NOT mutate the cart (005 owns
`cart.lines.add`), source or sync the catalogue from the backend, do inventory / stock / batch /
FEFO / expiry, enforce controlled-substance overrides, or touch payment, finalization, or receipt
logic (006 / 008 own those). It is the read-and-resolve layer that sits *upstream* of the cart.

## Clarifications

### Session 2026-05-30

- Q: Performance & UX budgets, and the catalogue scale they hold at? → A: Exact barcode/SKU ≤ 50 ms p95; partial search ≤ 150 ms p95; result render ≤ 16 ms; min query 2 chars; max 20 results; debounce ~150 ms (typed search only) — all validated at a ~50,000 active-product catalogue on target Windows hardware. (NFR-1…NFR-4 promoted from agent-proposed to owner-confirmed.)
- Q: What gates a lookup/search operation? → A: An active operator session (per 004), enforced at the preload bridge with generic refusal — same posture as every `cart.*` handler (005). The product read model is main-process (SQLite), so every lookup crosses the bridge regardless; renderer-side gating is never load-bearing.
- Q: Arabic search normalization depth? → A: Standard search folding — alef variants (أإآٱ→ا), alef-maqsura (ى→ي), taa-marbuta (ة→ه), strip harakat + tatweel — applied identically to the query AND the stored name (match is normalization-*insensitive*). This is letter-form folding within Arabic only; cross-script / transliteration (Latin query → Arabic name) is alias territory, not normalization.
- Q: English search normalization? → A: English name search is first-class alongside Arabic and folds the same both-sided way: case-insensitive (already specified) + accent/diacritic-insensitive (e.g. "paracetamol" matches "Paracétamol") + whitespace trim/collapse. Cross-script remains alias territory.
- Q: Catalogue-unavailable vs product-not-found states? → A: One generic "catalogue unavailable" cashier-facing state (covering empty + missing + unreadable read model), distinct from the per-query "product not found" state — they require different cashier actions ("system not ready, escalate" vs "retype"). The specific reason (empty/missing/unreadable) is logged for diagnostics only. Staleness / not-yet-synced is NOT surfaced — 009 owns no freshness marker (the sourcing feature that would supply one is out of scope).

## User Scenarios & Testing

### Primary User Story

A signed-in cashier (operator session active per 004) stands at a cart-bearing surface with the
product/search input focused. A customer hands over a box of Panadol. The cashier scans its barcode
with a keyboard-wedge scanner; the scan is captured as keyboard text, the trailing Enter submits the
lookup, and POS-Pulse resolves it to exactly one active product. A confirmation panel shows the
Arabic-first product name, price, and unit/pack label; the cashier taps **Add** and the product joins
the open cart. For an item without a scannable barcode, the cashier types part of the Arabic name,
sees a ranked, keyboard-navigable result list of active products, selects one with the arrow keys and
Enter, confirms, and it is added. An unknown barcode produces a clear, recoverable "Product not found"
state — never a hard error.

### Acceptance Scenarios

Each scenario uses Given / When / Then phrasing and is testable without naming an implementation.

1. **Scan resolves to one active product**
   - **Given** a signed-in cashier with the product/search input focused and an open cart
   - **When** a keyboard-wedge scanner sends a known barcode followed by its Enter suffix
   - **Then** the system performs an exact barcode lookup, finds exactly one active product, and
     presents a confirmation panel showing the Arabic display name, price, and unit/pack label; the
     product is added to the cart only after the cashier confirms (per owner decision: confirm-first).

2. **Scan of an unknown barcode**
   - **Given** the same focused input
   - **When** a barcode with no matching active product is scanned
   - **Then** the system surfaces a clear, recoverable "Product not found" state showing the scanned
     value, offers retry / manual edit, and MUST NOT raise a hard error or block the next scan.

3. **Ambiguous barcode (data conflict)**
   - **Given** the product read model contains more than one active product mapped to the same barcode
   - **When** that barcode is scanned or typed
   - **Then** the system refuses to guess: it surfaces a generic "this barcode matches more than one
     product — resolve in the catalogue" state, adds nothing to the cart, and records the ambiguity
     for diagnostics; it MUST NOT silently pick one.

4. **Exact SKU lookup**
   - **Given** the focused input
   - **When** the cashier types a value that exactly matches an active product's SKU and submits
   - **Then** the system resolves that single product and presents the same confirmation panel as a
     scan.

5. **Partial name search — Arabic**
   - **Given** the focused input
   - **When** the cashier types a partial Arabic product name (≥ the minimum query length)
   - **Then** a ranked result list of active products whose Arabic name, English name, or alias
     contains the query is shown, capped at the maximum displayed count, and is fully
     keyboard-navigable (arrow keys move selection, Enter selects).

6. **Partial name search — English**
   - **Given** the focused input
   - **When** the cashier types a partial English product name
   - **Then** active products whose English name (or alias) matches are listed and ranked the same way.

7. **Select a result and add**
   - **Given** a result list with at least one entry
   - **When** the cashier selects an entry (keyboard or tap) and confirms
   - **Then** the chosen product is resolved to the cart snapshot and added to the open cart.

8. **Duplicate scan increments quantity**
   - **Given** a cart already holding a line for product P
   - **When** P is scanned again and confirmed
   - **Then** the existing line's quantity is incremented (via the cart's merge-by-`item_ref` default,
     005 Q4) rather than a second line being created (per owner decision: increment quantity).

9. **Inactive / non-sellable product guard**
   - **Given** a barcode or SKU that matches a product flagged not active / not sellable
   - **When** it is scanned or looked up
   - **Then** the system treats it as not found for selling purposes — it MUST NOT be added to the
     cart and surfaces a clear, recoverable state (distinguishable in diagnostics from a true
     not-found, generic to the cashier).

10. **Empty / too-short query**
    - **Given** the focused input
    - **When** the query is empty or shorter than the minimum query length
    - **Then** no search is executed (no expensive lookup is triggered) and no result list is shown.

11. **Missing required snapshot fields blocks add**
    - **Given** a product that matches but is missing a field the cart / downstream finalization
      requires (e.g., no price)
    - **When** the cashier attempts to add it
    - **Then** add-to-cart is refused with a generic, safe message; no partial line is created.

12. **Catalogue unavailable (distinct from not-found)**
    - **Given** the local product read model is empty, missing, or unreadable
    - **When** the cashier scans or searches
    - **Then** the system returns a single generic "catalogue unavailable" state — clear, recoverable,
      visibly *distinct* from "product not found" (it signals the system is not ready, not a retype);
      the specific reason is logged for diagnostics only; it works entirely from local data and never
      requires a network round-trip during checkout.

### Edge Cases

- **Scanner Enter suffix** — the trailing Enter (or configured terminator) submits the lookup safely;
  it MUST NOT leak into the cart, trigger an unrelated default-button action, or submit a half-typed
  query in a way that pollutes another field.
- **Stray scan / focus elsewhere** — if focus is not in the product/search input, wedge input MUST NOT
  silently populate an unrelated field; the cart screen's focus-management strategy keeps wedge input
  in its sanctioned context (Constitution Platform §Hardware).
- **Multi-barcode product** — a single active product carrying several barcodes (pack barcode, unit
  barcode) resolves to that one product from any of its barcodes; this is *not* the ambiguous case.
- **Whitespace / casing / numeral form / letter form** — leading/trailing whitespace is trimmed and
  internal whitespace collapsed; SKU/barcode match is case-insensitive where the source data is;
  Arabic-Indic and Latin digits are folded so a digit search matches regardless of numeral form; Arabic
  letter forms and English case/accents are folded per FR-12a/FR-12b (both query and stored name).
- **Very long / rapid scan bursts** — consecutive scans are each handled predictably; a new scan does
  not corrupt an in-flight confirmation; the cashier always knows which product is pending.
- **Result list overflow** — when matches exceed the maximum displayed count, the list shows the
  top-ranked subset and indicates that the query should be refined; it never renders an unbounded list.
- **No-results recovery** — a no-results state always offers retry / manual edit and returns focus to
  the input ready for the next attempt.

## Requirements

### Functional Requirements

Each requirement is testable, unambiguous, and uses MUST/SHOULD/MAY.

**Product read model**

- **FR-1.** The system MUST provide a local, offline-first product read model that all lookups and
  searches query without a network round-trip.
- **FR-2.** Each product record MUST carry at minimum: a stable `product_id`; one or more `barcode`
  values; a `sku`; an Arabic display name; an English display name *(when available)*; a
  `price_minor` (integer minor units); the tax / category metadata a sale line requires; a unit / pack
  label *(when available)*; and an `active` / sellable flag. Records MAY carry optional aliases /
  common names for search.
- **FR-3.** The read model MUST be the source the lookup serves; this feature reads it but does NOT
  populate, sync, or author it (see Out of Scope / Dependencies).

**Barcode lookup**

- **FR-4.** A scanned or typed barcode MUST be matched by **exact** value against active products.
- **FR-5.** A barcode resolving to exactly one active product MUST surface a confirmation panel
  (product name, price, unit/pack); the product is added to the cart only on cashier confirmation
  *(owner decision: confirm-first)*.
- **FR-6.** A barcode matching **zero** active products MUST surface a clear, recoverable "Product not
  found" state and MUST NOT raise a hard error (Constitution Domain: unknown barcode never hard-errors).
- **FR-7.** A barcode matching **more than one** active product MUST be treated as a data-ambiguity
  block: the system MUST NOT guess, MUST add nothing, and MUST surface a generic "resolve in catalogue"
  state while recording the ambiguity for diagnostics.
- **FR-8.** The scanner's terminator (Enter suffix) MUST submit the lookup safely and MUST NOT leak the
  scanned characters or the Enter into the cart or an unrelated control.

**SKU & text search**

- **FR-9.** An exact `sku` value MUST resolve to its single active product (same confirmation path as a
  barcode).
- **FR-10.** A manually typed barcode value MUST be looked up by the same exact-barcode rule as a scan.
- **FR-11.** Partial **Arabic** name input MUST return active products whose Arabic name (or alias)
  contains the query, matched **normalization-insensitively** per FR-12b.
- **FR-12.** Partial **English** name input MUST return active products whose English name (or alias)
  contains the query, matched **normalization-insensitively** per FR-12b.
- **FR-12a.** Arabic matching MUST apply standard search folding to BOTH the query and the stored name:
  alef variants (أ/إ/آ/ٱ → ا), alef-maqsura (ى → ي), taa-marbuta (ة → ه), and stripping of harakat
  (diacritics) and tatweel. English matching MUST be case-insensitive, accent/diacritic-insensitive
  (e.g. "paracetamol" matches "Paracétamol"), and whitespace-trimmed/collapsed. Folding is letter-form
  normalization *within a script only* — cross-script / transliteration (e.g. a Latin query matching an
  Arabic-only name) is NOT normalization and is served via aliases (FR-13), if at all.
- **FR-12b.** Matching MUST be a property of the *comparison*, not a one-sided transform: the query and
  the indexed product text MUST be folded identically before comparison. Normalizing only the query
  (leaving stored names unfolded) is non-compliant.
- **FR-13.** Alias / common-name search MUST be supported when a product carries aliases. Aliases are
  also where any cross-script / transliterated common name lives (FR-12a).
- **FR-14.** Search results MUST be returned as a ranked list and MUST be keyboard-navigable (arrow
  keys move the selection, Enter selects the highlighted entry) so the cashier can operate without a
  mouse.
- **FR-15.** A cashier MUST be able to select any result (keyboard or tap) and proceed to confirm-and-add.
- **FR-16.** An empty query, or a query shorter than the minimum query length, MUST NOT trigger a search.
- **FR-17.** The number of results displayed MUST be capped at a defined maximum; when matches exceed
  it, the system MUST show the top-ranked subset and indicate the query should be refined.
- **FR-17a.** Each search-result row MUST show useful selling data: the product name (Arabic-first),
  the price, the unit/pack label when available, and the barcode or SKU where it helps the cashier
  disambiguate.

**Sellable guard & resolution**

- **FR-18.** Products not flagged active / sellable MUST be excluded from add-to-cart; an inactive match
  is treated as not-found for selling and surfaces a clear, recoverable state.
- **FR-19.** Resolving a selected product MUST produce the snapshot the cart consumes at add-time —
  satisfying the existing **R7 `cart.resolveItemRef` seam** signature (`display_name`,
  `unit_price_minor`, and a catalogue `version` token), plus the additional snapshot fields downstream
  finalization / receipts need (see Key Entities → Product Snapshot). If any required snapshot field is
  missing, resolution MUST refuse generically and the product MUST NOT be added.

**Cart integration (boundary only)**

- **FR-20.** Adding a confirmed product to the cart MUST go through the **existing** cart boundary
  (005 `cart.lines.add` and the R7 resolution seam); 009 MUST NOT introduce a parallel cart-mutation
  path and MUST NOT change payment, finalization, or receipt logic.
- **FR-21.** A re-scan / re-add of a product already on the cart MUST increment that line's quantity via
  the cart's merge-by-`item_ref` default (005 Q4), not create a duplicate line *(owner decision:
  increment quantity)*.
- **FR-22.** If required snapshot fields are missing at add-time, the boundary MUST block the add with a
  generic, safe error and create no partial line (mirrors FR-19's resolution-refusal rule).

**Offline-first**

- **FR-23.** Scan and search MUST function entirely from local product data and MUST NOT require a
  network round-trip during checkout (no network unless the owner explicitly approves a sync surface).
- **FR-24.** When the product read model is **empty, missing, or unreadable**, lookups MUST return a
  single generic **"catalogue unavailable"** state — clear, recoverable, never a crash or hang. This
  state MUST be **distinct from** the per-query "product not found" state (FR-6): a catalogue-level
  failure tells the cashier the system is not ready (escalate / get help), whereas not-found tells the
  cashier to retype. The specific reason (empty vs missing vs unreadable) is logged for diagnostics
  only and is NOT distinguished at the cashier surface.
- **FR-24a.** Catalogue **staleness / not-yet-synced** MUST NOT be surfaced as a distinct state: 009
  owns no freshness marker (the catalogue-sourcing feature that would supply one is out of scope, see
  Dependencies). If a future sourcing feature adds a freshness marker, surfacing staleness is a future
  amendment, not part of 009.

### Non-Functional Requirements

- **NFR-1.** Exact barcode lookup and exact SKU lookup MUST resolve in **≤ 50 ms** at p95 against a
  catalogue of at least 50,000 active products on the target Windows hardware (Constitution Domain:
  barcode lookup is effectively O(1) against the local index — this constraint is recorded here as the
  constitutional implementation bound, not a success criterion).
- **NFR-2.** Partial text search MUST return its ranked, capped result set in **≤ 150 ms** at p95 on the
  same catalogue size and hardware.
- **NFR-3.** Typed search MUST be **debounced** (search fires only after input settles for a short
  interval) so that each keystroke does not trigger a query; debounce MUST NOT apply to scanner input
  (a complete scan + terminator submits immediately).
- **NFR-4.** The result list MUST render within **one animation frame budget (≤ 16 ms)** of results
  being available, and MUST display **at most a defined maximum** (default 20) results.
- **NFR-5.** Display MUST be **Arabic-first with English fallback** (RTL default for Arabic locale per
  Constitution Localization); every interactive element MUST meet the **44 × 44 CSS-pixel** touch-target
  floor; the cashier MUST be able to scan and add without any mouse interaction when the input is focused.
- **NFR-6.** Wedge input MUST be confined to the product/search input's sanctioned focus context;
  stray scans MUST NOT pollute unrelated fields (Constitution Platform §Hardware focus-management rule).
- **NFR-6a.** Every lookup / search / resolve operation MUST be gated at the preload bridge on an
  **active operator session** (per 004), with generic refusal on no-session / wrong-tenant — the same
  posture as every `cart.*` handler (005). The product read model is main-process; renderer-side checks
  are never load-bearing. There MUST be no path that lets a cashier search but not add (no looser gate
  than the cart's add path).
- **NFR-7.** No PII, no credential fragment, and no raw catalogue payload beyond the permitted snapshot
  fields may appear in logs / Sentry / support bundles; ambiguity and not-found diagnostics MUST be
  redacted to the project's existing allowlist discipline.

## Success Criteria

Measurable, technology-agnostic outcomes. The feature is "done" when these are demonstrably true.

- **SC-1.** A cashier can scan a known active product and have it on the cart (after one confirm tap)
  in under **3 seconds**, with no mouse interaction.
- **SC-2.** **≥ 99 %** of scans of known active products resolve to the correct single product with no
  manual disambiguation step.
- **SC-3.** A cashier can find an unbarcoded product by typing part of its Arabic or English name and
  add it within **5 seconds** and within a handful of keystrokes.
- **SC-4.** Every unknown-barcode scan results in a clear, recoverable "Product not found" state and a
  ready-for-retry input — **zero** hard errors or dead-ends across a scan-storm test.
- **SC-5.** Every barcode that maps to more than one active product is blocked as ambiguous with nothing
  added to the cart — **zero** silent guesses.
- **SC-6.** Scan and search succeed with the network disconnected — **100 %** of lookups work offline.
- **SC-7.** Exact lookups feel instant and typed search feels live to the cashier across a 50,000-product
  catalogue (validated against NFR-1 / NFR-2 budgets on target hardware).
- **SC-8.** No product line ever reaches the cart missing a field that finalization / receipts require —
  **zero** partial lines.
- **SC-9.** A cashier searching an Arabic product name finds it regardless of alef / yaa / taa-marbuta
  form or diacritics — **100 %** of a representative folded-variant test set returns the product
  (Arabic + English folding, both-sided).
- **SC-10.** A catalogue-unavailable condition is always shown as a distinct "system not ready" state,
  never confused with "product not found" — **zero** misclassifications across the empty / missing /
  unreadable test matrix.

## Key Entities

- **Product (read-model record)** — a sellable catalogue entry the lookup serves. Carries
  `product_id`, one-or-more `barcode`s, `sku`, Arabic display name, optional English display name,
  `price_minor` (integer minor units), tax/category metadata for the sale line, optional unit/pack
  label, optional aliases/common names, and an `active`/sellable flag.
- **Barcode index entry** — the mapping from a barcode value to a product, supporting fast exact
  lookup and detection of one-barcode-to-many-products ambiguity.
- **Search query** — the cashier's typed/scanned input (Arabic, English, SKU, or barcode), normalised
  before matching (whitespace-trimmed/collapsed; numeral-form-folded; Arabic letter-form folded; English
  case/accent folded — per FR-12a); subject to a minimum length before a name search runs.
- **Search result** — a ranked, capped list of active products presented for keyboard/tap selection.
- **Product Snapshot** — the resolution output handed to the cart's existing R7 seam at add-time. MUST
  satisfy the cart's `cart.resolveItemRef` contract (`display_name`, `unit_price_minor`, and a catalogue
  `version` token) and MUST carry the additional fields downstream sale finalization / receipts (008)
  need so the cart line, the
  payment-intent envelope, and the printed receipt can be built without reaching back into 009:
  `product_id`, the selling barcode/SKU, Arabic + English display names, `price_minor`, tax/category
  metadata, and unit/pack label. This is a *snapshot* — the cart freezes it at add-time (005 FR-011 /
  FR-013); later catalogue drift does not rewrite the line.

## Assumptions

- **The R7 seam is the integration contract.** 009 implements the `cart.resolveItemRef` seam that 005
  stubbed; the cart's add path (`cart.lines.add`) and its merge-by-`item_ref` default (005 Q4) are
  consumed unchanged. 009 changes no cart behavior.
- **Confirm-first on single match** and **increment-quantity on duplicate scan** are the locked owner
  decisions (this session, 2026-05-30); both are reflected in FR-5 and FR-21.
- **Match semantics:** barcode and SKU match is *exact*; name/alias search is *substring* (contains),
  matched normalization-insensitively per FR-12a/FR-12b (Arabic letter-form folding; English
  case/accent folding; numeral folding; whitespace folding — applied to both query and stored name).
  Ranking favours exact-prefix over mid-string matches and active products only.
- **Minimum query length** defaults to **2 characters** for name search; barcode/SKU exact lookups are
  exempt (a full scanned/typed value submits directly).
- **Maximum displayed results** defaults to **20**; **debounce** defaults to **~150 ms** for typed
  search only.
- **The performance/UX budgets in NFR-1…NFR-4 (≤50 ms exact lookup, ≤150 ms search, ≤16 ms render,
  ~50,000-product validation catalogue, 2-char minimum query, 20-result cap, ~150 ms debounce) are
  owner-confirmed** (Clarifications 2026-05-30), not provisional.
- **Catalogue freshness/sync is owned elsewhere.** 009 assumes a pre-existing local read model and a
  defined behavior when it is empty / missing / unreadable (the generic "catalogue unavailable" state,
  FR-24); it does not define how/when the model is filled, and it does NOT observe staleness (FR-24a).
- The cart screen is a sanctioned wedge-input context (Constitution Platform §Hardware); 009 inherits
  that focus-management posture rather than redefining it.

## Out of Scope

Explicitly NOT delivered by this feature.

- Catalogue **sourcing / ingestion / sync** from the backend (who fills the read model and when).
- Catalogue **write / "add product" creation** flow. An unknown barcode routes to a clear not-found /
  manual-edit state; *creating* a catalogue record is a future catalogue-management feature, not 009.
- Full **inventory stock-control engine**, stock-movement ledger, purchase orders, supplier
  management, receiving stock.
- **Expiry / batch / lot** tracking and FEFO issue policy.
- **Returns / refunds.**
- **Discounts / promotions** engine, loyalty, member/insurance pricing math.
- **Reports / KPIs / analytics.**
- **Backend sync implementation**, any new OpenAPI / backend surface (unless the owner explicitly
  approves), and any direct SaaS-database access.
- **Cart mutation internals** (005 owns `cart.lines.add` and merge), and any change to **payment (006),
  finalization, or receipt (008)** logic.
- **Native scanner SDKs** (Honeywell, Zebra DataWedge bridge, etc.) — keyboard-wedge HID only.
- **Controlled-substance / prescription-required enforcement** (supervisor override at sale time). 009
  MAY *surface* these flags on a result for cashier awareness, but enforcement is out of scope.

## Dependencies

- **005-sales-cart** — the `cart.lines.add` boundary and the R7 `cart.resolveItemRef` seam this feature
  implements; the merge-by-`item_ref` (Q4) default that powers duplicate-scan increment.
- **004-operator-session** — an active operator session must gate the cart-bearing surface where lookup
  runs; refusals stay generic per 004's discipline.
- **008-sale-finalization-and-receipts** — the downstream consumer (via the payment-intent envelope)
  whose receipt/finalization field needs define the minimum Product Snapshot.
- **A pre-existing local product read model** — populated by a future catalogue-sourcing capability;
  009 reads it offline-first and defines the empty / missing / unreadable behavior (FR-24). Staleness
  is unobservable to 009 and deferred (FR-24a).
- **Constitution v1.5.0** — Domain (Products / Barcode), Platform §Hardware (keyboard-wedge, focus
  management, 44×44 touch target), Localization (Arabic-first RTL), and Principle XVI (Feature Scope
  Discipline).

## Open Questions

- (none)

---

*Constitution alignment:* This spec MUST satisfy the principles of `.specify/memory/constitution.md`
(version pinned at the time of writing). The plan and tasks artifacts will perform the explicit
"Constitution Check."
