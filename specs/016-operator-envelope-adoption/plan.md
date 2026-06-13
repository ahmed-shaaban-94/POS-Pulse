# Implementation Plan: POS Adopts the Operator Envelope; Device Token Reverts to Device-Scoped

**Feature ID:** 016-operator-envelope-adoption
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-06-13
**Last Updated:** 2026-06-13
**Constitution version pinned:** v1.5.1

---

> **Status note (gate lifted).** This plan is authored as the **implementation-enablement pass** for drift items **D5** (POS adopts the `pos_operator` envelope) and **D7** (device token reverts to device-scoped). The spec's depth gate **A-11** ("no plan.md / tasks.md — GATED depth") was conditioned on the upstream **D1** envelope being unbuilt. That condition has **lifted**: **D1 shipped & closed in Data-Pulse-2** (PR #559 / `202d253`, DP-2 spec 031), and **G10** (Identity & Access Boundary Gate) is **SATISFIED-FOR-BOUNDARY-DECISIONS** (Orchestrator 028 merged, PR #85 / `76cfcc3`; OQ-1/5/6/7/8/10 signed). Authoring plan.md + tasks.md is therefore now correct. The spec's `spec.md` body is **not** mutated beyond status by this plan; the planning prose deviations it declared (omitted Given/When/Then etc.) are superseded by this plan's concrete Phase 1/Phase 2 design.

## What D1 shipped (the contract this plan consumes)

POS authors **no contract and no migration** here (A-2: 016 has neither; the DP-2 contract is *consumed*, not authored). The shipped #559 facts this plan binds to:

- **Sign-in / takeover RETURN a nullable opaque `envelope`** on `PosOperatorSessionSummary`. The raw envelope is **hash-once** (returned once; `null` on replay).
- **The three sale routes** (`captureSale` = `POST /api/pos/v1/sales`, `recordVoid`, `recordRefund`) now use a **new `operatorAuthorization` OpenAPI security scheme** = opaque bearer (`type: http`, `scheme: bearer`, **NO `bearerFormat`**) presented as `Authorization: Bearer <envelope>`.
- **`X-Device-Attestation` is RETIRED** from the sale routes (031 comment in `sales.yaml`). This resolves **OQ-D7-WIRE**: no device-trust attestation co-travels on the sale wire after D7 — **drop the header**.
- The backend **re-evaluates the full operator predicate** (membership / device / store-access / role / expiry) **live per request**. `Idempotency-Key` is still **REQUIRED**, keyed on `(method, route, POS device principal, key)`.

016 is a **strict superset of 011-S5**, which is already shipped and operational today with the Clerk JWT (`createSaleSyncClient` + composition-root wiring T060–T063). 016 **re-credentials the same wiring sites** from Clerk JWT → envelope. No conflict, no rework of 011-S5 drain/retry/dead-letter logic.

## Technical Context

The stack is pinned by the constitution (v1.5.1, Tech Stack §Frozen for MVP); this plan restates only what it touches. The envelope is an **opaque bearer string** — POS treats it as an unstructured secret (no parsing, no claim-reading), exactly as it treats the Clerk JWT today.

