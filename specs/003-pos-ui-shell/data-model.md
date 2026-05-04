# Phase 1 — Data Model: POS UI Shell

**Feature:** 003-pos-ui-shell
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-05-04

This feature is **UI-only**. It introduces:

- **No persisted entities.**
- **No new SQLite tables, columns, indexes, triggers, or views.**
- **No new SecretStore keys.**
- **No new IPC channels and no new shapes on the preload bridge.**
- **No new HTTP request / response shapes.**
- **No new Sentry tags or log fields.**

The only "data" this feature defines lives in the renderer process as **types and components**.
The four conceptual artifacts below are the visual / structural contracts that the rest of the
plan and the contracts/ directory reference.

---

## 1. `DesignToken`

A semantic, named value consumed by every shared component. Tokens are delivered as **CSS custom
properties** (in `src/renderer/styles/tailwind.css`) **and** as **typed TS exports** (in
`src/renderer/ui/tokens/`). Parity is enforced by a Vitest test (research §1).

| Token group | Token names | Notes |
|:--|:--|:--|
| **Color (semantic)** | `surface`, `surface-muted`, `surface-elevated`, `text`, `text-muted`, `text-inverse`, `primary`, `primary-emphasis`, `primary-on`, `danger`, `danger-emphasis`, `danger-on`, `warning`, `warning-emphasis`, `warning-on`, `success`, `success-emphasis`, `success-on`, `neutral`, `neutral-emphasis`, `neutral-on`, `focus-ring`, `border`, `border-strong`, `overlay-scrim` | Names match WCAG-AA palette planning. Concrete hex values land in Phase 2; names are frozen here. |
| **Spacing** | `0`, `1` (4px), `2` (8px), `3` (12px), `4` (16px), `5` (24px), `6` (32px), `7` (48px) | Discrete scale; no fractional values. |
| **Typography — family** | `sans`, `mono` | Sans is the cashier-readable default; mono reserved for tabular receipts (future). |
| **Typography — weight** | `regular` (400), `medium` (500), `semibold` (600), `bold` (700) | |
| **Typography — size** | `xs`, `sm`, `md` (default body), `lg`, `xl`, `2xl`, `3xl` | Body default is `md` at comfortable density (≥ 14 px effective). |
| **Typography — line-height** | `tight`, `snug`, `normal`, `relaxed` | |
| **Radius** | `none`, `sm`, `md`, `lg`, `pill` | |
| **Shadow** | `none`, `sm`, `md`, `lg`, `overlay` | `overlay` is reserved for Dialog scrim. |
| **Density** | `comfortable` (applied), `compact` (**reserved, not switchable, dead-token-guarded**) | See spec Clarifications §1 and the dead-token guard pinned in `contracts/design-tokens.md` §"Density". |
| **Touch-target** | `min` = 44 (CSS px) | Floor; not a scale. Enforced by `<TouchTarget>` invariant (NFR-5). |
| **Connection-state** | `online`, `degraded`, `offline`, `syncing` (visual-only) | See spec Clarifications §3. Not a token in the visual sense — it is a typed enum that drives token *selection*, listed here for completeness. |

**TS shape (illustrative):**

```ts
// src/renderer/ui/tokens/index.ts
export const density = { comfortable: 'comfortable', compact: 'compact' } as const;
export type Density = typeof density[keyof typeof density];

export const touchTarget = { min: 44 } as const;

export const spacing = {
  0: 'var(--space-0)', 1: 'var(--space-1)', /* … */ 7: 'var(--space-7)',
} as const;

// + colors, typography, radius, shadow, connectionState in the same shape.
```

**Constraints.**

- Every TS export has a matching CSS custom property name in `tailwind.css`.
- A token MUST NOT be added to one place and not the other (research §1).
- No primitive component file may contain hard-coded color / spacing / radius / shadow values
  (FR-18).

---

## 2. `SharedComponent`

A typed, themed UI primitive in `src/renderer/ui/primitives/`. Each primitive has:

- A documented **public prop type** (exhaustive, no `any`).
- A documented **variant** axis (e.g. `intent: 'primary' | 'secondary' | 'ghost' | 'destructive'`).
- A documented **state** axis (default, hover, focus, active, disabled, plus type-specific).
- An **accessibility contract** (role, accessible name, keyboard interactions, live-region
  semantics where applicable).
- A **test file** that exercises every variant × state and runs the touch-target invariant where
  applicable.

