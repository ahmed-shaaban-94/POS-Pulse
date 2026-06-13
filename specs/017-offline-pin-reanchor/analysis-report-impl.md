> **DRAFT — NOT DISPATCHED.** Cross-artifact analysis over a DOUBLE-GATED, IMPLEMENTATION-BLOCKED feature. No implementation, no contract, no migration, no gate mutation.

# /speckit-analyze — Cross-Artifact Analysis Report (plan + tasks pass)

**Spec:** 017-offline-pin-reanchor — POS Offline-PIN Re-Anchor off a DP-2 Provider-Neutral Identifier (drift D6)
**Depth:** SPECIFY + CLARIFY + PLAN + TASKS + ANALYZE (DESIGN-READY, IMPLEMENTATION-BLOCKED)
**Date:** 2026-06-13
**Constitution pinned:** v1.5.1 (verified present in `.specify/memory/constitution.md`)
**Artifacts analyzed:** spec.md, plan.md, tasks.md, checklists/requirements.md, constitution v1.5.1, and the four cited evidence files on `origin/main` (`migrations/0006_cashier_pin_records.sql`, `pin-lockout.ts`, `sign-in-handler.ts`, `pin-credential.ts`).

**Verdict:** **0 CRITICAL · 0 HIGH · 2 MEDIUM · 4 LOW.** Goal↔Acceptance (FR/SC) coverage **100%**. Blocker documented **consistently** across spec/plan/tasks. PIN-locality invariant intact. Anchor = §16 `user_id` everywhere. Constitution clean (VIII advanced). **implementationBlocked = true.**

> This pass re-runs `/speckit-analyze` now that plan.md (DESIGN-READY) and tasks.md (20 tasks, all `[BLOCKED]`) exist, extending the earlier SPECIFY+CLARIFY-only analysis. The prior `analysis-report.md` predates the plan/tasks and is superseded by this verdict.

---

## 1. Evidence re-verification (E-1..E-4 vs `origin/main`) — ALL ACCURATE

| ID | Claim | File / lines | Result |
|----|-------|--------------|--------|
| **E-1** | PK `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)` all NOT NULL + covering index `idx_cashier_pin_records_cashier` on the same tuple; `pin_hash`/`pin_salt` BLOB; `failed_attempt_count`/`lockout_until` | `0006_cashier_pin_records.sql` L11,14,16,19-21,26,30-31 | **ACCURATE** |
| **E-2** | `PinScope` + `rowMatchesScope` (PR-4) over `cashier_clerk_user_id`; `SELECT … WHERE … cashier_clerk_user_id = ?`; `persistLockoutState UPDATE … WHERE …` | `pin-lockout.ts` L28-48; `sign-in-handler.ts` L334,336,541 | **ACCURATE** |
| **E-3** | `cashier_clerk_user_id` is a caller-supplied input; cashier session `backend_session_id: ''`; proto-session `jwt: null`; AD-2 local-only | `sign-in-handler.ts` L252,324,417,425,432 | **ACCURATE** |
| **E-4** | Argon2id in-process, no logger injected, `pin_hash`/`pin_salt` sealed BLOBs, verifier never keys on identity | `pin-credential.ts` L4-16,25,34 | **ACCURATE** |

**SC-09 discipline: PASS.** No upstream is asserted built. The D1/D5 "NEW EDGE" (user_id delivery) is grounded empirically in E-3 (the cashier offline path holds no backend-issued credential today), matching the drift-map "synthesis under-modeled this."

## 2. Coverage — Goals ↔ Acceptance ↔ Plan ↔ Tasks (100%, no orphans)

