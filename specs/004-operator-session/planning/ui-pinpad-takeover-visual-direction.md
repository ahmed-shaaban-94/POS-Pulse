# Planning — #86 PinPad + TakeoverPrompt UI Visual Direction

**Status:** Planning only. No implementation.
**Issue:** [#86 — 004 S4 — PinPad and TakeoverPrompt UI activation](https://github.com/ahmed-shaaban-94/POS-Pulse/issues/86)
**Branch base:** `main` (HEAD `e9c0b0e`; PR #94 merged — main-process cashier sign-in handler is in place)
**Spec:** [../spec.md](../spec.md) — FR-006, FR-013, FR-020, FR-033, FR-034, FR-035, NFR-003, NFR-005
**Plan:** [../plan.md](../plan.md) (v1.1) — Slice 0 deliverables, AD-1, AD-2, S4 slice scope
**Visual direction (Slice 0, approved-with-revisions):** [../visual-direction/README.md](../visual-direction/README.md)
**Tasks referenced:** T060, T074, T075, T076, T077 (and T070b prerequisite for cashier-roster path)

> **Defer to Slice 0 visual-direction review for canonical visual rules.**
> This file enumerates the activation work and screenshot acceptance criteria
> that #86 must clear before implementation may merge. It does NOT re-derive
> any visual rule that the Slice 0 contact sheet already locked.

---

## 1. Scope

### Components #86 will activate

- `src/renderer/ui/operator/PinPad.tsx` (NEW — does not exist yet on `main`)
- `src/renderer/ui/operator/TakeoverPrompt.tsx` (NEW — does not exist yet on `main`)
- Activation diff to `src/renderer/routes/sign-in.tsx` to flip the cashier
  branch from inert to interactive (currently renders `<RosterList cashiers={[]} inert />`).
- A small renderer wiring task in `src/renderer/stores/operator-session-store.ts`
  if a `takeoverPrompt` branch needs additional fields beyond the existing
  shape — see §11 below; the FSM already exposes `kind: 'takeoverPrompt'`,
  so this may reduce to no store change.

### Out of scope (explicit non-goals)

- Backend OpenAPI changes (`§A2` is the gate for those; #86 is renderer-only).
- PIN verifier internals (`src/main/operator/pin-credential.ts`,
  `pin-lockout.ts`, `pin-seal.ts` already merged via PR #94).
- Sales / cart / payments / reports / shift logic.
- Forced-close manager surface (Surface 4 — owned by S5 / a later issue).
- Role-indicator dropdown wiring (Surface 5 — already partly merged via
  `OperatorBadge`; outside #86's scope).
- New design tokens, new connection-state visuals, new modal primitives.
- Cashier-self-service "I forgot my PIN" flow (Hard Non-Implementation
  Boundary in plan.md).
- Note 2 (S4 nav-rail count badge): out-of-scope here — #86 is not the
  navigation-rail issue. Note 3 (S5 forced-close card-stack default):
  out-of-scope here — owned by S5 / #87.

---

## 2. Screen inventory

Every screen state #86's UI must support, with the route / surface combination
they appear in. Every state below maps to at least one screenshot in §7.

| # | Surface | State | Trigger | Notes |
|:-:|:--|:--|:--|:--|
| 1 | `/sign-in` (cashier mode) | `default` | Route mounted, no roster pick | PinPad rendered but disabled / muted; focus on first roster card. |
| 2 | `/sign-in` (cashier mode) | `roster-picked` | A cashier card selected | Selected card receives accent border + check; PinPad becomes enabled; focus auto-advances to first PIN digit. |
| 3 | `/sign-in` (cashier mode) | `pin-entering` | ≥ 1 digit typed | PIN dots fill progressively; Enter `aria-disabled` until ≥ 4 digits; Enter active at 4–6. |
| 4 | `/sign-in` (cashier mode) | `submitting` | Enter pressed; bridge call in flight | PinPad non-interactive; spinner replaces the alert space (Note 1 — never alongside an alert). |
| 5 | `/sign-in` (cashier mode) | `failure (variant A)` | Bridge returned `OperatorRefusal { category: 'invalid_input' }` | Inline alert "Credentials not recognised. Please try again." Auto-dismisses on first new keystroke (Note 1). |
| 6 | `/sign-in` (cashier mode) | `failure (variant B — rate-limited / PR-3)` | Bridge returned `OperatorRefusal { category: 'rate_limited' }` | "Too many attempts. Please wait a moment before trying again." PinPad keys greyed; roster cards non-interactive; no countdown timer. |
| 7 | `/sign-in` (cashier mode) | `failure (variant C — no connection)` | Bridge returned `OperatorRefusal { category: 'no_connection' }` | "No connection. Please check the network and try again." Connection-state badge transitions to `offline`. |
| 8 | TakeoverPrompt modal | `prompted` | Cashier or manager/admin sign-in returned `TakeoverRequiredResponse` | Three buttons: Continue here / Cancel / generic close (✕). Initial focus on Cancel (minimum-disclosure prudence — see §5). Rail visible behind dimmed scrim. |
| 9 | TakeoverPrompt modal | `confirming` | "Continue here" pressed; `operator.confirmTakeover` in flight | Continue-here button shows spinner; both buttons non-interactive; modal stays open until call resolves. |
| 10 | TakeoverPrompt modal | `error` | `confirmTakeover` returned generic refusal (`no_connection`, `state_invalid`, `invalid_input`) | Modal stays open; inline error region between body copy and buttons; same generic copy as Surface 6 variant A or C. The renderer falls back to the sign-in surface only on Cancel/✕/Escape. |
| — | `/sign-in` (manager/admin mode) | unchanged | — | Documented to anchor the cohesion check. #86 MUST NOT regress the manager/admin form already merged in S1. |

---

## 3. Visual direction (re-stated, not re-derived)

The rules below are inherited verbatim from
[../visual-direction/README.md](../visual-direction/README.md). #86 honours
them; the Slice 0 reviewer-approved cross-cutting block in that document is
the canonical source. This list is a checklist for the #86 reviewer.

- **Density:** `comfortable` only; no `compact` variant introduced
  (visual-direction §"Density"; 003 plan §"Density model").
- **Touch-target floor:** every interactive element ≥ 44 × 44 CSS px
  (NFR-005 / 003 NFR-5 / Constitution Hardware Matrix).
- **PIN pad layout:** 3-column digit grid `1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 ↵`.
  Digits use 003's `text-2xl` weight 600 (visual-direction §"Surface 1 —
  Tokens").
- **Enter (`↵`) submit:** disabled visually AND `aria-disabled="true"` below
  4 digits (T060 acceptance + visual-direction §"Surface 1 — Numeric pad").
- **Hardware keyboard parity:** `0`–`9` digits accepted; `Backspace`
  deletes the last digit; `Enter` submits when valid; Tab cycles back into
  the roster (visual-direction §"Surface 1 — Numeric pad").
- **Auto-advance focus:** roster pick transitions focus to the PinPad's
  first digit; reverse-tab returns to the roster (visual-direction
  §"Surface 1 — Keyboard / touch path").
- **No new design tokens.** Colors, spacing, typography, radius, shadow all
  come from 003's `@theme` block. Variant-A error uses 003's
  `InlineAlert` `error`; variant-C uses `warning`.
- **Connection-state visual:** 003's four-state badge in the top-right.
  No new states (visual-direction §"Cross-cutting commitments").
- **Modal scrim & primitive:** TakeoverPrompt uses 003's `Dialog` primitive
  with 003's standard scrim opacity (visual-direction §"Surface 3").
- **Locale direction:** logical CSS properties (`inline-start` /
  `inline-end`) only.

---

## 4. Component plan (contracts and decisions only — no production code)

### 4.1 `src/renderer/ui/operator/PinPad.tsx`

- **Module placement:** beside `RosterList.tsx`,
  `ManagerAdminSignInForm.tsx`, `OperatorBadge.tsx` (existing operator UI
  module).
- **Ownership model:** **controlled** component — parent owns the `value`
  string and is the source of truth. PinPad is presentational + accepts
  hardware/touch input.
- **Props:**
  - `value: string` — current PIN buffer (digits only, length 0–6).
  - `onChange(next: string): void` — parent updates buffer; PinPad never
    persists state internally beyond presentational refs.
  - `onSubmit(): void` — invoked when Enter is pressed AND
    `value.length >= 4 && value.length <= maxLength`.
  - `disabled?: boolean` — true during `submitting` and `locked-out`
    states; suppresses all input (touch, keyboard, hardware).
  - `maxLength?: 4 | 5 | 6` — defaults to 6 (FR-006). Below
    `maxLength`, additional digit input appends; at `maxLength`, additional
    digit input is ignored (no overflow).
- **Accessibility:**
  - Root element `role="group"` with `aria-label="PIN pad"`.
  - Digit keys are `<button type="button">` with `aria-label` per digit
    (e.g. "Digit 1"). The whole grid lives inside the group.
  - Backspace key `aria-label="Delete last digit"`.
  - Enter key labelled `aria-label="Submit PIN"`. When
    `value.length < 4` → `aria-disabled="true"` AND visually muted.
  - PIN dots region uses `aria-live="off"` (do NOT announce digit count
    transcribed — PR-1 minimum-disclosure; the dot region is purely
    visual).
  - Focus ring visible on every key (003's `--focus-ring`).
- **Keyboard handling (the parity rule):**
  - Mounted with a single `keydown` listener on the group root (or on
    the document via React effect) that:
    - `0`–`9` → `onChange(value + digit)` if `!disabled` and
      `value.length < maxLength`.
    - `Backspace` → `onChange(value.slice(0, -1))`.
    - `Enter` → `onSubmit()` if `value.length >= 4 && !disabled`.
    - All other keys: pass through (Tab to leave the group, Shift+Tab to
      reverse-tab into the roster).
- **Render contract:**
  - Dot row: 4 dots minimum, additional dots appear up to `maxLength` as
    digits are typed; never exceeds `maxLength`. Dots are bullets, never
    digits — PR-1 forbids any plaintext rendering of the PIN value.
  - Digit grid: 3 columns × 4 rows = 12 keys; bottom row is `⌫ 0 ↵`.
- **className convention:** state-driven, mirrors the `RosterList` /
  `ManagerAdminSignInForm` pattern (`pin-pad`,
  `pin-pad__dots`, `pin-pad__grid`, `pin-pad__key`,
  `pin-pad__key--digit`, `pin-pad__key--backspace`,
  `pin-pad__key--enter`, plus `data-state="default|entering|submitting|disabled"`,
  `data-testid="pin-pad"`).

### 4.2 `src/renderer/ui/operator/TakeoverPrompt.tsx`

- **Module placement:** beside `PinPad.tsx` in the same directory.
- **Ownership model:** stateless modal; parent (sign-in route) owns `open`
  and the call to `confirmTakeover` / `cancelTakeover`.
- **Props:**
  - `open: boolean` — when `false`, returns `null` (no DOM).
  - `onConfirm(): void` — invoked on "Continue here" press.
  - `onCancel(): void` — invoked on "Cancel" / "✕" / `Escape`.
  - `inFlight?: boolean` — when `true`, both buttons non-interactive;
    Continue-here shows spinner.
  - `error?: 'no_connection' | 'invalid_input' | 'state_invalid' | null` —
    when set, renders the inline error region between body copy and
    button row using the same generic copy as Surface 6.
- **Composition:** thin layer over 003's `Dialog`. No new primitive.
  Centred modal over dimmed scrim. The dimmed underlying surface remains
  visible (visual-direction §"Surface 3 — Layout").
- **Copy (verbatim per FR-013):**
  - Heading: `You are already signed in on another POS terminal in this branch.`
  - Body: `Continue here and sign out there?`
  - Primary button: `Continue here`
  - Secondary button: `Cancel`
  - Close affordance icon: `✕` (treated identically to Cancel — no third
    path).
- **Forbidden content (asserted in tests — see §7):** terminal-A label,
  prior session start time, prior session duration, other operator's name,
  other operator's role, "View details" expand, tooltip with prior-session
  info.
- **Focus management:**
  - Initial focus on **Cancel** — minimum-disclosure prudence: a user
    who arrived at this modal by accident (or by social-engineering
    pressure) defaults to the non-destructive option. The visual-direction
    document records "Continue here" as default focus for keyboard speed
    (Surface 3 §"Keyboard / touch path"); #86's review proposes Cancel as
    the safer default for the takeover decision specifically because the
    decision is irreversible and silently terminates a session on another
    terminal. **Resolve before merge:** flag this divergence in the PR
    description so the visual-direction reviewer can re-confirm or
    override. If reviewer overrides → swap to "Continue here" focus and
    update the test.
  - Tab cycle: `Cancel → Continue here → ✕ → Cancel` (or mirror with
    "Continue here" first if the reviewer overrides).
  - `Escape` calls `onCancel()`.
  - Click on the dimmed scrim is **ignored** (NOT cancel) — visual-direction
    §"Surface 3 — Keyboard / touch path".
- **Accessibility:** `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` on the heading, `aria-describedby` on the body. Focus
  trap inside the modal until closed.
- **className convention:** state-driven —
  `takeover-prompt`, `takeover-prompt__heading`, `takeover-prompt__body`,
  `takeover-prompt__buttons`, `takeover-prompt__error`,
  `data-state="prompted|confirming|error"`,
  `data-testid="takeover-prompt"`.

### 4.3 `src/renderer/routes/sign-in.tsx` — activation diff

- Today: cashier branch is inert.
  - `<RosterList cashiers={[]} inert />` is rendered as an empty-state
    explanation; no PinPad; no roster fetch.
- After #86: cashier branch becomes interactive.
  - On mount, call `props.operator.listBranchRoster()` (already declared on
    `OperatorBridgeAPI`; T070b implements main-side handler).
  - On success, populate `<RosterList cashiers={...} />` (drop `inert`).
  - On roster card click, the route holds `selectedCashierId` in component
    state and a controlled `pin: string` for `<PinPad>`.
  - On `<PinPad onSubmit>`, call `props.operator.signIn({ kind:
    'cashier', cashier_id, pin })` — see §12 for the prerequisite
    bridge-type extension.
  - On `SignInResponse` discrimination:
    - `signed_in` → `useOperatorSessionStore.getState().resolveSignedIn(session)`.
    - `takeover_required` → `promptTakeover()` and render
      `<TakeoverPrompt open ... />`.
    - `refused` → `refuseSignIn(category)` (existing FSM verb).
  - On `<TakeoverPrompt onConfirm>`, call
    `props.operator.confirmTakeover({ event_id })` — see §12 for the
    prerequisite bridge surface.
  - On `<TakeoverPrompt onCancel>`, call
    `props.operator.cancelTakeover()` and clear the PIN buffer + roster
    pick (FR-010 — no credential remembered).

---

## 5. State matrix

Rows are renderer states; columns are observable presence. ✓ = visible /
enabled; — = absent; ⛔ = visibly disabled (rendered, non-interactive).

| State | roster row visible | PinPad enabled | Submit enabled | error banner | spinner | takeover modal open |
|:--|:-:|:-:|:-:|:-:|:-:|:-:|
| `idle` (default) | ✓ | ⛔ | ⛔ | — | — | — |
| `roster-picked` | ✓ (selected card highlighted) | ✓ | ⛔ (until ≥ 4 digits) | — | — | — |
| `pin-entering` (1–3 digits) | ✓ | ✓ | ⛔ (`aria-disabled`) | — | — | — |
| `pin-entering` (4–6 digits) | ✓ | ✓ | ✓ | — | — | — |
| `submitting` | ✓ | ⛔ | ⛔ | — | ✓ (in feedback region; replaces alert space) | — |
| `failure (variant A)` | ✓ | ✓ | ⛔ (until next keystroke / re-pick) | ✓ A | — | — |
| `failure (variant B — rate-limited)` | ✓ but ⛔ | ⛔ | ⛔ | ✓ B | — | — |
| `failure (variant C — no connection)` | ✓ | ✓ | ⛔ | ✓ C (warning) | — | — |
| `takeover-prompt-open` | ✓ (dimmed under scrim) | ⛔ (under scrim) | ⛔ | — (in modal: optional inline error if `confirmTakeover` errored) | — | ✓ |
| `takeover-confirming` | ✓ (dimmed) | ⛔ | ⛔ | — | ✓ (inside modal's Continue-here button) | ✓ |
| `takeover-error` | ✓ (dimmed) | ⛔ | ⛔ | ✓ (inside modal) | — | ✓ |

**Note 1 invariant (load-bearing):** in any state, the inline alert space
in the cashier sign-in feedback region renders **either** the alert
**or** the spinner **or** neither — **never both at the same time**. The
existing `ManagerAdminSignInForm.tsx` already encodes this pattern; #86
mirrors it for the cashier path.

---

## 6. Touch / keyboard / accessibility behaviour

- **44 × 44 CSS px verified per button** — every PinPad key, every roster
  card, both modal buttons, and the modal close (✕) icon. Snapshot tests
  read the computed rect; CI fails if any falls below.
- **Tab order on `/sign-in` cashier mode:** roster grid (arrow-keys
  navigate within; Enter selects) → PinPad group (arrow-keys / hardware
  digits navigate within; Enter submits when valid) → "Sign in as
  manager" link → connection indicator → top-bar branch label (read-only).
  Reverse-tab cycles back symmetrically.
- **PinPad supports physical numeric input:** hardware numpad digits,
  Backspace, Enter — verified by simulating `keydown` events in tests.
  Visual-direction §"Surface 1 — Keyboard / touch path" mandates the
  parity.
- **TakeoverPrompt:**
  - `aria-modal="true"`, focus trap inside the dialog.
  - Initial focus: see §4.2 (Cancel — pending reviewer override).
  - `Escape` → `onCancel`.
  - Click on scrim → ignored.
  - First focusable on mount; last focusable wraps back to first on Tab.
- **Reduced motion:** spinner respects `prefers-reduced-motion`; if
  honoured, the spinner renders as a static busy indicator (no rotation
  animation). Verified by media-query mock in tests.
- **axe-clean smoke** on default / loading / error variants of every
  state above (verified by `expectNoAxeViolations` per Constitution VI /
  003 a11y inheritance).

---

## 7. Screenshot acceptance criteria (FR-035)

The Slice 0 review's three reviewer notes are honoured here:

- **Note 1** (S1 owner — alert/spinner transition): #86 inherits the
  rule. Test: typing a digit dismisses the prior alert before the next
  submit's spinner renders; the spinner replaces the alert's space, never
  alongside.
- **Note 2** (S4 owner — stuck-shift count badge): out-of-scope here.
- **Note 3** (S5 owner — card-stack default for forced-close): out-of-scope
  here.

### File naming convention

```
specs/004-operator-session/screenshots/<surface>-<state>-<viewport>.png
```

| File | Surface | State | Viewport |
|:--|:--|:--|:--|
| `sign-in-cashier-default-1280.png` | Cashier `/sign-in` | idle | 1280 × 800 |
| `sign-in-cashier-roster-picked-1280.png` | Cashier `/sign-in` | roster-picked | 1280 × 800 |
| `sign-in-cashier-pin-entering-1280.png` | Cashier `/sign-in` | 4 digits typed | 1280 × 800 |
| `sign-in-cashier-submitting-1280.png` | Cashier `/sign-in` | submitting | 1280 × 800 |
| `sign-in-cashier-failure-variant-a-1280.png` | Cashier `/sign-in` | variant A | 1280 × 800 |
| `sign-in-cashier-failure-variant-b-1280.png` | Cashier `/sign-in` | variant B (locked) | 1280 × 800 |
| `sign-in-cashier-failure-variant-c-1280.png` | Cashier `/sign-in` | variant C (offline) | 1280 × 800 |
| `takeover-prompt-prompted-1280.png` | TakeoverPrompt | prompted | 1280 × 800 |
| `takeover-prompt-confirming-1280.png` | TakeoverPrompt | confirming | 1280 × 800 |
| `takeover-prompt-error-1280.png` | TakeoverPrompt | error | 1280 × 800 |
| `sign-in-cashier-default-1024.png` | Cashier `/sign-in` | idle | 1024 × 768 (icon-only rail) |
| `takeover-prompt-prompted-1024.png` | TakeoverPrompt | prompted | 1024 × 768 |

### Acceptance thresholds

- **Pixel-diff:** ≤ 0.5 % per-pixel diff against the reference screenshot
  for layout-stable surfaces (default, roster-picked, prompted, error).
  ≤ 1.5 % for surfaces containing animated regions (submitting, confirming),
  to absorb spinner-frame variance.
- **Reference screenshots are stored under `specs/004-operator-session/screenshots/`**
  (NOT created by this planning task — created in the implementation slice
  alongside the components, attached to the PR).
- **axe-clean smoke** required per state on default / loading / error.
  No `serious` or `critical` axe violations permitted.
- **No new design tokens introduced** — verified by scanning the diff
  for new `@theme` entries or new `--*` CSS custom properties (CI grep
  check).

### Note 1 acceptance test

Explicit Vitest assertion:

```
1. Mount /sign-in in cashier mode with a roster of one cashier.
2. Pick the cashier; type 4 digits; submit.
3. Mock the bridge to return OperatorRefusal { category: 'invalid_input' }.
4. Assert: the inline alert (variant A) is rendered; no spinner.
5. Type one new digit (the buffer becomes "<digit>" — buffer is reset on
   refusal? — see §11 open question).
6. Assert: the alert is no longer in the DOM; no spinner yet.
7. Trigger submit again.
8. Assert: spinner is rendered in the feedback region; no alert.
9. At no observable instant during steps 5–8 does both the alert AND the
   spinner co-exist.
```

The cashier-side mirrors the assertion already in the manager/admin form's
test suite — the assertion structure should be reused (DRY, same
shape).

### Generic-failure copy verification

Each variant's exact string is asserted against
[../visual-direction/README.md](../visual-direction/README.md) §"Surface 6 —
The three generic message variants":

- A: `Credentials not recognised. Please try again.`
- B: `Too many attempts. Please wait a moment before trying again.`
- C: `No connection. Please check the network and try again.`

If the existing `messages.ts` constants on the cashier side diverge from
these, #86's PR author updates the constants to match the canonical strings
and the test asserts equality.

### TakeoverPrompt copy verification (verbatim)

- Heading equality: `You are already signed in on another POS terminal in this branch.`
- Body equality: `Continue here and sign out there?`
- Primary button equality: `Continue here`
- Secondary button equality: `Cancel`
- **Forbidden-string assertions** (each must NOT appear anywhere in the
  rendered DOM under `[data-testid="takeover-prompt"]`):
  - The string `POS-` (terminal label prefix from 003's pairing).
  - The substring `ago` (timestamp-relative).
  - The substring `Cashier `, `Manager`, `Admin` (other-operator role).
  - Any 4-digit time pattern (`/\d{2}:\d{2}/`).
  - The string `View details`, `Why am I seeing this`, `Show details`.
- The forbidden-string assertion is the load-bearing test for FR-013
  minimum-disclosure.

---

## 8. Spacing / tokens / hierarchy direction

- Reuse 003 tokens; **no new tokens, no half-step spacing**.
- The PinPad sits within a `Card` primitive (003) with the same padding
  density used by `ManagerAdminSignInForm.tsx`. PIN dots row sits above
  the digit grid with 003's standard `space-y` 16 px gap.
- Roster grid columns at ≥ 1280 px: 3 columns; at 1024–1279 px: 2 columns.
  Gap: 16 px (≥ 1280 px) / 8 px (1024–1279 px) per visual-direction
  §"Surface 1 alignment checks".
- The PIN pad stays at 3-column layout regardless of viewport; only the
  roster reflows.
- Hierarchy: roster heading (`text-base` weight 500) and PIN heading
  (`text-base` weight 500) sit at the same vertical baseline at the top
  of the surface; the PIN dots row is the horizontal anchor.
- TakeoverPrompt heading `text-lg` weight 600; body `text-base` weight 400;
  button group spaced 16 px horizontally per 003's button-group gap.

---

## 9. className / BEM hooks strategy

Match the existing patterns in `RosterList.tsx` and
`ManagerAdminSignInForm.tsx`:

- Block / element / state via `data-*` attributes plus class names:
  - `RosterList` uses `roster-list`, `roster-list--inert`,
    `roster-list__items`, `roster-list__item`, `roster-list__name`,
    `roster-list__role`, `data-state="inert|active"`, `data-role`.
  - `ManagerAdminSignInForm` uses `sign-in-form`, `sign-in-form__field`,
    `sign-in-form__feedback`, `sign-in-form__refusal`,
    `sign-in-form__empty-input`, `sign-in-form__submit`.
- #86 mirrors that convention:
  - `pin-pad`, `pin-pad__dots`, `pin-pad__dot`, `pin-pad__grid`,
    `pin-pad__key`, `pin-pad__key--digit`, `pin-pad__key--backspace`,
    `pin-pad__key--enter`, plus `data-state`, `data-testid="pin-pad"`,
    and `data-disabled` mirroring the `disabled` prop.
  - `takeover-prompt`, `takeover-prompt__heading`,
    `takeover-prompt__body`, `takeover-prompt__buttons`,
    `takeover-prompt__error`, plus
    `data-state="prompted|confirming|error"`,
    `data-testid="takeover-prompt"`.
- Do **not** introduce a new BEM convention or a new naming scheme; do
  **not** introduce a CSS-in-JS approach. Tailwind utility classes (per
  003) compose alongside the BEM hooks.

---

## 10. Proposed files for future implementation (planning only — DO NOT CREATE)

The following files would land in the #86 implementation PR. This planning
file does NOT create them.

- `src/renderer/ui/operator/PinPad.tsx` — new component (T074).
- `src/renderer/ui/operator/TakeoverPrompt.tsx` — new component (T076).
- `src/renderer/ui/operator/__tests__/PinPad.test.tsx` — new test (T060).
- `src/renderer/ui/operator/__tests__/TakeoverPrompt.test.tsx` — new test
  (T076 sibling).
- **Diff to** `src/renderer/routes/sign-in.tsx` — activation work for
  cashier mode (T075). Existing manager/admin path unchanged. Existing
  inert `<RosterList cashiers={[]} inert />` flips to interactive.
- **Possible diff to** `src/renderer/stores/operator-session-store.ts` —
  the `takeoverPrompt` FSM state already exists; #86 may need to attach
  an `event_id: string` field to that state-branch (used by
  `confirmTakeover` for P5 idempotency). If so, the store change is the
  smallest possible — one optional property — and is part of T077 scope.
  Verify by reading the existing FSM (already does NOT carry `event_id`)
  before deciding.

---

## 11. Risks / open questions

### R1 — Cashier-branch bridge type missing on the shared surface (PREREQUISITE — load-bearing)

**State today:**
- `ManagerAdminSignInRequest` is exported from
  `src/shared/bridge-api.ts` (line 110-116).
- `SignInRequest = ManagerAdminSignInRequest` (line 118) — the union does
  NOT yet include the cashier branch.
- `CashierSignInRequest` IS defined in
  `src/main/operator/sign-in-handler.ts` (line 207–214) but is NOT
  exported from `src/shared/bridge-api.ts` and is therefore not callable
  from the renderer.
- The visual-direction docs and the `bridge-api.md` contract both describe
  the cashier shape `{ kind: 'cashier'; cashier_id: string; pin: string }`.

**Implication:** #86 cannot wire `props.operator.signIn({ kind: 'cashier',
... })` on the cashier path until a small bridge-type change lands. Two
options:

1. Land a minimal prerequisite PR that extends `SignInRequest` to be a
   discriminated union of `ManagerAdminSignInRequest |
   CashierSignInRequest` (and exports `CashierSignInRequest` from
   `src/shared/bridge-api.ts`), with the existing main-side
   `CashierSignInHandler` already in place. No new bridge channel needed.
2. Fold the type extension into #86's PR. Risk: makes #86 bigger and
   stretches its renderer-only mandate; recommended only if the
   reviewer's preference is one PR.

**Recommendation:** option 1 — prerequisite PR ahead of #86. This keeps
#86 strictly UI-only, matches plan.md S4 dependency ordering, and lets
the bridge-surface security review (S2 already merged) re-validate the
union extension before any UI consumes it.

### R2 — `confirmTakeover` and `cancelTakeover` not on the bridge surface yet

The `OperatorBridgeAPI` interface in `src/shared/bridge-api.ts`
currently exposes: `signIn`, `signOut`, `getCurrentSession`,
`_reportActivity`, `emitAuditEvent`, `_emitAuditEventSmoke`,
`listBranchRoster`. **`confirmTakeover` and `cancelTakeover` are NOT
present.** Plan v1.1 contracts/bridge-api.md describes them; tasks T071
(`confirmTakeover`) and T072 (`cancelTakeover`) implement them. #86 (T077)
explicitly depends on T070, T071. **Confirm T071 has landed before #86
opens its PR; if not, T071 is a hard prerequisite.**

### R3 — Roster auto-select with a single cashier

Open product question: if `listBranchRoster` returns exactly one cashier,
should the route auto-select that cashier and place focus on the first
PIN digit on mount? Visual-direction §"Surface 1" does not specify.
**Recommendation:** flag in #86 PR description; default behaviour =
**no auto-select** (cashier still taps their card explicitly) for
consistency with the multi-cashier UX and to keep the FR-010 "no
remembering" rule symmetric.

### R4 — On-screen keyboard for hardware-less terminals

Windows pharmacy terminals MAY ship with a touch screen and no hardware
keyboard. The PinPad's on-screen 3-column grid IS the canonical input;
#86 does NOT trigger Windows' on-screen keyboard for the PIN field
because the dot row is not an `<input>` — it's a presentational region.
The roster-card click + PIN-pad tap UX works without any IME. This is
documented in the PR description for the visual-direction reviewer. No
known issue; recorded for completeness.

### R5 — Initial focus on TakeoverPrompt — security tension with reviewer-recorded preference

Visual-direction §"Surface 3" records "Continue here" as default focus
(speed-of-decision argument). #86 plans Cancel as default focus
(minimum-disclosure / non-destructive default). Either is defensible.
**Resolution path:** flag in PR description; visual-direction reviewer
either (a) approves the override and updates the README, or (b) keeps
"Continue here" focus and #86 swaps the test. Document the chosen
resolution in the PR description.

### R6 — PIN buffer state on refusal

Open question: when the cashier sees variant A (`invalid_input`), should
the PIN buffer be cleared automatically, or should it be preserved for
correction? **Recommendation:** clear the buffer immediately on receipt
of variant A (the PR-1 minimum-disclosure principle prefers that the
buffer not persist; the cashier mistypes, sees the alert, and is invited
to start fresh). Variant C (`no_connection`) — preserve the buffer
behind a "Try again" affordance per visual-direction §"Variant C". The
PIN buffer is held only in route component state, never logged, never
serialised, and is dropped on route unmount.

### R7 — Generic close icon (✕) accessibility name

The visual-direction sketch shows `✕` as the close icon. The component's
`aria-label` should be `Close` or `Cancel`? **Recommendation:** `Close`
for screen-reader correctness (a Unicode multiplication sign is not
self-descriptive); semantically maps to `onCancel` in the `onClick`
handler.

---

## 12. Explicit note

**No implementation in this PR. Visual direction review and acceptance
criteria only.** This planning document is the only deliverable. The
implementation tasks (T060, T074, T075, T076, T077) land in subsequent
PRs scheduled per `tasks.md` Phase 6 ordering. Each implementation PR
MUST cite this planning file AND
[../visual-direction/README.md](../visual-direction/README.md) in its
description and attach the screenshots required in §7 above.
