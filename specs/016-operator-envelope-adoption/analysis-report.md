> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# Analysis Report — Spec 016 (D5+D7) POS Operator-Envelope Adoption & Device-Token Reversion

**Feature ID:** 016-operator-envelope-adoption
**Mode:** SPECIFY-ONLY / DRAFT (Orchestrator docs-only) · **GATED depth** — spec.md + checklists/requirements.md + this report ONLY; **no plan.md / tasks.md** (A-11).
**Generated:** 2026-06-13 · **Spec:** [spec.md](spec.md) · **Checklist:** [checklists/requirements.md](checklists/requirements.md)

> This is the `/speckit-analyze` cross-artifact deliverable. Because plan.md and tasks.md are intentionally absent (GATED — the upstream DP-2 envelope contract D1 is unbuilt), the analysis runs over the artifacts that exist: **spec.md**, the **requirements checklist**, the **constitution**, and the cited **028 / drift-map** dependencies.

---

## Verdict

| Dimension | Result |
|---|---|
| **CRITICAL issues** | **0** |
| **Goal ↔ Acceptance coverage** | **100%** — every G-1…G-7 maps to ≥1 A-n and vice versa; no orphans |
| **Checklist ↔ acceptance coverage** | Complete — A-1…A-11 and G-1…G-7 each verified at spec altitude |
| **Gate integrity** | Sound — G10 + `D1 → D5 → D7` correctly stated; no-plan/no-tasks depth internally consistent |
| **SC-09 discipline** | Held — E-1…E-4 runtime facts kept distinct from the unbuilt D1/D5/D7 target and from open decisions |
| **Provider-neutrality (G-7)** | Holds throughout — no Clerk-specific field/scheme/API in the post-adoption sale-sync auth path |
| **Spec-quality verdict** | `minor-improvements` (all medium/high non-controversial findings applied this pass) |

A draft with **0 CRITICAL** and **100% goal/acceptance coverage** is the expected healthy outcome for a mature SPECIFY-ONLY draft. The findings below are correctness/consistency polish, not gate breaches.

---

## Coverage matrix (Goal ↔ Acceptance)

| Goal | Maps to | Notes |
|---|---|---|
| G-1 envelope replaces JWT (D5) | A-2 | §4 |
| G-2 JWT sign-in only | A-2 | §4; 028 CM-1/SR-4 |
| G-3 main-seam, never bridged/logged/in-body | A-4 | §4; 028 SR-2/SR-4; P7/P8 |
| G-4 device token → device-scoped (D7) | A-3 | §5; 028 CM-2 |
| G-5 auth-refusal never drops a sale | A-7 | §6; E-4 |
| G-6 per-operator credential (cashier can sync) | A-6 | §1/§7; recorded as target, **not** asserted resolved |
| G-7 provider-neutral, no Clerk leak | A-8 | 028 G-10; D4 owns the scheme rename |

No acceptance criterion is orphaned: A-1 (in-lane), A-5 (drift discipline), A-9 (G10/label), A-10 (DAG), A-11 (GATED depth) are framing/process criteria that map to the spec's structural claims rather than a single goal.

---

## Constitution alignment

- **Auth boundary (AD-7, per-surface device-token exception).** The draft conforms: it reverts the device token to its proper device-scoped role (read-down `Authorization: Bearer <device_token>` + device trust) and forbids it from being the sale-sync authorization credential alone (§5; A-3). Consistent with the constitution's device-token scoping.
- **IPC P7/P8 (no upward-of-bridge IPC; typed preload bridge only).** Conforms: the envelope is held main-process only and never crosses the renderer bridge (§4; G-3; A-4).
- **Secret handling / PII-never-in-logs (028 SR-2/SR-4).** Conforms: envelope never logged, never in request body; the spec describes credential *roles* and header *names* only — no raw token value appears.

---

## Findings (prioritized; all medium/high applied this pass)

