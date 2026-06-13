> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# Implementation Plan: POS Offline-PIN Re-Anchor off a DP-2 Provider-Neutral Identifier (drift D6)

**Feature ID:** 017-offline-pin-reanchor
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-06-13
**Last Updated:** 2026-06-13
**Constitution version pinned:** v1.5.1

---

## STATUS: DESIGN-READY, IMPLEMENTATION-BLOCKED

This plan is **design-complete** and **implementation-blocked**. The SQLite primary-key re-key (create new table keyed on the provider-neutral `user_id`, copy rows preserving `pin_hash`/`pin_salt`/lockout, drop + rename, rebuild the covering index, demote `clerk_user_id` to a nullable bridge column) is fully specified at spec altitude and is ready to execute the moment the upstream lands. **No implementation may begin until the blocker below clears.** This plan authors **no migration SQL**, touches **no source file**, and does **not** mutate `cashier_pin_records`.

### The blocker (verified this session on DP-2 `origin/main`)

**DP-2 delivers the Clerk subject (`clerk_user_id`) to the terminal, never the provider-neutral `user_id`.** 017 re-keys the offline-PIN store onto the 028 §16 `user_id` — but that field does not exist on any POS-facing wire today. Concretely:

- The shipped DP-2 `PosOperatorSessionSummary` carries only `{ id, issued_at, envelope }`. The `envelope` is an **opaque bearer string** (no parseable claims). The `id` field is documented repeatedly as the **Clerk SUBJECT** (`users.clerk_user_id`) — "for identity continuity across POS endpoints."
- A grep of **all** POS-facing contracts (`pos-operators`, `auth`, `pos-shifts`, `pos-audit-events`, `pos-terminal-pairing`, `vouchers`) returns **zero** `user_id`.
- The DP-2 `IdentityProviderPort` (`identity-provider.port.ts`) resolves `external_identity_links` **server-side only**; callers see `VerifiedSubject.subject` (= `clerk_user_id` today), never the neutral `user_id`.
- D3's `external_identity_links` table exists server-internally (DP-2 #550), but its **provisioning is DEFERRED** (029 wave-status: `linkExternalIdentity` has no live runtime caller; post-migration users get `user_unmapped → 401`), **and** the neutral `user_id` is not surfaced on any POS-facing response.
- **016 (D5) shipped and is MERGED**, but it delivers the **opaque envelope + the `clerk_user_id` `id`**, NOT `user_id`. (Confirmed in `sign-in-handler.ts`: the `envelopeHolder` seam carries the opaque `pos_operator` envelope; the `jwtHolder` seam carries the Clerk provider JWT. Neither exposes a neutral `user_id` to the local store.)

**Consequence:** 017 cannot be implemented because re-keying the PK onto `user_id` means building against a field that does not exist on the POS wire. 017 requires a **NEW upstream DP-2 slice** that surfaces `user_id` on a POS-facing sign-in / envelope response **before any implementation can begin**. This is the drift-map "NEW EDGE" — D6 needs D1/D5 to **deliver `user_id` to the terminal** — now empirically confirmed UNMET. (Spec evidence E-3 is the proof: the cashier offline path holds no backend-issued credential today — `backend_session_id: ''`, `jwt: null`, `cashier_clerk_user_id` is a caller-supplied input.)

### Per owner instruction

Run plan / tasks / analyze (valuable — it produces the ready-to-execute plan for when the upstream lands), but **DO NOT IMPLEMENT; STOP at tasks with a clear, documented blocker.** Do NOT build against a non-existent field. Do NOT author migration SQL or touch `cashier_pin_records`. Every implementation step in Phase 2 below is annotated **[BLOCKED: user_id-delivery]**.

### Double-gate posture (unchanged from spec)

D6 is **DOUBLE-GATED**: process gate **G10** (Identity & Access Boundary) + DAG upstreams.

