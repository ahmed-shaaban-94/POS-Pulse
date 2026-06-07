-- 011-sale-sync-capture-up T011 — create sale_sync_state table.
-- Schema per specs/011-sale-sync-capture-up/data-model.md §"sale_sync_state".
-- §A2 review: specs/011-sale-sync-capture-up/migration-review/s1-migration-review.md
--
-- 011-OWNED companion to 008's enqueue-only `sale_sync_outbox` (migration 0024,
-- 008 AD-3: CHECK(state='pending') + UPDATE/DELETE-refusing triggers). 008's
-- outbox is read-only to 011 and is NOT touched here. ALL mutable sync/retry/
-- dead-letter state lives in THIS table, joined to the outbox on sale_id.
-- Mirrors 010's `catalogue_sync_state` companion-table precedent (migration 0033).
--
-- One row per sale that has begun syncing. A freshly enqueued sale has an outbox
-- row but NO sale_sync_state row yet (the row is created on first attempt); the
-- drain-eligibility query therefore starts from the outbox LEFT JOIN this table.
--
-- No money columns (totals live on the durable `sales` row); no secrets (P7) —
-- only sync bookkeeping + an opaque error category. Additive + IF NOT EXISTS;
-- ships empty.

CREATE TABLE IF NOT EXISTS sale_sync_state (
  sale_id              TEXT     NOT NULL PRIMARY KEY,
  tenant_id            TEXT     NOT NULL,
  branch_id            TEXT     NOT NULL,
  sync_status          TEXT     NOT NULL CHECK (sync_status IN ('pending', 'synced', 'dead_letter')),
  attempt_count        INTEGER  NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_retry_at        TEXT,
  last_error_category  TEXT,
  last_attempt_at      TEXT,
  synced_at            TEXT,
  created_at           TEXT     NOT NULL,
  updated_at           TEXT     NOT NULL,

  FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Drain-eligibility scan path (data-model.md indices): pending + due, tenant-scoped.
CREATE INDEX IF NOT EXISTS idx_sale_sync_state_tenant_status_retry
  ON sale_sync_state (tenant_id, sync_status, next_retry_at);
