> ## STATUS: DRAFT — BLOCKED — NOT APPROVED FOR IMPLEMENTATION
>
> **Implementation of 006-payments-tender is not authorised.** No code,
> contracts, migrations, bridge-API expansion, OpenAPI changes, codegen,
> or UI may be authored against this spec until the gates listed below
> clear. This file is the canonical record of those gates.

# Coordination — 006-payments-tender

**Feature:** 006-payments-tender
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v0.1 (draft)
**Tasks:** [./tasks.md](./tasks.md) (DRAFT — all rows BLOCKED)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-09
**Last updated:** 2026-05-09 (draft created; all gates held)

---

## Purpose

Track project coordination state for 006-payments-tender during the
**pre-approval** phase. This file is the canonical answer to:

- "Why isn't 006 startable?" (because the upstream contracts it depends
  on do not yet exist or are not yet approved)
- "What needs to happen, and in what order, before 006 may begin?"

This file is **not** a tasks file. It does not authorize implementation.
It is the canonical record of "who owns what before 006 work may begin",
and it is updated in place as coordination items resolve.

---

## Current phase / status

**Phase: PRE-APPROVAL DRAFT.** All gates held.

| Item | State |
|:--|:--|
| Spec authored | ✅ DRAFT (this PR) |
| Plan authored | ✅ DRAFT (this PR) |
| Tasks authored | ✅ DRAFT — all rows BLOCKED (this PR) |
| `/speckit-clarify` | ❌ Deferred (see GATE §A0) |
| `/speckit-plan` (v1.0) | ❌ Deferred |
| `/speckit-tasks` (startable list) | ❌ Deferred |
| `/speckit-analyze` | ❌ Deferred |
| Slice 0 visual direction | ❌ Held under §A1 |
| Implementation slices | ❌ All held |

---

## Primary blocker

> **`specs/005-sales-cart/` is currently an empty placeholder directory.**
> No `spec.md`, no `plan.md`, no checkout-handoff contract exists yet.
> This is the *primary* blocker for 006: payments cannot define the
> behaviour on the receiving side of a handoff that has not been authored
> on the sending side.

Until 005 has an approved spec and an approved cart-handoff contract, no
work item in 006 — not even the visual direction Slice 0 — may begin.

---

## Gate ledger (mirror of [./plan.md](./plan.md) §"Approval Gates" and
[./tasks.md](./tasks.md) §"Approval Gates")

| Gate | What it gates | Status | Owner |
|:--:|:--|:--:|:--|
| **§A0 — Upstream readiness** | All of: (a) **004-operator-session** Slice 4 / Slice 5 visibility boundaries complete and approved; (b) **005-sales-cart** spec authored, clarified, and approved; (c) **005 ↔ 006 checkout-handoff contract** pinned in 005. **§A0 must clear before any other 006 gate may be opened.** | ⛔ Held | Ahmed (POS-Pulse) |
| **§A1** | Visual-direction Slice 0 (FR-033 inherited from 004) — payment surface, tender selection, cash entry, change display, success / cancel / failure variants, force-fail manager surface. | ⛔ Held — gated on §A0 | TBD |
| **§A2** | Backend / OpenAPI: any backend dependency 006 introduces. Currently expected: none for cash-only scope; possibly some for force-fail audit propagation. | ⛔ Held — gated on §A0 | TBD (POS-Pulse + SmartDataPulse backend, mirrored from 004 §A2) |
| **§A3** | Migrations: any local SQLite tables 006 introduces. Currently none planned because the 004 audit-event store is the audit sink. **Explicit no-op approval still required** before code lands. | ⛔ Held — likely no-op | TBD |
| **§A4** | Bridge-API surface: the `payments.*` (or equivalent) namespace, defined post-handoff-contract pinning. | ⛔ Held — gated on §A0 + AD-DEFERRED-3 | TBD |
| **§A5** | Production readiness (coverage thresholds, security review, redaction audit). Blocks rollout, not slice merge. | ⛔ Held | TBD at rollout PR open time |

