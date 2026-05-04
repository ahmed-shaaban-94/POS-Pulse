# Contract — Shared Component Inventory

**Feature:** 003-pos-ui-shell
**Plan:** [../plan.md](../plan.md)
**Data model:** [../data-model.md](../data-model.md)
**Status:** planning-time snapshot. Once `src/renderer/ui/primitives/` lands, the canonical
surface is the code; this file remains a frozen visual contract for the Figma handoff.

This contract enumerates the eight primitives, their **public prop surface**, **variants**,
**states**, and **accessibility contract**. Concrete styling lands in Phase 2; **public surfaces
are frozen here** and any addition or rename requires amending this contract.

---

## Conventions

- All public prop types are **exhaustive**. No `any`, no `as` casts. (NFR-2.)
- All primitives consume tokens. **No hard-coded colors / sizes / shadows** in primitive code.
  (FR-18.)
- All primitives honour the **comfortable** density value. **No runtime density toggle.** Spec
  Clarifications §1.
- All interactive primitives meet the **44 × 44 CSS px touch-target floor**. NFR-5.
- Layout uses **logical CSS properties** (`inline-start`, `inline-end`). NFR-9.

---

## Button

**Purpose.** Default trigger primitive. Used by NavRail entries, Dialog actions, Toast dismiss,
operator-slot placeholder.

**Public prop type (illustrative):**

```ts
type ButtonProps = {
  intent: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size: 'md' | 'lg';                       // both meet the 44 px floor; `lg` is for primary CTAs
  children: ReactNode;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
} & AriaProps;                             // accessible name fallback if children is icon-only
```

**Variants.** `primary` · `secondary` · `ghost` · `destructive`.

**States.** default · hover · focus · active · disabled · loading.

**A11y contract.**

- Renders `<button>` (or `<a role="button">` only when navigation is the *only* action — NavRail
  uses native `<a>` from React Router).
- Visible focus ring at all times in focused state (uses `--color-focus-ring`).
- Loading state sets `aria-busy="true"`.
- Disabled state sets `aria-disabled="true"` and is **not** focusable (operator-slot is the
  exception — see OperatorSlot in `shell-regions.md`).
- Touch-target invariant: clientRect ≥ 44 × 44 CSS px in both `md` and `lg` sizes.

---

## Input

**Purpose.** Default text-entry primitive. Visual-only variants; no auto-validation.

**Public prop type (illustrative):**

```ts
type InputProps = {
  variant: 'text' | 'password' | 'numeric';   // visual hint only
  label: string;                              // mandatory for a11y
  description?: string;
  errorMessage?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /* … standard input passthroughs … */
};
```

**Variants.** `text` · `password` · `numeric`.

**States.** default · focus · disabled · error.

**A11y contract.**

- `label` is mandatory and is rendered as a `<label>` associated via `for` / `id`.
- Error state sets `aria-invalid="true"` and `aria-describedby` pointing to the error message.
- Description, when present, is also linked via `aria-describedby`.
- Focus ring matches Button's focus ring.

---

## Card

**Purpose.** Sectioning primitive used by placeholder panes (Dashboard summary cards,
SettingsHelp content cards, etc.).

**Public prop type:**

```ts
type CardProps = {
  variant?: 'default' | 'muted' | 'elevated';
  as?: 'div' | 'section';                   // 'section' when `aria-labelledby` is provided
  children: ReactNode;
} & AriaProps;
```

**Variants.** `default` · `muted` · `elevated` (consumes `shadow.md`).

**States.** static.

**A11y contract.**

- Renders `<section>` only when `aria-labelledby` is provided; otherwise `<div>`.
- Does NOT add interactive behaviour; if a card is clickable, it composes Button.

---

## Table

**Purpose.** Tabular layout for the future sales / inventory data; in this feature it is exposed
as a primitive with the four state-slot variants so placeholder panes can showcase it.

**Public prop type:**

```ts
type TableProps<Row> = {
  rows: Row[];
  columns: ReadonlyArray<ColumnDef<Row>>;
  state?: 'data' | 'empty' | 'loading' | 'error';
  emptyMessage?: ReactNode;
  errorMessage?: ReactNode;
};
```

**Variants.** `default` (data-bearing) · `compact-rows` (visual-only — does NOT couple to the
density token; it is a per-instance opt-in for dense data).

**States.** `data` · `empty` · `loading` · `error`.

**A11y contract.**

- Native `<table>` / `<thead>` / `<tbody>` / `<th scope="col">` semantics.
- Empty / loading / error states render inside `<tbody>` with one row spanning all columns and
  appropriate `role="status"` for loading.

---

## Badge

**Purpose.** Small status / label primitive. Used by IdentityStrip (terminal label), ConnectionIndicator,
StatusBanner, NavRail (active state when icon-only).

**Public prop type:**

```ts
type BadgeProps = {
  intent: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  children: ReactNode;
} & AriaProps;
```

**Variants.** `info` · `success` · `warning` · `danger` · `neutral`.

**States.** static.

**A11y contract.**

