---
description: "Task list for 006-payments-tender — startable, file-path-bearing, slice-organised against plan v1.0; produced by /speckit-tasks 2026-05-19"
---

# Tasks: 006-payments-tender

**Feature:** 006-payments-tender — Payments & Tender
**Spec:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md) v1.0 (authored 2026-05-19; AD-1..AD-9 locked)
**Research:** [./research.md](./research.md)
**Data model:** [./data-model.md](./data-model.md)
**Contracts:** [./contracts/bridge-api.md](./contracts/bridge-api.md) (DRAFT — §A4 review required)
**Quickstart:** [./quickstart.md](./quickstart.md)
**Coordination:** [./coordination.md](./coordination.md)
**Visual direction:** `specs/006-payments-tender/visual-direction/README.md` (to be produced in Slice 0 under §A1)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-09
**Last updated:** 2026-05-23 (Slice 3 complete via this PR. T150–T154 renderer wiring + T160–T164 verification + sign-off ticked. Slice 3 closes — §A2 no-op confirmed for Slices 1–3; §A3 + §A4-A signed off 2026-05-21 (Ahmed). Eight findings (F-001 through F-008) remain as documentation divergences / 004-owner follow-ups. §A4-B + §A2 (voucher V-A) + §A5 held for Slice 4.)
**Status:** **Slice 0 ✅ · Slice 1 ✅ (PR #192, 2026-05-21) · Slice 2 ✅ (PR #198, 2026-05-21) · S3a ✅ (PR #207, 2026-05-22) · S3b ✅ (PR #209, 2026-05-23) · S3c ✅ (PR #210, 2026-05-23) · S3d ✅ (this PR, 2026-05-23) · Slice 3 closed · Slices 4–5 not started**

---

> ## STATUS: S3c complete — S3d next candidate (preflight required before implementation)
>
> Slice 0 ✅ (PR #189 / PR #190, 2026-05-20). Slice 1 ✅ — renderer-only
> tender selection + envelope ingest merged via **PR #192** (head
> `c48c34b`, merge commit `7d8588c`, 2026-05-21). T020–T034 complete.
> Slice 2 ✅ — per-tender entry surfaces (cash + external_card_terminal)
> merged via **PR #198** (head `5c56b93`, merge commit `9bb2af3`,
> 2026-05-21). T040–T051 complete. S3a ✅ — migrations + persistence
> repositories merged via **PR #207** (merge commit `e8b33d5`,
> 2026-05-22). T060–T067 + T110–T113 complete. S3b ✅ — shared types +
> PaymentAttempt FSM + TenderLine FSM + requireOperatorSession +
> idempotency replay + audit emitter merged via **PR #209** (merge
> commit `862d245`, 2026-05-23). T070–T073, T080–T088, T090–T094,
> T120–T121, T130–T132 complete. S3c ✅ — bridge handlers
> (`payments.*` + `tender.*`) + main-side IPC registration + preload
> contextBridge exposure merged via **PR #210** (merge commit
> `5f493fd`, 2026-05-23). T100–T106 + T133–T142 complete.
>
> **S3d remains BLOCKED** on S3c-GREEN + preflight (Template 1). Slice 4
> needs §A4-B `vouchers.*` review + §A2 voucher endpoints; §A5 is
> rollout-only.
>
> See [./coordination.md](./coordination.md) §"Gate ledger" for the
> live gate-state table and §"Maestro closeout — S3c (PR #210)"
> for the durable record of the S3c ship.

---

## Locked decisions (informational — do not re-open)

