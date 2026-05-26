# 008 Slice 6 Preflight — Manual-override + sync-outbox finalisation + §A5 production readiness

> **For agentic workers:** This preflight is the per-wave implementation plan for Slice 6 of 008-sale-finalization-and-receipts. Slice 6 ships in **two sequential waves** (S6a → S6b). Each wave is **one PR**. Each wave has a strict file allow-list; touching anything outside is a preflight violation.
>
> **Source of truth (in priority order):**
>
> 1. `specs/008-sale-finalization-and-receipts/tasks.md` — canonical T-numbers + per-task acceptance criteria
> 2. `specs/008-sale-finalization-and-receipts/coordination.md` — live gate ledger + sign-off records
> 3. `specs/008-sale-finalization-and-receipts/contracts/bridge-api.md` — `receipts.manualOverride` contract (§A4) + the eight-item §A4 security-review checklist
> 4. `docs/hardware-matrix.md` — Slice 3 / 4 / 5 entries must already exist; Slice 6 adds the §A5 performance-bring-up section (T520a)
> 5. `specs/008-sale-finalization-and-receipts/research.md` §R-15 (recovery scan) + the AD-9 redaction surface table
> 6. `docs/impeccable-embed-preflight.md` — Slice 6 fires the **fifth and final** `[IMPECCABLE craft]` marker (T512); §6.2 ritual carries forward from `s2-preflight.md §4.2` (canonical) via prior slices' per-slice bindings
>
> **This preflight does NOT replace tasks.md.** When this preflight and tasks.md disagree, tasks.md wins.

---

## 0. Slice 6 in one paragraph

