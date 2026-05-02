# Tasks: Foundation

**Feature:** 001-foundation
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-05-01
**Last Updated:** 2026-05-01

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on incomplete tasks).
- **`[USn]`** maps the task to a user-story phase.
- All file paths are repository-relative.
- **Test-first per Constitution Principle VI.** Inside each story phase, the test task MUST be
  written and run (and seen to fail) before its corresponding implementation task. The order below
  reflects this.

## User-story map (from spec acceptance scenarios)

| Story | Priority | Title | Spec AS#  |
|:------|:--------:|:--|:--|
| US1   | P1       | Secure Electron app launches in dev mode (window + isolation + bridge) | AS-1, AS-2, AS-3 |
| US2   | P1       | Local SQLite database with migration runner | AS-4 |
| US3   | P1       | Secret storage abstraction | AS-5 |
| US4   | P1       | OpenAPI types codegen and drift verification | AS-6 |
| US5   | P1       | Money module with strong tests | AS-9 |
| US6   | P2       | Local structured logging | AS-7 |
| US7   | P2       | Crash reporting wired and inert without DSN | AS-8 |
| US8   | P2       | CI pipeline + package dry-run artifact | AS-10, AS-11 |
| US9   | P3       | Hardware matrix documentation | AS-12 |

---

## Phase 1 — Setup

Project initialization, configs, dependencies, scripts. No app code yet.

