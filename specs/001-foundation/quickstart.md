# Quickstart: Foundation

**Audience:** a contributor cloning POS-Pulse for the first time and wanting to confirm the
substrate works.
**Target time:** under 5 minutes (NFR-1) on a Windows 10/11 x64 workstation.

This file ships with the feature so the acceptance walkthrough is reproducible.

---

## Prerequisites

| Tool                  | Version            | Why                                              |
|:----------------------|:-------------------|:--------------------------------------------------|
| Windows 10 or 11 x64  | —                  | Production target; `better-sqlite3` + DPAPI.     |
| Node.js               | 20.x LTS           | Electron 33 ABI; OpenAPI codegen.                |
| npm                   | 10.x (bundled)     | Lock-file fidelity.                              |
| Git                   | any recent         | clone.                                            |
| (Optional) VS Code    | latest             | TypeScript + ESLint integration out of the box. |

You do **not** need: Python, Visual Studio Build Tools (`better-sqlite3` ships prebuilt for the
Electron ABI we use; `electron-rebuild` handles any mismatch automatically).

## Steps

```powershell
# 1. Clone
git clone https://github.com/<owner>/POS-Pulse.git
cd POS-Pulse

# 2. Install
npm install

# 3. Generate API types from the pinned OpenAPI snapshot
#    (this writes src/shared/api-types.ts)
npm run codegen:api

# 4. Run the app in development
npm run dev
```

At step 4 a single empty Electron window opens. Devtools should be accessible (`Ctrl+Shift+I`); the
renderer's console MUST show no errors and `window.api` MUST be defined while `window.require`,
`window.process`, and `window.Buffer` MUST all be `undefined`.

## Verifying the substrate

```powershell
# Typecheck (both tsconfigs)
npm run typecheck

# Lint + format check
npm run lint

# Full test suite with coverage
npm test -- --coverage

# Verify the committed api-types match what regeneration produces
npm run codegen:verify

# Package dry-run — produces an unsigned, unpacked Windows build at dist-electron/
npm run package:dir
```

Expected outcomes:

- `npm test`: all suites pass; the per-file coverage threshold for `src/shared/money.ts` is
  satisfied (≥ 95% line + branch).
- `npm run codegen:verify`: exit code 0 (committed file matches regen).
- `npm run package:dir`: exit code 0; `dist-electron/win-unpacked/` (or similarly named) exists and
  contains an executable that launches the same empty window.

## Adding a migration (smoke test for the runner)

```powershell
# 1. Create a new migration file
"CREATE TABLE smoke_test (id INTEGER PRIMARY KEY);" | Out-File migrations/0002_smoke.sql -Encoding utf8

# 2. Re-launch the app
npm run dev
```

On launch, the runner picks up `0002_smoke.sql`, applies it inside a transaction, and inserts a row
into `schema_migrations`. Closing and re-opening the app does NOT re-apply.

Roll back the smoke test:

```powershell
Remove-Item migrations/0002_smoke.sql
# Manually drop schema_migrations row + table from the dev SQLite file, or delete the file entirely.
```

## Sentry inert-on-missing-DSN check

```powershell
# With no SENTRY_DSN set (default in dev):
npm run dev    # window opens; no Sentry network calls; no crash.

# With an invalid DSN:
$env:SENTRY_DSN="invalid"; npm run dev    # window still opens; one warning logged; no crash loop.
```

## CI gate

The same commands run in `.github/workflows/ci.yml` on every pull request:

| Step                  | Gate                                 |
|:----------------------|:--------------------------------------|
| `npm run codegen:verify` | committed api-types match regen     |
| `npm run typecheck`   | tsc --noEmit on main + renderer       |
| `npm run lint`        | eslint + prettier --check             |
| `npm test -- --coverage` | all tests pass; Money ≥ 95%        |
| `npm run package:dir` | electron-builder --win --dir succeeds |

A failure in any step fails the CI run and blocks merge.
