# Research: Terminal Pairing (002)

**Feature:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md)
**Constitution version:** v1.3.0

This document captures the non-trivial technical choices for delivering pairing on the POS client.
Each section names the decision, the alternatives considered, and the reason for the chosen path.
Items the constitution already pins are not re-decided here; they are restated in `plan.md`.

---

## §1 — Routing Introduction

**Decision.** Adopt `react-router-dom ^7` and switch `App.tsx` from a single blank page (001) to a
small router that selects the start route based on the result of `pairing.getStatus()` from the
preload bridge. The routes introduced by this feature are exactly two: `/pairing` and `/paired`.

**Alternatives.**
- **Conditional rendering only (no router).** Rejected — works for two routes but does not scale
  to the cashier login + sales surfaces that follow. Also makes deep links for diagnostics
  awkward (e.g., a future `/diagnostics` route). The cost of introducing the router now is
  one dependency and ~40 lines of boot code.
- **TanStack Router.** Rejected — type-safe routing is appealing, but the constitution Tech Stack
  pins `react-router-dom 7`. Substituting it would require an amendment.

**Rationale.** The constitution names `react-router-dom 7`. Pairing is the first feature with more
than one screen, so the router lands here. Keeping the router minimal (two routes, no nested
layouts) avoids over-design and matches the spec's "pairing is a setup ceremony, not a
destination."

---

## §2 — OpenAPI Snapshot Refresh Strategy

**Decision.** Refresh `scripts/openapi-snapshot.json` once at the start of this feature to include
`POST /api/v1/terminals/pair` (and only the additions needed for this endpoint plus typed error
shapes). The codegen pipeline established in 001 (`npm run codegen:api`) regenerates
`src/shared/api-types.ts`; the existing `codegen:verify` CI gate enforces no drift afterwards.

**Alternatives.**
- **Switch to live-fetch from the live OpenAPI URL** at the start of this feature. Rejected for
  now — the constitution allows it, and 001 even names it as the "later feature" path, but the
  backend OpenAPI may still be in flux for unrelated endpoints; pulling the entire live spec
  would couple this feature's CI determinism to backend timing. Live-fetch can land as a small
  follow-on once 002 is merged.
- **Hand-write a minimal types file just for pairing**, bypassing codegen for this one
  endpoint. Rejected explicitly — constitution V says backend types are *generated*, never
  hand-typed. This option would also create two sources of truth.
- **Treat the pair endpoint as untyped (`as any`).** Rejected — constitution V prohibits
  unjustified `any`.

**Rationale.** A controlled snapshot refresh keeps the codegen contract intact (one source of
truth: the snapshot), keeps CI deterministic, and matches the "pinned snapshot, live later"
trajectory laid out in 001. If the live spec lacks the pair endpoint at refresh time, the
operation is hand-authored into the snapshot using the contract in `contracts/pairing-http.md`
and a backend ticket is opened. Subsequent refreshes will replace the hand-authored block with
whatever the live spec emits, byte-for-byte.

---

## §3 — Log Redaction Extension

**Decision.** Extend the existing `pino` redaction list (set up in 001) to add the keys
`pairing_code` and `device_token`. Use exact-key redaction at the `pino` formatter, plus an
allowlist-based emitter for the pairing namespace: `logger.pairing(outcome, { /* never values */ })`
constructs the log record from a fixed schema rather than from arbitrary call sites. The pairing
service NEVER passes the code or the token into `logger.error(err)` — wrapped errors are
re-thrown after stripping their `cause.body` field through a `safeStringify` shim that drops the
two keys at the source.

**Alternatives.**
- **Trust call sites to omit secrets.** Rejected — humans forget; the constitution requires
  durable observability without leakage. A schema-based emitter and a redaction list together
  guarantee secrets cannot leak even if a future caller is sloppy.
- **Encrypt logs.** Rejected — overkill for our threat model and would degrade the support
  loop ("ship the log file" becomes "ship the log file plus a key").

**Rationale.** Belt + braces: a schema-based emitter prevents accidental inclusion at the source,
and the redaction list catches anything that slips past. The cross-process redaction test
(`src/tests/pairing-redaction.test.ts`) asserts both layers together against captured logger
output.

---

## §4 — HTTP Failure-Mapping & Rate-Limit Handling

**Decision.** Build a single pure function `mapFailure(status, body) → PairingOutcome` in
`src/main/pairing/failure-mapping.ts` that translates the typed backend error envelope into one
of: `INVALID_CODE | EXPIRED_CODE | ALREADY_PAIRED | BRANCH_MISMATCH | RATE_LIMITED |
UNKNOWN_ERROR | NETWORK_ERROR`. For `RATE_LIMITED`, parse the `Retry-After` header (RFC 7231:
either `delta-seconds` or HTTP-date), clamp the resulting wait to **[1 s, 300 s]**, and surface
the parsed value to the renderer as part of the outcome. Failed parses default to 30 s. Network
errors (`fetch` rejection, DNS failure, TLS error) become `NETWORK_ERROR`; HTTP 5xx becomes
`UNKNOWN_ERROR` (treated as transient by the UI).