---

## Dependencies

### 1. 004-operator-session

- **Required state:** Slice 4 / Slice 5 complete and approved.
- **Why 006 needs it:** 006 attribution (FR-013, FR-014) and permission
  boundaries (FR-020, FR-021, FR-022) quote 004 directly. The audit-
  event catalogue (004 FR-025 / FR-026) is the parent for all
  payment-related audit events; the closed set of `payment.*`
  categories must be reviewed against the 004 catalogue.
- **Specific 004 contracts 006 will consume:**
  - 004 FR-001 / FR-013 / FR-014 (operator identity, single-active
    session, Clerk-backed attribution).
  - 004 FR-019 / AD-1 (information-layer enforcement of role
    boundaries; payment surface is governed by the same rule).
  - 004 FR-020 (operator badge always visible).
  - 004 FR-024 (manager-attributable forced action — pattern
    inherited by 006 FR-021 force-fail).
  - 004 FR-025 / FR-026 / FR-028 (canonical audit events,
    append-only).
  - 004 NFR-002 (PII / cards / secrets never in logs).
- **Status check (2026-05-09):** 004 S1 / S2 / S3 ✅; **S4 in progress
  (gates cleared, implementation may begin)**; S5 not yet started.
  See `specs/004-operator-session/coordination.md`.

### 2. 005-sales-cart

- **Required state:** spec approved AND cart-handoff contract pinned.
- **Why 006 needs it:** FR-002, FR-003, FR-022, FR-030 all cite the
  cart-handoff slot. Without 005, the slot's shape, persistence,
  identity, and lifecycle are undefined.
- **Specific 005 contracts 006 will consume:**
  - The "approved checkout-ready cart" data shape and persistence
    semantics.
  - The handoff slot's lifecycle (when does a cart enter? when does it
    leave on cancel? when does it leave on failure? when does it leave
    on settle?).
  - The cart's `total_minor` integer-minor-unit guarantee
    (Constitution P-II) — must be load-bearing.
  - Any cart-side audit events that 006 should not duplicate.
- **Status check (2026-05-09):** `specs/005-sales-cart/` exists as an
  empty directory only. **No spec, no plan, no tasks, no contract.**
  This is the primary blocker.

### 3. Future receipts spec

- **Required state:** spec approved.
- **Why 006 needs it:** FR-031 (handoff out of payments) is owned by
  the receipts spec.
- **Status:** Not yet authored. Acceptable: 006 can ship Slices 1–3
  without receipts, treating the post-settle handoff as a
  placeholder; the cart is consumed and the surface returns to the
  pre-handoff state pending receipts.

### 4. Future inventory spec

- **Why 006 references it:** FR-041 explicitly disclaims inventory
  mutation. 006 does not consume an inventory contract; it only
  guarantees it does not write one.

### 5. Future shift-management spec

- **Why 006 references it:** FR-042, OQ-DRW-1…4. 006 emits
  `payment.settled` audit events; the shift-management spec consumes
  them to compute drawer expected total / variance / shortage /
  overage. 006 does not write drawer state.

---

## Open questions

> Each of these is a deliberate *deferral*. Resolving any of them in
> this PR would lock implementation shape against missing upstream
> contracts.

### Owned by 006 once unblocked

- **OQ-1 (FR-002):** Exact shape of the approved checkout-handoff
  slot. Pending 005.
- **OQ-2 (FR-006):** Final closed set of `payment.failed` reason
  categories. Proposed: `cart_lost`,
  `operator_session_terminated`, `dependency_unavailable`,
  `internal_error`. Pending review against 004 audit catalogue.
