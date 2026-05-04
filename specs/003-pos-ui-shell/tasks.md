# Tasks: POS UI Shell

**Feature:** 003-pos-ui-shell
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-04
**Last Updated:** 2026-05-04

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on other incomplete tasks).
- **`[USn]`** maps the task to a user-story phase. Setup, Foundational, and Polish phases have no
  story label.
- All file paths are repository-relative.
- **Test-first per Constitution Principle VI.** Within each story phase, the test task MUST be
  written and seen to fail before its implementation task. The order below reflects this.
- **Task ID gaps T063–T075 are intentionally reserved** for `/speckit-analyze` findings,
  follow-up planning revisions, and post-PR backports. Numbering is preserved across analyses
  so existing references in PR descriptions remain stable. Suffix infill (`T007a`/`T007b`,
  `T078a`/`T078b`, `T062a`) is the same convention 002 uses for analyse-driven additions.
- This feature **only** delivers POS-client renderer behaviour. Tasks that would imply main
  process / preload / IPC / SecretStore / migration / OpenAPI / CI / Sentry changes are
  deliberately excluded; the **static no-touch source-scope guard** (T012) makes those
  exclusions load-bearing in CI.
- **No third-party Vitest assertion wrapper around `axe-core` is used.** Direct integration via
  the first-party `expectNoAxeViolations()` helper is the documented decision (research §5);
  this is a hard exclusion.

## User-story map (from spec acceptance scenarios)

| Story | Priority | Title                                                                       | Spec AS#                |
|:------|:--------:|:----------------------------------------------------------------------------|:------------------------|
| US1   | P1       | Shell appears after pairing — top bar + rail + Dashboard default            | AS-1, AS-2              |
| US2   | P1       | Navigation between placeholder panes (mouse / keyboard / touch)             | AS-3, AS-8, AS-9        |
| US3   | P1       | Per-pane state variants (default / loading / empty / error)                 | AS-4, AS-5, AS-6        |
| US4   | P1       | Connection states (online / degraded / offline / **syncing visual-only**)   | AS-7                    |
| US5   | P1       | Responsive rail (≥ 1280 / 1024–1279 / **< 1024 → ScreenTooSmall**)          | AS-11                   |
| US6   | P1       | Checkout placeholder — eleven payment-tender visual reservations            | AS-12                   |

Acceptance scenario AS-10 (shared-component visual consistency) is foundational and is
satisfied by the Phase 2 token + primitive groundwork rather than an own user story.

---

## Phase 1 — Setup

Project plumbing only. No app code touched yet.

- [ ] T001 **Pre-install compatibility verification for `axe-core ^4.10.0`** (no install
  performed). Before any install task modifies `package.json` (T002), the implementer MUST:
  (a) re-verify that `axe-core ^4.10.0` is still the current stable major on npm and that its
  public `axe.run(container, options)` API is not deprecated;
  (b) re-verify peer / runtime compatibility against the **then-current** `package.json`
  versions of Vitest, React Testing Library, happy-dom, and React (planning-time pins per
  research §5: Vitest `^4.1.5`, RTL `^16.3.2`, happy-dom `^20.9.0`, React `19.2.x`);
  (c) re-verify that the helper signature
  `expectNoAxeViolations(container: HTMLElement, options?: AxeRunOptions): Promise<void>` is
  still expressible against the installed `axe-core` types (`RunOptions`, `AxeResults`);
  (d) record the verification result (versions checked, decision) in the PR description.
  **HALT this phase and report up** if any of (a)–(c) fails — the direct-integration decision
  must be revisited before a wrapper alternative is reconsidered (research §5 forbids silent
  reversal). **NO `package.json` change is performed by this task.**
- [ ] T002 [P] **Install `axe-core ^4.10.0` as a dev dependency** (only after T001 passes).
  `npm install --save-dev axe-core@^4.10.0`. Updates `package.json` and `package-lock.json`
  only — no source files. The exact installed version is locked by the lockfile; the planning
  pin is the upper-bound caret.
- [ ] T003 [P] **Verify no other dev / runtime dependency is needed for this feature.** Confirm
  the existing pinned set (React 19, Vite 8, TypeScript 5.9, Tailwind 4, react-router-dom 7,
  zustand 4, @tanstack/react-query 5, Vitest 4, @testing-library/react 16,
  @testing-library/user-event 14, @testing-library/jest-dom 6, happy-dom 20) covers every
  capability the plan commits to. **Do NOT install Storybook, Playwright, `vitest-axe`,
  `@axe-core/react`, or any UI primitive library** (research §4 + §5 + §6 — hard exclusion).
- [ ] T004 [P] **Author the `vitest.config.ts` coverage-threshold delta** for this feature: add
  module-scoped thresholds for `src/renderer/ui/**` and `src/renderer/shell/**` at ≥ 90 %
  line + branch (NFR-1, plan Test Strategy). **No other `vitest.config.ts` change.** Confirm
  no existing 002 coverage threshold is reduced or duplicated by the new module-scoped
  thresholds: read the current `vitest.config.ts`, locate the existing thresholds (root or
  per-module), and verify the new entries are *additive* — they MUST scope only the new
  shell paths, not redefine the renderer root threshold. If a duplicate or reduction is
  detected, **HALT this task** and surface for review before merging — the 002 thresholds
  are load-bearing for the pairing test suite. **(NFR-10 — deterministic CI on
  `windows-latest`; the new thresholds inherit the existing CI runner.)**

---

## Phase 2 — Foundational (Blocking Prerequisites)

These tasks MUST complete before any user-story phase begins. They land the design tokens,
shared component primitives, state-variant primitives, the pairing-bypass guard, and the
source-scope no-touch guard.

### Static / structural guards (must land before code that they guard)

- [ ] T005 [P] Author `src/renderer/__tests__/source-scope-guard.const.ts` exporting the
  **frozen forbidden allowlist** as a `readonly` `const`: `src/preload/**`, `src/main/ipc/**`,
  `src/main/pairing/**`, `src/main/secrets/**`, `src/shared/bridge-api.ts`,
  `src/shared/api-types.ts`, `migrations/**`, `scripts/codegen-api.ts`,
  `scripts/openapi-snapshot.json`, `.github/workflows/**`. (Adds workflow files to the allowlist
  per the explicit user request — CI workflow files MUST NOT be touched by 003.)
- [ ] T006 [P] Author **TEST FIRST** the static no-touch source-scope guard:
  `src/renderer/__tests__/source-scope-guard.test.ts`. The test MUST:
  (1) shell out to `git diff --name-only origin/main...HEAD` (the *triple-dot* form,
  squash-merge-safe);
  (2) assert the intersection of the diff with the forbidden allowlist (T005) is empty;
  (3) treat additions, modifications, **and deletions** as failures (additive-safe);
  (4) if `origin/main` is unreachable (shallow clone / no remote), fall back to `git rev-parse
  origin/main` recorded at clone-time; if neither is available, skip with an explicit warning
  message AND fail in CI (the PR-review checklist line in `quickstart.md` §6 is the manual
  fallback for that environment).
  At this stage the test passes trivially (no diff yet); its purpose is to catch any later task
  that drifts.
