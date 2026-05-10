---
description: "Task list for feature 007-pos-visual-system — slice-organised, gate-explicit, dependency-aware"
---

# Tasks: 007-pos-visual-system

**Feature:** 007-pos-visual-system — POS Visual System Recovery
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0
**Research:** [./research.md](./research.md)
**Quickstart:** [./quickstart.md](./quickstart.md)
**Contracts:** [./contracts/visual-reference-adjudication.md](./contracts/visual-reference-adjudication.md), [./contracts/screenshot-acceptance.md](./contracts/screenshot-acceptance.md)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-10
**Last Updated:** 2026-05-10

---

## 005 / 006 UI gate — load-bearing notice

Per spec NFR-014 and plan §"005 / 006 UI implementation gate", the **UI
implementation slices** of `005-sales-cart` and `006-payments-tender`
remain **blocked** until 007 Slices **S1, S2, and S3** are approved
(merged with reviewer-ticked exit criteria — see plan's per-slice
"Approval criteria for the 005 / 006 UI gate"). Non-UI 005 / 006 work
(planning, specification, contract design, data-model work, money-math
wiring, audit-attribution wiring) MAY proceed in parallel and is **not
held** by this gate. The gate is auditable via the per-slice criteria
below. The unblock decision is recorded by the reviewer in the relevant
005 / 006 implementing PR's description, citing the three 007 slice PRs
(S1 PR, S2 PR, S3 PR).

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Sn] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on
  other incomplete tasks in the same slice).
- **`[Sn]`** maps the task to its slice (S0 … S6). Setup, foundational,
  and polish phases have no slice label.
- All file paths are repository-relative (e.g. `src/renderer/ui/tokens/colors.ts`).
- **Test-first per Constitution Principle VI.** Within each slice, the
  test task MUST be written and seen to fail before its implementation
  task. The order below reflects this.
- **Analyze-driven additions use suffix infill** (`T070a`, `T019a`,
  `T010b`, etc.), per the 002 / 003 / 004 house convention. Suffix
  infill places each follow-up adjacent to the slice it belongs to,
  keeps the original `T001` … `T088` numbering stable so existing PR
  descriptions remain valid, and avoids renumbering across analyses.
  **Task IDs `T089` and beyond are reserved for any follow-up analyze
  task that does not naturally suffix onto an existing slice task.**
  *(Earlier drafts of this conventions block claimed `T080+` was the
  reserved range — that was incorrect because T080 … T088 are already
  used by S5 / S6 implementation tasks. Corrected by `/speckit-analyze`
  finding C1 on 2026-05-10.)*
- **Stop after PR per slice.** Each slice closes with an "Open PR + stop"
  task. Do NOT proceed to the next slice until the prior slice's PR is
  merged with reviewer sign-off recorded.
- **Renderer-only.** Every implementation task targets `src/renderer/`.
  Tasks that would imply main-process / preload / IPC / SecretStore /
  migration / OpenAPI / CI / Sentry changes are deliberately excluded
  per spec FR-046 / FR-047 / FR-048 / FR-048a / FR-049 / FR-050. The
  static no-touch source-scope guard inherited from 003 (forbidden
  allowlist) MUST hold for every implementation slice.
- **No design-tool generated source copied into production.** Per
  visual-reference-adjudication contract §"Reject — explicit by name",
  no JSX / HTML / CSS from `claude-design/design-system/` or
  `figma-make/POS-figam-2/` is to land in the repo.
- **No binary design files committed.** No PNG, JPG, ZIP, PDF, or
  generated source archive is staged or committed by any 007
  implementation slice. Screenshots attach to PR descriptions via
  GitHub uploads (NOT to the repo).

## Slice map

