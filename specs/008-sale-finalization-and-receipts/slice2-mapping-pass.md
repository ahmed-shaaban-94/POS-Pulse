# Slice 2 field-mapping pass — ReceiptPayload vs durable Sale data

**Author:** Claude (Opus 4.8) · **Date:** 2026-05-28 · **Status:** RESOLVED (Ahmed 2026-05-28)

## Decisions (Ahmed, 2026-05-28)

- **Gap 1 (no lines field):** add `lines: readonly ReceiptLineItem[]` to
  `ReceiptPayload`; T164 derives from `lines_json`. (No question — additive.)
- **Gap 2 (bilingual names):** **render the single `display_name` per line**;
  omit the second name line. Bilingual ar/en split is a v2 item pending
  catalogue integration. The §(a) item composition is v1-rendered as the
  single-name (2-line: `{n}× {name}` then `{subtotal} EGP`) variant.
- **Gap 3 (shift line):** **omit the Shift line from the v1 slip.** v2 item
  pending a sales↔shift link. Shift attribution remains in the audit trail.

Net: the v1 slip is a faithful subset of §(a) — every persisted field is exact;
the two unpersistable fields (second name line, shift) are dropped, not faked.

## Decision 3 (engine-design, 2026-05-28) — VAT rate label at tax=0

§(a) decision 10 hard-codes a "VAT (14%):" label. But `total_tax_minor = 0` in
v1 (Egyptian VAT is a §A5/v2 item). Rendering the layout literally would print
"VAT (14%): 0.00 EGP" with "Subtotal ex-VAT == Total inc-VAT" on a *fiscal*
receipt — a misleading rate label on a tax document. Consistent with the
single-name / no-shift v1-subset posture: **drive the VAT block from
`total_tax_minor`; suppress the "14%" rate label when tax is 0** (render the
tax amount, no rate). The "14%" label returns in v2 when real VAT computation
lands. Same class as Gaps 2/3 — render-what's-true, don't fake the spec.

## Engine architecture (T160) — compose-once, two serializers

Per design review: NOT parallel renderEscPos/renderHtml (they drift). Instead a
single `compose(payload) → Band[]` intermediate (each Band = {text, align,
weight, height} or marker/separator), then mechanical `toEscPos(bands)` +
`toHtml(bands)` serializers. 42-col word-wrap + hanging indent happen IN compose
so both outputs break identically. `preview` resolves to the SAME band set as
`first_print` (byte-equal by construction); `reprint_duplicate` = that set +
prepended marker band + appended `Reprinted:` line. Determinism: format from
stored ISO strings (never `new Date()`), no `toLocaleString`/`Intl` for dates
(locale-dependent → breaks byte-stability), money via `money.ts` only, iterate
arrays not maps. ESC/POS Arabic codepage (CP864 vs 1256) is a Slice 3 hardware
concern — v1 emits structurally-correct control codes with a documented encoding
assumption; T301/T302 confirm on the TM-T20III.

## T161/T162/T163 deviation — no separate `.template` asset files

tasks.md T160 framed the engine as "parses a template asset," and T161/T162/T163
as authoring three `*.bilingual.template` files (first_print / reprint_duplicate
/ preview). The compose-once IR architecture supersedes that: the layout is the
`compose()` function (the single first-party "template"), and the three variants
are the `ReceiptTemplateVariant` branches inside it (marker band + reprint line
for `reprint_duplicate`; `preview` ≡ `first_print` by band-selection). Authoring
three external asset files the engine never reads would be dead code and would
RISK byte-stability (a parsed-asset layer is exactly the indirection R-6 rejected
when it ruled out Handlebars/EJS/Mustache). So T161/T162/T163 are satisfied **in
code** by the variant branches in `template-engine.ts`, not by separate files.
The §A1-approved layouts (a)/(b)/(c) remain the visual spec the compose logic is
written against. This is an implementation detail within the locked AD-6
decision ("first-party single-source dual-output engine"), not a scope change.


Before writing any Slice 2 test, mapped every field the §(a) `first_print` slip
layout renders (visual-direction/README.md line 44+) against `ReceiptPayload`
(src/shared/receipts/types.ts) and the persisted Sale row. Same discipline that
caught the display_name + F-007 gaps in Slice 1.

## Clean (source confirmed)

| Slip field | ReceiptPayload | Sale-row source |
|:--|:--|:--|
| branch_name / branch_address / tax_reg_id | ✅ | terminal_assignment (T094a) |
| sale_number / receipt_number | ✅ | sales (AD-7) |
| terminal_label | ✅ | terminal_assignment |
| cashier display name | ✅ `selling_operator_display_name` | sales (persist-at-settlement) |
| subtotal / total_tax / change_due | ✅ | sales |
| tender breakdown (Cash/Card/Voucher + change) | ✅ `tender_lines_summary` | sales `tender_lines_summary_json` |
| settled_at / finalized_at / local_calendar_day | ✅ | sales |

## GAPS (durable data cannot satisfy the §(a) layout as written)

### Gap 1 — ReceiptPayload has NO line-items field
`ReceiptPayload` (T033, authored in Slice 1b before lines_json/T028a existed)
carries totals + tender but **no `lines` field**. The §(a) body is an itemised
list. **Fix is additive + low-risk:** add `lines: readonly ReceiptLineItem[]` to
ReceiptPayload; T164 derives it by parsing the Sale row's `lines_json`. No
decision needed — this is just completing the T033↔T028a seam.

### Gap 2 — bilingual item names (name_ar / name_en) NOT persisted  ⟵ DECISION
§(a) item composition (decision 8 + bilingual rule, lines 120-146) wants each
item on 2-3 lines: Arabic name, then Latin name, then subtotal. But the durable
`LineSnapshot` (and `cart_lines`) carries a **single** `display_name` — there is
no `name_ar`/`name_en` split anywhere in 005's cart schema. The catalogue that
would supply both names is not yet integrated (005 T053/R7 stub).

### Gap 3 — shift attribution NOT persisted  ⟵ DECISION
§(a) renders a `Shift: Morning — صباحي` line (decisions 6, FR-022/023). The
`sales` table (migration 0020) has **no shift column**, and the finalize
transaction never captured one. 004 has a `shifts` table, but nothing links a
finalized sale to a shift row.

## Recommendation

- **Gap 1:** just do it (additive payload field + T164 mapping). No question.
- **Gap 2 + Gap 3:** these are durable-data gaps the receipt engine cannot
  invent. Recommend **render-what-we-have for v1**: use the single
  `display_name` per line (omit the second name line); omit the shift line
  entirely. Tag both as documented v2 items (bilingual names wait on catalogue
  integration; shift waits on a sales↔shift link). This keeps Slice 2 shippable
  without back-filling 005/004 schemas. The §(a) layout is then v1-rendered as a
  subset — every other field is exact.
- Alternative for Gap 3 only: add a `shift_label` column to sales + capture it
  at finalize from the operator session — but that's a Slice-1-schema reach-back
  (like the display_name move) and may not be worth it for v1.

Decision belongs to Ahmed (it changes what the printed fiscal receipt shows).
