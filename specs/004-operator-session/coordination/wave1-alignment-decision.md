# §A2 Wave 1 — Backend Alignment Decision Record

**Feature:** [../spec.md](../spec.md) — POS-Pulse 004 (Operator Session)
**Plan:** [../plan.md](../plan.md) (v1.1)
**Coordination:** [../coordination.md](../coordination.md)
**Handoff:** [./a2-backend-handoff.md](./a2-backend-handoff.md)
**Approval Gate:** §A2 (Backend Wave 1 — sign-in / sign-out)
**Status:** ✅ **APPROVED 2026-05-06 by Ahmed — Q1 = Yes, Q2 = (b).
B-1 merged 2026-05-06 (PR #43, SHA `c4ce84a`). PR-0 endpoint
namespace alignment (`/api/pos/v1/...`) in flight on branch
`004-pr0-pos-namespace`. Implementation still gated: do not start
Wave 1 backend code until PR-0 merges, PR-1 follow-on lands, and
B-2 owner go-ahead is given.**
**Created:** 2026-05-06
**Owner:** Ahmed (POS-Pulse + SmartDataPulse-backend, owner-implemented
with ChatGPT/Claude support)

---

## 0. Why this document exists

Before any line of Backend Wave 1 code is written in the SmartDataPulse
backend repo (`Data-Pulse-2`), we discovered **two alignment gaps**
between POS-Pulse 004's contracts and the live backend baseline. Neither
gap is solvable by "just writing the endpoint" — both require an
explicit owner decision because the wrong path silently violates
Principle VIII (Clerk as sole human IdP) or breaks POS-Pulse-side
codegen determinism.

This record captures the gaps, the option space, the recommended path,
and the explicit decision the owner must approve before Wave 1
implementation begins.

---

## 1. Inspection findings

### 1.1 Repo identification

The "SmartDataPulse backend" referenced in POS-Pulse 004 lives at
`C:/Users/user/Documents/GitHub/Data-Pulse-2` (package name
`data-pulse-2`, NestJS 11 + Drizzle + OpenAPI 3.1 monorepo, current
foundation feature `001-foundation-auth-tenant-store`). Branch `main`,
clean working tree, latest commit `3df6024` (audit fanout processor
seam, PR #43). All Wave 1 code lands here.

### 1.2 Existing auth baseline (Data-Pulse-2)

- **In-house password auth** — `apps/api/src/auth/`
  - `auth.controller.ts` exposes 7 endpoints under `/api/v1/auth/*`
    (signin, signout, password reset, email verify, etc.).
  - `auth.service.ts` + `auth.module.ts` orchestrate.
  - `passwords.ts` (in `packages/auth/src/`) — argon2id hashing.
  - `tokens.ts`, `auth-token.repository.ts` — opaque token primitives.
  - `session.repository.ts` + `packages/db/src/schema/sessions.ts` —
    server-side session rows (uuid, user_id, active_tenant_id,
    active_store_id, issued_at, last_seen_at, absolute_expires_at,
    revoked_at, ip_at_issue, user_agent).
  - `auth.guard.ts` — `HttpOnly; SameSite=Lax` cookie named via
    `SESSION_COOKIE_NAME`; `Secure` set in production.
  - `rate-limit.ts` — `RATE_LIMIT_BUCKETS.signInPerAccount` = 5/15min,
    `signInPerIp` = 30/h, etc.
  - `dto.ts` — Zod-validated bodies, surfaced through
    `common/zod-validation.pipe.ts`.

- **No Clerk** anywhere. `grep -ri 'clerk\|Clerk\|CLERK'` against
  `apps/`, `packages/`, and `specs/` returns **zero hits**. There is no
  Clerk SDK dependency, no JWKS verification, no `clerk_user_id`
  column on `users`.

- **No `terminal` / `device_token` / `operator` concepts** in the live
  codebase. (Matches only appear inside archived `.claude/worktrees/*`
  spec drafts, which are not part of the build.)

- **No `branch_id`** anywhere. The tenancy model is `tenants` →
  `stores`, with `sessions.active_store_id` as the per-session active
  store. Memberships are `memberships` (tenant-level) and
  `store_access` (store-level).

- Test convention: Jest + Supertest + Testcontainers; tests live in
  `apps/api/test/<area>/*.spec.ts` mirroring `src/<area>/*.ts`.
  OpenAPI lives in `packages/contracts/openapi/<area>.openapi.yaml`
  and is the **contract of record**.

### 1.3 POS-Pulse 004 contract expectations

From [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md):

- All 004 endpoints assume an **existing 001/002 baseline** that
  includes: terminal `device_token` on every request and operator
  Clerk JWT on operator-attributable calls.
- Sign-in (Endpoint 2) is explicitly **"Authenticate a manager or
  admin via Clerk credentials and mint a session token"**.
- Tenant + branch claims on the Clerk JWT must be validated **against
  the device token's tenant + branch scope**; mismatches return a
  **generic refusal**.
- Per-account / per-IP rate-limit-as-generic-refusal is required
  (NFR-003 / PR-2).
- Server-side redaction of `password` and credential material is
  required (P11).
- Cashier PIN factor introduces **ZERO** new backend endpoints (AD-2).

POS-Pulse Constitution Principle VIII (clarified by v1.5.1, PR #39)
makes this explicit: **Clerk is the sole human IdP**. The local
cashier PIN is the *only* approved local unlock factor and never
crosses the backend boundary. The argon2id binding (§A4) lives in
POS-Pulse only, not Data-Pulse-2.

### 1.4 The two gaps in one sentence each

- **Clerk gap.** POS-Pulse 004 calls out a Clerk-backed identity flow
  that does not yet exist in Data-Pulse-2. Closing the gap requires
  either bringing Clerk into Data-Pulse-2 or placing a thin
  Clerk-aware shim in front of the operator endpoints.
- **`branch` vs `store` gap.** POS-Pulse contracts say `branch_id`;
  Data-Pulse-2 says `store_id` / `active_store_id`. Same concept,
  different word — the OpenAPI surface must pick one direction
  without forcing POS-Pulse planning artifacts to be rewritten.

---

## 2. Option space — Auth alignment

The three options below are the full space. Each is judged against
Principle VIII, §A1, the POS-Pulse 004 contract, and implementation
cost.

### Option 1 — Integrate Clerk into Data-Pulse-2 for the POS-Pulse operator/session endpoints

> Bring Clerk in as the identity verifier for the new
> `/api/pos/v1/operators/*` surface. Existing `/api/v1/auth/*` (in-house
> argon2id) stays as-is and continues to serve the dashboard / admin
> app today.

- **What lands in Data-Pulse-2:**
  - A new `apps/api/src/operators/` module (or `apps/api/src/clerk/`
    + `apps/api/src/operators/`) housing a `ClerkVerifier` that
    validates Clerk JWTs via JWKS (cached, rotated) — **no Clerk
    Backend SDK call on the hot path** unless we explicitly want
    server-side session attestation. JWKS verification is enough for
    Wave 1 (sign-in mints / extends a Clerk session; sign-out
    revokes the corresponding server-side operator-session row).
  - Environment: `CLERK_ISSUER`, `CLERK_JWKS_URL`,
    `CLERK_AUDIENCE`. (Secret is the Clerk Backend API key only if
    we adopt SDK-based session attestation in a later wave.)
  - Three new tables or extensions, scoped to the POS-Pulse domain:
    `operator_identities` (links a Clerk user_id to a Data-Pulse-2
    `tenant_id` + `store_id` + role), `operator_sessions`
    (uuid, operator_id, terminal_id, branch/store, issued_at,
    last_seen_at, end_cause, ended_at), and a
    `terminals` / `device_tokens` table or alias of an existing
    pairing artifact from POS-Pulse 002.
  - A new OpenAPI file
    `packages/contracts/openapi/operators.openapi.yaml` describing
    Endpoints 1–6. Wave 1 only ships the sign-in + sign-out paths
    (Endpoints 2 + 3); the others go into the file as
    `[deferred to Wave 2/3/4]` placeholders or are added per-wave.
  - The existing `users` / `memberships` tables are **not retrofit**
    — operator identity is its own table that **may** reference
    `tenants` / `stores` for FK integrity.

- **Pros:**
  - Single backend repo continues to own all platform concerns;
    POS-Pulse continues to consume one OpenAPI source of truth.
  - Honours Principle VIII directly.
  - Honours §A1 (cashier PIN remains local-only; backend never sees
    it). No conflict with PR #39 Constitution v1.5.1.
  - JWKS verification is small and well-bounded (~150 LoC + tests).

- **Cons:**
  - Adds a Clerk dependency to a backend that currently has none.
  - Adds two parallel auth surfaces (`/api/v1/auth/*` for the
    dashboard; `/api/pos/v1/operators/*` for POS-Pulse). They must not
    cross-pollinate session cookies / tokens.
  - Slight ambiguity about whether `users` and
    `operator_identities` should ever be merged later.

- **Risk:** Low–medium. The two surfaces are cleanly separable.
  Codegen on POS-Pulse side is unaffected because we control the
  OpenAPI shape.

### Option 2 — Internal auth for legacy/admin only; Clerk identity required at the POS-Pulse operator endpoints

> Effectively **the same as Option 1**, with the explicit framing
> that the in-house auth surface is on a deprecation glide-path for
> the admin/dashboard product; the new POS-Pulse surface uses Clerk
> from day one.

- **Difference vs Option 1:** Option 2 adds an architectural
  intent-statement: "internal argon2id is legacy". Option 1 is silent
  on legacy status.

- **Pros:** Same as Option 1 + explicit forward direction for the
  admin/dashboard product later.

- **Cons:** Same as Option 1 + commits to an admin-app migration that
  is **out of scope** for POS-Pulse 004. We should not commit to a
  Clerk migration of the dashboard product as a side-effect of POS
  work.

- **Risk:** Same as Option 1, plus scope creep risk if
  "deprecate internal auth" is read as a blocker on Wave 1.

### Option 3 — Use internal auth for POS-Pulse too (NOT RECOMMENDED)

> Reuse `/api/v1/auth/signin` for managers/admins from the POS
> terminal, replacing "Clerk JWT" with the existing session cookie or
> bearer token.

- **Why this is not recommended:**
  1. **Violates Principle VIII** — POS-Pulse Constitution v1.5.1
     names Clerk as the sole human IdP. Picking this option would
     require a constitutional amendment (a much bigger gate than
     §A2).
  2. **Violates the §A1 clearance posture.** §A1 was cleared on
     2026-05-05 (PR #39, SHA `7ae337b`) on the basis that the
     **cashier PIN is the only local unlock factor** and that
     manager/admin sign-in flows through Clerk. Reverting that
     premise re-opens §A1.
  3. **Breaks the takeover model.** FR-004 / FR-013 / Endpoint 4
     all require a stable, cross-terminal `operator_id` with
     known-tenant + known-branch claims; Clerk provides this
     out-of-the-box. The internal auth surface today does not have
     a stable cross-terminal operator id distinct from session id.
  4. **Forces re-spec.** Every contract document under
     `specs/004-operator-session/contracts/` would need to be
     rewritten and re-reviewed; PR #39 + PR #41 + PR #42 lose their
     load-bearing claims.

- **Use only if:** Clerk procurement is impossible on the timeline
  the user wants — in which case POS-Pulse 004 itself stops and
  re-enters planning.

---

## 3. Recommended path

> **Option 1 — Integrate Clerk into Data-Pulse-2 for the POS-Pulse
> operator/session endpoints, scoped narrowly to the new
> `/api/pos/v1/operators/*` surface.**

Rationale:
- It's the only option that honours Principle VIII + §A1 without
  re-opening already-cleared gates.
- The implementation surface is small (~ a JWKS verifier, a
  per-request guard, three tables, one new OpenAPI file). Wave 1
  itself only needs **Endpoint 2 (sign-in) + Endpoint 3 (sign-out)**;
  the JWKS verifier is the load-bearing reusable primitive.
- It preserves the dashboard product's existing in-house auth
  exactly as it is today. No migration, no breakage, no scope creep.
- It gives POS-Pulse codegen a stable target — the OpenAPI surface is
  authored to match the shapes already documented in
  [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md).

What this **does not** commit us to:
- ❌ Migrating the dashboard product to Clerk.
- ❌ Merging `users` and `operator_identities`.
- ❌ Replacing in-house argon2id auth in any other surface.
- ❌ Introducing the Clerk Backend SDK (we plan to use **JWKS verify
  only** for Wave 1; SDK adoption is a later, separate decision).
- ❌ Touching POS-Pulse 004 contracts. The POS-Pulse surface stays
  exactly as documented.

---

## 4. Required backend model / API implications (Option 1)

These are the implications the owner is signing off on by approving
this record. Each row is **scoped to Wave 1 unless otherwise noted**.

### 4.1 Operator identity

- **New column / table:** `operator_identities`
  - `id` (uuid, pk) — internal id.
  - `clerk_user_id` (text, unique, indexed) — stable identifier from
    Clerk; this is the value POS-Pulse 004 contracts call
    `operator.id`.
  - `tenant_id` (uuid, fk → `tenants.id`).
  - `store_id` (uuid, fk → `stores.id`) — internal name; surfaced as
    `branch_id` in the OpenAPI (see §5).
  - `role` (enum: `manager`, `admin`, `cashier`).
  - `display_name` (text) — short string for terminal UI.
  - `disabled_at` (timestamptz, nullable) — generic refusal driver.
  - `created_at`, `updated_at`.
- **Why a separate table** (not a column on `users`): Clerk users are
  conceptually disjoint from in-house dashboard users; coupling the
  two now creates a migration headache later if we ever merge them.

### 4.2 Manager/admin role mapping

- The `operator_identities.role` column is the **authoritative**
  role for the POS-Pulse domain. It is **not** sourced from the
  Clerk JWT's `public_metadata`/`org_role` — we keep role as
  server-side data and let Clerk own only **identity**.
- Provisioning operator identities is **out of scope for Wave 1**.
  Wave 1 assumes an admin tool / SQL seed has already populated
  `operator_identities` for at least one manager and one admin per
  test branch. Provisioning UX is a later wave or a separate admin
  module — explicitly **not** §A2's concern.

### 4.3 Clerk verification mechanism

- **Wave 1 uses JWKS verification only** — pull the JWKS document
  from `CLERK_JWKS_URL`, cache it (Nest `CacheModule` or an internal
  in-process cache with a 10-minute TTL and on-fail re-fetch), verify
  the JWT signature, validate `iss` (`CLERK_ISSUER`), `aud` (if we
  scope an audience), `exp`, `nbf`, and basic claims.
- **No Clerk Backend SDK calls** on the hot path. The SDK is not
  added as a dependency in Wave 1.
- The JWKS verifier is a small NestJS provider, e.g.
  `apps/api/src/operators/clerk.verifier.ts`, with a corresponding
  `clerk.verifier.spec.ts` using `jose` (already a transitive
  dependency or a small additive one) for verification.
- `apps/api/src/operators/operators.guard.ts` uses the verifier to
  attach the verified Clerk claims (`sub`, `iss`) to the request
  object. The guard **also** requires the device-token header (see
  §4.4) on every operator endpoint.

### 4.4 Tenant / store-as-branch validation against device token

- The 002 terminal-pairing artifact in the POS-Pulse repo
  ([`specs/002-terminal-pairing/`](../../002-terminal-pairing/))
  defines a `device_token` issued at pairing time, scoped to a
  `tenant_id` + `branch_id`. The backend equivalent must exist in
  Data-Pulse-2 before any Wave 1 endpoint can run, **but it does not
  yet**.
- **Decision:** Wave 1 ships a minimal `terminals` table +
  `device-token.guard.ts` in Data-Pulse-2. Schema:
  - `terminals` (`id` uuid pk, `tenant_id` fk, `store_id` fk,
    `display_name`, `pairing_code_hash`, `device_token_hash`,
    `paired_at`, `revoked_at`).
- The guard order on every `/api/pos/v1/operators/*` endpoint is:
  1. **Device-token guard** — verify the terminal's `device_token`,
     resolve `tenant_id` + `store_id`, attach to request.
  2. **Operators guard** — verify the Clerk JWT (Endpoints 3+),
     attach Clerk claims.
  3. **Scope guard** — assert `clerk_user_id` resolves to an
     `operator_identities` row whose `tenant_id` + `store_id` match
     the device token. Mismatch → **generic refusal**.
- Endpoint 2 (sign-in) does **not** yet have a Clerk JWT on the
  request (it's about to mint one); only step 1 + a
  resolve-by-credentials step apply. See §6.

### 4.5 Generic refusal preservation

- All four failure causes — wrong password, account disabled,
  account does not exist, tenant/branch mismatch, rate-limited —
  return the **same** error envelope shape, with the same status
  family. Diagnostic detail is logged server-side only.
- The platform exception filter
  (`apps/api/src/common/exception.filter.ts`) already enforces
  uniform envelopes (FR-ISO-4 — "401 / 404 / 403 share the envelope
  shape"). Wave 1 reuses this filter.
- **Server logs** include the rejection reason; **HTTP responses do
  not**. The user-facing body distinguishes only at the level of
  "rate_limited" vs "refused" (and only because POS-Pulse needs to
  render a different message).

---

## 5. `branch` ↔ `store` decision

- **External (POS-Pulse-facing OpenAPI):** field name is `branch_id`.
  This matches POS-Pulse 004 planning artifacts unchanged.
- **Internal (Data-Pulse-2 DB + service code):** column / variable
  name is `store_id`, mapped 1:1 to `branch_id` at the DTO / OpenAPI
  boundary.
- **Mapping site:** the request DTO (Zod schema) accepts `branch_id`
  and the response DTO emits `branch_id`; the service layer
  immediately translates to `store_id` and uses the existing
  `stores` table for FK integrity.
- **Why not rename POS-Pulse contracts to `store_id`:** POS-Pulse
  planning artifacts are merged (PRs #38, #39, #40, #41, #42).
  Rewriting them is a separate gate (§A2 amendment), and there's no
  technical benefit — the mapping is cheap and lives in exactly one
  place per endpoint.
- **Why not rename Data-Pulse-2's `stores` to `branches`:** that's a
  cross-cutting rename touching tenants/memberships/sessions/audit;
  way out of Wave 1's scope. Defer indefinitely.

The mapping is documented in the OpenAPI file via a doc comment on
each `branch_id` field: `// stored internally as store_id; semantically
identical`.

---

## 6. Impact on Wave 1 endpoints

> Wave 1 is **`POST /api/pos/v1/operators/sign-in`** and
> **`POST /api/pos/v1/operators/sign-out`** only.

### 6.1 `POST /api/pos/v1/operators/sign-in`

- **Request (per POS-Pulse contract):** `{ kind: "manager_admin",
  identifier, password, device_token_attestation }`.
- **The "Clerk credentials" framing in the contract has two
  plausible readings**, and the owner must pick one:
  - **(a)** Backend itself talks to Clerk via the Backend SDK to
    sign the user in (sign-in-by-credentials flow).
  - **(b)** The terminal talks to Clerk directly via the Clerk
    Frontend / public APIs, obtains a Clerk session JWT, and posts
    that JWT to the backend, which verifies via JWKS and creates an
    `operator_session` row.
- **Recommended reading:** **(b)**.
  - It avoids embedding Clerk Backend SDK + Clerk secret key in
    Data-Pulse-2 in Wave 1.
  - It matches the standard Clerk integration pattern (frontend
    holds the credentials; backend never sees the password).
  - It honours **P11 redaction** (the request body the backend sees
    no longer contains a `password` field at all in path (b) — the
    contract's `password` field is replaced by a Clerk JWT in the
    Authorization header).
  - It does **mean** POS-Pulse contract document needs a small
    revision: the request body in (b) is `{ kind: "manager_admin",
    device_token_attestation }` with the Clerk JWT in `Authorization:
    Bearer <jwt>`. **This is a flagged contract delta** — see §10
    risk row.
- **Alternative** if the owner prefers reading (a): POS-Pulse
  contract stays as written; Data-Pulse-2 takes a Clerk Backend SDK
  dependency in Wave 1 and stores the Clerk secret. Larger surface,
  larger secret-management burden.
- **Response shape** as per contract: `{ kind: "signed_in", operator:
  { id, display_name, role, tenant_id, branch_id }, clerk_session_token
  }`. In path (b), `clerk_session_token` is the JWT the terminal
  already has — the backend can echo it (or omit, since the terminal
  holds it). Suggest **omit** in (b) and update the contract to make
  the field optional.
- **Takeover-required path** (`{ kind: "takeover_required" }`): out of
  Wave 1 scope. Sign-in returning takeover_required is the moment we
  detect "operator already has an active session in this branch on a
  different terminal" — but the **takeover-confirm endpoint
  (Endpoint 4)** is Wave 3. Wave 1 sign-in **MAY** still detect the
  condition and return `takeover_required`, but the actual takeover
  flow is unimplemented; the terminal will surface a "not yet
  available" message. Or Wave 1 can defer detection too and always
  succeed/refuse — the owner picks. **Recommendation:** detect and
  return `takeover_required`, even though the confirm endpoint isn't
  ready, so Wave 3 doesn't have to revisit Wave 1 code.

### 6.2 `POST /api/pos/v1/operators/sign-out`

- **Request (per contract):** `{ session_id }`. The session id is the
  uuid the backend issued at sign-in (in the `operator_sessions`
  table).
- **Validation:** device-token guard + Clerk JWT guard + scope guard.
  The `session_id` must belong to the terminal's tenant + store **and**
  to the Clerk-verified operator. Mismatch → generic refusal.
- **Action:** mark `operator_sessions.ended_at = now()`,
  `end_cause = 'sign_out'`. **No** audit event from this endpoint
  (audit events flow through Endpoint 5, Wave 2).
- **Response:** `{ kind: "signed_out" }`.
- **Best-effort semantics on the client side** (FR-008 / NFR-007 —
  terminal proceeds to local sign-out even if the backend call
  fails) are a POS-Pulse concern. The backend's job is to be
  idempotent: sign-out on an already-ended session returns
  `signed_out` without error.

### 6.3 Out of Wave 1

- ❌ Roster (Endpoint 1) — Wave 3.
- ❌ Takeover confirm (Endpoint 4) — Wave 3.
- ❌ Audit events (Endpoint 5) — Wave 2.
- ❌ Active-session probe (Endpoint 6) — Wave 3.
- ❌ Cashier PIN — never on the backend by design (AD-2).
- ❌ Forced shift close audit category — Wave 4.
- ❌ Sales / cart / payments — out of 004 entirely.

---

## 7. Files likely affected later (Wave 1 only)

> **Indicative.** No code is written until §A2 Wave 1 is approved.
> No file is touched by this decision record itself.

### Data-Pulse-2 — code
- `apps/api/src/operators/operators.module.ts` (new)
- `apps/api/src/operators/operators.controller.ts` (new — sign-in,
  sign-out only)
- `apps/api/src/operators/operators.service.ts` (new)
- `apps/api/src/operators/operator-session.repository.ts` (new)
- `apps/api/src/operators/operator-identity.repository.ts` (new)
- `apps/api/src/operators/clerk.verifier.ts` (new)
- `apps/api/src/operators/operators.guard.ts` (new)
- `apps/api/src/operators/device-token.guard.ts` (new)
- `apps/api/src/operators/dto.ts` (new — Zod schemas;
  `branch_id ↔ store_id` mapping)
- `apps/api/src/operators/rate-limit.ts` (new — reusing the existing
  `RATE_LIMIT_BUCKETS` pattern)
- `apps/api/src/app.module.ts` (modified — register
  `OperatorsModule`)
- `apps/api/src/main.ts` — only if a new Helmet/CORS allowance is
  needed for the POS terminal origin (likely none in Wave 1).

### Data-Pulse-2 — DB
- `packages/db/src/schema/operator_identities.ts` (new)
- `packages/db/src/schema/operator_sessions.ts` (new)
- `packages/db/src/schema/terminals.ts` (new)
- `packages/db/drizzle/0001_operators_wave1.sql` (new — forward)
- `packages/db/drizzle/0001_operators_wave1.down.sql` (new — rollback)
- `packages/db/src/schema/index.ts` (modified — re-export new tables)

### Data-Pulse-2 — contracts
- `packages/contracts/openapi/operators.openapi.yaml` (new — Wave 1
  defines Endpoint 2 + Endpoint 3 only; Endpoints 1 / 4 / 5 / 6 are
  added in their respective waves)
- `apps/api/src/openapi/` (modified — load the new file alongside
  existing ones)

### Data-Pulse-2 — tests (Jest + Supertest)
- `apps/api/test/operators/operators.controller.spec.ts` (new)
- `apps/api/test/operators/operators.service.spec.ts` (new)
- `apps/api/test/operators/operator-session.repository.spec.ts` (new)
- `apps/api/test/operators/operator-identity.repository.spec.ts` (new)
- `apps/api/test/operators/clerk.verifier.spec.ts` (new)
- `apps/api/test/operators/operators.guard.spec.ts` (new)
- `apps/api/test/operators/device-token.guard.spec.ts` (new)
- `apps/api/test/operators/sign-in-flow.e2e.spec.ts` (new — happy
  path + generic-refusal cases + rate-limit case)
- `apps/api/test/operators/sign-out-flow.e2e.spec.ts` (new)

### Data-Pulse-2 — env / config
- `.env.example` (modified — `CLERK_ISSUER`, `CLERK_JWKS_URL`,
  `CLERK_AUDIENCE`)
- `apps/api/src/config/` (whatever config-loading shape the repo
  already uses) — extended with Clerk env shape.

### POS-Pulse — affected after Wave 1 ships in Data-Pulse-2
- `scripts/openapi-snapshot.json` — regenerated after the new
  Data-Pulse-2 OpenAPI is merged.
- `src/shared/api-types.ts` — regenerated by `npm run codegen:api`.
- **No** POS-Pulse implementation code is touched as part of Wave 1.
  POS-Pulse S1 only starts after Wave 1 is implemented or explicitly
  approved as available (per coordination.md).

---

## 8. Decision needed before code

The owner must answer **two** questions and approve in writing on
this document (a one-line append at the bottom is sufficient):

> **Q1.** Can Data-Pulse-2 adopt **Clerk JWKS verification** for the
> `/api/pos/v1/operators/*` surface in Wave 1?
> ◯ Yes — proceed with Option 1 as described.
> ◯ No — stop and return to POS-Pulse planning. The contract must
>   either (a) be revised to explicitly use Data-Pulse-2 internal
>   auth, which re-opens §A1 and Principle VIII (Option 3 path), or
>   (b) defer Wave 1 until Clerk procurement is ready.

> **Q2.** Which sign-in flow reading do we adopt?
> ◯ **(b) — Recommended.** Frontend (POS terminal) holds Clerk
>   credentials, posts a Clerk JWT to the backend; backend verifies
>   via JWKS only. Requires a small POS-Pulse contract revision
>   (sign-in body no longer carries `password`; Clerk JWT moves to
>   `Authorization` header). The contract revision lands as a
>   POS-Pulse PR with a one-line update to
>   [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
>   under §A2's umbrella, **before** Wave 1 backend code starts.
> ◯ **(a)** Backend talks to Clerk Backend SDK with the user's
>   password; POS-Pulse contract stays as written, but the
>   Data-Pulse-2 surface gains a Clerk Backend SDK dependency and
>   the Clerk secret. No POS-Pulse contract revision needed.

If **Q1 = Yes** and **Q2 = (b)**: proceed to author the POS-Pulse
contract revision PR first, then Wave 1 backend in Data-Pulse-2.

If **Q1 = Yes** and **Q2 = (a)**: proceed to Wave 1 backend
immediately; no POS-Pulse contract revision needed.

If **Q1 = No**: **stop**. Return to POS-Pulse planning.

---

## 9. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Clerk procurement / configuration not ready in time | M | H | Decide Q1 before any Wave 1 code; if no, defer Wave 1 cleanly. |
| R2 | Path (b) contract revision is rejected on POS-Pulse side | L | M | Land the revision PR first; Wave 1 backend code waits behind it. The revision is small (Authorization header + optional `clerk_session_token`). |
| R3 | `branch ↔ store` mapping leaks (e.g., a JSON path returns `store_id`) | L | M | Single-site mapping in DTO + OpenAPI; covered by controller tests asserting the exact response shape per the contract. |
| R4 | `terminals` table grows in scope (POS-Pulse 002 has its own pairing artifact) | M | M | Wave 1 ships the **minimum** `terminals` shape needed for `device_token` verification. Full pairing flow (002's subject) is its own backend wave, not Wave 1. |
| R5 | Operator identity provisioning is unsolved | M | M | Wave 1 assumes seeded operator_identities. Provisioning UX is explicitly out of scope; flagged here for owner awareness. |
| R6 | Sign-in returns `takeover_required` but Endpoint 4 isn't built | L | L | Either implement detection in Wave 1 (recommended) and let the terminal show "not yet available", or defer detection; explicit owner choice in §6.1. |
| R7 | Rate-limit policy for the operator surface is invented from scratch | L | L | Reuse the existing `RATE_LIMIT_BUCKETS.signInPerAccount` shape (5 / 15min) for `operatorSignInPerOperator`; document in `rate-limit.ts`. |
| R8 | Server-side log redaction misses a credential field | L | H | Add an explicit redaction list to the operators logger context: `password`, `device_token_attestation`, `Authorization`. Covered by a logging interceptor spec. |
| R9 | JWKS rotation outage | L | M | Cache JWKS for 10min, fail-closed on a fetch failure to a generic refusal, alert in observability (existing pino + OpenTelemetry hooks). |
| R10 | The `_reference/Data-Pulse/` legacy is consulted and code is copy-pasted (Constitution Principle IX violation) | L | H | Re-derive everything; this document explicitly forbids it. |

---

## 10. Constraints (no implementation until approved)

- 🚫 **Do not modify any source file** — `apps/api/src/`,
  `packages/auth/src/`, `packages/db/src/`, `packages/contracts/`.
- 🚫 **Do not change DB schema** — no new Drizzle schema files, no
  new SQL migrations.
- 🚫 **Do not change any OpenAPI YAML.**
- 🚫 **Do not start Wave 1 implementation** until Q1 + Q2 are
  answered on this document.
- 🚫 **Do not touch POS-Pulse source.** POS-Pulse S1 stays blocked.
- 🚫 **Do not start cashier PIN, roster, takeover, audit-events,
  active-session, forced close, sales/cart/payments.** Those are
  later waves or out of 004 entirely.
- 🚫 **Do not weaken auth or redaction.** Generic refusals stay
  generic; logs continue to redact credentials and
  `Authorization` headers.

---

## 11. Approval

> **This decision record is the §A2 Wave 1 alignment gate.**
>
> **Approved 2026-05-06 by Ahmed.** The recorded answers below are
> binding for Wave 1; downstream artifacts (POS-Pulse contract
> revision PR, Data-Pulse-2 Wave 1 implementation PR) inherit them.

- **Q1 answer (Clerk JWKS adoption for `/api/pos/v1/operators/*`):**
  ✅ **Yes.** Data-Pulse-2 will adopt Clerk JWKS verification now for
  the POS-Pulse-facing `/api/pos/v1/operators/*` surface. JWKS-only
  verification (no Clerk Backend SDK in Wave 1).
- **Q2 answer (sign-in flow reading (a) or (b)):**
  ✅ **(b) — POS-Pulse holds the Clerk JWT; Data-Pulse-2 verifies via
  JWKS.** Data-Pulse-2 MUST NOT receive or handle the user's Clerk
  password on this flow. The POS terminal completes the
  Clerk-credential exchange and posts the resulting Clerk JWT in the
  request `Authorization` header.
- **Date approved:** 2026-05-06.
- **Approver:** Ahmed (POS-Pulse + SmartDataPulse-backend, single
  owner under §A2 owner-implemented mode).
- **Follow-up artifact (Q2 = (b)):** POS-Pulse contract revision
  PR — _opened on branch `004-b1-sign-in-clerk-jwt`_ (this PR).
  Updates [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
  Endpoint 2 to: drop `password` / `identifier` from the request
  body, move the Clerk JWT to `Authorization: Bearer <jwt>`,
  document the server-side validation order
  (device-token → Clerk JWKS → operator identity → role → tenant /
  branch → takeover detection), replace the
  `clerk_session_token` response field with
  `operator_session.{id, issued_at}` (the terminal already holds the
  JWT it sent), and reaffirm that **the cashier PIN MUST NEVER be
  sent to Data-Pulse-2**. The Conventions block at the top of the
  contract is also tightened to reflect path (b). PR # recorded in
  `coordination.md` once opened. **Wave 1 backend code MUST NOT
  begin until this revision PR lands.**

### 11.1 Recorded constraints from this approval (binding)

The owner explicitly recorded the following alongside the Q1 / Q2
answers; they are binding for Wave 1 and any later wave that touches
the same surface:

1. **Dashboard / internal Data-Pulse-2 auth may remain temporarily on
   the existing argon2id + cookie-session stack.** Wave 1 does not
   migrate `/api/v1/auth/*`. Any future migration is its own
   decision, separate from §A2.
2. **POS-Pulse-facing operator/session endpoints (`/api/pos/v1/operators/*`)
   MUST use Clerk-backed identity.** No exceptions; do not silently
   fall back to internal auth on these routes.
3. **A stable `clerk_user_id` mapping MUST be added** — modelled in
   the new `operator_identities` table per §4.1. `clerk_user_id` is
   the value POS-Pulse 004 contracts call `operator.id`; it is
   indexed and unique.
4. **Keep `branch_id` in POS-Pulse-facing DTOs and OpenAPI**; map
   internally to Data-Pulse-2's `store_id` / `active_store_id` at the
   DTO boundary. No POS-Pulse contract rename; no Data-Pulse-2
   `stores` rename.
5. **Cashier PIN remains local-only and MUST NEVER be sent to
   Data-Pulse-2.** AD-2 + §A1 (Constitution v1.5.1) remain in force.
   Any code change that would have a PIN-shaped value cross the
   backend boundary is a stop-the-line defect.

### 11.2 Active blockers before Wave 1 implementation

Implementation is **still paused**. The two preconditions before any
Wave 1 backend code is written in `Data-Pulse-2`:

- **B-1.** POS-Pulse contract revision PR for path (b) is **opened
  and merged** on POS-Pulse `main`. The PR updates Endpoint 2's
  request shape (no `password`; Clerk JWT in `Authorization`) and
  marks the response `clerk_session_token` as optional. Until that
  PR merges, the contract of record still says path (a), and Wave 1
  code would diverge from the POS-Pulse contract.
- **B-2.** Owner explicitly opens Wave 1 implementation (separate
  authorization beyond this decision record) — at that point a Wave
  1 implementation plan is generated against the revised contract.

---

**End of §A2 Wave 1 alignment decision record.** Approved
2026-05-06 (Q1 = Yes, Q2 = (b)). Implementation remains paused
behind B-1 + B-2.
