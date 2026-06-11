> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# Spec D5+D7 — POS Adopts the Operator Envelope; Device Token Reverts to Device-Scoped

**Status:** SPECIFY-ONLY / DRAFT — for owner review. No implementation, no contract, no migration authored or implied.
**Date:** 2026-06-11.
**Owning repo:** POS-Pulse (the implementation repo this would eventually dispatch to, post-approval).
**Deciders:** Owner (Ahmed Shaaban); drafted by the Orchestrator on verified `origin/main` evidence.
**Relation to 028:** Realizes the **POS half** of the 028 keystone — 028 §6 **CM-1** (a provider JWT is identity proof / sign-in evidence only) and **CM-2** (a device credential is device-scoped and must not prove sale ownership alone), and the 028 OQ-8 decision that the current Option-Y sale-sync wire is a **v1 bridge** to an internal provider-neutral operator-authorization envelope. 028 **owns** the boundary (credential ownership, scope-non-interchangeability, the envelope decision); this draft only specifies how **POS-Pulse, as a consumer, conforms** to it. The envelope itself — its format, TTL, refresh, mint mechanics — is **drift D1 / Data-Pulse-2's** to define; here it is an **input**.

**Gating label:** **gated — requires owner approval + G10 verification before any dispatch.** Additionally sequenced behind drift **D1** (the DP-2 mint-and-return slice) per the verified DAG `D1 → D5 → D7`. Specify+clarify depth ONLY: this draft contains **no plan.md and no tasks.md**, because D5's upstream (D1) is not built and any plan/tasks would be speculative.

---

> ### authoring & placement notes (owner can redirect)
>
> 1. **Docs-only, no `.specify/` tooling.** The Orchestrator has no `.specify/` Spec-Kit state, so this was authored manually following the speckit *structure* (mirroring the house style of `docs/specs/028-*/spec.md` and `docs/specs/029-*/spec.md`), written under the allowed `docs/**` surface at the dispatched draft path. The `/speckit-specify` template-copy / branch / `feature.json` steps no-op here by design.
> 2. **This is a DRAFT, not a dispatch.** It is planning prose that would *feed* a future POS-Pulse Queue Item **under G10** — it does **not** advance or mutate the kernel queue, the gates file, or any status file. Per the kernel's own rule, *prose is not evidence*; materializing the Queue Item is a separate, owner-gated act.
> 3. **POS consumer lane only.** This draft specifies POS-side credential acquisition / holding / presentation. It does **not** specify the envelope's wire format, TTL, refresh, or mint mechanics (D1 / DP-2), nor the role-named OpenAPI scheme (drift D4 / DP-2), nor the offline-PIN re-anchor (drift D6, separately gated on D3). Those are referenced as adjacent inputs, not decided here.
> 4. **No Queue ID exists for this work** (it sits under the 028 follow-up set in `docs/roadmap/auth-028-drift-map.md`, rows D5 + D7). The proposed POS slice is *new*, gated, and owner-approval-pending.

---

## Clarifications

### Session 2026-06-11

Each question below is a D5/D7-specific clarify that has a single 028/DAG-consistent answer; it is auto-resolved to the option the signed 028 boundary and the verified drift-map DAG already imply. Genuinely-open 028 boundary questions are **not** decided here — they are carried forward in Open questions (OQ-n).

