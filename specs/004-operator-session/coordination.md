# Coordination — 004-operator-session

**Feature:** 004-operator-session
**Plan:** [./plan.md](./plan.md) v1.1
**Spec:** [./spec.md](./spec.md)
**Visual direction:** [./visual-direction/README.md](./visual-direction/README.md)
**Created:** 2026-05-05
**Last updated:** 2026-05-06 (§A1 cleared — PR #39, merge SHA 7ae337b, 2026-05-05T20:53:45Z, Constitution v1.5.1; §A2 backend coordination outstanding)

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
  **§A2 backend/OpenAPI coordination remains the active remaining blocker.**
  `/speckit-tasks` is invocable; Slices 3–6 hold on §A2 per-endpoint
  delivery.
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

- **Owner:** **Ahmed** (POS-Pulse side) / **Backend counterpart: TBD**
- **Status:** ⚠️ **Active remaining blocker** — Ahmed holds the
  POS-Pulse-side coordination; the SmartDataPulse backend repo owner
  for the six endpoint tickets has not yet been identified.
- **Required action:**
  1. Identify the SmartDataPulse backend owner responsible for the six
     endpoint tickets defined in
     [`./contracts/backend-endpoints.md`](./contracts/backend-endpoints.md).
  2. Coordinate creation of backend feature tickets for each endpoint:
     `GET /v1/operators/roster?branch_id=`,
     `POST /v1/operators/sign-in`,
     `POST /v1/operators/sign-out`,
     `POST /v1/operators/takeover/confirm`,
     `POST /v1/audit-events`, and the
     `shift.forced_close` audit-event category recognition endpoint.
     The cashier PIN factor introduces **ZERO new backend endpoints**
     (AD-2 — the PIN is local-only). Each ticket lands as a separate
     backend feature in the SmartDataPulse repo; once each endpoint's
     OpenAPI spec is merged there, the POS-Pulse `npm run codegen:api`
     task pulls regenerated types and `npm run codegen:verify` confirms
     determinism (Constitution V).
- **Blocks:** S1 (sign-in + sign-out endpoints), S3 (audit-events
  endpoint), S4 (roster + takeover/confirm + audit-event categories),
  S5 (shift.forced_close audit-event recognition). Per-endpoint
  delivery unblocks per-slice work independently.
- **Note:** §A1 clearance does not change §A2's status. §A2 is the
  primary outstanding coordination item as of 2026-05-06.

### 4. §A3 migrations

- **Status:** ⏳ **Downstream of §A1.** No action until §A1 resolves.
- **Required action:** None until §A1 resolves. The set of needed
  migrations depends on §A1's outcome:
  - Path 1 → `audit_events`, `operator_sessions`, `cashier_pin_records`.
  - Path 2 → `audit_events`, `operator_sessions` only (no
    `cashier_pin_records`).
  - Path 3 → `audit_events` only (S3); `operator_sessions` if needed for
    durability beyond in-memory state.
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
| §A2 — backend / OpenAPI | ⚠️ **Active remaining blocker** — backend counterpart TBD | **Ahmed / Backend owner TBD** | Six endpoint tickets in `contracts/backend-endpoints.md`; backend-side counterpart owner to be identified as first coordination step. |
| §A3 — migrations | ⏳ Held | _Derives from §A1 outcome_ | No action until §A1 ✅. |
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
Constitution v1.5.1). §A2 backend/OpenAPI coordination is the active
remaining blocker (Ahmed holds POS-Pulse side; backend counterpart TBD).
§A3 / §A4 are unblocked for planning; §A5 is a later-rollout gate.
`/speckit-tasks` may now be invoked; implementation slices S1–S6 are
not yet started.
