# Phase 1 Data Model — 004-operator-session

**Plan:** [./plan.md](./plan.md) (v1.1)
**Research:** [./research.md](./research.md)
**Constitution version pinned:** v1.5.0

This document is the **conceptual entity sketch** for 004. It describes
entities, fields, relationships, lifecycle states, and validation rules —
**not** SQL DDL, not column types, not indexes, not migration files. Migration
authoring is gated on Approval Gate §A3 and happens in `/speckit-tasks`, not
here.

The five entities below partition into two groups:

- **Behavioural entities** (Operator, OperatorSession, Role, Shift) — the
  things the spec already named. This file restates their shape so future
  features cite a single source.
- **Implementation-required entities** (AuditEvent, plus the per-terminal
  PIN-factor record gated on §A1) — the new persistence shapes 004 introduces.

---

## Entity overview

```text
┌─────────────────────┐         ┌──────────────────────┐
│      Operator       │ 1     N │   OperatorSession    │
│  (Clerk-backed)     ├────────►│                      │
│                     │         │                      │
└─────────┬───────────┘         └──────────┬───────────┘
          │                                │
          │ 1                              │ N (acting_operator)
          │                                │
          ▼ (cashier role only)            ▼
┌─────────────────────┐         ┌──────────────────────┐
│ CashierPinRecord    │         │     AuditEvent       │
│ (per-terminal,      │         │ (append-only,        │
│  §A1-gated)         │         │  Clerk-attributed)   │
└─────────────────────┘         └──────────────────────┘

                                ┌──────────────────────┐
                                │        Shift         │
                                │ (operator-bound,     │
                                │  non-transferable)   │
                                └──────────────────────┘
```

Relationship rules (load-bearing):

1. An **Operator** is a Clerk user. There is no operator without a Clerk
   identity. (Principle VIII; AD-2.)
2. An **OperatorSession** has exactly one Operator (`acting_operator_id`).
3. An **OperatorSession** has exactly one originating Terminal (FK into 002's
   terminal-session model).
4. A **CashierPinRecord** has exactly one Operator (with role = `cashier`)
   and exactly one Terminal. The record is keyed by
   `(tenant_id, branch_id, terminal_id, operator_clerk_user_id)` (PR-4).
5. An **AuditEvent**'s `acting_operator_id` references the Operator (Clerk
   identity), never a CashierPinRecord. (AD-3 / FR-025.)
6. A **Shift** is operator-bound (FR-024); it has exactly one opening
   Operator. Its lifecycle state is one of `open`, `closed_normal`,
   `closed_forced`.
7. A `shift.forced_close` AuditEvent has TWO Operator references:
   `acting_operator_id` (the executing manager/admin) and `shift_owner_id`
   (the absent cashier).
8. A `cashier_pin_records` row's existence does NOT imply an active session
   for that cashier; sessions are independent and short-lived.

---

## Entity 1 — Operator

The operator entity. Clerk-backed. Behavioural shape only — most fields are
materialised from Clerk claims at sign-in time, not stored locally.

| Field | Type (conceptual) | Source | Notes |
|:--|:--|:--|:--|
| `id` | opaque string | Clerk user id | Stable; never reassigned. The audit-attribution key everywhere. |
| `display_name` | short string | Clerk user record | Visible on `OperatorBadge`; on cashier `RosterList`. No PII beyond this and `role` is exposed to renderer (FR-004 / FR-031). |
| `role` | enum `'cashier' \| 'manager' \| 'admin'` | Clerk user metadata | Closed catalogue; FR-002 / FR-002a. Machine identifier; business name (Cashier / Operator, Shift Manager, Owner / Admin) presented at the UI layer per FR-002. |
| `tenant_id` | opaque string | Clerk claim | Required for tenant scoping (FR-003 / P17). |
| `branch_authorisation` | set of opaque strings | Clerk claim | Branches the operator may sign in on (FR-003). |
| `enabled` | boolean | Clerk user metadata | Disabled accounts cannot sign in; sign-in failure surfaces as the generic message (NFR-003 / PR-2). |

**Local persistence**: NONE. The Operator entity is *not* persisted as a local
row. The cached identity used by the cashier sign-in path is held in the
operator-session store after sign-in (zustand, in-memory only) and re-fetched
from the backend on each sign-in. There is no local "users" table.

