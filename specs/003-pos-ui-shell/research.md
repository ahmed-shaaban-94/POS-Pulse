# Phase 0 — Research: POS UI Shell

**Feature:** 003-pos-ui-shell
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-05-04
**Status:** Final (no open questions)

This document records every non-trivial technical decision the plan commits to. Each section
states the **decision**, the **alternatives considered**, the **rationale**, and the **constraints
the decision creates** for downstream work.

---

## §1 — Token delivery: CSS variables + typed TS exports (dual binding)

**Decision.** Design tokens are delivered as **both** CSS custom properties (in
`src/renderer/styles/tailwind.css`) **and** typed TypeScript exports (in
`src/renderer/ui/tokens/`). The CSS variables are the runtime source; the TS exports are the
type-safe authoring surface. A parity test asserts every CSS variable has a matching TS export
with the same semantic name.

**Alternatives considered.**

1. **TS exports only (CSS-in-JS).** Rejected: adds a runtime style engine, conflicts with the
   constitution's frozen tech stack (Tailwind 4), and worsens render performance on lower-end
   cashier hardware.
2. **CSS variables only.** Rejected: components lose type-safe access; semantic palette mistakes
   ("did you mean `surface` or `surface-muted`?") become runtime, not compile-time, errors.
3. **JSON token file processed by a build step (Style Dictionary).** Rejected: adds a new build
   tool and a code-generation step that is not pinned by the constitution. Tailwind 4's CSS-first
   theming + a small TS file gives us 95 % of the benefit for 5 % of the moving parts.

**Rationale.** Tailwind 4 made CSS-first theming the default; the project already uses it. A
parallel TS export file is small (≈ one record per token) and makes the Figma-to-code handoff
unambiguous because the same names appear in three places (CSS variables, TS exports, Figma layer
names).

**Constraints created.**

- A test in `src/renderer/ui/tokens/__tests__/tokens.test.ts` MUST assert:
  - every TS-exported token has a corresponding CSS custom property (`--<name>`) defined under
    `:root` in `tailwind.css`;
  - every CSS custom property is reachable from at least one TS export.
- A token MUST NOT be added to one place and not the other. The test fails the build.
- Typography tokens are exported as a structured object (`family`, `weight`, `size`,
  `lineHeight`) — not a flat list — so the TS API can guide IDE completion.

---

## §2 — Routing topology: `/app/*` parent route mounting `AppShell`

**Decision.** Add a single new top-level route `/app/*` to `src/renderer/router.tsx`. That route
mounts the new `AppShell` layout component. Six child routes hang off it:
`/app/dashboard`, `/app/sales`, `/app/cart`, `/app/checkout`, `/app/inventory`,
`/app/settings`. The existing `/pairing` and `/paired` routes are unchanged. The pairing-bypass
contract from 002 (FR-1 of 002, FR-5 of this spec) is preserved by reusing `pairing.getStatus()`
in the boot router exactly as today — the shell never renders unless the gate has resolved to
`paired`.

**Alternatives considered.**

1. **Replace `/paired` with `/app/dashboard`.** Rejected for this feature: `/paired` is the
   confirmation step delivered by 002, and changing it is a product decision. Open item O2 in the
   plan.
2. **Mount the shell at `/`.** Rejected: would conflate the boot-router's pairing-status decision
   with a shell-routed default route. Today the boot router redirects to `/pairing` or `/paired`
   based on `getStatus()`; we keep that and add `/app/*` as a peer.
3. **Use route-grouping conventions in `react-router-dom@7` to share the layout without a path
   prefix.** Rejected: the path-prefix is useful for visual grouping in the URL bar (cashier or
   debug viewer can tell "this is the shell" at a glance) and matches how 002's
   `/pairing` / `/paired` already segment by phase.

**Rationale.** A single parent route with an `<Outlet />` is the idiomatic
`react-router-dom@7` pattern; it gives every shell-region a stable home and makes navigation
between placeholder panes a path change, not a state change.

**Constraints created.**

- `AppShell` MUST render `<Outlet />` exactly once, inside the `MainContent` region.
- Each placeholder pane MUST be a route component, not a child of a stateful pane container.
  This keeps the navigation map a static, testable artifact.
- **O2 has been resolved as a recommendation (see plan §"Risks & Open Items" → O2):** 003 may
  either (1) make `/app/dashboard` the post-pair-success landing route and treat `/paired` as
  the immediate confirmation surface only, or (2) leave the boot router unchanged and add a
  `Continue to dashboard →` action on `/paired` so that screen is not a dead-end. Both options
  are scope-compliant and preserve 002's pairing-bypass contract; the implementer picks at
  PR-time and notes the choice in the PR description. Neither option modifies the boot-router's
  `getStatus()` gate.

---

