# Phase 0 Research — 004-operator-session

**Plan:** [./plan.md](./plan.md) (v1.1)
**Constitution version pinned:** v1.5.0
**Created:** 2026-05-05

This document records the six load-bearing technical decisions for 004 with the
alternatives evaluated and the rationale. Each decision is callable from the plan,
the data model, the contracts, and `/speckit-tasks`.

---

## §1. Identity model — Clerk + local terminal unlock factor for cashiers

### Decision

**Clerk remains the sole human identity provider** (Constitution Principle VIII,
preserved verbatim). Every operator — cashier, manager, admin — has a stable
Clerk-backed identity. **Manager and admin authentication is Clerk/password-backed
end-to-end.** **Cashier authentication anchors to the same Clerk identity, but is
unlocked at the paired terminal by a local 4–6 digit PIN that is never consulted
by any backend endpoint.** A successful PIN unlock causes the local
`operatorSessionStore` to transition to `signedIn` using the cached Clerk
identity for that cashier; the cashier's backend session token derives from the
Clerk JWT pipeline, not from the PIN.

This decision is the body of **Approval Gate §A1** (plan.md). It is gated; it
is not silently approved by the existence of this research file.

### Rationale

Spec Q1 (clarified 2026-05-05) locked the cashier sign-in UX as roster-pick + a
4–6 digit PIN. This UX does not map cleanly onto OIDC primitives:

- **PIN entropy is below the threshold most IdPs accept as a primary credential.**
  4 decimal digits = ~13.3 bits of entropy; even 6 digits = ~20 bits. OIDC providers
  generally require credentials in the 60+ bit range; a PIN passed straight into
  Clerk would either be refused outright or require Clerk's custom-factor
  extension, which is unproven for our ergonomics.
- **Roster-pick before authentication is anti-OIDC.** Standard OIDC patterns
  redirect-to-IdP for an opaque login surface, then return with a bearer token.
  Showing a list of branch-cashier names *before* authentication contradicts
  that pattern — and is exactly the UX a touchscreen cashier terminal needs.
- **Clerk's strength is identity continuity across devices and sessions.** The
  cashier's identity *is* a Clerk user; their permissions and role come from
  Clerk; their sign-out invalidates a Clerk session. The PIN is *only* the
  per-terminal unlock affordance. Asking Clerk to also be the per-terminal
  unlock factor confuses two responsibilities Clerk handles well separately.

The local-unlock-factor framing keeps Clerk as the IdP for what it does well
(identity, role, tenant claims, session-token rotation, MFA when added) and uses
the constitution's existing 001 secrets module (`safeStorage`) for the
per-terminal PIN factor.

### Why this preserves Principle VIII

Principle VIII says "Clerk is the sole IdP for humans; custom user databases
are PROHIBITED." Under this decision:

- Every cashier, manager, and admin remains a Clerk user.
- The canonical record of "who is this person?" is in Clerk.
- Backend tokens are Clerk-anchored.
- Audit attribution uses the Clerk-backed operator identity, not the PIN
  record.

The local PIN store is *not* a user database — it is a per-terminal hashed
unlock factor keyed by the Clerk user ID. It does not adjudicate "who is this
person?"; it adjudicates "may this person, on this terminal, unlock the cashier
identity already established here?". The distinction is real, load-bearing for
004, and is the body of §A1's clarification request.

### Alternatives considered

| Alt | Description | Why rejected (or held as fallback) |
|:--|:--|:--|
| 1 | **Clerk/password authentication for all roles, including cashiers.** | **Held as fallback** if §A1 denies the local-unlock-factor approach. Overrides spec Q1 cashier UX (roster-pick + PIN); slower cashier sign-in cadence on a touch terminal; otherwise constitutionally clean and the simplest path. |
| 2 | **Clerk/password for managers/admins + local terminal unlock factor for cashiers.** | **Chosen** (gated on §A1). Smallest delta to spec UX; smallest constitutional surface; keeps Clerk as sole IdP. |
| 3 | **Fully Clerk-modelled cashier factor via Clerk's custom-factor extension.** | **Deferred.** Clerk's custom-factor support for low-entropy PINs is not yet evaluated for our ergonomics; introduces an SDK surface increase and an OIDC-flow change that is heavier than 004 needs. Reserved as the long-term direction; a future feature can migrate the local PIN factor into Clerk if/when the extension stabilises. |
| 4 | **Internal credential store for cashier identity (a custom user database).** | **Rejected.** Direct violation of Principle VIII. Not considered seriously. |

