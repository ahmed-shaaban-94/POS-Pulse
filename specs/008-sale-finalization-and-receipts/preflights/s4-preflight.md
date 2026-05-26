# 008 Slice 4 Preflight — Drawer-kick + drawer-failure banner + drawer audit

> **For agentic workers:** This preflight is the per-wave implementation plan for Slice 4 of 008-sale-finalization-and-receipts. Slice 4 ships in **two sequential waves** (S4a → S4b). Each wave is **one PR**. Each wave has a strict file allow-list; touching anything outside is a preflight violation.
>
> **Source of truth (in priority order):**
>
> 1. `specs/008-sale-finalization-and-receipts/tasks.md` — canonical T-numbers + per-task acceptance criteria
> 2. `specs/008-sale-finalization-and-receipts/coordination.md` — live gate ledger + sign-off records
> 3. `specs/008-sale-finalization-and-receipts/contracts/bridge-api.md` — confirms `drawer.*` is main-only (no renderer-callable surface)
> 4. `docs/hardware-matrix.md` — Slice 3 §A3 entry must already exist; Slice 4 adds the drawer-specific rows
> 5. `specs/008-sale-finalization-and-receipts/research.md` §R-5 (double-kick suppression) + §R-8 (drawer-kick mechanism)
> 6. `docs/impeccable-embed-preflight.md` — Slice 4 fires the **third** `[IMPECCABLE craft]` marker (T360); §6.2 ritual carries forward from `s2-preflight.md §4.2` (canonical) via `s3-preflight.md §6.2` (slice-specific bindings)
>
> **This preflight does NOT replace tasks.md.** When this preflight and tasks.md disagree, tasks.md wins.

---

## 0. Slice 4 in one paragraph

Slice 4 implements the separate-command drawer-kick (AD-8 — ESC/POS DK1/DK2 pulse, distinct from the receipt byte stream); gating logic (FR-040: only first print + cash-inclusive sale + print-success ack); double-kick suppression via the UNIQUE constraint on `drawer_events.sale_id` from Slice 1 (FR-053); `drawer_events` row INSERT on opened / suppressed / failed; `sale.drawer.*` audit-event emission (3 categories: opened / suppressed / failed); the persistent `<DrawerFailureBanner>` renderer component with **only a manual-override affordance** (no retry-kick — per quickstart §Path D, retry-kick would violate FR-053 or lack an audit anchor); and BannerHost stacking with the printer-failure banner (printer-failure on top, drawer-failure below). **No new renderer-callable bridge surface** — confirms AD-5's "`drawer.*` remains main-only" rule.

