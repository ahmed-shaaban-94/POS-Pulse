# Tasks: POS Credit & Third-Party Tender Flow

**Feature:** 020-pos-credit-and-third-party-tender-flow
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-16
**Last Updated:** 2026-06-16

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on incomplete tasks).
- **`[USn]`** maps the task to a documentation-story phase (one per spec User Story / Goal). Setup,
  Foundational, and Polish phases have no story label.
- File paths are repository-relative.
- **DOCS-ONLY (contract-consumer SPECIFY/PLAN level).** Every task below authors or verifies **Markdown**
  under `specs/020-pos-credit-and-third-party-tender-flow/`. **No task authors `src/`, OpenAPI YAML,
  migration, package, lockfile, or CI.** Any task that appears to require such work is OUT OF SCOPE and
  belongs to the separate, owner-gated build lane that consumes the ratified DP-2 035 G2 contract.
- **Contract is consumed, not authored.** DP-2 035 owns `settlement.yaml`; these tasks bind to
  `posRecordSettlementIntent` in **prose**. No `.yaml`/`.yml` is created or edited.

## Phase 1 — Setup

- [ ] T001 Confirm spec-kit feature resolution pins this feature (`SPECIFY_FEATURE_DIRECTORY=specs/020-pos-credit-and-third-party-tender-flow`) so plan/tasks land in the 020 dir, NOT the stale `feature.json` dir (`specs/019-cashier-pin-provisioning`); record the misfire mitigation in `specs/020-pos-credit-and-third-party-tender-flow/plan.md` (Risks & Open Items).
- [ ] T002 [P] Verify `specs/020-pos-credit-and-third-party-tender-flow/plan.md` pins constitution v1.5.1 and is marked SPECIFY/PLAN-ONLY (no `src/`/OpenAPI/migration/package/CI authored).

## Phase 2 — Foundational (Blocking Prerequisites)

- [ ] T003 Confirm the verified ground truth (R1–R5) is recorded in `specs/020-pos-credit-and-third-party-tender-flow/research.md`: the consumed surface = exactly `posRecordSettlementIntent` (`POST /api/v1/settlement/settlement-intent`), `x-idempotency: required`, `security: operatorAuthorization`, request `SettlementIntentCreate`, response `SettlementIntentResult`, outcomes `201/400/409/401/500`; and that NO Console/Connector op is consumed. These gate every downstream story.
- [ ] T004 [P] Confirm `specs/020-pos-credit-and-third-party-tender-flow/research.md` records the ownership boundary (R2: POS intent-only / Console manage / Connector post) and the actor-identity decisions (R3: 031 operator envelope; payer = account reference; settlement act by admin/accounting operator not cashier — 035 OQ-7).
- [ ] T005 [P] Confirm the Constitution Check (Initial + Post-Design) in `specs/020-pos-credit-and-third-party-tender-flow/plan.md` records PASS for I–IX, Platform Integration, Security, and the P-principles, with no VIOLATION and no WAIVED.
- [ ] T006 Confirm all six §Clarifications items (C-1..C-6) are captured in `specs/020-pos-credit-and-third-party-tender-flow/spec.md` with documented defaults, and that `criticalClarifications` is empty (none change contract surface / ownership boundary / actor-identity / gate).

## Phase 3 — US1 (P1): Capture co-pay + insurer-covered split settlement intent

**Goal:** The POS settlement-intent capture surface for a split (patient co-pay + insurer-covered) sale
is fully defined as consuming `posRecordSettlementIntent` — intent only.
**Independent test:** A reviewer can read the data-model + contracts(prose) artifacts and trace every
till input to a `SettlementIntentCreate` field, and the `201` outcome to a read-only receivable
projection, without consulting code.