### Open question reserved for §A1 amendment review

If §A1 resolves via amendment path 1 (clarification clause), the constitutional
amendment SHOULD also evaluate whether the per-terminal PIN factor's threat
model is acceptable for the pharmacy POS context, given:

- 4–6 digit PINs are locally guessable to a determined attacker with physical
  terminal access.
- `safeStorage` DPAPI scoping (constitution v1.3.0) makes a stolen
  `cashier_pin_records` table unreadable on a different machine or Windows
  account, but does not protect against an in-place attack on the same
  terminal under the same Windows profile.
- Mitigation is the PR-3 lockout (5 fails / 5 min → 5 min lockout per cashier
  per terminal) and the manager-attributable PR-5 reset path.

### PIN hashing parameters (deferred to §A4 install)

Argon2id, with the following parameters chosen for a 4–6 digit PIN under the
PR-3 lockout regime:

- `m_cost` (memory): 64 MiB
- `t_cost` (iterations): 3
- `p_cost` (parallelism): 1
- Salt: 16 random bytes per record, generated by Node's `crypto.randomBytes`,
  stored alongside the hash.
- Output length: 32 bytes.

Rationale: with PR-3 limiting to 5 attempts per 5-minute window, the offline-
guess pressure on a stolen + decrypted PIN database is the dominant threat.
64 MiB / t=3 makes a single guess on a modern desktop CPU take ~50–200 ms;
a 10000-PIN keyspace exhausted at one guess every 100 ms is ~17 minutes of
*continuous* CPU work per cashier — orders of magnitude longer than the
attack window most pharmacy floors permit.

Bcrypt (cost ≥ 12) and scrypt (`N=2^15`, `r=8`, `p=1`) were considered.
Argon2id is the modern default; OWASP and IETF recommend it over both. The
canonical Node binding is `argon2` (npm) — install gated on §A4.

---

## §2. Routing topology — top-level `/sign-in`, not modal-over-shell

### Decision

A new top-level route `/sign-in` mounts above 003's `/app/*` parent route. The
boot router resolves: pairing-decision (002) → if paired and no operator
session → `/sign-in` → if signed in → `/app/*`. Sign-out returns to `/sign-in`,
not to the shell.

### Rationale

A modal-over-shell sign-in surface leaks shell-rendered information (operator's
prior name in the role indicator, partially-rendered manager-only surfaces)
during the brief moment between sign-out and modal-open. NFR-009 requires the
role boundary to hold across "route restoration, deep-link navigation, page
refresh, tab restoration"; a top-level route makes that trivially true.

A top-level route also simplifies FR-008 (sign-out clears all visible
operator-scoped client state): the shell is *unmounted* on sign-out, and the
state slices that hold operator-scoped data (cart drafts, recent-action lists,
etc. — none of which exist yet but will be added by future features) are
trivially cleared by route teardown rather than requiring per-component
imperative cleanup.

### Alternatives considered

| Alt | Description | Why rejected |
|:--|:--|:--|
| 1 | **Modal over the existing 003 shell.** Sign-in opens as a modal; the shell remains mounted underneath. | Rejected per the leak above + per FR-008's clear-state requirement, which becomes harder when state lives behind an open modal. |
| 2 | **In-place sign-in on a single shell route (e.g., `/app/sign-in`).** Same shell, different route. | Rejected because it shares the parent layout with operator-bound routes; even with conditional rendering the parent's mount tree is observable, which complicates NFR-009's "across route restoration" guarantee. |
| 3 | **Separate Electron window for sign-in.** Two-window app. | Rejected for ergonomics — two windows on a cashier terminal is confusing; the user has to know which one to focus. Also expands the security boundary unnecessarily. |

