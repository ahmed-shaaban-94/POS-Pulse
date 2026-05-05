# Figma Handoff — POS UI Shell (Feature 003)

**Feature:** 003-pos-ui-shell
**Tasks:** T055
**Source of truth:** `src/renderer/` (code is always canonical; Figma mirrors it)
**Status:** Planning artifact — generated after task generation round. Valid for handoff to design.

---

## Overview

This document aggregates the complete visual specification for Feature 003 into a single
reference for the Figma file maintainer. Every surface listed here is already implemented in
code; the Figma file must match the code, not the other way around.

---

## 1. Design Token Table

All tokens are defined in `src/renderer/styles/tailwind.css` (`:root` block) and mirrored as
TypeScript exports under `src/renderer/ui/tokens/`.

### Color — POS Pulse 003 enterprise palette

> Token values mirror `src/renderer/styles/tailwind.css` `:root` block as merged in PR #35.
> Code is canonical; Figma must match the hex values listed here.

#### Workspace + surface

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `background` | `--color-background` | `#fbfcfd` | Workspace surface |
| `surface` | `--color-surface` | `#ffffff` | Card / panel |
| `surface-elevated` | `--color-surface-elevated` | `#f3f6fa` | Inert tile, slot-id chip, banner band |
| `surface-muted` | `--color-surface-muted` | `#f3f6fa` | Alias of surface-elevated (kept for compat) |

#### Ink

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `text` | `--color-text` | `#0f1d2e` | Default body text |
| `text-muted` | `--color-text-muted` | `#5b6b7c` | Secondary text, labels |
| `text-inverse` | `--color-text-inverse` | `#ffffff` | Text on emphasis surfaces |

#### Brand primary — deep enterprise navy

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `primary` | `--color-primary` | `#1f4e7a` | Primary action |
| `primary-emphasis` | `--color-primary-emphasis` | `#163d61` | Primary hover/active |
| `primary-soft` | `--color-primary-soft` | `#e6eef6` | Tint background for active rows |
| `primary-on` | `--color-primary-on` | `#ffffff` | Text on primary |

#### Accent

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `accent` | `--color-accent` | `#2e7da3` | Active-row tab, eyebrow, decorative ink |

#### Semantic state

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `success` | `--color-success` | `#1f8a5b` | Success, online state |
| `success-emphasis` | `--color-success-emphasis` | `#176944` | Success hover/active |
| `success-soft` | `--color-success-soft` | `#e7f5ee` | Success banner band |
| `success-on` | `--color-success-on` | `#ffffff` | Text on success |
| `warning` | `--color-warning` | `#b87600` | Warning |
| `warning-emphasis` | `--color-warning-emphasis` | `#8f5b00` | Warning hover/active |
| `warning-soft` | `--color-warning-soft` | `#fbf0db` | Warning banner band |
| `warning-on` | `--color-warning-on` | `#ffffff` | Text on warning |
| `danger` | `--color-danger` | `#b32e36` | Destructive, error |
| `danger-emphasis` | `--color-danger-emphasis` | `#8e2329` | Danger hover/active |
| `danger-soft` | `--color-danger-soft` | `#f7e2e3` | Danger banner band |
| `danger-on` | `--color-danger-on` | `#ffffff` | Text on danger |
| `info` | `--color-info` | `#1e6f8c` | Informational |
| `info-emphasis` | `--color-info-emphasis` | `#175670` | Informational hover/active |
| `info-soft` | `--color-info-soft` | `#e1f0f5` | Informational banner band |
| `info-on` | `--color-info-on` | `#ffffff` | Text on info |

#### Neutral (legacy syncing intent)

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `neutral` | `--color-neutral` | `#5b6b7c` | Neutral, syncing state |
| `neutral-emphasis` | `--color-neutral-emphasis` | `#3d4c5a` | Neutral hover/active |
| `neutral-on` | `--color-neutral-on` | `#ffffff` | Text on neutral |

#### Dark rail (NavRail surface)

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `rail` | `--color-rail` | `#0e1b2a` | NavRail background |
| `rail-hover` | `--color-rail-hover` | `#162a40` | NavRail entry hover |
| `rail-text` | `--color-rail-text` | `#cdd6e0` | NavRail label/icon ink |
| `rail-text-dim` | `--color-rail-text-dim` | `#7a8a9c` | NavRail dimmed/idle ink |

#### Borders / rules

| Token Name | CSS Variable | Value | Role |
|:---|:---|:---|:---|
| `border` | `--color-border` | `#d8dfe7` | Default borders |
| `border-soft` | `--color-border-soft` | `#e7ecf2` | Soft separators |
| `border-strong` | `--color-border-strong` | `#9ca3af` | Strong borders |
| `focus-ring` | `--color-focus-ring` | `var(--color-primary)` (`#1f4e7a`) | Visible focus outline |
| `overlay-scrim` | `--color-overlay-scrim` | `rgba(0,0,0,0.5)` | Dialog scrim |

