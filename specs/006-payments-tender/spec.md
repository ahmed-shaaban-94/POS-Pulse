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
approved sales cart is handed to checkout. Supported tender types in v1:
**cash**, **external card terminal (record-only — no gateway integration)**,
**internal voucher (authority-validated)**. **Split tender is supported.**
Tender-scope amended 2026-05-19; the prior cash-only assumption recorded
by PR #183 is **superseded** — see §Clarifications "Session 2026-05-19 —
Tender scope amendment" below."

---

## Overview

Once 005-sales-cart hands a checkout-ready cart to the POS shell, the operator
must be able to take payment, attribute it to themselves, see a clear
success / failure / cancel outcome, and hand off to a future receipts feature.
006-payments-tender locks in *that behaviour* — and only that behaviour — as
product rules.

This feature is deliberately **rules-only**. It defines:

- The tender-selection flow once a cart is approved for checkout.
- The three supported tender paths in v1: **cash**, **external card
  terminal (record-only)**, and **internal voucher
  (authority-validated)** — see §"Tender scope (amendment 2026-05-19)"
  below.
- **Split tender**: a customer MAY pay one cart using more than one
  tender (e.g., part cash + part voucher); settlement succeeds only
  when the sum of applied tender lines equals
  `envelope.subtotal_minor`.
- The cash-received / change-due calculation **rule**, not a calculator.
  Only **cash** may overpay; non-cash tenders MUST NOT create change.
- The lifecycle of a single payment attempt (start → settle / cancel / fail).
- The lifecycle and arithmetic of `TenderLine` rows within a payment
  attempt (apply → applied | refused | reversed).
- The operator-attribution rules (who took payment, who authorised what).
- The permission boundaries for sensitive tender actions.
- The handoff *into* payments from an approved cart (contract owned by 005).
- The handoff *out of* payments to receipts (contract owned by future
  receipts spec).
- The boundary between POS-Pulse and Data-Pulse-2 for **internal
  vouchers**: voucher authority (issue / list / cancel / balance)
  belongs to Data-Pulse-2; POS-Pulse only **redeems** through an
  approved validation contract — see §"Voucher authority boundary".
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

### Session 2026-05-19 — Tender scope amendment

The product owner amended tender scope **after** the 2026-05-19
`/speckit-clarify` session above (which had recorded a cash-only first
target) and **before** `/speckit-plan` v1.0. The cash-only assumption is
**superseded**; the cash-only acceptance scenarios in User Story 1
below are now the **cash variant** of the multi-tender flow, not the
exclusive flow. The amendment is recorded here so reviewers can read
both the original clarification and the superseding scope side-by-side
in commit history.

- **Q (tender scope):** Which tender types does 006 v1 support?
  **A:** Three: **cash**, **external_card_terminal** (record-only —
  no gateway integration, no payment processor API call, no card
  data captured), and **internal_voucher** (authority-validated by
  Data-Pulse-2 / POS-Pulse-side voucher authority). Real card
  processor integration, wallets, BNPL, and any tender that requires
  a live network gateway remain **out of scope** (FR-040).

- **Q (split tender):** Does 006 v1 support paying one cart with
  more than one tender?
  **A:** Yes. A single payment attempt MAY apply multiple
  `TenderLine`s. Settlement succeeds only when the sum of applied
  `amount_applied_minor` across all `TenderLine`s in `applied`
  state equals `envelope.subtotal_minor`. **Cash MAY overpay** and
  produce `change_due_minor` on the cash line only; non-cash
  tenders MUST NOT overpay and MUST NOT produce change. Split
  ordering and rollback semantics are deferred to `/speckit-plan`
  (OQ-PLAN-4 below).

- **Q (external card terminal):** How does POS-Pulse handle card
  payments?
  **A:** **Record-only.** The cashier completes payment on a
  separate, physical, external card terminal. POS-Pulse records
  that an external-card-terminal `TenderLine` was applied; it does
  NOT call any payment gateway, processor API, or terminal
  vendor SDK. **No PAN, CVV, track data, cardholder name, auth
  payload, raw terminal receipt text, or card data of any kind**
  may be captured, transmitted, persisted, or logged by 006
  (FR-040, Constitution P6). An optional operator-entered
  `external_reference` field MAY be allowed only if it is
  **non-sensitive** (e.g., a short alphanumeric the cashier reads
  off the terminal printout to aid reconciliation) and is
  **redacted from logs** (Constitution P7). The exact field
  policy is deferred to `/speckit-plan` (OQ-PLAN-5 below).

- **Q (internal voucher):** How is a voucher validated and applied?
  **A:** Not record-only. A voucher `TenderLine` MUST be
  **validated** against a voucher authority **before** it is
  applied to the payment attempt, and **redeemed** atomically at
  payment confirmation. Voucher issuance, cancellation, balance
  authority, and the canonical voucher store belong to
  **Data-Pulse-2 / SmartDataPulse backend**. POS-Pulse MUST NOT
  implement voucher issuance or cancellation in this feature.
  POS-Pulse-side voucher redemption requires either (a) a future
  approved `vouchers.validate` / `vouchers.redeem` bridge contract
  backed by a Data-Pulse-2 endpoint, or (b) a future approved
  POS-local voucher authority / read-model contract — see
  §"Voucher authority boundary". **Double-redemption MUST be
  prevented** at the authoritative layer. **Partial voucher
  redemption** (a voucher worth more than the cart subtotal, or
  splitting one voucher across multiple carts) is deferred to
  `/speckit-plan` (OQ-PLAN-3 below). **Offline voucher
  redemption** is **deferred** unless a local voucher authority
  contract exists at validation time — see OQ-OFF-VCHR-1 below.

- **Q (settlement invariant):** What is the closed condition for
  a `settled` outcome under the amended tender scope?
  **A:** `Σ TenderLine.amount_applied_minor (where state='applied')`
  `== envelope.subtotal_minor`. **No undershoot** (per-line
  audit-event reason `tender_underpaid` from FR-006 still
  applies). **No non-cash overshoot** (per-line refusal reason
  `non_cash_overpayment_refused`, locked here as a new FR-006
  failure category — see FR-006 amendment below). **Cash
  overshoot is permitted** and produces `change_due_minor` on the
  cash line only.

**What this amendment does NOT do:**

- Does NOT add real card processor / gateway integration of any
  kind — that remains out of scope (FR-040, Non-Goals).
- Does NOT modify Data-Pulse-2; the voucher authority contract is
  a future, separately-spec'd integration.
