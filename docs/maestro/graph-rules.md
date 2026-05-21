# Maestro Graph Rules

> Three graphs Maestro extracts from `tasks.md` and the slice's
> allowed-paths list. The graphs are advisory at the source-spec layer
> and **load-bearing at execution time** — they decide what runs, in
> what order, and what gets dispatched concurrently.

## The three graphs

### Graph 1 — Dependency graph

The "what waits on what" graph. A directed acyclic graph (DAG) over
the worklist.

**Edges** (task A → task B means B waits on A):

1. **Explicit `depends on T###` clause** in `tasks.md`. Authoritative.
2. **TDD pair (Constitution VI).** Every implementation task waits on
   its corresponding test task. The test task description usually
   begins with "Unit test:" / "Integration test:" / "Contract test:"
   and shares the `[US?]` label.
3. **File-create-then-modify.** Task A creates `src/foo.tsx`; task B
   modifies it. B → A is an edge.
4. **Export-then-consume.** Task A exports `X` from a module; task B
   imports `X`. B → A is an edge.
5. **Type-then-implement.** Task A adds the type definition; task B
   uses it. B → A is an edge. (Often collapses to edge type 3 or 4 in
   practice.)
6. **Gate-conditional sequence.** A task labelled `[BLOCKED:gate-foo]`
   waits on the gate-clear event, not on another task. Modeled as a
   sentinel node (the gate) rather than a task-to-task edge.

**No edge** for: a task that *might* benefit from another task's
output but doesn't strictly require it. Maestro keeps the graph
minimal; over-edging produces false sequentialisation.

**Cycle detection.** If the graph isn't acyclic, the worklist is
misread. Re-read `tasks.md` rather than dropping an edge. Common
misreads: confusing two tasks with similar IDs (`T079` vs. `T097`),
or missing a `[BLOCKED:gate]` qualifier.

### Graph 2 — Parallel-safe graph

The "what can run together" graph. Derived from Graph 1 by inversion,
then filtered by Graph 3.

**Two tasks are parallel-safe** when **all** of:

- Neither depends on the other in Graph 1 (transitively).
- They do not share a file-conflict edge in Graph 3.
- They live on the same process boundary (renderer / main / preload).
- Neither needs the other's output to validate.

The result is a partial order; the parallel-safe groups are the
antichains.

Maestro reports groups, not individual pairs. Example:

```
Parallel batch 1: { T020, T021, T022, T023, T024, T034 }
  All renderer-only; all create new test files in
  tests/unit/renderer/payments/; no shared files; no inter-test deps.
  → may dispatch concurrently if the agent dispatch rules permit.

Parallel batch 2: { T026, T027, T028 } depending on { T020, T021, T022 }
  Three implementation files in src/renderer/ui/payments/; no shared
  files among themselves; each depends on its corresponding test.
  → may dispatch concurrently after batch 1 completes.

Sequential: { T030, T031 }
  T030 creates src/renderer/stores/payment-store.ts; T031 modifies
  CartPane.tsx + HandoffSummary.tsx, which require T030's mount() API.
  → run after batches 1 and 2.
```

### Graph 3 — File-conflict graph

The "which tasks edit the same file" graph. Undirected.