- Not a button. If icon-only, MUST carry an accessible name (`aria-label` or `<span class="sr-only">`).
- NOT used as a tap target on its own — for tappable status, use Button.

---

## Dialog

**Purpose.** Modal primitive for the future settings / help / confirm flows. In this feature it
is exposed and tested but no placeholder pane mounts a dialog by default.

**Public prop type:**

```ts
type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: 'default' | 'confirm' | 'destructive';
  title: string;                              // labelled-by source
  description?: string;
  children: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
};
```

**Variants.** `default` · `confirm` · `destructive`.

**States.** `open` · `closed`.

**A11y contract.**

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title.
- Focus is trapped inside the dialog while open.
- ESC closes the dialog.
- Focus is restored to the previously-focused element on close.
- Background content is set `inert` while open.
- Scrim uses `--color-overlay-scrim` and `--shadow-overlay`.

---

## Toast

**Purpose.** Transient feedback primitive. In this feature it is exposed and tested but no
placeholder pane raises a toast by default.

**Public prop type:**

```ts
type ToastProps = {
  intent: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  description?: string;
  durationMs?: number;                        // default 5000; 0 means manual-dismiss-only
  onDismiss?: () => void;
};
```

**Variants.** `info` · `success` · `warning` · `danger`.

**States.** `entering` · `visible` · `leaving`.

**A11y contract.**

- `role="status"` for `info` / `success`; `role="alert"` for `warning` / `danger`.
- Auto-dismiss timing is deterministic under fake timers (Vitest `vi.useFakeTimers()`).
- Dismiss button meets the touch-target floor.

---

## StatusBanner

**Purpose.** Persistent, non-blocking banner tied to the current connection-state. The TopBar
mounts exactly one StatusBanner; non-`online` states show it.

**Public prop type:**

```ts
type StatusBannerProps = {
  state: ConnectionState;                     // 'online' | 'degraded' | 'offline' | 'syncing'
  message?: string;
  /* dismissible? — banner is non-dismissible by design;
     state changes hide it automatically when connection-state returns to 'online' */
};
```

**Variants.** `online` (visually rendered as **hidden / no-op**) · `degraded` · `offline` ·
`syncing`.

**States.** static (transitions are state-driven).

**A11y contract.**

- `role="status"` + `aria-live="polite"`.
- Does NOT carry a destructive action.
- `syncing` state has the same a11y semantics as the others; **no behaviour beyond display**.
  (Spec Clarifications §3.)

---

## Accessibility-axe rule pass

The Vitest + axe smoke (research §5) runs against each primitive *and* each placeholder pane via
the first-party helper `expectNoAxeViolations(container, options?)`. The helper calls
`axe.run(container)` from `axe-core ^4.10.0` and asserts `violations.length === 0`. **No
third-party Vitest assertion wrapper is used** — research §5 explains why direct integration
is preferred over a wrapper whose peer-dep range may lag this repo's Vitest 4 / RTL 16 /
React 19 stack.

**Helper signature (frozen):**

```ts
// src/renderer/ui/primitives/__tests__/axe-config.ts
import type { RunOptions as AxeRunOptions, AxeResults } from 'axe-core';

export function expectNoAxeViolations(
  container: HTMLElement,
  options?: AxeRunOptions,
): Promise<void>;
```

The signature is **async** (returns `Promise<void>`); a future tasks pass MUST NOT drift to a
synchronous shape because `axe.run()` is async and the helper waits on it.

**Rules ENABLED (default axe 2.1 AA set):** landmark / role / aria-attr / label / button-name /
duplicate-id / heading-order / region / table-fake-caption / list / no-autoplay-audio / …

**Rules DISABLED (with rationale):**

- `color-contrast` — happy-dom does not compute layout color accurately; manual review against
  the Figma file is the substitute. The disable is wired in
  `src/renderer/ui/primitives/__tests__/axe-config.ts` with a comment.
- `meta-viewport` — N/A in an Electron renderer.

Adding a new disabled rule requires a comment in `axe-config.ts` with the rationale; otherwise
the lint test fails.

---

## What is explicitly not in this inventory

- **Dropdown / select / combobox.** Not needed by any placeholder pane in this feature; defer to
  a feature that needs it.
- **Tooltip primitive.** Implemented as a built-in for the icon-only NavRail mode and the
  OperatorSlot disabled-explanation, not exposed as a standalone primitive in this round.
- **Form group / field-set primitive.** Not needed for placeholders.
- **Operator avatar / menu.** Out of scope (no operator session in this feature).
- **Payment / tender primitives, `Money` type, currency formatter, amount-input.** Owned by future
  feature **005-checkout-payments**. The Receipt placeholder visually reserves eleven labelled
  rectangles for them (see `shell-routes.ts` §"Payment-tender visual reservation"); no
  value-bearing primitive is added here.
- **Printing primitive / receipt-render component.** Owned by 005-checkout-payments paired with a
  future receipts-printing feature.

A future feature MAY add these without amending this contract; this contract only enumerates what
this feature ships.