### Implications

- The 002 boot gate's resolution stays unchanged; 002 routes to `/paired` (its
  post-pairing surface) which 003 then routes through. 004 inserts `/sign-in`
  *between* `/paired` (boot resolution) and `/app/*` (003's shell).
- Existing 003 routes under `/app/*` gain an `<OperatorRouteGuard>` wrapper at
  the parent level (one wrapper, not per-child) plus per-child role
  declarations.

---

## §3. Renderer state — zustand 5-state finite-state machine + React Query

### Decision

A new zustand slice `operatorSessionStore` exposes a 5-state finite-state
machine (FSM):

```
signedOut  →  signingIn  →  signedIn  →  signingOut  →  signedOut
                               ↕
                          takeoverPrompt
```

Plus an `error` field that surfaces the most recent generic failure category
without revealing factor-distinguishing information (FR-007 / NFR-003 / PR-2).

React Query is reused (existing 003 dependency) for two purposes:

1. **Read-only roster fetch** for the cashier sign-in surface — `GET
   /v1/operators/roster?branch_id=`. Cached for the lifetime of the sign-in
   surface (until sign-in completes or `/sign-in` unmounts). Refetched on
   sign-out to pick up roster changes (e.g., a manager added a new cashier).
2. **Sign-in / sign-out / takeover-confirm mutations.** Each is a one-shot
   mutation; the success path advances the FSM, the failure path sets the
   generic `error` field.

### Rationale

The 5-state FSM cleanly partitions the spec's mutually-exclusive states:

- `signedOut` = the only state where `/sign-in` is visible.
- `signingIn` = mutation in flight (Clerk path or PIN-verifier path).
- `signedIn` = the only state where operator-bound surfaces resolve.
- `signingOut` = brief tear-down state; ensures FR-008's "clear state" runs
  before the route transition.
- `takeoverPrompt` = the explicit takeover confirmation modal is open;
  blocking; cancellation returns to `signedOut`, confirmation advances to
  `signedIn`.

zustand fits the 003-established pattern (003's connection-state and
active-nav slices) and keeps the bundle small. A larger state library
(Redux Toolkit, XState) is overkill for a 5-state FSM whose transitions are
all trivially named.

React Query for roster + mutations is the existing 003 server-state library
and avoids introducing a second mental model.

### Alternatives considered

| Alt | Description | Why rejected |
|:--|:--|:--|
| 1 | **Zustand only, no React Query.** Roster fetch via `fetch` in a hook. | Rejected for ergonomics — no built-in retry, no caching, no stale-while-revalidate; reinventing what React Query already provides in 003. |
| 2 | **XState formal state machine.** | Rejected for size — the 5-state FSM is small enough that XState's formalism adds more weight than it pays for. If the FSM grows past ~10 states (e.g., when offline-auth lands), revisit. |
| 3 | **Redux Toolkit + RTK Query.** | Rejected — neither is in 003's stack. Introducing them for one feature breaks the consistency 003 carefully established. |

### Operator session state shape

```ts
type OperatorSessionState =
  | { status: 'signedOut'; error?: AuthErrorCategory }
  | { status: 'signingIn' }
  | { status: 'takeoverPrompt'; pendingOperator: { displayName: string; role: Role } }
  | { status: 'signedIn'; operator: { id: string; displayName: string; role: Role; tenantId: string; branchId: string } }
  | { status: 'signingOut' };

type AuthErrorCategory =
  | 'credentials_not_recognised'   // covers all factor-distinguishable failure modes per PR-2
  | 'too_many_attempts'             // PR-3 lockout — only error category that distinguishes itself
  | 'no_connection';                // network unreachable

type Role = 'cashier' | 'manager' | 'admin';
```

The `signedIn.operator.id` is the **stable Clerk-backed operator identity**, not
any PIN-record id. Audit attribution everywhere uses this id (AD-3 / FR-025).

### Addendum 2026-05-05 (post-/speckit-analyze finding U2) — terminal-A notification mechanism

After a takeover is confirmed on terminal B (per FR-013 and bridge-api.md
Call 5 — `operator.confirmTakeover`), terminal A must transition to
`/sign-in` "on its next genuine operator interaction or within 30 seconds,
whichever first" (spec FR-013). Two mechanisms can achieve this:

- **Passive polling**: terminal A's `operator.getCurrentSession` periodic
  call discovers the prior session ended (`end_at IS NOT NULL`,
  `end_cause = 'superseded_by_takeover'`) and the renderer transitions
  to `signedOut`. Poll interval ≤ 30 s to honour the FR-013 budget.
- **Active push**: terminal B's takeover confirmation triggers a
  backend-side push notification (WebSocket / SSE / similar) to terminal
  A; terminal A's local state transitions immediately.

**Decision: deferred to S4 implementation phase.** This addendum
establishes that the choice is a deliberate research decision tracked in
`tasks.md` (a dedicated task gates `operator.confirmTakeover` on this
choice being recorded). The deferral is principled, not negligent: the
backend's existing push-notification infrastructure (or its absence) is
not yet documented in 002's plan, so deciding the mechanism without
backend-team input would commit POS Pulse to an integration shape that
may not match the platform's broader push patterns.

**Constraints on the eventual choice (binding on whichever is picked)**:

- Terminal A MUST NOT accept any new operator interaction that would
  create a sensitive-action audit record between the takeover
  confirmation on B and A's own transition (FR-013 — takeover-window
  edge case). Whether passive or active, the local guard on terminal A's
  bridge handlers MUST refuse such interactions; the *display* of the
  prior operator's name on A is permitted briefly but MUST clear within
  30 seconds.
