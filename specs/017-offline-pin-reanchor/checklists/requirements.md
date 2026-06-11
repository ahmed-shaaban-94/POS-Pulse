# Requirements Checklist — Draft D6 POS Offline-PIN Re-Anchor

> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

**Purpose:** Validate that the D6 draft is scoped, evidence-grounded, gate-aware, and free of forbidden side effects before it is used to plan any POS-Pulse follow-up implementation.
**Created:** 2026-06-11
**Spec:** [../spec.md](../spec.md)
**Mode:** SPECIFY+CLARIFY ONLY (Orchestrator docs-only; double-gated item — no plan/tasks authored).

> A checked box means the draft text already satisfies the item, citing the section that satisfies it. Items depending on an owner/upstream decision are flagged and point at the relevant open question.

## Scope & framing

- [x] **Single, named drift item** — D6 only (POS offline-PIN re-anchor); D3/D1/D5 are referenced as upstreams, not re-specified. *(spec §1; §3 N-5.)*
- [x] **Owning repo named** — POS-Pulse; this is a downstream follow-up that consumes 028's boundary. *(header; "Relation to 028".)*
- [x] **Depth bounded to SPECIFY+CLARIFY** — no `plan.md`/`tasks.md`; transition mechanics deferred because the item is double-gated on unbuilt upstreams. *(§0 authoring notes; OQ-D6-1.)*
- [x] **Non-goals prevent scope creep** — N-1…N-7, including "no PIN leaves device" and "no upstream re-specification." *(§3.)*
- [x] **Target vs current vs open kept distinct** — current runtime as E-1…E-4, target in §4–§7, open items as OQ-n. *(Evidence basis; §4; OQ-n.)*

## Requirement quality

- [x] **No implementation masquerading as requirements** — schema/code references appear only as *current runtime evidence* (E-1…E-4) or as architecture constraints (the SQLite table-rebuild constraint in §4); each labeled as such. No migration SQL is authored. *(Evidence basis; §4; §3 N-1.)*
- [x] **Requirements are testable** — A-1…A-8 are individually checkable (PK has no provider id; no PIN egress; bridge column non-key; no broken offline unlock; index re-keyed; provider-switch safe; audited; no implementation). *(Acceptance criteria.)*
- [x] **The heaviest aspect is named and bounded** — PK re-key on offline records via SQLite table rebuild is recorded as the central design problem at spec altitude, with the step sequence deferred to plan-phase. *(§4; Clarifications Q5.)*
- [x] **Dependencies & assumptions identified** — evidence table pins `origin/main` HEADs; the double-gate (G10 + D3 + D1/D5) is explicit. *(Evidence basis; Dependencies & sequencing.)*

## Journeys covered

- [x] **Enrollment journey (online)** — PIN set after online verification; new row keyed on `user_id`, `clerk_user_id` to bridge column. *(§6.)*
- [x] **Re-anchor/transition journey** — existing enrolled cashier's row migrated on next online sign-in, preserving secret + lockout state. *(§6; OQ-D6-1.)*
- [x] **Offline-unlock-during-bridge journey** — migrated rows unlock on `user_id`; not-yet-migrated rows degrade safely on the bridge key, never hard-locked. *(§6; A-4.)*
- [x] **Identifier-provisioning journey** — `user_id` arrives via the D1/D5 envelope into the cached operator grant, never via a backend call. *(§5; §0 boundary.)*

## Security boundaries

- [x] **PIN-locality invariant preserved** — PIN/`pin_hash`/`pin_salt` never leave the device; store makes no backend call for verification; re-anchor touches the key column only. *(§2 G-2; §3 N-2/N-3; A-2; E-4; 028 CM-4/SR-1.)*
- [x] **Credential scopes not interchangeable** — the neutral `user_id` is an *identity* anchor, not a credential; the PIN authorizes only local offline unlock (028 CM-4); no widening. *(§4; §6; 028 SR-10.)*
- [x] **No secret/token/PIN in logs or audit** — re-key audit events carry scope + fact only, never PIN/hash/salt/token. *(§6; A-7; 028 SR-2/N-9.)*
- [x] **No new egress / boundary respected** — `user_id` reaches POS only via Data-Pulse-2; no direct POS → ERPNext path introduced. *(§0; §5.)*
- [x] **Provider-migration safety** — anchoring on `user_id` (not `subject`/`clerk_user_id`) means no second re-key on a provider switch. *(§7; A-6; Clarifications Q1.)*

