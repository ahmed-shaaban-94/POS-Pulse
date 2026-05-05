# Feature Specification: Operator & Session

**Feature ID:** 004-operator-session
**Feature Branch:** `004-operator-session`
**Status:** Draft
**Created:** 2026-05-05
**Owner:** POS-Pulse desktop team
**Input:** User description: "Define the operator/session and visibility boundary needed before sales, cart, payments, reports, or shift financial workflows are implemented."

---

## Overview

POS Pulse has shipped 001 (foundation), 002 (terminal pairing), and 003 (POS UI shell). A
paired terminal can now reach the post-pairing application shell, but the shell currently
treats the terminal itself as the only identity: there is no concept of *who* is operating
the terminal, no role separation, no shift, and no audit trail. Every POS surface that
follows — sales, cart, payments, refunds, drawer kicks, reports, shift reconciliation —
needs an authenticated operator, a shift container, role-gated visibility, and tamper-
resistant audit attribution before it can be safely built.

This feature defines that operator/session/visibility layer **as product behaviour and
business rules**. It deliberately stops short of any data, transport, or persistence
implementation: no migrations, no OpenAPI changes, no IPC, no preload changes, no source
code. Its purpose is to lock in the rules that 005-checkout-payments, future
shift-management, future reporting, and every later sensitive-action feature must honour.

This feature also formalises the workflow lesson from 003: every UI-bearing feature that
follows MUST run an *early visual direction* pass after planning and before the first
implementation slice. That requirement is captured here so it can be inherited by all
post-004 specs.

## Clarifications

### Session 2026-05-05

- Q: Operator credential factor — which factor does each role use to sign in? → A: Cashiers pick their display name from the branch roster, then enter a short PIN (4–6 digits); managers and admins sign in with a password. Roster pick disambiguates cashier identity, so cashier PINs do not need to be globally unique within the branch.
- Q: Same-operator concurrent sign-in policy — may the same operator be signed in on two terminals at once? → A: No — single active operator session, branch-wide. When an operator successfully signs in on a second terminal while still bound to a first, the new terminal MUST display an explicit takeover prompt; on confirmation, the prior terminal's operator session terminates and the prior terminal returns to the Sign-In surface on its next interaction or within 30 s, whichever comes first.
- Q: Cashier handover within an open shift — may a different cashier take over an open shift mid-flight? → A: No. Shifts are operator-bound and non-transferable. The cashier who opens a shift MUST close it; a different cashier signing in on the same terminal always opens a new shift. When the opening cashier becomes unable to close (takeover-driven sign-out, no-show, illness, terminal failure), a Shift Manager (`manager`) or Owner / Admin (`admin`) MUST execute a `shift.forced_close` action that records both the absent cashier (`shift_owner`) and the manager / admin (`forced_close_actor`); the close remains blind — the manager records the cashier's *absence of declared count*, not a count on the cashier's behalf, and the cashier's `declared_count` is set to the explicit state **absent** (distinct from zero, distinct from matched). A Q2 takeover ends only the operator session; if it strands an operator-bound shift, recovery is via this forced close, recorded as a separate audit event.
- Addendum 2026-05-05 (role naming): the role catalogue stays at three entries — `cashier` (Cashier / Operator), `manager` (Shift Manager), `admin` (Owner / Admin) — with machine identifier and business name in 1:1 correspondence (FR-002). 004 does NOT introduce a custom permission engine, ABAC system, or capability registry (FR-002a); future role extensibility is deferred to a later dedicated feature.

## User Scenarios & Testing *(mandatory)*

<!--
  User stories are PRIORITIZED. Each story is INDEPENDENTLY TESTABLE: implementing only
  P1 yields a viable MVP slice that delivers measurable value. P2 layers role-gated
  visibility on top; P3 layers blind shift close and audit attribution.
-->

### User Story 1 — Operator sign-in on a paired terminal (Priority: P1)

A paired terminal lands on a Sign-In screen rather than directly into a cashier surface.
A cashier or manager identifies themselves with operator credentials. On success, the
terminal binds an *operator session* to the existing terminal session and unlocks the
role-appropriate surfaces of the shell (placeholders for sales, cart, etc.). On sign-out
the terminal returns to the Sign-In screen and forgets the operator identity. No sales,
no shift state, no privileged data is reachable while no operator is signed in.

**Why this priority**: Without an authenticated operator, every later feature has to
either invent its own identity or attribute work to "the terminal", which violates
constitutional principle P10 (Operator Accountability) and blocks 005-checkout-payments.
This is the smallest slice that delivers a real product capability — operators can
*demonstrably* sign in and out — and it is the foundation every other POS surface depends
on.

**Independent Test**: A reviewer pairs a terminal, launches the app, observes the Sign-In
screen, signs in as a cashier (and separately as a manager), confirms only role-allowed
surfaces are reachable, signs out, confirms the Sign-In screen returns and no operator-
scoped data is visible. No sales, no payments, no inventory mutation are required for
this test.

**Acceptance Scenarios**:

1. **Given** a paired terminal with no operator signed in, **When** the application is
   launched, **Then** the post-pairing shell renders the Sign-In screen and no
   cashier/manager surface is reachable from any route or shortcut.
2. **Given** the Sign-In screen is visible, **When** an operator submits valid
   credentials for an account associated with the terminal's tenant and branch,
   **Then** within 5 seconds the application transitions to the role-appropriate landing
   surface and the shell exposes the operator's display name and role indicator.
3. **Given** an operator is signed in, **When** they invoke Sign-Out (explicit user
   action) or the inactivity timer expires, **Then** the application returns to the
   Sign-In screen and any operator-scoped client state (e.g., draft cart placeholders,
   recent-action lists) is cleared from the visible UI.
4. **Given** valid credentials are submitted for an account that does not belong to the
   terminal's paired tenant or branch, **When** the operator submits, **Then** sign-in is
   refused with a generic "credentials not recognised" message — neither the existence of
   the account nor the tenant/branch mismatch is disclosed in the user-visible error or
   in any log.
