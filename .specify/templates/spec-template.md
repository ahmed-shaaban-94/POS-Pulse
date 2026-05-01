# Feature Specification: [FEATURE NAME]

**Feature ID:** [NNN-short-name]
**Status:** Draft
**Created:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]
**Owner:** [name or role]

---

## Overview

[2–4 sentences. What is this feature, who is it for, and why are we building it now? Avoid implementation
detail; describe the user-visible outcome.]

## User Scenarios & Testing

### Primary User Story

[Single narrative paragraph describing the happy path from the user's perspective. Name the actor (e.g.,
"A pharmacy admin..."). Describe the trigger, the steps, and the desired outcome.]

### Acceptance Scenarios

Each scenario uses Given / When / Then phrasing. Each MUST be testable without naming an implementation.

1. **[Short title]**
   - **Given** [precondition]
   - **When** [action]
   - **Then** [observable outcome]

2. **[Short title]**
   - **Given** ...
   - **When** ...
   - **Then** ...

### Edge Cases

- [Edge case 1 — what happens, what the user sees]
- [Edge case 2 — ...]
- [Failure mode — what the user sees, what recovery path is offered]

## Requirements

### Functional Requirements

Each requirement is testable, unambiguous, and uses MUST/SHOULD/MAY.

- **FR-1.** [Requirement.]
- **FR-2.** [Requirement.]
- **FR-3.** [Requirement.]

### Non-Functional Requirements

- **NFR-1.** [Performance / reliability / security / accessibility requirement, with measurable target.]
- **NFR-2.** ...

## Success Criteria

Measurable, technology-agnostic outcomes. The feature is "done" when these are demonstrably true.

- **SC-1.** [Outcome with metric, e.g., "Cashier completes pairing in under 60 seconds."]
- **SC-2.** ...

## Key Entities

[Only if data is involved. Name and one-line purpose for each. Detailed schemas belong in the plan, not
the spec.]

- **[Entity]** — [purpose].
- **[Entity]** — [purpose].

## Assumptions

- [Reasonable default chosen in absence of explicit requirement, with one-line justification.]
- ...

## Out of Scope

Explicitly NOT delivered by this feature. Items here block scope creep and inform the next feature's
planning.

- [Item that someone might expect, but is deferred.]
- ...

## Dependencies

- [Other feature, external system, or platform capability this feature relies on.]
- ...

## Open Questions

[Use sparingly. Maximum 3. Each MUST be a decision that changes scope, security, or core UX. Format:
`[NEEDS CLARIFICATION: question]`. Resolved questions move to Assumptions.]

- (none)

---

*Constitution alignment:* This spec MUST satisfy the principles of `.specify/memory/constitution.md`
(version pinned at the time of writing). The plan and tasks artifacts will perform the explicit
"Constitution Check."