- Does NOT implement voucher issuance, voucher cancellation, or
  loyalty-campaign behaviour — those belong to a future
  Data-Pulse-2-led spec.
- Does NOT generate, render, or print receipts (FR-043 still
  binding).
- Does NOT open §A1–§A5; all five gates remain ⛔ Held.
- Does NOT make `tasks.md` startable.
- Does NOT produce `/speckit-plan` v1.0 — `/speckit-plan` must
  now resolve the expanded decision set (AD-DEFERRED-1..6 plus
  the OQ-PLAN-1..8 below).
- Does NOT lock the `TenderLine` data shape, persistence model,
  bridge namespace, or rollback semantics — those are
  `/speckit-plan` decisions.

---

## Tender scope (amendment 2026-05-19)

This section is **normative**. It supersedes the cash-only first-target
assumption recorded by PR #183.

### Supported tender types in v1

| `tender_type` | Semantics | Settlement role |
|:--|:--|:--|
| `cash` | Local-only. Cashier enters `cash_received_minor` (integer minor units). MAY overpay; overpay produces `change_due_minor` on the cash line. | Local-first; no backend round-trip required. |
| `external_card_terminal` | Record-only. Cashier completes payment on a separate physical card terminal. POS-Pulse records that the line was applied; NO gateway/processor integration; NO card data captured. Optional non-sensitive `external_reference` (deferred field-policy decision — OQ-PLAN-5). | Local-first record; reconciliation contract with Data-Pulse-2 deferred. |
| `internal_voucher` | Authority-validated. Voucher MUST be validated against a voucher authority before applied; redeemed atomically at payment confirmation. Double-redemption MUST be prevented at the authoritative layer. | Requires authoritative validation/redeem — see §"Voucher authority boundary". |

Future tender slots (wallet, BNPL, real card gateway, etc.) MUST appear
as **reserved-but-disabled** affordances if shown at all (FR-001) and
MUST emit a generic `tender_not_yet_supported` refusal if invoked.

### TenderLine concept

A single payment attempt carries **one or more** `TenderLine` rows. The
data shape, persistence model, and bridge surface for `TenderLine` are
`/speckit-plan` v1.0 decisions (OQ-PLAN-1, OQ-PLAN-2). For spec
purposes, a `TenderLine` is **the unit of money applied via a single
tender type within a single payment attempt** and carries at least:

| Field (behavioural; not data-shape-binding) | Notes |
|:--|:--|
| `tender_line_id` | Stable identifier within the attempt. |
| `tender_type` | One of `cash` / `external_card_terminal` / `internal_voucher`. |
| `amount_applied_minor` | Non-negative integer minor units. |
| `state` | `applying → (applied \| refused)`; `applied → (reversed \| reversal_pending)`; `reversal_pending → reversed` (Slice 4 deferred-reversal resolver). Five states total. Per `/speckit-plan` v1.0 research §R-11 and `data-model.md` §"PaymentTenderLine" Invariant 1. Terminal states (`refused`, `reversed`) block further mutation of this line; `reversal_pending` is the only non-terminal "applied-ish" state and resolves to `reversed` via the deferred-reversal resolver. |
| `change_due_minor` | Only populated for `cash` lines that overpay. Always `null` / absent on non-cash lines. |
| `external_reference` | Optional, non-sensitive, redacted-in-logs. Only meaningful for `external_card_terminal`; field-policy deferred to OQ-PLAN-5. |
| `voucher_reference` | Reference to the redeemed voucher record. Only meaningful for `internal_voucher`. Sensitive-field policy follows §"Voucher authority boundary"; the exact wire shape and which fields cross the bridge is deferred to OQ-PLAN-7. |
| `applied_at` / `refused_at` / `reversed_at` | UTC timestamps. |
| `attribution_operator_id` | Inherits FR-013 / FR-014. |

The above is the **behavioural minimum**. The persisted shape, the
bridge-side return shape, the redaction boundary, and what (if anything)
the renderer ever sees of `voucher_reference` are all deferred to
`/speckit-plan` (OQ-PLAN-1 / OQ-PLAN-2 / OQ-PLAN-7).

### Settlement invariant (closed)

A payment attempt may transition to `settled` only when **all four**
conditions hold simultaneously:

1. **Total applied contribution equals subtotal** (canonical form;
   matches `data-model.md` §"PaymentTenderLine" Invariant 5,
   `research.md` §R-8, and the test in tasks.md §T080):

   ```text
   Σ (TenderLine.amount_applied_minor − COALESCE(TenderLine.change_due_minor, 0))
   WHERE TenderLine.state = 'applied'
       == envelope.subtotal_minor
   ```

   The `change_due_minor` subtraction is what makes cash overpayment
   safe: an over-tendered cash line contributes
   `amount_applied_minor − change_due_minor` to the running total
   (the overage is returned to the customer as change, not credited
   to the cart). Non-cash lines have `change_due_minor = NULL`
   (condition 3 below), so they contribute `amount_applied_minor`
   directly.
2. **No non-cash overpayment**: every non-cash `TenderLine` satisfies
   `amount_applied_minor ≤ remaining_balance_at_apply_time` (where
   `remaining_balance` is `envelope.subtotal_minor` minus the running
   sum of already-applied contributions per condition 1).
3. **Cash overpayment is allowed only on a `cash` line**, and produces
   a non-negative `change_due_minor` on that line only;
   `change_due_minor` MUST be `NULL` (absent) on every non-cash line.
4. **Every `internal_voucher` line in `applied` state has been
   atomically redeemed** by the voucher authority; double-redemption
   is prevented at that authority.

If any of (1)–(4) is violated at confirm time, the attempt MUST refuse
generically (FR-022 / NFR-003) and emit a `payment.failed` audit event
with the appropriate FR-006 reason category.

### Cash overpayment vs. non-cash overpayment

| Tender | Overpayment behaviour |
|:--|:--|
| `cash` | Allowed. Produces `change_due_minor = amount_applied_minor − remaining_balance_at_apply_time` on the cash line. Refusal reason for under-tender remains `tender_underpaid`. |
| `external_card_terminal` | **NOT allowed**. The cashier MUST enter exactly `remaining_balance_at_apply_time`. Refusal reason: `non_cash_overpayment_refused` (new FR-006 category, locked here). |
| `internal_voucher` | **NOT allowed**. Same refusal reason: `non_cash_overpayment_refused`. The handling of voucher value that exceeds the cart subtotal (e.g., do we refuse the line, or do we apply only `remaining_balance` and leave residual voucher value) is **partial-redemption** — deferred to OQ-PLAN-3. |

