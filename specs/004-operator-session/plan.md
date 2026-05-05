# Implementation Plan: Operator & Session

**Feature ID:** 004-operator-session
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.1
**Created:** 2026-05-05
**Last Updated:** 2026-05-06 (§A1 cleared via PR #39, merge SHA 7ae337b, Constitution v1.5.1; §A2 backend coordination remains outstanding)
**Constitution version pinned:** v1.5.1
**Branch:** `004-operator-session`

---

## Summary

Feature 004 introduces the operator/session/visibility layer that every later POS surface
(sales, cart, payments, refunds, drawer kicks, reports, shift reconciliation) depends on.
The spec phase locked the *behavioural contract* — operator identity, role catalogue
(`cashier` / `manager` / `admin`), single-active-session enforcement via takeover, blind
shift close, audit attribution. This plan turns those rules into a concrete implementation
shape.

**Identity-model framing (load-bearing).** Clerk remains the sole human identity provider
(Constitution Principle VIII). Every operator — cashier, manager, admin — has a stable
Clerk-backed identity. Manager and admin authentication is Clerk/password-backed end-to-
end. Cashier authentication is *also* anchored to a Clerk-backed identity, but is
unlocked at the terminal by a **local terminal unlock factor** (a 4–6 digit PIN per
spec FR-006). The PIN does not mint backend identity tokens, does not act as a second
identity provider, does not become an alternate source of truth for human identity, and
its compromise must not compromise backend-facing identity. Audit attribution uses the
stable Clerk-backed operator identity, never the PIN record. **This local-unlock-factor
approach is gated on explicit approval (Approval Gate §A1) before any migration, OpenAPI,
IPC/preload, backend, or SecretStore/`safeStorage` work begins.** Until §A1 clears, only
Slice 0 (visual direction) and Slices 1–2 (manager/admin sign-in via Clerk + bridge-
surface security review) may proceed.

The plan is intentionally restrained: **no source files are written**, **no migrations
are authored**, **no OpenAPI is mutated**, **no packages are installed** by `/speckit-plan`
itself.

## Technical Context

This plan commits to a renderer + main-process feature spanning the existing Electron
foundation laid by 001/002/003. Unlike 003 (UI-only), 004 *must* eventually touch the
bridge surface, the SecretStore (for the local PIN factor data — gated on §A1), and the
local SQLite store (for `audit_events` and operator-session state). The bridge expansion
is the feature's whole purpose and is performed under explicit security review (Slice
2's gate), not smuggled in as incidental work (Constitution P8).

| Area | Choice | Source |
|:--|:--|:--|
| Runtime / packaging | Electron `^40.9` Windows 10/11 x64 | constitution v1.5.0 / plan 001 |
| Renderer | React `^19.2` + Vite `^8.0` + TypeScript `^5.9` strict | constitution v1.5.0 / plan 001 |
| Styling | Tailwind `^4.2` (CSS-first) — design tokens delivered as **CSS variables** + `@theme` block; consumed via `src/renderer/ui/tokens/` (003 module) | 003 plan §Technical Context / spec FR-034 |
| Routing | Existing `react-router-dom@7`. New top-level `/sign-in` route between the pairing-decision boot gate (002) and the `/app/*` shell (003). Operator-bound routes guarded by an `<OperatorRouteGuard>` component (renderer-side, **secondary** UX defence — see AD-1). | research §2 |
| Renderer state (operator session, takeover, sign-in form) | Existing `zustand@4`. New slice `operatorSessionStore`: 5-state finite-state machine (`signedOut` / `signingIn` / `takeoverPrompt` / `signedIn` / `signingOut`). | research §3 |
| Server-state hooks | Existing `@tanstack/react-query@5` for the read-only roster fetch on the cashier sign-in surface (after §A1) and for the manager/admin sign-in mutation. | research §3 |
| Component primitives | Reuse 003's `src/renderer/ui/` inventory (Button, Input, Card, Dialog, Toast, StatusBanner). New under `src/renderer/ui/operator/`: `RosterList`, `PinPad`, `TakeoverPrompt`, `OperatorBadge` (slots into 003's role-indicator), `ForcedCloseSurface`. | research §4 |
| Density / touch targets | Inherit `comfortable` density and the 44 × 44 CSS px floor from 003. PIN pad MUST honour the floor. | spec NFR-005 / 003 NFR-5 |
| Connection-state model | Inherit 003's four states (`online`, `degraded`, `offline`, `syncing`). 004 introduces no new connection states. | spec §Dependencies |
| **Identity model** | **Clerk is the sole human identity provider** (Principle VIII; preserved verbatim). Every operator's stable identity is a Clerk user. Manager / admin authentication: Clerk/password end-to-end. **Cashier authentication: Clerk-backed identity unlocked by a local terminal unlock factor (4–6 digit PIN). The PIN proves "the person currently in front of this paired terminal may unlock the already-known cashier identity for an operator session"; it does not mint backend identity tokens, does not act as an IdP, and is not consulted by any backend endpoint.** Backend tokens for the operator session derive from the same Clerk JWT pipeline 002's pairing flow already establishes for the device token. | research §1 / AD-2 / Approval Gate §A1 |
| Bridge surface (NEW) | `src/shared/bridge-api.ts` extended with the `operator.*` namespace defined in [./contracts/bridge-api.md](./contracts/bridge-api.md). Bridge enforces FR-019 (information-layer role boundary) — see AD-1. **Bridge expansion is gated on §A1; only the manager/admin Clerk-driven subset may proceed before §A1 clears.** | research §5 / contracts/bridge-api.md |
| Local persistence | NEW SQLite tables: `audit_events` (append-only, P4-compliant, P5 client-UUID idempotency); `operator_sessions` (current + historical); `cashier_pin_records` (HASHED PIN material — local unlock factor only — sealed via `safeStorage`, scoped per-terminal — see PR-4 below). **No migration is authored by `/speckit-plan`.** All migration work is gated on §A1 (overall approval) and §A3 (per-table migration approval). | data-model.md |
| Tests | Vitest only (constitution VI). Coverage gate **≥ 90 %** on `src/renderer/ui/operator/`, **≥ 95 %** on the bridge-API role-enforcement module and the PIN-verifier module (both load-bearing trust-boundary code; equivalent floor to `Money` and the offline queue). Per-surface axe rule pass on default / loading / error variants (P14). | Test Strategy section |
| CI | No workflow changes; the existing `codegen:verify → typecheck → lint → test → package:dir` pipeline gates this feature. The codegen step gates regeneration of `src/shared/api-types.ts` after any new backend OpenAPI endpoint lands (Approval Gate §A2). | research §6 |

**No `NEEDS CLARIFICATION` items remain at the spec layer.** All three questions
were resolved on 2026-05-05; the role-naming addendum is recorded; the manager-
attributable forced-close path is codified in FR-024. Deferred items per spec
Assumptions: A6 (offline operator sign-in policy — owned by a future feature), and
the exact identity-model split now governed by Approval Gate §A1 below.

### Hard Non-Implementation Boundaries

004 inherits and extends 003's "Hard Non-Implementation Boundaries" pattern. Within
this plan, the following remain explicitly out of scope and any task that drifts into
them MUST be filed as a separate feature, not folded into 004:

- **No sales / cart / receipts / payments business logic.** Operator-bound routes
  remain placeholder shells from 003 (with role-gating overlaid).
- **No tender, change, or money math.** The reserved `tender.*` and `totals.*` slots
  from 003 stay layout-only.
- **No inventory mutation, no stock movement, no FEFO logic.**
- **No reports, KPIs, dashboards, analytics surfaces, or manager-review
  *implementation*.** Manager-only routes resolve to placeholder surfaces that
  *exist* (so cashiers cannot reach them) but *render* nothing of substance until
  later features.
- **No shift mechanics or money math** beyond the rules locked in spec FR-021 / FR-024.
  `audit_events` records `shift.open`, `shift.close`, `shift.forced_close` *categories*
  but the shift entity's drawer-math, expected-total, variance, shortage, and overage
  fields belong to a future shift-management feature.
- **No admin-side pairing UI**, **no self-service unpair**, **no cashier
  password/PIN reset surface authored by the cashier themselves** (cashier-self-
  service PIN reset is out of scope; manager/admin-attributable PIN reset is the
  in-scope flow under PR-5), **no biometric/smart-card sign-in**, **no offline
  operator authentication**, **no second identity provider of any kind**. All
  deferred to later, explicitly scoped features. **Offline behaviour for 004
  is fail-closed for new sign-in** — see spec NFR-011 for the normative rule
  set; the spec covers manager/admin sign-in unavailability, cashier PIN
  unlock not constituting a new offline session, takeover-detection
  unavailability, existing-session continuation rules, and the deferral of
  full offline operator sign-in to a future offline-auth feature.
- **No new IPC channel beyond the `operator.*` namespace defined in
  contracts/bridge-api.md.** Other channels remain frozen.
