# 008 Slice 1 Preflight — Finalization listener + persistence + 006 wiring

> **For agentic workers:** This preflight is the per-wave implementation plan for Slice 1 of 008-sale-finalization-and-receipts. Slice 1 ships in **four sequential waves** (S1a → S1b → S1c → S1d). Each wave is **one PR**. Each wave has a strict file allow-list; touching anything outside is a preflight violation.
>
> **Source of truth (in priority order):**
>
> 1. `specs/008-sale-finalization-and-receipts/tasks.md` — canonical T-numbers + per-task acceptance criteria
> 2. `specs/008-sale-finalization-and-receipts/coordination.md` — live gate ledger + sign-off records
> 3. `specs/008-sale-finalization-and-receipts/contracts/bridge-api.md` — `sales.*` + `receipts.*` contract (§A4 reviewed before S1d ships)
> 4. `specs/008-sale-finalization-and-receipts/data-model.md` — SQLite schemas + migration sequencing (§A3 reviewed before S1a ships)
> 5. `docs/impeccable-embed-preflight.md` — Slice 1 does NOT touch any renderer surface; no `[IMPECCABLE …]` markers fire in this slice (those start at T173 in Slice 2)
>
> **This preflight does NOT replace tasks.md.** When this preflight and tasks.md disagree, tasks.md wins.

---

## 0. Slice 1 in one paragraph

