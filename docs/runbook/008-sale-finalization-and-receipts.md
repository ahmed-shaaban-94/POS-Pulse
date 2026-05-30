# 008 — Sale Finalization & Receipts — Support Runbook

**Feature:** `specs/008-sale-finalization-and-receipts`
**Authored:** 2026-05-30 (Slice 6 — T524 support runbook + T525 rollback strategy).
**Constitution clause:** §P15 (Production Readiness Gates — production-affecting
features MUST ship a support runbook + rollback strategy before rollout).

> **Status note.** Authoring this runbook clears the §A5 tasks **T524** (support
> runbook) and **T525** (rollback strategy). It does **not** clear the §A5
> production-readiness sign-off (**T529**), nor any hardware/security gate
> (T512, T520a, T521, T523, T526). Those remain owner/reviewer-gated.

This runbook is for support engineers and on-call operators diagnosing 008
behaviour in the field. Every query below uses columns verified against the
shipped migrations (`migrations/0020`–`0024`); the schema is **append-only**
(AD-3 triggers reject UPDATE/DELETE on `print_events`, `drawer_events`, and
`sale_sync_outbox`), so diagnosis is always read-only — you cannot "fix" a row,
only read history and forward-fix in code.

---

## T524(a) — "The drawer didn't open but the receipt printed"

**First, decide whether this is even a fault.** In 008 a missing drawer-open has
**three** distinct meanings, and two of them are *correct behaviour*. Always
branch on `drawer_events.outcome` before treating it as an incident.

```sql
-- What happened to the drawer for this sale?
SELECT outcome,                 -- 'opened' | 'suppressed' | 'failed'
       suppression_reason,      -- 'cashless_tender_mix' (only when suppressed)
       failure_reason,          -- 'printer_dk_failure'|'os_error'|'no_drawer_configured' (only when failed)
       last_successful_open_at_for_terminal,
       triggering_print_event_id,
       attempted_at
  FROM drawer_events
 WHERE sale_id = :sale_id;
```

There is **at most one** `drawer_events` row per sale (UNIQUE(sale_id),
FR-053 double-kick suppression). Interpret the result:

| `outcome` | Meaning | Action |
|:--|:--|:--|
| `opened` | Drawer kicked successfully. | Not a fault — nothing to do. |
| `suppressed` | **Working as designed.** `suppression_reason='cashless_tender_mix'` — the sale was paid by card/voucher (no cash leg), so 008 deliberately did **not** kick the drawer. | **Stop. This is correct.** A card-only sale is *supposed* to print a receipt and leave the drawer shut. Do not chase this. |
| `failed` | A real fault. See `failure_reason`. | Diagnose below. |
| _(no row at all)_ | Finalize never reached the drawer step — receipt may have printed but the finalize listener short-circuited, or the feature flag is off (see §Rollback). | Check `print_events` for the sale and the `saleFinalization` flag state. |

If `outcome='failed'`, read `failure_reason`:

- `no_drawer_configured` — terminal has no drawer wired/configured. Expected on a
  card-only or scanner-only lane; only a fault if that terminal *should* have a drawer.
- `printer_dk_failure` — the drawer is kicked via the printer's DK1 pulse; the
  printer reported the kick failed. Check printer connectivity/paper first (the
  receipt printing while the kick failing points at the kick line, not the link).
- `os_error` — the OS-level drawer transport errored. Check driver/port.

The receipt **printing** while the drawer **failed** is the normal split: print
and drawer-kick are separate steps, and a finalized sale's receipt is dispatched
before/independently of the kick. A printed receipt + failed kick is a drawer
problem, not a receipt problem.

---

## T524(b) — "Which sales used manual override?"

Manual override is recorded as a `print_events` row with
`outcome='manual_override'` (the cashier acknowledged a print failure and
proceeded by hand-writing a slip; FR — no actual print happened, so
`render_path IS NULL` for these rows by CHECK constraint).

