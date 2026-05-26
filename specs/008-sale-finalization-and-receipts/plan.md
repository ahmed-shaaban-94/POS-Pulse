# Implementation Plan: Sale Finalization & Receipts

**Feature ID:** 008-sale-finalization-and-receipts
**Spec:** [./spec.md](./spec.md)
**Plan Version:** **1.0**
**Created:** 2026-05-27
**Last Updated:** 2026-05-27
**Constitution version pinned:** v1.5.1
**Branch:** `008-sale-finalization-and-receipts`
**Companion artefacts (all in this PR):**

- [./research.md](./research.md) — Phase 0 rationale + alternatives for every AD
- [./data-model.md](./data-model.md) — `sales` + `print_events` + `drawer_events` + `sale_sync_outbox` tables
- [./contracts/bridge-api.md](./contracts/bridge-api.md) — DRAFT `sales.*` / `receipts.*` / `drawer.*` bridge namespaces (NOT APPROVED; §A4 review required)
- [./quickstart.md](./quickstart.md) — happy-path / reprint / printer-failure / drawer-failure walkthrough

---

## Summary

008-sale-finalization-and-receipts lays down the rule + persistence +
bridge-contract + receipt-template layer that runs once a 006 payment
attempt transitions to `settled`. The plan locks the boundary at which
a paid cart becomes a durable, append-only sale; the receipt payload is
generated from that record; the receipt is printed (ESC/POS direct or
OS fallback); the cash drawer kicks on a cash-inclusive first print
only; reprints emit a visibly-marked duplicate copy; and a single
append-only outbox event is staged for the future sync engine.

This plan is **rules + persistence + contracts only**. No `src/**`
source changes are authored by this PR. The per-slice approval gates
§A0–§A5 govern when each implementation slice may ship.

The four `/speckit-clarify` resolutions (per-line VAT scope locked
out → sale-level footer only; drawer-kick locked to a separate
command; sale-number scheme locked to
`<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`; reprint locked to
cashier-permitted with full attribution) are load-bearing for this
plan and are repeated in each section they touch.

---

## Technical Context (locked)

| Area | v1.0 decision | Reference |
|:--|:--|:--|
| Runtime / packaging | Electron 40 + React 19 + Vite 8 + TS 5 strict + Tailwind 4 (inherits 001/004/005/006/007). | Constitution §I, §Tech Stack |
| Money semantics | **Integer minor units only**, guarded by `Number.isSafeInteger`. Receipt formatting at the `formatters` boundary; the print stream and the preview render from the same payload. Sale-level VAT total is integer minor units. ≥ 95 % coverage on the receipt-payload module and the sale-number allocator. | Constitution §II / P1; spec NFR-001 |
| Identity | 004 Clerk-backed operator-session identity. Selling operator is inherited from the 006 payment attempt; reprinting operator is the currently signed-in cashier at reprint time (cashier-permitted per spec FR-028). Local PIN record ids are never the attribution anchor. | Spec FR-022 / FR-023 / FR-024; Constitution Principle VIII clarification rule 6 |
| Finalization ownership | **Main process** owns the `Sale` row commit, the receipt-payload generation, the print pipeline (ESC/POS adapter + OS-print fallback), the drawer-kick command, the audit-event emission, and the sync-handoff outbox enqueue. Renderer is preview / reprint / failure-banner UI only. | AD-1 below; Constitution §III |
| 006 → 008 signal | 008's main-process listener subscribes to **`audit_events`-table row arrivals** via better-sqlite3's `update_hook` callback (registered on the shared SQLite connection). On every INSERT, the callback filters for `category='payment.settled'` and queues AD-2 finalize. **No new in-process EventEmitter is required from 006**; the contract is the audit row, which 006 already commits to writing (006 AD-9). A startup recovery scan re-fires AD-2 for any `payment.settled` rows the hook missed during a process restart. Idempotency via `envelope.handoff_action_id` makes a duplicate finalize a no-op (FR-001 / SC-009). | AD-2 below; Constitution §P3 / §P5; revised 2026-05-27 post-external-review (closes R1) |
| Persistence | **Four new local SQLite tables** authored under §A3 in Slice 1: `sales` (append-only at the rule level — see AD-3), `print_events` (append-only), `drawer_events` (append-only), `sale_sync_outbox` (append-only). Plus an extension of 004's `audit_events` catalogue with ten `sale.*` audit-event categories (FR-055; see AD-9). No physical mutation of any 008 row after insert. | AD-3 + AD-4 + AD-9 below; [./data-model.md](./data-model.md) |
| Bridge surface | **DRAFT** `sales.*` (sale-level reads), `receipts.*` (preview + print + reprint + manual-override), `drawer.*` (kick — main-process only, no renderer-callable surface). §A4 review required before Slice 1 ships. Refusal envelope mirrors 005/006 `{ kind: 'refused', reason: '...' }`. | AD-5 below; [./contracts/bridge-api.md](./contracts/bridge-api.md) |
| Receipt template asset | First-party version-controlled assets at `src/main/receipts/templates/` (path is plan-pinned; migration occurs in Slice 0 visual-direction work). Each template emits **two byte-stable outputs from one source**: an ESC/POS byte stream and an HTML/canvas equivalent for OS-print + preview. Bilingual asset with Arabic-first RTL layout and Latin numerals on printed slips. | AD-6 below; Constitution Hardware §"Receipt templates" |
| Sale-number scheme | Canonical shape `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`, allocated by a main-process **per-terminal, per-calendar-day** monotonic sequence (terminal local timezone). The reset boundary is **calendar day**, NOT shift-open (shifts do not ship in 008). | Clarifications 2026-05-27; FR-010; AD-7 below |
| Drawer-kick mechanism | **Separate command** distinct from the receipt byte stream. Fires only after the durable Sale commit AND after print-success acknowledgement AND only on the first print of a cash-inclusive sale. Embedded-in-receipt kick is PROHIBITED in 008 v1 (FR-040). | Clarifications 2026-05-27; AD-8 below |
| Reprint permission | **Cashier-permitted** with full attribution; no supervisor override required (FR-028 / Clarifications 2026-05-27). Mitigation against fraudulent presentation rests on the **bilingual visible duplicate-copy marker** (FR-029, R2). | AD-10 below |
| Sync handoff | **Append-only outbox row** enqueued in the same transaction that commits the Sale (Constitution §P3 / §P18). 008 does NOT flush, retry, conflict-resolve, or call any backend. The future sync engine is a separate spec. | AD-11 below; FR-060 / FR-061 |
| Idempotency | Sale commit is keyed on `envelope.handoff_action_id` (UUID v4 from 006). Duplicate finalize → no-op returning the existing sale identifiers (Constitution §P5; FR-001 / SC-009). | AD-2 below |
| OpenAPI | **No new POS-Pulse OpenAPI surface.** 008 makes zero backend calls. The future sync-engine spec will introduce the dependency. §A2 records a no-op for every 008 slice. | AD-12 below |
| Codegen | Not invoked by any 008 slice. | n/a |
| Tests | Vitest only (Constitution §VI). Test-first per Constitution §VI; ≥ 95 % coverage on money-math, sale-number allocator, receipt-payload generator, print pipeline, drawer-kick logic, audit-event emitter, sync-outbox enqueuer; ≥ 90 % on the renderer preview / reprint / failure-banner surfaces. | Spec NFR-001 / SC-COV style floors below |
| Hardware integration | ESC/POS direct path via `node-thermal-printer` (or equivalent — final library pick at §A3); OS-print queue via Electron's existing `webContents.print` for the fallback. No new hardware support beyond Constitution Hardware MVP Matrix. The cash drawer kicks via the printer's DK1/DK2 ESC/POS pulse. | AD-6 + AD-8 below; Constitution Hardware §"Receipt printer" |
| CI | No workflow changes from this plan. Existing `codegen:verify → typecheck → lint → test → package:dir` gates this feature when implementation begins. | n/a |
| UI / Impeccable | **§A1 visual direction held.** Slice 0 (receipt template asset + preview/reprint/failure surface visuals) must commission before any renderer code lands. No CSS / JSX / token / screenshot / visual-asset changes from this plan. | spec FR-065..FR-069 / NFR-004 |

**No NEEDS CLARIFICATION markers remain in this plan.** Every spec-level
open question was resolved by `/speckit-clarify` 2026-05-27; every
plan-level AD-1..AD-12 is locked below; carry-forwards (e.g.,
calendar-day vs shift-open reset boundary, manual-override audit-event
variant naming) are decided here.

---

## Hard non-implementation boundaries

This plan adds the following normative boundaries on top of those
already locked by [./spec.md](./spec.md) §"Out of Scope":

- **No inventory mutation.** Owned by a future inventory spec
  (spec FR-041 inheritance; 006 FR-041 inheritance).
- **No shift financial maths.** Drawer-expected total, variance,
  shortage, overage, X/Z reports — owned by a future shift-management
  spec. 008 emits enough signal in `sale.finalized` audit events
  (per AD-9 payload) for that future consumer to derive drawer impact
  without 008 calculating it.
- **No refunds / returns / voids.** Owned by a future refunds spec.
  008's `sales` table is append-only by design (AD-3); refunds will
  append new event types, never mutate the Sale row.
- **No real backend / API calls.** 008 makes zero outbound HTTP calls.
  No backend OpenAPI surface is touched.
- **No SaaS database direct access.** Constitution Platform
  Integration §"only path to the backend" applies.
- **No card processor / payment-gateway integration of any kind.**
  Inherited from 006 (FR-007, FR-008, FR-040).
