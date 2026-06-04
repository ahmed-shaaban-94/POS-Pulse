# §A6 Reconciliation Findings — Backend Catalogue Contract vs 010 Plan

**Feature:** 010-pos-catalog-read-down-consumption
**Gate:** §A6 (backend catalogue-snapshot contract + Constitution V generated types) — the EXTERNAL implementation blocker
**Prepared by:** agent (Claude Code), 2026-06-04 — **findings package for owner + backend coordination; NOT a clearance**
**Authoritative sources read firsthand:** the backend repo `C:\Users\user\Documents\GitHub\Data-Pulse-2` (read-only) + POS-Pulse `src/shared/api-types.ts` + the constitution.
**Constitution version pinned:** v1.5.1

> **Status: §A6 is NOT cleared and CANNOT be cleared by this repo alone.** This doc records what the
> backend's *real* catalogue contract is (verified against backend source), the gaps vs the 010 plan,
> and the open decisions that belong to the **owner** and the **backend team**. It deliberately does NOT
> rewrite spec/plan/data-model/tasks — several gaps could change owner-ratified decisions, so they need a
> decision round first. No code, no migrations, no `api-types.ts` regen here.

---

## 0. Headline: the 010 plan rests on a STALE pinned OpenAPI snapshot

There are **two different, contradictory catalogue contracts**, and the plan was written against the
wrong one:

| | POS-Pulse pinned (`src/shared/api-types.ts`) | Backend repo (authoritative) |
|:--|:--|:--|
| Endpoint | `GET /api/v1/pos/catalog/products` (`api-types.ts:3763`) | `GET /api/pos/v1/catalog/snapshot` + `…/deltas` (`read-down.yaml:86`) |
| Row schema | `CatalogProductEntry` (`drug_code`, `drug_name`, `unit_price`, `is_controlled`, `requires_pharmacist`) (`api-types.ts:7014`) | `SellableCatalogRow` (`product_id`, `sku`, `name`, `aliases[]`, `price{amount,currency_code}`, `tax_category`, `active`, `row_cursor`) (`read-down.yaml:39-50`, `276-319`) |
| Model | single cursor page | **snapshot + delta**, opaque server cursor |

**The backend contract is the authoritative one and it is purpose-built for THIS feature** — its own
header reads: *"Spec 010 POS Catalogue Read-Down Sync contract surface … the platform-side, READ-ONLY
publication of the Resolved Sellable Store Catalogue to device-authenticated POS terminals as snapshot +
delta, scoped to `(tenant_id, store_id)`"* (`read-down.yaml:5-9`, version `1.0.0-draft`). The backend even
has a worktree named `dp-010-contract`. POS's pinned `CatalogProductEntry` endpoint is a **different,
stale** drug-warehouse-shaped endpoint — building against it would implement the wrong contract.

**Implication:** "the generated types already exist, so §A6 is nearly done" is a **trap** — those types
are for the wrong/stale endpoint. **Re-pinning POS to the current backend OpenAPI (`read-down.yaml`) and
regenerating `api-types.ts` IS the core §A6 work.** *(Still unconfirmed: which contract is actually
deployed at `api.smartdatapulse.tech` right now — see §6.)*

---

## 1. The real contract (`SellableCatalogRow`, verified)

Per `read-down.yaml:39-50` and backend DB schema `packages/db/src/schema/catalog/tenant-products.ts`:

```text
SellableCatalogRow {
  product_id   string            // → maps to 009 products.product_id
  sku          string            // → 009 sku
  name         string            // SINGLE language-neutral name (tenant-products.ts:45 `name text NOT NULL`)
  aliases      string[]          // opaque non-sku terms: barcode | plu | supplier_code | external_pos_id
  price        { amount: string, currency_code: string }  // numeric(19,4) + ISO-4217; NEVER a float
  tax_category string
  active       boolean           // always true on the sellable stream
  row_cursor   string            // opaque per-row token
}
```
- **Snapshot + delta:** `posGetCatalogSnapshot` (full sellable set at a consistent cursor) +
  `posGetCatalogDeltas` (`upsert` / `remove_from_sellable` since a cursor; stale cursor →
  `snapshot_required`) (`read-down.yaml:22-29`).
- **Sellable filter:** only active + priced + currency-present + minor-unit-representable rows are emitted
  (`read-down.yaml:31-37`).
- **Pharmacy-domain fields explicitly NOT in v1:** *"`name_ar`/`name_en`, `controlled_substance`,
  `prescription_required`, `unit_pack_label` are NOT in the v1 payload — they have no backing 003 column
  (re-adding any is a future spec that first adds the column)"* (`read-down.yaml:43-45`).

