# Contract — Backend OpenAPI dependencies

**Plan:** [../plan.md](../plan.md) (v1.1)
**Approval Gate:** §A2 (this whole document is gated)

> **Revision note (2026-05-06, PR-0 — endpoint namespace alignment).**
> All POS-facing endpoints in this contract are namespaced under
> `/api/pos/v1/...` to match the SmartDataPulse backend (`Data-Pulse-2`)
> URL convention discovered during Wave 1 backend planning. The
> `/api/pos/v1/` prefix scopes the surface to the POS terminal product
> and keeps it clearly disjoint from the existing dashboard auth surface
> at `/api/v1/auth/*`. Older planning artifacts in this feature folder
> (`plan.md`, `tasks.md`, `bridge-api.md`, `research.md`, `spec.md`,
> `a1-amendment/proposal.md`) may still cite the legacy `/v1/operators/*`
> / `/v1/audit-events` shorthand; **treat those references as legacy
> aliases for the canonical paths in this file**. The contract of
> record is this document.

This contract describes the backend endpoints that 004 depends on. **It does
not author OpenAPI YAML, does not mutate `scripts/openapi-snapshot.json`, and
does not modify `src/shared/api-types.ts`.** Each endpoint below lands in the
SmartDataPulse backend repo first, with its OpenAPI spec reviewed against the
shape described here; once each endpoint exists in the backend's spec, the
POS Pulse `codegen:api` task pulls the regenerated types and `codegen:verify`
confirms determinism (constitution V).

The user's hard-exclusion list explicitly forbids "Do not change OpenAPI" in
this plan phase. **§A2 is the gate that allows this work to proceed.**

The cashier PIN factor introduces ZERO new backend endpoints by design
(AD-2). The PIN is local-only; it never crosses any backend boundary. The
endpoints below are for: manager/admin sign-in, sign-out, takeover-confirm,
roster fetch, audit-event sync.

---

## Conventions

- **Namespace.** All POS-facing endpoints in this contract are mounted
  under `/api/pos/v1/...` on the SmartDataPulse backend. The prefix
  scopes them to the POS terminal product and is disjoint from the
  dashboard auth surface at `/api/v1/auth/*`. The six endpoints below
  use exactly this prefix. `branch_id` remains the POS-facing path /
  query / body vocabulary; `Data-Pulse-2` maps it internally to
  `store_id` / `active_store_id` at the DTO boundary.
- All endpoints assume the existing 001/002 authentication baseline:
  - The terminal's `device_token` is sent as part of every request
    (Constitution VIII — terminal identity).
  - The operator's Clerk JWT is sent in `Authorization: Bearer <jwt>`
    for endpoints that require human identity. The terminal acquires
    the Clerk JWT directly from Clerk (path b — see Endpoint 2's
    revision note); the backend verifies via JWKS and **never**
    receives the user's Clerk password. Subsequent calls in the same
    Clerk session reuse the JWT until it expires; refresh is Clerk's
    responsibility on the terminal side.
- Response envelopes follow the existing platform convention; the shapes
  below describe the payload only.
- All endpoints that touch operator-attributable data MUST validate the
  Clerk JWT's tenant + branch claims against the device token's
  tenant + branch scope; mismatches return a generic refusal.
- All endpoints MUST honour the existing PII redaction rules at the
  application boundary; logs and Sentry events MUST NOT include credential
  material.

---

## Endpoint 1 — `GET /api/pos/v1/operators/roster`

**Purpose**: Return the branch operator roster for the cashier sign-in
surface (`operator.listBranchRoster`).

**Caller**: A paired terminal with a valid device token. **No operator JWT
required** — the call happens at `/sign-in`, before any operator session
exists.

**Query parameters**:

- `branch_id` (string, required) — the branch the terminal is paired to.
  The backend MUST validate this against the device token's branch claim
  and refuse if they don't match (P17 — branch isolation).

**Response shape (success)**:

```json
{
  "cashiers": [
    {
      "id": "<clerk_user_id>",
      "display_name": "<short string>",
      "role": "cashier"
    }
  ]
}
```

The response includes ONLY cashier-role users, ONLY their `id`,
`display_name`, and `role`. **MUST NOT** include email, phone, password
hash, audit history, or any other field (FR-006 / FR-031 / PR-1).

Manager and admin users are NOT in this response — they sign in via a
different surface that does not show a roster.

**Failure modes** (generic envelopes per the existing platform pattern):

