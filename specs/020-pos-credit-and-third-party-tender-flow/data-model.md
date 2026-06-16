# Data Model: POS Credit & Third-Party Tender Flow

**Feature:** 020-pos-credit-and-third-party-tender-flow
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-16

> **Phase 1 — Design (data model).** This describes the **POS-side capture shape** and how it maps to the
> **consumed** DP-2 035 G2 contract schemas. The authoritative schemas live in DP-2's
> `settlement.yaml`; this artifact **maps to them, it does not redefine or author them**. No code,
> OpenAPI YAML, migration, package, or CI is authored. The receivable side is a **read-only projection**.

---

## E1 — Settlement Intent (POS-captured → submitted)

The till-side input the cashier composes and POS submits as the `SettlementIntentCreate` body of
`posRecordSettlementIntent`.

| Field (POS capture) | Maps to (DP-2 `SettlementIntentCreate`) | Type / constraint | Notes |
|:--|:--|:--|:--|
| Sale reference | `saleRef` | uuid, **required** | The already-captured sale (008 finalize + 011 capture-up). NOT mutated by settlement (spec FR-4). |
| Cash tendered at till | `cashTendered` | exact-decimal string or null | Part of the immutable sale; the owed remainder opens receivable(s). Converted from integer minor units at the boundary (C-4). |
| Payer responsibilities | `payers[]` | array, **required**, `minItems 1, maxItems 16` | One entry per responsible payer (co-pay + insurer split). See E2. |

Server-resolved (MUST NOT appear in the body — `additionalProperties: false`): tenant id, actor/operator
identity (resolved from the operator-authorization envelope). POS never sends them.

## E2 — Settlement Intent Payer

One responsible payer within `payers[]`.

| Field | Maps to (DP-2 `SettlementIntentPayer`) | Type / constraint | Notes |
|:--|:--|:--|:--|
| Payer account reference | `payerRef` | uuid, **required** | In-scope payer account (Console-managed). Unknown / cross-tenant → `409` unknown-payer (spec FR-9/C-2). POS references only; never creates. |
| Owed amount | `owedAmount` | `Money` (exact-decimal string), **required** | The balance this payer owes; opens/contributes to a receivable. No VAT apportioned (tax-pending, FR-10). |
| Claim metadata | `claimMetadata` | opaque object or null | Optional payer claim metadata (e.g. policy ref). Opaque in v1; POS does not interpret it. |

## E3 — Payer Account (reference only)

POS references an existing payer account; it does **not** own, create, or enumerate it as an authority
(Console 017 owns it).

| Attribute | Source | POS stance |
|:--|:--|:--|
| `payerRef` (uuid) | Console-managed | Referenced in E2. |
| category | DP-2 `PayerCategory` enum: `credit_customer \| corporate \| insurer` | Displayed/selected; not redefined. |
| display / credit-terms | Console-managed | Out of scope for POS capture. |

## E4 — Receivable (read-only projection)

DP-2-owned. Returned in `SettlementIntentResult.receivables[]`. POS displays it read-only and **never
advances or mutates** its state (intent-only boundary, spec FR-3 / C-5).

| Attribute | Source (DP-2 `SettlementIntentResult` / `Receivable`) | POS stance |
|:--|:--|:--|
| `saleRef` | result top-level | Links the opened receivable(s) to the sale. |
| receivable(s) | `receivables[]` (`maxItems 16`) | Cached for **display only**, clearly labelled DP-2-owned. |
| lifecycle state | `ReceivableState`: `open \| partially_applied \| settled \| claimed \| flagged` | Display only. **`reversal_consumed` excluded v1** (035 OQ-4). POS never transitions it. |
| outstanding balance | DP-2 `Money` | Display only; changes only via DP-2 (Console cash application), never POS. |

## Money boundary (C-4 / Constitution II)

```
POS internal: integer minor units (src/shared/money.ts)
                   |  convert ONLY at the contract boundary
                   v
Contract wire:  exact-decimal string  "120.00"   (DP-2 Money)
```

- Round-trip MUST be exact; float never decides a settlement amount.
- `owedAmount` and `cashTendered` are the only money fields POS sends; both as exact-decimal strings.
- Tax is NOT apportioned into either value (tax-pending; FR-10).

## Payer split (C-3)

- The canonical insurance case = **two** `payers[]` entries: (a) patient as `credit_customer` for any
  owed co-pay balance beyond cash, (b) insurer for the covered portion. Where the patient pays the full
  co-pay in cash at the till, only the insurer entry opens a receivable.
- Corporate/credit-on-terms = **one** `payers[]` entry, full `owedAmount`, `cashTendered` null/zero.
- POS does not artificially cap `payers[]` to 1; it honors the contract's 1..16.

## State-transition discipline (POS view)

POS is a **capture + read** participant. The only POS-driven "transition" is *submit settlement intent*
(`posRecordSettlementIntent`), whose outcome is owned by DP-2:

```
[ sale captured (008/011) + payer(s) selected (Console refs) ]
        |  POS builds SettlementIntentCreate, attaches operator envelope + Idempotency-Key
        v
  POST /api/v1/settlement/settlement-intent  (posRecordSettlementIntent)
        |
        +-- 201 -> DP-2 opened receivable(s); POS shows read-only projection (E4)
        +-- 400 -> validation failure; POS fixes & resubmits; NO partial record
        +-- 409 -> unknown/cross-tenant payer; non-disclosing error; NO silent post
        +-- 401 -> unauthorized; re-auth via operator envelope
        +-- 500 -> system failure; safe retry / re-queue (idempotent)
```

Replay with the same `Idempotency-Key` → the same single receivable outcome (no duplicate) — POS treats
the replayed `201` as the same success (FR-7; DP-2 FR-020/G5).

POS authors **no** receivable state machine: `open → partially_applied → settled`, `claimed`, and
reconciliation transitions are DP-2-owned (via Console operations); POS only displays the state DP-2
returns.

## Validation rules (POS boundary, before submit)

1. `saleRef` present and is a synced server sale id (else queue until available — C-1).
2. `payers[]` non-empty, ≤ 16; each entry has `payerRef` (uuid) and `owedAmount` (exact-decimal string).
3. `cashTendered`, if present, is an exact-decimal string ≥ "0".
4. No tenant/actor fields in the body (server-resolved).
5. No float anywhere in money fields.
6. Operator-authorization envelope present (else do not submit — FR-6).

## Out of model (explicit)

- Payer-account creation/management, cash application, claims, remittance, reconciliation (Console).
- ERPNext posting (Connector, later).
- Reversal/void/refund/insurance-rejection state (POS-014 + DP-026 + Connector Arc A).
- VAT/tax allocation (tax-pending).
- `reversal_consumed` receivable state (deferred upstream — 035 OQ-4).

---

*All entities above are mappings to DP-2's consumed contract schemas. This artifact authors no OpenAPI,
no migration, no code.*
