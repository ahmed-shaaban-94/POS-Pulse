# 008 Slice 2 Preflight — Receipt payload generation + preview

> **For agentic workers:** This preflight is the per-wave implementation plan for Slice 2 of 008-sale-finalization-and-receipts. Slice 2 ships in **two sequential waves** (S2a → S2b). Each wave is **one PR**. Each wave has a strict file allow-list; touching anything outside is a preflight violation.
>
> **Source of truth (in priority order):**
>
> 1. `specs/008-sale-finalization-and-receipts/tasks.md` — canonical T-numbers + per-task acceptance criteria
> 2. `specs/008-sale-finalization-and-receipts/coordination.md` — live gate ledger + sign-off records
> 3. `specs/008-sale-finalization-and-receipts/contracts/bridge-api.md` — `receipts.preview` contract (§A4 reviewed before S2b ships)
> 4. `specs/008-sale-finalization-and-receipts/data-model.md` — Sale row fields the payload module reads
> 5. `specs/008-sale-finalization-and-receipts/research.md` §R-6 (single-source template engine) + §R-13 (conditional fields) + §R-14 (byte-stability)
> 6. `docs/impeccable-embed-preflight.md` — Slice 2 fires the **first** `[IMPECCABLE craft]` marker (T173) in 008; §4.2 red-bar check is binding
>
> **This preflight does NOT replace tasks.md.** When this preflight and tasks.md disagree, tasks.md wins.

---

## 0. Slice 2 in one paragraph

Slice 2 implements the **AD-6 receipt template engine** (single-source, dual-output: ESC/POS bytes + HTML/canvas from one template + one payload), authors the three bilingual template asset variants (`first_print` / `reprint_duplicate` / `preview`), derives the canonical `ReceiptPayload` from a persisted `sales` row (never re-reads cart_lines, never calls catalogue, never re-validates voucher), implements the `receipts.preview` bridge handler with strict no-side-effect semantics, and ships the `<ReceiptPreview>` renderer component. **No actual printing. No drawer kicking.** Those start at Slice 3.

User stories covered: US1 scenarios **3** (payload from durable sale), **6** (preview), **13** (attribution), **11** (voucher-safe), **12** (external-card-safe).

Test floor (per tasks.md line 238): ≥ 95% on the template engine; ≥ 90% on the preview UI; byte-stability tests; voucher-data + card-data minimisation tests.

**First `[IMPECCABLE craft]` marker fires in this slice** (T173 — `<ReceiptPreview>`). The activation contract from `docs/impeccable-embed-preflight.md` (§4.2 red-bar check + §7 post-craft constitution checklist) goes live here for the first time.

---

## 1. Gates blocking Slice 2

