# Research: 008-sale-finalization-and-receipts (Phase 0 — plan v1.0)

**Feature ID:** 008-sale-finalization-and-receipts
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-27
**Constitution version pinned:** v1.5.1

> Phase 0 research backing the locked architectural decisions in
> [./plan.md](./plan.md) §"Architectural Decisions (LOCKED in v1.0)".
> Every AD-1..AD-12 is recorded here with Decision / Rationale /
> Alternatives considered.
>
> **No code, no contracts, no migrations are authored by this file.**
> The data-model lives in [./data-model.md](./data-model.md); the
> bridge contract lives in [./contracts/bridge-api.md](./contracts/bridge-api.md).

---

## R-1 — Finalization ownership: main process

**Decision.** Main process owns the `Sale` row commit, the receipt-
payload generator, the print pipeline (ESC/POS + OS fallback), the
drawer-kick command, the sync-outbox enqueue, and all `sale.*`
audit-event emission. Renderer is preview / reprint / failure-banner
UI only.

**Rationale.**

1. Constitution §III (NON-NEGOTIABLE) requires the renderer to be
   untrusted for any state, role, totals, or attribution. The Sale
   row carries operator + tenant + branch + terminal attribution
   plus per-tender minor-unit amounts — every field is auditable
   state that the renderer cannot own.
2. The receipt template asset lives main-side (filesystem access).
   The ESC/POS adapter is a native binding — Constitution Tech Stack
   §"Printing" + §III preclude the renderer from holding either.
3. The drawer kick is a printer ESC/POS pulse — same constraint.
4. The sync-outbox INSERT runs atomically with the Sale row
   INSERT; SQLite transactions cross the main-process / renderer
   boundary only via the bridge surface, so atomic insert needs
   main-side ownership.
5. Process-restart survival: a finalized Sale persists across
   renderer reload, OS reboot, and renderer crash. Renderer-owned
   FSM cannot meet this.
6. Mirrors 005 AD-1 and 006 AD-1 — same trust-boundary posture.

**Alternatives considered.**

- **Renderer-owned finalize with main-side audit emission.**
  Rejected: renderer cannot hold the ESC/POS adapter, cannot hold
  the receipt template asset securely, cannot hold the drawer kick.
  Any alternative also requires main-side persistence, main-side
  audit emission, main-side template engine, main-side print
  pipeline, and main-side drawer command. Dual ownership is worse
  than single ownership.
- **Shared-worker thread owns finalize.** Rejected: adds a third
  process boundary with no security benefit. Constitution §III's
  posture is "renderer untrusted, main trusted"; introducing a
  worker confuses the model.

**Resolves:** AD-1.

---

## R-2 — 006 → 008 signal: periodic scan worker on `audit_events` *(revised twice; v3 LOCKED 2026-05-27 post-CodeRabbit CR1)*

> **Revision history.**
>
> - **v1 (2026-05-27 morning):** in-process EventEmitter from 006.
>   **REJECTED post-external-review R1** — 006 does not publish
>   such an event; would require amending a SPEC COMPLETE feature.
> - **v2 (2026-05-27 mid-day):** better-sqlite3 `update_hook`
>   callback. **REJECTED post-CodeRabbit CR1** — empirically
>   verified that `better-sqlite3 ^12.9.0` does not expose
>   `update_hook` in its public API. The method exists in upstream
>   PR #1337 but is not in any released version. The "fix"
>   introduced a second imaginary dependency.
> - **v3 (this revision):** periodic scan worker. Uses only APIs
>   that empirically exist in the installed dependency. No
>   transaction-boundary subtlety. No new migration. The scan IS
>   the primary mechanism — there is no separate primary-vs-fallback
>   distinction.

**Decision.** 008's main-process listener runs a **periodic scan worker** at startup. The worker wakes every **200 ms** (configurable; floor 100 ms, ceiling 1000 ms) and runs an indexed `SELECT` against `audit_events` filtering for `category='payment.settled' AND NOT EXISTS (sales row for this handoff_action_id)`. For each match, dispatch AD-2 finalize. The `NOT EXISTS` clause IS the idempotency anchor — Constitution §P5 by construction.

**Rationale.**

1. **006 does not publish an in-process event.** Grepping 006's plan, research, contracts, data-model, and tasks confirmed 006's only EventEmitter is the renderer-facing `payments.subscribe` channel (006 T136). 006's commitment to `payment.settled` is **the audit-events row write** (006 AD-9 payload), not a runtime event. 008's mechanism must therefore depend on the row write, which is durable.

2. **`update_hook` does not exist in the installed better-sqlite3.** Empirical verification (2026-05-27):
   ```
   > const D=require('better-sqlite3'); const db=new D(':memory:');
   > typeof db.updateHook
   'undefined'
   > typeof db.function
   'function'
   > require('better-sqlite3/package.json').version
   '12.9.0'
   ```
   The method was proposed in WiseLibs/better-sqlite3#1337 (open as of 2025) but is not in any released version. Picking it for AD-2 v2 was an unverified bet. **Lesson:** when a mechanism depends on a specific dependency API, run a 10-second `typeof` check before committing it to the spec.