5. **Given** an operator signs in, **When** they navigate the shell, **Then** the
   currently-signed-in operator's identity is visible in a fixed shell location at all
   times (consistent with 003's role-indicator slot) and updates immediately on sign-out.
6. **Given** an operator is signed in on terminal A and is now in front of terminal B
   on the same branch, **When** they submit valid credentials on terminal B,
   **Then** terminal B presents a generic takeover prompt ("You are already signed
   in on another POS terminal in this branch. Continue here and sign out there?")
   without naming terminal A. On **Continue here**, terminal A's session is marked
   `superseded_by_takeover`, terminal B becomes the operator's active session, and
   terminal A returns to the Sign-In surface on its next operator interaction or
   within 30 seconds — whichever is first. On **Cancel**, no session is created on
   terminal B and terminal A is unaffected.
7. **Given** any sign-in attempt (success or failure), **When** the resulting log entry
   is opened, **Then** neither the operator's password, PIN, session token, nor any
   credential fragment appears in the log; failed attempts log only a redacted operator
   reference and a coarse outcome category.

---

### User Story 2 — Role-gated visibility (cashier vs manager) (Priority: P2)

The shell exposes different surfaces and different *information* depending on the
signed-in operator's role. A **Cashier / Operator** (machine role `cashier`) sees only
what they need to ring a sale; a **Shift Manager** (machine role `manager`) sees the
cashier's surface plus shift summary, expected-cash, variance, reports, and
manager-review surfaces; an **Owner / Admin** (machine role `admin`) additionally sees
tenant-wide configuration (the existence of which 004 reserves but does not design
beyond that). A cashier never sees shift totals, expected drawer cash,
shortages, overages, KPIs, manager-review data, or any report. The role boundary is a
*visibility* rule, not just a navigation rule: data the cashier is not permitted to see
MUST NOT be returned to the cashier's surface even when the URL or route is forced.

**Why this priority**: Role-gated visibility is the precondition for blind shift close
(US3). Without it, "blind close" is impossible — the cashier could read the expected
total from any reports surface and tailor their declared count. P2 isolates the rule so
it can be enforced consistently before US3 layers shift mechanics on top.

**Independent Test**: A reviewer signs in as a cashier and confirms that every privileged
surface (shift summary, expected cash, variance, reports, KPIs, manager-review) is
genuinely absent — not merely hidden by CSS. Signs in as a manager on the same terminal
and confirms the same surfaces appear and are populated with the manager-visible
information. No actual sales or reports are required to test this — surface
*reachability* and *information visibility* are testable against placeholder data.

**Acceptance Scenarios**:

1. **Given** a cashier is signed in, **When** they enumerate every navigable route in
   the shell, **Then** none of the routes resolve to a Reports, KPI, Shift Summary,
   Expected Cash, Variance, Manager Review, or Admin surface — those surfaces MUST be
   absent from cashier navigation, absent from cashier route resolution, and absent
   from cashier search/quick-action results.
2. **Given** a cashier is signed in, **When** they manually attempt to reach a manager-
   only route (typing a path, deep-link, restored tab), **Then** the application returns
   them to a cashier-allowed surface with a generic "this section is not available for
   your role" message; no privileged data is rendered, even briefly.
3. **Given** a manager is signed in, **When** they navigate the shell, **Then** every
   surface a cashier can see is reachable, plus the additional manager-only surfaces
   (Shift Summary, Expected Cash, Variance, Reports, KPIs, Manager Review).
4. **Given** any operator is signed in, **When** their role indicator is inspected,
   **Then** it accurately reflects the role used for that session and the surfaces
   currently reachable in the shell.
5. **Given** a manager signs in immediately after a cashier signs out on the same
   terminal, **When** the manager's session begins, **Then** no cashier-scoped client
   state from the previous session is observable on the manager's surfaces.
6. **Given** the role boundary is enforced, **When** a privileged request is forced from
   a cashier surface, **Then** the request is refused with a generic outcome that does
   not disclose what data would have been returned.

---

### User Story 3 — Blind shift close & audit attribution scaffold (Priority: P3)

The shift close ceremony is *blind*: the cashier counting the drawer never sees the
expected total, expected change-fund, or system-computed variance. They submit the
counted amount; the variance, expected total, shortage, and overage are visible only to
a manager during review. Sensitive actions that future features will introduce —
refunds, voids, overrides, drawer actions outside a sale, shift close/review — are
attributed to a specific operator and a specific shift. This story does **not**
implement shift mechanics, drawer math, or any close UI; it locks in the *rules* those
future features must satisfy and reserves named visibility-and-attribution slots in the
shell.

**Why this priority**: Blind close is the single rule that forces the visibility
boundary in P2 to be real, and audit attribution is the rule that makes every future
sensitive-action feature meaningful. Codifying both here, before shift mechanics or
sales exist, prevents the rule from being eroded later.

**Independent Test**: A reviewer reads the spec, the Future Audit Requirements section,
and the Cashier-Forbidden Information matrix. Confirms that for every sensitive action
in the catalogue, the spec names the attributable identity, the shift container, and
the originating terminal. Confirms that the cashier-forbidden information list is
internally consistent with the role-gated visibility rules in US2 and that no item on
the list can be inferred from a cashier-visible surface.

**Acceptance Scenarios**:

1. **Given** the spec defines blind shift close, **When** any future shift-close UI is
   designed, **Then** the cashier's count-entry surface MUST NOT display the expected
   drawer cash, the expected change-fund, the system-computed variance, the shortage,
   or the overage either before, during, or after the cashier submits their count.
2. **Given** the spec defines manager review, **When** any future manager-review UI is
   designed, **Then** the expected total, declared total, variance, shortage, overage,
   and the cashier's identity MUST be visible to the reviewing manager and only to the
   reviewing manager.
3. **Given** the audit attribution rules, **When** any future feature implements a
   sensitive action (refund, void, override, drawer action outside a sale, shift close,
   shift review, supervisor approval), **Then** every audit record for that action MUST
   carry: (a) the acting operator identity, (b) the shift identity under which the
   action occurred, (c) the originating terminal, (d) a timestamp, and (e) the action
   category. Records that omit any of these five attributes MUST be rejected at the
   action boundary; partial-attribution audit records MUST NOT be persisted.
4. **Given** an action requires a supervisor override (e.g., a void above a threshold),
   **When** the override is applied, **Then** both the requesting operator and the
   approving supervisor MUST be recorded, alongside the original operator's identity if
   different from the requester.
5. **Given** a shift was opened by cashier X on a terminal, **When** cashier X signs
   out (explicit, inactivity, terminal restart, or a takeover from another terminal
   per FR-013), **Then** the shift remains *open and operator-bound to cashier X*;
   the terminal returns to the Sign-In surface; no other cashier may close that
   shift. If cashier X signs back in on the same terminal before any other operator
   does, they resume their own shift. If a different cashier signs in instead, that
   cashier MAY only open a *new* shift — they MUST NOT be able to interact with
   cashier X's still-open shift in any way. If cashier X cannot return (no-show,
   illness, dismissal, terminal failure on a different machine), the only path
   forward is a manager-attributable **forced close** under FR-024 / FR-026.
6. **Given** any sensitive action's audit record is later inspected, **When** support
   reads the record, **Then** it is sufficient to answer "who did what, on which
   terminal, during which shift" without needing to cross-reference the application
   logs (P10 / P11 alignment).

---

### Edge Cases

- **No operator signed in, terminal idle**: the Sign-In screen is the only reachable
  surface; route restoration from a previous operator's session MUST NOT bypass it.
- **Operator credentials offline**: 004 fails *closed* for any new operator sign-in
  attempt while offline. New manager/admin sign-in is refused (Clerk unreachable);
  cashier PIN unlock alone is insufficient (the Clerk-anchored identity validation
  and Endpoint 6 takeover-detection step both require connectivity); the Sign-In
  surface returns the generic `no_connection` failure variant per NFR-003 / PR-2.
  Existing already-signed-in local sessions MAY continue, with the connection-state
  visual surfacing `offline`/`degraded` per 003. The full offline-behaviour rule set
  is normative under NFR-011; full offline operator sign-in is deferred to a future
  offline-auth feature (see Assumption A6).
- **Inactivity / auto-sign-out**: while signed in, an inactivity timer terminates the
  operator session and returns the shell to the Sign-In screen. Default duration: see
  Assumptions.
- **Forced navigation to a privileged surface as a cashier**: route resolution returns a
  generic "not available for your role" surface; no privileged content is briefly
  rendered, painted, or fetched.
- **Sign-in attempted before pairing completes**: 002 already prevents this — the
  Sign-In screen is itself a post-pairing surface and is not reachable until the
  terminal is paired.
- **Terminal token revoked while an operator is signed in**: the operator session
  terminates immediately and the shell returns to the pre-pairing path defined by 002.
- **Operator account disabled mid-session**: the next privileged interaction terminates
  the session and the user is returned to Sign-In with a generic message.
- **Two managers reviewing the same shift**: review attribution captures *which*
  manager reviewed; this feature does not implement concurrency control beyond
  recording attribution. (Each manager will hold their own active session on a
  distinct terminal, consistent with FR-013's single-active-session-per-operator
  rule.)
- **Takeover window on the abandoned terminal**: between a successful takeover
  confirmation on terminal B and terminal A's transition back to the Sign-In
  surface, terminal A MUST NOT accept any new operator interaction that would
  create a new sensitive-action audit record. The visible operator name on terminal
  A during that window is permitted briefly but MUST clear within 30 seconds even
  if no operator interaction occurs.
- **Takeover prompt cancelled mid-flow**: if the operator dismisses the takeover
  prompt on terminal B (browser-equivalent close, terminal lock, app crash) before
  selecting Continue here or Cancel, the prior session on terminal A is preserved
  unchanged and no session is created on terminal B.
- **Takeover strands an operator-bound shift**: if a takeover under FR-013
  force-signs-out a cashier who has an open operator-bound shift on terminal A, the
  takeover ends only the *operator session* on terminal A. The shift on terminal A
  remains open and operator-bound to the original cashier; it MUST NOT be closed,
  modified, resumed, or reassigned by the takeover. Terminal A enters a
  *stuck-shift* state visible only on manager/admin surfaces. The only path to
  close is a `shift.forced_close` under FR-024, which is a *separate* audit event
  from the `operator.session.takeover` that produced the stuck state. The two
  events MUST carry independent timestamps, independent originating-terminal
  references (the takeover originates on B, the forced close originates on the
  terminal where the manager performs it), and MUST NOT be merged into a single
  audit record. The stuck-shift state on terminal A MUST NOT block other operators
  from signing in on terminal A and opening a *new* shift, provided the prior
  shift is recorded as still-open and visibly distinct on manager surfaces.
- **Cashier returns after a forced close**: if a cashier whose shift was
  force-closed by a manager later signs back in (same or different terminal),
  they MUST NOT be shown the closed shift's expected total, declared count
  (which was null), variance, shortage, or overage on any cashier-reachable
  surface — including any "your last shift was closed for you" notification
  surface a future feature might introduce. The cashier MAY be informed *that*
  their shift was force-closed, but not the financial details.
- **Two cashiers on one terminal during a single calendar shift**: if cashier X
  closes their shift normally and then cashier Y signs in on the same terminal a
  few minutes later, cashier Y opens a *new* shift; cashier Y MUST NOT be able to
  view, resume, or otherwise interact with cashier X's now-closed shift. Each
  shift is independently attributed and independently auditable.
- **Manager forced close while a different cashier is signed in on the same
  terminal**: forced close is reachable only from a manager/admin surface; the
  presence of a stuck shift owned by a different cashier MUST NOT be visible on
  the currently-signed-in cashier's surfaces. The manager performs the forced
  close from their own session (which may be on a different terminal entirely);
  the originating-terminal field on the `shift.forced_close` audit record names
  the *manager's* terminal, not the terminal that holds the stuck shift.
- **Operator signs in but no shift is open**: a future feature decides whether sign-in
  alone opens a shift; this spec only requires that shift identity be present at
  sensitive-action time, not at sign-in time.

## Requirements *(mandatory)*

### Functional Requirements

#### FR-Identity (operator identity model)

- **FR-001**: The system MUST treat the *operator* as a distinct identity from the
  terminal. A terminal session (delivered by 002) MAY exist without an operator session;
  an operator session MUST NOT exist without a terminal session.
- **FR-002**: The system MUST associate each operator with exactly one *role* drawn
  from the closed role catalogue defined by 004. The catalogue has exactly three
  entries:
  - `cashier` — business name **Cashier / Operator**. Day-to-day terminal user
    who rings sales and runs a shift.
  - `manager` — business name **Shift Manager**. Floor-level manager responsible
    for supervisor overrides, shift review, and forced-close recovery.
  - `admin` — business name **Owner / Admin**. Tenant-level authority with the
    superset of manager surfaces plus tenant-wide configuration.
  Role identifiers (`cashier`, `manager`, `admin`) are the machine-stable keys
  used by audit records, route guards, and the role-indicator slot; business
  names are what appears in user-visible narrative, training material, and
  shell labels. The two MUST stay in 1:1 correspondence — renaming the business
  display name MUST NOT require touching the machine identifier and vice versa.
  Multi-role memberships, delegated roles, temporary supervisor elevation, and
  any per-operator custom-permission grants are out of scope for 004 (see
  Out-of-Scope) and deferred to a future role-extensibility feature.
- **FR-002a**: 004 MUST NOT introduce a custom permission engine, attribute-based
  access control system, capability registry, or per-action permission catalogue.
  The role IS the gate; the gate is binary; the set of reachable surfaces and
  returnable information for each role is determined entirely by the role
  identifier. Future features that need finer-grained permissions MUST extend
  this model via a separate Spec Kit feature, not by introducing ad-hoc
  permission infrastructure inside their own slice.
- **FR-003**: The system MUST scope operator accounts to a tenant and a set of branches.
  An operator MUST NOT be able to sign in on a terminal whose tenant or branch is not
  in their authorised set; the rejection MUST be indistinguishable from a generic
  invalid-credentials rejection in the user-visible UI and in logs.
- **FR-004**: Operator display names MUST be presentable in the shell without revealing
  email addresses, phone numbers, or any other personally identifying contact field.
  The shell MUST display operator role distinctly from operator name.

#### FR-Sign-in / Sign-out

- **FR-005**: The post-pairing shell MUST present a Sign-In surface as its only
  reachable route while no operator session is active.
- **FR-006**: The system MUST authenticate operators using a role-differentiated
  credential policy:
  - **Cashiers** sign in via a two-step affordance: (a) pick their own display name
    from the branch operator roster shown on the Sign-In surface, then (b) enter a
    short PIN of 4–6 digits. Both steps MUST be present; a PIN entered without first
    selecting a roster identity MUST NOT authenticate.
  - **Managers and admins** sign in with a password. The password field MUST NOT be
    pre-filled from any prior session and MUST be entered fresh on every sign-in.
  - The branch operator roster shown to cashiers contains only `display_name` and
    `role` for operators authorised on the current terminal's tenant + branch. It
    MUST NOT include email, phone, password hash, PIN material, audit history, or
    any other operator-level field.
  - Because the roster pick disambiguates cashier identity at sign-in time, cashier
    PINs MUST NOT be required to be globally unique within a branch; PIN collisions
    between two cashiers on the same branch roster are permitted and are not a
    security finding.
  - Whichever factor a role uses, it MUST be redacted in logs (NFR-002, P7), MUST
    NOT cross the preload bridge in plaintext (P8), and MUST NOT be persisted on the
    terminal beyond the encrypted credential store (001 secrets module).
- **FR-007**: Sign-in MUST complete successfully within 5 seconds on a healthy network
  for the standard hardware matrix; failure modes (invalid, rate-limited, disabled
  account, tenant/branch mismatch, network unreachable) MUST be reported with generic
  user-visible messages that do not reveal which mode applied.
- **FR-008**: Sign-out MUST be reachable from any surface where an operator session is
  active. Sign-out MUST clear all visible operator-scoped client state and MUST return
  the shell to the Sign-In surface within 1 second.
- **FR-009**: The shell MUST support an inactivity-based auto-sign-out timer. Default
  duration: 15 minutes (Assumptions). The timer MUST be reset by genuine operator
  interaction, not by background activity.
- **FR-010**: The shell MUST NOT remember operator credentials between sessions and
  MUST NOT pre-fill the credential field with the previous operator's identifier across
  sign-out, application restart, or terminal restart.

#### FR-Session ownership

- **FR-011**: Each operator session MUST be bound to exactly one terminal session at a
  time on a given terminal. A terminal MUST NOT host two concurrent operator sessions.
- **FR-012**: An operator session MUST be created only after a successful sign-in on a
  paired terminal. The session MUST carry: operator identity, role, tenant, branch,
  originating terminal, and the start timestamp.
- **FR-013**: An operator MUST NOT hold two concurrent operator sessions across
  terminals. The system enforces this with an explicit takeover flow:
  - **Detection**: When an operator submits valid credentials on terminal B while
    they are already bound to an active operator session on terminal A (any terminal
    paired to the same tenant + branch), terminal B MUST detect the prior session
    before establishing a new one.
  - **Takeover prompt**: Terminal B MUST display a confirmation prompt that names
    the situation generically — e.g. "You are already signed in on another POS
    terminal in this branch. Continue here and sign out there?" — with three
    options: **Continue here** (proceeds), **Cancel** (returns to the Sign-In
    surface, no session created on B). The prompt MUST NOT disclose which specific
    terminal hosts the prior session, MUST NOT disclose the prior session's start
    time, and MUST NOT reveal any other operator's identity or session state.
  - **Termination on confirmation**: When the operator confirms takeover on
    terminal B, the prior operator session on terminal A MUST be marked terminated
    with end-cause `superseded_by_takeover`. Terminal A MUST return to the
    Sign-In surface on its next genuine operator interaction or within 30 seconds
    of the takeover, whichever comes first. While terminal A is awaiting that
    transition, it MUST NOT accept any new operator interaction that would create
    a new sensitive-action audit record.
  - **Cancellation**: If the operator cancels the takeover on terminal B, no
    operator session is created on B and the prior session on A is unaffected.
  - **Audit attribution**: A takeover MUST itself be recorded as a sensitive
    action under FR-025/FR-026, with action category `operator.session.takeover`,
    acting operator = the operator confirming on B, originating terminal = B,
    and a reference to terminal A. This makes "operator was force-signed-out by
    a takeover from terminal B" forensically traceable without exposing the
    detail to the cashier on terminal B.
  - **Manager exception**: This rule applies uniformly to all roles. There is no
    manager-only override that permits concurrent sessions; concurrent manager
    sessions across terminals are governed by the same takeover flow.
- **FR-014**: Termination of the underlying terminal session (e.g., token revocation,
  unpair) MUST terminate any active operator session on that terminal and return the
  shell to the pre-pairing surface defined by 002.

#### FR-Visibility / role boundary

- **FR-015**: The cashier role MUST NOT have any reachable surface that exposes:
  shift totals, expected drawer cash, expected change-fund, declared cash count,
  shortage, overage, variance, reports of any kind, KPIs of any kind, manager-review
  data, audit log surfaces, admin/configuration surfaces, or other operators' shift
  data. This list is the **Cashier-Forbidden Information catalogue** and is normative.
- **FR-016**: A request issued from a cashier surface that would return information in
  the Cashier-Forbidden Information catalogue MUST be refused with a generic outcome
  that does not disclose the existence, shape, or magnitude of the would-be result.
- **FR-017**: The manager role MUST have all surfaces reachable by the cashier role,
  plus surfaces that expose the Cashier-Forbidden Information catalogue items, scoped
  to the branches the manager is authorised for.
- **FR-018**: The admin role MUST have all surfaces reachable by the manager role,
  plus tenant-wide configuration surfaces. Admin surfaces are not designed in this
  feature beyond reserving their *existence* in the role hierarchy.
- **FR-019**: Role-gated visibility MUST be enforced on the *information* layer, not
  only the navigation layer. Hiding a navigation entry MUST NOT be the only barrier
  between a role and forbidden information.
- **FR-020**: The shell MUST always display the currently-signed-in operator's display
  name and role indicator in a fixed location consistent with 003's role-indicator
  slot. The indicator MUST update immediately on sign-in, role change (none in scope
  here), and sign-out.

#### FR-Blind close

- **FR-021**: The future cashier shift-close UI MUST NOT display the expected drawer
  cash, the expected change-fund, the system-computed variance, the shortage, or the
  overage at any point before, during, or after the cashier submits their counted
  total. Submission of the counted total MUST be possible without the cashier ever
  observing any of those five values. Because shifts are operator-bound and
  non-transferable (FR-024), the cashier who closes a shift is always the same
  cashier who opened it; "blind" therefore means *that single cashier* never
  observes any of those five values across the entire lifetime of the shift —
  including any pre-close summary screens, intra-shift recap surfaces, or
  end-of-day affordances a future shift surface might introduce.
- **FR-022**: The future manager shift-review UI MUST display: the cashier's identity,
  the cashier's declared count, the system-expected total, the system-computed
  variance, the shortage, and the overage. Manager-review surfaces MUST be unreachable
  from any cashier role.
- **FR-023**: The shift-close ceremony MUST be designed so a single cashier cannot
  retroactively learn the expected total or the variance after the fact through any
  cashier-reachable surface (including subsequent shifts, receipt reprints, end-of-day
  recap screens, or any future surface).
- **FR-024**: A cashier MUST NOT see another cashier's shift, count, variance, or
  any of the Cashier-Forbidden Information catalogue items for any other operator.
  Shifts are **operator-bound and non-transferable**:
  - A shift opens at the cashier's first sensitive-action-eligible interaction (or
    at sign-in, if a future feature pins shift-open to sign-in) and is bound to
    that cashier's identity for its entire lifetime.
  - The cashier who opened a shift is the *only* cashier who may close it via the
    normal cashier shift-close path. A cashier signing in on a terminal that holds
    another cashier's still-open shift MUST NOT be able to view, resume, modify,
    declare a count for, or close that shift; they may only open a new shift on
    that terminal once any blocking state from the prior shift is resolved.
  - **Forced close (manager-attributable)**: If the opening cashier becomes unable
    to close — including but not limited to: takeover-driven sign-out from a
    different terminal under FR-013, no-show after break, illness, dismissal,
    terminal hardware failure forcing relocation — a Shift Manager (role
    `manager`) or Owner/Admin (role `admin`) MAY execute a `shift.forced_close`
    action that closes the shift on the cashier's behalf. The forced close MUST:
    (a) preserve blind-close — the manager MUST NOT be shown a surface where they
    enter a counted total *as the cashier*; the cashier's `declared_count` field
    remains explicitly null and is recorded as such, distinct from a count of
    zero and distinct from a matched count;
    (b) record both identities — the audit record carries the absent cashier as
    `shift_owner` (the original opener) and the executing manager/admin as
    `forced_close_actor`, alongside the standard FR-025 attributes (timestamp,
    originating terminal, action category);
    (c) carry a forced-close reason category at minimum drawn from a fixed set —
    e.g. `takeover_supersession`, `cashier_no_show`, `cashier_illness`,
    `terminal_failure`, `other` — recorded as a separate field, not free text;
    free-text annotations MAY exist for support but MUST NOT be used as the
    structural reason field;
    (d) be reachable only from a manager/admin surface, never from a cashier
    surface; the existence of "this terminal has a stuck shift owned by another
    cashier" is itself manager-only information and MUST NOT appear on any
    cashier-reachable surface.
  - A `shift.forced_close` MUST NOT silently consume a takeover. The takeover
    audit record (`operator.session.takeover` under FR-013/FR-026) and the
    forced-close audit record are *separate* records with *separate* timestamps
    and *separate* originating terminals; they are linked by the absent
    cashier's identity but neither implies the other.
  - The blind-close rule (FR-021) applies to forced close as strictly as it does
    to normal close: at no point — before, during, or after the forced close — is
    the absent cashier permitted to see expected totals, variance, shortage, or
    overage on any future cashier-reachable surface, including any "your last
    shift was closed for you" notification a future feature might introduce.

