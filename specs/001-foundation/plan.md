# Implementation Plan: Foundation

**Feature ID:** 001-foundation
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-05-01
**Last Updated:** 2026-05-01
**Constitution version pinned:** v1.2.1

---

## Technical Context

This plan commits to concrete library choices for every seam the spec opens. Where the constitution
v1.2.0 already pins a choice, the table simply restates it. Where the constitution leaves a decision
to the plan, the rationale + alternatives are recorded in [research.md](./research.md). No
**NEEDS CLARIFICATION** items remain at this layer.

All majors pinned below were verified against the npm registry on 2026-05-01. Where the latest
stable major was released within the last few months, the plan deliberately pins **one major
behind** to let the ecosystem catch up (electron, typescript, eslint). Bleeding-edge Electron and
TS make native-module rebuild and ESLint plugin support unreliable for an MVP.

| Area                       | Choice                                                                                            | Source / detail                              |
|:---------------------------|:---------------------------------------------------------------------------------------------------|:---------------------------------------------|
| Runtime                    | **Electron `^40.9`** (latest 41 deferred — ABI churn risk), Node 20.x LTS, Windows 10/11 x64       | Constitution Tech Stack + version verify     |
| Renderer framework         | React `^19.2` + Vite `^8.0` + **TypeScript `^5.9`** (latest 6.0 deferred — plugin lag)             | Constitution Tech Stack + version verify     |
| Styling                    | Tailwind `^4.2` + `@tailwindcss/postcss ^4.2` (set up; not yet used on UI)                         | Constitution Tech Stack                      |
| Local DB                   | `better-sqlite3 ^12.9` (sync, embedded)                                                            | research.md §1                               |
| Migration runner           | **Custom**, transactional, SQL files in `migrations/`, recorded in `schema_migrations` table       | research.md §1                               |
| Secret storage             | **Electron `safeStorage` API** (DPAPI on Windows; no native module)                                | research.md §2                               |
| Money representation       | Plain integer `number` of minor units, guarded by `Number.isSafeInteger`                           | research.md §3 + Constitution v1.2.1 II      |
| Test framework             | **Vitest `^4.1`** (`@vitest/coverage-v8` matched to vitest); happy-dom env                         | research.md §4                               |
| OpenAPI codegen            | `openapi-typescript ^7.13`; output to `src/shared/api-types.ts`; bootstrap from pinned snapshot   | research.md §5 + Constitution v1.2.1         |
| Logging                    | `pino ^10.3` + `pino-roll ^4.0` writing JSON to `app.getPath('logs')`                              | Constitution VII                             |
| Crash reporting            | `@sentry/electron ^7.13` for both processes; inert when `SENTRY_DSN` unset                         | Constitution VII                             |
| Linter / formatter         | **ESLint `^9.39`** (latest 10 deferred — too new) + `typescript-eslint ^8` + Prettier              | research.md §6                               |
| Package / installer        | `electron-builder ^26.8`; `--win --dir` for unsigned dry-run; signing deferred                     | Constitution Tech Stack                      |
| Native-module rebuild      | `@electron/rebuild ^4.0` invoked from `postinstall` and CI                                         | Plan Risk R1                                 |
| Vite plugin (React)        | `@vitejs/plugin-react ^6.0`                                                                        | research.md §4                               |
| CI                         | GitHub Actions on `windows-latest`                                                                 | research.md §7                               |
| State / data fetching libs | NOT in scope for 001 (Zustand / TanStack Query land with 002+)                                     | Spec Out-of-Scope                            |
| Routing                    | NOT in scope for 001                                                                               | Spec Out-of-Scope                            |

## Constitution Check (Initial)

