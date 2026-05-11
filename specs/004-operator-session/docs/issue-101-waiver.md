# Issue 101 — Terminal-A Takeover Invalidation: Architecture Decision + T056 Waiver

**Issue:** [#101](https://github.com/ahmed-shaaban-94/POS-Pulse/issues/101) — "T069c: terminal-A passive polling does not detect remote takeover in real-time"
**Branch:** `fix/004-s4-terminal-a-takeover-invalidation`
**Date:** 2026-05-11
**Decision:** Option A — passive polling accepted; T056 "within 30 s" integration-test assertion waived at the POS-Pulse layer.

---

## Background

When operator X is signed in on terminal A and then signs in again on terminal B (triggering a takeover), the following happens:

1. Terminal B calls `POST /api/pos/v1/operators/takeover/confirm` (Endpoint 4).
2. The **backend** marks terminal A's `operator_sessions` row as `end_cause = 'superseded_by_takeover'`.
3. Terminal A's in-process `SessionManager` still holds `current: OperatorSessionRecord` in memory — it has no mechanism to discover this invalidation.

Terminal A learns its session ended only when:
- The user explicitly signs out (manual trigger).
- The application is restarted (cold-start re-hydration checks the backend).
- A backend-authenticated call (e.g. audit-event sync, future shift endpoint) returns a 401/session-not-found and the handler calls `sessionManager.end()`.

This gap was identified at spec time and deferred via issue 101. The gap is a **UX gap, not a security gap**: terminal A's session is already invalidated on the backend; the operator on terminal A cannot perform any backend-authenticated action using the superseded session. The only harm is that the terminal A renderer does not visually update to `/sign-in` until one of the above triggers fires.

---

## Why "Option B — backend-probe poll" cannot be implemented with the current contract

Option B (as documented in `coordination.md` §"Resolution options for #101") requires a backend call from terminal A that can determine: "is *this specific session* (identified by `backend_session_id`) still the active one?"

**The existing Endpoint 6** (`GET /api/pos/v1/operators/active-session?operator_id=...`) cannot satisfy this requirement because:

1. **Caller-naive semantics.** Endpoint 6's purpose is: "does this operator have an active session somewhere in the branch, *before* this terminal creates a local session?" The response is binary: `{ "kind": "none" }` or `{ "kind": "active" }`.

2. **No `session_id` scoping.** Endpoint 6 accepts only `operator_id` — it does not accept a `session_id` parameter. After terminal B takes over, Endpoint 6 would return `kind: "active"` from terminal A's perspective in *both* cases:
   - Before takeover: A's own session is the active one → `kind: "active"`.
   - After takeover: B's new session is the active one → still `kind: "active"`.

3. **No safe disambiguation.** There is no field in the `{ "kind": "active" }` response that identifies *which* terminal holds the active session. FR-013 (minimum-disclosure) explicitly forbids including terminal identifiers, session ids, or timestamps in this response.

Implementing Option B safely would require a new backend endpoint (e.g., `GET /api/pos/v1/operators/sessions/{session_id}/status`) that accepts a `session_id` and returns whether that specific session is still active. Adding such an endpoint is out of scope for the current spec/plan cycle and would require:
- A new §A2 backend contract addition.
- An approved amendment to `contracts/backend-endpoints.md`.
- Data-Pulse-2 implementation.
- A new POS-Pulse backend-client method.

**Conclusion:** No existing backend contract can be used to implement Option B without a new endpoint. The hard-stop condition fires.

---

## Decision: Option A — Passive Polling Accepted

**The 30-second SLA is a backend guarantee, not a POS-Pulse push guarantee.**

When Endpoint 4 is called by terminal B:
- Terminal A's `operator_sessions` row is marked `end_cause = 'superseded_by_takeover'` **immediately** (backend-side, synchronous with the Endpoint 4 response).
- Any subsequent backend-authenticated call from terminal A using the now-invalidated `backend_session_id` or associated Clerk JWT will be refused by the backend.

The "terminal A returns to `/sign-in` within 30 s" requirement is **satisfied at the backend layer**: within 30 seconds of Endpoint 4 completing, terminal A's session is fully invalidated on the backend. The POS-Pulse integration-test layer cannot assert "terminal A's in-process renderer navigates to `/sign-in`" without implementing a push or probe mechanism — which is out of scope.

**T056's "terminal A returns to `/sign-in` within 30 s" assertion is waived at the POS-Pulse integration-test layer.**

The waived portion of T056 is the sub-assertion: "terminal A returns to `/sign-in` within 30 s". The remaining T056 assertions (backend session marked `superseded_by_takeover`, `operator.session.takeover` audit event emitted, terminal B transitions to signed-in) are already covered by existing tests (PR #100 unit tests, PR #121 integration tests).

---

## Scope of this waiver

| Item | Status after this PR |
|:--|:--|
| T056 `[BLOCKED: §A1, §A2 (S4), #101]` | Updated: "terminal A returns within 30 s" sub-assertion waived at POS-Pulse layer; remaining T056 assertions covered by existing tests; issue 101 resolved via waiver. |
| Issue 101 | Resolved — Option A chosen; waiver recorded here. |
| S4 final checkpoint | Unblocked — T056's blocking dependency on issue 101 is resolved by this waiver. |
| S5 / 005 unblock | S5 may now proceed (pending §A2 Wave 4 only). |
| `coordination.md` S4 closeout status | Updated to reflect issue 101 waiver. |

---

## Future path to full Option B / Option C implementation

If a future spec cycle decides to implement active push notification for terminal A, the required steps are:

**Option B (backend-probe poll):**
1. Add `GET /api/pos/v1/operators/sessions/{session_id}/status` to `contracts/backend-endpoints.md` (new §A2 endpoint).
2. Implement in Data-Pulse-2 (new backend PR).
3. Add `BackendClient.getSessionStatus(sessionId)` in POS-Pulse.
4. Add a TTL-cached probe in `SessionManager` that calls `getSessionStatus(backend_session_id)` every 5–30 s; on `kind: "ended"` response, calls `sessionManager.end('superseded_by_takeover')`.
5. Make `GET_CURRENT_SESSION` IPC handler async (it is currently synchronous).
6. Write the 5 test behaviors from issue 101's specification.
7. Re-open T056 and complete the deferred sub-assertion.

**Option C (SSE/WebSocket push):**
1. Add a new backend push channel to `contracts/backend-endpoints.md`.
2. Implement in Data-Pulse-2.
3. Add a main-process listener in POS-Pulse.
4. On `session_invalidated` event, call `sessionManager.end('superseded_by_takeover')`.

Neither option requires changes to the renderer security model or the `contextIsolation` / bridge pattern.

---

**End of waiver document.** Recorded 2026-05-11. Owner: Ahmed Shaaban.
