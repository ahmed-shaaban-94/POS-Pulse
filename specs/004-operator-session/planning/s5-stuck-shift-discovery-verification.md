# S5 Stuck-Shift Discovery — Verification Artifact

**Feature:** 004-operator-session S5
**Date:** 2026-05-11
**Branch:** docs/004-s5-stuck-shift-discovery-verification
**Author:** Docs-only verification PR
**Status:** Decision recorded — Option C (Wave 4.1 backend endpoint required)

---

## 1. Current Requirement

Surface 4A of S5 ("stuck-shift list") must display every shift on the current
branch whose opening cashier is no longer able to close it. The manager selects
one row and proceeds to Surface 4B (forced-close form).

**What "stuck" means for discovery:**
A shift is stuck when it was opened on terminal A (or by cashier X) and the
cashier who opened it is no longer present — due to takeover-supersession,
cashier illness, terminal failure, or no-show. The shift cannot auto-close
because only the shift's opening cashier may normally close it.

**Why cross-terminal discovery is load-bearing:**
The manager on terminal B cannot enumerate the stranded shifts by querying
terminal B's local SQLite only — terminal B has no `shifts` table and no
awareness of work begun on terminal A. A backend query is required to retrieve
the branch-scoped stuck-shift list.

**Source references:**
- `specs/004-operator-session/planning/s5-speckit-readout.md` §3.1
- `specs/004-operator-session/planning/s5-blind-shift-close-spec-draft.md`
  §9 question 5 and §11.1
- `specs/004-operator-session/tasks.md` T089 implementation note
- `specs/004-operator-session/contracts/backend-endpoints.md` (no shifts
  query endpoint currently listed)

---

## 2. Existing Evidence

### 2.1 POS-Pulse local migrations (0001–0006) — no `shifts` table

A scan of all migrations in `migrations/` confirms:

| File | Tables created |
|:--|:--|
| `0001_initial.sql` | `terminal_configs` |
| `0002_device_pairing.sql` | `device_tokens` |
| `0003_operator_roles.sql` | `operator_roles` |
| `0004_audit_events.sql` | `audit_events` (comment: "No FK constraints: operator_sessions and shifts tables do not exist until S4") |
| `0005_operator_sessions.sql` | `operator_sessions`, `cashier_pin_records` (comment: "shifts table does not exist yet") |
| `0006_*` | (additional operator/PIN tables; no shifts table) |

**Critical finding:** No `shifts` table exists in POS-Pulse's local SQLite
schema. The `audit_events` migration comment from S3 explicitly records that
the shifts table does not yet exist. S4 never added it.

**Implication for Option B:** There is no cross-terminal shifts sync
mechanism of any kind. Terminal B cannot query a local shifts store that
tracks shifts opened on terminal A. Option B (verify existing sync is
sufficient) is conclusively eliminated.

### 2.2 Data-Pulse-2 schema — no shifts table

A read-only inspection of the Data-Pulse-2 repository at
`packages/db/src/schema/` reveals the following files:

```
audit_events.ts
auth_tokens.ts
devices.ts
idempotency_keys.ts
invitations.ts
memberships.ts
permissions.ts
roles.ts
sessions.ts
store_access.ts
stores.ts
tenants.ts
users.ts
```

**There is no `shifts.ts`** in the Data-Pulse-2 database schema. The backend
has no shifts table in its current data model.

### 2.3 Data-Pulse-2 OpenAPI contracts — no shifts endpoint

A directory listing of `packages/contracts/openapi/` shows:

```
audit.openapi.yaml
auth.openapi.yaml
context.openapi.yaml
memberships.openapi.yaml
pos-audit-events.openapi.yaml
pos-operators.openapi.yaml
stores.openapi.yaml
tenants.openapi.yaml
```

**There is no `pos-shifts.openapi.yaml`.** The `pos-audit-events.openapi.yaml`
file contains only `POST /api/pos/v1/audit-events` — no GET endpoints for
shifts of any kind.

**Implication for Option A:** The `GET /api/pos/v1/shifts/stuck?branch_id=`
endpoint proposed in the s5-speckit-readout.md §3.1 does NOT yet exist.
Option A (endpoint already exists) is eliminated.

### 2.4 §A2 Wave 4 clearance — `shift.forced_close` only

Data-Pulse-2 main (SHA `7b95fdb`) confirmed in the Wave 4 clearance PR
(docs/004-s5-wave4-gate-clearance, 2026-05-11):

- `shift.forced_close` is in `POS_AUDIT_ACTION_CATEGORIES` in
  `apps/api/src/pos-audit-events/dto.ts` ✅
- `shift.forced_close` is in the OpenAPI `action_category` enum in
  `packages/contracts/openapi/pos-audit-events.openapi.yaml` ✅