3. **Polling beats the trigger-callback alternative on the trade-off ledger** (see "Alternatives considered" below for the full comparison).

4. **The scan IS the recovery mechanism.** v1 and v2 distinguished "primary path" from "startup recovery scan." v3 collapses them: the scan runs continuously, and process restart is just "the scan starts fresh." This is structurally simpler — fewer states for the implementer, fewer test paths, no startup-order race.

5. **Idempotency.** The `NOT EXISTS (sales row...)` filter is the load-bearing guarantee. A row that's already been finalized is filtered out of the scan; even on rare double-fire (e.g., two ticks of the scan running concurrently), the second tick sees the Sale row from the first and the audit-event row drops out of the result set.

**Alternatives considered.**

| Alternative | Status | Reason |
|:--|:--|:--|
| In-process EventEmitter from 006 (v1 choice) | **REJECTED** | 006 does not publish such an event; would require amending a SPEC COMPLETE feature, violating Constitution P12/P13. |
| `update_hook` callback (v2 choice) | **REJECTED** | Not in better-sqlite3 ^12.9.0's public API (empirical verification). Proposed upstream as PR #1337 but not released. |
| **Periodic scan worker (v3, this revision)** | **LOCKED** | Uses only APIs that empirically exist. See full ledger below. |
| `AFTER INSERT` SQLite trigger + `db.function`-registered callback | **REJECTED** (v3 runner-up) | The trigger fires **inside 006's transaction** (pre-commit). The callback must enqueue-only; the worker must re-query `audit_events` to confirm 006 actually committed (because a roll-back would invalidate the trigger fire). This is functionally identical to the polling scan but with three additional failure modes: (a) pre-commit fire on rolled-back transaction; (b) better-sqlite3's "same-connection only" trigger caveat (fine for POS-Pulse but adds documentation burden); (c) trigger creation needs its own §A3 migration row. Polling has none of these. |
| Cross-process file-watcher on the audit table | **REJECTED** | Introduces a second source of truth (file mtime vs SQLite row); risks silent dropped notifications. |
| HTTP callback from 006 to 008 (same process) | **REJECTED** | Ceremony without benefit; same Node runtime, function-call equivalent. |
| Tightly couple 008's finalize into 006's settled SQLite transaction | **REJECTED** | Would break 006's ability to ship without 008; violates Constitution P13. |

### Full trade-off ledger (v3 polling vs v3-runner-up triggers)

| Concern | Polling (v3) | Trigger + db.function (v3 runner-up) |
|:--|:--|:--|
| API exists in `better-sqlite3 ^12.9.0` | ✅ `db.prepare`/`db.exec` | ✅ `db.function` + standard `CREATE TRIGGER` |
| Transaction-boundary correctness | ✅ Sees only committed rows | ⚠ Trigger fires pre-commit; callback must enqueue-only; worker must re-query |
| NFR-006 latency budget (3 s) | ✅ 200 ms × 1 poll = 6.6 % of budget | ✅ Effectively instant |
| CPU cost on idle terminal | ~0.5 % CPU per poll × 5 polls/s = ~2.5 % CPU. Sub-millisecond query against an indexed table. | ~0 % when idle (no writes) |
| Crash safety | ✅ Restart → next tick picks up unfinalized rows | ✅ Same (the worker re-query is the recovery path) |
| New migration row required | ❌ No | ⚠ Yes — `CREATE TRIGGER` migration |
| Same-connection caveat needs documentation | ❌ No | ⚠ Yes — better-sqlite3 trigger limitation: trigger fires only for writes via the same connection. (For POS-Pulse this is satisfied because 006 and 008 share the main-process Database handle — but it must be stated.) |
| Test setup complexity | ✅ Stub the clock, INSERT row, assert next tick dispatches | ⚠ Mock trigger fire semantics OR use a real SQLite file with synchronous trigger evaluation |
| Failure modes | 1: scan throws on DB error | 3: (a) trigger fires on rolled-back txn; (b) same-connection caveat; (c) trigger migration introduces schema change in Slice 1's §A3 |

**Polling wins on five dimensions (transaction correctness, migration footprint, documentation burden, test simplicity, failure-mode count) and ties on the other four (API existence, latency budget, crash safety, idle CPU).** The CPU difference (~2.5 % vs ~0 %) is the polling cost but is invisible on a pharmacy-counter workstation. The five-dimension win pays for it.

**Implementation note (Slice 1).** The 200 ms default is the starting value; T520a will measure actual end-to-end latency on the §A3 hardware-matrix printer and confirm or adjust the default before §A5 sign-off.

**Constitution §P5 alignment.** Polling is sometimes characterised as "less elegant than event-driven." For POS-Pulse, the idempotency guarantee (the `NOT EXISTS` clause in the SQL) is the load-bearing correctness property. Event-driven mechanisms that rely on at-most-once delivery semantics from a runtime channel would require a separate idempotency layer anyway — polling collapses these into one mechanism that does both.

**Alternatives considered (continued — earlier ones retained):**

- **In-process EventEmitter from 006** (v1) — see ledger above; rejected.
- **`update_hook`** (v2) — see ledger above; rejected.
- **Cross-process file-watcher on the audit table.** Rejected:
  introduces a second source of truth (the file mtime vs the SQLite
  row); risks "we wrote the audit row but the watcher didn't fire"
  silently; complicates startup-recovery semantics.
