---
description: "Task list for 008-sale-finalization-and-receipts — startable, file-path-bearing, slice-organised against plan v1.0; produced by /speckit-tasks 2026-05-27"
---

# Tasks: 008-sale-finalization-and-receipts

**Feature:** 008-sale-finalization-and-receipts — Sale Finalization & Receipts
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0 (AD-1..AD-12 locked 2026-05-27)
**Research:** [./research.md](./research.md)
**Data model:** [./data-model.md](./data-model.md)
**Contracts:** [./contracts/bridge-api.md](./contracts/bridge-api.md) (DRAFT — §A4 review required)
**Quickstart:** [./quickstart.md](./quickstart.md)
**Visual direction:** `specs/008-sale-finalization-and-receipts/visual-direction/README.md` (to be produced in Slice 0 under §A1)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-27
**Last updated:** 2026-05-28 (eight passes total: (1) initial generation by `/speckit-tasks` 2026-05-27; (2) `/speckit-analyze` remediation 2026-05-27 — added T520a perf-budget + T403a receipt-number-invariance, tightened T522 Sentry decision-tree; (3) CodeRabbit review response 2026-05-27 — rewrote T052/T090/T092 against the AD-2 v3 polling worker per CR1, fixed FR-055 audit-category mismatch per CR2 + R2 cleanup, added `issuer_name` + `pin_record_id` to forbidden-fields per CR3, reconciled 187-vs-185 count per CR4; (4) S1c.3 closeout-gap response 2026-05-28 — added T094a/T094b/T094c between T093 and T100 to bridge the 4-field upstream gap; marked T111/T112/T113 as BLOCKED-BY T094c; total task count 187 → 190; Phase-3 count 47 → 50; (5) Backend-coordination blocker on T094a recorded 2026-05-28 — marked T094a/T094b/T094c with explicit [BLOCKED-BY ...] tags; Ahmed owns the backend OpenAPI PR that unblocks T094a; see coordination.md §"Backend-coordination blocker on T094a"; (6) Slice 2 prep audit recorded 2026-05-28 — added T028a (migration 0027 + finalize-transaction/dispatch-projection updates for line-snapshot persistence per FR-015 byte-stable reprints; Ahmed's Option A decision); total task count 190 → 191; Phase-3 count 50 → 51; see coordination.md §"Slice 2 prep audit: line-snapshot persistence"; (7) Slice 3 prep audit recorded 2026-05-28 — T094a description expanded to cover six fields (added `printer_vendor_id`/`printer_product_id`/`printer_com_port` to the existing three branch/tax-reg fields per Slice 3 Q1 decision); no new T-IDs; total task count unchanged at 191; see coordination.md §"Slice 3 prep audit: print pipeline upstream gaps"; (8) Correction to passes (5) + (7) recorded 2026-05-28 — the "BLOCKED-BY backend (Ahmed owns)" framing on T094a was wrong; corrected to "BLOCKED-BY Data-Pulse-2 contract slice + POS-Pulse pin" since the OpenAPI snapshot is speculative per research §5 and contract authoring is Claude-doable in Data-Pulse-2; see coordination.md §"Correction (2026-05-28, post-PR #270 author-time discovery)").
**Status:** **Slice 0 ✅ complete 2026-05-26** · **§A1 ✅ + §A3 ✅ + §A4 ✅ all signed 2026-05-26 (PRs #255/#256/#257 authored 2026-05-26, merged 2026-05-27); hardware-matrix committed (PR #258); printed-slip (a)/(b)/(c) authored (PR #259)** · **Slice 1 (load-bearing) STARTABLE — no remaining human-action gates; sequential implementation from S1 → S6** · **§A5 ✅ SIGNED OFF (caveated) 2026-05-30 (T529, PR #314) — production-readiness gate; never a slice-merge blocker**
**Embed:** `[IMPECCABLE shape|craft|polish]` markers on T010 / T173 / T290 / T360 / T450 / T512 delegate UI direction and polish to the `/impeccable` skill per `docs/impeccable-embed-preflight.md §4`. Pre-craft red-bar check (per `docs/impeccable-embed-preflight.md §4.2`) is mandatory before invoking any craft marker.

---

## Conventions

- **Format:** `- [ ] **T0NN** [P?] [USn?] [§Ag?] Description with file path — path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on incomplete tasks).
- **`[US1]`** maps the task to the spec's single Primary User Story (008 has one primary story plus 14 acceptance scenarios; per-scenario coverage is locked into the slice phases themselves rather than into separate US labels).
- **`[§A3]`** / **`[§A4]`** / **`[§A5]`** tag the gate that must clear before the task is startable.
- File paths are repository-relative (e.g., `src/main/sales/finalize-listener.ts`).
- TDD pairing: every implementation task is preceded by a failing test task referencing the same module area (Constitution §VI).

---

## Locked decisions (informational — do not re-open)

| Decision | Locked value | Source |
|:--|:--|:--|
| AD-1 — Finalization ownership | Main process owns Sale row commit, receipt-payload generator, print pipeline, drawer-kick command, sync-outbox enqueue, audit emission. Renderer = preview / reprint / banner UI only. | plan §AD-1 |
| AD-2 — 006 → 008 signal | In-process main-side listener on 006's `payment.settled`; idempotency keyed on `envelope.handoff_action_id`. Startup recovery scan re-fires AD-2 for orphaned `payment.settled` rows with no matching `sales` row. | plan §AD-2; research §R-2 / §R-15 |
| AD-3 — Append-only at physical layer | `sales`, `print_events`, `drawer_events`, `sale_sync_outbox` all carry SQLite triggers denying UPDATE and DELETE. Stronger than spec FR-004's "rule level". | plan §AD-3; research §R-3 |
| AD-4 — Sub-entity tables | Three append-only sub-entities (`print_events`, `drawer_events`, `sale_sync_outbox`), not polymorphic. Plus `sale_number_sequences` (mutable, AD-7 allocator). | plan §AD-4; research §R-4 |
| AD-5 — Bridge namespaces | `sales.*` (read-only from renderer) + `receipts.*` (mutating). **No renderer-callable `drawer.*` surface.** | plan §AD-5; contracts/bridge-api.md |
| AD-6 — Receipt template engine | First-party single-source dual-output engine at `src/main/receipts/templates/`; emits ESC/POS bytes + HTML/canvas from one bilingual template asset. Three variants: `first_print` · `reprint_duplicate` · `preview`. | plan §AD-6; research §R-6 |
| AD-7 — Sale-number scheme | `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>`, per-terminal per-calendar-day monotonic, calendar-day anchored on terminal local timezone. Allocator table `sale_number_sequences`. | plan §AD-7; clarifications 2026-05-27 |
| AD-8 — Drawer-kick mechanism | Separate ESC/POS DK1/DK2 pulse after print-success ack. **Embedded-in-receipt kick PROHIBITED** in 008 v1. | plan §AD-8; clarifications 2026-05-27 |
| AD-9 — Audit-event catalogue | Ten new categories under 004's existing `audit_events` table. No new audit table. | plan §AD-9; data-model.md |
| AD-10 — Reprint permission | Cashier-permitted with full attribution; no supervisor override. Mitigation = bilingual visible duplicate-copy marker (FR-029). | plan §AD-10; clarifications 2026-05-27 |
| AD-11 — Sync-handoff outbox | Enqueue-only, no flush. Single `sale_sync_outbox` row per finalized sale, written atomically with `sales` + audit row. | plan §AD-11 |
| AD-12 — OpenAPI / backend | **No new OpenAPI surface.** Zero backend calls in 008. §A2 no-op every slice. | plan §AD-12 |
| Per-line VAT | Out of scope. Sale-level VAT footer only; Sale row stores sale-level VAT total minor. | clarifications 2026-05-27 |

**Canonical audit action categories** (10; extending 004's catalogue under AD-9):

- **Sale-level (2):** `sale.finalized` · `sale.finalization_refused`
- **Receipt-level (5):** `sale.receipt.printed` · `sale.receipt.reprinted` · `sale.receipt.print_failed` · `sale.receipt.print_retried_success` · `sale.receipt.manual_override`
- **Drawer-level (3):** `sale.drawer.opened` · `sale.drawer.suppressed` · `sale.drawer.failed`

**Bridge handler canonical names** (from `contracts/bridge-api.md`):

- **`sales.*` (read-only; Slice 1 + 2):** `sales.read` · `sales.findByNumber` · `sales.subscribe` · `sales.unsubscribe`
- **`receipts.*` (mutating; Slices 2 / 3 / 5 / 6):** `receipts.preview` · `receipts.print` *(internal, main-process only)* · `receipts.reprint` · `receipts.retryPrint` · `receipts.manualOverride`
- **`drawer.*` — NO renderer-callable surface (Slice 4 main-process only).**

**Five new SQLite tables** (in migration order per `data-model.md §"Migration sequencing"`):

1. `sales` (header; append-only)
2. `print_events` (append-only; FK → `sales`)
3. `drawer_events` (append-only; FK → `sales`)
4. `sale_sync_outbox` (append-only; FK → `sales`)
5. `sale_number_sequences` (mutable; AD-7 allocator)

---

## Gate ledger

| Gate | Status | Blocks |
|:--|:--|:--|
| **§A0** — Upstream readiness + `/speckit-plan` v1.0 | ✅ Cleared (plan PR closes §A0); procedural lift on `/speckit-analyze` merge | Phase 1 (Setup) startable now |
| **§A1** — Visual direction Slice 0 | ✅ **CLEARED 2026-05-26** — Ahmed signed `approved` on `specs/008-sale-finalization-and-receipts/visual-direction/README.md`; `/impeccable shape=pass` recorded same event. (d) (e) (f) (g) approved verbatim; (a) (b) (c) printed-slip DEFERRED to follow-up commit before T173 craft fires (Slice 2 commission gate). All 6 brief follow-ups resolved by accepting defaults. See `coordination.md` §"§A1 sign-off (T011)". | Slices 1 / 3 unblocked by this gate (Slice 2 / 5 renderer craft additionally requires (a)/(b)/(c) authoring; Slice 1 has no renderer-craft tasks) |
| **§A2** — Backend / OpenAPI | ⛔ Held — **no-op for every 008 slice** confirmed by AD-12 | Documentation only (no-op sign-off recorded per slice) |
| **§A3** — Migrations | ✅ **CLEARED 2026-05-26** — Ahmed signed migration review `approved` (PR #256 authored 2026-05-26, merged 2026-05-27); ten-item scope checklist verified. Slice 1 §A3 migration tasks T020–T027 authorized. See `coordination.md` §"§A3 migration reviewer thread (T003)". | (gate now cleared; Slice 1 persistence unblocked) |
| **§A4** — Bridge-API surface | ✅ **CLEARED 2026-05-26** — Ahmed signed bridge-API security review `approved` (PR #257 authored 2026-05-26, merged 2026-05-27); eight-item §A4 security checklist verified. Slice 1 bridge handlers T100/T101 + all later slices' bridge work authorized. See `coordination.md` §"§A4 bridge-API reviewer thread (T004)". | (gate now cleared; Slice 1/2/3/5/6 bridge work unblocked) |
| **§A5** — Production readiness | ✅ SIGNED OFF (caveated) 2026-05-30 (T529, PR #314); was a rollout gate, not a slice-merge blocker | Production rollout only |

**Bottom line:** §A0 is functionally cleared and procedurally lifts when `/speckit-analyze` merges. Per-slice gates §A1/§A3/§A4 must each open before the corresponding slice's implementation tasks become startable. §A5 is rollout-time only.

---

## Path conventions

| Layer | Path |
|:--|:--|
| Main-process sales module | `src/main/sales/` |
| Main-process receipts module | `src/main/receipts/` |
| Main-process drawer module | `src/main/drawer/` |
| Main-process sync-outbox module | `src/main/sync-outbox/` |
| Receipt template assets | `src/main/receipts/templates/` |
| Shared types + bridge API | `src/shared/bridge-api.ts` · `src/shared/sales/` · `src/shared/receipts/` |
| Preload bridge | `src/preload/sales.ts` · `src/preload/receipts.ts` |
| Renderer receipts surface | `src/renderer/ui/receipts/` |
| Renderer store | `src/renderer/stores/sales-store.ts` |
| Migrations | `migrations/` |
| Unit tests (main) | `tests/unit/main/sales/` · `tests/unit/main/receipts/` · `tests/unit/main/drawer/` |
| Unit tests (shared) | `tests/unit/shared/sales/` · `tests/unit/shared/receipts/` |
| Unit tests (renderer) | `tests/unit/renderer/receipts/` |
| Integration tests | `tests/integration/sales/` |
| Contract tests | `tests/contract/sales/` |
| Visual direction | `specs/008-sale-finalization-and-receipts/visual-direction/` |
| Runbook | `docs/runbook/` |
| Hardware matrix | `docs/hardware-matrix.md` |
| Spec docs | `specs/008-sale-finalization-and-receipts/` |

---

## Phase 1 — Setup & Coordination (no source code)

**Purpose:** Confirm gate ownership, feature-flag configuration, slice-0 reviewer assignment, hardware-matrix coordination thread. No code, no migrations, no packages.
**Startable when:** `/speckit-analyze` merges (lifts §A0 procedural hold).

- [X] **T001** Create `specs/008-sale-finalization-and-receipts/coordination.md` from the 006 template; populate gate ledger, slice ownership, and current status (this PR closes §A0) — `specs/008-sale-finalization-and-receipts/coordination.md` *(CLOSED 2026-05-26 — coordination.md created; gate ledger + slice ownership + status table populated. See coordination.md change-log entry 1.)*
- [X] **T002** Confirm the `sale_finalization` feature flag exists in `src/shared/app-config.ts` (the per-feature flag map authored by 001 / 005 / 006) and is **disabled by default** in production; record the flag key + the renderer-store binding. If the flag does not exist yet, split into sub-tasks: (a) register `sale_finalization` in `src/shared/app-config.ts`, (b) extend `FeatureFlagsState` in the renderer store, (c) record the key — `src/shared/app-config.ts` + `src/renderer/stores/feature-flags-store.ts` *(CLOSED 2026-05-26 via PR #250 — `features.saleFinalization?: boolean` added to `AppConfig`; `FeatureFlagsState.saleFinalization` added with fail-closed default `false`; env-var `POS_PULSE_FEATURE_SALE_FINALIZATION` wired into `getAppConfig()`; renderer-store coverage extended.)*
- [X] **T003** Open the §A3 coordination thread: confirm migration ordering for the five new tables + 004 `ActionCategory` enum extension with the 10 new categories before Slice 1 begins; identify the §A3 reviewer + expected review date — `specs/008-sale-finalization-and-receipts/coordination.md` *(CLOSED 2026-05-26 — thread opened + Ahmed signed §A3 migration review `approved` (PR #256). See coordination.md §"§A3 migration reviewer thread (T003)".)*
- [X] **T004** Open the §A4 coordination thread: confirm security-review owner for the `sales.*` + `receipts.*` bridge surface before Slice 1; reviewer to walk the §A4 checklist in `contracts/bridge-api.md` (eight items) — `specs/008-sale-finalization-and-receipts/coordination.md` *(CLOSED 2026-05-26 — thread opened + Ahmed signed §A4 bridge-API review `approved`; eight-item security checklist walked (PR #257). See coordination.md §"§A4 bridge-API reviewer thread (T004)".)*
- [X] **T005** Assign the Slice 0 visual-direction reviewer; record name + expected review date — `specs/008-sale-finalization-and-receipts/coordination.md` *(CLOSED 2026-05-26 — reviewer: Ahmed; accepted §A1 reviewer + `/impeccable shape=pass` approver role (PR #253). See coordination.md §"§A1 reviewer assignment (T005)".)*
- [X] **T006** Open the §A3 hardware-matrix coordination thread: identify ≥ 1 thermal-printer + cash-drawer model pair that will be the §A3 bring-up target for Slice 3 / Slice 4; record vendor + model + driver version expectation in `docs/hardware-matrix.md`'s pending column — `docs/hardware-matrix.md` *(CLOSED 2026-05-26 via PR #258 — pair: Epson TM-T20III thermal printer (ESC/POS direct path) + APG VBS320 cash drawer (DK1 pulse via printer) landed in docs/hardware-matrix.md pending rows. See coordination.md §"§A3 hardware-matrix coordination thread (T006)".)*
- [X] **T007** Update `specs/008-sale-finalization-and-receipts/coordination.md` to reflect `/speckit-tasks` completion and the current gate-status table — `specs/008-sale-finalization-and-receipts/coordination.md` *(CLOSED 2026-05-26 — `/speckit-tasks` completion + gate-status table recorded in coordination.md §"Current phase / status".)*

---

## Phase 2 — Slice 0: Visual direction (NO CODE)

**Purpose:** Commission §A1 visual-direction review for every 008 receipt + UI surface variant.
**Gates:** §A0 ✅ + §A1 commission. **✅ Cleared 2026-05-26.**

- [X] **T010** [§A1] [IMPECCABLE shape] Commission Slice 0 visual-direction review covering: (a) `first_print` bilingual receipt slip (Arabic-first RTL header, Latin numerals on all numerals, sale-number prominent, sale-level VAT footer with tax-registration ID, branch + terminal_label + cashier display name); (b) `reprint_duplicate` variant with **prominently visible bilingual duplicate-copy marker** ("نسخة طبق الأصل — DUPLICATE COPY") in header band — large weight, top-of-slip, obvious at counter distance (~1.5 m glance); (c) `preview` variant matching `first_print` content; (d) preview UI panel; (e) reprint affordance; (f) **persistent printer-failure banner** (non-modal, no auto-dismiss, retry / reprint / manual-override affordances; 44×44 floor); (g) **persistent drawer-failure manual-override banner** (non-modal, no auto-dismiss, includes `last_successful_open_at` relative timestamp). Sub-items (d)/(e)/(f)/(g) are drafted by `/impeccable shape 008-receipt-surfaces` per `docs/impeccable-embed-preflight.md §3.3`; printed-slip sub-items (a)/(b)/(c) remain reviewer-authored (out of `/impeccable` register). The §A1 reviewer's sign-off IS the `/impeccable shape=pass` event. Output: `specs/008-sale-finalization-and-receipts/visual-direction/README.md`. No code — `specs/008-sale-finalization-and-receipts/visual-direction/README.md` — **CLOSED 2026-05-26 via PR #254 (renderer-portion d–g drafted) + this PR (Ahmed signed `approved` with (a)/(b)/(c) DEFERRED to follow-up commit before T173 craft).**
- [X] **T011** Slice 0 review record signed (reviewer, date, result `approved` or `approved-with-revisions`, all seven sub-items above ticked); §A1 sign-off recorded — `specs/008-sale-finalization-and-receipts/coordination.md` — **CLOSED 2026-05-26 by this PR: Ahmed, `approved`, all 7 sub-items checked ((d)/(e)/(f)/(g) verbatim; (a)/(b)/(c) deferred-authoring committed). Full sign-off block in coordination.md §"§A1 sign-off (T011)".**

---

## Phase 3 — Slice 1 *(load-bearing)*: Finalization listener + persistence + 006 wiring

**Purpose:** Author the five new SQLite tables + append-only triggers + indices + audit-category extension; implement the AD-2 main-process in-process listener subscribing to 006's `payment.settled`; implement the AD-7 sale-number allocator; implement the atomic finalize transaction; implement `sales.*` read-only bridge handlers; implement the force-fail / reversal_pending refusal guard.
**Gates:** §A0 ✅ + §A1 (Slice 0 sign-off) + **§A2 (no-op confirmed)** + **§A3 (table review + migration sign-off)** + **§A4 (bridge-API review)**. **All held.**
**User stories:** US1 acceptance scenarios 1 (durable finalization), 2 (sale number), 10 (force-fail refusal), 14 (sync-handoff staging).
**Test floor:** ≥ 95 % on AD-2 transaction, AD-7 allocator, refusal guard, `sales.*` read handlers; integration test for kill-mid-finalize recovery; idempotency replay test.

### §A3 migration tasks

- [X] **T020** [§A3] Migration: create `sales` table per `data-model.md §"Entity: Sale"` with all 21 fields + UNIQUE index on `envelope_handoff_action_id` (AD-2 idempotency anchor) + UNIQUE index on `(terminal_id, sale_number)` (AD-7) + INDEX `(tenant_id, branch_id, terminal_id)` + INDEX `(terminal_id, local_calendar_day)` — `migrations/0020_create_sales.sql` *(filename uses the project-wide 4-digit ordinal convention; preflight's `008-NNNN` framing was inconsistent with the existing migrations-registry pattern from 001–006)*
- [X] **T021** [§A3] Migration: append-only triggers on `sales` (BEFORE UPDATE → RAISE ABORT 'sales is append-only — UPDATE denied (008 AD-3)'; BEFORE DELETE → same shape) — `migrations/0021_sales_append_only_trigger.sql`
- [X] **T022** [§A3] [P] Migration: create `print_events` table per `data-model.md §"Entity: PrintEvent"` + FK → `sales.sale_id` + INDEX `(sale_id)` + INDEX `(sale_id, purpose, outcome, printed_at DESC)` + append-only triggers — `migrations/0022_create_print_events.sql`
- [X] **T023** [§A3] [P] Migration: create `drawer_events` table per `data-model.md §"Entity: DrawerEvent"` + FK → `sales.sale_id` + **UNIQUE index on `(sale_id)`** (FR-053 double-kick suppression at schema layer) + INDEX `(terminal_id, attempted_at DESC)` + append-only triggers — `migrations/0023_create_drawer_events.sql`
- [X] **T024** [§A3] [P] Migration: create `sale_sync_outbox` table per `data-model.md §"Entity: SaleSyncOutbox"` + FK → `sales.sale_id` + **UNIQUE index on `(sale_id)`** (one outbox row per sale, FR-060) + INDEX `(tenant_id, branch_id, terminal_id, state, enqueued_at)` (future sync-engine scan path) + append-only triggers — `migrations/0024_create_sale_sync_outbox.sql`
- [X] **T025** [§A3] [P] Migration: create `sale_number_sequences` table per `data-model.md §"Entity: SaleNumberSequences"` with composite primary key `(terminal_id, calendar_day_local)` + `next_sequence INTEGER NOT NULL DEFAULT 1` + `updated_at` — **no append-only trigger** (this is the only mutable 008 table) — `migrations/0025_create_sale_number_sequences.sql`
- [X] **T026** [§A3] Migration: extend 004's `audit_events.action_category` enum / CHECK with the 10 new 008 categories (`sale.finalized`, `sale.finalization_refused`, `sale.receipt.printed`, `sale.receipt.reprinted`, `sale.receipt.print_failed`, `sale.receipt.print_retried_success`, `sale.receipt.manual_override`, `sale.drawer.opened`, `sale.drawer.suppressed`, `sale.drawer.failed`) — `migrations/0026_extend_audit_event_categories.sql` *(documentation-only marker; the 004 base schema declares `action_category` as open-set TEXT with no CHECK; pattern mirrors migration 0017)*
- [X] **T027** [§A3] Test (integration): apply all seven migrations against a fresh sql.js DB; assert schemata match `data-model.md`; assert append-only triggers refuse UPDATE and DELETE on each of the four append-only tables; assert UNIQUE constraint on `drawer_events.sale_id` and `sale_sync_outbox.sale_id` — `tests/integration/sales/migrations.test.ts` *(42 tests; uses sql.js per the project pattern in 006's migrations.test.ts)*
- [X] **T028** [§A3] Record §A3 migration review sign-off (reviewer, date) — `specs/008-sale-finalization-and-receipts/coordination.md` *(sign-off recorded by PR #256 on 2026-05-26; this S1a PR cites the merged schemas against that sign-off)*
- [X] **T028a** [§A3] [US1] [BLOCKED-BY T094a] Migration `0028_extend_sales_with_lines_json.sql`: `ALTER TABLE sales ADD COLUMN lines_json TEXT NOT NULL DEFAULT '[]'` — persists `PaymentIntentEnvelope.lines` snapshots (item_ref, display_name, quantity, unit_price_minor, line_subtotal_minor, note) for byte-stable reprints per FR-015. DEFAULT lets the migration run cleanly against existing dev fixtures past 0020. RED-GREEN test pair: schema-evolution test + insert/read JSON round-trip. Updates T091 to serialize lines into the INSERT, updates T094b to project from cart envelope, updates `SalesRepository.readById` to parse on read, adds `lines: readonly LineSnapshot[]` to `FinalizeInput` shape. **Added 2026-05-28 from Slice 2 prep audit (Option A — see coordination.md §"Slice 2 prep audit: line-snapshot persistence").** — `migrations/0028_extend_sales_with_lines_json.sql` + `src/main/sales/finalize-transaction.ts` + `src/main/sales/repositories/sales.repository.ts` + `src/main/sales/finalize-dispatch.ts` (T094b) *(CLOSED 2026-05-28 — migration numbered **0028** not 0027 (0027 was consumed by T094a/PR #273); column is NOT NULL DEFAULT '[]'; `SaleRow.lines_json` + repo INSERT + `FinalizeInput.lines` + finalize-transaction `JSON.stringify(input.lines)` all wired. RED-GREEN: `tests/integration/sales/migrations.lines-json.test.ts` (3) + finalize-transaction lines_json test. The "readById parse on read" sub-note was unnecessary — `lines_json` is stored/read as the raw JSON string; the reprint engine (Slice 2) parses it.)*

### Shared types (compile-time contract)

- [X] **T030** [P] [US1] Test (contract, failing): `src/shared/bridge-api.ts` extends `BridgeApi` interface with `sales.read`, `sales.findByNumber`, `sales.subscribe`, `sales.unsubscribe` (read-only Slice-1 subset; mutating `receipts.*` lands Slice 2+). Compile-time assert — `tests/contract/sales/bridge-api.contract.test.ts` *(18 assertions across closed-enum tuples, namespace presence, handler signatures, SaleSummary shape, TenderLineSummary shape, handler Request/Response payloads, ReceiptPayload shape)*
- [X] **T031** [US1] Implement Slice-1 subset of `sales.*` types in shared bridge-api.ts: Request / Response shapes per `contracts/bridge-api.md §"Namespace: sales.*"`; refusal envelope `{ kind: 'refused', reason: ... }` with the closed reason enum (8 values per contract) — `src/shared/bridge-api.ts` *(SalesBridgeAPI interface + 4 Request/Response pairs + SaleSummary + SalesSubscribeTopic appended)*
- [X] **T032** [P] [US1] Implement shared sale types module: `SaleId`, `SaleNumber`, `TenderLineSummary`, `PrintEventSummary`, `DrawerEventSummary`, `RefusalReason` (closed union) — `src/shared/sales/types.ts` *(branded primitives + 4 closed-set tuples per pattern in src/shared/payments/types.ts)*
- [X] **T033** [P] [US1] Implement shared receipt-payload types module: `ReceiptPayload` (canonical FR-017 fields), `ReceiptTemplateVariant` (`'first_print' | 'reprint_duplicate' | 'preview'`) — `src/shared/receipts/types.ts` *(AD-6 single-source dual-output commitment documented inline)*

### TDD test tasks — AD-7 sale-number allocator

- [X] **T040** [P] [US1] Test (failing): `allocateSaleNumber({ terminal_id, terminal_label, local_calendar_day })` returns `<terminal_label>-<YYYY-MM-DD>-<NNNNNN>` with `<NNNNNN>` zero-padded 6-digit monotonic per `(terminal_id, calendar_day_local)`; first call returns `…-000001`, second returns `…-000002`, etc. — `tests/unit/main/sales/sale-number-allocator.format.test.ts` *(6 assertions: first-allocation, monotonic-second, monotonic-third, different-terminal isolation, 6-digit zero-padding at 1000-mark boundary, updated_at touch)*
- [X] **T041** [P] [US1] Test (failing): allocator returns `…-000001` for a *new* calendar day even when the previous day reached `…-000847`; sequence resets at the local-timezone midnight boundary (AD-7 / research §R-7) — `tests/unit/main/sales/sale-number-allocator.day-reset.test.ts` *(4 assertions: day-boundary reset, previous-day row preservation, both-day coexistence, NTP-skew tolerance)*
- [X] **T042** [P] [US1] Test (failing): two concurrent finalize transactions on the same `(terminal_id, calendar_day_local)` produce two **different** sale numbers; SQLite transaction-level isolation + composite PK on `sale_number_sequences` makes the increment safe — `tests/integration/sales/sale-number-allocator.concurrent.test.ts` *(3 assertions: 2-call uniqueness, 1000-call strict-monotonic-unique, multi-key interleaved isolation. Test limitation re true OS-thread concurrency documented inline.)*
- [X] **T043** [P] [US1] Test (failing): allocator runs INSIDE the atomic finalize transaction; a transaction rollback rolls back the sequence increment (gap-free not required by FR-010, but rollback-safety is — research §R-7) — `tests/integration/sales/sale-number-allocator.txn-rollback.test.ts` *(4 assertions: rollback reverts increment, retry after rollback re-issues same number, committed-then-rollback leaves committed value, error-mid-txn no partial state)*

### TDD test tasks — AD-2 finalize transaction + listener

- [X] **T050** [P] [US1] Test (failing): AD-2 atomic finalize transaction allocates `sale_number` (via AD-7 allocator) → INSERT `sales` row → INSERT `sale_sync_outbox` row (state='pending') → emit `sale.finalized` audit event → all four rows present and commit atomically — `tests/integration/sales/finalize-transaction.atomicity.test.ts` *(merged into `tests/unit/main/sales/finalize-transaction.test.ts` — sql.js + in-process txn makes the unit-level form deterministic; integration form revived in S1c.2 alongside T053 kill-mid-flight)*
- [X] **T051** [P] [US1] Test (failing): duplicate finalize on the same `envelope.handoff_action_id` is a no-op returning the existing `sale_id` (Constitution §P5 / FR-001 / SC-009); no second `sales` row created, no second `sale_sync_outbox` row, no second `sale.finalized` audit event — `tests/unit/main/sales/finalize-transaction.test.ts`
- [X] **T052** [P] [US1] *(revised twice — v1 R1 EventEmitter→update_hook, v2 CR1 update_hook→periodic scan worker. AD-2 v3 LOCKED 2026-05-27.)* Test (failing): the AD-2 v3 scan worker registers a `setInterval` (default 200 ms; configurable) that runs the canonical `SELECT … FROM audit_events WHERE action_category='payment.settled' AND originating_terminal_id=? AND NOT EXISTS (SELECT 1 FROM sales WHERE envelope_handoff_action_id = json_extract(payload, '$.handoff_action_id')) ORDER BY created_at ASC LIMIT 32` (per plan §AD-2; column names corrected from the schema). Assert (a)-(d) — `tests/unit/main/sales/finalize-listener.scan-worker.test.ts`
- [X] **T053** [P] [US1] Test (failing): rollback-discipline integration — throw inside the AD-2 db.transaction closure; assert no orphan rows in `sales`, `sale_sync_outbox`, or `sale_number_sequences` after rollback (better-sqlite3 + sql.js both ROLLBACK on throw). The process-kill form is the T112 manual smoke. — `tests/integration/sales/finalize-transaction.rollback.test.ts`
- [X] **T054** [P] [US1] Test (failing): AD-2 audit-events recovery — covered by AD-2 v3's first scan tick (steady-state worker's first invocation picks up unfinalized `payment.settled` rows). Sub-scan tests for print + drawer recovery (T092) also land in this integration file. — `tests/integration/sales/finalize-listener.startup-recovery.test.ts`

### TDD test tasks — force-fail / reversal_pending refusal guard

- [X] **T055** [P] [US1] Test (failing): AD-2 listener refuses to finalize when the source 006 attempt is in `force_failed` state (FR-005 / FR-045); emits `sale.finalization_refused` with `refusal_reason='force_failed_attempt'`; no `sales` row created — `tests/unit/main/sales/finalize-transaction.test.ts` (T055 describe block)
- [X] **T056** [P] [US1] Test (failing): AD-2 listener refuses to finalize when any of the attempt's `payment_tender_lines` is in `reversal_pending` state (FR-005 / FR-046); emits `sale.finalization_refused` with `refusal_reason='reversal_pending_line'`; no `sales` row created — `tests/unit/main/sales/finalize-transaction.test.ts` (T056 describe block)
- [X] **T057** [P] [US1] Test (failing): AD-2 listener refuses to finalize when the listener is fed a payload claiming `state != 'settled'` (defensive guard per FR-047 / Path F in quickstart); emits `sale.finalization_refused` with `refusal_reason='source_attempt_not_settled'` — `tests/unit/main/sales/finalize-transaction.test.ts` (T057 describe block) *(Sentry capture deferred to S1c.2 with the polling-worker error-handling pass; finalize-transaction itself emits the audit row, which is the spec's load-bearing requirement)*

### TDD test tasks — forbidden-field validation (data-model defensive guard)

- [X] **T060** [P] [US1] Test (failing): AD-2 finalize validates `tender_lines_summary_json` against the forbidden-field key list (PAN / CVV / track / cardholder / expiry / auth_payload / cryptogram per FR-070); INSERT refused with `sale.finalization_refused` + `refusal_reason='forbidden_field_in_tender_summary'` if any forbidden key is detected at any tree depth — `tests/unit/main/sales/finalize-transaction.test.ts` (T060 describe block)
- [X] **T061** [P] [US1] Test (failing): AD-2 finalize refuses on voucher forbidden keys (voucher_code / voucher_balance / voucher_redemption_intent_token / authority_payload per FR-071); same `forbidden_field_in_tender_summary` refusal — `tests/unit/main/sales/finalize-transaction.test.ts` (T061 describe block)
- [X] **T062** [P] [US1] Test (failing): AD-2 finalize refuses on secret-credential keys (pin / jwt / device_token per FR-072) and raw-envelope keys (envelope_payload / raw_envelope per FR-074) — `tests/unit/main/sales/finalize-transaction.test.ts` (T062 describe block)

### TDD test tasks — `sales.*` bridge handlers (Slice 1 subset)

- [X] **T070** [P] [US1] Test (failing): `sales.read` requires active session; tenant/branch/terminal isolation enforced; sale-not-found refuses with `sale_not_found`; success returns the `sales.read` payload shape per `contracts/bridge-api.md` (excludes main-only fields; includes latest_print_event + latest_drawer_event projections) — `tests/unit/main/sales/bridge.sales-read.test.ts`
- [X] **T071** [P] [US1] Test (failing): `sales.findByNumber` is tenant-isolation scoped — cross-tenant misses refuse with `sale_not_found` (NOT `tenant_isolation`, to avoid information leak; §A4 checklist item 6) — `tests/unit/main/sales/bridge.sales-find-by-number.test.ts`
- [X] **T072** [P] [US1] Test (failing): `sales.subscribe(topic='recent' | 'banner_state')` STUBBED matching 005 cart.subscribe posture — returns `refused: 'not_implemented'`. The push-subscription primitive (webContents.send + token registry) is deferred to a follow-up task. unsubscribe returns `kind: 'ok'` no-op. — `tests/unit/main/sales/bridge.sales-subscribe-stub.test.ts`
- [X] **T073** [P] [US1] Test (failing): defensive forbidden-field guard at `sales.*` bridge handler entry refuses requests with any forbidden key in the request payload (`reason='forbidden_field_in_request'`); §A4 checklist item 2 — covered inline in `tests/unit/main/sales/bridge.sales-read.test.ts` + `tests/unit/main/sales/bridge.sales-find-by-number.test.ts`

### Implementation — persistence layer

- [X] **T080** [US1] Implement migration runner registration for the six new 008 migrations (compose with 001's existing better-sqlite3 transactional runner; runs in numeric order: 0001 → 0001b → 0002 → 0003 → 0004 → 0005 → 0006) — `src/main/db/migrations-registry.ts` — **NO-OP DOCUMENTED**: the existing migration runner at `src/main/db/migrate.ts` (`readMigrationsFromDisk`, line 158) already auto-discovers every `*.sql` file in `migrations/` and applies them in lexical filename order. The S1a migrations (0020–0026) are picked up automatically. No code change was required for T080; it is closed as a discovery + verification task.
- [X] **T081** [P] [US1] Implement `sales` repository: `insert(saleRow)`, `readById(sale_id)`, `findByNumber(sale_number, tenantScope)`, `findByHandoffActionId(handoff_action_id)` (returns sale or null — used by AD-2 idempotency check); all reads tenant-scoped — `src/main/sales/repositories/sales.repository.ts`
- [X] **T082** [P] [US1] Implement `print_events` repository: `insert(row)`, `readBySale(sale_id)` (ordered by `printed_at DESC`), `hasSuccessfulPrint(sale_id)` (boolean projection for AD-10 reprint-precondition check), `countReprints(sale_id)` (for `duplicate_copy_sequence_number` allocation) — `src/main/sales/repositories/print-events.repository.ts`
- [X] **T083** [P] [US1] Implement `drawer_events` repository: `insert(row)`, `readBySale(sale_id)` (returns the ≤1 row), `findLastSuccessfulOpenForTerminal(terminal_id)` (returns `attempted_at` or null — used by `sale.drawer.failed` audit payload per Constitution Principle IV) — `src/main/sales/repositories/drawer-events.repository.ts`
- [X] **T084** [P] [US1] Implement `sale_sync_outbox` repository: `insert(row)`, `readBySale(sale_id)`. **No `update` method** (state column not transitioned by 008; AD-11) — `src/main/sync-outbox/sale-sync-outbox.repository.ts`
- [X] **T085** [P] [US1] Implement `sale_number_sequences` allocator (the AD-7 module): `allocate({ terminal_id, terminal_label, local_calendar_day }) → sale_number` via UPSERT-and-increment inside the caller's SQLite transaction; uses SQLite `INSERT … ON CONFLICT … DO UPDATE … SET next_sequence = next_sequence + 1 RETURNING next_sequence`; pads to 6 digits — `src/main/sales/sale-number-allocator.ts` *(`bindSaleNumberAllocator(db)` factory; UPSERT inserts `next_sequence=2` so first allocation issues sequence 1; uses SELECT after UPSERT instead of RETURNING for sql.js compatibility; defensive throw on impossible "row missing after UPSERT" branch marked `c8 ignore`; ≥95% lines/functions/statements; per-file threshold added in vitest.config.ts)*

### Implementation — AD-2 listener + finalize transaction

- [X] **T090** [US1] *(revised twice — v1 R1, v2 CR1; AD-2 v3 polling LOCKED)* Implement the AD-2 v3 scan worker (`src/main/sales/finalize-listener.ts`): setInterval at default 200ms (configurable 100-1000ms floor/ceiling); canonical SELECT with NOT EXISTS + LIMIT 32 + ORDER BY created_at ASC; single-flight per tick; injectable manual tick driver for tests. — `src/main/sales/finalize-listener.ts`
- [X] **T091** [US1] Implement the AD-2 atomic finalize transaction module: (1) check `sales.findByHandoffActionId` for idempotency, (2) allocate sale_number via T085, (3) validate `tender_lines_summary_json` against forbidden-field list (T060–T062), (4) refusal guard against `force_failed` / `reversal_pending` / `not_settled` source attempt (T055–T057), (5) INSERT `sales` row, (6) INSERT `sale_sync_outbox` row with `state='pending'`, (7) emit `sale.finalized` audit event into 004's `audit_events` — all inside one SQLite transaction — `src/main/sales/finalize-transaction.ts`
- [X] **T092** [US1] *(revised twice — v1 R1, v2 CR1; AD-2 v3 print + drawer recovery sub-scans)* Implement two **one-shot startup recovery sub-scans** in `src/main/sales/finalize-listener.ts`: print recovery (no success/manual_override print event) + drawer recovery (cash-inclusive sale with no drawer event). Both scoped to current terminal. Both idempotent across repeat invocations. The audit-events recovery happens automatically via the T090 worker's first tick. — `src/main/sales/finalize-listener.ts`
- [X] **T093** [US1] [P] Implement the 008-side audit-event emitter: writes into 004's `audit_events` table with all ten new 008 categories per AD-9 + the payload shapes from `data-model.md`. The emitter MUST redact `external_reference` to `*****` in any pino log line and MUST refuse to emit a payload containing any forbidden-field key (defence-in-depth) — `src/main/sales/audit-emitter.ts` *(S1c.1 scope: only the 2 categories T091 emits — sale.finalized / sale.finalization_refused — plus the emitRaw escape hatch. The 8 remaining categories' shaped emit methods land in S2/S3/S4 alongside their respective callers; placeholders in AuditPayloadMap keep the closed-set assertion exhaustive in the meantime. `external_reference` is substituted inline in the audit payload AND added to logger.ts SALES_REDACTED_KEYS for pino defence-in-depth)*

### Implementation — S1c.3 dispatch projection + main bootstrap (added 2026-05-28 to close Slice 1 closeout gap)

> **Context:** Discovered 2026-05-28 while preparing the AD-2 worker bootstrap that 4 of 18 `FinalizeInput` fields have no source anywhere in the codebase (`total_tax_minor`, `tenant_tax_registration_id`, `branch_name`, `branch_address`). All 18 columns are `NOT NULL` in `migrations/0020_create_sales.sql`. Ahmed's 2026-05-28 resolution (see coordination.md §"Slice 1 closeout gap discovery"): (Q1) `total_tax_minor = 0` for v1 with §A5 production-readiness flag; (Q2) extend 002 pairing handshake to carry the three branch/tax-reg fields, attributed to 008. Three new tasks split the work into reviewable PRs.

- [X] **T094a** [US1] [BLOCKED-BY Data-Pulse-2 contract slice + POS-Pulse pin] Extend 002 pairing handshake + `terminal_assignment` schema with **six** new fields: `branch_name`, `branch_address`, `tenant_tax_registration_id` (Slice 1 closeout gap — coordination.md §"Slice 1 closeout gap discovery"), plus `printer_vendor_id`, `printer_product_id`, `printer_com_port` (Slice 3 prep audit — coordination.md §"Slice 3 prep audit"). New migration adds the six columns (nullable temporarily, then enforced NOT NULL after data backfill in dev fixtures). `src/main/pairing/store.ts` row shape gains the six fields. `src/main/pairing/network.ts` + `src/main/pairing/service.ts` parse them from the pair-response body. RED-GREEN test pair covers: handshake payload shape, schema migration, row round-trip through the store. PR title: `feat(008): extend 002 pairing handshake for branch + printer config (T094a)`. **Sequencing**: Claude authors the contract slice in Data-Pulse-2 (`packages/contracts/openapi/pos-terminal-pairing.yaml` + `apps/api/test/pos-terminal-pairing/pairing.contract.spec.ts`, following Data-Pulse-2 PR #316 precedent) → pin the new contract bytes into POS-Pulse `scripts/openapi-snapshot.json` + regenerate `src/shared/api-types.ts` (mirror commit `454914a`) → execute this T094a entry's POS-Pulse-side work. The "BLOCKED-BY backend (Ahmed owns)" framing recorded 2026-05-28 in PRs #267/#268/#270 was **wrong**; corrected 2026-05-28. See coordination.md §"Correction (2026-05-28, post-PR #270 author-time discovery)" for full evidence + corrected workflow. — `src/main/pairing/store.ts` + `migrations/00XX_extend_terminal_assignment.sql` *(CLOSED — POS-Pulse-side merged via PR #273; migration `0027_extend_terminal_assignment.sql` added the six columns, `src/main/pairing/store.ts` row shape + `service.ts` pass-through landed. Contract pinned via PR #272.)*
- [X] **T094b** [US1] [BLOCKED-BY T094a] Implement the `payment.settled` → `FinalizeInput` dispatch-projection module: reads `audit_events` row by `handoff_action_id`, joins `payment_attempts` + `payment_tender_lines` + post-T094a `terminal_assignment` + operator-display-name reader; computes `total_change_due_minor` (sum over cash lines' `change_due_minor`) + `local_calendar_day` (terminal-local timezone of `settled_at`); hardcodes `total_tax_minor = 0` with explicit `// TODO(008-v2): Egyptian VAT compliance — see coordination.md` comment at the assignment site. RED-GREEN test pair covers: happy-path projection, all four gap-field hydration, total_change_due_minor compute, local_calendar_day TZ behavior, missing-row refusal paths. ≥95% L/B/F/S coverage. — `src/main/sales/finalize-dispatch.ts` *(CLOSED 2026-05-28 — `buildFinalizeInput(handoff_action_id)`; display_name sourced from the `payment.settled` payload (persisted at settlement per Ahmed's decision — see slice1-closeout-plan.md Step 0), NOT a live-session read, so boot recovery works; lines sourced from the frozen `carts.handoff_envelope_json`; `local_calendar_day` via injectable `localCalendarDayFor` seam (UTC default). Explicit refusals: settled_event_not_found / attempt_not_found / terminal_assignment_not_found / cart_envelope_not_found / malformed_settled_payload. 17 tests; per-file ≥95% gate added to vitest.config + met.)*
- [X] **T094c** [US1] [BLOCKED-BY T094b] Wire the AD-2 worker + `sales.*` bridge into the Electron main process at `src/main/index.ts`, behind `featureFlags.sale_finalization`. The `dispatch(handoff_action_id)` closure calls T094b's projection module then `bindFinalizeTransaction.finalize()`. Recovery dispatchers (`dispatchPrintRecovery`, `dispatchDrawerRecovery`) stubbed as `logger.warn` placeholders — real implementations land S3/S4. Calls `finalizeListener.runStartupRecovery()` then `finalizeListener.start()` inside `app.whenReady()` (after 006 payments handlers register). Registers `sales.*` IPC handlers via the same pattern as `registerPaymentsHandlers`. Adds `finalizeListener.stop()` to the `app.quit` handler. UNBLOCKS T111/T112/T113. PR title: `feat(008): wire AD-2 worker + sales.* bridge into main (T094c, closes S1c.3)`. — `src/main/index.ts` + `src/main/ipc/sales.ts` (new, mirrors 006's `src/main/ipc/payments.ts`) *(CLOSED 2026-05-28 — new `src/main/ipc/sales.ts` (`registerSalesHandlers`, 8 unit tests) + index.ts bootstrap behind `getAppConfig().features.saleFinalization`, scoped to the paired terminal via `pairingStore.getStatus()`. dispatch closure = `buildFinalizeInput` → `finalizeTransaction.finalize`; recovery dispatchers are `logger.warn` stubs; `runStartupRecovery()` then `start()` in whenReady; `finalizeListener.stop()` folded into `closeDbHandle()` (runs before DB close on quit). The index.ts bootstrap itself is Electron-lifecycle glue verified by the T111/T112 human smokes, matching the un-unit-tested posture of the rest of index.ts.)*

### Implementation — `sales.*` bridge handlers (Slice 1 subset)

- [X] **T100** [US1] Implement `sales.read` bridge handler with `requireOperatorSession` gate + tenant-isolation scoping + the payload shape from `contracts/bridge-api.md §"sales.read"` (main-only fields excluded) + the defensive forbidden-field-in-request guard + latest_print_event/latest_drawer_event projections — `src/main/sales/sales-bridge.ts`
- [X] **T101** [P] [US1] Implement `sales.findByNumber` bridge handler — scoped tenant/branch/terminal lookup; cross-tenant misses refuse with `sale_not_found` (no `tenant_isolation` leak) — `src/main/sales/sales-bridge.ts`
- [X] **T102** [P] [US1] Implement `sales.subscribe` + `sales.unsubscribe` bridge handlers — STUBBED matching 005 cart.subscribe posture. subscribe returns `refused: 'not_implemented'`; unsubscribe returns `kind: 'ok'` no-op. The push-subscription primitive (webContents.send + token registry) is deferred to a follow-up task; S1 acceptance scenarios don't require it. — `src/main/sales/sales-bridge.ts`
- [X] **T103** [US1] Wire the `sales.*` bridge into 008's preload `contextBridge.exposeInMainWorld` surface; add `src/preload/sales.ts` + `src/shared/sales/channels.ts` and register in the central preload entry — `src/preload/sales.ts`
- [X] **T104** [§A4] §A4 cleared 2026-05-26 (recorded in coordination.md §"§A4 bridge-API reviewer thread (T004)" + contracts/bridge-api.md header). This task is a cross-reference, not a fresh approval — all eight checklist items verified at clearance time; S1c.2 implementation honors them (#2 forbidden-field guard, #6 tenant_isolation→sale_not_found, #8 no main-only field leak). — `specs/008-sale-finalization-and-receipts/coordination.md`

### Slice 1 verification

- [X] **T110** Run vitest with coverage on all 008 modules — VERIFIED in S1c.2: 198/198 tests GREEN; per-file ≥95% thresholds passing on finalize-transaction / audit-emitter / sale-number-allocator / sales-bridge / finalize-listener / four repositories. Coverage gates enforced in `vitest.config.ts`. — `tests/`
- [ ] **T111** [HUMAN] [BLOCKED-BY T094c] Manual smoke (dev fixture): run a 006 cash-only payment through to `payment.settled` in a dev build with 008 enabled; observe `sales` row + `sale_sync_outbox` row + `sale.finalized` audit event present; observe correct sale_number format `<terminal_label>-<YYYY-MM-DD>-000001` — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T112** [HUMAN] [BLOCKED-BY T094c] Manual smoke (dev fixture): kill the dev process mid-finalize (between the AD-2 atomic-commit point and the next event); restart; assert recovery scan re-fires AD-2 and produces a complete sale — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T113** [HUMAN] [BLOCKED-BY T111+T112] Record Slice 1 functional sign-off + per-module coverage numbers in coordination.md; §A2 no-op confirmed; §A3 + §A4 sign-offs cross-referenced. Coverage numbers from T110: finalize-transaction (≥95% L/B/F/S), sales-bridge.ts (97.18% L / 95.55% B / 100% F-S), audit-emitter.ts (97.56% L / 96.15% B / 100% F-S), finalize-listener.ts (≥95% — start/stop driver c8 ignored). — `specs/008-sale-finalization-and-receipts/coordination.md`

---

## Phase 4 — Slice 2: Receipt payload generation + preview

**Purpose:** Implement the AD-6 receipt template engine (single source, dual output: ESC/POS bytes + HTML/canvas) reading from the persisted Sale row; ship the three bilingual template asset variants; implement `receipts.preview` bridge handler; implement renderer preview panel. **No actual printing or drawer kicking in this slice.**
**Gates:** §A1 (Slice 0 sign-off; template asset signed off) + §A2 (no-op) + §A4 (bridge review). **Held.**
**User stories:** US1 acceptance scenarios 3 (payload from durable sale), 6 (preview), 13 (attribution), 11 (voucher-safe), 12 (external-card-safe).
**Test floor:** ≥ 95 % on the template engine; ≥ 90 % on the preview UI; byte-stability tests; voucher-data + card-data minimisation tests.

### TDD test tasks — template engine

- [X] **T120** [P] [US1] Test (failing): AD-6 template engine reads a `first_print.bilingual.template` asset + a canonical `ReceiptPayload` from a Sale row and emits two outputs: an ESC/POS byte stream + an HTML string. Both outputs derive from the **same** template + same payload (R-6 single-source) — `tests/unit/main/receipts/template-engine.dual-output.test.ts`
- [X] **T121** [P] [US1] Test (failing): byte-stability — regenerating the payload + rendering twice for the same Sale produces byte-identical outputs (modulo the reprint-marker and time-of-print field which are template-variant-controlled) (FR-016) — `tests/unit/main/receipts/template-engine.byte-stable.test.ts`
- [X] **T122** [P] [US1] Test (failing): Arabic-first RTL rendering — the template engine emits Arabic content in RTL flow direction; English fallback panel renders alongside; Latin numerals are used for every numeric field on the *printed* output (FR-066) — `tests/unit/main/receipts/template-engine.bilingual-rtl.test.ts`
- [X] **T123** [P] [US1] Test (failing): `reprint_duplicate` template variant emits the bilingual marker "نسخة طبق الأصل — DUPLICATE COPY" in the header band, bold, top-of-slip; the marker is **absent** in `first_print` and `preview` variants (FR-029) — `tests/unit/main/receipts/template-engine.duplicate-marker.test.ts`
- [X] **T124** [P] [US1] Test (failing): currency / date / time formatting goes through the existing `formatters` module — never inlined (FR-067; Constitution Localization) — `tests/unit/main/receipts/template-engine.formatters.test.ts`
- [X] **T125** [P] [US1] Test (failing): sale-level VAT footer renders `total_tax_minor` formatted via `formatters` + the tenant's tax-registration ID; **no per-line VAT column** is rendered (clarifications 2026-05-27) — `tests/unit/main/receipts/template-engine.vat-footer.test.ts`

### TDD test tasks — receipt payload minimisation

- [X] **T130** [P] [US1] Test (failing): rendered receipt payload (HTML AND ESC/POS bytes) contains NO PAN / CVV / track data / cardholder name / expiry / auth payload / approval code / cryptogram / raw terminal-printed receipt text — across every tender mix fixture in `quickstart.md §"Test fixtures"` (FR-070, Constitution §P6) — `tests/unit/main/receipts/template-engine.card-data-minimisation.test.ts`
- [X] **T131** [P] [US1] Test (failing): rendered receipt payload contains NO voucher code / voucher balance / voucher holder PII / voucher redemption intent token / raw voucher authority response — across voucher fixtures (FR-071, Constitution §P7) — `tests/unit/main/receipts/template-engine.voucher-data-minimisation.test.ts`
- [X] **T132** [P] [US1] Test (failing): `external_reference` appears on the slip ONLY when the input Sale row's `tender_lines_summary_json` carries it (i.e. when 006 OQ-PLAN-5 resolves permissively); when absent from the Sale, it's absent from the slip (R-13) — `tests/unit/main/receipts/template-engine.external-reference-conditional.test.ts`
- [X] **T133** [P] [US1] Test (failing): `voucher_authority_redemption_id` appears on the slip ONLY when the Sale row carries it; when absent, it's absent (FR-017 / R-13) — `tests/unit/main/receipts/template-engine.voucher-redemption-id-conditional.test.ts`
- [X] **T134** [P] [US1] Test (failing): tender summary rows use the generic bilingual labels ("Cash / نقدًا", "Card / بطاقة", "Voucher / قسيمة"); no tender-specific identifier beyond the conditional fields above (FR-035 / FR-036 / FR-037) — `tests/unit/main/receipts/template-engine.tender-labels.test.ts`

### TDD test tasks — `receipts.preview` bridge handler

- [X] **T140** [P] [US1] Test (failing): `receipts.preview({ sale_id, idempotency_key })` returns the HTML preview output for the given sale; tenant-isolation scoped; refuses with `sale_not_found` on miss — `tests/unit/main/receipts/bridge.receipts-preview.test.ts`
- [X] **T141** [P] [US1] Test (failing): `receipts.preview` does NOT emit a `receipts.print` command, does NOT kick the drawer, does NOT mutate the Sale — `tests/unit/main/receipts/bridge.receipts-preview.no-side-effects.test.ts`
- [X] **T142** [P] [US1] Test (failing): defensive forbidden-field guard at `receipts.preview` handler entry refuses requests with any forbidden key in the request payload (`reason='forbidden_field_in_request'`) — `tests/unit/main/receipts/bridge.receipts-preview.forbidden-field-guard.test.ts`

### TDD test tasks — renderer preview surface

- [X] **T150** [P] [US1] Test (failing): `<ReceiptPreview>` component fetches via `receipts.preview` and renders the HTML output in a scrollable panel; visually mirrors the printed slip (44×44 floor on any interactive control per FR-068) — `tests/unit/renderer/receipts/ReceiptPreview.test.tsx`
- [X] **T151** [P] [US1] Test (failing): `<ReceiptPreview>` does not block the cashier from starting the next sale; preview panel is dismissible without side-effect — `tests/unit/renderer/receipts/ReceiptPreview.test.tsx` *(consolidated into the single ReceiptPreview.test.tsx, not a separate non-blocking file)*
- [X] **T152** [P] [US1] Test (failing): accessibility — `<ReceiptPreview>` is keyboard-operable (tab to close, escape to dismiss); axe-rule clean on default state (FR-069, P14 / 004 NFR-005) — `tests/unit/renderer/receipts/ReceiptPreview.test.tsx` *(consolidated into the single ReceiptPreview.test.tsx, not a separate a11y file)*

### Implementation tasks — template engine + assets

- [X] **T160** [US1] Implement the AD-6 template engine: takes a `ReceiptPayload`, emits ESC/POS bytes + HTML from one render call. First-party `compose(payload) → Band[]` then mechanical `toEscPos` / `toHtml` serialisers (R-6: no Handlebars / EJS / Mustache dependency) — `src/main/receipts/template-engine.ts`
- [X] **T161** [P] [US1] `first_print` layout — satisfied IN CODE by the `compose` variant branches in `src/main/receipts/template-engine.ts` (NOT a separate `.template` asset; the parsed-asset indirection is what R-6 rejected — see slice2-mapping-pass.md "T161/T162/T163 deviation"). §A1-approved §(a) layout is the visual spec.
- [X] **T162** [P] [US1] `reprint_duplicate` layout (prepended bilingual duplicate-copy marker band) — satisfied IN CODE by the `reprint_duplicate` branch in `compose`, `src/main/receipts/template-engine.ts`.
- [X] **T163** [P] [US1] `preview` layout (byte-equal to `first_print` content, FR-025 / R-14) — satisfied IN CODE: `preview` resolves to the same band set as `first_print` in `compose`, `src/main/receipts/template-engine.ts`.
- [X] **T164** [P] [US1] Implement `receipts-payload.ts` — derives the canonical `ReceiptPayload` from a persisted `sales` row (and the cached fields it carries); never re-reads `cart_lines`, never calls catalogue API, never re-validates voucher (FR-015) — `src/main/receipts/receipts-payload.ts`

### Implementation tasks — bridge + renderer

- [X] **T170** [US1] Implement `receipts.preview` bridge handler: gates on `requireOperatorSession`; reads Sale via `sales.repository`; derives payload via T164; renders HTML via T160; returns `{ kind: 'ok', preview: { html, width_chars, bilingual_locale } }` — `src/main/receipts/receipts-bridge.ts`
- [X] **T171** [US1] Extend `src/shared/bridge-api.ts` with `receipts.preview` Request / Response types per `contracts/bridge-api.md §"receipts.preview"` — `src/shared/bridge-api.ts`
- [X] **T172** [US1] Wire the `receipts.*` bridge into preload `contextBridge.exposeInMainWorld`; add `src/preload/receipts.ts` and register in the central preload entry — `src/preload/receipts.ts`
- [X] **T173** [US1] [IMPECCABLE craft] Implement `<ReceiptPreview>` component per `/impeccable craft 008-receipt-preview` against the §A1 shape brief; invokes `receipts.preview`, renders the returned HTML in a scrollable preview panel. Component MUST satisfy the failing tests already written in T150 / T151 / T152 (red-bar confirmation per `docs/impeccable-embed-preflight.md §4.2` recorded in `coordination.md` before invocation) — `src/renderer/ui/receipts/ReceiptPreview.tsx`

### Slice 2 verification

- [X] **T180** Run `npx vitest tests/unit/main/receipts/ tests/unit/renderer/receipts/` with coverage; assert ≥ 95 % on the template engine + payload derivation, ≥ 90 % on the preview component — `tests/`
- [ ] **T181** Manual smoke (dev fixture): drive a 006 settlement → 008 finalize → preview a receipt; observe Arabic-first RTL layout, Latin numerals, correct sale number, sale-level VAT footer, no voucher / card data — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T182** Record Slice 2 functional sign-off + per-component coverage in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md`

---

## Phase 5 — Slice 3 *(load-bearing)*: First-print pipeline (ESC/POS direct + OS-print fallback)

**Purpose:** Implement the print pipeline: ESC/POS adapter + OS-print fallback with path-selection; `receipts.print` internal main-process handler (fires automatically on AD-2 finalize); `receipts.retryPrint` renderer-callable handler for retry-after-failure; `print_events` row INSERT on success / failure; audit event emission; persistent printer-failure banner (renderer).
**Gates:** §A1 (Slice 0 sign-off + banner visuals signed off) + §A2 (no-op) + **§A3 (hardware bring-up record in `docs/hardware-matrix.md`)** + §A4 (bridge review). **Held.**
**User stories:** US1 acceptance scenarios 4 (cash sale prints + drawer opens — drawer half is Slice 4), 5 (cashless prints without drawer — drawer half is Slice 4), 8 (printer failure stays loud).
**Test floor:** ≥ 95 % on the print pipeline; printer-failure loud-banner test; retry-success-treated-as-first-print test (FR-052).

### §A3 hardware-matrix tasks

- [ ] **T200** [§A3] Confirm the chosen thermal printer + cash drawer model pair from T006; record vendor, model, driver version in `docs/hardware-matrix.md` under "008 §A3 bring-up — IN PROGRESS"; record any known caveats — `docs/hardware-matrix.md`
- [ ] **T201** [§A3] Pick the ESC/POS library: confirm `node-thermal-printer` (or equivalent) as the chosen library; record the choice + transitive-dependency audit + license review in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T202** [§A3] Add the chosen ESC/POS library to `package.json` (production dep); run `npm install` and commit the lockfile change — `package.json` + `package-lock.json`

### TDD test tasks — print pipeline path selection

- [ ] **T210** [P] [US1] Test (failing): path selection — when the connected printer reports ESC/POS support (status byte check), the print pipeline dispatches via the ESC/POS adapter; otherwise falls back to `webContents.print` — `tests/unit/main/receipts/print-pipeline.path-selection.test.ts`
- [ ] **T211** [P] [US1] Test (failing): both paths render from the same payload + same template; byte-stability of *user-visible fields* holds across paths (R-4 mitigation; layout differences allowed in width/font fallback, content differences refused) — `tests/unit/main/receipts/print-pipeline.both-paths-byte-stable.test.ts`
- [ ] **T212** [P] [US1] Test (failing): cashier is not exposed to which path was used unless print fails; success returns `render_path` for audit only — `tests/unit/main/receipts/print-pipeline.path-opaque-to-cashier.test.ts`

### TDD test tasks — ESC/POS adapter

- [ ] **T220** [P] [US1] Test (failing): ESC/POS adapter writes the byte stream + polls the status byte; returns success on "ok" status; returns typed failure on "paper out" / "jam" / "offline" / "unknown" status — `tests/unit/main/receipts/escpos-adapter.status-handling.test.ts`
- [ ] **T221** [P] [US1] Test (failing): ESC/POS adapter timeout — if status poll exceeds the timeout (configured per Constitution §IV), returns `escpos_status_unknown` failure; sale row remains durable — `tests/unit/main/receipts/escpos-adapter.timeout.test.ts`

### TDD test tasks — OS-print fallback

- [ ] **T230** [P] [US1] Test (failing): OS-print fallback path invokes `webContents.print` with the HTML rendering; success callback → INSERT `print_events` row with `render_path='os_print', outcome='success'`; failure callback → INSERT with `outcome='failure', failure_reason='os_print_error'` — `tests/unit/main/receipts/print-pipeline.os-print-fallback.test.ts`

### TDD test tasks — first-print flow + audit

- [ ] **T240** [P] [US1] Test (failing): on AD-2 finalize completion, `receipts.print` internal handler fires automatically; renders payload + dispatches print + writes `print_events` row on success; emits `sale.receipt.printed` audit event with `render_path` + `print_event_id` — `tests/integration/sales/print-pipeline.auto-fires-on-finalize.test.ts`
- [ ] **T241** [P] [US1] Test (failing): print failure → `print_events` row written with `outcome='failure'` + closed `failure_reason` enum (`printer_offline` / `printer_out_of_paper` / `printer_jam` / `os_print_error` / `escpos_write_failure` / `escpos_status_unknown`); emits `sale.receipt.print_failed` audit event; **Sale row remains durable** (no rollback) — `tests/integration/sales/print-pipeline.failure-keeps-sale-durable.test.ts`
- [ ] **T242** [P] [US1] Test (failing): the full receipt payload (HTML or ESC/POS bytes) does NOT appear in any pino log, Sentry event, audit-event row, or support bundle (FR-071 inheritance; AD-9 redaction discipline) — `tests/unit/main/receipts/print-pipeline.payload-not-logged.test.ts`

### TDD test tasks — retry-print flow

- [ ] **T250** [P] [US1] Test (failing): `receipts.retryPrint({ sale_id, idempotency_key })` re-runs the print pipeline; success → INSERT `print_events` row with `purpose='retry_after_failure', outcome='success', previous_failed_print_event_ids=[<failed-row-ids>]`; emits `sale.receipt.print_retried_success` audit event — `tests/unit/main/receipts/bridge.receipts-retry-print.success.test.ts`
- [ ] **T251** [P] [US1] Test (failing): a retry that succeeds is treated as the canonical first print (FR-052) — no duplicate-copy marker, drawer-kick eligible on a cash-inclusive sale (the drawer-kick gating itself is Slice 4; this test asserts only that the audit event shape and the `print_events` row support this) — `tests/unit/main/receipts/bridge.receipts-retry-print.first-print-semantics.test.ts`
- [ ] **T252** [P] [US1] Test (failing): a still-failed retry returns `kind:'ok'` with `outcome:'failure'` (NOT `kind:'refused'`) because the retry attempt itself was accepted (Path C in quickstart) — `tests/unit/main/receipts/bridge.receipts-retry-print.still-failed.test.ts`
- [ ] **T253** [P] [US1] Test (failing): idempotency replay — identical-payload `receipts.retryPrint` is a no-op returning the original outcome; payload-mismatch refuses with `idempotency_payload_mismatch` (Constitution §P5) — `tests/unit/main/receipts/bridge.receipts-retry-print.idempotent.test.ts`

### TDD test tasks — persistent printer-failure banner

- [ ] **T260** [P] [US1] Test (failing): `<PrinterFailureBanner>` mounts whenever the latest `print_events` row for a recently finalized sale has `outcome='failure'`; banner is non-modal, **does not auto-dismiss**, includes three affordances (Retry print / Reprint / Manual receipt override) each ≥ 44×44 px (NFR-002 / Constitution §IV / FR-068) — `tests/unit/renderer/receipts/PrinterFailureBanner.persistence.test.tsx`
- [ ] **T261** [P] [US1] Test (failing): banner observes `sales.subscribe(topic='banner_state')` for live banner-state updates — `tests/unit/renderer/receipts/PrinterFailureBanner.subscription.test.tsx`
- [ ] **T262** [P] [US1] Test (failing): banner Reprint button is **disabled** until a successful print exists (per AD-10 reprint precondition); banner Retry button always enabled while in failure state; Manual override always enabled while in failure state — `tests/unit/renderer/receipts/PrinterFailureBanner.affordance-gating.test.tsx`
- [ ] **T263** [P] [US1] Test (failing): accessibility — banner is keyboard-operable, has screen-reader landmark, focus management lands on the banner when it first mounts (P14) — `tests/unit/renderer/receipts/PrinterFailureBanner.a11y.test.tsx`

### Implementation tasks — print pipeline

- [ ] **T270** [US1] Implement the ESC/POS adapter wrapper around the chosen library (T201–T202): write-and-status-poll API with timeout + typed failure result — `src/main/receipts/escpos-adapter.ts`
- [ ] **T271** [P] [US1] Implement the OS-print fallback wrapper around `webContents.print`: callback-to-promise adapter returning success / typed failure — `src/main/receipts/os-print-adapter.ts`
- [ ] **T272** [US1] Implement the print pipeline module (`print-pipeline.ts`): renders payload via Slice 2's template engine → path-selects (ESC/POS preferred, OS-print fallback) → awaits ack → INSERTs `print_events` row → emits audit event — `src/main/receipts/print-pipeline.ts`
- [ ] **T273** [US1] Wire the print pipeline into AD-2 finalize completion: after `sale.finalized` audit emit, dispatch the print pipeline asynchronously (the print is NOT part of the AD-2 atomic transaction; the Sale row stays durable regardless of print outcome) — `src/main/sales/finalize-listener.ts`

### Implementation tasks — `receipts.*` mutating handlers (retry)

- [ ] **T280** [US1] Implement `receipts.retryPrint` bridge handler: gate + idempotency + re-runs print pipeline + writes the `previous_failed_print_event_ids` lineage on the new `print_events` row — `src/main/receipts/receipts-bridge.ts`
- [ ] **T281** [US1] Extend `src/shared/bridge-api.ts` with `receipts.retryPrint` Request / Response types per `contracts/bridge-api.md §"receipts.retryPrint"` (note the three-way response: success, refused, still-failed) — `src/shared/bridge-api.ts`

### Implementation tasks — renderer banner

- [X] **T290** [US1] [IMPECCABLE craft] Implement `<PrinterFailureBanner>` component per `/impeccable craft 008-printer-failure-banner` against the §A1 shape brief; subscribes to `sales.subscribe(topic='banner_state')`; renders the three affordances; no auto-dismiss; ≥44×44 controls. Component MUST satisfy the failing tests already written in T260 / T261 / T262 / T263 (red-bar confirmation per `docs/impeccable-embed-preflight.md §4.2` recorded in `coordination.md` before invocation) — `src/renderer/ui/receipts/PrinterFailureBanner.tsx` *(DONE — PR #281 `9fbb906`; 25 tests, 100% L/B + ≥90% F. Retry → receipts.retryPrint live; Reprint/Manual are required entry-point props, handlers Slice 5/6.)*
- [X] **T291** [P] [US1] Wire the banner mount into the renderer's persistent-banner host (per 003 / 007 banner-host pattern; layered on top of connection-state / operator-session banners per NFR-008) — `src/renderer/shell/AppShell.tsx` *(DONE 2026-05-29 — the deferred-feed slice landed: `sales.subscribe(banner_state|recent)` un-stubbed to a SNAPSHOT projection (`banner-state-projector.ts`, per-sale silent-failure-safe rule), renderer `useBannerState` poll hook, AppShell mounts `<PrinterFailureBanner>` fed by it. NOT a `webContents.send` push — snapshot+poll, mirroring 005/006 + the poll-based AD-2 design; see coordination.md §S3c mechanism-corrected note. Host path corrected: `BannerHost.tsx` never existed; banners mount in `AppShell.tsx`. Reprint/Manual remain entry-points (Slice 5/6).)*

### Slice 3 verification

- [ ] **T300** Run `npx vitest tests/unit/main/receipts/ tests/integration/sales/print-pipeline*.test.ts tests/unit/renderer/receipts/PrinterFailureBanner*` with coverage; assert ≥ 95 % on the print pipeline + adapter + retry handler, ≥ 90 % on the banner — `tests/`
- [ ] **T301** [§A3] Hardware integration test: with a real thermal printer attached, drive a 006 settlement → 008 finalize → receipt prints. Record the result + observations in `docs/hardware-matrix.md` under the test row — `docs/hardware-matrix.md`
- [ ] **T302** [§A3] Hardware integration test (failure path): with the printer disconnected, drive a 006 settlement → 008 finalize → assert banner persists, sale durable, retry succeeds when printer reconnects, no duplicate-copy marker on the retried slip (FR-052) — `docs/hardware-matrix.md`
- [ ] **T303** Record Slice 3 functional sign-off + per-module coverage + §A3 hardware-matrix entry in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md`

---

## Phase 6 — Slice 4: Drawer-kick + drawer-failure banner + drawer audit

**Status:** ✅ **SOFTWARE-COMPLETE — merged to `main` 2026-05-29** (T310–T370 + T361). Landed via #285 (coexistence record) + #286 (S4a drawer-kick) + #290 (S4b banner, re-land of orphaned #288) + #291 (S4c clear-path, re-land of orphaned #289); see `coordination.md §"Slice 4 close-out"`. **Remaining:** T371/T372/T373 §A3 hardware integration (deferred to the T200 Epson TM-T20III + APG VBS320 bring-up; STUB transport honest-fails `no_drawer_configured` until then) + T374 human functional sign-off.

**Purpose:** Implement the separate ESC/POS DK1/DK2 pulse drawer-kick (AD-8); implement gating (FR-040: only first print of cash-inclusive sale, after print-success ack); implement double-kick suppression (FR-053); implement `drawer_events` row INSERT on opened / suppressed / failed; emit `sale.drawer.*` audit events; implement persistent drawer-failure banner with manual-override affordance.
**Gates:** §A1 (Slice 0 sign-off; drawer-failure banner visuals signed off) + §A2 (no-op) + §A3 (drawer hardware bring-up record) + §A4 (no new renderer-callable surface — confirm `drawer.*` remains main-only). **Held.**
**User stories:** US1 acceptance scenarios 4 (drawer opens on cash-inclusive first print), 5 (drawer does NOT open on cashless), 9 (drawer failure doesn't invalidate sale).
**Test floor:** ≥ 95 % on drawer-kick logic; cashless no-kick test; reprint no-kick test; double-kick suppression test; drawer-failure banner test.

### TDD test tasks — drawer-kick gating

- [X] **T310** [P] [US1] Test (failing): drawer kick fires ONLY when (a) Sale durably committed, (b) print-success ack received, (c) tender mix includes ≥ 1 applied `cash` line — all three gates per FR-040. Any failure of any gate → no kick — `tests/unit/main/drawer/drawer-kick.gating.test.ts` *(landed as `tests/unit/main/drawer/drawer-kick.test.ts`)*
- [X] **T311** [P] [US1] Test (failing): cashless sale (only `external_card_terminal` and/or `internal_voucher` lines) → drawer NOT kicked; INSERT `drawer_events` row with `outcome='suppressed', suppression_reason='cashless_tender_mix'`; emits `sale.drawer.suppressed` audit event (FR-042) — `tests/unit/main/drawer/drawer-kick.cashless-suppression.test.ts` *(landed in `drawer-kick.test.ts`)*
- [X] **T312** [P] [US1] Test (failing): reprint of a cash-inclusive sale → drawer NOT kicked; the UNIQUE constraint on `drawer_events.sale_id` from Slice 1 prevents a second row (FR-030 / FR-053). The reprint flow does NOT attempt to INSERT a fresh suppressed row either, because the existing `drawer_events` row already captures the sale's drawer history — `tests/integration/sales/drawer-kick.reprint-no-kick.test.ts` *(landed in `drawer-kick.integration.test.ts` — `readBySale`-guard no-op covers reprint)*
- [X] **T313** [P] [US1] Test (failing): double-kick suppression — a print-retry-after-failure on a cash-inclusive sale whose drawer already opened in a partial-success earlier attempt does NOT re-kick; main-side check on existence of `drawer_events` row with `outcome='opened'` (FR-053 / Risk R-5) — `tests/integration/sales/drawer-kick.double-kick-suppression.test.ts` *(landed in `drawer-kick.integration.test.ts`)*

### TDD test tasks — drawer-kick mechanism (separate-command rule)

- [X] **T320** [P] [US1] Test (failing): drawer kick is issued as a **separate ESC/POS write** distinct from the receipt byte stream (AD-8); embedded-in-receipt kick is NOT used — assert by inspecting the byte stream of the print attempt and confirming no DK1/DK2 pulse sequence inside it; the kick is a follow-up write — `tests/unit/main/drawer/drawer-kick.separate-command.test.ts` *(landed in `drawer-kick.integration.test.ts` — scans receipt bytes for no `ESC p` opcode; kick is its own `DrawerKickTransport.kick()`)*
- [X] **T321** [P] [US1] Test (failing): drawer-kick command awaits printer status ack; success → INSERT `drawer_events` with `outcome='opened'`, emits `sale.drawer.opened`; failure → INSERT `drawer_events` with `outcome='failed', failure_reason=<closed enum>`, emits `sale.drawer.failed` with `last_successful_open_at_for_terminal` populated (Constitution §IV) — `tests/unit/main/drawer/drawer-kick.ack-handling.test.ts` *(landed in `drawer-kick.test.ts`)*

### TDD test tasks — drawer-failure banner

- [X] **T330** [P] [US1] Test (failing): `<DrawerFailureBanner>` mounts whenever the latest `drawer_events` row for a recently finalized sale has `outcome='failed'`; banner is non-modal, **does not auto-dismiss**, includes the manual-override affordance + the relative `last_successful_open_at` timestamp ("last opened: 2 hours ago"); banner is visually distinct from the printer-failure banner (NFR-008) — `tests/unit/renderer/receipts/DrawerFailureBanner.persistence.test.tsx`
- [X] **T331** [P] [US1] Test (failing): banner **does NOT** offer a retry-kick affordance (per quickstart §Path D — retry-kick would either violate FR-053 or have no audit anchor); only the manual-override affordance is offered — `tests/unit/renderer/receipts/DrawerFailureBanner.no-retry.test.tsx`
- [X] **T332** [P] [US1] Test (failing): accessibility — banner is keyboard-operable, has screen-reader landmark, focus management lands on the banner when it first mounts; manual-override button ≥ 44×44 px (P14) — `tests/unit/renderer/receipts/DrawerFailureBanner.a11y.test.tsx` *(focus deliberately does NOT auto-shift on mount — §A1 keyboard contract, mirrors PrinterFailureBanner)*

### TDD test tasks — drawer audit redaction

- [X] **T340** [P] [US1] Test (failing): drawer-event audit payloads contain NO sensitive fields (no PAN, no voucher, no PIN, etc.); the `last_successful_open_at_for_terminal` field is a UTC timestamp only — `tests/unit/main/drawer/drawer-events.audit-redaction.test.ts` *(landed in `drawer-kick.test.ts` — by-value payload-key assertion + `emitRaw` forbidden-key scan)*

### Implementation tasks — drawer pipeline

- [X] **T350** [US1] Implement the drawer-kick module: separate ESC/POS DK1/DK2 pulse write to the printer adapter; status-poll ack handling; typed success / failure result — `src/main/drawer/drawer-kick.ts` *(+ injected `drawer-kick-transport.ts` port; STUB transport → honest `no_drawer_configured` until T200)*
- [X] **T351** [US1] Implement the drawer-kick gating logic: reads the Sale's `tender_lines_summary_json` to check for cash; queries `drawer_events.findBySale` for prior `outcome='opened'` (FR-053 suppression); queries print-event purpose to distinguish first-print from reprint — `src/main/drawer/drawer-kick.ts` *(`hasCashTender` + `readBySale` guard; per-outcome `record{Suppressed,Opened,Failed}` helpers)*
- [X] **T352** [US1] Wire the drawer-kick dispatch into the print pipeline (Slice 3's `print-pipeline.ts`): after a successful first-print `print_events` INSERT for a cash-inclusive sale, dispatch the kick. After a successful reprint, INSERT a suppressed drawer event but do NOT call the kick. After a cashless first-print, INSERT a suppressed drawer event with reason `cashless_tender_mix` — `src/main/receipts/print-pipeline.ts` *(STALE PATH: wired at the real INSERT/audit seam `dispatch-first-print-on-finalize.ts` + `receipts-bridge.ts` retry-success per FR-052, NOT the pure-render `print-pipeline.ts`. `dispatchFirstPrint` surfaces `print_event_id` for the FK. Reprint = `readBySale`-guard no-op, NOT a fresh suppressed INSERT — matches FR-055/T312, supersedes this row's "INSERT a suppressed drawer event" on reprint.)*

### Implementation tasks — renderer banner

- [X] **T360** [US1] [IMPECCABLE craft] Implement `<DrawerFailureBanner>` component per `/impeccable craft 008-drawer-failure-banner` against the §A1 shape brief; subscribes to `sales.subscribe(topic='banner_state')`; renders the manual-override affordance + relative `last_successful_open_at` timestamp via `formatters`; no auto-dismiss; layered above the connection-state banner (NFR-008). Component MUST satisfy the failing tests already written in T330 / T331 / T332 (red-bar confirmation per `docs/impeccable-embed-preflight.md §4.2` recorded in `coordination.md` before invocation) — `src/renderer/ui/receipts/DrawerFailureBanner.tsx` *(presentational; live feed via the `useDrawerBannerState` poll hook reading the `.drawer_failure` slice; `formatRelativeTime` added at `src/shared/formatters/time-formatters.ts`; red-bar recorded in coordination.md)*
- [X] **T361** [P] [US1] Extend `BannerHost.tsx` to stack the drawer-failure banner alongside the printer-failure banner (both can coexist; visual order: printer-failure on top, drawer-failure below) — `src/renderer/ui/banners/BannerHost.tsx` *(STALE PATH: `BannerHost.tsx` never existed — mounted as a sibling BELOW `<PrinterFailureBanner>` in `src/renderer/shell/AppShell.tsx`, same correction as T291. Coexistence is the `BannerState` record `{printer_failure|null; drawer_failure|null}`, each banner reads its own slice.)*

### Slice 4 verification

- [X] **T370** Run `npx vitest tests/unit/main/drawer/ tests/integration/sales/drawer-*.test.ts tests/unit/renderer/receipts/DrawerFailureBanner*` with coverage; assert ≥ 95 % on drawer-kick logic, ≥ 90 % on the banner — `tests/` *(per-module floors confirmed on each PR branch: `drawer-kick.ts` ≥95% stmts/lines/funcs; banner ≥90%. Full suite on merged main: 4066 passed / 0 failed.)*
- [ ] **T371** [§A3] [DEFERRED → T200 bring-up] Hardware integration test: with a real thermal printer + cash drawer attached, drive a cash-inclusive 006 settlement → 008 finalize → assert drawer pops open AFTER receipt prints (separate-command timing verifiable by attention); record observation in `docs/hardware-matrix.md` — `docs/hardware-matrix.md`
- [ ] **T372** [§A3] [DEFERRED → T200 bring-up] Hardware integration test (failure path): with the drawer disconnected (printer attached, drawer cable unplugged), drive a cash-inclusive 006 settlement → 008 finalize → assert receipt prints, banner persists, sale remains durable. Record in `docs/hardware-matrix.md` — `docs/hardware-matrix.md`
- [ ] **T373** [§A3] [DEFERRED → T200 bring-up] Hardware integration test (cashless): drive an `external_card_terminal`-only 006 settlement → 008 finalize → assert drawer does NOT open, no banner, sale durable; record `sale.drawer.suppressed` audit event present — `docs/hardware-matrix.md`
- [ ] **T374** [HUMAN sign-off pending] Record Slice 4 functional sign-off + per-module coverage + drawer hardware-matrix entries in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md` *(close-out record + decisions + PR-stack + §A4 no-new-surface confirmation already drafted in coordination.md §"Slice 4 close-out"; the human functional sign-off line + the T371-373 hardware-matrix entries remain.)*

---

## Phase 7 — Slice 5: Reprint + duplicate-copy marker + reprint audit

**Purpose:** Implement `receipts.reprint` bridge handler (cashier-permitted per AD-10); use the `reprint_duplicate` template variant (Slice 2 asset); emit `sale.receipt.reprinted` audit with reprinter attribution; suppress drawer on reprint; suppress double-kick via the existing unique constraint.
**Gates:** §A1 (Slice 0 marker styling signed off) + §A2 (no-op) + §A4 (bridge review covers `receipts.reprint`). **Held.**
**User stories:** US1 acceptance scenario 7 (reprint with visible duplicate-copy marker, no mutation, no drawer kick).
**Test floor:** ≥ 95 % on the reprint flow; reprint-no-mutation test; reprint-no-drawer test; reprint-attribution test.

### TDD test tasks — reprint flow

- [X] **T400** [P] [US1] Test (failing): `receipts.reprint({ sale_id, idempotency_key })` succeeds when a prior PrintEvent with `(purpose='first_print' OR purpose='retry_after_failure') AND outcome='success'` exists for the sale; renders via `reprint_duplicate` template variant; INSERT `print_events` row with `purpose='reprint', outcome='success', duplicate_copy_sequence_number=1` for the first reprint — `tests/unit/main/receipts/bridge.receipts-reprint.success.test.ts` *(CLOSED — reprint is TWO-way (success | refused), NOT three-way like retry; a print failure refuses with `printer_unavailable`. Precondition uses `hasSuccessfulPrint` (safe superset of first_print/retry-success).)*
- [X] **T401** [P] [US1] Test (failing): `receipts.reprint` refuses with `not_yet_printed` when no successful PrintEvent exists for the sale (FR-028 precondition) — `tests/unit/main/receipts/bridge.receipts-reprint.precondition.test.ts`
- [X] **T402** [P] [US1] Test (failing): the n-th reprint INSERTs with `duplicate_copy_sequence_number=n` (derived from `countReprints(sale_id) + 1` — counts only successful reprints) — *(CLOSED — consolidated into `tests/unit/main/receipts/bridge.receipts-reprint.success.test.ts` "T402" describe block, not a separate sequence-number file.)*
- [X] **T403** [P] [US1] Test (failing): reprint **does NOT mutate** the Sale row — assert by snapshotting `sales` before and after; the AD-3 physical-layer trigger would reject any UPDATE anyway, but this test asserts the application code never tries — `tests/integration/sales/reprint.no-sale-mutation.test.ts`
- [X] **T403a** [P] [US1] *(added 2026-05-27 by /speckit-analyze remediation — closes finding G1; FR-011 receipt-number invariance)* Test (failing): **receipt-number invariance across reprint cycles** — (a) receipt_number invariant on every copy; (b) `sales.receipt_number` column unchanged; (c) `duplicate_copy_sequence_number` NULL on first print, 1 on first reprint, 2 on second reprint. — *(CLOSED — consolidated into `tests/integration/sales/reprint.no-sale-mutation.test.ts` "T403a" describe block, not a separate `reprint.receipt-number-invariance.test.ts` file.)*
- [X] **T404** [P] [US1] Test (failing): reprint **does NOT kick the drawer** — no DK1/DK2 pulse issued; no second `drawer_events` row INSERTed (the UNIQUE constraint on `drawer_events.sale_id` would reject one anyway) (FR-030) — `tests/integration/sales/reprint.no-drawer-kick.test.ts` *(reprint path wires NO drawerKickDispatcher — kick is structurally impossible; test asserts no fresh drawer_events row.)*

### TDD test tasks — reprint attribution

- [X] **T410** [P] [US1] Test (failing): `receipts.reprint`'s `print_events` row carries `acting_operator_id = <current signed-in operator>` (the **reprinting** operator), NOT the Sale row's `selling_operator_id`; the audit event payload carries BOTH operator ids (FR-024 / AD-10) — `tests/unit/main/receipts/bridge.receipts-reprint.attribution.test.ts` *(audit payload: `reprinting_operator_id` + `selling_operator_id`.)*
- [X] **T411** [P] [US1] Test (failing): tenant isolation — `receipts.reprint` refuses with `sale_not_found` (per the §A4 information-leak rule — NOT `tenant_isolation`) when the current session's tenant/branch/terminal does not match the Sale's — *(CLOSED — consolidated into `tests/unit/main/receipts/bridge.receipts-reprint.attribution.test.ts` "T411" describe block; reuses the shared `scopedSale` helper.)*
- [X] **T412** [P] [US1] Test (failing): `receipts.reprint` is **cashier-permitted** — gated only on `requireOperatorSession` with no role restriction; cashier, manager, and admin can all invoke (AD-10) — *(CLOSED — consolidated into `tests/unit/main/receipts/bridge.receipts-reprint.attribution.test.ts` "T412" describe block (it.each over cashier/manager/admin).)*

### TDD test tasks — duplicate-copy marker visual

- [X] **T420** [P] [US1] Test (failing): the rendered reprint slip (HTML and ESC/POS bytes) contains the bilingual marker "نسخة طبق الأصل — DUPLICATE COPY" in the header band — *(ALREADY COVERED by Slice 2's `tests/unit/main/receipts/template-engine.test.ts` "T123 — duplicate-copy marker" describe block: marker present on `reprint_duplicate`, in both `text` (HTML) and bytes. The template engine was completed in Slice 2; no new code.)*
- [X] **T421** [P] [US1] Test (failing): the first-print slip (HTML and ESC/POS bytes) does NOT contain the duplicate-copy marker — *(ALREADY COVERED by `template-engine.test.ts` T123 "omits the marker on first_print" + "omits the marker on preview".)*

### TDD test tasks — reprint affordance gating

- [X] **T430** [P] [US1] Test (failing): `<ReprintAffordance>` component is visible ONLY when the Sale has at least one `print_events` row with `outcome='success'` (AD-10) — `tests/unit/renderer/receipts/ReprintAffordance.gating.test.tsx` *(gated via a `has_successful_print` prop; the parent surface supplies it from the `latest_print_event` projection. Component renders null when false.)*
- [X] **T431** [P] [US1] Test (failing): clicking Reprint generates a fresh `idempotency_key` UUID v4 per click and calls `receipts.reprint`; touch target ≥ 44×44 (FR-068); keyboard-operable (FR-069) — `tests/unit/renderer/receipts/ReprintAffordance.invocation.test.tsx`

### Implementation tasks — bridge handler

- [X] **T440** [US1] Implement `receipts.reprint` bridge handler: `requireOperatorSession` gate (no role restriction per AD-10) + tenant-isolation (`scopedSale` → `sale_not_found`) + precondition check (`hasSuccessfulPrint` → `not_yet_printed`) + `countReprints+1` sequence + renders via `reprint_duplicate` variant + dispatches `dispatchReprint` + emits `sale.receipt.reprinted` with dual attribution — `src/main/receipts/receipts-bridge.ts` *(also extended `print-dispatcher.ts` with `dispatchReprint`; reprint is repeatable so there is NO idempotency no-op — the contract's `idempotency_payload_mismatch` arm is vestigial for a sale-scoped key. IPC handler registered in `src/main/ipc/receipts.ts` (REPRINT channel); preload exposes `receipts.reprint` in `src/preload/receipts.ts`.)*
- [X] **T441** [US1] Extend `src/shared/bridge-api.ts` with `receipts.reprint` Request / Response types per `contracts/bridge-api.md §"receipts.reprint"` — `src/shared/bridge-api.ts` *(TWO-way `ReceiptsReprintResponse`; channel key added to `src/shared/receipts/channels.ts`.)*

### Implementation tasks — renderer

- [ ] **T450** [US1] [IMPECCABLE craft] Implement `<ReprintAffordance>` component per `/impeccable craft 008-reprint-affordance` against the §A1 shape brief; gated visibility; invokes `receipts.reprint`; surfaces success / refusal. **FUNCTIONAL CORE DONE, CRAFT GATE OPEN:** the component exists at `src/renderer/ui/receipts/ReprintAffordance.tsx` and satisfies T430/T431 (gated visibility via `has_successful_print`; fresh idempotency key per click; inline refusal + re-enable on failure; 44×44 floor; native-button keyboard-operable; local bridge var named `receiptsApi` not `bridge` to satisfy the `no-backend-ipc-persistence` architecture guard). **STILL OPEN before Slice 5 merge:** the mandatory `/impeccable craft` polish pass + the §A1 red-bar confirmation record in `coordination.md` (per `docs/impeccable-embed-preflight.md §4.2`) were NOT performed — left unchecked so the tracker reflects the open craft gate. — `src/renderer/ui/receipts/ReprintAffordance.tsx`
- [X] **T451** [P] [US1] Wire `<ReprintAffordance>` into the "find sale" / "recent sale" UI surfaces (renderer integration; the surfaces themselves are part of 005's existing search UI and 007's nav patterns — touch only the receipt-affordance slot) — `src/renderer/ui/receipts/FindSaleReceipt.tsx` + `src/renderer/routes/app/SalesPlaceholder.tsx` *(CLOSED — 005's find-sale search screen was never built as a real surface (SalesPlaceholder was a stub), so the minimal receipt-affordance host `<FindSaleReceipt>` was added: a sale-number lookup via `sales.findByNumber` → renders the sale summary → mounts `<ReprintAffordance>` gated on `latest_print_event.outcome==='success'`. Mounted into the Sales route (`SalesPlaceholder` default branch). The reprint feature is now USER-REACHABLE. The fuller sale-search/recent-list UI remains 005's territory. 4 tests in `tests/unit/renderer/receipts/FindSaleReceipt.test.tsx`.)*

### Slice 5 verification

- [ ] **T460** Run `npx vitest tests/unit/main/receipts/bridge.receipts-reprint*.test.ts tests/integration/sales/reprint*.test.ts tests/unit/renderer/receipts/ReprintAffordance*` with coverage; assert ≥ 95 % on the reprint flow, ≥ 90 % on the affordance component — `tests/`
- [ ] **T461** [§A1] **Manual visual review at counter distance.** Print a `reprint_duplicate` slip; stand at the customer side of the counter (~1.5 m); glance for ~2 seconds. **The bilingual duplicate-copy marker MUST be obvious** — both languages visible, bold, top-of-slip placement. A reviewer who has to squint or read carefully → marker is too subtle, fails the review, blocks Slice 5 merge. Record outcome in coordination.md and `docs/hardware-matrix.md` — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T462** [§A3] Hardware integration test: reprint a sale on a real thermal printer; verify the marker, drawer does NOT pop, sale unchanged; record in `docs/hardware-matrix.md` — `docs/hardware-matrix.md`
- [ ] **T463** Record Slice 5 functional sign-off + per-module coverage + Slice 5 manual visual review result in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md`

---

## Phase 8 — Slice 6: Manual-override + sync-outbox finalisation + production readiness

**Purpose:** Implement `receipts.manualOverride` bridge handler; renderer manual-override affordance on the printer-failure banner; handle the "first-print after manual override" edge case (FR-052 + spec Edge Case); finalise the sync-outbox contract (it was already written in Slice 1, but Slice 6 records the §A5 production-readiness gate against it); production-readiness verification (coverage, redaction audit, support runbook, hardware matrix, rollback strategy).
**Gates:** §A1 + §A2 (no-op) + §A4 + **§A5**. **Held; blocks rollout, not slice merge.**
**User stories:** US1 manual-override path; the "first-print after manual override" edge case; US1 acceptance scenario 14 (final sync-handoff staging verification).
**Test floor:** ≥ 95 % on manual-override flow; full-suite coverage audit; redaction audit; hardware matrix complete.

### TDD test tasks — manual-override flow

- [X] **T500** [P] [US1] Test (failing): `receipts.manualOverride({ sale_id, idempotency_key })` succeeds when invoked from the printer-failure banner; INSERT `print_events` row with `purpose='first_print', outcome='manual_override', render_path=NULL`; emits `sale.receipt.manual_override` audit event with overrider attribution — `tests/unit/main/receipts/bridge.receipts-manual-override.success.test.ts` *(CLOSED — handler writes the row DIRECTLY (not via the dispatcher — the CHECK requires render_path NULL on a manual_override row, and no slip is rendered); attribution = current overriding operator; audit via `emitRaw`. Includes a fallback-id coverage test.)*
- [X] **T501** [P] [US1] Test (failing): manual override does NOT kick the drawer (the print never succeeded); no `drawer_events` row INSERTed — `tests/integration/sales/manual-override.no-drawer-kick.test.ts` *(the manualOverride path wires no drawer dispatcher — kick is structurally impossible.)*
- [X] **T502** [P] [US1] Test (failing): edge case — after a manual override, the next successful retry-print INSERTs with `purpose='retry_after_failure', outcome='success'`, NOT `purpose='reprint'`; no duplicate-copy marker (FR-052 + spec Edge Case) — `tests/integration/sales/manual-override.then-retry-success.test.ts` *(CLOSED — REQUIRED narrowing the merged Slice-3 retry idempotency guard from `success || manual_override` to `success` ONLY (Ahmed 2026-05-30): a manual_override is NON-terminal, so a later retry runs. The conflicting T253 manual_override sub-test was flipped to assert the new behavior. See contract §receipts.manualOverride "the cashier can still invoke retryPrint later".)*
- [X] **T503** [P] [US1] Test (failing): edge case (continued) — after a manual override + successful retry, drawer-kick gating runs normally on the retry success (cash-inclusive → drawer pops); UNIQUE(sale_id) ensures one DrawerEvent total — *(CLOSED — consolidated into `tests/integration/sales/manual-override.then-retry-success.test.ts` "T503" case, not a separate `manual-override.retry-then-drawer-kicks.test.ts` file. Reuses the merged retry-success → `dispatchOnFirstPrintSuccess` drawer chain.)*
- [X] **T504** [P] [US1] Test (failing): idempotency replay on `receipts.manualOverride` — identical-payload no-op (Path A, key-on-state: a prior manual_override row IS the key); payload-mismatch arm unreachable for a sale-scoped key — `tests/unit/main/receipts/bridge.receipts-manual-override.idempotent.test.ts` *(+ gate refusals: no_session / sale_not_found / forbidden_field_in_request.)*

### Implementation tasks — manual-override

- [X] **T510** [US1] Implement `receipts.manualOverride` bridge handler: `requireOperatorSession` gate (via `scopedSale`) + Path-A idempotency + INSERT `print_events` `(purpose='first_print', outcome='manual_override', render_path=NULL)` + `sale.receipt.manual_override` audit emit; banner dismissed via the banner_state projection (the override row supersedes the failure) — `src/main/receipts/receipts-bridge.ts` *(synchronous internally; returns `Promise.resolve(runManualOverride(req))` to satisfy the Promise contract without an unused `async`.)*
- [X] **T511** [US1] Extend `src/shared/bridge-api.ts` with `receipts.manualOverride` Request / Response types per `contracts/bridge-api.md §"receipts.manualOverride"` — `src/shared/bridge-api.ts` *(two-way response; `receipts:manualOverride` IPC channel + main handler + preload exposure also wired.)*
- [x] **T512** [US1] [IMPECCABLE craft→polish] — **DONE 2026-05-30 (craft gate closed via `/impeccable polish`).** Functional core done earlier (PR #294). The §4.2 craft-marker could not fire against the 28 green tests (preflight violation); run as **polish** instead (the §4.2-exempt post-merge marker) — owner-confirmed substitution. Polish adopted the shared `.btn__spinner` + `aria-busy` on the in-flight action (DESIGN.md §5; surfaces WHICH action runs — PRODUCT.md Principle 3); +1 test (29 green), typecheck+lint clean. §A1 red-bar = adopt-existing-pattern confirmation (no new visual direction); owner accepts by merging the T512 polish PR. See coordination.md §"T512 `<PrinterFailureBanner>` manual-override — /impeccable POLISH record". Original: Wire the Manual receipt override button on `<PrinterFailureBanner>` to invoke `receipts.manualOverride` with a fresh idempotency key per click; on success, dismiss the banner. — `src/renderer/ui/receipts/PrinterFailureBanner.tsx`

### §A5 production-readiness tasks

- [x] **T520** [§A5] — **DONE (verified 2026-05-30; see a5-verification-findings.md §T520 — PASS, all named modules ≥ floor).** Coverage-floor audit: run full vitest suite with `--coverage`; assert ≥ 95 % on money-math, sale-number allocator, receipt-payload generator, template engine, print pipeline, drawer-kick logic, audit-event emitter, sync-outbox enqueuer, AD-2 finalize transaction, all `sales.*` + `receipts.*` bridge handlers; ≥ 90 % on the four renderer surfaces (preview, reprint affordance, printer-failure banner, drawer-failure banner). Record exact percentages in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md`
- [x] **T520a** [§A5] *(added 2026-05-27 by /speckit-analyze remediation — closes finding U1)* — **CLOSED 2026-05-30 (owner-accepted, printer-only; NO quantitative p95 captured — Ahmed accepted the BIXOLON OS-print bench as sufficient for the MVP in lieu of the ≥20-run measurement; drawer perf descoped; `008-perf-budgets.bench.ts` not authored. See coordination.md §"Owner bar-answer — 2026-05-30").** **Performance-budget timing assertion** on the §A3 hardware-matrix printer/drawer pair: drive the `cash-only-happy.fixture.json` fixture (per `quickstart.md §"Test fixtures"`) through a full 006→008 finalize→preview→print→drawer-kick cycle **N ≥ 20 runs**, capture per-stage timings, and assert the **95th-percentile** values: preview ready ≤ **500 ms** (NFR-005), end-to-end "settled signal → drawer-open ack" on a cash-inclusive sale ≤ **3 seconds** (NFR-006 / SC-001), reprint ready ≤ **3 seconds** (NFR-007 via the `reprint_duplicate` template). Also run `mixed-cash-voucher.fixture.json` and `cashless-card-only.fixture.json` against NFR-006 (cashless path skips the drawer kick but still must meet the 3-second end-to-end ceiling). Record the per-fixture p50 / p95 / p99 timings + the printer/drawer model used in `docs/hardware-matrix.md` under a new "008 §A5 performance bring-up" section, and cross-reference in `coordination.md`. Failure → §A5 sign-off held pending root-cause + remediation. The measurement script lives at `tests/performance/sales/008-perf-budgets.bench.ts` and is invoked manually by the §A5 reviewer (NOT part of the CI gate, which has no hardware) — `docs/hardware-matrix.md` + `tests/performance/sales/008-perf-budgets.bench.ts`
- [x] **T521** [§A5] — **CLOSED 2026-05-30 (owner-accepted, Ahmed).** Runtime-redaction assertion ✅ done + merged (PR #309: `tests/integration/sales/t521-runtime-redaction.test.ts` — real dispatchers through real pino, no forbidden key/value at any depth, positive-control proves non-vacuity). Support-bundle export-tool audit: **N/A by absence** — no such export tool exists in `src/` yet; the §P11 forward-requirement is recorded (when built, it MUST route through `REDACTION_PATHS`). Owner accepted N/A-by-absence 2026-05-30. See coordination.md §"T521 — Runtime redaction assertion". Original: Redaction audit: grep all pino log output + Sentry events for forbidden-field key list (from `data-model.md §"Forbidden fields"`); assert ZERO occurrences across a full happy-path-plus-failure-paths test run. Audit `support-bundle` export tool to confirm same redaction discipline (Constitution §P11) — `specs/008-sale-finalization-and-receipts/coordination.md`
- [x] **T522** [§A5] — **RESOLVED 2026-05-30 (PR #299, observability slice `obs/redaction-card-voucher-surface`; case-(b) block cleared — scrubbers unified on `FORBIDDEN_PAYLOAD_KEYS` single source of truth). See a5-verification-findings.md §T522.** *(tightened 2026-05-27 by /speckit-analyze remediation — closes finding I1)* **Sentry scrubber decision tree.** Inspect the existing Sentry config + pino-redaction config against the full AD-9 redaction surface table in `plan.md §AD-9`. Decision tree:
  - **(a) If existing scrubber covers `external_reference` (per 006 FR-009 inheritance) AND the voucher-secret-field rejection list (`voucher_redemption_intent_token`, `voucher_code`, `voucher_balance`, `voucher_holder_pii`, raw authority payload — per 006 FR-017 inheritance + FR-071):** record `no_change_required` in `coordination.md` with the scrubber-config file + line references that establish coverage; §A5 sign-off proceeds.
  - **(b) If ANY of the AD-9 redaction-surface fields is NOT covered by the existing scrubber:** **block §A5 sign-off** pending a focused observability slice that extends the scrubber. Per Constitution §P11 / §P8, 008 MUST NOT smuggle scrubber extensions into a non-observability feature. Record the missing field(s), open a tracking issue / observability-slice spec stub, link from `coordination.md` + the §A5 row, and confirm 008 §A5 cannot ship until that slice merges.
  - **(c) If the question is ambiguous** (e.g., scrubber covers a regex that *might* match the field but the match is not explicit): treat as case (b) — block + escalate; do NOT assume coverage.

  Record the resolved branch (a / b / c) + supporting evidence in `coordination.md` — `specs/008-sale-finalization-and-receipts/coordination.md`
- [x] **T523** [§A5] Hardware-matrix completeness check — **CLOSED 2026-05-30 (owner-accepted; RE-SCOPED to printer-only by the 2026-05-30 owner decision — cash drawer DESCOPED to a future peripheral spec, so the original "printer + drawer pair" requirement is narrowed to printer-only).** `docs/hardware-matrix.md` now has the **BIXOLON SRP-330 II** promoted to a **tested (owner-accepted)** thermal-printer row (OS-print path; ESC/POS descoped) with driver + caveats. **Honest re: rule 1** — promotion rests on the owner-run manual bench smoke, not an automated CI integration test (no CI hardware); annotated owner-accepted-not-CI-tested in the row. See coordination.md §"Owner bar-answer — 2026-05-30". Original text: confirm `docs/hardware-matrix.md` has ≥ 1 tested thermal printer + cash drawer model pair with driver version + caveats; confirm Slice 3 / Slice 4 / Slice 5 test rows are present and ticked — `docs/hardware-matrix.md`
- [x] **T524** [§A5] Authoring of `docs/runbook/008-sale-finalization-and-receipts.md`: support runbook entry covering: (a) "drawer didn't open but receipt printed" diagnostic flow; (b) "manual override taken — how to find which sales used manual override" query against `print_events`; (c) "reprint slip looks identical to original — how do I tell?" answer (bilingual marker); (d) "how to investigate a sync-outbox row that's been pending for N days" (currently always — the future sync engine owns this); (e) `last_successful_open_at_for_terminal` interpretation — `docs/runbook/008-sale-finalization-and-receipts.md`
- [x] **T525** [§A5] Authoring of the rollback strategy document: 008's rollback options are (a) feature-flag disable (`sale_finalization=false` in `app-config.ts` — sales settle in 006 but 008's finalize listener short-circuits, no receipts print, drawer doesn't open; cashier falls back to manual receipts; **outbox queue stops growing** but existing rows remain); (b) NOT down-migration (the `sales` rows are durable financial records; down-migration is forward-fix territory per constitution P15 / Production Readiness Gates). Record the decision matrix in the runbook — `docs/runbook/008-sale-finalization-and-receipts.md`
- [x] **T526** [§A5] — **AS-BUILT VERIFIED 2026-05-30 (agent-performed, owner-accepted; NOT an independent human review).** Walked the eight-item §A4 checklist against the shipped `receipts-bridge.ts` + `sales-bridge.ts`: **7 PASS, 1 minor non-blocking drift** (item 1 — the surface is 4 `sales.*` incl. the post-§A4 read-only `unsubscribe`, vs the checklist's "three"; recommend updating the checklist text). No security property promised by the §A4-approved contract is violated. **Structural caveat:** the agent authored the surface, so this is drift-verification, not independent attestation — the load-bearing independent sign-off remains **Ahmed's §A4 human review, 2026-05-26** (`contracts/bridge-api.md` §A4 CLEARED), which stands underneath. Owner accepts by merging the closure PR. Full per-item evidence in coordination.md §"T526 — §A4 security-review handoff: as-built verification". Original: Security-review handoff on the full bridge surface + the trust boundary: walk the eight-item §A4 checklist in `contracts/bridge-api.md` against the as-built code; record reviewer + date + result — `specs/008-sale-finalization-and-receipts/coordination.md`
- [x] **T527** [§A5] — **DONE (verified 2026-05-30; see a5-verification-findings.md §T527 — PASS: zero `encryptString`/`decryptString` in 008 territory; 008 only reads cached terminal config).** Confirm `safeStorage` interactions are read-only in 008 (008 reads cached terminal config; does not write secrets); record in coordination.md — `specs/008-sale-finalization-and-receipts/coordination.md`
- [x] **T528** [§A5] — **VERIFIED 2026-05-30.** typecheck ✅, lint ✅, full `npm test` ✅, `codegen:verify` no-op ✅ (local + a5-verification-findings.md §T528). **`package:dir` ✅** — CI run **`26683045246`** (sha `70480ab4`, a code-bearing run) shows the "Package (Windows --dir, unsigned)" step **`success`**. Key finding: the recent `main` "failures" do NOT reflect package:dir — `ci.yml` **skips** the Package step on docs-only PRs (`if: steps.docs-check.outputs.docs_only != 'true'`), and the failures were the known self-hosted `cancelled`/`ENOTEMPTY` flake (tests passed in-log). package:dir genuinely passes on code runs; the T512 PR #311 run is the post-T512 re-confirmation. CI gates check: confirm `codegen:verify` passes as a no-op (AD-12), `typecheck` passes, `lint` passes, full `npm test` passes, `package:dir` smoke build passes on `windows-latest` — `specs/008-sale-finalization-and-receipts/coordination.md`
- [x] **T529** [§A5] — **§A5 SIGNED OFF (caveated) 2026-05-30 — RATIFIED.** Ratified by Ahmed's merge of the T529 PR #312 plus confirmed green current-main CI incl. `package:dir` (see "gate (b) MET" below). The §A5 production-readiness sign-off record is written in coordination.md §"T529 — §A5 production-readiness sign-off record" — all *other* sub-items closed/owner-accepted, reviewer (Ahmed) + date recorded, every caveat enumerated at the point of signature (T520a no-p95, T523 not-CI-tested, T521 support-bundle-N/A, T526 agent-verified-not-independent). The completing act — Ahmed's merge of the T529 PR — has occurred, so the §A5 sign-off is ratified. **Gate (b) MET 2026-05-30:** the original gate run `26684664263` (`282c436`) flaked at *Test with coverage* — `forced-close-form.test.tsx` timed out at 5000ms on a loaded runner (per-keystroke `userEvent.type` delay), so `package:dir` never ran. PR #313 hardened the test (`userEvent.setup({ delay: null })`) and landed on main as `2ae4022`; its CI run `26690694014` is **green incl. `package:dir`** (`✓ Package (Windows --dir, unsigned)`), so gate (b) is satisfied on the now-current main. Record Slice 6 functional sign-off + §A5 production-readiness sign-off in coordination.md (reviewer, date, all sub-items ticked) — `specs/008-sale-finalization-and-receipts/coordination.md`

---

## Phase Final — Polish & Cross-Cutting Concerns

**Purpose:** Documentation closeout, codemap update, CLAUDE.md banner advance, cross-feature index refresh. No new feature behavior.

- [ ] **T600** Update `CLAUDE.md` SPECKIT markers to reflect 008 status post-merge of each slice (transition 008 from `BLOCKED` → `S1 ✅` → … → `closed` as slices ship) — `CLAUDE.md`
- [ ] **T601** Update `docs/CODEMAPS/` to reflect the new modules: `src/main/sales/`, `src/main/receipts/`, `src/main/drawer/`, `src/main/sync-outbox/`, `src/renderer/ui/receipts/` — `docs/CODEMAPS/`
- [ ] **T602** Run `/update-docs` to regenerate any auto-generated documentation that touches the 008 surface — `docs/`
- [ ] **T603** Update `docs/brain/_INDEX.md` (if it lists active features) with 008 closeout pointers — `docs/brain/_INDEX.md`
- [ ] **T604** Close out `specs/008-sale-finalization-and-receipts/coordination.md` with the final gate-status table, PR list, and "what's next" pointer (likely the future sync-engine spec or the future refunds spec) — `specs/008-sale-finalization-and-receipts/coordination.md`
- [ ] **T605** Final spec-status banner update on `spec.md` from "Draft" to "SPEC COMPLETE" with the closeout date and final PR list — `specs/008-sale-finalization-and-receipts/spec.md`

---

## Dependency Graph

```text
Phase 1 — Setup (T001–T007)
    │
    ▼
Phase 2 — Slice 0 Visual direction (T010–T011)  [BLOCKS Slices 1, 2, 3, 5 renderer-touching tasks]
    │
    ▼
Phase 3 — Slice 1 *(load-bearing)* (T020–T113)
    │  Establishes: persistence (5 tables), AD-2 listener,
    │              AD-7 allocator, sales.* read bridge.
    │  All later slices DEPEND on this slice's tables existing.
    │
    ▼
Phase 4 — Slice 2 (T120–T182)
    │  Establishes: template engine, three template assets,
    │              receipts.preview bridge, preview UI.
    │  Slice 3 DEPENDS on the template engine (T160) and the
    │  payload derivation (T164).
    │
    ▼
Phase 5 — Slice 3 *(load-bearing)* (T200–T303)
    │  Establishes: print pipeline (ESC/POS + OS fallback),
    │              receipts.retryPrint, printer-failure banner.
    │  Slice 4 DEPENDS on the print pipeline being live to fire
    │  drawer kicks after print-success ack.
    │
    ▼
Phase 6 — Slice 4 (T310–T374)
    │  Establishes: drawer-kick (separate ESC/POS pulse),
    │              gating (FR-040 / FR-053), drawer-failure banner.
    │  Slice 5 + 6 are INDEPENDENT of Slice 4 functionally
    │  (Slice 5 is reprint, Slice 6 is manual-override + prod readiness).
    │  However: Slice 5 + Slice 4 share the BannerHost surface,
    │  so Slice 4 SHOULD merge before Slice 5 to settle the
    │  banner-host stacking order (T291 + T361).
    │
    ▼
Phase 7 — Slice 5 (T400–T463)
    │  Establishes: reprint flow, duplicate-copy template variant
    │              (asset signed off in Slice 0 / authored in Slice 2),
    │              reprint affordance, reprint audit.
    │  Slice 6 DEPENDS on Slice 5 to have established the
    │  reprint flow (manual-override → later retry doesn't
    │  reprint per FR-052 — Slice 6's edge-case test relies
    │  on Slice 5's print_events shape).
    │
    ▼
Phase 8 — Slice 6 (T500–T529)
    │  Establishes: manual-override flow, "first-print after
    │              manual-override" edge case, §A5 production
    │              readiness audit.
    │
    ▼
Phase Final (T600–T605) — Polish + closeout
```

**Critical path:** Phase 1 → Slice 0 → Slice 1 → Slice 2 → Slice 3 → Slice 4 → Slice 5 → Slice 6 → Polish. Slices 5 + 6 could theoretically run in parallel after Slice 4 (Slice 5 = reprint, Slice 6 = manual-override + prod readiness), but Slice 6's edge-case tests reference Slice 5's print_events shape so a sequential order is safer.

**Cross-slice safety dependencies:**

- Slice 4's `drawer_events` UNIQUE-on-sale_id constraint (T023) is the load-bearing safety guard for Slice 5's "reprint never kicks" rule (T404) and Slice 6's "manual-override-then-retry-then-drawer-kicks" edge case (T503). Slice 1 authoring this constraint is therefore critical-path for both later slices.
- Slice 2's template byte-stability test (T121) is the load-bearing safety guard for the FR-016 byte-stability rule across all later slices. A regression here would invalidate Slice 5's duplicate-copy-marker visual review (T461) and Slice 3's both-paths-byte-stable test (T211).

---

## Parallel Execution Examples

**Slice 1 §A3 migration tasks (T022, T023, T024, T025) can all run in parallel** once T020 (the `sales` table migration) is authored, because they each create a different table that FKs to `sales`. T021 (the `sales` append-only trigger) is independent of T022–T025.

**Slice 1 shared types (T032, T033) can run in parallel** with the §A3 migration tasks (T020–T026) because they touch a different file (`src/shared/sales/` vs `migrations/`).

**Slice 1 TDD test tasks**: T040, T041, T042, T043 (allocator tests) all `[P]` parallel because they each touch a different test file. Similarly T050–T054 (transaction tests), T055–T057 (refusal-guard tests), T060–T062 (forbidden-field tests), T070–T073 (bridge tests).

**Slice 1 repositories (T081, T082, T083, T084) all `[P]` parallel** because each is in its own file under `src/main/sales/repositories/`. T085 (the allocator implementation) is also `[P]` parallel because it's in `src/main/sales/sale-number-allocator.ts`.

**Slice 2 template variants (T161, T162, T163) all `[P]` parallel** because each is in its own asset file under `src/main/receipts/templates/`. T160 (the engine) is in a different file (`engine.ts`) and is also `[P]` parallel with T164 (`receipts-payload.ts`).

**Slice 3 adapter implementations (T270 vs T271) are `[P]` parallel** — ESC/POS adapter and OS-print adapter are in different files. T272 (the print pipeline wrapper) depends on both being authored first.

**Slices 5 and 6 final tasks: T461 (manual visual review) is a manual gate** that can run in parallel with Slice 5 test runs (T460); it does NOT block Slice 5 verification but it DOES block §A1 sign-off for Slice 5 merge.

**The §A3 hardware integration tests (T301, T302, T371, T372, T373, T462) can run as a group** during one hardware-bring-up session, ideally with the §A3 reviewer present, since they all touch a real printer + drawer setup.

---

## Implementation Strategy

**MVP scope** is **Slice 1 + Slice 2 + Slice 3** (the cash-inclusive sale finalises durably + receipt prints + bilingual slip is correct). This delivers the spec's Primary User Story's first eight acceptance scenarios on the happy path:

- AS1 (durable finalization) — Slice 1
- AS2 (sale number) — Slice 1
- AS3 (payload from durable sale) — Slice 2
- AS4 (cash sale prints) — Slice 3 *(drawer half lands Slice 4)*
- AS5 (cashless sale prints without drawer) — Slice 3 *(suppression-event landing Slice 4)*
- AS6 (preview before print) — Slice 2
- AS8 (printer failure stays loud) — Slice 3
- AS13 (attribution on receipt) — Slice 2

**Then Slice 4** delivers the drawer half of AS4 / AS5 + AS9 (drawer-kick failure doesn't invalidate sale).

**Then Slice 5** delivers AS7 (reprint with visible duplicate-copy marker).

**Then Slice 6** delivers the manual-override path + the §A5 production-readiness audit. Slice 6 is the **rollout gate**; everything else may merge to main without blocking customer rollout (gates §A1–§A4 cover slice merges; §A5 covers rollout).

**Slice ship order MUST be sequential** per the critical path above. No slice may merge before its predecessor has cleared its named gates. The plan locks this.

**Per-slice merge size budget:** mirroring 006's slicing, the load-bearing slices (Slice 1, Slice 3) may need 3–4 sub-PRs each. Suggested sub-slicing (only if a single PR grows too large):

- **Slice 1**: S1a = migrations + repositories + allocator; S1b = AD-2 listener + finalize transaction + refusal guard; S1c = `sales.*` bridge + preload + renderer subscription + verification.
- **Slice 3**: S3a = ESC/POS adapter + OS-print fallback + print pipeline; S3b = `receipts.retryPrint` bridge + persistent printer-failure banner; S3c = §A3 hardware integration + Slice 3 verification.

**Other slices (S0, S2, S4, S5, S6)** should each be one PR if possible.

---

## Coverage rollup target (final §A5 gate)

| Module | Floor | Tasks contributing |
|:--|:--:|:--|
| AD-7 sale-number allocator | ≥ 95 % | T040–T043, T085 |
| AD-2 finalize transaction + listener | ≥ 95 % | T050–T057, T090–T092 |
| Forbidden-field defensive validation | ≥ 95 % | T060–T062, T073, T093 |
| `sales.*` bridge handlers | ≥ 95 % | T070–T073, T100–T103 |
| Receipt template engine + payload derivation | ≥ 95 % | T120–T134, T160, T164 |
| `receipts.preview` bridge + UI | ≥ 90 % on UI, ≥ 95 % on bridge | T140–T142, T150–T152, T170, T173 |
| Print pipeline (ESC/POS + OS fallback) | ≥ 95 % | T210–T242, T270–T273 |
| `receipts.retryPrint` bridge | ≥ 95 % | T250–T253, T280 |
| Persistent printer-failure banner | ≥ 90 % | T260–T263, T290 |
| Drawer-kick logic + gating | ≥ 95 % | T310–T321, T350–T352 |
| Drawer-failure banner | ≥ 90 % | T330–T332, T360 |
| Drawer audit redaction | ≥ 95 % | T340 |
| `receipts.reprint` flow | ≥ 95 % | T400–T412, T440 |
| Duplicate-copy template variant | ≥ 95 % | T420–T421, T162 |
| Reprint affordance | ≥ 90 % | T430–T431, T450 |
| `receipts.manualOverride` flow | ≥ 95 % | T500–T504, T510 |
| Full-suite roll-up | per above | T520 |

**Total task count: 191** distinct task IDs (was 190 after the 2026-05-28 S1c.3 closeout-gap pass; T028a added 2026-05-28 from the Slice 2 prep audit — see coordination.md §"Slice 2 prep audit: line-snapshot persistence"). Per-phase breakdown:

| Phase | Tasks | Count |
|:--|:--|--:|
| Phase 1 — Setup | T001–T007 | 7 |
| Phase 2 — Slice 0 visual direction | T010–T011 | 2 |
| Phase 3 — Slice 1 *(load-bearing)* — finalize + persistence | T020–T028 + T028a (§A3 migrations; T028a added 2026-05-28 for line-snapshot persistence), T030–T033 (shared types), T040–T043 (AD-7 allocator), T050–T057 (AD-2 transaction + listener), T060–T062 (forbidden-field defence), T070–T073 (`sales.*` bridge tests), T080–T085 (persistence impl), T090–T093 (listener impl), T094a–T094c (S1c.3 closeout-gap bridge — added 2026-05-28), T100–T104 (`sales.*` bridge impl + §A4 sign-off), T110–T113 (verification) | 51 |
| Phase 4 — Slice 2 — receipt payload + preview | T120–T125 (template engine tests), T130–T134 (minimisation tests), T140–T142 (`receipts.preview` bridge tests), T150–T152 (preview UI tests), T160–T164 (engine + asset impl), T170–T173 (bridge + UI impl), T180–T182 (verification) | 26 |
| Phase 5 — Slice 3 *(load-bearing)* — print pipeline | T200–T202 (§A3 hardware), T210–T212 (path selection), T220–T221 (ESC/POS adapter), T230 (OS-print fallback), T240–T242 (first-print + audit + redaction), T250–T253 (retry flow), T260–T263 (printer-failure banner), T270–T273 (impl), T280–T281 (retry bridge impl), T290–T291 (banner impl), T300–T303 (verification) | 30 |
| Phase 6 — Slice 4 — drawer-kick + drawer-failure banner | T310–T313 (gating tests), T320–T321 (mechanism tests), T330–T332 (banner tests), T340 (audit redaction), T350–T352 (drawer impl), T360–T361 (banner impl), T370–T374 (verification) | 19 |
| Phase 7 — Slice 5 — reprint + duplicate-copy marker | T400–T412 (reprint flow + attribution + tenant isolation, includes **T403a** receipt-number invariance — G1 remediation), T420–T421 (marker visual), T430–T431 (affordance gating), T440–T441 (bridge impl), T450–T451 (UI impl), T460–T463 (verification + manual review) | 23 |
| Phase 8 — Slice 6 — manual-override + §A5 production readiness | T500–T504 (manual-override tests), T510–T512 (impl), T520–T529 (§A5 audit, includes **T520a** perf-budget timing assertion — U1 remediation) | 16 |
| Phase Final — Polish | T600–T605 | 6 |
| Renderer banner-host wiring + cross-slice infra | T011, T028, T067-equivalent §A3 sign-offs counted within their slices | (counted within phases above) |

The remaining tasks beyond the explicit per-phase ranges (e.g. some sub-tasks under hardware verification and coordination updates) are counted within their phases above. **The canonical total is 191 distinct task IDs**, verifiable by `grep -cE "^- \[[ Xx]\] \*\*T[0-9]{3}[a-z]?\*\*" tasks.md`. *(Earlier drafts: "185" pre-remediation, "187" after the 2026-05-27 `/speckit-analyze` remediation, "190" after the 2026-05-28 S1c.3 closeout-gap pass added T094a/T094b/T094c, and "191" after the 2026-05-28 Slice 2 prep audit added T028a. The 187 → 190 → 191 progression is recorded in the §"Last updated" passes (4) and (6) above.)*

---

*This task list is the source for `/speckit-implement`. Changes to the task plan after generation MUST update this file and re-run `/speckit-analyze` for cross-artifact consistency.*
