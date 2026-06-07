# POS-Pulse — ERPNext POS Reference Scout & Full Development Report

_Read-only scout (no code edits/commits). Generated 2026-06-07. Repos verified: POS-Pulse, Data-Pulse-2, Retail-Tower-ERP-Next-Connector, Retail-Tower-Orchestrator + ERPNext 15.110.0 staging bench (read-only)._

---

## Section 0: How to read this report

This report has two parts:

- **(A) Recommended next action — executed in depth:** the POS-010 read-down reconciliation (test-first plan).
- **(B) Full multi-family POS development roadmap (011–015).**

**Architecture invariant (repeated throughout):** POS-Pulse never calls ERPNext directly. It consumes Data-Pulse-2 (DP2) contracts only. DP2 is the sole contract/orchestration boundary. Retail-Tower-ERP-Next-Connector is the only ERPNext speaker. ERPNext POS is reference only.

---

## Part A: POS-010 Read-Down Reconciliation (the recommended next action, executed)

### A1. The core finding

POS-Pulse `CLAUDE.md` frames issue #349 as a "re-pin" of a stale catalog shape. It is actually a **CONTRACT RESHAPE plus a DOMAIN CORRECTION**, not a refresh.

**The code is still pinned to a stale pharmacy-era shape.**

- `src/shared/api-types.ts:3763` defines `"/api/v1/pos/catalog/products"` ("Paginated product catalog for offline sync", ordered by `drug_code`, `next_cursor` pagination).
- `src/shared/api-types.ts:3787` defines `"/api/v1/pos/catalog/stock"` (paginated active-batch stock from `stg_batches`).

This is the wrong **domain** entirely (pharmacy `drug_code`/batches/controlled-substance verify), not just a stale retail shape.

**The shipped, authoritative DP2 contract** is `Data-Pulse-2/packages/contracts/openapi/catalog/read-down.yaml` (version `"1.0.0-draft"`), with two POS-facing GET ops under `/api/pos/v1/catalog/...`:

| Operation | Method + Path | Key behavior |
|:--|:--|:--|
| `posGetCatalogSnapshot` | `GET /api/pos/v1/catalog/snapshot` (read-down.yaml:88-89) | Full Resolved Sellable Store Catalogue at a server-issued opaque cursor, cursor-paginated via `next_page_token`; every page reflects ONE consistent cursor point (FR-012) |
| `posGetCatalogDeltas` | `GET /api/pos/v1/catalog/deltas` (read-down.yaml:130-131) | Ordered idempotent `upsert`/`remove_from_sellable` changes after an opaque `since` cursor; stale/unservable cursor → `snapshot_required` (409) (FR-023) |

**`SellableCatalogRow` schema** (read-down.yaml:291) required fields: `[product_id, sku, name, aliases, price, tax_category, active, row_cursor]`. `name` is a single language-neutral field (no `ar`/`en` split). `price` is `{ amount: <exact-decimal-string>, currency_code }` — **never a float**. Sellable filter = active AND priced AND currency present AND representable in currency minor unit.

