# Maestro Workflow

> The 13-step standard workflow for executing one slice (or a coherent
> subset of a slice's tasks) under Maestro. Each step has a clear input,
> a clear output, and a stop condition. None of the steps modify
> requirements, gates, or `tasks.md` content.
>
> **Step counting:** Step 0 is a pre-condition phase and is not counted
> in the 13 execution steps. The 13 steps are Step 1 through Step 13.

## Step 0 — Pre-conditions

Before invoking the workflow, confirm:

- The current feature's `coordination.md` shows the slice gate **open**
  (e.g. 005 §A2 ✅, 006 §A1 ✅). A held gate (⛔) is a stop.
- The active branch is `main` (or a designated integration branch) and is
  up-to-date with `origin/main`. If you're already on a feature branch
  from a previous run, finish or shelve that work first.
- You have authority from the owner to ship the slice (a PR will be
  opened against `main` at the end).

If any pre-condition fails, the answer is "do not start Maestro." The
remaining 13 steps assume all three hold.

## Step 1 — Repo verification

**Goal:** establish a known starting state.

```bash
git status --short
git branch --show-current
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline
```

Record the resulting SHA. This is the **baseline SHA**; closeout reports
cite it.

**Stop conditions:**
- Working tree is dirty with unrelated changes that you did not author.
  Investigate before continuing — never auto-stash.
- `git pull --ff-only` fails. Someone else's work conflicts; resolve
  upstream first.

## Step 2 — Spec intake

**Goal:** load the source-of-truth set for this slice.

Read, in this order:

1. `.specify/memory/constitution.md` — confirm the pinned version (e.g.
   v1.5.1) matches the version `tasks.md` cites. A mismatch is a flag,
   not an automatic stop, but it MUST be raised to the owner before
   shipping.
2. `CLAUDE.md` — hard rules, useful commands.
3. The active feature's `spec.md`, `plan.md`, `tasks.md`, and
   `coordination.md`. Read the **coordination first** — it tells you
   which gates are open, which are held, what was decided in the most
   recent clarification, and which PRs already merged.
4. For UI work: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`,
   and any per-feature `visual-direction/README.md`.
5. Any `contracts/` artefacts the current slice touches.

**Output:** a short mental model of "what changes, what doesn't, why."

## Step 3 — Gate verdict

**Goal:** produce a one-line verdict on whether the chosen slice is
startable.

Walk the `coordination.md §Gate ledger` table top-to-bottom. For each
gate, classify as one of:

- ✅ Open — the slice may proceed against this gate.
- ⛔ Held — the slice may NOT proceed if this gate blocks the slice's
  scope.
- ⏳ Deferred / rollout-only — open for slice merges, held for
  production rollout (e.g. §A5 across all features).

The verdict is **GO** only when every gate that blocks this slice is
either ✅ or ⏳ (rollout-only). One ⛔ on a blocking gate = STOP.

Record the verdict in the preflight notes. Worked example:

> **006 Slice 2 verdict (cash payment) — STOP.** §A0 ✅, §A1 ✅, but §A3
> ⛔ Held (the three new SQLite tables are not yet migrated) and §A4 ⛔
> Held (the `payments.*` + `tender.*` bridge surface review hasn't run).
> Slice 2 cannot start without the §A3 and §A4 reviewers signing off.
> Preflight may still be useful (task extraction, graph rules) but no
> implementation may begin.

## Step 4 — Task extraction

**Goal:** identify which `tasks.md` rows are in scope **for this run**.

This is **not** a re-write of `tasks.md`. It is a read-only extraction:

1. List the `T###` IDs the owner has asked you to ship (or the natural
   contiguous group implied by the current slice).
2. Preserve the existing task order and IDs from `tasks.md`. Do not
   renumber. Do not invent new IDs. If `/speckit-analyze` later finds a
   gap, that author uses the suffix infill convention (`T070a`,
   `T019a`, `T010b`); Maestro never invents.
3. Preserve `[P]` markers verbatim. Maestro may downgrade `[P]` during
   step 6 (file-conflict graph), but the source `tasks.md` is untouched.
4. Preserve `[US?]` story labels and `[BLOCKED:gate]` qualifiers.

