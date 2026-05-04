# Specification Quality Checklist: POS UI Shell

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-04
**Last Updated**: 2026-05-04 (clarifications applied; payment-tender visual reservation amended)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and visual / UX outcomes
- [x] Written for non-technical stakeholders (designers, product, QA)
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain *(all 3 resolved 2026-05-04 — see **Clarifications** section in `spec.md`)*
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded (explicit Out of Scope section, 19 items after clarifications)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (mouse / keyboard / touch on every navigation entry)
- [x] State variants (loading / empty / error) covered for every placeholder pane; the **four** connection states (`online` / `degraded` / `offline` / `syncing`) covered for the global indicator + status banner
- [x] Design tokens + shared component inventory enumerated and bound to FRs
- [x] Accessibility requirements (WCAG 2.1 AA) and POS-specific keyboard / touch ergonomics captured
- [x] Visual handoff requirements for Figma Make / Figma MCP captured (FR-24 + Design workflow decision section)
- [x] No implementation details leak into specification

## Constitution Alignment (pre-flight, formal check happens in `/speckit-plan`)

- [x] Principle III (Electron process-boundary discipline) — feature explicitly forbids new IPC, preload, or SecretStore changes (Out of Scope; NFR-7)
- [x] Principle V (Type safety) — NFR-2 mandates strict TypeScript, no `any`, no `as` casts on component public surfaces
- [x] Principle VI (Test-first, coverage-gated) — NFR-1 sets ≥ 90 % coverage on shared-component module; every shared component ships with Vitest tests
- [x] Principle VIII (Terminal identity ≠ user identity) — operator login is explicitly Out of Scope; only an operator placeholder is rendered
- [x] Principle IX (Reference, not inheritance) — Design workflow decision section codifies Figma as visual reference; repo code remains source of truth

## Scope Guardrails (explicit non-goals re-checked)

- [x] No cashier login implementation
- [x] No operator session / auth implementation
- [x] No sales / cart / receipt / payments business logic
- [x] No inventory mutation
- [x] No offline sync
- [x] No backend API calls
- [x] No new IPC / preload / SecretStore changes
- [x] No terminal-pairing changes (incl. no re-introduction of self-service unpair)
- [x] No admin-side pairing UI
- [x] No auto-update implementation
- [x] No database migrations
- [x] No OpenAPI / generated-types changes
- [x] No Sentry / logging changes
- [x] No mobile hamburger drawer / bottom-tab bar / mobile-first navigation
- [x] No runtime density toggle / settings UI for density (comfortable is the only applied value)
- [x] No real offline-sync queue, persistence, backend call, or IPC behind the reserved `syncing` visual state
- [x] No payment / tender business logic, no payment APIs, no payment SDKs, no payment gateways
- [x] No card-terminal integration of any kind
- [x] No insurance validation of any kind
- [x] No voucher / gift-card validation of any kind
- [x] No receipts printing, no print queue, no receipt-rendering pipeline
- [x] No `Money` type, no currency formatter, no value-bearing props on the reserved tender / totals slots — eleven labelled rectangles only

## Notes

- **2026-05-04 — Clarifications applied.** The three previously open questions are resolved and now
  live in the spec's **Clarifications** section:
  1. **Density default →** `comfortable` (touch-friendly, 44 px min target). `compact` reserved as a
     future token only; **no runtime density toggle** in this feature.
  2. **Rail-collapse behaviour →** responsive: **≥ 1280 px** expanded (icons + labels);
     **1024–1279 px** icon-only (with accessible name + tooltip); **< 1024 px** "screen too small"
     fallback. **No mobile hamburger drawer.**
  3. **Reserved `syncing` connection state →** added as the **fourth visual-only** state alongside
     `online` / `degraded` / `offline`. **No real sync queue, no backend call, no persistence, no
     IPC, no preload changes** — purely a visual placeholder for future offline-sync work.
- Design-workflow decision section is non-template but required by the feature brief: it pins the
  Figma Make → reviewed Figma → Figma MCP → repo PR flow and prevents generated design code from
  bypassing review.
- This feature deliberately produces a *visual contract* (tokens, components, state matrix, handoff
  package) — not domain entities. The "Key Entities" section lists conceptual artifacts only.
- All checklist items now pass; spec is ready for `/speckit-plan` when invoked.
- **2026-05-04 — Payment-tender visual reservation amended.** The Receipt / Checkout placeholder
  now reserves eleven labelled rectangles (six tender rows: `tender.{cash|card|bank-transfer|voucher|insurance|split}`;
  five amount rows: `totals.{amount-due|amount-paid|remaining|change-due}` and `receipt.breakdown`)
  for future feature **005-checkout-payments**. The reservation is layout capacity only — no
  payment logic, no APIs, no card-terminal integration, no insurance / voucher validation, no
  receipts printing, no `Money` type. Slot ids are frozen in `contracts/shell-routes.ts` and will
  be consumed by 005 without renaming. A guard test (`reserved-slot-noop.test.tsx`) asserts zero
  observable side-effect calls when any slot is mounted, hovered, focused, or clicked.
