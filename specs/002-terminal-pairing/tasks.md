# Tasks: Terminal Pairing

**Feature:** 002-terminal-pairing
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-03
**Last Updated:** 2026-05-03

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on other incomplete tasks).
- **`[USn]`** maps the task to a user-story phase. Setup, Foundational, and Polish phases have no
  story label.
- All file paths are repository-relative.
- **Test-first per Constitution Principle VI.** Within each story phase, the test task MUST be
  written and seen to fail before its implementation task. The order below reflects this.
- **Task ID gaps are intentional.** `T066`–`T067` are unused; `T079a` and the `Tnnnx` suffix
  forms (`T009a`, `T021a/b`, `T023a/b/c`) are infill from the analysis pass. Numbering is
  preserved across analysis revisions so existing references in PR descriptions remain stable.
- This feature **only** delivers POS-client behaviour. Tasks that would imply admin-side UI,
  cashier login, sales/cart/inventory, offline sync, or self-service unpair are deliberately
  excluded.

## User-story map (from spec acceptance scenarios)

| Story | Priority | Title                                                                       | Spec AS#                |
|:------|:--------:|:----------------------------------------------------------------------------|:------------------------|
| US1   | P1       | Boot routing — unpaired → `/pairing`, paired → `/paired`, persists across restarts | AS-1, AS-4              |
| US2   | P1       | Successful pairing via manual entry **and** wedge scan (single code path)   | AS-2, AS-3              |
| US3   | P1       | Recoverable failure modes — `INVALID_CODE`, `EXPIRED_CODE`, `ALREADY_PAIRED` | AS-5, AS-6, AS-7        |
| US4   | P1       | `BRANCH_MISMATCH` preserves an existing valid token (FR-12, FR-14)          | AS-8                    |
| US5   | P1       | `RATE_LIMITED` disables submit for the indicated duration                   | AS-9                    |
| US6   | P1       | Secrets never appear in logs or Sentry payloads                             | AS-10, FR-9/FR-10/NFR-4 |
| US7   | P2       | Corrupt / orphaned local state recovers cleanly via `/pairing`              | Edge cases, FR-1(c)     |

---

## Phase 1 — Setup

Project plumbing only. No app code touched yet beyond regenerated artifacts.

- [ ] T001 **Refresh the OpenAPI snapshot** to include `POST /api/v1/terminals/pair` in
  `scripts/openapi-snapshot.json`. Preferred path: pull the live spec from
  `https://api.smartdatapulse.tech/openapi.json` via `npm run codegen:api -- --source=live` and
  scope the diff to the new operation + its referenced schemas only. Note that
  `--source=live` overwrites `scripts/openapi-snapshot.json` wholesale; review the diff and
  stage only the pair-operation block plus its referenced schemas, reverting any unrelated
  additions and asking the backend team to coordinate them as their own snapshot refresh. **Fallback path (only if
  the live spec lacks the operation):** hand-author the operation block in
  `scripts/openapi-snapshot.json` byte-for-byte from `specs/002-terminal-pairing/contracts/pairing-http.md`,
  add a one-line comment in the snapshot annotating the fallback, and **open a backend
  coordination ticket**. Record the chosen path (live vs. fallback) in the PR description. **HALT
  this phase and report up** if neither path is viable (e.g., backend repo unreachable AND the
  contract document is incomplete).
- [ ] T002 Run `npm run codegen:api` then `npm run codegen:verify`. Stage only
  `scripts/openapi-snapshot.json` and the regenerated `src/shared/api-types.ts`. Confirm the diff
  contains exactly the new operation block plus the matching TypeScript surface and nothing else.
- [ ] T003 [P] Install renderer routing + state libraries pinned per the constitution Tech Stack:
  `npm install react-router-dom@^7 @tanstack/react-query@^5 zustand@^4`. Update `package.json`
  and `package-lock.json` only.
- [ ] T004 [P] Install renderer-test helpers if not already present:
  `npm install --save-dev @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6`.
  Skip any package already in `package.json`.

---

## Phase 2 — Foundational (Blocking Prerequisites)

These tasks MUST complete before any user-story phase begins. They land the shared types, the
SQLite migration, and the empty bridge surface that every later story consumes.

- [ ] T005 Materialize `src/shared/pairing-types.ts` from
  `specs/002-terminal-pairing/contracts/preload-bridge.ts`: discriminated unions for
  `PairingStatus`, `PairingOutcome`, `PairingSubmitResult`, plus `PAIRING_IPC_CHANNELS`.
  **Source-of-truth policy** (same as 001): from this point forward the source file is canonical;
  the spec contract is a planning snapshot and is NOT re-synced.