| Area | Choice | Source |
|:--|:--|:--|
| Language / strictness | TypeScript 5.6+, `strict: true`, both tsconfigs | constitution v1.5.1 (Principle V) |
| Process boundary | Main-process credential handling only; renderer never touches the credential | constitution v1.5.1 (Principle III, P7/P8) |
| Credential representation | Opaque bearer **string**; held in the existing `jwt-holder` seam keyed on `backend_session_id` | #559 contract / spec §4 / clarify Q2 |
| Sale-sync auth scheme | `operatorAuthorization` = `Authorization: Bearer <envelope>` | DP-2 `sales.yaml` (#559, spec 031) |
| Device-attestation on sale wire | **Dropped** — `X-Device-Attestation` retired from sale routes | DP-2 `sales.yaml` (#559); resolves OQ-D7-WIRE |
| Device token retained roles | Read-down `Authorization: Bearer <device_token>`; sign-in `device_token_attestation` body | spec §5 / unchanged |
| Idempotency | `Idempotency-Key: payload.externalId` (deterministic) — **unchanged** | 011 / #559 (still REQUIRED) |
| Auth-refusal classification | `401/403 → transient` (retryable, never dead-letter) — **semantics preserved**, comment updated | spec §6 / E-4 |
| Contract / migration authored by POS | **None** (consumer lane) | spec A-1/A-2; constitution P16 |
| Test runner | Vitest (main-process units), `happy-dom` env where renderer touched (none here) | constitution v1.5.1 (Principle VI) |
| `api-types.ts` regeneration | **Not required for 016.** The operator/sale-sync clients use hand-mirrored local types (per 004 owner decision; backend-client.ts header). No NEEDS CLARIFICATION. | research §R5 |

No genuinely-open technical NEEDS CLARIFICATION remains for the **manager/admin path**: every D5/D7 wiring decision is resolvable from the shipped #559 contract + the scoping evidence. The single carried verification item (does #559 mint envelopes for the **cashier PIN** path?) is recorded in Risks and surfaced as a verification task — **not** a blocker for the manager/admin path.

## Constitution Check (Initial)

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | PASS | No request-path change. Sale capture stays local-first; sync is background. Auth-refusal preserves "never drop a sale" (G-5 / §6). |
| II. Financial Precision | N/A | 016 touches **no money path**. The minor-unit → decimal-string transform (`toWireBody`) is untouched; only the auth credential and one header change. No float introduced. |
| III. Process-Boundary Discipline | PASS | The envelope is read **in-process** (`getOperatorToken` closure → `jwtHolder.get`), never bridged. No new IPC channel; no ad-hoc `ipcRenderer`. NON-NEGOTIABLE — explicitly upheld. |
| IV. Hardware Loud, Not Silent | N/A | No hardware surface touched. |
| V. Type Safety End-to-End | PASS | Net-new `pos_operator_envelope?: string \| null` typed on `BackendSignInSuccess` + `ConfirmTakeoverResponse`; interpreter validates `string \| null \| absent` at the boundary (C-1). Removing the required `getDeviceAttestation` dep (M-2) is a typed signature change sequenced so **every intermediate commit typechecks**. No new `any`. |
| VI. Test-First, Coverage-Gated | PASS | Every step is RED-first (see Test Strategy). The two silent-no-op traps (C-1 interpreter drop; C-2 takeover path) get **dedicated RED tests** before the fix. ≥ 80% on changed code. |
| VII. Observability | PASS | The credential is never logged (the existing `pino` redaction list covers `jwt`/`authorization`/`session_token`; the envelope rides the same closure-bound holder). Outcome logs carry only `sale_id`/`status`/`category`. |
| VIII. Terminal Identity ≠ User | PASS | **Load-bearing and the core intent.** D7 *strengthens* VIII: it de-overloads the one device-token secret (E-2) so the device token is **no longer** authorization-adjacent on the sale wire (CM-2). The envelope carries operator authority; the device token reverts to pure device-scope (read-down + sign-in trust). The invariant "a sale-sync POST authorized by the device token alone is impossible" is added as a test (028 §18 / CM-2). NON-NEGOTIABLE — upheld and reinforced. |
| IX. Reference, Not Inheritance | PASS | No copy-paste from `_reference/`. All shapes re-derived from the #559 contract. |
| Platform Integration | PASS | Sale-sync remains the single typed client to `api.smartdatapulse.tech`; the new `operatorAuthorization` scheme is consumed, not invented. |
| Security | PASS | The envelope is a secret stored only in the main-process holder (same secrecy as the Clerk JWT it replaces). Dropping `X-Device-Attestation` *reduces* the credential surface on the sale wire. |
| Hardware Matrix | N/A | Not touched. |
| Domain — Pharmacy POS | PASS | Sale entity / outbox / idempotency semantics unchanged. |
| **Cross-Feature P1–P18 (walked):** | | |
| P2 No Fake Success | PASS | **The P2 trap is the whole risk surface.** C-1 (interpreter allowlist silently drops the envelope) and C-2 (takeover stores JWT/`''` not envelope) would each produce a GREEN suite while the swap silently no-ops — a fake-success state at the architecture level. Each gets a dedicated RED test asserting the credential the holder actually contains. |
| P3 No Silent Data Loss | PASS | Auth-refusal stays retryable (E-4); M-1 normalizes `''`→absent so a takeover fallback can't silently strip auth and 401 into a no-op. |
| P5 Idempotency | PASS | `Idempotency-Key` = deterministic `externalId`, unchanged; #559 still requires it. |
| P7 Secrets Never Reach Renderer/Logs | PASS | Envelope never bridged, never logged, never in the body — same closure-bound holder + redaction list. |
| P8 Electron Security Boundary | PASS | **No bridge / preload / `bridge-api.ts` change.** All edits are in `src/main/**`. The read-only `sales:syncStatus` channel is unchanged (no credential crosses it — pinned by an existing test). |
| P16 Feature Scope Discipline | PASS | Stays in the POS consumer lane. Authors no contract/migration; does not define the envelope (D1), the offline-PIN re-anchor (D6), or the scheme rename (D4). |
| P17 Tenant Isolation | PASS | Backend re-evaluates the full operator predicate (incl. store-access) live per request against the envelope; POS scope unchanged. |
| G7 Provider-Neutrality (028 G-10) | PASS | After adoption, **no Clerk-specific field/scheme/name** leaks into the sale-sync auth path. `pos_operator_envelope` is provider-neutral; the Clerk JWT is confined to sign-in. |

No VIOLATION. No WAIVED entry required.

## Phase 0 — Research

Inline (no separate `research.md` needed; the decisions are small and contract-driven). Each resolves a plan-internal decision from the **shipped #559 contract** + scoping evidence — none decides a carried owner OQ.

- **R1 — Envelope shape = opaque bearer string.** #559 returns a nullable opaque `envelope`; the `operatorAuthorization` scheme is `type: http, scheme: bearer` with **no `bearerFormat`**. **Decision:** POS treats the envelope as an unstructured `string` secret — no parsing, no claim inspection — and presents it as `Authorization: Bearer <envelope>`. Rationale: provider-neutrality (G7) and forward-compat with envelope renewal; POS must not couple to envelope internals.
- **R2 — `X-Device-Attestation` dropped from the sale wire.** The shipped `sales.yaml` **retires** the header from the sale routes (031 comment). **Decision (resolves OQ-D7-WIRE):** the sale-sync POST drops `X-Device-Attestation`, and the required `getDeviceAttestation` dep is removed from `CreateSaleSyncClientDeps`. Rationale: the backend re-evaluates the device dimension live from the envelope-bound principal; a co-travelling attestation header is no longer part of the contract. The read-down Bearer and the sign-in `device_token_attestation` body are **untouched** (the device token's proper, retained roles).
- **R3 — Engine gate becomes envelope-present, normalizing `''`→absent (M-1).** Today the engine pauses on `getOperatorToken() === null` (L117/L121). The client also refuses on `token.length === 0` (L228). The takeover path historically stored `proto.jwt ?? ''` — an **empty string** — which the `=== null` gate would *pass* but the client would then reject as `no_connection`, a silent no-op drain. **Decision:** the envelope-present gate MUST treat `''` as **absent** (pause), pinned by a test for the `''` case.
- **R4 — Auth-refusal classification preserved, comment corrected.** `classifyStatus` keeps `401/403 → transient` (retryable; never dead-letter — E-4 / G-5). The credential lifetime now tracks the envelope (re-acquired via re-sign-in for v1), not the ~60s Clerk JWT. **Decision:** semantics unchanged; only the explanatory comment is updated to reference the envelope rather than the Clerk JWT.
- **R5 — No `api-types.ts` regeneration.** The operator + sale-sync clients use hand-mirrored local types (per the 004 owner decision recorded in `backend-client.ts`). **Decision:** add the envelope field to the local mirrored types; do not run `codegen:api` for 016.
- **R6 — OQ-9 default: refresh-token NOT stored locally.** #559 envelope renewal for v1 is via **re-sign-in** (the safe default; nothing in the shipped contract introduces a locally-stored refresh credential). **Decision:** 016 introduces **no** local refresh-token storage. On an authorization refusal, POS re-acquires the envelope by re-sign-in and re-drains (G-5). This is recorded as the carried owner OQ-9 — surfaced, not silently resolved beyond the safe default.

## Phase 1 — Design & Contracts

No `data-model.md`, no `contracts/`, no `quickstart.md` — 016 authors no schema and no contract (consumer lane). The design is the **credential swap** across the existing seams.

### D5 — credential acquisition → holding → presentation

```
sign-in (manager/admin)                    takeover (manager/admin)
  Clerk exchange ──► backend.signIn(jwt)      proto.jwt ──► backend.confirmTakeover(jwt)
        │ returns BackendSignInSuccess               │ returns ConfirmTakeoverResponse
        │  + pos_operator_envelope (C-1)             │  + pos_operator_envelope (C-1, same interpreter)
        ▼                                            ▼
  jwtHolder.set(backend_session_id, ENVELOPE)   jwtHolder.set(backend_session_id, ENVELOPE)   ◄── C-2 (was proto.jwt ?? '')
        │  (provider JWT's job ends here)             │
        └──────────────┬──────────────────────────────┘
                       ▼
        jwt-holder seam (REUSED, no code change; now holds the envelope)
                       │  read in-process by the getOperatorToken closure (index.ts)
                       ▼
        sale-sync client: Authorization: Bearer <envelope>   (X-Device-Attestation DROPPED)
                       │  envelope-present gate ('' = absent, M-1)
                       ▼
                POST /api/pos/v1/sales   (Idempotency-Key unchanged)
```

**Critical correctness points (must each have their own RED+GREEN task):**

- **C-1 — interpreter must explicitly preserve the envelope (P2 fake-success trap).** `interpretSignInResponse` (`backend-client.ts` L350–387) and `interpretTakeoverConfirmResponse` (L406–411) hand-build the return object with an **allowlist** (only `operator` + `operator_session` copied). They **silently drop unknown fields**. Adding `pos_operator_envelope` to the *type* is **not enough** — the interpreter must explicitly read `v['pos_operator_envelope']`, validate it is `string | null | absent`, and include it in the returned object. Otherwise `backend.pos_operator_envelope` is **always `undefined`** at runtime and the swap silently no-ops with a **green** suite. **RED test:** interpreter preserves the envelope field from raw JSON (and validates a non-string/non-null value is rejected to `refused`, consistent with the existing allowlist posture).
- **C-2 — takeover is a second credential-storage path (absent from the original scope).** `confirmManagerAdminTakeover` (`takeover-handler.ts` L197) stores `jwtHolder.set(record.backend_session_id, proto.jwt ?? '')`. After a manager/admin **takeover** the holder gets the **JWT/empty-string, NOT the envelope** — breaking G-1/G-2 for the entire takeover flow (028 §9: takeover installs the new operator's authority). **Fix:** thread the envelope through the confirm path — `interpretTakeoverConfirmResponse` parses it (same C-1 fix), `ConfirmTakeoverResponse` carries it, and L197 stores `backendResult.pos_operator_envelope`. `ProtoSession.jwt` (`takeover-handler.ts` L42) remains the provider JWT for the confirm **call** only; it is **not** what gets held post-takeover. **RED test:** post-takeover holder contains the envelope, not the JWT or `''`.
- **M-1 — normalize empty-string to absent.** The envelope-present gate in `sale-sync-engine.ts` (L117 / L121) MUST treat `''` as absent (pause), with a test pinning the `''` case. Guards against a takeover fallback `''` slipping past the `=== null` gate into a `no_connection` no-op POST.

### D7 — device-token role reversion (follows D5 in the DAG)

- **Sale wire:** drop `'X-Device-Attestation': attestation` from the sale-sync POST (`create-sale-sync-client.ts` L262) and remove the `getDeviceAttestation` dep + its pre-POST refusal block (L234–240).
- **M-2 — breaking signature change, sequenced to keep typecheck meaningful.** `getDeviceAttestation` is a **required** (non-optional) field on `CreateSaleSyncClientDeps`. Removing it is a type-breaking signature change at **all** call sites: the source plus the **3 test call sites** in `create-sale-sync-client.test.ts` (L206 / L244 / L258) and the composition-root wiring in `index.ts` (L1270–1271, plus the `pairedDeviceAttestation` capture at L1262). The dep-removal MUST be sequenced so **no intermediate commit fails `npm run typecheck`** — i.e. flip the test expectations (attestation header **absent**; delete the `getDeviceAttestation: () => null` no-POST case) and remove the dep from source **in the same change**, since the field is required and the type can't be half-removed.
- **Retained device-token roles (UNCHANGED):** read-down `Authorization: Bearer <device_token>` (`read-down-client.ts` + `index.ts` `getDeviceToken`) and the sign-in `device_token_attestation` body (`sign-in-handler.ts` L113–116 → `backend-client.ts`). D7 narrows the device token's *role*; it does not re-issue or re-mint it (N-6).
- **Invariant (must hold + be tested):** a sale-sync POST authorized by the device token **alone** must be impossible/refused (028 §18 / CM-2). Concretely: with the attestation header gone and the envelope-present gate in force, no POST leaves without an envelope; a present device token with an absent envelope pauses the drain.

### Auth-refusal / re-acquire design (G-5, "never drop a sale")

On `401/403` (envelope expired/revoked): `classifyStatus` returns `transient` → `recordTransient` (attempt++, exponential backoff, sale stays pending — P3). The operator re-signs-in (v1 renewal path, R6), the holder receives a fresh envelope (C-1 / C-2), and the row re-drains. No dead-letter on an authorization refusal. A genuine non-auth contract defect (other `4xx`, e.g. 400/422) remains dead-letterable, as today.

## Project Layout

Only files this plan touches (all under `src/main/**` — no bridge/preload/migration):

```
src/main/operator/
  backend-client.ts            D5  — type: + envelope on BackendSignInSuccess & ConfirmTakeoverResponse (~L45–52, L104–107)
                                     C-1 — interpretSignInResponse (L350–387) + interpretTakeoverConfirmResponse (L406–411) read & preserve envelope
  sign-in-handler.ts           D5  — L167: jwtHolder.set(backend_session_id, ENVELOPE) instead of exchange.jwt
  takeover-handler.ts          C-2 — L197: jwtHolder.set(..., backendResult.pos_operator_envelope) instead of proto.jwt ?? ''
  jwt-holder.ts                REUSED — no code change (legacy param name 'jwt' retained; main-process only)
src/main/sales-sync/
  create-sale-sync-client.ts   D7  — drop X-Device-Attestation (L262) + remove getDeviceAttestation dep (L120–127, L220, L234–240)
                                     R4 — update classifyStatus comment (L207–210) to reference the envelope
  sale-sync-engine.ts          M-1 — envelope-present gate; '' treated as absent (L117, L121)
src/main/index.ts              D5/D7 — getOperatorToken closure now returns the envelope (L1266–1269, L1279–1282; delegated, likely no change);
                                       remove getDeviceAttestation binding + pairedDeviceAttestation capture (L1262, L1270–1271)
src/main/operator/__tests__/sign-in-handler.test.ts            RED — holder stores the envelope from backend.signIn (mock returns it; L115/L132)
src/main/operator/__tests__/takeover-handler.test.ts           RED — post-takeover holder contains the envelope (C-2)
src/main/operator/__tests__/backend-client.test.ts             RED — interpreter preserves pos_operator_envelope (C-1)
src/main/sales-sync/__tests__/create-sale-sync-client.test.ts  RED — Authorization=Bearer<envelope>; X-Device-Attestation ABSENT; drop no-attestation case (L200–264)
src/main/sales-sync/__tests__/sale-sync-engine.test.ts         RED — envelope-present gate semantics + '' = absent (M-1) (harness token at L62)
src/main/ipc/__tests__/sales-sync.test.ts                      INVARIANT — no credential crosses the bridge (still holds; opaque credential)
```

## Test Strategy

- **Framework:** Vitest (main-process units). No renderer change → no `happy-dom`/axe work in 016.
- **TDD, RED first** (constitution Principle VI, NON-NEGOTIABLE):
  1. **C-1 RED** — `backend-client.test.ts`: feed raw JSON with `pos_operator_envelope` (string), assert the interpreted `BackendSignInSuccess` carries it; feed `null` (carried as `null`); feed a non-string/non-null and assert `refused`; feed **absent** and assert the field is `undefined`/`null` (not a throw). This catches the silent-drop before any source change.
  2. **C-2 RED** — `takeover-handler.test.ts`: drive `confirmManagerAdminTakeover` with a backend result carrying an envelope; assert `jwtHolder.get(backend_session_id) === <envelope>` (NOT the JWT, NOT `''`).
  3. **D5 sign-in RED** — `sign-in-handler.test.ts` (existing pattern at L115/L132): mock `backend.signIn` to return `pos_operator_envelope`; assert `jwtHolder.get('be-sess-1')` is the **envelope**, not `HAPPY_JWT`.
  4. **D7 client RED** — `create-sale-sync-client.test.ts`: flip the request-shape test (L200–236) so `Authorization` = `Bearer <envelope>` and `X-Device-Attestation` is **ABSENT** (`headerValue(...)` undefined); **delete** the "does NOT POST when attestation unavailable" case (L238–250) since the dep is gone; keep the no-token pause path.
  5. **M-1 RED** — `sale-sync-engine.test.ts`: harness with `token: ''` (envelope empty) → drain **pauses**, no POST attempted (mirror the `token: null` case).
  6. **Invariant** — `sales-sync.test.ts`: confirm the read-only `sales:syncStatus` bridge still carries no credential (opaque or otherwise).
- **GREEN** — minimal source edits per step; **typecheck must pass at every commit** (M-2 sequencing).
- **Coverage:** ≥ 80% on all changed code (constitution VI). The auth-credential seam is correctness-critical — assert the credential the holder *actually contains*, not merely that a `.set` was called.
- **Full-suite gate:** the existing main-process suite (5062 green per 011-S5) must stay green after the swap; the 3 client test call-site edits (M-2) are part of the same change that removes the dep.

## CI / Build / Package

The four required gates (constitution §CI Gates, `windows-latest`):

1. **`npm run typecheck`** — both tsconfigs strict. M-2 sequencing keeps this meaningful (no half-removed required dep).
2. **`npm run lint`** — ESLint + Prettier. No new `any`.
3. **`npm test`** (Vitest, both processes) — RED-then-GREEN per step; coverage floor ≥ 80% on changed code; full suite green.
4. **`npm run package:dir`** (`electron-builder --win --dir`) — packaging dry-run; no packaging surface touched, expected unaffected.

No `codegen:api` / `codegen:verify` step for 016 (R5: local mirrored types).

## Phase 2 — Implementation Outline

Ordered, **test-first**, **D5 then D7** (D7 follows D5 per the DAG `D1 → D5 → D7`). Each step maps to its edit site. This is the strategy `/speckit-tasks` derives from.

**D5 — adopt the envelope (acquire → hold → present):**

1. **T-A (type):** Extend `BackendSignInSuccess` (L45–52) and `ConfirmTakeoverResponse` (L104–107) with `pos_operator_envelope?: string | null`. *(type only; compiles, no behavior yet.)*
2. **T-B (C-1, RED→GREEN):** Write the interpreter-preservation RED test; then make `interpretSignInResponse` (L350–387) read/validate/include `v['pos_operator_envelope']`. `interpretTakeoverConfirmResponse` (L406–411) inherits the fix via its delegation to `interpretSignInResponse`. **Highest-priority step — the P2 fake-success trap.**
3. **T-C (D5 sign-in, RED→GREEN):** RED test that the holder stores the envelope; then change `sign-in-handler.ts` L167 to `jwtHolder.set(record.backend_session_id, <envelope from backend>)` instead of `exchange.jwt`. The provider JWT's job ends at sign-in (G-2).
4. **T-D (C-2 takeover, RED→GREEN):** RED test that the post-takeover holder contains the envelope; then change `takeover-handler.ts` L197 to `jwtHolder.set(record.backend_session_id, backendResult.pos_operator_envelope ?? ...)` instead of `proto.jwt ?? ''`. `ProtoSession.jwt` stays the provider JWT for the confirm *call* only.
5. **T-E (M-1 gate, RED→GREEN):** RED test for the `''`-envelope pause; then make the engine gate (L117/L121) treat `''` as absent. `jwt-holder.ts` needs **no** code change (REUSED seam).
6. **T-F (index wiring):** Confirm the `getOperatorToken` closures (L1266–1269, L1279–1282) now return the envelope by delegation through the holder — **likely no change** (the holder content changed, the read path didn't). Verify, don't edit unless required.

**D7 — device-token role reversion (after D5):**

7. **T-G (D7 client, RED→GREEN, M-2 breaking change):** Flip the client request-shape test (assert `X-Device-Attestation` ABSENT; delete the no-attestation case) **and** in the same change remove the header (L262), the `getDeviceAttestation` dep (L120–127, L220), and its pre-POST refusal block (L234–240). Update `classifyStatus` comment (R4). **All in one commit** to keep typecheck green (required dep can't be half-removed).
8. **T-H (index D7 wiring):** Remove the `getDeviceAttestation` binding and the `pairedDeviceAttestation` capture (`index.ts` L1262, L1270–1271). Read-down `getDeviceToken` and the sign-in attestation body are **untouched**.
9. **T-I (invariant, RED→GREEN):** Add/confirm the test that a sale-sync POST authorized by the device token **alone** is impossible — with the attestation header gone and the envelope-present gate in force, no POST leaves without an envelope (028 §18 / CM-2).
10. **T-J (verification, not a blocker):** Verify against #559 whether the **cashier PIN** path receives a per-operator envelope. If yes, the cashier-sync gap (E-3) is structurally closeable; if no, record it. This is a **verification step**, not a gate on the manager/admin path (which is fully enabled by T-A…T-I).
11. **T-K (full-suite + gates):** typecheck / lint / test (coverage) / package dry-run all green.

## Constitution Check (Post-Design)

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| III. Process-Boundary Discipline | PASS | Design adds **no** IPC/bridge surface; all edits in `src/main/**`; envelope read in-process only. |
| V. Type Safety End-to-End | PASS | Envelope typed `string \| null` on both response types; interpreter validates at the boundary; M-2 removal sequenced to keep every commit typechecking. No new `any`. |
| VI. Test-First | PASS | Eleven ordered steps, each RED-first; the two silent-no-op traps (C-1, C-2) and the `''` trap (M-1) have dedicated RED tests. |
| VIII. Terminal Identity ≠ User | PASS | D7 de-overloads the device token (E-2) and adds the "device-token-alone is refused" invariant (CM-2). VIII is reinforced, not weakened. |
| P2 No Fake Success | PASS | The interpreter-preservation (C-1) and post-takeover-holder (C-2) RED tests assert the credential the holder *actually contains*, defeating the green-suite-but-no-op trap. |
| P7 / P8 Secrets & Bridge | PASS | Envelope never bridged/logged/in-body; no bridge surface change. |
| G7 Provider-Neutrality | PASS | Post-adoption the sale-sync auth path carries no Clerk-specific field/scheme; Clerk JWT confined to sign-in. |
| All other principles | PASS / N/A | Unchanged from Initial (money path N/A; offline-first preserved; tenant isolation re-evaluated live by the backend per request). |

Status remains **PASS** across the board. No WAIVED entry.

## Risks & Open Items

- **OQ-9 (carried owner OQ — refresh-token local storage).** **Default applied: NOT introduced.** #559 v1 envelope renewal is via re-sign-in; nothing in the shipped contract introduces a locally-stored refresh credential, so 016 stores none. If the owner later wants refreshable envelopes held locally, that is a new decision interacting with the D1 envelope contract — surfaced here, not silently resolved beyond the safe default. *Owner: Ahmed.*
- **OQ-CARRY (carried owner OQ — cashier-pilot acceptability).** Whether the current "cashier-only terminals cannot sync; sync gated on a manager's envelope" gap (E-3) is acceptable for the pilot, or the per-operator envelope must land before pilot. **Not asserted resolved.** *Owner: Ahmed.*
- **Cashier per-operator-envelope question (verification, NOT a blocker).** Does #559 mint envelopes for the **cashier PIN** path? The cashier sign-in path (`sign-in-handler.ts` L392–400) creates a local-only session with `backend_session_id: ''` and never calls the backend sign-in endpoint (AD-2); the cashier takeover (`takeover-handler.ts` L218–251, AD-2) likewise skips the backend. So **today there is no acquisition point** for a cashier envelope in POS. Recorded as **T-J verification**: confirm against the shipped contract whether a cashier-safe envelope-mint path exists. If absent, the cashier-sync gap (E-3) stays open and is governed by OQ-CARRY. **This does not block the manager/admin D5/D7 path**, which T-A…T-I fully enable.
- **M-2 breaking-signature risk.** `getDeviceAttestation` is a required dep on `CreateSaleSyncClientDeps` with 3 test call sites + the index wiring. Mitigation: remove it in a single change alongside the test-expectation flip so no intermediate commit fails typecheck (sequenced in T-G/T-H).
- **Residual §A4 re-check (carry-forward).** A final security re-check of the sale-sync auth path is owed once the swap lands (the 010-era §A4 pattern). 016 touches no bridge channel, so this is a confirmation, not a new review — but record it for the dispatched slice.
- **Gating posture.** This plan is the implementation-enablement artifact; actual dispatch still requires explicit scoped owner approval (per the spec header). G10 is satisfied for the boundary decisions; D1 has shipped. No branch/commit/push is performed in this workflow (the orchestrator handles git).

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task generation MUST update this plan and re-run task generation.*