## §3 — Renderer state: zustand slices for shell-only concerns

**Decision.** Two zustand slices are introduced:

1. `useConnectionState` — current connection-state value (`online` | `degraded` | `offline` |
   `syncing`) + a single setter. Default is `online`. **Visual-only.** The setter is the only
   mutation path; no listeners subscribe to network events, IPC, or persistence.
2. `useDevToggles` (dev-only, lazily mounted) — overrides for placeholder-pane state variants
   and connection-state, sourced from `?state=…&conn=…` URL search params, exposed only in dev
   builds.

`@tanstack/react-query@5` is **not** used in this feature because there are no fetches in scope.

**Alternatives considered.**

1. **`useState` co-located with `AppShell`.** Rejected: the connection-state visual is consumed
   from at least three regions (TopBar's indicator, the global status banner, and the
   placeholder-pane offline overlay where applicable); a context / store avoids prop-drilling.
2. **React Context.** Acceptable, but the project already uses zustand for the pairing form;
   keeping the same pattern reduces cognitive load.
3. **Persist the connection-state to localStorage / `safeStorage`.** Rejected: violates the
   "visual-only" constraint and the Hard Non-Implementation Boundaries — the state is a display
   concern, not durable data.

**Rationale.** Tiny slices with explicit setters keep the test surface trivial: each slice has a
default value, a setter, and a guard test asserting it has no side-effect subscribers.

**Constraints created.**

- `useConnectionState` MUST have zero side-effect subscriptions. A guard test asserts there is
  no `subscribe` listener that calls fetch / IPC / localStorage / persistence.
- `useDevToggles` MUST be tree-shaken out of production bundles (no import path reachable from
  production code). A test reads the production build manifest and asserts the dev-toggle module
  is not present.

---

## §4 — Shared component module boundary: first-party `src/renderer/ui/`, no external library

**Decision.** Author the eight primitives (Button, Input, Card, Table, Badge, Dialog, Toast,
StatusBanner) in a new module `src/renderer/ui/primitives/`. Do NOT introduce an external UI
library (shadcn/ui, Radix, MUI, Mantine, Headless UI, …).

**Alternatives considered.**

1. **shadcn/ui.** Tempting because it scaffolds typed primitives with Tailwind. Rejected for
   this feature: it brings a dependency on Radix Primitives + a copy-paste mental model that
   makes the source-of-truth fuzzy ("did Sonnet edit the upstream or the local copy?"). The
   constitution's frozen tech stack does not include it. We can adopt it in a future feature if
   the team agrees; this feature stays first-party.
2. **Radix Primitives directly.** Rejected for the same reason — adds an unaudited dependency
   for a UI-shell feature whose primitives are intentionally small.
3. **MUI / Mantine.** Rejected: heavy runtime, unclear long-term licensing posture for an
   Electron app distributed on Windows.

**Rationale.** The shell is small and stable enough that a hand-authored, fully-typed,
fully-tested primitive set with ≥ 90 % coverage is achievable inside this feature without
borrowing a dependency. Building primitives ourselves locks in the touch-target floor, the
density model, and the four connection-state visual contract — none of which any third party
matches exactly.

**Constraints created.**

- Each primitive's public prop type is exhaustive (no `any`, no `as` casts). The component file
  is the contract; no separate `.d.ts` shimming.
- Each primitive consumes tokens (FR-18). Hard-coded colors / sizes / shadows in primitive code
  is a build failure.
- `Dialog` MUST trap focus and restore focus on dismiss (NFR-6). We use the `inert` attribute on
  background content and a small first-party focus-trap helper, not a third-party hook.

---

## §5 — Accessibility automation: `axe-core ^4.10.0` via a first-party Vitest helper

**Decision.** Add **`axe-core` `^4.10.0`** (the rule engine, runner-agnostic) as a **dev
dependency only**, consumed via a small first-party Vitest helper
`expectNoAxeViolations(container)` that calls `axe.run(container)` and asserts
`violations.length === 0`. Each placeholder pane gets a smoke test that runs the helper for the
default / loading / empty / error variants and fails on any violation.

**Why direct integration, not a third-party Vitest assertion wrapper?** This repo's test stack
is Vitest `^4.1.5` + RTL `^16.3.2` + happy-dom `^20.9.0` + React 19 (per `package.json`).
Third-party assertion wrappers around `axe-core` typically declare peer dependencies on a
specific generation of the test runner; those peer ranges have a history of lagging the current
Vitest major, which forces consumers to either fight peer-dep warnings or pin transitive
versions that no longer match the wrapper's own assertions. `axe-core` itself is runner-agnostic
and stable across the Vitest 4 / RTL 16 / React 19 line, so a small first-party helper buys us
the same ergonomics with a smaller blast radius for future Vitest upgrades. The helper is also
*implementation* work — it lives in test utilities at implementation time, not in planning
artifacts as source code.

