# 009 T049a — Catalogue live wiring (search-execution + screen composition + cart lifecycle)

**Feature:** 009-product-search-and-barcode-lookup · **Slice:** S5 (T049a) · **Date:** 2026-05-31
**Status:** Design — pending owner review.

## Problem

S2–S4 built every piece of the catalogue surface (search input, scan field, result
list, confirm panel + add controller, the main-process bridge + resolver) but **nothing
wires them into a running screen.** Two gaps make scan→confirm→add non-runnable today:

1. **(a) search→FSM execution is missing.** `ProductSearchInput.onSearch(query)` has no
   caller. Nothing calls `window.api.catalogue.search` / `lookupBarcode`, so the FSM never
   leaves `idle` → never reaches `confirm_pending` → the S4b confirm→add half never fires.
2. **(b) confirm→cart composition is missing.** The catalogue surface is mounted in no
   route; `CartPane` is mounted bare (no `onLineAdded` threaded); and **no renderer code
   calls `cart.create`**, so `useCartStore().activeCart` is permanently `null` → the
   controller has no `cartId`.

T049a closes both, in one PR, making the constitutional primary path runnable:
**scan/search → confirm → add to cart**, live, behind a fail-closed flag.

## Decisions (owner-ratified 2026-05-31)

| Fork | Decision |
|:--|:--|
| Scope | **Both (a)+(b) in one T049a PR** — interdependent; (b) is inert without (a). |
| Cart lifecycle | **Eager** — create a cart when the catalogue surface mounts with an active session, so a "current sale" cart always exists. `CatalogueAddController.cartId` is always valid → the S4b controller is unchanged. |
| Mount location | **Cart workspace** (`CartPlaceholder`, `/app/cart`) next to `CartPane` — search→confirm→add→line-appears all in one view. |
| Feature flag | **New `productSearch` flag** (009), fail-closed default `false`, mirroring `cart`/`payments`/`saleFinalization`. |

## Architecture

A new **`CatalogueSalePane`** container (renderer) is the composition root for the live
path. It is the ONLY new stateful piece; every existing component stays unchanged in
contract. It is mounted by `CartPlaceholder` only when **both** the `cart` flag (CartPane
must be present to receive lines) **and** the new `productSearch` flag are on.

```text
CartPlaceholder (/app/cart)
  └─ Workspace "Cart"
       ├─ CatalogueSalePane            ← NEW (gated: cart && productSearch)
       │    ├─ ProductSearchInput  (onSearch → wiring (a))
       │    ├─ ScanCaptureField    (onScan   → wiring (a), exact-lookup path)
       │    ├─ SearchResultList    (items from FSM `results`; onSelect → selectResult)
       │    └─ CatalogueAddController (cartId, onLineAdded → wiring (b))  [S4b, unchanged]
       └─ CartPane (onLineAdded={register})  ← now threaded
```

### Wiring (a) — search/scan → FSM execution

A `useCatalogueSearch` hook (or inline in `CatalogueSalePane`) owns the bridge calls and
drives the FSM. It reads the bridge via a `readCatalogueBridge()` / `_testBridge` seam
mirroring CartPane:

- **Typed search** (`ProductSearchInput.onSearch(q)`): `beginSearch(q)` → `await
  catalogue.search({ query: q })` → map response:
  - `results` → `resolveResults(items, truncated)`
  - `not_found` → `resolveNotFound()`
  - `too_short` → `clear()` (defensive; the input already min-2-guards)
  - `catalogue_unavailable` → `resolveCatalogueUnavailable()`
  - `refused` → `clear()` (generic; gate failure is renderer-invisible)
- **Scan** (`ScanCaptureField.onScan(code)`): `beginSearch(code)` → `await
  catalogue.lookupBarcode({ barcode: code })` → map:
  - `one` → `resolveSingleMatch(product)` (→ `confirm_pending`, FR-5)
  - `not_found` → `resolveNotFound()`
  - `ambiguous` → `resolveAmbiguous()` (FR-7)
  - `catalogue_unavailable` → `resolveCatalogueUnavailable()`
  - `refused` → `clear()`

**Stale-response guard:** each FSM setter already no-ops unless state is `searching`
(verified in `catalogueSearchStore`), so a slow response that arrives after a newer
`beginSearch` is dropped. The hook relies on that; it does not add its own race handling.

