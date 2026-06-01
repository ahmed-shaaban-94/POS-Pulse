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
**Active feature:** [`specs/009-product-search-and-barcode-lookup`](specs/009-product-search-and-barcode-lookup/) — Product Search & Barcode Lookup. Read-only catalogue search + barcode/SKU lookup over a local SQLite read model; confirm-first add into 005's cart via the R7 `resolveItemRef` seam; Arabic-first/RTL, offline-first (no network in the lookup path). **`/speckit-specify` ✅** · **`/speckit-clarify` ✅** (2026-05-30; 5 Q locked) · **`/speckit-plan` v1.0 ✅** (2026-05-30; see [plan.md](specs/009-product-search-and-barcode-lookup/plan.md)) · **`/speckit-tasks` ✅** · **`/speckit-analyze` ✅** (C1/C2 remediation applied). **All CI/automated tasks merged (through T058); §A5 (production readiness) remains OPEN — perf bring-up on target hardware + owner sign-off still required.**

**Gate status:** **§A0** ✅ RATIFIED 2026-05-30 (S0 visual-direction review + 005 seam coordination; PR #318) · **§A1** ✅ RATIFIED 2026-05-30 (R7 seam matches 005's **live** `{ display_name, unit_price_minor }`; `version` deferred per R9 — no 005 change) · **§A2** ✅ RATIFIED 2026-05-31 (`products`/`product_barcodes`/fold-column migration review; D1–D6 accepted; migrations at `0029`/`0030`) · **§A5** ⏳ **OPEN** (runbook #331 + rollback #331 authored; **only** perf bring-up @ target hardware (T054) + owner sign-off remain).

**Slice status:** **S0–S4 merged** — scaffold + normalize folding + FSM (#317), `catalogue.*` bridge skeleton + session gating (#319), component shells + a11y (#320), `products`/`product_barcodes` migrations (#322), product-repo + exact barcode/SKU lookup (#323), folded substring search + ranking + debounce + result list (#324), R7 resolver + cart-bridge wiring (#325), confirm-first add + controlled/Rx surfacing + scan terminator (#326), catalogue live wiring — search-exec + screen composition + cart lifecycle (T049a, #327), dev-only fixture seed (T049b, #328). **S5 (production readiness) — all CI/automated tasks merged:** **T050** live-surface review + closed two live-composition gaps (error-state surfaces never mounted; `searching` busy affordance) ✅ (#330) · **T051** live-composition axe sweep (7 FSM states) + **T052** support runbook + **T053** rollback note ✅ (#331) · **T056** keyboard-only walkthrough + confirm-panel SC-1 focus fix ✅ (#333) · **T057** coverage gate — `catalogue-bridge.ts`/`normalize.ts`/`catalogueSearchStore` all at 100% (exceeds ≥95/≥95/≥90 gates) + **T058** final-green (codegen-verify/typecheck/lint/test all exit 0) ✅ (#334). **Remaining — both owner/hardware-gated, cannot run in CI:** **T054** perf bring-up @ ~50k rows on target Windows hardware (records NFR-1 ≤50 ms / NFR-2 ≤150 ms p95; misses trigger R4 FTS5-fallback review — feeds §A5) · **§A5 sign-off** (needs T054 evidence + owner sign-off). Plus the **manual legs** of T050 (screenshots) / T056 (no-mouse walkthrough) which need a packaged Electron build + human. **009 is not complete** — perf bring-up and the §A5 sign-off remain; everything runnable in this environment is done.

**Recently closed:**
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
