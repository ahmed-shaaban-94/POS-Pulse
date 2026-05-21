# 006-payments-tender — Slice 3 — BLOCKED

**Status:** BLOCKED (preflight STOP; owner decisions recorded; gates §A3 + §A4-A held)

> **THIS FILE DOES NOT REPLACE `tasks.md` OR `coordination.md`.**
> **THIS FILE DOES NOT AUTHORIZE IMPLEMENTATION.**
> **THIS FILE DOES NOT CLEAR §A3 OR §A4-A.**
>
> This is a Maestro coordination overlay only. When this file and
> `tasks.md` disagree, `tasks.md` wins. When this file and
> `coordination.md` disagree, `coordination.md` wins.

---

## Source of truth

| Document | Role |
|:--|:--|
| `specs/006-payments-tender/tasks.md` | Canonical task list (T060–T164 for Slice 3); executable per-slice work items with TDD pairing and `[P]` markers |
| `specs/006-payments-tender/coordination.md` | Live gate ledger + phase status; canonical home of all §A0–§A5 decisions |
| `specs/006-payments-tender/data-model.md` | Three new SQLite tables + invariants; input to §A3 migration review |
| `specs/006-payments-tender/contracts/bridge-api.md` | `payments.*` + `tender.*` bridge contract (DRAFT — §A4-A review required) |

The `execution-map.yaml` in this directory adds Maestro execution structure on top of these documents. Neither file replaces them.

---

## Merged (on `main` at `868c7ff`)

| PR | Title | Key Artefact |
|:--|:--|:--|
| PR #189 / PR #190 | 006 Slice 0 — visual direction + sign-off | T010 / T011 complete; §A1 cleared |
| PR #192 | 006 Slice 1 — tender selection + envelope ingest | T020–T034 complete |
| PR #196 | 006 Slice 1 closeout | Maestro closeout recorded in `coordination.md` |
| PR #198 | 006 Slice 2 — per-tender entry surfaces | T040–T051 complete |
| PR #199 | 006 Slice 2 closeout | Maestro closeout recorded in `coordination.md` |
| PR #200 | Slice 3 owner decisions — Session 2026-05-21 | Migration naming + sub-slice scoping recorded in `coordination.md` |
| PR #201 | Hybrid Maestro templates | `docs/maestro/slice-schema.yaml`, `docs/maestro/quick-prompts.md`, `docs/maestro/templates/` added |

All of the above are on `main` at `868c7ff`.

