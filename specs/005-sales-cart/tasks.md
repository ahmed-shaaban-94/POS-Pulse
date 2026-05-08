---
description: "Task list for feature 005-sales-cart — DRAFT, slice-organised, ALL TASKS BLOCKED behind §A0"
---

# Tasks: 005-sales-cart

**Feature:** 005-sales-cart — Sales Cart
**Spec:** [./spec.md](./spec.md) (DRAFT — drafted in parallel)
**Plan:** [./plan.md](./plan.md) (DRAFT — drafted in parallel)
**Coordination:** [./coordination.md](./coordination.md) (to be created when 005 unblocks)
**Visual direction:** [./visual-direction/README.md](./visual-direction/README.md) (to be produced in S0)
**Constitution version pinned:** v1.5.1
**Created:** 2026-05-09
**Status:** 🚧 **DRAFT — BLOCKED**

---

## 🚧 DRAFT — BLOCKED notice (read first)

> Every task in this file is `[ ]` unchecked and **BLOCKED behind §A0**. Do **NOT** begin
> implementation. `/speckit-tasks` SHOULD NOT have been invoked yet — this file is a
> **placeholder draft** to surface the shape of upcoming work, not an executable task list.
> §A0 has not cleared. The 004 S4 closeout PR has not merged, and the 004 S5 visibility
> boundaries PR has not been opened. Numbering, slice boundaries, gate counts, and task
> wording will be re-issued by `/speckit-tasks` once 005 unblocks. Treat this file as a
> shape-of-work artefact, NOT as a contract.

---

## Format

```text
- [ ] [TaskID] [P?] [US?] **[BLOCKED:gate(s)]** Description with file path
```

- **`[ ]`** = unchecked. Every task in this draft is unchecked. There are zero `[x]` rows.
- **`[P]`** = parallelizable when (and only when) §A0 has cleared and this slice's gates have cleared.
- **`[US1]` / `[US2]` / `[US3]`** = user-story trace from spec.md (drafted in parallel).
  - **US1** = Cashier builds a sales cart and hands off to payment (P1).
  - **US2** = Cashier cancels / voids an in-progress cart with operator attribution (P2).
  - **US3** = Manager applies a discount above the configured threshold with audit attribution (P3).
- **`[BLOCKED:gate]`** = task is in the file but NOT startable until the named gate clears.
  In this draft, **every task carries `[BLOCKED: §A0]`** at minimum because §A0 is the
  load-bearing precondition for the whole feature. Slice-specific tasks add stricter gates
  on top.

Every implementation task that would touch code is preceded by a TDD test task per
Constitution VI. Production code is not written by `/speckit-tasks` itself.

---

## Approval Gates — current status

> Mirror of the gate table that will live in `plan.md` when the parallel-drafted plan lands.
> All rows currently `⏳`. **§A0 is the load-bearing precondition for the entire feature.**

