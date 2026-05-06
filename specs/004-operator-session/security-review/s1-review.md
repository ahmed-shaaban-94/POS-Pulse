# S1 Bridge-Surface Security Review

**Reviewer:** Claude Opus 4.7 (1M context) via automated S2 gate  
**Reviewed commit:** `d9f4e21` — feat(004): S1 operator sign-in — manager/admin Clerk path (#46)  
**Review date:** 2026-05-06  
**Tasks:** T035 (line-by-line review), T037 (requireRole first-instruction check), T038 (verdict)  
**result:** `approved-with-revisions`

---

## Scope

This review covers the bridge-surface security of Slice S1 of feature 004-operator-session. The
review gate is: **no S3 slice may begin until this document records `result: approved` or
`result: approved-with-revisions`.**

Files reviewed (the S1 diff, `d9f4e21^..d9f4e21`):

| File | Role |
|:--|:--|
| `src/preload/index.ts` | Bridge wire-up — operator namespace |
| `src/shared/bridge-api.ts` | Canonical type contract |
| `src/shared/operator/channels.ts` | IPC channel name constants |
| `src/main/ipc/operator.ts` | IPC handler registration + boundary validation |
| `src/main/operator/role-enforcement.ts` | `requireRole()` — primary trust gate (AD-1) |
| `src/main/operator/sign-in-handler.ts` | Manager/admin sign-in orchestration |
| `src/main/operator/sign-out-handler.ts` | Sign-out with 1 s NFR-007 budget |
| `src/main/operator/session-manager.ts` | In-memory session record |
| `src/main/operator/clerk-client.ts` | Clerk Frontend API exchanger |
| `src/main/operator/backend-client.ts` | Data-Pulse-2 Wave 1 client |
| `src/main/operator/jwt-holder.ts` | Main-process JWT map |
| `src/main/logging/logger.ts` | Pino redaction extensions (T034) |
| `src/main/index.ts` | Production bootstrap wiring |

---

## P8 — Electron Security Boundary

**Reference:** Constitution §P8; spec.md:NFR-001.

| Check | Location | Status |
|:--|:--|:--|
| `contextIsolation: true` | `src/main/index.ts:103` | ✓ PASS |
| `nodeIntegration: false` | `src/main/index.ts:104` | ✓ PASS |
| `sandbox: true` | `src/main/index.ts:105` | ✓ PASS |
| `webSecurity: true` | `src/main/index.ts:106` | ✓ PASS |
| No upward-of-bridge IPC | `src/preload/index.ts` — only `ipcRenderer.invoke` | ✓ PASS |
| Navigation allow-list | `src/main/index.ts:119–121` — `will-navigate` guard | ✓ PASS |
| Pop-out window denied | `src/main/index.ts:124` — `setWindowOpenHandler` | ✓ PASS |
| Two-layer CSP | `src/main/index.ts:128–151` — session + HTML meta | ✓ PASS |

No regressions to the P8 baseline established by features 001–003.

---

## AD-1 — T037: `requireRole()` First-Executable-Instruction Check

**Reference:** plan.md §AD-1; `src/main/operator/role-enforcement.ts`.

The `requireRole(allowed, session)` function is correctly defined: it throws
`OperatorRefusalError('not_signed_in')` when `session` is `null`/`undefined`, and
`OperatorRefusalError('role_mismatch')` when `session.role` is not in `allowed`. The thrown
error carries only the category — no role value, no operator id, no identifying detail.

**S1 IPC handlers and role-gate applicability:**

| Handler | Channel | Role-gate required? | Disposition |
|:--|:--|:--|:--|
| SIGN_IN | `operator:sign-in` | No — creates a session (unauthenticated entrypoint by definition) | N/A |
| SIGN_OUT | `operator:sign-out` | No — idempotent teardown; returns `signed_out` whether or not a session exists | N/A |
| GET_CURRENT_SESSION | `operator:get-current-session` | No — read-only inquiry; naturally returns `null` when no session exists | N/A |
| REPORT_ACTIVITY | `operator:report-activity` | No — notify-only; main-process internal trigger with no privileged side-effect | N/A |

**Verdict:** No S1 handler is a role-gated operation. All four handlers are session
lifecycle / infrastructure operations that are valid regardless of role. The `requireRole()`
function exists, is correct, and is the AD-1 gate ready for S3+ handlers (roster, audit events,
active-session takeover, etc.). There is no handler in S1 that should have `requireRole()` as
its first executable instruction but does not.

T037 **PASS** — the requireRole contract is established and will be enforced from first use in S3.

---

## PR-1 — Credential & JWT Redaction

**Reference:** spec.md FR-030, NFR-003; plan.md §PR-1.

### Password lifecycle

1. `src/preload/index.ts:57` — `signIn(req)` → `ipcRenderer.invoke(SIGN_IN, req)` — single
   bridge hop; the cleartext password travels from renderer → main exactly once per sign-in
   attempt. ✓
2. `src/main/ipc/operator.ts:39–49` — `asManagerAdminRequest()` validates `typeof password ===
   'string'` but never logs, echoes, or stores the value. ✓
3. `src/main/operator/sign-in-handler.ts:78–81` — password consumed by `clerk.exchange({
   identifier, password })` and discarded from the call frame. ✓
4. `src/main/operator/clerk-client.ts:143–145` — password set via `URLSearchParams.set(...)`;
   `JSON.stringify` is never called on the request body, so the value cannot surface through
   `error.cause` on a serialisation path. ✓
5. `src/main/operator/clerk-client.ts:155–159` — transport failure swallows the thrown error
   entirely; the URL + body cannot leak via the catch branch. ✓
6. `src/main/operator/sign-in-handler.ts:153–159` — `logRefusal` logs only `{ event, category,
   stage }` — no `identifier`, no `password`. ✓
7. `src/main/operator/sign-in-handler.ts:161–163` — `logSuccess` logs only `{ event, kind }`. ✓
8. `src/main/operator/session-manager.ts:66–80` — `OperatorSessionRecord` has no `password`,
   `identifier`, or `jwt` field. ✓

### JWT lifecycle

1. `src/main/operator/clerk-client.ts:220–225` — JWT returned as `exchange.jwt` in the success
   path only. ✓
2. `src/main/operator/sign-in-handler.ts:96–100` — JWT passed as a function argument to
   `backend.signIn(req, jwt)`. Never stored in the session record. ✓
3. `src/main/operator/backend-client.ts:128–131` — JWT used as `Authorization: Bearer ${jwt}` in
   request headers. Never logged. Never JSON-serialised into the body. ✓
4. `src/main/operator/sign-in-handler.ts:136` — `jwtHolder.set(backend_session_id, jwt)` stores
   JWT in a main-process closure-bound Map keyed by session id. ✓
5. `src/main/operator/jwt-holder.ts:27–37` — Map is a closure; no public enumeration surface. ✓
6. `src/main/operator/sign-out-handler.ts:52–53` — `clearJwt(backendSessionId)` called
   immediately after local session teardown, before the fire-and-forget backend POST. ✓
7. `src/main/operator/session-manager.ts:53–63` — `getCurrentBridgeView()` returns a projection
   that strips `backend_session_id` and `last_activity_at`. JWT is never in the record at all. ✓
8. `src/shared/bridge-api.ts:46–61` — `OperatorSessionBridgeView` has no JWT, token, or session
   id field. ✓
9. Static guard `src/renderer/__tests__/no-jwt-in-renderer-or-preload.test.ts` — asserts zero
   occurrences of `jwt`, `Bearer`, `clerk_jwt`, `clerk_session_token`, `Authorization` in all
   `.ts`/`.tsx` source files under `src/renderer/` and `src/preload/`. Passes in CI (1032/1032). ✓

### Pino redaction list (T034)

`src/main/logging/logger.ts:104–115` — `OPERATOR_REDACTED_KEYS` adds:
`password`, `identifier`, `pin`, `jwt`, `clerk_jwt`, `clerk_session_token`, `session_token`,
`authorization`, `pin_hash`, `pin_salt` — at three wildcard depths (`key`, `*.key`, `*.*.key`,
`*.*.*.key`). These are combined with the pre-existing pairing keys and applied to both the main
and renderer logger instances. ✓

Cross-process redaction smoke (T025 → T036): see `s1-redaction-evidence.md`.

PR-1 **PASS**.

---

## PR-2 — Generic Refusal (No Factor Distinguishing)

**Reference:** spec.md NFR-003; plan.md §PR-2.

| Failure mode | Bridge response | Log stage (main-process only) |
|:--|:--|:--|
| Invalid request shape | `{ kind: 'refused', category: 'invalid_input' }` | N/A (pre-handler) |
| Clerk 4xx / 5xx | `{ kind: 'refused', category: 'invalid_input' }` | `stage: 'clerk'` |
| Clerk transport failure | `{ kind: 'refused', category: 'no_connection' }` | `stage: 'clerk'` |
| Backend 4xx / 5xx | `{ kind: 'refused', category: 'invalid_input' }` | `stage: 'backend'` |
| Backend transport failure | `{ kind: 'refused', category: 'no_connection' }` | `stage: 'backend'` |
| Cashier role (S1 defence-in-depth) | `{ kind: 'refused', category: 'invalid_input' }` | `stage: 'role'` |
| Unexpected throw in IPC handler | `{ kind: 'refused', category: 'invalid_input' }` | N/A |

The `stage` field is a main-process diagnostic only — it never crosses the bridge. The renderer
receives the two-category surface (`invalid_input` / `no_connection`) regardless of which
internal stage triggered the refusal. ✓

PR-2 **PASS**.

---

## NFR-007 — 1 s Sign-Out Budget

**Reference:** spec.md NFR-007, FR-008.

`src/main/operator/sign-out-handler.ts:39–60`:
1. `sessionManager.end()` (synchronous) — local state torn down. ✓
2. `clearJwt(backendSessionId)` (synchronous) — JWT removed from holder. ✓
3. `signOut()` returns `{ kind: 'signed_out' }` — bridge responds before the backend POST begins. ✓
4. Backend POST is fire-and-forget via `void this.fireBackendSignOut(...)`. ✓
5. `Promise.race([backend.signOut(...), timeout(750 ms)])` — backend call is capped at 750 ms,
   well within the 1 s NFR-007 budget. ✓

NFR-007 **PASS**.

---

## Findings

### F-01 — LOW: `_reportActivity` preload exposure missing (stale comment + incomplete T028b wiring)

**File:** `src/preload/index.ts:49–52`

The preload comment documents `_reportActivity` as exposed via the `operator` namespace:
> "The internal `_reportActivity` notify-only call is exposed via the same namespace so the renderer
> can report genuine user input to the inactivity monitor (T028b)."

However:
- The `operator` bridge object (lines 55–63) does not include `_reportActivity`.
- `OperatorBridgeAPI` in `src/shared/bridge-api.ts` has no such method.
- The `REPORT_ACTIVITY` IPC channel IS registered in `src/main/ipc/operator.ts:86` but has no
  preload counterpart.

**Security implication:** None. The orphaned IPC channel cannot be invoked by any renderer code
(no bridge surface). There is no attack surface created.

**Functional implication:** The `InactivityMonitor` receives no activity signals from the renderer.
It runs its tick timer but never has `reportActivity()` called from genuine user input. This
means the monitor may trigger premature session expiry when the user is actively interacting with
the POS surface. In S1 (which only scaffolds the inactivity monitor — T028b), session expiry is
not yet wired to a visible action, so the gap is not user-visible today.

**Disposition:** Fix before S3 (where session expiry becomes load-bearing). Two parts:
1. Add `_reportActivity(): void` to `OperatorBridgeAPI` in `bridge-api.ts`.
2. Wire it in `src/preload/index.ts`.
3. Update the `src/shared/operator/channels.ts` exports if needed.
4. Remove or correct the stale comment.

S3 may begin; F-01 should be addressed in the first S3 task or as a targeted fix PR.

---

## Summary

| Principal | Status | Notes |
|:--|:--|:--|
| P8 — Electron Security Boundary | ✓ PASS | All WebPreferences correct; navigation + window policies correct; two-layer CSP intact |
| AD-1 — requireRole first-instruction | ✓ PASS | No S1 handler is role-gated; requireRole() correct and ready for S3+ |
| PR-1 — Credential / JWT redaction | ✓ PASS | Password / JWT lifecycle verified line-by-line; smoke evidence in s1-redaction-evidence.md |
| PR-2 — Generic refusal | ✓ PASS | All factor-distinguishable causes collapse to two bridge categories |
| NFR-007 — 1 s sign-out budget | ✓ PASS | Local teardown synchronous; backend fire-and-forget ≤ 750 ms |
| F-01 (_reportActivity gap) | ⚠ LOW | Stale comment + missing bridge wiring; no security implication; fix before S3 |

**result: `approved-with-revisions`**

S3 may begin. F-01 must be resolved before S3's session-expiry paths become user-visible.