- The mechanism MUST honour FR-013's minimum-disclosure: terminal A's
  user-visible signal that the session ended is generic ("you have been
  signed out — please sign in again"), no terminal-B identification, no
  timestamp.
- The mechanism MUST NOT introduce a new IPC channel beyond the
  `operator.*` namespace defined in `contracts/bridge-api.md` (P8
  enforcement; no smuggled bridge expansion).

When S4 schedules the takeover confirmation handler (`operator.confirmTakeover`),
the prior task in the slice records the chosen mechanism and any
backend-side dependency (e.g., a WebSocket channel name if active is
chosen) in this addendum. Until then, this addendum is the canonical
record that the choice is parked, not forgotten.

---

## §4. Component primitives — extend `src/renderer/ui/` from 003

### Decision

Reuse 003's `src/renderer/ui/` primitive inventory verbatim (Button, Input,
Card, Dialog, Toast, StatusBanner, etc.). Add a new sub-directory
`src/renderer/ui/operator/` containing 5 new components specific to 004:

| Component | Purpose | Spec citation |
|:--|:--|:--|
| `RosterList` | Branch operator roster grid for cashier sign-in. Renders display name + role badge per row. No email/phone exposure (FR-004 / FR-006). | FR-006, S0 deliverable 1 |
| `PinPad` | 4–6 digit PIN entry. ≥ 44 × 44 CSS px touch targets. Numeric input only. | FR-006, NFR-005, S0 deliverable 1 |
| `TakeoverPrompt` | Modal with three buttons (Continue here / Cancel / generic close). Generic copy without revealing prior session location/time. | FR-013, S0 deliverable 3 |
| `OperatorBadge` | Slots into 003's role-indicator slot. Renders display name + role indicator. Updates on sign-in / sign-out. | FR-020, S0 deliverable 5 |
| `ForcedCloseSurface` | Manager/admin-only list of stuck shifts + forced-close form (reason picker + optional free-text). | FR-024, S0 deliverable 4 |

### Rationale

