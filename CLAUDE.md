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
**Active feature:** [`specs/010-pos-catalog-read-down-consumption`](specs/010-pos-catalog-read-down-consumption/) — Catalog Read-Down Consumption. The catalogue-sourcing feature 009 named (009 AD-2/AD-3, R-RISK-2): read-down a full per-tenant/branch sellable-catalogue **snapshot** from the SmartDataPulse backend into 009's local SQLite read model (`products`/`product_barcodes`) so barcode/SKU lookup + Arabic/English search work over **real catalogue data, offline**. **Read direction only** (backend → local); out of scope (P16): sale sync, POS→backend writes, VAT/fiscal, inventory mutation, ERP, receipts, tender, reports/analytics, auto-update. **Planning complete — NO implementation merged.** **`/speckit-specify` ✅** · **`/speckit-clarify` ✅** (2026-06-04; 7 Q resolved) · **`/speckit-plan` v1.0 ✅** (2026-06-04; see [plan.md](specs/010-pos-catalog-read-down-consumption/plan.md)) · **`/speckit-tasks` ✅** (46 tasks, test-first) · **`/speckit-analyze` ✅** (0 CRITICAL; 100% FR/SC coverage). Spec artifacts on **PR #342** (+ independent-review remediation `a065e73`). **Implementation BLOCKED — awaiting §A6 + §A2 + owner go-ahead.**

**010 gate status:** **§A2** (migration-safety for the new staging/sync-state tables `0031`–`0033` + the promote transaction) — ⛔ **required, fresh** (does NOT inherit 009's §A2). · **§A4** (P8 bridge-security for the new `catalogue:refresh`/`catalogue:freshness` channels) — ⛔ required. · **§A5** (production readiness: runbook/rollback/failure-modes + perf bring-up incl. concurrent-lookup-during-promote) — ⏳ rollout-time. · **§A6** (backend catalogue-snapshot OpenAPI op + Constitution V generated types) — ⛔ **EXTERNAL critical-path blocker; owned by the backend team.** Locked design decisions (clarify, owner-ratified): stage-and-promote (transaction-wrapped `DELETE` live + `INSERT…SELECT` from staging, under WAL), full-snapshot replace, separate `catalogue_sync_state` store, skip-and-log + abort-threshold, paired-terminal background trigger + manual refresh (NOT operator-session-gated, Constitution VIII), timestamp-only freshness with an `is_empty` truthfulness discriminator. Terminal auth = constitution-mandated **`X-Terminal-Token` header** (no operator JWT). Fold columns recomputed locally via 009's `normalize()`.

**010 slice status:** **NONE merged — pre-implementation.** Indicative slice plan (from [plan.md](specs/010-pos-catalog-read-down-consumption/plan.md) §Phase 2): S0 backend-contract coordination (§A6) → S1 migrations `0031`–`0033` (§A2; the only slice not §A6-gated — uses 009's known table shape) → S2 read-down writer + validation (fixture-buildable now) → S3 HTTP client + driver (§A6) → S4 bridge additions + freshness UI (§A4) → S5 production readiness (§A5). The correctness core (migrations, writer/promote/atomicity, validation, fold-parity, tenant-isolation) is **fixture-buildable in parallel** with backend coordination; only the live-fetch client (T020/T021) + wiring (T039) truly wait on §A6.

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
