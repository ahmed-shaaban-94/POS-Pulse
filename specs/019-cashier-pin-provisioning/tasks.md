# Tasks: Cashier-PIN Provisioning (004 follow-up)

**Feature:** 019-cashier-pin-provisioning
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-13
**Last Updated:** 2026-06-13

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** = parallelizable (different files, no dependency on incomplete tasks).
- **`[USn]`** maps to a user story phase; Setup/Foundational/Polish have no story label.
- **Test-first (Constitution VI):** every implementation task is preceded by its failing test (RED→GREEN).
- File paths are repository-relative.

## ⚠️ Held dependency (not a task here)

The cashier's provider-neutral `user_id` on `PosRosterCashierEntry` is a **DP-2 upstream field** (see [`../017-offline-pin-reanchor/OUTBOX-DP2-cashier-user_id.md`](../017-offline-pin-reanchor/OUTBOX-DP2-cashier-user_id.md)). POS authors none of it (P16). All tasks below are buildable/testable now against a **fixture roster** carrying `user_id`; live end-to-end completion waits on DP-2. Until then the feature truthfully returns `not_ready`.

---

## Phase 1 — Setup

- [ ] T001 Confirm the next free migration number for the additive `user_id` column (currently `0034` is highest; this feature claims the next, coordinating with 017 per research.md R-1) and record it in `specs/019-cashier-pin-provisioning/plan.md` Project Layout.

## Phase 2 — Foundational (Blocking Prerequisites)