> **Note:** At the time this file was created, the worktree HEAD is `868c7ff`
> (PR #199 — Slice 2 closeout). PRs #200 and #201 are referenced above as
> owner-recorded decisions and template additions; their artefacts are
> forward-referenced here and will be present once merged.

---

## Local only (not yet on `main`)

None. All coordination work is upstreamed.

---

## Active findings

| ID | Severity | Summary |
|:--|:--|:--|
| F-001 | Low | **Migration naming divergence** — `tasks.md` (T060–T065) proposes feature-prefixed names (`006-0001_create_payment_attempts.sql`, etc.). The owner decision (PR #200, 2026-05-21) mandates bare numeric names continuing the existing sequence (e.g., `0012_create_payment_attempts.sql`, `0013_create_payment_tender_lines.sql`, …). The `tasks.md` proposals are advisory per Maestro task-marking; the divergence does not modify task IDs. Flagged for `/speckit-analyze` follow-up. |

---

## Blocked

The following gates are **held**. No S3 sub-slice may start until both clear.

| Gate | Reviewer | Status |
|:--|:--|:--|
| **§A3** — Migration approval (three new tables + audit-category extension) | TBD | ⛔ Held — reviewer must be assigned; sign-off recorded in `coordination.md` (T067) |
| **§A4-A** — Bridge-API security review (`payments.*` + `tender.*`) | TBD | ⛔ Held — full security review of `contracts/bridge-api.md`; sign-off recorded in `coordination.md` before Slice 3 ships |

---

## Ready

None. Every S3 sub-slice is blocked until §A3 and §A4-A clear.

---

## Proposed execution chain

```
S3a  →  S3b  →  S3c  →  S3d
```

All four sub-slices are sequential (single-agent; process-boundary rule applies throughout).

### Sub-slice gate conditions

| Sub-slice | Can start when… |
|:--|:--|
| **S3a** | §A3 cleared |
| **S3b** | §A4-A cleared AND S3a GREEN |
| **S3c** | §A4-A cleared AND S3b GREEN |
| **S3d** | §A1 ✅ (already cleared) AND S3c GREEN |

### Proposed groups within each sub-slice

High-level batches (the full dependency / file-conflict / parallel-safe graphs were produced in the Slice 3 preflight run and are recorded in `execution-map.yaml §groups`). Summary only:

**S3a** — Wave A: T060 (base table) → T061 (partial unique index, serialised after T060); T062, T063, T065 sequential per FK order; T064 (append-only trigger, after T063). Wave B: T066 (integration test), T067 (§A3 sign-off), T110–T113 (repositories; T111/T112/T113 are `[P]`-marked and parallel-safe).

**S3b** — Wave C: shared types T070–T073. Wave D: PaymentAttempt FSM tests T080–T084 (TDD RED, 5-wide). Wave E: TenderLine FSM + idempotency + audit tests T085–T094 (TDD RED, 9-wide). Wave F: FSM + audit + idempotency implementation T120–T132 (GREEN; T121/T130/T131/T132 are `[P]`-marked).

**S3c** — Wave G: bridge handler tests T100–T106 (TDD RED, 7-wide; all `[P]`-marked). Wave H: bridge handler implementation T133–T141 (GREEN; T135–T141 are `[P]`-marked; separate files). Wave I: preload registration T142 (serialised last; depends on all of Wave H).

**S3d** — Wave J: renderer store + entry wiring T150–T151 (separate files; parallel-safe). Wave K: PaymentSurface wiring T152–T154 (SERIALISED — file conflict; see below). Wave L: verification + sign-off T160–T164.

---

## File-conflict notes

**T152 / T153 / T154 all modify `src/renderer/ui/payments/PaymentSurface.tsx`.**

These three tasks MUST be sequentialised within S3d Wave K:

```
T152 (payments.confirm wire) → T153 (payments.cancel wire) → T154 (split-tender UX)
```

Do NOT run T152, T153, and T154 in parallel. A merge conflict on `PaymentSurface.tsx` would occur.

---

## Parallel-safe notes

- **S3b Wave D–E (18-wide TDD test antichain):** T080–T094 are individually parallel-safe (each lives in a separate test file under `tests/unit/main/payments/`). However, single-agent execution is **mandatory** per `docs/maestro/graph-rules.md §"Process-boundary edges"` — the FSM code they test straddles the main-process / shared boundary. The antichain width is informational only.

- **S3c Wave G (9-wide bridge handler antichain):** T100–T106 are individually parallel-safe (separate test files). Same single-agent constraint applies — bridge handlers are process-boundary code.

---

## Validation posture

Every sub-slice (S3a, S3b, S3c, S3d) must pass all four checks before its PR opens:

```bash
npm run typecheck            # both tsconfigs — clean
npm run lint                 # eslint + prettier --check — clean
npx vitest run               # full suite — 0 failures
npm run codegen:verify       # must be no-op (Slice 3 introduces no OpenAPI changes)
```

Coverage floors (checked at T160):

| Scope | Floor |
|:--|:--|
| `computeChangeDueMinor` + money-math helpers | ≥ 95 % |
| PaymentAttempt FSM | ≥ 95 % |
| TenderLine FSM | ≥ 95 % |
| Audit emitter | ≥ 95 % |
| Idempotency replay | ≥ 95 % |
| All bridge handlers (`payments.*` + `tender.*`) | ≥ 95 % |
| Renderer wiring (payment-store + PaymentSurface + entry wires) | ≥ 90 % |

---

## Next recommended action

1. **Commission §A3 reviewer** — assign a reviewer name and record it in `coordination.md` gate ledger (§A3 row) with the date assigned.
2. **Commission §A4-A reviewer** — assign a reviewer name and record it in `coordination.md` gate ledger (§A4-A row) with the date assigned.
3. Once both reviewers are named, the reviewers work against:
   - §A3: `specs/006-payments-tender/data-model.md` (three tables + invariants + migration order)
   - §A4-A: `specs/006-payments-tender/contracts/bridge-api.md` (full DRAFT bridge contract)
4. When §A3 clears (T067 recorded in `coordination.md`), **S3a may begin**.
5. When §A4-A clears (recorded in `coordination.md`) AND S3a is GREEN, **S3b may begin**.

---

## Next short Maestro prompt

To start S3a implementation once §A3 clears, use the "Execute approved slice" prompt from:

```
docs/maestro/quick-prompts.md  (added by PR #201)
```

---

## Post-merge closeout

After each sub-slice PR merges, run the post-merge closeout prompt:

```
docs/maestro/templates/post-merge-closeout-prompt.md  (added by PR #201)
```

After S3d merges, T164 records the full Slice 3 sign-off in `coordination.md`:
- Coverage numbers (per-module floors as above)
- §A2 no-op confirmation
- §A3 migration review sign-off (reviewer + date)
- §A4-A bridge review sign-off (reviewer + date)

Recommended commit message: `docs(pos): record 006 slice 3 closeout`
