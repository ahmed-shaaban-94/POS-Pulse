> **⛔ SUPERSEDED IN PART (2026-06-13) — read [`BLOCKER.md`](./BLOCKER.md) rev. 3 + [`UNBLOCK-PLAN.md`](./UNBLOCK-PLAN.md) FIRST.** The `[BLOCKED: user_id-delivery]` / `[BLOCKED: owner-dispatch]` stamps below describe the **wrong** unblock work. A dispatch-attempt investigation proved the gap is a **cashier-scoped** `user_id` (033 delivered the *operator's*, not the *cashier's*). The real unblock is: DP-2 surfaces `user_id` on `PosRosterCashierEntry` (~4 lines, NO provisioning — T000/T010's envelope+provisioning+G10 framing is obsolete) → POS completes cashier-PIN provisioning keyed on `user_id` (deferred 004 scope — **DONE: POS-019, PR #398, which took migration `0035` for the additive `user_id` column**) → 017 re-anchor with migration **`0036`** as a legacy-row safety-net (`0035` is taken). **Follow [`UNBLOCK-PLAN.md`](./UNBLOCK-PLAN.md) (sequence 2→1→3); do NOT dispatch T000's envelope/provisioning request.** Tasks below retained for history; re-run `/speckit-tasks` after the forks resolve.

> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# Tasks: POS Offline-PIN Re-Anchor off a DP-2 Provider-Neutral Identifier (drift D6)

**Feature ID:** 017-offline-pin-reanchor
**Spec:** [./spec.md](./spec.md) · **Plan:** [./plan.md](./plan.md) · **Blocker:** [./BLOCKER.md](./BLOCKER.md)
**Constitution pinned:** v1.5.1
**Created:** 2026-06-13 · **Last Updated:** 2026-06-13

---

## ⛔ STATUS: DESIGN-READY, IMPLEMENTATION-BLOCKED

> **EVERY IMPLEMENTATION TASK BELOW IS `[BLOCKED: user_id-delivery]`. NOTHING IN THIS LIST MAY BE EXECUTED.** This task list is materialized for readiness only: it is the ready-to-run plan for the moment the upstream `user_id`-delivery slice lands. No code, no migration SQL, no contract is authored in this pass; `cashier_pin_records` is untouched; `migrations/` is untouched. Per owner instruction, the pipeline STOPS at `/speckit-tasks`. There is **no `/speckit-implement`** until the blocker clears AND G10 is ratified.

### The verified blocker (DP-2 `origin/main`, 2026-06-13)

The provider-neutral §16 `user_id` is **never delivered to the terminal**:

- DP-2 ships only `PosOperatorSessionSummary = { id, issued_at, envelope }`. The `envelope` is an **opaque bearer string** (no parseable claims); the `id` is the **Clerk SUBJECT** (`users.clerk_user_id`), documented "for identity continuity across POS endpoints."
- A grep of **all** POS-facing contracts (`pos-operators`, `auth`, `pos-shifts`, `pos-audit-events`, `pos-terminal-pairing`, `vouchers`) returns **zero** `user_id`.
- `IdentityProviderPort` resolves `external_identity_links` **server-side only**; callers see `VerifiedSubject.subject` (= `clerk_user_id`), never the neutral `user_id`.
- **016 (D5) shipped and is MERGED**, but it delivers the **opaque envelope + the Clerk-subject `id`** — NOT `user_id`.
- The migration's `<user_id source>` column (plan Phase 1 §3) is therefore **the field that does not exist yet**.

### Double-gate (restated)

- **G10** (Identity & Access Boundary) = *satisfied-for-boundary-decisions* but **NOT YET RATIFIED**. Ratification is required before any dispatch.
- **D3 → D6**: server-side `external_identity_links` exists (DP-2 #550) but **provisioning is DEFERRED** (029 wave-status: `linkExternalIdentity` has no live caller; post-migration users get `user_unmapped → 401`).
- **D1/D5 → D6 (the NEW EDGE)**: the envelope must carry `user_id` on a POS-facing response and POS must record it — **empirically UNMET** (spec evidence E-3: the cashier offline path holds no backend-issued credential today — `backend_session_id: ''`, `jwt: null`, `cashier_clerk_user_id` is caller-supplied).

**Consequence:** re-keying `cashier_pin_records`' PK onto `user_id` means building against a field that does not exist on the POS wire. **DO NOT build against it. DO NOT author migration SQL. DO NOT touch `cashier_pin_records`.**

---

## Invariants (preserve in every task; verify before any GREEN)

1. **PIN material never leaves the device.** `pin_hash`/`pin_salt` (Argon2id, `safeStorage`/DPAPI-sealed) are copied **verbatim** — never re-hashed, re-sealed, surfaced, logged, or synced upward. `src/main/operator/pin-credential.ts` (the verifier) is **untouched** — it never keyed on identity (E-4). (028 CM-4 / SR-1; spec A-2 / N-2 / N-3.)
2. **Anchor = the §16 `user_id`.** NOT `subject`, NOT `clerk_user_id` (`subject ≈ clerk_user_id` and stays provider-coupled, so it would not remove the lock-in). (Spec Clarifications Q1, §4, §7.)
3. **Only the key column changes.** `clerk_user_id` → **nullable, non-key bridge column** (removable later, OQ-D6-2). Tenant/branch/terminal scope unchanged — all remain `NOT NULL` PK components (P17). (Spec G-3 / A-3 / §4.)
4. **No stranded cashier.** Already-enrolled cashiers are **never hard-locked** by the re-key and are **never** blind-forced to re-enroll; a row with no neutral key yet degrades safely on the bridge key (G-4 / A-4 / §6).
5. **Secret-free audit.** Each re-key/migration emits a **local, later-synced** audit event recording scope + the fact of the re-anchor — never PIN/hash/salt/token (A-7; 028 SR-2/SR-8).

---

## Task legend

- `[BLOCKED: user_id-delivery]` — **may not be executed**; gated on the upstream DP-2 slice surfacing `user_id` on a POS-facing response.
- `[P]` — parallelizable with sibling tasks once unblocked (different files, no ordering dependency).
- `[GATE]` — a hard pass/stop checkpoint; if it fails, STOP.
- `[UPSTREAM — DATA-PULSE-2, NOT POS]` — work POS does **not** perform; a prerequisite owned by Data-Pulse-2.
- `[OQ-D6-1 DECISION — NOT DECIDED HERE]` — carries the open transition-mechanism decision; must be decided against the real envelope before proceeding.
- `[LATER, SEPARATE]` — deferred to a later, separately-gated feature cut.
- RED/GREEN — test-first ordering: the RED task writes the failing test; the GREEN task makes it pass.

---

## Phase 0 — Gating prerequisites (blocker + verification)

- **T000** `[BLOCKED: user_id-delivery]` `[UPSTREAM — DATA-PULSE-2, NOT POS]` — **The gating prerequisite.** Data-Pulse-2 must surface the provider-neutral §16 `user_id` on a POS-facing sign-in / operator-authorization envelope response (closes the drift-map NEW EDGE: D1 mints+returns `user_id`; D5/016 carries it to the terminal). **POS authors nothing here.** This task exists to name the dependency that everything below waits on. *(Spec §5 / Dependencies; plan Step 0.)*
- **T001** `[BLOCKED: user_id-delivery]` `[OQ-D6-1 DECISION — NOT DECIDED HERE]` — Decide **OQ-D6-1** (transition mechanism) against the *real* envelope shape delivered by T000: backfill-on-reconnect + PK rebuild vs dual-key transitional window vs bounded re-enrollment fallback. Record the decision; revise `plan.md` and author `research.md`/`data-model.md`. **No mechanism is pre-committed; never default to a blind forced re-enrollment** (A-4). *(Plan Step 1 / R-3.)*
- **T002** `[BLOCKED: user_id-delivery]` — Resolve the migration sequence placeholder `00NN` to the next free migration number at author time (currently `0034` is the highest referenced; `00NN` is a placeholder, not a literal). *(Plan Project Layout; analysis MEDIUM-2.)*
- **T003** `[BLOCKED: user_id-delivery]` — Confirm the cached operator-grant write site (028 §6) is the single recording point for `user_id`; no fresh backend call is added to the verification path (N-3). *(Plan Phase 1 §5.)*

## Phase 1 — Verification gate (re-pin)

- **T010** `[BLOCKED: user_id-delivery]` `[GATE — RE-PIN]` — **Verify `user_id` is really on the wire before any further work.** PASS condition (all four must hold):
  - (a) a POS-facing DP-2 contract (sign-in / operator-session / envelope response) now carries `user_id`;
  - (b) `IdentityProviderPort` (or its operator-authorization caller) exposes `user_id` to the POS-facing path (not server-side-only);
  - (c) re-pin the OpenAPI snapshot and run `npm run codegen:api` so `src/shared/api-types.ts` regenerates with the `user_id`-bearing envelope type;
  - (d) `npm run codegen:verify` is clean (regen → diff no-op).
  - **If this gate FAILS, STOP.** Do not proceed to migration design, code re-key, or provisioning. *(Plan CI/Build/Package; analysis LOW-4.)*

## Phase 2 — Provisioning (US2: POS records `user_id` from the envelope)

- **T020** `[BLOCKED: user_id-delivery]` — **RED.** Write the failing test: at online sign-in, POS reads `user_id` from the (now-real) envelope and records it into the cached operator grant (028 §6); the test asserts the grant carries the neutral `user_id` alongside the existing identity proof. *(Spec §5; plan Step 2.)*
- **T021** `[BLOCKED: user_id-delivery]` — **GREEN.** Implement the grant write: record `user_id` from the envelope into the cached operator grant. No fresh backend call; no change to the verification path. Make T020 pass. *(Spec §5; plan Step 2.)*

## Phase 3 — Migration design (US1: re-key the PK; the heaviest element)

- **T030** `[BLOCKED: user_id-delivery]` — **RED.** Write the failing migration-safety test: apply the re-key migration on a seeded DB; assert the target PK `(tenant_id, branch_id, terminal_id, user_id)` + the covering index `idx_cashier_pin_records_cashier` on the same target tuple; assert re-run is a no-op (idempotent); assert a mid-rebuild crash re-attempts cleanly. *(Spec A-1/A-5; plan Phase 1 §3 / R-1.)*
- **T031** `[BLOCKED: user_id-delivery]` — **RED.** Write the failing copy-fidelity test: every row's `pin_hash`/`pin_salt`/`failed_attempt_count`/`lockout_until` is byte-identical pre- and post-rebuild; a previously-enrolled cashier still unlocks with the same PIN (no re-enrollment). *(Spec A-2/A-4/A-5; Invariants 1, 4; P3.)*
- **T032** `[BLOCKED: user_id-delivery]` — **GREEN.** Author the re-key migration `migrations/00NN_reanchor_cashier_pin_records.sql` (resolved per T002) using the plan's table-rebuild sequence: `CREATE TABLE …_new` keyed on `user_id` → `INSERT…SELECT` copy preserving secret + lockout columns, with `<user_id source>` from the grant and `cashier_clerk_user_id AS clerk_user_id` (nullable bridge) → `DROP TABLE` old → `RENAME` → rebuild covering index. Single transaction under WAL; idempotent; crash-safe. **NOT WRITTEN this pass — `cashier_pin_records` and `migrations/` are untouched.** Requires **second-pair-of-eyes review** (live sealed credential rows). Make T030 + T031 pass. *(Spec A-1/A-3/A-5; plan Phase 1 §1-§3; Invariants 1-3.)*

## Phase 4 — Code re-key (US1/US3: the local sign-in/lockout path)

- **T040** `[BLOCKED: user_id-delivery]` — **RED.** Write the failing scope-guard test: `rowMatchesScope` (PR-4) matches on `user_id`; a row for one terminal/scope cannot unlock another; lockout counters are preserved across the re-key. *(Spec §6 / A-5; E-2.)*
- **T041** `[BLOCKED: user_id-delivery]` — **GREEN.** Re-key `src/main/operator/pin-lockout.ts`: `PinScope` and `rowMatchesScope` (PR-4) + `verifyPinWithWindow` (PR-3) move their identity comparison from `cashier_clerk_user_id` to `user_id`. Make T040 pass. *(Spec §6; E-2; plan Step 4.)*
- **T042** `[BLOCKED: user_id-delivery]` — **GREEN.** Re-key `src/main/operator/sign-in-handler.ts`: `CashierSignInHandler`'s `SELECT … WHERE … = ?` and `persistLockoutState`'s `UPDATE … WHERE … = ?` move to `user_id`; `CashierSignInRequest`/`CashierPinDbRow`/`PinRow` carry `user_id` and demote `cashier_clerk_user_id` to the nullable bridge field. *(Spec §6 / G-3 / A-3; E-2; plan Step 4.)*
- **T043** `[BLOCKED: user_id-delivery]` `[P]` — **GUARD.** Assert `src/main/operator/pin-credential.ts` is **untouched** — the Argon2id verifier never keyed on identity and must not gain a `user_id` parameter or any identity read. A test/CI check fails if this file changes as part of the re-key. *(Invariant 1; spec E-4 / A-2.)*

## Phase 5 — Safe degradation (US3: no stranded cashier)

- **T050** `[BLOCKED: user_id-delivery]` — **RED.** Write the failing offline-degradation test: a not-yet-migrated row unlocks on the bridge `clerk_user_id`; a migrated row unlocks on `user_id`; neither path hard-locks an enrolled cashier; no blind forced re-enrollment is imposed. The 24h offline grace (028 §10) is unchanged. *(Spec §6 / G-4 / A-4.)*
- **T051** `[BLOCKED: user_id-delivery]` `[OQ-D6-1 DECISION — NOT DECIDED HERE]` — **GREEN.** Implement the transition per the T001 decision (backfill / dual-key / bounded re-enrollment fallback), preserving safe degradation. **Re-enrollment, if used at all, is a bounded fallback — never the default** (A-4). Make T050 pass. *(Spec §6; plan Step 5; R-3.)*

## Phase 6 — Audit (US4: secret-free re-anchor record)

- **T060** `[BLOCKED: user_id-delivery]` — **RED.** Write the failing audit-no-secret test: the re-key/migration audit event carries scope + the fact of the re-anchor only; it contains no PIN/hash/salt/token. Extends the canonical cross-process redaction test. *(Spec §6 / A-7; Invariant 5; P7.)*
- **T061** `[BLOCKED: user_id-delivery]` — **GREEN.** Emit the local, later-synced audit event (scope + fact, no secret) on each re-key/migration. Make T060 pass. *(Spec §6 / A-7; 028 SR-2/SR-8.)*

## Phase 7 — Production readiness

- **T070** `[BLOCKED: user_id-delivery]` `[GATE]` — Production readiness (P15): author the runbook, rollback plan, and failure-mode catalogue; perf bring-up on target hardware; **explicitly confirm G10 is ratified** (check the cross-repo gates doc — do not assume) **and** D3 + the `user_id`-delivering envelope are confirmed built on `origin/main` before rollout. *(Plan Step 7; analysis LOW-1.)*

## Phase 8 — Bridge retirement (later, separate)

- **T080** `[BLOCKED: user_id-delivery]` `[LATER, SEPARATE]` `[OQ-D6-2]` — Retire the `clerk_user_id` bridge column from `cashier_pin_records` per **OQ-D6-2**, gated on the broader §16 bridge retirement. A separate migration, not in this feature's first cut. *(Spec OQ-D6-2; plan Step 8.)*

---

## Dependency graph

```
T000 (UPSTREAM DP-2: surface user_id)         ← THE BLOCKER; POS does none of this
  └─► T010 [GATE — RE-PIN] (verify user_id on the wire; codegen)
        ├─► T001 [OQ-D6-1] (decide transition mechanism) ─┐
        ├─► T002 (resolve 00NN)                           │
        ├─► T003 (confirm grant write site)               │
        │                                                  │
        ├─► T020 (RED provision) ─► T021 (GREEN provision)─┤
        │                                                  ▼
        ├─► T030 (RED migration-safety) ┐                 supplies <user_id source>
        ├─► T031 (RED copy-fidelity)   ─┴─► T032 (GREEN author migration; 2nd-eyes)
        │                                                  │
        ├─► T040 (RED scope-guard) ─► T041 (GREEN pin-lockout) ─► T042 (GREEN sign-in-handler)
        │                              T043 [P] (GUARD: pin-credential untouched)
        │                                                  │
        ├─► T050 (RED degradation) ─► T051 [OQ-D6-1] (GREEN transition)
        ├─► T060 (RED audit) ─► T061 (GREEN audit)
        └─► T070 [GATE] (production readiness; G10 ratified) ─► T080 [LATER] (bridge retirement)
```

**Nothing in this graph executes until T000 lands AND T010 passes AND G10 is ratified.**

## Parallel-execution notes

Once (and only once) unblocked: the three RED tracks — migration-safety/copy-fidelity (T030/T031), scope-guard (T040), degradation (T050), audit (T060) — author independent test files and can be written in parallel. T043 `[P]` (the verifier-untouched guard) is independent of all of them. Their GREEN counterparts serialize on the files they touch (T041 before T042 share the operator module; T032 is the single migration author). **None of this parallelism is available now — every task is `[BLOCKED: user_id-delivery]`.**

## Open questions (recorded OPEN — none decided here)

| OQ | Topic | Status | Note |
|----|-------|--------|------|
| **OQ-D6-1** | Transition mechanism (backfill-on-reconnect / dual-key window / bounded re-enrollment fallback) | **OPEN** | Decide against the real envelope shape (T001); never default to blind forced re-enrollment (A-4). Tagged on T001 + T051. |
| **OQ-D6-2** | Bridge-column retirement: when/how `clerk_user_id` is dropped | **OPEN** | Later, separately-gated migration (T080); gated on the broader §16 bridge retirement. |
| OQ-2 (028) | Offline manager override (incl. supervised PIN reset) | **OPEN** | A manager-supervised offline PIN reset would also need a neutral-key target. |
| OQ-3 (028) | PIN complexity / retry-lock policy | **OPEN** | Untouched by the re-anchor (N-4) but governs the same store. |
| OQ-4 (028) | Multi-terminal operator sessions vs forced takeover | **OPEN** | |
| OQ-9 (028) | Whether refresh tokens are ever stored locally by POS | **OPEN** | Bears on what the cached grant may hold alongside `user_id`. |
| OQ-11 (028) | Break-glass support access for the pilot | **OPEN** | |

## Discipline (honored in this pass)

- All artifacts live under `specs/017-offline-pin-reanchor/` only. **No source tree is touched.**
- POS authors **no contract** and **no migration SQL** in this pass (N-1; A-8). The `user_id`-bearing envelope contract is DP-2-owned upstream work.
- `cashier_pin_records` and `migrations/` are **untouched**.
- The pipeline **STOPS at `/speckit-tasks`** with the blocker documented. No `/speckit-implement` until the blocker clears and G10 is ratified.

---

*Tasks are the source for `/speckit-implement` — which is **not run** in this pass. This list is **DESIGN-READY, IMPLEMENTATION-BLOCKED**: every task carries `[BLOCKED: user_id-delivery]` and the pipeline STOPS here. Re-run `/speckit-tasks` if plan scope or technical approach changes after the upstream lands.*