```sql
-- All manual-override events, newest first, with who took them.
SELECT pe.sale_id,
       pe.acting_operator_id,           -- who took the override
       pe.acting_operator_session_id,
       pe.printed_at                     -- when (ISO-8601 UTC)
  FROM print_events pe
 WHERE pe.outcome = 'manual_override'
 ORDER BY pe.printed_at DESC;
```

Scope to a single sale by adding `AND pe.sale_id = :sale_id`, or to a window with
`AND pe.printed_at >= :iso_start AND pe.printed_at < :iso_end`.

`acting_operator_id` is the operator who *took the override* — that is the
attribution you want for "who decided to fall back to a manual slip." (For a
reprint, attribution is dual — see T524(c).) No PII is stored on these rows; only
operator ids and session ids.

---

## T524(c) — "A reprint slip looks identical to the original — how do I tell them apart?"

You can tell them apart **two** ways — on the physical slip, and in the data.

**On the slip (what the cashier/customer sees).** A reprint is rendered with
`variant === 'reprint_duplicate'`, which prints a **duplicate-copy marker band at
the very top** that the original (`first_print`) never has:

```text
نسخة طبق الأصل
DUPLICATE COPY
Duplicate # N
...
Reprinted: <ISO-8601 UTC>
```

(`نسخة طبق الأصل` = "exact/true copy" — the Arabic bilingual marker; `N` is the
nth reprint.) An **original** receipt has **none** of that band. So: if you see
the `DUPLICATE COPY` / `نسخة طبق الأصل` band, it is a reprint; if the slip has no
top band, it is the original first print.

**In the data.** Reprints are `print_events` rows with `purpose='reprint'`. A
*successful* reprint carries a non-null `duplicate_copy_sequence_number` (the nth
copy → N); it is null everywhere else by CHECK constraint, so it is an unambiguous
structural marker:

```sql
SELECT print_event_id,
       purpose,                          -- 'reprint'
       outcome,                          -- 'success' for a completed reprint
       duplicate_copy_sequence_number,   -- N (non-null only on a successful reprint)
       acting_operator_id,               -- who reprinted
       printed_at
  FROM print_events
 WHERE sale_id = :sale_id
   AND purpose = 'reprint'
 ORDER BY printed_at DESC;
```

A reprint **never** kicks the drawer (no `drawer_events` row is added for a
reprint) and **never** mutates the sale — it is a pure re-render with dual
operator attribution (the reprinting operator + the original selling operator).

---

## T524(d) — "A sync-outbox row has been `pending` for N days — is that a bug?"

**No. This is expected, by design, today — for every finalized sale.**

008 finalizes a sale by enqueuing exactly one `sale_sync_outbox` row (FR-060,
AD-11 enqueue-only). The `state` column is **CHECK-constrained to `'pending'`
only** — there is no other legal value in the shipped schema:

```sql
state TEXT NOT NULL CHECK (state = 'pending')
```

008 has **no sync engine**. Nothing drains the outbox; that is a *future*
feature's job, and the table's append-only triggers explicitly note the future
sync engine may relax them via additive migration to allow state transitions.
**008 itself never transitions a row out of `pending`.** So a row sitting at
`pending` indefinitely is the correct steady state, not a stuck job.

What to actually verify when asked about a "stuck" row — confirm it is
*well-formed*, then stop:

```sql
SELECT outbox_row_id, sale_id, envelope_handoff_action_id,
       tenant_id, branch_id, terminal_id, state, enqueued_at
  FROM sale_sync_outbox
 WHERE sale_id = :sale_id;
```

There should be **exactly one** row per finalized sale (UNIQUE(sale_id)). If the
row exists, references a real sale, and reads `state='pending'`, that is healthy.
Do **not** attempt to delete or "retry" it — the AD-3 triggers reject both, and
there is nothing to retry against until the sync engine ships.

