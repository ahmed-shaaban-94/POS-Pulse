# §A2 — Migration Review (010-pos-catalog-read-down-consumption)

**Feature:** 010-pos-catalog-read-down-consumption
**Gate:** §A2 — staging + sync-state migrations (`0031`–`0033`) + the promote transaction (P3 + Constitution VII + P17 + II/P1)
**Prepared by:** agent (Claude Code), 2026-06-04 — **review package for owner ratification**
**Owner sign-off (§A2):** ⛔ **NOT RATIFIED — held `source-mapping-pending`** (see §0 + §7).
**Base SHA at preparation:** `056d829` (PR #342 merge — 010 spec artifacts)
**Constitution version pinned:** v1.5.1

> This file is the durable §A2 review package, mirroring 009's
> `migration-review/s2-migration-review.md`. **Docs-only — no SQL is authored here as a migration;** the
> proposed DDL below is illustrative for review. Ratifying this file (with §7 decisions answered + the §0
> hold lifted) unblocks the migration tasks (T011–T013). **It does NOT inherit 009's §A2 sign-off** (per
> the 009 §A2 review's "any later deviation returns here" closing rule).

---

## 0. ⛔ Why this is HELD (read first)

**The table *schema* is reviewable and stable; the *ingest mapping that fills it* is NOT yet decided.**
The [§A6 reconciliation findings](../a6-reconciliation-findings.md) showed the real backend contract
(`SellableCatalogRow`) cannot currently populate three columns 009's read model requires:

| 009 column (staging mirrors it) | Backend v1 provides? | Blocks ratification because… |
|:--|:--|:--|
| `products.name_ar` **NOT NULL** | ❌ single `name`, no ar/en (GAP-3) | A `NOT NULL name_ar` migration locks a column the backend can't fill until GAP-3 is decided (map `name`→`name_ar`, or wait for bilingual columns). |
| `product_barcodes` rows | ❌ barcode is opaque inside `aliases[]` (GAP-2) | If the staging mirror keeps a `barcode_norm NOT NULL` table, there is no clean source to populate it until the backend exposes barcode type. |
| `products.price_minor` INTEGER | ⚠️ major-unit decimal+currency (GAP-1) | Schema is fine (INTEGER), but the *converter* (decimal→minor) is the ingest contract, reviewed with the writer, not the migration. |

**Therefore:** this package reviews **table-creation + promote-transaction safety** (which ARE stable —
the staging tables mirror 009's already-shipped `0029`/`0030` shape). It is **held** until GAP-1/2/3 are
decided, because those decisions may change the staging column shape (e.g. `name_ar` nullability, whether
`product_barcodes_staging` exists in v1 at all). Ratify only after the §A6 decision round.

---

## 1. Gate decision

⛔ **NOT RATIFIED — `source-mapping-pending`.** Table/promote safety is sound (§§3–6, 9); ratification
waits on the §A6 GAP-1/2/3 decisions (§0) that fix the staging column shape. The §7 migration-shape
decisions (D1–D5) are recorded as recommendations for when the hold lifts.

---

## 2. Prerequisite evidence

- **009 shipped `products` (`0029`) + `product_barcodes` (`0030`)** — read-only from 009, **mutable by
  this sourcing feature** (009 data-model "Mutability (future sourcing feature) = Mutable"). 010 is that
  feature.
- **Latest migration on `main` is `0030_create_product_barcodes.sql`** → 010's land at `0031`–`0033`.
- **Migration runner** (`src/main/db/migrate.ts`): transactional per file (one tx wrapping DDL +
  `schema_migrations` bookkeeping; opt-out via `-- @no-wrap-transaction`); tracks applied migrations in
  `schema_migrations(name, applied_at, checksum)`; DB opens `journal_mode = WAL` (`src/main/db/client.ts:42`).
- **No catalogue data ships** — migrations install schema + indexes only (the read model is filled at
  runtime by the read-down, not by a migration seed).

---

## 3. Required migration order (FK-safe)

| # | File (proposed) | Notes |
|:--|:--|:--|
| 0031 | `migrations/0031_create_products_staging.sql` | Mirrors `products` columns (incl. fold columns). No outbound FK. Ships empty. |
| 0032 | `migrations/0032_create_product_barcodes_staging.sql` | Mirrors `product_barcodes`. Logical FK `product_id` → staging products (NOT SQL-enforced). Ships empty. **Existence gated on GAP-2 (§0).** |
| 0033 | `migrations/0033_create_catalogue_sync_state.sql` | One row per tenant: bookkeeping. Ships empty. |

**Numbering invariant:** all three land in one PR (or sequential commits in one PR) so the schema is never
half-installed on `main` — same invariant as 009's `0029`/`0030`.

---

## 4. Proposed DDL (ILLUSTRATIVE — for review, not the authored migration)

> Conventions mirror 009's ratified `0029`/`0030` + the `0004`/`0010`/`0020` precedents: money
> `INTEGER NOT NULL CHECK (… >= 0)`; booleans `INTEGER … CHECK (… IN (0,1))`; timestamps `TEXT` ISO-8601
> UTC; **no `FOREIGN KEY` clauses** (logical FKs only); `CREATE … IF NOT EXISTS`. **⚠ marks a §0-held or
> §7-decision item.**

### 0031 — `products_staging`  (column-identical to `products`)

```sql
CREATE TABLE IF NOT EXISTS products_staging (
  product_id            TEXT    NOT NULL PRIMARY KEY,
  tenant_id             TEXT    NOT NULL,
  branch_id             TEXT,                                   -- ⚠(GAP-4/§A6) store_id is first-class in the backend contract; may become NOT NULL
  sku                   TEXT    NOT NULL,
  sku_norm              TEXT    NOT NULL,                       -- normalize(sku)
  name_ar               TEXT    NOT NULL,                       -- ⚠(GAP-3) backend has single `name`, no ar/en — nullability/mapping HELD
  name_en               TEXT,
  name_fold             TEXT    NOT NULL,                       -- normalize(name_ar + ' ' + name_en) — R1 composition
  aliases_json          TEXT,
  alias_fold            TEXT,
  price_minor           INTEGER NOT NULL CHECK (price_minor >= 0),  -- ⚠(GAP-1) converted from backend decimal+currency at ingest (writer, not migration)
  tax_category          TEXT    NOT NULL,
  unit_pack_label       TEXT,                                   -- ⚠ not in backend v1 (read-down.yaml:43-45) — always NULL until a backend spec adds it
  active                INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  controlled_substance  INTEGER NOT NULL DEFAULT 0 CHECK (controlled_substance IN (0,1)),  -- ⚠ not in backend v1 — defaults until added
  prescription_required INTEGER NOT NULL DEFAULT 0 CHECK (prescription_required IN (0,1)), -- ⚠ not in backend v1
  row_version           TEXT    NOT NULL,                       -- backend row_cursor / updated_at provenance
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);
-- Staging carries NO lookup indexes (009 never reads it). Indexes live only on the live tables.
```

### 0032 — `product_barcodes_staging`  ⚠ existence HELD on GAP-2

```sql
CREATE TABLE IF NOT EXISTS product_barcodes_staging (
  barcode_id    TEXT NOT NULL PRIMARY KEY,
  product_id    TEXT NOT NULL,            -- logical FK → products_staging.product_id (NOT SQL-enforced)
  tenant_id     TEXT NOT NULL,
  barcode       TEXT NOT NULL,
  barcode_norm  TEXT NOT NULL,            -- normalize(barcode)
  barcode_kind  TEXT,
  created_at    TEXT NOT NULL
);
```
⚠ **GAP-2:** the backend snapshot does not expose typed barcodes (only an opaque `aliases[]`). Until the
backend exposes barcode type (or a barcode endpoint), there is **no clean source** for these rows. Options
when the hold lifts: (a) populate from typed barcodes once the backend adds them; (b) ship the table empty
in v1 and accept that barcode-scan returns "not found" until barcoded data arrives; (c) defer this table
to a later migration. **Decision belongs to the §A6 round, not this review.**

### 0033 — `catalogue_sync_state`

```sql
CREATE TABLE IF NOT EXISTS catalogue_sync_state (
  tenant_id          TEXT NOT NULL PRIMARY KEY,
  branch_id          TEXT,
  last_success_at    TEXT,                -- written INSIDE the promote tx (SC-10 truthfulness)
  source_snapshot_id TEXT,                -- opaque backend cursor/snapshot id (provenance, not a sync cursor)
  last_attempt_at    TEXT,
  last_outcome       TEXT                 -- 'succeeded' | 'failed' | 'skipped_with_rejections'
);
```

---

## 5. The promote transaction (the load-bearing safety review)

The promote is reviewed here because its **atomicity** is a §A2-class concern (it mutates the live
read model 009 queries). Per plan R2/AD-2:

```text
db.transaction(() => {
  DELETE FROM products        WHERE tenant_id = :t;
  DELETE FROM product_barcodes WHERE tenant_id = :t;
  INSERT INTO products         SELECT * FROM products_staging        WHERE tenant_id = :t;
  INSERT INTO product_barcodes SELECT * FROM product_barcodes_staging WHERE tenant_id = :t;
  UPDATE catalogue_sync_state SET last_success_at = :now, source_snapshot_id = :sid, last_outcome='succeeded' WHERE tenant_id = :t;
})();   // better-sqlite3 synchronous transaction — atomic; rolls back on throw
```

**Safety properties to confirm at review:**
1. **Atomic (FR-6 / P3).** Single synchronous better-sqlite3 transaction; a throw mid-promote rolls back
   the whole thing — live tables unchanged, `last_success_at` not advanced. No partial state ever visible.
2. **Concurrent-reader-safe (FR-12 / NFR-2).** Under WAL (`client.ts:42`) 009's lookups read concurrently
   with the promote write-tx; the promote does not block lookups. (Latency-budget validated at §A5, not here.)
3. **Tenant-scoped (P17).** Every statement filters `tenant_id = :t`; the promote never touches another
   tenant's rows. A single-tenant terminal has one tenant, but the scoping is explicit defence.
4. **`last_success_at` inside the tx (SC-10).** Freshness can never claim a promote that didn't commit.
5. **Staging cleared per run.** Staging is truncated/overwritten at the start of each read-down so a prior
   failed run's rows never leak into a later promote (reviewed with the writer, T032).
6. **No money arithmetic in the promote.** `price_minor` is already integer (converted at ingest, GAP-1);
   the promote is a pure row-move. No float touches SQL.

---

## 6. Append-only (P4) analysis

| Table | Append-only? | Trigger pair? |
|:--|:--:|:--:|
| `products_staging` | NO | NO |
| `product_barcodes_staging` | NO | NO |
| `catalogue_sync_state` | NO | NO |

None is an audit anchor (consistent with 009 §A2 §6 — `products`/`product_barcodes` are read models, not
ledgers). Unlike 009, **010 WRITES these tables** (it's the sourcing feature) — but they remain read models
(catalogue data), not money-bearing event logs, so **no `trg_*_no_update`/`trg_*_no_delete` triggers**. The
whole-replace promote (DELETE+INSERT) is the intended mutation pattern; it is not a destructive correction
of a financial record (P4 N/A).

---

## 7. Migration-shape decisions (recommendations — binding only once §0 hold lifts)

| # | Decision | Recommendation | Why |
|:--|:--|:--|:--|
| **D1** | Staging carries NO indexes (only live tables are queried)? | **Yes — no staging indexes** | 009 never reads staging; indexes would only slow the bulk write. |
| **D2** | Promote = transaction-wrapped DELETE+INSERT (vs shadow-table rename)? | **DELETE+INSERT in one tx** | Plan R2; safest under 009's prepared statements; ~50k rows well within budget under WAL. |
| **D3** | `catalogue_sync_state` is one-row-per-tenant (PK `tenant_id`)? | **Yes** | Terminal is single-tenant; freshness reads one row off the hot path. |
| **D4** | Logical FKs only, no SQL `FOREIGN KEY` (009 convention)? | **Yes** | Matches every migration since `0004`; the writer enforces integrity. |
| **D5** | `products_staging.unit_pack_label` / `controlled_substance` / `prescription_required` ship as defaulted/nullable (not in backend v1)? | **Yes — nullable/defaulted** | Backend v1 can't populate them (read-down.yaml:43-45); 009 only *surfaces* them; harmless as defaults. |

> **Held decisions (NOT D-items — they belong to the §A6 round):** `name_ar` nullability (GAP-3), whether
> `product_barcodes_staging` exists in v1 (GAP-2), `branch_id` nullability (GAP-4 store scoping).

---

## 8. Security notes

1. **Integer minor units only (II/P1).** `price_minor INTEGER CHECK(>=0)`; the decimal→minor conversion
   happens at the ingest validation boundary (string parse → integer; never a float) — reviewed with the
   writer, not this migration.
2. **Tenant isolation (P17).** Promote + every staging query filters `tenant_id`.
3. **No secrets in any table.** `catalogue_sync_state` holds timestamps + an opaque snapshot id only — no
   token, no PII (P7). The `X-Terminal-Token`/JWT credential never lands in a table.
4. **No audit emission.** The read-down is not a sensitive action; these migrations add no
   `auditEmitter` call.

---

## 9. Go / no-go conclusion

**⛔ NO-GO for now — `source-mapping-pending`.** The table-creation + promote-transaction safety is sound
and ready (§§3–6); the package is **held** only because the §A6 GAP-1/2/3 decisions can still change the
staging column shape (`name_ar` nullability, `product_barcodes_staging` existence, `branch_id` scoping).
**Ratify after the §A6 decision round**, at which point D1–D5 become binding and the held columns are
finalized. This is the honest split: review what's stable now, don't lock what's still open.

---

## 10. Cross-gate status snapshot

| Gate | Status | Blocks |
|:--|:--:|:--|
| §A2 (this) | ⛔ held `source-mapping-pending` | migration tasks T011–T013 |
| §A4 (P8 bridge) | ⛔ required | bridge tasks T043/T044 |
| §A5 (prod readiness) | ⏳ rollout-time | rollout PR |
| §A6 (backend contract) | ⛔ EXTERNAL — the upstream blocker | this §A2 hold + all network code |

---

**End of §A2 review package.** Prepared for the owner; not self-cleared. Held on the §A6 reconciliation
decisions — see [`a6-reconciliation-findings.md`](../a6-reconciliation-findings.md).
