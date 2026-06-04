# Quickstart: Catalog Read-Down Consumption (010)

**Feature ID:** 010-pos-catalog-read-down-consumption
**Plan:** [./plan.md](./plan.md) · **Spec:** [./spec.md](./spec.md) · **Data model:** [./data-model.md](./data-model.md)
**Constitution version pinned:** v1.5.1

> A reviewer's path through 010. It explains *what to verify* once the slices land — it is not a task
> list (`/speckit-tasks` produces those). Implementation is **blocked** until the backend catalogue
> snapshot operation exists (R6); this walkthrough assumes that gate has cleared.

---

## The one-paragraph picture

009 shipped an empty product read model and the lookup/search/resolve that queries it. 010 **fills** that
model: a main-process **read-down driver** fetches a full per-tenant/branch catalogue snapshot from the
backend, validates each record, bulk-writes it into **staging tables**, then **promotes** it into 009's
live `products` / `product_barcodes` in **one transaction** (delete-live + insert-from-staging). Fold
columns are computed with **009's `normalize()`** so search keeps matching. A tiny `catalogue_sync_state`
row records the last successful promote, which a cashier-facing **"catalogue last updated"** timestamp
reads. The driver runs on a **paired terminal** (no operator session needed), on app-start / post-pairing
+ a periodic interval, plus a manual **refresh** affordance. Nothing is ever sent back to the backend.

## Reviewer checks by user story

### US — first read-down populates an empty terminal (SC-1)
1. Start from an empty read model (009 "catalogue unavailable").
2. Trigger a read-down (startup, or `catalogue.refresh`).
3. **Verify:** `products` / `product_barcodes` now hold the backend's sellable set; 009 lookups resolve a
   real barcode to the correct product (Arabic name + price); search returns real products.

### US — offline after a successful read-down (SC-2, SC-6)
1. Complete one read-down. Disconnect the network.
2. **Verify:** every lookup/search still resolves from local data — **0** network round-trips on the
   lookup path. **Verify:** only the terminal's tenant/branch products are present (P17).

### US — catalogue change reflected on the next read-down (SC-3)
1. Change the backend catalogue (add / price-update / deactivate). Trigger a read-down.
2. **Verify:** new products findable; updated prices/names appear; deactivated products stop resolving
   for selling (009 FR-18). Folded search still matches (SC-9).

### US — atomic apply / interruption safety (SC-4)
1. Interrupt a read-down mid-promote (crash/kill).
2. **Verify:** lookups only ever see the complete prior **or** complete new catalogue — never a mix; the
   prior catalogue is intact and recoverable; staging content is invisible to lookups.

### US — failure preserves the working catalogue (SC-5)
1. With a populated catalogue, force a read-down failure (backend unreachable / malformed snapshot /
   over-threshold rejections).
2. **Verify:** the existing catalogue is **100%** usable offline; the failure is in diagnostics (redacted);
   the cashier sees no hard error; `catalogue_sync_state.last_success_at` is unchanged.

### US — malformed-record handling (SC-11)
1. Feed a snapshot with a few invalid records (missing `name_ar`, non-safe-integer `price_minor`) below
   the abort threshold.
2. **Verify:** valid records promote; invalid ones are skipped + counted in diagnostics; **0** corruption,
   **0** whole-batch failure. Then feed a snapshot above the threshold → **verify** the run fails and the
   prior catalogue is preserved.

### US — truthful freshness (SC-10)
1. Read `catalogue.freshness` before any success → `last_success_at: null`.
2. After a successful read-down → it returns the **committed** promote timestamp.
3. **Verify:** the timestamp is never shown for a promote that didn't commit; the indicator implies no
   live sync.

### US — read-direction only (SC-7)
1. Run the full read-down lifecycle.
2. **Verify (by inspection + test):** 010 issues **0** POS→backend writes — no sale/inventory/price upload,
   no outbound mutation.

## Security / constitution spot-checks
- `price_minor` carried verbatim, `Number.isSafeInteger`-guarded at the staging validation boundary; **no
  arithmetic** (P1/II).
- Device token read in main process only; never crosses the bridge, never logged (P7; allowlist).
- New `catalogue:refresh` / `catalogue:freshness` channels return status/timestamp only — no data, no
  secret (P8; reviewed in the bridge-security package).
- Staging migrations + promote reviewed under a **010 §A2-class migration-safety** package (not inherited
  from 009).
- Read-down runs on a paired terminal without an operator session (Constitution VIII); the two bridge
  calls are session-gated.

## Commands (existing pipeline — no CI change)
```bash
npm run codegen:verify   # MUST stay green; regenerates api-types.ts once the backend publishes the op
npm run typecheck
npm run lint
npx vitest run
```
