# Implementation Plan: Terminal Pairing

**Feature ID:** 002-terminal-pairing
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-05-03
**Last Updated:** 2026-05-03
**Constitution version pinned:** v1.3.0

---

## Technical Context

This plan commits to the concrete library and module layout for delivering pairing **on the POS
client only**. Foundation (001) supplies every cross-cutting capability we need: secure shell,
typed bridge, SQLite + migration runner, SecretStore, OpenAPI codegen, local logging, inert
Sentry, and Windows CI. No new third-party runtime dependencies are introduced for this feature.

| Area | Choice | Source |
|:--|:--|:--|
| Runtime / packaging | Electron `^40.9` (from 001), Windows 10/11 x64 | constitution v1.3.0 / plan 001 |
| Renderer | React `^19.2` + Vite `^8.0` + TypeScript `^5.9` strict | constitution v1.3.0 / plan 001 |
| Pairing UI shell | New React route `/pairing`; default unpaired view; renderer-only | research §1 |
| Routing | `react-router-dom ^7` (introduced here; 001 was a single page) | constitution Tech Stack |
| Renderer state | Zustand for the local pairing-form state machine | constitution Tech Stack |
| Server-state hook | TanStack Query for the single `pair` mutation (loading / disabled / retry-after lifecycle) | constitution Tech Stack |
| HTTP client | `fetch` from the **main process only** (renderer has no outbound network per CSP) | constitution Platform Integration / Security |
| API types | Existing generated types from `src/shared/api-types.ts` (snapshot refresh in this feature, see Risk R1) | constitution V + research §2 |
| Secret storage for device token | Existing `SecretStore` from 001 (`safeStorage`, DPAPI on Windows). Single key: `device_token` | constitution VIII / plan 001 |
| Local pairing state | New SQLite table `terminal_assignment` (single-row) created by migration `0003_terminal_assignment.sql` | data-model.md |
| IPC channel surface | New `pairing.*` channels exposed via the typed preload bridge | contracts/preload-bridge.ts |
| Logging | Existing `pino` logger from 001; new `pairing` namespace; redaction enforced by formatter | research §3 |
| Crash reporting | Existing `@sentry/electron`; inert without DSN; pairing path is in scope of the same scrubber | research §3 |
| Tests | Vitest only (constitution VI). New suites under existing layout | Test Strategy section |
| CI | No workflow changes; pairing passes through the same `codegen:verify → typecheck → lint → test → package:dir` gates | research §4 |

**No `NEEDS CLARIFICATION` items remain at this layer.** The single open question from the spec
(re-pairing trigger) was resolved in `/speckit-clarify` on 2026-05-03 as **Option B (admin-driven
only)** and is woven through FR-1 / FR-13 / FR-14.

## Constitution Check (Initial)

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | **PASS** | Pairing inherently requires network; once paired the terminal is fully usable for non-pairing flows. The Pairing screen is the only screen that gates on connectivity, and it does so explicitly with a recoverable error — no offline-time data loss path exists because no transactional state is created here. |
| II. Financial Precision | N/A | No money in this feature. |
| III. Process-Boundary Discipline | **PASS** | All HTTP, SQLite, SecretStore access happens in the main process; renderer talks only to the typed preload bridge; no new ad-hoc IPC channels introduced. |
| IV. Hardware Loud, Not Silent | **PASS** | Wedge scanner is plain keyboard input — no driver. The Pairing screen accepts it as such and surfaces all server failures to the operator (no silent fallbacks). |
| V. Type Safety End-to-End | **PASS** | Pairing endpoint contract consumed via `src/shared/api-types.ts`; bridge types shared between renderer and preload; strict TS both tsconfigs. |
| VI. Test-First, Coverage-Gated | **PASS** | Pairing service, failure-mapping, redaction, IPC handlers, and React route get failing tests first; ≥ 80% on new code (no module crosses the 95% list). |
| VII. Observability | **PASS** | Exactly one structured `pairing_attempt` log per submit with outcome category and timestamp; Sentry inert without DSN; explicit scrub list extends the existing redaction filter to cover `pairing_code` and `device_token`. |
| VIII. Terminal Identity ≠ User | **PASS** | Device token is the only identity stored; never confused with a Clerk user; failed pair never overwrites a valid token (FR-14); no cashier login surface in this feature. |
| IX. Reference, Not Inheritance | **PASS** | Legacy pairing flows (if any in `_reference/Data-Pulse/`) are NOT consulted; this feature is re-derived against the clarified spec. |
| Platform Integration | **PASS** | Endpoint is the constitution-blessed `POST /api/v1/terminals/pair`; only host contacted is `${VITE_API_BASE_URL}` (defaults to `https://api.smartdatapulse.tech` in production); no extra remotes. |
| Security | **PASS** | `device_token` stored only via `safeStorage`; renderer cannot reach it; logs/Sentry payloads scrubbed; production refuses to start without `safeStorage.isEncryptionAvailable()` (already enforced by 001). |
| Hardware Matrix | **PASS** | Keyboard-wedge HID scanner only, per the MVP matrix. No native scanner SDK introduced. |
| Domain — Pharmacy POS | N/A | No pharmacy-domain entities in this feature. |