### Spacing Scale (4 px base)

| Step | CSS Variable | Value |
|:---|:---|:---|
| 0 | `--space-0` | 0px |
| 1 | `--space-1` | 4px |
| 2 | `--space-2` | 8px |
| 3 | `--space-3` | 12px |
| 4 | `--space-4` | 16px |
| 5 | `--space-5` | 24px |
| 6 | `--space-6` | 32px |
| 7 | `--space-7` | 48px |
| 8 | `--space-8` | 64px |

### Typography

| Token | CSS Variable | Value |
|:---|:---|:---|
| `family.sans` | `--font-family-sans` | `'Inter Variable', Inter, 'Segoe UI', system-ui, -apple-system, sans-serif` |
| `family.mono` | `--font-family-mono` | `ui-monospace, 'Cascadia Code', 'JetBrains Mono', monospace` |
| `weight.regular` | `--font-weight-regular` | 400 |
| `weight.medium` | `--font-weight-medium` | 500 |
| `weight.semibold` | `--font-weight-semibold` | 600 |
| `weight.bold` | `--font-weight-bold` | 700 |
| `size.2xs` | `--font-size-2xs` | 0.6875rem (11px) |
| `size.xs` | `--font-size-xs` | 0.75rem (12px) |
| `size.sm` | `--font-size-sm` | 0.875rem (14px) |
| `size.md` | `--font-size-md` | 1rem (16px) — body default |
| `size.lg` | `--font-size-lg` | 1.125rem (18px) |
| `size.xl` | `--font-size-xl` | 1.25rem (20px) |
| `size.2xl` | `--font-size-2xl` | 1.5rem (24px) |
| `size.3xl` | `--font-size-3xl` | 1.875rem (30px) |
| `lineHeight.tight` | `--line-height-tight` | 1.25 |
| `lineHeight.snug` | `--line-height-snug` | 1.375 |
| `lineHeight.normal` | `--line-height-normal` | 1.5 |
| `lineHeight.relaxed` | `--line-height-relaxed` | 1.625 |

### Radius

| Token | CSS Variable | Value |
|:---|:---|:---|
| `none` | `--radius-none` | 0 |
| `sm` | `--radius-sm` | 0.125rem (2px) |
| `md` | `--radius-md` | 0.25rem (4px) |
| `lg` | `--radius-lg` | 0.5rem (8px) |
| `control` | `--radius-control` | 10px (buttons, fields) |
| `card` | `--radius-card` | 14px (cards, panes) |
| `pane` | `--radius-pane` | 16px (pairing / paired centred panels) |
| `pill` | `--radius-pill` | 9999px |

### Shadow

| Token | CSS Variable |
|:---|:---|
| `none` | `--shadow-none` |
| `sm` | `--shadow-sm` |
| `md` | `--shadow-md` |
| `lg` | `--shadow-lg` |
| `card` | `--shadow-card` |
| `pane` | `--shadow-pane` |
| `overlay` | `--shadow-overlay` |

---

## 2. Primitive Variants and States

### Button

| Intent | States |
|:---|:---|
| `primary` | default, hover, focus, active, disabled, loading |
| `secondary` | default, hover, focus, active, disabled, loading |
| `ghost` | default, hover, focus, active, disabled, loading |
| `destructive` | default, hover, focus, active, disabled, loading |

Sizes: `md` (body actions) · `lg` (primary CTAs).
Touch target: minimum 44 x 44 CSS px for both sizes.
Focus ring: 2px solid `--color-focus-ring`, 2px offset.

### Badge

Intents: `info` · `success` · `warning` · `danger` · `neutral`.
States: static only.

### Card

Variants: `default` · `muted` · `elevated`.
Renders as `<section>` with `aria-labelledby` when a heading id is provided, otherwise `<div>`.

### Input

Variants: `text` · `password` · `numeric`.
States: default · focus · disabled · error.

### Dialog

Variants: `default` · `confirm` · `destructive`.
States: `open` · `closed`.
Focus trap + ESC dismiss + focus restore on close.

### Toast

Intents: `info` · `success` · `warning` · `danger`.
States: `entering` · `visible` · `leaving`.

### StatusBanner

States: `online` (hidden) · `degraded` (warning) · `offline` (danger) · `syncing` (neutral).
Non-dismissible. `aria-live="polite"`.

### Table

States: `data` · `empty` · `loading` · `error`.

---

## 3. AppShell Region Map

```
[viewport inline-start ──────────────────────────── inline-end]
┌─────────────────────────────────────────────────────────────┐
│ TopBar  (role="banner", block-start, full inline)           │
│  IdentityStrip | StatusBanner? | ConnectionIndicator | OS   │
└─────────────────────────────────────────────────────────────┘
┌─────────┐ ┌───────────────────────────────────────────────┐
│ NavRail │ │ MainContent  (role="main")                    │
│ (nav)   │ │  <Outlet /> — one of six placeholder panes   │
│         │ │                                               │
│ Db      │ │                                               │
│ Sl      │ │                                               │
│ Ct      │ │                                               │
│ Rc      │ │                                               │
│ Iv      │ │                                               │
│ St      │ │                                               │
└─────────┘ └───────────────────────────────────────────────┘
```

