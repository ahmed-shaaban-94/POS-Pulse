# Spec Kit Readout — 004 S5 Planning (issue 88)

> **Docs-only Spec Kit planning artifact for issue 88 — 004 S5: blind
> shift close and visibility boundaries.** No source code, tests,
> migrations, package edits, codegen, OpenAPI, CI, or Data-Pulse-2
> changes are introduced by this PR. The canonical artifacts
> ([`../spec.md`](../spec.md), [`../plan.md`](../plan.md),
> [`../tasks.md`](../tasks.md),
> [`../contracts/`](../contracts/)) already cover S5; this readout
> records what Spec Kit produced, reconciles the now-stale gate tags
> on the existing Phase 7 task set, and surfaces the open
> implementation-time coordination questions that the eventual S5
> implementation task author must answer before T089 starts.

- **Issue:** [#88 — 004 S5 — blind shift close and visibility boundaries](https://github.com/ahmed-shaaban-94/POS-Pulse/issues/88) — OPEN, `status:ready`
- **Slice:** S5 (Phase 7) in [`../tasks.md`](../tasks.md)
- **Tasks in scope:** T083–T093 (existing; not added)
- **Driving draft:** [`./s5-blind-shift-close-spec-draft.md`](./s5-blind-shift-close-spec-draft.md)
- **Gate state at planning time (2026-05-11):**
  Slice 0 ✅, §A1 ✅, §A2 Wave 1–4 ✅, §A3 ✅, §A4 ✅. S4 ✅
  (PR #124, T056 waived in full via issue 101 Option A waiver).
  Issue 88 unblocked from every gate's perspective; **no S5
  implementation started, none introduced by this PR.**
  005 remains blocked behind §A0.

---

## 1. Spec Kit phase readout

S5 entered this planning cycle with an unusually well-developed
substrate: the canonical spec, plan, tasks, contracts, and
[`./s5-blind-shift-close-spec-draft.md`](./s5-blind-shift-close-spec-draft.md)
already covered the slice in normative detail. The five Spec Kit
phases were run for the slice; most produced no-op outcomes against
the canonical artifacts because the slice was already specified at
the appropriate level for issue 88. The readout below records, for
each phase, what was confirmed and what (if anything) needs to land.

### 1.1 `/speckit-specify` — re-confirmation pass

**Outcome: NO-OP at the canonical layer.** The spec's US3, FR-021,
FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, FR-029,
FR-032, the Edge Cases for takeover-stranded-shift /
cashier-returns-after-forced-close / manager-forced-close-from-
different-terminal, and the Key Entities definitions for `Shift`
(`open` / `closed_normal` / `closed_forced` with `declared_count =
absent` as a first-class state) and `Sensitive Action`
(`shift.forced_close` carrying `shift_owner` + `forced_close_actor`
+ `forced_close_reason`) already encode every behaviour S5 ships.
No spec edits are introduced by this PR.

The S5 implementation PR (a future PR, not this one) MAY introduce
matrix and data-model edits when the implementation lands (see §2
and §3 below); none of those touch [`../spec.md`](../spec.md).

### 1.2 `/speckit-clarify` — confirm no open NEEDS CLARIFICATION

**Outcome: NO-OP.** The spec's "Open Questions / NEEDS
CLARIFICATION" section records all three pre-existing markers as
resolved on 2026-05-05; no new markers were introduced by the S5
slice. The genuinely-open *implementation-time* coordination
questions are listed in §3 of this readout — they are not
spec-level ambiguities (the spec's behavioural contract is
complete) but choices the implementation task author must make
within the bounds the spec already sets.

### 1.3 `/speckit-plan` — re-confirmation pass

**Outcome: NO-OP at the canonical layer.** [`../plan.md`](../plan.md)
v1.1 already covers S5 in the Phase 3 slice table, the
Architectural Decisions (AD-1 bridge-surface enforcement primary,
AD-3 audit append-only with client UUIDs, AD-4 top-level
`/sign-in`), the Test Strategy (≥ 90 % coverage on
`src/renderer/ui/operator/`, ≥ 95 % on the audit module), and the
Production-Readiness rubric. The plan was last revised
2026-05-06; nothing in S5 forces a plan revision.

§A2 Wave 4 clearance is recorded in
[`../coordination.md`](../coordination.md) (the durable
coordination record per the plan's own protocol); no
[`../plan.md`](../plan.md) edit is needed for it.

### 1.4 `/speckit-tasks` — gate-tag reconciliation only

**Outcome: targeted edits in [`../tasks.md`](../tasks.md).** Phase 7
contains T083–T093 with gate-tag qualifiers that were authored
before §A1 cleared (2026-05-05) and before §A2 Wave 4 cleared
(2026-05-11). With those gates now ✅, the qualifiers
`[BLOCKED: §A1]` and `[BLOCKED: §A2 (S5)]` on every Phase 7 task,
on the Phase 7 header, and on the Phase 7 implementation subhead
are stale.

The S5 planning PR (this PR) performs a **gate-tag-only
reconciliation**:

- The Phase 7 header drops the `[BLOCKED: §A1, §A2 (S5)]`
  qualifier (header rephrased to reflect that all gates have
  cleared but the slice has not started; checkbox state of every
  task is preserved).
- The Phase 7 implementation subhead drops the qualifier.
- Each individual task line on T083–T093 drops its
  `[BLOCKED: …]` qualifier.
- Every task's checkbox **remains `- [ ]`** (unchecked). No task
  is marked complete or in progress by this PR.
- Each task's dependency clause (`— depends on T…`) is preserved
  verbatim.
- Each task's `[P]`, `[US2]`, `[US3]` traceability tags are
  preserved verbatim.

The "Last updated" line at the top of
[`../tasks.md`](../tasks.md) is bumped to record this
reconciliation. The dependency-graph annotation at line 361
already records the gate state as "ALL GATES CLEAR (S4 ✅ +
§A2 Wave 4 ✅ 2026-05-11); NOT STARTED; issue 88 is next
candidate" — that annotation is preserved verbatim.

No new tasks are added. No existing tasks are removed.

### 1.5 `/speckit-analyze` — cross-artifact consistency findings

**Outcome: consistent.** A read-only walk across
[`../spec.md`](../spec.md), [`../plan.md`](../plan.md),
[`../tasks.md`](../tasks.md), the three contracts files, the S5
draft, and [`../coordination.md`](../coordination.md) confirms:

- The bridge contract ([`../contracts/bridge-api.md`](../contracts/bridge-api.md))
  defines `operator.forceCloseShift` (Endpoint 7) with the shape
  the handler in T089 will implement; payload shape matches the
  draft §7.2 attribution-fields table.
- The backend contract ([`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md))
  records `shift.forced_close` as a recognised category under
  Endpoint 5, with the required structural-field persistence
  constraint, and the S5 Wave 4 row.
- The role visibility matrix ([`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md))
  Section 3 already carries the stuck-shift list, forced-close
  form, cashier management surface, PIN reset / unlock actions,
  and stuck-shift count-badge rows. Section 4 enumerates the
  cashier-forbidden information catalogue including the
  stuck-shift list and the forced-close audit-event details.
  The matrix's own Section 8 says new surface rows ship with the
  implementing feature's PR; the proposed S5 *additions* in the
  draft (§5.1, §5.2) are queued for the eventual S5
  implementation PR (see §2 below).
- The audit-event catalogue in
  [`../tasks.md`](../tasks.md) (Phase 5 / S3) and
  `src/shared/audit/event-shape.ts` (landed in S3) already
  include `'shift.forced_close'` in the closed `ActionCategory`
  union — verified at planning time by inspection of
  [`../tasks.md`](../tasks.md) lines 165 and 322–324 (which list
  `shift.forced_close` among the recognised categories for the
  T099a SC-005 review).
- [`../coordination.md`](../coordination.md) (last updated
  2026-05-11) and the [`./roadmap-ops-status.md`](./roadmap-ops-status.md)
  audit (snapshot 2026-05-09; reconciled 2026-05-11) are in
  alignment on every gate.
- No cross-artifact inconsistency was found. No spec / plan /
  contract edits are required by `/speckit-analyze`.

---

## 2. Proposed deltas for the S5 *implementation* PR (not this PR)

These deltas are queued for the S5 implementation PR (a future PR
that will land T089/T090/T091/T092 and the matching T083–T088
tests). They are documented here so the implementation task author
has a single reference; they are **not applied by this docs-only
planning PR**.

### 2.1 Proposed [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md) Section 3 row additions

Per draft §5.1, the matrix should gain two genuinely-new Section 3
rows (the third row in the draft restates the already-present
stuck-shift count-badge row added in S4 T079):

| Surface | Route / call | `cashier` | `manager` | `admin` | Notes |
|:--|:--|:--:|:--:|:--:|:--|
| Forced-close audit-event detail | (no dedicated 004 route — referenced via the future audit-log surface) | ⛔ | 👀 | 👀 | The `shift.forced_close` audit row's structural fields are manager/admin-only via the future audit-log surface (FR-029). Cashier MUST NOT see any field of any forced-close audit row — including their own. |
| Cashier-returns informational banner | shell-region (003 banner slot) on the operator-bound landing surface | ✅ (banner shows; financials hidden) | N/A | N/A | Banner content is constrained to the AC-6 allowlist in draft §4; never shows expected total, declared count, variance, shortage, overage, reason category, or annotation. |

### 2.2 Proposed [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md) Section 4 row additions

Per draft §5.2, four enumerations are made explicit (each is
already covered by FR-015 + FR-021 + FR-023 + FR-024 +
Edge Cases — these rows just make the implicit application to
forced-closed shifts visible to a future reader):

- Forced-close reason category for shifts a cashier did not own (and the cashier's own forced-closed shift).
- Forced-close annotation (free text) for shifts a cashier did not own (and the cashier's own).
- (Restatement) expected drawer cash / change-fund / variance / shortage / overage for any shift, including the absent cashier's own force-closed shift, on cashier-reachable surfaces — FR-015 + FR-021 + FR-023.

### 2.3 Proposed [`../data-model.md`](../data-model.md) clarification

Per draft §11.4, the `Shift` entity's `declared_count` field
needs an unambiguous schema choice for the **absent** state.
The implementation PR picks one of (a) `null` at the SQL layer
with `declared_count: number | null` at the TS layer, or (b)
a tagged union `number | { kind: 'absent' }` at the TS layer
with a sentinel encoding at the SQL layer. The forced-close
handler in T089 writes the chosen encoding; future variance /
reconciliation features inherit the rule. Whichever is picked
MUST be documented in [`../data-model.md`](../data-model.md)
so the future shift-management feature has an unambiguous
contract.

### 2.4 Proposed `src/shared/audit/payload-schemas.ts` addition

Per draft §11.6, verify whether
`src/shared/audit/payload-schemas.ts` carries a
per-category payload schema for `shift.forced_close`. If
absent, T089 adds one of shape:

```
{
  shift_id: string;
  shift_owner_id: string;
  forced_close_actor_id: string;
  forced_close_reason: 'takeover_supersession' | 'cashier_no_show' | 'cashier_illness' | 'terminal_failure' | 'other';
  annotation?: string;  // ≤ 500 chars; redaction-allowlist enforced
}
```

The redaction allowlist refuses any field outside this shape
(PR-1). No new bridge call; no new IPC channel.

### 2.5 No new bridge / IPC entries

S5's bridge surface footprint is **zero net new exports**.
`operator.forceCloseShift` is already typed in
[`../contracts/bridge-api.md`](../contracts/bridge-api.md) §7 and
in `src/shared/bridge-api.ts` (locked S4 typing). The S5
implementation PR adds only the main-process handler behind that
seam.

---

## 3. Open implementation-time coordination questions

These questions are not spec-level ambiguities (the spec's
behavioural contract is complete and unambiguous within its
chosen scope). They are choices the implementation task author
must make before T089 starts. Each is recorded here with the
draft's recommendation and the bound within which the choice
must stay.

### 3.1 Stuck-shift discovery mechanism (load-bearing)

**Question.** Surface 4A needs to enumerate stuck shifts on the
manager's authorised branches. The manager may be on terminal B,
while a stuck shift was opened on terminal A by a different
cashier. The manager's local `shifts` table may not contain
terminal A's row.

**§A2 Wave 4 status.** Wave 4 delivered `shift.forced_close`
recognition in Endpoint 5 (`POST /api/pos/v1/audit-events`). It
did NOT deliver a stuck-shift query endpoint. This is a real
gap that the implementation task author must resolve before
T089 / T090 begin.

**Resolution paths** (the task author picks one; **whichever is
picked, the choice MUST be recorded in
[`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
and [`../coordination.md`](../coordination.md) at S5
implementation time**):

- **(a)** Add `GET /api/pos/v1/shifts/stuck?branch_id=` to the
  backend contract as a Wave 4 amendment (a small Wave 4.1).
  Returns the list of `shifts` rows in the branch where
  `lifecycle_state = 'open'` and the opening cashier is
  currently unable to close (taken to mean: the cashier is not
  the current operator on the shift's originating terminal,
  AND the shift has been open longer than the cashier's
  inactivity timeout). Each row carries the FR-024(b)
  attribution fields needed by Surface 4A.
- **(b)** Confirm that existing 002/004 cross-terminal `shifts`
  sync already replicates rows from terminal A to terminal B
  through the existing offline-outbox / sync pipeline. If yes,
  no new endpoint is needed; the local `shifts` table is read
  directly by the forced-close handler. **Verify before
  committing**; "existing pipeline does this for `audit_events`
  but not for `shifts`" is the failure mode to watch for.
- **(c)** Compute the stuck-shift list client-side from
  `audit_events` outbox alone (correlate
  `operator.session.takeover` events with their source-terminal
  and a still-open `shifts` row on that terminal). Workable but
  brittle; relies on `audit_events` carrying enough context to
  reconstruct shift state, which it currently does not.

**Recommendation**: (a) is the cleanest. (b) is the cheapest IF
verified true; (c) is the fallback only.

**Why this is flagged here.** Without resolution, T089 / T090
will hit this gap at implementation time. Resolution does NOT
require any docs change in this PR; it requires the task
author to verify-or-coordinate before opening the S5
implementation PR.

### 3.2 `declared_count` representation: `null` vs literal `'absent'`

Per draft §11.4 — addressed in §2.3 above. The implementation
task author picks (a) `null` or (b) tagged union, documents the
choice in [`../data-model.md`](../data-model.md), and the
forced-close handler in T089 writes the chosen encoding. The
spec's contract is that the value is *distinct from numeric zero
and distinct from a matched-count outcome*; the schema choice
is downstream of that contract.

### 3.3 Cashier-returns banner dismiss-state location

Per draft §11.3 — the spec already says the banner triggers on
the next sign-in to *any* paired terminal in the cashier's
authorised tenant + branch set (banner is keyed to cashier
identity, not to the terminal). The implementation task author
decides whether the *dismiss state* is per-(terminal, cashier)
or per-cashier-globally. The Surface 6 banner spec leans
per-(terminal, cashier). T091 confirms the choice and writes
the test against it.

### 3.4 Sync ordering between `operator.session.takeover` and `shift.forced_close`

Per draft §9 question 3 — Endpoint 5 accepts batches; the two
events are independent (FR-013 + FR-024 + Edge Cases). The
offline outbox MAY submit them in either order; the backend
persists each independently with no implicit linkage beyond
shared `acting_operator_id` / `shift_owner_id`. T086 verifies
this property at the test layer. No backend change required.

### 3.5 Concurrent forced-close race (two managers)

Per draft §11.2 — the second submission encounters
`closed_forced` and returns
`OperatorRefusal { category: 'state_invalid' }`. The handler in
T089 checks the shift's `lifecycle_state` at write time. P5
idempotency on `event_id` is exact-match; `state_invalid` is a
different envelope and is NOT silently swallowed. T085's
negative cases cover this.

---

## 4. T083–T093 reconciliation table

Every Phase 7 task is preserved unchanged in content and
checkbox state. The reconciliation in this PR is **gate-tag
removal only**: `[BLOCKED: §A1]` and `[BLOCKED: §A2 (S5)]`
qualifiers are dropped from each row because both gates are
cleared. No checkbox is ticked. No task is renamed. No new
task is added.

| Task ID | Pre-PR state | Pre-PR gate qualifier | Post-PR state | Post-PR gate qualifier | Proposed PR carrier (illustrative — implementation task author decides) |
|:--|:--|:--|:--|:--|:--|
| T083 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-a (test-first; lands before T090) |
| T084 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-a (test-first; lands before T090) |
| T085 | `- [ ]` unchecked | `[BLOCKED: §A1, §A2 (S5)]` | `- [ ]` unchecked | (removed) | PR-S5-b (handler + test) |
| T086 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-b (handler + test) |
| T087 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-c (banner + test) |
| T088 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-d (SC-003 enumeration; lands last among tests) |
| T089 | `- [ ]` unchecked | `[BLOCKED: §A1, §A2 (S5)]` | `- [ ]` unchecked | (removed) | PR-S5-b (handler + test) |
| T090 | `- [ ]` unchecked | `[BLOCKED: §A1, §A2 (S5)]` | `- [ ]` unchecked | (removed) | PR-S5-c (Surface 4A/4B + matrix delta from §2.1) |
| T091 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-c (banner) |
| T092 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-c (route mount) |
| T093 | `- [ ]` unchecked | `[BLOCKED: §A1]` | `- [ ]` unchecked | (removed) | PR-S5-b or PR-S5-c (logging; small) |

The "Proposed PR carrier" column is illustrative grouping for the
small-PR sequence in §5; it is not normative and the
implementation task author may regroup within Constitution P13's
small-slice rule.

---

## 5. Recommended S5 implementation PR sequence (Constitution P13)

Each PR aims for ≤ ~400 LOC diff (well within P13's small-slice
target). All PRs are subject to per-slice non-functional gates
listed in [`../plan.md`](../plan.md) §"Per-slice non-functional
gates": pre-merge axe-clean, pre-merge cross-process redaction
smoke, pre-merge `npm test` / `npm run codegen:verify` /
`npm run typecheck` / `npm run lint`, no `git add -A`.

| PR # | Scope | Task IDs | Gates / dependencies |
|:--|:--|:--|:--|
| **PR-S5-pre** (optional) | Resolve §3.1 stuck-shift discovery — either add `GET /api/pos/v1/shifts/stuck?branch_id=` to [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md) as a Wave 4 amendment, OR record the (b)-path verification that existing cross-terminal `shifts` sync already covers it. Docs-only. | — | None |
| **PR-S5-a** | Phase 7 tests (renderer-side unit only, no handler) | T083, T084 | None (tests-first per Constitution VI) |
| **PR-S5-b** | Forced-close handler + handler-side tests + logging | T089 + T085 + T086 + T093 | PR-S5-a merged; PR-S5-pre resolved |
| **PR-S5-c** | Renderer surfaces + route mount + banner + matrix delta | T090 + T091 + T092 + T087 + [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md) deltas from §2.1 and §2.2 | PR-S5-b merged |
| **PR-S5-d** | SC-003 cashier route enumeration test | T088 | PR-S5-c merged (last; verifies the matrix is enforced end-to-end) |
| **PR-S5-close** | S5 closeout coordination + tasks.md ✅ ticks | — | PR-S5-a..d merged |

**The implementation task author MAY collapse PR-S5-a into
PR-S5-b if the diff stays small** (and the test-first ordering
inside the PR is preserved — tests committed before handler in
the commit graph). Constitution VI ("Test-first, coverage-gated")
is the binding constraint, not strict per-PR ordering.

**005 stays blocked behind §A0** for the entirety of the S5
implementation sequence. §A0 lifts when PR-S5-close merges (or
equivalent — when 004's coordination file marks S5 ✅).

---

## 6. Risk register

This register covers the eight risk categories the prompt
enumerated. Each row maps the risk to its normative source, the
specific test or review-gate that catches it, and the
implementation-PR carrier from §5.

### 6.1 Scope risks

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-S-1 | Drift into sales / cart / payments / receipts / tender / change / money-math. | [`../plan.md`](../plan.md) §"Hard Non-Implementation Boundaries"; draft §3 non-goals. | Per-PR review against §5 carrier list; the `ForcedCloseSurface` test T083 explicitly asserts NO drawer-count entry, NO expected-total, NO variance / shortage / overage. |
| R-S-2 | Drift into inventory / stock movement / FEFO / batch / lot. | Same. | Per-PR review; no inventory-related strings appear in `src/main/operator/forced-close-handler.ts` or `src/renderer/ui/operator/ForcedCloseSurface.tsx`. |
| R-S-3 | Drift into reports / KPIs / dashboards / analytics / manager-review *implementation*. | Same. | Per-PR review; manager-review surface remains placeholder per matrix §Section 2. |
| R-S-4 | Drift into drawer math / expected-total / variance / shortage / overage arithmetic. | FR-021, FR-024(a). | T083 asserts none of these fields render on Surface 4A or 4B; T085 asserts `declared_count = null` (absent), not a computed value. |
| R-S-5 | Backend endpoint added in S5 without §A2 coordination. | [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md). | S5 adds **zero** new backend endpoints. If §3.1 resolves via path (a), the new stuck-shift endpoint is a Wave 4.1 amendment with its own contract update — landed via PR-S5-pre, not folded into the renderer or handler PR. |
| R-S-6 | Drift into 005 / 006. | [`../../005-sales-cart/coordination.md`](../../005-sales-cart/coordination.md) §A0; project scope. | 005 remains blocked behind §A0; this planning PR does not change 005 state. |

### 6.2 Security risks

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-Sec-1 | Forced-close handler bypassed by a cashier-session call. | FR-016, FR-019, AD-1. | `requireRole(['manager', 'admin'])` at the handler's first instruction (T089). T085 negative case asserts `OperatorRefusal { category: 'role_mismatch' }` for cashier callers. |
| R-Sec-2 | Forced close of a stuck shift in a different branch (cross-branch leak). | P17, draft AC-8. | Handler verifies `session.branch_id === shift.branch_id`; mismatch refuses with `role_mismatch` (deliberately conflated with role mismatch to avoid leaking cross-branch existence). T085 negative case covers. |
| R-Sec-3 | Forced close of a shift that is not in `lifecycle_state = 'open'`. | FR-028 (append-only), draft §11.2. | Handler checks state at write time; second concurrent submission returns `state_invalid`. T085 idempotency case covers. |
| R-Sec-4 | PIN values, Clerk JWTs, session tokens accepted in the `payload.annotation` field. | PR-1; FR-030; FR-031; FR-027. | The `payload-schemas.ts` per-category schema (§2.4) refuses any field outside the documented schema; the redaction allowlist runs on every emission. Cross-process redaction smoke test asserts zero occurrences of forbidden tokens across logs / Sentry / support bundles. |

### 6.3 Renderer-exposure risks

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-R-1 | Operator personal data (email, phone, password hash, PIN material) crossing the bridge into Surface 4A's row data. | FR-031, P8. | `bridge-api.md` §Endpoint 7's response schema includes only opaque identifiers + display names; no email / phone / hash fields. T085 inspects the bridge response shape. |
| R-R-2 | Renderer code importing from `src/main/*`. | Constitution III. | Build-time enforcement via TS module-boundary lint; renderer test files import only from `src/renderer/*` and `src/shared/*`. |
| R-R-3 | Surface 4A / 4B rendering forbidden financial fields. | FR-024(a), draft AC-1, AC-2. | T083 + T084 unit tests. |
| R-R-4 | Cashier-returns banner leaking financial fields. | FR-021, FR-023, draft AC-6. | T087 integration test asserts banner content allowlist. |

### 6.4 Audit-attribution risks

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-A-1 | A forced close emitted without the FR-025 mandatory five attributes. | FR-025 (records missing any attribute MUST be rejected). | Handler emits via `src/main/audit/audit-emitter.ts` (S3); the emitter's emission contract refuses partial records. T085 asserts all five attributes present. |
| R-A-2 | `acting_operator_id` set to the absent cashier instead of the executing manager / admin. | FR-024(b), draft §7.1. | T085 asserts `acting_operator_id = forced_close_actor_id = manager`, `shift_owner_id = absent_cashier`. |
| R-A-3 | `shift.forced_close` and `operator.session.takeover` merged into a single audit record. | Edge Cases (takeover-stranded-shift), FR-024. | T086 integration test asserts two independent rows with independent timestamps and independent `originating_terminal_id`. |
| R-A-4 | `forced_close_reason` taken from `payload.annotation` instead of the structural field. | FR-024(c). | T084 unit test asserts the form submit refuses to populate `forced_close_reason` from the annotation textarea. |
| R-A-5 | `originating_terminal_id` set to the stuck shift's terminal instead of the manager's. | Draft §7.1 row 3, Edge Cases (manager forced close from different terminal). | T085 asserts `originating_terminal_id = manager_terminal_id`. |

### 6.5 Route-guard-vs-main-process role enforcement risks

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-RG-1 | A cashier reaches `/app/manager/stuck-shifts` via a forced URL / deep link / route restore. | NFR-009, FR-019, AD-1. | `<OperatorRouteGuard role="manager">` wraps the route (T092); cashier role redirects to the generic "not available" surface. T088 SC-003 walkthrough exercises ≥ 20 access paths. |
| R-RG-2 | Cashier UI render of forbidden content before route guard resolves (brief paint). | NFR-009, Edge Cases (forced navigation). | Route resolution happens before render (`<OperatorRouteGuard>` returns the not-available surface synchronously when role mismatch is detected); no privileged content is briefly rendered, painted, or fetched. T088 includes a "no paint" assertion via React testing library queries on the rendered tree. |
| R-RG-3 | Route guard is the only barrier (renderer-only trust). | FR-019, AD-1 (route guards are *secondary* UX defence). | Every forced-close-related bridge call self-gates via `requireRole`. T085 negative cases assert refusal from the bridge layer even when the renderer route guard would have permitted (test calls the bridge directly bypassing the guard). |

### 6.6 Redaction risks

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-Red-1 | Forced-close-related `pino` log site emits PIN material / Clerk JWT / session token / full PII. | PR-1, FR-030, FR-032. | T093's log sites pass through the redaction allowlist established in S3 (extended in S4 for PIN events). Cross-process redaction smoke test extends 002's. |
| R-Red-2 | `payload.annotation` contains a forbidden token and bypasses the redaction allowlist. | PR-1, FR-027. | The per-category payload schema (§2.4) refuses unknown fields; the redaction-allowlist check runs on every emission. The smoke test seeds an annotation with PIN-shaped strings, JWT-shaped strings, email-shaped strings and asserts they never appear in log / Sentry / support-bundle output. |
| R-Red-3 | `originating_terminal_id` is logged as a human-readable label instead of an opaque id. | FR-032. | T093 log site review; operator identifiers go through the existing opaque-id mapper from S3 / S4. |

### 6.7 Missing-data risks for stuck shifts

| # | Risk | Source | Catcher |
|:-:|:--|:--|:--|
| R-MD-1 | Cross-terminal `shifts` sync does not replicate terminal A's stuck shift to the manager's terminal B. | §3.1 above; draft §11.1. | PR-S5-pre resolves before T089 starts. If path (b) is taken, a verification test is added confirming the local `shifts` table on terminal B contains terminal A's row after sync. If path (a) is taken, the new endpoint's contract test is added. |
| R-MD-2 | The stuck-shift list shows a stale `lifecycle_state` (already closed by another manager). | Draft §11.2. | The list view re-reads on render; the row is removed if `lifecycle_state ≠ 'open'`. T085 idempotency case covers the second-manager scenario. |
| R-MD-3 | A shift with no `started_at` (corrupted row) appears in the list with missing duration. | Defensive coding. | Surface 4A render path renders "duration unavailable" for nulls; the row is still actionable. Not a blocking concern at S5 scope. |
| R-MD-4 | The absent cashier's display name is unavailable on Surface 4A because the local operator-roster cache is stale. | FR-006 (roster) interaction. | Surface 4A falls back to an opaque "cashier id …NNNN" reference and a refresh affordance. Documented in the renderer-side test for T090. |

### 6.8 Future validation commands

These are the commands the eventual S5 implementation PRs (the
PRs in §5) run before merge. They are listed here as the
durable definition for the task author.

| Command | When | Why |
|:--|:--|:--|
| `npm run typecheck` | Every PR | Constitution V — both tsconfigs must pass. |
| `npm run lint` | Every PR | eslint + prettier --check. |
| `npx prettier --check '<changed files>'` | Every PR — *especially* docs-only PRs | Memory `feedback_prettier_ci.md` — prettier-CI is the most common docs-PR failure mode in this repo. |
| `npm test -- --coverage` | Every PR | Constitution VI — coverage targets `≥ 95 %` on bridge-API role-enforcement and PIN-verifier; `≥ 90 %` on `src/renderer/ui/operator/` and the audit module. |
| `npm run codegen:verify` | After PR-S5-pre resolves §3.1 path (a), or when any Wave-4-adjacent OpenAPI snapshot changes | Constitution V codegen determinism. |
| Cross-process redaction smoke | PR-S5-b, PR-S5-c, PR-S5-d | PR-1; smoke extends 002's redaction test; asserts zero PIN / JWT / token occurrences across log / Sentry / support-bundle. |
| `npm run package:dir` | PR-S5-close | Electron-builder dry-run; confirms feature flag preserves package determinism. |

This planning PR (the PR carrying this readout) runs only
`npm run typecheck` and `git diff --check` per the planning
brief. No codegen. No full test suite.

---

## 7. Explicit non-actions in this PR

This planning PR is **docs-only**. The following are NOT touched
or introduced by this PR:

- ❌ No source code (`src/**`).
- ❌ No tests (`tests/**`).
- ❌ No migrations (`migrations/**`).
- ❌ No `package.json`, `package-lock.json`, or any package edits.
- ❌ No codegen artifacts (`src/shared/api-types.ts`, OpenAPI
      snapshots).
- ❌ No CI workflow changes (`.github/workflows/**`).
- ❌ No backend / Data-Pulse-2 changes.
- ❌ No edits to [`../spec.md`](../spec.md),
      [`../plan.md`](../plan.md),
      [`../research.md`](../research.md),
      [`../data-model.md`](../data-model.md),
      [`../quickstart.md`](../quickstart.md), or any
      [`../contracts/*`](../contracts/) file.
- ❌ No edits to AGENTS.md, CLAUDE.md, or
      [`../a1-amendment/`](../a1-amendment/).
- ❌ No S5 implementation started. No 005 / 006 work started.
      005 remains blocked behind §A0.

The full surface of this PR is:

- `specs/004-operator-session/planning/s5-speckit-readout.md`
  (this file — NEW)
- `specs/004-operator-session/tasks.md` (gate-tag reconciliation
  only — see §1.4)
- `specs/004-operator-session/coordination.md` ("Current phase /
  status" addendum noting this planning PR; Last-updated bump
  only)

---

**End of readout.** Issue 88 remains OPEN. No S5 implementation
started by this PR. The next step is the S5 implementation task
author opening PR-S5-pre (if §3.1 needs resolution) or PR-S5-a
(if §3.1 is verified via path (b)).
