# Contract — G-POS-CASHIER-SMOKE Evidence Bar (PROSE)

**Feature:** 018-pos-cashier-flow-state-machine-and-smoke-contract
**Plan:** [../plan.md](../plan.md)
**Created:** 2026-06-12

> **PROSE CONTRACT — not code, not a test file, not a CI gate definition.** This records the
> *evidence bar* that POS produces toward the program-level `G-POS-CASHIER-SMOKE` gate. It does **not**
> register or activate that gate (spec §3 non-goal); gate registration stays prose-only at the
> orchestrator level.

---

## Evidence bar — payment scenarios A–G (spec §8)
Each scenario has a single deterministic expected result; the bar is "all seven demonstrably reach
their result with money invariants holding":

| # | Scenario | Expected result (the evidence) |
|---|---|---|
| A | Exact (×2 @ 12.50 = 25.00, paid 25.00) | finalize enabled; sale completes |
| B | Underpayment (paid 20.00, single-tender) | finalize disabled; not completed |
| C | Overpayment (paid 30.00) | completes; change 5.00 shown |
| D | Empty / zero paid | finalize disabled; not completed |
| E | Invalid tender (neg / letters / NaN) | rejected; unchanged; no NaN in UI |
| F | Tender edit (20 → 25 → 30) | remaining/change recalculated immediately + correctly |
| G | Duplicate finalize | exactly one sale / receipt / outbox |

Figures are illustrative (preprod Paracetamol = 12.50, verified) — not a pricing ratification.

## Evidence bar — cashier / offline scenarios (spec §9)
Each scenario in the §9 required set defines: preconditions · actions · expected UI · expected local
state · backend interaction (if any) · refusal/retry · smoke evidence · owner. The required set:
fresh-terminal / catalog refresh (succeed + fail); search by text / barcode / unknown; select-not-add
/ add once / add twice / remove / clear; handoff-empty-blocked / handoff-succeeds / payment-reached;
cancel-before-finalize (if supported — OPEN) / finalize-success / receipt-ready / new-sale; network
offline before sale / drops after capture / offline queued; sync retry success / 401 re-auth / 403
escalate; duplicate replay no-duplicate; DB or app restart with pending sale / crash during finalize /
crash after local completion before sync; terminal clock wrong; feature-flag disabled.

## Evidence FORM (DEFERRED — owner-decision)
Whether closeout evidence is a manual script, an automated regression suite, or screenshots is a
DEFERRED owner-decision. Candidate forms the owner may select from:
- **Manual script:** a checklist run per scenario, archived with results.
- **Automated regression:** Vitest/Playwright coverage of the A–G + §9 paths (inherits the
  constitution's Test-First / ≥80% gates; Money + outbox ≥95%).
- **Screenshots:** per-state captures keyed to §5.

This contract does NOT pick the form; it enumerates the candidates and defers selection to the owner.

## Non-registration (explicit)
Producing this evidence does NOT register `G-POS-CASHIER-SMOKE`. The gate remains prose-only at the
program level; POS only *produces evidence toward* it.
