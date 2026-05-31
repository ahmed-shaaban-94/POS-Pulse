# 009 T049b — Dev catalogue fixture seed (design)

**Feature:** 009 · **Slice:** S5 (T049b) · **Date:** 2026-05-31 · **Status:** Design — pending owner review.

## Problem

`products` / `product_barcodes` ship **empty** (AD-2). So a live dev build of the T049a
surface only ever exercises `catalogue_unavailable` / `not_found` — the happy path
(search/scan → results/confirm → add) can't be demonstrated, and the S5 review tasks
**T050** (screenshot review) and **T056** (keyboard walkthrough) have nothing to search.
T049b adds a **dev-only, fail-closed** seed so the real read model holds realistic rows in
development — never in a packaged build.

## Approach (owner-ratified: dev-flag seed loader)

A new `applyDevSeedCatalogueIfRequested(deps)` that **mirrors the established dev-bootstrap
pattern** (`applyDevSkipOperatorSignInIfRequested` / `applyDevSkipPairingIfRequested`):

- Runs ONLY when **both**: `isPackaged === false` AND `POS_PULSE_DEV_SEED_CATALOGUE` is truthy
  (`1|true|yes|on`). `isPackaged === true` short-circuits unconditionally — the env var is never
  consulted in a packaged build (cannot be enabled in production).
- **Idempotent:** if `products` already has any row, it no-ops (so repeated launches don't
  duplicate). Inserts are also `INSERT OR IGNORE` on the PK as belt-and-suspenders.
- Logs one `logger.warn` ("DEV SEED: inserting fixture catalogue rows; never enable in a
  packaged build") — non-sensitive fields only.
- Returns `true` when it seeded, `false` otherwise.

**Tenant alignment (load-bearing):** seeded rows use `tenant_id = 'dev-tenant'` — the SAME
tenant as the dev operator fixture (`DEV_OPERATOR_FIXTURE_SESSION_INPUT.tenant_id`). The
repo is tenant-scoped (P17); a mismatched tenant would make the products invisible to the
dev session. So `POS_PULSE_DEV_SEED_CATALOGUE` is meant to be set ALONGSIDE
`POS_PULSE_DEV_SKIP_OPERATOR_SIGNIN` + `POS_PULSE_DEV_SKIP_PAIRING` (the combined dev launch).

**Fold columns via real `normalize()` (load-bearing):** `sku_norm`, `name_fold`,
`alias_fold`, `barcode_norm` are computed by calling the production `normalize()` — NEVER
hand-typed. A divergent fold would seed a product that can't match its own search. (Same
contract the test fixture `catalogue-fixture.ts` already enforces.)

## Fixture data (~12 products)

Realistic Egyptian-pharmacy rows covering the surfaces under review:
- Arabic-first names + English names (search-by-both, FR-12).
- A few with `aliases_json` (alias-only search, FR-13).
- A range of `price_minor`, `unit_pack_label` (e.g. `×20 أقراص`).
- At least one `controlled_substance: 1` and one `prescription_required: 1` (badge surfacing, C1).
- At least one `active: 0` (the `disabled` resolve path / excluded-from-search).
- Each product gets ≥1 `product_barcodes` row; one product gets a pack + unit barcode pair
  (collapses to one product, not ambiguous); optionally one barcode shared by two active
  products to demo the ambiguity block (FR-7) — keep it as a clearly-labelled pair.
- One product name with a `%` literal (pharma names carry it) to show LIKE-escape works.

Data lives in a `DEV_CATALOGUE_FIXTURE` constant (array of plain product+barcode records);
the loader maps each through `normalize()` and inserts.

## Architecture

```text
src/main/catalogue/dev-seed-catalogue.ts   (NEW)
  • DEV_CATALOGUE_FIXTURE: readonly product/barcode records (raw, no folds)
  • applyDevSeedCatalogueIfRequested({ isPackaged, env, db, logger }): boolean
      – isPackaged guard → env-flag guard → "already populated?" guard
      – for each fixture row: normalize() the fold cols, INSERT OR IGNORE
      – within a single db.transaction()

src/main/index.ts
  • one call site, next to the existing dev bypasses, after migrations run
    and before createWindow(): applyDevSeedCatalogueIfRequested({ isPackaged: app.isPackaged, env: process.env, db: dbHandle, logger: mainLogger })
```

The loader takes a narrow `db` handle (the `DatabaseHandle` interface already used by the
repo), so it unit-tests on sql.js with the full migration stack (reuse the
`catalogue-fixture.ts` helpers: `freshCatalogueDb` + `handleFor`).

## Testing (TDD, sql.js)

- **Gating:** packaged build → no-op (returns false, no rows) even with the env flag set;
  unpackaged + flag-off → no-op; unpackaged + flag-on → seeds (returns true, rows present).
- **Idempotency:** running twice inserts no duplicates (second call no-ops on the
  "already populated" guard; row count stable).
- **Fold correctness:** a seeded product is findable by `ProductRepo.search` using a folded
  query variant (e.g. different alef form), proving the seed's `name_fold` came from the real
  `normalize()`. A seeded barcode resolves via `lookupByBarcode`. (This is the real value —
  it proves the seed exercises the production read path, not just that rows exist.)
- **Flag/badge coverage:** the controlled / Rx / inactive rows are present with the right
  flag values.
- Tests call the loader directly with an injected `db` + fake `env`/`isPackaged`; no Electron.

## Out of scope
- Production seeding / real catalogue sync (that's the platform's job; 009 is read-only, AD-2).
- Any renderer change — T049a already mounts the surface; T049b only fills the read model in dev.
- A bridge/IPC surface — the loader runs in main at boot, never renderer-reachable.
