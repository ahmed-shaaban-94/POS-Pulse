# Implementation Plan: POS Credit & Third-Party Tender Flow

**Feature ID:** 020-pos-credit-and-third-party-tender-flow
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-06-16
**Last Updated:** 2026-06-16
**Constitution version pinned:** v1.5.1

> **Artifact class — SPECIFY/PLAN-ONLY (no runtime code).** This plan describes the *contract-consuming
> work* for POS-Pulse's settlement-intent capture and the design artifacts that ratify it. It authors no
> `src/`, no IPC/bridge, no OpenAPI YAML (DP-2 owns the contract), no migration, no package/lockfile, and
> no CI. The "Project Layout", "Test Strategy", and "Implementation Outline" sections describe the
> **shape of the later, owner-gated build lane** that would consume the ratified DP-2 035 G2 contract —
> they are not a license for this chain to write code. All POS-020 gates remain UNSATISFIED; the upstream
> DP-2 035 G2 contract is RATIFIED and consumed by reference.

---

## Technical Context

The only new external dependency this plan commits to is **consuming one ratified DP-2 contract
operation**. No new technology, no new egress target beyond Data-Pulse-2, and no contract authoring.

| Area | Choice | Source |
|:--|:--|:--|
| Deliverable | Markdown spec/plan/research/data-model/contracts(prose)/quickstart/tasks under `specs/020-…/` | this chain |
| Consumed contract | DP-2 035 G2 `posRecordSettlementIntent` — `POST /api/v1/settlement/settlement-intent` (`SettlementIntentCreate` → `SettlementIntentResult`) | DP-2 `packages/contracts/openapi/settlement/settlement.yaml` (RATIFIED, PR #574) |
| Contract ownership | **Data-Pulse-2 owns and authors the OpenAPI**; POS consumes the generated client only — POS authors NO YAML | spec §0; DP-2 035 NG / FR-016 |
| Authorization | `operatorAuthorization` bearer (031 envelope, adopted in POS-016); not device-token-only | DP-2 035 §8 / FR-019; spec FR-6 |
| Idempotency / offline | `Idempotency-Key` header + POS outbox capture-up discipline (011) | DP-2 035 FR-020/G5; spec FR-7 / C-1 |
| Money model | Integer minor units internally (`src/shared/money.ts`); exact-decimal string `Money` at the boundary only | Constitution II; DP-2 `Money`; spec C-4 |
| Sale reference | Server `saleRef` from the existing 008 finalize + 011 capture-up path; sale fact NOT mutated | spec FR-4 / C-1 |
| Payer reference | In-scope `payerRef` (uuid) managed by Console 017; POS references only, never creates | DP-2 035 FR-009/017; spec FR-9 / C-2 |
| Tax | Tax-pending; no VAT apportionment; placeholders only | ADR-0003; DP-2 035 §6/FR-023; spec FR-10 |
| Reversal | Out of scope; reuse POS-014 + DP-026 + Connector Arc A | DP-2 035 NG-1; spec FR-11 |

> No row is marked NEEDS CLARIFICATION: the spec's `## Clarifications` (C-1..C-6) resolved the
> non-critical ambiguities with documented defaults, and the four load-bearing decisions (consumed
> surface, ownership boundary, actor/identity, gates) are pinned by ground truth. None are re-decided
> here.

## Constitution Check (Initial)

This is a documentation/contract-consumer artifact. The check evaluates whether the **contract POS
intends to consume** is consistent with the constitution — not whether new code complies (no code is
authored). Pinned: constitution **v1.5.1**.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | PASS | Settlement intent is captured at the till and queued via the 011 outbox; submitted with idempotency once `saleRef` exists (spec C-1/NFR-3). No request-path coupling forces the cashier online to ring a credit sale. |
| II. Financial Precision | PASS | Money crosses as exact-decimal strings (DP-2 `Money`); POS keeps integer minor units internally and converts only at the boundary; float never decides an amount (spec NFR-2/C-4). |
| III. Process-Boundary Discipline | PASS | Capture/queue/submit is a main-process + outbox concern; renderer observes a read-only receivable projection. No new IPC/bridge is authored here (design only). |
| IV. Hardware Loud, Not Silent | PASS | `400/409/401/500` surface as explicit cashier-facing outcomes (spec FR-8); no silent settlement degradation. |
| V. Type Safety End-to-End | PASS (descriptive) | No types authored; the eventual client is generated from DP-2's OpenAPI (POS authors no YAML). Backend types remain OpenAPI-generated. |
| VI. Test-First, Coverage-Gated | PASS | This chain defines the contract-consumption acceptance scenarios (the failing-test target) before the later build lane implements them; money/outbox coverage floors referenced, not changed. |
| VII. Observability | PASS | Submission is attributable to operator + sale + idempotency key (spec NFR-4); no log/Sentry change authored. |
| VIII. Terminal Identity ≠ User | PASS | Authorization is the 031 operator-authorization envelope, not a device token; payer is an account reference, not a principal (spec FR-6/FR-9). No custom user store. |
| IX. Reference, Not Inheritance | PASS | The contract is referenced from DP-2's ratified YAML; no contract copied/forked into POS; the `0xx-insurance-copay` spike is prior art only. |
| Platform Integration | PASS | New egress = DP-2 035 G2 only. No POS→ERPNext, no POS→Connector (spec NFR-1; orchestrator architecture invariant). |
| Security | PASS | No card data, no secret, no renderer egress. `401`/`409` are non-disclosing (spec NFR-5). |
| Hardware Matrix | PASS | No hardware change; settlement-intent capture is a UI + network concern on the existing matrix. |
| Domain — Pharmacy POS | PASS | Credit / corporate / insurance-co-pay are canonical pharmacy-POS payer models; no domain redefinition (uses DP-2 `PayerCategory`). |
| P1 Financial Correctness First | PASS | Owed-balance correctness + audit prioritized; intent-only boundary prevents POS-side money posting. |
| P2 No Fake Success States | PASS | "Receivable opened" is shown only from DP-2's `SettlementIntentResult`; POS never fabricates a settled state. |
| P3 No Silent Data Loss | PASS | Captured intent is durably queued; idempotent replay → same single receivable (spec FR-7/NFR-3). |
| P5 Idempotency | PASS | `Idempotency-Key` per submission; replay yields one receivable (spec FR-7; DP-2 FR-020/G5). |
| P9 Truthful Offline/Sync States | PASS | Status shown to cashier distinguishes captured-locally vs submitted vs receivable-opened (spec NFR-3). |
| P10 Operator Accountability | PASS | Submission attributable to the operator envelope (spec NFR-4); the settlement *act* (cash application) stays with the admin/accounting operator in Console (OQ-7), never the cashier. |

> No VIOLATION and no WAIVED entry. Principles not listed are unaffected (no code authored).

## Phase 0 — Research

See [./research.md](./research.md). Phase 0 records the **verified ground truth** this plan binds to —
not open questions:

- **R1 — Consumed contract surface.** Exactly one operation: `posRecordSettlementIntent`
  (`POST /api/v1/settlement/settlement-intent`), `x-idempotency: required`,
  `security: operatorAuthorization`, request `SettlementIntentCreate`, response `SettlementIntentResult`,
  outcomes `201/400/409/401/500`. Console- and Connector-owned operations are explicitly NOT consumed.
- **R2 — Ownership boundary.** POS = intent only (DP-2 035 FR-016); Console = manage/apply/reconcile
  (FR-017); Connector = post to ERPNext later (FR-018). Recorded so downstream tasks plan within it.
- **R3 — Actor / identity.** Operator-authorization envelope (031/POS-016); payer = account reference;
  the settlement act is performed by the admin/accounting operator in Console, never the cashier (035
  OQ-7 7-C). Cashier captures intent, which is itself a `posRecordSettlementIntent` call — distinct from
  performing settlement.
- **R4 — Offline / money / tax decisions.** C-1 (queue-until-`saleRef`), C-4 (integer-minor-unit↔string
  conversion at boundary), tax-pending (no VAT apportionment) recorded as the chosen defaults.
- **R5 — Prior art.** The `0xx-insurance-copay` visual spike is exploratory only; this feature supersedes
  it as the contract-bound capture surface.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md) — the POS-side capture shape (`SettlementIntent`,
  `SettlementIntentPayer`, `payerRef`, `cashTendered`) and the **read-only** receivable projection, all
  mapped to DP-2 contract schemas (consumed, not redefined). Marks the integer-minor-unit ↔ string-`Money`
  boundary conversion and the `payers[]` 1..16 split.
