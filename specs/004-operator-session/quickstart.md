# Quickstart — 004-operator-session reviewer's walkthrough

**Plan:** [./plan.md](./plan.md) (v1.1)
**Spec:** [./spec.md](./spec.md)

This document is the reviewer's walkthrough for testing each user story
independently after each implementation slice. It is structured as a
numbered set of *checkable* steps that an unfamiliar agent or human can
follow cold to validate the slice's claim.

> **Status of this file**: 004 is in `/speckit-plan` phase. **Slice 0
> (visual direction) and Slices 1–6 are not yet implemented**, gated on
> Approval Gates §A1–§A4 (plan.md). Sections marked **🔒 §A1-gated** below
> require §A1 approval before they can be reviewed; until then, attempting
> them will fail because the cashier-PIN code path does not exist.

---

## Prerequisites

1. POS Pulse repo cloned, on branch `004-operator-session`.
2. Foundation, terminal-pairing, and POS UI shell features (001/002/003)
   present at known-good commits on `main`.
3. A Windows 10/11 x64 development environment with the constitution v1.5.0
   tech-stack baseline (Electron 40, Node + npm).
4. A test pharmacy (test tenant + test branch + test terminal) provisioned
   in the SmartDataPulse backend, with at least:
   - One manager Clerk user (role = `manager`) authorised on the branch.
   - One admin Clerk user (role = `admin`) authorised on the tenant.
   - Two cashier Clerk users (role = `cashier`) authorised on the branch.
5. The current terminal **already paired** to the test branch via 002. (If
   not paired, run the 002 quickstart first; this feature does not pair.)

---

## Slice 0 — Visual Direction (non-code review)

**Status**: REQUIRED before any of Slices 1–6 may merge (FR-033). Non-code.

### Steps

1. Open `specs/004-operator-session/visual-direction/` (or the directory the
   visual direction author placed the contact sheet under). Confirm a
   reviewable contact sheet exists covering all six S0 deliverables from
   plan.md §"Phase 2 — Visual Direction":

   - [ ] Cashier sign-in: roster + PIN, default state.
   - [ ] Manager / admin sign-in: password, default state.
   - [ ] Explicit takeover prompt (3-button modal).
   - [ ] Forced-close manager recovery surface.
   - [ ] Role indicator for each of the three roles, in 003's role-indicator
         slot.
   - [ ] Generic sign-in failure state (single error variant + lockout
         variant per PR-2/PR-3).

2. Confirm the contact sheet is reviewed against:
   - [ ] 003's design tokens (color, spacing, typography, radius, shadow).
   - [ ] 003's `comfortable` density.
   - [ ] 003's navigation rail behaviour at ≥ 1280 px and 1024–1279 px.
   - [ ] 003's connection-state visuals (four states, where they appear
         during sign-in).
   - [ ] 003's role-indicator slot reservation.
   - [ ] Keyboard path through every surface.
   - [ ] axe-rule cleanliness on default-state mocks.
   - [ ] Focus-ring visibility at every interactive element.

3. Confirm the review record itself is checked into the repo (a `.md` file
   under `visual-direction/`) listing the reviewer, the date, and any
   findings or revisions. **No implementation slice may merge before this
   record exists.**

### Pass criteria

All checkboxes ticked. Review record present. No outstanding findings that
contradict 003's locked decisions.

---

## Slice 1 — Manager / admin sign-in (Clerk-only path)

**Status**: Available after S1 merge. Does NOT require §A1 (manager/admin
auth is pure Clerk).

### User Story 1, P1 path (manager / admin)

1. **Boot a paired terminal.** Launch POS Pulse on the test terminal.
   - **Expected**: The application opens directly to `/sign-in`. No
     manager/admin/cashier surface is reachable.
   - **Why**: FR-005 — Sign-In is the only reachable route while no
     operator session is active.

2. **Sign in as a manager.** Enter the manager's identifier; enter their
   password; submit.
   - **Expected within 5 s**: The shell transitions to the role-appropriate
     landing surface. The role indicator displays the manager's display
     name and "Shift Manager" badge.
   - **Why**: FR-007 (5 s budget) + FR-020 (role indicator updates).

