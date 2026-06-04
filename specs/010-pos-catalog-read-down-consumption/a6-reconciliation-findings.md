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

---

## ADDENDUM — 2026-06-04 (second pass): backend has its OWN spec 010, and the auth gap is WORSE, not resolved

A deeper read of the backend repo found that Data-Pulse-2 carries a **full sibling feature**
`specs/010-pos-catalog-read-down-sync/` (spec + plan + tasks + research + contracts + wave-status +
execution-map). It is the platform half of this exact contract — `Consumed by: POS-Pulse
010-terminal-catalogue-read-sync (separate repository)` (`backend spec.md:10`). This is the
authoritative resolution of the four gaps. It **confirms three gaps and CORRECTS the fourth — in the
unfavourable direction.** The earlier-recorded "may unwind the owner-ratified no-session trigger" was
right to flag GAP-4; this pass proves it.

### GAP-1 (money) — CONFIRMED CLEAR
Backend `read-down.yaml:245-271` + spec FR-051 + `tenant_products.ts:51,69-76`: `numeric(19,4)`
exact-decimal string + ISO-4217 `currency_code`, **single currency per `(tenant,store)` for v1** (EGP),
emitted at natural minor precision, never float. **POS action:** convert decimal→integer minor units at
ingest (×10^exponent). No backend dependency. Unchanged from §3 above.

### GAP-3 (name ar/en) — CONFIRMED DEFERRED (owner MVP call)
Backend spec **Clarification 2026-06-03** is explicit and *intentional*: FR-050 was revised **down to the
real schema** — `name_ar`/`name_en` (and `controlled_substance`/`prescription_required`/`unit_pack_label`)
are **removed from the v1 payload** because they have no backing 003 column. Single
`tenant_products.name`. *"Re-adding any of these is a future spec that first adds the column to the Tenant
Catalog (003)."* There is **no tracked issue** to add it — it is gated behind a future 003 schema spec.
**Owner decision:** accept v1 with a single `name` mapped into both 009 `name_ar`/`name_en` fold inputs
(009 search still works; Arabic-specific display is simply unavailable until the future spec). This is an
acceptable MVP cut, but it is the owner's to ratify.

