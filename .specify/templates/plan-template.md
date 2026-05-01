# Implementation Plan: [FEATURE NAME]

**Feature ID:** [NNN-short-name]
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]
**Constitution version pinned:** [vX.Y.Z]

---

## Technical Context

[Concrete technologies, libraries, and project layout this plan commits to. Where the constitution
already pins a choice, restate it; where the constitution leaves a decision open, decide it here and
record the alternatives in `research.md`. Mark genuinely open items as
**NEEDS CLARIFICATION**.]

| Area | Choice | Source |
|:--|:--|:--|
| ... | ... | constitution v[X.Y.Z] / research.md |

## Constitution Check (Initial)

For each constitution principle and constraint, mark **PASS / WAIVED / VIOLATION**. A VIOLATION
blocks progress until resolved. A WAIVED entry MUST cite a justification and an expiry condition.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | | |
| II. Financial Precision | | |
| III. Process-Boundary Discipline | | |
| IV. Hardware Loud, Not Silent | | |
| V. Type Safety End-to-End | | |
| VI. Test-First, Coverage-Gated | | |
| VII. Observability | | |
| VIII. Terminal Identity ≠ User | | |
| IX. Reference, Not Inheritance | | |
| Platform Integration | | |
| Security | | |
| Hardware Matrix | | |
| Domain — Pharmacy POS | | |

## Phase 0 — Research

See [./research.md](./research.md). Phase 0 resolves all NEEDS CLARIFICATION items above and
documents the chosen approach + alternatives + rationale for each non-trivial technical decision.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md)
- **Contracts:** [./contracts/](./contracts/)
- **Quickstart (developer path):** [./quickstart.md](./quickstart.md)

## Project Layout

[Directory tree the plan commits to.]

## Test Strategy

[Frameworks, what runs where, coverage gates per module, what CI enforces.]

## CI / Build / Package

[CI workflow shape, the four required gates, runner choice, artifact destination.]

## Phase 2 — Implementation Outline

[High-level work breakdown. Tasks materialize in `/speckit-tasks`; this section is the strategy
they'll be derived from.]

## Constitution Check (Post-Design)

Re-evaluate after Phase 1 design is settled. Status MUST remain PASS or WAIVED-with-justification.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| ... | | |

## Risks & Open Items

- [Risk / open item with owner and mitigation.]

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