**Initial gate result: PASS.** No violations, no waivers required.

## Phase 0 — Research

See [./research.md](./research.md). Five decisions are recorded with chosen approach, alternatives,
and rationale: routing introduction, OpenAPI snapshot refresh strategy, log redaction extension,
HTTP retry/rate-limit handling, and revoked-token recovery semantics.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md). Two persisted artifacts:
  - **`SecretStore[device_token]`** — opaque string, single key, never displayed.
  - **`terminal_assignment`** — single-row SQLite table holding `(tenant_id, branch_id,
    terminal_id, terminal_label, paired_at)`. Created by migration `0003_terminal_assignment.sql`.
  - Plus the **`PairingAttemptLogRecord`** in-memory shape that the logger emits per attempt.
- **Contracts:** [./contracts/](./contracts/). Three interface artifacts:
  1. **`pairing-http.md`** — the HTTP contract for `POST /api/v1/terminals/pair`, including failure
     codes and `Retry-After` semantics. The runtime types live in the regenerated
     `src/shared/api-types.ts` after the snapshot refresh (see Risk R1).
  2. **`preload-bridge.ts`** — TypeScript snippet of the additions to `PreloadBridgeAPI` for the
     `pairing` namespace.
  3. **`pairing-service.ts`** — TypeScript snippet of the main-process `PairingService` interface
     (the seam tests target).

  **Source-of-truth policy** (same as 001): once Phase 2 lands code in `src/shared/`, the canonical
  surface is `src/shared/`; the contracts/ files in this spec directory remain as the planning-time
  snapshot.
- **Quickstart:** [./quickstart.md](./quickstart.md). Developer walkthrough: wire the snapshot
  refresh, wire the new bridge methods, run the new tests, and exercise both the manual and
  wedge-scan flows against a local mock backend.

## Project Layout

Additions only; existing 001 structure untouched.

```
POS-Pulse/
├── src/
│   ├── main/
│   │   ├── pairing/
│   │   │   ├── service.ts            # PairingService — orchestrates submit/getStatus
│   │   │   ├── network.ts            # fetch against POST /api/v1/terminals/pair
│   │   │   ├── failure-mapping.ts    # HTTP status + body code → outcome category
│   │   │   ├── store.ts              # token + assignment persistence (uses SecretStore + SQLite)
│   │   │   └── __tests__/
│   │   │       ├── service.test.ts
│   │   │       ├── network.test.ts
│   │   │       ├── failure-mapping.test.ts
│   │   │       └── store.test.ts
│   │   └── ipc/
│   │       ├── pairing.ts            # IPC handlers: pairing:get-status, pairing:submit
│   │       └── __tests__/pairing.test.ts
│   │
│   ├── renderer/
│   │   ├── routes/
│   │   │   ├── pairing/
│   │   │   │   ├── PairingScreen.tsx
│   │   │   │   ├── PairingForm.tsx
│   │   │   │   ├── usePairing.ts     # Zustand store + TanStack Query hook composition
│   │   │   │   └── __tests__/
│   │   │   │       ├── PairingScreen.test.tsx
│   │   │   │       └── PairingForm.test.tsx
│   │   │   └── paired/
│   │   │       ├── PairedScreen.tsx          # confirmation view
│   │   │       └── __tests__/PairedScreen.test.tsx
│   │   ├── router.tsx                # react-router-dom 7 setup; routes the pairing/paired views
│   │   └── App.tsx                   # 001's blank App becomes the Router host
│   │
│   ├── shared/
│   │   ├── api-types.ts              # REGENERATED to include /api/v1/terminals/pair (Risk R1)
│   │   ├── bridge-api.ts             # extended with `pairing` namespace
│   │   └── pairing-types.ts          # PairingStatus, PairingOutcome, PairingSubmitResult discriminated unions
│   │
│   └── tests/
│       └── pairing-redaction.test.ts # cross-process: log lines never contain pairing_code or device_token
│
├── migrations/
│   └── 0003_terminal_assignment.sql  # CREATE TABLE terminal_assignment (single-row)
│
└── scripts/
    └── openapi-snapshot.json         # UPDATED to include the /terminals/pair operation
```

