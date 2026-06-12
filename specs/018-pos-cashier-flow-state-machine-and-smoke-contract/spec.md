# Spec 018 — POS Cashier Flow State Machine & Smoke Contract

**Status:** SPECIFY-ONLY — draft for owner review. No implementation, no runtime code authored or implied.
**Repo:** POS-Pulse.
**Parent:** Orchestrator Spec 029 (POS Cashier Operating Scenarios & Smoke Gate), §11 child (`Q-POS-CASHIER-SMOKE-SPEC`).
**Relation to 028:** sale-sync *authorization* (the credential POS attaches) is owned by 028, bound here by reference — not re-decided. The server leg (capture/idempotency/sync-status) is owned by Data-Pulse-2 (orchestrator Spec 030 / DP-2 spec 032), out of this spec.
**Relation to E-3:** the "Amount due 0.25" bug is **verified already-fixed** on POS `origin/main` (read-down money path correct). This spec does NOT carry the stale live-P0 framing; it specifies the cashier flow as it ships.

---

## 1. Summary

Define the POS-Pulse cashier sale lifecycle as a single ratified contract — the state machine, transition rules, money invariants, and the mandatory smoke scenarios that constitute "the cashier flow works" — so cashier-facing work has a testable boundary. This spec adopts the Orchestrator Spec-029 scenario contract as a POS-Pulse-owned spec, **mapped to the shipped POS mechanism**, and records the per-scenario smoke evidence that feeds the (prose-only) `G-POS-CASHIER-SMOKE` gate. It authors no runtime code.

Canonical core path:

```
Product search → Add to cart → Cart ready → Handoff to payment →
Tender entry → Correct remaining/change → Finalize (auto) →
Completed / receipt-ready → Outbox / sync state
```

## 2. Goals

- **G-1.** Define the canonical cashier sale **state machine** (§5) mapped to the shipped mechanism.
- **G-2.** Define **transition rules** (§6).
- **G-3.** Define **money invariants** (§7) — integer minor units, display separate from calculation.
- **G-4.** Define **payment scenarios A–G** (§8) and **cashier/offline scenarios** (§9) with required smoke evidence.
- **G-5.** Record the **smoke-evidence bar** for `G-POS-CASHIER-SMOKE` (POS produces evidence toward it; this spec does not register the gate).
- **G-6.** Keep implementation **out of this spec** — it is the testable contract; the build is a separate owner-gated lane.

## 3. Non-goals

- No runtime `src/` code; no cart/payment/receipt/read-down implementation.
- No Data-Pulse / OpenAPI / contract change; no migration; no package/lockfile/CI change.
- No registration of `G-POS-CASHIER-SMOKE` (prose-only at the program level).
- No E-3 "fix" (verified already-fixed).
- No refunds/returns, shifts, cash-drawer, tax/fiscal — governed elsewhere.

## 4. Shipped-mechanism facts this spec maps to (verified on POS origin/main)

- **M-1 (auto-finalize, no Finalize button).** "Confirm payment" is the terminal cashier action; the sale is finalized asynchronously by a main-process polling worker (~200 ms); the renderer observes via the recent-sale projection. Canonical `FINALIZABLE/FINALIZING/COMPLETED` are **logical/backend** states, not a cashier button.
- **M-2 (settled_at is POS-local).** `settled_at` is a shipped POS-local payment-attempt-FSM timestamp (`migrations/0020_create_sales.sql`, `src/main/payments/fsm/payment-attempt-fsm.ts`). There is **no DP-2 server settlement endpoint**; v1 finalize-gating is POS-local: `tenderTotal ≥ saleTotal && cart-non-empty && saleTotal > 0`.
- **M-3 (multi-tender-line FSM ships).** `src/main/payments/fsm/tender-line-fsm.ts` applies/reverses tender lines (LIFO). So a "single-instrument v1" rule is a **gated EXPANSION**, an OPEN decision (§10) — not a display-only constraint and not assumed here.
- **M-4 (money path correct).** `src/main/catalogue/read-down/map-sellable-row.ts` `decimalStringToMinorUnits` is correct string/integer math (`"12.50"→1250`); renderer amount-due formatters are integer-safe. (Confirms E-3 closed.)

