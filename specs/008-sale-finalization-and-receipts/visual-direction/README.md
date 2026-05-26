# 008 Visual Direction — Slice 0 (§A1)

**Status:** DRAFT — sub-items (d) (e) (f) (g) authored by `/impeccable shape 008-receipt-surfaces`; sub-items (a) (b) (c) PENDING reviewer authoring. **NOT SIGNED.**

**Authored:** 2026-05-26
**Embedder (renderer portion d–g):** /impeccable shape · register=product · context loaded via `docs/PRODUCT.md` + `docs/DESIGN.md`
**§A1 reviewer:** Ahmed (assigned per [../coordination.md](../coordination.md))
**Embed-preflight reference:** [../../../docs/impeccable-embed-preflight.md §3.4](../../../docs/impeccable-embed-preflight.md)
**Spec FRs grounded against:** FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-040, FR-041, FR-042, FR-043, FR-046, FR-053, FR-065, FR-066, FR-068, FR-069, FR-071, NFR-004, NFR-008; AD-2, AD-5, AD-6, AD-8, AD-10
**Design system source of truth:** [../../../docs/DESIGN.md](../../../docs/DESIGN.md) (Stitch-format DESIGN.md; Creative North Star: "The Accountable Instrument")

---

## How to read this brief

The brief covers **seven** sub-items per tasks.md T010. Each is the visual direction for a distinct 008 surface variant. Sub-items (a) (b) (c) are **printed-slip** layouts — ESC/POS + canvas preview composition outside `/impeccable`'s register. Sub-items (d) (e) (f) (g) are **renderer surfaces** — React components inside the cart workspace.

| Sub-item | Surface | Owner | Status |
|:--:|:--|:--|:--|
| (a) | `first_print` printed slip | Ahmed (reviewer-authored) | ⏳ PENDING |
| (b) | `reprint_duplicate` printed slip (bilingual duplicate-copy marker) | Ahmed (reviewer-authored) | ⏳ PENDING |
| (c) | `preview` printed-slip content (mirrors a) | Ahmed (reviewer-authored) | ⏳ PENDING |
| (d) | `<ReceiptPreview>` UI panel | `/impeccable shape` | ✅ DRAFTED below |
| (e) | `<ReprintAffordance>` | `/impeccable shape` | ✅ DRAFTED below |
| (f) | `<PrinterFailureBanner>` | `/impeccable shape` | ✅ DRAFTED below |
| (g) | `<DrawerFailureBanner>` | `/impeccable shape` | ✅ DRAFTED below |

**Sign-off rule (preflight §3.4 step 5):** §A1 is cleared *only* when (a) (b) (c) are authored AND the reviewer signs the combined brief. The renderer sub-items (d–g) drafted below are submitted asynchronously per preflight §3.4 — `shape=pass` is **not** recorded yet.

---

## 0. Register declaration + North Star alignment

**Register:** `product` (per [docs/PRODUCT.md](../../../docs/PRODUCT.md) line "Register: product"). 008 surfaces are **product UI inside a cashier terminal during live transactions** — not brand or marketing. The aesthetic family is therefore the "Accountable Instrument" North Star from [docs/DESIGN.md §1](../../../docs/DESIGN.md): clean white workspace, single Command Navy primary action, Teal Marker as the focus-ring/active-tab accent only, status colors (success/warning/danger/info) restricted to their designated surfaces.

**Color strategy:** **Restrained**. Tinted neutrals + Command Navy primary ≤ 10% of any 008 surface; status soft tints (`warning-soft #fbf0db`, `danger-soft #f7e2e3`) used for banner backgrounds because that *is* the designated surface (per DESIGN.md §5 "Status Banners — Persistent Banner Rule"). No use of Teal Marker as a fill, no nested cards, no gradient text, no glassmorphism, no auto-dismiss toasts for operational state.