3. **Navigate the shell.** Confirm the role indicator persists; the manager
   has access to all cashier surfaces plus manager-only surfaces (which are
   placeholder shells in S1).
   - **Expected**: All routes a cashier could reach are reachable; manager-
     only routes resolve (even if their content is placeholder).

4. **Sign out.** Trigger sign-out.
   - **Expected within 1 s**: The shell returns to `/sign-in`. The role
     indicator is empty. No operator-scoped state is observable.
   - **Why**: FR-008 + NFR-007.

5. **Repeat steps 2–4 as the admin Clerk user.**
   - **Expected**: Same flow; role indicator displays "Owner / Admin".

### Generic-failure tests (NFR-003 / PR-2)

6. **Wrong password.** Enter the manager's identifier; enter a wrong
   password; submit.
   - **Expected**: Single generic message — "credentials not recognised".
   - **MUST NOT**: Any message that reveals "wrong password" vs "no such
     account" vs "tenant mismatch".

7. **Wrong tenant.** Use credentials for an operator authorised on a
   *different* tenant.
   - **Expected**: Same generic "credentials not recognised" message; no
     disclosure that the operator exists elsewhere.

8. **Network unreachable (NFR-011 fail-closed for new sign-in).**
   Disconnect the terminal's network; attempt sign-in as a manager.
   - **Expected**: A "No connection. Please check the network and try
     again." message (the generic `no_connection` variant per NFR-003 /
     PR-2). The connection-state indicator transitions to `offline` per
     003's four-state model. **No operator session is created.** The
     shell does NOT optimistically transition to the operator-bound
     landing surface (P2 — no fake success states).
   - **NFR-011 cross-check**: while still offline, attempt cashier sign-in
     (after S4 lands the cashier path). The cashier roster view is
     reachable (it is rendered from cached state per Endpoint 1's prior
     fetch, with a banner indicating stale data); attempting to enter
     a PIN and submit MUST also fail with `no_connection` (the cashier
     path's Endpoint 6 takeover-detection step cannot complete offline,
     so sign-in is refused). **No operator session is created** even if
     the local PIN happens to verify — local PIN unlock alone is not a
     sign-in (NFR-011, AD-2).

### Existing offline session continuation (NFR-011)

8a. **Sign in while online; then disconnect mid-session.** Sign in as a
    manager while the network is reachable. Disconnect the network. Wait
    a few seconds.
    - **Expected**: The shell remains visible; the OperatorBadge still
      shows the manager's identity. The connection-state indicator
      transitions to `offline`. Backend-dependent placeholder actions
      surface the existing 003 `no_connection` / `degraded` UX rather
      than appearing to succeed. **Cashier-Forbidden Information
      catalogue items remain forbidden offline** — a cashier signed in
      offline (after S4) MUST NOT reach a manager-only surface even
      though the bridge cannot freshly verify the role, because the
      role is cached at session creation time and `requireRole` operates
      against the cached value (NFR-004 — deterministic role boundary;
      NFR-011 — role boundary holds offline as strictly as online).

8b. **Local sign-out / inactivity timeout while offline.** While offline
    and signed in, invoke explicit Sign-Out OR wait for the 15-minute
    inactivity timer (FR-009).
    - **Expected**: The local operator session terminates with the
      correct `end_cause` (`signed_out` or `inactivity_timeout`); the
      shell returns to `/sign-in`; any consequent audit events queue
      in the local outbox for sync when connectivity returns (P3 / P5);
      the next sign-in attempt while still offline fails closed per
      step 8.

### Logging redaction (FR-030 / PR-1)

9. Open the local pino log file. Search for the manager's password.
   - **MUST**: Zero occurrences. Search for `password`, the literal value,
     and any partial fragment.

10. Search for the Clerk JWT or any session token.
    - **MUST**: Zero occurrences in plaintext.

### Pass criteria