| Principle / Constraint              | Status     | Notes                                                                                                |
|:------------------------------------|:----------:|:------------------------------------------------------------------------------------------------------|
| I. Offline-First                    | N/A        | No business logic; principle is preserved as architecture but not exercised in this feature.         |
| II. Financial Precision             | **PASS**   | Money module is integer-only; ≥95% coverage gate enforced in CI.                                     |
| III. Process-Boundary Discipline    | **PASS**   | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, typed preload bridge mandatory. |
| IV. Hardware Loud, Not Silent       | N/A        | No hardware in this feature.                                                                          |
| V. Type Safety End-to-End           | **PASS**   | Strict TS both tsconfigs; OpenAPI codegen to `src/shared/api-types.ts`; bridge interface shared.     |
| VI. Test-First, Coverage-Gated      | **PASS**   | Vitest with coverage; Money ≥95%; CI blocks merge on test failure.                                   |
| VII. Observability                  | **PASS**   | pino+rotation locally; Sentry wired both processes, inert without DSN.                               |
| VIII. Terminal Identity ≠ User      | N/A        | Pairing lands in 002; secret-store abstraction prepares for it without storing real credentials.     |
| IX. Reference, Not Inheritance      | **PASS**   | All code re-derived; `_reference/` not imported. Plan calls out parity points without copy-paste.    |
| Platform Integration                | **PASS**   | Codegen pinned to `https://api.smartdatapulse.tech/openapi.json` (bootstrap = local snapshot).       |
| Security                            | **PASS**   | CSP, no card data, no plaintext tokens, signed-update path deferred (signing not in scope).          |
| Hardware Matrix                     | **PASS**   | `docs/hardware-matrix.md` reproduces constitution v1.2.0 MVP scope.                                  |
| Domain — Pharmacy POS               | N/A        | No domain logic exercised in this feature.                                                            |

**Initial gate result: PASS.** No violations, no waivers required.

## Phase 0 — Research

See [./research.md](./research.md). Seven decisions are recorded with chosen approach, alternatives,
and rationale (migration runner, secret store, money representation, test framework, codegen
strategy, lint/format toolchain, CI runner).

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md). Entities: `SchemaMigration`, `SecretEntry`
  (abstraction only — no real values), `LogRecord` shape.
- **Contracts:** [./contracts/](./contracts/). Three internal contracts are defined as TypeScript
  interfaces (this is a desktop app, not an HTTP service):
  1. **`PreloadBridgeAPI`** — the typed `window.api` surface (one stub method for the pattern).
  2. **`SecretStore`** — `get` / `set` / `delete` for opaque string values.
  3. **`MigrationRecord`** — the SQL/TS shape recorded in `schema_migrations`.

  **Source-of-truth policy.** The files in `specs/001-foundation/contracts/` are the
  *planning-time* snapshot of these interfaces. Once the Phase 2 transfer task (T022) lands the
  contracts under `src/shared/`, **`src/shared/` becomes canonical** and the spec copies are NOT
  re-synced. A contract change ships as a normal source PR; the spec's contracts/ directory is
  kept as the historical artifact for future readers and is referenced by the tasks file.
  Drift between the two is expected after Phase 2 and is not a defect — it's the trace of
  evolution. Any reader needing the current shape MUST look at `src/shared/`.
- **Quickstart:** [./quickstart.md](./quickstart.md). Developer-onboarding walkthrough: clone →
  install → run dev → run tests → run package dry-run.

## Project Layout

