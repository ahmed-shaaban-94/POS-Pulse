# Feature Specification: Sale Finalization & Receipts

**Feature ID:** 008-sale-finalization-and-receipts
**Status:** Draft
**Created:** 2026-05-26
**Last Updated:** 2026-05-27
**Owner:** POS-Pulse desktop team
**Constitution version pinned:** v1.5.1

> **Input (verbatim).** "After a payment attempt is successfully settled,
> POS-Pulse must finalize the sale as a durable local transaction,
> generate a safe receipt payload, support print/reprint flows, open the
> cash drawer when appropriate, and prepare a future sync handoff event
> without exposing sensitive payment/voucher data."

---

## Overview

When 006-payments-tender records a `payment.settled` outcome on a payment
attempt, the cart that was handed off in `PaymentIntentEnvelope v1` has
been paid — but the sale itself is not yet a durable, audit-anchor record,
no receipt exists, no drawer has opened, and nothing is staged for
eventual backend reconciliation. 008-sale-finalization-and-receipts closes
that gap.

This feature defines a single **product behaviour boundary**: once a
payment is settled, POS-Pulse MUST persist a durable, append-only sale
record keyed to the settled attempt, MUST generate a receipt payload from
that record (Arabic-first, RTL, Latin numerals), MUST print the receipt
(direct ESC/POS where available, OS print fallback otherwise), MUST open
the cash drawer when the tender mix justifies it, MUST handle printer /
drawer failures loudly (Principle IV), MUST support reprint flagged as a
duplicate copy, and MUST stage a future sync handoff event without
shipping the sync engine itself. The receipt payload MUST minimise
sensitive data — no raw card data of any kind (Constitution P6), no
voucher secrets, balances, holder PII, or authority tokens (006 FR-017,
Constitution P7).

This feature is **product behaviour only**. It does not define data
shapes, IPC channels, OpenAPI endpoints, migrations, codegen runs, or UI
implementation. Those decisions are owned by `/speckit-plan` and the
slice-level approval gates that follow.

## Clarifications

### Session 2026-05-27

- Q: Per-line VAT breakdown on the printed receipt — required for
  MVP? → A: No. **Sale-level VAT footer only for MVP**: a single sale-
  level VAT total plus the tenant's tax registration ID printed at the
  foot of the slip; the persisted Sale row stores a sale-level VAT
  total field only; per-line VAT (per-line amount + per-line rate) is
  **out of scope** for 008 and is deferred to a future fiscal /
  regulated-substance / multi-jurisdiction feature.
- Q: Drawer-kick command ordering — embedded in the ESC/POS receipt
  byte stream or a separate command after print-success
  acknowledgement? → A: **Separate command, fired only after the
  durable commit AND after the renderer / OS / printer acknowledges
  print success on the first print of a cash-inclusive sale.** The
  separate-command path preserves audit separability under
  Constitution Principle IV — a failed drawer kick MUST be loud and
  independently surfaceable from a failed receipt print
  (FR-040 / FR-042 / FR-043 / FR-053). Embedded-in-receipt kick is
  rejected for 008 v1; future printer drivers that only support
  embedded kicks are an extension governed by a future hardware-
  matrix spec, not by 008.
- Q: Sale-number scheme — per-terminal monotonic with terminal-id
  prefix, or ULID-style opaque id? → A: **Per-terminal monotonic
  with terminal-id prefix.** Canonical shape:
  `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>` where `<NNNNNN>` is a
  zero-padded, per-terminal, per-day monotonic sequence allocated
  locally (e.g. `T03-2026-05-27-000147`). The sequence resets at
  the start of each local trading day; sequence-reset boundary
  details (calendar day vs shift open) are a `/speckit-plan`
  decision but MUST preserve FR-010's stability and
  non-collision rules. The terminal-id prefix guarantees branch-
  wide uniqueness given Constitution Principle VIII's
  pairing-flow guarantee that `terminal_id` is bound to a
  `(tenant_id, branch_id, terminal_id)` tuple. ULID-style opaque
  ids are rejected because they fail SC-001's "quote the sale
  number to the customer" measurability.
- Q: Reprint permission boundary — who is permitted to invoke
  reprint, and does it require a supervisor override at action
  time? → A: **Cashier-permitted, fully attributed; no supervisor
  override required.** Any signed-in cashier MAY invoke reprint on
  any sale finalized at this terminal; the reprint audit event
  captures reprinter identity, operator session id, and shift
  context per FR-031. This matches 006 FR-020's precedent (cashier-
  permitted cancel with full attribution) and contrasts with 006
  FR-021's force-fail pattern (manager-only via dedicated incident-
  response surface). The risk that a cashier prints a duplicate
  slip and presents it as a fresh purchase (R2) is mitigated by
  FR-029's load-bearing **bilingual visible duplicate-copy marker**,
  not by gating the action. A future fraud-control feature MAY
  layer additional controls (e.g. flag a cashier with anomalous
  reprint frequency) without re-spec'ing 008.

## User Scenarios & Testing

> Each story is independently testable as product behaviour, conditioned
> on the upstream cleanup of 006's per-slice gates. Stories are
> prioritised so the smallest implementable slice (when unblocked) is P1.

### Primary User Story

A pharmacy cashier completes a sale: the customer's items are scanned
into the cart (005), the cashier collects payment by cash, by an external
card terminal, by an internal voucher, or any combination of those (006),
and confirms settlement. From the cashier's perspective the sale is *not*
finished until they see the printed receipt slide out of the thermal
printer in their own language, the cash drawer pop open (when cash was
part of the tender mix), and the screen acknowledge a stable sale number
they can quote back to the customer. If the customer later asks for
another copy, the cashier presses a single "reprint" affordance, the
printer emits a visibly-marked duplicate copy, the original sale's totals
are not changed, the audit log records the reprint, and the drawer does
not open a second time. If the printer is offline or jams during the
first print, the screen stays loud about it (Principle IV / P2): the
underlying sale is durable, the cashier MAY retry the print, and the
cashier MAY override to a manual receipt path without invalidating the
sale.

### Acceptance Scenarios

Each scenario uses Given / When / Then phrasing. Each MUST be testable
without naming an implementation. References to "settled attempt" mean
the canonical `payment.settled` audit event emitted by 006 (FR-031), and
to "envelope" mean the frozen `PaymentIntentEnvelope v1` produced by 005
and consumed by 006.

1. **Durable finalization at settlement**
   - **Given** a 006 payment attempt that has just transitioned to
     `settled` for an envelope with positive `subtotal_minor`,
   - **When** 008 receives the settled signal,
   - **Then** a durable sale record MUST be persisted locally before any
     receipt is rendered or any drawer command is issued, MUST be keyed
     by `envelope.handoff_action_id` so the same settlement cannot
     finalize twice (Constitution P5), and MUST carry the operator id,
     terminal id, branch id, tenant id, and per-line tender summary from
     the settled attempt.

