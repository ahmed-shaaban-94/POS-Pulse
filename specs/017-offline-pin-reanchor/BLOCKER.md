> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# 017 Implementation Blocker — provider-neutral user_id is not delivered to the terminal

**Status:** DESIGN-READY, IMPLEMENTATION-BLOCKED — **gate-1 (user_id-delivery) NOW SATISFIED; gate-2 (G10 ratification + owner dispatch) still BLOCKING** (updated 2026-06-13).

## ⬆️ UPDATE 2026-06-13 — the DOUBLE-GATE, gate by gate

This blocker is **DOUBLE-GATED**. The two gates are now in different states:

- **Gate 1 — `user_id` delivered to the terminal + POS consumes it: ✅ SATISFIED.**
  - DP-2 shipped **033** (`feat(033)`, PR #567, `c5e1c5d`): the provider-neutral §16 `user_id` (= DP-2 `users.id`) is now an additive, `required`, `uuid` field on the `PosOperatorSummary` operator response — present on every `signed_in` response (sign-in, manager/admin, takeover-confirm incl. idempotent replay), a readable sibling of `id` (not inside the envelope).
  - POS-Pulse **consumes** it: `feat(017)` PR #389 (`75f5e6d`) added `user_id` to `BackendSignInOperator` and reads it through in `interpretSignInResponse` (required; fails closed to `refused` if absent). POS-Pulse validates the response **leniently** (allowlist reader, no zod/ajv on the operator path), so the additive field was always wire-safe. The "Unblock criteria" below (a DP-2 slice surfaces `user_id` **and** POS re-pins to consume it) is therefore **MET**.
- **Gate 2 — G10 ratified + explicit scoped owner approval for a sibling-repo dispatch: ❌ STILL BLOCKING.**
  - G10 remains **satisfied-for-boundary-decisions, NOT yet ratified** (the gate node lives in the Retail-Tower-Orchestrator). D6 becomes a POS-Pulse Queue Item only with explicit, scoped owner approval **after** G10 verification.
  - Until gate 2 clears, **no implementation, no migration SQL, no `cashier_pin_records` change.** All 20 tasks remain `[BLOCKED: g10-dispatch]` (reclassified from `[BLOCKED: user_id-delivery]`, which is now resolved).

**Net:** 017 is no longer blocked on *data delivery* — the heaviest historical concern (the `<user_id source>` field not existing on the wire) is resolved. It is now blocked **only** on the governance gate (G10 ratification + owner Queue dispatch), which is external to this repo.

---

**Original blocker (preserved — gate-1 narrative, now historical):** DESIGN-READY, IMPLEMENTATION-BLOCKED (verified 2026-06-13 on DP-2 origin/main).

017 cannot be implemented: the provider-neutral user_id (028 §16) is never delivered to the terminal. DP-2's shipped PosOperatorSessionSummary carries only { id, issued_at, envelope } — an opaque bearer envelope plus a Clerk-SUBJECT id (= users.clerk_user_id); a grep of all POS-facing contracts (pos-operators, auth, pos-shifts, pos-audit-events, pos-terminal-pairing, vouchers) returns zero user_id; IdentityProviderPort resolves external_identity_links server-side only (callers see VerifiedSubject.subject = clerk_user_id). D3's table exists server-internally (DP-2 #550) but provisioning is DEFERRED, and 016/D5 shipped delivering the opaque envelope + clerk_user_id, NOT user_id. Re-keying cashier_pin_records' PK onto user_id therefore means building against a field that does not exist on the POS wire (the migration's <user_id source> column). This is the drift-map NEW EDGE (D6 needs D1/D5 to deliver user_id), empirically confirmed UNMET via spec evidence E-3 (cashier offline path: backend_session_id '', jwt null, cashier_clerk_user_id caller-supplied). Per owner instruction, STOP at tasks: a NEW upstream DP-2 slice must surface user_id on a POS-facing response, and G10 must be ratified, before any implementation. All 20 tasks are [BLOCKED: user_id-delivery]; no migration SQL authored; cashier_pin_records untouched. This is a tracked upstream dependency, not a spec defect — 0 CRITICAL.

## Unblock criteria
- ✅ **Gate 1 — DONE:** a DP-2 slice surfaces the §16 `user_id` on a POS-facing response **and** POS re-pins to consume it. Met by DP-2 033 (`c5e1c5d`) + POS-Pulse #389 (`75f5e6d`). Re-keying `cashier_pin_records` onto `user_id` no longer builds against a non-existent wire field — `op.user_id` is now read in `interpretSignInResponse`.
- ❌ **Gate 2 — REMAINING:** **G10 ratified** (currently satisfied-for-boundary-decisions only, in the Orchestrator) **+ explicit scoped owner approval** to dispatch D6 as a POS-Pulse Queue Item. Implementation (the SQLite PK-rebuild) starts only after this.

## What IS ready
plan.md + tasks.md are design-complete: the SQLite PK-rebuild, pin-secret preservation, bridge-column demotion, and safe-degradation are fully specified and ready to execute the moment `user_id` is delivered. No migration SQL was authored (blocked).
