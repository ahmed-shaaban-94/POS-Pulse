# Quickstart: 008 Sale Finalization & Receipts

**Feature ID:** 008-sale-finalization-and-receipts
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-27

> Walk-through of the four canonical paths a 008 implementation
> ships once Slices 1–6 are merged: (a) cash-inclusive happy path,
> (b) reprint, (c) printer-failure, (d) drawer-failure. No code is
> authored by this file. Path names refer to plan-pinned modules
> (per `plan.md` §"Project Layout").

---

## Path A — Cash-inclusive happy path

### Trigger
A cashier signs in (004 session active), drives a cart through 005 to
checkout-handoff, picks `cash` + voucher in 006, settles the payment.
006 emits `payment.settled`.

### Sequence
1. **006 commits.** `payment_attempts.state` transitions to `settled`
   in 006's SQLite transaction; `payment_action_outbox` row written;
   `payment.settled` audit-events row written (006 plan AD-9 payload).
2. **In-process listener fires.** 008's main-process listener
   (`src/main/sales/finalize-listener.ts`, plan AD-2) receives the
   `payment.settled` event payload synchronously.
3. **Idempotency pre-check.** The listener queries `sales` for a row
   with `envelope_handoff_action_id = payload.handoff_action_id`. No
   row exists → proceed. (If a row existed → return its `sale_id`
   no-op per FR-001 / SC-009 / Constitution §P5.)
4. **Forbidden-field validation.** The listener walks
   `payload.tender_lines[]` for forbidden keys per `data-model.md`
   §"Forbidden fields". None found → proceed.
5. **Atomic finalize transaction begins** (`src/main/sales/finalize-
   transaction.ts`):
   - **Allocate sale_number.** UPSERT `sale_number_sequences` on
     `(terminal_id, terminal_local_calendar_day)`; allocator returns
     `T03-2026-05-27-000148` (per AD-7).
   - **INSERT `sales` row** with the 21 fields from `data-model.md`
     §"Entity: Sale". Note: `tender_lines_summary_json` is the
     FR-017-minimum projection, NOT the raw 006 payload.
   - **INSERT `sale_sync_outbox` row** with `state='pending'`.
   - **Emit `sale.finalized` audit event** into 004's `audit_events`
     table.
   - **Commit.** All four rows are now durable atomically. The
     cashier's screen has not yet been updated.
