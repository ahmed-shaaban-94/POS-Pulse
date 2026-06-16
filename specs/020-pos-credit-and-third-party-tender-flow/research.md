# Research: POS Credit & Third-Party Tender Flow

**Feature:** 020-pos-credit-and-third-party-tender-flow
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-16

> **Phase 0 — Research.** This artifact records the **verified ground truth** the plan binds to. Because
> the four load-bearing decisions (consumed contract surface, ownership boundary, actor/identity, gates)
> are pinned by upstream ground truth, Phase 0 is mostly *recording* facts, not resolving open questions.
> The remaining non-critical ambiguities were resolved in spec.md `## Clarifications` (C-1..C-6). No
> NEEDS CLARIFICATION remains. **No code, OpenAPI, migration, package, or CI is authored here.**

---

## R1 — Consumed contract surface (verified)

**Source (read-only):** Data-Pulse-2 `origin/main:packages/contracts/openapi/settlement/settlement.yaml`
(the RATIFIED DP-2 035 G2 contract — 035 §10: "G2 RATIFIED 2026-06-15 (T012), PR #574, `cb4a7e5`").

POS-020 consumes **exactly one** operation:

| Property | Value (verified from `settlement.yaml`) |
|:--|:--|
| operationId | `posRecordSettlementIntent` |
| path / method | `POST /api/v1/settlement/settlement-intent` |
| tags | `settlement-pos` |
| idempotency | `x-idempotency: required` (header `Idempotency-Key`) |
| security | `operatorAuthorization: []` (HTTP bearer, opaque 031 envelope) |
| request body | `SettlementIntentCreate` (required) |
| success | `201` → `SettlementIntentResult` |
| errors | `400` ValidationFailure · `401` Unauthorized · `409` Conflict (unknown / cross-tenant payer) · `500` SystemFailure |

**NOT consumed by POS-020** (Console- or Connector-owned, verified present in the same contract):
`consoleCreatePayerAccount`, `consoleListPayerAccounts`, `consoleListReceivables`,
`consoleGetReceivable`, `consoleApplyPayment`, `consoleSubmitClaim`, `consoleReconcileRemittance`.
POS references payer accounts only; it never manages them, applies cash, submits claims, or reconciles.

### Schema facts (verified)

- `SettlementIntentCreate`: `required [saleRef, payers]`; `saleRef` uuid (already-captured sale, NOT
  mutated); `cashTendered` exact-decimal string or null; `payers` array `minItems 1, maxItems 16` of
  `SettlementIntentPayer`. `additionalProperties: false` (server resolves tenant/actor — they MUST NOT
  appear in the body).
- `SettlementIntentPayer`: `required [payerRef, owedAmount]`; `payerRef` uuid (in-scope payer account;
  unknown/cross-tenant → `409`); `owedAmount` = `Money`; `claimMetadata` opaque object or null.
- `SettlementIntentResult`: `required [saleRef, receivables]`; `receivables` array `maxItems 16` of
  `Receivable`.
- `PayerCategory` enum: `credit_customer | corporate | insurer` (v1 set; extensible).
- `ReceivableState` enum: `open | partially_applied | settled | claimed | flagged`. **`reversal_consumed`
  is intentionally EXCLUDED** in v1 (lands in a later additive bump after DP-026 closes — 035 OQ-4).
- `Money`: exact-decimal **string** ("120.00"); no floats (§III); tax NOT apportioned into the value
  (tax-pending, OQ-2).

## R2 — Ownership boundary (verified, DP-2 035 §2 / FR-016..018)

| Role | Responsibility | POS-020 stance |
|:--|:--|:--|
| **POS-Pulse** | Capture **settlement intent + payer metadata** at the till; submit to DP-2. | This feature. Intent only. |
| **Console** | Manage payer accounts, receivable balances, cash application, claim/remittance reconciliation. | Out of scope (Console 017/018/019). |
| **Connector** | Later consumer; posts approved movements to ERPNext. | Out of scope; never in POS path. |
| **Data-Pulse-2** | Authority; owns settlement state, receivable lifecycle, idempotency, audit, isolation, the G2 contract. | Producer; POS consumes its contract. |

