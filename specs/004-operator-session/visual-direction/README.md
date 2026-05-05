# Slice 0 — Visual Direction Contact Sheet

**Feature:** 004-operator-session
**Slice:** S0 (visual direction — non-code, FR-033 mandated)
**Plan:** [../plan.md](../plan.md) v1.1
**Spec:** [../spec.md](../spec.md)
**Created:** 2026-05-05
**Status:** ⏳ Awaiting review (see [§Review Record](#review-record))

---

## Purpose

This document is the **visual direction contact sheet** required by spec FR-033
between `/speckit-plan` and the first implementation slice (S1). It is the
single artifact that the Slice 0 review gate (plan.md §"Phase 2") evaluates
before any UI implementation may merge. No source code, no Figma URLs as
requirements, no design files; the contact sheet is the source of truth and
follows P12 (Spec Kit artifacts ARE the source of truth).

The six surfaces below are presented in canonical order. Each carries:

1. **Purpose** — what user goal the surface serves.
2. **Layout sketch** — an ASCII / textual layout for the default state.
3. **Components used** — explicit references to 003's inventory and 004's
   new operator module.
4. **Content rules** — what each region MUST / MUST NOT contain, citing the
   normative spec / plan source.
5. **States** — every variant the surface needs (default, loading, error,
   etc.) and the rule that picks among them.
6. **Keyboard / touch path** — the cashier-ergonomics requirement for the
   surface.
7. **003 alignment checks** — the boxes the Slice 0 review walks against
   003's locked decisions.

After the six surfaces, the document ends with: a tokens / density /
viewport / accessibility cross-cutting block (applied to every surface),
the §A1 / §A2 status (unresolved, blocking S3+), and the review record.

---

## Cross-cutting commitments (apply to every surface below)

These commitments are inherited from 003 and the constitution. Every
surface in this contact sheet honours them; the Slice 0 review walks them
once at the end rather than per-surface.

### Tokens (003 plan §Technical Context, FR-034)

- Color: `--color-bg-base`, `--color-bg-surface`, `--color-text-primary`,
  `--color-text-muted`, `--color-accent`, `--color-error`,
  `--color-success`, `--color-warning` — exact values from 003's
  `tailwind.css` `@theme` block. No new color tokens introduced by 004.
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 px scale from 003. No half-step
  spacing introduced.
- Typography: 003's font-family, weight scale, and size ramp (xs / sm /
  base / md / lg / xl / 2xl). The PIN-pad digit uses `text-2xl` weight 600;
  cashier display name uses `text-base` weight 500.
- Radius: 003's `--radius-sm` / `--radius-md` / `--radius-lg` only.
- Shadow: 003's `--shadow-1` / `--shadow-2` only — used on cards and
  modal overlays per 003 conventions.

### Density (003 plan §"Density model")

- **`comfortable` density only.** No `compact` variant for any 004 surface.
- Touch targets ≥ 44 × 44 CSS px on every interactive element (NFR-005 /
  003 NFR-5 / Constitution Hardware Matrix).

### Viewport (003 plan §"Responsive viewport")

- Primary target: ≥ 1280 px. All six surfaces are designed to this width.
- Secondary supported: 1024–1279 px (icon-only navigation rail). The
  six surfaces accommodate this band (see per-surface notes).
- Below 1024 px: same "screen too small" fallback 003 reserved. 004 does
  NOT design a mobile drawer or any below-1024 layout.

### Connection-state visual (003 FR-7 / FR-16)

- The four-state indicator (`online` / `degraded` / `offline` / `syncing`)
  is rendered consistently across every surface. Its location during
  `/sign-in` is the **top-right corner of the surface**, separate from
  any sign-in form (so a network outage during sign-in is honestly
  surfaced — see §Surface 6 generic-failure logic). On post-sign-in
  surfaces, the indicator lives in 003's existing status-bar slot.
- 004 introduces NO new connection states; the `syncing` visual remains
  003's visual-only placeholder.

### Navigation rail visibility (decision recorded here)

- During `/sign-in`: the navigation rail is **hidden**. Rationale: there
  is no operator session; the rail's role-indicator slot has nothing to
  show; rendering an empty rail creates dead pixels and contradicts the
  full-attention focus the sign-in moment requires.
- During the takeover prompt: the rail is **visible** behind the modal
  because the takeover happens *inside* an authenticated session (the
  user is signing in on terminal B while terminal A still has their
  prior session). The rail shows the prior session's role indicator
  blurred/dimmed under the modal scrim per 003's standard modal
  treatment.
- During the forced-close form: the rail is **visible** because forced-
  close is a manager-only flow inside a manager session.
- This decision is binding for Slice 0 review and propagates into Slices
  1, 4, 5.

### Accessibility floor (P14)

- Every interactive element has a visible focus ring (003's
  `--focus-ring` token).
- Color is never the *only* signal: state changes (locked, error,
  success) carry an icon + text, not just a color shift.
- Tab order matches reading order; reverse-tab cycles back through the
  same elements.
- Each surface listed below names its keyboard path explicitly under
  "Keyboard / touch path".
- axe-rule cleanliness on default state of every surface (verified in
  per-slice tests, not in this document).

### Locale direction (003 NFR-9)

- Logical CSS properties (`inline-start` / `inline-end`) only. No
  hard-coded `left` / `right`. Surfaces below are described as if the
  locale were LTR for clarity; the rules apply symmetrically in RTL.

---

## Surface 1 — Cashier sign-in: roster + PIN

### Purpose

The post-pairing landing surface for cashier role authentication. A cashier
signs in on a paired terminal by picking their display name from the branch
roster, then entering their 4–6 digit PIN. The PIN is a local terminal
unlock factor (AD-2); it does not mint backend tokens. Manager / admin role
holders use Surface 2 instead.

**Spec citations:** FR-005 (Sign-In is the only reachable route while no
operator session active), FR-006 (cashier roster pick + 4–6 digit PIN),
FR-031 (no email/phone in the renderer), FR-032 (no operator identifier in
generic UI logs), NFR-005 (44 × 44 px touch floor), NFR-006 (5 s sign-in
budget), spec Q1 clarification, plan AD-2, PR-1, PR-2, PR-3.

### Layout sketch (≥ 1280 px viewport, default state)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [SmartDataPulse logo]   Branch: Pharmacy Downtown   Terminal: POS-03  ●  │
│                                                                ↑ connection│
│                                                                  indicator │
│                                                                            │
│   Pick your name                                  Enter your PIN           │
│   ─────────────                                   ──────────────           │
│                                                                            │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐    ┌─────────────────┐     │
│   │  Layla A.  │ │  Mariam S. │ │  Karim H.  │    │   • • • •       │     │
│   │  Cashier   │ │  Cashier   │ │  Cashier   │    │                 │     │
│   └────────────┘ └────────────┘ └────────────┘    └─────────────────┘     │
│                                                                            │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐    ┌───┬───┬───┐           │
│   │  Sara M.   │ │  Omar K.   │ │  Hana T.   │    │ 1 │ 2 │ 3 │           │
│   │  Cashier   │ │  Cashier   │ │  Cashier   │    ├───┼───┼───┤           │
│   └────────────┘ └────────────┘ └────────────┘    │ 4 │ 5 │ 6 │           │
│                                                    ├───┼───┼───┤           │
│   ┌────────────┐ ┌────────────┐                    │ 7 │ 8 │ 9 │           │
│   │  Yara F.   │ │  Bassam Q. │                    ├───┼───┼───┤           │
│   │  Cashier   │ │  Cashier   │                    │ ⌫ │ 0 │ ↵ │           │
│   └────────────┘ └────────────┘                    └───┴───┴───┘           │
│                                                                            │
│                                                    [ Sign in as manager ]  │
│                                                       ↑ link to Surface 2 │
└────────────────────────────────────────────────────────────────────────────┘
```

### Components used

| Region | Component | Source |
|:--|:--|:--|
| Top bar — branch + terminal label | `Header` (003) | 003 inventory |
| Top bar — connection indicator | `ConnectionStatusBadge` (003) | 003 inventory |
| Roster grid | `RosterList` (NEW) composing `Card` (003) per cashier | 004 / 003 |
| PIN input display + numeric pad | `PinPad` (NEW) | 004 |
| "Sign in as manager" link | `Button` variant `link` (003) | 003 inventory |

### Content rules

- **Roster grid**:
  - One card per cashier authorised on the terminal's paired branch.
  - Card content: `display_name` (line 1, larger), business-role label
    "Cashier" (line 2, smaller). NO email, NO phone, NO Clerk user id
    visible. (FR-006 / FR-031.)
  - Cashier display name MUST NOT exceed two visual lines; long names
    truncate with ellipsis.
  - Visually-disabled-account cashiers MUST NOT appear in the roster
    (FR-003 — disabled accounts cannot sign in; the rejection is
    indistinguishable from a generic refusal, so the disabled cashier is
    simply absent rather than rendered greyed-out).
  - Roster ordering: alphabetical by display name. No "frequently used"
    pre-sort (which would leak who has been on this terminal recently).
  - Manager and admin role holders MUST NOT appear in the roster — they
    use Surface 2.
- **PIN input display**:
  - 4–6 dot bullets, one per digit entered. Bullets fill from
    inline-start to inline-end as digits are typed.
  - The PIN value itself MUST NEVER be displayed in plaintext, even
    transiently, even on long-press, even on focus. (PR-1.)
  - "Show PIN" affordance: NONE. Cashiers do not need to verify their PIN
    against typos in this surface; the PR-3 lockout is generous enough
    that one or two re-entries is normal.
- **Numeric pad**:
  - Keys: `0`–`9`, `⌫` (backspace), `↵` (enter).
  - `↵` submits when 4–6 digits are entered. Below 4 digits, `↵` is
    visibly disabled (greyed, focus-ring suppressed) AND announced to
    assistive tech as `aria-disabled="true"`.
  - Hardware keyboard digits also accept input. Enter key submits; tab
    cycles back into the roster.
- **"Sign in as manager" link**:
  - Tertiary button styling, low-emphasis. Selecting it transitions the
    sign-in surface to Surface 2 (the password form replaces the PIN
    pad; the roster is hidden).
  - The link is reachable by keyboard tab order.

### States (the variants this surface MUST support)

| State | Trigger | Visual change |
|:--|:--|:--|
| `default` | Surface mounted, no roster pick yet | PIN pad disabled (visibly muted, `aria-disabled="true"`); cursor focus is on the first roster card. |
| `roster-picked` | A cashier card has been selected | The selected card receives 003's `--color-accent` border + filled background + checkmark icon. PIN pad becomes enabled. Focus auto-advances to the PIN pad's first digit. |
| `pin-entering` | At least one digit typed | PIN dots fill progressively. `↵` enables at 4 digits. |
| `submitting` | `↵` pressed; bridge call in flight | PIN pad becomes non-interactive (visibly greyed but NOT replaced by a spinner over the whole surface — the surface stays visible to confirm the cashier's choice was received). A small spinner appears in the `↵` key. |
| `error` | Generic refusal returned (Surface 6 specifies the exact UX) | See Surface 6 for the precise generic-failure layout overlay. |
| `locked-out` | Generic rate-limited refusal returned (PR-3) | See Surface 6 for the lockout variant. |
| `offline` | Network unreachable during submit | See Surface 6 for the offline variant. The connection indicator independently transitions to `offline` per 003. |

**No success state is rendered on this surface.** On success, the surface
unmounts and the boot router transitions to `/app/*` (the role-appropriate
landing surface from 003). Avoiding a "Welcome, Layla A." flash before the
shell mounts honours P2 (no fake success states until the shell IS the
truth).

### Keyboard / touch path

1. **Touch**: tap a roster card → tap PIN digits → tap `↵`. Each step is
   a single touch on a ≥ 44 × 44 px target.
2. **Keyboard**: arrow keys (or Tab) to navigate the roster grid; Enter
   selects the focused card; focus auto-advances to the PIN pad; type
   digits on the hardware numpad; Enter submits. Reverse-tab cycles back
   to the roster.
3. **Mixed**: tap a card with the touchscreen, then type the PIN on a
   hardware numpad that the cashier may have. Both inputs feed the same
   PinPad component.

The "Sign in as manager" link is reachable by Tab from the PIN pad area.

### 003 alignment checks (Slice 0 review)

- [ ] Cards use `Card` from 003's inventory, not a one-off card style.
- [ ] Spacing between roster cards uses the 003 spacing scale (16 px
      gap recommended at ≥ 1280 px; 8 px at 1024–1279 px).
- [ ] PIN digits use 003's typography ramp (`text-2xl` digit; `text-base`
      label).
- [ ] Connection indicator uses 003's exact four-state visual (`online` /
      `degraded` / `offline` / `syncing`); no new states introduced.
- [ ] Touch targets verified ≥ 44 × 44 CSS px on the PIN pad and roster
      cards.
- [ ] Focus rings visible on every interactive element (003's
      `--focus-ring` token).
- [ ] axe-clean on default + roster-picked states.
- [ ] At 1024–1279 px viewport, the roster grid reflows to fewer columns
      while maintaining touch-target floor; the PIN pad stays at 3-column
      layout.

### Out of scope for this surface (declared explicitly)

- Cashier-self-service "I forgot my PIN" link. (Hard Non-Implementation
  Boundary; PR-5 manager-attributable reset is the only path.)
- Last-cashier-signed-in pre-fill of the roster pick. (FR-010 — no cashier
  identifier remembered between sessions.)
- Biometric / smart-card / barcode-scan sign-in. (Hard Non-Implementation
  Boundary.)
- A "show password" / "show PIN" toggle. (PR-1.)
- Any indication of which cashier signed in last on this terminal.
  (FR-010.)

---

## Surface 2 — Manager / Admin sign-in: password

### Purpose

The post-pairing sign-in surface for manager and admin roles. Auth is
delegated to Clerk end-to-end (AD-2): identifier (typically email) +
password. Reachable via the "Sign in as manager" link from Surface 1, OR
directly via the same `/sign-in` route when an admin/manager taps the
identifier field instead of picking from the roster.

**Spec citations:** FR-005, FR-006 (manager / admin password), FR-007 (5 s
budget), FR-010 (no credential remember), NFR-003 (single generic error
variant), Constitution VIII (Clerk as sole IdP).

### Layout sketch (≥ 1280 px viewport, default state)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [SmartDataPulse logo]   Branch: Pharmacy Downtown   Terminal: POS-03  ●  │
│                                                                            │
│                                                                            │
│   Sign in as manager or admin                                              │
│   ─────────────────────────────                                            │
│                                                                            │
│                                                                            │
│             ┌──────────────────────────────────────────┐                  │
│             │  Identifier                              │                  │
│             │  ┌────────────────────────────────────┐  │                  │
│             │  │  email@pharmacy.example            │  │                  │
│             │  └────────────────────────────────────┘  │                  │
│             │                                          │                  │
│             │  Password                                │                  │
│             │  ┌────────────────────────────────────┐  │                  │
│             │  │  ••••••••••                        │  │                  │
│             │  └────────────────────────────────────┘  │                  │
│             │                                          │                  │
│             │              [    Sign in    ]           │                  │
│             └──────────────────────────────────────────┘                  │
│                                                                            │
│             ← Back to cashier sign-in                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Components used

| Region | Component | Source |
|:--|:--|:--|
| Top bar | `Header`, `ConnectionStatusBadge` (003) | 003 inventory |
| Form card | `Card` (003) wrapping the form fields | 003 |
| Identifier input | `Input` type=`email` (003) | 003 |
| Password input | `Input` type=`password` (003) | 003 |
| Submit button | `Button` variant=`primary` (003) | 003 |
| "Back to cashier sign-in" link | `Button` variant=`link` (003) | 003 |

004 introduces NO new components for this surface; it is pure composition
over 003's primitives.

### Content rules

- **Identifier field**:
  - Placeholder: empty (NOT pre-filled with the previous operator's
    identifier — FR-010).
  - Type: `email` (browser keyboards default to email layout on
    touchscreens).
  - Maximum length: a generous bound (e.g., 254 chars per RFC 5321) but
    no specific length validation in the renderer; the backend
    authoritative.
- **Password field**:
  - Placeholder: empty (FR-010).
  - Type: `password` (masked).
  - "Show password" affordance: **OPTIONAL** for managers/admins — the
    003 `Input` primitive's standard `password` variant either provides
    one or doesn't; if it does, 004 inherits the behaviour. PR-1 still
    applies: the password value MUST NOT cross the bridge in plaintext
    (it is consumed by the main-process Clerk client and discarded).
  - autocomplete: `current-password` to allow OS-level password managers.
    A Windows pharmacy terminal under a managed Windows profile MAY have
    a credential vault; honouring `current-password` lets it integrate
    correctly without 004 doing anything special.
- **Submit button**:
  - Label: "Sign in".
  - Disabled when either field is empty.
  - On click / Enter from password field: bridge call
    `operator.signIn({ kind: 'manager_admin', ... })`.
- **"Back to cashier sign-in" link**:
  - Returns to Surface 1; clears the identifier and password fields.

### States

| State | Trigger | Visual change |
|:--|:--|:--|
| `default` | Surface mounted | Both fields empty; submit disabled. |
| `entering` | At least one field has content | Submit enables when both fields are non-empty. |
| `submitting` | Submit clicked / Enter pressed | Both fields non-interactive; submit shows a spinner; the surface as a whole remains visible. |
| `error` | Generic refusal | See Surface 6. |
| `takeover-required` | Operator already signed in elsewhere in this branch | Surface 3 (takeover prompt) overlays on top. |
| `offline` | Network unreachable | See Surface 6. |

### Keyboard / touch path

1. **Touch**: tap identifier → on-screen keyboard appears → type → tap
   password → type → tap submit.
2. **Keyboard**: identifier focused on mount; type → Tab → password →
   type → Enter submits.

### 003 alignment checks

- [ ] Form card uses `Card` from 003.
- [ ] Submit button uses `Button` variant `primary`.
- [ ] Connection indicator uses 003's four-state visual.
- [ ] Touch targets ≥ 44 × 44 CSS px on submit and the input fields.
- [ ] Focus rings visible.
- [ ] axe-clean on default + entering states.
- [ ] At 1024–1279 px, the form card width contracts but maintains
      ≥ 44 × 44 px input affordances.

### Out of scope for this surface

- "Forgot password" link. Manager / admin password reset is a Clerk-side
  flow; 004 does not surface it on the POS terminal — it lives in the
  platform admin app.
- "Remember me" checkbox. (FR-010.)
- MFA / second factor. (Constitutional future-state — 004 does not
  preclude it but does not implement it.)

---

## Surface 3 — Explicit takeover prompt

### Purpose

When an operator submits valid credentials on terminal B while they have an
active session on terminal A, terminal B presents an explicit takeover
prompt before establishing a new session. The prompt is generic — it does
NOT name terminal A, the prior-session start time, or any other-operator
data (FR-013).

**Spec citations:** FR-011 (single session per terminal), FR-013 (single
active session branch-wide; takeover prompt; generic copy; audited as
`operator.session.takeover`), US1-AS6, plan AD-2 (uniformly applies to all
roles).

### Layout sketch (modal overlay on the sign-in surface)

```
                  ┌──────────────────────────────────────────┐
                  │                                          │
                  │   You are already signed in              │
                  │   on another POS terminal in             │
                  │   this branch.                           │
                  │                                          │
                  │   Continue here and sign out             │
                  │   there?                                 │
                  │                                          │
                  │   ┌───────────────┐  ┌───────────────┐  │
                  │   │   Continue    │  │    Cancel     │  │
                  │   │     here      │  │               │  │
                  │   └───────────────┘  └───────────────┘  │
                  │                                          │
                  │                                       ✕  │
                  │                                  ↑ close│
                  └──────────────────────────────────────────┘
                       ↑ centered modal over a dimmed scrim
```

### Components used

| Region | Component | Source |
|:--|:--|:--|
| Modal overlay + scrim | `Dialog` (003) | 003 inventory |
| Heading + body copy | `Text` semantic primitives (003) | 003 |
| "Continue here" | `Button` variant=`primary` (003) | 003 |
| "Cancel" | `Button` variant=`secondary` (003) | 003 |
| "✕" close affordance | `Button` variant=`ghost` icon-only (003); 44 × 44 px target | 003 |
| Underlying dimmed background | The sign-in surface (Surface 1 or 2) the takeover was triggered from | composition |

004's `TakeoverPrompt` is a thin composition over 003's `Dialog`. No new
primitive.

### Content rules — the load-bearing rules

- **Heading copy**: "You are already signed in on another POS terminal in
  this branch." Verbatim. Does not name terminal A's label, branch
  position, or any other locator.
- **Body copy**: "Continue here and sign out there?" Verbatim.
- **Button labels**:
  - Primary: **"Continue here"** (verbatim).
  - Secondary: **"Cancel"** (verbatim).
  - Close icon (✕): treated identically to Cancel (no third path).
- **What MUST NOT appear**:
  - The other terminal's label (e.g., "POS-04"), location, position, or
    any locator beyond "another POS terminal in this branch".
  - The prior session's start time, duration, or last-activity timestamp.
  - The prior-session operator's identity. (Trivially: it's the same
    operator — but the prompt MUST NOT confirm this, MUST NOT show their
    name, MUST NOT confirm "you signed in 14 minutes ago.")
  - Any cashier/manager/admin role indicator beyond what's already on the
    underlying surface. The modal itself does not display the role.
  - Any reference to the prior session's role. (A manager who took over
    a cashier's terminal accidentally still gets the same generic prompt;
    the role information stays inside the audit record, not on the modal.)
  - A "View details" link, a "Why am I seeing this?" expandable section,
    a tooltip with prior-session info, or any progressive-disclosure that
    leaks the data the modal must keep generic.

### States

| State | Trigger | Visual change |
|:--|:--|:--|
| `prompted` | `operator.signIn` returned `takeover_required` | Modal mounted over the sign-in surface; underlying surface dimmed via 003's scrim; focus moves to "Continue here" by default. |
| `confirming` | "Continue here" clicked | "Continue here" shows a spinner; both buttons non-interactive; the modal stays open until the bridge call resolves. |
| `cancelled` | "Cancel" or close (✕) clicked, OR Escape key pressed | Modal unmounts immediately; the sign-in surface returns to its prior state (the credentials remain in the form fields ONLY for the duration of the cancellation animation, then are cleared per FR-010 — actually, see "Out of scope" below for a notable detail). |
| `error` | Backend takeover-confirm call failed | The modal stays mounted; an inline error message appears between the body copy and the buttons, using 003's standard error treatment, with the same generic "credentials not recognised" wording (we do NOT distinguish "takeover failed because backend unreachable" from "takeover failed because the prior session was already terminated by another path" — both are generic). |
| `success` | Takeover confirmed; new session created on terminal B | Modal unmounts; the sign-in surface unmounts; the shell mounts on terminal B. |

### Keyboard / touch path

1. **Default focus**: "Continue here" on mount.
2. **Tab cycles**: `Continue here → Cancel → close (✕) → Continue here`.
3. **Escape key**: behaves identically to "Cancel".
4. **Enter key**: activates the focused button.

The modal traps focus per 003's `Dialog` standard behaviour; clicks
outside the modal on the dimmed scrim are ignored (NOT treated as cancel,
because an accidental tap during the takeover decision should not silently
discard the prompt).

### 003 alignment checks

- [ ] `Dialog` from 003's inventory; no one-off modal styling.
- [ ] Scrim opacity matches 003's modal scrim token.
- [ ] Heading typography matches 003's `text-lg` / weight 600 modal-title
      ramp.
- [ ] Buttons use 003's `primary` and `secondary` variants; spacing
      between them is 003's standard 16 px button-group gap.
- [ ] Touch targets ≥ 44 × 44 CSS px on all three actionable elements
      (Continue / Cancel / ✕).
- [ ] Focus ring visible on the default-focused "Continue here".
- [ ] axe-clean on `prompted` state.
- [ ] At 1024–1279 px, the modal width contracts but maintains the
      heading + body + button stack proportions.

### Out of scope (notable)

- A "Re-enter password" / "Confirm with PIN" intermediate step before the
  takeover proceeds. Rationale: the operator already authenticated in the
  immediately preceding step; adding a second factor here doubles the
  authentication burden without raising the security ceiling (a
  shoulder-surfer who saw the password / PIN already has it). If a future
  feature needs higher-assurance takeover (e.g., for a regulatory reason),
  it adds the step under its own approval gate, not 004.
- A "remember this decision" checkbox. The takeover decision is per-event;
  pre-deciding future takeovers is the wrong UX shape.
- Disclosure of the prior session's role even when it's the same role.
  (Information principle: if it's not load-bearing for the takeover
  decision, omit it.)

### Edge case visual: takeover prompt on the *cashier* path

Surface 1's `submitting` state may transition into Surface 3 if the cashier
PIN unlock detects an existing session on a different terminal in the same
branch. The visual transition: the PIN-pad's spinner unmounts, Surface 3's
modal mounts on top of Surface 1 (now dimmed). On Cancel, Surface 3
unmounts and Surface 1 returns to `default` (cleared of the partial PIN).
On Continue here, Surface 1 unmounts and the shell mounts.

---

## Surface 4 — Forced-close manager recovery surface

### Purpose

Manager- or admin-attributable recovery flow for a stuck shift (a shift
whose opening cashier became unable to close it: takeover supersession,
no-show, illness, dismissal, terminal failure). Two sub-surfaces:

- **4A** — the stuck-shift list: a manager's view of every stuck shift on
  their authorised branches.
- **4B** — the forced-close form: opens when the manager picks a stuck
  shift; collects the structured reason and an optional free-text
  annotation, then emits the `shift.forced_close` audit event.

**Spec citations:** FR-024 (operator-bound shifts; forced close;
manager-attributable; cashier `declared_count` recorded as **null /
absent**; reason from a fixed enumerated set), FR-026 (`shift.forced_close`
distinct from `shift.close`), Edge Cases (takeover-stranded shift,
manager-forced-close-from-different-terminal, cashier-returns-after-
forced-close), PR-1 (no PIN values; no credential material in audit
payload), PR-5 (manager-attributable).

**Visibility (role-visibility-matrix.md §Section 3):** ⛔ for cashier;
👀 for manager and admin. Existence MUST NOT be visible on any
cashier-reachable surface.

### Surface 4A — Stuck-shift list

Layout sketch (≥ 1280 px viewport, default state):

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Stuck shifts                                  Branch: Pharmacy Downtown   │
│  ────────────                                                              │
│                                                                            │
│  Shifts that need a forced close. The opening cashier could not close      │
│  their shift; closing here records you as the closing manager.             │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  Layla A.       opened 2026-05-05 09:14         POS-03               │ │
│  │  Cashier        Open for 6 h 12 min                          [Close] │ │
│  ├──────────────────────────────────────────────────────────────────────┤ │
│  │  Karim H.       opened 2026-05-05 14:02         POS-04               │ │
│  │  Cashier        Open for 1 h 24 min                          [Close] │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  No other stuck shifts on this branch.                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

Components used:

| Region | Component | Source |
|:--|:--|:--|
| Page heading + branch label | `PageHeader` (003) | 003 |
| Help text | `Text` body (003) | 003 |
| Stuck-shift row | `Card` (003) per row, OR `Table` (003) — see §"Open design choice" below | 003 |
| Per-row "Close" button | `Button` variant=`primary` (003) | 003 |
| Empty-list note | `EmptyState` (003) when no stuck shifts | 003 |

Content rules:

- Each row shows: **opening cashier display name + business role
  ("Cashier")**, **opened-at timestamp** (locale-formatted), **how long
  the shift has been open** (relative humanised duration), **terminal
  label** the shift was opened on, **\[Close\] button**.
- The list is filtered server-side to the manager's authorised branches
  (P17). Cross-branch stuck shifts are NOT shown even if technically the
  manager has visibility into another branch — each row is unambiguously
  in the *current* branch.
- When the list is empty, an `EmptyState` shows "No stuck shifts on this
  branch." (NOT "0 stuck shifts" — wording matters for clarity.)
- The stuck-shift count appears in the list header? **NO** — not in S0's
  visual direction. Counts are easy to add later if needed; not adding
  them now keeps the surface simple.
- Sort order: oldest-opened first (the most-stuck shift is at the top —
  most operationally urgent).
- "Close" button label: **"Close"** alone (NOT "Force close"). The
  forced-close framing is preserved internally and in the audit event,
  but the manager's UX action is just "close" — they're closing a stuck
  shift; the system structurally records it as a forced close because of
  the absent declared count.

### Open design choice (decision deferred to S5 task)

The list could be rendered as a stack of `Card`s (one per shift) or as a
`Table` (rows). Both are 003 primitives. The contact sheet does not pick;
the S5 implementation task picks based on the data density expected at
realistic operating scale (a pharmacy may have 1–5 stuck shifts at a time
peak, more if the takeover-supersession path is hit during a fire-alarm
evacuation; both card and table render acceptably at this scale). The
review record below MAY note a preference; the S5 task is bound by it.

### Surface 4B — Forced-close form

Layout sketch (modal opening from Surface 4A on row click):

```
                  ┌──────────────────────────────────────────┐
                  │                                          │
                  │   Force-close shift                       │
                  │   ──────────────────                      │
                  │                                          │
                  │   Cashier:    Layla A.                   │
                  │   Opened:     2026-05-05 09:14           │
                  │   Terminal:   POS-03                     │
                  │   Duration:   6 h 14 min                 │
                  │                                          │
                  │   Why is this shift being closed?         │
                  │   ┌────────────────────────────────────┐ │
                  │   │ ◉ Takeover from another terminal   │ │
                  │   │ ○ Cashier no-show                  │ │
                  │   │ ○ Cashier illness                  │ │
                  │   │ ○ Terminal failure                 │ │
                  │   │ ○ Other                            │ │
                  │   └────────────────────────────────────┘ │
                  │                                          │
                  │   Notes (optional, for support only):    │
                  │   ┌────────────────────────────────────┐ │
                  │   │ This is not the structural reason. │ │
                  │   │                                    │ │
                  │   └────────────────────────────────────┘ │
                  │                                          │
                  │   ┌─────────────────┐  ┌──────────────┐ │
                  │   │  Force-close    │  │    Cancel    │ │
                  │   └─────────────────┘  └──────────────┘ │
                  │                                          │
                  └──────────────────────────────────────────┘
```

Components used:

| Region | Component | Source |
|:--|:--|:--|
| Modal frame | `Dialog` (003) | 003 |
| Read-only shift summary fields | `DescriptionList` (003) | 003 |
| Reason picker | `RadioGroup` (003) | 003 |
| Annotation textarea | `Textarea` (003) | 003 |
| Submit | `Button` variant=`primary` (003) | 003 |
| Cancel | `Button` variant=`secondary` (003) | 003 |

Content rules — the load-bearing blind-close rules:

- **The form MUST NOT contain**:
  - A drawer-count entry field. (FR-024(a) — the manager does NOT enter
    a count on the cashier's behalf; the cashier's `declared_count`
    remains **absent**.)
  - An expected-total display.
  - A variance / shortage / overage display.
  - Any of the Cashier-Forbidden Information catalogue items.
  - The PIN of the absent cashier.
- **Read-only summary fields** shown (these ARE manager-visible and
  necessary for the manager to identify the shift):
  - Cashier display name + role label.
  - Opened-at timestamp.
  - Terminal label the shift was opened on.
  - Duration the shift has been open (humanised).
- **Reason picker (RadioGroup)** — the five fixed values from FR-024(c):
  - "Takeover from another terminal" → `forced_close_reason: takeover_supersession`
  - "Cashier no-show" → `forced_close_reason: cashier_no_show`
  - "Cashier illness" → `forced_close_reason: cashier_illness`
  - "Terminal failure" → `forced_close_reason: terminal_failure`
  - "Other" → `forced_close_reason: other`
  Default selection: **none** (manager must explicitly pick). Submit is
  disabled until a radio is selected.
- **Annotation textarea**:
  - Header copy verbatim: "Notes (optional, for support only):"
  - Body placeholder: "This is not the structural reason."
  - Maximum length: 500 characters (sensible upper bound; exact value
    confirmed in S5 task).
  - Free-text content lives in the audit event's `payload.annotation`,
    NEVER in `payload.forced_close_reason`. The two fields are
    structurally distinct (FR-024(c)).
  - Annotation MUST NOT be required; submit succeeds with an empty
    textarea.
- **Submit button label**: **"Force-close"** (verbatim — this is the
  visual emphasis that this is a recovery action, not a normal close).
- **Cancel button**: closes the modal without emitting an audit event;
  the stuck shift remains open.

States:

| State | Trigger | Visual change |
|:--|:--|:--|
| `default` | Modal mounted | No reason selected; submit disabled. |
| `reason-picked` | Manager picks a radio | Submit enables. |
| `submitting` | Submit clicked | Submit shows a spinner; both buttons non-interactive. |
| `success` | `shift.forced_close` audit event emitted; shift transitions to `closed_forced` | Modal unmounts; the shift disappears from Surface 4A's list (one row fewer). |
| `error` | Bridge refusal (role mismatch, branch mismatch, shift already closed by another path, network unreachable) | Generic error inline; the modal stays open; submit becomes available again. The error message is generic per NFR-003 / PR-2. |

### Cashier-returns-after-forced-close (Edge Cases)

When a cashier whose shift was force-closed signs back in (on this or
another paired terminal, after PR-5 reset if needed), they MAY see an
informational notice on the shell — but NOT on this surface. The notice's
visual treatment is described in Surface 6 (generic-failure surface)
because it shares the "minimum-disclosure" framing. **It MUST NOT show**:
expected total, declared count (which is null), variance, shortage,
overage. It MAY show: that *a* shift of theirs was force-closed, the
date/time, the closing manager's name, and "for details, ask your
manager".

### Keyboard / touch path

- Surface 4A: arrow keys / Tab navigate the row list; Enter on a row opens
  Surface 4B's modal.
- Surface 4B: Tab cycles `radio-group → textarea → Force-close → Cancel
  → close (✕)`. Escape cancels.

### 003 alignment checks

- [ ] Surface 4A uses 003's page-header pattern.
- [ ] Surface 4B uses `Dialog` from 003's inventory.
- [ ] `RadioGroup` uses 003's RadioGroup primitive (44 × 44 px touch
      target on each radio + label).
- [ ] `Textarea` uses 003's primitive; placeholder styling per 003.
- [ ] No drawer-count field, no expected-total field, no variance field
      anywhere on Surface 4A or 4B (blind-close discipline verified by
      visual review).
- [ ] axe-clean on default + reason-picked states of Surface 4B.
- [ ] At 1024–1279 px, Surface 4A row content reflows; Surface 4B modal
      width contracts.

### Out of scope (notable)

- Sorting / filtering on Surface 4A. (Operationally: the list is short.)
- Bulk forced-close. (Each shift requires its own audit event with its
  own `event_id`; bulk operations are an anti-pattern for audit
  attribution.)
- Showing the audit log of prior forced closes on this surface. (FR-029
  — audit log is a future feature.)
- Edit / undo of a forced close. (FR-028 — audit events are append-only;
  corrections are new compensating events.)

---

## Surface 5 — Role indicator slot

### Purpose

Persistent visual confirmation of the currently-signed-in operator's
identity and role, in 003's existing role-indicator slot in the shell's
top-bar region. Updates immediately on sign-in, sign-out, and (in future
features that introduce role-changing flows) any role change.

**Spec citations:** FR-002 (machine identifier ↔ business name 1:1
correspondence), FR-004 (display name + role only — no email/phone),
FR-020 (always visible in fixed location consistent with 003), Constitution
Principle VII (`cashier_id` in structured logs is opaque; FR-032).

**Visibility (role-visibility-matrix.md §Section 3):** ✅ for all roles —
each operator sees *their own* role indicator.

### Layout sketch (top-right of 003's shell header)

```
                                    ┌─────────────────────────────┐
                                    │   Layla A.                  │
                                    │   Cashier / Operator        │
                                    └─────────────────────────────┘
                                    ↑ 003's existing role-indicator slot
```

For each role:

```
┌────────────────────────────────────┐
│   Layla A.                         │
│   ◉ Cashier / Operator             │   ← cashier role
└────────────────────────────────────┘

┌────────────────────────────────────┐
│   Mariam S.                        │
│   ◐ Shift Manager                  │   ← manager role
└────────────────────────────────────┘

┌────────────────────────────────────┐
│   Mostafa K.                       │
│   ★ Owner / Admin                  │   ← admin role
└────────────────────────────────────┘
```

### Components used

| Region | Component | Source |
|:--|:--|:--|
| Slot frame | 003's existing `RoleIndicatorSlot` region (003 reserved this) | 003 inventory |
| Operator badge content | `OperatorBadge` (NEW) | 004 |
| Display name | `Text` `text-base` weight 500 (003) | 003 |
| Role label | `Text` `text-sm` weight 400 (003) | 003 |
| Role icon | A small icon (◉ / ◐ / ★ are placeholder; final glyphs from 003's icon set) | 003 |

### Content rules

- **Display name**: `Operator.display_name` (FR-004); short string from
  Clerk. Maximum two visual lines; truncate with ellipsis.
- **Role label**: the **business name** (Cashier / Operator, Shift
  Manager, Owner / Admin) per FR-002; NOT the machine identifier
  (`cashier`, `manager`, `admin`). Machine identifiers are for code; the
  shell shows business names.
- **Role icon**: visually distinct per role (icon + text per P14, never
  color alone). Icon glyph chosen by the design pass; the contact sheet
  reserves the slot but does not lock the glyph.
- **Color**: roles SHOULD have subtly distinct color treatment (e.g.,
  cashier neutral, manager accent, admin emphasis), with the constraint
  that the distinction is supplementary to the icon + text — color alone
  MUST NOT carry the role information.
- **Click behavior**: clicking the role indicator opens a small dropdown
  with one item: **"Sign out"**. (This is the FR-008 sign-out
  affordance.) The dropdown MUST NOT show: email, phone, sign-in time,
  shift status, or any other operator-attributable info beyond what's
  already in the slot.
- **No email or phone is ever displayed**, even on hover/long-press
  (FR-004 / FR-031).

### States

| State | Trigger | Visual change |
|:--|:--|:--|
| `signed-out` | No operator session active | Slot is **empty** (the role-indicator region renders nothing — the shell is at `/sign-in` so the slot's parent isn't even mounted; this state is documented for completeness). |
| `cashier` | Cashier session active | Render with cashier styling. |
| `manager` | Manager session active | Render with manager styling. |
| `admin` | Admin session active | Render with admin styling. |
| `signing-out` | Sign-out in flight | The slot stays visible but becomes non-interactive (the dropdown is dismissed if open); it unmounts when the route transitions to `/sign-in`. |
| `dropdown-open` | Slot clicked | A small dropdown opens below the slot showing "Sign out". |

### Keyboard / touch path

1. The slot is a button (semantic) reachable by Tab from the shell's main
   navigation.
2. Enter / Space opens the dropdown.
3. Arrow keys navigate the dropdown items (just one for now: "Sign out").
4. Enter activates "Sign out".
5. Escape closes the dropdown.

### 003 alignment checks

- [ ] Slot occupies the exact pixels 003 reserved for the role indicator.
- [ ] Display name typography matches 003's `text-base` weight 500.
- [ ] Role label typography matches 003's `text-sm` weight 400.
- [ ] Touch target ≥ 44 × 44 CSS px on the slot itself.
- [ ] Role icon visually distinct per role; icon + text + (subtle) color,
      never color alone (P14).
- [ ] Dropdown uses 003's `Menu` primitive.
- [ ] axe-clean on every role variant.
- [ ] At 1024–1279 px, the slot may render with icon + display name only
      (role label hidden behind a tooltip on hover, OR truncated to the
      first letter of the role); the design pass picks. The choice is
      bound to be consistent with how 003's icon-only navigation rail
      behaves at the same viewport.

### Out of scope (notable)

- "Switch operator" affordance (sign out + sign in as someone else in one
  flow). (Hard Non-Implementation Boundary — explicit sign-out, then
  explicit sign-in.)
- Operator avatar / photo. (FR-031 / no PII beyond display name.)
- Multi-role indication. (FR-002 — exactly one role per operator.)
- Branch / tenant indication in the slot. (Already in the shell header
  per 003.)

---

## Surface 6 — Generic sign-in failure state

### Purpose

The minimum-disclosure error variant for sign-in failures. NFR-003 / PR-2
mandate that user-visible errors MUST NOT distinguish among "wrong
credential", "no such account", "tenant/branch mismatch", "account
disabled", "rate-limited" (which has its own variant under PR-3), or
"network unreachable" (which has its own variant — see below).

This surface is not a separate route; it is the **error-state overlay** on
Surfaces 1, 2, and 3. Specifying it once here keeps the error UX
consistent across all sign-in entry points.

**Spec citations:** NFR-003 (single generic message variant per outcome
family), FR-007 (failure modes reported with generic user-visible
messages), PR-1 (no credential value in the visible error or in logs),
PR-2 (single generic message; rate-limited may be the second generic
variant), PR-3 (lockout-specific message wording).

### The three generic message variants

004 honours **exactly three** user-visible error variants across all sign-
in failure modes. No fourth variant is added; if a new failure mode
appears in a later feature, it maps onto one of the three or the new
feature owns the variant introduction with its own approval gate.

| Variant | Wording (verbatim) | Triggers |
|:--|:--|:--|
| **A. credentials_not_recognised** | "Credentials not recognised. Please try again." | Wrong password, wrong PIN, no roster pick, disabled account, tenant/branch mismatch, cashier identity not provisioned on this terminal, `cashier_pin_records` row missing, account that does not exist. (Single generic family; NFR-003.) |
| **B. too_many_attempts** | "Too many attempts. Please wait a moment before trying again." | PR-3 lockout for a cashier on this terminal; AND any backend rate-limit response on the manager/admin path. The wording does NOT disclose lockout duration, whether per-cashier or per-terminal, or which prior failure triggered the lockout. (PR-3 / PR-2 exception.) |
| **C. no_connection** | "No connection. Please check the network and try again." | Network unreachable during sign-in (manager/admin Clerk call OR cashier Clerk-identity validation OR audit-event sync at sign-in time). The connection-state indicator independently transitions to `offline` per 003. |

### Layout sketch — variant A (credentials_not_recognised) on Surface 1

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [SmartDataPulse logo]   Branch: Pharmacy Downtown   Terminal: POS-03  ●  │
│                                                                            │
│   Pick your name                                  Enter your PIN           │
│                                                                            │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐    ┌─────────────────┐     │
│   │  Layla A.  │ │  Mariam S. │ │  Karim H.  │    │   • • • •       │     │
│   │  Cashier   │ │  Cashier   │ │  Cashier   │    │                 │     │
│   └────────────┘ └────────────┘ └────────────┘    └─────────────────┘     │
│                                                                            │
│                                                    ┌────────────────────┐ │
│                                                    │ ⚠ Credentials not  │ │
│                                                    │   recognised.      │ │
│                                                    │   Please try again.│ │
│                                                    └────────────────────┘ │
│                                                                            │
│                                                    [PIN pad]              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Visual treatment

- **Inline alert region** below the PIN pad (Surface 1) or below the
  password field (Surface 2). Uses 003's `InlineAlert` component, variant
  `error` for variants A and B, variant `warning` for variant C.
- **Icon + text**, never color alone (P14). The ⚠ glyph is from 003's
  icon set.
- **Auto-dismissal**: the alert dismisses automatically when the user
  modifies any input (a new digit on the PIN pad, a keystroke in the
  password field, a roster card click). It does NOT dismiss on a timer
  alone. Rationale: if the cashier walks away mid-error, the next person
  to walk up should still see the error so they know something went
  wrong; dismissing on timer would silently swallow the failure signal.
- **Persistent across re-attempts** in a chain: if the cashier types a
  wrong PIN, sees variant A, types another wrong PIN, the alert stays
  visible (perhaps with a brief animation refresh), preserving the
  signal that "this attempt also failed."

### Variant B (too_many_attempts) layout

Identical visual structure to variant A; only the message text differs.
Additionally:

- The PIN pad (Surface 1) becomes non-interactive — keys are visibly
  greyed; numeric input is ignored. Tap on a key produces no response.
  The roster cards become non-interactive too (no point picking a new
  cashier when the first is locked).
- A small countdown timer is **NOT shown** (PR-3 — lockout duration is
  not disclosed). The cashier is left to wait or ask a manager.
- A "Get help from a manager" affordance MAY appear below the inline
  alert as a tertiary `Button` variant `link`. Clicking it does not
  unlock anything; it merely shows a tooltip / informational text:
  "Ask a manager to unlock your sign-in." (PR-3 release path b is the
  manager unlock; PR-5 path b.)
- The lockout state of the PIN pad releases when (a) the timer expires
  on the verifier side and a fresh sign-in attempt would now succeed
  (the next user input would re-enable the pad), or (b) the manager
  performs an unlock on this terminal (the bridge can push a state
  refresh; the pad becomes interactive again).

### Variant C (no_connection) layout

Identical visual structure but with `warning` styling (yellow/amber per
003's warning token, not red). Additionally:

- The connection-state indicator at the top-right transitions to
  `offline` per 003.
- A "Try again" button MAY appear below the alert. Clicking it re-attempts
  the most recent sign-in submission (manager/admin: re-submits the form;
  cashier: re-submits the cached roster pick + PIN entry, which DOES NOT
  require re-entering the PIN, but it is held in the PinPad's transient
  state for the duration of this surface). The PIN value is NOT
  persisted across application reloads (FR-010 / PR-1).

### Cashier-returns-after-forced-close informational notice (referenced from Surface 4)

When a cashier whose shift was force-closed signs back in successfully
(after the PR-5 manager-attributable reset, if PIN reset was also
needed), the **post-sign-in shell** shows a non-modal informational
banner — NOT on this Surface 6, but on the operator-bound landing
surface of 003's shell, using 003's `Banner` primitive (variant `info`,
dismissable). The banner content is:

- "A previous shift of yours was closed by a manager on \[date\]."
- A small "View details" link that opens a *manager-side* contact form
  ("Ask a manager about this") — NOT a financial-detail surface.
- Dismissable; once dismissed, does not re-appear on subsequent sign-ins.

This banner MUST NOT show: expected total, declared count (null),
variance, shortage, overage, the closing manager's reason category, the
closing manager's annotation. It MAY show: that *a* shift was closed,
the closing date, that "your manager has the details."

The banner lives in the shell-banner region 003 already defined; it does
not need a new layout.

### 003 alignment checks (across all three variants and the cashier-returns banner)

- [ ] `InlineAlert` (or 003's equivalent) used consistently across
      Surfaces 1, 2, 3.
- [ ] Variant colors come from 003's existing semantic tokens (error,
      warning).
- [ ] Icon + text + color (never color alone).
- [ ] axe-clean for each variant.
- [ ] Cashier-returns banner uses 003's `Banner` primitive, variant
      `info`.

### Out of scope (notable)

- Distinguishing among the variant-A failure modes in any UI surface.
  (NFR-003.)
- Showing the lockout duration. (PR-3.)
- Logging the variant the user saw. (FR-032 — generic UI lifecycle logs;
  PR-1 — no credential material near the log entry.)
- Disclosing tenant/branch mismatch even at the support level: the
  bridge logs the rejection internally with an opaque operator
  reference (FR-032), but the user sees only variant A.
- "Email me a sign-in link" / "SMS me a code" recovery paths. Out of
  scope; deferred.

---

## §A1 / §A2 status (recorded for the review record)

### §A1 — local-unlock-factor approval (LOAD-BEARING)

- **Status:** ⏳ **UNRESOLVED.**
- **Owner:** *Not yet assigned.* The plan recommends path 1 (a small
  constitutional clarification clause: "a local terminal unlock factor
  is not a custom user database within the meaning of Principle VIII,
  provided canonical identity remains in Clerk, the factor is not
  consulted by any backend endpoint, and audit attribution uses the
  Clerk-backed identity, not the factor record").
- **Blocks:** Slices 3, 4, 5, 6 (everything beyond Slices 0, 1, 2).
  Specifically, §A1 blocks: any migration (§A3), any OpenAPI change
  (§A2's cashier-PIN-related subset is moot — the PIN factor introduces
  ZERO new backend endpoints by design), any IPC/preload change beyond
  the manager/admin Clerk path, any backend change for the cashier path,
  any SecretStore/`safeStorage` change for PIN material, any cashier-PIN
  storage or verification implementation.
- **Action required before `/speckit-tasks`:** §A1 must have a visible
  owner and a resolution path picked. The recommended path is the
  clarification amendment. Alternative 1 (Clerk/password for everyone —
  cashiers swap to a password) is the fallback if §A1 denies; Slice 4
  reduces to a UX swap on Surface 1, and PR-1…PR-6 dissolve into the
  existing manager/admin Clerk path. Alternative 3 (deferred Clerk
  custom-factor) is the long-term direction.

### §A2 — backend OpenAPI endpoint approval

- **Status:** ⏳ **UNRESOLVED.**
- **Owner:** *Not yet assigned.* Five endpoint approvals are required;
  contracts/backend-endpoints.md describes each.
- **Blocks:** Slice 1 (sign-in / sign-out for managers/admins), Slice 3
  (audit-events sync), Slice 4 (roster fetch + takeover-confirm), Slice
  5 (`shift.forced_close` audit-event recognition).
- **Action required before `/speckit-tasks`:** §A2 must have a visible
  owner on the SmartDataPulse backend repo side. Each endpoint lands as
  a separate backend feature ticket; once each endpoint's OpenAPI spec
  is merged, the POS Pulse `codegen:api` task pulls the regenerated
  types and `codegen:verify` confirms determinism (Constitution V).

### Why both gates matter for Slice 0 review

Slice 0 itself is **not blocked** by §A1 or §A2 — visual direction is
non-code, requires no migrations, no OpenAPI, no IPC. The visual-direction
contact sheet can be reviewed and signed off independently. **However,
the *next* command after this slice's review must reflect the gates'
status:** Slice 0 review may pass while §A1 and §A2 are still
unresolved, but `/speckit-tasks` MUST NOT be invoked until both gates
have visible owners (and §A1 has a chosen resolution path).

The recorded path forward after this contact sheet's review:

1. **Slice 0 review pass** (this document → reviewer signs off below).
2. **§A1 owner assigned**, resolution path picked.
3. **§A2 owner assigned** on the backend side.
4. **Then** `/speckit-tasks` is invoked. Tasks file schedules slices
   1–6 behind their gates; slices 3–6 explicitly hold until §A1
   resolves.

---

## Review Record

This section is the FR-033 enforceable gate. The review is complete when
a reviewer signs below with date, agreement / dissent, and any findings.
Future implementation slices MUST cite this review record in their PR
descriptions.

### Slice 0 visual direction review

**Reviewer:** Ahmed
**Date:** 2026-05-05
**Result:** **approved-with-revisions** (three minor notes recorded below; none are blocking. The artifact may proceed to its consumers as-is; the notes are tactical clarifications the S1/S4/S5 slice authors must honour. None of the notes require a re-review cycle.)

**Surfaces walked:**

- [x] Surface 1 — Cashier sign-in (roster + PIN)
- [x] Surface 2 — Manager / Admin sign-in (password)
- [x] Surface 3 — Explicit takeover prompt
- [x] Surface 4 — Forced-close manager recovery surface (4A list + 4B form)
- [x] Surface 5 — Role indicator slot
- [x] Surface 6 — Generic sign-in failure state (variants A / B / C +
      cashier-returns banner)

**Cross-cutting commitments verified:**

- [x] Tokens — color, spacing, typography, radius, shadow all from 003.
      Confirmed: no new color, spacing, or typography tokens introduced
      by 004; the artifact uses only 003's `tailwind.css` `@theme`-block
      values + 003's `--shadow-1` / `--shadow-2`.
- [x] Density — `comfortable` only; touch ≥ 44 × 44 CSS px.
      Confirmed: PIN pad keys, roster cards, password-form submit, takeover
      prompt buttons, forced-close form radios, role-indicator slot all
      explicitly cite the 44 × 44 floor; no `compact` density introduced.
- [x] Viewport — primary ≥ 1280 px; secondary 1024–1279 px; below 1024 px
      uses 003's existing fallback. Each surface's reflow at 1024–1279 px
      is named (Surface 1: roster grid contracts; Surface 2: form card
      width contracts; Surface 3: modal width contracts; Surface 4B: modal
      width contracts; Surface 5: role label may truncate to icon + name).
- [x] Connection-state indicator — 003's four-state visual; no new states.
      Confirmed: indicator location at top-right of `/sign-in` recorded;
      003's four-state model used unchanged; `syncing` remains visual-only.
- [x] Navigation rail visibility decision recorded (hidden on `/sign-in`,
      visible during takeover modal and forced-close modal). Decision
      recorded at the cross-cutting block AND propagated into Surface 3
      (rail visible behind takeover modal, dimmed by 003's scrim).
- [x] Accessibility floor — keyboard path documented per surface; axe-
      clean targets on default states; focus rings visible. Each surface
      has an explicit "Keyboard / touch path" subsection with tab order;
      icon + text + (optional) color used consistently per P14, never
      color alone.
- [x] Locale direction — logical CSS properties only. Cross-cutting block
      cites `inline-start` / `inline-end`; no `left` / `right` baked into
      the surface specs.

**Security / visibility commitments verified (Ahmed-added review axis,
beyond the artifact's own cross-cutting list):**

- [x] **Cashier-Forbidden Information catalogue (FR-015)** — none of the
      14 forbidden items appear on any cashier-reachable surface in this
      contact sheet. Verified by walking each surface's "MUST NOT contain"
      lists against the catalogue in role-visibility-matrix.md §Section 4.
- [x] **Blind-close discipline (FR-021 / FR-024(a))** — Surface 4B's
      forced-close form spec is exhaustive on the negative-space list:
      no drawer-count entry field, no expected-total display, no variance
      / shortage / overage display, no PIN value, none of the catalogue
      items. The manager records the cashier's *absence of declared
      count*, never a count on the cashier's behalf. Confirmed.
- [x] **Takeover prompt minimum-disclosure (FR-013)** — Surface 3's
      "MUST NOT appear" list correctly bars: terminal-A label, prior
      session start time, prior-operator identity, prior-session role,
      "View details" / progressive-disclosure leaks, tooltip leaks.
      Confirmed.
- [x] **Generic-failure three-variant cap (NFR-003 / PR-2 / PR-3)** —
      Surface 6 honours exactly three user-visible variants: variant A
      (credentials not recognised), variant B (too many attempts), variant
      C (no connection). Verified that variant A's trigger list covers
      every spec-named failure mode (wrong password, wrong PIN, no roster
      pick, disabled account, tenant/branch mismatch, missing PIN record,
      account-does-not-exist) without distinguishing them. Variant B's
      "no countdown timer shown" rule honours PR-3.
- [x] **Cashier-returns-after-forced-close banner (FR-024 + Edge Cases)** —
      Surface 6's banner spec correctly bars: expected total, declared
      count (which is null), variance, shortage, overage, the closing
      manager's reason category, the closing manager's annotation. The
      banner only shows that *a* shift was closed + the closing date +
      "ask your manager for details". Confirmed.
- [x] **Role-indicator dropdown minimum-disclosure (FR-004 / FR-031)** —
      Surface 5's dropdown shows only "Sign out"; not email, phone,
      sign-in time, shift status, or any other operator-attributable
      info beyond what the slot already shows. Confirmed.

**Findings / revisions requested:**

Three minor notes. None block sign-off. Each names the slice that owns
the follow-up so it doesn't drift.

**Note 1 (S1 owner — minor clarification on Surface 1's `submitting`
state).** Surface 1's `submitting` state spec says "the surface stays
visible to confirm the cashier's choice was received" and "a small
spinner appears in the `↵` key". Surface 6 separately says variant-A
errors auto-dismiss when the user modifies any input. The interaction
between *resubmitting after an error* (cashier sees "credentials not
recognised" → types a new PIN → submits again) and the spinner is not
explicitly named. Resolution for S1: when a fresh submit replaces a
prior error, the inline alert dismisses on first new keystroke (per
Surface 6's auto-dismissal rule), and the new submit's spinner replaces
the prior alert's space rather than rendering alongside it. S1's tests
should cover the error → retype → spinner state transition explicitly.
Not a blocker; flagged for S1 task author.

**Note 2 (S4 owner — manager-only "stuck-shift exists" indicator on
Surface 4A).** Surface 4A's spec says "When the list is empty, an
`EmptyState` shows 'No stuck shifts on this branch.'" but is silent on
whether the manager's general navigation should surface a *count badge*
when stuck shifts exist (e.g., "Stuck shifts (2)" in the navigation rail).
The role-visibility matrix's §Section 3 entry for stuck-shift list says
"⛔ for cashier; 👀 for manager" without specifying whether the count is
allowed in navigation. Resolution for S4: the count badge IS allowed on
manager / admin navigation (consistent with 👀); MUST NOT be visible
when the rail is icon-only at 1024–1279 px (the icon already conveys
"there's a section for this"); MUST NOT be visible to cashiers regardless
of whether stuck shifts exist on this terminal (FR-024(d)). S4's task
should add a row to role-visibility-matrix.md §Section 3 for the
"stuck-shift count badge" surface to keep the matrix the canonical truth.

**Note 3 (S5 owner — Surface 4A rendering decision crystalised).**
Surface 4A's "open design choice" between `Card`-stack and `Table` is
explicitly flagged for the S5 task. As reviewer, I lean toward
`Card`-stack at this scale (a pharmacy will rarely have more than a
handful of stuck shifts at once; cards are easier to scan on a touch
display; row densities below the `Table` minimum hurt readability). S5
task is bound to revisit but should treat `Card`-stack as the preferred
default unless data-density evidence at integration time argues
otherwise. Recording the lean here so the S5 author has it.

**Out-of-scope items the artifact correctly defers** — confirmed and
endorsed:

- Cashier-self-service "I forgot my PIN" / "Reset my PIN" surface.
- "Switch operator" one-step affordance.
- MFA / second-factor for managers and admins.
- Operator avatar / photo.
- Multi-role accounts and role delegation.
- Operator audit-log read surface (FR-029 — future feature).
- "View details" expansion of the cashier-returns banner with financial
  detail (forbidden under FR-021's blind-close discipline; a future
  feature MAY introduce a manager-mediated explanation surface, but
  not a cashier-direct one).

**Reviewer signature line:**

```
Signed-off-by: Ahmed                                 Date: 2026-05-05
Result:        approved-with-revisions
Findings:      3 minor notes (Notes 1–3 above), none blocking
Next gate:     /speckit-tasks may be invoked once §A1 owner has begun
               Path 1 amendment work (§A1 already assigned to Ahmed)
```

### Open design choices flagged for S5 task

- Surface 4A row rendering: `Card`-stack vs `Table`. Default to
  `Card`-stack for consistency with the rest of the post-sign-in shell;
  S5 task confirms or overrides.

### Out-of-scope items recorded for future features

The following items came up during visual direction and are explicitly
deferred to later features. Listing them here keeps the next planning
cycle aware:

- Cashier-self-service "I forgot my PIN" / "Reset my PIN" surface.
- "Switch operator" one-step affordance.
- MFA / second-factor for managers and admins.
- Operator avatar / photo.
- Multi-role accounts and role delegation.
- Operator audit-log read surface (FR-029).
- "View details" expansion of the cashier-returns banner with financial
  detail (forbidden under FR-021's blind-close discipline; a future
  feature MAY introduce a manager-mediated explanation surface, but
  not a cashier-direct one).

---

## Next steps (for the user, not for this slice)

1. **Assign a reviewer** for this contact sheet. Sign-off recorded above.
2. **Assign §A1 owner** (recommended: constitutional-clarification PR
   per plan.md path 1).
3. **Assign §A2 owner** on the SmartDataPulse backend side.
4. **After all three above are done**, the next command is
   `/speckit-tasks`. Tasks file schedules Slices 1–6 behind §A1–§A4.

**Stopped after Slice 0 visual direction.** No tasks generated; no
implementation slices started; no source files created or modified;
no migrations; no OpenAPI changes; no IPC / preload / backend
implementation; no sales / cart / payments touched.