- [ ] T007 [P] Author **TEST FIRST** the pairing-bypass guard:
  `src/renderer/__tests__/pairing-gate.test.tsx`. Inject a fake `PairingBridgeAPI` whose
  `getStatus()` returns `'unpaired'` and assert the boot router lands on `/pairing`, that
  `/app/dashboard` is unreachable from that state, and that no `/app/*` route is rendered. A
  parallel sub-case asserts `getStatus()` returning `'invalid'` also routes to `/pairing` with
  the existing 002 reason flag. **This test exercises the existing 002 boot router unchanged**
  — it will pass at this point because 003 has not modified the router yet; the guard catches
  any later regression.
- [ ] T007a [P] Author **TEST FIRST** the **no-operator-auth-session guard**:
  `src/renderer/__tests__/no-operator-auth-session.test.tsx`. Static-analysis style: parses
  every file under `src/renderer/` and asserts:
  (1) zero references to a `useOperatorSession` / `useUser` / `useAuth` / `useCashier` /
  `useCurrentUser` hook (any spelling combining the prefixes `use` / `Operator` / `Session` /
  `Auth` / `Login` / `Cashier` is a violation);
  (2) zero `<form … action="login" | "/login" | "/auth" | "/operator/*">` elements;
  (3) zero password / PIN inputs (`<input type="password">`, `<input type="number"
  inputMode="…">` carrying `name="pin" | "passcode" | "password"`);
  (4) zero references to a putative `Operator` / `User` / `Session` / `Cashier` domain type
  imported from anywhere outside the `OperatorSlot` placeholder (the placeholder is the only
  legitimate operator-themed file in 003);
  (5) zero `bridge.operator.*` / `bridge.session.*` / `bridge.auth.*` / `window.api.operator`
  / `window.api.session` / `window.api.auth` references.
  At this stage the test passes trivially; its purpose is to catch any later task that
  silently introduces an operator-identity surface (Constitution Principle VIII binding,
  spec FR-8 + Out-of-Scope).
- [ ] T007b [P] Author **TEST FIRST** the **no-backend / no-IPC / no-persistence /
  no-sync runtime guard**: `src/renderer/__tests__/no-backend-ipc-persistence.test.tsx`.
  Static-analysis style across every file under `src/renderer/`:
  (1) zero direct `fetch(` / `XMLHttpRequest` / `axios` / `ky` / `wretch` / `superagent`
  references (the renderer cannot make outbound network calls per Constitution III; the
  shell adds none either);
  (2) zero new `bridge.*` / `window.api.*` namespaces beyond the **whitelisted** read-only
  pairing surface (`bridge.pairing.getStatus`) — adding any new bridge call is a violation
  this feature is not allowed to perform; new bridge surface MUST be added by a feature that
  changes the preload (which 003 is forbidden from doing — T006 enforces);
  (3) zero `window.localStorage` / `window.sessionStorage` / `IndexedDB` / `caches` /
  `navigator.storage` references;
  (4) zero references to the existing `SecretStore` (e.g. no `secretStore` import path);
  (5) zero references to a `sync` / `syncQueue` / `replay` / `outbox` / `offlineQueue`
  module (defensive — the `syncing` connection-state value is visual-only and MUST NOT be
  associated with any runtime sync helper);
  (6) zero `setInterval` / `setTimeout` calls that target a backend probe or sync trigger
  (allowed: `setTimeout` for Toast auto-dismiss timing, debounce in `useViewportTier`).
  This is a **cross-cutting** guard for the spec's Out-of-Scope contract: "No backend API
  calls", "No new IPC", "No persistence", "No offline sync", "No syncing real logic" all
  collapse into this single static assertion.

### Design tokens (CSS-first Tailwind 4)

- [ ] T008 [P] Author **TEST FIRST** the token parity + completeness test:
  `src/renderer/ui/tokens/__tests__/tokens.test.ts`. Asserts (per `contracts/design-tokens.md`):
  every TS export has a matching CSS custom property in `tailwind.css`; every CSS custom
  property under `:root` has a matching TS export; the `density` enum has exactly two members
  (`comfortable`, `compact`); `touchTarget.min === 44`; `connectionState` has exactly four
  members.
- [ ] T009 [P] Author **TEST FIRST** the **compact-density dead-token guard**:
  `src/renderer/ui/tokens/__tests__/compact-density-dead-token.test.ts`. Parses the source
  tree under `src/renderer/` (TS + TSX + CSS) and asserts every reference to
  `density.compact` (or the string literal `'compact'` typed as `Density`) lives in exactly two
  files: `src/renderer/ui/tokens/density.ts` and `src/renderer/ui/tokens/__tests__/tokens.test.ts`.
  Any third reference fails the run. (Plan Test Strategy + design-tokens contract §"Density".)
- [ ] T010 Implement the CSS-first token block in `src/renderer/styles/tailwind.css`: extend
  the existing `@import 'tailwindcss';` with a `:root { --color-*: …; --space-*: …;
  --font-*: …; --radius-*: …; --shadow-*: …; }` block and a `@theme { … }` mapping. **No
  `tailwind.config.js`** is added (Tailwind 4 CSS-first; plan Technical Context). Concrete
  values land here; names are frozen by `contracts/design-tokens.md`.
- [ ] T011 Implement the typed TS token exports under `src/renderer/ui/tokens/`:
  `colors.ts`, `spacing.ts`, `typography.ts` (structured object: `family`/`weight`/`size`/
  `lineHeight`), `radius.ts`, `shadow.ts`, `density.ts`, `touch.ts`, plus an `index.ts`
  barrel. The `compact` density value is exported as a reserved const but **no runtime code**
  reads it; T009's guard enforces this. T008 must pass after this task lands.

### State-variant + ScreenTooSmall primitives

- [ ] T012 [P] [TEST FIRST] `src/renderer/ui/states/__tests__/states.test.tsx`. Renders
  `LoadingState`, `EmptyState`, `ErrorState` and asserts: appropriate ARIA semantics
  (`role="status"` for loading; heading + description structure for empty / error), keyboard
  reachability of the no-op call-to-action (empty + error), token consumption (no hard-coded
  styles).
- [ ] T013 [P] [TEST FIRST] `src/renderer/ui/states/__tests__/screen-too-small.test.tsx`.
  Asserts the **frozen copy** (`contracts/shell-regions.md` §"ScreenTooSmall"):
  `getByRole('heading', { level: 1 })` text === `"Screen too small"`;
  body paragraph text === `"Use a display at least 1024px wide to run POS Pulse."`;
  exactly one `<h1>`; exactly one `<main>`; **zero actionable elements** (no `<button>`,
  `<a>`, `<input>`, `[role="button"]`); focus lands on the heading on first paint.