Slice 6 implements `receipts.manualOverride` (cashier-permitted; invoked from the printer-failure banner when no print is reachable; INSERTs `print_events` row with `(purpose='first_print', outcome='manual_override', render_path=NULL)` + emits `sale.receipt.manual_override` audit with overrider attribution); wires the Manual receipt override button on `<PrinterFailureBanner>` (T512 — extends the component shipped in Slice 3's T290); handles the "first-print after manual override" edge case (FR-052 + spec Edge Case — the next successful retry-print is `purpose='retry_after_failure'`, NOT `purpose='reprint'`, and the slip has **no duplicate-copy marker**); finalises the sync-outbox contract (Slice 1 wrote the table + rows; Slice 6 records the §A5 production-readiness gate against it). **Plus** the full §A5 production-readiness audit: coverage-floor audit, performance-budget timing assertion on the §A3 hardware-matrix pair (T520a), redaction audit, Sentry scrubber decision tree (T522), hardware-matrix completeness check, runbook authoring, rollback strategy, security-review handoff, `safeStorage` read-only confirmation, CI gates check, and Slice 6 + §A5 functional sign-off.

User stories covered: US1 manual-override path; the "first-print after manual override" edge case; US1 scenario **14** (final sync-handoff staging verification).

Test floor (per tasks.md line 472): ≥ 95% on manual-override flow; full-suite coverage audit; redaction audit; hardware matrix complete.

**Fifth and final `[IMPECCABLE craft]` marker fires in this slice** (T512 — manual receipt override button wired onto the existing `<PrinterFailureBanner>` from S3d). Apply the canonical §4.2 ritual. **Plus** §A5 — the production-readiness gate that gates rollout, not merge. T520a is **§A5-reviewer-attended** on the §A3 hardware-matrix pair (NOT runnable in CI; physical printer + drawer required).

---

## 1. Gates blocking Slice 6

| Gate | What it gates within Slice 6 | Closed by |
|:--:|:--|:--|
| **§A0** | Upstream readiness | ✅ Cleared (PR #238) |
| **§A1** | Slice 0 visual direction. T512 extends `<PrinterFailureBanner>` (shipped in S3d T290); the `/impeccable shape=pass` carry-over covers shape-brief sub-item **(f)** — the same sub-item as Slice 3 T290. **No new shape-brief sub-item.** §A1 sign-off carries forward from S3d. | Sub-item (f) sign-off carried over from S3d |
| **§A2** | Backend / OpenAPI — **no-op every 008 slice** (AD-12) | T528 / T529 documentation-only sign-off |
| **§A3** | Hardware integration: T520a performance-budget timing assertion on the §A3 hardware-matrix pair (cash-only-happy / mixed-cash-voucher / cashless-card-only fixtures); §A5-reviewer-attended on the bench, NOT runnable in CI. T523 completeness check confirms Slice 3 / 4 / 5 hardware rows present. | T520a + T523 sign-offs in `coordination.md` |
| **§A4** | `receipts.manualOverride` bridge surface review (1 new mutating handler; eight-item checklist from `contracts/bridge-api.md`). **Plus** T526 §A5 security-review handoff: walks the full eight-item §A4 checklist against the as-built code (the integration check against the entire 008 bridge surface). | S6a §A4 sign-off + T526 §A5 sign-off recorded in `coordination.md` |
| **§A5** | Production-readiness. This is the gate that distinguishes Slice 6's S6b from every other slice's close-out wave — it gates **rollout**, not merge. T520 / T520a / T521 / T522 / T523 / T524 / T525 / T526 / T527 / T528 / T529 all close on T529 functional sign-off. | T529 §A5 sign-off recorded in `coordination.md` |

**Wave-to-gate mapping:**

- **S6a** is gated on **§A4** (`receipts.manualOverride` review) + **§A1 carry-over from S3d** (T512 extends the existing banner — no new shape-brief sub-item). Draft PR allowed before §A4 reviewer signs off; merge blocks.
- **S6b** is gated on **§A5** (the full production-readiness audit). S6b is the **slice + spec close-out** — at T529 sign-off, 008 transitions from "implementation in progress" to **SPEC COMPLETE**.

**Slice 1–5 dependencies:** Slice 6 chains `receipts.manualOverride` through every prior slice (uses Slice 1's sales repository + audit emitter + sync-outbox; Slice 3's print-pipeline as a no-op routing target; Slice 4's drawer-kick suppression on the retry-after-manual-override path; Slice 5's reprint flow as an attribution-comparison reference). Slice 6 cannot start until Slice 5 closes (T463 functional sign-off).

---

## 2. Wave decomposition

### Wave overview

| Wave | Title | Tasks | ~Count | Sequential predecessor |
|:--:|:--|:--|:--:|:--|
| **S6a** | Manual-override bridge handler + types + idempotency + edge-case tests (first-print after manual override) | T500 / T501 / T502 / T503 / T504 / T510 / T511 | 7 | Slice 5 closed |
| **S6b** | T512 manual-override wire-up (**fifth `[IMPECCABLE craft]`**) + §A5 production-readiness audit + 008 SPEC COMPLETE | T512 / T520 / T520a / T521 / T522 / T523 / T524 / T525 / T526 / T527 / T528 / T529 | 12 | S6a merged |

**Total: 19 tasks across 2 sequential waves.** S6b is the largest §A5 wave in 008 — 11 audit tasks + the T512 craft.

---

## 3. Wave S6a — Manual-override bridge handler + edge-case tests

**Branch:** `feat/008-s6a-manual-override-bridge` off `main` (after Slice 5 closes).
**Gate cleared by this wave:** §A4 (`receipts.manualOverride` review).
**Single PR.**

### 3.1 Task list (tasks.md T500–T511)

**Manual-override flow tests:**

- [ ] **T500** [P] [US1] Success test (failing) — `tests/unit/main/receipts/bridge.receipts-manual-override.success.test.ts`
- [ ] **T501** [P] [US1] No-drawer-kick integration test (failing) — `tests/integration/sales/manual-override.no-drawer-kick.test.ts`
- [ ] **T502** [P] [US1] First-print-after-manual-override integration test (failing; edge case) — `tests/integration/sales/manual-override.then-retry-success.test.ts`
- [ ] **T503** [P] [US1] Manual-override-then-retry-then-drawer-kicks integration test (failing) — `tests/integration/sales/manual-override.retry-then-drawer-kicks.test.ts`
- [ ] **T504** [P] [US1] Idempotency replay test (failing) — `tests/unit/main/receipts/bridge.receipts-manual-override.idempotent.test.ts`

**Implementation:**

- [ ] **T510** [US1] `receipts.manualOverride` bridge handler — `src/main/receipts/receipts-bridge.ts`
- [ ] **T511** [US1] Extend `src/shared/bridge-api.ts` with `receipts.manualOverride` types — `src/shared/bridge-api.ts`

### 3.2 Parallel-execution opportunities

T500 / T501 / T502 / T503 / T504 are all `[P]` — five test subagents in parallel. T511 must come before T510 (the handler references the new types).

**Recommended dispatch:** (T500 ∥ T501 ∥ T502 ∥ T503 ∥ T504 in parallel — 5 subagents) → T511 → T510.

### 3.3 Forbidden paths (S6a)

`migrations/**`, `src/main/sales/**`, `src/main/receipts/templates/**` / `print-pipeline.ts` / `escpos-adapter.ts` / `os-print-adapter.ts` (Slice 2 / 3 territories — S6a may import them but must not modify), `src/main/drawer/**` (Slice 4 territory), `src/renderer/**` (S6b territory for T512), `src/preload/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S6a touches **only** `src/main/receipts/receipts-bridge.ts` (extends with `manualOverride` method), `src/shared/bridge-api.ts` (incremental extension), and the test files under `tests/unit/main/receipts/bridge.receipts-manual-override.*` + `tests/integration/sales/manual-override.*`.

### 3.4 Acceptance + close-out

- [ ] All five test tasks (T500–T504) pass per RED → implement → GREEN cadence.
- [ ] T510 handler: `requireOperatorSession` gate (no role restriction — same as reprint, cashier-permitted) + idempotency + INSERT `print_events` row with `(purpose='first_print', outcome='manual_override', render_path=NULL, acting_operator_id=<current signed-in operator>)` + emits `sale.receipt.manual_override` audit event with overrider attribution; the renderer banner observes the new `print_events` row's `outcome` and dismisses.
- [ ] T501 invariant: manual override does NOT kick the drawer. The print never succeeded → drawer-kick gating's print-success-ack precondition is not satisfied. No `drawer_events` row INSERTed.
- [ ] T502 invariant (edge case): AFTER a manual override, the next successful retry-print INSERTs with `purpose='retry_after_failure', outcome='success'`, NOT `purpose='reprint'`. The slip has **no duplicate-copy marker** (FR-052 + spec Edge Case "first-print after manual override").
- [ ] T503 invariant (edge case continued): AFTER a manual override + successful retry, drawer-kick gating runs normally on the retry success (cash-inclusive → drawer pops). UNIQUE constraint on `drawer_events.sale_id` ensures only one DrawerEvent total exists across the lifecycle of the sale.
- [ ] T504 invariant: idempotency replay — identical-payload no-op returning original outcome; payload-mismatch refuses with `idempotency_payload_mismatch` per Constitution §P5.
- [ ] T511 type extension lands incrementally on top of `bridge-api.ts`.
- [ ] **§A4 reviewer signs off** `receipts.manualOverride` against the eight-item checklist. Sign-off recorded in `coordination.md`.
- [ ] **No `[IMPECCABLE]` marker fires in S6a.** S6a has zero renderer code. T512 is S6b territory.

---

## 4. Wave S6b — T512 manual-override wire-up + §A5 production-readiness audit + 008 SPEC COMPLETE

**Branch:** `feat/008-s6b-manual-override-ui-and-a5` off `main` (after S6a merges).
**Gate cleared by this wave:** §A5 production-readiness (T529). **This is the wave that closes 008.**
**Single PR.**
**Fifth and final `[IMPECCABLE craft]` marker invocation in 008** (T512 — extends T290's `<PrinterFailureBanner>` with the manual-override button wire-up).

### 4.1 Task list (tasks.md T512 + T520–T529)

**Manual-override wire-up:**

- [ ] **T512** [US1] [IMPECCABLE craft] Wire the Manual receipt override button on `<PrinterFailureBanner>` — `src/renderer/ui/receipts/PrinterFailureBanner.tsx`

**§A5 production-readiness tasks:**

- [ ] **T520** [§A5] Coverage-floor audit — `coordination.md`
- [ ] **T520a** [§A5] Performance-budget timing assertion (§A3 hardware-matrix pair; N ≥ 20 runs; 95th-percentile gates) — `docs/hardware-matrix.md` + `tests/performance/sales/008-perf-budgets.bench.ts`
- [ ] **T521** [§A5] Redaction audit — `coordination.md`
- [ ] **T522** [§A5] Sentry scrubber decision tree (cases a/b/c per tasks.md) — `coordination.md`
- [ ] **T523** [§A5] Hardware-matrix completeness check — `docs/hardware-matrix.md`
- [ ] **T524** [§A5] Author `docs/runbook/008-sale-finalization-and-receipts.md` — `docs/runbook/008-sale-finalization-and-receipts.md`
- [ ] **T525** [§A5] Author rollback strategy in runbook (feature-flag disable + NOT down-migration) — `docs/runbook/008-sale-finalization-and-receipts.md`
- [ ] **T526** [§A5] Security-review handoff: walk eight-item §A4 checklist against as-built code — `coordination.md`
- [ ] **T527** [§A5] `safeStorage` read-only confirmation — `coordination.md`
- [ ] **T528** [§A5] CI gates check (`codegen:verify` no-op + `typecheck` + `lint` + `npm test` + `package:dir` on `windows-latest`) — `coordination.md`
- [ ] **T529** [§A5] Slice 6 functional sign-off + §A5 production-readiness sign-off — `coordination.md`

### 4.2 The fifth and final `[IMPECCABLE craft]` invocation (T512) — apply §4.2 ritual

T512 is the fifth — and final — time the activation contract executes. Apply the canonical four-step ritual from `s2-preflight.md §4.2`:

- **Step 1 — Confirm Slice 0 §A1 sign-off + `/impeccable shape=pass`:** verify the §A1 reviewer signed off shape-brief sub-item **(f)** (persistent printer-failure banner — **same sub-item as Slice 3 T290**). T512 extends T290's `<PrinterFailureBanner>` with the manual-override button wire-up; this is a continuation of the same craft, not a fresh component. §4.2 Step 1 confirms the carry-over from S3d sign-off.
- **Step 2 — Red-bar check** (embed preflight §4.2): T512's red-bar set is the five S6a test files (T500 / T501 / T502 / T503 / T504), which test the **bridge handler behaviour** that T512's button click invokes. The button-click integration is verified by the existing T290 banner tests (T260 / T261 / T262 / T263) carrying through, which are already GREEN from S3d. **Run S6a's red-bar test set** to confirm RED before T510 lands; once S6a merges, the same tests must be GREEN. T512 itself doesn't add new renderer tests — it adds the click handler that invokes `receipts.manualOverride` from S6a.

  Record RED → GREEN transitions for S6a's tests in `coordination.md` under T512. The button-click contract is "invoke `receipts.manualOverride({ sale_id, idempotency_key })` with a fresh UUID v4 per click; on success, dismiss the banner."
- **Step 3 — Invoke `/impeccable craft 008-printer-failure-banner-manual-override`:** per the marker on T512. Note the target name is **explicit about the extension** — this is not a fresh component craft; it's a refinement of the existing `<PrinterFailureBanner>`. The change:
  - Add `onClick` handler to the manual-override button (which already exists in the T290 component shipped in S3d).
  - On click, generate a fresh `idempotency_key` UUID v4.
  - Invoke `receipts.manualOverride({ sale_id: currentSale.sale_id, idempotency_key })` via the preload bridge.
  - On success (`{ kind: 'ok', ... }`), dismiss the banner (the new `print_events` row's `outcome='manual_override'` will also dismiss it reactively via the `sales.subscribe` mechanism; T512 may rely on either path).
  - On refusal, surface the refusal copy via the standard generic-refusal-copy map.
- **Step 4 — Post-craft constitution checklist** (embed preflight §7): run the nine-item checklist (per `s3-preflight.md §6.2` Step 4 canonical list).

  Slice-specific binding: "no optimistic UI past durable commit" — the banner does NOT optimistically dismiss on click; dismisses on the bridge handler's `{ kind: 'ok' }` response OR on the reactive `sales.subscribe` update (whichever lands first; both must reflect the same truth — the new `print_events` row's `outcome='manual_override'`).

  Failing any item = T512 NOT marked complete. Open a fixup commit before moving on.

### 4.3 §A5 production-readiness audit (T520–T529) — §A5-reviewer-attended

§A5 production-readiness gates **rollout**, not merge. T520–T529 close on T529 functional sign-off, which transitions 008 from "implementation in progress" to **SPEC COMPLETE**.

#### T520 — coverage-floor audit

Run full vitest suite with `--coverage`. Assert per-module thresholds:

- **≥ 95%** on: money-math, sale-number allocator, receipt-payload generator, template engine, print pipeline, drawer-kick logic, audit-event emitter, sync-outbox enqueuer, AD-2 finalize transaction, all `sales.*` + `receipts.*` bridge handlers.
- **≥ 90%** on: the four renderer surfaces — `<ReceiptPreview>` (S2b T173), `<ReprintAffordance>` (S5b T450), `<PrinterFailureBanner>` (S3d T290 + S6b T512 wire-up), `<DrawerFailureBanner>` (S4b T360).

Record exact percentages in `coordination.md`. If any module misses its floor, identify the missing coverage paths, open a fixup commit (adds failing tests + implementation paths), and re-run T520.

#### T520a — performance-budget timing assertion (§A3-reviewer-attended)

**§A5-reviewer-attended on the §A3 hardware-matrix pair.** NOT runnable in CI (no hardware). The measurement script lives at `tests/performance/sales/008-perf-budgets.bench.ts` and is invoked manually.

Drive `cash-only-happy.fixture.json` (per `quickstart.md §"Test fixtures"`) through a full 006→008 finalize→preview→print→drawer-kick cycle **N ≥ 20 runs**. Capture per-stage timings. Assert the **95th-percentile** values:

- Preview ready ≤ **500 ms** (NFR-005).
- End-to-end "settled signal → drawer-open ack" on a cash-inclusive sale ≤ **3 seconds** (NFR-006 / SC-001).
- Reprint ready ≤ **3 seconds** (NFR-007 via the `reprint_duplicate` template).

Also run `mixed-cash-voucher.fixture.json` and `cashless-card-only.fixture.json` against NFR-006 (cashless path skips the drawer kick but still must meet the 3-second end-to-end ceiling).

Record per-fixture **p50 / p95 / p99 timings** + printer/drawer model used in `docs/hardware-matrix.md` under a new **"008 §A5 performance bring-up" section**; cross-reference in `coordination.md`.

**Failure → §A5 sign-off held pending root-cause + remediation.** Do NOT relax the budgets.

#### T521 — redaction audit

Grep all pino log output + Sentry events for the forbidden-field key list (from `data-model.md §"Forbidden fields"`). Assert **ZERO occurrences** across a full happy-path-plus-failure-paths test run. Audit `support-bundle` export tool to confirm same redaction discipline (Constitution §P11). Record in `coordination.md`.

#### T522 — Sentry scrubber decision tree (tightened by /speckit-analyze pass — closes finding I1)

Inspect the existing Sentry config + pino-redaction config against the full AD-9 redaction surface table in `plan.md §AD-9`. Decision tree:

- **(a)** If existing scrubber covers `external_reference` (per 006 FR-009 inheritance) AND the voucher-secret-field rejection list (`voucher_redemption_intent_token`, `voucher_code`, `voucher_balance`, `voucher_holder_pii`, raw authority payload — per 006 FR-017 inheritance + FR-071): record `no_change_required` in `coordination.md` with the scrubber-config file + line references that establish coverage; §A5 sign-off proceeds.
- **(b)** If ANY of the AD-9 redaction-surface fields is NOT covered by the existing scrubber: **block §A5 sign-off** pending a focused observability slice that extends the scrubber. Per Constitution §P11 / §P8, 008 MUST NOT smuggle scrubber extensions into a non-observability feature. Record the missing field(s), open a tracking issue / observability-slice spec stub, link from `coordination.md` + the §A5 row, and confirm 008 §A5 cannot ship until that slice merges.
- **(c)** If the question is ambiguous (e.g., scrubber covers a regex that *might* match the field but the match is not explicit): treat as case (b) — block + escalate; do NOT assume coverage.

Record the resolved branch (a / b / c) + supporting evidence in `coordination.md`.

#### T523 — hardware-matrix completeness check

Confirm `docs/hardware-matrix.md` has:
- ≥ 1 tested thermal printer + cash drawer model pair with driver version + caveats.
- Slice 3 test rows present + ticked (T301 + T302).
- Slice 4 test rows present + ticked (T371 + T372 + T373).
- Slice 5 test row present + ticked (T462).
- T520a "008 §A5 performance bring-up" section present + populated.

#### T524 — runbook authoring

Author `docs/runbook/008-sale-finalization-and-receipts.md` covering:

- **(a) "drawer didn't open but receipt printed"** diagnostic flow.
- **(b) "manual override taken — how to find which sales used manual override"** query against `print_events`.
- **(c) "reprint slip looks identical to original — how do I tell?"** answer (bilingual marker).
- **(d) "how to investigate a sync-outbox row that's been pending for N days"** (currently always — the future sync engine owns this).
- **(e) `last_successful_open_at_for_terminal` interpretation.**

#### T525 — rollback strategy (in runbook)

008's rollback options:

- **(a) Feature-flag disable** (`sale_finalization=false` in `app-config.ts` — sales settle in 006 but 008's finalize listener short-circuits, no receipts print, drawer doesn't open; cashier falls back to manual receipts; **outbox queue stops growing** but existing rows remain). Reversible.
- **(b) NOT down-migration.** The `sales` rows are durable financial records; down-migration is forward-fix territory per constitution P15 / Production Readiness Gates.

Record the decision matrix in the runbook.

#### T526 — security-review handoff (full bridge surface + trust boundary)

Walk the eight-item §A4 checklist in `contracts/bridge-api.md` against the **as-built code** (not just the contract). Record reviewer + date + result in `coordination.md`. This is the final §A4 integration check — every prior slice's §A4 sign-off was per-handler; T526 verifies the integration.

#### T527 — `safeStorage` confirmation

Confirm `safeStorage` interactions are **read-only** in 008 (008 reads cached terminal config; does not write secrets). Record in `coordination.md`.

#### T528 — CI gates check

Confirm on `windows-latest` (the CI matrix's only target):

- `codegen:verify` passes as a no-op (AD-12).
- `typecheck` passes.
- `lint` passes.
- Full `npm test` passes.
- `package:dir` smoke build passes.

Record run URLs + commit SHAs in `coordination.md`.

#### T529 — final sign-off

Record Slice 6 functional sign-off + §A5 production-readiness sign-off in `coordination.md` (reviewer, date, all sub-items ticked). Flip `coordination.md` STATUS banner from "implementation in progress" → **SPEC COMPLETE**. Cross-reference all prior sign-offs (§A1 / §A3 / §A4 across Slices 1–6).

### 4.4 Parallel-execution opportunities

T512 is `[US1]` — single craft task; not `[P]`. The §A5 audit tasks (T520 / T520a / T521 / T522 / T523 / T524 / T525 / T526 / T527 / T528) are largely independent and can run in parallel where dependencies allow:

- **T520 (coverage)** and **T521 (redaction)** can run in parallel; both consume the full test suite.
- **T523 (hardware-matrix completeness)** is a documentation check; can run anytime.
- **T524 + T525 (runbook + rollback)** are sequential within the same file.
- **T520a (perf budget)** is §A5-reviewer-attended on hardware; runs in its own session.
- **T522 (Sentry scrubber decision tree)** is a documentation check; can run anytime.
- **T526 (security-review handoff)** must come after S6a's bridge handler exists (§A4 reviewer can start the walk-through after S6a merges).
- **T527 + T528** are documentation checks; can run anytime.
- **T529** is the close-out — must come after all other §A5 tasks.

**Recommended dispatch:** §4.2 ritual → T512 craft → (T520 ∥ T521 ∥ T522 ∥ T523 ∥ T524 ∥ T525 ∥ T526 ∥ T527 ∥ T528 in up to nine parallel subagents) → T520a (hardware-attended, runs on its own schedule) → T529.

### 4.5 Forbidden paths (S6b)

`migrations/**`, `src/main/sales/**`, `src/main/receipts/templates/**` / `print-pipeline.ts` / `escpos-adapter.ts` / `os-print-adapter.ts` / `receipts-bridge.ts` (Slice 2 / 3 / S6a territories — S6b may import but must not modify), `src/main/drawer/**` (Slice 4 territory), `src/renderer/ui/receipts/ReceiptPreview.tsx` / `ReprintAffordance.tsx` / `DrawerFailureBanner.tsx` (prior slices' territories), `src/preload/**`, `src/shared/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S6b touches **only** `src/renderer/ui/receipts/PrinterFailureBanner.tsx` (T512 wire-up — additive button-click handler), the new `tests/performance/sales/008-perf-budgets.bench.ts` (T520a measurement script), and the documentation files (`docs/runbook/008-sale-finalization-and-receipts.md` for T524 + T525; `docs/hardware-matrix.md` for T520a + T523). Updates to `coordination.md` are permitted across all §A5 audit tasks.

### 4.6 Acceptance + close-out

- [ ] T512 manual-override wire-up ships per §4.2 ritual.
- [ ] T520 coverage thresholds all met (per-module exact percentages recorded).
- [ ] **T520a §A5-reviewer-attended perf-budget** on the §A3 hardware-matrix pair: 95th-percentile preview ≤ 500 ms, end-to-end ≤ 3 s, reprint ≤ 3 s on cash-only-happy + mixed-cash-voucher + cashless-card-only fixtures. p50 / p95 / p99 recorded in `docs/hardware-matrix.md` "008 §A5 performance bring-up" section.
- [ ] T521 redaction audit: ZERO forbidden-field occurrences in pino + Sentry + support-bundle.
- [ ] T522 Sentry scrubber decision tree: branch (a) `no_change_required` OR (b) blocked-with-tracking-issue OR (c) escalated. Branch + evidence recorded.
- [ ] T523 hardware-matrix complete (all four hardware test rows from Slices 3 / 4 / 5 ticked; T520a perf-budget section populated).
- [ ] T524 runbook authored covering all five sub-topics.
- [ ] T525 rollback strategy recorded (feature-flag disable + no down-migration).
- [ ] T526 §A4 walk-through against as-built code; reviewer + date + result recorded.
- [ ] T527 `safeStorage` confirmed read-only.
- [ ] T528 CI gates green on `windows-latest`.
- [ ] **T529 Slice 6 + §A5 sign-off recorded** in `coordination.md`. STATUS banner flipped to **SPEC COMPLETE**. All prior sign-offs cross-referenced.
- [ ] **008 closes.** 008 is SPEC COMPLETE.

---

## 5. Cross-wave invariants

### 5.1 Constitution compliance (every wave)

Standard set carried from prior preflights: no floats for money / `contextIsolation` preserved / no upward-of-bridge IPC / no `_reference/Data-Pulse/` copy / PII never in logs / test-first.

### 5.2 TDD ordering (every wave)

Within each wave: failing-test → implementation → green-bar. For T512 specifically, the §4.2 ritual is binding.

### 5.3 Forbidden-path enforcement (every wave)

Each wave's "Forbidden paths" section is binding. **NO wave in Slice 6 may modify `package.json` + `package-lock.json`** (no new deps required).

### 5.4 Embed marker enforcement (this slice)

Slice 6 contains **one** `[IMPECCABLE craft]` marker (T512). All other Slice 6 tasks are non-marker. Any `/impeccable` invocation outside T512's craft is a preflight violation.

### 5.5 §A5 attendance discipline (this slice)

T520a is §A5-reviewer-attended on the §A3 hardware-matrix pair. T526 is §A5-reviewer-attended for the security walkthrough. These are NOT runnable in CI; they are recorded actions in `coordination.md` with reviewer + date + evidence. The §A5 reviewer may be the same as Ahmed (the project owner), the §A3 reviewer, or a different person — the assignment is recorded in `coordination.md` at T529 close-out.

### 5.6 Coordination updates

- S6a: §A4 `receipts.manualOverride` sign-off recorded.
- S6b: T512 red-bar + post-craft constitution checklist recorded; T520 / T520a / T521 / T522 / T523 / T524 / T525 / T526 / T527 / T528 sign-offs each recorded; T529 Slice 6 + §A5 final sign-off recorded; **STATUS banner flipped to SPEC COMPLETE**.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|:--|:--:|:--|
| §A4 reviewer not assigned by S6a authoring time | HIGH | Same pattern as prior slices. Draft PR allowed; merge blocks. |
| §A5 reviewer assignment ambiguous (Ahmed / §A3 reviewer / different person) | MEDIUM | Assignment recorded in `coordination.md` at S6b commission; resolve before T520a runs. Likely Ahmed per the 006 §A5 pattern (PR #234). |
| T520a perf-budget failure on the §A3 hardware-matrix pair | HIGH | Stop and root-cause. Possible causes: AD-2 polling worker tick too long, template engine LOC budget overrun, ESC/POS library inefficient. §A5 sign-off held pending remediation; do NOT relax the budgets. |
| T520 coverage miss on any per-module floor | MEDIUM | Open a fixup PR with the missing test coverage; re-run T520. Iterate until all per-module floors are met. |
| T522 Sentry scrubber decision tree resolves to case (b) — missing field coverage | HIGH | Per Constitution §P11 / §P8, 008 MUST NOT smuggle scrubber extensions. Open a tracking issue / observability-slice spec stub; §A5 sign-off held until that slice merges. |
| T512's "no optimistic UI past durable commit" check fails | MEDIUM | The banner MUST NOT optimistically dismiss on manual-override click. Dismisses only on the `{ kind: 'ok' }` response OR on the reactive `sales.subscribe` update; both must reflect the same truth. /impeccable craft may default to optimistic patterns; the post-craft check catches this. |
| First-print-after-manual-override edge case mishandled (FR-052 violation) | HIGH | T502 + T503 explicit integration tests. The next successful retry-print MUST be `purpose='retry_after_failure'`, NOT `purpose='reprint'`; no duplicate-copy marker. The drawer-kick gating runs normally on the retry-success. |
| Hardware-matrix completeness check (T523) misses a Slice 3/4/5 row | LOW | T523 is a documentation check; missing rows are corrected in-PR (small Edit). Indicates a prior slice's close-out missed recording the hardware test row; backfill via T520a's "008 §A5 performance bring-up" section. |
| Runbook (T524) misses an operational scenario | LOW | T524 covers five specific scenarios per tasks.md line 500. Missing one is a Slice 6 fixup, not a §A5 blocker. |
| CI gates check (T528) fails on `windows-latest` | HIGH | Stop and fix. The `package:dir` smoke build is the load-bearing check (P15 — production readiness). Do not sign off T529 until T528 is green. |

---

## 7. Open coordination follow-ups (before Slice 6 can start)

- [ ] **Slice 5 closed** (T463 functional sign-off).
- [ ] **§A4 reviewer assigned** for `receipts.manualOverride`.
- [ ] **§A5 reviewer assigned** (per `coordination.md` §A5 row).
- [ ] **§A3 reviewer available** for T520a hardware-attended perf-budget.
- [ ] **Ahmed §A1 acceptance** (preflight #241 §9 box).
- [ ] **T002 feature-flag PR** merged.
- [ ] **Slice 0 §A1 sign-off** (T010 + T011); covers shape-brief sub-item (f) carry-over from S3d.

---

## 8. Preflight metadata

**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Tasks:** [../tasks.md](../tasks.md) (Phase 8 — Slice 6 + §A5)
**Coordination:** [../coordination.md](../coordination.md)
**Bridge contract:** [../contracts/bridge-api.md](../contracts/bridge-api.md)
**Hardware matrix:** [../../../docs/hardware-matrix.md](../../../docs/hardware-matrix.md)
**Runbook (to be authored at T524):** [../../../docs/runbook/008-sale-finalization-and-receipts.md](../../../docs/runbook/008-sale-finalization-and-receipts.md)
**Perf-budget script (to be authored at T520a):** [../../../tests/performance/sales/008-perf-budgets.bench.ts](../../../tests/performance/sales/008-perf-budgets.bench.ts)
**Research:** [../research.md](../research.md) §R-15 (recovery scan)
**Plan:** [../plan.md](../plan.md) §AD-9 (redaction surface table)
**Embed preflight (cross-feature):** [../../../docs/impeccable-embed-preflight.md](../../../docs/impeccable-embed-preflight.md)
**Slice 1 preflight:** [./s1-preflight.md](./s1-preflight.md)
**Slice 2 preflight (canonical `/impeccable craft` ritual at §4.2):** [./s2-preflight.md](./s2-preflight.md)
**Slice 3 preflight:** [./s3-preflight.md](./s3-preflight.md)
**Slice 4 preflight:** [./s4-preflight.md](./s4-preflight.md)
**Slice 5 preflight:** [./s5-preflight.md](./s5-preflight.md)
**Constitution version pinned:** v1.5.1
**Authored:** 2026-05-26
**Owner:** Slice 6 implementing agent; §A4 reviewer for S6a sign-off + T526 §A5 walkthrough; §A1 reviewer for T512 shape=pass carry-over from S3d; §A3 reviewer for T520a hardware-attended perf-budget; §A5 reviewer for T529 final sign-off (likely Ahmed per 006 §A5 pattern); Ahmed for Slice 6 + §A5 + 008 SPEC COMPLETE.

---

**End of Slice 6 preflight. With T529 sign-off, 008 transitions from implementation-in-progress to SPEC COMPLETE.**
