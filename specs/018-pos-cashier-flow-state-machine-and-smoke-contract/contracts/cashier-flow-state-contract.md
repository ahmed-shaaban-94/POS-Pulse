# Contract — Cashier Sale Flow State Machine (PROSE)

**Feature:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Plan:** [../plan.md](../plan.md)
**Created:** 2026-06-12

> **PROSE CONTRACT — not OpenAPI, not JSON Schema, not code.** This is the application-UI/state
> contract for the cashier flow. It is the "contract format appropriate for the project type" (an
> Electron POS application) per the plan workflow. It authors no runtime artifact.

---

## Scope
The states, transitions, and money invariants a faithful cashier-flow implementation MUST satisfy,
mapped to the shipped `origin/main` mechanism (M-1..M-4). The sale-sync authorization leg is owned by
028 (bound by reference); the server capture leg is owned by Data-Pulse-2 (out of scope).

## States (contract)
The canonical states are the spec §5 table (APP_NOT_READY … VOIDED_OR_CANCELLED). For each state the
contract fixes: allowed actions, forbidden actions, the observable mechanism/indicator, the owner, and
the smoke evidence that proves the state. FINALIZABLE/FINALIZING/COMPLETED are **logical/backend**
states (M-1: no Finalize button; "Confirm payment" is the terminal cashier action; finalize is async
via the main-process polling worker + recent-sale projection).

## Transitions (contract)
Adopt spec §6 verbatim. Load-bearing guarantees:
- Empty cart → handoff is **blocked**.
- Exact / over tender → FINALIZABLE; under (single-tender) stays; split-tender applies a partial line
  (M-3) and under-settlement is refused at confirm.
- FINALIZABLE → FINALIZING → COMPLETED on the POS-local gate (M-2).
- Duplicate confirm in FINALIZING yields **no** new sale (idempotent).
- COMPLETED → RECEIPT_READY via the auto-finalize worker + recent-sale poll (M-1).
- Sync: 401 → retryable re-auth (per 028); persistent 403 → needs-repair; idempotent replay → SYNCED
  with no duplicate.

## Money invariants (contract)
Spec §7 invariants 1–12 are contractual. Integer minor units (`src/shared/money.ts`); display
separate from calculation; float equality never decides finalization. POS-local finalizability:
`tenderTotal ≥ saleTotal && cart-non-empty && saleTotal > 0`.

## OPEN points (contract leaves UNRESOLVED — owner-decisions)
The following are explicitly **not** fixed by this contract and MUST NOT be assumed resolved by any
consumer: tender model (single vs multi), partial/mixed tenders, post-handoff cart edits, payment
cancellation target (cart vs void), overpayment/change scope, zero-total sales, receipt-vs-sync
ordering, offline finalization before sync, reconnect-with-failed-auth classification (028),
manager override for failed-sync repair, tender-input units. The state machine carries the affected
transitions (post-handoff edit; cancel→cart-or-void) as OPEN.

## Conformance
A build conforms when every non-OPEN state and transition above is observable and every money
invariant holds, demonstrated by the smoke-evidence contract (sibling file). OPEN points are resolved
by the owner before the conforming behaviour for that point is built.