### Voucher authority boundary

POS-Pulse MUST NOT implement voucher issuance or voucher cancellation
in this feature. Those belong to **Data-Pulse-2 / SmartDataPulse
backend**.

POS-Pulse v1 redeems a voucher only through an **approved**
authoritative validation contract. The contract may be either:

- **Contract V-A — Backend-authoritative (preferred):** a future
  Data-Pulse-2 endpoint pair (`POST /vouchers/validate`,
  `POST /vouchers/redeem`) wrapped in a `vouchers.validate` /
  `vouchers.redeem` POS-Pulse bridge handler. Validation returns a
  short-lived non-sensitive **redemption intent** token bound to the
  payment attempt; redeem atomically consumes the intent at payment
  confirmation. Network failure → `dependency_unavailable` (FR-006).
- **Contract V-B — POS-local read-model (only if approved):** a future
  POS-Pulse local voucher authority/read-model with replicated voucher
  balance and a local atomic redeem under the same one-redemption
  guarantee. Acceptable only if Data-Pulse-2 explicitly grants this
  authority to the POS terminal under a documented offline reconciliation
  contract.

The choice between V-A and V-B is a `/speckit-plan` decision
(**OQ-PLAN-7**). Neither contract is authored by this spec.

Until the chosen contract ships, **no `internal_voucher` TenderLine
may be applied**; the voucher tender slot is reserved-but-disabled
(FR-001), and invoking it returns `tender_not_yet_supported`. This is
the same disabled-slot pattern that protects future wallet/BNPL
tender types.

**Renderer-side voucher data is minimised**: the renderer MUST NOT
receive voucher-balance authority data, voucher-issuance metadata,
loyalty-program internals, or any cross-cart voucher state. The
renderer sees only enough to display the applied line generically
(see §FR-017). Sensitive voucher fields and the wire shape are
deferred to OQ-PLAN-7.

### Offline behaviour (amendment)

- `cash` offline behaviour remains under OQ-OFF-1..4 (unchanged by this
  amendment).
- `external_card_terminal` offline behaviour: POS-Pulse MAY still
  record an external-card-terminal `TenderLine` while offline since
  the actual settlement happens on the external device; the
  reconciliation contract with Data-Pulse-2 is **deferred** to a
  dedicated reconciliation review (OQ-OFF-EXT-1, see below).
- `internal_voucher` offline behaviour: **deferred unless a local
  voucher authority/read-model contract exists at validation time
  (Contract V-B above)** (OQ-OFF-VCHR-1). Under Contract V-A only, a
  voucher TenderLine MUST refuse with `dependency_unavailable`
  (FR-006) while offline.

### Drawer impact (amendment)

`cash` lines retain drawer-impact deferral (OQ-DRW-1..4 unchanged).
`external_card_terminal` and `internal_voucher` lines MUST NOT produce
drawer impact (they never open the till), but reconciliation reporting
on these tenders is owned by future shift-management / reporting
specs, not by 006.

---

## User Scenarios & Testing *(mandatory)*

> Each story is **independently testable as product behaviour** even though
> none can be implemented until the upstream gates clear. Stories are
> prioritised so the smallest implementable slice (when unblocked) is P1.

### User Story 1 — Take a single cash payment for an approved cart (Priority: P1)

> ⚠ **Amended 2026-05-19** — this story now describes the **cash
> variant** of the multi-tender flow. The two parallel P1 stories are
> US1 (cash) and US4 (external card terminal, record-only). US5
> (voucher) is P2 and gated on the voucher-authority contract; US6
> (split tender) is P2.

A cashier has an approved cart handed off from 005. The cashier selects
**Cash** as tender, enters the amount received, sees the change due, confirms
the payment, and the system records the payment as **settled** with one
`cash` `TenderLine`, attributes it to the signed-in cashier, and hands
off to receipts. The cart cannot be edited from this surface, and the
surface cannot be reached without an approved cart.

**Why this priority**: Cash is one of two parallel P1 tender types in
v1 (the other is `external_card_terminal` — US4). Until at least one P1
story works end-to-end (when unblocked), no later tender type, no
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

### User Story 4 — Record an external-card-terminal payment (Priority: P1, parallel to US1)

A cashier has an approved cart handed off from 005. The customer wishes
to pay by card. The cashier selects **External card terminal**, taps the
amount, completes the actual payment on the **separate physical card
terminal** (a device outside POS-Pulse), then confirms in POS-Pulse that
the external transaction succeeded. POS-Pulse records an
`external_card_terminal` `TenderLine` against the attempt; no payment
gateway is contacted; no card data of any kind is captured.

**Why this priority**: External-card-terminal is one of the three
in-scope tender types in v1 and is the only one that addresses card
payments at all in 006. Together with US1, it covers the realistic
single-tender case for the first implementation slice.

**Independent Test**: A reviewer drives an approved cart to checkout,
selects External card terminal, enters the exact amount due,
acknowledges the cashier completed the external payment, confirms,
observes a `settled` outcome with one `external_card_terminal`
`TenderLine` recorded. Audit confirms no PAN / CVV / track / cardholder
field is present.

**Acceptance Scenarios**:

1. **Given** an approved cart, **When** the cashier selects External
   card terminal and enters `amount_applied_minor ==
   envelope.subtotal_minor`, **Then** the line transitions
   `applying → applied`, the attempt may move to `settled`, and the
   audit row carries `tender_type = external_card_terminal` with no
   card data and an optional non-sensitive `external_reference`
   (subject to OQ-PLAN-5).
2. **Given** an approved cart, **When** the cashier enters
   `amount_applied_minor > remaining_balance_at_apply_time`, **Then**
   the line MUST refuse with reason `non_cash_overpayment_refused`
   (FR-010); the renderer message is generic; the cashier MAY amend
   or cancel.
3. **Given** any `external_card_terminal` line in any state, **When**
   logs / audit / Sentry are reviewed, **Then** there is **zero**
   cardholder data of any form (FR-008, Constitution P6).

### User Story 5 — Apply an internal voucher (Priority: P2, gated on voucher authority contract)

A cashier has an approved cart. The customer presents a voucher code.
The cashier selects **Voucher**, enters or scans the code, the system
validates it against the voucher authority, displays the applicable
amount (capped at `remaining_balance_at_apply_time` per OQ-PLAN-3),
and the cashier confirms application. At payment confirmation, the
voucher is **atomically redeemed**; double-redemption is prevented at
the authoritative layer.

