# Implementation Plan: POS UI Shell

**Feature ID:** 003-pos-ui-shell
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-05-04
**Last Updated:** 2026-05-04
**Constitution version pinned:** v1.3.0

---

## Technical Context

This plan commits to a UI-only shell that lives entirely in the renderer process. **No new
third-party runtime dependencies are introduced.** Every capability we need ships in the
foundation already laid by 001 + 002: React 19, Vite 8, TypeScript 5.9 strict, Tailwind 4 (CSS-first),
`react-router-dom@7`, `zustand@4`, `@tanstack/react-query@5`, Vitest 4, RTL + happy-dom, and the
existing Windows-only CI pipeline.

The shell is **rendered after** the pairing-decision boot logic in `src/renderer/router.tsx`. Today
the router has two top-level routes: `/pairing` and `/paired`. This feature adds an `/app/*`
parent route that mounts a new `AppShell` layout component plus six placeholder child routes. The
existing pairing-bypass contract (FR-5 of this spec, FR-1 of 002's spec) is preserved by reusing
the same `pairing.getStatus()` boot gate — the shell never renders unless the gate has resolved
to `paired`.

| Area | Choice | Source |
|:--|:--|:--|
| Runtime / packaging | Electron `^40.9` Windows 10/11 x64 | constitution v1.3.0 / plan 001 |
| Renderer | React `^19.2` + Vite `^8.0` + TypeScript `^5.9` strict | constitution v1.3.0 / plan 001 |
| Styling | Tailwind `^4.2` (CSS-first, no `tailwind.config.js`) — design tokens delivered as **CSS variables** in `tailwind.css` plus a `@theme` block | constitution Tech Stack / research §1 |
| Routing | Existing `react-router-dom@7` parent route `/app/*` with six child routes; nested `<Outlet />` from `AppShell` | research §2 |
| Renderer state (UI) | Existing `zustand@4` for the shell's small state slices: connection-state, active-nav, dev-toggle overrides | research §3 |
| Server-state hooks | Existing `@tanstack/react-query@5` is **NOT used** in this feature — there are no fetches in scope | spec Out of Scope |
| Component primitives | New first-party module `src/renderer/ui/` containing the shared inventory (Button, Input, Card, Table, Badge, Dialog, Toast, StatusBanner). No external UI library introduced. | research §4 |
| Tokens | New first-party module `src/renderer/ui/tokens/` mirroring the CSS variables in TS for type-safe consumption (color, spacing, typography, radius, shadow, density) | research §1 / data-model.md |
| Density model | **Single applied value: `comfortable`.** `compact` reserved as a token name only; no runtime toggle, no settings UI. | spec Clarifications §1 / FR-17 |
| Touch targets | **Minimum 44 × 44 CSS px** floor on every interactive element; enforced by a `<TouchTarget>` invariant test | spec NFR-5 / FR-19 |
| Connection-state model | **Four** values: `online`, `degraded`, `offline`, `syncing` (last is **visual-only** — see §"Hard Non-Implementation Boundaries" below) | spec Clarifications §3 / FR-7 / FR-16 |
| Responsive viewport | **≥ 1280 px** expanded rail · **1024–1279 px** icon-only rail · **< 1024 px** "screen-too-small" fallback. **No mobile drawer.** | spec Clarifications §2 / FR-2 / NFR-3 |
| Locale-direction | Logical CSS properties (`inline-start` / `inline-end`) — no hard-coded `left` / `right` | spec NFR-9 |
| Accessibility automation | **`axe-core` `^4.10.0`** (rule engine, runner-agnostic) consumed via a small first-party Vitest helper `expectNoAxeViolations(container)` that calls `axe.run(container)` and asserts `violations.length === 0`. **Dev dependency only**; not shipped in production bundles. **No third-party Vitest assertion wrapper is used**: the rule engine is stable and the helper is small, so depending on `axe-core` directly is more robust than depending on a wrapper whose peer-dep range may lag this repo's Vitest `^4.1.5` + RTL `^16.3.2` + happy-dom `^20.9.0` + React 19 stack. **No install in this feature**; this row is a *planned* dev dependency to be added by the relevant `/speckit-tasks` task. The helper itself is implementation work — it lives in test utilities (`src/renderer/ui/primitives/__tests__/axe-config.ts`) during implementation, not as planning-artifact source code. | research §5 / NFR-8 |
| Tests | Vitest only (constitution VI). Coverage gate **≥ 90 %** on the `src/renderer/ui/` module (NFR-1) | Test Strategy section |
| CI | No workflow changes; the existing `codegen:verify → typecheck → lint → test → package:dir` pipeline gates this feature | research §6 |

**No `NEEDS CLARIFICATION` items remain at this layer.** The three open spec questions were
resolved on 2026-05-04 (`/speckit-clarify`) and are woven through the FR / NFR / SC table cited
above.

### Hard Non-Implementation Boundaries

This plan repeats the spec's negative scope verbatim because UI-shell features are unusually
prone to scope creep:

- **No cashier login, operator session, or auth.** The operator slot is a placeholder.
- **No sales / cart / receipts / payments business logic.** Placeholder layouts only.
- **No inventory data or mutation.** Inventory is "navigation only".
- **No backend API calls and no offline sync.** The four connection states are driven by a
  **dev / story toggle**. The `syncing` value is visual-only — see below.
- **No new IPC channels.** The preload bridge surface added by 002 is consumed read-only; nothing
  is added.
- **No preload changes, no SecretStore changes, no DB migrations, no OpenAPI changes, no Sentry /
  logging changes, no auto-update plumbing, no CI / workflow file changes.** CI / workflow
  files (`.github/workflows/**`) are part of the forbidden source-scope allowlist (see
  authoritative list in `src/renderer/__tests__/source-scope-guard.const.ts` per tasks.md T005)
  and MUST NOT be modified by 003 unless explicitly scoped by a later approved task — which
  003 does not have.
- **No mobile hamburger drawer / bottom-tab bar / drawer pattern at any width.**
- **No runtime density toggle.** Compact density is a reserved token only.
- **The `syncing` state behind the connection indicator MUST NOT** trigger any sync queue, backend
  call, persistence write, IPC message, or preload-bridge change. It exists only so that a future
  offline-sync feature can adopt the existing pixel without reshaping the indicator.
- **The payment-tender visual reservation in the receipt placeholder MUST NOT** introduce any
  payment logic, payment API, payment SDK, payment gateway, card-terminal integration,
  insurance validation, voucher / gift-card validation, receipts printing, `Money` type, currency
  formatter, or any value-bearing prop on the slot components. The eleven reserved slots
  (`tender.{cash|card|bank-transfer|voucher|insurance|split}`,
  `totals.{amount-due|amount-paid|remaining|change-due}`, `receipt.breakdown`) are
  **labelled rectangles only**, owned by future feature **005-checkout-payments**.

These are not soft preferences. CI / test invariants in the Test Strategy section enforce them.

## Constitution Check (Initial)

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | **PASS** | Shell is renderer-only; no network calls; nothing breaks if the device is offline. The `offline` connection visual is a *display* concern, not a behavioural change. |
| II. Financial Precision | N/A | No money in this feature. |
| III. Process-Boundary Discipline | **PASS** | No new IPC channels, no preload changes, no SecretStore changes, no main-process additions. The shell consumes the existing `pairing` namespace read-only via the boot router. |
| IV. Hardware Loud, Not Silent | **PASS** | No new hardware surface. Keyboard / mouse / touch are all standard browser inputs handled by the shared component layer. |
| V. Type Safety End-to-End | **PASS** | All shared component props, token contracts, route definitions, and connection-state values are typed in strict TS. No `any`, no `as` casts on public surfaces (NFR-2). |
| VI. Test-First, Coverage-Gated | **PASS** | Every shared component ships with a Vitest suite first; `≥ 90 %` line + branch coverage on `src/renderer/ui/` (NFR-1). Per-pane axe rule pass on default / loading / empty / error variants (NFR-8). |
| VII. Observability | **PASS** | No new log lines or breadcrumbs are added. Existing `pino` logger and inert Sentry are untouched. |
| VIII. Terminal Identity ≠ User | **PASS** | This is the load-bearing principle for this feature: the shell renders an operator placeholder but does NOT implement login, session, auth, or any user-identity surface. The placeholder MUST visibly disable operator-bound actions, never silently no-op. |
| IX. Reference, Not Inheritance | **PASS** | No legacy POS shell code is consulted. The Design-Workflow Decision (spec §"Design workflow decision") explicitly forbids accepting Figma-generated code without review and tests. |
| Platform Integration | **PASS** | No backend hosts contacted; no new endpoints; no new IPC. |
| Security | **PASS** | No new attack surface. CSP / contextIsolation / sandbox / nodeIntegration constraints from 001 are unchanged. The shell never reads `device_token` and never reaches the SecretStore. |
| Hardware Matrix | **PASS** | Touchscreen cashier monitor is already in the matrix. The 44 × 44 px touch-target floor is enforced on every interactive element (NFR-5). |
| Domain — Pharmacy POS | N/A | Pharmacy-domain entities are out of scope; placeholder pages have no domain data. |

**Initial gate result: PASS.** No violations, no waivers required.

## Phase 0 — Research

See [./research.md](./research.md). Six decisions are recorded with chosen approach, alternatives,
and rationale: token delivery (CSS variables vs TS-only vs JSON), routing topology, state-store
shape, shared-component module boundary, accessibility automation library, and CI integration.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md). Four conceptual artifacts: `DesignToken`,
  `SharedComponent`, `ShellRegion`, `PlaceholderPane`. **No persisted entities, no new SQLite
  tables, no new SecretStore keys.** All artifacts live in code under `src/renderer/ui/` and are
  pure types + components.