- [ ] T014 Implement `src/renderer/ui/states/LoadingState.tsx`,
  `src/renderer/ui/states/EmptyState.tsx`, `src/renderer/ui/states/ErrorState.tsx`,
  `src/renderer/ui/states/ScreenTooSmall.tsx`, and the `src/renderer/ui/states/index.ts`
  barrel. ScreenTooSmall ships the frozen copy verbatim. T012 + T013 must pass.

### Shared component primitives (eight, alphabetical)

For each primitive: TEST FIRST landing the variant × state matrix and the a11y / touch-target
contract, then implementation. All consume tokens; none import a third-party UI library. The
axe-helper used by tests below is the first-party `expectNoAxeViolations(container)` from T029.

- [ ] T015 [P] [TEST FIRST] `src/renderer/ui/primitives/Badge/Badge.test.tsx`. Five intents
  (`info` / `success` / `warning` / `danger` / `neutral`); accessible name when icon-only.
- [ ] T016 [P] [TEST FIRST] `src/renderer/ui/primitives/Button/Button.test.tsx`. Four intents
  × six states; **44 × 44 px touch-target invariant** (`getBoundingClientRect()` ≥ 44 in both
  axes for `md` and `lg` sizes); visible focus ring; `aria-busy` while loading;
  `aria-disabled` when disabled; non-focusable when disabled.
- [ ] T017 [P] [TEST FIRST] `src/renderer/ui/primitives/Card/Card.test.tsx`. Three variants;
  renders `<section>` only when `aria-labelledby` is provided.
- [ ] T018 [P] [TEST FIRST] `src/renderer/ui/primitives/Dialog/Dialog.test.tsx`. Three
  variants; **focus trap**; ESC dismiss; focus restored on close; `inert` on background;
  scrim uses `--color-overlay-scrim` + `--shadow-overlay`. **(NFR-6 modal focus trap +
  restore on dismiss.)**
- [ ] T019 [P] [TEST FIRST] `src/renderer/ui/primitives/Input/Input.test.tsx`. Three variants
  × four states; mandatory label association; `aria-invalid` on error; `aria-describedby`
  for description + error message.
- [ ] T020 [P] [TEST FIRST] `src/renderer/ui/primitives/StatusBanner/StatusBanner.test.tsx`.
  Four connection-state intents render distinct visuals; `online` renders nothing visible;
  `aria-live="polite"`; **never carries a destructive action**; non-dismissible.
- [ ] T021 [P] [TEST FIRST] `src/renderer/ui/primitives/Table/Table.test.tsx`. Native
  `<table>` semantics; data / empty / loading / error state slots.
- [ ] T022 [P] [TEST FIRST] `src/renderer/ui/primitives/Toast/Toast.test.tsx`. Four intents;
  three lifecycle states; deterministic auto-dismiss timing under `vi.useFakeTimers()`;
  `role="status"` for non-urgent / `role="alert"` for urgent; dismiss button meets the
  44 × 44 px floor.
- [ ] T023 Implement `Badge`, `Button`, `Card`, `Dialog`, `Input`, `StatusBanner`, `Table`,
  `Toast` under `src/renderer/ui/primitives/<Name>/<Name>.tsx` + a barrel
  `src/renderer/ui/primitives/index.ts`. **All consume tokens — no hard-coded colors / sizes /
  shadows.** T015–T022 must pass after this task lands. (Implementation may be split into one
  PR per primitive at the implementer's discretion; the dependency graph below treats it as a
  single foundational gate.)

### Accessibility helper + viewport hook + connection-state slice

- [ ] T024 [P] Author `src/renderer/ui/primitives/__tests__/axe-config.ts`: the **first-party
  helper** `expectNoAxeViolations(container, options?)` that calls
  `axe.run(container, mergedOptions)` from `axe-core ^4.10.0` and asserts
  `violations.length === 0` (Promise return). Includes the off-rules list:
  `color-contrast` (happy-dom limitation, with rationale comment) and `meta-viewport` (N/A in
  Electron). The signature is frozen per `contracts/shared-components.md`. **This is the only
  axe wiring in the feature** — no third-party Vitest assertion wrapper. **(FR-21 WCAG 2.1 AA
  baseline; FR-22 visible focus rings + accessible names; FR-23 live-region announcements
  for toasts / status banner / connection-state changes — exercised per-primitive and
  per-pane.)**
- [ ] T025 [P] [TEST FIRST] `src/renderer/shell/viewport/__tests__/useViewportTier.test.ts`.
  Fakes `window.matchMedia` and asserts the documented boundaries: `1023 → 'too-small'`,
  `1024 → 'icon-only'`, `1279 → 'icon-only'`, `1280 → 'expanded'`, `1920 → 'expanded'`.
  Asserts no more than one tier transition is dispatched per single resize crossing a
  breakpoint (debounce works).
- [ ] T026 Implement `src/renderer/shell/viewport/useViewportTier.ts`. Uses `matchMedia`
  listeners (not raw `resize`) and debounces internal transitions by 100 ms. T025 must pass.
- [ ] T027 [P] [TEST FIRST] `src/renderer/shell/connection/__tests__/useConnectionState.test.ts`.
  Asserts: enum has exactly four members (`online`, `degraded`, `offline`, `syncing`); default
  initial value is `'online'`; the setter is the only mutation path (no `subscribe` listener
  invokes `globalThis.fetch`, `window.api`, `window.localStorage`, `sessionStorage`, or any
  persistence helper — spies asserted at zero across all four state transitions including
  `syncing`).
- [ ] T028 Implement `src/renderer/shell/connection/useConnectionState.ts` as a zustand slice
  with the four-state enum and a single setter. **No side-effect listeners.** T027 must pass.

---

## Phase 3 — User Stories (in priority order)

### US1 — Shell appears after pairing — top bar + rail + Dashboard default (P1)

**Goal:** A paired terminal that boots into a clean POS shell with TopBar, NavRail, and a
Dashboard placeholder pane visible by default.
**Independent test:** Inject `getStatus() === 'paired'` (with tenant / branch / terminal-label
fixtures); assert the post-pair render shows TopBar's identity strip, the NavRail's six
entries, and the Dashboard placeholder in MainContent. Pairing-bypass guard (T007) stays green.

- [ ] T029 [P] [US1] [TEST FIRST] `src/renderer/shell/regions/__tests__/IdentityStrip.test.tsx`.
  Tenant + branch + terminal label render from injected paired-state values; missing values
  fall back to `—` placeholder (FR-6 edge case). Token consumption verified.
- [ ] T030 [P] [US1] [TEST FIRST] `src/renderer/shell/regions/__tests__/OperatorSlot.test.tsx`.
  Renders a visibly-disabled "Sign in" Button (`aria-disabled="true"`); non-focusable; tooltip
  carries an accessible explanation; click is observably a no-op (zero handler invocations);
  shows "no operator signed in" text. **Constitution Principle VIII binding** (no operator
  session in this feature).
