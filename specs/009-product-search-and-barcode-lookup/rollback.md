# 009 — Product Search & Barcode Lookup — Rollback Strategy

**Feature:** `specs/009-product-search-and-barcode-lookup`
**Authored:** 2026-05-31 (Slice S5 — T053 rollback strategy).
**Constitution clause:** §P15 (Production Readiness Gates — production-affecting
features MUST ship a rollback strategy before rollout).

> **Status note.** Authoring this note clears the §A5 task **T053** (rollback
> strategy). It does **not** clear the §A5 production-readiness sign-off, nor any
> owner/hardware/security gate (e.g. the NFR-1/NFR-2 performance bring-up on
> target hardware, the S2 bridge security review). Those remain owner/reviewer-gated.

This note is for the on-call operator or release owner who needs to back 009 out of
a build, or disable it in the field, after a defect. Read §1 first: for almost
every 009 defect the correct response is a **forward code fix**, not a rollback.

---

## §1. Posture: forward-fix preferred

**The default response to a 009 defect is a forward code fix, not a rollback.**
This is not a stylistic preference — it follows from what 009 actually is:

- **009 writes nothing.** 009 is **read-only** over the local catalogue read model
  (AD-2; spec FR-3 — "this feature reads it but does NOT author it"). It exposes
  only the read-only `catalogue.*` bridge handlers (`lookupBarcode`, `lookupSku`,
  `search`, `resolve`) and has **no** insert/update/delete path for product rows
  (data-model.md §"Entity: Product" invariant 6, §"Entity: ProductBarcode"
  invariant 4). A bug in 009 therefore **cannot corrupt** sales, cart, payment, or
  catalogue data — there is no write to corrupt.
- **The schema is additive-only.** The two migrations
  (`migrations/0029_create_products.sql`, `migrations/0030_create_product_barcodes.sql`)
  are pure `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`. They add
  two new read-model tables and their indexes; they **ALTER no existing table** and
  **insert zero rows** (the tables ship empty — FR-24 / R-RISK-2). No existing data
  is touched at install time, so there is no irreversible state change to undo.
- **The surface is flag-gated and fail-closed.** The whole 009 UI is behind the
  `productSearch` feature flag, fail-closed by default (`src/shared/app-config.ts`,
  `src/renderer/stores/feature-flags-store.ts`). Nothing 009 adds is reachable
  until the flag is on.
- **Offline-first, no network in the lookup path.** 009 makes **no** network call
  during search/scan/resolve (spec FR-23; Constitution I). There is no in-flight
  external state to drain or reconcile on rollback.

Because no irreversible state exists, a 009 defect is recovered by shipping a
corrected build through the normal slice/CI pipeline. The levers in §2 are the
disable/back-out options when a forward fix is not fast enough.

---

## §2. The rollback levers (least- to most-disruptive)

> **Read this first — two distinct mechanisms, do not conflate them.** The
> `productSearch` flag gates **only the renderer UI surface**
> (`src/renderer/routes/app/CartPlaceholder.tsx:51` — the catalogue pane mounts
> only when `cart` is on and `productSearch` is on). The production R7 resolver in
> the **main** process is wired into 005's `cart-bridge.ts` **unconditionally**,
> independent of the flag (`src/main/index.ts:605–621` — `createCatalogueResolver`
> is always passed as `productionResolver`). So a flag-flip and a code-revert disable
> 009 by **different** mechanisms; the table below states each precisely.

### Lever 1 — Flag flip (`productSearch` off) — preferred disable

**Mechanism.** `productSearch` is a **runtime environment variable**
(`POS_PULSE_FEATURE_PRODUCT_SEARCH`, parsed in `src/main/index.ts:435–438`;
accepts `1|true|yes|on`). It is **not** a build-time constant — disabling it needs
**no binary rebuild and no redeploy**. Set the env var to a falsy value (or unset
it; default is fail-closed `false`).

**Caveat — needs a restart, not instant.** The renderer reads the flag map **once
at boot** via `app:config` (`src/renderer/main.tsx:44` hydrate; the `AppConfig`
contract is documented as a startup-only read in `src/shared/app-config.ts`). So a
flag flip takes effect on the **next app launch** — it is not a hot toggle.

**Effect.** The 009 catalogue search/scan/confirm surface disappears from the cart
workspace. 005's cart pane is untouched and behaves **exactly as it did before 009
shipped** — see the note below on what "untouched" does and does not mean.

**What this does NOT do.** A flag flip does **not** unwire the main-process
resolver. `catalogueResolver` stays installed in `cart-bridge.ts`. There is simply
no 009 UI driving the `catalogue.*` handlers or the confirm-first add. This is
fine: the resolver is read-only and inert when nothing calls it. If the defect is
in the resolver/repo itself (not just the UI), prefer Lever 2.

### Lever 2 — Code revert (revert the 009 PRs)

**Mechanism.** Revert the 009 implementation PRs. With 009's main wiring gone,
`createCartBridgeHandlers` is constructed **without** a `productionResolver`, so
`wire-cart-handlers.ts` omits the `resolveItemRef` dep and `CartBridgeHandlers`
falls back to `DEFAULT_ITEM_REF_RESOLVER` — the generic-refusal stub
(`src/main/cart/cart-bridge.ts:85–86`, `:306`; `wire-cart-handlers.ts:54–56,79–83`).
This is the **pre-009** seam behaviour (005 left the seam stubbed and unwired).