- Q: After the envelope lands (D1), is the provider (Clerk) JWT still presented on `POST /sales`, or is it confined to sign-in? → A: **Confined to sign-in only.** — 028 CM-1: the provider JWT is identity proof / sign-in evidence, not the durable sale-sync authorization credential; the envelope replaces it on the sale wire. (Today E-1: the Clerk JWT *is* the `Authorization: Bearer` value on `POST /sales` — the drift this closes.)
- Q: Where does POS hold the operator envelope at runtime? → A: **In the existing main-process credential seam (the `jwt-holder` keyed on `backend_session_id`), with the same secrecy properties.** — reuses the seam that holds the Clerk JWT today (`operatorJwtHolder.get(sess.backend_session_id)`, `index.ts`), satisfying 028 SR-4 (no long-lived raw provider JWT in POS) and SR-2 (never logged); main-process only, never crosses the renderer bridge.
- Q: Does the provider JWT continue to be stored long-lived by POS once the envelope is the sale-sync credential? → A: **No — the JWT is used at sign-in to obtain the envelope, then not retained as the sale-sync credential.** — 028 SR-4 (no long-lived raw provider JWT storage in POS); the envelope, not the JWT, is the durable client-held credential. (Whether the envelope is itself refreshable / whether a refresh token is stored locally is **not** decided here — see OQ-9.)
- Q: After the envelope carries authorization, what role does the paired-terminal device token retain (D7)? → A: **A pure device-scoped role only — read-down (`Authorization: Bearer <device_token>`) and device trust — never sale-sync authorization by itself.** — 028 CM-2 ("a device credential is device-scoped and must not prove sale ownership alone"); D7 de-overloads the one secret that today serves three roles (E-2).
- Q: Does POS unilaterally decide whether a device-trust attestation still travels on the sale-sync wire after D7? → A: **No — POS conforms to the D1/D4 contract.** — whether a device-trust attestation header co-travels with the envelope on `POST /sales` is a DP-2 (D1) / contract (D4) decision; POS's D7 obligation is that the device token is no longer the durable sale-sync *authorization* credential. The POS-side reversion (stop using the device token as authorization-adjacent weight) is what this draft specifies.
- Q: Does this draft close the cashier-only-cannot-sync operational gap by itself? → A: **No — it records the gap as the operational driver and conforms to the DP-2 envelope's per-operator semantics; pilot-acceptability remains an owner call.** — recorded as E-3 + OQ-CARRY; the target is a per-operator envelope, but whether the current gap is acceptable for the pilot is not asserted resolved here (SC-09 discipline).

---

## Evidence basis (verified this session, `origin/main`, 2026-06-11)

