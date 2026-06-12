> **DRAFT — NOT DISPATCHED.** Planning artifact under docs-only Orchestrator. No implementation, no contract, no migration, no gate mutation. Requires explicit scoped owner approval + G10 verification before any sibling-repo dispatch.

# Requirements Checklist — Spec 016 (D5+D7) POS Operator-Envelope Adoption & Device-Token Reversion

**Feature ID:** 016-operator-envelope-adoption
**Purpose:** Validate that the D5+D7 draft is in-lane (POS consumer), evidence-grounded, correctly gated (G10 + D1→D5→D7), and free of forbidden side effects before it is used to plan any follow-up implementation.
**Created:** 2026-06-11
**Last Updated:** 2026-06-13
**Spec:** [../spec.md](../spec.md) · **Analysis:** [../analysis-report.md](../analysis-report.md)
**Mode:** SPECIFY-ONLY / DRAFT (Orchestrator docs-only). GATED depth — spec.md + this checklist + analysis-report.md ONLY; **no plan.md / tasks.md**.

> A checked box means the draft text already satisfies the item, citing the section that satisfies it. Items depending on an owner decision or an upstream drift item are flagged and point at the relevant open question or DAG edge.
> **Altitude:** every item is a checkable statement about the *spec/draft itself* — there are no implementation, code, or test-runner items (GATED depth forbids them).

## Scope & framing

- [x] **POS consumer lane held** — the draft specifies POS-side acquire/hold/present + device-token reversion; it does **not** define the envelope (D1), the wire scheme (D4), or the offline-PIN re-anchor (D6). *(§1; §3 N-2/N-3/N-5; §4 note "envelope's internals are D1's".)*
- [x] **028 not re-specified** — 028 is the input boundary that *produces* G10; this is a downstream consumer realizing CM-1/CM-2. *(header Relation-to-028; §3 N-4.)*
- [x] **Non-goals prevent scope creep** — explicit N-1…N-8, including "no implementation," "does not define the envelope/scheme," "does not absorb D6," "does not decide refresh-token storage." *(§3.)*
- [x] **Scope is clearly bounded** — SPECIFY-ONLY / DRAFT; target vs current (E-n) vs open (OQ-n) kept distinct throughout. *(header; Evidence basis; §4–§6; Open questions.)*

## Requirement quality

- [x] **No implementation masquerading as requirements** — implementation appears only as *current runtime evidence* (E-1…E-4, each `origin/main` file-cited) or as 028 architecture invariants (CM-1/CM-2/SR-2/SR-4), each labeled. No code, schema, or wire format is authored. *(Evidence basis; §4–§6; §7 "no file edited.")*
- [x] **Requirements are testable** — goals G-1…G-7 and acceptance A-1…A-11 are individually checkable (e.g., A-3 "device token never sale-sync authorization alone"; A-7 "401/403 never drops a sale"). *(§2; Acceptance criteria.)*
- [x] **Dependencies & assumptions identified** — evidence table pins each repo's `origin/main` HEAD; Dependencies & sequencing names G10 + the D1→D5→D7 DAG edges; Open questions enumerate unresolved assumptions. *(Evidence basis; Dependencies & sequencing; Open questions.)*

## Journeys covered

- [x] **Credential lifecycle (D5)** — acquire-at-sign-in → hold-in-existing-seam → present-on-sale-sync → renewal/expiry → sign-out/takeover. *(§4.)*
- [x] **Device-token reversion (D7)** — today's three-role overload (E-2) → narrowed device-scoped role (read-down + device trust) → not the sale-sync authorization credential. *(§5.)*
- [x] **Auth-refusal journey** — 401/403 re-acquire/re-drain (never drop), envelope-present gate (pause on envelope-absent, resume on return). *(§6; G-5.)*
- [x] **Cross-repo dependency journey** — D5 waits on D1 (envelope mint+return); D7 follows D5; D6 adjacent (gated on D3). *(Dependencies & sequencing.)*

## Security boundaries

- [x] **Credential scopes not interchangeable** — provider JWT (sign-in only) ≠ envelope (sale-sync) ≠ device token (device-scoped read-down/trust); the device token alone can never post a sale. *(§4; §5; A-3/A-8; §5 invariant "Sale-sync with device credential only → Refused" / 028 §18; 028 CM-2.)*
- [x] **No long-lived raw provider JWT in POS** — JWT used at sign-in to obtain the envelope, then not retained as the sale-sync credential. *(§4 "the provider JWT's job ends at sign-in"; G-2; 028 SR-4.)*
- [x] **Secrets never bridged/logged/in-body** — envelope held main-process only, never crosses the renderer bridge, never logged, never in the request body. *(§4; G-3; 028 SR-2; POS P7/P8.)*
- [x] **Provider-neutrality** — no Clerk-specific field/scheme/API leaks into the POS sale-sync auth path after adoption; the role-named scheme is D4's. *(G-7; §3 N-3; A-8; 028 G-10.)*
- [x] **Auth refusal never silently drops a sale** — preserved under the new credential lifetime. *(§6; E-4; G-5; A-7.)*

