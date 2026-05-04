# Quickstart — POS UI Shell

**Feature:** 003-pos-ui-shell
**Plan:** [./plan.md](./plan.md)
**Audience:** the engineer (or Sonnet pass) who picks up `/speckit-tasks` and starts implementing.

This document is the developer's path through this feature. It assumes you have read the spec,
the plan, the data model, and the four contract files. It does NOT replace them.

---

## 0. Prerequisites

- Repo cloned and `npm install` complete; pairing-foundation features 001 + 002 already merged
  (current `main` reflects this).
- Branch off `main` with the convention `feat/pos-ui-shell-<phase>` (one branch per Phase 2
  group, or a single branch if `/speckit-tasks` produces small enough atomic commits).
- Working tree clean before starting.

---

## 1. Read the contracts in this order

1. `spec.md` — what we are building and what we are NOT building (Out of Scope, Clarifications).
2. `plan.md` — Phase 2 Implementation Outline (eight ordered groups).
3. `contracts/design-tokens.md` — token names, frozen.
4. `contracts/shared-components.md` — primitive public surfaces, frozen.
5. `contracts/shell-regions.md` — AppShell composition + responsive matrix + connection states.
6. `contracts/shell-routes.ts` — the route map, the placeholder state model, the viewport
   tier model.

If anything in steps 3–6 disagrees with the spec or plan, **stop** — the disagreement must be
resolved before code lands.

---

## 2. Run the existing test suite

```powershell
npm run codegen:verify
npm run typecheck
npm run lint
npm test -- --coverage
```

All four MUST be green on `main` before this feature starts. They are the baseline; the new
suites we add must also be green when this feature finishes.

---

## 3. Phase 2 walkthrough — step by step

The numbered groups below mirror Plan §"Phase 2 — Implementation Outline". Each has a
**TDD-first** loop: write the failing test, then the implementation.

### Group 1 — Design tokens

1. Author `src/renderer/ui/tokens/__tests__/tokens.test.ts` first. The parity test (Plan
   research §1) MUST fail because there are no tokens yet.
2. Add the CSS custom properties to `src/renderer/styles/tailwind.css` under `:root` and the
   `@theme` mapping.
3. Add the TS exports under `src/renderer/ui/tokens/`.
4. Re-run `npm test -- --coverage` until the parity test passes.

**Done when:** all token names from `contracts/design-tokens.md` exist in both CSS and TS, the
parity test is green, and `density.compact` is exported but unused.

### Group 2 — State variant primitives

`LoadingState`, `EmptyState`, `ErrorState`, `ScreenTooSmall`. Tests first; each must:

- consume tokens (no hard-coded styles);
- pass the axe rule pass (research §5);
- not touch the DOM outside its own subtree.

### Group 3 — Shared components (eight primitives, alphabetical)

For each of `Badge` / `Button` / `Card` / `Dialog` / `Input` / `StatusBanner` / `Table` / `Toast`:

1. Author the public prop type EXACTLY as documented in `contracts/shared-components.md`.
2. Write the test file FIRST: enumerate variants × states; assert the touch-target invariant on
   `Button`; assert focus-trap on `Dialog`; assert live-region semantics on `Toast` and
   `StatusBanner`.
3. Implement the component. Style only via tokens.
4. Run `npm test -- --coverage` after each primitive — the coverage gate is module-level
   (≥ 90 % on `src/renderer/ui/`), but per-component visibility helps debug.

**Done when:** all eight primitives ship; coverage on `src/renderer/ui/` ≥ 90 %; axe smoke green
for every variant.

### Group 4 — Viewport tier hook

Author `src/renderer/shell/viewport/useViewportTier.ts`. Tests use `Object.defineProperty(window,
'matchMedia', { value: vi.fn(...) })` to fake `matchMedia` queries at the documented boundaries
(1023, 1024, 1279, 1280, 1920).

### Group 5 — Connection-state slice

Author `src/renderer/shell/connection/useConnectionState.ts` (zustand). Default `online`; setter
is the only mutation. Write the **guard tests** described in `contracts/shell-regions.md`:

- spy on `globalThis.fetch`, `window.api`, `window.localStorage`, and any persistence helper;
- exercise `setConnectionState('syncing')` (and the other three values);
- assert zero spy calls.

### Group 6 — AppShell + regions

Compose `TopBar` (with `IdentityStrip`, `ConnectionIndicator`, `OperatorSlot`,
`StatusBanner`), `NavRail`, and `MainContent` (which mounts `<Outlet />`). Test landmarks,
identity-strip placeholders, and the responsive rail layout.

### Group 7 — Placeholder routes

Author the six placeholder panes. Each pane:

- renders its `default` variant by default;
- exposes `?state=loading|empty|error` (dev-only) to render the corresponding variant;
- does NOT fetch, call IPC, or read persistence.

Cross-product tests (router × pane × variant) live in `routes/app/__tests__/placeholders.test.tsx`.

The **Checkout placeholder** is special: it lives in its own subfolder `routes/app/checkout/`
and composes two generic labelled-rectangle components (`ReservedTenderRow`,
`ReservedTotalsRow`) that consume the eleven frozen slot ids from
`routes/app/checkout/reserved-slot-ids.ts`. Two test files ride alongside it:

