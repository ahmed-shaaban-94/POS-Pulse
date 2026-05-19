# Slice 0 — Visual Direction Contact Sheet

**Feature:** 006-payments-tender
**Slice:** Slice 0 (visual direction — non-code, FR-033 mandated)
**Task:** T010
**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Coordination:** [../coordination.md](../coordination.md)
**Bridge contract:** [../contracts/bridge-api.md](../contracts/bridge-api.md) (DRAFT)
**Created:** 2026-05-19
**Status:** DRAFT — awaiting T011 reviewer sign-off. §A1 gate not cleared.

> **T011 sign-off is pending.** This document is the T010 output only.
> No implementation slice (Slice 1+) may start until a reviewer signs
> T011 and §A1 clears. See §"Review record" below.

---

## 1. Impeccable shape method

`/impeccable shape` did not run locally; manual Impeccable shape
checklist was used because project-local Impeccable is not installed.

**Manual checklist applied:**

| Check | Result |
|:--|:--|
| Scene sentence (forces theme) | "A cashier on their feet at a pharmacy counter, under overhead fluorescent lighting, processing a payment after the cart is handed off — transaction is live, cash drawer is open." Forces: light theme only, opaque surfaces, money at high visual weight, error states persistent not toasted. |
| Color strategy | Restrained. Command Navy for primary action only; success green for settled; danger red for failure/refusal. No SaaS gradients, no decorative fills. |
| Register | Product (design serves the POS terminal workflow). |
| Visual hierarchy intent | Money total anchors the surface. Tender options are secondary. Actions (confirm, cancel) are tertiary until a tender covers the total. |
| Spacing rhythm | 4/8/12/16/24/32/48 px scale from 007/003. No half-step spacing. |
| Accessibility | WCAG 2.1 AA floor. Keyboard-only operable. 44 x 44 CSS px touch targets. Focus states visible on every interactive element. Color never the sole signal. |
| Anti-patterns avoided | No hero-metric cards. No gradient text. No glassmorphism. No dark mode. No SaaS dashboard KPI tiles. No side-stripe borders. No identical icon-heading-text card grids. No modal as first thought. |
| Image gate | Skipped: Claude Code has no native image generation. Visual direction is ASCII layout sketches and written direction per the 004 pattern. Screenshots are deferred to post-implementation evidence (see §13). |

---

## 2. Source of truth

Priority order (mirrors `contracts/visual-reference-adjudication.md`):

1. **Repo code and approved Spec Kit artifacts** win on any
   disagreement. Live `src/renderer/styles/tailwind.css`,
   `src/renderer/ui/tokens/`, `src/renderer/ui/primitives/`,
   `src/renderer/shell/`, and any approved artifact in `specs/`
   are authoritative.
2. **PRODUCT.md, DESIGN.md, `.impeccable/design.json`** — visual
   identity, token values, component patterns. Consulted for all
   decisions below where the repo is silent.
3. **007 visual system outputs** — `regression-checklist.md`,
   `contracts/visual-reference-adjudication.md`,
   `contracts/screenshot-acceptance.md`. Guard families from S1–S5
   apply to every surface 006 introduces.
4. **004 operator/session visual direction** —
   `specs/004-operator-session/visual-direction/README.md` and
   `specs/004-operator-session/planning/ui-pinpad-takeover-visual-direction.md`.
   Cross-cutting commitments (tokens, density, viewport, a11y,
   locale direction, connection-state visual) apply verbatim.
5. **003 POS shell contracts** —
   `specs/003-pos-ui-shell/contracts/shell-regions.md`,
   `shared-components.md`, `design-tokens.md`. Component
   primitives and shell regions are consumed, not re-authored.

**What this document does NOT do:**

- Does not copy generated mock code into production.
- Does not introduce new design tokens.
- Does not contradict any 003/004/007 locked decision.
- Does not implement React components, CSS, bridge handlers, or
  migrations.

---

## 3. Cross-cutting commitments (apply to every surface below)

These commitments are inherited from 003, 004, and the constitution.
The Slice 0 review walks them once, not per-surface.

### Tokens

- Reuse the existing 007 visual system token set verbatim.
- No new color, spacing, typography, radius, or shadow tokens
  introduced by 006.
- Money amounts: `font-family-mono` stack for tabular numeric
  treatment if already available in `tailwind.css`; otherwise
  `font-family-sans` weight-700 at display scale. Never introduce
  a new font or token for this purpose.
- Token values to use (from DESIGN.md): `--color-primary #1f4e7a`,
  `--color-success #1f8a5b`, `--color-danger #b32e36`,
  `--color-warning #b87600`, `--color-bg-base #fbfcfd`,
  `--color-surface #ffffff`, `--color-text #0f1d2e`.

### Density

- `comfortable` density only. No `compact` variant for any 006
  surface.
- Touch targets: 44 x 44 CSS px minimum on every interactive
  element (Constitution Hardware Matrix, NFR-005).

### Viewport

- Primary target: 1280 x 800 (expanded nav rail). All surfaces
  designed to this width.
- Secondary supported: 1024 x 768 (icon-only nav rail). Surfaces
  must accommodate this band.
- Below 1024 px: "screen too small" fallback from 003. 006 does
  not design a mobile checkout surface.

### Theme

- One polished light theme only. No `.dark` block, no
  `prefers-color-scheme` follower, no per-tenant theme switch.
  Pharmacy floor ambient lighting forces this (PRODUCT.md
  Anti-references).

### Connection-state visual