- **Contracts (prose):** [./contracts/settlement-intent-consumption.md](./contracts/settlement-intent-consumption.md)
  — a **prose** contract-consumption note pinning the consumed operation, request/response field mapping,
  idempotency + security headers, and the `201/400/409/401/500` handling matrix. **No OpenAPI YAML is
  authored** (DP-2 owns the contract).
- **Quickstart:** [./quickstart.md](./quickstart.md) — the developer path for the later build lane:
  obtain `saleRef` (008/011), select `payerRef` (Console), build `SettlementIntentCreate`, attach
  envelope + `Idempotency-Key`, submit, render the returned receivable projection read-only.

> Every Phase-1 artifact is Markdown design documentation inside `specs/020-…/`. None authors OpenAPI,
> code, migration, package, or CI.

## Project Layout

> Describes the **later owner-gated build lane** (not authored here). Shown so tasks can be derived at
> the right altitude.

```
POS-Pulse/
  src/                         # (build lane only — NOT authored by this chain)
    main/settlement/           #   capture/queue/submit settlement intent (outbox-backed)
    renderer/.../settlement/   #   till capture UI (payer select, owed/co-pay entry) + read-only receivable view
    shared/money.ts            #   existing integer-minor-unit money (reused; boundary conversion added in build lane)
  packages/contracts/          # generated DP-2 client (consumed; POS authors no YAML)
  specs/020-pos-credit-and-third-party-tender-flow/   # THIS chain's deliverable (docs only)
```