## Evidence discipline (the dispatch's runtime caution)

- [x] **Current runtime reflected without assuming unverified work** — D5 verified at `create-sale-sync-client.ts` (`Authorization: Bearer <clerk-jwt>` + `X-Device-Attestation`, E-1); D7's triple-role overload at `index.ts`/`read-down-client.ts`/`sign-in-handler.ts` (E-2); cashier `jwt:null` + engine pause (E-3); 401/403-as-transient (E-4). All on POS `origin/main` `0bb2ed8`/`b34932b` (#372/#376 arc). *(Evidence basis.)*
- [x] **Requirements defined without hardcoding a stale token model** — current (E-1/E-2), target (envelope adoption / device reversion), and open decisions (OQ-9/OQ-CARRY/OQ-D7-WIRE) kept distinct. *(Evidence basis; §4–§6; Open questions.)*
- [x] **No unverified status claimed as fact (SC-09)** — the envelope (D1) is explicitly **not** shipped; nothing asserts D1/D5/D7 done; the cashier-sync gap is recorded, not asserted resolved. Every cited invariant/scope name (CM-1/CM-2/SR-2/SR-4, the §18 "device-only → Refused" line) is present in this draft — no dangling citation. *(Evidence basis SC-09 note; §1; E-3; OQ-CARRY; A-5/A-6.)*

## Gating & sequencing

- [x] **G10 listed + gated label present** — header label "gated — requires owner approval + G10 verification before any dispatch"; G10 first in the gates list. *(header; Dependencies & sequencing.)*
- [x] **D1 → D5 → D7 sequencing recorded against the verified DAG** — D5 cannot dispatch before D1 mints+returns the envelope; D7 follows D5; cited to `auth-028-drift-map.md`. *(Dependencies & sequencing.)*
- [x] **Upstream contract/migration gates named, not authored** — G2/G3 engaged on the DP-2 (D1) side; POS conforms, authors no contract/migration. *(Dependencies & sequencing; §3 N-1.)*
- [x] **D6 not absorbed** — offline-PIN re-anchor referenced as adjacent (gated on D3 + needs envelope `user_id`), not specified. *(§3 N-5; Dependencies & sequencing.)*

## Acceptance-criteria coverage (A-1…A-11 each verified at spec altitude)

- [x] **A-1 — in-lane** — the draft asserts it does not define the envelope (D1), wire scheme (D4), or offline-PIN re-anchor (D6), and §1 frames it as a POS-consumer conformance draft. *(A-1; §1; §3 N-2/N-3/N-5.)*
- [x] **A-2 — D5 specified** — §4 states the envelope replaces the raw Clerk JWT as the durable client-held sale-sync credential and confines the provider JWT to sign-in. *(A-2; §4; G-1/G-2; 028 CM-1.)*
- [x] **A-3 — D7 specified** — §5 narrows the device token to a device-scoped role and states it is never the sale-sync authorization credential alone. *(A-3; §5; G-4; 028 CM-2.)*
- [x] **A-4 — seam + secrecy** — §4 holds the envelope in the existing main-process seam with unchanged secrecy (main-process only; never bridged/logged/in-body). *(A-4; §4; G-3; 028 SR-2/SR-4.)*
- [x] **A-5 — drift recorded, distinct from target/open** — E-1…E-4 carry `origin/main` file citations and are kept distinct from target and open decisions; no unverified status claimed. *(A-5; Evidence basis; SC-09 note.)*
- [x] **A-6 — cashier gap not resolved** — E-3 records the gap as the operational driver and OQ-CARRY carries pilot-acceptability as an owner call, unresolved. *(A-6; E-3; OQ-CARRY.)*
- [x] **A-7 — auth-refusal preserved** — §6 preserves "auth refusal never silently drops a sale" under the new credential's lifetime. *(A-7; §6; G-5; E-4.)*
- [x] **A-8 — provider-neutrality** — G-7 + A-8 require no Clerk-specific field/scheme/API leaking into the post-adoption sale-sync auth path. *(A-8; G-7; 028 G-10; D4.)*
- [x] **A-9 — G10 + gated label** — the gated label and the G10-first gates list are both present in the header and Dependencies & sequencing. *(A-9; header; Dependencies & sequencing.)*
- [x] **A-10 — DAG sequencing recorded** — D1 → D5 → D7 is recorded against the drift-map DAG. *(A-10; Dependencies & sequencing.)*
- [x] **A-11 — GATED depth (HARD GATE)** — no implementation, contract, migration, or gate mutation; **no plan.md and no tasks.md authored**; the intentional template deviation (no GWT/Edge/NFR) is declared. *(A-11; §3 N-1; authoring note 1a; this folder contains spec.md + this checklist + analysis-report.md only.)*