- 003's four-state indicator (`online` / `degraded` / `offline` /
  `syncing`) is rendered consistently. 006 introduces no new
  connection states.
- Offline cash + external_card_terminal paths are local-first per
  plan AD-6. The connection indicator transitions independently;
  the payment surface does not suppress it.

### Navigation rail visibility

- During payment: the navigation rail is **visible** (the payment
  surface mounts inside an authenticated operator session in the
  003 shell, not as a full-screen takeover). The rail shows the
  current operator's role indicator per 004 FR-020.
- The payment surface occupies the `MainContent` region only
  (003 `shell-regions.md`).

### Accessibility floor

- Every interactive element has a visible focus ring (003's
  `--focus-ring` token).
- Color is never the only signal: state changes carry icon + text
  alongside color.
- Tab order matches reading order. Reverse-tab cycles back.
- Each surface below names its keyboard path explicitly.
- axe-rule cleanliness on default state of every surface (verified
  in per-slice tests, not in this document).

### Locale direction

- Logical CSS properties only: `inline-start` / `inline-end`.
  No hard-coded `left` / `right`. Surfaces below are described
  as if LTR for clarity; rules apply symmetrically in RTL.

### Money display rules

- All amounts in minor units internally; displayed as major units
  with locale-appropriate decimal separator.
- No float arithmetic in display logic. Integer minor units only
  (Constitution P-II; spec NFR-001).
- `change_due` displayed only when `cash_received_minor -
  subtotal_minor > 0` and tender type is `cash`.
- `Number.isSafeInteger` guard is load-bearing; any display path
  that bypasses it is a visual defect.

---

## 4. Screen / state inventory

The payment surface has eleven distinct visual states across
three role contexts (cashier, manager observing, manager
force-failing). States are grouped by user story.

### State 1 — Tender selection (US1/US4/US5/US6 entry point)

**Trigger:** `payments.start` returns `{ kind: 'ok', ... }`;
PaymentAttempt FSM is in `started` state; renderer receives the
frozen `PaymentIntentEnvelope v1`.

**Purpose:** The cashier selects which tender type(s) to apply.
The cart summary confirms the amount; the cashier commits by
choosing a tender.

**Layout sketch (1280 x 800, default state):**

```
+------------------------------------------------------------+
| TopBar: IdentityStrip + ConnectionIndicator + OperatorSlot  |
+------------------------------------------------------------+
| NavRail | MainContent                                       |
|         | +------------------------------------------------+|
|         | | Payment                                        ||
|         | | Layla A. -- POS-03          125.50 SAR total  ||
|         | |                                                ||
|         | | Cart summary (collapsed / expandable)          ||
|         | | > 3 items -- 125.50 SAR           [v expand]  ||
|         | |                                                ||
|         | | How would you like to pay?                     ||
|         | |                                                ||
|         | | +---------------+ +---------------+           ||
|         | | |  Cash         | | Card terminal | [disabled]||
|         | | |  (tap to pay) | | (tap to pay)  |           ||
|         | | +---------------+ +---------------+           ||
|         | |                                                ||
|         | | +---------------+ +---------------+           ||
|         | | |  Voucher      | | Split tender  |           ||
|         | | |  [disabled]   | | (tap to pay)  |           ||
|         | | +---------------+ +---------------+           ||
|         | |                                                ||
|         | |                          [Cancel payment]     ||
|         | +------------------------------------------------+|
+---------+---------------------------------------------------+
```

**Visual rules:**

- Total amount (`subtotal_minor` rendered as major units) is the
  largest text element on the surface. Display scale (700 weight,
  1.875rem minimum) from DESIGN.md typography hierarchy.
- Tender options are buttons, not cards. Each meets 44 x 44 px
  floor. No identical card grid pattern.
- `internal_voucher` is always rendered; its disabled state uses
  50% opacity + `aria-disabled="true"` + "(not available)"
  sub-label. It is never hidden entirely (hiding would imply the
  feature does not exist; the disabled state correctly signals
  "reserved but not yet active").
- "Cancel payment" is a ghost button (low commitment). Positioned
  at the inline-end, below the tender options, not above them.
- The cart summary is collapsible to reduce visual noise during
  payment. Default: collapsed at 1280 x 800; expanded at 1024 x
  768 to aid reference.
- No shift totals, KPIs, drawer cash, or operator ID visible.

### State 2 — Cash entry (US1)

**Trigger:** Cashier taps "Cash" tender option.