**Typed-vs-scan distinction:** `ProductSearchInput` fires `onSearch` for both typed and
its own Enter. To keep the two intents distinct without changing the input's contract,
`CatalogueSalePane` routes `ProductSearchInput.onSearch` → typed `search`, and
`ScanCaptureField.onScan` → exact `lookupBarcode`. (The input's Enter path remains a typed
search submit; the dedicated wedge field is the barcode path. This matches S0: two distinct
surfaces — a name search box and a scan-capture field.)

### Wiring (b) — confirm → cart + lifecycle

- **Eager cart create:** on mount with an active operator session and `activeCart === null`,
  `CatalogueSalePane` calls `cart.create({ idempotency_key })` once and, on `ok`, calls
  `useCartStore().applyCartCreated(cart_id)`. Idempotency key is stable per mount so a
  re-render never double-creates. This is the SOLE renderer `cart.create` caller.
- **onLineAdded thread:** CartPane's `onLineAdded` is a *register-callback*
  (`(addLine) => void` — it hands its internal fn up). `CatalogueSalePane` captures that
  `addLine` ref and passes a thin `(res) => addLine(res)` to `CatalogueAddController`. The
  controller is unchanged (its `onLineAdded` is the actual `(res) => void`).
- **No new mutation path:** the controller still calls `cart.lines.add` and forwards the
  confirmed result; CartPane still owns the line list (FR-20 preserved).

### Feature flag `productSearch`

- `src/shared/app-config.ts`: add `productSearch?: boolean` to `AppConfig.features`.
- `src/main/index.ts` `getAppConfig`: read `POS_PULSE_FEATURE_PRODUCT_SEARCH` with the same
  truthy contract (`1|true|yes|on`), default false.
- `feature-flags-store.ts`: add `productSearch: boolean` to state, the `hydrate` param, and
  `INITIAL` (false).
- `CartPlaceholder`: mount `CatalogueSalePane` only when `cart && productSearch`.

## Empty-catalogue caveat (call out, don't solve here)

`products` ships **empty** (AD-2, migrations seed nothing). So a real packaged build
exercises only `catalogue_unavailable` / `not_found` — **not** the happy path. The happy-path
demo and the S5 review tasks (T050 screenshot review, T056 keyboard walkthrough) need seeded
fixture data. **Seeding is OUT OF SCOPE for T049a**; T049a's tests use the injected bridge
(`_testBridge`) returning scripted `results`/`one`, exactly as S4b. A dev-only seed (a small
fixture loader behind a dev flag, or a documented manual insert) is tracked separately as a
prerequisite for T050/T056 — flagged, not built here.

## Testing (TDD, injected bridge — decoupled from the real read model)

- **`CatalogueSalePane` test:** typed `onSearch` → `search` bridge called → FSM `results`;
  scan `onScan` → `lookupBarcode` → FSM `one`→`confirm_pending`; each response kind maps to
  the right FSM setter; `not_found`/`ambiguous`/`unavailable`/`refused` mapped; eager
  `cart.create` fires once on mount with a session and not when `activeCart` already set;
  `onLineAdded` register-callback captured and a confirmed add reaches `addLine`.
- **`CartPlaceholder` gating test:** surface mounts only when `cart && productSearch`; hidden
  when either is off (fail-closed).
- **Flag test:** `getAppConfig` truthy-contract for `productSearch`; store hydrate/default.
- All renderer tests inject the bridge + a fake session; no real catalogue rows needed.

## Files

| File | Change |
|:--|:--|
| `src/renderer/ui/catalogue/CatalogueSalePane.tsx` | **NEW** — composition root + wiring (a)+(b). |
| `src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx` | **NEW** — wiring tests. |
| `src/renderer/routes/app/CartPlaceholder.tsx` | Mount `CatalogueSalePane` under `cart && productSearch`; thread `CartPane.onLineAdded`. |
| `src/renderer/stores/feature-flags-store.ts` | Add `productSearch` (state + hydrate + INITIAL). |
| `src/shared/app-config.ts` | Add `productSearch?` to `features`. |
| `src/main/index.ts` | `getAppConfig`: read `POS_PULSE_FEATURE_PRODUCT_SEARCH`. |
| `src/renderer/main.tsx` | (verify hydrate passes the new flag through — `cfg.features` spread already covers it.) |
| `specs/009-.../tasks.md` | Mark T049a done with as-built notes. |

## Out of scope (tracked, not built)

- **Fixture/seed data** for a live happy-path demo (prerequisite for T050/T056).
- **Sales-surface placement** (rejected — Cart workspace chosen).
- **Cart void/handoff from the catalogue surface** (005/006 territory; the cashier uses
  CartPane's existing controls).