**Rationale for no local users table**: Principle VIII is verbatim: custom
user databases are PROHIBITED. Cashier identity provisioning happens in Clerk
+ the backend (a manager/admin action via the platform admin app); 004 does
NOT introduce a local mirror of that data. The `cashier_pin_records` table
(below) carries only the PIN factor, not the user record.

---

## Entity 2 — OperatorSession

The bound link between an Operator and a paired Terminal. New local table
`operator_sessions` (gated on §A3).

| Field | Type (conceptual) | Notes |
|:--|:--|:--|
| `id` | UUID v4 (client-generated at session start) | The session's stable id. Used as the `shift.session_id` reference for sensitive actions. |
| `acting_operator_id` | string (Clerk user id) | Required. FR-012. |
| `role` | enum (see Operator) | Cached at session start; the role at session creation is the role for the session's lifetime (no in-session role change in 004). |
| `tenant_id` | string | Cached at session start (FR-003 / P17). |
| `branch_id` | string | Cached at session start. |
| `originating_terminal_id` | string (FK into 002's terminal model) | FR-012. |
| `start_at` | timestamp | FR-012. |
| `end_at` | timestamp \| null | Null while session is active. |
| `end_cause` | enum or null | One of: `signed_out` (FR-008), `inactivity_timeout` (FR-009), `superseded_by_takeover` (FR-013), `terminal_session_terminated` (FR-014), `account_disabled_mid_session` (Edge Cases), or null while active. |

### Lifecycle

```
[create]  →  active  →  ended (immutable)
   ▲                       │
   │                       │
   └───── (no resurrection; a new session = new row, new id)
```

- **active**: `end_at IS NULL`. Exactly zero or one per Operator branch-wide
  (FR-013 — single active session per operator). Exactly zero or one per
  Terminal (FR-011).
- **ended**: `end_at IS NOT NULL`. Immutable from the rule level (audit
  history). Local SQLite enforces this via a trigger that denies `UPDATE`
  on rows where `end_at IS NOT NULL`.

### Validation rules

- `start_at IS NOT NULL`.
- `(end_at IS NULL) ⇔ (end_cause IS NULL)`.
- `end_at >= start_at` when both set.
- For any tenant, at most one row exists with the same
  `(acting_operator_id, end_at IS NULL)` (single-active-session-per-operator
  branch-wide; enforced at the bridge-API takeover-detection layer + a
  defensive partial unique index in the table).

### Why locally persisted (not just in-memory)

Three reasons require persistence:

1. **Inactivity timeout (FR-009)** must survive application restart. If the
   process restarts mid-session, the session must be recoverable so the
   inactivity timer's elapsed-time calculation is honest.
2. **Takeover stranded shift (Edge Case)** requires the `superseded_by_takeover`
   end-cause to be observable post-restart by the manager who needs to
   force-close the stuck shift.
3. **Audit attribution** for sensitive actions taken during the session
   requires the session id to be stable and queryable; a memory-only session
   cannot be referenced by an audit event after restart.

---

## Entity 3 — Role

Closed enumerated value type. Not a table; declared in
`src/shared/operator/role.ts`.

```
Role = 'cashier' | 'manager' | 'admin'
```

| Machine | Business name | Authority |
|:--|:--|:--|
| `cashier` | Cashier / Operator | Sales, cart, drawer actions during sale, shift open/close (own shift only) |
| `manager` | Shift Manager | Cashier surfaces + shift review + expected-cash + variance + forced close + supervisor overrides + manager-only reports/KPIs (branch-scoped) |
| `admin` | Owner / Admin | Manager surfaces + tenant-wide configuration |

The 1:1 machine ↔ business-name correspondence is normative (FR-002). Audit
records, route guards, and bridge-API gates use the **machine** identifier
exclusively; the **business** name is presented at the UI layer.

004 introduces NO custom permission engine, ABAC system, or capability
registry (FR-002a). The Role enum is the only access-control surface.

---

## Entity 4 — Shift (behavioural shape only — drawer-math fields out of scope)

The shift entity is **behaviourally** required by 004 (audit attribution
under FR-025/FR-026 references it) but its **drawer-math, expected-total,
variance, shortage, and overage fields are out of scope** (deferred to a
future shift-management feature).

004 commits to:

| Field | Type (conceptual) | Notes |
|:--|:--|:--|
| `id` | UUID v4 (client-generated at shift open) | The shift identity referenced by audit events. |
| `tenant_id` | string | P17 tenant-scoping. |
| `branch_id` | string | P17 / FR-024 branch-scoping. |
| `originating_terminal_id` | string | The terminal where the shift was opened. |
| `opening_operator_id` | string (Clerk user id, role = `cashier`) | FR-024 — operator-bound and non-transferable. |
| `lifecycle_state` | enum | Required by 004: `'open' \| 'closed_normal' \| 'closed_forced'`. Future shift feature MAY add states (e.g., `'reviewed'`); MUST NOT remove the three above. |
| `declared_count` | enum-like marker | Required by 004: one of `null` (=== absent — the explicit state on `closed_forced`; distinct from zero, distinct from matched), an integer minor-unit count (on `closed_normal`), or a sentinel "matched" (a future shift feature decides whether matched is a separate state or derived from `declared_count == expected_total`). 004 only commits to: `null` MUST be representable and MUST be distinguishable from a zero count. |
| `opened_at` / `closed_at` | timestamps | `closed_at` set on transition to `closed_normal` or `closed_forced`. |
| `expected_total`, `variance`, `shortage`, `overage`, `change_fund` | OUT OF SCOPE for 004 | Owned by the future shift-management feature. The Cashier-Forbidden Information catalogue (FR-015) names these as never visible to a cashier; 004 makes the *visibility commitment*, not the *computation*. |

### Lifecycle (the 004-committed portion)

```
[open]  →  closed_normal  (cashier shift-close path; cashier_attributed)
   │
   └───►  closed_forced   (manager/admin shift-forced-close path; both identities recorded)
```

- A shift opens at the cashier's first sensitive-action-eligible interaction
  on a terminal that has no open shift. (Future shift feature MAY pin
  shift-open to sign-in; 004 does not require this.)
- A `closed_normal` transition is attributed to the opening cashier in the
  resulting `shift.close` audit event.
- A `closed_forced` transition is attributed to the executing manager/admin
  in the resulting `shift.forced_close` audit event, with the absent cashier
  recorded as `shift_owner`.

### What 004 does NOT commit to about shift mechanics

- How the shift's `expected_total` is computed.
- The drawer-count UX surface.
- The variance / shortage / overage calculation.
- The reconciliation flow.
- The shift-review surface for managers (beyond reserving its existence).
- Whether and how shift entities sync to the backend.

These all belong to a separate future shift-management feature. 004's job is
to lock the *attribution contract* and the *blind-close commitment*; the
mechanics belong to the feature that owns the math.

---

## Entity 5 — AuditEvent

Append-only audit-event entity. New local table `audit_events` (gated on §A3).
The most load-bearing 004 entity.

| Field | Type (conceptual) | Notes |
|:--|:--|:--|
| `event_id` | UUID v4 | Client-generated at the moment of intent (P5 idempotency key). The same UUID is used as the backend-sync idempotency key. |
| `tenant_id` | string | P17 — required on every domain row. |
| `branch_id` | string | P17. |
| `originating_terminal_id` | string | FR-025(c). |
| `acting_operator_id` | string (Clerk user id) | FR-025(a). The **Clerk-backed** operator identity, never any PIN-record id (AD-3 / AD-2). |
| `session_id` | string (FK into operator_sessions.id) | The session in which the action was taken. May be null for actions executed during sign-in itself (e.g., a sign-in failure that produces a diagnostic audit). |
| `shift_id` | string (FK into shifts.id) | FR-025(b). May be null for actions where no shift is open (sign-in before shift-open, takeover that doesn't strand a shift). |
| `action_category` | enum (extensible) | FR-025(e) / FR-026. The closed set 004 commits to is in the Action Category Catalogue below. |
| `created_at` | timestamp | FR-025(d). |
| `approving_supervisor_id` | string (Clerk user id) \| null | FR-025(f). Set when the action required supervisor override. |
| `payload` | small structured blob | Action-specific structured fields. Schema per action category (see Catalogue). MUST NOT contain raw PII, raw cardholder data, credential fragments, PIN values, or session tokens (FR-027 / PR-1). |
| `synced_at` | timestamp \| null | Lives in a sibling table `audit_events_sync_state` keyed by `event_id` to preserve append-only-ness of `audit_events` itself. |

### Append-only enforcement

- Schema-level: SQLite triggers on `audit_events` deny `UPDATE` and `DELETE`.
  This is the *primary* enforcement and is non-negotiable.
- Rule-level: FR-028 + AD-3.
- Bridge-level: the `operator.emitAuditEvent` bridge handler is the only
  insertion path. There is NO `operator.updateAuditEvent` or
  `operator.deleteAuditEvent`. Corrections are new compensating events.
- The `synced_at` field's mutability is sidestepped by living in a sibling
  table (see above), so the append-only property of `audit_events` itself is
  unviolated.

### Validation rules

- `event_id IS NOT NULL` and is a valid UUID v4.
- `tenant_id IS NOT NULL`, `branch_id IS NOT NULL`,
  `originating_terminal_id IS NOT NULL`, `acting_operator_id IS NOT NULL`,
  `created_at IS NOT NULL`, `action_category IS NOT NULL`. (FR-025 mandatory
  five attributes — these five MUST all be present at the bridge-handler
  insertion point; partial records MUST be rejected.)
- `payload` is JSON-shaped and conforms to the per-action-category schema in
  the Action Category Catalogue.
- `(event_id, tenant_id)` is unique. (Idempotency: re-submitting the same
  event id within a tenant is a no-op.)

### Action Category Catalogue (the 004-committed minimum, per FR-026)

| Category | Required `payload` shape | Acting operator | Notes |
|:--|:--|:--|:--|
| `shift.open` | `{ shift_id, opened_at }` | the opening cashier | The shift's lifecycle is also written; this is the audit record for the open. |
| `shift.close` | `{ shift_id, closed_at, declared_count_state: 'numeric' \| 'matched' }` | the opening cashier | Cashier-attributed normal close. The actual `declared_count` value lives on the Shift row (drawer-math field), not in the audit payload — the audit only records *that* a close happened. |
| `shift.forced_close` | `{ shift_id, shift_owner_id, forced_close_actor_id, forced_close_reason: 'takeover_supersession' \| 'cashier_no_show' \| 'cashier_illness' \| 'terminal_failure' \| 'other', annotation?: string }` | the executing manager or admin (`acting_operator_id`) | Two identities recorded (FR-024). Free-text `annotation` MAY exist for support but MUST NOT replace the structural `forced_close_reason`. The cashier's `declared_count` is NOT in the payload (PR-1 / FR-024(a) blind-close discipline). |
| `operator.session.takeover` | `{ superseded_session_id, prior_terminal_reference }` | the operator confirming on the new terminal | Recorded under FR-013 when an operator confirms a takeover on a second terminal. The `prior_terminal_reference` MUST be an opaque internal id, not a user-visible terminal label. |
| `cashier.pin.reset` (S4 §A1-gated) | `{ target_cashier_id, terminal_id }` | the executing manager or admin | PR-5 — manager/admin-attributable. The PIN value is NEVER in the payload (PR-1). |
| `cashier.pin.unlock` (S4 §A1-gated) | `{ target_cashier_id, terminal_id }` | the executing manager or admin | PR-3 release path b / PR-5. |
| `operator.session.pin_unlock` (S4 §A1-gated, OPTIONAL) | `{ session_id, terminal_id }` | the cashier (post-unlock identity) | OPTIONAL low-severity diagnostic event. Manager/admin-readable only; cashier-readable NEVER. May be emitted at successful PIN unlock for forensic continuity; may be omitted if it adds noise without value. The plan recommends emitting it; the `/speckit-tasks` task may decide otherwise. |

Future features extend this catalogue but MUST NOT shrink it. The
`shift.close` and `shift.forced_close` categories MUST stay distinct
(FR-026); the `operator.session.takeover` and `shift.forced_close`
categories MUST remain separate audit events even when one strands the other
(FR-013 + FR-024 + Edge Cases).

---

## Entity 6 — CashierPinRecord (§A1-gated)

The local terminal unlock factor record. Per-terminal-scoped; sealed via
`safeStorage`. New local table `cashier_pin_records` (gated on §A1 + §A3).

**This entity does NOT exist if §A1 resolves via Alternative 1 (Clerk/password
for everyone).** It is gated on the local-unlock-factor approval; if that
gate denies AD-2, this entity falls away entirely.

| Field | Type (conceptual) | Notes |
|:--|:--|:--|
| `tenant_id` | string | PR-4. |
| `branch_id` | string | PR-4. |
| `terminal_id` | string | PR-4 — per-terminal scope. |
| `cashier_clerk_user_id` | string (Clerk user id) | PR-4 — keyed by Clerk identity, NOT a separate local user id (AD-2 / Principle VIII preservation). |
| `pin_hash` | bytes | Argon2id (research §1) hash of the PIN. NEVER stored in plaintext. NEVER transmitted off-device. |
| `pin_salt` | 16 random bytes | Per-record salt. |
| `failed_attempt_count` | non-negative integer | PR-3 — reset to 0 on successful unlock or lockout-timer expiry. |
| `lockout_until` | timestamp \| null | PR-3 — non-null while locked out; null otherwise. Wall-clock; persists across restart. |
| `created_at` | timestamp | When the PIN was set (initial provisioning or last reset). |
| `created_by_operator_id` | string (Clerk user id, role ∈ `manager` \| `admin`) | PR-5 — every PIN record was provisioned by a manager or admin (the `cashier.pin.provisioned` create-trail + the `cashier.pin.reset` change-trail together provide the durable history; this column is the most-recent-creator denormalisation for support queries. Provisioning trail added in 019 — FR-10). |

The composite key is
`(tenant_id, branch_id, terminal_id, cashier_clerk_user_id)`. A cashier
provisioned on two terminals has two independent rows; PR-3 lockout state on
terminal A does not affect terminal B (PR-4).

### Storage seal

The entire row is sealed via `safeStorage` at write time (Constitution v1.3.0
secret-storage rules). On a different machine or under a different Windows
user account, the row is unreadable. PR-4 explicitly cites this property: a
stolen `cashier_pin_records` table grants no capability beyond the same
Windows profile of the same paired terminal.

### Validation rules

- `cashier_clerk_user_id` MUST resolve (at provisioning time) to a Clerk user
  whose `role === 'cashier'`. A manager / admin cannot have a `cashier_pin_records`
  row.
- `pin_hash` IS NEVER `NULL` — a PIN record without a hash is a corrupt row
  (treat as missing per the failure-mode catalogue).
- `failed_attempt_count >= 0`.
- `lockout_until IS NOT NULL ⇔ failed_attempt_count >= 5`.

### Lifecycle

```
[create]  →  active  →  superseded (overwrite-in-place by next reset)
   ▲                       │
   │                       ├──►  locked-out (transient)
   │                       │
   │                       └──►  unlocked (back to active)
   │
   └───── PR-5 reset path (manager-attributable, audit-emitted)
```

- The "active → superseded" transition is *not* mutation of an audit-relevant
  field; the `cashier_pin_records` row IS overwritten on PIN reset (the
  prior `pin_hash` is discarded). The audit trail of the reset lives in the
  `audit_events` table (`cashier.pin.reset`), so the immutable history is
  preserved without making `cashier_pin_records` itself append-only.
- Lockout is a transient state on a single row; it does NOT spawn a separate
  audit event by default (the failed PIN attempts that caused the lockout
  may be diagnostic-logged per pino but are NOT audit events under FR-026).

### What CashierPinRecord IS NOT

- It is **not** a user identity record. Identity is in Clerk.
- It is **not** consulted by any backend endpoint.
- It is **not** the audit-attribution key for any sensitive action.
- It is **not** transferable across terminals or machines.
- Its absence does **not** mean "this cashier doesn't exist" — it means
  "this cashier doesn't have a PIN provisioned on this terminal yet"
  (a manager/admin provisions the first PIN via the dedicated **create** path
  `operator.provisionCashierPin` → `cashier.pin.provisioned`, added in
  019-cashier-pin-provisioning; `cashier.pin.reset` only *changes* an
  already-provisioned PIN — it is not the create path. Corrected per 019 FR-10).

---

## Migration outlook (descriptive, not authored here)

`/speckit-tasks` will produce migration tasks under §A3. The expected
ordering:

1. `NNN_audit_events.sql` (S3) — `audit_events` + `audit_events_sync_state`
   tables, append-only triggers.
2. `NNN_operator_sessions.sql` (S1 if backend doesn't return enough state to
   keep sessions in-memory only; S4 otherwise) — `operator_sessions` table,
   end-cause enum, partial unique index for single-active-session.
3. `NNN_cashier_pin_records.sql` (S4, gated on §A1) — `cashier_pin_records`
   table, `safeStorage` seal directive, PR-3 lockout fields.

The DDL itself is NOT in this file. data-model.md describes intent; the
migration files describe DDL. They MUST agree but are written separately.

---

**End of data model.** Five entities described, plus the §A1-gated
`CashierPinRecord`. All persistence shapes are conceptual; column types,
indexes, and migration files are deferred to `/speckit-tasks` per the gating
in plan.md.