- **G10** = *satisfied-for-boundary-decisions* (the §5/§6/§16 boundary and §22 OQ-6/OQ-7/OQ-8 decisions are signed enough to anchor on `user_id`). G10 must still be **ratified** before implementation dispatch.
- **DAG upstreams are NOT all met.** `D3 → D6`: the server-side `external_identity_links` table exists (DP-2 #550) but (a) provisioning is deferred, (b) `user_id` is not delivered to the terminal. `D1/D5 → D6` (the NEW EDGE): the envelope must carry `user_id` on a POS-facing response and POS must record it — **UNMET**. This is the binding blocker above.

---

## Technical Context

The change is a **primary-key re-anchor on an offline records table** under SQLite. The operator-identity component of `cashier_pin_records`'s composite PK moves from the provider-coupled `cashier_clerk_user_id` to the DP-2-published **provider-neutral `user_id`** (028 §16). The PIN secret never moves; **only the key column changes** (spec E-4, A-2). `clerk_user_id` is demoted to a **nullable bridge column** (G-3, A-3). SQLite cannot alter a PRIMARY KEY in place, so the re-key is a **table-rebuild** (create-new → copy → drop-old → rename) with a lockstep covering-index rebuild — the heaviest design element in the 028 drift set.

| Area | Choice | Source |
|:--|:--|:--|
| Anchor identifier | DP-2 **provider-neutral `user_id`** (028 §16) — **NOT** `subject`, **NOT** `clerk_user_id` | spec Clarifications (2026-06-11) / 028 §16 |
| Bridge column | `clerk_user_id` retained as a **nullable, non-key** column; retired by a later, separate decision | spec G-3 / A-3 / OQ-D6-2 |
| Table touched | `cashier_pin_records` (offline records, local SQLite, feature 004) | `migrations/0006_cashier_pin_records.sql` (E-1) |
| Current PK | `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)` — all `NOT NULL` | `0006_cashier_pin_records.sql` line 26 |
| Target PK | `(tenant_id, branch_id, terminal_id, user_id)` — all `NOT NULL`; tenant/branch/terminal scope unchanged | spec §4 (target) |
| Covering index | `idx_cashier_pin_records_cashier` re-keys to the target tuple in lockstep with the PK | `0006` line 30 (E-1) |
| PK-alter mechanism | SQLite **table-rebuild** (create-new keyed on `user_id` → `INSERT…SELECT` copy → `DROP` old → `RENAME` → rebuild index). SQLite cannot alter a PK in place. | spec §4 ("Why this is heavy") / SQLite-migration-safety checklist |
| Secret columns | `pin_hash BLOB`, `pin_salt BLOB` (sealed via `safeStorage`/DPAPI) — **preserved verbatim**, no re-hash, no re-seal, no re-enrollment | `pin-credential.ts` / spec E-4 / A-2 |
| Lockout state | `failed_attempt_count`, `lockout_until` — preserved across the re-key (PR-3) | `pin-lockout.ts` / spec §6 / A-5 |
| Scope guard | `rowMatchesScope` (PR-4) + `verifyPinWithWindow` (PR-3) re-key their identity comparison from `cashier_clerk_user_id` to `user_id` once a row is migrated | `pin-lockout.ts` (E-2) / spec §6 |
| Local sign-in path | `CashierSignInHandler` `SELECT … WHERE … cashier_clerk_user_id = ?` + `persistLockoutState` `UPDATE … WHERE … cashier_clerk_user_id = ?` re-key to `user_id` | `sign-in-handler.ts` (E-2) |
| Identifier provisioning | `user_id` arrives as **data** in the DP-2 operator-authorization envelope at online sign-in (D1), recorded by POS into the cached operator grant (D5). **Seam is inert until the envelope carries `user_id`.** | spec §5 / **BLOCKER** |
| DB engine | `better-sqlite3` (production), `sql.js` fallback in tests; WAL + pragmas applied by the migration runner | constitution Tech Stack / migration-safety checklist |
| Verification path | Argon2id **in-process**; no backend call for PIN verification — unchanged | `pin-credential.ts` / spec N-3 |
| **NEEDS CLARIFICATION** | **OQ-D6-1** (transition mechanism: backfill-on-reconnect vs dual-key window vs re-enrollment fallback) — **NOT decided here**; now also gated on the envelope's `user_id`-delivery shape | spec OQ-D6-1 / Phase 0 |
| **NEEDS CLARIFICATION** | **OQ-D6-2** (bridge-column retirement: when/how `clerk_user_id` is dropped) — **NOT decided here** | spec OQ-D6-2 |

## Constitution Check (Initial)

For each constitution principle and constraint, **PASS / WAIVED / VIOLATION**. A VIOLATION blocks progress. No WAIVED entries are taken — every principle is satisfiable by the design as authored.

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | PASS | The store stays POS-local and offline-first; the PK re-key is local. The envelope delivers `user_id` as **data** at online sign-in only; offline unlock never blocks on it. Already-enrolled cashiers degrade safely on the bridge key (never hard-locked) until a neutral key arrives (G-4 / §6). |
| II. Financial Precision | PASS | No money columns touched. `cashier_pin_records` carries no monetary value. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | PASS | **DESIGN constraint.** No IPC/bridge/main-process change is authored in this pass. The migration is **designed**, not written; the migration runner and `migrations/` are untouched. The PK-rebuild safety items (below) are recorded as design constraints, **not executed**. When implemented, the migration is owned by this feature and receives explicit security review (P8). |
| IV. Hardware Loud, Not Silent | PASS | No hardware surface. N/A. |
| V. Type Safety End-to-End | PASS | **DESIGN constraint.** The re-keyed row types (`PinScope`, `CashierPinDbRow`, `PinRow`) gain a `user_id` field and demote `cashier_clerk_user_id` to optional/bridge in `strict` mode. No hand-typed backend types; `user_id` will arrive via the generated envelope type once the upstream surfaces it. |
| VI. Test-First, Coverage-Gated | PASS | **DESIGN constraint.** When unblocked, the re-key lands test-first (RED→GREEN): migration-rebuild test, copy-fidelity test (hash/salt/lockout preserved), scope-guard re-key test, offline-degradation test, audit-no-secret test. ≥ 80% on new code; the PIN path already sits in the high-coverage operator module. No code is written in this pass, so no coverage is claimed. |
| VII. Observability | PASS | Re-key/migration emits a **local** audit event with scope + fact only — never PIN/hash/salt/token (spec §6 / A-7; SR-2/SR-8). No new secret-bearing log site. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | **PASS — ADVANCED** | The re-anchor **strengthens VIII**: it removes provider lock-in by anchoring the local unlock factor on the provider-neutral `user_id` instead of the Clerk-coupled `clerk_user_id`. All six local-unlock-factor rules continue to hold — Clerk remains the sole human IdP (the neutral link is DP-2-owned, derived from Clerk identity), the PIN stays a local unlock factor, mints no backend token, is never a backend credential, the store holds only terminal-scoped hashed material + lockout + stable user reference + audit metadata, and audit identity stays stable (now the *more* durable neutral `user_id`). Rule 5's "stable Clerk user references" is satisfied **more** strongly by a provider-neutral reference. |
| IX. Reference, Not Inheritance | PASS | No `_reference/Data-Pulse/` copy-paste; the design is re-derived against current `0006`/operator-module structure. |
| Platform Integration | PASS | No new remote host. `user_id` arrives via the sanctioned POS → DP-2 path (the operator-authorization envelope), never via a direct POS → ERPNext path or a POS-minted identity. |
| Security | PASS | Secret-sealing **unchanged**: `pin_hash`/`pin_salt` stay sealed via `safeStorage`/DPAPI, copied verbatim, never re-hashed or surfaced. `safeStorage.isEncryptionAvailable()` startup guard unaffected. |
| Hardware Matrix | PASS | No hardware change. N/A. |
| Domain — Pharmacy POS | PASS | Tenant/branch/terminal scope preserved (P17). No domain entity redefined. |
| P1 Financial Correctness First | PASS | No money surface; correctness here = not stranding an enrolled cashier (G-4). |
| P2 No Fake Success States | PASS | Offline unlock success stays backed by a real local Argon2id verify against a durable row; the re-key never fabricates a "migrated" state. |
| P3 No Silent Data Loss | PASS | **DESIGN constraint.** The table-rebuild copies every row's hash/salt/lockout before drop; transactional, crash-safe, idempotent (rebuild semantics below). No enrolled cashier silently loses their PIN row. |
| P4 Auditability / Non-Destructive | PASS | The re-key is a one-time schema rebuild, not a money-bearing mutation; it emits a local audit event (A-7). `clerk_user_id` survives as a bridge column for correlation (not deleted). |
| P5 Idempotency | PASS | **DESIGN constraint.** The migration is idempotent (re-run on an already-migrated DB is a no-op); the transition (per OQ-D6-1) records `user_id` from the envelope deterministically per `(scope, clerk_user_id)`. |
| P6 No Raw Cardholder Data | PASS | No card data anywhere near this store. N/A. |
| P7 Secrets Never Reach Renderer/Logs | PASS | `user_id` is a non-secret identifier; the PIN/hash/salt/token never reach renderer or logs. Audit events carry scope + fact only. |
| P8 Electron Security Boundary | PASS | **DESIGN constraint.** The migration + any future bridge/IPC touch is owned by this feature and gets explicit security review when implemented. Nothing smuggled in this pass — no `src/preload/`, `src/main/`, `bridge-api.ts`, or `migrations/` file is touched. |
| P9 Truthful Offline/Degraded States | PASS | A not-yet-migrated row truthfully unlocks on the bridge key; no UI implies a re-anchor occurred before it has. |
| P10 Operator Accountability | PASS | Operator audit identity stays Clerk-backed and stable (VIII rule 6), now via the neutral `user_id`. |
| P11 Supportability w/o Secret Leakage | PASS | Re-key audit event is useful (scope + fact) and redacted (no secret). |
| P12 Spec Kit Source of Truth | PASS | This plan is derived from `spec.md`; no design drifts from a non-Spec-Kit source. |
| P13 Small, Scoped PRs | PASS | **DESIGN constraint.** When unblocked, the work decomposes into small task-scoped PRs (migration, repo re-key, handler re-key, transition, audit, UI degradation). No PR is opened in this pass. |
| P14 Accessibility / Ergonomics | PASS | No new cashier-critical UI path; the offline-unlock keyboard path is unchanged. |
| P15 Production Readiness Gates | PASS | **Deferred to rollout (§A5-equivalent).** This is a production-affecting store (cashier login/offline unlock); the runbook/rollback/failure-mode/perf items are authored at rollout time, gated on the upstream landing. Recorded, not yet satisfied. |
| P16 Feature Scope Discipline | PASS | Touches only the operator/offline-unlock domain it owns; authors no upstream (D3/D1/D5) and re-specs nothing (N-5). |
| P17 Privacy / Tenant Isolation | PASS | `tenant_id`/`branch_id`/`terminal_id` remain `NOT NULL` PK components; scope unchanged. |
| P18 Local Durability Before Offline Promises | PASS | The PIN store's local durability is unchanged; the re-key preserves it (P3 design constraint). |

**Initial gate result: PASS (no VIOLATION, no WAIVED).** The design is constitutionally clean. Three principles (III, VI, P3/P5/P8/P13) are marked **DESIGN constraint** because they are satisfied *as a design* in this pass and *executed* only when the blocker clears.

## Phase 0 — Research

See [./research.md](./research.md) *(authored at plan-execution time; sketched here)*. Phase 0 resolves the open items and documents approach + alternatives + rationale.

**R-1 — The SQLite PK-rebuild approach (design-complete).** SQLite cannot `ALTER` a PRIMARY KEY in place. Re-keying requires the canonical four-step table-rebuild: create a new table with the target PK `(tenant_id, branch_id, terminal_id, user_id)`, copy rows via `INSERT…SELECT` preserving `pin_hash`/`pin_salt`/`failed_attempt_count`/`lockout_until`/`created_at`/`created_by_operator_id`, `DROP` the old table, `RENAME` the new one, then rebuild `idx_cashier_pin_records_cashier` on the target tuple. The whole sequence is wrapped in one transaction under WAL (migration-runner-managed), idempotent on re-run, and crash-safe (re-attempt on next startup). **Alternatives considered:** (a) add a `user_id` column without re-keying — rejected, leaves the provider id in the PK so the lock-in survives (defeats G-1/G-6); (b) `PRAGMA writable_schema` hack to edit the PK in place — rejected, fragile and unsupported. **Decision: full table-rebuild.** This is design-only here; **no SQL is authored** (the migration file is **not** written this pass — N-1, depth-guard A-8).

**R-2 — The `user_id`-delivery dependency (THE BLOCKER).** The neutral `user_id` is not queryable by POS (no direct identity API; the §16 link is DP-2-owned and resolved server-side only). It can only arrive as **data** in the operator-authorization envelope at online sign-in. Today the shipped envelope is opaque and the only delivered identifier is the Clerk subject (`clerk_user_id`) on the `PosOperatorSessionSummary.id` field; **zero** POS contracts carry `user_id`. Therefore D6's identifier-provisioning seam (spec §5) is **inert** until a **NEW DP-2 slice** surfaces `user_id` on a POS-facing response and POS records it into the cached operator grant. **This dependency is the gating blocker; it is upstream DP-2 work, not POS work.** Until it lands, no neutral key exists to write into the PK.

**R-3 — OQ-D6-1 transition-mechanism options (NOT decided).** Three admissible strategies for migrating already-enrolled rows, each with different offline-window / rebuild-safety trade-offs:
- **(i) Backfill-on-reconnect + PK rebuild** — add a nullable `user_id` column, backfill it from the envelope on the cashier's first post-change online sign-in, then rebuild the PK once enough rows carry a neutral key. Cleanest end-state; longest transition window.
- **(ii) Dual-key transitional period** — the store transiently accepts a match on *either* `user_id` (if present) or the bridge `clerk_user_id`, until all rows are migrated, then drops the bridge from the key. Shortest cashier-visible disruption; most transitional complexity.
- **(iii) Re-enrollment as a bounded fallback** — for rows that never acquire a neutral key within a window, fall back to a supervised re-enrollment. Simplest code; risks the A-4 failure (must remain a *bounded fallback*, never the default — a blind forced re-enrollment is prohibited).

The choice **depends on the precise envelope shape D1/D5 deliver** (itself unbuilt), so it is left **OPEN as OQ-D6-1** and must be decided in `/speckit-tasks` / a follow-up plan revision once the upstream envelope is real. **No mechanism is pre-committed here** (the spec's §4 auto-resolution fixed only the *existence* of a bounded transition window, not the mechanism).

**Open NEEDS CLARIFICATION carried into Phase 0:** OQ-D6-1 (above), OQ-D6-2 (bridge-column retirement), and the carried 028 OQs (OQ-2 offline manager override, OQ-3 PIN complexity/retry-lock, OQ-4 multi-terminal sessions, OQ-9 local refresh-token storage, OQ-11 break-glass). None decided.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md) *(authored at plan-execution time)*
- **Contracts:** [./contracts/](./contracts/) — **none authored by POS** (N-1; POS authors no contract in this pass; the `user_id`-bearing envelope contract is DP-2-owned upstream work).
- **Quickstart (developer path):** [./quickstart.md](./quickstart.md) *(authored at plan-execution time)*

**The full re-key design at spec altitude (design-complete — ready to execute the moment `user_id` is delivered):**

1. **Target table.** `cashier_pin_records` keyed on `(tenant_id, branch_id, terminal_id, user_id)`, all `NOT NULL`. Tenant/branch/terminal scope unchanged. Secret columns (`pin_hash BLOB`, `pin_salt BLOB`) and lockout columns (`failed_attempt_count`, `lockout_until`) preserved verbatim.
2. **Bridge column.** `clerk_user_id TEXT` (nullable) retained as a **non-key** bridge column for provider-side correlation during the bridge period; removable later (OQ-D6-2).
3. **Rebuild sequence (designed, NOT written):** `CREATE TABLE cashier_pin_records_new (… PRIMARY KEY (tenant_id, branch_id, terminal_id, user_id))` → `INSERT INTO cashier_pin_records_new (…) SELECT …, <user_id source>, …, cashier_clerk_user_id AS clerk_user_id FROM cashier_pin_records` → `DROP TABLE cashier_pin_records` → `ALTER TABLE cashier_pin_records_new RENAME TO cashier_pin_records` → `CREATE INDEX idx_cashier_pin_records_cashier ON cashier_pin_records (tenant_id, branch_id, terminal_id, user_id)`. Wrapped in one transaction under WAL; idempotent; crash-safe. **The `<user_id source>` is exactly the field that does not exist yet — this is where the blocker bites.**
4. **Code re-key (designed, NOT written).** `PinScope` and `rowMatchesScope` (PR-4) re-key their identity field from `cashier_clerk_user_id` to `user_id`; `CashierSignInHandler`'s `SELECT` and `persistLockoutState` `UPDATE` re-key their `WHERE` clause to `user_id`; `CashierSignInRequest`/`CashierPinDbRow`/`PinRow` carry `user_id` and demote `cashier_clerk_user_id` to the bridge field. The Argon2id verifier (`pin-credential.ts`) is **untouched** — it never keyed on identity.
5. **Identifier provisioning (designed, INERT).** At online sign-in POS reads `user_id` from the envelope and records it into the cached operator grant (028 §6); the store keys/migrates from that grant, never from a fresh backend call. **Inert until the envelope carries `user_id`.**
6. **Offline degradation (designed).** A migrated row unlocks on `user_id`; a not-yet-migrated row unlocks on the bridge `clerk_user_id` until its first post-change online sign-in supplies `user_id` — safe degradation, never a hard lockout (G-4 / A-4). The 24h offline grace (028 §10) is unchanged.
7. **Audit (designed).** Each re-key/migration emits a local, later-synced audit event recording scope + the fact of the re-anchor — never PIN/hash/salt/token (A-7; SR-2/SR-8).

**SQLite migration-safety items as DESIGN constraints (cited, NOT executed).** From `.specify/templates/sqlite-migration-safety-checklist-template.md`, the PK-rebuild design commits to satisfying — *when implemented* — at minimum: `CREATE TABLE`/`CREATE INDEX` idempotency; an explicit-and-reviewed `DROP TABLE` (the rebuild is intentionally destructive-shaped, reviewed); any new `NOT NULL` column carries a `DEFAULT` or is backfilled before the constraint is enforced (the `user_id` PK component cannot be `NOT NULL` until every row has a neutral key — this is the heart of OQ-D6-1's transition window); the **composite-PK grain** is reviewed against the idempotency key (`(tenant_id, branch_id, terminal_id, user_id)`); single-transaction + crash-safe re-attempt + idempotent re-run; **no queued/sealed row silently dropped or left unretrievable** (copy fidelity of `pin_hash`/`pin_salt`/lockout — P3); tested against `better-sqlite3` and `sql.js`; pragmas/WAL applied by the runner, not the migration file; the diff shows only the expected migration + source + test files; second-pair-of-eyes review because the table holds live sealed credential rows. **All of these are recorded as constraints the future migration must meet — none are executed in this pass.**

## Project Layout

All artifacts live under `specs/017-offline-pin-reanchor/` only. **No source tree is touched** in this pass.

```
specs/017-offline-pin-reanchor/
  spec.md                  # SPECIFY + CLARIFY (merged)
  plan.md                  # THIS FILE — DESIGN-READY, IMPLEMENTATION-BLOCKED
  analysis-report.md       # /speckit-analyze cross-artifact output
  checklists/
    requirements.md        # requirements checklist
  research.md              # Phase 0 (authored at plan-execution time)
  data-model.md            # Phase 1 (authored at plan-execution time)
  quickstart.md            # Phase 1 (authored at plan-execution time)
```

**Files the IMPLEMENTATION would touch (named for the future, NOT modified now):** `migrations/00NN_reanchor_cashier_pin_records.sql` (new, **not written**), `src/main/operator/pin-lockout.ts` (`PinScope`/`rowMatchesScope` re-key), `src/main/operator/sign-in-handler.ts` (`SELECT`/`UPDATE`/request shape re-key), `src/main/operator/pin-credential.ts` (**unchanged** — verifier never keyed on identity), plus the operator-grant write site that records `user_id` from the envelope.

## Test Strategy

**Vitest** for both processes (constitution Tech Stack). **DESIGN constraint only in this pass — no test is written.** When unblocked, the test plan (test-first, RED→GREEN) is:

- **Migration-rebuild test** — applies the re-key migration on a seeded DB; asserts target PK + index shape; asserts re-run is a no-op (idempotent); asserts mid-rebuild crash re-attempts cleanly.
- **Copy-fidelity test** — every row's `pin_hash`/`pin_salt`/`failed_attempt_count`/`lockout_until` is byte-identical pre- and post-rebuild (P3 / A-5); a previously-enrolled cashier still unlocks with the same PIN (no re-enrollment — A-4).
- **Scope-guard re-key test** — `rowMatchesScope` (PR-4) matches on `user_id`; a row for one terminal/scope cannot unlock another.
- **Offline-degradation test** — a not-yet-migrated row unlocks on the bridge `clerk_user_id`; a migrated row unlocks on `user_id`; neither path hard-locks an enrolled cashier (A-4 / G-4).
- **Audit-no-secret test** — the re-key audit event carries scope + fact only; no PIN/hash/salt/token (A-7; extends the canonical cross-process redaction test).

Coverage gate ≥ 80% on new code; the operator/PIN module already sits in the high-coverage tier. **No coverage is claimed in this pass** (no code written).

## CI / Build / Package

Unchanged. The standard four gates (typecheck, lint, tests, package dry-run on `windows-latest`) apply to the future implementation PRs. **This pass authors no code, so CI is not exercised.** The codegen pipeline (`openapi-typescript`) will regenerate `src/shared/api-types.ts` to include the `user_id`-bearing envelope **only after** the upstream DP-2 slice publishes that field — this is a downstream consequence of the blocker clearing, not work performed here.

## Phase 2 — Implementation Outline

Ordered work breakdown. **Every step is [BLOCKED: user_id-delivery]** — none may begin until the upstream DP-2 slice surfaces `user_id` on a POS-facing response and POS records it. **Step 0 is an upstream DP-2 dependency, not POS work.**

- **Step 0 — [BLOCKED: user_id-delivery] [UPSTREAM DP-2, NOT POS].** A NEW DP-2 slice surfaces the provider-neutral `user_id` on a POS-facing sign-in / operator-authorization envelope response (closes the drift-map NEW EDGE: D1 mints+returns `user_id`; D5/016 carries it). Verify on DP-2 `origin/main` that a POS-facing contract now carries `user_id` and the `IdentityProviderPort` exposes it to the operator-authorization path. **Until this is verified built, all steps below are inert. POS performs none of this step.**
- **Step 1 — [BLOCKED: user_id-delivery].** Decide **OQ-D6-1** (transition mechanism) against the *real* envelope shape from Step 0; revise this plan + author `research.md`/`data-model.md`.
- **Step 2 — [BLOCKED: user_id-delivery].** POS records `user_id` from the envelope into the cached operator grant (028 §6) at online sign-in. Test-first.
- **Step 3 — [BLOCKED: user_id-delivery].** Author the re-key migration `migrations/00NN_reanchor_cashier_pin_records.sql` per the Phase-1 rebuild sequence; satisfy every SQLite-migration-safety design constraint above; second-pair-of-eyes review (live sealed rows). Test-first (migration-rebuild + copy-fidelity tests).
- **Step 4 — [BLOCKED: user_id-delivery].** Re-key the code path: `PinScope`/`rowMatchesScope` (PR-4), `CashierSignInHandler` `SELECT`/`UPDATE`/request shape, the row types — identity field `cashier_clerk_user_id → user_id`, `clerk_user_id` demoted to bridge. `pin-credential.ts` untouched. Test-first (scope-guard re-key test).
- **Step 5 — [BLOCKED: user_id-delivery].** Implement the transition per the Step-1 decision (backfill / dual-key / bounded re-enrollment fallback), preserving offline degradation (A-4 / G-4). Test-first (offline-degradation test).
- **Step 6 — [BLOCKED: user_id-delivery].** Emit the local re-key audit event (scope + fact, no secret — A-7). Test-first (audit-no-secret test).
- **Step 7 — [BLOCKED: user_id-delivery].** Production readiness (P15): runbook, rollback, failure-mode catalogue, perf bring-up on target hardware; G10 ratification confirmed before rollout.
- **Step 8 — [BLOCKED: user_id-delivery] [LATER, SEPARATE].** Retire the `clerk_user_id` bridge column per **OQ-D6-2**, gated on the broader §16 bridge retirement — a separate migration, not in this feature's first cut.

`/speckit-tasks` materializes these into per-task units, each carrying the **[BLOCKED: user_id-delivery]** annotation, and **STOPS** there with the documented blocker. No `/speckit-implement`.

## Constitution Check (Post-Design)

Re-evaluated after Phase 1. Status remains **PASS** across the board — the design introduces no new principle tension, and Principle VIII is **advanced** (provider lock-in removed).

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | PASS | Offline unlock never blocks on the online-delivered `user_id`; degradation path is safe. |
| II. Financial Precision | PASS | No money columns. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | PASS | Migration + bridge designed, not written; security review owed at implementation (P8). No boundary file touched this pass. |
| IV. Hardware Loud | PASS | N/A. |
| V. Type Safety | PASS | `user_id` typing flows from the generated envelope type once the upstream surfaces it; `strict` honored. |
| VI. Test-First | PASS | Full test-first plan recorded; executed when unblocked. |
| VII. Observability | PASS | Local audit event, secret-free. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | **PASS — ADVANCED** | Anchoring on neutral `user_id` removes Clerk coupling from the PK; all six local-unlock rules still hold; Clerk stays the human IdP. |
| IX. Reference, Not Inheritance | PASS | No `_reference` reuse. |
| Platform Integration | PASS | `user_id` arrives only via the sanctioned DP-2 envelope path. |
| Security | PASS | Secret-sealing unchanged; hash/salt copied verbatim. |
| Hardware Matrix | PASS | N/A. |
| Domain — Pharmacy POS | PASS | Scope preserved. |
| P1–P18 | PASS | As Initial; P3/P5/P8/P13 remain DESIGN constraints; P15 deferred to rollout. No WAIVED, no VIOLATION. |

**Post-Design gate result: PASS (no VIOLATION, no WAIVED).** The plan is design-complete and constitutionally clean; the only thing standing between it and execution is the upstream `user_id`-delivery blocker.

## Risks & Open Items

- **[HIGHEST — the blocker] `user_id` is not delivered to the terminal.** DP-2 surfaces only the Clerk subject (`clerk_user_id` on `PosOperatorSessionSummary.id`) + an opaque envelope; **zero** POS contracts carry `user_id`; `IdentityProviderPort` resolves the §16 link server-side only. 016 (D5) shipped but carries the opaque envelope + `clerk_user_id`, NOT `user_id`. **Owner:** upstream DP-2 (a NEW slice must surface `user_id`). **Mitigation:** this plan is design-complete and ready to execute the instant the field lands; STOP at `/speckit-tasks` with this blocker documented; do NOT build against the non-existent field; do NOT author migration SQL.
- **OQ-D6-1 (transition mechanism — OPEN).** Backfill-on-reconnect vs dual-key window vs bounded re-enrollment fallback. Now doubly gated: plan-phase **and** dependent on the real envelope shape from Step 0. **Owner:** 017 feature owner at plan-execution. **Mitigation:** decide against the real envelope; never default to a blind forced re-enrollment (A-4).
- **OQ-D6-2 (bridge-column retirement — OPEN).** When/how `clerk_user_id` is dropped from `cashier_pin_records`. A later, separate migration gated on the broader §16 bridge retirement. **Owner:** 028/§16 retirement track.
- **Carried 028 OQs (OPEN, not decided here).** OQ-2 (offline manager override — bears on a manager-supervised PIN reset needing a neutral-key target), OQ-3 (PIN complexity / retry-lock — untouched by the re-anchor, N-4), OQ-4 (multi-terminal sessions vs forced takeover), OQ-9 (local refresh-token storage — bears on what the cached grant may hold alongside `user_id`), OQ-11 (break-glass support access for pilot). **Owner:** 028 Orchestrator.
- **G10 not yet ratified.** Satisfied-for-boundary-decisions, but ratification is required before implementation dispatch. **Owner:** 028 Orchestrator (G10 producer). **Mitigation:** no dispatch until G10 is signed AND D3 + the `user_id`-delivering envelope are confirmed built on `origin/main`.
- **PK-rebuild on live sealed credential rows (design constraint).** Destructive-shaped local migration; mitigated by transactional rebuild + copy fidelity + idempotent/crash-safe re-run + second-pair-of-eyes review (all recorded as constraints, executed only when unblocked).

---

*This plan is the source for `/speckit-tasks`. It is **DESIGN-READY, IMPLEMENTATION-BLOCKED**: tasks materialize with every step annotated **[BLOCKED: user_id-delivery]** and STOP there. Changes to scope or technical approach after task generation MUST update this plan and re-run task generation. No implementation is dispatched without explicit, scoped owner approval after **G10** is ratified and the **D3** + **`user_id`-delivering envelope (D1/D5)** upstreams are confirmed built on `origin/main`.*