## Goal coverage (G-1…G-7 each anchored to spec text)

- [x] **G-1 — envelope replaces JWT (D5)** — §4 presents the `pos_operator` envelope as the durable sale-sync credential in place of the raw Clerk JWT. *(§4; A-2; 028 CM-1.)*
- [x] **G-2 — JWT sign-in only** — §4 states the provider JWT's job ends at sign-in and it is not retained as the sale-sync credential. *(§4; A-2; 028 CM-1/SR-4.)*
- [x] **G-3 — main-seam, never bridged/logged/in-body** — §4 holds the envelope in the existing main-process seam with unchanged secrecy. *(§4; A-4; 028 SR-2/SR-4; P7/P8.)*
- [x] **G-4 — device token to device-scoped (D7)** — §5 reverts the device token to read-down + device trust, never sale-sync authorization alone. *(§5; A-3; 028 CM-2.)*
- [x] **G-5 — auth-refusal-never-drops-a-sale** — §6 keeps the row pending with re-acquire/re-drain on 401/403 rather than dead-lettering. *(§6; A-7; E-4.)*
- [x] **G-6 — per-operator credential (cashier can sync)** — §4/§7 frame a per-operator credential as the target that would unblock E-3 *to the extent D1's semantics deliver it*; the draft does not assert the gap closed. *(§1; §7; E-3; OQ-CARRY.)*
- [x] **G-7 — provider-neutral, no Clerk leak** — G-7 + A-8 forbid any Clerk-specific field/scheme/API in the post-adoption auth path. *(G-7; A-8; 028 G-10; D4.)*

## Open questions left open (not auto-decided)

- [x] **OQ-9 carried, not decided** — local refresh-token storage left open; flagged as squarely in this lane (refreshable client-held credential). *(Open questions OQ-9; §4 renewal; §3 N-7.)*
- [x] **OQ-CARRY carried, not decided** — whether the cashier-sync gap (E-3) is acceptable for pilot is an owner call, not resolved. *(Open questions OQ-CARRY; E-3.)*
- [x] **OQ-D7-WIRE carried, not decided** — POS does not unilaterally decide whether a device-trust attestation co-travels with the envelope; that is a D1/D4 contract call. *(Open questions OQ-D7-WIRE; §5.)*
- [x] **Non-lane 028 OQs not touched** — OQ-2/3/4/11 listed as owned elsewhere, not decided. *(Open questions, final bullet.)*

## Forbidden-files / process compliance

- [x] **Wrote only in the assigned feature folder** — only `specs/016-operator-envelope-adoption/spec.md`, this `checklists/requirements.md`, and the ANALYZE deliverable `analysis-report.md` are in scope. No Orchestrator gate/kernel/status file edited (no `docs/gates/**`, `docs/kernel/**`, `docs/status/**`), no 028/029 spec, README, or CLAUDE.md edited. *(Authoring + analyze sessions.)*
- [x] **No sibling-repo file created or edited** — POS-Pulse, Data-Pulse-2, Console, Connector read **read-only** via `git -C … show origin/main:…` / `ls-tree` / `log`; no checkout/pull/merge/reset/stash; working trees never read. (Avoids stop-conditions SC-04 / SC-05.)
- [x] **No git side effects** — nothing staged, committed, pushed, or PR'd; no feature branch created; no `.specify/` tooling invoked (authored manually).
- [x] **No secrets in output** — E-facts describe credential *roles* and header *names* only; no raw token, JWT, device-token, key, or PIN value appears. *(Evidence basis; §4–§5.)*
- [x] **GATED depth respected** — no plan.md and no tasks.md authored (D5's upstream D1 is not built; plan/tasks would be speculative); the omitted GWT/Edge/NFR template sections are declared an intentional deviation. *(this folder; header gating label; spec authoring note 1a.)*
- [x] **Banner on every file** — the exact DRAFT-NOT-DISPATCHED banner opens spec.md, this checklist, and analysis-report.md. *(line 1 of each.)*

## Notes / residual items (owner-facing, not blockers)

- **This draft is not a kernel Queue Item** — materializing a POS Queue Item under G10 and registering it is a separate, owner-gated act (kernel rule: *prose is not evidence*).
- **The drift (E-1…E-4) is recorded as content, not resolved** — resolving D5/D7 is owner-gated, sequenced behind D1, and conforms to the D1/D4 contract.
- **Pilot decision pending (OQ-CARRY)** — the cashier-only-cannot-sync gap may or may not block pilot; that is an explicit owner decision, surfaced not assumed.
