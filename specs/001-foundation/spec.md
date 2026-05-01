# Feature Specification: Foundation

**Feature ID:** 001-foundation
**Status:** Draft
**Created:** 2026-05-01
**Last Updated:** 2026-05-01
**Owner:** Repo maintainer

---

## Overview

Foundation is the technical substrate that every later POS-Pulse feature stands on. It does not deliver
any cashier-, admin-, or business-visible behavior. It delivers a packageable empty Windows desktop
application with the patterns, gates, and primitives that the next feature (`002-terminal-pairing`)
will build directly on top of: a secure Electron shell, a typed preload bridge, a local SQLite
database with a migration runner, a secret-storage abstraction, generated API types from the
platform's OpenAPI spec, local structured logging, crash-reporting wiring, a strict Money module, and
CI gates that prove the whole thing builds and packages on every change. After this feature, a
contributor can clone the repo, run the dev command, and see an empty secure window — and the team
can add real features against a known-good substrate.

This is an infrastructure feature with a developer audience. It deliberately ships **no** user
journey: no pairing flow, no login, no home screen, no sales surface.

## User Scenarios & Testing

### Primary User Story

A new contributor clones POS-Pulse on a Windows workstation, installs dependencies, and runs the dev
command. A blank Electron window opens. They open the renderer's devtools and confirm that the
renderer cannot reach Node APIs directly — only the preload bridge. They edit a stub migration, run
the app again, and observe the new migration applied exactly once. They run the test suite (which
includes high-coverage tests for the Money module) and the package dry-run, both pass. They then push
a branch; CI runs typecheck, lint, tests, and the package dry-run, and reports green. The repo is
now ready for the pairing feature.

### Acceptance Scenarios

1. **Dev launch produces an empty secure window**
   - **Given** a freshly cloned repo with dependencies installed
   - **When** the developer runs the dev command
   - **Then** a single empty Electron window opens, with `contextIsolation` enabled,
     `nodeIntegration` disabled, and the renderer process unable to import Node modules.

2. **Renderer cannot reach Node APIs directly**
   - **Given** the dev window is open
   - **When** an automated renderer-side test attempts to access `process`, `require`, or any other
     Node global directly
   - **Then** every such access is `undefined` or otherwise blocked, and the only Node-side
     functionality reachable is what the preload bridge has explicitly exposed.

3. **Preload bridge surface is typed and minimal**
   - **Given** the codebase
   - **When** the developer inspects the preload bridge
   - **Then** at least one stub method is exposed via the `contextBridge`-style mechanism, both ends
     share a single TypeScript interface, and the project's typecheck rejects bridge calls that
     mismatch the interface.

4. **Migration runner applies and tracks migrations**
   - **Given** a SQLite database file (created on first launch if absent)
   - **When** the app launches and a previously-unapplied migration is present in the migrations
     directory
   - **Then** the migration is executed exactly once, recorded in a `schema_migrations` (or
     equivalently named) tracking table, and re-launching the app does not re-run it.

5. **Secret storage abstraction round-trips a value**
   - **Given** the secret storage abstraction is initialized
   - **When** an automated test stores a non-sensitive placeholder value under a key, then reads it
     back, then deletes it
   - **Then** the round-trip succeeds, the value is not visible in plain text on disk, and the
     deletion is irrecoverable through the abstraction.

6. **API types regenerate from the OpenAPI source**
   - **Given** the OpenAPI spec at the platform's API host is reachable
   - **When** the developer runs the codegen script
   - **Then** a generated TypeScript types file is written under `src/api/`, the file is committed
     to the repo, and the project's typecheck remains green.

7. **Logging writes rotated JSON locally**
   - **Given** the app has launched at least once
   - **When** application code emits log records via the logger
   - **Then** records appear in a rotating JSON log file at a known on-disk location, with
     timestamps and log levels.

8. **Sentry is inert without a DSN**
   - **Given** no Sentry DSN is configured in the environment
   - **When** the app launches
   - **Then** the app starts cleanly, neither main nor renderer crashes, and no network calls are
     made to any Sentry endpoint.

9. **Money module passes its strong test suite**
   - **Given** the Money module
   - **When** the test suite runs
   - **Then** every public arithmetic operation (add, subtract, multiply by integer quantity,
     allocate/distribute rounding) is exercised against representative cases including zero,
     negative, large, and rounding-edge inputs, and coverage is at least 95% line and branch.

10. **CI gates a PR**
    - **Given** an open pull request
    - **When** CI runs
    - **Then** typecheck, lint, the full test suite, and the Electron package dry-run all execute,
      and a failure in any one blocks merge.

11. **Package dry-run produces an unsigned artifact**
    - **Given** the local environment with project dependencies
    - **When** the developer runs the package dry-run command
    - **Then** an unsigned, unpacked Windows build artifact appears in the build output directory.