#### FR-Audit attribution

- **FR-025**: Every sensitive action introduced by future features MUST persist an
  audit record carrying, at minimum: (a) acting operator identity, (b) shift identity,
  (c) originating terminal, (d) timestamp, (e) action category, (f) where the action
  required supervisor override, the approving supervisor's identity. Records missing
  any of (a)–(e) MUST be rejected at the action boundary; partial records MUST NOT
  persist.
- **FR-026**: The catalogue of sensitive actions covered by FR-025 MUST include, at a
  minimum: refunds, voids, price overrides, discount overrides above a threshold,
  drawer kicks outside a sale, receipt reprints, shift opens (`shift.open`), shift
  closes (`shift.close` — cashier-executed, normal path), shift forced closes
  (`shift.forced_close` — manager- or admin-executed under FR-024 when the opening
  cashier cannot close), shift reviews, supervisor approvals, and operator-session
  takeovers (`operator.session.takeover`, recorded under FR-013 when an operator
  confirms a takeover on a second terminal). `shift.close` and `shift.forced_close`
  are *distinct* action categories and MUST NOT be conflated; a `shift.forced_close`
  carries the additional `shift_owner` and `forced_close_actor` attribution fields
  defined in FR-024, plus the structured forced-close reason. Future features MAY
  extend the catalogue but MUST NOT shrink it.
