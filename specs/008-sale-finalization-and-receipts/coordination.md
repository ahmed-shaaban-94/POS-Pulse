# Coordination — 008-sale-finalization-and-receipts

**Feature:** 008-sale-finalization-and-receipts
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0 (authored 2026-05-27)
**Tasks:** [./tasks.md](./tasks.md) (DRAFT — all rows BLOCKED; embed activated PR #241)
**Embed preflight:** [../../docs/impeccable-embed-preflight.md](../../docs/impeccable-embed-preflight.md) (v0.4 — ACTIVATING)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-27
**Last updated:** 2026-05-26 (§A1 SIGN-OFF — Ahmed signed `approved` on the visual-direction brief; `shape=pass` recorded; §A1 gate ✅ CLEARED; T010 + T011 complete; (d)/(e)/(f)/(g) approved verbatim; (a)/(b)/(c) printed-slip layouts DEFERRED to follow-up commit before T173 craft fires; all 6 open follow-ups resolved by accepting brief defaults).

**Change log (oldest → newest):**

1. 2026-05-26 — initial creation; closes T001; opens T003 / T004 / T005 / T006 / T007 coordination threads.
2. 2026-05-26 — T002 closure (PR #250 merged): `sale_finalization` feature flag wired end-to-end.
3. 2026-05-26 — gate-coordination assignments: Ahmed accepts §A1 reviewer role; Ahmed assigned §A3 + §A4 reviewer per 006 precedent.
4. 2026-05-26 — T010 shape draft authored (PR #254 merged): renderer-portion sub-items (d) (e) (f) (g) of visual-direction/README.md drafted by `/impeccable shape 008-receipt-surfaces`.
5. 2026-05-26 — §A1 SIGN-OFF (this commit): Ahmed signs `approved` on visual-direction/README.md; `/impeccable shape=pass` recorded; §A1 gate ✅ cleared; T010 + T011 marked complete; (a)/(b)/(c) DEFERRED to a follow-up commit (must land before Slice 2's T173 craft fires).

*Note on artifact dates:* the `/speckit-plan` v1.0 / `/speckit-tasks` / `/speckit-analyze` / CodeRabbit-pass authoring shows "2026-05-27" in the status table below because those artifacts were authored under a future-shifted machine clock during PR #238's session. The actual chronological order of file mutations on this branch is the change-log above; the "2026-05-27" labels are preserved verbatim in the status table to match the artifact frontmatter and PR records.

---

## Purpose

Track project coordination state for 008-sale-finalization-and-receipts during the **pre-implementation** phase. This file is the canonical answer to:

- "Why isn't 008 startable?" (because per-slice approval gates §A1 / §A3 / §A4 have not yet cleared)
- "What needs to happen, and in what order, before each slice may begin?"
- "Who owns each gate?"

This file is **not** a tasks file. It does not authorize implementation. It is the canonical record of "who owns what before 008 work may begin", and it is updated in place as coordination items resolve.

---

## Current phase / status

**Phase: PRE-IMPLEMENTATION — PHASE 1 SETUP.** Spec, plan, data-model, contracts, research, quickstart, tasks all authored (PR #238 merged 2026-05-26). `/speckit-analyze` remediations applied in PR #238. The `/impeccable` embed pattern is activated (PR #241 merged 2026-05-26 — see [../../docs/impeccable-embed-preflight.md](../../docs/impeccable-embed-preflight.md)). Phase 1 (Setup & Coordination) is startable now; this file closes T001.

**Next-up:** Slice 1 (load-bearing) — migrations + persistence + AD-2 finalize listener + `sales.*` bridge — becomes startable once §A3 (migrations) AND §A4 (bridge-API security) sign-off evidence lands. §A1 is now ✅ cleared. **Parallel commitment:** Ahmed authors sub-items (a)/(b)/(c) printed-slip layouts in a follow-up commit before Slice 2's T173 craft fires (Slice 2 commission gate; not a Slice 1 blocker).

| Item | State |
|:--|:--|
| `/speckit-specify` | ✅ 2026-05-26 |
| `/speckit-clarify` (OQ-1 / OQ-2 / OQ-3 + reprint-permission) | ✅ 2026-05-27 |
| `/speckit-plan` v1.0 | ✅ 2026-05-27 (PR #238) |
| `/speckit-tasks` (full task list — 187 tasks across 6 slices) | ✅ 2026-05-27 (PR #238) |
| `/speckit-analyze` (cross-artifact consistency check + U1/G1 remediation) | ✅ 2026-05-27 (PR #238) |
| CodeRabbit review pass (CR1 / CR2 / CR3 / CR4) | ✅ 2026-05-27 (PR #238) |
| Companion artefacts: research.md / data-model.md / quickstart.md / contracts/bridge-api.md / checklists/requirements.md | ✅ 2026-05-27 (PR #238) |
| Embed preflight authored + reviewed (v0.1 → v0.4) | ✅ 2026-05-27 (PR #240) |
| Embed activation: `[IMPECCABLE …]` markers injected into tasks.md; `docs/DESIGN.md` in canonical Stitch format; §A1 row reframed | ✅ 2026-05-27 (PR #241) |
| **T001 — Create this file** | ✅ This document |
| **T002 — Feature flag `sale_finalization` confirmed in `src/shared/app-config.ts`** | ✅ Closed via [PR #250](https://github.com/ahmed-shaaban-94/POS-Pulse/pull/250) — `features.saleFinalization?: boolean` added to `AppConfig`; `FeatureFlagsState.saleFinalization` added with fail-closed default `false`; env-var `POS_PULSE_FEATURE_SALE_FINALIZATION` wired into `getAppConfig()`; renderer-store test coverage extended (4 new tests + 2 expanded). Slice 2's `<ReceiptPreview>` and subsequent renderer surfaces gate on this flag at the hydrate boundary. |
| **T003 — §A3 migration coordination thread opened** | ✅ Opened (see §A3 row + reviewer thread below). Reviewer assigned 2026-05-26: **Ahmed** (matches 006 §A3 pattern). Gate remains ⛔ held until sign-off evidence lands. Target date: [TARGET DATE TBD]. |
| **T004 — §A4 bridge-API security review coordination thread opened** | ✅ Opened (see §A4 row + reviewer thread below). Reviewer assigned 2026-05-26: **Ahmed** (matches 006 §A4-A pattern). Gate remains ⛔ held until sign-off evidence lands. Target date: [TARGET DATE TBD]. |
| **T005 — §A1 Slice 0 visual-direction reviewer assigned** | ✅ Reviewer: Ahmed (assigned 2026-05-26). Review completed 2026-05-26 — see §A1 row in gate ledger (now ✅ cleared) and §"§A1 sign-off (T011)" below. |
| **T006 — §A3 hardware-matrix coordination thread opened** | ✅ Opened (see Hardware Matrix coordination below) — model pair pending |
| **T007 — `/speckit-tasks` completion recorded in gate-status table** | ✅ This document |
| **T010 — Slice 0 visual direction brief authored** | ✅ Closed 2026-05-26 via PR #254 (renderer portion d–g drafted by `/impeccable shape`) + this PR's (a)/(b)/(c) deferred-acceptance recorded by Ahmed. File: [./visual-direction/README.md](./visual-direction/README.md). |
| **T011 — Slice 0 review record signed** | ✅ Closed 2026-05-26 by this PR's §A1 sign-off block below. Reviewer: Ahmed. Result: `approved`. (a)/(b)/(c) deferred to follow-up commit before T173. |
| Slice 0 visual direction | ✅ Cleared — see §A1 row |
| Implementation slices 1–6 | ❌ All held — per-slice gate ownership below |

---

## Gate ledger (mirror of [./tasks.md](./tasks.md) §"Gate ledger" — reviewer ownership added)

| Gate | What it gates | Status | Owner |
|:--:|:--|:--|:--|
| **§A0** | Upstream readiness + `/speckit-plan` v1.0 + `/speckit-analyze`. | ✅ Cleared (PR #238 merged 2026-05-26). Procedural lift was the `/speckit-analyze` merge; §A1–§A5 are the active gates now. | Ahmed |
| **§A1** | Visual direction Slice 0 — every 008 receipt + UI surface variant (printed slip variants + preview UI + reprint affordance + persistent printer-failure banner + persistent drawer-failure banner). Per [../../docs/impeccable-embed-preflight.md §3](../../docs/impeccable-embed-preflight.md), the §A1 reviewer **is** the `/impeccable shape=pass` approver — one event, not two. | ✅ **CLEARED 2026-05-26** — Ahmed signed `approved` on [./visual-direction/README.md](./visual-direction/README.md); `/impeccable shape=pass` recorded same event. (d) (e) (f) (g) approved verbatim. (a) (b) (c) printed-slip layouts DEFERRED to a follow-up commit before Slice 2's T173 craft fires (Slice 2 commission gate; not a Slice 1 blocker). All 6 open follow-ups resolved by accepting brief defaults. See §"§A1 sign-off (T011)" below for full sign-off record. | Ahmed (reviewer). Signed 2026-05-26. |
| **§A2** | Backend / OpenAPI: any backend dependency 008 introduces. **AD-12 locks `§A2 no-op for every 008 slice`** — zero backend calls in 008 v1. | ⛔ Held — no-op confirmation per slice. | Ahmed (POS-Pulse). Documentation-only sign-off. |
| **§A3** | Migrations: five new SQLite tables (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`, `sale_number_sequences`) + append-only triggers + indices + extension of 004's `audit_events.action_category` with 10 new 008 categories. Required before Slice 1 ships. | ⛔ Held — assignment landed; gate remains held until reviewer sign-off evidence lands. Review required before Slice 1 persistence tasks (T020–T031). | **Ahmed** — assigned 2026-05-26 (matches 006 §A3 pattern, T003); review date: [TARGET DATE TBD]. |
| **§A4** | Bridge-API surface review for `sales.*` (4 handlers; read-only) + `receipts.*` (5 handlers; mutating including `receipts.print` main-only). Eight-item checklist in [./contracts/bridge-api.md](./contracts/bridge-api.md). Required before Slice 1 ships. | ⛔ Held — assignment landed; gate remains held until reviewer sign-off evidence lands. Review required before Slice 1 bridge-handler tasks (T100). | **Ahmed** — assigned 2026-05-26 (matches 006 §A4-A pattern, T004); review date: [TARGET DATE TBD]. |
| **§A5** | Production readiness (coverage thresholds ≥ 95% on money-math / sale-number allocator / receipt-payload generator / template engine / print pipeline / drawer-kick logic / audit-event emitter / sync-outbox enqueuer / AD-2 finalize transaction / all `sales.*` + `receipts.*` bridge handlers; ≥ 90% on the four renderer surfaces; redaction audit; T520a perf-budget timing assertion on the §A3 hardware-matrix pair). Blocks rollout, not slice merge. | ⛔ Held — Slice 6 §A5 sign-off task (T528). | Ahmed (matches 006 §A5 pattern). Reviewer assignment finalized at Slice 6 commission. |

---

## §A1 reviewer assignment (T005)

**Reviewer:** Ahmed.

**Role (per [../../docs/impeccable-embed-preflight.md §3](../../docs/impeccable-embed-preflight.md)):** The §A1 reviewer is the `/impeccable shape=pass` approver. There is **one** sign-off event, not two. The reviewer:

1. Reviews the `/impeccable shape 008-receipt-surfaces` output covering sub-items (d) preview UI panel, (e) reprint affordance, (f) printer-failure banner, (g) drawer-failure banner — all renderer surfaces.
2. Authors the printed-slip portion of the visual-direction brief covering sub-items (a) `first_print`, (b) `reprint_duplicate` with bilingual duplicate-copy marker, (c) `preview` content (printed-slip layout is out of `/impeccable`'s register).
3. Signs off the combined `specs/008-sale-finalization-and-receipts/visual-direction/README.md` (T010 output).
4. Records the sign-off in this file under "§A1 sign-off" (T011); §A1 gate is marked ✅ at the same moment `shape=pass` is recorded — no second sign-off.

**Acceptance of role:** [x] Ahmed accepted the §A1 reviewer + `/impeccable shape=pass` approver role on 2026-05-26 (PR #253).

**Target review date:** ~~[TARGET DATE TBD]~~ — **completed 2026-05-26**.

**Sign-off status:** ✅ Signed 2026-05-26. See §"§A1 sign-off (T011)" below for the full record.

---

## §A3 migration reviewer thread (T003)

**Scope under review:**

- Five new SQLite tables per [./data-model.md](./data-model.md):
  1. `sales` (header; append-only; 21 fields; UNIQUE on `envelope_handoff_action_id` + `(terminal_id, sale_number)`; INDEX `(tenant_id, branch_id, terminal_id)` + `(terminal_id, local_calendar_day)`).
  2. `print_events` (append-only; FK → `sales`; supports first-print and reprint and manual-override outcomes).
  3. `drawer_events` (append-only; FK → `sales`; UNIQUE on `sale_id` enforcing FR-053 double-kick suppression at schema layer).
  4. `sale_sync_outbox` (append-only; FK → `sales`; UNIQUE on `sale_id`; AD-11 enqueue-only).
  5. `sale_number_sequences` (mutable; AD-7 allocator; per-terminal per-calendar-day monotonic).
- SQLite triggers denying UPDATE and DELETE on the four append-only tables (stronger than spec FR-004's rule-level).
- Extension of 004's `audit_events.action_category` enum/CHECK with the 10 new 008 categories (`sale.finalized`, `sale.finalization_refused`, `sale.receipt.printed`, `sale.receipt.reprinted`, `sale.receipt.print_failed`, `sale.receipt.print_retried_success`, `sale.receipt.manual_override`, `sale.drawer.opened`, `sale.drawer.suppressed`, `sale.drawer.failed`).
- Migration ordering per [./data-model.md §"Migration sequencing"](./data-model.md).

**Reviewer:** Ahmed — assigned 2026-05-26 (matches 006 §A3 pattern). **Target review date:** [TARGET DATE TBD].

**Gate state:** ⛔ Held — assignment landed; the §A3 gate remains held until the reviewer records sign-off evidence (SHA + date) here.

**Authorization granted by sign-off:** Slice 1 §A3 migration tasks (T020 / T021 / T022 / T023 / T024 / T025 / T026 / T027).

---

## §A4 bridge-API reviewer thread (T004)

**Scope under review:**

- `sales.*` namespace (read-only from renderer):
  - `sales.read` — durable Sale row reads, with main-only field exclusion (`envelope_handoff_action_id`, `payment_attempt_id`, `envelope_cart_id`, `tenant_tax_registration_id` excluded from renderer-visible payload).
  - `sales.findByNumber` — sale-number lookup with tenant/branch/terminal scoping.
  - `sales.subscribe` / `sales.unsubscribe` — live updates for `latest_print_event`, `banner_state`.
- `receipts.*` namespace (mutating):
  - `receipts.preview` — payload-generator-driven HTML/canvas preview.
  - `receipts.print` — **internal, main-process only**; not exposed to renderer.
  - `receipts.reprint` — gated on AD-10 precondition (at least one successful `print_events` row).
  - `receipts.retryPrint` — printer-failure retry with fresh idempotency key.
  - `receipts.manualOverride` — manual-override path; auditable; fresh idempotency key per click.
- Eight-item §A4 checklist in [./contracts/bridge-api.md](./contracts/bridge-api.md) covering: `requireOperatorSession` gating; tenant/branch/terminal isolation; idempotency-key strategy; refusal-envelope shape (closed union of `RefusalReason`); FR-013 / FR-014 Clerk-backed attribution; FR-068 / FR-069 a11y; PII / card-data / voucher-token redaction (FR-071 voucher inheritance from 006; pin_record_id + issuer_name forbidden per CR3); defensive forbidden-field-in-request guard.
- **No renderer-callable `drawer.*` surface** (AD-5; Slice 4 main-process only).

**Reviewer:** Ahmed — assigned 2026-05-26 (matches 006 §A4-A pattern). **Target review date:** [TARGET DATE TBD].

**Gate state:** ⛔ Held — assignment landed; the §A4 gate remains held until the reviewer records sign-off evidence (SHA + date + checklist completion) here.

**Authorization granted by sign-off:** Slice 1 bridge-handler tasks (T100, T101) + all subsequent slices' bridge work (T140–T142 / T170 / T240–T242 / T270–T273 / T280–T281 / T350–T351 / T440–T441 / T510–T511).

---

## §A3 hardware-matrix coordination thread (T006)

**Scope:** Identify ≥ 1 thermal-printer + cash-drawer model pair that will be the §A3 bring-up target for Slice 3 (print pipeline) + Slice 4 (drawer kick). Record vendor + model + driver version expectation in [../../docs/hardware-matrix.md](../../docs/hardware-matrix.md) "pending" column, then promote to "tested" rows once T200 commissions the bring-up.

The hardware-matrix pair is also the target for §A5 task **T520a** — the performance-budget timing assertion (95th-percentile preview ≤ 500 ms / settled-signal-to-drawer-open ≤ 3 s / reprint ≤ 3 s).

**Status:** Pending model selection. Candidate evaluation owned by [NEEDS ASSIGNMENT — owner: ?, target: [TARGET DATE TBD]].

**Hardware constraints from constitution + hardware-matrix:**

- Thermal printer: ESC/POS-compatible; USB or serial transport; OS-print fallback required for unsupported models.
- Cash drawer: ESC/POS DK1/DK2 pulse-compatible; separate kick (not embedded-in-receipt — AD-8 PROHIBITED in 008 v1).
- Driver-version capture in hardware-matrix.md is mandatory per Constitution Hardware section.

---

## Dependencies

### 1. 005-sales-cart

- **Required state:** spec approved AND cart-handoff contract pinned.
- **Why 008 needs it:** The 006 `payment.settled` signal carries `envelope_handoff_action_id`, which is the 005 cart's handoff anchor and AD-2's idempotency key.
- **Status:** ✅ 005 SPEC COMPLETE (PR #181 functional sign-off 2026-05-19). `PaymentIntentEnvelope v1` ratified 2026-05-17. 008 does not consume new 005 contracts beyond what 006 already inherited.

### 2. 006-payments-tender

- **Required state:** `payment.settled` event emission stable and durable.
- **Why 008 needs it:** AD-2 — the 008 AD-2 v3 polling worker listens on 006's `payment.settled` rows in the local SQLite store (NOT an in-process event bus; the AD-2 listener is restart-safe and idempotent). 008 finalize transaction is triggered by `payment.settled` and is keyed on `envelope.handoff_action_id`.
- **Status:** ✅ 006 SPEC COMPLETE (PR #234 §A5 sign-off 2026-05-26). The `payment.settled` row + audit shape is locked. Recovery scan re-fires AD-2 for orphaned `payment.settled` rows with no matching `sales` row at startup (per research §R-15).

### 3. 004-operator-session

- **Required state:** operator identity + session model stable.
- **Why 008 needs it:** Every `sales.*` + `receipts.*` bridge handler gates on `requireOperatorSession`. `sales.cashier_display_name` + `sales.cashier_clerk_user_id` come from the active session. FR-013 / FR-014 Clerk-backed attribution.
- **Status:** ✅ 004 S5 closed 2026-05-14 (PRs #133–#143). No 004-side changes required for 008.

### 4. 007-pos-visual-system

- **Required state:** visual system recovery complete and `docs/DESIGN.md` in canonical form.
- **Why 008 needs it:** All five 008 renderer surfaces (`<ReceiptPreview>` / `<PrinterFailureBanner>` / `<DrawerFailureBanner>` / `<ReprintAffordance>` / manual-override) extend 007's banner-host pattern and consume 007's token layer (003 base + 007 recovery).
- **Status:** ✅ 007 closed 2026-05-10 (all six slices S0–S6 merged). `docs/DESIGN.md` (renamed from `docs/design-system.md` in PR #241) is the canonical reference for the `/impeccable` skill.

---

## Embed activation record

The `/impeccable` embed pattern is **activated** in this feature per PR #241 (2026-05-26).

**Marker contract:** six `[IMPECCABLE shape|craft]` markers in [./tasks.md](./tasks.md), all within the preflight §1 in-scope list:

| T-number | Marker | Component / surface | Red-bar tests |
|:--:|:--|:--|:--|
| T010 | `[§A1] [IMPECCABLE shape]` | Slice 0 visual direction (renderer portion) | n/a |
| T173 | `[US1] [IMPECCABLE craft]` | `<ReceiptPreview>` | T150 / T151 / T152 |
| T290 | `[US1] [IMPECCABLE craft]` | `<PrinterFailureBanner>` | T260 / T261 / T262 / T263 |
| T360 | `[US1] [IMPECCABLE craft]` | `<DrawerFailureBanner>` | T330 / T331 / T332 |
| T450 | `[US1] [IMPECCABLE craft]` | `<ReprintAffordance>` | T430 / T431 |
| T512 | `[US1] [IMPECCABLE craft]` | manual receipt override on `<PrinterFailureBanner>` | T501–T504 |

**Pre-craft red-bar check (preflight §4.2):** mandatory before invoking any `[IMPECCABLE craft]` marker. Embedder runs `npm test -- --run <test-file-pattern>` against the red-bar set and records RED confirmation in this file under the corresponding T-number before craft fires.

**Out of scope for `/impeccable` (preflight §8):** receipt copy text (FR-017 canonical fields), ESC/POS byte layout (AD-6 template engine; outside any register), drawer-kick timing/retry (main-process AD-8), bridge-API method names or payload shapes (locked in [./contracts/bridge-api.md](./contracts/bridge-api.md) and reviewed under §A4), audit-event category enums (extended by T026), sync-outbox row shape / polling worker (AD-2 v3 main-process), and `docs/runbook/008-sale-finalization-and-receipts.md` (T524; operational).

**Post-craft constitution checklist (preflight §7):** the embedder runs the eight-item checklist (money path / no `_reference/Data-Pulse/` copy / RTL / 44×44 / no optimistic UI past durable commit / no PII in logs / preload-bridge only / reduced-motion / axe-core) against produced code before marking any craft task complete. Failures = fixup commit before move-on.

---

## §A1 sign-off (T011 — ✅ signed 2026-05-26)

> ## §A1 sign-off
>
> **Date:** 2026-05-26
> **Reviewer:** Ahmed
> **Result:** `approved` (with (a)/(b)/(c) deferred-authoring deviation noted in Notes below)
> **`visual-direction/README.md` sign-off SHA:** binding to the merge commit of this PR on `main` (will be filled in by the merge-commit SHA once this PR merges).
> **`/impeccable shape=pass` recorded:** 2026-05-26 — same event as the §A1 sign-off per preflight §3 (one event, not two).
> **Sub-items covered (T010 (a–g)):**
> - [x] (a) `first_print` printed slip — DEFERRED to follow-up commit before T173 craft fires (Slice 2 commission gate).
> - [x] (b) `reprint_duplicate` with bilingual duplicate-copy marker — DEFERRED alongside (a) (R2 fraud-mitigation marker remains load-bearing).
> - [x] (c) `preview` content — DEFERRED alongside (a) (byte-stable mirror of a per AD-6).
> - [x] (d) `<ReceiptPreview>` UI panel — APPROVED verbatim.
> - [x] (e) `<ReprintAffordance>` — APPROVED verbatim.
> - [x] (f) `<PrinterFailureBanner>` — APPROVED verbatim.
> - [x] (g) `<DrawerFailureBanner>` — APPROVED verbatim.
> **Notes:**
> - (a)/(b)/(c) printed-slip layouts DEFERRED to a follow-up commit. Ahmed commits to authoring them before T173 craft fires (Slice 2). Slice 1 is unblocked by this sign-off because Slice 1 introduces no printed-slip-consuming code; only Slice 2 (template engine + preview) depends on (a)/(b)/(c) landing.
> - All 6 open follow-ups in the brief resolved on 2026-05-26 by accepting brief defaults:
>   1. Iconography: `lucide-react` primitive composites (`Printer`+`AlertTriangle` for printer-failure banner; `DoorOpen`+`AlertTriangle` for drawer-failure banner). Composites land in `src/renderer/ui/icons/` at T173 / T290 / T360 craft.
>   2. `<ReceiptPreview>` 2× zoom: IN v1 scope. T173 craft must include the 2× DPI canvas-render toggle.
>   3. Printer-failure banner Manual-receipt affordance surface: **inline** (not modal). T512 craft renders inline within the cart workspace per DESIGN.md Don't #11.
>   4. Drawer-failure banner `last_successful_open_at` format: **relative timestamp** ("3 minutes ago" / "yesterday"). T360 craft surfaces relative form; absolute form is preserved in the audit row but never shown on the banner.
>   5. (Iconography choice above already covers both the printer and drawer composite specs.)
>   6. (No item 6 in the brief — the brief listed 6 follow-ups; items 4, 5, 6 in the brief's numbering map to items 2, 3, 4 here. All resolved.)
> - This sign-off IS the `/impeccable shape=pass` event per preflight §3.

---

## Open coordination follow-ups

- [x] **Ahmed explicit acceptance** of the §A1 reviewer + `/impeccable shape=pass` approver role per preflight §3. *(Accepted 2026-05-26 via this commit; the activation-PR §9 acceptance box is now satisfied.)*
- [x] **§A3 reviewer assignment** — Ahmed (matches 006 §A3 pattern). Target date still pending: [TARGET DATE TBD] (T003).
- [x] **§A4 reviewer assignment** — Ahmed (matches 006 §A4-A pattern). Target date still pending: [TARGET DATE TBD] (T004).
- [x] **§A1 target review date** — completed 2026-05-26 (review concluded, sign-off recorded above).
- [ ] **§A3 target review date** — Ahmed to commit a date before Slice 1 begins.
- [ ] **§A4 target review date** — Ahmed to commit a date before Slice 1 begins.
- [ ] **§A3 hardware-matrix pair selection** + target date (T006).
- [x] **T002 feature-flag confirmation** — closed via [PR #250](https://github.com/ahmed-shaaban-94/POS-Pulse/pull/250) (merged 2026-05-26). Four files touched: `src/shared/app-config.ts` (+13), `src/renderer/stores/feature-flags-store.ts` (+6/-1), `src/main/index.ts` (+11/-1), `tests/unit/renderer/stores/feature-flags-store.test.ts` (+32/-2). Local + CI gates green. The pre-existing 006 `payments` env-var-read gap in `src/main/index.ts` is flagged in PR #250's body for a separate follow-up (it's a 006 concern, not 008).
- [x] **T010 commission** — closed 2026-05-26. PR #254 (merged) landed the renderer-portion shape draft for (d)/(e)/(f)/(g) authored by `/impeccable shape`. (a)/(b)/(c) printed-slip portion accepted-with-deferred-authoring in the §A1 sign-off above.
- [x] **T011 §A1 sign-off** — closed 2026-05-26 by this PR (§"§A1 sign-off (T011)" block above filled in).
- [ ] **(a)/(b)/(c) printed-slip layouts — DEFERRED COMMITMENT** — Ahmed to author the `first_print` printed slip + `reprint_duplicate` printed slip with bilingual duplicate-copy marker + `preview` content confirmation in a follow-up commit to [./visual-direction/README.md](./visual-direction/README.md). MUST land BEFORE Slice 2's T173 craft fires. Tracked as a Slice 2 commission gate, not a Slice 1 blocker.
