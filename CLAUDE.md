# POS-Pulse — Agent Context

POS-Pulse is the desktop Point-of-Sale terminal for the SmartDataPulse pharmacy platform. It is
the POS surface of `smartdatapulse.tech`, packaged as an Electron application targeting Windows
10/11 x64.

## Authoritative documents (read these first)

| Document | Purpose |
|:--|:--|
| `.specify/memory/constitution.md` | Project constitution (v1.3.0). Highest-priority document; principles, hardware matrix, platform integration, governance. |
| `_reference/Data-Pulse/` | Read-only legacy reference. Gitignored. **Never copy-paste from here** (Constitution Principle IX). |

## Active feature

<!-- SPECKIT START -->
**Next feature (planning):** [`specs/011-sale-sync-capture-up`](specs/011-sale-sync-capture-up/) — Sale Sync (Capture-UP). The capture-UP leg: a main-process engine drains 008's read-only enqueue-only `sale_sync_outbox`, reconstructs each sale's payload from the durable Sale (keyed by `sale_id`), and POSTs to DP2 `captureSale` (`POST /api/pos/v1/sales`). **`/speckit-specify` ✅ · `/speckit-clarify` ✅ (2026-06-07; 3 Q resolved A/A/A) · `/speckit-plan` ✅ ([plan.md](specs/011-sale-sync-capture-up/plan.md))** — `/speckit-tasks` + `/speckit-analyze` next. Locked design: operator-session auth read in-process from 004 (NOT 010's device token); new 011-owned `sale_sync_state` companion table (008's outbox never mutated, AD-3 preserved); deterministic `Idempotency-Key`/`externalId` from `sale_id`; NO tender in v1; DI client seam (fake for tests). Gates: §A2 (new `0034-sale-sync-state` migration), §A4 (read-only `sales:syncStatus` bridge channel), §A5 (incl. no-tender end-to-end verification + live-leg bring-up). **Live HTTP client + composition-root wiring BLOCKED on #349 (backend HTTP 521); S1–S4 buildable now behind the fake.**

**Active feature:** [`specs/010-pos-catalog-read-down-consumption`](specs/010-pos-catalog-read-down-consumption/) — Catalog Read-Down Consumption. The catalogue-sourcing feature 009 named (009 AD-2/AD-3, R-RISK-2): read-down a full per-tenant/branch sellable-catalogue **snapshot** from the SmartDataPulse backend into 009's local SQLite read model (`products`/`product_barcodes`) so barcode/SKU lookup + Arabic/English search work over **real catalogue data, offline**. **Read direction only** (backend → local); out of scope (P16): sale sync, POS→backend writes, VAT/fiscal, inventory mutation, ERP, receipts, tender, reports/analytics, auto-update. **Implementation in progress — all OFFLINE work merged; only the live-fetch + driver wiring waits on the backend (#349).** **`/speckit-specify` ✅** · **`/speckit-clarify` ✅** (2026-06-04; 7 Q resolved) · **`/speckit-plan` v1.1 ✅** (refreshed 2026-06-04 against shipped backend decisions, #350; see [plan.md](specs/010-pos-catalog-read-down-consumption/plan.md)) · **`/speckit-tasks` ✅** (46 tasks, test-first) · **`/speckit-analyze` ✅** (0 CRITICAL; 100% FR/SC coverage). Spec artifacts on **PR #342** (+ independent-review remediation `a065e73`). **Implementation: the offline S1+S2 correctness core MERGED (`5895eba`); the read-down driver + `catalogue:refresh`/`freshness` bridge + freshness UI + invariant guards + polish MERGED (PR #358, `946a013`); and the `catalogue.*` IPC surface is now WIRED LIVE — 009's lookups + 010's freshness are reachable from the renderer (the surface was previously inert — 009 never registered it either). Full suite green (5009 tests). Remaining: the live-fetch HTTP client + read-down DRIVER wiring (T002/T020/T021/T039) — blocked on §A6 re-pin (#349); `catalogue:refresh` is registered but refuses until the driver lands. Plus §A5 perf bring-up (T054, target hardware).**

