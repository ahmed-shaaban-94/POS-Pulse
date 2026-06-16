# Feature Specification: POS Credit & Third-Party Tender Flow

**Feature ID:** 020-pos-credit-and-third-party-tender-flow
**Status:** Proposed / Draft — SPECIFY-ONLY (for owner review). No implementation, no runtime code, no OpenAPI, no migration authored or implied.
**Created:** 2026-06-16
**Last Updated:** 2026-06-16
**Owner:** POS-Pulse (consumer); Data-Pulse-2 owns the consumed contract.
**Repo:** POS-Pulse.
**Parent producer:** Data-Pulse-2 spec `035-sale-settlement-and-receivables-model` (the settlement-and-receivables model + the G2 settlement contract that this child consumes). This is the **POS 020** child named in DP-2 035 §12 "Downstream consumers".

---

## 0. What this spec IS and IS NOT (read first)

This is a **consumer / contract-binding spec**. It defines how POS-Pulse *captures settlement
intent and payer metadata at the till and submits that intent to Data-Pulse-2* — and nothing more.

This spec **IS**:

- A definition of the POS-side capture surface for credit, corporate-account, and third-party-payer
  (insurance co-pay) sales: the cashier captures *who pays, how the tender splits, and the payer
  reference / claim metadata*, then submits **intent only** to DP-2.
- A binding to the **ratified** DP-2 035 **G2 settlement contract**
  (`packages/contracts/openapi/settlement/settlement.yaml`), consuming exactly one operation:
  **`posRecordSettlementIntent`** (`POST /api/v1/settlement/settlement-intent`) — capture intent only.

This spec **IS NOT** / **does NOT**:

- Author or edit any OpenAPI YAML. The contract is owned by Data-Pulse-2 (DP-2 035); POS consumes it.
- Author or edit any application/service/component/IPC/migration/package/lock/CI code or file.
- Apply cash, authorize a receivable, post money, or hold authoritative settlement state at the POS.
- Manage payer accounts, apply payments / cash, or reconcile claims/remittances — those are **Console**
  surfaces (`consoleCreatePayerAccount`, `consoleApplyPayment`, `consoleSubmitClaim`,
  `consoleReconcileRemittance`), out of this spec (DP-2 035 FR-017).
- Call ERPNext or the Connector. POS never touches ERPNext; financial posting is a later Connector
  consumer (DP-2 035 FR-018). All POS egress flows through DP-2 contracts.
- Define a void / refund / return / insurance-rejection workflow — those reuse the existing surfaces
  (POS-014 returns + DP-026 + Connector Arc A), per DP-2 035 NG-1.
- Compute VAT / tax allocation across payers or co-pays — tax is activation-only (tax-pending),
  per DP-2 035 §6 / FR-023 (OQ-2 deferred).
- Mark any gate satisfied or claim anything built, done, or dispatched.

---

## Overview

Today POS-Pulse can ring up and finalize a sale that is fully tendered at the counter (008 sale
finalization, 011 sale-sync capture-up, 018 cashier flow). It has **no way to represent a sale where
the payer is not the person at the till** — a credit customer paying on terms, a corporate account
invoiced monthly, or an insurer covering part of a prescription while the patient pays a co-pay.

This feature gives the cashier a way to **capture the settlement intent** for such a sale at point of
sale: the tender split (cash-now vs owed), the payer account reference(s), the co-pay vs covered
amounts, and any claim metadata. The cashier captures **intent only** — POS submits that intent to
Data-Pulse-2's settlement contract, which opens the receivable(s) and owns all settlement state. The
cashier is never blocked waiting on settlement, never applies cash against a receivable, and never
authorizes or posts money. The visible outcome: a credit / corporate / insurance-co-pay sale can be
honestly captured at the till and its unpaid balance recorded as DP-2-owned receivable(s) against the
named payer.

---

## User Scenarios & Testing

### Primary User Story

