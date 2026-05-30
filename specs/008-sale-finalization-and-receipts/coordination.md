# Coordination — 008-sale-finalization-and-receipts

**Feature:** 008-sale-finalization-and-receipts
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0 (authored 2026-05-27)
**Tasks:** [./tasks.md](./tasks.md) (DRAFT — all rows BLOCKED; embed activated PR #241)
**Embed preflight:** [../../docs/impeccable-embed-preflight.md](../../docs/impeccable-embed-preflight.md) (v0.4 — ACTIVATING)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-27
**Last updated:** 2026-05-28 (six passes: (1) S1c.3 closeout gap discovery: 4-field upstream gap recorded; Ahmed Q1+Q2 business decisions captured; Egyptian VAT §A5 production-readiness flag added; T094a/b/c task entries authored; T111/T112/T113 marked BLOCKED-BY T094c. (2) Backend-coordination blocker on T094a recorded post-PR #267 merge — framed as "Ahmed owns the backend PR" — **SUPERSEDED by pass (6); see §"Correction" below**. (3) Slice 2 prep audit recorded post-PR #268 merge: line-snapshot persistence finding + Ahmed's Option A decision (lines_json column on sales row); adds T028a migration task; updates T091 + T094b. (4) Second-pass Slice 2 environmental audit recorded same-PR: Tahoma Arabic-font assumption flagged for §A5 hardware-pair smoke; `src/shared/formatters/` absence flagged as Slice 2 T160 precursor. (5) Slice 3 prep audit recorded post-PR #269 merge: 3 print-pipeline findings — printer config provenance (Ahmed: extend 002 handshake same as Slice 1 Q2 path; folds into pending backend PR — **also SUPERSEDED by pass (6)**), retry policy (Ahmed: bounded exp backoff 3 retries 1s/4s/16s), receipt-byte hand-off type (engineering recommendation: `ReceiptRenderOutput` shape). Adds 2 §A5 checklist items. T094a backend PR scope grows by 3 printer-config fields. (6) Correction to passes (2) + (5) recorded post-PR #270 author-time: the "Ahmed owns the backend PR" framing was wrong. The OpenAPI snapshot is speculative per research.md §5 — contract authoring lives in Data-Pulse-2 and is Claude-doable, not Ahmed-blocked. Past pattern: Data-Pulse-2 PR #316 (vouchers V-A) + POS-Pulse commit `454914a`. See §"Correction (2026-05-28, post-PR #270 author-time discovery)" below.

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

**Phase: IMPLEMENTATION — SLICES 1 + 2 CODE-COMPLETE (human smoke/sign-off pending).** Setup (Phase 1) and Slice 0 (§A1 visual direction) are closed. Slices 1 and 2 are merged and code-complete; each still needs its human dev-build smoke + functional sign-off before it is fully closed:

- **Slice 1** (migrations + persistence + AD-2 finalize listener + `sales.*` bridge) — **code-complete** after PR #276 (T028a + T094b + T094c; the AD-2 worker is live behind the `sale_finalization` flag). T094a POS-Pulse-side pairing extension merged via PR #273. **Remaining: human smoke/sign-off — T111, T112, T113** (unchecked; checklist in §"Slice 1 closeout — T111 / T112 human smoke checklist" below, added via PR #277).
- **Slice 2** (receipt payload + AD-6 template engine + `receipts.preview` + `<ReceiptPreview>`) — **code-complete** after PR #278. **Remaining: human smoke/sign-off — T181, T182** (unchecked).

**Next-up:** complete the four open human smokes (T111/T112/T113 for Slice 1, T181/T182 for Slice 2), then Slice 3 (first-print pipeline). §A5 production-readiness remains **held** (rollout gate, not a slice-merge blocker).

> Historical note: this file was authored in the pre-implementation phase; the original "PRE-IMPLEMENTATION — PHASE 1 SETUP" framing and the `/speckit-*` authoring rows below are preserved verbatim as the project record. The live status is the paragraph above.

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
| Slice 1 — finalize + persistence + AD-2 worker | ✅ Code-complete (PR #276; T094a via PR #273). Human smoke/sign-off T111/T112/T113 pending. |
| Slice 2 — receipt payload + engine + preview | ✅ Code-complete (PR #278). Human smoke/sign-off T181/T182 pending. |
| Implementation slices 3–6 | ❌ Held — per-slice gate ownership below |

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

### ⚠️ §A3 TARGET DECISION NEEDED — bench hardware diverges from the committed pair (flagged to Ahmed 2026-05-30)

> **Owner action required:** the hardware observed on the §A5 bench (2026-05-30) is **not** the §A3-committed bring-up pair. Ahmed (the §A3 owner) must decide which pair the T200 bring-up + T520a perf-budget assertion target.

**Committed pair (this thread, closed 2026-05-26, PR #258):** Epson TM-T20III printer + APG VBS320 cash drawer.

**Observed on the §A5 bench (2026-05-30 — see §"§A5 hardware smoke evidence (2026-05-30)" below + [../../docs/hardware-matrix.md](../../docs/hardware-matrix.md)):**

| Category | Committed target | Observed on bench | Match? |
|:--|:--|:--|:--:|
| Receipt printer | Epson TM-T20III | **BIXOLON SRP-330 II** (driver installed; Windows OS test page passed; ESC/POS direct path unverified) | ❌ |
| Cash drawer | APG VBS320 (Vasario) | **none observed** (no drawer on the bench) | ❌ |
| Barcode scanner | _(not part of the T006 §A3 pair; scope is wedge-HID-only)_ | **HONEYWELL HF680-RS-01 REV B** (general scan passed; `-RS` suffix → confirm wedge-HID vs RS-232) | n/a |

**Decision for Ahmed — pick one:**

- **Option A — Move the §A3 target to the bench hardware.** Commit BIXOLON SRP-330 II as the printer and procure/confirm a specific cash-drawer model (the bench currently has none). This requires a **fresh T006-style §A3 hardware-pair commitment** (new pending rows in `hardware-matrix.md` + a drawer model) and re-pointing T200 / T520a + the §A3 integration rows (T301/T302, T371/T372/T373, T462) at the new pair. Also confirm the BIXOLON's ESC/POS direct path (AD-6 prefers it; only the OS-print path is proven so far).
- **Option B — Keep the committed Epson/APG pair.** Procure the Epson TM-T20III + APG VBS320 for the T200 bring-up; treat the BIXOLON/HONEYWELL bench results as opportunistic smoke only (already recorded as OBSERVED-not-tested rows). No change to the committed §A3 target.

**Status:** ⏳ **OPEN — awaiting Ahmed.** This flag changes **nothing** on its own: the committed Epson/APG pair, the ticked T006 pair-selection item, and all gate labels remain as-is until Ahmed picks A or B. Recorded here (not as a doc-only rewrite of the committed target) so the §A3 owner makes the call. Tracked in §"Open coordination follow-ups" below.

### T201 — ESC/POS library pick + dependency audit (Slice 3, 2026-05-29)

**Choice:** `node-thermal-printer@4.6.0` (the pre-pinned candidate from the T006 thread). Confirmed as the Slice 3 ESC/POS adapter library.

**Transitive-dependency audit:**

| Package | Version | License | Native bindings |
|:--|:--|:--|:--|
| `node-thermal-printer` | 4.6.0 | ISC | none |
| `iconv-lite` | 0.6.3 | MIT | none (pure JS) |
| `pngjs` | 7.0.0 | MIT | none (pure JS) |
| `unorm` | 1.6.0 | MIT or GPL-2.0 (take MIT) | none (pure JS) |
| `write-file-queue` | 0.0.1 | MIT | none (pure JS) |

- **License review:** ISC + MIT throughout. `unorm` is dual-licensed; the MIT arm applies, so there is no copyleft obligation. All compatible with the project's distribution posture.
- **Maintenance:** last published 2026-01-27 (≈4 months before this pick) — actively maintained.
- **No native/`serialport` bindings** — the library speaks ESC/POS over a network or named-printer transport, so there is no `node-gyp` rebuild step in the Electron packaging path. This is the load-bearing reason the choice holds for an Electron app.
- **`npm audit` after install:** 3 vulnerabilities reported (`brace-expansion` moderate, `tmp` high, `ws` moderate). **None are in the `node-thermal-printer` subtree** — verified against the `package-lock.json` git diff, which shows the install added ONLY `node-thermal-printer` + the four clean deps above. They are all **pre-existing and not introduced by this dependency**. Provenance (corrected per CodeRabbit #280 re-check — the earlier "dev-tooling only" phrasing was imprecise): `tmp` + `ws` are in the dev/build-test chain; `brace-expansion` IS in the **production** tree, but via `@sentry/electron → @sentry/node → @fastify/otel → minimatch → brace-expansion`, NOT via `node-thermal-printer`. So `node-thermal-printer` itself introduces zero new vulnerabilities; the pre-existing Sentry-chain `brace-expansion` advisory is tracked separately (out of scope for this slice).

**T202:** `node-thermal-printer@^4.6.0` added to `package.json` `dependencies`; lockfile committed.

### S3c — `<PrinterFailureBanner>` preflight decisions (2026-05-29)

Four decisions recorded before the T290 `/impeccable craft` (per `docs/impeccable-embed-preflight.md §4.2`):

1. **T291 host path corrected.** tasks.md T291 + the §A1 brief (f) name `src/renderer/ui/banners/BannerHost.tsx` as the mount target — **that file does not exist**. Banners in this codebase mount as siblings directly in `src/renderer/shell/AppShell.tsx` (the connection `StatusBanner` via `TopBar`; `ShiftClosedBanner` mounted in AppShell at ~line 80). S3c mounts `<PrinterFailureBanner>` as a sibling in `AppShell.tsx` below the connection banner (matching the brief's stack order). No `BannerHost.tsx` is created.

2. **Component ships; AppShell mount (T291) deferred on the missing recent-sale feed (v1-subset gap — owner review at PR).** Two feeds matter here, and the gap is sharper than first framed:
   - The **failure projection** is real today: `sales.read` is implemented (NOT stubbed) and projects `latest_print_event: PrintEventSummary` carrying `outcome`, so `outcome==='failure'` is queryable now.
   - What is **missing** is the renderer's "*which* sale just finalized, and *when*" signal — that comes from `sales.subscribe({topic:'recent'|'banner_state'})`, **both still the `not_implemented` STUB** (`sales-bridge.ts:310`; push primitive `webContents.send` + token registry unbuilt). There is no other renderer source for a recent finalized sale_id (verified: nothing in `src/renderer` reads one).
   - Therefore AppShell cannot know what to feed `<PrinterFailureBanner printFailure>` until the push primitive lands. Per advisor: do NOT mount with a hardcoded `printFailure={null}` (looks-wired-but-can-never-display) and do NOT scaffold a writer-less store (speculative dead code). **The tested component ships now; T291 (AppShell mount + live feed) stays UNCHECKED**, to land with the push primitive in a later slice — OR the owner pulls the push primitive into S3c scope at review. One decision, flagged in the PR body. Standard render-what's-true / defer.
   - **✅ RESOLVED 2026-05-29 (Ahmed): DEFER T291; build the feed in a follow-up slice (this one).** The S3c component shipped as-is (PR #281 `9fbb906`).
   - **↻ MECHANISM CORRECTED 2026-05-29 (Ahmed, after new evidence): SNAPSHOT-subscribe + renderer poll, NOT true push.** The #282 deferral note said "push primitive," but on starting the build that premise proved wrong: **005 AND 006 both chose snapshot-subscribe** (`subscribe ≡ read`, one-shot, no `webContents.send`) for this exact contract shape; 008's finalize is **deliberately poll-based** ("No EventEmitter, no trigger, polling only"); and `banner_state` is a **computable terminal snapshot** (main already projects `latest_print_event`/`latest_drawer_event`), not a per-sale push. A novel push primitive would cut against two established patterns for no real benefit (a 1-2s poll latency on a print failure is harmless — the sale is already durable). **This follow-up slice instead:** (1) un-stubs `sales.subscribe(banner_state)` to compute + return a real `BannerState` projection (`no_banner | printer_failure | drawer_failure`) from `print_events`/`drawer_events`, and `subscribe(recent)` to return the recent-sale summary — both one-shot like 006; (2) adds a renderer `useBannerState` polling hook (~1s interval); (3) T291 mounts `<PrinterFailureBanner>` in `AppShell.tsx` fed by that hook. No token registry, no push channel, no new preload event surface. (`<DrawerFailureBanner>` from Slice 4 stacks the same way once it lands.)
   - **Projection rule (chosen 2026-05-29; Ahmed may veto):** `banner_state` is computed **PER-SALE, not terminal-global-latest**. A naive "latest `print_events` row for the terminal wins" rule is a SILENT-FAILURE BUG (PRODUCT.md Principle 3): if Sale A's print fails at 10:00 and Sale B's print succeeds at 10:05, a global-latest LIMIT-1 query returns B's success → banner clears while A's receipt never printed. Correct rule: a sale is in `printer_failure` iff *its own* latest print event (by `sale_id`, `printed_at DESC`) is `outcome='failure'` (a later `success`/`manual_override` on the SAME sale clears it); the terminal banner surfaces the **most-recently-finalized sale whose own latest print event is an unresolved failure**. Multi-unresolved falls out cleanly (A fails, B fails → show B; resolve B → A resurfaces — nothing dropped). Same per-sale rule for drawer (`outcome='failed'`). The query JOINs `print_events`/`drawer_events` → `sales` on the session `(tenant,branch,terminal)` triple (the event tables are sale-scoped, no `terminal_id` column).

3. **Reprint-gate reconciliation (brief prose vs T262 vs AD-10).** Brief (f) prose loosely describes the failure-banner Reprint as "a fresh first-print attempt" (implying enabled). T262 says Reprint is **disabled until a successful print exists** (AD-10 precondition). The data-model is decisive: AD-10 / contract line 310 — reprint requires ≥1 prior `outcome='success'` PrintEvent; in the *failure* state none exists → **Reprint disabled is correct**. Encoded T262's AD-10-consistent behavior; **Retry** is the live action in the failure state. The brief-prose discrepancy is surfaced here for the §A1 reviewer (the prose is the loose artifact, not the test).
   - **Manual receipt** affordance is present + labeled but **not wired** (entry-point only; manual-override is Slice 6 / T512) — same posture as ReceiptPreview's disabled Print placeholder.

4. **Red-bar confirmed (T290 craft gate, `impeccable-embed-preflight §4.2`).** The four failing test files for `<PrinterFailureBanner>` (T260 persistence + affordances, T261 subscription, T262 affordance-gating, T263 a11y) were written and confirmed **RED locally** (4 files failed — component module missing) on 2026-05-29 BEFORE the T290 `/impeccable craft` invocation:
   - `tests/unit/renderer/receipts/PrinterFailureBanner.persistence.test.tsx`
   - `tests/unit/renderer/receipts/PrinterFailureBanner.subscription.test.tsx`
   - `tests/unit/renderer/receipts/PrinterFailureBanner.affordance-gating.test.tsx`
   - `tests/unit/renderer/receipts/PrinterFailureBanner.a11y.test.tsx`

### T360 `<DrawerFailureBanner>` red-bar record (2026-05-30, S4b)

**Third `[IMPECCABLE craft]` marker (T360).** Per `impeccable-embed-preflight §4.2` + `s4-preflight.md §4.2`, the three failing test files for `<DrawerFailureBanner>` were written and confirmed **RED locally** (3 files failed — `src/renderer/ui/receipts/DrawerFailureBanner.tsx` does not yet exist; import fails) on 2026-05-30 BEFORE the T360 `/impeccable craft 008-drawer-failure-banner` invocation:

- `tests/unit/renderer/receipts/DrawerFailureBanner.persistence.test.tsx` (T330 — mounts on `outcome='failed'`; relative `last_successful_open_at` via `formatRelativeTime`; ≥44×44 manual-override; no close-X; visually distinct from the printer banner)
- `tests/unit/renderer/receipts/DrawerFailureBanner.no-retry.test.tsx` (T331 — NO retry-kick / reprint affordance; manual-override is the ONLY action, per quickstart §Path D + FR-053)
- `tests/unit/renderer/receipts/DrawerFailureBanner.a11y.test.tsx` (T332 — role=status/aria-live=polite/aria-atomic; no focus-steal on mount; 44×44; axe-clean)

Result: `Test Files 3 failed (3) · Tests no tests`. Craft invoked immediately after this record.

**S4b craft bindings (per `s4-preflight.md §5.2`):**
- Subscribes to `sales.subscribe(topic='banner_state')` via a new `useDrawerBannerState` hook reading the `.drawer_failure` slice of the coexistence `BannerState` record (PR #285 contract precursor).
- Manual-override is a **required `onManualOverride` prop** wired to a placeholder in `AppShell.tsx` (the real `receipts.manualOverride` handler is Slice 6 / T512) — the `enabled⟹wired` lesson; mirrors the printer banner's stub posture (Ahmed-approved 2026-05-29).
- Mounts in `AppShell.tsx` as a sibling BELOW `<PrinterFailureBanner>` (NFR-008 stack order). **No `BannerHost.tsx`** — same stale-path correction as T291/T352 (that file never existed).

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
- [ ] **⚠️ §A3 hardware-target decision (Ahmed) — flagged 2026-05-30** — the §A5 bench hardware (BIXOLON SRP-330 II printer; no cash drawer; HONEYWELL HF680-RS-01 scanner) **diverges from the committed T006 §A3 pair** (Epson TM-T20III + APG VBS320). Ahmed (the §A3 owner) must pick **Option A** (move the §A3 target to the bench hardware — needs a fresh hardware-pair commitment + a drawer model + re-pointing T200 / T520a / T301-T302 / T371-T373 / T462) or **Option B** (keep the committed Epson/APG pair and procure it for T200). Full options + comparison table in §"§A3 hardware-matrix coordination thread (T006)" → "⚠️ §A3 TARGET DECISION NEEDED" above. **No gate label / committed-pair / ticked-selection changed by this flag** — it stays open until Ahmed decides.

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
- [x] **Ahmed** — backend-coordination decision (closed 2026-05-28: Ahmed owns the backend PR). **SUPERSEDED — see Correction (2026-05-28, post-PR #270) below.**
- [ ] ~~**Ahmed** — open backend PR against `smartdatapulse.tech` adding `branch_name`, `branch_address`, `tenant_tax_registration_id` to `TerminalPairResponse` (required fields).~~ **SUPERSEDED — Correction below.**
- [ ] ~~**Ahmed** — once backend PR merges, regenerate `scripts/openapi-snapshot.json` here via `npm run codegen:api` (or equivalent) + commit. This unblocks T094a.~~ **SUPERSEDED — Correction below.**
- [ ] ~~**Claude (after snapshot lands)** — execute T094a per the original task entry in tasks.md.~~ **SUPERSEDED — Claude authors the Data-Pulse-2 contract slice directly. See Correction below.**

### Correction (2026-05-28, post-PR #270 author-time discovery)

> **The "Ahmed owns the backend PR" framing above was wrong.** Documented here rather than rewritten in place so the audit trail is intact and future readers can trace the discovery sequence. Original text is struck-through above; this Correction supersedes.

**What was wrong**: PR #268's memo (the original sub-section above) framed T094a as blocked-by-Ahmed-must-do-a-backend-PR. PR #270 (Slice 3 prep audit) inherited the same framing for the additional 3 printer-config fields. Both implied the only person who could unblock T094a was Ahmed.

**What's actually true** — verified 2026-05-28 by reading `specs/001-foundation/research.md` §5 (lines 145-149) and checking git history for prior contract-pin precedents:

1. **The OpenAPI snapshot at `scripts/openapi-snapshot.json` is speculative / forward-looking.** Per research §5: *"the constitution pins the API URL but the platform may not yet expose `/openapi.json` at the time 001 lands. A pinned snapshot decouples 001 from platform readiness."*

2. **Contract authoring happens in Data-Pulse-2 (the backend repo), not directly on `smartdatapulse.tech`.** Data-Pulse-2 owns `packages/contracts/openapi/**` — the source of truth for what API contracts look like, regardless of whether the live server implements them yet.

3. **Anyone with Data-Pulse-2 repo access can author the contract slice** — including Claude. Verified by past pattern:
   - **Data-Pulse-2 PR #316** (merged 2026-05-24, headRef `feat/pos-006-voucher-va-contract`) authored 006's voucher V-A OpenAPI contract: 604 LoC contract tests + 629 LoC yaml. Pure contract authoring; no live server implementation required at the same time.
   - **POS-Pulse commit `454914a`** pinned PR #316's contract bytes into the snapshot: `feat(006): T200-T203 pin voucher V-A contract + regenerate api-types`. Standard pin-then-regen workflow.

4. **The 281-path POS-Pulse snapshot was bootstrapped from the legacy (Python/FastAPI) `Data-Pulse` repo (archived 2026-05-06)** — that's why it has `TerminalPairResponse` even though Data-Pulse-2 (the current TypeScript backend) does NOT yet have a pairing endpoint or schema. Most of the 281 paths are speculative; they describe contracts that Data-Pulse-2 will catch up to over time.

5. **Therefore T094a's real unblock path is**: author a Data-Pulse-2 slice (similar shape to PR #316 — OpenAPI yaml + contract tests, no live server implementation) → pin into POS-Pulse snapshot → regenerate types → execute T094a's POS-Pulse-side migration + pairing-store + service.ts changes.

### Corrected action items

- [x] **Claude** — verify the snapshot's speculative-contract framing against research.md §5 + git history (closed 2026-05-28: confirmed via PR #316 precedent + commit `454914a`).
- [x] **Ahmed** — confirm Claude proceeds with the Data-Pulse-2 slice authoring (closed 2026-05-28: Ahmed authorized in this session).
- [ ] **Claude** — open a Data-Pulse-2 slice authoring the pos-terminal-pairing OpenAPI contract: `packages/contracts/openapi/pos-terminal-pairing.yaml` (or sibling-named) + `apps/api/test/pos-terminal-pairing/pairing.contract.spec.ts`. **Six** new fields: `branch_name`, `branch_address`, `tenant_tax_registration_id` (Slice 1 closeout gap), `printer_vendor_id`, `printer_product_id`, `printer_com_port` (Slice 3 prep audit). Follow Data-Pulse-2's Maestro/Agent OS slice protocol (slice brief with `[GATED]` for `packages/contracts/openapi/**`, validation block, contract conformance tests). Ahmed reviews the slice brief before any code lands.
- [ ] **Claude (after Data-Pulse-2 PR merges)** — pin the new contract bytes into POS-Pulse `scripts/openapi-snapshot.json` and regenerate `src/shared/api-types.ts` via `npm run codegen:api`. Mirror commit `454914a`'s shape.
- [ ] **Claude (after pin + regen lands)** — execute T094a per the task entry in tasks.md (the POS-Pulse-side terminal_assignment migration + store + service.ts pass-through). This was previously documented as "BLOCKED-BY backend"; the actual sequencing is "BLOCKED-BY Data-Pulse-2 contract slice + POS-Pulse pin commit".

### Why this correction matters

Without it, future Claude sessions (and human readers) re-reading PR #268's memo would re-discover the same wrong assumption: "wait for Ahmed to do the backend PR." That's been wrong since the snapshot was first authored under research §5's speculative-contract design. The correction makes the actual workflow legible.

This is also a useful reference for **Slices 2-6**: any time a future audit identifies a "backend-blocked" finding, check first whether the contract is in the speculative portion of the snapshot. If yes, the work is a Data-Pulse-2 slice (Claude-doable); if no, it's a real live-server change (Ahmed-required). Most 008 work will be the former.

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

---

## 2026-05-28 — Slice 3 prep audit: print pipeline upstream gaps

> **Status:** **CLOSED — 2 business decisions captured + 1 engineering recommendation locked.** Adds 3 printer-config fields to T094a's backend PR scope + 2 §A5 checklist items. No new T-task IDs (changes fold into existing Phase 5 tasks).
>
> **Discovered by:** Claude session on 2026-05-28 while running an upstream-gap audit on Slice 3 (print pipeline) post-PR #269 merge. Same read-only field-source verification discipline that surfaced gaps in Slice 1 and Slice 2.
>
> **Scope:** Audit covered 10 inputs the print pipeline needs (ESC/POS adapter, printer detection, command vocabulary, OS-print fallback, print_events schema, retry queue, failure banner, dispatch hooks, manual-override handler, receipt-byte contract). **8 of 10 are already known tasks in Phase 5** (T200-T303) — flagged but not new. **3 are genuine upstream gaps** the plan didn't account for.

### Inherited finding (already-documented; resolves automatically)

Slice 3 inherits Slice 1's backend-coordination blocker (T094a) for one new reason recorded below: the printer config fields must come from the same pairing-handshake extension. See Q1 below — Ahmed's decision folds the printer fields into the same pending backend PR rather than opening a parallel coordination thread.

### New finding #1 — Printer config field provenance

**Finding:** Slice 3 must connect to the Epson TM-T20III via USB. No source in the codebase carries the device's `vendor_id` (0x04B8) or `product_id` (0x0202 for TM-T20III). Verified by grep across `plan.md`, `research.md`, `spec.md`, and `docs/hardware-matrix.md`: no field, no config, no convention. `src/main/pairing/store.ts` `terminal_assignment` schema has no printer columns. **Same gap shape as Slice 1's `branch_name` / `branch_address` / `tenant_tax_registration_id` gap** — the plan implicitly assumed terminal-scoped hardware config exists somewhere, but nothing supplies it.

**Failure mode if unresolved:** Slice 3 T201 (pick the ESC/POS library) cannot complete the printer-discovery bootstrap without knowing where to look. Either a code change ships per-printer-model (every new pharmacy hardware requires a release), or the binary refuses to start on any non-default hardware.

### Decision Q1 (Ahmed, 2026-05-28)

**Extend 002 pairing handshake with printer config fields.** Same architectural decision as Slice 1 Q2: the backend pairing-handshake response carries `printer_vendor_id` (string, hex format), `printer_product_id` (string, hex format), and optional `printer_com_port` (string | null) fields. Persisted in `terminal_assignment` schema. Slice 3 bootstrap reads from `readPairingTerminalAssignment()`.

**Why this option** (vs the two alternatives — first-launch USB scan, hard-code v1):

| Criterion | A (extend handshake) | B (first-launch USB scan + safeStorage) | C (hard-code TM-T20III IDs for v1) |
|:--|:--|:--|:--|
| Central admin control | ✅ — IT manages all terminals from backend | ❌ — local; differs per-machine | ❌ — code-level; release per model |
| Multi-printer-model support | ✅ — works for any backend-configured device | ✅ — works if vendor_id present in USB enumeration | ❌ — TM-T20III only; future printers need code changes |
| Avoids backend dependency | ❌ — same blocker as T094a | ✅ — purely local | ✅ — purely local |
| Compliance (Egyptian Tax Authority may require known fiscal device per terminal) | ✅ — backend record of "this terminal has THIS printer" | ⚠️ — local record only; harder to audit | ⚠️ — local; assumed-uniform |
| First-terminal onboarding UX | ✅ — plug-and-play once paired | ⚠️ — admin must respond to multi-match prompt on first launch | ✅ — plug-and-play if correct hardware |

**Decisive factor**: Egyptian Tax Authority compliance + central IT admin model. Same reasoning as Slice 1 Q2. The cost of the backend dependency is the same backend PR that's already pending for T094a — Ahmed can add the printer fields to that same backend PR. The marginal cost of adding three more fields to an already-pending PR is near-zero; opening a parallel local-config primitive (option B) would introduce a new architecture pattern just for printers.

**Implementation impact**: T094a's scope grows by three fields. The same backend OpenAPI PR that adds `branch_name`/`branch_address`/`tenant_tax_registration_id` should also add `printer_vendor_id`/`printer_product_id`/`printer_com_port`. Documentation update only in this PR; backend coordination remains Ahmed's task.

### New finding #2 — Retry policy schedule

**Finding:** `plan.md` references retry semantics in multiple places (lines 252, 288, 456, 457, 610, 716, 727, 729, 803, 834) but does NOT pin a timing schedule, attempt limit, or backoff curve. Slice 3 task entries T250-T253 say "retry flow" without quantifying it. `spec.md` FR-052 ("print-retry-success-treated-as-first-print") is silent on schedule.

**Failure mode if unresolved:** Slice 3 T250 implementer either invents a schedule unilaterally (likely producing different behavior than expected) or stops mid-implementation to design the policy.

### Decision Q2 (Ahmed, 2026-05-28)

**Bounded exponential backoff: 3 retries max with 1s → 4s → 16s delays.** After the 3rd retry fails, the persistent printer-failure banner stays up indefinitely until the cashier acts via the renderer affordances (retry / reprint / manual-override). No further automatic retries.

**Why this option** (vs the two alternatives — 200ms-forever AD-2-style, single-retry-then-banner):

| Criterion | A (bounded exp 3 retries) | B (200ms forever, no cap) | C (single retry then banner) |
|:--|:--|:--|:--|
| Covers transient hardware faults | ✅ — 3 retries catches paper-jam-recovery, USB hiccups | ✅ — keeps retrying | ⚠️ — one retry only |
| Avoids log-spam / runaway behavior on stuck printer | ✅ — bounded at 3 | ❌ — risks endless retry on dead printer | ✅ — single attempt |
| Customer wait time before banner shows | ~21 seconds max | indefinite (banner never shows automatically) | 2 seconds |
| Matches cashier intuition (most failures are structural, not transient) | ⚠️ — could feel long to cashier | ❌ — cashier never sees banner | ✅ — fastest user feedback |
| Code complexity | Moderate (timer + counter) | Low (matches AD-2 pattern) | Low (one timer) |

**Decisive factor**: Egyptian pharmacy environments have moderate USB stability with occasional brownouts; 3 retries catches the realistic transient cases without making customers wait absurdly long. The 21-second max-wait is acceptable for a fiscal receipt (compared to "permanent loss" if option C's single retry also fails on a transient fault). The bounded retry count avoids the runaway-log scenario from option B.

**Implementation impact**: T250 (retry-flow test) + T251 (retry-flow impl) tasks already exist in Phase 5; their descriptions get an explicit schedule call-out at implementation time. Adds the schedule constants to a new `src/main/receipts/retry-policy.ts` module (or inline in the retry handler).

### New finding #3 — Receipt-byte hand-off type contract

**Finding:** Slice 2's AD-6 template engine (T160) must emit **two outputs from one source** per the plan: ESC/POS bytes (for the thermal printer) AND HTML/canvas (for the on-screen preview). The return type of `renderReceipt(payload, variant)` is not declared anywhere — not in `src/shared/receipts/types.ts`, not in `data-model.md`, not in `contracts/bridge-api.md`. Without this type, Slice 2 T160 (template engine) and Slice 3 T240 (print-on-finalize integration) cannot agree on the hand-off shape.

**Failure mode if unresolved:** Slice 2 T160 author invents the return shape; Slice 3 T240 author either accommodates whatever T160 chose (likely fine) or expects a different shape (likely a 1-day refactor). The shape also impacts test mocks — once T160 ships, changing it costs more.

### Engineering recommendation Q3 (Claude, 2026-05-28; no Ahmed business decision needed)

**Type contract:**

```typescript
// src/shared/receipts/types.ts (new addition)
export interface ReceiptRenderOutput {
  /** ESC/POS bytes ready for direct USB write to the thermal printer.
      Code-page commands + content + cut byte. Buffer is the natural
      Node.js shape; render in Slice 2, consume in Slice 3. */
  readonly escpos: Buffer;
  /** HTML/canvas-renderable string for the renderer's <ReceiptPreview>
      surface. UTF-8; bilingual; safe to inject via setInnerHTML in
      the contextIsolation: true context (renderer cannot reach main). */
  readonly html: string;
  /** Width metadata for consumer display. Matches paper width pinned
      in visual-direction (42 chars @ 80mm for TM-T20III). */
  readonly width_chars: number;
}
```

**Why this shape** (vs alternatives):
- **`Buffer` + `string`** is the natural Node.js shape; no need for base64-encoding overhead.
- **Both outputs from one render call** matches AD-6's "single source, dual output" architectural decision (plan §AD-6).
- **Returning a discriminated union** (e.g., `{ kind: 'escpos', bytes } | { kind: 'html', body }`) would force the renderer to call render twice — wasteful, and the contracts say "from one source" specifically to avoid that.
- **`width_chars` included** for downstream layout decisions (e.g., `<ReceiptPreview>` uses it for monospace font sizing).

This is a pure engineering type-design call; no business decision needed. Recording here so Slice 2 T160 author knows to use this shape from the start.

### Implementation impact (consolidated)

| Touchpoint | Change | Status |
|:--|:--|:--|
| **T094a backend PR scope (Ahmed owns)** | Adds 3 more fields to TerminalPairResponse: `printer_vendor_id`, `printer_product_id`, `printer_com_port`. Same backend PR as the existing T094a coordination. | BLOCKED-BY backend (same as Slice 1 Q2 path) |
| **T094a POS-Pulse update** | terminal_assignment migration (the same one extending for branch_name etc.) adds 3 printer config columns. Pairing store row shape gains 3 fields. Service.ts persist call passes them through. | BLOCKED-BY snapshot refresh |
| **T250 description update at implementation time** | Explicit "bounded exponential backoff (3 retries, 1s → 4s → 16s) then banner-persists-for-cashier" wording added to T250 PR description | Folds into T250 implementation PR |
| **New `src/main/receipts/retry-policy.ts`** | Module with `RETRY_DELAYS_MS = [1000, 4000, 16000] as const` + `MAX_RETRIES = 3` constants + helper to compute next delay | Lands as part of T250 |
| **`src/shared/receipts/types.ts` — add `ReceiptRenderOutput`** | New interface per Q3 recommendation. Slice 2 T160 imports and returns this shape. Slice 3 T240 imports and consumes. | Add to Slice 2 T140 (the first task that creates the types) or earlier — needs to land BEFORE T160 starts |

### §A5 production-readiness flags added

- [ ] **Printer config integrity** — verify on actual TM-T20III hardware that the persisted `printer_vendor_id`/`printer_product_id` correctly identify the connected printer; verify printer-detection failure path produces a friendly cashier banner (not a crash). Smoke at S6 hardware bring-up.
- [ ] **Retry-policy timing** — verify on actual TM-T20III hardware that the 3-retry exponential-backoff sequence produces correct user-visible behavior under simulated paper-out + USB-disconnect faults. Smoke at S6.

### Action items (Slice 3 prep audit)

- [x] **Claude** — run upstream-gap audit on Slice 3 (closed 2026-05-28).
- [x] **Ahmed Q1 answer** — printer config provenance (closed 2026-05-28: extend 002 pairing handshake; merge with T094a backend PR).
- [x] **Ahmed Q2 answer** — retry policy (closed 2026-05-28: bounded exponential backoff 3 retries, 1s→4s→16s).
- [x] **Claude Q3 recommendation** — receipt-byte hand-off type contract (closed 2026-05-28: `ReceiptRenderOutput` shape recommended; no business decision needed).
- [ ] **Ahmed** — fold the 3 printer-config fields (`printer_vendor_id`, `printer_product_id`, `printer_com_port`) into the same backend PR being prepared for T094a's branch-detail fields.
- [ ] **Claude (after T094a unblocks)** — update T094a task description in tasks.md to include the 3 printer fields. Update T094a's POS-Pulse-side implementation scope accordingly.
- [ ] **Claude (at Slice 2 prep moment)** — add `ReceiptRenderOutput` interface to `src/shared/receipts/types.ts` at the natural Slice 2 prep moment (likely T140 — the first task that creates receipt-related types).
- [ ] **§A5 production-readiness gate** — both new checklist items above.

---

## 2026-05-28 — T094a contract pin complete (Data-Pulse-2 PR #388 merged)

> **Status:** **TerminalPairResponse 6 new fields pinned into POS-Pulse snapshot.** T094a's POS-Pulse-side execution (terminal_assignment migration + pairing store row shape + service.ts pass-through) is now UNBLOCKED.

### What landed

**Data-Pulse-2 PR #388** — `feat(pos-008): author Terminal Pairing OpenAPI contract for POS-Pulse Slice 1c.3 + Slice 3` — merged 2026-05-28 at 19:50Z by Ahmed. Squash commit `6c9dda2` on Data-Pulse-2 main. Authored by Claude in worktree `dp2-pos-008-terminal-pairing` per Data-Pulse-2's Maestro / Agent OS slice protocol. Two files: `packages/contracts/openapi/pos-terminal-pairing.openapi.yaml` (393 LoC) + `apps/api/test/pos-terminal-pairing/pairing.contract.spec.ts` (584 LoC, 46 conformance assertions).

CodeRabbit review on PR #388 produced 5 findings: CR1-CR4 (all real, fixed in commit `6d9fcd0` on the same PR — pin TerminalPairRequest schema exactly, assert Retry-After 429 contract, reconcile auth narrative, fix printer-config prose/schema mismatch) plus CR5 (defended — `nullable: true` is the repo-wide convention across all Data-Pulse-2 top-level contracts).

### POS-Pulse pin (this PR)

Mirror of POS-Pulse commit `454914a` ("feat(006): T200-T203 pin voucher V-A contract + regenerate api-types"). **Surgical pin (Option 1 per the in-session brief)** — extends the existing `/api/v1/terminals/pair` endpoint's `TerminalPairResponse` schema with the 6 new fields rather than replacing the entire endpoint with DP2's authored `/api/pos/v1/terminals/pair` path + `posPairTerminal` operationId. Rationale: minimal blast radius (POS-Pulse 002's `network.ts` `PAIR_PATH` constant + `service.ts` keep working as-is); path-rename can be its own follow-up slice if 002 modernization happens.

**Snapshot change:**
- `scripts/openapi-snapshot.json` — `TerminalPairResponse` properties: 6 → 12 (added `branch_name`, `branch_address`, `tenant_tax_registration_id`, `printer_vendor_id`, `printer_product_id`, `printer_com_port`); required: 5 → 11.
- `src/shared/api-types.ts` — regenerated via `npm run codegen:api`; `codegen:verify` clean.

**Test fixture updates:**
- `src/main/pairing/__tests__/service.test.ts` — `SUCCESS_BODY` fixture extended with 6 new fields.
- `src/main/observability/__tests__/sentry-pairing.test.ts` — pair-response mock body extended with 6 new fields.

**Validation:** typecheck ✅ · lint + prettier ✅ · vitest 3804 passed / 0 failed / 3 skipped ✅

### Unblocked

- **T094a (POS-Pulse-side)** — the actual `terminal_assignment` migration + `src/main/pairing/store.ts` row shape gain + `src/main/pairing/network.ts` + `src/main/pairing/service.ts` parse-through changes. Now ready to be authored as a separate POS-Pulse feature PR. The contract bytes are pinned; the implementation work has all type information available.
- **Transitive chain** — T094b (dispatch projection) → T094c (main bootstrap) → T111/T112 (manual smokes) → T113 (Slice 1 sign-off) — all still blocked-by their immediate predecessor, but the cross-repo coordination block on T094a is now cleared.

### Updated action items

- [x] **Claude** — author Data-Pulse-2 slice for pos-terminal-pairing contract (closed 2026-05-28 via DP2 PR #388).
- [x] **Claude** — pin Data-Pulse-2 PR #388 bytes into POS-Pulse snapshot + regenerate types (closed 2026-05-28 in this PR).
- [ ] **Claude (next)** — execute T094a's POS-Pulse-side implementation: terminal_assignment migration + store/network/service.ts changes. Now unblocked.
- [ ] **Claude (after T094a)** — T094b dispatch projection module at `src/main/sales/finalize-dispatch.ts`.
- [ ] **Claude (after T094b)** — T094c main bootstrap + T028a lines_json migration (folded together per Slice 2 prep audit decision).

---

## Slice 1 closeout — T111 / T112 human smoke checklist

**Status:** T028a + T094b + T094c merged to `main` 2026-05-28 (PR #276). The AD-2
finalize pipeline is live behind the `sale_finalization` flag. The remaining
`[HUMAN]` smokes below are the last gate before Slice 1 sign-off (T113).

**Who runs this:** a human on a Windows dev machine (these cannot be run by an
agent — they need a real Electron dev build + manual UI interaction).

### Dev launch — three env vars

The build must be **unpackaged** (`app.isPackaged === false`, i.e. `npm run dev`)
and all three flags truthy (`1` / `true` / `yes` / `on`):

| Env var | Effect |
|:--|:--|
| `POS_PULSE_FEATURE_SALE_FINALIZATION` | Turns on the 008 worker + `sales.*` bridge. Fail-closed default is OFF. |
| `POS_PULSE_DEV_SKIP_PAIRING` | Seeds the fixture pairing row (`dev-tenant` / `dev-branch` / `dev-terminal` / label `Dev Terminal`) so the renderer routes past `/pairing`. |
| `POS_PULSE_DEV_SKIP_OPERATOR_SIGNIN` | Seeds a fixture `manager` session (`dev-tenant` / `dev-branch`) so the renderer routes past `/sign-in`. |

PowerShell one-liner (run from the repo root; type it with the `!` prefix in the
Claude prompt or paste into a terminal):

```powershell
$env:POS_PULSE_FEATURE_SALE_FINALIZATION='1'; $env:POS_PULSE_DEV_SKIP_PAIRING='1'; $env:POS_PULSE_DEV_SKIP_OPERATOR_SIGNIN='1'; npm run dev
```

**On a successful boot, expect this main-process log line** (proves the worker
started against the fixture scope):

```
finalize_listener:started   { terminal_id: "dev-branch" }
```

> Note the `terminal_id` logs as **`dev-branch`**, NOT `dev-terminal`. That is the
> intended F-007 alignment: 006 stamps `originating_terminal_id = session.branch_id`
> into the `payment.settled` audit row, so the AD-2 scan is scoped to `branch_id`.
> If you instead see `dev-terminal` here, the F-007 fix regressed and the smoke
> will silently finalize nothing — stop and report.

### Inspecting the SQLite DB

The dev DB lives at the Electron `userData` path:

```
%APPDATA%\pos-pulse\pos-pulse.db
```

(i.e. `C:\Users\<you>\AppData\Roaming\pos-pulse\pos-pulse.db`). Open it read-only
with any SQLite viewer (DB Browser for SQLite, or `sqlite3` CLI). **Tip:** to
start each smoke from a clean slate, close the app and delete this file before
launching — migrations re-create it on boot.

---

### T111 — happy-path finalization

**Goal:** a cash-only 006 settlement produces a durable Sale.

1. Launch with the three env vars above; confirm the `finalize_listener:started`
   log line shows `terminal_id: "dev-branch"`.
2. In the POS UI, build a cart with ≥ 1 item, hand it off to payment, choose
   **Cash**, tender ≥ the subtotal, and **Confirm** the payment (006 settles it →
   writes a `payment.settled` audit row).
3. Within ~1 second (the worker ticks every 200 ms), the AD-2 worker should
   finalize. Watch for the main-process log:
   `finalize_dispatch:finalized   { handoff_action_id: "...", kind: "finalized" }`
4. Query the DB and assert:

   ```sql
   -- exactly one sale row for the settlement
   SELECT sale_number, receipt_number, subtotal_minor, total_change_due_minor,
          selling_operator_display_name, lines_json
     FROM sales ORDER BY finalized_at DESC LIMIT 1;

   -- one outbox row in 'pending' state, FK'd to that sale
   SELECT state FROM sale_sync_outbox ORDER BY enqueued_at DESC LIMIT 1;

   -- the sale.finalized audit event was emitted
   SELECT action_category FROM audit_events
    WHERE action_category = 'sale.finalized' ORDER BY created_at DESC LIMIT 1;
   ```

   **Pass criteria:**
   - [ ] `sale_number` matches `Dev Terminal-<YYYY-MM-DD>-000001` (the AD-7 format;
     `<YYYY-MM-DD>` is the **UTC** date of `settled_at` — see the v2 caveat below).
   - [ ] `receipt_number === sale_number` (008 v1 invariant).
   - [ ] `selling_operator_display_name` is the fixture manager's name (proves the
     persist-at-settlement plumbing — it came from the audit payload, not a live
     session lookup).
   - [ ] `lines_json` is a non-empty JSON array matching the cart's items.
   - [ ] exactly one `sale_sync_outbox` row, `state = 'pending'`.
   - [ ] exactly one `sale.finalized` audit row for this settlement.
   - [ ] a second cash sale on the same day allocates `...-000002` (monotonic).

> **v2 caveat (not a failure):** `local_calendar_day` / the date in `sale_number`
> uses **UTC**, not Egypt local time. A sale after ~22:00 Cairo time will show the
> next UTC day. Sale numbers stay unique + monotonic; only the day-bucket label is
> affected. Tracked as the documented `localCalendarDayFor` v2 item.

---

### T112 — crash-recovery finalization

**Goal:** a settlement whose finalize was interrupted is recovered on the next
boot by the startup recovery scan.

1. Launch with the three env vars. Build a cart and confirm a **Cash** payment
   so 006 writes a `payment.settled` row.
2. **Immediately kill the process** before the worker's next tick finalizes it
   — the tightest window is to confirm payment and kill within ~200 ms. To make
   this reliable, temporarily widen the window: set the worker tick slow by
   editing the `tickIntervalMs: 200` in `src/main/index.ts` to e.g. `5000` for
   this smoke (revert after), OR kill fast. Either way, after the kill, verify
   the DB has the `payment.settled` audit row but **no** matching `sales` row:

   ```sql
   SELECT COUNT(*) AS settled FROM audit_events WHERE action_category='payment.settled';
   SELECT COUNT(*) AS sales   FROM sales;
   -- expect settled >= 1 and sales = 0 (the interrupted state)
   ```
3. **Relaunch** with the same three env vars. On boot, `runStartupRecovery()`
   runs, then the steady-state worker's first tick picks up the orphaned
   `payment.settled` row (its `NOT EXISTS sales` clause matches) and finalizes it.
4. Query again:

   ```sql
   SELECT sale_number, envelope_handoff_action_id FROM sales ORDER BY finalized_at DESC LIMIT 1;
   ```

   **Pass criteria:**
   - [ ] after relaunch, a `sales` row now exists for the interrupted settlement.
   - [ ] its `envelope_handoff_action_id` matches the `handoff_action_id` in the
     pre-kill `payment.settled` audit payload (the idempotency anchor).
   - [ ] re-confirming nothing: only **one** sale row exists (no double-finalize).
   - [ ] (remember to revert the `tickIntervalMs` edit if you made one.)

---

### T113 — Slice 1 sign-off (after T111 + T112 pass)

Record the result below: reviewer, date, outcome (`pass` / `pass-with-notes` /
`fail`), the observed `sale_number` from T111, and confirmation that T112
recovered. Then tick T111/T112/T113 in `tasks.md` and flip the 008 banner in
`CLAUDE.md` to "Slice 1 ✅". §A2 no-op + §A3/§A4 sign-offs are already
cross-referenced above.

**Sign-off:** _[reviewer]_ · _[date]_ · _[outcome]_ · sale_number observed: _____ · T112 recovered: _____


---

## T173 `/impeccable craft` red-bar record (2026-05-28)

Per `docs/impeccable-embed-preflight.md §4.2`, the `<ReceiptPreview>` failing
tests are written and confirmed RED before invoking the craft skill:

- File: `tests/unit/renderer/receipts/ReceiptPreview.test.tsx`
- Status: **RED** — `Test Files 1 failed (1) · Tests no tests` (component
  `src/renderer/ui/receipts/ReceiptPreview.tsx` does not yet exist; import fails).
- Covers T150 (renders preview HTML, role=img canvas, bilingual title + close,
  error state), T151 (non-modal dialog, onClose without confirm), T152 (Escape
  closes, axe-clean default state), + production `window.api.receipts` fallback.
- Shape brief: visual-direction/README.md §(d) `<ReceiptPreview>` UI panel.
- Scope note: the §(d) "Print" button calls `receipts.print` (AD-2 listener
  side-effect, Slice 3) — in S2 the Print affordance renders but its action
  wires in Slice 3; the S2 craft delivers the preview render + close + a11y +
  loading/error states.

Craft invoked immediately after this record.

---

## Slice 2 closeout — receipt payload + engine + preview (2026-05-28)

Code complete on `feat/008-slice2-receipts` (PR pending). T120–T173 + T180 done;
**T181 (human dev-fixture smoke) + T182 (sign-off) remain** — like T111/T112,
they need a packaged dev build run by a human.

**Built (TDD throughout):**
- T164 `receipts-payload.ts` — pure derivation from the Sale row (parses
  `lines_json` + tender summary; FR-015 — no cart re-read / catalogue / voucher).
- T160 `template-engine.ts` — AD-6 single-source dual-output via compose→Band[]
  →{toEscPos,toHtml}. Byte-stable + preview≡first_print structural (FR-016).
- T130–134 minimisation — engine reads only typed fields; no card/voucher data
  reaches the slip across the tender mix.
- T140–142/T170–172 `receipts.preview` bridge + IPC + preload (read-only, no
  side effects, tenant-scoped, forbidden-field guard). Registered
  unconditionally in index.ts (T094c registration-timing lesson).
- T173 `<ReceiptPreview>` via `/impeccable craft` against §A1 §(d) (red-bar
  recorded above). Non-modal dialog, role=img canvas, bilingual title + 44×44
  close, Zoom 2×, loading/error states, Escape-closes, axe-clean. RTL
  logical-properties. 18 tests incl. race-guard + a11y.

**v1 subset decisions (Ahmed 2026-05-28, slice2-mapping-pass.md):**
- item names: single `display_name` (bilingual ar/en → v2, catalogue dep);
- shift line: omitted (→ v2, sales↔shift link);
- VAT: driven by `total_tax_minor`; "14%" rate label suppressed at tax=0;
- `local_calendar_day`/timestamps: UTC (terminal-TZ → v2).

**Deviations:** T161/T162/T163 satisfied in-code (compose variant branches),
not as separate `.template` asset files (R-6 rejects the parsed-asset
indirection). T173 "Print" button is a disabled placeholder — its
`receipts.print` action lands in Slice 3.

**Validation:** typecheck ✓ · lint ✓ · full suite 3904 passed / 3 skipped ·
per-file ≥95% on engine/payload/bridge, ≥90% on the preview UI.

---

## Slice 4 close-out — drawer-kick + drawer-failure banner (2026-05-29)

Code-complete across a **stacked set of 5 PRs** (drawer-kick main-side + the
drawer-failure banner + the coexistence-contract precursor + the clear-path +
the pre-existing-lint fix). **Human dev-build smoke (the §A3 hardware tests
T371/T372/T373) + functional sign-off (T374) remain** — like T111/T112/T181,
they need a real Epson TM-T20III + APG VBS320 pair, deferred to the T200 bring-up.

### PR stack + merge order

Merge **#287 → #285 → then #286 ∥ #288 ∥ #289** (rebase each onto `main` as its
predecessors land). All five currently fail CI **only** on the inherited
`sales-bridge.ts:351` lint error that #287 fixes; once #287 merges + the others
rebase, CI clears.

| PR | Scope | Base | Tasks |
|:--|:--|:--|:--|
| **#287** | Pre-existing `main` lint break (`no-unnecessary-condition` on the `subscribe` topic branch) — `satisfies` exhaustiveness anchor. **Merge first.** | `main` | — |
| **#285** | `BannerState` union → **coexistence record** `{ printer_failure\|null; drawer_failure\|null }` + `last_successful_open_at`. | `main` | (contract precursor) |
| **#286** | **S4a** drawer-kick pipeline. | `main` | T310–T352 |
| **#288** | **S4b** `<DrawerFailureBanner>` + `useDrawerBannerState` + AppShell mount + `formatRelativeTime`. | #285 | T330/T331/T332/T360/T361 |
| **#289** | **S4c** drawer banner clear-path (hardware-recovery). | #285 | (clear-path) |

> **Post-merge correction (2026-05-29):** the stacked-base approach above hit a
> GitHub footgun. #285 + #286 merged to `main` cleanly. But #288 + #289 had been
> merged **into the #285 branch** (their base), not `main`; when #285
> squash-merged, their commits were stranded on the orphaned #285 branch and
> never reached `main` — GitHub still marked #288/#289 "MERGED" because their
> base branch merged. The S4b + S4c content was **re-landed via fresh PRs based
> on `main`**: **#288 → re-landed as #290**, **#289 → re-landed as #291** (the
> identical deltas `e0acedc` / `5b8eb05` re-applied onto current `main`).
> **Lesson:** never merge a PR whose base is another open PR's branch and expect
> a later squash of that base to carry it — squash flattens only the commits
> present when the base PR merged. Land dependent PRs against `main` after the
> base merges.

### Decisions recorded this slice (Ahmed)

1. **Coexistence record (2026-05-29).** Both banners may be on screen at once
   (T330/T361/NFR-008). The merged-T291 single-kind union silently hid a
   concurrent drawer failure behind a printer failure — a silent-failure
   regression (PRODUCT.md Principle 3). Each banner reads its own slice.
2. **Manual-override = required-prop stub (2026-05-29).** The drawer banner's
   only affordance is Manual receipt, wired to a required `onManualOverride`
   prop the host passes as a placeholder (real `receipts.manualOverride` is
   Slice 6 / T512). Mirrors the printer banner's `enabled⟹wired` posture.
3. **Clear-path = hardware-recovery (2026-05-29).** A failed drawer row can
   never be superseded on its own sale (UNIQUE(sale_id) + no retry-kick,
   FR-053), so the banner clears when a later `opened` drawer event on the same
   terminal proves the drawer recovered. Per-sale-via-manual-override was
   re-surfaced + rejected: it would be INERT in v1 (nothing writes a
   `manual_override` print event until Slice 6). A Slice-6 per-sale clear can
   compose on top later.
4. **Retry-success drawer attribution = retrying operator (2026-05-29).**
   Confirmed the deliberate asymmetry: an auto-fired first-print drawer event
   attributes to the SELLING operator; a retry-success drawer event to the
   retrying operator. Both = "the operator who caused this kick" (FR-052 +
   FR-022/FR-023).

### Honest-stub posture (carried from Slice 3)

The composition root wires the drawer-kick with a **STUB transport** reporting
`no_drawer_configured` (NOT a faked `opened`) until the T200 §A3 bring-up swaps
the real `node-thermal-printer` `openCashDrawer()` transport. Until then every
dev cash sale records a clean `failed` drawer row + raises the drawer-failure
banner while the Sale stays durable — same posture as Slice 3's `printer_offline`
stub.

### Adversarial review (Opus, PRs #285/#286/#287)

Verdict **Warning — no CRITICAL, no security/redaction breach**. Redaction,
tenant-scoping, the union→record migration, the silent-failure guard, and FR-024
retry attribution all verified clean. Fixes applied: [HIGH] extracted
`record{Suppressed,Opened,Failed}` helpers (50-line ceiling); [MEDIUM] flagged
the readBySale→kick→insert TOCTOU physical-double-kick for the T200 transport
(serialize per sale_id then); [LOW] FR-024→FR-052 citation; [LOW] plan.md §AD-8
"OR reprint" stale text dropped; [LOW] #287 `satisfies` idiom. Deferred (flagged):
`findLastSuccessfulOpenForTerminal` terminal-only scoping (Slice 1 territory;
consistency nit, not a leak).

### Remaining before Slice 4 fully closes

- [ ] **T370** — coverage assertion ≥95% drawer-kick logic / ≥90% banner (per-file
      confirmed green locally on each branch; re-assert on the merged stack).
- [ ] **T371 / T372 / T373** — §A3 hardware integration (cash-success / drawer-
      disconnect-failure / cashless) on the real pair. Deferred to T200 bring-up.
- [ ] **T374** — functional sign-off (this section + tasks.md checkbox flips).
      **Sign-off:** _[reviewer]_ · _[date]_ · _[outcome]_ · drawer-pop observed: _____
- [ ] **§A4 no-new-surface confirmation** — verified: no `src/preload/drawer.ts`,
      no `BridgeApi['drawer']`; the drawer pipeline is main-only (AD-5). The only
      renderer affordance is the banner's manual-override → `receipts.manualOverride`
      (a `receipts.*` handler, Slice 6).

---

## §A5 hardware smoke evidence (2026-05-30)

**Status:** Owner ran a first-pass hardware bench on a Windows machine and reported
device-level smoke results. These are recorded here as **observed evidence**, NOT as
§A3/§A5 sign-off. No tasks are marked complete by this entry: **T523 (hardware-matrix
completeness check) stays unchecked**, **T520a (perf-budget timing assertion) stays
unchecked**, and the Slice 3 / Slice 4 / Slice 5 §A3 hardware integration rows
(T301/T302, T371/T372/T373, T462) remain open. This is a pre-bring-up evidence log,
not the T200 §A3 bring-up.

> **Smoke ≠ tested.** Per [docs/hardware-matrix.md](../../docs/hardware-matrix.md)
> operational rule 1, promoting a model to a *tested* row requires both the matrix row
> AND an integration test exercising the device. Neither device below has its
> integration test yet, so both are logged as **OBSERVED (not promoted to tested)** in
> the matrix's *Known caveats* column.

### Observed hardware

| Category | Observed model | Smoke result | What is NOT yet verified |
|:--|:--|:--|:--|
| Receipt printer | **BIXOLON SRP-330 II** | Driver **installed**; **Windows OS test page printed successfully**. **Browser/HTML receipt-template smoke passed** (2026-05-30). **✅ Official OS-print-pipeline smoke PASSED (T301, 2026-05-30)** — see §"T301 OS-print bench result" below: a real 008 receipt printed from the official POS-Pulse OS-print pipeline (`webContents.print`, PR #304); Arabic + English legible, no card/voucher data, clean feed/cut, body width tuned to 70 mm to clear edge clipping on the 80 mm roll. Best observed driver paper setting: **80 × 3276 mm continuous roll**. | **OS-print pipeline now exercised (T301 ✅).** Still PENDING/unverified: **ESC/POS direct path** (not selected; OS-print is the proven path), the **rule-1 integration test** for promotion to a *tested* row, the **§A3 hardware-matrix record / sign-off** (T200/T301/T302 doc rows), and the **owner hardware-target decision** (Option A/B). |
| Barcode scanner | **HONEYWELL HF680-RS-01 REV B** | **General scan smoke passed** (device emits scan data) AND an **in-POS screen scan smoke passed** — scanner data was captured inside the POS screen (2026-05-30). | **Wedge-into-cart *integration test* — PENDING** (manual in-POS capture is observed evidence, not the rule-1 integration test required for promotion); transport mode (wedge-HID vs the `-RS` RS-232 variant) — **to be confirmed** (scope is wedge-HID-only) |
| Cash drawer | _none observed_ | — | **Drawer model unconfirmed**; **drawer-kick (DK1 pulse) test PENDING** |

### Divergence from the §A3-committed pair — flagged for owner

The §A3 hardware-matrix thread (T006, closed 2026-05-26, PR #258) committed
**Epson TM-T20III** + **APG VBS320** as the Slice 3 / Slice 4 bring-up target and the
T520a perf-budget pair. The bench hardware observed on 2026-05-30 is **different**:
BIXOLON SRP-330 II (printer — OS test page + browser/HTML receipt-template render both
printed; best driver paper setting 80 × 3276 mm continuous roll; **not** the official
POS print pipeline, which is still on pre-T200 stub transports) + HONEYWELL
HF680-RS-01 (scanner — OS-level scan + in-POS screen scan smoke both passed), with no
cash drawer present. This entry records the observed hardware **alongside** the
committed target;
it does **not** change the committed §A3 target, the ticked §A3 pair-selection item,
or any gate label. **Owner decision needed:** whether the §A3 bring-up target moves to
the bench hardware (which would require a fresh hardware-matrix pair commitment + a
cash-drawer model), or the committed Epson/APG pair is procured for the T200 bring-up.

### Manual smoke checklist — next local run

Run on a Windows dev build (`npm run dev` with the three 008 env vars per
§"Slice 1 closeout — T111 / T112 human smoke checklist" above). This is a
human-only run; record outcomes, and attach screenshots/logs for any failure.

1. **Scan a barcode into the cart/search input** — focus the cart search field and
   scan a known product barcode on the HONEYWELL HF680-RS-01.
2. **Confirm item lookup/add behavior** — the scanned code resolves to a product and
   adds (or surfaces a not-found message); no stray characters leak into other fields.
3. **Build a cart** — add ≥ 2 line items (mix scan + manual where possible).
4. **Hand off to payment** — the cart hands off cleanly to the 006 payment surface.
5. **Complete payment** — tender a **Cash** payment ≥ subtotal; 006 settles it.
6. **Finalize the sale** — the AD-2 worker finalizes (durable `sales` row; observe the
   `finalize_dispatch:finalized` log; sale number format `<terminal_label>-<YYYY-MM-DD>-NNNNNN`).
7. **Print the actual POS receipt on the BIXOLON SRP-330 II** via the OS print path —
   confirm the printed slip matches the preview (bilingual RTL layout, sale number,
   VAT footer, no card/voucher data).
8. **Reprint the receipt** — confirm the duplicate-copy marker
   ("نسخة طبق الأصل — DUPLICATE COPY") appears on the reprint and NOT on the first print.
9. **Record failures** — capture any failure with screenshots and/or the relevant
   main-process log lines; note the device, the step, and the observed vs expected
   behavior here.

> Note: steps 7–8 depend on the **official POS receipt-pipeline print** being wired.
> As of 2026-05-30 `main` uses **pre-T200 stub transports**, so the only printing
> exercised so far is the OS test page and a **browser/HTML render of the
> template-engine output** — NOT the official pipeline. The real POS-pipeline print
> (OS-print path) becomes available once **T200** wires a real OS-print or ESC/POS
> adapter; until then steps 7–8 cannot exercise the official pipeline. The **ESC/POS
> direct path** and the **cash-drawer kick** are out of scope for this checklist —
> they require the §A3 hardware bring-up (T200) and a confirmed drawer model, and
> remain unverified.
>
> BIXOLON driver paper setting for step 7: use **80 × 3276 mm continuous roll** (best
> observed cut/feed behavior; short fixed forms such as 80 × 287 mm may feed excessive
> blank paper).

### T301 OS-print bench result (2026-05-30 — observed evidence, NOT a §A3 sign-off)

The real OS-print transport landed in **PR #304** (`feat(008): wire real OS-print
transport`) — `src/main/receipts/os-print-transport.ts` drives a genuine
`webContents.print` through a secure offscreen window; the main bootstrap routes
the print pipeline to the OS-print path (`probeEscposSupport: false`). With that
build, the owner ran the bench smoke on the BIXOLON SRP-330 II:

**Hardware / flow:**
- Printer: **BIXOLON SRP-330 II**, Windows default printer; driver paper **80 × 3276 mm continuous roll**.
- Dev bypass for pairing/operator + `POS_PULSE_DEV_ITEM_RESOLVER=1`; cart + payment driven through the official POS-Pulse bridges; `payments.confirm` returned `ok`.
- **A real 008 slip printed from the official POS-Pulse OS-print pipeline.**

**Result (after two CSS tuning passes — printable-area only, no content/template change):**

| Check | Result |
|:--|:--|
| Slip physically printed (official OS-print pipeline) | ✅ yes |
| Blank slip | ✅ no |
| Arabic legible | ✅ yes |
| English legible | ✅ yes |
| No card / voucher data on the slip | ✅ confirmed |
| Feed / cut acceptable; no excess blank feed | ✅ yes |
| Darkness | ✅ acceptable (after `color:#000` + heavier base weight) |
| Edge clipping | ✅ resolved at **70 mm** printable body width (73 mm clipped) |

**Tuning recorded:** `pageSize` stays **80 mm** (physical roll); printable body
`RECEIPT_BODY_WIDTH = 70 mm`, centred, for a horizontal safety margin; pure-black
text + heavier font-weight for thermal darkness (no ESC/POS density on the
OS-print path). All in `wrapReceiptDocument`; covered by unit tests.

**Still open (this result changes NO gate):**
- **ESC/POS direct path** — not selected, **unverified**.
- **Cash drawer** model + **drawer-kick** — PENDING.
- **§A3 hardware-matrix record + sign-off** (T200 doc rows / T301 / T302) and the
  **owner hardware-target decision** (Option A BIXOLON vs Option B committed
  Epson/APG) — still OPEN.
- Promotion to a *tested* row still needs the rule-1 integration test.
- **T523 / T520a / T529 remain OPEN.**

## T521 — Runtime redaction assertion (2026-05-30)

T521 has two halves. The **runtime assertion** is now done; the **support-bundle
export-tool audit** is recorded N/A (no such tool exists yet). T521 is therefore
upgraded from PARTIAL (static-only) but is **not** ticked complete — see below.

### 008 runtime sink map (verified against as-built code)

The redaction surface T521 must cover, by sink:

| Sink | 008 call-sites | What is emitted |
|:--|:--|:--|
| **pino** (`logger.ts`, real `REDACTION_PATHS`) | `print-dispatcher.ts:220/249`, `os-print-transport.ts:235/237`, `drawer-kick.ts:169/186/218/241` | Structured `{msg, sale_id, print_event_id, failure_reason}` only — **never a payload object**. |
| **console** (bypasses pino) | `finalize-listener.ts:284` `console.error('…', err)` | A static string + the caught `err`. The ONE pino-bypass surface. **Instrumented, NOT exercised** by the T521 test — a console spy is installed and asserted empty for the driven dispatchers (catches a future `console.*` added inside them), but the test does NOT drive the finalize-listener tick-failure path that fires line 284. Residual risk low: `runTickOnce` operates on already-persisted `sales` rows whose forbidden fields were refused at finalize-time. Driving that path is a follow-up if the owner wants full console coverage. |
| **audit_events** | `audit-emitter.ts` (refuses `FORBIDDEN_PAYLOAD_KEYS`); finalize refusal emits a fixed-shape `sale.finalization_refused` payload built field-by-field | Covered by the emitter's own refusal unit tests. |
| **Sentry** | **none** in 008 dirs (`src/main/{sales,receipts,drawer,sync-outbox}`) | data-model.md §Forbidden-fields says the refusal "logs a high-severity event (Sentry capture)"; the **as-built refusal path emits ONLY through `auditEmitter.emitSaleFinalizationRefused(...)`** with a safe fixed payload — no direct 008 Sentry call. The doc's "Sentry capture" phrasing is aspirational; global `beforeSend`/`isForbiddenSentryKey` is the defence-in-depth net. |

### Runtime assertion — ✅ DONE

`tests/integration/sales/t521-runtime-redaction.test.ts` drives the **real**
print + drawer dispatchers (first-print success, print failure, drawer
opened/suppressed/failed) through the **real** `createLogger` pino instance
(captured via an injected PassThrough) plus a `console` spy (asserted empty for
the driven dispatchers — see the console-surface caveat in the sink table above),
then:

1. asserts no known sentinel **value** survives the captured output, and
2. parses every NDJSON record and asserts no `FORBIDDEN_PAYLOAD_KEYS` entry
   appears as an object **key** at any depth (catches a key deeper than pino's
   4-level `*.*.*.key` redact paths).

**Result: GREEN — and green is the correct result.** This is a regression
**tripwire**, not a transformation proof: 008's dispatchers log only structured
non-payload fields, so nothing forbidden is emitted today. A **positive control**
in the same file injects a `pan` key at depth 5, confirms it survives redact AND
that the scanner flags it (the tripwire fires) — proving the harness is not
vacuous. Non-vacuity is further guarded by asserting the expected event
categories (`sale.receipt.printed`, `sale.drawer.{opened,suppressed,failed}`)
DO appear in the captured stream.

**Scope limitation (deliberate, recorded honestly):** T521 is a key-name/value
audit. The test does NOT scan for forbidden *cleartext* under innocently-named
keys — that is beyond what T521 specifies and beyond what the harness can
validate. The finalize-time forbidden-field guard (`finalize-transaction.ts`,
`findForbiddenKey` over `FORBIDDEN_PAYLOAD_KEYS`) already refuses such fields at
the 006→008 boundary, so they never enter an 008 object in the first place.

### Support-bundle export-tool audit — N/A (no tool exists)

Constitution **§P11** requires "support-bundle export tooling MUST run the same
redaction pipeline as the on-disk log writer." Searched `src/` — **there is no
support-bundle / log-export / diagnostic-bundle tool in the codebase** (the only
matches are *comments* in `cart-bridge.ts:214` and `sales-bridge.ts:373`
referencing the concept). The audit cannot pass-or-fail a tool that does not
exist. **Recorded requirement:** when the support-bundle exporter is built (a
future feature), it MUST route through `REDACTION_PATHS` / the same pino redact
config — and a runtime assertion like this one MUST extend to cover it.

### Net status

- Runtime assertion: ✅ done (test merged this slice).
- Support-bundle audit: N/A — no tool to audit; forward requirement recorded.
- **T521 stays OPEN as a checklist item** until the owner accepts the
  support-bundle half as N/A-by-absence. The agent does not self-tick it; this
  is the reviewer's call. (T529 §A5 sign-off remains human-gated regardless.)

## Owner decision — 008 §A5 hardware target (2026-05-30, Ahmed)

> **Provenance.** Owner (Ahmed) decision delivered 2026-05-30, resolving the
> §A3 hardware-target divergence flagged in PR #301 and in §"Divergence from the
> §A3-committed pair" above. This record is **append-only**: it does NOT rewrite
> the 2026-05-26 §A3 hardware-matrix sign-off (Epson TM-T20III + APG VBS320, see
> §"§A3 hardware-matrix coordination thread (T006)"). That committed pair is
> **superseded for the 008 MVP** by the decision below; it remains on record.

**The decision, verbatim (five points):**

1. 008 MVP **will not block on cash-drawer hardware**.
2. Cash-drawer / DK1 drawer-kick **hardware validation is deferred** to a future
   hardware/peripheral spec.
3. 008 §A5 hardware target is **printer-only** for receipt finalization, using
   **the current bench printer** (BIXOLON SRP-330 II — "Option A").
4. **Scanner** model is recorded as **observed/tested for wedge input only**, not
   as native-SDK integration.
5. **ESC/POS direct path is deferred**; the **OS-print path is the accepted 008
   print path**.

### What this resolves (scope / judgment sub-items — now settled)

- **Option A vs B — RESOLVED → Option A (BIXOLON SRP-330 II).** The §A3-committed
  Epson/APG pair is superseded for 008 MVP. (§A3 record itself is unchanged.)
- **Drawer / DK1 — DESCOPED from 008.** The drawer-kick *code* (`drawer-kick.ts`,
  `DrawerFailureBanner`, the `drawer_events` table) stays — it is built, 100%
  covered, and merged. Only the **hardware validation** of a physical drawer
  defers to the future peripheral spec. T523's drawer row and any drawer-perf
  portion of T520a are removed from 008's §A5 scope.
- **ESC/POS — DESCOPED; OS-print accepted.** Matches the as-built routing
  (`probeEscposSupport: false` at the composition root; the real path is
  `os-print-transport.ts` via `webContents.print`). "ESC/POS direct path
  unverified" is **no longer a §A5 gap** for 008.
- **Scanner — bounded to wedge-HID observed/tested only.** No native-SDK
  integration is in 008 scope.

### What this does NOT resolve (evidence sub-items — STILL OPEN)

The decision narrows *what is in scope* to printer-only/OS-print. It does **not**
state whether the existing 2026-05-30 BIXOLON bench smoke (see §"T301 OS-print
bench result") **satisfies the evidence bar**. Those are different questions, and
the owner has not (yet) spoken to the bar. Therefore:

- **T520a — STILL OPEN (re-scoped).** Drawer perf is removed; what remains is a
  **printer-only OS-print p95 run, ≥20 iterations through the official pipeline**.
  The T301 run was device-level smoke — no p95 timings captured. Re-scoping does
  not produce the numbers.
- **T523 — STILL OPEN (re-scoped).** The drawer row is descoped. The **printer
  row** is still logged **OBSERVED, not tested** — promotion to a *tested* row
  needs the hardware-matrix rule-1 evidence. CI has no real hardware, so whether
  the bench smoke clears this bar is inherently an **owner-accepts** call.
- **T529 — STILL OPEN (human sign-off).** Waits on the bar answer above plus
  T512 (craft) and T526 (security review).

### Open question for the owner (the bar question)

> Does the 2026-05-30 BIXOLON OS-print **bench smoke** (Arabic+English legible,
> 70 mm body, clean feed/cut, no card/voucher data, official OS-print pipeline)
> **satisfy** the **T520a perf bar** and the **T523 printer "tested" row** — or do
> you still want a **≥20-run p95 capture** through the official pipeline before
> those two gates close?

Until that is answered, T520a and T523 remain OPEN (re-scoped to printer-only).
The agent does not assume the bench smoke clears the bar.