- [ ] T031 [P] [US1] [TEST FIRST] `src/renderer/shell/regions/__tests__/TopBar.test.tsx`.
  Composes `IdentityStrip`, `ConnectionIndicator`, `OperatorSlot`, `StatusBanner` (latter
  visible only for non-`online` states). Landmark role `banner`.
- [ ] T032 [P] [US1] [TEST FIRST] `src/renderer/shell/__tests__/AppShell.test.tsx`. Top bar +
  nav rail + main outlet present; landmark roles correct (`banner` / `navigation` / `main` /
  `status` for banner); exactly one `<main>`; exactly one `<Outlet />`.
- [ ] T033 [P] [US1] [TEST FIRST] `src/renderer/routes/app/__tests__/DashboardPlaceholder.test.tsx`.
  Default-state render; landing pane after pairing. No fetch / IPC / persistence call (spies
  asserted at zero on mount).
- [ ] T034 [US1] Implement `src/renderer/shell/regions/IdentityStrip.tsx`,
  `src/renderer/shell/regions/OperatorSlot.tsx`, `src/renderer/shell/regions/TopBar.tsx`,
  `src/renderer/shell/AppShell.tsx`, `src/renderer/routes/app/DashboardPlaceholder.tsx`.
  T029–T033 must pass.
- [ ] T035 [US1] Wire the `/app/*` parent route into `src/renderer/router.tsx` per
  `contracts/shell-routes.ts`: `{ path: '/app', element: <AppShell />, children: [{ index:
  true, element: <Navigate to="dashboard" replace /> }, { path: 'dashboard', element:
  <DashboardPlaceholder /> }, …] }`. **Existing `/pairing` and `/paired` routes are
  unchanged.** Pairing-bypass guard (T007) stays green; if it goes red, the change is
  out-of-scope and must be reverted before merge.

### US2 — Navigation between placeholder panes (mouse / keyboard / touch) (P1)

**Goal:** Every NavRail entry navigates to its placeholder pane via mouse, keyboard alone,
and touch; active state visible; touch-target floor met.
**Independent test:** With Dashboard mounted, exercise each of the six NavRail entries via
`userEvent.click` / `userEvent.keyboard('{Tab}{Enter}')` / synthetic touch; assert the
expected pane mounts and the active entry shows the active visual marker.

- [ ] T036 [P] [US2] [TEST FIRST] `src/renderer/shell/regions/__tests__/NavRail.test.tsx`.
  Six entries in fixed order from `contracts/shell-routes.ts` (`shellNavEntries`); each
  entry's accessible name equals its label; active entry visually distinguished;
  `<nav aria-label="Primary">` wraps the rail; **no `data-testid="hamburger"` rendered**.
  Touch-target floor (44 × 44 px) on every entry.
- [ ] T037 [P] [US2] [TEST FIRST]
  `src/renderer/routes/app/__tests__/SalesPlaceholder.test.tsx`,
  `src/renderer/routes/app/__tests__/CartPlaceholder.test.tsx`,
  `src/renderer/routes/app/__tests__/InventoryPlaceholder.test.tsx`,
  `src/renderer/routes/app/__tests__/SettingsHelpPlaceholder.test.tsx`. Each pane renders
  default state; Inventory shows a clearly-labelled "navigation only" message (FR-13);
  SettingsHelp does NOT expose a density toggle (Clarifications §1 — guarded). No fetch / IPC /
  persistence call (spies asserted at zero on mount).
- [ ] T038 [P] [US2] [TEST FIRST] `src/renderer/routes/app/__tests__/navigation.test.tsx`.
  Cross-product test: from each of the six routes, every other route is reachable via NavRail
  click + via keyboard (Tab / Enter / arrow keys) + via synthetic `pointerDown` (touch);
  active entry updates per pathname.
- [ ] T039 [US2] Implement `src/renderer/shell/regions/NavRail.tsx` (responsive — defers to
  T046 for the icon-only / too-small variants);
  `src/renderer/routes/app/SalesPlaceholder.tsx`,
  `src/renderer/routes/app/CartPlaceholder.tsx`,
  `src/renderer/routes/app/InventoryPlaceholder.tsx`,
  `src/renderer/routes/app/SettingsHelpPlaceholder.tsx`. T036–T038 (default ≥ 1280 px expanded
  layout only at this stage) must pass.

### US3 — Per-pane state variants (default / loading / empty / error) (P1)

**Goal:** Every placeholder pane defines a default, loading, empty, and error variant
selectable via dev-only `?state=…` URL search param; each variant renders the appropriate
state primitive.
**Independent test:** For each of the six panes × four variants, assert the corresponding
`LoadingState` / `EmptyState` / `ErrorState` / default content renders.

- [ ] T040 [P] [US3] Author `src/renderer/shell/dev/useDevToggles.ts` (zustand slice, **dev
  builds only** — module guarded by `import.meta.env.DEV`). Reads `?state=…` and `?conn=…`
  URL search params and exposes them to placeholder panes + `useConnectionState`. **MUST be
  tree-shaken from production builds** — guard test in T041 enforces this.
- [ ] T041 [P] [US3] [TEST FIRST] `src/renderer/shell/dev/__tests__/useDevToggles.test.ts`.
  Asserts: `?state=loading` → `'loading'`; `?state=empty` → `'empty'`; `?state=error` →
  `'error'`; missing search param → `'default'`; unknown values → `'default'`. **Production
  build manifest test:** runs `vite build` (or reads a snapshot) and asserts the dev-toggle
  module is not present in the production chunk graph. (Acceptable to defer the build-output
  assertion to T076 if `vite build` is too slow for a unit test; in that case T041 covers
  the search-param parsing only and T076 covers the prod-bundle guard.)
- [ ] T042 [P] [US3] [TEST FIRST] `src/renderer/routes/app/__tests__/state-variants.test.tsx`.
  Cross-product (6 panes × 4 variants). Asserts each combination renders the documented
  primitive (LoadingState / EmptyState / ErrorState) or the pane's default content; no fetch /
  IPC / persistence call on mount of any variant.
- [ ] T043 [US3] Extend each placeholder pane (`Dashboard`, `Sales`, `Cart`, `Inventory`,
  `SettingsHelp`) to consume `useDevToggles().state` and render the matching state primitive
  when set. **Checkout placeholder is NOT modified here** — its own state-variant treatment
  is part of US6 because of the reserved-slot test interplay. T042 must pass for the five
  non-checkout panes.

### US4 — Connection states (online / degraded / offline / syncing visual-only) (P1)

**Goal:** TopBar's `ConnectionIndicator` renders four distinct visual states; non-`online`
states surface a non-blocking `StatusBanner`; `syncing` is **purely visual** with a
hard-asserted no-op contract.
**Independent test:** Cycle the `useConnectionState` setter through all four values via the
dev toggle; assert the indicator and banner visuals; assert spies on `globalThis.fetch`,
`window.api`, `window.localStorage`, `sessionStorage` show **zero** calls during the
`syncing` transition specifically.

