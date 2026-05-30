# S0 Visual Direction — Contact Sheet

**Feature:** 009-product-search-and-barcode-lookup
**Slice:** S0 (non-code; must be reviewed before any S1+ UI work begins)
**Reviewer:** Ahmed Shaaban (owner)
**Review date:** _pending — see `review-record.md`_
**Status:** Draft for §A0 review
**Constitution version pinned:** v1.5.1

> This file describes the layout and behaviour of every product search / lookup
> surface 009 adds to the cart-bearing shell. It is a **textual contact sheet**,
> not a screenshot or generated artefact. Implementers read this before writing
> any UI code (S1 shells onward). No JSX, HTML, CSS, or images are committed here.
>
> Every surface inherits 003's `comfortable` density and the 44 CSS px touch
> floor (`src/renderer/ui/tokens/touch.ts → touchTarget.min`). **No new design
> tokens are introduced**; all colour, spacing, radius, shadow, and typography
> values come from the existing `src/renderer/ui/tokens/` inventory (the 003/007
> set). This mirrors 005's S0 discipline.
>
> **Direction:** the search surfaces are **Arabic-first, RTL by default**
> (NFR-5; Constitution Localization). The ASCII diagrams below are drawn in
> *logical* order (lead → trail); under RTL the lead edge is the **right** and
> amounts/Latin barcodes render LTR-embedded. English is the fallback display.
> Design anchors: `PRODUCT.md` ("The Accountable Instrument") and `DESIGN.md`
> (restrained colour; navy primary; single Inter Variable typeface).

---

## State ↔ surface map

The renderer FSM is `catalogueSearchStore` (T008), seven states. Each maps to a
surface below; the store **mirrors only bridge-confirmed outcomes** (P2), so no
surface is reachable except as a confirmed `catalogue.*` response.

| FSM state | Surface | FR |
|:--|:--|:--|
| `idle` | Surface 1 (search/scan input) · Surface 8 (too-short hint) | FR-8, FR-16 |
| `searching` | Surface 2 (in-flight) | NFR-3 |
| `results` | Surface 3 (result list + rows) | FR-14, FR-17, FR-17a |
| `confirm_pending` | Surface 4 (confirm panel) | FR-5 |
| `not_found` | Surface 5 (product-not-found) | FR-6 |
| `catalogue_unavailable` | Surface 6 (catalogue-unavailable) | FR-24 |
| `ambiguous` | Surface 7 (ambiguous-barcode) | FR-7 |

---

## Token palette (reference — no fork)

All surfaces use the existing 003/007 token set verbatim.