- 4xx — branch mismatch / device token invalid → terminal interprets as
  "no connection / try again" or boots back to pairing per 002.
- 5xx — backend fault → terminal surfaces "no connection — try again".

**Idempotency**: Idempotent (GET).

**Backend implementation note**: The roster is read-only from the POS
Pulse perspective; cashier provisioning (creating cashier Clerk users on a
branch) is a separate admin-app flow that 004 does not own.

---

## Endpoint 2 — `POST /api/pos/v1/operators/sign-in`

> **Revision note (2026-05-06, B-1 — Wave 1 alignment).** This endpoint
> is revised to use **Clerk JWT verification (path b)** per the
> approved §A2 Wave 1 alignment decision (see
> [`../coordination/wave1-alignment-decision.md`](../coordination/wave1-alignment-decision.md)).
> The POS terminal completes the Clerk credential exchange against
> Clerk directly (Frontend SDK / public APIs), obtains a Clerk session
> JWT, and posts it to this endpoint in the `Authorization` header.
> **Data-Pulse-2 MUST NOT receive, log, or store the user's Clerk
> password.** Path (a) — backend-talks-to-Clerk-with-credentials — is
> explicitly rejected for this endpoint.

**Purpose**: Establish a backend operator session for a manager or
admin, using a Clerk-verified human identity. The terminal has already
authenticated the human against Clerk and holds a fresh Clerk session
JWT; this endpoint validates that JWT, validates the terminal's
device-token scope, validates role + tenant + branch eligibility, and
records a backend `operator_sessions` row. The cashier path does NOT
use this endpoint (cashier identity is validated server-side via the
cached Clerk identity, but the PIN unlock that triggers the cashier
session is purely local — the cashier session's backend token derives
from the cached Clerk JWT pipeline). **The cashier PIN MUST NEVER be
sent to Data-Pulse-2 (AD-2 / §A1 / Constitution v1.5.1).**

**Caller**: A paired terminal at the manager/admin sign-in surface,
**after** completing the Clerk credential exchange.

**Request headers (required)**:

- `Authorization: Bearer <clerk_jwt>` — the Clerk session JWT held by
  the terminal. Verified server-side via Clerk JWKS (issuer +
  signature + `exp` + `nbf`); no Clerk Backend SDK call on the hot
  path in Wave 1.
- The platform's existing terminal device-token header (e.g.
  `X-Device-Token: <token>` — exact header name follows the existing
  001/002 baseline; defined once at the platform level, not per
  endpoint). The device token resolves to a `tenant_id` + `branch_id`
  scope.

**Request body**:

```json
{
  "kind": "manager_admin",
  "device_token_attestation": "<terminal-side proof>"
}
```

The body **MUST NOT** include `password`, `identifier`, `pin`, or any
other credential field. `kind` discriminates the sign-in surface
(reserved for future surfaces); manager/admin is the only kind in
Wave 1.

**Response shape (success)**:

```json
{
  "kind": "signed_in",
  "operator": {
    "id": "<clerk_user_id>",
    "display_name": "<short string>",
    "role": "manager" | "admin",
    "tenant_id": "<opaque>",
    "branch_id": "<opaque>"
  },
  "operator_session": {
    "id": "<uuid>",
    "issued_at": "<ISO timestamp>"
  }
}
```

The response **does not** echo a `clerk_session_token`: the terminal
already holds the Clerk JWT it sent in `Authorization`. The backend's
job here is to confirm the human's eligibility on this terminal and
to mint a backend operator-session id (used by Endpoint 3 / Endpoint
5 to identify the active session). The Clerk JWT continues to travel
on subsequent requests in `Authorization: Bearer <clerk_jwt>` until
it expires; refresh is Clerk's responsibility on the terminal side.

**Response shape (takeover required — the operator already has an active
session on a different terminal in this branch)**:

```json
{
  "kind": "takeover_required"
}
```

The response contains NO terminal name, no timestamp, no other-operator
data (FR-013 — minimum-disclosure invariant preserved). The terminal
interprets this as "render the TakeoverPrompt".

**Server-side validation order** (each step ends in a generic refusal
on failure; ordering does NOT change the response shape):

1. **Device-token scope** — verify the terminal's device token,
   resolve `tenant_id` + `branch_id`. Refusal on missing / invalid /
   revoked token.
2. **Clerk JWT verification** — verify `Authorization: Bearer <jwt>`
   against Clerk JWKS (issuer, signature, `exp`, `nbf`). Refusal on
   any verification failure. JWKS is cached server-side; cache miss
   does NOT distinguish in the response.
