# 006-payments-tender — Slice 3 — S3a COMPLETED · S3b next candidate (preflight required)

**Status:** S3a ✅ COMPLETED — merged via PR #207 at `e8b33d5` on 2026-05-22T14:07:11Z. S3b is the next-candidate sub-slice (§A4-A + §A3 both cleared, S3a GREEN) but is NOT AUTHORIZED — a fresh Maestro preflight is required. S3c and S3d remain BLOCKED on S3b-GREEN and S3c-GREEN respectively. Slice 4 gates (§A4-B, §A2) remain held.

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

All of the above are on `main`.

> **Note:** Prior baseline `868c7ff` (PR #199 — Slice 2 closeout) is now superseded by S3a's merge commit `e8b33d5` (PR #207). Slice 3 source-of-truth pointers (`execution-map.yaml §base`) remain pinned to the pre-Slice-3 baseline for traceability of the preflight that authorised S3a.

---

## Local only (not yet on `main`)

None. All coordination work is upstreamed.

---

## Active findings

| ID | Severity | Summary |
|:--|:--|:--|
| F-001 | Low | **Migration naming divergence** — `tasks.md` (T060–T065) proposes feature-prefixed names (`006-0001_create_payment_attempts.sql`, etc.). The owner decision (PR #200, 2026-05-21) mandates bare numeric names continuing the existing sequence (e.g., `0012_create_payment_attempts.sql`, `0013_create_payment_tender_lines.sql`, …). The `tasks.md` proposals are advisory per Maestro task-marking; the divergence does not modify task IDs. Flagged for `/speckit-analyze` follow-up. |

---

## Recently signed off (now cleared)

Both gates that were blocking S3a have been signed off, and S3a has subsequently shipped.

| Gate | Reviewer | Status |
|:--|:--|:--|
| **§A3** — Migration approval (three new tables + audit-category extension) | Ahmed (commissioned 2026-05-21) | ✅ Signed off 2026-05-21 — Approved, no changes requested; delivered under this clearance via PR #207 |
| **§A4-A** — Bridge-API security review (`payments.*` + `tender.*`) | Ahmed (commissioned 2026-05-21) | ✅ Signed off 2026-05-21 — Approved, no changes requested; gates S3b/S3c, both pending |

> **S3a is COMPLETE.** Merged via PR #207 (merge commit `e8b33d5`) on 2026-05-22T14:07:11Z. Closeout recorded in `coordination.md` §"Maestro closeout — S3a (PR #207)" and in `execution-map.yaml §closeout.sub_slices[0]`.

---

## Blocked

S3c and S3d remain blocked on their predecessors. §A4-B remains held (Slice 4 only). S3b is the next-candidate sub-slice — its gates are cleared but it requires a fresh Maestro preflight before authorisation.

| Gate / Sub-slice | Status |
|:--|:--|
| **§A4-B** — Bridge-API review for `vouchers.*` (Slice 4 only) | ⛔ Held — TBD before Slice 4 |
| **§A2** — Backend / OpenAPI (Slice 4 voucher endpoints) | ⛔ Held — TBD before Slice 4 |
| **S3b** — Shared types + FSMs + audit emitter + idempotency helper | ⚠ Next candidate — gates (§A4-A + §A3) cleared and S3a GREEN, but a fresh Maestro preflight is required before authorisation. **Not yet authorised.** |
| **S3c** — Bridge handlers + preload registration | ⛔ Blocked — starts when S3b is GREEN |
| **S3d** — Renderer wiring + final verification | ⛔ Blocked — starts when S3c is GREEN |
| Slice 4 gates (force-fail + voucher Contract V-A) | ⛔ Held — TBD after Slice 3 closes (T164) |

---

## Ready

No sub-slice is currently authorised for implementation.

**S3b** is the next candidate but requires a fresh Maestro preflight (Template 1) before any T070–T094 / T120–T132 work begins.

| Sub-slice | Task range | Status |
|:--|:--|:--|
| **006-S3a** — Migrations + persistence repositories | T060–T067, T110–T113 | ✅ Completed (PR #207) |
| **006-S3b** — Shared types + FSMs + audit emitter + idempotency helper | T070–T094 (tests) + T120–T132 (impl) | ⚠ Preflight required — gates cleared, S3a GREEN |

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
4. **Run a fresh Maestro preflight for S3b** (Template 1) before any S3b code is written. The preflight must produce the worklist, dependency / file-conflict / parallel-safe graphs (the 18-wide test antichain at Wave C–E), and the agent-dispatch posture for T070–T094 + T120–T132. **S3b is NOT YET AUTHORIZED** even though its gates are cleared — the preflight is the gate.
5. After S3b preflight completes and is owner-approved, S3b implementation may begin.
6. S3c begins when S3b is GREEN; S3d begins when S3c is GREEN. Slice 4 gates (§A4-B, §A2) remain held throughout.

---

## Next short Maestro prompt

S3a is complete. The next Maestro work is the S3b preflight — **not** S3b implementation. Use this prompt to commission the preflight (copy-paste ready):

```
Run Maestro Preflight for 006-payments-tender S3b.

Spec: specs/006-payments-tender/
Sub-slice: S3b — Shared types + FSMs + audit emitter + idempotency helper
Task range: T070–T094 (TDD tests) + T120–T132 (impl)
Gate status: §A4-A and §A3 cleared 2026-05-21 (Ahmed, Approved); 006-S3a GREEN as of PR #207 (e8b33d5, 2026-05-22)
Preflight authority: docs/maestro/templates/ (Template 1)
Execution map: specs/006-payments-tender/maestro/execution-map.yaml (slices.006-S3b)

Produce: worklist, dependency graph, file-conflict graph,
         parallel-safe groups (Wave-C/D/E test antichains; Wave-F GREEN impl),
         agent-dispatch posture (expect single-agent per process-boundary rule),
         and any divergences from tasks.md flagged for /speckit-analyze.

Do NOT author any S3b code. Stop after the preflight artefacts are produced
and the owner approves them.
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