- [ ] T006 Extend `src/shared/bridge-api.ts` with the `pairing` namespace declaration (typed
  `getStatus()` and `submit(code)`) — interface only, no implementation. Update the preload stub
  to add a placeholder `pairing` namespace whose methods throw "not implemented" so typecheck
  passes; real wiring lands in US1/US2.
- [ ] T007 [P] Add a failing migration test for `0003_terminal_assignment` to
  `src/main/db/__tests__/migrate.test.ts`: applies cleanly, idempotent on re-run, and the
  `CHECK (id = 1)` constraint rejects a second-row insert. Test fails until T008 lands.
- [ ] T008 Create the migration at `migrations/0003_terminal_assignment.sql` per
  `specs/002-terminal-pairing/data-model.md` (`tenant_id`, `branch_id`, `terminal_id`,
  `terminal_label`, `paired_at`, single-row `CHECK`). T007 passes after this lands.
- [ ] T009 [P] Add a failing test for an extended `pino` redaction list at
  `src/main/logging/__tests__/logger.test.ts` covering `pairing_code` and `device_token` keys (US6
  pulls the implementation in; this test gates that work and exists at the foundational layer so
  every later log emission is implicitly redacted).
- [ ] T009a Implement the redaction list extension in `src/main/logging/logger.ts` so all
  subsequent pairing log emissions inherit it. T009 passes after this lands. **Important:** this
  is the only piece of US6 that must precede the rest of the feature; the schema-restricted
  emitter and the cross-process leak test still belong to US6.

---

## Phase 3 — US1: Boot routing (P1)

**Goal:** A freshly installed terminal opens directly into `/pairing`; a previously paired
terminal opens directly into `/paired`; both decisions persist across restarts.

**Independent test:** Wipe the SecretStore entry for `device_token` and the `terminal_assignment`
row, run `npm run dev` → window opens on `/pairing`. Manually populate both with mock values, run
`npm run dev` → window opens on `/paired` showing the populated tenant/branch/terminal/label.
Restart → same screen, no re-prompt. (AS-1, AS-4.)

- [ ] T010 [P] [US1] Failing test for `pairingStore.getStatus()` covering the full status
  table from `data-model.md` (unpaired / paired / orphaned-row → invalid / orphaned-token →
  invalid / decrypt-failure → invalid) at `src/main/pairing/__tests__/store.test.ts`. Uses 001's
  in-memory `SecretStore` backend and a temp SQLite file.
- [ ] T011 [US1] Implement `src/main/pairing/store.ts` (`getStatus`, `persist`, `clear`) wrapping
  the `SecretStore` and the `terminal_assignment` table. T010 passes after this lands.
- [ ] T012 [P] [US1] Failing test for the `pairing:get-status` IPC channel at
  `src/main/ipc/__tests__/pairing.test.ts`: channel name matches `PAIRING_IPC_CHANNELS.GET_STATUS`,
  handler returns the service's `PairingStatus` unchanged.
- [ ] T013 [US1] Implement the `pairing:get-status` handler at `src/main/ipc/pairing.ts` and
  register it in `app.whenReady()` in `src/main/index.ts`.
- [ ] T014 [US1] Wire `pairing.getStatus()` in `src/preload/index.ts` to call
  `ipcRenderer.invoke(PAIRING_IPC_CHANNELS.GET_STATUS)`.
- [ ] T015 [P] [US1] Failing test for the renderer router at
  `src/renderer/__tests__/router.test.tsx`: when `pairing.getStatus()` resolves to `unpaired` the
  start route is `/pairing`; when it resolves to `paired` the start route is `/paired`; when
  `invalid` the start route is `/pairing` with a `reason` flag.
- [ ] T016 [US1] Add `react-router-dom 7` setup at `src/renderer/router.tsx` and replace the
  blank `App` with a router host that performs the boot-time `pairing.getStatus()` call and
  decides the start route. Empty `PairingScreen` and `PairedScreen` placeholders MAY land here
  to satisfy typecheck; their content lands in US2.
- [ ] T017 [US1] **Manual smoke for US1.** With both halves of state cleared, run `npm run dev`
  → confirm `/pairing` opens. Populate via a one-off REPL or test fixture → restart → `/paired`
  opens. Capture both observations in the PR description.

---

## Phase 4 — US2: Successful pairing (manual + wedge) (P1)

**Goal:** An operator submits a valid pairing code (typed manually OR delivered as keystrokes by
a wedge scanner with a trailing Enter); the device token + assignment persist; the confirmation
screen renders within 5 seconds; the next launch goes directly to `/paired`.

**Independent test:** With a local mock backend issuing one valid code per run, run `npm run
dev`. Submit the code by typing → confirmation visible within 5 s; restart → `/paired` shows the
assignment. Wipe state, submit by pasting `CODE\n` into the focused input (simulating wedge) →
same outcome. (AS-2, AS-3.)