## 5. Cashier sale state machine

| State | Meaning | Allowed | Forbidden | Mechanism / indicator | Owner | Smoke evidence |
|---|---|---|---|---|---|---|
| APP_NOT_READY | App starting / no session | wait | ring a sale | splash / sign-in | POS | launch screenshot |
| CATALOG_NOT_READY | Signed in, catalog not loaded | refresh | search/add | "catalog unavailable" | POS | refresh-fail smoke |
| EMPTY_CART | Ready, no lines | search/add | handoff | empty-cart UI | POS | empty-cart handoff-blocked |
| PRODUCT_SEARCHING | Query in flight | type/scan | — | spinner/results | POS | search smoke |
| PRODUCT_SELECTED | Match chosen, not added | add/cancel | finalize | selected row | POS | select-not-add |
| CART_BUILDING | ≥1 line, editing | add/remove/qty/handoff | finalize directly | cart pane | POS | add ×2 smoke |
| CART_READY | Cart valid for handoff | handoff | — | enabled handoff | POS | handoff-enabled |
| HANDED_OFF_TO_PAYMENT | Envelope frozen, payment screen | select tender | mutate cart* | payment surface mounted | POS | mount test |
| PAYMENT_IN_PROGRESS | Tender entered/applied | enter/edit/apply, cancel | — | tender entry | POS (display) | tender smoke |
| FINALIZABLE | Settlement satisfiable (POS-local, M-2) | confirm payment | — | "Confirm payment" enabled | POS (M-2) | exact/over scenarios |
| FINALIZING | Confirm in flight | wait | double-confirm | confirming | POS | confirm test |
| COMPLETED | Payment settled (attempt) | new sale | — | "Payment settled" | POS (M-2) | settled test |
| RECEIPT_READY | Durable sale exists | view/print, new sale | — | completed panel + sale number | POS (auto-finalize M-1) | sale-number test |
| SYNC_PENDING | Captured locally, queued | wait/retry | assume synced | outbox "pending" | POS (UX) / DP-2 (truth) | offline-queue smoke |
| SYNCED | Server confirmed capture | — | — | outbox "synced" | DP-2 | sync-success smoke |
| SYNC_FAILED_RETRYABLE | Transient failure | auto-retry | dead-letter | "will retry" | DP-2 (classify) | 401/403/network smoke |
| SYNC_FAILED_NEEDS_REPAIR | Non-retryable | escalate (Console later) | silent drop | "needs attention" | DP-2 (classify) | dead-letter scenario |
| VOIDED_OR_CANCELLED | Abandoned pre/at payment | new sale | finalize | voided indicator | POS / DP-2 | cancel-before-pay (§10 open) |

\* post-handoff cart-edit is an OPEN decision (§10).

## 6. Transition rules

Adopt Spec-029 §7 verbatim as the POS transition table — keyed to the §5 states. Load-bearing rows:
- EMPTY_CART + handoff → **blocked** (disabled handoff).
- PAYMENT_IN_PROGRESS + exact/over → FINALIZABLE; under (single-tender) → stay; split-tender applies partial line (M-3), under-settlement refused server-side at confirm.
- FINALIZABLE + confirm → FINALIZING → COMPLETED (POS-local gate, M-2).
- FINALIZING + duplicate confirm → no new sale (idempotent — DB unique index + NOT EXISTS + in-txn re-check, shipped).
- COMPLETED + (auto) finalize worker + recent-sale poll → RECEIPT_READY (M-1).
- SYNC_PENDING + 401 → SYNC_FAILED_RETRYABLE (re-auth, per 028); + 403 → RETRYABLE→NEEDS_REPAIR if persistent; + idempotent replay → SYNCED (no duplicate).

## 7. Money invariants

