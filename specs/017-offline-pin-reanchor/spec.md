# Draft D6 — POS Offline-PIN Re-Anchor off a DP-2 Provider-Neutral Identifier

> **✅ IMPLEMENTED & MERGED 2026-06-14 (PR #401, migration `0036`).** OQ-D6-1 collapsed → direct rebuild, no transition window. See [UNBLOCK-PLAN.md](./UNBLOCK-PLAN.md) Step 3 and [security-review/s-reanchor-review.md](./security-review/s-reanchor-review.md) for the as-built design. The body below is retained as history; the blocker/gate narrative it describes is now resolved.

> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

**Status:** ~~DESIGN-READY, IMPLEMENTATION-BLOCKED — gate-1 (`user_id`-delivery) SATISFIED; G10 SATISFIED (per kernel); sole remaining blocker = owner Queue dispatch of POS-017.~~ **SUPERSEDED — see banner above.** Re-blocked on cashier-scoped `user_id` delivery; full current status in [`BLOCKER.md`](./BLOCKER.md) rev. 3 + [`UNBLOCK-PLAN.md`](./UNBLOCK-PLAN.md). **Date:** 2026-06-11. **Last Updated:** 2026-06-13. **Owning repo:** POS-Pulse. **Deciders:** Owner (Ahmed Shaaban).

> **DOUBLE-GATE status (updated 2026-06-13 rev. 2 — reconciled to the Orchestrator kernel; see [./BLOCKER.md](./BLOCKER.md) for the gate-by-gate detail).** **Gate 1 — `user_id` delivered + consumed: ✅ SATISFIED.** DP-2 033 (`c5e1c5d`) surfaced the provider-neutral §16 `user_id` (= `users.id`) as an additive `required` `uuid` field on the `PosOperatorSummary` response (every `signed_in` path incl. takeover replay; a readable sibling of `id`, not in the envelope); POS-Pulse consumed it via #389 (`75f5e6d`) — `interpretSignInResponse` now reads `op.user_id`. The historical concern (the `<user_id source>` field not existing on the POS wire) is **resolved**. **Gate 2 — boundary (G10) + owner dispatch: G10 ✅ SATISFIED, dispatch ❌ REMAINING.** The Orchestrator kernel G10 node is `satisfied-for-boundary-decisions` — the satisfied state for all consumers (ORCH-028 #85 merged, OQ-1/5/6/7/8/10 signed); there is **no `ratified` state** in this kernel, so the earlier "not yet ratified" wording was a POS-017-local overstatement, now corrected. The **sole remaining blocker is the owner's decision to dispatch POS-017 as a Queue Item** (the heaviest 028-drift item: a SQLite `cashier_pin_records` PK-rebuild). Implementation starts only after that dispatch; until then no migration SQL is authored and `cashier_pin_records` is untouched. All 20 tasks reclassified `[BLOCKED: g10-dispatch]` → `[BLOCKED: owner-dispatch]`. The PIN-locality invariant (E-4: `pin_hash`/`pin_salt` never leave the device) and the E-1..E-4 citations below are unchanged.

**Relation to 028:** This realizes the **§5 "POS offline unlock" authority row** + **§16 provider-independence / anti-lock-in** target by re-anchoring the POS-local offline-PIN store off the DP-2-owned provider-neutral identity link (§16 `user_id`) instead of the provider-coupled `cashier_clerk_user_id`. 028 owns the auth/identity boundary this conforms to; this is a downstream follow-up that **CONSUMES gate G10**, it does not re-specify 028.

> ### Authoring & placement notes (owner can redirect)
>
> - **Docs-only.** Authored as planning prose at `specs/017-offline-pin-reanchor/` (the draft was relocated/renumbered to 017 under the POS-Pulse `specs/` tree). It dispatches nothing and mutates no kernel state.
> - **No `.specify/` tooling exists in this repo.** This was authored as a draft following the Spec-Kit structure (sections, success-criteria discipline, `[NEEDS CLARIFICATION]` resolved into the Clarifications section), mirroring the house style of the Orchestrator-owned `028-project-auth-identity-access-boundary/spec.md`. No feature branch was created; no template was copied; no file outside this draft folder (`spec.md` + `checklists/requirements.md`) was touched.
> - **This feeds a future Queue Item under G10, not a kernel mutation.** D6 becomes a POS-Pulse Queue Item only with explicit, scoped owner approval after G10 verification. It is **DOUBLE-GATED**: it cannot start until its DAG upstreams (D3, and the D1/D5 envelope) are built. **Update (2026-06-13):** `plan.md` and `tasks.md` are now authored as **DESIGN-READY, IMPLEMENTATION-BLOCKED** artifacts (the ready-to-execute plan for when the upstream lands) — every implementation task is `[BLOCKED: user_id-delivery]`. This is **not** speculative implementation: no code, migration SQL, or contract is authored; `cashier_pin_records` is untouched; the pipeline STOPS at `/speckit-tasks`. Implementation remains blocked because the §16 `user_id` is still not delivered to the terminal (a NEW DP-2 slice is required) and G10 is not yet ratified.

---

## Clarifications

### Session 2026-06-11

- Q: Which DP-2-published provider-neutral identifier does the offline-PIN store re-anchor onto — the §16 `subject`, or the §16 `user_id`? → A: **the §16 `user_id`** — 028 §16 maps `(provider_key, issuer, subject) → user_id`; `subject` ≈ today's `clerk_user_id` and is still provider-coupled, so anchoring on `subject` would not remove the lock-in. The durable provider-neutral key is the DP-2 `user_id`. `clerk_user_id` is retained as a **bridge column** behind it (mirrors 028 §16 / OQ-6's bridge-column pattern), not as the PK component.
- Q: Is D3 (the neutral identity link existing in DP-2) sufficient on its own to re-anchor the POS PIN store? → A: **No — D3 is necessary but not sufficient.** The offline-PIN store is POS-local; the neutral `user_id` must be *delivered to the terminal* before it can be written into a local PK. Today the cashier offline path receives no backend-issued credential (E-3). So D6 also depends on **D1** (DP-2 mints+returns the operator-authorization envelope carrying `user_id`) **and D5** (POS adopts/carries that envelope). This is the **NEW EDGE** the drift-map synthesis under-modeled (drift-map DAG, line "D6 also needs D1/D5 to deliver user_id to the terminal").
- Q: Does re-anchoring change the PIN-locality invariant — does any PIN/hash now leave the device, or does the store now talk to the backend? → A: **No.** Re-anchoring changes only the *key column*; the Argon2id `pin_hash`/`pin_salt` still never leave the device (028 CM-4 / SR-1; drift-map "Explicitly NOT drift" PIN row). The neutral `user_id` arrives as **data** via the §6 cached operator grant / operator-authorization envelope at online sign-in — never by syncing the PIN store upward.
- Q: Must already-enrolled cashiers re-enroll their PIN (set it again) when the store re-keys? → A: **No, not as the target.** A blind forced PIN re-enrollment would break offline unlock for cashiers who are already enrolled — the precise failure this spec must avoid (A-4). The neutral `user_id` for each enrolled cashier is obtained online and the key is migrated without losing the local PIN material. The exact transition mechanism (backfill-on-reconnect vs dual-key window vs re-enrollment-as-fallback) is **plan-phase** and carried as **OQ-D6-1**, not decided here.
- Q: Is the PK re-key the heaviest part of this item, and does it stay at spec altitude here? → A: **Yes and yes.** Re-keying a NOT-NULL component of a composite PRIMARY KEY on an *offline records* table is the heaviest POS-side item in the 028 drift set. In SQLite the PK cannot be altered in place — it requires a table rebuild — so the schema-migration weight is recorded here as a constraint + acceptance criterion (§4, §6, A-n), while the migration *step sequence* is deferred to the owning repo's `plan.md`/`tasks.md` post-dispatch.