- `CheckoutPlaceholder.test.tsx` — assert all eleven slots render in the documented order with
  the "Reserved for 005-checkout-payments" body and no value-bearing props.
- `reserved-slot-noop.test.tsx` — guard test: spy on `globalThis.fetch`, `window.api`,
  `window.localStorage`, `sessionStorage`, and any printing / payment helper, then exercise
  mount / hover / focus / click on every slot. Assert zero spy calls.

This is the first test that locks down the payment-tender reservation as **layout only**. If a
future contributor wires a payment hook into a slot, this test fails before the PR can merge.

### Group 8 — Router wiring + bridge non-regression guard

Extend `src/renderer/router.tsx` with:

```ts
{ path: '/app', element: <AppShell />, children: [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: 'dashboard', element: <DashboardPlaceholder /> },
  { path: 'sales',     element: <SalesPlaceholder /> },
  { path: 'cart',      element: <CartPlaceholder /> },
  { path: 'checkout',  element: <CheckoutPlaceholder /> },
  { path: 'inventory', element: <InventoryPlaceholder /> },
  { path: 'settings',  element: <SettingsHelpPlaceholder /> },
] }
```

Land the **static no-touch source-scope guard test** in this group:

- the forbidden allowlist is exported as a frozen `const` from
  `src/renderer/__tests__/source-scope-guard.const.ts`. Do not edit at runtime.
- the test (`src/renderer/__tests__/source-scope-guard.test.ts`) runs the deterministic check:

  ```sh
  git diff --name-only origin/main...HEAD
  ```

  (the *triple-dot* form, which is the merge-base diff and is squash-merge-safe).
- assert the intersection of the diff with the forbidden allowlist is empty.
- if `origin/main` is not reachable (shallow clone), fall back to comparing against the
  fork-point captured at clone-time; if neither is available, skip with an explicit warning and
  rely on the **PR-review checklist line** (see Definition of Done §6).
- the check is *additive-safe*: deleting a forbidden file is also a failure.

**Forbidden source-scope allowlist (frozen):**

- `src/preload/**`
- `src/main/ipc/**`
- `src/main/pairing/**`
- `src/main/secrets/**`
- `src/shared/bridge-api.ts`
- `src/shared/api-types.ts`
- `migrations/**`
- `scripts/codegen-api.ts`
- `scripts/openapi-snapshot.json`

This test guards every PR in this feature thereafter; if it fails, the PR has stepped outside
the UI-only boundary and must be reverted.

---

## 4. Exercising the shell locally

After Group 6 lands the AppShell, you can exercise the placeholder panes manually:

```powershell
npm run dev
```

The Electron window opens; if the local dev environment is paired (or a test pairing fixture is
loaded), navigate via the URL bar in the React DevTools or by editing `useNavigate()` calls in
the boot router temporarily — the cleanest path is to add a transient query string in `App.tsx`
to land directly on `/app/dashboard`. **Do not commit such transient navigation** — it is for
local dev only.

To exercise state variants:

```
http://localhost:5173/#/app/sales?state=loading
http://localhost:5173/#/app/inventory?state=empty
http://localhost:5173/#/app/checkout?state=error
```

To exercise connection states:

```
http://localhost:5173/#/app/dashboard?conn=degraded
http://localhost:5173/#/app/dashboard?conn=offline
http://localhost:5173/#/app/dashboard?conn=syncing
```

These query params are dev-only and dropped from production bundles by the build (Plan
research §3, dev-toggle guard test).

---

## 5. Generate the Figma handoff package

When all eight Phase 2 groups are green:

1. Compile `contracts/design-tokens.md` + `contracts/shared-components.md` +
   `contracts/shell-regions.md` + `contracts/shell-routes.ts` into a single human-readable
   handoff document under this feature's directory (or `docs/figma-handoff/003-pos-ui-shell.md`).
2. The package is the brief that designers use in Figma Make (exploration) and that the
   reviewed Figma file must match before Figma MCP runs.
3. **Do NOT generate the Figma prompt(s) yet.** That step happens after `/speckit-tasks` lands;
   `/speckit-tasks` provides the ordered task list that the prompt references.

---

## 6. Definition of Done

- All Phase 2 groups complete; all tests green; coverage ≥ 90 % on `src/renderer/ui/` and
  `src/renderer/shell/`.
- Static no-touch source-scope guard test green.
- Per-pane axe smoke green.
- Compact-density dead-token guard green.
- Reserved-slot no-op guard (`reserved-slot-noop.test.tsx`) green.
- The Figma handoff package committed under this feature's directory.
- A team member can complete the SC-1 walkthrough (visit every navigation entry via mouse,
  keyboard, and touch in under 60 seconds with no visual glitches).
- **PR-review checklist line** (manual fallback when the deterministic git check is skipped):
  reviewer runs `git diff --name-only origin/main...HEAD` against this PR and confirms zero
  intersection with the forbidden source-scope allowlist (`src/preload/**`, `src/main/ipc/**`,
  `src/main/pairing/**`, `src/main/secrets/**`, `src/shared/bridge-api.ts`,
  `src/shared/api-types.ts`, `migrations/**`, `scripts/codegen-api.ts`,
  `scripts/openapi-snapshot.json`).

When all of the above is true, this feature is ready for `/speckit-finish` (or whatever the team
uses as the merge gate) and the branch is ready for the standard ship workflow.
