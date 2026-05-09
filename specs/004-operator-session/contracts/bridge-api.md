# Contract — `operator.*` preload bridge

**Plan:** [../plan.md](../plan.md) (v1.1)
**Research:** [../research.md](../research.md)
**Data model:** [../data-model.md](../data-model.md)

This contract describes the new `operator.*` namespace 004 adds to the
preload bridge (`src/shared/bridge-api.ts` + `src/preload/operator.ts`).
**No code is authored by `/speckit-plan`.** The contract is the typed
seam that the renderer and the main process both compile against;
`/speckit-tasks` produces the implementation tasks per slice.

---

## Namespace shape

```ts
// src/shared/bridge-api.ts (extended; descriptive — not authored here)

export interface BridgeApi {
  // ... existing 001/002/003 namespaces (pairing, etc.) ...

  operator: {
    listBranchRoster: (req: ListBranchRosterRequest) => Promise<ListBranchRosterResponse>;
    signIn: (req: SignInRequest) => Promise<SignInResponse>;
    signOut: () => Promise<SignOutResponse>;
    getCurrentSession: () => Promise<CurrentSessionResponse>;
    confirmTakeover: (req: ConfirmTakeoverRequest) => Promise<ConfirmTakeoverResponse>;
    cancelTakeover: (req: CancelTakeoverRequest) => Promise<CancelTakeoverResponse>;
    forceCloseShift: (req: ForceCloseShiftRequest) => Promise<ForceCloseShiftResponse>;
    resetCashierPin: (req: ResetCashierPinRequest) => Promise<ResetCashierPinResponse>;  // 🔒 §A1-gated
    unlockCashier: (req: UnlockCashierRequest) => Promise<UnlockCashierResponse>;        // 🔒 §A1-gated
    emitAuditEvent: (req: EmitAuditEventRequest) => Promise<EmitAuditEventResponse>;
  };
}
```

All eight (or ten if §A1 approves) calls return Promises. All bridge calls
self-gate at the main-process side; the renderer is untrusted by
construction. AD-1 is the load-bearing rule.

---

## Common conventions

### Generic refusal

Every call MAY return a generic refusal in place of its expected response.
The refusal envelope is identical across every call:

```ts
interface OperatorRefusal {
  kind: 'refused';
  category: 'role_mismatch' | 'not_signed_in' | 'invalid_input' | 'rate_limited' | 'state_invalid' | 'no_connection';
  // No additional fields. The renderer maps each category to the corresponding
  // generic user-visible message per NFR-003 / PR-2.
}
```

The bridge handler MUST NOT include diagnostic detail beyond `category` in the
renderer-visible refusal. Diagnostic detail is logged main-side per FR-032
(opaque operator references only) and per PR-1 (no credential or PIN material
ever logged).

### Idempotency

Calls that produce audit events accept a client-generated UUID v4 (`event_id`
or analogous) as an explicit parameter (P5). The bridge handler treats a
duplicate `event_id` as a no-op success.

### Role gating

Each call below documents its role-gate. The `requireRole` helper
(`src/main/operator/role-enforcement.ts` per research §6) performs the check
at the bridge handler's first instruction. A call from a session whose role
is not in the allowed set returns `OperatorRefusal { category: 'role_mismatch' }`.

---

## Calls

### 1. `operator.listBranchRoster`

**Purpose**: Fetch the branch operator roster for the cashier sign-in
surface (RosterList).

**Input**:

```ts
interface ListBranchRosterRequest {
  // No fields. The branch is determined by the terminal's paired-state.
}
```

**Output (success)**:

```ts
interface ListBranchRosterResponse {
  kind: 'roster';
  cashiers: Array<{
    id: string;             // stable Clerk user id (opaque to renderer)
    display_name: string;   // FR-004 — no email/phone
    role: 'cashier';        // always cashier in the cashier-roster context
  }>;
}
```

**Role gate**: None. This call is reachable from `/sign-in` (no operator
session yet). The roster is constrained server-side by the terminal's paired
tenant + branch (Constitution VIII / P17).

**Failure modes**:

| Cause | Refusal category |
|:--|:--|
| Network unreachable | `no_connection` |
| Terminal not paired | refused at the boot gate before this call is reachable; MUST NOT happen here |

