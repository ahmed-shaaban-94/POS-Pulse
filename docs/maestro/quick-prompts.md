# Maestro Quick Prompts

> Short copy-paste prompts for common Maestro operations.
> Each prompt is self-contained for a fresh session.
> For full context on each step, follow the references — these prompts summarise,
> they do not duplicate, the detailed docs in `docs/maestro/`.

---

## 1. Preflight

**When to use:** before any implementation begins. You have a slice ready and want a
gate-verdict + task-extraction + graph-build pass. No code is touched.

**Files to read:** `docs/maestro/workflow.md` §0–7, `docs/maestro/graph-rules.md`,
`docs/maestro/task-marking.md`, `specs/<feature-id>/coordination.md`,
`specs/<feature-id>/tasks.md`.

**Stop condition:** emit the preflight output (gate verdict, task worklist, dependency
graph, file-touch map, parallel-safe groups, Maestro marks, dispatch recommendation)
and stop. Do not auto-proceed to implementation.

**Forbidden scope reminder:** no code written, no `tasks.md` modified, no files staged.

```text
Use Maestro.
Goal: preflight for <feature-id> Slice <N>.
Read: docs/maestro/workflow.md, docs/maestro/graph-rules.md,
      docs/maestro/task-marking.md,
      specs/<feature-id>/coordination.md,
      specs/<feature-id>/tasks.md
Produce: gate verdict, task worklist, dependency graph, file-touch map,
         parallel-safe groups, Maestro marks, dispatch recommendation.
Output only. Stop before implementation.
```

---

## 2. Execute approved slice

**When to use:** preflight is approved, gates are open, owner has confirmed dispatch
posture, and the slice is cleared to start.

**Files to read:** `docs/maestro/workflow.md` §8–11, `docs/maestro/agent-roles.md`,
`docs/maestro/error-routing.md`, `specs/<feature-id>/tasks.md`,
`specs/<feature-id>/coordination.md`.

**Stop condition:** open one PR against `main`, produce the closeout report per
`docs/maestro/report-schema.md`, then stop. Do not merge, do not start the next slice.

**Forbidden scope reminder:** stage only named files (`git add <file>` — never
`git add -A`). Forbidden scope listed in the preflight allowed-paths / forbidden-paths
lists is non-negotiable. Any unexpected migration, OpenAPI, bridge, or IPC need is an
immediate stop — route through `docs/maestro/error-routing.md` §7.

```text
Use Maestro.
Goal: implement <feature-id> Slice <N>, tasks <T### … T###>.
Preflight approved on <date>. Gate verdict: GO.
Allowed: <list from preflight>
Forbidden: <list from preflight>
Branch: <feat|fix|refactor>/<feature-id>-slice-<N>-<short-purpose>
TDD: test RED before impl. Stage named files only.
Stop after opening PR. Produce closeout per docs/maestro/report-schema.md.
```

---

## 3. Schedule group

**When to use:** you have a confirmed parallel-safe group (from the preflight's
parallel-safe groupings in `docs/maestro/graph-rules.md`) and want to assign tasks
to concurrent batches before dispatching agents.

**Files to read:** `docs/maestro/graph-rules.md` (Graph 2 — parallel-safe graph,
and "The small-slice escape hatch"), `docs/maestro/agent-roles.md`
§"When NOT to use multiple agents", `docs/maestro/task-marking.md` §`parallel-safe`.

**Stop condition:** produce the group schedule (batch list with task IDs, dependency
order, agent assignments) and stop. Do not dispatch agents; present options A/B/C/D
to the owner per the ASK-don't-auto-dispatch rule.

**Forbidden scope reminder:** if any task in the group touches `src/main/`,
`src/preload/`, `src/shared/bridge-api.ts`, migrations, OpenAPI, or CI, the group
is not parallel-safe — collapse to a single agent.

```text
Use Maestro.
Goal: schedule parallel-safe group for <feature-id> Slice <N>.
Group task IDs: <T###, T###, ...>
Read: docs/maestro/graph-rules.md, docs/maestro/agent-roles.md
Confirm: no shared files, same process boundary, no cross-validation deps.
Produce: batch schedule with dependency order and agent assignment options.
ASK owner before dispatch. Stop before any implementation.
```

---

## 4. Closeout

**When to use:** the slice has merged. You want the durable closeout record.

**Files to read:** `docs/maestro/report-schema.md`, `docs/maestro/templates/post-merge-closeout-prompt.md`,
`specs/<feature-id>/coordination.md`, `specs/<feature-id>/tasks.md`, the merged PR body and diff.

**Stop condition:** closeout report is produced (PR comment or description), permitted
artefacts are updated, then stop. Do not start the next slice.

**Forbidden scope reminder:** the only permitted `tasks.md` change is
`[ ]` → `[x]` state marks. Do not modify task descriptions, IDs, `[P]` markers,
`[US?]` labels, or gates. Never `git add -A`.

```text
Use Maestro.
Close out PR #<PR_NUMBER>.
Spec: specs/<feature-id>
Expected slice: <SLICE_ID>
Read: docs/maestro/report-schema.md,
      docs/maestro/templates/post-merge-closeout-prompt.md,
      specs/<feature-id>/coordination.md,
      specs/<feature-id>/tasks.md
Update only approved status artifacts.
Stop before commit.
```

---

## 5. PR review

**When to use:** the slice has an open PR and you want an independent review pass
against the constitution, the slice spec, and the visual reference.

**Files to read:** `docs/maestro/goal-templates.md` Template 4 (PR review),
`docs/maestro/error-routing.md`, `.specify/memory/constitution.md`, `CLAUDE.md`,
`specs/<feature-id>/spec.md`, `specs/<feature-id>/tasks.md`,
`specs/<feature-id>/coordination.md`, and `gh pr diff <NNN>`.

**Stop condition:** emit review feedback (blockers / suggestions / praise) and stop.
Do not approve, merge, or close the PR. The owner decides.

**Forbidden scope reminder:** review only — read the diff, produce feedback. No code
changes, no `tasks.md` edits, no staging.

```text
Use Maestro.
Goal: independent PR review for <feature-id> Slice <N>, PR #<NNN>.
Read: docs/maestro/goal-templates.md (Template 4),
      .specify/memory/constitution.md, CLAUDE.md,
      specs/<feature-id>/spec.md,
      specs/<feature-id>/tasks.md (rows T### … T###),
      specs/<feature-id>/coordination.md,
      gh pr diff <NNN>
Produce: review feedback — blockers (CRITICAL/HIGH), suggestions (MEDIUM/LOW), praise.
Stop after emitting feedback. Do not approve or merge.
```
