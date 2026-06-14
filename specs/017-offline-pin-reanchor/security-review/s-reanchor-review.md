# 017 §A4/P8 Security Review — migration `0036` re-anchor (PR #401)

**Date:** 2026-06-14 · **Reviewer:** independent `security-reviewer` agent (second pair of eyes, not the author) · **Gate:** Constitution P8 (Electron security boundary) / live sealed credential rows.
**Scope reviewed:** `migrations/0036_reanchor_cashier_pin_records.sql` + its two integration tests, against baseline `0006`/`0035` and the runtime readers (`sign-in-handler.ts`, `pin-lockout.ts`, `pin-management.ts`).

## Verdict: ✅ PASS (after the MEDIUM finding was fixed)

Initial verdict **PASS-WITH-NITS**: 0 CRITICAL, 0 HIGH, 1 MEDIUM, 1 LOW. The MEDIUM + LOW were both resolved by one change before merge; re-verified green.

## Findings & resolution

| # | Severity | Finding | Resolution |
|---|:--:|---|---|
| 1 | MEDIUM | Demoting `cashier_clerk_user_id` from PK component to a plain nullable column **removed the schema-enforced "one row per (scope, clerk)" uniqueness** that the offline-unlock `.get()` lookup depends on — leaving it guarded only at the app layer (`pin-management.ts` create-only guard). A future guard bug → two rows → `.get()` returns an arbitrary row → wrong PIN/lockout (P2 defense-in-depth regression on a credential table). | **FIXED** — Step 5 now creates a **PARTIAL UNIQUE index** `idx_cashier_pin_records_clerk ON (tenant,branch,terminal,cashier_clerk_user_id) WHERE cashier_clerk_user_id IS NOT NULL`, restoring schema uniqueness on the actual runtime lookup key. TDD: 2 RED tests added (unique-index-present; duplicate-(scope,clerk)-collides) → GREEN. |
| 2 | LOW | The originally-recreated `idx_…_cashier ON (…, user_id)` was redundant with the PK's implicit unique index. | **FIXED** — subsumed by finding #1's change (that index is replaced, not duplicated). |

## Design claims independently CONFIRMED (with grep evidence)

1. **Only writer is 019's handler, always non-null `user_id`** — grep found exactly one `INSERT INTO cashier_pin_records` in `src/` (`pin-management.ts:334`), which sources `user_id` from the roster and refuses `not_ready` before the INSERT if absent. `0006` DDL-only, `0035` ALTER-only. So no legacy null-`user_id` rows can exist → the direct rebuild is correct. (Load-bearing caveat: this makes 019's create-guard a hard upstream prerequisite — a stray null row would abort the migration transaction and loop on boot. Acceptable: that's fail-loud, not data loss.)
2. **Offline-unlock SELECT/UPDATE survive on the bridge column** — `cashier_clerk_user_id` is copied symmetrically (`0036:92`+`:105`) and remains a selectable non-PK column; `sign-in-handler.ts:331-336` SELECT + `:549-560` UPDATE + `rowMatchesScope` work unchanged. Pinned by the lookup test.

## Controls verified safe (credential-table migration)

- **P3 no silent data loss:** `INSERT…SELECT` has no `WHERE` filter, explicit symmetric 11-column list; copy-fidelity test asserts hash/salt/count/lockout byte-identical + row-count preserved.
- **Atomicity / crash-safety:** no `@no-wrap-transaction` marker, no manual BEGIN/COMMIT → runs in the runner's default `db.transaction()` wrap (`migrate.ts:144`); crash mid-rebuild rolls back, migration re-attempts on next boot. No FK references to the table anywhere → `DROP TABLE` safe.
- **P7 secrets never leak:** migration has no logging; test BLOB literals (`X'deadbeef'` etc.) are obviously fake fixtures; `hex(pin_hash)` is assertion-only.
- **Column fidelity:** `pin_hash BLOB NOT NULL`, `pin_salt BLOB NOT NULL`, `failed_attempt_count … CHECK (>= 0)`, lockout/created columns preserved exactly; `user_id` correctly `NOT NULL` (PK), `cashier_clerk_user_id` correctly nullable (bridge).
- **No stranded cashier:** a 019-enrolled cashier still unlocks offline via the bridge-column lookup (proven by the lookup test).

## Post-fix verification
- `cashier-pin-records-reanchor-migration.test.ts` + `…-lookup.test.ts`: **11/11 green.**
- Migration + operator suites: **217/217 green** (no regression).

**Gate result: P8 review PASS.** Safe to un-draft + merge PR #401.
