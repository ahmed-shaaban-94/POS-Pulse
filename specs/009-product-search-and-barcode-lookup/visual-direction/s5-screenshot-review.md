# T050 — S5 Live-Surface Review (against S0 contact sheet)

**Feature:** 009-product-search-and-barcode-lookup
**Task:** T050 — screenshot / contact-sheet review of the **live** surfaces against
S0; record consistency fixes.
**Reviewer:** agent-performed as-built review, 2026-05-31 (recommendation; owner ratifies on merge)
**S0 baseline:** [`contact-sheet.md`](contact-sheet.md) · §A0 sign-off [`review-record.md`](review-record.md)
**Constitution version pinned:** v1.5.1

> **Method note.** This environment cannot screenshot a running Electron window, so
> — mirroring the agent-performed S0 review and the T049a/T049b as-built records —
> this is a **textual as-built review**: each implemented surface component and the
> live composition root (`CatalogueSalePane`) are read and compared, surface by
> surface, against the S0 contact sheet. Findings are recorded here; the two
> live-composition gaps found (F1/F2) were closed test-first in this same change
> after an owner scope decision — see §"Disposition".

---

## Files reviewed (the live surfaces)

| Surface (S0) | Component | File |
|:--|:--|:--|
| Composition root | `CatalogueSalePane` | `src/renderer/ui/catalogue/CatalogueSalePane.tsx` |
| 1 / 2 / 8 — search-scan input + hint | `ProductSearchInput` | `…/ProductSearchInput.tsx` |
| (scan capture) | `ScanCaptureField` | `…/ScanCaptureField.tsx` |
| 3 — result list + row | `SearchResultList` / `SearchResultRow` | `…/SearchResultList.tsx`, `…/SearchResultRow.tsx` |
| 4 — confirm panel | `CatalogueAddController` → `ProductConfirmPanel` | `…/CatalogueAddController.tsx`, `…/ProductConfirmPanel.tsx` |
| C1 badges | `ControlledFlags` | `…/ControlledFlags.tsx` |
| 5 — not found | `NotFoundState` | `…/NotFoundState.tsx` |
| 6 — catalogue unavailable | `CatalogueUnavailableState` | `…/CatalogueUnavailableState.tsx` |
| 7 — ambiguous barcode | `AmbiguousBarcodeState` | `…/AmbiguousBarcodeState.tsx` |
| FSM | `catalogueSearchStore` | `src/renderer/stores/catalogueSearchStore.ts` |

---

## Per-surface result

| # | Surface (FSM state) | Component matches S0? | Mounted in the live composition? |
|:--|:--|:--|:--|
| 1 | search/scan input (`idle`) | ✅ PASS | ✅ yes (`CatalogueSalePane`) |
| 2 | in-flight (`searching`) | ✅ PASS (after F2 fix) | ✅ yes (busy line added, see F2) |
| 3 | result list + rows (`results`) | ✅ PASS | ✅ yes |
| 4 | confirm panel (`confirm_pending`) | ✅ PASS | ✅ yes (via `CatalogueAddController`) |
| 5 | not found (`not_found`) | ✅ PASS (minor icon nit, F4) | ✅ yes (mounted by F1 fix) |
| 6 | catalogue unavailable (`catalogue_unavailable`) | ✅ PASS | ✅ yes (mounted by F1 fix) |
| 7 | ambiguous barcode (`ambiguous`) | ✅ PASS | ✅ yes (mounted by F1 fix) |
| 8 | too-short idle hint (`idle`) | ✅ PASS | ✅ yes (always-on hint, see F3) |

> **Status note:** the "Mounted?" column above reflects the **post-fix** state. F1
> (Surfaces 5/6/7 blank) and F2 (Surface 2 busy affordance) were the two gaps this
> review found in the *as-first-read* live composition; both were closed test-first in
> this same change (owner chose "fix now"). The findings below preserve the original
> as-found record plus their fix.

**Per-component fidelity:** every individual surface component faithfully implements
its S0 description — RTL Arabic-first with muted English fallback, the documented
token classes (`--color-*` via the `catalogue-*` class hooks), `touchTarget`-sized
controls, icon + heading copy (never colour-only), C1 awareness badges that carry a
text label and gate nothing. The fidelity problem is **not** in the components — it
is in which of them the **live screen actually mounts**.

---

## Findings

### F1 — **Three error-state surfaces are never mounted in the live build** (CONSISTENCY GAP — the headline)

**Severity:** HIGH (functional, not cosmetic).

