# Quickstart — Developer Onboarding for 002-terminal-pairing

This walkthrough is for a developer about to implement (or review) the Terminal Pairing feature
on top of the 001-foundation baseline. It assumes a working local checkout that already passes
`npm run typecheck` / `npm run lint` / `npm test` against `main`.

The flow below mirrors the Phase 2 ordering in `plan.md`. You can copy-paste the commands
verbatim; nothing here mutates remote state.

## 0. Prerequisites

- Foundation (001) is merged into `main`.
- `node 20.x`, `npm 10.x`, Windows 10/11 x64. macOS / Linux work for everything **except** the
  `package:dir` step (which needs Wine to cross-build a Windows installer).
- Working tree is clean and on a fresh feature branch off `main`:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/002-terminal-pairing-phase-1
```

## 1. Refresh the OpenAPI snapshot

```bash
# Pull the latest live spec. The flag overwrites scripts/openapi-snapshot.json wholesale, so
# the diff is your scoping tool — review it carefully before staging.
npm run codegen:api -- --source=live

# Or, if the live spec does not yet expose POST /api/v1/terminals/pair, hand-author the
# operation into scripts/openapi-snapshot.json using contracts/pairing-http.md as the source.
$EDITOR scripts/openapi-snapshot.json

# Regenerate types from the snapshot and verify no drift.
npm run codegen:api
npm run codegen:verify
```

`--source=live` overwrites `scripts/openapi-snapshot.json` wholesale (see
`scripts/codegen-api.ts`). Stage only the pair-operation block plus its referenced schemas, and
the corresponding TypeScript surface in `src/shared/api-types.ts`. Revert any unrelated
additions and ask the backend team to coordinate them as their own snapshot refresh — keeping
this feature's PR diff scoped to pairing only.

## 2. Land the new shared types

Before any service or UI code, add the pairing types to `src/shared/`:

```text
src/shared/pairing-types.ts        # PairingStatus / PairingOutcome / PairingSubmitResult
src/shared/bridge-api.ts           # extend PreloadBridgeAPI with the `pairing` namespace
```

The shape is in `contracts/preload-bridge.ts`. Run `npm run typecheck`; you'll see preload and
renderer fail to compile because the new namespace has no implementation yet — that's expected
and gates the next step.

## 3. Migration

```text
migrations/0003_terminal_assignment.sql
```

Schema in `data-model.md`. Add a Vitest case to `src/main/db/__tests__/migrate.test.ts` that
asserts the migration applies, is idempotent on re-run, and that the resulting table has the
single-row `CHECK (id = 1)` constraint enforced.

## 4. Pairing-store, failure mapping, network — test-first

Order matters. Each step's tests gate the next.

```text
src/main/pairing/failure-mapping.ts        + __tests__/failure-mapping.test.ts
src/main/pairing/network.ts                + __tests__/network.test.ts
src/main/pairing/store.ts                  + __tests__/store.test.ts
```

- `failure-mapping.test.ts` — one case per documented failure, plus an "unknown body shape →
  `UNKNOWN_ERROR`, never throws" case.
- `network.test.ts` — uses an in-process fake `fetch`. Cover: success body, each typed failure,
  `Retry-After` parsing (delta-seconds AND HTTP-date), clamp to `[1, 300]` seconds, network reject
  → `NETWORK_ERROR`.
- `store.test.ts` — uses 001's in-memory `SecretStore` backend + a temp SQLite file. Cover the
  full status-derivation table from `data-model.md`, including the orphaned-row and orphaned-token
  rows (both → `invalid`).

Run `npm test` after each file. Coverage on these three modules ≥ 80%.

## 5. PairingService

```text
src/main/pairing/service.ts                + __tests__/service.test.ts
```

Tests target the `PairingService` interface in `contracts/pairing-service.ts`. The critical
specs to write first:

- Success persists token AND assignment in one transactional unit; rolling back the SecretStore
  if the DB write fails.
- `BRANCH_MISMATCH` does NOT delete an existing valid token (FR-14).
- Every failure outcome leaves prior persisted state untouched (FR-8).
- Exactly one `pairing_attempt` log record per call; the record carries the outcome category and
  no secrets.
- `getStatus()` is read-only and emits zero log lines.

Coverage ≥ 80%.

## 6. IPC handlers

```text
src/main/ipc/pairing.ts                    + __tests__/pairing.test.ts
src/preload/index.ts                       (extend the bridge surface)
```

Two enumerated channels: `pairing:get-status` and `pairing:submit`. The IPC test asserts:

- Channel names match `PAIRING_IPC_CHANNELS`.
- Non-string codes are rejected before reaching the service.
- The service's discriminated union flows through to the renderer unchanged (no rewrapping).

Run `npm test` and confirm the renderer-isolation test from 001 still passes (no Node leakage in
the renderer).

## 7. Renderer

```text
src/renderer/router.tsx                    # boot react-router-dom 7
src/renderer/App.tsx                       # decide start route from pairing.getStatus()
src/renderer/routes/pairing/PairingScreen.tsx
src/renderer/routes/pairing/PairingForm.tsx
src/renderer/routes/pairing/usePairing.ts
src/renderer/routes/paired/PairedScreen.tsx
```

UI tests use Vitest + happy-dom + React Testing Library. The wedge-scan flow is simulated as:

```ts
await user.keyboard('VALIDCODE\n');
expect(pairing.submit).toHaveBeenCalledWith('VALIDCODE');
```

Ensure the form's `onSubmit`/Enter handler is gated on a non-empty input — empty Enter MUST be a
no-op (research §6).

## 8. Cross-process redaction guarantee

```text
src/tests/pairing-redaction.test.ts
```

Capture the structured log stream across success + every failure category, then assert the
captured strings contain **no** substring of either the submitted code or any returned device
token. This test must pass before merging.

## 9. Manual smoke

With the local mock backend running at `http://localhost:8080` (or whatever
`VITE_API_BASE_URL` points to in your `.env.local`):

```bash
npm run dev
```

The Electron window opens directly into `/pairing` because the SecretStore has no
`device_token`. Try each scenario:

1. Type a valid code → confirmation screen with the assignment.
2. Restart the app → it now opens directly into `/paired`.
3. Manually delete the SecretStore entry (or simulate decrypt failure) → on next launch the app
   routes back to `/pairing` with the "needs re-pair" banner.
4. Submit a code the mock returns `INVALID_CODE` for → friendly message, prior state untouched.
5. Submit codes rapidly until the mock returns `RATE_LIMITED` with `Retry-After: 5` → submit
   button disabled for 5 s.
6. Submit a code that returns `BRANCH_MISMATCH` from a paired terminal → message shown, existing
   token preserved (verify by closing/reopening — still on `/paired`).

For each scenario, open the app's log directory (`app.getPath('logs')`) and grep for the code
and token strings: there must be zero hits.

## 10. PR

Run the full pre-push gate:

```bash
npm run codegen:verify
npm run typecheck
npm run lint
npm test -- --coverage
```

Open the PR using the project template. The Constitution Check line on the review must cite
principles III, V, VI, VII, VIII (the ones this feature meaningfully exercises).

## What this quickstart deliberately leaves out

- No admin-side pairing UI work (separate repo).
- No cashier login surface.
- No `X-Terminal-Token` interceptor on outbound calls (no other endpoints exist yet; the deferred
  feature picks this up).
- No Playwright E2E suite; deferred until a stable mock backend is in place.
