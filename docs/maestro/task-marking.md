# Maestro Task Marking

> Maestro adds **execution-state marks** on top of `tasks.md`. The marks
> live in the Maestro working notes (preflight log, closeout report) —
> NOT inside `tasks.md`. Source-author intent in `tasks.md` is preserved
> verbatim.

## What Maestro never changes in `tasks.md`

These properties are **owned by Spec Kit** and Maestro does not edit
them:

1. **Task order.** The numeric sequence T001 → T002 → … is the
   spec author's planning sequence. Maestro reads it; the closeout
   report ticks `[ ] → [x]` on completed rows, but the order on disk
   is unchanged.
2. **Task IDs.** `T020`, `T034`, `T070a` (suffix infill) — IDs are
   stable across analyse iterations. Maestro never invents a new ID.
   If a follow-up is needed that doesn't fit any existing row, file an
   issue or request `/speckit-analyze` re-run. Maestro does not assign
   `T999`.
3. **`[P]` markers.** Maestro **may downgrade** the effective parallel
   safety of two `[P]` tasks during execution (when a file-conflict
   graph reveals they edit the same file), but the source marker in
   `tasks.md` is left as the author wrote it. The downgrade lives in
   the Maestro preflight log, not in the spec.
4. **`[US?]` story labels** and **`[BLOCKED:gate]` qualifiers.** Read
   verbatim.
5. **Task descriptions and file-path proposals.** If the file-path
   proposal turns out to be wrong (e.g. tasks.md says
   `CartHandoffButton.tsx` but the actual continue affordance lives in
   `HandoffSummary.tsx`), Maestro treats the description as advisory
   and the runtime reality as authoritative — but the spec text is
   left untouched. The mismatch is flagged in the closeout for the
   next `/speckit-analyze`.

## The seven Maestro marks

These describe a task's execution state inside the Maestro run. They
are written to the preflight log, the worklist tracker, and the
closeout report — never to `tasks.md` itself.

### `ready`

The task may begin **right now**.

Conditions, all of which must hold:

- The slice's blocking gates are ✅ open (workflow §3 verdict = GO for
  the gates this task touches).
- All upstream dependency-graph predecessors are `completed` (workflow
  §5).
- The task is not the `[BLOCKED:<gate>]` qualifier in `tasks.md`.
- The task's tests-first half (Constitution VI) has either been
  written already or is the current task.

A `ready` task is fair game for an agent to pick up.

### `blocked`

The task exists in the worklist but **cannot start**.

Reasons for `blocked`:

- A dependency-graph predecessor is still `in-progress` or `ready` (i.e.
  hasn't completed).
- A gate the task touches is ⛔ Held — e.g. a Slice 3 task that needs
  §A2 backend endpoints, when §A2 has not yet cleared.
- A `[BLOCKED:<gate>]` qualifier is still present in `tasks.md`.
- An external dependency hasn't merged (e.g. a backend OpenAPI bump
  the codegen waits on).

`blocked` is the **temporary** state. When the blocker clears, the
mark transitions to `ready`.

### `parallel-safe`

Two or more tasks that may execute concurrently with each other under
this Maestro run.

Conditions, all of which must hold:

- All are `ready`.
- No two of them edit the same file (file-conflict graph clean — see
  `graph-rules.md §File-conflict graph`).
- They live on the same process boundary (all renderer OR all main OR
  all preload). Mixed-boundary work runs sequentially because it
  almost always implies a contract change.
- None of them needs another's intermediate result to validate (rare,
  but real).

A `parallel-safe` group can be dispatched to multiple Implementation
Agents — **subject to the "When NOT to use multiple agents" red flags
in `agent-roles.md`**. In practice, single-agent execution of a
`parallel-safe` group is almost always cheaper than multi-agent
coordination on a small slice.

### `sequential`

Tasks that **must** be executed one after another within the worklist
order.

Reasons for `sequential`:

- An explicit dependency-graph edge (one task creates a file the next
  modifies).
- A file-conflict edge — both tasks modify the same file, regardless
  of `[P]` marker.
- A wiring chain — task A adds a prop, task B consumes it. Splitting
  the chain across agents breaks the chain of thought.

`sequential` is the **conservative** default. Maestro upgrades to
`parallel-safe` only when the file-conflict graph is clean.

### `same-file-risk`