**Version pin.** `^4.10.0`. The helper relies only on the public `axe.run(container, options)`
API which has been stable across `axe-core` 4.x. The exact installed version is locked by
`package-lock.json` once the `/speckit-tasks` install task runs; until then no install is
performed.

**Alternatives considered.**

1. **Manual a11y review only.** Rejected: not testable, not deterministic, gets skipped under
   pressure.
2. **Playwright + axe end-to-end.** Rejected for this feature: Playwright is not in the
   constitution's pinned stack and would require a CI tweak. Vitest + happy-dom is enough for
   the rule-pass smoke; a future feature can add E2E coverage.
3. **`jest-axe`.** Same idea but on the wrong test runner.
4. **Third-party Vitest assertion wrappers around `axe-core`.** Rejected: peer-dep ranges
   typically lag the current Vitest major (the established prior art was authored against
   Vitest 1–2), creating a maintenance gamble against this repo's Vitest 4 / RTL 16 / React 19
   stack. Direct integration via a first-party helper is simpler and future-proof against
   Vitest upgrades.
5. **`@axe-core/react`.** Not adopted in this round — it is oriented at runtime dev-mode
   audit logging rather than test-time assertion. May be revisited if a later task proves it
   adds value beyond `axe-core` + the first-party helper.
6. **Storybook + storyshots / a11y addon.** Rejected: Storybook is not in the pinned stack
   (research §6); story-like dev toggles are exposed via `?state=…` URL search params instead.