- **HTTP callback from 006 to 008 (despite both being in the same
  process).** Rejected: ceremony without benefit; same main-process
  Node runtime, so a function call is enough.
- **Tightly couple 008's finalize into 006's settled transaction
  (single SQLite transaction across both features).** Rejected:
  would break 006's ability to ship without 008 having shipped;
  would violate Constitution P13 (small scoped PRs) by forcing
  bidirectional commits across feature boundaries. The "008 reacts
  to 006's already-committed event" pattern keeps the features
  decoupled.

**Resolves:** AD-2.

---

## R-3 — Append-only Sale row at the *physical* layer

**Decision.** `sales`, `print_events`, `drawer_events`, and
`sale_sync_outbox` are physical-layer append-only via SQLite
triggers that deny UPDATE and DELETE. The trigger is stronger than
spec FR-004's "append-only at the rule level".

**Rationale.**

1. Constitution §P4 — non-destructive financial correction is the
   strongest auditability rule in the constitution. Refunds (future
   feature) MUST append new event types, not mutate the Sale.
2. Eight slices' worth of code paths touch the Sale row reads. Any
   future feature could accidentally introduce an UPDATE statement;
   a physical-layer trigger prevents the rule from drifting at the
   code layer.
3. The "no mutable column" design (no `last_printed_at` on `sales`,
   no `reprint_count` on `sales`) forces every state to be a new
   row in a sub-table, which makes the audit projection trivial:
   "what's this sale's print state?" = `SELECT … FROM print_events
   WHERE sale_id = … ORDER BY printed_at DESC LIMIT 1`.
4. The same trigger pattern is used by 006's `payment_action_outbox`
   and 004's `audit_events`; 008 inherits the convention.

**Alternatives considered.**

- **Append-only only at the rule layer (FR-004 as-written).**
  Rejected: rules drift. A physical-layer trigger costs ~10
  lines of SQL and provides defence-in-depth against future code
  paths.
- **Soft-delete columns (`deleted_at`).** Rejected outright:
  Constitution §P4 explicitly says "Mutating or deleting a prior
  financial record MUST NOT be used as a correction mechanism."
- **Single mutable Sale row with derived projections.**
  Rejected: the "current print state" projection becomes a
  function of multiple mutable columns, which forces every reader
  to know the projection rules. Append-only sub-tables make the
  rules visible in the schema.

**Resolves:** AD-3.

---

## R-4 — Three sub-entity tables: PrintEvent, DrawerEvent, SaleSyncOutbox

**Decision.** Three append-only sub-entities, one for each
independent audit anchor on a sale. Not a single polymorphic
`sale_events` table.

**Rationale.**

1. Each sub-entity has a different consumer:
   - `print_events` is consumed by the print pipeline (retry logic,
     reprint-counter projection).
   - `drawer_events` is consumed by the drawer-kick gating logic
     (FR-053 double-kick suppression).
   - `sale_sync_outbox` is consumed by the *future* sync engine.
2. Each sub-entity has a different cardinality:
   - `print_events`: many per sale (first print + retries +
     reprints + manual-override).
   - `drawer_events`: at most one per sale (FR-040).
   - `sale_sync_outbox`: exactly one per sale (FR-060).
3. Each sub-entity has a different schema (the payload fields differ
   materially — `print_events` carries `render_path` and
   `duplicate_copy_sequence_number`; `drawer_events` carries
   `last_successful_open_at_for_terminal`; `sale_sync_outbox`
   carries `enqueued_at` and `state`). Cramming them into one
   polymorphic table forces every read to filter by `event_type`
   and every index to compound on it.
4. Constitution Principle IV's requirement that drawer failure be
   independently surfaceable from print failure is satisfied
   structurally by two separate tables.

**Alternatives considered.**

- **One `sale_events` polymorphic table with `event_type` enum +
  generic `payload_json` BLOB.** Rejected: would require every
  reader to know the payload schema per event type; would prevent
  per-table indexes; would prevent per-table foreign-key constraints
  with future tables (e.g., refunds will reference `print_events`
  for "which receipt was refunded").
- **Print and drawer in one table; outbox separate.** Rejected:
  the cardinality argument (many vs ≤1) makes the unified table
  awkward to query; the FR-053 double-kick suppression read
  becomes "count drawer events for this sale", which is more
  natural against a dedicated table.

**Resolves:** AD-4.

---

## R-5 — Bridge namespaces: `sales.*` + `receipts.*` + `drawer.*` (no renderer surface)

**Decision.** Three bridge namespaces:

- `sales.*` — sale-level reads + subscriptions; **read-only** from
  the renderer.
- `receipts.*` — preview + print + reprint + retry + manual-override.
- `drawer.*` — **main-process only**; no renderer-callable surface.

Refusal envelope is `{ kind: 'refused', reason: '...' }` (mirrors
005 / 006).

**Rationale.**

