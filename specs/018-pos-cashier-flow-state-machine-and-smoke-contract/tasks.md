# Tasks: POS Cashier Flow State Machine & Smoke Contract

**Feature:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on incomplete tasks).
- **`[USn]`** maps the task to a documentation-story phase (one per spec Goal G-1..G-6). Setup,
  Foundational, and Polish phases have no story label.
- File paths are repository-relative.
- **DOCS-ONLY:** every task below authors or verifies Markdown under
  `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/`. **No task authors `src/`, OpenAPI,
  migration, package, lockfile, or CI.** Any task that appears to require such work is OUT OF SCOPE
  and belongs to the separate, owner-gated payment-finalization-hardening lane.
- **Stories = spec Goals.** The spec has Goals (G-1..G-6) and scenarios, not prioritized user stories.
  No P1/P2 code-priority is fabricated; story order follows Goal order.

## Phase 1 — Setup

- [ ] T001 Confirm spec-kit feature resolution pins this feature (via `SPECIFY_FEATURE_DIRECTORY` / `SPECIFY_FEATURE`) and that `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` is the active spec; record the misfire mitigation note in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/plan.md` (Risks & Open Items).
- [ ] T002 [P] Verify `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/plan.md` pins constitution v1.5.1 and is marked SPECIFY/PLAN-ONLY.

## Phase 2 — Foundational (Blocking Prerequisites)

- [ ] T003 Confirm the verified shipped-mechanism facts M-1..M-4 are recorded in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/research.md` (auto-finalize, POS-local settlement, multi-tender FSM, money path) — these gate every downstream story.
- [ ] T004 Confirm the Constitution Check (Initial + Post-Design) in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/plan.md` records PASS for I–IX and P1–P18 with P10/P15 explicitly DEFERRED (no VIOLATION, no WAIVED).
- [ ] T005 [P] Confirm all twelve §10 owner-decisions are captured as DEFERRED in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` Clarifications, `research.md` (R4), and `plan.md` (Risks & Open Items) — none silently decided.

## Phase 3 — US1 (G-1): Canonical cashier sale state machine

**Goal:** The cashier sale state machine is defined and mapped to the shipped mechanism.
**Independent test:** A reviewer can read the §5 state table and trace every state to a shipped
indicator (M-1..M-4) without consulting other artifacts.

- [ ] T006 [US1] Verify the §5 state machine in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` lists every state with allowed/forbidden actions, mechanism/indicator, owner, and smoke evidence.
- [ ] T007 [P] [US1] Confirm `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/data-model.md` (E1) reproduces the state set and marks FINALIZABLE/FINALIZING/COMPLETED as logical/backend states (M-1).
- [ ] T008 [P] [US1] Confirm `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/contracts/cashier-flow-state-contract.md` fixes the states and labels OPEN transitions (post-handoff edit; cancel→cart-or-void).

## Phase 4 — US2 (G-2): Transition rules

**Goal:** The transition rules are defined and keyed to the §5 states.
**Independent test:** A reviewer can follow each load-bearing transition (empty-cart-blocked,
exact/over→FINALIZABLE, duplicate-confirm idempotent, COMPLETED→RECEIPT_READY, sync 401/403/replay).

- [ ] T009 [US2] Verify §6 transition table in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` is adopted verbatim from Spec-029 §7 and keyed to §5 states.
- [ ] T010 [P] [US2] Confirm `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/data-model.md` State-transitions section mirrors §6 and marks the OPEN transitions.

## Phase 5 — US3 (G-3): Money invariants

**Goal:** Money invariants are defined as integer minor units with display separate from calculation.
**Independent test:** A reviewer can check each of invariants 1–12 and confirm float never decides
finalization.

- [ ] T011 [US3] Verify §7 invariants 1–12 in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` reference integer minor units (`src/shared/money.ts`) and the POS-local finalize gate (M-2).
- [ ] T012 [P] [US3] Confirm the derived-values + validation-rules sections in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/data-model.md` restate invariants 1–12 consistently (remaining ≥ 0, changeDue ≥ 0, no NaN).

## Phase 6 — US4 (G-4): Payment scenarios A–G + cashier/offline scenarios

**Goal:** Payment scenarios A–G and the §9 cashier/offline scenarios are defined with required smoke
evidence.
**Independent test:** A reviewer can map each A–G row and each §9 scenario to a deterministic expected
result and its smoke evidence.

