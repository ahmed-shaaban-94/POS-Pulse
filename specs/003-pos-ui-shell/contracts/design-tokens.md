# Contract — Design Tokens

**Feature:** 003-pos-ui-shell
**Plan:** [../plan.md](../plan.md)
**Data model:** [../data-model.md](../data-model.md)
**Status:** planning-time snapshot. Once `src/renderer/ui/tokens/` lands, the canonical surface is
the code; this file remains a frozen visual contract for the Figma handoff.

This contract enumerates **every token name** the shell ships. Concrete values (hex, rem, ms) are
chosen during Phase 2 in concert with the Figma reviewed file; **names are frozen here** and any
addition or rename requires amending this contract.

---

## Color (semantic palette)

| Token | Role | CSS var | TS path |
|:--|:--|:--|:--|
| `surface` | Primary app surface | `--color-surface` | `colors.surface` |
| `surface-muted` | Secondary surface (rail, banner background) | `--color-surface-muted` | `colors.surfaceMuted` |
| `surface-elevated` | Card / dialog / popover surface | `--color-surface-elevated` | `colors.surfaceElevated` |
| `text` | Default body text | `--color-text` | `colors.text` |
| `text-muted` | Secondary text (labels, captions) | `--color-text-muted` | `colors.textMuted` |
| `text-inverse` | Text on emphasis / inverse surfaces | `--color-text-inverse` | `colors.textInverse` |
| `primary` | Primary action surface | `--color-primary` | `colors.primary` |
| `primary-emphasis` | Primary action — hover / active | `--color-primary-emphasis` | `colors.primaryEmphasis` |
| `primary-on` | Text / icon color on primary | `--color-primary-on` | `colors.primaryOn` |
| `danger` | Destructive action / error surface | `--color-danger` | `colors.danger` |
| `danger-emphasis` | Destructive — hover / active | `--color-danger-emphasis` | `colors.dangerEmphasis` |
| `danger-on` | Text / icon color on danger | `--color-danger-on` | `colors.dangerOn` |
| `warning` | Warning surface | `--color-warning` | `colors.warning` |
| `warning-emphasis` | Warning — hover / active | `--color-warning-emphasis` | `colors.warningEmphasis` |
| `warning-on` | Text / icon color on warning | `--color-warning-on` | `colors.warningOn` |
| `success` | Success surface | `--color-success` | `colors.success` |
| `success-emphasis` | Success — hover / active | `--color-success-emphasis` | `colors.successEmphasis` |
| `success-on` | Text / icon color on success | `--color-success-on` | `colors.successOn` |
| `neutral` | Neutral / informational surface | `--color-neutral` | `colors.neutral` |
| `neutral-emphasis` | Neutral — hover / active | `--color-neutral-emphasis` | `colors.neutralEmphasis` |
| `neutral-on` | Text / icon color on neutral | `--color-neutral-on` | `colors.neutralOn` |
| `focus-ring` | Visible focus outline color | `--color-focus-ring` | `colors.focusRing` |
| `border` | Default border | `--color-border` | `colors.border` |
| `border-strong` | Stronger border (separators, table grid) | `--color-border-strong` | `colors.borderStrong` |
| `overlay-scrim` | Dialog backdrop scrim | `--color-overlay-scrim` | `colors.overlayScrim` |

**Constraints.**

- Every primary / danger / warning / success / neutral pair MUST satisfy WCAG-AA contrast for
  text against its `-on` partner.
- `focus-ring` MUST satisfy a non-color cue (offset / thickness) so users with monochrome
  displays still perceive focus.

---

## Spacing scale

`0` (0 px), `1` (4 px), `2` (8 px), `3` (12 px), `4` (16 px), `5` (24 px), `6` (32 px), `7` (48 px).

CSS vars: `--space-0` … `--space-7`. TS: `spacing[0]` … `spacing[7]`.

**Constraint.** Every primitive's internal padding / gap MUST resolve to one of these eight
values. No fractional spacing (no 6 px, no 14 px).

---

## Typography

**Family.** `sans` (cashier-readable system stack — concrete fallback chain decided in Phase 2),
`mono` (reserved for future tabular receipts; not used in this feature).

**Weight.** `regular` (400) · `medium` (500) · `semibold` (600) · `bold` (700).

