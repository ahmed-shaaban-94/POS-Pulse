> ## STATUS: DRAFT — BLOCKED — NOT APPROVED FOR IMPLEMENTATION
>
> Plan **v1.0** authored 2026-05-19 against the tender-scope amendment
> (PR #184). Resolves **AD-DEFERRED-1..6 and OQ-PLAN-1..9**. Supersedes
> plan v0.1 (cash-only premise). Implementation remains **blocked**:
> `/speckit-tasks` must produce a startable, file-path-bearing task list
> against this plan; `/speckit-analyze` must clear cross-artifact
> consistency; per-slice approval gates §A1–§A5 remain ⛔ held; no code,
> no migrations, no bridge code, no UI is authorised by this file.
>
> **Pipeline state:** 004 S4/S5 ✅ · 005 spec + T100 ✅ ·
> `PaymentIntentEnvelope v1` ✅ · `/speckit-clarify` ✅ ·
> tender-scope amendment ✅ · **`/speckit-plan` v1.0 ✅ this file** ·
> `/speckit-tasks` ❌ next required step.

# Implementation Plan: Payments & Tender

**Feature ID:** 006-payments-tender
**Spec:** [./spec.md](./spec.md)
**Plan Version:** **1.0** (authored 2026-05-19, supersedes v0.1)
**Created:** 2026-05-09 · **v1.0 authored:** 2026-05-19
**Constitution version pinned:** v1.5.1
**Branch (this PR):** `docs/006-speckit-plan-v1`
**Branch (future implementation):** `006-payments-tender` (not yet created)
**Companion artefacts (all in this PR):**

- [./research.md](./research.md) — Phase 0 rationale + alternatives for every AD/OQ
- [./data-model.md](./data-model.md) — `payment_attempts` + `payment_tender_lines` + `payment_action_outbox` tables
- [./quickstart.md](./quickstart.md) — happy-path / cancel / fail / split walkthrough preview
- [./contracts/bridge-api.md](./contracts/bridge-api.md) — DRAFT `payments.*` / `tender.*` bridge namespace (NOT APPROVED; §A4 review required)

---

## Summary

006-payments-tender lays down the rule + persistence + bridge-contract
layer that runs once an approved checkout-ready cart (owned by 005) is
handed to the POS shell as a frozen `PaymentIntentEnvelope v1`. The
2026-05-19 tender-scope amendment lifted scope from "cash only" to
**three tender types** (`cash`, `external_card_terminal` record-only,
`internal_voucher` authority-validated) **plus split tender**. This
plan locks the v1.0 architecture against that amended scope.

Plan v0.1 (cash-only) is **superseded** by this revision. The prior
cash-only WIP from a former session remains preserved in
`stash@{0}` on branch `docs/006-speckit-plan` and is NOT applied
into this branch (see [./coordination.md](./coordination.md)
§"Tender-scope amendment — Session 2026-05-19" reconciliation note).

---

## Technical Context (locked)

| Area | v1.0 decision | Reference |
|:--|:--|:--|
| Runtime / packaging | Electron 40 + React 19 + Vite 8 + TS 5 strict + Tailwind 4 (inherits 001/004/005). | Constitution §I |
| Money semantics | **Integer minor units only.** `Number.isSafeInteger` guarded. ≥ 95% coverage on any money-math module. | Constitution §II / P-II; spec NFR-001 |
| Identity | 004 Clerk-backed operator-session identity; never the device token, never the cashier PIN record. | Spec FR-013 / FR-014; 004 AD-2 |
| FSM ownership | **Main process** owns `PaymentAttempt` FSM, `TenderLine` FSM, validation, settlement / cancel / fail / force-fail transitions, audit emission, idempotency replay, and trust boundary. Renderer is display + input only. | AD-1 below; Constitution §III |
| Persistence | **Three new local SQLite tables** authored under §A3 in Slice 3: `payment_attempts` (mutable header), `payment_tender_lines` (mutable per-line), `payment_action_outbox` (append-only). Plus extension of 004's `audit_events` catalogue with `payment.*` + `tender.*` categories. | AD-2 + OQ-PLAN-1 below; [./data-model.md](./data-model.md) |
| Bridge surface | **DRAFT** `payments.*` (attempt-level) + `tender.*` (per-line) namespaces — see [./contracts/bridge-api.md](./contracts/bridge-api.md). §A4 review required before Slice 3 ships. Refusal envelope mirrors 005's `{ kind: 'refused', reason: '...' }` field name (see [./research.md](./research.md) R-2 for the 004-vs-005 reconciliation). | OQ-PLAN-2 below |
| Idempotency | Client-generated UUID v4 `action_id` per intended operation, persisted to `payment_action_outbox`. Bridge replays identical-payload retries as no-op; payload-mismatch → generic refusal `idempotency_payload_mismatch`. | OQ-PLAN-2 + OQ-PLAN-6 below |
| Double-settlement prevention | Partial unique index `CREATE UNIQUE INDEX … ON payment_attempts(terminal_id) WHERE state='started'` (006-specific design — 005 chose application-layer enforcement; 006 is per-terminal hardware-coupled, see [./research.md](./research.md) R-6). | OQ-PLAN-6 below |
| Voucher authority | **Contract V-A — Backend-authoritative** chosen for the v1 planning stance: `vouchers.validate` / `vouchers.redeem` bridge handlers backed by future Data-Pulse-2 endpoints. V-B (POS-local read-model) remains an approved fallback only if Data-Pulse-2 explicitly grants the authority. Until V-A or V-B ships, `internal_voucher` slot is reserved-but-disabled. | AD-7 + OQ-PLAN-7 below |
| OpenAPI | **No new POS-Pulse OpenAPI surface for Slices 1–3** (cash + external_card_terminal + split-tender framework). §A2 records a no-op for these. **Slice 4 (voucher)** introduces a Data-Pulse-2 OpenAPI surface and a POS-Pulse codegen run; §A2 must commission before Slice 4 lands. | AD-8 + OQ-PLAN-7 below |
| Codegen | Not invoked by Slices 1–3. Invoked by Slice 4 voucher path under §A2. | n/a for Slices 1–3 |
| Tests | Vitest only (Constitution §VI). Test-first per Constitution §VI; ≥ 95% coverage on money-math, FSM, and audit-emission modules; ≥ 90% on renderer payment surface. | Spec NFR-001 / test strategy below |
| CI | No workflow changes from this plan; the existing `codegen:verify → typecheck → lint → test → package:dir` pipeline gates this feature when implementation begins. | n/a |
| UI / Impeccable | **§A1 visual direction remains ⛔ held.** Slice 0 (visual direction) must commission before any renderer code lands. No CSS/JSX/token/screenshot/visual-asset changes from this plan. | spec FR-001 / FR-022 / NFR-004 |

**No NEEDS CLARIFICATION markers remain in this plan.** Every
AD-DEFERRED-1..6 + OQ-PLAN-1..9 is resolved below; rationale lives in
[./research.md](./research.md).

---

## Hard non-implementation boundaries

This plan adds the following normative boundaries on top of those
already locked by [./spec.md](./spec.md) §"Non-Goals":

- **No cart logic.** Cart shape, cart edits, cart totals, line items,
  cart persistence — all owned by 005. 006 consumes only the frozen
  `PaymentIntentEnvelope v1`.
- **No receipts logic.** Rendering, printing, retention — owned by
  future receipts spec. Slice 5 emits the receipt-handoff payload
  (OQ-PLAN-8) but does NOT render or print.
- **No inventory mutation.** Owned by future inventory spec.
- **No shift financial maths.** Drawer reconciliation, expected
  total, variance, shortage, overage — owned by future
  shift-management spec. 006 emits sufficient tender-breakdown
  signal in `payment.settled` events for that future consumer
  (OQ-PLAN-9).
- **No real card processor / payment-gateway integration.** Visa /
  Mastercard / processor APIs / terminal vendor SDKs / wallets /
  BNPL — all permanently out of scope for 006. `external_card_terminal`
  is **record-only** by construction (FR-007 / FR-008).
- **No cardholder data of any kind.** PAN, truncated PAN, CVV, track
  data, cardholder name, expiry, auth payload, approval code,
  terminal-printed receipt text, cryptograms — never captured,
  transmitted, persisted, or logged (FR-008, Constitution §P6).
- **No voucher issuance / cancellation.** Owned by Data-Pulse-2. POS
  only redeems via Contract V-A or V-B (FR-018).
- **No refunds / returns.** Future spec.
- **No backend / API implementation** beyond the voucher contract.
- **No migrations** in this PR. Migration files for the three new
  tables are authored under §A3 in Slice 3 of the future
  implementation branch.
- **No** `npm run codegen:api` from this PR.
- **No `src/**` source changes** from this plan.
- **No Data-Pulse-2 changes.** This is a POS-Pulse desktop plan only.

Any task that drifts into the above MUST be filed as a separate feature.

---

## Architectural Decisions (LOCKED in v1.0)

> AD-1..AD-8 below resolve the six AD-DEFERRED items inherited from
> plan v0.1 **plus** the additional architectural questions raised
> by the tender-scope amendment. Each AD carries a one-paragraph
> decision summary; the alternatives considered are in
> [./research.md](./research.md).

### AD-1 — Payment FSM ownership: main process (LOCKED)

**Decision.** The main process owns the `PaymentAttempt` FSM, the
`TenderLine` FSM, all transition validation, all settlement / cancel /
fail / force-fail logic, all `audit_events` emission for `payment.*` and
`tender.*` categories, all idempotency replay logic, all trust-boundary
enforcement (`requireOperatorSession`, role gating), and all voucher
authority calls (Contract V-A) or local atomic redeems (Contract V-B).

The renderer is **untrusted by construction**: it owns display, input
collection, and optimistic UI only. The renderer is never trusted for
role, totals, FSM transitions, audit attribution, voucher validation,
voucher redemption, idempotency, or settlement.

**Why.** Constitution §III (NON-NEGOTIABLE Electron process-boundary
discipline) + spec §FR-022 (information-layer enforcement). Mirrors
005's AD-1 and 004's AD-1. Centralising FSM in main also gives us
process-restart survival via SQLite, which the renderer cannot
provide.

**Resolves:** AD-DEFERRED-1.

### AD-2 — Persistence: three new SQLite tables (LOCKED)

**Decision.** Author **three new local SQLite tables** under §A3 in
Slice 3 of the future implementation branch:

| Table | Role | Mutability |
|:--|:--|:--|
| `payment_attempts` | Lifecycle header (one row per attempt). | Mutable through bridge handlers; terminal in `settled` / `cancelled` / `failed` / `force_failed`. |
| `payment_tender_lines` | Per-line state (one row per `TenderLine` in an attempt). | Mutable through bridge handlers; terminal in `applied` / `refused` / `reversed` / `reversal_pending`. |
| `payment_action_outbox` | Append-only history of every payment-mutating action. | Append-only (UPDATE / DELETE denied by trigger). |

Plus **four new audit-event categories** that extend 004's `audit_events`
table (no new audit table; 004's is the audit sink):

- `payment.settled`
- `payment.cancelled`
- `payment.failed`
- `payment.force_failed`

Plus **per-line audit categories** for the TenderLine FSM:

- `tender.applied`
- `tender.refused`
- `tender.reversed`
- `tender.reversal_pending` *(deferred-reversal signal)*

**Why.** `audit_events` alone is structurally insufficient for the
amended scope:

1. **Mid-flight state.** A `started` attempt with two `applying`
   tender lines is mutable while the cashier types and the voucher
   authority validates. Append-only audit rows cannot represent a
   mutable header without O(N) reconstruction scans.
2. **Split-tender rollback (FR-006B).** Reversing an `applied`
   non-cash line requires *queryable, indexed* per-line state; an
   audit-log reconstruction would scan every per-attempt history on
   every cancel.
3. **Restart survival.** A POS terminal that crashes mid-attempt
   must rehydrate the attempt + every applied line, including the
   `reversal_pending` flag for any unfinished voucher reverse.
   Audit-event replay on every boot is unacceptable latency.
4. **Idempotency replay (OQ-PLAN-6).** Looking up `action_id` in an
   indexed outbox is O(log N); scanning the audit table is O(N).

Migration sequencing: the three tables are authored *before* any
bridge code that writes them (Slice 3 task ordering). No migration
files are authored by this PR.

**Resolves:** AD-DEFERRED-2, OQ-PLAN-1.

### AD-3 — Bridge namespace: split `payments.*` + `tender.*` (LOCKED)

**Decision.** Two complementary bridge namespaces:

- **`payments.*`** — attempt-level (one operation per call): `start`,
  `confirm`, `cancel`, `forceFail` *(Slice 4)*, `subscribe`, `read`,
  `discardOnSessionEnd` *(internal, main-process-only)*.
- **`tender.*`** — per-line: `apply`, `reverse`, `read`.

A single handler per intended product behaviour, never overloaded.
Every mutating handler accepts a client-generated UUID v4
`idempotency_key`; every handler self-gates with
`requireOperatorSession`; every refusal envelope is the **005-style
`{ kind: 'refused', reason: '...' }`** with a closed reason set.

The 004 contract uses `category` for the same field; 006 follows the
005 pattern because (a) 005 is the closer structural template
(cart → payment is one feature-pair), (b) `reason` reads more naturally
for per-action diagnostics, and (c) renderer translation logic is
identical either way. See [./research.md](./research.md) R-2.

**Why split, not unified.** Split-tender attempts call `tender.apply`
N times for one `payments.start`. A unified namespace would either
require an `apply` array on `payments.start` (forcing the entire
multi-line UX to a single transaction) or rename `payments.applyLine`
which conflates the two concepts in the audit catalogue. Split keeps
the audit-event categories aligned 1:1 with the bridge calls.

**Resolves:** AD-DEFERRED-3 (cancel UX target — see AD-4 below for
the UX detail), OQ-PLAN-2.

### AD-4 — Cashier cancel UX target (LOCKED)

**Decision.** On cashier-initiated `payments.cancel`:

1. The main process reverses every applied `TenderLine` per the
   tender-specific rules in FR-006B (cash → returned, no till
   impact; external_card_terminal → `payment.external_card.reversed`
   with manual-void note; voucher → authority-side reverse with
   `reversal_pending` fallback).
2. The attempt transitions to `cancelled`.
3. The bound `PaymentIntentEnvelope v1` remains **immutable and
   re-runnable** (the envelope is frozen per 005 §"Immutability
   guarantees").
4. The renderer transitions back to **tender selection** with the
   envelope still bound (not back to a separate handoff state, not
   out to the 005 cart-edit surface).
5. Renderer copy is generic: *"Payment cancelled. You can take
   payment again."* No reason category exposed to the cashier.

**Why "back to tender selection" rather than "exit to handoff state".**
The envelope is unchanged; the cashier almost always retries with a
different tender mix. Forcing them through 005 again adds a click for
no product benefit. Mirrors the 004 takeover/sign-out UX pattern:
land the user back at the closest actionable surface.

**Resolves:** AD-DEFERRED-3, OQ-PLAN-4 (cancel UX portion).

### AD-5 — Force-fail UX: dedicated manager surface in Slice 4 (LOCKED)

**Decision.** Force-fail (FR-021) is a **dedicated manager / admin
incident-response surface** in **Slice 4**, not inline manager re-auth
on the cashier surface. The force-fail handler is `payments.forceFail`
under `payments.*`; main-process role gate is primary (matches AD-1);
renderer route guard is secondary UX only; the cashier-visible UI
never echoes the manager's identity.

The force-fail surface is not commissioned in Slices 1–3; it sits
behind a feature flag (default off) until Slice 4 §A1 visual-direction
review approves the manager-only screen.

**Why dedicate, not inline.** 004 S5 established the manager-only
surface pattern (`force_close_shift`, `unlock_cashier`, `reset_cashier_pin`).
Force-fail is an incident-response action analogous to `force_close_shift`,
not a sign-in flow. Inline manager re-auth on the cashier screen would
either leak manager identity into the cashier viewport (violates
FR-021 last clause) or require a modal-over-modal pattern that
clashes with the cashier's tender-selection flow. 004 S5's manager
incident-response surface convention is the right structural template.

**Resolves:** AD-DEFERRED-4.

### AD-6 — Offline behaviour: cash + external_card local-first; voucher gated (LOCKED)

**Decision.** Offline behaviour by tender:

- **`cash`**: local-first; offline cash settlement remains under
  OQ-OFF-1..4 (out of scope for 006 v1; deferred to a dedicated
  offline-payments review). Slices 1–3 implement the online-only
  path; the offline path is implemented later under that review.
- **`external_card_terminal`**: local-first; offline recording is
  allowed since the actual settlement happens on the external device.
  Reconciliation with Data-Pulse-2 / shift-management is deferred to
  OQ-OFF-EXT-1.
- **`internal_voucher`**: gated. Under **Contract V-A** (default
  v1.0 stance, see AD-7), an `internal_voucher` `TenderLine` MUST
  refuse with `dependency_unavailable` while offline. Under Contract
  V-B (only if approved), local atomic redeem MAY proceed; the
  local-vs-authority reconciliation contract is part of the V-B
  contract review itself.

**No multi-device / server reconciliation contract is defined by 006
v1.** That belongs to the dedicated offline-payments review and the
voucher-authority contract review respectively.

**Resolves:** AD-DEFERRED-5.

### AD-7 — Voucher contract: V-A backend-authoritative (LOCKED v1.0 stance)

**Decision.** v1.0 plans against **Contract V-A — Backend-authoritative**:

- POS-Pulse calls `vouchers.validate` (bridge) → main process calls
  `POST /vouchers/validate` (future Data-Pulse-2 endpoint).
  Validation returns a short-lived non-sensitive **redemption intent
  token** bound to (`payment_attempt_id`, `tender_line_id`).
- At payment confirmation, POS-Pulse calls `vouchers.redeem` (bridge)
  → main process calls `POST /vouchers/redeem` with the intent token.
  Atomic redemption + double-redemption prevention is **the
  authority's responsibility** (Data-Pulse-2).
- Network failure on validate → `dependency_unavailable`.
- Network failure on redeem (after `applied`) → attempt resolves
  `failed` with reason `dependency_unavailable`; the line transitions
  to `reversal_pending` and a deferred-reversal audit event is
  emitted (per FR-006B).

**Contract V-B (POS-local read-model)** remains an approved fallback
only if Data-Pulse-2 explicitly grants the POS terminal voucher
authority under a documented offline reconciliation contract. If V-B
is later chosen, the data-model changes are additive (a local
`voucher_balances` read-model table + a replication contract); the
bridge surface (`vouchers.validate` / `vouchers.redeem`) and the
TenderLine FSM are unchanged.

**Until V-A or V-B ships**, `internal_voucher` is reserved-but-disabled
(FR-001). Slices 1–3 ship without it; **Slice 4 commissions Contract
V-A**.

**Partial voucher redemption (OQ-PLAN-3)** is **refuse, not cap-and-preserve**
in v1.0: if `authoritative_voucher_balance > remaining_balance_at_apply_time`,
the `tender.apply` call returns `non_cash_overpayment_refused`. The
cashier may apply a different amount on the voucher line if the
authority supports an `applied_amount` parameter on validate (open
authority-contract question); otherwise the cashier picks a different
tender. Cap-and-preserve was rejected because residual-voucher
reconciliation crosses the Data-Pulse-2 boundary in a way that 006
cannot guarantee without a future loyalty-engine spec.

**Resolves:** AD-DEFERRED-6 *(see AD-9 below for drawer-impact —
AD-DEFERRED-6 was drawer-impact; voucher is AD-7)*, OQ-PLAN-3, OQ-PLAN-7.

### AD-8 — OpenAPI / backend impact (LOCKED)

**Decision.**

- **Slices 1–3 (cash + external_card_terminal + split framework):**
  **No new OpenAPI surface.** §A2 records a no-op for these slices.
- **Slice 4 (voucher under Contract V-A):** **Two new Data-Pulse-2
  endpoints** (`POST /vouchers/validate`, `POST /vouchers/redeem`)
  required. POS-Pulse codegen run authored at Slice 4 entry under §A2.
  Data-Pulse-2 implementation is **out of scope for this PR** (the
  endpoints are *contracted* here, not *implemented*).
- **Slice 5 (production readiness):** Coverage, redaction audit,
  security-review sign-off only. No OpenAPI changes.

**Resolves:** OQ-PLAN-7 (backend impact portion).

### AD-9 — Drawer-impact signal (LOCKED)

**Decision.** 006 emits the `payment.settled` audit event with a
structured **tender breakdown** payload sufficient for the future
shift-management spec to compute drawer-expected-total without 006
performing any drawer calculations:

```text
payment.settled.audit_payload = {
  payment_attempt_id,
  cart_id,
  handoff_action_id,
  settled_at,
  attribution_operator_id,
  tender_lines: [
    { tender_type, amount_applied_minor, change_due_minor?, external_reference?, voucher_reference? }
  ]
}
```

006 does NOT emit a separate `drawer.cash_delta` event. The future
shift-management spec consumes the `tender_lines` array, filters for
`tender_type='cash'`, and derives drawer impact as
`Σ(amount_applied_minor − change_due_minor)`. This keeps 006's audit
surface tight (one event per terminal transition) while preserving the
information shift-management needs.

**Resolves:** AD-DEFERRED-6, OQ-PLAN-9.

---

## Approval Gates (status snapshot)

> All gates below are **status only**. None are opened by this PR.
> Implementation slices remain ⛔ held until each named gate clears
> through the standard slice-by-slice approval process.

| Gate | What it gates | Status |
|:--:|:--|:--:|
| **§A0** | Upstream readiness: 004 S4/S5 closed AND 005 spec approved AND `PaymentIntentEnvelope v1` ratified AND `/speckit-clarify` applied AND tender-scope amendment applied AND `/speckit-plan` v1.0 merged. | ✅ Functionally cleared; **`/speckit-plan` v1.0 ✅ this PR**; remaining hold lifts on `/speckit-tasks` + `/speckit-analyze` |
| **§A1** | Visual-direction Slice 0 — payment surface (tender selection, cash entry, external-card-terminal entry, voucher entry — see [./research.md](./research.md) R-3 for the splice-vs-stacked decision), change display, split-tender progress indicator, success / cancel / failure variants, manager force-fail surface (Slice 4 variant). | ⛔ Held — gated on `/speckit-tasks` |
| **§A2** | Backend / OpenAPI: **no-op for Slices 1–3** (cash + external_card_terminal + split framework); **Slice 4** requires `vouchers.validate` / `vouchers.redeem` Data-Pulse-2 endpoints + POS-Pulse codegen. | ⛔ Held; no-op for Slices 1–3 confirmed by AD-8 |
| **§A3** | Migrations: **three new SQLite tables** (`payment_attempts`, `payment_tender_lines`, `payment_action_outbox`) + partial unique index + append-only outbox trigger + audit-category-catalogue extension. Authored in **Slice 3**. Slices 1–2 require no migration. | ⛔ Held; no longer a no-op (was likely-no-op in plan v0.1) |
| **§A4** | Bridge-API surface: `payments.*` + `tender.*` namespaces per [./contracts/bridge-api.md](./contracts/bridge-api.md). Security-review handoff required before Slice 3 ships. | ⛔ Held; draft contract authored in this PR |
| **§A5** | Production readiness: coverage thresholds met (≥ 95 % money-math / FSM / audit-emitter; ≥ 90 % renderer surface); Sentry / log redaction sample audited (no PII, no card data, no voucher PII, no `external_reference` leakage); security-review sign-off; voucher contract V-A clearance recorded if Slice 4 ships. Blocks rollout, not slice merge. | ⛔ Held |

---

## Slices (LOCKED v1.0 grouping)

> Slice numbering is **locked** by this plan. `/speckit-tasks` produces
> the per-slice startable task list with file paths; this plan locks
> the *grouping*, *dependencies*, and *gate-attachment* per slice.

### Slice 0 — Visual direction (no code)

- **Scope.** Commission the payment-surface visual-direction review:
  tender selection, per-tender entry surface variants
  (cash / external_card_terminal / voucher reserved-disabled),
  change-due display, split-tender progress indicator, success /
  cancel / failure variants, manager force-fail surface (Slice 4
  variant only — review now to inform Slice 4 §A1 sign-off later).
- **Gates.** §A0 ✅ + §A1 commission. **Held.**
- **Test floor.** n/a (no code).

### Slice 1 — Tender selection + envelope ingest

- **User stories.** US1-AS1 / US4-AS1 / US6 enablement.
- **Scope.** Implement the tender-selection surface; ingest the frozen
  `PaymentIntentEnvelope v1` via 005's `cart.handoff` return value;
  render `lines[]` read-only; cash + external_card_terminal slots
  selectable; voucher slot reserved-disabled; operator badge always
  visible (FR-NFR-005 / 004 FR-020).
- **No bridge namespace introduced yet** — the renderer reads the
  envelope from in-process memory passed in by the 005 bridge return
  value. **No persistence yet** — no `payment_attempts` row is
  written until Slice 3.
- **Gates.** §A0 ✅ + §A1 (Slice 0 sign-off). **Held.**
- **Test floor.** Vitest renderer tests for tender-selection render +
  reserved-disabled state + envelope-required refusal.

### Slice 2 — Per-tender entry surfaces

- **User stories.** US1-AS2/AS3 (cash entry + change rule),
  US4-AS1/AS2 (external_card_terminal entry + non-cash-overpay
  refusal).
- **Scope.** Cash entry control (integer-minor-unit guarded) +
  change-due rule; external_card_terminal entry control + optional
  `external_reference` field per OQ-PLAN-5 resolution (see AD below
  in [./research.md](./research.md) R-5: 6-character alphanumeric
  uppercase, optional, redacted-in-logs, redacted-in-audit-event,
  client-side validation only — bridge accepts as-is and re-validates
  main-side). Renderer state is local to the surface; no bridge call
  yet.
- **Gates.** §A0 + §A1. **Held.**
- **Test floor.** ≥ 95 % coverage on the cash money-math helper;
  ≥ 90 % on the entry surfaces; integer-minor-unit guard tests reject
  floats / negatives / non-integers.

### Slice 3 — Payment FSM + TenderLine FSM + persistence + bridge

- **User stories.** US1-AS4/AS5/AS6, US2, US3, US4-AS3, US6
  (split-tender happy + rollback).
- **Scope.** **Load-bearing slice.** Author:
  - The three new SQLite tables under §A3 + partial unique index
    on `payment_attempts (terminal_id) WHERE state='started'` + the
    append-only outbox trigger.
  - The `PaymentAttempt` FSM (main process,
    `idle → started → settled | cancelled | failed`).
  - The `TenderLine` FSM (main process,
    `applying → applied | refused`; reversal under FR-006B
    transitions `applied → reversed` or `applied → reversal_pending`).
  - The `payments.*` + `tender.*` bridge handlers per
    [./contracts/bridge-api.md](./contracts/bridge-api.md) **except
    `payments.forceFail`** (which lives in Slice 4).
  - Idempotency replay (action_id lookup, payload-mismatch refusal).
  - Split-tender ordering + rollback (FR-006B).
  - Audit emission for `payment.{settled,cancelled,failed}` +
    `tender.{applied,refused,reversed,reversal_pending}` extending
    004's `audit_events` catalogue.
- **Gates.** §A0 ✅ + §A1 + §A2 (no-op confirmed) + §A3 (table review)
  + §A4 (bridge-API review). **Held.**
- **Test floor.** ≥ 95 % on FSM, money-math, audit-emitter; every
  legal transition + every illegal-transition refusal test;
  split-tender rollback test for each tender-type pair; idempotency
  replay test (identical-payload no-op, payload-mismatch refusal,
  re-confirmation refused after `settled`).

### Slice 4 — Voucher (Contract V-A) + force-fail

- **User stories.** US5 (voucher); FR-021 (manager force-fail).
- **Scope.**
  - Voucher subslice: Data-Pulse-2 contract handshake for
    `POST /vouchers/validate` / `POST /vouchers/redeem`; POS-Pulse
    codegen run; `vouchers.validate` / `vouchers.redeem` bridge
    handlers; voucher-line FSM integration (validate → applied
    → redeem-on-confirm or reverse-on-cancel); `reversal_pending`
    deferred-reversal resolver (background retry); voucher slot
    enabled in tender selection.
  - Force-fail subslice: dedicated manager incident-response surface
    (FR-021 / AD-5); `payments.forceFail` bridge handler;
    `payment.force_failed` audit event with dual attribution.
- **Gates.** §A0 ✅ + §A1 (force-fail surface review) + §A2 (voucher
  endpoints + codegen) + §A4 (bridge review). **Held.**
- **Test floor.** ≥ 95 % on the voucher-redeem path including the
  authority-unreachable / `reversal_pending` branch; force-fail role-
  gate test (cashier denied, manager allowed); manager-identity
  redaction test (cashier-visible UI does not echo manager id).

### Slice 5 — Production readiness

- **Scope.** Coverage thresholds met across all 006 modules;
  Sentry / log redaction sample audited; security-review handoff
  (P8) on bridge surface + FSM trust boundary + voucher contract;
  receipt-handoff payload finalised per AD-9 / OQ-PLAN-8;
  production-readiness gate sign-off recorded in coordination.md.
- **Gates.** §A5. **Held; blocks rollout, not slice merge.**

---

## Test Strategy

Constitution §VI requires test-first. The shape of those tests is
locked here; file paths are authored by `/speckit-tasks`.

### Coverage floors

| Module | Floor | Rationale |
|:--|:--:|:--|
| Money math (`cash_received_minor`, `change_due_minor`, `amount_applied_minor`, settlement-invariant sum) | **≥ 95 %** | Constitution §II / P-II non-negotiable |
| `PaymentAttempt` FSM | **≥ 95 %** | every legal + illegal transition tested |
| `TenderLine` FSM | **≥ 95 %** | every legal + illegal transition tested per tender type |
| Audit-event emitter | **≥ 95 %** | Constitution §P4 append-only; no PII / card-data leak tests |
| Idempotency replay | **≥ 95 %** | identical-payload no-op, payload-mismatch refusal, concurrent-confirm protection |
| Bridge handlers (`payments.*` / `tender.*`) | **≥ 95 %** | trust-boundary contracts |
| Voucher V-A client | **≥ 95 %** | every refusal reason mapped; `dependency_unavailable` + `reversal_pending` paths covered |
| Renderer payment surface | **≥ 90 %** | display logic, generic refusal copy |

### Test categories

- **Unit (vitest, main-side):** FSM transitions, money-math helpers,
  audit-payload shape, refusal reason mapping, idempotency replay.
- **Unit (vitest, renderer-side):** tender-selection state, per-tender
  entry surface state, generic-refusal copy translation, operator-
  badge presence.
- **Integration (vitest, in-process with better-sqlite3):** end-to-end
  attempt lifecycle through the three tables; split-tender rollback
  with rollback audit emission; restart survival (kill process
  mid-attempt; rehydrate from SQLite; assert `started` attempt
  recovered with applied tender lines intact).
- **Contract (vitest, compile-time):** `contracts/bridge-api.md`
  Request/Response shapes match `src/shared/bridge-api.ts`
  TypeScript definitions (analogous to 004 T008).
- **Property tests (vitest + fast-check):** settlement-invariant
  fuzz across random tender-line mixes; integer-minor-unit safety
  (`Number.isSafeInteger` for every sum).

### Security tests

Required for §A5 sign-off:

- No PAN / CVV / track / cardholder field appears in any persisted
  row across all three tables × all four audit categories.
- `external_reference` redacted in Sentry sample.
- Voucher response payloads minimised to FR-017 fields only.
- Generic refusal copy never discloses tender-line state, voucher
  balance, or operator identity beyond the badge.

---

## Security & trust boundary

This plan affirms the following as **load-bearing**:

- **Renderer is untrusted.** No JWT, device token, attestation, PIN,
  PIN hash, password, secret, credential, raw envelope payload,
  `backend_session_id`, voucher authority token, or sensitive ID
  crosses the bridge into the renderer.
- **Main-process role checks are primary** (Constitution §III).
  Renderer route guards are secondary UX defence only.
- **Generic refusal copy.** The renderer translates each closed
  refusal reason to a generic message. No reason category leaks to
  the cashier-visible UI.
- **Audit attribution.** Every `payment.*` / `tender.*` audit event
  carries the signed-in operator's Clerk-backed identity (FR-013 /
  FR-014). Manager identity on force-fail is recorded in the audit
  payload but never echoed to the cashier-visible UI (FR-021).
- **Logging.** No raw envelope, no voucher secret, no
  `external_reference`, no card-like value, no PIN, no token, no
  credential reaches any log sink (Sentry, console, local file).
  Per Constitution §P7 (PR-1 inherited from 004).

---

## Risks and concerns

| ID | Risk | Mitigation |
|:--|:--|:--|
| **R-1** | Voucher authority contract (V-A) slips past Slice 4. | Slices 1–3 ship without voucher; voucher slot reserved-disabled. Slice 4 commission gates on Data-Pulse-2 endpoint contract sign-off. |
| **R-2** | Split-tender rollback corner cases (multi-line voucher reverse with authority partial-failure). | OQ-PLAN-4 resolution in AD-3/AD-4 + the `reversal_pending` deferred-resolver pattern. Slice 3 test suite covers each tender-type rollback path. |
| **R-3** | Idempotency-key collision across cashier retries on flaky networks (Slice 4 voucher path). | `idempotency_key = UUID v4` per intended operation; renderer MUST reuse the same UUID on retry (matches 005 §"Idempotency"). Bridge enforces payload-match. |
| **R-4** | Partial unique index `WHERE state='started'` interacts poorly with `force_fail` race. | `force_fail` is a manager-initiated transition; it cannot run concurrent with `confirm` because both transitions go through the same main-process FSM mutex. Tested by Slice 4 force-fail race-condition test. |
| **R-5** | `external_reference` field becomes a card-data exfiltration vector if operator typo-pastes track data. | Client-side regex `^[A-Z0-9]{0,6}$` + main-side re-validation + Sentry redaction + audit redaction. See R-5 in [./research.md](./research.md). |
| **R-6** | Sub-millisecond audit emission delay on `payment.settled` causes a future receipts spec to read a not-yet-committed transaction. | `payment.settled` audit row, `payment_action_outbox` row, and `payment_attempts.state='settled'` all written in the same SQLite transaction (Slice 3 invariant). |
| **R-7** | A `reversal_pending` row gets stranded if the deferred-reversal resolver never runs. | Slice 4 resolver runs on (a) app start, (b) network-restore signal from 003, (c) cashier-initiated retry from the cashier surface. Tested by Slice 4 deferred-reversal harness. |
| **R-8** | UI implementation drifts from §A1 visual direction. | §A1 sign-off recorded before Slice 1 implementation begins; Slice 5 includes a "matches §A1 screenshot" review checklist. |

---

## Constitution Check (post-design re-evaluation)

| Principle / Cross-Feature Rule | Status | Notes |
|:--|:--:|:--|
| **§I — Constitution-as-law** | ✅ | This plan pins v1.5.1 and only adds normative rules, never replaces them. |
| **§II / P-II — Financial Precision** | ✅ | Integer minor units throughout. ≥ 95 % money-math coverage floor. `Number.isSafeInteger`-guarded sums. |
| **§III — Electron Process-Boundary Discipline** *(NON-NEGOTIABLE)* | ✅ | FSM ownership in main process (AD-1). Renderer is display-only. Every bridge call self-gates with `requireOperatorSession`. |
| **§IV — Loud Failure** | ✅ | NFR-003 + the closed FR-006 reason set + the structured-audit-per-transition rule. |
| **§V — Type Safety End-to-End** | ✅ | `contracts/bridge-api.md` is the typed seam; renderer + main both compile against the same Request/Response types. |
| **§VI — Test-First, Coverage-Gated** | ✅ | Slice test floors locked above. Test-first ordering enforced by `/speckit-tasks` per the 005 precedent. |
| **§VII — Reproducible Builds** | ✅ | No new packaging artefacts. Inherits 001 packaging pipeline. |
| **§VIII — Terminal Identity is Independent of User Identity** *(NON-NEGOTIABLE)* | ✅ | Operator attribution via 004 Clerk identity, never the device token (FR-013/FR-014). |
| **§IX — Hardware Matrix** | ✅ | Touch-target NFR-004 + keyboard-operability rule preserved. |
| **P1 — Local-First** | ✅ | Cash + external_card_terminal local-first; voucher requires backend (V-A) by design; the local-first guarantee is "the cart never fails to take a cash or external-card payment because the network blipped". |
| **P2 — No Fake Success** | ✅ | NFR-003 + closed FR-006 reason set. |
| **P3 — IPC Discipline** | ✅ | All cross-boundary calls go through `payments.*` / `tender.*` bridge namespaces under `requireOperatorSession`. |
| **P4 — Auditability and Non-Destructive Financial Correction** | ✅ | Append-only outbox + audit_events; force-fail dual-attributes (cashier + manager); reversal events emit, never destroy. |
| **P5 — Idempotency** | ✅ | UUID v4 `action_id` per intended operation; payload-mismatch refusal. |
| **P6 — No Raw Cardholder Data** | ✅ | FR-008 / FR-040 + Slice 5 redaction audit. |
| **P7 — Secrets Never Reach Renderer or Logs** | ✅ | FR-017 voucher-field minimisation; redaction across Sentry / audit / outbox. |
| **P8 — Electron Security Boundary** | ✅ | `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` preserved; no upward-of-bridge IPC. |
| **P9 — Money is Integer Minor Units** | ✅ | Same as §II. |
| **P10 — Operator Accountability for Sensitive Actions** | ✅ | Every state transition attributes to the signed-in operator. |
| **P11 — Generic Refusal Copy** | ✅ | Closed reason set lives in audit payload; renderer text is generic. |
| **P12 — Drop-Stale-State Defaults** | ✅ | Discard-on-session-end rule (FR-006 `operator_session_terminated`); restart-survival hydration only rehydrates non-terminal attempts. |
| **P13 — Forward-Compatible Envelopes** | ✅ | 006 emits/consumes `envelope_version='v1'` only; extensions bump version per 005 §"Forward-compatibility commitment". |
| **P14 — Trust Boundary in Bridge Namespace** | ✅ | AD-3 + `requireOperatorSession` on every handler. |
| **P15 — Renderer Receives Minimised State** | ✅ | FR-017 voucher minimisation; `external_reference` redacted; no raw envelope. |
| **P16 — Append-Only Outbox** | ✅ | `payment_action_outbox` UPDATE/DELETE denied by trigger. |
| **P17 — Visual Direction Before Implementation** | ✅ | §A1 sign-off precedes Slice 1 implementation. |
| **P18 — Spec-Kit Pipeline Discipline** | ✅ | `/speckit-tasks` + `/speckit-analyze` remain required before any implementation slice. |

**Result: PASS.** No constitution violations require a Complexity-Tracking
override.

---

## Next steps (post-approval)

When (and only when) this PR merges:

1. Run `/speckit-tasks` to generate the startable, file-path-bearing
   per-slice task list against this plan.
2. Run `/speckit-analyze` for cross-artifact consistency.
3. Commission §A1 visual direction (Slice 0).
4. Open Slice 1 (tender selection + envelope ingest) under §A0 + §A1.

**Do not** run `/speckit-tasks` or `/speckit-analyze` in this PR. **Do
not** start implementation. **Do not** modify Data-Pulse-2. The voucher
authority contract (V-A) is a separate Data-Pulse-2-led integration spec
that commissions before Slice 4.

---

## Deliberate skips and divergences from the standard `/speckit-plan` skill

Recorded here for reviewer auditability:

1. **CLAUDE.md SPECKIT marker update skipped.** The standard
   `/speckit-plan` skill outline (Phase 1 step 3) includes updating
   the `<!-- SPECKIT START --> ... <!-- SPECKIT END -->` markers in
   CLAUDE.md to reference this plan. **The user prompt explicitly
   forbids modifying CLAUDE.md.** Per the using-superpowers skill
   priority hierarchy (user instructions > superpowers skills >
   default system prompt), the user instruction wins. The skip is
   intentional and documented in [./coordination.md](./coordination.md)
   §"Tender-scope amendment — Session 2026-05-19".
2. **`/speckit-plan` was applied manually** (the planning skill was
   invoked, but the AD/OQ decisions came pre-supplied by the user
   prompt's `Required v1.0 decisions` section). The reasoning behind
   each decision is recorded in [./research.md](./research.md) so a
   future reviewer can audit the locked v1.0 architecture.
3. **Refusal-envelope field-name** is `reason` (mirrors 005), not
   `category` (which 004 uses). Documented in
   [./research.md](./research.md) R-2.
4. **Partial unique index** for "one started attempt per terminal" is
   a 006-specific design choice. 005 enforces its analogous "one
   editing cart per session" rule at the **application layer** (not
   in SQL). 006's per-terminal hardware-coupling justifies the
   stronger DB-level guarantee. See [./research.md](./research.md) R-6.
