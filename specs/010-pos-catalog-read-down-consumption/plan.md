# Implementation Plan: Catalog Read-Down Consumption

**Feature ID:** 010-pos-catalog-read-down-consumption
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.1 (refreshed 2026-06-04 against the resolved cross-repo decisions — see the refresh note below)
**Created:** 2026-06-04
**Last Updated:** 2026-06-04 (v1.1)
**Constitution version pinned:** v1.5.1

> **v1.1 refresh (2026-06-04)** — amended after the backend decisions landed (Data-Pulse-2 PR #490 / issue
> #488; POS §A6 findings 3rd-pass addendum). Material changes: **AD-7 auth REVERSED** to
> `Authorization: Bearer <device_token>` (no `X-Terminal-Token` seam on the backend — per-surface
> exception); backend contract **RESOLVED + SHIPPED** (`SellableCatalogRow`); money = **decimal→minor
> convert at ingest** (GAP-1); `name`→`name_ar` + name_en NULL (D-NAME); untyped `aliases[]`→`product_barcodes`
> (D-BARCODE); **§A6 narrowed to D-DEPLOY only** (live re-pin, issue #349); §A2 narrowed to `branch_id`.
> The correctness core (S1+S2) is **buildable now**; only S3 (live client) waits on the re-pin.

> ⚠️ **Planning artifact only.** `/speckit-plan` writes NO source, NO migrations, NO codegen, NO package
> installs, and does NOT update `CLAUDE.md`. Phase 0 ([research.md](./research.md)) and Phase 1
> ([data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)) are
> co-resident. Implementation is held behind the approval gates below — and additionally **blocked** on
> the backend catalogue-snapshot operation (R6 / §A6).

---

## Summary

010 is the **catalogue-sourcing feature** 009's plan named (009 AD-2 / AD-3, R-RISK-2). 009 shipped an
empty product read model (`products` / `product_barcodes`) plus the lookup/search/resolve that queries
it; on a real terminal every lookup returns "catalogue unavailable" because nothing fills the model. 010
delivers the **read-down**: a main-process driver fetches a **full per-tenant/branch sellable-catalogue
snapshot** from the SmartDataPulse backend, validates each record, bulk-writes it to **staging tables**,
and **promotes** it into 009's live tables in **one transaction** (delete-live + insert-from-staging), so
009's lookup/search operate over **real catalogue data, offline**. Fold columns are computed with 009's
`normalize()` so search keeps matching. A `catalogue_sync_state` row records the last successful promote,
surfaced as a truthful **"catalogue last updated"** timestamp.

010 is strictly **read-direction** (backend → local). It does **NOT**: send anything back to the backend,
mutate the cart, ring up/finalize a sale, compute VAT/fiscal, touch inventory/stock/batch, post to ERP,
print/alter receipts, handle tender, or produce reports/analytics. It supplies *data*; it does not change
how 009 reads it.

**The clarified decisions (spec `## Clarifications`, owner-ratified 2026-06-04) are the load-bearing
inputs:** stage-and-promote (FR-6), full-snapshot replace (FR-15a), separate `catalogue_sync_state` store
(FR-16a), skip-and-log + abort-threshold (FR-9), paired-terminal background trigger + manual refresh
(FR-15), timestamp-only freshness (FR-16). They are not re-opened here; this plan pins their mechanism.

## Technical Context

| Area | Choice | Source |
|:--|:--|:--|
| Runtime / packaging | Electron `^40` Windows 10/11 x64 (inherited) | constitution v1.5.1 / plan 001 |
| Process boundary | Read-down writer + driver are **main-process only** (SQLite + network are main-process per Principle III). Renderer reaches it only via the typed `catalogue.*` bridge. | constitution III |
| Local DB | `better-sqlite3` (synchronous, embedded), single process-lifetime handle from the composition root (`src/main/index.ts`). | constitution Tech Stack / as-built |
| Read model (target) | 009's existing `products` / `product_barcodes` (`migrations/0029`,`0030`). 010 **writes** them only at promote. | 009 data-model / R2 |
| New local tables | `products_staging`, `product_barcodes_staging`, `catalogue_sync_state` (migrations `0031`–`0033`). | research R2/R4 / data-model |
| Apply mechanism | **Stage-and-promote**: bulk-write staging → one transaction `DELETE` live + `INSERT … SELECT` from staging (atomic, FR-6). | research R2 |
| Sync model | **Full-snapshot replace** — no delta/cursor/ordering. | research R3 / spec FR-15a |
| Fold columns | Computed at write-time via 009's **`normalize()`** (`src/main/catalogue/normalize.ts`), idempotent; never trusted from the source. | research R1 / spec FR-3 |
| Backend client | New main-process HTTP client following the as-built pattern (`operator/backend-client.ts`, voucher clients): factory `{ baseUrl, fetch, timeoutMs }`, injected `fetch`, `AbortSignal.timeout`, resolve-on-reachable / reject-on-transport, typed discriminated outcome. | research R6 / as-built |
| Backend contract | **RESOLVED + SHIPPED (backend)** — `GET /api/pos/v1/catalog/snapshot` (+ `/deltas`), schema `SellableCatalogRow` (`product_id`, `sku`, `name`, `aliases[]`, `price{amount,currency_code}`, `tax_category`, `active`, `row_cursor`). Backend Data-Pulse-2 PR #490 / issue #488 MERGED. Response types MUST be **generated** into `src/shared/api-types.ts` (Principle V) — pending the **live re-pin** (D-DEPLOY, issue #349; backend not yet deployed to the edge). The stale pinned `/api/v1/pos/catalog/products` shape is NOT the contract. | findings 3rd-pass / constitution V |
| Terminal auth | **`Authorization: Bearer <device_token>`** (D-AUTH-2, settled via backend PR #490). The backend has **NO `X-Terminal-Token` seam** (verified firsthand in `Data-Pulse-2/apps/api/src/auth/auth.guard.ts` — it reads a single opaque bearer in the `Authorization` header). The device token (from `secretStore.get(DEVICE_TOKEN_KEY)`, main process) rides `Authorization: Bearer`; the backend's `PosDeviceAuthGuard` resolves `(tenant_id, store_id)` from the store-bound device row (P17). **This is a documented per-surface EXCEPTION to `constitution.md:955-960`** (which mandates `X-Terminal-Token` on backend calls) — read-down follows the backend's actual contract. No operator JWT (Constitution VIII background sync). Token never crosses the bridge / never logged (P7). **(REVERSED 2026-06-04 — earlier drafts said `X-Terminal-Token`; the backend implements `Authorization: Bearer`. See AD-7 + R-RISK-2.)** | findings 3rd-pass / AD-7 |
| Trigger / lifecycle | Main-process **read-down driver** modelled on `src/main/sales/finalize-listener.ts` (`{ runTickOnce, start, stop }`): app-start / post-pairing + periodic interval; `stop()` before `dbHandle.close()`. Runs on a **paired terminal**, **not** operator-session-gated (Principle VIII). | research R8 / spec FR-15 |
| Bridge additions | `catalogue:refresh` (manual trigger) + `catalogue:freshness` (last-updated read), session-gated, data/secret-free. New preload surface → **P8 review**. | research R-bridge / contracts |
| Freshness UI | Renderer reads `catalogue.freshness`; shows "catalogue last updated &lt;time&gt;" only. No stale-alarm/auto-refresh (MVP, owner-confirmed). Arabic-first/RTL, inherits 003/007 tokens. | spec FR-16 / SC-10 |
| Money | **Convert-at-ingest, then conduit.** Backend sends `price { amount: decimal-string, currency_code }` (GAP-1). The staging-validation boundary converts decimal → **integer minor units** (×10^exponent per currency: EGP/USD 2, JPY 0, KWD/BHD 3) via exact string→int parse — **never a float** — then `Number.isSafeInteger`-guards `price_minor`. Downstream: zero arithmetic, conduit only. | constitution II/P1 / research R5 |
| Observability | New pino sites: read-down outcome / counts / latency / status-class — public fields only; raw snapshot body + token never logged; redaction allowlist extended. | constitution VII / spec NFR-3 / research R7 |
| Tests | Vitest only (`happy-dom`, `@testing-library/react`, `expectNoAxeViolations`). Coverage gates per module below. | constitution VI |
| CI | No workflow changes; existing `codegen:verify → typecheck → lint → test → package:dir`. `codegen:verify` becomes load-bearing once the backend op publishes (regenerated `api-types.ts`). | 001 |

**NEEDS CLARIFICATION (backend-owned, gates implementation, not planning):** the catalogue-snapshot
endpoint shape + OpenAPI operation (R6 / §A6). All in-app design items are resolved in research.md.

## Constitution Check (Initial)

Walked across Core Principles I–IX and Cross-Feature POS Principles P1–P18 (constitution v1.5.1).

### Core Principles (I–IX)

| Principle | Status | Notes |
|:--|:--:|:--|
| I. Offline-First (NON-NEGOTIABLE) | **PASS-load-bearing** | The read-down *fills* the local model; lookups stay 100% local (009 FR-23 unchanged). A failed/absent read-down never blocks selling (FR-7/FR-12); the network is only touched by the background driver, never the lookup path. |
| II. Financial Precision — No Floats | **PASS-conduit** | `price_minor` carried verbatim; `Number.isSafeInteger`-guarded at staging validation; zero arithmetic (R5). Money columns `INTEGER CHECK(>=0)`. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | **PASS** | Read-down writer, driver, and HTTP client are main-process only. Renderer reaches catalogue only via the enumerable `catalogue.*` bridge; new channels are named in `CATALOGUE_IPC_CHANNELS`. No renderer Node access, no upward-of-bridge IPC. |
| IV. Hardware Loud, Not Silent | **N/A-mostly** | No hardware. The analogous rule (no silent failure) is honoured: a failed read-down is loud in diagnostics, recoverable for the cashier (FR-7, NFR-5). |
| V. Type Safety End-to-End | **PASS-with-dependency** | New `catalogue.*` bridge types in `bridge-api.ts`; strict TS. **Backend response types MUST be generated** via `openapi-typescript` (never hand-typed) — this is the §A6 gate: implementation waits on the published OpenAPI op (or a time-boxed V-waiver). |
| VI. Test-First, Coverage-Gated | **PASS** | Failing tests first per slice. Gates: ≥95% on the read-down writer/promote + validation; ≥95% on the HTTP client's outcome mapping; ≥90% on the driver + sync-state repo. |
| VII. Observability | **PASS-with-extension** | New pino sites pair with redaction (R7); raw snapshot body + device token never logged; Sentry scrubber + forbidden-keys allowlist extended symmetrically. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | **PASS-load-bearing** | The read-down authenticates with the **terminal device token** and runs on a **paired terminal without an operator session** — exactly the "unattended terminal MAY perform background sync, MUST NOT ring up sales" allowance. No new identity primitive; PIN factor plays no role. |
| IX. Reference, Not Inheritance | **PASS** | Re-derived from 009's data-model + the as-built backend-client/listener patterns; no copy-paste from `_reference/Data-Pulse/`. |
| Platform Integration | **PASS-with-dependency** | New backend op at `api.smartdatapulse.tech` (§A6); auto-update / printing untouched. |
| Security | **PASS** | Device token main-process-only + never logged (P7); tenant-scoped writes (P17); bridge additions data/secret-free + P8-reviewed. |
| Hardware Matrix | **N/A** | No hardware surface. |
| Domain — Pharmacy POS | **PASS** | Sources a *sellable product catalogue* only — no stock/expiry/batch/controlled-substance enforcement (carries the flags 009 surfaces, enforces nothing). |

### Cross-Feature POS Principles (P1–P18)

| Principle | Status | Notes |
|:--|:--:|:--|
| P1. Financial Correctness First | **PASS-conduit** | Price carried, never computed; safe-integer guard at the write boundary; a wrong price can't be silently introduced (validation rejects non-safe-integer). |
| P2. No Fake Success States | **PASS** | `catalogue.refresh` returns `started`/`already_running`, never a fake "updated"; freshness shows a time only after a **committed** promote (timestamp written in the promote tx). |
| P3. No Silent Data Loss | **PASS-load-bearing** | Stage-and-promote (FR-6) + failure preserves prior catalogue (FR-7) + skip-and-log with abort-threshold (FR-9). Interrupted promote rolls back. |
| P4. Auditability / Non-Destructive | **N/A-read-model** | 010 writes a read model, not a money-bearing ledger; emits no audit events. The catalogue is intentionally *replaced* each snapshot — it is not an audit anchor (consistent with 009 §A2 §6). |
| P5. Idempotency for Retried Operations | **PASS** | See the explicit **Idempotency** subsection below (constitution P5 requires one). Full-snapshot replace is construction-idempotent (re-run → identical state, FR-13); single-flight driver prevents interleave (FR-14); no client-UUID key is needed because the operation commits no money and carries no per-intent identity. |
| P6. No Raw Cardholder Data | **N/A** | No card data anywhere in the catalogue path. |
| P7. Secrets Never Reach Renderer/Logs | **PASS-load-bearing** | Device token (the `Authorization: Bearer` value) stays main-process; never crosses the bridge, never logged; `device_token` already on the forbidden-keys allowlist. Bridge additions return no secret. |
| P8. Electron Security Boundary | **PASS-with-justified-expansion** | 010 owns the `catalogue:refresh` + `catalogue:freshness` bridge expansion explicitly; reviewed line-by-line under a **P8 bridge-security review** (§A4). No renderer-exposed write handler. |
| P9. Truthful Offline / Degraded / Sync States | **PASS-load-bearing** | The freshness indicator is the honest realisation of 009 FR-24a; it implies no live sync; null until a real success. Owner-confirmed timestamp-only MVP (no stale-price alarm). |
| P10. Operator Accountability | **N/A-read-down** | No sensitive operator action; the read-down is a background terminal task, not an operator-attributable money action. |
| P11. Supportability Without Secret Leakage | **PASS** | Diagnostics are useful (outcome/counts/latency/status) and minimal/redacted; raw body never logged. |
| P12. Spec Kit Artifacts Are Source of Truth | **PASS** | Spec ↔ plan reconciliation explicit; the PROPOSED backend contract is flagged as a request, not a fait accompli. |
| P13. Small, Scoped Implementation PRs | **PASS** | Slice strategy below yields small PRs; stage only named files; stop after PR. |
| P14. Accessibility / Cashier Ergonomics | **PASS** | The only UI is the freshness indicator + a refresh affordance: keyboard-operable, ≥44×44 targets, icon+text (not colour-only), axe-clean, RTL Arabic-first. |
| P15. Production Readiness Gates | **PASS-with-deferral** | Production-affecting (feeds checkout). §A5 names test plan / rollback / runbook / failure-mode catalogue / perf bring-up (read-down completion + promote-window targets). |
| P16. Feature Scope Discipline | **PASS** | Hard Non-Implementation Boundaries restate the spec Out-of-Scope; read-direction-only is an explicit FR (FR-10/11). No sale-sync/VAT/inventory/ERP/receipts/tender/reports/auto-update. |
| P17. Privacy and Tenant Isolation | **PASS-load-bearing** | Snapshot scoped to the terminal's tenant/branch; staged rows guarded against tenant drift; live writes + sync-state tenant-scoped; 009's tenant-scoped read remains the lookup boundary. |
| P18. Local Durability Before Offline Promises | **PASS** | The read model is durable local SQLite; the read-down only promises read availability, which is local. No offline *write* promise is made (none exists here). |

**Gate result: PASS-with-dependency.** No NON-NEGOTIABLE violation. The single hard dependency is
Principle V / Platform Integration — the backend catalogue-snapshot OpenAPI operation must exist before
implementation (the §A6 gate). The P15 deferral (perf bring-up + runbook at rollout) is documented, not
silent.

## Phase 0 — Research

See [research.md](./research.md): R1 (reuse `normalize()`), R2 (stage-and-promote mechanism),
R3 (full-snapshot replace), R4 (separate sync-state table), R5 (skip-and-log + threshold), R6 (PROPOSED
backend contract + verified token attachment — the implementation blocker), R7 (redaction), R8 (driver),
R-bridge (`catalogue.*` additions). All in-app unknowns resolved; R6 is backend-owned.

## Phase 1 — Design & Contracts

- **[data-model.md](./data-model.md)** — `products_staging`, `product_barcodes_staging`,
  `catalogue_sync_state`; the PROPOSED source-snapshot shape; migration ordering `0031`–`0033` under a
  010 §A2-class review.
- **[contracts/backend-catalogue-snapshot.md](./contracts/backend-catalogue-snapshot.md)** — **PROPOSED**
  backend operation (V-gated; the implementation blocker).
- **[contracts/catalogue-bridge-additions.md](./contracts/catalogue-bridge-additions.md)** —
  `catalogue:refresh` + `catalogue:freshness` (P8-reviewed, data/secret-free).
- **[quickstart.md](./quickstart.md)** — reviewer walkthrough by user story.

## Architectural Decisions

- **AD-1. Read-down writer is a NEW main-process module, separate from 009's read repo.** `product-repo.ts`
  stays read-only; the writer (fetch → validate → stage → promote) lives in a new module (e.g.
  `src/main/catalogue/read-down/`). Keeps 009's read surface untouched (small, single-purpose modules).
- **AD-2. Stage-and-promote via transaction-wrapped replace** (R2) — the concrete, implementable form of
  FR-6 atomicity; not a native "table swap".
- **AD-3. Full-snapshot replace, no delta machinery** (R3) — FR-13/FR-14 hold by construction.
- **AD-4. Fold columns recomputed locally with `normalize()`** (R1) — never trusted from the source;
  guarantees SC-9 search recall.
- **AD-5. Separate `catalogue_sync_state` table; `last_success_at` written inside the promote tx** (R4) —
  protects NFR-1 and makes freshness truthful (SC-10).
- **AD-6. Money pass-through with a safe-integer guard at the staging boundary** (R5) — the read-down is
  in the same trust line as a sale total; the *integrity* of the carried `price_minor` is load-bearing
  even though no math is done.
- **AD-7. Terminal-token via `Authorization: Bearer <device_token>` (per-surface exception); generated
  response types** (R6 / D-AUTH-2) — the read-down (no operator JWT) sends the device token in the
  `Authorization: Bearer` header, because the backend's `PosDeviceAuthGuard` (Data-Pulse-2 PR #490) reads a
  single opaque bearer there and has **no `X-Terminal-Token` seam**. This is a **documented per-surface
  exception** to the `X-Terminal-Token` mandate (`constitution.md:955-960`) — the read-down follows the
  backend's actual, shipped contract. Principle V honoured (generated types from the pinned contract, or a
  formally filed time-boxed V-waiver — NOT the 004 hand-typed-without-waiver precedent); the live-client
  slice is gated only on the re-pin (D-DEPLOY, issue #349). **(REVERSED 2026-06-04 from an earlier
  `X-Terminal-Token` claim — verified firsthand in `Data-Pulse-2/apps/api/src/auth/auth.guard.ts`.)**
- **AD-8. Background driver on a paired terminal, not session-gated** (R8 / Principle VIII). Tenant
  identity comes from `pairingStore` (not an operator session — there is none); the writer's tenant-scoping
  guard (FR-8 / P17) filters on it.

## Idempotency (Constitution P5)

> P5 requires a retryable operation to define its idempotency strategy in the plan **before**
> implementation. The read-down is retryable (re-run on interval / manual refresh / after failure), so:

- **Strategy: construction-idempotent full-snapshot replace.** Re-running a read-down against the same
  backend snapshot converges to an **identical** local catalogue state (FR-13) — the promote is a
  whole-table `DELETE` + `INSERT … SELECT` from staging, so there is no accumulation, no duplicate
  products/barcodes, and no order-dependence. Running it N times == running it once.
- **No client-generated UUID key is required** (unlike a sale or a pairing submission). P5's UUID-key rule
  exists to deduplicate *money-bearing, state-accumulating* submissions; the read-down commits **no money**
  and accumulates **no** per-intent record — it replaces a read model. There is nothing to double-apply.
- **Interleave safety:** the driver is **single-flight** (a second tick while one is in progress is
  refused/coalesced — `catalogue:refresh` returns `already_running`), so two read-downs never race the
  promote (FR-14). Combined with the atomic promote (FR-6), a retry after a failed/interrupted run simply
  re-replaces from the latest snapshot with no residue.
- **Manual refresh** (`catalogue:refresh`) therefore needs no idempotency key in its request payload
  (`{}`) — kicking the driver twice is safe by the above.

## Project Layout

```
src/
  main/
    catalogue/
      read-down/                 NEW (010)
        read-down-client.ts      HTTP client for the snapshot (pattern: operator/backend-client.ts)
        read-down-writer.ts      validate → stage → promote (the atomic apply; ≥95% cov)
        read-down-driver.ts      { runTickOnce, start, stop } (pattern: sales/finalize-listener.ts)
        validate-record.ts       per-record validation + safe-integer money guard (R5)
      catalogue-sync-state-repo.ts  read/write catalogue_sync_state (freshness source)
      catalogue-bridge.ts        EXTENDED (009-owned): + refresh / freshness handlers (session-gated)
    migrations/                  NEW 0031–0033 (gated §A2-class review)
    ipc/
      catalogue.ts               EXTENDED/NEW: register catalogue:refresh / catalogue:freshness
  shared/
    bridge-api.ts                EXTENDED: catalogue.refresh / catalogue.freshness types
    catalogue/channels.ts        EXTENDED: REFRESH / FRESHNESS channel constants
    api-types.ts                 REGENERATED once backend publishes the op (codegen — §A6)
  renderer/
    ui/catalogue/                NEW: freshness indicator + refresh affordance (a11y, RTL)
specs/010-pos-catalog-read-down-consumption/   this plan + artifacts
```

## Test Strategy

- **Vitest only.** Coverage gates: **≥95%** on `read-down-writer.ts` (validate/stage/promote, atomicity,
  tenant-scoping, skip-and-log, abort-threshold) and on the HTTP client's outcome mapping; **≥90%** on
  `read-down-driver.ts` + `catalogue-sync-state-repo.ts`.
- **Atomicity tests:** interrupt mid-promote (simulated throw inside the tx) → live tables unchanged;
  staging never visible to a `product-repo` query (SC-4).
- **Failure-preservation tests:** transport failure / malformed snapshot / over-threshold rejections →
  prior catalogue intact, `last_success_at` unchanged (SC-5); below-threshold → valid rows promote,
  rejects counted (SC-11).
- **Fold-parity test:** rows written by the read-down are found by 009's `product-repo.search` across the
  Arabic/English folded-variant corpus (SC-9) — proves write-time `normalize()` matches read-time.
- **Tenant-isolation tests:** a snapshot containing a foreign-tenant row never reaches the live tables;
  cross-tenant rows rejected (SC-6, P17).
- **No-outbound-write test:** the read-down issues only the snapshot GET — assert no other backend call
  (SC-7).
- **Redaction smoke:** read-down log lines + any `refresh`/`freshness` diagnostics carry no token / raw
  body / PII (NFR-3); allowlist extension covered.
- **Bridge tests:** `refresh`/`freshness` gate on session (generic refusal); `refresh` returns
  `already_running` under single-flight; `freshness` returns `null` before first success.
- **Renderer a11y:** freshness indicator + refresh affordance keyboard-operable, axe-clean, RTL, ≥44×44.
- **Perf (P15/§A5):** read-down completion + promote-window at ~50k products on target hardware; confirm
  009's lookup budgets (NFR-1) hold against a read-down-populated catalogue.

## CI / Build / Package

No workflow changes. Existing `codegen:verify → typecheck → lint → test → package:dir` on
`windows-latest`. **`codegen:verify` becomes load-bearing** once the backend publishes the snapshot op:
regenerating `src/shared/api-types.ts` is codegen-owned scope and part of the §A6 clearance.

## Phase 2 — Implementation Outline

Slices are small reviewable PRs; `/speckit-tasks` derives the task list. Indicative order:

| Slice | Deliverable | Gates |
|:--|:--|:--|
| **S0: Re-pin `api-types.ts`** (non-code) | Backend contract is SHIPPED (PR #490); confirm D-DEPLOY (`/openapi.json` 200) then `codegen-api.ts --source=live` → commit snapshot + types. **DEFERRED — blocked on backend deploy (issue #349); work local meanwhile.** Only S3 truly waits on this. | §A6 (D-DEPLOY only) |
| **S1: Migrations** — `0031`–`0033` (staging ×2 + sync-state), ship empty | Schema + indexes; FK-safe single PR. **BUILDABLE NOW** (contract shape known; §A2 narrowed to `branch_id`, resolvable — device scope = `(tenant_id, store_id)`). | §A2-class migration review |
| **S2: Read-down writer + validation** — validate → decimal→minor convert → stage → promote (atomic); `name`→`name_ar` (name_en NULL); explode untyped `aliases[]` → `product_barcodes` (barcode_kind NULL); fold via `normalize()`; safe-integer guard; skip-and-log + threshold | The correctness core; ≥95% cov; atomicity + failure-preservation + fold-parity + tenant-isolation tests, **all fixture-built** (no backend). **BUILDABLE NOW.** | (S1) |
| **S3: HTTP client + driver** — snapshot client (generated types); driver `{runTickOnce,start,stop}`; app-start/post-pairing + interval; **`Authorization: Bearer <device_token>`** auth; tenant from `pairingStore`; redaction | resolve-on-reachable mapping; no-outbound-write test; single-flight. | §A6 (D-DEPLOY / re-pin) |
| **S4: Bridge additions + freshness UI** — `catalogue:refresh` + `catalogue:freshness`; renderer "last updated" indicator + refresh affordance | P8 bridge-security review; a11y/RTL. | §A4 (P8) |
| **S5: Production readiness** — runbook, rollback, failure-mode catalogue, perf bring-up | NFR-1 preserved; read-down/promote-window evidence. | §A5 |

## Constitution Check (Post-Design)

Re-evaluated after Phase 1. No status regressed.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | **PASS-load-bearing** | Lookups stay local; read-down off the lookup path; only the promote tx briefly touches live tables. |
| II / P1. Financial Precision | **PASS-conduit** | Safe-integer guard at staging; no math. |
| III. Process-Boundary | **PASS** | Main-process writer/driver/client; enumerable `catalogue.*` additions. |
| V. Type Safety | **PASS-with-dependency** | Generated backend types (§A6); typed bridge additions. |
| VI. Test-First | **PASS** | Coverage gates + atomicity/failure/fold/tenant/no-write corpora defined. |
| VII / P7 / P11. Observability + secrets | **PASS** | Public diagnostics only; token + raw body never logged; allowlist extended. |
| VIII. Terminal Identity | **PASS-load-bearing** | Device-token-authenticated; paired-terminal, no operator session. |
| P3. No Silent Data Loss | **PASS-load-bearing** | Stage-and-promote + failure preservation + threshold abort. |
| P8. Electron Security Boundary | **PASS-with-justified-expansion** | 010 owns the bridge additions; §A4 review. |
| P9. Truthful States | **PASS** | Freshness backed by committed promote; no live-sync implication. |
| P16. Scope Discipline | **PASS** | Read-direction-only; out-of-scope domains named. |
| P17. Tenant Isolation | **PASS-load-bearing** | Tenant-scoped staging/promote/state + cross-tenant rejection. |

## Approval Gates

> **Gate-numbering note.** 010's gate numbers parallel 009's review *types*, not a fresh 0..N sequence:
> **§A2** = migration-safety, **§A4** = P8 bridge-security (009 called this the "§A4-style companion"),
> **§A5** = production readiness. 009's **§A0/§A1/§A3** were 009-specific (S0 visual direction / R7
> seam-wiring / Argon2 binding) and are **N/A** to 010. **§A6** is **new to 010** (backend contract +
> Constitution V). "§A2-**class** review" elsewhere in these artifacts means *a review of the same kind
> as 009's §A2* applied to 010's own tables — it is 010's own gate, not 009's sign-off.

- **§A2 (migration safety) — REQUIRED, fresh.** The `0031`–`0033` staging + sync-state migrations **and**
  the promote transaction's atomicity/tenant-scoping reviewed under a 010 §A2-class package. **Does NOT
  inherit 009's §A2 sign-off** (per the 009 §A2 review's "any later deviation returns here" closing
  rule). Blocks S1/S2/S3.
- **§A4 (P8 bridge-security) — REQUIRED.** Line-by-line review of `catalogue:refresh` /
  `catalogue:freshness`: session gate first, no data/secret leak, no renderer-exposed write handler,
  tenant-scoped freshness, redaction extended. Blocks S4.
- **§A5 (production readiness) — REQUIRED at rollout.** Test plan, rollback, support runbook, failure-mode
  catalogue, perf bring-up (read-down completion + promote-window + NFR-1 preservation on target
  hardware). Blocks the rollout PR.
- **§A6 (backend contract + Constitution V) — PARTIALLY CLEARED; only D-DEPLOY remains.** The
  catalogue-snapshot OpenAPI operation is **published + shipped on the backend** (Data-Pulse-2 PR #490 /
  issue #488 — `GET /api/pos/v1/catalog/snapshot` + `/deltas`, `SellableCatalogRow`, device-principal auth).
  The contract *shape* is therefore known and the correctness core can build against it now. **The ONLY
  open item is D-DEPLOY: re-pinning `api-types.ts` from the deployed contract** — and that is blocked
  because the backend is not yet deployed to `api.smartdatapulse.tech` (HTTP 521; tracked in issue #349).
  **Blocks only the live-fetch HTTP client (T020/T021) and the composition-root wiring (T039).** It does
  **NOT** block the correctness core: migrations (§A2-gated), the writer/promote/atomicity, validation,
  fold-parity, and tenant-isolation are all fixture-buildable now. *(Updated 2026-06-04 — the contract +
  auth decisions are resolved/shipped; what was "the external blocker" is now narrowed to the live re-pin,
  which is backend-ops, not a design dependency.)*

## Risks & Open Items

- **R-RISK-1 — RESOLVED 2026-06-04. Backend contract shipped.** The catalogue-snapshot op is published +
  merged (Data-Pulse-2 PR #490 / issue #488). The only residual is the **live re-pin** of `api-types.ts`,
  blocked on backend deploy (issue #349) — the stale pinned `/api/v1/pos/catalog/products` shape must be
  replaced by `/api/pos/v1/catalog/snapshot`. **No longer a design blocker; it is backend-ops.**
- **R-RISK-2 — RESOLVED 2026-06-04. Auth = `Authorization: Bearer <device_token>`, no JWT.** The backend's
  `PosDeviceAuthGuard` (PR #490) accepts the device pairing token alone in the `Authorization` header (no
  operator session, no `X-Terminal-Token`) and resolves `(tenant_id, store_id)` from the device row.
  Recorded as a per-surface exception to `constitution.md:955-960` (AD-7). *(Earlier `X-Terminal-Token`
  framing was REVERSED — verified firsthand against `Data-Pulse-2/apps/api/src/auth/auth.guard.ts`.)*
- **R-RISK-3 — Promote latency budget at scale (owner: 010 S5).** Under WAL (`client.ts:42`) readers run
  **concurrently** with the promote write-transaction, so the promote does **not** block lookups — this is
  a *latency-budget validation*, not an open architecture question. **Mitigation:** §A5 perf bring-up must
  include a **lookup-concurrent-with-an-in-flight-promote** measurement (not just promote duration) to
  confirm NFR-1/NFR-2 hold *during* a promote at ~50k rows; if the commit stall is material, chunked
  promote is the fallback (R2). *(Reframed 2026-06-04 — WAL closes the "promote blocks lookups" concern;
  the residual risk is the concurrent-latency budget.)*
- **R-RISK-4 — Rejection-threshold value (owner: 010 S2).** The skip-vs-abort threshold (FR-9) needs a
  concrete value. **Mitigation:** tuning item; tests cover both the skip-one and abort-on-many paths.
- **R-RISK-5 — Branch-scoped catalogue (owner: product).** 009's model is tenant-scoped (optional
  `branch_id`, R-RISK-4 inherited). If the backend snapshot is branch-scoped, 010 carries `branch_id`
  through staging/promote/state additively. **Mitigation:** schema is branch-ready; no rework.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