| Component | Variants | States | Notable a11y contract |
|:--|:--|:--|:--|
| `Button` | `primary` / `secondary` / `ghost` / `destructive` | default / hover / focus / active / disabled / loading | role="button"; visible focus ring; 44 × 44 px touch-target invariant; loading state announces busy |
| `Input` | `text` / `password` / `numeric` (visual variant only — no auto-validation) | default / focus / disabled / error | label association mandatory; `aria-invalid` on error; `aria-describedby` for error message |
| `Card` | `default` / `muted` / `elevated` | static | `<section>` landmark when `aria-labelledby` provided |
| `Table` | `default` / `compact-rows` (visual only — uses comfortable density elsewhere) | empty / loading / error / data | proper `<table>` / `<thead>` / `<tbody>` / `<th scope>` semantics |
| `Badge` | `info` / `success` / `warning` / `danger` / `neutral` | static | accessible name when icon-only; not a button |
| `Dialog` | `default` / `confirm` / `destructive` | open / closed | focus trap; ESC dismiss; focus restore; `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| `Toast` | `info` / `success` / `warning` / `danger` | entering / visible / leaving | `role="status"` for non-urgent; `role="alert"` for urgent; auto-dismiss with deterministic timing |
| `StatusBanner` | `online` / `degraded` / `offline` / `syncing` | dismissible / persistent | `aria-live="polite"`; visually distinct per state; never carries a destructive action |

**Constraints.**

- Components MUST consume tokens (FR-18). A lint-style or import-graph test may be added to
  catch hard-coded values.
- `OperatorSlot` is NOT in this inventory — it is a region (see §3) that *uses* `Button` +
  `Badge`, not a primitive itself.

---

## 3. `ShellRegion`

A named layout slot in the AppShell. Regions compose primitives; they are not primitives
themselves. Layout direction uses **logical CSS properties** (NFR-9) so a future RTL flip is
non-breaking.

| Region | Purpose | Primitives used | Responsive behaviour |
|:--|:--|:--|:--|
| `TopBar` | Persistent header carrying identity, connection, and operator | composes `IdentityStrip`, `ConnectionIndicator`, `OperatorSlot`, `StatusBanner` | full width at every supported viewport |
| `IdentityStrip` | Tenant name · branch name · terminal label | `Badge` (for terminal label), text tokens | text values fall back to `—` placeholder when unavailable (FR-6 edge case) |
| `ConnectionIndicator` | One-glance display of the four connection states | `Badge`, icon, text | visually distinct per state; `syncing` is visual-only |
| `OperatorSlot` | Placeholder for the future operator session | `Button` (visibly disabled), `Badge` | shows "no operator signed in"; `aria-disabled` + tooltip explanation; **never silently no-op** |
| `NavRail` | Primary navigation; six entries | `Button` per entry, `Badge` for active state, `Tooltip` for icon-only mode | **expanded ≥ 1280 px** (icons + labels) · **icon-only 1024–1279 px** (labels via accessible name + tooltip) · **`< 1024 px`** the rail is replaced by `ScreenTooSmall` (the rail does not render) |
| `MainContent` | Outlet for the active placeholder pane | `<Outlet />` | flexes to fill remaining space |
| `StatusBanner` | Global, non-blocking message tied to connection-state | `StatusBanner` primitive | only visible for non-`online` states; never offers a destructive action |

**Constraints.**

- `MainContent` MUST contain exactly one `<Outlet />`.
- `NavRail` MUST NOT render a hamburger drawer at any width (spec Clarifications §2).
- `OperatorSlot` MUST be visibly disabled (FR-8) — a test asserts `aria-disabled="true"` and a
  non-empty accessible explanation.

---

## 4. `PlaceholderPane`

A routed content region under `/app/*`. Each pane has a **default state** plus three additional
**state variants** (`loading`, `empty`, `error`) and is routed without any data fetch. State
variants are selected via a dev-only `?state=…` URL search param so they are deterministically
testable.

| Route | Pane | Notes |
|:--|:--|:--|
| `/app/dashboard` | `DashboardPlaceholder` | Default landing pane after pairing → app shell. Default state shows summary card placeholders. |
| `/app/sales` | `SalesPlaceholder` | Layout-only placeholder for the future sales screen. |
| `/app/cart` | `CartPlaceholder` | Layout-only placeholder for the future cart panel. |
| `/app/checkout` | `CheckoutPlaceholder` | Layout-only placeholder for the future receipt / checkout flow. Hosts the eleven payment-tender visual reservations (see §5 below). File path: `src/renderer/routes/app/checkout/CheckoutPlaceholder.tsx`. |
| `/app/inventory` | `InventoryPlaceholder` | Visibly labelled "navigation only" — no inventory data, no inventory mutation (FR-13). |
| `/app/settings` | `SettingsHelpPlaceholder` | Layout-only placeholder for future settings + help. **Does NOT expose a density toggle.** (Spec Clarifications §1.) |

**State-variant matrix (per pane):**

| Variant | Renders | A11y contract |
|:--|:--|:--|
| `default` | Pane-specific layout placeholders, no domain data | Primary `<main>` landmark; logical heading order |
| `loading` | `LoadingState` primitive | `role="status"` + `aria-live="polite"` |
| `empty` | `EmptyState` primitive (illustration + message + at most one no-op call-to-action) | Heading-level + description + actionable element have proper labels |
| `error` | `ErrorState` primitive (message + non-technical description + retry / go-back affordance) | Error message MUST NOT leak technical strings; retry is a no-op placeholder |

**Constraints.**

- No pane MUST attempt a fetch, IPC call, or persistence read in this feature.
- Below 1024 px viewport width, the *shell* renders `ScreenTooSmall` instead of mounting any
  pane (NavRail's responsive behaviour cascades to MainContent).

---

## 5. `ReservedSlot` (payment-tender visual reservation)

The Receipt placeholder reserves eleven labelled rectangles for future feature
**005-checkout-payments**. They are *layout slots*, not entities — no values, no money types,
no formatters, no behaviour. The slot ids are frozen here and consumed by 005 without renaming.

| Group | Slot id | Future purpose (owned by 005) |
|:--|:--|:--|
| Tender row | `tender.cash` | Cash payment row. |
| Tender row | `tender.card` | Card payment row. **No card-terminal integration in this feature.** |
| Tender row | `tender.bank-transfer` | Bank-transfer row. **No bank API integration.** |
| Tender row | `tender.voucher` | Gift-voucher redemption row. **No voucher validation.** |
| Tender row | `tender.insurance` | Insurance-covered portion row. **No insurance validation.** |
| Tender row | `tender.split` | Split / mixed-tender container. |
| Totals strip | `totals.amount-due` | Amount due. |
| Totals strip | `totals.amount-paid` | Amount paid. |
| Totals strip | `totals.remaining` | Remaining balance. |
| Totals strip | `totals.change-due` | Change due. |
| Totals strip | `receipt.breakdown` | Printed-receipt payment-breakdown row. |

**TS shape (illustrative — full enum in `contracts/shell-routes.ts`):**

```ts
// src/renderer/routes/app/checkout/reserved-slot-ids.ts
export const reservedSlotIds = [
  'tender.cash',
  'tender.card',
  'tender.bank-transfer',
  'tender.voucher',
  'tender.insurance',
  'tender.split',
  'totals.amount-due',
  'totals.amount-paid',
  'totals.remaining',
  'totals.change-due',
  'receipt.breakdown',
] as const;
export type ReservedSlotId = typeof reservedSlotIds[number];

// Slot component prop type — deliberately devoid of value-bearing props.
export type ReservedSlotProps = {
  readonly slotId: ReservedSlotId;
  /** Display label. NEVER a money / amount value. NEVER a callback. */
  readonly label: string;
};
```

**Constraints.**

- The slot id set is **frozen** here. Removing or renaming an id requires a coordinated spec
  amendment; **adding** an id (additive) is acceptable but should be coordinated with 005 once
  005 is specified.
- The slot component prop type MUST NOT carry `amount`, `currency`, `value`, `onSubmit`,
  `onChange`, or any callback — typecheck failure is the first line of defence against
  accidental wiring.
- No `Money` type, no currency formatter, no exchange-rate hook is introduced in this feature.
- The `reserved-slot-noop.test.tsx` guard asserts mounting / hovering / focusing / clicking any
  rendered slot triggers zero observable calls to `globalThis.fetch`, `window.api`,
  `window.localStorage`, `sessionStorage`, or any printing / payment helper.

## What is explicitly not modelled

For the avoidance of doubt:

- No domain entities (Product, Sale, Cart, Receipt, Inventory item, Operator, Permission, …).
- No durable state.
- No machine-identity changes — the pairing model from 002 is consumed read-only by the boot
  router and is not modified.
- No four-state connection-state persistence — the value lives in a zustand slice and is
  initialised to `online` on every shell mount.
- **No `Money` type, no currency type, no payment / tender domain entities.** All eleven
  reserved slots are layout-only labelled rectangles; values, math, validation, and integrations
  are owned by **005-checkout-payments** (deferred).