- [ ] T007 [US1] Author `specs/020-pos-credit-and-third-party-tender-flow/data-model.md` mapping the till capture shape (`saleRef`, `cashTendered`, `payers[]` of `{payerRef, owedAmount, claimMetadata?}`) to DP-2 `SettlementIntentCreate`/`SettlementIntentPayer`; mark the 1..16 payer split (co-pay + insurer) and the integer-minor-unit ↔ exact-decimal-string `Money` boundary conversion (spec FR-1/C-3/C-4).
- [ ] T008 [P] [US1] Author `specs/020-pos-credit-and-third-party-tender-flow/contracts/settlement-intent-consumption.md` (PROSE, no YAML) pinning the consumed operation, request/response field mapping, the `Idempotency-Key` + `operatorAuthorization` headers, and the assertion that NO Console/Connector op and NO ERPNext call is made (spec FR-2/FR-3/NFR-1).
- [ ] T009 [P] [US1] In `data-model.md`, define the **read-only** receivable projection from `SettlementIntentResult` (states `open|partially_applied|settled|claimed|flagged`; `reversal_consumed` excluded v1) and state the no-mutation / intent-only rule (spec FR-3/C-5).

## Phase 4 — US2 (P1): Credit / corporate account on terms (no cash at till)

**Goal:** The full-owed (no-cash) credit/corporate path is defined as a single-payer
`SettlementIntentCreate` that opens one receivable without blocking sale capture.
**Independent test:** A reviewer can follow the data-model for `cashTendered` null/zero + one
`payers[]` entry with full `owedAmount`, and confirm the sale fact is unchanged and the cashier is not
blocked (spec Acceptance #2, FR-4/FR-5).

- [ ] T010 [US2] Extend `specs/020-pos-credit-and-third-party-tender-flow/data-model.md` with the no-cash full-owed case (`cashTendered` null/zero; single `payers[]` entry; sale fact immutable; capture not blocked on settlement) (spec FR-4/FR-5).
- [ ] T011 [P] [US2] In `contracts/settlement-intent-consumption.md`, record that the corporate/credit `payerRef` is a Console-managed account reference (POS references only, never creates) and that an unknown payer is the deterministic `409` (spec FR-9/C-2).

## Phase 5 — US3 (P2): Deterministic outcome handling (validation / unknown payer / auth / replay)

**Goal:** Every contract outcome (`201/400/409/401/500`) maps to a defined, non-disclosing cashier
behavior, and replay is idempotent.
**Independent test:** A reviewer can map each of the five outcomes plus an idempotent replay to a
deterministic result in the contracts(prose) artifact (spec FR-7/FR-8/NFR-5; Acceptance #3/#4/#5/#6).

- [ ] T012 [US3] In `contracts/settlement-intent-consumption.md`, author the outcome-handling matrix: `201` → show opened receivable projection; `400` → fix-and-resubmit (no partial record); `409` → non-disclosing unknown-payer error (no silent post); `401` → re-auth via operator envelope; `500` → safe retry/queue (spec FR-8/NFR-5).
- [ ] T013 [P] [US3] In `contracts/settlement-intent-consumption.md`, pin idempotency: every submission carries an `Idempotency-Key`; replay yields the same single receivable (no duplicate) reusing the 011 outbox discipline (spec FR-7; DP-2 FR-020/G5).
- [ ] T014 [P] [US3] In `data-model.md`, record the offline-first sequencing default (C-1): intent captured at the till is queued and submitted only once the referenced sale has a server `saleRef`; truthful captured/submitted/opened status to the cashier (spec NFR-3).

## Phase 6 — US4 (P2): Authorization, boundary, and tax-pending posture

**Goal:** The 031 operator-authorization envelope is the only accepted credential for settlement-intent
submission; the DP-2-only egress boundary and tax-pending posture are unambiguous.
**Independent test:** A reviewer can confirm device-token-only submission is refused, no
ERPNext/Connector/Console-op path exists, and no VAT apportionment is computed (spec FR-6/FR-10/NFR-1).

- [ ] T015 [US4] In `contracts/settlement-intent-consumption.md`, pin authorization: `operatorAuthorization` bearer (031 envelope / POS-016) attached to every submission; device-token-only is refused (`401`); backend re-evaluates the operator predicate live (spec FR-6; DP-2 035 §8/FR-019).
- [ ] T016 [P] [US4] In `data-model.md` + `contracts/...`, record the tax-pending posture: money is exact-decimal string with NO VAT apportionment across payers/co-pays; placeholders only (spec FR-10; DP-2 035 §6/FR-023; ADR-0003).
- [ ] T017 [P] [US4] In `contracts/settlement-intent-consumption.md`, assert the boundary non-goals: no POS→ERPNext, no POS→Connector, no Console-owned op consumed, and no void/refund/return/insurance-rejection workflow (reuse POS-014 + DP-026 + Connector Arc A) (spec FR-11/NFR-1; DP-2 035 NG-1).

## Phase 7 — US5 (docs): Developer path & gate status

**Goal:** A developer can follow the end-to-end consumption path, and the gate/status posture is honest.
**Independent test:** A reviewer can read quickstart.md and trace obtain-`saleRef` → select-`payerRef` →
build `SettlementIntentCreate` → attach envelope + key → submit → render receivable read-only; and
confirm all POS-020 gates are UNSATISFIED.

- [ ] T018 [US5] Author `specs/020-pos-credit-and-third-party-tender-flow/quickstart.md` with the developer consumption path (008/011 `saleRef` → Console `payerRef` → `SettlementIntentCreate` → envelope + `Idempotency-Key` → submit → read-only `SettlementIntentResult`).
- [ ] T019 [P] [US5] Confirm `spec.md` Gate Mapping lists all POS-020 gates (G-CONTRACT-CONSUME, G-OPERATOR-ENVELOPE, G-INTENT-ONLY, G-IDEMPOTENT-OUTBOX, G-TAX-PENDING) as **UNSATISFIED** and the upstream DP-2 035 G2 as RATIFIED (consumed by reference); confirm no build/done/dispatched claim anywhere in the artifact set.

## Phase Final — Polish & Cross-Cutting

- [ ] T020 [P] Cross-check every spec FR (FR-1..FR-11) and NFR (NFR-1..NFR-5) is traceable to a data-model/contracts/quickstart artifact section (Success Criteria SC-1..SC-6); record the traceability note in `specs/020-pos-credit-and-third-party-tender-flow/research.md`.
- [ ] T021 [P] Verify the artifact set authors ZERO OpenAPI/code/migration/package/CI and invents ZERO VAT allocation rules (SC-5); confirm only `specs/020-pos-credit-and-third-party-tender-flow/**` Markdown was created/edited.

## Dependency Graph

```
Setup (T001-T002)
      |
Foundational (T003-T006)   <- ground truth R1-R5 + constitution + clarifications gate everything
      |
      +--> US1 (T007-T009)  capture split intent (data-model + contracts(prose))
      |        |
      +--> US2 (T010-T011)  no-cash credit/corporate (extends US1 data-model)
      |        |
      +--> US3 (T012-T014)  outcome handling + idempotency + offline (depends on US1 contracts)
      |        |
      +--> US4 (T015-T017)  auth + boundary + tax-pending (depends on US1 contracts)
      |        |
      +--> US5 (T018-T019)  quickstart + gate status (depends on US1-US4)
                 |
Polish (T020-T021)  traceability + zero-code/zero-YAML verification
```

US2, US3, US4 are largely independent once US1's data-model + contracts(prose) skeleton exists; they
append to those two files plus quickstart.

## Parallel Execution Examples

- After T007 (data-model skeleton) and T008 (contracts skeleton) land, the `[P]` tasks T009, T011,
  T013, T014, T016 can be authored concurrently (distinct sections of the same two files — coordinate to
  avoid edit collisions, or split into per-section files).
- T019 (gate status, edits `spec.md`) runs parallel to T018 (authors `quickstart.md`) — different files.
- T020 and T021 (both author/verify into `research.md` / scan the dir) run after all content tasks.

## Implementation Strategy

- **MVP (review-ready SPECIFY/PLAN set):** Foundational (R1-R5 + constitution + clarifications) → US1
  (the consumed-surface data-model + contracts(prose)) is the minimum that makes the feature reviewable
  against ground truth.
- **Incremental:** add US2 (no-cash credit), US3 (outcomes/idempotency/offline), US4 (auth/boundary/tax),
  US5 (quickstart + gate honesty), then Polish (traceability + zero-code verification).
- **Checkpoints:** after Foundational (ground truth pinned), after US1 (surface bound), after US5 (gate
  status honest) — each is a natural owner-review point.
- **STOP before implement.** This task set produces design documentation only. The build lane that writes
  `src/` is a separate, owner-gated lane that begins only after the POS-020 gates are satisfied; nothing
  here authors code, OpenAPI, migration, package, or CI.