User stories covered: US1 scenarios **4** (drawer opens on cash-inclusive first print), **5** (drawer does NOT open on cashless), **9** (drawer failure doesn't invalidate sale).

Test floor (per tasks.md line 371): ≥ 95% on drawer-kick logic; cashless no-kick test; reprint no-kick test; double-kick suppression test; drawer-failure banner test.

**Third `[IMPECCABLE craft]` marker fires in this slice** (T360 — `<DrawerFailureBanner>`). Apply the canonical §4.2 ritual from `s2-preflight.md`; S3 preflight §6.2 established the pattern for second invocation; S4 inherits the same pattern with slice-specific bindings documented in §5.2 below.

---

## 1. Gates blocking Slice 4

| Gate | What it gates within Slice 4 | Closed by |
|:--:|:--|:--|
| **§A0** | Upstream readiness | ✅ Cleared (PR #238) |
| **§A1** | Slice 0 visual direction. The `<DrawerFailureBanner>` craft (T360) requires `/impeccable shape=pass` recorded against sub-item **(g)** of T010 (persistent drawer-failure manual-override banner). | T011 sign-off + shape brief sub-item (g) confirmed |
| **§A2** | Backend / OpenAPI — **no-op every 008 slice** (AD-12) | Documentation-only sign-off in T374 |
| **§A3** | Drawer hardware bring-up: Slice 3 already recorded the printer+drawer pair in `docs/hardware-matrix.md`. Slice 4 adds the drawer-specific integration test rows (T371 / T372 / T373) attended by the §A3 reviewer. | T371 / T372 / T373 hardware tests attended; rows recorded in `hardware-matrix.md`; cross-referenced in `coordination.md` (T374) |
| **§A4** | **NO new renderer-callable bridge surface** in Slice 4. AD-5 locks `drawer.*` as main-only. §A4 review confirms no `drawer.*` handler exposed to renderer (documentation-only check). | S4a + S4b code review confirms no `src/preload/drawer.ts` exists; no `BridgeApi['drawer']` extension in `src/shared/bridge-api.ts`. Recorded in `coordination.md` at T374. |
| **§A5** | Production-readiness — Slice 6 concern, not blocking Slice 4 | Slice 6 T520–T528 |

**Wave-to-gate mapping:**

- **S4a** is gated on **Slice 3 closed** (T303 functional sign-off; print pipeline exists for the drawer-kick to chain after). S4a has no §A4 surface (drawer is main-only, no bridge handler).
- **S4b** is gated on **§A1 craft** (T360 `/impeccable shape=pass` recorded against shape-brief sub-item (g)) + **§A3 hardware integration tests** (T371 + T372 + T373 attended by the §A3 reviewer with a physical printer + drawer pair). S4b is the slice close-out.

**Slice 3 dependency:** Slice 4 chains the drawer-kick AFTER Slice 3's first-print success ack (T352 wires into `src/main/receipts/print-pipeline.ts`). Slice 4 cannot start until Slice 3 closes (T303 functional sign-off).

---

## 2. Wave decomposition

### Wave overview

| Wave | Title | Tasks | ~Count | Sequential predecessor |
|:--:|:--|:--|:--:|:--|
| **S4a** | Drawer-kick mechanism + gating + audit emission + double-kick suppression | T310 / T311 / T312 / T313 / T320 / T321 / T340 / T350 / T351 / T352 | 10 | Slice 3 closed |
| **S4b** | `<DrawerFailureBanner>` (**third `[IMPECCABLE craft]`**) + BannerHost stacking + Slice 4 close-out + hardware integration | T330 / T331 / T332 / T360 / T361 / T370 / T371 / T372 / T373 / T374 | 10 | S4a merged + Slice 0 §A1 sign-off |

**Total: 20 tasks across 2 sequential waves** (excluding T372/T373 reviewer-attended tests which count as S4b sub-tasks).

Wait — recounting: T310/T311/T312/T313 (4) + T320/T321 (2) + T340 (1) + T350/T351/T352 (3) = **10 for S4a**; T330/T331/T332 (3) + T360/T361 (2) + T370/T371/T372/T373/T374 (5) = **10 for S4b**. Total: **20 tasks**.

Within each wave, multiple T-numbers are `[P]` tagged in tasks.md and can run as parallel subagents — see "Parallel-execution opportunities" per wave below.

---

## 3. Wave S4a — Drawer-kick mechanism + gating + audit emission

**Branch:** `feat/008-s4a-drawer-pipeline` off `main` (after Slice 3 closes).
**Gate cleared by this wave:** none directly. Builds the drawer pipeline that chains after Slice 3's print pipeline.
**Single PR.**

### 3.1 Task list (tasks.md T310–T352)

**Gating tests:**

- [ ] **T310** [P] [US1] Three-gate firing test (failing) — `tests/unit/main/drawer/drawer-kick.gating.test.ts`
- [ ] **T311** [P] [US1] Cashless-suppression test (failing) — `tests/unit/main/drawer/drawer-kick.cashless-suppression.test.ts`
- [ ] **T312** [P] [US1] Reprint-no-kick integration test (failing) — `tests/integration/sales/drawer-kick.reprint-no-kick.test.ts`
- [ ] **T313** [P] [US1] Double-kick suppression integration test (failing) — `tests/integration/sales/drawer-kick.double-kick-suppression.test.ts`

**Mechanism tests:**

- [ ] **T320** [P] [US1] Separate-command rule test (failing) — `tests/unit/main/drawer/drawer-kick.separate-command.test.ts`
- [ ] **T321** [P] [US1] Ack-handling test (failing) — `tests/unit/main/drawer/drawer-kick.ack-handling.test.ts`

**Audit-redaction test:**

- [ ] **T340** [P] [US1] Drawer-events audit redaction test (failing) — `tests/unit/main/drawer/drawer-events.audit-redaction.test.ts`

**Implementation:**

- [ ] **T350** [US1] Drawer-kick module (ESC/POS DK1/DK2 pulse + status-poll ack) — `src/main/drawer/drawer-kick.ts`
- [ ] **T351** [US1] Drawer-kick gating logic (reads tender summary; queries `drawer_events.findBySale`; queries print-event purpose) — `src/main/drawer/drawer-kick.ts`
- [ ] **T352** [US1] Wire drawer-kick dispatch into Slice 3's print pipeline — `src/main/receipts/print-pipeline.ts`

### 3.2 Parallel-execution opportunities

T310 / T311 / T312 / T313 / T320 / T321 / T340 are all `[P]` — seven test subagents in parallel. T350 + T351 are sequential (same file; mechanism before gating). T352 depends on T350 + T351 + Slice 3's print-pipeline existing.

**Recommended dispatch:** (T310 ∥ T311 ∥ T312 ∥ T313 ∥ T320 ∥ T321 ∥ T340 in parallel — 7 subagents) → T350 → T351 → T352.

### 3.3 Forbidden paths (S4a)

`migrations/**`, `src/main/sales/**` (Slice 1 territory; S4a reads via repositories but does not modify them), `src/main/receipts/templates/**` (Slice 2 territory), `src/main/receipts/escpos-adapter.ts` / `os-print-adapter.ts` / `receipts-bridge.ts` (Slice 3 territories; S4a may import them but must not modify), `src/renderer/**` (S4b territory), `src/preload/**` (**no drawer preload exists; AD-5 locks `drawer.*` as main-only**), `src/shared/**` (no shared type extension needed — drawer has no renderer-callable surface), `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S4a touches **only** `src/main/drawer/**`, `src/main/receipts/print-pipeline.ts` (additive wire-up of T352), and the corresponding test files under `tests/unit/main/drawer/` + `tests/integration/sales/drawer-*`.

### 3.4 Acceptance + close-out

- [ ] All seven test tasks (T310 / T311 / T312 / T313 / T320 / T321 / T340) pass.
- [ ] T350 drawer-kick module: ESC/POS DK1/DK2 pulse as a separate write (NOT embedded in receipt byte stream — AD-8); status-poll ack handling; typed success / failure result.
- [ ] T351 gating logic: three-gate check (Sale durably committed + print-success ack + tender mix includes ≥ 1 applied `cash` line) per FR-040; reads `tender_lines_summary_json` for cash check; queries `drawer_events.findBySale` for prior `outcome='opened'` (FR-053 suppression); queries print-event purpose to distinguish first-print from reprint.
- [ ] T352 wire-up: AFTER a successful first-print `print_events` INSERT for a cash-inclusive sale in `print-pipeline.ts`, dispatch the kick. AFTER a successful reprint, INSERT a suppressed `drawer_events` row but do NOT call the kick. AFTER a cashless first-print, INSERT a suppressed `drawer_events` row with `suppression_reason='cashless_tender_mix'`.
- [ ] T320 invariant: drawer-kick byte stream issued as **separate write** distinct from the receipt byte stream. Inspected by test against the ESC/POS adapter; no DK1/DK2 pulse sequence appears inside the receipt bytes.
- [ ] T321 invariant: success → INSERT `drawer_events` with `outcome='opened'`, emits `sale.drawer.opened`; failure → INSERT with `outcome='failed', failure_reason=<closed enum>`, emits `sale.drawer.failed` with `last_successful_open_at_for_terminal` populated per Constitution §IV.
- [ ] T313 invariant: print-retry-after-failure on a cash-inclusive sale whose drawer already opened in a partial-success earlier attempt does NOT re-kick; main-side check on existence of `drawer_events` row with `outcome='opened'` (FR-053 / Risk R-5).
- [ ] T340 invariant: drawer-event audit payloads contain NO PAN / voucher / PIN / etc.; `last_successful_open_at_for_terminal` is UTC timestamp only.
- [ ] Vitest `tests/unit/main/drawer/` + `tests/integration/sales/drawer-*` all green; per-module coverage ≥ 95% on drawer-kick logic.
- [ ] **No `[IMPECCABLE]` marker fires in S4a.** S4a has zero renderer code. T360 is S4b territory.

---

## 4. Wave S4b — `<DrawerFailureBanner>` + BannerHost stacking + Slice 4 close-out

**Branch:** `feat/008-s4b-drawer-failure-banner` off `main` (after S4a merges).
**Gate cleared by this wave:** §A1 craft via T360 (the `/impeccable shape=pass` event covering shape brief sub-item (g) — persistent drawer-failure manual-override banner); §A3 hardware integration tests (T371 + T372 + T373 attended by §A3 reviewer with physical printer + drawer pair); Slice 4 functional close-out (T374).
**Single PR.**
**Third `[IMPECCABLE craft]` marker invocation in 008** (T360). Apply the §4.2 ritual from `s2-preflight.md §4.2` with slice-specific bindings documented below.

### 4.1 Task list (tasks.md T330–T374)

**`<DrawerFailureBanner>` tests (the red-bar set for T360's craft marker):**

- [ ] **T330** [P] [US1] Persistence test (failing) — `tests/unit/renderer/receipts/DrawerFailureBanner.persistence.test.tsx`
- [ ] **T331** [P] [US1] No-retry-kick affordance test (failing) — `tests/unit/renderer/receipts/DrawerFailureBanner.no-retry.test.tsx`
- [ ] **T332** [P] [US1] Accessibility test (failing) — `tests/unit/renderer/receipts/DrawerFailureBanner.a11y.test.tsx`

**Implementation:**

- [ ] **T360** [US1] [IMPECCABLE craft] `<DrawerFailureBanner>` component — `src/renderer/ui/receipts/DrawerFailureBanner.tsx`
- [ ] **T361** [P] [US1] Stack drawer-failure banner alongside printer-failure banner in BannerHost — `src/renderer/ui/banners/BannerHost.tsx`

**Slice 4 verification + close-out:**

- [ ] **T370** Vitest coverage assertion across drawer + banner modules — `tests/`
- [ ] **T371** [§A3] Hardware integration (success): cash-inclusive sale → receipt prints → drawer pops AFTER print (separate-command timing visible to reviewer) — `docs/hardware-matrix.md`
- [ ] **T372** [§A3] Hardware integration (drawer-disconnect failure): receipt prints, banner persists, sale durable — `docs/hardware-matrix.md`
- [ ] **T373** [§A3] Hardware integration (cashless): `external_card_terminal`-only sale → drawer does NOT open, no banner, `sale.drawer.suppressed` audit event present — `docs/hardware-matrix.md`
- [ ] **T374** Slice 4 functional sign-off + per-module coverage + drawer hardware-matrix entries cross-referenced — `specs/008-sale-finalization-and-receipts/coordination.md`

### 4.2 The third `[IMPECCABLE craft]` invocation (T360) — apply §4.2 ritual

T360 is the third time the activation contract executes. Apply the canonical four-step ritual from `s2-preflight.md §4.2` (and as bound for the second time in `s3-preflight.md §6.2`) with these slice-specific bindings:

- **Step 1 — Confirm Slice 0 §A1 sign-off + `/impeccable shape=pass`:** verify the §A1 reviewer signed off shape-brief sub-item **(g)** (persistent drawer-failure manual-override banner, non-modal, no auto-dismiss, **only** manual-override affordance — no retry-kick — with relative `last_successful_open_at` timestamp). If sub-item (g) details have shifted since T290 fired, escalate to the §A1 reviewer for a sub-item refresh before proceeding.
- **Step 2 — Red-bar check** (embed preflight §4.2): run the three failing tests locally and confirm RED:

  ```bash
  npm test -- --run tests/unit/renderer/receipts/DrawerFailureBanner.persistence.test.tsx \
                tests/unit/renderer/receipts/DrawerFailureBanner.no-retry.test.tsx \
                tests/unit/renderer/receipts/DrawerFailureBanner.a11y.test.tsx
  ```

  Record the RED confirmation + exit code in `coordination.md` under T360 before `/impeccable craft` fires.
- **Step 3 — Invoke `/impeccable craft 008-drawer-failure-banner`:** per the marker on T360. The component:
  - Subscribes to `sales.subscribe(topic='banner_state')` (Slice 1's subscription mechanism).
  - Mounts whenever the latest `drawer_events` row for a recently finalized sale has `outcome='failed'`.
  - Renders **only** the manual-override affordance (T331 invariant — no retry-kick button) + the relative `last_successful_open_at` timestamp formatted via `formatters` ("last opened: 2 hours ago").
  - **Does not auto-dismiss** — banner stays until the drawer-failure condition resolves (i.e., manual override taken).
  - **Visually distinct from `<PrinterFailureBanner>`** (NFR-008 — the cashier must never confuse them under counter pressure). This is the load-bearing visual decision per `/impeccable shape`.
  - 44 × 44 CSS-pixel touch-target floor on the manual-override button.
  - Screen-reader landmark + focus management lands on the banner when it first mounts.
- **Step 4 — Post-craft constitution checklist** (embed preflight §7): run the nine-item checklist (the same nine items from `docs/impeccable-embed-preflight.md §7`; see `s3-preflight.md §6.2` Step 4 for the full list applied to a banner component).

  The "no optimistic UI past durable commit" check has slice-specific meaning for T360: the banner does NOT optimistically dismiss on manual-override click; dismisses only when the new `print_events` row's `outcome='manual_override'` is committed by the bridge handler (Slice 6's T510). T360 must NOT pre-empt that resolution. Apply the same logic from `s3-preflight.md §6.2` Step 4 (the same load-bearing meaning carries over from T290).

  Failing any item = T360 NOT marked complete. Open a fixup commit before moving on.

### 4.3 Parallel-execution opportunities

T330 / T331 / T332 are all `[P]` — three banner-test subagents in parallel (the red-bar set). T361 is `[P]` — independent BannerHost extension.

**Recommended dispatch:** (T330 ∥ T331 ∥ T332 in parallel — 3 subagents authoring tests) → §4.2 ritual → T360 craft → T361 stacking → T370 → T371 (hardware) → T372 (hardware) → T373 (hardware) → T374.

### 4.4 Hardware integration tests (T371 + T372 + T373) — §A3-reviewer-attended

Per `s3-preflight.md §7.5`, hardware integration tests are **§A3-reviewer-attended** smoke tests recorded in `docs/hardware-matrix.md`; NOT runnable in CI. Slice 4 adds three new drawer-specific tests:

- **T371 (cash success):** real printer + drawer attached. Drive a 006 cash settlement → 008 finalize → assert: receipt prints AND drawer pops open AFTER the print (separate-command timing visible to reviewer's attention). `print_events` row INSERTed with `outcome='success'`; `drawer_events` row INSERTed with `outcome='opened'`; both audit events present. Record observation notes in `docs/hardware-matrix.md` under the drawer pair's test row.
- **T372 (drawer-disconnect failure):** printer attached + drawer cable unplugged. Drive a 006 cash settlement → 008 finalize → assert: receipt prints; `<DrawerFailureBanner>` mounts; Sale durable; `print_events.outcome='success'`; `drawer_events.outcome='failed'` with appropriate `failure_reason`; `sale.drawer.failed` audit event includes `last_successful_open_at_for_terminal`. Record observation notes.
- **T373 (cashless):** `external_card_terminal`-only 006 settlement → 008 finalize → assert: receipt prints; drawer does NOT open; no banner; `drawer_events` row INSERTed with `outcome='suppressed', suppression_reason='cashless_tender_mix'`; `sale.drawer.suppressed` audit event present. Record observation notes.

If any of T371 / T372 / T373 fails empirically, STOP and escalate to the §A3 reviewer. Possible root causes: printer-drawer connectivity mismatch (re-open T201 / T202 library choice), drawer-kick mechanism regression (re-open S4a), or wrong test expectation (re-spec).

### 4.5 Forbidden paths (S4b)

`migrations/**`, `src/main/sales/**`, `src/main/receipts/**` (Slice 2 / 3 territories), `src/main/drawer/**` (S4a territory; S4b may import but not modify), `src/preload/**` (no drawer preload), `src/shared/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S4b touches **only** `src/renderer/ui/receipts/DrawerFailureBanner.tsx`, `src/renderer/ui/banners/BannerHost.tsx` (additive stacking via T361), and the three banner test files under `tests/unit/renderer/receipts/DrawerFailureBanner.*`. Updates to `coordination.md` (T374) and `docs/hardware-matrix.md` (T371 / T372 / T373) are permitted.

### 4.6 Acceptance + close-out

- [ ] All three banner tests (T330 / T331 / T332) pass per the red-bar / craft / green-bar sequence.
- [ ] T360 `<DrawerFailureBanner>` ships per §4.2 ritual (red-bar confirmed; `/impeccable craft 008-drawer-failure-banner` invoked; post-craft constitution checklist all green).
- [ ] T361 stacks the drawer-failure banner alongside the printer-failure banner in `BannerHost.tsx`. **Both banners can coexist** when both failure conditions are active simultaneously. Visual order: printer-failure on TOP, drawer-failure BELOW (per NFR-008 layering).
- [ ] T331 invariant verified visually + by test: drawer-failure banner has **NO retry-kick affordance**; only manual override. (A retry-kick would either violate FR-053 — re-kick attempt blocked by UNIQUE constraint — or have no audit anchor for the second attempt.)
- [ ] T370 coverage assertion: ≥ 95% on drawer-kick logic (carry-over from S4a); ≥ 90% on `<DrawerFailureBanner>`.
- [ ] **T371 + T372 + T373 hardware integration tests** attended by §A3 reviewer with physical printer + drawer pair; observation notes recorded in `docs/hardware-matrix.md`.
- [ ] T374 records Slice 4 functional sign-off in `coordination.md`; §A2 no-op confirmed; **§A4 confirmed no new renderer-callable surface added** (AD-5 invariant — `drawer.*` remains main-only); §A3 hardware integration sign-offs cross-referenced; per-module coverage numbers recorded.
- [ ] **Slice 4 closes.** Slice 5 (reprint + duplicate-copy marker) becomes startable.

---

## 5. Cross-wave invariants

These rules apply to every wave (S4a / S4b). Violation = preflight violation; wave is rejected.

### 5.1 Constitution compliance (every wave)

- **No floats for money.** Drawer-kick logic touches no money paths.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** preserved.
- **No upward-of-bridge IPC.** S4b's renderer reaches main exclusively through `sales.subscribe(topic='banner_state')` (Slice 1) + future `receipts.manualOverride` (Slice 6 wires the actual handler). **No `drawer.*` bridge surface exposed** — AD-5 invariant.
- **No copy-paste from `_reference/Data-Pulse/`.** Constitution §P8.
- **PII / cards never in logs.** Constitution §P11. T340 invariant locks drawer-event audit payloads contain no sensitive fields.
- **Test-first.** Every implementation T-number is preceded by its failing-test T-number.

### 5.2 TDD ordering (every wave)

Within each wave: failing-test task → implementation task → green-bar verification. For T360 specifically, the §4.2 ritual is binding — the RED confirmation is recorded in `coordination.md` before `/impeccable craft` fires.

### 5.3 Forbidden-path enforcement (every wave)

Each wave's "Forbidden paths" section (§3.3 / §4.5) is binding. Pre-merge check: `git diff --name-only main...HEAD` against the wave's allow-list. Slice 4 has no S3a-equivalent dependency wave; **NO wave in Slice 4 may modify `package.json` + `package-lock.json`** (the ESC/POS library committed in Slice 3 §S3a covers Slice 4's needs too — drawer-kick uses the same library's DK1/DK2 pulse API).

### 5.4 Embed marker enforcement (this slice)

Slice 4 contains **one** `[IMPECCABLE craft]` marker (T360). All other Slice 4 tasks are non-marker. Any `/impeccable` invocation outside T360's craft is a preflight violation. The §4.2 ritual is the **only** legal invocation path in Slice 4.

### 5.5 No new renderer-callable bridge surface (this slice)

Slice 4 does NOT add a `drawer.*` bridge handler. AD-5 + AD-8 lock the drawer-kick as main-process-only — the renderer cannot trigger a kick, cannot retry a kick, cannot query drawer status. The only renderer-side affordance is the `<DrawerFailureBanner>` manual-override path, which invokes `receipts.manualOverride` (Slice 6) — and that is a `receipts.*` handler, NOT a `drawer.*` handler.

This invariant is enforced at code-review time:
- No new entries under `src/preload/`.
- No `BridgeApi['drawer']` extension in `src/shared/bridge-api.ts`.
- No `drawer.*` bridge handler tests.

§A4 review at T374 confirms this invariant.

### 5.6 Coordination updates

Each wave's close-out updates `coordination.md`:

- S4a: no coordination update during the wave itself (no gate cleared by S4a alone).
- S4b: T360 red-bar confirmation recorded; T360 post-craft constitution checklist recorded; T371 + T372 + T373 hardware observation notes (in `hardware-matrix.md`; cross-referenced in `coordination.md`); Slice 4 functional sign-off (T374) recorded; §A2 no-op confirmed; §A4 no-new-surface confirmed; §A3 hardware integration sign-offs cross-referenced.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|:--|:--:|:--|
| Slice 3 §A3 hardware-matrix entry not yet established | HIGH | S4a depends on Slice 3 being closed (T303). T200's printer+drawer pair was committed in Slice 3 §S3a. Verify the pair includes a drawer (not just a printer) before S4a opens. |
| §A3 reviewer not available for T371 / T372 / T373 | HIGH | Same §A3 reviewer attended T301 / T302 in Slice 3. Confirm availability before scheduling S4b's hardware tests. |
| §A1 sub-item (g) (drawer-failure banner) shifted between Slice 3 T290 and Slice 4 T360 sign-off events | MEDIUM | Same risk as Slice 3 — if the shape-brief sub-item details have shifted, the §A1 reviewer refreshes sub-item (g) before T360 can fire. The two banners must remain **visually distinct** per NFR-008. |
| T352 wire-up regresses Slice 3's print pipeline | HIGH | T352 is **additive** — the drawer-kick dispatch happens AFTER a successful `print_events` INSERT for a cash-inclusive sale. The print pipeline's existing success/failure paths are untouched. Code review must verify no synchronous coupling between print acknowledgement and drawer-kick dispatch (the drawer-kick must not block the print pipeline's audit emit). |
| Drawer kick attempted before print ack received | MEDIUM | T310's three-gate test asserts the print-success ack is a precondition. Implementation MUST check the `print_events` row's `outcome='success'` (NOT just "print attempt completed") before dispatching. |
| Reprint silently re-kicks the drawer (FR-053 violation) | HIGH | T312 + T313 explicit integration tests. The UNIQUE constraint on `drawer_events.sale_id` from Slice 1 is the schema-level enforcement; T351 gating logic provides the application-level enforcement. Both layers must hold; tests verify both. |
| Cashless sale silently kicks the drawer | HIGH | T311 explicit test. The gating logic reads `tender_lines_summary_json` for `applied=true cash` lines; absence → INSERT suppressed row + emit `sale.drawer.suppressed`, do not dispatch kick. |
| Hardware integration test (T371 / T372 / T373) fails empirically | HIGH | Stop and escalate to §A3 reviewer. Possible root causes: printer-drawer cable mismatch, ESC/POS DK1/DK2 unsupported by the chosen drawer model (re-open §S3a library choice), or wrong test expectation. |
| Drawer-failure banner accidentally adds a retry-kick button | MEDIUM | T331 explicit test asserts the banner has NO retry-kick affordance. §4.2 ritual Step 3 spec calls this out. `/impeccable craft` may default to including a "retry" button on failure surfaces; the embedder MUST remove it. |
| Banner stacking (printer-failure + drawer-failure) visually clashes | MEDIUM | T361 stacking implementation: printer-failure on TOP, drawer-failure BELOW. NFR-008 layering rule. Visual verification at counter distance (~1.5 m glance) by the §A1 reviewer if both banners can coexist — though this is a smaller visual gate than Slice 5's T461 counter-distance check (since both banners are operational, not informational). |

---

## 7. Open coordination follow-ups (before Slice 4 can start)

- [ ] **Slice 3 closed.** S4a cannot start until T303 functional sign-off lands. Slice 4 chains the drawer-kick after Slice 3's print-pipeline.
- [ ] **Slice 0 §A1 sign-off** (T010 + T011). Required for T360 craft via §4.2 Step 1.
- [ ] **§A3 reviewer availability** for T371 / T372 / T373 hardware-attended tests.
- [ ] **Ahmed §A1 acceptance** (preflight #241 §9 box). Still unticked from the activation PR.
- [ ] **T002 feature-flag PR** merged. The drawer-failure banner gates on the `sale_finalization` flag.

---

## 8. Preflight metadata

**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Tasks:** [../tasks.md](../tasks.md) (Phase 6 — Slice 4)
**Coordination:** [../coordination.md](../coordination.md)
**Hardware matrix:** [../../../docs/hardware-matrix.md](../../../docs/hardware-matrix.md)
**Research:** [../research.md](../research.md) §R-5 (double-kick suppression) · §R-8 (drawer-kick mechanism)
**Embed preflight (cross-feature):** [../../../docs/impeccable-embed-preflight.md](../../../docs/impeccable-embed-preflight.md)
**Slice 1 preflight:** [./s1-preflight.md](./s1-preflight.md)
**Slice 2 preflight (canonical `/impeccable craft` ritual at §4.2):** [./s2-preflight.md](./s2-preflight.md)
**Slice 3 preflight (second-marker invocation pattern):** [./s3-preflight.md](./s3-preflight.md)
**Constitution version pinned:** v1.5.1
**Authored:** 2026-05-26
**Owner:** Slice 4 implementing agent (single agent or subagent fleet); §A3 reviewer for S4b hardware integration; §A1 reviewer for T360 `/impeccable shape=pass` carry-over from Slice 0; Ahmed for Slice 4 functional sign-off (T374).

---

**End of Slice 4 preflight. S5 / S6 preflights to follow.**