- **OQ-3 (User Story 2 #2):** On cancel, where does control return —
  to 005's pre-checkout state or to a re-runnable handoff slot?
  Pending 005's handoff-slot lifecycle decision.
- **OQ-4 (FR-021):** Force-fail authorisation flow shape — inline
  manager re-auth on the payment surface vs. dedicated manager
  incident-response surface. Pending 004 S5 manager-surface
  conventions.
- **OQ-OFF-1 / OQ-OFF-2 / OQ-OFF-3 / OQ-OFF-4 (spec
  §"Offline behaviour — questions only"):** Offline cash settlement
  semantics. Deferred to a dedicated offline-payments review.
- **OQ-DRW-1 / OQ-DRW-2 / OQ-DRW-3 / OQ-DRW-4 (spec
  §"Drawer-impact — questions only"):** Drawer-impact contract.
  Deferred to future shift-management spec.

### Owned by 005, blocking 006

- **OQ-005-1:** Cart-handoff slot data shape (line items, totals,
  metadata).
- **OQ-005-2:** Cart-handoff slot persistence semantics (in-memory
  vs. local-DB-backed).
- **OQ-005-3:** Cart-handoff slot lifecycle (entry / exit on
  settle / exit on cancel / exit on failure).
- **OQ-005-4:** Currency contract (single currency per cart? minor-
  unit guarantee enforced upstream?).

### Owned by future specs, not blocking 006 Slice 0–3

- **OQ-RCPT-1:** Receipts handoff data shape.
- **OQ-INV-1:** Inventory-mutation timing (likely on settle, but owned
  by future inventory spec).
- **OQ-SHIFT-1:** Drawer-state event consumer contract.

---

## Required approvals

Before any 006 implementation work may begin, the following approvals
MUST be recorded **in writing** (PR description, plan revision, or
this file's gate ledger):

1. **§A0 ✅** — confirmed in this file by:
   - 004 coordination.md showing S4 ✅ and S5 ✅.
   - `specs/005-sales-cart/spec.md` and `plan.md` exist and are
     approved.
   - 005 ↔ 006 handoff contract pinned in 005's contracts/.
2. **§A1 ✅** — Slice 0 visual direction approved-with-revisions or
   approved (mirrors 004 Slice 0 sign-off pattern).
3. **§A2 review** — even if the conclusion is "no backend
   dependencies for cash-only scope", the conclusion must be
   recorded.
4. **§A3 no-op approval** — explicit acknowledgement that 006
   introduces no new SQLite tables (or, if discovered otherwise
   during clarify, explicit table approval analogous to 004 §A3).
5. **§A4 bridge-API review** — security-review handoff on whatever
   `payments.*` namespace is proposed.
6. **§A5 production readiness** — coverage, redaction audit,
   security-review sign-off.

---

## Explicit instruction

> **No implementation until this spec is reviewed and approved.**
>
> Specifically:
>
> - No `src/**` source changes.
> - No `migrations/**` changes.
> - No bridge-API changes to `src/shared/bridge-api.ts`.
> - No `npm run codegen:api`.
> - No OpenAPI changes (POS-Pulse or Data-Pulse-2).
> - No Data-Pulse-2 changes of any kind.
> - No CI workflow changes.
> - No package additions.
>
> The only artefacts this PR introduces are these four spec documents.
> They lock in **product behaviour** and **questions**, not
> **implementation**.

---

## Cross-references

- 004 coordination model: [`../004-operator-session/coordination.md`](../004-operator-session/coordination.md)
- 004 plan §"Approval Gates": [`../004-operator-session/plan.md`](../004-operator-session/plan.md)
- 005 spec (when authored): `../005-sales-cart/spec.md`
- Constitution v1.5.1: [`../../.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

---

## Update protocol

This file is updated **in place** as coordination items resolve. Each
update MUST:

1. Bump the **Last updated** line at the top with an ISO date and a
   one-line summary.
2. Update the gate ledger row(s) affected.
3. If a gate clears, link to the PR / SHA / artefact that cleared it
   (mirroring 004's coordination.md style).
4. Never delete a closed open question; mark it ✅ and link to the
   resolution.