Wave 4 delivered **audit-event category recognition only**. It did NOT deliver
a stuck-shift query endpoint. There is no `GET /api/pos/v1/shifts/stuck`
route, no shifts module, and no shifts schema in Data-Pulse-2 as of SHA
`7b95fdb`.

### 2.5 POS-Pulse bridge surface — `forceCloseShift` not yet implemented

`src/shared/bridge-api.ts` was read in full. The `OperatorBridgeAPI` interface
does NOT include `forceCloseShift`. The interface currently exposes:
`signIn`, `signOut`, `getCurrentSession`, `_reportActivity`,
`emitAuditEvent`, `_emitAuditEventSmoke`, `listBranchRoster`,
`confirmTakeover`, `cancelTakeover`, `resetCashierPin`, `unlockCashier`.

`forceCloseShift` is scheduled for T089. This confirms S5 has not started.

### 2.6 `ShiftForcedClosePayload` — already defined in S3

`src/shared/audit/payload-schemas.ts` (read in full) already contains:

```typescript
export interface ShiftForcedClosePayload {
  shift_id: string;
  shift_owner_id: string;
  forced_close_actor_id: string;
  forced_close_reason: ForcedCloseReason;
  annotation?: string;
}
```

This resolves the §2.4 "open question" from `s5-blind-shift-close-spec-draft.md`
— the payload type was added as part of S3 audit scaffolding. The open question
no longer applies to the payload shape.

### 2.7 Option D (client-side reconstruction) — not viable

Option D proposes reconstructing shift state by replaying `audit_events` rows
locally. This is not viable because:
- `audit_events` records do not include `shift_open` events at present; shifts
  are not modelled in the audit schema.
- Even if they did, the reconstruction would be brittle and requires a
  well-defined "stuck" predicate that cannot be evaluated client-side without
  backend authoritative shift state.
- The spec (FR-024, FR-025, FR-026) requires a durable, attributable record of
  the forced-close act — not a client-side computed approximation.

---

## 3. Decision — Option C: Wave 4.1 Backend Endpoint Required

**Chosen option:** **Option C** — A new backend endpoint
`GET /api/pos/v1/shifts/stuck?branch_id=` (Wave 4.1) is required before T089
can begin. Neither Option A (endpoint already exists), Option B (existing sync
is sufficient), nor Option D (client-side reconstruction) holds.

### Evidence chain

| Option | Eliminated by | Conclusion |
|:--|:--|:--|
| A — endpoint already exists | §2.3: no `pos-shifts.openapi.yaml`; §2.2: no `shifts.ts` in Data-Pulse-2 schema; §2.4: Wave 4 delivered audit-event category only | ❌ Not yet built |
| B — existing cross-terminal sync is sufficient | §2.1: no `shifts` table in POS-Pulse migrations (0001–0006); no shifts sync mechanism exists | ❌ Sync does not exist |
| C — new Wave 4.1 endpoint required | Both of the above gaps confirm the endpoint must be built | ✅ **Selected** |
| D — client-side audit_events reconstruction | §2.7: audit schema does not track shift open events; reconstruction is brittle and incomplete | ❌ Not viable |

### Wave 4.1 endpoint proposal

The following endpoint contract is proposed for Wave 4.1. This PR does NOT
implement it — it records the minimum specification needed for the Data-Pulse-2
Wave 4.1 PR to produce a compatible contract surface.

**Endpoint:** `GET /api/pos/v1/shifts/stuck`

**Query parameter:** `branch_id` (required) — UUID of the branch for which
the manager is requesting the stuck-shift list. MUST match the terminal's
paired `branch_id` claim in the device token (server-side enforcement).

**Authentication:** Bearer JWT (manager or admin Clerk JWT only; cashier PIN
path MUST NOT reach this endpoint — AD-2 invariant).

**Definition of "stuck":** A shift is stuck when:
1. `lifecycle_state = 'open'` (not yet closed by any path), AND
2. The shift's `opening_cashier_operator_id` has no active session on the
   branch (i.e., no `operator_sessions` row with `end_at IS NULL` and
   `branch_id = ?` for that cashier), AND
3. The shift's `opened_at` is older than a configurable stale threshold
   (recommended: 15 minutes; implementation may use a shorter threshold).

**Response shape (per shift row):**

```typescript
interface StuckShiftRow {
  shift_id: string;          // UUID
  cashier_display_name: string; // opaque display label — MUST NOT be
                                // email or Clerk user ID (FR-032)
  terminal_label: string;    // human-readable terminal identifier
  opened_at: string;         // ISO-8601 UTC timestamp
  duration_minutes: number;  // derived: now − opened_at
}
```

**Response envelope:**

```json
{
  "kind": "ok",
  "shifts": [ /* StuckShiftRow[] */ ]
}
```

Empty array is a valid response (no stuck shifts on the branch).

