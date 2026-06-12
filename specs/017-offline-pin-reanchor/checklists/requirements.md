# Requirements Checklist — Draft D6 POS Offline-PIN Re-Anchor

> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

**Purpose:** Validate that the D6 draft is scoped, evidence-grounded, gate-aware, and free of forbidden side effects before it is used to plan any POS-Pulse follow-up implementation.
**Created:** 2026-06-11
**Spec:** [../spec.md](../spec.md)
**Mode:** SPECIFY+CLARIFY ONLY (Orchestrator docs-only; double-gated item — no plan/tasks authored).

> A checked box means the draft text already satisfies the item, citing the section that satisfies it. Items depending on an owner/upstream decision are flagged and point at the relevant open question. **Altitude:** every item is a checkable statement about the spec/draft itself — no migration-step, table-rebuild-sequence, or test-runner items (those are DOUBLE-GATED and the PK-rebuild sequence is OQ-D6-1 / plan-phase).

## Scope & framing

- [x] **Single, named drift item** — D6 only (POS offline-PIN re-anchor); D3/D1/D5 are referenced as upstreams, not re-specified. *(spec §1; §3 N-5.)*
- [x] **Owning repo named** — POS-Pulse; this is a downstream follow-up that consumes 028's boundary. *(header; "Relation to 028".)*
- [x] **Depth bounded to SPECIFY+CLARIFY** — no `plan.md`/`tasks.md`; transition mechanics deferred because the item is double-gated on unbuilt upstreams. *(header authoring notes; OQ-D6-1.)*
- [x] **Non-goals prevent scope creep** — N-1…N-7, including "no PIN leaves device" and "no upstream re-specification." *(§3.)*
- [x] **Target vs current vs open kept distinct** — current runtime as E-1…E-4, target in §4–§7, open items as OQ-n. *(Evidence basis; §4; OQ-n.)*

## Requirement quality

- [x] **No implementation masquerading as requirements** — schema/code references appear only as *current runtime evidence* (E-1…E-4) or as architecture constraints (the SQLite table-rebuild constraint in §4); each labeled as such. No migration SQL is authored. *(Evidence basis; §4; §3 N-1.)*
- [x] **Requirements are testable at spec altitude** — A-1…A-8 are individually checkable statements about the target shape (PK has no provider id; no PIN egress; bridge column non-key; no broken offline unlock; index re-keyed; provider-switch safe; audited; no implementation), not procedure steps. *(Acceptance criteria.)*
- [x] **The heaviest aspect is named and bounded** — PK re-key on offline records via SQLite table rebuild is recorded as the central design problem at spec altitude, with the step sequence deferred to plan-phase. *(§4; Clarifications Q5.)*
- [x] **Dependencies & assumptions identified** — evidence table pins `origin/main` HEADs; the double-gate (G10 + D3 + D1/D5) is explicit. *(Evidence basis; Dependencies & sequencing.)*

## Goal coverage (G-1…G-6 — each goal is specified and traced to acceptance)

- [x] **G-1 — neutral-`user_id` PK** — the goal to make the store's durable identity the §16 `user_id` (not `cashier_clerk_user_id`) is stated and lands as a verifiable target. *(§2 G-1; §4 Target shape; → A-1.)*
- [x] **G-2 — PIN-locality preserved** — the goal that PIN/`pin_hash`/`pin_salt` never leave the device and the store makes no backend call, re-anchor touching the key column only, is stated. *(§2 G-2; §3 N-2/N-3; E-4; → A-2.)*
- [x] **G-3 — `clerk_user_id` demoted to bridge** — the goal to retain the provider id as a non-key bridge column behind the neutral link is stated. *(§2 G-3; §4 Target shape; → A-3.)*
- [x] **G-4 — no broken unlock / no blind re-enrollment** — the goal to re-anchor without breaking already-enrolled offline unlock and without forced PIN re-enrollment, with an auditable safe-degradation path, is stated. *(§2 G-4; §6; → A-4.)*
- [x] **G-5 — PK + index re-keyed, lockout kept** — the goal to re-key the composite PK and covering index under SQLite rebuild semantics while preserving tenant/branch/terminal scope and PR-3 lockout state is stated (as a constraint, not a step list). *(§2 G-5; §4; §6; → A-5.)*
- [x] **G-6 — provider-migration-safe (no second re-key)** — the goal that a future provider switch must not re-key this store again is stated. *(§2 G-6; §7; → A-6.)*

## Acceptance-criterion verifiability (A-1…A-8 — each is a checkable spec-level statement)

