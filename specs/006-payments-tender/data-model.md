# Data Model: Payments & Tender (Phase 1)

**Feature ID:** 006-payments-tender
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Research:** [./research.md](./research.md)
**Created:** 2026-05-19
**Constitution version pinned:** v1.5.1

> 🚧 **CONCEPTUAL ONLY.** No SQL is authored by `/speckit-plan`. The
> migration files for `payment_attempts`, `payment_tender_lines`, and
> `payment_action_outbox` are authored during Slice 3 under §A3. This
> file describes the entities, their fields, the invariants, and the
> relationships — the SQL shape is derived from this description by
> the migration tasks. No source code, no `*.sql`, no `*.ts` is
> created by this document.

---

## Overview

006-payments-tender introduces **three** new local SQLite tables in
addition to consuming 004's existing `audit_events`:

| Table | Purpose | Mutability |
|:--|:--|:--|
| `payment_attempts` | Payment-attempt lifecycle header (one row per attempt). | Mutable through bridge handlers; terminal in `settled` / `cancelled` / `failed` / `force_failed`. |
| `payment_tender_lines` | Per-line state (zero-or-more per attempt). | Mutable through bridge handlers; terminal in `applied` / `refused` / `reversed` / `reversal_pending` (R-11). |
| `payment_action_outbox` | Append-only history of every payment-mutating action. | Append-only (UPDATE / DELETE denied by trigger). |

006 does NOT introduce a parallel audit table. Payment sensitive
actions emit into 004's existing `audit_events` table via the existing
emitter (plan AD-2).

The **four attempt-level audit-event categories** that extend 004's
catalogue (FR-025 / FR-026 / FR-027 / FR-006) are:

- `payment.settled`
- `payment.cancelled`
- `payment.failed`
- `payment.force_failed` *(Slice 4)*

The **four per-line audit-event categories** that extend 004's
catalogue (FR-006A) are:

- `tender.applied`
- `tender.refused`
- `tender.reversed`
- `tender.reversal_pending` *(deferred-reversal signal — Slice 4 voucher path)*

---

## Entity: PaymentAttempt

The lifecycle header of a payment attempt. One row per attempt. Bound
to exactly one frozen `PaymentIntentEnvelope v1` (via
`handoff_action_id`) and exactly one `OperatorSession` (via
`operator_session_id`).

**Fields** *(behavioural; SQL types derived at migration-author time)*:

| Field | Shape | Notes |
|:--|:--|:--|
| `payment_attempt_id` | UUID v4 | Primary key. Generated main-side at `payments.start`. |
| `tenant_id` | UUID / string | From the bound `OperatorSession` (and matched against `envelope.tenant_id`). |
| `branch_id` | UUID / string | From the bound `OperatorSession`. |
| `terminal_id` | UUID / string | From the bound `OperatorSession`. Used for the partial unique index (R-6). |
| `acting_operator_id` | Clerk-backed identity (string) | The cashier who started the attempt. Stable across sessions. |
| `operator_session_id` | UUID / string | The active session under which the attempt was started. |
| `envelope_handoff_action_id` | UUID v4 | The `handoff_action_id` from the bound `PaymentIntentEnvelope v1`. FK candidate to 005's `cart_action_outbox` (read-only reference; no ON DELETE CASCADE). |
| `envelope_cart_id` | UUID v4 | Cached from the envelope for diagnostics and audit correlation. |
| `envelope_subtotal_minor` | Integer minor units | Cached from `envelope.subtotal_minor`. Source of truth for the settlement invariant. |
| `state` | enum | One of `started` / `settled` / `cancelled` / `failed` / `force_failed`. The five-state FSM lives in the main process; terminal states block further mutation. |
| `started_at` | UTC timestamp | NOT NULL. Set at `payments.start`. |
| `settled_at` | UTC timestamp | NULL until `state='settled'`; immutable thereafter. |
| `cancelled_at` | UTC timestamp | NULL until `state='cancelled'`; immutable thereafter. |
| `failed_at` | UTC timestamp | NULL until `state='failed'`; immutable thereafter. |
| `force_failed_at` | UTC timestamp | NULL until `state='force_failed'`; immutable thereafter. |
| `failure_reason` | enum | NULL when `state IN ('started','settled','cancelled')`. Otherwise drawn from FR-006's closed reason set (14 categories). |
| `force_fail_attribution_operator_id` | Clerk-backed identity | NULL except when `state='force_failed'`; records the manager who force-failed (FR-021). Never echoed to renderer (FR-021 last clause). |
| `last_action_id` | UUID v4 | The `action_id` of the most recent `payment_action_outbox` row that mutated this attempt. Used for restart-survival rehydration. |