6. **Subscribers fire.** `sales.subscribe(topic='recent')` listeners
   (the renderer's "most recent sale" UI) receive the compact sale
   summary.
7. **Print pipeline dispatches** (`src/main/receipts/print-
   pipeline.ts`, Slice 3):
   - **Read the persisted Sale.** Receipt-payload generator
     (`src/main/receipts/receipts-payload.ts`) reads the `sales` row
     by `sale_id` and produces the canonical receipt payload per
     FR-017.
   - **Render.** AD-6 template engine reads `first-
     print.bilingual.template` and produces two byte-stable outputs:
     ESC/POS byte stream + HTML/canvas.
   - **Path-select.** Connected printer supports ESC/POS direct →
     dispatch via the ESC/POS adapter; otherwise fall back to
     `webContents.print`.
   - **Wait for ack.** Synchronous status-poll on ESC/POS adapter;
     `success` status byte returned.
   - **INSERT `print_events`** with
     `(purpose='first_print', outcome='success', render_path='escpos_direct')`.
   - **Emit `sale.receipt.printed` audit event.**
8. **Drawer-kick gating** (`src/main/drawer/drawer-kick.ts`, Slice 4):
   - **Gate (a):** Sale durably committed? ✅
   - **Gate (b):** Print success ack received? ✅
   - **Gate (c):** Tender mix includes ≥ 1 applied `cash` line?
     `tender_lines_summary_json` scan finds one → ✅
   - **Suppression check:** Any prior `drawer_events` row for this
     sale? No → proceed.
   - **Send DK1 pulse.** Separate ESC/POS write per AD-8 (NOT
     embedded in receipt stream).
   - **Wait for ack.** Printer returns drawer-open success byte.
   - **INSERT `drawer_events`** with `(outcome='opened',
     triggering_print_event_id=<id from step 7>)`.
   - **Emit `sale.drawer.opened` audit event.**
9. **Cashier-visible state update.** `sales.subscribe(topic='banner_
   state')` emits no banner; the cashier sees the receipt slide out
   of the printer, hears the drawer pop open, and sees `T03-2026-05-
   27-000148` on their screen.

### Audit trail at end-of-path
For this single sale, six rows are now in 004's `audit_events`
(plus 006's pre-existing `payment.settled`):

| Source | Category |
|:--|:--|
| 006 | `payment.settled` |
| 008 | `sale.finalized` |
| 008 | `sale.receipt.printed` |
| 008 | `sale.drawer.opened` |

Plus four database rows: one in `sales`, one in `print_events`, one
in `drawer_events`, one in `sale_sync_outbox`.

### Elapsed time
Target NFR-006: under 3 seconds from `payment.settled` to
drawer-open ack. The atomic finalize is ~5–10 ms; render is
~50 ms; ESC/POS write + ack is ~200–500 ms; separate DK pulse +
ack adds ~50–200 ms. Plenty of headroom inside the budget.

---

## Path B — Reprint

### Trigger
Customer returns the next day, asks for another copy of receipt
`T03-2026-05-27-000148`. The cashier currently signed in is NOT
the original selling cashier (it's a different shift).

### Sequence
1. **Cashier types the sale number** into the "find sale" UI.
2. **`sales.findByNumber({ sale_number: 'T03-2026-05-27-000148' })`**
   resolves the sale (tenant-isolated per the contract). Returns a
   `sales.read`-shaped payload.
3. **Reprint affordance visible.** The renderer's
   `ReprintAffordance.tsx` component observes that
   `latest_print_event.outcome === 'success'` and renders the
   "Reprint" button.
4. **Cashier presses Reprint.** Renderer generates a fresh
   `idempotency_key` UUID v4 and calls
   `receipts.reprint({ sale_id, idempotency_key })`.
5. **Bridge gate** (`requireOperatorSession`): cashier is signed in →
   ✅. Tenant matches → ✅. Sale exists → ✅. Idempotency-key
   lookup in `print_events` shows no prior reprint with this key
   → proceed.
6. **Reprint precondition check.** Query `print_events` for any row
   with `(purpose IN ('first_print','retry_after_failure') AND
   outcome='success')` for this `sale_id`. Found the Slice 3 row
   from Path A → proceed.
7. **Compute `duplicate_copy_sequence_number`.** Query
   `SELECT COUNT(*) FROM print_events WHERE sale_id=? AND
   purpose='reprint' AND outcome='success'`. Result: 0 → this
   reprint is sequence number 1.
8. **Render.** AD-6 template engine reads
   `reprint-duplicate.bilingual.template` (different variant from
   Path A). The bilingual "نسخة طبق الأصل — DUPLICATE COPY" marker
   is rendered prominently in the header band (per FR-029).
9. **Path-select + write + ack.** Same as Path A step 7's last three
   bullets, but the template variant differs.
10. **INSERT `print_events`** with
    `(purpose='reprint', outcome='success',
    duplicate_copy_sequence_number=1,
    acting_operator_id=<current signed-in cashier>)`. Note: the
    `acting_operator_id` is the **reprinting** operator (FR-024 /
    AD-10), NOT the Sale's original `selling_operator_id`.
11. **Emit `sale.receipt.reprinted` audit event** with both
    attributions: the selling operator (from the Sale row payload)
    AND the reprinting operator (the current session).
12. **Drawer-kick gating** *(revised 2026-05-27 post-external-review R2)***.**
    Triggering PrintEvent has `purpose='reprint'` → drawer kick is
    suppressed per FR-030. **No fresh `drawer_events` row is
    INSERTed** — Path A's first-print DrawerEvent is the only
    DrawerEvent this sale will ever have (the `UNIQUE (sale_id)`
    constraint is the load-bearing schema-layer guard; the
    reprint-flow application code does not attempt the INSERT in
    the first place). The audit trail for "reprint considered
    drawer-kick" is captured by the `sale.receipt.reprinted`
    audit event combined with the absence of a second DrawerEvent
    row for this sale.
13. **Cashier-visible state update.** The reprinted slip slides
    out, the bilingual duplicate-copy marker is visible at the
    top, the drawer does NOT open.

### Audit trail addition (relative to Path A's six rows)
| Source | Category |
|:--|:--|
| 008 | `sale.receipt.reprinted` |

Plus one new `print_events` row. No new `drawer_events` row, no new
`sale_sync_outbox` row, no mutation to `sales` (AD-3 enforces this
at the trigger layer — even an accidental UPDATE would be rejected).

### Visual review check
The Slice 5 manual review at counter distance: take the printed
slip, stand at the customer-side of the counter (~1.5 metres),
glance for ~2 seconds. The bilingual duplicate-copy marker must be
obvious — both languages visible, bold, top-of-slip placement.
A reviewer who has to squint or read carefully → marker is too
subtle, fails the review, blocks Slice 5 merge.

---

## Path C — Printer failure

### Trigger
At Path A step 7, the ESC/POS write returns a `printer_offline`
status byte (the cashier had unplugged the printer's USB cable
during the day for cleaning). The Sale row from steps 1–5 is
durably committed.

### Sequence
1. **Print attempt fails.** The ESC/POS adapter returns an error
   status. The print pipeline catches it.
2. **INSERT `print_events`** with
   `(purpose='first_print', outcome='failure',
   failure_reason='printer_offline')`.
3. **Emit `sale.receipt.print_failed` audit event.**
4. **`sales.subscribe(topic='banner_state')` emits** "printer-
   failure-banner" state.
5. **Renderer surfaces `PrinterFailureBanner.tsx`** with three
   affordances:
   - **Retry print** → calls `receipts.retryPrint`.
   - **Reprint** → calls `receipts.reprint` (but this will refuse
     with `reason='not_yet_printed'` because no successful print
     has occurred yet — the banner UI grays this option out until
     a success exists).
   - **Manual receipt override** → calls
     `receipts.manualOverride`.
   The banner is non-modal, does not block the cashier's other UI,
   and **does not auto-dismiss** (NFR-002, Constitution
   Principle IV).
6. **Drawer-kick suppression.** Print failed → gate (b) in
   FR-040 fails → drawer NOT kicked. But there's NO `drawer_events`
   INSERT here either, because the drawer was never *evaluated*
   for opening (the print pipeline aborted at step 1). The audit
   trail for "no drawer happened because print failed" is the
   absence of any drawer audit event combined with the presence
   of `sale.receipt.print_failed`.
7. **Cashier plugs the printer back in.** Hits "Retry print".
8. **`receipts.retryPrint({ sale_id, idempotency_key: <new UUID> })`**:
   - Bridge gate ✅. Forbidden-field check ✅.
   - Print pipeline re-runs: render → write → ack. **Success**
     this time.
   - **INSERT `print_events`** with
     `(purpose='retry_after_failure', outcome='success',
     render_path='escpos_direct',
     previous_failed_print_event_ids=[<the failed row's id>])`.
     **No duplicate-copy marker** on this slip (FR-052: retry-
     after-failure treated as canonical first print).
   - **Emit `sale.receipt.print_retried_success` audit event.**
9. **Drawer-kick gating now re-evaluates.** Gate (a) ✅, gate (b) ✅
   (this is the **successful** print), gate (c) ✅ (cash mix).
   Suppression check: no prior `drawer_events` row for this sale
   → proceed.
10. **Send DK pulse.** Drawer opens. **INSERT `drawer_events`**
    with `(outcome='opened',
    triggering_print_event_id=<retry's id>)`. **Emit
    `sale.drawer.opened` audit event.**
11. **Banner dismisses.** `sales.subscribe(topic='banner_state')`
    emits "no banner" because the latest PrintEvent is now success.
12. **Cashier-visible state update.** Receipt slides out, drawer
    pops, banner disappears.

### Audit trail at end-of-path (relative to Path A)
The "Path A audit" sequence is replaced by:
| Source | Category |
|:--|:--|
| 006 | `payment.settled` |
| 008 | `sale.finalized` |
| 008 | `sale.receipt.print_failed` |
| 008 | `sale.receipt.print_retried_success` |
| 008 | `sale.drawer.opened` |

The `print_events` table has TWO rows for this sale (the failed
first attempt + the successful retry). The `drawer_events` table
has ONE row (the eventual open). The Sale row is unchanged from
Path A's commit (AD-3 trigger).

### Manual-override variant
If at step 5 the cashier presses **Manual receipt override** instead
of waiting for the printer fix:

1. `receipts.manualOverride` called.
2. **INSERT `print_events`** with
   `(purpose='first_print', outcome='manual_override',
   acting_operator_id=<current cashier>)`.
3. **Emit `sale.receipt.manual_override` audit event.**
4. **Banner dismisses.** The cashier writes / fills out a manual
   slip.
5. **Drawer-kick suppression continues.** No drawer kick (the
   print never succeeded). No `drawer_events` row.

**Edge case** (per spec): if later the printer is fixed and the
cashier presses Retry print, the next successful print INSERTs
with `purpose='retry_after_failure' AND outcome='success'` and the
slip has NO duplicate-copy marker (per FR-052 + spec Edge Case
"first-print after manual override"). Drawer-kick gating then
applies the cash-rule normally.

---

## Path D — Drawer-kick failure

### Trigger
At Path A step 8, the DK1 pulse write completes but the printer
returns a drawer-failure status byte (no drawer is attached, or
DK signal failed). The Sale row and the `print_events` row from
the successful first-print are durably committed.

### Sequence
1. **Drawer-kick fails.** The ESC/POS adapter returns a drawer-
   failure status.
2. **Look up `last_successful_open_at_for_terminal`.** Query
   `drawer_events` for `terminal_id` ordered by `attempted_at DESC`
   where `outcome='opened'`. Returns either the most recent
   timestamp or NULL (drawer has never opened on this terminal).
3. **INSERT `drawer_events`** with
   `(outcome='failed', failure_reason='printer_dk_failure',
   triggering_print_event_id=<first-print's id>,
   last_successful_open_at_for_terminal=<from step 2>)`.
4. **Emit `sale.drawer.failed` audit event** with the
   `last_successful_open_at` payload field (Constitution Principle
   IV requirement).
5. **`sales.subscribe(topic='banner_state')` emits** "drawer-
   failure-banner" state.
6. **Renderer surfaces `DrawerFailureBanner.tsx`** with the
   manual-override affordance ("Open drawer manually with key").
   Non-modal, no auto-dismiss, no retry-kick affordance (the unique
   index on `drawer_events` would reject a second attempt per
   FR-053; the cashier MUST manually open the till).
7. **Cashier opens the till with the physical key**, hands the
   customer their change, the customer leaves with the receipt
   (which printed fine).
8. **Cashier dismisses the banner.** Renderer-side dismissal only;
   the `drawer_events` row persists.

### Audit trail at end-of-path (relative to Path A)
| Source | Category |
|:--|:--|
| 006 | `payment.settled` |
| 008 | `sale.finalized` |
| 008 | `sale.receipt.printed` |
| 008 | `sale.drawer.failed` |

The `drawer_events` table has ONE row with `outcome='failed'` for
this sale; the unique-on-`sale_id` constraint means a future retry
attempt cannot INSERT a second row. The cashier's manual override
is captured by the audit trail's *absence* of a corresponding
`sale.drawer.opened` event for this sale; the support runbook
explains this pattern.

### Why no retry affordance on the banner?
Because the drawer kick is a per-sale event (the audit anchor is
"this sale's drawer was supposed to open"), not a per-attempt event.
If the cashier retries the kick after fixing the drawer, that retry
would either (a) violate FR-053 by emitting a second kick for the
same sale's audit trail, or (b) emit a fresh kick that has no audit
anchor at all. Constitution Principle IV's "loud, structured
failure" is satisfied by the persistent banner + the manual-
override affordance; a retry-kick affordance is the wrong primitive
here.

A future shift-management or fleet-ops feature MAY add a "test
drawer-kick" action outside the context of a sale, gated on a
supervisor override (Constitution P10). That's not 008's
problem.

---

## Path E — Process kill mid-finalize (recovery)

### Trigger
At Path A step 5, the AD-2 atomic finalize transaction COMMITs, but
between step 5 and step 6 the cashier's machine bluescreens. The
process restarts.

### Sequence
1. **Main process starts.** Listener boots (AD-2 listener
   subscribes to `payment.settled`).
2. **Startup re-scan** (`src/main/sales/finalize-listener.ts`
   startup task, per `research.md` R-15):
   - Scan `audit_events` for `category='payment.settled'` rows
     whose `handoff_action_id` has NO matching `sales` row. None
     found → step 1's finalize did commit before the crash.
   - Scan `sales` for any sale whose `print_events` table has no
     `outcome='success'` row AND no `outcome='manual_override'`
     row. **Found one — the Path A sale that crashed before its
     receipt printed.** Dispatch a fresh print attempt.
   - Scan `sales` for any cash-inclusive sale whose
     `drawer_events` table has no row. The Path A sale qualifies
     (drawer never kicked). Dispatch a fresh drawer-kick attempt
     after the print succeeds.
3. **Print + drawer dispatch.** Same as Path A steps 7–8.
4. **Cashier sees** the receipt and the drawer kick happen ~3–5
   seconds after restart. The customer (who had been waiting) gets
   their change. The audit trail looks identical to Path A's, with
   one extra row: the recovery's print event might be a
   `purpose='first_print'` (if the original print-pipeline write
   never happened) OR a `purpose='retry_after_failure'` (if it did
   happen but the ack was lost). The recovery scan is conservative:
   if any sliver of doubt exists, it dispatches as
   `retry_after_failure` so the audit trail captures the recovery
   context.

### What if the listener dies mid-recovery-scan?
The scan is idempotent. Re-running it on the next process start
re-finds the same orphaned sales and re-dispatches. Constitution
§P3 — no silent loss; the scan is bounded by tenant / branch /
terminal scope so it does not grow unbounded over time.

---

## Path F — Force-fail refusal (defensive)

### Trigger
A manager invokes 006's `payments.forceFail` on a stuck attempt
(006 FR-021). 006 transitions the attempt to `force_failed` and
emits `payment.force_failed` audit event. **006 does NOT emit
`payment.settled`**, so 008's listener never fires for this
attempt.

But suppose a future bug or test harness manages to invoke 008's
listener directly with a `force_failed` attempt's payload.

### Sequence
1. Listener receives a payload claiming
   `state='force_failed'` (or 006's `payment_attempts` row's
   `state` doesn't equal `'settled'` at the time 008 cross-checks).
2. **Refusal guard.** Plan FR-005 / FR-045 / FR-047 / data-model
   §"Forbidden fields" defensive validation refuses:
   - **INSERT `audit_events`** with category
     `sale.finalization_refused` and
     `refusal_reason='source_attempt_not_settled'` or
     `refusal_reason='force_failed_attempt'`.
   - No `sales` row created.
   - No print, no drawer, no outbox row.
3. **Sentry alert.** This is a defence-in-depth catch; the
   anomaly is logged at high severity so a future audit notices
   that something tried to finalize a non-settled attempt.

The same path catches `reversal_pending` attempts (FR-046): if
any `payment_tender_lines` row for the attempt has
`state='reversal_pending'`, finalization is refused. The 006
plan's deferred-reversal resolver pattern (006 AD-7 / R-7) is the
forward path; 008 simply refuses to finalize until 006's resolver
has cleared the pending state.

---

## Test fixtures

The Slice 1 / 2 / 3 / 4 / 5 / 6 test suites exercise the six paths
above with the following fixtures (authored under §A3 in Slice 1):

- **`cash-only-happy.fixture.json`** — 006 settled attempt with one
  applied cash line, no overpayment.
- **`cash-with-overpayment.fixture.json`** — one cash line with
  `change_due_minor > 0`.
- **`mixed-cash-voucher.fixture.json`** — split tender, cash + voucher.
- **`mixed-cash-card.fixture.json`** — split tender, cash +
  external_card_terminal.
- **`cashless-card-only.fixture.json`** — one external_card_terminal
  line, no cash → drawer suppression.
- **`cashless-voucher-only.fixture.json`** — one voucher line, no
  cash → drawer suppression.
- **`force-failed-attempt.fixture.json`** — for Path F refusal test.
- **`reversal-pending-attempt.fixture.json`** — for Path F refusal
  test (the reversal_pending branch).

The fixtures do NOT contain any sensitive field (no PAN, no voucher
code, no PIN, no JWT). They mirror the FR-070..FR-074 minimisation
contract.

---

## Manual review checklist (Slice 5 / Slice 6)

For each path, a reviewer prints the slip with a real thermal
printer (Constitution Hardware MVP Matrix) and confirms:

1. **Path A slip.** Arabic-first RTL header; Latin numerals on
   every numeric field; bilingual tax footer; sale number
   readable from across the counter.
2. **Path B slip.** Same as A PLUS the bilingual duplicate-copy
   marker is obvious at counter distance (~1.5 m glance).
3. **Path C printer-failure banner.** Banner visible, non-modal,
   does not auto-dismiss, retry / reprint / manual-override
   buttons are 44×44 CSS px minimum (FR-068).
4. **Path D drawer-failure banner.** Banner visible, non-modal,
   includes `last_successful_open_at` as a relative timestamp
   ("last opened: 2 hours ago"), manual-override affordance.
5. **Path E recovery.** Kill the process during a Slice 1
   integration test fixture, restart, confirm the receipt slides
   out and the drawer kicks (cash path) within ~5 s.
6. **Path F refusal.** Force-fail an attempt in a Slice 4 test
   fixture, confirm no `sales` row exists, confirm the
   `sale.finalization_refused` audit event is recorded with the
   correct refusal_reason.

---

*This quickstart is a developer-onboarding aid; it is not
normative. The spec, plan, data-model, and contracts are the
source of truth.*
