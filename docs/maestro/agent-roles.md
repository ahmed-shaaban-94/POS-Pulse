# Maestro Agent Roles

> Nine roles that cover the standard slice execution loop. A real
> session may collapse multiple roles into a single agent — these are
> *roles*, not headcounts. The dispatch decision (one agent vs.
> several) is the Maestro Lead's first call and the most important.

## The roles

### 1. Maestro Lead

**Job:** Owns the workflow end-to-end for one slice. Reads
`coordination.md`, produces the gate verdict (workflow §3), extracts
the worklist, builds the three graphs (dependency / parallel-safe /
file-conflict), decides agent assignment, supervises execution,
publishes the closeout report.

**Authority:** May downgrade `[P]` markers based on file-conflict
analysis. May stop the slice at any step (gate change, scope creep,
forbidden file touched, security finding). May NOT modify `tasks.md`
content (only state ticks). May NOT cross a held gate, ever.

**When this role is mandatory:** every Maestro run. There is no slice
without a Lead.

### 2. Spec Auditor

**Job:** Reads `spec.md`, `plan.md`, and `contracts/` for the slice in
flight. Confirms the worklist matches the slice's stated scope.
Flags missing test rows (Constitution VI). Flags `[NEEDS CLARIFICATION]`
that haven't been resolved by `/speckit-clarify`.

**Authority:** Read-only. Findings route to the Lead. May NOT add or
edit tasks; that requires re-running Spec Kit.

**When useful:** at preflight, especially when the slice has been open
for more than a few days and the spec may have evolved.

### 3. Scope Guard

**Job:** Holds the line on the slice's hard scope. The Slice 1 of
006-payments-tender, for example, must not touch `src/main/**`,
`src/preload/**`, `src/main/ipc/**`, `src/shared/bridge-api.ts`,
`migrations/**`, OpenAPI, CI, or `_reference/Data-Pulse/`. The Scope
Guard reviews every diff against the slice's allowed-paths list and
the forbidden-paths list.

**Authority:** May refuse staging of a file that falls outside the
allowed list. Routes scope violations through
`error-routing.md §Scope creep` or `§Forbidden file touched`.

**When useful:** every slice that intersects sensitive surfaces
(bridge, main, preload, migrations, secrets, audit). Most slices do.

### 4. Test Agent

**Job:** Writes failing tests first (Constitution VI). Owns the RED
half of TDD: the test exists, is named, asserts the right invariant,
and fails for the right reason. Hands off to the Implementation Agent
for the GREEN half.

**Authority:** Writes test files only. Does not modify production
source. (Some slices collapse this role into the Implementation Agent
when the surface is small.)

**When useful:** when the slice has > 5 test tasks and they can be
written ahead of the implementation tasks they shadow.

### 5. Implementation Agent

**Job:** Writes the production code that turns RED tests into GREEN.
Owns one task at a time. Stays inside the slice's allowed paths.
Follows the immutability, error-handling, and validation rules in
`CLAUDE.md` and the common rules.

**Authority:** May add files inside the allowed-paths list. May NOT
add bridge surface, IPC channels, migrations, or OpenAPI changes
incidentally.

**When useful:** the bulk of every slice.

### 6. UI / Impeccable Agent

**Job:** Implements the renderer surface against the visual reference
(`PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, per-feature
`visual-direction/README.md`). Uses the canonical tokens (`Command
Navy #1f4e7a`, `Confirmation Green #1f8a5b`, `Alert Red #b32e36`,
`Caution Amber #b87600`, `Info Teal #1e6f8c`, `Near-White #fbfcfd`,
`Clean White #ffffff`, `Midnight Ink #0f1d2e`, etc.). Honours the
44 × 44 CSS-px touch-target floor (P14), the One-Accent Rule, the
Status-Color Containment Rule, the No-Second-Font Rule, the
Single-Primary Rule, the No-Nested-Cards Rule, the Persistent Banner
Rule. RTL is the default locale (Arabic-first).

**Authority:** Renderer-only. May touch `src/renderer/`, the
`src/renderer/ui/` primitives, and the corresponding tests. May NOT
introduce new design tokens that conflict with `tailwind.css` or
`src/renderer/ui/tokens/` (Token additivity — 007 Guard 1). May NOT
introduce `prefers-color-scheme: dark` or a `.dark` tree (007
Guard 5 — no dark mode).

**When useful:** every slice that ships visible UI.

### 7. Validation Agent

**Job:** Runs the full validation pipeline (workflow §10). Records
results. Reports green / red / partial. Routes any red through
`error-routing.md`.

**Commands the role owns (from CLAUDE.md):**

```bash
npm run typecheck
npm run lint           # may OOM — see fallback in workflow.md
npx vitest run
npx vitest run <new-tests> --coverage --coverage.include=<src-paths>
```

