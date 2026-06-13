> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# 017 Implementation Blocker — provider-neutral user_id is not delivered to the terminal

**Status:** DESIGN-READY, IMPLEMENTATION-BLOCKED — **gate-1 (user_id-delivery) SATISFIED; G10 component of gate-2 SATISFIED; sole remaining blocker = owner Queue dispatch of POS-017** (updated 2026-06-13).

## ⬆️ UPDATE 2026-06-13 (rev. 2) — the DOUBLE-GATE, reconciled to the Orchestrator kernel

This blocker was **DOUBLE-GATED**. Both gate components are now traced to the kernel authority — and the G10 wording below is **reconciled**: the Orchestrator kernel has **no `ratified` G10 state**. The G10 node's status is `satisfied-for-boundary-decisions`, and the kernel dispatch rule (`route_rules.dispatch_requires: all_required_gates_satisfied`) **treats that value as satisfied** — every G10 consumer (DP-2 029/030/031/033, POS feat(016)/(017)) has already shipped against it, each recorded "consumes G10 (already satisfied)". The earlier "G10 not yet ratified" phrasing here was a POS-017-local invention stricter than the kernel exposes; it is corrected below.

- **Gate 1 — `user_id` delivered to the terminal + POS consumes it: ✅ SATISFIED.**
  - DP-2 shipped **033** (`feat(033)`, PR #567, `c5e1c5d`): the provider-neutral §16 `user_id` (= DP-2 `users.id`) is now an additive, `required`, `uuid` field on the `PosOperatorSummary` operator response — present on every `signed_in` response (sign-in, manager/admin, takeover-confirm incl. idempotent replay), a readable sibling of `id` (not inside the envelope).
  - POS-Pulse **consumes** it: `feat(017)` PR #389 (`75f5e6d`) added `user_id` to `BackendSignInOperator` and reads it through in `interpretSignInResponse` (required; fails closed to `refused` if absent). POS-Pulse validates the response **leniently** (allowlist reader, no zod/ajv on the operator path), so the additive field was always wire-safe. The "Unblock criteria" below (a DP-2 slice surfaces `user_id` **and** POS re-pins to consume it) is therefore **MET**.
- **Gate 2 — auth/identity boundary (G10) + owner dispatch:**
  - **G10 itself: ✅ SATISFIED.** Per the Orchestrator kernel (`docs/kernel/graph.yml`, `docs/gates/cross-repo-gates.md`): G10's required evidence is met — ORCH-028 merged (#85 `76cfcc3`), boundary decisions OQ-1/5/6/7/8/10 signed — and its node status `satisfied-for-boundary-decisions` is the satisfied state for all consumers. There is **no `ratified` transition to perform**; "ratified" is not a state this kernel defines.
  - **Sole remaining blocker: ❌ owner Queue dispatch of POS-017.** D6 becomes a POS-Pulse Queue Item only with **explicit, scoped owner approval** — the kernel act of minting/dispatching the POS-017 task node. This is a governance decision (heaviest item in the 028 drift set: a SQLite `cashier_pin_records` PK-rebuild on offline records), **not** a gate-state change. Until it is dispatched: **no implementation, no migration SQL, no `cashier_pin_records` change.** All 20 tasks remain `[BLOCKED: owner-dispatch]` (reclassified from `[BLOCKED: g10-dispatch]` — G10 is satisfied; the block is the dispatch decision, not the gate).

**Net:** 017 is no longer blocked on *data delivery* (resolved) **or** on G10 (satisfied per the kernel). It is blocked **only** on the **owner's decision to dispatch POS-017 as a Queue Item** — an owner governance act, external to this repo's code.

---

**Original blocker (preserved — gate-1 narrative, now historical):** DESIGN-READY, IMPLEMENTATION-BLOCKED (verified 2026-06-13 on DP-2 origin/main).

017 cannot be implemented: the provider-neutral user_id (028 §16) is never delivered to the terminal. DP-2's shipped PosOperatorSessionSummary carries only { id, issued_at, envelope } — an opaque bearer envelope plus a Clerk-SUBJECT id (= users.clerk_user_id); a grep of all POS-facing contracts (pos-operators, auth, pos-shifts, pos-audit-events, pos-terminal-pairing, vouchers) returns zero user_id; IdentityProviderPort resolves external_identity_links server-side only (callers see VerifiedSubject.subject = clerk_user_id). D3's table exists server-internally (DP-2 #550) but provisioning is DEFERRED, and 016/D5 shipped delivering the opaque envelope + clerk_user_id, NOT user_id. Re-keying cashier_pin_records' PK onto user_id therefore means building against a field that does not exist on the POS wire (the migration's <user_id source> column). This is the drift-map NEW EDGE (D6 needs D1/D5 to deliver user_id), empirically confirmed UNMET via spec evidence E-3 (cashier offline path: backend_session_id '', jwt null, cashier_clerk_user_id caller-supplied). Per owner instruction, STOP at tasks: a NEW upstream DP-2 slice must surface user_id on a POS-facing response, and G10 must be ratified, before any implementation. All 20 tasks are [BLOCKED: user_id-delivery]; no migration SQL authored; cashier_pin_records untouched. This is a tracked upstream dependency, not a spec defect — 0 CRITICAL.

## Unblock criteria
- ✅ **Gate 1 — DONE:** a DP-2 slice surfaces the §16 `user_id` on a POS-facing response **and** POS re-pins to consume it. Met by DP-2 033 (`c5e1c5d`) + POS-Pulse #389 (`75f5e6d`). Re-keying `cashier_pin_records` onto `user_id` no longer builds against a non-existent wire field — `op.user_id` is now read in `interpretSignInResponse`.
- ✅ **G10 — SATISFIED:** the Orchestrator kernel G10 node is `satisfied-for-boundary-decisions` (the satisfied state for consumers; no `ratified` state exists). Required evidence met (ORCH-028 #85; OQ-1/5/6/7/8/10 signed).
- ❌ **REMAINING — owner Queue dispatch:** **explicit scoped owner approval** to mint/dispatch D6 (POS-017) as a POS-Pulse Queue Item. Implementation (the SQLite PK-rebuild) starts only after the owner dispatches it.

## What IS ready
plan.md + tasks.md are design-complete: the SQLite PK-rebuild, pin-secret preservation, bridge-column demotion, and safe-degradation are fully specified and ready to execute the moment `user_id` is delivered. No migration SQL was authored (blocked).
