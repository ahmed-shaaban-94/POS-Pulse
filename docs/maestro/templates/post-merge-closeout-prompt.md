# Post-Merge Closeout Prompt

Reusable agent prompt for closing out a merged slice.
Paste into a fresh session and substitute the `<PLACEHOLDER>` values.

---

```text
Use Maestro.
Close out PR #<PR_NUMBER>.
Spec: <SPEC_PATH>
Expected slice: <EXPECTED_SLICE_ID>
Update only approved status artifacts.
Stop before commit.
```

---

## Instructions for the agent receiving this prompt

1. **Read the merged PR body and diff.**
   Use `gh pr view <PR_NUMBER>` and `gh pr diff <PR_NUMBER>`.
   Confirm the PR matches the expected slice (`<EXPECTED_SLICE_ID>`).

2. **Read the scoped `tasks.md` rows.**
   Read `<SPEC_PATH>/tasks.md`. Identify the task IDs (`T###`) covered by this slice.
   Do not read or modify tasks outside the slice's scope.

3. **Read `coordination.md`.**
   Read `<SPEC_PATH>/coordination.md`.
   Note the gate state and any deferred items.

4. **Update execution-map and wave-status only when those artefacts exist for the spec.**
   - If `<SPEC_PATH>/maestro/execution-map.yaml` exists, update:
     - The matching slice's `merged_in_pr`, `merged_at_commit`, `merged_at_date`.
     - `closeout.pr`, `closeout.sha`, `closeout.date`, `closeout.next_action`.
   - If `<SPEC_PATH>/maestro/wave-status.md` exists, update:
     - Move the slice from `## Local only` to `## Merged`.
     - Update `## Next recommended action` with a single concrete next step.
   - If neither artefact exists, skip this step — do not create them here.

5. **Do not modify task descriptions, task IDs, `[P]` markers, `[US?]` labels, or gates.**
   The only permitted `tasks.md` change is the state mark transition `[ ]` → `[x]` on
   completed rows. Nothing else in `tasks.md` is touched.

6. **Do not start the next slice.**
   This prompt is scoped to closeout only. Once the closeout report is produced and
   any permitted artefact updates are written, stop. The owner decides what runs next.

7. **Never use `git add -A` or `git add .`.**
   Stage only the specific artefact files you updated.
   Pre-existing dirty state in the working tree must remain unstaged.

---

## Output expected

- Closeout report per `docs/maestro/report-schema.md` (sections 1–10),
  placed in the merged PR as a comment if the PR description is already locked,
  or included in the PR body if it was not yet finalised.
- A short summary (≤ 100 words) of what was updated and what was skipped, returned
  as the agent's final message.
- No commits until the owner instructs.
