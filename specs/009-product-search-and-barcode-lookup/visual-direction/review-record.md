# S0 Visual Direction — Review Record

**Feature:** 009-product-search-and-barcode-lookup
**Slice:** S0 (non-code)
**Reviewer (recommendation):** agent-performed review, 2026-05-30
**Owner sign-off (§A0):** ✅ **ratified by Ahmed on merge of PR #318 (2026-05-30)** — per the project's "recommendation; ratified on merge" gate convention (see "Sign-off" below)
**Contact sheet:** `specs/009-product-search-and-barcode-lookup/visual-direction/contact-sheet.md`
**Constitution version pinned:** v1.5.1

---

## What §A0 gates

Per `tasks.md` §"Approval gates", **§A0 has two components**, both blocking
every slice:

1. **S0 visual-direction review** — the contact sheet is reviewed against the
   mandatory criteria below. _(This record; recommended PASS.)_
2. **005 R7 seam-wiring coordination** — agreement with the 005 surface owner on
   how 009 wires the production resolver into 005's `resolveItemRef` seam.
   _(Status + open item recorded in §"005 seam-wiring coordination" below; the
   concrete wiring lands at S4 under §A1.)_

This record covers all 8 surfaces in `contact-sheet.md`, which together cover
every state of the `catalogueSearchStore` FSM (T008).

---

## Review checklist

### 1. 003 / 007 design tokens (no fork; existing token set only)

**Result:** PASS

The contact sheet references only tokens from `src/renderer/ui/tokens/`:

| Source file | Tokens referenced |
|:--|:--|
| `colors.ts` | `--color-surface`, `--color-surface-elevated`, `--color-surface-sunken`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-neutral`, `--color-focus-ring`, `--color-warning-soft`/`-on`, `--color-info-soft`/`-on`, `--color-danger-soft`/`-on` |
| `touch.ts` | `touchTarget.min = 44` (enforced on every interactive element) |
| `density.ts` | `comfortable` inherited; no new density |
| `radius.ts` | `--radius-card` (result rows + confirm panel) |
| `shadow.ts` | `--shadow-overlay` (confirm panel) |
| `typography.ts` | Inter Variable; Body/Mono/Label/Title weights per DESIGN.md |

No new tokens introduced. No fork. Mirrors 005's S0 discipline.

### 2. RTL / Arabic-first display

**Result:** PASS

Every surface is Arabic-first, RTL by default (NFR-5; Constitution
Localization). The English name is the muted fallback line; amounts, barcodes,
and SKUs are LTR-embedded within the RTL flow. Placeholders, hints, and state
copy are Arabic-leading with English in parentheses. The diagrams are annotated
as logical-order with the RTL lead edge called out.

### 3. 003 navigation-rail behaviour

**Result:** PASS

009 adds **no new route**. The search/scan input and its result/confirm/error
surfaces live in the existing cart-bearing shell (`/app/*`), input-adjacent, and
do not occupy or cover the 005 cart pane. No nav-rail behaviour is altered.

### 4. 004 role-indicator slot + gating

**Result:** PASS

No 009 surface conflicts with 004's fixed role-indicator slot. There is **no
role gate beyond an active operator session** (NFR-6a): cashier, manager, and
admin all look up products identically — so the surfaces carry no
role-conditional rendering. Gating is bridge-side (`requireOperatorSession`,
generic refusal); renderer is never load-bearing.

### 5. 44 px touch-target floor

**Result:** PASS

Every interactive element specifies ≥ 44 × 44 CSS px:

| Element | Surface |
|:--|:--|
| Search/scan input (≥ 44 px tall) | 1, 2, 8 |
| Result row hit area | 3 |
| **Add** button | 4 |
| **Cancel** button | 4 |
| **Edit** (retry) button | 5, 7 |

Covered by the `touchTarget.min = 44` CI invariant test (shared with 005/008).

### 6. Keyboard operability (mouse-free critical path)

**Result:** PASS

The contact sheet (§"Keyboard & accessibility") specifies the full mouse-free
path (SC-1): focus → scan/type → `ArrowUp`/`ArrowDown` + `Enter` on results →
confirm panel → `Enter` on Add → focus returns to input. Confirm panel traps
focus (`Tab` cycles Cancel ↔ Add; `Escape` = Cancel). Every terminal state
returns focus to the input for the next scan (FR-6 recovery). Selection
highlight uses `--color-focus-ring` + lead bar + `aria-selected`.

### 7. Accessibility — axe-clean intent + colour-independence

**Result:** PASS (intent recorded; the automated axe gate runs at S1 T019 / S5 T051)

Colour is never the sole differentiator: the three error states differ by
heading copy + icon (⛔ catalogue-unavailable / ⚠ ambiguous / none for
not-found) as well as tone; controlled/Rx badges carry icon + label, not colour
alone; the in-flight state uses `aria-busy` and respects reduced motion. The
contact sheet commits the shells to these affordances so the S1 `a11y.test.tsx`
(T019) and the S5 full axe sweep (T051) have a concrete target.

### 8. Three error states are visually distinct (SC-10)

**Result:** PASS — the spec's hardest visual requirement

| State | Surface | Treatment | Cashier action |
|:--|:--|:--|:--|
| `not_found` | 5 | `--color-surface-sunken`, muted (calmest) | retype |
| `ambiguous` | 7 | `--color-warning-soft` + ⚠ | resolve in catalogue |
| `catalogue_unavailable` | 6 | `--color-danger-soft` + ⛔ (most prominent) | escalate / get help |

Three distinct tones + icons + headings → satisfies FR-24's "distinct from
not-found" and SC-10's "zero misclassification across the empty/missing/
unreadable matrix". Catalogue-unavailable is explicitly framed as "system not
ready", never confused with the offline banner (003 owns that).

### 9. Confirm-first single-match (FR-5) + cart-boundary discipline (FR-20/21)

**Result:** PASS

Surface 4 adds **nothing before the cashier confirms**. **Add** routes through
005's `cart.lines.add` (FR-20) — no parallel cart path; duplicate scan increments
the existing line via 005's merge-by-`item_ref` (Q4) default (FR-21). Missing
required field → generic refusal, no partial line (FR-19/FR-22).

### 10. Controlled / prescription = surfaced, NOT enforced (C1)

**Result:** PASS

`controlled_substance` (`[⚠ مراقَب]`, warning-soft) and `prescription_required`
(`[Rx]`, info-soft) are read-only awareness badges on the result row + confirm
panel. They gate nothing, block no add, and trigger no override prompt —
enforcement is explicitly out of scope (spec Out of Scope; constitution Domain).

### 11. Cashier-forbidden information boundaries

**Result:** PASS — all forbidden items excluded

No 009 surface shows stock / quantity-on-hand, expiry / batch / lot, supplier /
cost / margin, reports / KPIs, controlled-substance enforcement or
supervisor-override prompts, catalogue edit/create affordances, or backend/sync
status (Out of Scope). 009 is read-and-resolve only.

### 12. Offline-first (FR-23 / SC-6)

**Result:** PASS

The contact sheet records that all reads are local SQLite and no 009 surface
makes a network call during checkout; `offline` is not an error condition for
any surface. Catalogue-unavailable (Surface 6) is a local read-model failure,
explicitly NOT a connection state. 009 introduces no new connection-state
visuals (003 owns them).

### 13. Scope-deferred presentation (correctly scoped, not invented)

**Result:** PASS

Currency uses the same `¤` placeholder convention as 005 (final formatting owned
downstream). Debounce/scanner-bypass behaviour is described but its wiring is
S3 (T036/T037). No final formatting rule or timer is invented in S0.

---

## 005 seam-wiring coordination (the second §A0 component)

**Status:** approach agreed in the artifacts; **one drift item flagged for the
005 owner**, to be ratified at S4 / §A1.

- **Approach (from research §R7 / `contracts/resolver-seam.md`):** 009 wires its
  production resolver into 005's existing `cart-bridge.ts` `resolveItemRef`
  constructor option — the injection point 005 deliberately left unwired
  (production falls back to `DEFAULT_ITEM_REF_RESOLVER`). 009 does **not** change
  the seam signature. This is consistent with how 005 documented the seam.
- **⚠ Drift to resolve with the 005 owner (recorded during Phase 1–2, PR #317):**
  009's contracts document the seam success shape as
  `{ display_name, unit_price_minor, version }`, but 005's **live**
  `ItemRefResolver` (`src/main/cart/cart-bridge.ts:81`) is
  `{ kind: 'ok', display_name, unit_price_minor }` — it carries **no `version`
  field**. 009's `ResolvedSeam` type records the documented intent with this
  drift flagged in-code. **Whether `version` is added to the seam is an additive
  change to be agreed with the 005 owner — not assumed by 009.** This is the
  open coordination item; it is resolved concretely at **S4 (T040–T041) under
  §A1**, not by this visual review.

This visual-direction review does not itself ratify the seam wiring; it records
the coordination state so §A0 sign-off is made with the open item in view.

---

## Open issues at review time

1. **Seam `version`-field drift** (above) — owner + 005-owner coordination;
   binds at S4/§A1. Does not block S0 visual sign-off (no visual surface depends
   on it).

No visual changes to the contact sheet were identified during this review.

---

## Sign-off

This is an **agent-performed review recommending PASS**, recorded for the owner
to ratify — mirroring the gate-handling convention used on 008 (agent records
the recommendation; the owner signs). The §A0 gate is the owner's to close.

| Field | Value |
|:--|:--|
| Review performed by | agent (Claude Code), 2026-05-30 |
| Contact sheet version reviewed | as committed this PR |
| Constitution version | v1.5.1 |
| All 8 surfaces covered | Yes |
| Visual-review checklist (1–13) | **All PASS** |
| 005 seam-wiring coordination | Approach agreed; `version` drift flagged for S4/§A1 |
| Visual changes outstanding | None |
| **Recommendation** | **PASS — recommend §A0 visual-direction sign-off** |
| **Owner §A0 sign-off (Ahmed Shaaban)** | ✅ **RATIFIED on merge of PR #318, 2026-05-30** |
| **§A1 seam approach (Ahmed)** | ✅ **RATIFIED 2026-05-30** — 009's resolver satisfies 005's **live** `ItemRefResolver` signature `{ display_name, unit_price_minor }`; **`version` is deferred** (forward-looking provenance per research §R9, NOT threaded through the seam). No 005 change; 005's fixture tests stay green. Binds in code at S4 (T040–T041). |

§A0 is ratified. Every S1+ implementation PR (the gated slices) must cite this
review record in its description. Implementers must not deviate from the contact
sheet without a revised S0 review and re-sign-off.

---

**End of review record.**
