# §A2 Backend Handoff — POS Pulse 004 operator/session endpoints

**Status:** ✅ **Wave 1 complete (2026-05-06).** Counterpart: Ahmed (both
sides, owner-implemented mode). The message below was never sent externally;
it remains as the durable in-repo record of the contract surface.
Wave 1 endpoints now live in Data-Pulse-2 main:
- `POST /api/pos/v1/operators/sign-in` — PR #52, SHA `a765862ae9c7fcdff38db6ec34c72794dcadc59b`
- `POST /api/pos/v1/operators/sign-out` — PR #54, SHA `14a4787232c81d3d404e47cd3a92e68bd9ece255`
**POS-Pulse S1 is unblocked. S1 has not started yet.**
**Owner (POS-Pulse side):** Ahmed
**Backend counterpart:** Ahmed (same person; SmartDataPulse-backend `Data-Pulse-2`)
**Created:** 2026-05-06
**Endpoint namespace updated:** 2026-05-06 (PR-0) — all six endpoints below
are mounted under `/api/pos/v1/...` to match the `Data-Pulse-2` URL
convention.
**Source artifacts:**
- [`specs/004-operator-session/contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
- [`specs/004-operator-session/coordination.md`](../coordination.md)
- [`specs/004-operator-session/plan.md`](../plan.md)

---

## Purpose

Preserve the §A2 backend coordination request as a durable in-repo record. The
content below is the message to the SmartDataPulse backend team owner, drafted
but **not yet sent**. When §A2 resolves (backend owner identified, tickets
opened), the response and resolution should be appended to this file or
recorded in `coordination.md`.

This file does **not** authorize any implementation work, does not open a
GitHub issue in the SmartDataPulse backend repo, and does not communicate
externally.

---

## Message draft

---

**Subject:** POS Pulse 004 — backend coordination request: six operator/session/audit endpoint tickets (§A2)

**To:** SmartDataPulse backend team — owner TBD
**From:** Ahmed (POS-Pulse, info@rahmaqanater.org)
**Date:** 2026-05-06

---

Hi,

POS Pulse 004 (operator/session/visibility layer) planning is merged, and §A1
local-unlock-factor clarification is constitutionally cleared. The remaining
blocker before POS-Pulse implementation can start is **§A2 backend / OpenAPI
coordination**.

### Stable anchor for §A1 clearance

§A1 cleared via **PR #39**, merge SHA **`7ae337b`**, merged
**2026-05-05T20:53:45Z**, **Constitution v1.5.1**. The amendment added a
normative clause to Principle VIII confirming that a *local terminal unlock
factor* (a per-terminal hashed PIN keyed by Clerk user ID) is **not** an
identity provider and **not** a custom user database, provided canonical
identity remains in Clerk, the factor is not consulted by any backend
endpoint, and audit attribution uses the Clerk-backed identity, not the
factor record.

**Practical consequence for the backend:** the cashier PIN never crosses
the backend boundary by design. None of the six endpoints below accept,
validate, or log a PIN. This is preserved as an invariant (AD-2) and
verified by Endpoint 6's contract.

### What we need from the SmartDataPulse backend side

A SmartDataPulse backend owner for **six endpoint tickets** documented in
`specs/004-operator-session/contracts/backend-endpoints.md`. Each ticket
lands as a separate backend feature in the SmartDataPulse repo; once each
endpoint's OpenAPI spec is merged there, the POS Pulse `npm run codegen:api`
task pulls regenerated types and `npm run codegen:verify` confirms
determinism (Constitution V).

### Required backend tickets

#### 1. `GET /api/pos/v1/operators/roster?branch_id=`

- **Purpose:** branch cashier roster for cashier sign-in.
- **Constraint:** must return only `{id, display_name, role}`; no PII or
  credential data. Manager and admin role rows are NOT in this response —
  cashiers only.
- **Caller:** paired terminal at `/sign-in`, before any operator session
  exists. Device token only — no operator JWT.

#### 2. `POST /api/pos/v1/operators/sign-in`

- **Purpose:** manager/admin Clerk-backed sign-in only.
- **Constraint:** the cashier PIN path must NOT use this endpoint. Cashier
  session token derives from the cached Clerk JWT pipeline established at
  cashier onboarding; PIN unlock is purely local.
- **Response variants:** `{kind: "signed_in", ...}` or
  `{kind: "takeover_required"}` — the takeover variant carries no terminal
  name, no timestamp, no other-operator data (FR-013).

#### 3. `POST /api/pos/v1/operators/sign-out`

- **Purpose:** backend-side sign-out for active operator sessions.
- **Constraint:** client tears down the local session within 1 s regardless
  of backend reachability (FR-008 / NFR-007); backend liveness is not
  load-bearing for sign-out.

#### 4. `POST /api/pos/v1/operators/takeover/confirm`

- **Purpose:** explicit takeover confirmation. Terminates prior operator
  session and creates a new one on the calling terminal.
- **Constraint:** must terminate prior session without exposing prior
  terminal details. Idempotent on `event_id` (P5). The
  `operator.session.takeover` audit event is NOT emitted by this endpoint
  — it flows through Endpoint 5 on the consolidated audit-sync channel.

#### 5. `POST /api/pos/v1/audit-events`

- **Purpose:** consolidated audit-event sync (batched).
- **Constraints:**
  - Idempotency by `event_id` (P5) — same event submitted twice persists
    once + acknowledges duplicate.
  - **Recognise (and persist distinctly) the following six action
    categories:**
    - `shift.open`
    - `shift.close`
    - `shift.forced_close`
    - `operator.session.takeover`
    - `cashier.pin.reset`
    - `cashier.pin.unlock`
  - **`shift.close` and `shift.forced_close` MUST be persisted as
    separate categories** — collapsing them violates FR-026.
  - Reference: `specs/004-operator-session/data-model.md §"Action
    Category Catalogue"` for the full catalogue and per-category payload
    schemas.
  - Server-side schema validator should reject events whose `payload`
    contains forbidden field names (cardholder data, credential
    fragments, PIN values, session tokens) per FR-027 / PR-1 / P6 / P7.

#### 6. `GET /api/pos/v1/operators/active-session?operator_id=`

- **Purpose:** cashier takeover detection after local PIN unlock.
- **Constraints:**
  - Read-only. MUST NOT mutate any session state, MUST NOT emit any
    audit event, MUST NOT trigger any notification.
  - Binary response only: `{kind: "none"}` or `{kind: "active"}`.
  - **Must never accept or log PIN data** — no PIN field, header, or
    query parameter; no logging of request body fields that could capture
    an injected PIN (defence-in-depth on the AD-2 invariant).
  - Minimum disclosure: response MUST NOT include terminal id / label,
    timestamps, operator metadata (role, display name, identity
    attributes), branch-position data, or counts (FR-013).

### Cross-cutting backend requirements

These apply to all six endpoints:

- Validate `device_token` against the existing terminal pairing scope
  (Constitution VIII / 002).
- Enforce tenant + branch claim match between the Clerk JWT (where
  present) and the device token; refuse generically on mismatch (P17).
- Use **generic refusal envelopes** — bodies MUST NOT distinguish
  wrong-credential vs disabled vs tenant-mismatch vs rate-limited
  (NFR-003 / PR-2).
- Scrub `password`, JWTs, session tokens, and any PIN-shaped field from
  logs / Sentry / observability (PR-1 / P11).
- **Never accept the cashier PIN as a backend credential** (AD-2
  invariant).
- Keep Endpoint 6 minimum-disclosure: no terminal id, timestamps,
  operator metadata, counts, or PIN fields.

### Suggested delivery waves

Per-endpoint delivery unblocks per-slice POS-Pulse work independently;
endpoints need not all land before POS-Pulse implementation begins.

| Wave | Endpoints | Unblocks (POS-Pulse slice) |
|:--|:--|:--|
| **Wave 1** | Endpoint 2 + Endpoint 3 | **S1** (manager/admin sign-in) |
| **Wave 2** | Endpoint 5 (initial audit sync, with at least placeholder categories) | **S3** (audit scaffolding) |
| **Wave 3** | Endpoint 1 + Endpoint 4 + Endpoint 6 + Endpoint 5 (with `operator.session.takeover`, `cashier.pin.reset`, `cashier.pin.unlock` categories recognised) | **S4** (cashier sign-in + takeover) |
| **Wave 4** | Endpoint 5 (with `shift.forced_close` category recognised) | **S5** (forced close) |

POS-Pulse-side §A3 (migrations) and §A4 (Argon2id binding) are now
unblocked for planning; they don't block backend work.

### Requested response

Could you confirm:

1. **Backend owner** — who is the responsible engineer for these endpoint
   tickets in the SmartDataPulse repo? (We'll record the name in
   `coordination.md` §A2.)
2. **Ticket split** — are six independent backend tickets the right shape,
   or would you prefer fewer/more (e.g., bundling Endpoints 2 + 3 + 6 as
   one "operator-session" ticket and Endpoint 5 as its own "audit-sync"
   ticket)?
3. **Delivery wave order** — do the proposed waves match your team's
   sequencing preferences, or would you reorder?
4. **Backend concerns or contract mismatches** — anything in
   `contracts/backend-endpoints.md` that conflicts with existing
   SmartDataPulse conventions (auth, response envelopes, tenant claim
   shape, OpenAPI tooling, etc.) that we should resolve before tickets
   open?

The full contract is at
`specs/004-operator-session/contracts/backend-endpoints.md` (single
source of truth; happy to walk through it synchronously if that's
faster). Background plan + decisions are in
`specs/004-operator-session/plan.md` (v1.1, Constitution v1.5.1).

Thanks,
Ahmed
POS-Pulse / 004-operator-session

---

## Notes for tracking

When a response is received:

1. Append the response (or a summary + link) under a new
   `## Response` section below.
2. Update [`../coordination.md`](../coordination.md) §A2 row:
   - Replace `Backend counterpart: TBD` with the named owner.
   - Update status from `⚠️ Active remaining blocker — backend
     counterpart TBD` to `⚠️ Active remaining blocker — Wave N in
     progress under <owner>`, or to `✅ Cleared` once all waves land.
3. If the backend team raises contract concerns, route changes through
   `contracts/backend-endpoints.md` (the source of truth), not by
   editing this artifact in place.

---

## Explicit non-actions for this artifact

- ❌ Not sent externally.
- ❌ No GitHub issue created in the SmartDataPulse backend repo.
- ❌ No source files modified.
- ❌ No `package.json` / lockfile changes.
- ❌ No migrations.
- ❌ No OpenAPI changes (`scripts/openapi-snapshot.json` and
  `src/shared/api-types.ts` untouched).
- ❌ No IPC / preload / main-process / backend implementation.
- ❌ S1 not started; `/speckit-implement` not invoked.

---

**End of §A2 backend handoff artifact.** Status: draft, repo-local,
awaiting backend counterpart identification.
