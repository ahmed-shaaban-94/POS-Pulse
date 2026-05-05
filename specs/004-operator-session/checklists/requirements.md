# Specification Quality Checklist: Operator & Session

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-05
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain *(all three resolved 2026-05-05 via /speckit-clarify — see Clarifications session and Open Questions log)*
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation iteration log

### Iteration 1 — 2026-05-05 (initial draft, post-/speckit-specify)

- All Content Quality items pass: spec is product/behaviour-only; no source code, no
  framework names, no API shapes, no IPC channels, no schema. Sole technical references
  are dependency call-outs to existing 001/002/003 features (allowed by template).
- All Feature Readiness items pass: every FR-001 … FR-035 has user-visible acceptance
  language; user stories US1/US2/US3 are independently testable; SC-001 … SC-010 are
  measurable and technology-agnostic.
- Three intentional `[NEEDS CLARIFICATION]` markers remain (FR-006, FR-013, US3 AS-5),
  documented in Open Questions, with defaults in Assumptions. This is by design and
  routes to `/speckit-clarify` next. The 3-marker cap is honoured.
- Hard-exclusion list from the user prompt is fully reflected in Out of Scope; spec
  introduces zero implementation, zero packages, zero migrations, zero IPC, zero
  OpenAPI changes (verified by SC-010).
- Workflow lesson from 003 captured normatively in FR-033 / FR-034 / FR-035 and
  reinforced by SC-009.

### Iteration 2 — 2026-05-05 (post-/speckit-clarify)

All three NEEDS CLARIFICATION markers resolved in a single session and propagated
across the spec. Sections touched: Clarifications (new session), FR-002, FR-002a
(new), FR-006, FR-013, FR-021, FR-024, FR-026, US1-AS6, US2 (role-naming
narrative), US3-AS5, Edge Cases (5 new bullets), Key Entities (Role table, Shift
behavioural commitments, Sensitive Action structural attribution fields),
Assumptions A1 / A2 / A4, Open Questions (all three resolved), Out of Scope
(custom-permission-engine exclusion).

Resolutions:

- **Q1 — Operator credential factor (Option D)**: Cashier roster pick + 4–6 digit
  PIN; manager / admin password. Cashier PIN uniqueness within a branch is NOT
  required because the roster pick disambiguates. Roster surface contains only
  display name and role; no email, phone, or credential material.
- **Q2 — Same-operator concurrent sign-in (Option C)**: Single active session
  per operator branch-wide, enforced by an explicit takeover prompt on the new
  terminal. Prior session ends with cause `superseded_by_takeover`; prior
  terminal returns to Sign-In within 30 seconds. The takeover is itself an
  audited sensitive action (`operator.session.takeover`).
- **Q3 — Cashier handover within an open shift (Option C, with manager
  forced-close addendum)**: Operator-bound, non-transferable shifts. Opening
  cashier alone may close via the normal path. When unable, a Shift Manager or
  Owner / Admin executes `shift.forced_close` — a distinct audit category that
  records both identities, preserves blind close, and marks the cashier's
  declared count as the explicit state **absent** (not zero, not matched).
  Future variance / reconciliation logic must treat absent declared count as a
  distinct case. A Q2 takeover that strands an operator-bound shift creates a
  separate stuck-shift state; the takeover and the forced close remain
  separately attributed audit events.

Role-naming addendum (also 2026-05-05): the catalogue stays at three entries
(`cashier`, `manager`, `admin`) with explicit business-name mapping (Cashier /
Operator, Shift Manager, Owner / Admin). FR-002a explicitly excludes any custom
permission engine, ABAC system, or capability registry from 004; future role
extensibility is a separate feature.

After this iteration, the spec contains zero NEEDS CLARIFICATION markers and is
ready for `/speckit-plan`.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- The three `[NEEDS CLARIFICATION]` markers are the *intended* output of `/speckit-specify`
  for this feature. They do NOT block clarification; they are the input to it.
- `[NEEDS CLARIFICATION: offline operator sign-in policy]` was *not* added as a marker
  — assumption A6 explicitly defers offline auth to a later feature, so the question
  is out of scope for 004 rather than open.
