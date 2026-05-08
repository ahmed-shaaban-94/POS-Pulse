# Coordination — 005-sales-cart

**Feature:** 005-sales-cart
**Plan:** [./plan.md](./plan.md) (DRAFT scaffold)
**Spec:** [./spec.md](./spec.md) (DRAFT)
**Tasks:** [./tasks.md](./tasks.md) (DRAFT — all unchecked, all `[BLOCKED: §A0]`)
**Created:** 2026-05-09
**Last updated:** 2026-05-09

---

> # 🚧 DRAFT — BLOCKED
>
> Every coordination item below is conditional on **004 S4 closeout AND
> 004 S5 visibility-boundary approval**. Do **NOT** begin any
> implementation work. This file is a coordination scaffold, not an
> executable plan.

---

## Purpose

Track 005-sales-cart coordination state from spec-draft phase through
to `/speckit-tasks` readiness. Currently in spec-draft phase; the
readiness gate (§A0) holds the entire feature. This file is the
durable coordination record: returning agents and humans should read
it (and `plan.md`) first to know "where are we?".

This file is **not** a tasks file. It does not authorize
implementation. It is the canonical record of "who owns what before
`/speckit-clarify` and `/speckit-plan` may be invoked", and it is
updated in place as coordination items resolve.

---

## Current phase / status

- **Phase:** **Spec-draft only.** No `/speckit-clarify` yet, no
  `/speckit-plan` executed (the `plan.md` is a draft scaffold, not an
  approved plan), no `/speckit-tasks` invoked. Slice 0 (visual
  direction) not begun.
- **Spec-phase artifacts present:**
  - `spec.md` — DRAFT, contains open `[NEEDS CLARIFICATION]` items.
  - `plan.md` — DRAFT scaffold only.
  - `tasks.md` — DRAFT scaffold; every task unchecked and tagged
    `[BLOCKED: §A0]`.
  - `coordination.md` — this file.
- **`.specify/feature.json`:** remains pointed at
  `specs/004-operator-session` until 004 closes. When 004 closes, the
  project owner decides whether to point at 005 or another feature.
- **Implementation slices S0–S5:** all ⏳ blocked. **No work has
  begun and no work may begin until §A0 lifts.**

---

## Dependencies on 004-operator-session

005-sales-cart consumes the following 004 deliverables. Each bullet
links the relevant 004 task ID range where applicable.

- **Operator session, role catalogue, and audit-attribution
  scaffold** — delivered by 004 S4 closeout (004 tasks T052–T082).
  005 reads the active operator session for cart ownership and audit
  attribution; cart action records carry the operator's
  Clerk-backed identity, not any local-only PIN factor.
- **Visibility boundaries (cashier vs manager/admin)** — delivered
  by 004 S5 closeout (004 tasks T083–T093). 005's cart-level
  sensitive actions (void, discount-above-threshold,
  remove-line-after-handoff-attempt) inherit and extend these
  visibility rules; the cart pane's role-conditional UI must match
  the canonical role-visibility-matrix in 004.
