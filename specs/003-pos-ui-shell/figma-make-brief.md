# Figma Make Brief — POS UI Shell (Feature 003)

**Feature:** 003-pos-ui-shell
**Tasks:** T056
**Status:** Planning artifact — read by a designer before starting Figma Make exploration.

---

## What this document is

This brief defines the scope of a Figma Make prototype exploration for the POS UI Shell.

**Figma Make output is throwaway.** Any Figma Make-generated output is strictly a prototype
for visual exploration and rapid iteration. It MUST NOT be committed to the repository,
treated as a design deliverable, or used as input to Figma MCP-driven code generation without
first going through a full design review round.

The reviewed Figma file — reviewed and approved by the team — is the only artifact that feeds
into the Figma MCP handoff (see `figma-mcp-handoff.md`).

---

## Scope: what to explore

Use the surfaces from `figma-handoff.md` as the source. Focus on:

### 1. AppShell layout variations

- The full-width TopBar composition: IdentityStrip | (optional) StatusBanner | ConnectionIndicator | OperatorSlot
- Both NavRail layouts: expanded (>= 1280 px) and icon-only (1024-1279 px)
- The ScreenTooSmall fallback (< 1024 px) — single centred panel, no nav

### 2. Connection-state visual set

Produce one frame per state: `online`, `degraded`, `offline`, `syncing`.
Each frame shows the full TopBar with the corresponding indicator and banner (or no banner for `online`).

### 3. NavRail active-state treatment

Explore the left-edge accent + background tint approach for the active entry.
Try at both viewport sizes (expanded and icon-only).

### 4. Button intent variants

Produce a component set showing all four intents (`primary`, `secondary`, `ghost`, `destructive`)
in all six states (default, hover, focus, active, disabled, loading) at both sizes (`md`, `lg`).

### 5. Placeholder pane state variants

For one representative pane (e.g. Dashboard), explore:
- Default content
- LoadingState variant
- EmptyState variant (with no-op CTA)
- ErrorState variant (with no-op retry CTA)

### 6. Checkout reservation layout

Show the eleven reserved slots in the documented display order. Each slot is a labelled rectangle
with the "Reserved for 005-checkout-payments" body text. No values, no inputs.

---

## Scope: what NOT to explore

Do NOT produce Figma Make artwork for any of the following. These are out of scope for Feature
003 and any exploration output that includes them will be rejected from the reviewed Figma file:

- Mobile hamburger drawer or slide-out menu
- Compact density mode (no density toggle of any kind)
- Payment-flow controls: amount inputs, tender selection, card-reader prompts
- Real currency values in any checkout slot
- Cashier login form, operator credentials, PIN pad
- Receipt preview or print preview
- Any viewport narrower than 1024 px other than the ScreenTooSmall full-replacement screen
- Any bottom navigation tab bar

---

## Design token alignment

All colours, spacing, radii, and typography MUST reference the token table in `figma-handoff.md`.
Do not introduce new token names. Do not use hard-coded values. If a visual requires a token that
does not exist in the table, surface it as a design question — do not silently introduce it.

---

## Deliverable

The output of this Figma Make exploration is a rough prototype file for team review. Once the
team reviews it and the design is approved, the approved Figma file feeds into the Figma MCP
handoff round (see `figma-mcp-handoff.md`).

**The repository code remains the final source of truth.** The Figma file is a design mirror;
discrepancies are resolved in favour of the code.

---

## Reference task IDs (for traceability)

- T010: CSS token block in `tailwind.css`
- T011: TypeScript token exports
- T023: Eight shared-component primitives
- T034: AppShell implementation
- T039: NavRail implementation
- T048: Responsive rail layouts
- T052: CheckoutPlaceholder eleven reserved slots
- T055: Figma handoff document (source of the surfaces described here)
- T056: This document
- T057: Figma MCP handoff requirements