- **FR-027**: Audit records MUST NOT contain raw cardholder data, raw payment-
  instrument data, full PII beyond what is required to identify the operator and shift,
  or any credential fragment. (Aligns with constitution P6, P7.)
- **FR-028**: Audit records MUST be append-only at the rule level. Future features
  MUST NOT introduce edit-in-place or delete operations on audit records; corrections
  MUST be expressed as new compensating records (aligns with constitution P4).
- **FR-029**: The audit attribution rules MUST be visible to support staff via a
  manager-or-admin-reachable surface in a future feature; cashiers MUST NOT have any
  reachable surface that exposes the audit log.

#### FR-Privacy & redaction

- **FR-030**: Operator credentials (any factor), session tokens, and any data derived
  from them MUST NOT appear in application logs, support bundles, crash reports, or
  any artifact that may leave the device. (Aligns with P7, P11.)
- **FR-031**: Operator personal data beyond display name and role MUST NOT cross the
  preload bridge into the renderer. Sensitive operator-level fields (email, phone,
  password hash, PIN material) MUST NOT be addressable from the renderer at all.
  (Aligns with P8.)
- **FR-032**: The shell MUST NOT log the active operator's identity in places it is
  not strictly required (e.g., generic UI lifecycle logs); when operator identity is
  logged for support purposes, it MUST be a stable opaque reference rather than a
  human-readable identifier.

