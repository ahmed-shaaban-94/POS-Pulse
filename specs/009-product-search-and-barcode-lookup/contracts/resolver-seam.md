# Contract: R7 Resolver Seam Wiring (`cart.resolveItemRef`)

**Feature ID:** 009-product-search-and-barcode-lookup
**Plan:** [../plan.md](../plan.md) (AD-3, AD-4, AD-6 / R7, R9)
**Upstream contract owner:** 005-sales-cart (`specs/005-sales-cart/contracts/bridge-api.md:416-427`)
**Created:** 2026-05-30
**Constitution version pinned:** v1.5.1

> This is the **keystone integration** of feature 009. 005 deliberately stubbed the
> `cart.resolveItemRef` seam with a fixture and left it **unwired in production**. 009 wires a real
> resolver behind the **fixed** signature. **009 does NOT change the seam signature** — that is 005's
> published contract; changing it would break 005's fixture tests and its handoff/receipt chain.

---

## The fixed seam signature (owned by 005 — reproduced, not redefined)

> **§A1 ratified 2026-05-30 (correction):** 005's **live** `ItemRefResolver`
> success shape (`src/main/cart/cart-bridge.ts:81`) is
> `{ kind: 'ok', display_name, unit_price_minor }` — it carries **no `version`
> field**. An earlier draft of this doc reproduced a `version` field that 005
> never shipped. The ratified decision is to satisfy 005's live signature and
> **defer `version`** (forward-looking provenance per R9; added later only as an
> additive change agreed with the 005 owner). The signature below is corrected
> accordingly.

```text
cart.resolveItemRef({ item_ref: string })
  → | { kind: 'ok', display_name: string, unit_price_minor: integer }
    | { kind: 'refused', reason: 'unknown_item' | 'disabled' | 'no_connection' | 'generic' }
```

(005 contracts/bridge-api.md:416-427; 005 research.md §R7. The `kind: 'ok'` wrapper and the two
fields are the contract 005's `cart.lines.add` consumes — it reads `display_name` + `unit_price_minor`
into the new line.)

## The injection point (005-side, currently unwired)

From 005's quickstart:
- `cart-bridge.ts` accepts a `resolveItemRef` **constructor option** (an `ItemRefResolver`).
- When omitted (production today), it falls back to `DEFAULT_ITEM_REF_RESOLVER`
  (`cart-bridge.ts:85-86`), which **refuses every `item_ref` generically**.
- In dev/test, `POS_PULSE_DEV_ITEM_RESOLVER=1` wires the **fixture** resolver
  (`src/main/cart/resolve-item-ref.ts`, ~5 fixture SKUs).

**009 wires the production resolver here:** `src/main/index.ts` (or the composition root that builds
the cart bridge) passes 009's `src/main/catalogue/resolve-item-ref.ts` as the `resolveItemRef` option,
replacing the generic-refusal fallback in production builds. The fixture path stays available for
005's own tests (unchanged).

## Field mapping (read model → seam output)

| Seam field | Source (009 read model) | Notes |
|:--|:--|:--|
| `display_name` | `products.name_ar` | The **single** Arabic-first name (AD-6; 008 renders one `display_name` per line). |
| `unit_price_minor` | `products.price_minor` | Carried verbatim; integer minor units; `Number.isSafeInteger`-guarded (AD-5). |
| ~~`version`~~ | `products.row_version` | **§A1: NOT in the seam** — 005's live seam never carried it. Deferred forward-looking provenance (AD-4 / R9); `products.row_version` stays in the read model, unconsumed by the cart, available if a future additive seam revision (agreed with the 005 owner) needs it. Distinct from `CartLine.version` (005 data-model.md:107). |

**Refusal mapping:**

| Seam `reason` | 009 condition |
|:--|:--|
| `unknown_item` | `item_ref` resolves to no product in the read model |
| `disabled` | product exists but `active = false` (FR-18 sellable guard) |
| `no_connection` | not used by 009 (lookup is local/offline — reserved by the seam) |
| `generic` | missing required field (e.g. invalid `price_minor`), or any other resolution failure (FR-19) — generic to the cashier; reason logged |

## What 009 carries but the seam does NOT thread downstream today (AD-6)

009's read model + its `catalogue.resolve` UI output carry the richer sellable surface — English name,
`tax_category`, `unit_pack_label`, barcode/SKU, controlled/Rx flags. **None of these pass through this
seam**, because the seam's fixed shape is `{ display_name, unit_price_minor }` (§A1). Verified
against 008:
- **Per-line tax/category is not threaded:** 008 locked **OQ-3 → sale-level VAT only for MVP**; the
  envelope lines carry no per-line tax.
- **English name is not threaded:** 008 `slice2-mapping-pass.md` renders **one `display_name` per
  line**; bilingual per-line receipt names were considered and **deferred for v1**.

These are **forward-looking provenance** in 009's read model (the brief's minimum fields; needed for
search/confirm). A future 008 revision that wants per-line tax or bilingual receipts consumes them
**additively** — at which point the seam (or a richer successor) is extended by agreement with 005, not
unilaterally by 009.

## Invariants

1. **Signature unchanged.** 009 satisfies the exact 005 signature; 005's fixture tests remain green
   (seam-contract test, plan Test Strategy).
2. **Read-only.** Resolution is a pure read; no catalogue write, no money math, no audit emission.
3. **Tenant-scoped.** Resolution filters `tenant_id = session.tenant_id` (P17); the `item_ref` of a
   tenant-A product never resolves for a tenant-B session.
4. **Production wiring is real, not fixture.** In packaged builds 009's resolver replaces
   `DEFAULT_ITEM_REF_RESOLVER`; the fixture resolver is test-only and never ships as the production
   path (mirrors 005 S2 security-review finding R7-SEAM).

---

**End of contract.** The seam signature is owned by 005; this document records how 009 satisfies and
wires it. Wiring lands in S4 under §A1 (ratified with the 005 surface owner).
