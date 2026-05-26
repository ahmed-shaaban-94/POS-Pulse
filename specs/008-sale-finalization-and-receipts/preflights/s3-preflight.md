# 008 Slice 3 Preflight — First-print pipeline (ESC/POS direct + OS-print fallback)

> **For agentic workers:** This preflight is the per-wave implementation plan for Slice 3 of 008-sale-finalization-and-receipts. Slice 3 ships in **four sequential waves** (S3a → S3b → S3c → S3d). Each wave is **one PR**. Each wave has a strict file allow-list; touching anything outside is a preflight violation.
>
> **Source of truth (in priority order):**
>
> 1. `specs/008-sale-finalization-and-receipts/tasks.md` — canonical T-numbers + per-task acceptance criteria
> 2. `specs/008-sale-finalization-and-receipts/coordination.md` — live gate ledger + sign-off records
> 3. `specs/008-sale-finalization-and-receipts/contracts/bridge-api.md` — `receipts.retryPrint` contract (§A4 reviewed before S3c ships)
> 4. `docs/hardware-matrix.md` — chosen printer/drawer pair + driver version + caveats (T200 records §A3 entry)
> 5. `specs/008-sale-finalization-and-receipts/research.md` §R-4 (dual-path byte-stability) + §R-6 (template engine reuse)
> 6. `docs/impeccable-embed-preflight.md` — Slice 3 fires the **second** `[IMPECCABLE craft]` marker (T290) in 008; §4.2 ritual carries forward from `s2-preflight.md §4.2`
>
> **This preflight does NOT replace tasks.md.** When this preflight and tasks.md disagree, tasks.md wins.

---

## 0. Slice 3 in one paragraph