- [ ] T018 [P] [US2] Failing test for the success branch of `mapFailure` at
  `src/main/pairing/__tests__/failure-mapping.test.ts` (a `200 OK` envelope MUST NOT pass through
  `mapFailure`; the test asserts the function is only called on non-2xx, and that an attempt to
  call it with a 2xx is a programmer error).
- [ ] T019 [P] [US2] Failing test for the success path of `network.pair()` at
  `src/main/pairing/__tests__/network.test.ts`: posts to `${VITE_API_BASE_URL}/api/v1/terminals/pair`
  with `Content-Type: application/json` and body `{ pairing_code }`; resolves with the typed
  success envelope; never includes the code in any retained reference (assert via fake-fetch
  observer that `JSON.stringify(observerLog)` does not contain the code).
- [ ] T020 [US2] Implement `src/main/pairing/failure-mapping.ts` (success-path guard only at
  this stage; other branches land in US3+).
- [ ] T021 [US2] Implement `src/main/pairing/network.ts` using built-in `fetch` and the generated
  request/response types from `src/shared/api-types.ts`. For reachable non-success responses,
  **return** a typed `{ ok: false, status, body: { code: 'UNKNOWN_ERROR' } }` envelope (with
  whatever the backend body actually is, defaulting `code` to `'UNKNOWN_ERROR'` only when the
  body lacks a recognised code field) — `network.pair()` MUST NOT throw for any reachable backend
  response. The **only** rejection path is transport failure (DNS / TLS / connection refused /
  fetch reject / abort); transport failures reject with a typed `TransportError` whose message
  contains neither the `pairing_code` nor any local secret. US3+ refines the body-code mapping;
  this contract (resolve-on-reachable, reject-only-on-transport) is locked from MVP onward.
- [ ] T021a [P] [US2] Failing test in `src/main/pairing/__tests__/network.test.ts` for the
  transport-failure path: when the injected fake `fetch` rejects (DNS / TLS / connection refused
  / abort), `network.pair()` rejects with a typed `TransportError`; assert the rejection's
  message contains neither the submitted pairing code nor any token-shaped string.
- [ ] T021b [P] [US2] Failing test in `src/main/pairing/__tests__/network.test.ts` for the
  client-side timeout path: `network.pair()` aborts via `AbortSignal.timeout(30_000)` after 30
  seconds of no response; the rejection is a typed `TransportError` with a `timed_out: true`
  field. Vitest fake timers drive the assertion. The Pairing screen never freezes during this
  window (asserted in the renderer test under T027 — the form's button is disabled-not-frozen,
  the window remains responsive, and the form re-enables when the timeout resolves).
- [ ] T022 [P] [US2] Failing test for the success path of `PairingService.submit` at
  `src/main/pairing/__tests__/service.test.ts`: persists token via SecretStore AND writes the
  `terminal_assignment` row in a single transactional unit; rolls back the SecretStore write if
  the SQL write fails (test injects a SQL-write fake that throws).
- [ ] T023 [US2] Implement `src/main/pairing/service.ts` success path: `network.pair()` →
  `pairingStore.persist()` → emit `pairing_attempt` log with `outcome: 'success'`.