A pharmacy cashier rings up a prescription for an insured patient. The patient owes a co-pay; the
insurer covers the rest. After the cart is ready and the sale is captured (existing 008/011 path), the
cashier opens the settlement-intent capture, selects the **payer account(s)** (the insurer; the
patient-as-credit-payer if a balance is owed beyond the cash co-pay), records the **cash tendered** at
the till and the **owed amount per payer**, attaches any **claim metadata** (e.g. policy reference),
and submits. POS sends this as **settlement intent only** to Data-Pulse-2 via `posRecordSettlementIntent`.
DP-2 opens the receivable(s) for the owed balance against the named payer account(s) and returns the
opened receivable projection(s). The cashier sees a confirmation that intent was recorded and which
receivable(s) opened — and is never asked to authorize, apply cash to, or post the receivable.

### Acceptance Scenarios

Each scenario is testable against the *contract intent*; this spec authors no code to run.

1. **Capture co-pay + insurer-covered split**
   - **Given** a captured sale with a partial cash co-pay at the till and a balance owed by an insurer
     payer account that exists in the tenant,
   - **When** the cashier records the settlement intent (cashTendered = co-pay; one `payers[]` entry per
     responsible payer with `payerRef` + `owedAmount`, optional `claimMetadata`) and submits via
     `posRecordSettlementIntent`,
   - **Then** POS submits intent only; DP-2 returns `201` with the opened receivable(s) for the owed
     balance against the named payer account(s), and POS surfaces them as DP-2-owned (read-only), without
     POS applying cash, authorizing, or posting.

2. **Credit / corporate account on terms (no cash at till)**
   - **Given** a captured sale fully owed by a corporate payer account on terms (`cashTendered` null/zero),
   - **When** the cashier records settlement intent naming the corporate `payerRef` with the full
     `owedAmount` and submits,
   - **Then** DP-2 opens a single receivable against that account; the sale fact is unchanged; the
     cashier is not blocked on settlement.

3. **Unknown / cross-tenant payer reference**
   - **Given** a settlement intent naming a `payerRef` that does not exist in the tenant (or belongs to
     another tenant),
   - **When** it is submitted,
   - **Then** DP-2 returns the deterministic safe outcome `409` (unknown-payer); POS surfaces a clear,
     non-disclosing error and never silently posts to the wrong account. POS does not invent or guess a
     payer.

4. **Replay / duplicate submission is idempotent**
   - **Given** the same settlement intent re-submitted with the same `Idempotency-Key`,
   - **When** it is reprocessed,
   - **Then** DP-2 yields the same single receivable outcome (no duplicate receivable); POS treats the
     replayed `201` as the same success (G5 / FR-020).

5. **Validation failure on malformed intent**
   - **Given** an intent missing a required field (no `saleRef`, empty `payers[]`, or a `payers[]` entry
     missing `payerRef`/`owedAmount`),
   - **When** it is submitted,
   - **Then** DP-2 returns `400` validation failure; POS surfaces the failure to the cashier and does not
     record a partial/ambiguous settlement. POS validates required shape at the boundary before submit.

6. **Authorization is the operator-authorization envelope, not device-only**
   - **Given** a cashier without a valid operator-authorization envelope (031 / `operatorAuthorization`
     bearer),
   - **When** a settlement-intent submission is attempted,
   - **Then** DP-2 returns `401`; POS does not submit settlement intent on a device-token-only credential
     (consistent with the 028-arc / 016 operator-envelope boundary; DP-2 035 §8 / FR-019).

### Edge Cases

- **Split across multiple payers (co-pay + insurer):** `payers[]` carries one entry per responsible
  payer (contract allows 1..16). POS sums owed amounts independently of the immutable cash co-pay; the
  cash portion belongs to the sale, the owed portions open receivable(s).
- **Sale not yet synced to the server (offline-first):** `posRecordSettlementIntent` requires a server
  `saleRef`. POS captures and queues settlement intent following the existing outbox / capture-up
  discipline (011); intent is submitted once the referenced sale has a server `saleRef`, idempotent on
  `Idempotency-Key`. See Clarifications C-1.
- **Money is exact-decimal string:** owed amounts and cash tendered are exact-decimal strings (DP-2
  `Money` schema, "120.00") — no floats decide settlement. POS converts from its integer-minor-unit
  money model (`src/shared/money.ts`) to the contract string form at the boundary only; tax is not
  apportioned into the value (tax-pending).
- **Over-tender / change at the till:** change/overpayment is part of the existing cash sale path
  (018 money invariants); it is NOT a settlement concern. Settlement intent records the *owed* balance,
  not change due.
