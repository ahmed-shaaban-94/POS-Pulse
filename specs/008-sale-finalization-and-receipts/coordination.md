# Coordination — 008-sale-finalization-and-receipts

**Feature:** 008-sale-finalization-and-receipts
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0 (authored 2026-05-27)
**Tasks:** [./tasks.md](./tasks.md) (DRAFT — all rows BLOCKED; embed activated PR #241)
**Embed preflight:** [../../docs/impeccable-embed-preflight.md](../../docs/impeccable-embed-preflight.md) (v0.4 — ACTIVATING)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-27
**Last updated:** 2026-05-28 (four passes: (1) S1c.3 closeout gap discovery: 4-field upstream gap recorded; Ahmed Q1+Q2 business decisions captured; Egyptian VAT §A5 production-readiness flag added; T094a/b/c task entries authored; T111/T112/T113 marked BLOCKED-BY T094c. (2) Backend-coordination blocker on T094a recorded post-PR #267 merge: Q2's chosen path requires a backend OpenAPI change to `smartdatapulse.tech` that POS-Pulse cannot make alone; Ahmed owns the backend PR; T094a-T094c + T111-T113 all transitively BLOCKED-BY backend snapshot refresh. (3) Slice 2 prep audit recorded post-PR #268 merge: line-snapshot persistence finding + Ahmed's Option A decision (lines_json column on sales row); adds T028a migration task; updates T091 + T094b. (4) Second-pass Slice 2 environmental audit recorded same-PR: Tahoma Arabic-font assumption flagged for §A5 hardware-pair smoke; `src/shared/formatters/` absence flagged as Slice 2 T160 precursor. See §"Second-pass environmental audit" below).

**Change log (oldest → newest):**

1. 2026-05-26 — initial creation; closes T001; opens T003 / T004 / T005 / T006 / T007 coordination threads.
2. 2026-05-26 — T002 closure (PR #250 merged): `sale_finalization` feature flag wired end-to-end.
3. 2026-05-26 — gate-coordination assignments: Ahmed accepts §A1 reviewer role; Ahmed assigned §A3 + §A4 reviewer per 006 precedent.
4. 2026-05-26 — T010 shape draft authored (PR #254 merged): renderer-portion sub-items (d) (e) (f) (g) of visual-direction/README.md drafted by `/impeccable shape 008-receipt-surfaces`.
5. 2026-05-26 — §A1 SIGN-OFF (PR #255 merged): Ahmed signs `approved` on visual-direction/README.md; `/impeccable shape=pass` recorded; §A1 gate ✅ cleared; T010 + T011 marked complete; (a)/(b)/(c) DEFERRED to follow-up commit (which then landed in PR #259 — see entry 9 below).
6. 2026-05-26 — §A3 SIGN-OFF (PR #256 authored 2026-05-26, merged 2026-05-27): Ahmed signs migration review `approved`; ten-item scope checklist verified; Slice 1 §A3 migration tasks T020–T027 authorized.
7. 2026-05-26 — §A4 SIGN-OFF (PR #257 authored 2026-05-26, merged 2026-05-27): Ahmed signs bridge-API security review `approved`; eight-item §A4 security checklist verified; Slice 1 bridge handlers T100/T101 + all later slices' bridge work authorized.
8. 2026-05-26 — T006 hardware-matrix pair committed (PR #258 authored 2026-05-26, merged 2026-05-27): Epson TM-T20III + APG VBS320 pair landed in docs/hardware-matrix.md pending rows; Slice 3 (T200/T201/T202) + Slice 4 (T310–T352) targets locked.
9. 2026-05-26 — Printed-slip (a)/(b)/(c) proxy-authored (PR #259 authored 2026-05-26, merged 2026-05-27): full 42-column 80 mm ESC/POS layout + duplicate-copy marker composition + preview-equals-print byte-stability commitment. The §A1 deferred-authoring deviation is now resolved; Slice 2 T173 craft unblocked from the printed-slip side.
10. 2026-05-27 — post-parallel-sign-off cleanup (this commit): change log rolled up; tasks.md §A3 + §A4 gate-ledger rows flipped from ⛔ Held to ✅ Cleared; top-of-tasks.md Status line refreshed to reflect Slice 1 startable.

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
| **T003 — §A3 migration coordination thread opened** | ✅ Opened + **CLOSED 2026-05-26**: Ahmed signed §A3 migration review `approved`. See §"§A3 migration reviewer thread (T003)" below for full sign-off record. Slice 1 §A3 migration tasks (T020–T027) now authorized. |
| **T004 — §A4 bridge-API security review coordination thread opened** | ✅ Opened + **CLOSED 2026-05-26**: Ahmed signed §A4 bridge-API review `approved`. Eight-item §A4 security checklist walked. See §"§A4 bridge-API reviewer thread (T004)" below for full sign-off record + checklist verification. Slice 1 bridge-handler tasks (T100, T101) + all subsequent slices' bridge work now authorized. |
| **T005 — §A1 Slice 0 visual-direction reviewer assigned** | ✅ Reviewer: Ahmed (assigned 2026-05-26). Review completed 2026-05-26 — see §A1 row in gate ledger (now ✅ cleared) and §"§A1 sign-off (T011)" below. |
| **T006 — §A3 hardware-matrix coordination thread opened** | ✅ Opened + **CLOSED 2026-05-26**: Ahmed committed a Slice 3 / Slice 4 bring-up hardware pair. See §"§A3 hardware-matrix coordination thread (T006)" below + [../../docs/hardware-matrix.md](../../docs/hardware-matrix.md) pending row. Pair: Epson TM-T20III thermal printer (ESC/POS direct path) + APG VBS320 cash drawer (DK1 pulse via printer). |
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
| **§A3** | Migrations: five new SQLite tables (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`, `sale_number_sequences`) + append-only triggers + indices + extension of 004's `audit_events.action_category` with 10 new 008 categories. Required before Slice 1 ships. | ✅ **CLEARED 2026-05-26** — Ahmed signed `approved`. Slice 1 §A3 migration tasks (T020–T027) authorized. See §"§A3 migration reviewer thread (T003)" below for the full sign-off record. | Ahmed (reviewer). Signed 2026-05-26. |
| **§A4** | Bridge-API surface review for `sales.*` (4 handlers; read-only) + `receipts.*` (5 handlers; mutating including `receipts.print` main-only). Eight-item checklist in [./contracts/bridge-api.md](./contracts/bridge-api.md). Required before Slice 1 ships. | ✅ **CLEARED 2026-05-26** — Ahmed signed `approved`. Eight-item security checklist verified. Slice 1 bridge-handler tasks (T100, T101) + all subsequent slices' bridge work authorized. See §"§A4 bridge-API reviewer thread (T004)" below. | Ahmed (reviewer). Signed 2026-05-26. |
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

**Reviewer:** Ahmed — assigned 2026-05-26 (matches 006 §A3 pattern). **Target review date:** ~~[TARGET DATE TBD]~~ — **review completed 2026-05-26**.

**Gate state:** ✅ **CLEARED 2026-05-26.**

> ## §A3 sign-off
>
> **Date:** 2026-05-26
> **Reviewer:** Ahmed
> **Result:** `approved`
> **Sign-off SHA:** binding to the merge commit of this PR on `main` (filled at merge time).
> **Scope reviewed:**
> - [x] Five SQLite tables (`sales`, `print_events`, `drawer_events`, `sale_sync_outbox`, `sale_number_sequences`) — schema shapes per [./data-model.md](./data-model.md), all constraints + indices + UNIQUEs verified.
> - [x] Append-only triggers denying UPDATE and DELETE on the four append-only tables (stronger than spec FR-004's rule-level enforcement). Schema-layer guarantee accepted.
> - [x] `audit_events.action_category` enum/CHECK extension with the 10 new 008 categories (`sale.finalized`, `sale.finalization_refused`, `sale.receipt.printed`, `sale.receipt.reprinted`, `sale.receipt.print_failed`, `sale.receipt.print_retried_success`, `sale.receipt.manual_override`, `sale.drawer.opened`, `sale.drawer.suppressed`, `sale.drawer.failed`).
> - [x] Migration ordering per [./data-model.md §"Migration sequencing"](./data-model.md). 008 migrations append after 006 — no reordering of existing migrations.
> - [x] FK constraints: `print_events → sales`, `drawer_events → sales`, `sale_sync_outbox → sales` all verified.
> - [x] UNIQUE constraints: `sales(envelope_handoff_action_id)`, `sales(terminal_id, sale_number)`, `drawer_events(sale_id)` (FR-053 double-kick suppression at schema layer), `sale_sync_outbox(sale_id)`.
> - [x] Index strategy: `sales(tenant_id, branch_id, terminal_id)` and `sales(terminal_id, local_calendar_day)` — both verified appropriate for the AD-7 allocator's query pattern + the `sales.findByNumber` lookup pattern.
> - [x] AD-2 v3 idempotency anchor: `sales.envelope_handoff_action_id` UNIQUE constraint is the load-bearing idempotency key for finalize-transaction replay. Verified.
> - [x] AD-7 allocator integrity: `sale_number_sequences` is the single mutable table; per-terminal per-calendar-day monotonic counter is the only writable column. Verified.
> - [x] AD-11 outbox semantics: `sale_sync_outbox` is enqueue-only (append-only) from main; the sync worker reads + deletes rows it has shipped, NOT mutates them. Verified.
>
> **Notes:**
> - Review surface: this sign-off binds against [./data-model.md](./data-model.md) as authored at PR #238. Any post-sign-off change to the data model requires a fresh §A3 review cycle.
> - The sign-off does NOT pre-authorize specific migration filenames or ordinals (those are assigned at T020 task execution); it authorizes the schema shape and constraint set.
> - Slice 1 implementation may proceed with migration tasks T020–T027 once §A4 also clears (separate gate).

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

**Reviewer:** Ahmed — assigned 2026-05-26 (matches 006 §A4-A pattern). **Target review date:** ~~[TARGET DATE TBD]~~ — **review completed 2026-05-26**.

**Gate state:** ✅ **CLEARED 2026-05-26.**

> ## §A4 sign-off
>
> **Date:** 2026-05-26
> **Reviewer:** Ahmed
> **Result:** `approved`
> **Sign-off SHA:** binding to the merge commit of this PR on `main` (filled at merge time).
> **Eight-item §A4 security-review checklist** (per [./contracts/bridge-api.md §"§A4 security-review checklist"](./contracts/bridge-api.md), walked in order):
> - [x] **1. Bridge surface enumeration.** Confirmed the four `receipts.*` handlers (`receipts.preview`, `receipts.reprint`, `receipts.retryPrint`, `receipts.manualOverride`) + four `sales.*` handlers (`sales.read`, `sales.findByNumber`, `sales.subscribe`, `sales.unsubscribe`) are the entire 008 renderer-facing bridge surface. `receipts.print` is internal main-process-only; no `drawer.*` renderer-callable surface (AD-5).
> - [x] **2. Forbidden-field defensive guard.** Confirmed each bridge handler's main-side entry guard rejects any forbidden key in the request payload (`envelope_handoff_action_id`, `payment_attempt_id`, `envelope_cart_id`, `tenant_tax_registration_id`, plus 006 CR3 forbidden `pin_record_id` and `issuer_name`). Guard is the load-bearing defense against client-side payload tampering.
> - [x] **3. Refusal-envelope shape.** Confirmed every refused response uses `{ kind: 'refused', reason: <closed enum> }`. The `RefusalReason` union is closed — no free-form strings. Refusal reasons are enumerated and stable across versions per the contract.
> - [x] **4. Idempotency contract.** Confirmed `idempotency_key` is accepted by every mutating handler (`receipts.reprint`, `receipts.retryPrint`, `receipts.manualOverride`). Pattern mirrors 005 / 006 — `receipts.print` (main-only) uses the AD-2 envelope-handoff-action-id as its idempotency anchor.
> - [x] **5. Operator-attribution discipline.** Confirmed `receipts.reprint` uses the currently signed-in operator's identity (the *reprinting* operator), NOT the selling operator's id from the `Sale` row (per FR-024 / FR-031). Verified at the handler level + at the audit-event emission point.
> - [x] **6. Tenant isolation.** Confirmed every handler scopes by `tenant_id` + `branch_id` + `terminal_id` from the operator session (requireOperatorSession-supplied). `sales.findByNumber` refuses cross-tenant misses with `sale_not_found` (not `tenant_isolation`) to prevent information leak via differential error codes.
> - [x] **7. Redaction surface.** Confirmed `external_reference` (FR-071 voucher-token-inheritance from 006) is `*****`-redacted in every log sink the bridge writes to (pino, Sentry, support bundle), regardless of which handler processed it. Redaction is centralised at the log-emitter level, not duplicated per handler.
> - [x] **8. No raw envelope leak.** Confirmed no bridge response includes the `envelope_handoff_action_id` — it remains main-side only as the audit / idempotency anchor. Verified via the `sales.*` response shape (main-only fields explicitly excluded from renderer-visible payload).
>
> **Additional verification beyond the 8-item checklist:**
> - **`requireOperatorSession` gating.** Confirmed every mutating handler (`receipts.preview`, `receipts.reprint`, `receipts.retryPrint`, `receipts.manualOverride`) starts with `const session = requireOperatorSession(...)`. Non-mutating reads (`sales.read`, `sales.findByNumber`, `sales.subscribe`) also gate on session presence per FR-013 / FR-014 — a terminal with no signed-in operator MUST refuse the read.
> - **FR-068 / FR-069 a11y exposure.** No a11y violations in the contract surface (bridge is data layer; renderer enforces 44×44 + keyboard contracts).
> - **`receipts.print` confinement.** Verified `receipts.print` is NOT in the preload bridge's `window.api.*` surface. AD-2 listener calls it directly via main-process import only.
>
> **Notes:**
> - Review surface binds against [./contracts/bridge-api.md](./contracts/bridge-api.md) as authored at PR #238. Any post-sign-off change to the contract requires a fresh §A4 review cycle.
> - The sign-off authorizes contract-shape implementation. Specific handler files (per Slice 1's T100 / T101 task assignments) MUST match the contract verbatim; deviation requires either a contract amendment + re-sign or a refusal of the implementation PR.

**Authorization granted by sign-off:** Slice 1 bridge-handler tasks (T100, T101) + all subsequent slices' bridge work (T140–T142 / T170 / T240–T242 / T270–T273 / T280–T281 / T350–T351 / T440–T441 / T510–T511).

---

## §A3 hardware-matrix coordination thread (T006)

**Scope:** Identify ≥ 1 thermal-printer + cash-drawer model pair that will be the §A3 bring-up target for Slice 3 (print pipeline) + Slice 4 (drawer kick). Record vendor + model + driver version expectation in [../../docs/hardware-matrix.md](../../docs/hardware-matrix.md) "pending" column, then promote to "tested" rows once T200 commissions the bring-up.

The hardware-matrix pair is also the target for §A5 task **T520a** — the performance-budget timing assertion (95th-percentile preview ≤ 500 ms / settled-signal-to-drawer-open ≤ 3 s / reprint ≤ 3 s).

**Status:** ✅ **CLOSED 2026-05-26.** Ahmed committed the Slice 3 / Slice 4 bring-up hardware pair:

| Category | Vendor | Model | Transport | Driver / firmware | ESC/POS support |
|:--|:--|:--|:--|:--|:--|
| Thermal printer | Epson | TM-T20III | USB (serial fallback available) | Epson Advanced Printer Driver (APD) v5.13+; ESC/POS direct command set | ✅ Direct ESC/POS path preferred; OS-print fallback supported for diagnostic / failover |
| Cash drawer | APG | VBS320 (Vasario) | RJ-12 to printer (DK1 pulse) | Driven via Epson TM-T20III's DK1 ESC/POS command; no native USB driver required | ✅ Separate ESC/POS DK1 command per AD-8 (NOT embedded-in-receipt) |

**Rationale for this pair:**
- **Epson TM-T20III** is the most widely deployed thermal printer in MEA pharmacy retail; broad APD coverage on Windows 10/11; ESC/POS direct path is well-documented; OS-print fallback works on the same physical device.
- **APG VBS320** is a workhorse cash drawer with a standard RJ-12 pulse interface; pairs natively with TM-T20III via the printer's DRAWER port; no separate driver required (drawer-kick is a printer ESC/POS command, not a peripheral driver call).
- **The pair satisfies AD-8's separate-command requirement** (drawer kick is a distinct ESC/POS DK1 command after the receipt cut, not an embedded-in-receipt sequence).
- **The pair satisfies T520a perf-budget assertions** — these models meet the spec's 95th-percentile preview ≤ 500 ms / settled-signal-to-drawer-open ≤ 3 s / reprint ≤ 3 s targets under bench testing in 006 prep work.
- **The pair will be promoted from `hardware-matrix.md`'s "pending" row to "tested" row at T200** (Slice 3 hardware bring-up commission task) once the physical bring-up confirms the spec timings hold.

Vendor + model + driver-version capture has been recorded in [../../docs/hardware-matrix.md](../../docs/hardware-matrix.md) as pending rows under Receipt printer and Cash drawer categories. Per Constitution Hardware section, driver-version capture is mandatory and is included.

**Authorization granted by sign-off:** Slice 3 hardware bring-up tasks (T200 / T201 / T202) + Slice 4 drawer-kick wire-up tasks (T310–T352) may target this specific pair. T520a perf-budget timing assertion will be run on this pair at Slice 6.

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
- [x] **§A3 target review date** — completed 2026-05-26 (review concluded, sign-off recorded in §"§A3 migration reviewer thread (T003)" above).
- [x] **§A4 target review date** — completed 2026-05-26 (review concluded, sign-off + 8-item checklist recorded in §"§A4 bridge-API reviewer thread (T004)" above).
- [x] **§A3 hardware-matrix pair selection** — closed 2026-05-26 (T006): **Epson TM-T20III** thermal printer + **APG VBS320** cash drawer pair committed. Recorded in [docs/hardware-matrix.md](../../docs/hardware-matrix.md) (pending rows) and §"§A3 hardware-matrix coordination thread (T006)" above. Promotion to "tested" rows happens at T200 physical bring-up.
- [x] **T002 feature-flag confirmation** — closed via [PR #250](https://github.com/ahmed-shaaban-94/POS-Pulse/pull/250) (merged 2026-05-26). Four files touched: `src/shared/app-config.ts` (+13), `src/renderer/stores/feature-flags-store.ts` (+6/-1), `src/main/index.ts` (+11/-1), `tests/unit/renderer/stores/feature-flags-store.test.ts` (+32/-2). Local + CI gates green. The pre-existing 006 `payments` env-var-read gap in `src/main/index.ts` is flagged in PR #250's body for a separate follow-up (it's a 006 concern, not 008).
- [x] **T010 commission** — closed 2026-05-26. PR #254 (merged) landed the renderer-portion shape draft for (d)/(e)/(f)/(g) authored by `/impeccable shape`. (a)/(b)/(c) printed-slip portion accepted-with-deferred-authoring in the §A1 sign-off above.
- [x] **T011 §A1 sign-off** — closed 2026-05-26 by this PR (§"§A1 sign-off (T011)" block above filled in).
- [ ] **(a)/(b)/(c) printed-slip layouts — DEFERRED COMMITMENT** — Ahmed to author the `first_print` printed slip + `reprint_duplicate` printed slip with bilingual duplicate-copy marker + `preview` content confirmation in a follow-up commit to [./visual-direction/README.md](./visual-direction/README.md). MUST land BEFORE Slice 2's T173 craft fires. Tracked as a Slice 2 commission gate, not a Slice 1 blocker.

---

## 2026-05-28 — Slice 1 closeout gap discovery (`FinalizeInput` upstream)

> **Status:** **OPEN — blocks T111/T112/T113 manual smokes and any real-process finalize.** Surfaces TWO business decisions that must be made before any wire-up code lands.
>
> **Discovered by:** Claude session on 2026-05-28 while preparing the AD-2 worker + `sales.*` bridge bootstrap into `src/main/index.ts` (the wire-up was scoped as the natural follow-up to PR #266's merge).
>
> **Not a regression.** PR #266 ships 191/191 GREEN tests and is correctly merged. The gap was concealed by the fact that every test hand-constructs `FinalizeInput`, so no test exercises the upstream production code path that would have to produce one.

### Finding

`bindFinalizeTransaction.finalize(input: FinalizeInput)` requires **18 fields**. The natural caller — the AD-2 polling worker's `dispatch(handoff_action_id)` closure — must produce a `FinalizeInput` from the audit row + joined production state. Investigation of each field's source:

| `FinalizeInput` field | Source in current codebase | Verdict |
|:--|:--|:--|
| `envelope_handoff_action_id` | 006 `payment.settled` payload | ✅ |
| `payment_attempt_id` | 006 `payment.settled` payload | ✅ |
| `envelope_cart_id` | 006 `payment.settled` payload (renamed `cart_id`) | ✅ |
| `tenant_id`, `branch_id`, `terminal_id` | 006 `payment.settled` payload (`originating_terminal_id`) | ✅ |
| `selling_operator_id`, `selling_operator_session_id` | 006 `payment.settled` payload (`attribution_operator_id`, `session_id`) | ✅ |
| `settled_at` | 006 `payment.settled` payload | ✅ |
| `terminal_label` | `src/main/pairing/store.ts` — `readPairingTerminalAssignment()` | ✅ accessor exists |
| `selling_operator_display_name` | `src/main/operator/backend-client.ts` `display_name` field | ⚠️ reader needs to be assembled (per-session cache or per-operator lookup) |
| `subtotal_minor` | `PaymentIntentEnvelope.subtotal_minor` (cart envelope JSON) | ⚠️ reader from `payment_attempts.envelope_json` |
| `tender_lines_summary` | `payment_tender_lines` rows joined by `payment_attempt_id` | ✅ accessor exists |
| `total_change_due_minor` | Derived: sum of `change_due_minor` over applied cash lines | ✅ pure compute |
| `local_calendar_day` | Derived: `settled_at` → terminal-local TZ → `YYYY-MM-DD` | ✅ pure compute |
| **`total_tax_minor`** | **NOT computed or persisted anywhere in 005/006** | ❌ **GAP** |
| **`tenant_tax_registration_id`** | **No source — no pairing/branch/tenant accessor exists** | ❌ **GAP** |
| **`branch_name`** | **No source — `terminal_assignment` row has terminal_label only** | ❌ **GAP** |
| **`branch_address`** | **No source — `terminal_assignment` row has terminal_label only** | ❌ **GAP** |

### Schema severity

`migrations/0020_create_sales.sql` declares all 18 columns `NOT NULL`. The four gap columns (`total_tax_minor`, `tenant_tax_registration_id`, `branch_name`, `branch_address`) cannot be inserted as NULL without a schema migration. Until either (a) upstream sources land or (b) the schema is relaxed, **no real-process finalize can succeed** end-to-end on this codebase. The 191 GREEN tests in PR #266 pass because they hand-construct `FinalizeInput` with literal values like `branch_name: 'Maadi'`.

### Evidence chain

1. **006 `payment.settled` payload shape:** `src/main/payments/handlers/payments-confirm.ts:257-268` calls `auditEmitter.emitPaymentSettled` with 9 fields + `tender_lines[]`. No tax, no branch detail, no tax-registration id.
2. **Cart envelope shape:** `src/shared/cart/handoff-envelope.ts` defines `PaymentIntentEnvelope` with `subtotal_minor` only. No `total_tax_minor`.
3. **Pairing record shape:** `src/main/pairing/store.ts:47` defines the `terminal_assignment` row as `(id, tenant_id, branch_id, terminal_id, terminal_label, paired_at)`. No branch name/address, no tenant tax-registration id.
4. **Hand-constructed test data:** `tests/integration/sales/finalize-transaction.rollback.test.ts:112-113` literally writes `branch_name: 'Maadi'`, `branch_address: '12 Road 9'` — confirming no production code path computes them.

### Business decisions (resolved 2026-05-28 by Ahmed)

Two product-scope decisions that 008's plan implicitly assumed away. Both answered by Ahmed in the same session as the gap discovery, immediately before T094 authoring:

1. **Q1 — Tax model: where does `total_tax_minor` come from?**
   **DECIDED → Zero for v1 (no VAT).** `total_tax_minor` is hardcoded to `0` in the dispatch-projection module. Egyptian VAT computation is deferred to a future feature. The projection module carries an explicit `// TODO(008-v2): Egyptian VAT compliance — see coordination.md §"Slice 1 closeout gap discovery"` comment at the hardcoded site.

2. **Q2 — Branch detail + tax-registration id: where do they live?**
   **DECIDED → Extend 002 pairing handshake.** The 002 pairing-handshake response is extended to return `branch_name`, `branch_address`, `tenant_tax_registration_id`. The `terminal_assignment` schema gains three new columns; the pairing store persists them at pair-completion. 008's bootstrap reads from `readPairingTerminalAssignment()`. Cross-feature work (touches 002's tree) is attributed to 008 per Ahmed's instruction 2026-05-28.

### Egyptian VAT compliance flag (§A5 production-readiness)

> **MUST resolve BEFORE §A5 sign-off — added 2026-05-28 as a direct consequence of Q1's "zero-for-v1" answer.**

Q1's answer ships receipts that legally **do not comply** with Egyptian Tax Authority e-invoicing rules (mandatory tax-line + tax-registration-number on every fiscal receipt). This is acceptable for development + internal testing but BLOCKS any production customer-facing use. The 008 §A5 production-readiness gate MUST require:

- [ ] Re-open Q1 (tax model) before §A5 sign-off and pick one of the non-zero options (cart-computes or 008-computes).
- [ ] Add a regression test confirming `total_tax_minor > 0` on a non-VAT-exempt sale before merging to a production-tagged release.
- [ ] Confirm receipt template (Slice 2 AD-6) renders a tax line + tenant tax-registration number once the non-zero tax model lands.

This flag is recorded here so it cannot be forgotten when Slice 6 (production-readiness gate) lands. Slice 2's receipt template will already display `tenant_tax_registration_id` from the 002-handshake extension (T094a) — only the tax-line value remains to be computed in a future feature.

### Chosen resolution path

**Path B (revised — three new tasks).** Both answers above collapse the original three-path matrix to a single concrete plan. Three new task entries between T093 and T100 in tasks.md:

| Task | Description | Cost estimate |
|:--|:--|:--|
| **T094a** | Extend 002 pairing-handshake response + `terminal_assignment` schema with `branch_name`, `branch_address`, `tenant_tax_registration_id`. Touches `src/main/pairing/store.ts`, `src/main/pairing/network.ts`, `src/main/pairing/service.ts`, plus a new `migrations/00XX_extend_terminal_assignment.sql`. Attributed to 008 (PR title prefix `feat(008): …`) per Ahmed 2026-05-28. | ~150-250 LoC + RED-GREEN tests |
| **T094b** | 008 dispatch-projection module at `src/main/sales/finalize-dispatch.ts`. Reads `audit_events` row by `handoff_action_id`, joins `payment_attempts` + `payment_tender_lines` + `terminal_assignment` (post-T094a) + operator-display-name reader; projects to `FinalizeInput`. `total_tax_minor` hardcoded to `0` with the v2 TODO comment per Q1. | ~250-350 LoC + RED-GREEN tests |
| **T094c** | Main-process bootstrap at `src/main/index.ts`. Wires `createFinalizeListener` + `createSalesBridge` behind `featureFlags.sale_finalization`. `dispatch` closure calls T094b's projection module + `bindFinalizeTransaction.finalize()`. Recovery dispatchers stubbed as `logger.warn` (real impls land S3/S4). Calls `runStartupRecovery()` then `start()`. `stop()` is called from the `app.quit` handler. | ~60-100 LoC + smoke verification |

Sequencing: T094a → T094b → T094c. Each lands as its own PR. T111/T112/T113 are explicitly blocked-by-T094c.

### Backend-coordination blocker on T094a (discovered 2026-05-28, post-PR #267 merge)

> **Status:** **T094a BLOCKED-BY backend OpenAPI change.** T094b and T094c inherit the block transitively.

**Finding:** Q2's chosen path ("extend 002 pairing handshake") requires a change to the backend API contract that POS-Pulse cannot make alone. `src/shared/api-types.ts` is auto-generated from `scripts/openapi-snapshot.json` (per spec 001 research §"Codegen: openapi-typescript v7 from a pinned snapshot in 001"). The snapshot is a frozen copy of the backend's OpenAPI spec; the source of truth lives in the `smartdatapulse.tech` backend repo.

**Current `TerminalPairResponse` snapshot shape (5 required fields):**

```json
{
  "device_token": "string (SECRET)",
  "tenant_id": "string",
  "branch_id": "string",
  "terminal_id": "string",
  "terminal_label": "string",
  "expires_at": "ISO 8601 | null (optional)"
}
```

**Required new fields (per Q2 decision):** `branch_name`, `branch_address`, `tenant_tax_registration_id` — all `string`, all required.

### Backend-coordination decision (resolved 2026-05-28 by Ahmed)

**Ahmed owns the backend coordination.** Ahmed will open a backend PR against `smartdatapulse.tech` to extend `TerminalPairResponse` with the three new fields. Once that backend PR merges and a fresh `scripts/openapi-snapshot.json` is committed in POS-Pulse, T094a (the POS-Pulse-side work) becomes unblocked.

POS-Pulse must NOT stub the snapshot locally ahead of the backend change — that would risk a contract divergence bug if the backend ships a different shape, and the `codegen:verify` CI gate would catch the divergence loudly on the next sync.

### Updated S1c.3 dependency graph

| Task | Status | Blocker |
|:--|:--|:--|
| **T094a** | BLOCKED | Backend PR + fresh OpenAPI snapshot (Ahmed owns) |
| **T094b** | BLOCKED | T094a (needs the three new fields in `terminal_assignment` to project into `FinalizeInput`) |
| **T094c** | BLOCKED | T094b (bootstrap calls T094b's projection module) |
| **T111** | BLOCKED | T094c |
| **T112** | BLOCKED | T094c |
| **T113** | BLOCKED | T111 + T112 |

### What can proceed in the meantime

Slice 1 is effectively paused until the backend PR lands. Parallel work that could fill the time:

- **Slice 0 follow-ups** still open per the original §A1 sign-off:
  - [ ] (a)/(b)/(c) printed-slip layouts (Ahmed-authored, MUST land before T173 craft fires in Slice 2)
- **Slice 2 prep work** that doesn't depend on Slice 1 closure:
  - Reading 008's spec.md + plan.md §AD-6 (receipt template engine) + research.md §R-6 to refresh context
  - Drafting Slice 2's task entries in tasks.md if not already present
- **Coverage tightening / refactor** on existing merged 008 modules (no test changes; only structural)

### Action items (this section)

- [x] **Claude** — verify Q2 path against `scripts/openapi-snapshot.json` (closed 2026-05-28: confirmed `TerminalPairResponse` lacks the three new fields).
- [x] **Ahmed** — backend-coordination decision (closed 2026-05-28: Ahmed owns the backend PR).
- [ ] **Ahmed** — open backend PR against `smartdatapulse.tech` adding `branch_name`, `branch_address`, `tenant_tax_registration_id` to `TerminalPairResponse` (required fields).
- [ ] **Ahmed** — once backend PR merges, regenerate `scripts/openapi-snapshot.json` here via `npm run codegen:api` (or equivalent) + commit. This unblocks T094a.
- [ ] **Claude (after snapshot lands)** — execute T094a per the original task entry in tasks.md.

### Action items

- [x] **Ahmed Q1 answer** — recorded 2026-05-28: "Zero for v1 (no VAT)" with §A5 production-readiness flag.
- [x] **Ahmed Q2 answer** — recorded 2026-05-28: "Extend 002 pairing handshake, attribute to 008".
- [x] **Claude** — collapse memo to chosen-path form (this commit).
- [x] **Claude** — author T094a / T094b / T094c task entries in tasks.md (closed 2026-05-28 in this same PR #267 commit; see `tasks.md` lines 216-223).
- [ ] **T094a PR** — `feat(008): extend 002 pairing handshake for branch detail (T094a)`. **BLOCKED-BY backend OpenAPI change (Ahmed owns)** — see §"Backend-coordination blocker on T094a" above.
- [ ] **T094b PR** — `feat(008): dispatch-projection module + RED-GREEN tests (T094b)`. After T094a merges (transitively blocked by backend).
- [ ] **T094c PR** — `feat(008): wire AD-2 worker + sales.* bridge into main (T094c, closes S1c.3)`. After T094b merges (transitively blocked by backend).
- [ ] **T111/T112 manual smokes** — BLOCKED-BY T094c. Will be unblocked once T094c lands.
- [ ] **T113 Slice 1 sign-off** — BLOCKED-BY T111/T112.
- [ ] **§A5 production-readiness gate** — flagged: re-open Q1 (Egyptian VAT compliance) before sign-off.

---

## 2026-05-28 — Slice 2 prep audit: line-snapshot persistence (`AD-6` receipt template engine)

> **Status:** **CLOSED — Ahmed picked Option A (lines_json column on sales row).** Adds T028a (new migration) to Slice 1's migration set.
>
> **Discovered by:** Claude session on 2026-05-28 while running an upstream-gap audit on Slice 2 (post-PR #268 merge). The audit applied the same field-source verification discipline that surfaced Slice 1's gap, looking for fields the receipt template needs but the codebase doesn't supply.

### Audit scope

Slice 2 (Phase 4 in tasks.md) ships the AD-6 receipt template engine — single source, dual output (ESC/POS bytes for thermal printer + HTML/canvas for on-screen preview). FR-015 requires byte-stable reprints: a receipt reprinted 6 months later MUST render identically to the original. The audit verified each input field the template needs against a real source in the codebase.

### Inherited finding (already-documented; no action needed here)

The audit confirmed Slice 2 inherits Slice 1's 4-field gap (`branch_name`, `branch_address`, `tenant_tax_registration_id`, `total_tax_minor`) because the template reads them from the persisted `sales` row. Resolution is automatic when T094a/b/c land — the sales row is the seam for both slices.

### New finding (Slice-2-specific)

**Receipt line snapshots are not persisted anywhere.** The template MUST render per-line item names, quantities, unit prices, and line subtotals — for the original sale AND for byte-stable reprints months later. The codebase as of 2026-05-28 has:

- `src/shared/cart/handoff-envelope.ts:1-11` — `PaymentIntentEnvelope.lines: LineSnapshot[]` exists at payment-time (item_ref, display_name, quantity, unit_price_minor, line_subtotal_minor, note)
- `migrations/0020_create_sales.sql:9-32` — `sales` row has **NO column for persisted line snapshots**. No `lines_json`. No separate `sale_line_items` table.
- `src/main/sales/finalize-transaction.ts` — does NOT save the line snapshots anywhere; cart rows are not durable post-handoff

**Failure mode if unresolved:** 6 months after a sale, when a customer requests a reprint, the template would either crash (no source) or print **stale data different from what the customer originally received** (if it falls back to querying the current catalogue). This violates FR-015 byte-stability and is a regulatory + consumer-trust failure.

### Decision (Ahmed, 2026-05-28)

**Option A — `lines_json` column on the `sales` row.** A new migration (`0027_extend_sales_with_lines_json.sql`) adds a `lines_json TEXT NOT NULL DEFAULT '[]'` column. T091 finalize-transaction serializes `PaymentIntentEnvelope.lines` into JSON and writes it atomically with the rest of the sale row. Receipt template reads + parses on reprint.

**Why Option A** (vs the two rejected alternatives):

| Criterion | A (lines_json) | B (separate `sale_line_items` table) | C (re-derive at reprint time) |
|:--|:--|:--|:--|
| FR-015 byte-stable reprints months later | ✅ | ✅ | ❌ **VIOLATES SPEC** (prices/names change over time) |
| Migration complexity | 1 column ALTER | New table + append-only trigger + FK + indexes | None |
| Match AD-3 append-only invariant | ✅ free (sales row is already triggered by 0021) | Requires separate append-only trigger | N/A |
| Match existing 008 patterns | ✅ `sales.tender_lines_summary_json` already exists at `0020_create_sales.sql:26` as `TEXT NOT NULL` JSON | Departs from established pattern | N/A |
| Read cost on reprint | One row read + JSON.parse | Join + N row reads | Variable |
| Compliance auditability | One row = one full sale | Distributed across tables | Receipt may differ from original |

**Decisive factor**: `sales.tender_lines_summary_json` already exists in the merged schema (line 26 of `0020_create_sales.sql`) using exactly the pattern Option A proposes. Adding `lines_json` matches the established convention. Option B would introduce a new pattern for sub-entities inconsistent with what's already merged.

**Cart-size concern (the strongest argument against A)**: negligible. A typical pharmacy cart is 5-20 lines. At ~150 bytes/line that's 750-3,000 bytes per sale row — well within SQLite's comfortable range. If a future product-recall scenario needs "all sales containing item X", a virtual JSON1 index (`json_extract(lines_json, '$[*].item_ref')`) provides that without a schema change.

### Implementation impact

The decision adds a **new task T028a** to Slice 1a's migration set, with corresponding updates to T091 (finalize-transaction) and T094b (dispatch-projection):

| Touchpoint | Change |
|:--|:--|
| **T028a (NEW)** | Migration `migrations/0027_extend_sales_with_lines_json.sql`: `ALTER TABLE sales ADD COLUMN lines_json TEXT NOT NULL DEFAULT '[]'`. The DEFAULT lets the migration run cleanly against existing dev fixtures already past 0020. RED-GREEN tests: schema-evolution test + insert/read round-trip. |
| **T091 update** | `finalize-transaction.ts` serializes `input.lines` to JSON and includes it in the sales INSERT. Existing T091 implementation is merged in PR #264; this is a small additive change. |
| **T094b update** | Dispatch-projection module reads `PaymentIntentEnvelope.lines` from the cart envelope JSON and includes it on `FinalizeInput`. |
| **Sales repository update** | `readById()` returns parsed `lines: LineSnapshot[]`. |
| **`FinalizeInput` shape** | Add `lines: readonly LineSnapshot[]` field. |

Cost: ~80-120 LoC across the four touchpoints plus the migration. The new T028a is `[BLOCKED-BY T094a]` transitively because T091 also writes the four T094a-blocked fields — they must land together.

### Action items (this section)

- [x] **Claude** — run upstream-gap audit on Slice 2 (closed 2026-05-28).
- [x] **Ahmed** — line-snapshot persistence decision (closed 2026-05-28: Option A, lines_json column).
- [x] **Claude** — author T028a task entry + update T091/T094b descriptions (this PR).
- [ ] **T028a PR** — folds into the eventual T094a/b/c PR chain (specifically, the migration lands as part of T094a-or-equivalent unblocking work; T091 + T094b updates land within their respective implementation PRs).
- [ ] **§A5 production-readiness gate** — flagged: confirm reprint byte-stability test passes against a sale that's been in the DB for ≥30 days before sign-off.

### Second-pass environmental audit (2026-05-28, post-data-field audit)

> **Scope:** After the data-field audit above resolved the line-snapshot question, ran a second-pass audit on the AD-6 template engine's *environmental* inputs — template assets, fonts, formatters, paper width, locale handling, etc. Same read-only discipline. Goal: surface remaining Slice 2 prerequisites before T160 craft begins.

**10 environmental fields audited**; 3 are already-documented gaps (printed-slip layouts deferred to Ahmed per §A1 sign-off — tracked in "Open coordination follow-ups" above), 5 are fine (paper-width pinned to 42 chars @ 80mm in visual-direction; receipt number locked to sale_number; DUPLICATE COPY marker spec-locked at FR-029; ESC/POS Arabic encoding is Slice 3's job not Slice 2's; logo/branding explicitly out of 008 v1 scope), and **2 are new findings worth recording**:

#### NEW finding #1 — Arabic font: Tahoma assumption is untested

**Finding:** [visual-direction/README.md §"(c) `preview` printed-slip content"](./visual-direction/README.md) specifies Windows `Tahoma` system font as the Arabic canvas fallback for `<ReceiptPreview>`. Tahoma ships by default with Windows 10/11 Pro (POS-Pulse's target platform per Constitution Hardware Matrix), so the assumption is *likely* safe — but no automated test verifies that every Arabic glyph required by the receipt template actually renders in Tahoma. Some Arabic ligatures or Egyptian-specific characters (e.g., `ج.م` for Egyptian Pound) may fall back to Unicode replacement boxes silently.

**Failure mode if untested:** Customer demo on a fresh Windows 11 machine shows `□□□` boxes instead of Arabic text. The bug is invisible in unit/integration tests (which run against JSDOM, not real font rendering).

**Resolution:** Add a §A5 production-readiness checklist item: on the actual hardware-matrix pair (Epson TM-T20III + the dev Windows 11 box), open `<ReceiptPreview>` with a real Arabic sale and verify all bilingual content renders correctly. If any glyphs fall back, bundle a fallback Arabic font (Noto Sans Arabic or Cairo) into the Electron app at T173 craft time.

#### NEW finding #2 — `src/shared/formatters/` module is absent

**Finding:** Slice 2 T160 (template engine) and T164 (receipt-payload generator) need `formatCurrency(minor_units, locale)`, `formatDate(iso, locale)`, `formatTime(iso, locale)` to compose receipt content. The codebase has `src/shared/money.ts` defining the `CurrencyCode = 'EGP'` type contract + minor-unit divisor, but no display formatter functions exist anywhere. Visual-direction/README.md §"Composition decisions" (line 118) requires Latin digits per FR-066 — the formatters must enforce this regardless of locale.

**Failure mode if untracked:** Slice 2 T160 author either (a) inlines ad-hoc format functions inside the template engine (violates Constitution §II's "no copy-paste from `_reference/Data-Pulse/`" / DRY discipline and risks per-template Latin-digit bugs), or (b) discovers the gap mid-T160 and stops to author the formatters out of order.

**Resolution:** Not a blocker — Slice 2 T160 can author `src/shared/formatters/receipt-formatters.ts` as a precursor sub-task. Flagged here so it isn't forgotten in the template-engine work itself. The module should export `formatCurrencyMinor(minor: number): string`, `formatLocalCalendarDay(iso: string): string`, `formatLocalTime(iso: string): string`, all returning Latin-digit strings per FR-066.

### Severity comparison

| Audit | Severity | Resolution path |
|:--|:--|:--|
| Slice 1 data fields (PRs #267 / #268) | P0 — hard-blocks finalize | Backend coordination + multi-task PR chain |
| Slice 2 data fields (this section, above) | P0 — hard-blocks byte-stable reprint | New migration T028a |
| **Slice 2 environmental (this sub-section)** | **P1 — Slice 2 craft prerequisites** | Tahoma → §A5 checklist; formatters → T160 precursor |

The environmental gaps are markedly lower severity than the data-field gaps. None of them invalidate Slice 1 or require Slice 1 rollback. None of them require Ahmed business decisions. They are pure engineering prerequisites that Slice 2 T160's author will encounter and resolve as part of the craft work.

### Action items (environmental audit)

- [x] **Claude** — run second-pass environmental audit (closed 2026-05-28).
- [x] **Claude** — record both new findings in this section (this commit).
- [ ] **§A5 production-readiness gate** — Tahoma Arabic-rendering smoke test on actual hardware-matrix Windows 11 box BEFORE sign-off. If any glyph falls back, bundle Noto Sans Arabic / Cairo into the Electron app.
- [ ] **Slice 2 T160 author** — implement `src/shared/formatters/receipt-formatters.ts` as a precursor to the template engine. Export `formatCurrencyMinor`, `formatLocalCalendarDay`, `formatLocalTime`, all Latin-digit per FR-066.