| Decision | Locked value | Source |
|:--|:--|:--|
| AD-1 — Payment FSM ownership | Main process owns PaymentAttempt FSM, TenderLine FSM, validation, settlement / cancel / fail / force-fail, audit emission, idempotency replay, trust boundary. Renderer display + input only. | plan §AD-1 |
| AD-2 — Persistence | Three new SQLite tables: `payment_attempts`, `payment_tender_lines`, `payment_action_outbox`. Plus extension of 004's `audit_events` catalogue with 4 attempt-level + 4 per-line categories. | plan §AD-2; data-model.md |
| AD-3 — Bridge namespace | Split: `payments.*` (attempt-level) + `tender.*` (per-line). Refusal envelope uses `{ kind: 'refused', reason: '...' }` (mirrors 005; diverges from 004's `category`). | plan §AD-3; research §R-2 |
| AD-4 — Cashier cancel UX | Cancel returns to **tender selection** with the immutable envelope still bound; applied TenderLines reversed LIFO per FR-006B. | plan §AD-4 |
| AD-5 — Force-fail UX | **Dedicated manager incident-response surface in Slice 4** (not inline manager re-auth). | plan §AD-5 |
| AD-6 — Offline behaviour | Cash + external_card_terminal local-first; voucher gated (V-A refuses offline). | plan §AD-6 |
| AD-7 — Voucher contract | **Contract V-A — Backend-authoritative** (Data-Pulse-2 endpoints wrapped in `vouchers.*` bridge handlers). V-B remains an approved fallback. **Partial voucher redemption: refuse**, not cap-and-preserve. | plan §AD-7; research §R-7 |
| AD-8 — OpenAPI / backend | **Slices 1–3: no new OpenAPI surface.** §A2 no-op for these. **Slice 4: voucher endpoints + codegen** under §A2. | plan §AD-8 |
| AD-9 — Drawer-impact signal | `payment.settled` audit event carries full tender breakdown; no separate `drawer.cash_delta` event. | plan §AD-9 |

**Canonical audit action categories** (8; extending 004's catalogue):
- **Attempt-level (4):** `payment.settled` · `payment.cancelled` · `payment.failed` · `payment.force_failed` *(Slice 4)*
- **Per-line (4):** `tender.applied` · `tender.refused` · `tender.reversed` · `tender.reversal_pending` *(Slice 4 voucher path)*

**Bridge handler canonical names** (from `contracts/bridge-api.md`):

- **`payments.*` (Slice 3 except where noted):** `payments.start` · `payments.confirm` · `payments.cancel` · `payments.subscribe` · `payments.read` · `payments.discardOnSessionEnd` *(internal)* · `payments.forceFail` *(Slice 4)*
- **`tender.*` (Slice 3 cash + external_card_terminal; voucher path Slice 4):** `tender.apply` · `tender.reverse` · `tender.read`
- **`vouchers.*` (Slice 4 only, Contract V-A):** `vouchers.validate` · `vouchers.redeem` · `vouchers.reverse`

**Three new SQLite tables** (in migration order per `data-model.md §Migration sequencing`):

1. `payment_attempts` (header)
2. `payment_tender_lines` (per-line; FK → `payment_attempts`)
3. `payment_action_outbox` (append-only; FK → both above)

Plus migration #4: extend 004's `audit_events.action_category` with the 8 new values.

**PaymentAttempt FSM states (5):** `started` → `settled` · `cancelled` · `failed` · `force_failed`

**TenderLine FSM states (5):** `applying` → `applied` · `refused` · `reversed` · `reversal_pending` *(Slice 4 only; `applied → reversed` is Slice 3)*

**Closed FR-006 failure reasons (14):** `cart_lost` · `operator_session_terminated` · `dependency_unavailable` · `internal_error` · `stale_handoff` · `tender_underpaid` · `non_cash_overpayment_refused` · `voucher_not_found` · `voucher_expired` · `voucher_cancelled` · `voucher_already_redeemed` · `voucher_tenant_mismatch` · `voucher_branch_mismatch` · `split_tender_rollback`

---

## Format

```text
- [ ] T### [P?] [US?] Description — `file/path/here`
```

- `[ ]` = unchecked (every implementation task starts unchecked)
- `[P]` = parallelizable with other `[P]` tasks in the same phase (independent files, no shared state)
- `[US?]` = user-story trace from spec.md:
  - **US1** = Take a single cash payment (P1)
  - **US2** = Cancel a payment attempt (P2)
  - **US3** = A payment attempt fails (P3)
  - **US4** = Record an external-card-terminal payment (P1, parallel to US1)
  - **US5** = Apply an internal voucher (P2, Slice 4)
  - **US6** = Split tender (P2)
- Gate suffixes where a slice-specific gate still applies: **(§A1)**, **(§A2)**, **(§A3)**, **(§A4)**, **(§A5)**

Per **Constitution §VI**, every implementation task is preceded by its TDD test task(s).
Test tasks carry the same `[US?]` label as their implementation counterpart.

---

## Approval gates — current status (mirror of [./coordination.md](./coordination.md))

| Gate | Status | Blocks |
|:--|:--:|:--|
| **§A0 — Upstream readiness** | ✅ Functionally cleared 2026-05-19 · `/speckit-clarify` ✅ · tender-scope amendment ✅ · `/speckit-plan` v1.0 ✅ · **`/speckit-tasks` ✅ this PR** — procedurally held until `/speckit-analyze` merges | All slices |
| **§A1** — Visual direction Slice 0 | ⛔ Held; gated on `/speckit-analyze` | Slices 1, 2, 4 (force-fail surface), 5 visual checks |
| **§A2** — Backend / OpenAPI | ⛔ Held — Slices 1–3 no-op confirmed; **required for Slice 4** (voucher V-A endpoints + codegen) | Slice 4 voucher subslice |
| **§A3** — Migrations | ⛔ Held — **three new tables + indexes + append-only trigger + audit-category extension in Slice 3** | Slice 3 persistence + Slice 4 voucher subslice (no new tables; voucher lines reuse `payment_tender_lines`) |
| **§A4** — Bridge-API surface | ⛔ Held — `payments.*` + `tender.*` security review required before Slice 3 ships; `vouchers.*` review required before Slice 4 | Slice 3, Slice 4 |
| **§A5** — Production readiness | ⛔ Held; blocks rollout, not slice merge | Production rollout only |

**Bottom line:** §A0 is functionally cleared and procedurally lifts when `/speckit-analyze` merges. Per-slice gates §A1/§A2/§A3/§A4 must each open before the corresponding slice's implementation tasks become startable. §A5 is rollout-time only.

---

## Path conventions

| Layer | Path |
|:--|:--|
| Main-process payments module | `src/main/payments/` |
| Voucher V-A client (Slice 4) | `src/main/payments/voucher-authority/` |
| Shared types + bridge API | `src/shared/bridge-api.ts` · `src/shared/payments/` |
| Preload bridge | `src/preload/payments.ts` |
| Renderer payment surface | `src/renderer/ui/payments/` |
| Renderer store | `src/renderer/stores/payment-store.ts` |
| Migrations | `migrations/` |
| Unit tests (main) | `tests/unit/main/payments/` |
| Unit tests (shared) | `tests/unit/shared/payments/` |
| Unit tests (renderer) | `tests/unit/renderer/payments/` |
| Integration tests | `tests/integration/payments/` |
| Contract tests | `tests/contract/payments/` |
| Visual direction | `specs/006-payments-tender/visual-direction/` |
| Runbook | `docs/runbook/` |
| Spec docs | `specs/006-payments-tender/` |

---

## Phase 1 — Setup & Coordination (no source code)

**Purpose:** Confirm gate ownership, feature-flag configuration, and slice-0 reviewer assignment. No code, no migrations, no packages.
**Startable when:** `/speckit-analyze` merges (lifts §A0 procedural hold).

- [ ] **T001** Confirm the `payments` feature flag exists in `src/shared/app-config.ts` (the per-feature flag map authored by 001/005 — see existing entries) and is **disabled by default** in production; record the flag key + the renderer-store binding in `src/renderer/stores/feature-flags-store.ts`. If the flag does not exist yet, split into sub-tasks: (a) register the `payments` flag in `src/shared/app-config.ts`, (b) extend the renderer store's `FeatureFlagsState` interface, (c) record the key. — `specs/006-payments-tender/coordination.md`
- [ ] **T002** Open the §A3 coordination thread: confirm migration ordering for the three new tables + 004 `ActionCategory` enum extension with the 8 new categories before Slice 3 begins; record outcome — `specs/006-payments-tender/coordination.md`
- [ ] **T003** Open the §A4 coordination thread: confirm security-review owner for the `payments.*` + `tender.*` bridge surface before Slice 3; separate sub-thread for `vouchers.*` before Slice 4; record outcome — `specs/006-payments-tender/coordination.md`
- [ ] **T004** Assign the Slice 0 visual-direction reviewer; record name + expected review date — `specs/006-payments-tender/coordination.md`
- [ ] **T005** Open the §A2 / Data-Pulse-2 coordination thread for Slice 4 voucher V-A endpoint contract (`POST /vouchers/validate` · `/redeem` · `/reverse`); record outcome — `specs/006-payments-tender/coordination.md`
- [ ] **T006** Update `specs/006-payments-tender/coordination.md` to reflect `/speckit-tasks` completion and the current gate status table — `specs/006-payments-tender/coordination.md`

---

## Phase 2 — Slice 0: Visual direction (NO CODE)

**Purpose:** Commission §A1 visual-direction review for every 006 payment surface variant.
**Gates:** §A0 ✅ + §A1 commission. **Held.**

- [x] **T010** Commission Slice 0 visual-direction review for the payment surfaces: tender selection, per-tender entry (cash · external_card_terminal · voucher reserved-disabled), change-due display, split-tender progress indicator, success / cancel / failure variants, deferred-reversal "pending" indicator, **and** the Slice 4 manager force-fail surface variant. Output: `specs/006-payments-tender/visual-direction/README.md`. No code. — `specs/006-payments-tender/visual-direction/README.md`
- [x] **T011** Slice 0 review record signed (reviewer, date, result `approved` or `approved-with-revisions`, checklists ticked); §A1 sign-off recorded — `specs/006-payments-tender/coordination.md`

---

## Phase 3 — Slice 1: Tender selection + envelope ingest

**Purpose:** Ingest the frozen `PaymentIntentEnvelope v1` from 005's `cart.handoff` return value; render tender selection with cash + external_card_terminal selectable, voucher reserved-disabled; cart line summary read-only; operator badge always visible.
**No bridge namespace yet.** No persistence yet (envelope is in-process renderer state). Bridge surface is introduced in Slice 3.
**Gates:** §A0 ✅ + §A1 (Slice 0 sign-off). **Held.**
**User stories:** US1-AS1, US4 enablement, US6 enablement.
**Test floor:** Vitest renderer tests for tender-selection render + reserved-disabled state + envelope-required refusal.

### TDD test tasks

- [x] **T020** [P] [US1] Test (failing): tender-selection surface renders only when an approved cart is in the checkout-handoff slot; refuses generically otherwise (FR-002, FR-022) — `tests/unit/renderer/payments/TenderSelection.envelope-required.test.tsx`
- [x] **T021** [P] [US1] Test (failing): Cash + external_card_terminal buttons are enabled; voucher slot is present, visibly disabled, and emits a generic `tender_not_yet_supported` refusal hint on click (FR-001) — `tests/unit/renderer/payments/TenderSelection.tender-availability.test.tsx`
- [x] **T022** [P] [US1] Test (failing): cart is read-only on the payment surface; no edit affordance is present (FR-003) — `tests/unit/renderer/payments/PaymentCartSummary.read-only.test.tsx`
- [x] **T023** [P] [US1] Test (failing): operator badge from 004 (FR-020 inherited) is visible at all times — `tests/unit/renderer/payments/PaymentSurface.operator-badge.test.tsx`
- [x] **T024** [P] [US1] Test (failing): envelope `lines[]` are rendered with redacted display name + line subtotal (minor units); no `voucher_*` / `external_reference` fields are rendered (Slice 1 surface; FR-017 enforcement) — `tests/unit/renderer/payments/PaymentCartSummary.minimised-render.test.tsx`

### Implementation tasks

- [x] **T025** [US1] Add `payments` feature flag entry to the renderer config layer (disabled by default in production; enabled in dev fixture); used by the route guard for the payment surface — `src/renderer/config/feature-flags.ts`
- [x] **T026** [US1] Implement `<PaymentSurface>` route guard: refuses to mount when no frozen envelope is in the renderer's payment context (FR-022) — `src/renderer/ui/payments/PaymentSurface.tsx`
- [x] **T027** [US1] Implement `<TenderSelection>` component: cash + external_card_terminal selectable; voucher reserved-disabled; emits `tender_not_yet_supported` hint on disabled-slot click — `src/renderer/ui/payments/TenderSelection.tsx`
- [x] **T028** [US1] Implement `<PaymentCartSummary>` component: renders envelope `lines[]` (minor units, display name only, no sensitive fields per FR-017); read-only (FR-003) — `src/renderer/ui/payments/PaymentCartSummary.tsx`
- [x] **T029** [US1] Wire the operator badge from 004's existing operator-session context into `<PaymentSurface>` header (FR-020) — `src/renderer/ui/payments/PaymentSurface.tsx`
- [x] **T030** [US1] Add the renderer-side `paymentSlice` placeholder in the payment store (envelope reference only; no FSM state; FSM lands in Slice 3) — `src/renderer/stores/payment-store.ts`
- [x] **T031** [US1] Wire 005's `cart.handoff` return value to mount the payment surface with the frozen envelope; ensure recursive `Object.freeze` is preserved on rehydration (FR-002, FR-030; 005 §"Immutability guarantees") — `src/renderer/ui/cart/CartHandoffButton.tsx` *(touches 005-owned file; coordinate via §A1 review note)*

### Slice 1 verification

- [x] **T032** Run `npx vitest tests/unit/renderer/payments/` with coverage; assert ≥ 90 % on the new payment-surface components — `tests/unit/renderer/payments/`
- [x] **T033** Manual smoke (dev fixture): drive cart → handoff → tender selection in dev mode; observe envelope-required refusal when no cart is bound; record observation in slice notes — `specs/006-payments-tender/coordination.md`
- [x] **T034** [P] [US1/US4] Test (failing): accessibility audit on the Slice 1 payment surface — (a) every interactive control has a touch target ≥ 44×44 CSS px (NFR-004 / inherited 003 / 004 NFR-005); (b) the cash-received entry control and every tender-selection button are operable by keyboard alone (tab, shift-tab, enter, escape) with visible focus indicators; (c) focus management on surface mount lands on the first tender button; (d) screen-reader landmarks present (header, main, status). — `tests/unit/renderer/payments/PaymentSurface.a11y.test.tsx`

---

## Phase 4 — Slice 2: Per-tender entry surfaces (cash + external_card_terminal)

**Purpose:** Per-tender entry controls (cash money-math + change-due rule; external_card_terminal amount + optional `external_reference`). Still no bridge call — entry surfaces accumulate local-renderer state for Slice 3 to wire through.
**Gates:** §A0 ✅ + §A1 (Slice 0 sign-off + entry-surface visuals approved). **Held.**
**User stories:** US1-AS2/AS3, US4-AS1/AS2.
**Test floor:** ≥ 95 % coverage on the cash money-math helper; ≥ 90 % on the entry surface components.

### TDD test tasks — cash entry (US1)

- [x] **T040** [P] [US1] Test (failing): money-math helper `computeChangeDueMinor(amountAppliedMinor, remainingBalanceMinor)` returns non-negative integer; throws on float / negative / non-integer input; `Number.isSafeInteger` guarded (FR-004, FR-005, Constitution §II) — `tests/unit/main/payments/money-math.test.ts`
- [x] **T041** [P] [US1] Test (failing): `<CashEntry>` rejects float / negative / non-integer keystrokes; displays computed change-due in major units (display only); enables confirm only when `amountAppliedMinor ≥ remainingBalanceMinor` (FR-004) — `tests/unit/renderer/payments/CashEntry.input-validation.test.tsx`
- [x] **T042** [P] [US1] Test (failing): `<CashEntry>` refuses confirm with generic copy when `amountAppliedMinor < remainingBalanceMinor` and shows the "amount is not enough" generic message (FR-005, US1-AS3) — `tests/unit/renderer/payments/CashEntry.under-tender-refusal.test.tsx`

### TDD test tasks — external_card_terminal entry (US4)

- [x] **T043** [P] [US4] Test (failing): regex helper `validateExternalReference(input)` accepts `^[A-Z0-9]{0,6}$` (research §R-5); rejects PAN-shaped input (any input ≥ 7 chars or containing lowercase / special) — `tests/unit/shared/payments/external-reference-format.test.ts`
- [x] **T044** [P] [US4] Test (failing): `<ExternalCardTerminalEntry>` accepts exact `remainingBalanceMinor` only; refuses overpayment with generic copy mapping to `non_cash_overpayment_refused` (FR-010) — `tests/unit/renderer/payments/ExternalCardTerminalEntry.no-overpayment.test.tsx`
- [x] **T045** [P] [US4] Test (failing): `<ExternalCardTerminalEntry>` optional reference field applies regex client-side; rejects long / lowercase / special input with generic `invalid_input` copy — `tests/unit/renderer/payments/ExternalCardTerminalEntry.reference-validation.test.tsx`

### Implementation tasks — cash

- [x] **T046** [P] [US1] Implement `computeChangeDueMinor` money-math helper (integer minor units only; `Number.isSafeInteger` assertions on inputs and outputs) — `src/shared/payments/money-math.ts`
- [x] **T047** [P] [US1] Implement `<CashEntry>` component: integer-minor-unit guarded input; live change-due display in major units (display only); under-tender refusal copy — `src/renderer/ui/payments/CashEntry.tsx`

### Implementation tasks — external_card_terminal

- [x] **T048** [P] [US4] Implement `validateExternalReference` regex helper (`^[A-Z0-9]{0,6}$`; case-sensitive; max 6 chars) — `src/shared/payments/external-reference-format.ts`
- [x] **T049** [P] [US4] Implement `<ExternalCardTerminalEntry>` component: amount field defaults to `remainingBalanceMinor`, refuses overpayment; optional reference field with client-side regex enforcement — `src/renderer/ui/payments/ExternalCardTerminalEntry.tsx`

### Slice 2 verification

- [x] **T050** Run `npx vitest tests/unit/main/payments/money-math.test.ts tests/unit/shared/payments/ tests/unit/renderer/payments/` with coverage; assert ≥ 95 % on money-math + format helpers, ≥ 90 % on entry surfaces — `tests/unit/`
- [x] **T051** Record Slice 2 functional sign-off + per-component coverage numbers in coordination.md — `specs/006-payments-tender/coordination.md`

---

## Phase 5 — Slice 3 *(load-bearing)*: FSM + TenderLine FSM + persistence + bridge

**Purpose:** Author the three new SQLite tables + indexes + append-only trigger + audit-category extension; implement the main-process PaymentAttempt + TenderLine FSMs; implement the `payments.*` + `tender.*` bridge handlers (minus voucher / forceFail); wire idempotency replay; wire split-tender LIFO rollback; emit all 4 attempt-level + 3 per-line audit categories (voucher's `tender.reversal_pending` lands in Slice 4).
**Gates:** §A0 ✅ + §A1 + **§A2 (no-op confirmed)** + **§A3 (table review + migration sign-off)** + **§A4 (bridge-API security review)**. **All held.**
**User stories:** US1-AS4/AS5/AS6, US2, US3, US4-AS3, US6 (split + rollback).
**Test floor:** ≥ 95 % on FSM, money-math, audit-emitter; every legal + illegal transition tested; split-tender rollback test per tender-type pair; idempotency replay test.

### §A3 migration tasks

- [x] **T060** [§A3] Migration: create `payment_attempts` table per data-model.md §"PaymentAttempt" + primary key + index on `(envelope_handoff_action_id)` + index on `(state, branch_id)` — `migrations/006-0001_create_payment_attempts.sql`
- [x] **T061** [§A3] Migration: create partial unique index `payment_attempts_one_started_per_terminal ON payment_attempts (terminal_id) WHERE state = 'started'` (research §R-6) — `migrations/006-0001b_payment_attempts_partial_unique_started.sql`
- [x] **T062** [§A3] [P] Migration: create `payment_tender_lines` table per data-model.md §"PaymentTenderLine" + FK → `payment_attempts` + CHECK constraints (non-cash `change_due_minor IS NULL`; `external_reference` only for external_card_terminal; voucher fields only for internal_voucher) + indexes on `(payment_attempt_id, apply_order)` and `(payment_attempt_id, state)` and filtered `(state)` for `reversal_pending` — `migrations/006-0002_create_payment_tender_lines.sql`
- [x] **T063** [§A3] [P] Migration: create `payment_action_outbox` table per data-model.md §"PaymentActionOutbox" + FKs + unique `action_id` + indexes on `(payment_attempt_id, created_at)` and `(tender_line_id, created_at)` — `migrations/006-0003_create_payment_action_outbox.sql`
- [x] **T064** [§A3] Migration: append-only trigger on `payment_action_outbox` (RAISE on UPDATE; RAISE on DELETE) — Constitution §P4 / §P16 — `migrations/006-0003b_payment_action_outbox_append_only_trigger.sql`
- [x] **T065** [§A3] [P] Migration: extend 004's `audit_events.action_category` enum / CHECK with the 4 attempt-level + 3 per-line categories (voucher's `tender.reversal_pending` deferred to Slice 4) — `migrations/006-0004_extend_audit_event_categories.sql`
- [x] **T066** [§A3] Test (integration): apply all four migrations against a fresh better-sqlite3 file; assert schema matches data-model.md fields; assert append-only trigger refuses UPDATE and DELETE on outbox — `tests/integration/payments/migrations.test.ts`
- [x] **T067** [§A3] Record §A3 migration review sign-off (reviewer, date) — `specs/006-payments-tender/coordination.md`

### Shared types (compile-time contract)

- [x] **T070** [P] [US1] Test (contract, failing): `src/shared/bridge-api.ts` extends `BridgeApi` interface with `payments.*` (start / confirm / cancel / subscribe / read; **NOT** forceFail / vouchers — those are Slice 4) + `tender.*` (apply / reverse / read). Compile-time assert — `tests/contract/payments/bridge-api.contract.test.ts`
- [x] **T071** [US1] Implement Slice-3 subset of `payments.*` + `tender.*` types in shared bridge-api.ts: Request / Response shapes per `contracts/bridge-api.md` — `src/shared/bridge-api.ts`
- [x] **T072** [US1] [P] Implement shared payment types module: `PaymentAttemptState`, `TenderLineState`, `TenderType`, `FailureReason` (14-value closed enum), `RefusalReason` (closed union) — `src/shared/payments/types.ts`
- [x] **T073** [US1] [P] Implement shared FSM-helper types: legal transitions matrix for PaymentAttempt and TenderLine FSMs (compile-time enforcement) — `src/shared/payments/fsm-types.ts`

### TDD test tasks — PaymentAttempt FSM

- [x] **T080** [P] [US1] Test (failing): PaymentAttempt FSM accepts `started → settled` only when settlement invariant holds: `Σ (amount_applied_minor − COALESCE(change_due_minor, 0)) where state='applied' == envelope_subtotal_minor` (data-model §"Invariant 5") — `tests/unit/main/payments/payment-attempt-fsm.settlement.test.ts`
- [x] **T081** [P] [US2] Test (failing): PaymentAttempt FSM accepts `started → cancelled`; reverses every applied TenderLine LIFO per FR-006B (research §R-13); emits `payment.cancelled` audit + `tender.reversed` per reversed line — `tests/unit/main/payments/payment-attempt-fsm.cancel-lifo.test.ts`
- [x] **T082** [P] [US3] Test (failing): PaymentAttempt FSM accepts `started → failed` for each of the 13 Slice-3-applicable reason categories (all 14 except `voucher_already_redeemed`-via-confirm which is Slice 4; force-fail also Slice 4) — `tests/unit/main/payments/payment-attempt-fsm.failure-reasons.test.ts`
- [x] **T083** [P] Test (failing): every illegal transition is refused (e.g., `settled → started`, `cancelled → settled`, `failed → settled`, `started → started`); FSM helper rejects at compile time and at runtime — `tests/unit/main/payments/payment-attempt-fsm.illegal-transitions.test.ts`
- [x] **T084** [P] Test (failing): partial unique index refuses two concurrent `payments.start` attempts on the same `terminal_id` with `attempt_already_started_on_terminal` (research §R-6) — `tests/integration/payments/payment-attempt.one-started-per-terminal.test.ts`

### TDD test tasks — TenderLine FSM

- [x] **T085** [P] [US1/US4/US6] Test (failing): TenderLine FSM accepts `applying → applied` for cash (with overpay → `change_due_minor`), external_card_terminal (exact amount only), and refuses `applying → applied` for voucher with `tender_not_yet_supported` (voucher path is Slice 4) — `tests/unit/main/payments/tender-line-fsm.apply.test.ts`
- [x] **T086** [P] [US6] Test (failing): TenderLine FSM accepts `applied → reversed` for cash and external_card_terminal; emits `tender.reversed` per line with `manual_void_required: true` audit-payload flag for external_card_terminal (contract §"payments.cancel") — `tests/unit/main/payments/tender-line-fsm.reverse.test.ts`
- [x] **T087** [P] Test (failing): TenderLine FSM refuses `refused → applied` (refused is terminal); refuses `reversed → applied` (no re-apply) — `tests/unit/main/payments/tender-line-fsm.illegal-transitions.test.ts`
- [x] **T088** [P] [US6] Test (failing): apply-order monotonic per attempt; LIFO reversal iterates lines by `apply_order DESC`; multi-line cancel produces `tender.reversed` events in reverse apply order — `tests/unit/main/payments/tender-line-fsm.lifo-order.test.ts`

### TDD test tasks — idempotency replay

- [x] **T090** [P] Test (failing): idempotency replay — identical-payload retry of any mutating handler is no-op + returns original outcome (research §R-10) — `tests/unit/main/payments/idempotency-replay.identical.test.ts`
- [x] **T091** [P] Test (failing): idempotency replay — payload-mismatch retry refuses with `idempotency_payload_mismatch` (research §R-10) — `tests/unit/main/payments/idempotency-replay.payload-mismatch.test.ts`

### TDD test tasks — audit emission

- [x] **T092** [P] Test (failing): `payment.settled` audit payload matches data-model §"Extension to 004's `audit_events`" shape (full `tender_lines` breakdown per AD-9) — `tests/unit/main/payments/audit-emitter.payment-settled.test.ts`
- [x] **T093** [P] Test (failing): `payment.cancelled` + `payment.failed` audit payloads carry operator attribution + `handoff_action_id` correlation; no PII, no card data, no voucher tokens. **Attribution source (FR-013 / FR-014):** the `attribution_operator_id` MUST be sourced from 004's Clerk-backed `OperatorSession.operator_id`; negative tests reject derivation from device token, cashier PIN record, terminal artefact, or any per-terminal local identifier (Constitution §VIII). — `tests/unit/main/payments/audit-emitter.payment-terminal.test.ts`
- [x] **T094** [P] Test (failing): per-line audit events (`tender.applied`, `tender.refused`, `tender.reversed`) carry operator attribution + line ID; `external_reference` redacted to `*****` in any non-payload log (research §R-5) — `tests/unit/main/payments/audit-emitter.tender-events.test.ts`

### TDD test tasks — bridge handlers (Slice 3 subset)

- [x] **T100** [P] [US1] Test (failing): `payments.start` requires session + matches envelope tenant/branch/terminal; partial-unique-index refusal becomes `attempt_already_started_on_terminal`; idempotency replay verified — `tests/unit/main/payments/bridge.payments-start.test.ts`
- [x] **T101** [P] [US1] Test (failing): `payments.confirm` evaluates the canonical settlement invariant; refuses `tender_underpaid` when sum is short; transitions to `settled` and emits `payment.settled`; idempotency replay verified — `tests/unit/main/payments/bridge.payments-confirm.test.ts`
- [x] **T102** [P] [US2] Test (failing): `payments.cancel` LIFO-reverses applied tender lines; emits `payment.cancelled` + `tender.reversed` events; idempotency replay verified — `tests/unit/main/payments/bridge.payments-cancel.test.ts`
- [x] **T103** [P] [US1] Test (failing): `payments.subscribe` streams the renderer view (minimised per FR-017; no voucher tokens, no raw refs); `payments.read` returns identical projection — `tests/unit/main/payments/bridge.payments-subscribe-read.test.ts`
- [x] **T104** [P] [US3] Test (failing): `payments.discardOnSessionEnd` (internal) reverses applied lines and transitions to `failed` with `operator_session_terminated`; not callable from renderer — `tests/unit/main/payments/bridge.payments-discard.test.ts`
- [x] **T105** [P] [US1] Test (failing): `tender.apply` for cash + external_card_terminal writes line + outbox row in one transaction; `internal_voucher` returns `tender_not_yet_supported` until Slice 4 — `tests/unit/main/payments/bridge.tender-apply.test.ts`
- [x] **T106** [P] [US6] Test (failing): `tender.reverse` for cash + external_card_terminal transitions to `reversed`; refuses on non-applied state with `line_not_applied`; idempotent — `tests/unit/main/payments/bridge.tender-reverse.test.ts`

### Implementation — persistence layer

- [x] **T110** [US1] Implement migration runner registration for the four new migrations (compose with 001's existing better-sqlite3 transactional runner) — `src/main/db/migrations-registry.ts`
- [x] **T111** [US1] [P] Implement `payment_attempts` repository: insert / update-state / read-by-id / read-by-terminal-where-started (uses the partial unique index) — `src/main/payments/repositories/payment-attempts.repository.ts`
- [x] **T112** [US1] [P] Implement `payment_tender_lines` repository: insert / update-state / read-by-attempt / settlement-sum query (the canonical invariant SQL from data-model §"Invariant 5") — `src/main/payments/repositories/payment-tender-lines.repository.ts`
- [x] **T113** [US1] [P] Implement `payment_action_outbox` repository: insert / lookup-by-action-id; computes `action_payload_hash` over redacted canonical payload (research §R-10) — `src/main/payments/repositories/payment-action-outbox.repository.ts`

### Implementation — FSMs

- [x] **T120** [US1] Implement PaymentAttempt FSM module: state-transition matrix; runtime guards for illegal transitions; integrates with the three repositories under one SQLite transaction per transition — `src/main/payments/fsm/payment-attempt-fsm.ts`
- [x] **T121** [US1] [P] Implement TenderLine FSM module: per-tender-type apply rules (cash overpay → `change_due_minor`; external_card_terminal exact-amount-or-refuse; voucher always `tender_not_yet_supported` in Slice 3); LIFO reversal helper — `src/main/payments/fsm/tender-line-fsm.ts`

### Implementation — bridge handlers

- [x] **T130** [US1] Implement `requireOperatorSession` payments wrapper delegating to 004's `role-enforcement.ts`; closed-set refusal mapping — `src/main/payments/require-operator-session.ts`
- [x] **T131** [US1] [P] Implement idempotency replay helper: outbox lookup → identical-payload no-op vs `idempotency_payload_mismatch` refusal — `src/main/payments/idempotency.ts`
- [x] **T132** [US1] [P] Implement audit emitter for `payment.*` + `tender.*` categories: payload validators (no PII / no card data / no voucher tokens; `external_reference` redaction in log sinks) — `src/main/payments/audit-emitter.ts`
- [x] **T133** [US1] Implement `payments.start` bridge handler — `src/main/payments/handlers/payments-start.ts`
- [x] **T134** [US1] Implement `payments.confirm` bridge handler (settlement invariant evaluated in the confirm transaction) — `src/main/payments/handlers/payments-confirm.ts`
- [x] **T135** [P] [US2] Implement `payments.cancel` bridge handler (LIFO reversal of cash + external_card_terminal lines) — `src/main/payments/handlers/payments-cancel.ts`
- [x] **T136** [P] [US1] Implement `payments.subscribe` bridge handler + main-side EventEmitter; serialises the minimised renderer view (FR-017) — `src/main/payments/handlers/payments-subscribe.ts`
- [x] **T137** [US1] [P] Implement `payments.read` bridge handler — `src/main/payments/handlers/payments-read.ts`
- [x] **T138** [P] [US3] Implement `payments.discardOnSessionEnd` (internal; main-process-only; subscribes to 004's operator-session-ended signal) — `src/main/payments/handlers/payments-discard-on-session-end.ts`
- [x] **T139** [P] [US1/US4] Implement `tender.apply` bridge handler (cash + external_card_terminal in Slice 3; voucher returns `tender_not_yet_supported`) — `src/main/payments/handlers/tender-apply.ts`
- [x] **T140** [P] [US6] Implement `tender.reverse` bridge handler (cash + external_card_terminal in Slice 3; voucher reverse → Slice 4) — `src/main/payments/handlers/tender-reverse.ts`
- [x] **T141** [US1] [P] Implement `tender.read` bridge handler — `src/main/payments/handlers/tender-read.ts`
- [x] **T142** [US1] Register all Slice-3 `payments.*` + `tender.*` handlers in the preload bridge — `src/preload/payments.ts`

### Implementation — renderer wiring

- [x] **T150** [US1] Implement `paymentSlice` FSM state in the renderer store (read-only mirror of main-side state via `payments.subscribe`) — `src/renderer/stores/payment-store.ts`
- [x] **T151** [US1] [P] Wire `<CashEntry>` and `<ExternalCardTerminalEntry>` to call `tender.apply` with client-generated UUID v4 `idempotency_key`; surface generic refusal copy on the closed refusal-reason enum — `src/renderer/ui/payments/`
- [x] **T152** [US1] Wire confirm button to call `payments.confirm`; on success transitions surface to placeholder post-settle state (FR-031); on refusal shows generic copy — `src/renderer/ui/payments/PaymentSurface.tsx`
- [x] **T153** [US2] Wire cancel button to call `payments.cancel`; on success returns to tender selection per AD-4; surface "Some reversals are pending" hint when `reversal_pending_tender_line_ids` is non-empty (set in Slice 4; renderer copy ready now) — `src/renderer/ui/payments/PaymentSurface.tsx`
- [x] **T154** [US6] Wire split-tender UX: when applied lines partial-sum < subtotal, the surface re-renders tender selection scoped to the *remaining balance*; cashier may add another line until the settlement invariant holds — `src/renderer/ui/payments/PaymentSurface.tsx`

### Slice 3 verification

- [x] **T160** Run full Slice-3 test suite with coverage: `npx vitest tests/unit/main/payments/ tests/unit/shared/payments/ tests/integration/payments/ tests/contract/payments/`. Assert ≥ 95 % on money-math + both FSMs + audit-emitter + idempotency-replay + all bridge handlers; ≥ 90 % on renderer wiring — `tests/`
- [x] **T161** Integration test: end-to-end attempt lifecycle through all three SQLite tables (start → apply two cash + external_card_terminal lines → confirm → assert `payment.settled` + `tender.applied` × 2 + outbox rows + settlement-invariant SQL evaluation) — `tests/integration/payments/end-to-end-lifecycle.test.ts`
- [x] **T162** Integration test: restart-survival — start an attempt + apply one line; kill the main-process worker; reboot; assert FSM rehydrates `started` attempt with applied lines intact (research §R-1 / data-model §"PaymentAttempt" Invariant 7) — `tests/integration/payments/restart-survival.test.ts`
- [x] **T163** [P] Property test (vitest + fast-check): settlement-invariant fuzz across random tender-line mixes (cash + external_card_terminal); `Number.isSafeInteger` guard on every running sum — `tests/unit/main/payments/settlement-invariant.property.test.ts`
- [x] **T164** Record Slice 3 functional sign-off + coverage numbers + §A2 no-op confirmation + §A3 + §A4 review sign-offs — `specs/006-payments-tender/coordination.md`

---

## Phase 6 — Slice 4: Voucher (Contract V-A) + force-fail

**Purpose:** (a) Voucher subslice — Data-Pulse-2 V-A contract handshake; `vouchers.*` bridge handlers; voucher-line FSM integration (validate → applied → redeem-on-confirm or reverse-on-cancel); `reversal_pending` deferred-reversal resolver. (b) Force-fail subslice — dedicated manager incident-response surface; `payments.forceFail` bridge handler; `payment.force_failed` audit category.
**Gates:** §A0 ✅ + §A1 (force-fail surface review) + **§A2 (voucher endpoints + codegen)** + §A4 (`vouchers.*` security review). **All held.**
**User stories:** US5 (voucher), FR-021 (manager force-fail).
**Test floor:** ≥ 95 % on voucher-redeem path including authority-unreachable / `reversal_pending` branch; ≥ 95 % on force-fail bridge handler.

### §A2 voucher contract tasks

- [ ] **T200** [§A2] Confirm Data-Pulse-2 voucher V-A endpoint contract sign-off recorded (`POST /vouchers/validate` · `/redeem` · `/reverse` with documented request/response shapes); link to Data-Pulse-2 spec PR — `specs/006-payments-tender/coordination.md`
- [ ] **T201** [§A2] Update OpenAPI snapshot pin in 001's `npm run codegen:api` source; record SHA — `specs/006-payments-tender/coordination.md`
- [ ] **T202** [§A2] Run `npm run codegen:api`; assert `src/shared/api-types.ts` includes the three voucher endpoint shapes — `src/shared/api-types.ts`
- [ ] **T203** [§A2] Run `npm run codegen:verify` (regen → diff is empty) — CI parity check. **Artefact:** record the CI run number, the diff line count (expected `0`), and the SHA being verified in `specs/006-payments-tender/coordination.md` under "Plan v1.0 — Session 2026-05-19 → Slice 4 §A2 verification" — `specs/006-payments-tender/coordination.md`

### §A3 voucher migration tasks (additive to Slice 3)

- [ ] **T204** [§A3] [P] Migration: add `tender.reversal_pending` to the audit-category extension (Slice 3 deferred this category) — `migrations/006-0005_audit_event_tender_reversal_pending.sql`

### TDD test tasks — voucher V-A client

- [ ] **T210** [P] [US5] Test (failing): `vouchers.validate` client maps Data-Pulse-2 success → `{ ok, intent_token, applicable_amount_minor }`; maps each closed-set refusal (`voucher_not_found` / `voucher_expired` / `voucher_cancelled` / `voucher_already_redeemed` / `voucher_tenant_mismatch` / `voucher_branch_mismatch`) — `tests/unit/main/payments/voucher-authority/validate.test.ts`
- [ ] **T211** [P] [US5] Test (failing): `vouchers.validate` enforces partial-redemption rule (research §R-7): refuses if `applied_amount_minor > authoritative_voucher_balance OR > remaining_balance_at_apply_time` with `non_cash_overpayment_refused` (the cashier supplies amount; authority caps) — `tests/unit/main/payments/voucher-authority/validate-partial-refuse.test.ts`
- [ ] **T212** [P] [US5] Test (failing): `vouchers.redeem` consumes intent token atomically; double-redeem of the same token returns `voucher_already_redeemed` — `tests/unit/main/payments/voucher-authority/redeem.test.ts`
- [ ] **T213** [P] [US5] Test (failing): `vouchers.reverse` releases an applied voucher line; authority-unreachable → returns sentinel that triggers `reversal_pending` state in the FSM (research §R-13) — `tests/unit/main/payments/voucher-authority/reverse.test.ts`
- [ ] **T214** [P] [US5] Test (failing): voucher token (`voucher_redemption_intent_token`) NEVER appears in any audit-event payload, log, or bridge response to the renderer; `voucher_authority_redemption_id` MAY appear (FR-017) — `tests/unit/main/payments/voucher-authority/redaction.test.ts`

### TDD test tasks — voucher bridge handlers + TenderLine FSM voucher path

- [ ] **T220** [P] [US5] Test (failing): `vouchers.validate` bridge handler requires session; passes through to client; persists `voucher_redemption_intent_token` on `payment_tender_lines` row in `applied` state — `tests/unit/main/payments/bridge.vouchers-validate.test.ts`
- [ ] **T221** [P] [US5] Test (failing): `payments.confirm` (extended): for each `internal_voucher` `applied` line, calls `vouchers.redeem` in the confirm transaction; on success persists `voucher_authority_redemption_id`; on `dependency_unavailable` the attempt resolves to `failed` with reason `dependency_unavailable` and the voucher line transitions to `reversal_pending`; emits `tender.reversal_pending` audit — `tests/unit/main/payments/bridge.payments-confirm.voucher.test.ts`
- [ ] **T222** [P] [US5] Test (failing): `tender.reverse` (extended): voucher line reverse calls `vouchers.reverse`; success → `reversed`; authority-unreachable → `reversal_pending` + `tender.reversal_pending` audit emitted — `tests/unit/main/payments/bridge.tender-reverse.voucher.test.ts`

### TDD test tasks — deferred-reversal resolver

- [ ] **T230** [P] [US5] Test (failing): deferred-reversal resolver scans `payment_tender_lines` where `state='reversal_pending'` on (a) app start, (b) 003 network-restore signal, (c) explicit cashier retry; retries `vouchers.reverse`; on success transitions to `reversed` + emits `tender.reversed` — `tests/unit/main/payments/deferred-reversal-resolver.test.ts`
- [ ] **T231** [P] [US5] Test (failing): deferred-reversal resolver preserves `reversal_pending_since` timestamp for incident reconstruction even after the line moves to `reversed` — `tests/unit/main/payments/deferred-reversal-resolver.history.test.ts`

### TDD test tasks — force-fail (manager-only)

- [ ] **T240** [P] Test (failing): `payments.forceFail` refuses cashier role with `role_denied`; accepts manager + admin roles (FR-021, 004 FR-019 / AD-1) — `tests/unit/main/payments/bridge.payments-force-fail.role.test.ts`
- [ ] **T241** [P] Test (failing): `payments.forceFail` transitions to `force_failed`; emits `payment.force_failed` audit with **dual attribution** (cashier whose attempt was force-failed + manager actor) — `tests/unit/main/payments/bridge.payments-force-fail.audit.test.ts`
- [ ] **T242** [P] Test (failing): force-fail surface (renderer): manager identity is **never** echoed to cashier-visible UI (FR-021 last clause); force-fail is reachable only via a route-guarded manager surface — `tests/unit/renderer/payments/ForceFailSurface.manager-only.test.tsx`

### Implementation — voucher V-A client

- [ ] **T250** [P] [US5] Implement HTTP client for `POST /vouchers/validate` against Data-Pulse-2; envelope handles retries with the same `idempotency_key`; redacts response logging — `src/main/payments/voucher-authority/validate.ts`
- [ ] **T251** [US5] [P] Implement HTTP client for `POST /vouchers/redeem` — `src/main/payments/voucher-authority/redeem.ts`
- [ ] **T252** [US5] [P] Implement HTTP client for `POST /vouchers/reverse` — `src/main/payments/voucher-authority/reverse.ts`
- [ ] **T253** [P] [US5] Implement voucher refusal-mapping helper (closed-set enum from `contracts/bridge-api.md` `vouchers.validate` table) — `src/main/payments/voucher-authority/refusal-mapping.ts`

### Implementation — voucher bridge handlers + FSM extension

- [ ] **T260** [P] [US5] Implement `vouchers.validate` bridge handler; persists intent token to `payment_tender_lines` row — `src/main/payments/handlers/vouchers-validate.ts`
- [ ] **T261** [US5] Extend `payments.confirm` to call `vouchers.redeem` per voucher line within the confirm transaction; handle `dependency_unavailable` → `reversal_pending` transition — `src/main/payments/handlers/payments-confirm.ts` *(extend Slice 3 file)*
- [ ] **T262** [P] [US5] Extend `tender.reverse` to call `vouchers.reverse` for voucher lines; handle `dependency_unavailable` → `reversal_pending` — `src/main/payments/handlers/tender-reverse.ts` *(extend Slice 3 file)*
- [ ] **T263** [US5] [P] Extend `tender.apply` to call `vouchers.validate` for voucher lines (Slice 3 returned `tender_not_yet_supported` for voucher; remove that early return; route to validate) — `src/main/payments/handlers/tender-apply.ts` *(extend Slice 3 file)*
- [ ] **T264** [US5] Extend TenderLine FSM to add `applied → reversal_pending` and `reversal_pending → reversed` transitions; runtime + compile-time enforcement — `src/main/payments/fsm/tender-line-fsm.ts` *(extend Slice 3 file)*

### Implementation — deferred-reversal resolver

- [ ] **T270** [US5] Implement deferred-reversal resolver: scans `state='reversal_pending'` on app start; subscribes to 003 network-restore signal; exposes manual-retry entry point — `src/main/payments/deferred-reversal-resolver.ts`
- [ ] **T271** [US5] Register the resolver in the main-process bootstrap (after 001's DB init) — `src/main/index.ts`

### Implementation — force-fail

- [ ] **T280** [P] Implement `payments.forceFail` bridge handler with manager + admin role gate; emits `payment.force_failed` audit with dual attribution — `src/main/payments/handlers/payments-force-fail.ts`
- [ ] **T281** [P] Implement renderer `<ForceFailSurface>`: manager-only route guard (secondary UX defence); reads stuck-attempt list via `payments.read`; calls `payments.forceFail`; never displays manager identity in the cashier-visible portion — `src/renderer/ui/payments/ForceFailSurface.tsx`
- [ ] **T282** Register `<ForceFailSurface>` under a manager-only route in the renderer router (separate from the cashier payment surface) — `src/renderer/routes.tsx`

### Implementation — voucher entry surface

- [ ] **T290** [P] [US5] Implement `<VoucherEntry>` component: code scan/type field; calls `tender.apply` with `tender_type: 'internal_voucher'` + `voucher_code`; surfaces generic refusal copy on the closed voucher refusal-reason enum — `src/renderer/ui/payments/VoucherEntry.tsx`
- [ ] **T291** [US5] Remove the reserved-disabled voucher slot UX from `<TenderSelection>` and replace with the enabled `<VoucherEntry>` route — `src/renderer/ui/payments/TenderSelection.tsx` *(extend Slice 1 file)*

### Slice 4 verification

- [ ] **T295** Run full Slice-4 test suite with coverage: voucher V-A client + bridge handlers + deferred-reversal resolver + force-fail handler + voucher entry + force-fail surface. Assert ≥ 95 % on every voucher path including authority-unreachable; ≥ 95 % on force-fail handler — `tests/`
- [ ] **T296** Integration test: voucher happy-path (validate → applied → confirm → redeem → settled); voucher failure-path (redeem → `dependency_unavailable` → `failed` + `reversal_pending`); deferred-reversal resolver run resolves the pending line on simulated network restore — `tests/integration/payments/voucher-end-to-end.test.ts`
- [ ] **T297** [P] Integration test: force-fail surface — manager force-fails a stuck `started` attempt; cashier-visible UI does not echo manager id; audit row contains dual attribution — `tests/integration/payments/force-fail.test.ts`
- [ ] **T298** Record Slice 4 functional sign-off + §A2 voucher contract sign-off + §A4 voucher bridge review sign-off — `specs/006-payments-tender/coordination.md`

---

## Phase 7 — Slice 5: Production readiness

**Purpose:** Coverage thresholds, redaction audit, security-review handoff, receipt-handoff payload finalisation, runbook + onboarding docs, production-readiness gate sign-off.
**Gates:** §A5. **Blocks rollout, not slice merge.**
**Test floor:** N/A (this slice's tests are themselves verification artefacts).

- [ ] **T300** Coverage audit: run full suite (`npm test -- --coverage`); assert per-module floors from plan §"Test Strategy" — money-math ≥ 95 %, both FSMs ≥ 95 %, audit-emitter ≥ 95 %, idempotency-replay ≥ 95 %, voucher V-A client ≥ 95 %, all bridge handlers ≥ 95 %, renderer surfaces ≥ 90 % — `coverage/`
- [ ] **T301** [P] Sentry / log redaction sample audit: run a Slice-3 + Slice-4 mixed scenario; capture every Sentry breadcrumb, console log, and log-file emission; assert **zero** PII / card data / voucher tokens / `external_reference` plaintext appears (Constitution §P7) — `docs/runbook/006-payments-redaction-audit.md`
- [ ] **T302** [P] Security-review handoff (Constitution §P8): produce a security-review packet covering (a) `payments.*` + `tender.*` + `vouchers.*` bridge surface trust boundary, (b) FSM transitions and idempotency-replay protections, (c) `external_reference` validation + redaction chain, (d) voucher token lifecycle, (e) force-fail dual attribution; record sign-off — `docs/runbook/006-payments-security-review.md`
- [ ] **T303** [P] Finalise receipt-handoff payload contract per AD-9 / OQ-PLAN-8: confirm the `payment.settled` audit-event payload is the receipt-handoff surface; cross-reference for the future receipts spec — `specs/006-payments-tender/contracts/bridge-api.md` *(add appendix; not a new contract)*
- [ ] **T304** [P] Author 006 runbook: cashier UX walkthrough (cash / external_card_terminal / voucher / split / cancel / force-fail), manager incident-response walkthrough, deferred-reversal resolver operations, troubleshooting matrix — `docs/runbook/006-payments-tender.md`
- [ ] **T305** [P] Author 006 onboarding doc: developer setup, dev fixture voucher authority stub, restart-survival smoke test, test fixtures index — `docs/onboarding/006-payments-tender.md`
- [ ] **T306** [P] Verify the partial unique index `payment_attempts_one_started_per_terminal` survives a multi-process race test: spawn two concurrent `payments.start` calls against the same `terminal_id`; assert exactly one succeeds — `tests/integration/payments/concurrent-start-race.test.ts`
- [ ] **T307** Verify production CI matrix (`codegen:verify → typecheck → lint → test → package:dir`) passes on `windows-latest` with 006 enabled via feature flag — `.github/workflows/` *(no workflow changes; verification only)*
- [ ] **T308** Record §A5 production-readiness gate sign-off (coverage ✅, redaction audit ✅, security review ✅, runbook ✅, onboarding ✅, race test ✅, CI ✅) — `specs/006-payments-tender/coordination.md`
- [ ] **T309** Set the `payments` feature flag default-state to enabled in the next production release commit (separate PR; out of 006 implementation scope) — *future PR*

---

## Cross-cutting historical tasks (do not re-open)

> **2026-05-19 renumber (`/speckit-analyze` remediation fix #12 /
> finding N1):** Cross-cutting historical task IDs renumbered from
> `T100`/`T101`/`T102`/`T103` to `T500`/`T501`/`T502`/`T503` to
> eliminate collision with Slice 3 bridge-handler test IDs
> `T100`–`T106`. The Slice 3 tests retain their original IDs since
> they are part of the locked plan v1.0 task numbering.

- [x] **T500** ✅ Applied 2026-05-19 — `/speckit-clarify` resolved FR-002, FR-006, FR-030, FR-031 + OQ-005-1..4. See [./spec.md](./spec.md) §Clarifications "Session 2026-05-19" and [./coordination.md](./coordination.md) §"Clarification results". *(formerly T100 cross-cut)*
- [x] **T501** ✅ Applied 2026-05-19 — `/speckit-plan` v1.0 resolved AD-DEFERRED-1..6 + OQ-PLAN-1..9 as AD-1..AD-9; authored [./research.md](./research.md), [./data-model.md](./data-model.md), [./quickstart.md](./quickstart.md), and [./contracts/bridge-api.md](./contracts/bridge-api.md) (DRAFT — §A4 review required). See [./coordination.md](./coordination.md) §"Plan v1.0 — Session 2026-05-19". *(formerly T101 cross-cut)*
- [x] **T502** ✅ **Applied 2026-05-19** — `/speckit-tasks` produced this startable list against plan v1.0; supersedes the cash-only DRAFT body. *(formerly T102 cross-cut)*
- [x] **T503** ✅ **Applied 2026-05-19** — `/speckit-analyze` produced the cross-artifact consistency report; remediation polish PR addressed 17 findings total: 13 applied into spec.md + tasks.md + quickstart.md (fixes I1, C1, C2, C3, C4, D1, A1, A2, A3, I2, I3, N1, U2/U3/A4 cleanups), and 4 intentionally not applied as non-blocking / superseded / cosmetic follow-ups (N2 naming-drift kept distinct, U1 cross-feature thread deferred to Phase 1, L1 FR numbering gaps cosmetic, A4 addressed via inline quickstart note rather than relocation). *(formerly T103 cross-cut, now applied; originally "BLOCKED:§A0 — Re-run /speckit-analyze")*

---

## Dependencies and order

- **Phase 1** is startable on `/speckit-analyze` merge; **no slice** is startable until both `/speckit-analyze` clears AND the named per-slice gates open.
- **Slice 0** must complete before any of Slices 1, 2, 4 (force-fail surface).
- **Slice 1** must complete before Slice 2 (entry surfaces mount inside the surface Slice 1 built).
- **Slice 2** must complete before Slice 3 (Slice 3 wires the bridge that Slice 2's entries call).
- **Slice 3 is load-bearing**: the three migrations + both FSMs + bridge handlers + idempotency + audit emission. Every other slice depends on Slice 3 except Slice 0.
- **Slice 4** depends on Slice 3 + the Data-Pulse-2 voucher V-A endpoint contract being live in the integration environment.
- **Slice 5** depends on Slices 1–4 + the production-readiness audit artefacts.
- **§A3 migrations** are authored in Slice 3 (T060–T067) + one additive migration in Slice 4 (T204). No migrations elsewhere.
- **§A4 review** runs twice: once before Slice 3 ships (`payments.*` + `tender.*`); once before Slice 4 ships (`vouchers.*`).

---

## Dependency and parallel-safety metadata

> Authoritative per-task metadata for `/speckit-analyze` and downstream
> automation. Each row covers one task. **`Parallel-safe: yes` means
> the task may be picked up concurrently with any other `Parallel-safe:
> yes` task in the same `Suggested PR slice`, provided their
> `Dependencies` are satisfied and their `Shared files / exclusive
> files` do not overlap.** The `[P]` marker on a task line is set
> **only** when this table shows `Parallel-safe: yes` for that task.
>
> Definitions:
>
> - **Dependencies** — task IDs (within 006) that MUST complete before
>   this task may start. Upstream-feature gates (e.g., 004 / 005
>   contracts already merged on main) are NOT enumerated here; they
>   are §A0 preconditions and recorded in the gate ledger above.
> - **Parallel-safe** — `yes` only if the task (a) has no open
>   intra-slice dependency conflict, (b) writes only to files that
>   no other concurrent `Parallel-safe: yes` task in the same PR
>   slice writes, and (c) does not block on any gate that another
>   concurrent task also blocks on.
> - **Shared files / exclusive files** — the file paths this task
>   touches. "Exclusive" means the file MUST NOT be co-modified by
>   any concurrent task. "Shared" means appended-to-only (e.g.,
>   coordination.md status section) and a coordinator must serialise
>   writes.
> - **Gate blocked by** — the per-slice gate that must open before
>   the task may start. `none` = task is startable as soon as its
>   `Dependencies` and §A0 are satisfied.
> - **Suggested PR slice** — the logical PR boundary this task ships
>   in. Slices are sized so each ships independently behind its own
>   gate sign-off.

### Setup phase (Phase 1)

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T001 | none (§A0 procedurally lifts on `/speckit-analyze` merge) | Parallel-safe: no — exclusive coordination.md write | exclusive: `specs/006-payments-tender/coordination.md` | none | Phase-1 setup PR |
| T002 | T001 | Parallel-safe: no — same file as T001 (every Phase-1 task writes to coordination.md; serialise) | exclusive: `specs/006-payments-tender/coordination.md` | none | Phase-1 setup PR |
| T003 | T002 | Parallel-safe: no — same file as T002 | exclusive: `specs/006-payments-tender/coordination.md` | none | Phase-1 setup PR |
| T004 | T003 | Parallel-safe: no — same file as T003 | exclusive: `specs/006-payments-tender/coordination.md` | none | Phase-1 setup PR |
| T005 | T004 | Parallel-safe: no — same file as T004 | exclusive: `specs/006-payments-tender/coordination.md` | none | Phase-1 setup PR |
| T006 | T001, T002, T003, T004, T005 | Parallel-safe: no — closing edit on the same file | exclusive: `specs/006-payments-tender/coordination.md` | none | Phase-1 setup PR |

**Note on Phase 1.** Every task writes to coordination.md, so true parallelism is impossible. T001→T002→T003→T004→T005→T006 ship as a serial commit chain or one squashed commit. No `[P]` markers in this phase.

### Slice 0 (Visual direction — no code)

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T010 | Phase-1 setup complete | Parallel-safe: no — exclusive visual-direction write | exclusive: `specs/006-payments-tender/visual-direction/README.md` | §A1 commission | Slice 0 PR |
| T011 | T010 | Parallel-safe: no — coordination edit after review | exclusive: `specs/006-payments-tender/coordination.md` | §A1 sign-off | Slice 0 PR |

### Slice 1 (Tender selection + envelope ingest)

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T020 | T011 (§A1 ✅) | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/TenderSelection.envelope-required.test.tsx` | §A1 | Slice 1 PR |
| T021 | T011 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/TenderSelection.tender-availability.test.tsx` | §A1 | Slice 1 PR |
| T022 | T011 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/PaymentCartSummary.read-only.test.tsx` | §A1 | Slice 1 PR |
| T023 | T011 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/PaymentSurface.operator-badge.test.tsx` | §A1 | Slice 1 PR |
| T024 | T011 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/PaymentCartSummary.minimised-render.test.tsx` | §A1 | Slice 1 PR |
| T025 | T011 | Parallel-safe: no — feature-flag file shared with other features | shared: `src/renderer/config/feature-flags.ts` | §A1 | Slice 1 PR |
| T026 | T020, T021, T023, T024, T025 | Parallel-safe: no — shared with T029, T031 | exclusive (this task): `src/renderer/ui/payments/PaymentSurface.tsx` (created here) | §A1 | Slice 1 PR |
| T027 | T020, T021 | Parallel-safe: no — sibling of T026 in same `src/renderer/ui/payments/` directory | exclusive: `src/renderer/ui/payments/TenderSelection.tsx` | §A1 | Slice 1 PR |
| T028 | T022, T024 | Parallel-safe: no — sibling of T026 in same directory | exclusive: `src/renderer/ui/payments/PaymentCartSummary.tsx` | §A1 | Slice 1 PR |
| T029 | T023, T026 | Parallel-safe: no — extends `PaymentSurface.tsx` written in T026 | exclusive: `src/renderer/ui/payments/PaymentSurface.tsx` | §A1 | Slice 1 PR |
| T030 | T011 | Parallel-safe: no — sole writer of the store file in Slice 1 | exclusive: `src/renderer/stores/payment-store.ts` (created here; extended in T150) | §A1 | Slice 1 PR |
| T031 | T026 | Parallel-safe: no — touches 005-owned `CartHandoffButton.tsx`; coordinate via §A1 review note | shared (cross-feature): `src/renderer/ui/cart/CartHandoffButton.tsx` | §A1 + §A1-cross-feature-review | Slice 1 PR |
| T032 | T020–T031 (all impl + tests done) | Parallel-safe: no — coverage gate check | none | §A1 | Slice 1 PR |
| T033 | T032, T034 | Parallel-safe: no — coordination edit + Slice 1 completion record (must wait on T034 a11y audit to land before sign-off) | shared: `specs/006-payments-tender/coordination.md` | §A1 | Slice 1 PR |
| T034 | T026, T027, T028, T030 (rendered surface must exist) | Parallel-safe: yes — new test file independent of T032/T033; runs concurrently with T032's coverage check | exclusive: `tests/unit/renderer/payments/PaymentSurface.a11y.test.tsx` | §A1 | Slice 1 PR |

### Slice 2 (Per-tender entry surfaces)

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T040 | T033, T034 (Slice 1 ✅) | Parallel-safe: yes | exclusive: `tests/unit/main/payments/money-math.test.ts` | §A1 | Slice 2 PR |
| T041 | T033 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/CashEntry.input-validation.test.tsx` | §A1 | Slice 2 PR |
| T042 | T033 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/CashEntry.under-tender-refusal.test.tsx` | §A1 | Slice 2 PR |
| T043 | T033 | Parallel-safe: yes | exclusive: `tests/unit/shared/payments/external-reference-format.test.ts` | §A1 | Slice 2 PR |
| T044 | T033 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/ExternalCardTerminalEntry.no-overpayment.test.tsx` | §A1 | Slice 2 PR |
| T045 | T033 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/ExternalCardTerminalEntry.reference-validation.test.tsx` | §A1 | Slice 2 PR |
| T046 | T040 | Parallel-safe: yes — independent from T048 in different file | exclusive: `src/shared/payments/money-math.ts` | §A1 | Slice 2 PR |
| T047 | T041, T042, T046 | Parallel-safe: yes — independent file from T049 | exclusive: `src/renderer/ui/payments/CashEntry.tsx` | §A1 | Slice 2 PR |
| T048 | T043 | Parallel-safe: yes — independent file from T046 | exclusive: `src/shared/payments/external-reference-format.ts` | §A1 | Slice 2 PR |
| T049 | T044, T045, T048 | Parallel-safe: yes — independent file from T047 | exclusive: `src/renderer/ui/payments/ExternalCardTerminalEntry.tsx` | §A1 | Slice 2 PR |
| T050 | T040–T049 | Parallel-safe: no — coverage gate check | none | §A1 | Slice 2 PR |
| T051 | T050 | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A1 | Slice 2 PR |

### Slice 3 — §A3 migration tasks

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T060 | T051 (Slice 2 ✅) | Parallel-safe: no — must precede T061/T062/T063 in migration order per data-model.md §"Migration sequencing" | exclusive: `migrations/006-0001_create_payment_attempts.sql` | §A3 | Slice 3 PR (subslice: §A3 migrations) |
| T061 | T060 | Parallel-safe: no — same migration epoch as T060; serial with T060 | exclusive: `migrations/006-0001b_payment_attempts_partial_unique_started.sql` | §A3 | Slice 3 PR |
| T062 | T061 | Parallel-safe: yes — independent migration file, can be authored concurrently with T063 | exclusive: `migrations/006-0002_create_payment_tender_lines.sql` | §A3 | Slice 3 PR |
| T063 | T062 (FK target `payment_tender_lines` must exist) | Parallel-safe: yes — independent migration file, concurrent with T065 | exclusive: `migrations/006-0003_create_payment_action_outbox.sql` | §A3 | Slice 3 PR |
| T064 | T063 | Parallel-safe: no — extends `payment_action_outbox` from T063 | exclusive: `migrations/006-0003b_payment_action_outbox_append_only_trigger.sql` | §A3 | Slice 3 PR |
| T065 | T060 | Parallel-safe: yes — independent of payments migrations; concurrent with T062/T063 | exclusive: `migrations/006-0004_extend_audit_event_categories.sql` | §A3 | Slice 3 PR |
| T066 | T060, T061, T062, T063, T064, T065 | Parallel-safe: no — integration test reads all migrations | exclusive: `tests/integration/payments/migrations.test.ts` | §A3 | Slice 3 PR |
| T067 | T066 | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A3 sign-off | Slice 3 PR |

### Slice 3 — Shared types

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T070 | T067 | Parallel-safe: yes — test file independent of T071 | exclusive: `tests/contract/payments/bridge-api.contract.test.ts` | §A4 | Slice 3 PR |
| T071 | T070 | Parallel-safe: no — extends shared `bridge-api.ts` (also touched by 004/005) | shared (cross-feature): `src/shared/bridge-api.ts` | §A4 | Slice 3 PR |
| T072 | T067 | Parallel-safe: yes — independent file from T073 | exclusive: `src/shared/payments/types.ts` | §A4 | Slice 3 PR |
| T073 | T067 | Parallel-safe: yes — independent file from T072 | exclusive: `src/shared/payments/fsm-types.ts` | §A4 | Slice 3 PR |

### Slice 3 — FSM + idempotency + audit tests

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T080 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/payment-attempt-fsm.settlement.test.ts` | §A3 + §A4 | Slice 3 PR |
| T081 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/payment-attempt-fsm.cancel-lifo.test.ts` | §A3 + §A4 | Slice 3 PR |
| T082 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/payment-attempt-fsm.failure-reasons.test.ts` | §A3 + §A4 | Slice 3 PR |
| T083 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/payment-attempt-fsm.illegal-transitions.test.ts` | §A3 + §A4 | Slice 3 PR |
| T084 | T060, T061 | Parallel-safe: yes — integration test requires migrations only | exclusive: `tests/integration/payments/payment-attempt.one-started-per-terminal.test.ts` | §A3 | Slice 3 PR |
| T085 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/tender-line-fsm.apply.test.ts` | §A3 + §A4 | Slice 3 PR |
| T086 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/tender-line-fsm.reverse.test.ts` | §A3 + §A4 | Slice 3 PR |
| T087 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/tender-line-fsm.illegal-transitions.test.ts` | §A3 + §A4 | Slice 3 PR |
| T088 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/tender-line-fsm.lifo-order.test.ts` | §A3 + §A4 | Slice 3 PR |
| T090 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/idempotency-replay.identical.test.ts` | §A3 + §A4 | Slice 3 PR |
| T091 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/idempotency-replay.payload-mismatch.test.ts` | §A3 + §A4 | Slice 3 PR |
| T092 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/audit-emitter.payment-settled.test.ts` | §A3 + §A4 | Slice 3 PR |
| T093 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/audit-emitter.payment-terminal.test.ts` | §A3 + §A4 | Slice 3 PR |
| T094 | T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/audit-emitter.tender-events.test.ts` | §A3 + §A4 | Slice 3 PR |

### Slice 3 — Bridge-handler tests

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T100 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-start.test.ts` | §A4 | Slice 3 PR |
| T101 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-confirm.test.ts` | §A4 | Slice 3 PR |
| T102 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-cancel.test.ts` | §A4 | Slice 3 PR |
| T103 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-subscribe-read.test.ts` | §A4 | Slice 3 PR |
| T104 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-discard.test.ts` | §A4 | Slice 3 PR |
| T105 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.tender-apply.test.ts` | §A4 | Slice 3 PR |
| T106 | T071, T072, T073 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.tender-reverse.test.ts` | §A4 | Slice 3 PR |

### Slice 3 — Persistence-layer implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T110 | T067 (migrations registered) | Parallel-safe: no — extends 001's migrations-registry; serialise with other feature registrations | shared (cross-feature): `src/main/db/migrations-registry.ts` | §A3 | Slice 3 PR |
| T111 | T080–T084, T110 | Parallel-safe: yes — independent file from T112/T113 | exclusive: `src/main/payments/repositories/payment-attempts.repository.ts` | §A3 | Slice 3 PR |
| T112 | T085–T088, T110 | Parallel-safe: yes — independent file from T111/T113 | exclusive: `src/main/payments/repositories/payment-tender-lines.repository.ts` | §A3 | Slice 3 PR |
| T113 | T090, T091, T110 | Parallel-safe: yes — independent file from T111/T112 | exclusive: `src/main/payments/repositories/payment-action-outbox.repository.ts` | §A3 | Slice 3 PR |

### Slice 3 — FSM implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T120 | T080, T081, T082, T083, T111 | Parallel-safe: no — sole writer of the attempt FSM file; T121 sibling but independent file | exclusive: `src/main/payments/fsm/payment-attempt-fsm.ts` | §A3 + §A4 | Slice 3 PR |
| T121 | T085, T086, T087, T088, T112 | Parallel-safe: yes — independent file from T120 | exclusive: `src/main/payments/fsm/tender-line-fsm.ts` | §A3 + §A4 | Slice 3 PR |

### Slice 3 — Bridge-handler implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T130 | T071 (shared types) | Parallel-safe: no — building block for all handlers; must land first | exclusive: `src/main/payments/require-operator-session.ts` | §A4 | Slice 3 PR |
| T131 | T090, T091, T113 | Parallel-safe: yes — independent file from T132 | exclusive: `src/main/payments/idempotency.ts` | §A4 | Slice 3 PR |
| T132 | T092, T093, T094 | Parallel-safe: yes — independent file from T131 | exclusive: `src/main/payments/audit-emitter.ts` | §A4 | Slice 3 PR |
| T133 | T100, T120, T130, T131, T132 | Parallel-safe: no — bridge handler with cross-cutting dependencies | exclusive: `src/main/payments/handlers/payments-start.ts` | §A4 | Slice 3 PR |
| T134 | T101, T120, T130, T131, T132, T112 | Parallel-safe: no — same dependency surface as T133 but distinct handler file | exclusive: `src/main/payments/handlers/payments-confirm.ts` | §A4 | Slice 3 PR |
| T135 | T102, T120, T121, T130, T131, T132 | Parallel-safe: yes — handler file independent of T133/T134/T136–T141 | exclusive: `src/main/payments/handlers/payments-cancel.ts` | §A4 | Slice 3 PR |
| T136 | T103, T130 | Parallel-safe: yes — independent handler file | exclusive: `src/main/payments/handlers/payments-subscribe.ts` | §A4 | Slice 3 PR |
| T137 | T103, T130 | Parallel-safe: yes — independent handler file | exclusive: `src/main/payments/handlers/payments-read.ts` | §A4 | Slice 3 PR |
| T138 | T104, T120, T130 | Parallel-safe: yes — independent handler file (internal-only) | exclusive: `src/main/payments/handlers/payments-discard-on-session-end.ts` | §A4 | Slice 3 PR |
| T139 | T105, T121, T130, T131, T132 | Parallel-safe: yes — independent handler file | exclusive: `src/main/payments/handlers/tender-apply.ts` | §A4 | Slice 3 PR |
| T140 | T106, T121, T130, T131, T132 | Parallel-safe: yes — independent handler file | exclusive: `src/main/payments/handlers/tender-reverse.ts` | §A4 | Slice 3 PR |
| T141 | T130 | Parallel-safe: yes — independent handler file | exclusive: `src/main/payments/handlers/tender-read.ts` | §A4 | Slice 3 PR |
| T142 | T133–T141 (all handlers registered) | Parallel-safe: no — touches preload file; only-writer in this slice | exclusive: `src/preload/payments.ts` | §A4 | Slice 3 PR |

### Slice 3 — Renderer wiring

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T150 | T142, T030 (Slice 1 placeholder store) | Parallel-safe: no — extends `payment-store.ts`; T151–T154 depend on this | exclusive: `src/renderer/stores/payment-store.ts` | §A1 + §A4 | Slice 3 PR |
| T151 | T150, T139 | Parallel-safe: yes — touches entry components only (`src/renderer/ui/payments/CashEntry.tsx` and `ExternalCardTerminalEntry.tsx` — both files; concurrent because separate writers each in own file; flagged note: if one developer takes both, they ship serially) | shared (within sub-task scope): `src/renderer/ui/payments/CashEntry.tsx` AND `src/renderer/ui/payments/ExternalCardTerminalEntry.tsx` | §A1 + §A4 | Slice 3 PR |
| T152 | T150, T134 | Parallel-safe: no — extends `PaymentSurface.tsx` (Slice 1 file); concurrent with T153/T154 contended on this file | exclusive (within Slice 3 final wiring): `src/renderer/ui/payments/PaymentSurface.tsx` | §A1 + §A4 | Slice 3 PR |
| T153 | T150, T135, T152 | Parallel-safe: no — same file as T152 | exclusive: `src/renderer/ui/payments/PaymentSurface.tsx` | §A1 + §A4 | Slice 3 PR |
| T154 | T150, T139, T153 | Parallel-safe: no — same file as T152/T153 | exclusive: `src/renderer/ui/payments/PaymentSurface.tsx` | §A1 + §A4 | Slice 3 PR |

### Slice 3 — Verification

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T160 | every Slice 3 impl + test task complete | Parallel-safe: no — full-suite coverage gate | none | §A3 + §A4 | Slice 3 PR |
| T161 | T160 | Parallel-safe: no — adds an end-to-end integration test file once core is green | exclusive: `tests/integration/payments/end-to-end-lifecycle.test.ts` | §A3 + §A4 | Slice 3 PR |
| T162 | T161 | Parallel-safe: no — separate file but depends on the same core | exclusive: `tests/integration/payments/restart-survival.test.ts` | §A3 + §A4 | Slice 3 PR |
| T163 | T160 | Parallel-safe: yes — property-test file independent of T161/T162 | exclusive: `tests/unit/main/payments/settlement-invariant.property.test.ts` | §A3 + §A4 | Slice 3 PR |
| T164 | T160–T163 | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A2 no-op + §A3 + §A4 sign-offs | Slice 3 PR |

### Slice 4 — §A2 voucher contract + §A3 additive migration

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T200 | T164 (Slice 3 ✅) + Data-Pulse-2 spec PR live | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A2 voucher commission | Slice 4 PR (subslice: §A2 voucher contract) |
| T201 | T200 | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A2 | Slice 4 PR |
| T202 | T201 | Parallel-safe: no — codegen output; only-writer of this file | exclusive: `src/shared/api-types.ts` | §A2 | Slice 4 PR |
| T203 | T202 | Parallel-safe: no — coordination edit (CI run number + diff line count + SHA recorded) | shared: `specs/006-payments-tender/coordination.md` | §A2 | Slice 4 PR |
| T204 | T164 | Parallel-safe: yes — independent additive migration file | exclusive: `migrations/006-0005_audit_event_tender_reversal_pending.sql` | §A3 (additive review) | Slice 4 PR |

### Slice 4 — Voucher V-A client tests

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T210 | T202 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/voucher-authority/validate.test.ts` | §A2 + §A4 | Slice 4 PR |
| T211 | T202 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/voucher-authority/validate-partial-refuse.test.ts` | §A2 + §A4 | Slice 4 PR |
| T212 | T202 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/voucher-authority/redeem.test.ts` | §A2 + §A4 | Slice 4 PR |
| T213 | T202 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/voucher-authority/reverse.test.ts` | §A2 + §A4 | Slice 4 PR |
| T214 | T202 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/voucher-authority/redaction.test.ts` | §A2 + §A4 | Slice 4 PR |

### Slice 4 — Voucher bridge handler + FSM extension tests

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T220 | T210, T211 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.vouchers-validate.test.ts` | §A2 + §A4 | Slice 4 PR |
| T221 | T212 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-confirm.voucher.test.ts` | §A2 + §A4 | Slice 4 PR |
| T222 | T213 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.tender-reverse.voucher.test.ts` | §A2 + §A4 | Slice 4 PR |

### Slice 4 — Deferred-reversal resolver tests

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T230 | T213, T204 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/deferred-reversal-resolver.test.ts` | §A2 + §A3 + §A4 | Slice 4 PR |
| T231 | T230 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/deferred-reversal-resolver.history.test.ts` | §A2 + §A3 + §A4 | Slice 4 PR |

### Slice 4 — Force-fail tests

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T240 | T164 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-force-fail.role.test.ts` | §A1 (force-fail surface) + §A4 | Slice 4 PR (subslice: force-fail) |
| T241 | T164 | Parallel-safe: yes | exclusive: `tests/unit/main/payments/bridge.payments-force-fail.audit.test.ts` | §A1 + §A4 | Slice 4 PR |
| T242 | T164 | Parallel-safe: yes | exclusive: `tests/unit/renderer/payments/ForceFailSurface.manager-only.test.tsx` | §A1 + §A4 | Slice 4 PR |

### Slice 4 — Voucher V-A client implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T250 | T210 | Parallel-safe: yes — independent file from T251/T252/T253 | exclusive: `src/main/payments/voucher-authority/validate.ts` | §A2 + §A4 | Slice 4 PR |
| T251 | T212 | Parallel-safe: yes — independent file from T250/T252/T253 | exclusive: `src/main/payments/voucher-authority/redeem.ts` | §A2 + §A4 | Slice 4 PR |
| T252 | T213 | Parallel-safe: yes — independent file from T250/T251/T253 | exclusive: `src/main/payments/voucher-authority/reverse.ts` | §A2 + §A4 | Slice 4 PR |
| T253 | T210, T211, T212, T213 | Parallel-safe: yes — independent file from T250–T252 | exclusive: `src/main/payments/voucher-authority/refusal-mapping.ts` | §A2 + §A4 | Slice 4 PR |

### Slice 4 — Voucher bridge handlers + FSM extension implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T260 | T220, T250, T253 | Parallel-safe: yes — new handler file independent of T261–T263 | exclusive: `src/main/payments/handlers/vouchers-validate.ts` | §A2 + §A4 | Slice 4 PR |
| T261 | T221, T251, T134 (Slice 3 confirm handler exists) | Parallel-safe: no — extends Slice-3 `payments-confirm.ts`; serial with T134's authors | exclusive: `src/main/payments/handlers/payments-confirm.ts` | §A2 + §A3 + §A4 | Slice 4 PR |
| T262 | T222, T252, T140 (Slice 3 reverse handler exists) | Parallel-safe: yes — extends a different Slice-3 file (`tender-reverse.ts`); concurrent with T261/T263 | exclusive: `src/main/payments/handlers/tender-reverse.ts` | §A2 + §A4 | Slice 4 PR |
| T263 | T220, T250, T139 (Slice 3 apply handler exists) | Parallel-safe: yes — extends a different Slice-3 file (`tender-apply.ts`); concurrent with T261/T262 | exclusive: `src/main/payments/handlers/tender-apply.ts` | §A2 + §A4 | Slice 4 PR |
| T264 | T222, T121 (Slice 3 TenderLine FSM exists) | Parallel-safe: no — extends Slice-3 `tender-line-fsm.ts` | exclusive: `src/main/payments/fsm/tender-line-fsm.ts` | §A3 + §A4 | Slice 4 PR |

### Slice 4 — Deferred-reversal resolver implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T270 | T230, T231, T252, T264 | Parallel-safe: no — new resolver file; T271 depends on this | exclusive: `src/main/payments/deferred-reversal-resolver.ts` | §A2 + §A3 + §A4 | Slice 4 PR |
| T271 | T270 | Parallel-safe: no — extends main-process bootstrap (cross-feature serialisation required) | shared (cross-feature): `src/main/index.ts` | §A4 | Slice 4 PR |

### Slice 4 — Force-fail implementation

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T280 | T240, T241, T120 (Slice 3 FSM) | Parallel-safe: yes — new handler file independent of T281/T282 | exclusive: `src/main/payments/handlers/payments-force-fail.ts` | §A1 + §A4 | Slice 4 PR |
| T281 | T242, T280 | Parallel-safe: yes — new renderer file independent of T280/T282 | exclusive: `src/renderer/ui/payments/ForceFailSurface.tsx` | §A1 + §A4 | Slice 4 PR |
| T282 | T281 | Parallel-safe: no — extends renderer router (cross-feature serialisation required) | shared (cross-feature): `src/renderer/routes.tsx` | §A1 + §A4 | Slice 4 PR |

### Slice 4 — Voucher entry surface

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T290 | T260, T263 | Parallel-safe: yes — new renderer file independent of T291 | exclusive: `src/renderer/ui/payments/VoucherEntry.tsx` | §A1 + §A4 | Slice 4 PR |
| T291 | T290 | Parallel-safe: no — extends Slice-1 `TenderSelection.tsx` | exclusive: `src/renderer/ui/payments/TenderSelection.tsx` | §A1 + §A4 | Slice 4 PR |

### Slice 4 — Verification

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T295 | every Slice 4 impl + test task complete | Parallel-safe: no — full-suite coverage gate | none | §A2 + §A4 | Slice 4 PR |
| T296 | T295 | Parallel-safe: no — voucher integration test | exclusive: `tests/integration/payments/voucher-end-to-end.test.ts` | §A2 + §A4 | Slice 4 PR |
| T297 | T295 | Parallel-safe: yes — force-fail integration test independent of T296 | exclusive: `tests/integration/payments/force-fail.test.ts` | §A1 + §A4 | Slice 4 PR |
| T298 | T296, T297 | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A2 + §A4 sign-offs | Slice 4 PR |

### Slice 5 — Production readiness

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T300 | T298 (Slice 4 ✅) | Parallel-safe: no — full coverage audit | none | §A5 | Slice 5 PR |
| T301 | T300 | Parallel-safe: yes — independent runbook file | exclusive: `docs/runbook/006-payments-redaction-audit.md` | §A5 | Slice 5 PR |
| T302 | T300 | Parallel-safe: yes — independent runbook file | exclusive: `docs/runbook/006-payments-security-review.md` | §A5 | Slice 5 PR |
| T303 | T300 | Parallel-safe: yes — appendix to existing contract; sole-writer in Slice 5 | exclusive: `specs/006-payments-tender/contracts/bridge-api.md` | §A5 | Slice 5 PR |
| T304 | T300 | Parallel-safe: yes — independent runbook file | exclusive: `docs/runbook/006-payments-tender.md` | §A5 | Slice 5 PR |
| T305 | T300 | Parallel-safe: yes — independent onboarding file | exclusive: `docs/onboarding/006-payments-tender.md` | §A5 | Slice 5 PR |
| T306 | T300 | Parallel-safe: yes — independent integration test file | exclusive: `tests/integration/payments/concurrent-start-race.test.ts` | §A5 | Slice 5 PR |
| T307 | T306 | Parallel-safe: no — CI matrix verification (no file change) | none | §A5 | Slice 5 PR |
| T308 | T301, T302, T303, T304, T305, T306, T307 | Parallel-safe: no — coordination edit | shared: `specs/006-payments-tender/coordination.md` | §A5 sign-off | Slice 5 PR |
| T309 | T308 | Parallel-safe: no — production rollout in a future PR (out of 006 scope) | shared (future): `src/renderer/config/feature-flags.ts` | none (rollout-time decision) | future rollout PR |

### Cross-cutting tasks (historical)

| Task | Dependencies | Parallel-safe | Shared / exclusive files | Gate blocked by | Suggested PR slice |
|:--:|:--|:--:|:--|:--:|:--|
| T500 (cross-cut, formerly T100) | — | — | — | — | PR #183 (merged) |
| T501 (cross-cut, formerly T101) | — | — | — | — | PR #185 (merged) |
| T502 (cross-cut, formerly T102) | — | — | — | — | PR #186 (merged) |
| T503 (cross-cut, formerly T103) | T502 | Parallel-safe: no — full spec/plan/tasks cross-check | none (read-only); polish PR added 17 docs-only edits | §A0 procedural | This `/speckit-analyze` polish PR |

> **Note on the 2026-05-19 renumber.** The cross-cutting historical
> task IDs were `T100`/`T101`/`T102`/`T103` until 2026-05-19, when
> `/speckit-analyze` finding N1 flagged the collision with the Slice 3
> bridge-handler test batch `T100`–`T106`. The cross-cutting batch was
> shifted to `T500`–`T503`; Slice 3 retained the original IDs. Every
> `T100`–`T103` reference elsewhere in this file now means the Slice 3
> bridge-handler test of the same number; cross-cutting references use
> `T500`+.

---

## Parallelism playbook (informational)

Given the metadata above, the maximum reasonable parallel throughput
per slice is:

| Slice | Max concurrent tasks (peer count) | Bottlenecks |
|:--:|:--:|:--|
| Phase 1 setup | 1 (all coordination.md edits serialise) | coordination.md is a single file |
| Slice 0 | 1 (T010 then T011) | sequential by design |
| Slice 1 | up to 5 (test tasks T020–T024) → then up to 3 (impl T027/T028 + helper T030) → then surface assembly T026/T029/T031 | `PaymentSurface.tsx` is contended |
| Slice 2 | up to 6 (test tasks T040–T045) → up to 4 (impl T046/T047/T048/T049 in independent files) | none |
| Slice 3 | up to 7 (bridge-handler tests T100–T106) + up to 7 (FSM tests T080–T088) + up to 5 (audit + idempotency tests T090–T094) running concurrently across distinct files. Impl: up to 9 handlers T133/T135–T141 + 2 FSMs T120/T121 + 3 repos T111/T112/T113 + 3 helpers T130/T131/T132 once their tests + types land. | `payment-store.ts` and `PaymentSurface.tsx` are renderer-side serialisation points |
| Slice 4 | up to 5 (voucher client tests T210–T214) + up to 3 (voucher bridge tests T220/T221/T222) + up to 2 (deferred resolver tests T230/T231) + up to 3 (force-fail tests T240/T241/T242) | `payments-confirm.ts` (T261), `tender-line-fsm.ts` (T264), and renderer router (T282) are serialisation points |
| Slice 5 | up to 6 (T301–T306 in different runbook / test files) | T300 must precede them all; T307 must precede T308 |

These numbers assume the gate sign-offs for the slice are all in
place; in practice each slice ships behind its own per-slice gate
PRs, and the per-PR parallelism is bounded by reviewer bandwidth.

---

## Out of scope, restated

- Cart editing.
- Receipts implementation (rendering, printing, retention).
- Inventory mutation.
- Reports / KPIs / analytics.
- Shift financial calculations (drawer reconciliation, variance, shortage, overage).
- **Real card processor / payment-gateway integration.** `external_card_terminal` is record-only.
- **Cardholder data of any kind** (PAN, CVV, track data, cardholder name, expiry, auth payload, approval code, terminal receipt text, cryptograms).
- **Voucher issuance / cancellation / catalogue management.** Data-Pulse-2 owns voucher authority.
- Refunds or returns.
- Backend / API implementation beyond the voucher V-A contract.
- Codegen runs (`npm run codegen:api`) outside Slice 4's voucher subslice.
- UI implementation outside the payment surfaces listed in Slices 1, 2, 4.
- UI polish (Impeccable / design-token work — separately gated).
- Data-Pulse-2 changes.

Any task that drifts into the above MUST be filed as a separate feature.

---

**End of tasks.** Required next step: `/speckit-analyze` to cross-check spec ↔ plan ↔ tasks consistency before any Slice 1+ work begins.
