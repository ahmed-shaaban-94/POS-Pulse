# Quickstart: 006-payments-tender (Phase 1 — planning preview only)

**Feature ID:** 006-payments-tender
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Data model:** [./data-model.md](./data-model.md)
**Bridge contract:** [./contracts/bridge-api.md](./contracts/bridge-api.md)
**Created:** 2026-05-19
**Constitution version pinned:** v1.5.1

> ⚠ **Planning preview, not executable.** No code, no migrations, no
> bridge handlers exist yet. This file walks a future reviewer through
> what the 006 payment flow will look like *once Slices 1–4 ship*,
> using the locked v1.0 architecture as the script. Read alongside
> [./plan.md](./plan.md), [./data-model.md](./data-model.md), and
> [./contracts/bridge-api.md](./contracts/bridge-api.md).

---

## Setup (notional — pre-conditions, not commands)

These are the assumed pre-conditions for every flow below. No
commands are executable today.

1. **Terminal paired** (001 / 002): the terminal has a stable
   device token and is connected to its branch.
2. **Operator signed in** (004): a cashier has signed in via PIN;
   `operator.getCurrentSession()` returns an active session.
3. **Cart in handoff state** (005): the cashier has built a cart
   and invoked `cart.handoff`. The bridge return value is the
   frozen `PaymentIntentEnvelope v1` referenced below as
   `envelope`. The cart's `state` is `frozen_handed_off`.
4. **Payment surface mounted** (006 — Slice 1 onwards): the
   renderer has navigated to the payment surface and received the
   frozen `envelope` from the 005 bridge return value. Tender
   selection is reachable.

**Envelope used in every example below (illustrative; not a real
payload):**

```text
envelope = {
  envelope_version: 'v1',
  cart_id: 'a1b2c3d4-...',
  operator_session_id: 'sess-...',
  owning_operator_id: 'op-cashier-clerk-id',
  tenant_id: 'tnt-...',
  branch_id: 'br-...',
  terminal_id: 'term-...',
  lines: [ ... ],
  discount_placeholders: [],
  subtotal_minor: 12_550,                   // 125.50 in major units
  created_at: '2026-05-19T...',
  handoff_action_id: 'hand-...',
}
```

---

## US1 — Happy path: single cash payment

The simplest case: customer pays exact cash, no split.

```text
1. Renderer:  tender selection mounted with envelope bound.
              Cashier taps "Cash".

2. Renderer:  shows cash-entry control. Cashier types 13_000
              (130.00 in major units — over-tendered by 4.50).

3. Renderer → Main (bridge):
              payments.start({
                envelope_handoff_action_id: 'hand-...',
                envelope_cart_id: 'a1b2c3...',
                envelope_subtotal_minor: 12_550,
                envelope_version: 'v1',
                idempotency_key: <UUID v4 #1>,
              })
   Main:      requireOperatorSession() ✅
              INSERT INTO payment_attempts (..., state='started', ...);
              INSERT INTO payment_action_outbox (action_id=<UUID #1>, action_kind='payment.attempt.start', ...);
   Main →:    { kind: 'ok', payment_attempt_id: 'pa-...' }

4. Renderer → Main:
              tender.apply({
                payment_attempt_id: 'pa-...',
                tender_type: 'cash',
                amount_applied_minor: 13_000,
                idempotency_key: <UUID v4 #2>,
              })
   Main:      computes change_due_minor = 13_000 − 12_550 = 450.
              INSERT INTO payment_tender_lines (..., state='applied', change_due_minor=450, ...);
              INSERT INTO payment_action_outbox (..., action_kind='tender.apply', ...);
              EMIT audit_events row: action_category='tender.applied'.
   Main →:    { kind: 'ok', tender_line_id: 'tl-...', applied_at: ..., change_due_minor: 450 }

5. Renderer:  displays "Change due: 4.50"; cashier opens till, hands
              over change, taps "Confirm".

6. Renderer → Main:
              payments.confirm({
                payment_attempt_id: 'pa-...',
                idempotency_key: <UUID v4 #3>,
              })
   Main:      validates settlement invariant:
              Σ (amount_applied_minor − COALESCE(change_due_minor, 0))
                where state='applied'
                = (13_000 − 450) = 12_550
              vs envelope_subtotal_minor 12_550 ✅ (canonical form
              from data-model.md Invariant 5; the change_due
              subtraction is what makes cash overpayment safe).
              UPDATE payment_attempts SET state='settled', settled_at=NOW WHERE payment_attempt_id='pa-...';
              INSERT INTO payment_action_outbox (..., action_kind='payment.confirm', ...);
              EMIT audit_events row: action_category='payment.settled' with full tender_lines breakdown (AD-9).
   Main →:    { kind: 'ok', settled_at: '2026-05-19T...' }

7. Renderer:  shows "Payment received." The payment surface
              transitions to the placeholder post-settle state
              (FR-031). The cart is consumed.
```