- `IdentityStrip`: tenant · branch · terminal label (Badge, neutral intent)
- `StatusBanner`: visible only when connection-state is not `online`
- `ConnectionIndicator`: role="status", four-state visual
- `OS`: OperatorSlot — visibly disabled "Sign in" button

---

## 4. Rail Layouts

### Expanded (>= 1280 px)

Each NavRail entry shows: icon placeholder + text label.
Active entry: background tint + inline-start edge accent (3px, `--color-primary`).
Width: minimum 180px.

### Icon-Only (1024–1279 px)

Each NavRail entry shows: icon placeholder only.
Label is accessible name (`aria-label`) and tooltip (`title`).
Active entry: same visual treatment as expanded.

### ScreenTooSmall (< 1024 px)

NavRail is NOT rendered. `<main>` shows:
- `<h1>`: "Screen too small" (frozen copy)
- `<p>`: "Use a display at least 1024px wide to run POS Pulse." (frozen copy)
- No actions, no hamburger, no slide-out.

**Hard exclusion at all widths:** No mobile hamburger drawer, no slide-out menu, no bottom-tab bar.

---

## 5. Four Connection-State Visuals

| State | Intent Class | Indicator surface | Indicator ink | Banner band |
|:---|:---|:---|:---|:---|
| `online` | `--success` | `--color-success-soft` | `--color-success` | hidden |
| `degraded` | `--warning` | `--color-warning-soft` | `--color-warning` | `--color-warning-soft` |
| `offline` | `--danger` | `--color-danger-soft` | `--color-danger` | `--color-danger-soft` |
| `syncing` | `--info` | `--color-info-soft` | `--color-info` | `--color-info-soft` |

Each state is distinguished by: surface color + ink color + text label + status dot shape (online static, syncing pulsing, others static). Connection indicators are NEVER color-alone — text label is always visible.

> Source: `src/renderer/styles/tailwind.css` `.connection-indicator[data-connection-state=…]`
> and `aside[role='status'][data-state=…]` rules.

---

## 6. Per-Pane State-Variant Matrix

Each placeholder pane supports four states via `?state=` URL param (dev only):

| Pane | Default state | `loading` | `empty` | `error` |
|:---|:---|:---|:---|:---|
| Dashboard | Welcome message | LoadingState | EmptyState | ErrorState |
| Sales | "Sales placeholder" | LoadingState | EmptyState | ErrorState |
| Cart | "Cart placeholder" | LoadingState | EmptyState | ErrorState |
| Inventory | "Navigation only" msg | LoadingState | EmptyState | ErrorState |
| Settings/Help | "Settings placeholder" | LoadingState | EmptyState | ErrorState |
| Checkout | Eleven reserved slots | (handled separately) | | |

State primitives:
- `LoadingState`: `role="status"`, spinner-like indicator
- `EmptyState`: heading + description + no-op CTA
- `ErrorState`: heading + description + no-op CTA

---

## 7. Eleven Reserved Checkout Slots

Listed in fixed display order:

| # | Slot ID | Label | Type |
|:---|:---|:---|:---|
| 1 | `tender.cash` | Cash | ReservedTenderRow |
| 2 | `tender.card` | Card | ReservedTenderRow |
| 3 | `tender.bank-transfer` | Bank Transfer | ReservedTenderRow |
| 4 | `tender.voucher` | Gift Voucher | ReservedTenderRow |
| 5 | `tender.insurance` | Insurance | ReservedTenderRow |
| 6 | `tender.split` | Split Tender | ReservedTenderRow |
| 7 | `totals.amount-due` | Amount Due | ReservedTotalsRow |
| 8 | `totals.amount-paid` | Amount Paid | ReservedTotalsRow |
| 9 | `totals.remaining` | Remaining Balance | ReservedTotalsRow |
| 10 | `totals.change-due` | Change Due | ReservedTotalsRow |
| 11 | `receipt.breakdown` | Receipt Breakdown | ReservedTotalsRow |

Each slot body: "Reserved for 005-checkout-payments". No values, no inputs, no callbacks.

---

## 8. MUST NOT Include Notes

The Figma file MUST NOT contain artwork for any of the following:

- Mobile hamburger drawer or slide-out menu at any breakpoint
- Density toggle control (compact mode is a reserved token only — no UI exposes it)
- Payment-flow controls: amount inputs, card readers, payment modals
- Real values in any reserved checkout slot (all eleven slots are placeholder only)
- Cashier login / operator session UI beyond the disabled "Sign in" placeholder
- Receipt printing controls or receipt preview
- Any third breakpoint below 1024 px (< 1024 is ScreenTooSmall, full stop)