- **Contracts:** [./contracts/](./contracts/). Four interface artifacts:
  1. **`design-tokens.md`** — the canonical token table (color / spacing / typography / radius /
     shadow / density / touch-target) with values, semantic names, and the CSS-variable + TS-name
     bindings.
  2. **`shared-components.md`** — the shared component inventory (Button / Input / Card / Table /
     Badge / Dialog / Toast / StatusBanner) with public prop signatures, variants, states, and
     accessibility contracts.
  3. **`shell-regions.md`** — the AppShell region map (TopBar, NavRail, MainContent, StatusBanner,
     OperatorSlot, ConnectionIndicator, IdentityStrip) with the responsive layout matrix and the
     four connection-state visuals.
  4. **`shell-routes.ts`** — the typed route table for `/app/*` (Dashboard, Sales, Cart, Receipt,
     Inventory, Settings/Help) plus the placeholder-pane state-variant matrix
     (default / loading / empty / error).
- **Quickstart (developer path):** [./quickstart.md](./quickstart.md). Walkthrough: skim the
  contracts, run the test suite, exercise each placeholder pane via dev / story toggles, and
  generate the Figma handoff package.

  **Source-of-truth policy** (same as 001 / 002): once Phase 2 lands code in `src/renderer/ui/`
  and `src/renderer/shell/`, the canonical surface is `src/renderer/`; the contract files in this
  spec directory remain as the planning-time snapshot.

## Project Layout

Additions only; existing 001 + 002 structure untouched.