## Test Strategy

> Strategy for the later build lane; this chain authors the acceptance contract, not the tests.

- **Contract-consumption tests** (build lane): assert POS sends a valid `SettlementIntentCreate` with
  `Idempotency-Key` + operator envelope, and maps each `201/400/409/401/500` to its defined behavior
  (spec §Acceptance + FR-8).
- **Money-boundary tests**: integer-minor-unit ↔ exact-decimal-string round-trip, no float decides a
  settlement amount (Constitution II; spec C-4).
- **Offline/outbox tests**: intent captured offline is queued and submitted idempotently once `saleRef`
  exists; replay → one receivable (spec NFR-3/FR-7).
- **Boundary-negative tests**: POS never calls a Console/Connector op and never calls ERPNext (spec
  NFR-1); device-token-only submission is refused (spec FR-6).
- Coverage floors for money/outbox modules are the existing constitution gates; not changed here.

## CI / Build / Package

No CI/build/package change is authored by this chain. The later build lane runs the standard POS CI
gates (lint, typecheck, unit/integration, money/outbox coverage). The generated DP-2 client is consumed
from `packages/contracts`; POS authors no contract artifact (DP-2 owns the OpenAPI and its CI).

## Phase 2 — Implementation Outline

> High-level strategy for `/speckit-tasks`. These are **contract-consuming design tasks** at SPECIFY/PLAN
> granularity — not code-writing steps.

1. **Bind the consumed surface.** Pin `posRecordSettlementIntent` request/response/headers/outcomes in
   the contracts(prose) artifact (R1).
2. **Define the capture shape.** Map the till inputs (`saleRef`, `cashTendered`, `payers[]`) to the
   DP-2 `SettlementIntentCreate` schema in data-model.md, including the integer↔string money boundary and
   the 1..16 payer split.
3. **Define the read-only receivable projection.** Map `SettlementIntentResult` → a display-only view;
   state the no-mutation rule (intent-only boundary).
4. **Define authorization + idempotency + offline discipline.** Operator envelope (031), `Idempotency-Key`,
   011 outbox queue-until-`saleRef` (C-1).
5. **Define the outcome-handling matrix.** `201/400/409/401/500` → deterministic, non-disclosing
   cashier behavior (FR-8/NFR-5).
6. **Pin the boundaries & non-goals.** No Console/Connector op, no ERPNext, no reversal flow, no VAT
   apportionment — verifiable from the artifacts.
7. **Record gate status.** All POS-020 gates UNSATISFIED; upstream DP-2 035 G2 RATIFIED (consumed by
   reference). No build/dispatch claim.

## Constitution Check (Post-Design)

Re-evaluated after the Phase-1 design altitude is fixed. Status unchanged — all PASS, no WAIVED, no
VIOLATION. The design remains a contract-consumer at intent-only altitude: no OpenAPI/code/migration/
package/CI authored; egress to DP-2 only; money exact-decimal at the boundary; tax-pending; reversal
reused; gates unsatisfied.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I–IX (all) | PASS | No change from Initial; design adds no code, no new egress, no boundary crossing. |
| Platform Integration | PASS | DP-2-only egress preserved through Phase-1 design. |
| Security | PASS | Non-disclosing `401`/`409`; no secret/card/renderer-egress introduced. |
| P1/P2/P3/P5/P9/P10 | PASS | Intent-only boundary, idempotency, truthful states, operator accountability preserved by design. |

## Risks & Open Items

- **Spec-kit feature resolution misfire (mitigated).** `.specify/feature.json` pins a stale dir
  (`specs/019-cashier-pin-provisioning`) and `create-new-feature` does not rewrite it. This chain pinned
  the active feature via `SPECIFY_FEATURE_DIRECTORY=specs/020-pos-credit-and-third-party-tender-flow` for
  `setup-plan` / `setup-tasks`, verified each script's `-Json` output targets the 020 dir. Mitigation
  recorded so re-runs use the same override.
- **Upstream reversal-compatibility deferral (035 OQ-4).** `reversal_consumed` and reversal-compat fields
  are deferred upstream; POS-020 must not pre-build them. A later additive contract bump (after DP-026
  closes) would reopen a POS reversal-aware slice — out of scope here.
- **Tax reactivation (OQ-2 / G6).** When VAT activates under ADR-0003, co-pay/payer VAT apportionment
  becomes a later, separately-gated concern; POS-020 carries placeholders only.
- **Payer-account availability (Console 017).** POS depends on Console-managed payer accounts existing;
  if Console 017 is not yet delivered, the unknown-payer (`409`) path is the only outcome — a build-lane
  sequencing dependency, not a spec ambiguity.
- **Owner gate ratification pending.** All POS-020 gates are UNSATISFIED; the build lane is owner-gated.
  This chain makes no build/done/dispatch claim.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
