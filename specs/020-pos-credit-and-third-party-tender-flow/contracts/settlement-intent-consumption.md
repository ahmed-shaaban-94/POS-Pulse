# Contract Consumption (PROSE): POS → DP-2 Settlement Intent

**Feature:** 020-pos-credit-and-third-party-tender-flow
**Plan:** [../plan.md](../plan.md)
**Spec:** [../spec.md](../spec.md)
**Created:** 2026-06-16

> **PROSE contract-consumption note — NOT an OpenAPI document.** The authoritative contract is
> Data-Pulse-2's `packages/contracts/openapi/settlement/settlement.yaml` (DP-2 035 G2, RATIFIED). POS-020
> **consumes** it; this file pins *how* POS consumes the single relevant operation. **No `.yaml`/`.yml`,
> no code, no migration is authored here.** DP-2 owns the contract; POS authors no contract artifact.

---

## 1. The single consumed operation

| | |
|:--|:--|
| operationId | **`posRecordSettlementIntent`** |
| method + path | **`POST /api/v1/settlement/settlement-intent`** |
| purpose | Record settlement intent + payer metadata at the till; opens receivable(s) for the unpaid balance against the named payer account(s). **Intent only.** |
| idempotency | **`Idempotency-Key`** header — `x-idempotency: required`. |
| security | **`operatorAuthorization`** (HTTP bearer; opaque 031 envelope). |
| request | `SettlementIntentCreate` (application/json, required). |
| response (success) | **`201`** `SettlementIntentResult`. |
| errors | `400` ValidationFailure · `401` Unauthorized · `409` Conflict (unknown/cross-tenant payer) · `500` SystemFailure. |

**POS consumes ONLY this operation.** It MUST NOT call any Console-owned operation
(`consoleCreatePayerAccount`, `consoleListPayerAccounts`, `consoleListReceivables`,
`consoleGetReceivable`, `consoleApplyPayment`, `consoleSubmitClaim`, `consoleReconcileRemittance`) and
MUST NOT call ERPNext or the Connector. Egress target: **Data-Pulse-2 only** (spec NFR-1).

## 2. Request field mapping (`SettlementIntentCreate`)

| Wire field | Required | POS source | Rule |
|:--|:--:|:--|:--|
| `saleRef` (uuid) | yes | server `saleRef` from 008/011 | Already-captured sale; NOT mutated. |
| `cashTendered` (string\|null) | no | till cash portion | Exact-decimal string; converted from integer minor units at the boundary; part of the immutable sale. |
| `payers[]` (1..16) | yes | selected payer responsibilities | Each: `payerRef` (uuid, in-scope, Console-managed), `owedAmount` (`Money` string), `claimMetadata` (opaque\|null). |

Server-resolved (never sent — `additionalProperties: false`): tenant id, actor/operator identity.

## 3. Headers

- **`Authorization: Bearer <operator-authorization envelope>`** — the 031 envelope adopted in POS-016.
  Device-token-only is refused (`401`). Backend re-evaluates the operator predicate live (spec FR-6;
  DP-2 035 §8/FR-019).
- **`Idempotency-Key: <key>`** — required. Reuses the POS outbox idempotency discipline (011). Replay →
  same single receivable, no duplicate (spec FR-7; DP-2 FR-020/G5).

## 4. Response handling matrix (deterministic, non-disclosing)

| Outcome | Meaning | POS cashier-facing behavior |
|:--|:--|:--|
| **`201`** | Settlement intent recorded; receivable(s) opened. | Show the opened receivable projection(s) **read-only** (DP-2-owned). Mark intent submitted. |
| **`400`** | Validation failure (bad/missing field). | Surface a fix-and-resubmit message. **No partial / ambiguous record.** Re-validate at the boundary (data-model §Validation). |
| **`409`** | Unknown / cross-tenant payer. | Non-disclosing error ("payer not available for this store") + direct operator to create the account in **Console**. **Never silently post to another account.** No payer guessing. |
| **`401`** | Unauthorized (no/invalid operator envelope). | Re-auth via the operator envelope. Do NOT submit on a device-token-only credential. Generic message (no factor disclosure). |
| **`500`** | System failure. | Safe retry / re-queue via the outbox; idempotent on `Idempotency-Key`; truthful "not yet submitted" status. No fake success. |

## 5. Response field mapping (`SettlementIntentResult`)

| Wire field | POS use |
|:--|:--|
| `saleRef` (uuid) | Confirm the receivable(s) link to the captured sale. |
| `receivables[]` (≤ 16, `Receivable`) | Display **read-only**: lifecycle state (`open\|partially_applied\|settled\|claimed\|flagged`) + outstanding balance. POS never transitions or mutates them. `reversal_consumed` is excluded in v1 (035 OQ-4). |

## 6. Idempotency & offline (C-1)

1. Cashier captures settlement intent at the till (may be offline).
2. POS queues the intent via the 011 outbox; it is submitted **only once the referenced sale has a server
   `saleRef`**.
3. Each submission carries the same `Idempotency-Key`; a replay (reconnect / retry) yields the **same
   single receivable** — no duplicate.
4. Status surfaced to the cashier distinguishes **captured-locally → submitted → receivable-opened**
   (truthful states; no fake success).

## 7. Boundary assertions (verifiable non-goals)

- **No POS→ERPNext.** POS never calls ERPNext. Financial posting is a later Connector consumer (035
  FR-018).
- **No POS→Connector.** Not in the POS path.
- **No Console-owned operation consumed.** POS captures intent only; manage/apply/reconcile is Console.
- **No reversal workflow.** Void/refund/return/insurance-rejection reuse **POS-014 + DP-026 +
  Connector Arc A** (035 NG-1, FR-015). This feature defines none.
- **No VAT apportionment.** Money is exact-decimal string with no tax allocation (tax-pending; 035
  §6/FR-023; ADR-0003).
- **No contract authored.** DP-2 owns `settlement.yaml`; POS authors no OpenAPI.

---

*Prose-only. The binding source is DP-2's ratified `settlement.yaml`; this note pins POS consumption and
authors no OpenAPI/code/migration.*