- **No weakening of 001/002/003 security boundaries** (`contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, no upward-of-bridge IPC, money-as-integer,
  Sentry/log redaction). Slice 2's security-review gate enforces this affirmatively.
- **No change to 003's `syncing` visual-only state semantics.**
- **No use of the local PIN factor for any purpose other than unlocking an
  already-Clerk-anchored cashier identity on this paired terminal.** The PIN is
  not consulted for backend authentication, not used as an idempotency factor,
  not used as an audit-attribution key, and not used as evidence of identity in
  any context other than the local unlock at sign-in time.

## Architectural Decisions

These are the load-bearing choices this plan commits to. Each cites the requirement
that forces it and the alternatives rejected.

### AD-1. Role boundary is enforced at the **bridge-API surface** (primary), with renderer route guards as **secondary UX defence** only

**Choice.** Every bridge-API function exposed by the new `operator.*` namespace
(and every future operator-aware bridge function in 005+) self-gates against the
*main-process-held* `currentSession.role`. A bridge call from a cashier surface
that would return Cashier-Forbidden Information catalogue data (FR-015) returns a
generic refusal — not the data filtered, not the data with a flag, not an error
that distinguishes "exists but you're not allowed" from "doesn't exist". Renderer
route guards (`<OperatorRouteGuard role="manager" />`) are a *secondary*
UX-only layer that prevents the cashier UI from *rendering surfaces* it
shouldn't show; they do NOT replace the bridge gate, MUST NOT be the only barrier
between a cashier and forbidden information, and MUST NOT be relied on for
trust-boundary enforcement.

**Why.** FR-019 is normative: "Role-gated visibility MUST be enforced on the
*information* layer, not only the navigation layer." The renderer is untrusted by
construction (Constitution Principle III); a route guard in untrusted code cannot
satisfy a trust boundary. The main process *is* the trust boundary. Putting the
gate at the bridge — the seam between trusted and untrusted — is the architecturally
honest answer.

**Alternative rejected: Query-builder enforcement.** A SQLite read helper that
injects role-aware `WHERE` filters and refuses generically on mismatch is also
defensible. Rejected because (a) it pushes the gate one layer further from the
trust boundary; (b) it conflates "this row is not visible to this role" with
"this operation is not allowed for this role" — the second is the rule we want;
(c) several spec rules (FR-016: refuse a *request*; FR-013: enforce takeover
before session creation; FR-024: forced-close reachable only from manager
surface) are not query-shaped.

**Alternative rejected: Renderer route guards as primary.** Rejected because a
forced URL or a deep-link bypasses any renderer-only gate. The user explicitly
requires bridge-surface enforcement as primary and route guards as secondary
UX defence; this plan honours that.

### AD-2. Cashier PIN is a **local terminal unlock factor**, not an identity provider

**Choice.** Clerk remains the sole human identity provider (Principle VIII,
preserved). Every cashier, manager, and admin is a Clerk user with a stable
Clerk-backed identity. **Manager and admin authentication is Clerk/password-
backed end-to-end.** Cashier authentication anchors to the same Clerk identity,
but the *unlock* of that identity at a paired terminal happens via a local 4–6
digit PIN. The PIN:

- proves only that the person currently in front of *this paired terminal* may
  unlock an *already-known* cashier identity that was provisioned for this
  terminal/branch by an admin during cashier onboarding;
- does **not** mint backend identity tokens by itself — backend tokens for the
  operator session derive from the same Clerk-anchored pipeline that 002's
  pairing flow already establishes;
- is **not** an identity provider, is **not** consulted by any backend endpoint,
  and is **not** an alternate user database;
- is **not** the audit-attribution key — every audit event's `acting_operator`
  field references the stable Clerk-backed cashier identity, not the PIN record;
- is stored only locally, on the paired terminal, in a per-terminal-scoped
  hashed form (`cashier_pin_records`), sealed via `safeStorage` (001 secrets
  module), and is never transmitted off-device.

A successful PIN unlock causes the local `operatorSessionStore` to transition to
`signedIn` using the cached Clerk identity for that cashier. The cached Clerk
identity is established at cashier onboarding time (a manager/admin action that
provisions the cashier on the terminal's branch via Clerk + the backend, then
sets the initial PIN locally) and rotates on its own schedule (Clerk's own
session-token rotation, independent of the PIN).

**Why.** Q1 of `/speckit-clarify` locked the cashier UX as roster-pick + 4–6
digit PIN. A 4–6 digit PIN is below the entropy threshold most IdPs accept as a
primary credential, and the roster-pick surface (anonymous list of names visible
*before* authentication) contradicts standard OIDC redirect patterns. Rather
than build (or wait for) a Clerk custom-factor extension that re-models PINs as
a federated factor, this plan keeps the PIN entirely *local* to the terminal
and lets Clerk continue to do its actual job (identity provider) without
extension. The PIN's role is reduced to "unlock the cached identity", which is
a problem the constitution's existing 001 secrets module already solves.

**Why this preserves Principle VIII.** Principle VIII says "Clerk is the sole
IdP for humans; custom user databases are PROHIBITED." Under AD-2: every human
remains a Clerk user; the canonical user record is in Clerk; backend tokens are
Clerk-anchored. The local PIN store is *not* a user database — it does not
contain identity (it contains a per-terminal hashed unlock factor keyed by the
Clerk user ID). It does not adjudicate "who is this person?"; it adjudicates
"may this person, on this terminal, unlock the cashier identity already
established here?". The distinction is real and load-bearing for 004; the user
has explicitly affirmed this framing as the planning direction.

**This decision IS the body of Approval Gate §A1.** AD-2 is *not* silently
approved by the existence of this plan. The plan documents the framing,
alternatives, and risks; explicit approval (constitutional reaffirmation /
clarification, see §A1) is required before any migration, OpenAPI change,
IPC/preload change, backend change, SecretStore/`safeStorage` change, or
cashier-PIN storage/verification implementation begins.

**Alternative 1: Clerk-only password authentication for all roles.** Cashiers
sign in with a typed password instead of a PIN. Honours Principle VIII without
new local factors and without a §A1 gate. **Rejected as the planning direction
because** it overrides the spec's Q1 cashier UX (roster-pick + PIN) and slows
the cashier sign-in cadence on a touch terminal. **Retained as the fallback** if
§A1 is denied: the plan can be re-clarified to swap Q1's answer to "password for
everyone", and Slice 4 reduces to a UX swap on the cashier sign-in surface.

**Alternative 2 (THIS PLAN, gated on §A1): Clerk-backed manager/admin auth +
local terminal unlock factor for cashiers.** As described above. Smallest
delta to spec UX; smallest constitutional surface (PIN is non-IdP, non-user-
database). Requires explicit approval per §A1.

**Alternative 3: Fully Clerk-modelled cashier factor (deferred).** Adopt
Clerk's custom-factor extension or wait for it to mature; cashier PIN is
delivered through Clerk's own infrastructure (Clerk hashes server-side, Clerk
rate-limits, Clerk audits the unlock attempt). **Deferred** because the
extension's ergonomics for a 4–6 digit PIN + roster-pick UX are not yet
verified; introduces an SDK dependency and an OIDC-flow change that is heavier
than 004 needs. **Reserved as the long-term direction** — if Clerk's custom-
factor support stabilises, a future feature can migrate the local PIN factor
into Clerk without changing the spec's behavioural rules.

### AD-3. Audit events are append-only with client-generated UUIDs

**Choice.** The `audit_events` table is append-only at both the schema level
(`UPDATE` and `DELETE` are denied by trigger) and the rule level (FR-028). Every
audit event carries a client-generated UUID v4 (`event_id`) established at the
moment of intent — before the action that produces the event executes. The same
UUID is the idempotency key for backend sync of the audit event.

**Why.** Constitution P4 (Auditability and Non-Destructive Financial Correction)
mandates append-only event tables for money-bearing state. Constitution P5
(Idempotency for Retried Operations) mandates a client-generated UUID for any
retryable operation. Audit emission is retryable. The same UUID satisfies both.

**Audit attribution under AD-2.** Every audit event's `acting_operator` field
is the stable Clerk-backed operator identity, never the local PIN record's
internal id. The PIN unlock event itself MAY be recorded as a low-severity
diagnostic event (action category `operator.session.pin_unlock` —
manager/admin-readable only, never cashier-readable; subject to PR-1 redaction
of PIN values), but the *operator session it produces* attributes to the Clerk
identity from the moment of unlock onward.

### AD-4. Sign-In surface is a top-level route, not a modal over the shell

**Choice.** A new top-level route `/sign-in` mounts above 003's `/app/*` parent
route. The boot router resolves: pairing-decision (002) → if paired and no
operator session → `/sign-in` → if signed in → `/app/*`. Sign-out returns to
`/sign-in`, not to the shell.

**Why.** A modal-over-shell sign-in surface leaks shell-rendered information
(operator's prior name in the role indicator, partially-rendered manager-only
surfaces) during the brief moment between sign-out and modal-open. NFR-009
requires the role boundary to hold across "route restoration, deep-link
navigation, page refresh, tab restoration"; a top-level route makes that
trivially true.

## Local PIN security constraints (normative — gated on §A1)

If §A1 approves AD-2, the following six constraints become normative plan rules.
Each is citable in slice tasks and PR review checklists. If §A1 denies AD-2, all
six fall away (alternative 1 is adopted; cashier sign-in becomes Clerk/password
end-to-end, and the constraints below dissolve into the existing manager/admin
Clerk path).

### PR-1. PIN values MUST NEVER be logged or transmitted

PIN values MUST NOT appear in `pino` log lines, Sentry events, support bundles,
crash reports, IPC argument lists, error messages, the Vitest test snapshots,
or *any* artifact that could leave the device. The redaction list (Constitution
P11) MUST be extended in Slice 1 to include the PIN field name(s), and the
cross-process redaction smoke test (extending 002's) MUST verify zero
occurrences of PIN values across all log/diagnostic surfaces. PIN values MUST
NOT cross the preload bridge in plaintext; the cashier-side bridge call
`operator.signIn({ display_name, pin })` accepts the PIN as a transient
argument that is consumed by the main-process verifier and discarded.

### PR-2. PIN verification failures MUST use generic error messages

Every cashier-visible PIN failure ("wrong PIN", "no roster pick first", "rate-
limited", "disabled cashier", "tenant/branch mismatch on the cached identity")
MUST surface as the same single generic message — "credentials not recognised"
— with no factor-distinguishing variants. Exception: rate-limit / lockout (PR-3)
MAY surface a single additional generic variant — "too many attempts — wait a
moment before trying again" — without disclosing the lockout duration, whether
it is per-cashier or per-terminal, or which specific failure triggered the
lockout. This row is a strengthening of NFR-003 for the local-unlock surface.

### PR-3. Rate limiting and lockout for the local PIN factor

The local PIN verifier MUST implement the following lockout policy:

- **Threshold**: 5 consecutive PIN failures for a single cashier identity on a
  single terminal within a rolling 5-minute window triggers a lockout for that
  cashier identity on that terminal.
- **Lockout duration**: 5 minutes after the 5th failure. The timer is wall-
  clock; lockout state MUST persist across application restart and Windows
  user-profile lock/unlock (i.e., the lockout is a property of the local
  `cashier_pin_records` row, not in-memory).
- **Release paths**: (a) the timer expires; (b) a manager or admin executes a
  `cashier.pin.unlock` action on the same terminal (recorded as an audit event
  per PR-5).
- **No partial-information disclosure**: the lockout MUST NOT distinguish
  itself from a normal "credentials not recognised" message until the very
  moment a fresh PIN attempt is rejected; only then does the
  "too many attempts — wait a moment" message appear (per PR-2 exception).
- **Per-cashier-per-terminal**: lockout state is keyed by (cashier identity,
  terminal id). A cashier locked out on terminal A is NOT locked out on
  terminal B; conversely, a manager unlocking on terminal A does NOT release
  the cashier on terminal B.
- **Rate-limit MUST be enforced in the main process**, not the renderer; the
  renderer cannot be trusted to count failed attempts.

### PR-4. PIN records MUST be device/terminal scoped

The `cashier_pin_records` table is keyed by `(tenant_id, branch_id,
terminal_id, cashier_clerk_user_id)`. A PIN record provisioned on terminal A
is NOT visible, transferable, or usable on terminal B — even if the same
cashier is provisioned on both terminals (which they MAY be; each terminal
holds its own independent PIN record for that cashier identity). The
`safeStorage` seal MUST be applied per-record at write time. Reading the
`cashier_pin_records` rows on a different machine, or under a different
Windows user account on the same machine, MUST fail (constitution v1.3.0
DPAPI scoping is the existing mechanism). A stolen `cashier_pin_records`
table MUST NOT grant any backend-facing capability — only a local unlock on
the same Windows user profile of the same paired terminal.

### PR-5. PIN reset/recovery MUST be manager- or admin-attributable

Cashier-self-service PIN reset is **out of scope for 004** (named in Hard Non-
Implementation Boundaries). The in-scope reset path:

- A manager or admin, signed in on the same terminal where the cashier needs
  the reset, executes a `cashier.pin.reset` action through the manager/admin-
  only surface.
- The action prompts for a new PIN; the manager/admin enters it (the cashier
  may stand next to them; the new PIN is a fresh local unlock factor, not a
  password). The manager/admin then hands the terminal to the cashier so they
  can change it on first sign-in (a follow-up "set your own PIN" flow lands
  in a later slice if needed; for MVP the manager-set PIN persists until the
  next reset).
- The reset is recorded as an audit event with action category
  `cashier.pin.reset`, attributed to the *manager / admin* as the acting
  operator, with a reference to the *cashier* whose PIN was reset. The new
  PIN value is NEVER recorded in the audit event (PR-1). The same applies to
  `cashier.pin.unlock` (PR-3 release path b): manager-attributable, no PIN
  value in the audit record.

### PR-6. Local unlock MUST NOT bypass role-gated information boundaries

A successful PIN unlock for a cashier role transitions the local
`operatorSessionStore` to `signedIn` *as that cashier*. The cashier's role
(`cashier`) is the role from the cached Clerk identity, NOT a property of the
PIN record. PR-6 follows trivially: the bridge-surface enforcement (AD-1)
sees `currentSession.role === 'cashier'` and refuses every Cashier-Forbidden
Information catalogue request as it would for any cashier signed in. There
is no "PIN-elevated mode", no "admin override via PIN", no "manager
back-door PIN". The PIN factor cannot be used to elevate role in any
direction. If a need arises in a future feature for an in-session role
elevation (e.g., a supervisor-override flow that temporarily grants
manager-only capabilities), it MUST be designed as a separate feature with
its own attribution rules, not by reusing the PIN factor.

## Constitution Check (Initial)

Walked across both Roman-numeral Core Principles (I–IX) and Cross-Feature POS
Principles (P1–P18) per constitution v1.5.0 governance.

### Core Principles (I–IX)

| Principle | Status | Notes |
|:--|:--:|:--|
| I. Offline-First (NON-NEGOTIABLE) | **PASS-with-deferral** | 004 does not promise offline operator sign-in (NFR-010, A6); the offline-behaviour rule set is explicitly fail-closed for new sign-in per NFR-011 (manager/admin sign-in unavailable; cashier PIN unlock alone insufficient; takeover-detection unavailable; existing sessions may continue with truthful connection-state visuals; local sign-out and inactivity timeout MAY still terminate offline). Spec is explicit; not a violation. The Offline-First principle's mandate ("MUST be able to ring up a sale, print a receipt, and open the drawer with zero network connectivity") applies to *transactional* operations once an operator session exists — operator authentication is governed by the deferred offline-auth feature. |
| II. Financial Precision — No Floats | **N/A** | No money-bearing state in 004. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | **PASS** | 004 expands the preload bridge under the `operator.*` namespace ONLY (contracts/bridge-api.md). All new IPC channels are enumerable, named, documented. The renderer NEVER imports Node modules directly. SQLite access lives in the main process. The `cashier_pin_records` table (post-§A1) is reachable only through main-process code paths, never from renderer. PIN values cross the bridge once on input and are never persisted in any renderer-accessible form. |
| IV. Hardware Loud, Not Silent | **N/A** | No new hardware surface in 004. |
| V. Type Safety End-to-End | **PASS** | All `operator.*` bridge calls typed in `src/shared/bridge-api.ts`; both ends share the interface. No `any`. The audit-event shape, role enum, session state, takeover-prompt return type, and PIN-verifier result type all strict-typed. |
| VI. Test-First, Coverage-Gated | **PASS** | Each slice ships failing tests first. Coverage targets: ≥ 95 % on bridge-API role-enforcement module and PIN-verifier (load-bearing trust-boundary code), ≥ 90 % on `src/renderer/ui/operator/`, ≥ 90 % on the audit module. CI ratchets upward only. |
| VII. Observability — Local Logs + Remote Crash Reports | **PASS-with-extension** | New `pino` log sites added for: sign-in attempt outcome category (Clerk path AND PIN path), takeover detection, takeover confirmation/cancellation, forced-close request, PIN-rate-limit/lockout events (PR-3), PIN-reset events (PR-5), audit-event emission, audit-event sync. **All sites pair with explicit redaction list updates** (PR-1) — operator credentials, session tokens, PIN values in any form, raw operator IDs (logged only as opaque references per FR-032), Clerk JWTs. Sentry scrubber updated symmetrically. P11 enforcement. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | **PASS** | This is the load-bearing principle for 004. **Clerk remains the sole IdP**; every operator's identity is a Clerk user. The local PIN factor (AD-2 / §A1) is *not* an IdP and *not* a custom user database — it is a local terminal unlock factor over an already-Clerk-anchored identity. **§A1 cleared via PR #39 (merge SHA 7ae337b, 2026-05-05T20:53:45Z, Constitution v1.5.1)**, which added the normative local-unlock-factor clause to Principle VIII. The gate is resolved; Slices 3–6 are unblocked subject to §A2/§A3/§A4. |
| IX. Reference, Not Inheritance | **PASS** | No legacy POS operator/session code is consulted. All decisions are re-derived from the constitution + 001/002/003 plans + the clarified spec. |

### Cross-Feature POS Principles (P1–P18)

| Principle | Status | Notes |
|:--|:--:|:--|
| P1. Financial Correctness First | **N/A-load-bearing-deferred** | 004 introduces no money-bearing operations directly. It establishes the *attribution* rules that future money-bearing operations require. |
| P2. No Fake Success States | **PASS** | Sign-in success gated on backend confirmation (Clerk JWT validation) for managers/admins; on Clerk-anchored identity verification for cashiers (PIN unlock alone is insufficient — the cached Clerk identity must still be valid). The shell does NOT optimistically render the operator-bound landing surface before that confirmation. |
| P3. No Silent Data Loss | **PASS** | Audit events use the local outbox + idempotency-key pattern (P5). Failed audit emission queues locally; sync retries until acknowledged. No silent drop on crash, restart, or network failure. |
| P4. Auditability and Non-Destructive Financial Correction | **PASS-load-bearing** | `audit_events` is append-only at both schema (UPDATE/DELETE denied by trigger) and rule (FR-028) levels. Corrections are new compensating records. AD-3 codifies. |
| P5. Idempotency for Retried Operations | **PASS** | Every audit event carries a client-generated UUID v4 established at the moment of intent. Sign-in itself is *not* retryable in the same sense (a duplicate sign-in is a takeover, not a duplicate session); takeover confirmation IS idempotent. PIN unlock is NOT retryable in a backend sense — it is a local-only operation (PR-3 governs its retry semantics). |
| P6. No Raw Cardholder Data by Default | **N/A** | 004 introduces no payment-instrument surface. |
| P7. Secrets Never Reach Renderer or Logs | **PASS-load-bearing** | PIN values, manager/admin password material, Clerk JWTs, session tokens MUST NOT appear in any renderer-accessible artifact (FR-031), in any log line (FR-030 + PR-1), or in any Sentry event. Cross-process redaction smoke (extending 002's) gates every slice. |
| P8. Electron Security Boundary | **PASS-with-justified-expansion** | 004 expands `src/preload/`, `src/shared/bridge-api.ts`, `src/main/`, the SecretStore API, and (under approval) the migration runner and the OpenAPI codegen pipeline. P8 forbids "smuggled" expansion; 004 *owns* these expansions explicitly. Slice 2 includes a dedicated security-review gate that walks the bridge-surface diff line by line, including PR-1…PR-6 enforcement. |
| P9. Truthful Offline / Degraded / Sync States | **PASS** | 004 introduces no new connection-state visuals. |
| P10. Operator Accountability for Sensitive Actions | **PASS-load-bearing-canonical** | This feature IS the canonical landing site for P10. Every audit event's `acting_operator` is the stable Clerk-backed identity, never the PIN record (AD-2 / AD-3). |
| P11. Supportability Without Secret Leakage | **PASS** | New log sites pair with redaction list updates (PR-1); support-bundle export tooling runs the same redaction pipeline. The `audit_events` table is included in support bundles with operator identifiers redacted to opaque references. PIN values never appear. |
| P12. Spec Kit Artifacts Are Source of Truth | **PASS** | `/speckit-clarify` resolved all three open questions on-record. The local-unlock-factor framing was added to plan.md (this revision) rather than left in conversation. |
| P13. Small, Scoped Implementation PRs | **PASS** | Slice strategy below produces small PRs. Slice 0 is non-code. Slices 1–6 each ≤ ~600 LOC diff target. No `git add -A`. Final-polish slice MUST be small (FR-035). |
| P14. Accessibility and Cashier Ergonomics | **PASS** | Sign-in flow fully keyboard operable. PIN pad targets ≥ 44 × 44 CSS px (NFR-005). Per-surface axe rule pass on default / loading / error variants. |
| P15. Production Readiness Gates | **PASS** | 004 is production-affecting (cashier login is in P15's named list). Production Readiness subsection below names the test plan, rollback strategy, support-runbook entry, failure-mode catalogue, operational-readiness expectations. |
| P16. Feature Scope Discipline | **PASS** | Hard Non-Implementation Boundaries restate the spec's Out-of-Scope list. |
| P17. Privacy and Tenant Isolation | **PASS** | Every new SQLite table carries `tenant_id` and `branch_id`. The `cashier_pin_records` table is additionally scoped by `terminal_id` (PR-4). Roster fetch scoped server-side by paired tenant + branch. Audit events carry `tenant_id`. |
| P18. Local Durability Before Offline Promises | **PASS** | 004 makes no offline-operator-sign-in promise (NFR-010 + NFR-011 fail-closed rule set). The Sign-In surface honestly fails when offline (`no_connection` generic variant per NFR-003 / PR-2). Local durability for transactional operations under an existing offline session continues to honour P3/P5 via the audit-event outbox. |

**Gate result: PASS.** §A1 (local-unlock-factor approval) cleared via PR #39 (merge SHA 7ae337b, Constitution v1.5.1). Slice 0 (visual direction, already signed off) and Slices 1–2 (manager/admin sign-in via Clerk + bridge-surface security review) may proceed. Slices 3–6 are unblocked from the §A1 perspective; they remain held on §A2 (backend OpenAPI endpoints — coordination outstanding), §A3 (migrations — downstream of §A1, now unblocked for planning), and §A4 (Argon2id binding — downstream of §A1, now unblocked for planning) per their individual gate requirements.

## Phase 0 — Research

See [./research.md](./research.md). Six decisions are recorded with chosen approach, alternatives, and rationale:

1. **Identity model split** (Clerk for managers/admins; local terminal unlock factor for cashiers over Clerk-anchored identity — *gated on §A1*; alternative 1 — Clerk/password for everyone — is the fallback if §A1 denies).
2. **Routing topology** (top-level `/sign-in` vs modal-over-shell — top-level chosen, AD-4).
3. **Renderer state shape** (zustand `operatorSessionStore` 5-state finite-state machine; React Query for the small read-only roster fetch + sign-in/out/takeover mutations).
4. **PIN hashing scheme** (Argon2id with research §1 parameters — local-only verifier, never crosses the bridge in plaintext, never persists to disk in clear; Argon2id binding install gated on §A4).
5. **Audit-event durability** (local outbox + client-generated UUID v4 idempotency key; backend sync via the existing offline-queue pattern).
6. **Bridge-surface enforcement boundary** (`operator.*` self-gates against `currentSession.role`; renderer route guards are secondary UX defence; query-builder gating rejected per AD-1).

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md). Five conceptual entities: `Operator`, `OperatorSession`, `Role`, `Shift` (behavioural shape only), `AuditEvent`. Three new SQLite tables described conceptually: `operator_sessions`, `cashier_pin_records` (local unlock factor only — see PR-1…PR-6), `audit_events`. **Migration files NOT authored by `/speckit-plan`.**
- **Contracts:** [./contracts/](./contracts/). Three interface artifacts:
  1. **`bridge-api.md`** — the new `operator.*` namespace exposed by the preload bridge.
  2. **`backend-endpoints.md`** — backend OpenAPI dependencies (gated on §A2). The cashier PIN factor introduces ZERO new backend endpoints — it is a local operation.
  3. **`role-visibility-matrix.md`** — canonical FR-015 / FR-017 / FR-018 table.
- **Quickstart:** [./quickstart.md](./quickstart.md). Reviewer's walkthrough for testing each user story independently after each slice.
- **Agent context update:** the `<!-- SPECKIT START -->` block in `CLAUDE.md` is updated to point to this plan file.

## Phase 2 — Visual Direction (Slice 0)

**Mandated by spec FR-033 / FR-034. Non-code. Required before any of Slices 1–6 begin.**

### Deliverables (gated before any of Slices 1–6 begin)

A reviewed contact sheet covering, at minimum, the following surfaces in 003-aligned design tokens (`comfortable` density, ≥ 1280 px expanded rail / 1024–1279 px icon-only rail, four-state connection visual, fixed role-indicator slot):

1. **Cashier sign-in: roster + PIN, default state.** Roster grid (display name + role badge per cashier, no email/phone), PIN pad (4–6 digit, ≥ 44 × 44 CSS px targets), branch + terminal label fixed to top.
2. **Manager / admin sign-in: password, default state.** Identifier field + password field, no roster grid, role indicator updates on successful sign-in.
3. **Explicit takeover prompt.** Three buttons (Continue here / Cancel / generic close). Generic copy ("You are already signed in on another POS terminal in this branch") — no terminal name, no time, no other-operator data.
4. **Forced-close manager recovery surface.** List of stuck shifts visible only on manager/admin; for each: opener name, opened-at timestamp, terminal label, `[Forced close]` button. The forced-close form: reason picker (fixed enumerated set per FR-024(c)), optional free-text annotation (clearly marked as not-the-reason-field), confirm + cancel.
5. **Role indicator** in 003's existing role-indicator slot, rendered for each of the three roles (Cashier / Operator, Shift Manager, Owner / Admin). Demonstrates the 1:1 machine-identifier ↔ business-name correspondence (FR-002).
6. **Generic sign-in failure state.** Single generic error message ("credentials not recognised"); no factor-distinguishing variants per NFR-003 / PR-2. Includes the rate-limit/lockout variant ("too many attempts — wait a moment") per PR-3.

### Visual-direction review gate

The contact sheet must be reviewed (and the review recorded under `specs/004-operator-session/visual-direction/`) against:

- 003's design tokens (color, spacing, typography, radius, shadow, density).
- 003's navigation rail behaviour (rail visible behind the sign-in surface? — decision must be made and recorded; default: rail is *hidden* during sign-in, *visible* during the takeover prompt because takeover happens inside an authenticated session).
- 003's connection-state visuals (four states, where they appear during sign-in).
- The role-indicator slot (003's reservation must be honoured 1:1).
- Accessibility considerations: keyboard path through every surface, axe-rule cleanliness on default-state mocks, focus-ring visibility.

**No implementation slice MAY merge before the Slice 0 review is complete and recorded.** This is the FR-033 enforceable gate, not a soft preference.

## Phase 3 — Implementation Slice Strategy

Each slice produces small reviewable PRs. Slice 0 above is non-code. **`/speckit-plan` does NOT begin any slice.**

| Slice | Deliverable | Approval Gates needed | Indicative test surface |
|:--|:--|:--|:--|
| **S0: Visual Direction** (non-code) | Contact sheet covering the 6 deliverables above; review recorded under `specs/004-operator-session/visual-direction/`. | None new (reviews this plan's Slice 0 list). | Review document is the artifact. |
| **S1: Manager / admin sign-in (Clerk-only path)** | `operator.*` bridge namespace skeleton (typed, manager/admin Clerk path implemented; cashier path stubbed-and-gated); `<OperatorRouteGuard>`; `operatorSessionStore` 5-state machine; sign-in surface for managers/admins (Clerk/password); fixed-location operator badge; `/sign-in` route mounted above `/app/*`. **No PIN code lands in S1.** | §A2 (backend `POST /v1/operators/sign-in`, manager/admin variant only). | Bridge-surface unit tests (manager/admin sign-in success / failure / disabled / wrong tenant). Renderer integration: route guard, sign-in form, sign-out. Keyboard-path tests. axe-clean default + error states. |
| **S2: Bridge-surface security review (gate, not code)** | Dedicated review pass over the S1 bridge diff against P8 + AD-1. No new code; produces `specs/004-operator-session/security-review/s1-review.md`. Approves or sends S1 back. | None new — the review gate. | Review document is the artifact. |
| **S3: Audit event scaffolding** ⚠ Gated on §A1 | `audit_events` table (under §A3); audit-event entity in `src/main/audit/`; bridge surface (`operator.emitAuditEvent`); local outbox + idempotency-key plumbing; redaction list extension (PR-1); placeholder consumers for `operator.session.takeover` and `shift.forced_close` action categories (full takeover and forced-close UI lands in S5/S6). | §A1, §A3 (`audit_events` migration), §A2 (backend `POST /v1/audit-events`). | Crash/restart/network-failure path tests. Idempotency test. ≥ 95 % coverage on the audit module. |
| **S4: Cashier sign-in (PIN as local unlock factor)** ⚠ Gated on §A1, §A2, §A3, §A4 | Cashier roster grid on `/sign-in`; `cashier_pin_records` table (per-terminal scoped, `safeStorage`-sealed); PIN-verifier in `src/main/operator/pin-credential.ts`; `operator.signIn` cashier path; rate-limit/lockout (PR-3); takeover detection + prompt flow; `operator.session.takeover` audit event on confirmation; admin-side `cashier.pin.reset` and `cashier.pin.unlock` flows (PR-5). | §A1 (load-bearing), §A2 (backend roster + takeover-confirm endpoints), §A3 (`cashier_pin_records`, `operator_sessions` migrations), §A4 (Argon2id binding install). | Bridge-surface tests including PR-1…PR-6 enforcement. Rate-limit/lockout tests. Cross-process redaction smoke (extends 002's). axe-clean roster + PIN-pad. Keyboard-path Vitest. |
| **S5: Forced-close manager surface** | Manager/admin route to view stuck shifts; forced-close confirmation flow (fixed reason enum + optional free-text); `shift.forced_close` audit event; cashier-returns-after-forced-close UX (informational, no financial detail). | §A1, §A2 (backend recognises `shift.forced_close` audit category). | Visibility tests: forced-close surface invisible to cashier; reachable to manager/admin. Audit-shape test: separate event from any takeover. |
| **S6: Final polish** (small) | Screenshot/contact-sheet review against S0; consistency fixes; documentation (`docs/runbook/operator-session.md`); `<!-- SPECKIT START -->` block update. | None new. | Smoke pass of all prior tests. |

**Per-slice non-functional gates** (apply to every slice):

- **Pre-merge screenshot/contact-sheet review** against S0 deliverables (FR-035).
- **Pre-merge axe-clean** on default / loading / error variants (P14).
- **Pre-merge cross-process redaction smoke** must pass with the slice's diff applied (P7 / P11 / PR-1).
- **Pre-merge `npm test`, `npm run codegen:verify`, `npm run typecheck`, `npm run lint`** all pass.
- **No `git add -A`**, **no `--no-verify`**, **no scope creep beyond the slice's listed task IDs** (P13).

## Approval Gates

The following gates MUST be cleared *before* the indicated slices may begin. Each gate is a small, named PR or constitutional clarification; the plan does not pre-write them. They exist so `/speckit-tasks` correctly schedules blocking work.

### §A1. Local-unlock-factor approval (LOAD-BEARING)

**Description.** This plan adopts AD-2 (Clerk-only manager/admin auth + local terminal unlock factor for cashiers). The framing is: Clerk remains the sole human IdP; every operator has a stable Clerk-backed identity; the cashier PIN is a *local terminal unlock factor* that proves the person currently in front of this paired terminal may unlock the already-known cashier identity for an operator session. The PIN does not mint backend tokens, is not an IdP, is not an alternate user database, and is not the audit-attribution key. PR-1…PR-6 govern the PIN factor's security posture.

**Risks documented**:

- **Local unlock factor weakens the per-terminal threat model.** A 4–6 digit PIN, even with PR-3 lockout, is locally guessable to a determined attacker with physical access. Mitigation: lockout (PR-3); per-terminal scoping (PR-4) so PIN compromise on terminal A does not affect terminal B; `safeStorage` seal so a stolen PIN database is unreadable on a different machine or Windows account; manager/admin reset path (PR-5).
- **Constitutional drift risk.** Future readers may forget that the PIN is *not* an IdP and add backend endpoints that consult it directly. Mitigation: PR-1 / AD-2 / contracts/backend-endpoints.md explicitly forbid backend endpoints that consult the PIN, and the bridge-surface security review gate (S2) walks every new bridge call to confirm.
- **Clerk-IdP dependency on cashier identity provisioning.** Cashier identities still require Clerk to provision and to validate at sign-in; the PIN factor is local-only, but the cashier session it produces still leans on Clerk. Mitigation: Clerk's existing 002 integration is the path; no new Clerk surface.
- **Cashier-self-service PIN reset out of scope.** Cashiers who forget their PIN must wait for a manager. This is a deliberate scope choice (see Hard Non-Implementation Boundaries); a future feature MAY add cashier-self-service reset under its own approval.

**Resolution paths**:

1. **Clarification amendment** — add a single normative clause to Principle VIII: "A *local terminal unlock factor* (e.g., a per-terminal hashed PIN keyed by the Clerk user ID) is not an identity provider and not a user database within the meaning of this principle, provided the canonical identity remains in Clerk, the factor is not consulted by any backend endpoint, and audit attribution uses the Clerk-backed identity, not the factor record."
2. **Adopt Alternative 1 (Clerk/password for everyone).** Re-clarify spec Q1 to swap the cashier UX from roster-pick + PIN to roster-pick + password. Slice 4 reduces to a UX swap; PR-1…PR-6 dissolve; §A3 (cashier_pin_records migration) and §A4 (Argon2id binding) are no longer needed.
3. **Defer cashier auth entirely.** Ship S0–S3 (manager/admin only); leave cashier sign-in to a later plan revision after Clerk's custom-factor support is evaluated. (Operationally awkward — managers cannot ring sales — but constitutionally clean.)

**Blocks**: S3, S4, S5, S6 (everything beyond S0 + S1 + S2). Specifically, blocks: any migration (§A3), any OpenAPI change (§A2), any IPC/preload change beyond the manager/admin Clerk path, any backend change, any SecretStore/`safeStorage` change for PIN material, any cashier-PIN storage or verification implementation.

**Recommendation**: Path 1 (clarification amendment). Smallest constitutional delta, preserves Principle VIII's intent, unblocks 004 and every future feature that may need a non-OIDC factor for a Clerk-canonical identity (e.g., a future biometric or smart-card factor). The user has affirmed AD-2 as the planning direction; §A1's resolution should ratify that.

### §A2. Backend OpenAPI endpoint approval

**Description.** 004 depends on backend endpoints (`POST /v1/operators/sign-in` for managers/admins, `POST /v1/operators/sign-out`, `POST /v1/operators/takeover/confirm`, `GET /v1/operators/roster?branch_id=`, `POST /v1/audit-events`). The cashier PIN factor introduces ZERO new backend endpoints. The user's hard-exclusion list forbids "Do not change OpenAPI" in this plan phase.

**Resolution path**: Backend feature ticket(s) land first in the SmartDataPulse backend repo, with endpoint specs reviewed against this plan's contracts. Once each endpoint exists in the backend's OpenAPI spec, the POS Pulse `codegen:api` task pulls the regenerated types and `codegen:verify` confirms determinism.

**Blocks**: S1 (sign-in / roster endpoints), S3 (audit-events endpoint), S4 (roster + takeover-confirm endpoints), S5 (audit-event recognition for `shift.forced_close`).

### §A3. Migration runner — three new tables

**Description.** 004 introduces three new SQLite tables (`operator_sessions`, `cashier_pin_records`, `audit_events`). User's hard-exclusion list forbids "Do not change database migrations" in plan phase.

**Resolution path**: `/speckit-tasks` produces a per-slice migration task; migration files reviewed against data-model.md and the constitution P4 (append-only) constraints. Each migration ships in its slice's PR.

**Blocks**: S3 (`audit_events`), S4 (`cashier_pin_records`, `operator_sessions`).

### §A4. Argon2id binding package install

**Description.** The local PIN factor uses Argon2id for hashing (research §1 / §4). The canonical Node binding is `argon2` (npm). User's hard-exclusion list forbids "Do not install packages" and "Do not modify package.json" in plan phase.

**Resolution path**: A dedicated install task in S4 adds the binding and pins its version. The `package.json` change is reviewed against the constitution Tech Stack rules.

**Blocks**: S4.

**Alternative**: If §A1 resolves via path 2 (Alternative 1 — Clerk/password for everyone), §A4 is unnecessary. Manager/admin password handling stays within Clerk; no client-side Argon2id is needed.

### §A5 (informational, not blocking). Constitution P15 — Production Readiness

**Description.** P15 names "cashier login" as production-affecting. The merge gate for the production-rollout PR will require the Production Readiness subsection (below) to be present.

**Blocks**: Production rollout, not slice merges. (S1–S6 may merge to `main` behind a feature flag; rollout requires §A5 sign-off.)

## Test Strategy

Vitest is the single test runner (Constitution VI / Tech Stack v1.5.0). Test shapes per slice:

- **Unit (renderer)**: every component in `src/renderer/ui/operator/` ships with a Vitest suite first; default / loading / error variants; keyboard path; axe-clean smoke.
- **Unit (main)**: every bridge handler in `src/main/operator/` covered: success path, role-gated refusal, invalid input rejection, redaction. PIN-verifier (S4) covered: correct PIN, wrong PIN, locked-out, freshly-unlocked-after-timer, freshly-unlocked-after-manager-action, missing record, cross-tenant attempted use.
- **Integration (cross-process)**: extends 002's cross-process redaction smoke to cover PR-1 (PIN values, PIN-verifier failures, PIN-reset / PIN-unlock events, all credential / token redaction sites).
- **Integration (renderer)**: `<OperatorRouteGuard>` + `operatorSessionStore` covers sign-out clears state, sign-in transitions, role mismatch, route restoration, refresh.
- **Contract tests**: per-bridge-call contract tests against the typed surface in `src/shared/bridge-api.ts`.
- **Coverage gates**: ≥ 95 % on bridge-API role-enforcement module; ≥ 95 % on PIN-verifier; ≥ 90 % on `src/renderer/ui/operator/`; ≥ 90 % on the audit module.
- **Negative tests** per spec: cross-tenant sign-in produces generic refusal (NFR-003 / PR-2); takeover prompt cancellation leaves prior session intact; takeover-stranded shift cannot be silently closed; forced close emits a separate audit event from takeover; cashier route enumeration reaches no manager-only surface (SC-003 walkthrough automated for 20+ access paths). PIN rate-limit/lockout exercised: 5 wrong attempts → lockout → timer expiry → success; 5 wrong attempts → manager unlock → success.

**No Playwright in this feature.** Acceptance scenarios testable at Vitest + RTL + happy-dom level given bridge mocks.

## Production Readiness (P15)

Required before production rollout (gates §A5).

### Test plan

- All slice-level tests passing on CI (`windows-latest`).
- Manual reviewer walkthrough of the 20-path SC-003 cashier-can't-reach-anything audit on a paired terminal.
- Manual takeover scenario: same operator on two physical terminals, confirm takeover, prior terminal returns to Sign-In within 30 seconds.
- Manual forced-close scenario: takeover strands shift on terminal A, manager on terminal B executes forced close, audit log shows two separate events.
- Manual PIN-lockout scenario: 5 wrong PINs → lockout banner → wait timer → successful sign-in. Repeat with manager unlock.
- Support-bundle export with at least 50 audit events and at least 5 PIN failure events; verified that PIN values appear nowhere, operator identifiers in the bundle are opaque references, no Clerk JWTs, no session tokens.

### Rollback strategy

- Each slice ships behind a feature flag readable from the existing 001 configuration surface.
- Disabling the operator-session flag returns the application to the 003 post-pairing shell as if no operator sign-in were required.
- Database migrations are forward-only; rollback rolls back the feature flag, not the schema. The `audit_events` and `cashier_pin_records` tables are harmless to keep unused.

### Support-runbook entry

- `docs/runbook/operator-session.md` covers: cashier "I can't sign in" (5 generic causes + diagnostic steps), takeover "what does this prompt mean", forced close "how do I close a stuck shift", inactivity timeout policy, **PIN lockout policy and manager unlock procedure (PR-3 / PR-5)**, **PIN reset procedure (PR-5)**.

### Failure-mode catalogue

| Failure mode | User-visible | Recovery |
|:--|:--|:--|
| Backend unreachable during manager/admin sign-in | "no connection — try again" banner | retry; offline-auth deferred per A6 |
| Backend unreachable during cashier sign-in | "no connection — try again" banner; the local PIN unlock alone is not sufficient — Clerk identity validation still required | retry; offline-auth deferred |
| Clerk token invalidated | sign-in refused with generic message | operator re-signs-in |
| `safeStorage.isEncryptionAvailable() === false` | application refuses to start (per 001) | re-pair / new Windows profile |
| `cashier_pin_records` row missing for an existing cashier | generic "credentials not recognised" | manager executes `cashier.pin.reset` (PR-5) |
| Cashier locked out (5 fails in 5 min) | "too many attempts — wait a moment" (PR-3) | wait timer OR manager unlock (PR-5) |
| Audit-event sync repeatedly fails | event remains in local outbox | support reviews outbox via support bundle |
| Takeover detection race | takeover prompt may briefly appear twice | second prompt is no-op; backend rejects second confirm with generic refusal |
| `cashier_pin_records` corrupted on disk | generic "credentials not recognised" for affected cashiers | manager `cashier.pin.reset` per cashier; if widespread, re-pair the terminal |
| Stolen `cashier_pin_records` table on a different machine | unreadable due to `safeStorage` DPAPI scoping | no recovery needed — confidentiality preserved by 001 |

### Operational readiness

- Per-tenant rollout sequence agreed with the customer-success team; pilot pharmacy enables the flag for one branch first; full-tenant rollout after one week of pilot signal. PIN-lockout and PIN-reset behaviour MUST be documented in customer-facing onboarding before the cashier-PIN slice (S4) is enabled in any tenant.

## Project Structure

### Documentation (this feature)

```text
specs/004-operator-session/
├── plan.md                                # This file
├── research.md                            # Phase 0 output
├── data-model.md                          # Phase 1 output
├── quickstart.md                          # Phase 1 output
├── contracts/
│   ├── bridge-api.md                      # operator.* preload bridge contract
│   ├── backend-endpoints.md               # Backend OpenAPI dependencies (gated §A2)
│   └── role-visibility-matrix.md          # Canonical FR-015/FR-017/FR-018 table
├── checklists/
│   └── requirements.md                    # Carried forward from /speckit-specify
├── visual-direction/                      # Slice 0 contact-sheet review (created in S0)
├── security-review/                       # Slice 2 P8 review notes (created in S2)
└── tasks.md                               # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — descriptive, not authored by /speckit-plan

The implementation that would land across Slices 1–6 (no source files written in this phase):

```text
src/
├── main/
│   └── operator/
│       ├── session-manager.ts             # operator-session lifecycle, takeover detection
│       ├── pin-credential.ts              # Argon2id local unlock verifier (§A1+§A4-gated)
│       ├── audit-emitter.ts               # P5 idempotency-keyed audit emission
│       └── role-enforcement.ts            # AD-1 main-side role gate
├── preload/
│   └── operator.ts                        # operator.* preload exports
├── shared/
│   └── bridge-api.ts                      # operator.* type contracts (extended)
├── renderer/
│   ├── ui/
│   │   └── operator/
│   │       ├── RosterList.tsx
│   │       ├── PinPad.tsx
│   │       ├── TakeoverPrompt.tsx
│   │       ├── OperatorBadge.tsx
│   │       ├── ForcedCloseSurface.tsx
│   │       └── __tests__/
│   ├── routes/
│   │   ├── sign-in.tsx                    # /sign-in route
│   │   └── operator-route-guard.tsx
│   └── stores/
│       └── operator-session-store.ts      # zustand 5-state machine
└── shared/
    └── audit/
        └── event-shape.ts                 # AuditEvent type, action-category enum

migrations/
├── NNN_audit_events.sql                   # S3, gated §A1+§A3
├── NNN_cashier_pin_records.sql            # S4, gated §A1+§A3
└── NNN_operator_sessions.sql              # S1 or S4, gated §A3 (and §A1 if needed by S4)

tests/
├── contract/
│   └── operator-bridge.contract.test.ts
├── integration/
│   ├── operator-route-guard.test.tsx
│   └── cross-process-redaction.test.ts    # extended from 002
└── unit/                                  # per-component / per-handler suites
```

**Structure Decision**: Single project layout. Trust-boundary code in `src/main/operator/`, UI in `src/renderer/ui/operator/`, single typed seam in `src/shared/bridge-api.ts`. No new top-level packages.

## Complexity Tracking

| Item | Justification | Simpler alternative rejected because |
|:--|:--|:--|
| Local terminal unlock factor (cashier PIN) | Q1 cashier UX (4-6 digit PIN + roster pick) doesn't map onto OIDC primitives; gated explicitly on §A1 with three documented resolution paths; PR-1…PR-6 codify the security posture; framing keeps Clerk as the sole IdP. | Pure Clerk for everyone (Alternative 1): retained as fallback if §A1 denies. Pure Clerk via custom factor (Alternative 3): deferred — Clerk's custom-factor support not yet evaluated. |
| Bridge-surface enforcement of FR-019 | Trust boundary lives at the preload bridge per Principle III; route-guard-only enforcement is a renderer-only check, which a forced URL bypasses. | Route-guard-only: rejected per FR-019. Query-builder-only: rejected per AD-1. |
| Audit-event entity introduced now | P10 / P4 / P5 require it; the catalogue cannot expand from a "supervisor override" primitive to a full sensitive-action audit trail without it. | "Wait until 005-checkout-payments": rejected per P10. |
| Three new SQLite tables | Each answers a distinct durability requirement; collapsing them creates schema-level coupling that hurts append-only enforcement on `audit_events`. | Single combined table: rejected because triggers that enforce append-only on `audit_events` would also affect mutable `operator_sessions`. |

---

**End of plan.** §A1 cleared (PR #39, SHA 7ae337b, Constitution v1.5.1, 2026-05-05T20:53:45Z). §A2 backend/OpenAPI coordination remains outstanding (Ahmed holds POS-Pulse side; backend counterpart TBD). §A3 and §A4 are now unblocked for planning, awaiting §A2 per-slice endpoint delivery. Slice 0 review is complete. `/speckit-tasks` may be invoked; slices 3–6 scheduling holds on §A2 per-endpoint delivery.