The Pairing UI is intentionally tiny: one route, one form, three states (idle / submitting /
post-result), no global navigation chrome — pairing is a setup ceremony, not a destination.

## Test Strategy

| Surface | Framework | What it covers | Coverage gate |
|:--|:--|:--|:--|
| `src/main/pairing/service.ts` | Vitest | Success persists token + assignment; each typed failure leaves prior state untouched (FR-8, FR-14); revoked-token path clears local state cleanly | ≥ 80% line + branch |
| `src/main/pairing/network.ts` | Vitest (in-process fake fetch) | Sends the documented body; surfaces status + body code; parses `Retry-After` header for RATE_LIMITED | ≥ 80% |
| `src/main/pairing/failure-mapping.ts` | Vitest | Each documented HTTP status + body code → expected outcome category; unknown shapes → `UNKNOWN_ERROR`, never throw | ≥ 80% |
| `src/main/pairing/store.ts` | Vitest | Round-trip token + assignment; `getStatus` returns `paired` only when both halves present; corrupt safeStorage entry → `invalid` not `paired` | ≥ 80% |
| `src/main/ipc/pairing.ts` | Vitest | Channels are named (no ad-hoc strings); validates input shape; refuses non-string codes; passes through service results without rewrapping outcomes | ≥ 80% |
| `src/renderer/routes/pairing/*` | Vitest + happy-dom + RTL | Manual entry flow; wedge-emulated keystroke + Enter flow; submit disabled while in-flight; rate-limit disable for the indicated `Retry-After`; FR-2 (single input accepts both modes) | ≥ 80% |
| `src/tests/pairing-redaction.test.ts` | Vitest | Captures logger output across success + every failure category and asserts no token / code substring leaks | smoke (must be 100%) |
| Bridge typing | tsc | Renderer cannot call `pairing.submit` with a non-string; service result discriminated unions exhaustive in switch | typecheck gate |

CI runs all of the above on every PR; the existing `codegen:verify` step enforces that the
`api-types.ts` snapshot stays in sync after the refresh in Risk R1.

## CI / Build / Package

No workflow file change. The existing `.github/workflows/ci.yml` from 001 enforces:

```
checkout → setup-node → npm ci → npm run codegen:verify → npm run typecheck → npm run lint
       → npm test -- --coverage → npm run package:dir → upload-artifact
```

The single observable difference for this feature is that `codegen:verify` will now diff against
a *refreshed* `scripts/openapi-snapshot.json` that includes the pair endpoint — see Risk R1 for the
refresh strategy.

## Phase 2 — Implementation Outline

The work decomposes into eight ordered groups. `/speckit-tasks` will expand each into concrete,
test-first tasks. Order matters: each step's tests gate the next.

1. **OpenAPI snapshot refresh.** Update `scripts/openapi-snapshot.json` with the
   `/api/v1/terminals/pair` operation (request body, success response, typed error envelope, 429
   `Retry-After` semantics). Regenerate `src/shared/api-types.ts`. Verify diff is exactly the new
   types and nothing else.
2. **Pairing types.** Add `src/shared/pairing-types.ts` with the discriminated unions for
   `PairingStatus`, `PairingOutcome`, and `PairingSubmitResult`. These are the seam for both the
   service and the bridge.
3. **Migration.** `migrations/0003_terminal_assignment.sql` creating a single-row
   `terminal_assignment` table. Migration-runner test asserts apply + idempotency on re-run.
4. **Pairing store.** `src/main/pairing/store.ts` wires `SecretStore` + the new SQLite table.
   `getStatus()` returns `paired` only when both halves agree; `clear()` for the revoked-token
   path; `persist(success)` is the only writer. Tests precede implementation.
5. **Failure mapping + network.** `failure-mapping.ts` then `network.ts` — pure functions over
   typed inputs, easy to test against fake fetch responses including the `Retry-After` header.
6. **PairingService.** `service.ts` composes the above. Tests cover: success persists; each
   typed failure returns the right outcome AND leaves prior state untouched (FR-8, FR-14);
   network error returns `NETWORK_ERROR`; pre-existing valid token under `BRANCH_MISMATCH`
   stays put.
7. **IPC handlers + bridge surface.** `src/main/ipc/pairing.ts` registers exactly two enumerated
   channels (`pairing:get-status`, `pairing:submit`); `src/preload/index.ts` extends the bridge to
   expose them; `src/shared/bridge-api.ts` adds the typed `pairing` namespace.
