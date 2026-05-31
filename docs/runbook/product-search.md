# 009 — Product Search & Barcode Lookup — Support Runbook

**Feature:** `specs/009-product-search-and-barcode-lookup`
**Authored:** 2026-05-31 (T052 — support runbook + failure-mode catalogue).
**Constitution clause:** §P15 (Production Readiness Gates — production-affecting
features MUST ship a support runbook before rollout).

> **Status note.** Authoring this runbook clears the §A5 task **T052** (support
> runbook + failure-mode catalogue). It does **not** clear the §A5
> production-readiness sign-off, nor any hardware / owner / security gate (the
> sibling §A5 readiness tasks T051/T053 and any owner bring-up decision remain
> owner/reviewer-gated).

This runbook is for support engineers and on-call operators diagnosing 009
behaviour in the field — the cashier's two ways of finding a sellable product at
the till: **scanning a barcode** (keyboard-wedge HID) and **typing a search** (by
SKU, barcode, or Arabic/English name).

**Read this before anything else — the posture that shapes every diagnosis.**
009 is **read-and-resolve only**. It performs **no writes** (it never
INSERT/UPDATE/DELETEs the `products` or `product_barcodes` read model — AD-2) and
makes **no network round-trip during checkout** (offline-first, FR-23). Two
consequences for support:

1. **You cannot "fix a row from the POS."** Catalogue data (a wrong price, a
   duplicate barcode, an inactive flag) is owned by a future
   catalogue-sourcing feature, **upstream on the platform**. POS-Pulse only
   reads it. Catalogue corrections are an upstream platform action; POS-Pulse
   itself is forward-fixed only in code.
2. **There is no rollback / down-migration concern here.** 009 holds no durable
   financial state and writes nothing, so there is no row to repair or revert
   from the terminal — unlike 008 (sales). Diagnosis is therefore inherently
   read-only: you inspect the read model, you do not mutate it.

Every SQL query below was checked against the shipped migrations
`migrations/0029_create_products.sql` and `migrations/0030_create_product_barcodes.sql`.
The read model has **no `FOREIGN KEY`** clauses (logical FKs only, per the
`0004_audit_events.sql` precedent) and **no append-only trigger** (it is a read
model, not an audit anchor). Note that the production lookup queries always
restrict to `active = 1` and scope by `tenant_id`; the **diagnostic** queries
below deliberately **drop the active filter** so you can see what the cashier
cannot. Always substitute the affected terminal's `tenant_id` for `:tenant_id`.

**A note on logs.** The cashier-facing surface is generic by design (NFR-7): the
specific reason behind a refusal or an "unavailable" state is **not** shown at
the till. In the shipped 009 code the catalogue repo handles a failed read by
returning a generic signal (it does **not** emit a production diagnostic log line
of its own — failures are swallowed into the `unavailable` / generic result).
So **do not expect a log field naming the exact reason** — the authoritative
diagnostic is direct read-model inspection, which is what this runbook leans on.
Any diagnostic that *is* emitted is held to the project's redaction allowlist
(NFR-7; see `src/main/catalogue/__tests__/redaction.smoke.test.ts`) — no PII, no
credential fragment, no raw catalogue payload beyond the permitted snapshot
fields.

The 7 cashier-visible FSM states (from
`src/renderer/stores/catalogueSearchStore.ts`) are referenced throughout:
`idle` / `searching` / `results` / `confirm_pending` / `not_found` /
`ambiguous` / `catalogue_unavailable`.

---

## T052(a) — "A scan finds nothing / product not found" (FSM: `not_found`)

**First, decide whether this is even a fault.** The cashier sees one generic
"Product not found" state (FSM `not_found`, FR-6), but in the data that single
state has **three** distinct underlying causes — and the cashier cannot tell them
apart by design. The production lookup (`src/main/catalogue/product-repo.ts`,
`lookupByBarcode` / `lookupBySku`) JOINs to `products` **with `active = 1`**, so an
**inactive** product and a **genuinely absent** product both surface as
`not_found` (FR-18: an inactive match is treated as not-found-for-selling). Your
job is to recover the distinction the cashier surface intentionally hides.