The composition root `CatalogueSalePane` imports and renders only
`ProductSearchInput`, `ScanCaptureField`, `SearchResultList`, and
`CatalogueAddController`. It renders the result list **only** when
`state.kind === 'results'`:

```tsx
{state.kind === 'results' && ( <SearchResultList … /> )}
```

There is **no branch** for `not_found`, `ambiguous`, or `catalogue_unavailable`. Yet
`runTypedSearch` / `runScan` drive the FSM straight into those states
(`s.resolveNotFound()`, `s.resolveAmbiguous()`, `s.resolveCatalogueUnavailable()`).
So a live miss, an ambiguous barcode, or an empty/unreadable read model transitions
the store correctly but the screen renders **nothing** for it — a blank surface
instead of Surfaces 5 / 6 / 7.

**Confirmation (durable):** `NotFoundState`, `CatalogueUnavailableState`, and
`AmbiguousBarcodeState` are referenced **only** in their own files, the barrel
`index.ts`, `shells.test.tsx`, and the spec docs — **never** in any production
composition (no other component subscribes to `catalogueSearchStore` to render them).
Their unit tests pass in isolation, which is why CI stays green while the live states
are dead. This directly **confirms and extends** T049a's own as-built caveat ("a live
build exercises only `catalogue_unavailable`/`not_found`"): those states are not merely
un-seeded — they have **no UI surface at all** on the live pane.

**S0 requirement breached:** SC-10 (three visually-distinct error states, zero
misclassification) and FR-6 / FR-7 / FR-24 (each error state is a clear, recoverable
surface). A blank screen is neither distinct nor recoverable.

**Fix applied (test-first, 2026-05-31 — owner chose "fix now"):** `CatalogueSalePane`
now mounts `NotFoundState`, `AmbiguousBarcodeState`, and `CatalogueUnavailableState` on
their FSM-state branches. Recovery is a shared `recoverToInput` handler wired to the
**not-found and ambiguous** surfaces' `onEdit`: it `clear()`s the FSM to `idle` **and
returns focus to the search input** (FR-6/7 recovery — "retype"). `catalogue_unavailable`
(Surface 6) intentionally has **no** Edit/recovery affordance — its S0 action is
*escalate, not retype*, so it neither offers `onEdit` nor refocuses; that is by design,
not a gap.
Focus return required a small seam: `ProductSearchInput` now exposes an imperative
`focus()` handle (`forwardRef` + `useImperativeHandle`), and the pane holds a ref to it.