| Token (source) | Use in 009 surfaces |
|:--|:--|
| `--color-surface` (`colors.ts`) | Search bar + panel background (fills 003's reserved input slot) |
| `--color-surface-elevated` | Result-row background; confirm-panel overlay surface |
| `--color-surface-sunken` | Idle / not-found empty-state tint |
| `--color-text` / `--color-text-muted` | Primary labels (name, price) / secondary (unit-pack, hint copy) |
| `--color-primary` | Positive affordance: **Add** button |
| `--color-neutral` | Cancel button border; result-row rule |
| `--color-focus-ring` | Keyboard selection highlight on result rows + inputs (FR-14) |
| `--color-warning-soft` / `--color-warning-on` | **Ambiguous-barcode** banner (Surface 7); **controlled-substance** awareness badge (C1) |
| `--color-info-soft` / `--color-info-on` | **Prescription-required** awareness badge (C1) |
| `--color-danger-soft` / `--color-danger-on` | **Catalogue-unavailable** banner (Surface 6 — "system not ready") |
| `touchTarget.min = 44` (`touch.ts`) | 44×44 CSS px floor on every interactive element |
| `--radius-card` (`radius.ts`) | Result-row + confirm-panel rounding |
| `--shadow-overlay` (`shadow.ts`) | Confirm-panel elevation |

**Typography** (DESIGN.md hierarchy, single Inter Variable face):

- Product `display_name` (Arabic-first): Body (400, 16 px), `--color-text`.
- Price / barcode / SKU: Mono (400, 14 px) — amounts + codes use monospace for column alignment and LTR embedding under RTL.
- Unit/pack label + secondary copy: Label (600, 12 px), `--color-text-muted`.
- State headings (not-found / unavailable / ambiguous): Title (600, 16 px).

---

## Layout strategy (all surfaces)

009 adds **no new route**. The search/scan input lives in the cart-bearing
shell (the `/app/*` surface that already hosts 005's cart pane), positioned so a
signed-in cashier can scan or type with the cart in view. Results, the confirm
panel, and the error states render in the same input-adjacent region — they do
**not** occupy the cart pane (005 owns that) and do **not** cover the cart.

The confirm panel (Surface 4) is the only elevated/overlay surface
(`--shadow-overlay`); the result list and error states are inline below the
input. Every surface returns focus to the input when it closes (FR-6 recovery).

---

## Surface 1 — Search / scan input (state: `idle`)

**Goal (T009 / US1):** one focused, wedge-ready field that accepts both a typed
query and a keyboard-wedge scan. The cart screen is a sanctioned wedge context
(NFR-6); this input is its sanctioned focus target.

**Layout (logical order; RTL → lead edge is the right):**

```
┌────────────────────────────────────────────────────────┐
│ 🔍  ابحث بالاسم أو امسح الباركود…            [↵ scan]   │  ← RTL placeholder; input
│     (search by name or scan barcode)                    │    auto-focused on mount
└────────────────────────────────────────────────────────┘
   ▸ idle hint (muted): "اكتب حرفين على الأقل للبحث"
     ("type at least 2 characters to search")            ← FR-16; see Surface 8
```

**Behaviour:**

- **Auto-focus** on shell mount and after every completed/cancelled lookup, so a
  scan always lands here (NFR-6). If focus is elsewhere, wedge input MUST NOT
  populate an unrelated field — focus management keeps wedge input sanctioned
  (Edge: stray scan).
- **Scan path:** a wedge sends characters + a terminating Enter. The Enter
  **submits the lookup** and MUST NOT leak into the cart or trigger an unrelated
  default-button action (FR-8). A scan bypasses debounce — it submits
  immediately (NFR-3); the store transition is `beginSearch` → exact lookup.
- **Typed path:** debounced ~150 ms (NFR-3); a name query fires only at ≥ 2
  normalized chars (FR-16). A fully typed barcode value routes to the exact
  barcode lookup, not substring search (FR-10).
- Input is ≥ 44 px tall; the scan-affordance hint (`[↵ scan]`) is informational,
  not a button.

**Cashier-forbidden:** no stock/quantity-on-hand, no expiry/batch, no supplier
or cost, no reports — none of these appear on any 009 surface (Out of Scope).

---

## Surface 2 — In-flight (state: `searching`)

**Layout:**

```
┌────────────────────────────────────────────────────────┐
│ 🔍  بنادول                                   ⟳ (busy)   │  ← query retained; spinner
└────────────────────────────────────────────────────────┘
```

**Behaviour:** transient. The input keeps the query visible and exposes
`aria-busy="true"` while the bridge call is in flight. No result rows render
yet (P2 — nothing shown until the bridge confirms). A new scan/keystroke
supersedes (store `beginSearch` is always allowed). This surface has no
controls of its own.

---

## Surface 3 — Result list + result row (state: `results`)

**Goal (T010 / US2):** a ranked, capped, fully keyboard-navigable list of active
products (FR-14, FR-17, FR-17a).

**Layout (logical order; RTL → name leads on the right, code trails on the left):**

```
┌────────────────────────────────────────────────────────┐
│ 🔍  بنادول                                              │  ← input keeps query
├────────────────────────────────────────────────────────┤
│ ▎بنادول إكسترا ٥٠٠ مجم        ¤ 15.00   ×20 أقراص       │  ← row 0 (HIGHLIGHTED:
│   Panadol Extra 500mg          6221····12   [Rx]        │    --color-focus-ring rule)
│  ────────────────────────────────────────────────────  │
│  بنادول نايت ٥٠٠ مجم          ¤ 18.50   ×10 أقراص       │  ← row 1
│  Panadol Night 500mg           6221····39               │
│  ────────────────────────────────────────────────────  │
│  بنادول للأطفال شراب           ¤ 22.00   ١٠٠ مل          │  ← row 2  [⚠ مراقَب]
│  Panadol Children Syrup        SKU-PND-SYR  [⚠]         │    (controlled badge)
├────────────────────────────────────────────────────────┤
│  عرض أفضل 20 — حسّن البحث لعرض المزيد   (refine hint)    │  ← only when truncated=true
└────────────────────────────────────────────────────────┘
```

**Result-row content (FR-17a) — every row shows:**

- **Product name, Arabic-first** (`display_name_ar`, Body 16 px), with the
  English name beneath as muted fallback (`display_name_en`, Label 12 px) when
  available.
- **Price** (`price_minor` via placeholder currency formatter — same `¤`
  placeholder convention as 005; final formatting owned downstream). Mono,
  LTR-embedded.
- **Unit/pack label** (`unit_pack_label`) when available (e.g. "×20 أقراص").
- **Barcode or SKU** — shown where it helps disambiguate (the matched
  `selling_barcode`, else `sku`); Mono, LTR-embedded, middle-truncated.
- **Controlled / Rx awareness badges** (C1) — see "Controlled / Rx surfacing".

**Ranking & cap:** exact-prefix ranked above mid-string; **active products
only**; capped at **20** (NFR-4 / FR-17). When matches exceed 20, `truncated`
is true → the muted refine hint shows ("show top 20 — refine to see more"). The
list is never unbounded.

**Keyboard (FR-14, NFR-5):**

- `ArrowDown` / `ArrowUp` move the selection highlight (rendered with
  `--color-focus-ring`, never colour-only — the selected row also carries a lead
  bar `▎` and `aria-selected`).
- `Enter` selects the highlighted row → store `selectResult` → `confirm_pending`
  (Surface 4).
- Tap selects the same way (mouse optional, never required).
- Each row hit area ≥ 44 px tall.

---

## Surface 4 — Confirm panel (state: `confirm_pending`)

**Goal (T011 / US1):** confirm-first single-match panel (FR-5). Reached from an
exact barcode/SKU `one` result (store `resolveSingleMatch`) **or** from a result
selection (`selectResult`). **Nothing is added before the cashier confirms.**

**Layout (elevated `--shadow-overlay`, `--radius-card`):**

```
┌──────────────────────────────────────────────┐
│  تأكيد الإضافة                                 │  ← Title; generic, no IDs
│                                                │
│  بنادول إكسترا ٥٠٠ مجم            [⚠ مراقَب]   │  ← name Arabic-first + badges (C1)
│  Panadol Extra 500mg               [Rx]        │  ← English fallback (muted)
│                                                │
│  السعر    ¤ 15.00                              │  ← price (mono, LTR-embedded)
│  العبوة   ×20 أقراص                            │  ← unit/pack label when available
│                                                │
│  [ إلغاء (Cancel) ]      [ إضافة (Add) ]        │  ← both ≥44×44; Add = --color-primary
└──────────────────────────────────────────────┘
```

**Behaviour:**

- **Add** → calls **005's `cart.lines.add`** (FR-20) — 009 mounts **no parallel
  cart-mutation path**. On success the store goes `confirmAdd` → `idle` and focus
  returns to the input for the next item. A **re-scan/confirm of a product
  already on the cart increments the existing line** via 005's merge-by-`item_ref`
  (Q4) default — no duplicate line, no 009-side cart logic (FR-21).
- **Cancel** (or `Escape`) → `cancelConfirm` → `idle`; nothing added; focus
  returns to input.
- **Missing required field guard:** if resolution is missing a field the cart /
  downstream needs (e.g. no valid `price_minor`), **Add is refused generically**
  and no partial line is created (FR-19 / FR-22) — the panel shows a generic
  "can't add this item" message, not the technical reason.
- **Focus trap** while open; `Tab` cycles Cancel ↔ Add; `Escape` = Cancel.
- Copy is generic — no product_id, no session/tenant id, no diagnostic detail.

---

## Controlled / prescription surfacing (C1 — display only, NOT enforcement)

Per spec **Out of Scope**: 009 MAY *surface* `controlled_substance` /
`prescription_required` for cashier awareness, but **enforcement
(supervisor override at sale time) is explicitly out of scope.** These badges
are read-only signals; they gate nothing, block no add, and trigger no prompt.

| Flag | Badge | Token | Copy |
|:--|:--|:--|:--|
| `controlled_substance` | `[⚠ مراقَب]` | `--color-warning-soft` / `--color-warning-on` | "Controlled" |
| `prescription_required` | `[Rx]` | `--color-info-soft` / `--color-info-on` | "Rx / by prescription" |

Badges appear on the **result row** (Surface 3) and the **confirm panel**
(Surface 4). They are never colour-only (each carries an icon/label). They do
**not** appear on the cart line (005 owns that surface; threading is not in 009).

---

## Surface 5 — Product not found (state: `not_found`)

**Goal (T012 / US3):** a clear, **recoverable** state — never a hard error (FR-6).

**Layout (`--color-surface-sunken` tint, muted — the calmest of the three error states):**

```
┌────────────────────────────────────────────────────────┐
│ 🔍  6221000000000                                       │  ← scanned/typed value kept
├────────────────────────────────────────────────────────┤
│           لم يتم العثور على المنتج                       │  ← Title; "Product not found"
│           "6221000000000"                                │  ← echoes the scanned value
│                                                          │
│           جرّب مرة أخرى أو عدّل الإدخال                   │  ← "retry / edit the input"
│                          [ تعديل (Edit) ]                │  ← returns focus to input
└────────────────────────────────────────────────────────┘
```

**Behaviour:** shows the scanned/typed value, offers retry / manual edit, and
returns focus to the input ready for the next scan — the next scan is **never
blocked** (FR-6, Edge: scan-storm). Also the surface for the **inactive /
non-sellable guard** (FR-18): an inactive match is treated as not-found for
selling, generic to the cashier (the active-vs-absent distinction is
diagnostics-only). Calm/neutral styling — this means "retype", not "system
broken" (contrast Surface 6).

---

## Surface 6 — Catalogue unavailable (state: `catalogue_unavailable`)

**Goal (T012 / US3):** the **visually distinct** "system not ready" state
(FR-24, SC-10) — empty / missing / unreadable read model, collapsed to ONE
generic cashier message. **Distinct from not-found** because the cashier action
differs: *escalate / get help*, not *retype*.

**Layout (`--color-danger-soft` banner — the most prominent error treatment, signalling escalate):**

```
┌────────────────────────────────────────────────────────┐
│ ⛔  كتالوج المنتجات غير متاح حاليًا                       │  ← danger-soft banner;
│     Product catalogue unavailable                        │    Title + English fallback
│                                                          │
│     النظام غير جاهز للبحث — أبلغ المسؤول.                 │  ← "system not ready —
│     (the system isn't ready — notify your supervisor)    │    notify supervisor"
└────────────────────────────────────────────────────────┘
```

**Behaviour:** clear, recoverable, **never a crash or hang**; works entirely
from local data (no network probe during checkout — FR-23). The specific reason
(empty vs missing vs unreadable) is **logged for diagnostics only** and is NOT
distinguished at the cashier surface (FR-24). **Staleness is never surfaced**
(FR-24a — 009 owns no freshness marker). The danger-soft treatment makes this
unmistakably different from the muted not-found state (SC-10 — zero
misclassification).

---

## Surface 7 — Ambiguous barcode (state: `ambiguous`)

**Goal (T012 / US3):** the data-conflict block (FR-7) — one barcode mapped to
**> 1 active product**. The system MUST refuse to guess and add nothing.

**Layout (`--color-warning-soft` banner — caution, distinct from both not-found and unavailable):**

```
┌────────────────────────────────────────────────────────┐
│ ⚠  هذا الباركود مرتبط بأكثر من منتج                      │  ← warning-soft banner
│     This barcode matches more than one product           │
│                                                          │
│     يجب حلّ التعارض في الكتالوج — لم تتم الإضافة.          │  ← "resolve in catalogue —
│     (resolve in the catalogue — nothing was added)       │    nothing added"
│                          [ تعديل (Edit) ]                │  ← retry path; focus to input
└────────────────────────────────────────────────────────┘
```

**Behaviour:** adds **nothing** to the cart, surfaces generic "resolve in
catalogue" copy, records the ambiguity for diagnostics, and **MUST NOT silently
pick one** (FR-7, SC-5). A single product carrying several barcodes (pack +
unit) is **not** this case — that resolves normally to Surface 4 (Edge:
multi-barcode product). Three error states, three distinct treatments: muted
(not-found) · warning (ambiguous) · danger (catalogue-unavailable).

---

## Surface 8 — Empty / too-short idle (state: `idle`)

**Goal (T012):** no search runs below the minimum query length (FR-16) — no
expensive lookup, no result list.

**Layout:**

```
┌────────────────────────────────────────────────────────┐
│ 🔍  ب                                                   │  ← 1 typed char (< 2)
├────────────────────────────────────────────────────────┤
│   اكتب حرفين على الأقل للبحث بالاسم                      │  ← muted hint; no list,
│   (type at least 2 characters to search by name)         │    no bridge call fired
└────────────────────────────────────────────────────────┘
```

**Behaviour:** an empty or < 2-char *typed* query stays `idle` — the store
fires no `beginSearch`, so no `catalogue.search` call is made (FR-16, Scenario
10). A scanned barcode or a full SKU/barcode value is **exempt** from the
minimum and submits an exact lookup regardless of length.

---

## Connection-state behaviour (all surfaces)

009 introduces **no new connection-state visuals**; 003 owns the `StatusBanner`
+ nav-rail indicator for `online` / `degraded` / `offline` / `syncing`.

| Connection state | 009 surface behaviour |
|:--|:--|
| `online` / `degraded` / `syncing` | Lookup + search proceed unchanged — all reads are local SQLite. |
| `offline` | **No change** — scan and search work fully offline (FR-23 / SC-6). 009 never makes a network call during checkout; offline is not an error condition for any 009 surface. |

The catalogue-unavailable state (Surface 6) is a **local read-model** failure,
NOT a connection state — it is shown regardless of network and must never be
confused with the offline banner.

---

## Keyboard & accessibility summary (all surfaces)

- **Mouse-free critical path** (NFR-5, SC-1): focus input → scan (or type) →
  (results: `ArrowUp`/`ArrowDown` + `Enter`) → confirm panel → `Enter` on Add →
  back to input. Achievable end-to-end with no pointer.
- **Selection highlight** on result rows uses `--color-focus-ring` + a lead bar
  + `aria-selected` — never colour alone.
- **Confirm panel** traps focus; `Tab` cycles Cancel ↔ Add; `Escape` = Cancel.
- **Focus return:** every terminal state (not-found / unavailable / ambiguous /
  post-add / cancel) returns focus to the input for the next scan.
- **Touch floor:** every interactive element (input, result rows, Add, Cancel,
  Edit) ≥ 44 × 44 CSS px (`touchTarget.min`; CI invariant test).
- **Colour is never the sole differentiator:** the three error states differ by
  heading copy + icon (⛔ / ⚠ / none) as well as tone; the controlled/Rx badges
  carry icon + label.
- **RTL / Arabic-first** default; English is the muted fallback line; amounts,
  barcodes, and SKUs are LTR-embedded within the RTL flow.
- **Reduced motion:** the `searching` spinner respects reduced-motion (no
  spin → static busy indicator); no bounce/elastic easing on any surface.

---

## Cashier-forbidden information (all surfaces)

None of the following appear on any 009 surface (Out of Scope / Constitution
Domain): stock / quantity-on-hand, expiry / batch / lot, supplier / cost /
margin, reports / KPIs / analytics, controlled-substance **enforcement** or
supervisor-override prompts (the flags are *surfaced* for awareness only, C1),
catalogue **edit/create** affordances, and any backend/sync status. 009 is a
read-and-resolve surface only.

---

**End of contact sheet.** Surfaces 1–8 cover every state in the
`catalogueSearchStore` FSM. Implementers (S1 shells onward) must not deviate
from this description without a revised S0 review and re-sign-off (the §A0
gate). Every S1+ implementation PR must cite the companion `review-record.md`.
