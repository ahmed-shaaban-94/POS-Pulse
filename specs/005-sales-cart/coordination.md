# Coordination — 005-sales-cart

**Feature:** 005-sales-cart
**Plan:** [./plan.md](./plan.md) (v1.0 APPROVED 2026-05-14)
**Spec:** [./spec.md](./spec.md) (`§A0 CLEARED` — Q1–Q5 locked 2026-05-14)
**Tasks:** [./tasks.md](./tasks.md) (APPROVED — 102 tasks, T001–T102; `/speckit-tasks` complete 2026-05-14)
**Created:** 2026-05-09
**Last updated:** 2026-05-14 (Phase 1 in progress — T002, T003, T004, T005 recorded; T001 pending; S0 visual direction signed off)

---

> # ✅ `/speckit-tasks` COMPLETE — Phase 1 (T001–T005) IN PROGRESS; S0 SIGNED OFF
>
> **§A0 cleared 2026-05-14.** `/speckit-clarify` ran 2026-05-14 (Q1–Q5
> locked). `/speckit-plan` ran 2026-05-14 (plan v1.0 APPROVED; PR #147
> merged). `/speckit-tasks` ran 2026-05-14 (tasks.md regenerated; PR #148
> merged 2026-05-14; 102 tasks, T001–T102, main SHA `31663b9`).
> **Phase 1 coordination in progress — T002, T003, T004, T005 recorded;
> T001 (feature-flag confirmation) remains pending.**
> **S0 visual direction complete — contact sheet and review record signed
> off by Ahmed Shaaban on 2026-05-14 (T017–T019 done).**
> S1 is now unblocked (gate: Phase 2 + S0 review complete).
> Implementation slices S2–S5 remain held on their per-slice gates only
> (§A2, §A3, §A4, §A5 as noted per task). §A0 no longer blocks any task.

---

## Purpose

Track 005-sales-cart coordination state from spec-draft phase through
implementation. This file is the durable coordination record: returning
agents and humans should read it (and `plan.md` + `tasks.md`) first to
know "where are we?".

This file is **not** a tasks file. It does not authorize implementation.
It is the canonical record of coordination items, gate owners, and
phase status. Updated in place as coordination items resolve.

---

## Current phase / status

