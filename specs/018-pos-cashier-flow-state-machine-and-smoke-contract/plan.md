# Implementation Plan: POS Cashier Flow State Machine & Smoke Contract

**Feature ID:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-06-12
**Last Updated:** 2026-06-12
**Constitution version pinned:** v1.5.1

> **Artifact class — SPECIFY/PLAN-ONLY (no runtime code).** This plan describes the *testable
> contract* for the cashier flow and the documentation work that ratifies it. It authors no `src/`,
> no OpenAPI, no migration, no package/lockfile, and no CI. The "implementation outline", "project
> layout", and "test strategy" sections below describe the **shipped POS mechanism this contract maps
> to** (verified on `origin/main`) and the **separate, owner-gated payment-finalization-hardening
> lane** that would build against it — they are not a license for this chain to write code.

---

## Technical Context

The "technologies" this plan commits to are the documentation surface plus the *already-shipped* POS
mechanism the contract maps to. No new technology is introduced.

| Area | Choice | Source |
|:--|:--|:--|
| Deliverable | Markdown spec/plan/research/data-model/contracts(prose)/quickstart/tasks under `specs/018-…/` | this chain |
| State representation | Logical state machine (§5 of spec), mapped to shipped POS payment-attempt FSM + tender-line FSM | spec §4 M-1..M-3 |
| Money model | Integer minor units (`src/shared/money.ts`); display formatting separate from calculation | constitution II / spec §7 / M-4 |
| Finalize gate | POS-local: `tenderTotal ≥ saleTotal && cart-non-empty && saleTotal > 0` (no DP-2 server settlement endpoint) | spec §4 M-2 |
| Auto-finalize | Main-process polling worker (~200 ms) → recent-sale projection; "Confirm payment" is the terminal cashier action | spec §4 M-1 |
| Sale-sync authorization | Owned by orchestrator Spec 028; bound here by reference, **not** re-decided | spec header / §10 |
| Server capture leg | Owned by Data-Pulse-2 (orchestrator Spec 030 / DP-2 spec 032); out of this spec | spec header |
| Tender model (v1) | **NEEDS CLARIFICATION → DEFERRED to owner** (single-instrument vs multi-tender; M-3 ships multi) | spec §10 (OPEN) |
| Zero-total / receipt-vs-sync / post-handoff edit / cancel→cart-or-void / repair authority / smoke-evidence form / tender-input units | **NEEDS CLARIFICATION → DEFERRED to owner** | spec §10 (OPEN) |

> The DEFERRED rows are intentionally left as owner-decisions. This plan documents *both branches* of
> each open decision and never silently picks one. They are re-surfaced in "Risks & Open Items".

## Constitution Check (Initial)