**Why this priority**: Voucher tender is required by product but is
gated on the voucher authority contract (Contract V-A or V-B). It
MUST NOT ship before that contract; therefore P2 relative to US1 / US4
in the first implementation slice.

**Independent Test**: A reviewer drives an approved cart to checkout,
selects Voucher, enters a valid code, observes the validated
applicable amount, applies it (alone or in combination with cash /
external card terminal per US6), confirms, observes a `settled`
outcome with the voucher redeemed at the authority. A second attempt
to redeem the same voucher MUST refuse with `voucher_already_redeemed`.

**Acceptance Scenarios**:

1. **Given** an approved cart and a valid unredeemed voucher,
   **When** the cashier applies the voucher line and confirms the
   attempt, **Then** the voucher is atomically redeemed and the
   line transitions `applying → applied`.
2. **Given** a voucher previously redeemed, **When** the cashier
   attempts to apply it, **Then** validation MUST refuse with
   reason `voucher_already_redeemed`; the renderer message is
   generic; the attempt is unaffected (no `failed` outcome — the
   cashier MAY apply a different tender line).
3. **Given** the voucher authority is unreachable (Contract V-A),
   **When** the cashier attempts to apply a voucher, **Then**
   validation MUST refuse with `dependency_unavailable`; under
   Contract V-B (POS-local read-model approved), the line MAY apply
   provided the local atomic redeem succeeds.
4. **Given** any `internal_voucher` line in any state, **When**
   logs / audit / Sentry are reviewed, **Then** there is **no**
   voucher holder PII or cross-cart voucher state, only the minimised
   reference per FR-017.

### User Story 6 — Split tender (Priority: P2)

A customer wishes to pay one approved cart using **more than one
tender** — for example, part by voucher and the rest in cash, or part
by external card terminal and part in cash. The cashier applies
multiple `TenderLine`s within a single payment attempt; settlement
succeeds only when their applied amounts sum to
`envelope.subtotal_minor`.

**Why this priority**: Real-world pharmacy retail routinely combines
voucher / loyalty discounts with cash or card top-up. Without split
tender support, the cashier is forced to refuse or work around
mixed-tender customers. P2 because the single-tender cases
(US1 / US4 / US5) must work first.

**Independent Test**: A reviewer drives an approved cart, applies one
non-cash line below `subtotal_minor`, then applies a cash line for
exactly the remaining balance, confirms, observes a `settled`
outcome with two `TenderLine`s. The reviewer also exercises a
mid-attempt cancel after the first non-cash line is applied and
verifies the already-applied line is reversed per FR-006B.

**Acceptance Scenarios**:

1. **Given** an approved cart with `subtotal_minor = N`, **When** the
   cashier applies one or more non-cash `TenderLine`s totaling `M`
   (where `M < N`) and then a `cash` line with
   `amount_applied_minor == N − M`, **Then** the attempt may move to
   `settled` (per the §"Tender scope" settlement invariant).
2. **Given** an approved cart with `subtotal_minor = N`, **When** the
   cashier applies one or more non-cash `TenderLine`s totaling `M`
   (where `M < N`) and then a `cash` line with
   `amount_applied_minor > N − M`, **Then** the cash line is allowed
   to overpay; `change_due_minor = amount_applied_minor − (N − M)`
   is recorded on the cash line only.
3. **Given** an attempt with one applied non-cash line, **When** the
   cashier cancels the attempt before total applied reaches `N`,
   **Then** the applied non-cash line MUST be reversed per FR-006B,
   and no `settled` outcome is recorded.
4. **Given** an attempt with one applied non-cash line, **When** the
   cashier attempts to apply a second non-cash line whose
   `amount_applied_minor > remaining_balance_at_apply_time`,
   **Then** the second line MUST refuse with
   `non_cash_overpayment_refused`; the first line remains `applied`;
   the cashier MAY amend the second line's amount, add a different
   tender, or cancel.
5. **Given** any split-tender attempt, **When** the audit log is
   reviewed, **Then** every `TenderLine` state transition is
   recorded with operator attribution and `handoff_action_id`
   correlation; no PII or card data leaks.

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
  state per terminal at a time. Enforced by the partial unique index
  `CREATE UNIQUE INDEX … ON payment_attempts(terminal_id) WHERE state='started'`
  authored in `/speckit-plan` v1.0 §AD-2 (research §R-6); verified
  by the concurrent-start race tests `tasks.md` T084 (Slice 3
  integration) and T306 (Slice 5 multi-process race).
