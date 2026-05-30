# Data Model: Product Search & Barcode Lookup (Phase 1)

**Feature ID:** 009-product-search-and-barcode-lookup
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Research:** [./research.md](./research.md)
**Created:** 2026-05-30
**Constitution version pinned:** v1.5.1

> 🚧 **CONCEPTUAL ONLY.** No SQL is authored by `/speckit-plan`. The migration for the two new tables
> (`products`, `product_barcodes`) + the search-fold column/index is authored during Slice S2 under
> §A2. This file describes entities, fields, invariants, and relationships; the SQL shape is derived
> from it by the migration tasks. No source, `*.sql`, or `*.ts` is created here.

---

## Overview

009 introduces **two** new local SQLite tables. Both are **read-only from 009's perspective** — 009
ships them empty and exposes no insert/update/delete path; a future catalogue-sourcing feature owns
population (R1 / AD-2).

| Table | Purpose | Mutability (from 009) | Mutability (future sourcing feature) |
|:--|:--|:--|:--|
| `products` | The product read model — one row per sellable product. | **Read-only** | Mutable (populate / update / deactivate) |
| `product_barcodes` | Barcode → product mapping (≥1 per product; pack + unit barcodes). | **Read-only** | Mutable |

009 introduces **no** audit table and emits **no** audit events — lookups are pure reads and are not
audit-eligible sensitive actions (plan P4/P10 = N/A-read-only). It carries `price_minor` but performs
no money arithmetic (AD-5).

---

## Entity: Product

One row per sellable product. The read model the lookup serves.

**Fields** *(behavioural; SQL types derived at migration-author time)*:

| Field | Shape | Notes |
|:--|:--|:--|
| `product_id` | UUID / string | Primary key. Stable identity; the resolver's identity field. |
| `tenant_id` | UUID / string | **Mandatory.** Every query filters by it (P17 tenant isolation). |
| `branch_id` | UUID / string, **nullable** | Forward-looking; MVP is tenant-scoped (all branches), so normally null. Per-branch availability is deferred (R-RISK-4). |
| `sku` | string | Exact-lookup key (FR-9). Unique per tenant (application-enforced by the sourcing feature; 009 reads). Indexed (normalized). |
| `name_ar` | string | **Arabic display name** (Arabic-first; NOT NULL). The single `display_name` threaded to the cart line / receipt (AD-6). |
| `name_en` | string, **nullable** | English display name *when available*. Used for search + result display + confirm; **not** threaded downstream today (008 single-`display_name`, AD-6 / R-RISK-3). |
| `name_fold` | string | **Precomputed normalized fold** of `name_ar` (+ `name_en` folded into a searchable form) per R4 / `normalize.ts`. The substring-search column. Maintained at write-time by the sourcing feature using 009's published fold rules. |
| `aliases_json` | JSON array of strings, **nullable** | Optional alias / common names (FR-13). Cross-script / transliterated common names live here (FR-12a). |
| `alias_fold` | string, **nullable** | Precomputed fold of the aliases for substring search (R4). |
| `price_minor` | INTEGER (minor units) | **Carried, never computed** (AD-5; P1). `Number.isSafeInteger`-guarded on read. |
| `tax_category` | string / enum | Tax / category metadata the sale line *would* need. **Carried in the read model; NOT threaded through the envelope today** — 008 computes sale-level VAT (OQ-3), not per-line (AD-6 / R-RISK-3). Forward-looking. |
| `unit_pack_label` | string, **nullable** | Unit / pack label *when available* (e.g. "×20 tablets"). Shown on result rows + confirm (FR-17a); not threaded downstream today. |
| `active` | boolean | **Sellable guard** (FR-18). Inactive products are excluded from add-to-cart and treated as not-found-for-selling. |
| `controlled_substance` | boolean | Surfaced on a result for cashier awareness only; **enforcement is out of scope** (plan Hard Boundaries; constitution Domain). |
| `prescription_required` | boolean | As above — surfaced, not enforced. |
| `row_version` | string | Per-product change marker (e.g. monotonic counter or updated-at token). Source of the resolver seam's `version` field (AD-4 / R9). Currently unconsumed provenance. |
| `created_at` / `updated_at` | UTC timestamp | Maintained by the sourcing feature. |

**Invariants:**

1. **Tenant isolation (P17).** Every read query MUST filter `tenant_id = session.tenant_id`; a
   tenant-A product is never returned to a tenant-B session. Enforced at the bridge (AD-1), not by the
   renderer.
2. **`price_minor` is INTEGER minor units** and `Number.isSafeInteger`-guarded on read (P1; AD-5). A
   product whose `price_minor` is missing/invalid fails resolution generically (FR-19).
3. **`name_ar` is NOT NULL** — Arabic-first display requires it; it is the single `display_name`
   threaded downstream (AD-6).
4. **`active = false` ⇒ excluded from sellable results** (FR-18). The product MAY still exist for
   diagnostics but is never resolvable to a cart line.
5. **`name_fold` / `alias_fold` are derived**, not authoritative — they are the fold of `name_ar` /
   `name_en` / `aliases_json` under the *same* `normalize.ts` rules used to fold a query (FR-12b). If
   the fold rules change, these columns are rebuilt by the sourcing feature.
6. **009 never writes this table.** No 009 code path inserts/updates/deletes a row.

---

## Entity: ProductBarcode

Barcode → product mapping. Zero is illegal for a sellable product (a product reachable only by
name/SKU MAY have zero barcodes, but then it is not barcode-resolvable); a product MAY have several.

**Fields:**

