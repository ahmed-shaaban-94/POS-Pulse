---
description: "Task list for 011-sale-sync-capture-up — slice/story-organised, test-first per Constitution VI; held behind gates §A2/§A4/§A5. Live leg blocked on #349. Generated 2026-06-07."
---

# Tasks: 011-sale-sync-capture-up

**Feature:** 011-sale-sync-capture-up — Sale Sync (Capture-UP)
**Plan:** [./plan.md](./plan.md) (v1.0, 2026-06-07)
**Spec:** [./spec.md](./spec.md) (`/speckit-clarify` ✅ 2026-06-07; 3 questions resolved A/A/A)
**Research:** [./research.md](./research.md)
**Data model:** [./data-model.md](./data-model.md)
**Contracts:** [./contracts/README.md](./contracts/README.md)
**Quickstart:** [./quickstart.md](./quickstart.md)
**Constitution version pinned:** v1.5.1
**Created:** 2026-06-07
**Status:** Tasks generated; not yet started. S1–S4 buildable now (DI fake client); S5 live leg blocked on #349 (backend HTTP 521).

---

> **Gate numbering** (parallels 010): **§A2** migration-safety (the new `0034-sale-sync-state`),
> **§A4** P8 bridge-security (the read-only `sales:syncStatus` channel), **§A5** production readiness
> (incl. the no-tender end-to-end verification + live-leg bring-up). 009's §A0/§A1/§A3 are N/A.
>
> **Test-first (Constitution VI, NON-NEGOTIABLE).** Every implementation (GREEN) task is preceded by
> its failing (RED) test task.
>
> **Tag legend:**
> - **`[P]`** = parallelizable (different file, no incomplete-task dependency).
> - **`[BUILDABLE-NOW]`** = no live backend needed; runs against the injected `SaleSyncClient` fake.
> - **`[BLOCKED:#349]`** = may not start until the backend is deployed (live HTTP / composition-root wiring).
> - **`[GATE:§A2]` / `[GATE:§A4]` / `[GATE:§A5]`** = blocked on the named review/sign-off.
>
> **Invariants threaded through every task:** money = integer minor units (`Number.isSafeInteger`);
> NO tender fields in v1; tenant-scoped (P17); no operator token / PII / card data across the bridge
> or in logs (P7/P8); 008's `sale_sync_outbox` is read-only (never mutated — AD-11).

---

## Phase 1 — Setup