The **not-found surface now echoes the searched value** (S0 Surface 5 — "shows the
scanned/typed value"): the `not_found` FSM variant was widened to carry `query` (set in
`resolveNotFound` from the `searching` state's query), and the pane passes
`query={state.query}` to `NotFoundState`.

Eight composition tests added to `CatalogueSalePane.test.tsx` (mount per error state,
Edit→idle recovery, **Edit→focus-returns-to-input**, **not-found echoes the query**, and
the F2 busy affordance) — each written RED first (verified blank/absent/unfocused), then
GREEN. **F2 was folded into the same pass** (per the owner's chosen option) — see F2.

### F2 — Surface 2 (`searching`) had no busy affordance → FIXED in this pass

S0 Surface 2 specifies the in-flight state exposes `aria-busy="true"` (reduced-motion
respecting) while the bridge call is pending. The live build had no `searching` branch.
**Fixed (test-first):** `CatalogueSalePane` now renders a `role="status"`
`aria-busy="true"` busy line (`جارٍ البحث… (searching…)`, `data-testid="catalogue-searching"`)
on the `searching` branch — no spin glyph, so reduced-motion is honoured by construction
and there are no controls of its own (a new scan/keystroke supersedes via the input). One
RED→GREEN test added. T051 (full axe sweep across all states) still owns end-to-end a11y
verification, but the affordance itself now exists.

### F3 — Too-short idle hint shows in *all* states, not just `idle` (NIT)

`ProductSearchInput` renders the hint `اكتب حرفين على الأقل للبحث بالاسم`
**unconditionally** (it is the input's `aria-describedby` target). S0 Surface 8 frames
the hint as the `idle` / too-short affordance. The always-on rendering is benign — it
doubles as the input's accessible description and never blocks — but strictly it is not
state-scoped. **No fix recommended** (it serves the a11y description role well);
recorded for completeness so it is not mistaken for a missing surface.

### F4 — `NotFoundState` icon `⊘` vs S0 "none" (NIT)

S0's colour-independence table distinguishes the three error states by icon as
`⛔ (unavailable) / ⚠ (ambiguous) / none (not-found)`. The implementation gives
not-found a decorative `⊘` glyph (`aria-hidden`). This does **not** break
colour-independence — not-found is still distinguished by its heading copy and muted
tone, and the glyph is hidden from assistive tech — but it diverges from the literal
"none". Harmless; either update the contact sheet to acknowledge the decorative `⊘`
or drop the glyph. **No blocking fix.**

### F5 — Stale doc comment in `ProductConfirmPanel` (NIT, non-functional)

`ProductConfirmPanel`'s header comment still says the add flow + C1 badges "land in S4
(T045/T045b)" and calls itself an "S1 layout-only shell". As-built, the add flow lives
in `CatalogueAddController` and the badges are wired via `ControlledFlags` (both
present). The comment is stale; the code is correct. **Doc-only tidy**, optional.

---

## What PASSED (no action)

- **Tokens / no fork** — all surfaces use the existing `catalogue-*` class hooks over
  the 003/007 token set; no new tokens. (Matches §A0 checklist item 1.)
- **RTL / Arabic-first** — `dir="rtl"` on names + inputs; English as muted fallback
  line; Arabic-leading copy throughout. (Item 2.)
- **No new route; cart-adjacent** — `CatalogueSalePane` mounts in the cart workspace
  behind the `productSearch` flag; does not occupy the cart pane. (Item 3.)
- **Confirm-first + cart boundary** — `CatalogueAddController` adds nothing before
  confirm, routes solely through 005's `cart.lines.add`, generic refusal on
  `refused`/rejection, no partial line. (Items 9, FR-5/19/20/22.)
- **C1 surfaced-not-enforced** — `ControlledFlags` renders text-labelled badges that
  gate nothing. (Item 10.)
- **Keyboard model** — listbox `aria-activedescendant` + Arrow/Enter on results;
  confirm dialog is `aria-modal`. (Item 6; full mouse-free walkthrough = T056.)
- **Cashier-forbidden info** — no stock/expiry/cost/supplier/reports on any surface.
  (Item 11.)

---

## Disposition (fix vs. record)

T050 is a **review** task — its durable deliverable is this record. The HIGH finding
(**F1**) and the minor a11y gap (**F2**) were surfaced to the owner as a scope decision
(they require real test-first code in the composition root, not a review edit). **Owner
chose "fix now, test-first" (2026-05-31).** Both are now **closed** in this same change:

- **F1** — `CatalogueSalePane` mounts `NotFoundState` / `AmbiguousBarcodeState` /
  `CatalogueUnavailableState` on their FSM branches. `onEdit`→`recoverToInput()` =
  `clear()` **+ focus-return to the search input** (`ProductSearchInput` gained an
  imperative `focus()` handle). The not-found surface **echoes the searched value** (the
  `not_found` FSM variant now carries `query`). (FR-6/7 + S0 keyboard contract.)
- **F2** — `searching` branch renders a `role="status"` `aria-busy="true"` busy line
  (reduced-motion-safe).

Eight composition tests added to `CatalogueSalePane.test.tsx` (7 for F1 — mount ×3,
Edit→idle ×2, Edit→focus-return ×1, query-echo ×1; 1 for F2), each written RED first
(verified blank / absent / unfocused) then GREEN. Full **renderer suite: 1036 passing**;
typecheck / lint / prettier clean. F3/F4/F5 remain **nits — no fix** (or an optional doc
tidy). T051 still owns the end-to-end axe sweep across all states.

---

## Sign-off

| Field | Value |
|:--|:--|
| Review performed by | agent (Claude Code), 2026-05-31 |
| Surfaces covered | All 8 (FSM-complete) |
| Per-component S0 fidelity | PASS (1 nit: F4) |
| Live-composition fidelity (as-found) | GAP — F1 (3 error states unmounted) + F2 (busy affordance) |
| Live-composition fidelity (post-fix) | **PASS — all 8 surfaces mount on their FSM state** |
| Findings | F1 HIGH ✅ fixed (mount + focus-return + query echo) · F2 MINOR ✅ fixed · F3/F4/F5 NITS (no fix) |
| Verification | renderer suite 1036 ✅ · typecheck ✅ · lint ✅ · prettier ✅ |
| Disposition | Owner chose "fix now, test-first" — F1 + F2 closed in this change |
| Owner sign-off | _pending — ratified on merge_ |

**End of T050 review record.**