**Purpose:** Cashier enters the amount received. Change due
calculates live. Confirm is the primary action.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment -- Cash                                   |
|         |                                                   |
|         | Cart total:  125.50 SAR                           |
|         |                                                   |
|         | Amount received                                   |
|         | +----------------------------------------------+  |
|         | |  SAR  [   150.00                          ]  |  |
|         | +----------------------------------------------+  |
|         |                                                   |
|         | Change due:   24.50 SAR                           |
|         | (shown only when received > total)                |
|         |                                                   |
|         | [  Confirm 150.00 received  ]  [  Back  ]         |
+------------------------------------------------------------+
```

**Visual rules:**

- `change_due` row appears only when `cash_received_minor >
  subtotal_minor`; it is absent (not zero-filled, not greyed)
  when not applicable.
- `change_due` amount uses the same money typography as
  `subtotal_minor`. Success green (`--color-success`) applied to
  the change-due value as a supplementary signal alongside the
  label text. Not color alone.
- The amount input is numeric, large (headline scale, 700 weight).
  No currency symbol inside the input; the currency code "SAR"
  is a static label at the input's inline-start.
- "Confirm" button is primary (Command Navy), disabled until
  `cash_received_minor >= subtotal_minor`. Disabled state: 50%
  opacity, `aria-disabled="true"`.
- "Back" returns to tender selection. Ghost button. No payment
  attempt is cancelled by going Back; the attempt remains in
  `started` state.
- Focus on mount: the amount input receives focus immediately.

### State 3 -- External card terminal entry (US4)

**Trigger:** Cashier taps "Card terminal" tender option.

**Purpose:** Record that a payment was processed on an external
card terminal. No card data is entered in POS-Pulse. The cashier
confirms the terminal processed the amount.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment -- Card terminal                          |
|         |                                                   |
|         | Cart total:  125.50 SAR                           |
|         |                                                   |
|         | Process 125.50 SAR on the card terminal,          |
|         | then confirm here.                                 |
|         |                                                   |
|         | Reference (optional, 6 chars max)                 |
|         | +----------------------------------------------+  |
|         | |  [                                        ]  |  |
|         | +----------------------------------------------+  |
|         |                                                   |
|         | [  Confirm terminal processed payment  ]  [Back]  |
+------------------------------------------------------------+
```

**Visual rules:**

- No card number, PAN, CVV, or expiry entry field of any kind.
  This is record-only (spec FR-007/FR-008; plan AD-8 Slices 1-3).
