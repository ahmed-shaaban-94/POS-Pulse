# Feature Specification: Terminal Pairing

**Feature ID:** 002-terminal-pairing
**Status:** Draft (clarified, analysis-revised)
**Created:** 2026-05-02
**Last Updated:** 2026-05-03 (NFR-2 amended per analysis finding M2)
**Owner:** POS-Pulse desktop team

---

## Overview

A freshly installed POS-Pulse Windows terminal is anonymous: it has no identity, no tenant, and no
branch assignment. Terminal Pairing is the one-time setup ceremony in which an operator binds the
physical terminal to a specific tenant, branch, and terminal slot using a short-lived pairing code
(typed manually or scanned via a keyboard-wedge scanner). On success the terminal receives a durable
*device token* — the terminal's machine identity — which authorises every subsequent backend call.
Pairing must complete before any cashier-facing functionality (login, sales, inventory) can be
unlocked in later features.

## User Scenarios & Testing

### Primary User Story

A pharmacy installer (typically a branch manager or IT helper) starts the POS-Pulse application on a
new Windows terminal for the first time. Because the terminal has no device token, the application
opens directly into the Pairing screen and asks for a pairing code. The installer obtains the code
from the SmartDataPulse admin console (web), then either types it into the input field or scans the
QR printout with a keyboard-wedge scanner (which emits the code as keystrokes followed by Enter).
The terminal contacts the backend pairing endpoint, securely persists the returned device token,
and shows the assigned branch and terminal label. The installer confirms the label matches the
physical terminal location and hands the device over for normal use. On every subsequent launch
the terminal recognises that it is already paired and does not show the Pairing screen again.

### Acceptance Scenarios

Each scenario uses Given / When / Then phrasing. Each MUST be testable without naming an
implementation.

1. **First launch on an unpaired terminal**
   - **Given** a freshly installed terminal with no stored device token
   - **When** the application starts
   - **Then** the user is presented with the Pairing screen and cannot bypass it to reach any
     cashier feature.

2. **Successful pairing via manual code entry**
   - **Given** the Pairing screen is visible and the operator has a valid, unexpired, unused
     pairing code
   - **When** the operator types the code and submits
   - **Then** within 5 seconds the terminal displays the assigned tenant name, branch name, and
     terminal label, and a confirmation that the terminal is paired.

3. **Successful pairing via QR scan**
   - **Given** the Pairing screen is visible with focus on the code input
   - **When** the operator scans the QR printout with a keyboard-wedge scanner that emits the
     code followed by Enter
   - **Then** the terminal completes pairing without any additional keypress and shows the same
     confirmation as the manual flow.

4. **Persistent pairing across restarts**
   - **Given** the terminal is already paired and the application is running
   - **When** the operator closes and re-opens the application (or restarts the host machine)
   - **Then** the application starts directly into the post-pairing state without prompting for a
     pairing code.

5. **Invalid code rejected with safe message**
   - **Given** the Pairing screen is visible
   - **When** the operator submits a code the backend rejects as invalid
   - **Then** the application shows a friendly "code not recognised — check the code and try
     again" message, leaves the input field editable, and does not store any device token.

6. **Expired code rejected with safe message**
   - **Given** the Pairing screen is visible
   - **When** the operator submits a code the backend rejects as expired
   - **Then** the application shows a "this code has expired — generate a new one in the admin
     console" message and does not retry automatically.

7. **Already-paired code rejected with safe message**
   - **Given** the Pairing screen is visible
   - **When** the operator submits a code that has already been consumed
   - **Then** the application shows an "this code has already been used" message and does not
     store any device token.