- **Payer account does not yet exist:** POS cannot create payer accounts (that is Console
  `consoleCreatePayerAccount`). An unknown payer is a `409`; the resolution path is "create the account
  in Console first", not a POS-side create. See Clarifications C-2.
- **Reversed / returned sale:** if the underlying sale is later voided/returned, the receivable reacts
  via the existing reversal surfaces (POS-014 + DP-026 + Connector Arc A); this spec defines **no** new
  reversal flow (DP-2 035 NG-1). `reversal_consumed` is intentionally excluded from the v1 contract.

## Requirements

### Functional Requirements

- **FR-1.** POS MUST capture, at the till, the **settlement intent** for a credit / corporate /
  third-party-payer sale: the cash tendered at the till, and one or more **payer responsibilities**
  (payer reference + owed amount + optional claim metadata). (DP-2 035 FR-003 / FR-016.)
- **FR-2.** POS MUST submit settlement intent to Data-Pulse-2 by consuming exactly the ratified G2
  operation **`posRecordSettlementIntent`** (`POST /api/v1/settlement/settlement-intent`), sending a
  `SettlementIntentCreate` body (`saleRef`, optional `cashTendered`, `payers[]` of `{payerRef,
  owedAmount, claimMetadata?}`) and consuming the `SettlementIntentResult` response. POS MUST NOT
  consume any Console-owned operation (`consoleCreatePayerAccount`, `consoleListPayerAccounts`,
  `consoleListReceivables`, `consoleGetReceivable`, `consoleApplyPayment`, `consoleSubmitClaim`,
  `consoleReconcileRemittance`).
- **FR-3.** POS MUST treat the submission as **intent only**: it MUST NOT apply cash against a
  receivable, authorize a receivable, post money, or hold authoritative settlement / receivable state.
  Any receivable state POS shows is a **read-only projection** of DP-2's `SettlementIntentResult`
  (DP-2 035 FR-016, §1 core principle).
- **FR-4.** POS MUST reference an **already-captured sale** (`saleRef`) and MUST NOT mutate the sale
  fact when recording settlement intent (DP-2 035 FR-006). The cash portion remains part of the
  immutable sale; the owed portion opens receivable(s).
- **FR-5.** POS MUST NOT block sale capture/finalization on settlement intent. An unsettled or
  partially-settled sale is a complete, valid sale (DP-2 035 FR-010); settlement intent is captured
  alongside or after the sale, never as a precondition to ringing it.
- **FR-6.** POS MUST authorize every settlement-intent submission with the **operator-authorization
  envelope** (031 / `operatorAuthorization` bearer adopted in POS-016), not a device-token-only
  credential (DP-2 035 §8 / FR-019). The backend re-evaluates the operator predicate live; POS does not
  pre-judge authorization.
- **FR-7.** POS MUST make every settlement-intent submission **idempotent** by sending an
  `Idempotency-Key` so a replay yields the same single receivable outcome (DP-2 035 FR-020 / G5),
  reusing the POS outbox idempotency discipline (011).
- **FR-8.** POS MUST handle the contract's defined outcomes deterministically and surface them to the
  cashier without leaking internals: `201` (intent recorded → show opened receivable projection),
  `400` (validation failure → fix-and-resubmit, no partial record), `409` (unknown / cross-tenant
  payer → non-disclosing error, no silent post), `401` (unauthorized → re-auth via operator envelope),
  `500` (system failure → safe retry / queue).
- **FR-9.** POS MUST treat the payer as an **account record reference**, not a system principal: the
  cashier selects an in-scope `payerRef` (uuid) supplied/managed by Console; POS neither creates payer
  accounts nor enumerates them as an authority (DP-2 035 §2, FR-001/FR-004).
- **FR-10.** POS MUST carry tax/VAT only as **placeholders** if at all; it MUST NOT compute VAT
  allocation across payers or co-pays (tax-pending; DP-2 035 §6 / FR-023, OQ-2). Owed/cash amounts are
  exact-decimal money strings with no apportioned tax.
- **FR-11.** POS MUST NOT define or invoke any void / refund / return / insurance-rejection workflow in
  this feature; those reuse POS-014 + DP-026 + Connector Arc A (DP-2 035 NG-1, FR-015).

