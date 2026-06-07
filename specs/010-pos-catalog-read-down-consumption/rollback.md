# Rollback — Catalogue Read-Down (010)

How to disable or revert the read-down subsystem, and what the terminal does in
each rolled-back state. The read-down is **additive and read-only**: it fills a
read model 009 already ships empty. Disabling it never corrupts a sale, a cart,
or any money-bearing record — at worst the catalogue is empty and 009 reports
"catalogue unavailable", exactly as it does on a fresh terminal.

## Levels of rollback (least to most invasive)

### 1. Stop the driver (no migration change)

Disable the background read-down by not calling `driver.start()` at the
composition root (or gating it behind the feature flag once wired, mirroring
`POS_PULSE_FEATURE_PRODUCT_SEARCH`). Effect:

- No further read-downs run; the manual `catalogue:refresh` bridge call refuses
  (no driver wired) rather than claiming a tick.
- The **existing** catalogue stays intact and fully usable offline — `products`
  / `product_barcodes` are untouched by stopping the driver.
- `catalogue.freshness` keeps reporting the last good `last_success_at`.

This is the first-resort rollback: it halts new reads without touching data.

### 2. Empty the read model (keep the tables)

If a bad snapshot landed and you want the terminal to fall back to
"catalogue unavailable" rather than serve stale/wrong data:

- A fresh successful read-down replaces the whole set (full-replace promote), so
  the normal fix is to re-run against a corrected backend snapshot.
- To force-empty immediately: `DELETE FROM products WHERE tenant_id = ?` +
  `DELETE FROM product_barcodes WHERE tenant_id = ?` (tenant-scoped). 009 then
  reports `catalogue_unavailable` — the honest "system not ready" state, never a
  wrong-price sale. `catalogue_sync_state` may be left as-is (freshness will show
  "updated … no products available", the truthful synced-but-empty state).

### 3. Revert the migrations (`0031`–`0033`)

The staging + sync-state tables are independent of 009's live `products` /
`product_barcodes` (which 009 owns, migrations `0029`/`0030`). To fully remove
010's tables:

- `DROP TABLE products_staging; DROP TABLE product_barcodes_staging; DROP TABLE catalogue_sync_state;`
- These tables hold only transient staging rows + per-tenant bookkeeping; dropping
  them loses no money-bearing or audit data. 009's read model and all sales data
  are unaffected.
- Re-applying is safe: the migrations are `CREATE … IF NOT EXISTS` and ship empty.

> **Do NOT** drop or alter `products` / `product_barcodes` (009's tables) as part
> of a 010 rollback — those are 009's read model and a 005-cart resolve seam
> depends on them.

## Behaviour with an empty read model

A terminal with empty `products` is the **baseline 009 state**: barcode scan /
SKU lookup / search all return `catalogue_unavailable` (the honest danger-state
surface, distinct from "not found"). Selling via manually-entered items (005) is
unaffected. No optimistic UI, no silent failure — the cashier sees the true
state (PRODUCT.md "honest surfaces").

## What rollback never touches

- Sales, cart, tender, receipts, audit events — the read-down writes none of
  these.
- The device token / pairing — read-down consumes the token but never mutates it.
- Backend state — the read-down is strictly backend → local (FR-10, proven by the
  no-outbound-write test T036).
