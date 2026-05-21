# Maestro Error Routing

> Seven failure classes Maestro recognises during execution. Each has
> a decision tree: who notices, what's the immediate response, when to
> escalate, when to stop. Routing rules are conservative — when in
> doubt, stop and ask.

The general rule from the common rules applies throughout:
**CRITICAL → stop + report; HIGH → fix before continuing; MEDIUM →
note, fix if < 2 min; LOW → log, continue; agent disagreement →
escalate to user.**

## 1. Test failure

**Symptom:** `npx vitest run` reports one or more failing tests.

**Who notices:** Validation Agent.

**Routing:**

- **First, identify whether the failing test is the one we just
  wrote (RED phase) or a previously-passing test we just broke
  (regression).**

- **RED phase failure (expected):** this is healthy TDD. Implement
  the code that turns it GREEN. Continue.

- **Regression in an existing test we did not write this slice:**
  HIGH. Treat the regression as a real defect in the slice's
  implementation. Read the failing assertion. Read the production
  code we just wrote. Fix the production code; do **not** edit the
  test unless the test is provably wrong (CLAUDE.md / common rules:
  *"Fix implementation, not tests (unless tests are wrong)"*). If
  the test is wrong, document why in the closeout.

- **Pre-existing flaky test (not caused by this slice):** LOW.
  Log; continue; flag in closeout as a candidate for a separate
  stability fix.

- **Coverage regression below a module threshold:** HIGH. Add the
  tests needed to climb back over the threshold before opening the
  PR. The `Money` module ≥ 95 % floor and the new-module 90 %
  thresholds are non-negotiable.

**Stop condition:** if the failure looks like a security regression
(secret in renderer DOM, PII in a log line, cross-tenant leak),
**STOP** immediately. Route through §6 (UI / a11y) or §3 (scope
creep) as appropriate, then escalate to the owner.

## 2. Typecheck / lint failure

**Symptom:** `npm run typecheck` returns errors; `npm run lint` (or
the changed-files fallback) returns errors.

**Who notices:** Validation Agent, or the Implementation Agent if
they're running the command themselves between edits.

**Routing:**

- **TypeScript strict-mode errors (Constitution V):** HIGH. Fix in
  place. The repo has `exactOptionalPropertyTypes: true` — when
  passing optional callbacks, use the spread-pattern (`{...(cond ?
  { onContinue: fn } : {})}`) instead of `prop={cond ? fn : undefined}`.

- **`@typescript-eslint/restrict-template-expressions`:** MEDIUM.
  Wrap numeric values with `.toString()` inside template literals.

- **`@typescript-eslint/no-unnecessary-condition`:** MEDIUM. The
  rule's complaint is usually that we're `??`-ing an
  always-defined value (e.g. `textContent` of a known-present DOM
  node). Drop the redundant fallback.

- **`@typescript-eslint/unbound-method`:** MEDIUM. Selecting a
  Zustand store method via `useStore((s) => s.method)` triggers this.
  Use `useStore.getState().method(...)` inside a callback instead,
  or wrap with `useCallback`.

- **`any` introduced without justification:** HIGH. Either type it
  properly or attach the `// eslint-disable-next-line` with a
  justification comment (Constitution V).

- **Lint OOM (the repo's full-repo ESLint can OOM on large
  diffs):** MEDIUM. Fall back to file-targeted lint:

  ```bash
  npx eslint --max-warnings=0 \
    <files-changed-in-this-slice>
  ```

  Record the OOM and the fallback in the closeout. The full-repo
  CI lint will run anyway; if it OOMs in CI as well, that's a
  separate platform issue.

- **Prettier mismatch:** LOW. Run `npx prettier --write
  <files-changed>` and re-check. This is mechanical.

**Stop condition:** none. Typecheck and lint failures are always
in-scope to fix in the slice. Do not open the PR red.

## 3. Scope creep