**Audit trail produced (in 004's `audit_events`):**

- `tender.applied` (step 4)
- `payment.settled` (step 6, with full tender breakdown per AD-9)

**Settlement invariant clarification:** the invariant
`Σ applied_amount_applied_minor == envelope_subtotal_minor` is
evaluated **after** subtracting `change_due_minor` from cash lines.
Concretely, for any payment attempt:

`Σ (line.amount_applied_minor − COALESCE(line.change_due_minor, 0))`
`where line.state = 'applied' == envelope_subtotal_minor`

This is the canonical form. The Slice 3 confirm transaction
evaluates this exact expression.

---

## US2 — Cashier-initiated cancel mid-attempt

Cashier started a cash entry, then customer changed their mind.

```text
1–4. Same as US1 steps 1–4 (start + apply cash line).

5. Renderer:  cashier taps "Cancel".

6. Renderer → Main:
              payments.cancel({
                payment_attempt_id: 'pa-...',
                idempotency_key: <UUID v4 #cancel>,
              })
   Main:      LIFO-iterates applied tender_lines (order = 1):
              - cash line: UPDATE state='reversed', reversed_at=NOW;
                no till impact; EMIT tender.reversed.
              UPDATE payment_attempts SET state='cancelled', cancelled_at=NOW;
              INSERT payment_action_outbox (action_kind='payment.cancel');
              EMIT payment.cancelled.
   Main →:    { kind: 'ok', cancelled_at: ..., reversed_tender_line_ids: ['tl-...'], reversal_pending_tender_line_ids: [] }

7. Renderer:  returns to tender selection per AD-4. Envelope still
              bound; cashier may take payment again with a different
              tender mix.
```

**Audit trail:**

- `tender.applied` (step 4)
- `tender.reversed` (step 6)
- `payment.cancelled` (step 6)

The envelope is unchanged (immutable per 005 §"Immutability"); the
cashier can immediately invoke `payments.start` again with a new
`idempotency_key`.

---

## US3 — Operator session terminates mid-attempt (fail path)

Cashier started a cash attempt; their session ended (sign-out /
takeover / inactivity per 004 FR-008 / FR-013 / FR-014).

```text
1–4. Same as US1 steps 1–4 (start + apply cash line, state='started').

5. (External event)  004's operator session manager detects
                     sign-out / takeover / inactivity. Fires an
                     internal signal that the main process catches.

6. Main:      calls payments.discardOnSessionEnd({ payment_attempt_id: 'pa-...' })
              LIFO-iterates applied tender_lines:
              - cash line: UPDATE state='reversed' (no till impact);
                EMIT tender.reversed.
              UPDATE payment_attempts SET state='failed', failed_at=NOW,
                failure_reason='operator_session_terminated';
              INSERT payment_action_outbox (action_kind='payment.fail');
              EMIT payment.failed.

7. Renderer:  on next sign-in, the new cashier's UI hydrates from
              005's cart state. The cart is back in 'frozen_handed_off'
              (006 did not consume it because no payment.settled fired).
              The new cashier can take payment from scratch.
```

**Audit trail:**

- `tender.applied` (step 4)
- `tender.reversed` (step 6)
- `payment.failed` (step 6, with `failure_reason='operator_session_terminated'`)

The renderer-visible UX on session end is whatever 004's
sign-out / takeover surface already displays; the failed payment
is invisible to the original (now-departed) cashier.

---

## US4 — External card terminal record-only

Customer pays by card on a separate physical terminal.

```text
1. Renderer:  tender selection mounted. Cashier taps "Card terminal".

2. Renderer:  shows external_card_terminal entry surface:
              - amount field (defaults to envelope.subtotal_minor)
              - optional external_reference field (regex ^[A-Z0-9]{0,6}$)

3. Cashier:   completes payment on the external terminal (a device
              outside POS-Pulse — POS-Pulse has no API to it).
              Terminal prints a slip with auth code "A4F2".

4. Cashier:   types external_reference = "A4F2"; amount stays at
              12_550 (the cashier MUST NOT overpay non-cash —
              FR-010).

5. Renderer → Main:
              payments.start({ ... idempotency_key: <UUID #1> })
   Main →:    { kind: 'ok', payment_attempt_id: 'pa-...' }

6. Renderer → Main:
              tender.apply({
                payment_attempt_id: 'pa-...',
                tender_type: 'external_card_terminal',
                amount_applied_minor: 12_550,
                external_reference: 'A4F2',
                idempotency_key: <UUID #2>,
              })
   Main:      validates regex; 12_550 == remaining_balance → applied.
              INSERT payment_tender_lines (..., state='applied',
                external_reference='A4F2', change_due_minor=NULL, ...);
              INSERT payment_action_outbox.
              EMIT tender.applied (audit payload includes external_reference,
                redacted to '*****' in any log sink — R-5).
   Main →:    { kind: 'ok', tender_line_id: 'tl-...', applied_at: ... }

7. Cashier:   confirms.

8. Renderer → Main:
              payments.confirm({ ..., idempotency_key: <UUID #3> })
   Main:      Σ amount_applied = 12_550 == subtotal ✅
              UPDATE payment_attempts SET state='settled', settled_at=NOW.
              EMIT payment.settled with tender_lines breakdown.
   Main →:    { kind: 'ok', settled_at: ... }
```

**Audit trail:**

- `tender.applied` (step 6) — `external_reference='A4F2'` in audit
  payload, `*****` in logs.
- `payment.settled` (step 8) — full breakdown.

**Critical invariants enforced:**

- **Zero card data captured.** The cashier never types PAN / CVV /
  cardholder name. Only the optional 6-char alphanumeric auth code
  (R-5 format constraint refuses anything PAN-shaped).
- **External_reference redacted in logs.** Sentry / console sees
  `*****`; audit payload sees the real value (for reconciliation).

---

## US5 — Internal voucher (Slice 4, Contract V-A)

> ⚠ **Voucher path is Slice 4.** Until Contract V-A or V-B ships,
> the voucher tender slot is reserved-but-disabled and invoking it
> returns `tender_not_yet_supported`. This walkthrough is the
> *future-state* Slice 4 flow.

Customer presents a 50.00 voucher; subtotal is 125.50.

```text
1–2. Renderer:  tender selection. Cashier taps "Voucher".

3. Renderer:    shows voucher-entry surface; cashier scans/types
                voucher code 'VCH-A1B2'.

4. Renderer → Main:
                payments.start({ ... idempotency_key: <UUID #1> })
   Main →:      { kind: 'ok', payment_attempt_id: 'pa-...' }

5. Renderer → Main:
                tender.apply({
                  payment_attempt_id: 'pa-...',
                  tender_type: 'internal_voucher',
                  amount_applied_minor: 5_000,    // 50.00 — voucher full value
                  voucher_code: 'VCH-A1B2',
                  idempotency_key: <UUID #2>,
                })
   Main:        calls vouchers.validate (Contract V-A):
                  → POST /vouchers/validate { code: 'VCH-A1B2', applied_amount_minor: 5_000, ... }
                Data-Pulse-2 returns: { ok, intent_token: 'IT-xyz', applicable_amount_minor: 5_000 }
                INSERT payment_tender_lines (..., tender_type='internal_voucher',
                  state='applied', amount_applied_minor=5_000,
                  voucher_redemption_intent_token='IT-xyz', ...);
                EMIT tender.applied (intent_token NEVER in audit; only correlation refs).
   Main →:      { kind: 'ok', tender_line_id: 'tl-vch-...', applied_at: ... }

6. Renderer:    shows "Voucher applied: 50.00. Remaining: 75.50."

7. Renderer → Main:
                tender.apply({
                  payment_attempt_id: 'pa-...',
                  tender_type: 'cash',
                  amount_applied_minor: 7_550,    // 75.50 — exact remaining
                  idempotency_key: <UUID #3>,
                })
   Main:        cash line; remaining = 12_550 − 5_000 = 7_550; exact.
                INSERT payment_tender_lines (state='applied', change_due_minor=NULL).
                EMIT tender.applied.
   Main →:      { kind: 'ok', tender_line_id: 'tl-cash-...', applied_at: ... }

8. Cashier:     taps "Confirm".

9. Renderer → Main:
                payments.confirm({ ..., idempotency_key: <UUID #4> })
   Main:        Σ amount_applied = 5_000 + 7_550 = 12_550 ✅
                For the voucher line: calls vouchers.redeem (V-A):
                  → POST /vouchers/redeem { intent_token: 'IT-xyz' }
                Data-Pulse-2 atomically redeems; returns
                  { ok, authority_redemption_id: 'RED-789' }
                UPDATE payment_tender_lines SET voucher_authority_redemption_id='RED-789' WHERE tender_line_id='tl-vch-...';
                UPDATE payment_attempts SET state='settled', settled_at=NOW.
                EMIT payment.settled with full tender_lines breakdown
                  (voucher_reference: { authority_redemption_id: 'RED-789' }).
   Main →:      { kind: 'ok', settled_at: ... }

10. Renderer:   shows "Payment received." Cart consumed.
```

**Failure scenarios (any of which would have refused at step 5 or 9):**

- Voucher not found → `voucher_not_found`.
- Voucher expired → `voucher_expired`.
- Voucher cancelled → `voucher_cancelled`.
- Voucher already redeemed → `voucher_already_redeemed` (the
  authority's double-redemption guarantee).
- Voucher tenant / branch mismatch → respective refusal.
- Authority unreachable (validate) → `dependency_unavailable`.
- Authority unreachable (redeem) → attempt resolves to `failed`;
  voucher line transitions to `reversal_pending`; Slice 4 deferred
  resolver retries later.

**Renderer minimisation enforced:** the renderer sees only
`voucher_authority_redemption_id` (opaque short string). It never
sees the `intent_token`, voucher balance, voucher holder data, or
authority metadata (FR-017).

---

## US6 — Split tender: voucher + cash + cancel mid-attempt

This exercises the FR-006B rollback path (Slice 3 for cash side;
Slice 4 enables the voucher side).

```text
1–6. Same as US5 steps 1–6 (voucher line applied, remaining 7_550).

7. Renderer → Main:
                tender.apply({ tender_type: 'cash', amount_applied_minor: 5_000, idempotency_key: <UUID #3> })
   Main:        cash line; remaining was 7_550; 5_000 < 7_550, OK.
                INSERT payment_tender_lines (state='applied', change_due_minor=NULL).
   Main →:      { kind: 'ok', applied_at: ... }
                Remaining now: 12_550 − 5_000 − 5_000 = 2_550.

8. Cashier:     customer changes mind; taps "Cancel".

9. Renderer → Main:
                payments.cancel({ ..., idempotency_key: <UUID #4> })
   Main:        LIFO-iterates applied lines (cash first by apply_order=2,
                voucher second by apply_order=1):
                Step A — cash line:
                  UPDATE state='reversed'; no till impact;
                  EMIT tender.reversed.
                Step B — voucher line:
                  calls vouchers.reverse (Contract V-A) with the
                  intent_token.
                  If authority reachable: → success;
                    UPDATE state='reversed'; EMIT tender.reversed.
                  If authority unreachable: → failure;
                    UPDATE state='reversal_pending', reversal_pending_since=NOW;
                    EMIT tender.reversal_pending.
                UPDATE payment_attempts SET state='cancelled', cancelled_at=NOW.
                EMIT payment.cancelled.
   Main →:      { kind: 'ok', cancelled_at: ...,
                  reversed_tender_line_ids: ['tl-cash-...', 'tl-vch-...'],     // or just cash if voucher pending
                  reversal_pending_tender_line_ids: []                          // or ['tl-vch-...']
                }

10. Renderer:   returns to tender selection per AD-4. If a
                reversal_pending exists, the renderer shows a generic
                "Some reversals are pending — they will resolve
                automatically" message (no factor distinguishing).
```

**Audit trail (success-path version, voucher reverse reachable):**

- `tender.applied` (voucher, step 5)
- `tender.applied` (cash, step 7)
- `tender.reversed` (cash, step 9A)
- `tender.reversed` (voucher, step 9B)
- `payment.cancelled` (step 9)

**Deferred-reversal scenario (voucher reverse unreachable):**

- `tender.reversal_pending` (step 9B) instead of the second
  `tender.reversed`. The Slice 4 deferred resolver retries on app
  start / network-restore / cashier retry and emits the final
  `tender.reversed` when it succeeds.

---

## Test fixtures (planning-only sketch)

These fixtures are *not authored* by this PR. Slice 3
`/speckit-tasks` output will generate fixture files at the paths
suggested below.

| Fixture | Path (proposed) | Contents (sketch) |
|:--|:--|:--|
| Frozen envelope (cash-only, integer minor units) | `src/test/fixtures/payments/envelope-cash-12550.ts` | Valid `PaymentIntentEnvelope v1` shape. |
| Frozen envelope (split-tender scenario) | `src/test/fixtures/payments/envelope-split-25000.ts` | Subtotal 250.00 for split-tender tests. |
| Voucher authority stub (V-A) | `src/test/fixtures/payments/voucher-authority-stub.ts` | In-process stub returning canned validate / redeem / reverse responses. |
| Operator session fixture | (existing) `src/test/fixtures/operator/session-cashier-1.ts` | From 004 test infrastructure. |

---

## Coverage targets (per slice)

Reminder of the test floors from [./plan.md](./plan.md) §"Test
Strategy":

| Slice | Module | Floor |
|:--|:--|:--:|
| 2 | Cash money-math + change-due | ≥ 95 % |
| 3 | `PaymentAttempt` FSM | ≥ 95 % |
| 3 | `TenderLine` FSM | ≥ 95 % |
| 3 | Audit-event emitter | ≥ 95 % |
| 3 | Idempotency replay | ≥ 95 % |
| 3 | Bridge handlers (`payments.*` / `tender.*` minus voucher / forceFail) | ≥ 95 % |
| 3, 5 | Renderer payment surface | ≥ 90 % |
| 4 | Voucher V-A client + deferred-reversal resolver | ≥ 95 % |
| 4 | Force-fail bridge handler + manager incident-response surface | ≥ 95 % |
| 5 | Sentry / log redaction sample | 100 % (zero PII / card-data / voucher-token leakage) |

---

## Generic refusal UX

Across every flow, refusals at the renderer follow this rule
(FR-022 / NFR-003 / Constitution §P11):

| Bridge `reason` | Renderer-facing copy (illustrative) |
|:--|:--|
| `no_session` | "Please sign in to take payment." |
| `role_denied` | "This action isn't allowed right now." |
| `wrong_owner` | "This action isn't allowed right now." |
| `tenant_isolation` | "This action isn't allowed right now." |
| `cart_lost` / `stale_handoff` | "The cart is no longer available." |
| `attempt_terminal` | "This payment has already been completed or cancelled." |
| `attempt_already_started_on_terminal` | "Another payment is already in progress on this terminal." |
| `tender_underpaid` | "Amount is not enough." |
| `non_cash_overpayment_refused` | "This tender cannot exceed the remaining balance." |
| `invalid_input` | "Please check your entry." |
| `voucher_*` (any voucher-specific refusal) | "This voucher cannot be applied right now." |
| `dependency_unavailable` | "Please try again in a moment." |
| `internal_error` | "Something went wrong. Please try again." |
| `idempotency_payload_mismatch` | "Please try again." |
| `tender_not_yet_supported` | "This tender option is not available yet." |
| `manual_void_required` (audit-payload flag on external_card_terminal reverse) | "Please void this payment on the card terminal." |

**No reason category leaks beyond the audit payload.** The renderer
never displays the bridge `reason` as-is; the table above is the
mapping.

---

## What this quickstart does NOT do

- Does NOT execute any code (no `npm` command in this file is
  runnable yet).
- Does NOT show migration files (they're authored in Slice 3 under
  §A3).
- Does NOT show Impeccable / visual-direction screens (§A1 still
  held; the surfaces described above are functional sketches only).
- Does NOT show real Data-Pulse-2 endpoint payloads (the voucher
  validate / redeem / reverse contracts are commissioned in Slice 4
  under §A2).
- Does NOT show receipt-handoff rendering (receipts spec consumes
  the AD-9 `payment.settled` audit payload; rendering is out of
  scope).
- Does NOT show drawer-impact calculation (future shift-management
  spec consumes the same `payment.settled` audit payload).

---

**End of quickstart.** Next required step: `/speckit-tasks` against
this plan v1.0 to produce a startable per-slice task list with file
paths.