8. **Renderer routes.** Add `react-router-dom 7`. Boot routes in `App.tsx` based on
   `pairing.getStatus()`. Build `PairingForm` (single input, manual + wedge), `PairingScreen` (host
   + Sentry breadcrumb on outcome only — no payload), and `PairedScreen` (confirmation). Tests use
   RTL + happy-dom; wedge scan is simulated as `userEvent.keyboard('CODE\n')`.

The cross-cutting redaction test (`src/tests/pairing-redaction.test.ts`) is added alongside step 6
and locks down FR-9 / FR-10 / NFR-4.

## Constitution Check (Post-Design)

Re-evaluated after the layout, contracts, and CI design above were settled.

| Principle / Constraint | Status | Notes (what changed in design) |
|:--|:--:|:--|
| I. Offline-First | **PASS** | Pairing is the documented exception (it requires network); no transactional state is at risk. |
| II. Financial Precision | N/A | unchanged. |
| III. Process-Boundary Discipline | **PASS** | The `pairing` namespace adds two enumerated channels; renderer never touches `fetch` for pairing or the SecretStore. |
| IV. Hardware Loud, Not Silent | **PASS** | Wedge handling is keyboard-only; submit disabled until the input is non-empty; Enter is the only auto-submit trigger and only when there is content. |
| V. Type Safety End-to-End | **PASS** | Pair endpoint enters `src/shared/api-types.ts` via the existing codegen path; bridge `pairing` namespace shared as a typed interface. |
| VI. Test-First, Coverage-Gated | **PASS** | Each Phase 2 group leads with its tests; `/speckit-tasks` will materialize this per-task. |
| VII. Observability | **PASS** | One log line per attempt with outcome category; Sentry breadcrumb omits the code/token; Sentry inert without DSN as before. |
| VIII. Terminal Identity ≠ User | **PASS** | Device token is the only identity stored; FR-14 (no token loss on `BRANCH_MISMATCH`) is exercised by `service.test.ts`. |
| IX. Reference, Not Inheritance | **PASS** | No legacy pairing code consulted; the design is derived from the clarified spec. |
| Platform Integration | **PASS** | Single host (`${VITE_API_BASE_URL}`); single endpoint; pairing is the one call where `X-Terminal-Token` is absent (per constitution). |
| Security | **PASS** | Token only in `safeStorage`; logs/Sentry scrubbed; renderer can neither read the token nor make outbound calls. |
| Hardware Matrix | **PASS** | unchanged. |
| Domain — Pharmacy POS | N/A | unchanged. |

**Post-design gate result: PASS.**

## Risks & Open Items

- **R1 — OpenAPI snapshot refresh.** The 001 snapshot does not contain
  `/api/v1/terminals/pair`. *Mitigation:* this feature explicitly refreshes
  `scripts/openapi-snapshot.json` from the live `https://api.smartdatapulse.tech/openapi.json`. If
  the live spec lacks the operation at the time of refresh, hand-author the operation into the
  snapshot using the contract in `contracts/pairing-http.md` and open a backend-side ticket;
  later refreshes will adopt the live shape verbatim. Owner: pairing implementer; checked by
  `codegen:verify`.
- **R2 — `Retry-After` parsing edge cases.** Server may send seconds (delta) or HTTP-date.
  *Mitigation:* `network.ts` parses both, clamps to a sane range (1 s ≤ x ≤ 300 s), and the
  renderer disables submit for the parsed duration; failed parses default to 30 s.
- **R3 — Wedge scanner accidentally enters the input on an unrelated screen.** *Mitigation:* the
  Pairing screen sets `autofocus` on the code input only when route is `/pairing`; outside that
  route the input does not exist; once paired, the route is unreachable. Constitution principle IV
  + Hardware Matrix already require focus management, and the design honours it.
- **R4 — `safeStorage` decryption failure on a previously paired terminal.** *Mitigation:*
  `store.getStatus()` returns `invalid` and the renderer routes to `/pairing` with a clear
  diagnostic banner. Production refuses to operate as paired in this state (already enforced by
  the 001 SecretStore production-startup gate).
- **R5 — Backend failure-mode contract drift.** Spec lists five typed failure categories; the
  backend MUST return one of those five (or `RATE_LIMITED` with a `Retry-After`). *Mitigation:*
  `failure-mapping.ts` defaults unknown body codes to a separate `UNKNOWN_ERROR` outcome that
  surfaces a generic message; this is a defensive default, not a substitute for the contract.
- **O1 — Sentry tagging strategy for pairing.** Open: should pairing attempts add a Sentry tag
  (`pairing.outcome`) for grouping when DSN is enabled? Resolution deferred to `/speckit-tasks` —
  if added, it MUST be the outcome category only, never the code or token. Marked
  non-blocking.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
