# Quickstart: Product Search & Barcode Lookup

**Feature ID:** 009-product-search-and-barcode-lookup
**Plan:** [./plan.md](./plan.md) v1.0
**Created:** 2026-05-30

> Reviewer's walkthrough — how to test each user story independently after each slice. No
> implementation exists yet; this is the acceptance path `/speckit-tasks` derives test tasks from.
> All slices are gated (§A0–§A5); nothing here is runnable until the slices land.

---

## Preconditions (every story)

- A paired terminal (002) with an **active operator session** (004) — lookups are session-gated
  (NFR-6a). Sign in as a cashier before testing.
- A cart-bearing shell (003/007) with the **product/search input focused** — wedge scans land here.
- The `products` read model populated with a **fixture** set (S2+). Production ships the table empty;
  for review, inject fixtures (the catalogue-sourcing feature does not exist yet — R-RISK-2). The
  fixture set MUST include: an active product with one barcode; an active product with two barcodes
  (pack + unit); two active products sharing one barcode (the ambiguity case); an inactive product; a
  product with Arabic + English names + aliases; a product with a unit/pack label.

---

## Story 1 — Scan resolves to one active product (confirm-first)

1. With the search input focused, scan a known barcode (or type it + Enter to simulate the wedge
   terminator).
2. **Expect:** a **confirm panel** showing the Arabic-first name, price, and unit/pack label — NOT an
   immediate add (owner decision: confirm-first, FR-5).
3. Tap **Add** (or press Enter on the confirm).
4. **Expect:** the product is added to the open cart via 005's `cart.lines.add`; a brief confirmation;
   focus returns to the input ready for the next scan, with no mouse interaction needed (SC-1).

**Independent test:** no payment, no finalization, no receipt required.

## Story 2 — Unknown barcode → recoverable not-found

1. Scan a barcode with no matching active product.
2. **Expect:** a clear **"Product not found"** state showing the scanned value, offering retry / manual
   edit; **no hard error**; the next scan is accepted immediately (FR-6, SC-4).

## Story 3 — Ambiguous barcode → blocked, nothing added

1. Scan the barcode that the fixture maps to **two** active products.
2. **Expect:** a generic **"this barcode matches more than one product — resolve in catalogue"** state;
   **nothing added** to the cart; the ambiguity is logged for diagnostics (FR-7, SC-5). The system does
   NOT pick one.

## Story 4 — Exact SKU lookup

1. Type a value exactly matching a fixture product's SKU; submit.
2. **Expect:** the same confirm panel as a scan, resolving the single product (FR-9).

## Story 5 — Partial Arabic name search (folded)

1. Type a partial Arabic name using a **different alef form** than stored (e.g. "احمد" vs "أحمد"), or
   with/without harakat.
2. **Expect:** the product appears in a ranked, keyboard-navigable result list — folding makes the
   match alef/yaa/taa-marbuta/diacritic-insensitive on both sides (FR-11, FR-12a/b, SC-9). Arrow keys
   move selection; Enter selects.

## Story 6 — Partial English name search (folded)

1. Type a partial English name in mixed case / with an accent variant (e.g. "paracetamol" for
   "Paracétamol").
2. **Expect:** the product matches (case + accent + whitespace folding, both-sided, FR-12).

## Story 7 — Select a result and add

1. From a result list, arrow to an entry and press Enter (or tap).
2. **Expect:** the confirm panel, then add via 005's `cart.lines.add` (FR-15).

## Story 8 — Duplicate scan increments quantity

1. With product P already a line in the cart, scan P again and confirm.
2. **Expect:** the existing line's quantity **increments** (005 Q4 merge-by-`item_ref`), not a second
   line (owner decision, FR-21).

## Story 9 — Inactive product guard

1. Scan/look up an inactive (non-sellable) fixture product.
2. **Expect:** treated as not-found-for-selling; **not added**; a clear recoverable state (FR-18).
   Distinguishable from a true not-found only in diagnostics.

## Story 10 — Empty / too-short query

1. Clear the input, or type a single character.
2. **Expect:** no search runs; no result list (FR-16). (Scanned/full SKU/barcode values are exempt.)

## Story 11 — Missing required field blocks add

1. Resolve a fixture product deliberately missing `price_minor`.
2. **Expect:** add is refused with a generic, safe message; no partial line (FR-19, FR-22).

## Story 12 — Catalogue unavailable (distinct from not-found)

1. Point the read model at an **empty** (or unreadable) fixture.
2. Scan or search.
3. **Expect:** a single generic **"catalogue unavailable / system not ready"** state — visibly
   **distinct** from "product not found" (it signals escalate, not retype); reason logged only; works
   offline; no network round-trip (FR-24, SC-10). Staleness is NOT surfaced (FR-24a).

---

## R7 seam verification (S4)

- The production resolver (`src/main/catalogue/resolve-item-ref.ts`) is wired into 005's cart bridge
  at the `cart-bridge.ts` `resolveItemRef` constructor option (the slot 005 left as
  `DEFAULT_ITEM_REF_RESOLVER` generic-refusal in production).
- **Verify:** with the resolver wired, `cart.lines.add` for a known `item_ref` snapshots the Arabic
  `display_name` + `unit_price_minor`; 005's existing fixture tests **still pass** (the seam signature
  is unchanged — see [contracts/resolver-seam.md](./contracts/resolver-seam.md)).

## Performance bring-up (S5 / §A5)

- Against a **~50,000-row** fixture catalogue on target Windows hardware: exact barcode/SKU lookup
  ≤ 50 ms p95 (NFR-1); folded substring search ≤ 150 ms p95 (NFR-2); result render ≤ 16 ms (NFR-4).
- If folded search misses NFR-2 at 50k, the R4 FTS5 fallback is revisited with a stack-amendment
  rationale (R-RISK-1).

## What is NOT testable here (out of scope)

Catalogue population/sync; "add product" creation; cart mutation internals; payment/finalization/
receipt behavior; inventory/batch/FEFO; controlled-substance enforcement; native scanner SDKs.