A flag, applied during step 7 of the workflow, marking two or more
tasks that both edit the same file even though they are marked `[P]`
in `tasks.md`.

When this flag fires:

- The `[P]` marker in `tasks.md` is **respected** as the author's
  intent but **overridden** for execution.
- The flagged tasks become `sequential` for this Maestro run.
- The closeout report records the downgrade, the file, and the
  reason — so the next `/speckit-analyze` can decide whether to edit
  the source `[P]` or accept the run-time downgrade.

### `needs-owner-approval`

The task is `ready` from a graph perspective but touches scope the
slice owner should explicitly approve before the agent proceeds.

Triggers:

- The slice's allowed-paths list is narrow and the task brushes a
  sensitive surface (bridge, main, preload, migration, OpenAPI).
- A file the task modifies is on the slice's "modify with care" list
  (e.g. `HandoffSummary.tsx` for a 006 Slice 1 task — it's the cart's
  exit affordance and 005 ships tests against its disabled state).
- The task's description includes "consider whether minimal change to
  X is needed" — i.e. the source author hedged.
- A previous slice's `coordination.md` carries a deferred item that
  this task may touch.

When `needs-owner-approval` fires, Maestro **stops and asks** the
owner, exactly as the agent-dispatch rule prescribes. The agent does
not autonomously decide. The mark clears to `ready` once the owner
approves.

### `forbidden-scope`

The task description (or its file-path proposal) implies a change in
the slice's forbidden-scope list.

When this fires:

- The task does NOT execute under this Maestro run.
- The closeout report flags the conflict for `/speckit-analyze`.
- The owner decides whether to (a) edit the task description, (b)
  re-scope the slice via a new spec cycle, or (c) defer the task to a
  future feature that legitimately owns the surface.

`forbidden-scope` is the **fail-loud** mark. A task that hits it must
never silently slip into the worklist. If it does, the Scope Guard
role (see `agent-roles.md §3`) refuses to ship the diff.

---

## How marks layer onto `[P]`

```
tasks.md row:        - [ ] T021 [P] [US1] Unit test: TenderSelection — tests/unit/...
                              ^^^
                              source author intent: parallelisable

Maestro working notes (preflight log):

  T021 — ready, parallel-safe with {T020, T022, T023, T024, T034}
  Same files: none
  File-conflict downgrade: none
  Owner approval needed: no
  Scope check: ✅ allowed-paths list — tests/unit/renderer/payments/
```

vs.

```
tasks.md row:        - [ ] T031 [P] [US3] Modify CartHandoffButton.tsx ...

Maestro working notes:

  T031 — needs-owner-approval
  Reason 1: file-path proposal mismatch — CartHandoffButton.tsx does not
            exist on this commit; the actual continue affordance lives in
            HandoffSummary.tsx + CartPane.tsx (chained wiring).
  Reason 2: HandoffSummary.tsx is referenced by 005's existing tests; a
            change must preserve the "disabled when no onContinue" assertion
            on line 267 of handoff-summary.test.tsx.
  Recommendation: treat tasks.md filename as advisory; modify
                  HandoffSummary.tsx (add optional onContinue prop) +
                  CartPane.tsx (spread onContinue when paymentsFlag on)
                  with the minimal diff that keeps existing tests passing.
  Owner verdict: ✅ approved (recorded in /goal output 2026-05-21)
```

The source row in `tasks.md` is untouched. The Maestro working notes
carry the runtime reality.

---

## What gets written back to `tasks.md`

Only one thing: the **state mark transition** `[ ] → [x]` on a
completed row, at closeout time.

```diff
- - [ ] T020 [P] [US1] Unit test: TenderSelection — refuses to render without envelope
+ - [x] T020 [P] [US1] Unit test: TenderSelection — refuses to render without envelope
```

Everything else — task ID, `[P]`, `[US?]`, description, file path —
is left exactly as the source author wrote it.

---

## What about `/speckit-analyze` follow-ups

If Maestro's run produced findings that `/speckit-analyze` should
absorb — e.g. a `[P]` marker that the file-conflict graph
sequentialised, or a file-path proposal that was inaccurate — the
**closeout report** lists them as **suggestions for the next
analyze**. Maestro does not run analyze; the next time the team
invokes `/speckit-analyze`, those findings inform the suffix-infill
decisions.

This keeps Maestro's role contained: it executes, it reports, it does
not re-spec.