#### FR-Workflow lesson (early visual direction)

- **FR-033**: Every UI-bearing feature that follows this one MUST schedule an *early
  visual direction* milestone in its plan, between `/speckit-plan` and the first
  implementation slice. The visual-direction milestone MUST produce reviewed visual
  artifacts (mocks, contact sheet, or equivalent) for the surfaces the feature
  introduces, and the first implementation slice MUST NOT be merged before that review
  is complete.
- **FR-034**: The visual-direction artifacts produced under FR-033 MUST be reviewed for
  alignment with 003's POS UI Shell decisions (density, navigation rail behaviour,
  connection-state visuals, design tokens) before implementation begins.
- **FR-035**: After each UI implementation slice, a screenshot or contact-sheet review
  MUST be performed against the visual-direction artifacts. The final polish slice
  MUST be small (constitution P13 alignment).

### Non-Functional Requirements

- **NFR-001 (security boundary preservation)**: This feature MUST NOT weaken any
  security boundary established by 001 (`contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, no upward-of-bridge IPC, money-as-integer
  module). Any future implementation slice for 004 MUST preserve these.
- **NFR-002 (PII / credentials never in logs)**: Logs, support bundles, crash reports,
  and any operator-attributable diagnostic surface MUST NOT contain operator
  credentials, session tokens, full PII, or cardholder data of any kind.
- **NFR-003 (minimum-disclosure error messages)**: User-visible authentication error
  messages MUST NOT distinguish between "account does not exist", "wrong credential",
  "tenant/branch mismatch", "account disabled", or "rate-limited". A single generic
  message variant per outcome family is required.
- **NFR-004 (deterministic role boundary)**: Given an operator role, the set of
  reachable surfaces and the set of returnable information MUST be deterministic and
  not influenced by client-side state (theme, density, viewport, feature flags).
- **NFR-005 (touch-target floor)**: Sign-in input affordances and operator-switch
  affordances MUST honour the 44 × 44 CSS-pixel minimum touch target inherited from
  003 NFR-5 / constitution Hardware Matrix.
- **NFR-006 (sign-in latency)**: On the standard hardware matrix and a healthy network,
  successful sign-in MUST complete within 5 seconds end-to-end (input submitted →
  shell transitions to operator-bound landing surface).
- **NFR-007 (sign-out latency)**: Explicit sign-out MUST return the shell to the
  Sign-In surface within 1 second.
- **NFR-008 (audit completeness)**: At the rule level, no sensitive action MAY persist
  if any of the five mandatory attribution attributes is missing (FR-025).
- **NFR-009 (visibility consistency across reloads)**: The role boundary MUST hold
  identically across initial sign-in, route restoration, deep-link navigation, page
  refresh, and tab restoration. A privileged surface MUST NOT be reachable via any of
  these paths for an unauthorised role.
- **NFR-010 (no offline auth promise)**: This feature does not promise offline operator
  authentication. If offline sign-in is required by a downstream feature, it MUST be
  designed and clarified there; this feature does not pre-commit to an offline auth
  surface.
- **NFR-011 (offline behaviour — fail-closed for new sign-in)**: 004 fails *closed*
  for any new operator sign-in attempt while offline (no Clerk / backend
  connectivity). The complete offline-behaviour rules are:
  - **New sign-in is unavailable while offline.** Manager / Admin sign-in
    requires Clerk reachability; the Sign-In surface refuses with the generic
    `no_connection` failure variant per NFR-003 / PR-2 ("No connection. Please
    check the network and try again.") and creates no operator session.
  - **Cashier PIN unlock alone is not a sign-in.** A successful local PIN
    verification while offline MUST NOT create an operator session and MUST NOT
    transition the shell to the operator-bound landing surface. The cashier
    PIN is a *local terminal unlock factor* (AD-2); it is not, on its own, an
    authentication path. The Clerk-anchored cashier identity validation step
    that follows the PIN unlock requires connectivity.
  - **Cashier takeover detection is unavailable while offline.** Endpoint 6
    (`GET /v1/operators/active-session`) cannot be checked offline; therefore
    the cashier sign-in path's takeover-detection step cannot complete. The
    Sign-In surface refuses with `no_connection` rather than risk a duplicate
    session per FR-013.
  - **Existing already-signed-in local sessions MAY remain visible.** An
    operator who was already signed in before connectivity dropped continues
    to see the operator-bound shell; the role-indicator slot continues to
    display their identity. However:
    - **Backend-dependent actions (sales, payments, audit-event sync,
      future features) MUST surface the existing `no_connection` /
      `degraded` connection-state visual** per 003's four-state model;
      they MUST NOT optimistically claim success (P2 — no fake success
      states).
    - **Cashier-Forbidden Information catalogue items (FR-015) remain
      cashier-forbidden offline.** The role boundary holds offline as
      strictly as it holds online (NFR-004 — deterministic role boundary).
      A cashier surface that is forbidden online MUST NOT become reachable
      offline by way of error-state fallback or local-cached data.
  - **Local sign-out and inactivity auto-sign-out (FR-008 / FR-009) MAY
    still terminate the current operator session offline.** These are local
    operations; they update the local `operator_sessions` row's `end_at` /
    `end_cause` and queue any consequent audit events for sync per the local
    outbox pattern (P3 — no silent data loss).
  - **Full offline operator sign-in is deferred to a future offline-auth
    feature.** 004 makes no commitment about how offline cashier or
    manager/admin sign-in would work; that's the scope of a later, explicitly
    designed offline-auth feature with its own spec, plan, and approval path.

### Key Entities *(behavioural; not implementation)*

- **Operator**: A human user authorised to operate POS-Pulse. Carries: stable identity,
  display name, role (`cashier` | `manager` | `admin`), tenant, authorised branch set,
  account-enabled flag. Personal contact attributes (email, phone) are NOT addressable
  from the renderer.
- **Operator Session**: A bound link between an Operator and a paired Terminal Session.
  Carries: operator identity, role, tenant, branch, originating terminal, start
  timestamp, end timestamp (on termination), end-cause (sign-out, inactivity, terminal
  termination, account disabled). Lifetime: from successful sign-in to first
  termination event. An operator session never outlives its terminal session.
- **Terminal Session**: Established by 002-terminal-pairing. Re-stated here only as a
  dependency: an Operator Session MUST attach to an active Terminal Session.
- **Shift**: A future entity owned by a later feature (shift management). Re-stated
  here as the audit-attribution container required by FR-025. This feature commits to
  the *existence* and *attribution role* of a Shift; mechanics, lifecycle, and money
  math are out of scope here. **Behavioural commitments locked by 004**: a shift is
  *operator-bound* (carries the opening cashier's identity for its entire lifetime;
  FR-024); it has at minimum the lifecycle states `open`, `closed_normal`, and
  `closed_forced`; on `closed_forced` the opening cashier's `declared_count`
  attribute is recorded as the explicit state **absent** (distinct from a numeric
  zero and distinct from "matched the expected total"); future variance and
  reconciliation logic in a later feature MUST treat `declared_count = absent`
  as a distinct case in its own right rather than coercing it to zero or to a
  matched outcome.
- **Sensitive Action (audit record)**: A behavioural entity that future features will
  produce. Carries: acting operator identity, shift identity, originating terminal,
  timestamp, action category, optional approving supervisor identity. Append-only at
  the rule level; never edit-in-place, never delete. Specific action categories
  introduced by 004 carry additional structural attribution fields:
  - `operator.session.takeover` — adds a reference to the prior terminal whose
    session was superseded; acting operator = the operator who confirmed takeover
    on the new terminal.
  - `shift.forced_close` — adds `shift_owner` (the absent / opening cashier's
    identity), `forced_close_actor` (the executing manager's or admin's identity),
    and a `forced_close_reason` drawn from a fixed enumerated set
    (`takeover_supersession`, `cashier_no_show`, `cashier_illness`,
    `terminal_failure`, `other`); free-text annotations MAY exist alongside but
    MUST NOT replace the structural reason field.
  A `shift.forced_close` and an `operator.session.takeover` are *never* merged
  into a single audit record even when a takeover is the proximate cause of a
  stuck shift; they are linked only by the absent cashier's identity.
- **Role**: Closed enumerated set with exactly three entries; business name and
  machine identifier MUST stay in 1:1 correspondence (FR-002):

  | Machine identifier | Business name        | Scope of authority                                                         |
  |:-------------------|:---------------------|:---------------------------------------------------------------------------|
  | `cashier`          | Cashier / Operator   | Sales, cart, drawer actions during sale, shift open/close (own shift only).|
  | `manager`          | Shift Manager        | Cashier surfaces + shift review, expected-cash, variance, forced close, supervisor overrides, manager-only reports/KPIs (branch-scoped). |
  | `admin`            | Owner / Admin        | Manager surfaces + tenant-wide configuration (configuration surfaces are out of scope for 004 beyond reserving their existence). |

  The Role entity defines the reachable-surface set and the returnable-information
  set for an operator session. 004 does NOT introduce a custom permission engine
  or capability registry (FR-002a); future role extensibility (multi-role,
  delegation, temporary elevation, per-action grants) is a separate feature.
- **Cashier-Forbidden Information catalogue**: Normative list (FR-015): shift totals,
  expected drawer cash, expected change-fund, declared cash count, shortage, overage,
  variance, reports, KPIs, manager-review data, audit log surfaces, admin surfaces,
  other operators' shift data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (sign-in usability)**: 95 % of sign-in attempts by trained cashiers
  complete in under 10 seconds end-to-end (hand reaches keypad → role-appropriate
  landing surface visible) on the standard hardware matrix.
- **SC-002 (sign-out responsiveness)**: 99 % of explicit sign-out requests return
  the shell to the Sign-In surface in under 1 second; the worst-case observed latency
  during acceptance review is under 2 seconds.
- **SC-003 (role boundary correctness)**: In a structured walkthrough, a reviewer
  signed in as a cashier reaches *zero* surfaces from the Cashier-Forbidden
  Information catalogue across at least 20 attempted access paths (navigation,
  deep-link, route restore, refresh, search/quick-action, tab restoration, deeplink
  via paired URL).
- **SC-004 (blind-close compliance)**: In a structured walkthrough of every cashier-
  reachable surface, the expected drawer cash, expected change-fund, system-computed
  variance, shortage, and overage are *never* displayed; a reviewer cannot infer any
  of the five from any cashier surface, even indirectly.
- **SC-005 (audit attribution coverage)**: For each of the at least 10 sensitive-action
  categories enumerated in FR-026, a tabletop review confirms that the audit record
  rules require all five mandatory attributes; zero categories are missing any
  attribute.
- **SC-006 (credential-redaction completeness)**: A simulated support bundle
  generated during acceptance review contains zero occurrences of operator
  credentials, session tokens, or any credential fragment, across all log streams and
  diagnostic outputs.
- **SC-007 (error-message minimum-disclosure)**: Across the five sign-in failure modes
  (invalid credential, account does not exist, tenant/branch mismatch, account
  disabled, rate-limited), the user-visible error UI presents at most two generic
  variants ("credentials not recognised", "too many attempts — wait a moment"). Zero
  variants disclose which mode applied.
- **SC-008 (visibility persistence across reloads)**: Across at least 5 reload paths
  (initial sign-in, hard refresh, route restore, deep-link, tab restore), the role
  boundary holds without exception; zero paths leak a privileged surface.
- **SC-009 (workflow lesson adoption)**: Every UI-bearing feature merged after 004
  shows evidence in its plan of an early-visual-direction milestone scheduled between
  `/speckit-plan` and the first implementation slice; review of the next two
  UI-bearing features finds 100 % adoption.
- **SC-010 (no implementation drift)**: Acceptance review of the 004 spec confirms
  that this feature contributes zero source files, zero migrations, zero OpenAPI
  changes, zero IPC channels, and zero new packages. The spec's sole artifacts are
  `specs/004-operator-session/spec.md` and its checklist.

## Out of Scope *(this feature)*

The following are explicitly out of scope for **004-operator-session** and MUST NOT be
introduced by this feature's spec, plan, tasks, or implementation slices. They are
deferred to later features.

- Implementation of any kind (no source files, no IPC, no preload changes, no
  main-process changes).
- Package additions, removals, or `package.json` modifications.
- Database migrations or schema changes.
- OpenAPI schema or backend contract changes.
- Backend / API implementation.
- Sales, cart, line-item, or basket business logic.
- Payment, tender, or money-math logic of any kind (deferred to 005-checkout-payments).
- Receipt printing, receipt rendering, or receipt content rules.
- Inventory mutation, stock movement, batch/lot or FEFO logic.
- Reports, KPIs, dashboards, analytics surfaces, manager-review *implementation*.
- Shift financial calculations: drawer math, expected total, variance computation,
  shortage/overage arithmetic. This feature only commits to the *visibility rules* and
  the *audit-attribution rules* governing those future calculations.
- Admin-side pairing UI, terminal-management surfaces beyond what 002 already ships.
- Self-service unpair, terminal release, or re-pair UI for cashiers.
- Offline operator authentication or any offline credential cache.
- Multi-role accounts, role delegation, or temporary supervisor elevation flows
  (beyond the supervisor-override attribution rule recorded in FR-025).
- Custom permission engines, attribute-based access control (ABAC), capability
  registries, per-action permission catalogues, or any role catalogue beyond the
  closed three-entry set defined by FR-002. Future role extensibility is the
  scope of a later, dedicated Spec Kit feature; 004 MUST NOT pre-build for it.
- Biometric authentication, hardware-token authentication, or smart-card sign-in.
- Cashier-self-service password / PIN reset; password / PIN rotation policy.
- Auto-update wiring, packaging, distribution.
- Any change to the visual-only `syncing` connection state introduced by 003.
- Any weakening of the existing logging, redaction, or security boundaries from
  001 / 002 / 003.

## Assumptions

- **A1 (credential factor — resolved 2026-05-05)**: Cashiers sign in with a roster
  pick (their display name from the branch operator roster) followed by a 4–6 digit
  PIN; managers and admins sign in with a password. The roster pick disambiguates
  cashier identity, so cashier PIN uniqueness within a branch is NOT required. See
  Clarifications session 2026-05-05 and FR-006 for the normative wording.
- **A2 (concurrent same-operator — resolved 2026-05-05)**: An operator may hold
  exactly one active session at a time, branch-wide. Sign-in on a second terminal
  triggers an explicit takeover prompt; on confirmation the prior session is
  terminated with end-cause `superseded_by_takeover` and the prior terminal returns
  to the Sign-In surface within 30 seconds. The takeover itself is an audit-
  attributable sensitive action under FR-026. See Clarifications session 2026-05-05
  and FR-013 for the normative wording.
- **A3 (inactivity timeout default)**: Default auto-sign-out duration is 15 minutes of
  no genuine operator interaction. Final value to be set during `/speckit-clarify` if
  the team prefers a different default; pharmacy operations input may inform this.
- **A4 (cashier handover within an open shift — resolved 2026-05-05)**: Shifts are
  operator-bound and **non-transferable**. The cashier who opened a shift is the
  only cashier who may close it via the normal cashier-close path. A different
  cashier signing in on the same terminal always opens a new shift; they MUST NOT
  view, resume, or close another cashier's still-open shift. When the opening
  cashier becomes unable to close (takeover supersession under FR-013, no-show,
  illness, terminal failure, dismissal), a Shift Manager (`manager`) or Owner /
  Admin (`admin`) MAY execute a `shift.forced_close` action that audits both the
  absent cashier (as `shift_owner`) and the manager / admin (as
  `forced_close_actor`); the forced close preserves blind-close discipline and
  records the cashier's `declared_count` as the explicit state **absent** —
  distinct from zero and distinct from matched. See Clarifications session
  2026-05-05, FR-021, FR-024, FR-026, US3-AS5, the takeover-stranded-shift edge
  case, and the Key Entities updates for `Shift` and `Sensitive Action`.
- **A5 (audit storage location)**: Audit records will live alongside other persisted
  POS data in the local SQLite store (per 001 + constitution Tech Stack), forwarded to
  backend per the existing redaction rules. This feature does not commit to schema or
  fields beyond the five mandatory attribution attributes; the rest is decided in the
  consuming feature's plan.
- **A6 (offline auth deferred)**: The spec does *not* assume offline operator sign-in.
  Offline behaviour for operator auth is deferred to a later feature; the current
  spec's `[NEEDS CLARIFICATION: offline operator sign-in policy]` marker is a placeholder
  for that future scope decision and does not block planning.
- **A7 (Clerk integration deferred)**: Constitution Principle VIII names Clerk as the
  IdP. Clerk integration is *not* required by 004; the spec is written so that whichever
  identity provider lands later (Clerk, an internal credential store, or a hybrid)
  satisfies the operator-identity rules. The plan phase will pick.
- **A8 (test toolchain inheritance)**: Vitest, Testing Library, and `expectNoAxeViolations`
  are inherited from 001/003; this spec does not introduce new test infrastructure.
- **A9 (visual direction discipline as default)**: After 003's lesson, every UI-bearing
  spec assumes the early-visual-direction milestone (FR-033) as default behaviour, not
  a special opt-in.

## Constitutional Alignment

Each principle below either constrains 004 directly or is preserved by 004's behaviour.
This section is informational for `/speckit-plan` and the Constitution Check.

- **P4 (auditability, non-destructive correction)** — FR-025 / FR-028 (append-only,
  five mandatory attributes, compensating records).
- **P6 (no raw cardholder data by default)** — FR-027.
- **P7 (secrets never reach renderer or logs)** — FR-030 / FR-031 / NFR-002.
- **P8 (Electron security boundary)** — NFR-001 / FR-031.
- **P10 (operator accountability for sensitive actions)** — FR-025 / FR-026 / FR-029.
  This feature is the canonical landing site for P10.
- **P11 (supportability without secret leakage)** — FR-030 / FR-032 / SC-006.
- **P12 (Spec Kit artifacts are source of truth)** — this spec is the source of truth
  for the operator/session boundary; conflicting future specs MUST defer to this one
  unless a constitutional amendment supersedes it.
- **P13 (small, scoped implementation PRs)** — FR-035 (final polish small).
- **P14 (accessibility & cashier ergonomics)** — NFR-005, FR-033 / FR-034 inherits
  003's a11y commitments.
- **P16 (feature scope discipline)** — the Out-of-Scope section is the explicit
  scope bound for 004.
- **P17 (privacy and tenant isolation)** — FR-003, NFR-003.
- **Core Principle II (Electron security)** — NFR-001 (preservation).
- **Core Principle III (auditability)** — FR-025 / FR-028.

## Dependencies

- **001-foundation** — secrets store, money module, log redaction, baseline
  Electron security posture.
- **002-terminal-pairing** — terminal session, device token, paired-state
  precondition for the Sign-In surface.
- **003-pos-ui-shell** — design tokens, navigation rail, role-indicator slot, status
  bar location, density and touch-target floor. The Sign-In surface and operator
  indicator land in slots already reserved by 003.

## Open Questions / NEEDS CLARIFICATION

These are the genuinely unresolved decisions for `/speckit-clarify`. The spec is
complete with reasonable defaults documented in Assumptions; these markers exist only
where multiple defensible answers materially change the spec.

1. ✅ **Resolved 2026-05-05** — Operator credential factor: cashier roster-pick + PIN
   (4–6 digits); manager/admin password. See Clarifications session 2026-05-05 and
   FR-006.

2. ✅ **Resolved 2026-05-05** — Same-operator concurrent sign-in policy: single
   active session per operator branch-wide; explicit takeover prompt on the new
   terminal; prior session ends with cause `superseded_by_takeover`; takeover is
   itself an audited sensitive action (`operator.session.takeover`). See
   Clarifications session 2026-05-05, FR-013, FR-026, US1-AS6, and the new
   takeover edge cases.

3. ✅ **Resolved 2026-05-05** — Cashier handover within an open shift: shifts are
   operator-bound and non-transferable. The opening cashier alone may close their
   shift via the normal path; when they cannot, a Shift Manager or Owner / Admin
   executes a distinct `shift.forced_close` action that records both identities,
   preserves blind close, and marks the cashier's declared count as absent (a
   distinct state from zero or matched). See Clarifications session 2026-05-05,
   FR-021, FR-024, FR-026, US3-AS5, the takeover-stranded-shift / cashier-returns /
   forced-close-from-different-terminal edge cases, and the Key Entities updates
   for `Shift` and `Sensitive Action`.

(The original prompt also lists "offline operator sign-in policy"; per A6 it is
*deferred*, not *parked*, and therefore does not consume one of the three NEEDS
CLARIFICATION slots.)

**All three NEEDS CLARIFICATION markers are now resolved.** This spec is ready
for `/speckit-plan`.

---

**End of specification.** Next phase: `/speckit-clarify` to resolve the three markers
above, then `/speckit-plan`. Any UI-bearing portion of the plan MUST schedule an
early-visual-direction milestone per FR-033.
