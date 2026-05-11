---
description: "Task list for feature 004-operator-session — slice-organised, gate-explicit, dependency-aware"
---

# Tasks: 004-operator-session

**Feature:** 004-operator-session — Operator & Session
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.1
**Coordination:** [./coordination.md](./coordination.md)
**Visual direction:** [./visual-direction/README.md](./visual-direction/README.md) ✅ approved-with-revisions (2026-05-05)
**Constitution version pinned:** v1.5.0
**Created:** 2026-05-05
**Last updated:** 2026-05-11 — T061, T062, T072, T073 complete (feat/004-s4-pin-management-reset-unlock). `PinManagementHandler` implemented: `resetCashierPin` (Argon2id hash+seal, lockout reset, `cashier.pin.reset` audit) and `unlockCashier` (lockout clear, `cashier.pin.unlock` audit, `state_invalid` support-trail path). Integration tests (T061/T062) and unit tests wired. `state_invalid` added to `REFUSAL_CATEGORIES`. S4 implementation PRs through #103 merged. T052–T055, T063–T071 (incl. T069a/b/c, T070a/b), T074–T077 complete. PR #103 (T074–T077 PinPad + TakeoverPrompt UI) merged 2026-05-09; PR #105 (dev bootstrap stabilisation — CSP + preload Vite bundle) merged 2026-05-09. **Issue 85 decision recorded 2026-05-11:** cashier-path AD-2 local-only is a permanent architectural invariant (see `coordination.md` §"Issue 85 decision"); issue 85 closed. #86 remains open (owner-discretion closure); #101 open (terminal-A passive-polling gap); #87 open (S4 closeout). Remaining S4 implementation: T078–T082 (cashier-management surface, stuck-shift badge, route-guard, redaction log sites). S3 complete; all Phase 5 tasks (T039–T051d) marked ✅. S3 merged via PRs #49–#56 (HEAD `ba32133`).

---

## Format

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

- **`[P]`** = parallelizable (different files, no dependency on incomplete tasks).
- **`[US1]` / `[US2]` / `[US3]`** = user-story trace from spec.md.
  - **US1** = Operator sign-in on a paired terminal (P1).
  - **US2** = Role-gated visibility (P2).
  - **US3** = Blind shift close & audit attribution scaffold (P3).
- **`[BLOCKED:gate]`** = task is in the file but NOT startable until the named gate clears.

Every implementation task that touches code is preceded by a TDD test task per Constitution VI.

---

## Approval Gates — current status (mirror of [./coordination.md](./coordination.md))