**Size.** `xs` · `sm` · `md` (default body) · `lg` · `xl` · `2xl` · `3xl`. The *body default*
must be ≥ **14 px** at the cashier-monitor viewport at 100 % display scaling.

**Line-height.** `tight` · `snug` · `normal` · `relaxed`.

CSS vars: `--font-family-sans`, `--font-family-mono`, `--font-weight-{regular|medium|…}`,
`--font-size-{xs|sm|…}`, `--line-height-{tight|snug|…}`. TS: structured object
`typography.{family|weight|size|lineHeight}.{name}`.

---

## Radius

`none` · `sm` · `md` · `lg` · `pill`. CSS vars: `--radius-{none|sm|md|lg|pill}`. TS: `radius.{name}`.

---

## Shadow

`none` · `sm` · `md` · `lg` · `overlay`. CSS vars: `--shadow-{none|sm|md|lg|overlay}`. TS:
`shadow.{name}`.

`overlay` is reserved for the Dialog scrim and is the only shadow that pairs with
`overlay-scrim` color.

---

## Density

`comfortable` (applied) · `compact` (reserved, not switchable).

CSS vars: none — density is a TS-only enum that drives token *selection*. (No CSS class is added;
no body data-attribute is toggled. The only applied density is `comfortable`.)

TS:

```ts
export const density = { comfortable: 'comfortable', compact: 'compact' } as const;
export type Density = typeof density[keyof typeof density];
```

**Constraint — compact density is a *dead* reserved token in 003.** No component, no hook, no
style block, no media query, no settings surface reads `density.compact` at runtime. The token
exists as a reserved name only (spec Clarifications §1) so a future feature can adopt it without
reshaping the token API.

This is enforced as a *guard test* alongside the parity test (Plan §"Test Strategy" — the
**Compact-density dead-token guard** row). The guard:

- parses the source tree under `src/renderer/`;
- collects every reference to `density.compact` (or the string literal `'compact'` when used as
  a `Density` value);
- asserts the reference set equals exactly **two** files: the token-definition file
  (`src/renderer/ui/tokens/density.ts`) and its test
  (`src/renderer/ui/tokens/__tests__/tokens.test.ts`);
- fails the run on any other reference.

Adding a third reference (e.g. a component that branches on `density.compact`) is a build
failure. The intent is symmetric with the `syncing` connection-state guard: *name the token,
forbid the runtime use*.

---

## Touch target

`min` = **44** (CSS px). TS: `touchTarget.min === 44`.

**Constraint.** Every interactive primitive (Button, Input, NavRail entry, Dialog action,
Toast dismiss, StatusBanner action) MUST present a hit area of at least 44 × 44 CSS px. Enforced
by an invariant test in `Button.test.tsx` plus per-component assertions where the wrapper does
not propagate from `Button` (e.g. NavRail entries when icon-only).

---

## Connection-state values (typed enum, listed for completeness)

```ts
export const connectionState = {
  online: 'online',
  degraded: 'degraded',
  offline: 'offline',
  syncing: 'syncing',
} as const;
export type ConnectionState = typeof connectionState[keyof typeof connectionState];
```

**Hard non-implementation list** for `syncing` (spec Clarifications §3, repeated verbatim in
`shell-regions.md`):

- MUST NOT trigger any sync queue.
- MUST NOT trigger any backend / fetch call.
- MUST NOT touch any persistence (`better-sqlite3`, `SecretStore`, file system, localStorage).
- MUST NOT introduce any new IPC channel.
- MUST NOT change the preload bridge surface.
- MUST NOT contain any actual network synchronization logic.

---

## Parity test (binding)

A Vitest test in `src/renderer/ui/tokens/__tests__/tokens.test.ts` MUST assert:

1. **Every TS token export name has a matching CSS custom property** name in `tailwind.css`.
   (`spacing[3]` ⇆ `--space-3`, `colors.surfaceElevated` ⇆ `--color-surface-elevated`, etc.)
2. **Every CSS custom property defined under `:root`** in `tailwind.css` has a matching TS
   export.
3. The `density` enum has exactly two members (`comfortable`, `compact`).
4. `touchTarget.min === 44`.
5. `connectionState` has exactly four members.

Failures of any of these assertions are build failures.