### Non-Functional Requirements

- **NFR-1. Boundary integrity.** POS settlement-intent egress targets Data-Pulse-2 only. No POS→ERPNext
  and no POS→Connector path is introduced (Constitution Platform Integration; orchestrator architecture
  invariant). The only new remote consumption is the DP-2 035 G2 settlement operation.
- **NFR-2. Financial precision.** All money crosses the boundary as exact-decimal strings (DP-2 `Money`);
  POS converts from integer minor units at the boundary; float never decides a settlement amount
  (Constitution II — Financial Precision).
- **NFR-3. Offline / no silent loss.** Settlement intent captured while offline is durably queued and
  submitted with idempotency once the sale has a server `saleRef`; no settlement intent is silently
  dropped (Constitution I / P3 / P9; 011 outbox discipline). Status shown to the cashier is truthful
  (captured-locally vs submitted vs receivable-opened).
- **NFR-4. Auditability.** Every settlement-intent submission is attributable to the operator (envelope)
  and the referenced sale, with the idempotency key, for support reconstruction (Constitution XIII /
  P10).
- **NFR-5. Non-disclosure.** Authorization (`401`) and unknown-payer (`409`) outcomes surface as generic,
  non-disclosing messages; no factor disclosure, no cross-tenant existence disclosure (DP-2 035 §8 /
  §II/§XII).

## Success Criteria

Measurable, technology-agnostic outcomes. The feature's SPECIFY artifact is "done for review" when these
are demonstrably true of this document set.

- **SC-1.** A reviewer can trace the POS capture surface to exactly **one** consumed contract operation
  — `posRecordSettlementIntent` — with the exact request/response schemas named, and confirm **zero**
  Console- or Connector-owned operations are consumed.
- **SC-2.** A reviewer can confirm in under 2 minutes that POS captures **intent only**: no cash
  application, no receivable authorization, no money posting, no authoritative settlement state, no
  ERPNext/Connector call.
- **SC-3.** Each of the contract's five POS-visible outcomes (`201/400/409/401/500`) maps to a defined,
  deterministic cashier-facing behavior (FR-8).
- **SC-4.** The reversal non-goal is unambiguous — a reviewer can confirm no void/refund/return/insurance-
  rejection workflow is defined and that POS-014 + DP-026 + Connector Arc A are named as the reuse anchors.
- **SC-5.** A reviewer can confirm this spec authors **zero** OpenAPI/migration/code and invents **zero**
  VAT allocation rules, consistent with the SPECIFY-only claim ceiling and the tax-pending posture.
- **SC-6.** All POS-020 required gates are listed with status **NONE satisfied**, and the upstream
  dependency on the DP-2 035 G2 contract is stated explicitly.

## Key Entities

Contract-intent level; field shapes are owned by the DP-2 035 settlement contract (consumed, not
redefined here).

- **Settlement Intent (POS-captured)** — the till-side input: `saleRef`, `cashTendered` (optional,
  exact-decimal string), and `payers[]`. Submitted to DP-2; opens receivable(s). (DP-2
  `SettlementIntentCreate`.)
- **Settlement Intent Payer** — one responsible payer: `payerRef` (uuid, in-scope payer account),
  `owedAmount` (exact-decimal `Money`), optional opaque `claimMetadata`. (DP-2 `SettlementIntentPayer`.)
- **Payer Account (reference only)** — credit-customer / corporate / insurer account the receivable is
  owed by; POS references it by `payerRef`, does not own or manage it (Console owns it). Category enum:
  `credit_customer | corporate | insurer` (DP-2 `PayerCategory`).
- **Receivable (read-only projection)** — DP-2-owned money owed against the sale by a payer; lifecycle
  `open | partially_applied | settled | claimed | flagged` (DP-2 `ReceivableState`; `reversal_consumed`
  excluded in v1). POS displays the opened receivable(s) returned in `SettlementIntentResult`; it never
  advances their state.

## Assumptions

- The immutable sale fact and its server `saleRef` are produced by the existing POS sale-finalization
  (008) + sale-sync capture-up (011) path; this spec reuses them and does not redefine them.