**Invariants:**

1. **`state` is the FSM state.** Transitions:
   - `started → settled` (via `payments.confirm`).
   - `started → cancelled` (via `payments.cancel`).
   - `started → failed` (via main-side failure detection: cart_lost,
     operator_session_terminated, dependency_unavailable, etc.).
   - `started → force_failed` (via `payments.forceFail` — Slice 4 only).
   - **Terminal states block all further mutation.**
2. **Partial unique index — one started per terminal (R-6):**
   `CREATE UNIQUE INDEX payment_attempts_one_started_per_terminal ON payment_attempts (terminal_id) WHERE state = 'started';`
   This is 006-specific (005 does not use this pattern — see
   [./research.md](./research.md) R-6).
3. **Tenant / branch / terminal must match the bound
   `OperatorSession`.** Validated at `payments.start`; mismatch →
   refusal `tenant_isolation` (mirrors 005 pattern).
4. **`envelope_subtotal_minor` is a snapshot.** Once written at
   `payments.start`, it MUST NOT change. The settlement invariant
   compares `Σ payment_tender_lines.amount_applied_minor (where state='applied')`
   against this snapshot, not against a live re-read of 005's envelope
   (the envelope is already immutable, but the snapshot guards against
   any future bridge-layer extension).
5. **`failure_reason` enum closed set:** `cart_lost`,
   `operator_session_terminated`, `dependency_unavailable`,
   `internal_error`, `stale_handoff`, `tender_underpaid`,
   `non_cash_overpayment_refused`, `voucher_not_found`,
   `voucher_expired`, `voucher_cancelled`, `voucher_already_redeemed`,
   `voucher_tenant_mismatch`, `voucher_branch_mismatch`,
   `split_tender_rollback`. Matches FR-006 normatively.
6. **`force_fail_attribution_operator_id` redaction.** Never crosses
   the bridge to the renderer (FR-021 last clause). Lives in the
   audit payload + this column for incident reconstruction.
7. **`last_action_id` is the rehydration pointer.** On process
   restart, the main process scans `payment_attempts` for `state IN
   ('started')` rows; for each, it rehydrates from
   `payment_action_outbox` using `last_action_id` as the starting
   point.

**Indexes (proposed, finalised at §A3):**

- Primary key on `payment_attempt_id`.
- Partial unique on `(terminal_id) WHERE state='started'` — see
  Invariant 2.
- Index on `(envelope_handoff_action_id)` for cross-feature audit
  correlation.
- Index on `(state, branch_id)` for incident-response queries (force-fail
  manager surface; Slice 4).

---

## Entity: PaymentTenderLine

The per-line state of money applied through a single tender type
within a single payment attempt. Zero-or-more rows per attempt; a
non-empty payment attempt at `confirm` time has ≥ 1 row in `applied`
state with `Σ amount_applied_minor == envelope_subtotal_minor`.

**Fields** *(behavioural)*:

| Field | Shape | Notes |
|:--|:--|:--|
| `tender_line_id` | UUID v4 | Primary key. Generated main-side at `tender.apply`. |
| `payment_attempt_id` | UUID v4 | FK → `payment_attempts.payment_attempt_id`. NOT NULL. |
| `tender_type` | enum | One of `cash` / `external_card_terminal` / `internal_voucher`. Locked at apply time. |
| `amount_applied_minor` | Integer minor units (non-negative) | The amount this line contributes. Must be ≤ `remaining_balance_at_apply_time` for non-cash; may exceed for `cash`. |
| `state` | enum | One of `applying` / `applied` / `refused` / `reversed` / `reversal_pending`. FSM per R-11. |
| `change_due_minor` | Integer minor units (non-negative) \| NULL | Only meaningful for `tender_type='cash'` lines that overpay. MUST be NULL on non-cash lines (CHECK constraint). |
| `external_reference` | string (max 6 chars uppercase alphanumeric, regex `^[A-Z0-9]{0,6}$`) \| NULL | Only meaningful for `tender_type='external_card_terminal'`. NULL on other types. Always `*****`-redacted in logs (R-5). |
| `voucher_redemption_intent_token` | string \| NULL | Only meaningful for `tender_type='internal_voucher'`. Returned by `vouchers.validate` (Contract V-A); consumed by `vouchers.redeem` at `payments.confirm`. Short-lived; never crosses the bridge to the renderer. |
| `voucher_authority_redemption_id` | string \| NULL | Only meaningful for `tender_type='internal_voucher'`. Returned by `vouchers.redeem` on success; used for audit correlation. The single field that may cross the bridge to the renderer (FR-017) as part of the minimised voucher reference. |
| `applied_at` | UTC timestamp | NULL until `state='applied'`. |
| `refused_at` | UTC timestamp | NULL until `state='refused'`. |
| `reversed_at` | UTC timestamp | NULL until `state='reversed'`. |
| `reversal_pending_since` | UTC timestamp | NULL until `state='reversal_pending'`; cleared (and `reversed_at` set) on resolver success. |
| `refusal_reason` | enum | NULL until `state='refused'`. Drawn from FR-006 + FR-010 + FR-015 closed sets. |
| `attribution_operator_id` | Clerk-backed identity | The cashier who applied / refused / reversed the line. Inherits FR-013 / FR-014. |
| `apply_order` | Integer (monotonic per attempt) | Order in which the line was applied. Used for LIFO reversal (R-13). |
| `last_action_id` | UUID v4 | Idempotency replay pointer; the `action_id` of the outbox row that produced this line's current state. |

**Invariants:**

1. **`state` FSM (R-11):**
   - `applying → applied` (`tender.apply` success)
   - `applying → refused` (`tender.apply` refused: format,
     overpayment, voucher refusal)
   - `applied → reversed` (`tender.reverse` success on cash /
     external_card_terminal; voucher reverse success)
   - `applied → reversal_pending` (voucher reverse on unreachable
     authority)
   - `reversal_pending → reversed` (deferred-reversal resolver
     success — Slice 4)
   - **`refused` is terminal.** A refused line cannot be re-applied;
     the cashier must add a new line.
2. **Non-cash `change_due_minor` is NULL.** CHECK constraint:
   `(tender_type = 'cash') OR (change_due_minor IS NULL)`.
3. **`external_reference` is `tender_type='external_card_terminal'`-only.**
   CHECK constraint:
   `(tender_type = 'external_card_terminal') OR (external_reference IS NULL)`.
   Format: `external_reference ~ '^[A-Z0-9]{0,6}$'` (regex CHECK,
   nullable).
4. **`voucher_*` fields are `tender_type='internal_voucher'`-only.**
   CHECK constraints for both `voucher_redemption_intent_token` and
   `voucher_authority_redemption_id`.
5. **Settlement invariant (cross-row check, enforced at
   `payments.confirm`):**

   ```text
   Σ (line.amount_applied_minor − COALESCE(line.change_due_minor, 0))
   WHERE line.state = 'applied'
       == payment_attempts.envelope_subtotal_minor
   ```

   The `change_due_minor` subtraction is the canonical form because
   `cash` lines MAY overpay (overpayment is returned to the customer
   as change, not credited to the cart). Non-cash lines have
   `change_due_minor = NULL` (Invariant 2), so they contribute
   `amount_applied_minor` directly to the sum. The Slice 3 confirm
   transaction evaluates this exact expression. Refusal reason is
   `tender_underpaid` (sum too low) or `internal_error` (sum exceeds
   subtotal — should be impossible because per-line non-cash
   overpayment refusal in `tender.apply` prevents the overshoot;
   asserted defensively at confirm time).
6. **Cash overpayment rule:** if `tender_type='cash'` and
   `amount_applied_minor > remaining_balance_at_apply_time`, then
   `change_due_minor = amount_applied_minor − remaining_balance_at_apply_time`
   on apply. Non-cash overpayment → refused with reason
   `non_cash_overpayment_refused`.
