# Contract: `catalogue.*` Bridge API

**Feature ID:** 009-product-search-and-barcode-lookup
**Plan:** [../plan.md](../plan.md)
**Spec:** [../spec.md](../spec.md)
**Data model:** [../data-model.md](../data-model.md)
**Created:** 2026-05-30
**Constitution version pinned:** v1.5.0

> The `catalogue.*` preload-bridge namespace is the **trust boundary** between the renderer and the
> main process for product lookup (Constitution Principle III; AD-1). Every handler is gated at the
> bridge surface; renderer-side checks are secondary UX defence only and are NEVER load-bearing. The
> namespace is **read-only** — there is no insert/update/delete handler (009 never writes the
> catalogue; AD-2).

---

## Bridge gating — `requireOperatorSession`

Every handler in the `catalogue.*` namespace MUST begin with:

```text
const session = requireOperatorSession({})   // active session required; no extra role restriction
```

The helper is 004's (`src/main/operator/role-enforcement.ts`), the same one 005 uses. Failure modes
(all **generic** — no factor-distinguishing wording; reason in payload for diagnostic logging only,
never echoed to the cashier):

| Condition | Result |
|:--|:--|
| No active session | `{ kind: 'refused', reason: 'no_session' }` (004 FR-005/FR-016) |
| Tenant mismatch (query/result crosses tenant) | `{ kind: 'refused', reason: 'tenant_isolation' }` (P17) |
| Read model empty / missing / unreadable | `{ kind: 'catalogue_unavailable' }` (FR-24; distinct from not-found) |

There is **no role gate beyond an active session** (NFR-6a): cashier, manager, admin all look up
products. There is no looser gate (no paired-terminal-only path) — that would create a
search-but-can't-add dead window.

---

## Handler list (canonical names)

### `catalogue.lookupBarcode`

Exact barcode lookup (FR-4).

**Request:** `{ barcode: string }`

**Response:**

```text
| { kind: 'one',        product: ProductSnapshotDisplay }   // exactly one active product → confirm-first
| { kind: 'not_found' }                                     // zero matches (FR-6)
| { kind: 'ambiguous' }                                     // >1 active product for this barcode (FR-7)
| { kind: 'catalogue_unavailable' }                         // empty/missing/unreadable (FR-24)
| { kind: 'refused', reason: 'no_session' | 'tenant_isolation' }
```

**Effects:** none (pure read). The barcode is normalized (`normalize.ts`) before matching
`product_barcodes.barcode_norm` within `tenant_id`, joined to `active` products. `not_found` is
**distinct** from `catalogue_unavailable` (FR-24). On `one`, the renderer shows the confirm panel
(confirm-first; owner decision); the add itself goes through 005's `cart.lines.add` (NOT this
namespace).

### `catalogue.lookupSku`

Exact SKU lookup (FR-9). Same response shape as `lookupBarcode` (an SKU is unique per tenant, so
`ambiguous` should not normally occur, but the shape carries it for safety).

**Request:** `{ sku: string }`

### `catalogue.search`

Folded substring name/alias search (FR-11/12/13). Typed input; debounced + min-length enforced
renderer-side (R8), but the bridge ALSO guards: an empty/too-short normalized query returns
`{ kind: 'too_short' }` rather than scanning (FR-16; defence-in-depth).

**Request:** `{ query: string }`

**Response:**

```text
| { kind: 'results', items: ProductSnapshotDisplay[], truncated: boolean }   // ranked, ≤20 (NFR-4)
| { kind: 'not_found' }                                                       // zero matches
| { kind: 'too_short' }                                                       // < 2 normalized chars (FR-16)
| { kind: 'catalogue_unavailable' }
| { kind: 'refused', reason: 'no_session' | 'tenant_isolation' }
```

**Effects:** none. The query is folded by the *same* `normalize.ts` as the stored `name_fold` /
`alias_fold` (FR-12b), substring-matched, ranked (exact-prefix > mid-string), capped at 20
(`truncated = true` when exceeded → UI says "refine"). Manually typed barcode values are routed by the
renderer to `lookupBarcode` (FR-10), not `search`.

### `catalogue.resolve`

Resolves a chosen product to the snapshot for confirm-and-add. Used after a `search` selection (a
`lookupBarcode`/`lookupSku` `one` result already carries the snapshot).

**Request:** `{ product_id: string }`

**Response:**

```text
| { kind: 'ok', snapshot: ProductSnapshotDisplay, seam: ResolvedSeam }
| { kind: 'refused', reason: 'unknown_item' | 'disabled' | 'missing_required_field' | 'generic' }
| { kind: 'catalogue_unavailable' }
```

`ResolvedSeam` is exactly the 005 seam success shape `{ display_name, unit_price_minor, version }`
(see [resolver-seam.md](./resolver-seam.md)). A product missing a required field (e.g. `price_minor`)
→ `missing_required_field` (generic to the cashier; blocks add per FR-19/FR-22). An `active = false`
product → `disabled`.

---

## What this namespace does NOT do

- **It does not mutate the cart.** Adding a confirmed product goes through 005's `cart.lines.add` from
  the renderer (FR-20). Duplicate scan → 005's Q4 merge increments the existing line (FR-21).
- **It does not write the catalogue.** No insert/update/delete handler exists (AD-2).
- **It does not compute money.** `price_minor` is carried verbatim (AD-5).
- **It emits no audit events.** Lookups are not sensitive actions (plan P4/P10 N/A-read-only).

---

## Redaction (NFR-7)

`catalogue.*` payloads logged for diagnostics MUST be redacted: no raw query echo that could carry PII
beyond what the permitted snapshot fields allow, no product field beyond the permitted snapshot set,
no credential fragment. The refusal `reason` is logged but never echoed to the cashier verbatim. The
cross-process redaction smoke (S2) extends the project allowlist to cover `catalogue.*`.

---

## Test surface required at S1–S3 (informational)

For every handler: happy path (valid session); no-session refusal (generic); tenant-isolation refusal
(generic); `catalogue_unavailable` for empty/missing/unreadable read model (distinct from `not_found`);
ambiguous-barcode block (`lookupBarcode`); too-short guard (`search`); folded-match recall (search,
SC-9 corpus); `missing_required_field` / `disabled` refusal (`resolve`); cross-process redaction smoke.
Coverage gate ≥ 95 % on the bridge gate.

---

**End of contract.** Final names/shapes are 009-side proposals co-resident with `/speckit-plan`
(2026-05-30). Implementation lands in S1 (skeleton + gating), S2 (exact lookup + migration), S3 (folded
search), S4 (resolve + seam wiring).