```
POS-Pulse/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry; BrowserWindow with secure defaults
│   │   ├── db/
│   │   │   ├── client.ts           # better-sqlite3 connection
│   │   │   └── migrate.ts          # Migration runner
│   │   ├── secrets/
│   │   │   └── safe-storage.ts     # Electron safeStorage wrapper
│   │   ├── logging/
│   │   │   └── logger.ts           # pino + pino-roll setup
│   │   ├── observability/
│   │   │   └── sentry-main.ts      # @sentry/electron/main init
│   │   └── ipc/
│   │       └── ping.ts             # Stub IPC handler
│   │
│   ├── preload/                    # Typed preload bridge
│   │   └── index.ts                # contextBridge.exposeInMainWorld('api', ...)
│   │
│   ├── renderer/                   # React + Vite renderer
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx                 # Empty/blank page
│   │   ├── observability/
│   │   │   └── sentry-renderer.ts  # @sentry/electron/renderer init
│   │   └── styles/
│   │       └── tailwind.css        # Tailwind 4 entry
│   │
│   ├── shared/                     # Code shared by main + preload + renderer
│   │   ├── api-types.ts            # GENERATED from OpenAPI (committed)
│   │   ├── bridge-api.ts           # PreloadBridgeAPI interface (contract)
│   │   ├── money.ts                # Money module
│   │   └── types.ts
│   │
│   └── tests/
│       ├── money.test.ts           # ≥95% coverage gate
│       ├── migrate.test.ts
│       ├── safe-storage.test.ts
│       └── renderer-isolation.test.ts  # asserts window.require is undefined
│
├── migrations/
│   └── 0001_init.sql               # Bootstrap migration (creates schema_migrations table)
│
├── docs/
│   └── hardware-matrix.md          # MVP hardware scope
│
├── scripts/
│   ├── codegen-api.ts              # Calls openapi-typescript on the pinned/live source
│   └── verify-codegen.ts           # CI helper: regen → diff → fail if drift
│
├── .github/workflows/
│   └── ci.yml
│
├── electron-builder.yml
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json                   # base / paths
├── tsconfig.main.json              # extends; node target
├── tsconfig.renderer.json          # extends; dom target
├── tailwind.config.ts
├── postcss.config.cjs
├── eslint.config.js
├── .prettierrc
├── package.json
└── .env.example                    # Documents SENTRY_DSN, VITE_API_BASE_URL, etc.
```

## Test Strategy

| Surface                  | Framework | What it covers                                                                              | Coverage gate    |
|:-------------------------|:----------|:--------------------------------------------------------------------------------------------|:-----------------|
| `src/shared/money.ts`    | Vitest    | All ops; zero / negative / large / rounding edges; quantity multiplication; allocation      | **≥ 95% line + branch** |
| `src/main/db/migrate.ts` | Vitest    | Apply pending migrations; record applications; idempotency on re-run; rollback on failure   | ≥ 80%            |
| `src/main/secrets/*`     | Vitest    | round-trip set→get→delete using a test backend; production gate refuses non-DPAPI on Win    | ≥ 80%            |
| Renderer isolation       | Vitest    | renderer-side test asserts `window.require`/`process` are unreachable                        | smoke            |
| Bridge-typing            | tsc       | typecheck refuses bridge call with mismatched interface                                     | typecheck gate   |
| Package dry-run          | electron-builder | `--win --dir` runs cleanly                                                            | CI gate          |

CI runs all of the above on every PR.

## CI / Build / Package

**Workflow file:** `.github/workflows/ci.yml`. Single job on `windows-latest`. Required gates (each
fails the workflow on non-zero exit):

```yaml
# Conceptual outline only — full file lives in tasks.
steps:
  - actions/checkout
  - actions/setup-node           # node 20.x, npm cache
  - npm ci
  - npm run codegen:verify       # regen api-types and diff against committed
  - npm run typecheck            # tsc --noEmit on main + renderer tsconfigs
  - npm run lint                 # eslint + prettier --check
  - npm test -- --coverage       # vitest run; emits lcov + summary
  - npm run package:dir          # electron-builder --win --dir
  - actions/upload-artifact      # the unsigned --dir output
```

Coverage from Vitest is reported back in the PR via the GitHub Actions step output. The Money module
gate is enforced by Vitest's per-file `coverage.thresholds.perFile` setting, not by a separate tool.

## Phase 2 — Implementation Outline

The work decomposes into ten ordered groups. `/speckit-tasks` will expand each into concrete tasks.

1. **Repo skeleton.** `package.json`, tsconfig trio, eslint + prettier, gitignore tightening,
   `.env.example`. No app code yet; `npm install` succeeds.
2. **Renderer scaffolding.** Vite + React + Tailwind blank page. `npm run dev:vite` opens a port.
3. **Electron main + preload bridge.** Secure defaults baked in; `contextBridge` exposes a single
   `ping()` stub. `npm run dev` opens the empty Electron window.
4. **Renderer isolation test.** Vitest test against `happy-dom` confirms Node globals unreachable.
5. **Local DB + migration runner.** `better-sqlite3` connection + `migrate.ts` + `0001_init.sql`
   that creates `schema_migrations`. Tests for apply / idempotency / rollback.