1. **Why `sales.*` is read-only from the renderer.** The Sale row
   is only written by AD-2's in-process listener. The renderer has
   no need to invoke `sales.create` / `sales.update` — these
   handlers do not exist. Any future mutation of the Sale row
   (refunds, returns) will be a *different* feature with a
   different bridge surface (e.g., `refunds.*`).
2. **Why a separate `receipts.*` namespace and not folding it into
   `sales.*`.** The audit catalogue alignment argument (006 AD-3):
   `sales.read` → no audit event (read-only); `receipts.reprint` →
   `sale.receipt.reprinted` audit event. Folding "reprint" into
   `sales.*` would produce a `sales.reprint` handler that is
   conceptually about the receipt, not the sale.
3. **Why no renderer-callable `drawer.*` surface.** Letting the
   renderer "kick the drawer" out of band would violate FR-040's
   "only when (a)–(c) hold" rule. The drawer is a *consequence* of
   a successful print on a cash-inclusive sale, not an independent
   renderer-initiated action. The drawer command is internal to
   the print pipeline.
4. **Why the `reason` envelope, not `category`.** 006 R-2 already
   reconciled this divergence (004 uses `category`, 005 uses
   `reason`). 008 follows 005/006's `reason` for consistency
   inside the `cart.* → payments.* → sales.* → receipts.*` feature
   chain. The 004 divergence is documented and stable.

**Alternatives considered.**

- **Unified `sales.*` namespace (no `receipts.*`).** Rejected per
  the audit-catalogue alignment argument above.
- **Add a renderer-callable `drawer.kick` handler for "open
  drawer for cash refund / making change without a sale".**
  Rejected: any drawer kick outside a sale is a *sensitive action*
  under Constitution P10 (cash-drawer kicks outside a sale are
  explicitly listed). That belongs to a future shift-management
  spec, not 008.
- **Use `category` instead of `reason` to align with 004.**
  Rejected: 005 and 006 set the precedent for the `cart.* →
  payments.*` chain; 008 is the third step in that chain and the
  closer structural neighbour wins (same argument as 006 R-2).

**Resolves:** AD-5.

---

## R-6 — Receipt template engine: single source, dual output

**Decision.** First-party template engine at
`src/main/receipts/templates/`. One bilingual template asset per
variant (`first_print`, `reprint_duplicate`, `preview`). Each
template emits two byte-stable outputs from one source: ESC/POS
byte stream + HTML/canvas.

**Rationale.**

1. **Byte-stability across paths (FR-016 / R4 mitigation).** The
   spec requires the printed slip and the preview to render byte-
   stably from the same payload — even when the ESC/POS direct
   path and the OS-print fallback path are both available. A
   single-source engine is the only correct shape; two separate
   templates (one for ESC/POS, one for HTML) would drift over time
   and produce slips that an audit cannot reconcile.
2. **Bilingual (Arabic-first RTL + Latin numerals).** Constitution
   Localization requires Arabic-first UI but Latin numerals on
   receipts. The engine handles language switching declaratively
   inside the template asset, not by inlining `if (locale === 'ar')`
   into the print pipeline.
3. **Auditability.** A first-party 200-line engine is auditable
   under Constitution P8 (security boundary review). Pulling
   Handlebars / EJS / Mustache for this use case adds a transitive
   dependency to the bridge-surface security review for no
   user-visible benefit.

**Alternatives considered.**

- **Handlebars / EJS / Mustache for HTML, hand-coded ESC/POS for
  print.** Rejected: two sources → byte-stability fails. Future
  template edits would have to be made in two places.
- **Use the legacy `_reference/Data-Pulse/` template engine.**
  Rejected: Constitution IX (Reference, Not Inheritance) — re-
  derive against current requirements.
- **Render to PDF and print the PDF on both paths.** Rejected:
  PDF rendering is heavyweight, the ESC/POS direct path supports
  raw byte streams (faster, simpler), and PDF as an intermediate
  representation makes the byte-stability check harder.
- **Use Electron's built-in webContents.printToPDF.** Rejected:
  doesn't support ESC/POS direct; would force the OS-print
  fallback path to be the only path, defeating Constitution
  Hardware §"ESC/POS direct path preferred".

**Resolves:** AD-6.

---

## R-7 — Sale-number allocator: per-terminal per-calendar-day monotonic

**Decision.** Scheme `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`. Per-
terminal, per-calendar-day monotonic sequence; calendar day
anchored on the terminal's local timezone. Allocated by a tiny
`sale_number_sequences` table with composite primary key
`(terminal_id, calendar_day_local)`.

**Rationale.**

1. **Cashier-quotability.** SC-001 and `docs/product.md`'s product-
   purpose statement both put cashier-quotability above marginal
   robustness gains. A scheme like `T03-2026-05-27-000147` reads
   naturally over the phone; a ULID does not.
2. **Why calendar day, not shift-open.** The `/speckit-clarify`
   session deferred the reset boundary to the plan. Shifts do not
   ship in 008. Tying the reset to a future shift-management
   feature would create an undefined dependency. Calendar day is
   self-contained, matches the receipt's date stamp, and survives
   the eventual shift-management feature shipping (a shift can
   span midnight; the sale-number sequence rolls regardless,
   matching the legacy POS).