| Gate | What it gates within Slice 2 | Closed by |
|:--:|:--|:--|
| **§A0** | Upstream readiness + `/speckit-plan` v1.0 + `/speckit-analyze` | ✅ Cleared (PR #238) |
| **§A1** | Slice 0 visual direction MUST sign off first. Slice 2 has TWO §A1 touch-points: (a) the three template asset content (T161 / T162 / T163), where the printed-slip layout was authored by the §A1 reviewer per embed preflight §3.3; (b) the `<ReceiptPreview>` craft (T173), where `/impeccable shape=pass` is the §A1 sign-off. **Slice 2 cannot start before Slice 0 §A1 closes.** | T011 sign-off in `coordination.md` |
| **§A2** | Backend / OpenAPI — **no-op every 008 slice** (AD-12) | Documentation-only sign-off in T182 |
| **§A3** | Migrations — no new migrations in Slice 2 (Slice 1 territory). Slice 2 reads from `sales` only. | Pre-cleared by Slice 1 §A3 sign-off |
| **§A4** | `receipts.preview` bridge surface review (1 new handler; eight-item checklist from `contracts/bridge-api.md`) | S2b sign-off (recorded in `coordination.md`) |
| **§A5** | Production-readiness — Slice 6 concern, **not blocking Slice 2** | Slice 6 T520–T528 |

**Wave-to-gate mapping:**

- **S2a** is gated on **§A1** (the three template asset files T161/T162/T163 carry the §A1-authored printed-slip layout). S2a may open as a draft PR before §A1 sign-off lands; merge blocks on §A1.
- **S2b** is gated on **§A4** (`receipts.preview` review) AND on **§A1 sign-off via `/impeccable shape=pass`** (T173 craft cannot fire before shape=pass is recorded). S2b also depends on S2a having merged (T170 invokes T160's engine + T164's payload module).

**Slice 1 dependency:** Slice 2 reads from `sales` via the repository authored in S1c (T081). Slice 2 cannot start until Slice 1 closes (T113 functional sign-off).

---

## 2. Wave decomposition

### Wave overview

| Wave | Title | Tasks | ~Count | Sequential predecessor |
|:--:|:--|:--|:--:|:--|
| **S2a** | Template engine + payload + three bilingual template assets + minimisation tests | T120 / T121 / T122 / T123 / T124 / T125 / T130 / T131 / T132 / T133 / T134 / T160 / T161 / T162 / T163 / T164 | 16 | Slice 1 closed |
| **S2b** | `receipts.preview` bridge + preload + `<ReceiptPreview>` (first `[IMPECCABLE craft]`) + Slice 2 close-out | T140 / T141 / T142 / T150 / T151 / T152 / T170 / T171 / T172 / T173 / T180 / T181 / T182 | 13 | S2a merged + Slice 0 §A1 sign-off |

**Total: 29 tasks across 2 sequential waves.** Within each wave, multiple T-numbers are `[P]` tagged in tasks.md and can run as parallel subagents — see "Parallel-execution opportunities" per wave below.

---

## 3. Wave S2a — Template engine + payload + bilingual template assets

**Branch:** `feat/008-s2a-template-engine` off `main` (after Slice 1 closes).
**Gate cleared by this wave:** §A1 template asset content sign-off (carried in T161 / T162 / T163; the §A1 reviewer must have signed off the printed-slip layout in Slice 0).
**Single PR.**

### 3.1 Task list (tasks.md T120–T164)

**Template engine tests (TDD-first):**

- [ ] **T120** [P] [US1] Dual-output test (failing) — `tests/unit/main/receipts/template-engine.dual-output.test.ts`
- [ ] **T121** [P] [US1] Byte-stability test (failing) — `tests/unit/main/receipts/template-engine.byte-stable.test.ts`
- [ ] **T122** [P] [US1] Arabic-first RTL + Latin-numerals test (failing) — `tests/unit/main/receipts/template-engine.bilingual-rtl.test.ts`
- [ ] **T123** [P] [US1] `reprint_duplicate` bilingual marker test (failing) — `tests/unit/main/receipts/template-engine.duplicate-marker.test.ts`
- [ ] **T124** [P] [US1] `formatters` module routing test (failing) — `tests/unit/main/receipts/template-engine.formatters.test.ts`
- [ ] **T125** [P] [US1] Sale-level VAT footer test (failing) — `tests/unit/main/receipts/template-engine.vat-footer.test.ts`

**Payload minimisation tests:**

- [ ] **T130** [P] [US1] Card-data minimisation test (failing) — `tests/unit/main/receipts/template-engine.card-data-minimisation.test.ts`
- [ ] **T131** [P] [US1] Voucher-data minimisation test (failing) — `tests/unit/main/receipts/template-engine.voucher-data-minimisation.test.ts`
- [ ] **T132** [P] [US1] `external_reference` conditional-emission test (failing) — `tests/unit/main/receipts/template-engine.external-reference-conditional.test.ts`
- [ ] **T133** [P] [US1] `voucher_authority_redemption_id` conditional-emission test (failing) — `tests/unit/main/receipts/template-engine.voucher-redemption-id-conditional.test.ts`
- [ ] **T134** [P] [US1] Tender labels (bilingual generic) test (failing) — `tests/unit/main/receipts/template-engine.tender-labels.test.ts`

**Implementation:**

- [ ] **T160** [US1] AD-6 template engine implementation (≤ 200 LOC; no Handlebars / EJS / Mustache) — `src/main/receipts/templates/engine.ts`
- [ ] **T161** [P] [US1] `first_print.bilingual.template` asset — `src/main/receipts/templates/first-print.bilingual.template`
- [ ] **T162** [P] [US1] `reprint_duplicate.bilingual.template` asset with bilingual duplicate-copy marker — `src/main/receipts/templates/reprint-duplicate.bilingual.template`
- [ ] **T163** [P] [US1] `preview.bilingual.template` asset (FR-025 / R-14 byte-stability with `first_print`) — `src/main/receipts/templates/preview.bilingual.template`
- [ ] **T164** [P] [US1] `receipts-payload.ts` payload derivation module — `src/main/receipts/receipts-payload.ts`

### 3.2 Parallel-execution opportunities

T120 / T121 / T122 / T123 / T124 / T125 / T130 / T131 / T132 / T133 / T134 / T161 / T162 / T163 / T164 are all `[P]` — fifteen `[P]` tasks. Two natural dispatch batches:

- **Test batch (11 subagents):** T120 ∥ T121 ∥ T122 ∥ T123 ∥ T124 ∥ T125 ∥ T130 ∥ T131 ∥ T132 ∥ T133 ∥ T134 (all `[P]` tests can author in parallel).
- **Asset + payload batch (4 subagents):** T161 ∥ T162 ∥ T163 ∥ T164 (three template assets + one payload module — all `[P]`).
- **T160 is sequential** — the engine implementation must come after the test batch but before (or in parallel with) the asset batch (T160 will fail to load assets that don't yet exist, but assets without an engine are inert).

**Recommended dispatch:** Test batch (11 subagents in parallel) → T160 → Asset + payload batch (4 subagents in parallel) → green-bar verification across all tests.

### 3.3 Forbidden paths (S2a)

`migrations/**` (Slice 1 territory), `src/main/sales/**` (Slice 1 territory; S2a may import from sales repositories via the payload module but must not modify them), `src/renderer/**` (S2b territory), `src/preload/**` (S2b territory), `src/shared/**` (S2b territory for receipts.preview types; S2a may use the receipts types module from Slice 1 T033 but must not modify it), `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S2a touches **only** `src/main/receipts/**` and the corresponding test files under `tests/unit/main/receipts/`.

### 3.4 Acceptance + close-out

- [ ] All eleven test tasks (T120–T125 + T130–T134) pass. Initial RED bar verified before implementation; final GREEN bar verified after.
- [ ] T160 engine implementation: ≤ 200 LOC, no third-party template engine dependency (no Handlebars / EJS / Mustache); reads template asset + `ReceiptPayload`, emits ESC/POS bytes + HTML from one render call.
- [ ] T161 / T162 / T163: three bilingual template asset files exist; the §A1 reviewer signed off the printed-slip layout in Slice 0 (carry-over). T162 contains the bilingual marker "نسخة طبق الأصل — DUPLICATE COPY" in the header band per FR-029; T161 + T163 do NOT.
- [ ] T164 payload module: derives `ReceiptPayload` from a `sales` row's cached fields only — no `cart_lines` re-read, no catalogue API, no voucher re-validation. FR-015 / R-13 / R-14 invariants tested.
- [ ] Card-data minimisation (T130) and voucher-data minimisation (T131) tests cover every fixture in `quickstart.md §"Test fixtures"`; outputs contain zero PAN / CVV / track / cardholder / expiry / auth_payload / cryptogram / voucher_code / voucher_balance / voucher_holder_pii / voucher_redemption_intent_token / raw_authority_payload.
- [ ] Conditional-field tests (T132 / T133): `external_reference` and `voucher_authority_redemption_id` appear on the slip ONLY when carried in the Sale row's `tender_lines_summary_json`.
- [ ] Vitest `tests/unit/main/receipts/` all green; per-module coverage ≥ 95% on the template engine + payload module.
- [ ] **No `[IMPECCABLE]` marker fires in S2a.** S2a has zero renderer code. T173 is S2b territory.

---

## 4. Wave S2b — `receipts.preview` bridge + `<ReceiptPreview>` + Slice 2 close-out

**Branch:** `feat/008-s2b-preview-bridge-and-ui` off `main` (after S2a merges).
**Gate cleared by this wave:** §A4 (`receipts.preview` review) + Slice 2 functional close-out (T182).
**Single PR.**
**First `[IMPECCABLE craft]` marker invocation in 008** (T173).

### 4.1 Task list (tasks.md T140–T182 subset)

**`receipts.preview` bridge tests:**

- [ ] **T140** [P] [US1] Bridge happy-path test (failing) — `tests/unit/main/receipts/bridge.receipts-preview.test.ts`
- [ ] **T141** [P] [US1] Bridge no-side-effects test (failing) — `tests/unit/main/receipts/bridge.receipts-preview.no-side-effects.test.ts`
- [ ] **T142** [P] [US1] Bridge forbidden-field-in-request guard test (failing) — `tests/unit/main/receipts/bridge.receipts-preview.forbidden-field-guard.test.ts`

**`<ReceiptPreview>` renderer tests (the red-bar set for T173's craft marker):**

- [ ] **T150** [P] [US1] Renderer component test (failing) — `tests/unit/renderer/receipts/ReceiptPreview.test.tsx`
- [ ] **T151** [P] [US1] Non-blocking dismiss test (failing) — `tests/unit/renderer/receipts/ReceiptPreview.non-blocking.test.tsx`
- [ ] **T152** [P] [US1] Accessibility (keyboard + axe) test (failing) — `tests/unit/renderer/receipts/ReceiptPreview.a11y.test.tsx`

**Bridge + preload + renderer implementation:**

- [ ] **T170** [US1] `receipts.preview` bridge handler — `src/main/receipts/receipts-bridge.ts`
- [ ] **T171** [US1] Extend `src/shared/bridge-api.ts` with `receipts.preview` types — `src/shared/bridge-api.ts`
- [ ] **T172** [US1] Preload wiring — `src/preload/receipts.ts` + central preload entry
- [ ] **T173** [US1] [IMPECCABLE craft] `<ReceiptPreview>` component — `src/renderer/ui/receipts/ReceiptPreview.tsx`

**Slice 2 verification + close-out:**

- [ ] **T180** Vitest coverage assertion across `tests/unit/main/receipts/` + `tests/unit/renderer/receipts/` — `tests/`
- [ ] **T181** Manual smoke (dev fixture): 006 settle → 008 finalize → preview a receipt; observe RTL layout + Latin numerals + correct sale number + sale-level VAT + no voucher/card data — `coordination.md`
- [ ] **T182** Slice 2 functional sign-off + per-component coverage in `coordination.md`; §A2 no-op confirmed; §A4 `receipts.preview` sign-off cross-referenced — `coordination.md`

### 4.2 The first `[IMPECCABLE craft]` invocation (T173) — binding ritual

T173 is the **first time** the activation contract from `docs/impeccable-embed-preflight.md` goes live. The implementing agent MUST execute the following sequence in order. Skipping any step is a preflight violation.

#### Step 1: Confirm Slice 0 §A1 sign-off + `/impeccable shape=pass`

Before T173 fires, the embedder verifies in `coordination.md`:

- §A1 reviewer (Ahmed) has signed off `visual-direction/README.md` (T011).
- `/impeccable shape=pass` is recorded against the renderer-portion of the shape brief (sub-items d / e / f / g per embed preflight §3.3).
- The shape brief covers `<ReceiptPreview>` specifically (sub-item d — preview UI panel).

If any of the above is missing: **STOP**. Escalate to §A1 reviewer. Do not proceed.

#### Step 2: Red-bar check (embed preflight §4.2)

Run the failing tests locally and confirm RED:

```bash
npm test -- --run tests/unit/renderer/receipts/ReceiptPreview.test.tsx \
              tests/unit/renderer/receipts/ReceiptPreview.non-blocking.test.tsx \
              tests/unit/renderer/receipts/ReceiptPreview.a11y.test.tsx
```

Expected: three test files, all failing (component does not yet exist).

Record the RED confirmation in `coordination.md` under T173 with the test run's exit code + a one-line note. **A craft marker invoked against GREEN tests is a preflight violation** — the contract enforcement fails open silently otherwise.

#### Step 3: Invoke `/impeccable craft 008-receipt-preview`

Per the marker on T173, invoke the skill with target `008-receipt-preview`. The skill operates against `docs/DESIGN.md` (renamed to canonical Stitch format in PR #241) and the §A1 shape brief.

Implementation lives at `src/renderer/ui/receipts/ReceiptPreview.tsx`. The component:

- Invokes `receipts.preview({ sale_id, idempotency_key })` via the preload bridge.
- Renders the returned HTML in a scrollable preview panel.
- Is dismissible without side-effect (T151).
- Is keyboard-operable (tab to close, escape to dismiss); axe-clean default state (T152).
- Meets the 44 × 44 CSS-pixel touch-target floor on any interactive control (FR-068).
- Mirrors the printed slip visually (T150).

#### Step 4: Post-craft constitution checklist (embed preflight §7)

After T173 completes, the embedder runs the nine-item checklist against the produced code:

- [ ] No floats for money. Any displayed money value uses `src/shared/payments/money-math.ts`.
- [ ] No copy-paste from `_reference/Data-Pulse/`. Re-derived only.
- [ ] RTL default. Component works in `dir="rtl"` without horizontal scroll, mirrored chevrons, or trapped focus order.
- [ ] 44 × 44 invariant. All interactive elements clear the CI invariant floor.
- [ ] No optimistic UI past durable commit. The preview reads from a persisted sale; no pre-persist preview affordance.
- [ ] No PII / card data in logs. No `console.log` / `pino.info` / Sentry capture of operator full names, customer info, voucher tokens, card pan/issuer, or pin records.
- [ ] Preload bridge only. No direct `ipcRenderer` access in the component.
- [ ] Reduced-motion respected. Any animation wraps in `prefers-reduced-motion: reduce` no-op.
- [ ] Axe-core clean. Embedder runs `npx axe` locally before marking T173 complete.

Failing any line = T173 NOT marked complete. Open a fixup commit before moving on.

### 4.3 Parallel-execution opportunities

T140 / T141 / T142 are `[P]` — three bridge tests in parallel. T150 / T151 / T152 are `[P]` — three component tests in parallel (these are the red-bar set for T173). T170 / T171 are sequential (T170 needs T171's types). T172 depends on T170 + T171. T173 depends on the red-bar set (T150 / T151 / T152) being in place and on T170 / T171 / T172 being landed (T173 invokes the bridge through the preload).

**Recommended dispatch:** (T140 ∥ T141 ∥ T142 ∥ T150 ∥ T151 ∥ T152 in parallel — 6 subagents authoring tests) → T171 → T170 → T172 → §4.2 ritual → T173 craft → T180 → T181 → T182.

### 4.4 Forbidden paths (S2b)

`migrations/**`, `src/main/sales/**` (Slice 1 territory), `src/main/receipts/templates/**` (S2a territory; S2b may import the engine + payload modules but must not modify them), `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S2b touches **only** `src/main/receipts/receipts-bridge.ts`, `src/shared/bridge-api.ts` (incremental extension), `src/preload/receipts.ts`, the central preload entry, `src/renderer/ui/receipts/ReceiptPreview.tsx`, and the corresponding test files. Updates to `coordination.md` are permitted (T181 / T182 write there).

### 4.5 Acceptance + close-out

- [ ] All six test tasks (T140 / T141 / T142 / T150 / T151 / T152) pass.
- [ ] T170 `receipts.preview` handler: gated on `requireOperatorSession`; reads Sale via Slice 1's repository; derives payload via T164; renders HTML via T160; returns `{ kind: 'ok', preview: { html, width_chars, bilingual_locale } }`.
- [ ] T141 invariant verified: `receipts.preview` does NOT emit `receipts.print`, does NOT kick the drawer, does NOT mutate the Sale.
- [ ] T142 invariant verified: defensive forbidden-field guard at handler entry refuses requests with forbidden keys.
- [ ] T171 type extension lands incrementally on top of Slice 1's `BridgeApi` foundation.
- [ ] T173 `<ReceiptPreview>` ships per §4.2 ritual (red-bar confirmed; `/impeccable craft` invoked; post-craft constitution checklist all green).
- [ ] **§A4 reviewer signs off** the `receipts.preview` surface against the eight-item checklist in `contracts/bridge-api.md`.
- [ ] T180 coverage assertion: ≥ 95% on template engine + payload (carry-over from S2a), ≥ 90% on `<ReceiptPreview>`.
- [ ] T181 manual smoke produces a preview with RTL layout + Latin numerals + correct sale number + sale-level VAT footer + no voucher / card data.
- [ ] T182 records Slice 2 functional sign-off in `coordination.md`; §A2 no-op confirmed; §A4 sign-off cross-referenced.
- [ ] **Slice 2 closes.** Slice 3 (print pipeline + printer-failure banner) becomes startable.

---

## 5. Cross-wave invariants

These rules apply to every wave (S2a / S2b). Violation = preflight violation; wave is rejected.

### 5.1 Constitution compliance (every wave)

- **No floats for money.** Any displayed money value goes through `src/shared/payments/money-math.ts`. `total_minor` / `total_tax_minor` / per-tender amounts in the payload are integer minor units.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** preserved on every BrowserWindow. S2a touches no renderer surface; S2b adds renderer code that MUST respect these.
- **No upward-of-bridge IPC.** S2b's renderer reaches main exclusively through `receipts.preview` in the typed preload bridge.
- **No copy-paste from `_reference/Data-Pulse/`.** Constitution §P8.
- **PII / cards never in logs.** Constitution §P11. The minimisation tests (T130 / T131) lock the redaction discipline. The template engine + payload module MUST NOT log any payload content.
- **Test-first.** Every implementation T-number is preceded by its failing-test T-number.

### 5.2 TDD ordering (every wave)

Within each wave, the order is: failing-test task → implementation task → green-bar verification. The implementing agent runs `npm test -- --run <test-file-pattern>` against the wave's test files **after** authoring the test, confirms RED, then implements the corresponding module(s) until the test goes GREEN.

For T173 specifically, the §4.2 red-bar ritual is binding — the RED confirmation is recorded in `coordination.md` before `/impeccable craft` fires.

### 5.3 Forbidden-path enforcement (every wave)

Each wave's "Forbidden paths" section (§3.3 / §4.4) is binding. Pre-merge check: `git diff --name-only main...HEAD` against the wave's allow-list. Anything outside the allow-list is a preflight violation and must be removed before merge.

### 5.4 Embed marker enforcement (this slice)

Slice 2 contains **one** `[IMPECCABLE craft]` marker (T173). All other Slice 2 tasks are non-marker. Any `/impeccable` invocation outside T173's craft is a preflight violation. The §4.2 ritual (Step 1 confirm Slice 0 sign-off → Step 2 red-bar check → Step 3 craft → Step 4 post-craft checklist) is the **only** legal invocation path in Slice 2.

### 5.5 Coordination updates

Each wave's close-out updates `coordination.md`:

- S2a: no coordination update during the wave itself; §A1 carry-over from Slice 0 (T011) is the cleared status. The template assets (T161 / T162 / T163) inherit the §A1 sign-off from Slice 0; they do not require a fresh sign-off.
- S2b: §A4 `receipts.preview` sign-off recorded; T173 red-bar confirmation recorded; T173 post-craft constitution checklist recorded; Slice 2 functional sign-off (T182) recorded; §A2 no-op confirmed; manual-smoke results from T181 recorded.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|:--|:--:|:--|
| Slice 0 §A1 sign-off not yet landed when S2a authoring begins | HIGH | S2a can author against the §A1-reviewer-drafted printed-slip layout once T011 lands. S2b cannot fire T173 craft without `/impeccable shape=pass` recorded. Open `coordination.md` follow-ups must close before S2b opens. |
| §A4 reviewer not assigned by S2b authoring time | HIGH | S2b draft PR may open with the reviewer slot `[NEEDS ASSIGNMENT]`; merge blocks until §A4 signs off. Reviewer assignment tracked in `coordination.md` §A4 thread. |
| Template engine ≤ 200 LOC budget overrun | MEDIUM | T160 spec caps the engine at ~200 LOC (R-6 no Handlebars). If the engine exceeds budget, simplify the template asset format (data + layout description) rather than pulling in a third-party engine. The single-source single-pass dual-output discipline is the constraint that keeps the engine small. |
| Byte-stability regression between renders | MEDIUM | T121 test asserts byte-identical outputs for the same template + same payload modulo variant-controlled fields. CI enforces. Any drift surfaces as a test failure, not as a silent rendering difference. |
| `external_reference` / `voucher_authority_redemption_id` leakage on slip | HIGH | T132 / T133 explicitly test conditional emission (present on slip only when carried in Sale row). If 006 OQ-PLAN-5 changes resolution, this test will catch the leakage immediately. |
| First `/impeccable craft` invocation drifts from contract | MEDIUM | §4.2 ritual is binding. The post-craft constitution checklist (nine items) is the safety net. Failing any item blocks T173 completion. |
| RTL rendering regression on paired Windows terminal | MEDIUM | T122 test asserts Arabic-first RTL flow + Latin numerals on printed output. The single-font-stack (Inter Variable → Segoe UI → system-UI) avoids proprietary-font fallback drift. |
| Payload module accidentally re-reads `cart_lines` or calls catalogue | HIGH | T164 spec is explicit: derives from `sales` row cached fields ONLY. Code review must verify; no integration test that exercises a stale `cart_lines` (since 005 closes its cart on settle, there is no test path that could regress this). Defense-in-depth via test review. |

---

## 7. Open coordination follow-ups (before Slice 2 can start)

These items are pre-Slice-2 work; they don't block authoring this preflight but DO block S2a's first commit (Slice 1) or S2b's first commit (Slice 0 §A1):

- [ ] **Slice 1 closed.** S2a cannot start until T113 functional sign-off lands. Slice 1 is the load-bearing predecessor (payload module reads from `sales` repository authored in S1c).
- [ ] **Slice 0 §A1 sign-off** (T010 + T011). S2a's template asset content depends on the §A1-reviewer-authored printed-slip layout. S2b's T173 craft depends on `/impeccable shape=pass`.
- [ ] **§A1 reviewer (Ahmed) acceptance** of the shape-brief-approver role per embed preflight §3 (the §9 box from PR #241).
- [ ] **§A4 reviewer assignment** + target review date for the `receipts.preview` surface (`coordination.md` §A4 thread).
- [ ] **T002 feature-flag PR** — `sale_finalization` flag in `src/shared/app-config.ts` + `FeatureFlagsState` extension in the renderer store. **Slice 2 requires T002** (the preview UI surface gates on the flag); cannot proceed without it.

---

## 8. Preflight metadata

**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Tasks:** [../tasks.md](../tasks.md) (Phase 4 — Slice 2)
**Coordination:** [../coordination.md](../coordination.md)
**Data model:** [../data-model.md](../data-model.md)
**Bridge contract:** [../contracts/bridge-api.md](../contracts/bridge-api.md)
**Research:** [../research.md](../research.md) §R-6 (single-source template engine) · §R-13 (conditional fields) · §R-14 (byte-stability)
**Embed preflight (cross-feature):** [../../../docs/impeccable-embed-preflight.md](../../../docs/impeccable-embed-preflight.md)
**Slice 1 preflight (predecessor):** [./s1-preflight.md](./s1-preflight.md)
**Constitution version pinned:** v1.5.1
**Authored:** 2026-05-26
**Owner:** Slice 2 implementing agent (single agent or subagent fleet); §A4 reviewer for S2b sign-off; §A1 reviewer for T173 `/impeccable shape=pass` event; Ahmed for Slice 2 functional sign-off (T182).

---

**End of Slice 2 preflight. S3 / S4 / S5 / S6 preflights to follow at slice-commission time.**
