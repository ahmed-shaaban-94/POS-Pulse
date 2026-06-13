---
description: "Task list for 016-operator-envelope-adoption (D5 + D7) — slice/story-organised, test-first per Constitution VI. UNBLOCKED: D1 shipped (DP-2 PR #559/202d253), G10 satisfied. POS consumer lane — no contract, no migration. Generated 2026-06-13."
---

# Tasks: 016-operator-envelope-adoption

**Feature:** 016-operator-envelope-adoption — POS Adopts the Operator Envelope; Device Token Reverts to Device-Scoped (D5 + D7)
**Plan:** [./plan.md](./plan.md) (v1.0, 2026-06-13)
**Spec:** [./spec.md](./spec.md) (surface map = §7)
**Constitution version pinned:** v1.5.1
**Created:** 2026-06-13
**Status:** Tasks generated; not yet started. UNBLOCKED — D1 shipped & closed (DP-2 PR #559 / `202d253`, spec 031); G10 SATISFIED-FOR-BOUNDARY-DECISIONS (028 PR #85 / `76cfcc3`). Dispatch still requires explicit scoped owner approval (spec header).

---

> **What this is.** The implementation-enablement pass for drift items **D5** (POS adopts the
> `pos_operator` envelope) and **D7** (device token reverts to device-scoped). 016 is a **strict
> superset of the already-shipped 011-S5 wiring** — it re-credentials the *same* sale-sync wiring
> sites from Clerk JWT → envelope. **No rework** of 011's drain / retry / dead-letter logic.
>
> **POS consumer lane (P16).** 016 authors **NO contract and NO migration**. The DP-2 #559 contract
> is *consumed*, not authored. All edits are under `src/main/**` — **no bridge / preload /
> `bridge-api.ts` change** (P8).
>
> **Test-first (Constitution VI, NON-NEGOTIABLE).** Every implementation (GREEN) task is preceded by
> its failing (RED) test task. RED → GREEN → IMPROVE.
>
> **Tag legend:**
> - **`[P]`** = parallelizable (different file, no incomplete-task dependency).
> - **`[USn]`** maps the task to a user story / slice. Setup, Foundational, Polish have no story label.
> - **`[GATE:§A4]`** = blocked on the named security re-check / sign-off.
> - **`[VERIFY]`** = verification / decision-gate task (non-code or read-and-confirm).
> - **`[CRITICAL]`** = a P2 fake-success trap — adding the type is NOT enough; the credential the
>   holder *actually contains* must be asserted (C-1 / C-2).
>
> **Invariants threaded through every task:** the envelope is an **opaque bearer string** (no
> parsing, no claim-reading — G7 provider-neutrality); it is read **in-process** only, **never
> bridged, never logged, never in the body** (P7/P8); the device token reverts to device-scope and a
> sale-sync POST authorized by the device token **alone** is **impossible/refused** (Principle VIII /
> 028 §18 / CM-2). Money path is **untouched** (Principle II N/A — no floats introduced).

---

## Phase 1 — Setup & Contract Confirmation

> No project scaffolding (016 reuses 011-S5's shipped wiring). The "setup" here is binding the
> shipped #559 facts so no later task drifts from the contract.

- [ ] T001 [VERIFY] Confirm the shipped #559 contract facts against DP-2 `sales.yaml` (spec 031): (a) sign-in **and** takeover RETURN a nullable opaque `envelope` on `PosOperatorSessionSummary` (hash-once, `null` on replay); (b) the three sale routes (`captureSale`/`recordVoid`/`recordRefund`) use the new `operatorAuthorization` scheme = `type: http, scheme: bearer`, **no `bearerFormat`**, presented as `Authorization: Bearer <envelope>`; (c) `X-Device-Attestation` is **RETIRED** from the sale routes; (d) `Idempotency-Key` is still **REQUIRED**. Record any drift in plan.md before coding. (Resolves OQ-D7-WIRE = **drop the header**.)
- [ ] T002 [VERIFY] Confirm 016 needs **no `api-types.ts` regeneration** (R5): the operator + sale-sync clients use hand-mirrored local types per the 004 owner decision recorded in `backend-client.ts`. Do NOT run `codegen:api` for 016 — the envelope field is added to the local mirrored types.

## Phase 2 — Foundational (Type Boundary)

> The net-new envelope field on the response type is shared by both credential-storage paths
> (sign-in **and** takeover), so it lands first. Verified: `BackendTakeoverConfirmResponse` is a
> union that **reuses `BackendSignInSuccess`** (`backend-client.ts` L104–107) — so a **single** type
> edit on `BackendSignInSuccess` covers BOTH the sign-in and the takeover-confirm success envelopes.

- [ ] T010 [US-D5] GREEN: extend `BackendSignInSuccess` (`backend-client.ts` L45–52) with `pos_operator_envelope?: string | null` matching #559's nullable envelope on `PosOperatorSessionSummary`. This single edit also covers `BackendTakeoverConfirmResponse` (L104–107, a union over `BackendSignInSuccess`). *Type only — compiles, no runtime behaviour yet; the interpreter (T020/T021) is what makes it non-`undefined` at runtime.* — `src/main/operator/backend-client.ts`

## Phase 3 — US-D5: POS adopts the operator envelope (acquire → hold → present)

**Goal:** the envelope returned by sign-in/takeover is held in the existing `jwt-holder` seam and
presented as `Authorization: Bearer <envelope>` on the sale-sync POST.
**Independent test:** with the backend mocked to return a `pos_operator_envelope`, the holder
contains the **envelope** (not the Clerk/proto JWT, not `''`) after sign-in AND after takeover, and
the sale-sync client presents it as the Bearer credential.

### C-1 — interpreter must preserve the envelope (P2 fake-success trap)

> `interpretSignInResponse` (L350–387) hand-builds the return object with an **allowlist** (only
> `operator` + `operator_session` copied) — it **silently drops unknown fields**. Adding the field to
> the *type* is NOT enough; the interpreter must explicitly read `v['pos_operator_envelope']`,
> validate `string | null | absent`, and include it — else `backend.pos_operator_envelope` is
> **always `undefined`** at runtime and the swap silently no-ops with a GREEN suite.
> `interpretTakeoverConfirmResponse` (L406–411) **delegates** to `interpretSignInResponse`, so this
> one fix covers both paths.

- [ ] T020 [CRITICAL] RED [US-D5] interpreter-preservation test — feed raw JSON with `pos_operator_envelope` (a string) → interpreted `BackendSignInSuccess` carries it verbatim; feed `null` → carried as `null`; feed **absent** → field is `undefined`/`null` (not a throw); feed a non-string/non-null value → `{ kind: 'refused' }` (consistent with the existing allowlist posture). Add a parallel assertion that `interpretTakeoverConfirmResponse` inherits the same preservation. — `src/main/operator/__tests__/backend-client.test.ts`
- [ ] T021 [CRITICAL] GREEN [US-D5] make `interpretSignInResponse` (L350–387) read `v['pos_operator_envelope']`, validate it is `string | null | absent` (reject other types → `refused`), and include it in the returned `signed_in` object. `interpretTakeoverConfirmResponse` (L406–411) inherits the fix by delegation — verify, do not duplicate. — `src/main/operator/backend-client.ts`

### C-1b — sign-in stores the envelope

- [ ] T022 RED [US-D5] sign-in-handler holder test — mirror the existing pattern at L113–133 (`records the … JWT in the JwtHolder …`): mock `backend.signIn` to return a `pos_operator_envelope`; assert `jwtHolder.get('be-sess-1')` is the **envelope**, NOT `HAPPY_JWT`. The provider JWT's job ends at sign-in. — `src/main/operator/__tests__/sign-in-handler.test.ts`
- [ ] T023 GREEN [US-D5] change `sign-in-handler.ts` L167 from `jwtHolder?.set(record.backend_session_id, exchange.jwt)` to store the **envelope** from the backend success (`backend.pos_operator_envelope`). Keep the `?.` optional-holder posture. — `src/main/operator/sign-in-handler.ts`

### C-2 — takeover stores the envelope (second credential-storage path, P2 fake-success trap)

> `confirmManagerAdminTakeover` (`takeover-handler.ts` L197) stores
> `jwtHolder.set(record.backend_session_id, proto.jwt ?? '')` — after a manager/admin **takeover**
> the holder gets the JWT/empty-string, **NOT the envelope**, breaking G-1/G-2 for the entire
> takeover flow (028 §9: takeover installs the new operator's authority). `ProtoSession.jwt` (L42)
> is the provider JWT for the confirm **call** only; it is NOT what gets held post-takeover.

- [ ] T024 [CRITICAL] RED [US-D5] post-takeover holder test — drive `confirmManagerAdminTakeover` with a backend result carrying a `pos_operator_envelope`; assert `jwtHolder.get(record.backend_session_id) === <envelope>` (NOT `proto.jwt`, NOT `''`). — `src/main/operator/__tests__/takeover-handler.test.ts`
- [ ] T025 [CRITICAL] GREEN [US-D5] change `takeover-handler.ts` L197 from `jwtHolder.set(record.backend_session_id, proto.jwt ?? '')` to store `backendResult.pos_operator_envelope`. (`backendResult` is the `BackendSignInSuccess`-shaped takeover-confirm success; the C-1 interpreter fix already preserved the field.) Leave `ProtoSession.jwt` (L42) as the provider JWT for the confirm call only. — `src/main/operator/takeover-handler.ts`

### jwt-holder seam — reused, no code change

- [ ] T026 [VERIFY] Confirm `jwt-holder.ts` needs **no code change** — it is a reused seam now holding the envelope. The legacy param name `'jwt'` is acceptable (main-process only, never bridged/logged). No edit unless a test forces one. — `src/main/operator/jwt-holder.ts`

### Client presents the envelope (verify the read path delegates)

- [ ] T027 RED [US-D5] client request-shape test (Bearer = envelope) — flip the `TOKEN` constant semantics so it represents the **envelope** (a value the holder now delivers); assert `headerValue(req.init, 'Authorization')` === `Bearer ${TOKEN}`. (Same `Authorization` line at `create-sale-sync-client.ts` L259 — the credential swap is upstream in the holder/interpreter; the client's Bearer line is generic and likely needs no change.) — `src/main/sales-sync/__tests__/create-sale-sync-client.test.ts`
- [ ] T028 [VERIFY] GREEN [US-D5] confirm the `index.ts` `getOperatorToken` closures (L1266–1269 sale-sync-client + L1279–1282 engine) now return the **envelope** by delegation through `operatorJwtHolder.get(sess.backend_session_id)` — the holder content changed, the read path did not. **Likely no edit** — verify, edit only if a test forces it. — `src/main/index.ts`

### M-1 — envelope-present gate normalizes `''` to absent

> The engine pauses on `getOperatorToken() === null` (`sale-sync-engine.ts` L117 / L121); the client
> also refuses on `token.length === 0` (L228). The takeover fallback historically left `''` in the
> holder — the `=== null` gate would **pass** an empty string that the client then rejects as
> `no_connection`, a silent no-op drain. The gate MUST treat `''` as **absent** (pause).

- [ ] T029 RED [US-D5] empty-envelope gate test — harness with `token: ''` (envelope empty) → drain **pauses**, no POST attempted (mirror the existing `T040` null-token case; harness token at `sale-sync-engine.test.ts` L62). — `src/main/sales-sync/__tests__/sale-sync-engine.test.ts`
- [ ] T030 GREEN [US-D5] make the engine envelope-present gate (`sale-sync-engine.ts` L117 / L121) treat `''` as absent — change `=== null` to a present-check that pauses on both `null` and `''`. — `src/main/sales-sync/sale-sync-engine.ts`

### R4 — auth-refusal comment correction (semantics unchanged)

- [ ] T031 GREEN [US-D5] update the `classifyStatus` comment (`create-sale-sync-client.ts` L207–211) so the `401/403 → transient` rationale references the **envelope** (re-acquired via re-sign-in for v1) rather than the ~60s Clerk JWT. **Classification is unchanged** (still `transient`, retryable, never dead-letter — E-4 / G-5); comment only. — `src/main/sales-sync/create-sale-sync-client.ts`

## Phase 4 — US-D7: Device token reverts to device-scoped (follows D5)

**Goal:** the sale-sync POST drops `X-Device-Attestation`; the device token retains only its proper
roles (read-down Bearer + sign-in `device_token_attestation` body).
**Independent test:** the client request carries `Authorization: Bearer <envelope>` and **no**
`X-Device-Attestation` header; a sale-sync POST authorized by the device token alone is impossible.

> **M-2 — breaking signature change, sequenced to keep typecheck meaningful.** `getDeviceAttestation`
> is a **required** (non-optional) field on `CreateSaleSyncClientDeps` (`create-sale-sync-client.ts`
> L120–127). Removing it is a type-breaking change at **all** call sites: the source plus the 3 test
> call sites in `create-sale-sync-client.test.ts` (L206 / L244 / L258) and the composition root in
> `index.ts` (L1262 capture + L1270–1271 binding). The required field **cannot be half-removed** —
> the test-expectation flip and the source dep-removal MUST land in the **same change** so no
> intermediate commit fails `npm run typecheck`.

- [ ] T040 RED [US-D7] flip the client request-shape test — assert `headerValue(req.init, 'X-Device-Attestation')` is **`undefined` (ABSENT)** (was L219 asserting it equals `ATTESTATION`); **delete** the "does NOT POST when the device attestation is unavailable" case (L238–250) since the dep is gone; remove `getDeviceAttestation` from the 3 client constructions (L206 / L244 / L258); drop the now-stale `ATTESTATION` constant + body-redaction assertion (L224) tied to it. Keep the no-token pause path. *(Lands in the same commit as T041/T042 — required-dep removal.)* — `src/main/sales-sync/__tests__/create-sale-sync-client.test.ts`
- [ ] T041 GREEN [US-D7] in the **same change** as T040: remove the `'X-Device-Attestation': attestation` header (L262), remove the `getDeviceAttestation` field from `CreateSaleSyncClientDeps` (L119–127) and its destructure (L220), and remove the pre-POST attestation refusal block (L234–240). The operator-token (envelope) pause at L227–232 stays. — `src/main/sales-sync/create-sale-sync-client.ts`
- [ ] T042 GREEN [US-D7] composition-root D7 wiring — remove the `getDeviceAttestation` binding (`index.ts` L1270–1271) and the `pairedDeviceAttestation` capture (L1262, `await deviceTokenAttestation()`) feeding only the dropped client dep. **Untouched:** read-down `getDeviceToken` (`read-down-client.ts` Bearer) and the sign-in `device_token_attestation` body (`sign-in-handler.ts` L113–116) — the device token's retained, proper roles (D7 narrows the role; does not re-issue — N-6). *(Same change as T040/T041 to keep typecheck green.)* — `src/main/index.ts`

### Invariant — device-token-alone is refused on the sale wire (Principle VIII / 028 §18 / CM-2)

- [ ] T043 RED [US-D7] invariant test — with the attestation header gone and the envelope-present gate in force, a sale-sync POST authorized by the **device token alone** is impossible: a present device token with an **absent** envelope (`null` or `''`) **pauses** the drain (no POST leaves). Assert no `fetch` is attempted and the row stays pending. — `src/main/sales-sync/__tests__/sale-sync-engine.test.ts`
- [ ] T044 GREEN [US-D7] confirm the invariant holds with no further source change — the M-1 gate (T030) + the dropped header (T041) already make a device-token-only POST impossible. Edit only if T043 reveals a gap. — `src/main/sales-sync/sale-sync-engine.ts`

## Phase 5 — Cross-Cutting Verification & Cashier Scoping

- [ ] T050 RED [US-D5] bridge-invariant re-check — confirm the read-only `sales:syncStatus` channel still carries **no credential** (opaque or otherwise): the envelope is never returned through any bridge-facing value, no write/trigger handler exists, no token/PII/card/raw-error crosses the boundary (redaction smoke). The credential is now opaque, so this invariant is unchanged — assert it still holds. — `src/main/ipc/__tests__/sales-sync.test.ts`
- [ ] T051 [VERIFY] Cashier-envelope confirmation (closes/scopes E-3, **NOT a blocker**) — confirm against the shipped #559 contract whether the **cashier PIN** path receives a per-operator envelope. **Evidence:** today there is no acquisition point — the cashier sign-in path (`sign-in-handler.ts` L391–400) creates a local-only session with `backend_session_id: ''` and never calls the backend sign-in endpoint (AD-2); the cashier takeover (`takeover-handler.ts`, AD-2) likewise skips the backend. If #559 mints a cashier-safe envelope → the cashier-sync gap is structurally closeable (scope as a follow-up slice). If not → record the gap; it stays governed by OQ-CARRY. **Does NOT block the manager/admin D5/D7 path** (T010–T044 fully enable it).
- [ ] T052 [VERIFY] OQ discipline check — confirm 016 introduces **no local refresh-token storage** (OQ-9 safe default: #559 v1 envelope renewal is via re-sign-in). On a `401/403`, POS re-acquires the envelope by re-sign-in and re-drains (G-5). Record OQ-9 and OQ-CARRY (cashier-pilot acceptability) as **carried owner OQs** — surfaced, not silently over-resolved.

## Phase 6 — Polish, Security Re-Check & Gates

- [ ] T060 [P] Coverage check — ≥ 80% on all changed code (the auth-credential seam is correctness-critical: assert what the holder *actually contains*, not merely that `.set` was called); `npm test -- --coverage`.
- [ ] T061 Final green — full main-process suite passes (5062+ green baseline from 011-S5 must stay green after the swap); `npm run typecheck` (both tsconfigs, strict) + `npm run lint` (no new `any`) clean; `npm run package:dir` dry-run unaffected (no packaging surface touched).
- [ ] T062 [GATE:§A4] [VERIFY] §A4 bridge-security re-check refreshed against the **live wired path** — confirm the envelope never crosses the bridge, never logged, never in the body in the wired closures (`index.ts` L1266–1269 / L1279–1282); confirm `X-Device-Attestation` is gone from the sale wire and the device-token-alone invariant holds (T043). 016 touches **no** bridge channel, so this is a **confirmation**, not a new review — record it (carries forward the 010/011-era §A4 pattern) in `specs/016-operator-envelope-adoption/security-review/s-d5d7-review.md`.
- [ ] T063 [VERIFY] Update CLAUDE.md feature block + spec.md **status only** (NOT the spec body) with the realized D5/D7 slice status (owner-authorized). Note the carried OQ-9 / OQ-CARRY / cashier-scoping outcome from T051/T052.

---

## Dependencies & ordering

- **Phase 1 (T001/T002)** binds the contract; informs every later task. No code.
- **Phase 2 (T010)** the type edit is foundational — shared by both credential-storage paths; lands before the interpreter (it must compile for T021's GREEN to reference the field).
- **Phase 3 (US-D5)** is the credential swap:
  - **T020/T021 (C-1)** is the highest-priority step — the P2 fake-success trap. The interpreter fix gates T023/T025 (without it, the holder would store `undefined`).
  - **T022/T023** (sign-in store) and **T024/T025** (takeover store) both depend on C-1; they touch different files and their RED tests are independent.
  - **T029/T030 (M-1)** depends on the holder now carrying the envelope.
  - **T027/T028** (client/index read path) verify presentation — likely no edits.
- **Phase 4 (US-D7)** follows D5 (DAG: `D1 → D5 → D7`). **T040 + T041 + T042 are ONE change** (M-2: the required dep cannot be half-removed without breaking typecheck). **T043/T044** (invariant) depends on the M-1 gate (T030) + the dropped header (T041).
- **Phase 5** verification runs after the code lands; **T051/T052** are non-blocking decision gates.
- **Phase 6** gates: T060/T061 after all code; **T062 (§A4)** is the security re-check; T063 last.

## Parallel opportunities

- Phase 1: T001 ∥ T002 (both non-code confirmations).
- US-D5: the RED tests T020 (interpreter) ∥ T022 (sign-in) ∥ T024 (takeover) touch distinct files — but T021 (the C-1 GREEN) must land before T023/T025 GREEN (they depend on the preserved field).
- US-D7: T040/T041/T042 are a single atomic change — **not** parallelizable (M-2).
- Polish: T060 ∥ T061 setup; T062/T063 serialize at the end.

## Implementation strategy

**MVP = US-D5 (Phase 3)**: re-credential the held secret from Clerk JWT → envelope across the two
storage paths (sign-in C-1b, takeover C-2), with the C-1 interpreter fix as the load-bearing
first step (defeats the P2 fake-success trap), then the M-1 `''`-gate. The client + index read paths
are delegated and verified, not rewritten — **no rework of 011-S5's drain/retry/dead-letter logic**.

**US-D7 (Phase 4)** then de-overloads the device token: drop `X-Device-Attestation` from the sale
wire (one atomic M-2 change to keep typecheck meaningful) and pin the device-token-alone invariant.
The device token keeps its proper roles (read-down Bearer + sign-in attestation body) untouched.

**Carried, non-blocking:** the cashier per-operator-envelope question (T051, E-3 — no acquisition
point exists in POS today), OQ-9 (no local refresh-token storage — safe default), OQ-CARRY
(cashier-pilot acceptability). None block the manager/admin path, which T010–T044 fully enable.