This is a documentation/contract artifact. The Constitution Check evaluates whether the **contract it
ratifies** is consistent with the constitution — not whether new code complies (no code is authored).

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | PASS | Contract preserves offline states (SYNC_PENDING/SYNCED/SYNC_FAILED_*), local-first finalize (M-2), and the four-state connection model. No request-path coupling introduced. |
| II. Financial Precision | PASS | §7 money invariants mandate integer minor units, display-separate-from-calculation, no float decides finalization. Maps to `src/shared/money.ts` (M-4 verified correct). |
| III. Process-Boundary Discipline | PASS | Contract is process-aware: main process owns finalize worker + SQLite + outbox; renderer observes projections. No new IPC/bridge authored. |
| IV. Hardware Loud, Not Silent | PASS | Catalog-unavailable, print, and drawer paths surface as explicit states/scenarios (§5, §9); no silent degradation specified. |
| V. Type Safety End-to-End | PASS (descriptive) | No types authored; contract references existing typed FSMs. Backend types remain OpenAPI-generated (not touched). |
| VI. Test-First, Coverage-Gated | PASS | Contract *defines* the smoke-evidence bar (the failing-test target) before any hardening lane builds. Money/outbox ≥95% floor referenced, not changed. |
| VII. Observability | PASS | `tx_id` audit anchor and outbox states preserved; no log/Sentry change authored. |
| VIII. Terminal Identity ≠ User | PASS | Sale-sync auth credential owned by 028; contract binds by reference. No custom user store; no auth re-decision. |
| IX. Reference, Not Inheritance | PASS | No `_reference/` material copied; contract re-derived from verified `origin/main` facts. |
| Platform Integration | PASS | No new egress; POS → DP-2 boundary preserved (no POS→ERPNext). |
| Security | PASS | No card data, no secret, no renderer egress introduced. |
| Hardware Matrix | PASS | Wedge-scanner search/barcode scenarios consistent with MVP matrix; nothing added. |
| Domain — Pharmacy POS | PASS | Sale/line/outbox concepts used as canonical; no redefinition. |
| P1 Financial Correctness First | PASS | Correctness/audit prioritized over polish throughout §7/§8. |
| P2 No Fake Success States | PASS | COMPLETED/RECEIPT_READY backed by durable local persist; SYNCED distinct from local completion. |
| P3 No Silent Data Loss | PASS | §9 mandates crash/restart/offline/retry scenarios; outbox durability is the satisfaction path. |
| P4 Auditability / Non-Destructive Correction | PASS | VOIDED_OR_CANCELLED is an explicit state, not a row mutation. |
| P5 Idempotency | PASS | Duplicate-finalize → exactly one sale/receipt/outbox (§7.11, scenario G); client UUID `tx_id`. |
| P6 No Raw Cardholder Data | PASS | No card capture in scope. |
| P7 Secrets Never Reach Renderer/Logs | PASS | No secret handling authored. |
| P8 Electron Security Boundary | PASS | No `src/preload`, `src/main`, `bridge-api`, or `migrations/` change authored. |
| P9 Truthful Offline/Sync States | PASS | Sync states labelled by owner (POS UX vs DP-2 truth); no capability over-promised. |
| P10 Operator Accountability | N/A (deferred) | Manager override for failed-sync repair is a DEFERRED owner-decision (§10); not asserted. |
| P11 Supportability w/o Leakage | PASS | Smoke evidence form is documentation; redaction unaffected. |
| P12 Spec Kit Artifacts Source of Truth | PASS | This chain *is* the Spec Kit pipeline; ambiguities routed through clarify, not design files. |
| P13 Small, Scoped PRs | PASS | Docs-only; no implementation PR opened by this chain. |
| P14 Accessibility & Ergonomics | PASS | Keyboard/wedge focus and ≥44px referenced in §9 fresh-terminal/search scenarios; nothing weakened. |
| P15 Production Readiness Gates | DEFERRED | Production-affecting build is the separate hardening lane; its readiness subsection is authored *there*, gated by the owner decisions this spec surfaces. |
| P16 Feature Scope Discipline | PASS | Payments/sales business logic remains owned by the hardening lane; this chain authors no behaviour. |
| P17 Privacy & Tenant Isolation | PASS | No new data path; tenant scoping unchanged. |
| P18 Local Durability Before Offline Promises | PASS | Contract does not claim offline finalization is delivered; it is a DEFERRED owner-decision. |

**Gate result:** No VIOLATION. Two principles (P10, P15) are **DEFERRED** because they attach to the
owner-gated build lane, not to this documentation chain. No WAIVED entries required.

## Phase 0 — Research

See [./research.md](./research.md). Phase 0 records the verified `origin/main` mechanism facts
(M-1..M-4) that the contract maps to, the decision to adopt the orchestrator Spec-029 scenario
contract as a POS-owned spec, and — for every NEEDS CLARIFICATION (the §10 owner-decisions) — the
documented branches and the rationale for **deferring** rather than deciding.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md) — the state machine as a state/transition model
  (entities are *logical states and the sale/outbox records they project from*; no schema authored).
- **Contracts:** [./contracts/](./contracts/) — **prose** contracts only: the cashier-flow state
  contract and the smoke-evidence contract. No OpenAPI, no JSON schema, no code.
- **Quickstart (reviewer path):** [./quickstart.md](./quickstart.md) — how a reviewer verifies the
  contract against shipped behaviour using the A–G + §9 scenarios.

## Project Layout

No project layout is created or modified by this chain. For reference, the contract maps to these
**existing** `origin/main` modules (read-only context; not edited):