(Conversely: a finalized sale with **no** outbox row *would* be a real
defect — finalize is supposed to enqueue one atomically. That is the query to run
if you suspect a finalize that half-completed.)

---

## T524(e) — Interpreting `last_successful_open_at_for_terminal`

`drawer_events.last_successful_open_at_for_terminal` answers one question:
**"the last time we tried to kick this terminal's drawer and it failed — when did
this terminal's drawer last open successfully?"**

Critical detail, or you will misread it: it is **populated only on `failed`
drawer events**. On `opened` and `suppressed` rows it is **null** (verified in
`src/main/drawer/drawer-kick.ts` — only the failure branch stamps it). So:

- A `failed` row with a **non-null** timestamp → the drawer *has* worked before;
  this is a transient/recent fault, not a never-configured drawer. The value is
  the diagnostic "was this drawer ever alive, and how recently?" signal, captured
  at failure time.
- A `failed` row with a **null** timestamp → this terminal has **no prior
  successful open on record** — points at a never-working / never-configured
  drawer rather than a regression.
- A `null` on an `opened`/`suppressed` row → **means nothing**; the column simply
  isn't stamped on non-failure outcomes. Do not infer "never opened" from it.

The renderer's drawer-failure banner reads this field (via
`src/main/sales/banner-state-projector.ts`) to tell the cashier whether the
drawer is newly dead or chronically absent.

---

## T525 — Rollback strategy

008 is gated behind the `saleFinalization` feature flag and writes **durable
financial records**. That shapes both rollback options.

### (a) Rollback option — feature-flag disable (the supported rollback)

Flag: `features.saleFinalization` (shape in `src/shared/app-config.ts`), sourced
in main from the env var **`POS_PULSE_FEATURE_SALE_FINALIZATION`**. Default is
**`false`** (fail-closed). To roll 008 back, set the flag to `false` and restart
the terminal.

**Behaviour in the disabled state** (verified against the flag's documented
contract in `src/shared/app-config.ts`):

- **006 still settles payments** — the cart/payment path is untouched; money is
  still taken correctly.
- **008's finalize listener short-circuits** — **no receipt prints, no drawer
  kicks, no 008 audit-event emits.**
- **The cashier falls back to manual receipts** (hand-written slip), exactly as in
  the pre-008 world.
- **The sync outbox stops growing** — with the listener short-circuited, no new
  `sale_sync_outbox` rows are enqueued. **Existing rows remain** (append-only;
  they are harmless `pending` rows — see T524(d)).

This is the clean, reversible rollback: flip the flag off, the store keeps
trading on manual receipts, and re-enabling later resumes finalization with no
data repair needed.

### (b) NOT a rollback option — down-migration

**Down-migrating the 008 tables (`sales`, `print_events`, `drawer_events`,
`sale_sync_outbox`) is forbidden.** The `sales` rows are **durable financial
records**; dropping or reverting them destroys the store's record of money taken.
Per Constitution **§P15 (Production Readiness Gates)**, a broken
production-affecting feature is corrected by **forward-fix**, not by tearing down
financial state. If 008 misbehaves:

1. Disable via the feature flag (option a) to stop the bleeding immediately.
2. Forward-fix the defect in code and ship a corrected build.
3. Never author a down-migration against the 008 financial tables.

### Rollback decision matrix

| Situation | Action | Why |
|:--|:--|:--|
| 008 misbehaving in production, need it off **now** | `POS_PULSE_FEATURE_SALE_FINALIZATION=false` + restart | Reversible; 006 keeps settling payments; cashier uses manual receipts. |
| Need to re-enable after a fix | Set flag back to `true` (per-tenant/per-branch decision) + restart | Finalization resumes; no data repair required. |
| Tempted to drop/revert 008 tables | **Don't.** | `sales` are durable financial records; §P15 mandates forward-fix, not down-migration. |
| Stray `pending` outbox rows after disable | Leave them | Append-only + harmless; no sync engine drains them yet (T524(d)). |