2. **Sale number is stable and customer-quotable**
   - **Given** a durable sale has just been finalized,
   - **When** the cashier looks at the screen,
   - **Then** the sale MUST display a human-readable **sale number** that
     is stable for the lifetime of the sale, MUST appear unchanged on
     every reprint, MUST be allocated locally (no backend round-trip
     required), and MUST NOT collide with any other finalized sale on
     the same terminal.

3. **Receipt payload is generated from the durable sale**
   - **Given** a durable sale exists,
   - **When** the receipt payload is generated,
   - **Then** the payload MUST be derived solely from the persisted sale
     record (not re-derived from the live cart, not re-fetched from the
     catalogue API, not re-validated against the voucher authority),
     MUST contain the fields required by §"Receipt content rules"
     below, MUST omit every field listed in §"Sensitive-data
     minimisation", and MUST be byte-stable across re-generations (a
     reprint MUST produce the same content as the original except for
     the duplicate-copy marker).

4. **Receipt print succeeds — cash-inclusive sale opens the drawer**
   - **Given** a generated receipt payload for a sale whose tender mix
     includes at least one applied `cash` `TenderLine`,
   - **When** the receipt prints successfully,
   - **Then** the drawer kick MUST be issued **after** the durable sale
     commit and **after** receipt print success acknowledgement, the
     drawer command MUST carry the terminal id and a correlation key
     tied to the sale, and the audit log MUST record the drawer event
     (Constitution Principle IV).

5. **Receipt print succeeds — cashless sale does NOT open the drawer**
   - **Given** a generated receipt payload for a sale whose tender mix
     contains zero applied `cash` `TenderLine`s (only
     `external_card_terminal` and/or `internal_voucher`),
   - **When** the receipt prints successfully,
   - **Then** the drawer MUST NOT be commanded to open, and the audit
     log MUST reflect the cashless drawer-suppression decision.

6. **Receipt preview before print is available to the cashier**
   - **Given** a durable sale exists and a receipt payload has been
     generated,
   - **When** the cashier opts to preview the receipt,
   - **Then** the preview MUST visually mirror the printed output
     (Arabic-first, RTL layout, Latin numerals, the canonical Arabic
     and Latin font pair), MUST NOT block the cashier from continuing
     to the next sale, and MUST NOT itself emit a print command or open
     the drawer.

7. **Reprint is supported and marks the copy as duplicate**
   - **Given** a sale that has been previously printed at least once,
   - **When** the cashier invokes reprint,
   - **Then** the reprinted output MUST be visibly marked as a duplicate
     copy in both Arabic and Latin (e.g. "نسخة طبق الأصل — DUPLICATE
     COPY"), MUST preserve the original sale number, totals, tender
     lines, and timestamp, MUST NOT mutate the underlying sale record
     (Constitution P4 — non-destructive), MUST emit an append-only
     reprint audit event with reprinter operator id and shift context
     (P10), and MUST NOT open the cash drawer.

8. **Printer failure is loud, the sale stays durable**
   - **Given** a durable sale exists,
   - **When** the receipt-print operation fails (printer offline,
     out-of-paper, jam, OS print error, ESC/POS write failure),
   - **Then** the sale record MUST remain durable and MUST NOT be
     rolled back, the failure MUST surface a persistent non-modal
     banner with retry / reprint / manual-receipt affordances
     (Principle IV), the failure MUST NOT auto-dismiss, and the failure
     MUST emit an audit event distinct from a successful print.

9. **Drawer-kick failure does not block receipt or invalidate sale**
   - **Given** a durable sale that has printed successfully,
   - **When** the drawer-kick command fails (printer reports DK1/DK2
     failure, OS error, no drawer attached),
   - **Then** the sale MUST remain durable, the receipt MUST remain
     printed, a persistent non-modal banner MUST surface a
     manual-override affordance (Principle IV), and the failure MUST
     emit a distinct drawer-failure audit event with terminal id,
     attempt timestamp, and (when known) last successful drawer-open
     timestamp.

10. **006 `force_failed` and `reversal_pending` are never finalized**
    - **Given** a 006 payment attempt in `force_failed` state or any
      payment attempt that has at least one `TenderLine` in
      `reversal_pending` state,
    - **When** 008 evaluates whether to finalize,
    - **Then** finalization MUST be refused with a non-shaming,
      non-disclosing message, no sale record MUST be created, no
      receipt MUST be generated, no drawer command MUST be issued, and
      an audit event MUST record the refused-finalization reason.

11. **Voucher-safe receipt content**
    - **Given** a sale whose tender mix includes at least one applied
      `internal_voucher` `TenderLine`,
    - **When** the receipt payload is generated,
    - **Then** the printed and previewed receipt MUST show the
      generic tender label ("Voucher" / "قسيمة") and the applied amount
      in minor units only, MUST NOT show the voucher code, voucher
      balance, voucher holder PII, voucher redemption intent token, or
      any authority response payload (006 FR-017), and MAY show the
      non-sensitive `voucher_authority_redemption_id` only if that
      identifier was returned by `vouchers.redeem` and explicitly
      marked non-sensitive (006 FR-017).

12. **External-card-terminal-safe receipt content**
    - **Given** a sale whose tender mix includes at least one applied
      `external_card_terminal` `TenderLine`,
    - **When** the receipt payload is generated,
    - **Then** the receipt MUST show the generic tender label
      ("Card" / "بطاقة") and the applied amount in minor units only,
      MUST NOT show PAN, truncated PAN, CVV, cardholder name, expiry
      date, issuer name, auth payload, approval code, terminal-printed
      receipt text, or cryptogram (006 FR-008 / FR-040, Constitution
      P6), and MAY include the operator-entered
      `external_reference` field if and only if 006 OQ-PLAN-5 resolves
      to "field exists" — otherwise the field MUST be absent.

13. **Cashier / operator / terminal attribution on every receipt**
    - **Given** a generated receipt payload,
    - **When** the receipt is printed or previewed,
    - **Then** the receipt MUST display the cashier's display name (not
      Clerk user id, not PIN record id — see Constitution Principle
      VIII clarification rule 6), MUST display the branch identifier
      and the terminal identifier (or the terminal label, per
      Principle VIII), and MUST display the sale timestamp in UTC plus
      the cashier-local timezone presentation.

14. **Future sync handoff event is staged without a sync engine**
    - **Given** a durable sale has been finalized,
    - **When** the staging step runs,
    - **Then** a single append-only outbox-style event MUST be
      enqueued locally that names this sale as a candidate for backend
      sync (Constitution P3 — no silent loss; P18 — local durability
      before offline promises), MUST NOT call any backend endpoint,
      MUST NOT attempt to flush, and MUST carry only the minimum
      reference needed for a future sync engine to locate the sale.
      Sync engine implementation, retry policy, conflict resolution,
      and backend contract are explicitly out of scope.

### Edge Cases

- **Same envelope settled twice (impossible per 006, defensive here).**
  If finalization is invoked twice for the same
  `envelope.handoff_action_id`, the second invocation MUST be a no-op
  that returns the existing sale's identifiers (Constitution P5 —
  idempotency); it MUST NOT create a second sale, MUST NOT print
  again, MUST NOT open the drawer again.