- The instructional copy ("Process ... on the card terminal, then
  confirm here") is the primary affordance. It must be prominent
  body text, not a footnote.
- Reference field: optional, `pattern=[A-Z0-9]{0,6}`. Rendered
  as uppercase; no auto-complete; no clipboard suggestions for
  card numbers. Placeholder copy: "e.g. T1A2B3". If entered,
  the reference is redacted in logs per plan AD-3 / OQ-PLAN-5.
- "Confirm" is primary. "Back" is ghost.
- Focus on mount: "Confirm" button receives focus (not the
  reference field, since it is optional and the primary action
  is confirmation, not data entry).

### State 4 -- Voucher reserved-disabled state (US5 disabled)

**Trigger:** Cashier taps the "Voucher" tender option (which is
in reserved-disabled state per plan AD-7 until Contract V-A
ships).

**Purpose:** Surface the voucher slot as "reserved but not yet
available" without implying it is permanently unavailable or
broken.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment -- Voucher                                |
|         |                                                   |
|         | Voucher payments are not available on this        |
|         | terminal yet.                                     |
|         |                                                   |
|         | Use cash or card terminal instead.                |
|         |                                                   |
|         |                                          [  Back ]|
+------------------------------------------------------------+
```

**Visual rules:**

- This is not an error state. No danger red. Use a neutral
  informational treatment (info-teal soft background
  `--color-info-soft`, info-teal border, info icon + text).
- The copy must not say "error", "unavailable", or "broken".
  Approved wording: "not available on this terminal yet" or
  "coming soon".
- "Back" returns to tender selection. Primary action, not ghost,
  because it is the only action here.
- No voucher code entry field, no voucher balance display, no
  voucher authority API call is made for this state.

### State 5 -- Split-tender progress indicator (US6)

**Trigger:** Cashier applies a first TenderLine (e.g. cash for
a partial amount) and the PaymentAttempt FSM transitions to
split-tender-in-progress: `Sigma applied TenderLine amounts <
envelope.subtotal_minor`.

**Purpose:** Show which tenders have been applied and how much
remains. The cashier adds more TenderLines until the total is
covered.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment -- Split tender                           |
|         |                                                   |
|         | Cart total:    125.50 SAR                         |
|         |                                                   |
|         | Applied tenders                                   |
|         | +-------------------------------------------------+|
|         | | Cash          50.00 SAR       applied     [rev]||
|         | +-------------------------------------------------+|
|         |                                                   |
|         | Remaining:     75.50 SAR                          |
|         |                                                   |
|         | Add another tender                                |
|         | +---------------+ +---------------+              ||
|         | | Cash          | | Card terminal |              ||
|         | +---------------+ +---------------+              ||
|         |                                                   |
|         | [Cancel all tenders]                              |
+------------------------------------------------------------+
```

**Visual rules:**

- Applied TenderLines list is a functional list, not a card grid.
  Each row: tender type label, amount applied, state badge
  ("applied"), and a [Reverse] action.
- `[Reverse]` is a ghost button; invoking it calls `tender.reverse`
  per bridge contract. Disabled while a reversal is in flight.
- "Remaining" amount uses the same money typography hierarchy as
  the total. It is NOT in success green until remaining = 0.
- "Add another tender" section shows the available (non-disabled)
  tender options, same as State 1 but contextually scoped to the
  remaining amount.
- "Cancel all tenders" is a ghost destructive-styled button at the
  bottom. Invokes LIFO reversal of all applied TenderLines per
  plan AD-4. This action has a confirmation step (see State 8).
- No decorative progress bar. The "Remaining" amount is the
  progress signal; a bar would add visual noise without clarity.

### State 6 -- Change-due display (US1 settled path)

**Trigger:** `payments.confirm` succeeds; PaymentAttempt FSM
transitions to `settled`; `change_due_minor > 0` (cash overpay).

**Purpose:** Clearly signal to the cashier how much change to
give. This is the highest-stakes moment for cash handling.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment settled                                   |
|         |                                                   |
|         | [checkmark icon]  Payment complete                |
|         |                                                   |
|         | Total paid:    125.50 SAR                         |
|         | Cash received: 150.00 SAR                         |
|         |                                                   |
|         | CHANGE DUE:    24.50 SAR  <-- largest element     |
|         |                                                   |
|         | [  Start new sale  ]                              |
+------------------------------------------------------------+
```

**Visual rules:**

- "CHANGE DUE" label + amount is the largest element on the
  settled surface. Display scale (700 weight). Success green
  (`--color-success`) on the amount value, accompanied by the
  label text (not color alone).
- If `change_due_minor == 0`, the change-due row is absent. The
  "Payment complete" heading is still shown; no "Change due: 0".
- The checkmark icon (from 003's icon set) accompanies the
  success heading. Icon + text + color together, never color
  alone (P14).
- "Start new sale" is the primary action button. It navigates
  the renderer back to the cart surface (005 post-settle path).
- No receipt generation on this surface (FR-043 — deferred to
  receipts spec). No receipt-related affordance is shown here.
- No financial summary beyond what was in the envelope. No
  shift-total inference. No drawer-cash display.

### State 7 -- Success state (no change due or card/split settled)

**Trigger:** `payments.confirm` succeeds; PaymentAttempt FSM
transitions to `settled`; `change_due_minor == 0` (exact cash,
card, or split tender fully covered the total).

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment settled                                   |
|         |                                                   |
|         | [checkmark icon]  Payment complete                |
|         |                                                   |
|         | Total:    125.50 SAR                              |
|         |                                                   |
|         | [  Start new sale  ]                              |
+------------------------------------------------------------+
```

**Visual rules:** Same as State 6 minus the change-due row.
Refer to State 6 for the full rule set.

### State 8 -- Cancel / return-to-tender-selection

**Trigger:** Cashier invokes "Cancel payment" from State 1, or
"Cancel all tenders" from State 5 (split tender in progress).

**Purpose:** Confirm the cancellation intent before rolling back
applied TenderLines and returning to tender selection.

**Layout sketch (inline confirmation, not modal):**

```
+------------------------------------------------------------+
| NavRail | Payment                                           |
|         |                                                   |
|         | Cancel this payment?                              |
|         |                                                   |
|         | All applied tenders will be reversed.             |
|         | (shown only when TenderLines exist)               |
|         |                                                   |
|         | [  Yes, cancel payment  ]  [  No, go back  ]      |
+------------------------------------------------------------+
```

**Visual rules:**

- Inline confirmation, not a modal dialog. A modal would be
  laziness here; the surface is already dedicated to the payment
  flow. The same `MainContent` region shows the confirmation
  prompt inline.
- "Yes, cancel payment" is a destructive-styled primary button
  (Alert Red, per DESIGN.md `button-destructive`). It is the
  primary action because cancellation is the intended path.
- "No, go back" is a secondary button, returning to the prior
  state.
- Copy "All applied tenders will be reversed." is shown only
  when at least one TenderLine is in `applied` state. If no
  TenderLines exist (cancel from State 1 before any tender was
  applied), the copy is omitted.
- On confirm: `payments.cancel` is called via bridge. LIFO
  reversal of applied TenderLines per plan AD-4. On success,
  renderer returns to the cart surface (005 post-cancel path
  via `cart.void`).
- Manager identity is NOT shown on this surface. Cancellation
  by a cashier is cashier-attributable; no manager attribution
  display.

### State 9 -- Generic failure / refusal

**Trigger:** Any bridge refusal from `payments.*` or `tender.*`
handlers; PaymentAttempt FSM in `failed` state; OR a payment
action refused with `{ kind: 'refused', reason: '...' }`.

**Purpose:** Surface the failure state without leaking
bridge-internal reason strings to the cashier.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment                                           |
|         |                                                   |
|         | [alert icon]  This payment could not complete.    |
|         |                                                   |
|         | Please try again or contact your manager.         |
|         |                                                   |
|         | [  Try again  ]  [  Cancel payment  ]             |
+------------------------------------------------------------+
```

**Visual rules:**

- Generic copy only. The bridge `reason` string is logged
  server-side for diagnostics; it is NEVER displayed verbatim
  to the cashier. Approved wording: "This payment could not
  complete." No further detail.
- Alert icon (from 003's icon set) + text + danger-red (`--
  color-danger`) on the heading, accompanied by the text label.
  Not color alone.
- "Try again" is primary (Command Navy). Navigates back to
  State 1 (tender selection) with the same envelope still bound.
- "Cancel payment" is ghost destructive. Leads to State 8
  (cancel confirmation).
- If the failure was `cart_lost` or `stale_handoff`, the
  "Try again" button is replaced with "Return to cart" (the
  envelope is no longer valid; starting a new payment requires
  a new handoff from 005).
- No manager identity visible on the cashier-facing failure
  surface.

### State 10 -- Deferred-reversal pending indicator

**Trigger:** A TenderLine for `internal_voucher` transitions to
`reversal_pending` (Slice 4 only; voucher authority confirmed
payment but reversal is in-flight with Data-Pulse-2). This state
is specified here for visual completeness; it is not implemented
until Slice 4.

**Layout sketch:**

```
+------------------------------------------------------------+
| NavRail | Payment                                           |
|         |                                                   |
|         | Applied tenders                                   |
|         | +------------------------------------------------+|
|         | | Voucher  50.00 SAR  [reversal pending...]  [!] ||
|         | +------------------------------------------------+|
|         |                                                   |
|         | Remaining:    75.50 SAR                           |
|         |                                                   |
|         | [Contact manager]                                 |
+------------------------------------------------------------+
```

**Visual rules:**

- `reversal_pending` state badge: caution amber (`--color-
  warning`), with the label "reversal pending" as text and a
  caution icon. Not color alone.
- The cashier cannot proceed with the payment while a reversal
  is pending. The "Add another tender" section is hidden.
- "Contact manager" is the only action (ghost button). It does
  not trigger an automated flow; it opens a short informational
  tooltip: "A manager will need to resolve this reversal."
- The pending indicator is non-dismissable. It resolves only
  when the bridge pushes a state update (reversal resolved or
  reversal confirmed failed).
- Manager identity is NOT shown on the cashier-facing surface.

### State 11 -- Manager / admin force-fail incident-response surface

**Trigger:** A manager or admin invokes force-fail on a stuck
payment attempt (Slice 4; `payments.forceFail` bridge handler).
This surface is manager/admin-only; cashiers do not see it.

**Visibility:** The force-fail surface is reachable only when
the operator's role is `manager` or `admin` (bridge enforces
`requireOperatorSession({ role: 'manager' | 'admin' })` per
bridge-api.md). The cashier-facing surface is State 9 (generic
failure), not this surface.

**Layout sketch (modal on the manager's payment view):**

```
         +------------------------------------------+
         |                                          |
         | Force-fail payment                       |
         | -----------------                        |
         |                                          |
         | Attempt:  [attempt ID, truncated]        |
         | Cashier:  [display name only]            |
         | Amount:   125.50 SAR                     |
         |                                          |
         | Why is this payment being force-failed?  |
         | +--------------------------------------+ |
         | | (o) Technical failure                | |
         | | ( ) Fraud suspicion                  | |
         | | ( ) Cashier error                    | |
         | | ( ) Other                            | |
         | +--------------------------------------+ |
         |                                          |
         | Notes (optional):                        |
         | +--------------------------------------+ |
         | |                                      | |
         | +--------------------------------------+ |
         |                                          |
         | [ Force-fail payment ]  [ Cancel ]       |
         |                                          |
         +------------------------------------------+
```

**Visual rules:**

- Modal (003's `Dialog` primitive). Appropriate here because
  force-fail is a high-stakes, manager-attributable irreversible
  action; a modal correctly captures attention and raises the
  commit barrier.
- Read-only summary: truncated attempt ID (not the full UUID),
  cashier display name (not email/phone/role hierarchy), amount.
- Reason picker: `RadioGroup` from 003. Categories are a closed
  set per spec (plan AD-5 / Slice 4 scope); no free-text reason.
- Notes textarea: optional. Copy: "Notes (optional):" -- no
  further instruction. Max 500 chars. Separate from the
  structured reason.
- "Force-fail payment" is the primary button (destructive: Alert
  Red per DESIGN.md `button-destructive`). Disabled until a
  reason is selected.
- "Cancel" is secondary. Closes the modal; the payment attempt
  remains in its prior state.
- The cashier's name appears only as a display name. No email,
  no phone, no Clerk user ID, no operator_session_id, no shift
  total, no drawer impact shown.
- The manager's identity is NOT echoed back on the modal surface
  (the manager knows who they are; displaying "You are
  force-failing as Mariam S." is redundant and could be read
  by a bystander).
- This surface is entirely Slice 4 scope. Specifying it here
  ensures Slice 4 implementers have a locked visual contract.

---

## 5. Visual target

The payment surface is a **calm, terminal-first payment flow**.
The operator is under time pressure; every visual element must
earn its place.

| Principle | Implementation |
|:--|:--|
| Calm terminal-first POS | Light theme, opaque surfaces, high-contrast money typography, no decorative elements competing with financial data. |
| High-confidence payment flow | The current state is always unambiguous. No spinner-only states without a text label. No "loading..." without a timeout path. |
| Clear money hierarchy | `subtotal_minor` and `change_due_minor` are the largest typographic elements. Supporting amounts (per-line, per-tender) are secondary. |
| No dashboard/KPI/report styling | No metric-hero cards, no big-number-with-gradient-accent treatment, no KPI tiles. |
| No decorative over-animation | State transitions (tender applied, payment settled) confirm with a brief opacity/scale transition only. No bounce, no elastic, no extended fade. `prefers-reduced-motion: reduce` disables all transitions. |
| No generic SaaS gradients | No `background: linear-gradient(...)` on any surface. Command Navy is a solid fill only. |
| No sensitive data leakage | Bridge `reason` strings never displayed verbatim. No PAN/CVV input. No raw voucher payload before V-A contract. No manager identity on cashier-visible surfaces. |

---

## 6. Layout and hierarchy

### Workspace placement

The payment surface occupies `MainContent` (003 `shell-regions.md`).
The nav rail, top bar, and operator slot remain mounted. The
payment surface does NOT full-screen-takeover the shell (unlike a
hypothetical PIN entry overlay); it behaves as a standard route
within the shell.

### Tender selection layout

Tender options are arranged in a 2-column button grid. At
1280 x 800: two options per row, 16 px gap. At 1024 x 768:
two options per row with narrower button width. The layout is
never a card grid with icon + heading + text paragraphs; it is
a button grid with a type label and sub-label only.

### Payment summary placement

The cart summary (expandable, collapsed by default) and the
total amount are at the top of `MainContent`, above the tender
selection or entry surface. The cashier sees the amount before
committing to a tender, not after.

### Primary / secondary action hierarchy

| Context | Primary | Secondary | Destructive |
|:--|:--|:--|:--|
| Tender selection | None (picking a tender is not a button) | -- | "Cancel payment" (ghost, low) |
| Cash entry | "Confirm" | "Back" (ghost) | -- |
| Card terminal entry | "Confirm" | "Back" (ghost) | -- |
| Split progress | None during tender selection | -- | "Cancel all tenders" (ghost destructive) |
| Cancel confirmation | "Yes, cancel payment" | "No, go back" | -- |
| Settled (no change) | "Start new sale" | -- | -- |
| Settled (change due) | "Start new sale" | -- | -- |
| Failure | "Try again" | "Cancel payment" (ghost) | -- |
| Force-fail (manager) | "Force-fail payment" (destructive) | "Cancel" (secondary) | -- |

The Single Primary Rule (DESIGN.md) applies: no more than one
primary-intent button visible at once.

### Amount and change-due hierarchy

1. `subtotal_minor` (cart total) -- display scale, 700 weight.
2. `change_due_minor` (on settled cash path) -- display scale,
   700 weight, success green supplementary.
3. `cash_received_minor` (during entry) -- headline scale.
4. Per-TenderLine amounts -- title scale.
5. Supporting labels -- label scale (12px, 600 weight).

### Cashier vs manager / admin separation

- Cashier-reachable surfaces (States 1-10): no manager-only
  information. Role indicator in the operator slot confirms
  the current session. No force-fail affordance visible.
- Manager/admin surfaces (State 11): accessible only when
  the bridge session role is `manager` or `admin`. The modal
  opens within the manager's authenticated shell session.
- The payment surface does not infer the operator's role from
  renderer-side logic; the bridge gate is authoritative.

---

## 7. Tokens, spacing, and typography

### Tokens

Reuse the existing 007 visual system. No new token system.
Specific tokens for the payment surface:

| Element | Token |
|:--|:--|
| Payment surface background | `--color-bg-base` (#fbfcfd) |
| Card summary region | `--color-surface` (#ffffff) |
| Cart summary collapsed background | `--color-surface-elevated` (#f3f6fa) |
| Total amount text | `--color-text` (#0f1d2e), display scale |
| Change due text | `--color-success` (#1f8a5b), display scale |
| Failure heading | `--color-danger` (#b32e36), headline scale |
| Tender option button (default) | `button-secondary` component |
| Tender option button (selected) | `button-primary` component |
| Voucher disabled | 50% opacity on `button-secondary` |
| Primary action | `button-primary` (Command Navy) |
| Destructive action | `button-destructive` (Alert Red) |
| Ghost action | `button-ghost` |
| Focus ring | `--focus-ring` token from 003 |

### Spacing rhythm

4 / 8 / 12 / 16 / 24 / 32 / 48 px scale only. No half-step
spacing. Recommended: 24 px between major sections
(total / tender selection / actions), 16 px between tender
option buttons, 8 px between label and value pairs.

### Typography

Money amounts (total, change due, amounts received) use
weight-700 at display (30px) or headline (24px) scale per
DESIGN.md hierarchy. Tabular numeric treatment (mono font
stack, if already available via `--font-family-mono`) is
preferred for money values so digits align across multiple
TenderLine rows. If not yet available, weight-700 sans is
acceptable without introducing a new token.

### Touch targets

All tender option buttons, confirm buttons, reverse buttons,
and force-fail form controls: 44 x 44 CSS px minimum.
Enforced by the same CI invariant test as other features.

### Focus states

Visible focus rings on every interactive element using
003's `--focus-ring` token. Focus on mount per surface is
named in the screen inventory above.

---

## 8. Proposed BEM / className hooks (definition only)

These hooks define the seam between visual direction and
implementation. They are not implemented in this PR. The
implementing tasks in Slice 1+ assign these class names to
the relevant React components and CSS modules.

| Hook | Applies to |
|:--|:--|
| `payment-surface` | The root `<main>`-child wrapper for the entire payment flow |
| `tender-selection` | The tender-option grid container |
| `tender-option` | Each individual tender button (cash / card / voucher / split) |
| `payment-cart-summary` | The expandable cart summary region |
| `cash-entry` | The cash amount entry sub-surface |
| `external-card-terminal-entry` | The card terminal record-only sub-surface |
| `voucher-reserved` | The voucher reserved-disabled informational state |
| `split-tender-progress` | The split-tender applied-tenders list + remaining indicator |
| `change-due` | The change-due amount display on the settled surface |
| `payment-result` | The settled / payment-complete state wrapper |
| `payment-refusal` | The generic failure / refusal state wrapper |
| `reversal-pending` | The deferred-reversal pending indicator on a TenderLine row |
| `force-fail-surface` | The manager/admin force-fail modal content wrapper |

---

## 9. Responsive behavior

### Primary viewport: 1280 x 800

Expanded nav rail (248 px). `MainContent` width: approximately
1032 px. Tender option grid: 2 columns, 16 px gap. Cart summary
collapsed. All surfaces designed to this width.

### Minimum supported viewport: 1024 x 768

Icon-only nav rail (84 px). `MainContent` width: approximately
940 px. Tender option grid: 2 columns, narrower buttons. Cart
summary expanded by default to aid reference (cashier needs to
see line items). Amount typography scales down one step (headline
instead of display).

### Below 1024 px

003's "screen too small" fallback. 006 does not design a mobile
checkout surface, a mobile tender selection, or any
below-1024 layout. The payment surface is a pharmacy terminal
surface, not a consumer checkout.

### No consumer / mobile checkout redesign

This is not a point-of-sale web app for a consumer device. No
hamburger menu, no mobile-drawer nav, no compact stacked layout
optimised for a phone. Any implementation that introduces these
patterns is out of scope.

---

## 10. Accessibility and keyboard

### Keyboard-only operation

Every action in every state must be reachable and executable
with keyboard only (Tab, Shift-Tab, Enter, Space, Escape,
arrow keys where applicable). No mouse-only flows.

### Focus order

1. On payment surface mount: focus on the first tender option
   button (State 1).
2. On tender option selected (State 2/3): focus on the primary
   input (amount field for cash; confirm button for card
   terminal).
3. On split tender add: focus on the first available tender
   option in the "Add another tender" section.
4. On cancel confirmation (State 8): focus on "No, go back"
   by default (the conservative option receives initial focus;
   the destructive action requires explicit tab navigation).
5. On settled (States 6/7): focus on "Start new sale".
6. On failure (State 9): focus on "Try again".
7. Force-fail modal (State 11): focus on the first radio option
   on mount. Tab cycles: radio group, notes textarea, Force-fail
   button, Cancel button, close (x). Escape cancels.

### Focus on mount

Named per surface in the screen inventory above. Implementation
tasks must honour `autoFocus` or `ref.focus()` on mount for
every state transition.

### Visible focus indicators

003's `--focus-ring` token on every interactive element. Focus
ring is 3 px minimum width, visually distinct from hover state.
Never `outline: none` without a custom replacement.

### Landmarks

- `<main>` wraps `MainContent` (003 shell).
- `<section aria-label="Tender selection">` wraps the tender
  option grid.
- `<section aria-label="Payment summary">` wraps the cart
  total and expandable summary.
- `<dialog>` (003's `Dialog` primitive) wraps the force-fail
  modal (State 11). Focus is trapped inside the dialog.

### Status regions

- `aria-live="polite"` on the change-due amount region: updates
  when `cash_received_minor` changes so screen reader announces
  the new change-due without interrupting current focus.
- `aria-live="assertive"` on the failure state heading: payment
  failures require immediate announcement.
- `aria-disabled="true"` on disabled tender options (voucher),
  confirm buttons below threshold, and the PIN pad in locked
  states.

### Non-color cues

Every state that uses color to communicate (success green on
change-due, danger red on failure, amber on reversal-pending)
also uses an icon from 003's icon set and a text label. Color
is supplementary, never the sole signal (P14 / PRODUCT.md
Accessibility and Inclusion).

---

## 11. Sensitive information boundaries

The renderer must not receive or display:

| Category | Rule |
|:--|:--|
| Clerk JWT | Never in renderer. Bridge enforces this. |
| `device_token`, `device_token_attestation` | Never in renderer. |
| PINs, PIN hashes, passwords, credentials | Never in renderer. |
| Raw sensitive bridge payloads | Never displayed; logged server-side only. |
| Sensitive IDs (unless an approved bridge contract explicitly allows) | Operator session ID, `cashier_id`, Clerk user ID: logged internally; never displayed in the payment surface UI. |
| Cardholder data (PAN, CVV, expiry, full card number) | Absolutely forbidden. 006 is record-only for card terminal; no card data entry field exists. |
| Raw voucher authority payload | Not before Contract V-A ships. The disabled voucher state shows no voucher data at all. |
| Raw bridge `reason` strings | Never displayed verbatim to cashiers. The bridge `reason` is for diagnostic logging only; the renderer translates each reason to a generic "this action isn't allowed right now" UX. |
| Manager identity on cashier-visible surfaces | The manager who performs a force-fail is NOT shown on the cashier's failure surface. The force-fail audit event records the manager; the cashier sees only State 9 (generic failure). |
| Other operators' data | Cashier-facing surfaces show only the current operator's display name (in the operator slot from 004/003). |

---

## 12. Variant acceptance criteria

For each state, the reviewer walks these checks before T011
sign-off.

| State | Hierarchy check | Copy clarity | Focus behavior | Role boundary | Sensitive-data absence | Screenshot |
|:--|:--|:--|:--|:--|:--|:--|
| 1 Tender selection | Total is largest element; tender options secondary; cancel low-emphasis | "How would you like to pay?" is unambiguous; voucher "(not available)" is clear | First tender option focused on mount | Voucher disabled state visible to cashier is informational only; no authority data | No bridge reason, no PAN, no JWT, no session ID displayed | Required post-implementation |
| 2 Cash entry | Amount input is prominent; change-due appears only when earned | "Amount received" label unambiguous; "Confirm" disabled copy clear | Amount input focused on mount | Cashier only; no manager attribution visible | No cardholder field exists | Required |
| 3 Card terminal | Instructional copy is the primary element; reference field is secondary | "Process ... then confirm here" is unambiguous | Confirm button focused on mount | Record-only; no PAN entry; no gateway integration | No card number field; reference field is 6-char max and redacted in logs | Required |
| 4 Voucher disabled | Informational treatment (info-teal), not error | "not available on this terminal yet" -- no "error" or "broken" | Back button focused on mount | Cashier-facing; no voucher authority data shown | No voucher code, no balance, no V-A payload | Required |
| 5 Split progress | Remaining amount is prominent; applied TenderLines list is readable | Tender type labels and amounts unambiguous; "Reverse" action clear | First available tender option in "Add" section, or first applied tender row | Cashier only; no manager attribution | No bridge reason strings; applied amounts are cashier-visible correct amounts | Required |
| 6 Change due | Change-due is the largest element; total and received secondary | "CHANGE DUE" label unambiguous; no "0.00" when not applicable | Start new sale focused | Cashier only | No shift total, no drawer cash, no KPI | Required |
| 7 Success (no change) | "Payment complete" clear; total confirmed | Copy unambiguous | Start new sale focused | Cashier only | No shift total, no financial summary beyond envelope total | Required |
| 8 Cancel confirm | Destructive primary correctly styled; conservative secondary present | "Yes, cancel payment" / "No, go back" unambiguous | "No, go back" focused on mount (conservative default) | Cashier only; no manager attribution on cashier-cancel | No manager identity; no bridge reason | Required |
| 9 Failure/refusal | Alert icon + text + color; no raw error string | "This payment could not complete." -- generic, no diagnosis | "Try again" focused | Cashier only; no manager identity | No bridge `reason` string displayed; no session ID | Required |
| 10 Reversal pending | Caution amber + icon + text; non-dismissable | "reversal pending" label unambiguous; "Contact manager" action clear | Contact manager button focused | Cashier only; no manager identity on cashier surface | No raw reversal payload; no voucher authority data | Required (Slice 4) |
| 11 Force-fail (manager) | Destructive primary disabled until reason selected; secondary present | "Force-fail payment" unambiguous; reason options match spec closed set | First radio option focused on mount | Manager/admin only; bridge gate enforces this; cashier cannot reach this state | No cashier email/phone; no Clerk user ID; no session token; no shift total; no drawer impact shown | Required (Slice 4) |

---

## 13. Screenshot acceptance plan

### No screenshots in this PR

No PNG, JPG, ZIP, or PDF is committed by this PR. Binary
design files are not committed per 007 `screenshot-acceptance.md`
and the `visual-reference-adjudication.md` auditor checklist.

### Future screenshots stored out-of-tree

Post-implementation screenshots attach to the implementing
slice's PR description via GitHub's upload surface. They are
stored locally on the reviewer's machine for the review window
and referenced by name and count in the PR body.

### Required viewports

Per `007/contracts/screenshot-acceptance.md` §"Viewport matrix":

| Viewport | Required for |
|:--|:--|
| 1280 x 800 | All states (primary cashier monitor) |
| 1024 x 768 | All states (secondary supported viewport) |

### Required state coverage

Screenshots must cover every state in §4:

- Tender selection (State 1)
- Cash entry (State 2)
- External card terminal entry (State 3)
- Voucher disabled (State 4)
- Split-tender progress with at least one applied TenderLine (State 5)
- Success with change due (State 6)
- Success without change due (State 7)
- Cancel confirmation (State 8)
- Generic failure / refusal (State 9)
- Reversal pending indicator (State 10) -- Slice 4 scope
- Manager force-fail modal (State 11) -- Slice 4 scope

### Forbidden content in screenshots

Per `007/contracts/screenshot-acceptance.md` §"Forbidden content":

- No PII beyond cashier display name (first name + last initial).
- No Clerk JWT, `device_token`, session token, API key.
- No PIN, PIN hash, or credential fragment.
- No raw cardholder data.
- No raw bridge `reason` or error payload.
- No shift totals, expected drawer cash, shortage, overage,
  variance, KPIs, audit log surfaces, or other operators' data.
- No emoji.
- No mockup-only artifacts ("Lorem ipsum", "TODO", "FIXME").
- No `POS-` terminal label prefix in TakeoverPrompt subtree
  (if the takeover prompt is shown during payment -- unlikely,
  but the forbidden-string rule applies globally).

### Reduced-motion variant

Every state that contains animation (confirm spinner, settled
transition, reversal-pending pulse indicator) requires an
additional screenshot with `prefers-reduced-motion: reduce`,
per `007/contracts/screenshot-acceptance.md` §"Per-surface
state matrix".

---

## 14. Review checklist

The reviewer walks this checklist for T011 sign-off:

- [ ] T010 output is present and complete (this document).
- [ ] Every state in §4 is covered with layout sketch, visual
      rules, and acceptance criteria.
- [ ] No implementation code has been committed (no React
      components, CSS, tokens, bridge handlers, migrations,
      test files, package changes).
- [ ] No screenshots or binary assets committed.
- [ ] No new design tokens introduced (all tokens reference
      the existing 007/003 system).
- [ ] Sensitive-data boundaries in §11 are correctly stated
      and do not contradict 003/004/007 locked decisions.
- [ ] BEM/className hooks in §8 are definitions only; no
      implementation implied.
- [ ] Cross-cutting commitments in §3 align with 004's
      visual direction README and 003's shell contracts.
- [ ] No visual-system drift (no `.dark` block references,
      no glassmorphism, no gradient text, no SaaS metric-hero
      patterns, no side-stripe borders, no identical card grids).
- [ ] T011 sign-off pending: reviewer signs below with date,
      result (approved / approved-with-revisions / rejected),
      and any findings. Slice 1 implementation MUST NOT start
      until this record is signed and §A1 clears.

---

## Review record

**T011 — Slice 0 visual direction review**

| Field | Value |
|:--|:--|
| Reviewer | TBD -- owner assignment required (see coordination.md T004) |
| Date | TBD |
| Result | TBD |
| Findings | TBD |

**Slice 1 implementation is blocked until this record is signed
and §A1 (feature-flag implementation + bridge security review
prerequisites) is satisfied.**

```
Signed-off-by: [reviewer name]             Date: [YYYY-MM-DD]
Result:        [approved | approved-with-revisions | rejected]
Findings:      [notes or "none"]
Next gate:     Slice 1 may begin after §A1 clears
```
