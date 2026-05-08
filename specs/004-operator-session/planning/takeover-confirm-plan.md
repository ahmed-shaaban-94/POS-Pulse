# Planning — #85 Takeover Confirm Handler

**Status: planning only — no implementation.** This document is the planning artifact for GitHub issue [#85](https://github.com/ahmed-shaaban-94/POS-Pulse/issues/85). It does NOT authorise edits to `src/`, `tests/`, `migrations/`, `package.json`, `src/shared/bridge-api.ts`, or any Data-Pulse-2 surface. The deliverable described here is a future PR; the current PR is this markdown file alone.

**Feature:** 004-operator-session, Slice S4
**Branch context:** `feat/004-s4-cashier-sign-in-T069` (HEAD `34d1e5e`); takeover work will land on a fresh branch off `main` after #94 merge (HEAD merged to `main` as of 2026-05-08T22:17:02Z, SHA `e9c0b0e`).
**Authoritative reads consulted:** `spec.md` FR-013 / FR-025 / FR-026; `plan.md` AD-1 / AD-2 / AD-3; `tasks.md` T070 / T071 / T069c / T056–T058; `coordination.md` (gate state); `contracts/bridge-api.md`; `contracts/backend-endpoints.md` Endpoint 4 / Endpoint 6; `src/main/operator/sign-in-handler.ts`; `src/main/operator/check-active-session.ts`; `src/main/operator/backend-client.ts`; `src/main/operator/role-enforcement.ts`; `src/shared/bridge-api.ts`; `src/shared/operator/channels.ts`.

---

## 1. Scope and out-of-scope

### In scope (this issue → one PR)

- `operator.confirmTakeover` main-process handler in `src/main/operator/takeover-handler.ts`.
- `operator.cancelTakeover` main-process handler (lightweight; same file or an adjacent module — see §5).
- `operator.session.takeover` audit-event emission glue (uses the existing T046 `AuditEmitter` and the `operator.session.takeover` payload schema landed under T049).
- Prior-session termination plumbing on the local `operator_sessions` row (`end_at` + `end_cause = 'superseded_by_takeover'`) — only as it applies to *this terminal's* local view of the prior session, if any. The authoritative termination of the prior session on terminal A is performed server-side by Endpoint 4.
- New IPC channel constants in `src/shared/operator/channels.ts`: `TAKEOVER_CONFIRM`, `TAKEOVER_CANCEL`.
- Bridge-surface additions in `src/shared/bridge-api.ts`: `ConfirmTakeoverRequest`, `ConfirmTakeoverResponse`, `CancelTakeoverResponse`, two new methods on `OperatorBridgeAPI`.
- Preload exposure of the two new IPC channels in `src/preload/operator.ts` (or wherever the operator namespace is wired).
- Unit tests under `tests/unit/main/operator/takeover-handler.test.ts`.
- Optional small extension to the cross-process redaction smoke (T053) to cover the new log sites.
- Integration tests T056 / T057 / T058 — see §9.

### Out of scope (will be filed separately or already owned by #86)

- **TakeoverPrompt React component** (`src/renderer/ui/operator/TakeoverPrompt.tsx`) — owned by issue #86 (T076).
- **Renderer wiring** of `signingIn → takeoverPrompt → confirmTakeover/cancelTakeover` state transitions — owned by issue #86 (T077).
- **PinPad** (T074) — issue #86.
- **Cashier sign-in surface activation** (T075) — issue #86.
- **Roster handler** (T070a / T070b) — already merged via PR #63.
- **Data-Pulse-2 / backend changes** — Endpoint 4 already merged in Data-Pulse-2 PR #70 (Wave 3). Zero backend changes are in scope here.
- **Migrations** — §A3 already cleared (PR #60); `operator_sessions` schema is live and adequate.
- **Package additions** — none. The plan does not call for new dependencies.
- **S5 forced-close work** (`shift.forced_close`, `<ForcedCloseSurface>`, T089–T093).
- **Sales / cart / payments / tender / receipts / inventory / reports / KPIs / analytics** — barred by the feature 004 "Hard Non-Implementation Boundaries" in `plan.md`.
- **PIN-reset / PIN-unlock handlers** (T072 / T073) — separate S4 issues.
- **Cancel-takeover audit emission** — explicitly NOT done (no audit event for cancellation per FR-013; cancel is a pure local proto-state discard).

---

## 2. Likely exact task IDs from `tasks.md`

The PR will close (or directly cite) these task rows in `specs/004-operator-session/tasks.md`:

| Task ID  | Description (verbatim from tasks.md)                                                                                                                                                                                       | Dependency chain (per tasks.md)         |
|:---------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------|
| **T070** | Implement `operator.confirmTakeover` in `src/main/operator/takeover-handler.ts`: emits `operator.session.takeover` audit event via T046; updates the prior session's `end_at` and `end_cause = 'superseded_by_takeover'`; new session created on the current terminal; **the prior-terminal notification mechanism (passive polling vs active push) follows the decision recorded in T069c's research.md §3 addendum**. | depends on **T046, T069, T069c**         |
| **T071** | Implement `operator.cancelTakeover` (no audit event; no session change; renderer state returns to `signedOut`).                                                                                                            | depends on **T016**                       |
| **T069c** | **Decision task (non-code)** — passive polling vs active push for terminal-A's discovery of the takeover. Edits `research.md` §3 addendum. **MUST land before T070 (or inside the same PR with explicit reviewer call-out).** | (no upstream code deps; produces a doc) |
| **T056** | Integration test: takeover flow happy path. Operator already has active session on terminal A; sign-in on terminal B detects existing session; `TakeoverPrompt` mounts; "Continue here" → terminal A's session ends with `superseded_by_takeover`; terminal A returns to `/sign-in` within 30 s; `operator.session.takeover` audit event emitted with both terminals referenced (FR-013 / FR-026). | (parallel to T070)                       |
| **T057** | Integration test: takeover cancellation — "Cancel" closes prompt; no session created on B; A unaffected (FR-013).                                                                                                          | (parallel to T070 / T071)                |
| **T058** | Integration test: takeover prompt minimum-disclosure — modal copy matches FR-013 exactly; no terminal-A label, no timestamp, no other-operator data appears in the rendered DOM.                                            | (parallel to T070; renderer-side)        |

**Test-task split (recommendation):**

- T056 / T057 / T058 are *renderer integration tests*; their assertions involve the `TakeoverPrompt` component and renderer state transitions. They cannot be fully landed in #85's PR without #86's UI work. Two coherent options:

  1. **Split**: Land T070 + T071 + a *main-process integration test* (no renderer) that exercises the full bridge call sequence (signIn → takeoverRequired response → confirmTakeover → audit-event row in `audit_events` → prior-session row updated) here. T056 / T057 / T058 then land in #86's PR alongside the UI.
  2. **Co-land**: If #85 and #86 are merged together, fold T056–T058 into #85's PR. Less likely given the issue-level split.

  **Recommended: Split.** Keeps #85's diff small (Constitution P13) and lets the UI tests share a fixture with the UI implementation.

- A *new* unit-test file `tests/unit/main/operator/takeover-handler.test.ts` is the load-bearing test artifact in #85's PR. See §9 for the full assertion list.

---

## 3. Dependencies — completed and pending

### Completed (verified merged to `main` as of 2026-05-08)

| Gate / artifact                                          | Status                                                                                                                                                              |
|:----------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| §A1 (local-unlock-factor approval, Constitution v1.5.1)   | ✅ PR #39, merge SHA `7ae337b`, 2026-05-05.                                                                                                                          |
| §A2 Wave 1 (sign-in / sign-out)                           | ✅ Data-Pulse-2 PRs #52 / #54.                                                                                                                                       |
| §A2 Wave 2 (`POST /v1/audit-events`)                      | ✅ Data-Pulse-2 PR #62, SHA `4f77da6`.                                                                                                                               |
| §A2 Wave 3 (roster + **takeover/confirm** + active-session) | ✅ Data-Pulse-2 PR #70, 2026-05-08. Endpoint 4 (`POST /api/pos/v1/operators/takeover/confirm`) live; Endpoint 6 (`GET /api/pos/v1/operators/active-session`) live. |
| §A3 migrations (`audit_events`, `operator_sessions`, `cashier_pin_records`) | ✅ POS-Pulse PRs #49 / #60.                                                                                                                                          |
| §A4 (`argon2` 0.44.0 binding)                             | ✅ POS-Pulse PR #59.                                                                                                                                                |
| S1 (manager/admin sign-in)                                | ✅ PR #46.                                                                                                                                                           |
| S2 (bridge security review)                               | ✅ PR #47.                                                                                                                                                           |
| S3 (audit scaffolding, T039–T051d)                        | ✅ PRs #49–#56, HEAD `ba32133`.                                                                                                                                      |
| T046 (`AuditEmitter`)                                     | ✅ landed in S3.                                                                                                                                                     |
| T049 (`operator.session.takeover` payload schema in `src/shared/audit/payload-schemas.ts`) | ✅ landed in S3.                                                                                                                                                     |
| T052 / T053 (cross-process redaction smoke; PIN-verifier scaffolding) | ✅ PR #90.                                                                                                                                                           |
| T054 / T055 / T067 (PIN unseal helpers, lockout window)    | ✅ PR #92.                                                                                                                                                           |
| T068 (PIN-seal hardening; tampered-ciphertext guard)       | ✅ PR #93.                                                                                                                                                           |
| T069 / T069a / T069b (cashier sign-in handler + active-session helper) | ✅ PR #94 (the immediately preceding PR for this branch's lineage). Cashier path of `operator.signIn` returns `TakeoverRequiredResponse` when terminal-B detects an existing session via `CheckActiveSessionHandler`. |
| T070a / T070b (`operator.listBranchRoster`)                | ✅ PR #63.                                                                                                                                                           |
| `BackendClient.confirmTakeover` (Wave 3 extension method)  | ✅ Already implemented in `src/main/operator/backend-client.ts` (Wave 3 PR #61 / equivalent backend-client extension). Body shape: `{ event_id, operator_id, device_token_attestation }`; success envelope identical to sign-in; `interpretTakeoverConfirmResponse` collapses any returned `takeover_required` to `refused`. |

### Pending blockers (must resolve before #85's PR can merge)

| Gate / artifact | Why it blocks                                                                                                                                                                                                           | Recommended path                                                                                                                                                                                                           |
|:----------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **T069c**       | The decision (passive polling vs active push) for *terminal A's* discovery of the takeover is unresolved. T070's row in `tasks.md` explicitly says: "the prior-terminal notification mechanism … follows the decision recorded in T069c's research.md §3 addendum." Without that decision, T070's "what does terminal A do post-confirm" step has no canonical answer. | Either (a) land T069c as a tiny standalone PR editing `research.md` §3 first and merge before #85 opens, OR (b) include the addendum edit inside #85's PR with an explicit "this PR also resolves T069c" call-out in the description. **Recommended: option (a)** — keeps #85's PR pure-code and lets the doc decision be reviewed independently. |

### Non-blockers worth flagging in the PR description

- §A2 Wave 4 (backend recognition of `shift.forced_close`) is irrelevant to #85; it gates S5.
- §A5 (production-readiness sign-off) is irrelevant to #85; it gates production rollout, not slice merges.

---

## 4. Proposed handler responsibilities

### 4.1 `operator.confirmTakeover`

**Trust gate.** This is the load-bearing design question for #85 (see §11 — risks). The renderer's invocation of `confirmTakeover` happens *between* a `signIn` call that returned `{ kind: 'takeover_required' }` and the creation of an authenticated `operator_sessions` row. There is no "current session" yet — `requireRole(...)` cannot run because there is no session to inspect. Two design alternatives are viable:

- **Alternative A — proto-session map (in-memory).** When a `signIn` call returns `takeover_required`, the handler stores a short-TTL "pending takeover" record keyed by a freshly-generated `pending_takeover_id`, holding `{ operator_id, role, tenant_id, branch_id, jwt-or-equivalent, scope_evidence }`. The renderer receives the `pending_takeover_id` *as part of* the `TakeoverRequiredResponse` (this means `bridge-api.ts` evolves slightly — see §7). `confirmTakeover({ pending_takeover_id })` looks the proto-session up, validates TTL, and proceeds.
- **Alternative B — re-run sign-in mechanics with `confirmTakeover: true`.** `confirmTakeover` accepts the same shape as `signIn` (identifier + password for manager/admin; `cashier_clerk_user_id` + plaintext PIN for cashier) and re-runs Clerk exchange / PIN verification *plus* calls Endpoint 4 instead of Endpoint 2. This re-uses every code path the sign-in handler already has, at the cost of asking the renderer to hold credentials across the prompt.

  - **Cashier flavour caveat.** The PIN crosses the bridge twice (once on initial `signIn`, once on `confirmTakeover`). PR-1 redaction must hold for both crossings. The `TakeoverPrompt` UI in #86 must NOT cache the PIN in renderer-visible state; it must re-prompt or hold it only in the dialog's local React state for the duration of the modal.
  - **Manager flavour caveat.** Same — the password is held in the renderer for the duration of the prompt.

**Recommendation: Alternative A (proto-session map).** Reasons: (i) PR-1 redaction posture is tighter — credentials cross the bridge once, exactly as today; (ii) the bridge handler can mint a single Clerk JWT on initial sign-in and re-use it on confirmTakeover; (iii) re-running PIN verification is a wasted Argon2id round trip and wastes 100+ ms.

  - **Open design question** (flag as such in #85's PR description): the spec-side document (plan.md / research.md) does not name the proto-session pattern explicitly. Confirm with reviewer that Alternative A is the intended direction, OR fall back to Alternative B if reviewer prefers credential re-submission.

**Steps for `operator.confirmTakeover` (assuming Alternative A is approved):**

1. **Validate input shape.** `req.pending_takeover_id` is a non-empty UUID v4 string. Bad shape → `OperatorRefusal { kind: 'refused', category: 'invalid_input' }`.
2. **Look up the proto-session.** If absent or expired (TTL ~ 60 s — long enough for the prompt, short enough that a stale prompt cannot resurrect it) → `OperatorRefusal { kind: 'refused', category: 'invalid_input' }`. **No factor-distinguishing variant** (PR-2).
3. **Generate `event_id`.** A fresh UUID v4 (P5 idempotency, AD-3). This becomes both the `BackendTakeoverConfirmRequest.event_id` and the eventual `audit_events.event_id`.
4. **Compute `device_token_attestation`.** Reuses the same source as sign-in (`SignInHandlerDeps.deviceTokenAttestation()`).
5. **Call `backend.confirmTakeover({ event_id, operator_id, device_token_attestation }, jwt)`.** The `jwt` is the one held in the proto-session record (manager/admin path) or omitted/empty for cashier path (Endpoint 4 expects manager/admin Clerk JWT — verify against `contracts/backend-endpoints.md` Endpoint 4 wording; cashier-path takeover is governed by AD-2, where no JWT is minted; flag in §11). The cashier-path takeover-confirm interaction with Endpoint 4 is one of the two open design questions.
6. **Outcome handling:**

   | Backend response          | Local action                                                                                                                                                                                                          | Bridge return                                |
   |:--------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------|
   | `{ kind: 'signed_in', operator, operator_session }` | (a) Create local `operator_sessions` row via `SessionManager.create({...})` using the *Clerk-backed* `operator.id` (AD-2 / AD-3 — never the PIN record). (b) Emit `operator.session.takeover` audit event via `AuditEmitter.emit({ event_id, action_category: 'operator.session.takeover', shift_id: null, payload: { superseded_session_id: ?, prior_terminal_reference: ? } })` — payload schema fields per `data-model.md` §"Action Category Catalogue". (c) Discard the proto-session entry. (d) Record JWT in `JwtHolder` (manager/admin path). | `SignInSuccessResponse { kind: 'signed_in', session }` |
   | `{ kind: 'refused' }`     | Discard the proto-session entry. No audit event.                                                                                                                                                                       | `OperatorRefusal { kind: 'refused', category: 'invalid_input' }` |
   | `{ kind: 'no_connection' }` | Keep the proto-session entry (renderer may retry). No audit event.                                                                                                                                                   | `OperatorRefusal { kind: 'refused', category: 'no_connection' }` |

7. **Audit payload composition.** Per FR-025 / FR-026, the `operator.session.takeover` event MUST carry the five mandatory attributes: `acting_operator_id` (the confirming operator's Clerk id, NOT the prior operator's), `shift_id` (null — takeover is not shift-bound), `originating_terminal_id` (THIS terminal — terminal B), `created_at` (ISO timestamp), `action_category` (the literal `'operator.session.takeover'`). Plus the structural addition per `data-model.md`: `superseded_session_id` (the prior `operator_sessions.id` if known to *this* terminal, otherwise the backend-supplied identifier from the success envelope if Endpoint 4's response carries it; otherwise null with a `prior_terminal_reference` instead). **Per FR-013, the audit record MAY reference terminal A internally, but the bridge response MUST NOT leak terminal A's identity to the renderer** — the audit row stays main-side.
8. **Logging.** A single `pino.info` line at category `operator.takeover.outcome` with one of the closed values: `confirmed | refused | no_connection`. Crucially, **no operator id, no terminal id, no JWT, no PIN material** in the log payload (PR-1 / FR-030 / FR-032). Identifiers may appear only as the existing opaque-reference shape used elsewhere in the operator handlers.
9. **T069c plumbing (post-decision).** If T069c chooses passive polling: nothing extra in this handler — terminal A discovers the takeover at its next `getCurrentSession` poll. If T069c chooses active push: this handler additionally publishes a notification through the chosen channel (a backend-side WebSocket per `tasks.md` T069c constraints, NOT a new IPC channel). The constraint that "MUST NOT introduce a new IPC channel beyond the `operator.*` namespace" survives — terminal A's listener reuses an existing channel (likely `operator:get-current-session` polling, or a server-sent-events subscription on the existing terminal-token authenticated path).

### 4.2 `operator.cancelTakeover`

This is the simplest possible operation:

1. **No `requireRole`.** No session exists yet; the role gate has nothing to test. The cancellation is a pure pre-session cleanup. Document the rationale in a code comment: *"Cancellation discards a proto-session — there is no authenticated state to gate against. The renderer carries the proto-session id back; main discards it. No backend call, no audit event (FR-013 — only confirmation produces an audit event)."*
2. **Look up and remove the proto-session record** keyed by `pending_takeover_id`. If it doesn't exist (already expired, never existed, double-cancel race) → return `{ kind: 'cancelled' }` anyway (idempotency by virtue of being a no-op).
3. **No backend call.**
4. **No audit event.** FR-013 explicitly says cancellation leaves prior session unaffected and creates no session on B; the spec lists `operator.session.takeover` as the takeover audit category — there is no `operator.session.takeover_cancelled` category and tasks.md T071 is explicit ("no audit event").
5. **Single `pino.info` log site** at category `operator.takeover.outcome` with value `cancelled` — no operator/terminal identifiers in the payload.
6. **Bridge return:** `CancelTakeoverResponse { kind: 'cancelled' }` (a fresh, simple type — not part of the existing `OperatorRefusal | SignIn*` family because cancellation is neither a refusal nor a sign-in).

---

## 5. BackendClient usage

The `BackendClient` interface in `src/main/operator/backend-client.ts` already exposes:

```ts
confirmTakeover(
  req: BackendTakeoverConfirmRequest,
  jwt: string,
): Promise<BackendTakeoverConfirmResponse>;
```

Where:

```ts
interface BackendTakeoverConfirmRequest {
  event_id: string;                  // client-generated UUID v4 (P5)
  operator_id: string;               // Clerk user id of the confirming operator
  device_token_attestation: string;  // terminal-side proof of device-token possession
}

type BackendTakeoverConfirmResponse =
  | BackendSignInSuccess           // kind: 'signed_in', operator, operator_session
  | { kind: 'refused' }
  | { kind: 'no_connection' };
```

**No changes to `backend-client.ts`** are required by #85. The `interpretTakeoverConfirmResponse` function (already present, lines 353–358) explicitly collapses any backend-returned `takeover_required` to `refused` — defence-in-depth against a backend bug, since a confirm endpoint must never return "takeover_required" in normal operation.

**JWT source for cashier path (open question — flag in §11).** Per AD-2, the cashier path does NOT mint a Clerk JWT; the device-token attestation is the *only* terminal-side proof. Endpoint 4 in `backend-endpoints.md` documents the request body but does not (in the snippet read) explicitly name whether `Authorization: Bearer …` is required. The current `BackendClient.confirmTakeover(req, jwt)` *does* pass a JWT in `Authorization`. Two reconciliations:

  1. Endpoint 4 *requires* the JWT — then cashier-path takeover-confirm is impossible under AD-2 and the cashier UX must be different (i.e., the cashier path collapses to "you cannot take over from terminal A; use terminal A directly" — an undesirable UX).
  2. Endpoint 4 accepts a missing `Authorization` for cashier-bound `operator_id` values, falling back to device-token attestation alone. This is the AD-2-consistent interpretation.

Confirm interpretation 2 with the backend (Endpoint 4 contract) before merging #85. If interpretation 1 holds, the proto-session map for the cashier path must hold a Clerk JWT — and that means cashier sign-in must mint one, which contradicts AD-2 ("the PIN does not mint backend identity tokens"). This is the single most important reviewer call-out in #85's PR description.

---

## 6. Audit / logging requirements

### 6.1 Audit event payload (composed by main; never crosses bridge from renderer)

Per `data-model.md` §"Action Category Catalogue" + FR-025 + FR-026 + FR-013, the `operator.session.takeover` event:

| Field                          | Source                                                                                                          | PR-1 status                       |
|:--------------------------------|:----------------------------------------------------------------------------------------------------------------|:----------------------------------|
| `event_id`                      | Generated client-side at the moment of confirm (P5 / AD-3).                                                     | Safe.                             |
| `tenant_id`                     | From `SessionManager.create()` input — derived from device-token scope.                                         | Safe (opaque).                    |
| `branch_id`                     | Same source.                                                                                                    | Safe (opaque).                    |
| `originating_terminal_id`       | THIS terminal (terminal B) — from PairingStore.                                                                 | Safe (opaque).                    |
| `acting_operator_id`            | The CONFIRMING operator's stable Clerk id, from the success envelope's `operator.id` (AD-2 / AD-3).             | Safe (opaque Clerk id).           |
| `session_id`                    | The new `operator_sessions.id` we just created.                                                                  | Safe.                             |
| `shift_id`                      | `null` (takeover is not shift-bound — FR-013 does not assign it to any shift).                                   | Safe.                             |
| `action_category`               | Literal `'operator.session.takeover'`.                                                                          | Safe.                             |
| `created_at`                    | ISO 8601 UTC, generated main-side.                                                                              | Safe.                             |
| `payload.superseded_session_id` | The prior `operator_sessions.id` IF known to this terminal (rare); otherwise the backend success envelope's reference if any; otherwise `null`. | Safe.                             |
| `payload.prior_terminal_reference` | An opaque reference to terminal A, set by the backend success envelope OR omitted. **Never leaked to renderer.** | Safe.                             |
| `approving_supervisor_id`       | `null` — takeover is not supervisor-approved.                                                                    | Safe.                             |

**Forbidden in payload (PR-1):** plaintext PIN; PIN hash bytes; Clerk JWT bytes; password; session token; raw cardholder data; full PII beyond opaque operator id.

### 6.2 Logging sites

Two `pino.info` log sites, both inside `takeover-handler.ts`:

- `operator.takeover.outcome` — emitted on every confirm path. Closed value set: `confirmed | refused | no_connection`.
- `operator.takeover.outcome` — emitted on cancel. Closed value set: `cancelled`.

(Same event name for both is acceptable; they share a parsing rule.)

**Redaction extensions.** The redaction list in `src/main/logger/redaction.ts` already covers `password`, `pin`, `jwt`, `pin_hash`, etc. (PR-1 + T034 + T081). A new entry is *not* required for takeover-specific fields, since `event_id`, `operator_id`, etc. are opaque references. **Sanity check in the PR**: run the cross-process redaction smoke test (T053) with the new log sites active and verify zero new occurrences of forbidden tokens. If a new field name (e.g. `pending_takeover_id`) is logged, it MUST be added to the redaction list — but the recommendation is to NOT log it at all (FR-032 — log only what is strictly required for support).

---

## 7. Request / Result / Refusal shapes

### 7.1 New types in `src/shared/bridge-api.ts`

The bridge-api skeleton currently lacks `confirmTakeover` and `cancelTakeover`. The S1 work intentionally left them out as future work (see existing comment lines 67–77 + 147–149). #85 adds them under explicit security-review-equivalent diligence.

**Proposed additions** (the exact field set is the load-bearing reviewer question — see §11):

```ts
// Discriminator-tagged proto-session id minted by the main process when
// signIn returns takeover_required. The renderer carries it back.
export interface TakeoverRequiredResponse {
  kind: 'takeover_required';
  pending_takeover_id: string;     // NEW — opaque uuid v4
  // (No prior-terminal label, no timestamp, no other-operator data per FR-013.)
}

export interface ConfirmTakeoverRequest {
  pending_takeover_id: string;     // matches the value carried in TakeoverRequiredResponse
}

export type ConfirmTakeoverResponse = SignInSuccessResponse | OperatorRefusal;

export interface CancelTakeoverRequest {
  pending_takeover_id: string;
}

export interface CancelTakeoverResponse {
  kind: 'cancelled';
}

// OperatorBridgeAPI gains:
//   confirmTakeover(req: ConfirmTakeoverRequest): Promise<ConfirmTakeoverResponse>;
//   cancelTakeover(req: CancelTakeoverRequest): Promise<CancelTakeoverResponse>;
```

**Note on adding `pending_takeover_id` to `TakeoverRequiredResponse`.** This *evolves* the type that S4's cashier sign-in handler (T069, PR #94) already returns. In `src/main/operator/sign-in-handler.ts` line 119 and line 316, both manager/admin and cashier paths return `{ kind: 'takeover_required' }`. To ship the proto-session pattern, both call sites need to:

  1. Mint a `pending_takeover_id`.
  2. Stash a proto-session record in the in-memory map.
  3. Include the id in the returned envelope.

This is a touch on already-merged code paths but is small (≤ 20 LOC) and the merge-target is the same handler module #85's reviewer is already auditing. It MUST be called out in the PR description as "this PR slightly evolves T069's `TakeoverRequiredResponse` shape to carry `pending_takeover_id`."

  **Alternative if reviewer pushes back:** Use Alternative B (credential re-submission) instead, which does NOT touch `TakeoverRequiredResponse` — but adds a credential round-trip per §4.1.

### 7.2 New IPC channel constants in `src/shared/operator/channels.ts`

```ts
export const OPERATOR_IPC_CHANNELS = {
  // ... existing constants ...
  /** T070 — confirm a takeover proto-session and create the operator session. */
  TAKEOVER_CONFIRM: 'operator:takeover-confirm',
  /** T071 — discard a takeover proto-session without creating any session. */
  TAKEOVER_CANCEL: 'operator:takeover-cancel',
} as const;
```

### 7.3 Preload exposure

Two new lines under `src/preload/operator.ts` (or wherever the operator namespace is wired) — symmetric to the existing `signIn` / `signOut` exposures, using `ipcRenderer.invoke(...)` against the new channel constants.

### 7.4 Refusal behaviour

Every refusal of `confirmTakeover` is `OperatorRefusal` with one of:

  - `category: 'invalid_input'` — bad shape, missing/expired proto-session, backend `refused`.
  - `category: 'no_connection'` — transport failure to Endpoint 4.

NO `rate_limited` (PIN-specific carve-out, not applicable to takeover-confirm). NO `role_mismatch` (no role to check).

---

## 8. Test plan (planning only — no test code)

### 8.1 Unit tests in `tests/unit/main/operator/takeover-handler.test.ts`

Each row below is one test. The fixture mocks `BackendClient`, `SessionManager`, `AuditEmitter`, `JwtHolder`, `pino` logger, the proto-session map, and a clock for TTL.

| # | Assertion                                                                                                                                                                                                                                                       |
|:--|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | `confirmTakeover` with bad shape (`pending_takeover_id` missing or non-string) returns `OperatorRefusal { kind: 'refused', category: 'invalid_input' }`. No backend call. No audit emission. No log line that includes the bad payload.                          |
| 2 | `confirmTakeover` with unknown `pending_takeover_id` returns the same generic refusal. (Generic — no `category: 'not_found'` variant per PR-2.)                                                                                                                  |
| 3 | `confirmTakeover` with expired `pending_takeover_id` (TTL > 60 s elapsed on the mocked clock) returns the same generic refusal.                                                                                                                                  |
| 4 | Happy path: `confirmTakeover` with a valid proto-session calls `BackendClient.confirmTakeover` exactly once with the correct `event_id` (UUID v4), `operator_id` (matches proto-session), and `device_token_attestation`.                                       |
| 5 | Happy path: on backend `signed_in`, a new `operator_sessions` row is created via `SessionManager.create` with the *Clerk-backed* `operator_id`, NOT the PIN record id (AD-2 / AD-3).                                                                            |
| 6 | Happy path: an `operator.session.takeover` audit event is emitted via `AuditEmitter.emit` exactly once, with `event_id` matching the request, `acting_operator_id` = confirming operator's Clerk id, `shift_id = null`, `originating_terminal_id` = THIS terminal (terminal B), `action_category = 'operator.session.takeover'`. |
| 7 | Happy path: the `pending_takeover_id` is removed from the proto-session map after success (subsequent `confirmTakeover` with the same id returns generic refusal).                                                                                              |
| 8 | Happy path: the JWT (manager/admin) is recorded in `JwtHolder` keyed by the new backend session id.                                                                                                                                                              |
| 9 | Happy path: the bridge return is `SignInSuccessResponse { kind: 'signed_in', session }` with the session shape matching `OperatorSessionBridgeView` exactly — no extra fields.                                                                                  |
| 10 | Backend `refused`: bridge returns `OperatorRefusal { kind: 'refused', category: 'invalid_input' }`. Proto-session is removed. No audit event emitted. No `operator_sessions` row created.                                                                       |
| 11 | Backend `no_connection`: bridge returns `OperatorRefusal { kind: 'refused', category: 'no_connection' }`. Proto-session is RETAINED (renderer may retry). No audit event emitted.                                                                                |
| 12 | Idempotency: `confirmTakeover` called with the same `pending_takeover_id` twice in a network-blip scenario hits the backend twice with the *same* `event_id`; the second backend call is a no-op per Endpoint 4's P5 contract (test that the SECOND `BackendClient.confirmTakeover` call uses the same `event_id`). The local `audit_events` table accepts the first event and ignores the second (INSERT OR IGNORE — already P5-compliant in S3). |
| 13 | PR-1 redaction: the `pino` log payload for every outcome contains NO operator id (or only the existing opaque-reference form), NO terminal id, NO JWT bytes, NO `pending_takeover_id`, NO `event_id` (event_id is also redacted as a precaution since it derives from a proto-session lookup). Use a log capture and assert via the redaction smoke pattern. |
| 14 | `cancelTakeover` with valid `pending_takeover_id` returns `{ kind: 'cancelled' }`, removes the proto-session entry, makes ZERO backend calls, emits ZERO audit events, logs exactly one `pino.info` line at category `operator.takeover.outcome` value `cancelled`. |
| 15 | `cancelTakeover` with unknown id is idempotent — returns `{ kind: 'cancelled' }`, makes no calls.                                                                                                                                                                |
| 16 | `cancelTakeover` does NOT call `requireRole` (no session exists). Test by injecting a `requireRole` spy and asserting it's not invoked.                                                                                                                          |

### 8.2 Main-process integration test (recommended in #85's PR; ties T056/T057 acceptance to main-side state without renderer)

`tests/integration/main/operator/takeover.integration.test.ts` (new file) exercises:

- A real `AuditEmitter` against a temp SQLite database with the audit-event schema migrated; assert one row in `audit_events` with the right shape after a full `signIn → confirmTakeover` flow.
- The cross-process redaction smoke (T053) extension that includes the new log sites — verify zero PII / token / pin / jwt / event_id leaks.

### 8.3 Renderer integration tests (T056 / T057 / T058) — recommend deferring to #86's PR

These cannot be authored without `<TakeoverPrompt>`. Filing them as a paired follow-up (#86's PR) keeps #85's diff small.

### 8.4 Coverage gate

The PIN-verifier and bridge-API role-enforcement modules carry a ≥ 95 % coverage floor (plan.md Tech Stack table). The takeover handler is in the same trust-boundary class — propose ≥ 95 % coverage on `src/main/operator/takeover-handler.ts` as well; reasonable given the small surface area (~150 LOC).

---

## 9. Forbidden scope (restated explicitly to prevent drift)

#85's PR MUST NOT touch:

- **Renderer components** — no `<TakeoverPrompt>`, no `<PinPad>`, no `<RosterList>`, no edits to `sign-in.tsx` or `operator-route-guard.tsx`. (Owned by #86.)
- **Backend / Data-Pulse-2** — Endpoint 4 already merged. Zero changes.
- **Migrations** — `audit_events` and `operator_sessions` schemas are already adequate. No new tables, no column additions.
- **`package.json`** — no new dependencies. The proto-session map is a plain `Map<string, ProtoSession>` in handler-local state; no LRU library is needed.
- **Sales / cart / payments / tender / receipts / inventory / reports / KPIs / analytics** — barred by feature 004's "Hard Non-Implementation Boundaries".
- **Constitution / spec / plan files** — no edits to `spec.md`, `plan.md`, `constitution.md`.
- **`research.md`** — leave T069c's edit to its own dedicated PR per recommended path (a) in §3.
- **PIN-reset / PIN-unlock handlers** (T072 / T073) — separate issues.
- **Forced-close handler** (T089) — S5 / separate issue.
- **`AGENTS.md`** at the repo root — untouched (it is also in the untracked file list and outside #85's scope).
- **`..codex-docs-assets-beautification.patch`** — untouched (untracked file).

---

## 10. Recommended PR boundary

### Title

`feat(004): S4 takeover confirm + cancel handlers — T070 + T071`

### Description body (template the PR author should fill in)

- **Issue:** Closes #85.
- **Tasks:** T070 (`confirmTakeover`), T071 (`cancelTakeover`). T069c is **either** resolved by a prior tiny PR (preferred) **or** documented in this PR's description with the `research.md` §3 addendum edit included as a separate commit.
- **Out of scope:** TakeoverPrompt UI (#86), T056–T058 renderer integration tests (deferred to #86's PR), forced-close (S5), PIN-reset/unlock (T072/T073).
- **Open design questions resolved in this PR (or to be resolved in review):**
  1. Proto-session map vs credential re-submission (Alternative A vs B from §4.1).
  2. Cashier-path JWT requirement at Endpoint 4 (§5).
  3. T069c notification mechanism (passive vs active push) — must reference the `research.md` §3 addendum decision.
- **Minimum disclosure:** every refusal collapses to `invalid_input` or `no_connection`; the audit event references terminal A internally but the bridge return does not (FR-013 / FR-026 / NFR-003 / PR-2).
- **PR-1 redaction:** new log sites carry no operator id (opaque-ref-only), no JWT, no PIN, no `event_id`, no `pending_takeover_id`.

### Files touched (estimate)

| File                                              | Why                                                                                                  | LOC delta (rough) |
|:--------------------------------------------------|:-----------------------------------------------------------------------------------------------------|:------------------|
| `src/shared/bridge-api.ts`                        | Add `ConfirmTakeoverRequest`, `ConfirmTakeoverResponse`, `CancelTakeoverRequest`, `CancelTakeoverResponse`, two new methods on `OperatorBridgeAPI`. Evolve `TakeoverRequiredResponse` to carry `pending_takeover_id`. | +40              |
| `src/shared/operator/channels.ts`                 | Add `TAKEOVER_CONFIRM`, `TAKEOVER_CANCEL` channel constants.                                          | +5               |
| `src/main/operator/takeover-handler.ts` (NEW)     | Core handler module: confirmTakeover, cancelTakeover, proto-session map, log sites.                  | +200             |
| `src/main/operator/sign-in-handler.ts`            | Mint and stash proto-session id at both `takeover_required` returns (manager/admin and cashier paths). | +25              |
| `src/preload/operator.ts` (or equivalent)         | Expose two new IPC channels on the preload bridge.                                                   | +15              |
| `src/main/ipc/operator.ts` (or equivalent)        | Wire `ipcMain.handle` for the two new channels to the new handler.                                   | +20              |
| `tests/unit/main/operator/takeover-handler.test.ts` (NEW) | All 16 unit tests in §8.1.                                                                          | +280             |
| `tests/integration/main/operator/takeover.integration.test.ts` (NEW) | Audit-event end-to-end + redaction smoke extension.                                                  | +100             |
| `tests/unit/main/operator/check-active-session.test.ts` or `cross-process-redaction.test.ts` (extend) | Add new log sites to the redaction smoke fixture if needed.                                          | +10              |

**Total LOC budget:** ~700. Constitution P13 caps at ~600, so the test files may need to be split into two PRs if review becomes uncomfortable. Recommend keeping the integration test in a paired follow-up if the diff exceeds 600.

### Pre-merge gates (per `plan.md` §"Per-slice non-functional gates")

- `npm test` passes.
- `npm run codegen:verify` passes (no OpenAPI changes expected).
- `npm run typecheck` passes.
- `npm run lint` passes.
- Cross-process redaction smoke test passes with the new log sites active.
- T069c decision recorded (either pre-merged PR or this PR's commit).
- Reviewer signs off on Alternative A vs B for the proto-session pattern (§4.1) and on Endpoint 4 JWT requirement (§5).

### Dependency note (must merge order)

This PR must NOT merge until either:

1. T069c's `research.md` §3 addendum is merged (preferred), OR
2. T069c's addendum edit is included as a commit in this PR with explicit reviewer call-out.

This PR also evolves `TakeoverRequiredResponse` shape (adds `pending_takeover_id`). That change touches T069's already-merged code path; reviewers must be aware.

---

## 11. Risks / open design questions

| # | Risk / question                                                                                                                                                                                                                                                                                                | Severity   | Recommended resolution path                                                                                                                                                       |
|:--|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Proto-session lifecycle (Alternative A vs B).** No spec/plan doc names the proto-session pattern. Reviewer must approve Alternative A explicitly, or the PR falls back to Alternative B and reworks the renderer interaction.                                                                                | High       | Surface in PR description; include both alternatives in §4.1 of the PR's body; let reviewer choose.                                                                                |
| 2 | **T069c notification mechanism (passive polling vs active push).** Load-bearing per `tasks.md` T070 row. Must resolve before merge.                                                                                                                                                                            | High       | Land T069c first as a tiny PR editing `research.md` §3 (preferred), OR include the addendum edit in this PR with explicit call-out.                                                |
| 3 | **Cashier-path Endpoint 4 JWT requirement (§5).** AD-2 says cashier path mints no JWT; Endpoint 4's request signature in `BackendClient.confirmTakeover(req, jwt)` accepts a JWT. Either Endpoint 4 accepts a missing/empty JWT for cashier `operator_id` (AD-2-consistent) or AD-2 has a hole.                | High       | Confirm with backend doc; if Endpoint 4 *requires* JWT for all paths, escalate to plan/spec authors and either rework AD-2 or restrict takeover to manager/admin path only.        |
| 4 | **Concurrency: two operators racing to take over the same prior session.** Operator X is signed in on terminal A; on terminals B and C they sign in simultaneously; both terminals call Endpoint 4 with different `event_id`s; backend persists exactly one `operator_sessions` change but both get back `signed_in`. | Medium     | Endpoint 4's contract is "the prior operator_session is marked terminated" — idempotent. Backend serialises. Test scenario covered indirectly by unit test #12 (idempotent re-call). Document explicitly in test case comment. |
| 5 | **Idempotency: same `event_id` re-submitted.** Endpoint 4 contract: same `event_id` is a no-op. Local `audit_events` table P5 dedupe via `INSERT OR IGNORE`. Both already in place; just need a test (unit test #12).                                                                                          | Low        | Test only.                                                                                                                                                                          |
| 6 | **Audit event separation from `shift.forced_close`.** Per FR-013 and the takeover-strands-shift edge case, `operator.session.takeover` and `shift.forced_close` MUST be separate audit records with separate timestamps and independent originating-terminal references. T086 (S5) covers this; #85 must NOT inadvertently entangle them. | Medium     | Confirm in unit test #6 that the takeover audit event has `shift_id: null` and no forced-close-related payload fields.                                                              |
| 7 | **Proto-session TTL choice.** 60 s is a guess. Too short = the renderer's React-state-reset can lose the prompt; too long = a forgotten-prompt window where stale takeover state lingers. Default to 60 s; document the rationale in the handler.                                                                | Low        | Constant in code with comment.                                                                                                                                                      |
| 8 | **`TakeoverRequiredResponse` shape evolution.** Adding `pending_takeover_id` touches code that PR #94 just landed. The integration test fixtures from PR #94 may snapshot the response shape; updating them is part of this PR.                                                                               | Low        | Run the test suite; update any snapshots.                                                                                                                                           |
| 9 | **`requireRole` not callable in cancelTakeover** (no session). Code reviewers may flag this as a missing trust gate. Document the rationale in a comment block above the handler.                                                                                                                              | Low        | Code comment per §4.2 step 1.                                                                                                                                                       |
| 10 | **PR LOC budget.** Estimated at ~700 LOC; Constitution P13 prefers ~600. If review is tight, split out the integration test into a paired follow-up PR.                                                                                                                                                       | Low        | Be ready to split.                                                                                                                                                                  |

---

**End of plan.** This document does not authorise any source-code, test, migration, or package change. The PR that closes #85 will reference this file in its description and either resolve every "open design question" in §11 inline or escalate them to the reviewer in a checklist. T069c's resolution remains the single hard prerequisite that must clear before #85's PR may merge.