**Redaction**: The roster does NOT include email, phone, password hash, PIN
material, or audit history (FR-006, FR-031). Only `id`, `display_name`, and
`role` cross the bridge. The renderer is untrusted; the response shape is
the only operator-level information it ever sees.

**Backend dependency**: §A2 — `GET /v1/operators/roster?branch_id=`. See
contracts/backend-endpoints.md.

---

### 2. `operator.signIn`

**Purpose**: Authenticate an operator and create an operator session.

**Input**:

```ts
type SignInRequest =
  | { kind: 'manager_admin'; identifier: string; password: string }
  | { kind: 'cashier'; cashier_id: string; pin: string };  // 🔒 §A1-gated
```

**Output (success)**:

```ts
interface SignInResponse {
  kind: 'signed_in';
  session: {
    id: string;             // session UUID v4
    operator_id: string;    // Clerk user id
    display_name: string;
    role: 'cashier' | 'manager' | 'admin';
    tenant_id: string;
    branch_id: string;
    started_at: string;     // ISO timestamp
  };
}
```

**Output (takeover required)**:

```ts
interface TakeoverRequiredResponse {
  kind: 'takeover_required';
  /**
   * Opaque capability token (UUID v4). The renderer passes this back to
   * `confirmTakeover` or `cancelTakeover`. It is NOT a session id, operator
   * id, or any identifying field — it is a short-lived (60s TTL) one-time
   * token that authorises the completion or abandonment of the takeover.
   * No identification of the prior terminal/operator/timestamp is conveyed
   * (FR-013 / Alternative A proto-session map).
   */
  pending_takeover_id: string;
}
```

The renderer follows up with `confirmTakeover` or `cancelTakeover`, passing
the `pending_takeover_id` token.

**Role gate**: None — this is the sign-in entry point.

**Failure modes**:

| Cause | Refusal category | Notes |
|:--|:--|:--|
| Wrong password / wrong PIN / no roster pick / disabled account / tenant-branch mismatch | `invalid_input` | Single generic category per NFR-003 / PR-2. |
| Cashier locked out (PR-3) | `rate_limited` | Only error category that distinguishes itself, per PR-2 exception. |
| Network unreachable (manager/admin path requires Clerk; cashier path requires Clerk identity validation) | `no_connection` | |
| Cashier path called before §A1 approval | refused at compile time — the cashier branch of the discriminated union is gated; the bridge handler returns `OperatorRefusal { category: 'invalid_input' }` if reached pre-approval | |

**Redaction (PR-1, load-bearing)**: The `password` and `pin` fields cross the
bridge ONCE on input and are consumed by the main-process verifier. They MUST
NOT be:

- Persisted by the bridge handler (no caching, no replay buffer).
- Echoed in any log line, Sentry event, or diagnostic surface.
- Included in any test snapshot.
- Visible in main-process error stack traces (the verifier MUST scrub them
  from any thrown error).

