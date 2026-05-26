# Specification Quality Checklist: Sale Finalization & Receipts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-26
**Last updated**: 2026-05-27 (post-`/speckit-clarify`)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — **all 3 declared markers (OQ-1, OQ-2, OQ-3) resolved by `/speckit-clarify` session 2026-05-27, plus a fourth ambiguity (reprint permission boundary) surfaced by the post-spec coverage scan and resolved in the same session. Total clarifications asked: 4 (≤5 budget). Total live `[NEEDS CLARIFICATION]` strings in spec: 0.**
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded (extensive Out of Scope + Non-Goals)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria (FR-001…FR-074 backed by SC-001…SC-010 and the 14 acceptance scenarios)
- [x] User scenarios cover primary flows (cash sale, voucher sale, card-terminal sale, reprint, printer failure, drawer failure, force-fail refusal)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitutional Compliance Pre-Check (informational)

- [x] Constitution version pinned in front-matter (v1.5.1).
- [x] Out-of-Scope section enumerates every domain 008 does NOT touch — particularly the future POS domains called out in Constitution P16 (inventory mutation, refunds/voids, X/Z reports, full offline sync engine, backend accounting, SaaS DB direct access).
- [x] Receipt-level voucher minimisation (FR-038) consistent with 006 FR-017.
- [x] Receipt-level card-data minimisation (FR-070) consistent with 006 FR-008 / FR-040 and Constitution P6.
- [x] Sensitive-data minimisation block (FR-070–FR-074) covers cards, voucher data, secrets, customer PII, raw envelope.
- [x] No mutation of money-bearing rows (FR-004) — append-only per Constitution P4.
- [x] Idempotency strategy named (FR-001 + SC-009) per Constitution P5.
- [x] Local durability before offline promises (FR-002 + FR-060 staging) per Constitution P18.

## Notes

- **`/speckit-clarify` session 2026-05-27 — outcomes:**
  - **OQ-3 (per-line VAT)** → resolved Option B: sale-level VAT footer only for MVP. Touch-points: Clarifications, FR-003 (Sale row + sale-level VAT total field), FR-017 (footer wording), Assumption A8, Out of Scope (new row).
  - **OQ-2 (drawer-kick ordering)** → resolved Option A: separate command after print-success acknowledgement. Embedded-in-receipt kick PROHIBITED in 008 v1. Touch-points: Clarifications, FR-040 (tightened with separate-command rule + prohibition).
  - **OQ-1 (sale-number scheme)** → resolved Option A: per-terminal monotonic with terminal-id prefix, canonical shape `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`. Touch-points: Clarifications, FR-010 (canonical scheme + delegation of reset-boundary to `/speckit-plan`).
  - **Reprint permission boundary (scan-surfaced, not in declared OQ list)** → resolved Option A: cashier-permitted, fully attributed, no supervisor override. Mitigation for fraud risk rests on FR-029's bilingual duplicate-copy marker (R2). Touch-points: Clarifications, FR-028 (tightened with cashier-permitted rule + signed-in-operator gate).
- This spec deliberately covers **sale finalization AND receipts as one feature**, per explicit user framing: "the next product milestone is not receipts-only; it is sale finalization". The two are coupled by the durable-Sale-before-print rule (FR-002) and would deadlock if split into two features.
- The constitution-alignment paragraph at the foot of `spec.md` is a forward-statement for `/speckit-plan`'s Constitution Check; it is not itself the check.
- **Carry-forward for `/speckit-plan`:** the sale-number sequence reset boundary (calendar day start vs shift open) is delegated to `/speckit-plan` per FR-010. This is a plan-level architectural decision, not a clarification.