12. **Hardware matrix doc is present and accurate**
    - **Given** the repo
    - **When** the reader opens `docs/hardware-matrix.md`
    - **Then** the document enumerates the constitution v1.2.0 MVP hardware scope (Windows-only
      target, keyboard-wedge scanners, local print adapter with ESC/POS preferred, optional cash
      drawer via printer kick) and the explicit out-of-scope list.

### Edge Cases

- **Renderer attempts a Node API not exposed by the bridge.** The call returns `undefined` (or the
  TypeScript compiler refuses earlier). No silent escape hatch exists.
- **Migration fails partway through.** The transaction rolls back, the migration is NOT recorded as
  applied, and the failure is logged with enough context to debug. The app may halt at startup with
  a clear error rather than continuing in an inconsistent state.
- **Secret storage backend is unavailable** (e.g., on a non-Windows dev environment). The
  abstraction falls back to a clearly-marked development backend that is NOT used in production
  builds; production builds refuse to start without the Windows-native backend.
- **OpenAPI source is unreachable during codegen.** The script fails fast with a clear message; the
  previously-committed generated file remains in place; CI does not silently regress to a stale
  contract.
- **Log directory is not writable** (e.g., locked path, permission issue). The app surfaces the
  error to console once, falls back to console-only logging, and continues.
- **Sentry DSN is set but invalid.** The app still launches; Sentry's own initialization error is
  swallowed and logged once; no recurring crash loop.

## Requirements

### Functional Requirements

- **FR-1.** The application MUST launch as a Windows desktop application with secure Electron
  defaults: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` enabled wherever
  practical for the renderer.
- **FR-2.** The renderer MUST NOT have direct access to Node APIs. All main-process functionality
  reachable from the renderer MUST flow through a typed preload IPC bridge.
- **FR-3.** The preload bridge MUST exist with at least one stub method that establishes the pattern
  for future features, and both ends MUST share a single TypeScript interface declaration.
- **FR-4.** The app MUST embed a local SQLite database via `better-sqlite3` and a migration runner
  that, on every launch, applies pending migrations in order and records each successful application
  in a tracking table.
- **FR-5.** A secret storage abstraction MUST exist exposing `get`, `set`, and `delete` operations
  for opaque string values. Production builds MUST use a Windows-native protection backend (e.g.,
  DPAPI via the OS credential store). No real terminal device token is stored or referenced by this
  feature.
- **FR-6.** A codegen script MUST generate TypeScript types from
  `https://api.smartdatapulse.tech/openapi.json` and write them to a checked-in generated file under
  `src/api/`. The script MUST be runnable on demand and produce deterministic output.
- **FR-7.** Local application logging MUST use `pino` with `pino-roll` rotation and write structured
  JSON records to a known on-disk directory.
- **FR-8.** Sentry MUST be wired in both the main and renderer processes. When no Sentry DSN is
  configured, the app MUST launch cleanly and Sentry MUST remain inert (no network calls, no
  crashes).
- **FR-9.** A `Money` module MUST exist, operate exclusively on integer minor units, and provide
  add, subtract, multiply-by-integer-quantity, and rounding-distribution operations. Floating-point
  arithmetic on currency values MUST NOT appear in this module.
- **FR-10.** The repository MUST provide CI configuration that runs typecheck, lint, the test
  suite, and an Electron package dry-run on every pull request, blocking merge on failure of any.
- **FR-11.** `npm run dev` MUST open a single empty Electron window for local development.
- **FR-12.** `npm run package:dir` MUST produce an unsigned packaged build artifact (no installer,
  no code signing required at this stage).
- **FR-13.** `docs/hardware-matrix.md` MUST exist and reproduce the constitution v1.2.0 MVP hardware
  scope, including the explicit out-of-scope list.

### Non-Functional Requirements

- **NFR-1.** A clean clone-to-window walkthrough on a typical Windows developer workstation MUST
  complete in under 5 minutes (`npm install`, `npm run dev`, see window).
- **NFR-2.** The Money module MUST achieve ≥ 95% line and branch coverage in the test suite.
- **NFR-3.** Generated API types MUST be deterministic across re-runs given identical input
  (byte-identical output for the same OpenAPI document).
- **NFR-4.** The CI package dry-run MUST complete in under 5 minutes on the project's standard CI
  runner.
- **NFR-5.** The packaged unsigned build artifact MUST launch on a clean Windows 10 or Windows 11
  x64 machine without the development environment installed.

## Success Criteria

- **SC-1.** A contributor on a clean Windows machine can go from `git clone` to "empty Electron
  window visible" in under 5 minutes using only the documented commands.
- **SC-2.** An automated renderer-side test confirms that direct access to Node globals (`require`,
  `process`, `Buffer`) is blocked.
