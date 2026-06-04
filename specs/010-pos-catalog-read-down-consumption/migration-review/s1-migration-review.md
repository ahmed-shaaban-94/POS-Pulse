# §A2 — Migration Review (010-pos-catalog-read-down-consumption)

**Feature:** 010-pos-catalog-read-down-consumption
**Gate:** §A2 — staging + sync-state migrations (`0031`–`0033`) + the promote transaction (P3 + Constitution VII + P17 + II/P1)
**Prepared by:** agent (Claude Code), 2026-06-04 — **review package for owner ratification**
**Owner sign-off (§A2):** ✅ **RATIFIED — 2026-06-05 (owner).** `branch_id`/store scope = **`NOT NULL TEXT`** (the last held dimension; auth/scope resolved by Data-Pulse-2 PR #490). Clears the **G3 decision precondition for the offline S1+S2 correctness core only** — see the **§A2 Ratification** block below. Does NOT clear §A4, §A5, or the D-DEPLOY live-client blocker (#349).
**Base SHA at preparation:** `056d829` (PR #342 merge — 010 spec artifacts)
**Constitution version pinned:** v1.5.1

> This file is the durable §A2 review package, mirroring 009's
> `migration-review/s2-migration-review.md`. **Docs-only — no SQL is authored here as a migration;** the
> proposed DDL below is illustrative for review. Ratifying this file (with §7 decisions answered + the §0
> hold lifted) unblocks the migration tasks (T011–T013). **It does NOT inherit 009's §A2 sign-off** (per
> the 009 §A2 review's "any later deviation returns here" closing rule).

---

## §A2 Ratification — 2026-06-05 (owner)

✅ **§A2 is RATIFIED.** The single remaining held dimension — `branch_id`/store scope (GAP-4) — is now decided. The auth/scope shape it was waiting on **landed**: Data-Pulse-2 **PR #490** (issue **#488 CLOSED**) authenticates read-down by the **device-principal token** and resolves **`(tenant_id, store_id)`** from the store-bound `devices` row. Read-down is therefore **store-scoped by the paired device principal**.

**1. Decision.** The store/branch-scope column is **`NOT NULL TEXT`** wherever the POS-010 read-down **staging** and **sync-state** model stores branch/store scope.

**2. Scope.** Applies to the POS-010 migrations **when they are authored later** (this record does not author them):
- `0031 products_staging.branch_id` → **`TEXT NOT NULL`**.
- `0033 catalogue_sync_state.branch_id` → **`TEXT NOT NULL`** (part of the row's scope alongside the `tenant_id` PK).
- `0032 product_barcodes_staging` mirrors `0030` and has **no** branch/store column of its own — barcode rows are store-scoped transitively via `tenant_id` + their `product_id` link to a (now store-scoped) `products_staging` row. **No new column is added to 0032.**
This supersedes the prior illustrative `branch_id TEXT` (nullable) shown for 0031/0033 in §4 and the "STILL HELD" notes in §0/§7.

**3. Rationale.** POS read-down is store-scoped via Data-Pulse device-principal auth (PR #490): tenant/store context is resolved from the paired device row, so every staged/promoted catalog row belongs to a known store. Price, availability, and tax may vary by store, so a staged or promoted catalog row **without** branch/store scope is invalid. Nullable store scope is therefore disallowed in POS-010 catalogue staging and sync-state.

**4. Boundary.** This is a **decision record only**. It does **not** author or modify any migration, does **not** start POS-010 S1+S2 implementation, and does **not** modify 009's live `0029`/`0030`. 009's live `products.branch_id` stays **nullable** (009-owned, `0029`; unchanged here); the NOT-NULL constraint is enforced on **010's staging** at ingest, and the promote's `INSERT … SELECT` carries the non-null staged value into 009's (nullable) live column — fully compatible. The writer must **reject any source row lacking resolvable store scope** before it reaches staging.

**5. Gate impact.** Clears the **G3 (migration) decision precondition** for the **offline S1+S2 correctness core only** (unblocks *authoring* tasks T011–T013 when implementation is later approved). Does **NOT** clear **§A4** (bridge security), **§A5** (production readiness / perf), or the **D-DEPLOY live-client blocker** (Data-Pulse-2 **#349** — backend edge HTTP 521; gates T002/T020/T021/T039).

**6. Stop condition.** If implementation later requires a **nullable** `branch_id` or **global (store-less) catalogue rows**, STOP and return to the owner for a new decision — this ratification does **not** authorize a global-catalogue layer (that would be a separate future migration).

> Recorded for honesty (not a §A2 blocker): the malformed-record **abort-threshold** value (FR-9 / R-RISK-4, task T035) remains undecided — an S2 writer-tuning decision, not a table-shape decision.

---

## 0. ⛔ Why this WAS HELD (historical) — UPDATED 2026-06-04: narrowed to `branch_id`/GAP-4 only · ✅ RESOLVED 2026-06-05 (see §A2 Ratification above)

**Update (2026-06-04):** Two of the three originally-held column dimensions are now **RESOLVED** by the
owner-ratified §A6 decisions (D-NAME + D-BARCODE, [a6-reconciliation-findings.md](../a6-reconciliation-findings.md)
2026-06-04). The hold is **narrowed** from `source-mapping-pending` (held on three) to **`auth-pending`**
(held on **one** — `branch_id` scoping, which depends on the still-open backend auth/contract decisions
D-AUTH-1/D-DEPLOY, [Data-Pulse-2 #488](https://github.com/ahmed-shaaban-94/Data-Pulse-2/issues/488)).

| 009 column (staging mirrors it) | Backend v1 provides? | Status |
|:--|:--|:--|
| `products.name_ar` **NOT NULL** | single `name`, no ar/en (GAP-3) | ✅ **RESOLVED (D-NAME).** Writer maps the single backend `name` → `name_ar`; `name_ar` **stays `NOT NULL`** because ingest always supplies `name`. No nullability change. (See §0a.) |
| `product_barcodes` rows | barcode opaque inside `aliases[]` (GAP-2) | ✅ **RESOLVED (D-BARCODE).** `product_barcodes_staging` **exists**, column-identical to `0030`; `barcode_kind` stays nullable (always NULL in v1 — type unknown). Population from the untyped bag is a **writer/S2 ingest concern**, not a table-shape fact. (See §0a.) |
| `products.price_minor` INTEGER | major-unit decimal+currency (GAP-1) | ✅ Schema fine (INTEGER); the decimal→minor *converter* is the ingest contract, reviewed with the writer — never was a table-shape blocker. |
| `products.branch_id` nullability | store_id first-class; device scope = `(tenant_id, store_id)` (GAP-4) | ✅ **RESOLVED 2026-06-05.** Auth/scope landed (PR #490 / #488 CLOSED). Owner ratified **`branch_id`/store scope = `NOT NULL TEXT`** on 010 staging + sync-state (see §A2 Ratification). |

**Therefore:** this package reviews **table-creation + promote-transaction safety** (stable — the staging
tables mirror 009's already-shipped `0029`/`0030` shape). The name and barcode shapes were finalized
2026-06-04 (D-NAME + D-BARCODE), and the last held dimension — `branch_id`/GAP-4 — is now **RESOLVED and
RATIFIED 2026-06-05** (`NOT NULL TEXT`; see §A2 Ratification above), the auth/scope shape having landed in
PR #490. **§A2 is ratified for the offline S1+S2 correctness core.** (D-DEPLOY #349 remains a *live-client*
blocker, not a migration-shape one.)

---

## 0a. Resolved-shape mapping (D-NAME + D-BARCODE — owner-ratified 2026-06-04)

**D-NAME → `name_*` columns (table shape FINAL):**
- The backend supplies a single `tenant_products.name` (no ar/en split — GAP-3, deferred to a future 003
  spec). The writer maps it to **`name_ar := name`** (the `NOT NULL` Arabic-first display column, `0029:31`).
- **`name_en := NULL`.** This **refines** the wording in the merged ratification note
  ([a6-reconciliation-findings.md](../a6-reconciliation-findings.md), which said "map `name` into *both*
  fold inputs"): search behaviour is identical either way because `name_fold = normalize(name_ar + ' ' +
  name_en)` with `name_en` absent collapses to `normalize(name)`; but storing `name_en = NULL` (rather than
  a redundant copy of `name`) is the **truthful** mapping — `0029:32` defines `name_en` as "nullable;
  English when available," and no English name is available. The *fold input* still uses `name` for both
  positions (so search is unaffected); only the **stored** `name_en` column is NULL. No schema change to
  `0029`'s shape — `name_ar NOT NULL` stays, `name_en` stays nullable.
- **Consequence:** no Arabic-specific display in v1 (the displayed `name_ar` is just the backend's
  language-neutral `name`); restored only when a future backend spec adds a real Arabic column. Owner-accepted.

**D-BARCODE → `product_barcodes_staging` (table shape FINAL; population deferred to S2 writer):**
- The table **exists** and is **column-identical to `0030`** (`barcode_id`, `product_id`, `tenant_id`,
  `barcode`, `barcode_norm`, `barcode_kind?`, `created_at`). `barcode_kind` stays nullable and is **always
  NULL in v1** (the backend `aliases[]` is untyped — GAP-2; we cannot know "pack" vs "unit" vs even
  "is-this-actually-a-barcode").
- **The bag→table *population* is a writer/S2 ingest decision, NOT a §A2 table-shape fact** (same boundary
  this package already draws for the money converter). For review-context only (not binding here): the
  lowest-risk reading of D-BARCODE keeps 009's exact-**scan** path (`product_barcodes.barcode_norm`,
  `idx_product_barcodes_tenant_norm`, `0030:27`) working by exploding each untyped `aliases[]` entry into a
  `product_barcodes` row (`barcode := alias`, `barcode_norm := normalize(alias)`, `barcode_kind := NULL`),
  while the same bag is also stored in `products.aliases_json`/`alias_fold` for substring **search**. Same
  source → both 009 destinations, **zero change to 009's query path**. This is exactly the *lossy* behaviour
  the owner accepted (a supplier_code resolves as if a barcode). **One new fact vs 009 the writer must
  own:** bag entries are bare strings with no upstream id, so the writer **synthesizes `barcode_id`** — fine
  under the full-replace promote (it need not be stable across runs). Mechanism = S2 (T032), confirmed not
  to need a schema change here.

---

## 1. Gate decision

✅ **RATIFIED — 2026-06-05 (owner).** Table/promote safety is sound (§§3–6, 9), the name + barcode shapes
were finalized 2026-06-04 (D-NAME + D-BARCODE — §0/§0a), and the last dimension — `branch_id` scoping
(GAP-4) — is decided: **`branch_id`/store scope = `NOT NULL TEXT`** on 010 staging + sync-state (auth/scope
resolved by PR #490 / #488 CLOSED). See the **§A2 Ratification** block. The §7 migration-shape decisions
D1–D5 are now **binding**, joined by **D6** (`branch_id NOT NULL`). This clears the **G3 decision
precondition for the offline S1+S2 correctness core only**; §A4 / §A5 / D-DEPLOY (#349) remain.

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
| 0032 | `migrations/0032_create_product_barcodes_staging.sql` | Mirrors `product_barcodes` (`0030` shape). Logical FK `product_id` → staging products (NOT SQL-enforced). Ships empty. **✅ Existence RESOLVED (D-BARCODE) — table exists in v1 (§0a).** |
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
  branch_id             TEXT    NOT NULL,                       -- ✅(GAP-4 RESOLVED + RATIFIED 2026-06-05) store/branch scope NOT NULL (device scope = (tenant_id, store_id), PR #490). NOTE: 009 live products.branch_id stays nullable (0029, unchanged); staging is stricter — promote INSERT…SELECT non-null→nullable is fine.
  sku                   TEXT    NOT NULL,
  sku_norm              TEXT    NOT NULL,                       -- normalize(sku)
  name_ar               TEXT    NOT NULL,                       -- ✅(D-NAME RESOLVED) := backend single `name`; stays NOT NULL (ingest always supplies name). §0a
  name_en               TEXT,                                   -- ✅(D-NAME RESOLVED) := NULL in v1 (no English name; refines ratification note). §0a
  name_fold             TEXT    NOT NULL,                       -- normalize(name + ' ' + name) = normalize(name) — R1 composition (D-NAME). §0a
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

### 0032 — `product_barcodes_staging`  ✅ existence RESOLVED (D-BARCODE) — table EXISTS, column-identical to `0030`

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
✅ **GAP-2 RESOLVED (D-BARCODE, owner-ratified 2026-06-04):** the table **exists** and ships with the
`0030` shape; `barcode_kind` stays nullable (always NULL in v1 — the backend `aliases[]` is untyped). The
*population* (explode the untyped bag into rows; synthesize `barcode_id`) is a **writer/S2 ingest decision**
per §0a — **not a table-shape concern for this review**. The table-shape question this §A2 package owns is
now closed: it exists, identical to `0030`. (Lossy-but-functional v1 barcode scan; owner-accepted.)

### 0033 — `catalogue_sync_state`

```sql
CREATE TABLE IF NOT EXISTS catalogue_sync_state (
  tenant_id          TEXT NOT NULL PRIMARY KEY,
  branch_id          TEXT NOT NULL,       -- ✅(RATIFIED 2026-06-05) store/branch scope NOT NULL — read-down is store-scoped (PR #490). §A2 Ratification.
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
| **D6** | `branch_id`/store scope on `products_staging` (0031) + `catalogue_sync_state` (0033) — `NOT NULL`? | ✅ **RATIFIED 2026-06-05 — `NOT NULL TEXT`** | Read-down is store-scoped by the device principal (PR #490; scope = `(tenant_id, store_id)`); a row without store scope is invalid (price/availability/tax vary by store). `0032` has no store column (scoped via `tenant_id` + `product_id`). 009 live `0029`/`0030` unchanged; staging stricter than live is compatible with the promote. See §A2 Ratification. |

> **Held decisions (NOT D-items — they belong to the §A6 round):**
> - ✅ `name_ar` nullability (GAP-3) — **RESOLVED (D-NAME):** stays `NOT NULL`, := backend `name` (§0a).
> - ✅ whether `product_barcodes_staging` exists in v1 (GAP-2) — **RESOLVED (D-BARCODE):** it exists,
>   `0030` shape (§0a).
> - ✅ `branch_id` nullability (GAP-4 store scoping) — **RESOLVED + RATIFIED 2026-06-05 (D6):** `NOT NULL TEXT`
>   on 010 staging + sync-state (auth/scope landed in PR #490 / #488 CLOSED; device scope = `(tenant_id, store_id)`).
>   See §A2 Ratification.

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

**✅ GO (for the offline S1+S2 correctness core) — RATIFIED 2026-06-05.** Table-creation + promote-transaction
safety is sound (§§3–6); the name + barcode shapes were finalized 2026-06-04 (D-NAME + D-BARCODE); and the
last dimension — `branch_id` scoping (GAP-4) — is decided: **`NOT NULL TEXT`** (auth/scope landed in PR #490 /
#488 CLOSED; device scope = `(tenant_id, store_id)`). D1–D6 (§7) are binding. This GO authorizes **authoring**
migrations 0031–0033 (tasks T011–T013) **only when implementation is separately approved** — it does not
itself start implementation. **Still NO-GO for the live client / rollout:** §A4 (bridge security), §A5
(production readiness / perf), and **D-DEPLOY (#349)** remain open and gate T002 / T020 / T021 / T039 + the
bridge / rollout slices.

---

## 10. Cross-gate status snapshot

| Gate | Status | Blocks |
|:--|:--:|:--|
| §A2 (this) | ✅ **RATIFIED 2026-06-05** (`branch_id`/store scope = `NOT NULL TEXT`; offline S1+S2 core) | unblocks migration tasks T011–T013 *when implementation is approved* |
| §A4 (P8 bridge) | ⛔ required | bridge tasks T043/T044 |
| §A5 (prod readiness) | ⏳ rollout-time | rollout PR |
| §A6 (backend contract) | ⛔ EXTERNAL — the upstream blocker | this §A2 hold + all network code |

---

**End of §A2 review package.** Prepared for the owner. **Updated 2026-06-05:** §A2 **RATIFIED** by the owner —
`branch_id`/store scope = **`NOT NULL TEXT`** (the last held dimension; auth/scope resolved in PR #490 / #488
CLOSED). G3 decision precondition cleared for the **offline S1+S2 correctness core only**; **§A4, §A5, and
D-DEPLOY (#349) remain**. See the **§A2 Ratification** block at the top. (Prior: 2026-06-04 D-NAME + D-BARCODE
finalized the name/barcode shapes; see [`a6-reconciliation-findings.md`](../a6-reconciliation-findings.md).)