| Gate | Status | Owner | Path / Reason |
|:--|:--:|:--|:--|
| §A0 — 005-blocking gate (LOAD-BEARING) | ⏳ **BLOCKED** | Ahmed | **Depends on 004 S4 closeout PR merged AND 004 S5 visibility-boundaries PR reviewed and approved.** Until both clear, no task in this file is startable — including Phase 1 (Setup & Coordination), even though Phase 1 contains no code. |
| §A1 — cart-related backend / OpenAPI dependencies | ⏳ Held | TBD | Future. No backend endpoints assumed by `/speckit-plan` (per spec hard non-goal). When 005 unblocks, §A1 will be re-scoped against whatever backend dependencies are required (e.g., handoff-envelope publication, cart-action audit ingestion if not piggybacked on 004's `POST /v1/audit-events`). |
| §A2 — migrations | ⏳ Held | TBD | Three new SQLite tables anticipated: `carts`, `cart_lines`, `cart_action_outbox`. Schemas TBD by `/speckit-plan` data-model.md when 005 unblocks. Append-only invariants on `cart_action_outbox` mirror 004's `audit_events` triggers (AD-3 lineage). |
| §A3 — 004 audit-event catalogue extension | ⏳ Held | Ahmed (cross-feature) | Cart-action category catalogue extension to 004's existing audit catalogue: at minimum `cart.void`, `cart.discount_applied_above_threshold`, `cart.handoff_to_payment`, plus the FR-025 mandatory five attributes adapted for cart-scoped events (cart id is NOT in the mandatory five — it goes in payload under the allowlist). Coordination thread to be opened in Phase 1 (T003). |
| §A4 — handoff-envelope shape | ⏳ Held | Ahmed (cross-feature) | The `payment-intent envelope` shape MUST be ratified jointly with the (future) payments feature owner before S4 may begin. The envelope is the contract surface between this feature and the payments feature. Coordination thread to be opened in Phase 1 (T004). |
| §A5 — production readiness | ⏳ Held | TBD at rollout PR open time | Blocks production rollout only, not slice merges. |

**Net effect on this tasks.md:** every phase below is `[BLOCKED: §A0]` at minimum. Slices add
their own gates on top of §A0. Phase 1 is non-code but still §A0-blocked because the entire
spec is blocked from formal task generation until 004 S4 closeout + S5 are approved.

---

## Path conventions (anticipated; subject to plan.md ratification)

- Renderer code: `src/renderer/`
- Renderer cart UI primitives (extends 003's reserved cart slot): `src/renderer/ui/cart/`
- Main process: `src/main/cart/` (new sub-module)
- Preload bridge: `src/preload/cart.ts` (new), `src/shared/bridge-api.ts` (extended with `cart.*` namespace)
- Shared types: `src/shared/cart/`
- Migrations: `migrations/NNN_<name>.sql` — scope under §A2
- Tests: `tests/unit/`, `tests/integration/`, `tests/contract/`
- Specs / docs: `specs/005-sales-cart/`, `docs/runbook/` (cart cancellation + handoff entries)

The cart pane fills the slot reserved by 003's POS UI shell. No re-layout of 003's shell is
proposed by this feature.

---

## Phase 1 — Setup & Coordination (NO source code)

**Purpose:** Once §A0 clears, lock the slice-0 review record, finalise gate ownership,
confirm cross-feature coordination threads (§A3 audit-catalogue, §A4 handoff envelope), and
record the visual-direction sign-off. **No source code, no migrations, no packages, no
OpenAPI in this phase.** Phase 1 is **STARTABLE only after §A0 clears**.

- [ ] T001 **[BLOCKED: §A0]** Confirm 004 S4 closeout PR is merged (gate prerequisite). Record SHA + PR link in `specs/005-sales-cart/coordination.md` (file to be created when 005 unblocks).
- [ ] T002 **[BLOCKED: §A0]** Confirm 004 S5 visibility-boundaries PR is reviewed and approved (gate prerequisite). Record SHA + PR link in `specs/005-sales-cart/coordination.md`.
- [ ] T003 **[BLOCKED: §A0]** Open §A3 coordination thread for cart-action-category catalogue extension to 004's audit catalogue. Confirm reuse of 004's `audit_events` table + emitter (no parallel cart audit pipeline). Record outcome in `specs/005-sales-cart/coordination.md`.
- [ ] T004 **[BLOCKED: §A0]** Open §A4 coordination thread with the (future) payments-feature owner for handoff-envelope shape ratification. The envelope MUST be designed before S4 implementation tasks may merge. Record outcome in `specs/005-sales-cart/coordination.md`.
- [ ] T005 **[BLOCKED: §A0]** Visual-direction sign-off recorded in S1's PR description requirements (a documentation contract — every Slice 1+ PR cites the Slice 0 review record per FR-033 lineage). Recorded in `specs/005-sales-cart/tasks.md` (this file, this row) for traceability once Slice 0 contact sheet is reviewed.

**Checkpoint:** Phase 1 complete when T001–T005 are ticked. Phase 2 may then begin in
parallel with §A2 migration approval and §A3/§A4 coordination outcomes. **None of this is
startable until §A0 clears.**

---

## Phase 2 — Foundational (Bridge skeleton & shared types)

**Purpose:** Establish the typed seam between renderer and main process for the `cart.*`
namespace, the cart finite-state machine, the line-item shape, the integer-minor-units money
arithmetic primitives that cart subtotals depend on (constitution: no floats), and the
re-use of 004's Role enum + `requireRole` for cart-scoped role gating. **STARTABLE only
after §A0 clears AND all Phase 1 tasks complete.**

**Tests-first per Constitution VI.**

### Phase 2 — Tests

- [ ] T006 [P] **[BLOCKED: §A0]** Unit test: `src/shared/cart/cart-state.ts` cart FSM closed-set assertion — states `{empty, building, handing_off, cancelled, handed_off}` only. Transitions cover: `empty → building` on first line add; `building → empty` on remove-last-line; `building → handing_off` on handoff initiate; `handing_off → handed_off` on payment-intent envelope created; `building → cancelled` on void; `handing_off → building` on handoff-aborted; `handed_off` and `cancelled` are terminal. — `tests/unit/shared/cart/cart-state.test.ts`
- [ ] T007 [P] **[BLOCKED: §A0]** Unit test: `src/shared/cart/payment-intent-envelope.ts` shape — required keys, version field, frozen-cart reference, immutability assertion (Object.isFrozen). The envelope MUST NOT contain payment-side fields (no tender, no money totals — payments feature owns money math). — `tests/unit/shared/cart/payment-intent-envelope.test.ts`
- [ ] T008 [P] **[BLOCKED: §A0]** Contract test: `cart.*` bridge namespace — typed surface compiles against the bridge contract that `/speckit-plan` will produce in `contracts/bridge-api.md` when 005 unblocks. — `tests/contract/cart-bridge.contract.test.ts`
- [ ] T009 [P] **[BLOCKED: §A0]** Unit test: cart bridge handlers MUST refuse generically when no operator session is active — re-uses 004's `requireRole` and the operator-session store. A `signedOut` operator state MUST yield `OperatorRefusal { category: 'role_mismatch' }` for every cart bridge call (FR-016 lineage from 004). — `tests/unit/main/cart/cart-role-gating.test.ts`
- [ ] T010 [P] **[BLOCKED: §A0]** Unit test: route-guard adaptation (if any) — the cart pane is mounted only when `signedIn` per 004's `<OperatorRouteGuard>`. No new top-level route is added; the cart slot is rendered within the existing `/app/*` shell. — `tests/unit/renderer/routes/cart-pane-route-guard.test.tsx`
- [ ] T011 [P] **[BLOCKED: §A0]** Integration test: `cartStore` 5-state finite-state machine transitions per T006 above, exercised at the renderer-store layer (not just the shape). Includes a regression for the freeze rule: any mutation attempt while in `handed_off` returns generic refusal and does not change state. — `tests/integration/renderer/stores/cart-store.test.ts`

### Phase 2 — Implementation

- [ ] T012 [P] **[BLOCKED: §A0]** Would create `src/shared/cart/cart-state.ts` exporting the `CartState` enum and the FSM transition table. Re-exported into `src/shared/cart/index.ts`. — depends on plan.md ratification.
- [ ] T013 [P] **[BLOCKED: §A0]** Would create `src/shared/cart/payment-intent-envelope.ts` with the `PaymentIntentEnvelope` type, version field, and a `freeze(envelope)` helper that returns `Object.freeze(structuredClone(envelope))`. Money-typed fields are integer minor units only (no floats; constitution Tech Stack rule). — depends on §A4 coordination outcome (T004).
- [ ] T014 **[BLOCKED: §A0]** Would extend `src/shared/bridge-api.ts` with the typed `cart.*` namespace skeleton (calls TBD by `/speckit-plan` — anticipated set: `cart.create`, `cart.addLine`, `cart.updateLine`, `cart.removeLine`, `cart.setLineNote`, `cart.applyDiscountPlaceholder`, `cart.void`, `cart.handoffToPayment`, `cart.getCurrent`). Each call MUST honour the bridge-handler contract from 004's AD-1: `requireRole` invoked at the first executable instruction. — depends on T012, T013.
- [ ] T015 **[BLOCKED: §A0]** Would create `src/main/cart/role-enforcement.ts` — a thin re-export wrapper around 004's `src/main/operator/role-enforcement.ts` `requireRole`, narrowed to the cart role allow-lists. No new trust-boundary surface; this is reuse, not parallel implementation. — depends on T014.
- [ ] T016 **[BLOCKED: §A0]** Would create `src/renderer/stores/cart-store.ts` (zustand) implementing the 5-state FSM from T006/T011. The store holds the active cart, the line list, the placeholder discount state, and the in-flight handoff envelope (if any). MUST NOT hold any payment-side data. — depends on T012.
- [ ] T017 **[BLOCKED: §A0]** Would create `src/renderer/ui/cart/CartPaneRouteGuard.tsx` (if a guard layer is required by plan.md). The cart pane is rendered only when 004's operator-session store is in `signedIn` and the active role is allowed by the cart role-visibility row. — depends on T012, T016.

**Checkpoint:** Bridge surface compiles end-to-end; `requireRole` reuse verified; cart FSM
transitions tested; cart pane is mounted only when `signedIn`. **None of this is startable
until §A0 clears.**

---

## Phase 3 — Slice S1: Cart bridge skeleton + role gating

**Purpose:** Deliver the foundational cart bridge surface plus role gating. No persistence
of carts beyond the in-memory store at this slice (durability lands in S2 with §A2). No
audit emission at this slice (audit lands in S3 with §A3). No handoff envelope at this slice
(envelope lands in S4 with §A4).

**Gates:** §A0 (load-bearing) + (no slice-specific gates beyond Phase 2 complete).

### Phase 3 — Tests

- [ ] T018 [P] [US1] **[BLOCKED: §A0]** Unit test: `cart.create` succeeds for cashier role, manager role, admin role; refuses generically for `signedOut`. — `tests/unit/main/cart/cart-create.test.ts`
- [ ] T019 [P] [US1] **[BLOCKED: §A0]** Unit test: `cart.getCurrent` returns the active in-memory cart for the calling operator-session id; returns `null` when no cart is active. MUST NOT leak another operator's cart even within the same terminal. — `tests/unit/main/cart/cart-get-current.test.ts`
- [ ] T020 [P] [US1] **[BLOCKED: §A0]** Unit test: cart cannot exist while operator-session store is `signedOut` — cart-create call returns generic refusal; an in-memory cart that existed prior to a sign-out is discarded on transition to `signedOut` (no cross-operator carry-over). — `tests/unit/main/cart/cart-lifecycle-on-signout.test.ts`
- [ ] T021 [P] [US1] **[BLOCKED: §A0]** Integration test: cart FSM transition `empty → building` on first line add (placeholder line — full line CRUD lands in S2). — `tests/integration/main/cart/cart-fsm-transitions.test.ts`
- [ ] T022 [P] [US1] **[BLOCKED: §A0]** Integration test: cart pane renders inside 003's reserved cart slot when `signedIn`; the pane is absent when `signedOut`. — `tests/integration/renderer/ui/cart/cart-pane-mount.test.tsx`
- [ ] T023 [P] [US1] **[BLOCKED: §A0]** Cross-process redaction smoke test (extends 004's T025) — verifies no cart payload field that violates the cart payload allowlist (PII, raw cardholder data, credential fragments) appears in `pino` logs, Sentry events, or test snapshots. — `tests/integration/cross-process-redaction.test.ts` (extension)

### Phase 3 — Implementation

- [ ] T024 [US1] **[BLOCKED: §A0]** Would implement `src/main/cart/cart-create-handler.ts` (`cart.create`): re-uses 004's `requireRole`; constructs a new in-memory cart bound to the active operator-session id; returns the cart id. — depends on T015, T016.
- [ ] T025 [US1] **[BLOCKED: §A0]** Would implement `src/main/cart/cart-get-current-handler.ts` (`cart.getCurrent`): in-memory query keyed by operator-session id. — depends on T024.
- [ ] T026 [US1] **[BLOCKED: §A0]** Would implement `src/main/cart/cart-lifecycle-on-signout.ts`: subscribes to 004's operator-session-store transitions; on transition to `signedOut`, discards any in-memory cart bound to the prior operator-session id. — depends on T024.
- [ ] T027 [P] [US1] **[BLOCKED: §A0]** Would implement `src/renderer/ui/cart/CartPane.tsx` rendering the empty-state and the building-state shells (line list lands in S2). Mounts into 003's reserved cart slot per `specs/003-pos-ui-shell` shell contract. — depends on T016.
- [ ] T028 [P] [US1] **[BLOCKED: §A0]** Would implement `src/renderer/ui/cart/EmptyCartPlaceholder.tsx` — the empty-state visual per S0 contact sheet. — depends on T027.
- [ ] T029 [US1] **[BLOCKED: §A0]** Would wire `cart.create` and `cart.getCurrent` bridge calls in `src/preload/cart.ts`; `src/main/cart/bridge-handlers.ts` dispatches. Pino redaction list extended for cart payload allowlist refusals (defence in depth — the allowlist is the primary gate). — depends on T024, T025.
- [ ] T030 [US1] **[BLOCKED: §A0]** Would extend `pino` log sites in `src/main/logger/redaction.ts` for cart-bridge failure-category logging (allowlist-violation refusal, role-mismatch refusal). MUST NOT log any portion of the rejected payload. — depends on T029.

**Checkpoint S1:** A reviewer signs in (per 004), opens the POS shell, sees the empty cart
pane in 003's reserved slot, calls `cart.create` via a debug surface, observes the FSM
transitions to `building`, signs out, and verifies the in-memory cart is discarded.
**Quickstart Slice 1 walkthrough passes.** Persistence, line CRUD, audit emission, and
handoff envelope are all NOT in this slice.

---

## Phase 4 — Slice S2: Cart-line CRUD + idempotency outbox

**Purpose:** Deliver the cart-line CRUD operations (add / update / remove / set-note),
per-line subtotal arithmetic in integer minor units, the `carts` + `cart_lines` migrations,
and the idempotency outbox (`cart_action_outbox`) that protects against double-submission
under network or crash conditions. The cross-process redaction smoke is extended for cart
payload allowlist refusal at the bridge handler.

**Gates:** §A0 (load-bearing) + §A2 (migrations approved) + S1 must be merged.

### Phase 4 — Tests

- [ ] T031 [P] [US1] **[BLOCKED: §A0, §A2]** Unit test: `cart.addLine` adds a line for a known item ref; refuses for an unknown item ref with generic refusal; refuses while `cancelled` or `handed_off` (frozen-cart rule). — `tests/unit/main/cart/cart-add-line.test.ts`
- [ ] T032 [P] [US1] **[BLOCKED: §A0, §A2]** Unit test: `cart.updateLine` updates quantity; refuses non-positive quantities; refuses on a frozen cart. — `tests/unit/main/cart/cart-update-line.test.ts`
- [ ] T033 [P] [US1] **[BLOCKED: §A0, §A2]** Unit test: `cart.removeLine` removes a line; cart returns to `empty` when last line is removed. — `tests/unit/main/cart/cart-remove-line.test.ts`
- [ ] T034 [P] [US1] **[BLOCKED: §A0, §A2]** Unit test: `cart.setLineNote` accepts a capped-length note; refuses notes exceeding cap; PII redaction allowlist applied at the bridge handler before persistence. — `tests/unit/main/cart/cart-set-line-note.test.ts`
- [ ] T035 [P] [US1] **[BLOCKED: §A0, §A2]** Unit test: per-line subtotal arithmetic in integer minor units (no floats; ≥ 95 % branch coverage on this module per constitution money-rule). Round-trip property test: subtotal MUST equal `unit_price_minor × quantity` exactly, for all integer inputs in `[0, 10_000_000]`. — `tests/unit/shared/cart/line-subtotal.test.ts`
- [ ] T036 [P] [US1] **[BLOCKED: §A0, §A2]** Integration test: append-only invariant on `cart_action_outbox` — schema-level refusal of `UPDATE` and `DELETE` via raw SQL (mirrors 004 AD-3). The mutable `synced_at` field lives in a sibling `cart_action_outbox_sync_state` table. — `tests/integration/main/cart/cart-action-outbox-append-only.test.ts`
- [ ] T037 [P] [US1] **[BLOCKED: §A0, §A2]** Integration test: idempotency replay — submitting the same `action_id` twice produces one row in `cart_action_outbox` (mirrors 004 P5). — `tests/integration/main/cart/cart-action-outbox-idempotency.test.ts`
- [ ] T038 [P] [US1] **[BLOCKED: §A0, §A2]** Integration test: version-conflict resolution — two concurrent `cart.updateLine` calls on the same line resolve to one persisted update + one generic refusal of the loser; the loser MAY retry (resolution policy TBD by `/speckit-plan`; this draft notes the open clarification). — `tests/integration/main/cart/cart-version-conflict.test.ts`
- [ ] T039 [P] [US1] **[BLOCKED: §A0, §A2]** Integration test: merge-by-`item_ref` vs separate-line policy — DEFERRED per spec NEEDS CLARIFICATION; this test stub asserts whichever policy plan.md ratifies. The stub fails until the policy is chosen. — `tests/integration/main/cart/cart-line-merge-policy.test.ts` (open clarification)
- [ ] T040 [P] [US1] **[BLOCKED: §A0]** Cross-process redaction smoke extension — verifies cart payload allowlist refusal categories are logged without leaking the offending field value. — `tests/integration/cross-process-redaction.test.ts` (extension)

### Phase 4 — Implementation

- [ ] T041 [US1] **[BLOCKED: §A0, §A2]** Would author migration `migrations/NNN_carts.sql` per plan.md data-model.md §"Entity 1 — Cart" (TBD). Append-only? — depends on plan.md decision; the cart row itself is updateable for FSM transitions, but historical state lives in `cart_action_outbox`.
- [ ] T042 [US1] **[BLOCKED: §A0, §A2]** Would author migration `migrations/NNN_cart_lines.sql` per plan.md data-model.md §"Entity 2 — CartLine" (TBD). Composite primary key TBD.
- [ ] T043 [US1] **[BLOCKED: §A0, §A2]** Would author migration `migrations/NNN_cart_action_outbox.sql` per plan.md data-model.md §"Entity 3 — CartActionOutbox" (TBD). Append-only triggers (deny `UPDATE`, deny `DELETE`) mirror 004's `audit_events` pattern. Sibling `cart_action_outbox_sync_state` table holds the mutable `synced_at`.
- [ ] T044 [US1] **[BLOCKED: §A0, §A2]** Would implement `src/main/cart/cart-line-crud.ts` (`cart.addLine`, `cart.updateLine`, `cart.removeLine`, `cart.setLineNote`). Each handler invokes `requireRole` first, then the cart payload allowlist check, then the persistence + outbox write in a single SQLite transaction. — depends on T041, T042, T043, T015.
- [ ] T045 [US1] **[BLOCKED: §A0, §A2]** Would implement `src/shared/cart/line-subtotal.ts` — pure function, integer minor units only. ≥ 95 % branch coverage gate enforced. Exported into `src/shared/cart/index.ts`. — depends on T035.
- [ ] T046 [US1] **[BLOCKED: §A0, §A2]** Would implement the cart-action outbox sync loop in `src/main/cart/cart-action-sync.ts`. Honours the `accepted` / `duplicates` / `rejected` envelope from §A1 (when ratified). Reuses 001's offline-queue infrastructure if reusable; otherwise parallel implementation following 004's `audit-sync.ts` shape. — depends on T043.
- [ ] T047 [US1] **[BLOCKED: §A0, §A2]** Would extend the `cart.*` bridge with the four CRUD calls in `src/preload/cart.ts` and `src/main/cart/bridge-handlers.ts`. — depends on T044.
- [ ] T048 [US1] **[BLOCKED: §A0, §A2]** Would extend `src/renderer/ui/cart/CartPane.tsx` to render the live line list with quantity and subtotal columns. The subtotal column reads `line-subtotal` directly — no float math at the renderer layer. — depends on T045, T027.
- [ ] T049 [US1] **[BLOCKED: §A0, §A2]** Would extend `src/renderer/ui/cart/CartLineRow.tsx` (new) with quantity edit + remove + set-note interactions. The note input enforces the cap client-side as a UX nicety; the bridge handler is the authoritative cap (defence in depth). — depends on T048.
- [ ] T050 [US1] **[BLOCKED: §A0]** Would extend `pino` redaction list in `src/main/logger/redaction.ts` for `cart_lines.note` (defence in depth — payload allowlist is primary gate) and any new line-level fields. — depends on T044.

**Checkpoint S2:** Cart-line CRUD durable across restart; per-line subtotal arithmetic at
≥ 95 % coverage; outbox replay verified; version-conflict resolution path tested;
cross-process redaction smoke extended and green. **Quickstart Slice 2 walkthrough passes.**

---

## Phase 5 — Slice S3: Cart-level sensitive actions into 004 audit emitter

**Purpose:** Wire cart-level sensitive actions (`cart.void`, `cart.discount_applied_above_threshold`)
into 004's existing `audit-emitter.ts`. No parallel audit pipeline is built. The cart-action
catalogue is added to 004's catalogue per §A3 coordination outcome.

**Gates:** §A0 (load-bearing) + §A3 (audit catalogue extension agreed) + S2 must be merged.

### Phase 5 — Tests

- [ ] T051 [P] [US2] **[BLOCKED: §A0, §A3]** Unit test: `cart.void` emits one `cart.void` audit event via 004's `emitAuditEvent`. The event carries the FR-025 mandatory five attributes (`acting_operator_id`, `shift_id`, `originating_terminal_id`, `created_at`, `action_category = 'cart.void'`). — `tests/unit/main/cart/cart-void-audit.test.ts`
- [ ] T052 [P] [US2] **[BLOCKED: §A0, §A3]** Unit test: `cart.void` payload allowlist — the payload contains only the cart id, line count, and reason category (not the line-level details, not any PII). PII / cardholder fragments are refused at the bridge handler before emission (FR-027 lineage). — `tests/unit/main/cart/cart-void-payload-allowlist.test.ts`
- [ ] T053 [P] [US3] **[BLOCKED: §A0, §A3]** Unit test: `cart.applyDiscountPlaceholder` above-threshold path — when the placeholder discount magnitude exceeds the configured threshold, the action requires manager / admin role; cashier role is refused generically. — `tests/unit/main/cart/cart-discount-threshold-role.test.ts`
- [ ] T054 [P] [US3] **[BLOCKED: §A0, §A3]** Unit test: `cart.applyDiscountPlaceholder` above-threshold emit — emits one `cart.discount_applied_above_threshold` audit event. The event carries the FR-025 mandatory five attributes; the manager id is `acting_operator_id`; the cashier-on-shift is referenced in the payload allowlist (cart id, threshold magnitude category — NOT the absolute money figures, since payments owns money math). — `tests/unit/main/cart/cart-discount-audit.test.ts`
- [ ] T055 [P] [US2] **[BLOCKED: §A0, §A3]** Integration test: `cart.void` from FSM `building` transitions to FSM `cancelled`; the cart is no longer mutable; subsequent `cart.addLine` / `cart.updateLine` / `cart.removeLine` calls return generic refusal (frozen-cart rule). — `tests/integration/main/cart/cart-void-fsm.test.ts`
- [ ] T056 [P] [US2] **[BLOCKED: §A0, §A3]** Integration test: append-only invariant honoured — emitted cart-action audit events cannot be `UPDATE`d or `DELETE`d via raw SQL (re-uses 004's `audit_events` triggers — no new schema required for this invariant, just a cross-feature regression). — `tests/integration/main/cart/cart-audit-append-only.test.ts`
- [ ] T057 [P] [US3] **[BLOCKED: §A0, §A3]** Integration test: discount-above-threshold UX — cashier attempts above-threshold discount; the renderer surfaces a manager-attribution prompt; on manager success, the discount is applied and the audit event is emitted; on manager refuse / cancel, the discount is not applied and no audit event is emitted. — `tests/integration/renderer/cart/discount-above-threshold.test.tsx`
- [ ] T058 [P] [US2] **[BLOCKED: §A0, §A3]** Integration test: cart-void minimum-disclosure — the void confirmation modal copy does not leak PII or other-operator data; the audit event payload similarly contains only allowlisted fields. — `tests/integration/renderer/cart/cart-void-disclosure.test.tsx`

### Phase 5 — Implementation

- [ ] T059 [US2] **[BLOCKED: §A0, §A3]** Would implement `src/main/cart/cart-void-handler.ts` (`cart.void`): `requireRole` first; FSM transition `building → cancelled`; emits `cart.void` audit event via 004's `emitAuditEvent`; payload allowlist enforced. — depends on T044, 004's T046.
- [ ] T060 [US3] **[BLOCKED: §A0, §A3]** Would implement `src/main/cart/cart-discount-handler.ts` (`cart.applyDiscountPlaceholder`): below-threshold path requires cashier+; above-threshold path requires manager+; above-threshold path emits `cart.discount_applied_above_threshold` audit event. Discount math is **placeholder only** — actual discount arithmetic is owned by the payments feature; this slice records the placeholder magnitude category, not the money figure. — depends on T044, 004's T046.
- [ ] T061 [US2] [US3] **[BLOCKED: §A0, §A3]** Would extend `src/shared/audit/payload-schemas.ts` with cart-action payload schemas: `cart.void`, `cart.discount_applied_above_threshold`, plus the eventual `cart.handoff_to_payment` (typed-only here; emit lands in S4). The schemas live in 004's audit-payload-schemas module per §A3 coordination outcome — cart owns the schema *types*, 004 owns the *catalogue surface*. — depends on §A3 outcome.
- [ ] T062 [US2] [US3] **[BLOCKED: §A0, §A3]** Would extend the `cart.*` bridge with `cart.void` and `cart.applyDiscountPlaceholder` calls in `src/preload/cart.ts` and `src/main/cart/bridge-handlers.ts`. — depends on T059, T060.
- [ ] T063 [US2] [US3] **[BLOCKED: §A0, §A3]** Would extend `src/renderer/ui/cart/CartPane.tsx` with the void affordance (cashier+) and the discount affordance (cashier+ for below-threshold; manager-attribution prompt for above-threshold). — depends on T048, T062.
- [ ] T064 [US2] [US3] **[BLOCKED: §A0, §A3]** Would extend `src/main/logger/redaction.ts` for cart-audit payload defence-in-depth (the allowlist at T052 is primary). — depends on T059, T060.
- [ ] T065 [US2] [US3] **[BLOCKED: §A0, §A3]** Would update `docs/runbook/` with a "cart cancellation reasons" troubleshooting entry — operator-facing copy for the most common void reasons. Non-code; documentation. — depends on T059.

**Checkpoint S3:** Cart void emits an audit event with FR-025 five attributes and an
allowlisted payload; above-threshold discount requires manager attribution and emits a
distinct audit event; append-only invariants honoured (re-uses 004's `audit_events` triggers
— no parallel audit pipeline). **Quickstart Slice 3 walkthrough passes.**

---

## Phase 6 — Slice S4: Handoff envelope construction + freeze rule

**Purpose:** Construct the `payment-intent envelope` that the (future) payments feature will
consume. The cart enters FSM `handing_off` on initiate, transitions to `handed_off` on
envelope-created, and is **frozen** thereafter — any cart mutation post-handoff returns
generic refusal.

**Gates:** §A0 (load-bearing) + §A4 (envelope shape ratified with payments feature owner) +
S3 must be merged.

### Phase 6 — Tests

- [ ] T066 [P] [US1] **[BLOCKED: §A0, §A4]** Contract test: `payment-intent envelope` shape — required keys, version field, frozen-cart reference. The contract test is the canonical record of the §A4 ratification. — `tests/contract/payment-intent-envelope.contract.test.ts`
- [ ] T067 [P] [US1] **[BLOCKED: §A0, §A4]** Unit test: envelope immutability — `Object.isFrozen(envelope) === true` after construction; mutation attempts on the envelope object throw in strict mode and are no-ops outside strict mode (defence in depth — the `freeze` helper from T013 is the primary gate). — `tests/unit/shared/cart/envelope-immutability.test.ts`
- [ ] T068 [P] [US1] **[BLOCKED: §A0, §A4]** Integration test: cart freeze rule — after `cart.handoffToPayment` succeeds, any `cart.addLine` / `cart.updateLine` / `cart.removeLine` / `cart.setLineNote` / `cart.applyDiscountPlaceholder` / `cart.void` call returns generic refusal. — `tests/integration/main/cart/cart-freeze-after-handoff.test.ts`
- [ ] T069 [P] [US1] **[BLOCKED: §A0, §A4]** Unit test: envelope serialisation — the envelope round-trips through `JSON.stringify` / `JSON.parse` without loss; integer minor units survive serialisation; no float coercion. — `tests/unit/shared/cart/envelope-serialisation.test.ts`
- [ ] T070 [P] [US1] **[BLOCKED: §A0, §A4]** Integration test: retrieval by future payments feature (mocked) — a mock payments-feature consumer reads the envelope by cart id and observes the canonical shape. The mock lives under `tests/integration/main/cart/__mocks__/payments-consumer.ts`. — `tests/integration/main/cart/envelope-retrieval.test.ts`
- [ ] T071 [P] [US1] **[BLOCKED: §A0, §A4]** Integration test: version-conflict on concurrent handoff attempts — two concurrent `cart.handoffToPayment` calls on the same cart resolve to one envelope created + one generic refusal of the loser. The cart's FSM end-state is `handed_off`. — `tests/integration/main/cart/cart-handoff-version-conflict.test.ts`
- [ ] T072 [P] [US1] **[BLOCKED: §A0, §A4]** Integration test: handoff-aborted path — if envelope construction fails partway (e.g., outbox write fails), the cart returns to FSM `building` (NOT `handed_off`), and a generic refusal is returned to the caller. — `tests/integration/main/cart/cart-handoff-aborted.test.ts`
- [ ] T073 [P] [US1] **[BLOCKED: §A0, §A3, §A4]** Unit test: `cart.handoff_to_payment` audit event — the handoff is a sensitive action and emits an audit event via 004's `emitAuditEvent`. The event carries the FR-025 mandatory five attributes; the cart id and the envelope id are referenced in the payload allowlist. — `tests/unit/main/cart/cart-handoff-audit.test.ts`

### Phase 6 — Implementation

- [ ] T074 [US1] **[BLOCKED: §A0, §A4]** Would implement `src/main/cart/cart-handoff-handler.ts` (`cart.handoffToPayment`): `requireRole` first; FSM transition `building → handing_off`; envelope construction via `freeze(buildEnvelope(cart))`; FSM transition `handing_off → handed_off` on success; emits `cart.handoff_to_payment` audit event. — depends on T044, T013, 004's T046.
- [ ] T075 [US1] **[BLOCKED: §A0, §A4]** Would implement `src/main/cart/cart-freeze-guard.ts` — a guard wrapper around every cart-mutating bridge handler that refuses generically when FSM is `handed_off` or `cancelled`. Defence in depth on top of FSM state checks within each handler. — depends on T074.
- [ ] T076 [US1] **[BLOCKED: §A0, §A4]** Would implement `src/main/cart/envelope-store.ts` — the post-handoff envelope is persisted (location TBD by `/speckit-plan`; candidate: a new `cart_handoff_envelopes` table under §A2's third migration, or an extension of the `carts` schema). The future payments feature reads via this store; this slice publishes the read API as part of the §A4 contract. — depends on T074.
- [ ] T077 [US1] **[BLOCKED: §A0, §A4]** Would extend the `cart.*` bridge with `cart.handoffToPayment` in `src/preload/cart.ts` and `src/main/cart/bridge-handlers.ts`. — depends on T074.
- [ ] T078 [US1] **[BLOCKED: §A0, §A4]** Would extend `src/renderer/ui/cart/CartPane.tsx` with the handoff affordance — typically the "Pay" button in the cart pane footer. After handoff success, the cart pane shows the frozen state visually (per S0 contact sheet). — depends on T077.

**Checkpoint S4:** `payment-intent envelope` is constructed, frozen, and serialisable; the
freeze rule is enforced on every cart-mutating bridge handler post-handoff; the audit event
records the handoff with FR-025 five attributes; mocked payments-feature consumer reads the
envelope by cart id. **Quickstart Slice 4 walkthrough passes.**

---

## Phase 7 — Slice S5: Final polish + cart pane visual

**Purpose:** Final visual polish against S0 contact sheet, accessibility audit, screenshot
review, and runbook entries.

**Gates:** §A0 (load-bearing) + S4 must be merged.

- [ ] T079 [P] [US1] [US2] [US3] **[BLOCKED: §A0]** Cart pane fills 003's reserved cart slot exactly; no re-layout of the 003 shell is required. Regression test for shell-slot dimensions. — `tests/integration/renderer/ui/cart/cart-pane-shell-slot.test.tsx`
- [ ] T080 [P] [US1] [US2] [US3] **[BLOCKED: §A0]** Axe-clean pass on the cart pane in default state, loading state, and error state. — `tests/integration/renderer/a11y/cart-pane-a11y.test.tsx`
- [ ] T081 [P] [US1] [US2] [US3] **[BLOCKED: §A0]** Screenshot review against the S0 contact sheet — empty state, building state (3 lines), handing-off state, handed-off state, cancelled state. — `tests/integration/renderer/visual/cart-pane-screenshots.test.tsx`
- [ ] T082 [P] [US2] **[BLOCKED: §A0]** Runbook entry: cart cancellation troubleshooting — common operator-reported void reasons and recommended responses. — `docs/runbook/cart-cancellation.md`
- [ ] T083 [P] [US1] **[BLOCKED: §A0]** Runbook entry: cart-payment handoff failure paths — what an operator sees when handoff aborts; how to recover. — `docs/runbook/cart-handoff-failure.md`
- [ ] T084 [P] [US3] **[BLOCKED: §A0]** Runbook entry: above-threshold discount — manager-attribution prompt and audit trail expectations. — `docs/runbook/cart-discount-above-threshold.md`
- [ ] T085 [P] [US1] [US2] [US3] **[BLOCKED: §A0]** Empty / loading / error visual states for the cart pane match S0 contact sheet pixel-for-pixel where reasonable; tolerances documented per visual-direction sign-off. — `tests/integration/renderer/visual/cart-pane-states.test.tsx`
- [ ] T086 [P] [US1] [US2] [US3] **[BLOCKED: §A0]** Keyboard-only navigation pass — every cart-pane interaction reachable via keyboard; tab order documented. — `tests/integration/renderer/a11y/cart-pane-keyboard.test.tsx`
- [ ] T087 [US1] [US2] [US3] **[BLOCKED: §A0]** Cross-process redaction smoke final pass over the full feature — no PII, raw cardholder data, credential fragments, or PIN values appear in any log line, Sentry event, or test snapshot generated by any cart bridge call across S1–S4. — `tests/integration/cross-process-redaction.test.ts` (final regression)
- [ ] T088 [US1] [US2] [US3] **[BLOCKED: §A0]** Quickstart walkthrough end-to-end pass — sign in, build a cart with three lines, void one line, apply an above-threshold discount with manager attribution, hand off to payment, observe the frozen state, and verify the audit trail end-to-end. — `specs/005-sales-cart/quickstart.md` (file produced by `/speckit-plan` when 005 unblocks).

**Checkpoint S5:** Visual pass clean, axe-clean, runbook entries in place, cross-process
redaction smoke green end-to-end, quickstart walkthrough green. **Feature 005 ready for
production-readiness review (§A5).**

---

## Cross-cutting tasks

- [ ] T089 **[BLOCKED: §A0, §A5]** Production-readiness checklist for 005 — per-tenant rollout sequence, telemetry surface, rollback plan, schema-migration safety review of the three new tables, audit-event volume estimate (cart events are higher volume than 004 sign-in events; estimate batch sizes and outbox sync cadence). — `specs/005-sales-cart/production-readiness.md`.
- [ ] T090 **[BLOCKED: §A0, §A5]** Per-tenant rollout sequence — identify the staged tenant set, the canary period, the rollback signal, and the success metric. — `specs/005-sales-cart/rollout-sequence.md`.
- [ ] T091 **[BLOCKED: §A0, §A5]** Customer-facing onboarding doc — short operator-facing guide on cart workflow (build → discount → handoff → pay). Living under the operator-onboarding documentation tree. — `docs/onboarding/cart-workflow.md`.

---

## Dependency graph (slice-level)

```text
                 ┌──────────────────────────────────────────┐
                 │  §A0 — 005-blocking gate (LOAD-BEARING)  │
                 │  depends on:                             │
                 │   • 004 S4 closeout PR merged            │
                 │   • 004 S5 visibility-boundaries PR      │
                 │     reviewed and approved                │
                 └────────────────────┬─────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Phase 1 — Setup    │  (T001–T005, no code)
                            │  + §A3 / §A4        │
                            │  coordination       │
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │  Phase 2 — Founda-  │  (T006–T017)
                            │  tional bridge +    │
                            │  shared types       │
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │  S0 — Visual        │  (non-code; FR-033)
                            │  direction sign-off │
                            └──────────┬──────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────┐
                  │  S1 — Cart bridge skeleton + role    │  (T018–T030)
                  │       gating (gates: §A0)            │
                  └──────────────────┬───────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  S2 — Cart-line CRUD + idempotency   │  (T031–T050)
                  │       outbox (gates: §A0, §A2)       │
                  └──────────────────┬───────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  S3 — Cart-level sensitive actions   │  (T051–T065)
                  │       into 004 audit emitter         │
                  │       (gates: §A0, §A3)              │
                  └──────────────────┬───────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  S4 — Handoff envelope + freeze rule │  (T066–T078)
                  │       (gates: §A0, §A4)              │
                  └──────────────────┬───────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  S5 — Final polish + cart pane       │  (T079–T088)
                  │       visual (gates: §A0)            │
                  └──────────────────┬───────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  Production rollout (gates: §A0,§A5) │  (T089–T091)
                  └──────────────────────────────────────┘
```

§A1 — held; not on the critical path until backend dependencies are introduced.

---

## Parallel opportunities

When and only when §A0 has cleared and the relevant slice gates have cleared, the
following pairs are parallelizable (different files, no shared state):

- Within Phase 2: T006 / T007 / T008 / T009 / T010 / T011 (all independent test files);
  T012 / T013 (independent shared modules).
- Within Phase 4: T031 / T032 / T033 / T034 / T035 (line CRUD test files are independent);
  T041 / T042 / T043 (migration files are independent SQL files); T044 must be sequential
  with the migrations.
- Within Phase 5: T051 / T052 / T053 / T054 (audit test files are independent); T059 / T060
  (handler files are independent main-side modules).
- Within Phase 6: T066 / T067 / T068 / T069 / T070 / T071 / T072 / T073 (test files are
  independent); implementation tasks T074 / T075 / T076 must be sequenced.
- Within Phase 7: T079 / T080 / T081 / T082 / T083 / T084 / T085 / T086 are all independent.

Implementation tasks within a single bridge-handler module MUST be sequenced — concurrent
edits to `src/main/cart/bridge-handlers.ts` would conflict. The CRUD handler module
(T044) is the densest single-file hotspot.

---

## Independent test criteria per user story

| User story | Slices that prove the story | Canonical test |
|:--|:--|:--|
| **US1** — Cashier builds a sales cart and hands off to payment (P1) | S1 (cart create + role gate) → S2 (line CRUD durable) → S4 (handoff envelope + freeze rule) | T088 (quickstart walkthrough) covers US1 end-to-end. T070 (envelope retrieval by mocked payments consumer) is the canonical handoff-contract test. |
| **US2** — Cashier cancels / voids an in-progress cart with operator attribution (P2) | S3 (`cart.void` audit event) | T055 (FSM transition `building → cancelled`) + T051 (audit event with FR-025 five attributes) are jointly the canonical proof. |
| **US3** — Manager applies a discount above the configured threshold with audit attribution (P3) | S3 (`cart.discount_applied_above_threshold` audit event) | T053 (role-gate enforcement) + T054 (audit emit with manager as `acting_operator_id`) + T057 (UX prompt path) are jointly the canonical proof. |

---

## Suggested MVP scope

**MVP = S0 + S1 + S2.** The minimum viable cart is a cashier-built, durably persisted cart
with line CRUD and the per-line subtotal arithmetic at ≥ 95 % coverage. Cart cancellation
(void) and the handoff envelope land in S3 and S4 respectively, behind their own gates
(§A3 audit catalogue extension and §A4 envelope ratification). Without S3, voids cannot be
attributed; without S4, the cart cannot hand off to payment. Both are essential for end-to-
end value, but the MVP slice cleanly proves the foundational shape: a cart bridge surface,
a durable line list, and the integer-minor-units subtotal primitive — none of which requires
a payments feature to exist. S5 is polish; it does not change behaviour.

---

## Format validation

- Total task count target: **~91** (T001–T091 with planned addenda).
- Every task `[ ]` (unchecked). Zero `[x]` rows. Confirmed by file authorship.
- Every task carries `[BLOCKED: §A0]` at minimum. Slice-specific tasks add stricter gates
  (§A2, §A3, §A4, §A5) on top.
- Every implementation task is preceded by a TDD test task per Constitution VI.
- Phase 1 is non-code but still §A0-blocked because the entire spec is blocked from formal
  task generation until 004 S4 closeout + S5 are approved.
- This is a **DRAFT** — final task numbering will be re-issued by `/speckit-tasks` when 005
  unblocks. Numbering may shift; gate scopes may be re-named; slice boundaries may be
  redrawn based on the parallel-drafted spec.md and plan.md.

---

## Hard constraints honoured by /speckit-tasks (planned)

- No source files would be created or modified by `/speckit-tasks` itself when 005 unblocks
  — `/speckit-tasks` writes a tasks list, not code.
- No package changes, no migrations, no OpenAPI changes by `/speckit-tasks`.
- Implementation tasks `[BLOCKED: §A0/§A1/§A2/§A3/§A4]` cannot start until their gates
  clear.
- **Currently the entire file is a draft and §A0 has NOT cleared.** No task in this file is
  startable. Re-invoke `/speckit-tasks` once 004 S4 closeout + S5 are approved.

---

End of tasks. **DRAFT — BLOCKED**. Total tasks: ~91 (every one `[ ]` unchecked and `[BLOCKED: §A0]`). /speckit-tasks must be re-invoked once 004 S4 closeout + S5 are approved; numbering may shift.