7. **`apply_order` is monotonic within an attempt.** Used for LIFO
   reversal (R-13); does not need a UNIQUE constraint (refused lines
   keep their apply_order; only applied lines participate in the
   settlement sum).
8. **Voucher fields never reach the renderer except via the
   minimised reference shape.** The bridge's `tender.read` and
   `payments.read` responses include only `voucher_authority_redemption_id`
   (an opaque short string), never the intent token, balance, or
   any voucher-side metadata. Enforced at the bridge serialiser
   (FR-017, OQ-PLAN-7).

**Indexes (proposed, finalised at §A3):**

- Primary key on `tender_line_id`.
- Index on `(payment_attempt_id, apply_order)` for in-attempt
  ordering.
- Index on `(payment_attempt_id, state)` for settlement-invariant
  sum queries.
- Index on `(state)` filtered to `reversal_pending` for the Slice 4
  deferred-reversal resolver.

---

## Entity: PaymentActionOutbox

Append-only history of every payment-mutating action. Mirrors 005's
`cart_action_outbox` pattern.

**Fields** *(behavioural)*:

| Field | Shape | Notes |
|:--|:--|:--|
| `action_id` | UUID v4 | Primary key. Generated client-side at the moment of intent (the renderer's `idempotency_key`). |
| `payment_attempt_id` | UUID v4 | FK → `payment_attempts.payment_attempt_id`. NOT NULL. |
| `tender_line_id` | UUID v4 \| NULL | FK → `payment_tender_lines.tender_line_id` when the action is per-line; NULL for attempt-level actions. |
| `action_kind` | enum | One of: `payment.attempt.start`, `payment.confirm`, `payment.cancel`, `payment.fail`, `payment.force_fail`, `payment.discarded_on_session_end`, `tender.apply`, `tender.reverse`. |
| `action_payload_hash` | string (SHA-256 hex) | Hash of the request payload, used to detect payload-mismatch on idempotency replay (R-10). |
| `acting_operator_id` | Clerk-backed identity | Inherits FR-013 / FR-014. |
| `created_at` | UTC timestamp | NOT NULL. Insert-only. |

**Invariants:**

1. **Append-only.** UPDATE / DELETE denied by SQLite trigger
   (mirrors 005's `cart_action_outbox` pattern).
2. **`action_id` is unique** across the entire table. Enables O(log N)
   idempotency lookup.
3. **Identical-payload replay is no-op (R-10).** Bridge handler logic
   compares `action_payload_hash`; identical → return the prior
   outcome; differs → refuse with `idempotency_payload_mismatch`.
4. **No PII / card data / voucher secrets in the payload hash
   pre-image.** The hash is computed over a redacted canonical
   payload (specific fields redacted: `external_reference` → `*****`,
   voucher tokens → never included).

**Indexes (proposed, finalised at §A3):**

- Primary key on `action_id`.
- Index on `(payment_attempt_id, created_at)` for in-attempt history.
- Index on `(tender_line_id, created_at)` for per-line history.

---

## Extension to 004's `audit_events`

006 emits eight new `action_category` values into 004's existing
`audit_events` table. **No new audit table is introduced.**

| Category | When emitted | Payload highlights |
|:--|:--|:--|
| `payment.settled` | `payments.confirm` succeeds | Full tender breakdown per AD-9 / R-8: `payment_attempt_id`, `cart_id`, `handoff_action_id`, `settled_at`, `attribution_operator_id`, `tender_lines[]` array. |
| `payment.cancelled` | `payments.cancel` succeeds | `payment_attempt_id`, `cart_id`, `handoff_action_id`, `cancelled_at`, `attribution_operator_id`. Reverses are recorded as separate `tender.reversed` events. |
| `payment.failed` | Main-side detects a failure cause | `payment_attempt_id`, `failure_reason` (closed FR-006 enum), `failed_at`, `attribution_operator_id`. |
| `payment.force_failed` *(Slice 4)* | `payments.forceFail` succeeds | `payment_attempt_id`, `failure_reason='manager_force_failed'` *(aligned 2026-05-26 with Wave 5b-main FR-006 amendment + Wave 5e migration 0019; earlier drafts used `'force_failed_by_manager'`)*, `attribution_operator_id` (the cashier whose attempt was force-failed) + `force_fail_attribution_operator_id` (the manager). The manager identity lives in the audit payload, never in the renderer-visible UI. |
| `tender.applied` | `tender.apply` succeeds | `tender_line_id`, `payment_attempt_id`, `tender_type`, `amount_applied_minor`, `change_due_minor` (cash-only), `external_reference` redacted-to-`*****` (external_card_terminal-only), `voucher_authority_redemption_id` (voucher-only, post-confirm), `applied_at`, `attribution_operator_id`. |
| `tender.refused` | `tender.apply` refused | `tender_line_id`, `tender_type`, `refusal_reason`, `refused_at`, `attribution_operator_id`. |
| `tender.reversed` | `tender.reverse` succeeds | `tender_line_id`, `tender_type`, `reversed_at`, `attribution_operator_id`. |
| `tender.reversal_pending` | Voucher reverse on unreachable authority | `tender_line_id`, `reversal_pending_since`, `attribution_operator_id`. Resolved by Slice 4 deferred resolver, which emits `tender.reversed` on success. |

**No PII / card data / voucher secrets in any audit payload.** The
audit-event payload-shape is validated at the emitter
(`src/main/payments/audit-emitter.ts`, post-§A4) per Constitution
§P6 / §P7.

---

## Relationships diagram (descriptive)

```text
005.carts                                       (existing, 005-owned)
   └── 005.cart_action_outbox.action_id ──┐
                                          │
006.payment_attempts                      │
   ├── envelope_handoff_action_id ────────┘  (reference; no ON DELETE)
   ├── operator_session_id  →  004.operator_sessions  (004-owned)
   └── payment_attempt_id ─┐
                           │
006.payment_tender_lines   │
   └── payment_attempt_id ─┘

006.payment_action_outbox
   ├── payment_attempt_id  →  006.payment_attempts
   └── tender_line_id      →  006.payment_tender_lines (nullable)

004.audit_events  (existing, 004-owned)
   ├── action_category extended with 8 new values (4 payment.* + 4 tender.*)
   └── payload references payment_attempt_id / tender_line_id
       (read-only correlation; no FK because audit_events is append-only)
```

---

## Migration sequencing (Slice 3 — informational)

The migration files are authored at Slice 3 under §A3 in the **future
implementation branch** (`006-payments-tender`). The proposed
ordering is:

1. **006-0001_create_payment_attempts.sql** — table + partial unique
   index + indexes.
2. **006-0002_create_payment_tender_lines.sql** — table + FK +
   CHECK constraints + indexes.
3. **006-0003_create_payment_action_outbox.sql** — table + indexes +
   append-only trigger.
4. **006-0004_extend_audit_event_categories.sql** — extend the
   `action_category` enum (or CHECK constraint, depending on 004's
   exact pattern) with the eight new categories.

Each migration MUST be transactional and idempotent (mirrors 004's
migration convention). The migration runner is the existing
better-sqlite3 transactional runner from 001.

**No migration is authored by this PR.** Slice 3 task list (produced
by `/speckit-tasks`) will own these files.

---

## Constitution §P4 — Append-Only Outbox compliance

- `payment_action_outbox` is **append-only** at the SQL level
  (UPDATE / DELETE denied by trigger; mirrors 005's
  `cart_action_outbox`).
- `audit_events` is append-only by 004's existing trigger.
- `payment_attempts.state` and `payment_tender_lines.state` are
  mutable, but every mutation writes an outbox row in the same
  transaction; any state can be reconstructed from outbox history.
- **Reversal is recorded, never destructive.** A `reversed`
  tender_line keeps its `applied_at` timestamp (now historical) and
  gets a `reversed_at` timestamp added; the `tender.applied` audit
  event remains; a separate `tender.reversed` audit event is emitted.

This satisfies §P4 end-to-end.

---

**End of data model.** Bridge surface in
[./contracts/bridge-api.md](./contracts/bridge-api.md); end-to-end
walkthrough in [./quickstart.md](./quickstart.md).
