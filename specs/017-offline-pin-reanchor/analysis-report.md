> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# /speckit-analyze — Cross-Artifact Analysis Report

> **⚠️ SUPERSEDED (2026-06-13).** This report documents the earlier **SPECIFY+CLARIFY-only** state and asserts "plan.md and tasks.md are intentionally absent." That is no longer current: `plan.md` + `tasks.md` were since authored (design-ready). The current implementation-enablement analysis is **[analysis-report-impl.md](analysis-report-impl.md)**, and the implementation blocker is recorded in **[BLOCKER.md](BLOCKER.md)** — 017 is **DESIGN-READY, IMPLEMENTATION-BLOCKED** (the §16 `user_id` is not delivered to the terminal). Retained for history.

**Spec:** 017-offline-pin-reanchor — POS Offline-PIN Re-Anchor off a DP-2 Provider-Neutral Identifier (drift D6)
**Feature ID:** 017-offline-pin-reanchor
**Depth:** SPECIFY + CLARIFY + ANALYZE ONLY (double-gated: G10 unsigned + D3/D1/D5 unbuilt) — *superseded; see banner above*
**Date:** 2026-06-13
**Artifacts analyzed:** spec.md, checklists/requirements.md, constitution v1.5.1, cited 028 §5/§6/§16 + drift-map deps, verified evidence files on origin/main.
**Spec:** [spec.md](spec.md) · **Checklist:** [checklists/requirements.md](checklists/requirements.md)

**Verdict:** 0 CRITICAL · 0 HIGH · 2 MEDIUM · 4 LOW. FR/SC (Goal↔Acceptance) coverage 100%. Depth gate honored (no plan.md/tasks.md). Invariant intact.

> This is the `/speckit-analyze` cross-artifact deliverable. Because plan.md and tasks.md are intentionally absent (DOUBLE-GATED — G10 unsigned and the DP-2 upstreams D3 + D1/D5 are unbuilt), the analysis runs over the artifacts that exist: **spec.md**, the **requirements checklist**, the **constitution**, and the cited **028 / drift-map** dependencies.

---

## 1. Evidence re-verification (E-1..E-4 against origin/main)

Every current-runtime fact accurately labeled as current-runtime, not target.

- **E-1:** PK = `(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)` all NOT NULL + covering index on the same tuple — `migrations/0006_cashier_pin_records.sql` — **ACCURATE.**
- **E-2:** `PinScope` / `rowMatchesScope` + `WHERE cashier_clerk_user_id = ?` — `pin-lockout.ts`, `sign-in-handler.ts` — **ACCURATE.**
- **E-3:** caller-supplied `cashier_clerk_user_id`, `backend_session_id: ''`, `jwt: null`, AD-2 local-only — `sign-in-handler.ts` — **ACCURATE.**
- **E-4:** Argon2id in-process, no logger, `pin_hash`/`pin_salt` sealed — `pin-credential.ts` — **ACCURATE.**

**SC-09 discipline: PASS** (no upstream asserted built; the D1/D5 NEW EDGE is grounded empirically in E-3).

## 2. Coverage — Goals ↔ Acceptance (FR/SC = 100%)

G-1↔A-1, G-2↔A-2, G-3↔A-3, G-4↔A-4, G-5↔A-5, G-6↔A-6 all ✅. A-7 (audit) and A-8 (no impl/gate mutation) are **criterion-level by design** (cross-cutting security → §6 + 028 SR-8; depth-guard → N-1), correctly **NOT orphans**. No orphan goals. FR/SC coverage = **100%**.

## 3. Checklist coverage of acceptance criteria

All eight criteria A-1..A-8 covered by the 8-group checklist with cited sections. Complete; none unaddressed.

## 4. Consistency findings