**Alternatives.**
- **Map by HTTP status only.** Rejected — constitution and spec name the failure modes by
  category; status alone (e.g., `409`) doesn't disambiguate `ALREADY_PAIRED` from
  `BRANCH_MISMATCH`. The body code is authoritative.
- **Map by string matching on error messages.** Rejected — fragile; backend messages can change
  without breaking the contract.

**Rationale.** A pure function is trivial to test exhaustively (one Vitest case per category plus
"unknown body shape → `UNKNOWN_ERROR`, never throws"). The clamp prevents a malicious or buggy
backend from disabling submit indefinitely. The split between `UNKNOWN_ERROR` (server returned
something) and `NETWORK_ERROR` (request never landed) drives different recovery messages without
adding more named categories to the spec surface.

---

## §5 — Revoked-Token Recovery Semantics

**Decision.** When the local SecretStore reports either *missing* or *unreadable* (decryption
fails) for the `device_token` key, `pairing.getStatus()` returns `invalid` and the renderer routes
to `/pairing`. When the backend reports a revoked token via `401 device_revoked` on a non-pairing
call (handled in a future feature), the same recovery path applies: the consuming feature MUST
call a new shared helper `pairingStore.clear()` to drop the local token + assignment row, then
let the router fall back to `/pairing`. This feature ships `pairingStore.clear()` and the
`getStatus → invalid` path, but does NOT ship a 401-interceptor (no other backend call exists yet).

**Alternatives.**
- **Re-pair automatically on `401 device_revoked`.** Rejected — re-pairing requires a fresh
  one-shot pairing code, which only the admin can issue. Automatic re-pair is impossible by design.
- **Show a modal "your terminal was revoked" without routing to /pairing.** Rejected — the spec
  (FR-1) states that the pairing screen is the explicit landing zone for the three trigger
  conditions; modals fragment the recovery surface.

**Rationale.** Concentrating recovery in one route + one helper keeps the surface small and makes
FR-1 (b) and (c) trivially testable in `store.test.ts`. The deferred 401-interceptor call site
will simply call `pairingStore.clear()` and let the router do the rest.

---

## §6 — Wedge-Scanner Input Handling

**Decision.** The Pairing screen exposes one `<input>` element. The keyboard-wedge scanner emits
keystrokes (the code) optionally followed by Enter. The form binds a `submit` handler to the
input's `onSubmit`/`onKeyDown(Enter)` BUT only when the input has at least one non-whitespace
character. There is no separate "scan" mode and no toggle. Auto-focus is set on route enter to
avoid a stray scan landing on a different element. The `<input>` is `type="text"` with
`autoComplete="off"`, `spellCheck={false}`, and `inputMode="text"`.

**Alternatives.**
- **Two separate inputs (one for manual, one for scan).** Rejected — the constitution and spec
  treat both as the same input modality.
- **Listen for keystroke timing patterns to detect the scanner.** Rejected — fragile, adds
  hardware-specific code that the constitution explicitly excludes from the MVP scanner support.

**Rationale.** Wedge scanners are keyboards from the OS's perspective. The simplest correct
implementation is to treat them as such and rely on the `Enter` suffix that all standard wedges
emit. The non-empty guard prevents an accidental Enter on focus from submitting an empty form.

---

## §7 — Test-Driven Sequencing

**Decision.** Tests precede implementation per Phase 2 group, ordered:

1. `failure-mapping.test.ts` (pure function, fastest feedback).
2. `network.test.ts` (in-process fake `fetch`).
3. `store.test.ts` (uses 001's in-memory SecretStore backend + a temp SQLite file).
4. `service.test.ts` (composes 1-3).
5. `pairing.test.ts` (IPC handlers; uses a fake `ipcMain` register).
6. `PairingForm.test.tsx`, `PairingScreen.test.tsx`, `PairedScreen.test.tsx` (RTL + happy-dom).
7. `pairing-redaction.test.ts` (cross-cutting; runs after the rest).

Each test file's first commit MUST be the failing test; the implementation file's first commit
MUST make that test pass. This is enforced by `/speckit-tasks` per-task, not by tooling.

**Alternatives.**
- **End-to-end Playwright tests for the manual + wedge flows.** Deferred. The renderer
  unit tests with simulated `userEvent.keyboard('CODE\n')` cover the surface; a Playwright suite
  is a follow-on once we have a stable mock backend.

**Rationale.** This ordering matches risk: pure functions first, side-effecting code next, UI
last. Each layer's tests gate the next, so a regression in `failure-mapping` is caught before it
infects `service` tests.