**Authority:** Read-only on the source. Writes only the validation
log. Does not modify code; routes fixes back to the Implementation
Agent or the UI / Impeccable Agent.

**When useful:** every slice, just before the PR opens. A green
Validation pass is the gate to PR creation.

### 8. PR Reviewer

**Job:** Reads the diff. Checks:

- Diff matches the worklist's allowed paths.
- Commits cite task IDs (P13).
- No incidental bridge / main / preload / migration / OpenAPI / CI /
  package / lockfile changes (P8 / P16).
- No secrets / PII / card data in renderer DOM (P6 / P7).
- No float arithmetic on money (II).
- 44 × 44 floor honoured (P14).
- A11y smoke checks pass (P14).
- Spec Kit task IDs cited in the PR body (P13).

**Authority:** May approve, request changes, or refuse. Refusal routes
through `error-routing.md` by class.

**When useful:** before merge. In single-agent mode, the Lead absorbs
this role; in multi-agent mode, the PR Reviewer is a separate role to
preserve independence.

### 9. Closeout Agent

**Job:** Writes the closeout report per `report-schema.md`. Updates
`coordination.md` with the merge SHA and date. Ticks `tasks.md`'s
state mark. Opens any follow-up issues for deferred work.

**Authority:** Edits docs and coordination only — not source, tests,
packages, or migrations.

**When useful:** every slice's final step. The next person picking up
the feature reads the closeout first.

---

## Dispatch posture

Maestro defaults to **fewer agents, not more**. A single human-supervised
agent owning Lead + Implementation + Validation across a small slice is
usually the right answer.

Spin up multi-agent dispatch only when:

- The slice has clearly independent batches (e.g. five test files in
  five different folders, each with its own implementation file in a
  different folder).
- The total work exceeds what one agent's context can hold comfortably.
- No batch touches sensitive scope (see below).

When you do dispatch, follow the **ASK, don't auto-dispatch** rule from
the common rules: present options A/B/C/D with a recommendation, let
the owner pick.

---

## When NOT to use multiple agents

Five red flags. Any one of them is enough to fall back to a single
agent.

### 1. Same-file edits

If two or more tasks touch the same file (even via `[P]`), they are
sequential under Maestro and they belong to one agent. Two agents
racing on `CartPane.tsx` produce merge conflicts and lost changes.

### 2. Wiring-heavy tasks

A task that adds a new prop, then threads it through a parent, then
threads it through a grandparent is one continuous chain of thought.
Splitting it across agents breaks the chain. Single agent.

### 3. Unclear gates

If the gate verdict (workflow §3) is ambiguous — e.g. §A2 says
"deferred" but the slice's body references a backend endpoint — STOP
and resolve the ambiguity with the owner. Do not dispatch multiple
agents at the seam.

### 4. Sensitive main / preload / IPC / security work

Constitution P8 makes this explicit: changes to
`src/preload/`, `src/main/`, `src/shared/bridge-api.ts`, the SecretStore
API, the migration runner, or the OpenAPI codegen require **explicit
security review**. Multi-agent dispatch dilutes that review. Single
agent, single PR, single reviewer pass.

### 5. Forbidden-scope risk

If the slice's allowed-paths list is narrow and the task brushes up
against the boundary (e.g. a renderer-only slice that needs one
expected change in `src/shared/` for a type re-export), the risk of
an agent crossing the line is highest. Single agent under the Lead's
direct supervision.

---

## Worked example — 006 Slice 1 (renderer-only payments tender)

The feature's Slice 1 was implemented under a single-agent model. The
slice spanned:

- 1 new store (`payment-store.ts`)
- 3 new renderer components (`PaymentSurface.tsx`,
  `TenderSelection.tsx`, `PaymentCartSummary.tsx`)
- 6 new test files (T020 … T024 + T034)
- Minor edits to `app-config.ts`, `feature-flags-store.ts`,
  `HandoffSummary.tsx`, `CartPane.tsx`

A multi-agent dispatch would have looked like:

- Test Agent: writes T020–T024 + T034 in parallel (all six are in
  different files; `[P]` honoured).
- Implementation Agent A: builds `TenderSelection.tsx` +
  `PaymentCartSummary.tsx` (independent leaves, no cross-dependency).
- Implementation Agent B: builds `payment-store.ts` + `PaymentSurface.tsx`
  (the store first, then the surface).
- Single Implementation Agent C: modifies `HandoffSummary.tsx` and
  `CartPane.tsx` (same wiring chain; not split).
- Validation Agent: runs typecheck, lint, tests, coverage.

In practice we ran it as **one agent** because the slice was small (≤
14 file changes, all renderer-only) and the wiring was tightly
coupled (the `onContinue` prop addition spans three files in
sequence). The single-agent model finished cleanly with 100 % coverage
on new modules, no scope creep, and one focused PR. That is the
posture Maestro defaults to.
