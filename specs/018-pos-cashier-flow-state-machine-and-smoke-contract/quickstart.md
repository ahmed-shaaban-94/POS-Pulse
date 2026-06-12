# Quickstart — Verifying the Cashier Flow Contract (reviewer path)

**Feature:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-06-12

> Documentation-only. This describes how a **reviewer** confirms the contract is faithful to shipped
> behaviour and complete. It authors no test and runs no build as part of this chain. The *form* of
> closeout evidence (manual run vs automated regression vs screenshots) is a DEFERRED owner-decision.

---

## What "the cashier flow works" means here
The contract is satisfied when, for the shipped POS mechanism (M-1..M-4), the payment scenarios A–G
(spec §8) and the cashier/offline scenarios (spec §9) each reach their specified result, with the
money invariants (§7) holding throughout, and with the OPEN owner-decisions plainly marked rather than
silently resolved.

## Reviewer walkthrough (against the §5 state machine)

1. **Launch / readiness.** Confirm APP_NOT_READY and CATALOG_NOT_READY states surface (launch
   screenshot; catalog refresh success + fail). Empty-cart handoff is blocked (EMPTY_CART).
2. **Build the cart.** Product search (text + barcode + unknown), select-not-add, add ×1 / ×2,
   remove, clear → CART_BUILDING / CART_READY. Handoff enabled only when valid.
3. **Handoff.** Payment surface mounts; cart envelope frozen (HANDED_OFF_TO_PAYMENT). Post-handoff
   cart-edit is OPEN (do not assume either way).
4. **Tender (scenarios A–G).**
   - A Exact (×2 @ 12.50 = 25.00, paid 25.00) → FINALIZABLE → completes.
   - B Underpayment (paid 20.00, single-tender) → finalize disabled → not completed.
   - C Overpayment (paid 30.00) → completes, change 5.00 shown.
   - D Empty/zero paid → disabled → not completed.
   - E Invalid tender (neg / letters / NaN) → rejected, no NaN, unchanged.
   - F Tender edit (20→25→30) → remaining/change recalculated immediately + correctly.
   - G Duplicate finalize → exactly one sale / receipt / outbox.
5. **Finalize + receipt.** Confirm payment → FINALIZING → COMPLETED (POS-local gate, M-2); auto-
   finalize worker + recent-sale poll → RECEIPT_READY with sale number (M-1).
6. **Sync + offline (scenarios §9).** Offline before sale / drops after capture / offline queued;
   retry success / 401 re-auth / 403 escalate; duplicate replay → no duplicate; DB/app restart with
   pending sale; crash during finalize; crash after local completion before sync; terminal clock
   wrong; feature-flag disabled.

## Money checks (must hold at every step)
Integer minor units only; display formatting is separate from calculation; float equality never
decides finalization; `remaining ≥ 0`; `changeDue ≥ 0`; no NaN/malformed money in the UI.

## OPEN decisions a reviewer must NOT treat as decided
Tender model (single vs multi), partial/mixed tenders, post-handoff edits, cancel→cart-or-void,
overpayment scope, zero-total, receipt-vs-sync ordering, offline finalization, reconnect-with-failed-
auth (028), manager override for repair, smoke-evidence form, tender-input units. If review needs one
of these resolved, route it to the owner — not into this contract.

## Closeout
The contract is *ready for owner ratification* when spec §1–§11 + the Phase 1 artifacts are internally
consistent (see `/speckit-analyze` report). Selecting the smoke-evidence form and resolving the OPEN
owner-decisions are prerequisites for the **separate, owner-gated payment-finalization-hardening
lane** — not for this documentation chain.
