# Maestro `/goal` Templates

> Five reusable `/goal`-style prompts an owner can paste into a fresh
> session to invoke a Maestro step. Each template is self-contained:
> it briefs the agent on context, constraints, and the stop condition.
> Substitute `<placeholders>` for the run-specific values.

## Template 1 — Maestro Preflight

**Use when:** you've decided the next slice and you want a clean
gate-verdict + task-extraction + graph-build pass before any
implementation begins. No code touched.

```text
You are Claude Code working in the POS-Pulse repo on the
<branch-name> branch.

Goal: produce a Maestro preflight for <feature-id> Slice <N>.
Output only — do not start implementation.

First verify repo state:
  git status --short
  git branch --show-current
  git fetch origin
  git checkout main
  git pull --ff-only origin main
  git log -1 --oneline

Read in order:
  .specify/memory/constitution.md  (note the pinned version)
  CLAUDE.md
  specs/<feature-id>/spec.md
  specs/<feature-id>/plan.md
  specs/<feature-id>/tasks.md
  specs/<feature-id>/coordination.md
  specs/<feature-id>/contracts/  (every file)
  PRODUCT.md  (if UI work)
  DESIGN.md  (if UI work)
  .impeccable/design.json  (if UI work)
  specs/<feature-id>/visual-direction/README.md  (if present)

Then, per docs/maestro/workflow.md steps 3–7, produce:

  1. Gate verdict — one paragraph summarising the
     coordination.md gate ledger for the slice. State the verdict:
     GO, STOP, or CONDITIONAL (with the condition named).
  2. Task worklist — the T### IDs in scope for this run, in
     tasks.md order, with their source [P] / [US?] /
     [BLOCKED:gate] qualifiers preserved verbatim.
  3. Dependency graph — list every edge (A → B means B waits on
     A). Note TDD pairs explicitly.
  4. File-touch map — for each task, list the files it will
     create and the files it will modify. Use the runtime reality
     when the tasks.md proposal is inaccurate; flag the mismatch.
  5. File-conflict graph — list every same-file edge. Downgrade
     any [P] pair caught here from parallel-safe to sequential;
     record the downgrade with the file and the reason.
  6. Parallel-safe groupings — the antichain set, after the
     file-conflict downgrade. Note which group can run
     concurrently with which.
  7. Maestro marks — for each task, assign one of
     {ready, blocked, parallel-safe, sequential, same-file-risk,
     needs-owner-approval, forbidden-scope} per
     docs/maestro/task-marking.md. Explain any
     needs-owner-approval or forbidden-scope marks.
  8. Dispatch recommendation — single agent OR multi-agent with
     specific role assignment (see docs/maestro/agent-roles.md).
     Default to single agent unless multi-agent is clearly
     beneficial. If multi-agent, ASK the owner with options.
  9. Validation plan — list the commands the slice will run
     before opening a PR.

Do not write code. Do not modify any file (including tasks.md).
Final report only.

Stop condition: if the gate verdict is STOP, emit the verdict and
the reason and stop. If it is CONDITIONAL, emit the verdict and
the condition and stop. If it is GO, emit the full preflight and
stop — do not auto-proceed to implementation.
```

## Template 2 — Implementation after approval

**Use when:** the preflight is approved, the gates are open, the
owner has confirmed the dispatch posture, and the slice is cleared
to start.

```text
You are Claude Code working in the POS-Pulse repo.

Goal: implement <feature-id> Slice <N>, task IDs <T### … T###>,
per the Maestro preflight dated <date>.

The preflight verdict was GO. Allowed scope:
  - Create: <list of allowed new file paths>
  - Modify: <list of allowed file paths>

Forbidden scope:
  - <every forbidden file or directory>
  - src/main/, src/preload/, src/shared/bridge-api.ts unless
    the slice explicitly owns them
  - migrations/, OpenAPI files, CI workflows
  - AGENTS.md, CLAUDE.md, package.json, package-lock.json
  - _reference/Data-Pulse/

Branch off main: <feat|fix|refactor>/<feature-id>-slice-<N>-<short-purpose>

Per Constitution VI, TDD: every test task RED before its
implementation task. Per Constitution P13, stage only named files
(no `git add -A`, no `git add .`).

Security invariants (mandatory):
  <slice-specific list — copy from preflight section 7>
  - No floats for money (Constitution II)
  - No PII / cards in logs (P6 / P7 / P11)
  - No sensitive IDs in renderer DOM
  - 44 × 44 CSS-px touch targets on every interactive element
  - contextIsolation: true, nodeIntegration: false, sandbox: true
    (Constitution III) — unchanged by this slice

Validation before opening a PR:
  npm run typecheck         (both tsconfigs clean)
  npm run lint              (full; fall back to changed-files if OOM)
  npx vitest run            (no regressions)
  npx vitest run <new-tests> --coverage --coverage.include=<paths>
                            (coverage on new code per slice threshold)

Stop conditions:
  - any failure routes through docs/maestro/error-routing.md by class
  - any need to touch a forbidden file: STOP, escalate, do not push
  - any unexpected migration / OpenAPI / bridge / IPC need: STOP,
    escalate per error-routing.md §7

Open one PR against main with:
  - title: <type>(pos): <feature-id> slice <N> — <short purpose>
  - body: cite the task IDs, summarise what shipped, list the
    security invariants honoured, attach the validation evidence,
    include a test-plan checklist with manual smoke items.

Do not push directly to main. Do not merge the PR. Stop after
opening it.

Final report: produce the closeout per docs/maestro/report-schema.md.
```