---

## 2. The four material gaps (each with who-decides)

### GAP-1 — Price is major-unit decimal + currency, not integer minor units **(POS-side; settle now)**
- **Fact:** `price { amount: "9.99", currency_code: "EGP" }`; at rest `numeric("default_price",{precision:19,scale:4})` + `char("default_currency_code",{length:3})` (`tenant-products.ts:51-52`). Explicitly *"NEVER a float"* on the wire (`read-down.yaml:46-48`).
- **009 needs:** `price_minor` INTEGER minor units (`Number.isSafeInteger`-guarded; Constitution II/P1).
- **Resolution (POS-side, no backend dependency):** at the ingest **validation boundary**, parse the
  decimal **string** and convert to integer minor units by the currency's minor-unit exponent
  (EGP→2, USD→2, JPY→0, KWD/BHD→3; default 2). Parse string→integer directly (e.g. scale the decimal
  by 10^exponent with integer/string math); **never** go through a JS float, and reject non-representable
  amounts as malformed (FR-9). This is the one gap robust across both contracts — it is a real plan change
  (010's data-model assumed `price_minor` arrives ready-made) but it is **POS-owned**.

### GAP-2 — No barcode on the row; data EXISTS but is projected opaquely **(BACKEND decision)**
- **Fact:** `SellableCatalogRow` has no barcode field; `aliases[]` carries *"non-sku
  barcode/plu/supplier_code/external_pos_id"* as **opaque strings, type not exposed** (`read-down.yaml:39-50`).
- **But the data exists, typed and indexed,** in the backend: `product_aliases.identifier_type IN
  ('barcode','sku','plu','supplier_code','external_pos_id')` (`product-aliases.ts:57`), with a lookup
  index `idx_product_aliases_lookup (tenant_id, identifier_type, value)` (`product-aliases.ts:84`).
- **Why it's the most consequential gap:** 009's **barcode scan is the PRIMARY till modality**, backed by
  the `product_barcodes` table. With only an opaque `aliases[]`, POS cannot reliably build a
  barcode→product mapping (it can't tell a barcode from a PLU or supplier code).
- **Decision (backend-owned):** does the backend (a) add a typed barcode projection to the snapshot row
  (e.g. `barcodes: [{value}]` or `aliases:[{type,value}]`), (b) expose a dedicated barcode endpoint, or
  (c) declare `aliases[]`-untyped acceptable and POS treats all aliases as candidate barcodes (degrades
  the ambiguity guarantee FR-7)? **This is the top product question.** The data is there; it's a
  projection choice.

### GAP-3 — Single `name`, no Arabic/English split **(BACKEND vs POS mapping decision)**
- **Fact:** one `name text NOT NULL` (`tenant-products.ts:45`); backend explicitly defers `name_ar`/`name_en`
  to a future spec that first adds the column (`read-down.yaml:43-45`).
- **009 needs:** `name_ar` **NOT NULL** (Arabic-first display), `name_en` optional, both folded into search.
- **Decision:** (a) backend adds `name_ar`/`name_en` columns + payload fields (a backend spec, per their
  own note), OR (b) POS maps the single `name` → `name_ar` (treat it as the display name regardless of
  script) and leaves `name_en` null, accepting that 009's English-name search recall (SC-9) degrades to
  whatever `name` contains. (b) is shippable now; (a) is the correct long-term fix. **Owner picks the MVP
  posture.**

### GAP-4 — Auth is Clerk JWT (`pos_operator`), which may unwind the no-session trigger **(HIGHEST — owner + backend)**
- **Fact:** the endpoint is `security: [clerkJwt]` (`read-down.yaml:91-92`); the device principal's
  resolved `(tenant_id, store_id)` from the token supplies scope (`read-down.yaml:13-20`). **No
  `X-Terminal-Token` header** in the contract.
- **The conflict (two layers):**
  1. **vs the constitution:** Platform Integration §Auth (`constitution.md:955-960`) mandates *both*
     `Authorization` (JWT) **and** `X-Terminal-Token` on every backend request. The backend contract
     shows JWT only. This is a **spec-vs-reality conflict to RECORD** — do NOT silently re-flip the
     earlier `X-Terminal-Token` remediation (it was correct per POS's authoritative constitution). Flag
     it for the constitution-owner + backend to reconcile.
  2. **vs the owner-ratified trigger decision (the load-bearing one):** 010's clarify locked
     **Q-RD-TRIGGER = paired-terminal background read-down, NOT operator-session-gated** (Constitution
     VIII "unattended terminal MAY perform background sync"). But if the endpoint **requires a
     `pos_operator` JWT**, a signed-out terminal has no JWT → **a no-session background read-down may be
     impossible**, which would **unwind an owner-ratified clarify decision**, not just a doc line.
- **Decision (owner + backend):** (a) does the snapshot endpoint accept a device/terminal credential
  (X-Terminal-Token or a device-scoped token) without an operator JWT? (b) if JWT-only, must 010's trigger
  model change to "read-down runs only while an operator is signed in" (re-clarify Q-RD-TRIGGER)? **This is
  the top blocker — it can change the feature's shape.**

---

## 3. Other contract deltas (lower severity, plan churn when reconciled)

- **Cursor pagination, not single-GET.** The plan's R3 "full-snapshot replace via one GET" must become
  "page through all snapshot pages (`next_page_token`) into staging, then promote" — full-replace is still
  achievable, but the fetch is multi-request. Deltas (`posGetCatalogDeltas`) are an available *future*
  optimization the plan deferred — and the backend already built them.
- **`store_id` (wire `branch_id`) scoping is first-class** (`read-down.yaml:9,17-20`) — 010's "tenant-scoped,
  branch deferred" (R-RISK-5) should become branch-aware; the backend resolves store from the token and
  validates an optional `branch_id` non-disclosingly.
- **`remove_from_sellable` + `snapshot_required`** are real backend states the delta model needs handling
  for (only relevant if/when 010 adopts deltas; full-snapshot-replace MVP can ignore deltas).
- **No `controlled_substance` / `prescription_required` in v1** (`read-down.yaml:43-45`) — 009 surfaces
  these flags (read-only, awareness). They'll be null/absent until a backend spec adds them; acceptable
  (009 only *surfaces*, never enforces) but note the display degrades.

---

## 4. What §A6 clearance actually requires (revised)

1. **Owner + backend resolve GAP-4 (auth/trigger)** — the shape-changing one.
2. **Backend resolves GAP-2 (barcode projection)** — the primary-modality blocker.
3. **Owner picks GAP-3 MVP posture** (map `name`→`name_ar` now vs wait for bilingual columns).
4. **POS implements GAP-1** (decimal→minor-unit conversion at ingest) — no backend dependency.
5. **Re-pin POS to the current backend OpenAPI** (`read-down.yaml`) and regenerate
   `src/shared/api-types.ts` (`npm run codegen:api`) — this is codegen-owned scope and the concrete §A6
   artifact. Confirm which contract is deployed first (§6).

Only after 1–3 are decided can the 010 spec/plan/data-model/tasks be revised to the real contract
(a `/speckit-plan` re-run, not a doc patch — the changes touch owner-ratified decisions).

---

## 5. Impact on §A2 (migration safety)

**§A2 is NOT cleanly clearable yet either, but for a different reason.** The staging-table *schema*
(`products_staging`/`product_barcodes_staging`/`catalogue_sync_state`) mirrors 009's already-shipped
tables and is stable to author — BUT the **ingest mapping that fills those tables is now open** (price
conversion, barcode source, name mapping). A §A2 package can be **drafted** for table + promote-transaction
safety, but it should be marked **source-mapping-pending** and not ratified until GAP-1/2/3 are decided —
otherwise the migration locks in columns (e.g. `name_ar` NOT NULL, `product_barcodes` rows) that the
backend v1 cannot currently populate.

---

## 6. The one fact still unconfirmed (top open question)

**Which contract is actually deployed at `api.smartdatapulse.tech` today?** The backend repo shows
`SellableCatalogRow` (`1.0.0-draft`); POS's pinned snapshot shows `CatalogProductEntry`. Neither repo
proves what is live. Confirm against the deployed OpenAPI (or with the backend team) before re-pinning —
re-pinning to a draft that isn't deployed would re-introduce drift in the other direction.

---

## 7. Recommendation

- **Neither §A6 nor §A2 can be cleared today** — both depend on owner + backend decisions captured above.
  This is honest progress (the questions are now precise and evidence-backed), not a clearance.
- **Hand GAP-2 / GAP-4 (+ the §6 deployment question) to the backend team**; **GAP-1 / GAP-3 MVP posture
  to the owner.**
- **Do NOT** rewrite the 010 artifacts or re-flip the `X-Terminal-Token` remediation until the decisions
  land — then re-run `/speckit-plan` against the confirmed contract.
- A §A2 table-safety package MAY be drafted in parallel, marked source-mapping-pending.

---

**End of §A6 reconciliation findings.** Prepared from firsthand reads of `Data-Pulse-2` + POS pinned
types + the constitution; not self-cleared. The gates remain open pending the decision round.