3. **Why `terminal_label`, not `terminal_id`.** The label is the
   human-friendly name from 002 pairing; the id is a UUID. Cashier
   quotability requires the label.
4. **Why a separate `sale_number_sequences` table.** A composite
   primary key on `(terminal_id, calendar_day_local)` plus
   transaction-level isolation gives collision-impossibility under
   concurrent finalizes. Using `SELECT MAX(sequence) + 1` on the
   `sales` table would race; a dedicated allocator table with
   UPSERT-and-increment inside the same atomic finalize
   transaction does not.
5. **Defence-in-depth.** 006's per-terminal partial unique index
   on `payment_attempts` already prevents two concurrent attempts
   on the same terminal from being `started` at once. 008's
   allocator is an additional belt-and-braces guarantee against
   accidental duplicate finalize.

**Alternatives considered.**

- **Per-terminal monotonic without date prefix (e.g., `T03-1234567`).**
  Rejected: lifetime sequence numbers grow forever; the cashier
  cannot easily say "the receipt from this morning" without a
  date.
- **ULID / KSUID / UUID v7 / Snowflake.** Rejected per
  cashier-quotability (Q3 clarification).
- **Date-only prefix without terminal label (e.g.,
  `2026-05-27-000147`).** Rejected: collisions possible across
  terminals in a multi-terminal branch.
- **Shift-open reset boundary.** Rejected per the "shifts don't
  ship in 008" argument above.
- **`SELECT COALESCE(MAX(NNNNNN), 0) + 1 FROM sales WHERE …`
  inside the finalize transaction instead of a dedicated
  sequences table.** Rejected: full-table scan on every finalize,
  even with an index; the dedicated allocator table is O(1) with
  a primary key lookup.

**Resolves:** AD-7.

---

## R-8 — Drawer-kick: separate ESC/POS pulse after print-ack

**Decision.** Drawer kick is a separate ESC/POS DK1/DK2 pulse
written to the printer **after** print-success acknowledgement.
Embedded-in-receipt kick is PROHIBITED in 008 v1.

**Rationale.**

1. **Audit separability (Constitution Principle IV).** A separate
   write produces a distinct status byte from the printer, which
   becomes the source for `sale.drawer.opened` /
   `sale.drawer.failed` audit events. Embedded kicks defeat that
   separation — the receipt-print success byte and the drawer
   success byte collapse into one signal, leaving no way to
   distinguish "receipt printed, drawer failed" from "receipt
   printed, drawer opened" in audit.
2. **FR-043 / FR-053 alignment.** FR-043's manual-override banner
   on drawer failure can only fire if the drawer failure is
   observable; FR-053's double-kick suppression requires the
   drawer-kick history to be queryable. Embedded kicks make both
   impossible without ESC/POS-stream byte-level analysis, which
   is fragile.
3. **Latency budget.** A separate write adds ~100 ms (one
   round-trip to the printer + status poll). NFR-006's 3-second
   sale-to-drawer-open window has ample headroom.
4. **Clarifications 2026-05-27 lock.** Q2 explicitly chose Option A.

**Alternatives considered.**