1. Cart subtotal matches visible lines. 2. Sale total stable after handoff unless an explicit edit flow exists (§10 open). 3. `remaining ≥ 0`. 4. `changeDue ≥ 0`. 5. No NaN/malformed money in UI. 6. Empty cart cannot finalize. 7. `saleTotal ≤ 0` cannot finalize unless zero-total intentionally supported (§10 open). 8. Single-tender: not finalizable while `tenderTotal < saleTotal`; multi/split-tender (M-3): partial lines applied, no-under-settlement enforced server-side at confirm. 9. Exact payment finalizes. 10. Overpayment finalizes + shows change. 11. Duplicate finalize → exactly one sale/receipt/outbox. 12. Tax/discount/fee are explicit placeholders (not modeled v1).

Use integer minor units (`src/shared/money.ts`); display formatting separate from calculation; float equality never decides finalization.

## 8. Payment scenarios (smoke A–G)

| # | Scenario | saleTotal | paid | remaining | change | finalize | result |
|---|---|---|---|---|---|---|---|
| A | Exact (e.g. ×2 @ 12.50) | 25.00 | 25.00 | 0.00 | 0.00 | enabled | completes |
| B | Underpayment | 25.00 | 20.00 | 5.00 | 0.00 | disabled (single-tender) | not completed |
| C | Overpayment | 25.00 | 30.00 | 0.00 | 5.00 | enabled | completes, change shown |
| D | Empty/zero | 25.00 | 0/empty | 25.00 | 0.00 | disabled | not completed |
| E | Invalid tender (neg/letters/NaN) | 25.00 | invalid | unchanged | 0.00 | disabled | rejected, no NaN |
| F | Tender edit (20→25→30) | 25.00 | varies | recalculated | recalculated | recalculated | immediate, correct |
| G | Duplicate finalize | 25.00 | 25.00 | 0.00 | 0.00 | enabled | exactly one sale/receipt/outbox |

Figures illustrative (preprod Paracetamol = 12.50, verified), not a pricing ratification.

## 9. Cashier operating + offline scenarios

Each defines: preconditions · actions · expected UI · expected local state · backend interaction (if any) · refusal/retry · smoke evidence · owner. Required set (Spec-029 §10): fresh-terminal/catalog refresh succeed+fail; search by text/barcode/unknown; select-not-add / add once / add twice / remove / clear; handoff-empty-blocked / handoff-succeeds / payment-reached; cancel-before-finalize (if supported §10) / finalize-success / receipt-ready / new-sale; network offline before sale / drops after capture / offline queued; sync retry success / 401 re-auth / 403 escalate; duplicate replay no-duplicate; DB/app restart with pending sale / crash during finalize / crash after local completion before sync; terminal clock wrong; feature-flag disabled.

## 10. Open decisions (carry to clarify; do NOT pre-decide)

- Single-instrument vs multi-tender v1 (M-3 ships multi → single = gated expansion).
- Partial / mixed tenders supported v1?
- Post-handoff cart edits allowed?
- Payment cancellation → cart or void?
- Overpayment/change cash-only or all tenders?
- Zero-total sales allowed?
- Receipt before or after sync?
- Offline finalization before sync allowed?
- Reconnect-with-failed-auth classification (cross-ref 028 OQ-5).
- Manager override for failed-sync repair?
- Required smoke evidence form (script / automated regression / screenshots) for closeout.
- Tender input units: minor-units entry vs decimal entry (orthogonal UX).

## 11. Acceptance criteria

Accepted only if it: is POS-Pulse-owned + SPECIFY-ONLY (no runtime code); defines the state machine (§5) mapped to the shipped mechanism (M-1..M-4); defines transition rules (§6); money invariants (§7); scenarios A–G (§8) + cashier/offline scenarios (§9); records the `G-POS-CASHIER-SMOKE` evidence bar without registering the gate; lists open decisions (§10); preserves POS → DP-2 boundary (no POS→ERPNext); and authors no code, contract, or migration.

---

*Provenance: authored from Retail-Tower-Orchestrator Spec 029 §11 (`docs/specs/029-pos-cashier-operating-scenarios-and-smoke-gate/`) on verified POS-Pulse `origin/main` evidence. SPECIFY-ONLY; implementation is the separate, owner-gated payment-finalization-hardening lane.*
