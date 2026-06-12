# Phase 1 — Data Model: Cashier Sale State Machine

**Feature:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-06-12

> Documentation-only. This is the *logical* state/transition model of the cashier flow. It is **not** a
> database schema and authors **no** migration. Where it names a persisted record, that record already
> ships on `origin/main`; this document describes how logical states project from it.

---

## Entities (logical)

### E1. Cashier Sale State (logical state)
The cashier flow is a finite state machine. States are logical/observable; some are backend/logical
(not a cashier button — per M-1). States, ownership, and indicators are the spec §5 table; reproduced
here as the model of record:

`APP_NOT_READY → CATALOG_NOT_READY → EMPTY_CART → PRODUCT_SEARCHING → PRODUCT_SELECTED →
CART_BUILDING → CART_READY → HANDED_OFF_TO_PAYMENT → PAYMENT_IN_PROGRESS → FINALIZABLE → FINALIZING →
COMPLETED → RECEIPT_READY → SYNC_PENDING → SYNCED` with branch states `SYNC_FAILED_RETRYABLE`,
`SYNC_FAILED_NEEDS_REPAIR`, and `VOIDED_OR_CANCELLED`.

Each state carries: meaning · allowed actions · forbidden actions · mechanism/indicator · owner ·
required smoke evidence (spec §5).

### E2. Sale (projected-from, shipped)
- Source: `migrations/0020_create_sales.sql` (read-only context; not edited).
- Money fields are INTEGER minor units (constitution II). Carries `settled_at` (POS-local attempt FSM
  timestamp, M-2) and a client-generated `tx_id` (audit anchor, P5/P7).
- COMPLETED/RECEIPT_READY logical states project from a durable sale row (P2 — no fake success).

### E3. Tender Line (projected-from, shipped)
- Source: `src/main/payments/fsm/tender-line-fsm.ts` (read-only context). Apply/reverse, LIFO.
- A sale has 0..N tender lines. `tenderTotal = Σ tender-line amounts` (integer minor units).
- Whether v1 permits >1 instrument is the DEFERRED tender-model owner-decision (R4) — the model
  supports multi (M-3) and does not assert single.

### E4. Outbox Entry (projected-from, shipped concept)
- A captured sale queues to a durable local outbox with `tx_id` idempotency key (P3/P5).
- Sync states (SYNC_PENDING/SYNCED/SYNC_FAILED_*) project from outbox status; *truth* of SYNCED is
  DP-2-owned, POS surfaces UX (spec §5 owner column).

## Derived / computed values (money invariants §7)
- `subtotal` = Σ line (unitPrice × qty), integer minor units.
- `saleTotal` (tax/discount/fee are explicit placeholders, not modeled v1 — invariant 12).
- `remaining = max(saleTotal − tenderTotal, 0)` — invariant 3 (`remaining ≥ 0`).
- `changeDue = max(tenderTotal − saleTotal, 0)` — invariant 4 (`changeDue ≥ 0`).
- **Finalizability (POS-local, M-2):** `tenderTotal ≥ saleTotal && cart-non-empty && saleTotal > 0`.
  Float equality never decides finalization (invariant; uses integer minor units only).

## Validation rules (from §7 invariants)
1. Cart subtotal matches visible lines.
2. Sale total stable after handoff unless an explicit edit flow exists (DEFERRED owner-decision).
3. `remaining ≥ 0`. 4. `changeDue ≥ 0`. 5. No NaN/malformed money in UI.
6. Empty cart cannot finalize. 7. `saleTotal ≤ 0` cannot finalize unless zero-total intentionally
   supported (DEFERRED). 8. Single-tender: not finalizable while `tenderTotal < saleTotal`;
   multi/split (M-3): partial lines applied, no-under-settlement enforced server-side at confirm.
9. Exact payment finalizes. 10. Overpayment finalizes + shows change.
11. Duplicate finalize → exactly one sale/receipt/outbox (idempotent — DB unique index + NOT EXISTS +
    in-txn re-check, shipped).

## State transitions (spec §6, keyed to E1 states)
- `EMPTY_CART + handoff → blocked` (disabled handoff).
- `PAYMENT_IN_PROGRESS + exact/over → FINALIZABLE`; `+ under (single-tender) → stay`; split-tender
  applies a partial line (M-3); under-settlement refused server-side at confirm.
- `FINALIZABLE + confirm → FINALIZING → COMPLETED` (POS-local gate, M-2).
- `FINALIZING + duplicate confirm → no new sale` (idempotent).
- `COMPLETED + auto-finalize worker + recent-sale poll → RECEIPT_READY` (M-1).
- `SYNC_PENDING + 401 → SYNC_FAILED_RETRYABLE` (re-auth, per 028); `+ 403 → RETRYABLE→NEEDS_REPAIR`
  if persistent; `+ idempotent replay → SYNCED` (no duplicate).
- **OPEN transitions (DEFERRED):** post-handoff cart-edit (re-open envelope) and payment-cancel
  (→ cart or → VOIDED_OR_CANCELLED) are marked OPEN, not wired to a fixed target.

## Out of model (explicitly)
No schema/DDL, no new columns, no migration. Refunds/returns, shifts, cash-drawer, and tax/fiscal are
governed elsewhere (spec §3 non-goals).
