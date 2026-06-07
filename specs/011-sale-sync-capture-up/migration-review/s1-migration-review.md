# §A2 Migration-Safety Review — 011 `0034_create_sale_sync_state`

**Gate:** §A2 (migration safety). **Status:** self-assessed **PASS**, fast-tracked under owner "fire"
authorization. **Owner ratification owed** before merge if a separate review is wanted (flagged in PR).
**Reviewer:** implementer (Opus). **Date:** 2026-06-07. **Constitution:** v1.5.1.

## Scope

One additive migration: `migrations/0034_create_sale_sync_state.sql`. Creates the 011-owned
`sale_sync_state` companion table. Does NOT touch any existing table.

## Control matrix

| # | Control | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Additive only (no ALTER/DROP of existing tables) | **PASS** | File is a single `CREATE TABLE IF NOT EXISTS` + one `CREATE INDEX IF NOT EXISTS`. No ALTER/DROP. |
| 2 | Idempotent re-run | **PASS** | `IF NOT EXISTS` on table + index; runner test (23) green with 0034 present; re-run is a no-op. |
| 3 | 008's enqueue-only `sale_sync_outbox` untouched | **PASS** | 0034 references `sales(sale_id)` via FK only; the migration-shape test asserts the outbox UPDATE is still refused after 0034 applies. |
| 4 | Tenant scoping (P17) | **PASS** | `tenant_id`/`branch_id` `NOT NULL`; the `(tenant_id, sync_status, next_retry_at)` index backs the tenant-scoped drain query; repo tests prove cross-tenant isolation. |
| 5 | Money columns | **PASS (N/A)** | No money columns — totals live on `sales`. This table is sync bookkeeping only. |
| 6 | CHECK constraints sound | **PASS** | `sync_status IN ('pending','synced','dead_letter')` + `attempt_count >= 0`; both proven to reject out-of-set / negative inserts in the shape test. |
| 7 | FK safety / ordering | **PASS** | FK to `sales(sale_id)`; runner applies by filename sort so 0034 follows 0020/0024. Logical FK consistent with project convention. |
| 8 | Ships empty | **PASS** | DDL only; no seed/backfill. Pre-existing sales get a state row lazily on first drain. |
| 9 | No secrets at rest (P7) | **PASS** | Columns are ids, statuses, timestamps, and an opaque error category — no token/PII/card. |
| 10 | Rollback posture | **PASS** | Additive + empty → forward-only is safe; a drop would be a clean `DROP TABLE` with no data loss of record-of-truth (the durable `sales` + outbox remain). |

## Verdict

**PASS.** Lowest-risk migration class (additive, empty, `IF NOT EXISTS`, no mutation of existing
tables, 008's invariant provably intact). 8/8 shape tests + 23 runner tests green.

**Residual:** if the owner wants a separate §A2 ratification round before merge, this is the package to
sign. Nothing here blocks the buildable-now slices from a correctness standpoint.
