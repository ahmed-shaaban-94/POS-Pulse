# Data Model: Catalog Read-Down Consumption (Phase 1)

**Feature ID:** 010-pos-catalog-read-down-consumption
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Research:** [./research.md](./research.md)
**Created:** 2026-06-04
**Constitution version pinned:** v1.5.1

> 🚧 **CONCEPTUAL ONLY.** No SQL is authored by `/speckit-plan`. This describes entities, fields,
> invariants, and the migration ordering. The actual `migrations/*.sql` (staging tables + sync-state
> table) are authored by an implementation slice **under a §A2-class migration-safety review** (per the
> 009 §A2 review's "any later deviation returns here" rule) — they do NOT inherit 009's §A2 sign-off.
> 010 **writes** the local read model; 009 only reads it.

---

## Ownership split (010 vs 009)

| Table | Owner of schema | Written by 010? | Read by 009? |
|:--|:--|:--:|:--:|
| `products` (live) | 009 (`0029`) | **Yes — at promote only** (R2) | Yes (lookup/search/resolve) |
| `product_barcodes` (live) | 009 (`0030`) | **Yes — at promote only** (R2) | Yes |
| `products_staging` | **010 (`0031+`)** | Yes (bulk write) | No (never on lookup path) |
| `product_barcodes_staging` | **010 (`0031+`)** | Yes | No |
| `catalogue_sync_state` | **010 (`0031+`)** | Yes (in promote tx) | No (read only by the freshness surface) |

010 introduces **no** audit table and emits **no** audit events (lookups + read-downs are not
audit-eligible sensitive actions; the read-down is a background read into a read model). It carries
`price_minor` but performs **no** money arithmetic (R-money / Constitution P1).

---

## Entity: ProductsStaging / ProductBarcodesStaging  *(NEW — 010)*

Transient tables that mirror the **column shape of 009's live `products` / `product_barcodes`** (so a
promote is a straight `INSERT … SELECT`). The read-down bulk-writes the validated snapshot here; lookups
never touch them.

**Shape.** Identical columns to 009's `products` / `product_barcodes` (see 009 `data-model.md` + the
ratified `0029`/`0030` DDL), including the derived `name_fold` / `alias_fold` / `sku_norm` /
`barcode_norm` columns — all folded with **009's `normalize()`** at write-time (R1). The provenance
columns `row_version`, `created_at`, `updated_at` are populated from the snapshot record.

**Invariants:**

1. **Staging is tenant-scoped** like the live tables; a read-down only ever stages the terminal's own
   tenant/branch rows (P17 / FR-8).
2. **Staging is cleared at the start of each read-down** (or written under a per-run marker) so a prior
   failed run's rows never leak into a later promote.
3. **Validation happens before a row enters staging** (R5): `price_minor` is a safe integer ≥ 0
   (`Number.isSafeInteger`; P1), `name_ar` is non-empty, required identity/SKU present; invalid rows are
   skipped + counted, not staged.
4. **Staging writes are outside the promote transaction** (NFR-2) — they never hold locks against 009's
   lookups.
5. **009 never reads staging.** No lookup/search/resolve query references a `*_staging` table.

## Entity: CatalogueSyncState  *(NEW — 010)*

One row per tenant (the terminal serves a single tenant), holding read-down bookkeeping out of 009's hot
read path (R4).

**Fields** *(behavioural; SQL types derived at migration-author time):*

| Field | Shape | Notes |
|:--|:--|:--|
| `tenant_id` | string | Primary key (terminal is single-tenant; one row). |
| `branch_id` | string, nullable | Forward-looking; matches 009's optional branch scoping (R-RISK-4 inherited). |
| `last_success_at` | UTC timestamp, nullable | Timestamp of the last **successful promote**. Source of the FR-16 "catalogue last updated" indicator. Null until the first successful read-down. |
| `source_snapshot_id` | string, nullable | Opaque identifier of the snapshot last promoted (provenance; e.g. a backend-issued snapshot/version id). Not a sync cursor (full-replace model — R3). |
| `last_attempt_at` | UTC timestamp, nullable | Timestamp of the last read-down *attempt* (success or fail) — diagnostics. |
| `last_outcome` | enum, nullable | `succeeded` / `failed` / `skipped_with_rejections` — diagnostics. |

**Invariants:**

1. **`last_success_at` is written inside the promote transaction** (R4 / SC-10): the freshness indicator
   can never show a "last updated" time for a promote that did not commit (P2/P9 truthfulness).
2. **No secrets.** This table holds no token, no credential, no PII — only timestamps + an opaque source
   id (P7).