## Evidence discipline (runtime caution)

- [x] **Current runtime verified on `origin/main`** — POS-Pulse `b34932b` (#379) / badge `0bb2ed8`: PK shape (E-1), code path keying (E-2), the no-backend-credential cashier path (E-3), and PIN-locality (E-4) each cite a concrete file from feature 004. *(Evidence basis.)*
- [x] **The double-gate is grounded, not asserted** — the D1/D5 "NEW EDGE" is justified by E-3 (the cashier path holds no backend-issued credential today), matching the drift-map's "synthesis under-modeled this." *(E-3; Dependencies & sequencing; Clarifications Q2.)*
- [x] **No unverified status claimed as fact (SC-09)** — upstreams D3/D1/D5 are treated as "needs verification / gated," not "done"; the draft is written against the target shape, with implementation explicitly forbidden until they are confirmed built. *(§3 N-7; Dependencies & sequencing; footer.)*
- [x] **Identifier choice grounded in 028** — anchors on §16 `user_id`, with the rationale that `subject` ≈ `clerk_user_id` (still provider-coupled). *(Clarifications Q1; §4.)*

## Gate compliance (G10)

- [x] **G10 listed and labeled** — header carries "gated — requires owner approval + G10 verification before any dispatch"; Dependencies lists G10 with its 028 producer and the signed §22 decisions consumed. *(header; Dependencies & sequencing.)*
- [x] **Producer-exclusion respected** — D6 consumes G10 (does not produce it) and does not author D3/D1/D5. *(Dependencies & sequencing.)*
- [x] **Provider-specific fields classified as a v1 bridge** — `clerk_user_id` is demoted to a bridge column behind the §16 neutral link, not leaked into the long-term key. *(§4; A-3; 028 §16/OQ-6.)*

## Open-question discipline

- [x] **Genuinely-open 028 OQs carried forward, not auto-decided** — OQ-2/3/4/9/11 carried verbatim as relevant. *(Open questions.)*
- [x] **Plan-phase decisions deferred, not invented** — the migration transition mechanism (OQ-D6-1) and bridge-column retirement (OQ-D6-2) are flagged as plan-phase, consistent with SPECIFY+CLARIFY-only depth. *(Open questions; §6.)*

## Forbidden-files / process compliance

- [x] **No forbidden files edited** — only `docs/specs/drafts/028-followups/d6-pos-pin-reanchor/spec.md` and this checklist were created. No `apps/**`, `src/**`, `migrations/**`, OpenAPI YAML, package/lock, CI, generated, secrets, env, deployment, README, or production source in any repo. No existing Orchestrator file (gates/kernel/status/028/029/CLAUDE.md/README) was touched. *(authoring session.)*
- [x] **No sibling-repo edit** — all POS-Pulse / Data-Pulse-2 reads were read-only via `git -C … show origin/main:` / `ls-tree` / `log`; no checkout/pull/merge/reset/stash; no working-tree read. *(SC-04/SC-05 honored.)*
- [x] **No git side effects** — nothing staged, committed, pushed, or PR'd; no `git add`; no branch switch; no `.specify/` tooling invoked to mutate state (authored manually in the house style). *(SPECIFY-ONLY.)*
- [x] **No gate/kernel mutation** — this draft adds no node to `graph.yml`, no row to `cross-repo-gates.md`, no status to `cross-repo-status.md`; becoming a Queue Item is owner-gated future work. *(§0 authoring notes.)*
- [x] **Banner present on every authored file** — the DRAFT-NOT-DISPATCHED banner opens both `spec.md` and this checklist. *(this file head; spec head.)*

## Notes / residual items (owner-facing, not blockers)

- **Double-gated by design** — implementation cannot begin until G10 is signed **and** D3 + the D1/D5 envelope are verified built. This is why depth is SPECIFY+CLARIFY only.
- **The drift is recorded as target, not resolved** — E-1…E-4 are current runtime; the re-anchor is owner-gated future POS-Pulse work.
- **`subject` was considered and rejected** as the anchor (still provider-coupled); the anchor is the §16 `user_id`. *(Clarifications Q1.)*