**On the migrations.** The schema is additive, so the two read-model tables can be
**left in place** after a code revert — an unused read-model table is **inert**
(no triggers, no writers, no readers once 009 code is gone). No existing data is
touched. Alternatively, drop them via a forward down-migration if a clean slate is
desired (Lever 3). Either way, **no existing data is mutated.**

**Effect on 005.** 005's cart reverts to its pre-009 add behaviour: the
`resolveItemRef` seam refuses generically, so the cart cannot resolve a product to
a line — exactly as before 009 shipped. **No breakage, no data loss** — but note
this is *not* a cart that can add products by lookup; that capability **is** 009.
The honest statement is "005 behaves exactly as it did before 009," not "the cart
still fully functions" in the add-by-lookup sense.

### Lever 3 — Drop the read-model tables (only if truly desired)

**Mechanism.** A forward down-migration dropping `product_barcodes` then `products`
(reverse FK/logical-dependency order).

**Assessment — unnecessary and low-value.** The tables are **inert** when 009 code
is absent: no append-only trigger, no writer (009 never writes them; the future
sourcing feature does not exist yet), no reader. Leaving them costs only schema
surface. Dropping them touches no existing financial/cart data either way, so this
lever exists for hygiene only and is **not** recommended as a rollback step.

---

## §3. Why rollback is low-risk

Each property below is the reason a 009 rollback cannot lose or corrupt state,
tied to its source:

- **Read-only (AD-2; spec FR-3; data-model.md invariants).** 009 has no write
  path. Backing it out removes a reader, never an authoritative writer — there is
  no half-written state to leave behind.
- **Additive-only migrations (`0029`, `0030`).** Pure `CREATE TABLE/INDEX IF NOT
  EXISTS`, zero seed rows, no `ALTER` of existing tables. Install touched no
  existing data; back-out touches none.
- **Fail-closed flag (`src/shared/app-config.ts`; `feature-flags-store.ts`).** The
  surface is off by default. Disabling is the system's natural resting state, not a
  forced exception.
- **Offline-first lookup (spec FR-23; Constitution I).** No network round-trip in
  search/scan/resolve, so there is no in-flight remote operation to abort or
  reconcile.
- **Fixed R7 seam with a generic-refusal fallback (AD-3; `cart-bridge.ts:85–86`,
  `:306`).** 009 satisfies 005's **fixed** seam signature and changes nothing about
  it. Remove 009's resolver and the seam reverts to `DEFAULT_ITEM_REF_RESOLVER`'s
  generic refusal — a defined, tested, pre-009 state, not undefined behaviour.

**The dev seed is irrelevant to a production rollback.** The dev-only catalogue
seed (`src/main/catalogue/dev-seed-catalogue.ts`) is **fail-closed on packaged
builds**: `isPackaged === true` short-circuits unconditionally and the
`POS_PULSE_DEV_SEED_CATALOGUE` env var is never consulted in a packaged build (file
header, lines 9–15). It is **not** production data — production catalogue population
is the platform's job (a future sourcing feature; AD-2 / R-RISK-2). A production
rollback never has to consider it.

---

## §4. Explicitly out of scope for this rollback

- **Production catalogue data is owned by the platform, not by 009.** 009 ships the
  read model **empty** and never populates it (AD-2; R-RISK-2). There is no 009
  catalogue data to roll back — production rows, if any, are owned and managed by a
  future catalogue-sourcing feature, under its own rollback story.
- **Egyptian VAT / fiscal concerns are not 009's.** 009 carries `price_minor` as a
  conduit and performs **zero** arithmetic — no subtotal, tax, rounding, or change
  (AD-5; Constitution P1). Tax/VAT/fiscal rollback belongs to 006/008, not here.
- **Catalogue staleness is unobservable to 009 (FR-24a).** 009 owns no freshness
  marker; staleness / not-yet-synced is **not** a surfaced state and is deferred to
  a future sourcing feature. There is no staleness state to reset on rollback.

---

## §5. Decision table — symptom → preferred response

| Symptom | Preferred response | Lever |
|:--|:--|:--|
| Search ranking / display / folding bug, lookup still safe | **Forward-fix** — ship a corrected build | §1 |
| UI surface defect; want it gone fast, no rebuild available | **Flag flip** off (env var; takes effect next launch) | §2.1 |
| Resolver / repo / tenant-scoping defect (main-process path) | **Code revert** the 009 PRs (seam falls back to generic refusal) | §2.2 |
| Catalogue surface causing field confusion; cart must stay as-was | **Flag flip** off — 005 cart behaves exactly as pre-009 | §2.1 |
| Need a clean schema slate (hygiene only — not for safety) | Code revert, then optional down-migration drop | §2.2 + §2.3 |
| Suspected data corruption from 009 | **None applicable** — 009 writes nothing; investigate elsewhere | §1 / §3 |

---

*009 is read-only, additive-only, offline-first, and flag-gated. Forward-fix is the
default; the levers above exist for fast disable/back-out and none of them can lose
or corrupt existing data.*