Run these against the affected terminal's DB. **They drop the `active = 1` filter**
that the production path applies, so they can see inactive rows:

```sql
-- 1) Is the SCANNED BARCODE mapped at all? (drops the active filter)
--    barcode_norm is the normalized exact-lookup key the repo matches on.
SELECT pb.barcode, pb.barcode_norm, pb.barcode_kind,
       p.product_id, p.name_ar, p.sku, p.active
  FROM product_barcodes pb
  LEFT JOIN products p
    ON p.product_id = pb.product_id AND p.tenant_id = pb.tenant_id
 WHERE pb.tenant_id = :tenant_id
   AND pb.barcode_norm = :barcode_norm;   -- normalized value, not the raw scan

-- 2) Or, for a typed SKU lookup — does the SKU exist regardless of active?
SELECT product_id, sku, name_ar, active
  FROM products
 WHERE tenant_id = :tenant_id
   AND sku_norm = :sku_norm;
```

Interpret the result:

| What query (1)/(2) shows | Meaning | Action |
|:--|:--|:--|
| No `product_barcodes` row at all for the barcode | The barcode is genuinely **not in the catalogue**. | Upstream catalogue data gap — the product/barcode needs to be added by the **sourcing feature** (out of 009 scope; an "add product" flow does not exist in 009). Not a POS-Pulse fault. |
| A `product_barcodes` row exists but its `product_id` has no matching `products` row | A **dangling mapping** (barcode points at a product that isn't in the read model). | Upstream catalogue integrity fix. 009 correctly treats a dangling/inactive mapping as not-found-for-selling. |
| A `products` row exists but `active = 0` | The product is **inactive / non-sellable** (FR-18). This is **correct behaviour** — an inactive product is supposed to be unsellable and shows as not-found. | If it *should* be sellable, the `active` flag is fixed **upstream** in the catalogue, not on the POS. Otherwise, not a fault. |
| A `products` row exists, `active = 1` | The product **should** have resolved. Re-check the normalization: the query matches on `barcode_norm` / `sku_norm`, not the raw value. Confirm the scanned/typed value folds to the stored norm via `src/main/catalogue/normalize.ts`. | If the norms genuinely match and it still returns not-found, that is a real defect — forward-fix in code. |

`active`-vs-absent is a **diagnostics-only** distinction: the cashier always sees
the same generic recoverable "Product not found" with the scanned value echoed
back, ready for retry. That is correct and is **not** a hard error (FR-6).

---

## T052(b) — "This barcode matches more than one product (ambiguous)" (FSM: `ambiguous`)

**This is working as designed, and the fix is upstream — not in POS-Pulse.**
When one barcode value maps to **two or more distinct active products**, 009
**refuses to guess**: it adds nothing to the cart and surfaces a generic
"this barcode matches more than one product — resolve in the catalogue" state
(FSM `ambiguous`, FR-7). The repo detects this with `COUNT(DISTINCT product_id)`
on the matched rows (`discriminate()` in `product-repo.ts`); a single product
carrying several barcodes (pack + unit) is **not** ambiguous — that collapses to
one `product_id` and resolves normally.

Because 009 is read-only, the correction is a **catalogue data fix upstream**
(resolve the duplicate barcode mapping in the sourcing system), **not** a
POS-Pulse change. Find the conflicting rows:

```sql
-- Which distinct ACTIVE products does this barcode resolve to?
-- >1 row here is the ambiguity block (FR-7).
SELECT DISTINCT p.product_id, p.name_ar, p.sku, p.active
  FROM product_barcodes pb
  JOIN products p
    ON p.product_id = pb.product_id AND p.tenant_id = pb.tenant_id
 WHERE pb.tenant_id = :tenant_id
   AND pb.barcode_norm = :barcode_norm
   AND p.active = 1;
```

| Distinct active `product_id` count | Meaning | Action |
|:--|:--|:--|
| 1 (possibly several rows, same `product_id`) | **Not ambiguous** — one product with pack + unit barcodes. If the cashier saw `ambiguous`, re-run without `DISTINCT` to confirm the rows really share one `product_id`. | Not a fault; should have resolved to `confirm_pending`. |
| ≥ 2 | **Genuine ambiguity** — two sellable products share one barcode. | Hand the conflicting `product_id` / `sku` pair to the catalogue owner to **deduplicate the barcode upstream**. 009 will keep blocking until the data is corrected. |

009 never silently picks one (SC-5: zero silent guesses). Do not look for a
POS-side setting to "prefer" a product — there isn't one, by design.

---

## T052(c) — "Catalogue unavailable / system not ready" (FSM: `catalogue_unavailable`)

**This is distinct from "product not found" and demands a different response —
escalate, do not tell the cashier to retype.** When the local read model is
**empty, missing, or unreadable**, every lookup returns a single generic
"catalogue unavailable" state (FSM `catalogue_unavailable`, FR-24). It tells the
cashier the **system is not ready** (get help / escalate), whereas `not_found`
tells the cashier to **retype**. The specific reason (empty vs missing vs
unreadable) is **not** distinguished at the till and, per the log note above, is
not emitted as a named production log field — confirm it by inspection.

Critically, this is **not** the offline / connection banner. **003 owns network
state**; 009 makes no network call during checkout (FR-23). A
`catalogue_unavailable` state is a **local read-model fault regardless of
network** — the terminal can be perfectly online and still show it, and can be
fully offline and still resolve products if the read model is populated.

Confirm the read model on the affected terminal. The repo's discriminator is
literally `SELECT 1 FROM products LIMIT 1` (the `catalogueHasRows()` check), and
**any throw** from a missing table / unreadable handle is also funnelled to
`unavailable`:

```sql
-- Does the products table exist? (no row = missing/migration not applied)
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products';

-- Is it populated for this tenant? 0 = empty read model (ships empty until a
-- sourcing feature populates it — FR-24 / R-RISK-2).
SELECT COUNT(*) AS product_count
  FROM products
 WHERE tenant_id = :tenant_id;
```

| Observation | Underlying reason | Action |
|:--|:--|:--|
| `sqlite_master` returns no `products` row | **Missing** — the 009 migration (`0029`/`0030`) never ran on this terminal. | Apply migrations (verify the migration runner reached `0030`). |
| Table exists, `product_count = 0` | **Empty** — 009 ships the tables empty; nothing has populated them. This is the **expected day-one state** until a catalogue-sourcing feature lands. | Escalate to catalogue provisioning — the upstream sourcing capability must populate the read model. Not a 009 defect. |
| Table exists, rows present, but lookups still say unavailable | **Unreadable** — the DB handle threw on read (corruption, lock, permissions). | Investigate the SQLite file / handle health on the terminal; this is an infra fault, not a catalogue-data fault. |

A populated, readable catalogue that simply has no match for *this* query is
`not_found` (T052(a)) — **not** `catalogue_unavailable`. Keeping these two apart
is the whole point of SC-10.

---

## T052(d) — "Can't add this item / generic add failure" (FSM: `confirm_pending` → refused)

**A product was found and confirmed, but the add was refused with a generic,
safe message — and no partial line was created.** This is FR-19 / FR-22: a
resolved product missing a field downstream needs (e.g. a `price_minor` that is
not a safe integer) is refused **generically**; the cashier never sees the
technical reason (NFR-7), and no partial cart line is written (SC-8).

**Where this is decided — and why the message is generic.** The add goes through
**005's existing cart boundary** (`cart.lines.add`, FR-20); 009 introduces no
parallel cart-mutation path. That handler receives only an **opaque `item_ref`
plus the quantity** (the request shape is `{ cart_id, item_ref, quantity }`) and
then calls 009's R7 resolver (`src/main/catalogue/resolve-item-ref.ts`), which
**re-reads `name_ar` and `price_minor` authoritatively from the DB**. No
renderer-supplied price or name is ever trusted. The resolver maps:

| Resolver outcome | Refusal `reason` | Cause |
|:--|:--|:--|
| Product not found by `product_id` | `unknown_item` | The `item_ref` resolved to no row (e.g. catalogue changed between confirm and add). |
| Product exists but `active = 0` | `disabled` | Sellable guard (FR-18). |
| Found, but `price_minor` fails `Number.isSafeInteger` | `generic` | Corrupt/out-of-range price — the money guard (FR-19 / AD-5). |
| Found, but read model unavailable | `generic` | Local lookup has no `no_connection` use; an unresolvable read is generic to the cashier. |

The cashier sees a single generic refusal in every case **by design** — the
specific `reason` is for diagnostics only and is never leaked to the till
(NFR-7). To diagnose a `generic` refusal on a product that *looks* fine, inspect
the price (this is the load-bearing guard — the migration's `CHECK (price_minor
>= 0)` does **not** bound the upper end, so a corrupt large value passes the
constraint but fails the resolver's `Number.isSafeInteger`):

```sql
SELECT product_id, name_ar, price_minor, active, tax_category, unit_pack_label
  FROM products
 WHERE tenant_id = :tenant_id
   AND product_id = :product_id;
```

If `price_minor` is not a safe integer (or `name_ar` is somehow absent — it is
`NOT NULL` in schema, so this would itself indicate corruption), the catalogue
row is the problem and must be fixed **upstream**. POS-Pulse correctly refuses
rather than booking a bad money value into the cart.

---

## T052(e) — "Search/scan does nothing for a signed-out operator" (not a bug)

**Working as designed — this is the session gate, not a fault.** Every
`catalogue.*` operation (lookup / search / resolve) is gated at the preload
bridge on an **active operator session** (NFR-6a), in
`src/main/catalogue/require-catalogue-session.ts` — the first executable step of
every handler in `src/main/catalogue/catalogue-bridge.ts`. With no session, the
gate returns a **generic refusal** (`reason: 'no_session'`); a wrong-tenant
resource returns `reason: 'tenant_isolation'` (P17). The `reason` is for
diagnostic logging only — **never echoed to the cashier**.

Two points that matter for triage:

- **The renderer is never load-bearing.** The product read model is
  main-process (SQLite); every lookup crosses the bridge regardless, so any
  renderer-side check is defence-in-depth only. You cannot "search but not add"
  — there is no looser gate on the search path than on the cart's add path
  (NFR-6a). If a cashier reports search working without a session, *that* would
  be the defect to chase.
- **The expected symptom** is simply that nothing happens (the lookup is refused
  before it ever touches the read model). Confirm an active operator session
  exists (per 004) before treating dead search/scan as a catalogue problem.

There is **no role gate** beyond an active session — cashier, manager, and admin
all look up products identically (NFR-6a). So "this user can't search but that
one can" is **not** expected and points at a session-state difference, not a
permission tier.

---

## T052(f) — "The catalogue looks out of date" (staleness is invisible — not a 009 state)

**009 owns no freshness marker, so this is neither a 009-surfaced state nor a
009 fault (FR-24a).** 009 reads whatever the read model currently contains; it
does **not** observe, compute, or surface catalogue staleness / not-yet-synced
status. There is no "last synced" indicator, no stale banner, and no FSM state
for staleness — the 7 cashier-visible states are exhaustively
`idle` / `searching` / `results` / `confirm_pending` / `not_found` /
`ambiguous` / `catalogue_unavailable`, and none of them mean "stale."

If the catalogue's *contents* are wrong or out of date (missing a new product, a
stale price), that is the **upstream catalogue-sourcing feature's** responsibility
— the capability that fills and refreshes the read model, which is explicitly out
of 009's scope (see spec §Dependencies). A future sourcing feature that adds a
freshness marker would be a future amendment; surfacing staleness is **not** part
of 009. Do not file a 009 bug for "the catalogue looks out of date" — route it to
catalogue provisioning.
