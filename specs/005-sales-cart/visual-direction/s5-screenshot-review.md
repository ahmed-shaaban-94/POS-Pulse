---
title: "005 Sales Cart — S5 Screenshot / Contact-Sheet Review"
task: T096
reviewer: Ahmed Shaaban
date: 2026-05-17
branch: docs/005-s5-screenshot-review
baseline: specs/005-sales-cart/visual-direction/contact-sheet.md
status: complete
---

# 005 Sales Cart — S5 Screenshot / Contact-Sheet Review (T096)

## 1. Review Metadata

| Field | Value |
|:--|:--|
| Reviewer | Ahmed Shaaban |
| Date | 2026-05-17 |
| Branch | `docs/005-s5-screenshot-review` |
| Baseline | `specs/005-sales-cart/visual-direction/contact-sheet.md` (S0 sign-off 2026-05-14) |
| Components | `CartPane.tsx`, `HandoffSummary.tsx` |
| Styles | `src/renderer/styles/tailwind.css` (`.cart-pane__*`, `.handoff-summary__*`) |
| Test evidence | T092 shell-slot, T093 axe-clean, T095 keyboard-nav |
| Impeccable audit | 18 / 20 — Excellent |

---

## 2. Verification Method

**Dev server / live UI:** `npm run dev` launches an Electron GUI window, which cannot be inspected in an automated terminal context (no display server on CI runner). Full Electron launch was not performed.

**Fallback applied (documented):** Source code analysis + existing test harness. Specifically:

- `CartPane.tsx` and `HandoffSummary.tsx` read in full — component logic, conditional rendering, ARIA attributes, and class name application verified directly.
- `tailwind.css` cart-pane and handoff-summary sections read (classes, token references, spacing, layout).
- T092 (`cart-pane-shell-slot.test.tsx`) — structural shell constraints across all states.
- T093 (`cart-pane-a11y.test.tsx`) — axe-clean across empty, handing-off, handoff-refused, editing, editing+discount, frozen.
- T095 (`cart-pane-keyboard.test.tsx`) — tab order, stepper arrow keys, disabled-button focus exclusion, cashier-forbidden-control absence.