Slice 3 implements the first-print pipeline: an ESC/POS adapter (USB or serial transport, write + status-poll with timeout) wrapped around a chosen third-party library; an OS-print fallback adapter (Electron's `webContents.print` callback-to-promise wrapper); a path-selecting print pipeline module that renders the payload via Slice 2's template engine and dispatches via the preferred path; automatic first-print firing on AD-2 finalize completion (the print runs AFTER the atomic Sale-row transaction, so a print failure NEVER rolls back the Sale); `receipts.retryPrint` renderer-callable handler for retry-after-failure with idempotency and `previous_failed_print_event_ids` lineage; `print_events` row INSERT on success / failure with the closed `failure_reason` enum; audit-event emission (`sale.receipt.printed` / `sale.receipt.print_failed` / `sale.receipt.print_retried_success`); and the persistent `<PrinterFailureBanner>` renderer component with three affordances (Retry print / Reprint / Manual override). **No drawer kicking. No reprint flow.** Those start at Slice 4 (drawer) and Slice 5 (reprint).

User stories covered: US1 scenarios **4** (cash sale prints — drawer half is Slice 4), **5** (cashless sale prints — drawer half is Slice 4), **8** (printer failure stays loud).

Test floor (per tasks.md line 297): ≥ 95% on the print pipeline; printer-failure loud-banner test; retry-success-treated-as-first-print test (FR-052).

**Second `[IMPECCABLE craft]` marker fires in this slice** (T290 — `<PrinterFailureBanner>`). The §4.2 ritual is the canonical procedure established in `s2-preflight.md §4.2`; S3d invokes it for the second time. Subsequent slices (S5 / S6) inherit the same ritual.

---

## 1. Gates blocking Slice 3

| Gate | What it gates within Slice 3 | Closed by |
|:--:|:--|:--|
| **§A0** | Upstream readiness + `/speckit-plan` v1.0 + `/speckit-analyze` | ✅ Cleared (PR #238) |
| **§A1** | Slice 0 visual direction. The `<PrinterFailureBanner>` craft (T290) requires `/impeccable shape=pass` recorded against sub-item (f) of T010 (persistent printer-failure banner). | T011 sign-off + shape brief sub-item (f) confirmed |
| **§A2** | Backend / OpenAPI — **no-op every 008 slice** (AD-12) | Documentation-only sign-off in T303 |
| **§A3** | Hardware-matrix entry: chosen thermal printer + ESC/POS library + transitive-dep audit + license review + driver version. **First Slice with a real hardware integration test** (T301 / T302 require a physical printer). | T200 / T201 / T202 record hardware-matrix.md entry; T301 / T302 hardware integration tests attended by the §A3 reviewer; cross-referenced in `coordination.md` (T303) |
| **§A4** | `receipts.retryPrint` bridge surface (1 new mutating handler; eight-item checklist from `contracts/bridge-api.md`). Note: `receipts.print` is internal-only (main-process), so it does NOT need §A4 review. | S3c sign-off (recorded in `coordination.md`) |
| **§A5** | Production-readiness — Slice 6 concern, **not blocking Slice 3** | Slice 6 T520–T528 |

**Wave-to-gate mapping:**

- **S3a** is gated on **§A3 hardware-matrix bring-up** (T200 records the chosen printer + driver in `docs/hardware-matrix.md`; T201/T202 register the library). T006 (hardware-matrix pair selection from Phase 1) must be closed before S3a can author T200. S3a is the **dependency-PR** — adds a production dep to `package.json` for the first time in the 008 arc.
- **S3b** is gated on **§A3 hardware-matrix entry being live in `hardware-matrix.md`** (S3a merged). S3b has no §A4 surface (the `receipts.print` internal handler doesn't expose to renderer).
- **S3c** is gated on **§A4** (`receipts.retryPrint` review). Draft PR allowed before §A4 reviewer assignment lands; merge blocks.
- **S3d** is gated on **§A1 craft** (T290 `/impeccable shape=pass` recorded against shape brief sub-item (f)) + **§A3 hardware integration tests** (T301 + T302 attended by the §A3 reviewer with a physical printer). S3d is the slice close-out.

**Slice 1 + Slice 2 dependencies:** Slice 3 reads Sale rows via Slice 1's repository (T081), renders payloads via Slice 2's template engine (T160) + payload module (T164). Slice 3 cannot start until Slice 2 closes (T182 functional sign-off).

---

## 2. Wave decomposition

### Wave overview

| Wave | Title | Tasks | ~Count | Sequential predecessor |
|:--:|:--|:--|:--:|:--|
| **S3a** | Hardware-matrix entry + ESC/POS library install + transitive-dep audit | T200 / T201 / T202 | 3 | Slice 2 closed; T006 hardware-matrix pair selected |
| **S3b** | ESC/POS adapter + OS-print fallback + path selection + first-print flow + audit emitter | T210 / T211 / T212 / T220 / T221 / T230 / T240 / T241 / T242 / T270 / T271 / T272 / T273 | 13 | S3a merged (library available + hardware-matrix entry live) |
| **S3c** | `receipts.retryPrint` bridge + types + idempotency | T250 / T251 / T252 / T253 / T280 / T281 | 6 | S3b merged |
| **S3d** | `<PrinterFailureBanner>` (second `[IMPECCABLE craft]`) + BannerHost wiring + Slice 3 close-out + hardware integration | T260 / T261 / T262 / T263 / T290 / T291 / T300 / T301 / T302 / T303 | 10 | S3c merged + Slice 0 §A1 sign-off |

**Total: 32 tasks across 4 sequential waves.** Within each wave, multiple T-numbers are `[P]` tagged in tasks.md and can run as parallel subagents — see "Parallel-execution opportunities" per wave below.

---

## 3. Wave S3a — Hardware-matrix entry + ESC/POS library install

**Branch:** `feat/008-s3a-hardware-and-library` off `main` (after Slice 2 closes; T006 hardware-matrix pair must be selected first).
**Gate cleared by this wave:** §A3 hardware-matrix entry recorded (T200); ESC/POS library committed (T201/T202).
**Single PR.**
**First and only Slice 3 wave that touches `package.json` + `package-lock.json`** — every other wave's forbidden-paths section names these files.

### 3.1 Task list (tasks.md T200–T202)

- [ ] **T200** [§A3] Record chosen thermal printer + cash-drawer model pair from T006 (vendor, model, driver version, caveats) in `docs/hardware-matrix.md` under "008 §A3 bring-up — IN PROGRESS" — `docs/hardware-matrix.md`
- [ ] **T201** [§A3] Pick the ESC/POS library: confirm `node-thermal-printer` (or equivalent) as the chosen library; record the choice + transitive-dependency audit + license review in `coordination.md` — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T202** [§A3] Add the chosen ESC/POS library to `package.json` (production dep); `npm install`; commit `package-lock.json` change — `package.json` + `package-lock.json`

### 3.2 Parallel-execution opportunities

None — T200 / T201 / T202 are strictly sequential within this small wave:

- T200 records the hardware target FIRST so T201's library choice can be validated against the target printer's capabilities.
- T201 records the library choice (with transitive-dep audit + license review) BEFORE the install commit.
- T202 lands the actual `package.json` + lockfile change.

**Recommended dispatch:** T200 → T201 → T202. Single agent, three sequential commits in one PR (or one squashed commit if reviewer prefers).

### 3.3 Forbidden paths (S3a)

`migrations/**`, `src/**`, `tests/**`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S3a touches **only** `docs/hardware-matrix.md`, `specs/008-sale-finalization-and-receipts/coordination.md`, `package.json`, and `package-lock.json`. Every subsequent Slice 3 wave (S3b / S3c / S3d) forbids `package.json` + `package-lock.json` — S3a is the **only** wave that may modify them.

### 3.4 Acceptance + close-out

- [ ] T006 closed in `coordination.md` (the hardware-matrix pair the team committed to) — S3a inherits that decision; do NOT re-open or re-select within this wave.
- [ ] `docs/hardware-matrix.md` has a new row under "008 §A3 bring-up — IN PROGRESS" with vendor / model / driver version / caveats / transport (USB or serial).
- [ ] `coordination.md` records the ESC/POS library choice + transitive-dependency audit (every direct + transitive dep enumerated) + license review (every license verified compatible with the repo's existing license posture).
- [ ] `package.json` has the chosen ESC/POS library in `dependencies` (NOT `devDependencies`).
- [ ] `package-lock.json` regenerated cleanly; CI lockfile-determinism check passes.
- [ ] **§A3 reviewer signs off** the hardware-matrix entry; reviewer must be the §A3 owner assigned in Phase 1 (T003). Sign-off recorded in `coordination.md`.
- [ ] **No code** in this wave. No tests added. No `src/**` changes. The implementing agent must surface any attempt to add code as a preflight violation and roll back.

---

## 4. Wave S3b — ESC/POS adapter + OS-print fallback + first-print pipeline

**Branch:** `feat/008-s3b-print-pipeline` off `main` (after S3a merges).
**Gate cleared by this wave:** none directly. The largest Slice 3 wave: 13 tasks covering both transport paths + the auto-firing first-print flow.
**Single PR.**

### 4.1 Task list (tasks.md T210–T273 subset)

**Path-selection tests:**

- [ ] **T210** [P] [US1] Path-selection test (failing) — `tests/unit/main/receipts/print-pipeline.path-selection.test.ts`
- [ ] **T211** [P] [US1] Both-paths byte-stability test (failing) — `tests/unit/main/receipts/print-pipeline.both-paths-byte-stable.test.ts`
- [ ] **T212** [P] [US1] Path-opaque-to-cashier test (failing) — `tests/unit/main/receipts/print-pipeline.path-opaque-to-cashier.test.ts`

**ESC/POS adapter tests:**

- [ ] **T220** [P] [US1] Status-handling test (failing) — `tests/unit/main/receipts/escpos-adapter.status-handling.test.ts`
- [ ] **T221** [P] [US1] Timeout test (failing) — `tests/unit/main/receipts/escpos-adapter.timeout.test.ts`

**OS-print fallback test:**

- [ ] **T230** [P] [US1] OS-print fallback test (failing) — `tests/unit/main/receipts/print-pipeline.os-print-fallback.test.ts`

**First-print flow + audit tests:**

- [ ] **T240** [P] [US1] Auto-fires-on-finalize test (failing) — `tests/integration/sales/print-pipeline.auto-fires-on-finalize.test.ts`
- [ ] **T241** [P] [US1] Failure-keeps-sale-durable test (failing) — `tests/integration/sales/print-pipeline.failure-keeps-sale-durable.test.ts`
- [ ] **T242** [P] [US1] Payload-not-logged test (failing) — `tests/unit/main/receipts/print-pipeline.payload-not-logged.test.ts`

**Implementation:**

- [ ] **T270** [US1] ESC/POS adapter wrapper — `src/main/receipts/escpos-adapter.ts`
- [ ] **T271** [P] [US1] OS-print fallback wrapper — `src/main/receipts/os-print-adapter.ts`
- [ ] **T272** [US1] Print pipeline module — `src/main/receipts/print-pipeline.ts`
- [ ] **T273** [US1] Wire print pipeline into AD-2 finalize completion — `src/main/sales/finalize-listener.ts`

### 4.2 Parallel-execution opportunities

T210 / T211 / T212 / T220 / T221 / T230 / T240 / T241 / T242 are all `[P]` — nine `[P]` test tasks. T271 is `[P]` — independent OS-print wrapper.

**Recommended dispatch:** Test batch (9 subagents in parallel) → (T270 ∥ T271 in parallel — 2 subagents) → T272 → T273.

T273 is the load-bearing wire-up — it touches `src/main/sales/finalize-listener.ts` which was authored in Slice 1 (S1c). The wire is **additive**: after the existing AD-2 finalize emits `sale.finalized`, dispatch `print-pipeline.print()` asynchronously. The Sale row commit is unchanged; the print is fire-and-forget from the transaction's perspective.

### 4.3 Forbidden paths (S3b)

`migrations/**`, `src/renderer/**` (S3d territory), `src/preload/**` (S3c territory), `src/shared/**` (S3c may extend bridge-api.ts; S3b must not modify it), `package.json`, `package-lock.json` (S3a territory; locked after S3a merges), `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S3b touches **only** `src/main/receipts/**` (except `receipts-bridge.ts` which is S3c territory for the retry handler — S3b may NOT touch it), `src/main/sales/finalize-listener.ts` (additive wire-up of T273), and the corresponding test files.

### 4.4 Acceptance + close-out

- [ ] All nine test tasks (T210–T242) pass. Initial RED bar verified before implementation; final GREEN bar verified after.
- [ ] T270 ESC/POS adapter: write byte stream + poll status byte; success on "ok"; typed failure on `printer_offline` / `printer_out_of_paper` / `printer_jam` / `escpos_status_unknown` (T221 timeout maps to `escpos_status_unknown`).
- [ ] T271 OS-print adapter: callback-to-promise wrapper around `webContents.print`; success / typed failure (`os_print_error`) result.
- [ ] T272 print pipeline: path selection on printer status byte; dispatches via ESC/POS preferred, OS-print fallback; INSERTs `print_events` row with `render_path` ∈ {`escpos`, `os_print`}; emits `sale.receipt.printed` audit event on success; emits `sale.receipt.print_failed` audit event with `failure_reason` enum on failure.
- [ ] T273 wire-up: AFTER `sale.finalized` audit emit in finalize-listener.ts, dispatch `printPipeline.print({ sale_id, purpose: 'first_print' })` asynchronously. **The Sale row stays durable regardless of print outcome (T241 invariant).**
- [ ] T242 invariant: full payload (HTML or ESC/POS bytes) appears in NO pino log, NO Sentry event, NO audit-event row, NO support bundle. Constitution §P11. Defence-in-depth: payload-not-logged test asserts grep-zero across the standard output channels.
- [ ] Vitest `tests/unit/main/receipts/` + `tests/integration/sales/print-pipeline*` all green; per-module coverage ≥ 95% on the pipeline + adapters.
- [ ] **No `[IMPECCABLE]` marker fires in S3b.** S3b has zero renderer code. T290 is S3d territory.

---

## 5. Wave S3c — `receipts.retryPrint` bridge + idempotency

**Branch:** `feat/008-s3c-retry-print-bridge` off `main` (after S3b merges).
**Gate cleared by this wave:** §A4 (`receipts.retryPrint` review).
**Single PR.**

### 5.1 Task list (tasks.md T250–T281)

**Retry-print tests:**

- [ ] **T250** [P] [US1] Retry success test (failing) — `tests/unit/main/receipts/bridge.receipts-retry-print.success.test.ts`
- [ ] **T251** [P] [US1] Retry-treated-as-first-print test (failing) — `tests/unit/main/receipts/bridge.receipts-retry-print.first-print-semantics.test.ts`
- [ ] **T252** [P] [US1] Still-failed retry test (failing) — `tests/unit/main/receipts/bridge.receipts-retry-print.still-failed.test.ts`
- [ ] **T253** [P] [US1] Idempotency replay test (failing) — `tests/unit/main/receipts/bridge.receipts-retry-print.idempotent.test.ts`

**Implementation:**

- [ ] **T280** [US1] `receipts.retryPrint` bridge handler — `src/main/receipts/receipts-bridge.ts`
- [ ] **T281** [US1] Extend `src/shared/bridge-api.ts` with `receipts.retryPrint` types — `src/shared/bridge-api.ts`

### 5.2 Parallel-execution opportunities

T250 / T251 / T252 / T253 are all `[P]` — four retry-test subagents in parallel. T281 must come before T280 (the bridge handler references the new types). T281 is a small incremental extension to bridge-api.ts authored in Slice 1.

**Recommended dispatch:** (T250 ∥ T251 ∥ T252 ∥ T253 in parallel — 4 subagents) → T281 → T280.

### 5.3 Forbidden paths (S3c)

`migrations/**`, `src/main/sales/**` (Slice 1 territory; S3c reads from sales repositories but does not modify them), `src/main/receipts/print-pipeline.ts` / `escpos-adapter.ts` / `os-print-adapter.ts` (S3b territory; S3c may import them but must not modify), `src/main/receipts/templates/**` (Slice 2 territory), `src/renderer/**`, `src/preload/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S3c touches **only** `src/main/receipts/receipts-bridge.ts` (extends the existing handler module from Slice 2 with the new `retryPrint` method), `src/shared/bridge-api.ts` (incremental extension), and the four test files under `tests/unit/main/receipts/bridge.receipts-retry-print.*`.

### 5.4 Acceptance + close-out

- [ ] All four retry tests (T250 / T251 / T252 / T253) pass.
- [ ] T280 handler: gated on `requireOperatorSession`; tenant-isolation-scoped; takes `{ sale_id, idempotency_key }`; re-runs print pipeline via T272; INSERTs `print_events` row with `purpose='retry_after_failure'`, `outcome` ∈ {success, failure}, `previous_failed_print_event_ids=[<prior failed row IDs>]`.
- [ ] T251 invariant: a retry that **succeeds** is treated as the canonical first print (FR-052). No `duplicate_copy_sequence_number` written; drawer-kick eligibility flag is set for Slice 4's drawer-kick gating. The audit event is `sale.receipt.print_retried_success` (not `sale.receipt.printed` and not `sale.receipt.reprinted`).
- [ ] T252 invariant: a retry that **still fails** returns `{ kind: 'ok', preview: { outcome: 'failure', failure_reason: ... } }` (NOT `{ kind: 'refused', reason: ... }`). The retry attempt itself succeeded; the print failed. Path C in `quickstart.md §"Path C"`.
- [ ] T253 invariant: identical-payload `receipts.retryPrint` is a no-op returning the original outcome (idempotent replay). Payload-mismatch refuses with `idempotency_payload_mismatch` per Constitution §P5.
- [ ] T281 extension: `BridgeApi['receipts']['retryPrint']` type added incrementally to `src/shared/bridge-api.ts`. Compile-time assertion via the contract test framework set up in Slice 1.
- [ ] **§A4 reviewer signs off** `receipts.retryPrint` against the eight-item checklist in `contracts/bridge-api.md §"§A4 security-review checklist"`. Sign-off recorded in `coordination.md`.
- [ ] **No `[IMPECCABLE]` marker fires in S3c.** S3c has zero renderer code.

---

## 6. Wave S3d — `<PrinterFailureBanner>` + BannerHost + Slice 3 close-out

**Branch:** `feat/008-s3d-printer-failure-banner` off `main` (after S3c merges).
**Gate cleared by this wave:** §A1 craft via T290 (the `/impeccable shape=pass` event covering shape brief sub-item (f) — persistent printer-failure banner); §A3 hardware integration tests (T301 + T302 attended by §A3 reviewer); Slice 3 functional close-out (T303).
**Single PR.**
**Second `[IMPECCABLE craft]` marker invocation in 008** (T290). Apply the §4.2 ritual from `s2-preflight.md §4.2` — the canonical procedure established by S2b's T173 invocation.

### 6.1 Task list (tasks.md T260–T303)

**`<PrinterFailureBanner>` tests (the red-bar set for T290's craft marker):**

- [ ] **T260** [P] [US1] Persistence test (failing) — `tests/unit/renderer/receipts/PrinterFailureBanner.persistence.test.tsx`
- [ ] **T261** [P] [US1] Subscription test (failing) — `tests/unit/renderer/receipts/PrinterFailureBanner.subscription.test.tsx`
- [ ] **T262** [P] [US1] Affordance-gating test (failing) — `tests/unit/renderer/receipts/PrinterFailureBanner.affordance-gating.test.tsx`
- [ ] **T263** [P] [US1] Accessibility test (failing) — `tests/unit/renderer/receipts/PrinterFailureBanner.a11y.test.tsx`

**Implementation:**

- [ ] **T290** [US1] [IMPECCABLE craft] `<PrinterFailureBanner>` component — `src/renderer/ui/receipts/PrinterFailureBanner.tsx`
- [ ] **T291** [P] [US1] Wire banner into BannerHost — `src/renderer/ui/banners/BannerHost.tsx`

**Slice 3 verification + close-out:**

- [ ] **T300** Vitest coverage assertion across the full Slice 3 module set — `tests/`
- [ ] **T301** [§A3] Hardware integration test (success path): real printer attached; 006 settlement → 008 finalize → receipt prints — `docs/hardware-matrix.md`
- [ ] **T302** [§A3] Hardware integration test (failure path): printer disconnected; 006 settlement → 008 finalize → banner persists, Sale durable, retry succeeds when printer reconnects, no duplicate-copy marker (FR-052) — `docs/hardware-matrix.md`
- [ ] **T303** Slice 3 functional sign-off + per-module coverage + §A3 hardware-matrix entry cross-reference — `specs/008-sale-finalization-and-receipts/coordination.md`

### 6.2 The second `[IMPECCABLE craft]` invocation (T290) — apply §4.2 ritual

T290 is the second time the activation contract from `docs/impeccable-embed-preflight.md` executes. The canonical four-step ritual is documented in `s2-preflight.md §4.2`. Apply it verbatim, with these slice-specific bindings:

- **Step 1 — Confirm Slice 0 §A1 sign-off + `/impeccable shape=pass`:** verify that the §A1 reviewer signed off shape-brief sub-item **(f)** (persistent printer-failure banner, non-modal, no auto-dismiss, three affordances ≥ 44×44 px). If `shape=pass` is recorded for the shape brief in general (sub-items d/e/f/g together) but the sub-item (f) details have shifted since Slice 2's T173 fired, escalate to the §A1 reviewer for a sub-item refresh before proceeding.
- **Step 2 — Red-bar check** (embed preflight §4.2): run the four failing tests locally and confirm RED:

  ```bash
  npm test -- --run tests/unit/renderer/receipts/PrinterFailureBanner.persistence.test.tsx \
                tests/unit/renderer/receipts/PrinterFailureBanner.subscription.test.tsx \
                tests/unit/renderer/receipts/PrinterFailureBanner.affordance-gating.test.tsx \
                tests/unit/renderer/receipts/PrinterFailureBanner.a11y.test.tsx
  ```

  Record the RED confirmation + exit code in `coordination.md` under T290 before `/impeccable craft` fires. A craft marker invoked against GREEN tests is a preflight violation.
- **Step 3 — Invoke `/impeccable craft 008-printer-failure-banner`:** per the marker on T290. The skill operates against `docs/DESIGN.md` and the §A1 shape brief. Implementation lives at `src/renderer/ui/receipts/PrinterFailureBanner.tsx`. The component:
  - Subscribes to `sales.subscribe(topic='banner_state')` (Slice 1's subscription mechanism from T072 / T102).
  - Mounts whenever the latest `print_events` row for a recently finalized sale has `outcome='failure'`.
  - Renders three affordances: **Retry print** (invokes `receipts.retryPrint` from S3c with a fresh idempotency key), **Reprint** (disabled until a successful print exists; Slice 5 wires the actual reprint flow), **Manual receipt override** (Slice 6 wires the actual handler).
  - **Does not auto-dismiss** — banner stays until the printer-failure condition resolves.
  - All controls are ≥ 44 × 44 CSS pixels.
  - Banner has screen-reader landmark + focus management lands on the banner when it first mounts.
- **Step 4 — Post-craft constitution checklist** (embed preflight §7): run the nine-item checklist:
  - [ ] No floats for money. (Banner does not display money directly; if it surfaces a failed-print sale's `total_minor`, formatter is the only legal source.)
  - [ ] No copy-paste from `_reference/Data-Pulse/`. Re-derived only.
  - [ ] RTL default. Component works in `dir="rtl"`; the three affordance buttons mirror correctly.
  - [ ] 44×44 invariant. CI invariant test catches; embedder verifies locally first.
  - [ ] **No optimistic UI past durable commit.** PRODUCT.md Principle 1 — Honest surfaces. The banner is the **canonical** "failure is loud" surface (PRODUCT.md Principle 3). Retry button does NOT optimistically dismiss the banner; banner stays until the next `print_events` row's `outcome` resolves the failure state.
  - [ ] No PII / card data in logs. The banner's three affordance click handlers MUST NOT log the sale's payload; they invoke bridge handlers which already log per the audit emitter discipline.
  - [ ] Preload bridge only. No direct `ipcRenderer` access.
  - [ ] Reduced-motion respected. Any animation wraps `prefers-reduced-motion: reduce`.
  - [ ] Axe-core clean. Embedder runs `npx axe` locally before marking T290 complete.

  Failing any item = T290 NOT marked complete. Open a fixup commit before moving on.

### 6.3 Parallel-execution opportunities

T260 / T261 / T262 / T263 are all `[P]` — four banner-test subagents in parallel (the red-bar set). T291 is `[P]` — independent BannerHost wire-up.

**Recommended dispatch:** (T260 ∥ T261 ∥ T262 ∥ T263 in parallel — 4 subagents authoring tests) → §6.2 ritual → T290 craft → T291 wire-up → T300 → T301 (hardware) → T302 (hardware) → T303.

### 6.4 Hardware integration tests (T301 + T302) — §A3-reviewer-attended

T301 and T302 require a **physical thermal printer** attached to the test machine. A CI-only agent CANNOT run these tests; they are §A3-reviewer-attended smoke tests recorded in `docs/hardware-matrix.md`.

**T301 (success path):** real printer attached + paper loaded. Drive a 006 cash settlement → 008 finalize → assert: receipt prints (visual confirmation by reviewer); `print_events` row INSERTed with `outcome='success'`, `render_path='escpos'` (or `os_print` if the chosen printer doesn't expose status); `sale.receipt.printed` audit event present. Record the printer model + driver version + observation notes in `docs/hardware-matrix.md` under the chosen pair's test row.

**T302 (failure path):** printer disconnected at finalize time. Drive a 006 cash settlement → 008 finalize → assert: `<PrinterFailureBanner>` mounts (visual confirmation); Sale row durable; reconnect printer; click Retry print; assert: retry succeeds, **no duplicate-copy marker** on the retried slip (FR-052), banner dismisses on the new `outcome='success'` `print_events` row. Record observation notes alongside T301's entry.

If either T301 or T302 fails empirically (the test produces a different result from the expected one), STOP and escalate to the §A3 reviewer before marking the wave complete. A failed hardware integration test means either (a) the chosen printer + library combination is incompatible (re-open T201 / T202), (b) the print pipeline has a regression (re-open S3b), or (c) the test expectation is wrong (re-spec). Do NOT silently work around a hardware failure.

### 6.5 Forbidden paths (S3d)

`migrations/**`, `src/main/sales/**`, `src/main/receipts/print-pipeline.ts` / `escpos-adapter.ts` / `os-print-adapter.ts` / `receipts-bridge.ts` (S3b / S3c territories; S3d may import them but must not modify), `src/main/receipts/templates/**` (Slice 2 territory), `src/shared/**` (S3c territory for the type extension; S3d should not need to extend further), `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S3d touches **only** `src/renderer/ui/receipts/PrinterFailureBanner.tsx`, `src/renderer/ui/banners/BannerHost.tsx` (additive wire-up of T291), and the four banner test files under `tests/unit/renderer/receipts/PrinterFailureBanner.*`. Updates to `coordination.md` are permitted (T300 / T303). Updates to `docs/hardware-matrix.md` are permitted (T301 / T302).

### 6.6 Acceptance + close-out

- [ ] All four banner tests (T260 / T261 / T262 / T263) pass per the red-bar / craft / green-bar sequence.
- [ ] T290 `<PrinterFailureBanner>` ships per §6.2 ritual (red-bar confirmed in `coordination.md`; `/impeccable craft 008-printer-failure-banner` invoked; post-craft constitution checklist all green).
- [ ] T291 wires the banner into `src/renderer/ui/banners/BannerHost.tsx` per the 003 + 007 banner-host pattern; banner layers ABOVE connection-state / operator-session banners per NFR-008.
- [ ] T300 coverage assertion: ≥ 95% on print pipeline + adapter + retry handler (carry-over from S3b + S3c); ≥ 90% on `<PrinterFailureBanner>`.
- [ ] **T301 hardware integration (success)** attended by §A3 reviewer; observation notes recorded in `docs/hardware-matrix.md`.
- [ ] **T302 hardware integration (failure-then-retry)** attended by §A3 reviewer; observation notes recorded in `docs/hardware-matrix.md`; FR-052 invariant (no duplicate-copy marker on retried slip) visually verified.
- [ ] T303 records Slice 3 functional sign-off in `coordination.md`; §A2 no-op confirmed; §A3 + §A4 sign-offs cross-referenced; per-module coverage numbers recorded.
- [ ] **Slice 3 closes.** Slice 4 (drawer-kick + drawer-failure banner) becomes startable.

---

## 7. Cross-wave invariants

These rules apply to every wave (S3a / S3b / S3c / S3d). Violation = preflight violation; wave is rejected.

### 7.1 Constitution compliance (every wave)

- **No floats for money.** Slice 3 surfaces money only via the template engine (Slice 2's territory); no new money paths introduced.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** preserved on every BrowserWindow. S3d adds renderer code that MUST respect these.
- **No upward-of-bridge IPC.** S3d's renderer reaches main exclusively through `receipts.retryPrint` (S3c) + `sales.subscribe` (Slice 1). No direct `ipcRenderer`.
- **No copy-paste from `_reference/Data-Pulse/`.** Constitution §P8.
- **PII / cards never in logs.** Constitution §P11. T242 invariant locks payload-not-logged across pino / Sentry / audit / support bundle.
- **Test-first.** Every implementation T-number is preceded by its failing-test T-number.
- **No new BrowserWindow** introduced in Slice 3. The print pipeline runs in the main process; the banner mounts in the existing renderer window.

### 7.2 TDD ordering (every wave)

Within each wave, the order is: failing-test task → implementation task → green-bar verification. The implementing agent runs `npm test -- --run <test-file-pattern>` against the wave's test files **after** authoring the test, confirms RED, then implements until the test goes GREEN.

For T290 specifically, the §6.2 ritual is binding — the RED confirmation is recorded in `coordination.md` before `/impeccable craft` fires.

### 7.3 Forbidden-path enforcement (every wave)

Each wave's "Forbidden paths" section (§3.3 / §4.3 / §5.3 / §6.5) is binding. Pre-merge check: `git diff --name-only main...HEAD` against the wave's allow-list. Anything outside the allow-list is a preflight violation and must be removed before merge.

**Slice-3-specific forbidden-path rule:** S3a is the ONLY wave that may modify `package.json` + `package-lock.json`. S3b / S3c / S3d all forbid these files. If a later wave finds it needs a new dependency, it MUST open a separate dependency-PR (a new "S3a-prime") before opening the wave PR.

### 7.4 Embed marker enforcement (this slice)

Slice 3 contains **one** `[IMPECCABLE craft]` marker (T290). All other Slice 3 tasks are non-marker. Any `/impeccable` invocation outside T290's craft is a preflight violation. The §6.2 ritual (apply §4.2 from `s2-preflight.md`) is the **only** legal invocation path in Slice 3.

### 7.5 Hardware integration tests (this slice)

T301 + T302 are §A3-reviewer-attended hardware smoke tests. They are NOT runnable in CI (no physical printer attached to GitHub Actions `windows-latest`). The §A3 reviewer attends T301 + T302 and records observation notes in `docs/hardware-matrix.md`. Subsequent slices (Slice 4 drawer integration, Slice 6 §A5 perf-budget timing) will have similar reviewer-attended tests; Slice 3 establishes the pattern.

### 7.6 Coordination updates

Each wave's close-out updates `coordination.md`:

- S3a: §A3 hardware-matrix entry recorded; library choice + transitive-dep audit + license review recorded; T200 / T201 / T202 close-out.
- S3b: no coordination update during the wave itself.
- S3c: §A4 `receipts.retryPrint` sign-off recorded.
- S3d: T290 red-bar confirmation recorded; T290 post-craft constitution checklist recorded; T301 + T302 hardware observation notes (in `hardware-matrix.md`; cross-referenced in `coordination.md`); Slice 3 functional sign-off (T303) recorded; §A2 no-op confirmed; §A3 + §A4 sign-offs cross-referenced.

---

## 8. Risk register

| Risk | Severity | Mitigation |
|:--|:--:|:--|
| T006 hardware-matrix pair not selected by S3a authoring time | HIGH | S3a is blocked on T006 closing. Open `coordination.md` follow-up (Phase 1 carry-over). If T006 is still `[NEEDS ASSIGNMENT]` when S3a is targeted, stop and assign first; do NOT pick a default. |
| §A3 reviewer not assigned by S3a authoring time | HIGH | S3a's hardware-matrix entry (T200) requires §A3 reviewer sign-off. Open follow-up. Draft PR may open with `[NEEDS ASSIGNMENT]`; merge blocks. |
| §A4 reviewer not assigned by S3c authoring time | HIGH | Same pattern as Slice 2. Draft PR allowed; merge blocks on §A4 sign-off. |
| Chosen ESC/POS library has a deprecated transitive dep or incompatible license | MEDIUM | T201 transitive-dep audit + license review is a hard step. If a problem is found, halt S3a and revisit the library choice (recommend `node-thermal-printer` or `escpos`; both reviewed by 006 / 007 / earlier specs — confirm again at audit time). |
| Slice 0 §A1 sub-item (f) shifted between Slice 2 (T173) and Slice 3 (T290) sign-off events | MEDIUM | §6.2 Step 1 escalation: if the shape-brief sub-item details have shifted since T173 fired, the §A1 reviewer refreshes sub-item (f) before T290 can fire. Don't silently re-use a stale shape brief. |
| T273 wire-up regresses Slice 1's AD-2 finalize transaction | HIGH | T273 is **additive** — the print dispatch happens AFTER the existing AD-2 atomic commit. The Sale row commit path is untouched. T241 integration test asserts the Sale stays durable across all printer-failure paths. Code review must verify no synchronous coupling between finalize transaction and print dispatch. |
| Hardware integration test (T301 / T302) fails empirically | HIGH | Stop and escalate to §A3 reviewer. Do not silently work around. Possible root causes: incompatible printer + library, regression in S3b pipeline, or wrong test expectation. Re-open S3a / S3b / re-spec as appropriate. |
| Banner mount race when finalize and print resolve in the same tick | MEDIUM | The banner subscribes via `sales.subscribe(topic='banner_state')` — Slice 1's subscription delivers `latest_print_event` updates. The subscription is event-driven, not polling, so race is impossible by construction. T261 subscription test locks the contract. |
| Retry-print idempotency replay drift | MEDIUM | T253 explicit test: identical-payload replay → no-op returning original outcome; payload-mismatch → `idempotency_payload_mismatch` per Constitution §P5. The handler MUST use the request's `idempotency_key` as the cache key with the request body hash as the payload check. |
| Second `/impeccable craft` invocation drifts from the canonical §4.2 ritual | MEDIUM | §6.2 binds the ritual explicitly with slice-specific bindings (sub-item (f) for shape=pass, the four PrinterFailureBanner test files for red-bar, the nine-item post-craft checklist). Embedder follows the procedure literally; deviation is a preflight violation. |

---

## 8b. Comparison to s2-preflight.md (second-marker invocation differences)

Slice 3's T290 is the second `[IMPECCABLE craft]` after Slice 2's T173. Worth noting what's the **same** and what's **slice-specific**:

**Same as S2 T173:**

- Four-step ritual (Step 1 confirm sign-off → Step 2 red-bar → Step 3 craft → Step 4 post-craft checklist).
- Post-craft constitution checklist has the same nine items (no floats for money / no `_reference` copy / RTL / 44×44 / no optimistic UI / no PII in logs / no bridge-API call outside the typed preload bridge / reduced-motion / axe-core clean).
- `coordination.md` records both red-bar confirmation and post-craft checklist completion.

**Slice-specific in S3 T290:**

- §A1 sub-item (f) (printer-failure banner) is the sub-brief covered by `shape=pass`, not sub-item (d) (preview panel) which was Slice 2's binding.
- Red-bar test set is four files (T260 / T261 / T262 / T263) vs Slice 2's three (T150 / T151 / T152).
- Component invokes `receipts.retryPrint` (S3c) + subscribes to `sales.subscribe(topic='banner_state')` (Slice 1) — Slice 2's T173 invoked `receipts.preview` only.
- Banner is the **canonical "failure is loud" surface** per PRODUCT.md Principle 3. The "no optimistic UI past durable commit" post-craft check has a different load-bearing meaning here: the banner does NOT optimistically dismiss on retry click; it dismisses only when a new `print_events` row's `outcome` resolves the failure state.

The §4.2 ritual is the canonical procedure. Subsequent slice preflights (S5 / S6) cite this same procedure with slice-specific bindings.

---

## 9. Open coordination follow-ups (before Slice 3 can start)

These items are pre-Slice-3 work; they don't block authoring this preflight but DO block S3a's first commit (T006), S3b's first commit (S3a merged), S3c's merge (§A4), or S3d's close-out (Slice 0 §A1 + §A3 hardware integration):

- [ ] **Slice 2 closed.** S3a cannot start until T182 functional sign-off lands. Slice 3 reads `sales` rows via Slice 1's repositories and renders payloads via Slice 2's template engine.
- [ ] **T006 hardware-matrix pair selected** (`coordination.md` §"§A3 hardware-matrix coordination thread"). Currently `[NEEDS ASSIGNMENT]`. S3a is blocked on T006.
- [ ] **§A3 reviewer assigned** (`coordination.md` §A3 thread). S3a merge blocks; also attends T301 / T302 hardware integration tests in S3d.
- [ ] **§A4 reviewer assigned** for `receipts.retryPrint` (`coordination.md` §A4 thread; likely same reviewer as the `sales.*` / `receipts.preview` reviews).
- [ ] **Slice 0 §A1 sign-off** (T010 + T011). Required for T290 craft via the §6.2 Step 1 confirmation.
- [ ] **Ahmed §A1 acceptance** (preflight #241 §9 box). Still unticked from the activation PR.
- [ ] **T002 feature-flag PR** merged. Slice 3's renderer surfaces (the banner) gate on the `sale_finalization` flag.

---

## 10. Preflight metadata

**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Tasks:** [../tasks.md](../tasks.md) (Phase 5 — Slice 3)
**Coordination:** [../coordination.md](../coordination.md)
**Data model:** [../data-model.md](../data-model.md)
**Bridge contract:** [../contracts/bridge-api.md](../contracts/bridge-api.md)
**Hardware matrix:** [../../../docs/hardware-matrix.md](../../../docs/hardware-matrix.md)
**Research:** [../research.md](../research.md) §R-4 (dual-path byte-stability) · §R-6 (template engine reuse) · §R-15 (recovery scan)
**Embed preflight (cross-feature):** [../../../docs/impeccable-embed-preflight.md](../../../docs/impeccable-embed-preflight.md)
**Slice 1 preflight (predecessor):** [./s1-preflight.md](./s1-preflight.md)
**Slice 2 preflight (predecessor; canonical `/impeccable craft` ritual at §4.2):** [./s2-preflight.md](./s2-preflight.md)
**Constitution version pinned:** v1.5.1
**Authored:** 2026-05-26
**Owner:** Slice 3 implementing agent (single agent or subagent fleet); §A3 reviewer for S3a sign-off + S3d hardware integration; §A4 reviewer for S3c sign-off; §A1 reviewer for T290 `/impeccable shape=pass` carry-over from Slice 0; Ahmed for Slice 3 functional sign-off (T303).

---

**End of Slice 3 preflight. S4 / S5 / S6 preflights to follow at slice-commission time.**
