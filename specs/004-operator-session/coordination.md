# Coordination — 004-operator-session

**Feature:** 004-operator-session
**Plan:** [./plan.md](./plan.md) v1.1
**Spec:** [./spec.md](./spec.md)
**Visual direction:** [./visual-direction/README.md](./visual-direction/README.md)
**Created:** 2026-05-05
**Last updated:** 2026-05-07 (§A2 Wave 2 cleared — `POST /api/pos/v1/audit-events` merged via Data-Pulse-2 PR #62 SHA `4f77da6`; §A3 now active — `migrations/0004_audit_events.sql` authored in POS-Pulse PR pending review)

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

- **Phase:** Slice 0 (visual direction) artifact written and **review signed
  off by Ahmed on 2026-05-05** (approved-with-revisions; 3 minor notes
  flagged for S1/S4/S5 task authors; none blocking). **§A1 cleared via
  PR #39 (merge SHA 7ae337b, 2026-05-05T20:53:45Z, Constitution v1.5.1).**
  **§A2 backend Wave 1 complete — `POST /api/pos/v1/operators/sign-in`
  merged via Data-Pulse-2 PR #52 (SHA `a765862ae9c7fcdff38db6ec34c72794dcadc59b`,
  2026-05-06) and `POST /api/pos/v1/operators/sign-out` merged via
  Data-Pulse-2 PR #54 (SHA `14a4787232c81d3d404e47cd3a92e68bd9ece255`,
  2026-05-06T11:20:30Z). POS-Pulse S1 is now unblocked.** S1 has not
  started yet. `/speckit-tasks` is invocable; Slices 3–6
  hold on §A2 per-endpoint delivery.
- **Slice 0 visual-direction artifact:** present at
  `specs/004-operator-session/visual-direction/README.md` (1 220 lines,
  6 surfaces, cross-cutting commitments, embedded Review Record).
- **Phase 1 artifacts (plan / research / data-model / quickstart /
  contracts):** complete.
- **Spec phase artifacts:** complete; all three NEEDS CLARIFICATION
  resolved on 2026-05-05.
- **`/speckit-tasks`:** ⏳ **NOT YET STARTED.** Will not be invoked until
  the coordination items below resolve.
- **Implementation slices S1–S6:** ⏳ **NOT YET STARTED.** No source code
  has been written, no migrations authored, no OpenAPI changed, no
  packages installed, no IPC/preload/backend implementation, no sales/
  cart/payments work.

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

- **Status:** ⏳ **Active — §A3 gate PR in review.** §A1 cleared (PR #39,
  2026-05-05); §A2 Wave 2 cleared (Data-Pulse-2 PR #62, SHA `4f77da6`,
  2026-05-07). `migrations/0004_audit_events.sql` authored per data-model.md
  §"Entity 5" (append-only triggers, composite PK `(event_id, tenant_id)`,
  `audit_events_sync_state` sibling). Merge of the §A3 gate PR unblocks S3
  implementation tasks T046+.
- **Required action:** Review and merge the §A3 gate PR (POS-Pulse
  `feat/004-s3-audit-events-migration`). §A1 resolved via Path 1 →
  migrations needed: `audit_events` (this PR), `operator_sessions` (S4),
  `cashier_pin_records` (S4).
- **Unblocks (when ready):** S3 (audit_events), S4 (cashier_pin_records,
  operator_sessions if not in S1).

### 5. §A4 Argon2id / package dependency

- **Status:** ⏳ **Downstream of §A1.** No action until §A1 resolves.
- **Required action:** None until §A1 resolves. §A4 is needed only if §A1
  resolves via Path 1 (local PIN factor with Argon2id hashing). Path 2
  obviates §A4 entirely; Path 3 defers §A4 with the slices it gates.
- **Unblocks (when ready):** S4 only.

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
| §A3 — migrations | ⏳ **Active — gate PR in review** (`feat/004-s3-audit-events-migration`) | **Ahmed** | §A1 cleared (Path 1); `migrations/0004_audit_events.sql` authored. Merge unblocks S3 T046+. |
| §A4 — Argon2id binding | ⏳ Held | _Derives from §A1 outcome_ | No action until §A1 ✅; Path 1 keeps §A4 in scope. |
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
| §A2 (S5 endpoint lands) | S5 implementation may proceed |
| §A5 ✅ + all slices merged | Production rollout may proceed |

**Bottom line:** `/speckit-tasks` is now invocable — Slice 0 review is
complete ✅ and §A1 is cleared ✅. The remaining active blocker is §A2:
identifying the SmartDataPulse backend owner and coordinating the six
endpoint tickets from `contracts/backend-endpoints.md`. Endpoints need
not all be delivered before `/speckit-tasks` runs; per-slice scheduling
holds individual slices behind their per-endpoint dependencies. §A3 and
§A4 are unblocked for planning now that §A1 is cleared.

---

## Explicit non-actions

This file authorizes **no implementation work**. Specifically:

- ❌ `/speckit-tasks` is **not yet invoked.**
- ❌ Implementation slices **S1–S6 are not yet started.**
- ❌ No source files have been created or modified.
- ❌ No `package.json` changes; no packages installed.
- ❌ No DB migrations.
- ❌ No OpenAPI changes; `scripts/openapi-snapshot.json` and
  `src/shared/api-types.ts` untouched.
- ❌ No IPC / preload / main-process / backend implementation.
- ❌ No sales / cart / payments / tender / receipts / inventory /
  reports / KPIs / analytics work.

`.specify/feature.json` remains pointed at `specs/004-operator-session`.

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

**End of coordination file.** §A1 cleared (PR #39, SHA 7ae337b,
Constitution v1.5.1). §A2 Wave 1 **complete** — `POST
/api/pos/v1/operators/sign-in` (Data-Pulse-2 PR #52, SHA
`a765862ae9c7fcdff38db6ec34c72794dcadc59b`) and `POST
/api/pos/v1/operators/sign-out` (Data-Pulse-2 PR #54, SHA
`14a4787232c81d3d404e47cd3a92e68bd9ece255`) both merged to
Data-Pulse-2 main on 2026-05-06. Clerk JWKS verification is in
place (Q1 = Yes, Q2 = path (b)); password is never sent to
Data-Pulse-2; cashier PIN stays local-only (AD-2 / §A1 /
Constitution v1.5.1). **POS-Pulse S1 is now unblocked. S1 has not
started yet.** §A2 Waves 2–4 (audit-events, roster, takeover/confirm,
active-session, forced-close) remain downstream. §A3 / §A4 unblocked
for planning; §A5 is a later-rollout gate. `/speckit-tasks` may be
invoked; implementation slices S1–S6 are not yet started.