**Rationale.** Axe gives us a baseline guarantee that landmark roles, aria attributes, label
associations, and tab-order semantics are not silently regressing. Color-contrast checks are
turned off in this run (happy-dom doesn't compute layout color accurately) and noted in
`contracts/shared-components.md` so the gap is visible.

**Constraints created.**

- The off-rules list MUST be enumerated in `contracts/shared-components.md`. Adding a new
  off-rule requires a comment with rationale.
- The smoke runs as part of `npm test -- --coverage`, not as a separate step, so it inherits the
  same flake-budget as the rest of the test suite.
- The helper signature MUST be `expectNoAxeViolations(container: HTMLElement, options?:
  AxeRunOptions): Promise<void>` — pin in `contracts/shared-components.md` so a future tasks pass
  doesn't drift to a synchronous shape.
- The helper itself is **implementation** work, not planning artifact content. Its source lands
  in `src/renderer/ui/primitives/__tests__/axe-config.ts` at implementation time; this planning
  round only pins the signature and the rule-set.
- **No install is performed in this planning round.** The dependency line is added to
  `package.json` only by the install-axe task that `/speckit-tasks` will generate.

**Version-pin durability footnote.**

> Version-pinned at planning time against Vitest `^4.1.5`, React Testing Library `^16.3.2`,
> happy-dom `^20.9.0`, and React `19.2.x` (per the working `package.json` on 2026-05-04).
> Re-check wrapper compatibility before changing from `axe-core` direct integration: if any of
> these four versions move forward by a major, the rationale for direct-integration over a
> third-party Vitest assertion wrapper SHOULD be revisited. The decision MUST NOT be silently
> undone — a follow-up research entry replaces this section if direct-integration ever stops
> being the simpler path.

**Reminder for `/speckit-tasks`.**

When `/speckit-tasks` materialises the install task that adds `axe-core ^4.10.0` to
`package.json`, that task MUST:

1. Re-verify that `axe-core ^4.10.0` is still the current stable major and that its public
   `axe.run(container, options)` API has not been deprecated.
2. Re-verify compatibility against the **then-current** `package.json` versions of Vitest,
   React Testing Library, happy-dom, and React. If any of those have moved forward by a major
   since planning time, the install task MUST pause and surface the discrepancy for review
   rather than silently picking a newer `axe-core` major.
3. Confirm the helper signature `expectNoAxeViolations(container: HTMLElement, options?:
   AxeRunOptions): Promise<void>` is still expressible against the installed `axe-core`
   types (`RunOptions`, `AxeResults`).
4. Only then modify `package.json` and `package-lock.json`. Until that re-verification passes,
   no install runs.

---

## §6 — CI integration: no workflow changes; existing pipeline gates this feature

**Decision.** No `.github/workflows/*.yml` change. The existing
`codegen:verify → typecheck → lint → test → package:dir` pipeline already exercises everything
this feature touches. The `npm test -- --coverage` step picks up the new `src/renderer/ui/` and
`src/renderer/shell/` directories automatically.

**Alternatives considered.**

1. **Add a dedicated `a11y` job.** Rejected: the axe rule pass is fast and benefits from running
   alongside the unit tests; a separate job adds CI minutes without faster feedback.
2. **Add a Storybook job.** Rejected: Storybook is not in the pinned stack; story-like dev
   toggles are exposed via `?state=…` URL search params instead.
3. **Add a Visual-Regression job (Chromatic, Loki, …).** Rejected for this feature: high
   maintenance, low signal at this stage. Reasonable to add when the Figma file stabilises.

**Rationale.** The constitution favours fewer, simpler CI gates that everyone knows how to read.
This feature does not change any of them.

**Constraints created.**

- The bridge-non-regression guard test (Plan §"Test Strategy" + Phase 2 step 8) runs *inside*
  `npm test`, not as a CI step, so a future renaming of the workflow file does not bypass it.
- Coverage thresholds for `src/renderer/ui/` and `src/renderer/shell/` are wired into
  `vitest.config.ts` so the gate is visible in the test runner output, not buried in a CI script.

---

## §7 — Payment-tender visual reservation: pane-local components, not shared primitives

**Decision.** The eleven payment-tender visual reservations live as **pane-local components** in
`src/renderer/routes/app/checkout/` (specifically `ReservedTenderRow.tsx` +
`ReservedTotalsRow.tsx` + `reserved-slot-ids.ts`), **not** as shared primitives in
`src/renderer/ui/primitives/`. Future feature **005-checkout-payments** owns all real payment
logic and consumes the eleven frozen slot ids by name without renaming. The folder name is
`checkout` (not `receipt`) to align with the route `/app/checkout`, the `CheckoutPlaceholder`
component, and the future feature name; see plan §"Note B — Naming convention".

**Alternatives considered.**

1. **Promote `ReservedTenderRow` to a shared primitive in `ui/primitives/`.** Rejected: the
   reservation is a *forward-compat* shape, not a reusable visual primitive. Promoting it would
   pollute the shared component inventory with a forward-only component that 005 will replace
   with a real payment row anyway.
2. **Inline the eleven rectangles directly in `CheckoutPlaceholder.tsx` without a generic
   component.** Rejected: makes the no-op guard test verbose and makes the slot-id contract harder
   to read at a glance.
3. **Skip the reservation and let 005 figure out the layout.** Rejected: that creates the exact
   shell-reshape risk the reservation is designed to prevent. Reserving the rectangles now is the
   spec's explicit decision (§"Why reserve now instead of later").

**Rationale.** Pane-local placement keeps the shared primitive inventory minimal and matches the
"name the slot, forbid the logic" pattern already used for `syncing`. The slot ids are exported
as a `const` array so 005 can import the type without depending on a runtime component.

**Constraints created.**

- The slot id set is frozen by `contracts/shell-routes.ts`. Adding an id is acceptable
  (additive, but should be coordinated with 005 once specified); removing or renaming an id
  requires a coordinated spec amendment to BOTH 003 and 005.
- The slot component prop type MUST NOT carry `amount`, `currency`, `value`, `onSubmit`,
  `onChange`, or any callback. Typecheck is the first defence; the no-op guard test
  (`reserved-slot-noop.test.tsx`) is the second.
- No `Money` type, no currency formatter, no exchange-rate hook is introduced in this feature.
  005 owns those.

## Summary of decisions

| # | Decision | Module(s) primarily affected |
|:-:|:--|:--|
| 1 | Tokens delivered as CSS variables + typed TS exports (dual binding, parity-tested) | `src/renderer/ui/tokens/`, `src/renderer/styles/tailwind.css` |
| 2 | `/app/*` parent route mounting `AppShell`; `/pairing` + `/paired` unchanged | `src/renderer/router.tsx`, `src/renderer/shell/AppShell.tsx` |
| 3 | Two zustand slices (`useConnectionState`, `useDevToggles`); no `react-query` use | `src/renderer/shell/connection/`, `src/renderer/shell/dev/` |
| 4 | First-party shared components in `src/renderer/ui/primitives/`; no external UI library | `src/renderer/ui/primitives/` |
| 5 | `axe-core ^4.10.0` per-pane rule pass via first-party `expectNoAxeViolations` helper, dev-dependency only (install deferred to `/speckit-tasks`) | `src/renderer/routes/app/__tests__/`, `src/renderer/ui/primitives/__tests__/axe-config.ts` |
| 6 | No CI workflow change; coverage thresholds wired in `vitest.config.ts` | `vitest.config.ts` |
| 7 | Payment-tender visual reservations live pane-local in `routes/app/checkout/`, not in `ui/primitives/`; eleven slot ids frozen for future 005-checkout-payments. Folder/component named after the route (`checkout`), not the printed artifact (`receipt`). | `src/renderer/routes/app/checkout/` |

No `NEEDS CLARIFICATION` items remain. All inputs to the plan and contracts are settled.