| Gate | Status | Owner | Path |
|:--|:--:|:--|:--|
| Slice 0 review | ✅ Approved-with-revisions (2026-05-05) | Ahmed | (3 notes incorporated below as task requirements) |
| §A1 — local-unlock-factor approval | ✅ **Cleared** — PR #39, SHA `7ae337b`, Constitution v1.5.1, 2026-05-05 | Ahmed | Path 1 — constitutional clarification clause added to Principle VIII. |
| §A2 — backend / OpenAPI | ✅ Wave 1 + Wave 2 + Wave 3 cleared (Wave 4 downstream) | Ahmed | Wave 1: sign-in + sign-out (Data-Pulse-2 PRs #52/#54). Wave 2: audit-events (Data-Pulse-2 PR #62, SHA `4f77da6`). Wave 3: roster + takeover/confirm + active-session (Data-Pulse-2 PR #70). Wave 4 blocks S5. |
| §A3 — migrations | ✅ **Fully cleared** — `audit_events` PR #49 SHA `e50f5b8`; `operator_sessions` + `cashier_pin_records` PR #60. | Ahmed | All three S4 tables live. S4 may proceed from §A3 perspective. |
| §A4 — Argon2id binding | ✅ **Cleared** — argon2 0.44.0 installed (POS-Pulse PR #59). | Ahmed | T063 complete. S4 PIN implementation may proceed. |
| §A5 — production readiness | ⏳ Held | TBD at rollout PR open time | Blocks production rollout only, not slice merges |

**Net effect on this tasks.md**: Phase 1 (Setup), Phase 2 (Foundational), Phase 3 (S1), Phase 4 (S2), and Phase 5 (S3) are **complete** (all tasks ✅). **All S4 gates cleared (2026-05-08):** §A1 ✅, §A2 Wave 3 ✅, §A3 ✅ (all migrations live), §A4 ✅ (argon2 0.44.0). S4 in progress — T052–T077 complete (PRs #59/#60/#61/#63/#64/#90/#91/#92/#93/#94/#99/#100/#103); remaining: T072, T073, T078–T082. S5 gates on S4 complete + §A2 Wave 4. S6 gates on prior slices merged.

---

## Path conventions

- Renderer code: `src/renderer/`
- Renderer UI primitives (003 inventory, extended): `src/renderer/ui/operator/` (new sub-module)
- Main process: `src/main/operator/` (new sub-module)
- Preload bridge: `src/preload/operator.ts` (new), `src/shared/bridge-api.ts` (extended)
- Shared types: `src/shared/operator/`, `src/shared/audit/`
- Migrations: `migrations/NNN_<name>.sql`
- Tests: `tests/unit/`, `tests/integration/`, `tests/contract/`
- Specs / docs: `specs/004-operator-session/`, `docs/runbook/`

---

## Phase 1 — Setup & Coordination (NO source code; STARTABLE NOW)

**Purpose:** Lock the slice-0 review record, finalise gate ownership, and confirm pre-implementation artefacts. **No source code, no migrations, no packages, no OpenAPI in this phase.** Phase 1 is startable now under the user's hard constraints.

- [ ] T001 Confirm Slice 0 review record is signed and findings (Notes 1–3) are propagated to the relevant slice's task acceptance criteria below — `specs/004-operator-session/visual-direction/README.md`
- [ ] T002 [P] Confirm `coordination.md` reflects current gate state (Slice 0 ✅; §A1 owner Ahmed Path 1; §A2 owner Ahmed / Backend TBD) — `specs/004-operator-session/coordination.md`
- [ ] T003 [P] Open §A1 constitutional-clarification PR in the POS-Pulse repo: a single clause amendment to Principle VIII (per plan.md §A1 Path 1 wording) — affects `.specify/memory/constitution.md` only; non-code; not part of any implementation slice
- [ ] T004 [P] Open §A2 coordination thread: identify SmartDataPulse backend counterpart owner; share `specs/004-operator-session/contracts/backend-endpoints.md` as the dependency surface; record outcome in `coordination.md`
- [ ] T005 Visual-direction sign-off recorded in S1's PR description requirements (a documentation contract — every Slice 1+ PR cites the Slice 0 review record per FR-033) — recorded in `specs/004-operator-session/tasks.md` (this file, this row) for traceability

**Checkpoint:** Phase 1 complete when T001–T005 are ticked. Phase 2 may then begin in parallel with §A1 amendment work and §A2 coordination.

---

## Phase 2 — Foundational (Bridge skeleton & shared types — STARTABLE NOW for the manager/admin path only)

**Purpose:** Establish the typed seam between renderer and main process, the operator-session store skeleton, the role enum, and the shared audit-event types. These are foundational for every subsequent slice. Manager/admin Clerk path is the only code that lands at this stage; cashier-PIN path stays stubbed-and-gated until §A1 ✅.

**Tests-first per Constitution VI.**

### Phase 2 — Tests

- [ ] T006 [P] Unit test: `src/shared/operator/role.ts` Role enum closed-set assertion (`{cashier, manager, admin}` only; FR-002) — `tests/unit/shared/operator/role.test.ts`
- [ ] T007 [P] Unit test: `src/shared/audit/event-shape.ts` AuditEvent shape with FR-025 mandatory five attributes — `tests/unit/shared/audit/event-shape.test.ts`
- [ ] T008 [P] Contract test: `operator.*` bridge namespace — typed surface compiles against contracts/bridge-api.md — `tests/contract/operator-bridge.contract.test.ts` (initial: only the manager/admin paths' typed shapes; cashier paths typed but bridge handlers unimplemented per §A1 gate)
- [ ] T009 [P] Unit test: `src/main/operator/role-enforcement.ts` `requireRole` helper refuses generically on mismatch (FR-016, FR-019, AD-1) — `tests/unit/main/operator/role-enforcement.test.ts`
- [ ] T010 [P] Unit test: `<OperatorRouteGuard>` secondary UX defence behaviour: redirect on mismatch, allow on match, redirect on `signedOut` (NFR-009) — `tests/unit/renderer/routes/operator-route-guard.test.tsx`
- [ ] T011 [P] Integration test: `operatorSessionStore` 5-state finite-state machine transitions (`signedOut → signingIn → signedIn → signingOut → signedOut`; plus `takeoverPrompt` branch) — `tests/integration/renderer/stores/operator-session-store.test.ts`

### Phase 2 — Implementation

- [ ] T012 [P] Create `src/shared/operator/role.ts` exporting closed `Role` enum and the machine ↔ business-name mapping (FR-002) — derived from `data-model.md` §"Entity 3 — Role"
- [ ] T013 [P] Create `src/shared/audit/event-shape.ts` with `AuditEvent` type, `ActionCategory` discriminated union (catalogue from data-model.md §"Action Category Catalogue"), and the `OperatorRefusal` envelope shape from `contracts/bridge-api.md` — `src/shared/audit/event-shape.ts`
- [ ] T014 Extend `src/shared/bridge-api.ts` with the typed `operator.*` namespace skeleton matching `contracts/bridge-api.md` (10 calls — manager/admin paths typed normally; cashier paths typed but flagged with `// §A1-gated, handler returns refusal until §A1 resolves`) — depends on T012, T013
- [ ] T015 Create `src/main/operator/role-enforcement.ts` exporting `requireRole(allowed: Role[], session: OperatorSession): void` — throws `OperatorRefusalError` with `category: 'role_mismatch'`. Per AD-1, this is the primary trust-boundary gate. — depends on T012
- [ ] T016 Create `src/renderer/stores/operator-session-store.ts` (zustand) implementing the 5-state FSM from research.md §3 — depends on T012
- [ ] T017 Create `src/renderer/routes/operator-route-guard.tsx` reading from `operatorSessionStore` and the role-visibility matrix (compiled-in TS object that mirrors `contracts/role-visibility-matrix.md`); secondary UX defence per AD-1 — depends on T012, T016, T013

**Checkpoint:** Bridge surface compiles end-to-end; `requireRole` refuses generically; FSM transitions tested; route guard works against mocked store. Manager/admin Clerk path's bridge contract is in place. Cashier path is typed but unimplemented.

---

## Phase 3 — Slice S1: Manager / Admin sign-in (Clerk-only path)

**Purpose:** Deliver US1 (operator sign-in) for managers and admins via Clerk/password. Sign-in surface, sign-out, role-indicator slot wiring, takeover detection for Clerk users, top-level `/sign-in` route mount.

**Slice 0 reviewer Note 1 lands here:** S1 must cover the error-then-resubmit transition (inline alert dismisses on first new keystroke; new submit's spinner replaces prior alert space, not alongside it).

**Gates:**
- ⏳ §A2 (S1 subset) — backend endpoints `POST /v1/operators/sign-in` (manager/admin variant), `POST /v1/operators/sign-out` must land before T026 / T027 / T028 may merge.
- All Phase 2 tasks must be ✅.

### Phase 3 — Tests

- [ ] T018 [P] [US1] Unit test: Surface 1 RosterList renders branch cashiers only (no email/phone leakage; FR-006, FR-031) — `tests/unit/renderer/ui/operator/roster-list.test.tsx`
- [ ] T019 [P] [US1] Unit test: Surface 2 (manager/admin password form) renders, validates non-empty, submits via bridge — `tests/unit/renderer/ui/operator/manager-admin-sign-in.test.tsx`
- [ ] T020 [P] [US1] Unit test: OperatorBadge renders display name + role for each role variant (FR-002 / FR-020) — `tests/unit/renderer/ui/operator/operator-badge.test.tsx`
- [ ] T021 [P] [US1] **Note 1 (Slice 0) acceptance test**: Surface 1 / Surface 2 error-then-resubmit transition — typing a new digit / character dismisses the prior inline alert; the next submit's spinner replaces the alert's space, not alongside it; the spinner does NOT render simultaneously with the prior alert — `tests/integration/renderer/ui/operator/sign-in-error-resubmit.test.tsx`
- [ ] T022 [P] [US1] Integration test: `/sign-in` route is the only reachable route while `signedOut` (FR-005); a deep-link to `/app/*` redirects to `/sign-in` — `tests/integration/renderer/routes/sign-in-route.test.tsx`
- [ ] T023 [P] [US1] Integration test: successful manager sign-in transitions `operatorSessionStore` to `signedIn`, mounts shell, populates OperatorBadge with Clerk identity (NFR-006: < 5 s budget) — `tests/integration/renderer/sign-in-success.test.tsx`
- [ ] T024 [P] [US1] Integration test: sign-out clears state, transitions to `/sign-in` within 1 s (FR-008 / NFR-007) — `tests/integration/renderer/sign-out.test.tsx`
- [ ] T025 [P] [US1] **Cross-process redaction smoke test**: extends 002's; verifies password values, Clerk JWTs, session tokens never appear in `pino` logs, Sentry events, or test snapshots (P7 / P11 / FR-030) — `tests/integration/cross-process-redaction.test.ts`

### Phase 3 — Implementation `[BLOCKED: §A2 (S1 endpoints)]`

- [ ] T026 [US1] **`[BLOCKED: §A2]`** Implement `operator.signIn` (manager/admin variant) in `src/main/operator/sign-in-handler.ts`: calls Clerk; validates tenant + branch claims against device token; on success creates `operator_sessions` row (in-memory only at this slice — durable persistence lands with §A3) and returns `SignInResponse`; on takeover-required returns `TakeoverRequiredResponse`; on failure returns `OperatorRefusal { category: 'invalid_input' }` for any factor-distinguishable reason (NFR-003 / PR-2) — depends on T015, T026 endpoint delivery
- [ ] T027 [US1] **`[BLOCKED: §A2]`** Implement `operator.signOut` in `src/main/operator/sign-out-handler.ts`: best-effort backend call; always tears down local session within 1 s (NFR-007) — depends on T026
- [ ] T028 [US1] **`[BLOCKED: §A2]`** Implement `operator.getCurrentSession` in `src/main/operator/session-manager.ts`: in-memory query; the persisted-restore path is added in S3 (§A3 dependent) — depends on T015

#### C1 addendum — FR-009 inactivity timer (added 2026-05-05)

- [ ] T028a [P] [US1] Unit test: 15-minute inactivity timer terminates the operator session with `end_cause = 'inactivity_timeout'` (FR-009); timer resets on genuine user input (mouse-move, keypress, touch); timer is NOT reset by background activity (system polling, network heartbeats, window-focus changes that are not user-driven); timer state survives application restart (regression of crash-mid-session) — `tests/unit/main/operator/inactivity-monitor.test.ts`
- [ ] T028b [US1] Implement `src/main/operator/inactivity-monitor.ts`: subscribes to renderer-side genuine-input events via the typed bridge (no new IPC channel — extends the existing `operator.*` namespace with an internal `_reportActivity` notify-only call); on 15 minutes of no genuine input, terminates the active operator session with `end_cause = 'inactivity_timeout'`; emits no PIN values, no Clerk JWTs, no credential fragments in any log line (PR-1 / FR-030); the inactivity threshold is configurable via the existing 001 configuration surface but defaults to 15 min (Spec A3) — depends on T028, T015
- [ ] T029 [P] [US1] Implement `src/renderer/routes/sign-in.tsx` rendering Surface 1's roster + Surface 2's password form (per visual-direction/README.md S0 deliverables 1, 2). Roster uses placeholder data until §A2 (S4 endpoints) — visible on `/sign-in` but interactive only for the manager/admin path in S1 — depends on T016
- [ ] T030 [P] [US1] Implement `src/renderer/ui/operator/RosterList.tsx` (display name + role badge only — no email / phone; FR-006 / FR-031). Inert in S1; data wiring lands in S4. — depends on T012
- [ ] T031 [P] [US1] Implement `src/renderer/ui/operator/OperatorBadge.tsx` slotting into 003's role-indicator region (FR-020); 1:1 machine ↔ business-name (FR-002) — depends on T012
- [ ] T032 [US1] Mount `/sign-in` route above `/app/*` in `src/renderer/router.tsx`; boot router resolves: pairing-decision (002) → `/sign-in` (if no operator session) → `/app/*` (if signed in). Sign-out returns to `/sign-in`. Per AD-4. — depends on T029, T016
- [ ] T033 [US1] Implement Surface 6 generic-failure overlay (variants A/B/C) on `/sign-in` per visual-direction/README.md §"Surface 6": single generic message family per outcome, auto-dismissal on user input change (Note 1 acceptance). — depends on T029
- [ ] T034 [US1] Add `pino` log sites with PR-1 / FR-030 redaction extensions for: sign-in attempt outcome category, sign-out, takeover detection (the redaction list is extended in `src/main/logger/redaction.ts`; cross-process smoke test T025 verifies) — depends on T026, T027

**Checkpoint S1:** A reviewer pairs a terminal, lands at `/sign-in`, signs in as a manager via Clerk/password, observes the shell with OperatorBadge populated, signs out within 1 s. Cashier roster is rendered but inert (PIN flow unimplemented; explicit message: "manager / admin sign-in only at this stage"). Quickstart Slice 1 walkthrough passes.

---

## Phase 4 — Slice S2: Bridge-surface security review (NON-CODE GATE)

**Purpose:** Plan §"Phase 3 — Implementation Slice Strategy" S2 — a dedicated review pass over S1's bridge diff against Constitution Principle P8 (Electron Security Boundary) and AD-1. **No new code in this slice.** Output is a checked-in review record.

**Gates:**
- S1 must be merged.

- [ ] T035 Conduct line-by-line review of every new or modified line in `src/preload/operator.ts`, `src/shared/bridge-api.ts`, `src/main/operator/**`, and any redaction list change. Reviewer cites P8 + AD-1 explicitly per finding. — produces `specs/004-operator-session/security-review/s1-review.md`
- [ ] T036 [P] Verify cross-process redaction smoke (T025) passes with the merged S1 code; no PIN values, Clerk JWTs, or session tokens leaked to log/Sentry/snapshot surfaces — `specs/004-operator-session/security-review/s1-redaction-evidence.md`
- [ ] T037 [P] Verify the `requireRole` invocation appears at the first executable instruction of every operator-aware bridge handler in S1's diff — recorded in `specs/004-operator-session/security-review/s1-review.md`
- [ ] T038 Mark `s1-review.md` `result` as `approved` / `approved-with-revisions` / `sent-back-for-rework`. If `sent-back-for-rework`, file follow-up tasks against S1; the gate does not clear until they resolve.

**Checkpoint S2:** `s1-review.md` exists with explicit `result` field. Phases 5+ (S3) cannot begin without S2 clear.

---

## Phase 5 — Slice S3: Audit-event scaffolding `[BLOCKED: §A1, §A2 (S3 endpoint), §A3 (audit_events migration)]`

**Purpose:** Establish the local audit-event durability layer (`audit_events` table, P4 append-only, P5 client-UUID idempotency, local outbox + backend sync). The action-category catalogue placeholder consumers (`shift.open`, `shift.close`, `shift.forced_close`, `operator.session.takeover`, `cashier.pin.reset`, `cashier.pin.unlock`) land here; full takeover-and-forced-close UX lands in S4 / S5.

**Gates (ALL must clear before S3 implementation tasks may start):**
- ⏳ §A1 ✅ (per task generation rules)
- ⏳ §A2 (S3 endpoint) — backend `POST /v1/audit-events` recognised
- ⏳ §A3 — `audit_events` migration approved
- S2 must be merged.

### Phase 5 — Tests

- [x] T039 [P] [US3] **`[BLOCKED: §A1]`** Unit test: `src/main/audit/audit-emitter.ts` rejects audit-event submissions missing any of the FR-025 mandatory five attributes (`acting_operator_id`, `shift_id` *unless null is allowed for category*, `originating_terminal_id`, `created_at`, `action_category`) — `tests/unit/main/audit/audit-emitter.test.ts`
- [x] T040 [P] [US3] **`[BLOCKED: §A1]`** Unit test: idempotency — submitting the same `event_id` twice produces one row in `audit_events` (P5) — `tests/unit/main/audit/audit-emitter-idempotency.test.ts`
- [x] T041 [P] [US3] **`[BLOCKED: §A1, §A3]`** Integration test: SQLite `audit_events` table refuses `UPDATE` and `DELETE` via raw SQL (schema-level append-only enforcement; AD-3 / FR-028) — `tests/integration/main/audit/audit-events-append-only.test.ts`
- [x] T042 [P] [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Integration test: crash/restart path — an audit event written before crash is still in the outbox after restart and is re-attempted on next sync — `tests/integration/main/audit/audit-events-durability.test.ts`
- [x] T043 [P] [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Integration test: network-failure path — failed sync keeps the event in outbox; reconnect triggers retry; backend duplicate-`event_id` is silently deduped (P5) — `tests/integration/main/audit/audit-events-sync.test.ts`
- [x] T044 [P] [US3] **`[BLOCKED: §A1]`** Unit test: `payload` redaction — submissions whose `payload` contains forbidden field names (raw cardholder data, full PII, credential fragments, PIN values, session tokens, Clerk JWTs) are refused at the bridge handler (FR-027 / PR-1) — `tests/unit/main/audit/audit-emitter-redaction.test.ts`

### Phase 5 — Implementation `[BLOCKED: §A1, §A2 (S3), §A3]`

- [x] T045 [US3] **`[BLOCKED: §A1, §A3]`** Migration `migrations/NNN_audit_events.sql`: `audit_events` table with append-only triggers (deny `UPDATE`, deny `DELETE`), unique `(event_id, tenant_id)` index, plus the sibling `audit_events_sync_state` table for the mutable `synced_at` column. Schema per data-model.md §"Entity 5 — AuditEvent". — depends on §A3 approval
- [x] T046 [US3] **`[BLOCKED: §A1]`** Implement `src/main/audit/audit-emitter.ts` exposing `emitAuditEvent(req: EmitAuditEventRequest)` per contracts/bridge-api.md call 10. The emitter: validates the FR-025 five attributes; runs the redaction allowlist check on `payload`; writes to `audit_events` in the same transaction as any caller-provided side effects; returns `EmitAuditEventResponse` — depends on T045, T015
- [x] T047 [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Implement the local outbox + sync loop in `src/main/audit/audit-sync.ts`: extends 001's existing offline-queue if reusable (research §5; otherwise parallel implementation). Calls `POST /v1/audit-events` with batches; honours the response's `accepted` / `duplicates` / `rejected` envelope. — depends on T046
- [x] T048 [US3] **`[BLOCKED: §A1]`** Wire `operator.emitAuditEvent` bridge call (typed in T014) to the main-process emitter — `src/preload/operator.ts` adds the export; `src/main/operator/bridge-handlers.ts` dispatches — depends on T046, T014
- [x] T049 [P] [US3] **`[BLOCKED: §A1]`** Add per-action-category schemas in `src/shared/audit/payload-schemas.ts`: at minimum `shift.open`, `shift.close`, `shift.forced_close`, `operator.session.takeover`, `cashier.pin.reset`, `cashier.pin.unlock` (the latter two ship in S4; their schemas land here as types only). Per data-model.md §"Action Category Catalogue". — depends on T013
- [x] T050 [US3] **`[BLOCKED: §A1]`** Extend `pino` redaction list and Sentry scrubber rules for: `audit_events.payload` (already redacted by allowlist; defence in depth), session tokens, Clerk JWTs (P11 alignment) — `src/main/logger/redaction.ts` extension and `src/main/sentry-scrubber.ts` if it exists; otherwise note in a redaction-config file — depends on T046
- [x] T051 [US3] **`[BLOCKED: §A1]`** Add a debug bridge call `operator.emitAuditEvent.test` for S3 quickstart smoke (placeholder action category, manager-only role gate, never reachable in production builds — gated by `process.env.NODE_ENV !== 'production'`) — depends on T048

#### C2 addendum — FR-014 + account-disabled-mid-session lifecycle terminators (added 2026-05-05)

Two test+implementation pairs covering the spec's session-termination cascade for: (a) terminal token / device-token revocation under FR-014 + the "Terminal token revoked while operator signed in" Edge Case, and (b) the "Operator account disabled mid-session" Edge Case. Both end the active operator session immediately, with distinct `end_cause` values per data-model.md §"Entity 2 — OperatorSession". Both ship in S3 because they consume the audit-emitter (T046) for the lifecycle audit event.

- [x] T051a [P] [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Integration test: terminal-token revocation cascade — given an active operator session on a paired terminal, when the device token is revoked (e.g., the platform admin app revokes it; 002's existing `401 device_revoked` path fires), then the operator session terminates within the next bridge call, the `operator_sessions` row records `end_cause = 'terminal_session_terminated'`, the shell returns to 002's pre-pairing surface (NOT to `/sign-in` — the terminal is no longer paired), and offline-queued audit events from this session remain in the local outbox for later sync (P3 — no silent data loss) — `tests/integration/main/operator/terminal-revocation-cascade.test.ts`
- [x] T051b [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Implement terminal-revocation listener in `src/main/operator/lifecycle-cascade.ts`: subscribes to 002's existing device-token-revocation signal; on revocation, terminates any active operator session with `end_cause = 'terminal_session_terminated'`; emits no PIN values or credential fragments in any log line; the cascade event itself is NOT a sensitive-action audit event (FR-014 governs session termination, not action attribution; the operator-session row is the durable record), but a low-severity diagnostic log entry MAY be written via `pino` with the operator id as an opaque reference per FR-032 — depends on T046, T028
- [x] T051c [P] [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Integration test: operator-account-disabled-mid-session cascade — given an active operator session, when the operator's Clerk account becomes disabled (detected on the next privileged bridge call returning a generic 401 / disabled-account refusal), then the operator session terminates with `end_cause = 'account_disabled_mid_session'`, the shell returns to `/sign-in` (the terminal IS still paired; only the operator's account is disabled), the user-visible message is generic per NFR-003 / PR-2 ("credentials not recognised"), and the cascade is durable across application restart — `tests/integration/main/operator/account-disabled-cascade.test.ts`
- [x] T051d [US3] **`[BLOCKED: §A1, §A2 (S3)]`** Implement account-disabled listener in `src/main/operator/lifecycle-cascade.ts` (extends the same module from T051b): on detecting a disabled-account response from any privileged bridge call, terminates the active operator session with `end_cause = 'account_disabled_mid_session'`; the cascade is generic to the user (no disclosure that the account specifically was disabled vs another failure mode); a low-severity diagnostic log entry MAY be written with the opaque operator id per FR-032; the operator-session row is the durable record — depends on T046, T028, T051b

**Checkpoint S3: ✅ COMPLETE (2026-05-07)** — All S3 tasks merged via PRs #49–#56 (HEAD `ba32133`). Audit-event scaffold is durable; append-only enforcement verified; sync loop reconciles on reconnect; cross-process redaction smoke passes; terminal-revocation and account-disabled cascades implemented with correct `end_cause` values. Quickstart Slice 3 walkthrough passes.

---

## Phase 6 — Slice S4: Cashier sign-in (PIN as local terminal unlock factor) `[BLOCKED: §A1, §A2 (S4 endpoints), §A3, §A4]`

**Purpose:** Deliver the cashier path of US1 (operator sign-in) plus the takeover flow (FR-013), plus PR-5 manager-attributable PIN reset and PR-3 manager-attributable unlock. Cashier roster activates; PIN pad becomes interactive; `cashier_pin_records` table is created; Argon2id verifier lands; bridge surface gains the cashier path.

**Slice 0 reviewer Note 2 lands here:** S4 must add the stuck-shift count badge visibility row to `role-visibility-matrix.md` §Section 3 (visible only to manager/admin; not at icon-only viewport width).

**Gates (ALL must clear before S4 implementation tasks may start):**
- ⏳ §A1 ✅ (load-bearing — cashier PIN is the local-unlock-factor approval body)
- ⏳ §A2 (S4 endpoints) — `GET /v1/operators/roster?branch_id=`, `POST /v1/operators/takeover/confirm`
- ⏳ §A3 — `cashier_pin_records` and `operator_sessions` migrations approved
- ⏳ §A4 — `argon2` package installed and pinned in `package.json`
- S3 must be merged.

### Phase 6 — Tests

- [x] T052 [P] [US1] **`[BLOCKED: §A1, §A4]`** Unit test: `src/main/operator/pin-credential.ts` Argon2id verifier — correct PIN passes; wrong PIN fails; `failed_attempt_count` increments; lockout triggers at 5 failures within 5 minutes; lockout state persists across simulated restart — `tests/unit/main/operator/pin-credential.test.ts`
- [x] T053 [P] [US1] **`[BLOCKED: §A1, §A4]`** Unit test: PR-1 redaction — Argon2id verifier never logs the input PIN, never includes the PIN in any thrown error, never persists the plaintext PIN to disk in any form. Cross-process redaction smoke (extends T025) — `tests/integration/cross-process-redaction.test.ts` (extension)
- [x] T054 [P] [US1] **`[BLOCKED: §A1, §A4]`** Unit test: PR-3 lockout policy — 5 failures in 5 min triggers lockout; subsequent attempts return `rate_limited` even with the correct PIN; timer expiry releases lockout; manager unlock releases lockout — `tests/unit/main/operator/pin-credential-lockout.test.ts`
- [x] T055 [P] [US1] **`[BLOCKED: §A1]`** Unit test: PR-4 per-terminal scope — a `cashier_pin_records` row keyed by `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)` is unreadable on a different terminal_id even within the same tenant + branch — `tests/unit/main/operator/pin-credential-scope.test.ts`
- [ ] T056 [P] [US1] **`[BLOCKED: §A1, §A2 (S4), #101]`** Integration test: takeover flow — operator already has active session on terminal A; sign-in on terminal B detects existing session; `TakeoverPrompt` mounts; "Continue here" → terminal A's session ends with `superseded_by_takeover`; terminal A returns to `/sign-in` within 30 s; `operator.session.takeover` audit event emitted with both terminals referenced (FR-013 / FR-026) — `tests/integration/renderer/takeover.test.tsx`
- [ ] T057 [P] [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Integration test: takeover cancellation — "Cancel" closes prompt; no session created on B; A unaffected (FR-013) — `tests/integration/renderer/takeover-cancel.test.tsx`
- [ ] T058 [P] [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Integration test: takeover prompt minimum-disclosure — modal copy matches FR-013 exactly; no terminal-A label, no timestamp, no other-operator data appears in the rendered DOM (snapshot the modal with assertion that forbidden strings are absent) — `tests/integration/renderer/takeover-prompt-disclosure.test.tsx`
- [ ] T059 [P] [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Integration test: cashier sign-in success path — pick from roster + 4-digit PIN + Enter → shell mounts, OperatorBadge populated, `failed_attempt_count` reset to 0, NFR-006 5 s budget honoured — `tests/integration/renderer/cashier-sign-in.test.tsx`
- [ ] T060 [P] [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Integration test: PIN-pad submit-disabled below 4 digits; Enter no-op below 4 digits; aria-disabled on the Enter key when below 4 digits — `tests/unit/renderer/ui/operator/pin-pad.test.tsx`
- [x] T061 [P] [US1] Integration test: PR-5 manager PIN reset flow — manager signs in, navigates to cashier-management surface, picks cashier, enters new PIN, submits; `cashier.pin.reset` audit event emitted (manager attributed, cashier referenced); PIN value never in audit payload (PR-1) — `tests/integration/renderer/pin-reset.test.tsx`
- [x] T062 [P] [US1] Integration test: PR-3 manager unlock flow — locked-out cashier; manager invokes `cashier.pin.unlock`; lockout clears; `cashier.pin.unlock` audit event emitted — `tests/integration/renderer/pin-unlock.test.tsx`

### Phase 6 — Implementation `[BLOCKED: §A1, §A2 (S4), §A3, §A4]`

- [x] T063 [US1] **`[BLOCKED: §A1, §A4]`** Install `argon2` package via `npm install argon2 --save-exact`, pin version in `package.json`. Single-purpose PR; reviewed against constitution Tech Stack rules. — depends on §A4 approval
- [x] T064 [US1] **`[BLOCKED: §A1, §A3]`** Migration `migrations/NNN_cashier_pin_records.sql`: per data-model.md §"Entity 6 — CashierPinRecord". Composite primary key `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)`. Includes `pin_hash`, `pin_salt`, `failed_attempt_count`, `lockout_until`, `created_at`, `created_by_operator_id`. — depends on §A3 approval
- [x] T065 [US1] **`[BLOCKED: §A1, §A3]`** Migration `migrations/NNN_operator_sessions.sql`: per data-model.md §"Entity 2 — OperatorSession". Includes the partial unique index on `(acting_operator_id, end_at IS NULL)` for single-active-session enforcement (FR-013). — depends on §A3 approval
- [x] T066 [US1] **`[BLOCKED: §A1, §A4]`** Implement `src/main/operator/pin-credential.ts` Argon2id verifier with research §1 parameters (`m_cost=64MiB`, `t_cost=3`, `p_cost=1`, salt 16 bytes, output 32 bytes). The verifier holds the PIN in memory only for the verification span; the input is consumed and discarded; the salt is read from the row, the hash is compared via `argon2.verify`. — depends on T063, T064
- [x] T067 [US1] **`[BLOCKED: §A1]`** Implement PR-3 lockout state machine in `src/main/operator/pin-lockout.ts`: tracks `failed_attempt_count` per row; transitions to `lockout_until = now + 5 min` at attempt 5; release paths (timer expiry, `operator.unlockCashier`); 5-minute rolling window for the failure count — depends on T066
- [x] T068 [US1] **`[BLOCKED: §A1]`** Implement `safeStorage` seal for `cashier_pin_records` rows: write-time seal of the row's hash + salt; read-time unseal; production refuses to start if `safeStorage.isEncryptionAvailable() === false` (constitution v1.3.0). — depends on T064
- [x] T069 [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Implement cashier path of `operator.signIn` in `src/main/operator/sign-in-handler.ts`: roster lookup against the local operator-identity cache (Clerk identity provisioned at cashier onboarding by manager/admin); PIN verification via T066/T067; **on PIN success, calls T069b's `checkActiveSession` helper before creating the local session — if helper returns `active`, the bridge call returns `TakeoverRequiredResponse` to the renderer instead of `signed_in`, and no `operator_sessions` row is created locally**; on `none`, creates `operator_sessions` row using the **stable Clerk-backed cashier identity** (not the PIN-record id; AD-2 / AD-3) — depends on T026, T066, T067, T046, T069b

#### U1 addendum — cashier-path takeover detection helper (added 2026-05-05)

- [x] T069a [P] [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Unit test: `operator.checkActiveSession` main-side handler — given a Clerk user id, calls backend Endpoint 6 (`GET /v1/operators/active-session?operator_id=...`) and returns the binary result `{kind: 'none' | 'active'}`; never sends a PIN field, header, or query parameter; the response shape is exactly the binary envelope (no terminal id, no timestamp, no operator metadata leaks per FR-013); a 4xx response (operator not authorised on this branch / device token invalid) maps to `OperatorRefusal { category: 'invalid_input' }` and the renderer surfaces a generic NFR-003 message; a 5xx response maps to `no_connection` — `tests/unit/main/operator/check-active-session.test.ts`
- [x] T069b [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Implement `src/main/operator/check-active-session.ts` exposing `checkActiveSession(operatorId: string): Promise<{kind: 'none' | 'active'}>`. Calls backend Endpoint 6 (per `contracts/backend-endpoints.md` Endpoint 6, added 2026-05-05). The helper is *internal-only* — it is NOT exposed as a renderer-facing bridge call; the cashier sign-in handler (T069) consumes it directly. **MUST NOT accept any PIN parameter or pass any PIN data to the backend** (AD-2 invariant). The response is consumed and discarded except for the binary `kind` value; no caching of the response between sign-in attempts. — depends on T015, T046

#### U2 addendum — terminal-A notification mechanism (added 2026-05-05)

- [x] T069c [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Decision task (non-code; produces a markdown record). Decide whether terminal A discovers the takeover via **passive polling** (`operator.getCurrentSession` periodic call discovering `end_at IS NOT NULL`) or **active push** (a backend-side notification channel signalling terminal A directly). Record the decision, the rationale, and any backend-side dependency (e.g., a WebSocket channel name if active is chosen) by editing `specs/004-operator-session/research.md` §3 addendum (the addendum stub already exists; this task fills it). The decision MUST honour the constraints documented in the addendum: terminal A MUST NOT accept new sensitive-action interactions during the takeover window; the user-visible signal MUST be generic ("you have been signed out — please sign in again"); MUST NOT introduce a new IPC channel beyond the `operator.*` namespace. — produces edit to `specs/004-operator-session/research.md` only; no source code in this task

- [x] T070 [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Implement `operator.confirmTakeover` in `src/main/operator/takeover-handler.ts`: emits `operator.session.takeover` audit event via T046; updates the prior session's `end_at` and `end_cause = 'superseded_by_takeover'`; new session created on the current terminal; **the prior-terminal notification mechanism (passive polling vs active push) follows the decision recorded in T069c's research.md §3 addendum** — depends on T046, T069, T069c

#### C3 addendum — operator.listBranchRoster main-side handler (added 2026-05-05)

The `operator.listBranchRoster` bridge call is consumed by T075 (cashier sign-in surface activation) but had no dedicated implementation task in the original tasks.md (analyze finding C3). Adding it here in S4, before T075's consumer reference.

- [x] T070a [P] [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Unit test: `operator.listBranchRoster` main-side handler enforces response redaction and branch scoping per `contracts/bridge-api.md` Call 1 — only `{id, display_name, role}` per cashier crosses the bridge; the response MUST NOT include email, phone, password hash, PIN material, audit history, or any other operator-level field; manager and admin role rows are NOT in the response (cashiers only); the call is constrained server-side to the terminal's paired branch (the test mocks the backend response and asserts the renderer-visible shape strictly) — `tests/unit/main/operator/roster-handler.test.ts`
- [x] T070b [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Implement `src/main/operator/roster-handler.ts` exposing the main-side handler for `operator.listBranchRoster`: calls backend `GET /v1/operators/roster?branch_id=` (Endpoint 1) with the terminal's paired-branch claim from the device token; on response, runs an explicit allowlist filter that strips every field except `{id, display_name, role}` per cashier (defence in depth — even if the backend accidentally returns extra fields, they MUST NOT cross the bridge); refuses generically on backend failure modes (network unreachable → `no_connection`; tenant/branch mismatch → `invalid_input` per NFR-003 / PR-2); never logs cashier display names in `pino` lifecycle logs (FR-032 — opaque references only) — depends on T015, T014
- [x] T071 [US1] **`[BLOCKED: §A1]`** Implement `operator.cancelTakeover` (no audit event; no session change; renderer state returns to `signedOut`) — depends on T016
- [x] T072 [US1] Implement `operator.resetCashierPin` in `src/main/operator/pin-management.ts`: requireRole `manager` or `admin`; writes new Argon2id hash + salt; resets `failed_attempt_count` and `lockout_until`; emits `cashier.pin.reset` audit event (manager-attributed, target cashier referenced; PIN value never in payload — PR-1) — depends on T015, T046, T066
- [x] T073 [US1] Implement `operator.unlockCashier` in `src/main/operator/pin-management.ts`: requireRole `manager` or `admin`; resets lockout state; emits `cashier.pin.unlock` audit event — depends on T015, T046
- [x] T074 [P] [US1] **`[BLOCKED: §A1]`** Implement `src/renderer/ui/operator/PinPad.tsx`: 4–6 digit entry, ≥ 44 × 44 CSS px touch targets, hardware-numpad input, Enter disabled below 4 digits with `aria-disabled` — `src/renderer/ui/operator/PinPad.tsx`
- [x] T075 [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Activate cashier path on `src/renderer/routes/sign-in.tsx`: roster fetched via `operator.listBranchRoster` (handler implemented by T070b); PinPad becomes interactive on roster pick; submit calls `operator.signIn` cashier variant; auto-advances focus per visual-direction §"Surface 1" — depends on T029, T030, T074, T069, T070b
- [x] T076 [P] [US1] **`[BLOCKED: §A1]`** Implement `src/renderer/ui/operator/TakeoverPrompt.tsx`: `Dialog`-based modal with three buttons (Continue here / Cancel / generic close); generic copy verbatim per FR-013; no terminal-A label, no timestamp, no other-operator data — depends on T016
- [x] T077 [US1] **`[BLOCKED: §A1, §A2 (S4)]`** Wire takeover flow on the renderer: `signingIn` → if response is `takeover_required` → transition to `takeoverPrompt`; "Continue here" calls `operator.confirmTakeover`; "Cancel" calls `operator.cancelTakeover` — depends on T076, T070, T071
- [ ] T078 [US2] **`[BLOCKED: §A1]`** Implement manager-only cashier-management surface at `/app/manager/cashiers`: list cashiers on this branch with `[Reset PIN]` and `[Unlock]` actions (PR-5). Visibility controlled by `<OperatorRouteGuard role="manager">`. — depends on T017, T072, T073
- [ ] T079 [US2] **`[BLOCKED: §A1]`** **Note 2 (Slice 0) acceptance**: Add a row to `specs/004-operator-session/contracts/role-visibility-matrix.md` §Section 3 covering "stuck-shift count badge" visibility: `cashier=⛔`, `manager=👀`, `admin=👀`; not visible at 1024–1279 px icon-only viewport. (No code in this task; documentation update.) — depends on T078 PR landing
- [ ] T080 [US2] **`[BLOCKED: §A1]`** Implement the navigation count badge for the stuck-shift list (visibility per Note 2 / T079); badge hidden at icon-only viewport; never visible to cashiers — depends on T079, T017
- [ ] T081 [US1] **`[BLOCKED: §A1]`** Add `pino` log sites with PR-1 redaction for: PIN failure outcome category, lockout-triggered, lockout-released, PIN reset, PIN unlock. Verify cross-process redaction smoke (T053) passes after this. — depends on T066, T072, T073
- [ ] T082 [P] [US2] **`[BLOCKED: §A1]`** Update `src/renderer/routes/operator-route-guard.tsx` to also enforce all role-visibility-matrix.md §Section 3 routes (cashier-management, stuck-shifts list, etc.); regenerate the compiled-in matrix object — depends on T017, T079

**Checkpoint S4 (in progress — 2026-05-11):** T052–T077, T072, T073 complete (PRs #59/#60/#61/#63/#64/#90/#91/#92/#93/#94/#99/#100/#103). Dev bootstrap stabilised by PR #105 (CSP + preload Vite bundle). Remaining: T078–T082. Full S4 checkpoint cannot be declared until all S4 tasks complete AND #101 (terminal-A session-invalidation gap) is resolved or explicitly waived. Once T078–T082 merge and #101 is resolved/waived → update coordination.md and close #87.

---

## Phase 7 — Slice S5: Forced-close manager recovery surface `[BLOCKED: §A1, §A2 (S5)]`

**Purpose:** Deliver US3 (audit attribution + blind shift close) by completing the manager-attributable forced-close recovery flow. The stuck-shift list, the forced-close form (Surface 4A + 4B from visual direction), the `shift.forced_close` audit event with `shift_owner` + `forced_close_actor` attribution, and the cashier-returns-after-forced-close informational banner.

**Slice 0 reviewer Note 3 lands here:** S5 should default Surface 4A to card-stack rendering unless integration-time density evidence argues otherwise.

**Gates:**
- ⏳ §A1 ✅
- ⏳ §A2 (S5) — backend recognises `shift.forced_close` audit category
- S4 must be merged.

### Phase 7 — Tests

- [ ] T083 [P] [US3] **`[BLOCKED: §A1]`** Unit test: `<ForcedCloseSurface>` renders only the read-only summary (cashier name, opened-at, terminal label, duration); MUST NOT render a drawer-count entry, expected-total display, variance, shortage, overage (FR-024(a) blind-close discipline) — `tests/unit/renderer/ui/operator/forced-close-surface.test.tsx`
- [ ] T084 [P] [US3] **`[BLOCKED: §A1]`** Unit test: forced-close form reason picker — submit disabled until a radio is selected; only the five enumerated values (`takeover_supersession`, `cashier_no_show`, `cashier_illness`, `terminal_failure`, `other`) accepted; free-text annotation lives in `payload.annotation`, never in `payload.forced_close_reason` (FR-024(c)) — `tests/unit/renderer/ui/operator/forced-close-form.test.tsx`
- [ ] T085 [P] [US3] **`[BLOCKED: §A1, §A2 (S5)]`** Integration test: forced-close audit event emission — manager submits forced-close with reason `takeover_supersession`; the emitted `shift.forced_close` audit event has `acting_operator_id = manager`, `shift_owner_id = absent_cashier`, `forced_close_actor_id = manager`, `forced_close_reason = takeover_supersession`. Cashier's `declared_count` recorded as `null` / **absent** (distinct from zero, distinct from matched). — `tests/integration/main/operator/forced-close.test.ts`
- [ ] T086 [P] [US3] **`[BLOCKED: §A1]`** Integration test: takeover ↔ forced-close separation — a takeover that strands a shift produces an `operator.session.takeover` audit event AND, when the manager later force-closes, a separate `shift.forced_close` event. Both are independently retrievable; neither implies the other; they are NOT merged into a single record (FR-013 + FR-024 + Edge Cases) — `tests/integration/main/operator/takeover-forced-close-separation.test.ts`
- [ ] T087 [P] [US3] **`[BLOCKED: §A1]`** Integration test: cashier-returns-after-forced-close banner — cashier whose shift was force-closed signs back in; shell shows the informational banner per visual-direction §"Surface 6 cashier-returns banner"; banner does NOT display expected total, declared count (null), variance, shortage, overage, the closing manager's reason category, or the closing manager's annotation (FR-024 + Edge Cases) — `tests/integration/renderer/cashier-returns-banner.test.tsx`
- [ ] T088 [P] [US2] **`[BLOCKED: §A1]`** Integration test: cashier role enumeration — cashier signed in on terminal A enumerates every navigable route, deep-link path, search query, quick-action; reaches zero ⛔ rows from role-visibility-matrix.md §Section 3 (SC-003 walkthrough automated, ≥ 20 access paths) — `tests/integration/renderer/cashier-route-enumeration.test.tsx`

### Phase 7 — Implementation `[BLOCKED: §A1, §A2 (S5)]`

- [ ] T089 [US3] **`[BLOCKED: §A1, §A2 (S5)]`** Implement `operator.forceCloseShift` in `src/main/operator/forced-close-handler.ts`: requireRole `manager` or `admin`; verifies the calling session's `branch_id` matches the stuck shift's `branch_id` (P17); writes shift's `lifecycle_state = 'closed_forced'` and `declared_count = null` (the absent state); emits `shift.forced_close` audit event with both identities and the structured reason — depends on T015, T046
- [ ] T090 [US3] **`[BLOCKED: §A1, §A2 (S5)]`** Implement `src/renderer/ui/operator/ForcedCloseSurface.tsx` (Surface 4A — stuck-shift list + Surface 4B — forced-close form). **Note 3 (Slice 0) acceptance: default to card-stack rendering for the row list per visual-direction reviewer lean; revisit only if integration-time density evidence argues otherwise.** — depends on T017, T076
- [ ] T091 [US3] **`[BLOCKED: §A1]`** Implement the cashier-returns-after-forced-close banner in `src/renderer/ui/operator/ShiftClosedBanner.tsx`: dismissable info banner using 003's `Banner` primitive; copy per visual-direction §"Surface 6 cashier-returns banner"; never shows the forbidden financial details — depends on T031
- [ ] T092 [US2] **`[BLOCKED: §A1]`** Mount `/app/manager/stuck-shifts` route guarded by `<OperatorRouteGuard role="manager">`; renders `<ForcedCloseSurface>`. Cashier role MUST NOT reach this route (NFR-009). — depends on T017, T090
- [ ] T093 [US3] **`[BLOCKED: §A1]`** Add `pino` log sites with PR-1 redaction for: forced-close attempt outcome, takeover-stranded-shift detection, cashier-returns-banner display — depends on T089

**Checkpoint S5:** Manager can list stuck shifts on their branch, force-close one, observe the audit event with both identities and `declared_count = null`. Cashier returning sees the informational banner without financial leakage. Cashier signed in on the same terminal sees nothing about stuck shifts. Quickstart Slice 5 walkthrough passes (steps 1–11). Note 3 reviewer-finding honoured (card-stack default).

---

## Phase 8 — Slice S6: Final polish (small) `[BLOCKED: prior slices merged]`

**Purpose:** Polish, runbook, and final consistency review against Slice 0's contact sheet. Per Constitution P13: this slice MUST be small.

**Gates:**
- All of S0, S1, S2, S3, S4, S5 must be merged.

- [ ] T094 [P] Screenshot/contact-sheet review: capture each surface (Surfaces 1–6) in their default state on a `windows-latest` build and compare against the visual-direction contact sheet. Record findings in `specs/004-operator-session/visual-direction/s6-screenshot-review.md`. Any inconsistency = a follow-up task; small inconsistencies fix-up here.
- [ ] T095 [P] Create `docs/runbook/operator-session.md` with five sections: "I can't sign in" (5 generic causes + diagnostic steps), "What is this takeover prompt", "How do I close a stuck shift", "Inactivity timeout policy", "PIN lockout and reset procedure" — `docs/runbook/operator-session.md`
- [ ] T096 [P] Update support-bundle export tooling to include `audit_events` (with operator identifiers redacted to opaque references; PIN values appear nowhere; Clerk JWTs scrubbed). Verify with manual support-bundle export of a terminal with at least 50 audit events. — extends existing 001 support-bundle plumbing
- [ ] T097 Update `<!-- SPECKIT START -->` block in `CLAUDE.md` to mark 004 complete and point at the next active feature (or `none — pending next /speckit-specify`). — `CLAUDE.md`
- [ ] T098 Update `coordination.md` to mark all coordination items ✅ and §A5 active for the production-rollout PR — `specs/004-operator-session/coordination.md`
- [ ] T099 Update `specs/004-operator-session/checklists/requirements.md` with a final "implementation complete" iteration block — `specs/004-operator-session/checklists/requirements.md`

#### C4 addendum — SC-005 aggregate audit-attribution review (added 2026-05-05)

- [ ] T099a [P] Tabletop SC-005 review: walk every sensitive-action category enumerated in FR-026 (refunds, voids, price overrides, discount overrides above threshold, drawer kicks outside a sale, receipt reprints, `shift.open`, `shift.close`, `shift.forced_close`, shift reviews, supervisor approvals, `operator.session.takeover`, `cashier.pin.reset`, `cashier.pin.unlock`) — at least 10 categories — and confirm for each that the audit-event payload schema in `src/shared/audit/payload-schemas.ts` requires the FR-025 mandatory five attributes (`acting_operator_id`, `shift_id` *unless null is documented for that category*, `originating_terminal_id`, `created_at`, `action_category`). For categories owned by 004 (forced close, takeover, PIN reset, PIN unlock), confirm the additional structural fields per data-model.md §"Action Category Catalogue" (`shift_owner` / `forced_close_actor` / `forced_close_reason` for forced close; `superseded_session_id` / `prior_terminal_reference` for takeover; etc.). For categories owned by future features (refunds, voids, etc.), record that the attribution rule is reserved and not yet implemented — but the rule is documented and any future feature implementing the category MUST honour FR-025 + FR-026. Record the review outcome in `specs/004-operator-session/security-review/sc-005-audit.md` with: per-category checkmarks; any gaps found; the closing claim that SC-005 is satisfied for the 004-owned subset and reserved for future-feature subset. — non-code task; produces only the markdown audit record

**Checkpoint S6:** All quickstart walkthrough steps pass end-to-end. Final-polish PR is ≤ ~200 LOC diff (Constitution P13 / FR-035). 004 is feature-flagged on `main`; production rollout requires §A5 sign-off (separate PR, not in this slice). **Plus**: SC-005 aggregate review record exists at `specs/004-operator-session/security-review/sc-005-audit.md`.

---

## Cross-cutting & Production-Readiness tasks (track separately; not part of slice merges)

These tasks live for the duration of the feature's life and are NOT part of any single slice's merge.

- [ ] T100 §A5 production-readiness checklist: validate test plan coverage, rollback strategy, support-runbook entry presence, failure-mode catalogue, operational readiness expectations per plan.md §"Production Readiness". Sign-off required before production rollout PR may merge. — `specs/004-operator-session/production-readiness.md` (created at this point)
- [ ] T101 [P] Per-tenant rollout sequence agreed with customer-success team: pilot pharmacy enables the flag for one branch first; full-tenant rollout after one week of pilot signal. Documented in `production-readiness.md`.
- [ ] T102 [P] Customer-facing onboarding documentation updated to cover PIN-lockout policy and manager unlock procedure (PR-3 / PR-5).

---

## Dependency graph (slice-level)

```
S0 (Visual Direction) ✅
  │
  ├──► §A1 ✅ (PR #39, SHA 7ae337b, 2026-05-05)
  ├──► §A2 Wave 1 ✅ + Wave 2 ✅ (Waves 3–4 downstream)
  ├──► §A3 ✅ (PR #49, SHA e50f5b8 — audit_events; operator_sessions + cashier_pin_records S4)
  │
  ├──► Phase 1: Setup (T001–T005) ✅
  │
  ├──► Phase 2: Foundational (T006–T017) ✅
  │       │
  │       └──► Phase 3 (S1): Manager/admin sign-in (T018–T034) ✅ (PR #46)
  │               │
  │               └──► Phase 4 (S2): Bridge security review (T035–T038) ✅ (PR #47)
  │                       │
  │                       └──► Phase 5 (S3): Audit scaffolding (T039–T051d) ✅ (PRs #49–#56, HEAD ba32133)
  │                               │
  │                               └──► Phase 6 (S4): Cashier sign-in (T052–T082) ──── IN PROGRESS (T052–T077/T072/T073 ✅; T078–T082 remaining; #101 open; #85 closed)
  │                                       │
  │                                       └──► Phase 7 (S5): Forced close (T083–T093) ──── BLOCKED on S4 + §A2 Wave 4
  │                                               │
  │                                               └──► Phase 8 (S6): Final polish (T094–T099) ──── BLOCKED on prior slices merged
  │                                                       │
  │                                                       └──► Production rollout (T100–T102) ──── BLOCKED on §A5
```

---

## Parallel opportunities

Within each phase, tasks marked **`[P]`** can run concurrently. Highlights:

- **Phase 2:** T006–T011 (tests) all in parallel; T012, T013, T015 in parallel; T014 depends on T012+T013; T016 depends on T012; T017 depends on T012/T013/T016.
- **Phase 3 (S1):** T018–T025 (tests) all in parallel; T026 → T027 → T028 sequential due to handler chaining; T029, T030, T031 in parallel after T016/T012.
- **Phase 5 (S3):** T039–T044 (tests) in parallel; T046 depends on T045 + T015; T047 depends on T046; T048 depends on T046/T014; T049, T050 in parallel after T013/T046.
- **Phase 6 (S4):** T052–T062 (tests) all in parallel after gates clear; T063 → T064/T065 in parallel → T066/T067 → T068 → T069/T070/T071/T072/T073; UI tasks T074, T076 in parallel; T075, T077 sequential due to UI wiring.
- **Phase 7 (S5):** T083–T088 (tests) all in parallel; T089 → T090/T091/T092 sequential.
- **Phase 8 (S6):** T094–T099 mostly in parallel (different files).
- **Cross-cutting:** T100–T102 in parallel.

---

## Independent test criteria per user story

| User story | Slice that delivers it | Independent test (from spec.md / quickstart.md) |
|:--|:--|:--|
| **US1 — Operator sign-in (P1)** | S1 (manager/admin path) + S4 (cashier path) | Pair a terminal, sign in as a manager via Clerk/password, observe the shell with OperatorBadge populated, sign out within 1 s. Repeat as cashier (after S4) via roster + PIN. Verify FR-005, FR-007, FR-008, NFR-006, NFR-007. |
| **US2 — Role-gated visibility (P2)** | S4 (route guard activation) + S5 (manager-only surfaces) | Sign in as cashier; enumerate ≥ 20 navigable / deep-link / refresh / search paths; reach zero ⛔ rows from role-visibility-matrix.md §Section 3 (SC-003 walkthrough automated). Sign in as manager; verify the same surfaces are reachable and populated. |
| **US3 — Blind shift close & audit attribution (P3)** | S3 (audit scaffold) + S5 (forced close) | Trigger a placeholder sensitive action; observe the audit event with the FR-025 five mandatory attributes. Force-close a stuck shift; observe the `shift.forced_close` audit event distinct from any takeover, with `declared_count = null` (absent state). Verify FR-021 / FR-024 / FR-026 / FR-028. |

---

## Suggested MVP scope

**MVP = Slices 0–1–2.** Manager/admin Clerk sign-in only; bridge surface security-reviewed. Delivers US1 partially (the Clerk-backed half) without cashier PIN. Stops short of audit scaffolding (US3) and role-gated visibility (US2 — full implementation requires S4's route-guard activation).

This MVP is coherent because:

1. The team unblocks pharmacy managers to sign in on the paired terminal, even before cashier sign-in is available.
2. The bridge surface security-review (S2) validates the architectural foundation before more code lands on top of it.
3. §A1 (the load-bearing gate) can resolve in parallel with the MVP — its resolution unblocks the larger increment (S3 onward).

The full feature ships when S6 merges and §A5 production-readiness clears.

---

## Format validation

**Updated 2026-05-05 — addendum applied:** total task count is now **114** (102 original + 12 addendum: T028a, T028b, T051a, T051b, T051c, T051d, T069a, T069b, T069c, T070a, T070b, T099a). Addendum coverage by analyze finding:

- **C1 (FR-009 inactivity timer)**: T028a + T028b
- **C2 (FR-014 + account-disabled cascade)**: T051a + T051b (terminal-revocation pair); T051c + T051d (account-disabled pair)
- **U1 (cashier-takeover detection)**: T069a + T069b (paired with `contracts/backend-endpoints.md` Endpoint 6 added 2026-05-05)
- **U2 (terminal-A notification mechanism)**: T069c (decision task; produces edit to `research.md` §3 addendum)
- **C3 (`operator.listBranchRoster` implementation)**: T070a + T070b
- **C4 (SC-005 aggregate review)**: T099a

Existing T### IDs preserved; addendum tasks use `a/b/c` suffixes per the user's surgical-fix instruction. T069 description amended to reference T069b; T070 description amended to reference T069c; T075 description amended to reference T070b. No tasks renumbered.

All **114** tasks follow the strict checklist format:

- ✅ Every task starts with `- [ ]` (markdown checkbox).
- ✅ Every task has a sequential `T###` ID.
- ✅ `[P]` marker is used only on parallelizable tasks (different files, no incomplete dependencies).
- ✅ `[US?]` story label is used in Phase 3+ user-story-aligned phases (US1 / US2 / US3); omitted in Phase 1 (Setup), Phase 2 (Foundational), Phase 4 (Security review gate), Phase 8 (Polish), and cross-cutting tasks per the template's rule.
- ✅ Every implementation task has a clear file path or specifies a documentation artefact path.
- ✅ Every gated task carries an explicit `**Gates:**` block at its phase header AND a `[BLOCKED: <gate>]` annotation on individual tasks.
- ✅ Tests-first per task pair (Constitution VI).

---

## Hard constraints honoured by `/speckit-tasks`

- ✅ No source files created or modified by `/speckit-tasks` itself.
- ✅ No `package.json` changes; no packages installed.
- ✅ No DB migrations created.
- ✅ No OpenAPI changes; `scripts/openapi-snapshot.json` and `src/shared/api-types.ts` untouched.
- ✅ No IPC / preload / main-process / backend implementation.
- ✅ No sales / cart / payments / tender / receipts / inventory / reports / KPIs / analytics work started.
- ✅ No implementation slice started.
- ✅ No PR created.
- ✅ Implementation tasks `[BLOCKED: <gate>]` for §A1 / §A2 / §A3 / §A4 cannot start until their gates clear; this is enforced by the annotation, by the `coordination.md` table's status, and by the Approval Gates summary at the top of this file.

---

**End of tasks.** 114 tasks across 8 phases, slice-organised, gate-explicit, dependency-aware. **S3 complete (2026-05-07)** — all Phase 5 tasks (T039–T051d) merged via PRs #49–#56 (HEAD `ba32133`). Phases 1–5 (S0–S3) done. **S4 in progress (2026-05-10):** T052–T077 complete (PRs #59/#60/#61/#63/#64/#90/#91/#92/#93/#94/#99/#100/#103). Remaining S4 tasks: T072, T073, T078–T082 (cashier-management, PIN reset/unlock, stuck-shift badge, route-guard, redaction log sites). #85 open (cashier-path AD-2), #86 open (owner-discretion closure), #101 open (terminal-A session-invalidation gap). Dev bootstrap stabilised by PR #105. S5 blocked on S4 complete + §A2 Wave 4.