- **Phase:** **Phase 1 (Setup & Coordination) — IN PROGRESS.**
  T002, T003, T004, T005 recorded. T001 (feature-flag confirmation)
  remains pending.
  **S0 visual direction (T017–T019) signed off 2026-05-14 by Ahmed
  Shaaban. S1 is now unblocked (Phase 2 + S0 gate satisfied).**
  §A0 cleared 2026-05-14. `/speckit-clarify` complete 2026-05-14
  (Q1–Q5 locked). `/speckit-plan` complete 2026-05-14 (plan v1.0
  APPROVED; PR #147). `/speckit-tasks` complete 2026-05-14 (tasks.md
  APPROVED; PR #148; main SHA `31663b9`).
- **Spec Kit artifacts (all present and approved):**
  - `spec.md` — `§A0 CLEARED`; Q1–Q5 locked 2026-05-14.
  - `plan.md` — v1.0 APPROVED 2026-05-14.
  - `tasks.md` — APPROVED; 102 tasks T001–T102.
  - `data-model.md`, `research.md`, `quickstart.md` — co-authored 2026-05-14.
  - `contracts/bridge-api.md`, `contracts/handoff-envelope.md`,
    `contracts/role-visibility-matrix-cart.md` — co-authored 2026-05-14.
  - `coordination.md` — this file.
- **Implementation slices:**
  Phase 2 foundational types (T006–T016) startable immediately.
  S0 visual direction (T017–T019): **complete and signed off 2026-05-14**.
  S1 (T020–T029): **unblocked** — Phase 2 + S0 gate satisfied.
  §A2 blocks S2; §A3 blocks S3; §A4 blocks S4; §A5 blocks production rollout.

---

## Phase 1 coordination records (T001–T005)

### T001 — Cart feature flag (§A1 configuration surface)

- **Status:** ⏳ **PENDING** — flag key not yet defined in source.
- **Finding:** The plan (§"Rollback strategy") states each slice ships
  behind a feature flag readable from the existing 001 configuration
  surface (`src/shared/app-config.ts` → `AppConfig` interface). As of
  2026-05-14, `AppConfig` carries only `sentryDsn`. The `cart` feature
  flag does not yet exist in source.
- **Expected flag key:** `cart` (per plan.md and tasks.md references
  to "the cart flag" / "feature-flag-off state").
- **Action required:** A follow-up task or owner confirmation is needed
  to add `features?: { cart?: boolean }` (or equivalent) to `AppConfig`
  (`src/shared/app-config.ts`) and wire it into
  `src/main/ipc/app-config.ts`. The flag MUST default to `false`
  (disabled) — enabling it is a per-tenant, per-branch production
  decision (§A5 gate + pilot sequence). This MUST be confirmed and
  recorded here before S1 enables any cart UI.
- **Disabled-by-default rationale:** disabling the cart flag returns
  the application to the 003 + 004 post-sign-in shell with the cart
  pane reverting to its 003-era placeholder (003 FR-11). The four cart
  SQLite tables are harmless to keep unused when the flag is off.
- **Record updated:** T001 ⏳ PENDING — flag key proposed as `cart`;
  source definition and owner confirmation required before S1.

### T002 — §A3 audit-event catalogue extension coordination

- **Status:** ⏳ **COORDINATION REQUIRED before S3 begins.**
- **Finding:** `src/shared/audit/event-shape.ts` (004 T013) defines
  `AUDIT_ACTION_CATEGORIES` as a `const` array + `ActionCategory` type.
  Current members (6): `shift.open`, `shift.close`, `shift.forced_close`,
  `operator.session.takeover`, `cashier.pin.reset`, `cashier.pin.unlock`.
- **Required extension:** Before S3 merges, the array MUST be extended
  with the 4 canonical 005 cart categories (all lowercase, dot-separated):
  1. `cart.handoff_to_payment`
  2. `cart.cancel.post_handoff`
  3. `cart.discount.above_threshold`
  4. `cart.discarded_on_session_end`
- **Why these 4:** These are the only 005 audit categories that are
  sensitive per spec FR-026 + Q5, and therefore must appear in the
  `ActionCategory` discriminated union before the S3 audit-emitter
  wiring tasks (T060–T074) can pass the TypeScript compiler.
- **Coordination path:** The extension lands as a tightly-scoped
  source-only change to `src/shared/audit/event-shape.ts` and
  `src/shared/audit/payload-schemas.ts` (if payload shapes are
  added). It can be authored as its own PR or co-located with the
  first S3 task that needs it. **S3 MUST NOT begin before this
  extension is merged to main.**
- **Old stale names in coordination.md §6 (superseded):**
  `cart.void`, `cart.discount_applied_above_threshold`,
  `cart.line.removed_after_handoff_attempted` — these working titles
  are retired; use only the 4 canonical names above.
- **Owner:** Ahmed.
- **Record updated:** T002 ✅ coordination requirement recorded.

### T003 — §A4 handoff-envelope ratification coordination

- **Status:** ⏳ **COORDINATION REQUIRED before S4 begins.**
- **Contract location:** `specs/005-sales-cart/contracts/handoff-envelope.md`
  (co-authored 2026-05-14; currently `§A4 — ratification gate:
  deferred, TBD`).
- **Required action:** The future payments-feature owner MUST review
  `contracts/handoff-envelope.md` and sign off on the `PaymentIntentEnvelope v1`
  field shape before Slice S4 merges. Ratification is recorded in the
  contract file's ratification table (§"Ratification — §A4").
- **Forward-compatibility commitment:** Once ratified, the v1 field
  list is locked. The payments feature MAY add fields it owns but MUST
  NOT remove, rename, or rewrite any v1 field (FR-036). Any reshaping
  bumps `envelope_version` and goes through `/speckit-clarify`.
- **Envelope signing:** v1 is unsigned. If the payments feature
  requests an HMAC signature at §A4 ratification, it is added as an
  extension field (`envelope_signature`) without changing v1 shape.
- **Owner:** Ahmed (POS-Pulse) + future payments-feature owner (TBD).
- **Record updated:** T003 ✅ coordination requirement recorded;
  ratification owner (payments side) remains TBD.

### T004 — S0 visual-direction reviewer

- **Status:** ✅ **COMPLETE** — reviewer assigned and review signed off.
- **Reviewer:** Ahmed Shaaban.
- **Review date:** 2026-05-14.
- **S0 scope completed:**
  1. 003 design tokens: no fork; all cart surfaces use existing token
     inventory only. PASS.
  2. 004 S5 role-visibility-matrix: cashier-forbidden items confirmed
     absent from all surfaces. Void-post-handoff hidden for cashier;
     visible for manager/admin. PASS.
  3. 44 × 44 CSS px touch-target floor: all interactive elements
     specified ≥ 44 × 44 CSS px. PASS.
  4. Role-conditional visibility: Void button, discount-placeholder pill,
     manager-attribution prompt — all correctly conditioned. PASS.
  5. Manager-attribution prompt: locked to generic copy only; no manager
     identity disclosed to cashier. PASS.
  6. Decrement-to-zero rule: locked — direct remove when no note;
     confirm dialog when note is non-null. PASS.
- **Artifacts:**
  - `specs/005-sales-cart/visual-direction/contact-sheet.md` (signed off)
  - `specs/005-sales-cart/visual-direction/review-record.md` (sign-off recorded)
- **Gate cleared:** S1 is now unblocked (FR-033 gate satisfied).
- **Record updated:** T004 ✅ complete — reviewer recorded; S0 signed off 2026-05-14.

### T005 — `/speckit-tasks` completion + current gate status

- **Status:** ✅ **COMPLETE.**
- **`/speckit-tasks` run:** 2026-05-14. Output: `specs/005-sales-cart/tasks.md`
  regenerated from stale BLOCKED draft → 102 executable tasks (T001–T102)
  across 9 phases. PR #148 merged to main 2026-05-14 (SHA `31663b9`).
- **Gate status as of 2026-05-14:**

  | Gate | Status | Notes |
  |:--|:--:|:--|
  | §A0 | ✅ CLEARED | 004 S4 (PR #124, 2026-05-11) + 004 S5 (SHA `d247e8a`, 2026-05-14) |
  | T001 | ⏳ pending | Cart feature-flag key confirmation required before S1 |
  | T004 | ⏳ pending | S0 reviewer assignment required before S0 kickoff |
  | §A1 | ⏳ deferred | S1+S2 unblocked via R7 fixture stub; real catalogue is a future feature |
  | §A2 | ⏳ pending | Blocks S2 migrations (T040–T043); pending data-model.md migration review |
  | §A3 | ⏳ pending | Blocks S3 (T055–T074); requires `ActionCategory` extension (see T002) |
  | §A4 | ⏳ pending | Blocks S4 (T076–T091); requires envelope ratification (see T003) |
  | §A5 | rollout-time | Blocks production rollout only; does not block slice merges |

- **First startable tasks (now):**
  - T006–T016 (Phase 2, foundational types + bridge skeleton stubs — no gate)
- **Pending before next phases unlock:**
  - T001 resolved → confirms feature-flag key before S1
  - T004 resolved (reviewer assigned) → S0 visual direction (T017–T019) may begin
- **Record updated:** T005 ✅ complete.

---

## Dependencies on 004-operator-session

005-sales-cart consumes the following 004 deliverables. Each bullet
links the relevant 004 task ID range where applicable.

- **Operator session, role catalogue, and audit-attribution
  scaffold** — delivered by 004 S4 closeout (004 tasks T052–T082).
  005 reads the active operator session for cart ownership and audit
  attribution; cart action records carry the operator's
  Clerk-backed identity, not any local-only PIN factor.
- **Visibility boundaries (cashier vs manager/admin)** — delivered
  by 004 S5 closeout (004 tasks T083–T093). 005's cart-level
  sensitive actions (void, discount-above-threshold,
  remove-line-after-handoff-attempt) inherit and extend these
  visibility rules; the cart pane's role-conditional UI must match
  the canonical role-visibility-matrix in 004.
- **Audit-event emitter and `audit_events` table** — delivered by
  004 S3 (POS-Pulse PR #49, SHA `e50f5b8`). 005 emits new cart
  action categories through the same emitter; no new audit table.
- **`requireRole` primary trust gate** — delivered as part of 004's
  bridge / preload security work (004 S2). 005 reuses
  `requireRole` for every cart-level role-restricted action; the UI
  is a soft enforcement only.
- **003 design tokens / cart-pane reserved slot** — delivered by
  003 (POS UI shell). 005 S0 (visual direction) and S5 (final
  polish) render the cart pane against these tokens; no token
  forks.
- **001 secrets module / Electron security boundaries** —
  delivered by 001 (foundation). 005's cart bridge is a typed
  preload addition; no upward-of-bridge IPC, `contextIsolation`
  remains true, sandbox remains true.

---

## Required coordination actions before `/speckit-clarify` (and after § A0)

These items MUST resolve before 005 work may proceed. They are
listed in dependency order; some may be worked in parallel once
§A0 lifts.

### 1. 004 S4 closeout

- **Status:** ✅ **CLEARED — 004 S4 closeout completed via PR #124 merged 2026-05-11.**
- **Owner:** Ahmed.
- **Required action:** ~~Confirm the 004 S4 closeout PR (issue #87)
  merges with all S4 tasks (T052–T082) ticked and 004's
  coordination file marks S4 ✅.~~ Complete. All S4 tasks
  T052–T082 merged; 004's coordination file marks S4 ✅;
  PR #124 merged 2026-05-11.
- **Unblocks:** §A0 (partial — half). ✅ This half cleared.

### 2. 004 S5 review

- **Status:** ✅ **CLEARED — 004 S5 visibility boundaries complete; T083–T093 merged; main SHA `d247e8a` on 2026-05-14.**
- **Owner:** Ahmed.
- **Required action:** ~~004 S5 forced-close + visibility-boundary PR
  (004 tasks T083–T093) merges, the role-visibility-matrix is
  finalised, and 004's coordination file marks S5 ✅.~~ Complete.
  All T083–T093 merged (PRs #133/#134/#135/#137/#142/#143);
  role-visibility-matrix finalised; 004's coordination file marks
  S5 ✅; main SHA `d247e8a`, 2026-05-14.
- **Unblocks:** §A0 (the other half). ✅ This half cleared.

### 3. §A0 sign-off

- **Status:** ✅ **CLEARED — both §A0 prerequisites met; `/speckit-clarify` may proceed.**
  Cleared 2026-05-14: 004 S4 complete (PR #124, 2026-05-11) AND
  004 S5 complete (T083–T093 merged, main SHA `d247e8a`, 2026-05-14).
  Cart-side visibility additions in 004's role-visibility-matrix are
  accepted; the rows that 005 will inherit and extend are finalised.
- **Owner:** Ahmed (or constitution maintainer).
- **Required action:** ~~Confirm 004 S4 + S5 are approved AND that the
  cart-side visibility additions in 004's role-visibility-matrix
  are accepted.~~ Complete. Sign-off recorded in this file
  2026-05-14.
- **Unblocks:** ✅ `/speckit-clarify` on 005 **may now run**; 005 S0
  (visual direction) may begin once `/speckit-clarify` completes.

### 4. §A1 backend coordination

- **Status:** ⏳ **deferred.** Activates only once §A0 clears.
- **Owners:** Ahmed (POS-Pulse) + future payments-feature backend
  counterpart.
- **Required action:** Identify the SmartDataPulse backend
  interfaces 005 will need (item catalogue, item-ref resolution).
  Document in `coordination/a1-backend-handoff.md` (future file).
- **Important note:** Cart drafts themselves DO NOT introduce new
  backend endpoints. Drafts are local-only (`carts`, `cart_lines`,
  `cart_action_outbox` are local SQLite tables). The §A1 backend
  dependency is for **item-ref resolution only** (to validate the
  `item_ref` on each cart line against the canonical catalogue).
  This dependency MAY be deferred to a future item-catalogue
  feature; if so, 005 ships with a stubbed item-ref resolver and
  §A1 closes against that stub.
- **Unblocks:** S2 (item-ref resolution path), if/when the backend
  catalogue is needed.

### 5. §A2 migrations

- **Status:** ⏳ **later.** Activates after data-model.md is
  drafted in Phase 1.
- **Owner:** Ahmed.
- **Required action:** Author migrations for `carts`, `cart_lines`,
  and `cart_action_outbox`. Review against Constitution P4
  ("append-only audit"): **no append-only constraints needed at
  the cart layer — these tables ARE mutable.** Rationale: cart
  lifecycle includes update, line-edit, line-removal, void, and
  hand-off. Rationale must be documented in the migration commit
  message and in `data-model.md`.
- **Unblocks:** S2 (cart-line CRUD), S3 (cart-level sensitive
  actions auditing).

### 6. §A3 audit-event catalogue extension

- **Status:** ⏳ **pending** — 004 S5 merged (SHA `d247e8a`); extension
  not yet authored. See T002 in Phase 1 records above for full detail.
- **Owner:** Ahmed.
- **Required action:** Extend `src/shared/audit/event-shape.ts`
  `AUDIT_ACTION_CATEGORIES` with the **4 canonical cart categories**
  (working titles from before Q5 lock are superseded):
  - `cart.handoff_to_payment`
  - `cart.cancel.post_handoff`
  - `cart.discount.above_threshold`
  - `cart.discarded_on_session_end`
  *(Superseded names — do NOT use: `cart.void`,
  `cart.discount_applied_above_threshold`,
  `cart.line.removed_after_handoff_attempted`.)*
- **Unblocks:** S3 (cart-level sensitive actions emit audit events).

### 7. §A4 handoff-envelope ratification

- **Status:** ⏳ **pending** — `contracts/handoff-envelope.md` authored
  2026-05-14 (PR #147); ratification not yet obtained. See T003 in
  Phase 1 records above for full detail.
- **Owners:** Ahmed (POS-Pulse) + future payments-feature owner (TBD).
- **Required action:** Future payments-feature owner reviews
  `contracts/handoff-envelope.md` and signs off on `PaymentIntentEnvelope v1`
  field shape before 005 S4 merges. Ratification recorded in the
  contract file's ratification table (§"Ratification — §A4").
- **Backwards-compatibility commitment (P12 / P16):** once ratified,
  v1 field list locked. Payments feature MAY add fields it owns but
  MUST NOT remove, rename, or rewrite any v1 field (FR-036).
- **Unblocks:** S4 (handoff envelope + freeze rule).

### 8. Slice 0 visual-direction reviewer

- **Status:** ✅ **COMPLETE** — Ahmed Shaaban; signed off 2026-05-14.
- **Owner:** Ahmed Shaaban.
- **Required action:** Complete. Contact sheet reviewed and signed off
  against all 6 mandatory criteria:
  1. 003 design tokens (no fork). ✅
  2. 003 navigation-rail behaviour. ✅
  3. 003 connection-state visuals. ✅
  4. 004 role-indicator slot. ✅
  5. 44 × 44 CSS px touch-target floor. ✅
  6. Cashier-forbidden information catalogue (004 S5). ✅
- **Artifacts:**
  - `specs/005-sales-cart/visual-direction/contact-sheet.md`
  - `specs/005-sales-cart/visual-direction/review-record.md`
- **Unblocks:** ✅ S1 (cart bridge + role gating) — FR-033 gate cleared.

### 9. §A5 production-readiness reviewer

- **Status:** ⏳ **rollout-time.**
- **Owner:** TBD (assigned at production-rollout PR open time).
- **Required action:** Sign off on the full production-rollout PR
  for 005 (feature-flag flip, customer-facing readiness check).
- **Unblocks:** Production rollout. Does NOT block individual S0–S5
  merges to `main` behind a feature flag.

---

## Gate owner table

| Gate | Status | Owner | Resolution-path note |
|:--|:--:|:--|:--|
| §A0 — 005-blocking gate (LOAD-BEARING) | ✅ **CLEARED 2026-05-14** | **Ahmed** | 004 S4 closeout ✅ (PR #124, 2026-05-11) AND 004 S5 visibility boundaries ✅ (T083–T093 merged; main SHA `d247e8a`, 2026-05-14). `/speckit-clarify` is now eligible to run. |
| §A1 — cart-related backend / OpenAPI dependencies | ⏳ deferred | **Ahmed** + future-feature owner | Item-ref resolution only; cart drafts add NO new backend endpoints. May ship with stubbed resolver if catalogue feature is later. |
| §A2 — migrations (`carts`, `cart_action_outbox`, `cart_lines`, `cart_line_discount_placeholders`) | ⏳ pending | **Ahmed** | 4 tables in FK order per data-model.md. P4 review: cart tables are intentionally mutable; rationale documented. |
| §A3 — 004 audit-event catalogue extension | ⏳ pending | **Ahmed** | `ActionCategory` extended with 4 canonical cart categories (see T002). 004 S5 merged; extension not yet authored. |
| §A4 — handoff-envelope shape | ⏳ pending | **Ahmed** + future payments owner (TBD) | Contract authored 2026-05-14 (PR #147). Ratification required before S4 merges. See T003. |
| §A5 — production-readiness rollout gate | ⏳ rollout-time | **TBD** | Production gate only. Does not block slice merges behind a feature flag. |

---

## Gate unblock table

| Gate clears | Slices that become eligible to schedule |
|:--|:--|
| §A0 | `/speckit-clarify` on 005 may run; S0 (visual direction) may begin |
| §A0 + S0 review | S1 (cart bridge + role gating) may begin |
| §A0 + §A2 | S2 (cart-line CRUD + idempotency outbox) may begin |
| §A0 + §A3 | S3 (cart-level sensitive actions into 004 audit emitter) may begin |
| §A0 + §A4 | S4 (handoff envelope + freeze rule) may begin |
| §A0 + §A1 (if needed) + S2 + S3 + S4 merged | S5 (final polish + cart pane visual) may begin; production rollout may proceed pending §A5 |

**Bottom line:** §A0 ✅ cleared 2026-05-14. All Spec Kit pre-implementation
steps are complete: `/speckit-clarify` ✅ (Q1–Q5 locked), `/speckit-plan` ✅
(PR #147), `/speckit-tasks` ✅ (PR #148, SHA `31663b9`). Phase 1 coordination
is now in progress. S0 visual direction and Phase 2 foundational types are
the next startable work. Per-slice gates §A2/§A3/§A4 govern individual slices.

---

## Required approvals (summary callout)

✅ All pre-implementation Spec Kit approvals are complete:

1. ✅ 004 S4 closeout PR merged (PR #124, 2026-05-11).
2. ✅ 004 S5 visibility-boundaries merged (T083–T093; SHA `d247e8a`, 2026-05-14).
3. ✅ §A0 sign-off recorded in this file (2026-05-14).
4. ✅ `/speckit-clarify` resolved all `[NEEDS CLARIFICATION]` items (Q1–Q5 locked 2026-05-14).
5. ✅ `/speckit-plan` approved (plan v1.0, PR #147, 2026-05-14).
6. ✅ `/speckit-tasks` complete (tasks.md APPROVED, PR #148, 2026-05-14).

**Remaining per-slice gates:** §A2 (S2 migrations), §A3 (S3 audit
extension), §A4 (S4 envelope ratification), §A5 (production rollout).
Phase 1 (T001–T005) and Phase 2 (T006–T016) may begin now.

---

## Open questions (cross-doc)

✅ **All open questions resolved by `/speckit-clarify` on 2026-05-14.**
Locked values (Q1–Q5):

| Decision | Locked value |
|:--|:--|
| Q1 — Item-note maximum length | **200 characters** |
| Q2 — Discount-attribution threshold | **Percentage of `line_subtotal_minor`, per-line; numeric value is tenant-configurable** |
| Q3 — Cart-stale policy on session end | **Option (a): discard immediately on session end** |
| Q4 — Duplicate-add line-merge rule | **Merge by `item_ref` (default); "force separate line" deferred** |
| Q5 — Offline-cart audit event | **`cart.discarded_on_session_end`** (4th canonical category) |

Additional resolutions: optimistic-concurrency token = monotonic integer
(`version`); idempotency key = UUID v4 stored in `cart_action_outbox`;
handoff-envelope version field = string literal `'v1'`.

---

## Spec Kit step completion record

| Step | Status | Date | PR / SHA |
|:--|:--:|:--|:--|
| `/speckit-specify` (`spec.md`) | ✅ | 2026-05-09 | — |
| `/speckit-clarify` (Q1–Q5 locked) | ✅ | 2026-05-14 | PR #146 |
| `/speckit-plan` (`plan.md` v1.0 + contracts) | ✅ | 2026-05-14 | PR #147 |
| `/speckit-tasks` (`tasks.md` APPROVED) | ✅ | 2026-05-14 | PR #148 |
| Phase 1 coordination (T001–T005) | ⏳ in progress (T001 pending) | 2026-05-14 | — |
| S0 visual direction (T017–T019) | ✅ signed off | 2026-05-14 | — |
| Phase 2 foundational (T006–T016) | ⏳ pending | — | — |
| S1–S5 implementation | ⏳ per-slice gated | — | — |

## Explicit non-actions (current state)

The following have **NOT yet started** and MUST NOT start without
the corresponding gate clearing:

- ❌ No source files created (no `src/main/cart/*`, no
  `src/renderer/cart/*`, no `src/shared/cart/*`).
- ❌ No migrations authored (4 cart tables do not yet exist in source).
- ❌ No `package.json` changes for cart-related dependencies.
- ❌ No backend / Data-Pulse-2 changes for 005 (cart drafts are
  local-only; no new backend endpoints in 005's scope).
- ❌ No payments / receipts / inventory / reports / analytics work begun.
- ✅ S0 visual-direction contact sheet and review record produced and
  signed off by Ahmed Shaaban on 2026-05-14 (T017–T019 complete).

---

## Status update protocol

When any item changes state (especially §A0), update this file in
place:

1. Update the row in **Required coordination actions** that
   changed (status, owner, dates).
2. Update the corresponding row in the **Gate owner table**.
3. Update the **Last updated** date at the top.
4. If a gate clears completely, update the **Gate unblock table**
   to reflect the now-eligible slices.
5. When §A0 clears, add a line under **Current phase / status**
   noting "§A0 cleared on YYYY-MM-DD; `/speckit-clarify` may run."
6. When `/speckit-clarify` and `/speckit-plan` complete, update
   the **Phase** marker accordingly.

This file is the durable coordination record across sessions.

---

**End of coordination file.** All Spec Kit pre-implementation steps
complete as of 2026-05-14 (PRs #146, #147, #148). Phase 1 coordination
(T001–T005) in progress — T001 (feature-flag confirmation) remains pending.
S0 visual direction (T017–T019) signed off 2026-05-14.
Next work: Phase 2 foundational types (T006–T016) + S1 (now unblocked).