**Source of truth:** GitHub `origin/main` of each repo, read read-only (`git -C <repo> show origin/main:<file>` / `ls-tree` / `log`). Never the working tree (it may be a feature branch). POS-Pulse `origin/main` tip is the LOC-badge commit `0bb2ed8`; the substantive tip below it is `b34932b` (merge of PR #379). The auth wire facts trace to the sixth-pass arc (PR #372 operator-JWT mint, PR #376 device attestation).

| Repo | `origin/main` HEAD (read) | What was read |
|---|---|---|
| POS-Pulse | `0bb2ed8` (badge) / `b34932b` (substantive, #379) | `src/main/sales-sync/create-sale-sync-client.ts` (sale-sync auth headers); `src/main/sales-sync/sale-sync-engine.ts` (operator-token gate); `src/main/operator/sign-in-handler.ts` (#372 JWT mint + cashier `jwt:null` path); `src/main/operator/backend-client.ts` (sign-in body); `src/main/catalogue/read-down/read-down-client.ts` (#376-era device-token Bearer); `src/main/index.ts` (single `DEVICE_TOKEN_KEY` feeding three roles) |
| Data-Pulse-2 | `6588e86` (badge) / `0c57fed` (substantive, #544) | Read indirectly via the 028 spec + drift-map: the authority that must mint+return the envelope (drift D1) and owns the role-named scheme cleanup (drift D4). Not edited; not re-specified here (028 is the producer). |
| Retail-Tower-Orchestrator | `main` (clean) | `docs/specs/028-*/spec.md` (CM-1/CM-2/SR-2/SR-4, OQ-8/OQ-9); `docs/roadmap/auth-028-drift-map.md` (D1/D5/D7 rows, DAG, cross-repo observations); `docs/gates/cross-repo-gates.md` (G10) |

Four load-bearing **current-runtime facts** (kept distinct from *target* and *open decisions*; each cites a concrete `origin/main` file:line):

- **E-1 (the provider JWT IS the durable client-held sale-sync credential — D5).** On `POST /api/pos/v1/sales`, `create-sale-sync-client.ts` sets `Authorization: Bearer ${token}` where `token = getOperatorToken()` resolves to the **operator Clerk session JWT** (`index.ts`: `getOperatorToken: () => … operatorJwtHolder.get(sess.backend_session_id)`), plus `X-Device-Attestation: attestation` and an `Idempotency-Key`. The client's own header comment states the auth is "`Authorization: Bearer <operator_session_token>` (the Clerk operator JWT — NOT the device token)." So the **provider (Clerk) token is the durable client-held credential the sale-sync route consumes** — exactly the D5 drift. *Target (CM-1, D1→D5): the client holds and presents the internal `pos_operator` envelope; the provider JWT is identity proof at sign-in only.*
- **E-2 (one secret serves three roles — D7).** `index.ts` defines a single `DEVICE_TOKEN_KEY = makeSecretKey('terminal.device-token')` and the comment "Wave 1: device-token attestation = the device token itself." The **same** secret value feeds: (a) read-down `Authorization: Bearer <device_token>` (`read-down-client.ts` + `index.ts` `getDeviceToken`); (b) the sign-in `device_token_attestation` body (`sign-in-handler.ts` → `backend-client.ts`); and (c) the sale-sync `X-Device-Attestation` header (`index.ts` `getDeviceAttestation: () => pairedDeviceAttestation …`). One narrow-issued device credential stretched to authorization-adjacent weight on the sale wire. *Target (CM-2, D5→D7): once the envelope carries authorization, the device token reverts to a pure device-scoped role (read-down + device trust) and is no longer the durable sale-sync authorization credential.*
- **E-3 (cashier-only terminals cannot sync today — the operational driver).** The cashier PIN sign-in path returns `jwt: null` with `backend_session_id: ''` (`sign-in-handler.ts`: the cashier branch sets `jwt: null` and creates a local session with `backend_session_id: ''`). The sale-sync engine pauses the whole drain when `getOperatorToken() === null` (`sale-sync-engine.ts`: `if (getOperatorToken() === null) return;`, re-checked per POST). Because `getOperatorToken()` reads a JWT keyed on a non-empty `backend_session_id`, a cashier-only session yields no token ⟹ **sync is effectively gated on a *manager's* Clerk JWT being present**; cashier-captured sales stay pending until a JWT-bearing session resumes. This is the sharpest illustration that **no per-cashier sale-sync credential exists today** — the operational reason a per-operator envelope is the target. *(Operational gap; pilot-acceptability is an owner call — see OQ-CARRY, not asserted resolved here.)*
- **E-4 (401/403 on the sale wire is treated as retryable, not permanent).** `classifyStatus` maps `401`/`403` to `{ kind: 'transient' }`, with the comment that the operator's Clerk session JWT lives ~60s, so a flush with a stale token legitimately 401s and must be retried (a fresh sign-in re-mints the JWT and the row re-drains), never dead-lettered. This is current Option-Y behavior tuned to a short-lived provider JWT; the envelope adoption (D5) must preserve "auth refusal never silently drops a sale" while the credential lifetime changes from the provider JWT's to the envelope's.

> **SC-09 discipline.** Every statement above is current-runtime evidence on `origin/main`, not a claim that the target is built. The envelope (D1) is **not** shipped; nothing here asserts D1/D5/D7 as done. Where the wire differs from the target, it is recorded as an E-n drift fact.

---

## 1. Summary

POS-Pulse is the client half of the 028 keystone. Today (E-1) the POS sale-sync client authenticates `POST /api/pos/v1/sales` with a **raw Clerk provider JWT** in `Authorization: Bearer`, accompanied by an `X-Device-Attestation` header — so the **provider token is the durable, client-held credential the sale-sync route depends on**. In parallel (E-2) a **single device-token secret** does triple duty: the read-down Bearer, the sign-in attestation, and the sale-sync attestation. And (E-3) because the per-operator credential is the provider JWT, **cashier-only terminals cannot sync at all** — sync is effectively gated on a manager's JWT.

This draft specifies the POS-side change once **drift D1 (Data-Pulse-2)** mints and returns an internal, provider-neutral **`pos_operator` operator-authorization envelope** at sign-in:

- **D5:** the POS client **holds** the envelope (in the existing main-process credential seam) and **presents** it as the durable sale-sync credential on `POST /sales`, **in place of** the raw Clerk JWT. The provider JWT is used **at sign-in only** — to obtain the envelope — and is not the sale-sync credential (028 CM-1, SR-4).
- **D7:** once the envelope carries authorization, the paired-terminal **device token reverts to a pure device-scoped role** — read-down access and device trust — and is **no longer** the sale-sync authorization credential (028 CM-2). The POS-side reversion is to stop treating the device token as authorization-adjacent on the sale wire; whether a device-trust attestation still co-travels is the D1/D4 contract's call.

It is a **POS-consumer conformance draft**: it conforms to a boundary 028 already signed and to an envelope contract D1/D4 will define. It does **not** define the envelope, the wire scheme, or the offline-PIN re-anchor (D6).

## 2. Goals (G-n)

- **G-1.** Replace the raw Clerk JWT as the durable client-held sale-sync credential with the internal `pos_operator` envelope (D5), conforming to the D1/D4 contract. *(028 CM-1.)*
- **G-2.** Confine the provider (Clerk) JWT to **sign-in only** — used to obtain the envelope, not retained as the sale-sync credential. *(028 CM-1, SR-4.)*
- **G-3.** Hold the envelope in the **existing main-process credential seam** with unchanged secrecy properties: main-process only, never bridged to the renderer, never logged, never in the request body. *(028 SR-2, SR-4; POS principles P7/P8.)*
- **G-4.** Revert the paired-terminal **device token to a pure device-scoped role** (read-down + device trust); it must never be the sale-sync authorization credential (D7). *(028 CM-2.)*
- **G-5.** Preserve the **"auth refusal never silently drops a sale"** behavior (E-4) under the new credential's lifetime — re-acquire / re-present and re-drain rather than dead-letter on an authorization refusal.
- **G-6.** Enable a **per-operator sale-sync credential**, so a cashier-only terminal is no longer structurally unable to sync (E-3) — *to the extent the DP-2 envelope's per-operator semantics (D1) deliver it*; this draft does not assert the gap closed.
- **G-7.** Keep the change **provider-neutral**: no Clerk-specific field, scheme name, or API leaks into the POS sale-sync authorization path after adoption. *(028 G-10 anti-lock-in; drift D4 owns the scheme rename.)*

## 3. Non-goals (N-n)

- **N-1.** No code, migration, OpenAPI/contract, package/lock, CI, generated-file, runtime-config, secret, env, or deployment change in this task. (Orchestrator is docs-only; this is SPECIFY-ONLY / DRAFT.)
- **N-2.** **Does not define the envelope** — format, claims, TTL, refresh, signing, or mint mechanics are **drift D1 / Data-Pulse-2's**. This draft treats the envelope as an input.
- **N-3.** **Does not define the wire scheme name** — role-named OpenAPI security schemes (operator-identity / device / service) are **drift D4 / DP-2's** (028 §19 DOC-1/2/3/4). POS conforms to the published scheme.
- **N-4.** **Does not re-specify 028.** 028 is the input boundary that *produces* G10; this is a downstream consumer.
- **N-5.** **Does not specify the offline-PIN re-anchor (drift D6).** That is a separate item, gated on D3, needing the envelope to carry `user_id`; referenced as adjacent only.
- **N-6.** **Does not change the device pairing / attestation issuance** mechanism — D7 narrows the device token's *role*, it does not re-issue or re-mint it.
- **N-7.** **Does not decide refresh-token storage** (028 OQ-9) — carried forward as an open question.
- **N-8.** No assertion that D1, D5, or D7 is implemented; no claim the cashier-sync gap (E-3) is resolved.

## 4. POS-side credential lifecycle (target, D5)

> Technology-described at spec altitude, not code. The envelope's internals are D1's; this section is POS's handling of it.

- **Acquire at sign-in.** Online operator sign-in continues to authenticate the human via the provider (Clerk JWT) and present device trust. On success, DP-2 (D1) **returns** the internal `pos_operator` envelope. POS receives and retains the envelope as the durable sale-sync credential; the provider JWT's job ends at sign-in.
- **Hold in the existing seam.** The envelope is held in the same main-process credential holder that today holds the Clerk JWT, keyed on the backend session handle (`backend_session_id`). Secrecy properties are unchanged: main-process only, never crosses the renderer bridge, never logged, never placed in any request body.
- **Present on sale-sync.** The sale-sync client attaches the **envelope** (not the Clerk JWT) as the durable credential on `POST /api/pos/v1/sales`, conforming to the D1/D4 contract for how the envelope is carried. The idempotency key is unchanged (the deterministic `externalId`); dedup is unaffected (it authorizes nothing — 028 §6 idempotency note).
- **Renewal / expiry.** The envelope is bounded and renewable per the D1 contract. POS re-presents a current envelope; on an authorization refusal it re-acquires (per G-5 / §6) rather than dropping the sale. The *mechanism* of renewal (refresh vs re-sign-in) is constrained by OQ-9 and the D1 contract, **not** decided here.
- **Sign-out / takeover.** Ending an operator session clears the held envelope for that session; takeover replaces it with the incoming operator's envelope, consistent with 028 §9 (takeover ends the prior operator's authority on the terminal).

## 5. Device-token role reversion (target, D7)

- **Today (E-2):** one `DEVICE_TOKEN_KEY` secret is the read-down Bearer, the sign-in attestation, **and** the sale-sync `X-Device-Attestation`.
- **Target (CM-2):** once the envelope carries authorization, the device token's role **narrows to device-scoped only**:
  - **Read-down** — `Authorization: Bearer <device_token>` for the device-scoped catalog snapshot pull (unchanged; this is the device token's proper role, 028 G-6).
  - **Device trust at sign-in** — proving *this paired terminal* (unchanged in purpose).
  - **NOT** the durable sale-sync authorization credential — the envelope carries authorization; the device token no longer stands in for operator authority on the sale wire.
- **POS obligation:** stop using the device token as authorization-adjacent weight on `POST /sales`. Whether a device-trust attestation header **still co-travels** with the envelope on the sale wire (defense-in-depth device binding) is a **D1/D4 contract decision POS conforms to** — not unilaterally decided here. The invariant POS must hold either way: a sale-sync request authorized **by the device token alone must be impossible** (028 §18 "Sale-sync with device credential only → Refused").

## 6. Auth-refusal handling under the new credential (target, derived from E-4)

- Current Option-Y tunes `401/403 → transient/retryable` to a ~60s Clerk JWT (E-4). Under the envelope, the credential's lifetime and re-acquisition path change, but the **invariant is preserved**: an authorization refusal on the sale wire is **never** treated as a permanent defect that drops the sale.
- On `401/403`: re-acquire / re-present a current envelope (per the D1 renewal contract) and re-drain the row; keep the sale pending with backoff in the interim. A genuine non-auth contract defect (other `4xx`) remains dead-letterable, as today.
- The engine's operator-token gate (today `getOperatorToken() === null → pause`) becomes an **envelope-present gate**: no current envelope ⟹ pause the drain, resume when one returns — preserving "no unauthenticated POST" with the new credential.

## 7. POS surfaces touched (informational map, not a task list)

| POS surface (`origin/main`) | Today (E-n) | Target after D1 lands |
|---|---|---|
| `sales-sync/create-sale-sync-client.ts` | `Authorization: Bearer <clerk-jwt>` + `X-Device-Attestation` (E-1/E-2) | presents the envelope as the durable credential per D1/D4 contract; device token no longer the sale-sync authorization (D5/D7) |
| `sales-sync/sale-sync-engine.ts` | pauses on `getOperatorToken()===null` (E-3) | pauses on **envelope-absent**; per-operator credential possible (G-6) |
| `operator/sign-in-handler.ts` + `operator/backend-client.ts` | mints/holds Clerk JWT; cashier path `jwt:null` (E-3) | receives + retains the envelope at sign-in; provider JWT confined to sign-in (D5) |
| `operator/jwt-holder` seam | holds the Clerk JWT keyed on `backend_session_id` | holds the **envelope** in the same seam, same secrecy (G-3) |
| `catalogue/read-down/read-down-client.ts` + `index.ts` `getDeviceToken` | device-token Bearer (proper role) | unchanged — this is the device token's retained device-scoped role (D7) |

> No file above is edited by this draft. This is a read-only map to bound the eventual POS slice; it is **not** a tasks list (tasks.md is intentionally absent — GATED depth).

## Acceptance criteria (A-n)

The draft is accepted only if all hold:

- **A-1** It stays in the POS consumer lane — it does **not** define the envelope (D1), the wire scheme (D4), or the offline-PIN re-anchor (D6). *(§3 N-2/N-3/N-5; §1.)*
- **A-2** D5 is specified: the envelope replaces the raw Clerk JWT as the durable client-held sale-sync credential; the provider JWT is sign-in only. *(§4; G-1/G-2; CM-1.)*
- **A-3** D7 is specified: the device token reverts to a pure device-scoped role; never sale-sync authorization alone. *(§5; G-4; CM-2.)*
- **A-4** The envelope is held in the existing main-process seam with unchanged secrecy (main-process only, never bridged/logged/in-body). *(§4; G-3; SR-2/SR-4.)*
- **A-5** Current runtime is recorded as drift (E-1…E-4) with `origin/main` file citations, **distinct** from target and open decisions; no unverified status claimed as fact. *(Evidence basis; SC-09.)*
- **A-6** The cashier-only-cannot-sync gap (E-3) is recorded as the operational driver, **not** asserted resolved; pilot-acceptability carried as an open note. *(E-3; OQ-CARRY.)*
- **A-7** Auth-refusal-never-drops-a-sale (E-4) is preserved under the new credential. *(§6; G-5.)*
- **A-8** Provider-neutrality holds: no Clerk-specific field/scheme/API leaks into the POS sale-sync auth path post-adoption. *(G-7; 028 G-10; D4.)*
- **A-9** G10 is listed among gates and the draft is labeled "gated — requires owner approval + G10 verification before any dispatch." *(header; Dependencies & sequencing.)*
- **A-10** The D1 → D5 → D7 sequencing is recorded against the drift-map DAG. *(Dependencies & sequencing.)*
- **A-11** No implementation, contract, migration, or gate mutation was performed; no plan.md / tasks.md authored (GATED depth). *(N-1; this folder.)*

## Dependencies & sequencing

**Gates (every auth/identity/access-touching spec must list G10):**

- **G10 — Identity & Access Boundary Gate** *(producer: Orchestrator 028)* — REQUIRED. This draft consumes the signed 028 boundary (CM-1, CM-2, SR-2/SR-4, G-10 anti-lock-in). No dispatch until G10 is verified and the owner approves the scoped POS slice.
- **G2 (contract)** and **G3 (migration)** — likely engaged on the **DP-2 (D1)** side when the envelope and its wire scheme are built/published; named here so the POS slice knows its upstream contract gate exists. POS conforms to the resulting contract (D4); POS itself authors no contract or migration.

**Verified drift-map DAG edges that gate this item** (`docs/roadmap/auth-028-drift-map.md`):

- `D1 (DP-2: mint + RETURN the pos_operator envelope at sign-in; closes the phantom guard D2) ──► D5 (POS adopts the envelope)` — **D5 cannot dispatch until D1 builds and returns the envelope.** The provider JWT remains the live sale-sync credential until then (E-1); documenting the envelope client-side before D1 ships would create the very mismatch 028 §19 DOC-3 exists to kill.
- `D5 (POS adopts the envelope) ──► D7 (device token reverts to device-scoped)` — **D7 follows D5**: the device token can only shed its authorization-adjacent role once the envelope is carrying authorization on the sale wire.
- **Adjacent (not a dependency of this draft):** D6 (POS offline-PIN re-anchor) is gated on **D3** *and* needs the D1/D5 envelope to deliver `user_id` to the terminal — referenced, not specified here (N-5).

**Build-order position** (drift-map "Recommended build order"): step 4 — *D5 + D7: POS adopts the envelope; device token reverts to device-scoped* — after step 1 (D3 identity link) and step 2 (D1+D2 mint+return). This draft assumes nothing about D3/D1 being done; it is a **gated** plan-for-later.

## Open questions (OQ-n — carried forward, not auto-decided)

These are genuinely-open 028 boundary questions on the do-not-decide list; they are surfaced for owner decision, not resolved here.

- **OQ-9 (carried from 028).** Whether refresh tokens are ever stored locally by POS. **Directly in this lane:** if the envelope is refreshable, does POS hold a refresh credential locally, and with what secrecy/expiry? This bears on §4 renewal and is **not** decided here — it interacts with the D1 envelope contract.
- **OQ-CARRY (operational, from the drift map).** Is the current "cashier-only terminals cannot sync; sync gated on a manager's JWT" gap (E-3) **acceptable for the pilot**, or must the per-operator envelope (D1/D5) land before pilot? Recorded as an operational open note, not asserted resolved.
- **OQ-D7-WIRE.** Does a device-trust attestation header still co-travel with the envelope on `POST /sales` after D7 (defense-in-depth device binding), or is the envelope sufficient? This is a **D1/D4 contract decision**; POS conforms. Surfaced so the POS slice knows it is pending upstream.
- **Carried 028 OQs not in this lane** (listed for completeness; owned by 028 / other drift items, not decided here): OQ-2 (manager override offline), OQ-3 (PIN complexity / retry-lock), OQ-4 (multi-terminal operator sessions vs forced takeover), OQ-11 (break-glass support access for pilot).

---

> **Docs-only record (SPECIFY-ONLY / DRAFT).** This draft records the POS-side conformance plan for drift items D5 + D7; it does not implement, define contracts, create migrations, or mutate any gate, kernel node, or status file. No implementation is dispatched from it without explicit, scoped owner approval **after** G10 verification and **after** drift D1 (the DP-2 envelope) is built and returned. No plan.md / tasks.md is authored (GATED depth: D5's upstream is not built).