Core principle (035 §1): **the sale fact is immutable; settlement is a separate lifecycle layered over
it.** POS captures intent; it never authorizes a receivable, applies cash, posts money, or holds
authoritative settlement state.

## R3 — Actor / identity (verified, DP-2 035 §2, §8, OQ-7)

- **Authorization:** the **031 operator-authorization envelope** (`operatorAuthorization` bearer, opaque,
  DP-2-issued `pos_operator`), adopted into POS by 016. Device-token-only is insufficient for settlement
  writes. The backend re-evaluates the operator predicate (membership/device/store/role/non-expiry) LIVE;
  any refusal collapses to a generic `401` (no factor disclosure).
- **Payer = account record, not a principal.** The insurer/corporate/credit payer is modeled as a payer
  account the receivable is owed by (referenced by `payerRef`); it is not a system user.
- **The settlement *act* vs intent capture (OQ-7 7-C).** The cashier **captures intent** — which *is* the
  `posRecordSettlementIntent` call. The settlement **act** (cash application / payment entry) is performed
  by the **Console admin/accounting operator** via `consoleApplyPayment`, never by the cashier. DP-2 owns
  the operational receivable + cash-application truth; ERPNext owns the accounting Payment Entry as a
  reconciled valuation projection (referenced by external refs); POS/Console never call ERPNext directly.

## R4 — Offline / money / tax decisions (chosen defaults; see spec Clarifications)

- **C-1 (offline sequencing):** capture intent at the till immediately; **submit only once the sale has a
  server `saleRef`**, queued via the 011 outbox, idempotent on `Idempotency-Key`. The contract requires an
  already-captured `saleRef` and does not mutate the sale, so capture-up + idempotency (011) is the
  least-surprising offline-first behavior.
- **C-4 (money):** POS keeps integer minor units internally (`src/shared/money.ts`); converts to/from the
  exact-decimal string `Money` **only at the contract boundary**; float never decides a settlement amount.
- **Tax-pending (OQ-2 / ADR-0003):** POS computes NO VAT apportionment across payers / co-pays; money
  carriers are placeholders only.

## R5 — Prior art (verified)

- POS `origin/main:specs/0xx-insurance-copay/visual-spike/` is an **exploratory** insurance/co-pay tender
  UI spike (`InsuranceTenderSpike.tsx`, `copay-math.ts`, preview render). It is **not** a ratified design
  and is **not** contract-bound. This feature **supersedes** it as the contract-bound definition of the
  capture surface; nothing from the spike is inherited as authority.
- Reuse anchors for reversal/return/rejection: **POS-014** (POS return flow) + **DP-026** (returns/reversal
  contract) + **Connector Arc A** (forward-feed reversal posting). POS-020 defines no competing reversal
  workflow (035 NG-1, FR-015).

## Alternatives considered (and rejected)

- **Submit intent synchronously, blocking the sale on settlement.** Rejected: violates the core principle
  (capture never waits on settlement, 035 FR-010) and Offline-First (Constitution I). Chose
  capture-then-queue (C-1).
- **POS creating payer accounts when one is missing.** Rejected: payer-account creation is the Console-
  owned `consoleCreatePayerAccount`; POS creating payers would breach the ownership boundary (035
  FR-009/017). Chose reference-only + `409` → "create in Console" (C-2).
- **Capping POS to a single payer in v1.** Rejected: the contract permits `payers[]` 1..16 and the
  canonical co-pay + insurer split is the feature's reason to exist; capping would under-deliver. Chose to
  support the contract split (C-3).
- **Authoring a POS-side settlement OpenAPI / receivable state machine.** Rejected: DP-2 owns the contract
  and settlement state (035); POS authors no YAML and holds no authoritative settlement state. Chose
  consume-only + read-only projection.

## Traceability note (filled at Polish — see tasks T020)

Spec FR-1..FR-11 and NFR-1..NFR-5 each map to a section of data-model.md / contracts/
settlement-intent-consumption.md / quickstart.md, satisfying Success Criteria SC-1..SC-6. The artifact
set authors zero OpenAPI/code/migration/package/CI and invents zero VAT allocation rules (SC-5).

---

*Phase 0 complete: no open NEEDS CLARIFICATION remains; the four load-bearing decisions are pinned by
ground truth and the six non-critical clarifications are resolved (spec C-1..C-6).*