The cross-process redaction smoke test (extending 002's) covers this.

**Cashier path specifics (§A1-gated)**:

- The `cashier_id` is the Clerk user id chosen from the roster.
- The PIN is verified against the local `cashier_pin_records` row keyed by
  `(tenant_id, branch_id, terminal_id, cashier_id)` (PR-4).
- A failed PIN increments `failed_attempt_count`; on attempt 5 within 5
  minutes, sets `lockout_until = now + 5 min` (PR-3). Subsequent attempts
  return `rate_limited`.
- On success, the bridge resets `failed_attempt_count = 0`,
  `lockout_until = null`, and creates a new `operator_sessions` row.
- The PIN is NEVER consulted by any backend endpoint; the cashier's
  Clerk-anchored identity (cached client-side after first sign-in) is used
  to obtain backend tokens (AD-2).

**Backend dependency**: §A2 — `POST /v1/operators/sign-in` (manager/admin
variant only — cashier path is local).

---

### 3. `operator.signOut`

**Purpose**: End the current operator session.

**Input**: `void`.

**Output (success)**:

```ts
interface SignOutResponse {
  kind: 'signed_out';
}
```

**Role gate**: Any signed-in role (cashier, manager, admin).

**Failure modes**: None expected; calling `signOut` while not signed in
returns `OperatorRefusal { category: 'not_signed_in' }` as a no-op.

**Side effects**:

- The current `operator_sessions` row is updated with `end_at = now` and
  `end_cause = 'signed_out'`.
- The renderer-side `operatorSessionStore` transitions to `signingOut` then
  `signedOut`.
- The shell unmounts and the boot router redirects to `/sign-in`.

**Backend dependency**: §A2 — `POST /v1/operators/sign-out`.

**Latency requirement**: Under 1 second (NFR-007).

---

### 4. `operator.getCurrentSession`

**Purpose**: Read-only inquiry for the current operator session. Used by the
renderer-side route guard at every navigation event.

**Input**: `void`.

**Output**:

```ts
type CurrentSessionResponse =
  | { kind: 'signed_in'; session: SignInResponse['session'] }
  | { kind: 'signed_out' };
```

**Role gate**: None (the call IS the role probe).

**Failure modes**: None. If the main-process state is genuinely unknown
(e.g., immediately after process restart), the bridge handler restores from
the persisted `operator_sessions` row (latest with `end_at IS NULL`) before
responding.

**Why the persisted-restore is required**: NFR-009 — the role boundary must
hold across application restart. Without persisted-state restoration, a
cashier mid-shift on a terminal that crashes and restarts would be silently
returned to `signedOut` by `getCurrentSession`, which contradicts the
expected behaviour (the cashier resumes their session).

---

### 5. `operator.confirmTakeover`

**Purpose**: Confirm an explicit takeover from the previous terminal,
proceeding with sign-in on the current terminal.

**Input**:

```ts
interface ConfirmTakeoverRequest {
  /**
   * The opaque capability token returned in `TakeoverRequiredResponse`.
   * Validated against the in-memory proto-session store (60s TTL).
   * One-time use — consumed on success or hard backend refusal.
   */
  pending_takeover_id: string;
}
```

**Output (success)**: Identical to `SignInSuccessResponse` (a session is now
active on this terminal). An `operator.session.takeover` audit event is
emitted (best-effort — audit failure does not abort the flow).

**Role gate**: None — this completes a sign-in flow.

**Implementation note — cashier path (AD-2)**:
Cashier operators have no Clerk JWT, so Endpoint 4's `Authorization: Bearer`
header cannot be satisfied. The cashier `confirmTakeover` creates the new
session locally without a backend call (identical to the cashier sign-in
path). See `TakeoverHandler.confirmCashierTakeover` and issue #85.

**Failure modes**:

| Cause | Refusal category |
|:--|:--|
| `pending_takeover_id` is empty, unknown, or expired (TTL 60s) | `invalid_input` |
| Network unreachable (manager/admin path only) | `no_connection` |

**Side effects**:

- The prior `operator_sessions` row (the one being superseded) is updated
  with `end_at = now`, `end_cause = 'superseded_by_takeover'`.
- A new `operator_sessions` row is created on the current terminal.
- An `operator.session.takeover` audit event is emitted.
- The prior terminal discovers the takeover passively: the backend terminates
  the superseded session (Endpoint 4 side effect); the prior terminal's next
  `getCurrentSession` backend-validation call will return `signed_out`.
  Terminal A's local `SessionManager` is an in-process singleton that is NOT
  directly invalidated by this handler (separate OS processes). An explicit
  backend-driven push notification is deferred — see follow-up issue filed
  from PR #100 (T069c terminal-A invalidation gap).

**Backend dependency**: §A2 — `POST /v1/operators/takeover/confirm`.

---

### 6. `operator.cancelTakeover`

**Purpose**: Cancel the takeover prompt without proceeding.

**Input**:

```ts
interface CancelTakeoverRequest {
  /**
   * The opaque capability token returned in `TakeoverRequiredResponse`.
   * The proto-session is discarded. Idempotent — unknown or already-expired
   * tokens are silently accepted.
   */
  pending_takeover_id: string;
}
```

**Output**:

```ts
interface CancelTakeoverResponse {
  kind: 'cancelled';
}
```

**Role gate**: None.

**Failure modes**: None expected. Returns `{ kind: 'cancelled' }` for any
input including an unknown `pending_takeover_id` (idempotent).

**Side effects**: The `operatorSessionStore` returns to `signedOut`. No
session is created. No audit event is emitted. The prior session on the
other terminal is unaffected.

---

### 7. `operator.forceCloseShift`

**Purpose**: Manager- or admin-attributable forced close of a stuck shift
(FR-024 / S5).

**Input**:

```ts
interface ForceCloseShiftRequest {
  event_id: string;          // client-generated UUID v4
  shift_id: string;          // the stuck shift
  reason: 'takeover_supersession' | 'cashier_no_show' | 'cashier_illness' | 'terminal_failure' | 'other';
  annotation?: string;       // optional free-text; never used as the structural reason
}
```

**Output (success)**:

```ts
interface ForceCloseShiftResponse {
  kind: 'forced_closed';
  audit_event_id: string;  // the emitted shift.forced_close event_id
}
```

**Role gate**: `manager` or `admin`. AND the calling session's `branch_id`
MUST match the stuck shift's `branch_id` (P17 — branch isolation).

**Failure modes**:

| Cause | Refusal category |
|:--|:--|
| Cashier session calling | `role_mismatch` |
| Branch mismatch | `role_mismatch` (deliberately conflated with role mismatch — no leakage of cross-branch shift existence, P17) |
| Shift already closed (normal or forced) | `state_invalid` |
| Network unreachable | `no_connection` |

**Side effects**:

- The shift's `lifecycle_state` transitions to `closed_forced`.
- The shift's `declared_count` is recorded as **null / absent** (PR-1 +
  blind-close discipline; FR-024(a) — the manager does NOT enter a count on
  the cashier's behalf).
- A `shift.forced_close` audit event is emitted with both `acting_operator_id`
  (the executing manager / admin) and `shift_owner_id` (the absent cashier),
  per FR-024(b).
- The takeover audit event (if any) that stranded this shift is NOT modified
  or merged — they are independent records (Edge Cases — takeover-stranded
  shift).

**Backend dependency**: §A2 — `POST /v1/audit-events` recognises
`shift.forced_close` action category.

---

### 8. `operator.resetCashierPin` (🔒 §A1-gated)

**Purpose**: PR-5 — manager- or admin-attributable PIN reset for a cashier
on this terminal.

**Input**:

```ts
interface ResetCashierPinRequest {
  event_id: string;
  target_cashier_id: string;  // Clerk user id of the cashier
  new_pin: string;            // 4–6 digits; consumed by the main-process verifier and discarded
}
```

**Output (success)**:

```ts
interface ResetCashierPinResponse {
  kind: 'pin_reset';
  audit_event_id: string;
}
```

**Role gate**: `manager` or `admin`.

**Failure modes**:

| Cause | Refusal category |
|:--|:--|
| Cashier session calling | `role_mismatch` |
| `target_cashier_id` is not a cashier on this branch | `invalid_input` |
| `new_pin` is not 4–6 digits | `invalid_input` |
| Network unreachable | success (PIN reset is a local operation; the audit event is emitted locally and queued for sync per the outbox pattern) |

**Side effects**:

- The `cashier_pin_records` row for `(tenant_id, branch_id, terminal_id,
  target_cashier_id)` is created (if not present) or overwritten (if
  present) with the new Argon2id hash + a fresh salt. `failed_attempt_count`
  is reset to 0; `lockout_until` is set to null.
- A `cashier.pin.reset` audit event is emitted, attributed to the executing
  manager/admin, referencing `target_cashier_id`. The PIN value is NEVER in
  the audit payload (PR-1).

**Redaction (PR-1, load-bearing)**: `new_pin` MUST be redacted in pino, in
the bridge boundary log lines, in Sentry, and in any error path. The
cross-process redaction smoke test covers this.

---

### 9. `operator.unlockCashier` (🔒 §A1-gated)

**Purpose**: PR-3 release path b — manager- or admin-attributable unlock of
a locked-out cashier on this terminal.

**Input**:

```ts
interface UnlockCashierRequest {
  event_id: string;
  target_cashier_id: string;
}
```

**Output (success)**:

```ts
interface UnlockCashierResponse {
  kind: 'unlocked';
  audit_event_id: string;
}
```

**Role gate**: `manager` or `admin`.

**Failure modes**:

| Cause | Refusal category |
|:--|:--|
| Cashier session calling | `role_mismatch` |
| `target_cashier_id` not currently locked out on this terminal | `state_invalid` (the unlock is a no-op, but the bridge handler still emits a `cashier.pin.unlock` audit event for the support trail; the renderer interprets `state_invalid` as "already unlocked, no-op") |

**Side effects**:

- The `cashier_pin_records` row's `failed_attempt_count` is reset to 0;
  `lockout_until` is set to null.
- A `cashier.pin.unlock` audit event is emitted.

**No PIN value is involved.** This call MUST NOT accept any PIN field; it
only unlocks.

---

### 10. `operator.emitAuditEvent`

**Purpose**: General-purpose audit-event emission. Used by 005+ features to
emit refunds, voids, overrides, drawer kicks, etc.

**Input**:

```ts
interface EmitAuditEventRequest {
  event_id: string;
  action_category: string;        // see data-model.md Catalogue
  shift_id?: string;
  approving_supervisor_id?: string;
  payload: Record<string, unknown>;  // schema per action_category
}
```

The bridge handler fills in:

- `acting_operator_id` from the current session.
- `tenant_id`, `branch_id` from the current session.
- `originating_terminal_id` from the device-token state (002).
- `created_at` as the current main-process clock.

**Output (success)**:

```ts
interface EmitAuditEventResponse {
  kind: 'emitted';
  event_id: string;  // echoed back; idempotency confirmation
}
```

**Role gate**: Action-category-specific. The catalogue rule:
`shift.forced_close`, `cashier.pin.reset`, `cashier.pin.unlock` require
manager/admin; `shift.open` requires cashier; etc. The bridge handler
dispatches by `action_category`. An action category that requires a role
the current session does not have returns `role_mismatch`.

**Idempotency**: Re-submitting the same `event_id` returns the same
`emitted` envelope without duplicating the row (P5).

**Failure modes**:

| Cause | Refusal category |
|:--|:--|
| Caller does not have role for the action category | `role_mismatch` |
| Mandatory FR-025 attributes missing or invalid | `invalid_input` |
| `payload` does not conform to the per-category schema | `invalid_input` |

**Redaction**: The `payload` MUST NOT contain raw cardholder data, full PII,
credential fragments, PIN values, session tokens, or Clerk JWTs (FR-027 /
PR-1). The bridge handler runs a redaction-allowlist check on `payload`
before insertion; payloads that fail the check are refused.

---

## Audit-event categories — quick reference

(Restated from data-model.md for cross-reference convenience.)

| Category | Acting role | Bridge call that emits it |
|:--|:--|:--|
| `shift.open` | `cashier` | `emitAuditEvent` (called by future shift feature) |
| `shift.close` | `cashier` | `emitAuditEvent` (called by future shift-close feature) |
| `shift.forced_close` | `manager` or `admin` | `forceCloseShift` |
| `operator.session.takeover` | acting operator on the new terminal | `confirmTakeover` |
| `cashier.pin.reset` (§A1) | `manager` or `admin` | `resetCashierPin` |
| `cashier.pin.unlock` (§A1) | `manager` or `admin` | `unlockCashier` |
| `operator.session.pin_unlock` (§A1, OPTIONAL) | `cashier` (post-unlock) | bridge handler emits internally on successful PIN sign-in if enabled |

---

## Out of scope for this contract

- **No backend endpoint authoring.** OpenAPI changes are gated on §A2 and
  documented in [./backend-endpoints.md](./backend-endpoints.md).
- **No SQL DDL.** Schema is described conceptually in
  [../data-model.md](../data-model.md); migrations are gated on §A3 and
  authored in `/speckit-tasks`.
- **No source code.** This file describes the typed seam; both ends of the
  bridge compile against the interface but neither end's implementation
  lands until its slice does.

---

**End of bridge-API contract.** Ten calls described (or eight if §A1 denies
AD-2 — the cashier-PIN-related calls fall away). Every call self-gates,
returns generic refusals, and respects PR-1…PR-6 plus FR-025/FR-027/FR-031.