- **Operator session terminated between settlement and finalization.**
  If the cashier's operator session ends (sign-out, takeover,
  inactivity per 004 FR-013 / FR-014) after `payment.settled` but
  before 008 has persisted the sale, finalization MUST still complete
  because the sale is the customer's money: the durable record carries
  the *settling* operator's attribution (the one who took the payment),
  not whoever holds the session afterwards. The reprint affordance
  MAY require a fresh operator session before it is offered (P10).
- **Printer reports success but emits blank output.**
  Out of scope for software; surfaced via the printer-failure path
  only when the device reports failure. The cashier's manual-override
  affordance (scenario 8) is the recovery path.
- **OS print path fallback emits a different visual layout than ESC/POS
  direct path.**
  Both paths MUST render from the same payload and the same template
  (per Constitution Hardware §"Receipt templates are version-controlled
  assets"). The cashier MUST NOT be exposed to which path was used;
  failure surfacing remains the print-failure scenario above.
- **Reprint requested for a sale finalized on a previous shift.**
  Permitted. The reprint audit event records the *reprinting* operator
  and shift; the original sale fields (operator, shift, sale number,
  timestamp) are unchanged.
- **Reprint requested for a sale that never printed successfully
  (manual-override path was taken).**
  Treated as a fresh print attempt, not a reprint. The duplicate-copy
  marker MUST be absent. The audit event records "first-print after
  manual override".
- **Drawer-kick requested but no drawer is attached.**
  Treated as a drawer-failure (scenario 9). The audit event records
  "no drawer configured" as the failure reason.
- **`safeStorage` becomes unavailable mid-shift.**
  Out of scope here; Constitution Tech Stack already requires
  production to refuse startup if `safeStorage.isEncryptionAvailable()`
  is false. 008 does not handle mid-shift loss.
- **Sale finalization after `force_failed` reset** (incident response
  via 006 FR-021 manager surface). The force-failed attempt MUST NOT
  produce a sale. A subsequent fresh payment attempt that settles MAY
  produce a sale per the normal path.

## Requirements

### Functional Requirements

> Numbering does not extend 006. 008 owns FR-001..FR-099. Forward
> references to 004 / 005 / 006 cite "(004 FR-NNN)" so cross-feature
> dependencies are visible.

#### Durable sale finalization boundary

- **FR-001.** Finalization MUST be invoked exactly once per
  `payment.settled` outcome from 006 (FR-031), keyed by
  `envelope.handoff_action_id`. Duplicate invocation MUST be a no-op
  returning the existing sale identifiers (Constitution P5).
- **FR-002.** Finalization MUST persist the sale to a local durable
  store before any receipt is generated, before any print command is
  issued, and before any drawer command is issued (Constitution P3).
- **FR-003.** The persisted sale record MUST include, at minimum: the
  sale number (FR-010), the receipt number (FR-011), the
  `envelope.handoff_action_id` correlation key, the operator identity
  (Clerk-backed per Principle VIII clarification rule 6), the
  `operator_session_id` (004 inheritance), the `terminal_id`, the
  `branch_id`, the `tenant_id`, the per-line tender summary from the
  settled 006 attempt (tender type + applied minor + change-due minor
  per `cash` line, plus the non-sensitive references permitted by
  FR-017 / FR-018), the sale timestamp in UTC, a stable settled-at
  timestamp inherited from the 006 attempt, and a single **sale-level
  VAT total** in minor units (per 2026-05-27 clarification — see
  Clarifications and Assumption A8). The Sale row MUST NOT carry
  per-line VAT amounts or per-line VAT rates; per-line VAT is
  explicitly out of scope (Out of Scope).
- **FR-004.** The persisted sale record MUST be **append-only at the
  rule level** (Constitution P4): once finalized, a sale MUST NOT be
  mutated. Reprints, drawer events, and print-failure events
  reference the sale; they do not modify it.
- **FR-005.** Finalization MUST be refused, and no sale MUST be
  created, if the source payment attempt is in `force_failed` state
  or if any of its `TenderLine`s are in `reversal_pending` state
  (006 FR-006A / FR-006B). The refusal MUST emit a structured audit
  event distinct from `payment.failed`.
- **FR-006.** Finalization MUST refuse generically at the renderer
  (006 FR-022, NFR-003 inheritance) if any precondition fails; the
  structured reason MUST live in the audit payload only.

#### Sale number and receipt number

- **FR-010.** A **sale number** is the customer-quotable identifier
  displayed on screen and printed on every receipt. It MUST be
  allocated locally (no backend round-trip), MUST be stable for the
  lifetime of the sale, MUST appear unchanged on reprints, MUST NOT
  collide with any other finalized sale on the same terminal, MUST
  be human-readable (suitable for a cashier to read out over the
  phone), and SHOULD encode enough context for a manager to locate
  the sale across a multi-terminal branch without ambiguity. The
  canonical scheme (per 2026-05-27 clarification — see
  Clarifications) is
  **`<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`** where `<NNNNNN>` is
  a zero-padded, per-terminal, per-day monotonic sequence allocated
  locally (e.g. `T03-2026-05-27-000147`). The sequence MUST reset
  per local trading day; the exact reset boundary (calendar day
  start vs shift open) is a `/speckit-plan` decision that MUST
  preserve the stability and non-collision rules above. The
  `<terminal_label>` segment MUST be sourced from the value
  already provisioned via the 002 pairing flow's `terminal_label`
  field (Constitution Platform Integration), not re-derived. ULID-
  style opaque identifiers are explicitly NOT used because they
  fail the cashier-quotability rule.
- **FR-011.** A **receipt number** is the identifier that appears on
  each *printed copy*. The first successful print of a sale MUST
  carry a receipt number; every reprint MUST carry the **same**
  receipt number with an explicit duplicate-copy marker (FR-031),
  not a new receipt number. (i.e. one sale → one receipt number;
  reprints do not allocate a new receipt number, even though they
  emit a new audit event.) The receipt number MAY equal the sale
  number; the exact relationship is `/speckit-plan` territory.

#### Receipt payload generation

- **FR-015.** The receipt payload MUST be derived solely from the
  persisted sale record (FR-002 / FR-003). The payload MUST NOT
  re-read `cart_lines`, re-call the catalogue API, re-validate
  vouchers, or re-derive totals from the live cart (Constitution P2 /
  P4 — non-destructive correction, no fake success).
- **FR-016.** The receipt payload MUST be **byte-stable** across
  re-generations of the same sale: a reprint payload MUST equal the
  original-print payload except for the duplicate-copy marker
  (FR-031) and the reprint-time-of-print field.
- **FR-017.** The receipt payload MUST contain, at minimum (the
  exact field names and shape are `/speckit-plan` decisions):
  - Pharmacy / tenant identifying header (tax registration ID, branch
    name, branch address — sourced from already-cached terminal
    config, NOT re-fetched at print time).
  - Sale number (FR-010) and receipt number (FR-011).
  - Cashier display name; operator and shift attribution per FR-022 /
    FR-023.
  - Terminal identifier (or terminal label).
  - Sale timestamp in UTC plus a cashier-local timezone presentation
    (Latin numerals on the printed receipt per Constitution
    Localization).
  - Per-line item summary derived from the envelope's line items, in
    Arabic where Arabic content is available (RTL layout).
  - Per-tender-line summary: tender type label
    ("Cash" / "نقدًا", "Card" / "بطاقة", "Voucher" / "قسيمة"), applied
    amount in minor units formatted per the canonical formatter, and
    (cash lines only) change-due-minor.
  - Totals: subtotal in minor units, total tendered, total change
    due (sum of `change_due_minor` across cash lines).
  - Footer: legally required tax footer (tax registration ID
    reproduced; a single **sale-level VAT total in minor units**
    printed at the foot of the slip per the 2026-05-27 clarification
    — see Clarifications, Assumption A8, and Out of Scope. Per-line
    VAT is NOT printed on the slip in 008 v1).
- **FR-018.** The receipt payload MUST NOT contain any field listed
  in §"Sensitive-data minimisation" below.

#### Receipt preview, print, and reprint

- **FR-025.** The cashier MUST be able to **preview** the receipt
  before printing. Preview MUST visually mirror the printed output
  (Arabic-first, RTL, Latin numerals, the canonical Arabic / Latin
  font pair per Constitution Localization). Preview MUST NOT itself
  emit a print command, MUST NOT open the drawer, and MUST NOT mutate
  the sale.
- **FR-026.** The cashier MUST be able to **print** the receipt. The
  first successful print of a sale MUST NOT carry the duplicate-copy
  marker.
- **FR-027.** The print path MUST be ESC/POS direct when the
  connected printer supports it; the OS print queue MUST be the
  fallback otherwise (Constitution Hardware §"Receipt printer"). The
  cashier MUST NOT be exposed to which path was used unless print
  fails.
- **FR-028.** A receipt MUST be reprintable from a sale that has
  printed at least once successfully (FR-026). The reprint MUST
  preserve the sale number, the receipt number, all totals, all
  tender-line summaries, the operator attribution of the original
  sale, and the original sale timestamp. Reprint is **cashier-
  permitted** (per 2026-05-27 clarification — see Clarifications):
  any signed-in cashier MAY invoke reprint on any sale finalized at
  this terminal. No supervisor / manager / admin override is
  required at action time. The action is gated only by the
  signed-in operator session (004 FR-001 / FR-013); a terminal
  with no signed-in operator MUST refuse the reprint affordance.
- **FR-029.** A reprint MUST be visibly marked as a duplicate copy
  in both Arabic and Latin on every emitted copy (e.g. "نسخة طبق
  الأصل — DUPLICATE COPY"). The marker MUST be obvious to a customer
  glancing at the slip; it MUST NOT be a tiny watermark.
- **FR-030.** A reprint MUST NOT open the cash drawer (FR-040
  enforces drawer-open only on the first successful print of a sale
  whose tender mix includes cash).
- **FR-031.** Every reprint MUST emit an append-only audit event
  carrying the reprinting operator identity (Clerk-backed per
  Principle VIII), the operator session id, the shift context (when
  shifts ship — see §Dependencies), the sale number, the
  duplicate-copy sequence number (1 for the first reprint, 2 for
  the second, etc.), and the time of reprint. The original sale
  record MUST NOT be mutated (Constitution P4).

#### Cash drawer command

- **FR-040.** The cash drawer kick MUST be issued **only** when all
  of the following hold: (a) the sale has been durably finalized
  (FR-002), (b) the receipt print has acknowledged success on the
  first print of this sale (i.e. not on reprint), and (c) the
  settled tender mix includes at least one applied `cash`
  `TenderLine` (006 amended FR-006B). The kick MUST be issued as a
  **separate command** distinct from the ESC/POS receipt byte stream
  (per 2026-05-27 clarification — see Clarifications). Embedding the
  drawer kick inside the receipt byte stream is PROHIBITED in 008 v1
  because it destroys the audit separability required by FR-042 /
  FR-043 and Constitution Principle IV. The kick MUST fire *after*
  the renderer / OS / printer acknowledges print success — not
  during the print, not before.
- **FR-041.** When (a)–(c) hold, the drawer-kick command MUST be
  issued with the terminal id and a correlation key tied to the
  sale, and MUST emit a successful-kick audit event.
- **FR-042.** When (a)–(c) do not all hold — e.g. cashless sale, or
  reprint — the drawer MUST NOT be commanded to open and the audit
  log MUST reflect the drawer-suppression decision (this is a
  truthfulness rule per Constitution P9 — the audit log explains
  why no kick happened).
- **FR-043.** A failed drawer-kick (printer reports DK1/DK2 failure,
  OS error, no drawer attached) MUST NOT roll back the sale, MUST
  NOT roll back the receipt print, MUST surface a persistent
  non-modal manual-override banner (Principle IV), and MUST emit
  a distinct drawer-failure audit event with terminal id, attempt
  timestamp, and (when known) last successful drawer-open
  timestamp.

#### Printer / drawer failure behaviour

- **FR-050.** A failed receipt print on first print MUST keep the
  sale durable (FR-002 already requires the sale to be persisted
  before any print attempt). The failure MUST emit a structured
  audit event distinct from the success event.
- **FR-051.** A failed receipt print MUST surface a persistent
  non-modal banner with three affordances: **retry print**,
  **reprint** (treated as a fresh first-print since the original
  print did not succeed — see Edge Cases), and **manual-receipt
  override** (the cashier writes / fills a manual slip; the audit
  log records that the manual override was used). The banner MUST
  NOT auto-dismiss.
- **FR-052.** A retried print after a failure that *succeeds* MUST
  be treated as the canonical first print (FR-026): no duplicate-copy
  marker, drawer-kick eligible per FR-040, distinct success audit
  event.
- **FR-053.** Retry of a print MUST be **idempotent against double
  drawer-kick**: if a previous print attempt for the same sale
  somehow already opened the drawer (e.g. partial success that
  printed and kicked but failed paper-cut), the retried print MUST
  NOT issue a second kick. The drawer-kick decision is tied to the
  sale, not to the attempt. (Constitution P5.)

#### Attribution rules

- **FR-022.** Every persisted sale MUST attribute the action to the
  Clerk-backed operator identity from 004 (FR-001 / FR-013), inherited
  through the 006 payment attempt. The local PIN record id MUST NOT
  be the attribution anchor (Constitution Principle VIII clarification
  rule 6).
- **FR-023.** Every persisted sale MUST carry the `operator_session_id`
  inherited from the 006 attempt and the `terminal_id` from the
  envelope, plus the `branch_id` and `tenant_id` for tenant isolation
  (Constitution P17).
- **FR-024.** Reprint attribution MUST be the **reprinting** operator,
  not the **selling** operator. Both MUST be retrievable from the
  audit log (P10).

#### Tender summaries on the receipt

- **FR-035.** **Cash** tender summary MUST show the applied amount in
  minor units and the change due in minor units, per cash line.
  When multiple cash lines exist (a corner case but permitted by
  006 FR-006B's split tender), the receipt MUST sum them into a
  single "Cash" row and a single "Change due" row.
- **FR-036.** **External card terminal** tender summary MUST show
  the applied amount in minor units only. The receipt MUST NOT
  show any cardholder data (FR-018, Constitution P6, 006 FR-008).
  The optional `external_reference` field MAY appear on the receipt
  if and only if 006 OQ-PLAN-5 resolves to "field exists" AND the
  resolved field policy permits printing the reference; otherwise
  the field MUST be absent from the receipt.
- **FR-037.** **Internal voucher** tender summary MUST show the
  applied amount in minor units and the generic voucher label
  ("Voucher" / "قسيمة"). The receipt MUST NOT show the voucher code,
  voucher balance, voucher holder PII, voucher redemption intent
  token, or any authority response payload (006 FR-017). The
  non-sensitive `voucher_authority_redemption_id` MAY appear if it
  has been explicitly marked non-sensitive by 006 FR-017 / OQ-PLAN-7;
  otherwise the field MUST be absent.

#### Voucher-safe receipt rules (cross-cutting)

- **FR-038.** Receipt content MUST follow 006 FR-017's renderer
  voucher-data minimisation: only the applied amount and the generic
  "voucher applied" indicator (and at most the non-sensitive
  `voucher_authority_redemption_id`) cross to the receipt payload.
  The voucher redemption intent token MUST NEVER appear on a
  receipt, in receipt logs, or in any reprint audit event.

#### `force_failed` and `reversal_pending` rules

- **FR-045.** A 006 attempt in `force_failed` state MUST NOT be
  finalized; FR-005 enforces this.
- **FR-046.** A 006 attempt with any `TenderLine` in
  `reversal_pending` state MUST NOT be finalized; FR-005 enforces
  this. Once the deferred-reversal resolver moves the
  `reversal_pending` line to `reversed` (and therefore the attempt's
  terminal state is `cancelled` or `failed`, not `settled`),
  finalization MUST NOT be invoked for that attempt. (i.e. only
  `settled` attempts ever reach 008.)
- **FR-047.** If 006 produces a `reversal_pending` line in a
  *post-settlement* corrective flow that 008 has not anticipated
  (a path not currently in 006 v1), finalization for that attempt
  MUST be guarded by FR-005's structured refusal. This is a
  defensive rule: 008 trusts 006's FSM but does not silently
  paper over a future expansion of `reversal_pending` semantics.

#### Local audit events

- **FR-055** *(revised 2026-05-27 post-CodeRabbit CR2 + R2 cleanup)*. Every state-change in 008 MUST emit exactly one
  canonical audit event under 004 FR-025 / FR-026 / FR-028. The
  catalogue is **exactly 10 categories** (finalised by `/speckit-plan` AD-9; this list is authoritative):
  - `sale.finalized` — durable sale persisted.
  - `sale.finalization_refused` — finalization refused per FR-005 /
    FR-045 / FR-046 / FR-047.
  - `sale.receipt.printed` — first successful print of a sale.
  - `sale.receipt.reprinted` — successful reprint with
    duplicate-copy marker.
  - `sale.receipt.print_failed` — first-print or retry failed.
  - `sale.receipt.print_retried_success` — a retry-after-failure
    succeeded; treated as canonical first print per FR-052.
  - `sale.receipt.manual_override` — cashier invoked manual-receipt
    override after print failure.
  - `sale.drawer.opened` — successful drawer kick on first print of
    a cash-inclusive sale.
  - `sale.drawer.suppressed` — drawer not kicked because the tender
    mix was cashless. *(Revised post-R2 — the "OR reprint" branch
    was removed; reprints emit no DrawerEvent at all, so no
    suppression event fires either.)*
  - `sale.drawer.failed` — drawer kick command failed.

  **The sync-outbox INSERT is silent w.r.t. `audit_events`** — the
  `sale_sync_outbox` row IS its own audit anchor (see FR-060). No
  separate `sale.sync_handoff_staged` audit event exists. *(Revised
  post-CR2 — earlier drafts named such an event; it was removed
  because the outbox row + the `sale.finalized` event together
  already cover the audit need.)*
- **FR-056.** Audit events MUST be append-only at the rule level
  (Constitution P4 / 004 FR-028).
- **FR-057.** Audit events MUST NOT contain any field listed in
  §"Sensitive-data minimisation" below.
- **FR-058.** Audit events MUST carry: operator attribution
  (Clerk-backed), terminal id, branch id, tenant id, the sale's
  `handoff_action_id` correlation key, and a UTC timestamp.

#### Future sync handoff event (staging only)

- **FR-060** *(clarified post-CR2)*. On `sale.finalized`, a single
  append-only outbox row MUST be inserted into `sale_sync_outbox`.
  The staging step MUST run as part of the finalization
  transaction (or be otherwise atomically tied to the durable sale
  commit per Constitution P3 / P5), MUST NOT call any backend
  endpoint, MUST NOT attempt to flush, and MUST carry only the
  minimum reference needed for a future sync engine to locate the
  sale (e.g. a stable sale id + `handoff_action_id`). **No
  separate audit event is emitted for the staging step** — the
  outbox row itself is the audit anchor for "this sale is queued
  for the future sync engine"; combined with the `sale.finalized`
  audit event (which already names the `handoff_action_id`
  correlation key), the audit trail is complete without a
  redundant `sale.sync_handoff_staged` category.
- **FR-061.** The future sync engine, its retry policy, its
  conflict-resolution semantics, and its backend OpenAPI contract
  are **out of scope** for 008. 008 only guarantees that *something
  durable will be there* for the sync engine to pick up
  (Constitution P3 / P18 — local durability before offline
  promises).

#### Arabic-first / RTL receipt and UI expectations

- **FR-065.** All cashier-facing 008 UI (preview, reprint, failure
  banners, drawer-failure banners, manual-override affordance) MUST
  be Arabic-first by default with RTL layout (Constitution
  Localization, P14).
- **FR-066.** The printed and previewed receipt MUST be Arabic-first
  with RTL layout. **Latin numerals** MUST be used for all numeric
  fields on the printed receipt (totals, tender amounts, change due,
  sale number, receipt number, dates, times) per Constitution
  Localization §"Latin numerals on receipts for audit/legal
  compatibility". The receipt MAY use Arabic-Indic numerals only
  in the preview UI if the cashier's locale setting demands it,
  but the printed slip is locked to Latin numerals.
- **FR-067.** Currency, date, and time formatting on the receipt
  MUST flow through the single `formatters` module
  (Constitution Localization §"never inlined").
- **FR-068.** Touch-target floor 44 × 44 CSS px applies to every
  008 interactive control (Constitution Hardware Operational rules,
  P14).
- **FR-069.** Every 008 interactive control MUST be keyboard-
  operable; no mouse-only flows (P14).

#### Sensitive-data minimisation (normative)

The receipt payload, every receipt copy (printed and previewed),
every 008 audit event, every 008 log line, every Sentry event, and
every support-bundle export MUST NOT contain:

- **FR-070.** PAN, truncated PAN, CVV, magnetic-stripe / chip /
  contactless track data, cardholder name, expiry date, issuer name,
  auth payload, approval code, terminal-printed receipt text, or any
  cryptogram (006 FR-008 / FR-040, Constitution P6).
- **FR-071.** Voucher code, voucher balance, voucher holder PII,
  voucher redemption intent token, raw voucher-authority response
  payload, or any cross-cart voucher state (006 FR-017,
  Constitution P7).
- **FR-072.** Cashier PIN, PIN hash, PIN record id, Clerk JWT,
  device token, attestation, or any secret listed in Constitution
  Tech Stack §"Secret storage" (Constitution P7).
- **FR-073.** Customer PII beyond what is strictly required by
  pharmacy / tax regulation (the spec does not introduce any
  customer-PII collection in 008; if a future regulatory requirement
  demands it, that field's inclusion MUST be re-spec'd).
- **FR-074.** Raw `PaymentIntentEnvelope` payload (the envelope is
  consumed; only the fields named in FR-003 / FR-017 cross into 008).

### Non-Functional Requirements

- **NFR-001.** Money on the receipt MUST be integer minor units
  (Constitution Principle II / P1). No floats, no decimal-string
  arithmetic. Display formatting at the `formatters` boundary only.
- **NFR-002.** Failure MUST be loud, never silent (Constitution
  Principle IV, P2): printer offline, drawer-kick failure, OS-print
  fallback errors MUST surface persistent non-modal banners that
  do not auto-dismiss.
- **NFR-003.** PII / cards / secrets / voucher data MUST NEVER
  appear in logs (Constitution P7, 004 NFR-002, 006 NFR-002).
- **NFR-004.** Accessibility — touch targets ≥ 44 × 44 CSS px
  (P14, 004 NFR-005 inheritance); all cashier-facing controls
  MUST be keyboard-operable.
- **NFR-005.** The receipt-generation step from "received settled
  signal" to "preview ready" MUST complete fast enough not to
  visibly stall the cashier (target: under 500 ms on the MVP
  hardware matrix); the durable persist step MUST complete before
  print, so this NFR governs the user-perceived latency, not the
  durable-commit latency.
- **NFR-006.** A successful first print + drawer kick on a typical
  cash sale (single line, no voucher, no card) MUST complete
  within 3 seconds of the settled signal on the MVP hardware
  matrix. (This is the operator-visible "sale-to-drawer-open"
  window referenced in `docs/product.md`'s "complete a sale, print
  a receipt, and open the drawer in under 10 seconds" success
  statement; 008 owns the receipt-and-drawer portion of that
  window.)
- **NFR-007.** Reprint MUST complete within the same 3-second window
  as a first print (NFR-006), and MUST NOT block the cashier from
  starting the next sale.
- **NFR-008.** The persistent-banner failure surfaces (printer,
  drawer) MUST be visually distinct from the connection-state
  indicator (003) and the operator-session indicator (004); they
  layer on top, do not replace.

## Success Criteria

Measurable, technology-agnostic outcomes. The feature is "done" when
these are demonstrably true.

- **SC-001.** A cashier can take a cash payment for an approved cart,
  observe the printed receipt in Arabic-first RTL layout with Latin
  numerals, observe the drawer open, and quote the sale number to
  the customer — within 10 seconds of confirming the payment, on the
  MVP hardware matrix. (NFR-006; aligns with `docs/product.md`
  product-purpose statement.)
- **SC-002.** A cashier can take a mixed cash + voucher payment
  (split tender per 006 FR-006B), observe the printed receipt
  showing the voucher row with the generic "Voucher" label and
  applied amount only (no voucher code, no balance), and the drawer
  opens because cash was part of the tender mix.
- **SC-003.** A cashier can take an external-card-terminal-only
  payment, observe the printed receipt showing the "Card" row with
  applied amount only (no cardholder data of any kind), and observe
  that the drawer does NOT open.
- **SC-004.** A cashier can press "reprint" on a previously finalized
  sale, observe a printed slip that is visibly marked as a duplicate
  copy in both Arabic and Latin, observe that the sale number,
  receipt number, totals, tender lines, and original timestamp match
  the original, and observe that the drawer does NOT open.
- **SC-005.** When the printer is offline, a cashier observes a
  persistent non-modal banner with retry / reprint / manual-override
  options, the sale remains durable, and no auto-dismiss occurs.
- **SC-006.** When the drawer-kick fails on a cash-inclusive sale, a
  cashier observes a persistent non-modal manual-override banner,
  the receipt still prints, the sale remains durable, and an audit
  event records the failure with terminal id and timestamp.
- **SC-007.** A reviewer auditing logs / Sentry / support bundles
  for any 008-emitted record finds **zero** instances of cardholder
  data, voucher codes, voucher balances, voucher holder PII, voucher
  redemption intent tokens, PINs, device tokens, JWTs, or raw
  envelope payloads.
- **SC-008.** A future sync engine (any future feature that
  consumes the staged outbox event) can locate every finalized 008
  sale via the staged event and is not required to reach into 008's
  internals to do so.
- **SC-009.** A duplicate finalization invocation for the same
  `envelope.handoff_action_id` produces no second sale, no second
  print, no second drawer kick, and returns the existing sale's
  identifiers (Constitution P5 — idempotency).
- **SC-010.** A 006 attempt in `force_failed` or with any
  `TenderLine` in `reversal_pending` is refused finalization, no
  sale is created, no receipt is generated, no drawer is opened,
  and an audit event records the refusal.

## Key Entities

> Names are indicative; the data shapes, persistence model, and
> migration plan belong to `/speckit-plan`.

- **Sale** — The durable, append-only record of a settled
  transaction at this terminal. Keyed by
  `envelope.handoff_action_id` (the 006 ↔ 008 correlation anchor).
  Carries the sale number, receipt number, operator / shift /
  terminal / branch / tenant attribution, per-tender-line summary
  (with non-sensitive references only), and UTC + local
  timestamps.
- **ReceiptPayload** — Generated from the persisted Sale.
  Byte-stable across re-generations (except for the duplicate-copy
  marker and time-of-print). Consumed by both the ESC/POS direct
  path and the OS-print fallback path so that both render
  identically.
- **PrintEvent** — Append-only audit record of a print attempt
  (success or failure). One sale may have many PrintEvents (one
  for the first print, one for each retry, one for each reprint,
  one for each manual-override).
- **DrawerEvent** — Append-only audit record of a drawer kick
  attempt (success, suppression, or failure). Tied to a Sale, not
  to a PrintEvent.
- **SyncHandoffEvent** — Append-only local outbox event staged
  on `sale.finalized`. Carries only the minimum reference needed
  by a future sync engine. Not flushed by 008.

## Assumptions

- **A1.** 006 emits a canonical `payment.settled` signal (audit
  event per 006 FR-031 + an in-process delivery mechanism that
  `/speckit-plan` defines) that 008 can subscribe to without
  reaching into 006's internals.
- **A2.** The `envelope.handoff_action_id` is unique per settled
  attempt (006 commitment) and is a suitable correlation key for
  the durable Sale row (Constitution P5).
- **A3.** The cashier display name, branch identifier, branch
  address, terminal label, and tenant tax-registration ID are
  already available locally at sale-finalization time — sourced
  from already-cached terminal config (002-terminal-pairing) and
  the operator session (004). 008 does not re-fetch them.
- **A4.** Receipt templates are version-controlled assets that
  emit both an ESC/POS byte stream and a printable HTML / canvas
  fallback (Constitution Hardware §"Receipt templates").
  `/speckit-plan` decides where the templates live; 008 only
  asserts they exist and are bilingual.
- **A5.** Shifts have not yet shipped (no shift-management spec
  is approved as of 2026-05-26). Until shifts ship, the
  shift-context fields on sale and reprint audit events MAY be
  absent / null; FR-058 lists them as "where applicable". When
  shifts ship, every audit event automatically becomes
  shift-scoped via the standard 004-style operator-session
  binding.
- **A6.** The drawer kick is issued via the printer's kick
  command (DK1/DK2 ESC/POS pulse) per Constitution Hardware.
  When the connected device is not a thermal printer with a
  drawer kick output (OS-print fallback path, no drawer
  attached), the drawer command is treated as a failure
  (FR-043) — never as a silent success.
- **A7.** The pharmacy's legal / tax footer content (tax
  registration ID, regulated-substance language where required)
  is owned by the receipt template asset and is the same across
  every receipt; 008 does not maintain a separate copy.
- **A8.** Per-line VAT breakdown is **not** required by Egyptian
  pharmacy regulation on every printed slip and is **not** delivered
  by 008 v1 (confirmed by `/speckit-clarify` 2026-05-27 — see
  Clarifications). The printed slip carries a single sale-level VAT
  total in minor units plus the tenant's tax registration ID at the
  footer; the Sale row carries the sale-level VAT total only. If a
  future jurisdiction or fiscal-integration feature requires per-line
  VAT on the slip, the receipt template asset, the Sale row, and the
  receipt payload are extended under that future feature — not under
  008.
- **A9.** "Duplicate copy" marker text in Arabic ("نسخة طبق
  الأصل") and Latin ("DUPLICATE COPY") is the canonical bilingual
  marker; the exact typographic treatment is `/speckit-plan`
  territory.
- **A10.** The future sync engine is a separate spec; 008's
  staging step (FR-060) commits to enqueue-only behaviour and
  carries no flush logic.

## Out of Scope

Explicitly NOT delivered by 008. Items here block scope creep and
inform the next feature's planning.

- ❌ **Inventory decrement** on sale finalization — owned by a
  future inventory spec (006 FR-041 also forbids it for payments).
- ❌ **Reports, KPIs, dashboards, analytics surfaces** — owned by
  a future reporting feature.
- ❌ **X-report / Z-report / shift reports** — owned by a future
  shift-management spec.
- ❌ **Refunds / returns / voids** (positive or negative) —
  owned by a future refunds spec. 008 finalizes forward sales
  only; the constitution P4 non-destructive-correction rule
  governs how refunds will eventually relate to the original
  Sale (append a new event, never mutate the Sale row).
- ❌ **Full offline sync engine, retry policy, conflict
  resolution, backend OpenAPI contract** — owned by a future
  sync-engine spec. 008 only stages the outbox event.
- ❌ **Printer hardware driver matrix** — beyond the constitution-
  required ESC/POS direct path + OS-print fallback, 008 does
  not enumerate specific printer makes / models. The hardware
  matrix lives in `docs/hardware-matrix.md` per Constitution
  Hardware §Operational rules.
- ❌ **Backend accounting** — 008 does not call any backend
  endpoint, does not maintain any backend-derived ledger, and
  does not interpret the future backend's sale-confirmation
  response shape.
- ❌ **Direct access to the SmartDataPulse SaaS database** —
  forbidden by Constitution Platform Integration §"only path to
  the backend".
- ❌ **Broad UI redesign** — 008 lives inside the visual system
  ratified by 007 and the design tokens / primitives at
  `src/renderer/ui/`. No new top-level navigation, no new theme,
  no new font stack.
- ❌ **Receipt template authoring tool** — templates are
  version-controlled assets, edited in-repo, not edited at
  runtime.
- ❌ **Receipt email / SMS / digital delivery** — out of scope;
  print + reprint only.
- ❌ **Loyalty receipt content beyond what FR-017 already
  permits** — owned by Data-Pulse-2 / a future loyalty spec.
- ❌ **Voucher issuance / cancellation / catalogue management** —
  forbidden in POS-Pulse (006 FR-018, Constitution P16).
- ❌ **Customer display / pole display rendering** — out of MVP
  hardware matrix (Constitution Hardware §"Out of scope").
- ❌ **Card terminal SDK integration of any kind** — record-only
  only (006 FR-007 / FR-008, Constitution P6).
- ❌ **Sentry / Pino redaction surface expansion** beyond what
  this feature inherits from 004 / 006 — any new redaction rule
  is owned by a focused observability slice, not smuggled into
  008 (Constitution P11).
- ❌ **Per-line VAT breakdown on the printed slip** (per-line VAT
  amount + per-line VAT rate columns). The slip carries a single
  sale-level VAT total only — see Clarifications 2026-05-27 and
  Assumption A8. Per-line VAT is owned by a future fiscal /
  regulated-substance / multi-jurisdiction feature.

## Dependencies

- **006-payments-tender:**
  - Must be SPEC COMPLETE (✅ as of 2026-05-26, PR #234 closeout).
    006 owns the `payment.settled` signal, the
    `PaymentIntentEnvelope v1` consumption, the
    `payment.force_failed` semantics, and the `reversal_pending`
    state.
  - 008 reads only the fields documented in FR-003 / FR-017 — it
    does not reach into 006's internal state machine.
- **005-sales-cart:**
  - Must be SPEC COMPLETE (✅). 005 owns the envelope; 008
    treats the envelope as opaque on the field level.
- **004-operator-session:**
  - Operator identity (Clerk-backed), session id, role-gated
    visibility, and audit-event catalogue (004 FR-025 / FR-026 /
    FR-028) are inherited. 008 extends the catalogue with the
    eleven `sale.*` audit events listed in FR-055.
- **003-pos-ui-shell:**
  - Connection-state visuals (`online`, `degraded`, `offline`,
    `syncing`) are visual-only as of 003 (Constitution P9 /
    Active Feature Compatibility Note). 008 does not make any
    of them real; the sync-handoff staging step (FR-060) is the
    first piece of durable state that any future sync feature
    will consume.
- **007-pos-visual-system:**
  - Visual system + design tokens (light theme, font pair, 44 × 44
    floor, axe-clean rules) is canonical. 008 builds inside it,
    not next to it.
- **Future shift-management spec:**
  - Owns shift open / shift close, drawer expected total, drawer
    variance, X / Z reports. 008's sale and audit events MUST
    carry enough information (per FR-055 / FR-058) that the
    future spec can attribute every sale to a shift without
    requiring a 008 re-spec.
- **Future inventory spec:**
  - Owns stock movement on sale. 008 finalizes the sale but does
    not mutate inventory.
- **Future sync-engine spec:**
  - Owns flush, retry, conflict resolution, backend OpenAPI
    contract, idempotency on the backend side.
- **Future refunds spec:**
  - Owns refund / return / void semantics. 008's append-only
    Sale shape (FR-004 / Constitution P4) is the foundation
    refunds will append to.
- **Backend `api.smartdatapulse.tech`:**
  - **Not** a dependency of 008. 008 makes zero backend calls.
    The future sync-engine spec will introduce the dependency.
- **Hardware:**
  - Thermal printer with optional drawer kick (Constitution
    Hardware MVP Matrix). OS-print fallback when ESC/POS is
    unavailable. No new hardware support.

## Open Questions

[Maximum 3. Each MUST be a decision that changes scope, security, or
core UX. Resolved questions move to Assumptions.]

- ~~**OQ-1.** Sale-number scheme — format and uniqueness scope.~~
  *(Resolved by `/speckit-clarify` 2026-05-27 — see Clarifications.
  Canonical scheme: `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`, per-
  terminal per-day monotonic sequence, locally allocated. FR-010
  updated; ULID-style opaque ids explicitly rejected.
  `/speckit-plan` owns the calendar-day-vs-shift-open reset
  boundary.)*
- ~~**OQ-2.** Drawer-kick command ordering (separate vs embedded).~~
  *(Resolved by `/speckit-clarify` 2026-05-27 — see Clarifications.
  Separate command, fired after print-success acknowledgement on
  cash-inclusive first print only. Embedded-in-receipt kick is
  PROHIBITED in 008 v1 to preserve audit separability under
  Principle IV. FR-040 updated; FR-041 / FR-042 / FR-043 / FR-053
  unchanged and remain canonical.)*
- ~~**OQ-3.** Per-line VAT breakdown on the printed slip.~~ *(Resolved
  by `/speckit-clarify` 2026-05-27 — see Clarifications. Sale-level
  VAT footer only for MVP; per-line VAT is out of scope. Assumption
  A8 updated; FR-003 and FR-017 carry the resolution.)*

## Risks & Likely Future Gates

> Informational. Not normative. `/speckit-plan` formalises gates as
> §A1…§AN rows.

- **Likely §A1 — Receipt template asset checkpoint.** The bilingual
  Arabic-first receipt template (ESC/POS + HTML / canvas) is the
  first time POS-Pulse ships a customer-facing printed surface.
  A review gate analogous to 006 §A1 (visual-direction sign-off)
  is likely needed to lock the template's typographic system,
  RTL flow, Latin-numeral discipline, and footer content before
  Slice 2 begins.
- **Likely §A2 — Migration checkpoint.** 008 introduces the
  Sale, PrintEvent, DrawerEvent, and SyncHandoffEvent tables.
  Constitution P8 requires that the migration runner change is
  introduced by the feature that owns the schema change, and
  reviewed under explicit security review. A gate analogous to
  005 §A2 / 006 §A3 is likely.
- **Likely §A3 — Hardware bring-up checkpoint.** First thermal-
  printer-and-drawer integration. The constitution requires
  `docs/hardware-matrix.md` to reproduce tested models and
  driver versions (Constitution Hardware §Operational rules).
  A gate that pairs the integration test against a real device
  matrix is likely.
- **Likely §A4 — Audit-event catalogue extension checkpoint.**
  Eleven new `sale.*` audit-event types extend the 004 catalogue
  (FR-055). The catalogue extension should be reviewed against
  004 FR-027 / FR-028 and Constitution P11 (supportability
  without leakage) before implementation begins. A gate
  analogous to 006 §A3 is likely.
- **Likely §A5 — Production readiness gate.** 008 is a
  production-affecting feature under Constitution P15 (it
  changes what happens at the cash drawer). The plan's
  Production Readiness subsection MUST include the test plan,
  rollback strategy, support runbook entry, failure-mode
  catalogue, and operational readiness expectations before
  rollout (Constitution Development Workflow §Production
  Readiness Gates).
- **Risk R1 — Voucher-data minimisation drift.** 006 FR-017
  pins the renderer voucher boundary. 008 extends that boundary
  to the *receipt*, which is more permanent than the screen.
  Plan-level review MUST verify that no voucher field 008
  carries to the printed slip could be misused (P6 / P7
  combined posture).
- **Risk R2 — Reprint as covert refund.** A reprint that
  visually mimics the original (no duplicate-copy marker) could
  be presented to a customer as a fresh purchase. FR-029's
  bilingual visible marker is the load-bearing mitigation;
  reviewers MUST test that the marker is obvious to a customer
  glancing at the slip, not a tiny watermark.
- **Risk R3 — `force_failed` race with finalization.** If 006's
  manager force-fail surface (006 FR-021) is invoked between
  `payment.settled` emission and 008's durable commit, the
  defensive guard in FR-005 / FR-045 / FR-047 catches it.
  Plan-level review MUST exercise the race in an integration
  test.
- **Risk R4 — OS-print fallback path emits a visually inferior
  slip vs. ESC/POS direct.** Both paths render from the same
  template (Assumption A4). Plan-level review MUST verify both
  paths render byte-stably enough that an audit cannot
  distinguish "first print" from "reprint" based on path
  choice.
- **Risk R5 — Sync-handoff outbox grows without bound.** FR-060
  enqueues; no flush exists in 008. Until the sync engine ships,
  the outbox grows monotonically. Plan-level review SHOULD
  consider whether a hard cap or an explicit "outbox is
  durable, growing, expected to be flushed by the future sync
  engine" support note is warranted.

---

*Constitution alignment.* This spec is authored against
`.specify/memory/constitution.md` v1.5.1. The plan and tasks
artifacts will perform the explicit "Constitution Check" against
both Roman-numeral Principles I–IX and Cross-Feature Principles
P1–P18. Principles most directly engaged: I (offline-first — the
sale is durable locally before any backend exists for it),
II / P1 (financial precision — integer minor units on the
receipt), IV (loud hardware failure — printer / drawer banners),
P2 (no fake success — sale durable before print / drawer), P3
(no silent data loss — finalize before any user-visible signal),
P4 (auditability + non-destructive correction — append-only Sale
row, reprints add events, never mutate), P5 (idempotency —
duplicate finalize is a no-op), P6 (no raw cardholder data on
receipts / logs), P7 (no secrets on receipts / logs — voucher
tokens, PINs, JWTs), P9 (truthful sync states — the staged
outbox is real durable state, not a visual-only promise), P10
(operator accountability — reprint attribution), P11
(supportability without leakage — eleven new audit events with
redaction discipline), P15 (production readiness — drawer
opens at real cash drawers), P17 (tenant isolation — every Sale
carries tenant_id), P18 (local durability before offline
promises — the sync-handoff outbox is the durable substrate the
future sync engine will consume).
