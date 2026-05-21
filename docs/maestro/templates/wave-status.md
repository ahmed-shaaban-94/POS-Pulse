# Wave Status — `<SPEC_ID>` / Wave `<WAVE_N>`

> **This file does not replace `tasks.md` or `coordination.md`.**
> It is an optional, human-readable execution-state helper. Source of truth for
> requirements is `spec.md`; source of truth for gate state is `coordination.md`;
> source of truth for the executable task list is `tasks.md`.

---

## Status header

| Field | Value |
|:--|:--|
| Spec | `<SPEC_ID>` |
| Wave | `<WAVE_N>` |
| Date | `<ISO-DATE>` |
| Baseline SHA | `<SHA>` |
| Overall status | `<pending \| in-progress \| completed \| blocked \| stopped>` |

---

## Source of truth

Read in this order before acting on anything in this file:

1. `.specify/memory/constitution.md` — constitution (pinned version: `<VERSION>`)
2. `CLAUDE.md` — hard rules, useful commands
3. `specs/<spec>/coordination.md` — gate ledger and phase status
4. `specs/<spec>/tasks.md` — executable task list (`T###` IDs)
5. `specs/<spec>/spec.md` — requirements source-of-truth

---

## Merged

Slices merged to `main` before this wave:

| Slice | PR | SHA | Date |
|:--|:--|:--|:--|
| `<SLICE_ID>` | `#<NNN>` | `<SHA>` | `<YYYY-MM-DD>` |

---

## Local only

Slices in-progress on a branch (not yet merged):

| Slice | Branch | Status |
|:--|:--|:--|
| `<SLICE_ID>` | `<branch-name>` | `<in-progress \| ready-to-open-pr>` |

---

## Active findings

Findings raised during this wave that affect execution scope or ordering.
See `docs/maestro/error-routing.md` for routing by class.

| ID | Type | Task | Detail | Action | Status |
|:--|:--|:--|:--|:--|:--|
| `F001` | `<type>` | `T###` | `<one-line description>` | `<stop \| escalate \| continue-with-note \| defer-to-analyze>` | `<open \| resolved \| deferred>` |

---

## Blocked

Tasks or slices currently blocked, with the blocking reason.

| Task / Slice | Blocked by | Resolution path |
|:--|:--|:--|
| `T###` | `<gate-id \| upstream-task \| external-PR>` | `<what must happen to unblock>` |

---

## Ready

Tasks ready to start right now (all gates open, all dependencies completed).

| Task ID | Source `[P]` | Maestro mark | Notes |
|:--|:--:|:--|:--|
| `T###` | `[P]` | `parallel-safe` | |
| `T###` | — | `ready` | |

---

## Proposed groups

Parallel-safe groups derived from the file-conflict graph
(see `docs/maestro/graph-rules.md`).
Groups are proposals only; agent dispatch requires owner confirmation.

| Group | Task IDs | Depends on |
|:--|:--|:--|
| `batch-1` | `T###, T###` | — |
| `batch-2` | `T###, T###` | `batch-1` |

---

## File-conflict notes

`[P]` tasks downgraded to sequential due to shared files.
Source `[P]` markers in `tasks.md` are preserved verbatim; downgrades are
recorded here for the next `/speckit-analyze` cycle.

| Tasks | Shared file | Reason | Downgrade decision |
|:--|:--|:--|:--|
| `T### ↔ T###` | `<path/to/file>` | Both modify same file | Sequential for this run |

---

## Parallel-safe notes

Confirmed parallel-safe pairs or groups (no shared files, same process boundary,
no cross-validation dependency):

- `T###` and `T###` — different files, both renderer-only, no inter-test deps.

---

## Validation posture

| Check | Last result | Notes |
|:--|:--:|:--|
| `npm run typecheck` | `<pending \| ✅ \| ❌>` | |
| `npm run lint` | `<pending \| ✅ \| ⚠ OOM → fallback>` | |
| `npx vitest run` | `<pending \| ✅ \| ❌ N failures>` | |
| Coverage on new modules | `<pending \| ✅ \| ❌ below threshold>` | |

---

## Next recommended action

<!-- One concrete next step. Not a list. Not a roadmap. -->

`<single next action — e.g. "Open slice N once §AN clears." or "Wait on PR #NNN to merge.">`

---

## Next short Maestro prompt

Paste into a fresh session to continue this wave:

```text
Use Maestro.
Spec: <SPEC_PATH>
Wave: <WAVE_N>
Current status: <copy Status header summary>
Read: specs/<SPEC_ID>/coordination.md, specs/<SPEC_ID>/tasks.md
Gate verdict: <GO | STOP | CONDITIONAL — condition: <CONDITION>>
Next tasks: <T###, T###>
Stop before commit.
```

---

## Post-merge closeout

When the wave's final slice merges:

1. Fill in `## Merged` with the PR number, SHA, and date.
2. Update `specs/<spec>/coordination.md` with the merge SHA under the slice's gate row.
3. Tick completed `[ ]` → `[x]` state marks in `specs/<spec>/tasks.md` — state mark only;
   do not modify task descriptions, IDs, `[P]` markers, or `[US?]` labels.
4. Record any deferred items as GitHub issues or `/speckit-analyze` suggestions.
5. File the full closeout report per `docs/maestro/report-schema.md` in the PR description.
6. Use `docs/maestro/templates/post-merge-closeout-prompt.md` as the agent prompt for step 5.
7. Stop. Do not start the next wave or slice without owner instruction.
