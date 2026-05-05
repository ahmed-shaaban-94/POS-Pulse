# Figma MCP Handoff Requirements — POS UI Shell (Feature 003)

**Feature:** 003-pos-ui-shell
**Tasks:** T057
**Status:** Planning artifact — defines requirements a reviewed Figma file MUST satisfy before
Figma MCP-driven implementation can run.

---

## Purpose

This document lists every requirement the reviewed and approved Figma file must satisfy before
the Figma MCP + Claude Code integration is used to generate or adjust implementation code.

Figma MCP runs AFTER the design review is complete. Do not run Figma MCP against an unreviewed
Figma Make prototype. The reviewed Figma file is the gate.

---

## Pre-flight checklist

Before invoking Figma MCP, verify ALL of the following:

### Token names must match `src/renderer/ui/tokens/`

- [ ] Every colour used in the Figma file maps to a named token from `figma-handoff.md §1`
- [ ] Every spacing value maps to a step from `--space-0` through `--space-7`
- [ ] Every radius value maps to `--radius-{none|sm|md|lg|pill}`
- [ ] Every shadow maps to `--shadow-{none|sm|md|lg|overlay}`
- [ ] No hard-coded hex values, pixel values, or opacity values that bypass the token system
- [ ] Typography: only `--font-family-sans` (or `mono` for future tabular content), sizes from the type scale, weights from the weight scale

### Component pages must match `contracts/shared-components.md`

- [ ] **Button**: all four intents (`primary`, `secondary`, `ghost`, `destructive`) × six states (default, hover, focus, active, disabled, loading) × two sizes (`md`, `lg`)
- [ ] **Badge**: all five intents (`info`, `success`, `warning`, `danger`, `neutral`)
- [ ] **Card**: all three variants (`default`, `muted`, `elevated`), uses `<section>` when labelled
- [ ] **Input**: all three variants (`text`, `password`, `numeric`) × four states (default, focus, disabled, error)
- [ ] **Dialog**: all three variants (`default`, `confirm`, `destructive`) × two states (`open`, `closed`)
- [ ] **Toast**: all four intents × three lifecycle states (`entering`, `visible`, `leaving`)
- [ ] **StatusBanner**: all four connection states — `online` is rendered hidden/no-op
- [ ] **Table**: four states (`data`, `empty`, `loading`, `error`)

### Rail layouts must match the responsive matrix

- [ ] **Expanded (>= 1280 px)**: icon placeholder + text label per entry; active entry has inline-start edge accent + background tint
- [ ] **Icon-only (1024–1279 px)**: icon placeholder only; label is `aria-label` + tooltip; active state visually distinct
- [ ] **ScreenTooSmall (< 1024 px)**: single centred panel with heading "Screen too small" and body "Use a display at least 1024px wide to run POS Pulse."; no nav; no actions
- [ ] **At every width**: no hamburger drawer, no slide-out, no bottom-tab bar

### Checkout slots must match the eleven frozen IDs

- [ ] Exactly eleven slots in this fixed order:
  1. `tender.cash` — Cash
  2. `tender.card` — Card
  3. `tender.bank-transfer` — Bank Transfer
  4. `tender.voucher` — Gift Voucher
  5. `tender.insurance` — Insurance
  6. `tender.split` — Split Tender
  7. `totals.amount-due` — Amount Due
  8. `totals.amount-paid` — Amount Paid
  9. `totals.remaining` — Remaining Balance
  10. `totals.change-due` — Change Due
  11. `receipt.breakdown` — Receipt Breakdown
- [ ] Each slot carries the body text "Reserved for 005-checkout-payments"
- [ ] No values, no input controls inside any slot

### Prohibited artwork (must NOT appear in the reviewed Figma file)

- [ ] Confirmed absent: mobile hamburger drawer or slide-out at any width
- [ ] Confirmed absent: compact density toggle or any density-switching control
- [ ] Confirmed absent: payment-flow artwork (amount inputs, card-reader prompts, payment modals, tender selection)
- [ ] Confirmed absent: cashier login form, operator PIN pad, credential inputs
- [ ] Confirmed absent: receipt preview or print preview
- [ ] Confirmed absent: real currency values in any reserved checkout slot

---

## Source of truth reminder

The repository code is the final source of truth. If Figma MCP generates code that conflicts
with existing tests, the tests win. Figma MCP output is a starting point for review, not an
authoritative final output.

After Figma MCP runs:

1. Run `npm run typecheck` — must pass with zero errors
2. Run `npm run lint` — must pass with zero violations
3. Run `npm test` — all 003 guard tests must stay green (source-scope guard, pairing-gate guard,
   no-operator-auth guard, no-backend/IPC/persistence guard, compact-density dead-token guard,
   reserved-slot no-op guard)
4. Run `npm test -- --coverage` — coverage thresholds must not regress

Any Figma MCP output that fails these checks is rejected and must be corrected before merge.

---

## Reference files

- `specs/003-pos-ui-shell/figma-handoff.md` — complete surface map for the Figma file
- `specs/003-pos-ui-shell/figma-make-brief.md` — prototype exploration scope
- `specs/003-pos-ui-shell/contracts/design-tokens.md` — frozen token names
- `specs/003-pos-ui-shell/contracts/shared-components.md` — frozen component surfaces
- `specs/003-pos-ui-shell/contracts/shell-regions.md` — frozen region map and responsive matrix
- `src/renderer/styles/tailwind.css` — canonical CSS token values
- `src/renderer/ui/tokens/` — canonical TypeScript token exports