3. **Operator identity resolution** — look up the Clerk `sub` claim
   in `operator_identities`. Refusal if no row, or if
   `disabled_at IS NOT NULL`.
4. **Role eligibility** — refusal unless `operator_identities.role`
   is `manager` or `admin`. Cashier-role identities cannot sign in
   on this endpoint.
5. **Tenant + branch scope** — refusal if the operator identity's
   `tenant_id` + `branch_id` (`store_id` internally) do not match
   the device token's tenant + branch scope.
6. **Takeover detection** — if an active `operator_sessions` row
   exists for this `operator_id` on a different terminal in this
   branch, return `{"kind": "takeover_required"}`. Otherwise create
   a new `operator_sessions` row and return the success envelope.

**Failure modes**:

- Generic refusal (4xx) for: invalid Clerk JWT, expired Clerk JWT,
  unknown Clerk subject, account disabled, role not manager/admin,
  tenant/branch mismatch, device-token scope mismatch, rate-limited
  (NFR-003 / PR-2). The response MUST NOT distinguish among these
  in the body.
- The lockout case (PR-3 lives client-side for the cashier PIN
  factor; manager/admin lockout is Clerk's responsibility — the
  Clerk session is simply revoked / refused to refresh on the
  terminal side, after which the next backend call fails JWKS
  verification and is mapped to the `rate_limited` / generic
  refusal category client-side).

**Redaction (server-side, P11)**: The backend MUST NOT log the raw
Clerk JWT, `device_token_attestation`, or any `Authorization` header
value to logs / Sentry / observability surfaces. Because the request
body no longer carries `password`, the prior server-side
password-redaction obligation is moot: **no path may exist that
ingests, logs, or persists a user's Clerk password.** This is a
backend rule; `contracts/bridge-api.md` governs the client-side
rule.

---

## Endpoint 3 — `POST /api/pos/v1/operators/sign-out`

**Purpose**: End an active operator session.

**Caller**: A paired terminal with a valid device token + Clerk session
token.

**Request shape**:

```json
{
  "session_id": "<uuid>"
}
```

**Response shape (success)**:

```json
{
  "kind": "signed_out"
}
```

**Failure modes**: Generic refusal for invalid session id; the client-side
behaviour treats sign-out as best-effort and proceeds to local sign-out
even on backend failure (FR-008 / NFR-007 — sign-out MUST return to
Sign-In within 1 s regardless of backend reachability).

---

## Endpoint 4 — `POST /api/pos/v1/operators/takeover/confirm`

**Purpose**: Confirm an explicit takeover from a prior terminal, terminating
the prior operator session and creating a new one on the current terminal.

**Caller**: A paired terminal that just received a `takeover_required`
response from `/sign-in`.

**Request shape**:

```json
{
  "event_id": "<uuid v4 — client-generated for P5 idempotency>",
  "operator_id": "<clerk_user_id>",
  "device_token_attestation": "<terminal-side proof>"
}
```

**Response shape (success)**: Identical to `POST /api/pos/v1/operators/sign-in`'s
success envelope. A new session is now active.

**Side effects (backend)**:

- The prior operator session for `operator_id` (regardless of which terminal
  hosted it) is marked terminated with `end_cause = 'superseded_by_takeover'`.
- A new operator session is created on the calling terminal.
- The corresponding `operator.session.takeover` audit event is recognised
  (it is emitted client-side via `POST /api/pos/v1/audit-events` per Endpoint 5,
  not by this endpoint directly — preserving the rule that audit events
  flow through one consolidated audit-sync channel).

**Idempotency**: The `event_id` ensures that re-submitting the same takeover
confirmation is a no-op (P5). The bridge handler's takeover-detection logic
MAY fire `confirmTakeover` more than once during a network blip; the second
call returns the same successful envelope without creating a second
`operator_sessions` row or a second audit event.

**Failure modes**:

- Generic refusal if the operator does not currently have an active session
  on any terminal (the takeover prompt was stale).
- `no_connection` returned client-side if the request fails network-wise;
  the local takeover state is rolled back and the renderer returns to
  `signedOut`.

---

## Endpoint 5 — `POST /api/pos/v1/audit-events`

**Purpose**: Sync locally-emitted audit events to the backend audit log.