- **Money is integer minor units** (Constitution P-II / Principle II). No
  floats, no decimal-string arithmetic. Change due is computed as
  `cash_received_minor − total_minor` and is non-negative by construction
  (refused confirmation if it would be negative — see User Story 1 #3).
- **Refunds / returns are out of scope**. Future spec.
- **Real card processor / wallet / BNPL are out of scope.** Future
  spec(s). ⚠ **Note (amended 2026-05-19):** `external_card_terminal`
  is **record-only** and is **in scope**, but is NOT a card processor
  integration — see FR-007 / FR-008. Split tender is **in scope** —
  see FR-006B and User Story 6.
- **PII / cardholder data**: no card data of any kind is captured by 006.
  See FR-014 and FR-008.
- **Offline behaviour**: explicitly questions only — see "Offline behaviour
  questions" below.
- **Drawer impact**: explicitly questions only — see "Drawer-impact
  questions" below.

---

## Functional Requirements

> Numbering does not extend 004. 006 owns FR-001…FR-099. Forward references to
> 004 FRs cite "(004 FR-NNN)" so cross-feature dependencies are visible.

### Tender selection

- **FR-001** ⚠ **amended 2026-05-19** (see §"Tender scope (amendment
  2026-05-19)"): The payment surface MUST present a tender-selection
  step. In 006 v1, the **selectable tender types** are:
  - `cash` — always selectable;
  - `external_card_terminal` — record-only; selectable;
  - `internal_voucher` — selectable **only if** the approved voucher
    authority contract (Contract V-A or V-B per §"Voucher authority
    boundary") has shipped; otherwise reserved-but-disabled.

  Any other tender slot (wallet / BNPL / real card gateway / etc.)
  MUST be visibly reserved (so cashiers / customers / reviewers can
  see future options exist) but MUST be disabled and emit a generic
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

- **FR-004** ⚠ **amended 2026-05-19** (split-tender aware): A `cash`
  `TenderLine` MUST collect a single `amount_applied_minor` integer
  in the cart's currency, in **minor units** only (Constitution P-II).
  The UI MAY display a major-unit-formatted helper for the operator,
  but the source of truth is the integer. The cash line's role in
  settlement is governed by the §"Tender scope" settlement invariant.
- **FR-005** ⚠ **amended 2026-05-19** (split-tender aware): For a
  `cash` `TenderLine`, `change_due_minor` MUST be computed as
  `amount_applied_minor − remaining_balance_at_apply_time` and MUST
  be a non-negative integer; it MUST be `null` / absent on non-cash
  lines. When `amount_applied_minor < remaining_balance_at_apply_time`
  on the only remaining unpaid balance, confirmation MUST be refused
  generically (User Story 1 #3); the cashier MAY amend the amount, add
  another tender line, or cancel. **Cash MAY overpay**; non-cash
  tenders MUST NOT — see §"Cash overpayment vs. non-cash overpayment".

### External card terminal tender (record-only)

- **FR-007** *(new — 2026-05-19)*: An `external_card_terminal`
  `TenderLine` MUST be a **record-only** entry. POS-Pulse MUST NOT
  call any payment gateway, processor API, terminal vendor SDK, or
  third-party HTTP endpoint as part of applying or settling this
  tender. The cashier completes payment on a separate physical
  device; POS-Pulse only records that the line was applied.
- **FR-008** *(new — 2026-05-19)*: POS-Pulse MUST NOT capture,
  transmit, persist, or log any cardholder data of any kind for an
  `external_card_terminal` line — including but not limited to PAN,
  truncated PAN, CVV, magnetic-stripe / chip / contactless track data,
  cardholder name, issuer bank name, expiry date, auth payload,
  approval code, terminal-printed receipt text, or any cryptogram.
  This obligation is **non-negotiable** (FR-040, FR-026, Constitution
  P6).
- **FR-009** *(new — 2026-05-19; resolved by `/speckit-plan` v1.0
  AD-5 / research §R-5)*: An optional operator-entered
  `external_reference` field on an `external_card_terminal`
  `TenderLine` is permitted in v1 under the following normative policy:
  - **Optional.** Absence MUST be allowed.
  - **Format.** Regex `^[A-Z0-9]{0,6}$` — uppercase alphanumeric, max
    6 characters. Format constraint refuses anything PAN-shaped by
    construction.
  - **Non-sensitive.** Sourced by the cashier reading a short
    alphanumeric off the external terminal's printout to aid
    end-of-day reconciliation.
  - **Redacted from logs.** Always `*****`-redacted in Sentry,
    console, and log-file emission (Constitution §P7).
  - **Forbidden content.** MUST NOT contain PAN, truncated PAN, CVV,
    cardholder name, expiry date, auth payload, approval code, raw
    terminal-printed receipt text, issuer name, terminal receipt
    blob, cryptogram, or any value that could be used as cardholder
    data (FR-008, Constitution §P6). Client-side regex enforcement
    + main-side re-validation refuse non-conforming input as
    `invalid_input`.
- **FR-010** *(new — 2026-05-19)*: An `external_card_terminal`
  `TenderLine` MUST refuse with reason `non_cash_overpayment_refused`
  if `amount_applied_minor > remaining_balance_at_apply_time`. The
  refusal copy at the renderer remains generic (FR-022, NFR-003).

### Internal voucher tender (authority-validated)

- **FR-015** *(new — 2026-05-19)*: An `internal_voucher` `TenderLine`
  MUST be **validated** against the voucher authority **before** it
  is applied to the payment attempt. Validation MUST return either
  a positive applicable amount and a non-sensitive redemption-intent
  token bound to the payment attempt, or a refusal reason drawn from
  the closed set: `voucher_not_found`, `voucher_expired`,
  `voucher_cancelled`, `voucher_already_redeemed`,
  `voucher_tenant_mismatch`, `voucher_branch_mismatch`,
  `dependency_unavailable`. Each refusal reason maps to a generic
  renderer-facing message; structured reason lives in the audit
  event only (FR-022, NFR-003).
- **FR-016** *(new — 2026-05-19)*: A validated `internal_voucher`
  `TenderLine` MUST be **redeemed atomically** at payment confirmation
  by the voucher authority. **Double-redemption MUST be prevented at
  the authoritative layer.** If redemption fails at confirm time, the
  attempt MUST resolve to `failed` with reason
  `voucher_already_redeemed` (the canonical failure category) or
  `dependency_unavailable`; no `TenderLine` may move to `applied`
  state until redemption succeeds.
- **FR-017** *(new — 2026-05-19; resolved by `/speckit-plan` v1.0
  AD-7 / research §R-7)*: The renderer's view of voucher state is
  **minimised** to the following normative shape:
  - **NEVER crosses the bridge to the renderer:**
    `voucher_redemption_intent_token` (short-lived intent token from
    the voucher authority — main-process only); voucher-balance
    authority data; voucher-issuance metadata; loyalty-program
    internals; voucher holder PII; voucher-side cross-cart state;
    raw authority response payload.
  - **MAY cross the bridge** (post-redeem only): a single
    `voucher_authority_redemption_id` — an opaque, non-sensitive
    short string returned by `vouchers.redeem` that the renderer
    MAY display as a redacted receipt-correlation reference. The
    identifier MUST NOT encode voucher balance, voucher code, or
    holder identity. Pre-redeem (validate-only stage), the renderer
    sees only the applied amount and a generic "voucher applied"
    indicator.
  - Sensitive voucher state stays main-process side
    (Constitution §III / §P7).
- **FR-018** *(new — 2026-05-19)*: POS-Pulse MUST NOT implement
  voucher issuance, voucher cancellation, voucher balance editing,
  voucher catalogue management, or loyalty-campaign behaviour in
  this feature. Those belong to **Data-Pulse-2 / SmartDataPulse
  backend**. POS-Pulse only **redeems** vouchers via the approved
  contract (Contract V-A or V-B per §"Voucher authority boundary").

### Payment-attempt lifecycle

- **FR-006** ⚠ **amended 2026-05-19** (multi-tender failure reasons):
  A payment attempt MUST traverse a deterministic state machine with
  these states: `idle → started → (settled | cancelled | failed |
  force_failed)`. `idle` is **conceptual** — the pre-insert renderer
  pre-attempt state (no row exists in `payment_attempts` yet); the
  first persisted row is always inserted in `state='started'` by
  `payments.start` (`data-model.md` §"PaymentAttempt" Invariant 1).
  `force_failed` is a Slice 4 transition (FR-021 / plan §AD-5).
  Once any terminal state is reached, the attempt MUST NOT return to
  `started`. Each terminal transition MUST record:
  - the operator identity (FR-013, inherited from 004 FR-001 / FR-013);
  - a UTC timestamp;
  - a structured outcome (`settled` / `cancelled` / `failed`);
  - for `failed`, a reason category drawn from the closed set:
    `cart_lost`, `operator_session_terminated`,
    `dependency_unavailable`, `internal_error`, `stale_handoff`,
    `tender_underpaid`, **`non_cash_overpayment_refused`**,
    **`voucher_not_found`**, **`voucher_expired`**,
    **`voucher_cancelled`**, **`voucher_already_redeemed`**,
    **`voucher_tenant_mismatch`**, **`voucher_branch_mismatch`**,
    **`split_tender_rollback`** (last eight added 2026-05-19 by the
    tender-scope amendment). The category is structured data on the
    audit event; the renderer-facing copy MUST remain generic and
    non-disclosing (FR-022, NFR-003).

- **FR-006A** *(new — 2026-05-19)* — **TenderLine FSM**: each
  `TenderLine` within a payment attempt MUST traverse a deterministic
  state machine: `applying → (applied | refused)`. An `applied` line
  MAY be transitioned to `reversed` only as part of split-tender
  rollback under FR-006B or as part of overall attempt cancellation;
  a `refused` line is terminal and MUST NOT be re-applied (the
  cashier MUST add a new line instead). Every state transition emits
  a per-line audit event under 004 FR-025 / FR-026 with operator
  attribution.

- **FR-006B** *(new — 2026-05-19)* — **Split-tender ordering and
  rollback**: when more than one `TenderLine` is applied within a
  payment attempt, the attempt MUST process them in the order the
  cashier applied them. If any subsequent line refuses, fails to
  validate, or the cashier cancels before total applied reaches
  `envelope.subtotal_minor`, **already-applied non-cash lines MUST
  be reversed** to a defined safe state:
  - `cash` lines: returned to the cashier; line transitions to
    `reversed`; no till impact recorded (drawer impact remains under
    OQ-DRW-1..4 deferral).
  - `external_card_terminal` lines: line transitions to `reversed`;
    a `payment.external_card.reversed` audit event records that the
    cashier MUST manually void on the external terminal (POS-Pulse
    has no API into the terminal).
  - `internal_voucher` lines: **MUST be reversed at the voucher
    authority** (the redemption intent is consumed or refunded per
    the voucher contract). If the authority is unreachable, the line
    transitions to `reversal_pending` and a deferred-reversal audit
    event is emitted; this is a `dependency_unavailable` failure of
    the rollback path.

  Detailed rollback ordering, idempotency keys, and the
  `reversal_pending` resolution path are deferred to `/speckit-plan`
  (OQ-PLAN-4).

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
- **FR-021** *(resolved by `/speckit-plan` v1.0 AD-5)*: Force-failing
  a payment attempt (e.g., to break a stuck attempt during incident
  response) MUST be a **manager- or admin-only** action under 004
  FR-024 / FR-025 / FR-026 conventions, and MUST emit a dedicated
  `payment.force_failed` audit event with dual attribution (the
  cashier whose attempt was force-failed AND the manager/admin
  actor). The mechanism is a **dedicated manager / admin incident-
  response surface in Slice 4** (analogous to 004 S5's
  `force_close_shift` / `unlock_cashier` / `reset_cashier_pin`
  pattern); it is **NOT** inline manager re-auth on the cashier
  surface. **Manager identity MUST NEVER be echoed to cashier-
  visible UI**; it lives in the audit payload and the manager
  surface only. Main-process role gate is primary (Constitution
  §III); the renderer route guard is secondary UX defence only.
- **FR-022**: Reaching the payment surface without an approved cart MUST
  be refused at the **information layer** (004 FR-019 / AD-1) — the
  surface MUST NOT render even briefly, the bridge call (when defined)
  MUST refuse generically, and audit-event emission MUST NOT disclose
  the cart's absence (so reviewers cannot probe for cart state via
  payment-surface telemetry).

  > **004 FR-019 inheritance (informational one-line summary):**
  > 006 inherits 004's information-layer refusal behaviour: renderer-
  > facing copy on a refused sensitive action remains generic; the
  > diagnostic `reason` / `category` lives in the bridge response
  > payload and audit-event payload only; it is never echoed verbatim
  > to the cashier-visible UI. The contract test in `tasks.md` T070
  > asserts every bridge `reason` enum maps to generic renderer copy
  > per `quickstart.md` §"Generic refusal UX".

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

- **FR-040** ⚠ **amended 2026-05-19**: 006 MUST NOT capture,
  transmit, or persist raw card data, raw PAN, raw CVV, magnetic-stripe
  / chip / contactless track data, cardholder name, expiry date,
  auth payload, approval code, terminal-printed receipt text, or any
  cryptogram. **Real card processor / payment-gateway integration,
  wallets, and BNPL are deferred** to later, explicitly scoped
  feature(s). `external_card_terminal` is **record-only** and is **in
  scope** as defined in FR-007–FR-010; **split tender is in scope**
  as defined in FR-006B and User Story 6; **internal voucher
  redemption is in scope** as defined in FR-015–FR-018 and User
  Story 5, gated on the §"Voucher authority boundary" contract.
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
- **OQ-OFF-EXT-1** *(new — 2026-05-19)*: How does an
  offline-recorded `external_card_terminal` `TenderLine` reconcile
  with Data-Pulse-2 / shift-management when the terminal returns
  online? Owned by the future reconciliation review, not by 006.
- **OQ-OFF-VCHR-1** *(new — 2026-05-19)*: Under Contract V-A
  (backend-authoritative), an `internal_voucher` `TenderLine`
  refuses with `dependency_unavailable` while offline. Under
  Contract V-B (POS-local read-model approved), local atomic
  redeem MAY proceed, but the local-vs-authority reconciliation
  contract and conflict resolution are deferred to the dedicated
  voucher-authority contract review.

These questions are non-binding on this draft. Resolution is required
before any implementation slice that touches offline cash settlement
or offline voucher / external-card-terminal behaviour.

---

## `/speckit-plan` open questions (added 2026-05-19 by tender-scope amendment)

> The following are **explicit `/speckit-plan` decisions** raised by the
> tender-scope amendment. They are NOT resolved by this spec; they MUST
> be resolved in `/speckit-plan` v1.0 alongside AD-DEFERRED-1..6.

- **OQ-PLAN-1**: **Payment attempt + TenderLine persistence model.**
  Does 006 introduce local SQLite tables for payment attempts and
  tender lines (mirroring 005's `carts` + `cart_action_outbox`
  pattern), or does the existing 004 `audit_events` table alone
  carry sufficient mid-flight state? If new tables, what is the
  minimum schema, and which migration slice authors them? **Note**:
  the tender-scope amendment makes this load-bearing — split-tender
  rollback (FR-006B) requires queryable mid-flight state that
  `audit_events` alone cannot represent efficiently.

- **OQ-PLAN-2**: **Bridge-API namespace for `payments.*` /
  `tender.*` / split-tender handlers.** Single `payments.*`
  namespace covering attempt + per-line operations, or split into
  `payments.*` (attempt-level) and `tender.*` (per-line)? What
  handlers does v1 require (`payments.start`, `payments.confirm`,
  `payments.cancel`, `tender.apply`, `tender.reverse`, etc.)?
  Idempotency-key strategy across multi-line apply / reverse?

- **OQ-PLAN-3**: **Partial voucher redemption.** When a voucher's
  authoritative remaining balance exceeds
  `remaining_balance_at_apply_time`, does the cashier apply the
  full `remaining_balance_at_apply_time` (residual voucher value
  preserved at the authority) or refuse the voucher line entirely
  (`non_cash_overpayment_refused`)? Whose responsibility is residual-
  voucher reconciliation if partial redemption is allowed —
  POS-Pulse or Data-Pulse-2? Answer must be consistent with the
  voucher-authority contract (V-A or V-B per OQ-PLAN-7).

- **OQ-PLAN-4**: **Split-tender ordering and rollback semantics.**
  What is the exact ordering invariant when applying multiple
  `TenderLine`s (strict cashier-order vs. apply-then-pin-on-confirm)?
  What is the rollback idempotency strategy when a previously-applied
  non-cash line must be reversed (FR-006B)? How is
  `reversal_pending` resolved if the voucher authority is unreachable
  during rollback?

- **OQ-PLAN-5**: **External card reference field policy.** Does the
  optional `external_reference` field on `external_card_terminal`
  `TenderLine`s exist at all in v1? If yes: max length, charset,
  format validation, redaction-in-logs rule, and presence in audit
  events. If no: what reconciliation hook does v1 offer instead?
  See FR-009.

- **OQ-PLAN-6**: **Idempotency and double-settlement prevention.**
  Beyond per-line idempotency keys (OQ-PLAN-2), what attempt-level
  guarantee prevents a stuck `started` attempt from being concurrently
  confirmed twice? Likely solved by the partial unique index
  `WHERE state='started'` pattern (mirroring 005's
  `WHERE state='started'` if 005 uses one), but the exact constraint
  shape is a `/speckit-plan` decision.

- **OQ-PLAN-7**: **Voucher validation/redeem contract — V-A or V-B.**
  Backend-authoritative (Contract V-A: Data-Pulse-2 endpoint pair
  wrapped in `vouchers.validate` / `vouchers.redeem` POS-Pulse
  bridge handlers, network-required) or POS-local read-model
  (Contract V-B: replicated balance + local atomic redeem, approved
  by Data-Pulse-2)? Which sensitive voucher fields cross the
  bridge to the renderer (FR-017)? Which audit-event fields are
  redacted? **No `internal_voucher` line may ship until OQ-PLAN-7
  resolves.**

- **OQ-PLAN-8**: **Receipt handoff payload fields.** When a
  multi-tender attempt settles, what tender-line summary crosses
  to the (future) receipts spec? Per-line tender_type + applied
  amount only, or also non-sensitive references (e.g., voucher
  short-code redacted, external-card-terminal reference if
  OQ-PLAN-5 allows it)? Receipt rendering remains receipts-spec
  territory; this OQ only locks the payload **shape**, not the
  rendering. See FR-031.

- **OQ-PLAN-9** *(carried forward as drawer-preservation question)*:
  **Drawer-impact data to preserve, calculations deferred.** 006
  emits `payment.settled` audit events with `tender_type` per line.
  Does the audit payload carry enough information for the future
  shift-management spec to compute drawer expected total, or does
  006 need to emit a separate structured `drawer.cash_delta` event?
  Drawer calculations remain shift-management territory (FR-042).

These questions are non-binding on this draft. Resolution is required
in `/speckit-plan` v1.0 before any 006 implementation slice may begin.

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

## Non-Goals (explicit) ⚠ amended 2026-05-19

This list is **normative**: any task that drifts into a non-goal MUST be
filed as a separate feature, not folded into 006.

- ❌ Cart editing or cart-side UI of any kind.
- ❌ Receipts implementation (rendering, printing, retention).
- ❌ Inventory mutation, stock movement, FEFO logic.
- ❌ Reports, KPIs, dashboards, analytics surfaces.
- ❌ Shift financial calculations (expected total, variance, shortage,
     overage, drawer reconciliation).
- ❌ **Real card processor / payment-gateway integration** (Visa / MC /
     processor APIs / terminal vendor SDKs). The in-scope
     `external_card_terminal` tender is **record-only**, NOT a
     gateway integration — see FR-007 / FR-008.
- ❌ **Storing card data of any kind** (PAN, truncated PAN, CVV,
     track data, cardholder name, expiry, auth payload, approval code,
     terminal-printed receipt text, cryptograms — see FR-008 / FR-040).
- ❌ **Voucher issuance, voucher cancellation, voucher catalogue
     management, loyalty-campaign engines, voucher-balance editing.**
     Those belong to Data-Pulse-2 / SmartDataPulse backend (FR-018).
     POS-Pulse only **redeems** vouchers via the approved authoritative
     contract.
- ❌ **Voucher UI for issuance / cancellation / balance lookup.** Those
     surfaces, if they exist, are Data-Pulse-2-led future features.
- ❌ Refunds or returns (positive and negative).
- ❌ Backend / API implementation for payments (any new OpenAPI surface
     is owned by a later, explicitly scoped feature).
- ❌ Database migrations.
- ❌ Codegen runs (`npm run codegen:api`).
- ❌ UI implementation (no `src/renderer/**`, no `src/main/**`, no
     `src/preload/**`, no `src/shared/**` changes from this spec).
- ❌ UI polish (Impeccable / design-token / visual-direction work
     remains gated under §A1).
- ❌ Data-Pulse-2 changes of any kind.

---

## Success Criteria (live; promoted 2026-05-19 by /speckit-analyze remediation)

> Promoted from "deferred sketches" to **live, measurable, testable**
> success criteria. The three original sketches (SC-001/SC-002/SC-003)
> remain valid in product wording and are restated below; three new
> cross-cutting criteria (SC-COV, SC-REDACTION,
> SC-SETTLEMENT-INVARIANT) lock the coverage/redaction/invariant
> guarantees that `/speckit-plan` v1.0 and `/speckit-tasks` already
> committed to.

- **SC-001** (P1, US1/US4 path): A cashier can settle a single
  payment for an approved cart using `cash` or `external_card_terminal`
  and observe a `settled` outcome with operator attribution, a
  settled-at UTC timestamp, the `envelope.handoff_action_id` as the
  cross-feature correlation key, and the cart consumed for further
  payment. **Measurable**: Slice 3 integration test `T161`
  (end-to-end attempt lifecycle through all three SQLite tables);
  Slice 3 verification `T160` coverage floors.
- **SC-002** (P2, US2 path): A cashier can cancel a `started`
  payment before settlement; no `settled` record is produced; a
  `payment.cancelled` audit event is recorded with operator
  attribution; the bound `PaymentIntentEnvelope v1` remains
  immutable and the surface returns to tender selection per
  `/speckit-plan` v1.0 §AD-4. **Measurable**: Slice 3 unit tests
  `T081`, `T102`, `T135`; concurrent-start prevention verified by
  `T084` (Slice 3 integration) and `T306` (Slice 5 multi-process
  race).
- **SC-003** (P3, US3 path): A forced failure condition (operator
  session terminated, cart lost, dependency unavailable, etc.)
  resolves the attempt to `failed` with a non-shaming, non-
  disclosing renderer message and a `payment.failed` audit event
  carrying one of the 14 closed FR-006 reason categories.
  **Measurable**: Slice 3 unit tests `T082` (failure-reason
  coverage), `T104` (`payments.discardOnSessionEnd`); generic
  refusal copy mapping verified by `T070` contract test.
- **SC-COV** (cross-cutting): Coverage floors from
  `/speckit-plan` v1.0 §"Test Strategy" MUST hold at Slice merge
  time and at production rollout:
  - **≥ 95 %** on money-math, `PaymentAttempt` FSM, `TenderLine`
    FSM, audit-event emitter, idempotency-replay helper, all
    `payments.*` / `tender.*` / `vouchers.*` bridge handlers,
    voucher V-A client.
  - **≥ 90 %** on the renderer payment surface.

  **Measurable**: Slice 2 `T050`, Slice 3 `T160`, Slice 4 `T295`,
  Slice 5 `T300` (full-suite coverage audit).
- **SC-REDACTION** (cross-cutting): No PII, cardholder data of any
  form (PAN/CVV/track/cardholder name/expiry/auth payload/approval
  code/terminal receipt text/cryptogram), voucher secret
  (`voucher_redemption_intent_token`), authority token, raw envelope
  payload, PIN, password, JWT, device token, attestation, or
  credential MUST appear in any log sink (Sentry, console, log
  file) or in any renderer-visible UI surface. `external_reference`
  MUST be redacted to `*****` in every log sink. **Measurable**:
  Slice 3 audit-emitter tests `T093` / `T094`; Slice 4 voucher
  redaction test `T214`; Slice 5 redaction audit `T301`; Slice 5
  security-review packet `T302`.
- **SC-SETTLEMENT-INVARIANT** (cross-cutting): A payment attempt
  may transition to `settled` only when the canonical settlement
  invariant holds:

  ```text
  Σ (TenderLine.amount_applied_minor − COALESCE(TenderLine.change_due_minor, 0))
  WHERE TenderLine.state = 'applied'
      == envelope.subtotal_minor
  ```

  This is the exact expression evaluated by the Slice 3 confirm
  transaction (`data-model.md` §"PaymentTenderLine" Invariant 5).
  **Measurable**: Slice 3 unit test `T080` (settlement happy path),
  property test `T163` (vitest + fast-check fuzz across random
  tender-line mixes; `Number.isSafeInteger` guard on every running
  sum); Slice 3 integration test `T161`.
- **SC-AUDIT** (cross-cutting): Every state transition
  (`payment.{settled,cancelled,failed,force_failed}`,
  `tender.{applied,refused,reversed,reversal_pending}`) MUST emit
  exactly one canonical audit event under 004 FR-025 / FR-026 /
  FR-028, with operator attribution, with the
  `envelope.handoff_action_id` correlation key where applicable,
  with **zero** PII / card-data / voucher-secret leakage.
  **Measurable**: Slice 3 audit-emitter tests `T092` / `T093` /
  `T094`; Slice 4 voucher audit tests `T221` / `T222`; Slice 4
  force-fail audit test `T241`.

**SC scope note.** SC-001..SC-003 are story-level acceptance
criteria; SC-COV / SC-REDACTION / SC-SETTLEMENT-INVARIANT / SC-AUDIT
are cross-cutting quality gates. All six are **live and testable
now**; their implementation is gated only by the per-slice §A1–§A5
sign-offs.

---

## Review & Approval

| Item | State |
|:--|:--|
| Status banner | DRAFT — BLOCKED |
| 004 S4/S5 visibility boundaries complete? | ✅ complete 2026-05-14 |
| 005-sales-cart spec approved? | ✅ approved 2026-05-14; T100 sign-off 2026-05-19 |
| Cart ↔ payments handoff contract pinned (in 005)? | ✅ `PaymentIntentEnvelope v1` ratified 2026-05-17 |
| `/speckit-clarify` rerun after upstream features close? | ✅ applied 2026-05-19 (FR-002, FR-006, FR-030, FR-031 resolved; OQ-005-1..4 reconciled) |
| Tender-scope amendment (cash + external_card_terminal + internal_voucher + split tender) | ✅ applied 2026-05-19 — supersedes cash-only assumption recorded by PR #183; see §Clarifications "Session 2026-05-19 — Tender scope amendment" |
| `/speckit-plan` v1.0 (resolves AD-DEFERRED-1..6 **and OQ-PLAN-1..9** from tender-scope amendment) | ❌ deferred — next required step |
| Visual-direction Slice 0 commissioned? | ❌ deferred (gated on §A1 below) |
| Voucher-authority contract (V-A or V-B per §"Voucher authority boundary") | ❌ deferred — gated on OQ-PLAN-7; no `internal_voucher` ships before this clears |

**Implementation is not authorised by this document.** See
[./coordination.md](./coordination.md) for the gate ledger.