**010 gate status:** **§A2** (migration-safety for the new staging/sync-state tables `0031`–`0033` + the promote transaction) — ✅ **RATIFIED 2026-06-05** (owner; `branch_id`/store scope = **`NOT NULL TEXT`**, the last held dimension — auth/scope landed via Data-Pulse-2 PR #490). Does NOT inherit 009's §A2; clears the offline S1+S2 correctness core. · **§A4** (P8 bridge-security for the new `catalogue:refresh`/`catalogue:freshness` channels) — ✅ **CLEARED** (2026-06-07; [`security-review/s4-review.md`](specs/010-pos-catalog-read-down-consumption/security-review/s4-review.md): pre-impl 13-control matrix §4 → post-impl walk §10 (13/13 PASS) → post-WIRING re-check §11 (AD-1/SEC-1/INP-1/P17-1 re-verified against the live `ipcMain` handler). **One residual:** a final `refresh` re-check is owed when the driver is wired (T039/#349). · **§A5** (production readiness: runbook/rollback/failure-modes + perf bring-up incl. concurrent-lookup-during-promote) — ⏳ rollout-time. · **§A6** (backend catalogue-snapshot OpenAPI op + Constitution V generated types) — 🟡 **PARTIALLY CLEARED — only D-DEPLOY remains** (live re-pin; backend-ops, NOT a decision). Auth/contract decisions D-AUTH-1/2 **shipped** (Data-Pulse-2 PR #490, issue #488 closed); D-NAME + D-BARCODE **owner-ratified** for v1. Locked design decisions: stage-and-promote (transaction-wrapped `DELETE` live + `INSERT…SELECT` from staging, under WAL), full-snapshot replace, separate `catalogue_sync_state` store, skip-and-log + abort-threshold, paired-terminal background trigger + manual refresh (NOT operator-session-gated, Constitution VIII), timestamp-only freshness with an `is_empty` truthfulness discriminator. **Terminal auth (REVERSED, AD-7): the shipped backend authenticates the device pairing token directly via `Authorization: Bearer <device_token>` — NO operator JWT, and NOT `X-Terminal-Token` (a per-surface exception to the constitution §Auth mandate; #490's `PosDeviceAuthGuard` resolves `(tenant_id, store_id)` from the device row).** Single `name` → both 009 fold inputs (D-NAME, no Arabic split in v1); scanned codes match the untyped `aliases[]` bag (D-BARCODE, lossy — known limitation). Fold columns recomputed locally via 009's `normalize()`.

**010 slice status:** **S1 + S2 + S4 + driver MERGED; catalogue IPC surface WIRED LIVE.** Slice plan (from [plan.md](specs/010-pos-catalog-read-down-consumption/plan.md) §Phase 2): S0 re-pin `api-types.ts` (§A6, **DEFERRED** — blocked on backend deploy, issue #349) → **S1 migrations `0031`–`0033` ✅ MERGED** (`5895eba`) → **S2 read-down writer + map + validate + sync-state repo ✅ MERGED** (`5895eba`) → **S3 HTTP client + driver wiring — PARTIAL: the driver (T037/T038, fake-client-injected) ✅ MERGED (PR #358); the live HTTP client (T020/T021) + composition-root driver wiring (T039) BLOCKED on #349** (`Authorization: Bearer <device_token>` auth) → **S4 bridge additions + freshness UI ✅ MERGED (PR #358 `946a013`)** — `catalogue:refresh`/`freshness` channels + handlers + preload + `CatalogueFreshness` (impeccable; three truthful states, absolute auditable timestamp), **registered with `ipcMain` and wired in `index.ts`** (the whole `catalogue.*` surface — incl. 009's lookups — was previously inert; now reachable). `productRepo.countByTenant` added for `is_empty`. §A4 CLEARED. → S5 production readiness (§A5; runbook/rollback/failure-modes authored; perf bring-up T054 deferred — target hardware). **Also done:** T036 no-outbound-write, T018 redaction smoke (5009 tests green). **Remaining (all #349-gated or hardware):** **T002/T020/T021/T039** — live-fetch client + driver wiring; `catalogue:refresh` is registered but refuses until the driver lands, and no read-down actually fetches yet (freshness reads "not yet downloaded" in prod). The pinned `api-types.ts` is **still the stale** `/api/v1/pos/catalog/products` shape until the re-pin. **T054** perf bring-up (hardware). Two carry-forwards for the T039 slice: the final §A4 `refresh` re-check, and the post-commit freshness-refresh mechanism (Codex-flagged; design against real driver timing, respect the owner no-poll constraint).

**Recently closed:**
- `specs/009-product-search-and-barcode-lookup` — Product Search & Barcode Lookup. Read-only catalogue search + barcode/SKU lookup over a local SQLite read model; confirm-first add into 005's cart via the R7 `resolveItemRef` seam; Arabic-first/RTL, offline-first. **Implementation complete; §A5 SIGNED OFF (caveated) 2026-06-01.** All tasks through T058 merged (S0–S5, #317–#338); §A0/§A1 ✅ 2026-05-30, §A2 ✅ 2026-05-31 (migrations `0029`/`0030`); T054 perf bring-up PASS on target hardware (LENOVO 82K2 / Ryzen 7 5800H, SHA `3461f00`: NFR-1 worst p95 0.160 ms ≤ 50; NFR-2 worst p95 15.170 ms ≤ 150; R-RISK-1/FTS5 not triggered — [`perf-bringup.md`](specs/009-product-search-and-barcode-lookup/perf-bringup.md)). **Caveat:** the manual legs of T050 (screenshot/contact-sheet) + T056 (packaged no-mouse walkthrough) are deferred/waived for the internal/dev surface — jsdom-automated coverage (T050 #330, T051 axe #331, T056 keyboard #333) stands in. **009 is 010's direct upstream:** 010 fills the empty `products`/`product_barcodes` tables 009 ships (009 R-RISK-2).
- `specs/008-sale-finalization-and-receipts` — Sale finalization & receipts. **Implementation complete; §A5 SIGNED OFF (caveated) 2026-05-30** (T529, PR #314). Gates §A0/§A1/§A3/§A4 cleared; §A2 = AD-12-locked no-op. **Rollout caveat (load-bearing):** the §A5 sign-off covers an **internal/dev MVP only** — Egyptian VAT is deferred (`total_tax_minor` hardcoded 0; receipts carry no tax line), so **customer-facing fiscal production use remains BLOCKED pending 008-v2**. Owner hardware target = printer-only / OS-print / BIXOLON SRP-330 II; cash-drawer/DK1 + ESC/POS deferred. See coordination.md + [`a5-verification-findings.md`](specs/008-sale-finalization-and-receipts/a5-verification-findings.md).
- `specs/007-pos-visual-system` — POS Visual System Recovery. Complete; all six slices (S0–S6) merged (PRs #109, #113–#118).

**Previous features (complete)**:
- `specs/001-foundation` — Foundation (Electron + Vite + TS + tests + CI).
- `specs/002-terminal-pairing` — Terminal pairing (device token, branch scope).
- `specs/003-pos-ui-shell` — POS UI shell (design tokens, navigation, role-indicator slot).
- `specs/004-operator-session` — Operator session (complete, §A1 + §A2 gates cleared).
- `specs/005-sales-cart` — Sales cart (complete through S4-b handoff core; owns the `resolveItemRef` seam 009 wires into).
- `specs/006-payments-tender` — Payments + tender (complete; §A5 signed off in PR #234 on 2026-05-26).

**005/006 UI gate:** UNBLOCKED — S1 + S2 + S3 merged with reviewer-ticked T060 criteria. 005 and 006 both consumed the gate; 006 is now closed.
<!-- SPECKIT END -->

## Spec Kit workflow

```
/speckit-specify   →  spec.md                (✅ complete for 001)
/speckit-clarify   →  resolve [NEEDS CLARIFICATION]   (n/a — none open)
/speckit-plan      →  plan.md + research.md + data-model.md + contracts/ + quickstart.md   (✅ complete for 001)
/speckit-tasks     →  tasks.md               (next)
/speckit-analyze   →  cross-artifact validation
/speckit-implement →  execute tasks
```

Trivial fixes (typos, log-message tweaks, dependency bumps) MAY skip the pipeline.

## Key technical decisions (locked)

- Stack: Electron 40 + React 19 + Vite 8 + TypeScript 5.6 (strict) + Tailwind 4.
- Local DB: `better-sqlite3` with a custom transactional migration runner.
- Secrets: Electron `safeStorage` (DPAPI on Windows). Production refuses to start without it.
- Money: integer minor units, `Number.isSafeInteger` guarded; ≥ 95% coverage on the module.
- Tests: Vitest only.
- Codegen: `openapi-typescript` v7 from a pinned snapshot in 001; live fetch later.
- CI: GitHub Actions on `windows-latest`. Gates: typecheck, lint, tests, package dry-run.

See `specs/001-foundation/research.md` for the full rationale on each.

## Hard rules (always in force)

These come from the constitution and are repeated here for quick agent reference:

- **No floats for money.** Money is integer minor units only.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** on every BrowserWindow.
- **No upward-of-bridge IPC.** Renderer reaches the main process exclusively through the typed
  preload bridge defined in `src/shared/bridge-api.ts`.
- **No copy-paste from `_reference/Data-Pulse/`.** Re-derive instead.
- **Test-first.** Add the failing test before the implementation; tasks generated by
  `/speckit-tasks` make this explicit per-task.
- **PII / cards never in logs.**

## Useful commands

```bash
npm install                  # install deps
npm run dev                  # open empty Electron window
npm run codegen:api          # regenerate src/shared/api-types.ts
npm run codegen:verify       # CI helper: regen → diff
npm run typecheck            # both tsconfigs
npm run lint                 # eslint + prettier --check
npm test -- --coverage       # full vitest run
npm run package:dir          # electron-builder --win --dir (unsigned)
```
