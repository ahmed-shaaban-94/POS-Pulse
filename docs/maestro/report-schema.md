# Maestro Final Report Schema

> Every Maestro run ends with a closeout report. The report is the
> next person's first read — it answers "what happened, where are we,
> what's next" in one file.

The closeout report is written into the slice's PR description (and,
optionally, mirrored into `coordination.md` for durable record). It
follows a fixed schema so the next agent can find what they need
without scanning prose.

## Schema (Markdown)

```markdown
# Maestro Closeout — <Feature ID> Slice <N>

## 1. Identification

- **Feature:** <NNN-feature-name>  (e.g. 006-payments-tender)
- **Slice:** <Slice number + short title>  (e.g. Slice 1 — payments tender selection + envelope ingest)
- **Branch:** <branch name>  (e.g. feat/006-slice-1-payments-tender)
- **Baseline SHA:** <SHA at start of run>
- **Final SHA:** <SHA at end of run>
- **PR:** <PR URL + number>
- **Run date:** <ISO date>
- **Owner:** <user who approved the run>
- **Constitution version pinned:** <e.g. v1.5.1>

## 2. Gate verdict

| Gate | Status entering | Status leaving | Notes |
|:--|:--:|:--:|:--|
| §A0 | ✅ | ✅ | (unchanged) |
| §A1 | ✅ | ✅ | (unchanged) |
| §A2 | ⛔ Held | ⛔ Held | Held — slice does not depend on §A2 |
| §A3 | ⛔ Held | ⛔ Held | Held — slice does not depend on §A3 |
| §A4 | ⛔ Held | ⛔ Held | Held — slice does not depend on §A4 |
| §A5 | ⏳ Rollout-only | ⏳ Rollout-only | Unchanged |

If this slice **cleared** a gate, mark the new state and cite the
merge SHA.

## 3. Task ledger

| Task ID | Source `[P]` | Maestro mark | Final state |
|:--|:--:|:--|:--:|
| T020 | [P] | parallel-safe | ✅ |
| T021 | [P] | parallel-safe | ✅ |
| ... | ... | ... | ... |
| T031 | (none) | needs-owner-approval → ready | ✅ |
| T034 | [P] | parallel-safe | ✅ |

If a task was downgraded from `[P]` to sequential, name the file and
the reason in a row footnote.

## 4. Files touched

**Created (N):**
- `path/to/new/file.ts` — short purpose
- ...

**Modified (M):**
- `path/to/modified/file.ts` — short purpose

**Forbidden / out-of-scope (untouched, confirmed):**
- `src/main/**` — confirmed untouched
- `src/preload/**` — confirmed untouched
- `src/shared/bridge-api.ts` — confirmed untouched
- `migrations/**` — confirmed untouched
- `package.json` / `package-lock.json` — confirmed untouched
- CI workflows — confirmed untouched
- `_reference/Data-Pulse/` — confirmed untouched
- `AGENTS.md` — confirmed untouched
- `CLAUDE.md` — confirmed untouched (if any modification predates this run,
  note the diff with `git diff CLAUDE.md` output for transparency)

## 5. Validation evidence

| Check | Result | Notes |
|:--|:--:|:--|
| `npm run typecheck` | ✅ | Both tsconfigs clean |
| `npm run lint` (full) | ⚠ OOM → fallback | Full lint OOMed; ran on changed files only — clean |
| `npx vitest run` (full) | ✅ | NNN passed, MM skipped, 0 failures |
| Coverage on new modules | ✅ | 100 % stmt / branch / fn / line on new payment surfaces |
| `npm run codegen:verify` | (skipped — no OpenAPI changes) | — |
| Manual smoke | ☐ pending | UI walk-through deferred to reviewer per slice spec |

## 6. Marks summary

- `ready` at start: NN tasks
- `blocked` at start: M tasks (gates: ...)
- `parallel-safe` groups identified: K
- `[P]` downgrades to sequential: P (files: ...)
- `needs-owner-approval` raised: Q (resolved: ...)
- `forbidden-scope` fired: 0  ← if non-zero, this is a stop-and-escalate

## 7. Security invariants honoured

(Enumerate the slice-relevant constitutional + cross-feature
invariants and tick each.)

- ✅ No sensitive IDs in renderer DOM (cart_id, operator_session_id,
  tenant_id, branch_id, terminal_id, handoff_action_id, item_ref,
  last_action_id, owning_operator_id)
- ✅ No card data (PAN, CVV, track data, cardholder name)
- ✅ No raw bridge `reason` strings displayed to cashier
- ✅ Feature-flag fail-closed default (e.g. `payments: false`)
- ✅ 44 × 44 CSS px touch targets on every interactive element
- ✅ ARIA landmark on the surface; tender buttons carry accessible labels
- ✅ Money handled as integer minor units (`Number.isSafeInteger` guarded)
- ✅ No PII / cards in logs (Pino redaction list reviewed)

## 8. Deferred / follow-up

(Things that came up during the run but are out of this slice's
scope. Each becomes either a GitHub issue, a task for a future slice,
or a `/speckit-analyze` finding.)

- Issue #NNN — <title> — <brief context>
- Spec-Kit suggestion — `tasks.md` row T031 names
  `CartHandoffButton.tsx`; runtime reality is `HandoffSummary.tsx` +
  `CartPane.tsx` (wiring chain). Feed back through
  `/speckit-analyze` next cycle.
- UI polish item — <description> — deferred to a future Impeccable /
  UI slice per <slice>'s convention.

## 9. Suggested next step

A single concrete next action for whoever picks the feature up.
Examples:

- "Open Slice 2 of 006 once §A3 and §A4 clear (cash payment +
  external_card_terminal under the bridge surface)."
- "Schedule reviewer time for the §A4 bridge security review (this
  is the next blocking gate)."
- "Wait on Data-Pulse-2 PR #NNN to merge — Wave M of §A2 is
  upstream."

## 10. Run notes

(Free-text. Anything the next person should know that didn't fit
above: surprises, decisions taken under ambiguity, retro notes on
agent dispatch posture, etc. Keep to ≤ 300 words.)
```

## How to populate each section

### Section 1 — Identification

Standard metadata. Capture before the PR opens.

### Section 2 — Gate verdict

Two columns: entering and leaving. Most slices don't change a gate.
When one does (e.g. a §A3 migration lands), record the new state plus
the merge SHA so future runs can verify.

### Section 3 — Task ledger

One row per task in the worklist. The "Source `[P]`" column copies
verbatim from `tasks.md` (Maestro never edits the source marker).
The "Maestro mark" column records the runtime classification (see
`task-marking.md`). The "Final state" column is the closeout tick:
✅ done, ⏸ paused, ❌ failed.

If a `[P]` was downgraded to sequential, footnote the row with the
file and the reason. This is the input `/speckit-analyze` needs to
decide whether to edit `tasks.md` in the next cycle.

### Section 4 — Files touched

Three groups: created, modified, and (explicitly) untouched. The
untouched list is non-trivial — it's the **proof** that the slice
honoured its forbidden-scope walls. The Scope Guard role produces
this list.

If `CLAUDE.md` shows as modified in `git status` but the modification
predates the run (a stale dirty state on the working tree), call it
out in section 4 with the diff so the reviewer can confirm the slice
didn't introduce the change.

### Section 5 — Validation evidence

Five standard rows plus any slice-specific extras. The "Notes" column
records:

- For OOMs: which command OOMed, what fallback you ran.
- For partials: which subset ran and why.
- For codegen-verify: explicit "skipped — no OpenAPI changes" if the
  slice didn't touch generated types.

Manual smoke is usually deferred to the reviewer; mark it pending
with a checkbox so the reviewer can tick it.

### Section 6 — Marks summary

A count, not an enumeration. The enumeration lives in section 3. The
summary helps a reader gauge the slice's complexity at a glance.

A non-zero `forbidden-scope` count is a red flag — the slice should
not have shipped. If it did, the closeout explains why the firing was
a false positive (e.g. the file was *listed* as forbidden but later
clarified by the owner).

### Section 7 — Security invariants honoured

This is the slice-specific portion. Pull the relevant invariants from:

- The slice's spec / plan / contracts.
- Constitution principles I–IX touching the slice.
- Cross-feature principles P1–P18 touching the slice.
- The 007 visual-system regression checklist.

Tick each. If one was unverifiable (e.g. manual smoke needed),
explain in section 5 or section 8.

### Section 8 — Deferred / follow-up

Anything the slice noticed but didn't ship. Three kinds:

- **GitHub issues** — new bugs / findings worth tracking.
- **Future-slice tasks** — work that legitimately belongs to a later
  slice (e.g. the persistence layer for what we just shipped in
  renderer-only).
- **Spec-Kit suggestions** — things `/speckit-analyze` should
  consider next cycle.

### Section 9 — Suggested next step

One concrete action. Not a list. Not a roadmap. The single next
thing.

If the next step is "stop and wait for the owner," say so.

### Section 10 — Run notes

The space for narrative. Useful for retros on whether multi-agent
dispatch helped, whether a `[P]` downgrade saved a bug, whether the
slice should have been split, etc.

## Where the report lives

1. **PR description** — the canonical home. Reviewers read it
   first.
2. **`coordination.md` mirror** — optional. Add a short pointer to
   the merged PR under the slice's gate row. Don't duplicate the
   full report.
3. **Working notes** — discarded after PR opens.

Reports are **not** committed to the repo as separate files. The PR
description is the durable record; once merged, GitHub stores it.

## Anti-patterns to avoid in reports

1. **Padding section 10 with marketing prose.** The report is for the
   next agent and the reviewer, not for stakeholders.
2. **Repeating the diff.** GitHub already shows the diff; the report
   summarises and contextualises, it does not duplicate.
3. **Hiding scope creep.** If the slice ended up touching something
   outside its allowed-paths list, name it in section 8 with a
   one-line justification. Hiding it makes the next reviewer suspect
   every diff.
4. **Skipping the untouched list.** Section 4's untouched list is the
   proof of discipline. Skipping it forces the reviewer to verify by
   hand.
5. **Marking everything ✅ when one or more rows didn't ship.** Be
   honest. ⏸ paused and ❌ failed are real outcomes. The reviewer
   will trust a partial honest report more than a fully-green
   misleading one.