---

## Evidence basis (verified this session, `origin/main`, 2026-06-11)

| Repo | `origin/main` HEAD | What was read |
|---|---|---|
| POS-Pulse | `b34932b` (substantive #379) / `0bb2ed8` (badge `[skip ci]` on top) | `migrations/0006_cashier_pin_records.sql`; `src/main/operator/pin-credential.ts`; `src/main/operator/pin-lockout.ts`; `src/main/operator/sign-in-handler.ts`; `src/main/operator/jwt-holder.ts` (all from feature `004-operator-session`) |
| Data-Pulse-2 | `6588e86` (badge `[skip ci]`) / `0c57fed` (substantive #544) | `git log --oneline -3 origin/main` only: confirmed HEAD; #544 is a docs/reconcile of the POS auth-boundary draft — it does **not** introduce the §16 identity link in code, consistent with **D3 being unbuilt / gated**. No DP-2 source file was read this session; D6 consumes D3's output, it does not author it. |
| Retail-Tower-Orchestrator | `main` (clean) | `docs/specs/028-…/spec.md` (§5/§6/§9/§10/§16); `docs/roadmap/auth-028-drift-map.md` (D6 row + DAG); `docs/gates/cross-repo-gates.md` (G10) |

Current-runtime facts (kept distinct from *target* and *open decisions*):

- **E-1 (the PK is provider-coupled at the schema level).** `migrations/0006_cashier_pin_records.sql` (POS `origin/main` `b34932b`, feature 004) defines `cashier_pin_records` with `PRIMARY KEY (tenant_id, branch_id, terminal_id, cashier_clerk_user_id)` and `cashier_clerk_user_id TEXT NOT NULL`. The covering index `idx_cashier_pin_records_cashier` is on the **same four-column tuple**. The provider identifier is therefore baked into the table's identity, not merely a lookup column — re-anchoring is **schema-deep**.
- **E-2 (the whole offline-PIN code path keys on `cashier_clerk_user_id`).** In `src/main/operator/pin-lockout.ts` the `PinScope` interface and the `rowMatchesScope` PR-4 guard are defined over `{tenant_id, branch_id, terminal_id, cashier_clerk_user_id}`. In `src/main/operator/sign-in-handler.ts` the `CashierSignInHandler` SELECTs the sealed row `WHERE … cashier_clerk_user_id = ?`, and `persistLockoutState` UPDATEs the lockout columns `WHERE … cashier_clerk_user_id = ?`. The provider identifier flows end-to-end through the local sign-in/lockout path, not just the DDL.
- **E-3 (the offline cashier path receives NO backend-delivered identifier today — the double-gate proof).** In `src/main/operator/sign-in-handler.ts`, `CashierSignInRequest` takes `cashier_clerk_user_id` as a **caller-supplied input**, and on success the cashier session is created with `backend_session_id: ''` and the proto-session is set with `jwt: null` (the cashier PIN path is local-only — "AD-2: cashier PIN path is local-only; backend_session_id is empty"). The manager/admin path holds the provider JWT in main-process memory only (`jwt-holder.ts`), never crossing to the renderer and never on the cashier offline path. **Conclusion:** the terminal has no backend-issued credential on the offline path from which a provider-neutral `user_id` could be sourced. Until **D1** mints+returns an operator-authorization envelope carrying `user_id` and **D5** makes POS carry it, the neutral key has nowhere to come from — which is why D6 is gated on D1/D5 in addition to D3 (the drift-map "NEW EDGE").
- **E-4 (PIN material is already device-local and provider-agnostic).** `src/main/operator/pin-credential.ts` verifies the PIN with Argon2id entirely in-process ("the PIN value cannot reach pino or any other log surface from this module"); `pin_hash`/`pin_salt` are sealed (DPAPI on Windows) and never leave the device. The PIN secret is **not** what couples to the provider — only the *key column* is. Re-anchoring touches the key, not the secret (target-relevant: re-anchoring does not weaken SR-1/CM-4).

---

## 1. Summary

The POS offline-PIN store (`cashier_pin_records`, POS feature 004) is the local credential a cashier uses to unlock a paired terminal offline. It is keyed on `cashier_clerk_user_id` — a NOT-NULL component of the table's composite **PRIMARY KEY** (E-1) and the join key threaded through the entire local sign-in/lockout path (E-2). This is the deepest form of provider lock-in in the 028 drift set: the external provider's identifier is part of the *schema identity* of an offline records table.

This draft specifies **re-anchoring that store off a DP-2-published provider-neutral identifier** — the 028 §16 `user_id` — so that POS offline unlock no longer embeds `clerk_user_id` (or any provider-specific id) in its primary key. The PIN secret itself does not change and never leaves the device (E-4); only the *identity column* the record is keyed by changes. The neutral `user_id` reaches the terminal as data inside the DP-2 operator-authorization envelope at online sign-in (the D1/D5 upstreams), and `clerk_user_id` is demoted to a bridge column behind it.

This is the **heaviest POS-side item** in the drift set because the change is a primary-key re-key on offline records: SQLite cannot alter a PK in place, the covering index keys on the same tuple, existing rows are keyed on the old (provider) identifier, and the neutral `user_id` for already-enrolled cashiers can only be obtained online. The spec records the schema weight as constraints and acceptance criteria at spec altitude; the migration *step sequence* and the transition strategy are deliberately left to the owning repo's plan/tasks post-dispatch (and one OQ).

It is **DOUBLE-GATED**: G10 (the auth/identity boundary must be signed) *and* the DAG upstreams D3 (neutral link exists in DP-2) + D1/D5 (the envelope actually delivers `user_id` to the terminal). It is SPECIFY+CLARIFY only.

## 2. Goals

- **G-1.** Re-anchor the offline-PIN store so its durable identity is the DP-2 **provider-neutral `user_id`** (028 §16), not the provider-coupled `cashier_clerk_user_id`.
- **G-2.** Preserve the **PIN-locality invariant**: the PIN/`pin_hash`/`pin_salt` continue to never leave the device, and the store never calls a backend API (028 CM-4 / SR-1). Re-anchoring changes the key column only (E-4).
- **G-3.** Demote `clerk_user_id` to a **bridge column** behind the neutral `user_id` (mirrors 028 §16 / OQ-6), preserving any provider-side correlation needed during the bridge period without it being the PK.
- **G-4.** Re-anchor **without breaking offline unlock for already-enrolled cashiers** and **without forcing blind PIN re-enrollment** — with a defined, auditable degradation path when no neutral mapping has yet arrived.
- **G-5.** Re-key the composite **PRIMARY KEY** and the covering index on `cashier_pin_records` correctly under SQLite (table-rebuild semantics), keeping tenant/branch/terminal scope and the PR-3 lockout state intact.
- **G-6.** Keep the change **provider-migration-safe** (028 §16 / G-10 of 028): a future provider switch must not require re-keying this store again — anchoring on `user_id` is the point.

## 3. Non-goals

- **N-1.** No code, migration SQL, OpenAPI/YAML, package, lockfile, CI, generated-file, runtime-config, secret, env, or deployment changes in this task. (Orchestrator is docs-only; this is SPECIFY-ONLY / DRAFT.)
- **N-2.** **No PIN material leaves the device.** Re-anchoring must not introduce any sync of `pin_hash`/`pin_salt`/PIN to the backend (E-4; 028 CM-4 / SR-1). The store remains POS-local.
- **N-3.** No backend dependency for the PIN *verification* path. Verification stays Argon2id-in-process; only the *identifier provisioning* depends on the online envelope.
- **N-4.** No change to PIN complexity, retry-lock, or lockout policy here (those are 028 OQ-3 / OQ-D6, carried forward).
- **N-5.** No re-specification of D3 (the DP-2 identity link), D1 (the DP-2 envelope), or D5 (POS envelope adoption). D6 consumes their outputs; it does not author them.
- **N-6.** No decision on the migration *transition mechanism* (backfill / dual-key / re-enrollment-fallback) — that is plan-phase (OQ-D6-1).
- **N-7.** No assertion that any upstream (D3/D1/D5) is built. Their status is "needs verification / gated"; this draft is written *against the target shape*, not against shipped upstreams (SC-09 discipline).

## Architecture boundary (restated, non-negotiable)

```text
POS-Pulse → Data-Pulse-2 → Retail-Tower-ERP-Next-Connector → ERPNext/Frappe
```

- The provider-neutral `user_id` is **owned and published by Data-Pulse-2** (028 §16). POS consumes it; POS never derives or mints identity. No direct POS → ERPNext path is introduced.
- The neutral identifier reaches POS only via Data-Pulse-2 (sanctioned path), carried in the operator-authorization envelope. POS may reach the provider's *frontend/identity* surface for sign-in authn only — never for identity resolution that the §16 link now owns.

## 4. The schema seam (`cashier_pin_records` — current vs target)

**Current (E-1, POS `origin/main` `b34932b`):**

| Aspect | Current shape |
|---|---|
| Table | `cashier_pin_records` (offline records, local SQLite) |
| Primary key | `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)` — all NOT NULL |
| Provider coupling | `cashier_clerk_user_id TEXT NOT NULL` is a **PK component** |
| Covering index | `idx_cashier_pin_records_cashier` on the **same four-column tuple** |
| Secret columns | `pin_hash BLOB`, `pin_salt BLOB` (sealed, device-local) |
| Lockout state | `failed_attempt_count`, `lockout_until` |

**Target shape (this spec):**

- The PK's operator-identity component becomes the DP-2 **provider-neutral `user_id`** (028 §16). The tenant/branch/terminal scope is unchanged.
- `clerk_user_id` is **retained as a non-key bridge column** (G-3), nullable/optional during the bridge period, removable when the bridge is retired (a later, separate decision — not in scope here).
- The covering index re-keys to the new tuple in lockstep with the PK.
- The PIN secret columns and lockout state are **preserved verbatim** — no re-hash, no re-enrollment of the secret (G-4 / N-2).

**Why this is heavy (the central design problem, at spec altitude):**

- **SQLite cannot alter a PRIMARY KEY in place.** Re-keying requires a *table rebuild* — create a new table with the target PK, copy rows, drop the old table, rename — plus rebuilding `idx_cashier_pin_records_cashier`. This is a destructive-shaped local migration on an offline records table.
- **Existing rows are keyed on the old (provider) identifier.** Each enrolled cashier's row carries `cashier_clerk_user_id`; the corresponding neutral `user_id` must be **obtained online** (from the §16 link via the D1/D5 envelope) before the old key can be dropped. Because the neutral key can only arrive online while the store is offline-first, *any* admissible transition strategy implies a **bounded transition window** in which already-enrolled rows still carry only the old (bridge) key and have not yet acquired a neutral one. *(auto-resolved: §4 must not pre-commit the specific mechanism — backfill-on-reconnect vs dual-key vs re-enrollment-fallback — which is OQ-D6-1 / N-6 plan-phase; only the existence of a transition window is spec-owned and deterministic here.)*
- **The terminal may be offline at migration time.** A cashier already enrolled may need to unlock offline before any neutral `user_id` has arrived — the migration must not strand them (G-4).

## 5. Identifier-provisioning seam (where `user_id` comes from)

- The neutral `user_id` is **not** queryable by POS on its own (no direct identity API; the §16 link is DP-2-owned). It arrives as **data** on the online path:
  - At **online sign-in**, the DP-2 operator-authorization envelope (D1, adopted by POS in D5) carries the operator's `user_id` (the §16 `user_id`) alongside the existing identity proof.
  - POS records `user_id` into the local cached operator grant (028 §6 "Local cached operator profile / offline grant" row) at sign-in time — **once the D1/D5 envelope is extended to carry `user_id`**; until then the grant has no neutral key to record (this seam is inert until D1+D5 land, below).
  - The offline-PIN store keys/migrates rows from that grant — never from a fresh backend call (which would be impossible offline anyway).
- **Cashier-path gap (E-3) is the reason for the D1/D5 gate.** Today the cashier offline path holds no backend-issued credential and supplies `cashier_clerk_user_id` as a caller input; there is no `user_id` to key on until the envelope delivers it. This seam is **inert until D1+D5 land** — D6 cannot be implemented before them even with D3 present.

## 6. Lifecycle & behavior (target)

- **Enrollment (online).** A cashier's PIN can only be set after online verification (028 §10). At that point the envelope carries `user_id`; the new/enrolled row is keyed on `user_id`, with `clerk_user_id` written to the bridge column.
- **Re-anchor of an existing enrolled cashier (transition).** On a subsequent online sign-in, POS reads `user_id` from the envelope and migrates the existing `clerk_user_id`-keyed row to a `user_id`-keyed row, preserving `pin_hash`/`pin_salt`/lockout state. The exact mechanism (in-place backfill of a neutral column then PK rebuild, vs dual-key transitional period, vs re-enrollment fallback) is **OQ-D6-1** (plan-phase).
- **Offline unlock during the bridge.** A row already migrated unlocks on `user_id`. A not-yet-migrated row (no neutral key yet) continues to unlock on the bridge `clerk_user_id` until its first post-change online sign-in supplies `user_id` — i.e. **safe degradation, never a hard lockout** (G-4). The bounded offline grace (028 §10, default 24h) is unchanged.
- **PR-4 scope guard + PR-3 lockout.** The `rowMatchesScope` guard (PR-4) and the `verifyPinWithWindow` lockout state machine (PR-3) (E-2) re-key their identity comparison to `user_id` once a row is migrated; tenant/branch/terminal scope is unchanged. Lockout counters/`lockout_until` are preserved across the re-key.
- **Audit.** Any re-key/migration of an offline-PIN record emits a **local** audit event (synced later, 028 SR-8), recording the scope and the fact of the re-anchor — **never** the PIN, hash, salt, or raw token (028 SR-2 / N-9). Provider-side correlation, if needed, uses the bridge column, not a logged secret.

## 7. Provider-migration safety (anti-lock-in)

- Anchoring on the DP-2 `user_id` (not `subject`, not `clerk_user_id`) means a **future provider switch (Clerk → Auth0/Keycloak/OIDC) does not re-key this store again** (028 §16 / OQ-7). The provider change is absorbed by the DP-2 adapter + identity link; the POS offline-PIN PK is already provider-neutral. This is the structural payoff of D6 and the reason `subject` is rejected as the anchor (Clarifications).

## Acceptance criteria (A-n)

- **A-1.** The offline-PIN store's durable identity (PK + covering index) is the DP-2 **provider-neutral `user_id`** (028 §16); no provider-specific identifier remains a PK component. *(G-1, §4.)*
- **A-2.** No PIN/`pin_hash`/`pin_salt`/PIN value leaves the device, and the store makes no backend call for verification; re-anchoring touches the key column only. *(G-2, N-2/N-3, E-4.)*
- **A-3.** `clerk_user_id` survives as a **non-key bridge column** (not a PK component) and is retired only by a later, separate decision. *(G-3, §4.)*
- **A-4.** Offline unlock for **already-enrolled cashiers is not broken** by the re-key, and **no blind forced PIN re-enrollment** is imposed; a cashier with no neutral mapping yet degrades safely (continues on the bridge key, never hard-locked). *(G-4, §6.)*
- **A-5.** The composite **PK and covering index** are re-keyed correctly under SQLite table-rebuild semantics, preserving tenant/branch/terminal scope, PIN secret columns, and PR-3 lockout state. *(G-5, §4, §6.)*
- **A-6.** A future provider switch does **not** require re-keying this store again. *(G-6, §7.)*
- **A-7.** Every offline-PIN re-key/migration emits a local, later-synced audit event with no secret/token/PIN/hash in it. *(§6; 028 SR-2/SR-8.)*
- **A-8.** No implementation, migration SQL, contract, or gate mutation is produced by this draft. *(N-1; SPECIFY-ONLY.)*

## Dependencies & sequencing (drift-map DAG edges that gate this item)

D6 is **DOUBLE-GATED** — a process gate plus DAG upstreams:

- **Gate G10 (Identity & Access Boundary Gate).** This spec touches identity/offline-access, so it lists **G10** and is labeled *gated — requires owner approval + G10 verification before any dispatch*. G10's producer is Orchestrator 028; D6 consumes the §5/§6/§16 boundary and the signed §22 decisions (OQ-6/OQ-7/OQ-8). G10 must be ratified before implementation.
- **DAG edge `D3 → D6` (VERIFIED).** The DP-2 provider-neutral identity link + `IdentityProviderPort` (028 §16) must **exist** so a neutral `user_id` is a real, published value. *(drift-map "Verified dependency DAG": `D3 ──► D6`.)*
- **DAG edge `D1/D5 → D6` (the NEW EDGE the synthesis under-modeled).** D3 alone is insufficient: the neutral `user_id` must be **delivered to the terminal**. That delivery is **D1** (DP-2 mints+returns the operator-authorization envelope carrying `user_id`, closing the D2 phantom guard in the same slice) and **D5** (POS adopts/carries the envelope). E-3 is the empirical proof — the cashier offline path holds no backend-issued credential today (`backend_session_id: ''`, `jwt: null`, `cashier_clerk_user_id` supplied by the caller), so there is no `user_id` source until D1+D5 land. *(drift-map: "D6 also needs D1/D5 to deliver user_id to the terminal — synthesis under-modeled this".)*
- **Recommended build order (drift-map):** D3 → (D1+D2) → D4 ∥ → (D5+D7) → **D6** → D8 → (D9+D10) → D11. D6 sits at step 5, after the envelope spine, before Console provider-auth.
- **Producer-exclusion respected:** D6 does not produce G10 (028 does); it does not author D3/D1/D5. Implementation may not begin until G10 is signed **and** D3 + the D1/D5 envelope are verified built on the relevant `origin/main`.

## Open questions (OQ-n)

Carried forward from 028 (genuinely open — not auto-decided here):

- **OQ-2 (028).** Whether manager override is allowed offline (and for what — PIN reset, supervised sync). Relevant because an offline manager-supervised PIN reset would also need a neutral-key target.
- **OQ-3 (028).** PIN complexity and retry-lock policy. Untouched by the re-anchor (N-4) but governs the same store.
- **OQ-4 (028).** Multi-terminal operator sessions vs forced takeover.
- **OQ-9 (028).** Whether refresh tokens are ever stored locally by POS (bears on what the cached grant may hold alongside `user_id`).
- **OQ-11 (028).** Whether break-glass support access is required for the pilot.

New, D6-specific (plan-phase — to be resolved in the owning repo's plan/tasks, not here):

- **OQ-D6-1 (transition mechanism).** The migration/transition strategy for existing rows: backfill-on-reconnect of a neutral column then PK rebuild, vs a dual-key transitional period, vs re-enrollment as a bounded fallback. Each has different offline-window and rebuild-safety trade-offs. **Decision deferred to plan-phase** because it depends on the precise envelope shape D1/D5 deliver (which is itself plan-phase for those items).
- **OQ-D6-2 (bridge-column retirement).** When and how `clerk_user_id` is dropped from `cashier_pin_records` after the bridge period — a later, separate migration, gated on the broader §16 bridge retirement.

---

> **Docs-only record (SPECIFY-ONLY / DRAFT).** This draft records the target re-anchor and the verified gating; it does not implement, define contracts, author migration SQL, or mutate any gate or kernel state. No implementation is dispatched from it without explicit, scoped owner approval after **G10** is verified and the **D3** and **D1/D5** upstreams are confirmed built on `origin/main`.