**Symptom:** a task's implementation, as written, requires touching
a file outside the slice's allowed-paths list.

**Who notices:** Scope Guard (every diff review) or the
Implementation Agent when it realises mid-task.

**Routing:**

- **Single-file overreach** (e.g. a 006 Slice 1 task wants to add a
  bridge call when the slice is renderer-only): HIGH. **STOP.** Do
  not edit the file. Surface the issue to the owner. Ask whether the
  slice's scope should be widened (re-spec via `/speckit-clarify` or
  `/speckit-plan`) or the task should be deferred to a slice that
  legitimately owns the surface.

- **Allowed-list ambiguity** (the slice's spec listed `src/renderer/`
  but didn't enumerate which subdirectories): MEDIUM. Prefer the
  narrowest reading. Confirm with the owner before touching anything
  beyond the obvious set. Do not auto-expand.

- **"Quick cleanup" or "minor improvement"** in a file the slice
  legitimately touches but that goes beyond the task's intent: LOW.
  Don't. CLAUDE.md is explicit: *"Don't add features, refactor, or
  introduce abstractions beyond what the task requires."* Note the
  cleanup in the closeout and file as a follow-up issue.

**Stop condition:** any creep into `src/main/`, `src/preload/`,
`src/shared/bridge-api.ts`, `migrations/`, OpenAPI surface, CI, or
`AGENTS.md` / `CLAUDE.md` / package files / lockfiles **stops the
slice** unless the slice explicitly owns that scope.

## 4. Forbidden file touched

**Symptom:** the diff includes a file the slice explicitly excludes.

**Who notices:** Scope Guard or the PR Reviewer.

**Routing:**

- **CRITICAL.** **STOP.** The file does not get staged. If it's
  already staged, unstage it (`git restore --staged <file>`). If
  the file is genuinely needed for the slice to work, the slice's
  scope is wrong — STOP, escalate to the owner, do not push, do not
  open a PR.

- **Forbidden files that recur** (e.g. `CLAUDE.md` showing as
  modified in `git status` from a pre-existing dirty state): NOT a
  forbidden-file-touched event. Inspect with `git diff CLAUDE.md` and
  confirm the change predates this slice. If so, leave the file
  unstaged and continue. The slice's PR will not include it.

**Stop condition:** any forbidden file in the staged set is a hard
stop. The PR does not open.

## 5. Same-file conflict

**Symptom:** two tasks in the worklist both edit the same file, and
the graph extraction (workflow §7) didn't catch it; an agent is
about to overwrite another's work.

**Who notices:** the Lead during pre-execution graph review, or
mid-run if a `[P]` group races on the same file.

**Routing:**

- **Caught at preflight:** MEDIUM. Sequentialise the two tasks per
  `task-marking.md §same-file-risk`. Continue.

- **Caught mid-run** (two agents started editing the same file
  concurrently): HIGH. **STOP both agents.** Diff their work. If
  both edits are wanted, merge them by hand into a single
  sequential edit. If only one is wanted, discard the other and
  re-run that task after the survivor lands.

- **Caught at PR review** (the diff is incoherent — half of one
  task's change is missing because another task overwrote it):
  CRITICAL. Revert the offending commit; re-execute the affected
  tasks sequentially; re-validate; re-open the PR.

**Stop condition:** any mid-run race triggers an immediate stop on
the involved agents. Multi-agent dispatch resumes only after the
file-conflict is resolved.

## 6. UI / accessibility failure

**Symptom:** axe-rule smoke test fails; keyboard-only navigation
test fails; the 44 × 44 touch-target invariant breaks; an a11y
rule (focus management, ARIA landmark, screen-reader label) breaks;
a status banner is rendered as a toast instead of a persistent
banner (Persistent Banner Rule); color alone is being used for a
state signal without an icon or text label (P14).

**Who notices:** UI / Impeccable Agent during test runs, or the PR
Reviewer.

**Routing:**

- **Constitutional a11y failures (P14):** HIGH. Fix before merge.
  P14 is a MUST: keyboard-operable cashier paths, 44 × 44 touch
  targets, icon-or-text alongside colour, axe-clean smoke.

- **Persistent Banner / One-Accent / No-Nested-Cards / Single-Primary
  rule violation** (visual-system rules from `DESIGN.md`): MEDIUM
  when a one-off in a new surface; HIGH when it breaks an established
  pattern. Fix in place.

- **Token additivity (007 Guard 1):** HIGH. Do not rename or remove
  an existing CSS custom property. Add new tokens; extend existing
  usages. Run `git diff main...HEAD -- src/renderer/ui/tokens/
  tailwind.css` to confirm no `-` line removes a property.

- **`prefers-color-scheme: dark` or `.dark` class introduction
  (007 Guard 5):** CRITICAL. The single light theme is deliberate
  for the pharmacy floor environment. Remove the dark-mode tree
  before merge.

- **PIN dot-only guard / TakeoverPrompt forbidden-strings /
  Cashier-Forbidden Information walling** (007 Guards 2 / 3 / 4):
  CRITICAL. Security guards. Stop and escalate; the regression
  could leak a PIN, expose terminal/operator identity, or reveal
  management data to a cashier.

**Stop condition:** any 007 security-guard regression (Guards 2,
3, 4) is a hard stop. CRITICAL escalation to the owner.

## 7. Unexpected migration / API / IPC need

**Symptom:** a task that was scoped as renderer-only discovers it
genuinely needs a new SQLite migration, a new OpenAPI endpoint, or
a new IPC channel.

**Who notices:** Implementation Agent during the task, or the
Scope Guard during the diff review.

**Routing:**

- **CRITICAL.** **STOP.** Do not add the migration / endpoint /
  channel.

- This is the canonical scope-creep pattern Constitution P8 calls
  out: bridge / main / preload / migrations / OpenAPI changes get
  smuggled into UI-only features as "incidental work." Don't.

- Surface the finding to the owner:

  > "Task T### was scoped as renderer-only, but the implementation
  > needs a new `payment_attempts` row stored in SQLite. We have
  > two options:
  >
  > (a) The slice's spec is wrong — it should have included a
  > migration. Re-run `/speckit-clarify` or `/speckit-plan` to widen
  > the slice's scope and the §A3 gate.
  >
  > (b) The task is wrong — it can be implemented without persistence
  > under this slice (the data is held in renderer state until the
  > next slice's bridge call). Re-scope the task.
  >
  > Which?"

- **Never** add the migration / endpoint / channel and "see if
  review catches it." Review will catch it. The PR will be refused.
  You will have wasted the run.

**Stop condition:** mandatory. Do not proceed without the owner's
verdict.

---

## A note on retries

Maestro's default is **fix the root cause, not retry the same
operation**. From the common rules: *"Do not retry failing commands
in a sleep loop — diagnose the root cause."*

Retries make sense only for genuinely flaky externals — a flaky
network call to a sandbox, for example, or an OS-level handle that
the test runner sometimes can't acquire. Inside this repo, the
typecheck / lint / vitest commands are deterministic; if they fail,
they fail for a reason. Diagnose, fix, re-run once.

## A note on stopping vs. escalating

The two are different. **Stopping** is "I'm pausing this slice and
not making any further changes." **Escalating** is "I'm asking the
owner for a decision before I continue."

You can stop without escalating (e.g. you've found a regression, you
know the fix, you're applying it). You can escalate without stopping
(e.g. you're proceeding with the safe interpretation while waiting on
confirmation of a soft scope ambiguity).

CRITICAL events do both: stop AND escalate.

HIGH events stop and may escalate depending on whether the fix is
obvious.

MEDIUM events neither stop nor escalate by default; they get noted
and fixed.

LOW events get logged and the slice continues.

This matches the escalation ladder in the common rules.