**Auth:** device-token Bearer (`Authorization: Bearer <device_token>`, `PosDeviceAuthGuard`) — NOT `X-Terminal-Token`, NOT operator JWT. (The contract's security-scheme key is still named `clerkJwt` for cross-contract consistency, but its description overrides: the credential is the opaque device pairing token.)

---

### A2. What POS-Pulse has already built (merged) — narrower remaining work than "re-pin" implies

The offline correctness core is merged and the mapper already mirrors the shipped `SellableCatalogRow` as a local structural type, so reconciliation is narrower than a rewrite.

Evidence (all in POS-Pulse):

- **`src/main/catalogue/read-down/map-sellable-row.ts`** — `mapSellableRow()`: maps the shipped `SellableCatalogRow` → internal `{product, barcodes[]}`. Three owner-ratified GAP mappings:
  - **GAP-1 money:** `price{amount,currency_code}` → integer `price_minor` via exact decimal-string→minor-units, never a float, rejects non-representable per FR-9.
  - **D-NAME:** single `name` → `name_ar:=name`, `name_en:=null`.
  - **D-BARCODE:** each untyped `aliases[]` entry → one barcode record; `sku` is NOT a barcode.
  - Defaults for fields not in backend v1: `controlled_substance:0`, `prescription_required:0`, `unit_pack_label:null`; `row_version/created_at/updated_at := row_cursor` (no backend timestamps in v1).

- **`src/main/catalogue/read-down/read-down-writer.ts`** — stage-and-promote in ONE `better-sqlite3` transaction: clears staging → validates → stages → promote does `DELETE FROM products/product_barcodes WHERE tenant_id=?` + `INSERT…SELECT` from staging; freshness written INSIDE the tx (SC-10). Tenant-scoped throughout (P17). Outcomes: `succeeded | skipped_with_rejections | failed`. Failure categories: `no-store-scope | threshold-exceeded | db-error`. Has `recordFetchFailure()` for transport faults.

- **`src/main/catalogue/read-down/read-down-driver.ts`** — orchestrates one tick: fetch (injected `ReadDownClient`) → on `ok` hand rows to writer; on transport failure call `writer.recordFetchFailure()` and do NOT touch the writer (preserves working catalogue, SC-5/FR-7). Async single-flight (FR-12/FR-14): `runTickOnce()` returns synchronously `{kind:'started',completed}` or `{kind:'already_running'}`. Background `setInterval` (Constitution VIII — paired-terminal background, NOT session-gated), bounded [1s, 24h]. Scope (`tenantId`/`branchId`) + clock injected from `pairingStore` at composition root.

- **`src/main/catalogue/read-down/read-down-client-types.ts`** — `ReadDownClient` INTERFACE (the DI seam): `fetchSnapshot(): Promise<ReadDownFetchResult>` where result is `ok{sourceSnapshotId,rows} | no_connection | failed`. NEVER rejects; raw response body NEVER surfaced on failure (P7/NFR-3). Device token attached main-process-side.

**Also merged:** `catalogue-sync-state-repo.ts`, `catalogue-bridge.ts`, `src/main/ipc/catalogue.ts` (catalogue IPC surface wired live), `src/preload/catalogue.ts`, `src/renderer/ui/catalogue/CatalogueFreshness.tsx` (three truthful states, absolute timestamp). Full suite ~5009 tests green.

---

### A3. What remains (all #349-gated or hardware) — the reconciliation work list

| Task | What | Blocker |
|:--|:--|:--|
| T002 | Re-pin `src/shared/api-types.ts` from the deployed contract (replace the pharmacy `/api/v1/pos/catalog/products`+`/stock` shapes with the `/api/pos/v1/catalog/snapshot`+`/deltas` `SellableCatalogRow` shape). MUST be codegen (`npm run codegen:api`), NOT hand-edited. | #349 D-DEPLOY — backend must serve the deployed contract at `/openapi.json` |
| T020/T021 | Implement the concrete `createReadDownClient` (the HTTP client) implementing the existing `ReadDownClient` interface unchanged; attach `Authorization: Bearer <device_token>` main-process-side; map transport faults → `no_connection`/`failed`, never reject. | #349 (consumes the re-pinned api-types) |
| T039 | Composition-root driver wiring: read scope from `pairingStore`, inject real client + writer + clock, install the interval; final §A4 `refresh` security re-check; design the post-commit freshness-refresh mechanism (Codex-flagged) against real driver timing, respecting the owner no-poll constraint. | #349 |
| T054 | §A5 perf bring-up incl. concurrent-lookup-during-promote on target hardware. | target hardware |

> **Note:** the deploy is currently DOWN — edge `api.smartdatapulse.tech` returned HTTP 521 at last probe (per Retail-Tower-Orchestrator status). So live-fetch cannot be exercised yet; `catalogue:refresh` is registered but refuses until the driver lands; freshness reads "not yet downloaded" in prod.

---

### A4. Test-first reconciliation plan (the recommended action, when unblocked)

Per Constitution test-first rule, ordered:

1. **RED:** Add a contract-conformance test asserting the generated `api-types.ts` exposes `GET /api/pos/v1/catalog/snapshot` returning a `SellableCatalogRow` page with `next_page_token`, and `/deltas` with `since` + `snapshot_required` (409). It fails against the current pharmacy pin.
2. **Re-pin** via `npm run codegen:api` against the deployed `/openapi.json`; `npm run codegen:verify` (regen→diff) green. The local `SellableCatalogRow` mirror in `map-sellable-row.ts` is then replaced by the generated type (mapper logic unchanged — it already matches).
3. **RED→GREEN:** Client tests for `createReadDownClient` — `ok` (valid snapshot page → rows), `no_connection` (unreachable), `failed` (non-2xx/malformed), body-never-surfaced (P7). Implement T021 to pass.
4. **Wire T039** at composition root behind the existing interface; driver/freshness tests already exist and stay green. Add the post-commit freshness-refresh + final §A4 refresh security re-check.
5. **T054** perf on target hardware (deferred).

> Deltas (`posGetCatalogDeltas`) are an available FUTURE leg — v1 can fetch the full snapshot each tick; wire deltas later (a6-reconciliation-findings.md:132).

---

## Part B: Full POS Development Roadmap (011–015)

### B1. Architecture truth (verified, with three-state readiness)

The canonical sale round-trip (Retail-Tower-Orchestrator/docs/architecture/synchronization.md:72-86):

> Read-DOWN (catalog to edge) → Capture-UP: `POS → DP2: finalized sale (idempotent, outbox)` → `DP2 → Connector: posting feed (pull, cursor)` → `Connector → ERPNext: create posting/fiscal doc` → outcome → `Connector → DP2: ack (Idempotency-Key)`

DP2 is the ONLY boundary (README.md:45-57). Connector posts ONLY a submitted Sales Invoice today (interim outstanding-AR; no Payment Entry, no tax applied, reversal fail-closed).

**THREE-STATE readiness caution:** a contract can have YAML + implementation on `main` yet NOT be deployed. DP-015 sale-posting is functionally complete but NOT deployed (gate G9/D-DEPLOY; edge HTTP 521). So "exists" ≠ "live".

---

### B2. POS-Pulse current capability (shipped features)

| Feature | Spec | Status |
|:--|:--|:--|
| Foundation | 001 | Complete |
| Terminal pairing | 002 | Complete — device token, branch scope |
| POS UI shell | 003 | Complete — design tokens, navigation, role-indicator slot |
| Operator session | 004 | Complete — §A1 + §A2 gates cleared |
| Sales cart | 005 | Complete through S4-b handoff core — owns the `resolveItemRef` seam 009 wires into; no payments/money/receipts |
| Payments/tender | 006 | Complete — cash + external-card-record-only + internal-voucher, split tender, cash-only change; §A5 signed off |
| POS visual system | 007 | Complete — all six slices (S0–S6) merged |
| Sale finalization & receipts | 008 | Complete (dev-MVP only) — durable Sale, receipt payload Arabic-first/RTL, print/reprint, cash-drawer kick, outbox staged WITHOUT sync engine; `total_tax_minor` hardcoded 0 (fiscal deferred to 008-v2) |
| Product search & barcode lookup | 009 | Complete — offline SQLite read model; §A5 signed off |
| Catalog read-down | 010 | In progress — see Part A |

---

### B3. Roadmap families — ordered by contract readiness (NOT by suggested numbering)

> **Important:** the prompt's suggested numbering (012=VAT, 013=inventory) diverges from orchestrator program-order (Sales→Inventory→VAT→Returns+Shifts, program-workflow-catalog.md). Ordered by contract readiness below.

| Order | Family | Rationale | Readiness / blocker |
|:--|:--|:--|:--|
| Now | **Finish POS-010** read-down | Active; reconcile code to shipped snapshot+delta | Reshape specced; gated on #349 deploy |
| 1 | **POS-011** sale-sync (capture-UP) | Highest leverage — DP2 `captureSale POST /api/pos/v1/sales` exists + implemented; 008 already stages the outbox | Gotchas: operator-session auth (NOT device token); NO tender fields in capture (gated to DP payments); backend not deployed |
| 2 | **POS-013** inventory awareness (read-only) | Orchestrator puts inventory (W3/P4) ahead of VAT | BLOCKED — no POS-facing stock contract (DP2 `inventory.yaml` is cookieAuth/dashboard; spec 019 ERPNext stock view is connector→DP2); needs a new DP2 device-token stock-read contract first |
| 3 | **POS-012** VAT/fiscal receipt | Unblocks customer-facing use (008 is dev-MVP only) | BLOCKED on gate G6 (fiscal model); Connector currently drops `taxAmount` |
| 4 | **POS-014** returns/refunds/voids | DP2 `recordVoid`/`recordRefund` exist; consumes POS-011 runtime | Connector `reversal` fail-closed; needs the W2 sale-posting runtime live first |
| 5 | **POS-015** shift open/close + cash mgmt | Mirrors ERPNext POS Opening/Closing Entry | BLOCKED — DP2 has only `/shifts/stuck` discovery; needs a new shift-lifecycle contract |

---

### B4. Data-Pulse contract implications (three-state)

| POS behavior | DP2 contract/API | Contract? | Impl on main? | Deployed? | Note |
|:--|:--|:--|:--|:--|:--|
| Catalog read-down | `catalog/read-down.yaml` — `/api/pos/v1/catalog/snapshot`+`/deltas` | yes | yes | NO (521; #349) | device-token auth |
| Sale capture | `pos-sales/sales.yaml` — `captureSale POST /api/pos/v1/sales` | yes | yes | NO | dedup `(tenant,sourceSystem,externalId)`; `Idempotency-Key` required; NO tender fields; operator-session auth |
| Returns/voids | `pos-sales/sales.yaml` — `recordVoid`/`recordRefund` | yes | yes | NO | append-only terminal events, no tender |
| Tender on sale | (none) | NO | NO | NO | gated to DP POS-payments |
| Vouchers | `pos-payments/vouchers.yaml` | yes (contract) | NO (no module) | NO | contract-only, unimplemented |
| Shift open/close + cash | `pos-shifts.openapi.yaml` — only `/shifts/stuck` | partial | discovery only | NO | full lifecycle MISSING |
| VAT/fiscal | (none) | NO | NO | NO | only passive tax fields carried |
| Stock visibility (POS) | (none — `inventory.yaml` is cookieAuth) | NO for POS | n/a | n/a | needs new device-token contract |
| Terminal pairing | `pos-terminal-pairing.openapi.yaml` | yes | device-auth side yes | (needs verification) | unauthenticated bootstrap → device token |

**AUTH DIVERGENCE (load-bearing for POS-011):** read-down uses device token (`PosDeviceAuthGuard`); sale capture/void/refund require an operator session (`PosOperatorAuthGuard`). POS-011's sync engine must present operator credentials, not just the device pairing token. (DP2 `read-down.controller.ts:65` vs `sales.controller.ts:76`.)

---

### B5. ERPNext POS behavior reference (bench-verified, ERPNext 15.110.0) — REFERENCE ONLY

> **Scope:** Verified read-only by reading DocType JSON on the `retail.localhost` staging bench (Frappe + ERPNext 15.110.0, Connector app co-installed). DocType JSON is the authoritative field schema (Link fields name their target in `options`). NO documents created/saved/submitted; no DB query; no settings/migrate. Confirmed:

- **POS Profile** (`pos_profile.json`): `payments::Table->POS Payment Method`, `warehouse->Warehouse`, `customer->Customer`, `selling_price_list->Price List`, `write_off_account`, `account_for_change_amount`, `income_account`, `cost_center`, `company`, `applicable_for_users->POS Profile User`, `allow_partial_payment`.

- **POS Opening Entry** (`pos_opening_entry.json`): declared float per-user per-shift — `pos_profile`, `user`, `balance_details::Table->POS Opening Entry Detail`, `status:: Draft/Open/Closed/Cancelled`, links its `pos_closing_entry`.

- **POS Closing Entry** (`pos_closing_entry.json`): cash count + expected-vs-actual variance — `payment_reconciliation::Table->POS Closing Entry Detail` (per-mode opening/expected/closing/difference), `pos_opening_entry` link, `grand_total`, `net_total`, `taxes`.

- **POS Invoice** (`pos_invoice.json`): `is_pos`, `is_return`, `return_against->POS Invoice` (returns = negative-qty credit note against original), `payments::Table->Sales Invoice Payment` (split tender = multiple rows), `paid_amount`, `change_amount`, `account_for_change_amount`, `outstanding_amount`, loyalty fields (`loyalty_program`/`loyalty_points`/`redeem_loyalty_points`), `status:: Draft/Return/Credit Note Issued/Consolidated/Submitted/Paid`.

- **Consolidation:** DocType `pos_invoice_merge_log` present — engine that consolidates many POS Invoices → one Sales Invoice at shift close; status transitions to `Consolidated`.

**RETAIL-TOWER DECISION (separate from the above reference):** POS-Pulse MIRRORS the cashier loop shape (opening float → cart → tender → finalize+receipt → shift close w/ variance) but ADAPTS consolidation to be server-side (DP2→Connector), never on the terminal; the terminal emits an idempotent sale FACT to its outbox only.

---

### B6. Explicit non-goals (must NOT copy/integrate from ERPNext POS)

1. No direct POS-Pulse→ERPNext call ever.
2. No copying ERPNext core code.
3. No on-terminal POS-Invoice→Sales-Invoice consolidation.
4. No ERPNext Payment Entry / GL posting on the terminal.
5. No ERPNext stock-ledger mutation from POS (POS is never stock authority; ADR-0001: ERPNext Item = accounting identity only).
6. No ERPNext tax engine on the terminal (VAT gated G6; Connector drops `taxAmount` today).
7. No ERPNext POS Profile as terminal config authority (binding comes from DP2 pairing).
8. No ERPNext item-master lookup / FEFO batch-pick on the terminal (items pre-resolved upstream; Connector applies a pre-resolved `erpnextItemRef`, never searches).
9. No `X-Terminal-Token` auth assumption (backend has no such seam; device-pairing-token Bearer).
10. No loyalty / multi-company / cost-center modeling in v1.

---

### B7. WSL staging verification notes

**Environment:** WSL2 Ubuntu → `devcontainer-frappe-1` container (frappe_docker dev-container), bench `/workspace/development/frappe-bench`, site `retail.localhost`, Frappe + ERPNext 15.110.0, apps `frappe` + `erpnext` + `retail_tower_erpnext_connector`. Separate `dp2-postgres-dev`/`dp2-redis-dev` stack also running (DP2 dev), distinct from the Frappe stack.

**Verified read-only:** DocType JSON field schemas (B5).

**NOT done (forbidden-mutation boundary held):** no create/save/submit/cancel, no DB write, no bench migrate/update/install-app, no settings change.

**Paused (read-only but needs explicit approval):** querying `retail.localhost` for EXISTING POS Invoice/Closing instances; inspecting Connector server scripts/hooks on the bench.

---

### B8. Recommended single next action

Reconcile POS-010's `src/shared/api-types.ts` + read-down client/driver wiring against DP2's shipped `catalog/read-down.yaml` (snapshot+delta) — the Part A test-first plan.

**Discriminator:** it is knowable NOW from the sibling repo without the deploy and de-risks the #349 unblock; opening POS-011 instead would stall against an unreachable (HTTP 521) backend.

**Runner-up:** author the POS-011 spec (`/speckit-specify`) — unblocked as authoring, but implementation stalls on the deploy.

**Full future implementation prompt:**

> "Reconcile POS-010 to the shipped backend contract. Read `Data-Pulse-2/packages/contracts/openapi/catalog/read-down.yaml` (authoritative: `GET /api/pos/v1/catalog/snapshot` + `/deltas`, `SellableCatalogRow`, cursor pagination, 409 `snapshot_required`). Diff vs the stale pin in `POS-Pulse/src/shared/api-types.ts:3763` (`/api/v1/pos/catalog/products`). Produce a TEST-FIRST plan to re-pin types via codegen and wire the concrete `ReadDownClient` + composition-root driver, preserving device-token Bearer auth, the `is_empty` freshness discriminator, and the stage-and-promote writer. Do NOT run live fetch (HTTP 521 / #349). Stop at the plan for review."