## Template 3 — Validation / fix loop

**Use when:** implementation looks done but validation just failed.
You want a tightly scoped fix-and-revalidate pass, no scope creep.

```text
You are Claude Code working in the POS-Pulse repo on branch
<branch-name>.

Goal: diagnose and fix the failures from the validation pass for
<feature-id> Slice <N>. Re-validate after each fix.

Current validation state:
  npm run typecheck   → <pass | fail with N errors>
  npm run lint        → <pass | fail with N errors | OOM>
  npx vitest run      → <NN passed, MM skipped, K failed>
  coverage on <path>  → <pct% — below threshold X% | above>

For each failure class, follow docs/maestro/error-routing.md:
  - Test regression in a pre-existing test → fix implementation, not test
  - Typecheck error → fix in place (note exactOptionalPropertyTypes rules)
  - Lint error → fix or wrap properly; ESLint OOM → fall back to
    changed-files lint with npx eslint --max-warnings=0 <files>
  - Coverage shortfall → add tests for the uncovered branches /
    functions, do not lower the threshold
  - UI / a11y failure → fix in place (Constitution P14)
  - Security regression → STOP, escalate immediately

Forbidden during this fix loop:
  - Adding new features
  - Refactoring outside the failing surface
  - Touching files outside the slice's allowed-paths list
  - Adding migrations, OpenAPI, bridge calls, or IPC channels

Re-validate after each meaningful fix:
  npm run typecheck && npx vitest run

Final report (terse — under 300 words):
  - What failed
  - What was diagnosed
  - What was fixed (with file paths)
  - Re-validation result
  - Anything deferred to a follow-up issue

Stop condition: re-validation green → STOP. Do not push, do not
update the PR. Wait for owner to invoke the next template.
```

## Template 4 — PR review

**Use when:** the slice has an open PR and you want an
independent review pass against the constitution, the slice
spec, and the visual reference.

```text
You are Claude Code acting as an independent reviewer for
POS-Pulse PR #<NNN> (<feature-id> Slice <N>).

Read in order:
  .specify/memory/constitution.md  (note the pinned version)
  CLAUDE.md
  specs/<feature-id>/spec.md
  specs/<feature-id>/plan.md
  specs/<feature-id>/tasks.md  (rows T### … T### in scope)
  specs/<feature-id>/coordination.md  (gate state)
  the PR diff (gh pr diff <NNN>)

Review for:

  Spec / scope
    - PR body cites task IDs (Constitution P13)
    - Diff is restricted to the slice's allowed-paths list
    - No incidental changes to src/main/, src/preload/,
      src/shared/bridge-api.ts, migrations/, OpenAPI, CI,
      package files, lockfiles, AGENTS.md, CLAUDE.md
      (Constitution P8 / P16)

  Constitution (principles relevant to this slice)
    - Principle II — no floats for money
    - Principle III — contextIsolation: true, nodeIntegration: false,
      sandbox: true preserved
    - Principle V — TypeScript strict; no unjustified `any`
    - Principle VI — test-first; coverage thresholds honoured
    - Principle VIII — Clerk-only IdP; local unlock factors honour
      the six rules of the v1.5.1 clarification
    - P1 — financial correctness first
    - P2 — no fake success states
    - P3 — no silent data loss
    - P4 — auditability (append-only events for money-bearing state)
    - P5 — idempotency for retried operations
    - P6 — no raw cardholder data
    - P7 — secrets never reach renderer or logs
    - P10 — operator accountability for sensitive actions
    - P12 — Spec Kit artefacts are source of truth
    - P13 — small scoped implementation PR
    - P14 — accessibility + 44 × 44 touch targets
    - P16 — feature scope discipline
    - P17 — privacy and tenant isolation

  UI / a11y (when the slice ships UI)
    - 007 Guard 1 — token additivity (no removed CSS custom properties)
    - 007 Guard 2 — TakeoverPrompt forbidden strings
    - 007 Guard 3 — Cashier-Forbidden Information walling
    - 007 Guard 4 — PIN dot-only markup
    - 007 Guard 5 — no prefers-color-scheme, no .dark tree
    - Design system rules: One-Accent, Status-Color Containment,
      No-Second-Font, Tight-Display, Flat-By-Default, Single-Primary,
      No-Nested-Cards, Persistent Banner

  Security spot-check
    - No sensitive IDs in renderer DOM
    - No PII / cards in logs (Pino redaction reviewed)
    - No card data anywhere outside payment-feature scope
    - No cross-tenant query
    - No new public API without authentication

  Test plan
    - Test-plan checklist in PR body is verifiable
    - Manual smoke items, if listed, are reasonable

Produce review feedback in three buckets:
  - Blockers (CRITICAL / HIGH) — request changes; cite the rule
  - Suggestions (MEDIUM / LOW) — note as comments
  - Praise — name what the slice did well

Stop condition: emit the review and stop. Do not approve / merge /
close the PR. The owner decides.
```

