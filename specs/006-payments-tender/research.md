# Research: 006-payments-tender (Phase 0 — plan v1.0)

**Feature ID:** 006-payments-tender
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-19
**Constitution version pinned:** v1.5.1

> Phase 0 research backing the locked architectural decisions in
> [./plan.md](./plan.md) §"Architectural Decisions (LOCKED in v1.0)".
> Every AD-1..AD-9 and every OQ-PLAN-1..9 from
> [./spec.md](./spec.md) §"`/speckit-plan` open questions" is recorded
> here with Decision / Rationale / Alternatives considered.
>
> **No code, no contracts, no migrations are authored by this file.**
> The data-model lives in [./data-model.md](./data-model.md); the
> bridge contract lives in [./contracts/bridge-api.md](./contracts/bridge-api.md).

---

## R-1 — FSM ownership: main process

**Decision.** Both the `PaymentAttempt` FSM and the `TenderLine` FSM
are owned by the **main process**. The renderer is display + input
only.

**Rationale.**

1. Constitution §III (NON-NEGOTIABLE) requires the renderer to be
   untrusted for any state, role, totals, or attribution.
2. The TenderLine FSM crosses the Data-Pulse-2 voucher-authority
   boundary (Contract V-A); that call must happen main-side because
   the renderer never receives the voucher-authority credentials
   (Constitution §P7).
3. Split-tender rollback (FR-006B) requires atomic mutation of
   multiple persisted rows under one transaction; the renderer
   cannot guarantee atomicity across a network of bridge calls.
4. Process-restart survival: the main process rehydrates the FSM
   from SQLite on app start; the renderer cannot survive its own
   reload without losing state.

**Alternatives considered.**

- **Renderer-side FSM with main-side audit emission.** Rejected:
  every alternative also requires main-side voucher authority +
  main-side persistence + main-side role gate, leaving the renderer
  duplicating logic that must remain untrusted anyway. Dual
  ownership is worse than single ownership.
- **Split FSM (attempt in main, line in renderer).** Rejected: the
  TenderLine FSM mutates persistence (`payment_tender_lines.state`)
  and emits audit events on every transition; that's exclusively
  main-side work.

**Resolves:** AD-DEFERRED-1, AD-1.

---

## R-2 — Bridge namespace + refusal-envelope reconciliation

**Decision.**

- **Namespace split.** `payments.*` (attempt-level: `start`,
  `confirm`, `cancel`, `forceFail`, `subscribe`, `read`,
  `discardOnSessionEnd`) + `tender.*` (per-line: `apply`, `reverse`,
  `read`).