- **Embed DK1/DK2 in the receipt byte stream.** Rejected per
  audit-separability argument. (This is the POS-vendor convention,
  not the constitution's posture.)
- **Mode-per-printer (terminal config flag).** Rejected: doubles
  the test matrix; defers the audit-semantics question per device,
  which is the opposite of what Principle IV requires.
- **Kick the drawer *before* the print (some legacy POS systems
  do this).** Rejected: the cashier could hand over change before
  the receipt printed, then the print could fail — the audit
  shows drawer-opened-without-receipt, which violates Constitution
  P2 (no fake success).

**Resolves:** AD-8.

---

## R-9 — Audit-event catalogue: ten new categories under 004's `audit_events`

**Decision.** Ten new categories under 004's existing `audit_events`
table:

- `sale.finalized`
- `sale.finalization_refused`
- `sale.receipt.printed`
- `sale.receipt.reprinted`
- `sale.receipt.print_failed`
- `sale.receipt.print_retried_success`
- `sale.receipt.manual_override`
- `sale.drawer.opened`
- `sale.drawer.suppressed`
- `sale.drawer.failed`

**Rationale.**

1. **No new audit table.** 004's `audit_events` is the audit sink
   (006 R-2 / 006 AD-2 precedent). 008 extends the catalogue, not
   the schema.
2. **Granularity per FR-055.** Every state transition emits
   exactly one canonical event. The catalogue is documented in
   one place (the spec FR-055 + this AD); reviewers do not have
   to grep code to know the event surface.
3. **Per-state-machine-event coverage.** Each spec acceptance
   scenario maps to at least one audit event in the catalogue.
4. **Redaction surface.** AD-9 in `plan.md` enumerates the
   redaction rules for each field that might leak; the catalogue
   is the input to that redaction table.

**Alternatives considered.**

- **Fewer events (collapse `print_failed` and
  `print_retried_success` into one).** Rejected: the spec
  distinguishes them for a reason (the retry-success-treated-as-
  first-print rule in FR-052); the audit log MUST reflect that
  distinction.
- **More events (a per-line `sale.tender.cash`,
  `sale.tender.voucher` per finalized sale).** Rejected: the
  tender breakdown is already in the `sale.finalized` payload
  (per 006 plan AD-9); duplicating it as per-line events bloats
  the catalogue.
- **A separate `sale_audit_events` table.** Rejected: 004's
  catalogue is the audit sink convention; the cost of an
  additional table is real (support-bundle export logic doubles).

**Resolves:** AD-9.

---

## R-10 — Reprint permission: cashier-permitted with bilingual marker mitigation

**Decision.** Reprint is cashier-permitted with full attribution;
no supervisor override required. The bilingual duplicate-copy
marker (FR-029) is the load-bearing mitigation against fraud.

**Rationale.**

1. **006 FR-020 precedent.** Cancel a payment is cashier-permitted
   in 006; the audit log is sufficient accountability for that
   action. Reprint is structurally similar: it doesn't mutate the
   underlying record (AD-3 forbids that anyway), and the audit log
   captures who reprinted what.
2. **Everyday use case.** A customer returning the next day to
   ask for a copy of yesterday's receipt is a routine pharmacy
   interaction. Forcing a supervisor override would block the
   cashier multiple times per day.
3. **Mitigation rests on FR-029.** The bilingual duplicate-copy
   marker is the visible deterrent: a cashier cannot pass a
   duplicate slip to a customer as a fresh purchase because the
   slip says "DUPLICATE COPY / نسخة طبق الأصل" in bold at the top.
   Slice 5's manual review at counter distance is the gate.
4. **Future fraud-control extension.** If reprint abuse becomes a
   material risk pattern (a cashier flagged with anomalous
   reprint frequency), a *separate* fraud-control feature can
   add a threshold alert or an optional supervisor override —
   neither belongs in 008.
5. **Clarifications 2026-05-27 lock.** Q4 (which was surfaced by
   the coverage scan during /speckit-clarify) explicitly chose
   Option A.

**Alternatives considered.**

- **Manager-/admin-only via dedicated incident-response surface
  (mirrors 006 FR-021's force-fail pattern).** Rejected:
  reprint is not an incident-response action; it's a routine
  customer-service action. Heavy gating would push the daily-
  reprint case onto a manager who isn't always present.
- **Tiered: same-shift reprint by cashier; cross-shift / cross-
  day reprint requires supervisor.** Rejected: doubles the
  test matrix; introduces a "shift boundary" concept 008 doesn't
  yet have (shifts don't ship in 008); the fraud-risk threshold
  this protects against isn't established by data.
- **Cashier-permitted but with a per-shift reprint-count cap.**
  Rejected: arbitrary limit, would punish legitimate
  customer-service cases (busy day, lots of "lost the receipt"
  requests).

**Resolves:** AD-10.

---

## R-11 — Sync-handoff outbox: enqueue-only, no flush

**Decision.** Single row inserted into `sale_sync_outbox` inside
the AD-2 atomic finalize transaction. 008 never flushes, retries,
conflict-resolves, calls any backend, or marks rows as sent. The
state column exists (set to `pending` at insert) so the future
sync engine ships an additive migration rather than rewriting
the table.

**Rationale.**

1. **Constitution P18 satisfaction.** "Local durability before
   offline promises" — 008 provides the first **real** durable
   state any future offline-sync promise will rest on. Spec
   FR-060 / FR-061 codify "enqueue only, no flush"; this AD locks
   the data shape.
2. **Future-additive migration.** Adding a state column day-one
   means the future sync engine ships an `ALTER TABLE` (adding
   indexes or columns), not a `CREATE TABLE … SELECT FROM …`
   rewrite. The state column is the projection point.
3. **Atomicity with Sale commit.** The outbox row + Sale row +
   audit row are written in one SQLite transaction (AD-2). If any
   of the three fails, none commits, so the outbox cannot drift
   from the Sale.
4. **Minimum reference fields.** The future sync engine needs only
   `sale_id` + `handoff_action_id` + tenant / branch / terminal
   scoping. It does NOT need the receipt payload (regenerable
   from the Sale row), the tender breakdown (in the audit
   payload), or the print history (in `print_events`). Keeping
   the outbox skinny minimises the table's tenancy / GDPR
   surface.
5. **No retention policy in 008.** The future sync engine owns
   retention. ~365 k rows/year per terminal is inside SQLite
   comfort; no hard cap.

**Alternatives considered.**

- **No outbox at all; the future sync engine reads `sales`
  directly.** Rejected: would force the sync engine to maintain
  its own "what have I sent" cursor against the `sales` table
  primary key. The outbox row is the cleaner contract.
- **Flush from 008 to a hypothetical future backend endpoint
  behind a feature flag.** Rejected outright: 008 makes zero
  backend calls (AD-12). Adding a flag would expand the network
  surface under a feature that hasn't shipped, violating
  Constitution Platform Integration §"only path to the backend
  is the typed API client".
- **Outbox rows with full payload (the entire `sale.finalized`
  audit payload).** Rejected: redundancy with the audit table.
  The future sync engine reads both anyway; the outbox is the
  *pointer*, the audit row is the *content*.

**Resolves:** AD-11.

---

## R-12 — OpenAPI / backend impact: zero

**Decision.** No new OpenAPI surface. 008 makes zero backend calls.
§A2 records a no-op for every 008 slice (S0–S6).

**Rationale.**

1. **Spec dependencies.** Spec Dependencies §"Backend
   `api.smartdatapulse.tech`" explicitly says "Not a dependency of
   008. 008 makes zero backend calls."
2. **Constitution Principle I.** Offline-first. The sale MUST
   complete with zero connectivity. Introducing a backend call —
   even an optional one — creates pressure to retry / queue /
   handle-failure that 008's enqueue-only outbox already covers.
3. **Future sync engine ownership.** The backend surface for the
   sync engine is the *next* feature's design problem, not 008's.
   Defining endpoints here would either constrain the future
   spec or be wrong by the time it ships.

**Alternatives considered.**

- **Optional backend ping on finalize ("phone home", behind a
  feature flag).** Rejected: violates Principle I; no product
  benefit at this stage; expands the feature flag surface and the
  network surface.
- **Reserve OpenAPI endpoint paths now (e.g., `POST /sales`).**
  Rejected: speculative; the future sync engine's contract is
  not 008's to define.

**Resolves:** AD-12.

---

## R-13 — `external_reference` on the printed slip — when?

**Decision.** The receipt template MAY include the optional
`external_reference` field (from 006's `external_card_terminal`
TenderLine) on the printed slip **only when** 006 OQ-PLAN-5
resolves permissively (i.e. the field exists and is approved for
the receipt surface). Until OQ-PLAN-5 resolves, the field is
absent from 008's receipt template.

**Rationale.**

1. **006 OQ-PLAN-5 is the upstream gate.** 006 has not finalized
   whether `external_reference` is even captured at all in 006 v1
   (it's an OQ-PLAN-5 carry-forward). 008 cannot decide on the
   receipt-presence question before 006 decides on the
   capture-presence question.
2. **Format-constraint inheritance.** If 006 OQ-PLAN-5 resolves
   permissively, the field is `^[A-Z0-9]{0,6}$` (per 006 FR-009).
   That's six alphanumeric chars — cannot encode a PAN by
   construction.
3. **Redaction discipline.** Even if printed on the slip, the
   field MUST remain `*****`-redacted in every log sink
   (Constitution §P7; 006 FR-009 inheritance). Slice 6 redaction
   audit covers this.

**Alternatives considered.**

- **Include `external_reference` on the slip unconditionally.**
  Rejected: would commit to 006 OQ-PLAN-5 in 008's favour without
  6's actual decision.
- **Exclude `external_reference` from the slip unconditionally.**
  Rejected: cashier reconciliation use case (the field exists
  precisely to help end-of-day reconciliation) — printing it on
  the slip is the natural reconciliation aid.

**Resolves:** plan-level open carry-forward from 006.

---

## R-14 — Receipt fields the cashier sees vs the customer sees

**Decision.** Both the preview UI (cashier-facing) and the printed
slip (customer-facing) carry **the same payload**, because FR-016
requires byte-stability. The customer slip MAY use a smaller font
or a tighter line-height for paper-saving, but the *content* is
identical.

**Rationale.**

1. **FR-016 byte-stability.** A reprint MUST equal the original
   except for the duplicate-copy marker and the reprint-time
   field. If preview and print differed in content, the byte-
   stability rule would have a carve-out, which would be a
   slippery slope.
2. **No "cashier-only" fields.** There is no field the cashier
   should see but the customer should not. Operator attribution
   is on both (FR-013); sale number is on both (FR-010); tender
   breakdown is on both (FR-017).
3. **Layout differences are template-engine concerns.** The
   `preview` template variant MAY have different padding, font
   weights, or column widths from the `first_print` variant; the
   *data fields* are identical.

**Alternatives considered.**

- **Show the operator session id on preview but not on print.**
  Rejected: there is no consumer for "show the cashier their
  session id"; the cashier sees their own name on the badge.
- **Show the `voucher_authority_redemption_id` only on the slip
  (for reconciliation) but not on preview.** Rejected: byte-
  stability rule + the field is non-sensitive (006 FR-017).

**Resolves:** clarification of FR-015 / FR-016 / FR-017 boundary.

---

## R-15 — Process-restart recovery: what's the listener's startup contract? *(revised twice; v3 LOCKED 2026-05-27 post-CodeRabbit CR1)*

> **Revision note.** v1 and v2 distinguished "startup recovery scan" from "primary live mechanism." v3 collapses them — the scan IS the primary mechanism per AD-2 v3 — so this entry is now mostly about the **adjacent** print/drawer recovery sub-scans, not about the audit-events scan (which is just "the worker starts ticking").

**Decision.** On main-process startup, the 008 finalize listener (AD-2 v3) runs:

1. **The periodic audit-events scan** starts on its 200 ms interval (AD-2 v3 worker). This handles every `payment.settled` row — including those committed while 008 was offline (process crash, OS reboot, app upgrade). No special "startup recovery" branch is needed; the first tick of the worker sees them, the second tick sees the ones it didn't drain on the first tick, and so on. The `LIMIT 32` per tick is the bounded-throughput safety bound (AD-2 v3 implementation note).

2. **Two adjacent print/drawer recovery sub-scans** run **once at startup** (not periodically — these are bounded one-shot recovery scans):
   - **Print recovery:** scan the `sales` table for any sale whose `print_events` table has no `outcome='success'` row AND no `outcome='manual_override'` row. These are "finalized but never printed" sales (e.g., process crashed between finalize commit and print pipeline dispatch). Dispatch a fresh print attempt for each.
   - **Drawer recovery:** scan the `sales` table for any cash-inclusive sale (per `tender_lines_summary_json`) whose `drawer_events` table has no row. These are "finalized + printed but never kicked drawer" sales. Dispatch a fresh drawer-kick attempt for each.

Both recovery sub-scans complete in a single pass per startup; they do not re-poll. The audit-events scan in step 1 is the only continuous worker.

**Why no special-case ordering anymore?** v1 and v2 needed a "scan first, then register hook" ordering to prevent a race between the initial scan and the live hook registering. v3 has no such race — there is no separate live mechanism. The polling worker runs every 200 ms; whether a row landed 100 ms before the worker started or 100 ms after is immaterial. The worker will see it on its first tick that runs after the row committed.

**Tenant scoping.** All three scans are scoped to the currently paired terminal's `(tenant_id, branch_id, terminal_id)` triple per Constitution §P17.

**Why print/drawer recovery is one-shot, not periodic.** A finalized Sale that hasn't been printed yet is in one of two states: (a) the print pipeline crashed mid-attempt and the user is staring at a frozen UI — the next *user-initiated* `receipts.retryPrint` call will pick it up; (b) the whole process crashed and we restarted — the one-shot startup recovery catches it. There's no third "the pipeline kept running but failed silently" state because print failure already emits a `print_events` failure row, which the recovery scan's "no success AND no manual_override" filter excludes. So the recovery sub-scan only needs to run once at startup; subsequent failures route through the normal banner/retry flow.

**Rationale.**

1. **Constitution §P3 — no silent loss.** Without startup
   recovery, a process kill between 006's commit and 008's commit
   would orphan a paid sale. The recovery scan closes that
   window.
2. **Idempotent by AD-2 key.** Re-firing AD-2 on a sale that
   already has a Sale row is a no-op (Constitution §P5). So the
   recovery scan is safe to run on every startup, including the
   "happy path" startup where no recovery is needed.
3. **Bounded scan.** The scan is filtered by tenant / branch /
   terminal of the currently paired terminal; it does NOT scan
   the full audit table.
4. **No retry storm.** The print-recovery and drawer-recovery
   scans dispatch *one* fresh attempt per orphaned sale and
   then leave the printer-failure / drawer-failure banner
   surface to handle further interaction with the cashier.

**Alternatives considered.**

- **No startup recovery; live listener only.** Rejected: violates
  Constitution §P3 under the kill-mid-finalize scenario.
- **Cron-style retry loop running every minute.** Rejected:
  produces an ongoing retry storm if the printer is broken;
  banner-driven retry is the better UX.
- **Push the recovery responsibility to the future sync engine.**
  Rejected: the orphaned sale is a *local* problem (the cashier's
  customer is standing at the till with no receipt); pushing it
  to a future feature would leave the cashier stuck.

**Resolves:** Slice 1 startup-task design + spec R-3 mitigation.

---

## R-16 — Why no E2E Playwright test against a real printer?

**Decision.** Vitest + a printer-adapter test double (mocking the
ESC/POS write + status-poll surface) is the canonical test
strategy. Real-printer integration testing is a **manual gate**
under §A3 hardware bring-up, recorded in `docs/hardware-matrix.md`.

**Rationale.**

1. **CI hardware constraint.** The Constitution CI gate runs on
   `windows-latest` runners (Constitution CI Gates); those
   runners have no physical thermal printers.
2. **Vendor matrix scope.** 008 must work with the printers in
   Constitution Hardware MVP Matrix; the matrix lives in
   `docs/hardware-matrix.md` and is updated by humans testing
   real devices. CI cannot verify this.
3. **Test double is sufficient for the FSM.** The ESC/POS adapter
   has a small surface (write bytes, poll status); a mock that
   simulates "ok", "paper out", "jam", "drawer open success",
   "drawer kick failed" covers every transition in the print
   pipeline and the drawer-kick logic.
4. **§A3 sign-off is the gate.** A printer + drawer combination
   that has not been integration-tested by a human against a real
   device cannot be added to the matrix; the matrix is the source
   of truth for "what 008 supports".

**Alternatives considered.**

- **Self-hosted CI runner with a USB-attached thermal printer.**
  Rejected: ongoing infrastructure cost; would couple 008's
  release cadence to runner availability.
- **Stub the entire print pipeline and test only at the FSM
  layer.** Rejected: would miss the ESC/POS-byte-stability
  property tests (Slice 2's byte-stability test runs against
  the mock adapter and verifies the actual byte stream shape).

**Resolves:** test-strategy clarification.

---

## Phase 0 status

**All architectural decisions resolved.** No NEEDS CLARIFICATION
items remain in [./plan.md](./plan.md). Phase 1 design artefacts
(data-model, contracts, quickstart) follow.