**Caller**: A paired terminal with a valid device token. The Clerk JWT MAY
or MAY NOT be present (audit events emitted during sign-out, takeover
confirmation, or operator-account-disabled-mid-session paths may have a
session that is in the process of ending; the backend MUST accept events
on the basis of the device token + the event's own
`acting_operator_id` claim, validated against the device token's
tenant + branch).

**Request shape**:

```json
{
  "events": [
    {
      "event_id": "<uuid v4>",
      "tenant_id": "<opaque>",
      "branch_id": "<opaque>",
      "originating_terminal_id": "<opaque>",
      "acting_operator_id": "<clerk_user_id>",
      "session_id": "<uuid v4 | null>",
      "shift_id": "<uuid v4 | null>",
      "action_category": "<one of the catalogue values>",
      "created_at": "<ISO timestamp>",
      "approving_supervisor_id": "<clerk_user_id | null>",
      "payload": { /* per-category schema */ }
    }
  ]
}
```

The endpoint accepts batches (the offline outbox typically accumulates
several events between sync attempts).

**Response shape (success)**:

```json
{
  "accepted": [ "<event_id>", "..." ],
  "duplicates": [ "<event_id>", "..." ],
  "rejected": [
    { "event_id": "<...>", "category": "invalid_input" | "tenant_mismatch" | "schema_violation" }
  ]
}
```

- `accepted`: Events the backend has now persisted.
- `duplicates`: Events whose `event_id` was already known to the backend
  (P5 idempotency — the client MAY mark these as `synced_at = now` locally).
- `rejected`: Events the backend refuses (malformed, tenant mismatch,
  schema violation). Rejected events stay in the local outbox; support
  reviews them via support-bundle export.

**Idempotency (P5)**: The backend uses `event_id` as the dedup key. The same
event submitted twice produces one persisted record + one duplicate
acknowledgement.

**Audit-event recognition by category**: The backend MUST recognise (at
minimum, per FR-026) the catalogue from data-model.md:
`shift.open`, `shift.close`, `shift.forced_close`,
`operator.session.takeover`, `cashier.pin.reset`, `cashier.pin.unlock`,
plus future categories added by 005+. Unknown categories are rejected.

The `shift.forced_close` and `shift.close` categories MUST be persisted
distinctly; the backend MUST NOT collapse them into a single category
(FR-026).

**Redaction (server-side, P6 / P7 / P11)**: The `payload` MUST NOT contain
raw cardholder data, raw payment-instrument data, full PII, credential
fragments, PIN values, or session tokens (FR-027 / PR-1). The backend
SHOULD enforce this with a server-side schema validator that rejects
events whose `payload` contains forbidden field names; the client side
already enforces it via the bridge handler's allowlist check.

---

## Endpoint 6 — `GET /api/pos/v1/operators/active-session`

**Purpose**: Allow a paired terminal to discover whether an operator
already has an active session somewhere in the branch, **before** the
terminal creates its own local operator session. This is the takeover-
detection lookup for the cashier sign-in path (`operator.signIn` cashier
variant), since the cashier path's PIN verification is purely local
(AD-2) and therefore lacks the natural takeover-detection signal that
the manager/admin path gets from Endpoint 2's `takeover_required`
response.

**Caller**: A paired terminal with a valid device token. The Clerk JWT
MAY or MAY NOT be present:

- **Cashier path** (the primary caller): the call happens immediately
  after a successful local PIN unlock and before the local
  `operator_sessions` row is created. The cashier's Clerk identity is
  available client-side from the cached identity provisioned at cashier
  onboarding; the call carries this identity to the backend.
- **Manager/admin path**: this endpoint is NOT called on the manager/
  admin path. Endpoint 2's response envelope already covers takeover
  detection for that path (the response is either `signed_in` or
  `takeover_required`).

**Query parameters**:

- `operator_id` (string, required) — the Clerk user id of the operator
  who just unlocked locally. The backend validates `operator_id` against
  the device token's tenant + branch claims and refuses (generic 4xx) if
  the operator is not authorised on this branch (P17 + FR-003 minimum-
  disclosure).

**Response shape (success)**:

```json
{ "kind": "none" }
```

OR

```json
{ "kind": "active" }
```

**That is the entire response payload.** No additional fields.
Specifically, the response MUST NOT include:

- The terminal id, label, or any locator of the prior session.
- The prior session's start time, last-activity time, or end time.
- The operator's role, display name, or any other identity attribute.
- Any branch-position or terminal-layout data.
- Any indication of *how many* prior sessions exist (the backend's
  invariant is "at most one active session per operator branch-wide" per
  FR-013, so the answer is binary by design).