**Output:** an ordered task list with the original IDs and metadata.
This becomes the worklist for steps 5–8.

## Step 5 — Dependency graph extraction

**Goal:** build the "what waits on what" graph for the worklist.

Read every task's row. A task depends on another when:

- It is preceded by an explicit `depends on T###` clause in `tasks.md`.
- It is a test-then-impl pair (Constitution VI). The impl task depends
  on its preceding test task.
- It edits a file that an earlier task creates.
- It modifies a file that an earlier task in the worklist also modifies
  (this also becomes a file-conflict edge — see step 7).

The dependency graph is a DAG. Cycles indicate a misread of `tasks.md`;
re-read before continuing.

**Output:** for each task, the set of other tasks it must follow.

## Step 6 — Parallel-safe graph extraction

**Goal:** identify which tasks can run concurrently with which.

Two tasks are **parallel-safe** when:

- Neither depends on the other (per step 5).
- They touch **different** files (per step 7's file map).
- Neither needs the other's output to validate (e.g. one test that
  asserts another component's behaviour).
- Both are renderer-only (or both are isolated to their respective
  process boundaries — see graph-rules.md §"Process-boundary edges").

The `[P]` marker in `tasks.md` is the source author's hypothesis about
parallel safety. Maestro **verifies** it against the actual file paths
the tasks edit; same-file `[P]` tasks are downgraded to sequential.

**Output:** the parallel-safe groupings. Each group is a "concurrent
batch."

## Step 7 — File-conflict graph

**Goal:** detect tasks that edit the same file and force them to
sequential order.

Walk the worklist. For each task, list the files it creates and
modifies (read the row description, the file-path proposal, and the
test/impl pair).

A **file-conflict edge** exists between tasks A and B when:

- A and B both **modify** the same file (creates do not conflict with
  modifies on the same file as long as the create happens first; that
  is a dependency edge, not a conflict edge).
- A and B both add new exports to the same module, and the second
  export depends on the first being committed (rare; usually a
  dependency edge in practice).

Same-file conflicts **always** override `[P]`. A pair marked `[P]` in
`tasks.md` that both edit `src/renderer/ui/cart/CartPane.tsx` is
sequential under Maestro, regardless of the source marker.

**Output:** the downgrade list — every `[P]` pair that Maestro is
sequentialising, with the file and the reason.

## Step 8 — Agent assignment

**Goal:** decide which work goes to which agent role (see
`agent-roles.md` for the role catalogue).

For each task or batch:

- If the work is a single isolated component or test → Implementation
  Agent OR Test Agent (per Constitution VI: tests first; the same role
  may own both within a contiguous block).
- If the work is renderer UI matching the visual reference → UI /
  Impeccable Agent.
- If the work needs `src/main/`, `src/preload/`, `src/shared/bridge-api.ts`,
  or a migration → **do not delegate to multiple agents.** Sensitive
  scope (Constitution P8). Run as a single agent under direct human
  supervision (see `agent-roles.md §When NOT to use multiple agents`).
- Validation and PR-review-readiness checks → Validation Agent and PR
  Reviewer.

**Default:** when scope is small (≤ 5 tasks) or unclear, use one agent
end-to-end. Multi-agent dispatch helps only when the work is genuinely
parallel and the surface area is low-risk.

## Step 9 — Implementation

**Goal:** write code, in worklist order, with tests first.

Execution rules:

1. **Branch off main**, not off another feature branch. Name:
   `<type>/<feature-id>-slice-<n>-<short-purpose>` —
   e.g. `feat/006-slice-1-payments-tender`. Never commit straight to
   `main` (Constitution P13 — small scoped PRs).
2. **Test first** — write the failing test, run it, see it red. Then
   implement, see it green. Constitution VI is non-negotiable.
3. **Stage only named files** — `git add <files>`, never `git add -A` or
   `git add .` (Constitution P13). Unrelated dirty files in the working
   tree stay unstaged.
4. **Run the changed-files lint subset** when full lint OOMs (this repo's
   ESLint occasionally OOMs on a full repo run — fall back to a
   targeted file list and document it in the closeout).
5. **Trust internal code, validate at boundaries** (CLAUDE.md). No
   defensive validation between two of the team's own modules.
6. **Money is integer minor units only**; `Number.isSafeInteger` guard
   at the boundary (Constitution II).
7. **No floats. No card data. No PII / cards in logs.** Constitution VI
   + P6 + P7 + P11.

**Output:** the worklist transitions from `ready` → `in-progress` →
`completed`, task by task. Same-file `[P]` downgrades execute
sequentially (per step 7).

## Step 10 — Validation

**Goal:** prove the slice is green before opening a PR.

Run, in order, on the feature branch:

```bash
npm run typecheck       # both tsconfigs — Constitution V (strict)
npm run lint            # eslint + prettier --check (may OOM; see fallback)
npx vitest run          # full suite — must not regress (Constitution VI)
# Coverage on modules added or modified by this slice:
npx vitest run <new-tests> --coverage --coverage.include=<src-paths>
```

Pass conditions (from `tasks.md` per-slice validation block, or from
`CLAUDE.md` defaults):

- **Typecheck:** clean on both `tsconfig.renderer.json` and
  `tsconfig.main.json` (and `tsconfig.preload.json` if touched).
- **Lint:** clean on the changed surface. If full lint OOMs, run on the
  files actually changed and record the fallback in the closeout.
- **Tests:** no regressions. Slice-specific tests pass. The
  `Money` module remains ≥ 95% covered. New surfaces hit the
  module-specific floor (renderer UI: 90% lines/statements/branches/
  functions — see existing per-module thresholds in `vitest.config.ts`).
- **Coverage on new code:** Constitution VI requires ≥ 80% overall; many
  modules already exceed this and ratchet upward.

Validation failures route through `error-routing.md`. Do not open a PR
on a red signal.

## Step 11 — PR review readiness

**Goal:** produce a PR that reviews well in one pass.

Before opening:

1. **Commit hygiene** — one commit per scoped change, or one
   well-described commit for a small scoped surface. `<type>:
   <description>` with `type ∈ {feat, fix, refactor, docs, test, chore,
   perf, ci}` (CLAUDE.md / common rules).
2. **PR body** cites the task IDs covered (Constitution P13). Describe
   what shipped, what is deferred, security invariants honoured, and
   the validation evidence. Include a test-plan checklist with manual
   smoke items the reviewer can verify.
3. **Diff scope** — every file in the diff is on the slice's allowed
   list. `src/main/`, `src/preload/`, `src/shared/bridge-api.ts`,
   `migrations/`, OpenAPI, CI, package files, lockfiles, AGENTS.md,
   CLAUDE.md MUST NOT appear unless this slice explicitly owns them
   (Constitution P8 / P16). If any do, stop and route through
   `error-routing.md §Forbidden file touched`.

## Step 12 — PR review

**Goal:** turn the green slice into a merged commit.

The PR Reviewer role (see `agent-roles.md`) walks the PR against:

- The constitution (I–IX, P1–P18) — at least the slice-relevant
  principles.
- The slice's exit criteria from `tasks.md` (e.g. "S5-a PR must show
  green axe smoke on all cart-pane states").
- The slice's gate row in `coordination.md` (e.g. §A4 ✅ implies the
  envelope contract is honoured).
- Spot checks: no secrets in renderer DOM, no PII in logs, no
  cross-tenant queries, no float arithmetic, no incidental bridge
  expansion.

Review feedback routes through `error-routing.md` by class (scope
creep → step back, a11y failure → fix-in-place, security finding →
stop and escalate).

## Step 13 — Closeout

**Goal:** make the next handoff easy.

Produce the closeout report against `report-schema.md`. Update
`coordination.md` with the merged PR's SHA, the date, and any
follow-up items (issues opened, deferred work). Update `tasks.md`'s
row state in-place (`[ ]` → `[x]`) — but **only the state mark**,
never the description, ID, or `[P]` marker.

If the slice clears a gate (e.g. §A3 migrations land), record the
clearance with the merge SHA in the gate ledger.

Finally: **do not push, do not open the next slice, do not start the
next feature** unless the owner has asked for that. Maestro's
contract is "one slice, end-to-end, then stop."