- **Audit-event emitter and `audit_events` table** — delivered by
  004 S3 (POS-Pulse PR #49, SHA `e50f5b8`). 005 emits new cart
  action categories through the same emitter; no new audit table.
- **`requireRole` primary trust gate** — delivered as part of 004's
  bridge / preload security work (004 S2). 005 reuses
  `requireRole` for every cart-level role-restricted action; the UI
  is a soft enforcement only.
- **003 design tokens / cart-pane reserved slot** — delivered by
  003 (POS UI shell). 005 S0 (visual direction) and S5 (final
  polish) render the cart pane against these tokens; no token
  forks.
- **001 secrets module / Electron security boundaries** —
  delivered by 001 (foundation). 005's cart bridge is a typed
  preload addition; no upward-of-bridge IPC, `contextIsolation`
  remains true, sandbox remains true.

---

## Required coordination actions before `/speckit-clarify` (and after § A0)

These items MUST resolve before 005 work may proceed. They are
listed in dependency order; some may be worked in parallel once
§A0 lifts.

### 1. 004 S4 closeout

- **Status:** ⏳ **BLOCKED.**
- **Owner:** Ahmed.
- **Required action:** Confirm the 004 S4 closeout PR (issue #87)
  merges with all S4 tasks (T052–T082) ticked and 004's
  coordination file marks S4 ✅.
- **Unblocks:** §A0 (partial — half).

### 2. 004 S5 review

- **Status:** ⏳ **BLOCKED.**
- **Owner:** Ahmed.
- **Required action:** 004 S5 forced-close + visibility-boundary PR
  (004 tasks T083–T093) merges, the role-visibility-matrix is
  finalised, and 004's coordination file marks S5 ✅.
- **Unblocks:** §A0 (the other half).

### 3. §A0 sign-off

- **Status:** ⏳ **BLOCKED.**
- **Owner:** Ahmed (or constitution maintainer).
- **Required action:** Confirm 004 S4 + S5 are approved AND that the
  cart-side visibility additions in 004's role-visibility-matrix
  are accepted (the rows that 005 will inherit and extend).
- **Unblocks:** `/speckit-clarify` on 005 may run; 005 S0 (visual
  direction) may begin.

### 4. §A1 backend coordination

- **Status:** ⏳ **deferred.** Activates only once §A0 clears.
- **Owners:** Ahmed (POS-Pulse) + future payments-feature backend
  counterpart.
- **Required action:** Identify the SmartDataPulse backend
  interfaces 005 will need (item catalogue, item-ref resolution).
  Document in `coordination/a1-backend-handoff.md` (future file).
- **Important note:** Cart drafts themselves DO NOT introduce new
  backend endpoints. Drafts are local-only (`carts`, `cart_lines`,
  `cart_action_outbox` are local SQLite tables). The §A1 backend
  dependency is for **item-ref resolution only** (to validate the
  `item_ref` on each cart line against the canonical catalogue).
  This dependency MAY be deferred to a future item-catalogue
  feature; if so, 005 ships with a stubbed item-ref resolver and
  §A1 closes against that stub.
- **Unblocks:** S2 (item-ref resolution path), if/when the backend
  catalogue is needed.

### 5. §A2 migrations

- **Status:** ⏳ **later.** Activates after data-model.md is
  drafted in Phase 1.
- **Owner:** Ahmed.
- **Required action:** Author migrations for `carts`, `cart_lines`,
  and `cart_action_outbox`. Review against Constitution P4
  ("append-only audit"): **no append-only constraints needed at
  the cart layer — these tables ARE mutable.** Rationale: cart
  lifecycle includes update, line-edit, line-removal, void, and
  hand-off. Rationale must be documented in the migration commit
  message and in `data-model.md`.
- **Unblocks:** S2 (cart-line CRUD), S3 (cart-level sensitive
  actions auditing).

### 6. §A3 audit-event catalogue extension

- **Status:** ⏳ **coordinated with 004 S5.**
- **Owner:** Ahmed.
- **Required action:** Extend 004's `ActionCategory`
  discriminated union (`src/shared/audit/event-shape.ts`) to
  recognise the following new categories:
  - `cart.void`
  - `cart.discount_applied_above_threshold`
  - `cart.line.removed_after_handoff_attempted`

  Coordinate with 004 S5's close-out PR so the catalogue extension
  lands cleanly (either in 004 S5's PR if S5 author is amenable,
  or as a tightly-scoped follow-up immediately after S5 merges).
  005 S3 will not begin until this extension is in `main`.
- **Unblocks:** S3 (cart-level sensitive actions emit audit
  events).

### 7. §A4 handoff-envelope ratification

- **Status:** ⏳ **later.**
- **Owners:** Ahmed (POS-Pulse) + future payments-feature owner.
- **Required action:** Produce `contracts/handoff-envelope.md`
  describing the shape of the cart→payments handoff envelope.
  Review with the future payments-feature owner; both sides sign
  off before 005 S4 (handoff-envelope + freeze rule) merges.
- **Backwards-compatibility commitment (P12 / P16):** the future
  payments feature MAY add fields to the envelope but MUST NOT
  remove any field that 005 S4 ratifies. This is an explicit
  cross-feature contract — once a field ships in the envelope, it
  is durable.
- **Unblocks:** S4 (handoff envelope + freeze rule).

### 8. Slice 0 visual-direction reviewer

- **Status:** ⏳ **TBD** (assigned at S0 kickoff, after §A0 lifts).
- **Owner:** TBD.
- **Required action:** Review S0 contact sheet against:
  1. 003 design tokens (no fork; existing token set only).
  2. The cart-pane row of 004 S5's finalised
     role-visibility-matrix (cashier vs manager/admin visibility
     of cart-level controls).
- **Unblocks:** S1 (cart bridge + role gating), per FR-033 (visual
  direction must precede shippable UI work).

### 9. §A5 production-readiness reviewer

- **Status:** ⏳ **rollout-time.**
- **Owner:** TBD (assigned at production-rollout PR open time).
- **Required action:** Sign off on the full production-rollout PR
  for 005 (feature-flag flip, customer-facing readiness check).
- **Unblocks:** Production rollout. Does NOT block individual S0–S5
  merges to `main` behind a feature flag.

---

## Gate owner table

| Gate | Status | Owner | Resolution-path note |
|:--|:--:|:--|:--|
| §A0 — 005-blocking gate (LOAD-BEARING) | ⏳ **BLOCKED** | **Ahmed** | Holds on 004 S4 closeout AND 004 S5 visibility boundaries. Must clear before any 005 work begins, including `/speckit-clarify`. |
| §A1 — cart-related backend / OpenAPI dependencies | ⏳ deferred | **Ahmed** + future-feature owner | Item-ref resolution only; cart drafts add NO new backend endpoints. May ship with stubbed resolver if catalogue feature is later. |
| §A2 — migrations (`carts`, `cart_lines`, `cart_action_outbox`) | ⏳ later | **Ahmed** | After `data-model.md` exists. P4 review: cart tables are intentionally mutable; rationale documented. |
| §A3 — 004 audit-event catalogue extension | ⏳ coordinated with 004 S5 | **Ahmed** | `ActionCategory` union extended with three new cart categories. Lands cleanly with or immediately after 004 S5. |
| §A4 — handoff-envelope shape | ⏳ later | **Ahmed** + future payments owner | Cross-feature contract. Forward-compatible additions only; no field removals. |
| §A5 — production-readiness rollout gate | ⏳ rollout-time | **TBD** | Production gate only. Does not block slice merges behind a feature flag. |

---

## Gate unblock table

| Gate clears | Slices that become eligible to schedule |
|:--|:--|
| §A0 | `/speckit-clarify` on 005 may run; S0 (visual direction) may begin |
| §A0 + S0 review | S1 (cart bridge + role gating) may begin |
| §A0 + §A2 | S2 (cart-line CRUD + idempotency outbox) may begin |
| §A0 + §A3 | S3 (cart-level sensitive actions into 004 audit emitter) may begin |
| §A0 + §A4 | S4 (handoff envelope + freeze rule) may begin |
| §A0 + §A1 (if needed) + S2 + S3 + S4 merged | S5 (final polish + cart pane visual) may begin; production rollout may proceed pending §A5 |

**Bottom line:** §A0 is the single load-bearing gate. Until 004 S4
closeout AND 004 S5 visibility-boundary review are both ✅ in 004's
coordination file, **no 005 coordination action above row 3 may
even begin**, and `/speckit-clarify` on 005 must not run.

---

## Required approvals (summary callout)

Implementation MUST NOT begin until **all** of the following are
true:

1. 004 S4 closeout PR is merged.
2. 004 S5 visibility-boundaries PR is merged.
3. §A0 sign-off is recorded by the maintainer in this file.
4. `/speckit-clarify` resolves the open `[NEEDS CLARIFICATION]`
   items in `spec.md` (see Open questions below).

The current document is a **planning scaffold only**. It does not
authorize any code changes, migrations, package edits, or backend
work.

---

## Open questions (cross-doc)

These are the cross-document open questions that `/speckit-clarify`
must resolve (or that must be locked before `/speckit-plan`).
They appear in `spec.md` as `[NEEDS CLARIFICATION]` markers and
are mirrored here for coordination visibility.

- **Item-note maximum length** — 200 char placeholder; pharmacy
  operations input needed for the final value.
- **Discount-attribution threshold** — monetary vs percentage, and
  the manager-attribution policy for discounts above the
  threshold (who is recorded as the approving manager when a
  cashier applies a discount above threshold).
- **Cart-stale policy on operator-session-end** — discard vs hold
  vs manager-recovery. Interacts with 004 S5 forced-close
  semantics.
- **Line-merge-by-`item_ref` vs separate-line policy** — when the
  same `item_ref` is added twice, do lines merge with quantity
  increment, or are they kept separate (with per-line notes)?
- **Optimistic-concurrency token format** — opaque ULID, monotonic
  integer, or content hash; affects cart-line CRUD shape.
- **Idempotency-key persistence shape** — exact column set and
  retention window for `cart_action_outbox`; interacts with §A2
  migration design.
- **Handoff-envelope versioning policy** — forward-compatible
  additions only (locked by §A4) but the explicit version field
  shape (`v1`, semver, integer) is open.

---

## Explicit non-actions

This file tracks coordination state. The following work has **NOT
yet started** and MUST NOT start:

- ❌ **No implementation has started.** Implementation MUST NOT
  start.
- ❌ No `/speckit-clarify` run yet.
- ❌ No `/speckit-plan` invoked (the `plan.md` is a draft
  scaffold; `/speckit-plan` will run when 005 unblocks).
- ❌ No `/speckit-tasks` invoked.
- ❌ No `/speckit-analyze` run.
- ❌ No source files created (no `src/main/cart/*`, no
  `src/renderer/cart/*`, no `src/shared/cart/*`).
- ❌ No migrations authored (`carts`, `cart_lines`,
  `cart_action_outbox` do not yet exist).
- ❌ No `package.json` changes for cart-related dependencies.
- ❌ No backend / Data-Pulse-2 changes for 005 (and none planned
  for cart drafts themselves — drafts are local-only).
- ❌ No payments / receipts / inventory / reports / analytics work
  begun.
- ❌ No issues opened against the project for 005 yet. The project
  owner can open issues once §A0 lifts and `/speckit-tasks`
  produces `tasks.md`.

---

## Status update protocol

When any item changes state (especially §A0), update this file in
place:

1. Update the row in **Required coordination actions** that
   changed (status, owner, dates).
2. Update the corresponding row in the **Gate owner table**.
3. Update the **Last updated** date at the top.
4. If a gate clears completely, update the **Gate unblock table**
   to reflect the now-eligible slices.
5. When §A0 clears, add a line under **Current phase / status**
   noting "§A0 cleared on YYYY-MM-DD; `/speckit-clarify` may run."
6. When `/speckit-clarify` and `/speckit-plan` complete, update
   the **Phase** marker accordingly.

This file is the durable coordination record across sessions.

---

**End of coordination file. DRAFT — BLOCKED. Implementation MUST
NOT begin until 004 S4 closeout AND 004 S5 visibility boundaries
are reviewed and approved AND `/speckit-clarify` runs on 005.**
