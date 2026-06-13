> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# 017 Implementation Blocker — provider-neutral user_id is not delivered to the terminal

**Status:** DESIGN-READY, IMPLEMENTATION-BLOCKED (verified 2026-06-13 on DP-2 origin/main).

017 cannot be implemented: the provider-neutral user_id (028 §16) is never delivered to the terminal. DP-2's shipped PosOperatorSessionSummary carries only { id, issued_at, envelope } — an opaque bearer envelope plus a Clerk-SUBJECT id (= users.clerk_user_id); a grep of all POS-facing contracts (pos-operators, auth, pos-shifts, pos-audit-events, pos-terminal-pairing, vouchers) returns zero user_id; IdentityProviderPort resolves external_identity_links server-side only (callers see VerifiedSubject.subject = clerk_user_id). D3's table exists server-internally (DP-2 #550) but provisioning is DEFERRED, and 016/D5 shipped delivering the opaque envelope + clerk_user_id, NOT user_id. Re-keying cashier_pin_records' PK onto user_id therefore means building against a field that does not exist on the POS wire (the migration's <user_id source> column). This is the drift-map NEW EDGE (D6 needs D1/D5 to deliver user_id), empirically confirmed UNMET via spec evidence E-3 (cashier offline path: backend_session_id '', jwt null, cashier_clerk_user_id caller-supplied). Per owner instruction, STOP at tasks: a NEW upstream DP-2 slice must surface user_id on a POS-facing response, and G10 must be ratified, before any implementation. All 20 tasks are [BLOCKED: user_id-delivery]; no migration SQL authored; cashier_pin_records untouched. This is a tracked upstream dependency, not a spec defect — 0 CRITICAL.

## Unblock criteria
A new DP-2 slice must surface the provider-neutral §16 `user_id` on a POS-facing response (the sign-in / operator-session / envelope response), and POS must re-pin to consume it. Until then, re-keying `cashier_pin_records` onto `user_id` would build against a field that does not exist on the POS wire. 016 (D5, merged) delivers the opaque envelope + the Clerk-subject `id`, NOT `user_id`.

## What IS ready
plan.md + tasks.md are design-complete: the SQLite PK-rebuild, pin-secret preservation, bridge-column demotion, and safe-degradation are fully specified and ready to execute the moment `user_id` is delivered. No migration SQL was authored (blocked).