| Field | Shape | Notes |
|:--|:--|:--|
| `barcode_id` | UUID / string | Primary key. |
| `product_id` | string (FK → `products.product_id`) | The owning product. |
| `tenant_id` | UUID / string | Denormalized for tenant-scoped index lookups. |
| `barcode` | string | The raw barcode value (EAN/GTIN). |
| `barcode_norm` | string | Normalized barcode (trimmed; numeral-folded) — the indexed exact-lookup key (R2 / R3). |
| `barcode_kind` | string / enum, **nullable** | e.g. `pack` / `unit`; informational. |
| `created_at` | UTC timestamp | |

**Invariants:**

1. **Exact lookup is on `barcode_norm`** within `tenant_id`, joined to `active` products (R2/R3).
2. **One barcode → many `product_barcodes` rows for ONE product is normal** (pack + unit) — resolves
   to a single `product_id` (not ambiguous).
3. **One barcode value → ≥ 2 distinct active `product_id`s is the AMBIGUITY block (FR-7).** The lookup
   MUST return the ambiguity signal, add nothing, and log for diagnostics; it MUST NOT pick one.
4. **009 never writes this table.**

---

## Entity: ProductSnapshot *(resolver output — in-memory, not a table)*

The output the resolver hands back. Two consumers with **different** field subsets:

**(a) The 005 cart seam** consumes exactly the fixed signature (R7 — unchanged from 005):

```text
{ display_name: string, unit_price_minor: integer, version: string }
  | { kind: 'refused', reason: 'unknown_item' | 'disabled' | 'no_connection' | 'generic' }
```

- `display_name` ← `products.name_ar` (the single Arabic-first name; AD-6).
- `unit_price_minor` ← `products.price_minor` (carried; AD-5).
- `version` ← `products.row_version` (provenance, currently unconsumed; AD-4 / R9).
- `refused` ← inactive product (`disabled`), unknown `item_ref` (`unknown_item`), missing required
  field (`generic`), etc. — generic to the cashier; reason logged (FR-19).

**(b) The 009 search/confirm UI** consumes the richer surface (for display + confirm, NOT threaded to
the cart line):

| Field | Source | Threaded to cart/receipt today? |
|:--|:--|:--:|
| `product_id` | `products.product_id` | No (identity for the lookup) |
| `display_name_ar` | `products.name_ar` | **Yes** (as the cart line `display_name`) |
| `display_name_en` | `products.name_en` | No (008 single-name, AD-6) |
| `price_minor` | `products.price_minor` | **Yes** (as `unit_price_minor`) |
| `unit_pack_label` | `products.unit_pack_label` | No (result/confirm display only) |
| `tax_category` | `products.tax_category` | No (008 sale-level VAT, AD-6) |
| `selling_barcode` / `sku` | matched `product_barcodes.barcode` / `products.sku` | No (result/confirm display only) |
| `active` | `products.active` | Guard — never resolves if false |
| `controlled_substance` / `prescription_required` | `products.*` | No (surfaced for awareness only) |

**Invariant.** The snapshot is a frozen value at confirm-time; the cart freezes its own line snapshot
at add-time (005 FR-011/FR-013). Later catalogue drift does not rewrite an existing cart line.

---

## Entity: SearchQuery *(in-memory)*

The cashier's typed/scanned input.

| Field | Shape | Notes |
|:--|:--|:--|
| `raw` | string | As entered/scanned. |
| `normalized` | string | `raw` after `normalize.ts`: trim + collapse whitespace; numeral fold; Arabic letter fold; English case/accent fold (FR-12a). |
| `kind` | enum | `scan` (terminator-submitted, bypasses debounce) / `typed` (debounced, min 2 chars) — R8. |

**Invariants:** empty or < 2-char `normalized` for a `typed` name query → no search runs (FR-16). A
`scan` or full SKU/barcode submits an exact lookup regardless of length.

---

## Entity: SearchResult *(in-memory)*

A ranked, capped list presented for selection.

| Field | Shape | Notes |
|:--|:--|:--|
| `items` | array (≤ **20**, NFR-4) | Ranked: exact-prefix > mid-string; active only. |
| `truncated` | boolean | True when matches exceeded the cap → UI indicates "refine query" (FR-17). |

Each item carries the **(b)** ProductSnapshot display surface (name Arabic-first, price, unit/pack,
barcode/SKU where useful — FR-17a) and is keyboard-navigable (FR-14).

---

## Relationship summary

```
products (1) ────< product_barcodes (1..N)
   │
   │  name_fold / alias_fold  ──(substring search, R4)──>  SearchResult.items[]
   │  name_ar + price_minor + row_version  ──(resolve, R7 seam)──>  005 cart line snapshot
   │
   └── (009 reads only; future sourcing feature writes)
```

Neither table emits audit events; neither is written by 009. The `ProductSnapshot` is not a row — it
is the in-memory resolver output.

---

## Migration ordering (gated on §A2)

The S2 migration tasks author the tables in FK order:

1. `products` (no FK out)
2. `product_barcodes` (FK → `products`)
3. Indexes: `product_barcodes.barcode_norm` (+ `tenant_id`), `products.sku` (+ `tenant_id`),
   `products.name_fold` / `alias_fold` (the substring-search columns, R4).

No append-only trigger is needed — these are read models, not audit anchors. The tables are mutable
(by the future sourcing feature); 009 simply never writes them. The migration installs schema +
indexes only; it inserts **zero** product rows (the table ships empty — production shows "catalogue
unavailable" until a sourcing feature populates it, FR-24 / R-RISK-2).

---

**End of data model.** No SQL is authored here. The S2 migration tasks derive the SQL and submit it
for §A2 review.