- **Refusal envelope field name.** `{ kind: 'refused', reason: '...' }`
  (mirrors 005's `cart.*` namespace).

**Rationale (namespace split).** Split-tender attempts invoke
`tender.apply` N times against a single `payments.start`-created
attempt. A unified `payments.*` namespace would require either an
overloaded `payments.start({ tenders: [...] })` API (which forces
the entire multi-line UX into a single transaction the cashier
cannot iterate on) or a `payments.applyLine` handler that conflates
two concepts in the audit catalogue. Split keeps 1:1 alignment
between bridge calls and `payment.*` / `tender.*` audit-event
categories — the same separation 005 chose for `cart.*` vs.
`cart.line.*` operations.

**Rationale (refusal field name — 004 vs 005 divergence).** The two
predecessor contracts diverged:

- **004 `operator.*`** uses `{ kind: 'refused', category: '...' }`
  (`OperatorRefusal` interface).
- **005 `cart.*`** uses `{ kind: 'refused', reason: '...' }`.

Both are semantically equivalent (a closed enum of denial-reason
codes wrapped in a tagged-union response). 006 picks **`reason`**
because (a) 005 is the closer structural template — `cart.*` →
`payments.*` is one feature-pair; (b) `reason` reads more naturally
for per-action diagnostics ("the reason this apply was refused");
(c) renderer translation logic is identical either way (mapping
enum → generic message). The divergence from 004 is **deliberate
and documented**; future plans may revisit if 004 ever harmonises
to `reason`.

**Alternatives considered.**

- **Unified `payments.*` namespace.** Rejected per the audit-catalogue
  argument above.
- **`tender.*` only (no `payments.*` attempt-level namespace).**
  Rejected: attempt-level operations (`start`, `confirm`, `cancel`,
  `forceFail`) are conceptually distinct from per-line operations and
  deserve their own namespace for review-comprehension and role-gate
  enforcement.
- **`{ kind: 'refused', category: '...' }`** (align with 004).
  Rejected for the reason given above. The cost of one feature-to-feature
  divergence is lower than the cost of forcing the closer structural
  predecessor (005) to harmonise.

**Resolves:** AD-DEFERRED-3 (namespace portion), OQ-PLAN-2.

---

## R-3 — Cashier cancel UX target

**Decision.** On cashier-initiated `payments.cancel`, after the main
process reverses every applied TenderLine per FR-006B, the **renderer
returns to tender selection** with the envelope still bound. The
envelope remains immutable and re-runnable.

**Rationale.**

1. The envelope is unchanged; the cashier almost always retries with
   a different tender mix (e.g., the customer changed their mind
   between voucher and cash). Forcing them out to the 005 cart-edit
   surface and re-handing-off costs a click and adds a stale-handoff
   race.
2. Mirrors the 004 takeover/sign-out UX pattern: land the user back
   at the closest actionable surface. Patterns the cashier already
   knows.
3. The renderer copy ("Payment cancelled. You can take payment
   again.") is generic and non-shaming per FR-022 / NFR-003.

**Alternatives considered.**

- **Return to a re-runnable handoff state.** Rejected: introduces a
  distinct UI state with no product benefit; equivalent to "tender
  selection" but harder to reason about.
- **Exit to 005 cart-edit.** Rejected: cart-edit is owned by 005 and
  is read-only post-handoff (005 §FR-035 / Immutability). The 005
  bridge would need an explicit "unfreeze" handler, which would
  violate 005's frozen-handed-off invariant.

**Resolves:** AD-DEFERRED-3 (UX portion), AD-4.

---

## R-4 — Force-fail UX: dedicated manager surface, Slice 4

**Decision.** Force-fail (FR-021) is a **dedicated manager / admin
incident-response surface** in Slice 4 — not inline manager re-auth on
the cashier surface. Main-process role gate is primary; renderer
guard is secondary; manager identity never echoes to cashier-visible
UI.

**Rationale.**

1. 004 S5 (PRs #133–#143) established the manager-only
   incident-response surface pattern with `force_close_shift`,
   `unlock_cashier`, `reset_cashier_pin`. Force-fail is structurally
   identical — an incident-response action for a stuck attempt — and
   should reuse 004's pattern.
2. Inline manager re-auth on the cashier screen would either leak
   manager identity into the cashier viewport (violates FR-021 last
   clause) or require a modal-over-modal pattern that clashes with
   the cashier's tender-selection flow.
3. Deferring to Slice 4 lets Slices 1–3 ship without the manager
   surface (which has its own §A1 visual-direction commission), so
   the cash + external_card_terminal + split-tender framework can
   reach customer faster.

**Alternatives considered.**

- **Inline manager re-auth.** Rejected per the identity-leakage
  argument above.
- **Force-fail in Slice 3.** Rejected: Slice 3 is already
  load-bearing (FSM + persistence + bridge); adding the
  manager-incident-response surface would couple §A1 sign-off for two
  distinct surfaces into one slice.
- **Force-fail permanently deferred (Slice 5+).** Rejected: an
  in-production POS without a force-fail recovery path leaves any
  stuck `started` attempt blocking the terminal until a manual SQL
  edit; that's incident-response debt we should not ship with.

**Resolves:** AD-DEFERRED-4, AD-5.

---

## R-5 — `external_card_terminal` reference field policy

**Decision.** The optional `external_reference` field on
`external_card_terminal` TenderLines **exists in v1**, with the
following normative policy:

| Aspect | Rule |
|:--|:--|
| Optionality | Optional. Absent value MUST be allowed. |
| Format | Regex `^[A-Z0-9]{0,6}$` (uppercase alphanumeric, max 6 chars). |
| Source | Cashier types it in by reading the external terminal's printout. |
| Storage | Persisted on `payment_tender_lines.external_reference` (NULLABLE). |
| Audit | Included in `tender.applied` and `payment.settled` audit payloads. **Logged with `*****` redaction** in Sentry / console / log file. |
| Client validation | Renderer applies the regex client-side; bridge re-validates main-side. Mismatches are refused generically (`invalid_input`). |
| Forbidden content | MUST NOT contain PAN, partial PAN, CVV, cardholder name, expiry, auth payload, or any card-data field. The format constraint above (≤ 6 chars uppercase alphanumeric) makes accidental card data fit unlikely; the redaction-in-logs rule makes it impossible to exfiltrate even if a cashier ignores guidance. |
| Sentry / log rule | Always redacted to `*****` (never appears in any log sink). |

**Rationale.**

1. Reconciliation between POS-Pulse and the external terminal's own
   batch settlement (typically printed at end-of-day) requires
   *some* operator-friendly reference per line; without it, multi-line
   external-card-terminal split-tender batches are unreconcileable.
2. Constraining to 6 uppercase alphanumeric characters covers the
   typical 4–6 character "auth code" or "trace number" terminals
   print without permitting realistic PAN entry (PANs are 13–19
   digits; the format constraint refuses anything that looks
   PAN-shaped).
3. Redacting in logs is the load-bearing safety net: even if a
   cashier ignores guidance and pastes long content (will fail
   client validation, but defence-in-depth), the value never reaches
   any log sink.

**Alternatives considered.**

- **No `external_reference` field at all.** Rejected: without a
  reconciliation hook, the cashier has no way to tell which POS line
  matches which terminal-printed line at end-of-day; the entire
  external-card-terminal record-only tender becomes useless for
  reconciliation.
- **Larger format (e.g., 20 chars).** Rejected: would permit realistic
  PAN entry, raising the surface area for card-data accidents.
- **Numeric-only.** Rejected: many terminals print alphanumeric trace
  codes; numeric-only would refuse real-world cases.
- **No client-side validation; rely on main-side only.** Rejected:
  defence-in-depth + immediate user feedback.

**Resolves:** OQ-PLAN-5.

---

## R-6 — Double-settlement prevention: partial unique index

**Decision.** A partial unique index enforces "one started attempt
per terminal":

```sql
CREATE UNIQUE INDEX payment_attempts_one_started_per_terminal
  ON payment_attempts (terminal_id)
  WHERE state = 'started';
```

**Rationale.**

1. **Per-terminal hardware coupling.** Only one cash drawer per
   terminal. Allowing two concurrent `started` attempts would risk
   two cashiers (via session-takeover races) simultaneously believing
   they own the till for one cart. The DB-level constraint refuses
   the second concurrent start at insert time — earlier and more
   robustly than an app-layer check.
2. **Idempotency-replay safety.** A replayed `payments.start` (same
   `idempotency_key`) is intercepted by the action_id lookup before
   the index fires; a *different* `payments.start` from a racing
   handler hits the index and is refused. This composes idempotency
   with hardware-correctness without case logic.
3. **Restart survival.** After process restart, the index still
   enforces uniqueness across rehydration; an app-layer check would
   need a separate boot-time reconciliation pass.

**Note on 005 divergence.** 005 enforces its analogous "one editing
cart per session" rule at the **application layer**, not via SQL
UNIQUE (005 data-model.md line 121). 006 chooses the SQL-level
guarantee because the constraint subject differs:

- 005's constraint: "one editing cart per session" — session ends
  cleanly close any held carts; many sessions per terminal across a
  day; no hardware coupling.
- 006's constraint: "one started attempt per **terminal**" — terminal
  hardware (cash drawer) is single-instance; concurrent attempts
  would create a real-world money-handling race.

The stronger guarantee is justified by the stronger coupling.

**Alternatives considered.**

- **Application-layer mutex (match 005).** Rejected per the
  hardware-coupling argument above.
- **Row-level lock on a synthetic "terminal_payment_lock" row.**
  Rejected: extra row, extra index, equivalent semantics; the partial
  unique index is the canonical PostgreSQL/SQLite idiom.
- **No constraint; trust the FSM mutex.** Rejected: the FSM mutex is
  in-process; it cannot survive a crash mid-start without DB-level
  enforcement.

**Resolves:** OQ-PLAN-6.

---

## R-7 — Voucher contract: V-A backend-authoritative

**Decision.** v1.0 plans against **Contract V-A — Backend-authoritative**.
Bridge handlers `vouchers.validate` / `vouchers.redeem` call future
Data-Pulse-2 endpoints (`POST /vouchers/validate`,
`POST /vouchers/redeem`). Atomic redemption + double-redemption
prevention is the authority's responsibility.

**Rationale.**

1. **Authority co-locates with truth.** Voucher issuance, balance,
   cancellation, expiry, and tenant/branch scoping all live in
   Data-Pulse-2. A POS-local read-model (V-B) would replicate this
   state across N terminals with eventual-consistency semantics that
   could not match the one-redemption-globally invariant without a
   coordination protocol POS-Pulse cannot offer.
2. **Double-redemption prevention is centralised.** A single
   authority can enforce "this voucher was redeemed once" trivially;
   N replicas would need a distributed consensus or token-based
   leasing protocol.
3. **Slimmer POS-Pulse footprint.** V-A introduces two bridge
   handlers + a network client; V-B would introduce a replication
   service, a local voucher-balance table, a conflict-resolution
   rule, and a reconciliation contract. Slice 4 stays focused.
4. **V-B remains an approved fallback** if Data-Pulse-2 explicitly
   grants offline authority under a documented reconciliation
   contract. If chosen, V-B is additive — the bridge surface and
   TenderLine FSM are unchanged.

**Partial voucher redemption (OQ-PLAN-3): refuse, not cap-and-preserve.**
If `authoritative_voucher_balance > remaining_balance_at_apply_time`,
`tender.apply` returns `non_cash_overpayment_refused`. The cashier
must either (a) supply a different `amount_applied_minor` if the
authority supports `applied_amount` on validate, or (b) pick a
different tender. Cap-and-preserve was rejected because residual-voucher
reconciliation crosses the Data-Pulse-2 boundary in a way 006 cannot
guarantee without a future loyalty-engine spec.

**Alternatives considered.**

- **V-B as default v1.0 stance.** Rejected per the
  double-redemption-prevention argument above.
- **Hybrid (V-A online, V-B fallback when offline).** Rejected for
  v1.0: introduces dual-mode complexity in Slice 4. May be revisited
  in a later slice if Data-Pulse-2 grants offline authority.
- **Cap-and-preserve partial redemption.** Rejected per the
  residual-voucher reconciliation argument above. Future loyalty-
  engine spec may revisit.

**Resolves:** AD-7, OQ-PLAN-3, OQ-PLAN-7.

---

## R-8 — Receipt handoff payload + drawer-impact signal

**Decision.** 006 emits a single canonical `payment.settled` audit
event whose payload carries the full tender breakdown sufficient for
both the future receipts spec (OQ-PLAN-8) **and** the future
shift-management spec (OQ-PLAN-9, AD-9):

```text
payment.settled.audit_payload = {
  payment_attempt_id,
  cart_id,
  handoff_action_id,
  settled_at: UTC timestamp,
  attribution_operator_id: 004 Clerk identity,
  tender_lines: [
    {
      tender_line_id,
      tender_type: 'cash' | 'external_card_terminal' | 'internal_voucher',
      amount_applied_minor: integer,
      change_due_minor: integer | null,
      external_reference: string | null,  // redacted ***** in logs
      voucher_reference: { authority_redemption_id: string } | null,
    }
  ]
}
```

006 does **not** emit a separate `drawer.cash_delta` event. The
future shift-management spec consumes `tender_lines` and derives
drawer impact as `Σ (amount_applied_minor − change_due_minor)` over
`tender_type='cash'` lines.

**Rationale.**

1. **Single source of truth.** One event per terminal transition is
   easier to audit, replay, and reason about than two
   (`payment.settled` + `drawer.cash_delta`).
2. **Forward-compatible.** Future receipts and shift-management
   specs are both pure consumers of this payload; 006 needs to
   change nothing if either future spec evolves.
3. **Redaction discipline.** `external_reference` and
   `voucher_reference` are explicitly enumerated as redaction
   targets in Slice 5 audit.

**Alternatives considered.**

- **Separate `drawer.cash_delta` event.** Rejected: two events per
  transition double the audit-event load with no information gain.
- **Per-line audit only.** Rejected: future receipts spec needs a
  single coalesced event per attempt; reconstruction from per-line
  events forces every consumer to GROUP BY `payment_attempt_id`.

**Resolves:** AD-9, OQ-PLAN-8, OQ-PLAN-9.

---

## R-9 — Persistence model: three new tables

**Decision.** Three new local SQLite tables (`payment_attempts`,
`payment_tender_lines`, `payment_action_outbox`) + extension of 004's
`audit_events` catalogue. No new audit table; 004's is the audit
sink.

Detailed schema in [./data-model.md](./data-model.md). Summary:

| Table | Mutability | Constraint highlights |
|:--|:--|:--|
| `payment_attempts` | Mutable; terminal in `settled`/`cancelled`/`failed`/`force_failed` | Partial unique index `WHERE state='started'` (R-6); FK to envelope via `handoff_action_id` |
| `payment_tender_lines` | Mutable per-line; terminal in `applied`/`refused`/`reversed`/`reversal_pending` | FK to `payment_attempts.payment_attempt_id`; check constraint enforces `change_due_minor IS NULL` for non-cash |
| `payment_action_outbox` | Append-only (UPDATE/DELETE denied by trigger) | `action_id` UUID v4 unique; `action_kind` enum |

**Rationale.** Itemised in plan §AD-2:

1. Mid-flight state requires a mutable header.
2. Split-tender rollback (FR-006B) requires indexed per-line state.
3. Restart survival requires SQLite-backed FSM, not audit replay.
4. Idempotency replay (R-10) requires an O(log N) outbox lookup.

**Alternatives considered.**

- **Audit-events-only (single-table).** Rejected per the four-point
  argument above; this was the v0.1 cash-only baseline that the
  amendment made untenable.
- **Two tables (header + outbox; lines packed as JSON on header).**
  Rejected: split-tender rollback needs to UPDATE individual line
  states atomically; a JSON column would force a full-row read-modify-write
  for every per-line transition and lose the
  per-line FK to outbox rows.

**Resolves:** AD-2, AD-DEFERRED-2, OQ-PLAN-1.

---

## R-10 — Idempotency replay model

**Decision.** Client-generated UUID v4 `idempotency_key` per
intended operation, persisted on `payment_action_outbox.action_id`
(unique). Bridge handler logic (mirrors 005's `cart.*` idempotency
contract):

1. Look up `payment_action_outbox` by `action_id = idempotency_key`.
2. **Found AND identical payload** → no-op success; return the
   original outcome (Constitution §P5).
3. **Found AND payload differs** → refuse with
   `{ kind: 'refused', reason: 'idempotency_payload_mismatch' }`
   (P5; UUID identifies the *operation*, not the *line*).
4. **Not found** → apply the action AND write the outbox row in the
   same SQLite transaction.

The renderer MUST reuse the same `idempotency_key` on retry; a new
UUID on retry creates a duplicate operation.

**Rationale.** 005's contract is the proven pattern; 006 inherits
without modification.

**Alternatives considered.**

- **Server-generated idempotency keys.** Rejected: violates the
  "client generates intent" pattern that lets the renderer retry
  before a bridge call completes.
- **Hash-of-payload as idempotency key.** Rejected: collides on
  legitimate-but-identical operations the renderer wants to attempt
  twice (e.g., two identical cash applies that should each apply,
  not coalesce).

**Resolves:** OQ-PLAN-6 (idempotency portion).

---

## R-11 — Reversal-pending FSM placement

**Decision.** Extend the `TenderLine` FSM to include
`reversal_pending` as a fourth terminal state, distinct from
`reversed`:

```text
applying → (applied | refused)
applied → (reversed | reversal_pending)
reversal_pending → reversed  // resolved by background deferred-reversal resolver
```

The FSM is implemented as `state` column on `payment_tender_lines`
with values: `applying` / `applied` / `refused` / `reversed` /
`reversal_pending`. `reversal_pending → reversed` is the only
transition from a "terminal-ish" state, and is reserved for the
Slice 4 deferred-reversal resolver (which retries voucher-authority
reverse on (a) app start, (b) network-restore signal, (c) cashier
retry).

**Rationale.** FR-006A enumerates `applying → (applied | refused)`
with `reversed` reachable from `applied`. FR-006B introduces
`reversal_pending` when the voucher authority is unreachable. The
two cleanest treatments are:

- **(a) Treat `reversal_pending` as a sub-state flag on a `reversed`
  row** (e.g., `reversed_status: 'complete' | 'pending'`). Loses
  state-machine purity; every query that filters "fully reversed"
  needs `state='reversed' AND reversed_status='complete'`.
- **(b) Treat `reversal_pending` as a fifth FSM state.** Cleaner
  predicate; one query per state. Costs one extra enum value.

(b) wins on predicate-cleanliness; chosen.

**Alternatives considered.** See above; (a) rejected.

**Resolves:** FR-006A / FR-006B normative gap; locked in
[./data-model.md](./data-model.md) `payment_tender_lines.state` enum.

---

## R-12 — Voucher partial redemption (OQ-PLAN-3)

**Decision.** Refuse, do not cap-and-preserve.

Already justified in R-7 above; recorded separately so reviewers
auditing OQ-PLAN-3 in isolation find a direct hit.

**Resolves:** OQ-PLAN-3.

---

## R-13 — Split-tender ordering and rollback (OQ-PLAN-4)

**Decision.**

- **Ordering.** Strict cashier-order. Lines are applied in the order
  `tender.apply` is invoked; lines are reversed in **reverse order**
  (LIFO) on cancel or per-line failure.
- **Reversal idempotency.** Every `tender.reverse` call carries its
  own `idempotency_key`. Replay-safe: applying the same `reverse`
  twice is a no-op success.
- **`reversal_pending` resolver.** Slice 4 introduces a background
  deferred-reversal resolver that retries `vouchers.redeem` reverse
  on (a) app start, (b) network-restore signal from 003, (c) explicit
  cashier-initiated retry. The resolver writes a `tender.reversed`
  audit event when it succeeds.

**Rationale.** LIFO ordering matches the cashier's mental model
("undo what I did last") and minimises the surface for partial-rollback
races. Idempotency on `tender.reverse` mirrors the 005 idempotency
contract. The deferred-reversal resolver pattern is novel to 006
(005 has no analog) and is itself documented in
[./contracts/bridge-api.md](./contracts/bridge-api.md) §"Deferred
reversal".

**Alternatives considered.**

- **FIFO reversal.** Rejected: counterintuitive for cashiers; a
  cashier who applied "voucher then cash" expects "cash refunded
  first, then voucher reversed" on cancel.
- **All-or-nothing reversal (single transaction).** Rejected: the
  voucher reverse requires a network call (V-A) that cannot be
  inside the SQLite transaction; the `reversal_pending` deferred
  pattern is the correct decoupling.

**Resolves:** OQ-PLAN-4.

---

## R-14 — Offline behaviour by tender

Already locked by AD-6 above; recorded here for OQ-OFF-1..4 /
OQ-OFF-EXT-1 / OQ-OFF-VCHR-1 audit:

- **Cash:** offline cash settlement remains under OQ-OFF-1..4
  (deferred to dedicated offline-payments review). Slices 1–3 ship
  online-only.
- **External_card_terminal:** offline recording allowed; reconciliation
  with Data-Pulse-2 / shift-management deferred to OQ-OFF-EXT-1.
- **Internal_voucher (V-A):** offline → `dependency_unavailable`
  refusal.
- **Internal_voucher (V-B if approved):** local atomic redeem allowed;
  reconciliation is part of the V-B contract review.

**Resolves:** AD-DEFERRED-5, AD-6.

---

## Open questions still deferred (recorded for `/speckit-tasks` and beyond)

The following are **not** resolved in this plan and are recorded here
so `/speckit-tasks` and downstream reviewers see them:

- **OQ-OFF-1..4** — offline cash settlement semantics. Deferred to
  dedicated offline-payments review.
- **OQ-OFF-EXT-1** — external_card_terminal offline reconciliation.
  Deferred to the same review.
- **OQ-OFF-VCHR-1** — voucher offline reconciliation under V-B.
  Deferred to the voucher-authority contract review.
- **OQ-DRW-1..4** — drawer-state contract beyond the
  `payment.settled` tender-breakdown signal locked in AD-9.
  Deferred to future shift-management spec.
- **OQ-RCPT-1** — receipts-handoff data shape. Receipts spec
  consumes the payload locked in AD-9; the rendering contract is
  out of scope for 006.
- **OQ-INV-1** — inventory-mutation timing. Deferred to future
  inventory spec.

---

## Constitution sanity check (re-run post-design)

See [./plan.md](./plan.md) §"Constitution Check (post-design
re-evaluation)" for the full table. Every Roman-numeral principle
(I–IX) and every Cross-Feature rule (P1–P18) passes without a
Complexity-Tracking override.

---

**End of Phase 0 research.** Phase 1 artefacts are
[./data-model.md](./data-model.md),
[./contracts/bridge-api.md](./contracts/bridge-api.md), and
[./quickstart.md](./quickstart.md).