- [x] **A-1 — durable identity is the neutral `user_id`** — verifiable from §4: PK + covering index anchor on §16 `user_id`; no provider-specific id remains a PK component. Traces to G-1. *(A-1; §4.)*
- [x] **A-2 — no PIN egress, key-column-only change** — verifiable from E-4 + §2 G-2: no PIN/hash/salt leaves the device, no backend verification call; re-anchor touches the key column only. Traces to G-2. *(A-2; E-4; 028 CM-4/SR-1.)*
- [x] **A-3 — `clerk_user_id` is non-key bridge** — verifiable from §4 Target shape: the provider id survives as a non-key column, retired only by a later separate decision (OQ-D6-2). Traces to G-3. *(A-3; §4; OQ-D6-2.)*
- [x] **A-4 — no broken unlock / no blind re-enrollment** — verifiable from §6: migrated rows unlock on `user_id`, not-yet-migrated rows degrade safely on the bridge key (never hard-locked), no forced re-enrollment. Traces to G-4. *(A-4; §6; Clarifications Q4.)*
- [x] **A-5 — PK + index re-keyed, scope + lockout preserved** — verifiable as a target constraint in §4/§6 (preserve scope, PIN secret columns, PR-3 lockout state); the rebuild *sequence* is correctly held out as OQ-D6-1/plan-phase, not asserted here. Traces to G-5. *(A-5; §4; §6; OQ-D6-1.)*
- [x] **A-6 — provider switch does not re-key again** — verifiable from §7: anchoring on `user_id` (not `subject`/`clerk_user_id`) absorbs a future provider change in the DP-2 adapter/link. Traces to G-6. *(A-6; §7; Clarifications Q1.)*
- [x] **A-7 — clean audit, no secret/token/PIN** — a cross-cutting security criterion (no parent goal by design): re-key/migration emits a local, later-synced audit event carrying scope + fact only. *(A-7; §6; 028 SR-2/SR-8/N-9. Criterion-level — traces to §6 security posture, not a single G-n.)*
- [x] **A-8 — no implementation / migration / contract / gate mutation** — a depth-guard criterion (no parent goal by design): the draft produces no code, SQL, contract, or gate change. *(A-8; §3 N-1; SPECIFY-ONLY. Criterion-level — traces to the SPECIFY+CLARIFY depth gate, not a single G-n.)*

## Journeys covered

- [x] **Enrollment journey (online)** — PIN set after online verification; new row keyed on `user_id`, `clerk_user_id` to bridge column. *(§6.)*
- [x] **Re-anchor/transition journey** — existing enrolled cashier's row migrated on next online sign-in, preserving secret + lockout state; exact mechanism held to OQ-D6-1. *(§6; OQ-D6-1.)*
- [x] **Offline-unlock-during-bridge journey** — migrated rows unlock on `user_id`; not-yet-migrated rows degrade safely on the bridge key, never hard-locked. *(§6; A-4.)*
- [x] **Identifier-provisioning journey** — `user_id` arrives via the D1/D5 envelope into the cached operator grant, never via a backend call; the seam is explicitly inert until D1+D5 land. *(§5; Architecture boundary.)*

## Security boundaries

- [x] **PIN-locality invariant preserved** — PIN/`pin_hash`/`pin_salt` never leave the device; store makes no backend call for verification; re-anchor touches the key column only. *(§2 G-2; §3 N-2/N-3; A-2; E-4; 028 CM-4/SR-1.)*
- [x] **Credential scopes not interchangeable** — the neutral `user_id` is an *identity* anchor, not a credential; the PIN authorizes only local offline unlock (028 CM-4); no widening. *(§4; §6; 028 SR-10.)*
- [x] **No secret/token/PIN in logs or audit** — re-key audit events carry scope + fact only, never PIN/hash/salt/token. *(§6; A-7; 028 SR-2/N-9.)*
- [x] **No new egress / boundary respected** — `user_id` reaches POS only via Data-Pulse-2; no direct POS → ERPNext path introduced. *(Architecture boundary; §5.)*
- [x] **Provider-migration safety** — anchoring on `user_id` (not `subject`/`clerk_user_id`) means no second re-key on a provider switch. *(§7; A-6; Clarifications Q1.)*

## Evidence discipline (runtime caution)

