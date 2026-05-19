> ## STATUS: DRAFT — BLOCKED — NOT APPROVED FOR IMPLEMENTATION
>
> This document is a **future-spec draft only**. No code, contracts, migrations,
> bridge-API expansion, OpenAPI changes, codegen, or UI are authorised by this
> file. Implementation is **blocked** until the full Spec Kit re-run sequence
> (`/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`)
> completes and is approved.
>
> **Upstream functional prerequisites — all cleared (2026-05-19):**
>
> 1. **004-operator-session** Slice 4 / Slice 5 ✅ complete 2026-05-14 (PRs
>    #133–#143). Operator identity, role-gated visibility, and the
>    cashier-forbidden information catalogue are load-bearing.
> 2. **005-sales-cart** spec ✅ approved 2026-05-14; T100 functional sign-off
>    ✅ 2026-05-19 (PR #181). `specs/005-sales-cart/` is fully authored with
>    six implementation slices complete.
> 3. The **checkout / cart handoff contract** (`PaymentIntentEnvelope v1`) ✅
>    ratified 2026-05-17 in `specs/005-sales-cart/contracts/handoff-envelope.md`.
>
> **§A0 is functionally cleared but procedurally held.** See
> [./coordination.md](./coordination.md) for the gate ledger and next steps.

# Feature Specification: Payments & Tender

**Feature ID:** 006-payments-tender
**Feature Branch:** `006-payments-tender` (not yet created — this is a docs/spec branch)
**Status:** **DRAFT — BLOCKED**
**Created:** 2026-05-09
**Owner:** POS-Pulse desktop team
**Constitution version pinned:** v1.5.1
**Input:** "Define the payments / tender behaviour layer that runs once an
approved sales cart is handed to checkout. Cash tender first, future tender
types deferred."

---

## Overview

Once 005-sales-cart hands a checkout-ready cart to the POS shell, the operator
must be able to take payment, attribute it to themselves, see a clear
success / failure / cancel outcome, and hand off to a future receipts feature.
006-payments-tender locks in *that behaviour* — and only that behaviour — as
product rules.

This feature is deliberately **rules-only**. It defines:

- The tender-selection flow once a cart is approved for checkout.
- The cash-tender path (the only tender type 006 attempts to specify).
- The cash-received / change-due calculation **rule**, not a calculator.
- The lifecycle of a single payment attempt (start → settle / cancel / fail).
- The operator-attribution rules (who took payment, who authorised what).
- The permission boundaries for sensitive tender actions.
- The handoff *into* payments from an approved cart (contract owned by 005).
- The handoff *out of* payments to receipts (contract owned by future
  receipts spec).
- Offline behaviour as **questions only** — not implementation.
- Drawer-impact behaviour as **questions only** — not shift financial maths.

It does not define data shapes, IPC channels, OpenAPI endpoints, migrations,
codegen, or UI. Those decisions are blocked behind the gates in
[./coordination.md](./coordination.md).

## Clarifications

### Session 2026-05-09

No clarification questions resolved in this session. All open questions were
deferred pending upstream contracts (004 S4/S5 and 005-sales-cart). See
Session 2026-05-19 below for the post-upstream-clearance clarifications.

### Session 2026-05-19

Following the merge of 005-sales-cart S5/T100 (PR #181) and the 006 §A0
reconciliation (PR #182), the upstream contracts on which 006 depends are
now load-bearing. The following clarifications resolve the standing
`[NEEDS CLARIFICATION]` markers on FR-002, FR-006, FR-030, and FR-031, and
formally reconcile OQ-005-1..4 (already resolved in coordination.md after
PR #182).

- **Q (FR-002):** What is the exact "approved checkout-handoff cart" the
  payment surface receives from 005?
  **A:** The frozen `PaymentIntentEnvelope v1` produced by 005's
  `cart.handoff` bridge handler, normatively defined in
  `specs/005-sales-cart/contracts/handoff-envelope.md`. The envelope is
  immutable (`Readonly<>` + `Object.freeze` recursive in memory; JSON-
  persisted on `carts.handoff_envelope_json`). 006 treats the envelope as
  the single authoritative input; 006 MUST NOT reach back into
  `cart_lines`, the catalogue API, or Data-Pulse-2 to settle a cash
  payment.

- **Q (FR-006):** What is the closed set of `payment.failed` reason
  categories for the POS-local cash-only flow?
  **A:** The closed set is exactly:
  `cart_lost`, `operator_session_terminated`, `dependency_unavailable`,
  `internal_error`, `stale_handoff`, `tender_underpaid`. Reconciled
  against 004's audit catalogue and 005's `version`/`stale_version`
  refusal semantics; `stale_handoff` covers the case where the envelope
  was constructed but the source cart's `last_action_id` advanced between
  handoff and confirm. `tender_underpaid` is the audit-event category for
  the FR-005 refusal path (`cash_received_minor < total_minor`).

- **Q (FR-030):** What does the handoff *into* payments require for the
  initial cash-only settlement path?
  **A:** Required for Slices 1–3: read the frozen
  `PaymentIntentEnvelope v1` produced by `cart.handoff`; use
  `envelope.subtotal_minor` as the authoritative total input; reject any
  attempt to start a payment when the envelope's `cart_id` no longer maps
  to a cart in `frozen_handed_off` state (this is the `cart_lost` and
  `stale_handoff` FR-006 paths). Deferred: any field added by future
  payments slices (e.g., `envelope_signature`) is an extension under
  005's §"Forward-compatibility commitment" and bumps
  `envelope_version`; 006 v1 emits and consumes `v1` only.

- **Q (FR-031):** What does the handoff *out of* payments require for
  the initial cash-only settlement path?
  **A:** Required for Slices 1–3: on `settled`, the cart is consumed
  (the envelope's `handoff_action_id` is the correlation key for any
  future receipt). 006 v1 emits a canonical `payment.settled` audit
  event and transitions the surface to a placeholder post-settle state.
  Deferred: the receipts-handoff data shape, rendering, and printing —
  owned by the future receipts spec (OQ-RCPT-1).

- **Q (OQ-005-1..4):** Are the four cross-feature open questions
  (cart-handoff data shape, persistence, lifecycle, currency) resolved?
  **A:** Yes — all four resolved by the ratification of
  `PaymentIntentEnvelope v1` (2026-05-17). The resolutions are recorded
  normatively in `coordination.md` §"Owned by 005, blocking 006 (all
  resolved — 2026-05-19)". This spec section restates the linkage only;
  the contract itself is the single source of truth.

- **Q (catalogue authority):** Does 006 settlement depend on a live
  catalogue API?
  **A:** No. Catalogue authority belongs to Data-Pulse-2 / backend; a
  POS-local catalogue read-model/cache is a future feature. 006 v1's
  cash-settlement path uses only `envelope.subtotal_minor` (FR-005) and
  MUST NOT call any catalogue API. When the live catalogue ships, 006
  is unaffected — it always consumes the frozen envelope.

- **Q (renderer error surface):** What does the cashier see on refusal?
  **A:** Generic, non-shaming, non-disclosing copy at the renderer
  (FR-005, FR-022, NFR-003 inherited from 004). The bridge-side reason
  category (e.g., `tender_underpaid`, `cart_lost`) lives in the audit
  payload, not in the renderer-facing text. No sensitive IDs, no raw
  payloads, no envelope contents are echoed to the UI on refusal.

**What this clarification does NOT do:**

- Does NOT open §A1–§A5; those remain held pending `/speckit-plan`.
- Does NOT make `tasks.md` startable.
- Does NOT resolve the offline-payments questions (OQ-OFF-1..4) — those
  remain deferred to a dedicated offline-payments review.
- Does NOT resolve the drawer-impact questions (OQ-DRW-1..4) — those
  remain deferred to the future shift-management spec.
- Does NOT resolve OQ-3 (cancel return target) or OQ-4 (force-fail UX
  shape); both remain owned by 006 and will be addressed in
  `/speckit-plan` as AD-DEFERRED-3 and AD-DEFERRED-4 resolutions.

## User Scenarios & Testing *(mandatory)*

> Each story is **independently testable as product behaviour** even though
> none can be implemented until the upstream gates clear. Stories are
> prioritised so the smallest implementable slice (when unblocked) is P1.

### User Story 1 — Take a single cash payment for an approved cart (Priority: P1)

A cashier has an approved cart handed off from 005. The cashier selects
**Cash** as tender, enters the amount received, sees the change due, confirms
the payment, and the system records the payment as **settled**, attributes it
to the signed-in cashier, and hands off to receipts. The cart cannot be
edited from this surface, and the surface cannot be reached without an
approved cart.

**Why this priority**: Cash is the only tender 006 attempts to settle. Until
this story works end-to-end (when unblocked), no later tender type, no
refund, no receipt, and no shift close can be exercised.

**Independent Test**: A reviewer (when unblocked) drives an approved cart to
checkout, picks Cash, enters a `cash_received_minor ≥ total_minor`, confirms,
observes the success outcome, the operator-attribution display, and the
handoff to receipts. No cart editing, no inventory change, no shift close are
required for this test.

**Acceptance Scenarios**:

> In these scenarios, `total_minor` refers to `envelope.subtotal_minor`
> from the frozen `PaymentIntentEnvelope v1` 005 hands off (FR-002,
> FR-030). 006 does not compute its own total.

1. **Given** a frozen `PaymentIntentEnvelope v1` with a positive
   `subtotal_minor`, **When** the cashier opens the payment surface,
   **Then** tender selection is reachable and the cart line summary
   rendered from the envelope is read-only on this surface.
2. **Given** Cash is selected, **When** the cashier enters
   `cash_received_minor ≥ envelope.subtotal_minor`, **Then** the
   displayed change due is `cash_received_minor − envelope.subtotal_minor`
   (integer minor units; never a float).
3. **Given** Cash is selected and
   `cash_received_minor < envelope.subtotal_minor`, **When** the cashier
   attempts to confirm, **Then** confirmation MUST be refused with a
   non-shaming, non-disclosing message and the cashier MAY amend the
   amount or cancel the payment attempt. The audit category for the
   refusal is `tender_underpaid` (FR-006).
4. **Given** a confirmed cash payment, **When** settlement completes,
   **Then** the payment record carries the signed-in operator's identity
   (FR-013), an immutable settled timestamp, the
   `envelope.handoff_action_id` as cross-feature correlation key, and a
   deterministic outcome of `settled`.
5. **Given** a `settled` payment, **When** the surface transitions out,
   **Then** the cart is consumed and not reachable for further payment;
   the surface transitions to a placeholder post-settle state until the
   future receipts spec ships (FR-031).
6. **Given** no `PaymentIntentEnvelope v1` is currently bound to the
   payment surface, **When** the cashier attempts to reach the payment
   surface, **Then** the surface MUST NOT render and a generic refusal
   MUST be returned (FR-022; FR-019 inherited from 004).

### User Story 2 — Cancel a payment attempt before settlement (Priority: P2)

A cashier starts a payment, then cancels — for example, the customer changes
their mind, an amount was mistyped, or the cashier wants to switch tender
type (when future tender types ship). Cancelling does not settle, does not
attribute a settled payment to the operator, but **does** record a
canonical `payment.cancelled` audit event (FR-026, inherited from 004).

**Why this priority**: A payment surface that cannot be cancelled traps the
cashier. P2 because P1 must work before cancel is meaningful.

**Independent Test**: Drive to the payment surface, start a Cash attempt,
cancel before confirming, observe that no `settled` outcome was recorded, the
cart is still in the checkout-handoff slot (or returned to 005's handoff
state per the contract 005 defines), and a `payment.cancelled` audit event
was written.

**Acceptance Scenarios**:

1. **Given** a payment attempt in `started` state, **When** the cashier
   invokes cancel, **Then** the attempt transitions to `cancelled` and no
   settled payment record is produced.
2. **Given** an attempt in `cancelled` state, **When** the surface
   transitions, **Then** the bound `PaymentIntentEnvelope v1` remains
   intact and re-runnable (the envelope is immutable per 005 §"Immutability
   guarantees"); the exact UX target after cashier-initiated cancel (return
   to tender selection vs. exit to a re-runnable handoff state) is owned
   by 006 and recorded as OQ-3 below — to be resolved in `/speckit-plan`
   as AD-DEFERRED-3.
3. **Given** a cancellation, **When** the audit log is reviewed, **Then** a
   `payment.cancelled` event is present with operator attribution (FR-013).

### User Story 3 — A payment attempt fails (Priority: P3)

A payment attempt fails for a reason 006 considers in scope: the cart
disappears mid-attempt (cart no longer present in the handoff slot), the
operator session ends mid-attempt (sign-out, takeover, inactivity), or a
backend dependency required for settlement (when 005 / future tender types
introduce one) is unreachable. Failure is **not silent** (constitution P2),
the cart is NOT marked paid, and a `payment.failed` audit event is recorded.

**Why this priority**: Constitution P2 forbids fake success. Failure must be
exercised once success and cancel work.

**Independent Test**: Force a failure condition (mechanism deferred to
implementation), confirm the surface presents a non-shaming failure message,
the cart is not marked paid, and a `payment.failed` audit event is written
with operator attribution.

**Acceptance Scenarios**:

1. **Given** a payment attempt in `started` state, **When** the operator
   session terminates (sign-out / takeover / inactivity per 004 FR-009 /
   FR-013 / FR-014), **Then** the attempt MUST resolve to `failed` with a
   reason category (see FR-006 below); the cart MUST NOT be marked paid.
2. **Given** a payment attempt in `started` state, **When** the cart is no
   longer present in the checkout-handoff slot, **Then** the attempt MUST
   resolve to `failed` and the user MUST see a non-shaming, non-disclosing
   failure message.
3. **Given** any `failed` outcome, **When** the audit log is reviewed,
   **Then** a `payment.failed` event is present with the failure-reason
   category and operator attribution.

---

## Edge Cases & Assumptions

- **Approved-cart-required**: 006 never reaches the payment surface
  without a frozen `PaymentIntentEnvelope v1` produced by 005's
  `cart.handoff` handler (FR-002, FR-030). The envelope is the
  single authoritative input; 006 MUST NOT consult `cart_lines`, the
  catalogue API, or Data-Pulse-2 to settle a cash payment.
- **Operator change mid-attempt**: a takeover (004 FR-013) or sign-out
  (004 FR-008) during a `started` attempt MUST resolve to `failed`. The
  cart is not marked paid; the cashier on the next operator session sees
  the cart returned to the 005-defined handoff state.
- **Concurrent attempts**: only one payment attempt MAY be in `started`
  state per terminal at a time. Tested by SC-002.
- **Money is integer minor units** (Constitution P-II / Principle II). No
  floats, no decimal-string arithmetic. Change due is computed as
  `cash_received_minor − total_minor` and is non-negative by construction
  (refused confirmation if it would be negative — see User Story 1 #3).
- **Refunds / returns are out of scope**. Future spec.
- **Card / wallet / split tender are out of scope.** Future spec(s).
- **PII / cardholder data**: no card data of any kind is captured by 006.
  See FR-014.
- **Offline behaviour**: explicitly questions only — see "Offline behaviour
  questions" below.
- **Drawer impact**: explicitly questions only — see "Drawer-impact
  questions" below.

---

## Functional Requirements

> Numbering does not extend 004. 006 owns FR-001…FR-099. Forward references to
> 004 FRs cite "(004 FR-NNN)" so cross-feature dependencies are visible.

### Tender selection

- **FR-001**: The payment surface MUST present a tender-selection step. In
  006, **Cash is the only selectable tender**. Other tender slots MUST be
  visibly reserved (so cashiers / customers / reviewers can see future
  options exist) but MUST be disabled and emit a generic
  `tender_not_yet_supported` refusal if invoked.
- **FR-002**: Tender selection MUST be reachable only when a frozen
  `PaymentIntentEnvelope v1` is available from 005's `cart.handoff`
  bridge call. The envelope's shape, immutability, and persistence are
  normatively defined in
  `specs/005-sales-cart/contracts/handoff-envelope.md`; 006 treats the
  envelope as opaque on the field level — it reads only what its own
  product behaviour requires (notably `cart_id`, `subtotal_minor`,
  `owning_operator_id`, `operator_session_id`, `tenant_id`, `branch_id`,
  `terminal_id`, `handoff_action_id`). Reaching the surface without an
  envelope refuses generically (FR-022).
- **FR-003**: Tender selection MUST NOT permit returning to cart editing
  (cart edits are owned by 005, and 005 defines whether returning is
  possible). 006 only specifies that the cart is **read-only on the
  payment surface**.

### Cash tender

- **FR-004**: The Cash tender path MUST collect a single
  `cash_received_minor` integer in the cart's currency, in **minor units**
  only (Constitution P-II). The UI MAY display a major-unit-formatted
  helper for the operator, but the source of truth is the integer.
- **FR-005**: Change due MUST be computed as
  `cash_received_minor − total_minor` and MUST be a non-negative integer.
  When `cash_received_minor < total_minor`, confirmation MUST be refused
  generically (User Story 1 #3); the cashier MAY amend the amount or
  cancel.

### Payment-attempt lifecycle

- **FR-006**: A payment attempt MUST traverse a deterministic state
  machine with these states: `idle → started → (settled | cancelled |
  failed)`. Once any terminal state is reached, the attempt MUST NOT
  return to `started`. Each terminal transition MUST record:
  - the operator identity (FR-013, inherited from 004 FR-001 / FR-013);
  - a UTC timestamp;
  - a structured outcome (`settled` / `cancelled` / `failed`);
  - for `failed`, a reason category drawn from the closed set:
    `cart_lost`, `operator_session_terminated`, `dependency_unavailable`,
    `internal_error`, `stale_handoff`, `tender_underpaid` (locked
    2026-05-19; reconciled against 004's audit catalogue and 005's
    `version` / `stale_version` refusal semantics). The category is
    structured data on the audit event; the renderer-facing copy MUST
    remain generic and non-disclosing (FR-022, NFR-003).

### Operator attribution

- **FR-013**: Every payment attempt — at every state transition — MUST
  attribute the action to the **currently signed-in operator** as defined
  by 004 (FR-001, FR-013). No payment attempt may proceed without a
  signed-in operator session.
- **FR-014**: Operator attribution MUST use the stable Clerk-backed
  identity from 004; it MUST NOT be derived from the cashier PIN record,
  the device token, or any per-terminal local artefact. (Inherited from
  004 plan AD-2.)

### Permission boundaries for sensitive tender actions

- **FR-020**: Cancelling a `started` payment is a **cashier-permitted**
  action, attributable to the signed-in cashier. No manager / admin
  authorisation is required for cashier-initiated cancel.
- **FR-021**: Force-failing a payment attempt (e.g., to break a stuck
  attempt during incident response) MUST be a manager- or admin-only
  action under 004 FR-024 / FR-025 / FR-026 conventions, and MUST emit a
  dedicated audit event (proposed: `payment.force_failed`, attribution
  recording both the cashier whose attempt was force-failed and the
  manager / admin actor). Mechanism deferred to implementation.
- **FR-022**: Reaching the payment surface without an approved cart MUST
  be refused at the **information layer** (004 FR-019 / AD-1) — the
  surface MUST NOT render even briefly, the bridge call (when defined)
  MUST refuse generically, and audit-event emission MUST NOT disclose
  the cart's absence (so reviewers cannot probe for cart state via
  payment-surface telemetry).

### Handoff contracts

- **FR-030**: The handoff **into** payments is the frozen
  `PaymentIntentEnvelope v1` produced by 005's `cart.handoff` handler
  (see `specs/005-sales-cart/contracts/handoff-envelope.md`). For the
  initial cash-only settlement path (Slices 1–3), 006 v1 reads
  `envelope.subtotal_minor` as the authoritative total input,
  `envelope.cart_id` for FSM keying, `envelope.handoff_action_id` for
  audit correlation, and the operator / tenant / branch / terminal
  fields for attribution and isolation. 006 v1 emits and consumes
  `envelope_version='v1'` only. Any future field addition by payments
  (e.g., `envelope_signature`) is an extension governed by 005's
  forward-compatibility commitment and bumps `envelope_version`.
- **FR-031**: The handoff **out of** payments is owned by the future
  receipts spec. For the initial cash-only settlement path (Slices 1–3),
  006 v1 emits a canonical `payment.settled` audit event whose
  attribution carries the cart's `handoff_action_id` as the cross-feature
  correlation key, and transitions the surface to a placeholder
  post-settle state (the cart is consumed; the surface returns to the
  pre-handoff state pending receipts). The receipts-handoff data shape,
  rendering, and printing are deferred to the receipts spec (OQ-RCPT-1).

### Audit and integrity

- **FR-025**: All payment-attempt terminal transitions
  (`settled` / `cancelled` / `failed`), and the manager-only
  `payment.force_failed` action, MUST emit canonical audit events under
  004 FR-025 / FR-026.
- **FR-026**: Audit events for payments MUST NOT contain raw card data,
  raw cardholder data, or any value that could be used as cardholder
  data — 006 captures none in any case (FR-040). (Inherited from 004
  FR-027 and Constitution P6.)
- **FR-027**: Audit events for payments MUST be append-only at the rule
  level (004 FR-028).

### Out-of-scope guards

- **FR-040**: 006 MUST NOT capture, transmit, or persist raw card data,
  raw PAN, raw CVV, or any value that could be used as cardholder data.
  Card / wallet / split tender are deferred to a later, explicitly
  scoped feature.
- **FR-041**: 006 MUST NOT mutate inventory. Stock movement is owned by
  a future inventory spec.
- **FR-042**: 006 MUST NOT compute shift expected total, shift variance,
  shift shortage, or shift overage. Shift financials are owned by a
  future shift-management spec.
- **FR-043**: 006 MUST NOT generate, render, or print receipts. Receipts
  are owned by a future receipts spec.
- **FR-044**: 006 MUST NOT report KPIs, dashboards, or analytics
  surfaces.

---

## Non-Functional Requirements

- **NFR-001**: Money math MUST use integer minor units (Constitution
  P-II). The cash-received / change-due rule is the only money math 006
  specifies.
- **NFR-002**: PII / cards / secrets MUST NEVER appear in logs (004
  NFR-002, Constitution P7). Payment attempts log only operator id,
  timestamps, totals in minor units, and reason categories.
- **NFR-003**: Failure MUST be loud, never silent (Constitution P2 and
  Principle IV). A `failed` payment MUST be visibly distinct from
  `settled` in the UI and in the audit log.
- **NFR-004**: Accessibility — touch targets ≥ 44×44 CSS px (003 / 004
  inherited NFR-005); the cash-received entry control MUST be operable
  by keyboard alone for non-touch terminals.
- **NFR-005**: The payment surface MUST display the currently-signed-in
  operator at all times (004 FR-020).

---

## Offline behaviour — questions only

> 006 deliberately does not specify offline behaviour for payments. The
> following are open questions to be resolved by a future offline-payments
> review, not by this spec.

- **OQ-OFF-1**: Is a cash tender attempt allowed while the terminal is
  `offline` (003 connection state) given that cash settlement does not
  require a backend round-trip?
- **OQ-OFF-2**: If yes to OQ-OFF-1, what is the audit-event behaviour
  while offline (queued? deferred-attribution? rejected)?
- **OQ-OFF-3**: How does an offline-settled cash payment reconcile with
  the future shift-financial flow when the terminal returns online —
  who owns the reconciliation contract, 006 or shift-management?
- **OQ-OFF-4**: Does a takeover (004 FR-013) detected only when the
  terminal returns online retroactively invalidate an offline-settled
  payment? (Likely no, but must be confirmed against 004's takeover
  semantics.)

These questions are non-binding on this draft. Resolution is required
before any implementation slice that touches offline cash settlement.

---

## Drawer-impact — questions only

> 006 deliberately does not specify drawer mechanics. Cash payments
> *imply* drawer state changes, but the calculation and reconciliation
> of drawer state is owned by a future shift-financial / shift-management
> spec.

- **OQ-DRW-1**: When a cash payment settles, does 006 emit a structured
  signal that future shift-financial logic consumes (event-shape
  question), or does future shift-financial logic derive drawer impact
  from `payment.settled` audit events directly?
- **OQ-DRW-2**: How is a drawer kick (open the till with no payment)
  represented? Likely not 006 at all — likely a sibling future spec —
  but must be answered before audit-event categories are frozen.
- **OQ-DRW-3**: Does cancelling or failing a payment have any drawer
  impact? (Default answer: no, because no settlement occurred.)
- **OQ-DRW-4**: What is the drawer-state contract on offline-settled
  cash (cross-references OQ-OFF-3)?

These questions are non-binding on this draft. Resolution is required
before any shift-financial spec lands.

---

## Dependencies

- **004-operator-session**:
  - Slice 4 / Slice 5 must be **complete and approved** so operator
    identity, role-gated visibility, and the cashier-forbidden
    information catalogue are load-bearing. 006 attribution and
    permission boundaries (FR-013, FR-014, FR-020, FR-021, FR-022)
    quote 004's contracts directly.
  - 004 audit-event catalogue (FR-025 / FR-026) is the parent for all
    payment-related audit events.
- **005-sales-cart**:
  - Must be **approved** so the checkout-handoff contract exists.
  - 005 owns the cart shape, totals, line items, and the handoff slot.
    006 references but does not define any of these.
- **Future receipts spec**:
  - Owns receipt generation, rendering, printing, and the
    payment-to-receipts handoff data shape.
- **Future inventory spec**:
  - Owns stock mutation. Settlement of a cash payment does not — in
    006 — mutate inventory.
- **Future shift-management spec**:
  - Owns drawer state, expected total, variance, shortage, overage, and
    every drawer-impact calculation.
- **Future S5 / S6 reporting work**:
  - Owns financial review and reporting visibility surfaces.

---

## Non-Goals (explicit)

This list is **normative**: any task that drifts into a non-goal MUST be
filed as a separate feature, not folded into 006.

- ❌ Cart editing or cart-side UI of any kind.
- ❌ Receipts implementation (rendering, printing, retention).
- ❌ Inventory mutation, stock movement, FEFO logic.
- ❌ Reports, KPIs, dashboards, analytics surfaces.
- ❌ Shift financial calculations (expected total, variance, shortage,
     overage, drawer reconciliation).
- ❌ Real card processor integration (Visa / MC / wallets / etc.).
- ❌ Refunds or returns (positive and negative).
- ❌ Backend / API implementation for payments (any new OpenAPI surface
     is owned by a later, explicitly scoped feature).
- ❌ Database migrations.
- ❌ Codegen runs (`npm run codegen:api`).
- ❌ UI implementation (no `src/renderer/**`, no `src/main/**`, no
     `src/preload/**`, no `src/shared/**` changes from this spec).
- ❌ Data-Pulse-2 changes of any kind.

---

## Success Criteria (deferred until unblocked)

> Success criteria are intentionally **not** declared in this draft. Once
> 004 S4/S5 close and 005 is approved, this section will be filled by a
> follow-up spec revision authored under the standard Spec Kit flow.
> Sketches:
>
> - SC-001 (P1): a cashier can settle a single cash payment for an
>   approved cart and observe `settled` outcome, attribution, and
>   handoff to receipts (when receipts ships).
> - SC-002 (P2): a cashier can cancel a started payment; no settled
>   record is produced; an audit event is recorded.
> - SC-003 (P3): a forced failure condition resolves to `failed`, with
>   a non-shaming user message and a `payment.failed` audit event.
> - SC-AUDIT (cross-cutting): every state transition emits a canonical
>   audit event under 004 FR-025 / FR-026 with no PII / card data.

---

## Review & Approval

| Item | State |
|:--|:--|
| Status banner | DRAFT — BLOCKED |
| 004 S4/S5 visibility boundaries complete? | ✅ complete 2026-05-14 |
| 005-sales-cart spec approved? | ✅ approved 2026-05-14; T100 sign-off 2026-05-19 |
| Cart ↔ payments handoff contract pinned (in 005)? | ✅ `PaymentIntentEnvelope v1` ratified 2026-05-17 |
| `/speckit-clarify` rerun after upstream features close? | ✅ applied 2026-05-19 (FR-002, FR-006, FR-030, FR-031 resolved; OQ-005-1..4 reconciled) |
| `/speckit-plan` v1.0 (resolves AD-DEFERRED-1..6) | ❌ deferred — next required step |
| Visual-direction Slice 0 commissioned? | ❌ deferred (gated on §A1 below) |

**Implementation is not authorised by this document.** See
[./coordination.md](./coordination.md) for the gate ledger.
