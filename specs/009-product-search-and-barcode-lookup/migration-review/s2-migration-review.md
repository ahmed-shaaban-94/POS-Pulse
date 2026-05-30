# §A2 — Slice S2 Migration Review (009-product-search-and-barcode-lookup)

**Feature:** 009-product-search-and-barcode-lookup
**Gate:** §A2 — `products` / `product_barcodes` / fold-column migration review (P4 + Constitution VII + P17)
**Prepared by:** agent (Claude Code), 2026-05-31 — **review package for owner ratification**
**Owner sign-off (§A2):** ⏳ **PENDING Ahmed ratification** (see §1 + §9)
**Base SHA at preparation:** `7aaaa55` (PR #320 merge — "feat(009): catalogue component shells + a11y (Slice S1b)")
**Constitution version pinned:** v1.5.1

> This file is the durable §A2 review package. It is **docs-only**: **no SQL is
> authored here as a migration** (the user explicitly scoped this to "prepare the
> package, don't write the migration"). The proposed DDL below is *illustrative,
> for review* — the actual `migrations/*.sql` files are authored by the S2
> implementer under tasks T020/T021 once this gate is ratified, shipping their
> own diff + tests. **Ratifying THIS file (with the §7 decisions answered)
> unblocks §A2.** Mirrors the 005 precedent (`specs/005-sales-cart/security-review/s2-migration-review.md`).

---

## 1. Gate decision — recommendation

**Recommend GO**, conditional on the owner ruling on the **§7 open decisions**
(they change the column/index shape, so they must be settled *before* T021 authors the SQL).

Per the §A0/§A1 convention, this is an agent-prepared recommendation; the §A2
gate is the owner's to close. Conditions for clearance:

| Condition | Status |
|:--|:--:|
| Foundational (T005–T008: `normalize.ts` + store FSM) merged | ✅ PR #317 |
| S0 visual direction ratified | ✅ §A0 (PR #318) |
| S1 bridge skeleton + gating merged | ✅ PR #319 |
| S1 component shells merged | ✅ PR #320 |
| `data-model.md` describes both tables, fields, invariants, FK graph | ✅ |
| Constitution P4 (append-only) analysis recorded per table | ✅ (§6 — N/A, read models) |
| §7 open decisions ruled on by the owner | ⏳ **PENDING** |
| Test plan T020/T022/T023/T026/T028/T029 located | ✅ (§8) |
| Implementation plan T020–T030 sequenced | ✅ (§9-impl) |

---

## 2. S1 prerequisite evidence

- **PR #317** — Foundational. `normalize.ts` (the load-bearing fold, ≥95% cov) +
  `catalogueSearchStore` 7-state FSM. The migration's `*_fold`/`*_norm` columns
  are populated (by the future sourcing feature) using **exactly** `normalize.ts`
  — the same function the bridge folds queries with (FR-12b, both-sided).
- **PR #319** — S1a bridge skeleton: typed `catalogue.*` namespace + the
  `requireCatalogueSession` gate (NFR-6a). Handlers return the
  `catalogue_unavailable` stub until this read model exists.
- **PR #320** — S1b: 7 layout-only shells (a11y-clean).
- **Deferred from S1a → lands in S2:** the main-process **`ipcMain.handle`
  registration** for the four `catalogue:*` channels + instantiation of
  `createCatalogueBridge` in the composition root (`src/main/index.ts`) wired to
  `getCurrentSession` from the session manager. The preload surface is dormant
  until this lands (nothing calls it in S1). **This is an S2 deliverable** (see §9).
- **No catalogue data on disk yet.** The tables do not exist; every lookup
  returns `catalogue_unavailable`. S2 creates the (empty) schema; population is a
  future catalogue-sourcing feature (R1 / AD-2) — **out of 009's scope**.

---

## 3. Required migration order (FK-safe)

Continuing the monotonic convention (`…0028_extend_sales_with_lines_json.sql`),
the two 009 migrations land at **0029 / 0030**:

| # | File (proposed) | Authored by | Notes |
|:--|:--|:--|:--|
| 0029 | `migrations/0029_create_products.sql` | T021 | No outbound FK. Table + `*_fold`/`*_norm` columns + indexes. Ships **empty**. |
| 0030 | `migrations/0030_create_product_barcodes.sql` | T021 | Logical FK `product_id` → `products` (not SQL-enforced). Table + `barcode_norm` index. Ships **empty**. |

**Numbering invariant:** both migrations land in one PR (or sequential commits in
one PR) so the read model is never half-installed on `main`. `products` first
(no FK out), then `product_barcodes`.

---

## 4. Proposed DDL (ILLUSTRATIVE — for review, not the authored migration)

> Shapes derived from `data-model.md` §"Entity: Product" / §"Entity:
> ProductBarcode". Conventions mirror `0020_create_sales.sql` + `0010_cart_lines.sql`:
> money `INTEGER NOT NULL CHECK (… >= 0)`; booleans `INTEGER … CHECK (… IN (0,1))`;
> timestamps `TEXT` (ISO-8601 UTC); **no `FOREIGN KEY` clauses** (logical FKs only,
> per the `0004_audit_events.sql` precedent); `CREATE … IF NOT EXISTS`.
> **Items marked ⚠ are §7 owner decisions** — shown here as the *recommended* shape.

### 0029 — `products`

```sql
CREATE TABLE IF NOT EXISTS products (
  product_id            TEXT    NOT NULL PRIMARY KEY,
  tenant_id             TEXT    NOT NULL,
  branch_id             TEXT,                                   -- nullable; forward-looking (MVP tenant-scoped, R-RISK-4)
  sku                   TEXT    NOT NULL,                       -- raw, for display
  sku_norm              TEXT    NOT NULL,                       -- ⚠(D1) normalized via normalize.ts; the exact-lookup key
  name_ar               TEXT    NOT NULL,                       -- Arabic-first display name (AD-6)
  name_en               TEXT,                                   -- nullable; English when available
  name_fold             TEXT    NOT NULL,                       -- ⚠(D2) precomputed fold of name_ar (+ name_en) — substring-search column
  aliases_json          TEXT,                                   -- nullable JSON array of strings (FR-13)
  alias_fold            TEXT,                                   -- nullable; precomputed fold of aliases
  price_minor           INTEGER NOT NULL CHECK (price_minor >= 0),   -- integer minor units (P1)
  tax_category          TEXT    NOT NULL,                       -- ⚠(D3) carried; NOT threaded downstream today (AD-6)
  unit_pack_label       TEXT,                                   -- nullable; "×20 أقراص" etc.
  active                INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  controlled_substance  INTEGER NOT NULL DEFAULT 0 CHECK (controlled_substance IN (0,1)),
  prescription_required INTEGER NOT NULL DEFAULT 0 CHECK (prescription_required IN (0,1)),
  row_version           TEXT    NOT NULL,                       -- per-product change marker (R9); stays in read model (§A1: NOT threaded through the seam)
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

-- Exact SKU lookup, tenant-scoped (FR-9 / P17). NON-unique: per-tenant SKU
-- uniqueness is application-enforced by the future sourcing feature, NOT a SQL
-- constraint (mirrors 005's app-layer Q4 uniqueness). ⚠(D4)
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku_norm
  ON products (tenant_id, sku_norm)
  WHERE active = 1;                                             -- ⚠(D5) partial: only sellable products are lookup-eligible (FR-18)

-- Folded substring name search, tenant-scoped (FR-11/12, R4). A leading-wildcard
-- `contains` is NOT index-served; this narrows the scan set by tenant+active and
-- the column is the prefolded scan target. ⚠(D5)/(D6)
CREATE INDEX IF NOT EXISTS idx_products_tenant_name_fold
  ON products (tenant_id, name_fold)
  WHERE active = 1;

CREATE INDEX IF NOT EXISTS idx_products_tenant_alias_fold
  ON products (tenant_id, alias_fold)
  WHERE active = 1;
```

### 0030 — `product_barcodes`

```sql
CREATE TABLE IF NOT EXISTS product_barcodes (
  barcode_id    TEXT NOT NULL PRIMARY KEY,
  product_id    TEXT NOT NULL,            -- logical FK → products.product_id (NOT SQL-enforced)
  tenant_id     TEXT NOT NULL,            -- denormalized for tenant-scoped index lookups
  barcode       TEXT NOT NULL,            -- raw EAN/GTIN value
  barcode_norm  TEXT NOT NULL,            -- normalized (trim + numeral-fold via normalize.ts) — indexed exact-lookup key (R2/R3)
  barcode_kind  TEXT,                     -- nullable; 'pack' | 'unit' informational
  created_at    TEXT NOT NULL
);

-- Exact barcode lookup, tenant-scoped (R2/R3 / P17). NON-unique by design:
-- one barcode → several rows for ONE product (pack+unit) is normal; one barcode
-- → ≥2 DISTINCT active product_id is the ambiguity block (FR-7), detected via
-- COUNT(DISTINCT product_id) at the repo, NOT prevented by a UNIQUE constraint. ⚠(D4)
CREATE INDEX IF NOT EXISTS idx_product_barcodes_tenant_norm
  ON product_barcodes (tenant_id, barcode_norm);

-- Reverse lookup: all barcodes for a product.
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product
  ON product_barcodes (product_id);
```

---

## 5. FK graph (logical — NOT enforced by SQL)

```
products (1) ───< product_barcodes (1..N)
```

| Edge | Source | Target | Nullable | Enforced |
|:--|:--|:--|:--:|:--:|
| barcode → product | `product_barcodes.product_id` | `products.product_id` | no | **app layer only** (no SQL `FOREIGN KEY`) |

**No FK constraint syntax** — same posture as every migration since
`0004_audit_events.sql`. 009 never writes either table, so referential integrity
is the future sourcing feature's responsibility; 009's repo simply joins
`product_barcodes` → active `products` and treats a dangling barcode as
not-found-for-selling (defensive). Tenant isolation (P17) is enforced at the repo
(`requireCatalogueSession` + every query filters `tenant_id = session.tenant_id`).

---

## 6. Append-only requirement (P4 analysis)

| Table | Append-only? | Trigger pair required? |
|:--|:--:|:--:|
| `products` | **NO** | **NO** |
| `product_barcodes` | **NO** | **NO** |

**Neither table is an audit anchor.** They are **read models** — read-only from
009, **mutable** by the future catalogue-sourcing feature (populate / update /
deactivate). P4 ("append-only audit substrate") does **not** apply: there is no
sensitive-action ledger here, no audit events are emitted by lookups (plan
P4/P10 = N/A-read-only), and 009 writes **zero** rows. Therefore **no
`trg_*_no_update` / `trg_*_no_delete` triggers** (contrast `cart_action_outbox`,
`sales`, `audit_events`). This is a deliberate, data-model-backed departure from
the append-only tables — flagged here so the reviewer confirms it.

**Ships empty.** Both migrations install schema + indexes only and INSERT **zero**
product rows (FR-24 / R-RISK-2: production shows "catalogue unavailable" until a
sourcing feature populates the model).

---

## 7. Open decisions for owner ratification (settle BEFORE T021)

These change the column/index shape, so they need a ruling now:

| # | Decision | Recommendation | Why it matters |
|:--|:--|:--|:--|
| **D1** | Add a normalized **`sku_norm`** column (+ index) mirroring `barcode_norm`, vs match `sku` raw? | **Add `sku_norm`** | FR-9 + Edge "whitespace/casing/numeral form" want normalization-insensitive SKU match; data-model says sku is "Indexed (normalized)". Symmetry with `barcode_norm`. |
| **D2** | Does **`name_fold`** fold `name_en` *into* it (one column, space-joined ar+en), or does English get its own fold column? | **One `name_fold` carrying ar + en folded** | One substring scan covers both scripts (FR-11/12); simplest; data-model says "fold of name_ar (+ name_en folded into a searchable form)". |
| **D3** | **`tax_category`** nullability: `NOT NULL` (sourcing must supply) vs nullable? | **`NOT NULL`** | Carried for the sale line that would need it; a sellable product should always have it. (Nullable if you expect partial sourcing.) |
| **D4** | Per-tenant **SKU uniqueness** + barcode mapping: SQL `UNIQUE` vs application-enforced? | **App-enforced (non-unique indexes)** | Matches 005's Q4 precedent; barcode is *intentionally* non-unique (pack+unit, and the ambiguity case must be detectable, not blocked). |
| **D5** | **Partial indexes** `WHERE active = 1` on the lookup/search indexes? | **Yes** | Lookups/search only consider sellable products (FR-18); smaller, faster indexes. (Reject if you foresee querying inactive products for diagnostics via these paths.) |
| **D6** | **Search mechanism** stays fold-column substring scan (R4), with **FTS5 as the documented fallback** (R-RISK-1) if §A5 bring-up misses NFR-2 (≤150 ms p95 @ 50k)? | **Yes — fold-scan now, FTS5 only on amendment** | FTS5 isn't in the frozen stack; a fold-scan meets the budget per R4. Confirm the fallback trigger is acceptable. |

> Any "no" / change here updates this file (and possibly `data-model.md`) before
> T021 authors the SQL.

---

## 8. Required S2 tests (test-first, Constitution VI)

| Task | File | Purpose |
|:--|:--|:--|
| T020 (RED) | `src/main/migrations/__tests__/0029-products.test.ts` *(or `tests/integration/main/catalogue/migration.test.ts`)* | Migration creates `products` + `product_barcodes` + `*_fold`/`*_norm` columns + the indexes (barcode_norm, sku_norm, name_fold). Mirrors the sql.js + `readFileSync('migrations/0029_*.sql')` init pattern used by the cart/audit durability tests. |
| T022 (RED) | `src/main/catalogue/__tests__/product-repo.barcode.test.ts` | Exact barcode lookup: one match / zero (not_found) / >1 active product (ambiguous via COUNT DISTINCT product_id) / inactive excluded / tenant-scoped. |
| T023 (RED) | `src/main/catalogue/__tests__/product-repo.sku.test.ts` | Exact SKU lookup: one / zero / inactive / tenant-scoped. |
| T026 (RED) | `src/main/catalogue/__tests__/catalogue-unavailable.test.ts` | Empty / missing / unreadable read model → ONE generic `catalogue_unavailable`, **distinct from `not_found`** (SC-10 matrix). |
| T028 | `src/main/catalogue/__tests__/perf.exact.test.ts` | Exact barcode/SKU ≤ 50 ms p95 @ ~50k-row fixture (NFR-1). |
| T029 [P] | `src/main/catalogue/__tests__/redaction.smoke.test.ts` | Cross-process redaction extended to `catalogue.*` payloads — no raw query / PII / credential leak (NFR-7). |
| T030 | `specs/009-…/security-review/s2-review.md` | Bridge-surface security review (line-by-line `catalogue.*` diff) — the §A4-style companion to this §A2 review. |

**Coverage gate:** ≥ 95 % on `catalogue-bridge.ts` and `normalize.ts`; the repo
queries carry the tenant + active guards under test.

---

## 9. S2 implementation checklist (T020–T030 + deferred wiring)

**Migrations (§A2-gated — author after this file is ratified):**

| Task | File | Owner notes |
|:--|:--|:--|
| T021 | `migrations/0029_create_products.sql` | Per §4; money `INTEGER NOT NULL CHECK`; booleans 0/1; **no FK**; **no append-only trigger**; ships empty. |
| T021 | `migrations/0030_create_product_barcodes.sql` | Per §4; non-unique `(tenant_id, barcode_norm)` index; logical FK only; ships empty. |

**Source (T024–T027 + S1a-deferred wiring):**

| Task | File | Notes |
|:--|:--|:--|
| T024 | `src/main/catalogue/product-repo.ts` | Read-only queries: `barcode_norm` + `sku_norm` exact lookup; tenant filter; `active = 1` guard; ambiguity via `COUNT(DISTINCT product_id)`. |
| T025 | `src/main/catalogue/catalogue-bridge.ts` | Replace the S1 `catalogue_unavailable` stub in `lookupBarcode`/`lookupSku` with: normalize → repo → `one`/`not_found`/`ambiguous`/`catalogue_unavailable`. (Sequential edit; `search`/`resolve` stay stubbed until S3/S4.) |
| T027 | `src/main/catalogue/product-repo.ts` | empty/missing/unreadable detection → `catalogue_unavailable` (distinct from not_found; FR-24). |
| **S1a-deferred** | `src/main/index.ts` (composition root) | Instantiate `createCatalogueBridge({ getCurrentSession })` and **register the 4 `catalogue:*` `ipcMain.handle` channels** (`CATALOGUE_IPC_CHANNELS`). This is what makes the dormant preload surface live. |

---

## 10. Security notes

1. **Integer minor units only (P1).** `price_minor INTEGER NOT NULL CHECK (>= 0)`.
   No `REAL`/`NUMERIC`. 009 does **no** money arithmetic — `price_minor` is
   carried verbatim; `Number.isSafeInteger`-guarded on read (data-model invariant 2).
2. **Tenant isolation (P17).** Every repo query filters `tenant_id =
   session.tenant_id`; a tenant-A product never resolves for a tenant-B session.
   Enforced at the bridge/repo (AD-1), not the renderer. The tenant-prefixed
   indexes (§4) are the query path.
3. **Redaction (NFR-7).** `catalogue.*` diagnostics MUST NOT log the raw query,
   PII beyond the permitted snapshot fields, or credential fragments. T029
   extends the cross-process redaction allowlist to `catalogue.*` (append-only to
   the existing list — never shrink it).
4. **No audit emission.** Lookups are not sensitive actions; S2 writes **zero**
   rows and calls **no** `auditEmitter.emit()`. Defensive check at S2 PR:
   `grep auditEmitter src/main/catalogue/*` returns zero hits.
5. **`requireCatalogueSession` stays the first instruction** of every handler;
   the new repo reads follow the gate, never precede it.
6. **No FK enforcement at the SQL layer** → the repo treats a dangling
   `product_id` (barcode with no/inactive product) as not-found-for-selling
   (defensive), never a crash.

---

## 11. Go / no-go recommendation

**Recommend GO — pending the §7 owner decisions (D1–D6).** Once D1–D6 are ruled
on, T021 authors the two migrations to the agreed shape and S2 (T020–T030)
proceeds. The migration order, FK posture (logical-only), append-only analysis
(N/A — read models), test plan, and implementation sequence are unambiguous and
consistent with `data-model.md`, `research.md` (R1–R4, R9), and the
0004/0010/0020 precedents.

§A2 is **not** cleared by this file alone — it clears when the owner ratifies
(with D1–D6 answered), the same way §A0/§A1 were ratified on merge.

---

## 12. Cross-gate status snapshot

| Gate | Status | Blocks |
|:--|:--:|:--|
| §A0 | ✅ RATIFIED 2026-05-30 (PR #318) | (none) |
| §A1 | ✅ RATIFIED 2026-05-30 (seam = `{display_name, unit_price_minor}`, version deferred) | S4 wiring |
| **§A2** | ⏳ **PENDING owner ratification** (this file; recommend GO + D1–D6) | **S2 (T020–T030) + S3** |
| §A5 | ⏳ rollout-time | production readiness |

---

**End of §A2 review package.** Prepared for the owner; not self-cleared. Once
ratified (D1–D6 answered), S2 may begin behind this sign-off, and any later
deviation (changed migration order, a SQL `UNIQUE`/`FOREIGN KEY`, an append-only
trigger on a read model) must return here and update this file before merging.