- **SC-3.** Adding a new SQL migration file and re-launching the app applies it exactly once, with
  the application recorded in the tracking table.
- **SC-4.** Running the codegen script regenerates `src/api/types.ts` with byte-identical output
  given an unchanged OpenAPI input.
- **SC-5.** The Money module test suite passes with ≥ 95% line and branch coverage.
- **SC-6.** CI on a representative pull request runs typecheck, lint, tests, and the package
  dry-run in series or parallel and reports a single green status when all pass.
- **SC-7.** `npm run package:dir` produces an unsigned build directory whose entrypoint launches an
  empty Electron window on a fresh Windows 10/11 x64 machine.
- **SC-8.** With `SENTRY_DSN` unset, the app launches and exits cleanly. With `SENTRY_DSN` set to a
  syntactically invalid value, the app still launches without crashing.
- **SC-9.** `docs/hardware-matrix.md` exists and is reviewed by the maintainer to match constitution
  v1.2.0.

## Key Entities

- **Schema Migration record** — a row in the local migration-tracking table identifying an applied
  migration by name/timestamp. Used to ensure idempotency.
- **Secret entry** — an opaque key→value pair held by the secret storage abstraction. In this
  feature, only test placeholders are written; no real terminal token exists yet.
- **Generated API Types module** — a checked-in TypeScript file derived from the platform's OpenAPI
  spec; consumed (later) by feature code, regenerated on demand by the codegen script.

## Assumptions

- The CI runner used for the package dry-run is a Windows runner. `better-sqlite3` is a native
  module and `electron-builder --win --dir` is most reliable on Windows; cross-builds are out of
  scope.
- "Empty Electron window" is interpreted as a React + Vite + TypeScript renderer skeleton (per
  constitution v1.2.0 Tech Stack) rendering a single blank page. The renderer scaffolding exists to
  establish the pattern; no UI components, routing, or styling beyond the Tailwind setup itself are
  shipped in this feature.
- The OpenAPI codegen runs **on demand** (not on every CI run). CI verifies that the committed
  generated file matches what regeneration would produce, but does not require live network access
  to the API host on every run.
- "Strong unit test coverage" on Money is interpreted as ≥ 95% line and branch coverage. This is
  consistent with the constitution's coverage floor for the Money module.
- Code signing is deferred to a later release-prep feature. `package:dir` produces an **unsigned**
  artifact; a future feature will introduce signing, the auto-update feed, and the signed installer.
- Windows-native secret storage is provided by the OS credential store via DPAPI (directly or via a
  cross-platform abstraction whose Windows backend uses DPAPI). The exact library is a plan-level
  decision.
- Logs and the SQLite database file live under the per-user app-data directory provided by the
  platform; exact path conventions are a plan-level decision.

## Out of Scope

- Terminal pairing UI, the pairing screen, and any code that consumes a pairing code.
- The `POST /api/v1/terminals/pair` integration. Generated types referencing it MAY exist via
  codegen; calling code MUST NOT.
- Cashier login, identity-provider integration, and any cached-credential / offline-login behavior.
- The post-login "Ready" home screen and any cashier-facing surface.
- Sales flow, cart, checkout, payment, line items, taxes, discounts.
- Inventory display and product catalog.
- Receipt printing, ESC/POS template execution, and cash-drawer kick logic.
- Returns, exchanges, X-reports, Z-reports, shift open/close.
- Offline sync business logic (the abstractions and queue are introduced when a feature needs
  them; nothing in 001-foundation queues domain events).
- Admin / dashboard UI of any kind.
- Code signing, signed installer, and the auto-update feed.

## Dependencies

- The platform's OpenAPI specification at `https://api.smartdatapulse.tech/openapi.json` MUST be
  reachable during codegen. If the endpoint is not yet live, a pinned local snapshot is acceptable
  for this feature's bootstrap, with a follow-up task to wire the live source.
- A Windows-capable CI runner is required for the Electron package dry-run.
- The constitution at `.specify/memory/constitution.md` (v1.2.0) is the authoritative source for
  hardware scope, security posture, and stack choices.

## Open Questions

(none)

---

*Constitution alignment:* This spec is written against POS-Pulse Constitution v1.2.0
(`.specify/memory/constitution.md`). The most load-bearing principles for this feature are
III (Electron Process-Boundary Discipline), V (Type Safety End-to-End), VI (Test-First, Coverage-
Gated), and VII (Observability), plus the Tech Stack and Hardware Matrix subsections. Principles I
(Offline-First), VIII (Terminal Identity), and the Domain — Pharmacy POS canonical concepts are
preserved as architectural assumptions but are NOT exercised by this feature; their first concrete
use lands in `002-terminal-pairing`.