- [ ] T013 [US4] Verify §8 scenarios A–G in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` each have saleTotal/paid/remaining/change/finalize/result.
- [ ] T014 [P] [US4] Verify §9 cashier/offline scenarios in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/spec.md` cover the required Spec-029 §10 set (fresh-terminal, search, cart edits, handoff, finalize, receipt, sync 401/403/replay, restart/crash, clock-wrong, flag-disabled).
- [ ] T015 [P] [US4] Confirm `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/contracts/smoke-evidence-contract.md` reproduces the A–G result table and the §9 required set as the evidence bar.
- [ ] T016 [P] [US4] Confirm `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/quickstart.md` gives the reviewer walkthrough for A–G + §9 with money checks at every step.

## Phase 7 — US5 (G-5): Smoke-evidence bar for G-POS-CASHIER-SMOKE (no gate registration)

**Goal:** The evidence bar that POS produces toward `G-POS-CASHIER-SMOKE` is recorded WITHOUT
registering the gate.
**Independent test:** A reviewer confirms the evidence bar exists and that no artifact registers or
activates the gate.

- [ ] T017 [US5] Verify `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/contracts/smoke-evidence-contract.md` records the evidence bar and the explicit non-registration statement.
- [ ] T018 [P] [US5] Confirm the evidence FORM (manual script / automated regression / screenshots) is enumerated as candidates and marked DEFERRED to the owner in `smoke-evidence-contract.md` and `plan.md` (Test Strategy).

## Phase 8 — US6 (G-6): Keep implementation out of scope; surface OPEN owner-decisions

**Goal:** The chain authors no runtime code and surfaces (not decides) the §10 owner-decisions.
**Independent test:** A reviewer confirms no `src/`/OpenAPI/migration/CI artifact exists in the
feature folder and that every owner-decision is marked OPEN.

- [ ] T019 [US6] Verify `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/plan.md` Project-Layout + CI/Build/Package sections author nothing and only reference existing `origin/main` seams as read-only.
- [ ] T020 [P] [US6] Confirm `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/research.md` R3 records the 028 (sale-sync auth) and Data-Pulse-2 (server capture) boundary ownership, bound by reference.
- [ ] T021 [P] [US6] Confirm the owner-gated payment-finalization-hardening lane is named as the downstream, out-of-scope follow-up in `plan.md` and `quickstart.md`.

## Phase Final — Polish & Cross-Cutting

- [ ] T022 Run `/speckit-analyze` and confirm zero CRITICAL findings across `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/{spec.md,plan.md,tasks.md}` plus the Phase 1 artifacts; record the report (read-only — no file edits by analyze).
- [ ] T023 [P] Verify terminology is consistent across all artifacts (FINALIZABLE/FINALIZING/COMPLETED logical states; POS-local gate; multi-tender FSM; OPEN owner-decisions) in `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/`.
- [ ] T024 [P] Confirm no file outside `specs/018-pos-cashier-flow-state-machine-and-smoke-contract/` was created or modified by this chain (no `src/`, OpenAPI, migration, package, CI, and `.specify/feature.json` left unedited).

## Dependency Graph

```
Setup (T001-T002)
   |
Foundational (T003-T005)   <- M-1..M-4 + Constitution Check + DEFERRED owner-decisions gate everything
   |
   +-- US1 (G-1) state machine        T006-T008
   +-- US2 (G-2) transitions          T009-T010   (reads US1 states)
   +-- US3 (G-3) money invariants     T011-T012   (independent of US2)
   +-- US4 (G-4) scenarios A-G + §9   T013-T016   (reads US1/US2/US3)
   +-- US5 (G-5) evidence bar         T017-T018   (reads US4)
   +-- US6 (G-6) out-of-scope + OPEN  T019-T021   (independent; cross-cuts)
   |
Polish (T022-T024)   <- analyze + consistency + scope-guard
```

US1 → US2 and US1/US2/US3 → US4 → US5 are sequential by content dependency. US3 and US6 are largely
independent and can run alongside US1/US2.

## Parallel Execution Examples

- After Foundational: T007, T008 ([US1]) can run with T012 ([US3]) and T020 ([US6]) — different files,
  no shared incomplete dependency.
- Within US4: T015 (contract) and T016 (quickstart) run in parallel after T013/T014 verify the spec
  rows.
- Polish: T023 and T024 run in parallel after T022.

## Implementation Strategy

- **MVP (ratification-ready):** US1 + US2 + US3 + US4 — the state machine, transitions, money
  invariants, and scenario/evidence catalogue. These make the contract reviewable end-to-end.
- **Incremental:** add US5 (evidence bar + deferred form) and US6 (scope guard + OPEN-decision
  surfacing), then Polish.
- **Checkpoint before any build:** the OPEN owner-decisions (§10) and the smoke-evidence form MUST be
  resolved by the owner before the separate payment-finalization-hardening lane starts. This chain
  stops at ratified documentation; it opens no PR and writes no code.