- **No cardholder data of any kind on receipts, in audit, or in logs.**
  Constitution P6.
- **No voucher secrets on receipts, in audit, or in logs** — only the
  applied amount and the generic "Voucher" label plus the optional
  non-sensitive `voucher_authority_redemption_id` (006 FR-017
  inheritance + 008 FR-037 / FR-038).
- **No per-line VAT on the printed slip** — sale-level VAT footer
  only for MVP (Clarifications 2026-05-27).
- **No migrations** in this PR. Migration files for the four new
  tables are authored under §A3 in Slice 1 of the future
  implementation branch.
- **No** `npm run codegen:api` from this PR.
- **No `src/**` source changes** from this plan.
- **No Data-Pulse-2 changes.** This is a POS-Pulse desktop plan only.
- **No sync engine, retry policy, conflict resolution, or backend
  reconciliation logic.** Outbox enqueue only (AD-11).

Any task that drifts into the above MUST be filed as a separate feature.

---

## Architectural Decisions (LOCKED in v1.0)

> AD-1..AD-12 below resolve every plan-level decision raised by the spec
> and by the `/speckit-clarify` 2026-05-27 session. Each AD carries a
> one-paragraph decision summary; alternatives considered live in
> [./research.md](./research.md).

### AD-1 — Finalization ownership: main process (LOCKED)

**Decision.** The main process owns the `Sale` row commit, the receipt-
payload generator, the print pipeline, the drawer-kick command, the
sync-outbox enqueue, and all `sale.*` audit-event emission. The
renderer owns: preview render, reprint affordance, manual-override
affordance, and the persistent printer / drawer failure banners — all
display + input only. The renderer is **never** trusted for sale-row
mutation, sale-number allocation, receipt-payload derivation, print
dispatch, drawer command, audit-event emission, or sync-outbox enqueue.

**Why.** Mirrors 006 AD-1 and 005 AD-1. Constitution §III
(NON-NEGOTIABLE) requires the renderer to be untrusted; FR-002 requires
the durable commit before any user-visible signal; the receipt template
asset and the ESC/POS adapter live main-side (filesystem + native
binding access); the drawer kick is a main-process call. Centralising
all of this main-side also gives us process-restart survival for
unfinished prints / drawer kicks via the durable Sale + PrintEvent +
DrawerEvent rows.

**Resolves:** AD-1.

### AD-2 — 006 → 008 signal: SQLite audit-row arrival via `update_hook` (LOCKED — revised 2026-05-27 post-external-review)

> **Revision history.** Plan v1.0 (2026-05-27 morning) originally
> specified an "in-process EventEmitter" between 006 and 008. External
> review (finding R1) established that **006 does not publish such an
> event** — 006's only EventEmitter is `payments.subscribe`, which
> serialises the renderer-facing minimised view (FR-017), not a
> main-process broadcast channel. The original AD-2 would have left
> the primary finalize path dead (sales would only finalize on next
> process restart via the recovery scan). This revision replaces the
> EventEmitter mechanism with a SQLite-row-arrival hook, which
> depends only on 006's already-committed audit-write behaviour and
> requires zero changes to 006.

**Decision.** 008's main-process listener subscribes to **`audit_events`-
table row arrivals** via better-sqlite3's `update_hook` callback,
registered on the shared SQLite database connection at main-process
startup. The callback fires synchronously on every INSERT to any table;
008's hook filters by `tbl_name = 'audit_events' AND category = 'payment.settled'`
and dispatches AD-2 finalize asynchronously (the hook itself returns
immediately — finalize work runs outside the hook's transactional
context).

The listener:

1. Receives the `audit_events` row's primary key + the
   `payment.settled` payload shape from a small follow-up `SELECT`
   (per 006 plan AD-9 payload: `payment_attempt_id`, `cart_id`,
   `handoff_action_id`, `settled_at`, `attribution_operator_id`,
   `tender_lines[]`).
2. Checks `sales` for an existing row keyed on
   `envelope.handoff_action_id`. If found → no-op, returns existing
   `sale_id` (Constitution §P5; FR-001 / SC-009).
3. Otherwise, opens a SQLite transaction that allocates the
   sale_number (AD-7), inserts the `sales` row, inserts the
   `sale_sync_outbox` row, and emits the `sale.finalized` audit event
   — **all atomically** (Constitution §P3 / §P18).
4. After commit, dispatches the receipt-payload generation +
   render + print + drawer pipeline (each step is its own
   transaction; the Sale row stays durable regardless of pipeline
   success).

**Safety net.** On main-process startup, 008's listener also runs a
**recovery scan** (per research §R-15) before the `update_hook` is
registered: scan `audit_events` for `category='payment.settled'` rows
scoped to current terminal whose `handoff_action_id` has no matching
`sales` row, and fire AD-2 for each. This recovers (a) any
`payment.settled` rows committed by 006 while 008's listener was not
running (e.g. process crash between 006's commit and 008's commit),
and (b) the unlikely case where the `update_hook` itself dropped a
notification (better-sqlite3's hook is reliable but not formally
durable across process boundaries). Idempotency (step 2 above) makes
the recovery scan safe to run on every startup, including happy-path
startups.