003 deliberately shipped the primitive inventory as an ownership boundary
(`src/renderer/ui/` is owned by the design system, not by individual features).
004's role is to *consume* the primitives plus add operator-specific
compositions, not to extend the primitive set. Following 003's pattern keeps
the primitive count stable and makes future features' visual reviews cheaper.

The 5 new operator-specific components are compositions over the existing
primitives: e.g., `PinPad` is a grid of `Button`s, `RosterList` is a grid of
`Card`s, `TakeoverPrompt` is a `Dialog` with three `Button`s. No new primitive
types are introduced.

### Alternatives considered

| Alt | Description | Why rejected |
|:--|:--|:--|
| 1 | **Add primitives to 003's `src/renderer/ui/` (e.g., a new `NumericKeypad` primitive).** | Rejected for ownership — 003's plan explicitly scopes the primitive set; adding to it should be a 003-revisit, not a 004 task. If `PinPad` proves to be a useful primitive in later features, file a follow-up under 003's owner. |
| 2 | **Use a third-party PIN-entry library.** | Rejected per Constitution V (no unjustified dependencies; first-party UI primitives module is the canonical UI surface) and 003's research §4 (Radix / shadcn / MUI explicitly rejected). |

---

## §5. Audit-event durability — local outbox + client-generated UUID

### Decision

Audit events use the **local outbox + idempotency-key pattern** that the
constitution prescribes for offline-capable retries (P3 / P5):

1. The acting code path generates a v4 UUID at the moment of intent (before
   the action executes). This UUID is the audit event's `event_id` and the
   sync idempotency key.
2. The audit event is written to `audit_events` (local SQLite, append-only)
   in the same transaction as the action's effects (where the action has
   local effects; e.g., a `shift.forced_close` writes to both `shifts` and
   `audit_events`).
3. A background sync process (extending 001's existing offline-queue
   plumbing if reusable, or adding a parallel one for audit events) submits
   the event to `POST /v1/audit-events` with the same `event_id`.
4. The backend recognises duplicate `event_id`s and silently dedupes (P5).
5. Sync failures keep the event in the outbox for retry; success marks the
   event as synced (a separate column on `audit_events`, since the table
   itself is append-only).

### Rationale

This is the canonical P5/P4/P3 pattern. The same pattern will be used by
005-checkout-payments for sale records, refunds, voids, etc.; 004 establishes
the pattern *for audit events specifically* and ensures 005+ can reuse it
verbatim.

The "extend 001's offline-queue if reusable" decision is deferred to
`/speckit-tasks` — research §5 does not commit to "extend" vs "parallel"
because the answer depends on whether 001's queue surface accepts arbitrary
event types or is shaped specifically around sales/refunds. Either choice
honours P3/P5; the choice matters for code organisation, not behaviour.

### Append-only enforcement

Schema-level: SQLite triggers on `audit_events` reject `UPDATE` and `DELETE`
attempts. This is enforced at the SQL layer, not just at the application
layer, so a future feature that tries to mutate an audit row via raw SQL
*also* fails. The `synced_at` column update (the one mutation we need) is
modelled as a separate `audit_events_sync_state` table keyed by `event_id`,
preserving the append-only property of `audit_events` itself.

Rule-level: FR-028 + AD-3 + the bridge-API surface (no `update` or `delete`
verbs on the audit namespace).

### Alternatives considered

| Alt | Description | Why rejected |
|:--|:--|:--|
| 1 | **Direct synchronous emission (no outbox).** Audit emission blocks the action's response on backend acknowledgement. | Rejected — violates P3 (silent data loss on network failure) and P9 (truthful states; if the backend is unreachable, we'd either hang the UI or silently drop). |
| 2 | **Remote-only audit (no local persistence).** Backend is the only audit store. | Rejected — violates P3 + Principle VII (local logs as the on-disk audit anchor). Support staff need on-device audit trail for the customer-dispute case. |
| 3 | **Audit on read, not write.** Materialise audit from the action's effects when a manager looks at the audit log. | Rejected — non-deterministic; depends on whether the materialisation logic catches all action paths; future features might forget to feed materialisation; FR-028 (append-only) becomes a property of the materialisation logic, which is the wrong place to enforce it. |

