> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# /speckit-analyze — Spec 016 (D5+D7) Operator-Envelope Adoption — IMPLEMENTATION-ENABLEMENT PASS

**Feature:** 016-operator-envelope-adoption · **Constitution pinned:** v1.5.1 (verified against `.specify/memory/constitution.md` SYNC IMPACT REPORT 1.5.0→1.5.1) · **Date:** 2026-06-13
**Artifacts analyzed:** `spec.md`, `plan.md` (v1.0), `tasks.md` (T001–T063), `checklists/requirements.md`, constitution, and the cited `src/main/**` edit sites (read read-only this session).

> **Note on the prior report.** `specs/016-operator-envelope-adoption/analysis-report.md` is the earlier SPECIFY-ONLY analyze (asserts "no plan.md / tasks.md — A-11, GATED depth"). That depth gate was conditioned on **D1 being unbuilt**. D1 has shipped (DP-2 PR #559 / `202d253`), so the prior report's "GATED depth" verdict is now **superseded**. This report is the implementation-enablement deliverable; it does not overwrite the prior file (returned as text per harness rules — to be persisted as `analysis-report-impl.md`).

---

## Verdict

| Dimension | Result |
|---|---|
| **CRITICAL issues** | **0** |
| **Goal ↔ Acceptance ↔ Plan ↔ Task coverage** | **100%** — every G-1…G-7 and A-1…A-11 maps to ≥1 plan section AND ≥1 task; no orphans |
| **Edit-site coverage (GROUND map)** | **100%** — all 8 source sites + 6 test sites verified to exist and to carry a task |
| **A-11 supersession** | Correctly documented — plan's "Status note (gate lifted)" + tasks header both cite D1-shipped/G10-satisfied as the lift condition; the spec body is NOT mutated (only status), so A-11 is honored, not violated |
| **TDD ordering** | Sound — every GREEN task has a preceding RED; D7 (Phase 4) follows D5 (Phase 3) per `D1→D5→D7` |
| **Provider-neutrality (G-7)** | Holds — `pos_operator_envelope` is neutral; no Clerk field/scheme name enters the post-adoption sale-sync auth path |
| **Open-question discipline** | Correct — OQ-9 / OQ-CARRY left OPEN; OQ-D7-WIRE recorded resolved-by-shipped-contract (sales.yaml retires `X-Device-Attestation`) |
| **Scope discipline (P16)** | Held — no contract, no migration authored; all edits under `src/main/**`; no `bridge-api.ts`/preload change |
| **readyToImplement** | **true** (0 CRITICAL; coverage complete; all edit sites verified) |

---

## Goal/Acceptance → Plan → Task coverage matrix (no orphans)

| Item | Plan section | Task(s) | Verified |
|---|---|---|---|
| **G-1 / A-2** envelope replaces JWT (D5) | Phase 1 §D5 diagram; Tech Context | T010, T020/T021, T022/T023, T027/T028 | ✅ |
| **G-2 / A-2** JWT sign-in only | §D5 ("provider JWT's job ends here") | T023 | ✅ |
| **G-3 / A-4** main-seam, never bridged/logged/in-body | Const-Check P7/P8; §Project Layout | T026, T050, T062 | ✅ |
| **G-4 / A-3** device token → device-scoped (D7) | Phase 1 §D7 | T040/T041/T042 | ✅ |
| **G-5 / A-7** auth-refusal never drops a sale | §Auth-refusal design; R4 | T031 (comment), T029/T030 (gate) | ✅ |
| **G-6 / A-6** per-operator credential (cashier) | Risks; §Phase 2 T-J | T051 (VERIFY, non-blocking) | ✅ |
| **G-7 / A-8** provider-neutral | Const-Check G7 row | threaded invariant; T062 | ✅ |
| **A-1** in-lane (no envelope/scheme/PIN def) | "What D1 shipped"; P16 row | T001/T002 framing | ✅ |
| **A-5** drift discipline (E-1…E-4) | inherited from spec | n/a (spec-level, unchanged) | ✅ |
| **A-9** G10 label | Status note | header/status | ✅ |
| **A-10** D1→D5→D7 DAG | Phase 4 intro; Dependencies | phase ordering | ✅ |
| **A-11** GATED depth → SUPERSEDED | Status note (gate lifted) | tasks header | ✅ correctly documented |

Every task (T001–T063) maps back to a goal/acceptance criterion or to a required gate/verification step. No task invents scope outside D5+D7.

---

## Edit-site fidelity (each GROUND site verified in source this session)

| GROUND claim | Source reality | Verdict |
|---|---|---|
| C-1 interpreter allowlist silently drops unknown fields | `backend-client.ts` `interpretSignInResponse` L350–387 hand-builds `{kind, operator, operator_session}` — confirmed drops unknown keys | ✅ trap is real; T020/T021 correct |
| `interpretTakeoverConfirmResponse` delegates to `interpretSignInResponse` | L406–411 calls it — one fix covers both | ✅ |
| `BackendTakeoverConfirmResponse` reuses `BackendSignInSuccess` | L104–107 union over `BackendSignInSuccess` — single type edit (T010) covers both | ✅ |
| C-2 takeover stores `proto.jwt ?? ''` | `takeover-handler.ts` L197 confirmed | ✅ trap is real; T024/T025 correct |
| D5 sign-in stores `exchange.jwt` | `sign-in-handler.ts` L167 confirmed | ✅ T022/T023 correct |
| M-1: engine gate `=== null` passes `''`; client rejects `''` as no_connection | engine L117/L121 `=== null`; client L228 `token.length === 0 → no_connection` — `''` slips the gate then no-ops | ✅ reasoning exact; T029/T030 correct |
| D7: `X-Device-Attestation` header | client L262 confirmed | ✅ T041 |
| M-2: `getDeviceAttestation` required dep, 3 test call sites + index | dep L118–127; tests L206/L244/L258; index L1270–1271 + capture L1262 | ✅ all 4 call sites verified; one-atomic-change sequencing correct |
| Test sites: `TOKEN` L27, `ATTESTATION` L28, request-shape L200, no-attest case L238–250 | all confirmed | ✅ T027/T040 correct |
| sign-in test pattern L113–132 (`jwtHolder.get('be-sess-1')`==`HAPPY_JWT`) | confirmed | ✅ T022 RED anchor correct |
| engine harness token L62; existing null case L175 | confirmed | ✅ T029 mirror correct |

**Line-number drift (LOW, non-blocking):** plan/tasks cite some lines slightly off from `origin/main` (e.g. plan says client `getOperatorToken` ~L259 / engine gate text; actual: client token read L227, header L262, gate L117/L121; dep L118–127). The *substance* and file targets are all correct; only the numeric anchors will need a light refresh at implementation time. Flagged as a tracked nit, not a coverage gap.

---

## Constitution alignment (honest — no unresolved VIOLATION)

- **VIII (Terminal Identity ≠ User, NON-NEGOTIABLE):** Reinforced. D7 de-overloads the device token (E-2) and the device-token-alone-refused invariant is a dedicated task (T043/T044, 028 §18 / CM-2). PASS.
- **V (Type Safety):** Envelope typed `string | null` on `BackendSignInSuccess` (covers takeover union); interpreter validates at boundary (T021 rejects non-string/non-null → `refused`, consistent with existing posture). M-2 removal sequenced so every commit typechecks. PASS.
- **VI (Test-First):** Every GREEN preceded by RED; the two P2 traps (C-1, C-2) + the `''` trap (M-1) each have a dedicated RED task asserting *what the holder actually contains*. PASS.
- **III / P7 / P8 (process boundary, no upward bridge):** No IPC/preload/`bridge-api.ts` change; envelope read in-process via `getOperatorToken` closure (index.ts L1266/L1279). T050 re-pins the bridge invariant. PASS.
- **II (Money, no floats):** Correctly marked N/A — 016 touches no money path (`toWireBody`/`minorUnitsToDecimalString` untouched). PASS.
- **G-7 provider-neutrality:** PASS — Clerk JWT confined to sign-in; neutral field name on the wire.

The plan's Constitution Check (Initial + Post-Design) is honest and matches the source.

---

## Open-question discipline (correct)

- **OQ-9** (local refresh-token storage) — **OPEN**, safe default applied (NOT introduced; v1 renewal via re-sign-in). Surfaced in Risks + T052. ✅ not over-resolved.
- **OQ-CARRY** (cashier-pilot acceptability of E-3 gap) — **OPEN**, owner call. ✅
- **OQ-D7-WIRE** — **RESOLVED by shipped contract** (sales.yaml retires `X-Device-Attestation` from sale routes) with citation in plan R2 + tasks T001. ✅ correct resolution.

---

## Tracked items (non-blocking — surfaced, not silent)

1. **Cashier-envelope unknown (E-3 / G-6).** No acquisition point exists in POS today: cashier sign-in (`sign-in-handler.ts` L391–400) creates `backend_session_id: ''` and never calls the backend; cashier takeover (`takeover-handler.ts` L218–251, AD-2) skips the backend. T051 verifies against #559 whether a cashier-safe envelope-mint exists. **Does NOT block the manager/admin D5/D7 path** (T010–T044 fully enable it). Correctly scoped as a follow-up.
2. **Line-number drift (LOW)** — refresh numeric anchors at implementation time (see table above).
3. **Naming nit (LOW)** — plan's §D5 prose and C-2 say "`ConfirmTakeoverResponse` carries it"; the envelope actually lives on the *backend* type `BackendTakeoverConfirmResponse`/`BackendSignInSuccess`, not the bridge-api `ConfirmTakeoverResponse`. Phase 2 note states the correct type. Harmless ambiguity; worth a one-word tighten.
4. **Residual §A4 re-check** (T062) — confirmation, not new review (no bridge channel touched). Correctly carried.

---

## Conclusion

The plan and tasks are a faithful, test-first, in-lane realization of D5+D7 against the **verified** source and the shipped #559 contract. **0 CRITICAL. 100% coverage** across goals/acceptance/edit-sites/tasks. The A-11 supersession is documented correctly (gate lifted by D1-shipped, spec body unmutated). Both P2 fake-success traps (C-1 interpreter drop, C-2 takeover path) and the M-1 `''` trap have dedicated RED tasks. The M-2 breaking-signature change is sequenced atomically to keep typecheck meaningful. **Ready to implement** pending the explicit scoped owner approval the spec header still requires.