3. **Off the hot path.** Read only by the freshness surface (FR-16), never by lookup/search/resolve.

## Entity: CatalogueSourceSnapshot  *(NEW — 010, external input — PROPOSED shape)*

The full per-tenant/branch sellable-catalogue snapshot the backend delivers (R3 / R6). **Its concrete
shape is a PROPOSED backend contract — see [contracts/backend-catalogue-snapshot.md](./contracts/backend-catalogue-snapshot.md)** — and is **blocked on backend coordination + OpenAPI codegen** (Constitution V).

**Conceptual fields per product record** (must supply everything 009's read model requires — 009
`data-model.md` "Entity: Product" + "Entity: ProductBarcode"): stable `product_id`; `sku`; `name_ar`
(required); `name_en` (optional); optional `aliases`; `price_minor` (integer minor units); `tax_category`;
`unit_pack_label` (optional); `active`; `controlled_substance` / `prescription_required`; `row_version`;
`created_at` / `updated_at`; and one-or-more barcodes each with `barcode` (+ optional `barcode_kind`).

**Invariants:**

1. **Tenant/branch scoped at source.** The snapshot the backend returns is scoped to the terminal's
   tenant (and branch where applicable); 010 additionally guards that staged rows match the session/
   pairing tenant (P17 / NFR-4) and rejects any cross-tenant row.
2. **Read-direction only.** The snapshot flows backend → local; nothing is sent back (FR-10).
3. **Derived fold columns are NOT trusted from the source** — 010 recomputes `name_fold` / `alias_fold`
   / `sku_norm` / `barcode_norm` locally with `normalize()` (R1), regardless of what the source sends,
   so the stored fold always matches 009's query fold (FR-3 / SC-9).

## Entity: ReadDownRun  *(in-memory / diagnostics)*

One execution of the read-down: fetch → validate → stage → promote (or fail). Not a persisted table
(its durable trace is the `catalogue_sync_state` row + the redacted log line).

| Field | Shape | Notes |
|:--|:--|:--|
| `outcome` | enum | `succeeded` / `failed` / `skipped_with_rejections`. |
| `products_written` | integer | Count promoted. |
| `records_rejected` | integer | Count skipped (R5); drives the abort-threshold check. |
| `failure_category` | enum, nullable | transport / http-status-class / malformed-snapshot / threshold-exceeded / db-error — redacted diagnostics only. |

---

## Relationship summary

```
backend snapshot (full)                       009 live read model (009 reads)
        │  fetch (R6, PROPOSED)                       ▲
        ▼                                             │  promote (R2: one tx,
  [validate R5] ──> products_staging ────────────────┘   DELETE live + INSERT…SELECT)
                    product_barcodes_staging
        │
        └─ (fold via 009 normalize() — R1) → name_fold / alias_fold / *_norm

  catalogue_sync_state (last_success_at written INSIDE the promote tx) ──> freshness indicator (FR-16)
```

---

## Migration ordering (gated on a 010 §A2-class review)

Continuing the monotonic convention (`…0030_create_product_barcodes.sql`), 010's migrations land at
**0031+**, FK-safe, in a single PR (schema never half-installed):

| # | File (proposed) | Notes |
|:--|:--|:--|
| 0031 | `migrations/0031_create_products_staging.sql` | Mirrors `products` columns (incl. fold columns). No FK. Ships empty. |
| 0032 | `migrations/0032_create_product_barcodes_staging.sql` | Mirrors `product_barcodes`. Logical FK only (no SQL `FOREIGN KEY`). Ships empty. |
| 0033 | `migrations/0033_create_catalogue_sync_state.sql` | One-row-per-tenant bookkeeping. Ships empty. |

**Conventions inherited from the 009 §A2 review (binding):** logical FKs only (no SQL `FOREIGN KEY`);
**no append-only triggers** (these are read-model / bookkeeping tables, not audit anchors — but unlike
009's tables, they ARE writable by 010); money `INTEGER NOT NULL CHECK (… >= 0)`; booleans `0/1`;
timestamps `TEXT` ISO-8601 UTC; `CREATE … IF NOT EXISTS`; tenant-scoped indexes. **No change to 009's
`0029`/`0030` is required** by the chosen design (separate state table per R4; no new columns on
`products`).

**§A2 obligation (per owner's Q1 condition + the 009 review's closing rule):** the staging-table
migrations **and** the promote transaction's correctness (atomicity, tenant-scoping, no-half-state) MUST
be reviewed under a fresh §A2-class migration-safety package — they do not inherit 009's sign-off.

---

**End of data model.** No SQL authored here. An implementation slice derives the DDL and submits it for
the 010 §A2-class review.