| Goal | Acceptance | Plan section | Task coverage | Status |
|------|-----------|--------------|---------------|--------|
| G-1 neutral-`user_id` PK | A-1 | Tech Context (anchor), Phase 1 §1 | T032 (GREEN migration), T030 (PK-shape RED), T021 (provision) | COVERED |
| G-2 PIN-locality preserved | A-2 | Constitution Security row; Phase 1 §4 | T043 (verifier-untouched GUARD), T031 (copy-fidelity) | COVERED |
| G-3 `clerk_user_id`→bridge | A-3 | Tech Context (bridge col); Phase 1 §2 | T032, T042 (demote to nullable bridge field) | COVERED |
| G-4 no broken unlock / no blind re-enroll | A-4 | Phase 1 §6; Risks | T050→T051 (degradation), T031 | COVERED |
| G-5 PK+index re-keyed, lockout kept | A-5 | Phase 1 §3; Test Strategy | T030, T040→T041, T042 | COVERED |
| G-6 provider-migration-safe | A-6 | Constitution VIII row; Phase 1 §7 | US5 (asserted via T030 PK-shape test) | COVERED |
| — (cross-cutting) | A-7 audit secret-free | Phase 1 §7; VII/P7 | T060→T061 | COVERED |
| — (depth-guard) | A-8 no impl/migration/contract | STATUS banner; N-1 | Whole tasks.md (all `[BLOCKED]`, nothing authored) | COVERED |

**No orphan goals, no orphan acceptance criteria, no orphan tasks.** A-7 (cross-cutting security) and A-8 (SPECIFY-depth guard) are correctly criterion-level (no single parent G-n) — consistent with the checklist's stated design. Every task traces to a spec section/criterion via its citation tag.

## 3. Blocker consistency across spec / plan / tasks — CONSISTENT

The blocker is stated identically and accurately in all three artifacts:
- **spec.md** §5 / Dependencies: `user_id` not delivered to terminal; D1/D5 NEW EDGE; E-3 is the empirical proof.
- **plan.md** STATUS + Risks: "DP-2 delivers `clerk_user_id` … never `user_id`"; `PosOperatorSessionSummary` = `{ id, issued_at, envelope }`; opaque envelope; zero POS contracts carry `user_id`; `IdentityProviderPort` server-side only; 016/D5 shipped but carries opaque envelope + `clerk_user_id`.
- **tasks.md** STATUS banner + T000/T010: same facts; `<user_id source>` in the migration named as "the field that does not exist yet"; **all 20 tasks carry `[BLOCKED: user_id-delivery]`.**

No task builds against the non-existent field: T032 (the migration GREEN task) is explicitly **NOT WRITTEN**, `cashier_pin_records` untouched, `migrations/` untouched. T010 is a hard PASS/STOP gate. Verified: grep-equivalent over tasks.md shows the `[BLOCKED]` tag on T000, T001, T002, T003, T010, T020, T021, T030, T031, T032, T040, T041, T042, T043, T050, T051, T060, T061, T070, T080 = 20/20.

## 4. Invariant integrity — PIN-locality intact

- `pin_hash`/`pin_salt` (Argon2id, DPAPI-sealed) copied verbatim, never re-hashed/re-sealed/surfaced — asserted in tasks Invariant 1 + T031 (copy-fidelity) + T043 (verifier-untouched guard). Confirmed against E-4: `pin-credential.ts` has no logger and never reads an identity field.
- Re-anchor changes **only the key column** — Invariant 3; A-2; spec E-4.
- Anchor = §16 `user_id` (NOT `subject`, NOT `clerk_user_id`) everywhere: spec Clarifications Q1, §4, §7; plan Tech Context first row; tasks Invariant 2. `subject ≈ clerk_user_id` rejection rationale present and consistent.

## 5. Constitution alignment (v1.5.1) — PASS, no VIOLATION

- **III / P8 (Process-Boundary, NON-NEGOTIABLE):** correctly treated as a **DESIGN constraint** — migration designed, not written; no boundary file touched; security review owed at implementation. PASS.
- **VIII (Terminal Identity ≠ User, NON-NEGOTIABLE):** **ADVANCED** — anchoring on the provider-neutral `user_id` removes Clerk coupling from the PK; all six local-unlock-factor rules still hold; Clerk stays the human IdP. Principle present at constitution L560. PASS-ADVANCED.
- **Security / secret-sealing:** unchanged; sealed BLOBs copied verbatim. PASS.
- **VI (Test-First):** every implementation task split RED→GREEN (T020/T030/T031/T040/T050/T060 RED before their GREEN). PASS as design constraint.
- **P3/P5/P13/P15:** P3/P5/P13 design constraints (copy fidelity, idempotent rebuild, small PRs); P15 deferred to rollout (T070). No WAIVED, no VIOLATION across P1–P18.