- [ ] T023a [US2] Implement the **service catch-all** that lands in MVP (the contract from
  `contracts/pairing-service.ts` MUST hold from PR #1 onward). `PairingService.submit`:
  - For any reachable non-success envelope whose body code is not yet recognised by
    failure-mapping, default to `outcome: 'unknown_error'`.
  - For a `TransportError` rejection from `network.pair()` (including the 30 s client-side
    timeout from T021b), catch and resolve to `outcome: 'network_error'`. When the
    `TransportError` carries `timed_out: true`, the emitted log record MUST include
    `timed_out: true`.
  - **Never** rejects for any backend or network outcome — the only rejection path is
    programmer error (invalid argument shape into `submit`).
  - Leaves any prior persisted state (token + assignment row) untouched.
  - Emits exactly one safe `pairing_attempt` log record per call (no `pairing_code`,
    no `device_token`).
  US3 / US4 / US5 / US7 later refine the outcome categories; this catch-all guarantees the
  bridge contract holds from MVP regardless.
- [ ] T023b [P] [US2] Failing test in `src/main/pairing/__tests__/service.test.ts` for the
  transport-rejection path of T023a: pre-populate a known token + assignment, drive a
  `TransportError` rejection from network, assert (a) `submit` resolves with
  `outcome: 'network_error'`, (b) prior persisted state is byte-for-byte unchanged, (c) exactly
  one log record with `outcome: 'network_error'` is emitted (and `timed_out: true` when the
  transport error carries it), (d) no log payload contains the submitted code or any
  token-shaped string.
- [ ] T023c [P] [US2] Failing test in `src/main/pairing/__tests__/service.test.ts` for the
  unknown-envelope path of T023a: a reachable non-success response whose body code is unknown
  resolves with `outcome: 'unknown_error'`, prior state untouched, exactly one log record with
  `outcome: 'unknown_error'`.
- [ ] T024 [P] [US2] Failing test for the `pairing:submit` IPC handler in the existing
  `src/main/ipc/__tests__/pairing.test.ts`: channel name matches
  `PAIRING_IPC_CHANNELS.SUBMIT`; non-string input is rejected before reaching the service; the
  service result is forwarded unchanged.
- [ ] T025 [US2] Implement the `pairing:submit` handler in `src/main/ipc/pairing.ts`.
- [ ] T026 [US2] Wire `pairing.submit()` in `src/preload/index.ts` to call
  `ipcRenderer.invoke(PAIRING_IPC_CHANNELS.SUBMIT, code)`.
- [ ] T027 [P] [US2] Failing test for `PairingForm` at
  `src/renderer/routes/pairing/__tests__/PairingForm.test.tsx`: typing a code and pressing Enter
  calls `pairing.submit` exactly once with the typed string; submit is disabled while in flight;
  submit re-enables after the result is in.
- [ ] T028 [P] [US2] Failing test for `PairingForm` simulating wedge input via
  `userEvent.keyboard('VALIDCODE{Enter}')` against the autofocused input — calls
  `pairing.submit('VALIDCODE')` exactly once; no extra submits on focus or on partial input.
- [ ] T029 [US2] Implement `src/renderer/routes/pairing/PairingForm.tsx` with a single
  `<input type="text" autoComplete="off" spellCheck={false}>`, an Enter-with-content guard, and
  a `submit` handler that calls the bridge.
- [ ] T030 [P] [US2] Failing test for `PairingScreen` at
  `src/renderer/routes/pairing/__tests__/PairingScreen.test.tsx`: renders `PairingForm`,
  autofocus is set on the input on mount, no other input elements exist on the route.
- [ ] T031 [US2] Implement `src/renderer/routes/pairing/PairingScreen.tsx`.
- [ ] T032 [P] [US2] Failing test for `PairedScreen` at
  `src/renderer/routes/paired/__tests__/PairedScreen.test.tsx`: renders the
  tenant/branch/terminal-label fields from the bridge's `getStatus()` result; no `device_token`
  field reaches the component (assert via render output).
- [ ] T033 [US2] Implement `src/renderer/routes/paired/PairedScreen.tsx`.
- [ ] T034 [US2] Wire navigation in the form: on `outcome === 'success'`, navigate to
  `/paired`. Failing test in `PairingForm.test.tsx` asserts the navigation call.
- [ ] T035 [US2] **Manual smoke for US2.** Run the local mock backend that issues one valid code
  per request (e.g., `POST` returns the documented success envelope). With cleared state, run
  `npm run dev` and verify both flows (manual entry + paste-with-Enter for the wedge sim)
  complete in under 5 s and survive a restart. Capture in PR description.

---

## Phase 5 — US3: Recoverable failure modes (`INVALID_CODE`, `EXPIRED_CODE`, `ALREADY_PAIRED`) (P1)

**Goal:** Each documented backend rejection produces a distinct, friendly user-facing message;
no token or assignment is ever stored on a failed attempt; the operator can retry from the same
form without restarting the app.

**Independent test:** With the mock backend cycling through 400 `INVALID_CODE`, 410
`EXPIRED_CODE`, and 409 `ALREADY_PAIRED`, submit codes from the dev app and observe three
distinct messages and zero changes to the SecretStore + DB state. (AS-5, AS-6, AS-7.)

- [ ] T036 [P] [US3] Failing test cases in `failure-mapping.test.ts` for each documented body
  code → outcome category (`INVALID_CODE → invalid_code`, `EXPIRED_CODE → expired_code`,
  `ALREADY_PAIRED → already_paired`); plus the "unknown body shape → `unknown_error`, never
  throws" case.
- [ ] T037 [US3] Extend `src/main/pairing/failure-mapping.ts` with the three branches plus the
  defensive default. T036 passes.
- [ ] T038 [P] [US3] Failing test in `network.test.ts`: 400 / 410 / 409 responses with the
  documented envelope are surfaced verbatim (status + body) to the caller; never throws.
- [ ] T039 [US3] Extend `src/main/pairing/network.ts` to forward non-2xx responses as typed
  failure envelopes.
- [ ] T040 [P] [US3] Failing test in `service.test.ts`: each of the three outcomes returns the
  expected `PairingSubmitResult` AND leaves both halves of persisted state untouched (assert by
  read-back of SecretStore and SQL row before/after the call). Pre-condition: a previously-paired
  state is set up so the assertion is meaningful.
- [ ] T041 [US3] Wire the three outcome branches through `service.ts`, ensuring no write path is
  taken on any failure (the invariant from FR-8 lands here as one explicit "failure path = log
  only" code branch).
- [ ] T042 [P] [US3] Failing test in `PairingForm.test.tsx`: each of the three outcomes
  surfaces a distinct user-visible message (test by `getByText`), the form remains editable,
  and no navigation occurs.
- [ ] T043 [US3] Implement the outcome → message family map at
  `src/renderer/routes/pairing/messages.ts` and consume it in `PairingForm`.
- [ ] T044 [P] [US3] Failing test in `PairingForm.test.tsx`: empty / whitespace-only submit
  performs no bridge call and surfaces a client-side validation message.
- [ ] T045 [US3] Implement the empty-input guard in `PairingForm`.

---

## Phase 6 — US4: `BRANCH_MISMATCH` preserves a valid token (P1)

**Goal:** When a re-pair attempt against a different branch is rejected with `BRANCH_MISMATCH`,
the existing `device_token` and `terminal_assignment` row remain unchanged; the operator sees an
explanatory message but the app does not navigate away from `/pairing` (this is the recovery
surface for an admin-driven reassignment, per the 2026-05-03 clarification — Option B).

**Independent test:** Pair the app successfully (T035 sets this up), then attempt another pair
with a code the mock returns `BRANCH_MISMATCH` for. Observe (a) the explanatory message, (b)
SecretStore still contains the original token, (c) `terminal_assignment` row still contains the
original assignment, (d) on application restart `/paired` opens with the original assignment.
(AS-8.)

- [ ] T046 [P] [US4] Failing test case in `failure-mapping.test.ts` for `BRANCH_MISMATCH →
  branch_mismatch`.
- [ ] T047 [US4] Extend `failure-mapping.ts` with the `BRANCH_MISMATCH` branch.
- [ ] T048 [P] [US4] Failing test in `service.test.ts` covering FR-14 explicitly: pre-populate
  a known token + assignment, drive a `BRANCH_MISMATCH` submit, assert both halves are byte-for-
  byte identical after the call.
- [ ] T049 [US4] Verify `service.ts` already honours the FR-8 invariant for `BRANCH_MISMATCH`;
  add a code-comment cross-referencing FR-14 next to the failure branch so future readers cannot
  accidentally introduce a "clear on mismatch" path.
- [ ] T050 [P] [US4] Failing test in `PairingForm.test.tsx`: a `BRANCH_MISMATCH` outcome shows
  the explanatory message family ("registered to a different branch — ask admin to release it")
  and does not navigate.
- [ ] T051 [US4] Add the `BRANCH_MISMATCH` entry to the message dictionary; no navigation
  change required.

---

## Phase 7 — US5: `RATE_LIMITED` enforcement (P1)

**Goal:** A 429 `RATE_LIMITED` response disables submit on the form for the parsed `Retry-After`
duration, clamped to `[1 s, 300 s]`, with a default of 30 s on parse failure. The operator
cannot exhaust further attempts until the timer elapses.

**Independent test:** With the mock backend returning 429 + `Retry-After: 5`, submit and confirm
submit is disabled for ≥ 5 s and re-enables. Repeat with `Retry-After: 9999` (clamped to 300 s)
and with no header (default 30 s). (AS-9 / NFR-5.)

- [ ] T052 [P] [US5] Failing test in `network.test.ts` for `Retry-After` parsing: integer
  delta-seconds, HTTP-date, missing header, malformed value; clamp to `[1, 300]`; default to 30
  on parse failure.
- [ ] T053 [US5] Implement `Retry-After` parsing in `network.ts`; surface `retry_after_s` on
  the typed failure envelope only when status === 429.
- [ ] T054 [P] [US5] Failing test in `failure-mapping.test.ts`: `RATE_LIMITED` outcome carries
  `retry_after_s` through unchanged; service.test asserts the value flows to the
  `PairingSubmitResult` discriminated union.
- [ ] T055 [US5] Extend `failure-mapping.ts` with the `RATE_LIMITED` branch.
- [ ] T056 [P] [US5] Failing test in `PairingForm.test.tsx` (use Vitest fake timers): on a
  `rate_limited` outcome the submit button stays disabled for the full `retry_after_s` and
  re-enables exactly afterwards. Additionally assert (analysis finding L2) that the visible
  message is **distinct** from the other failure messages — match it via case-insensitive
  text, e.g. `expect(getByText(/too many attempts/i)).toBeVisible()`.
- [ ] T057 [US5] Implement the disabled-state timer in `PairingForm` (Zustand-backed local
  store with a `disabledUntil: number | null` field reset by an effect timer).

---

## Phase 8 — US6: Secrets never leak to logs / Sentry (P1)

**Goal:** Every pairing path emits exactly one structured `pairing_attempt` log record. No log
record, Sentry breadcrumb, or telemetry payload contains the `pairing_code` or the `device_token`
— at any log level, on any outcome, in any process.

**Independent test:** Drive the service through every outcome category (success + 6 failures);
capture all `pino` output and any Sentry calls (Sentry mocked when DSN absent); assert that
neither the submitted code string nor any returned token string appears as a substring in the
captured stream. (AS-10 / FR-9 / FR-10 / NFR-4.)

- [ ] T058 [P] [US6] Failing test for the schema-restricted `pairingLog` emitter at
  `src/main/pairing/__tests__/log.test.ts`: only records matching the `PairingAttemptLogRecord`
  schema (event, outcome, at, optional terminal_id, optional retry_after_s) are accepted; any
  other key throws at the type level (asserted via `expectTypeOf`) and at runtime via a guard.
- [ ] T059 [US6] Implement `src/main/pairing/log.ts` exposing the typed `pairingLog(record)`
  emitter that delegates to the existing `pino` logger with namespace `pairing`. Strict
  whitelisting of fields.
- [ ] T060 [P] [US6] Failing test in `service.test.ts`: every outcome branch emits exactly
  ONE `pairing_attempt` log record with the expected `outcome` and `at` fields; success carries
  `terminal_id`; rate-limited carries `retry_after_s`; no other fields appear.
- [ ] T061 [US6] Wire `pairingLog` into `service.ts`; remove any `logger.info` / `logger.error`
  calls in the pairing module that bypass `pairingLog`.
- [ ] T062 [P] [US6] Failing cross-process redaction test at
  `src/tests/pairing-redaction.test.ts`: instantiate the service with capturing fakes, drive all
  seven outcomes (one success + six failure categories), and assert the captured `pino` stream
  contains zero substring matches for either the submitted code or any returned token.
  **Extended (analysis finding L3):** with a mocked `@sentry/electron` and a fake DSN configured,
  the test ALSO captures every `Sentry.addBreadcrumb` AND `Sentry.captureException` invocation
  across the same outcomes and asserts zero substring matches there too — proving FR-10 holds
  for both observability surfaces, not just `pino`.
- [ ] T063 [US6] Confirm T062 passes with no source change beyond what T058–T061 already landed
  (the test is a contract assertion, not a place to fix). If it fails, tighten the redaction or
  the `pairingLog` schema; do NOT relax the test.
- [ ] T064 [P] [US6] Failing test for Sentry breadcrumb behaviour at
  `src/main/observability/__tests__/sentry-pairing.test.ts`: with a mocked Sentry SDK and DSN
  set, each pairing outcome adds a breadcrumb with category `pairing` carrying `outcome` and
  HTTP `status` only; with DSN absent, no breadcrumb is added (Sentry remains inert).
- [ ] T065 [US6] Wire the Sentry breadcrumb in `service.ts`. Use the existing `@sentry/electron`
  main client from 001; do NOT re-init.

---

## Phase 9 — US7: Corrupt / orphaned local state recovery (P2)

**Goal:** When the SecretStore entry is missing while the assignment row exists, when the
assignment row is missing while the SecretStore entry exists, or when the SecretStore entry
exists but DPAPI fails to decrypt it, the application reports `invalid` and routes to
`/pairing` with a diagnostic banner. The recovery is a normal pair attempt — no reinstall or
admin support is required for the device side.

**Independent test:** With a successfully paired terminal, manually corrupt the SecretStore
entry (overwrite raw bytes such that DPAPI cannot decrypt). Restart → app opens on `/pairing`
with the diagnostic banner naming `decrypt_failed`. Submit a fresh valid code → success returns
the operator to `/paired`. Repeat with each orphaned-half scenario from `data-model.md`.
(Edge cases / FR-1(c).)

- [ ] T068 [P] [US7] Failing test extension in `store.test.ts`: each `invalid` reason
  (`missing_token`, `orphaned_row`, `decrypt_failed`) is reported distinctly via the
  `PairingStatus.reason` discriminator. (Some of these were covered by T010; this task makes
  the reason-tag explicit and tested.)
- [ ] T069 [P] [US7] Failing test in `PairingScreen.test.tsx`: when the bridge's `getStatus()`
  resolves to `{ kind: 'invalid', reason }`, the screen renders a diagnostic banner whose text
  varies by reason (`missing_token` / `orphaned_row` / `decrypt_failed`).
- [ ] T070 [US7] Implement the diagnostic banner component at
  `src/renderer/routes/pairing/InvalidStateBanner.tsx` and compose it in `PairingScreen` only
  when `getStatus()` returned `invalid`.
- [ ] T071 [P] [US7] Failing test for `pairingStore.clear()` at `store.test.ts`: idempotent;
  drops both halves; never logs the prior token's value.
- [ ] T072 [US7] Confirm `pairingStore.clear()` passes T071 (likely already implemented under
  T011). If not, fill the gap. Add a comment cross-referencing the deferred 401-interceptor
  (no implementation here, just the seam).
- [ ] T073 [US7] **Manual smoke for US7.** With a known-paired terminal, programmatically
  corrupt the SecretStore entry (e.g., write garbage bytes to the underlying file via a small
  one-off REPL script — DO NOT add this to the source tree), restart the app, observe the
  `/pairing` banner naming `decrypt_failed`, complete a fresh pairing, observe `/paired`.
  Capture in PR description.

---

## Phase Final — Polish & Cross-Cutting

Cleanups, generic-message coverage, focus management, doc, and the full pre-push gate. No new
feature behaviour.

- [ ] T074 [P] Add `network_error` and `unknown_error` outcomes to the renderer message
  dictionary at `src/renderer/routes/pairing/messages.ts` (covered partially by T043; this task
  closes the remaining two categories with friendly, action-oriented copy).
- [ ] T075 [P] Failing test then implementation for the empty-Enter-on-focus regression in
  `PairingForm.test.tsx`: focusing the input and immediately pressing Enter (no characters
  typed) MUST be a no-op (no bridge call, no client-side error). Implementation lives alongside
  the existing empty-input guard from T045.
- [ ] T076 [P] Confirm `docs/hardware-matrix.md` requires no update (no new hardware in this
  feature). If the doc still says "pairing screen and cart screen are the two contexts where
  wedge input is accepted by design" verbatim, leave it; otherwise file a doc-only fix.
- [ ] T077 Run the full pre-push gate locally:
  ```
  npm run codegen:verify
  npm run typecheck
  npm run lint
  npm test -- --coverage
  npm run package:dir
  ```
  All MUST pass before opening the PR.
- [ ] T078 Coverage check: every new module under `src/main/pairing/`, the `PairingForm` and
  `PairingScreen` components, and the cross-process redaction test MUST report ≥ 80% line +
  branch coverage in the Vitest report. The `pairing-redaction.test.ts` MUST be the only test
  file in the run that asserts no-secret-leakage; coverage of the redaction code paths shows
  100% green.
- [ ] T079 **End-to-end manual smoke against the local mock backend.** Walk through every
  scenario in `specs/002-terminal-pairing/quickstart.md` § 9 (valid code, restart persistence,
  decrypt-failure recovery, INVALID, RATE_LIMITED with timer, BRANCH_MISMATCH preservation).
  After each scenario, grep the `app.getPath('logs')` directory for the submitted code and any
  returned token strings; confirm zero hits. Capture in PR description.
- [ ] T079a [P] **FR-13 absence regression test** (analysis finding L1) at
  `src/renderer/__tests__/no-self-service-unpair.test.tsx`: mount each route reachable from a
  paired state (`/paired`) and assert the rendered tree contains zero elements whose text or
  `data-testid` matches `/^unpair$/i`, `/reset terminal/i`, `/forget device/i`. Repeat for
  `/pairing` to confirm no "unpair this terminal" affordance is exposed there either. The test
  is a regression guard — its failure means a future feature accidentally added a
  self-service unpair surface, which the constitution's Option-B clarification forbids.
- [ ] T080 Open the PR using the project template; the Constitution Check line MUST cite
  principles **III, V, VI, VII, VIII** (the ones this feature meaningfully exercises). Link the
  spec / plan / tasks artifacts. Mark non-blocking open item **O1** (Sentry tagging — covered or
  deferred?) explicitly in the PR description so a reviewer can decide.

---

## Dependency Graph

```
Setup (T001 – T004)
   │
   ▼
Foundational (T005 – T009a)        ← blocks every story
   │
   ├─► US1 (T010 – T017)            ← independent of US2+
   │
   ├─► US2 (T018 – T035)            ← consumes US1's getStatus + bridge surface
   │       │
   │       ├──► US3 (T036 – T045)   ← extends failure-mapping / network / service / form
   │       │
   │       ├──► US4 (T046 – T051)   ← orthogonal to US3 modulo a shared message dictionary
   │       │
   │       └──► US5 (T052 – T057)   ← orthogonal to US3/US4
   │
   ├─► US6 (T058 – T065)            ← started after T009a; finalised after US3/US4/US5 land
   │                                   so the redaction test (T062) covers all outcomes
   │
   └─► US7 (T068 – T073)            ← consumes US1 (`invalid` reasons) and US2 (`clear()` seam)
                                       no dependency on US3/US4/US5
   │
   ▼
Phase Final (T074 – T080)            ← blocks merge
```

**Critical path:** T001 → T002 → T005 → T006 → T010/T011 → T013/T014/T016 → T020/T021/T023 →
T025/T026 → T029/T031/T034 → T062 → T077 → T080.

Removing any task from US1, US2, or US6 from the critical path silently weakens the constitution
checks (Principles III, V, VII, VIII) — those phases MUST land before merge.

## Parallel Execution Examples

Within a single PR, the following groups can be worked concurrently by different developers (or
by one developer in parallel branches if review cadence permits):

- **Setup batch:** T003 and T004 share no files with T001/T002 once codegen has landed.
- **Foundational batch:** T007 (migration test) is independent of T009 (logger redaction test);
  both fail until their implementations land but neither blocks the other.
- **US3 vs US4 vs US5:** all three extend the same three modules (`failure-mapping`, `network`,
  `service`) but in disjoint outcome branches; the [P] tests are safe to write in parallel,
  while the implementation tasks (T037 / T047 / T053 / T055) MUST land sequentially to avoid
  merge conflicts in the same files.
- **US6 schema-restricted emitter (T058 → T059)** can run in parallel with US3/US4/US5 because
  it touches `src/main/pairing/log.ts` only; its cross-process test (T062) MUST be deferred
  until US3/US4/US5 land all outcomes.
- **Renderer tests (T027/T028/T030/T032/T042/T044/T050/T056/T069):** all `[P]` because each
  targets a different test file.

## Implementation Strategy

**MVP slice (the smallest set that satisfies the constitution + spec acceptance scenarios that a
real installer would touch on day one):**

> Setup (T001–T004) → Foundational (T005–T009a) → US1 (T010–T017) → US2 (T018–T035, **including
> T021a, T021b, T023a, T023b, T023c**) → US6 (T058–T065) → Phase Final (**T074**, T077, T078,
> T079, T080).

This slice delivers a paired terminal that survives restarts, with secrets verifiably scrubbed
from observability. T023a's service catch-all guarantees the bridge contract from PR #1 onward:
every backend or network outcome resolves with a typed `PairingSubmitResult`, never rejects.
T074 ships the renderer message-dictionary entries for `network_error` and `unknown_error`, so
the form is correct-but-coarse on any failure (one generic friendly message per category) rather
than blank. US3 / US4 / US5 / US7 then refine the typed outcome categories without changing this
contract.

**Recommended PR sequencing:**

1. **PR #1 — MVP slice** (above). Tag the PR with `feature/002-mvp`. Reviewers focus on bridge
   surface, secret handling, and redaction.
2. **PR #2 — Recoverable failures (US3 + US4 + US5).** Adds the per-outcome message dictionary,
   `BRANCH_MISMATCH` token-preservation invariants, and the rate-limit timer. Covers AS-5/6/7/8/9.
3. **PR #3 — Orphaned-state recovery (US7).** Adds the diagnostic banner and the explicit
   `clear()` test. Closes the FR-1(c) edge case.

Each PR's Constitution Check cites exactly the principles it touches; cross-PR drift is
prevented by the always-on `codegen:verify` and the cross-process redaction test, which lock
in MVP-slice invariants for every later PR.

## Risks & Blockers

- **B1 — Live OpenAPI lacks `/api/v1/terminals/pair`** (most likely blocker at T001). T001's
  fallback path (hand-author from `contracts/pairing-http.md` + open backend ticket) is a
  documented workaround; if neither path is viable, **HALT this feature and report up** — no
  later task can complete without typed request/response shapes.
- **B2 — `safeStorage.isEncryptionAvailable() === false` on the build CI runner.** Inherited
  from 001 and already mitigated by the in-memory test backend; flagged here because it is the
  one configuration that would block US2/US7 in CI specifically.
- **R1 — `Retry-After` header on the mock backend.** Mock implementations may default to no
  header. Mitigation: T056 uses Vitest fake timers and a local fake fetch — does not depend on
  the live backend.
- **R2 — TanStack Query interaction with the renderer router.** Boot-time `getStatus()` is a
  one-shot call, so Query is not strictly required for it; using a plain `useEffect` keeps US1
  small. Reserve TanStack Query for the `submit` mutation in US2 so loading / disabled / retry
  semantics are uniform.
- **O1 — Sentry tagging strategy** (carried forward from `plan.md`). T064/T065 ship the
  breadcrumb; whether to add a Sentry tag for outcome-grouping is left to PR review. If
  tagged, the tag MUST be the outcome category only.

---

*This file is the source for `/speckit-implement`. Changes to scope, constitution interpretation,
or the user-story map after task generation MUST update this file (and re-run any analyses)
before implementation resumes.*