| # | Severity | Area | Finding | Disposition |
|---|---|---|---|---|
| 1 | HIGH | Checklist evidence citation | Dangling **SR-10** citation in the Security-boundaries item — SR-10 is introduced nowhere in spec.md or the checklist (only SR-2/SR-4 exist), so it was unverifiable and weakened the A-5 evidence-discipline claim. | **FIXED** — re-anchored to the in-spec §5 invariant ("Sale-sync with device credential only → Refused", 028 §18) + 028 CM-2. |
| 2 | HIGH | Process / placement | Authoring-path self-inconsistency: notes described the file under the Orchestrator draft path `docs/specs/drafts/028-followups/…` while the materialized files live at `specs/016-operator-envelope-adoption/`; a process-compliance claim pointed at a non-existent path. | **FIXED** — authoring note 1 now states the draft originated under `docs/**` and was materialized into POS-Pulse at `specs/016-operator-envelope-adoption/`; note 3 + checklist L89 path corrected. |
| 3 | MEDIUM | Template header | Missing `Feature ID` and `Last Updated`; H1 omitted the 016 id, so nothing tied the doc to its own feature number/folder. | **FIXED** — H1 now `Spec 016 — …`; header gained `Feature ID: 016-operator-envelope-adoption` + `Last Updated: 2026-06-13`. |
| 4 | MEDIUM | Template deviation | The template's Primary User Story / GWT Acceptance Scenarios / Edge Cases / NFR sections are absent — legitimately so (GATED, unbuilt D1) but the draft never said so, leaving the omission looking like oversight. | **FIXED** — added intentional-template-deviation note 1a declaring the deliberate, defensible deviation (reinforces A-11). |
| 5 | MEDIUM | Analyze deliverable | `analysis-report.md` (this file) was absent — the subagent harness blocks subagents from writing `.md` report files, so the content was returned as text for the orchestrator to persist. | **FIXED** — persisted by the orchestrator (this file). No plan.md/tasks.md authored; no carried OQ decided; GATED depth preserved. |
| 6 | LOW | Terminology | Envelope-gate phrasing polarity: §6 "envelope-present gate" vs §7 "pauses on envelope-absent" — same condition, opposite-polarity wording. | **FIXED** — standardized on "envelope-present gate" in §7 and G-6 so the A-7/G-5 behavior is unambiguous. |

---

## Open questions — confirmed OPEN, not decided

Per the open-question discipline, only spec-internal clarifications resolvable from the cited 028/DAG evidence may be auto-resolved. **No new spec-internal clarification was needed** (the existing Session 2026-06-11 clarifications already cover them — no auto-resolved entry was added). The following carried questions remain **OPEN and undecided**:

- **OQ-9** (refresh-token local storage) — *carried-upstream from 028*; interacts with the unbuilt D1 envelope contract (refreshable? local refresh credential secrecy/expiry?). Bears on §4 renewal.
- **OQ-CARRY** (pilot-acceptability of the cashier-cannot-sync gap E-3) — *carried-owner*; explicit owner call. Recorded as operational driver only (SC-09).
- **OQ-D7-WIRE** (device-attestation co-travel after D7) — *carried-upstream*; a D1/D4 contract decision POS conforms to.
- **028 OQ-2** (manager override offline), **OQ-3** (PIN complexity / retry-lock), **OQ-4** (multi-terminal sessions vs forced takeover), **OQ-11** (break-glass support access) — *carried-upstream*; owned by 028 / other drift items, out of the POS consumer lane.

---

## Gate integrity check

- **G10** listed first in the gates list; the "gated — requires owner approval + G10 verification before any dispatch" label is present in the header. ✅
- **`D1 → D5 → D7`** sequencing recorded against `auth-028-drift-map.md`: D5 cannot dispatch before D1 mints+returns the envelope; D7 follows D5. ✅
- **No-plan/no-tasks depth** is internally consistent with the unbuilt-D1 rationale and A-11. ✅
- **D6 not absorbed** — referenced as adjacent (gated on D3 + needs envelope `user_id`), not specified. ✅

**No gate, kernel, status, or sibling-repo file was read or written; no git side effects.**
