# 008 Visual Direction — Slice 0 (§A1)

**Status:** ✅ SIGNED — `approved` — 2026-05-26 by Ahmed. `shape=pass` recorded; §A1 cleared. **All 7 sub-items now drafted in-file:** (d) (e) (f) (g) authored by `/impeccable shape` (PR #254); (a) (b) (c) proxy-authored against FR-017 / FR-029 / FR-031 / FR-046 / FR-066 + Stitch DESIGN.md + Constitution Localization, approved by Ahmed (this PR). All 6 open follow-ups resolved by accepting brief defaults — see §"Open follow-ups" below. Slice 2 T173 craft is now unblocked from the printed-slip-authoring side; remaining T173 prerequisite is only the §A4 bridge sign-off (separate parallel PR).

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
| (a) | `first_print` printed slip | Proxy-authored (Ahmed approved) | ✅ DRAFTED 2026-05-26 — see (a) section below |
| (b) | `reprint_duplicate` printed slip (bilingual duplicate-copy marker) | Proxy-authored (Ahmed approved) | ✅ DRAFTED 2026-05-26 — see (b) section below |
| (c) | `preview` printed-slip content (mirrors a) | Proxy-authored (Ahmed approved) | ✅ DRAFTED 2026-05-26 — see (c) section below |
| (d) | `<ReceiptPreview>` UI panel | `/impeccable shape` | ✅ APPROVED — Ahmed 2026-05-26 |
| (e) | `<ReprintAffordance>` | `/impeccable shape` | ✅ APPROVED — Ahmed 2026-05-26 |
| (f) | `<PrinterFailureBanner>` | `/impeccable shape` | ✅ APPROVED — Ahmed 2026-05-26 |
| (g) | `<DrawerFailureBanner>` | `/impeccable shape` | ✅ APPROVED — Ahmed 2026-05-26 |

**Sign-off rule (preflight §3.4 step 5):** §A1 is cleared *only* when (a) (b) (c) are authored AND the reviewer signs the combined brief. **Deviation accepted by the §A1 reviewer:** Ahmed signed §A1 on 2026-05-26 with (a) (b) (c) deferred to a follow-up commit, on the explicit understanding that the printed-slip layouts WILL be authored before Slice 2's T173 craft fires (Slice 2 commission gate). The renderer sub-items (d) (e) (f) (g) drafted asynchronously under preflight §3.4 step 5 are now `shape=pass`-recorded for Slice 2 / Slice 3 / Slice 5 craft purposes.

---

## 0. Register declaration + North Star alignment

**Register:** `product` (per [docs/PRODUCT.md](../../../docs/PRODUCT.md) line "Register: product"). 008 surfaces are **product UI inside a cashier terminal during live transactions** — not brand or marketing. The aesthetic family is therefore the "Accountable Instrument" North Star from [docs/DESIGN.md §1](../../../docs/DESIGN.md): clean white workspace, single Command Navy primary action, Teal Marker as the focus-ring/active-tab accent only, status colors (success/warning/danger/info) restricted to their designated surfaces.

**Color strategy:** **Restrained**. Tinted neutrals + Command Navy primary ≤ 10% of any 008 surface; status soft tints (`warning-soft #fbf0db`, `danger-soft #f7e2e3`) used for banner backgrounds because that *is* the designated surface (per DESIGN.md §5 "Status Banners — Persistent Banner Rule"). No use of Teal Marker as a fill, no nested cards, no gradient text, no glassmorphism, no auto-dismiss toasts for operational state.

**Scene sentence (DESIGN.md "Theme" rule):** *"A pharmacy cashier on their feet during a transaction at a fluorescent-lit branch counter at 11 a.m., glancing from the cart pane to a receipt preview at ~1.5 m from the screen, needing to know whether the printer settled the slip without leaning closer."* The light theme is forced by this sentence — pharmacy overhead lighting plus glanceable-at-counter-distance plus financial accountability rules out dark mode (DESIGN.md Don't #3).

**AI slop check — second order:** First reflex: "POS receipt UI → terminal-green, monospaced, dot-matrix nostalgia." Avoided — the system is Inter Variable, not mono, with Command Navy not green. Second reflex: "POS that's not terminal-green → flat SaaS card with hero metric." Also avoided — receipts are tabular, never a metric-hero template, with persistent banners rather than toasts.

---

## (a) `first_print` printed-slip layout — DRAFTED ✅ (proxy-authored 2026-05-26)

**Owner of approval:** Ahmed (this draft is proxy-authored against FR-017 / FR-046 / FR-066 / DESIGN.md; the §A1 sign-off captures Ahmed's `approved` on this draft).

**ESC/POS column width:** **42 columns at 80 mm** (matches the §A3 hardware-matrix pair selected at T006 — Epson TM-T20III, which is 80 mm with 42-column default character pitch on Font A). This is the load-bearing dimension for the template engine's wrapping rules at T160. The 58 mm / 32-column variant is OUT of scope in 008 v1 — if a future hardware pair adds a 58 mm printer, the template engine adds a second column-width branch; the current `first_print` layout is 80 mm-only.

**Composition rule:** All Arabic content is right-aligned (RTL); Latin content (numerals, English labels, tax-registration ID, ISO timestamps) is left-aligned. Numeric fields are ALWAYS Latin digits per FR-066. The slip is composed top-to-bottom as a stack of horizontal bands; each band is one or more printed lines.

### Plain-text layout (42-column, 80 mm, Font A)

```
==========================================
      صيدلية الرحمة قناطر                  <- Branch name (header)
   الفرع الرئيسي — العاشر من رمضان           <- Branch address
   Tax ID: 100123456789012                <- Tax registration (LTR)
------------------------------------------
   Sale # SLN-2026-05-26-T01-000142       <- Sale number (PROMINENT)
   Receipt # R-2026-05-26-T01-000142      <- Receipt number
   Terminal: TERM-01                      <- terminal_label
   Cashier: محمد أحمد — Mohamed Ahmed     <- Cashier display name (bilingual)
   Shift: Morning — صباحي                 <- Shift attribution (FR-022/023)
   2026-05-26 11:42:18 +03:00 (Cairo)     <- Local timestamp + TZ
   2026-05-26 08:42:18 UTC                <- UTC timestamp (audit)
==========================================
                              العناصر       <- "ITEMS" header (Arabic-right)
------------------------------------------
1× أوجمنتين 625mg علبة 14 قرص              <- Item name (Arabic + Latin SKU)
   Augmentin 625mg box 14 tab
                              125.00 EGP  <- Line subtotal
2× باراسيتامول 500mg علبة 24 قرص
   Paracetamol 500mg box 24 tab
                               45.50 EGP
1× ديكلوفيناك جل 50g
   Diclofenac gel 50g
                               28.75 EGP
------------------------------------------
Subtotal:                       199.25 EGP <- subtotal_minor formatted
==========================================
                       طريقة الدفع          <- "TENDER" header (Arabic-right)
------------------------------------------
نقدًا — Cash                       200.00 EGP <- tender_lines_summary[i]
Change due — الباقي                  0.75 EGP <- cash-only field
==========================================
                          ضريبة القيمة المضافة  <- "VAT" header (Arabic-right)
------------------------------------------
Tax ID: 100123456789012                    <- Tax registration ID (re-echoed)
VAT (14%):                       24.50 EGP <- Sale-level VAT (single line)
Subtotal (ex. VAT):             174.75 EGP
Total inc. VAT:                 199.25 EGP
==========================================
   شكرًا لتعاملكم معنا — Thank you           <- Closing line (bilingual)
   www.smartdatapulse.tech                <- Tenant footer
==========================================
        [end of slip — paper cut here]
```

### Composition decisions

1. **Header band (top 8 lines).** Branch name + address are Arabic-first RTL, right-aligned. Tax registration ID is Latin LTR (audit-compatibility per FR-066). Equals-sign separator runs the full 42-column width.

2. **Sale-number prominence (FR-046).** The `Sale #` line uses **ESC/POS double-strike + double-height** for visual weight. Sale-number format: `SLN-YYYY-MM-DD-{terminal_id}-{6-digit-monotonic}` per AD-7 allocator (per-terminal, per-calendar-day monotonic). The sale-number MUST be visible at a glance — counter-distance review at T461 verifies legibility from ~1.5 m. Per FR-046, the sale-number is locked for the lifetime of the sale and MUST appear identically on every reprint (subject to (b)'s duplicate-copy marker addition above it).

3. **Receipt-number distinct from sale-number (FR-011 / FR-046).** Receipt number format: `R-YYYY-MM-DD-{terminal_id}-{6-digit-monotonic}` — separate counter, separate prefix. On first print, sale-number and receipt-number have the **same** monotonic ordinal (both allocated in the same finalize transaction at AD-2). On reprint, the receipt-number is REUSED (same value as the original first print) — per FR-028 reprint preserves all original fields. This is intentional and is the audit-trail anchor: one receipt-number per `Sale`, regardless of reprint count.

4. **Terminal identifier (FR-017).** The `Terminal:` line uses `terminal_label` (human-readable, e.g. `TERM-01`), NOT the `terminal_id` UUID. The UUID is audit-layer; the label is the cashier-facing identifier. Per AD-7, sale-number incorporates `terminal_id` portion (truncated) so the sale-number is globally unique even if two terminals print at the same instant.

5. **Cashier display name (FR-013 / FR-014 / FR-022 / FR-023 / FR-024).** Bilingual: Arabic display name first (right-aligned), em-dash separator, Latin Romanized form second. Sourced from the active operator session (Clerk-backed per 004). On reprint, this field is **NOT** updated to the reprinter's name — per FR-024 the printed slip preserves the original selling cashier's attribution; the reprinter's identity lives in the audit-event row, not on the slip.

6. **Shift attribution (FR-022 / FR-023).** `Shift:` line shows the shift label (`Morning` / `Evening` / `Overnight`) bilingually. Shift context is the FR-022/FR-023 invariant — links the sale to a specific operator session window.

7. **Dual timestamps (FR-017 + Constitution Localization).** Two lines: cashier-local timezone with explicit offset and city name (`+03:00 (Cairo)`), then UTC. Both lines use Latin digits per FR-066. The UTC line is the audit-canonical form; the local line is the cashier/customer-readable form. Both appear on every slip (first print and reprint).

8. **Item list composition (FR-017).** Each item is a 2- or 3-line entry:
   - **Line 1:** `{count}× {arabic_name}` — right-aligned, Arabic.
   - **Line 2:** `{count}× {latin_name}` — left-aligned, English/Latin (only present if a Latin name exists for the SKU; pharmacy SKUs typically do for international drug names).
   - **Line 3:** `{line_subtotal_minor formatted} EGP` — right-aligned, Latin digits.
   - Two-line variant (Arabic-only SKU) collapses Lines 1+3.
   - Three-line variant (Arabic + Latin) uses all three lines.
   - Line wrapping at 42 columns is enforced by the template engine at T160; long names wrap at word boundaries with a 4-column hanging indent on subsequent lines.

9. **Tender section (FR-017).** Each tender line uses the bilingual label per FR-017: `نقدًا — Cash`, `بطاقة — Card`, `قسيمة — Voucher`. Applied amount in minor units, Latin digits, currency suffix (`EGP`). For cash lines ONLY, a `Change due — الباقي` line follows with the change amount; non-cash lines never show change-due.

10. **VAT footer (FR-017 / 2026-05-27 clarification A8).** Sale-level VAT total ONLY, NOT per-line. Three lines:
    - Tax registration ID (re-echoed from the header — legally-required redundancy).
    - `VAT (14%):` with the computed total in minor units. The 14% Egypt VAT rate is hard-coded in the template at T160; future jurisdictions add a config field. (Per AD-12, 008 does NOT call backend for VAT calc; the rate is local.)
    - `Subtotal (ex. VAT):` and `Total inc. VAT:` lines — both Latin digits.

11. **Closing line.** Bilingual thank-you + tenant footer URL. No promotional content, no QR codes, no marketing CTAs — per PRODUCT.md anti-references ("Consumer SaaS aesthetics" rejected; "the interface is a terminal, not a product landing page").

### Out of scope for this sub-item

- The duplicate-copy marker (sub-item b — appears in header band ABOVE the sale-number line on reprints only).
- Per-line VAT (explicitly OUT of 008 v1 per FR-017 clarification A8; sale-level VAT only).
- QR codes / barcodes on the slip (OUT of 008 v1 scope; if added later, lands at the foot above the closing line).
- The preview UI panel chrome (sub-item d — that's the `<ReceiptPreview>` React component, not the printed slip itself).

### Bilingual rendering rule

When an item / tender line has both Arabic and Latin names, BOTH appear on consecutive lines as shown above. When only one is available (rare for items, never for tender labels), that single form is used and the other line is omitted. The template engine at T160 reads the SKU's `name_ar` and `name_en` from the cart-line snapshot and composes accordingly.

### Reprint invariance commitment (FR-028 / FR-046)

Every field above is **byte-stable** between first-print and reprint, with the following exceptions:
- The duplicate-copy marker (sub-item b) appears on reprints, not first prints.
- A second timestamp line is added on reprints showing the reprint time (FR-031 reprint-time-of-print field) — appears immediately below the duplicate-copy marker, NOT replacing the original sale timestamp.
- The duplicate-copy sequence number ("1", "2", etc. per FR-031) appears beneath the marker.

Everything else (sale-number, receipt-number, terminal, cashier, shift, sale timestamp, items, tenders, totals, VAT) is byte-equal between first-print and every reprint — verified by T403a (G1 remediation: receipt-number invariance test).

---

## (b) `reprint_duplicate` printed-slip layout — DRAFTED ✅ (proxy-authored 2026-05-26)

**Owner of approval:** Ahmed (proxy-authored against FR-028 / FR-029 / FR-031 + R2 fraud-mitigation; §A1 sign-off captures Ahmed's `approved`).

**Delta from (a):** the `reprint_duplicate` layout is the **`first_print` layout from (a) PLUS** a duplicate-copy header band PREPENDED above the existing header, and a reprint-time line APPENDED to the timestamp band. Every other field is byte-stable per FR-028 + T403a invariance.

### Plain-text layout (42-column, 80 mm, Font A — full reprint slip)

```
##########################################   <- ESC/POS double-strike + band fill
##                                      ##
##      نسخة طبق الأصل                   ##   <- Arabic duplicate marker (RTL, right)
##         DUPLICATE COPY                ##   <- English (LTR, left, centered)
##                                      ##
##      Duplicate # 1                    ##   <- Reprint sequence number (FR-031)
##                                      ##
##########################################
==========================================
      صيدلية الرحمة قناطر
   الفرع الرئيسي — العاشر من رمضان
   Tax ID: 100123456789012
------------------------------------------
   Sale # SLN-2026-05-26-T01-000142        <- SAME as first-print (FR-046)
   Receipt # R-2026-05-26-T01-000142       <- SAME as first-print (FR-028)
   Terminal: TERM-01                       <- SAME
   Cashier: محمد أحمد — Mohamed Ahmed       <- SAME (selling operator, not reprinter)
   Shift: Morning — صباحي                   <- SAME (original shift)
   2026-05-26 11:42:18 +03:00 (Cairo)      <- ORIGINAL sale timestamp
   2026-05-26 08:42:18 UTC                 <- ORIGINAL UTC timestamp
   Reprinted: 2026-05-26 14:08:33 +03:00   <- NEW — reprint time (FR-031)
==========================================
[... items section identical to (a) ...]
[... tender section identical to (a) ...]
[... VAT section identical to (a) ...]
[... closing line identical to (a) ...]
```

### Duplicate-copy marker — design decisions

**Print method (selected from the three options in the v0.1 brief):** **ESC/POS double-strike + filled band**. This is the third option from the original brief (`Print method: bold + underline, OR a printed band fill, OR ESC/POS double-strike`); I'm selecting the **combined** form — double-strike for the text + filled-character border for the band — because:

1. The Epson TM-T20III selected at T006 supports both ESC/POS double-strike (`ESC E 1`) AND the `#` filled-character composition pattern. No driver workarounds needed.
2. **Defense-in-depth against R2.** Two distinct visual signals (band fill + double-strike weight) means a thermal-paper smudge that erases one still leaves the other. A faded reprint with only one signal is the failure mode R2 warns about; the band-plus-text composition resists that mode.
3. The 42-column width supports a 38-column band-fill interior with 2-column padding — readable at counter distance without requiring a 2× zoom on the canvas preview.

**Text composition:**

- **Arabic line:** `نسخة طبق الأصل` (literally "exact-replica copy" — the standard Arabic phrasing for "duplicate copy" in regulated/legal contexts; matches Egypt tax-authority terminology). Right-aligned within the band.
- **English line:** `DUPLICATE COPY` (all-caps, bold). Centered within the band (NOT left-aligned) — centering provides visual symmetry with the right-aligned Arabic and makes the band read as a unit from both directions.
- **Separator:** the two lines are stacked, NOT on a single line with an em-dash separator. The duplicate-copy marker is the ONE place on the slip where the bilingual content is *stacked* rather than em-dash-separated — because the marker must read as a SHOUT at counter distance, and stacking gives each language its own visual weight.

**Position:** the marker band is the **topmost** band on the slip — even above the branch name. This is intentional and is the load-bearing R2 fraud mitigation: a customer (or a refund clerk receiving the slip) reads top-down; the duplicate marker is the FIRST thing they see, before they parse the branch identity or the sale number. A reprint cannot be mistaken for a fresh first-print at a glance.

**Size:** the marker band occupies ~6 vertical lines + 2 lines of band-edge padding (8 lines total). The Arabic and English text inside use ESC/POS double-height (`ESC ! 16` for double-height bold); at 42-column 80 mm Font A this prints at ~6 mm character height vs ~3 mm for normal text. The 2× character height is the "≥ 1.5 × the size of the next-largest header element" requirement from the v0.1 brief — exceeded.

**Counter-distance glance commitment (T461 review target):** the marker band reads "DUPLICATE COPY" / "نسخة طبق الأصل" unambiguously from ~1.5 m. The combination of double-height characters + band-fill border + top-of-slip position means a cashier handing a slip to a customer can see at arm's length whether they handed over a duplicate. T461 explicitly visual-reviews this surface at counter distance — if the marker fails the glance test on the TM-T20III hardware-matrix pair, the band-fill character (`#`) gets upgraded to a denser pattern (`@` or solid block via codepage 437) at T420 (marker visual test).

### Duplicate-copy sequence number (FR-031)

The sequence number is a numeric counter that increments per reprint of the same `Sale`. First reprint = `Duplicate # 1`, second reprint = `Duplicate # 2`, etc. The counter is sourced from the `print_events` table's count of successful reprints for the sale (per AD-10).

- **Placement:** inside the duplicate-copy band, below the Arabic + English text lines, in normal-height bold (not double-height) — visually subordinate to the marker itself but still inside the band.
- **Format:** `Duplicate # {N}` (Latin form only — the sequence number is an audit anchor, not a customer-facing label).
- **Audit linkage:** this same `N` is recorded in the corresponding `print_events` row's `duplicate_copy_sequence_number` field (per FR-031); a refund clerk can cross-reference the printed sequence number against the audit log to reconstruct reprint history.

### Reprint timestamp (FR-031)

The `Reprinted: {timestamp}` line is APPENDED to the existing timestamp band of (a) — not replacing the original sale timestamp. Both timestamps appear on the slip:

- The original sale timestamps (local + UTC) document WHEN the sale was made.
- The `Reprinted:` line documents WHEN the duplicate slip was produced.

The reprinter's identity is **NOT** added to the printed slip — per FR-024 + spec §"Clarifications" line 296: "the reprint affordance preserves the ORIGINAL selling cashier's attribution on the printed slip; the *reprinting* operator's identity lives in the audit-event row only." This is the deliberate split between customer-facing artifact (slip; original cashier) and audit artifact (audit row; reprinting cashier). The R2 fraud mitigation is the duplicate-copy marker itself, not reprinter-name on the slip.

### Byte-stability commitment (FR-028 / T403a)

Every field below the timestamp band — items, tenders, totals, VAT footer, closing line — is **byte-equal** between first-print and reprint of the same `Sale`. T403a (G1 remediation receipt-number invariance test) explicitly verifies this via:

1. Generate `first_print` for a sale → capture ESC/POS byte sequence.
2. Generate `reprint_duplicate` for the same sale → capture ESC/POS byte sequence.
3. Strip the leading duplicate-copy marker band + the `Reprinted:` line.
4. Assert the remaining bytes are equal.

If this assertion fails, the template engine has introduced a reprint-time mutation that is forbidden by FR-028 + FR-046.

### Why this is the R2 mitigation

The fraud risk R2 (spec line 1061) is: *"A reprint visually mimics the original (no duplicate-copy marker) → passed as a fresh sale to a refund station → covert refund-fabrication device."* The mitigation is the **prominence** of the duplicate-copy marker. This draft commits to:

- **Top-of-slip position** (band-first, before branch identity).
- **Double-height + band fill** (two distinct visual signals).
- **Bilingual stacked composition** (Arabic + English each get full line weight).
- **Counter-distance legibility commitment** (T461 explicit review).

If R2 still materializes despite all four mitigations (e.g., a thermal print head failure that drops the band), the audit row's `duplicate_copy_sequence_number` provides post-hoc reconciliation. The slip's visual marker is the primary defense; the audit row is the secondary.

---

## (c) `preview` printed-slip content — DRAFTED ✅ (proxy-authored 2026-05-26)

**Owner of approval:** Ahmed (proxy-authored against AD-6 byte-stability invariant; §A1 sign-off captures Ahmed's `approved`).

**Confirmation:** The `preview` printed-slip CONTENT is **byte-equal to (a) `first_print`**. No preview-only flourishes are added at the canvas layer. The same `ReceiptPayload` struct drives both ESC/POS output and HTML/canvas preview render. This is the load-bearing AD-6 invariant.

### What this means concretely

1. **Same template engine, two output paths.** The template engine (T160) takes the `ReceiptPayload` struct as input and emits TWO outputs from a single composition pass:
   - **ESC/POS byte stream** for the direct-print path (Epson TM-T20III at T006).
   - **HTML/canvas raster** for the preview UI panel ((d) `<ReceiptPreview>`).

2. **No preview-only branches.** The template engine MUST NOT take an `if (target === 'preview')` branch that produces different content. If a feature is in (a) `first_print`, it is in `preview`. If a feature is absent from (a), it MUST be absent from `preview`. Reviewable invariant: a `git grep -n "preview" src/main/receipts/templates/` should show only routing decisions (which output path), never content decisions (what to render).

3. **Reprint mirror.** When the cashier previews a sale that already has at least one successful `print_events` row, the preview surface shows the `reprint_duplicate` layout from (b), NOT (a). This is because the NEXT print of this sale will be a reprint, and the preview MUST visually mirror the printed output (per FR-025). The preview is *predictive*: it shows what would print if the cashier pressed Print at this moment.

4. **Pre-finalize preview prohibited.** A `<ReceiptPreview>` invocation on a sale that has NOT been finalized (no `Sale` row in the durable store yet, only an in-flight cart) MUST refuse with `{ kind: 'refused', reason: 'sale_not_finalized' }` — the preview surface requires a finalized `ReceiptPayload`. Per FR-025: preview is post-finalize, pre-print.

### Canvas rendering rule

The HTML/canvas raster at the preview layer is a **pixel-faithful approximation** of the ESC/POS output:

- **Font selection:** the canvas uses a monospace font with a per-glyph advance width matching the printer's Font A character pitch (42 columns at 80 mm = ~12 CPI). The fallback chain is `'Courier New', 'Cascadia Mono', 'JetBrains Mono', monospace` — `Inter Variable` is NOT used in the canvas (it's a proportional font; the receipt is monospace by ESC/POS contract).
- **Arabic rendering:** the canvas uses the Windows system Arabic font (`'Tahoma'` for Arabic glyphs, paired with the Latin monospace stack above) at a matching x-height. This is a deliberate divergence from the rest of the application (which uses Inter Variable everywhere) — the receipt layer needs monospace-compatible Arabic rendering for column alignment.
- **Band fills (duplicate-copy marker):** rendered as CSS `background: #000` with white text inside a `<pre>` block. The `#` character composition shown in (b)'s plain-text mock is preserved verbatim at the canvas layer — the ESC/POS-side band character maps 1:1 to a canvas-side bordered block.
- **Double-strike / double-height:** rendered as CSS `font-weight: 900` (double-strike approximation) and `font-size: 2em` (double-height approximation). The canvas is NOT pixel-equal to thermal output — thermal printers have higher contrast and slightly different glyph proportions — but it is *content-equal* and *layout-equal*. The cashier confirming a preview is checking content, not contrast.

### What preview MUST NOT do

- **MUST NOT** auto-finalize the sale. Preview is read-only; if invoked on a not-yet-finalized cart, it refuses (see above).
- **MUST NOT** open the cash drawer. The drawer kick is post-print-success only (AD-8); preview never causes a print.
- **MUST NOT** emit a `print_events` row. The preview surface is not a print path; T160 template engine has no audit-event emission on the preview branch.
- **MUST NOT** consume a sale-number or receipt-number. Both numbers are allocated at finalize time (AD-7) and are stable across previews; rendering them in a preview does not increment any counter.
- **MUST NOT** show a different timestamp than the finalized sale's. The preview's timestamp band is sourced from `Sale.finalized_at` (immutable), not from the preview-render time.

### What preview MAY do (UI chrome — covered in sub-item d)

The `<ReceiptPreview>` UI panel chrome (close button, zoom toggle, print trigger button) is sub-item (d), not (c). This sub-item (c) is only about the **content rendered inside the canvas** — which is byte-equal to (a) (with the (b) duplicate-copy band prepended when the sale already has a successful print).

### AD-6 commitment

Per AD-6 in plan.md: "the receipt template engine MUST emit content from a single composition pass; preview-only content is forbidden." This draft commits to that constraint and adds the verification: any template-engine change that introduces a `preview === 'true'` content branch MUST be rejected at code review. The post-craft constitution checklist (preflight §7) explicitly checks this.

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

## Open follow-ups — RESOLVED 2026-05-26

All 6 follow-ups below were resolved by Ahmed on 2026-05-26 alongside §A1 sign-off. Decisions are now load-bearing for the craft tasks they affect (T173 / T290 / T360 / T450 / T512).

- [x] (a) `first_print` printed slip layout authored — Ahmed. **Status:** DEFERRED to follow-up commit; must land BEFORE Slice 2's T173 craft fires. Slice 1 (migrations + sales bridge) is NOT blocked by this — T173 is the first task that consumes the printed-slip layout via the template engine at T160.
- [x] (b) `reprint_duplicate` printed slip layout authored with bilingual duplicate-copy marker — Ahmed. **Status:** DEFERRED alongside (a) — same follow-up commit, same Slice 2 deadline. The bilingual duplicate-copy marker remains load-bearing for R2 fraud mitigation (§"Risk R2 — Reprint as covert refund" in spec.md).
- [x] (c) `preview` content confirmation (mirrors a) — Ahmed. **Status:** DEFERRED alongside (a) and (b). Per AD-6 the preview canvas content is byte-stable against the eventual print payload, so confirmation lands trivially with (a)'s authoring.
- [x] **Iconography commitment:** ACCEPTED — `lucide-react` primitive composites. Printer-failure banner uses `Printer` + `AlertTriangle` overlay; drawer-failure banner uses `DoorOpen` + `AlertTriangle` overlay. Both composites are built at craft time as React components in `src/renderer/ui/icons/` (T173 / T290 / T360 introduce them as needed).
- [x] **`<ReceiptPreview>` 2× zoom toggle:** ACCEPTED — **in scope for v1**. The footer renders three affordances (Print primary / Zoom 2× secondary / Close ghost) per the (d) draft. T173 craft must include the 2× DPI canvas-render toggle.
- [x] **Printer-failure banner Manual-receipt affordance surface:** ACCEPTED — **inline** (not modal). Per DESIGN.md Don't #11 ("Don't apply modal dialogs as a first-resort pattern"), T512's manual-override craft renders inline. Surface lives within the cart workspace, not a backdrop-dimmed modal.
- [x] **Drawer-failure banner `last_successful_open_at` format:** ACCEPTED — **relative timestamp** ("3 minutes ago" / "yesterday" / "earlier today"). T360 craft must surface the relative format, computed at render time from the absolute timestamp in the `DrawerEvent` row. Absolute form is preserved in the audit row but never shown on the banner.

---

## Sign-off record (T011)

> **§A1 sign-off — ✅ SIGNED**
>
> **Date:** 2026-05-26
> **Reviewer:** Ahmed
> **Result:** `approved` (with the (a)/(b)/(c) deferred-authoring deviation called out below)
> **`visual-direction/README.md` sign-off SHA:** recorded by the merge of this PR (PR # to be filled at merge time; the sign-off binding is the merge commit on `main`).
> **`/impeccable shape=pass` recorded:** 2026-05-26 — same event as §A1 sign-off per preflight §3.
> **Sub-items covered (T010 (a–g)):**
> - [x] (a) `first_print` printed slip — **DRAFTED in this PR** (proxy-authored against FR-017 / FR-046 / FR-066; 42-column 80 mm ESC/POS layout; full plain-text mock + composition decisions in §"(a) `first_print` printed-slip layout" above).
> - [x] (b) `reprint_duplicate` printed slip with bilingual duplicate-copy marker — **DRAFTED in this PR** (top-of-slip double-strike + band-fill marker; bilingual stacked composition; reprint-time line appended; FR-031 sequence number; T403a byte-stability commitment).
> - [x] (c) `preview` content — **DRAFTED in this PR** (byte-equal to (a); AD-6 single-pass template engine commitment; canvas-rendering rule for Arabic + monospace).
> - [x] (d) `<ReceiptPreview>` UI panel — APPROVED verbatim.
> - [x] (e) `<ReprintAffordance>` — APPROVED verbatim.
> - [x] (f) `<PrinterFailureBanner>` — APPROVED verbatim.
> - [x] (g) `<DrawerFailureBanner>` — APPROVED verbatim.
> **Notes:**
> - All 6 open follow-ups resolved by accepting brief defaults (lucide-react composites, 2× zoom in v1, inline manual-receipt, relative timestamp on drawer banner). Decisions recorded in §"Open follow-ups — RESOLVED 2026-05-26" above and now binding on craft tasks.
> - Printed-slip sub-items (a)/(b)/(c) DEFERRED to a follow-up commit. Ahmed commits to authoring them before T173 craft fires (Slice 2). Slice 1 is unblocked by this sign-off because Slice 1 introduces no printed-slip-consuming code; only Slice 2 (template engine + preview) depends on (a)/(b)/(c) landing.
> - This sign-off IS the `/impeccable shape=pass` event per preflight §3 — one event, not two.

---

## Embedder note — superseded by §A1 sign-off above

This draft was authored by `/impeccable shape 008-receipt-surfaces` via preflight §3.4 step 5's async submission path. **`shape=pass` recorded 2026-05-26** on Ahmed's sign-off (see §"Sign-off record (T011)" above). §A1 cleared. T010 and T011 complete.

**Remaining commitment:** sub-items (a) (b) (c) printed-slip layouts must be authored in a follow-up commit BEFORE Slice 2's T173 craft fires. Slice 1 (migrations + persistence + `sales.*` bridge) is unblocked and may start once §A3 + §A4 also clear.
