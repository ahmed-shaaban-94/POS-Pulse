# 006-payments-tender — Slice 3 — S3a ✅ · S3b ✅ · S3c ✅ · S3d in-flight (PR #212) — T164 sign-off recorded

**Status:** S3a (PR #207, 2026-05-22), S3b (PR #209, 2026-05-23), and S3c (PR #210, 2026-05-23) merged. **S3d is in-flight via PR #212** — renderer wiring (T150–T154), verification (T160–T163), and T164 Slice-3 sign-off all recorded in `coordination.md §"Slice 3 closeout (T164)"`. §A2 no-op for Slices 1–3 confirmed; §A3 + §A4-A signed off 2026-05-21 (Ahmed). Eight findings (F-001 through F-008) remain as documentation divergences / 004-owner follow-ups; none modifies task IDs. **Once PR #212 merges, Slice 3 is fully closed; the next Maestro work is a fresh Slice-4 preflight when the owner commissions §A4-B + §A2 (voucher V-A).**

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

## Merged

| PR | Title | Key Artefact |
|:--|:--|:--|
| PR #189 / PR #190 | 006 Slice 0 — visual direction + sign-off | T010 / T011 complete; §A1 cleared |
| PR #192 | 006 Slice 1 — tender selection + envelope ingest | T020–T034 complete |
| PR #196 | 006 Slice 1 closeout | Maestro closeout recorded in `coordination.md` |
| PR #198 | 006 Slice 2 — per-tender entry surfaces | T040–T051 complete |
| PR #199 | 006 Slice 2 closeout | Maestro closeout recorded in `coordination.md` |
| PR #200 | Slice 3 owner decisions — Session 2026-05-21 | Migration naming + sub-slice scoping recorded in `coordination.md` |
| PR #201 | Hybrid Maestro templates | `docs/maestro/slice-schema.yaml`, `docs/maestro/quick-prompts.md`, `docs/maestro/templates/` added |
| **PR #207** | **006 Slice 3a — payment persistence** | **T060–T067 + T110–T113 complete; merge commit `e8b33d5` on 2026-05-22T14:07:11Z; head SHA `e3784c1`. Six migrations (`0012`–`0017`) + three repositories under `src/main/payments/repositories/` + 39-case migrations integration test + 33 repo unit tests. Maestro closeout recorded in `coordination.md` §"Maestro closeout — S3a (PR #207)".** |
| **PR #209** | **006 Slice 3b — shared types + FSMs + audit emitter + idempotency helper** | **T070–T073, T080–T088, T090–T094, T120–T121, T130–T132 complete (23 tasks); merge commit `862d24581173adc18c8d547b5fcd6ca69225a78d` on 2026-05-23T10:10:17Z; head SHA `6b3f2d0`. Shared types (`bridge-api.ts` extensions, `types.ts`, `fsm-types.ts`) + PaymentAttempt FSM + TenderLine FSM + `requireOperatorSession` wrapper + idempotency replay helper + audit emitter. 24 files (8 source + 16 tests). Maestro closeout recorded in `coordination.md` §"Maestro closeout — S3b (PR #209)".** |
| **PR #210** | **006 Slice 3c — bridge handlers + preload registration** | **T100–T106 + T133–T142 complete (17 tasks); merge commit `5f493fdc802ef70d00ad9f10e4805db5dd429edf` on 2026-05-23T12:37:41Z; head SHA `7d09cbe4ab70f364b0eab18b35c21aa5b874795c`. 8 typed handlers (5 `payments.*` + 3 `tender.*`) + `payments.discardOnSessionEnd` (internal) + `src/main/ipc/payments.ts` registrar + `src/shared/payments/channels.ts` + `src/preload/payments.ts` + main-process bootstrap wiring. 16 new + 4 modified initial; +8 review-cycle files (CodeRabbit CR-1/CR-2/CR-3 fixes + IPC + projection + repository `findByLineId` tests + `payments-cancel` reversal_pending bucket seed). 3 284 tests pass / 0 failed; all per-file coverage thresholds GREEN. Findings F-002 through F-007 surfaced as documentation divergences / 004-owner follow-ups; none modifies task IDs. Maestro closeout recorded in `coordination.md` §"Maestro closeout — S3c (PR #210)".** |

All of the above are on `main`.

> **Note:** Prior baseline `868c7ff` (PR #199 — Slice 2 closeout) is now superseded by S3a's merge commit `e8b33d5` (PR #207). Slice 3 source-of-truth pointers (`execution-map.yaml §base`) remain pinned to the pre-Slice-3 baseline for traceability of the preflight that authorised S3a.

---

## Local only (not yet on `main`)

This S3d implementation PR (PR #212) — renderer wiring (T150–T154), verification (T160–T163), Slice-3 sign-off (T164), CodeRabbit review absorbed.

---

## Active findings

| ID | Severity | Summary |
|:--|:--|:--|
| F-001 | Low | **Migration naming divergence** — `tasks.md` (T060–T065) proposes feature-prefixed names (`006-0001_create_payment_attempts.sql`, etc.). The owner decision (PR #200, 2026-05-21) mandates bare numeric names continuing the existing sequence (e.g., `0012_create_payment_attempts.sql`, `0013_create_payment_tender_lines.sql`, …). The `tasks.md` proposals are advisory per Maestro task-marking; the divergence does not modify task IDs. Flagged for `/speckit-analyze` follow-up. |
| F-002 | Low | **S3c preload modification** — T142 also modifies `src/preload/index.ts` (tasks.md names only `src/preload/payments.ts`). Documentation divergence (preflight-named); flagged for `/speckit-analyze` follow-up. Does not modify task IDs. |
| F-003 | Low | **S3c IPC channels module** — `src/shared/payments/channels.ts` not named in tasks.md but required by both preload and main-side IPC. Same flavour as F-001 / F-002. |
| F-004 | Low | **S3c main-side IPC registration** — `src/main/ipc/payments.ts` (`registerPaymentsHandlers`) + `src/main/index.ts` bootstrap wire-up not named in tasks.md. Same flavour as F-002 / F-003. |
| F-005 | Low | **S3c repository surface extension** — `PaymentTenderLinesRepository.findByLineId(id)` added in S3c (T112 surface in tasks.md listed `insert / updateState / findByAttempt / settlementSumMinor` only). PK equality lookup against migration-0014's PRIMARY KEY — zero schema risk. Required by `tender.read` + `tender.reverse` whose request shapes carry only `tender_line_id`. |
| F-006 | Low | **004 audit-category TS union pending widening** — `AUDIT_ACTION_CATEGORIES` in `src/shared/audit/event-shape.ts` does not yet include the 7 payment categories at the TypeScript-union level (migration `0017` extends the SQL CHECK only). S3c bootstrap uses a single bounded cast at the audit-emitter adapter seam. A 004-owner follow-up PR should widen the union. |
| F-007 | Low | **004 session terminal_id pending** — `OperatorSession` from 004 has no separate `terminal_id` field. S3c bootstrap reuses `session.branch_id` as the terminal scope, matching the cart-bridge precedent. A 004-owner follow-up could plumb a real terminal id through the session record. |
| F-008 | Low | **S3d execution-map Wave-J omission** — `execution-map.yaml §groups.006-S3d.Wave-J` describes T150 + T151 as parallel-safe on file-conflict grounds (which is correct — separate files), but does not surface the **dependency edge** `T150 → T151` recorded in tasks.md row 665. T151 reads the store API T150 introduces; effective execution remains sequential. Surfaced in the 2026-05-23 S3d preflight. Documentation divergence; does not modify task IDs. |

All eight findings are documentation divergences / follow-ups; none modifies task IDs, `[P]` markers, `[US?]` labels, or gate text.

---

## Recently signed off (now cleared)

All gates that gated the Slice-3 work-streams have been signed off, and S3a / S3b / S3c have all shipped.

| Gate | Reviewer | Status |
|:--|:--|:--|
| **§A3** — Migration approval (three new tables + audit-category extension) | Ahmed (commissioned 2026-05-21) | ✅ Signed off 2026-05-21 — Approved, no changes requested; delivered under this clearance via PR #207 |
| **§A4-A** — Bridge-API security review (`payments.*` + `tender.*`) | Ahmed (commissioned 2026-05-21) | ✅ Signed off 2026-05-21 — Approved, no changes requested; consumed by S3c via PR #210 |

> **S3c is COMPLETE.** Merged via PR #210 (merge commit `5f493fdc802ef70d00ad9f10e4805db5dd429edf`) on 2026-05-23T12:37:41Z. Closeout recorded in `coordination.md` §"Maestro closeout — S3c (PR #210)" and in `execution-map.yaml §closeout.sub_slices[2]`.

---

## Blocked

Slice 4 only — §A4-B (vouchers.* bridge review) and §A2 (voucher V-A backend / OpenAPI) remain held until the owner commissions them. The §A5 production-readiness gate is rollout-time only.

| Gate / Sub-slice | Status |
|:--|:--|
| **§A4-B** — Bridge-API review for `vouchers.*` (Slice 4 only) | ⛔ Held — TBD before Slice 4 |
| **§A2** — Backend / OpenAPI (Slice 4 voucher endpoints) | ⛔ Held — TBD before Slice 4 |
| Slice 4 gates (force-fail + voucher Contract V-A) | ⛔ Held — Slice 3 closed; awaiting owner commission |

---

## Ready

Slice 3 is closed. No sub-slice is currently authorised for implementation.

**Slice 4** is the next candidate but is held behind §A4-B + §A2 commission. A fresh Maestro preflight (Template 1) runs once those gates open.

| Sub-slice | Task range | Status |
|:--|:--|:--|
| **006-S3a** — Migrations + persistence repositories | T060–T067, T110–T113 | ✅ Completed (PR #207) |
| **006-S3b** — Shared types + FSMs + audit emitter + idempotency helper | T070–T094 (tests) + T120–T132 (impl) | ✅ Completed (PR #209) |
| **006-S3c** — Bridge handlers + preload registration | T100–T106 (tests) + T133–T142 (impl) | ✅ Completed (PR #210) |
| **006-S3d** — Renderer wiring + final verification | T150–T154 (wiring) + T160–T164 (verification + Slice-3 sign-off) | ✅ Completed (this PR, T164 sign-off recorded in `coordination.md §"Slice 3 closeout (T164)"`) |

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

1. ~~**§A3 reviewer commissioned** — Ahmed assigned 2026-05-21.~~ ✅ **Signed off 2026-05-21 — Approved.**
2. ~~**§A4-A reviewer commissioned** — Ahmed assigned 2026-05-21.~~ ✅ **Signed off 2026-05-21 — Approved.**
3. ~~**Implement S3a**~~ ✅ **Completed via PR #207 (merge commit `e8b33d5`, 2026-05-22T14:07:11Z).** Closeout recorded.
4. ~~**Implement S3b**~~ ✅ **Completed via PR #209 (merge commit `862d24581173adc18c8d547b5fcd6ca69225a78d`, 2026-05-23T10:10:17Z).** Closeout recorded.
5. ~~**Implement S3c**~~ ✅ **Completed via PR #210 (merge commit `5f493fdc802ef70d00ad9f10e4805db5dd429edf`, 2026-05-23T12:37:41Z).** Closeout recorded.
6. ~~**Run a fresh Maestro preflight for S3d**~~ ✅ **Completed 2026-05-23 (owner-approved). 10 tasks (T150–T154 + T160–T164); single-agent end-to-end; Wave-K T152 → T153 → T154 file-serialised on `PaymentSurface.tsx`; F-008 surfaced (Wave-J dependency-edge omission).**
7. ~~**Implement S3d**~~ ✅ **Completed via this PR. T164 sign-off recorded in `coordination.md §"Slice 3 closeout (T164)"`.**
8. **Slice 3 is closed.** The next Maestro work is a fresh **Slice-4 preflight** (Template 1) when the owner commissions §A4-B (vouchers.* bridge review) + §A2 (voucher V-A backend / OpenAPI). Until then, no further 006-payments-tender code work.

---

## Next short Maestro prompt

Slice 3 is closed. The next Maestro work is a Slice-4 preflight — **not** S3d work. Use this prompt to commission Slice 4 once §A4-B + §A2 reviewers are assigned:

```
Run Maestro Preflight for 006-payments-tender Slice 4.

Spec: specs/006-payments-tender/
Slice: 4 — Voucher Contract V-A + force-fail
Task range: T200+ (Slice 4 voucher contract + additive migration), T240+
            (force-fail surface), and any new T-ids the spec adds for
            Contract V-A wiring.
Gate status: §A1 cleared 2026-05-20 (covers Slices 1-2-4 force-fail
             surface); Slice 3 closed via this PR; §A4-B + §A2 commission
             status: TBD (owner action required before preflight).
Preflight authority: docs/maestro/templates/ (Template 1)
Execution map: specs/006-payments-tender/maestro/execution-map.yaml
               (a new slice block 006-S4 will be appended)

Produce: worklist, dependency graph, file-conflict graph, parallel-safe
         groups, agent-dispatch posture for the Slice-4 task range, and
         any divergences from tasks.md flagged for /speckit-analyze. The
         preflight must also fold in the eight Slice-3 findings (F-001
         through F-008) as carry-over context.

Do NOT author any Slice-4 code. Stop after the preflight artefacts are
produced and the owner approves them.
```

---

## Post-merge closeout

After each sub-slice PR merges, run the post-merge closeout prompt:

```
docs/maestro/templates/post-merge-closeout-prompt.md  (added by PR #201)
```

~~After S3d merges, T164 records the full Slice 3 sign-off in `coordination.md`~~ ✅ **T164 sign-off recorded in `coordination.md §"Slice 3 closeout (T164)"` as part of this PR.** Coverage numbers, §A2 no-op confirmation, §A3 + §A4-A sign-offs, and the eight findings F-001 through F-008 are all logged there.