Slice 1 is the load-bearing foundation: five new SQLite tables (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`, `sale_number_sequences`) + append-only triggers + indices + extension of 004's `audit_events.action_category` with 10 new 008 categories; the AD-7 sale-number allocator (per-terminal per-calendar-day monotonic); the AD-2 v3 polling worker that listens on 006's `payment.settled` rows and fires the atomic finalize transaction (idempotent on `envelope.handoff_action_id`, kill-mid-finalize recoverable); the four append-only repositories; the audit-event emitter (10 new categories); and the read-only `sales.*` bridge surface. No renderer code, no printing, no drawer kicking, no template engine — those start at Slice 2.

User stories covered: US1 scenarios **1** (durable finalization), **2** (sale-number format), **10** (force-fail refusal), **14** (sync-handoff staging).

Test floor (per tasks.md line 145): ≥ 95% on AD-2 transaction, AD-7 allocator, refusal guard, `sales.*` read handlers; integration test for kill-mid-finalize recovery; idempotency replay test.

---

## 1. Gates blocking Slice 1

| Gate | What it gates within Slice 1 | Closed by |
|:--:|:--|:--|
| **§A0** | Upstream readiness + `/speckit-plan` v1.0 + `/speckit-analyze` | ✅ Cleared (PR #238) |
| **§A1** | Slice 0 visual direction (renderer surfaces); Slice 1 does NOT touch renderer | T011 sign-off in `coordination.md` |
| **§A2** | Backend / OpenAPI — **no-op every 008 slice** (AD-12) | Documentation-only sign-off recorded in T113 |
| **§A3** | Migrations — five new tables + triggers + audit-category extension | T028 sign-off in `coordination.md`; reviewer assignment open (see coordination.md §A3 thread) |
| **§A4** | `sales.*` bridge surface review (4 handlers; eight-item checklist) | T104 sign-off in `coordination.md`; reviewer assignment open (see coordination.md §A4 thread) |
| **§A5** | Production-readiness — Slice 6 concern, **not blocking Slice 1** | Slice 6 T520–T528 |

**Wave-to-gate mapping:**

- **S1a** is gated on **§A3** (migration review must close before S1a's T020–T028 ship; or, S1a may open as a draft PR with T028 left unticked, and §A3 review run on the draft).
- **S1b** is gated on **§A3** indirectly (allocator + repositories depend on the tables existing). S1b should open only after S1a merges.
- **S1c** is gated on **§A3** (depends on tables) and adds nothing for §A4 (no bridge surface yet).
- **S1d** is gated on **§A4** (bridge surface review must close before T104 signs off; or, S1d opens as a draft and §A4 review runs on the draft).

§A2 is documentation-only (T113 records the no-op). §A1 and §A5 do not gate Slice 1.

---

## 2. Wave decomposition

### Wave overview

| Wave | Title | Tasks | ~Count | Sequential predecessor |
|:--:|:--|:--|:--:|:--|
| **S1a** | Migrations + append-only triggers + audit-category extension + §A3 sign-off | T020 / T021 / T022 / T023 / T024 / T025 / T026 / T027 / T028 | 9 | — |
| **S1b** | Shared types + AD-7 allocator + migration runner + repositories | T030 / T031 / T032 / T033 / T040 / T041 / T042 / T043 / T080 / T085 | 10 | S1a merged |
| **S1c** | Finalize transaction + AD-2 v3 polling worker + refusal guard + forbidden-field validation + audit emitter + remaining repositories | T050 / T051 / T052 / T053 / T054 / T055 / T056 / T057 / T060 / T061 / T062 / T081 / T082 / T083 / T084 / T090 / T091 / T092 / T093 | 19 | S1b merged |
| **S1d** | `sales.*` bridge handlers + preload wiring + §A4 sign-off + Slice 1 verification + Slice 1 functional sign-off | T070 / T071 / T072 / T073 / T100 / T101 / T102 / T103 / T104 / T110 / T111 / T112 / T113 | 13 | S1c merged |

**Total: 51 tasks across 4 waves.** Waves are strictly sequential; no parallel wave execution. Within each wave, multiple T-numbers are `[P]` tagged in tasks.md and can run as parallel subagents — see "Parallel-execution opportunities" per wave below.

---

## 3. Wave S1a — Migrations

**Branch:** `feat/008-s1a-migrations` off `main`.
**Gate cleared by this wave:** §A3.
**Single PR.** Stop before merge; await human merge signal.

### 3.1 Task list (tasks.md T020–T028)

- [ ] **T020** [§A3] Create `sales` table — `migrations/008-0001_create_sales.sql`
- [ ] **T021** [§A3] Append-only triggers on `sales` — `migrations/008-0001b_sales_append_only_trigger.sql`
- [ ] **T022** [§A3] [P] Create `print_events` table + triggers — `migrations/008-0002_create_print_events.sql`
- [ ] **T023** [§A3] [P] Create `drawer_events` table + UNIQUE(sale_id) (FR-053) + triggers — `migrations/008-0003_create_drawer_events.sql`
- [ ] **T024** [§A3] [P] Create `sale_sync_outbox` table + UNIQUE(sale_id) + triggers — `migrations/008-0004_create_sale_sync_outbox.sql`
- [ ] **T025** [§A3] [P] Create `sale_number_sequences` table (mutable; no append-only trigger) — `migrations/008-0005_create_sale_number_sequences.sql`
- [ ] **T026** [§A3] Extend 004's `audit_events.action_category` enum with 10 new 008 categories — `migrations/008-0006_extend_audit_event_categories.sql`
- [ ] **T027** [§A3] Integration test: apply all six migrations against a fresh better-sqlite3 file; assert schemas + triggers + UNIQUE constraints — `tests/integration/sales/migrations.test.ts`
- [ ] **T028** [§A3] Record §A3 migration review sign-off — `specs/008-sale-finalization-and-receipts/coordination.md`

### 3.2 Parallel-execution opportunities

T022 / T023 / T024 / T025 are `[P]` — four migration files for four independent tables can be authored in parallel subagents. T020 / T021 are sequential (the `sales` table must exist before its append-only trigger). T026 / T027 / T028 are sequential and must follow.

**Recommended dispatch:** T020 → T021 → (T022 ∥ T023 ∥ T024 ∥ T025 in parallel) → T026 → T027 → T028.

### 3.3 Forbidden paths (S1a)

`src/main/**`, `src/renderer/**`, `src/shared/**`, `src/preload/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S1a touches **only** `migrations/**` and `tests/integration/sales/migrations.test.ts`.

### 3.4 Acceptance + close-out

- [ ] All six migrations apply cleanly to a fresh DB; T027 integration test passes (vitest run on `tests/integration/sales/migrations.test.ts`).
- [ ] Append-only triggers refuse UPDATE and DELETE on the four append-only tables (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`).
- [ ] `sale_number_sequences` does NOT have an append-only trigger (it's the only mutable 008 table).
- [ ] UNIQUE constraints present: `sales.envelope_handoff_action_id`, `sales.(terminal_id, sale_number)`, `drawer_events.sale_id`, `sale_sync_outbox.sale_id`.
- [ ] `audit_events.action_category` CHECK extended with the 10 new categories.
- [ ] **§A3 reviewer signs off** in `coordination.md` (T028); reviewer assignment must land before this box ticks (open follow-up in `coordination.md`).

---

## 4. Wave S1b — Shared types + AD-7 allocator

**Branch:** `feat/008-s1b-types-allocator` off `main` (after S1a merges).
**Gate cleared by this wave:** none directly. Builds on §A3-cleared tables.
**Single PR.**

### 4.1 Task list (tasks.md T030–T085 subset)

- [ ] **T030** [P] [US1] Contract test (failing): `BridgeApi` interface extension — `tests/contract/sales/bridge-api.contract.test.ts`
- [ ] **T031** [US1] Implement `sales.*` types in `src/shared/bridge-api.ts` (read-only Slice-1 subset)
- [ ] **T032** [P] [US1] Implement `src/shared/sales/types.ts` — `SaleId`, `SaleNumber`, `TenderLineSummary`, `PrintEventSummary`, `DrawerEventSummary`, `RefusalReason`
- [ ] **T033** [P] [US1] Implement `src/shared/receipts/types.ts` — `ReceiptPayload`, `ReceiptTemplateVariant`
- [ ] **T040** [P] [US1] Allocator format test (failing) — `tests/unit/main/sales/sale-number-allocator.format.test.ts`
- [ ] **T041** [P] [US1] Allocator day-reset test (failing) — `tests/unit/main/sales/sale-number-allocator.day-reset.test.ts`
- [ ] **T042** [P] [US1] Allocator concurrency test (failing) — `tests/integration/sales/sale-number-allocator.concurrent.test.ts`
- [ ] **T043** [P] [US1] Allocator txn-rollback test (failing) — `tests/integration/sales/sale-number-allocator.txn-rollback.test.ts`
- [ ] **T080** [US1] Implement migration runner registration for the six 008 migrations — `src/main/db/migrations-registry.ts`
- [ ] **T085** [P] [US1] Implement AD-7 allocator — `src/main/sales/sale-number-allocator.ts`

### 4.2 Parallel-execution opportunities

T032 / T033 are `[P]` — two independent shared-types modules. T040 / T041 / T042 / T043 are all `[P]` — four independent allocator test files. T085 is `[P]` — independent allocator module. T031 depends on T030 (contract test must exist first); T080 depends on S1a tables existing in the migration registry.

**Recommended dispatch:** T030 → T031 → (T032 ∥ T033 ∥ T040 ∥ T041 ∥ T042 ∥ T043 in parallel — six subagents) → T080 → T085.

### 4.3 Forbidden paths (S1b)

`migrations/**` (S1a's territory; S1b should NOT modify any migration), `src/renderer/**`, `src/preload/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S1b touches **only** `src/shared/**`, `src/main/db/migrations-registry.ts`, `src/main/sales/sale-number-allocator.ts`, and the corresponding test files.

### 4.4 Acceptance + close-out

- [ ] Contract test T030 passes against the extended `BridgeApi` interface (compile-time assertion).
- [ ] Four allocator test files (T040 / T041 / T042 / T043) all pass.
- [ ] T085 allocator: returns `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>` zero-padded 6-digit per `(terminal_id, calendar_day_local)`; resets on local-timezone midnight; runs inside the caller's SQLite transaction; rollback-safe.
- [ ] Vitest `tests/unit/main/sales/sale-number-allocator.*` + `tests/integration/sales/sale-number-allocator.*` all green.
- [ ] Migration runner integrates the six 008 migrations in numeric order (0001 → 0001b → 0002 → 0003 → 0004 → 0005 → 0006).

---

## 5. Wave S1c — Finalize transaction + AD-2 v3 polling worker

**Branch:** `feat/008-s1c-finalize-listener` off `main` (after S1b merges).
**Gate cleared by this wave:** none directly. The hardest wave: AD-2 v3 polling, kill-mid-finalize recovery, idempotency on `handoff_action_id`, audit emitter.
**Single PR.** Largest wave — 19 tasks.

### 5.1 Task list (tasks.md T050–T093 subset)

**Finalize-transaction tests (TDD-first):**

- [ ] **T050** [P] [US1] AD-2 atomic finalize transaction atomicity test (failing) — `tests/integration/sales/finalize-transaction.atomicity.test.ts`
- [ ] **T051** [P] [US1] AD-2 idempotency-on-`handoff_action_id` test (failing) — `tests/unit/main/sales/finalize-transaction.idempotent.test.ts`
- [ ] **T052** [P] [US1] AD-2 v3 scan-worker test (failing) — `tests/unit/main/sales/finalize-listener.scan-worker.test.ts`
- [ ] **T053** [P] [US1] Kill-mid-finalize integration test (failing) — `tests/integration/sales/finalize-transaction.kill-mid-flight.test.ts`
- [ ] **T054** [P] [US1] Startup recovery scan test (failing) — `tests/integration/sales/finalize-listener.startup-recovery.test.ts`

**Refusal-guard tests:**

- [ ] **T055** [P] [US1] Refuse `force_failed` source attempt (failing) — `tests/unit/main/sales/finalize-listener.refuse-force-failed.test.ts`
- [ ] **T056** [P] [US1] Refuse `reversal_pending` line (failing) — `tests/unit/main/sales/finalize-listener.refuse-reversal-pending.test.ts`
- [ ] **T057** [P] [US1] Refuse `state != 'settled'` payload (failing) — `tests/unit/main/sales/finalize-listener.refuse-not-settled.test.ts`

**Forbidden-field validation tests:**

- [ ] **T060** [P] [US1] Card-field forbidden test (failing) — `tests/unit/main/sales/finalize-transaction.forbidden-card-fields.test.ts`
- [ ] **T061** [P] [US1] Voucher-field forbidden test (failing) — `tests/unit/main/sales/finalize-transaction.forbidden-voucher-fields.test.ts`
- [ ] **T062** [P] [US1] Secret-credential forbidden test (failing) — `tests/unit/main/sales/finalize-transaction.forbidden-secret-fields.test.ts`

**Repositories:**

- [ ] **T081** [P] [US1] `sales` repository — `src/main/sales/repositories/sales.repository.ts`
- [ ] **T082** [P] [US1] `print_events` repository — `src/main/sales/repositories/print-events.repository.ts`
- [ ] **T083** [P] [US1] `drawer_events` repository — `src/main/sales/repositories/drawer-events.repository.ts`
- [ ] **T084** [P] [US1] `sale_sync_outbox` repository — `src/main/sync-outbox/sale-sync-outbox.repository.ts`

**Implementation (AD-2 listener + finalize-transaction + recovery sub-scans + audit emitter):**

- [ ] **T090** [US1] AD-2 v3 scan worker — `src/main/sales/finalize-listener.ts`
- [ ] **T091** [US1] AD-2 atomic finalize-transaction module — `src/main/sales/finalize-transaction.ts`
- [ ] **T092** [US1] One-shot startup recovery sub-scans (print + drawer) — `src/main/sales/finalize-listener.ts`
- [ ] **T093** [P] [US1] Audit-event emitter (10 new categories; redacts `external_reference`; refuses forbidden-field payloads) — `src/main/sales/audit-emitter.ts`

### 5.2 Parallel-execution opportunities

T050 / T051 / T052 / T053 / T054 / T055 / T056 / T057 / T060 / T061 / T062 / T081 / T082 / T083 / T084 / T093 are all `[P]` — sixteen `[P]` tasks. Group them into parallelizable subagent batches:

- **Test batch 1 (5 subagents):** T050 ∥ T051 ∥ T052 ∥ T053 ∥ T054 (finalize-transaction + listener tests).
- **Test batch 2 (3 subagents):** T055 ∥ T056 ∥ T057 (refusal-guard tests).
- **Test batch 3 (3 subagents):** T060 ∥ T061 ∥ T062 (forbidden-field tests).
- **Repository batch (4 subagents):** T081 ∥ T082 ∥ T083 ∥ T084 (four independent repositories).
- **Implementation:** T091 (finalize-transaction module) MUST come before T090 (listener that invokes it); T092 depends on T090's scan-worker scaffolding; T093 (audit emitter) is `[P]` with the implementation tasks.

**Recommended dispatch:** all test tasks in three parallel batches (11 subagents) → repository batch (4 subagents) → T091 → T090 → T092 → T093 (T093 `[P]`-able alongside T090–T092).

### 5.3 Forbidden paths (S1c)

`migrations/**` (S1a territory), `src/shared/**` (S1b territory — except S1c may import types that S1b authored), `src/renderer/**`, `src/preload/**`, `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S1c touches **only** `src/main/sales/**` and `src/main/sync-outbox/**` and the corresponding test files.

### 5.4 Acceptance + close-out

- [ ] All sixteen test tasks (T050–T062 + T081–T084 tests) pass. Initial RED bar verified before implementation; final GREEN bar verified after.
- [ ] T090 AD-2 v3 polling worker runs at 200 ms default tick (configurable 100–1000 ms); single-flight per tick; canonical SELECT from plan §AD-2.
- [ ] T091 finalize transaction atomic: idempotency check → allocator → forbidden-field validation → refusal guards → INSERT sales / sale_sync_outbox / audit_events all in one transaction.
- [ ] T092 startup recovery sub-scans (print + drawer) one-shot at startup; audit-events recovery automatic via T090's first tick.
- [ ] T093 audit emitter redacts `external_reference` to `*****`; refuses forbidden-field payloads (defence-in-depth).
- [ ] Vitest `tests/unit/main/sales/` + `tests/integration/sales/` all green; per-module coverage ≥ 95% on AD-2 transaction, AD-7 allocator (already verified in S1b), refusal guard, audit emitter, repositories.
- [ ] Kill-mid-finalize integration test (T053) demonstrably recovers via startup scan.

---

## 6. Wave S1d — `sales.*` bridge + preload + §A4 sign-off + Slice 1 close-out

**Branch:** `feat/008-s1d-bridge-verification` off `main` (after S1c merges).
**Gate cleared by this wave:** §A4 (T104); Slice 1 closes via T113 functional sign-off.
**Single PR.**

### 6.1 Task list (tasks.md T070–T113 subset)

**Bridge-handler tests:**

- [ ] **T070** [P] [US1] `sales.read` test — `tests/unit/main/sales/bridge.sales-read.test.ts`
- [ ] **T071** [P] [US1] `sales.findByNumber` tenant-isolation test — `tests/unit/main/sales/bridge.sales-find-by-number.test.ts`
- [ ] **T072** [P] [US1] `sales.subscribe(topic='recent')` test — `tests/unit/main/sales/bridge.sales-subscribe-recent.test.ts`
- [ ] **T073** [P] [US1] Defensive forbidden-field-in-request guard test — `tests/unit/main/sales/bridge.sales-forbidden-field-guard.test.ts`

**Bridge implementation:**

- [ ] **T100** [US1] `sales.read` handler — `src/main/sales/sales-bridge.ts`
- [ ] **T101** [P] [US1] `sales.findByNumber` handler — `src/main/sales/sales-bridge.ts`
- [ ] **T102** [P] [US1] `sales.subscribe` + `sales.unsubscribe` — `src/main/sales/sales-bridge.ts`
- [ ] **T103** [US1] Preload wiring — `src/preload/sales.ts` + central preload entry
- [ ] **T104** [§A4] Record §A4 sign-off — `specs/008-sale-finalization-and-receipts/coordination.md`

**Slice 1 verification + close-out:**

- [ ] **T110** Vitest coverage assertion across the full Slice 1 module set — `tests/`
- [ ] **T111** Manual smoke (dev fixture): 006 cash payment → 008 finalization → observe `sales` row + outbox row + audit event — `coordination.md`
- [ ] **T112** Manual smoke (kill-mid-finalize recovery) — `coordination.md`
- [ ] **T113** Slice 1 functional sign-off — `coordination.md`

### 6.2 Parallel-execution opportunities

T070 / T071 / T072 / T073 are all `[P]` — four bridge-test subagents in parallel. T101 / T102 are `[P]` — implementation can fan out after T100 lands. T104 + T110 + T111 + T112 + T113 are sequential close-out.

**Recommended dispatch:** (T070 ∥ T071 ∥ T072 ∥ T073 in parallel — 4 subagents) → T100 → (T101 ∥ T102 in parallel) → T103 → T104 → T110 → T111 → T112 → T113.

### 6.3 Forbidden paths (S1d)

`migrations/**`, `src/renderer/**` (Slice 2+ territory), `package.json`, `package-lock.json`, `.github/workflows/**`, `specs/008-sale-finalization-and-receipts/tasks.md`. S1d touches **only** `src/main/sales/sales-bridge.ts`, `src/preload/sales.ts`, the central preload entry, and the corresponding test files. Updates to `coordination.md` are permitted (T104 / T111 / T112 / T113 all write there).

### 6.4 Acceptance + close-out

- [ ] All four bridge tests (T070–T073) pass with `requireOperatorSession` gate, tenant/branch/terminal isolation, sale-not-found refusal envelope, defensive forbidden-field-in-request guard.
- [ ] `sales.read` payload excludes main-only fields (`envelope_handoff_action_id`, `payment_attempt_id`, `envelope_cart_id`, `tenant_tax_registration_id`).
- [ ] `sales.findByNumber` cross-tenant miss refuses with `sale_not_found` (NOT `tenant_isolation` — §A4 checklist item 6).
- [ ] **§A4 reviewer signs off** in `coordination.md` (T104); reviewer assignment must land before this box ticks (open follow-up in `coordination.md`).
- [ ] T110 coverage assertion: ≥ 95% on `sales.*` handlers.
- [ ] T111 manual smoke produces a finalized sale with correct sale-number format (`<terminal_label>-<YYYY-MM-DD>-000001`).
- [ ] T112 kill-mid-finalize manual smoke recovers via startup scan.
- [ ] T113 records Slice 1 functional sign-off in `coordination.md`; §A2 no-op confirmed; §A3 + §A4 sign-offs cross-referenced.
- [ ] **Slice 1 closes.** Slice 2 (receipt template engine + preview UI) becomes startable.

---

## 7. Cross-wave invariants

These rules apply to every wave (S1a / S1b / S1c / S1d). Violation = preflight violation; wave is rejected.

### 7.1 Constitution compliance (every wave)

- **No floats for money.** Money in any wave's code goes through `src/shared/payments/money-math.ts`. `tender_lines_summary_json` carries integer-minor-unit amounts.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** preserved on every BrowserWindow. Slice 1 does NOT touch BrowserWindow config but MUST NOT accidentally regress it.
- **No upward-of-bridge IPC.** Slice 1's bridge surface (S1d) is the typed preload bridge defined in `src/shared/bridge-api.ts`. No direct `ipcRenderer` paths.
- **No copy-paste from `_reference/Data-Pulse/`.** Re-derive instead. Constitution §P8.
- **Test-first.** Every implementation T-number (T080 / T081–T085 / T090–T093 / T100–T103) is preceded by a failing test T-number in tasks.md.
- **PII / cards never in logs.** Constitution §P11. The audit emitter (T093) redacts `external_reference` to `*****`; the forbidden-field validation (T060–T062) refuses payloads carrying PAN / CVV / track / cardholder / expiry / auth_payload / cryptogram / voucher_code / voucher_balance / voucher_redemption_intent_token / authority_payload / pin / jwt / device_token / envelope_payload / raw_envelope.

### 7.2 TDD ordering (every wave)

Within each wave, the order is: failing-test task → implementation task → green-bar verification. The implementing agent runs `npm test -- --run <test-file-pattern>` against the wave's test files **after** authoring the test, confirms RED, then implements the corresponding module(s) until the test goes GREEN.

### 7.3 Forbidden-path enforcement (every wave)

Each wave's "Forbidden paths" section (§3.3 / §4.3 / §5.3 / §6.3) is binding. Pre-merge check: `git diff --name-only main...HEAD` against the wave's allow-list. Anything outside the wave's allow-list is a preflight violation and must be removed before merge.

### 7.4 No marker firing in Slice 1

The `[IMPECCABLE …]` markers in `tasks.md` (T010 / T173 / T290 / T360 / T450 / T512) belong to Slice 0 (shape) and Slices 2 / 3 / 5 / 6 (craft). **Slice 1 fires zero markers.** Any `/impeccable` invocation during S1a–S1d is a preflight violation — the embed contract is per-marker, not per-feature.

### 7.5 Coordination updates

Each wave's close-out updates `coordination.md`:

- S1a: §A3 sign-off recorded (T028).
- S1c: no coordination update (internal-only wave).
- S1d: §A4 sign-off recorded (T104); Slice 1 functional sign-off recorded (T113); §A2 no-op confirmed (T113); manual-smoke results from T111 + T112 recorded.

S1b is the only wave that does not write to `coordination.md`.

---

## 8. Risk register

| Risk | Severity | Mitigation |
|:--|:--:|:--|
| §A3 reviewer not assigned by S1a authoring time | HIGH | Open the wave as a draft PR; surface the missing-reviewer state in the PR body; do not merge until §A3 sign-off lands. Reviewer assignment is tracked in `coordination.md` §A3 thread (open follow-up). |
| §A4 reviewer not assigned by S1d authoring time | HIGH | Same pattern as §A3: draft PR, surfaced state, blocked merge. |
| AD-2 v3 polling worker tick floor / ceiling tuning | MEDIUM | Default 200 ms is from plan §AD-2; T052 test asserts default + configurability; tune only via terminal config, not via code change. |
| Kill-mid-finalize recovery edge cases | MEDIUM | T053 integration test injects panic between INSERT and COMMIT; T054 startup recovery scan replays. Both required GREEN before S1c merges. |
| Forbidden-field validation completeness drift | MEDIUM | Three test files (T060 card / T061 voucher / T062 secret) lock the forbidden-key list per FR-070 / FR-071 / FR-072 / FR-074. Defence-in-depth: audit emitter (T093) ALSO refuses forbidden payloads. |
| Sale-number sequence allocator race under high concurrency | MEDIUM | T042 concurrency integration test asserts two concurrent finalizes produce different sale numbers. SQLite transaction-level isolation + composite PK on `sale_number_sequences` is the mechanism. |
| Migration ordering regression | LOW | T080 enforces numeric ordering (0001 → 0001b → 0002 → 0003 → 0004 → 0005 → 0006); T027 integration test verifies the ordering applies cleanly. |
| Cross-wave file-path leakage | LOW | Forbidden-path enforcement (§7.3) blocks accidental edits via pre-merge `git diff --name-only` check. |

---

## 9. Open coordination follow-ups (before Slice 1 can start)

These items are pre-Slice-1 work; they don't block authoring this preflight but DO block S1a's first commit:

- [ ] **§A1 acceptance** by Ahmed (preflight §9 box from PR #241, still unticked). Does NOT directly gate Slice 1 (§A1 governs renderer surfaces; Slice 1 has no renderer code), but the activation contract requires it before any 008 wave opens.
- [ ] **§A3 reviewer assignment** + target review date (`coordination.md` §A3 thread). S1a draft PR may open without this, but cannot merge until §A3 signs off (T028).
- [ ] **§A4 reviewer assignment** + target review date (`coordination.md` §A4 thread). S1d draft PR may open without this, but cannot merge until §A4 signs off (T104).
- [ ] **T002 feature-flag confirmation** — `sale_finalization` flag in `src/shared/app-config.ts` + `FeatureFlagsState` extension in the renderer store. Code task; lives in a separate future PR. **Slice 1 may proceed without T002** (Slice 1 has no UI gated on the flag); T002 is required before Slice 2's preview UI surfaces consume it.
- [ ] **Slice 0 §A1 sign-off** (T010 + T011). Renderer-surface work in Slice 2+ blocks on this; Slice 1 does NOT block on it.

---

## 10. Preflight metadata

**Spec:** [../spec.md](../spec.md)
**Plan:** [../plan.md](../plan.md) v1.0
**Tasks:** [../tasks.md](../tasks.md) (Phase 3 — Slice 1)
**Coordination:** [../coordination.md](../coordination.md)
**Data model:** [../data-model.md](../data-model.md)
**Bridge contract:** [../contracts/bridge-api.md](../contracts/bridge-api.md)
**Embed preflight (cross-feature, informational):** [../../../docs/impeccable-embed-preflight.md](../../../docs/impeccable-embed-preflight.md)
**Constitution version pinned:** v1.5.1
**Authored:** 2026-05-26
**Owner:** Slice 1 implementing agent (single agent or subagent fleet); §A3 reviewer for S1a sign-off; §A4 reviewer for S1d sign-off; Ahmed for Slice 1 functional sign-off (T113).

---

**End of Slice 1 preflight. S2 / S3 / S4 / S5 / S6 preflights to follow at slice-commission time.**