```
src/shared/money.ts                                  # integer minor-unit math (M-4)
src/main/payments/fsm/payment-attempt-fsm.ts         # settled_at, POS-local attempt FSM (M-2)
src/main/payments/fsm/tender-line-fsm.ts             # multi-tender-line apply/reverse, LIFO (M-3)
src/main/catalogue/read-down/map-sellable-row.ts     # decimalStringToMinorUnits (M-4)
migrations/0020_create_sales.sql                     # sales table incl. settled_at (M-2)
```

These paths are documented so the hardening lane knows the seams. **This chain edits none of them.**

## Test Strategy

This chain authors no tests. It *defines the test target*: the smoke-evidence bar for
`G-POS-CASHIER-SMOKE`. The bar (authored as documentation in `contracts/` + `quickstart.md`):

- Payment scenarios A–G (spec §8) each have a deterministic expected result.
- Cashier/offline scenarios (spec §9) each define preconditions, actions, expected UI, expected local
  state, backend interaction, refusal/retry, and the smoke evidence that satisfies them.
- The *form* of evidence (manual script vs automated regression vs screenshots) is a DEFERRED
  owner-decision; the plan enumerates candidate forms, the owner selects one at closeout.

When the hardening lane builds, it inherits the constitution's Test-First / ≥80% (Money + outbox
≥95%) gates — those are not modified here.

## CI / Build / Package

No CI, build, or package file is authored or modified. The contract imposes no new CI gate; the
program-level `G-POS-CASHIER-SMOKE` remains prose-only and unregistered (spec §3 non-goal).

## Phase 2 — Implementation Outline

`/speckit-tasks` derives the task list from this plan. Because the deliverable is documentation, the
"implementation" outline is the **authoring** breakdown, organized per spec Goal (G-1..G-6) as
documentation stories, plus the smoke-evidence catalogue (A–G + §9). It explicitly excludes any
runtime task. The owner-gated build lane is named as a downstream, out-of-scope follow-up.

## Constitution Check (Post-Design)

Re-evaluated after the Phase 1 prose artifacts were outlined. No design decision introduced a
constitutional conflict; the only changes vs Initial are confirmations.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| All Core (I–IX) | PASS | Unchanged; no code/contract/migration authored in Phase 1 (prose contracts only). |
| P1–P9, P11–P14, P16–P18 | PASS | Unchanged. |
| P10 Operator Accountability | DEFERRED | Failed-sync repair authority remains an OPEN owner-decision. |
| P15 Production Readiness Gates | DEFERRED | Belongs to the build lane; surfaced as a downstream gate. |

**Gate result:** PASS (no VIOLATION; P10/P15 DEFERRED to the owner-gated build lane).

## Risks & Open Items

**OPEN owner-decisions (surfaced, NOT decided by this chain) — owner: 018 spec owner / program owner:**

- Single-instrument vs multi-tender v1 (M-3 ships multi → single = gated expansion).
- Partial / mixed tenders supported v1?
- Post-handoff cart edits allowed?
- Payment cancellation → cart or void?
- Overpayment/change cash-only or all tenders?
- Zero-total sales allowed?
- Receipt before or after sync?
- Offline finalization before sync allowed?
- Reconnect-with-failed-auth classification — owned by **028** (cross-ref OQ-5); bound by reference.
- Manager override for failed-sync repair? (Console-side repair authority, later lane.)
- Required smoke-evidence form for closeout.
- Tender input units: minor-units vs decimal entry.

**Process risks / mitigations:**

- *Risk:* spec-kit branch-name → feature-dir resolution misfired (defaulted to a stale pinned feature
  `011`). *Mitigation:* resolved by `SPECIFY_FEATURE_DIRECTORY` + `SPECIFY_FEATURE` overrides pinning
  `018`; verified `check-prerequisites` reports the 018 paths before any setup script wrote files. The
  checked-in `.specify/feature.json` was **not** edited (out of allowed write scope).
- *Risk:* template "contracts/ + code" steps could imply OpenAPI/code. *Mitigation:* contracts authored
  as prose only; no schema/code emitted.
- *Risk:* template assumes prioritized user stories; this spec has Goals + scenarios. *Mitigation:*
  Goals treated as documentation stories; no fabricated P1/P2 ranking.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation. This plan authors no runtime code,
OpenAPI, migration, package, or CI artifact.*