- [ ] T002 [P] Add the `cashier.pin.provisioned` audit category constant + its allowed-categories registration in `src/shared/audit/event-shape.ts` (sibling to `cashier.pin.reset`).
- [ ] T003 [P] Add `CashierPinProvisionedPayload` (`{ target_cashier_id, terminal_id }`, secret-free) to `src/shared/audit/payload-schemas.ts`.
- [ ] T004 RED: migration test asserting an additive nullable `user_id TEXT` column on `cashier_pin_records` (idempotent re-run; existing rows get NULL) in `migrations/__tests__/` (or the project's migration test location).
- [ ] T005 GREEN: author the additive migration `migrations/00NN_add_user_id_to_cashier_pin_records.sql` (nullable, non-key `user_id TEXT`; idempotent `ALTER TABLE … ADD COLUMN`). Make T004 pass.

## Phase 3 — US1: Manager provisions a cashier's first PIN (P1)

**Goal:** A manager/admin can create a never-before-provisioned cashier's PIN record, born keyed on the provider-neutral `user_id`, sealed and auditable; the cashier can then unlock offline.
**Independent test:** with a fixture roster carrying `user_id`, a manager session provisions a cashier with no existing row → a sealed row keyed on `user_id` exists, a `cashier.pin.provisioned` audit event is emitted, and the PIN value appears in no log/audit/response.

### Contract + bridge

- [ ] T010 [US1] RED: bridge-contract test asserting `ProvisionCashierPinRequest`/`ProvisionCashierPinResponse` shape + the `operator.provisionCashierPin` channel in `src/shared/__tests__/operator-bridge-contract.test.ts`.
- [ ] T011 [US1] GREEN: add `ProvisionCashierPinRequest` (`{ event_id, target_user_id, initial_pin }`), `ProvisionCashierPinResponse` (`{ kind: 'pin_provisioned'; audit_event_id } | OperatorRefusal`), and the channel to `src/shared/bridge-api.ts`. Make T010 pass.
- [ ] T012 [US1] GREEN: expose `operator.provisionCashierPin` in the preload bridge `src/preload/index.ts`.
- [ ] T013 [US1] GREEN: register the IPC handler in `src/main/ipc/operator*.ts` wiring to the new handler method.

### Provision handler (the core)

- [ ] T014 [US1] RED: success test — manager session + fixture roster cashier with `user_id` + no existing row → row created with `user_id` populated AND `cashier_clerk_user_id` populated, sealed `pin_hash`/`pin_salt`, `failed_attempt_count=0`, `lockout_until=null`; returns `pin_provisioned`. **Also assert the just-provisioned sealed row is consumable by the existing verifier (`verifyPin` returns `match` for the provisioned PIN) — proving NFR-2 (offline unlock works) without waiting on the DP-2-gated manual smoke (analyze C1).** In `src/main/operator/__tests__/pin-management.provision.test.ts`.
- [ ] T015 [US1] RED: role-gate test — a cashier-role session → `refused: role_mismatch`; no row written.
- [ ] T016 [US1] RED: create-only test — an existing row (a legacy `cashier_clerk_user_id`-keyed row OR a `user_id`-keyed row) for the same `(tenant,branch,terminal,cashier)` → `refused: state_invalid`; no duplicate, no secret replaced (FR-5).
- [ ] T017 [US1] RED: not-ready test — roster entry without `user_id` → `refused: not_ready`; no row; NO fallback to a clerk-keyed row (FR-11).
- [ ] T018 [US1] RED: unpaired/invalid-PIN tests — terminal not paired or PIN outside `^\d{4,6}$` → `refused: invalid_input`; rejected value never echoed.
- [ ] T019 [US1] GREEN: implement `provisionCashierPin` in `src/main/operator/pin-management.ts`: role-gate first → validate `event_id`/PIN shape → resolve scope from `pairingStore.getStatus()` → require roster `user_id` (else `not_ready`) → create-only existence guard across both key columns (else `state_invalid`) → `hashPin` + `sealPinMaterial` → INSERT row keyed on `user_id` (also writing `cashier_clerk_user_id`) → emit `cashier.pin.provisioned` audit → return `pin_provisioned`. Single transaction (NFR-1). Make T014–T018 pass.

### Roster threading

- [ ] T020 [US1] RED: roster-allowlist test — `roster-handler.ts` passes `user_id` through when present, and the path still succeeds when `user_id` is absent (optional on wire). In `src/main/operator/__tests__/roster-handler.test.ts`.
- [ ] T021 [US1] GREEN: widen the `roster-handler.ts:43` allowlist from `{ id, display_name, role }` to `{ id, user_id, display_name, role }` (optional `user_id`); thread it to the provision lookup. Make T020 pass.

### Secret-free audit

- [ ] T022 [US1] RED: audit-redaction test — the `cashier.pin.provisioned` event + the response + logs contain no PIN/hash/salt (extends the canonical cross-process redaction test).
- [ ] T023 [US1] GREEN: emit the secret-free audit event in the handler (covered by T019); make T022 pass.

### Guard

- [ ] T024 [P] [US1] GUARD: assert `src/main/operator/pin-credential.ts` and `pin-lockout.ts` are unchanged by this feature (the verifier never keys on identity — FR-8); a test/CI check fails if either gains an identity parameter.

## Phase Final — Polish & Cross-Cutting

- [ ] T030 [P] Correct the stale 004 docs: `specs/004-operator-session/data-model.md` + `quickstart.md` "provision via `cashier.pin.reset`" language to reflect the real create path (FR-10).
- [ ] T031 [P] Coverage check — ≥80% on the new provisioning logic (`npm test -- --coverage`), confirm the operator module stays in its high-coverage tier (NFR-3).
- [ ] T032 §A4 bridge-security review for the new `operator.provisionCashierPin` channel; record in `specs/019-cashier-pin-provisioning/security-review/` (P8). Final pre-merge gate.
- [ ] T033 Manual smoke per `quickstart.md` (deferred until the DP-2 roster `user_id` is live; jsdom/automated coverage stands in for the internal/dev surface until then).

---

## Dependencies & order

```
T001 (setup)
  └─► T002,T003 [P] (audit category+payload)  ┐
      T004→T005 (additive user_id column)      │  Foundational
                                               ▼
US1:  T010→T011→T012→T013 (contract+bridge+preload+ipc)
        └─► T014–T018 RED → T019 GREEN (handler)  ← core
              ├─ T020→T021 (roster allowlist)
              ├─ T022→T023 (secret-free audit)
              └─ T024 [P] (verifier-untouched guard)
                                               ▼
Polish: T030,T031 [P] · T032 (§A4 gate) · T033 (manual smoke, DP-2-gated)
```

**Parallel opportunities:** T002/T003 (audit pieces); T024 (guard, independent); T030/T031 (docs+coverage). The handler RED tests T014–T018 are independent test files and can be authored in parallel, but their single GREEN (T019) serializes.

**MVP scope:** Phase 2 + US1 through T019 = the create path provably works (against fixture roster). T020–T024 harden it; Polish closes docs + the §A4 gate.

**Total: 22 tasks** (T001, T002–T005, T010–T024, T030–T033).