### GAP-2 (barcode typing) — CONFIRMED ABSENT and DELIBERATE → the clean hard blocker
Backend **FR-052**: *"The platform MUST supply raw name/alias fields; it MUST NOT compute search
folding/normalization (the consumer owns that)."* `SellableCatalogRow.aliases` is a bare `string[]` with
**no type discriminator** (`read-down.yaml:297-303`) — barcode/plu/supplier_code/external_pos_id are
lumped opaque; only `sku` is typed (its own top-level field). The backend HAS the type internally
(`product_aliases.identifier_type`, indexed `:84`) and even accepts it typed on the capture-UP path
(`unknown-items.yaml`), but **deliberately does not re-emit it** on read-down. There is **no backend plan,
issue, or decision** to expose alias type to POS.
**Impact:** 009's **primary modality is barcode scan**. With untyped aliases, POS cannot distinguish a
barcode from a supplier code — it can only match a scanned code against the *whole* `aliases[]` bag. For
exact barcode lookup that is functionally adequate (a scan either matches an alias value or it doesn't),
but it is **lossy** vs 009's typed `product_barcodes` model, and it precludes any barcode-specific
behaviour (validation, barcode-vs-SKU disambiguation, barcode-type display).
**This is the firmest gap — backend won't budge without a contract revision.** Decision is **POS-side**:
accept "match scanned code against the untyped alias bag" for v1 (recommended — unblocks barcode scan
now), OR file a backend contract-revision request to add a typed-alias projection (`{type,value}` objects)
and wait. Recommend the former for v1, with the revision request filed as a known limitation.

### GAP-4 (terminal auth) — CORRECTED: the no-operator-session background trigger is REJECTED by the backend as-built. LOAD-BEARING BLOCKER.

The previous record said GAP-4 was "the biggest open gap" and *"may unwind"* the owner-ratified no-session
trigger. **Firsthand guard reads now confirm it does — this is not a wire-format detail, it is an
architectural conflict.** Three layers of evidence, ground-truth last:

1. **Backend contract prose is internally CONTRADICTORY** (do not trust it alone):
   - Published `read-down.yaml:91,174-185` → `clerkJwt` security scheme, *"Clerk JWT … **paired with** the
     platform device-token header."* (reads as JWT **required**)
   - Backend `contracts/README.md:28` → *"device-principal … **NOT** the manager Clerk-JWT scheme. A
     dedicated `posDeviceAuth` security scheme."* + `quickstart.md:9` → `Authorization: <device token>`
     (reads as device-token **only**)
   - These do not reconcile. Picking the device-only branch because it clears our blocker is exactly the
     confirmation-bias trap that bit this feature three times (body-attestation → X-Terminal-Token →
     JWT). So we read the implementation.

2. **The guard is the discriminator** (`wave-status.md:18`: read-down *"reuses unchanged the POS
   device-principal auth seam `PosOperatorAuthGuard`"*):
   - `apps/api/src/auth/auth.guard.ts:127-144,162-171` — authentication is a **single opaque bearer token
     in `Authorization: Bearer <raw-token>`**, looked up in `auth_tokens`. **There is NO Clerk-JWT
     verification, NO `X-Terminal-Token` header, NO `X-Device-Token` header anywhere in the guard.** The
     YAML's "Clerk JWT" prose is inherited/aspirational; the as-built credential is an opaque DB token.
   - `apps/api/src/auth/pos-operator-auth.guard.ts:42` — requires `principal.scope === "pos_operator"`,
     and **explicitly rejects the plain `"pos"` (device/service) scope** (`:13`).
   - The `pos_operator` scope row is created **only at operator sign-in** — decision-log
     `0001-…wave1.md:134-161` (D8): it is *"derived from a verified Clerk JWT, the mapped local user, the
     validated device token, and the resolved tenant + store."*

3. **Therefore:** a request bearing the **device token alone, with no live operator session**, is
   **rejected** by `PosOperatorAuthGuard`. POS-Pulse 010's entire trigger model — *paired-terminal
   background read-down, NOT operator-session-gated* (Constitution VIII, owner-ratified Q-RD-TRIGGER) —
   **cannot authenticate against the backend as it is built today.**

   This also collides with **POS constitution `constitution.md:955-960`** which mandates an
   **`X-Terminal-Token` header** on every backend call (the device token), separate from `Authorization`.
   The backend implements neither that header nor a device-only scope on POS routes.

   **This is the load-bearing §A6 blocker.** It is NOT a "header-name detail." Two distinct decisions,
   both for the BACKEND TEAM (with owner ratification on the POS trigger model):
   - **D-AUTH-1 (required):** Will the backend expose the read-down snapshot/delta to a **device-principal
     token (no operator session)** — i.e. accept the `"pos"`-scope (or a new `posDeviceAuth`) on these two
     routes, as the backend's own spec FR-001/README/quickstart say it should — and **align the published
     `read-down.yaml` away from `clerkJwt` to match**? If **no**, POS's background read-down must run
     **inside an operator session** (re-opening owner-ratified Q-RD-TRIGGER + Constitution VIII) — a real
     scope change.
   - **D-AUTH-2 (required):** The credential **transport** — backend reads `Authorization: Bearer <token>`;
     POS constitution mandates `X-Terminal-Token`. One side must move. Cheapest: POS sends the device token
     as `Authorization: Bearer <device_token>` for this surface (a documented per-surface exception), OR the
     backend guard also reads `X-Terminal-Token`. Backend+owner call.

   **POS must NOT build device-token-only auth (either header) until D-AUTH-1 is confirmed** — the deployed
   endpoint would reject it. (Re-pinning the contract and regen-ing types is downstream of this.)

### Net effect on the gates
- **§A6 still NOT cleared** — and GAP-4 is now a *confirmed* blocker, not a "may." The decision round is
  the same owner+backend round, but the auth item is sharper and more load-bearing than recorded.
- **§A2 still held source-mapping-pending** — GAP-3's single-`name` mapping and GAP-2's untyped-alias bag
  both change the staging-table column shape (e.g. whether `product_barcodes_staging` is typed), so the
  table-safety package still can't finalize column definitions until D-NAME / D-BARCODE land.
- **Backend deployment question (§6) unchanged** — still must confirm what is live at
  `api.smartdatapulse.tech` before re-pinning.

### Decision round — concise hand-off
| ID | Gap | Owner | Decision | Recommendation |
|:--|:--|:--|:--|:--|
| D-AUTH-1 | GAP-4 | **Backend** (+owner ratify) | Device-principal (no-session) token accepted on read-down routes? Align YAML off `clerkJwt`? | **Yes** — matches backend's own spec FR-001; unblocks POS's ratified background trigger |
| D-AUTH-2 | GAP-4 | **Backend**+owner | Credential transport: `Authorization: Bearer` vs `X-Terminal-Token` | POS sends device token as `Authorization: Bearer` on this surface (documented exception) |
| D-BARCODE | GAP-2 | **POS**/owner | Accept untyped `aliases[]` bag for barcode match, or request typed-alias contract revision | Accept bag for v1; file revision request as known limitation |
| D-NAME | GAP-3 | **Owner** | Accept single `name` (no Arabic split) for v1 | Accept; map `name` into both 009 fold inputs |
| D-DEPLOY | §6 | **Backend** | Confirm deployed contract version at `api.smartdatapulse.tech` | Confirm before re-pinning `api-types.ts` |

Once D-AUTH-1/2 + D-DEPLOY land: re-pin OpenAPI → `npm run codegen:api` → re-run `/speckit-plan` against
the confirmed contract → lift §A2 hold with finalized column shapes → implement.

**End of 2026-06-04 second-pass addendum.** All claims above are firsthand reads of `Data-Pulse-2` source
(guard implementation = ground truth, not contract prose). GAP-4 corrected against my own earlier
optimistic draft per advisor review; not self-cleared.