- The operator-authorization envelope (031), adopted into POS by 016, is the credential POS attaches to
  settlement-intent submissions; this spec binds it by reference and does not re-decide auth.
- Payer accounts are created and managed in the Retail-Tower-Console (Console 017); POS only references
  an existing in-scope `payerRef`. POS cannot create a payer.
- DP-2 035's G2 settlement contract is the **ratified, non-reversal** surface; reversal-compatibility
  fields are genuinely deferred upstream (035 OQ-4) and are out of scope here.
- Tax stays deactivated (tax-pending) until G6 activation under ADR-0003; this spec apportions no VAT.
- The prior POS `0xx-insurance-copay` visual spike (insurance/co-pay tender UI exploration) is
  *exploratory prior art only*, not a ratified design; this spec supersedes it as the contract-bound
  definition of the capture surface.

## Out of Scope

- Payer-account management, payment/cash application, and claim/remittance reconciliation (Console
  surfaces: `consoleCreatePayerAccount`, `consoleApplyPayment`, `consoleSubmitClaim`,
  `consoleReconcileRemittance`).
- Posting any settlement/receivable/claim movement to ERPNext (later Connector consumer; DP-2 035 FR-018).
- Any void / refund / return / insurance-rejection workflow (reuse POS-014 + DP-026 + Connector Arc A).
- VAT / tax allocation across payers or co-pays (tax-pending; OQ-2 deferred).
- `reversal_consumed` receivable state and reversal-compatibility fields (deferred upstream — 035 OQ-4).
- Authoring or editing the settlement OpenAPI contract (owned by DP-2 035; consumed here).
- Any runtime `src/`, IPC/bridge, migration, package/lock, or CI change. The build is a separate,
  owner-gated lane after the gates below are satisfied.

## Dependencies

- **DP-2 035 G2 settlement contract** — `posRecordSettlementIntent` in
  `packages/contracts/openapi/settlement/settlement.yaml`. **This is the hard upstream dependency.** The
  contract is RATIFIED upstream (035 §10: "G2 RATIFIED 2026-06-15, PR #574"), which is what makes this
  child eligible to be specified; POS-020's *own* gates remain unsatisfied (see Gate Mapping).
- **POS 008** (sale finalization) + **POS 011** (sale-sync capture-up) — supply the immutable
  `saleRef` and the outbox/idempotency discipline reused for queuing intent.
- **POS 016 / 031 operator-authorization envelope** — the credential attached to settlement-intent
  submissions (DP-2 035 §8 / FR-019).
- **Console 017** (customer-and-payer-accounts) — the surface that creates/manages the payer accounts
  POS references by `payerRef`. POS cannot create payers.
- **POS-014 + DP-026 + Connector Arc A** — the reuse anchors for reversal/return/rejection (NG-1).
- **ADR-0003** — tax activation-only posture (tax-pending).

## Gate Mapping (POS-020 — NONE satisfied)

> Gate vocabulary below is POS-020's own. The upstream DP-2 035 **G2** (the contract) is RATIFIED — that
> is the *enabling dependency*, not a POS-020 gate. POS-020's own gates are all UNSATISFIED at SPECIFY
> time. This spec marks **no** gate satisfied.

| Gate | Meaning (POS-020) | Status |
|------|-------------------|--------|
| **G-CONTRACT-CONSUME** | DP-2 035 G2 `posRecordSettlementIntent` is consumed correctly (request/response/idempotency/security) by the eventual POS build. | **UNSATISFIED** (consumer wiring not built; SPECIFY only). |
| **G-OPERATOR-ENVELOPE** | Settlement-intent submission attaches the 031 operator-authorization envelope (POS-016), never device-token-only. | **UNSATISFIED** (binding stated; not verified by build). |
| **G-INTENT-ONLY** | POS verifiably captures intent only — no cash application, no receivable authorization, no posting, no authoritative settlement state. | **UNSATISFIED** (boundary asserted; not verified by build). |
| **G-IDEMPOTENT-OUTBOX** | Settlement-intent submission is idempotent & offline-durable via the 011 outbox discipline (no double receivable, no silent loss). | **UNSATISFIED**. |
| **G-TAX-PENDING** | POS apportions no VAT; money crosses as exact-decimal strings with no tax allocation. | **UNSATISFIED** (posture stated; not verified by build). |

