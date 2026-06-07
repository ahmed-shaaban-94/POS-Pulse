# Specification Quality Checklist: Sale Sync (Capture-UP)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-06-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)*
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> *Note: this spec intentionally names the DP2 `captureSale` endpoint, the `sale_sync_outbox`
> table, and the `PosOperatorAuthGuard` boundary because they are LOCKED upstream contracts /
> existing-code facts that bound the feature, not free implementation choices. Per the project's
> Spec Kit convention (cf. 009/010 specs), naming a fixed external contract is allowed; the spec
> still avoids prescribing 011's internal class/module design.

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — **all 3 resolved in /speckit-clarify 2026-06-07**
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (user/outcome framed)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded (void/refund → 014; tender → future; ERPNext posting → Connector)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (online, offline-drain, dedup, dead-letter, session-expiry)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification (beyond the locked-contract exception noted above)

## Notes

- **3 open questions remain by design** and are the input to `/speckit-clarify`:
  1. Operator-token acquisition/refresh flow for the main-process sync engine.
  2. Whether DP2/ERPNext tolerate a no-tender sale (or require a placeholder).
  3. Outbox sync-state ownership — companion `sale_sync_state` table vs. relaxing 008's
     enqueue-only `sale_sync_outbox` (AD-3 CHECK + UPDATE-refusing trigger).
- Spec was formalized from the seed; corrected against real code: `sale_sync_outbox` schema
  (8 real columns, enqueue-only), idempotency keyed on `sale_id`→`externalId`, sale-sync bridge
  channel (not the 010 catalogue channel).
- Deployment blocker (#349 / HTTP 521) is documented; the feature is buildable+testable now with
  an injected fake HTTP client and goes live only after the DP2 deploy.
