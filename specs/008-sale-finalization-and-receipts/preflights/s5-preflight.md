# 008 Slice 5 Preflight — Reprint + duplicate-copy marker + reprint audit

> **For agentic workers:** This preflight is the per-wave implementation plan for Slice 5 of 008-sale-finalization-and-receipts. Slice 5 ships in **two sequential waves** (S5a → S5b). Each wave is **one PR**. Each wave has a strict file allow-list; touching anything outside is a preflight violation.
>
> **Source of truth (in priority order):**
>
> 1. `specs/008-sale-finalization-and-receipts/tasks.md` — canonical T-numbers + per-task acceptance criteria
> 2. `specs/008-sale-finalization-and-receipts/coordination.md` — live gate ledger + sign-off records
> 3. `specs/008-sale-finalization-and-receipts/contracts/bridge-api.md` — `receipts.reprint` contract (§A4 reviewed before S5a ships)
> 4. `docs/hardware-matrix.md` — Slice 3 / Slice 4 entries must already exist; Slice 5 adds the reprint-specific integration row
> 5. `specs/008-sale-finalization-and-receipts/research.md` §R-13 (receipt-number invariance) + §R-6 (template engine variant routing)
> 6. `docs/impeccable-embed-preflight.md` — Slice 5 fires the **fourth** `[IMPECCABLE craft]` marker (T450); §6.2 ritual carries forward from `s2-preflight.md §4.2` (canonical) via `s3-preflight.md §6.2` and `s4-preflight.md §4.2` (per-slice bindings)
>
> **This preflight does NOT replace tasks.md.** When this preflight and tasks.md disagree, tasks.md wins.

---

## 0. Slice 5 in one paragraph

