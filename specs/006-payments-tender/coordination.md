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
**Last updated:** 2026-05-19 (`/speckit-clarify` applied: FR-002, FR-006, FR-030, FR-031 resolved; OQ-005-1..4 reconciled; §A0 still procedurally held pending `/speckit-plan` v1.0)

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

**Phase: PRE-APPROVAL DRAFT.** §A0 functionally cleared; procedurally held (Spec Kit re-run required before any implementation may begin).

| Item | State |
|:--|:--|
| Spec authored | ✅ DRAFT |
| Plan authored | ✅ DRAFT |
| Tasks authored | ✅ DRAFT — all rows BLOCKED |
| 004 S4/S5 complete | ✅ 2026-05-14 (PRs #133–#143) |
| 005 spec approved | ✅ 2026-05-14 |
| 005 ↔ 006 handoff contract (§A4) | ✅ 2026-05-17 — `PaymentIntentEnvelope v1` ratified |
| 005 T100 functional sign-off | ✅ 2026-05-19 (PR #181; SQLite evidence verified) |
| `/speckit-clarify` | ✅ applied 2026-05-19 (FR-002, FR-006, FR-030, FR-031 resolved; see Clarification results below) |
| `/speckit-plan` (v1.0) | ❌ Not yet run — required next step |
| `/speckit-tasks` (startable list) | ❌ Deferred until after /speckit-plan |
| `/speckit-analyze` | ❌ Deferred until after /speckit-tasks |
| Slice 0 visual direction | ❌ Held under §A1 |
| Implementation slices | ❌ All held |

---

## Primary blocker

> **The functional upstream prerequisites for 006 are now resolved.**
> `specs/005-sales-cart/` has a complete, approved spec, plan, data
> model, contracts, and six implementation slices ending in T100
> functional sign-off (2026-05-19, PR #181). The `PaymentIntentEnvelope
> v1` handoff contract was ratified 2026-05-17.

The remaining blocker is **procedural**: 006 must complete the full Spec
Kit re-run sequence (`/speckit-clarify` → `/speckit-plan` → `/speckit-tasks`
→ `/speckit-analyze`) before any implementation work may begin. §A0 is
**functionally cleared** but **procedurally held** until that sequence
completes and the resulting artefacts are approved.

No work item in 006 — not even the visual direction Slice 0 — may begin
until `/speckit-clarify` is run and the resulting OQ resolutions are
merged.

---

## Gate ledger (mirror of [./plan.md](./plan.md) §"Approval Gates" and
[./tasks.md](./tasks.md) §"Approval Gates")

| Gate | What it gates | Status | Owner |
|:--:|:--|:--:|:--|
| **§A0 — Upstream readiness** | All of: (a) **004-operator-session** Slice 4 / Slice 5 visibility boundaries complete and approved; (b) **005-sales-cart** spec authored, clarified, and approved; (c) **005 ↔ 006 checkout-handoff contract** pinned in 005. **§A0 must clear before any other 006 gate may be opened.** | ✅ Functionally cleared 2026-05-19 · `/speckit-clarify` ✅ applied 2026-05-19 — **procedurally held** until `/speckit-plan` v1.0 merges | Ahmed (POS-Pulse) |
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
- **Status check (2026-05-19):** 004 S1 / S2 / S3 / S4 / S5 ✅ complete.
  S4 closed 2026-05-14 (PRs #59–#122, T056 waived). S5 closed 2026-05-14
  (PRs #133–#143). S6 Phase 8 (T094–T099) and production readiness
  (T100–T102) remain open but do NOT block 006 §A0.
  See `specs/004-operator-session/tasks.md`.

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
- **Status check (2026-05-19):** `specs/005-sales-cart/` is fully
  authored and approved. Spec ✅ 2026-05-14; plan ✅; data-model ✅; four
  contracts (bridge-api.md, handoff-envelope.md, role-visibility-matrix.md,
  and data-model.md) ✅; six implementation slices complete; T100
  functional sign-off ✅ 2026-05-19 (PR #181). `PaymentIntentEnvelope v1`
  ratified under §A4 on 2026-05-17 by Ahmed Shaaban. This is the
  authoritative handoff contract 006 consumes.

  **UI polish for 005 is intentionally deferred** to a future dedicated
  Impeccable / UI slice. T100 sign-off was functional only; the 005 UX
  is not production-polished yet. 006 must not be gated on that polish
  completing before it runs its own Spec Kit re-run.

  **Catalogue authority:** Product catalogue truth belongs in
  Data-Pulse-2 / backend. POS-Pulse 005 uses a dev-fixture resolver
  (R7 seam) through T100. The live catalogue integration is a future
  feature. **006 does not need the live catalogue for cash-only tender
  planning** — the `PaymentIntentEnvelope v1` already carries
  `subtotal_minor` as a frozen integer in minor units, which is the
  only money input 006 needs for its initial cash-settlement path.

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

- **OQ-1 (FR-002) ✅ RESOLVED 2026-05-19:** The approved
  checkout-handoff slot is the frozen `PaymentIntentEnvelope v1`
  produced by 005's `cart.handoff` handler. FR-002 in
  [./spec.md](./spec.md) now names the envelope explicitly.
- **OQ-2 (FR-006) ✅ RESOLVED 2026-05-19:** Closed set of
  `payment.failed` reason categories is locked: `cart_lost`,
  `operator_session_terminated`, `dependency_unavailable`,
  `internal_error`, `stale_handoff`, `tender_underpaid`. Reconciled
  against 004's audit catalogue and 005's `version` / `stale_version`
  refusal semantics. FR-006 in [./spec.md](./spec.md) now carries the
  set.
- **OQ-3 (User Story 2 #2) — REFRAMED 2026-05-19:** On cashier-initiated
  cancel, the bound `PaymentIntentEnvelope v1` remains intact and
  re-runnable (the envelope is immutable per 005 §"Immutability
  guarantees"). The remaining decision is the *UX target* of the surface
  transition (return to tender selection vs. exit to a re-runnable handoff
  state) — to be resolved in `/speckit-plan` as AD-DEFERRED-3.
- **OQ-4 (FR-021):** Force-fail authorisation flow shape — inline
  manager re-auth on the payment surface vs. dedicated manager
  incident-response surface. To be resolved in `/speckit-plan` as
  AD-DEFERRED-4 (004 S5 manager-surface conventions now load-bearing).
- **OQ-OFF-1 / OQ-OFF-2 / OQ-OFF-3 / OQ-OFF-4 (spec
  §"Offline behaviour — questions only"):** Offline cash settlement
  semantics. Deferred to a dedicated offline-payments review.
- **OQ-DRW-1 / OQ-DRW-2 / OQ-DRW-3 / OQ-DRW-4 (spec
  §"Drawer-impact — questions only"):** Drawer-impact contract.
  Deferred to future shift-management spec.

### Owned by 005, blocking 006 *(all resolved — 2026-05-19)*

- **OQ-005-1 ✅ RESOLVED:** Cart-handoff slot data shape is
  `PaymentIntentEnvelope v1` — see
  `specs/005-sales-cart/contracts/handoff-envelope.md`. Fields:
  `envelope_version='v1'`, `cart_id`, `operator_session_id`,
  `owning_operator_id`, `tenant_id`, `branch_id`, `terminal_id`,
  `lines[]` (LineSnapshot with `item_ref`, `display_name`, `quantity`,
  `unit_price_minor`, `line_subtotal_minor`, `note`, `version`,
  `last_action_id`), `discount_placeholders[]`, `subtotal_minor`,
  `created_at`, `handoff_action_id`.

- **OQ-005-2 ✅ RESOLVED:** Persistence is dual — in-memory as a
  TypeScript `Readonly<>` / `Object.freeze`-recursive object, and
  JSON-persisted on `carts.handoff_envelope_json` (immutable once
  written). 006 receives the frozen in-memory value; if it needs to
  re-read after a crash the bridge re-applies `Object.freeze` on
  JSON-parse. See `specs/005-sales-cart/contracts/handoff-envelope.md`
  §"Immutability guarantees".

- **OQ-005-3 ✅ RESOLVED:** Entry — cart.handoff handler transitions
  `carts.state` to `frozen_handed_off` and returns the envelope.
  Exit on cancel — a manager-attributed `cart.cancel.post_handoff`
  action transitions the cart back to `cancelled`; 006 must trigger
  this via the existing `cart.void` bridge handler. Exit on settle
  and exit on failure are 006-owned transitions (details to be locked
  in `/speckit-clarify`). See `specs/005-sales-cart/contracts/bridge-api.md`
  §`cart.handoff` and §`cart.void`.

- **OQ-005-4 ✅ RESOLVED:** Single currency per cart; integer minor-unit
  guarantee enforced upstream. `subtotal_minor` is `Σ line_subtotal_minor`
  — integer arithmetic only, `Number.isSafeInteger`-guarded.
  Constitution Principle II applies end-to-end; 005 never produces a
  float. See `specs/005-sales-cart/data-model.md` §CartLine invariant 3.

### Owned by future specs, not blocking 006 Slice 0–3

- **OQ-RCPT-1:** Receipts handoff data shape.
- **OQ-INV-1:** Inventory-mutation timing (likely on settle, but owned
  by future inventory spec).
- **OQ-SHIFT-1:** Drawer-state event consumer contract.

---

## Clarification results — `/speckit-clarify` Session 2026-05-19

This section is the canonical coordination-side record of the
`/speckit-clarify` run applied on 2026-05-19. The spec-side detail lives
in [./spec.md](./spec.md) §Clarifications "Session 2026-05-19"; this
section summarises the cross-feature implications.

**Markers resolved in `spec.md`:**

| Marker | Resolution summary |
|:--|:--|
| **FR-002** | Tender selection gated on a frozen `PaymentIntentEnvelope v1` from 005's `cart.handoff`. |
| **FR-006** | Closed failure-reason set locked at six categories (see OQ-2 above). |
| **FR-030** | Initial cash-only path consumes `envelope.subtotal_minor` and `envelope.handoff_action_id`; `v1` only; extensions bump `envelope_version`. |
| **FR-031** | Initial cash-only path emits `payment.settled` keyed to `handoff_action_id`; receipt rendering deferred to receipts spec. |

**Open questions resolved:**

| Question | Resolution |
|:--|:--|
| **OQ-1** | Resolved by FR-002 — the envelope is the handoff slot. |
| **OQ-2** | Resolved by FR-006 — closed enum locked. |
| **OQ-005-1..4** | Already resolved in PR #182 by 005's `PaymentIntentEnvelope v1` ratification; re-confirmed here. |

**Open questions reframed but still owner-decision pending:**

| Question | Reframing |
|:--|:--|
| **OQ-3** | Cashier-cancel UX target — to be resolved in `/speckit-plan` as AD-DEFERRED-3. |
| **OQ-4** | Force-fail authorisation UX shape — to be resolved in `/speckit-plan` as AD-DEFERRED-4. |

**Open questions still deferred (out of scope for this clarify pass):**

- OQ-OFF-1..4 (offline cash settlement) — deferred to a dedicated
  offline-payments review.
- OQ-DRW-1..4 (drawer-impact contract) — deferred to the future
  shift-management spec.

**What this clarification does NOT do:**

- Does NOT open §A1–§A5 (all five gates remain ⛔ Held).
- Does NOT make `tasks.md` startable (it remains DRAFT — all rows
  BLOCKED).
- Does NOT lock any AD-DEFERRED-1..6 (those resolve in
  `/speckit-plan`).
- Does NOT modify any source file, test, package file, migration,
  OpenAPI surface, codegen output, CI workflow, or Data-Pulse-2.

**Reconciliation note:** the procedural hold on §A0 lifted by this PR
*for the clarify step only*. The hold remains on §A0 for the next three
Spec Kit steps (`/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`).
The gate ledger above tracks the remaining held items.

---

## Required approvals

Before any 006 implementation work may begin, the following approvals
MUST be recorded **in writing** (PR description, plan revision, or
this file's gate ledger):

1. **§A0 — functionally cleared 2026-05-19; procedurally held.**
   Functional evidence recorded in this file:
   - 004 S4 ✅ 2026-05-14 (PRs #59–#122) and S5 ✅ 2026-05-14
     (PRs #133–#143).
   - `specs/005-sales-cart/spec.md`, `plan.md`, and six implementation
     slices complete; T100 functional sign-off 2026-05-19 (PR #181).
   - `PaymentIntentEnvelope v1` ratified §A4 on 2026-05-17 in
     `specs/005-sales-cart/contracts/handoff-envelope.md`.
   - `/speckit-clarify` ✅ applied 2026-05-19 — see §"Clarification
     results" above.
   **Remaining procedural hold lifts** when `/speckit-plan` v1.0
   (resolving AD-DEFERRED-1..6) is merged, followed by `/speckit-tasks`
   and `/speckit-analyze`. Only after that sequence completes may §A1
   visual-direction work commission.
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

## Catalogue authority and UI polish deferral (2026-05-19)

### Catalogue authority

Product catalogue truth (item display names, prices, SKU master) belongs
in **Data-Pulse-2 / SmartDataPulse backend**. POS-Pulse 005 snapshots
display names and unit prices into `cart_lines` at add-time (FR-011,
FR-013) and into the `PaymentIntentEnvelope v1` `lines[]` at handoff
time. **The envelope is a complete, frozen view** — 006 does NOT need to
reach back into `cart_lines`, the catalogue API, or Data-Pulse-2 to
settle a cash payment. `subtotal_minor` in the envelope is the single
authoritative money input.

When a real catalogue integration ships (future feature), 006 is
unaffected: it always consumes the frozen envelope, never the live
catalogue.

### UI polish deferral

005 T100 sign-off (2026-05-19) was **functional**. The 005 cart UX is
not yet production-polished (no Impeccable / design-token sweep has been
applied). A future dedicated UI-polish slice will address 005 UX
quality. **006 must not wait for that polish** before proceeding with
its own Spec Kit re-run; 006 has its own §A1 visual-direction gate that
governs its own payment-surface design quality.

### First target for 006 planning

When `/speckit-clarify` runs, the recommended first implementation scope
is **cash-only tender Slices 1–3** (tender selection, cash entry + change
rule, payment FSM + audit events). This matches:
- User Story 1 (P1) and User Story 2 (P2) from spec.md.
- The frozen `subtotal_minor` from the `PaymentIntentEnvelope v1`
  (no catalogue, no backend round-trip required for cash settlement).
- Constitution P2 (no fake success), P4 (append-only audit), P10
  (operator attribution).

Slice 4 (force-fail) and any non-cash tender type are deferred.

---

## Cross-references

- 004 coordination model: [`../004-operator-session/coordination.md`](../004-operator-session/coordination.md)
- 004 plan §"Approval Gates": [`../004-operator-session/plan.md`](../004-operator-session/plan.md)
- 005 spec: [`../005-sales-cart/spec.md`](../005-sales-cart/spec.md)
- 005 handoff contract (normative): [`../005-sales-cart/contracts/handoff-envelope.md`](../005-sales-cart/contracts/handoff-envelope.md)
- 005 bridge API: [`../005-sales-cart/contracts/bridge-api.md`](../005-sales-cart/contracts/bridge-api.md)
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
