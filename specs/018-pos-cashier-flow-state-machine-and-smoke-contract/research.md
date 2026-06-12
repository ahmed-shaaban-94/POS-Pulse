# Phase 0 — Research: POS Cashier Flow State Machine & Smoke Contract

**Feature:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-06-12

> Documentation-only research. No code, OpenAPI, migration, or dependency is authored. Every
> "Decision" below records a documentation/contract decision or a *verified observation* of shipped
> `origin/main` behaviour — not a runtime change.

---

## R0. Method

Research consists of (a) verifying the shipped-mechanism facts the contract maps to against POS
`origin/main`, and (b) for each §10 open decision, documenting the available branches and the reason
this chain DEFERS rather than decides. No NEEDS CLARIFICATION is resolved by inventing a behaviour;
the owner-decisions are resolved as "deferred", which is the conservative, scope-preserving outcome.

## R1. Shipped-mechanism facts (M-1..M-4)

### Decision: adopt the auto-finalize model (M-1) as the canonical terminal action
- **Rationale:** `origin/main` has no "Finalize" button. "Confirm payment" is the terminal cashier
  action; a main-process polling worker (~200 ms) finalizes asynchronously and the renderer observes
  the recent-sale projection. The contract's FINALIZABLE/FINALIZING/COMPLETED are logical/backend
  states, not a button. Modelling them as logical states keeps the contract truthful to shipped UX.
- **Alternatives considered:** modelling a synchronous "Finalize" action (rejected — does not match
  shipped behaviour, would mis-specify the contract).

### Decision: treat finalize-gating as POS-local (M-2)
- **Rationale:** `settled_at` is a shipped POS-local payment-attempt-FSM timestamp
  (`migrations/0020_create_sales.sql`, `src/main/payments/fsm/payment-attempt-fsm.ts`). There is no
  DP-2 server settlement endpoint. v1 finalize-gating is therefore POS-local:
  `tenderTotal ≥ saleTotal && cart-non-empty && saleTotal > 0`.
- **Alternatives considered:** server-confirmed settlement gate (rejected for v1 — no such endpoint
  ships; would be a DP-2-owned addition, out of this spec).

### Decision: record that a multi-tender-line FSM ships (M-3) → single-instrument is an EXPANSION
- **Rationale:** `src/main/payments/fsm/tender-line-fsm.ts` applies/reverses tender lines (LIFO). A
  "single-instrument v1" rule is therefore a *gated expansion / narrowing decision*, not a
  display-only constraint. Because narrowing shipped capability is an owner-decision, the contract
  does **not** assume single-instrument.
- **Alternatives considered:** asserting single-tender as a display constraint (rejected — would
  contradict shipped FSM and silently pre-decide a §10 owner-decision).

### Decision: confirm the money path is correct (M-4) → E-3 is closed, not re-opened
- **Rationale:** `src/main/catalogue/read-down/map-sellable-row.ts` `decimalStringToMinorUnits` does
  correct string/integer math (`"12.50" → 1250`); renderer amount-due formatters are integer-safe.
  This confirms the E-3 "Amount due 0.25" defect is already fixed; the contract specifies the flow as
  it ships and authors no fix.
- **Alternatives considered:** carrying E-3 as a live P0 (rejected — verified already-fixed; the
  charter forbids re-opening E-3).

## R2. Decision: adopt orchestrator Spec-029 as a POS-owned contract
- **Rationale:** Spec-029 (§11 child `Q-POS-CASHIER-SMOKE-SPEC`) defines the scenario + smoke-gate
  contract at the program level. Adopting it as a POS-Pulse-owned spec, *mapped to the shipped
  mechanism*, gives cashier-facing work a testable boundary owned by the repo that ships it.
- **Alternatives considered:** leaving the contract only at orchestrator level (rejected — POS needs a
  repo-local, mechanism-mapped contract to gate its own smoke evidence).

## R3. Boundary decisions (ownership)
- **Sale-sync authorization** (the credential POS attaches): owned by **028**; bound by reference.
  *Rationale:* avoids re-deciding a ratified auth boundary. *Alternative:* re-specify auth here —
  rejected (cross-repo boundary violation).
- **Server capture / idempotency / sync-status leg:** owned by **Data-Pulse-2** (orchestrator Spec
  030 / DP-2 spec 032). *Rationale:* preserves POS → DP-2 → Connector → ERPNext architecture; no
  POS→ERPNext path. *Alternative:* model the server leg here — rejected (out of POS scope).

## R4. NEEDS CLARIFICATION → DEFERRED owner-decisions (branches documented, not decided)

Each item is a ratified owner-decision per the planning charter. The chain documents both branches
and DEFERS. None is auto-decided.

| Open decision | Branch A | Branch B | Why DEFERRED (not decided here) |
|:--|:--|:--|:--|
| Tender model v1 | single-instrument (gated narrowing of M-3) | multi-tender (ships, M-3) | Narrowing shipped capability is an owner/product call; both are buildable. |
| Partial / mixed tenders v1 | supported | not supported | Bound to tender-model decision. |
| Post-handoff cart edits | allowed (re-open envelope) | frozen after handoff | Affects money invariant 2 + state machine; owner UX call. |
| Payment cancellation target | return to cart | void sale | Affects VOIDED_OR_CANCELLED transition semantics. |
| Overpayment/change scope | cash-only | all tenders | Product/till policy, owner call. |
| Zero-total sales | allowed | refused (invariant 7) | Pharmacy/audit policy; default refusal holds unless owner enables. |
| Receipt vs sync ordering | receipt before sync | receipt after sync | Both states modelled distinctly; ordering is owner policy. |
| Offline finalization before sync | allowed (POS-local M-2) | blocked until sync | Durability/audit policy (P18); owner call. |
| Reconnect-with-failed-auth class. | retryable re-auth | needs-repair | Owned by **028** (OQ-5); cross-ref, not decided here. |
| Manager override for failed-sync repair | allowed (Console later) | not in v1 | P10 operator-authority + Console-lane scope; owner call. |
| Required smoke-evidence form | manual script | automated regression | screenshots | Closeout policy; owner selects at gate time. |
| Tender input units | minor-units entry | decimal entry | Orthogonal UX; money invariants hold either way. |

**Output of Phase 0:** all NEEDS CLARIFICATION items are *resolved-by-deferral* (documented branches +
explicit owner-decision flag). No item is silently decided. The design phase plans *around* the open
set.