- [X] T001 Initialize `package.json` with project metadata (name `pos-pulse`, version `0.1.0`, description, license, type `module`, main `dist/main/index.js`, engines.node `>=20`) at `package.json`
- [X] T002 [P] Add `.nvmrc` pinning Node 20 LTS at `.nvmrc`
- [X] T003 [P] Create base `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `paths` for `@shared/*` and `@main/*` at `tsconfig.json`
- [X] T004 [P] Create `tsconfig.main.json` extending base, `target: node20`, includes `src/main/**`, `src/preload/**`, `src/shared/**` at `tsconfig.main.json`
- [X] T005 [P] Create `tsconfig.renderer.json` extending base, `target: ES2022`, `lib: ["ES2022", "DOM"]`, JSX `react-jsx`, includes `src/renderer/**`, `src/shared/**` at `tsconfig.renderer.json`
- [X] T006 [P] Configure ESLint flat config (typescript-eslint v8 strict-type-checked, eslint-plugin-react, eslint-plugin-react-hooks, electron-security recommended rules) at `eslint.config.js`
- [X] T007 [P] Configure Prettier (single quotes, semicolons, width 100) at `.prettierrc` and ignore patterns at `.prettierignore`
- [X] T008 [P] Add `.editorconfig` (LF, UTF-8, 2-space indent, trim trailing whitespace) at `.editorconfig`
- [X] T009 [P] Create `.env.example` documenting `SENTRY_DSN`, `VITE_API_BASE_URL`, `ELECTRON_UPDATE_FEED_URL` (all optional in 001) at `.env.example`
- [X] T010 Install runtime dependencies in **three batches** (so a failure points at the offending group, not the whole install). Versions verified against the npm registry on 2026-05-01.
    - **T010a** Shell: `npm install electron@^40.9 react@^19.2 react-dom@^19.2`
    - **T010b** Data: `npm install better-sqlite3@^12.9`
    - **T010c** Observability + UI util: `npm install pino@^10.3 pino-roll@^4.0 @sentry/electron@^7.13 clsx@^2.1`
- [X] T011 Install dev dependencies in **three batches**. Versions verified against the npm registry on 2026-05-01.
    - **T011a** Build & test: `npm install --save-dev vite@^8.0 @vitejs/plugin-react@^6.0 typescript@^5.9 vitest@^4.1 @vitest/coverage-v8@^4.1 happy-dom@^20 electron-builder@^26.8 @electron/rebuild@^4.0 concurrently@^9 wait-on@^8 cross-env@^7 tsx@^4`
    - **T011b** Lint & format: `npm install --save-dev eslint@^9.39 typescript-eslint@^8 eslint-plugin-react@^7 eslint-plugin-react-hooks@^5 prettier@^3`
    - **T011c** Codegen, styling, types: `npm install --save-dev openapi-typescript@^7.13 tailwindcss@^4.2 @tailwindcss/postcss@^4.2 postcss@^8 autoprefixer@^10 @types/node@^20 @types/react@^19 @types/react-dom@^19 @types/better-sqlite3@^7`
- [X] T012 Add scripts to `package.json`: `dev`, `dev:vite`, `dev:electron`, `build:renderer`, `build:main`, `build`, `codegen:api`, `codegen:verify`, `typecheck`, `lint`, `lint:fix`, `format`, `test`, `test:watch`, `package:dir`, `postinstall` (electron-rebuild for better-sqlite3) at `package.json`
- [X] T013 [P] Configure PostCSS to use `@tailwindcss/postcss` at `postcss.config.cjs` and create `tailwind.config.ts` with content paths and dark-mode `class` strategy at `tailwind.config.ts`
- [X] T014 [P] Create initial `README.md` (replacing the one-line bootstrap) with quickstart pointing at `specs/001-foundation/quickstart.md` at `README.md`

---

## Phase 2 — Foundational (Blocking Prerequisites)

These tasks MUST complete before any user-story phase begins. They establish the renderer scaffold,
the Electron main shell, the typed bridge contract, the test harness, and the build/package config.
Nothing here proves a user story; it just makes the user-story work runnable.

- [X] T015 Create renderer entry HTML with strict CSP meta and no inline scripts at `src/renderer/index.html`
- [X] T016 [P] Create Tailwind CSS entry (`@import "tailwindcss";`) at `src/renderer/styles/tailwind.css`
- [X] T017 [P] Create renderer bootstrap mounting React root at `src/renderer/main.tsx`
- [X] T018 [P] Create blank `App` component (single empty `<main>`, no Tailwind classes used yet) at `src/renderer/App.tsx`
- [X] T019 [P] Configure Vite for the renderer (`root: 'src/renderer'`, `build.outDir: '../../dist/renderer'`, react plugin, server.port 5173) at `vite.config.ts`
- [X] T020 [P] Configure Vitest with `environment: 'happy-dom'`, `coverage.provider: 'v8'`, per-file thresholds for `src/shared/money.ts` (95% line + branch), and reporters at `vitest.config.ts`
- [X] T021 [P] Create shared types directory with placeholder `index.ts` at `src/shared/types.ts`
- [X] T022 Materialize the `PreloadBridgeAPI` interface at `src/shared/bridge-api.ts` based on `specs/001-foundation/contracts/preload-bridge.ts`. **Policy:** from this point forward, `src/shared/bridge-api.ts` is the canonical contract; the spec file is a planning snapshot and is NOT re-synced. The same policy applies to the SecretStore (T045) and Money (T057) materializations. See plan.md § Phase 1 → "Source-of-truth policy."
- [X] T023 Create Electron main entry with secure `BrowserWindow` defaults (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, preload script wired, devtools open in dev only) and a strict CSP via `session.defaultSession.webRequest.onHeadersReceived` at `src/main/index.ts`
- [X] T024 Create preload script using `contextBridge.exposeInMainWorld('api', impl)` matching `PreloadBridgeAPI` (initially an empty stub object; methods land in US1) at `src/preload/index.ts`
- [X] T025 Wire `npm run dev`: `concurrently` runs `vite` and (after `wait-on http://localhost:5173`) compiles main+preload via `tsc -p tsconfig.main.json` and launches `electron .` at `package.json` (scripts) + a small `scripts/dev-electron.cjs` if needed
- [X] T026 [P] Configure `electron-builder` for Windows: `productName`, `appId` `tech.smartdatapulse.pos`, `win.target: dir`, `directories.output: dist-electron`, `files` includes `dist/**` at `electron-builder.yml`
- [X] T027 [P] Add `postinstall` script invoking `@electron/rebuild` (`npx electron-rebuild -f -w better-sqlite3`) so the native module ABI matches Electron's bundled Node at `package.json`
- [X] T027a **Phase 2 closing smoke (manual, gating).** Run `npm install` (verifying T010+T011 batches succeed in order), then `npm run dev`. Confirm: (a) the empty Electron window opens; (b) the renderer's devtools console is clean (no errors, no Node-globals warnings); (c) `window.api` exists as an empty object (or whatever stub Phase 2 lands); (d) shutting the app exits cleanly. **Do not declare Phase 2 complete until this manual smoke passes.** No file output; record the verification in the PR description for the Phase 1+2 PR.

---

## Phase 3 — US1: Secure Electron app launches in dev mode (P1)

**Goal:** Running `npm run dev` opens a single empty Electron window with secure defaults, and the
renderer reaches the main process exclusively through a typed `window.api` bridge whose contract is
shared and TypeScript-enforced.

**Independent test:** On a clean machine, `npm run dev` opens a window. In devtools, `window.api.ping()`
returns `"pong"` and `window.api.appVersion()` returns the package version. `window.require`,
`window.process`, and `window.Buffer` are all `undefined`. (AS-1, AS-2, AS-3 from spec.)

- [X] T028 [P] [US1] Write a renderer no-Node-globals **regression guard** Vitest at `src/tests/renderer-isolation.test.ts` asserting `window.require`, `window.process`, and `window.Buffer` are all `undefined`. Note: in `happy-dom` these are absent by default, so this test passes from the start; its purpose is to fail loudly if a future change accidentally exposes Node to the renderer. Real packaged-build isolation is verified by the polish-phase smoke step (T079). **Implementation note:** happy-dom v20 exposes `Buffer`/`process` as Node-compatibility shims, so the test was implemented as a static-source guard verifying `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, `webSecurity:true` remain set in `src/main/index.ts`. Real renderer isolation is verified by T034 + T079.
- [X] T029 [P] [US1] Write failing bridge-typing test at `src/tests/bridge-typing.test.ts` that uses `expectTypeOf` (or equivalent) to assert `window.api` matches `PreloadBridgeAPI`
- [X] T030 [P] [US1] Write failing IPC unit test for the `ping` handler at `src/main/ipc/__tests__/ping.test.ts` — fails until handler exists. **Extension (D1):** matching test added at `src/main/ipc/__tests__/app-version.test.ts` to close the TDD gap before T032.
- [X] T031 [US1] Implement `ping` IPC handler returning `"pong"` at `src/main/ipc/ping.ts`
- [X] T032 [US1] Implement `appVersion` IPC handler reading `app.getVersion()` at `src/main/ipc/app-version.ts`
- [X] T033 [US1] Register both handlers in `app.whenReady()` and update preload bridge implementation to call them via `ipcRenderer.invoke` at `src/main/index.ts` and `src/preload/index.ts`
- [X] T034 [US1] Run `npm run dev` locally; verify window opens, devtools confirm `window.api.ping()` resolves to `"pong"` and Node globals are unreachable. Capture the verification in the PR description.

---

## Phase 4 — US2: Local SQLite database with migration runner (P1)

**Goal:** A `better-sqlite3` database file lives under the user's app-data directory; a transactional
migration runner applies pending SQL files in order, records each in `schema_migrations`, is
idempotent on re-run, and rolls back failed migrations cleanly.

**Independent test:** Add a new file `migrations/0002_smoke.sql` containing
`CREATE TABLE smoke (id INTEGER PRIMARY KEY);`; relaunch the app; observe `smoke` table created and
`schema_migrations` has rows for `0001_init` and `0002_smoke`. Relaunch again; no re-application. (AS-4.)

- [X] T035 [US2] Create the bootstrap migration creating `schema_migrations(name TEXT PK, applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), checksum TEXT)` at `migrations/0001_init.sql`
- [X] T036 [P] [US2] Write failing migration-runner unit tests covering: applies pending in order, records rows, idempotent on re-run, rolls back on mid-migration failure, halts launch on rollback at `src/main/db/__tests__/migrate.test.ts`
- [X] T037 [P] [US2] Write failing DB client unit test asserting connection opens at the injected path and `WAL` mode is enabled at `src/main/db/__tests__/client.test.ts`. **Note (R2):** the test asserts an *injected* `dbPath`, not `app.getPath('userData')` directly — the Electron `app` lookup is moved to the wire-in seam in T040 so the client is testable without an Electron runtime.
- [X] T038 [US2] Implement DB client wrapping `better-sqlite3` with `journal_mode = WAL` and `foreign_keys = ON` at `src/main/db/client.ts`. **R1 mitigation:** the client takes a `DatabaseFactory` so unit tests can substitute the native binding (which is rebuilt for Electron's Node ABI by `postinstall` and won't load cleanly under Vitest).
- [X] T039 [US2] Implement migration runner: read `migrations/*.sql` (sorted), check `schema_migrations` (creating it via raw SQL if absent), apply each pending file inside a transaction, record `(name, applied_at, checksum)` on success, throw with halt-launch semantics on failure at `src/main/db/migrate.ts`. **R4:** `checksum` is `sha256(file content)`.
- [X] T040 [US2] Wire migration runner into `app.whenReady()` (runs before any window is created, fatal on failure) at `src/main/index.ts`. **R3:** failure path calls `app.exit(1)`.
- [X] T041 [US2] Unit tests green (32/32, 100% coverage of `src/main/db/`). Manual Electron smoke recipe documented in the Phase 4 PR description for reviewer verification.

---

## Phase 5 — US3: Secret storage abstraction (P1)

**Goal:** A `SecretStore` abstraction (matching `contracts/secret-store.ts`) round-trips
`get`/`set`/`delete` against an Electron `safeStorage`-backed implementation in production and an
in-memory backend in dev/test. Production builds refuse to start when `safeStorage` is unavailable.

**Independent test:** A unit test stores `"placeholder"` under `"test.placeholder"`, reads it back,
deletes it, reads again (expecting `null`). On Windows, the persisted SQLite blob is opaque (not
plaintext). (AS-5.)

- [ ] T042 [US3] Add migration `migrations/0002_secrets.sql` creating `secrets(key TEXT PRIMARY KEY, value BLOB NOT NULL)` at `migrations/0002_secrets.sql`
- [ ] T043 [P] [US3] Write failing `SecretStore` round-trip tests (in-memory backend) covering set→get, overwrite, delete, missing-key returns null, key-validation errors at `src/main/secrets/__tests__/safe-storage.test.ts`
- [ ] T044 [P] [US3] Write failing test asserting production builds refuse to start when `safeStorage.isEncryptionAvailable()` returns false (mock `app.isPackaged: true`) at `src/main/secrets/__tests__/backend-selection.test.ts`
- [ ] T045 [US3] Define `SecretKey` brand type and `SecretStore` interface at `src/shared/secret-store.ts` (mirrors `contracts/secret-store.ts`; one-shot transfer)
- [ ] T046 [US3] Implement production `safeStorage`-backed `SecretStore`: `set` calls `safeStorage.encryptString` and writes `BLOB` row; `get` reads + `decryptString`; `delete` removes row at `src/main/secrets/safe-storage.ts`
- [ ] T047 [US3] Implement in-memory dev/test backend (Map<string, string>) selected when `safeStorage.isEncryptionAvailable()` is false AND `app.isPackaged === false` at `src/main/secrets/in-memory.ts`
- [ ] T048 [US3] Implement `createSecretStore()` factory that picks backend based on availability and `app.isPackaged`; production refusal raises a fatal error logged via the main logger at `src/main/secrets/index.ts`
- [ ] T049 [US3] Run all secret-store tests; confirm they pass.

---

## Phase 6 — US4: OpenAPI types codegen and drift verification (P1)

**Goal:** Running `npm run codegen:api` writes deterministic TypeScript types into
`src/shared/api-types.ts` derived from a pinned OpenAPI snapshot. `npm run codegen:verify` regenerates
to a temp file and fails if the committed file drifts.

**Independent test:** Delete `src/shared/api-types.ts`, run `npm run codegen:api`, verify the file is
recreated identically (byte-equal to git's HEAD copy). Modify the file by hand, run `npm run
codegen:verify`, verify non-zero exit. (AS-6.)

- [ ] T050 [P] [US4] Commit a minimal pinned OpenAPI snapshot (one stub path, fillable later) at `scripts/openapi-snapshot.json`
- [ ] T051 [P] [US4] Write failing test asserting `codegen:api` produces deterministic output (run twice, byte-compare) at `scripts/__tests__/codegen.test.ts`
- [ ] T052 [US4] Implement codegen runner using `openapi-typescript` programmatically: read `scripts/openapi-snapshot.json` (or live URL when `--source=live` flag is passed), write to `src/shared/api-types.ts` at `scripts/codegen-api.ts`
- [ ] T053 [US4] Implement verify script: regenerate to temp, `diff` against committed file, exit non-zero on drift with a message instructing the user to run `npm run codegen:api` and commit at `scripts/verify-codegen.ts`
- [ ] T054 [US4] Wire `codegen:api` and `codegen:verify` scripts in `package.json` (using `tsx scripts/...`) at `package.json`
- [ ] T055 [US4] Run `npm run codegen:api`; commit the generated `src/shared/api-types.ts`

---

## Phase 7 — US5: Money module with strong tests (P1)

**Goal:** A `Money` module providing `of`, `zero`, `add`, `subtract`, `multiply`, `allocate`,
`equals`, `compare`, `format` operations on integer minor units, with ≥ 95% line and branch coverage.

**Independent test:** `npm test -- src/shared/money` passes; coverage reporter shows ≥ 95% on
`src/shared/money.ts`. Sample assertions: `multiply(of(99999900, 'EGP'), 1000)` is rejected as out
of safe range (illustrative); `allocate(of(100, 'EGP'), 3)` returns `[34, 33, 33]`. (AS-9.)

- [ ] T056 [P] [US5] Write failing exhaustive Money test suite covering: construction validation
  (non-integer rejected, non-safe-integer rejected, unsupported currency rejected); add and subtract
  including zero, negatives, currency mismatch; multiply by zero, one, negative quantity, non-integer
  quantity; allocate for `n=1`, `n=2`, `n=3`, `n=10` over various amounts including `0`; equals and
  compare cross-currency throws; format output for sample values at `src/shared/__tests__/money.test.ts`
- [ ] T057 [US5] Implement `Money` value type and `MoneyModule` per `contracts/money.ts` at `src/shared/money.ts`
- [ ] T058 [US5] Verify tests pass and coverage gate is green: `npm test -- --coverage src/shared/money`. If any branch is uncovered, add a targeted test rather than reducing the gate.

---

## Phase 8 — US6: Local structured logging (P2)

**Goal:** `pino` + `pino-roll` write rotated JSON log files to `app.getPath('logs')`, one per process
(main, renderer), one file per day, kept 14 days. Every record carries `process`, `app_version`,
`time`, `level`, `msg`.

**Independent test:** Run `npm run dev`; observe log files appear at the expected path; `cat` (or
PowerShell `Get-Content`) shows valid JSON-per-line records with the required fields. (AS-7.)

- [ ] T059 [P] [US6] Write failing logger unit test asserting required fields are present in every record and `time` is ISO-8601 at `src/main/logging/__tests__/logger.test.ts`
- [ ] T060 [US6] Implement main-process logger using `pino` + `pino-roll` writing to
  `path.join(app.getPath('logs'), 'main-YYYYMMDD.log')`, with base properties `{ process: 'main',
  app_version }` at `src/main/logging/logger.ts`
- [ ] T061 [US6] Implement renderer-process logger that forwards records over IPC to a `log` handler
  in main, where they're persisted to `renderer-YYYYMMDD.log` at `src/renderer/logging/logger.ts`
  and `src/main/ipc/log.ts`
- [ ] T062 [US6] Initialize main logger as the very first thing in `src/main/index.ts` (before
  migrations, before window creation)
- [ ] T063 [US6] Run `npm run dev`; verify log files appear and contents match the schema in
  `data-model.md` § LogRecord.

---

## Phase 9 — US7: Crash reporting wired and inert without DSN (P2)

**Goal:** `@sentry/electron` is initialized in main and renderer. With `SENTRY_DSN` unset, no network
calls and no crashes occur. With an invalid `SENTRY_DSN`, Sentry's own init error is caught and
logged once; the app launches and runs normally.

**Independent test:** (a) Launch with no env: app opens, no Sentry traffic in devtools network tab.
(b) Launch with `SENTRY_DSN=invalid`: app opens, one warning in main log, no recurring errors. (AS-8.)

- [ ] T064 [P] [US7] Write failing test asserting `initSentryMain()` is a no-op (no `Sentry.init`
  call) when `SENTRY_DSN` is unset at `src/main/observability/__tests__/sentry-main.test.ts`
- [ ] T065 [P] [US7] Write failing test asserting `initSentryMain()` does NOT throw when
  `SENTRY_DSN` is set to a syntactically invalid value at `src/main/observability/__tests__/sentry-main.test.ts`
- [ ] T066 [US7] Implement `initSentryMain()` that reads `process.env.SENTRY_DSN`, returns early
  when missing, wraps `Sentry.init` in try/catch otherwise at `src/main/observability/sentry-main.ts`
- [ ] T067 [US7] Implement `initSentryRenderer()` mirroring the main behavior (DSN passed via
  preload bridge or `import.meta.env.VITE_SENTRY_DSN`) at `src/renderer/observability/sentry-renderer.ts`
- [ ] T068 [US7] Call `initSentryMain()` after the main logger is up but before any other init in
  `src/main/index.ts`; call `initSentryRenderer()` at the top of `src/renderer/main.tsx`
- [ ] T069 [US7] Smoke-test both DSN scenarios (unset and invalid); verify no crashes.

---

## Phase 10 — US8: CI pipeline + package dry-run artifact (P2)

**Goal:** A GitHub Actions workflow on `windows-latest` runs the four required gates on every PR
(typecheck, lint, tests, package dry-run) plus the codegen drift gate, and uploads the unsigned
`--dir` build as an artifact.

**Independent test:** Open a PR; CI runs and reports green; the workflow run page lists an artifact
`pos-pulse-win-unpacked-<sha>.zip`. (AS-10, AS-11.)

- [ ] T070 [US8] Create CI workflow at `.github/workflows/ci.yml` with one job on `windows-latest`,
  steps in order: checkout, setup-node 20 with npm cache, `npm ci`, `npx @electron/rebuild`,
  `npm run codegen:verify`, `npm run typecheck`, `npm run lint`, `npm test -- --coverage`,
  `npm run package:dir`, `actions/upload-artifact` for `dist-electron/win-unpacked`
- [ ] T071 [P] [US8] Add a CODEOWNERS file requiring maintainer review at `.github/CODEOWNERS`
- [ ] T072 [P] [US8] Add a PR template referencing the constitution-check line and linking to the
  active spec at `.github/pull_request_template.md`
- [ ] T073 [US8] Validate CI by pushing a draft PR and observing all gates green and artifact
  uploaded.

---

## Phase 11 — US9: Hardware matrix documentation (P3)

**Goal:** `docs/hardware-matrix.md` reproduces constitution v1.2.0 MVP hardware scope with concrete
tested-models columns left blank for now.

**Independent test:** A reader opening `docs/hardware-matrix.md` sees the in-scope and out-of-scope
tables consistent with constitution v1.2.0 § Hardware. (AS-12.)

- [ ] T074 [US9] Create `docs/hardware-matrix.md` with In-Scope and Out-of-Scope tables, headings
  for tested-model rows under each in-scope category (rows empty until 002+), and a footer pointing
  back to the constitution at `docs/hardware-matrix.md`

---

## Phase Final — Polish & Cross-Cutting

- [ ] T075 Confirm `npm run codegen:verify` is green after generated file is committed (T055)
- [ ] T076 [P] Confirm `npm run lint` is clean across the whole repo
- [ ] T077 [P] Confirm `npm run typecheck` is clean for both tsconfigs
- [ ] T078 [P] Confirm `npm test -- --coverage` is green and Money coverage threshold (≥ 95%) is met
- [ ] T079 [P] Confirm `npm run package:dir` produces a runnable `dist-electron/win-unpacked/` whose
  entrypoint launches the empty window on a fresh Windows machine
- [ ] T080 Update `specs/001-foundation/quickstart.md` with any deviations discovered during
  implementation
- [ ] T081 Walk through `specs/001-foundation/spec.md` § Acceptance Scenarios one-by-one and tick
  each off in the PR description
- [ ] T082 Update `CLAUDE.md` SPECKIT block to mark 001-foundation status `complete` and to point at
  `specs/002-terminal-pairing` once that feature exists at `CLAUDE.md`

---

## Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)        ← blocks every story below
    │
    ├──► US1 (Window + isolation + bridge)        ─┐
    ├──► US2 (DB + migrations)                     ├─ all P1, run in parallel
    ├──► US3 (Secret store) ──── depends on US2's `secrets` table migration
    ├──► US4 (OpenAPI codegen)                     │
    ├──► US5 (Money module)                       ─┘
    │
    ├──► US6 (Logging)                            ─┐
    ├──► US7 (Sentry)                              ├─ all P2, run after P1
    ├──► US8 (CI pipeline) ──── depends on every prior story being green
    │
    ▼
US9 (Hardware matrix doc) ─── independent; can run any time after Phase 2
    │
    ▼
Phase Final (Polish)
```

**Cross-story dependencies:**
- US3 (secrets) needs the `secrets` migration, which lives in US3's own phase but uses the runner
  delivered in US2. Run US2 first.
- US8 (CI) is the integrator — meaningful only when US1–US7 implementations exist locally; can be
  drafted in parallel but won't show green until the others land.

---

## Parallel Execution Examples

**Setup phase (Phase 1):** T002–T009 and T013–T014 are all independent file creations. A single
contributor can batch them; multiple contributors can split.

**US1 tests:** T028, T029, T030 are three different test files. Write all three first (they all
fail), then implement T031–T033 to make them pass.

**Money module (US5):** T056 is the test, T057 is the implementation. Standard TDD pair.

**Suggested parallel split for two contributors after Phase 2:**

| Contributor A                       | Contributor B                       |
|:------------------------------------|:------------------------------------|
| US1 (window + isolation + bridge)   | US5 (Money — pure business logic)   |
| US2 (DB + migrations)               | US4 (OpenAPI codegen)               |
| US3 (secrets, after US2 lands)      | US6 (logging)                       |
| US7 (Sentry)                        | US8 (CI workflow draft)             |
| US9 (hardware matrix doc, anytime)  | Polish                              |

---

## Implementation Strategy

1. **MVP for 001 = ALL P1 stories (US1–US5).** Without all five, feature 002 cannot start. Ship
   them as the first PR or a tightly batched series.
2. **P2 stories (US6, US7, US8) follow.** Logging and Sentry can land standalone; CI gates only
   become useful once the gates have something meaningful to assert.
3. **US9 (hardware matrix doc) is small enough to bundle with any other PR or commit alone.**
4. **Each story is its own PR if possible.** This gives reviewers a contained surface and keeps
   constitution-check entries in PR descriptions specific.
5. **Test-first per task:** the test task within each story is `[P]`-marked and listed first; it
   MUST be committed (and seen to fail) before its corresponding implementation task is started.
6. **Constitution-check line in every PR description:** the relevant principles for that PR's
   stories should be cited (e.g., a US3 PR cites Principles V, VI, VII, VIII; a US5 PR cites
   Principle II).

---

**Total tasks:** 83 (T001–T082, plus T027a Phase 2 smoke gate).
**Setup:** 14 tasks. **Foundational:** 14 tasks (incl. T027a smoke). **User stories:** 47 tasks
across 9 stories. **Polish:** 8 tasks.

T010 and T011 are each split into three sub-batches (a/b/c) inside their task description — counted
as one task each in the totals above; the sub-batches are command-level, not task-level units.