- [ ] T001 [BUILDABLE-NOW] Confirm 008's `sale_sync_outbox` real shape + enqueue-only invariant against `src/main/sync-outbox/sale-sync-outbox.repository.ts` and migration `0024` (columns: `outbox_row_id, sale_id, envelope_handoff_action_id, tenant_id, branch_id, terminal_id, state, enqueued_at`; CHECK + UPDATE-refusing trigger); confirm the durable Sale read path used to reconstruct the payload. Record any drift in plan.md before coding.
- [ ] T002 [GATE:§A2] Author the §A2-class migration-safety review package for `0034-sale-sync-state` — `specs/011-sale-sync-capture-up/migration-review/s1-migration-review.md` (schema, indexes, tenant-scoping, CHECK constraints; verify 008's enqueue-only table is untouched). Owner ratification clears T011–T012.
- [ ] T003 [BLOCKED:#349] Backend no-tender verification (non-code): obtain written confirmation from DP2 owners that a non-zero-total, no-tender sale is accepted end-to-end (`captureSale` + Connector outstanding-AR Sales Invoice). Feeds §A5. If a placeholder is required → reopen FR-9 + the payload contract.

## Phase 2 — Foundational (Blocking Prerequisites)

> The migration is US-agnostic (shared by every story) and gated on §A2.

- [ ] T010 [P] [BUILDABLE-NOW] RED: migration test — `0034` creates `sale_sync_state` with the expected columns + the `(tenant_id, sync_status, next_retry_at)` index + the `sync_status` / `attempt_count` CHECK constraints; mirror the sql.js + `readFileSync('migrations/00NN_*.sql')` pattern used by 010's `0031` test — `src/main/migrations/__tests__/0034-sale-sync-state.test.ts`
- [ ] T011 [GATE:§A2] GREEN: author `migrations/0034_create_sale_sync_state.sql` — `sale_id` PK; `tenant_id`/`branch_id` `NOT NULL TEXT`; `sync_status TEXT NOT NULL CHECK(sync_status IN ('pending','synced','dead_letter'))`; `attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0)`; `next_retry_at`/`last_error_category`/`last_attempt_at`/`synced_at` nullable; `created_at`/`updated_at NOT NULL`; index `(tenant_id, sync_status, next_retry_at)`; logical FK only; `CREATE … IF NOT EXISTS`; ships empty
- [ ] T012 [GATE:§A2] GREEN: register `0034` in the migration runner manifest; runner test stays green (idempotent re-run; FK-safe ordering after 008's tables)

## Phase 3 — US1: A finalized sale reaches the backend (P1 — MVP)

**Goal:** the online happy path — drain the outbox, build the payload, POST, mark `synced`.
**Independent test:** with the fake client returning `ok`, a pending outbox sale ends `synced` in `sale_sync_state` and is excluded from the next drain.

- [ ] T020 [P] [BUILDABLE-NOW] RED [US1] `sale_sync_state` repo test — read returns null before first row; insert/update tenant-scoped; status transitions `pending→synced`; a tenant-B row is never selected/written by a tenant-A query — `src/main/sales-sync/__tests__/sale-sync-state-repo.test.ts`
- [ ] T021 [BUILDABLE-NOW] GREEN [US1] `createSaleSyncStateRepo(db)` — tenant-scoped CRUD over `sale_sync_state`; eligibility query (pending + `next_retry_at` due, tenant-scoped) — `src/main/sales-sync/sale-sync-state-repo.ts`
- [ ] T022 [P] [BUILDABLE-NOW] RED [US1] capture-payload builder test — Sale record → `CaptureSalePayload`; `externalId` deterministic from `sale_id`; all money integer minor units (no float coercion); **zero tender fields**; identity from Sale + pairing (never renderer-supplied) — `src/main/sales-sync/__tests__/capture-payload.test.ts`
- [ ] T023 [BUILDABLE-NOW] GREEN [US1] `buildCapturePayload(sale, scope)` — pure; deterministic `externalId`; integer-minor money; no tender — `src/main/sales-sync/capture-payload.ts`
- [ ] T024 [P] [BUILDABLE-NOW] RED [US1] `SaleSyncClient` seam contract test — the fake honours the typed `SaleSyncResult` union (`ok`/`duplicate`/`transient`/`permanent`/`no_connection`); never rejects; raw body never surfaced — `src/main/sales-sync/__tests__/sale-sync-client-types.test.ts`
- [ ] T025 [BUILDABLE-NOW] GREEN [US1] `sale-sync-client-types.ts` — the `SaleSyncClient` interface + `SaleSyncResult` union + a test fake factory — `src/main/sales-sync/sale-sync-client-types.ts`
- [ ] T026 [P] [BUILDABLE-NOW] RED [US1] engine happy-path test — pending outbox sale + fake `ok` → POST built payload with `Idempotency-Key` from `sale_id` → state `synced`, `synced_at` set, excluded from next drain — `src/main/sales-sync/__tests__/sale-sync-engine.happy.test.ts`
- [ ] T027 [BUILDABLE-NOW] GREEN [US1] `createSaleSyncEngine(deps)` core — single-flight `runTickOnce()` (`started`/`already_running`), FIFO by `enqueued_at`, build→POST→record-synced; injected `client`/`stateRepo`/`outboxRepo`/`saleRepo`/`tenantId`/`branchId`/`getOperatorToken`/`now` — `src/main/sales-sync/sale-sync-engine.ts`

## Phase 4 — US2: No sale is lost (offline, retry, dead-letter, idempotency) (P1)

**Goal:** durability + correct outcome handling across all `SaleSyncResult` kinds.
**Independent test:** scripted fake outcomes drive each state transition; retry counters survive a simulated restart; nothing is silently dropped.

- [ ] T030 [P] [BUILDABLE-NOW] RED [US2] idempotent-duplicate test — fake `duplicate` (409) → `synced` (no retry, no second POST) — `src/main/sales-sync/__tests__/sale-sync-engine.duplicate.test.ts`
- [ ] T031 [P] [BUILDABLE-NOW] RED [US2] transient-retry test — fake `transient` → stays `pending`, `attempt_count++`, `next_retry_at` set via exponential backoff (cap default 5 min); counter persists across a re-instantiated engine (restart) — `src/main/sales-sync/__tests__/sale-sync-engine.retry.test.ts`
- [ ] T032 [P] [BUILDABLE-NOW] RED [US2] dead-letter test — fake `permanent` (4xx) → `dead_letter` + a non-blocking operator notification emitted; never silently dropped — `src/main/sales-sync/__tests__/sale-sync-engine.deadletter.test.ts`
- [ ] T033 [P] [BUILDABLE-NOW] RED [US2] offline test — fake `no_connection` → stays `pending`, no count loss, retried next tick — `src/main/sales-sync/__tests__/sale-sync-engine.offline.test.ts`
- [ ] T034 [P] [BUILDABLE-NOW] RED [US2] FIFO + tenant-scope test — mixed pending sales drained in `enqueued_at` order; a tenant-A drain never touches a tenant-B row — `src/main/sales-sync/__tests__/sale-sync-engine.fifo.test.ts`
- [ ] T035 [BUILDABLE-NOW] GREEN [US2] extend the engine outcome handler to cover all `SaleSyncResult` kinds + persisted backoff + dead-letter notification hook (logs limited to `sale_id`/status/category/retry-count — P7) — `src/main/sales-sync/sale-sync-engine.ts`

## Phase 5 — US3: Operator-session gating (P2)

**Goal:** capture is operator-authed; drain pauses without a session and resumes on sign-in.
**Independent test:** `getOperatorToken` returning null pauses the drain; returning a token resumes it — token never observed in renderer-facing surfaces.

- [ ] T040 [P] [BUILDABLE-NOW] RED [US3] session-gate test — `getOperatorToken()` null → drain pauses (no POST attempted), pending rows untouched; once a token is present the next tick drains — `src/main/sales-sync/__tests__/sale-sync-engine.session.test.ts`
- [ ] T041 [BUILDABLE-NOW] GREEN [US3] engine reads the operator token in-process via injected `getOperatorToken` (sourced from 004's main-process session store); guard before each POST; the token is passed to the client transport main-process-side, never returned through any bridge-facing value — `src/main/sales-sync/sale-sync-engine.ts`

## Phase 6 — US4: Read-only sync-status surface (P2)

**Goal:** the renderer can *see* sync health; it can never trigger or mutate the drain.

- [ ] T050 [P] [BUILDABLE-NOW] [GATE:§A4] RED [US4] bridge-handler test — `sales:syncStatus` returns `{ pending, deadLetter, lastSuccessAt }` tenant-scoped; NO write/trigger handler exists; no token/PII/card/raw-error crosses the boundary (redaction smoke) — `src/main/ipc/__tests__/sales-sync.test.ts`
- [ ] T051 [GATE:§A4] GREEN [US4] `sales:syncStatus` main handler — read-only counts from `sale-sync-state-repo`; registered with `ipcMain`; no write channel — `src/main/ipc/sales-sync.ts`
- [ ] T052 [GATE:§A4] GREEN [US4] preload bridge addition — `sales.syncStatus()` read-only on the typed bridge (`src/shared/bridge-api.ts` + `src/preload/sales-sync.ts`); no upward-of-bridge write
- [ ] T053 [P] [BUILDABLE-NOW] RED [US4] renderer status-indicator test — shows pending / dead-letter counts + absolute last-success timestamp (ISO, no "x ago"); a11y/RTL; renders a truthful "never synced" state when `lastSuccessAt` is null — `src/renderer/ui/sales-sync/__tests__/SaleSyncStatus.test.tsx`
- [ ] T054 [BUILDABLE-NOW] GREEN [US4] `SaleSyncStatus` component — read-only indicator, Arabic-first/RTL, absolute timestamp; mounted where the operator can see it — `src/renderer/ui/sales-sync/SaleSyncStatus.tsx`
- [ ] T055 [GATE:§A4] Author the §A4 P8 bridge-security review — `specs/011-sale-sync-capture-up/security-review/s4-review.md` (control matrix: read-only, no trigger, no token/PII leakage; post-impl walk).

## Phase 7 — US5: Live leg (BLOCKED on #349)

**Goal:** the real HTTP client + composition-root wiring. Cannot start until the backend is deployed.

- [ ] T060 [BLOCKED:#349] RED [US5] live-client test — `createSaleSyncClient` maps real responses (200/201→`ok`, 409→`duplicate`, 5xx/timeout→`transient`, 4xx→`permanent`, network→`no_connection`); `AbortSignal.timeout`; raw body never logged; consumes the re-pinned `api-types.ts` `captureSale` type — `src/main/sales-sync/__tests__/sale-sync-client.test.ts`
- [ ] T061 [BLOCKED:#349] GREEN [US5] `createSaleSyncClient({ baseUrl, fetch, timeoutMs })` — POST `/api/pos/v1/sales`, attach `Authorization: Bearer <operator_session_token>` + `Idempotency-Key`, map to `SaleSyncResult`; implements `SaleSyncClient` unchanged — `src/main/sales-sync/create-sale-sync-client.ts`
- [ ] T062 [BLOCKED:#349] GREEN [US5] composition-root wiring — instantiate the engine with the live client + real `getOperatorToken` (004 store) + scope from `pairingStore`; install the background interval + a finalize-completion nudge; single-flight coalesces — `src/main/index.ts`
- [ ] T063 [BLOCKED:#349] [GATE:§A4] §A4 refresh re-check against the live wiring (operator token never crosses the bridge in the wired path); update `s4-review.md`.

## Phase 8 — Polish & Cross-Cutting

- [ ] T070 [P] [BUILDABLE-NOW] No-outbound-write assertion test — confirm 011 issues no HTTP except `captureSale` and never mutates `sale_sync_outbox` (the trigger would refuse; assert the engine never attempts it) — `src/main/sales-sync/__tests__/no-outbound-write.test.ts`
- [ ] T071 [P] [BUILDABLE-NOW] Coverage check — ≥95% on `capture-payload.ts` (money path) + ≥80% on the engine; `npm test -- --coverage`
- [ ] T072 [BUILDABLE-NOW] Final green — full suite passes; typecheck + lint clean.
- [ ] T073 [GATE:§A5] §A5 production-readiness package — runbook/rollback/failure-modes; incorporate the T003 no-tender verification result; live-leg bring-up notes — `specs/011-sale-sync-capture-up/a5-readiness.md`
- [ ] T074 [BUILDABLE-NOW] Update CLAUDE.md SPECKIT block with the realized slice status (owner-authorized).

---

## Dependencies & ordering

- **Phase 1 → 2:** T001 informs the migration; T002 (§A2) gates T011/T012.
- **Phase 2 → 3:** the repo (T021) needs the table (T011/T012).
- **US1 (Phase 3)** is the MVP: state repo + payload + client seam + engine happy path.
- **US2 (Phase 4)** extends the same engine file (T035) — depends on US1's T027; the RED tests T030–T034 are `[P]` (distinct files) but the single GREEN T035 serializes them.
- **US3 (Phase 5)** depends on the engine (US1/US2).
- **US4 (Phase 6)** depends on the state repo (T021) for counts; §A4 gates the bridge GREEN tasks.
- **US5 (Phase 7)** depends on everything + the #349 deploy; nothing else waits on it.
- **Polish (Phase 8):** T070–T072 after US1–US4; T073 (§A5) at rollout; T074 last.

## Parallel opportunities

- Phase 2: T010 ∥ nothing (single migration).
- US1: T020/T022/T024 RED tests run in parallel (distinct files) before their GREENs.
- US2: T030–T034 RED tests all `[P]`.
- US4: T050 ∥ T053 (main-handler test ∥ renderer test).

## Implementation strategy

**MVP = US1 (Phase 3)** behind the fake client: prove a finalized sale serialises (no tender, integer
minor units) and "syncs" through the engine. Then US2 (durability/correctness), US3 (operator gating),
US4 (read-only status + §A4). **US5 (live leg) is the only #349-gated work** — the DI seam means the
entire correctness core ships and is verified before the backend is reachable.