- [x] **Current runtime verified on `origin/main`** — POS-Pulse `b34932b` (#379) / badge `0bb2ed8`: PK shape (E-1), code-path keying (E-2), the no-backend-credential cashier path (E-3), and PIN-locality (E-4) each cite a concrete file from feature 004. *(Evidence basis.)*
- [x] **The double-gate is grounded, not asserted** — the D1/D5 "NEW EDGE" is justified by E-3 (the cashier path holds no backend-issued credential today), matching the drift-map's "synthesis under-modeled this." *(E-3; Dependencies & sequencing; Clarifications Q2.)*
- [x] **No unverified status claimed as fact (SC-09)** — upstreams D3/D1/D5 are treated as "needs verification / gated," not "done"; the draft is written against the target shape, with implementation explicitly forbidden until they are confirmed built. *(§3 N-7; Dependencies & sequencing; footer.)*
- [x] **Current-runtime facts stay distinct from target/open** — E-1…E-4 are labeled current runtime; §4–§7 are target; OQ-n are open. No E-n is restated as a shipped target. *(Evidence basis; §4–§7; OQ-n.)*
- [x] **Identifier choice grounded in 028** — anchors on §16 `user_id`, with the rationale that `subject` ≈ `clerk_user_id` (still provider-coupled). *(Clarifications Q1; §4.)*

## Gate compliance (G10)

- [x] **G10 listed and labeled** — header carries "gated — requires owner approval + G10 verification before any dispatch"; Dependencies lists G10 with its 028 producer and the signed §22 decisions consumed. *(header; Dependencies & sequencing.)*
- [x] **Producer-exclusion respected** — D6 consumes G10 (does not produce it) and does not author D3/D1/D5. *(Dependencies & sequencing.)*
- [x] **DAG upstreams unbuilt, not back-asserted** — D3 (`D3 → D6`) and the D1/D5 "NEW EDGE" are listed as gating prerequisites; implementation forbidden until they are verified built on `origin/main`. *(Dependencies & sequencing; A-8 depth-guard.)*
- [x] **Provider-specific fields classified as a v1 bridge** — `clerk_user_id` is demoted to a bridge column behind the §16 neutral link, not leaked into the long-term key. *(§4; A-3; 028 §16/OQ-6.)*

## Open-question discipline

- [x] **Genuinely-open 028 OQs carried forward, not auto-decided** — OQ-2/3/4/9/11 carried verbatim as relevant. *(Open questions.)*
- [x] **Plan-phase decisions deferred, not invented** — the migration transition mechanism (OQ-D6-1) and bridge-column retirement (OQ-D6-2) are flagged as plan-phase, consistent with SPECIFY+CLARIFY-only depth. *(Open questions; §6.)*
- [x] **The only spec-owned in-place resolution is bounded** — §4 spec-owns just the *existence* of a transition window (deterministic from offline-first + online-only key arrival); it does not pre-commit a mechanism, deferring that to OQ-D6-1. *(§4 auto-resolved note; OQ-D6-1.)*

## Forbidden-files / process compliance

- [x] **No forbidden files edited** — only `specs/017-offline-pin-reanchor/spec.md` and this checklist (the draft was relocated/renumbered to 017 under the POS-Pulse `specs/` tree). No `apps/**`, `src/**`, `migrations/**`, OpenAPI YAML, package/lock, CI, generated, secrets, env, deployment, README, or production source in any repo. No existing Orchestrator file (gates/kernel/status/028/029/CLAUDE.md/README) was touched. *(authoring session.)*
- [x] **No sibling-repo edit** — all POS-Pulse / Data-Pulse-2 reads were read-only via `git -C … show origin/main:` / `ls-tree` / `log`; no checkout/pull/merge/reset/stash; no working-tree read. *(SC-04/SC-05 honored.)*
- [x] **No git side effects** — nothing staged, committed, pushed, or PR'd; no `git add`; no branch switch; no `.specify/` tooling invoked to mutate state (authored manually in the house style). *(SPECIFY-ONLY.)*
- [x] **No gate/kernel mutation** — this draft adds no node to `graph.yml`, no row to `cross-repo-gates.md`, no status to `cross-repo-status.md`; becoming a Queue Item is owner-gated future work. *(header authoring notes.)*
- [x] **Banner present on every authored file** — the DRAFT-NOT-DISPATCHED banner opens both `spec.md` and this checklist. *(this file head; spec head.)*

## Notes / residual items (owner-facing, not blockers)

- **Double-gated by design** — implementation cannot begin until G10 is signed **and** D3 + the D1/D5 envelope are verified built. This is why depth is SPECIFY+CLARIFY only.
- **The drift is recorded as target, not resolved** — E-1…E-4 are current runtime; the re-anchor is owner-gated future POS-Pulse work.
- **`subject` was considered and rejected** as the anchor (still provider-coupled); the anchor is the §16 `user_id`. *(Clarifications Q1.)*
- **A-7 / A-8 are criterion-level by design** — they have no single parent goal (A-7 is cross-cutting security → §6; A-8 is the SPECIFY+CLARIFY depth-guard). Recorded as criterion-level rather than forced into a Goal↔Acceptance bijection.
- **Template divergence is intentional** — the draft omits the SpecKit User-Story/GWT/Edge-Cases/NFR/Assumptions sections and carries 7 OQs (over the conventional max-3), matching the 028 Orchestrator house style for a double-gated draft; journeys live in §6 + the Journeys group above.
