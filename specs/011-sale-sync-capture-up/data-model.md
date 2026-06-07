# Data Model — Sale Sync (Capture-UP)

Reviewed under an **011 §A2-class migration review** (migration `0034-sale-sync-state`).

## New table: `sale_sync_state` (011-owned)

One row per sale that needs syncing, joined to 008's `sale_sync_outbox` on `sale_id`. Holds **all
mutable** sync state — 008's outbox is never mutated (enqueue-only; the append-only triggers in
`migrations/0024_create_sale_sync_outbox.sql` are attributed to **008 AD-3** — note the 008 repository
docstring labels the same invariant "AD-11"; the migration's AD-3 is authoritative).

| Column | Type | Notes |
|:--|:--|:--|
| `sale_id` | TEXT PK | FK-by-convention to the durable Sale / `sale_sync_outbox.sale_id`. One row per sale. |
| `tenant_id` | TEXT NOT NULL | Tenant scope (P17). Every query filters on it. |
| `branch_id` | TEXT NOT NULL | Store/branch scope (P17). |
| `sync_status` | TEXT NOT NULL | `pending` \| `synced` \| `dead_letter`. CHECK-constrained. |
| `attempt_count` | INTEGER NOT NULL DEFAULT 0 | Persisted retry counter (survives restart, FR-6). |
| `next_retry_at` | TEXT NULL | ISO-8601 UTC; when the next attempt is eligible (backoff). |
| `last_error_category` | TEXT NULL | `transient` \| `permanent` \| `no_connection` (no raw body — P7). |
| `last_attempt_at` | TEXT NULL | ISO-8601 UTC of the most recent attempt. |
| `synced_at` | TEXT NULL | ISO-8601 UTC set once on terminal success. |
| `created_at` | TEXT NOT NULL | Row creation stamp. |
| `updated_at` | TEXT NOT NULL | Last mutation stamp. |

**Indexes:**
- PK on `sale_id`.
- `(tenant_id, sync_status, next_retry_at)` — the drain's eligibility query (pending + due, tenant-scoped).

**Constraints:**
- `CHECK(sync_status IN ('pending','synced','dead_letter'))`.
- `CHECK(attempt_count >= 0)`.
- No money columns here (totals live on the durable Sale; this table is sync bookkeeping only).

## State machine (`sync_status`)

```
        ┌─────────── 5xx / timeout (attempt++, set next_retry_at) ───────────┐
        ▼                                                                     │
   [pending] ──── POST 200/201 OR 409 (duplicate) ───▶ [synced]  (terminal)   │
        │                                                                     │
        └──── POST 400/422 (permanent) ───▶ [dead_letter] (terminal + notify) ┘
```

- `pending → synced`: HTTP 200/201, or 409 (idempotent success — backend already has it).
- `pending → pending`: transient (5xx/timeout/no_connection) — increment `attempt_count`, set
  `next_retry_at` via exponential backoff (cap NFR-4). No status change.
- `pending → dead_letter`: permanent 4xx (400/422). Emit a non-blocking operator notification.
- `synced` and `dead_letter` are terminal; the drain excludes them.

## Read relationships (no writes outside 011)

- `sale_sync_outbox` (008, read-only): source of truth for *which* sales need syncing (FIFO by
  `enqueued_at`). 011 reads it; never writes/updates it.
- Durable Sale record (008, read-only): source of the capture payload (line items, totals, identity),
  fetched by `sale_id` at POST time. 011 reads it; never mutates it.

## Capture payload (derived, not stored)

`CaptureSalePayload` is built per-POST from the durable Sale; **not persisted** by 011. Shape lives
in [contracts/](./contracts/). Invariants: integer minor units only (Constitution II); deterministic
`externalId` from `sale_id`; **no tender fields** (AD-4); tenant/branch/terminal/operator identity
from the Sale + pairing, never renderer-supplied (P17).

## Tenant scoping (P17)

Every `sale_sync_state` read and write filters on `tenant_id` (and `branch_id` where the drain is
branch-scoped). The drain never selects across tenants; a payload's scope is taken from the durable
Sale, never from any renderer input.
