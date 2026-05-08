# Planning — S5 Blind Shift Close & Visibility Boundaries (Spec Draft)

> **Draft only. Not a replacement for the `spec.md` / `plan.md` sections that
> already cover S5; this is a working artifact to surface gaps and prepare for
> issue #88 implementation once S4 lands.** No production code, no test code,
> no migrations. Sole deliverable. Canonical artifacts (spec, plan, tasks,
> contracts) remain authoritative; this draft must not be cited as
> normative.

- **Issue:** [#88 — 004 S5 — blind shift close and visibility boundaries](https://github.com/ahmed-shaaban-94/POS-Pulse/issues/88) (status: blocked)
- **Slice tag:** S5 in [`../plan.md`](../plan.md) §"Phase 3 — Implementation Slice Strategy"
- **Tasks covered:** [T083–T093](../tasks.md) (Phase 7) + the cashier-route enumeration (T088, SC-003)
- **Reads relied on:**
  [`../spec.md`](../spec.md) (US3 + FR-021…FR-029 + Edge Cases),
  [`../plan.md`](../plan.md) (Slice S5 + Hard Non-Implementation Boundaries),
  [`../tasks.md`](../tasks.md) (Phase 7),
  [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md),
  [`../contracts/bridge-api.md`](../contracts/bridge-api.md) (`operator.forceCloseShift`),
  [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md) (Endpoint 5 + Wave 4),
  [`../coordination.md`](../coordination.md) (gate state),
  [`../visual-direction/README.md`](../visual-direction/README.md) (Surface 4A/4B + Surface 6 banner),
  `src/main/audit/` (emitter, store, sync — all landed in S3),
  `src/shared/audit/event-shape.ts` (`ActionCategory` discriminated union).

---

## 1. Problem statement

S4 cleared the cashier sign-in path: a cashier can now sign in via roster +
PIN, hold an operator-bound session, and run their own shift on the terminal
that paired them. S4 also plumbed the takeover flow: a takeover from terminal
B force-signs-out the cashier on terminal A and emits an
`operator.session.takeover` audit event. **What S4 deliberately did not do**
is finish the rule that takeover triggers in [`../spec.md`](../spec.md)
Edge Cases — *takeover-stranded shift*: terminal A's shift remains
**open and operator-bound to the absent cashier**; the only path to close it
is a manager- or admin-attributable `shift.forced_close` (FR-024).

S5 delivers exactly that recovery path and locks down the visibility boundary
around it:

1. The manager/admin can see, on a manager-only route, the list of stuck
   shifts on their authorised branches and execute a forced close that
   carries both identities (`shift_owner` = absent cashier;
   `forced_close_actor` = executing manager/admin) and a structured reason
   from the FR-024(c) closed enum.
2. The cashier whose shift was force-closed sees, on next sign-in, an
   informational banner that says *that* their shift was closed but never
   leaks any of the cashier-forbidden financial fields
   (FR-021 / FR-023 / Edge Cases).
3. The cashier still cannot reach any reports / KPIs / shift summary /
   stuck-shift list / audit-log / forced-close form / variance / shortage /
   overage surface from any cashier-reachable surface — verified by an
   automated SC-003 walkthrough across at least 20 access paths
   (T088).

**Canonical motivating scenario (the takeover-stranded shift):**

- Cashier *Layla* opens a shift on terminal A (POS-03) at 09:14.
- Layla is called away; she signs in on terminal B (POS-04) and confirms
  the takeover prompt. Terminal A's session ends with
  `superseded_by_takeover` per FR-013; an `operator.session.takeover`
  audit event is emitted (S4).
- Layla's shift on terminal A is now **stuck**: open, operator-bound to
  Layla, but Layla cannot return to terminal A to close it. The shift
  shows up on the manager's stuck-shift list (Surface 4A).
- Manager *Hany* signs in on his own terminal (any paired manager
  terminal in the same branch — typically not POS-03), opens
  `/app/manager/stuck-shifts`, sees Layla's stuck shift, picks
  *"Takeover from another terminal"* as the reason, optionally adds a
  free-text annotation, and submits the forced close. A
  `shift.forced_close` audit event is emitted with both identities and
  `reason = takeover_supersession`. Layla's `declared_count` is recorded
  as the explicit `absent` state — **not** zero, **not** matched
  ([`../spec.md`](../spec.md) §Key Entities, §Clarifications 2026-05-05).
- Layla signs back in tomorrow; the shell shows the dismissable
  cashier-returns banner ("A previous shift of yours was closed by a
  manager on \[date\]") with no financial details.

S5 ships the smallest set of surfaces that makes this scenario auditable,
visible to the right roles, and invisible to the cashier role.

---

## 2. User stories

S5 is the implementation home of US3 ([`../spec.md`](../spec.md) §"User
Story 3 — Blind shift close & audit attribution scaffold (Priority: P3)").
The narrower user-stories below decompose US3 into reviewable scenarios
that each map to specific tasks in Phase 7.

### US3-S5.1 — Manager force-closes a takeover-stranded shift

**Given** cashier X opened a shift on terminal A and was force-signed-out
by an FR-013 takeover from terminal B (or otherwise became unable to
return — no-show, illness, dismissal, terminal failure on a different
machine), **when** a manager (or admin) signs in on any paired terminal
in the same branch and navigates to `/app/manager/stuck-shifts`,
**then** they see X's stuck shift in the list with: X's display name,
the opened-at timestamp, the terminal label of the original shift, and
how long the shift has been open. The manager picks the row, picks a
reason from the FR-024(c) enum, optionally adds an annotation, and
submits. The shift transitions to `closed_forced`; X's `declared_count`
is recorded as `absent`; a `shift.forced_close` audit event is emitted
with `acting_operator_id = manager`, `shift_owner_id = X`,
`forced_close_actor_id = manager`, and the structured reason; the row
disappears from Surface 4A.

### US3-S5.2 — Cashier returns after forced close, sees informational banner without financials

**Given** cashier X's shift was force-closed by a manager (any reason),
**when** X signs in on any paired terminal (same or different) on or
after the forced-close date, **then** the operator-bound landing
surface displays a dismissable info banner ("A previous shift of yours
was closed by a manager on \[date\]") with no expected total, no
declared count, no variance, no shortage, no overage, no closing
manager's reason category, and no closing manager's annotation. A small
"View details" affordance opens an *ask-your-manager* contact form, not
a financial-detail surface
([`../visual-direction/README.md`](../visual-direction/README.md)
§"Cashier-returns-after-forced-close informational notice"). The
banner is dismissable; once dismissed, it does not re-appear on
subsequent sign-ins.

### US3-S5.3 — Cashier route enumeration reaches zero ⛔ rows (SC-003)

**Given** a cashier signed in on a terminal that has an existing stuck
shift owned by a different cashier and recent
`shift.forced_close` audit events, **when** the cashier enumerates
every navigable route, deep-link, refresh, search query, quick-action,
and tab-restore path (≥ 20 access paths per SC-003), **then** they
reach zero ⛔ rows from
[`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md)
§Section 3 (stuck-shift list, forced-close form, cashier-management,
audit log, dashboard / KPI placeholder, settings placeholder). The
matrix-row enforcement is automated (T088).

---

## 3. Non-goals (out of scope for S5)

These restate the [`../plan.md`](../plan.md) §"Hard Non-Implementation
Boundaries" list and the [`../spec.md`](../spec.md) §"Out of Scope"
list verbatim where they touch S5. Anything below MUST NOT be folded
into S5; if any of them becomes operationally necessary, it is a
separate feature, not a S5 scope drift.

- **Sales / cart / line-item / receipt / payments / tender / change /
  money-math business logic.** All deferred (the reserved slots from
  003 stay layout-only; the catalogue from 005-checkout-payments owns
  these). The S5 forced-close form MUST NOT contain any drawer-count
  field, expected-total display, variance / shortage / overage display
  ([`../spec.md`](../spec.md) FR-021 + FR-024(a)). The forced-close
  form's read-only summary fields (cashier name, opened-at, terminal,
  duration) are the entire information surface.
- **Drawer math, expected-total computation, variance / shortage /
  overage arithmetic.** Deferred to a future shift-management feature.
  S5 records `declared_count = null / absent` and the shift's
  `lifecycle_state = closed_forced`; the future shift feature decides
  what variance computation does when faced with `declared_count = absent`
  ([`../spec.md`](../spec.md) §Key Entities — Shift).
- **Manager-review surface implementation, reports, KPIs, dashboards,
  analytics surfaces.** All deferred. The manager-review surface
  imagined in FR-022 is *not* S5; S5 only writes the audit record that
  a future review surface would render. Reports and KPIs remain `⛔`
  for cashier and `✅` (placeholder) for manager / admin per
  [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md)
  §Section 2.
- **Inventory mutation, stock movement, FEFO logic, batch / lot
  tracking.** None in S5; orthogonal feature.
- **Cashier-self-service PIN reset.** Out of scope for 004 (covered S4
  via the manager-attributable `cashier.pin.reset` /
  `cashier.pin.unlock` flows under PR-5). S5 does not change the
  PIN reset / unlock surfaces; it only consumes the cashier-returns
  banner in the post-PR-5 flow if a reset was also necessary.
- **Custom permission engines, ABAC systems, capability registries,
  per-action permission catalogues.** Forbidden by FR-002a. S5's
  role gate is the closed three-entry catalogue + AD-1 (bridge-surface
  enforcement); no new permission infrastructure.
- **Auto-generated reports of any kind.** Deferred.
- **Anything that would change `_reference/Data-Pulse/`.** Constitution
  Principle IX (Reference, Not Inheritance) — S5 derives every rule
  from the constitution + 001/002/003 plans + the 004 spec, never from
  the legacy reference.
- **A second identity provider, an offline auth surface, biometric /
  smart-card sign-in, terminal-hardware ID changes.** All deferred.
- **Backend endpoints introduced by S5.** Zero. S5 reuses Endpoint 5
  (`POST /api/pos/v1/audit-events`) and depends on Wave 4 to recognise
  `shift.forced_close` (already documented in
  [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)).
  No new bridge surface beyond `operator.forceCloseShift`, which was
  already specced in the [`../contracts/bridge-api.md`](../contracts/bridge-api.md)
  in S4.
- **Sorting / filtering / bulk forced-close on Surface 4A, audit-log
  rendering on Surface 4A or 4B, edit / undo of a forced close.** All
  explicitly excluded from Slice 0 visual direction
  ([`../visual-direction/README.md`](../visual-direction/README.md)
  §"Out of scope (notable)" for Surface 4) and from FR-028 (audit
  events are append-only).

---

## 4. Acceptance criteria

Each S5 acceptance criterion below maps to (a) a normative spec/plan/contract
citation, (b) the surface or code path that satisfies it, (c) the test in
Phase 7 of [`../tasks.md`](../tasks.md) that proves it.

| # | Criterion | Source | Implementing surface / path | Proving test |
|:--|:--|:--|:--|:--|
| AC-1 | The forced-close form (Surface 4B) renders only the read-only summary fields (cashier name, opened-at, terminal, duration), the reason RadioGroup, the optional annotation textarea, and the Force-close + Cancel buttons. **MUST NOT** render: drawer-count entry, expected total, variance, shortage, overage, the absent cashier's PIN. | FR-021, FR-024(a), Surface 4B content rules (`visual-direction/README.md`) | `src/renderer/ui/operator/ForcedCloseSurface.tsx` (T090) | T083 |
| AC-2 | The reason picker accepts only the five FR-024(c) values (`takeover_supersession`, `cashier_no_show`, `cashier_illness`, `terminal_failure`, `other`); submit is disabled until a radio is selected; free-text annotation lives in `payload.annotation` only and **never** in `payload.forced_close_reason`. | FR-024(c), Surface 4B content rules | `ForcedCloseSurface.tsx` + emitter payload schema in `src/shared/audit/payload-schemas.ts` | T084 |
| AC-3 | A successful forced-close emits a `shift.forced_close` audit event with all five FR-025 attributes plus the four S5-specific fields (`shift_owner_id`, `forced_close_actor_id`, `forced_close_reason`, optional `payload.annotation`). The emitted event carries `acting_operator_id = forced_close_actor_id = manager / admin`, `shift_owner_id = absent cashier`, and the chosen `forced_close_reason`. | FR-024(b)–(c), FR-025, FR-026 | `src/main/operator/forced-close-handler.ts` (T089) → existing emitter in `src/main/audit/audit-emitter.ts` | T085 |
| AC-4 | The shift's `lifecycle_state` becomes `closed_forced` and `declared_count` is recorded as `null` (the explicit `absent` state per `../spec.md` §Key Entities — Shift), distinct from a numeric zero and from a matched count. | FR-024(a), `data-model.md` Shift entity | `forced-close-handler.ts` (T089) | T085 |
| AC-5 | The takeover audit event (`operator.session.takeover`) and the forced-close audit event (`shift.forced_close`) are independent rows in `audit_events`, with independent timestamps and independent `originating_terminal_id` values (takeover originates on B; forced close originates on the *manager's* terminal, not necessarily A). They are linked only by the absent cashier's `acting_operator_id` / `shift_owner_id`; they are **never** merged into a single row. | FR-013, FR-024 + Edge Cases (takeover-stranded shift), FR-026 | Append-only `audit_events` table (S3) + `forced-close-handler.ts` (T089) | T086 |
| AC-6 | After a forced close, the absent cashier's next sign-in (any paired terminal in the same tenant + branch) shows the cashier-returns banner. The banner shows: that *a* shift was closed and the closing date. The banner **MUST NOT** show: expected total, declared count (which is `null`), variance, shortage, overage, the closing manager's reason category, or the closing manager's annotation. The banner is dismissable; once dismissed, does not re-appear. | FR-021, FR-023, FR-024 + Edge Cases (cashier-returns-after-forced-close), Surface 6 banner spec | `src/renderer/ui/operator/ShiftClosedBanner.tsx` (T091) | T087 |
| AC-7 | A cashier signed in on the same terminal as a stuck shift owned by a different cashier sees no mention of the stuck shift on any cashier-reachable surface — the stuck-shift list, the forced-close form, "this terminal has a stuck shift" text, audit log surfaces, dashboard, settings (cashier variant), KPIs are all `⛔` and resolve to the generic "this section is not available for your role" surface. | FR-015, FR-016, FR-019, FR-024(d), `role-visibility-matrix.md` Section 3 | `<OperatorRouteGuard>` (S4 T082) + bridge-side `requireRole` (S1 T015) | T088 (SC-003 walkthrough, ≥ 20 access paths) |
| AC-8 | The forced-close handler refuses with `OperatorRefusal { category: 'role_mismatch' }` for any cashier-session caller AND for any manager/admin whose session `branch_id` does not match the stuck shift's `branch_id` (P17 — the two refusal causes are deliberately conflated to avoid leaking cross-branch shift existence). | FR-016, P17, `bridge-api.md` §"Endpoint 7 Failure modes" | `forced-close-handler.ts` (T089) | T085 (negative cases) + T088 (cashier negative case) |
| AC-9 | Re-submitting the same `event_id` to `operator.forceCloseShift` is a no-op success — the same `audit_event_id` is returned, the `audit_events` row is not duplicated, and the shift state is unchanged on the second call (P5 idempotency). | P5, AD-3, `bridge-api.md` §Idempotency | `forced-close-handler.ts` + `audit-emitter.ts` | T085 (idempotency case) |
| AC-10 | All forced-close-related `pino` log sites honour PR-1 redaction: no PIN material, no Clerk JWTs, no session tokens, no full PII; operator references appear as opaque ids only (FR-032). The bridge handler's diagnostic detail goes to the main-side log only; the renderer-visible refusal carries only `category`. | FR-027, FR-030, FR-032, PR-1 | `pino` site additions (T093) | Cross-process redaction smoke test (extends 002's; S3 already updated for `shift.forced_close` payload allowlist) |

---

## 5. Cashier vs manager / admin visibility matrix — proposed delta

> **Note: this is a proposed delta, NOT an edit to the canonical
> [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md).**
> The S5 implementation PR is the place where the canonical matrix is
> updated (per matrix §Section 8 — "When this matrix changes"); this
> draft only proposes the rows and the catalogue additions for review.
> The canonical matrix already contains the stuck-shift list, the
> forced-close form, the cashier management surface, and the cashier
> PIN reset / unlock action rows; the deltas below are S5's
> *additions on top of those rows*, not duplicates.

### 5.1 Section 3 — proposed S5 row additions

| Surface | Route / call | `cashier` | `manager` | `admin` | Notes (proposed wording) |
|:--|:--|:--:|:--:|:--:|:--|
| Forced-close audit-event detail | (no dedicated 004 route — referenced indirectly via the future audit log surface) | ⛔ | 👀 | 👀 | The `shift.forced_close` audit row's structural fields (`shift_owner_id`, `forced_close_actor_id`, `forced_close_reason`, `payload.annotation`) are visible only to manager / admin via the future audit-log surface (FR-029). Cashier has no reachable surface that exposes any field of any forced-close audit event for any shift — including their own. |
| Cashier-returns informational banner (post-forced-close) | shell-region (003 banner slot) on the operator-bound landing surface | ✅ (banner shows; financials hidden) | N/A | N/A | Banner is cashier-only because only the absent cashier signing back in is the relevant actor. Manager / admin see no banner because they were not the absent owner. The banner content is constrained to the AC-6 allowlist. |
| Stuck-shift count badge in nav rail (Note 2 reviewer finding) | nav-rail item next to `/app/manager/stuck-shifts` | ⛔ | 👀 | 👀 | S4 (T076) carries the row addition for the badge itself; S5 confirms: the badge **MUST NOT** be visible at icon-only viewport width (1024–1279 px) and MUST NOT be visible to cashier regardless of viewport. Re-asserted here for review completeness. |

The first two rows are net-new (the canonical matrix does not currently
have rows for the audit-event detail or for the cashier-returns banner;
the third is a re-confirmation of the Note 2 row added in S4). The S5
implementation PR adds them to
[`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md)
§Section 3 verbatim.

### 5.2 Section 4 — proposed Cashier-Forbidden Information catalogue additions

The canonical Section 4 already lists shift totals, expected drawer cash,
expected change-fund, declared cash count, shortage, overage, variance,
reports, KPIs, manager-review data, audit log surfaces, admin /
configuration surfaces, other operators' shift data, the stuck-shift
list, and (added by 004 S5) the forced-close audit-event details. To
make the S5-specific cashier-forbidden items *fully explicit* (rather
than implicit under "other operators' shift data"), the matrix should
gain the following enumeration in §Section 4:

| Forbidden information item (proposed addition) | Spec citation |
|:--|:--|
| Expected drawer cash for any shift (own or other) — already FR-015, but explicitly confirmed here as covering forced-closed shifts of the same cashier signing in after the close | FR-015 + FR-021 + FR-023 |
| Expected change-fund for any shift (own or other) | FR-015 + FR-021 |
| System-computed variance for any shift (own or other) | FR-015 + FR-021 + FR-023 |
| Shortage for any shift (own or other) | FR-015 + FR-021 |
| Overage for any shift (own or other) | FR-015 + FR-021 |
| **Forced-close reason category for shifts a cashier did not own** — the absent cashier MAY be told *that* their shift was force-closed (cashier-returns banner allows this and the closing date) but **MUST NOT** see the structured reason category (`takeover_supersession` / `cashier_no_show` / `cashier_illness` / `terminal_failure` / `other`) or the free-text annotation, regardless of whether they are the absent owner or a different cashier on the same terminal. | FR-024(a)–(d) + Edge Cases (cashier-returns-after-forced-close + manager-forced-close-while-different-cashier-signed-in) |
| **Forced-close annotation (free text)** for shifts a cashier did not own — same rule; manager-only. | FR-024(c) + Edge Cases |

The additions are not new rules; they are *explicit enumerations of
already-implicit cashier-forbidden items*. The implementation PR turns
each row into a Vitest test asserting the bridge refuses the renderer
surface that would have rendered it.

---

## 6. Hidden fields before close / review (cashier perspective)

Exhaustive list of fields the cashier role MUST NOT see on any
cashier-reachable surface at any stage of any shift's lifecycle (own or
other), independent of how the cashier reaches the surface (navigation,
deep-link, refresh, search, quick-actions, tab restore). The list is
the **closed set** S5 commits to test against in T088 and the SC-003
walkthrough.

1. **Shift totals** (`gross_total`, `net_total`, `cash_total`, `card_total`, etc.) — FR-015.
2. **Expected drawer cash** for any shift (own or other) — FR-015 + FR-021.
3. **Expected change-fund** for any shift — FR-015 + FR-021.
4. **Declared cash count** — others' (FR-015) AND the cashier's *own once submitted* (FR-023). The cashier may type a count on their own close-UI surface in a future feature; once submitted, the value MUST NOT be re-displayed on any cashier-reachable surface.
5. **Shortage** — FR-015 + FR-021.
6. **Overage** — FR-015 + FR-021.
7. **Variance** (system-computed) — FR-015 + FR-021 + FR-023.
8. **Reports of any kind** — FR-015 (Reports as a category, not a route — covers both implementations and placeholders).
9. **KPIs of any kind** — FR-015 (same).
10. **Manager-review data** — FR-015 + FR-022 + FR-029.
11. **Audit log surfaces** (the surface itself; specific cashier-attributable audit events MAY be referenced indirectly — e.g., the cashier-returns banner cites *that* a forced close happened and on what date) — FR-015 + FR-029.
12. **Admin / configuration surfaces** — FR-015 + FR-018.
13. **Other operators' shift data** (any other cashier's shift, count, variance, lifecycle state, sign-in time, identity beyond the roster pick) — FR-015 + FR-024.
14. **Stuck-shift list** (the existence of stuck shifts on this or any terminal in the branch) — FR-024(d) + Edge Cases (manager-forced-close-while-different-cashier-signed-in).
15. **Forced-close reason category** for any shift the cashier did not own (and even for shifts they did own — the cashier-returns banner does not show reason) — FR-024(c) + Edge Cases.
16. **Forced-close annotation** for any shift — FR-024(c) + Edge Cases.
17. **The `shift_owner_id`, `forced_close_actor_id`, and `forced_close_reason` fields of any `shift.forced_close` audit row** — FR-024(b)–(c) + FR-029.
18. **PIN values** of any cashier (own or other) — FR-031, PR-1.
19. **Clerk JWTs / session tokens / device tokens** of any party — FR-030, FR-031, PR-1.

The S5 cashier-route enumeration test (T088) MUST verify that none of
items 1–17 render on any cashier-reachable surface across at least 20
access paths.

---

## 7. Operator attribution requirements

The `shift.forced_close` audit record carries the FR-025 mandatory
five-attribute base plus four S5-specific structural attribution fields.
Every field below MUST be present and structurally correct on every
emitted record; missing-attribute records MUST be rejected at the
emitter boundary (FR-025 last sentence — "Records that omit any of
these five attributes MUST be rejected at the action boundary; partial-
attribution audit records MUST NOT be persisted").

### 7.1 FR-025 base (five mandatory attributes)

| # | Attribute | Source | Notes |
|:--|:--|:--|:--|
| 1 | `acting_operator_id` | the manager / admin executing the forced close (Clerk user id) | Equal to `forced_close_actor_id` for S5 — the rule "carries the executing manager / admin" of FR-024(b) is satisfied by either field. The two are kept distinct to allow future supervisor scenarios where the manager *requesting* and the supervisor *approving* are different. |
| 2 | `shift_id` | the stuck shift's `id` | Required (the action is shift-scoped). |
| 3 | `originating_terminal_id` | the *manager's* terminal id | NOT the terminal the stuck shift was opened on. Edge Case ("manager forced close while a different cashier is signed in on the same terminal") makes this explicit. |
| 4 | `created_at` | main-process clock at the moment the handler emits | ISO 8601 UTC. |
| 5 | `action_category` | the literal string `'shift.forced_close'` | A discriminated-union member of `ActionCategory` in `src/shared/audit/event-shape.ts`. Backend recognises (Wave 4 dependency). |

### 7.2 S5-specific structural attribution fields

| Field | Type | Rule |
|:--|:--|:--|
| `shift_owner_id` | string (Clerk user id) | The opening cashier (the absent operator). FR-024(b). |
| `forced_close_actor_id` | string (Clerk user id) | The executing manager or admin. Equal to `acting_operator_id` for S5; kept distinct to allow future supervisor scenarios where the manager *requesting* and the supervisor *approving* are different (the FR-025 (f) approving-supervisor-identity field would also be set in that future case). |
| `forced_close_reason` | enum | One of `'takeover_supersession'`, `'cashier_no_show'`, `'cashier_illness'`, `'terminal_failure'`, `'other'`. FR-024(c). MUST NOT be derived from the free-text annotation. |
| `payload.annotation` | string (optional, ≤ 500 chars per Surface 4B) | Free-text manager note, for support only. FR-024(c) — MUST NOT be used as the structural reason field. PR-1 — MUST NOT contain PIN values, credential fragments, or full PII; the redaction-allowlist check on `payload` enforces this in the bridge handler. |

### 7.3 Cashier `declared_count` recorded as `absent`

Spec [`../spec.md`](../spec.md) §Key Entities — Shift commits to a
shift lifecycle with at least `open`, `closed_normal`, and
`closed_forced`. For `closed_forced`, the absent cashier's
`declared_count` is the explicit state **`absent`** — distinct from
zero and distinct from "matched the expected total". The S5 handler
writes `declared_count = null` to the shift row (representing
`absent`) and records this as the structural blind-close discipline
required by FR-024(a). The future shift-management feature MUST treat
`declared_count = absent` as a distinct case in any variance /
reconciliation logic — it MUST NOT coerce `null` to `0` or to a matched
outcome.

### 7.4 Forced close vs takeover — separation invariant

Edge Cases (takeover-stranded-shift) is the canonical statement: the
takeover audit record (`operator.session.takeover`) and the forced-close
audit record (`shift.forced_close`) are **separate** records, with
**separate** timestamps and **separate** `originating_terminal_id`
values. They are linked only by the absent cashier's identity (which
appears in both, the takeover as `acting_operator_id` and the forced
close as `shift_owner_id`). They MUST NOT be merged into a single row,
either at emission, sync, or rendering time. T086 enforces this
invariant.

---

## 8. Data / security boundaries

### 8.1 Bridge surface

[`../contracts/bridge-api.md`](../contracts/bridge-api.md) §Endpoint 7
already defines `operator.forceCloseShift`:

```ts
operator.forceCloseShift(req: ForceCloseShiftRequest): Promise<ForceCloseShiftResponse | OperatorRefusal>
```

S5 implements the main-process handler (T089) behind this typed seam.
The handler:

1. `requireRole(['manager', 'admin'])` at first instruction (AD-1 — bridge-surface enforcement is the trust boundary).
2. Verifies the calling session's `branch_id` matches the stuck shift's `branch_id` (P17 — branch isolation; mismatch is conflated with role mismatch in the renderer-visible refusal to avoid leaking cross-branch existence — see AC-8).
3. Verifies the shift is in `lifecycle_state = 'open'`; any other state returns `state_invalid` (already closed normally, already force-closed by a different manager, etc.).
4. Writes the shift row's `lifecycle_state = 'closed_forced'`, `declared_count = null`, `closed_at = now`, `closed_by_actor_id = manager`, `closed_reason = forced_close_reason`.
5. Emits a `shift.forced_close` audit event via the existing `src/main/audit/audit-emitter.ts` (S3).
6. Returns `{ kind: 'forced_closed', audit_event_id: '<uuid>' }`.

No new bridge call; no new IPC channel. S5's surface footprint at the
bridge is **zero new exports**; the type seam was already locked in
S4.

### 8.2 Audit emission

S3 ships:

- `src/main/audit/audit-emitter.ts` — append-only emission with P5 idempotency.
- `src/main/audit/audit-events-store.ts` — local `audit_events` table reads/writes.
- `src/main/audit/audit-sync.ts` — backend sync via the offline outbox pattern.
- `src/shared/audit/event-shape.ts` — `AuditEvent`, `ActionCategory` (already includes `'shift.forced_close'`), `OperatorRefusal`.
- `src/shared/audit/forbidden-keys.ts` — redaction allowlist.
- `src/shared/audit/payload-schemas.ts` — per-category payload schemas.

S5 reuses all of these. The only S5 addition to the emitter pipeline
is a payload schema entry for `shift.forced_close` payload shape if
one was not already added in S3 (the `ActionCategory` constant
includes `'shift.forced_close'`, but the per-category payload schema
likely needs a small extension to formalise the
`{ shift_owner_id, forced_close_actor_id, forced_close_reason, annotation? }`
shape and to refuse any field outside that shape — i.e., reuse the PR-1
redaction allowlist). This is one of the open questions for the S5
implementation task author (see §10).

### 8.3 Append-only at schema and rule level

`audit_events` is append-only at both the schema level (UPDATE / DELETE
denied by triggers — S3 migration) and the rule level (FR-028). S5
emits a *new* compensating record if anything goes wrong — never an
edit of an existing record. There is no edit / undo path for forced
closes.

### 8.4 PR-1 redaction

The forced-close audit payload allowlist (`src/shared/audit/payload-schemas.ts`)
must refuse any field that is not in the documented S5 schema. The
free-text `annotation` is permitted but is structurally distinct from
`forced_close_reason`. PIN values, Clerk JWTs, session tokens,
cardholder data, full PII (email, phone) are not in the schema and are
refused — this matches the S3 redaction posture and the
[`../contracts/bridge-api.md`](../contracts/bridge-api.md) §Endpoint 10
"Redaction" rules.

The cross-process redaction smoke test (extending 002's) covers the
forced-close path: the test emits a `shift.forced_close` event with an
annotation containing every forbidden token (PIN-shaped strings, Clerk
JWT shapes, email-shaped strings) and asserts that none of those tokens
appears in any log line, Sentry event, or support-bundle export.

### 8.5 Branch / tenant isolation

Every read in the forced-close handler is constrained by
`(tenant_id = session.tenant_id, branch_id = session.branch_id)` — the
manager / admin sees only stuck shifts in their own branch. Cross-branch
attempts are conflated with role mismatch in the user-visible refusal
(P17). This is consistent with the
[`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md)
§Section 3 row for the stuck-shift list ("Filtered to the manager's
authorised branches").

---

## 9. Backend dependency questions (§A2 Wave 4)

S5 introduces zero new backend endpoints. It reuses Endpoint 5
(`POST /api/pos/v1/audit-events`) and depends on the existing Wave 4
recognition of the `shift.forced_close` action category, documented in
[`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
§Endpoint 5 ("Audit-event recognition by category"):

- The backend MUST recognise `shift.forced_close` as a category at minimum, distinct from `shift.close` (FR-026 — the two MUST NOT be conflated).
- The backend MUST persist the structural attribution fields (`shift_owner_id`, `forced_close_actor_id`, `forced_close_reason`) without collapsing them into the generic `payload` blob.
- The backend MUST NOT log the `payload.annotation` content beyond the redaction-allowlist check.

### Open backend questions (carried forward to the implementation task author)

1. **Does the backend persist `forced_close_reason` as an enum or as a string?** The contract is silent. POS-Pulse emits the literal string from the FR-024(c) closed enum; the backend MAY enforce server-side enum validation (recommended) or accept the literal string and leave validation to the client. **Recommendation**: treat as enum at both ends; the backend validator rejects unknown values with `category: 'schema_violation'` per Endpoint 5's rejected-events shape.
2. **Does the backend impose a free-text annotation length cap?** The Surface 4B layout sketch caps at 500 characters; the contract does not currently specify a server-side cap. **Recommendation**: backend caps at 500 characters and rejects longer annotations with `category: 'schema_violation'`. Client side already enforces 500 via the textarea `maxlength`.
3. **Sync ordering between `operator.session.takeover` and `shift.forced_close`.** The two events are independent (FR-013 + FR-024 + Edge Cases). The backend's audit-events sync endpoint accepts batches; the offline outbox MAY submit the takeover event from terminal B and the forced-close event from the manager's terminal in either order. **Recommendation**: the backend persists each independently with no implicit linkage beyond shared `acting_operator_id` / `shift_owner_id`. T086 verifies this property.
4. **Does Endpoint 5's `rejected[]` for a `shift.forced_close` event with a missing structural field surface as `'schema_violation'` or as a new generic `'invalid_input'`?** Aligned with §Endpoint 5; the renderer (S5) MUST treat any rejection as a generic `OperatorRefusal { category: 'invalid_input' }` per NFR-003. Local outbox keeps the event for support.
5. **Stuck-shift discovery mechanism.** The Surface 4A list is read from the *local* `shifts` table on the manager's terminal — but the manager may be on terminal B, while the stuck shift was opened on terminal A. The local `shifts` table on terminal B does not currently have terminal A's stuck shift row. **Open question**: does the backend provide a `GET /api/pos/v1/shifts/stuck?branch_id=` query (a *new* Wave 4 endpoint not yet documented), or does the local `shifts` row sync via an existing channel? **Recommendation (to the implementation task author)**: this is a real gap. If the backend already syncs cross-terminal shift rows under the existing 002/004 pipeline, no new endpoint is needed; if not, S5 MUST add a stuck-shift query to Wave 4. Flag for `/speckit-plan` follow-up before T089 starts. **Update to [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md) needed if a new endpoint is required.**

---

## 10. Proposed task breakdown (restating T083–T093)

S5 task IDs from [`../tasks.md`](../tasks.md) Phase 7. **All blocked
until S4 is fully merged AND §A2 Wave 4 is delivered (backend
recognises `shift.forced_close` audit category).** Within the gates,
S5 internal ordering is: tests-first per Constitution VI, then handler,
then renderer surfaces, then route mount, then logging.

### 10.1 Bridge / IPC additions (zero net new exports)

- **No new bridge entries.** `operator.forceCloseShift` is already in `src/shared/bridge-api.ts` (locked S4 typing). No new IPC channel; no new preload export.

### 10.2 Main-process handler (T089)

- **T089** — `src/main/operator/forced-close-handler.ts`
  - `requireRole(['manager', 'admin'])`
  - branch-scope check (P17)
  - shift state machine transition (`open → closed_forced`; reject otherwise with `state_invalid`)
  - `declared_count = null` (absent state)
  - emit `shift.forced_close` via `audit-emitter.ts`
  - return `audit_event_id`
  - depends on T015 (`requireRole`), T046 (audit emitter)
  - **BLOCKED on §A1 (cleared) + §A2 Wave 4**

### 10.3 Renderer surfaces (T090, T091, T092)

- **T090** — `src/renderer/ui/operator/ForcedCloseSurface.tsx`
  - Surface 4A (stuck-shift list) + Surface 4B (forced-close form)
  - **Note 3 (Slice 0) acceptance: default to card-stack rendering for the row list**, per the Slice 0 reviewer's lean. Revisit only if integration-time density evidence (≥ 10 stuck shifts at peak across pilot tenants) argues for `Table`. Default decision is recorded here for the task author.
  - depends on T017 (route guard), T076 (S4 manager-side route mount)
  - **BLOCKED on §A1 (cleared) + §A2 Wave 4**
- **T091** — `src/renderer/ui/operator/ShiftClosedBanner.tsx`
  - Cashier-returns informational banner using 003's `Banner` primitive (variant `info`, dismissable)
  - copy per [`../visual-direction/README.md`](../visual-direction/README.md) §"Surface 6 cashier-returns banner"
  - never shows the forbidden financial details (AC-6)
  - depends on T031 (S1 shell-banner slot wiring)
  - **BLOCKED on §A1 (cleared)** — no §A2 dependency; banner state is local-derived from the cashier's most-recent `closed_forced` shift sync (read-only)
- **T092** — `src/renderer/routes/sign-in.tsx` route additions (mount `/app/manager/stuck-shifts`)
  - Guarded by `<OperatorRouteGuard role="manager">`
  - Cashier MUST NOT reach this route (NFR-009 — visibility persistence across reloads)
  - depends on T017 (route guard), T090 (surface)
  - **BLOCKED on §A1 (cleared)**

### 10.4 Tests (T083–T088)

All `[BLOCKED: §A1]` (cleared) plus T085 also `[BLOCKED: §A2 Wave 4]`:

- **T083** — Unit: `<ForcedCloseSurface>` blind-close discipline (no count entry, no expected total, no variance / shortage / overage). AC-1.
- **T084** — Unit: forced-close form reason picker (only the five enumerated values; submit disabled until pick; annotation in `payload.annotation` only). AC-2.
- **T085** — Integration (main): forced-close audit event emission shape. AC-3 + AC-4 + AC-9.
- **T086** — Integration: takeover ↔ forced-close separation invariant. AC-5.
- **T087** — Integration (renderer): cashier-returns banner content allowlist. AC-6.
- **T088** — Integration (renderer, US2): cashier route enumeration (≥ 20 access paths) reaches zero ⛔ rows. AC-7. **This task is the SC-003 walkthrough automated.** Carries weight beyond S5 — it verifies the complete role boundary established by S1 + S4 + S5; without S5 the matrix has its full Section 3 row set so this is the right moment to lock SC-003 in code.

### 10.5 Logging + redaction (T093)

- **T093** — Add `pino` log sites with PR-1 redaction for:
  - forced-close attempt outcome (success / generic refusal categories — never the underlying cause beyond the category, per FR-032)
  - takeover-stranded-shift detection (the stuck-shift row is detected by the manager-side query)
  - cashier-returns-banner display (a single low-severity log; opaque cashier id; no financial data)
- depends on T089

### 10.6 Cross-cutting (no new task, but called out)

- The S5 implementation PR also updates [`../contracts/role-visibility-matrix.md`](../contracts/role-visibility-matrix.md) §Section 3 with the rows from §5.1 of this draft and §Section 4 with the explicit enumerations from §5.2. Per matrix §Section 8, this is part of the same PR as the S5 surfaces.

---

## 11. Risks / open questions

### 11.1 Stuck-shift detection mechanism (load-bearing open question)

The Surface 4A list needs to enumerate stuck shifts on the manager's
authorised branches. The local `shifts` table on the manager's
terminal does not necessarily contain terminal A's stuck shift row
(the manager may be on terminal B, while the stuck shift was opened on
terminal A by cashier X). Current
[`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
does not document a Wave 4 stuck-shift query.

**Possible resolutions** (the task author picks one before T089 / T090
begin):

- **(a)** Add `GET /api/pos/v1/shifts/stuck?branch_id=` to Wave 4. Returns the list of `shifts` rows in the branch where `lifecycle_state = 'open'` and the opening cashier's last `operator.session.takeover` is older than the shift's `started_at`. (Or simpler: just `lifecycle_state = 'open'` and the opening cashier is currently signed in elsewhere or signed out for > 30 minutes.) Each row carries the FR-024(b) attribution data needed by Surface 4A.
- **(b)** Sync existing `shifts` rows cross-terminal via the existing 002/004 pipeline. No new endpoint. The local `shifts` table on terminal B already contains terminal A's stuck shift after sync. The forced-close handler reads from local; emission goes through Endpoint 5 only.
- **(c)** Compute the stuck-shift list client-side from the `audit_events` outbox alone (find `operator.session.takeover` events where the source-terminal still has a shift that has not been recorded as `closed_normal` or `closed_forced`). Workable but brittle: relies on `audit_events` carrying enough context to reconstruct shift state, which it currently does not.

**Recommendation**: (a) is the cleanest and matches the Spec Kit pattern.
If (b) is already true via the existing pipeline, (a) is redundant. The
task author MUST verify which is the case before authoring T089 and
update [`../contracts/backend-endpoints.md`](../contracts/backend-endpoints.md)
if (a) is required. **Action**: add an §A2 Wave 4 line item if a new
endpoint is needed.

### 11.2 Concurrent forced-close race (two managers)

Two managers in the same branch on different terminals each open their
stuck-shift list and pick the same row at the same moment, then both
submit. The shift can only be force-closed once.

- **Mitigation**: the `event_id` in the forced-close request is a
  client-generated UUID v4 (P5). The handler checks the shift's
  current `lifecycle_state` at write time; the second submission
  encounters `closed_forced` and returns `OperatorRefusal { category: 'state_invalid' }`. The renderer reloads Surface 4A and the row is no longer there.
- The two `event_id`s are different (each manager's renderer generates its own); the audit_events table records *one* `shift.forced_close` row from the first submission. The second submission's `event_id` is rejected with `state_invalid` and **does not** persist as a duplicate forced-close audit event (in particular: the second submission's `event_id` is NOT silently swallowed as a "duplicate" via P5 — duplicate detection on `event_id` is exact-match; `state_invalid` is a different envelope).

### 11.3 Cashier-returns banner trigger location

When the absent cashier signs back in, the banner SHOULD appear on:

- **(a) the next sign-in to ANY paired terminal in their authorised tenant + branch set**, OR
- **(b) only on the terminal where the prior shift was opened**.

[`../spec.md`](../spec.md) Edge Cases ("cashier returns after a forced
close: same or different terminal") implies (a). The Surface 6 banner
spec ([`../visual-direction/README.md`](../visual-direction/README.md))
is written for (a) — the banner lives on the operator-bound landing
surface and is keyed to the cashier's identity, not the terminal.

**Recommendation**: (a). This matches the spec, matches the Surface 6
spec, and avoids tying the banner to the specific terminal that may
itself be unreachable (terminal failure was one of the FR-024(c)
reasons). The banner state (dismissed / not dismissed) is a property
of the cashier's *identity* on this terminal — i.e., the dismiss is
per-(terminal, cashier identity) so that dismissing on terminal A does
not silence the banner on terminal B if the cashier next signs in
there. **Open**: whether dismiss is per-cashier-globally or per-
(terminal, cashier). The Surface 6 spec leans per-terminal-cashier;
the task author confirms in T091.

### 11.4 `declared_count` representation: `null` vs `'absent'` literal

[`../spec.md`](../spec.md) §Key Entities — Shift names the absent
state; `data-model.md` is the canonical schema. The current
`forced-close-handler.ts` plan writes `declared_count = null`. This is
fine **provided** the data-model.md `Shift` schema documents `null`
as the absent literal AND the future variance / reconciliation logic
treats `null` as `absent`, not as `0`.

**Recommendation**: pick one representation in `data-model.md` and
codify it there. Two acceptable choices:

- **`null`** — simplest at the SQL layer; requires every consumer to
  convert `NULL` to the absent state in TS (`declared_count: number | null`,
  with `null === absent`).
- **A literal `'absent'` string in a tagged union** — `declared_count:
  number | { kind: 'absent' }` — clearer at the TS layer; awkward at
  the SQL layer (would need a sentinel column or a JSON blob).

The task author picks during T089. **Whichever is picked MUST be
documented in `data-model.md`** so future variance / reconciliation
features have an unambiguous contract.

### 11.5 Note 3 (Slice 0 reviewer): card-stack default

The Slice 0 reviewer leans toward `Card`-stack rendering for Surface
4A. Note 3 says the S5 task author may revisit if integration-time
density evidence argues otherwise.

**Recommendation**: default to `Card` per Note 3 unless one of the
following is observed at integration time:

- ≥ 10 stuck shifts simultaneously visible (rare; pharmacy peak).
- Reviewer feedback on the Slice 0 contact sheet preferring `Table`.
- Density / accessibility issue with `Card` at 1024–1279 px.

The S5 task T090 starts with `Card`. If `Table` is later preferred,
the swap is a follow-up small PR (Constitution P13 — small slices).

### 11.6 Audit-payload schema gap (`shift.forced_close`)

`src/shared/audit/event-shape.ts` already includes `'shift.forced_close'`
in `AUDIT_ACTION_CATEGORIES`. `src/shared/audit/payload-schemas.ts`
(landed in S3) likely does not yet have a per-category payload schema
for `shift.forced_close` — S3 was scoped to the audit scaffolding, not
the per-category schemas of forced-close, takeover, or PIN reset
events specifically. **Open question for T089**: does the task add
the `shift.forced_close` payload schema to
`src/shared/audit/payload-schemas.ts`, or has it already been added in
S3 / S4? **Recommendation**: T089 verifies; if missing, T089 adds the
schema (small extension, ≤ 50 LOC). The redaction allowlist on the
schema rejects any field outside `{ shift_owner_id,
forced_close_actor_id, forced_close_reason, annotation? }`.

### 11.7 Manager / admin sign-in on the *cashier's* terminal during a stuck-shift situation

Edge Case ("manager forced close while a different cashier is signed
in on the same terminal") explicitly says forced close is reachable
only from a manager / admin surface and the stuck-shift's existence
MUST NOT be visible on the currently-signed-in cashier's surfaces.
T088's SC-003 walkthrough exercises this.

**Open question**: if a manager signs in on terminal A *while* a
different cashier Y is also active in the branch (e.g., the manager
inherits terminal A from Y by takeover, or the manager signs in on
terminal A because Y stepped away briefly), the manager sees the
stuck-shift list with Layla's shift; the manager closes it. The
forced-close audit event's `originating_terminal_id` is *terminal A*
(the manager's current terminal — same as the stuck shift's terminal).
Is this OK? **Yes** — the spec allows this. The
`originating_terminal_id` is the *manager's* current terminal,
regardless of whether it happens to also be the stuck shift's
original terminal.

### 11.8 Backend not recognising `shift.forced_close` (Wave 4 not delivered)

If S5 attempts to merge before §A2 Wave 4, the `shift.forced_close`
audit events sync to the backend and are rejected with
`category: 'invalid_input'` or `'schema_violation'`. The local
`audit_events` row remains durable (P3 — no silent loss), and the
manager / admin sees a generic refusal at the bridge return. **The
slice cannot ship to production without Wave 4.** Coordination
([`../coordination.md`](../coordination.md)) lists Wave 4 as the
remaining backend dependency.

---

## 12. Explicit deferred items

Restated in one place for the implementation task author and the PR
reviewer:

- **Sales / cart / line-item / receipt / payments / tender / change /
  money-math business logic** — deferred to 005-checkout-payments and
  the future shift-management feature.
- **Receipts (printing, rendering, content rules, reprints)** — deferred.
- **Inventory mutation, stock movement, FEFO logic, batch / lot
  tracking** — deferred.
- **Reports, KPIs, dashboards, analytics surfaces, manager-review
  *implementation*** — deferred. The manager-review *audit attribution*
  is locked in S5 (FR-022 surfaces the data; the surface is implemented
  later); the manager-review *layout* is not in S5.
- **Drawer math, expected-total computation, variance / shortage /
  overage arithmetic** — deferred. S5 records `declared_count =
  null / absent` and `lifecycle_state = closed_forced`; the future
  shift-management feature decides what variance does.
- **Cashier-self-service PIN reset** — covered under S4's manager-
  attributable PR-5 path; S5 does not extend.
- **Custom permission engines, ABAC, capability registries, per-action
  permission catalogues** — forbidden by FR-002a; S5 does not add.
- **Auto-generated reports** — deferred.
- **Sorting / filtering / bulk forced-close / audit-log rendering on
  Surface 4A or 4B / edit / undo of a forced close** — explicitly
  excluded from Slice 0 visual direction; S5 honours.
- **A second IdP, offline auth, biometric / smart-card sign-in** —
  forbidden / deferred.
- **Backend endpoints introduced by S5** — zero net new (only the
  Wave 4 recognition of `shift.forced_close` in the existing
  Endpoint 5).
- **Anything that would change `_reference/Data-Pulse/`** — Constitution
  Principle IX. S5 derives every rule from the constitution +
  001/002/003 plans + the 004 spec.

---

**End of S5 spec draft.** Status: blocked on S4 completion (PR #94
merged; #85 takeover handler + #86 PinPad UI pending) AND §A2 Wave 4
([`../coordination.md`](../coordination.md) — backend recognising
`shift.forced_close` audit category). Next action when both gates
clear: invoke `/speckit-tasks` for any S5 task additions beyond the
existing T083–T093 set, then begin T083 / T084 (tests first, per
Constitution VI).