**Why the response is binary**: FR-013's minimum-disclosure rule for the
takeover prompt is normative. Any additional response field would leak
information that the cashier surface MUST NOT see. The renderer turns a
`kind: "active"` response into the generic `TakeoverPrompt`; it never
sees more than that.

**No PIN data**: Endpoint 6 MUST NOT accept a PIN field, MUST NOT
receive a PIN as part of any header or query parameter, and MUST NOT log
any field that could carry a PIN. The cashier's PIN is verified locally
*before* this endpoint is called; if the local PIN verification fails,
this endpoint is never reached. This preserves AD-2: the cashier PIN is
never consulted by any backend endpoint.

**Idempotency**: Idempotent (GET); the response can be retried freely.
The response reflects the backend's current state at the time of the
call; a subsequent call may return a different value if the prior
session ended in between (e.g., due to a concurrent takeover from a
third terminal — though this is rare under the single-active-session
invariant).

**Failure modes** (generic envelopes per the existing platform pattern):

- 4xx — `operator_id` not authorised on this branch / device token
  invalid / tenant mismatch → terminal interprets as "credentials not
  recognised" (NFR-003 / PR-2 generic). The local PIN unlock that
  preceded this call is rolled back: no `operator_sessions` row is
  created; `failed_attempt_count` MAY be incremented at client
  discretion (recommended: yes, to keep PR-3 lockout symmetric across
  network-and-local failure modes).
- 5xx — backend fault → terminal surfaces `no_connection`. The cashier
  is asked to retry. No session is created locally.

**Side effects (server-side)**: NONE. This endpoint is read-only. It
MUST NOT mutate any operator-session state, MUST NOT emit any audit
event, MUST NOT trigger any notification.

**Backend implementation note**: The backend's session-tracking table
already exists (Endpoint 2 maintains it for the manager/admin path).
Endpoint 6 is a read-only query against the same table, scoped by
`operator_id` and the device token's branch claim.

---

## Out of scope for this contract

- **Cashier sign-in endpoint.** The cashier path is purely local (AD-2).
  No backend endpoint exists for it. The cashier's session backend token
  derives from the cached Clerk JWT, obtained via the existing 002 +
  Clerk pipeline at cashier identity provisioning time.
- **Cashier identity provisioning.** Creating a cashier Clerk user on a
  branch is a backend admin-app flow (manager/admin in the platform admin
  app). 004 does not own this endpoint.
- **PIN-record endpoints.** The cashier PIN is local; no backend endpoint
  reads or writes it. PR-1 / AD-2.
- **Cashier roster mutation.** Adding / removing cashiers from a branch is
  the admin-app flow above. 004 only reads the roster.
- **Audit-log read endpoints.** Future feature (manager-or-admin readable
  audit log surface, per FR-029). 004 does not implement reading the audit
  log.
- **Shift mechanics endpoints.** Future shift-management feature.

---

## Approval Gate §A2 — what unblocks

| Slice | Endpoints needed |
|:--|:--|
| S1 | `POST /api/pos/v1/operators/sign-in` (manager/admin variant), `POST /api/pos/v1/operators/sign-out` |
| S3 | `POST /api/pos/v1/audit-events` (with at least the placeholder action category recognised) |
| S4 | `GET /api/pos/v1/operators/roster` (cashier path), `POST /api/pos/v1/operators/takeover/confirm`, **`GET /api/pos/v1/operators/active-session` (Endpoint 6 — cashier-path takeover detection; binary `{kind: "none" \| "active"}` response; no PIN data accepted)**, `POST /api/pos/v1/audit-events` (with `operator.session.takeover` and `cashier.pin.reset` / `cashier.pin.unlock` recognised) |
| S5 | `POST /api/pos/v1/audit-events` (with `shift.forced_close` recognised) |

Each row is a separate backend feature ticket. `/speckit-tasks` will
schedule the dependent POS Pulse work behind the corresponding backend
delivery.

---

**End of backend-endpoints contract.** **Six** endpoints described
conceptually (Endpoint 6 added 2026-05-05 to address `/speckit-analyze`
finding U1 — cashier-path takeover detection). Cashier PIN handling
introduces ZERO endpoints by design — Endpoint 6 takes the cashier's
Clerk identity, never the PIN. Each endpoint is gated on §A2; the POS
Pulse `codegen:api` step regenerates types only after the backend
OpenAPI spec changes.