**Edges** between tasks A and B when both **modify** the same file.
(A create-then-modify pair is a Graph 1 edge, not a Graph 3 edge —
the file doesn't exist until A runs.)

Building Graph 3 requires resolving each task to a set of
**actually-touched files**:

1. The file-path proposal in the task description.
2. Any file the description implies but does not name (e.g. "extend
   `useFeatureFlagsStore`" implies modifying
   `src/renderer/stores/feature-flags-store.ts`).
3. The test file paired with the implementation task (Constitution VI).
4. Type files the task adds or extends.

When the file-path proposal is wrong (Spec Kit's author guessed a
filename that doesn't match runtime reality), Graph 3 uses the
runtime reality. The mismatch is flagged for `/speckit-analyze`
(`task-marking.md §What gets written back to tasks.md`).

---

## How `[P]` interacts with the graphs

`[P]` in `tasks.md` is the **source author's claim** of parallel
safety. It is **input** to Graph 2, not the output.

Maestro:

1. **Trusts `[P]` as a hint.** A task marked `[P]` is a candidate for
   the parallel-safe graph.
2. **Verifies against Graph 1.** A `[P]` task that has a hidden
   dependency on another `[P]` task in the same batch is reclassified
   as sequential. The `[P]` marker stays in `tasks.md` (we don't edit
   source); the runtime decision goes into the preflight log.
3. **Verifies against Graph 3.** Two `[P]` tasks that edit the same
   file are reclassified as sequential under the `same-file-risk`
   flag (see `task-marking.md`).

### Worked example — `[P]` downgrade

```
tasks.md (source — unchanged):

  - [ ] T040 [P] [US2] Implement cart.lines.add — src/main/cart/handlers/add-line.ts
  - [ ] T041 [P] [US2] Implement cart.lines.remove — src/main/cart/handlers/remove-line.ts

Maestro analysis:

  T040 and T041 share `[P]`.
  Files: src/main/cart/handlers/add-line.ts and remove-line.ts — different files.
  Both depend on T030 (cart-store skeleton in src/main/cart/cart-store.ts) — same predecessor.
  No file-conflict edge.
  No same-process side-effect that one observes the other through.

  Verdict: parallel-safe. Both can run after T030.
```

Now compare:

```
tasks.md (source — unchanged):

  - [ ] T050 [P] [US3] Wire cart.subscribe in main — src/main/cart/index.ts
  - [ ] T051 [P] [US3] Wire cart.handoff in main — src/main/cart/index.ts

Maestro analysis:

  T050 and T051 share `[P]`.
  Files: BOTH modify src/main/cart/index.ts.
  → File-conflict edge in Graph 3.
  → same-file-risk fires.
  → reclassified as sequential.

  Verdict: T050 → T051 (or vice versa — pick the worklist order).
           [P] in tasks.md is preserved; the downgrade lives in the
           Maestro preflight log for closeout reporting.
```

---

## Process-boundary edges

A task that crosses the renderer ↔ preload ↔ main boundary is
**sequentialised** with any other task that touches the contract
between the two processes — even if Graphs 1 and 3 are clean.

The reason: the typed bridge surface (`src/shared/bridge-api.ts`) is
the integration seam. Two agents racing on bridge changes produce
type errors that are hard to diagnose because one half passes
typecheck and the other half assumes a future state.

Practical rule:

- **Single agent** for any slice that adds a bridge call.
- **Multiple agents** only for slices that are renderer-only OR
  main-only with no shared-bridge edit.

This is consistent with Constitution P8 (Electron security boundary —
explicit security review on bridge changes).

---

## The "small slice" escape hatch

For a slice of ≤ 10 tasks, the graph-extraction overhead frequently
exceeds the value. The conservative move is:

- Single agent.
- Sequential execution in `tasks.md` order.
- Skip Graph 2; treat the whole worklist as sequential by default.

This is exactly how the 006 Slice 1 (T020–T034, 14 tasks, all
renderer-only) was actually executed in practice: one agent, sequential
order, no multi-agent dispatch. The slice shipped in a single PR with
100 % coverage on the new modules.

The graphs become valuable above ~15 tasks, or when the worklist
spans multiple file directories with low inter-task coupling.

---

## Anti-patterns to avoid

1. **Inventing edges to justify a desired execution order.** If a task
   could run earlier and you sequentialise it on a vibe, the graph
   lies. Either find the real edge or accept the parallel grouping.
2. **Suppressing same-file-risk because "the agent will be careful."**
   Two agents on the same file produces lost work, not careful work.
   Sequentialise.
3. **Re-edging on every analyse.** Graph 1 is rebuilt from the current
   `tasks.md` and the slice's allowed-paths list at preflight time.
   It is NOT a persistent artefact. Each Maestro run produces its own
   graphs.
4. **Modeling `[BLOCKED:gate]` as a task dependency.** It isn't — the
   gate is a sentinel node. Modeling it as a task edge can cause
   false transitive dependencies on completed tasks that share the
   gate.
5. **Building Graph 3 from `tasks.md` descriptions alone.** The
   descriptions sometimes name a planned file that turns out wrong at
   runtime (e.g. `CartHandoffButton.tsx` in 006 vs.
   `HandoffSummary.tsx` actually-modified). The graph uses the
   runtime reality. The mismatch flows back to `/speckit-analyze`.

---

## Quick check (for a slice you're about to execute)

```
□ Did I list every task ID in scope, in tasks.md order?
□ Did I draw Graph 1 edges from explicit clauses, TDD pairs,
  create-then-modify, export-then-consume, type-then-implement?
□ Did I verify Graph 1 is acyclic?
□ Did I list every file each task touches (proposal + runtime reality)?
□ Did I derive Graph 3 from that file list?
□ Did I downgrade any [P] pair that shares a file in Graph 3?
□ Did I confirm process-boundary edges?
□ Did I produce the parallel-safe groups (Graph 2 antichains)?
□ Did I record the marks (ready / blocked / parallel-safe /
  sequential / same-file-risk / needs-owner-approval / forbidden-scope)
  in the preflight log?
□ Did I check whether the small-slice escape hatch applies?
```

If you cannot tick every box, the slice isn't ready to execute under
Maestro. Re-read `tasks.md` until you can.
