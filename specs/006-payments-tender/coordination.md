> ## STATUS: PARTIAL — Slice 0 ✅ · Slice 1 ✅ · Slice 2 ✅ · S3a AUTHORIZED (§A3 + §A4-A signed off) · Slices 3-rest pending S3a
>
> **006-payments-tender is partially implemented.** Slice 0 (visual
> direction), Slice 1 (renderer-only tender selection + envelope
> ingest), and Slice 2 (per-tender entry surfaces — cash +
> external_card_terminal) shipped via PR #189/#190, PR #192, and
> PR #198. The Slice 1 Maestro closeout merged as PR #196; the
> Slice 2 Maestro closeout merged with this PR. **§A3 and §A4-A
> were signed off 2026-05-21 by Ahmed (Approved — no changes
> requested); S3a may now begin via the next Maestro implementation
> prompt.** S3b, S3c, and S3d remain blocked on their predecessor's
> GREEN. §A4-B (Slice 4 voucher bridge review) remains held. §A2
> is no-op for Slices 1–3 (plan AD-8). §A5 is rollout-only. This
> file is the canonical record of those gates.

# Coordination — 006-payments-tender

**Feature:** 006-payments-tender
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0 (authored 2026-05-19, supersedes v0.1)
**Tasks:** [./tasks.md](./tasks.md) (DRAFT — all rows BLOCKED)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-09
**Last updated:** 2026-05-21 (Slice 2 ✅ — PR #198 merged at `9bb2af3` on 2026-05-21T12:59:38Z; T040–T051 complete. Per-tender entry surfaces (`<CashEntry>`, `<ExternalCardTerminalEntry>`) plus `computeChangeDueMinor` + `validateExternalReference` helpers delivered renderer-only. `external_reference` regex `^[A-Z0-9]{0,6}$` makes a PAN structurally unrepresentable (FR-008/FR-009). **Slices 3–5 not started** — Slice 3 requires a fresh Maestro preflight + §A3 (migrations) + §A4-A (bridge security review) before implementation begins. Per-slice §A2 / §A3 / §A4 remain held for Slices 3–4; §A5 rollout-only. See §"Maestro closeout — Slice 2 (PR #198)" below. **Slice 3 owner decisions recorded 2026-05-21** — see §"Slice 3 owner decisions — Session 2026-05-21" below. **Slice 3 reviewers commissioned 2026-05-21 (sign-off pending)** — §A3 reviewer: Ahmed; §A4-A reviewer: Ahmed; both gates remain ⛔ Held; see §"Reviewer commissioning — 2026-05-21" below. **§A3 and §A4-A signed off 2026-05-21 by Ahmed (Approved — no changes requested); S3a is now AUTHORIZED.**)

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

**Phase: PARTIAL IMPLEMENTATION.** Slice 0 (visual direction), Slice 1 (renderer-only tender selection + envelope ingest), and Slice 2 (per-tender entry surfaces — cash + external_card_terminal) are complete via PR #189/#190, PR #192, PR #196 (Slice 1 closeout), and PR #198 (Slice 2 closeout). **§A3 and §A4-A were signed off 2026-05-21 by Ahmed (Approved — no changes requested); S3a is now authorized and is the next implementation step.** S3b begins when S3a is GREEN; S3c begins when S3b is GREEN; S3d begins when S3c is GREEN. §A4-B (voucher bridge review) remains held — it gates Slice 4, not Slice 3. §A2 is no-op for Slices 1–3 (plan AD-8); it will commission before Slice 4 begins. §A5 is rollout-only.

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
| Tender-scope amendment (cash + external_card_terminal + internal_voucher + split tender) | ✅ applied 2026-05-19 — supersedes cash-only assumption from PR #183 (see "Tender-scope amendment 2026-05-19" below) |
| `/speckit-plan` v1.0 (resolves **AD-DEFERRED-1..6 + OQ-PLAN-1..9**) | ✅ **authored 2026-05-19** — see [./plan.md](./plan.md) §"Architectural Decisions (LOCKED in v1.0)" and §"Plan v1.0 — Session 2026-05-19" below |
| Companion artefacts: research.md / data-model.md / quickstart.md / contracts/bridge-api.md | ✅ authored 2026-05-19 (data-model: three new SQLite tables; bridge: `payments.*` + `tender.*` namespaces, DRAFT) |
| `/speckit-tasks` (startable list) | ✅ **applied 2026-05-19** — see [./tasks.md](./tasks.md) for the full per-slice task list with file paths + TDD pairing + parallelism markers |
| `/speckit-analyze` | ✅ **Complete — merged PR #187 (2026-05-19).** Cross-artifact consistency check cleared; Phase 1 coordination update recorded. Phase 1 opens the path to Slice 0 commissioning only. |
| Slice 0 visual direction | ✅ T011 signed off 2026-05-20 (PR #189 → PR #190; reviewer: Ahmed; result: approved) |
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
| **§A1** | Visual-direction Slice 0 (FR-033 inherited from 004) — payment surface, tender selection, cash entry, change display, success / cancel / failure variants, force-fail manager surface. | ✅ Signed off 2026-05-20 — PR #189 (T010 visual direction) + PR #190 (T011 sign-off). Reviewer: Ahmed. Result: approved. Clears Slice 1, Slice 2, and the documented Slice 4 force-fail visual variant. | Ahmed |
| **§A2** | Backend / OpenAPI: any backend dependency 006 introduces. Currently expected: none for cash-only scope; possibly some for force-fail audit propagation. | ⛔ Held — gated on §A0 | TBD (POS-Pulse + SmartDataPulse backend, mirrored from 004 §A2) |
| **§A3** | Migrations: any local SQLite tables 006 introduces. Three new tables required for Slice 3: `payment_attempts`, `payment_tender_lines`, `payment_action_outbox` — plus indexes, CHECK constraints, append-only trigger, and extension of 004's `audit_events.action_category` with 7 new categories. | ✅ Signed off 2026-05-21 — Reviewer: Ahmed. Approved — no changes requested. Scope reviewed: three new SQLite tables (payment_attempts, payment_tender_lines, payment_action_outbox) + indexes + CHECK constraints + append-only trigger + extension of 004's audit_events.action_category with 7 new categories. Authorizes S3a implementation. | Ahmed |
| **§A4-A** | Bridge-API surface review for the payments.* + tender.* namespaces (11 handlers; requireOperatorSession gating; idempotency-key strategy; refusal envelope; FR-013/FR-014 Clerk-backed attribution; PII / card-data / voucher-token redaction). Required before Slice 3 ships. | ✅ Signed off 2026-05-21 — Reviewer: Ahmed. Approved — no changes requested. Authorizes S3c bridge handlers. | Ahmed |
| **§A4-B** | Bridge-API surface review for the vouchers.* namespace (Contract V-A: vouchers.validate / vouchers.redeem / vouchers.reverse). Required before Slice 4 ships. | ⛔ Held — pending Slice 4 voucher contract | TBD before Slice 4 |
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

### First target for 006 planning ⚠ amended 2026-05-19

The 2026-05-19 tender-scope amendment expanded v1 scope to three
tender types plus split tender. The recommended first implementation
scope is now:

- **US1 (cash) + US4 (external_card_terminal, record-only) as parallel
  P1** in Slices 1–3 (tender selection, per-tender entry surfaces,
  payment FSM + TenderLine FSM + audit events). Both rely on the
  frozen `subtotal_minor` from the `PaymentIntentEnvelope v1`; neither
  requires a backend round-trip; neither captures card data.
- **US6 (split tender) as P2 in Slice 3** alongside the FSM work —
  TenderLine arithmetic and split-tender rollback (FR-006B) are
  load-bearing for the FSM and cannot be cleanly deferred.
- **US5 (internal_voucher) as P2 deferred to a slice after the
  voucher-authority contract clears (OQ-PLAN-7).** Until then the
  voucher tender slot is reserved-but-disabled.
- **Slice 4 (force-fail)** and **Slice 5 (production readiness)**
  remain deferred per plan v0.1.

This matches:

- The three in-scope tender types per the amendment.
- Constitution P2 (no fake success), P4 (append-only audit), P6 (no
  raw cardholder data), P7 (secrets never reach renderer/logs), P10
  (operator attribution).
- The Data-Pulse-2 voucher-authority boundary above — Slices 1–3
  ship without any voucher work, preserving the boundary.

Real card processor integration, voucher issuance, voucher
cancellation, and all other non-in-scope tender features remain
deferred to later, explicitly scoped features.

---

## Tender-scope amendment — Session 2026-05-19

This section is the coordination-side record of the **tender-scope
amendment** applied on 2026-05-19, **after** the `/speckit-clarify`
session and **before** `/speckit-plan` v1.0. The spec-side detail lives
in [./spec.md](./spec.md) §Clarifications "Session 2026-05-19 — Tender
scope amendment" and §"Tender scope (amendment 2026-05-19)".

### What changed

The product owner amended 006's tender scope:

| Aspect | Before amendment (PR #183 / earlier) | After amendment (2026-05-19) |
|:--|:--|:--|
| Supported tender types | Cash only | `cash` + `external_card_terminal` (record-only) + `internal_voucher` (authority-validated) |
| Split tender | Out of scope | **In scope** — multiple `TenderLine`s per attempt, settlement when sum equals `envelope.subtotal_minor` |
| Card payments | Out of scope entirely | `external_card_terminal` **in scope as record-only**; real card processor / gateway integration **remains out of scope** |
| Voucher payments | Not specified | `internal_voucher` **in scope** as authority-validated; voucher **issuance / cancellation remain out of scope** and belong to Data-Pulse-2 |
| Settlement invariant | `cash_received_minor − total_minor ≥ 0` | `Σ applied TenderLine.amount_applied_minor == envelope.subtotal_minor`; cash MAY overpay (produces change), non-cash MUST NOT overpay |
| New FR-006 failure reasons | 6 categories | 14 categories (8 added: `non_cash_overpayment_refused`, `voucher_not_found`, `voucher_expired`, `voucher_cancelled`, `voucher_already_redeemed`, `voucher_tenant_mismatch`, `voucher_branch_mismatch`, `split_tender_rollback`) |

### Why now (sequencing rationale)

The cash-only assumption recorded by PR #183 was **functionally
correct for the `/speckit-clarify` step** (FR-002 / FR-006 / FR-030 /
FR-031 resolved against the cash-only first target) but is
**no longer correct for `/speckit-plan` v1.0**. Locking `/speckit-plan`
against the stale cash-only assumption would:

1. Force an immediate rework of plan.md before `/speckit-tasks`.
2. Allow Slices 1–3 to design without TenderLine arithmetic, which is
   load-bearing for FR-006B split-tender rollback.
3. Risk approving §A2 / §A3 / §A4 against a tender-namespace that
   omits `external_card_terminal` and `internal_voucher`.

Catching the scope expansion **before** `/speckit-plan` is the
cheapest place in the Spec Kit pipeline to absorb it.

### What `/speckit-plan` v1.0 must now resolve

`/speckit-plan` v1.0 was previously expected to resolve **six**
decisions (AD-DEFERRED-1..6). After this amendment, it must resolve
**six existing decisions + nine new open questions** raised by the
amendment:

- AD-DEFERRED-1 — Payment FSM ownership (unchanged).
- AD-DEFERRED-2 — Payment attempt persistence (now load-bearing: the
  TenderLine FSM + split-tender rollback require queryable mid-flight
  state — see OQ-PLAN-1).
- AD-DEFERRED-3 — Cashier cancel UX target (now multi-tender-aware:
  cancel may roll back already-applied non-cash lines per FR-006B).
- AD-DEFERRED-4 — Force-fail manager/admin UX shape (unchanged).
- AD-DEFERRED-5 — Offline cash settlement (unchanged; companion to
  OQ-OFF-EXT-1 and OQ-OFF-VCHR-1 from the amendment).
- AD-DEFERRED-6 — Drawer-impact signal (unchanged; companion to
  OQ-PLAN-9 below).

**New `/speckit-plan` open questions** (canonical list in
[./spec.md](./spec.md) §"`/speckit-plan` open questions"):

| OQ | Subject |
|:--|:--|
| OQ-PLAN-1 | Payment attempt + TenderLine persistence model — local SQLite tables vs. audit_events-only |
| OQ-PLAN-2 | Bridge-API namespace for `payments.*` / `tender.*` handlers + idempotency-key strategy |
| OQ-PLAN-3 | Partial voucher redemption — refuse vs. cap-and-preserve residual |
| OQ-PLAN-4 | Split-tender ordering and rollback semantics + `reversal_pending` resolution |
| OQ-PLAN-5 | External-card-terminal `external_reference` field policy — exists in v1? validation? redaction? |
| OQ-PLAN-6 | Idempotency and double-settlement prevention (attempt-level guarantee) |
| OQ-PLAN-7 | Voucher validation/redeem contract — V-A (backend-authoritative) vs. V-B (POS-local read-model) + minimised renderer-visible fields |
| OQ-PLAN-8 | Receipt handoff payload — per-line tender summary fields |
| OQ-PLAN-9 | Drawer-impact data preserved on the `payment.settled` event for future shift-management consumption |

### Data-Pulse-2 / SmartDataPulse backend boundary

**Voucher authority belongs to Data-Pulse-2 / SmartDataPulse backend.**
POS-Pulse MUST NOT implement voucher issuance, voucher cancellation,
voucher catalogue management, voucher-balance editing, or any
loyalty-campaign engine in this feature.

POS-Pulse v1 redeems vouchers only via the approved authoritative
contract — either:

- **Contract V-A — Backend-authoritative (preferred):** a future
  Data-Pulse-2 endpoint pair (`POST /vouchers/validate`,
  `POST /vouchers/redeem`) wrapped in `vouchers.validate` /
  `vouchers.redeem` POS-Pulse bridge handlers. Validation returns a
  short-lived non-sensitive redemption intent token bound to the
  payment attempt; redeem atomically consumes the intent at confirm.
- **Contract V-B — POS-local read-model (only if approved):** a
  future POS-local voucher authority/read-model with replicated
  voucher balance and a local atomic redeem; acceptable only if
  Data-Pulse-2 explicitly grants this authority to the POS terminal
  under a documented offline reconciliation contract.

The choice is **OQ-PLAN-7**. Until that contract is approved and the
corresponding bridge/read-model is in place, the `internal_voucher`
tender slot is **reserved-but-disabled**; invoking it returns the
generic `tender_not_yet_supported` refusal (same disabled-slot
pattern that protects future wallet/BNPL tender types).

**Data-Pulse-2 is NOT modified by this PR.** No
`smart-data-pulse-2/**` files are touched; no OpenAPI surface is
added; no codegen runs. The voucher-authority contract above is a
**future, separately-spec'd integration** between POS-Pulse and
Data-Pulse-2; this amendment only **records the boundary**.

### What this amendment does NOT do

- Does NOT modify Data-Pulse-2.
- Does NOT add a real card processor / gateway integration of any
  kind — `external_card_terminal` is **record-only** (FR-007/FR-008).
- Does NOT implement voucher issuance, voucher cancellation, or any
  loyalty-campaign behaviour (FR-018).
- Does NOT generate, render, or print receipts (FR-043 still binding).
- Does NOT lock the `TenderLine` data shape, persistence model,
  bridge namespace, rollback semantics, or voucher-authority contract
  — all are `/speckit-plan` v1.0 decisions (OQ-PLAN-1..7 above).
- Does NOT open §A1–§A5 (all five gates remain ⛔ Held).
- Does NOT make `tasks.md` startable (it remains DRAFT — all rows
  BLOCKED; banner updated only).
- Does NOT modify any source file, test, package file, migration,
  OpenAPI surface, codegen output, CI workflow, AGENTS.md, or
  CLAUDE.md.
- Does NOT produce `/speckit-plan` v1.0 — `/speckit-plan` remains
  the required next step, with expanded scope.

### Reconciliation note

The procedural hold on §A0 remains. `/speckit-plan` v1.0 was the
"next required step" before this amendment, and it remains the
"next required step" after — with the expanded decision set above.
006 stays DRAFT — BLOCKED until `/speckit-plan` → `/speckit-tasks`
→ `/speckit-analyze` complete in sequence.

---

## Plan v1.0 — Session 2026-05-19

This section is the coordination-side record of the `/speckit-plan`
v1.0 run applied on 2026-05-19. The plan-side detail lives in
[./plan.md](./plan.md) §"Architectural Decisions (LOCKED in v1.0)";
the rationale + alternatives in [./research.md](./research.md); the
persistence shape in [./data-model.md](./data-model.md); the bridge
contract in [./contracts/bridge-api.md](./contracts/bridge-api.md);
the end-to-end walkthrough in [./quickstart.md](./quickstart.md).

### Artefacts produced

| Path | Status | Role |
|:--|:--:|:--|
| `specs/006-payments-tender/plan.md` | ✅ rewritten to v1.0 | Locks AD-1..AD-9 (resolves AD-DEFERRED-1..6 + OQ-PLAN-1..9) |
| `specs/006-payments-tender/research.md` | ✅ new | Phase 0 Decision / Rationale / Alternatives for every AD + OQ |
| `specs/006-payments-tender/data-model.md` | ✅ new | Three new SQLite tables + four+four audit-event categories |
| `specs/006-payments-tender/contracts/bridge-api.md` | ✅ new (DRAFT — §A4 review required) | `payments.*` + `tender.*` namespace contract |
| `specs/006-payments-tender/quickstart.md` | ✅ new | End-to-end walkthrough preview (cash / cancel / fail / external_card_terminal / voucher / split) |
| `specs/006-payments-tender/coordination.md` | ✅ updated (this section) | Plan v1.0 status + reconciliation |
| `specs/006-payments-tender/tasks.md` | ✅ banner-only update | Records plan v1.0 ✅; `/speckit-tasks` ❌ next step; all rows remain BLOCKED |

### Architectural decisions locked

| AD | Subject | Decision |
|:--|:--|:--|
| AD-1 | Payment FSM ownership | **Main process** owns PaymentAttempt FSM, TenderLine FSM, validation, settlement / cancel / fail / force-fail, audit emission, idempotency replay, trust boundary. Renderer is display + input only. |
| AD-2 | Persistence | **Three new local SQLite tables** authored under §A3 in Slice 3: `payment_attempts`, `payment_tender_lines`, `payment_action_outbox`. Plus extension of 004's `audit_events` catalogue with 4 attempt-level + 4 per-line categories. |
| AD-3 | Bridge namespace | Split: **`payments.*`** (attempt-level) + **`tender.*`** (per-line). Refusal envelope uses `{ kind: 'refused', reason: '...' }` (mirrors 005; diverges from 004's `category` — see [./research.md](./research.md) R-2). |
| AD-4 | Cashier cancel UX | Cancel returns to **tender selection** with the immutable envelope still bound; all applied TenderLines are reversed LIFO per FR-006B. |
| AD-5 | Force-fail UX | **Dedicated manager incident-response surface in Slice 4** (not inline manager re-auth). Reuses 004 S5's manager-surface pattern. |
| AD-6 | Offline behaviour | Cash + external_card_terminal local-first; voucher gated (V-A refuses offline, V-B allows local atomic redeem if approved). |
| AD-7 | Voucher contract | **Contract V-A — Backend-authoritative** (Data-Pulse-2 endpoints wrapped in `vouchers.*` bridge handlers). **Partial voucher redemption: refuse**, not cap-and-preserve. V-B remains an approved fallback. |
| AD-8 | OpenAPI / backend impact | **Slices 1–3: no new OpenAPI surface.** §A2 no-op confirmed for these. **Slice 4: voucher endpoints + codegen** under §A2. |
| AD-9 | Drawer-impact signal | `payment.settled` audit event carries full tender breakdown (per-line `tender_type`, `amount_applied_minor`, `change_due_minor`, redacted references); future shift-management derives drawer impact. No separate `drawer.cash_delta` event. |

**Open questions resolved by plan v1.0** (one-line summary; full
reasoning in [./research.md](./research.md)):

| OQ | Resolution |
|:--|:--|
| OQ-PLAN-1 | Three new tables (data-model R-9). |
| OQ-PLAN-2 | `payments.*` + `tender.*` split + UUID v4 idempotency keys + `{ reason }` refusal field name (R-2). |
| OQ-PLAN-3 | **Refuse, not cap-and-preserve** partial voucher redemption (R-7). |
| OQ-PLAN-4 | **LIFO** rollback ordering + per-call idempotency + `reversal_pending` deferred resolver (R-13). |
| OQ-PLAN-5 | External_reference: optional, regex `^[A-Z0-9]{0,6}$`, redacted-in-logs (R-5). |
| OQ-PLAN-6 | Partial unique index `(terminal_id) WHERE state='started'` + outbox idempotency (R-6, R-10). 006-specific design — diverges from 005's app-layer pattern (R-6). |
| OQ-PLAN-7 | **Contract V-A** v1.0 stance; V-B remains an approved fallback (R-7). |
| OQ-PLAN-8 | Receipt-handoff payload = `payment.settled` audit payload tender breakdown (R-8). |
| OQ-PLAN-9 | Drawer signal preserved on `payment.settled`; no separate event (R-8). |

### Slice grouping locked

- **Slice 0** — Visual direction (no code).
- **Slice 1** — Tender selection + envelope ingest.
- **Slice 2** — Per-tender entry surfaces (cash + external_card_terminal).
- **Slice 3** *(load-bearing)* — FSM + TenderLine FSM + three tables + `payments.*` / `tender.*` bridge handlers (minus voucher / forceFail).
- **Slice 4** — Voucher (Contract V-A) + force-fail.
- **Slice 5** — Production readiness.

US5 (voucher) ships in Slice 4 — gated separately on OQ-PLAN-7's V-A
contract clearing. **Cash + external_card_terminal + split tender
ship as Slices 1–3 with zero Data-Pulse-2 dependency.**

### Deliberate skips and divergences (recorded for reviewer audit)

| Item | Reason |
|:--|:--|
| **CLAUDE.md SPECKIT marker update skipped** | The standard `/speckit-plan` skill outline (Phase 1 step 3) updates the `<!-- SPECKIT START --> ... <!-- SPECKIT END -->` markers in CLAUDE.md to reference this plan. The user prompt explicitly forbids modifying CLAUDE.md. Per the using-superpowers skill priority hierarchy (user instructions > superpowers skills > default system prompt), the user instruction wins. The skip is intentional. |
| **Refusal field name `reason`, not `category`** | 004's `operator.*` contract uses `category`; 005's `cart.*` uses `reason`. 006 follows 005 because 005 is the closer structural predecessor (`cart.*` → `payments.*` is one feature-pair). See [./research.md](./research.md) R-2. |
| **Partial unique index for "one started per terminal"** | 006-specific design choice. 005's analogous "one editing cart per session" is enforced at the application layer (005 data-model.md line 121). 006's per-terminal hardware coupling (single cash drawer) justifies the stronger DB-level guarantee. See [./research.md](./research.md) R-6. |
| **`/speckit-plan` applied, not freshly run** | The AD/OQ decisions came pre-supplied by the user prompt's `Required v1.0 decisions` section; this run *applies* them against the v1.0 plan structure rather than re-deriving the architecture. Full rationale per decision is in [./research.md](./research.md). |
| **No CLAUDE.md update / no agent context script run** | Per the user prompt forbid list. The CLAUDE.md SPECKIT-marker update is the only Phase 1 step from the standard skill outline that this plan does NOT execute. |

### Data-Pulse-2 boundary

**Data-Pulse-2 is NOT modified by this PR.** The voucher-authority
contract (V-A) is *recorded as a planned boundary* in this plan
([./contracts/bridge-api.md](./contracts/bridge-api.md) §"`vouchers.*`
namespace") but is **not implemented**. The two endpoints
(`POST /vouchers/validate`, `POST /vouchers/redeem`,
`POST /vouchers/reverse`) belong to a future Data-Pulse-2-led
integration spec that commissions before Slice 4 under §A2.

Voucher issuance, voucher cancellation, voucher catalogue management,
loyalty-campaign behaviour, and voucher-balance editing remain
**permanently out of scope for 006** (FR-018, plan §"Hard
non-implementation boundaries").

### What plan v1.0 does NOT do

- Does NOT modify Data-Pulse-2.
- Does NOT modify any source file, test, package file, lockfile,
  migration, OpenAPI surface, codegen output, CI workflow,
  AGENTS.md, or CLAUDE.md.
- Does NOT make `tasks.md` startable (banner-only update; all rows
  remain BLOCKED until `/speckit-tasks`).
- Does NOT open §A1–§A5 for implementation. Each gate's status is
  *recorded* but not *cleared*. Per-slice approval still required.
- Does NOT run `/speckit-tasks` or `/speckit-analyze`.
- Does NOT implement any 006 code.
- Does NOT start 007 work.
- Does NOT start UI polish (§A1 remains held).

### Reconciliation note

The procedural hold on §A0 lifts for the `/speckit-plan` step only
with this PR. The hold remains on §A0 for the next two Spec Kit
steps (`/speckit-tasks` → `/speckit-analyze`). The gate ledger above
tracks the remaining held items.

The prior cash-only `/speckit-plan` v1.0 WIP (from a previous
session) is preserved in `stash@{0}` on branch
`docs/006-speckit-plan`. It is NOT applied into this branch and
should NOT be applied — the tender-scope amendment supersedes its
persistence model and bridge namespace.

---

## Phase 1 setup — Session 2026-05-19

This section records the coordination outcomes for tasks T001–T006,
completing Phase 1 of 006-payments-tender. These tasks are
**docs/coordination-only**; no source, tests, migrations, bridge
handlers, package files, or Data-Pulse-2 changes are authorised by
this phase.

Phase 1 **opens the path to Slice 0 commissioning only.** All
implementation slices (Slice 1+) remain held on their respective
§A1–§A5 gates.

---

### T001 — Feature-flag inspection (§A5 pre-condition)

**Status:** inspection recorded; implementation deferred to the owning
implementation task

**Inspection date:** 2026-05-19 (Phase 1 coordination update)

**Files inspected:**

- `src/shared/app-config.ts` — `AppConfig` interface
- `src/renderer/stores/feature-flags-store.ts` — `useFeatureFlagsStore`

**Findings:**

| Item | Result |
|:--|:--|
| `payments` feature flag exists in `AppConfig.features` | ❌ **Absent.** `AppConfig.features` currently has only `{ cart?: boolean }`. No `payments` field is defined. |
| `payments` flag disabled by default in production | ❌ **Not applicable** — flag does not exist yet. |
| Renderer-store binding in `feature-flags-store.ts` | ❌ **Absent.** `FeatureFlagsState` only carries `cart: boolean`. No `payments` field or hydrate path for it. |

**Follow-up / blocker before implementation:**

The `payments` feature flag must be added to `AppConfig.features` and
`FeatureFlagsState` (with a `false` fail-safe default) by the owning
implementation task before any 006 renderer work lands. This is a
**pre-condition for §A5 production readiness**, not a blocker for
Slice 0 (visual direction has no runtime flag dependency) or the
Slice 1–3 main-process work.

Implementing the missing flag is **explicitly out of scope for this
Phase 1 coordination PR**. The owning task is the first
renderer-touching task in Slice 1 (T010 area) that gates on §A1
sign-off.

---

### T002 — §A3 migration-ordering coordination

**Status:** completed by Phase 1 coordination update

The plan (AD-2, data-model.md) locks three new SQLite tables that must
be authored in Slice 3 under §A3, in the following migration order:

| Migration # | Table / action | Notes |
|:--:|:--|:--|
| 1 | `payment_attempts` | Header; `UNIQUE INDEX ON payment_attempts(terminal_id) WHERE state='started'` for double-settlement prevention (R-6). |
| 2 | `payment_tender_lines` | Per-line; FK → `payment_attempts.id`. |
| 3 | `payment_action_outbox` | Append-only; FK → `payment_attempts.id` and `payment_tender_lines.id`. UPDATE/DELETE denied by trigger. |
| 4 | `audit_events.action_category` extension | Extend 004's closed `ActionCategory` enum with the 8 new payment/tender categories: `payment.settled`, `payment.cancelled`, `payment.failed`, `payment.force_failed`, `tender.applied`, `tender.refused`, `tender.reversed`, `tender.reversal_pending`. |

**Gate dependency:** §A3 must clear (explicit no-op approval for Slices
1–2; explicit table approval for Slice 3) before any migration SQL
is authored. See gate ledger §A3.

---

### T003 — §A4 bridge security-review coordination

**Status:** completed by Phase 1 coordination update; review owners TBD

Two separate §A4 review items are required:

| Review item | Scope | Timing | Owner |
|:--|:--|:--|:--|
| **§A4-A — `payments.*` + `tender.*` review** | Full security-review of `contracts/bridge-api.md` (DRAFT): handler signatures, `requireOperatorSession` gating, refusal envelopes, idempotency-key strategy, PII redaction, audit emission paths. | Must clear **before Slice 3 ships** (Slice 3 authors the bridge handlers). | review owner TBD before Slice 3 |
| **§A4-B — `vouchers.*` review** | Security-review of the `vouchers.*` namespace (Contract V-A): `vouchers.validate` / `vouchers.redeem` / `vouchers.reverse` bridge handlers, Data-Pulse-2 endpoint surface, non-sensitive redemption-intent token handling, online-only enforcement. | Must clear **before Slice 4 ships** (voucher work is entirely Slice 4). Separate from §A4-A because voucher work ships later and introduces Data-Pulse-2 dependency. | review owner TBD before Slice 4 |

---

### T004 — Slice 0 visual-direction reviewer assignment

**Status:** ✅ Resolved — T011 sign-off recorded 2026-05-20

Reviewer: **Ahmed**. T010 visual-direction document (PR #189) reviewed
and approved on 2026-05-20. T011 sign-off recorded in PR #190 and in
`specs/006-payments-tender/visual-direction/README.md` §"Review record".
§A1 gate is now cleared for Slice 1, Slice 2, and the documented Slice 4
force-fail visual variant.

---

### T005 — §A2 / Data-Pulse-2 voucher-endpoint coordination (Slice 4)

**Status:** completed by Phase 1 coordination update; Data-Pulse-2
endpoint contract pending Slice 4 coordination

Contract V-A (AD-7, OQ-PLAN-7) requires three Data-Pulse-2 endpoints
before Slice 4 may begin:

| Endpoint | Purpose |
|:--|:--|
| `POST /vouchers/validate` | Returns a short-lived, non-sensitive redemption-intent token bound to the payment attempt. |
| `POST /vouchers/redeem` | Atomically consumes the intent token; idempotent on retry within TTL. |
| `POST /vouchers/reverse` | Reverses a committed redemption (Slice 4 `vouchers.reverse` bridge handler). |

These endpoints belong to a **future, separately-spec'd Data-Pulse-2
integration**. They are not part of the current POS-Pulse OpenAPI
snapshot; no codegen runs until Slice 4. The `internal_voucher` tender
slot is **reserved-but-disabled** until the contract clears (plan §AD-7;
`tender_not_yet_supported` refusal).

**§A2 state:** No-op confirmed for Slices 1–3 (plan AD-8). §A2 must
commission for Slice 4 before any voucher bridge handler or codegen
lands. Data-Pulse-2 endpoint contract pending Slice 4 coordination.

**Data-Pulse-2 is NOT modified by this Phase 1 coordination PR.**

---

### T006 — Current gate / status record

**Status:** completed by Phase 1 coordination update

Gate status as of 2026-05-19 (Phase 1 coordination update):

| Milestone | Status |
|:--|:--|
| `/speckit-specify` | ✅ complete |
| `/speckit-clarify` | ✅ complete (2026-05-19) |
| `/speckit-plan` v1.0 | ✅ complete (2026-05-19; AD-1..AD-9 locked) |
| `/speckit-tasks` | ✅ complete (2026-05-19; ~140 tasks, Slices 0–5) |
| `/speckit-analyze` | ✅ complete (merged PR #187, 2026-05-19) |
| Phase 1 coordination update | ✅ complete (this PR; T001–T006 recorded) |
| Slice 0 commissioning | ✅ Complete — T011 signed off 2026-05-20 (PR #189 + PR #190) |
| Slice 1 implementation | ✅ §A1 cleared — may begin |
| Slice 2 implementation | ✅ §A1 cleared — may begin |
| Slice 3 implementation | ⛔ Held — gated on §A3 (migration approval) + §A4-A (bridge review) |
| Slice 4 implementation | ⛔ Held — gated on §A2 (voucher endpoint contract) + §A4-B (voucher bridge review) |
| Slice 5 (production readiness) | ⛔ Held — gated on §A5 |

**Phase 1 opens the path to Slice 0 commissioning only.** Slice 1
remains held until §A1 / Slice 0 sign-off. No implementation, source,
test, migration, bridge handler, codegen, or Data-Pulse-2 work is
authorised by Phase 1.

---

### T011 — §A1 visual-direction sign-off (Slice 0 PR 190)

**Status:** ✅ Complete — signed off 2026-05-20

**Session:** 2026-05-20 (PR #190 — docs/006-slice-0-signoff)

**Task:** T011 — Slice 0 review record signed; reviewer/date/result
recorded; §A1 sign-off recorded.

**Review record:**

| Field | Value |
|:--|:--|
| T010 source | PR #189 (merged 2026-05-20) — `specs/006-payments-tender/visual-direction/README.md` |
| T010 method | Manual Impeccable shape checklist (project-local Impeccable not installed; PRODUCT.md and DESIGN.md read directly; all design laws applied manually) |
| Reviewer | Ahmed |
| Review date | 2026-05-20 |
| Result | approved |
| Findings | none |

**§A1 scope cleared by this sign-off:**

- Slice 1 payment surfaces (tender selection, envelope ingest)
- Slice 2 per-tender entry surfaces (cash, external_card_terminal)
- The documented Slice 4 force-fail visual variant (State 11 in
  `visual-direction/README.md`)

**Gates remaining held (unchanged by this sign-off):**

| Gate | Status |
|:--|:--|
| §A2 (Data-Pulse-2 voucher endpoint contract) | ⛔ Held — commissions before Slice 4 |
| §A3 (migration approval — three new tables) | ⛔ Held — no-op confirmed for Slices 1–2; table review required for Slice 3 |
| §A4-A (`payments.*` + `tender.*` bridge review) | ⛔ Held — must clear before Slice 3 ships |
| §A4-B (`vouchers.*` bridge review) | ⛔ Held — must clear before Slice 4 ships |
| §A5 (production readiness) | ⛔ Held — rollout-time gate |

**What this sign-off does NOT do:**

- Does NOT start Slice 1 implementation (Slice 1 may now begin, but
  this PR contains no implementation).
- Does NOT open §A2, §A3, §A4, or §A5.
- Does NOT modify any source file, test, migration, package file,
  OpenAPI/codegen output, CI file, AGENTS.md, CLAUDE.md, .specify/**,
  .claude/**, .gitignore, or Data-Pulse-2.
- Does NOT create React components, CSS, tokens, bridge handlers, FSM
  code, migrations, voucher code, screenshots, or binary assets.

---

## Maestro closeout — Slice 1 (PR #192)

> Concise mirror of the PR #192 description (the canonical home of the
> full closeout). Records the durable facts only; the full diff,
> validation logs, and reviewer thread live on GitHub. Schema:
> [`../../docs/maestro/report-schema.md`](../../docs/maestro/report-schema.md).

### Identification

| Field | Value |
|:--|:--|
| Feature | `006-payments-tender` |
| Slice | Slice 1 — payments tender selection + envelope ingest |
| Branch | `feat/006-slice-1-payments-tender` |
| Head SHA | `c48c34b` |
| Merge commit | `7d8588c` on `main` |
| Merged at | 2026-05-21T09:07:15Z |
| Constitution version pinned | v1.5.1 |

### Gate verdict

| Gate | Status entering | Status leaving |
|:--|:--:|:--:|
| §A0 — Upstream readiness | ✅ | ✅ (unchanged) |
| §A1 — Visual direction Slice 0 | ✅ | ✅ (unchanged; cleared 2026-05-20 PR #189/#190) |
| §A2 — Backend / OpenAPI | ⛔ Held | ⛔ Held — Slice 1 was renderer-only; gate gates Slice 4 voucher endpoints |
| §A3 — Migrations | ⛔ Held | ⛔ Held — Slice 1 introduced no persistence; gate gates Slice 3 |
| §A4 — Bridge-API surface | ⛔ Held | ⛔ Held — Slice 1 introduced no bridge calls; gate gates Slice 3 + Slice 4 |
| §A5 — Production readiness | ⛔ Held (rollout-only) | ⛔ Held (rollout-only) |

No gate was opened or cleared by this slice.

### Tasks completed

T020 · T021 · T022 · T023 · T024 (tests, RED-then-GREEN per Constitution §VI)
T025 · T026 · T027 · T028 · T029 · T030 · T031 (implementation)
T032 · T033 · T034 (verification)

All 15 ticked in `tasks.md` with original task IDs, `[P]` markers, `[US?]` labels, descriptions, and file-path proposals preserved verbatim. Maestro task-marking §"What Maestro never changes" honoured.

### Files touched (per PR description)

**Created (10):** `src/renderer/stores/payment-store.ts`; `src/renderer/ui/payments/{PaymentSurface,TenderSelection,PaymentCartSummary}.tsx`; six test files under `tests/unit/renderer/payments/`.

**Modified (4):** `src/shared/app-config.ts` (added `payments?: boolean`); `src/renderer/stores/feature-flags-store.ts` (added `payments` flag, fail-closed default); `src/renderer/ui/cart/HandoffSummary.tsx` (added optional `onContinue` prop); `src/renderer/ui/cart/CartPane.tsx` (reads `paymentsFlag`, spreads `onContinue` into `HandoffSummary` callsites, calls `usePaymentStore.getState().mount(envelope)`).

**Confirmed untouched (forbidden scope walls held):** `src/main/**`; `src/preload/**`; `src/shared/bridge-api.ts`; `src/shared/payments/**`; `migrations/**`; OpenAPI / `src/shared/api-types.ts`; CI workflows; `package.json` / `package-lock.json`; `_reference/Data-Pulse/`; `AGENTS.md`; `CLAUDE.md`.

### Validation evidence (PR #192 head `c48c34b` + review-fix commit `c48c34b`)

| Check | Result |
|:--|:--:|
| `npm run typecheck` (both tsconfigs) | ✅ clean |
| `npx eslint --max-warnings=0` (changed files) | ✅ clean |
| `npx prettier --check` (changed files) | ✅ clean |
| `npx vitest run` (full) | ✅ 220 files / 2822 passed / 3 skipped / 0 fail |
| Coverage on new payment modules | ✅ 100 % statements / branches / functions / lines |

Manual smoke deferred to reviewer per PR test-plan checklist.

### Security / scope boundaries honoured

- **No sensitive IDs in renderer DOM** (`cart_id`, `operator_session_id`, `tenant_id`, `branch_id`, `terminal_id`, `handoff_action_id`, `item_ref`, `last_action_id`, `owning_operator_id`) — verified by `PaymentCartSummary.minimised-render.test.tsx` with sentinel IDs.
- **No card data** of any kind (PAN, CVV, track data, cardholder name) — none introduced.
- **No raw bridge `reason` strings** rendered to cashier.
- **No voucher authority data** — voucher slot reserved-disabled with `(not available)` hint per AD-7 (Contract V-A not yet shipped).
- **Feature-flag fail-closed** — `payments` defaults `false`; surface inert until hydrated.
- **44 × 44 CSS-px touch targets** on every interactive control (P14).
- **ARIA landmark + accessible labels** on tender buttons; voucher slot `aria-disabled="true"`.
- **Money** handled as integer minor units (Constitution §II).
- **No PII / cards in logs** (Constitution §VI, P6 / P7 / P11).

### Deferred / follow-up

- **Spec-Kit suggestion (next `/speckit-analyze`)** — T025 file-path proposal `src/renderer/config/feature-flags.ts` did not match the runtime layout. Slice 1 honoured the runtime reality and extended the existing `src/shared/app-config.ts` (`AppConfig.features.payments`) plus `src/renderer/stores/feature-flags-store.ts` (`FeatureFlagsState.payments`). No new `src/renderer/config/` directory created. Maestro task-marking §"Task descriptions and file-path proposals" applies: spec text untouched; mismatch flagged here for the next analyse cycle.
- **Spec-Kit suggestion (next `/speckit-analyze`)** — T031 file-path proposal `src/renderer/ui/cart/CartHandoffButton.tsx` did not match runtime (no such file). The Continue-to-payment affordance lives in `src/renderer/ui/cart/HandoffSummary.tsx` (footer button) and is gated from `src/renderer/ui/cart/CartPane.tsx`. Slice 1 added an optional `onContinue` prop to `HandoffSummary.tsx` (preserving the existing "disabled when no `onContinue`" assertion that 005's tests rely on) and spread it from `CartPane.tsx` when the `payments` flag is on. Wiring chain unchanged; spec text untouched.
- **CodeRabbit findings (resolved in PR #192 commit `c48c34b`)** — one actionable (`selectedTender` not reset across envelope / session context changes; fixed with a `useEffect` on `[sessionState.kind, envelope?.handoff_action_id]`) and three test-tightening nitpicks (exact currency-string assertions, `innerHTML`-not-`textContent` sentinel checks, explicit focus-on-cash-button assertion).
- **Slice 1 PR-branch CI lint flake (resolved on `main`)** — PR #192 PR-branch CI failed on pre-existing parse errors against `.claude/skills/impeccable/scripts/*.mjs` introduced by PR #191. Independently fixed by **PR #194** (`chore(ci): ignore .claude/** in ESLint and Prettier`, merge SHA on `main`).
- **`main` post-merge coverage regression (resolved)** — `main` CI tripped two coverage thresholds after the Slice 1 merge (`dev-skip-operator-signin.ts` functions 66.66 % < 80 %; `HandoffSummary.tsx` branches 87.5 % < 90 %). Independently fixed by **PR #195** (`test(coverage): cover default clock factory + onContinue branch`).

### Next step (single concrete action)

Open **Slice 2** preflight only when ready: §A1 visuals are already approved (covers Slices 1 and 2), but Slice 2 introduces money-math + per-tender entry controls (`CashEntry`, `ExternalCardTerminalEntry`) and the shared `computeChangeDueMinor` helper. **Do not start Slice 2 implementation in this slice's cycle.** A new Maestro Preflight (Template 1) should produce the worklist, dependency / file-conflict / parallel-safe graphs, and dispatch posture for T040–T051 before any code is written.

### Run notes

- Single-agent execution end-to-end (per `docs/maestro/agent-roles.md §Dispatch posture` default for ≤ 15-task renderer-only slices).
- No `[P]` downgrades fired — all six test files lived in different paths.
- One `needs-owner-approval` raised and cleared: T031 file-path mismatch (resolved by the owner with "modify `HandoffSummary.tsx` + `CartPane.tsx` minimally; preserve 005's existing disabled-button assertion").
- Zero `forbidden-scope` fires.
- Lint OOM did not occur on the slice's targeted lint; full-repo lint OOM was observed on a separate slice (see Slice-1 PR-branch CI flake above, addressed by PR #194).

---

## Maestro closeout — Slice 2 (PR #198)

> Concise mirror of the PR #198 description (the canonical home of the
> full closeout). Records the durable facts only; the full diff,
> validation logs, and CodeRabbit thread live on GitHub. Schema:
> [`../../docs/maestro/report-schema.md`](../../docs/maestro/report-schema.md).

### Identification

| Field | Value |
|:--|:--|
| Feature | `006-payments-tender` |
| Slice | Slice 2 — Per-tender entry surfaces (cash + external_card_terminal) |
| Branch | `feat/006-slice-2-payments-tender-entry` |
| Head SHA | `5c56b93` |
| Merge commit | `9bb2af3` on `main` |
| Merged at | 2026-05-21T12:59:38Z |
| Constitution version pinned | v1.5.1 |

### Gate verdict

| Gate | Status entering | Status leaving |
|:--|:--:|:--:|
| §A0 — Upstream readiness | ✅ | ✅ (unchanged) |
| §A1 — Visual direction Slice 0 | ✅ | ✅ (unchanged; cleared 2026-05-20 PR #189/#190 for Slice 1 + Slice 2 entry surfaces) |
| §A2 — Backend / OpenAPI | ⛔ Held | ⛔ Held — Slice 2 introduced no OpenAPI surface; gate gates Slice 4 voucher endpoints |
| §A3 — Migrations | ⛔ Held | ⛔ Held — Slice 2 introduced no persistence; gate gates Slice 3 |
| §A4 — Bridge-API surface | ⛔ Held | ⛔ Held — Slice 2 introduced no bridge calls; gate gates Slice 3 + Slice 4 |
| §A5 — Production readiness | ⛔ Held (rollout-only) | ⛔ Held (rollout-only) |

No gate was opened or cleared by this slice.

### Tasks completed

T040 · T041 · T042 · T043 · T044 · T045 (TDD test tasks, RED-then-GREEN per Constitution §VI)
T046 · T047 · T048 · T049 (implementation tasks)
T050 (coverage gate)
T051 (this closeout section + tasks.md state ticks)

All 12 ticked in `tasks.md` with original task IDs, `[P]` markers, `[US?]` labels, descriptions, and file-path proposals preserved verbatim. Maestro task-marking §"What Maestro never changes" honoured.

### Files touched (per PR description)

**Created (10):**

- `src/shared/payments/money-math.ts` — `computeChangeDueMinor` helper (FR-004 / FR-005 / Constitution §II).
- `src/shared/payments/external-reference-format.ts` — `validateExternalReference` regex helper (FR-009 / Constitution §P6).
- `src/renderer/ui/payments/CashEntry.tsx` — cash entry surface (visual-direction §State 2).
- `src/renderer/ui/payments/ExternalCardTerminalEntry.tsx` — record-only external-card-terminal entry surface (visual-direction §State 3).
- `tests/unit/main/payments/money-math.test.ts` (T040).
- `tests/unit/shared/payments/external-reference-format.test.ts` (T043).
- `tests/unit/renderer/payments/CashEntry.input-validation.test.tsx` (T041).
- `tests/unit/renderer/payments/CashEntry.under-tender-refusal.test.tsx` (T042).
- `tests/unit/renderer/payments/ExternalCardTerminalEntry.no-overpayment.test.tsx` (T044).
- `tests/unit/renderer/payments/ExternalCardTerminalEntry.reference-validation.test.tsx` (T045).

**Modified by the post-review CodeRabbit-fix commit (3):** `src/renderer/ui/payments/CashEntry.tsx` (added `isRemainingValid` gate to prevent render crash on negative `remainingBalanceMinor`); `tests/unit/renderer/payments/CashEntry.input-validation.test.tsx` (added 3 regression tests for the negative-remaining gate); `tests/unit/shared/payments/external-reference-format.test.ts` (replaced hardcoded PAN-like literals `4111111111111111` / `4111111111111` with runtime-generated `'0'.repeat(N)` to satisfy PII scanners).

**Confirmed untouched (forbidden scope walls held):** `src/main/**`; `src/preload/**`; `src/shared/bridge-api.ts`; `src/shared/api-types.ts`; `src/shared/payments/types.ts`, `src/shared/payments/fsm-types.ts` (Slice 3 scope); `src/renderer/stores/payment-store.ts`; `src/renderer/ui/payments/PaymentSurface.tsx`, `TenderSelection.tsx`, `PaymentCartSummary.tsx`; `migrations/**`; OpenAPI / codegen; CI workflows; `package.json` / `package-lock.json`; `_reference/Data-Pulse/`; `smart-data-pulse-2/**`; `AGENTS.md`; `CLAUDE.md`.

### Validation evidence (PR #198 final head `5c56b93`)

| Check | Result |
|:--|:--:|
| `npm run typecheck` (both tsconfigs) | ✅ clean |
| `npm run lint` (full repo `eslint .` + `prettier --check .`) | ✅ clean (no OOM fallback needed) |
| `npx vitest run` (full) | ✅ 226 files / 2916 passed / 3 skipped / 0 fail |
| `npm run codegen:verify` | ✅ `api-types.ts` up to date (no OpenAPI changes) |
| Targeted Slice 2 vitest + coverage | ✅ 92 passed |

Per-file coverage on Slice 2 surfaces (above all per-module thresholds):

| File | Stmt | Branch | Func | Line |
|:--|:--:|:--:|:--:|:--:|
| `src/shared/payments/money-math.ts` | 100 | 100 | 100 | 100 |
| `src/shared/payments/external-reference-format.ts` | 100 | 100 | 100 | 100 |
| `src/renderer/ui/payments/CashEntry.tsx` | 100 | 94.28 | 100 | 100 |
| `src/renderer/ui/payments/ExternalCardTerminalEntry.tsx` | 100 | 91.89 | 100 | 100 |

Manual smoke deferred to reviewer per PR test-plan checklist.

### Security / scope boundaries honoured

- **No card data of any kind** (PAN, CVV, track data, cardholder name, expiry, auth payload, terminal receipt text) — FR-007 / FR-008 / Constitution §P6. `<ExternalCardTerminalEntry>` has no card-data input fields; tests assert their absence.
- **`external_reference` regex `^[A-Z0-9]{0,6}$`** is the only path text can land — makes a PAN structurally unrepresentable (FR-009 / research §R-5).
- **No payment-gateway, processor, or terminal-SDK integration** — record-only by construction.
- **Generic refusal copy at the renderer** — the structured FR-006 names (`tender_underpaid`, `non_cash_overpayment_refused`, `invalid_input`) are explicitly asserted **absent** from `document.body.innerHTML` by dedicated tests.
- **Money handled as integer minor units** throughout (Constitution §II); `Number.isSafeInteger` guards on every input + the unsafe-integer rendering fallback to `—`.
- **Defensive validity gate on `remainingBalanceMinor`** (added post-CodeRabbit) — a negative safe-integer would have caused `computeChangeDueMinor` to throw during render; the gate keeps Confirm disabled and skips change-due display instead.
- **44 × 44 CSS-px touch targets** on every interactive control (P14).
- **`aria-live="polite"`** on refusal regions; `aria-disabled` mirrors `disabled` state.
- **No bridge calls, no main-process touch, no FSM, no audit emission** — those land in Slice 3 under §A3 + §A4-A.
- **No voucher work** — voucher slot remains Slice 1's reserved-disabled affordance (Contract V-A pending Slice 4 + §A2).
- **No new design tokens** introduced (007 Guard 1 token additivity).
- **No `.dark` block or `prefers-color-scheme: dark`** introduced (007 Guard 5 single-light-theme).
- **No PII / cards in logs** (Constitution §VI, P6 / P7 / P11) — Slice 2 introduces no logging at all; the only log surface in 006 is the audit-event store, which is Slice 3 territory.

### Deferred / follow-up

- **Spec-Kit suggestion (next `/speckit-analyze`)** — `tasks.md` T044 / T049 mandate an editable amount field on `<ExternalCardTerminalEntry>`; `visual-direction/README.md §State 3` shows no amount input (only the instructional copy + optional reference + confirm). Slice 2 followed `tasks.md` per Maestro source-of-truth order (`docs/maestro/README.md §"Source of truth"` places `tasks.md` above the visual direction). Same shape as Slice 1's T025 / T031 file-path divergences — recommend reconciling either `tasks.md` or §State 3 in the next analyze cycle.
- **`<CashEntry>` — visual State 2 "Amount input focused on mount":** the component renders but does not currently call `ref.focus()` on mount. Slice 1 already asserts focus-on-first-tender-button in `PaymentSurface.a11y.test.tsx`; no equivalent assertion exists for `<CashEntry>` mount-focus yet. Candidate for a Slice 5 production-readiness a11y sweep, not a Slice 2 regression.
- **CodeRabbit findings (resolved in PR #198 commit `5c56b93`)** — two 🟠 Major findings: (a) `<CashEntry>` could crash render if a future caller passed a negative `remainingBalanceMinor` (fixed with an explicit `isRemainingValid` gate + 3 regression tests); (b) hardcoded PAN-like literals in `external-reference-format.test.ts` tripped the `coderabbit.pii.credit-card-number` scanner (replaced with runtime-generated `'0'.repeat(N)` digit strings while preserving test intent).

### Next step (single concrete action)

Open **Slice 3** preflight only when ready. Slice 3 is **load-bearing**: it introduces the three new SQLite tables (§A3), the `payments.*` + `tender.*` bridge namespaces (§A4-A), the PaymentAttempt + TenderLine FSMs, idempotency replay, LIFO split-tender rollback, and the cash + external_card_terminal audit-event categories. Slice 3 requires §A3 (migration approval) and §A4-A (bridge security review) to clear before any handler code lands. **Do not start Slice 3 implementation in this slice's cycle.** A new Maestro Preflight (Template 1) should produce the worklist, dependency / file-conflict / parallel-safe graphs, agent dispatch posture, and §A3 + §A4-A coordination plan for T060–T164 before any code is written.

### Run notes

- Single-agent execution end-to-end (per `docs/maestro/graph-rules.md §"The small slice escape hatch"` default for ≤ 15-task renderer-only slices).
- No `[P]` downgrades fired — every implementation task created a new file (zero same-file risk).
- Zero `forbidden-scope` fires.
- Zero `needs-owner-approval` raised in the preflight; the visual-direction §State 3 vs `tasks.md` T044/T049 mismatch was flagged for `/speckit-analyze` and the implementation honoured the executable layer per Maestro source-of-truth order.
- One coverage-gate top-up cycle was required (initial branch-coverage 88–93 %); resolution removed redundant `handleConfirm` guards and an unreachable output guard in `computeChangeDueMinor`, then added targeted tests for the `formatMinorUnits` unsafe-integer branch + `onBack` rendering. Final per-file coverage clears every threshold with margin.
- Lint OOM did not fire — `npm run lint` ran clean on the full repo.
- Impeccable: manual shape checklist invoked (no project-local `/impeccable` slash-command), same posture as Slice 0 T010 and Slice 1.

---

## Slice 3 owner decisions — Session 2026-05-21

The Slice 3 Maestro preflight (run 2026-05-21) returned **STOP for
implementation**. Slice 3 is blocked on two uncleared gates (§A3
migration approval, §A4-A bridge security review) and surfaced two
open coordination questions (migration-file naming convention, slice
scope breadth). This section transcribes the owner verdicts on those
four points. It does **not** constitute a preflight report, does not
modify `tasks.md`, and does not authorize Slice 3 implementation.

### Decision 1 — Migration naming convention

Migration files MUST use **bare numeric names continuing the existing
sequence** (e.g., `0012_create_payment_attempts.sql`, `0013_*`, `0014_*`).
The feature-prefixed `006-0001_*` names proposed in `tasks.md` are
advisory per Maestro task-marking conventions; the runtime migration
runner's lexical sort ordering is the authoritative constraint, and
that constraint requires the bare numeric sequence. The mismatch
between `tasks.md` proposals and the runtime convention becomes a
`/speckit-analyze` follow-up item — same pattern as the Slice 1
T025/T031 and Slice 2 T044/T049 file-path divergences.

### Decision 2 — Slice 3 scope: split into four sub-slices

Slice 3 is split into four sequential sub-slices to reduce the blast
radius of each implementation cycle and align gate clearing with
deliverable boundaries:

| Sub-slice | Scope | Task range |
|:--:|:--|:--|
| **S3a** | §A3 migrations + persistence repositories | T060–T067, T110–T113 |
| **S3b** | Shared types + PaymentAttempt FSM + TenderLine FSM + audit emitter + idempotency helper | T070–T094, T120–T121, T130–T132 |
| **S3c** | `payments.*` + `tender.*` bridge handlers + preload registration | T100–T106 GREEN, T133–T142 |
| **S3d** | Renderer wiring + final Slice 3 verification | T150–T164 |

Sub-slices are sequential: S3b gates on S3a; S3c gates on S3b; S3d
gates on S3c. The gate order (§A3 → §A4-A) is unchanged.

### Decision 3 — §A3 and §A4-A remain held

Both gates remain **⛔ Held**. Neither is cleared by this session.
Each gate clears only when a commissioned reviewer records their
name and sign-off date in this file's gate ledger. Until that
record exists in writing, no S3a migration SQL and no S3c bridge
handler code may be authored.

### Decision 4 — This update is documentation only

This update:

- Does NOT modify `tasks.md` (task rows, IDs, descriptions, or
  file-path proposals are untouched; the sub-slice naming above is
  a coordination record, not a tasks revision).
- Does NOT authorize Slice 3 implementation of any kind.
- Does NOT clear §A3 or §A4-A.
- Does NOT modify the Slice 1 Maestro closeout (PR #192) or the
  Slice 2 Maestro closeout (PR #198).
- Does NOT modify any source file, test, migration, package file,
  bridge-API surface, OpenAPI/codegen output, CI workflow, AGENTS.md,
  CLAUDE.md, or Data-Pulse-2.

### Next step

When §A3 and §A4-A have each been signed off by their commissioned
reviewers (reviewer name + date recorded in the gate ledger above),
**S3a may begin** — Maestro Preflight (Template 1) for S3a should
be the first action in that session.

---

### Reviewer commissioning — 2026-05-21

**Date:** 2026-05-21. **Update type:** docs-only. Does not start Slice
3; does not clear any gate.

| Gate | Reviewer commissioned | Commissioned date | Gate status |
|:--:|:--|:--|:--:|
| **§A3** — migration approval (three new tables) | Ahmed | 2026-05-21 | ⛔ Held — review commissioned, sign-off pending |
| **§A4-A** — `payments.*` + `tender.*` bridge security review | Ahmed | 2026-05-21 | ⛔ Held — review commissioned, sign-off pending |

**Commissioning is not clearance.** Each gate clears only when the
reviewer records their explicit sign-off (reviewer name + date) in the
gate ledger row above. Until that record exists, no S3a migration SQL
and no S3c bridge handler code may be authored. **S3a is NOT
authorized.**

The Slice 3 Maestro execution ledger (PR #202) carries `gates.§A3.reviewer`
and `gates.§A4-A.reviewer` fields; those fields will be updated from
`TBD` to `Ahmed` in a follow-up ledger update. That ledger update is a
separate task and does NOT happen here.

---

### Sign-off — 2026-05-21

**Date:** 2026-05-21. **Update type:** docs-only. Does not start Slice
3 implementation; records explicit gate clearance only.

#### §A3 — Migration approval

| Field | Value |
|:--|:--|
| Reviewer | Ahmed |
| Sign-off date | 2026-05-21 |
| Result | Approved — no changes requested |
| Scope reviewed | `specs/006-payments-tender/data-model.md` — three new SQLite tables (`payment_attempts`, `payment_tender_lines`, `payment_action_outbox`) + partial unique index on `payment_attempts(terminal_id) WHERE state='started'` + CHECK constraints + FK relationships + append-only trigger on `payment_action_outbox` + extension of 004's `audit_events.action_category` enum with 7 new categories (4 attempt-level: `payment.settled`, `payment.cancelled`, `payment.failed`, `payment.force_failed`; 3 per-line: `tender.applied`, `tender.refused`, `tender.reversed`). Note: `tender.reversal_pending` is deferred to Slice 4. |
| Migration naming | Bare numeric names continuing the existing migration sequence (owner decision PR #200, binding for S3a). |
| Gate status | ✅ Cleared — S3a is now authorized |

#### §A4-A — Bridge-API security review (`payments.*` + `tender.*`)

| Field | Value |
|:--|:--|
| Reviewer | Ahmed |
| Sign-off date | 2026-05-21 |
| Result | Approved — no changes requested |
| Scope reviewed | `specs/006-payments-tender/contracts/bridge-api.md` DRAFT — 11 handlers across `payments.*` (`payments.start`, `payments.confirm`, `payments.cancel`, `payments.subscribe`, `payments.read`, `payments.discardOnSessionEnd`) and `tender.*` (`tender.apply`, `tender.reverse`, `tender.read`) namespaces; `requireOperatorSession` gating on all handlers; UUID v4 idempotency keys; refusal envelope `{ kind: 'refused', reason: '...' }`; FR-013/FR-014 Clerk-backed attribution enforcement; PII / card-data / voucher-token redaction. |
| Out of scope | Slice 4 voucher handlers (`vouchers.validate`, `vouchers.redeem`, `vouchers.reverse`) and `payments.forceFail` — those require separate §A4-B review before Slice 4 ships. |
| Gate status | ✅ Cleared — S3c bridge handlers are now authorized |

#### Authorization status

**S3a (§A3 migrations + persistence repositories, T060–T067 + T110–T113) is AUTHORIZED.**
The next Maestro implementation prompt is "Implement S3a" using
`docs/maestro/quick-prompts.md` "Execute approved slice".

#### Sequential chain after S3a

| Sub-slice | Starts when… |
|:--:|:--|
| **S3a** | Now authorized (§A3 cleared) |
| **S3b** | S3a is GREEN |
| **S3c** | S3b is GREEN |
| **S3d** | S3c is GREEN (§A1 already cleared 2026-05-20) |

---

## Maestro closeout — S3a (PR #207)

> Concise mirror of the PR #207 description (the canonical home of the
> full closeout). Records the durable facts only; the full diff,
> validation logs, and CodeRabbit thread live on GitHub. Schema:
> [`../../docs/maestro/report-schema.md`](../../docs/maestro/report-schema.md).

### Identification

| Field | Value |
|:--|:--|
| Feature | `006-payments-tender` |
| Sub-slice | S3a — Migrations + persistence repositories |
| Branch | `feat/006-s3a-payments-persistence` |
| Head SHA | `e3784c1` |
| Merge commit | `e8b33d5` on `main` |
| Merged at | 2026-05-22T14:07:11Z |
| Constitution version pinned | v1.5.1 |

### Gate verdict

| Gate | Status entering | Status leaving |
|:--|:--:|:--:|
| §A0 — Upstream readiness | ✅ | ✅ (unchanged) |
| §A1 — Visual direction Slice 0 | ✅ | ✅ (unchanged) |
| §A2 — Backend / OpenAPI | no-op (Slices 1–3) | no-op (unchanged; gates Slice 4 voucher endpoints only) |
| §A3 — Migrations | ✅ (signed off 2026-05-21) | ✅ (S3a delivered the migrations under §A3 authorization) |
| §A4-A — Bridge-API security review (`payments.*` + `tender.*`) | ✅ (signed off 2026-05-21) | ✅ (unchanged; gates S3b/S3c, not S3a) |
| §A4-B — Bridge-API review (`vouchers.*`, Slice 4) | ⛔ Held | ⛔ Held (unchanged) |
| §A5 — Production readiness | ⛔ Held (rollout-only) | ⛔ Held (rollout-only) |

No gate was opened or cleared by this sub-slice. S3a operated entirely under the §A3 clearance recorded 2026-05-21.

### Tasks completed

T060 · T061 · T062 · T063 · T064 · T065 (§A3 migrations, six bare-numeric files `0012`–`0017`)
T066 (integration test — 39 cases: schema, CHECK, FK, partial unique, append-only, audit categories)
T067 (§A3 sign-off — the durable record itself was already on `main` in §"Sign-off — 2026-05-21"; this closeout finalises the per-row `[x]` tick)
T110 (migration runner registration — zero code change; `src/main/db/migrate.ts:readMigrationsFromDisk` reads `migrations/*.sql` lexically)
T111 · T112 · T113 (three [P]-marked repositories under `src/main/payments/repositories/`)

All 12 ticked in `tasks.md` with original task IDs, `[P]` markers, `[US?]` / `[§A3]` labels, descriptions, and advisory file-path proposals preserved verbatim. The migration filenames on disk follow the bare-numeric sequence per owner decision PR #200 (Finding F-001 in `maestro/execution-map.yaml`); the `tasks.md` `006-*` proposals are advisory and unchanged. Maestro task-marking §"What Maestro never changes" honoured.

### Files touched (per PR description; 13 files, +2 176 lines)

**New SQL migrations (6) — bare-numeric sequence (PR #200 owner decision):**

- `migrations/0012_create_payment_attempts.sql`
- `migrations/0013_payment_attempts_partial_unique_started.sql`
- `migrations/0014_create_payment_tender_lines.sql`
- `migrations/0015_create_payment_action_outbox.sql`
- `migrations/0016_payment_action_outbox_append_only_trigger.sql`
- `migrations/0017_extend_audit_event_categories.sql`

**New TypeScript repositories (3):**

- `src/main/payments/repositories/payment-attempts.repository.ts` — `insert` · `updateState` (discriminated-union typed per state) · `findById` · `findStartedByTerminal`
- `src/main/payments/repositories/payment-tender-lines.repository.ts` — `insert` · `updateState` · `findByAttempt` · `settlementSumMinor` (canonical invariant SQL from data-model §"Invariant 5")
- `src/main/payments/repositories/payment-action-outbox.repository.ts` — `insert` · `findByActionId` + `computeActionPayloadHash` (deterministic SHA-256 over sorted-key canonical JSON; redaction is the bridge layer responsibility — research §R-10)

**New tests (4):**

- `tests/integration/payments/migrations.test.ts` (39 cases)
- `tests/unit/main/payments/repositories/payment-attempts.repository.test.ts` (11 cases)
- `tests/unit/main/payments/repositories/payment-tender-lines.repository.test.ts` (15 cases)
- `tests/unit/main/payments/repositories/payment-action-outbox.repository.test.ts` (7 cases)

**Confirmed untouched (forbidden scope walls held):** S3b shared types / FSMs / audit emitter / idempotency helper (T070–T094, T120–T132); S3c bridge handlers + preload registration (T100–T106, T133–T142); S3d renderer wiring + final verification (T150–T164); `src/main/**` outside `src/main/payments/repositories/`; `src/main/index.ts` wiring (lands in S3c); `src/preload/**`; `src/shared/bridge-api.ts`; `src/shared/api-types.ts`; `src/renderer/**`; OpenAPI / codegen; CI workflows; `package.json` / `package-lock.json`; `_reference/Data-Pulse/`; `smart-data-pulse-2/**`; `AGENTS.md`; `CLAUDE.md`. No `tasks.md` / `coordination.md` / `docs/maestro/**` edits in the PR itself — those are this closeout's job.

### Migrations delivered (per PR body)

1. `payment_attempts` — five-state FSM column + 14-value `failure_reason` CHECK + 2 indexes (header in `0012`).
2. Partial unique `payment_attempts_one_started_per_terminal` on `(terminal_id) WHERE state='started'` (research §R-6; prevents two concurrent attempts on the same drawer) — `0013`.
3. `payment_tender_lines` — FK → `payment_attempts`; CHECKs enforcing per-type field presence (cash-only `change_due_minor`, external_card_terminal-only `external_reference` with regex `^[A-Z0-9]{0,6}$` making a PAN structurally unrepresentable, voucher-only `voucher_*` fields); 3 indexes including a filtered index on `reversal_pending` for the Slice 4 deferred resolver — `0014`.
4. `payment_action_outbox` — FK → both new tables; unique `action_id` for idempotency lookup; SHA-256 `action_payload_hash` CHECK on length=64; 2 indexes — `0015`.
5. Append-only triggers (UPDATE+DELETE RAISE) on `payment_action_outbox` (Constitution §P4) — `0016`.
6. Audit-category documentation marker for the 7 categories cleared by §A3 (4 attempt-level: `payment.settled`, `payment.cancelled`, `payment.failed`, `payment.force_failed`; 3 per-line: `tender.applied`, `tender.refused`, `tender.reversed`; `tender.reversal_pending` deferred to Slice 4). Documentation-only — 0004 already used open-set `TEXT NOT NULL` for `action_category` — `0017`.

### Validation evidence (PR #207 final head `e3784c1`)

| Check | Result |
|:--|:--:|
| `npm run typecheck` (both tsconfigs) | ✅ clean |
| `npm run lint` (`eslint .` + `prettier --check .`) | ✅ clean on S3a surface; 3 pre-existing prettier warnings on `.github/workflows/clean-caches.yml`, `docs/maestro/slice-schema.yaml`, `docs/maestro/templates/execution-map.yaml` reproduced identically on `main` (subsequently unblocked by PR #208 on 2026-05-22) |
| `npx vitest run` (full) | ✅ 230 files / 2 984 passed / 3 skipped / 0 fail |
| `npm run codegen:verify` | ✅ `api-types.ts` up to date (no OpenAPI changes) |
| Targeted S3a coverage (`src/main/payments/repositories/**`) | ✅ 98.38 % statements / 92.85 % branches / 100 % functions / 100 % lines — clears the 80 % global floor with margin |

**Coverage note:** the per-file branch floors come from `vitest.config.ts` global thresholds (80 %); the S3a surface clears them. The Slice 3 final coverage gate (T160; ≥ 95 % on FSMs + audit-emitter + idempotency + bridge handlers; ≥ 90 % on renderer wiring) is a Slice 3d concern, not S3a.

**Known flake (pre-existing, not S3a-related):** running `npm test -- --coverage` (full suite + coverage) flakes occasionally on `scripts/__tests__/codegen.test.ts` with two 5 s-timeout failures due to coverage-instrumentation overhead on child-process IO. Running the file in isolation passes 8/8; running `npx vitest run` without coverage on the whole suite passes 2 984/2 984. The flake reproduces on `main` HEAD before the PR.

### CodeRabbit findings — resolved

- **Round 1 findings 1–5** — addressed in commit `7964e40` ("tighten 006 s3a sql invariants"). SQL-invariant tightening across the four migration files.
- **Round 2 findings 6, 9 + docstrings 8/10** — addressed in commit `f582824` ("harden 006 s3a repo edges"). Repository edge-case hardening + improved docstrings on the three new repositories.
- **Round 2 test-intent sharpening** — addressed in commit `e3784c1` ("sharpen 006 s3a migration test intent"). Test assertion intent clarified in the migrations integration test.

All raised findings on PR #207 are resolved at merge.

### Security / scope boundaries honoured

- **No card data of any kind** at the persistence layer — the `external_reference` CHECK regex `^[A-Z0-9]{0,6}$` (FR-009 / research §R-5) makes a PAN structurally unrepresentable; `payment_tender_lines` has no PAN / CVV / track / expiry / cardholder-name column.
- **No PII in logs** (Constitution §P6 / §P7 / §P11) — S3a introduces no logging; `payment_action_outbox` stores only a SHA-256 `action_payload_hash` (length=64 CHECK). Redaction of the canonical payload is the bridge layer's responsibility (S3c), not S3a's.
- **Money handled as integer minor units** throughout (Constitution §II); `amount_minor` and related columns are typed accordingly; settlement invariant SQL uses integer arithmetic only.
- **Append-only enforcement at the DB layer** (Constitution §P4 / §P16) — UPDATE and DELETE on `payment_action_outbox` raise via SQLite triggers (`0016`); no application-layer bypass possible.
- **Partial unique index** prevents two `state='started'` rows per `terminal_id` (research §R-6) — drawer-level concurrency invariant enforced at the DB layer.
- **No bridge calls, no IPC, no FSM rules, no idempotency logic, no audit emission** in S3a — those belong to S3b (FSMs + helpers) and S3c (bridge handlers).
- **No `_reference/Data-Pulse/` content reused** (Constitution Principle IX) — schema re-derived from `data-model.md`.

### Scope exclusions (forbidden walls held)

- **No S3b work** — T070–T094, T120–T132 not started (shared types, PaymentAttempt FSM, TenderLine FSM, `requireOperatorSession` wrapper, idempotency-replay helper, audit emitter).
- **No S3c work** — T100–T106, T133–T142 not started (bridge handlers, preload registration).
- **No S3d work** — T150–T164 not started (renderer wiring, final verification + sign-off).
- **No Slice 4 work** — T200+ not started (voucher / force-fail / Contract V-A).
- **No OpenAPI / codegen changes** — `api-types.ts` untouched; `codegen:verify` clean.
- **No `package.json` / `package-lock.json` changes.**
- **No CI workflow changes** — `.github/workflows/` untouched.
- **No `src/main/index.ts` wiring** — repositories are file-only until S3c bridge handlers register them.
- **No `_reference/Data-Pulse/` touches; no `smart-data-pulse-2/**` touches.**
- **No `git add -A` / `git add .`** — every staged file was on the S3a allow-list.

### Deferred / follow-up

- **Migration-naming divergence (F-001)** — `tasks.md` T060–T065 propose `006-*`-prefixed migration filenames; on-disk reality follows bare-numeric `0012`–`0017` per owner decision PR #200. Recorded as `findings.F-001` in `specs/006-payments-tender/maestro/execution-map.yaml`. Recommend the next `/speckit-analyze` cycle reconcile `tasks.md` to match the bare-numeric reality (or formally record the divergence as accepted).
- **`tender.reversal_pending` audit category** — deferred from `0017` to Slice 4 (voucher reversal is a Slice 4 concern; S3a's filtered index on `reversal_pending` is in place ready for it).

### Next step (single concrete action)

Run a **fresh Maestro preflight for S3b** (Template 1). S3b is the next-candidate sub-slice: shared types (`src/shared/payments/types.ts`, `src/shared/payments/fsm-types.ts`, `src/shared/bridge-api.ts` extensions), PaymentAttempt FSM, TenderLine FSM, `requireOperatorSession` wrapper, idempotency-replay helper, audit emitter (T070–T094 tests + T120–T132 impl). S3b's gates (§A4-A and §A3) are already cleared; the only remaining precondition was S3a-GREEN, satisfied by this merge. **Do not start S3b implementation without the preflight.** S3c and S3d remain BLOCKED on S3b-GREEN and S3c-GREEN respectively; Slice 4 gates remain held.

### Run notes

- Single-agent execution end-to-end (process-boundary rule — migrations cross schema/repository boundary; per `docs/maestro/graph-rules.md`).
- No `[P]` downgrades fired — T062, T063, T065, T111, T112, T113 stayed parallel-safe by file (executed in their tasks.md sequence by the single agent).
- Zero `forbidden-scope` fires.
- Zero `needs-owner-approval` raised during execution; the migration-naming divergence (F-001) was a preflight-time finding and the owner decision (PR #200) carried into execution unchanged.
- Two CodeRabbit review rounds + a third sharpening pass were absorbed pre-merge (commits `7964e40`, `f582824`, `e3784c1`); all raised findings resolved.

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