- [ ] T044 [P] [US4] [TEST FIRST]
  `src/renderer/shell/regions/__tests__/ConnectionIndicator.test.tsx`. Four states render
  distinct color + label + accessible name; `syncing` carries the visual + accessible name
  but **no fetch / IPC / persistence call** (spies at zero); `online` shows a "normal"
  visual; `role="status"`. The indicator is non-actionable (clicks are no-ops in this
  feature). **(FR-23 — connection-state changes are announced to assistive tech via the
  StatusBanner's `aria-live="polite"` semantics.)**
- [ ] T045 [US4] Implement `src/renderer/shell/regions/ConnectionIndicator.tsx` and wire it
  into `TopBar` to consume `useConnectionState()`. The `StatusBanner` visibility for
  non-`online` states is wired here. T044 must pass. **The hard non-implementation list for
  `syncing` is repeated in the file's top-of-file comment** (verbatim from
  `contracts/shell-regions.md` §"`syncing` — hard non-implementation list"): no sync queue,
  no backend call, no persistence write, no IPC, no preload change.

### US5 — Responsive rail (≥ 1280 / 1024–1279 / < 1024 → ScreenTooSmall) (P1)

**Goal:** Rail switches between expanded (icons + labels) and icon-only layouts; below
1024 px the AppShell renders ScreenTooSmall instead of the rail; **no mobile hamburger
drawer** at any width.
**Independent test:** Set `window.innerWidth` to each of `1023`, `1024`, `1279`, `1280`,
`1920` and assert the documented rail / fallback for each width.

- [ ] T046 [P] [US5] [TEST FIRST]
  `src/renderer/shell/regions/__tests__/NavRail.responsive.test.tsx`. At ≥ 1280 px the rail
  shows icons + labels; at 1024–1279 px the rail shows icons only with `aria-label` + tooltip
  per entry; at < 1024 px the NavRail is **NOT in the DOM** (queryByRole `'navigation'` is
  `null`); **`data-testid="hamburger"` is absent at every width**; active state remains
  visually distinct in both rail layouts.
- [ ] T047 [P] [US5] [TEST FIRST]
  `src/renderer/shell/__tests__/AppShell.too-small.test.tsx`. At < 1024 px the AppShell
  renders ScreenTooSmall as the sole `<main>` landmark with the frozen heading + body copy
  (T013); no `<nav>` is in the DOM; no off-screen / `display:none` / `aria-hidden` rail is
  present (no hidden navigation trap).
- [ ] T048 [US5] Extend `src/renderer/shell/regions/NavRail.tsx` to consume `useViewportTier()`
  and switch between expanded and icon-only layouts; below 1024 px the rail returns `null`
  and `AppShell` mounts `ScreenTooSmall` instead. T046 + T047 must pass.

### US6 — Checkout placeholder — eleven payment-tender visual reservations (P1)

**Goal:** The Checkout pane visually reserves the eleven labelled rectangles for future
**005-checkout-payments**: six tender rows + four amount fields + the receipt-breakdown row.
**Layout capacity only — zero values, zero callbacks, zero side-effects.**
**Independent test:** Mount `<CheckoutPlaceholder />`; assert all eleven slots render in the
documented order with the "Reserved for 005-checkout-payments" body; spies on `fetch` /
`window.api` / persistence helpers stay at zero across mount / hover / focus / click.

- [ ] T049 [P] [US6] [TEST FIRST]
  `src/renderer/routes/app/checkout/__tests__/reserved-slot-ids.test.ts`. Asserts the
  exported `reservedSlotIds` `const` equals the eleven frozen ids in the contract
  (`tender.cash`, `tender.card`, `tender.bank-transfer`, `tender.voucher`, `tender.insurance`,
  `tender.split`, `totals.amount-due`, `totals.amount-paid`, `totals.remaining`,
  `totals.change-due`, `receipt.breakdown`) — same length, same order, no extra members.
  **`receipt.breakdown` keeps its `receipt` prefix** because it names the printed-artifact
  surface, not the pane (Plan §"Note B").
- [ ] T050 [P] [US6] [TEST FIRST]
  `src/renderer/routes/app/checkout/__tests__/CheckoutPlaceholder.test.tsx`. Asserts the
  pane renders all eleven slots in the documented display order (six tender rows top, then
  four totals fields, then `receipt.breakdown` last); each slot's body equals the literal
  string `"Reserved for 005-checkout-payments"`; no input controls (`<input>`, `<button>`,
  `[contenteditable]`) inside any slot; no value-bearing prop is passed (asserted via the
  `ReservedSlotProps` type — typecheck + a runtime check that no slot DOM node carries an
  `amount` / `currency` / `value` data attribute).
- [ ] T051 [P] [US6] [TEST FIRST]
  `src/renderer/routes/app/checkout/__tests__/reserved-slot-noop.test.tsx`. **Reserved-slot
  no-op guard.** For each rendered slot, exercise `mount → pointerEnter (hover) → focus →
  click` via `userEvent`; spy on `globalThis.fetch`, `window.api` (each method on the
  paired-bridge surface), `window.localStorage`, `window.sessionStorage`, and any
  print-related global; assert all spies show **zero** calls. This guard locks the
  "no payment logic, no IPC, no persistence, no printing" boundary.
- [ ] T052 [US6] Implement
  `src/renderer/routes/app/checkout/reserved-slot-ids.ts` (the frozen `const` + the
  `ReservedSlotId` + `ReservedSlotProps` types per `contracts/shell-routes.ts`),
  `src/renderer/routes/app/checkout/ReservedTenderRow.tsx` (generic labelled-rectangle for
  any of the six tender kinds — accepts only `slotId` + `label`),
  `src/renderer/routes/app/checkout/ReservedTotalsRow.tsx` (generic labelled-rectangle for
  any of the five amount fields — same prop shape), and
  `src/renderer/routes/app/checkout/CheckoutPlaceholder.tsx` (composes all eleven slots in
  the documented order). Wire `/app/checkout` in `src/renderer/router.tsx` to render
  `<CheckoutPlaceholder />` (renaming away from any earlier `ReceiptPlaceholder` reference
  per Plan §"Note B"). T049 + T050 + T051 must pass.

---

## Phase Final — Polish & Cross-Cutting

Cleanups, the `/paired → /app/dashboard` journey decision, the Figma handoff package, and the
mandated CI check-runs. Nothing here adds new feature behaviour.

### `/paired → /app/dashboard` journey (resolution of plan O2)