Upstream enabling dependency — **DP-2 035 G2 = RATIFIED** (consumed, not owned here). No POS-020 gate is
satisfied; no claim of built/done/dispatched is made.

## Clarifications

> `/speckit-clarify` ambiguity pass over this spec (2026-06-16). Each item is classified by the
> 4-axis test (does it change the *consumed contract surface*, an *ownership boundary*, an
> *actor/identity* decision, or a *gate*?). Items that change none are NON-critical and resolved here
> with a documented default. CRITICAL items (changing one of those four) would be escalated — none were
> found (see end).

### Session 2026-06-16

**Resolved (NON-critical) — documented defaults:**

- **C-1 — When is settlement intent submitted relative to sale sync (offline-first)?** →
  *Default:* settlement intent is captured at the till immediately, but **submitted via
  `posRecordSettlementIntent` only once the referenced sale has a server `saleRef`**, queued through the
  existing POS outbox (011) and idempotent on `Idempotency-Key`. *Rationale:* the contract requires an
  already-captured `saleRef` (it does not mutate the sale); mirroring 011's capture-up + idempotency is
  the least-surprising offline-first behavior and changes no contract field, boundary, actor, or gate.
- **C-2 — What happens when the cashier needs a payer account that does not exist?** →
  *Default:* POS surfaces the DP-2 `409` unknown-payer outcome and directs the operator to have the
  account created in **Console** (Console 017); POS does **not** create payer accounts. *Rationale:*
  payer-account creation is a Console-owned operation (`consoleCreatePayerAccount`); keeping POS to
  reference-only preserves the ownership boundary (035 FR-009/FR-017).
- **C-3 — Single payer vs split (co-pay + insurer) in the POS capture v1?** →
  *Default:* support the contract's `payers[]` (1..16) so the canonical insurance co-pay + insurer-
  covered split is representable from v1; POS does not artificially cap to a single payer. *Rationale:*
  the consumed contract already permits the split; capping it would under-deliver the feature's reason
  for existing and is not required by any boundary/actor/gate. (UX layout of multi-payer entry is a
  plan-phase concern, not a spec ambiguity.)
- **C-4 — How is POS-internal integer-minor-unit money reconciled with the contract's string `Money`?** →
  *Default:* POS keeps integer minor units internally (`src/shared/money.ts`) and converts to/from the
  exact-decimal string form **only at the contract boundary**; float never decides an amount.
  *Rationale:* satisfies Constitution II and the contract `Money` shape without changing the consumed
  surface.
- **C-5 — Does POS persist receivable state returned by `SettlementIntentResult`?** →
  *Default:* POS may cache the returned receivable projection for **display only** (read-only, clearly
  labelled DP-2-owned); it never advances or mutates receivable state. *Rationale:* preserves the
  intent-only boundary (FR-3) while letting the cashier see the opened receivable; no new authority is
  introduced.
- **C-6 — Does this spec or its chain register any POS-020 gate as satisfied?** →
  *Default:* No. Gate registration/satisfaction is a later, build-time + owner concern; this chain marks
  all POS-020 gates UNSATISFIED and binds the upstream DP-2 035 G2 by reference (RATIFIED upstream, not a
  POS-020 gate). *Rationale:* status honesty; no over-claim.

**CRITICAL (would change contract surface / ownership boundary / actor-identity / gate):** **(none).**
The four load-bearing decisions are pre-settled by ground truth and recorded, not re-decided here:
(a) consumed surface = exactly `posRecordSettlementIntent` (035 G2 contract); (b) ownership boundary =
POS captures intent only, Console manages, Connector posts (035 FR-016/017/018); (c) actor/identity =
operator-authorization envelope (031), payer = account reference not principal, settlement act by
admin/accounting operator not cashier (035 §2, §8, OQ-7); (d) gates = none satisfied, upstream G2
ratified. No provisional CRITICAL flag is manufactured.

---

*Constitution alignment:* This spec MUST satisfy the principles of `.specify/memory/constitution.md`
(v1.5.1 pinned at writing). The plan and tasks artifacts perform the explicit "Constitution Check." This
SPECIFY artifact authors no code, OpenAPI, migration, package, or CI.