8. **Branch mismatch rejected with safe message**
   - **Given** the operator is re-pairing a previously paired terminal that is being moved between
     branches
   - **When** the backend reports a branch mismatch
   - **Then** the application shows an explanatory message (e.g., "this terminal is registered to a
     different branch — ask your administrator to release it before pairing here") and does not
     overwrite any existing token.

9. **Rate-limited pairing attempts**
   - **Given** the operator has submitted several rejected codes in quick succession
   - **When** the backend returns a rate-limit response
   - **Then** the application shows a "too many attempts — wait a moment before trying again"
     message and disables the submit button for at least the duration indicated by the backend.

10. **Sensitive values never leave the device in plaintext logs**
    - **Given** any of the above scenarios produces a log entry
    - **When** the resulting log file is opened
    - **Then** neither the pairing code nor the device token appears anywhere in the log.

### Edge Cases

- The operator submits an empty or whitespace-only code → the application surfaces a client-side
  validation message and never calls the backend.
- The operator submits a code while offline → the application shows a "no connection — check the
  network and try again" message; no token is stored and no log entry contains the code.
- The keyboard-wedge scanner sends the code without a trailing Enter → the operator must press
  Enter manually; the application MUST NOT auto-submit on focus or on partial input.
- The application is force-killed mid-pairing after the backend has consumed the code but before
  the token was persisted → on next launch the application returns to the Pairing screen, the
  original code is now "already used", and the operator must request a new code from the admin.
- A previously paired terminal launches but the secure storage is unavailable on this Windows
  profile (e.g., DPAPI cannot decrypt) → the application refuses to operate as paired, surfaces a
  diagnostic message, and routes back to the Pairing screen rather than silently downgrading to an
  unauthenticated state.
- A failed pairing attempt for any backend reason MUST leave the terminal in the same anonymous
  state it was in before the attempt (no partial token, no partial assignment).

## Requirements

### Functional Requirements

Each requirement is testable, unambiguous, and uses MUST/SHOULD/MAY.

- **FR-1.** The application MUST route the operator into the Pairing screen if and only if at
  least one of the following is true at startup or during runtime:
  (a) no device token is stored locally,
  (b) the backend indicates the current device token is revoked or otherwise invalid, or
  (c) the local secure-storage entry for the device token is missing, unreadable, or corrupt.
  In any other case the application MUST proceed to the post-pairing state without prompting.
- **FR-2.** The Pairing screen MUST accept a single pairing code as input from either keyboard
  typing or a keyboard-wedge scanner, with no separate "scan" mode required.
- **FR-3.** The Pairing screen MUST submit the code to the backend pairing endpoint using the
  contract defined for that endpoint (one request, one response).
- **FR-4.** On a successful pairing response the application MUST persist the returned device
  token to secure local storage and the returned tenant, branch, terminal identifier, and
  terminal label to local application state.
- **FR-5.** After successful pairing the application MUST display the tenant name, branch name,
  and terminal label so the operator can confirm the assignment is correct.
- **FR-6.** The application MUST treat each pairing code as one-shot: a code accepted by the
  backend MUST NOT be re-submitted by the application even if the user retries the screen.
- **FR-7.** The application MUST surface every documented backend failure (invalid, expired,
  already paired, branch mismatch, rate limited) as a distinct, human-readable message that names
  the user-facing recovery action.
- **FR-8.** A failed pairing attempt MUST NOT alter any persisted device-identity state on the
  terminal.
- **FR-9.** The application MUST NOT log the pairing code, the returned device token, or any
  substring of either, in any log destination (file, console, telemetry) at any log level.
- **FR-10.** The application MUST NOT include the pairing code or device token in any crash
  report or telemetry payload, regardless of whether telemetry is currently active.
- **FR-11.** Once paired, the application MUST present subsequent application launches in the
  post-pairing state without requiring the operator to submit a code again, until the terminal is
  explicitly unpaired.
- **FR-12.** Reassigning a terminal to a different branch MUST require a fresh pairing ceremony;
  the application MUST NOT silently switch branches based on a server response.
- **FR-13.** The application MUST NOT expose a self-service "Unpair" or "Reset terminal identity"
  action to the operator in this feature. Re-pairing is initiated from the admin console (which
  revokes or reassigns the terminal and issues a new one-shot pairing code); the terminal then
  enters the Pairing screen by way of FR-1 (b) or (c). No clean reinstall is required for normal
  re-pairing.
- **FR-14.** A `BRANCH_MISMATCH` response on a pairing attempt MUST preserve any existing valid
  device token unchanged; the application MUST NOT delete, overwrite, or invalidate the prior
  token as a side effect of a failed attempt.

### Non-Functional Requirements

- **NFR-1.** Time-to-paired: from the moment the operator submits a valid code, the post-pairing
  confirmation MUST appear within 5 seconds at the 95th percentile under normal network
  conditions.
- **NFR-2.** Resilience: the Pairing screen MUST remain non-frozen during a submit — the window
  stays responsive, no UI thread is blocked. The submit button MAY be disabled while a request
  is in flight; the operator MAY retry **after** the request returns or after a client-side
  timeout (currently 30 seconds). An explicit user-visible "cancel" affordance is **not**
  required in MVP and is deliberately omitted to keep the bridge surface narrow; if the backend
  is unreachable beyond the timeout, the form re-enables and the operator can retry. (Amended
  2026-05-03 from the original "cancel/retry possible" wording — see analysis finding M2.)
- **NFR-3.** Confidentiality at rest: the device token MUST be stored such that it is not readable
  as plaintext by another local Windows user account on the same machine.
- **NFR-4.** Confidentiality in observability: pairing-related log entries MUST be safe to upload
  to a support channel without redaction; that is, they MUST NOT contain secrets to begin with.
- **NFR-5.** Single-attempt safety: rate-limiting feedback from the backend MUST be honoured by
  the UI (submit disabled for the indicated duration) so the operator cannot accidentally exhaust
  attempts.
- **NFR-6.** Audit clarity: every pairing attempt (success or failure) MUST produce exactly one
  structured log entry capturing the outcome category (e.g., success, invalid, expired, already
  paired, branch mismatch, rate limited, network error) and a coarse timestamp, with no
  identifying values beyond what is needed to triage.

## Success Criteria

Measurable, technology-agnostic outcomes. The feature is "done" when these are demonstrably true.

- **SC-1.** A first-time installer can pair a new terminal end-to-end (open application → submit
  code → see confirmation) in under 60 seconds.
- **SC-2.** ≥ 95% of valid-code submissions complete (confirmation visible to operator) within 5
  seconds.
- **SC-3.** 100% of paired terminals reopen on the post-pairing state (no Pairing screen) on at
  least the next 50 consecutive launches without user intervention.
- **SC-4.** 0% of pairing-related log lines, sampled across all five failure categories plus
  success, contain the pairing code or device token (verified by automated scan of generated
  logs).
- **SC-5.** Each documented failure mode (invalid, expired, already paired, branch mismatch,
  rate limited) presents a distinct user-facing message; an operator who reads the message can
  describe the next action without opening documentation.

## Key Entities

- **Pairing Code** — a short-lived, one-shot secret that the operator copies (manually or via
  scanner) from the admin console into the terminal. Not persisted on the device.
- **Device Token** — the terminal's durable machine identity issued on successful pairing.
  Persisted securely on the device. Treated as a secret; never displayed or logged.
- **Terminal Assignment** — the (tenant, branch, terminal-slot, terminal-label) tuple returned
  alongside the device token. Persisted on the device for display and routing; not secret on its
  own but considered configuration state.
- **Pairing Attempt Log Record** — a structured local log entry describing the outcome category
  and timestamp of one pairing attempt. Contains no secrets.

## Assumptions

- The pairing code's format and TTL are owned by the backend; the terminal does not enforce its
  own format rules and does not display any pre-submission countdown.
- Pairing requires network connectivity. Offline pairing is not supported and is not in scope.
- The keyboard-wedge scanner emits the code as plain keystrokes, optionally followed by Enter,
  into whichever input element currently has focus. The terminal does not need a separate
  scanner-driver integration.
- The terminal launches into a single-window experience; routing into the Pairing screen on an
  unpaired terminal blocks navigation to any other surface until pairing succeeds.
- A device token, once issued, remains valid until the backend revokes or rotates it. Token
  rotation, revocation handling, and token refresh on the terminal side are out of scope for this
  feature.
- The application surfaces only outcome categories from the documented failure modes plus a
  generic "network error" category; finer-grained backend error codes are not exposed to the
  operator in this feature.
- Telemetry-style observability remains inert unless an operator-supplied configuration enables
  it; pairing does not flip that switch.
- The desktop terminal participates as a confidential client only insofar as it holds a device
  token; user (cashier) authentication is a separate concern handled by a later feature.
- Re-pairing is admin-console-driven. The admin revokes or reassigns the terminal and issues a
  new one-shot pairing code; the terminal does not need (and does not expose) an in-app unpair
  action to enter the Pairing screen.

## Out of Scope

Explicitly NOT delivered by this feature. Items here block scope creep and inform the next
feature's planning.

- Cashier (user) login, cashier sessions, role-based access.
- Sales, cart, receipts, returns, voids, inventory, offline sync queues.
- Admin-side pairing UI (issuing pairing codes, listing terminals, releasing terminals between
  branches). The terminal trusts the admin console to do this.
- Self-service unpairing on the terminal: the operator cannot wipe a paired terminal's identity
  from inside the application in this feature. Release / re-pair is initiated from the admin
  console only (clarification 2026-05-03 — Option B).
- Multi-tenant terminals: a terminal is assumed to belong to exactly one tenant + branch +
  terminal slot at a time.
- Generic Clerk/identity-provider login flows. Pairing is terminal identity, not user identity.
- Telemetry/Sentry configuration changes; pairing emits no telemetry beyond the local structured
  log unless telemetry is already independently enabled.
- Device-token rotation, refresh, and revocation handling on the terminal.

## Dependencies

- **001-foundation** — supplies the secure local storage abstraction, the local structured
  logging facility, the generated backend type contract, and the local SQLite/migration runner
  that this feature consumes for any persistent state.
- **SmartDataPulse backend** — owns the `POST /api/v1/terminals/pair` endpoint, the pairing-code
  lifecycle (issuance, TTL, one-shot consumption, rate limiting), and the device-token issuance
  and assignment policy.
- **SmartDataPulse admin console** — issues pairing codes and (per Open Question 1) is the surface
  on which a terminal is released for re-pairing.
- **Constitution v1.3.0** — every flow in this feature MUST honour the platform integration,
  hardware matrix, and PII-handling principles defined there.

## Open Questions

- (none)

## Clarifications

### 2026-05-03 — Re-pairing trigger (Option B: admin-console-driven only)

The terminal does not expose a self-service "Unpair" or "Reset terminal identity" action in this
feature. Re-pairing is initiated from the SmartDataPulse admin console: an administrator revokes
or reassigns the terminal and issues a new one-shot pairing code. The terminal subsequently
enters the Pairing screen via FR-1 — specifically when (a) no token is stored locally, (b) the
backend indicates the current token is revoked or invalid, or (c) the local secure-storage entry
is missing, unreadable, or corrupt. A `BRANCH_MISMATCH` response during a pairing attempt MUST
preserve the existing valid device token; failed pairing attempts MUST NOT delete an existing
valid token. No clean reinstall is required for normal re-pairing. The admin-side pairing UI
(issuing codes, listing terminals, releasing terminals) remains out of scope for this feature;
only the POS-client side of the pairing endpoint is delivered here.

---

*Constitution alignment:* This spec MUST satisfy the principles of `.specify/memory/constitution.md`
(version pinned at the time of writing). The plan and tasks artifacts will perform the explicit
"Constitution Check."