- **PIN-locality invariant** (E-4 / 028 CM-4 / SR-1): **INTACT everywhere.**
- **Anchor consistency** (§16 `user_id`, never `subject`/`clerk_user_id` as PK): **CONSISTENT everywhere**; `subject` explicitly rejected.
- No E-n drift fact mislabeled as target.
- The one prior spec-internal inconsistency (§4 "backfill-on-reconnect") was correctly resolved to mechanism-neutral **"bounded transition window"** with an inline `(auto-resolved 2026-06-13)` marker — this **does NOT decide OQ-D6-1**; no other location pre-commits a mechanism.
- §6 control-ID now consistent: lockout = **PR-3**, scope guard = **PR-4**.

## 5. Constitution alignment (v1.5.1)

- **Principle VIII** (Terminal Identity ≠ User Identity, NON-NEGOTIABLE): the re-anchor **STRENGTHENS VIII** — removes provider lock-in, never mints/accepts backend tokens.
- **III / P8:** conformant as a draft (no IPC/bridge/migration authored; migration deferred to plan-phase, gated on security review).
- **P7 + SR-2/SR-8:** conformant (audit carries scope + fact only).
- **safeStorage/DPAPI:** conformant (`pin_hash`/`pin_salt` sealed verbatim, no re-hash/re-seal).
- **P17:** conformant (tenant/branch/terminal scope retained).
- **P15:** correctly deferred (rollout-phase).
- **P16 / IX:** conformant (no upstream re-spec, no `_reference` copy-paste).
- **SQLite migration-safety:** recorded as a spec-altitude constraint + A-5; step-sequence deferred to OQ-D6-1.

Respected, not violated.

## 6. Gate integrity

G10 + DAG double-gate correctly modeled; `D3 → D6` (VERIFIED) + `D1/D5 → D6` (NEW EDGE, empirically justified by E-3) both present; build-order step 5 matches the drift-map. Producer-exclusion respected (D6 consumes G10, does not author D3/D1/D5). Depth gate A-8 filesystem-verified — only spec.md + checklists/requirements.md exist; no plan.md/tasks.md. Open-question discipline: OQ-D6-1, OQ-D6-2, 028 OQ-2/3/4/9/11 all recorded **OPEN**, none auto-decided; the single §4 auto-resolution removes a contradiction without picking a mechanism.

## 7. Prioritized issues

| Severity | Area | Issue | Disposition |
|---|---|---|---|
| MEDIUM | Template / structure | Omits SpecKit standard sections (User Stories / GWT / Edge Cases / NFR / Assumptions); carries 7 open questions (over conventional max-3). | Acknowledged 028 Orchestrator house-style for a double-gated draft; journeys covered in §6 + checklist. **Intentional divergence, no edit.** |
| MEDIUM | Coverage / traceability | A-7 and A-8 are acceptance criteria with no explicit parent Goal G-n. | **Not true orphans** — A-7 → §6 + 028 SR-8 (cross-cutting), A-8 → N-1 (depth-guard). Leave as criteria-level. |
| LOW | Evidence basis | Dual-HEAD notation `b34932b (#379) / 0bb2ed8 (badge [skip ci])`. | Cosmetic; content verified against b34932b. Keep as-is. |
| LOW | §5 seam | Inert-seam clause correct but skimmable in isolation. | Conditional clause mitigates; clause added this pass. No further change. |
| LOW | Path attestation | Renumbered draft-path cross-refs. | Internally consistent (`specs/017-offline-pin-reanchor/`); attestation holds. |
| LOW | External deps | 028 / drift-map deps cited but not re-opened this pass. | Framed as gated/needs-verification per SC-09; posture sound. |

## 8. Conclusion

The 017 draft is internally consistent, evidence-grounded, gate-aware, and invariant-preserving. All four E-facts verify verbatim against origin/main. Goal↔Acceptance coverage 100%, no orphan goals. PIN-locality invariant and §16 `user_id` anchor uniform throughout. Constitution alignment clean; the re-anchor **STRENGTHENS Principle VIII** anti-lock-in. Double-gate correctly modeled; SPECIFY+CLARIFY-only depth filesystem-verified with the migration step-sequence deferred to OQ-D6-1.

**No further edits required beyond those applied this pass. Recommend owner review under G10 — no dispatch until G10 is signed AND D3 + D1/D5 are confirmed built.**