**Error responses:**
- `401 Unauthorized` — invalid or expired JWT.
- `403 Forbidden` — cashier role attempts this endpoint; device token
  `branch_id` does not match query parameter.
- `404 Not Found` — branch not found or not paired.

**Codegen note:** Once the Data-Pulse-2 Wave 4.1 PR lands, POS-Pulse MUST
run `npm run codegen:api && npm run codegen:verify` before T089 begins to
pull the generated types. This is a precondition for T089 (not covered by
this docs-only PR).

### Secondary gap: POS-Pulse `shifts` migration also required

T089 must write `lifecycle_state = 'closed_forced'` and
`declared_count = null` to a local `shifts` row (for local state consistency
and as the source of truth before the audit event is emitted). However, no
`shifts` table exists in POS-Pulse migrations (0001–0006) — see §2.1.

A POS-Pulse migration (`migrations/0007_shifts.sql` or similar) creating the
`shifts` table per `data-model.md` §"Entity shifts" is required before T089
can land. This migration is **not authored in this docs-only PR** — it belongs
in the S5 implementation PR sequence (PR-S5-pre or the first implementation
PR). T089 must be treated as blocked on both the Wave 4.1 backend endpoint
and this local migration.

---

## 4. Recommended Next PR Sequence

This sequence supersedes the §5 sequence in `s5-speckit-readout.md` for the
tasks that depend on stuck-shift discovery. The readout §5 remains the
authoritative source for the PR shapes; this section records the updated
blocking order.

| Step | PR | Prerequisite | Scope |
|:--|:--|:--|:--|
| 0 | **Wave 4.1 backend** (Data-Pulse-2) | This verification recorded | `GET /api/pos/v1/shifts/stuck?branch_id=` endpoint in Data-Pulse-2; OpenAPI YAML; `shifts` table in Data-Pulse-2 schema |
| 1 | **PR-S5-pre** (POS-Pulse) | Wave 4.1 backend merged | `migrations/0007_shifts.sql` (local shifts table); `npm run codegen:api` pull; `codegen:verify` passes |
| 2 | **PR-S5-a** (POS-Pulse) | PR-S5-pre | Renderer tests T083–T088 (all [P]; no handler code) |
| 3 | **PR-S5-b** (POS-Pulse) | PR-S5-a | `operator.forceCloseShift` handler + T089 + pino log sites T093 |
| 4 | **PR-S5-c** (POS-Pulse) | PR-S5-b | `ForcedCloseSurface.tsx` T090, route T092, `ShiftClosedBanner.tsx` T091, role-visibility-matrix delta |
| 5 | **PR-S5-d** (POS-Pulse) | PR-S5-c | SC-003 cashier-route enumeration T088 + documentation delta |
| 6 | **PR-S5-close** (POS-Pulse) | PR-S5-d | `coordination.md` ✅ ticks, `tasks.md` completions, S5 closeout |

**Critical path:** Wave 4.1 backend → PR-S5-pre (shifts migration + codegen)
→ PR-S5-b (T089). PR-S5-a (tests) may run in parallel with Wave 4.1 backend
work if the test file skeletons are written against the proposed contract above.

T090–T093 (Surface 4A/4B renderer, banner, pino) are NOT blocked on
stuck-shift discovery — they can proceed once PR-S5-a lands. Only T089 is
hard-blocked on the Wave 4.1 endpoint + migrations.

---

## 5. Explicit Non-Actions (This PR)

The following work is **not performed by this PR**:

- ❌ No S5 implementation started — no source, tests, migrations, or handler
  files created or modified.
- ❌ No `migrations/0007_shifts.sql` or any other migration file authored.
- ❌ No `operator.forceCloseShift` implementation or stub added to
  `src/main/operator/`.
- ❌ No `ForcedCloseSurface.tsx` or `ShiftClosedBanner.tsx` created.
- ❌ No `src/shared/bridge-api.ts` changes — `forceCloseShift` not added.
- ❌ No Data-Pulse-2 changes — Wave 4.1 endpoint not authored here.
- ❌ No `contracts/backend-endpoints.md` changes — the Endpoint 7 entry for
  `GET /api/pos/v1/shifts/stuck` is proposed here but NOT written into the
  contracts file (that edit belongs in PR-S5-pre alongside the codegen pull).
- ❌ No codegen (`npm run codegen:api`) run — no OpenAPI change to pull.
- ❌ No 005 or 006 work. 005 remains blocked behind §A0.
- ❌ No changes to `spec.md`, `plan.md`, `research.md`, `data-model.md`,
  `quickstart.md`, or any file under `contracts/`.
- ❌ No CI or package.json changes.
- ❌ No changes to `visual-direction/` or `a1-amendment/`.

**Issue 88 remains OPEN.** This verification PR does not close it. Issue 88
is the next S5 implementation candidate after the Wave 4.1 backend lands.