- [ ] T053 [TEST FIRST] `src/renderer/routes/paired/__tests__/PairedScreen.continue-to-dashboard.test.tsx`.
  After the implementer's chosen option (preferred: post-pair-success boot lands on
  `/app/dashboard`; fallback: `/paired` adds a `Continue to dashboard →` action that
  navigates to `/app/dashboard`). Asserts:
  (a) the chosen option does NOT modify the boot router's `getStatus()` gate;
  (b) unpaired terminals still route to `/pairing` (re-uses the T007 pairing-gate fixture);
  (c) **no IPC, no bridge call, no SecretStore read, no token re-read** is performed by the
  navigation transition (spies asserted at zero);
  (d) `/paired` is not a dead-end (either it redirects after a brief confirmation OR it
  exposes the `Continue to dashboard →` Button styled with `Button` `intent="primary"`);
  (e) **no "skip pairing" / "I'll pair later" affordance is rendered on `/paired`**.
- [ ] T054 Implement the chosen option per Plan §"Risks & Open Items" → O2:
  **either** modify `src/renderer/router.tsx` (and `App.tsx` boot logic if needed) so that
  `getStatus() === 'paired'` lands on `/app/dashboard` (not `/paired`) on every launch
  except the immediate post-pair confirmation surface,
  **or** extend `src/renderer/routes/paired/PairedScreen.tsx` with a `Continue to dashboard →`
  Button using the shared `Button` primitive (`intent="primary"`) that calls
  `useNavigate()('/app/dashboard')`. **Whichever option is chosen**: source-scope guard (T006)
  must stay green; pairing-gate guard (T007) must stay green; T053 must pass; the chosen
  option is recorded in the PR description.

### Figma handoff package (documentation only — no Figma artifact generated)

- [ ] T055 [P] Author `specs/003-pos-ui-shell/figma-handoff.md` (planning artifact, not source
  code). Aggregates from the contracts: token table; primitive variants × states; AppShell
  region map; the **two** active rail layouts (expanded + icon-only) plus the ScreenTooSmall
  fallback; the **four** connection-state visuals; the per-pane state-variant matrix; the
  eleven reserved checkout slots. Includes explicit "MUST NOT include" notes (no mobile
  drawer artwork; no density toggle; no payment-flow controls; no real values in any
  reserved checkout slot).