```
POS-Pulse/
├── src/
│   ├── renderer/
│   │   ├── ui/                         # Shared component inventory + tokens (NEW MODULE)
│   │   │   ├── tokens/
│   │   │   │   ├── colors.ts           # SemanticColor — surface, text, primary, danger, …
│   │   │   │   ├── spacing.ts          # SpacingScale — 4 / 8 / 12 / 16 / 24 / 32 / 48
│   │   │   │   ├── typography.ts       # TypographyScale — family, weight, size, line-height
│   │   │   │   ├── radius.ts           # RadiusScale — sm / md / lg / pill
│   │   │   │   ├── shadow.ts           # ShadowScale — sm / md / lg / overlay
│   │   │   │   ├── density.ts          # Density — `comfortable` (applied) | `compact` (reserved)
│   │   │   │   ├── touch.ts            # TouchTargetMin = 44 (px)
│   │   │   │   ├── index.ts            # public surface
│   │   │   │   └── __tests__/tokens.test.ts
│   │   │   ├── primitives/
│   │   │   │   ├── Button/Button.tsx
│   │   │   │   ├── Button/Button.test.tsx
│   │   │   │   ├── Input/Input.tsx
│   │   │   │   ├── Input/Input.test.tsx
│   │   │   │   ├── Card/Card.tsx
│   │   │   │   ├── Card/Card.test.tsx
│   │   │   │   ├── Table/Table.tsx
│   │   │   │   ├── Table/Table.test.tsx
│   │   │   │   ├── Badge/Badge.tsx
│   │   │   │   ├── Badge/Badge.test.tsx
│   │   │   │   ├── Dialog/Dialog.tsx
│   │   │   │   ├── Dialog/Dialog.test.tsx
│   │   │   │   ├── Toast/Toast.tsx
│   │   │   │   ├── Toast/Toast.test.tsx
│   │   │   │   ├── StatusBanner/StatusBanner.tsx
│   │   │   │   ├── StatusBanner/StatusBanner.test.tsx
│   │   │   │   └── index.ts            # re-exports
│   │   │   └── states/
│   │   │       ├── LoadingState.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       ├── ErrorState.tsx
│   │   │       ├── ScreenTooSmall.tsx
│   │   │       ├── __tests__/states.test.tsx
│   │   │       └── index.ts
│   │   │
│   │   ├── shell/                      # AppShell layout + regions (NEW MODULE)
│   │   │   ├── AppShell.tsx            # parent layout — top bar, rail, <Outlet />, banner
│   │   │   ├── AppShell.test.tsx
│   │   │   ├── regions/
│   │   │   │   ├── TopBar.tsx
│   │   │   │   ├── NavRail.tsx         # responsive: expanded / icon-only / hidden
│   │   │   │   ├── IdentityStrip.tsx   # tenant + branch + terminal label
│   │   │   │   ├── ConnectionIndicator.tsx   # 4-state visual
│   │   │   │   ├── OperatorSlot.tsx    # placeholder, visibly disabled
│   │   │   │   └── __tests__/*.test.tsx
│   │   │   ├── viewport/
│   │   │   │   ├── useViewportTier.ts  # → 'expanded' | 'icon-only' | 'too-small'
│   │   │   │   └── __tests__/useViewportTier.test.ts
│   │   │   ├── connection/
│   │   │   │   ├── useConnectionState.ts   # zustand slice — dev/story toggle only
│   │   │   │   └── __tests__/useConnectionState.test.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── app/                    # placeholder pane routes (NEW)
│   │   │   │   ├── DashboardPlaceholder.tsx
│   │   │   │   ├── SalesPlaceholder.tsx
│   │   │   │   ├── CartPlaceholder.tsx
│   │   │   │   ├── checkout/                       # naming aligned to route /app/checkout and future 005-checkout-payments
│   │   │   │   │   ├── CheckoutPlaceholder.tsx     # composes the reserved slots
│   │   │   │   │   ├── ReservedTenderRow.tsx       # generic labelled-rectangle for the 6 tender kinds
│   │   │   │   │   ├── ReservedTotalsRow.tsx       # generic labelled-rectangle for the 5 amount fields
│   │   │   │   │   ├── reserved-slot-ids.ts        # enum of the 11 slot ids — frozen contract
│   │   │   │   │   └── __tests__/
│   │   │   │   │       ├── CheckoutPlaceholder.test.tsx      # all 11 slots rendered, in order, with the "Reserved for 005-checkout-payments" body
│   │   │   │   │       └── reserved-slot-noop.test.tsx       # zero fetch / IPC / persistence / printing on mount/hover/focus/click
│   │   │   │   ├── InventoryPlaceholder.tsx
│   │   │   │   ├── SettingsHelpPlaceholder.tsx
│   │   │   │   └── __tests__/placeholders.test.tsx
│   │   │   ├── pairing/                # unchanged
│   │   │   └── paired/                 # unchanged (002 — kept; see Note A below)
│   │   │
│   │   ├── router.tsx                  # EXTENDED — adds /app/* parent route
│   │   ├── App.tsx                     # unchanged (still a one-line router host)
│   │   └── styles/
│   │       └── tailwind.css            # EXTENDED — adds :root { --… } token vars + @theme
│   │
│   └── (no changes under src/main/, src/preload/, src/shared/, scripts/, migrations/)
│
└── (no changes under `.github/workflows/**`, electron-builder configs, `openapi-snapshot.json` —
    all in the forbidden source-scope allowlist per tasks.md T005)
```

**Note A — `routes/paired/` (decision recorded, see O2 below).** 002 used `/paired` as a
confirmation screen after pairing succeeded. 003 records a recommendation in **O2** with two
scope-compliant options:

- **Preferred:** the post-pair-success boot lands on `/app/dashboard`; `/paired` is reached only
  as the immediate post-pair confirmation surface, not on every subsequent launch.
- **Fallback:** `/paired` adds a `Continue to dashboard →` action that navigates to
  `/app/dashboard` (visual only — no IPC, no bridge call). This eliminates the dead-end while
  deferring the landing-route change.

**Both options preserve 002's pairing-bypass contract** — unpaired terminals still route to
`/pairing` and cannot reach `/app/*`. See O2 for the full hard non-regression rules and the
implementer's recorded choice.

**Note B — Naming convention for the checkout/receipt pane.** The route, the folder, the
component, and the future feature use the **`checkout`** axis consistently:

- Route path: `/app/checkout` (frozen in `contracts/shell-routes.ts`).
- NavRail entry label (user-facing): `Receipts / Checkout` (dual term — the cashier may think
  of it as either; both terms are kept in the visible label so operators in either mental
  model find it).
- NavRail entry id (internal): `'receipts'` (kept plural for *internal-id stability* — 002's
  patterns expect noun-form ids; this is internal naming only and does NOT affect any user-
  visible surface).
- Folder: `src/renderer/routes/app/checkout/`.
- Component: `CheckoutPlaceholder.tsx`.
- Test file: `CheckoutPlaceholder.test.tsx`.
- Future feature: `005-checkout-payments`.

**Tri-axis justification.** The three "names" — internal id `receipts`, route path
`/app/checkout`, component `CheckoutPlaceholder` — are deliberately distinct and each
optimised for its consumer:

| Axis | Optimised for | Value |
|:--|:--|:--|
| **Internal id** | Stable references in code (NavRail iterators, e2e test selectors) | `'receipts'` (kept plural for stability across analyses) |
| **Route path** | URL-bar legibility + alignment with future feature `005-checkout-payments` | `/app/checkout` |
| **Component name** | File-tree clarity + alignment with the future-feature folder consumed by 005 | `CheckoutPlaceholder` |

This is intentional, not a drift; renaming the internal id to `'checkout'` would force
churn on every later test that imports `shellNavEntries` by id.

**Receipt-prefixed slot ids — deliberate exception.** Two slot ids retain the `receipt`
prefix because they name the **printed-receipt artifact**, not the pane: `receipt.breakdown`
is the printed receipt's payment-breakdown row. Renaming it to `checkout.breakdown` would
obscure that it lives on the printout, not the pane. The other ten slot ids use `tender.*`
and `totals.*` — neither route- nor pane-named.

**Historical-naming disclaimer.** Earlier drafts of the planning artifacts used
`ReceiptPlaceholder` interchangeably with `CheckoutPlaceholder`. **`CheckoutPlaceholder` is
the canonical name in 003.** The string `ReceiptPlaceholder` survives in this repo only in
two intentional-history locations:

1. This Note B (the migration record itself).
2. tasks.md T052's parenthetical "(renaming away from any earlier `ReceiptPlaceholder`
   reference per Plan §"Note B")".

Any future mention of `ReceiptPlaceholder` outside those two locations is a stale reference
and MUST be rewritten as `CheckoutPlaceholder`. **No active 003 implementation surface
uses `ReceiptPlaceholder`.**

## Test Strategy

| Surface | Framework | What it covers | Coverage gate |
|:--|:--|:--|:--|
| `src/renderer/ui/tokens/*` | Vitest | Token export shape; CSS-variable name ↔ TS-name parity; semantic palette completeness; touch-target constant === 44 | ≥ 90 % |
| **Compact-density dead-token guard** | Vitest (static-analysis style) | Asserts `density.compact` is exported as a reserved token (referenced by `tokens.test.ts` and the design-token contract) and **no source file under `src/renderer/` imports / references `density.compact` outside the token-definition file and its test file**. The check parses the source tree and fails the run on any unauthorised reference. | guard (must be no-op) |
| `src/renderer/ui/primitives/Button` | Vitest + RTL + happy-dom | All variants × all states; disabled state announces; minimum 44 × 44 px touch-target invariant | ≥ 90 % |
| `src/renderer/ui/primitives/Input` | Vitest + RTL | default / disabled / error states; label association; focus ring visible | ≥ 90 % |
| `src/renderer/ui/primitives/Card` | Vitest + RTL | Section roles; default / muted / elevated variants | ≥ 90 % |
| `src/renderer/ui/primitives/Table` | Vitest + RTL | Header / row roles; empty / loading / error slot variants | ≥ 90 % |
| `src/renderer/ui/primitives/Badge` | Vitest + RTL | Semantic intents (`info` / `success` / `warning` / `danger` / `neutral`); accessible name when icon-only | ≥ 90 % |
| `src/renderer/ui/primitives/Dialog` | Vitest + RTL + user-event | Focus trap; ESC dismiss; focus restored on close; aria-labelledby wired | ≥ 90 % |
| `src/renderer/ui/primitives/Toast` | Vitest + RTL | Live-region semantics; intents; auto-dismiss timing (deterministic via fake timers) | ≥ 90 % |
| `src/renderer/ui/primitives/StatusBanner` | Vitest + RTL | The four connection-state intents render distinct visuals; `syncing` carries `aria-live="polite"` | ≥ 90 % |
| `src/renderer/ui/states/*` | Vitest + RTL | Loading, Empty, Error, ScreenTooSmall — each rendered for every placeholder pane | ≥ 90 % |
| `src/renderer/shell/AppShell` | Vitest + RTL | Top bar + rail + outlet present; landmark roles correct; identity strip falls back gracefully | ≥ 90 % |
| `src/renderer/shell/regions/NavRail` | Vitest + RTL | Expanded layout @ ≥ 1280 px; icon-only @ 1024–1279 px; viewport `< 1024 px` renders ScreenTooSmall, NEVER a hamburger drawer | ≥ 90 % |
| `src/renderer/shell/regions/ConnectionIndicator` | Vitest + RTL | Four states render distinct color + label; `syncing` adds NO side-effect (no fetch, no IPC, no persistence call observed) | ≥ 90 % |
| `src/renderer/shell/viewport/useViewportTier` | Vitest | Returns `expanded` ≥ 1280, `icon-only` ∈ [1024, 1280), `too-small` < 1024; transitions are debounced and deterministic under fake `matchMedia` | ≥ 90 % |
| `src/renderer/shell/connection/useConnectionState` | Vitest | State transitions; default = `online`; setter is the only mutation path; no listener subscribes to network APIs | ≥ 90 % |
| `src/renderer/routes/app/*Placeholder` | Vitest + RTL | Each pane renders default + each state variant via prop / story toggle; no domain data; no fetch attempted | ≥ 90 % |
| `src/renderer/routes/app/checkout/CheckoutPlaceholder` | Vitest + RTL | All eleven reserved slots (`tender.{cash|card|bank-transfer|voucher|insurance|split}`, `totals.{amount-due|amount-paid|remaining|change-due}`, `receipt.breakdown`) render in fixed display order, each carrying the "Reserved for 005-checkout-payments" body and no value-bearing props | ≥ 90 % |
| `src/renderer/routes/app/checkout/__tests__/reserved-slot-noop.test.tsx` | Vitest + RTL + user-event | Mounting, hovering, focusing, and clicking each reserved slot triggers **zero** observable calls to `globalThis.fetch`, `window.api`, `window.localStorage`, `sessionStorage`, or any printing / payment helper (spies asserted at zero) | guard (must be no-op) |
| **Per-pane accessibility (axe)** | Vitest + `axe-core ^4.10.0` via `expectNoAxeViolations(container)` helper | Each placeholder pane in default / loading / empty / error variant: zero violations on a documented baseline rule set | smoke (zero violations) |
| **Bridge non-regression — static no-touch source-scope guard** | Vitest (static-analysis style) + PR review checklist | This feature MUST NOT modify any of the **forbidden source-scope** paths listed below. A static guard test fails the run if any of these paths are touched by this feature's commits. PR reviewers additionally run `git diff --name-only origin/main...HEAD` and reject any diff line under the forbidden allowlist. **Forbidden source-scope paths:** `src/preload/**`, `src/main/ipc/**`, `src/main/pairing/**`, `src/main/secrets/**`, `src/shared/bridge-api.ts`, `src/shared/api-types.ts`, `migrations/**`, `scripts/codegen-api.ts`, `scripts/openapi-snapshot.json`, `.github/workflows/**`. **Authoritative allowlist** lives in `src/renderer/__tests__/source-scope-guard.const.ts` per tasks.md T005; this list is a planning-time mirror — if the two diverge, the `const` wins. | guard (must be no-op) |

**Coverage roll-up:** `src/renderer/ui/` directory ≥ 90 % line + branch (NFR-1). The shell module
(`src/renderer/shell/`) is held to the same gate to avoid a "tested primitives, untested layout"
gap.

## CI / Build / Package

**No workflow file change.** The existing `.github/workflows/ci.yml` pipeline applies unchanged:

```
checkout → setup-node → npm ci → npm run codegen:verify → npm run typecheck → npm run lint
       → npm test -- --coverage → npm run package:dir → upload-artifact
```

This feature is fully contained in the renderer; `codegen:verify` is a no-op for it (no OpenAPI
delta) and `package:dir` exercises the new shell paths only as part of the bundle build.

The accessibility-axe rule pass runs inside `npm test -- --coverage` and contributes to the same
test result.

## Phase 2 — Implementation Outline

The work decomposes into eight ordered groups. `/speckit-tasks` will expand each into concrete,
test-first tasks. Order matters: each step's tests gate the next.

1. **Design tokens — values + bindings.** Author `src/renderer/ui/tokens/*`, extend
   `src/renderer/styles/tailwind.css` with the `:root { --… }` block and the `@theme` mappings,
   and write the parity tests (CSS-var name ↔ TS-name) and the token-completeness tests. The
   `compact` density value is exported as a reserved token but no component reads it at runtime.
   **Land the compact-density dead-token guard test in this group**: it parses the source tree
   under `src/renderer/` and asserts that `density.compact` is referenced ONLY from the
   token-definition file (`src/renderer/ui/tokens/density.ts`) and its test
   (`src/renderer/ui/tokens/__tests__/tokens.test.ts`). Any other reference fails the run.
   No runtime density toggle, no settings UI, no media-query that branches on
   `density.compact` — only the token export and the parity / dead-token tests touch it.
2. **State variant primitives.** `LoadingState`, `EmptyState`, `ErrorState`, `ScreenTooSmall`.
   Each is dumb, intentional, accessible, and reusable by every placeholder pane.
3. **Shared component inventory.** Author the eight primitives in alphabetical order — Badge,
   Button, Card, Dialog, Input, StatusBanner, Table, Toast — each with its variants / states /
   tests / a11y contract. Touch-target invariant test ships with Button and propagates to anything
   that wraps it.
4. **Viewport tier hook.** `useViewportTier` — pure observer over `window.matchMedia` with the
   three documented breakpoints. Tested under fake `matchMedia`. No hamburger drawer is wired.
5. **Connection-state slice.** Zustand slice with the four enum values and a setter. Default is
   `online`. The setter is the *only* mutation path. A guard test asserts the slice has no
   side-effect listeners (no fetch, no IPC, no persistence subscription).
6. **AppShell + regions.** `AppShell` composes `TopBar` (which composes `IdentityStrip`,
   `ConnectionIndicator`, `OperatorSlot`) and `NavRail`, with a `<Outlet />` for the placeholder
   panes. Landmark roles wired (`<header>`, `<nav>`, `<main>`, `<section role="status">`).
7. **Placeholder routes.** Six placeholder panes under `src/renderer/routes/app/`. Each renders
   the default state and exposes a `?state=` URL search param (dev-only) so each variant can be
   exercised in tests and stories. No domain data, no fetches, no IPC calls.
   The **Checkout placeholder** (route `/app/checkout`, file
   `src/renderer/routes/app/checkout/CheckoutPlaceholder.tsx`) additionally composes the eleven
   reserved payment-tender slots (`tender.{cash|card|bank-transfer|voucher|insurance|split}`,
   `totals.{amount-due|amount-paid|remaining|change-due}`, `receipt.breakdown`) using two generic
   labelled-rectangle components (`ReservedTenderRow`, `ReservedTotalsRow`); the slot ids are
   frozen in `reserved-slot-ids.ts` and consumed by **005-checkout-payments** without renaming.
   The slot components carry no value-bearing props, no money types, no formatters, no inputs, and
   no event handlers; the no-op guard test (Test Strategy table) asserts mounting / hovering /
   focusing / clicking any slot triggers zero side-effect calls.
8. **Router wiring + bridge non-regression guard.** Extend `src/renderer/router.tsx` with the
   `/app/*` parent route mounting `AppShell`; the existing `/pairing` and `/paired` routes are
   unchanged.

   **Land the bridge non-regression guard in this group.** The guard is a *static no-touch
   source-scope guard*: a Vitest test that reads a frozen forbidden-paths array and asserts
   that **no file matching any of those globs has been added or modified by this feature's
   commits**. Concretely:

   - The forbidden allowlist is exported as a `const` from
     `src/renderer/__tests__/source-scope-guard.const.ts` and consumed by the test
     `src/renderer/__tests__/source-scope-guard.test.ts`.
   - Forbidden paths (frozen): `src/preload/**`, `src/main/ipc/**`, `src/main/pairing/**`,
     `src/main/secrets/**`, `src/shared/bridge-api.ts`, `src/shared/api-types.ts`,
     `migrations/**`, `scripts/codegen-api.ts`, `scripts/openapi-snapshot.json`,
     `.github/workflows/**`. (CI / workflow files MUST NOT be touched by 003 — adding,
     modifying, or deleting any workflow file is treated identically to touching
     `src/preload/**`. The authoritative allowlist lives in
     `src/renderer/__tests__/source-scope-guard.const.ts` per tasks.md T005.)
   - The **deterministic check** the test runs in CI / locally: invoke `git diff --name-only
     origin/main...HEAD` (the *triple-dot* form, which is the merge-base diff and is
     squash-merge-safe) and assert the intersection with the forbidden allowlist is empty. If
     `origin/main` is not reachable (e.g. shallow clone), fall back to comparing against the
     fork-point `git rev-parse origin/main` recorded at clone-time; if neither is available the
     test is skipped with an explicit warning, and the **PR-review checklist line** becomes the
     defence (see `quickstart.md` §6 Definition of Done).
   - The check is intentionally *additive-safe*: deleting a forbidden file is also a failure,
     so 003 cannot accidentally remove (e.g.) a pairing IPC handler.

   The reason for the static-allowlist approach (rather than the originally-drafted `git diff
   --stat` against an ambient merge-base) is determinism: Vitest must be able to run the guard
   without depending on git state being shaped a particular way at PR-build time. The git
   call is the *primary* check, but the allowlist is the *contract* — a future workflow rename
   or git-config drift cannot bypass it.

A cross-cutting **Figma handoff package** (`docs/figma-handoff/` or equivalent under
`specs/003-pos-ui-shell/contracts/`) is produced alongside step 8 and references every contract
above.

## Figma Make / Figma MCP — handoff strategy

This is the first POS-Pulse feature whose primary output is *visual*, so the workflow is pinned
in the spec ("Design workflow decision") and concretised here.

| Stage | Tool | Output | Source-of-truth status |
|:--|:--|:--|:--|
| Exploration | **Figma Make** | Throwaway prototypes used to converge on a visual direction. | Not a contract. Discarded after review. |
| Reviewed design | **Stable Figma file** (separate from Figma Make) | Visual mocks of: tokens; the eight primitives × variants × states; the AppShell at expanded + icon-only viewport; the four connection-state visuals; the four state-variant slots (loading / empty / error / default) for each placeholder. | Visual reference only. |
| Implementation handoff | **Figma MCP + Claude Code** | Pixel-accurate implementation pass that satisfies this spec + plan. Produces typed, tested code that goes through standard review. | NOT a code source. Repo wins disagreements. |
| Repo | **`src/renderer/ui/` + `src/renderer/shell/` + tests** | The actual implementation. | **Source of truth.** |

### When does Figma Make happen?

**Recommendation: Figma Make happens AFTER `/speckit-tasks` but BEFORE the implementation tasks
start being executed by Sonnet.**

- `/speckit-tasks` produces an ordered, test-first task list. Each task names the contract it
  exists to satisfy (token table, component spec, region map, route map). Those contracts are the
  *brief* a designer needs to do useful Figma Make exploration.
- Running Figma Make *before* `/speckit-tasks` would explore against a less-precise brief and is
  more likely to produce decisions that conflict with the spec's hard exclusions (e.g. a
  hamburger drawer, a runtime density toggle, a "hide the offline banner" affordance).
- Running Figma Make *during* implementation is acceptable for fine-tuning visuals, but the spec
  + plan + tasks remain the gate; any design-driven scope addition that contradicts a hard
  exclusion MUST be rejected.

This plan deliberately does NOT generate the Figma prompt(s) yet. They are produced as part of
the same step that builds the handoff package, after `/speckit-tasks` provides the ordered brief.

### Figma MCP handoff requirements (later, not now)

When Figma MCP is invoked to read the reviewed Figma file for implementation, the file MUST
contain at minimum:

- Token table page (color / spacing / typography / radius / shadow) with names that match
  `src/renderer/ui/tokens/` exactly. Mismatches block implementation.
- Component pages for each of the eight primitives, with variants and states named to match the
  contracts in `contracts/shared-components.md`.
- AppShell pages for **expanded ≥ 1280** and **icon-only 1024–1279** layouts, plus a "screen too
  small" fallback for `< 1024`. **No mobile drawer artwork.**
- Connection-indicator page covering all four states (`online`, `degraded`, `offline`,
  `syncing`).
- Placeholder-pane pages for each of the six routes (Dashboard, Sales, Cart, Receipt, Inventory,
  Settings/Help) showing default + loading + empty + error variants.

If the reviewed Figma file disagrees with the repo, the repo wins. The Figma file is amended; the
repo is not (Constitution IX, spec Design Workflow Decision §"Repo code remains the final source
of truth").

## Repo implementation approach for future Sonnet execution

The implementation pass is straightforward enough to be batched safely:

- **Order:** follow Phase 2's eight groups verbatim. Each group's tests precede its code (TDD).
- **Granularity:** primitive-by-primitive within group 3; one PR per group is acceptable but a
  single PR for groups 1 + 2 + 3 is also safe because they share no runtime state with the rest.
- **Constraints:** every primitive consumes tokens — no hard-coded colors, sizes, or shadows in
  component code (FR-18). Every interactive element passes the 44 × 44 px touch-target
  invariant test (NFR-5). Every primitive ships with an a11y rule pass (NFR-8).
- **Boundary discipline:** the static no-touch source-scope guard (see Phase 2 step 8) runs in
  CI from group 8 onward and fails any PR that adds, modifies, or deletes a file matching the
  forbidden allowlist (`src/preload/**`, `src/main/ipc/**`, `src/main/pairing/**`,
  `src/main/secrets/**`, `src/shared/bridge-api.ts`, `src/shared/api-types.ts`, `migrations/**`,
  `scripts/codegen-api.ts`, `scripts/openapi-snapshot.json`, `.github/workflows/**`). The
  deterministic check uses `git diff --name-only origin/main...HEAD` with a fallback to the
  frozen allowlist captured in `source-scope-guard.const.ts` (the authoritative source —
  this list is a planning-time mirror).
- **Story / dev toggles:** placeholder-pane state-variants and connection-state are reachable via
  a `?state=…` / `?conn=…` URL search param exposed only in dev builds. This keeps the test
  surface deterministic without needing a real Storybook installation.
- **Deferred:** any temptation to fetch real data, query the DB, hit the bridge for non-pairing
  data, or wire a settings UI is out of scope and must be rejected — re-plan in a follow-up
  feature.

## Constitution Check (Post-Design)

Re-evaluated after the layout, contracts, and CI design above were settled.

| Principle / Constraint | Status | Notes (what changed in design) |
|:--|:--:|:--|
| I. Offline-First | **PASS** | Shell never fetches; offline visual is purely display. |
| II. Financial Precision | N/A | unchanged. |
| III. Process-Boundary Discipline | **PASS** | The static no-touch source-scope guard in step 8 (forbidden allowlist: `src/preload/**`, `src/main/ipc/**`, `src/main/pairing/**`, `src/main/secrets/**`, `src/shared/bridge-api.ts`, `src/shared/api-types.ts`, `migrations/**`, `scripts/codegen-api.ts`, `scripts/openapi-snapshot.json`, `.github/workflows/**`) makes the "no IPC / preload / SecretStore / migrations / codegen / CI-workflow changes" boundary load-bearing in CI, not just documented. The authoritative allowlist lives in `src/renderer/__tests__/source-scope-guard.const.ts` (tasks.md T005). |
| IV. Hardware Loud, Not Silent | **PASS** | Touch-target floor enforced by an invariant test on Button (and propagated through wrappers). |
| V. Type Safety End-to-End | **PASS** | Tokens shipped as both CSS variables and typed TS exports; component prop types are exhaustive; no `any` on public surfaces. |
| VI. Test-First, Coverage-Gated | **PASS** | ≥ 90 % gate on `src/renderer/ui/` and `src/renderer/shell/`; per-pane axe smoke. |
| VII. Observability | **PASS** | No new logs / breadcrumbs / Sentry tags introduced. |
| VIII. Terminal Identity ≠ User | **PASS** | OperatorSlot is *visibly disabled* (per FR-8) — never silently no-op. The component test asserts a non-empty `aria-disabled` and a tooltip / inline note. |
| IX. Reference, Not Inheritance | **PASS** | Figma is reference-only; the implementation pass produces typed, tested code that goes through normal review. |
| Platform Integration | **PASS** | No new hosts; no new endpoints; no new IPC. |
| Security | **PASS** | No new attack surface introduced; CSP / sandbox / contextIsolation untouched. |
| Hardware Matrix | **PASS** | Touchscreen cashier monitor matched by 44 × 44 px floor + responsive viewport matrix. |
| Domain — Pharmacy POS | N/A | unchanged. |

**Post-design gate result: PASS.**

## Risks & Open Items

- **R1 — Token-name drift between CSS variables, TS exports, and Figma file.** The token table is
  expressed in three places (CSS, TS, Figma). *Mitigation:* the parity test in step 1 asserts
  that every CSS variable in `tailwind.css` has a TS export with the matching name; the
  Figma MCP handoff requirement above asserts the Figma names match by inspection. A drift
  detector test runs in CI for the first two; the third is a review checklist item.
- **R2 — `useViewportTier` flicker at boundary widths.** Resizing across the 1280 / 1024 px lines
  could flap. *Mitigation:* debounce internal transitions by 100 ms and use `matchMedia`
  listeners (not raw `resize`) so we observe only the documented breakpoints; tests assert no
  more than one tier transition is dispatched for a single window resize that crosses a
  breakpoint.
- **R3 — `syncing` state being mistakenly wired to real logic by a future contributor.**
  *Mitigation:* the connection-slice guard test asserts the slice has zero side-effect
  subscriptions, and the static no-touch source-scope guard (forbidden-allowlist + `git diff
  --name-only origin/main...HEAD` check, see Phase 2 step 8) fails any PR that mutates the
  IPC / preload / SecretStore / migrations / codegen surfaces. The contract file `contracts/shell-regions.md` repeats the
  non-implementation list verbatim so it cannot be missed.
- **R4 — Tailwind v4 CSS-first migration tripping the existing `pairing` styles.** *Mitigation:*
  the token CSS additions are scoped to `:root` and `@theme`; pairing-screen styles continue to
  use the same Tailwind utilities. A snapshot test on the pairing screen detects regressions.
- **R5 — Per-pane axe checks producing flaky results from happy-dom layout differences.**
  *Mitigation:* baseline an explicit rule set (color-contrast off — happy-dom does not
  compute it accurately; landmark / aria / role rules on); document the off-rules in
  `contracts/shared-components.md` so coverage gaps are visible, not silent.
- **R6 — Figma file lagging the repo.** *Mitigation:* every shared component PR lists the Figma
  page IDs it touches in the PR template; designers update the Figma file before merging or
  the PR is held. This is a process risk; no automation prevents it.
- **R7 — Payment-tender reservation slot ids drifting before 005-checkout-payments lands.** The
  eleven slot ids in `reserved-slot-ids.ts` are a forward contract that 005 will consume.
  *Mitigation:* the slot ids are exported as a `const` enum, the test file asserts the exact
  set, and renaming any id requires a coordinated amendment to both this spec and the
  005-checkout-payments spec when it lands. Adding a new slot id is acceptable (additive); removing
  or renaming an existing id requires a spec amendment.
- **R8 — A future contributor accidentally wiring a real payment hook into a reserved slot.**
  *Mitigation:* the `reserved-slot-noop.test.tsx` guard asserts zero side-effect calls on
  mount / hover / focus / click for every slot, and the slot component types forbid value-bearing
  props (no `amount`, no `currency`, no `onSubmit`, no money type). A typecheck failure is the
  first line of defence; the guard test is the second.
- **O1 — Whether to expose a tiny "design tokens" inspector route in dev builds.** Open: useful
  for debugging token drift, but adds a sub-route. Resolution deferred to `/speckit-tasks` —
  if added, it MUST be dev-only and dropped from production bundles. Marked non-blocking.
- **O2 — `/paired` → `/app/dashboard` journey.** **Resolved (2026-05-04, recommendation).**
  The original framing left this as a fully-deferred product decision. We now record an
  explicit recommendation that 003 may apply, plus a strict no-regression rule on pairing
  security. The recommendation has two layers and 003 may pick either; both are within scope of
  *visual* changes only (no IPC, no preload, no SecretStore, no boot-router gate change):

  1. **Preferred (003 recommendation).** After the boot router resolves the paired-terminal
     status as `paired`, the **shell landing route is `/app/dashboard`** rather than `/paired`.
     `/paired` becomes an internal route reachable only as a confirmation surface for the moment
     immediately after a successful pair (i.e. the route the pairing flow itself navigates to
     on success). For *every subsequent* boot the user lands directly on `/app/dashboard`. This
     eliminates the visible dead-end on day-2 launches without changing 002's pairing-bypass
     contract.

  2. **Fallback (deferred-with-bridge).** If 003 elects to defer the landing-route change to a
     later feature, then `/paired` MUST NOT be a dead-end: it MUST render a clearly-labelled
     `Continue to dashboard →` action (a Button styled with the shell's `primary` intent and
     consuming the shared `Button` primitive) that navigates the user to `/app/dashboard`. The
     action is **purely a client-side route change** — no IPC, no bridge call, no token
     re-read, no SecretStore access. The pairing-bypass contract from 002 (`getStatus()` is the
     gate) is unchanged: an unpaired terminal still cannot reach `/app/*`, and the boot router
     still redirects unpaired terminals to `/pairing`.

  **Hard non-regression rules (apply to BOTH options):**

  - 003 MUST NOT weaken any pairing check delivered by 002.
  - 003 MUST NOT touch `src/main/pairing/**`, `src/preload/**`, `src/main/ipc/**`,
    `src/main/secrets/**`, or `src/shared/bridge-api.ts` — the static no-touch source-scope
    guard (Phase 2 step 8) enforces this independent of the chosen option.
  - 003 MUST preserve the boot-router behaviour that unpaired terminals route to `/pairing`
    and cannot reach `/app/*`. A test in `src/renderer/__tests__/pairing-gate.test.tsx`
    asserts that a fake bridge returning `getStatus() === 'unpaired'` causes the boot router to
    land on `/pairing` and that `/app/*` is unreachable from that state.
  - 003 MUST NOT add a "skip pairing" link, an "I'll pair later" affordance, or any other
    bypass surface. The constitution's Principle VIII (terminal identity ≠ user identity) and
    002's pairing-bypass contract remain load-bearing.

  **Recommendation owner:** the implementer of Phase 2 step 8 picks option 1 vs option 2 at
  PR-time and notes the choice in the PR description. Both options are scope-compliant. This
  open item is hereby moved out of the *Open Items* category and into a *recorded decision* —
  see "Pairing-handoff journey decision" below.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