All three test suites are in the passing state per PR merge records (#113–#115, S5-a PRs).

**Limitation:** Pixel-level colour rendering and actual font rasterisation were not visually inspected. Any finding marked "confirmed by source" means the source code has the expected implementation; rendering correctness at the OS level is assumed pending a future smoke run on hardware.

---

## 3. Impeccable Audit Summary

Audit applied against: PRODUCT.md, DESIGN.md, `.impeccable/design.json`, contact-sheet.md.

| Category | Score | Notes |
|:--|:--|:--|
| A11y (WCAG AA) | 3 / 4 | axe-clean per T093; `✓` plain-text character used for banner icon instead of SVG (minor) |
| Performance | 4 / 4 | No layout thrash; `useCartStore` selector memo pattern; no inline object allocations in render |
| Theming | 4 / 4 | 100 % token coverage — no hardcoded hex/rgb values anywhere in cart or handoff styles |
| Responsive / RTL | 3 / 4 | Logical properties throughout (`padding-inline`, `border-inline-start`); 44×44 touch targets met; right-column currency alignment confirmed |
| Anti-patterns | 4 / 4 | No gradient text, no glassmorphism, no hero-metric template, no identical card grid |
| **Total** | **18 / 20** | **Excellent** |

---

## 4. State-by-State Review

Contact-sheet surfaces cross-referenced per section headers in `contact-sheet.md`.

### 4.1 Empty State (Surface 1)

**Contact-sheet spec:** Three-region shell visible. Header shows "Cart" title + hidden Void button. Body shows empty-state illustration/copy. Footer shows ¤0.00 subtotal; Handoff button absent or disabled.

| Check | Contact sheet | Implementation | Result |
|:--|:--|:--|:--|
| Three-region shell present | ✓ | `cart-pane__header` + `cart-pane__body` + `cart-pane__footer` always rendered | PASS |
| "Cart" title in header | ✓ | `<h2 className="cart-pane__title">Cart</h2>` | PASS |
| Void button hidden | Hidden in empty state | `canVoid` evaluates to `true` when `activeCart.state === CartState.empty` — Void renders | **FAIL — Dev1** |
| Handoff button absent | Not shown (no lines) | `canHandoff` requires `lines.length > 0`; button hidden correctly | PASS |
| Empty body copy | Illustrated empty state | `showEmpty` guard renders empty-state slot | PASS |
| Footer subtotal | ¤0.00 | `formatMinorUnits(0)` → `¤0.00` | PASS |

**Finding Dev1 (P2):** Void button visible in empty state. `canVoid` does not exclude `CartState.empty`. Contact sheet is explicit: "Void button: hidden in empty state."

---

### 4.2 Editing — 3 Lines (Surface 2 + Surface 3)

**Contact-sheet spec:** Line-item rows in scrollable body. Each row: product name, qty stepper (−/+), unit price, line total. Footer shows live subtotal. Handoff button enabled. Void button visible.

| Check | Contact sheet | Implementation | Result |
|:--|:--|:--|:--|
| Line list renders | ✓ | `cart-pane__line-list` mapped from `lines` array | PASS |
| Qty stepper in each row | −/+ controls, inline | `LineItemRow` contains `QuantityStepper` component | PASS |
| Unit price + line total | Right-aligned, monospace | `¤${whole}.${frac}` pattern, `text-align: end` | PASS |
| Scrollable body | Overflow scroll | `.cart-pane__body { overflow-y: auto }` | PASS |
| Live subtotal in footer | Sum of all lines | Computed from `lines` via `formatMinorUnits` | PASS |
| Handoff button enabled | ✓ | `canHandoff = lines.length > 0 && state === editing` | PASS |
| Void button visible | ✓ | `showHandoffButton` does not suppress Void in editing state | PASS |
| RTL layout | Logical properties | `padding-inline`, `border-inline-start` in all relevant rules | PASS |

---

### 4.3 Discount-Pending (Surface 4 — discount placeholder row)

**Contact-sheet spec:** Discount placeholder displayed _within_ the line-item row as a pill/inline element. Not a separate list below the lines.

| Check | Contact sheet | Implementation | Result |
|:--|:--|:--|:--|
| Discount shown inline in row | Pill within `LineItemRow` | Discount placeholder rendered in a separate `cart-pane__discount-list` section below all lines | **FAIL — Dev2** |
| Attribution prompt accessible | Role-aware prompt appears | `discount_pending_attribution` triggers manager-attribution modal per axe test (T093) | PASS |

**Finding Dev2 (P2):** Discount placeholders are placed in a `cart-pane__discount-list` container _below_ the entire line list, not as inline pills inside individual `LineItemRow` elements. Contact sheet (Surface 4) shows discount pill contained within the row.

---

### 4.4 Handing-Off / Transition State

**Contact-sheet spec:** Transitional state. Handoff button shows loading indicator or is replaced by a spinner. No data is lost from body.

| Check | Contact sheet | Implementation | Result |
|:--|:--|:--|:--|
| `handing_off` state handled | Transitional UI | `isFrozen` is `false` during `handing_off`; body still shows lines; footer spinner/loading reflected via button disabled state | PASS (inferred) |
| Axe-clean during transition | ✓ | T093 covers `handing_off` state explicitly — passes | PASS |

**Note:** Direct UI observation of the spinner animation was not possible without a live renderer. Implementation covers the state; visual polish of the loading micro-interaction is unverified at the pixel level.

---

### 4.5 Frozen-Handed-Off (Surface 8)

**Contact-sheet spec:** Body replaced by `HandoffSummary`. Shows "Cart sent to payment" banner (success colour). Read-only line list. "Sent at HH:MM" timestamp. "Continue to payment" button permanently disabled. Void action at **footer** of HandoffSummary (post-handoff manager action), not in header strip.

| Check | Contact sheet | Implementation | Result |
|:--|:--|:--|:--|
| Body replaced by HandoffSummary | ✓ | `isFrozen && envelope !== null` renders `<HandoffSummary>` | PASS |
| Success-colour banner | `--color-success-soft` bg | `.handoff-summary__banner { background-color: var(--color-success-soft) }` | PASS |
| "Cart sent to payment" copy | ✓ | Text confirmed in `HandoffSummary.tsx` | PASS |
| Banner `role="status"` | Live region | `role="status"` present on banner div | PASS |
| Read-only line list | No steppers or remove buttons | Lines rendered without `QuantityStepper` or remove controls | PASS |
| "Sent at HH:MM" timestamp | ✓ | `formatTimestamp(envelope.created_at)` → "Sent at HH:MM" | PASS |
| "Continue to payment" permanently disabled | opacity 0.55, not focusable | `.handoff-summary__continue { opacity: 0.55 }` + `aria-disabled`; T095 confirms not focusable | PASS |
| Void action at HandoffSummary footer | Surface 8 bottom | Void button renders in **CartPane header strip**, not at HandoffSummary footer | **FAIL — Dev3** |
| "Order summary" uppercase heading | Not specified in Surface 8 | Present in implementation (11px, bold, letter-spacing 0.1em) | Dev4 (P3) |
| PII/sensitive fields absent | cart_id etc. not rendered | `HandoffSummary` renders only display fields; no `cart_id`, `operator_session_id` | PASS |

**Finding Dev3 (P2):** After handoff, Void (manager action) is positioned in the CartPane `header` strip alongside the "Cart" title. Contact sheet Surface 8 places it at the bottom of the HandoffSummary view, below the disabled "Continue to payment" button, making it visually subordinate and clearly post-handoff.

**Finding Dev4 (P3):** "Order summary" uppercase section heading added in implementation; not present in contact-sheet Surface 8 spec. Minor addition — does not break the layout, but deviates from the signed-off reference.

---

### 4.6 Cancelled State

**Contact-sheet spec:** Cart is in terminal cancelled state. Body shows cancellation indication. All transactional controls (Handoff, Void, steppers) are absent or disabled. Shell remains.

| Check | Contact sheet | Implementation | Result |
|:--|:--|:--|:--|
| Shell still rendered | ✓ | `CartPane` always renders three-region shell | PASS |
| Handoff button absent | ✓ | `canHandoff` is `false` for cancelled state | PASS |
| Void button absent | ✓ | `isCancelled` → `showHandoffButton` is `false`, Void suppressed | PASS |
| Cashier controls absent | ✓ | T095 verifies cashier-forbidden controls absent in frozen/cancelled | PASS |
| Cancellation indication | Shown in body | `showEmpty` triggers in cancelled state, showing empty-body slot | PASS |

---

## 5. Cashier Visibility Boundary Verification

T092 and T095 confirm:

- Void button is never accessible to a cashier-role operator in frozen or cancelled states.
- `canVoid` gates on `sessionRole === 'manager' || sessionRole === 'admin'` when `isFrozen` is true.
- No cashier-visible controls appear inside `HandoffSummary` — read-only line list only.
- T095 explicitly asserts that the Void control is absent from the DOM when the operator does not have elevation.

Cashier boundary: **PASS** (with note that Dev1 means Void is incorrectly _visible_ in empty state regardless of role — confirmed bug, not a cashier-elevation bypass, but a state-guard omission).

---

## 6. Token Consistency Verification

All colour, spacing, radius, shadow, and typography values in `.cart-pane__*` and `.handoff-summary__*` use CSS custom properties exclusively. Spot-checked against `.impeccable/design.json` token inventory:

| Token | Usage | Verified |
|:--|:--|:--|
| `--color-surface` | Cart pane background | ✓ |
| `--color-surface-elevated` | HandoffSummary line rows | ✓ |
| `--color-border` | Header and pane inline border | ✓ |
| `--color-primary` | Handoff button background | ✓ |
| `--color-danger` | Void button text + border | ✓ |
| `--color-success-soft` | HandoffSummary banner background | ✓ |
| `--color-success` | HandoffSummary banner text | ✓ |
| `--font-size-lg` | Cart title (18px) | ✓ |
| `--space-*` | All padding and gap values | ✓ |
| `--radius-md` | HandoffSummary line rows | ✓ |

No hardcoded hex, rgb, or unitless values detected in cart or handoff style rules.

---

## 7. A11y and Keyboard Navigation

Per T093 (axe-clean) and T095 (keyboard-nav):

- All six states pass `axe` with zero violations.
- Tab order: header controls → body line items → stepper buttons → footer action.
- Arrow keys operate quantity steppers correctly.
- Disabled "Continue to payment" button is excluded from tab order (`aria-disabled` + not focusable).
- Handoff-refused live region uses `role="alert"`.
- HandoffSummary banner uses `role="status"`.

**Minor (Dev5, P3):** The HandoffSummary banner icon is a `✓` plain-text character with `aria-hidden="true"`. The character is a typographic check mark and will not cause an axe violation (it is aria-hidden), but an SVG icon would be more robust across screen readers and high-contrast modes.

---

## 8. Deviations Summary

| ID | Severity | Location | Contact Sheet Spec | Implementation | Recommendation |
|:--|:--|:--|:--|:--|:--|
| Dev1 | P2 | `CartPane.tsx` — `canVoid` | Void hidden in empty state | `canVoid` does not exclude `CartState.empty`; Void renders | Add `activeCart.state !== CartState.empty` to `canVoid` guard |
| Dev2 | P2 | `CartPane.tsx` — discount rendering | Discount pill within each `LineItemRow` | Separate `cart-pane__discount-list` below all lines | Move discount placeholder into `LineItemRow` inline position |
| Dev3 | P2 | `HandoffSummary.tsx` / `CartPane.tsx` | Post-handoff Void at HandoffSummary footer | Void in CartPane header strip throughout frozen state | Relocate Void button into `HandoffSummary` footer region when `isFrozen` |
| Dev4 | P3 | `HandoffSummary.tsx` | Not specified in Surface 8 | "Order summary" uppercase heading added | Remove or accept as intentional addition; update contact sheet if keeping |
| Dev5 | P3 | `HandoffSummary.tsx` banner | SVG icon implied | `✓` plain-text char, `aria-hidden` | Replace with `<svg aria-hidden="true">` check icon for high-contrast robustness |

**P2 findings require source fixes before S5 can be considered visually complete.** P3 findings are low-risk cosmetic deviations; the contact sheet should be updated if they are accepted.

---

## 9. Follow-Up Items

> This review document is a read-only deliverable. Source fixes are outside the T096 scope.
> Each item below is an input for the team's backlog.

- [ ] **[BLOCKER — P2]** Fix Dev1: add `CartState.empty` exclusion to `canVoid` guard in `CartPane.tsx`.
- [ ] **[BLOCKER — P2]** Fix Dev2: restructure discount placeholder to render inline within `LineItemRow`, matching contact-sheet Surface 4.
- [ ] **[BLOCKER — P2]** Fix Dev3: move post-handoff Void action from CartPane header into `HandoffSummary` footer, matching contact-sheet Surface 8.
- [ ] **[LOW]** Resolve Dev4: either remove "Order summary" heading or accept and update `contact-sheet.md`.
- [ ] **[LOW]** Resolve Dev5: replace `✓` character with `<svg aria-hidden="true">` in `HandoffSummary` banner.
- [ ] **[DEFERRED]** Live pixel inspection on Windows hardware — confirm colour rendering, font rasterisation, RTL layout, and spinner animation under all 6 states.

---

## 10. Sign-Off

| Field | Value |
|:--|:--|
| Reviewer | Ahmed Shaaban |
| Date | 2026-05-17 |
| Audit score | 18 / 20 — Excellent |
| P2 deviations | 3 (Dev1, Dev2, Dev3) — source fixes required |
| P3 deviations | 2 (Dev4, Dev5) — low risk, team decision needed |
| Overall verdict | **Conditional pass — P2 fixes required before S5 visual closure** |

> S5 visual closure is blocked on Dev1, Dev2, and Dev3. T096 is complete as a review artifact;
> source correction tasks are separate backlog items outside the T096 scope.