- [ ] T056 [P] Author `specs/003-pos-ui-shell/figma-make-brief.md` (planning artifact only).
  The Figma Make exploration brief — produced **after** this `/speckit-tasks` round so it
  can reference task ids by number. Pins the visual exploration scope to the contracts'
  surfaces. Reminds the designer that any Figma Make output is throwaway and must converge
  to the reviewed Figma file before Figma MCP runs (research §1 + Plan §"Figma Make / Figma
  MCP — handoff strategy"). **Does NOT generate Figma prompts in this task** — the brief is
  the *document* a designer reads; the prompt itself is generated only after the planning PR
  ships and design work is ready to start.
- [ ] T057 [P] Author `specs/003-pos-ui-shell/figma-mcp-handoff.md` (planning artifact only).
  Lists every requirement the reviewed Figma file must satisfy before Figma MCP-driven
  implementation can run: token names match `src/renderer/ui/tokens/`; component pages match
  `contracts/shared-components.md`; rail layouts match the responsive matrix; checkout slots
  match the eleven frozen ids; **no mobile drawer artwork**; **no payment-flow artwork**.

### Final validation runs (mandated before merge)

- [ ] T058 [P] Run `npm run typecheck`. Must pass with zero errors. The bridge-typing assertion
  (renderer cannot call non-existent IPC channels; `ConnectionState` exhaustive in switch;
  `ReservedSlotProps` rejects forbidden prop names) is part of this run.
- [ ] T059 [P] Run `npm run lint`. Must pass with zero violations.
- [ ] T060 [P] Run `npm test -- --coverage`. Must show ≥ 90 % line + branch on
  `src/renderer/ui/**` and `src/renderer/shell/**` (NFR-1; vitest threshold from T004); all
  guard tests (T006, T007, T007a no-operator-auth, T007b no-backend/IPC/persistence, T009,
  T041 search-param, T044 syncing-no-op, T051 reserved-slot no-op, T053 paired-journey)
  green; all axe-helper smokes (per pane × per variant) green; **the NFR-4 first-paint
  perf-budget smoke (T062a) green** (asserts AppShell first paint ≤ 500 ms on `windows-latest`
  CI from mocked-paired-bridge resolve to `<main>` landmark visible).
- [ ] T061 [P] Run `npm run codegen:verify`. Must report no diff vs the snapshot — a no-op for
  this feature (003 does not touch `scripts/openapi-snapshot.json` or `src/shared/api-types.ts`,
  source-scope guard T006 enforces this).
- [ ] T062 Run `npm run package:dir` (Windows-only smoke). Verifies the Electron app bundles
  with the new shell paths; the dev-toggle module is absent from the production chunk graph
  (T041 / T076 prod-bundle guard); no `tailwind.config.js` was generated. Capture the
  package directory size in the PR description as a baseline for future shell features.
- [ ] T062a [P] **TEST FIRST — NFR-4 first-paint perf-budget smoke (UI-shell-only, mocked
  pairing).** Author `src/renderer/shell/__tests__/AppShell.first-paint-perf.test.tsx`
  (this task plans the test; **the test file itself is created in implementation, not in
  this round**). The test:

  (1) renders `<AppRouter pairing={fakeBridge} />` where `fakeBridge.getStatus()` returns a
  resolved-paired fixture **synchronously** (no `await`, no IPC, no fetch, no preload, no
  persistence — uses the same in-memory paired-bridge pattern 002's tests already use);

  (2) records `t0 = performance.now()` immediately before the render call and
  `t1 = performance.now()` inside a `findByRole('main')` resolution (i.e. the moment the
  AppShell's `<main>` landmark first paints);

  (3) asserts `(t1 - t0) <= NFR_4_BUDGET_MS` where `NFR_4_BUDGET_MS = 500` is the spec NFR-4
  contract value;

  (4) runs deterministically under happy-dom (no real animation frames; render is synchronous
  in RTL).

  **Threshold policy.** The **CI threshold is 500 ms** — the spec's NFR-4 contract is hard
  and is not softened. A **diagnostic local threshold** of `1500 ms` MAY be applied via an
  environment variable `NFR_4_BUDGET_MS_LOCAL_DIAG` to surface flakiness during dev work,
  but the diagnostic threshold MUST NOT be the assertion threshold in CI. The CI run uses the
  hard 500 ms value; any local relaxation is informational only and does not weaken the
  acceptance contract.

  **Scope guarantees.** Pure renderer; no `fetch`, no `window.api` beyond the existing
  `pairing.getStatus`, no new bridge namespace, no persistence, no Figma artifact. Uses
  Vitest 4 + RTL 16 + happy-dom 20 + `performance.now()` — all already pinned by 001/002, no
  new runtime dependency. Failure surfaces: render time exceeds 500 ms ⇒ NFR-4 budget
  violation ⇒ merge blocked.

  **Note.** This task plans the test surface only — it documents the test path, the
  threshold contract, and the boundary guarantees. The test source file is authored at
  implementation time alongside the AppShell implementation (T034) and runs as part of the
  T060 full-suite gate.

### Source-scope + dead-token guards run at end-to-end as well

- [ ] T076 [P] [Polish] Run the source-scope no-touch guard (T006) one more time at the end
  of the implementation pass. Asserts the diff against `origin/main` still excludes every
  forbidden path. **PR-review checklist line:** the reviewer manually runs
  `git diff --name-only origin/main...HEAD` and confirms zero intersection with the forbidden
  allowlist (T005). If the deterministic git check is skipped (shallow clone CI), this manual
  step becomes the gate (`quickstart.md` §6 Definition of Done).
- [ ] T077 [P] [Polish] Run the compact-density dead-token guard (T009) one more time at the
  end of the implementation pass. Asserts no source file outside the two authorised files
  references `density.compact`.
- [ ] T078 [P] [Polish] Run the reserved-slot no-op guard (T051) one more time at the end of
  the implementation pass. Asserts no slot in the Checkout placeholder triggers any
  observable side-effect call on mount / hover / focus / click.
- [ ] T078a [P] [Polish] Run the no-operator-auth-session guard (T007a) one more time at the
  end of the implementation pass. Asserts no source file under `src/renderer/` introduces an
  operator session / auth / login / cashier / user surface.
- [ ] T078b [P] [Polish] Run the no-backend / no-IPC / no-persistence / no-sync guard (T007b)
  one more time at the end of the implementation pass. Asserts no source file under
  `src/renderer/` introduces a fetch / new bridge namespace / persistence call / sync helper.

### Planning PR + implementation PR sequencing

- [ ] T079 **Open the planning PR** before any implementation task starts. The PR's diff
  scope is exactly: `specs/003-pos-ui-shell/**` + `.specify/feature.json`. **No source files,
  no `package.json` change, no Figma artifact.** The PR description:
  (1) summarises the spec / plan / research / data-model / contracts / quickstart / tasks;
  (2) cites Constitution principles I, III, V, VI, VIII, IX (the ones this feature
  meaningfully exercises);
  (3) explicitly notes O2's recorded recommendation and that the implementer chooses at
  PR-time;
  (4) lists open items (none — O1 in the plan is non-blocking);
  (5) confirms zero `vitest-axe` references and the `axe-core ^4.10.0` direct-integration
  decision.
  Reviewers approve the planning artifacts before any code lands.
- [ ] T080 **Open the implementation PR** for the agreed slice (see "Implementation Strategy"
  below). The PR template's Constitution Check line cites principles **I, III, V, VI, VIII,
  IX**. Link the spec / plan / tasks artifacts. Mark non-blocking open item **O1**
  (dev-only "design-tokens inspector" route — covered or deferred?) explicitly in the PR
  description so a reviewer can decide.

  **O1 disposition path.** If the reviewer **approves** O1 in this PR, append a follow-up
  task `T081 [P] [Polish] Implement dev-only design-tokens inspector route at
  `/app/__dev/tokens` guarded by `import.meta.env.DEV`; assert via the production-bundle
  guard (T041 / T076) that the inspector module is absent from the production chunk graph.`
  to this `tasks.md` and re-run `/speckit-analyze`. If the reviewer **defers** O1, record
  the deferral in the PR description and leave the open-item status unchanged in plan.md
  §"Risks & Open Items" → O1. **Either way, no implementation of O1 lands inside this PR**
  — that's the whole point of marking it non-blocking.

---

## Dependency Graph

```
Setup (T001 – T004)
   │
   │  T001 (axe-core compat verify) → T002 (install) → T003/T004 (peer install + vitest config)
   │
   ▼
Foundational guards + tokens + primitives (T005 – T028)
   │
   ├── T005 (allowlist const) ── T006 (source-scope guard test)        ← blocks every later task
   ├── T007  (pairing-gate guard test)                                 ← blocks T035 / T054
   ├── T007a (no-operator-auth-session guard test)                     ← blocks T030 / T034 / any later operator-related task
   ├── T007b (no-backend / no-IPC / no-persistence / no-sync guard)    ← blocks every later task; cross-cutting
   ├── T008/T009 (token + dead-token guard tests) ── T010/T011 (impls) ← blocks T015–T028
   ├── T012/T013 (state primitive + ScreenTooSmall tests) ── T014 (impls)
   ├── T015 – T022 (eight primitive test files, [P])  ── T023 (impls)
   ├── T024 (axe helper) ── used by every later test that calls expectNoAxeViolations
   ├── T025 (viewport hook test) ── T026 (impl)
   └── T027 (connection-state slice test) ── T028 (impl)
   │
   ▼
US1 (T029 – T035)            ← consumes tokens + primitives + AppShell skeleton
   │
   ├─► US2 (T036 – T039)     ← consumes US1's AppShell + NavRail skeleton
   │       │
   │       ├──► US3 (T040 – T043)   ← extends panes with state-variant toggle
   │       │
   │       ├──► US4 (T044 – T045)   ← consumes T028 + T024; orthogonal to US3
   │       │
   │       ├──► US5 (T046 – T048)   ← consumes T026 + US2's NavRail; tightens AppShell layout
   │       │
   │       └──► US6 (T049 – T052)   ← independent of US3/US4/US5; touches only checkout subfolder
   │
   ▼
Phase Final (T053 – T080)
   │
   ├── T053 (paired-journey test) ── T054 (impl, implementer-chosen option)
   ├── T055/T056/T057 (Figma handoff docs, all [P])
   ├── T058 – T062 (typecheck / lint / test / codegen:verify / package:dir, all [P])
   ├── T076/T077/T078/T078a/T078b (final guard re-runs)
   └── T079 (planning PR) ── T080 (implementation PR)
```

**Critical path:** T001 → T002 → T005/T006 → T010/T011 → T023 → T034/T035 → T039 →
T045 → T048 → T052 → T054 → T058–T062 → T079 → T080.

Removing any guard task (T006 / T007 / T007a / T007b / T009 / T027 / T051) silently weakens
the constitution checks (Principles III, V, VI, VIII) — those guards MUST land before merge.

## Parallel Execution Examples

Within a single PR, the following groups can be worked concurrently by different developers
(or by one developer in parallel branches if review cadence permits):

- **Setup batch:** T003, T004 share no files with T002; T001 is purely a verification (no
  files written) and can be performed alongside T003/T004 once npm registry is reachable.
- **Phase 2 guard batch:** T005, T006, T007, T007a, T007b, T008, T009 share no files; all
  `[P]`.
- **Phase 2 token + state-primitive batch:** T012, T013 (different test files), T015–T022
  (eight different primitive test files); all `[P]`.
- **Phase 2 hook + slice batch:** T024 (axe helper), T025 (viewport test), T027 (connection
  test) share no files; all `[P]`.
- **US1 region tests:** T029, T030, T031, T032, T033 target five distinct test files; all
  `[P]`.
- **US2 placeholder tests:** T036, T037, T038 target distinct test files; all `[P]`.
- **US3 / US4 / US5 / US6:** the four user stories' test tasks (T040–T041, T044, T046–T047,
  T049–T051) touch disjoint subtrees of `src/renderer/`; all `[P]` against each other.
  Implementation tasks (T043, T045, T048, T052) share `src/renderer/router.tsx` only at T035
  / T052 — those two MUST land sequentially or be merged in the same commit to avoid a
  router-file conflict.
- **Phase Final docs batch:** T055, T056, T057 target distinct planning artifacts; all `[P]`.
- **Phase Final validation batch:** T058–T062 are independent runs; T060 (test) is the
  longest; T058 / T059 / T061 / T062 can run in parallel.

## Implementation Strategy

**MVP slice (the smallest set that satisfies the constitution + spec acceptance scenarios
that a real cashier would touch on day one of the shell):**

> Setup (T001–T004) → Foundational guards + tokens + primitives (T005–T028) →
> US1 (T029–T035) → US2 (T036–T039) → US5 (T046–T048) → Phase Final (T053–T054, T058–T062,
> T076–T078, T079, T080).

This slice ships a paired-terminal POS shell with TopBar, NavRail (responsive — both rail
layouts and the ScreenTooSmall fallback), the six placeholder routes, the pairing-bypass
guard, the source-scope no-touch guard, the compact-density dead-token guard, and the
`/paired` journey resolution. **It deliberately defers US3 (state variants), US4
(connection states), and US6 (checkout reservations)** because each adds complexity that
is not on the cashier's day-one path — but each is a fully independent follow-up PR.

**Recommended PR sequencing:**

1. **PR #0 — Planning PR (T079).** Spec / plan / research / data-model / contracts /
   quickstart / tasks. No source code. No `package.json` change. Reviewers approve the
   planning artifacts.
2. **PR #1 — Foundational + MVP slice.** Setup (T001–T004) + all Phase 2 guards + tokens +
   primitives + states + axe helper + viewport hook + connection slice (T005–T028) + US1
   (T029–T035) + US2 (T036–T039) + US5 (T046–T048) + Phase Final paired-journey (T053–T054)
   + final validation runs (T058–T062, T076–T078) + the implementation PR opening (T080).
   This is the largest PR but is logically a single contract: ship a usable shell.
3. **PR #2 — US3 state variants (T040–T043).** Extends each placeholder pane with the
   loading / empty / error variants and the dev-only `?state=` URL toggle. Independent of
   PR #3 and PR #4.
4. **PR #3 — US4 connection states (T044–T045).** Wires the four-state ConnectionIndicator
   + StatusBanner (with the `syncing` no-op contract). Independent of PR #2 and PR #4.
5. **PR #4 — US6 checkout reservation (T049–T052).** Lands the eleven reserved slots and
   the no-op guard. Independent of PR #2 and PR #3. Future feature 005-checkout-payments
   consumes the slot ids by name.
6. **PR #5 — Figma handoff package (T055–T057).** Documentation-only. May ship alongside
   PR #1 or as a follow-up; design work depends on it.

Each PR's Constitution Check cites exactly the principles it touches; cross-PR drift is
prevented by the always-on source-scope guard and the dead-token guard, which lock in the
boundary invariants for every later PR.

## Independent Test Criteria

Each user story is verifiable in isolation without the other stories shipping:

| Story | Independent test                                                                                                                                     |
|:------|:-----------------------------------------------------------------------------------------------------------------------------------------------------|
| US1   | Inject `getStatus() === 'paired'`; assert TopBar identity strip + NavRail (default expanded) + Dashboard placeholder render in MainContent.          |
| US2   | From `/app/dashboard`, exercise each NavRail entry via mouse / keyboard / synthetic touch; assert each pane mounts and the active entry visual updates. |
| US3   | For each of the six panes × four state variants (default / loading / empty / error), assert the documented primitive renders for the `?state=` toggle. |
| US4   | Cycle `useConnectionState` setter through all four values; assert indicator + banner visuals + zero side-effects on `syncing`.                       |
| US5   | Set `window.innerWidth` ∈ {1023, 1024, 1279, 1280, 1920}; assert rail layout per documented matrix + ScreenTooSmall + no hamburger at any width.      |
| US6   | Mount `<CheckoutPlaceholder />`; assert the eleven reserved slots in fixed order with the literal "Reserved for 005-checkout-payments" body and zero side-effects on mount/hover/focus/click. |

## Risks & Blockers

- **B1 — `axe-core ^4.10.0` no longer current at install time.** T001 catches this; if a new
  major has shipped or `axe.run` semantics have shifted, **HALT** and reopen research §5
  before installing. The direct-integration decision MUST NOT be silently undone.
- **B2 — Tailwind 4 CSS-first migration tripping pairing styles.** T010 extends
  `tailwind.css` with the `:root` token block and the `@theme` mapping; if a `pairing` style
  silently breaks, T060's full test run catches it (the existing 002 pairing tests are
  unchanged but their visuals are not). **Mitigation:** during T010 run a snapshot test of
  the pairing screen before and after, and revert any unexpected diff.
- **B3 — Source-scope guard (T006) flaky on shallow CI clones.** T076 documents the manual
  fallback; if CI consistently can't reach `origin/main`, escalate by configuring the CI
  runner to fetch the merge-base depth.
- **R1 — `useViewportTier` debounce flake under fake `matchMedia`.** T025 enumerates the
  exact boundary widths; if the debounce introduces jitter, increase the assertion's
  tolerance window in T025 (≤ 1 transition per breakpoint crossing) but never weaken the
  guarantee.
- **R2 — Figma file lagging the repo (R6 in plan).** T079's planning PR description includes
  the Figma file's last-modified timestamp; if the Figma file has not been updated to match
  this round's contracts, T080's implementation PR is blocked until the Figma update lands.
  Process risk; no automation prevents it.
- **R3 — Slot-id rename pressure from future 005-checkout-payments work.** The eleven
  `reservedSlotIds` are frozen by `contracts/shell-routes.ts` and T049's test. If 005's spec
  proposes a rename (e.g. `tender.bank-transfer` → `tender.bank`), the rename requires a
  coordinated amendment to BOTH 003 (this feature) and the 005 spec; **adding** new ids is
  acceptable (additive). The plan's R7 flags this; the contract is the binding source.
- **R4 — Implementer's `/paired` journey choice (O2) being inconsistent with the Figma file.**
  T053 enforces the *technical* contract (no IPC, no security regression); the *visual*
  consistency check is in T055's handoff package and falls to PR review.
- **O1 — Whether to expose a tiny "design tokens" inspector route in dev builds.** Open;
  carried forward from `plan.md`. T080 explicitly flags it for reviewer decision; if added,
  the route MUST be dev-only and dropped from production bundles (T076 prod-bundle guard).
  Marked non-blocking.

---

*This file is the source for `/speckit-implement`. Changes to scope, constitution
interpretation, or the user-story map after task generation MUST update this file (and re-run
any analyses) before implementation resumes.*