| Slice | Title | Required for 005 / 006 UI gate? |
|:--|:--|:--:|
| **S0** | Visual reference adjudication + current-UI screenshot baseline | No (sets up the gate; not part of it) |
| **S1** | Token layer + global CSS foundation | **YES** |
| **S2** | Shared primitives polish | **YES** |
| **S3** | Shell, sidebar, topbar, route layout primitives | **YES** |
| **S4** | Pairing and terminal-state surfaces | No (independent surface) |
| **S5** | Operator sign-in, roster, PinPad, TakeoverPrompt, OperatorBadge | No (independent surface) |
| **S6** | Screenshot / contact-sheet acceptance + regression checklist finalisation | No (closes 007's screenshot gate) |

**Sequencing.** S0 → S1 → S2 → S3 are strictly sequential (each gates
the next). S4 and S5 may run in parallel after S3 lands (their surfaces
are independent of each other). S6 closes 007 after all of S0–S5 are
merged.

## Per-slice validation commands

Every implementation slice's PR MUST pass the **full project
implementation validation set** locally before push:

```bash
npm run typecheck
npm run lint
npm test
npm test -- --coverage
npm run codegen:verify
```

`npm test` and `npm test -- --coverage` are listed separately on
purpose: the former exercises the full unit + integration suite under
the default reporter, the latter re-runs with the V8 coverage reporter
and enforces the per-directory thresholds. Both must pass.

`npm run codegen:verify` is **required** on every implementation
slice, not "only if relevant". For 007 this is expected to be a no-op
delta (all slices are renderer-only and no OpenAPI surface should
move), but the verify step is the only mechanical guarantee that no
out-of-band edit slipped a regenerated `src/shared/api-types.ts` into
the slice. A green `codegen:verify` is the test that confirms the
"no codegen change" scope claim.

`npm run package:dir` is **NOT** run per implementation slice; it is
run once at the S6 final-gate task (T087) on `windows-latest`. The
current PR (the tasks-definition PR) is docs-only and is validated by
`git diff --check` only — the implementation validation set above
does **not** apply to this PR.

The CI pipeline runs the full chain on every push.

---

## Phase 1 — Setup

No setup tasks. The plan, research, quickstart, and two contracts have
already merged via PR #109; the spec and checklist via PRs #107 + #108.
This tasks file is the only new artifact produced by `/speckit-tasks`.

---

## Phase 2 — Foundational (Blocking Prerequisites)

No foundational tasks. The token layer, primitive inventory, and shell
chrome already exist from 003 and 004; 007 is a restyle, not a build.

---

## Phase 3 — S0: Visual reference adjudication + current-UI screenshot baseline

**Slice goal:** Verify the merged contracts match the plan / spec; capture
a "before" baseline contact sheet of every existing surface so subsequent
slices have a deterministic visual comparison; tune pixel-diff thresholds
in the screenshot-acceptance contract if drift is found.

**Slice diff scope:** docs only. The visual-reference-adjudication and
screenshot-acceptance contracts are already merged via PR #109. S0 may
amend `screenshot-acceptance.md` only if pixel-diff threshold tuning is
required (per plan §"Risks & Open Items" §O1). Out-of-tree baseline
screenshots are captured but NOT committed.

**Slice independent test:** A reviewer reads the visual-reference-
adjudication contract and confirms it matches the plan's Visual Reference
Adjudication section verbatim; reads the screenshot-acceptance contract
and confirms the viewport matrix (1280 × 800 + 1024 × 768), per-surface
state matrix, pixel-diff thresholds, and forbidden-content rules are all
present; opens the out-of-tree baseline contact sheet and confirms it
covers every existing route at both viewport bands.

- [X] T001 [S0] **Verify the visual-reference-adjudication contract**
  against [./plan.md](./plan.md) §"Visual Reference Adjudication" and
  [./spec.md](./spec.md) FR-051. Confirm: source-of-truth order matches
  (repo > Claude Design > Figma Make > generated code); every adopt /
  adapt / reject item present; rejection-by-name catalogue lists
  `figma-make/POS-figam-2/default_shadcn_theme.css`,
  `figma-make/POS-figam-2/IMPLEMENTATION_NOTES.md`,
  `figma-make/POS-figam-2/src.zip`, all `.tsx` / `.css` / `.html`
  deliverables, all CD `design-system/*.jsx` and `*.css` files; theme
  decision (single light theme, Inter primary, no Inter Tight, JetBrains
  Mono fallback only) restated. Report any drift before proceeding.
  Output: a one-paragraph confirmation in the S0 PR description. NO
  changes to the contract unless drift is found.

- [X] T002 [S0] **Verify the screenshot-acceptance contract** against
  [./plan.md](./plan.md) §"Test Strategy" and the per-slice
  screenshot-acceptance gates. Confirm: viewport matrix
  (1280 × 800 + 1024 × 768) present; per-surface state matrix lists
  every surface category (pairing, roster, manager-admin sign-in,
  PinPad, TakeoverPrompt, signed-in shell cashier, placeholder routes,
  status banner, dialog); pixel-diff thresholds present (≤ 0.5 % layout-
  stable, ≤ 1.5 % animated); forbidden-content rules present
  (Cashier-Forbidden Information catalogue, FR-013 forbidden-string
  set, generic PII / credentials / cards exclusion, no emoji); reviewer
  sign-off protocol present; no-binary-files-committed rule present.
  Report any drift before proceeding. NO changes to the contract
  unless drift is found.

- [X] T003 [S0] **Set up the out-of-tree baseline directory.** Create
  `C:\Users\user\Downloads\pos-007-baseline\` (Windows) or
  `/c/Users/user/Downloads/pos-007-baseline/` (Git Bash). This directory
  is the canonical "before" baseline location. Subdirectories per
  surface category (e.g. `pairing/`, `paired/`, `sign-in-cashier/`,
  `sign-in-manager/`, `pin/`, `takeover/`, `shell/`, `placeholders/`,
  `screen-too-small/`). The baseline directory MUST NOT be inside the
  repo working tree.

- [X] T004 [S0] **Capture baseline contact sheet for the existing pairing
  surface.** Render `/pairing` at 1280 × 800 and 1024 × 768; capture
  PNG to `pos-007-baseline/pairing/` for default + pairing-in-progress
  + paired-success + error states. Tooling: Playwright if available, or
  manual browser capture. Confirm no PIN value, no JWT, no device token,
  no Clerk user id, no PII visible in any captured screenshot
  (forbidden-content rule).

- [X] T005 [P] [S0] **Capture baseline contact sheet for `/paired`.**
  Render at 1280 × 800 + 1024 × 768; capture default + "Continue to
  dashboard →" affordance state. Save to `pos-007-baseline/paired/`.

- [X] T006 [P] [S0] **Capture baseline contact sheet for sign-in
  cashier.** Render the cashier sign-in surface (roster + PIN pad);
  capture default, roster-picked, pin-entering (1-of-6 / full), error
  flash, locked-out, submitting states at 1280 × 800 + 1024 × 768. Save
  to `pos-007-baseline/sign-in-cashier/`. **Forbidden-content audit:**
  no PIN value visible in any state; PIN dot row markup is dot-only.

- [X] T007 [P] [S0] **Capture baseline contact sheet for sign-in
  manager / admin.** Render the manager / admin password form; capture
  default, entering, submitting, generic-failure variant A, variant B
  (rate-limited), variant C (no connection). Save to
  `pos-007-baseline/sign-in-manager/`.

- [X] T008 [P] [S0] **Capture baseline contact sheet for TakeoverPrompt.**
  Render the takeover modal in default-prompted, confirming, error
  states. Save to `pos-007-baseline/takeover/`. **Forbidden-string
  audit:** the captured DOM under `[data-testid="takeover-prompt"]`
  contains zero of: `POS-` (terminal label prefix), substring `ago`,
  `Cashier ` / `Manager` / `Admin` (other-operator role), 4-digit time
  pattern, `View details` / `Why am I seeing this` / `Show details`.

- [X] T009 [P] [S0] **Capture baseline contact sheet for the signed-in
  shell (cashier role).** Render the AppShell with cashier OperatorBadge,
  four connection-state variants (`online` / `degraded` / `offline` /
  `syncing`), at 1280 × 800 + 1024 × 768. Save to
  `pos-007-baseline/shell/`. **Cashier-walling audit:** zero items from
  the 004 FR-015 catalogue (shift totals, expected drawer cash, expected
  change-fund, declared cash count, shortage, overage, variance, reports,
  KPIs, manager-review data, audit log surfaces, admin surfaces, other
  operators' shift data) visible in the cashier shell.

- [X] T010 [P] [S0] **Capture baseline contact sheet for placeholder
  routes.** Render Dashboard, Sales, Cart, Receipt / Checkout, Inventory,
  Settings / Help placeholders in default + loading + empty + error
  variants at 1280 × 800. Save to `pos-007-baseline/placeholders/`.
  **Cashier-walling audit:** zero forbidden information; reserved
  `tender.*` and `totals.*` slots in the Receipt placeholder remain
  layout-only with the "Reserved for 005-checkout-payments" body.

- [X] T011 [P] [S0] **Capture baseline contact sheet for `ScreenTooSmall`
  fallback.** Render at < 1024 px effective width. Save to
  `pos-007-baseline/screen-too-small/`. Confirm no mobile hamburger
  drawer is rendered at any width.

- [X] T012 [S0] **Document current visual deficiencies in the S0 PR
  description.** Without changing source, list per-surface what reads
  "primitive" vs the recovered language target (e.g. "pairing card
  shadow too soft", "rail accent stripe missing on active row",
  "PinPad keys not 64 × 64"). The deficiency list informs S1–S5
  prioritisation; it does NOT itself produce code changes.

- [X] T013 [S0] **Confirm no design-generated code was copied** during
  S0 capture. A `git status` of the repo shows zero changes outside
  `specs/007-pos-visual-system/` (and even there, only an optional
  amendment to `screenshot-acceptance.md` if threshold tuning was
  required per plan §O1). The baseline screenshots remain out-of-tree.

- [X] T014 [S0] **(Optional, only if drift found in T001 / T002)** Amend
  `specs/007-pos-visual-system/contracts/screenshot-acceptance.md` to
  tune per-surface pixel-diff thresholds based on the baseline capture's
  measured noise. Document the measurement evidence in the S0 PR
  description.

- [X] T015 [S0] **Open S0 PR titled `docs(007 S0): visual reference
  adjudication review + baseline capture`.** Body cites the merged
  contracts (PR #109), lists per-surface baseline locations
  (out-of-tree paths), confirms forbidden-content audits passed,
  attaches the S0 deficiency document. PR body discipline: no
  `#86` / `#87`, no `Closes` / `Resolves`, no `Fixes #NNN`. **Stop
  after PR.** Do NOT begin S1 until the S0 PR is merged with reviewer
  sign-off.

---

## Phase 4 — S1: Token layer + global CSS foundation

**Slice goal:** Apply additive token deltas + value tweaks to
`src/renderer/styles/tailwind.css` and `src/renderer/ui/tokens/*.ts` so
the recovered visual language is available across every primitive and
every route. **Zero rename / repurpose / removal of any existing 003
token** (FR-003).

**Slice diff scope:**
- `src/renderer/styles/tailwind.css` — additive new tokens + value
  tweaks (no rename).
- `src/renderer/ui/tokens/colors.ts`, `radius.ts`, `shadow.ts`,
  `spacing.ts`, `typography.ts` — additive new exports (no rename, no
  removal of existing exports).
- `src/renderer/ui/tokens/__tests__/tokens.test.ts` — extend parity test.
- New guard tests added by S1 (see T018 + T019).

**Slice independent test:** A reviewer runs the full implementation
validation set — `npm run typecheck && npm run lint && npm test &&
npm test -- --coverage && npm run codegen:verify` — and confirms all
pass; opens `git diff origin/main...HEAD` and confirms zero rename /
repurpose / removal of any existing 003 token name; visually compares
the slice's contact sheet against the S0 baseline at the documented
pixel-diff thresholds.

- [X] T016 [S1] **Extend `src/renderer/ui/tokens/__tests__/tokens.test.ts`
  parity test (TEST-FIRST).** Add assertions covering every additive
  token planned for S1: `--color-surface-sunken`, `--shadow-inset`,
  `--space-9`, `--duration-1` / `--duration-2` / `--duration-3` /
  `--duration-4`, `--ease-out`, `--ease-in-out`. The test MUST fail
  initially (additive tokens don't exist yet); this confirms it's
  exercised.

- [X] T017 [S1] **Add additive tokens to
  `src/renderer/styles/tailwind.css`.** Per research §R0:
  - Color: `--color-surface-sunken: #EEF2F6` (distinct from existing
    `--color-surface-elevated`; use for PIN well, slot chips, keypad
    recess).
  - Shadow: `--shadow-inset: inset 0 1px 0 rgba(15,29,46,.04), inset 0
    0 0 1px rgba(15,29,46,.04)` (for sunken wells).
  - Spacing: `--space-9: 96px` (CD's outermost step; existing
    `--space-0..8` preserved verbatim).
  - Motion: `--duration-1: 80ms`, `--duration-2: 150ms`,
    `--duration-3: 220ms`, `--duration-4: 320ms`, `--ease-out:
    cubic-bezier(.2, .7, .25, 1)`, `--ease-in-out: cubic-bezier(.45,
    .05, .25, 1)`.
  Optional value tweak: `--color-rail` may move from the live
  `#0E1B2A` to CD's exact `#0B1726` if S0 reviewer prefers; otherwise
  preserve. Document the choice in the PR description.

- [X] T018 [S1] **Add `no-proprietary-brand-font` guard test under
  `src/renderer/styles/__tests__/no-brand-font.test.ts`.** Asserts:
  zero `@font-face` declarations under `src/renderer/styles/` reference
  `Inter Tight` (must remain absent), `JetBrains Mono` as a primary
  face (must only appear in `--font-family-mono` fallback chain), or
  any other proprietary brand font. Asserts the live
  `--font-family-sans` chain begins with `'Inter Variable', Inter,
  'Segoe UI', system-ui` (per FR-052 / A10). Asserts the live
  `--font-family-mono` chain begins with `ui-monospace`.

- [X] T019 [S1] **Add `no-prefers-color-scheme-follower` guard test
  under `src/renderer/styles/__tests__/no-dark-mode.test.ts`.** Asserts:
  no source file under `src/renderer/styles/` or `src/renderer/ui/`
  references `prefers-color-scheme` outside an explicit
  "ignore OS preference" comment-marked exception (none expected in
  007). Asserts no `.dark { … }` selector exists under
  `src/renderer/styles/`. Per spec FR-052.

- [X] T020 [P] [S1] **Add additive token TS exports to
  `src/renderer/ui/tokens/colors.ts`.** Add `surfaceSunken =
  'var(--color-surface-sunken)'` after the existing `surfaceElevated`
  export. Existing exports verbatim preserved. Re-exported from
  `src/renderer/ui/tokens/index.ts` if it aggregates.

- [X] T021 [P] [S1] **Add additive token TS exports to
  `src/renderer/ui/tokens/shadow.ts`.** Add `inset =
  'var(--shadow-inset)'`. Existing exports verbatim preserved.

- [X] T022 [P] [S1] **Add additive token TS exports to
  `src/renderer/ui/tokens/spacing.ts`.** Add `9: 'var(--space-9)'`.
  Existing entries `0..8` verbatim preserved.

- [X] T023 [P] [S1] **Add new motion-token module
  `src/renderer/ui/tokens/motion.ts`.** Exports: `duration` (object
  with `1`, `2`, `3`, `4` keys), `easing` (object with `out` /
  `inOut`). Re-export from `src/renderer/ui/tokens/index.ts`.

- [X] T024 [S1] **Run the parity test (T016) green.** All additive
  tokens now have both CSS-var entries and TS exports with matching
  names. The compact-density dead-token guard from 003 still passes.

- [X] T025 [S1] **Run validation locally** — full project
  implementation validation set. `npm run typecheck`, `npm run lint`,
  `npm test`, `npm test -- --coverage`, `npm run codegen:verify`. All
  green; the existing ≥ 90 % coverage gate on `src/renderer/ui/`
  holds; `codegen:verify` confirms no incidental
  `src/shared/api-types.ts` drift.

- [X] T026 [S1] **Capture S1 contact sheet** of every existing route at
  1280 × 800 + 1024 × 768, comparing against the S0 baseline. Save to
  `pos-007-after-s1/` (out-of-tree). Confirm pixel-diff ≤ 0.5 % for
  layout-stable surfaces, ≤ 1.5 % for animated regions. Reviewer
  sign-off recorded in the PR description.

- [X] T027 [S1] **005 / 006 UI gate — S1 approval criteria check.**
  Confirm by `git diff origin/main...HEAD` of the slice PR:
  - Zero rename / repurpose / removal of any existing 003 token name
    (auditable by listing every modified `src/renderer/ui/tokens/*.ts`
    export and verifying its name is unchanged from main).
  - The recovered semantic palette covers FR-005 minimum (surface,
    surface-muted, text-primary, text-muted, primary, danger, warning,
    success, neutral, focus); existing 003 tokens already cover this,
    S1 confirms.
  - `tokens.test.ts` parity test passes for both existing and additive
    tokens.
  Record the three confirmations in the S1 PR description with diff
  excerpts.

- [X] T028 [S1] **Open S1 PR titled `feat(007 S1): token layer additive
  deltas`.** Body cites the S0 baseline PR, lists every additive token
  added with its CSS-var + TS-export name, attaches the S1 contact
  sheet (out-of-tree path), records the 005 / 006 UI gate S1 approval
  criteria check (T027). PR body discipline: no `#86` / `#87`, no
  `Closes` / `Resolves`, no `Fixes #NNN`. **Stop after PR.** Do NOT
  begin S2 until S1 is merged with reviewer sign-off and the gate
  criterion is ticked.

---

## Phase 5 — S2: Shared primitives polish

**Slice goal:** Restyle the eleven 003 / 004 primitives to the recovered
visual language. Every primitive's public prop signature stays frozen
(spec FR-014 / FR-015 / FR-016 / FR-017 / FR-018 / FR-019 / FR-020 /
FR-021).

**Slice diff scope:** restyle in place under
`src/renderer/ui/primitives/` and `src/renderer/ui/states/`.
Specifically: `Button`, `Card`, `Input`, `Dialog`, `StatusBanner`,
`LoadingState`, `EmptyState`, `ErrorState`, `Badge`, plus `Toast` and
`Table` for completeness. No new components; no API changes.

**Slice independent test:** A reviewer renders each primitive's variants
and states and confirms they match CD `02-components.md` for padding,
radius, focus-ring treatment, hover behaviour; runs the existing
primitive test suites and confirms all pass without prop-signature
changes; runs the touch-target invariant test on `Button` and confirms
≥ 44 × 44 CSS px.

- [X] T029 [S2] **Extend `Button.test.tsx` (TEST-FIRST)** to cover the
  recovered primary / secondary / ghost / destructive variants per CD
  `02-components.md`. Touch-target invariant test extended to cover
  `md` (44 px) and `lg` (52 px) sizes; small `sm` (36 px) is allowed
  ONLY for non-touch-primary surfaces (e.g. caption-area cancel) per
  CD. Public prop signature unchanged.

- [X] T030 [P] [S2] **Restyle `src/renderer/ui/primitives/Button/Button.tsx`**
  per CD §"Buttons": padding, height (44 / 52 / 36), radius
  `--radius-control` (10 px), hover behaviour (no transform),
  variants `primary / secondary / ghost / destructive`, loading state
  (label + 16 px spinner left, button disabled). Disabled state opacity
  0.5. **Public prop signature unchanged.** No new prop.

- [X] T031 [P] [S2] **Restyle `src/renderer/ui/primitives/Card/Card.tsx`**
  per CD §"Cards": background `--color-surface`, border `1px solid
  --color-border`, radius `--radius-card` (14 px), shadow
  `--shadow-card`, inner padding `--space-6` (32 px). Drop any
  left-border accent stripe if present. Hover (interactive cards):
  border darkens to primary-50 %; no shadow change. Public prop
  signature unchanged.

- [X] T032 [P] [S2] **Restyle `src/renderer/ui/primitives/Input/Input.tsx`**
  per CD §"Forms · `Input`, `Field`": 44 px tall (52 px in large),
  padding 0 14, border `1px solid --color-border`, radius
  `--radius-control`. Background `--color-surface`. Focus uses
  `--color-focus-ring`; error border `--color-danger`. Public prop
  signature unchanged.

- [X] T033 [P] [S2] **Restyle `src/renderer/ui/primitives/Dialog/Dialog.tsx`**
  per CD §"Dialogs / modals": centred 480 px wide (560 px in lg),
  padding 28 / 28 / 24 / 28, background `--color-surface`, border
  `1px solid --color-border`, radius `--radius-card`, shadow
  `--shadow-overlay`. Scrim `rgba(8,14,24,0.55)` solid — **no
  backdrop-filter blur**. Action row right-aligned, 12 px gap, ghost
  left of primary. Public prop signature unchanged.

- [X] T034 [P] [S2] **Restyle `src/renderer/ui/primitives/StatusBanner/StatusBanner.tsx`**
  per CD §"Status pills · `Badge`, `StatusBanner`": 48 px tall, soft
  background, hairline bottom border. Always non-blocking — never
  replaces page content. Four state intents (success / warning /
  danger / info); `info` is the syncing intent that pulses (1.6 s
  loop). Public prop signature unchanged.

- [X] T035 [P] [S2] **Restyle
  `src/renderer/ui/primitives/Badge/Badge.tsx`** per CD §"Status
  pills": pill shape (`--radius-pill`), height 26 px, semantic-soft
  background, dot 8 px solid semantic colour. Public prop signature
  unchanged.

- [X] T036 [P] [S2] **Restyle
  `src/renderer/ui/primitives/Toast/Toast.tsx`** per CD §"Components"
  Toast guidance: inset shadow, soft background, mono detail line.
  Use only for non-blocking confirmations (sign-out, sync). Refusals
  remain inline, NOT toast (per `messages.ts`). Public prop signature
  unchanged.

- [X] T037 [P] [S2] **Restyle
  `src/renderer/ui/primitives/Table/Table.tsx`** per CD §"Components"
  Table guidance: header / row roles, internal divider hairline
  `--color-border-soft`. No KPI / dashboard table styling — Table is
  layout-only for 007. Public prop signature unchanged.

- [X] T038 [S2] **Restyle
  `src/renderer/ui/states/LoadingState.tsx`** per CD §"Loading states":
  two patterns — (a) **in-shell skeleton** using the real `AppShell`
  chrome with body as a stack of `--color-surface-sunken` pill rows
  (8 px tall, varied widths 50–80 %, 8 px gap); (b) **center-stage
  info** for pairing only — single pulsing dot in `--color-info`,
  H1 page title, helper line, then a 3-step list. Variant prop
  ('skeleton' | 'centerStage') drives selection. **Public prop
  signature gains a documented additive `variant` prop ONLY** — see
  user's "safe additive prop" carve-out. Per-task explicit scope.

- [X] T039 [P] [S2] **Restyle
  `src/renderer/ui/states/EmptyState.tsx`** per CD §"Empty states":
  headline 22 / 700, one short-sentence body, single CTA. No
  illustration; no emoji. Lives inside the chrome where the data would
  have been; never replaces shell. Public prop signature unchanged.

- [X] T040 [P] [S2] **Restyle
  `src/renderer/ui/states/ErrorState.tsx`** per CD §"Error states":
  same layout as Empty. Icon: 32 px `--color-danger-soft` circle with
  stroke icon. Distinct from refusal — used for *the system*, not
  *the user*. Public prop signature unchanged.

- [X] T041 [S2] **`prefers-reduced-motion` invariance test** under
  `src/renderer/ui/__tests__/reduced-motion.test.tsx` covering Toast
  fade, Dialog fade-in, LoadingState skeleton pulse, StatusBanner
  syncing pulse. Each animation degrades to immediate state swap when
  `prefers-reduced-motion: reduce` is asserted. Per spec NFR-007.

- [X] T042 [S2] **axe baseline smoke** on every restyled primitive in
  default / hover / focus / disabled / loading / empty / error variants
  via `expectNoAxeViolations()`. Zero `serious` or `critical`
  violations.

- [X] T043 [S2] **Run validation locally** — full project
  implementation validation set. `npm run typecheck`, `npm run lint`,
  `npm test`, `npm test -- --coverage`, `npm run codegen:verify`. The
  ≥ 90 % gate on `src/renderer/ui/` holds; `codegen:verify` confirms
  no incidental `src/shared/api-types.ts` drift.

- [X] T044 [S2] **Capture S2 contact sheet** — per-primitive variants
  and states at 1280 × 800. Save to `pos-007-after-s2/` (out-of-tree).
  Reviewer sign-off recorded in the PR description.

- [X] T045 [S2] **005 / 006 UI gate — S2 approval criteria check.**
  Confirm:
  - Every primitive 005 / 006 will consume (`Button`, `Card`, `Input`,
    `Dialog`, `StatusBanner`, `Badge`, `Table`, plus state primitives)
    is restyled to the documented look.
  - Zero public prop signature changes (verified by `git diff` of every
    primitive's exported types). The `LoadingState` `variant` prop
    addition is documented as a safe additive prop in T038's PR
    description.
  - Touch-target invariant test passes on `Button`; per-component
    invariants pass.
  - axe baseline holds (zero `serious` / `critical`).
  Record the four confirmations in the S2 PR description with diff
  excerpts.

- [X] T046 [S2] **Open S2 PR titled `feat(007 S2): shared primitives
  polish`.** Body cites the S1 PR, lists every restyled primitive,
  attaches the S2 contact sheet, records the 005 / 006 UI gate S2
  approval criteria check (T045). PR body discipline: no `#86` /
  `#87`, no `Closes` / `Resolves`, no `Fixes #NNN`. **Stop after PR.**
  Do NOT begin S3 until S2 is merged with reviewer sign-off and the
  gate criterion is ticked.

---

## Phase 6 — S3: Shell, sidebar, topbar, route layout primitives

**Slice goal:** Restyle `AppShell`, `TopBar`, `NavRail`,
`IdentityStrip`, `ConnectionIndicator`, `OperatorSlot`, plus introduce /
restyle the layout primitives `<CenterStage>`, `<AppShell>`,
`<Workspace>` (per CD `05-implementation-translation.md` §E). Preserve
003 route / shell constraints verbatim; preserve `/paired` rail-hidden
vs rail-visible behaviour.

**Slice diff scope:** restyle in place under `src/renderer/shell/`. The
`<Workspace>` primitive is added under `src/renderer/shell/regions/` if
it doesn't exist (003 doesn't ship it as a separate primitive — it's
implicit in `AppShell`'s `<main>` region). `<CenterStage>` is added as a
new file under `src/renderer/shell/regions/`. Routes consume the new
primitives in S4 / S5 — S3 only introduces them.

**Slice independent test:** A reviewer renders the shell at the three
viewport bands (≥ 1280 px expanded, 1024–1279 px icon-only, < 1024 px
ScreenTooSmall) and confirms behaviour matches CD `02-components.md`;
renders the four connection-state variants and confirms each is
visually distinct without colour-only signal; confirms the role-
indicator slot renders the operator's display name + role only (no
PII / email / Clerk user id reachable via the rendered DOM).

- [X] T047 [S3] **Extend `AppShell.test.tsx` and the region test files
  (TEST-FIRST)** to assert recovered layouts: top bar 64 px, rail
  248 expanded / 84 icon-only / hidden < 1024 px, `<main>` workspace
  fills remaining space. The four connection-state visuals are
  asserted distinct via `data-connection-state` attribute + non-colour
  cues (icon, label position).

- [X] T048 [S3] **Restyle `src/renderer/shell/AppShell.tsx`** per CD
  §"App shell · `AppShell`": three regions only (top bar 64,
  rail 248 / 84 / 0, workspace fills). Layout uses logical CSS
  (`inline-start` / `inline-end`) per spec NFR-010. Public prop
  signature unchanged.

- [X] T049 [P] [S3] **Restyle `src/renderer/shell/regions/TopBar.tsx`**
  per CD §"Top bar · `TopBar`": fixed 64 px, background
  `--color-surface`, bottom border `1px solid --color-border`. Left
  cluster: SmartDataPulse wordmark + middle-dot + branch + terminal
  chip. Right cluster: `ConnectionIndicator`, `OperatorBadge`,
  `Sign out` ghost button. Terminal chip uses
  `--color-surface-sunken` background (introduced in S1) +
  `--font-family-mono` — never the device token.

- [X] T050 [P] [S3] **Restyle `src/renderer/shell/regions/NavRail.tsx`**
  per CD §"Nav rail · `NavRail`": width 248 expanded / 84 icon-only,
  background `--color-rail`, foreground `--color-rail-text` (NOT
  `text-inverse` — per research §R0 audit). Active row:
  `--color-rail-hover` background + 4 × 24 px `--color-accent` keyline
  on inside-start edge. Hover: `--color-rail-hover`, no transform.
  Manager-only rows omitted from cashier render (per 004 FR-015 / FR-019);
  never grey-disabled, never with a lock icon.

- [X] T051 [P] [S3] **Restyle
  `src/renderer/shell/regions/IdentityStrip.tsx`** per CD §"Identity
  strip · `IdentityStrip`": tenant 14 / 600 / `--color-text`, branch
  14 / 500 / `--color-text-muted`, terminal chip mono. Long branch
  truncates city, never branch.

- [X] T052 [P] [S3] **Restyle
  `src/renderer/shell/regions/ConnectionIndicator.tsx`** per CD
  §"Connection indicator": pill form, four states (`online` /
  `syncing` / `degraded` / `offline`), `syncing` dot pulses 1.6 s
  loop using `--color-info`, others static. Each state has a
  non-colour cue (icon / label / shape) per spec FR-004 / NFR-006.

- [X] T053 [P] [S3] **Restyle
  `src/renderer/shell/regions/OperatorSlot.tsx`** per CD's
  `OperatorBadge` integration into the top bar: 32 px avatar with
  `--color-primary-soft` background + 2-letter mono initials in
  `--color-primary` 600. Role pill (CASHIER / MANAGER / ADMIN) +
  display name only. **No email, no phone, no Clerk user id** — per
  004 FR-031 / FR-032.

- [X] T054 [S3] **Add `src/renderer/shell/regions/CenterStage.tsx`**
  (NEW component). Per CD §E: `100vh` clean workspace, no rail, no
  top bar, one floating pane child centred. Used by S4 (pairing /
  paired) and S5 (sign-in surfaces). Public prop interface: `{ children:
  ReactNode }`. Test file: `__tests__/CenterStage.test.tsx`.

- [X] T055 [S3] **Add `src/renderer/shell/regions/Workspace.tsx`**
  (NEW component). Per CD §E: max-inline-size 1280 px, padded 32–40,
  single scroll surface, page header + body slot. Used by every
  signed-in route (S4 paired-only; S5 cashier shell). Public prop
  interface: `{ title?: string; banner?: ReactNode; children: ReactNode }`.
  Test file: `__tests__/Workspace.test.tsx`.

- [X] T056 [S3] **Confirm `/paired` rail-hidden vs rail-visible
  behaviour** is preserved per 003 spec / plan O2 (paired surface is
  center-stage; `/app/*` surfaces are inside AppShell). The S3
  restyle MUST NOT break the routing decision; `<CenterStage>` wraps
  `/paired` at S4 implementation time.

- [X] T057 [S3] **Add per-region tests** for `TopBar`, `NavRail`,
  `IdentityStrip`, `ConnectionIndicator`, `OperatorSlot`, `CenterStage`,
  `Workspace`. Each test covers default + state variants + viewport
  responsiveness. axe baseline smoke; zero `serious` / `critical`.

- [X] T058 [S3] **Run validation locally** — full project
  implementation validation set. `npm run typecheck`, `npm run lint`,
  `npm test`, `npm test -- --coverage`, `npm run codegen:verify`. The
  ≥ 90 % gate on `src/renderer/shell/` holds; `codegen:verify`
  confirms no incidental `src/shared/api-types.ts` drift.

- [X] T059 [S3] **Capture S3 contact sheet** — AppShell at three
  viewport bands, four connection-state variants, ScreenTooSmall
  fallback, OperatorSlot with each role. Save to `pos-007-after-s3/`
  (out-of-tree). Reviewer sign-off recorded.

- [X] T060 [S3] **005 / 006 UI gate — S3 approval criteria check
  (UNBLOCKING).** Confirm:
  - Shell chrome (`AppShell` + `TopBar` + `NavRail` + `IdentityStrip`
    + `ConnectionIndicator` + `OperatorSlot`) restyled to the
    documented look.
  - `<Workspace>` layout primitive (T055) is **available** for 005 /
    006 UI to consume — its export and tests are merged.
  - Role-indicator slot in its final position (top-bar right cluster)
    with role + display name only (no PII).
  - Four connection-states render distinctly with non-colour cues.
  Record the four confirmations in the S3 PR description with diff
  excerpts and contact-sheet references. **Once this PR merges with
  the four ticks, 005 / 006 UI implementation is unblocked.**
  Reviewers of any subsequent 005 / 006 UI implementation PR cite this
  S3 PR + the prior S1 + S2 PRs as the unblocking evidence.

- [X] T061 [S3] **Open S3 PR titled `feat(007 S3): shell, top bar, nav
  rail, layout primitives`.** Body cites S2 PR, lists every restyled
  region + the two new layout primitives, attaches the S3 contact
  sheet, records the 005 / 006 UI gate S3 approval criteria check
  (T060) with explicit reviewer-tickable evidence, includes the
  unblock-decision template that the reviewer signs off. PR body
  discipline: no `#86` / `#87`, no `Closes` / `Resolves`, no
  `Fixes #NNN`. **Stop after PR.** Do NOT begin S4 or S5 until S3 is
  merged with reviewer sign-off and the gate criterion is ticked.

---

## Phase 7 — S4: Pairing and terminal-state surfaces (+ placeholder route layout-primitive consumption)

**Slice goal:** Restyle `/pairing` and `/paired` to the recovered visual
language without changing pairing flow / copy / security (spec FR-022 /
FR-023). The "Continue to dashboard →" affordance from 003 O2 fallback
is preserved. **Additionally** (per `/speckit-analyze` finding C2,
2026-05-10), wire each existing `app/*Placeholder.tsx` route to consume
the S3 `<Workspace>` route layout primitive so spec FR-002 / FR-013
(every existing route uses the route layout primitive) are explicitly
covered. Placeholder restyle is **layout-primitive consumption only** —
no business logic, no KPIs, no analytics, no copy change.

**Slice diff scope:** restyle in place under `src/renderer/routes/pairing/`,
`src/renderer/routes/paired/`, and `src/renderer/routes/app/`
(the six existing `*Placeholder.tsx` files only — see T070a). Pairing
flow, pairing copy, pairing security boundaries, placeholder reserved-
slot copy (`tender.*` / `totals.*` notes), and cashier-visibility
restrictions are **NOT touched**.

**Slice independent test:** A reviewer signs out, opens an unpaired
terminal, walks the pairing flow, and confirms (a) the visual matches
CD `03-screens.md` §01–§03; (b) the pairing-bypass contract from 002
holds (unpaired terminals route to `/pairing` and cannot reach
`/app/*`); (c) `/paired` shows the "Continue to dashboard →"
affordance. May run after S3 in parallel with S5.

- [ ] T062 [S4] **Run existing pairing-flow test suite (TEST-FIRST).**
  Confirm 002's pairing tests pass on the current code before S4
  changes anything. The S4 restyle MUST keep these tests green.

- [ ] T063 [S4] **Restyle `src/renderer/routes/pairing/PairingScreen.tsx`**
  per CD §"03 · Screens" §01–§02: single 560 px center-stage card on
  a clean workspace; no top bar, no rail; brand mark in 4 × 24 navy
  keyline at top-left. Wraps in `<CenterStage>` (new from S3).
  Pairing copy unchanged.

- [ ] T064 [P] [S4] **Restyle
  `src/renderer/routes/pairing/PairingForm.tsx`** per CD §01: pairing
  code input is mono 36 px / 700 / 0.18em uppercase letter-spacing in a
  sunken well (`--color-surface-sunken` from S1, `--shadow-inset` from
  S1). Refresh-code button is `secondary` variant. No flow change.

- [ ] T065 [P] [S4] **Restyle
  `src/renderer/routes/paired/PairedScreen.tsx`** per CD §03: centred
  success check (38 px circle), success pill `PAIRED`, display H1
  `Ready`, body line `"This terminal is linked to <branch>"`, primary
  CTA `Continue` that navigates to `/app/dashboard`. Wraps in
  `<CenterStage>`. Preserve the "Continue to dashboard →" affordance.

- [ ] T066 [S4] **Confirm pairing-bypass contract holds.** Run the
  existing 002 test `src/renderer/__tests__/pairing-gate.test.tsx`
  and confirm: (a) unpaired terminals route to `/pairing` and cannot
  reach `/app/*`; (b) the bridge surface is unchanged (no new IPC
  channel, no preload-bridge expansion).

- [ ] T067 [S4] **No `_reference/Data-Pulse/` import; no copy-paste
  from any reference.** A `git diff origin/main...HEAD` audit
  confirms zero JSX / HTML / CSS lifted from `claude-design/` or
  `figma-make/`. The static no-touch source-scope guard runs and
  passes.

- [ ] T068 [S4] **Run validation locally** — full project
  implementation validation set. `npm run typecheck`, `npm run lint`,
  `npm test`, `npm test -- --coverage`, `npm run codegen:verify`.
  Existing 002 tests (`PairingScreen.test.tsx`, `PairingForm.test.tsx`,
  `PairedScreen.test.tsx`, `pairing-gate.test.tsx`) all green;
  `codegen:verify` confirms no incidental `src/shared/api-types.ts`
  drift (S4 is renderer-only).

- [ ] T069 [S4] **Capture S4 contact sheet** — `/pairing` (unpaired,
  pairing-in-progress, paired-success, error) + `/paired`
  (default, "Continue to dashboard" affordance) at 1280 × 800 +
  1024 × 768. Save to `pos-007-after-s4/` (out-of-tree). Reviewer
  sign-off recorded.

- [ ] T070a [S4] **(analyze finding C2, 2026-05-10)** **Wrap each
  existing `app/*Placeholder.tsx` route in the S3 `<Workspace>`
  layout primitive** so spec FR-002 (every existing route uses the
  recovered visual language) and FR-013 (every existing route page
  consumes the route layout primitive) are explicitly covered, not
  only inherited via the token cascade. Files in scope (six
  placeholders only):
  - `src/renderer/routes/app/DashboardPlaceholder.tsx`
  - `src/renderer/routes/app/SalesPlaceholder.tsx`
  - `src/renderer/routes/app/CartPlaceholder.tsx`
  - `src/renderer/routes/app/checkout/` (the receipt / checkout
    placeholder — preserve every reserved-slot id and the
    "Reserved for 005-checkout-payments" body copy verbatim)
  - `src/renderer/routes/app/InventoryPlaceholder.tsx`
  - `src/renderer/routes/app/SettingsHelpPlaceholder.tsx`

  **Strict scope:**
  - **Layout-primitive consumption only.** Each placeholder's
    existing top-level container is replaced with `<Workspace
    title={…} banner={…}>{existingChildren}</Workspace>` (per T055
    public prop interface). No new sub-components, no new state,
    no new props on the placeholder itself.
  - **No business logic added.** No sales / cart / payments / money
    math / receipt / inventory mutation. No `Money` type
    introduced. The 005 / 006 reserved slots from 003 (`tender.*`,
    `totals.*`, eleven reserved checkout slot ids) remain
    layout-only with their existing reserved-slot copy preserved
    byte-for-byte.
  - **No reports / KPIs / dashboards / analytics surfaces.** The
    Dashboard placeholder remains a placeholder (spec FR-045);
    Claude Design's §10b manager-shell-with-KPI-tiles sketch is
    visual direction for a future feature, not a 007 deliverable.
  - **No backend / API / IPC / preload / main-process / migrations
    / OpenAPI / codegen / CI changes.** Renderer-only restyle.
    The 003 static no-touch source-scope guard MUST hold.
  - **Cashier-visibility restrictions preserved.** No item from
    the 004 FR-015 catalogue (shift totals, drawer cash, KPIs,
    audit log, manager-review data, etc.) becomes reachable from
    a cashier render tree as a result of this task.
  - **Public prop signatures unchanged.** Each placeholder's
    exported component keeps its existing prop signature; the
    only diff is the rendered tree shape (now wrapped in
    `<Workspace>`).

  **Test strategy:**
  - Existing placeholder tests under
    `src/renderer/routes/app/__tests__/` (and
    `src/renderer/routes/app/checkout/__tests__/`) MUST stay
    green; the reserved-slot no-op guard from 004 (T051 /
    `reserved-slot-noop.test.tsx`) MUST stay green; the
    cashier-walling test from T079 confirms zero forbidden
    information leaks into a cashier render of any placeholder.
  - Add a per-placeholder smoke test asserting the rendered tree
    contains exactly one `<Workspace>` ancestor when the
    placeholder is rendered inside `AppShell`.

  **Screenshot / contact-sheet evidence:**
  - Re-capture each placeholder route at 1280 × 800 + 1024 × 768
    against the S0 placeholder baseline at
    `pos-007-baseline/placeholders/` (captured in T010).
  - Save the post-recovery captures to
    `pos-007-after-s4/placeholders/` (out-of-tree, NOT committed).
  - Pixel-diff threshold: layout-stable ≤ 0.5 % (per
    screenshot-acceptance contract). Any drift in the reserved-
    slot regions of the receipt / checkout placeholder is
    grounds to refuse the slice.
  - Forbidden-content audit: zero items from the 004 FR-015
    catalogue, zero PII, zero credential fragment, zero emoji.
    Reviewer sign-off recorded in the S4 PR description.

  **Validation:** part of T068 — full project implementation
  validation set is sufficient; no new validation step.

- [ ] T070 [S4] **Open S4 PR titled `feat(007 S4): pairing and
  terminal-state surfaces`.** Body cites S3 PR (already-merged at this
  point, 005 / 006 UI gate already unblocked), lists the restyled
  routes (pairing + paired **+ the six placeholder routes wrapped in
  `<Workspace>` per T070a**), attaches the S4 contact sheet (now
  including the placeholder re-captures), confirms pairing-bypass
  contract holds, confirms zero touch on `src/main/pairing/**` /
  `src/preload/**` / `src/shared/bridge-api.ts`, confirms reserved-
  slot ids and reserved-slot copy preserved verbatim, confirms the
  cashier-walling test continues to pass. PR body discipline: no
  `#86` / `#87`, no `Closes` / `Resolves`, no `Fixes #NNN`. **Stop
  after PR.** S5 may run in parallel with S4 (independent surfaces).

---

## Phase 8 — S5: Operator sign-in, roster, PinPad, TakeoverPrompt, OperatorBadge

**Slice goal:** Restyle the operator-session surfaces from 004 to the
recovered visual language, preserving every behavioural rule from 004
FR-005 / FR-006 / FR-013 / FR-024 verbatim. PIN remains dot-only;
TakeoverPrompt remains minimum-disclosure; the role-indicator slot
remains role / display-name only.

**Slice diff scope:** restyle in place under `src/renderer/ui/operator/`.
Specifically: `RosterList.tsx`, `PinPad.tsx`, `TakeoverPrompt.tsx`,
`OperatorBadge.tsx`, `ManagerAdminSignInForm.tsx`. `messages.ts` (closed-
set refusal strings from 004) is **preserved verbatim** and the
forbidden-string set is added as a guard test. May run in parallel with
S4 after S3 lands.

**Slice independent test:** A reviewer signs in as a cashier (roster
pick + PIN) and a manager / admin (password); confirms the visuals
match CD `03-screens.md` §05–§09; runs the takeover prompt test and
confirms the forbidden-string set is absent from the modal subtree;
confirms cashier role's render tree contains zero items from the 004
FR-015 catalogue.

- [X] T071 [S5] **Add PIN dot-only guard test under
  `src/renderer/ui/operator/__tests__/PinPad.dot-only-guard.test.tsx`
  (TEST-FIRST).** Asserts the PIN dot row markup carries: zero `value`
  attribute, zero `data-value` attribute, zero `title` attribute
  referencing PIN content; only `data-state` (`empty` | `filled` |
  `error`) and `aria-label="N of 6 entered"` (or `"4 of 6 entered"`
  etc.). Per CD `04-security-and-visibility.md` §A and 004 PR-1.

- [X] T072 [S5] **Add TakeoverPrompt forbidden-string guard test under
  `src/renderer/ui/operator/__tests__/TakeoverPrompt.forbidden-strings.test.tsx`
  (TEST-FIRST).** Asserts the modal subtree under
  `[data-testid="takeover-prompt"]` contains zero occurrences of:
  - `POS-` (terminal-label prefix);
  - substring `ago` (timestamp-relative);
  - `Cashier ` (with trailing space), `Manager`, `Admin`
    (other-operator role);
  - 4-digit time pattern matching `\d{2}:\d{2}`;
  - `View details`, `Why am I seeing this`, `Show details`.
  Asserts the heading equals byte-for-byte `"You are already signed
  in on another POS terminal in this branch."`. Asserts the body
  equals `"Continue here and sign out there?"`. Asserts the primary
  button label equals `"Continue here"` and the ghost equals
  `"Cancel"`. Per spec FR-026 / `004` FR-013.

- [X] T073 [S5] **Restyle
  `src/renderer/ui/operator/RosterList.tsx`** per CD §"Roster ·
  `RosterList`": 3-column grid at ≥ 1280 px / 2-column at 1024–1279
  px; tile 84 px tall; avatar circle 44 px with
  `--color-primary-soft` + 2-letter mono initials; border
  `--color-border`, radius `--radius-control`. Hover: border darkens
  to primary-50 %, no shadow change. Empty roster shows a single line
  "No cashiers configured for this branch." via `EmptyState`. No
  illustration. Public prop signature unchanged.

- [X] T074 [P] [S5] **Restyle
  `src/renderer/ui/operator/PinPad.tsx`** per CD §"PIN keypad ·
  `PinPad`": 3 × 4 grid of 64 × 64 keys, gap 12; inset background
  `--color-surface-sunken` (S1), container radius `--radius-card`,
  padding 16, shadow `--shadow-inset` (S1). Keys: `--color-surface`,
  border `--color-border`, radius `--radius-control`, mono 24 / 600.
  Two utility keys at the bottom: `⌫` backspace (left of `0`) and
  `↵` enter (right of `0`); `↵` tints `--color-primary` once 4+
  digits entered. Press feedback: background → `--color-primary-soft`,
  no transform. Dot row: 6 dots, 16 px circles inside 28 px sunken
  wells, `data-state="empty|filled|error"` only. Hardware keyboard
  parity: 0–9 type; backspace deletes; enter submits. Public prop
  signature unchanged.

- [X] T075 [P] [S5] **Restyle
  `src/renderer/ui/operator/TakeoverPrompt.tsx`** per CD
  `04-security-and-visibility.md` §C and `02-components.md`
  §"Dialogs / modals": composes the recovered `Dialog` (S2);
  centred 480 px wide; lock icon (warning) 36 px circle; canonical
  copy (T072) preserved byte-for-byte; action row `Cancel` (ghost)
  + `Continue here` (primary). **No** disclosure of: other terminal
  name, prior operator, role, timestamp, "view details" affordance.
  Public prop signature unchanged.

- [X] T076 [P] [S5] **Restyle
  `src/renderer/ui/operator/OperatorBadge.tsx`** per CD §"Operator
  badge · `OperatorBadge`": 32 px avatar with `--color-primary-soft`
  + 2-letter mono initials in `--color-primary` 600. Role pill
  (12 / 700 / 0.12em / UPPERCASE) — three colours per role
  (Cashier → info-soft / info; Manager → primary-soft / primary;
  Admin → warning-soft / warning). Display name 14 / 600 /
  `--color-text`; truncate with ellipsis above 18 chars.
  **No email, no phone, no Clerk user id** rendered in the DOM.
  Public prop signature unchanged.

- [X] T077 [P] [S5] **Restyle
  `src/renderer/ui/operator/ManagerAdminSignInForm.tsx`** per CD §06:
  email field + password field (both via S2 `Input`) + primary
  `Sign in` button + ghost `← Back to cashier roster` link. Refusal
  copy from `messages.ts` (preserved verbatim). No `<form>` self-
  validation; the bridge call returns refusals as closed-set
  categories. Public prop signature unchanged.

- [X] T078 [S5] **Confirm `messages.ts` is unchanged.** Run
  `git diff origin/main...HEAD -- src/renderer/ui/operator/messages.ts`
  and confirm zero changes. The closed-set refusal copy from 004 is
  preserved verbatim.

- [X] T079 [S5] **Cashier-Forbidden Information walling test** under
  `src/renderer/__tests__/cashier-walling.test.tsx`. Assert: the
  cashier role's `<NavRail>` children prop yields manager-only rows
  as `null` (NOT as a disabled / locked entry). Assert: cashier-
  reachable routes contain zero items from the 004 FR-015 catalogue
  (shift totals, expected drawer cash, expected change-fund, declared
  cash count, shortage, overage, variance, reports, KPIs, manager-
  review data, audit log surfaces, admin surfaces, other operators'
  shift data).

- [X] T080 [S5] **axe baseline smoke** on every restyled operator
  surface in default + interactive variants. Zero `serious` /
  `critical`.

- [X] T081 [S5] **Run validation locally** — full project
  implementation validation set. `npm run typecheck`, `npm run lint`,
  `npm test`, `npm test -- --coverage`, `npm run codegen:verify`. The
  ≥ 90 % gate on `src/renderer/ui/` (incl. `operator/`) holds;
  `codegen:verify` confirms no incidental `src/shared/api-types.ts`
  drift (S5 is renderer-only — IPC and bridge surfaces are unchanged).

- [ ] T082 [S5] **Capture S5 contact sheet** — Cashier roster (default
  + roster-picked + empty), Manager / admin sign-in (default +
  entering + submitting + variant A / B / C refusal), PIN entry
  (default + pin-entering + error + submitting), TakeoverPrompt
  (prompted + confirming + error), Signed-in shell with cashier
  OperatorBadge — at 1280 × 800 + 1024 × 768. Save to
  `pos-007-after-s5/` (out-of-tree). Reviewer sign-off recorded.
  **Forbidden-content audit:** no real PIN, no Clerk JWT, no
  `device_token`, no PII beyond display name (first name + last
  initial). The TakeoverPrompt screenshot's DOM contains zero
  forbidden strings (T072 set).

- [ ] T083 [S5] **Open S5 PR titled `feat(007 S5): operator sign-in,
  roster, PinPad, TakeoverPrompt, OperatorBadge`.** Body cites S3 PR
  (gate-tickable evidence already merged), lists every restyled
  operator surface, attaches the S5 contact sheet, confirms PIN
  dot-only + TakeoverPrompt forbidden-string + cashier-walling tests
  pass, confirms `messages.ts` unchanged. PR body discipline: no
  `#86` / `#87`, no `Closes` / `Resolves`, no `Fixes #NNN`. **Stop
  after PR.**

---

## Phase 9 — S6: Screenshot / contact-sheet acceptance + regression checklist finalisation

**Slice goal:** Promote the screenshot-acceptance contract from a
planning artifact into an enforced merge gate for every subsequent UI
feature inheriting 007's visual recovery; finalise the regression
checklist with every guard / forbidden / walling rule learned in S0–S5.

**Slice diff scope:** docs only.
- `specs/007-pos-visual-system/contracts/screenshot-acceptance.md`
  — final amendments based on lessons learned in S1–S5 (e.g. tuned
  pixel-diff thresholds, additional forbidden-content rules learned
  during review, additional state-matrix entries).
- `specs/007-pos-visual-system/contracts/visual-reference-adjudication.md`
  — auditor checklist may be amended if S0–S5 surfaced a new audit
  item.
- New: `specs/007-pos-visual-system/regression-checklist.md` (or
  inline in the screenshot-acceptance contract — implementer's call)
  enumerating: token additivity, forbidden-string assertions on
  TakeoverPrompt subtrees, Cashier-Forbidden Information walling, PIN
  dot-only markup, no `prefers-color-scheme` follower, no proprietary
  brand fonts beyond Inter.

**Slice independent test:** A reviewer reads the final
screenshot-acceptance contract and the regression checklist, and
confirms they are sufficient to gate every subsequent UI feature
without further amendment. The auditor checklist in
visual-reference-adjudication.md is sufficient to confirm a future PR
inherits 007's recovery without copying generated source.

- [ ] T084 [S6] **Amend
  `specs/007-pos-visual-system/contracts/screenshot-acceptance.md`**
  with lessons from S0–S5: any tuned pixel-diff thresholds, any
  additional state-matrix entries, any additional forbidden-content
  rules. Document each amendment with the slice PR that motivated it.

- [ ] T085 [S6] **Author
  `specs/007-pos-visual-system/regression-checklist.md`** (or expand
  the auditor checklist in visual-reference-adjudication.md) with the
  six load-bearing items: (1) token additivity (no rename / repurpose
  / removal of any 003 token); (2) TakeoverPrompt forbidden-string
  assertions; (3) Cashier-Forbidden Information walling; (4) PIN
  dot-only markup; (5) no `prefers-color-scheme` follower; (6) no
  proprietary brand fonts beyond Inter. Each item names the test file
  that enforces it and the slice that introduced the test.

- [ ] T086 [S6] **Confirm the 005 / 006 UI gate audit trail.** A note
  in S6 PR body confirms: S1 PR merged with the four ticked criteria,
  S2 PR merged with the four ticked criteria, S3 PR merged with the
  four ticked criteria. The note is the final reference any future
  005 / 006 implementing PR uses to claim inheritance.

- [ ] T087 [S6] **Run final validation** — full project
  implementation validation set + `package:dir` smoke. `npm run
  typecheck`, `npm run lint`, `npm test`, `npm test -- --coverage`,
  `npm run codegen:verify`, `npm run package:dir`. All green on
  `windows-latest`. The `package:dir` invocation is the **only** one
  in this tasks file (per the "not for every slice" rule); every
  prior implementation slice ran the same set **minus** `package:dir`.

- [ ] T088 [S6] **Open S6 PR titled `docs(007 S6): visual recovery
  acceptance + regression checklist final`.** Body cites every prior
  007 slice PR, attaches the regression checklist, confirms the
  005 / 006 UI gate audit trail (T086), records final
  `package:dir` smoke result. PR body discipline: no `#86` / `#87`,
  no `Closes` / `Resolves`, no `Fixes #NNN`. **Stop after PR.** The
  007 feature is closed when this PR merges.

---

## Phase Final — Polish & Cross-Cutting

No additional polish tasks. Each slice carries its own validation,
contact-sheet capture, and reviewer sign-off; S6 finalises the
regression gate.

---

## Dependency Graph

```
S0 (verify + baseline)
   ↓ blocks
S1 (token layer)
   ↓ blocks                                  005 / 006 UI gate (NFR-014):
S2 (primitives polish)         <- contributes ─┐
   ↓ blocks                                    │
S3 (shell + layout primitives) <- contributes ─┴- when S1 + S2 + S3 merged: 005 / 006 UI unblocked
   ↓ blocks both                                  (S4 / S5 do NOT contribute)
S4 (pairing surfaces)  ──┐
                         ├── parallel after S3
S5 (operator surfaces) ──┘
   ↓ both block
S6 (regression checklist + final gate)
   = 007 closed
```

**Sequencing rules:**
- S0 → S1 → S2 → S3 are strictly sequential.
- S4 and S5 may run in parallel after S3 lands.
- S6 closes 007 after S0–S5 are all merged.
- The 005 / 006 UI gate becomes auditable when S3 PR merges with the
  four ticked criteria (T060). S4 and S5 are not required for the
  gate but are required for 007 to close.

---

## Parallel Execution Examples

- **Within S1**, T020 / T021 / T022 / T023 (additive token TS exports
  in distinct files) run in parallel after T017 (CSS-var additions) is
  merged into the working tree.
- **Within S2**, T030–T037 (per-primitive restyles in distinct files)
  run in parallel after T029 (test-first extension) is merged. T038
  (`LoadingState`) is NOT parallel because it adds a documented
  additive `variant` prop; sequence it before the parallel group.
- **Within S3**, T049–T053 (per-region restyles in distinct files) run
  in parallel after T048 (AppShell restyle) is merged. T054 / T055
  (new `CenterStage` / `Workspace` primitives) run in parallel with
  the region restyles.
- **Across slices**, S4 and S5 run in parallel after S3 merges.

---

## Implementation Strategy

**MVP scope.** S0 + S1 + S2 + S3 are the MVP — they unblock 005 / 006
UI implementation. S4 + S5 + S6 close 007 after the gate is opened.

**Incremental delivery order.** Sequential PRs: S0, S1, S2, S3, then
either S4-then-S5 or S4-and-S5-in-parallel, then S6. Each PR's "Stop
after PR" boundary keeps reviewer load tight.

**Suggested checkpoints.**
- After S0 PR merges: reviewers sign off on the baseline; 007's
  visual direction is locked.
- After S1 PR merges: token additivity is in place; the gate's first
  criterion is ticked.
- After S2 PR merges: primitives are recovered; the gate's second
  criterion is ticked.
- **After S3 PR merges: 005 / 006 UI implementation is unblocked.**
  The reviewer of any subsequent 005 / 006 implementing PR cites
  S1 + S2 + S3 PRs as inheritance evidence.
- After S4 + S5 merge (in either order or in parallel): the
  operator + pairing surfaces are recovered.
- After S6 merges: 007 closes. The regression checklist is the
  enforced merge gate for every subsequent UI feature.

---

*This task list is the source for `/speckit-implement` per slice.
Analyze-driven additions follow the 003 / 004 house convention:
suffix infill (`T070a`, `T019a`, etc.) places each follow-up adjacent
to its slice; `T089` and beyond are reserved for follow-ups that do
not naturally suffix. The 005 / 006 UI gate at T060 is load-bearing:
any change to S1 / S2 / S3 's definition-of-done or approval criteria
requires re-running `/speckit-tasks` and re-walking the gate audit.
No tasks in this file are in_progress; every task is unchecked.
Implementation begins with S0 (T001) when authorised by the user.*