---

## §6. Bridge-surface enforcement — `operator.*` namespace self-gates

### Decision

Every bridge-API function exposed by the new `operator.*` namespace (and every
future operator-aware bridge function in 005+) **self-gates against the
main-process-held `currentSession.role`**. A bridge call from a cashier surface
that would return Cashier-Forbidden Information catalogue data (FR-015)
returns a generic refusal — not the data filtered, not the data with a flag,
not an error that distinguishes "exists but you're not allowed" from "doesn't
exist".

Renderer route guards (`<OperatorRouteGuard role="manager" />`) are a
**secondary UX-only layer** that prevent the cashier UI from *rendering
surfaces* it shouldn't show; they do NOT replace the bridge gate, MUST NOT be
the only barrier between a cashier and forbidden information, and MUST NOT be
relied on for trust-boundary enforcement.

### Rationale

FR-019 is normative: "Role-gated visibility MUST be enforced on the
*information* layer, not only the navigation layer." The renderer is untrusted
by construction (Constitution Principle III); a route guard in untrusted code
cannot satisfy a trust boundary. The main process *is* the trust boundary.
Putting the gate at the bridge — the seam between trusted and untrusted — is
the architecturally honest answer.

### Implementation shape (descriptive, not authored by /speckit-plan)

A small main-process helper, `src/main/operator/role-enforcement.ts`,
exposes a `requireRole(allowed: Role[], session: OperatorSession): void`
function that throws a generic refusal (`OperatorRefusalError`) if the
session's role is not in `allowed`. Every bridge handler that requires
manager-or-admin starts with `requireRole(['manager', 'admin'],
currentSession)`. The thrown error is mapped at the bridge boundary to a
generic IPC failure code that the renderer surfaces as the standard "this
section is not available for your role" message.

The same helper is used for sub-action gating where role alone isn't enough
(e.g., `forceCloseShift` requires `requireRole(['manager', 'admin'])` *and*
that the calling session's `branch_id` matches the stuck shift's
`branch_id`). The branch-scoping is an additional check layered on top; the
role check is invariant.

### Alternatives considered

| Alt | Description | Why rejected |
|:--|:--|:--|
| 1 | **Renderer route guards as primary.** Each renderer route declares the role(s) it requires; the route guard refuses transition. | Rejected — a forced URL bypass, deep-link, or refresh can present a route to the renderer that the route guard sees as the cashier's *initial* route, which complicates the redirect dance. More fundamentally, the renderer is untrusted; trust-boundary enforcement cannot live there. |
| 2 | **Query-builder gating.** A SQLite read helper injects role-aware `WHERE` filters and refuses generically on mismatch. | Rejected for the three reasons in plan.md AD-1: pushes the gate further from the trust boundary; conflates row-visibility with operation-allowed (we want the latter); not all spec rules are query-shaped (FR-016 is request-shaped, FR-013 is session-creation-shaped). |
| 3 | **A separate authorization service in the main process.** A dedicated module that every bridge handler calls. | Rejected as over-engineering for 004's scale. The `requireRole` helper is small enough to live as a single export from `role-enforcement.ts`. If permission needs grow (when role-extensibility lands as a future feature), revisit. |

### Implications for future features

- Every future bridge handler that touches operator-attributable data MUST
  call `requireRole` (or a derived helper) at its first instruction. This is
  enforced by code review at the bridge-surface security review gate (Slice
  2-style review on every feature that expands `operator.*` or adjacent
  namespaces).
- The `operator.*` namespace becomes the *template* for operator-aware
  namespaces in 005+. `sales.*`, `refunds.*`, `shifts.*` will follow the same
  self-gating shape.

---

**End of research.** All six decisions have decision + rationale + alternatives
+ implementation implications. No `NEEDS CLARIFICATION` items remain at the
research layer; the §A1 gate on the identity-model decision is documented
above and tracked in plan.md, not deferred to a later phase.