## 6. Double-gate integrity — sound

- **G10** = satisfied-for-boundary-decisions, **not yet ratified** — stated consistently (spec Dependencies, plan double-gate, tasks posture). Ratification required before dispatch.
- **D3 → D6**: server-side `external_identity_links` exists (DP-2 #550) but **provisioning DEFERRED** (029 wave-status, `linkExternalIdentity` no live caller, `user_unmapped → 401`) — stated identically in all three.
- **D1/D5 → D6 (NEW EDGE)**: empirically confirmed UNMET (E-3). This is the binding blocker. Producer-exclusion respected (D6 authors none of D3/D1/D5).

## 7. Open-question discipline — honored

OQ-D6-1 (transition mechanism) and OQ-D6-2 (bridge retirement) recorded OPEN; carried 028 OQ-2/3/4/9/11 recorded OPEN. No mechanism pre-committed; T001/T051 explicitly tagged `[OQ-D6-1 DECISION — NOT DECIDED HERE]`; never default to blind forced re-enrollment (A-4). Consistent across spec §OQ, plan Risks, tasks OQ table.

## 8. Issues (0 CRITICAL — the blocker is a tracked dependency, not a spec defect)

**MEDIUM-1 (Stale prior `analysis-report.md`).** The pre-existing `analysis-report.md` documents the SPECIFY+CLARIFY-only state and asserts "no plan.md/tasks.md (DOUBLE-GATED)" — now contradicted by the present plan.md + tasks.md. It should be refreshed or annotated as superseded to avoid a future reader concluding the artifacts were never authored.

**MEDIUM-2 (Migration filename placeholder `00NN` un-reconciled).** Plan and tasks both reference `migrations/00NN_reanchor_cashier_pin_records.sql`. The current highest migration referenced in the codebase context is `0034` (008 sync-state). When unblocked, `00NN` must be resolved to the next free sequence at author time; today it is a correct placeholder but worth flagging so it is not copied literally.

**LOW-1 (G10 ratification owner-tracking).** G10 ratification is the Orchestrator's (028) deliverable; no in-repo signal exists to confirm it. Recommend the rollout gate (T070) explicitly checks the cross-repo gates doc rather than assuming.

**LOW-2 (`<user_id source>` SQL token).** The literal `<user_id source>` placeholder in plan §Phase 1 step 3 and T032 is intentional and well-flagged, but is not valid SQL — ensure no tooling lints/extracts it as runnable. (It is inside prose/fenced design text, so currently safe.)

**LOW-3 (Template divergence vs SpecKit).** Spec omits the conventional User-Story/GWT/Edge-Cases/NFR sections and carries 7 OQs (over the conventional max-3). This is intentional (028 Orchestrator house style for a double-gated draft) and documented in the checklist, but a SpecKit-strict reader may flag it; noting for transparency.

**LOW-4 (Codegen re-pin dependency chain).** T010(c)/(d) require `codegen:api`/`codegen:verify` to surface `user_id` on the generated envelope type — this presumes the DP-2 OpenAPI snapshot is re-pinned first (S0-style). The chain is implied but not called out as a discrete pre-step within T010; minor.

---

## Conclusion

The 017 artifact set is **internally consistent, evidence-grounded, and constitutionally clean**. The blocker (`user_id` is never delivered to the terminal — only `clerk_user_id`/subject is) is documented identically across spec, plan, and tasks; all 20 tasks are `[BLOCKED: user_id-delivery]`; no task builds against the non-existent field; the migration is designed but **NOT WRITTEN** and `cashier_pin_records` is untouched. PIN-locality is intact, the anchor is the §16 `user_id` everywhere, VIII is advanced, and open questions are correctly held open. **0 CRITICAL** — the gating dependency is a tracked upstream, not a spec defect. **Implementation remains BLOCKED.**
