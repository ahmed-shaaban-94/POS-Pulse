-- 010-pos-catalog-read-down-consumption Slice S1 (T013) — create
-- catalogue_sync_state.
-- Schema per specs/010-pos-catalog-read-down-consumption/data-model.md §"Entity:
-- CatalogueSyncState" and the §A2-class migration-review (migration-review/
-- s1-migration-review.md §4, owner-ratified 2026-06-05).
--
-- ONE row per tenant (the terminal serves a single tenant) holding read-down
-- bookkeeping OUT of 009's hot read path (R4). Read only by the freshness surface
-- (FR-16) — never by lookup/search/resolve.
--
--   • `tenant_id` PRIMARY KEY — one row per tenant.
--   • `branch_id` TEXT NOT NULL (§A2 D6, ratified 2026-06-05): part of the row's
--     store scope alongside the tenant — read-down is store-scoped by the device
--     principal (PR #490).
--   • `last_success_at` is written INSIDE the promote transaction (SC-10): the
--     freshness indicator can never show a "last updated" time for a promote that
--     did not commit (P2/P9 truthfulness). NULL until the first successful read-down.
--   • `last_attempt_at` / `last_outcome` are diagnostics, written on every attempt
--     (success or fail) OUTSIDE the promote tx; a failed run MUST NOT advance
--     `last_success_at`.
--   • `source_snapshot_id` is an opaque backend provenance id (NOT a sync cursor —
--     full-replace model, R3).
--
-- No secrets: timestamps + an opaque snapshot id only — no token, no PII (P7).
-- NOT an audit anchor → NO append-only trigger. Ships EMPTY.

CREATE TABLE IF NOT EXISTS catalogue_sync_state (
  tenant_id          TEXT NOT NULL PRIMARY KEY,
  branch_id          TEXT NOT NULL,       -- §A2 D6: store/branch scope NOT NULL — read-down is store-scoped (PR #490)
  last_success_at    TEXT,                -- written INSIDE the promote tx (SC-10 truthfulness); NULL until first success
  source_snapshot_id TEXT,                -- opaque backend snapshot/version id (provenance, not a sync cursor)
  last_attempt_at    TEXT,                -- last read-down attempt (success or fail) — diagnostics
  last_outcome       TEXT                 -- 'succeeded' | 'failed' | 'skipped_with_rejections'
);