The renderer is notified of finalization completion via a
subscription on `sales.*` (analogous to 006's `payments.subscribe`).

**Why this mechanism.**

1. **Zero new IPC surface, zero 006 dependency.** 006 already commits
   its `audit_events` row inside its settled-state SQLite transaction
   (006 AD-9). 008's hook depends on that commit — which is durable —
   not on 006 publishing a runtime event. **No amendment to 006
   required.**
2. **Lower latency than polling.** `update_hook` fires synchronously
   on the SQLite write; the dispatched finalize work runs ~milliseconds
   later. NFR-006's 3-second budget has comfortable headroom.
3. **Crash-safety by construction.** If 008 crashes mid-finalize, the
   `audit_events` row is durable; the recovery scan re-fires AD-2 on
   restart. Constitution §P3 satisfied.
4. **The renderer is *not* the listener** because the renderer can
   reload, crash, lose focus, or be navigated away from at any moment
   — and a sale finalization must not depend on renderer liveness.

**Alternatives rejected** (see research §R-2 for the full ledger):

- **In-process EventEmitter from 006** (original plan-v1.0 choice) —
  rejected because 006 does not publish such an event and amending
  006 (SPEC COMPLETE; §A5 signed off) violates Constitution P12 + P13.
- **Polling loop on `audit_events`** — rejected as primary because
  short-interval polling consumes CPU continuously; viable as a
  fallback if a future SQLite-driver change removes `update_hook`
  support.
- **Cross-process file-watcher** — rejected; introduces a second
  source of truth and complicates restart semantics.

**Resolves:** AD-2 (revised).

### AD-3 — `sales` table is append-only at the *physical* layer (LOCKED)

**Decision.** The `sales` table is **append-only at the physical
layer**, not merely the rule layer. INSERT is the only DML allowed; an
SQLite trigger denies UPDATE and DELETE. The same posture applies to
`print_events`, `drawer_events`, and `sale_sync_outbox`.

This is stronger than spec FR-004 strictly requires (FR-004 says
"append-only at the rule level"). The trigger upgrades the rule to a
physical constraint so a bug or future-feature drift cannot mutate a
finalized sale by accident.

The "no mutable column" rule means: print-success state is captured
by INSERTing a new `print_events` row, not by setting
`sales.last_printed_at`. Reprint count is derived by COUNT(*) on
`print_events` for the sale, not stored on `sales`. The pattern
mirrors 006's `payment_action_outbox` posture and 004's `audit_events`
posture.

**Why.**

1. Constitution §P4 — non-destructive financial correction is the
   strongest auditability rule we have. A physical-layer trigger
   prevents the rule from drifting into "we accidentally added an
   UPDATE statement during refactoring."
2. Eight new code paths in eight slices touch the Sale row reads;
   any of them could be the future bug that mutates a finalized
   sale.
3. Refunds (future feature) will append new event tables that
   reference the Sale; they will not modify it. Locking this in
   now means the refunds spec inherits the safe foundation.

**Trade-off.** Slightly more complex read patterns (a sale's
"current state" is the projection of its `sales` row + the latest
relevant `print_events` / `drawer_events` row). The complexity is
worth the auditability guarantee.

**Resolves:** AD-3.

### AD-4 — Sub-entities: PrintEvent, DrawerEvent, SaleSyncOutbox (LOCKED)

**Decision.** Three append-only sub-entities, one for each independent
audit anchor on a sale:

| Table | Purpose | One per sale? |
|:--|:--|:--|
| `print_events` | Audit anchor for every print attempt (success, failure, retry, reprint, manual-override). | Many; ≥ 1 per finalized sale (manual-override counts too). |
| `drawer_events` | Audit anchor for every drawer-kick attempt (opened, suppressed, failed). | At most one per sale (the kick happens on first-print success; reprints don't kick — FR-030). |
| `sale_sync_outbox` | Future-sync staging row. | Exactly one per finalized sale (FR-060). |

The four tables (`sales`, `print_events`, `drawer_events`,
`sale_sync_outbox`) are migrated together under §A3 in Slice 1.

**Why split `print_events` and `drawer_events`?** Because
Constitution Principle IV requires drawer failure to be
independently surfaceable from receipt-print failure (spec FR-042 /
FR-043 / FR-053). A unified `events` table would force every query
to filter by `event_type`, every index to compound `event_type`, and
every future refunds query to learn the event-type taxonomy. Two
purpose-built tables read naturally and keep the indexes tight.

**Why a separate `sale_sync_outbox` and not a `payment_action_outbox`-
style polymorphic table?** Because 006's `payment_action_outbox`
records *every payment-mutating action*; 008's outbox records exactly
one event per sale (the "this sale is ready for the future sync
engine to pick up" marker). The two outboxes have different
cardinalities, different schemas, and different consumers; collapsing
them would force future readers to filter by `entity_type` on every
read.

**Resolves:** AD-4.

### AD-5 — Bridge namespaces: `sales.*` + `receipts.*` + `drawer.*` (LOCKED)

**Decision.** Three complementary bridge namespaces:

- **`sales.*`** (sale-level reads + subscriptions): `read`, `subscribe`,
  `findByNumber`. **Read-only from the renderer.** No `sales.mutate`,
  no `sales.update`, no `sales.delete`. The Sale row is only written
  by AD-2's in-process listener.
- **`receipts.*`** (preview + print + reprint + manual-override):
  `preview`, `print` *(internal, fires automatically on finalize)*,
  `reprint`, `manualOverride`, `retryPrint`.
- **`drawer.*`** (kick): **NO renderer-callable surface.** The drawer
  command is issued main-side only by the print pipeline. Renderer
  observes drawer state via the `sales.subscribe` payload (which
  includes the latest `drawer_event`).

Every mutating `receipts.*` handler accepts a client-generated
UUID v4 `idempotency_key` (matches 005 / 006 idempotency pattern).
Every handler self-gates with `requireOperatorSession` (matches 005 /
006). Refusal envelope is `{ kind: 'refused', reason: '...' }`
(matches 005 / 006).

The deliberate omission of any renderer-callable `drawer.*` surface
is load-bearing: the drawer is a *consequence* of a successful
print on a cash-inclusive sale, not an independent renderer-initiated
action. Letting the renderer "kick the drawer" out of band would
violate FR-040's "only when (a)–(c) hold" rule.

**Why split, not unified.** Same argument as 006 AD-3: keeping
bridge-call ↔ audit-event-category alignment 1:1 makes the audit
catalogue review (AD-9) tractable. `receipts.reprint` →
`sale.receipt.reprinted` is one line in the catalogue.

**Resolves:** AD-5.

### AD-6 — Receipt template engine: single source, dual output (LOCKED)

**Decision.** A first-party template engine lives at
`src/main/receipts/templates/` (path pinned by this plan; populated by
Slice 0 visual direction + Slice 2 print pipeline tasks). The engine:

1. Reads one **bilingual template asset** per receipt variant
   (`first_print`, `reprint_duplicate`, `preview`). The asset is
   data + layout description, not code.
2. Reads the **canonical receipt payload** from the persisted Sale
   row (per FR-015 / FR-016 byte-stability rule).
3. Emits **two outputs from one source**: (a) an ESC/POS byte stream
   for direct-path printing; (b) an HTML/canvas rendering for
   OS-print queue + preview UI. Both outputs are derived from the
   same template + same payload, so the byte-stability rule holds
   across paths (mitigates R4 from spec).

Localisation rules (FR-066, FR-067):
- Arabic-first RTL layout is the default; an English fallback panel
  is rendered alongside on the slip for legal compatibility.
- **Latin numerals only** on the printed slip for every numeric
  field (totals, sale number, receipt number, dates, times, tender
  amounts). The preview UI MAY use Arabic-Indic numerals if the
  cashier's locale demands it, but the printer output is locked to
  Latin (per Constitution Localization §"Latin numerals on receipts").
- All currency / date / time formatting goes through the existing
  `formatters` module — never inlined.
- The "DUPLICATE COPY" marker (FR-029) is rendered in both Arabic
  ("نسخة طبق الأصل") and Latin in the `reprint_duplicate` template
  variant, and is rendered **prominently** (large weight, top-of-
  slip placement) so it is obvious to a customer glancing at the
  paper.

**Why a custom engine, not Handlebars / EJS / etc.?** The constraint
"emit both ESC/POS bytes and HTML from one source" eliminates every
HTML-only templating library. The receipt is also small and stable
(no variable layout, no conditional sections beyond duplicate-copy);
a 200-line first-party engine is more auditable than pulling a
third-party dependency under Constitution P8 review.

**Resolves:** AD-6.

### AD-7 — Sale-number allocator: per-terminal per-calendar-day monotonic (LOCKED)

**Decision.** The sale-number scheme is
**`<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`**, allocated by a
**main-process per-terminal, per-calendar-day** monotonic sequence.
The local trading day is anchored on the terminal's local timezone
(from the OS clock), NOT UTC.

Allocation mechanism: a tiny `sale_number_sequences` table with a
composite primary key `(terminal_id, calendar_day_local)` storing
the current sequence value. The allocator runs as the first
statement inside the AD-2 atomic finalize transaction, doing an
UPSERT-and-increment. The composite key + transaction-level
isolation gives us collision-impossibility even under concurrent
finalizes (which 006's partial-unique-index already prevents at
the payment-attempt layer anyway, but defence-in-depth here is free).

**Why calendar day, not shift-open?** Shifts do not ship in 008.
The `/speckit-clarify` session deferred the reset-boundary to the
plan layer; tying the reset to a future shift-open feature would
create an undefined-behaviour dependency. Calendar day is
self-contained, matches the receipt's date stamp on the slip
(which the customer reads as "today's receipts"), and survives
the eventual shift-management feature shipping (a shift can span a
midnight boundary; the sale-number sequence rolls over at midnight
regardless, which is the same behaviour the legacy POS has).

**Why `terminal_label` rather than `terminal_id`?** The
`terminal_label` is the human-friendly name the admin set during
002 pairing (e.g. `T03`); `terminal_id` is a UUID. The clarification
locked cashier-quotability as the load-bearing UX criterion, so the
label is the right prefix. The label is provisioned at pairing time
and is part of the device token claims (Constitution Platform
Integration); it cannot be silently changed.

**Edge case — terminal_label collision across branches.** Two
branches owned by the same tenant could in theory pair terminals
with the same label (each branch admin picks "T03" independently).
The sale number is unique *per terminal* and the audit anchor
includes `branch_id`, so the collision is only cosmetic across
cross-branch support queries. If a tenant later wants global-unique
display labels, that's a future admin-app constraint, not 008's
problem.

**Resolves:** AD-7 (the carry-forward from Clarifications 2026-05-27).

### AD-8 — Drawer-kick mechanism: separate ESC/POS pulse after print-ack (LOCKED)

**Decision.** The drawer kick is issued as a **separate ESC/POS
command** (DK1/DK2 pulse to pin 2 or pin 5 depending on printer) sent
to the printer **after** the renderer / OS / printer acknowledges
print success. The command is NOT embedded inside the receipt byte
stream (per Clarifications 2026-05-27; FR-040).

Ordering inside the finalize pipeline:

1. AD-2 atomic finalize commits the Sale + outbox + audit row.
2. Print pipeline renders the receipt payload and dispatches print
   (ESC/POS direct or OS fallback).
3. Print pipeline awaits acknowledgement:
   - **ESC/POS direct:** synchronous write-and-status-poll on the
     printer adapter; ack is the printer's "ok / paper out / jam"
     status byte.
   - **OS-print fallback:** `webContents.print` callback completes
     with success/failure.
4. On print-success ack: emit `sale.receipt.printed` audit event
   (with `print_events` row INSERT).
5. **If tender mix includes cash AND this is the first print of
   this sale:** issue the drawer-kick ESC/POS pulse as a separate
   write to the printer adapter. Await drawer-kick ack (printer
   returns a status byte). Emit `sale.drawer.opened` /
   `sale.drawer.failed` audit event accordingly.
6. **Otherwise (cashless OR reprint):** emit `sale.drawer.suppressed`
   audit event with the suppression reason.

The drawer-kick command is **not idempotent at the printer layer**
(the printer kicks every time you send it). Idempotency at the sale
layer is enforced by the rule "drawer.opened audit event exists for
this sale → suppress further kicks", checked main-side. This
protects against the rare retry-after-partial-success case
(FR-053).

**Why a separate write, not embedded?** Embedded kicks defeat audit
separability (FR-042 / FR-043). The latency cost (~100ms) is
inside NFR-006's 3-second budget. Constitution Principle IV
requires hardware failures to be loud and structurally distinct;
that requires the kick to be its own observable.

**Resolves:** AD-8 (the carry-forward from Clarifications 2026-05-27).

### AD-9 — Audit-event catalogue: ten new categories under 004's `audit_events` (LOCKED)

**Decision.** 008 extends 004's existing `audit_events` table with
**ten new event categories**. No new audit table.

| Category | Emitted when | Carries |
|:--|:--|:--|
| `sale.finalized` | AD-2 commit succeeds. | sale_id, sale_number, receipt_number, handoff_action_id, attribution_operator_id (selling), operator_session_id, terminal_id, branch_id, tenant_id, tender_lines summary (per AD-9 payload below), settled_at, finalized_at. |
| `sale.finalization_refused` | AD-2 refuses finalization per FR-005 / FR-045 / FR-046 / FR-047. | handoff_action_id, refusal_reason (closed set), attribution_operator_id. |
| `sale.receipt.printed` | First successful print of a sale. | sale_id, print_event_id, render_path (`escpos_direct` / `os_print`), printed_at. |
| `sale.receipt.reprinted` | Successful reprint with duplicate-copy marker. | sale_id, print_event_id, duplicate_copy_sequence_number (1, 2, …), reprinter_operator_id, reprinter_session_id, reprinted_at. |
| `sale.receipt.print_failed` | First-print or retry-print failed. | sale_id, print_event_id, failure_reason (closed set), failed_at. |
| `sale.receipt.print_retried_success` | A retry after a previous failure succeeded; treated as canonical first print per FR-052. | sale_id, print_event_id, previous_failed_print_event_ids. |
| `sale.receipt.manual_override` | Cashier invoked manual-receipt override after print failure (FR-051). | sale_id, print_event_id, overrider_operator_id, overrider_session_id, overridden_at. |
| `sale.drawer.opened` | Successful drawer kick on first print of cash-inclusive sale. | sale_id, drawer_event_id, opened_at. |
| `sale.drawer.suppressed` | Drawer not kicked because the tender mix was cashless. | sale_id, drawer_event_id, suppression_reason (`cashless_tender_mix` only — the `reprint` value was removed post-external-review R2; reprints emit no DrawerEvent at all and therefore no `sale.drawer.suppressed` event). |
| `sale.drawer.failed` | Drawer-kick command failed. | sale_id, drawer_event_id, failure_reason (`printer_dk_failure` / `os_error` / `no_drawer_configured`), last_successful_open_at_for_terminal, failed_at. |

**`sale.finalized.audit_payload.tender_lines` shape** (mirrors 006 plan AD-9):

```text
tender_lines: [
  { tender_type: 'cash' | 'external_card_terminal' | 'internal_voucher',
    amount_applied_minor: <integer>,
    change_due_minor?: <integer>,        // cash lines only
    external_reference?: <string>,       // external_card_terminal only;
                                         // REDACTED in logs (FR-009 inheritance);
                                         // present in audit only if OQ-PLAN-5
                                         // resolved permissively
    voucher_authority_redemption_id?: <string>
                                         // internal_voucher only;
                                         // present per FR-017 only
  }
]
```

**Redaction surface (extends 004's pino-redaction + Sentry scrubber):**

| Field appearing in any 008 audit payload | Redaction rule |
|:--|:--|
| `external_reference` | `*****` in every log sink (Constitution §P7; FR-009 inheritance) |
| `voucher_authority_redemption_id` | Permitted in audit + on the receipt slip per FR-017; redacted in `pino` if the field-policy review flags it. |
| Any field carrying voucher code, voucher balance, voucher holder PII, voucher redemption intent token, raw authority payload | **MUST NEVER appear** in 008 audit payloads (FR-071). 008 inherits 006's voucher-data minimisation discipline at the audit boundary. |
| Any field carrying PAN, truncated PAN, CVV, cardholder name, expiry, auth payload, approval code, terminal-printed receipt text, cryptogram | **MUST NEVER appear** in 008 audit payloads (FR-070, Constitution §P6). 008 inherits 006's card-data minimisation discipline. |
| Sale's full receipt payload (the HTML or ESC/POS bytes) | **MUST NEVER appear** in any audit payload or log. Audit references the `sale_id` + `print_event_id`; the payload itself is regenerable from the persisted Sale row. |
| `envelope.handoff_action_id` | Allowed in audit (it's the correlation key) but only as a UUID; the rest of the envelope payload (FR-074) is never logged. |

**Resolves:** AD-9.

### AD-10 — Reprint permission: cashier-permitted with bilingual marker as mitigation (LOCKED)

**Decision.** Reprint is **cashier-permitted** with full
attribution; no supervisor / manager / admin override is required at
action time (Clarifications 2026-05-27; spec FR-028). The bridge
handler `receipts.reprint` self-gates on `requireOperatorSession`
(any role: cashier, manager, admin); the renderer affordance is
visible whenever an operator is signed in and the sale has at least
one successful `print_events` row.

The renderer surface offers reprint only when:

1. The signed-in operator's session is active (004 inheritance).
2. The Sale row exists, is durable, and has at least one `print_events`
   row with `outcome='success'` (FR-028's "printed at least once
   successfully" precondition).
3. The originally-failed-then-successfully-retried case is treated
   as "printed at least once" (FR-052).
4. The "first-print never succeeded → manual-override taken → later
   reprint requested" case is treated by `receipts.reprint` as the
   canonical first print (per Edge Cases in spec); the duplicate-copy
   marker is **absent**, and the audit event is
   `sale.receipt.print_retried_success` (or `sale.receipt.printed`
   if the printer was never tried after the manual override). This
   edge case is the spec's "first-print after manual override" rule.

**Mitigation against R2 (covert refund / fraud).** The bilingual
duplicate-copy marker (FR-029) is **load-bearing**:

- Large weight, top-of-slip placement, both Arabic ("نسخة طبق
  الأصل") and Latin ("DUPLICATE COPY") visible.
- The receipt template asset's `reprint_duplicate` variant defines
  the marker styling.
- Slice 5 acceptance criteria include a visual test: marker must
  be obvious to a customer glancing at the slip; reviewers verify
  with a printed slip + a 1.5-metre stand-off-and-glance review
  (the standard counter-distance heuristic).

**Future expansion path.** If reprint abuse becomes a material
risk pattern later (a cashier flagged with anomalous reprint
frequency), a future fraud-control feature MAY layer:

- A "reprints per shift > threshold" alert routed to the manager
  surface (004 S5 pattern).
- An optional supervisor-override at action time, behind a
  tenant-level feature flag.

Neither is delivered by 008.

**Resolves:** AD-10 (the carry-forward from Clarifications 2026-05-27).

### AD-11 — Sync-handoff outbox: enqueue-only, no flush (LOCKED)

**Decision.** A single row is inserted into `sale_sync_outbox` inside
the AD-2 atomic finalize transaction (same transaction as `sales` +
`audit_events`). The row carries the minimum reference needed by a
future sync engine:

| Field | Notes |
|:--|:--|
| `outbox_row_id` | UUID v4 primary key. |
| `sale_id` | FK to `sales.sale_id`. |
| `handoff_action_id` | Carried for cross-feature correlation; the future sync engine MAY use this as the idempotency key to backend. |
| `tenant_id`, `branch_id`, `terminal_id` | For tenant-isolation queries by the future sync engine. |
| `enqueued_at` | UTC timestamp. NOT NULL. |
| `state` | enum: `pending` only at insert time. The column exists for the future sync engine; 008 never transitions it. |

**008 does NOT** flush, attempt to flush, retry, conflict-resolve,
call any backend endpoint, mark rows as sent, or implement any
"sync engine ready" signal. The outbox is a *durable substrate*
the future sync engine reads.

**Why the column exists if 008 never transitions it.** Adding the
column now means the future sync engine ships an additive
migration (adding indexes or columns) rather than rewriting the
table. Adding a state column day-one is cheaper than a future
schema-change burden, and it matches 006's `payment_action_outbox`
state-column posture.

**Outbox growth concern (spec Risk R5).** Until the sync engine
ships, this table grows monotonically (one row per finalized
sale). At ~1,000 sales/day per terminal, that's ~365k rows/year
— well inside SQLite comfort. No hard cap, no truncation, no
retention rule in 008. The future sync engine owns retention; 008
does not.

**Resolves:** AD-11.

### AD-12 — OpenAPI / backend impact: zero (LOCKED)

**Decision.** **No new OpenAPI surface.** 008 makes zero backend
calls. §A2 records a no-op for every 008 slice (S0–S6).

**Why.** 008's product behaviour is local-only by construction
(spec Dependencies §"Backend `api.smartdatapulse.tech`"). The future
sync engine introduces the backend surface; 008 prepares only the
local durable substrate (AD-11). The local-only posture matches
Constitution Principle I (offline-first — the sale MUST complete
even with zero connectivity).

**Resolves:** AD-12.

---

## Approval Gates (status snapshot)

> All gates below are **status only**. None are opened by this PR.
> Implementation slices remain ⛔ held until each named gate clears
> through the standard slice-by-slice approval process.

| Gate | What it gates | Status |
|:--:|:--|:--:|
| **§A0** | Upstream readiness: 005 SPEC COMPLETE ✅ · 006 SPEC COMPLETE ✅ (2026-05-26) · 007 closed ✅ · 004 visibility boundaries shipped ✅ · `/speckit-clarify` 008 applied ✅ (2026-05-27) · `/speckit-plan` v1.0 ✅ this PR. | ✅ Cleared (this PR closes §A0) |
| **§A1** | Visual-direction Slice 0 — receipt template asset (first_print + reprint_duplicate + preview variants; bilingual; RTL; Latin numerals; bold duplicate-copy marker), preview UI panel, manual-override surface, printer-failure banner, drawer-failure banner. | ⛔ Held — gated on `/speckit-tasks` + Slice 0 commission |
| **§A2** | Backend / OpenAPI: **no-op for every 008 slice** per AD-12. §A2 sign-off records the no-op once per slice merge. | ⛔ Held; no-op confirmed by AD-12 |
| **§A3** | Migrations: **four new SQLite tables** (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`) + append-only triggers on each + the `sale_number_sequences` allocator table + ten new audit-event categories registered with 004's existing `audit_events` catalogue. Authored in **Slice 1**. | ⛔ Held |
| **§A4** | Bridge-API surface: `sales.*` (read-only) + `receipts.*` (preview / print / reprint / manualOverride / retryPrint) per [./contracts/bridge-api.md](./contracts/bridge-api.md). Security-review handoff required before Slice 1 ships. | ⛔ Held; draft contract authored in this PR |
| **§A5** | Production readiness: coverage thresholds met (≥ 95 % on money-math, sale-number allocator, receipt-payload generator, print pipeline, drawer-kick logic, audit-event emitter, sync-outbox enqueuer; ≥ 90 % on renderer preview / reprint / failure-banner surfaces); pino redaction sample audited (no card data, no voucher secrets, no PIN, no JWT, no device token, no raw envelope payload, no full receipt payload); security-review sign-off; hardware bring-up record in `docs/hardware-matrix.md` for ≥ 1 thermal printer + drawer combination; rollback strategy + support runbook entry per Constitution Production Readiness Gates. Blocks rollout, not slice merge. | ⛔ Held |

---

## Slices (LOCKED v1.0 grouping)

> Slice numbering is **locked** by this plan. `/speckit-tasks` produces
> the per-slice startable task list with file paths; this plan locks
> the *grouping*, *dependencies*, and *gate-attachment* per slice.

### Slice 0 — Visual direction (no code)

- **Scope.** Commission the receipt-template + 008-surface visual
  direction review: bilingual Arabic-first RTL receipt slip in three
  variants (`first_print`, `reprint_duplicate`, `preview`), bold
  visible duplicate-copy marker (FR-029) in both languages, footer
  with tax-registration ID + sale-level VAT total, preview UI panel,
  manual-override affordance, persistent printer-failure banner,
  persistent drawer-failure banner. Sign-off recorded as §A1
  cleared.
- **Gates.** §A0 ✅ + §A1 commission. **Held.**
- **Test floor.** n/a (no code).
- **Deliverable.** A signed-off `visual-direction/` folder under
  `specs/008-sale-finalization-and-receipts/` containing the
  receipt slip mocks, duplicate-copy marker styling, preview UI
  panel mocks, failure-banner mocks, and the bilingual font /
  numeral conventions per Constitution Localization.

### Slice 1 — Finalization listener + persistence + 006 wiring (no UI, no print)

- **User stories.** Backstop for US-Primary acceptance scenarios 1
  (durable finalization), 2 (sale number stability), 10 (force-fail
  refusal), 14 (sync-handoff staging).
- **Scope.** **Load-bearing slice.** Author:
  - The four new SQLite tables under §A3
    (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`)
    + the `sale_number_sequences` allocator table + the append-only
    triggers on the first four + the ten new audit-event categories
    registered with 004's `audit_events` catalogue.
  - The 006 → 008 in-process listener (AD-2) including the
    idempotency check on `envelope.handoff_action_id`.
  - The sale-number allocator (AD-7), main-process, per-terminal
    per-calendar-day, with concurrent-finalize test.
  - The AD-2 atomic finalize transaction: allocate sale_number →
    INSERT `sales` row → INSERT `sale_sync_outbox` row → emit
    `sale.finalized` audit event → all atomic.
  - The `sales.read` + `sales.subscribe` + `sales.findByNumber`
    bridge handlers (read-only) per [./contracts/bridge-api.md](./contracts/bridge-api.md).
  - Force-fail / reversal_pending refusal guard (FR-005 / FR-045 /
    FR-046 / FR-047) → `sale.finalization_refused` audit event.
- **Gates.** §A0 ✅ + §A1 (Slice 0 sign-off) + §A2 (no-op) + §A3
  (table review) + §A4 (bridge review). **Held.**
- **Test floor.** ≥ 95 % coverage on:
  - the sale-number allocator (per-terminal per-day uniqueness;
    concurrent-finalize race; calendar-day boundary at midnight
    local timezone);
  - the AD-2 finalize transaction (atomicity: kill the process
    mid-transaction; restart; assert no partial Sale row exists);
  - idempotency replay (duplicate `handoff_action_id` → no-op
    returning existing sale identifiers);
  - force-fail / reversal_pending refusal guard (every 006 FSM state
    that MUST NOT finalize is refused).

### Slice 2 — Receipt payload generation + preview

- **User stories.** US-Primary acceptance scenarios 3 (payload from
  durable sale), 6 (preview), 13 (attribution on receipt), 11
  (voucher-safe content), 12 (external-card-terminal-safe content).
- **Scope.**
  - The receipt-template engine (AD-6): single-source dual-output
    (ESC/POS byte stream + HTML/canvas) reading from the persisted
    Sale row only (never the live cart).
  - The bilingual template asset (Arabic-first RTL with Latin
    numerals; English fallback panel; sale-level VAT footer per
    Clarifications 2026-05-27).
  - The `receipts.preview` bridge handler.
  - The renderer preview panel (visually mirrors the printed slip,
    does not emit print, does not kick drawer).
  - The byte-stability test: regenerating the payload for the same
    Sale produces an identical output (modulo the
    `reprint_duplicate` marker and the time-of-print field,
    which are template-variant-controlled).
- **Gates.** §A1 (Slice 0 sign-off; template asset signed off) +
  §A2 (no-op) + §A4 (bridge review). **Held.**
- **Test floor.** ≥ 95 % on the template engine; ≥ 90 % on the
  preview UI; byte-stability test; voucher-data minimisation test
  (no voucher code / balance / token in any rendered slip);
  card-data minimisation test (no PAN / CVV / etc. in any rendered
  slip).

### Slice 3 — First-print pipeline (ESC/POS direct + OS-print fallback) + audit

- **User stories.** US-Primary acceptance scenarios 4 (cash sale
  prints + drawer opens), 5 (cashless sale prints without drawer),
  8 (printer failure stays loud), and the print half of scenarios
  11–12.
- **Scope.**
  - The ESC/POS adapter integration (`node-thermal-printer` or
    equivalent — final pick at §A3 hardware review).
  - The OS-print fallback path via `webContents.print`.
  - The path-selection logic (ESC/POS preferred when supported;
    OS-print fallback otherwise).
  - The `receipts.print` internal main-process handler — fires
    automatically when AD-2 finalize completes, NOT
    renderer-callable directly.
  - The `receipts.retryPrint` renderer-callable handler for
    cashier-initiated retry-after-failure (FR-051).
  - The `print_events` row INSERT on success or failure.
  - The `sale.receipt.printed` / `sale.receipt.print_failed` /
    `sale.receipt.print_retried_success` audit-event emission.
  - The persistent printer-failure banner (renderer; non-modal;
    no auto-dismiss).
- **Gates.** §A1 + §A2 (no-op) + §A3 (hardware bring-up record
  in `docs/hardware-matrix.md` for at least one tested printer
  model) + §A4 (bridge review). **Held.**
- **Test floor.** ≥ 95 % on the print pipeline (path selection,
  ack handling, retry idempotency vs FR-053); printer-failure
  loud-banner test (banner appears, does not auto-dismiss, Sale
  row remains durable); print-retry-success-treated-as-first-print
  test (FR-052).

### Slice 4 — Drawer-kick + drawer-failure banner + drawer audit

- **User stories.** US-Primary acceptance scenarios 4 (drawer
  opens on cash-inclusive first print), 5 (drawer does NOT open
  on cashless), 9 (drawer-kick failure does not invalidate sale).
- **Scope.**
  - The separate ESC/POS pulse drawer-kick command (AD-8); not
    embedded in receipt byte stream.
  - The drawer-kick gating logic (FR-040): only first print of a
    sale whose tender mix includes ≥ 1 applied `cash` line, only
    after print-success ack.
  - The drawer-kick idempotency rule against double-kick (FR-053):
    a sale with an existing `sale.drawer.opened` audit event
    suppresses further kicks.
  - The `drawer_events` row INSERT on success, suppression, or
    failure.
  - The `sale.drawer.opened` / `sale.drawer.suppressed` /
    `sale.drawer.failed` audit-event emission.
  - The persistent drawer-failure manual-override banner (renderer;
    non-modal; no auto-dismiss).
  - The `last_successful_open_at_for_terminal` field on
    `sale.drawer.failed` events (Constitution Principle IV
    requirement).
- **Gates.** §A1 + §A2 (no-op) + §A3 (drawer hardware bring-up
  record) + §A4 (bridge review). **Held.**
- **Test floor.** ≥ 95 % on the drawer-kick logic; cashless-sale
  no-kick test; reprint no-kick test; drawer-failure banner test
  (banner appears, does not auto-dismiss, Sale + receipt remain
  durable); double-kick suppression test (FR-053).

### Slice 5 — Reprint + duplicate-copy marker + reprint audit

- **User stories.** US-Primary acceptance scenarios 7 (reprint with
  visible duplicate-copy marker, no mutation, no drawer kick).
- **Scope.**
  - The `receipts.reprint` bridge handler (cashier-permitted per
    AD-10; gated on signed-in operator session + ≥ 1 successful
    `print_events` row).
  - The `reprint_duplicate` template variant (visible bilingual
    marker; FR-029 load-bearing).
  - The reprint-attribution rule (FR-024): audit event attributes
    to the **reprinting** operator, not the selling operator.
  - The reprint-counter projection from `print_events` (no
    column on `sales`; derived).
  - The `sale.receipt.reprinted` audit-event emission with
    `duplicate_copy_sequence_number`.
  - The reprint-suppresses-drawer rule (FR-030).
  - The visual review checklist for "duplicate-copy marker is
    obvious at counter distance" (Slice 5 review gate; manual,
    not automatable).
- **Gates.** §A1 (Slice 0 marker styling signed off) + §A2
  (no-op) + §A4 (bridge review). **Held.**
- **Test floor.** ≥ 95 % on the reprint flow; reprint-no-mutation
  test (Sale row identical before and after; INSERT-only on
  `print_events`); reprint-no-drawer test; reprint-attribution
  test (audit row carries reprinting operator id, not selling
  operator id).

### Slice 6 — Manual-override + sync-outbox finalisation + production readiness

- **User stories.** Manual-override path (FR-051), edge case
  "first-print after manual override" (FR-052 + spec Edge Case),
  US-Primary acceptance scenario 14 (sync-handoff staging — final
  verification that the outbox row is durable across the full
  pipeline).
- **Scope.**
  - The `receipts.manualOverride` bridge handler.
  - The renderer manual-override affordance on the printer-failure
    banner.
  - The `sale.receipt.manual_override` audit-event emission.
  - The edge-case handling for "manual-override taken, then later
    a successful retry / first-print attempt happens" (no
    duplicate-copy marker; `sale.receipt.print_retried_success`
    audit event).
  - Production-readiness verification: coverage floors met
    (Slice 1 + 2 + 3 + 4 + 5 + 6 modules), pino redaction sample
    audited (no card data, no voucher secrets, no full receipt
    payload, no PIN, no JWT, no device token, no raw envelope
    payload), Sentry scrubber updated, security-review handoff
    on the full bridge surface + the trust boundary +
    `safeStorage` interactions (008 does not store secrets, but
    confirms it), hardware-bring-up matrix recorded in
    `docs/hardware-matrix.md`, support runbook entry authored,
    rollback strategy authored. §A5 sign-off recorded in
    `coordination.md`.
- **Gates.** §A1 + §A2 (no-op) + §A4 + §A5. **Held; blocks
  rollout, not slice merge.**

---

## Test Strategy

Constitution §VI requires test-first. The shape of those tests is
locked here; file paths are authored by `/speckit-tasks`.

### Coverage floors

| Module | Floor | Rationale |
|:--|:--:|:--|
| Money math (sale totals projection from envelope, sale-level VAT formatting, change-due sum across cash lines, settlement-invariant re-check at finalize entry) | **≥ 95 %** | Constitution §II / P1 non-negotiable |
| Sale-number allocator (per-terminal per-day uniqueness, concurrent-finalize race, calendar-day midnight boundary) | **≥ 95 %** | Audit-anchor integrity |
| Receipt-payload generator (template engine, byte-stability across re-generation, voucher-data minimisation, card-data minimisation, bilingual + RTL + Latin-numeral conventions) | **≥ 95 %** | Constitution §P6 / §P7 / Localization |
| Print pipeline (path selection, ack handling, retry idempotency, manual-override transition) | **≥ 95 %** | Constitution Principle IV |
| Drawer-kick logic (FR-040 gating, FR-053 double-kick suppression, drawer-failure surfacing) | **≥ 95 %** | Constitution Principle IV |
| Audit-event emitter (ten new categories, payload shapes per AD-9, redaction discipline) | **≥ 95 %** | Constitution §P4 / §P11 |
| Sync-outbox enqueuer (atomicity with sales row commit) | **≥ 95 %** | Constitution §P3 / §P18 |
| AD-2 finalize transaction (atomicity under process kill) | **≥ 95 %** | Constitution §P3 / §P5 |
| Bridge handlers (`sales.*` + `receipts.*`) | **≥ 95 %** | Trust-boundary contracts |
| Renderer preview / reprint / failure-banner surfaces | **≥ 90 %** | Display logic, generic refusal copy, banner persistence |

### Test categories

- **Unit (vitest, main-side):**
  - Sale-number allocator (per-terminal per-day; midnight roll;
    concurrent-finalize collision rejected).
  - Receipt-template engine (byte-stable across regenerations;
    voucher-safe content; card-data-safe content; bilingual rendering;
    Latin numerals on printed output).
  - Audit-event payload shapes (every category in AD-9 matches the
    documented shape; `external_reference` redacted in log sink).
  - 006 → 008 listener (idempotent on duplicate
    `handoff_action_id`; refuses on `force_failed` / `reversal_pending`).
  - Print pipeline (path selection; retry vs reprint distinction).
  - Drawer-kick gating (cashless suppression; reprint suppression;
    double-kick suppression).
- **Unit (vitest, renderer-side):**
  - Preview panel state (mirrors persisted Sale; does not emit
    print).
  - Reprint affordance gating (visible only when ≥ 1 successful
    print_events row exists).
  - Persistent banner state machines (printer-failure,
    drawer-failure; no auto-dismiss; manual-override affordance).
  - Generic refusal copy mapping for `sales.*` / `receipts.*`
    refusal `reason` enum.
- **Integration (vitest, in-process with better-sqlite3):**
  - End-to-end finalize through all four tables: 006 emits
    `payment.settled` → 008 listener fires → atomic transaction
    commits Sale + sync_outbox + audit row → receipt rendered →
    print fires → drawer kicks (cash path) → all audit rows
    present, no row mutated post-INSERT.
  - Process-kill mid-finalize: kill the main process between 006's
    commit and 008's commit; restart; assert the duplicate-finalize
    no-op returns the existing sale (no partial state).
  - Reprint flow end-to-end: durable Sale present → reprint
    invoked → duplicate-copy slip rendered → no drawer kick → audit
    event recorded with reprinter attribution.
  - Printer-failure flow end-to-end: print fails → Sale durable →
    banner persists → manual-override invoked → audit recorded →
    later retry-print succeeds → treated as first print (FR-052).
- **Contract (vitest, compile-time):**
  - `contracts/bridge-api.md` Request/Response shapes match
    `src/shared/bridge-api.ts` TypeScript definitions (analogous
    to 004 T008 / 006 T070).
- **Property tests (vitest + fast-check):**
  - Sale-number allocator: across random terminal labels and
    random calendar-day rolls, every allocated number is unique
    per `(terminal_id, calendar_day_local)` and parseable back.
  - Settlement-invariant re-check: random tender-line mixes from
    006 → 008 always produce the same sale-total minor that 006
    settled, integer-safe (`Number.isSafeInteger` for every
    running sum).

### Security tests

Required for §A5 sign-off:

- No PAN / CVV / track / cardholder name / expiry / auth payload /
  approval code / cryptogram appears in any persisted row across
  the four 008 tables × the ten audit categories.
- No voucher code / voucher balance / voucher holder PII / voucher
  redemption intent token / raw authority payload appears in any
  persisted row or any log sink.
- `external_reference` redacted to `*****` in Sentry sample and in
  pino log file output.
- The full receipt payload (HTML or ESC/POS bytes) MUST NOT appear
  in any audit row, pino log, Sentry event, or support bundle.
- Generic refusal copy never discloses force-fail state, voucher
  state, card-terminal state, operator identity beyond the
  attribution badge, or `handoff_action_id`.
- The `sale_sync_outbox` row MUST NOT carry any sensitive payload;
  it carries only `sale_id` + `handoff_action_id` + tenant /
  branch / terminal scoping fields + timestamps.

---

## Security & trust boundary

This plan affirms the following as **load-bearing**:

- **Renderer is untrusted.** No JWT, device token, attestation, PIN,
  PIN hash, password, secret, credential, raw envelope payload,
  full receipt payload, voucher authority token, voucher redemption
  intent token, voucher balance, voucher holder PII, cardholder
  data of any kind, or sensitive ID crosses the bridge into the
  renderer.
- **Main-process role checks are primary** (Constitution §III).
  Renderer route guards are secondary UX defence only.
- **Generic refusal copy.** The renderer translates each closed
  refusal reason to a generic message. No reason category leaks to
  the cashier-visible UI.
- **Audit attribution.** Every `sale.*` audit event carries the
  signed-in operator's Clerk-backed identity. The reprinting
  operator (Slice 5) is distinct from the selling operator;
  both are retrievable from the audit log (FR-024). Manager
  identity on force-fail refusal (008 inherits 006 FR-021)
  is recorded in the audit payload but never echoed to the
  cashier-visible UI.
- **Logging.** Per Constitution §P7: no raw envelope, no voucher
  secret, no card-like value, no PIN, no token, no credential,
  no full receipt payload reaches any log sink (Sentry, console,
  local file). The `external_reference` field is `*****`-redacted
  in every log sink (inherits 006 FR-009).
- **No backend calls.** 008 makes zero outbound HTTP requests. The
  `sale_sync_outbox` is a durable substrate for a future sync
  engine; 008 itself never reaches `api.smartdatapulse.tech`.
- **Hardware-failure surfacing.** Constitution Principle IV
  requires loud, structured failure: printer failure → persistent
  non-modal banner (no auto-dismiss); drawer failure → persistent
  non-modal manual-override banner with `last_successful_open_at`.

---

## Risks and concerns

| ID | Risk | Mitigation |
|:--|:--|:--|
| **R-1** | Receipt template asset typography (Arabic font + RTL) ships with a regression that violates Constitution Localization. | §A1 Slice 0 visual-direction sign-off includes a printed-slip review; Slice 2 byte-stability test asserts the bilingual template renders both ESC/POS and HTML byte-stably; Slice 5 visual review checklist includes the bilingual duplicate-copy marker review at counter distance. |
| **R-2** | "Duplicate copy" marker on a reprint slip is not obvious enough to a customer glancing at it → fraud risk per spec R2. | FR-029 + AD-10 mitigation: bold, top-of-slip, bilingual marker; the `reprint_duplicate` template variant is visually distinct from `first_print` not just by an added marker but by a visual treatment difference (header band colour or border). Slice 5 manual review at counter distance is the gate. |
| **R-3** | The 006 → 008 in-process listener (AD-2) drops a `payment.settled` event under main-process restart or crash. | The `payment.settled` audit row is already durably committed by 006 inside its SQLite transaction. On 008 startup, the listener re-scans the `audit_events` table for `payment.settled` rows whose `handoff_action_id` has no matching `sales` row, and re-fires AD-2 finalize for each one. Idempotent on `handoff_action_id`. |
| **R-4** | OS-print fallback path emits a visually different slip from the ESC/POS direct path → fails the byte-stability rule FR-016. | AD-6 mandates single-source dual-output: both outputs derive from the same template + same payload. Slice 2 byte-stability test compares the two outputs (ESC/POS-rasterised vs HTML-rendered) field-by-field and refuses to merge if they diverge in any user-visible field. Layout details (column widths, font fallback) MAY differ between paths; the *data* is identical. |
| **R-5** | Drawer kicks twice on a retry-after-partial-success (drawer opened, paper jammed mid-print, cashier retries → kicks again). | FR-053 + AD-8 idempotency: drawer-kick is gated main-side on the absence of a `sale.drawer.opened` audit event for this sale_id. Tested by the Slice 4 double-kick suppression test. |
| **R-6** | Sale-number sequence resets at midnight while a sale-in-progress is mid-finalize → sale-number from "yesterday's sequence" gets allocated for "today's sale", inconsistent with the date stamp on the slip. | AD-2's atomic finalize transaction allocates the sale_number and stamps `finalized_at` in the same SQLite transaction. The allocator reads the current local-timezone calendar day inside the transaction; the date stamp on the slip is derived from `finalized_at` (same value). Race-window is negligible; tested by the Slice 1 midnight-boundary integration test. |
| **R-7** | Outbox grows unbounded until the future sync engine ships (Spec R5). | Documented in AD-11; ~365k rows/year per terminal is well inside SQLite comfort. No hard cap, no truncation in 008. The future sync engine spec owns retention. |
| **R-8** | A future inventory spec or refunds spec mutates the `sales` row to "mark stock decremented" or "mark refunded". | AD-3 physical-layer trigger denies UPDATE / DELETE on `sales`. Future features MUST add new event tables, not mutate the Sale. The trigger is the load-bearing guard. |
| **R-9** | Voucher data leaks onto the printed receipt because the receipt template asset author inadvertently includes a voucher field. | Slice 2 voucher-data minimisation test exercises every voucher field 006 might populate and asserts NONE appears in the rendered slip (HTML or ESC/POS). The `voucher_authority_redemption_id` is the only field permitted, and only when 006 FR-017 / OQ-PLAN-7 resolves permissively. |
| **R-10** | `external_card_terminal` `external_reference` value typo-pasted as card-shaped data leaks onto the receipt. | 006 FR-009's `^[A-Z0-9]{0,6}$` regex + main-side re-validation + Sentry redaction + audit redaction inheritance. The receipt template MAY print `external_reference` only when 006 OQ-PLAN-5 resolves permissively; the value is bounded to ≤6 alphanumeric chars by construction (cannot encode a PAN). |
| **R-11** | UI implementation drifts from §A1 visual direction (the bilingual duplicate-copy marker becomes a watermark). | Slice 5 visual review checklist + Slice 6 production-readiness gate include a printed-slip review against the §A1 mocks. A failed review blocks rollout, not slice merge. |
| **R-12** | `sale_number_sequences` race between two concurrent finalizes at midnight. | Concurrent finalize on a single terminal is already prevented by 006's `payment_attempts (terminal_id) WHERE state='started'` partial unique index. 008's AD-2 listener serialises per-`handoff_action_id` further. The Slice 1 concurrent-finalize integration test asserts no duplicate sale_number ever issues. |

---

## Constitution Check (Initial)

> Walks both Roman-numeral Principles I–IX **and** the published
> Cross-Feature Principles P1–P18 from `.specify/memory/constitution.md`
> v1.5.1. Status `PASS` / `WAIVED` / `VIOLATION`. NON-NEGOTIABLE rows
> (I, III, VIII) MUST be PASS — no WAIVED state permitted.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| **I. Offline-First** *(NON-NEGOTIABLE)* | PASS | 008 makes zero backend calls. Sale finalization, receipt print, and drawer kick all complete with zero connectivity. Constitution P18 satisfied by the durable `sale_sync_outbox` row. |
| **II. Financial Precision** | PASS | Integer minor units throughout the receipt payload, the sale-level VAT total field, the cash-line `amount_applied_minor` / `change_due_minor` projections inherited from 006. ≥ 95 % money-math coverage floor. `Number.isSafeInteger` guards. |
| **III. Process-Boundary Discipline** *(NON-NEGOTIABLE)* | PASS | Finalization ownership in main process (AD-1). Renderer is preview / reprint / banner only. Every bridge handler self-gates with `requireOperatorSession`. No upward-of-bridge IPC. `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` preserved. |
| **IV. Hardware Loud, Not Silent** | PASS | NFR-002 + spec FR-043 / FR-050 / FR-051 / Slice 3 + Slice 4 banner contracts. Printer failure → persistent non-modal banner with no auto-dismiss. Drawer failure → persistent non-modal manual-override banner with `last_successful_open_at`. |
| **V. Type Safety End-to-End** | PASS | `contracts/bridge-api.md` is the typed seam; renderer + main both compile against the same Request/Response types (compile-time contract test per Slice 3 task). TypeScript strict in both tsconfigs (inherits 001). |
| **VI. Test-First, Coverage-Gated** | PASS | Slice test floors locked above. Test-first ordering enforced by `/speckit-tasks` per 005/006 precedent. ≥ 95 % on critical modules; ≥ 90 % on renderer surfaces. |
| **VII. Observability** | PASS | Pino logs structured with `terminal_id`, `cashier_id` (operator id), `sale_id`, `print_event_id`, `drawer_event_id`. Sentry scrubber extended for `external_reference` + voucher fields (inherits 006). Every transaction carries `handoff_action_id` as the cross-feature audit anchor. |
| **VIII. Terminal Identity ≠ User Identity** *(NON-NEGOTIABLE)* | PASS | Operator attribution via 004 Clerk identity; never the device token, never the PIN record id. Terminal identity (`terminal_id`, `terminal_label`) appears on every Sale row and every receipt slip for audit, distinct from operator identity (clarification rule 6 inheritance). |
| **IX. Reference, Not Inheritance** | PASS | Legacy `_reference/Data-Pulse/` is not copy-pasted. Pharmacy receipt conventions (tax-reg ID, bilingual layout) are *re-derived* against current requirements. |
| **Platform Integration** | PASS | No new endpoints. No SaaS-DB direct access. No Sentry/auto-update changes. The single typed API client (006 / future sync engine territory) is untouched by 008. |
| **Security** | PASS | No card data. No voucher secrets. No PIN. No JWT. No device token. No raw envelope. No full receipt payload in logs. `safeStorage` interactions are read-only (008 reads tax-reg ID / branch / terminal_label from cached terminal config provisioned by 002 — see Assumption A3). CSP unchanged. |
| **Hardware Matrix** | PASS | Thermal printer + optional drawer kick (DK1/DK2 ESC/POS pulse) — within Constitution Hardware MVP. ESC/POS direct path preferred; OS-print fallback when ESC/POS unsupported (constitution-required). 44 × 44 CSS px touch-target floor (FR-068). Hardware bring-up recorded in `docs/hardware-matrix.md` under §A3. |
| **Domain — Pharmacy POS** | PASS | Receipts include tax-registration ID, cashier display name, branch identifier, terminal id; per-line items derived from the envelope; sale-level VAT total in the footer (Clarifications 2026-05-27); the Sale row is the audit anchor that refunds (future) and shifts (future) will reference. |
| **P1 — Financial Correctness First** | PASS | Sale durable BEFORE any user-visible signal (FR-002); append-only Sale row (AD-3 physical-layer trigger); integer minor units; receipt byte-stable. |
| **P2 — No Fake Success** | PASS | Print success on the screen MUST follow printer ack (FR-026 + AD-8 ordering); drawer "opened" badge MUST follow drawer-kick ack; printer / drawer failure surfaces persist with no auto-dismiss. |
| **P3 — No Silent Data Loss** | PASS | AD-2 atomic finalize (Sale + outbox + audit in one transaction); listener restart re-scans for missed `payment.settled` events (R-3 mitigation); append-only triggers prevent later mutation. |
| **P4 — Auditability and Non-Destructive Financial Correction** | PASS | AD-3 physical-layer append-only triggers; reprints append `print_events` rows + audit events, never mutate Sale; future refunds will append, not mutate (AD-3 lock-in). |
| **P5 — Idempotency for Retried Operations** | PASS | AD-2 keys on `envelope.handoff_action_id`; duplicate finalize is no-op (SC-009). `receipts.*` mutating handlers accept `idempotency_key` UUID v4 (mirrors 005/006). |
| **P6 — No Raw Cardholder Data by Default** | PASS | FR-070; redaction-on-every-sink discipline (AD-9 redaction table); inherits 006 FR-008 / FR-040 + Constitution P6. Slice 6 redaction audit gate. |
| **P7 — Secrets Never Reach Renderer or Logs** | PASS | FR-071..FR-074 + AD-9 redaction surface. Voucher secrets, PINs, JWTs, device tokens, raw envelope payloads, full receipt payloads all redacted-or-absent in every log sink. |
| **P8 — Electron Security Boundary** | PASS | Bridge surface authored under §A4 security-review handoff. `src/preload/`, `src/main/`, `src/shared/bridge-api.ts`, `migrations/` changes are owned by *this* feature explicitly (the AD-3 migration is authored under §A3 Slice 1). |
| **P9 — Truthful Offline / Degraded / Sync States** | PASS | The `sale_sync_outbox` row is *real* durable state, not a visual-only promise. The 003 `syncing` connection-state visual remains visual-only until the future sync engine reads this outbox; 008 does not falsely promise that any UI signal means "synced to backend". |
| **P10 — Operator Accountability for Sensitive Actions** | PASS | Sale, reprint, drawer-kick, manual-override all carry signed-in-operator attribution. Reprint attribution is the reprinting operator (FR-024); the selling operator is preserved on the Sale row separately. |
| **P11 — Supportability Without Secret Leakage** | PASS | Ten new audit-event categories all named, payload-shapes locked (AD-9); redaction list extends 004's pino-redaction list with `external_reference`, voucher-secret fields, and the full receipt payload; support-bundle export honours the existing redaction pipeline. |
| **P12 — Spec Kit Artifacts Are Source of Truth** | PASS | `spec.md` + this `plan.md` + future `tasks.md` are the source of truth. No Figma frame or design URL is cited as a requirement; Slice 0 visual-direction sign-off becomes a Spec Kit artefact under `visual-direction/`. |
| **P13 — Small, Scoped Implementation PRs** | PASS | Six slices (S0–S6) authored above; each slice's PR ships only its listed tasks; `/speckit-tasks` will list file paths per task. |
| **P14 — Accessibility and Cashier Ergonomics** | PASS | FR-068 (44 × 44 touch-target floor); FR-069 (keyboard-operable on every interactive control); FR-065 / FR-066 (Arabic-first RTL + Latin numerals on print); axe-rule cleanliness asserted by Slice 2 / 5 / 6 renderer test floors. |
| **P15 — Production Readiness Gates** | PASS | 008 is a production-affecting feature (touches the cash drawer). §A5 includes test plan, rollback strategy, support runbook entry, failure-mode catalogue, hardware bring-up record. Blocks rollout, not slice merge. |
| **P16 — Feature Scope Discipline** | PASS | Out of Scope section + this plan's Hard non-implementation boundaries enumerate every domain 008 does NOT touch (inventory mutation, refunds, X/Z reports, full sync engine, backend accounting, SaaS DB direct access, real card processor). |
| **P17 — Privacy and Tenant Isolation** | PASS | Every 008 row carries `tenant_id`, `branch_id`, `terminal_id`. The `sale_sync_outbox` carries them too so the future sync engine can scope by tenant before any data leaves the device. |
| **P18 — Local Durability Before Offline Promises** | PASS | The `sale_sync_outbox` row is the canonical satisfaction: 008 provides the first **real durable state** that any future offline-sync promise will rest on. No marketing or UI text in 008 promises backend synchronisation; only "this sale is finalized locally and will be picked up by a future sync engine". |

**Result: PASS.** No constitution violations require a Complexity-Tracking
override. No NON-NEGOTIABLE waiver needed.

---

## Phase 0 — Research

See [./research.md](./research.md). Phase 0 records the alternatives
considered for every AD-1..AD-12 above and resolves all
plan-level technical decisions (no NEEDS CLARIFICATION remains).

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md) — `sales`,
  `print_events`, `drawer_events`, `sale_sync_outbox`, and
  `sale_number_sequences` (the allocator table).
- **Contracts:** [./contracts/bridge-api.md](./contracts/bridge-api.md)
  — DRAFT `sales.*` + `receipts.*` bridge namespaces (`drawer.*` is
  main-process-only; no contract surface).
- **Quickstart:** [./quickstart.md](./quickstart.md) — developer
  walk-through of the cash-sale happy path, the reprint path, the
  printer-failure path, and the drawer-failure path.

---

## Project Layout

The plan commits to the following directory shape inside the existing
repo (authored progressively by Slices 1–6; this plan does NOT
create any files yet):

```text
src/
  main/
    sales/
      finalize-listener.ts          # AD-2 in-process listener
      finalize-transaction.ts       # AD-2 atomic transaction
      sale-number-allocator.ts      # AD-7
      sales-bridge.ts               # sales.* handlers
      sales-repository.ts           # SQLite reads of sales / print_events / drawer_events
    receipts/
      receipts-bridge.ts            # receipts.* handlers (preview, reprint, retry, manualOverride)
      receipts-payload.ts           # FR-015 payload derivation from persisted Sale
      print-pipeline.ts             # Slice 3: ESC/POS + OS-print dispatch
      print-events-repository.ts
      templates/                    # AD-6 template engine
        engine.ts
        first-print.bilingual.template
        reprint-duplicate.bilingual.template
        preview.bilingual.template
    drawer/
      drawer-kick.ts                # AD-8 separate ESC/POS pulse
      drawer-events-repository.ts
    sync-outbox/
      sale-sync-outbox.ts           # AD-11 enqueue (no flush)

src/preload/
  bridge-api-008.ts                 # exports sales.* + receipts.* contextBridge surface
                                    # (consolidates into src/shared/bridge-api.ts under P8 review)

src/shared/
  bridge-api.ts                     # extends with sales.* + receipts.* Request/Response types

src/renderer/
  features/
    receipts/
      ReceiptPreview.tsx
      ReprintAffordance.tsx
      PrinterFailureBanner.tsx
      DrawerFailureBanner.tsx
      ManualOverrideAffordance.tsx

migrations/
  NNNN_sales_finalization.up.sql   # Slice 1 §A3 — authored at migration time
  NNNN_sales_finalization.down.sql

specs/008-sale-finalization-and-receipts/
  spec.md
  plan.md                          # this file
  research.md
  data-model.md
  quickstart.md
  contracts/
    bridge-api.md
  visual-direction/                # Slice 0 deliverable (populated at §A1 commission)
  checklists/
    requirements.md                # post-/speckit-clarify state
```

File paths above are the **plan-pinned shape**. `/speckit-tasks`
authors the per-task file references against this layout. Any
deviation by `/speckit-tasks` MUST be motivated in the task list
and reflected back into this plan via an amendment.

---

## CI / Build / Package

No CI workflow changes from this plan. The existing pipeline gates
008 implementation when each slice begins:

1. `npm run codegen:verify` — no-op for 008 (per AD-12).
2. `npm run typecheck` — both tsconfigs.
3. `npm run lint` — ESLint + Prettier.
4. `npm test` — Vitest (renderer + main + business logic).
5. `npm run package:dir` — `electron-builder --win --dir` smoke build.

Coverage gate (constitutional VI floor) is enforced by Vitest's
`--coverage` ratchet; the ≥ 95 % floors on the modules listed under
Test Strategy are enforced by per-module thresholds in
`vitest.config.ts` (extended in Slice 1's first task).

---

## Constitution Check (Post-Design)

Re-evaluated after Phase 1 (data-model + contracts + quickstart)
authored. Every row that was PASS in the Initial check remains PASS
because the design artefacts implement, not relax, the rules above.

| Principle / Constraint | Status | Post-design note |
|:--|:--:|:--|
| I. Offline-First (NON-NEGOTIABLE) | PASS | `data-model.md` confirms zero backend dependencies; `sale_sync_outbox` is local-only. |
| II. Financial Precision | PASS | `data-model.md` types every money column as INTEGER (minor units); receipt-payload spec confirms `formatters` boundary. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | PASS | `contracts/bridge-api.md` shows the typed seam; no renderer-callable `drawer.*` surface; every handler gated. |
| IV. Hardware Loud, Not Silent | PASS | `data-model.md` carries `last_successful_open_at_for_terminal` on `drawer_events`; banners persist per spec. |
| V. Type Safety End-to-End | PASS | Bridge contract authored; compile-time contract test scheduled in Slice 3 tasks. |
| VI. Test-First, Coverage-Gated | PASS | Coverage floors locked; `vitest.config.ts` extension in Slice 1's first task. |
| VII. Observability | PASS | AD-9 audit-event catalogue + redaction surface table — no design drift. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | PASS | `data-model.md` Sale row carries `terminal_id` + `terminal_label` + `acting_operator_id` (selling) + `operator_session_id`. |
| IX. Reference, Not Inheritance | PASS | No copy-paste from legacy. |
| Platform Integration | PASS | No new endpoints in `contracts/`. |
| Security | PASS | Redaction surface table in AD-9 + Section 8 ("Security & trust boundary"). |
| Hardware Matrix | PASS | Slice 3 / Slice 4 §A3 hardware bring-up records. |
| Domain — Pharmacy POS | PASS | Receipt payload spec aligned with pharmacy receipt conventions. |
| P1–P18 (cross-feature) | PASS | No row regresses post-design. The `sale_sync_outbox` makes P18 concretely satisfied — the table is the durable substrate. |

**Result: PASS post-design.** Ready for `/speckit-tasks`.

---

## Next steps (post-approval)

When (and only when) this PR merges:

1. Run `/speckit-tasks` to generate the startable, file-path-bearing
   per-slice task list against this plan.
2. Run `/speckit-analyze` for cross-artifact consistency.
3. Commission §A1 visual direction (Slice 0).
4. Open Slice 1 (finalization listener + persistence + 006 wiring)
   under §A0 ✅ + §A1 + §A3 + §A4.

**Do not** run `/speckit-tasks` or `/speckit-analyze` in this PR.
**Do not** start implementation. **Do not** modify Data-Pulse-2.
**Do not** edit `_reference/Data-Pulse/`.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or
technical approach after task generation MUST update this plan and
re-run task generation.*
