# Quickstart: POS Credit & Third-Party Tender Flow

**Feature:** 020-pos-credit-and-third-party-tender-flow
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-16

> **Developer path for the later, owner-gated build lane** that consumes the ratified DP-2 035 G2
> settlement contract. This quickstart is **design documentation** — it describes the consumption flow a
> developer would implement, not code authored by this chain. **No `src/`, OpenAPI, migration, package,
> or CI is authored here.** All POS-020 gates remain UNSATISFIED.

---

## Prerequisites (verified ground truth)

- The DP-2 035 **G2 settlement contract** is RATIFIED and available
  (`packages/contracts/openapi/settlement/settlement.yaml`); the generated client exposes
  `posRecordSettlementIntent`. POS authors no OpenAPI — it consumes the generated client.
- The sale exists and has a **server `saleRef`** (POS 008 finalize + 011 capture-up).
- A valid **operator-authorization envelope** (031 / POS-016) is available.
- The target **payer account(s)** exist in the tenant (created/managed in Console 017); POS has their
  `payerRef`(s). POS cannot create payers — an unknown payer is a `409`.

## End-to-end consumption flow

```
1. Obtain saleRef         (008 finalize + 011 capture-up; do NOT mutate the sale)
2. Select payerRef(s)     (Console-managed accounts; e.g. patient credit + insurer)
3. Build SettlementIntentCreate:
      saleRef
      cashTendered?        (exact-decimal string from integer minor units, boundary-converted)
      payers[1..16]:       { payerRef, owedAmount (Money string), claimMetadata? }
4. Attach headers:
      Authorization: Bearer <031 operator envelope>
      Idempotency-Key: <stable key>     (reuse 011 outbox discipline)
5. POST /api/v1/settlement/settlement-intent   (posRecordSettlementIntent)
6. Handle outcome:
      201 -> render SettlementIntentResult.receivables[] READ-ONLY (DP-2-owned)
      400 -> fix-and-resubmit (no partial record)
      409 -> non-disclosing unknown-payer error; create account in Console
      401 -> re-auth via operator envelope (never device-token-only)
      500 -> safe retry / re-queue (idempotent on Idempotency-Key)
```

## Worked example — insurance co-pay split (illustrative shape, not code)

A prescription: patient pays a cash co-pay at the till; the insurer covers the rest; assume a small
residual is owed by the patient on account.

```
SettlementIntentCreate:
  saleRef:      "<uuid of the captured, synced sale>"
  cashTendered: "15.00"            # patient cash co-pay at the till (part of the immutable sale)
  payers:
    - payerRef:   "<patient credit account uuid>"
      owedAmount: "5.00"           # residual owed on account beyond the cash co-pay
    - payerRef:   "<insurer account uuid>"
      owedAmount: "80.00"          # insurer-covered portion
      claimMetadata: { "policyRef": "<opaque>" }
```

On `201`, DP-2 returns the opened receivable(s) (e.g. one against the patient account, one against the
insurer account), each in an initial `open` state with an outstanding balance. POS renders them
**read-only** and never transitions them.

> Money values are exact-decimal strings; no VAT is apportioned (tax-pending). The cashier never applies
> cash to, authorizes, or posts these receivables — that is the Console admin/accounting operator's act
> (`consoleApplyPayment`), out of this feature (035 OQ-7).

## Worked example — corporate account on terms (no cash)

```
SettlementIntentCreate:
  saleRef:      "<uuid of the captured, synced sale>"
  cashTendered: null
  payers:
    - payerRef:   "<corporate account uuid>"
      owedAmount: "<full sale total as Money string>"
```

`201` → a single receivable opened against the corporate account; the sale fact is unchanged; the
cashier was never blocked.

## What you will NOT do here

- Call any Console operation (manage accounts, apply cash, submit/reconcile claims).
- Call ERPNext or the Connector.
- Author or edit the settlement OpenAPI (DP-2 owns it).
- Apply cash, authorize a receivable, post money, or hold authoritative settlement state.
- Compute VAT / tax allocation.
- Define any void/refund/return/insurance-rejection flow (reuse POS-014 + DP-026 + Connector Arc A).

## Status

SPECIFY/PLAN/TASKS level. All POS-020 gates (G-CONTRACT-CONSUME, G-OPERATOR-ENVELOPE, G-INTENT-ONLY,
G-IDEMPOTENT-OUTBOX, G-TAX-PENDING) are **UNSATISFIED**. The upstream DP-2 035 G2 contract is RATIFIED
(consumed by reference). Nothing here is built, done, or dispatched.

---

*Design documentation for the build lane. Authors no code, OpenAPI, migration, package, or CI.*