Steps 1–10 all pass. Cross-process redaction smoke test (extending 002's)
passes in CI.

---

## Slice 3 — Audit-event scaffolding (🔒 §A1-gated)

**Status**: Available after S3 merge. Requires §A1 + §A3 + §A2.

### Test path

1. Sign in as a manager (Slice 1 flow).
2. Trigger a sensitive action that emits an audit event. (In S3, this is a
   *placeholder* path — no real refund / void exists yet; S3 ships a debug
   bridge endpoint `operator.emitAuditEvent.test` that emits a
   well-formed event with a contrived category. Production code paths
   that emit audit events land in S4+.)
3. Open the local SQLite store; query the `audit_events` table.
   - **Expected**: One row with `event_id` (a valid UUID v4),
     `acting_operator_id` (the manager's Clerk user id),
     `originating_terminal_id`, `tenant_id`, `branch_id`, `created_at`,
     `action_category`. The five FR-025 mandatory attributes are present.
   - **MUST NOT**: PIN values, Clerk JWTs, password fragments, or any
     credential material in `payload`.

4. Trigger the same audit event a second time with the *same* `event_id`
   (idempotency replay test).
   - **Expected**: One row total in `audit_events` (idempotent dedup
     through the unique constraint on `event_id`).

5. Disconnect the network; trigger an audit event.
   - **Expected**: The row is written locally; `synced_at IS NULL`.

6. Reconnect the network; wait for the sync interval.
   - **Expected**: The `audit_events_sync_state` table now has a row with
     `synced_at IS NOT NULL` for the queued event_id; the audit log on the
     backend has the corresponding entry.

### Pass criteria

Steps 1–6 all pass. The `audit_events` table refuses `UPDATE` and `DELETE`
attempts (verified by attempting them via raw SQL — they MUST fail).

---

## Slice 4 — Cashier sign-in (PIN as local unlock factor) (🔒 §A1-gated)

**Status**: Available after S4 merge. Requires §A1 + §A2 + §A3 + §A4.

### Provisioning the test cashier (PR-5 manager flow)

1. Sign in as the manager (Slice 1 flow).
2. Navigate to the cashier-management surface (manager-only).
3. Provision an initial PIN for cashier 1 (`cashier.pin.reset` flow):
   - Pick cashier 1 from the cashier list.
   - Enter a 4-digit PIN (e.g., `1234`).
   - Submit.
   - **Expected**: A `cashier.pin.reset` audit event is emitted, attributed
     to the manager, referencing cashier 1.
   - **MUST NOT**: The PIN value (`1234`) appears anywhere in the audit
     payload, the log, or the support bundle.
4. Sign out.

### User Story 1, P1 path (cashier)

5. **Boot the paired terminal** (still no operator session).
   - **Expected**: `/sign-in` renders. The cashier roster is visible (display
     name + role badge per cashier), populated for the test branch. Email
     and phone of cashiers are NOT visible.

6. **Pick cashier 1 from the roster.** Enter the PIN `1234`. Submit.
   - **Expected within 5 s**: Shell transitions to the cashier-bound
     landing surface. Role indicator displays cashier 1's name + "Cashier
     / Operator" badge. PR-3 `failed_attempt_count` is reset to 0 in
     `cashier_pin_records`.

7. **Navigate the shell as cashier.** Confirm:
   - All cashier-allowed routes are reachable.
   - Manager-only routes return the generic "this section is not available
     for your role" surface (FR-016).
   - Forced-URL navigation to a manager-only route does NOT briefly render
     manager content (NFR-009).
   - The Cashier-Forbidden Information catalogue items (shift totals,
     expected drawer cash, variance, shortage, overage, reports, KPIs,
     manager review, audit log surfaces) are absent from every cashier-
     reachable route.

8. **Sign out.** Confirm the shell returns to `/sign-in` within 1 s and the
   role indicator clears.

### PR-3 lockout test

9. Re-launch / return to `/sign-in`. Pick cashier 1. Enter wrong PIN
   (e.g., `0000`). Submit.
   - **Expected**: Generic "credentials not recognised" message.
10. Repeat step 9 four more times in quick succession (5 wrong attempts
    total).
    - **Expected**: On attempt 5, generic message; in
      `cashier_pin_records`, `failed_attempt_count = 5` and `lockout_until
      = now + 5 min`.
11. Attempt sign-in for cashier 1 with the *correct* PIN (`1234`).
    - **Expected**: Generic "too many attempts — wait a moment before
      trying again" message (PR-3 release path a, until timer expires).
    - **MUST NOT**: The message reveal lockout duration, that the PIN was
      correct this time, or any detail beyond the generic family.
12. Wait 5 minutes (or run the test with a configurable timer).
    - **Expected**: After timer expiry, sign-in for cashier 1 with
      `1234` succeeds (`failed_attempt_count` resets to 0, `lockout_until`
      becomes null).

### PR-3 manager unlock path

13. Repeat steps 9–10 to lock cashier 1 out again.
14. Sign in as the manager.
15. Navigate to the cashier-management surface; pick cashier 1; trigger
    `cashier.pin.unlock`.
    - **Expected**: A `cashier.pin.unlock` audit event is emitted,
      attributed to the manager, referencing cashier 1.
16. Sign out as the manager. Sign in as cashier 1 with `1234`.
    - **Expected**: Sign-in succeeds without the timer having expired.

### PR-1 redaction test

17. Open the local pino log. Search for the PIN value `1234`.
    - **MUST**: Zero occurrences across all log streams, including the
      `cashier.pin.reset` and `cashier.pin.unlock` log lines that DO exist
      to record the action.
18. Generate a support bundle. Search the bundle for the PIN value.
    - **MUST**: Zero occurrences.

### PR-4 per-terminal scope test (requires a second paired terminal)

19. On terminal B (also paired to the same branch), boot. Pick cashier 1
    from the roster (which IS visible on terminal B because the roster is
    backend-fetched).
    - **Expected**: Generic "credentials not recognised" message
      regardless of PIN entered, because cashier 1 has no
      `cashier_pin_records` row on terminal B yet (PR-4 per-terminal
      scope).
20. Sign in as the manager on terminal B and provision a different PIN
    (e.g., `5678`) for cashier 1 on terminal B.
21. On terminal B, sign in as cashier 1 with `5678`. Succeeds.
22. On terminal A, sign in as cashier 1 with `1234`. Still succeeds —
    PIN A is unaffected by PIN B per PR-4.

### Takeover test (US1-AS6, FR-013)

23. With cashier 1 signed in on terminal A, on terminal B sign in as
    cashier 1 (PIN `5678`).
    - **Expected**: Terminal B presents the takeover prompt — generic
      copy ("You are already signed in on another POS terminal in this
      branch. Continue here and sign out there?") — without naming
      terminal A.
24. Pick "Continue here".
    - **Expected**: Terminal B becomes cashier 1's active session. An
      `operator.session.takeover` audit event is emitted, attributed to
      cashier 1, referencing terminal A. Terminal A returns to `/sign-in`
      on its next interaction or within 30 s, whichever first.
25. Repeat step 23, but pick "Cancel" instead.
    - **Expected**: No session is created on terminal B. Terminal A is
      unaffected.

### Pass criteria

Steps 1–25 all pass. The cross-process redaction smoke test passes with
the new PIN-handling sites covered. Coverage on the PIN-verifier module
≥ 95 %.

---

## Slice 5 — Forced-close manager surface (🔒 §A1-gated)

**Status**: Available after S5 merge. Requires §A1 + §A2.

### Setup: produce a stuck shift

1. On terminal A, sign in as cashier 1 (Slice 4).
2. Trigger the placeholder sensitive-action path that opens a shift (`shift.open`).
3. On terminal B, sign in as cashier 1 (PIN `5678`); confirm the takeover
   prompt with "Continue here".
   - **Expected**: Cashier 1's session on terminal A is terminated
     (`operator.session.takeover` audit event); the shift on terminal A
     remains *open*, *stuck*, and *operator-bound to cashier 1* (Edge
     Cases — takeover-stranded shift).

### Forced-close test (FR-024 / S5)

4. Sign in as the manager.
5. Navigate to the manager-only stuck-shift surface.
   - **Expected**: The stuck shift on terminal A appears in the list with:
     opener (cashier 1), opened-at timestamp, terminal label.
6. Click `[Forced close]` for the stuck shift.
   - **Expected**: The forced-close form opens with: a reason picker (fixed
     enumerated set per FR-024(c) — `takeover_supersession`, `cashier_no_show`,
     `cashier_illness`, `terminal_failure`, `other`), an optional free-text
     annotation field (clearly marked as not-the-reason-field), confirm and
     cancel buttons.
   - **MUST NOT**: A drawer-count entry field, an expected-total display,
     a variance display, or any of the Cashier-Forbidden Information
     catalogue items (FR-024(a) — manager records the cashier's *absence
     of declared count*, not a count on the cashier's behalf).

7. Pick reason `takeover_supersession`. (Optional: enter a free-text
   annotation.) Confirm.
   - **Expected**: A `shift.forced_close` audit event is emitted with
     `acting_operator_id` = manager, `shift_owner_id` = cashier 1,
     `forced_close_actor_id` = manager, `forced_close_reason =
     takeover_supersession`. The annotation, if provided, lives in
     `payload.annotation` separate from `forced_close_reason`. The shift's
     `lifecycle_state` transitions to `closed_forced`. The shift's
     `declared_count` is recorded as **null / absent**, distinct from zero
     and distinct from matched.

### Audit-event separation (FR-013 + FR-024 cross-rule)

8. Query the `audit_events` table for cashier 1's events.
   - **Expected**: Two events linked by `cashier 1` identity but
     otherwise separate: the `operator.session.takeover` event from step 3
     (originating terminal = B, acting operator = cashier 1) and the
     `shift.forced_close` event from step 7 (originating terminal =
     wherever the manager was, acting operator = manager).
   - **MUST NOT**: A merged audit record that conflates the two.

### Cashier-returns-after-forced-close (Edge Cases)

9. Sign out as the manager.
10. On terminal A, sign in as cashier 1 (PIN `1234`).
    - **Expected**: Sign-in succeeds. The shell may show an informational
      notice that cashier 1's prior shift was force-closed, but MUST NOT
      reveal: the closed shift's expected total, declared count (which
      is null), variance, shortage, or overage.

### Cashier visibility test (FR-024(d))

11. On terminal A, while signed in as cashier 1 (or any cashier), enumerate
    all reachable routes.
    - **MUST NOT**: Any route resolves to the manager-only stuck-shift
      surface or the forced-close form. The presence of a stuck shift on
      this terminal MUST NOT be visible on any cashier-reachable surface.

### Pass criteria

Steps 1–11 all pass. The `shift.forced_close` audit event is structurally
distinct from `operator.session.takeover`. Cashier 1 cannot infer the
forced-close financial details from any reachable surface.

---

## Slice 6 — Final polish (small)

**Status**: Available after S6 merge. No new functional surface; final polish.

### Test path

1. Run the full Slice-1-through-Slice-5 walkthrough above end-to-end.
   - **Expected**: All previously-passing tests still pass.
2. Open the screenshot/contact-sheet review against Slice 0 deliverables.
   - **Expected**: No outstanding inconsistencies between the implemented
     surfaces and the Slice 0 visual direction.
3. Open `docs/runbook/operator-session.md`.
   - **Expected**: Five sections — "I can't sign in", "What is this
     takeover prompt", "How do I close a stuck shift", "Inactivity
     timeout policy", "PIN lockout and reset procedure".
4. Open the project root `CLAUDE.md`. Confirm the `<!-- SPECKIT START -->`
   block points to the 004 plan (or marks 004 complete and points to the
   next active feature).

### Pass criteria

End-to-end walkthrough passes. Final-polish PR is ≤ ~200 LOC diff (FR-035 /
P13 — final polish MUST be small).

---

## Production readiness checklist (before tenant rollout)

Per plan.md §"Production Readiness (P15)" and Approval Gate §A5.

- [ ] Test plan: all Vitest CI green on `windows-latest`.
- [ ] Manual SC-003 walkthrough: 20+ access paths attempted as cashier;
      zero reach a manager-only surface.
- [ ] Manual takeover scenario across two physical terminals.
- [ ] Manual forced-close scenario.
- [ ] Manual PIN-lockout scenario (timer + manager-unlock paths).
- [ ] Support-bundle export with at least 50 audit events + 5 PIN failure
      diagnostic events; PIN values appear nowhere; operator identifiers
      are opaque references; no Clerk JWTs; no session tokens.
- [ ] Per-tenant rollout sequence agreed with customer success.
- [ ] PIN-lockout and PIN-reset behaviour documented in customer-facing
      onboarding.

When all checked, the production-rollout PR is eligible for merge per §A5.

---

**End of quickstart.** Reviewers may follow this document cold to validate
each user story independently. Steps marked **🔒 §A1-gated** require §A1
approval before they apply.