Slice 5 implements `receipts.reprint` (cashier-permitted per AD-10 — no role restriction); the `reprint_duplicate` template-variant routing (the Slice 2 asset is invoked; the bilingual duplicate-copy marker — "نسخة طبق الأصل — DUPLICATE COPY" — is rendered prominently in the header band); the n-th-reprint `duplicate_copy_sequence_number` allocation via `COUNT(*) FROM print_events WHERE sale_id=? AND purpose='reprint' AND outcome='success'`; reprint attribution (the `print_events` row carries `acting_operator_id = current signed-in operator`, NOT the Sale's `selling_operator_id`; the audit event carries BOTH operator ids); reprint precondition guard (refuses with `not_yet_printed` when no successful PrintEvent exists); reprint-no-mutation / reprint-no-drawer / reprint-no-kick invariants; and the renderer `<ReprintAffordance>` component (gated on the existence of a successful PrintEvent for the Sale).

User stories covered: US1 scenario **7** (reprint with visible duplicate-copy marker, no mutation, no drawer kick).

Test floor (per tasks.md line 422): ≥ 95% on the reprint flow; reprint-no-mutation test; reprint-no-drawer test; reprint-attribution test.

**Fourth `[IMPECCABLE craft]` marker fires in this slice** (T450 — `<ReprintAffordance>`). Apply the canonical §4.2 ritual from `s2-preflight.md`. **Plus** a slice-specific §A1 gate: **T461 manual counter-distance visual review** (~1.5 m glance, ~2 seconds) confirms the bilingual duplicate-copy marker is obvious. If the reviewer has to squint or read carefully, the marker is too subtle → Slice 5 merge blocked.

---

## 1. Gates blocking Slice 5

| Gate | What it gates within Slice 5 | Closed by |
|:--:|:--|:--|
| **§A0** | Upstream readiness | ✅ Cleared (PR #238) |
| **§A1** | Slice 0 visual direction has two touch-points in Slice 5: (a) **`reprint_duplicate` template asset marker styling** — already signed off in Slice 0 sub-item (b) — was authored by the §A1 reviewer per `s2-preflight.md §3.3` (out of `/impeccable` register); (b) **`<ReprintAffordance>` craft** (T450) — `/impeccable shape=pass` recorded against sub-item **(e)** of T010. **Plus** T461 manual counter-distance visual review (operationally a §A1 verification check). | T011 sign-off + shape-brief sub-item (e) confirmed + T461 visual review signed off |
| **§A2** | Backend / OpenAPI — **no-op every 008 slice** (AD-12) | Documentation-only sign-off in T463 |
| **§A3** | Hardware integration: T462 reprint-on-real-printer test attended by §A3 reviewer (drawer must NOT pop; marker visible). | T462 hardware test attended; row recorded in `hardware-matrix.md`; cross-referenced in `coordination.md` (T463) |
| **§A4** | `receipts.reprint` bridge surface review (1 new mutating handler; eight-item checklist from `contracts/bridge-api.md`). | S5a sign-off recorded in `coordination.md` |
| **§A5** | Production-readiness — Slice 6 concern, not blocking Slice 5 | Slice 6 T520–T528 |

**Wave-to-gate mapping:**

- **S5a** is gated on **§A4** (`receipts.reprint` review) + **Slice 2 template engine + Slice 3 print pipeline existing** (S5a uses both: renders via `reprint_duplicate` variant + dispatches via the existing print pipeline). Draft PR allowed before §A4 reviewer signs off; merge blocks.
- **S5b** is gated on **§A1 craft via T450** (`/impeccable shape=pass` recorded against sub-item (e)) + **§A1 manual visual review via T461** (counter-distance marker visibility) + **§A3 hardware integration via T462**.

**Slice 2 + Slice 3 + Slice 4 dependencies:** Slice 5 chains `receipts.reprint` through Slice 3's print pipeline (rendering via Slice 2's `reprint_duplicate` template variant). Slice 4's drawer-kick gating (T351) reads print-event `purpose` to distinguish first-print from reprint — meaning Slice 4 already encoded the "no drawer kick on reprint" rule. Slice 5 cannot start until Slice 4 closes (T374 functional sign-off).

---

## 2. Wave decomposition

### Wave overview

| Wave | Title | Tasks | ~Count | Sequential predecessor |
|:--:|:--|:--|:--:|:--|
| **S5a** | Reprint bridge handler + attribution + duplicate-marker visual tests | T400 / T401 / T402 / T403 / T403a / T404 / T410 / T411 / T412 / T420 / T421 / T440 / T441 | 13 | Slice 4 closed |
| **S5b** | `<ReprintAffordance>` (**fourth `[IMPECCABLE craft]`**) + integration + Slice 5 close-out + counter-distance visual review + hardware integration | T430 / T431 / T450 / T451 / T460 / T461 / T462 / T463 | 8 | S5a merged + Slice 0 §A1 sign-off |

**Total: 21 tasks across 2 sequential waves.** Within each wave, multiple T-numbers are `[P]` tagged in tasks.md and can run as parallel subagents — see "Parallel-execution opportunities" per wave below.

---

## 3. Wave S5a — Reprint bridge handler + attribution + duplicate-marker visual tests

**Branch:** `feat/008-s5a-reprint-bridge` off `main` (after Slice 4 closes).
**Gate cleared by this wave:** §A4 (`receipts.reprint` review).
**Single PR.**

### 3.1 Task list (tasks.md T400–T441)

**Reprint-flow tests:**

- [ ] **T400** [P] [US1] Success test (failing) — `tests/unit/main/receipts/bridge.receipts-reprint.success.test.ts`
- [ ] **T401** [P] [US1] Precondition test (`not_yet_printed`; failing) — `tests/unit/main/receipts/bridge.receipts-reprint.precondition.test.ts`
- [ ] **T402** [P] [US1] Sequence-number test (failing) — `tests/unit/main/receipts/bridge.receipts-reprint.sequence-number.test.ts`
- [ ] **T403** [P] [US1] No-Sale-mutation integration test (failing) — `tests/integration/sales/reprint.no-sale-mutation.test.ts`
- [ ] **T403a** [P] [US1] **Receipt-number invariance** test (failing; G1 remediation) — `tests/integration/sales/reprint.receipt-number-invariance.test.ts`
- [ ] **T404** [P] [US1] No-drawer-kick integration test (failing) — `tests/integration/sales/reprint.no-drawer-kick.test.ts`

**Reprint-attribution tests:**

- [ ] **T410** [P] [US1] Acting-operator attribution test (failing) — `tests/unit/main/receipts/bridge.receipts-reprint.attribution.test.ts`
- [ ] **T411** [P] [US1] Tenant-isolation test (failing) — `tests/unit/main/receipts/bridge.receipts-reprint.tenant-isolation.test.ts`
- [ ] **T412** [P] [US1] Cashier-permitted test (failing) — `tests/unit/main/receipts/bridge.receipts-reprint.cashier-permitted.test.ts`

**Duplicate-copy marker visual tests:**

- [ ] **T420** [P] [US1] Marker-visible-on-reprint test (failing) — `tests/unit/main/receipts/template-engine.reprint-marker-visible.test.ts`
- [ ] **T421** [P] [US1] Marker-absent-on-first-print test (failing) — `tests/unit/main/receipts/template-engine.first-print-no-marker.test.ts`

**Implementation:**

- [ ] **T440** [US1] `receipts.reprint` bridge handler — `src/main/receipts/receipts-bridge.ts`
- [ ] **T441** [US1] Extend `src/shared/bridge-api.ts` with `receipts.reprint` types — `src/shared/bridge-api.ts`

### 3.2 Parallel-execution opportunities

T400 / T401 / T402 / T403 / T403a / T404 / T410 / T411 / T412 / T420 / T421 are all `[P]` — eleven test subagents in parallel. T441 must come before T440 (the handler references the new types).

**Recommended dispatch:** Test batch (11 subagents in parallel) → T441 → T440.

### 3.3 Forbidden paths (S5a)

`migrations/**`, `src/main/sales/**` (Slice 1 territory), `src/main/receipts/templates/**` (Slice 2 territory; T420 / T421 test the existing assets without modifying them), `src/main/receipts/print-pipeline.ts` / `escpos-adapter.ts` / `os-print-adapter.ts` (Slice 3 territories; S5a may import them but must not modify), `src/main/drawer/**` (Slice 4 territory), `src/renderer/**` (S5b territory), `src/preload/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S5a touches **only** `src/main/receipts/receipts-bridge.ts` (extends with `reprint` method), `src/shared/bridge-api.ts` (incremental extension), and the test files under `tests/unit/main/receipts/bridge.receipts-reprint.*`, `tests/unit/main/receipts/template-engine.*marker*`, and `tests/integration/sales/reprint.*`.

### 3.4 Acceptance + close-out

- [ ] All eleven test tasks pass per RED → implement → GREEN cadence.
- [ ] T440 handler: `requireOperatorSession` gate (no role restriction per AD-10 — cashier-permitted) + tenant-isolation check + precondition check (T401 — refuses `not_yet_printed` if no successful PrintEvent for the Sale) + idempotency replay + renders via `reprint_duplicate` variant + INSERT `print_events` row with `purpose='reprint', outcome='success', duplicate_copy_sequence_number=n` (n = `COUNT(*) FROM print_events WHERE sale_id=? AND purpose='reprint' AND outcome='success'` + 1) + dispatches print via Slice 3's pipeline + emits `sale.receipt.reprinted` audit event with **dual attribution** (selling operator id from Sale row + acting operator id from current session).
- [ ] T403 invariant: reprint does NOT mutate the Sale row (AD-3 trigger blocks UPDATE anyway; this test asserts the application code never tries).
- [ ] T403a invariant: **receipt-number invariance across reprint cycles** (G1 remediation / FR-011 coverage). The rendered receipt payload's `receipt_number` field equals the original `R` on every printed copy (first print, every reprint, every retry-success); `sales.receipt_number` is unchanged at every step; `duplicate_copy_sequence_number` is `NULL` on first print, `1` on first reprint, `2` on second reprint, regardless of intervening retry-success events (which are `purpose='retry_after_failure'`, NOT reprints — FR-052).
- [ ] T404 invariant: reprint does NOT kick the drawer; no DK1/DK2 pulse; no second `drawer_events` row (UNIQUE constraint would reject anyway). Slice 4's T351 gating logic already encoded this; T404 verifies the integration.
- [ ] T410 invariant: `print_events.acting_operator_id` = current signed-in operator (reprinting operator), NOT Sale's `selling_operator_id`. Audit event carries BOTH.
- [ ] T411 invariant: tenant-isolation refusal returns `sale_not_found` per §A4 information-leak rule (NOT `tenant_isolation`).
- [ ] T412 invariant: cashier, manager, AND admin can all invoke; only `requireOperatorSession` gates.
- [ ] T420 + T421 invariants: `reprint_duplicate` template variant renders the bilingual marker in the header band (bold weight + larger size than body text + at the top of the slip); `first_print` template does NOT.
- [ ] T441 type extension lands incrementally on top of `bridge-api.ts`.
- [ ] **§A4 reviewer signs off** `receipts.reprint` against the eight-item checklist in `contracts/bridge-api.md §"§A4 security-review checklist"`. Sign-off recorded in `coordination.md`.
- [ ] **No `[IMPECCABLE]` marker fires in S5a.** S5a has zero renderer code. T450 is S5b territory.

---

## 4. Wave S5b — `<ReprintAffordance>` + integration + Slice 5 close-out

**Branch:** `feat/008-s5b-reprint-affordance` off `main` (after S5a merges).
**Gate cleared by this wave:** §A1 craft via T450 (the `/impeccable shape=pass` event covering shape-brief sub-item (e) — reprint affordance); §A1 manual counter-distance visual review via T461; §A3 hardware integration via T462; Slice 5 functional close-out (T463).
**Single PR.**
**Fourth `[IMPECCABLE craft]` marker invocation in 008** (T450).

### 4.1 Task list (tasks.md T430–T463)

**`<ReprintAffordance>` tests (the red-bar set for T450's craft marker):**

- [ ] **T430** [P] [US1] Gating-on-successful-print test (failing) — `tests/unit/renderer/receipts/ReprintAffordance.gating.test.tsx`
- [ ] **T431** [P] [US1] Invocation test (failing) — `tests/unit/renderer/receipts/ReprintAffordance.invocation.test.tsx`

**Implementation:**

- [ ] **T450** [US1] [IMPECCABLE craft] `<ReprintAffordance>` component — `src/renderer/ui/receipts/ReprintAffordance.tsx`
- [ ] **T451** [P] [US1] Wire `<ReprintAffordance>` into find-sale / recent-sale UI surfaces — `src/renderer/ui/receipts/ReprintAffordance.tsx` + integration point comment

**Slice 5 verification + close-out:**

- [ ] **T460** Vitest coverage assertion across reprint module set — `tests/`
- [ ] **T461** [§A1] **Manual counter-distance visual review** of `reprint_duplicate` slip (~1.5 m glance, ~2 sec; bilingual marker MUST be obvious) — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T462** [§A3] Hardware integration: reprint a sale on real thermal printer; verify marker, drawer does NOT pop, sale unchanged — `docs/hardware-matrix.md`
- [ ] **T463** Slice 5 functional sign-off + per-module coverage + manual visual review result + §A4 + §A3 sign-offs cross-referenced — `specs/008-sale-finalization-and-receipts/coordination.md`

### 4.2 The fourth `[IMPECCABLE craft]` invocation (T450) — apply §4.2 ritual

T450 is the fourth time the activation contract executes. Apply the canonical four-step ritual from `s2-preflight.md §4.2`:

- **Step 1 — Confirm Slice 0 §A1 sign-off + `/impeccable shape=pass`:** verify the §A1 reviewer signed off shape-brief sub-item **(e)** (reprint affordance). If sub-item (e) details have shifted since T173 / T290 / T360 fired, escalate to the §A1 reviewer for a sub-item refresh.
- **Step 2 — Red-bar check** (embed preflight §4.2):

  ```bash
  npm test -- --run tests/unit/renderer/receipts/ReprintAffordance.gating.test.tsx \
                tests/unit/renderer/receipts/ReprintAffordance.invocation.test.tsx
  ```

  Record RED confirmation + exit code in `coordination.md` under T450 before `/impeccable craft` fires.
- **Step 3 — Invoke `/impeccable craft 008-reprint-affordance`:** per the marker on T450. The component:
  - Gated visibility: visible ONLY when the Sale has at least one `print_events` row with `outcome='success'` (AD-10 reprint precondition; per T430).
  - Subscribes to `sales.subscribe` for `latest_print_event` updates.
  - Generates a fresh `idempotency_key` UUID v4 per click (T431 invariant).
  - Invokes `receipts.reprint` from S5a.
  - Touch target ≥ 44 × 44 CSS pixels (FR-068); keyboard-operable (FR-069).
  - Surfaces success / refusal via the standard generic-refusal-copy map.
- **Step 4 — Post-craft constitution checklist** (embed preflight §7): run the **nine-item** checklist (per `s3-preflight.md §6.2` Step 4 canonical list; nine items: no floats for money / no `_reference` copy / RTL / 44×44 / no optimistic UI / no PII in logs / no bridge-API call outside the typed preload bridge / reduced-motion respected / axe-core clean).

  Slice-specific binding for "no optimistic UI past durable commit": the affordance does NOT optimistically show a "reprint succeeded" state; the success state derives from the new `print_events` row's `outcome` being committed by T440's bridge handler.

  Failing any item = T450 NOT marked complete. Open a fixup commit before moving on.

### 4.3 T461 manual counter-distance visual review (§A1)

**This is a §A1 gate task** — operationally a §A1 verification check that the bilingual duplicate-copy marker actually delivers the FR-029 promise. The reviewer:

1. Prints a `reprint_duplicate` slip on the §A3 hardware-matrix printer.
2. Walks to the **customer side of the counter** (~1.5 m from the slip).
3. Glances at the slip for ~2 seconds (the typical glance duration a customer would devote to checking the slip is current vs duplicate).
4. **The bilingual marker MUST be obvious**:
   - Both languages (Arabic "نسخة طبق الأصل" + English "DUPLICATE COPY") visible.
   - Bold weight visibly heavier than body text.
   - Top-of-slip placement (not buried in the middle or footer).
5. If the reviewer has to squint, read carefully, or move closer → marker is too subtle → fails the review → S5b merge blocked. Re-open Slice 2's T162 `reprint_duplicate.bilingual.template` asset for marker-styling adjustment, then re-test.

Record outcome in `coordination.md` (pass / fail / fail-with-revisions) and `docs/hardware-matrix.md` (reviewer + date + printer model used).

### 4.4 Parallel-execution opportunities

T430 / T431 are `[P]` — two affordance-test subagents in parallel. T451 is `[P]` — independent integration wire-up.

**Recommended dispatch:** (T430 ∥ T431 in parallel — 2 subagents) → §4.2 ritual → T450 craft → T451 integration → T460 → T461 (manual visual) → T462 (hardware) → T463.

### 4.5 Hardware integration test (T462) — §A3-reviewer-attended

Per `s3-preflight.md §7.5`, hardware integration tests are §A3-reviewer-attended; NOT runnable in CI. T462:

- Real printer attached. Drive a 006 cash settlement → 008 finalize → 008 first-print succeeds (Slice 3) → drawer pops (Slice 4) → invoke `receipts.reprint` via `<ReprintAffordance>`.
- Assert: reprint slip prints with bilingual duplicate-copy marker (visual verification per T461); drawer does NOT pop on reprint (visual verification — listen for the drawer mechanism); `print_events` row INSERTed with `purpose='reprint', outcome='success', duplicate_copy_sequence_number=1`; no new `drawer_events` row; Sale row unchanged.
- Record observation notes in `docs/hardware-matrix.md` under the reprint test row.

If T462 fails empirically, STOP and escalate to the §A3 reviewer.

### 4.6 Forbidden paths (S5b)

`migrations/**`, `src/main/sales/**`, `src/main/receipts/**` (S5a + Slice 2 + Slice 3 territories; S5b imports but does not modify), `src/main/drawer/**` (Slice 4 territory), `src/preload/**`, `src/shared/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S5b touches **only** `src/renderer/ui/receipts/ReprintAffordance.tsx` and the corresponding test files under `tests/unit/renderer/receipts/ReprintAffordance.*`. Updates to `coordination.md` (T461 / T463) and `docs/hardware-matrix.md` (T462) are permitted.

### 4.7 Acceptance + close-out

- [ ] All two affordance tests (T430 / T431) pass per the red-bar / craft / green-bar sequence.
- [ ] T450 `<ReprintAffordance>` ships per §4.2 ritual.
- [ ] T451 wired into find-sale / recent-sale UI surfaces (the surfaces themselves are part of 005's existing search UI and 007's nav patterns — S5b touches only the receipt-affordance slot).
- [ ] T460 coverage assertion: ≥ 95% on reprint flow (carry-over from S5a); ≥ 90% on `<ReprintAffordance>`.
- [ ] **T461 §A1 manual counter-distance visual review** signed off (pass result). If "fail" or "fail-with-revisions", S5b merge blocked pending Slice 2 T162 asset re-styling.
- [ ] **T462 §A3 hardware integration** attended by §A3 reviewer; observation notes in `docs/hardware-matrix.md`.
- [ ] T463 records Slice 5 functional sign-off in `coordination.md`; §A2 no-op confirmed; §A4 + §A3 + §A1 (T461) sign-offs cross-referenced; per-module coverage numbers recorded.
- [ ] **Slice 5 closes.** Slice 6 (manual override + §A5 production readiness) becomes startable.

---

## 5. Cross-wave invariants

These rules apply to every wave (S5a / S5b). Violation = preflight violation; wave is rejected.

### 5.1 Constitution compliance (every wave)

- **No floats for money.** Reprint reads cached money fields from the Sale row; no new money paths.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** preserved.
- **No upward-of-bridge IPC.** S5b's renderer reaches main exclusively through `receipts.reprint` (S5a) + `sales.subscribe` (Slice 1).
- **No copy-paste from `_reference/Data-Pulse/`.** Constitution §P8.
- **PII / cards never in logs.** Constitution §P11. Reprint payload follows the same minimisation discipline as Slice 2's template engine (carries no PAN / CVV / voucher token / etc.).
- **Test-first.** Every implementation T-number is preceded by its failing-test T-number.

### 5.2 TDD ordering (every wave)

Within each wave: failing-test → implementation → green-bar. For T450 specifically, the §4.2 ritual is binding.

### 5.3 Forbidden-path enforcement (every wave)

Each wave's "Forbidden paths" section (§3.3 / §4.6) is binding. **NO wave in Slice 5 may modify `package.json` + `package-lock.json`** (the ESC/POS library from Slice 3 covers Slice 5's print dispatch; reprint uses the same pipeline).

### 5.4 Embed marker enforcement (this slice)

Slice 5 contains **one** `[IMPECCABLE craft]` marker (T450). All other Slice 5 tasks are non-marker. Any `/impeccable` invocation outside T450's craft is a preflight violation.

### 5.5 No new `purpose` values in `print_events.purpose` (this slice)

Slice 5 introduces `purpose='reprint'` on `print_events` rows — this value is already in the closed enum from Slice 1's T020 migration. Slice 5 does NOT add new enum values. If a slice ever needed to add a new `purpose` value, it would require a migration PR FIRST (analogous to Slice 3's `package.json` dep PR pattern).

### 5.6 Coordination updates

- S5a: §A4 `receipts.reprint` sign-off recorded; T403a receipt-number invariance test recorded (G1 remediation closure).
- S5b: T450 red-bar + post-craft constitution checklist recorded; T461 manual visual review outcome recorded; T462 hardware observation notes (in `hardware-matrix.md`; cross-referenced in `coordination.md`); Slice 5 functional sign-off (T463); §A2 no-op; §A3 + §A4 + §A1 sign-offs cross-referenced.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|:--|:--:|:--|
| §A4 reviewer not assigned by S5a authoring time | HIGH | Same pattern as prior slices. Draft PR allowed; merge blocks. |
| §A1 sub-item (e) (reprint affordance) shifted between earlier slices' sign-offs and Slice 5 | MEDIUM | §4.2 Step 1 escalation: if sub-item (e) shifted, §A1 reviewer refreshes before T450 fires. |
| T461 counter-distance visual review fails (marker too subtle) | HIGH | Re-open Slice 2's T162 `reprint_duplicate.bilingual.template` asset; adjust marker weight/size/placement; re-test. The customer-confusion risk this prevents is significant; do NOT relax the review threshold. |
| Reprint silently mutates the Sale row | HIGH | T403 explicit integration test. AD-3 SQLite trigger blocks UPDATE at schema layer; T403 asserts the application code never attempts it. Belt-and-suspenders. |
| Reprint silently kicks the drawer (FR-030 violation) | HIGH | T404 explicit integration test. Slice 4's T351 gating logic encodes the check; T404 verifies the integration. UNIQUE constraint on `drawer_events.sale_id` rejects anyway. |
| Receipt-number drift across reprint cycles (FR-011 violation) | HIGH | T403a explicit test (G1 remediation). Asserts receipt_number is invariant across first-print + retry + reprint cycles; only `duplicate_copy_sequence_number` increments. |
| Reprinting operator attributed as selling operator (FR-024 violation) | MEDIUM | T410 explicit test. The `print_events.acting_operator_id` MUST be the current signed-in operator (reprinting); the Sale's `selling_operator_id` is unchanged; the audit event carries BOTH. |
| Cross-tenant reprint information leak | HIGH | T411 explicit test. Tenant-isolation refusal returns `sale_not_found` (NOT `tenant_isolation`) per §A4 information-leak rule. |
| `<ReprintAffordance>` shows for a Sale with no successful print | MEDIUM | T430 explicit test. Gating: visible ONLY when the Sale has at least one `print_events.outcome='success'` row. Subscribes to `sales.subscribe` for updates so the gate flips reactively. |
| Hardware integration test (T462) fails empirically | HIGH | Stop and escalate to §A3 reviewer. Possible root causes: printer marker rendering regression, drawer-kick gating regression (re-open Slice 4), or wrong test expectation. |

---

## 7. Open coordination follow-ups (before Slice 5 can start)

- [ ] **Slice 4 closed** (T374 functional sign-off).
- [ ] **Slice 0 §A1 sign-off** (T010 + T011); covers shape-brief sub-item (e) for T450 craft.
- [ ] **§A4 reviewer assigned** for `receipts.reprint`.
- [ ] **§A3 reviewer available** for T462 hardware-attended test.
- [ ] **§A1 reviewer available** for T461 counter-distance manual visual review.
- [ ] **Ahmed §A1 acceptance** (preflight #241 §9 box).
- [ ] **T002 feature-flag PR** merged.

---

## 8. Preflight metadata

**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Tasks:** [../tasks.md](../tasks.md) (Phase 7 — Slice 5)
**Coordination:** [../coordination.md](../coordination.md)
**Bridge contract:** [../contracts/bridge-api.md](../contracts/bridge-api.md)
**Hardware matrix:** [../../../docs/hardware-matrix.md](../../../docs/hardware-matrix.md)
**Research:** [../research.md](../research.md) §R-13 (receipt-number invariance) · §R-6 (template engine variant routing)
**Embed preflight (cross-feature):** [../../../docs/impeccable-embed-preflight.md](../../../docs/impeccable-embed-preflight.md)
**Slice 1 preflight:** [./s1-preflight.md](./s1-preflight.md)
**Slice 2 preflight (canonical `/impeccable craft` ritual at §4.2):** [./s2-preflight.md](./s2-preflight.md)
**Slice 3 preflight:** [./s3-preflight.md](./s3-preflight.md)
**Slice 4 preflight:** [./s4-preflight.md](./s4-preflight.md)
**Constitution version pinned:** v1.5.1
**Authored:** 2026-05-26
**Owner:** Slice 5 implementing agent; §A4 reviewer for S5a sign-off; §A1 reviewer for T450 shape=pass carry-over + T461 manual counter-distance review; §A3 reviewer for T462 hardware integration; Ahmed for Slice 5 functional sign-off (T463).

---

**End of Slice 5 preflight. S6 preflight to follow.**
