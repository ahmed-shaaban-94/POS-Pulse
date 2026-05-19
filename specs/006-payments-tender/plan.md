> ## STATUS: DRAFT — BLOCKED — NOT APPROVED FOR IMPLEMENTATION
>
> This plan is a **planning skeleton only**. It commits to **no** source
> files, **no** migrations, **no** OpenAPI changes, **no** package
> additions, **no** bridge namespaces, **no** FSM state names that bind
> code, and **no** approval gates that may be unblocked by this PR.
>
> **Upstream functional prerequisites are cleared (2026-05-19):** 004
> S4/S5 ✅ complete 2026-05-14; 005-sales-cart ✅ approved with T100
> functional sign-off 2026-05-19 (PR #181); `PaymentIntentEnvelope v1`
> ✅ ratified 2026-05-17. §A0 is functionally cleared but procedurally
> held — implementation remains blocked until the full Spec Kit re-run
> (`/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` →
> `/speckit-analyze`) completes. See [./coordination.md](./coordination.md).

# Implementation Plan: Payments & Tender

**Feature ID:** 006-payments-tender
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 0.1 (draft)
**Created:** 2026-05-09
**Constitution version pinned:** v1.5.1
**Branch (this PR):** `docs/006-payments-tender-spec-draft`
**Branch (future implementation):** `006-payments-tender` (not yet created)

---

## Summary

006-payments-tender introduces the rule layer that runs once an approved
checkout-ready cart (owned by 005) is handed to the POS shell. The spec
locks in product behaviour for **cash tender only**, with future tender
types reserved as visible-but-disabled slots. This plan is intentionally
**non-binding**: the implementation choices that 004 was free to make are
*not* free here, because the cart contract on which payments depends does
not yet exist.

This plan therefore captures what 006 would **need to decide** once
unblocked, and **defers each decision** to a post-approval revision. Every
"choice" below is presented as **(a) what's known to be true regardless
of the missing contracts**, and **(b) what is deferred**.

## Technical Context (deferred)

| Area | What 006 already knows | Deferred |
|:--|:--|:--|
| Runtime / packaging | Inherits 001/004: Electron 40, React 19, Vite 8, TS 5 strict, Tailwind 4 | n/a |
| Money semantics | Integer minor units only (Constitution P-II) | n/a |
| Identity | Operator identity is the 004 Clerk-backed operator session (spec FR-013, FR-014) | n/a |
| Audit events | Inherit 004 FR-025 / FR-026 catalogue; payment categories proposed but not finalised | Final closed set of `payment.*` action categories — pending review with 004 catalogue post-S4 |
| Cart-handoff slot shape | **Owned by 005, not 006** | Pending 005 spec |
| Payment FSM state names | Spec uses `idle / started / settled / cancelled / failed` as **product behaviour**, not as code identifiers | Final code-facing names deferred until implementation |
| Bridge surface | None proposed by this plan | A future plan revision will propose a `payments.*` namespace **only after 005 ↔ 006 handoff is contracted** |
| Local persistence | None proposed by this plan | Migrations and table shapes deferred to per-slice approval (analogous to 004 §A3) |
| OpenAPI | None proposed by this plan | Backend coordination deferred until 005 closes (analogous to 004 §A2) |
| Codegen | Not invoked by this PR | n/a |
| Tests | Vitest only (Constitution VI). Test-first per Constitution VI when implementation begins | Coverage targets deferred to a later plan revision; ≥ 95 % on any money-math module is non-negotiable per Constitution P-II |
| CI | No workflow changes proposed | n/a |

## Hard Non-Implementation Boundaries

In addition to the boundaries inherited from 003 / 004, this plan adds:

- **No cart logic.** Cart shape, cart edits, cart totals, line items, cart
  persistence — all owned by 005.
- **No receipts logic.** Rendering, printing, retention — owned by future
  receipts spec.
- **No inventory mutation.** Owned by future inventory spec.
- **No shift financial maths.** Drawer reconciliation, expected total,
  variance, shortage, overage — owned by future shift-management spec.
- **No card / wallet / split tender.** Future tender features.
- **No refunds / returns.** Future spec.
- **No real card processor integration.**
- **No backend / API implementation.**
- **No migrations.** **No** `npm run codegen:api`.
- **No `src/**` source changes** from this spec.
- **No Data-Pulse-2 changes.** This is a POS-Pulse desktop spec only.

Any task that drifts into the above MUST be filed as a separate feature.

## Architectural Decisions (deferred)

This plan does **not** lock architectural decisions, because:

1. The handoff contract on which payment-surface architecture would
   build does not exist (005 is empty).
2. The 004 audit-event catalogue is not yet frozen at the
   payment-category level (S4 / S5 still open).
3. Locking decisions now would create rework once upstream contracts
   land.

The following are documented **as questions** for the post-approval plan
revision:

- **AD-DEFERRED-1**: Where is the payment FSM owned — renderer
  (`zustand` slice), main process (singleton service), or split? Cannot
  be answered until the cart-handoff slot's persistence model is known.
- **AD-DEFERRED-2**: Is the payment-attempt record local-first
  (mirrors 004's `audit_events`) or backend-first? Depends on 005's
  handoff-slot persistence semantics.
- **AD-DEFERRED-3**: Bridge-API namespace shape (`payments.*`?
  `tender.*`? a verb-grouped surface like `payments.start` /
  `payments.confirm`?) — deferred until handoff contract pins the inputs.
- **AD-DEFERRED-4**: Force-fail (FR-021) authorisation flow shape —
  inline manager re-auth on the payment surface vs. a dedicated
  manager incident-response surface — pending 004 S5 review of
  manager-only surface conventions.
- **AD-DEFERRED-5**: Offline cash settlement — see spec OQ-OFF-1…4.
  Cannot be decided here.
- **AD-DEFERRED-6**: Drawer-impact signal shape — see spec
  OQ-DRW-1…4. Owned by future shift-management spec; 006 only emits
  audit events.

Each AD-DEFERRED-N has a row in [./coordination.md](./coordination.md)
under "Open questions".

## Approval Gates (proposed, all held)

> All gates below are **held**. None are cleared by this PR. Gate
> identifiers mirror the 004 convention so cross-feature operators can
> read both ledgers identically.

| Gate | What it gates | Status |
|:--:|:--|:--:|
| **§A0** | Upstream readiness: 004 S4/S5 closed AND 005-sales-cart spec approved AND 005 ↔ 006 handoff contract pinned (in 005). **§A0 must clear before any other 006 gate may be opened.** | ✅ Functionally cleared 2026-05-19 — **procedurally held** until `/speckit-clarify` re-run merges |
| **§A1** | Visual-direction Slice 0 (FR-033 inherited from 004) — payment surface, tender selection, cash entry, change display, success / cancel / failure variants, force-fail manager surface. | ⛔ Held — gated on §A0 |
| **§A2** | Backend / OpenAPI: any backend dependency for payment settlement (currently expected: none for cash, possibly some for force-fail audit propagation). | ⛔ Held — gated on §A0; may be moot for cash-only scope |
| **§A3** | Migrations: any local SQLite tables 006 introduces. Currently none planned because the audit-event store from 004 is the audit sink. | ⛔ Held — likely no-op, but explicit no-op approval required before code lands |
| **§A4** | Bridge-API surface: the `payments.*` (or equivalent) namespace, post-handoff-contract pinning. | ⛔ Held — gated on §A0 + AD-DEFERRED-3 |
| **§A5** | Production readiness (analogous to 004 §A5): coverage thresholds met, security review (P8), Sentry redaction, audit-event sample audited. | ⛔ Held — blocks rollout, not slice merge |

## Slices (proposed, all blocked)

> Slice numbering is **proposed only**. The actual slicing is finalised
> in a later plan revision under the standard Spec Kit flow once §A0
> clears.

- **Slice 0 — Visual direction (no code).** Mirrors 004's Slice 0.
  Required by FR-033 (inherited from 004). Held until §A0 clears.
- **Slice 1 — Tender-selection surface (cash-only).** Renders the
  tender-selection step from an approved-cart handoff. Cash button
  active, others reserved-but-disabled. **Held until §A0 + §A1.**
- **Slice 2 — Cash entry + change rule.** Implements the
  `cash_received_minor` integer entry control and the
  `cash_received_minor − total_minor` rule. **Held until Slice 1
  merged + §A4 cleared.**
- **Slice 3 — Payment FSM + audit events.** Implements the
  `idle → started → (settled | cancelled | failed)` machine and
  emits canonical audit events under 004 FR-025 / FR-026.
  **Held until Slice 2 merged + §A2 / §A3 / §A4 review.**
- **Slice 4 — Force-fail (manager-only).** FR-021. **Held until 004
  S5 manager-surface conventions land.**
- **Slice 5 — Production-readiness wrap.** Coverage, redaction
  audit, security-review handoff. **Held until §A5.**

Each slice's per-task work list is the responsibility of the **future
revision** of [./tasks.md](./tasks.md), not this draft.

## Test Strategy (deferred)

> Constitution VI requires test-first. The shape of those tests cannot
> be authored until the handoff contract exists.

- **Money-math floor**: any helper that touches `cash_received_minor`,
  `total_minor`, or change-due MUST hit ≥ 95 % coverage (Constitution
  P-II / 004 plan precedent for `Money`).
- **Audit-event integrity floor**: any helper that emits payment
  audit events MUST hit ≥ 95 % coverage (parallels 004's role-
  enforcement / PIN-verifier modules).
- **State-machine integrity**: every legal transition and every
  illegal-transition refusal MUST have a unit test.
- **Bridge-surface contract**: when the bridge namespace is defined
  (post §A4), it gets a contract test that compiles against
  `contracts/bridge-api.md` (analogous to 004 T008).

Detailed test plans (file paths, fixture shapes) are deferred to
the post-approval plan revision.

## CI / packaging

This plan introduces no CI workflow changes and no electron-builder
configuration changes. The existing `codegen:verify → typecheck →
lint → test → package:dir` pipeline gates this feature when
implementation begins. No new artefacts are produced by this PR.

## Risks and concerns

- **R-1 — ✅ RESOLVED 2026-05-19.** 005-sales-cart is fully authored and
  approved; `PaymentIntentEnvelope v1` is ratified. The cart-handoff shape
  is locked. See `specs/005-sales-cart/contracts/handoff-envelope.md`.
  This risk is retired; the remaining procedural step is `/speckit-clarify`.
- **R-2 — Payment audit-event categories vs. 004 catalogue.** 004
  FR-026 enumerates a starter set; payment-specific categories
  (`payment.settled`, `payment.cancelled`, `payment.failed`,
  `payment.force_failed`) are proposed in the spec but must be
  reviewed against the 004 catalogue before being finalised. Mitigation:
  resolve in the post-approval clarify pass.
- **R-3 — Force-fail authorisation UX (FR-021)** parallels 004's
  forced-close manager flow (FR-024). Reuse of 004's manager-surface
  conventions is desirable but not yet pinnable until 004 S5 closes.
- **R-4 — Offline cash settlement** is a real product question (cash
  works without backend), but a wrong answer creates either a
  reconciliation hole (if rejected when offline) or a stuck-attempt
  risk (if allowed without contract). Mitigation: defer to a dedicated
  offline-payments review (spec OQ-OFF-1…4).
- **R-5 — Drawer impact** crosses into shift-management territory.
  Mitigation: 006 emits **audit events** only; downstream specs read
  them. No drawer-state writes from 006.

## Compliance with the Constitution (preview)

This plan affirmatively respects:

- **Principle II — Financial Precision.** Money is integer minor units
  only. Change due is computed as `cash_received_minor − total_minor`.
- **Principle III — Electron Process-Boundary Discipline.** No upward-
  of-bridge IPC; any future `payments.*` namespace is added under
  explicit security review (analogous to 004 Slice 2).
- **Principle V — Type Safety End-to-End.** The (future) bridge
  surface, FSM, and audit-event payloads MUST be typed and compile
  in strict mode.
- **Principle VI — Test-First, Coverage-Gated.** Every implementation
  task in the (future) tasks.md is preceded by a failing test.
- **Principle VIII — Terminal Identity is Independent of User
  Identity.** Operator attribution (FR-013 / FR-014) uses the 004
  Clerk-backed operator identity; never the device token, never the
  cashier PIN record.
- **P2 — No Fake Success States.** A `failed` payment is loud.
- **P4 — Auditability and Non-Destructive Financial Correction.** All
  state transitions emit append-only audit events.
- **P6 — No Raw Cardholder Data by Default.** 006 captures none.
- **P7 — Secrets Never Reach Renderer or Logs.** 006 has no secrets.
- **P8 — Electron Security Boundary.** Preserved.
- **P10 — Operator Accountability for Sensitive Actions.** All
  payment actions attributed to the signed-in operator (FR-013).

## Out of scope, restated

- Cart editing.
- Receipts implementation.
- Inventory mutation.
- Reports / KPIs / analytics.
- Shift financial calculations.
- Real card processor integration.
- Refunds / returns.
- Backend / API implementation.
- Migrations / codegen.
- UI implementation.
- Data-Pulse-2 changes.

---

## Next steps (post-approval)

When (and only when) §A0 clears:

1. Re-enter the Spec Kit flow with `/speckit-clarify` against the
   spec's `[NEEDS CLARIFICATION]` markers and the OQ-OFF / OQ-DRW
   open-question lists.
2. Author `research.md` (no source files; questions answered).
3. Author `data-model.md` (audit-event payloads only — no new
   tables expected).
4. Author `contracts/` (bridge-API namespace, role-visibility-matrix
   row additions).
5. Author `quickstart.md`.
6. Re-author `tasks.md` from the proposed grouping in this draft into
   a slice-organised, gate-explicit, dependency-aware list.
7. Open Slice 0 (visual direction) under §A1.