6. **Secret storage abstraction.** `safe-storage.ts` wrapping Electron `safeStorage` (production)
   with an in-memory dev backend that production refuses. Round-trip tests.
7. **Logging.** `pino` + `pino-roll` writing to `app.getPath('logs')`; main process initialized at
   startup.
8. **Sentry wiring.** `@sentry/electron` main + renderer; both detect missing/invalid DSN and stay
   inert; smoke test forces a thrown error and asserts no crash without DSN.
9. **OpenAPI codegen.** Pinned bootstrap snapshot at `scripts/openapi-snapshot.json`; codegen script
   writes `src/shared/api-types.ts`; verify-codegen script drives the CI drift gate.
10. **Money module.** Implementation + exhaustive Vitest suite hitting the ≥95% gate.
11. **Hardware matrix doc.** `docs/hardware-matrix.md` populated from constitution v1.2.0.
12. **CI workflow.** `.github/workflows/ci.yml` exercising every gate. Package dry-run uploads
    artifact for manual smoke.

## Constitution Check (Post-Design)

Re-evaluated after the project layout, contracts, and CI design above were settled.

| Principle / Constraint              | Status   | Notes (what changed in design)                                                                  |
|:------------------------------------|:--------:|:-------------------------------------------------------------------------------------------------|
| I. Offline-First                    | N/A      | unchanged.                                                                                       |
| II. Financial Precision             | **PASS** | Money lives in `src/shared/money.ts`; Vitest per-file coverage threshold enforces 95%.           |
| III. Process-Boundary Discipline    | **PASS** | Bridge contract is in `src/shared/bridge-api.ts`; preload imports it; renderer-isolation test gates. |
| IV. Hardware Loud, Not Silent       | N/A      | unchanged.                                                                                       |
| V. Type Safety End-to-End           | **PASS** | Codegen verified in CI via diff-on-regen; bridge typed both sides.                               |
| VI. Test-First, Coverage-Gated      | **PASS** | Tasks generation will assert tests precede implementation per task.                              |
| VII. Observability                  | **PASS** | pino path = `app.getPath('logs')`; Sentry init is the first thing each process does.             |
| VIII. Terminal Identity ≠ User      | N/A      | unchanged. SecretStore is abstract; no real credentials.                                         |
| IX. Reference, Not Inheritance      | **PASS** | Plan deliberately diverges from legacy on test framework (Vitest-only vs. Vitest+Jest split) and secret store (Electron safeStorage vs. electron-store). |
| Platform Integration                | **PASS** | `VITE_API_BASE_URL`, `ELECTRON_UPDATE_FEED_URL`, `SENTRY_DSN` enumerated in `.env.example`.      |
| Security                            | **PASS** | CSP added in main; `safeStorage` is DPAPI-backed on Win; no card surfaces.                       |
| Hardware Matrix                     | **PASS** | `docs/hardware-matrix.md` is its own task.                                                        |
| Domain — Pharmacy POS               | N/A      | unchanged.                                                                                       |

**Post-design gate result: PASS.**

## Risks & Open Items

- **R1 — better-sqlite3 native-module rebuild on CI.** Risk: prebuilt binaries may not match the
  Electron ABI on `windows-latest`; the build needs `electron-rebuild` (or `@electron/rebuild`)
  before `package:dir`. *Mitigation:* CI workflow runs `electron-rebuild` after `npm ci`. Owned by
  task group 12.
- **R2 — OpenAPI source not yet live.** Risk: bootstrap codegen would fail if
  `api.smartdatapulse.tech/openapi.json` is unreachable. *Mitigation:* commit a pinned snapshot at
  `scripts/openapi-snapshot.json` and use it in 001; switch to live fetch in a later feature.
- **R3 — Tailwind 4 + Vite 8 ecosystem maturity.** Risk: Tailwind 4 changed config shape; some
  PostCSS plugins may lag. *Mitigation:* use the official `@tailwindcss/postcss` plugin path; if
  that proves unstable, fall back to Tailwind 3 (a follow-up amendment, not a blocker for the empty
  window).
- **R4 — `safeStorage` not available in some Electron headless test contexts.** *Mitigation:*
  abstraction has a clearly-marked dev/test backend that production refuses to use.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
