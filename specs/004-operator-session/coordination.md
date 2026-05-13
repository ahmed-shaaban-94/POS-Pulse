# Coordination — 004-operator-session

**Feature:** 004-operator-session
**Plan:** [./plan.md](./plan.md) v1.1
**Spec:** [./spec.md](./spec.md)
**Visual direction:** [./visual-direction/README.md](./visual-direction/README.md)
**Created:** 2026-05-05
**Last updated:** 2026-05-13 (reconcile S5 in-progress status: T083/T084 ✅ PR #133; T085/T086/T089 ✅ PR #134; T090 ✅ PR #135 SHA `55a4e341ecfcc3a93110043f1df9ba99d181a1ca`; T087/T088/T091/T092/T093 open; S5 NOT complete; issue 88 OPEN; _prior: 2026-05-12 — PR-S5-pre: Wave 4.1 backend merged — Data-Pulse-2 PR #143 (Wave 4.1a, shifts schema) + PR #146 (Wave 4.1b, SHA `74ae848`, endpoint + OpenAPI); `migrations/0007_shifts.sql` added; `getStuckShifts` wired in `backend-client.ts`; Endpoint 7 added to `contracts/backend-endpoints.md`; T089/T090 contract-blocker now removed_)

---

## Purpose

Track project coordination state for 004-operator-session **between Slice 0
completion and `/speckit-tasks` invocation**. This file is intentionally
separate from `visual-direction/README.md` so the visual-direction artifact
remains a stable, reviewable design reference; this file tracks the
coordination state around it.

This file is **not** a tasks file. It does not authorize implementation. It
is the canonical record of "who owns what before `/speckit-tasks` may be
invoked", and it is updated in place as coordination items resolve.

---

## Current phase / status

- **Phase:** **S4 implementation through T082 complete.** Slice 0 ✅
  (approved-with-revisions 2026-05-05). §A1 ✅ (PR #39, SHA `7ae337b`,
  Constitution v1.5.1, 2026-05-05). §A2 Wave 1 ✅ + Wave 2 ✅ + Wave 3 ✅
  (roster + takeover/confirm + active-session, Data-Pulse-2 PR #70,
  2026-05-08). §A3 ✅ fully cleared (audit_events PR #49 SHA `e50f5b8`;
  operator_sessions + cashier_pin_records PR #60, 2026-05-08). §A4 ✅
  (argon2 0.44.0, POS-Pulse PR #59, 2026-05-08). S1 ✅ (PR #46). S2 ✅
  (PR #47). S3 ✅ (PRs #49–#56, HEAD `ba32133`). **S4 implementation through
  T082 complete:** T052–T082 merged via PRs #59/#60/#61/#63/#64/#90/#91/#92/
  #93/#94/#99/#100/#103/#105/#120/#121/#122. PR #120 (PIN management reset/unlock
  — T061/T062/T072/T073). PR #121 (cashier sign-in and takeover UI coverage —
  T057–T060). PR #122 (cashier management, role visibility, stuck-shift badge
  placeholder, route guard, log redaction — T078–T082). **Issue 101 resolved —
  Option A waiver chosen 2026-05-11; Endpoint 6 caller-naive semantics confirmed;
  T056 waived in full — `tests/integration/renderer/takeover.test.tsx` was never
  created; terminal-A renderer assertions require push/probe mechanism out of scope;
  see §"Issue 101 decision" and `docs/issue-101-waiver.md`. S4 final checkpoint UNBLOCKED.** Issue 85 closed
  (cashier-path AD-2 local-only — permanent architectural invariant; see §"Issue
  85 decision"). Issue 86 remains open per owner discretion — PinPad/TakeoverPrompt
  implementation and coverage have landed via PRs #103 and #121. **§A2 Wave 4
  cleared 2026-05-11** — Data-Pulse-2 main (SHA `7b95fdb`) confirms
  `shift.forced_close` recognised in both `POS_AUDIT_ACTION_CATEGORIES` (dto.ts)
  and the OpenAPI `action_category` enum; see §"§A2 Wave 4 clearance" below.
  **PR-S5-pre merged (2026-05-12):** `migrations/0007_shifts.sql` landed; `getStuckShifts`
  wired in `backend-client.ts`; Endpoint 7 added to `contracts/backend-endpoints.md`.
  Wave 4.1 backend (Data-Pulse-2 PR #146, SHA `74ae848`) merged. Both S5 contract
  blockers resolved — T089/T090 `[BLOCKED: stuck-shift-discovery]` qualifier may be
  removed. Issue 88 is ready for S5 implementation (PR-S5-a → PR-S5-b).** 005 remains blocked behind §A0.
- **Slice 0 visual-direction artifact:** present at
  `specs/004-operator-session/visual-direction/README.md` (1 220 lines,
  6 surfaces, cross-cutting commitments, embedded Review Record).
- **Phase 1 artifacts (plan / research / data-model / quickstart /
  contracts):** complete.
- **Spec phase artifacts:** complete; all three NEEDS CLARIFICATION
  resolved on 2026-05-05.
- **`/speckit-tasks`:** ✅ **Invoked and complete.** `tasks.md` generated
  2026-05-05; addendum applied same day.
- **Implementation slices S1–S6:** S1 ✅, S2 ✅, S3 ✅. **S4 ✅ fully complete
  (2026-05-11 — T056 waived in full via issue 101 Option A; PR #124 merged).**
  PRs #59/#60/#61/#63/#64/#90/#91/#92/#93/#94/#99/#100/#103/#105/#120/#121/#122.
  Issue 85 closed. Issue 86 open (owner discretion). Issue 101 open. Issue 87
  closed (S4 closeout PR). **S5 — IN PROGRESS (2026-05-13):** T083/T084 ✅
  PR #133; T085/T086/T089 ✅ PR #134; T090 ✅ PR #135 (SHA `55a4e341`);
  T087/T088/T091/T092/T093 open; S5 NOT complete; issue 88 OPEN.
  S6 ⏳ blocked on prior slices.

`.specify/feature.json` remains pointed at `specs/004-operator-session`.
This file tracks coordination state only.

---

## Slice 0 visual-direction review status

| Field | Value |
|:--|:--|
| Artifact | [`specs/004-operator-session/visual-direction/README.md`](./visual-direction/README.md) |
| Reviewer | **Ahmed** (assigned 2026-05-05; signed off 2026-05-05) |
| Review Record filled in? | ✅ Yes — see Review Record at bottom of `visual-direction/README.md` |
| Result | ✅ **approved-with-revisions** (3 minor notes for S1/S4/S5 task authors; none blocking) |

**Gate completion criterion:** the Review Record section at the bottom of
`visual-direction/README.md` carries a reviewer name, a date, a `result`
of `approved` or `approved-with-revisions` (with revisions addressed),
and ticked checklists for the six surfaces and the cross-cutting
commitments.

---

## Required coordination actions before `/speckit-tasks`

These are the items that MUST resolve before `/speckit-tasks` may be
invoked. They are independent and may be worked in parallel.

### 1. Slice 0 reviewer

- **Owner:** **Ahmed** (assigned 2026-05-05; signed off 2026-05-05)
- **Status:** ✅ **Complete** — Review Record filled and signed off
- **Result:** approved-with-revisions; 3 minor notes recorded for the
  S1, S4, and S5 task authors to honour. No re-review cycle needed.
- **Notes for downstream slice authors:**
  - Note 1 (S1): clarify Surface 1's error-then-resubmit transition
    (inline alert dismisses on first new keystroke; new submit's spinner
    replaces the prior alert's space, not alongside it). Tests must
    cover this transition.
  - Note 2 (S4): manager / admin navigation MAY display a stuck-shift
    count badge; MUST NOT be visible at icon-only viewport width
    (1024–1279 px); MUST NOT be visible to cashiers regardless. S4 task
    adds a row to `role-visibility-matrix.md` §Section 3 for this.
  - Note 3 (S5): reviewer leans toward `Card`-stack rendering for
    Surface 4A; S5 task may revisit but should default to that unless
    data-density evidence at integration time argues otherwise.
- **Unblocks:** ✅ Visual-direction gate completion (FR-033) — slices
  may now merge once their other gates clear. The full gate completion
  is recorded in the Review Record at the bottom of
  `visual-direction/README.md`.

### 2. §A1 local-unlock-factor approval owner

- **Owner:** **Ahmed** (assigned 2026-05-05)
- **Status:** ✅ **Cleared** — PR #39 merged 2026-05-05T20:53:45Z,
  merge SHA `7ae337b`, Constitution v1.5.1.
- **Resolution path taken:** **Path 1 — constitutional clarification
  clause added to Principle VIII.** The clause affirms: a *local
  terminal unlock factor* (a per-terminal hashed PIN keyed by Clerk
  user ID) is not an identity provider and not a custom user database
  within the meaning of Principle VIII, provided canonical identity
  remains in Clerk, the factor is not consulted by any backend
  endpoint, and audit attribution uses the Clerk-backed identity, not
  the factor record.
- **Required action:** None. Gate is closed.
- **Unblocked:** S3–S6 and any cashier PIN / local-factor work are now
  unblocked from the §A1 perspective. Remaining holds: §A2 per-slice
  endpoint delivery (S1, S3, S4, S5), §A3 migrations, §A4 Argon2id
  binding (both now unblocked for planning).

### 3. §A2 SmartDataPulse backend / OpenAPI dependency owner

- **POS-Pulse owner:** **Ahmed**
- **SmartDataPulse backend owner / counterpart:** **Ahmed** (same
  person; project owner will implement the backend work directly).
- **Coordination mode:** **owner-implemented with ChatGPT/Claude
  support.** No separate backend team handoff is needed; no external
  backend issue / ticket creation in another team's queue is required
  before planning the backend work. The repo-local handoff artifact at
  [`./coordination/a2-backend-handoff.md`](./coordination/a2-backend-handoff.md)
  remains the durable record of the contract surface but is **not** to
  be sent externally.
- **Status:** ✅ **Wave 1 complete — S1 is now unblocked.**
  B-1 merged (PR #43, SHA `c4ce84a`) and B-2 owner go-ahead given;
  Wave 1 backend implementation landed in Data-Pulse-2:
  - `POST /api/pos/v1/operators/sign-in` — Data-Pulse-2 PR #52,
    merge SHA `a765862ae9c7fcdff38db6ec34c72794dcadc59b`, 2026-05-06.
  - `POST /api/pos/v1/operators/sign-out` — Data-Pulse-2 PR #54,
    merge SHA `14a4787232c81d3d404e47cd3a92e68bd9ece255`,
    2026-05-06T11:20:30Z.
  **POS-Pulse S1 is unblocked. S1 has not started yet.**
- **Wave 1 alignment decision (approved 2026-05-06):**
  [`./coordination/wave1-alignment-decision.md`](./coordination/wave1-alignment-decision.md).
  Q1 = Yes (Data-Pulse-2 adopts Clerk JWKS verification for
  `/api/pos/v1/operators/*`); Q2 = path (b) (POS-Pulse holds the Clerk JWT,
  Data-Pulse-2 verifies via JWKS, and **MUST NOT receive or handle
  the user's Clerk password**). Cashier PIN remains local-only and
  MUST NEVER be sent to Data-Pulse-2 (AD-2 / §A1 / Constitution
  v1.5.1).
- **Required next action:** Start POS-Pulse S1 (sign-in + sign-out
  endpoint integration). Wave 1
  endpoints now available in Data-Pulse-2 main:
  1. `POST /api/pos/v1/operators/sign-in` (manager/admin Clerk-JWT-verified
     sign-in only; cashier PIN path does NOT use this endpoint per
     AD-2; password is NEVER sent to Data-Pulse-2).
  2. `POST /api/pos/v1/operators/sign-out`.

  Subsequent waves remain as previously documented (with the same
  PR-0 `/api/pos/v1/...` namespace applied):
  - **Wave 2** — `POST /api/pos/v1/audit-events` (initial wire-up;
    unblocks S3).
  - **Wave 3** — `GET /api/pos/v1/operators/roster?branch_id=`,
    `POST /api/pos/v1/operators/takeover/confirm`,
    `GET /api/pos/v1/operators/active-session?operator_id=`, and
    Endpoint 5 with the cashier/takeover audit categories recognised
    (`operator.session.takeover`, `cashier.pin.reset`,
    `cashier.pin.unlock`); unblocks S4.
  - **Wave 4** — Endpoint 5 with `shift.forced_close` recognised;
    unblocks S5.

  The full six-endpoint list referenced by §A2:
  1. `GET /api/pos/v1/operators/roster?branch_id=`
  2. `POST /api/pos/v1/operators/sign-in`
  3. `POST /api/pos/v1/operators/sign-out`
  4. `POST /api/pos/v1/operators/takeover/confirm`
  5. `POST /api/pos/v1/audit-events`
  6. `GET /api/pos/v1/operators/active-session?operator_id=`

  Each lands as a separate backend feature in the SmartDataPulse repo
  (under whatever ticket / PR shape Ahmed prefers as the implementing
  engineer); once each endpoint's OpenAPI spec is merged there, the
  POS-Pulse `npm run codegen:api` task pulls regenerated types and
  `npm run codegen:verify` confirms determinism (Constitution V).
- **Blocks:** S1 (sign-in + sign-out endpoints — Wave 1), S3 (audit-
  events endpoint — Wave 2), S4 (roster + takeover/confirm +
  active-session + cashier/takeover audit categories — Wave 3), S5
  (`shift.forced_close` audit-event recognition — Wave 4).
  **POS-Pulse S1 remains blocked until backend Wave 1 is implemented
  or otherwise explicitly approved as available.** Per-endpoint /
  per-wave delivery unblocks per-slice work independently. The
  cashier PIN factor introduces **ZERO new backend endpoints** (AD-2
  — the PIN is local-only).
- **Note:** §A1 clearance does not change §A2's status. With ownership
  now consolidated under Ahmed (both sides), §A2's gating rule changes
  from "identify counterpart" to "ship Wave 1 backend code". The PR-#39
  / Constitution v1.5.1 anchor and the AD-2 invariants (cashier PIN
  never crosses the backend boundary) remain in force throughout the
  backend implementation.

### 4. §A3 migrations

- **Status:** ✅ **Fully cleared.** `audit_events` migration merged
  POS-Pulse PR #49, SHA `e50f5b8`, 2026-05-07. `operator_sessions` +
  `cashier_pin_records` migrations merged POS-Pulse PR #60, 2026-05-08.
  All three S4 tables are live.
- **Required action:** None. §A3 is fully cleared for S4.
- **Unblocks:** S4 is now unblocked from the §A3 perspective.

### 5. §A4 Argon2id / package dependency

- **Status:** ✅ **Cleared.** `argon2` 0.44.0 installed via POS-Pulse PR #59,
  2026-05-08. T063 complete.
- **Required action:** None. §A4 is cleared.
- **Unblocks:** S4 PIN implementation is now unblocked.

### 6. §A5 production readiness

- **Status:** ⏳ **Later rollout gate.** No action before implementation
  planning.
- **Required action:** None during the coordination phase. §A5 activates
  when slices begin merging; it gates the production-rollout PR (NOT
  individual slice merges to `main`). The §A5 owner is typically the
  team lead / customer-success liaison and is assigned at
  production-rollout PR open time.
- **Note:** §A5 blocks **production rollout only, not slice merges.**
  S1–S6 may merge to `main` behind a feature flag without §A5; turning
  the feature on for paying customers requires §A5 sign-off.

---

## Gate owner table

| Gate | Status | Owner | Resolution-path note |
|:--|:--:|:--|:--|
| Slice 0 review | ✅ Approved-with-revisions (2026-05-05) | **Ahmed** | Signed off; 3 minor notes for S1/S4/S5 task authors (not blocking). |
| §A1 — local-unlock-factor approval | ✅ **Cleared** — PR #39, SHA 7ae337b, 2026-05-05T20:53:45Z, Constitution v1.5.1 | **Ahmed** | **Path 1** — constitutional clarification clause added to Principle VIII; Clerk remains sole human IdP. |
| §A2 — backend / OpenAPI (Wave 1) | ✅ **Wave 1 cleared** — `POST /api/pos/v1/operators/sign-in` (Data-Pulse-2 PR #52, SHA `a765862`) + `POST /api/pos/v1/operators/sign-out` (Data-Pulse-2 PR #54, SHA `14a4787`) both merged to Data-Pulse-2 main 2026-05-06. **POS-Pulse S1 unblocked; S1 not yet started.** Waves 2–4 remain downstream. | **Ahmed (POS-Pulse) / Ahmed (SmartDataPulse backend)** | Owner-implemented. B-1 (PR #43) + B-2 complete. Wave 1 delivered with Clerk JWKS verification (Q1 = Yes, Q2 = path (b)); password never sent to Data-Pulse-2; cashier PIN stays local-only (AD-2 / §A1). |
| §A2 — backend / OpenAPI (Wave 2) | ✅ **Wave 2 cleared** — `POST /api/pos/v1/audit-events` merged via Data-Pulse-2 PR #62, SHA `4f77da6`, 2026-05-07. **S3 §A2 dependency cleared.** | **Ahmed** | Wave 2 delivered; S3 now holds on §A3 only. |
| §A2 — backend / OpenAPI (Wave 3) | ✅ **Wave 3 cleared** — `GET /api/pos/v1/operators/roster`, `POST /api/pos/v1/operators/takeover/confirm`, `GET /api/pos/v1/operators/active-session` merged via Data-Pulse-2 PR #70, 2026-05-08. **S4 §A2 dependency cleared.** | **Ahmed** | Wave 3 delivered; S4 now holds on §A3 + §A4 (both also cleared). |
| §A2 — backend / OpenAPI (Wave 4) | ✅ **Wave 4 cleared** — `shift.forced_close` recognised in Data-Pulse-2 main (SHA `7b95fdb`): present in `POS_AUDIT_ACTION_CATEGORIES` (apps/api/src/pos-audit-events/dto.ts) and in the OpenAPI `action_category` enum (packages/contracts/openapi/pos-audit-events.openapi.yaml). Payload shape `{ shift_id, shift_owner_id, forced_close_actor_id, forced_close_reason, annotation? }` documented in OpenAPI. **S5 §A2 dependency cleared.** | **Ahmed** | Verified 2026-05-11 against Data-Pulse-2 SHA `7b95fdb`. No Data-Pulse-2 changes made by this PR. |
| §A2 — backend / OpenAPI (Wave 4.1) | ✅ **Wave 4.1 cleared** — `GET /api/pos/v1/shifts/stuck?branch_id=` delivered in two PRs: Data-Pulse-2 PR #143 (Wave 4.1a — shifts schema + module) + PR #146 (Wave 4.1b — endpoint + OpenAPI, SHA `74ae848`), both merged 2026-05-12. **T089 §A2 dependency cleared.** | **Ahmed** | PR-S5-pre ships the matching POS-Pulse contract (Endpoint 7 in `contracts/backend-endpoints.md`, `getStuckShifts` in `backend-client.ts`). |
| §A3 — migrations | ✅ **Fully cleared** — `audit_events` PR #49 SHA `e50f5b8`; `operator_sessions` + `cashier_pin_records` PR #60. | **Ahmed** | All three S4 tables live. S4 may proceed from §A3 perspective. |
| §A4 — Argon2id binding | ✅ **Cleared** — argon2 0.44.0 installed (POS-Pulse PR #59), 2026-05-08. T063 complete. | **Ahmed** | S4 PIN implementation may proceed. |
| §A5 — production readiness | ⏳ Held | _Assigned at rollout PR open time_ | Blocks production rollout only. |

---

## Gate unblock table

| Gate clears | Slices that become eligible to schedule (in `/speckit-tasks`) |
|:--|:--|
| Slice 0 review | (gates *all* implementation slices' merging — without it, no slice may merge per FR-033) |
| §A2 (S1 endpoints land) | S1 may proceed |
| Slice 0 review + §A1 owner assigned + §A2 owner assigned | **`/speckit-tasks` may be invoked** (tasks file produced; slices scheduled behind their gates) |
| §A1 ✅ (any of Paths 1/2/3) | S3, S4, S5, S6 unblocked (subject to §A2/§A3/§A4 per slice) |
| §A2 (S3 endpoint lands) | S3 implementation may proceed |
| §A2 (S4 endpoints land) + §A3 + §A4 | S4 implementation may proceed |
| §A2 Wave 4 ✅ (S5 endpoint — `shift.forced_close` recognised) | S5 implementation may proceed — **gate cleared 2026-05-11** |
| §A2 Wave 4.1 ✅ (`GET /api/pos/v1/shifts/stuck` + `migrations/0007_shifts.sql`) | T089/T090 `[BLOCKED: stuck-shift-discovery]` qualifier resolved — **PR-S5-pre landed 2026-05-12** |
| §A5 ✅ + all slices merged | Production rollout may proceed |

**Bottom line:** `/speckit-tasks` is now invocable — Slice 0 review is
complete ✅ and §A1 is cleared ✅. The remaining active blocker is §A2:
identifying the SmartDataPulse backend owner and coordinating the six
endpoint tickets from `contracts/backend-endpoints.md`. Endpoints need
not all be delivered before `/speckit-tasks` runs; per-slice scheduling
holds individual slices behind their per-endpoint dependencies. §A3 and
§A4 are unblocked for planning now that §A1 is cleared.

---

## S4 implementation closeout status (2026-05-11)

- PR #120 (feat/004-s4-pin-management-reset-unlock): PIN management reset/unlock — T061/T062 (integration tests), T072 (`operator.resetCashierPin`), T073 (`operator.unlockCashier`).
- PR #121 (test/004-s4-cashier-takeover-ui-coverage): cashier sign-in and takeover UI coverage — T057 (takeover-cancel integration), T058 (FR-013 route-level disclosure guard), T059 (cashier sign-in AppRouter integration), T060 (PinPad aria-disabled + privacy extension).
- PR #122 (feat/004-s4-cashier-management-visibility-redaction): cashier management surface, role visibility, stuck-shift badge placeholder, route guard, log redaction — T078 (cashier-management surface `/app/manager/cashiers`), T079 (role-visibility-matrix.md stuck-shift badge row), T080 (navigation count badge), T081 (pino log sites with PR-1 redaction), T082 (route-guard update for §Section 3 routes).
- Issue 101 resolved via Option A waiver (2026-05-11): T056 waived in full — `tests/integration/renderer/takeover.test.tsx` was never created; terminal-A renderer assertions require push/probe mechanism out of scope; `docs/issue-101-waiver.md` records the full architectural decision. **S4 is now fully complete.**

---

## Explicit non-actions

This file tracks coordination state. The following work has **not yet started**:

- ✅ S5 (forced-close recovery) — **IN PROGRESS.** T083/T084 ✅ PR #133 (renderer unit tests); T085/T086/T089 ✅ PR #134 (forced-close handler + handler-side tests); T090 ✅ PR #135 (forced-close surface, SHA `55a4e341`). **T087/T088/T091/T092/T093 remain open.** S5 NOT complete. Issue 88 OPEN.
- ❌ S6 (final polish) — **not started.** Blocked on prior slices.
- ❌ No 005 / 006 started. 005 remains blocked behind §A0.
- ✅ `migrations/0007_shifts.sql` authored (PR-S5-pre, 2026-05-12).
- ❌ No sales / cart / payments / tender / receipts / inventory /
  reports / KPIs / analytics work.
- ❌ No Data-Pulse-2 changes from this repo.
- §A4 `argon2` 0.44.0 is installed (POS-Pulse PR #59). No further `package.json` changes until subsequent S4 tasks require them.

**Completed:** S0 (visual direction) ✅, S1 (manager/admin sign-in) ✅, S2 (bridge security review) ✅, S3 (audit scaffolding) ✅, **S4 (cashier sign-in, takeover, PIN management) ✅** (2026-05-11; all gates cleared 2026-05-08; PRs #59/#60/#61/#63/#64/#90/#91/#92/#93/#94/#99/#100/#103/#105/#120/#121/#122 merged; issue 101 resolved via Option A waiver 2026-05-11; T056 waived in full; S4 final checkpoint clear; PR #124 merged). **§A2 Wave 4 ✅** (2026-05-11; Data-Pulse-2 main SHA `7b95fdb`; `shift.forced_close` confirmed in dto.ts and OpenAPI). **PR-S5-pre ✅** (2026-05-12): Wave 4.1 backend PR #146 SHA `74ae848` merged; `migrations/0007_shifts.sql` added; `getStuckShifts` in `backend-client.ts`; Endpoint 7 in contracts. Both T089/T090 blockers resolved. **S5 partial (2026-05-13):** T083/T084 ✅ PR #133; T085/T086/T089 ✅ PR #134; T090 ✅ PR #135 (SHA `55a4e341ecfcc3a93110043f1df9ba99d181a1ca`). T087/T088/T091/T092/T093 remain open. S5 NOT complete.

`.specify/feature.json` remains pointed at `specs/004-operator-session`.

---

## Takeover follow-up classification before UI (2026-05-09)

**Context.** PR #100 (merge SHA `deb689a`, 2026-05-09) landed
T070 + T071 — the manager/admin takeover confirm/cancel main-process
handlers. Two follow-up issues were intentionally left open:

| Issue | Title | Why open |
|:--:|:--|:--|
| #85 | 004 S4 — takeover confirm handler | **Decision recorded (2026-05-11):** Cashier takeover confirm is permanently local-only under AD-2. No Clerk JWT is minted for cashier operators; `BackendClient.confirmTakeover` is permanently excluded for the cashier path. A future backend cashier-safe confirmation path would require an approved AD amendment. See §"Issue 85 decision" below. |
| #101 | T069c: terminal-A passive polling gap | Terminal A does **not** currently discover a remote takeover through `GET_CURRENT_SESSION` — that handler returns local `SessionManager` state only and never probes the backend. Terminal A learns its session was superseded only after a backend-authenticated call fails with an auth error, on app restart, or after #101 implements a backend probe, push, or invalidation mechanism. There is no active push from terminal B's confirm handler. Each Electron process has independent in-memory `SessionManager` state. The gap is architectural and was deferred at spec time. |

### Decision: how #101 affects issue #86

Issue #86 (PinPad + TakeoverPrompt UI activation) covers two logically
distinct parts of the takeover UX:

1. **Terminal-B prompt UI** — rendering the `TakeoverPrompt` modal on
   terminal B after `signIn` returns `{ kind: 'takeover_required' }`,
   wiring `confirmTakeover` / `cancelTakeover`, and the cashier `PinPad`
   component.

2. **Terminal-A auto-return** — the acceptance criterion that "terminal A
   returns to `/sign-in` within 30 seconds" (T056 integration test
   happy-path assertion, `roadmap-ops-status.md` §7b).

**Ruling:**

- **#86 MAY proceed** with visual direction and terminal-B TakeoverPrompt
  UI activation. The blocking precondition is #85 merge (main-process
  surface), not #101.

- **#86 MUST NOT claim** the full takeover happy-path acceptance criterion
  that includes terminal-A returning to `/sign-in` within 30 seconds.
  The T056 integration test row that asserts "terminal A returns to
  sign-in within 30 s" (from `planning/takeover-confirm-plan.md` §8.1
  test #6 / `planning/ui-pinpad-takeover-visual-direction.md` §7 /
  `tasks.md` T056) **remains blocked by #101**.

- **Screenshot acceptance criteria for #86** must explicitly exclude any
  assertion about terminal-A session state. The `<TakeoverPrompt>` UI
  acceptance is terminal-B-only: modal mounts, "Continue here" calls
  `confirmTakeover`, bridge returns `{ kind: 'signed_in' }`, modal
  closes, and the renderer transitions to the signed-in dashboard.
  Terminal-A state is NOT observable from terminal B's renderer tests.

- **Full S4 takeover flow cannot be marked complete** (in #87 closeout or
  in any coordination status update) until #101 is resolved or explicitly
  waived by the project owner via a recorded decision in this file.

### Resolution options for #101 (for reference, not decided here)

| Option | Description | Gate |
|:--|:--|:--|
| A — passive polling accepted | Document that the 30-second SLA is backend-side (Endpoint 4 terminates terminal-A's backend session), not a POS-Pulse push guarantee. Waive T056's "within 30 s" assertion for the POS-Pulse integration test layer. | Owner decision only. |
| B — backend-probe poll | Add a periodic backend-authenticated call from terminal A's main process (e.g. every 5 s); a 401 / session-not-found response triggers local `sessionManager.end()`. Note: `operator.getCurrentSession` (the existing IPC channel) is local-only and would NOT detect the invalidation — a new or modified call that actually reaches the backend is required. | Small main-process change; no new IPC channel needed if an existing backend-authenticated path can be reused. |
| C — server-sent events / WebSocket push | Backend pushes a session-invalidation signal; terminal A's main process listens and calls `sessionManager.end()`. | New backend endpoint + new POS-Pulse listener; larger scope. |

The choice among A/B/C is deferred to the issue #101 resolution PR.
No #86 PR may assert terminal-A behaviour until the choice is made
and the implementation (if any) lands.

### Issue 85 decision — cashier takeover confirm is local-only under AD-2 (2026-05-11)

**Date:** 2026-05-11
**Decision:** Cashier takeover confirm must remain permanently local-only
under AD-2.

**Rationale:**
- Cashier operators authenticate via local PIN only (§A1 / Constitution
  v1.5.1). No Clerk JWT is ever minted for a cashier session.
- `POST /api/pos/v1/operators/takeover/confirm` (Endpoint 4) requires an
  `Authorization: Bearer <JWT>` header. Calling this endpoint for a
  cashier-path takeover is architecturally impossible under the current
  contract and would violate AD-2.
- `confirmCashierTakeover` in `src/main/operator/takeover-handler.ts` is
  already implemented as purely local: it calls `sessionManager.create()`
  directly with `backend_session_id: ''` and emits no backend round-trip.
  This implementation is correct and complete.

**This is an architectural invariant, not a deferred gap.** A future
backend contract providing a non-Clerk-JWT cashier-safe confirmation path
would require an approved AD amendment before `TakeoverHandler` may call
any backend endpoint for the cashier path.

**Scope of this decision:**
- Closes issue 85.
- Does NOT close issue 86 (PinPad + TakeoverPrompt UI activation — still
  gated on S4 remaining tasks and #87 closeout prerequisites).
- Does NOT close issue 87 (S4 closeout — all other S4 tasks T072, T073,
  T078–T082 remain outstanding).
- Does NOT affect issue 101 (terminal-A session-invalidation gap — wholly
  separate architectural concern).
- Does NOT unblock 005 §A0 (blocked on 004 S4 closeout PR #87 AND 004 S5
  visibility-boundaries PR; neither is satisfied by this decision alone).

**Implementation:** Decision recorded in `takeover-handler.ts` class-level
JSDoc (comment-only; no behaviour change) and in this file.

---

## Issue 101 decision — Option A waiver: terminal-A passive polling accepted (2026-05-11)

**Date:** 2026-05-11
**Decision:** Option A — passive polling accepted. T056 "terminal A returns to `/sign-in` within 30 s" sub-assertion waived at the POS-Pulse integration-test layer.

**Rationale:**
- `GET /api/pos/v1/operators/active-session` (Endpoint 6) is **caller-naive**: it answers "does this operator have an active session somewhere in the branch?" with a binary `{kind: "none" | "active"}` response. It takes only `operator_id` — no `session_id` parameter.
- After terminal B executes a takeover, terminal A (still signed in in-process) would ask Endpoint 6 with its own `operator_id`. Endpoint 6 returns `kind: "active"` in both states: (a) A's own session is still the active one, and (b) B just took over and B's new session is now the active one. The response cannot distinguish the two cases.
- No existing backend contract provides a `session_id`-scoped "is this specific session still active?" query. Implementing Option B safely would require a new §A2 backend endpoint addition, Data-Pulse-2 implementation, and a new POS-Pulse backend-client method — all out of scope for the current spec cycle.
- The 30-second SLA is satisfied at the **backend layer**: Endpoint 4 marks terminal A's `operator_sessions` row as `end_cause = 'superseded_by_takeover'` immediately. Any subsequent backend-authenticated call from terminal A using the invalidated session is refused. The gap is UX-only — the terminal A renderer does not visually return to `/sign-in`.

**Full architectural record:** `docs/issue-101-waiver.md`

**Scope of this decision:**
- Resolves issue 101. Issue 101 is closed.
- Waives T056 in full at the POS-Pulse layer. `tests/integration/renderer/takeover.test.tsx` was never created. Terminal-A renderer assertions (including "terminal A returns within 30 s", session end_cause assertion, audit event assertion from renderer) require a push or probe mechanism that is out of scope. Backend-side session invalidation is a backend guarantee.
- Unblocks S4 final checkpoint.
- Unblocks S5 (pending §A2 Wave 4 only).
- Does NOT affect 005 §A0 gate (blocked on PR #87 closeout AND S5 visibility-boundaries PR).
- Does NOT introduce any code change. This is a docs-only waiver PR.

**Future path:** If Option B or C is desired, the full implementation path is recorded in `docs/issue-101-waiver.md` §"Future path to full Option B / Option C implementation".

---

## §A2 Wave 4 clearance — `shift.forced_close` recognised in Data-Pulse-2 (2026-05-11)

**Date:** 2026-05-11
**Decision:** §A2 Wave 4 is cleared. Data-Pulse-2 main already recognises
`shift.forced_close` in the POS audit-events endpoint contract and runtime DTO.
S5 is now fully unblocked from the gate perspective. No S5 implementation was
started in this PR.

**Verification SHA:** Data-Pulse-2 main `7b95fdb`
(`chore(api): pin jest coverageThreshold to achieved baseline`)

**Files verified (read-only; no edits made):**

| File | Evidence |
|:--|:--|
| `apps/api/src/pos-audit-events/dto.ts` | `POS_AUDIT_ACTION_CATEGORIES` array includes `"shift.forced_close"` as a `const satisfies readonly string[]` member. |
| `packages/contracts/openapi/pos-audit-events.openapi.yaml` | `action_category` enum under `AuditEventItem` includes `shift.forced_close`. Payload shape documented: `{ shift_id, shift_owner_id, forced_close_actor_id, forced_close_reason, annotation? }`. |

**Evidence summary:**
- `shift.forced_close` is in `POS_AUDIT_ACTION_CATEGORIES` in `dto.ts` (line 20).
- `shift.forced_close` is in the OpenAPI `action_category` enum (yaml lines 223–226).
- OpenAPI payload description includes the four S5-specific attribution fields:
  `shift_owner_id`, `forced_close_actor_id`, `forced_close_reason`, optional `annotation`.
- The OpenAPI spec note confirms: "`shift.forced_close` and `shift.close` MUST be
  persisted distinctly — the backend MUST NOT collapse them" (FR-026).

**Scope:**
- Clears §A2 Wave 4 for S5.
- Does NOT start S5 implementation.
- Does NOT introduce any source code, test, migration, package, or CI changes in
  POS-Pulse.
- No Data-Pulse-2 changes were made by this PR. Data-Pulse-2 was accessed
  read-only for verification only.
- Issue 88 (004 S5 — blind shift close and visibility boundaries) remains OPEN
  and is the next S5 implementation candidate after this PR merges.
- 005 remains blocked behind §A0 (requires 004 S4 closeout ✅ AND 004 S5
  visibility-boundaries PR — S5 not yet started).

---

## S5 Spec Kit planning readout (2026-05-11)

**Date:** 2026-05-11
**Scope:** Docs-only Spec Kit planning for issue 88 — 004 S5 blind shift close and visibility boundaries. No S5 implementation started; no source / tests / migrations / package / codegen / OpenAPI / CI / Data-Pulse-2 changes.

**Artifact produced:** [`./planning/s5-speckit-readout.md`](./planning/s5-speckit-readout.md)

**Outcome:**

- All five Spec Kit phases (`/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`) were re-run against the S5 substrate. Specify / clarify / plan / analyze produced no-op outcomes — the canonical spec, plan, contracts, and visual direction already cover the slice at the level issue 88 requires.
- `/speckit-tasks` produced a **gate-tag-only reconciliation** in [`./tasks.md`](./tasks.md) Phase 7: `[BLOCKED: §A1]` and `[BLOCKED: §A2 (S5)]` qualifiers were removed from T083–T093 and from the Phase 7 / Phase 7 implementation headers because both gates are ✅. **Every Phase 7 checkbox remains unchecked.** No task was marked complete or in progress.
- The readout records four proposed deltas queued for the eventual S5 *implementation* PR — two role-visibility-matrix Section 3 rows (forced-close audit-event detail; cashier-returns banner), four explicit Section 4 cashier-forbidden enumerations, a `data-model.md` clarification of the `declared_count = absent` representation, and a `src/shared/audit/payload-schemas.ts` per-category schema for `shift.forced_close`. The matrix is not edited by this PR (per its own Section 8 rule: surface row changes ship with the implementing feature's PR alongside test coverage).
- The readout flags one load-bearing implementation-time open question — **stuck-shift discovery mechanism across terminals** (readout §3.1). §A2 Wave 4 delivered `shift.forced_close` recognition in Endpoint 5 but did NOT deliver a stuck-shift query endpoint. The S5 implementation task author must resolve this before T089 starts via one of: (a) Wave 4.1 endpoint addition (`GET /api/pos/v1/shifts/stuck?branch_id=`), (b) verify existing cross-terminal `shifts` sync already covers it, or (c) compute client-side from `audit_events`. Recommendation: (a) if (b) does not already hold; (c) is the fallback.
- The readout includes an eight-category risk register (scope / security / renderer-exposure / audit-attribution / route-guard-vs-main / redaction / stuck-shift missing-data / future validation commands), each row mapped to the FR / contract source and to the T083–T088 test that catches it.
- The recommended S5 implementation PR sequence is documented (§5 of the readout): PR-S5-pre (resolve §3.1 if needed), PR-S5-a (renderer tests), PR-S5-b (handler + handler tests + logging), PR-S5-c (renderer surfaces + route + banner + matrix delta), PR-S5-d (SC-003 enumeration), PR-S5-close (coordination ✅ ticks). Each PR target is well within Constitution P13's small-slice envelope.

**Issue 88 status:** OPEN, `status:ready`. No S5 implementation started by this PR. Issue 88 is the next S5 implementation candidate.

**005 status:** Unchanged. 005 remains blocked behind §A0 (requires the 004 S5 visibility-boundaries PR to merge — that PR is *not* this planning PR). [`../../005-sales-cart/coordination.md`](../../005-sales-cart/coordination.md) is unchanged.

**Validation performed by this PR:**

- `git diff --check` (whitespace / conflict-marker scan).
- `npm run typecheck` (both tsconfigs).
- `git status --short` (no stray staging).

Codegen and full test suites were NOT run (no source / contracts / package edits to justify them).

**Files changed by this PR:**

- `specs/004-operator-session/planning/s5-speckit-readout.md` (NEW)
- `specs/004-operator-session/tasks.md` (gate-tag reconciliation only — see readout §1.4)
- `specs/004-operator-session/coordination.md` (this section + Last-updated bump)

**Files explicitly NOT touched by this PR:** AGENTS.md, CLAUDE.md, [`./a1-amendment/`](./a1-amendment/), any source / tests / migrations / package / codegen / OpenAPI / CI file, any Data-Pulse-2 file, [`./spec.md`](./spec.md), [`./plan.md`](./plan.md), [`./research.md`](./research.md), [`./data-model.md`](./data-model.md), [`./quickstart.md`](./quickstart.md), and every file under [`./contracts/`](./contracts/).

---

## S5 stuck-shift discovery verification (2026-05-11)

**Date:** 2026-05-11
**Branch:** docs/004-s5-stuck-shift-discovery-verification
**Scope:** Docs-only verification of the load-bearing open question flagged in
`planning/s5-speckit-readout.md` §3.1 — stuck-shift discovery mechanism across
terminals. No S5 implementation started; no source / tests / migrations /
package / codegen / OpenAPI / CI / Data-Pulse-2 changes.

**Artifact produced:** [`./planning/s5-stuck-shift-discovery-verification.md`](./planning/s5-stuck-shift-discovery-verification.md)

**Decision: Option C** — A new Wave 4.1 backend endpoint
`GET /api/pos/v1/shifts/stuck?branch_id=` is required before T089 can begin.

**Evidence summary:**

- Options A and B eliminated:
  - POS-Pulse migrations 0001–0006 contain no `shifts` table. No cross-terminal
    shift sync mechanism exists. Option B (existing sync is sufficient) is
    conclusively eliminated.
  - Data-Pulse-2 has no `pos-shifts` module, no `shifts.ts` schema, no
    `pos-shifts.openapi.yaml`, and no `GET /api/pos/v1/shifts/*` endpoint as of
    SHA `7b95fdb`. Option A (endpoint already exists) is eliminated.
- Option D (client-side audit_events reconstruction) is not viable — audit_events
  do not record shift-open events; the reconstruction would be brittle and
  incomplete.
- Option C is the remaining path: Wave 4.1 backend endpoint + POS-Pulse shifts
  migration must both land before T089 begins.

**Secondary gap flagged:** No `shifts` table in POS-Pulse migrations (0001–0006).
T089 must write `lifecycle_state = 'closed_forced'` and `declared_count = null`
to a local shifts row — the target table does not exist. A
`migrations/0007_shifts.sql` is required in PR-S5-pre (the implementation
pre-flight PR). This migration is NOT authored in this docs-only verification PR.

**Impact on T089/T090:**
T089 (`operator.forceCloseShift`) is blocked on both:
1. Wave 4.1 backend endpoint (`GET /api/pos/v1/shifts/stuck?branch_id=`) — not
   yet implemented in Data-Pulse-2.
2. POS-Pulse `shifts` migration — not yet in 0001–0006.

T090 (`ForcedCloseSurface.tsx`) depends on T089 for the stuck-shift data feed.
Both T089 and T090 carry `[BLOCKED: stuck-shift-discovery]` in `tasks.md`.

T083–T088, T091–T093 are **not** blocked by this discovery gap.

**Issue 88 status:** OPEN. This verification PR does not close or start issue 88.
Issue 88 remains the next S5 implementation candidate after the Wave 4.1
backend endpoint lands and the shifts migration is authored.

**005 status:** Unchanged. 005 remains blocked behind §A0.

**Validation performed by this PR:**

- `git diff --check` (whitespace / conflict-marker scan).
- `npx prettier --check` on changed docs files.
- `npm run typecheck` (both tsconfigs).
- `git status --short` (no stray staging).

Codegen and full test suites were NOT run (no source / contracts / package edits).

**Files changed by this PR:**

- `specs/004-operator-session/planning/s5-stuck-shift-discovery-verification.md` (NEW)
- `specs/004-operator-session/tasks.md` (T089/T090 discovery-blocked qualifier + Last-updated bump)
- `specs/004-operator-session/coordination.md` (this section + Last-updated bump)
- `specs/004-operator-session/planning/roadmap-ops-status.md` (stale S5 readiness wording)

**Files explicitly NOT touched by this PR:** AGENTS.md, CLAUDE.md,
[`./a1-amendment/`](./a1-amendment/), any source / tests / migrations /
package / codegen / OpenAPI / CI file, any Data-Pulse-2 file,
[`./spec.md`](./spec.md), [`./plan.md`](./plan.md), [`./research.md`](./research.md),
[`./data-model.md`](./data-model.md), [`./quickstart.md`](./quickstart.md),
and every file under [`./contracts/`](./contracts/).

---

## Status update protocol

When any item changes state, update this file in place:

1. Update the row in **Required coordination actions** that changed
   (status, owner, dates).
2. Update the corresponding row in the **Gate owner table**.
3. Update the **Last updated** date at the top.
4. If a gate clears completely, update the **Gate unblock table** to
   reflect the now-eligible slices.

When all four required coordination items reach ✅:

1. Add a final line under **Current phase / status** noting "Ready for
   `/speckit-tasks`."
2. The next command (typically in a new session) is `/speckit-tasks`.

This file is the durable coordination record across sessions. Returning
agents and humans should read this file (and `plan.md`) first to know
"where are we?".

---

**End of coordination file.** §A1 ✅ (PR #39, SHA `7ae337b`, Constitution
v1.5.1, 2026-05-05). §A2 Wave 1 ✅ + Wave 2 ✅ + Wave 3 ✅ + **Wave 4 ✅**
(Data-Pulse-2 PRs #52/#54/#62/#70; Wave 4 verified 2026-05-11 SHA `7b95fdb`
— `shift.forced_close` in dto.ts + OpenAPI). **§A2 Wave 4.1 ✅** (Data-Pulse-2
PR #146 SHA `74ae848`, 2026-05-12 — `GET /api/pos/v1/shifts/stuck` endpoint;
POS-Pulse PR-S5-pre ships `migrations/0007_shifts.sql` + Endpoint 7 contract).
§A3 ✅ fully cleared (audit_events PR #49 SHA `e50f5b8`; operator_sessions +
cashier_pin_records PR #60). §A4 ✅ (argon2 0.44.0, POS-Pulse PR #59). **All S4
gates cleared 2026-05-08. S4 fully complete (2026-05-11, PR #124).** PRs
#59/#60/#61/#63/#64/#90/#91/#92/#93/#94/#99/#100/#103/#105 merged 2026-05-09.
PR #120 (T061/T062/T072/T073) merged 2026-05-11. PR #121 (T057–T060) merged
2026-05-11. PR #122 (T078–T082) merged 2026-05-11. PR #124 (issue 101 waiver;
T056 waived in full) merged 2026-05-11. **Issue 85 closed** (cashier-path AD-2
local-only; see §"Issue 85 decision"). Issue 86 open per owner discretion.
**Issue 101 open** (terminal-A gap — Option A waiver recorded; see §"Issue 101
decision" and `docs/issue-101-waiver.md`). **§A2 Wave 4 cleared** (2026-05-11;
`shift.forced_close` confirmed in Data-Pulse-2 main SHA `7b95fdb`). **PR-S5-pre
merged (2026-05-12):** `migrations/0007_shifts.sql` + `getStuckShifts` +
Endpoint 7. **T089/T090 `[BLOCKED: stuck-shift-discovery]` resolved.** **S5 IN PROGRESS (2026-05-13):** T083/T084 ✅ PR #133; T085/T086/T089 ✅ PR #134;
T090 ✅ PR #135 (merge SHA `55a4e341ecfcc3a93110043f1df9ba99d181a1ca`). T087/T088/
T091/T092/T093 open. S5 NOT complete. Issue 88 OPEN. 005 remains blocked behind §A0.
S3 complete (2026-05-07). §A5 is a later-rollout gate. S6 not yet started.