## Template 5 — Closeout

**Use when:** the slice merged. You want the durable record.

```text
You are Claude Code working in the POS-Pulse repo on main.

Goal: produce the Maestro closeout for <feature-id> Slice <N>,
PR #<NNN>, merged at SHA <SHA> on <date>.

Read:
  the merged PR's body and diff
  specs/<feature-id>/coordination.md
  specs/<feature-id>/tasks.md  (rows in scope)
  the Maestro preflight notes (if available)

Produce the closeout report per docs/maestro/report-schema.md:

  1. Identification
  2. Gate verdict (entering vs leaving)
  3. Task ledger
  4. Files touched (created, modified, untouched-and-confirmed)
  5. Validation evidence
  6. Marks summary
  7. Security invariants honoured
  8. Deferred / follow-up (issues + analyze suggestions)
  9. Suggested next step
  10. Run notes

Place the closeout report in the PR description (already merged —
add as a final comment if the description is locked).

Optional: update specs/<feature-id>/coordination.md with a one-line
pointer to the merged PR under the slice's row. Do not copy the
full report into coordination.md.

Optional: tick the T### state marks in tasks.md from `[ ]` to
`[x]` for the tasks this slice completed. Tick only — do not
modify descriptions, IDs, [P] markers, or [US?] labels.

If this slice cleared a gate (e.g. §A3 migrations landed), record
the clearance in coordination.md's Gate ledger with the merge SHA
and the date.

Stop condition: closeout report is in the PR. coordination.md
update (if any) is committed to a small docs-only commit on main
or a docs branch — the owner decides. tasks.md update (if any) is
in the same docs-only commit. Then STOP. Do not start the next
slice.
```

---

## How the five templates compose

A complete slice cycle typically uses templates 1, 2, 3 (zero or more
iterations), 4, and 5 in that order — each in its own focused
session. The owner inserts a decision moment between each.

```text
[Template 1: Preflight]  →  owner reviews verdict and worklist
        ↓
[Template 2: Implementation]  →  owner reviews PR
        ↓
[Template 3: Validation/fix]  (iterated if needed)
        ↓
[Template 4: PR review]  →  owner decides to merge
        ↓
(merge happens)
        ↓
[Template 5: Closeout]  →  owner reads the closeout
        ↓
(stop until next slice)
```

This is consistent with Constitution P13 (small scoped PRs) and with
the common rules' agent-dispatch posture (ASK, don't auto-dispatch).

## How to skip a template

Each template is optional in principle. In practice:

- **Skip Template 1** when the slice is ≤ 5 tasks and the gates are
  obvious. Go straight to Template 2 with a minimal scope
  statement.
- **Skip Template 3** when validation comes back green on the first
  try. (This is the goal.)
- **Skip Template 4** when the owner self-reviews. (Most slices.)
- **Never skip Template 5.** Closeout is the next person's read.

## Quick prompts and execution ledger templates

For shorter copy-paste invocations of the five template operations above, see
`docs/maestro/quick-prompts.md`. Those prompts are deliberately terse — they
reference these full templates rather than duplicating their stop conditions.

The following optional artefacts complement the five templates when tracking
execution state across parallel waves or multiple slices:

- `docs/maestro/slice-schema.yaml` — YAML schema for one execution slice;
  use as a reference when filling in an execution map.
- `docs/maestro/templates/execution-map.yaml` — per-spec execution map;
  tracks dependency graph references, parallel-safe groups, finding-driven
  pivots, merged slice metadata, and blocked slice metadata.
- `docs/maestro/templates/wave-status.md` — human-readable per-wave status;
  useful when handing off between sessions or reviewers.
- `docs/maestro/templates/post-merge-closeout-prompt.md` — reusable agent
  prompt for the closeout step (Template 5 above); embeds all stop conditions
  and forbidden-scope reminders.

These artefacts are templates only — they carry no authority and do not replace
`tasks.md`, `coordination.md`, Spec Kit, or any gate — until copied into a
specific spec folder by an approved process task.

## Anti-patterns to avoid

1. **Concatenating Templates 1 + 2 + 3 + 4 + 5 into one prompt.**
   That removes the decision moments. The whole point of separate
   templates is so the owner can change direction between steps.
2. **Pasting Template 2 without the explicit allowed-paths and
   forbidden-paths lists.** A vague "implement the slice" prompt
   risks scope creep. Always paste the lists.
3. **Reusing Template 4 (PR review) on your own work.** The PR
   reviewer role exists for independence. If the same agent
   implemented and reviewed, label the review as a self-check and
   route the PR to a separate reviewer (human or fresh agent).
4. **Skipping the stop conditions.** Each template ends with an
   explicit "stop after X." Removing those lines is the most common
   source of agents that go too far.