**Scene sentence (DESIGN.md "Theme" rule):** *"A pharmacy cashier on their feet during a transaction at a fluorescent-lit branch counter at 11 a.m., glancing from the cart pane to a receipt preview at ~1.5 m from the screen, needing to know whether the printer settled the slip without leaning closer."* The light theme is forced by this sentence — pharmacy overhead lighting plus glanceable-at-counter-distance plus financial accountability rules out dark mode (DESIGN.md Don't #3).

**AI slop check — second order:** First reflex: "POS receipt UI → terminal-green, monospaced, dot-matrix nostalgia." Avoided — the system is Inter Variable, not mono, with Command Navy not green. Second reflex: "POS that's not terminal-green → flat SaaS card with hero metric." Also avoided — receipts are tabular, never a metric-hero template, with persistent banners rather than toasts.

---

## (a) `first_print` printed-slip layout — PENDING REVIEWER

**Owner:** Ahmed (out of `/impeccable` register; printed-slip ESC/POS + canvas-preview composition).

**Inputs the reviewer must produce:**

- Arabic-first RTL header band layout: branch name, branch address line, branch tax-registration ID position, terminal_label position.
- Sale-number prominence: type size / weight / line position. Per FR-046 sale-number is locked for the lifetime of the sale; it MUST be visible at a glance on the slip.
- Latin numerals on every numeric field (sale-number, line subtotals, totals, VAT line, payment-amount, change due) per FR-066 "Arabic-first, Latin numerals on receipts for audit compatibility."
- Cashier-display-name line (Clerk-backed per FR-013 / FR-014 / FR-024) — placement and label-text expectation.
- Sale-level VAT footer composition: rounded totals, VAT amount, tax-registration ID echo.
- ESC/POS column width assumption (typically 42 columns at 80 mm or 32 columns at 58 mm) — choice locks the template engine's wrapping rules in T160.
- Bilingual line composition rule when an item name has both Arabic + Latin renderings.

**Out of scope for this sub-item:** the duplicate-copy marker (sub-item b) and the preview UI panel chrome (sub-item d).

> **REVIEWER:** please paste the printed-slip mock here (image OK; a paste-able plain-text representation is preferred so we can grep it later). When complete, replace this PENDING block with the finished layout description and tick the (a) box in §"Sign-off record" below.

---

## (b) `reprint_duplicate` printed-slip layout — PENDING REVIEWER

**Owner:** Ahmed (out of `/impeccable` register).

**Inputs the reviewer must produce:** everything in (a) plus the **bilingual visible duplicate-copy marker** per FR-029.

**Hard constraints on the marker (from spec §"Reprint", FR-029, R2 mitigation in §"Risks"):**

- Text: `نسخة طبق الأصل — DUPLICATE COPY` (Arabic-first, em-dash separator, English second).
- Position: header band, top-of-slip, **above** sale-number — so a glance at the top edge resolves the question "is this a duplicate?" before any other content is read.
- Weight: largest weight on the slip (heavier than sale-number; the duplicate-copy answer outranks the sale-number answer at a fraud-prevention level).
- Size: ≥ 1.5 × the size of the next-largest header element (typically the branch name).
- Counter-distance glance: must be obvious at ~1.5 m from the receipt holder's eye — the cashier handing a customer a slip and the customer's first impression at arm's length both qualify.
- Print method: bold + underline, OR a printed band fill, OR ESC/POS double-strike — reviewer picks one based on what the printer matrix supports without margin issues.
- Duplicate-copy sequence number (per FR-031): "1" on first reprint, "2" on second, etc. — placement adjacent to or beneath the marker.

**Why (R2 fraud risk):** A reprint visually indistinguishable from the original could be passed as a fresh sale to a refund station and used as a covert refund-fabrication device. The marker's prominence is the load-bearing mitigation.

> **REVIEWER:** please paste the reprint slip mock here, including the duplicate-copy marker rendering. When complete, replace this PENDING block and tick (b) in §"Sign-off record".

---

## (c) `preview` printed-slip content — PENDING REVIEWER

**Owner:** Ahmed (the printed-slip *content* mirrors (a) exactly; the preview *UI chrome* is sub-item d).

**Constraint (FR-027 + AD-6):** The preview content MUST be byte-stable against the eventual print payload. Per the template engine contract, the preview is generated from the same `ReceiptPayload` struct that drives ESC/POS — there is no preview-only content. Reviewer's job here is to confirm the printed-slip layout from (a) is what the preview should render (no preview-only flourishes added at the canvas layer).

> **REVIEWER:** confirm "preview content equals first_print content from (a)" or note the deviation explicitly. Tick (c) in §"Sign-off record".

---

## (d) `<ReceiptPreview>` UI panel — DRAFTED ✅

**Slot:** mounts in the cart workspace's right-side preview region (the same area as the cart summary panel; the preview replaces or stacks above the summary depending on cashier intent). Renders on `receipts.preview` bridge call from a "Preview receipt" affordance in the cart pane.

**Shape (visual structure):**

A single **elevated card** (DESIGN.md §5 "Cards — Elevated card; `--shadow-pane`") with a 14 px `--radius-card` and 32 px padding. The card contains, top to bottom:

1. **Title band** — 56 px tall, white surface, 1 px Quiet Edge bottom divider. Inside, two elements arranged in RTL row:
   - **Title text** (DESIGN.md `typography.title` = Inter 600 18 px, letter-spacing −0.005em): `معاينة الإيصال — Receipt preview` (Arabic-first, em-dash separator, English second).
   - **Close affordance** (Ghost button, 44 × 44, `aria-label="إغلاق المعاينة — Close preview"`, leading-edge X icon) — leading-edge position is RTL-left (visual right). Triggers `receipts.preview` teardown + returns focus to the "Preview receipt" trigger.
2. **Canvas region** — the ESC/POS-faithful canvas render. Fixed thermal-receipt aspect (60 mm or 80 mm width, per the §A3 hardware-matrix pair selected in T006). Background: `--color-surface-elevated #f3f6fa` (Lifted Canvas) — *not* white. This makes the white-paper receipt render read as a physical slip on a holder, not as inline content. Padding 24 px around the canvas inside the card. The canvas itself is a true-to-print 1:1 raster at @1× DPI for screen-reading; an optional 2× toggle (sub-affordance below) lets the cashier zoom for label inspection without changing the print output.
3. **Footer affordance row** — 56 px tall, `--color-surface-elevated` background tint to separate from the canvas, 1 px Whisper Edge top divider. RTL row of three affordances:
   - **Primary action** (DESIGN.md `button-primary`): `طباعة — Print` — Command Navy fill, 44 × 44 floor, leading-edge printer icon. Triggers the first-print path (T173 in tasks.md; calls `receipts.print` via the AD-2 listener side-effect, NOT via a direct renderer call — AD-5).
   - **Secondary action** (DESIGN.md `button-secondary`): `زر التكبير — Zoom 2×` toggle. Pressing toggles canvas @2× DPI for label/font inspection. State persists per preview session only.
   - **Ghost action** (DESIGN.md `button-ghost`): `إغلاق — Close` — duplicates the title-band close, present for keyboard-first cashiers who never reach the title bar.

**Information density rule:** the canvas is the load-bearing region. The title and footer are 56 px each — combined they consume ≤ 112 px of vertical chrome. The remainder of the card height is canvas. No metadata sidebars, no diagnostic overlays, no metric chips. Per DESIGN.md Don't #4: "no SaaS metric-hero templates" — the preview is the *receipt itself*, not a marketing presentation of one.

**Color use:** the card is white surface; the canvas inset is Lifted Canvas; the title text is Midnight Ink; the primary button is Command Navy. Total non-neutral chroma ≤ 8 % of the card area, satisfying the Restrained strategy.

**Motion (DESIGN.md §6 + global ban on layout-property animation):** the card fades in at 120 ms `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) on mount. No bounce. The canvas content itself does not animate. The 2× zoom toggle uses a 100 ms opacity crossfade, never a CSS layout transform on `width/height/padding`. `prefers-reduced-motion: reduce` collapses both to instant.

**a11y (FR-068 / FR-069 / NFR-004):**
- Card has `role="dialog"` `aria-modal="false"` `aria-labelledby` pointing at the title text id (non-modal because per spec it does not block the cart; it overlays the summary slot).
- Title text is `tabindex="-1"` and receives focus on mount; close button restores focus to the trigger on dismount.
- Keyboard contract: `Escape` closes, `Tab` cycles title → canvas (read-only, focusable for screen reader) → Print → Zoom → Close → title. `Enter` on Print fires the print action.
- Every interactive target ≥ 44 × 44 CSS px (icon-only close has a 44 × 44 hit area even though the visible icon is 16 px).
- Canvas region has `role="img"` with `aria-label="معاينة الإيصال للعملية رقم {sale_number} — Receipt preview for sale {sale_number}"`. The numeric sale-number uses Latin digits per FR-066.
- axe-core smoke check fires against the default-state preview in CI (per FR-065 + Constitution §IV / §P14).

**RTL handling:**
- The card itself is logical-properties layout (`padding-inline-start` / `border-inline-end`). The canvas inside is NOT mirrored — the printed receipt is a fixed Arabic-first composition rendered by the template engine; only the surrounding chrome (title bar position of close-X, footer button order, focus traversal) follows the active locale.
- In an English locale (a rare admin override case — Arabic remains default per PRODUCT.md "Arabic-first, RTL layout is the default locale"), button order in the footer reverses but the canvas content does not.

**Empty / loading / error states:**
- **Loading** (between `receipts.preview` call and payload return): canvas region shows a centered 24 × 24 spinner (CSS-rotated `border-top-color: Command Navy`, 80 % opacity), label below `جارٍ التحضير — Preparing preview`. Card title and footer remain present; only the canvas region replaces with the spinner.
- **Error** (payload generation refused, e.g. sale not yet finalized): canvas region replaces with an inline alert composition — `--color-warning-soft` background (NOT a status banner since we are already inside a panel; per DESIGN.md "Persistent Banner Rule" status banners are for *ambient* terminal state, and a preview error is local to the preview). 16 px warning icon (Caution Amber), bilingual error text. Print and Zoom buttons go to Disabled (50 % opacity, `cursor: not-allowed` per DESIGN.md §5 "Buttons — Disabled/Loading").
- **No-op close from `Escape`** never warns or confirms — the preview is a non-destructive surface; closing is free.

**What this is NOT:**
- Not a modal dialog with a backdrop (DESIGN.md Don't #11: "Don't apply modal dialogs as a first-resort pattern"). The preview overlays the cart-summary slot in the cart workspace; the cart pane behind remains visible and operable (Escape closes preview, cart continues).
- Not a toast — toasts auto-dismiss (DESIGN.md Don't #10). The preview only closes on explicit action.
- Not a printable HTML page — the canvas is the *preview-of-print*, not a print substitute. The "Print" button always calls `receipts.print` (which routes to the main-process print pipeline AD-6 + AD-8), never `window.print()`.

---

## (e) `<ReprintAffordance>` — DRAFTED ✅

**Slot:** mounts on a **finalized sale** detail surface (NOT the active cart). The reprint surface is reached from a "Last sale" or "Sales history" lookup affordance — the cashier is acting on a sale already finalized at this terminal. Per FR-028 / AD-10, this affordance is GATED by two distinct conditions with distinct outcomes: **disabled** (visible but inert, with explanatory tooltip) when the sale has no successful `print_events` row yet; **hidden** (not rendered at all) when there is no active operator session. The two outcomes are deterministic — see §"Empty / unavailable states" below for the full state table.

**Shape:**

A **single primary button** in the trailing edge of the sale-detail header band. NOT a card, NOT a dialog, NOT a banner. The visual quietness is intentional — reprint is a routine workflow (a customer asks for another copy mid-shift; the cashier presses one button), not an exceptional escalation.

**Button specification (DESIGN.md `button-secondary` extended):**

- White surface, 1 px Quiet Edge border, 10 px `--radius-control`, 44 × 44 floor.
- Label: `طباعة نسخة — Reprint` (Arabic-first, em-dash, English) — text only, no leading icon. Per DESIGN.md Don't #6 ("no gradient text") and the Inter-only typography rule, the label is `typography.title` (Inter 600 18 px) — readable across the cart bar at counter distance.
- **Hover:** border shifts to 50 %-opacity Command Navy; text shifts from Midnight Ink to Command Navy. No background fill change — secondary buttons stay white on hover (DESIGN.md `button-secondary-hover`).
- **Focus:** 3 px Command Navy halo at 20 % opacity, 2 px offset (DESIGN.md §5 "Buttons — Focus ring").
- **Pressed (active):** brief 80 ms opacity → 90 % to confirm the press. No transform animation.
- **Disabled** (no successful print event yet per AD-10): 50 % opacity, `cursor: not-allowed`, tooltip on focus `لا يمكن إعادة الطباعة قبل الطباعة الأولى — Reprint unavailable until first print succeeds`.
- **Loading** (between press and `receipts.reprint` bridge resolution): CSS spinner appears at the leading edge of the label, label remains visible per DESIGN.md "Buttons — Loading state." Button is non-interactive during loading.

**Confirmation flow:** None at the renderer surface. Per FR-028 and §"Clarifications" line 86 of spec.md, reprint requires **no supervisor override** — any signed-in cashier may invoke reprint on any sale finalized at this terminal. The audit event (FR-031) captures the reprinting operator + shift context post-facto. Wrapping the button in a confirmation modal would contradict §5 of PRODUCT.md ("Honest surfaces — no optimistic UI past durable commit") only if the action were destructive; reprint is **additive** (an extra audit row, an extra printed slip), so the friction of a confirmation is unjustified.

**Counter-distance review (T461 in tasks.md):**

This is the surface T461 will explicitly review at ~1.5 m from screen. The brief commits to:
- Button width ≥ 144 px (3 × the 44 px minimum) so the label is unambiguously a button, not a chip.
- Label uses `typography.title` (18 px, 600 weight) — *not* `typography.label` (12 px) — so the word "Reprint" / "نسخة" is readable from the customer side of the counter without leaning.
- The button sits in the sale-detail header *trailing* (RTL: visual left) edge, separated from any "Refund" or destructive affordance by ≥ 24 px of `--spacing.5` whitespace — to prevent a "muscle memory" misclick on the wrong button. If a destructive affordance exists in the same header, it is `button-destructive` (Alert Red) not a secondary; reprint never neighbors a same-styled button.

**Permission model:** The button is enabled iff (1) an active operator session exists (per FR-013 / FR-024 / FR-028; `requireOperatorSession` enforced server-side in the §A4 bridge handler), and (2) the sale has ≥ 1 successful `print_events` row (AD-10). Both conditions are checked at render time AND server-side; the renderer side is a UX courtesy, the server side is the security boundary.

**Empty / unavailable states:**
- **No print history (sale finalized but printer was offline and a manual override was used):** button disabled, tooltip explains. Manual-override sales per FR-052 are treated as the canonical first print and DO qualify for reprint — so this state only applies if the manual-override checkbox was NOT used, leaving the sale finalized with zero `print_events`.
- **No operator session (timed out per 004 FR-013 / FR-014 — 5-minute inactivity):** button hidden entirely (not disabled — the affordance is meaningless without an operator).

**What this is NOT:**
- Not a "Print options" dropdown — there are no options; per FR-028 a reprint is byte-stable except for the duplicate-copy marker, with no template variants.
- Not a "Reprint with notes" surface — reprints carry no annotations (FR-031 captures the reprinting operator + shift context automatically; the cashier never types).
- Not buried in a context menu — reprint is a one-press affordance per the user story line 116 of spec.md.

---

## (f) `<PrinterFailureBanner>` — DRAFTED ✅

**Slot:** mounts as a **persistent non-modal banner** at the top of the cart workspace, just under the existing 003-shell top bar (where the existing 007 `StatusBanner` connection-state banner sits — `<BannerHost>` per preflight §1's stated extension target). The 008 printer-failure banner stacks BELOW any existing connection banner (offline-banner takes precedence visually as the more general ambient state).

**Shape:**

The visual lineage is the existing `StatusBanner` primitive at `src/renderer/ui/primitives/StatusBanner/StatusBanner.tsx`. The 008 banner extends, not replaces, that primitive. Inherited contracts: full-width band immediately under the top bar; `role="status"` `aria-live="polite"`; non-toast (per DESIGN.md "Persistent Banner Rule" + spec FR-027 / FR-041 + NFR-008); icon + text label (never color-alone per FR-068 / DESIGN.md Don't #9).

**Visual specification:**

- **Surface:** `--color-warning-soft #fbf0db` (Caution Amber soft) background — *not* danger-red. Print failure is a *workflow-degrading* condition, not a catastrophic one (the sale has already been finalized at the data layer; the cashier can still print, retry, reprint later, or hand over a manual receipt). Reserving danger-red for genuinely catastrophic states (offline + payment failed + cash drawer stuck closed simultaneously) preserves its alarm signal — DESIGN.md §5 "Status-Color Containment Rule."
- **Border:** 1 px `--color-warning #b87600` (Caution Amber) on the bottom edge only (full-width band; full borders read as boxed alerts). NEVER a side-stripe (DESIGN.md absolute ban #1).
- **Height:** 56 px (matches 007 banner pattern).
- **Padding:** `--spacing.4` (16 px) vertical, `--spacing.5` (24 px) inline.
- **Content (RTL row):**
  1. **Leading icon** (24 × 24, Caution Amber): a printer-with-warning composite. NOT a generic alert triangle (the banner could be confused for an offline banner) — printer iconography makes the source instantly recognizable from across the room.
  2. **Message text** (`typography.body` Inter 400 16 px, Caution Amber Emphasis `#8f5b00`): bilingual single-line `فشل طباعة الإيصال — Receipt print failed`. If a structured error code is available (per FR-046 / spec §"Receipt printing" line 209), append `· جرّب مرة أخرى أو حول للوضع اليدوي — Retry, or switch to manual receipt`.
  3. **Affordance group** (trailing edge — RTL: visual left). Three buttons, all 44 × 44 floor, arranged in a tight 8 px-gap row:
     - **`إعادة المحاولة — Retry`** (`button-primary`, Command Navy): triggers `receipts.retryPrint` bridge call (T280 in tasks.md). Fresh idempotency key per FR-053. While retry is in flight, the button shows spinner per `button-loading` pattern; the banner remains visible.
     - **`نسخة — Reprint`** (`button-secondary`): treats the retry as a *fresh* first-print (per FR-052), not a reprint, when used immediately after a print-failure. Per spec line 524–531: "**reprint** (treated as a fresh first-print since the original never produced a successful receipt)." The button label still reads "Reprint" because the cashier's mental model is "another attempt at a copy" — but the audit event records it as a first-print not a reprint.
     - **`إيصال يدوي — Manual receipt`** (`button-ghost`): opens the manual-override surface per FR-052 (manual-override is a separate UI surface handled by T512's craft, OUT of this brief — but the entry point is here). The cashier records the manual override; the sale is closed for receipt purposes.
- **No auto-dismiss.** Per FR-041 + NFR-008: persistent until the underlying condition resolves (a successful print, or a manual-override commit, or a retry success). This is **load-bearing** — auto-dismissing this banner would let a print failure go unnoticed and is exactly the "silent failure" PRODUCT.md Principle 3 prohibits.
- **No close-X.** The cashier cannot dismiss this banner without resolving the condition. Adding a close-X would let the failure be ignored.

**Motion:** the banner enters at 160 ms `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart, no bounce) — a fade-and-translateY-(-4px-to-0). On resolution, the banner exits at 100 ms opacity-only fade (faster on exit than entry: the cashier wants to *not* see it as soon as the failure clears). `prefers-reduced-motion: reduce` collapses both to instant.

**a11y (FR-068 / FR-069):**
- `role="status"` `aria-live="polite"` `aria-atomic="true"` — when the banner mounts, screen readers announce the full message + affordance list once. Subsequent re-renders of the same banner (e.g. retry-in-flight → retry-failed) trigger new announcements only on state-id change, not on every paint.
- Keyboard contract: when the banner mounts, focus does NOT auto-shift to it (the cashier may be mid-cart-entry; stealing focus is hostile). Instead, the next `Tab` from any focused element in the workspace cycles through the banner's affordances before returning to the main content. Affordance ordering inside the banner is RTL: Retry → Reprint → Manual.
- Every affordance ≥ 44 × 44 (per FR-068).
- Color is never the only state signal — the printer icon + the bilingual message + the affordance labels all carry meaning without color (per FR-068, PRODUCT.md Accessibility, DESIGN.md Don't #9).

**Stacking (BannerHost contract):**

Per preflight §1, the 008 banners extend `src/renderer/ui/banners/BannerHost.tsx`. Stack order from top:
1. Offline / degraded connection banner (existing 007 surface, ambient terminal state — highest priority).
2. **Printer-failure banner** (new 008 surface — per-sale, slightly lower priority than network state because a network-down terminal can't print at all).
3. **Drawer-failure banner** (sub-item g) — co-equal priority to printer-failure but separate row; both can be shown at once (e.g. network up, printer failed, drawer failed all in one transaction). If both 2 and 3 are present, they stack vertically.

**Empty / no-failure state:** banner is unmounted, not hidden. `aria-live` does not fire on mount — the polite-region semantics are preserved.

**What this is NOT:**
- Not a toast (DESIGN.md "Persistent Banner Rule").
- Not a modal — does not block the cart pane behind it (per spec line 524 "non-modal banner"). The cashier MAY continue scanning items into the next sale's cart while the banner is up; the next sale's finalize event will queue normally per AD-2 v3.
- Not red (Alert Red is reserved for offline / destructive / catastrophic; a print failure is a workflow-degrading recoverable state).
- Not a side-stripe / accent-bar component (DESIGN.md absolute ban #1).

---

## (g) `<DrawerFailureBanner>` — DRAFTED ✅

**Slot:** stacks immediately below the printer-failure banner in the `BannerHost`. If only the drawer failure is active, it occupies the printer-failure banner's row position. Per spec line 510–520 and FR-043, the drawer-failure banner surfaces when the drawer-kick command issued by the main process (AD-8 separate-command path) does not confirm an open within the configured timeout window.

**Shape:**

Same `StatusBanner`-extended structure as (f). Same 56 px height, same padding, same RTL row composition, same NO-auto-dismiss / NO-close-X rule. The visual differences mark it as a *different kind* of failure:

- **Surface:** `--color-warning-soft #fbf0db` (same Caution Amber) — the failure family is "hardware fault, recoverable" matching (f). The cashier mental model: "two hardware affordances can fail at this terminal; both are amber, both are persistent, both have manual paths."
- **Leading icon:** 24 × 24 cash-drawer-with-warning composite. Distinct from the printer icon. Iconography is the load-bearing distinguisher between the two banners — neither is red, both are amber, so the icon must be unambiguous from across the room. Reference: a small line-drawing of an open drawer with a question/exclamation mark overlay.
- **Message text:** bilingual `لم يتأكد فتح الدرج — Drawer did not confirm open`. Optional second clause if the structured error includes a `last_successful_open_at` timestamp: `· آخر فتح ناجح: {relative_ts} — Last successful open: {relative_ts}`. The relative timestamp ("3 minutes ago", "yesterday") helps the cashier judge whether this is a "drawer just stuck for the first time today" event vs "this drawer has been broken since opening" — operational context PRODUCT.md Principle 3 calls "loud failure."
- **Affordance group (RTL row):**
  1. **`فتح يدوي — Manual open`** (`button-secondary`): records the manual override per FR-052 + FR-043; emits the manual-override audit event with terminal_id + reason. Does NOT retry the electronic kick. The cashier physically opens the drawer; the banner clears when the override is committed.
  2. **`إعادة الفتح — Retry open`** (`button-primary`, Command Navy): re-issues the drawer-kick via the main-process AD-8 path. Per FR-053 idempotency: retry uses a fresh `drawer.kick_attempt_id`. The retry MUST NOT print a receipt (drawer events are separate-command from print events per AD-8; the retry only commands the drawer).
- **No reprint button** in this banner. Drawer failure and receipt-print failure are independent paths. If both fail, both banners stack.

**Specific spec callouts honored:**

- FR-043 banner-state structure: terminal_id, attempt_id, last_successful_open_at — all visually surfaced.
- FR-053 idempotency: retry button issues a NEW attempt id; never re-fires the failed one.
- AD-8: drawer kick is a separate ESC/POS command from print. The banner makes this clear by having no "Reprint receipt" affordance — the slip already printed (or is its own failure surfaced in banner f); the drawer failure is independent.
- Spec line 510–520: "non-modal manual-override banner with `last_successful_open_at` relative timestamp." Both honored.

**Motion / a11y / stacking / RTL:** identical to (f). Two banners both `aria-live="polite"` means screen readers will announce them in mount order (printer-failure first if both arrive simultaneously, since printer event precedes drawer kick per AD-8 sequence). If only the drawer banner is up, focus traversal cycles its two affordances before returning to workspace.

**What this is NOT:**
- Not a "low cash" or "drawer near full" alert — those are management-level concerns surfaced elsewhere; this is *hardware did not respond*.
- Not a modal block on next sale — per AD-8 and FR-053 the cashier MAY start a new sale; the drawer event is logged against the originating sale only.
- Not red.
- Not a toast.

---

## Cross-cutting commitments (apply to d / e / f / g)

These are the constitution + DESIGN.md anchors that the embedder MUST verify in the post-craft checklist (preflight §7) after T173 / T290 / T360 / T450 / T512 craft:

| Anchor | Where it shows up in this brief | Verification at craft time |
|:--|:--|:--|
| 44 × 44 touch-target floor (Constitution §IV; FR-068; DESIGN.md "Do #5") | Every button, close-X, banner affordance | CI invariant test + manual axe-core run |
| RTL-first layout (PRODUCT.md Principle 5; FR-066) | All four surfaces composed RTL-first; English is the secondary | Visual probe in `dir="rtl"` + `dir="ltr"` |
| No copy-paste from `_reference/Data-Pulse/` (Constitution §P8; PRODUCT.md anti-references) | None of these surfaces have a legacy analogue; banners extend the 007 `StatusBanner` not Data-Pulse | Diff scan vs `_reference/` |
| No PII / card data / voucher tokens in any rendered state (Constitution §P11; FR-071; CR3) | Receipt preview shows masked PAN per 006 inheritance; banners never echo identity-sensitive content | Redaction audit (T520 / T520a) |
| No optimistic UI past durable commit (PRODUCT.md Principle 1; spec §Principle II) | Print button does not show "Printed!" until `receipts.print` resolves with a successful `print_events` row | Test against simulated print-failure scenario |
| Preload-bridge only (Constitution §P3; spec line bridge contracts) | All four surfaces call `window.api.receipts.*` and `window.api.sales.*` — never IPC directly | Code review + grep for any `ipcRenderer` import in `src/renderer/ui/receipts/` |
| `prefers-reduced-motion: reduce` honored on every animation (PRODUCT.md Accessibility; DESIGN.md §6 + global motion ban) | All four surfaces have motion sections that explicitly collapse on reduced-motion | Manual + smoke test |
| axe-core smoke checks pass on every default-state variant (PRODUCT.md Accessibility; FR-065) | Each surface has an a11y subsection; default state is the smoke-checked one | CI axe-core run |

---

## Open follow-ups (must close before §A1 sign-off)

These are items the reviewer must resolve, OR explicitly accept as deferred, before signing:

- [ ] (a) `first_print` printed slip layout authored — Ahmed.
- [ ] (b) `reprint_duplicate` printed slip layout authored with bilingual duplicate-copy marker — Ahmed.
- [ ] (c) `preview` content confirmation (mirrors a) — Ahmed.
- [ ] Iconography commitment: which specific icon library / SVG paths for the printer-with-warning and drawer-with-warning composites? `lucide-react` is in the project; the brief assumes custom composites built from `lucide` primitives (`Printer` + `AlertTriangle` overlay; `DoorOpen` + `AlertTriangle` overlay). Reviewer to confirm or specify alternative.
- [ ] Whether the `<ReceiptPreview>` 2× zoom toggle is in-scope for v1 or deferred. The brief assumes in-scope; if deferred, the footer simplifies to two buttons (Print + Close).
- [ ] Whether the printer-failure banner's third affordance (Manual receipt) opens an inline surface or a separate modal. Brief assumes inline (no modal first-resort per DESIGN.md Don't #11); reviewer to confirm.
- [ ] Whether the drawer-failure banner's `last_successful_open_at` is shown as a relative timestamp ("3 minutes ago") or absolute ("11:42"). Brief assumes relative for glanceability; reviewer to confirm.

---

## Sign-off record (T011)

> **§A1 sign-off — NOT YET SIGNED**
>
> **Date:** [PENDING]
> **Reviewer:** Ahmed
> **Result:** [PENDING — `approved` or `approved-with-revisions`]
> **`visual-direction/README.md` sign-off SHA:** [PENDING]
> **`/impeccable shape=pass` recorded:** [PENDING — same event as §A1 sign-off per preflight §3]
> **Sub-items covered (T010 (a–g)):**
> - [ ] (a) `first_print` printed slip
> - [ ] (b) `reprint_duplicate` printed slip with bilingual duplicate-copy marker
> - [ ] (c) `preview` content
> - [ ] (d) `<ReceiptPreview>` UI panel
> - [ ] (e) `<ReprintAffordance>`
> - [ ] (f) `<PrinterFailureBanner>`
> - [ ] (g) `<DrawerFailureBanner>`
> **Notes:** (any revision items, deferred decisions, or open follow-ups)

---

## Embedder note

This draft was authored by `/impeccable shape 008-receipt-surfaces` via preflight §3.4 step 5's async submission path. **`shape=pass` is NOT recorded.** Craft on T173 / T290 / T360 / T450 / T512 is **BLOCKED** until the reviewer:

1. Authors sub-items (a) (b) (c) in this file.
2. Optionally redlines (d) (e) (f) (g) and either accepts or amends.
3. Ticks the sign-off boxes in §"Sign-off record" above.
4. Records the sign-off SHA + date in [../coordination.md](../coordination.md) under "§A1 sign-off (T011)".

Only at step 4 do T010 and T011 complete and §A1 clear.
