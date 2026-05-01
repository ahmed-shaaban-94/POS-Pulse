# Research: Foundation

**Feature:** 001-foundation
**Plan:** [./plan.md](./plan.md)
**Created:** 2026-05-01

This document records the seven non-trivial technical decisions made during planning. Each entry
follows: **Decision → Rationale → Alternatives considered → Implications**.

---

## §1. Migration runner

**Decision:** Custom, transactional, SQL-file-based runner.

- Migrations live as ordered SQL files under `migrations/` (e.g., `0001_init.sql`,
  `0002_add_x.sql`).
- The runner sorts files lexically, opens a transaction per migration, applies the file, and
  records `(name, applied_at)` in a `schema_migrations` table.
- A migration that errors mid-apply rolls back its transaction; the runner halts the app launch
  with a clear error. The migration is NOT marked applied.
- Re-launches are idempotent: only files not present in `schema_migrations` are applied.

**Rationale:** `better-sqlite3` is synchronous and we want migrations to run synchronously at app
startup before any window appears. A bespoke runner is ~50 lines and has zero dependency surface.
The migration policy in the constitution (idempotent, halt on failure, audited) is trivially
satisfied with this shape.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| `umzug` | Async-first, ORM-flavored, more deps than the workload deserves. |
| `node-pg-migrate` style | Postgres-oriented; doesn't fit better-sqlite3 idioms. |
| `drizzle-kit migrate` | Heavier — pulls in the Drizzle ORM runtime and a code-generation step we don't need. |
| Knex migrations | Async; pulls in Knex for one feature. |
| Embedded `better-sqlite3` migration helpers | None exist out of the box. |

**Implications:** team owns the runner. It is small, easy to test, and easy to evolve. If we later
adopt Drizzle for schema-as-code, the runner remains the executor; the file format may change.

---

## §2. Secret storage backend

**Decision:** Electron's built-in `safeStorage` API.

- On Windows, `safeStorage` uses **DPAPI** — exactly what the constitution calls for.
- The abstraction (`SecretStore`) wraps `safeStorage.encryptString` / `decryptString`; ciphertext is
  persisted in a SQLite table (`secrets(key TEXT PRIMARY KEY, value BLOB)`).
- `safeStorage.isEncryptionAvailable()` is checked at startup; production builds refuse to start
  if it returns `false`. Dev/test builds fall back to a clearly-marked in-memory backend.

**Rationale:** zero native modules to compile; zero new dependencies; first-party Electron support;
DPAPI on Windows by default; integrates cleanly with `app.whenReady()`. Aligns with constitution
Principle VIII's "encrypted-at-rest with hardware-bound key" phrasing — DPAPI is precisely that.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| `keytar` | Native module, broader OS coverage we don't need; adds rebuild complexity in CI. |
| `electron-store` with custom encryption | We'd be reimplementing what `safeStorage` already provides. The legacy reference uses `electron-store` — explicitly a deliberate divergence per Principle IX. |
| Direct DPAPI binding via `node-windows-ffi` | Reinvents `safeStorage`; more native code; no benefit. |
| Plaintext (development only) | Unacceptable per Principle VIII even in dev. |

**Implications:** the abstraction surface is small enough to swap if a future Constitution amendment
adds non-Windows targets. The dev/test backend is a feature, not a workaround — it lets unit tests
run without an Electron app context.

---

## §3. Money representation

**Decision:** Plain JS `number` representing integer minor units, with `Number.isSafeInteger`
validation in the `Money` constructor.

- A `Money` value is an object literal `{ amount: number, currency: 'EGP' }` where `amount` is
  always an integer (piastres for EGP).
- Constructors and arithmetic ops throw on non-integer or non-safe-integer inputs.
- Operations: `add`, `subtract`, `multiply` (by integer quantity), `allocate` (split with rounding
  distribution).

**Rationale:** Egyptian Pound prices in pharmacy POS sit comfortably within the safe integer range
(`Number.MAX_SAFE_INTEGER ≈ 9.007 × 10^15`). The largest plausible single-line value (e.g., a 999.99
EGP item × 1000 quantity = 99,999,900 piastres) is 8 orders of magnitude below the safe limit.
`number` keeps JSON serialization trivial and avoids `BigInt`'s ergonomic costs (no `Math.*`,
explicit `1n` literals). The `isSafeInteger` guard is the safety net.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| `BigInt` | Overkill for the value range; complicates JSON (no native BigInt JSON), prevents `Math.floor` on intermediate computations, hurts ergonomics. |
| `decimal.js` / `dinero.js` | Adds a runtime dep for what arithmetic on integers gives us for free. |
| Float (banned by constitution) | Violates Principle II. Rejected at the constitution level. |
| String-based amounts (parsed lazily) | Defers the validation; same float problems return at compute time. |

**Implications:** The Money module is a few dozen lines and trivially achieves ≥95% coverage. JSON
on the wire is `{ amount: 12345, currency: "EGP" }` — directly machine-readable.

---

## §4. Test framework

**Decision:** Vitest for everything (renderer, business logic, and Electron main process via a
subprocess driver pattern).

- `vitest.config.ts` with `happy-dom` environment as the default.
- Main-process tests run as plain Node tests (Vitest detects test environment per file via
  `// @vitest-environment node` pragma where needed).
- Tests that exercise actual Electron APIs (e.g., `safeStorage` round-trip, packaged window opens)
  run via a small `playwright`-driven smoke runner in a separate CI step rather than inside Vitest.
  This is acceptance smoke, not the unit suite.

**Rationale:** the legacy reference uses Vitest + Jest. That split exists because the legacy
codebase grew organically; there's no inherent reason a fresh codebase needs both. Vitest covers
DOM-environment renderer tests, Node-environment main tests, and produces a single coverage report.
One test framework = one config to maintain, one mental model, one CI step.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| Vitest + Jest split (legacy) | Two configs, two coverage reports, two mental models. Principle IX argues against inheriting this split without a reason. |
| Jest only | Slower than Vitest; ESM story is still the weaker option. |
| Node `node:test` | Lacks the Vitest ergonomics (UI, watch mode, coverage out of box) the team will use day-to-day. |
| Mocha + Chai | More glue; smaller ecosystem support for Vite/Electron. |

**Implications:** if the Vitest-on-main-process pattern hits a wall in a later feature (e.g., a test
genuinely needs an Electron BrowserWindow), we add a Playwright-based "electron smoke" step rather
than reintroducing Jest. That's an architecture decision the team gets to make once.

---

## §5. OpenAPI codegen strategy

**Decision:** `openapi-typescript` v7 CLI; bootstrap from a pinned local snapshot at
`scripts/openapi-snapshot.json`; live fetch is a separate, opt-in script. Generated file lives at
`src/shared/api-types.ts` and is committed.

- `scripts/codegen-api.ts` accepts `--source=local|live`. CI runs `--source=local`.
- `scripts/verify-codegen.ts` runs codegen to a temp file and `diff`s it against the committed
  file; non-zero diff fails CI ("regenerate and commit").
- Switching to live fetch is a one-line change — but only after `api.smartdatapulse.tech` is
  confirmed reachable from CI and the snapshot policy has been re-evaluated for staleness.

**Rationale:** the constitution pins the API URL but the platform may not yet expose
`/openapi.json` at the time 001 lands. A pinned snapshot decouples 001 from platform readiness.
Once the API is live, live fetch is trivially enabled without re-architecting codegen. The
diff-against-committed pattern keeps the generated file as a reviewable artifact, not a build-time
black box.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| Always live fetch | Hard CI dependency on the API host. CI flakes when the API is restarted. |
| Regenerate-on-build, never commit | The generated file is a contract change; it should appear in PR diffs and be reviewable. |
| Use `orval` or `openapi-fetch` as the codegen | Heavier; we want types only at this stage, no runtime client. |
| Hand-write types | Drift inevitable. Bans Principle V's spirit. |

**Implications:** the snapshot must be refreshed deliberately. A future feature will add a
scheduled job (or `/schedule` agent) that regenerates from live and opens a PR if drift is detected.

---

## §6. Linter / formatter toolchain

**Decision:** ESLint flat config + Prettier.

- `eslint.config.js` (flat config, ESLint 9+) with `typescript-eslint` v8 strict, plus
  `eslint-plugin-react`, `eslint-plugin-react-hooks`, and the `eslint-plugin-electron` /
  community-recommended rules for renderer security.
- Prettier handles formatting; no formatting opinions in ESLint.
- Both run in CI: `eslint .` and `prettier --check .`.

**Rationale:** flat config is the supported direction; typescript-eslint v8 supports it natively.
Prettier on top is the lowest-friction formatting story.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| Biome | Faster, single binary; ecosystem support for Electron-specific rules is thinner. Reasonable to revisit later. |
| Rome (deprecated) | Project was succeeded by Biome. |
| dprint | Formatter only — would still need a linter. |
| ESLint legacy `.eslintrc.cjs` | Not the supported direction in 2026. |

**Implications:** if Biome catches up on the Electron-specific rule front, swapping is one PR. The
plan does not commit us to ESLint for the project's lifetime.

---

## §7. CI runner choice

**Decision:** GitHub Actions on `windows-latest`.

- Single job. Steps: checkout → setup-node 20 → `npm ci` → `electron-rebuild` →
  `npm run codegen:verify` → `npm run typecheck` → `npm run lint` → `npm test -- --coverage` →
  `npm run package:dir` → `actions/upload-artifact` (the unsigned `--dir` output).
- `electron-rebuild` is the canonical fix for `better-sqlite3`'s ABI mismatch against Electron's
  bundled Node.

**Rationale:** the constitution targets Windows-only for MVP. Cross-compiling Electron + native
modules from Linux is achievable but adds complexity (Wine, custom Electron-builder flags) for zero
benefit while we have one runner type to support. `windows-latest` exercises the actual production
target.

**Alternatives considered:**

| Alternative | Why not |
|:--|:--|
| `ubuntu-latest` with cross-compile | Cross-compile of native modules is a fragile path; we'd be testing a different binary than the one shipping. |
| Self-hosted Windows runner | Premature; managed runner is fine until volume justifies the operational cost. |
| Azure DevOps | The project is on GitHub; no reason to introduce a second CI system. |
| Local-only (no CI) | Violates the constitution's CI-gate requirement. |

**Implications:** Windows runners are slower and more expensive than Linux. If/when CI cost
becomes an issue, splitting fast (Linux: typecheck + lint + unit tests) and slow (Windows: package
dry-run only) is a one-PR optimization.

---

## Summary table

| § | Decision | Confidence | Revisit trigger |
|:-|:--|:-:|:--|
| 1 | Custom migration runner | High | If we adopt Drizzle ORM. |
| 2 | Electron `safeStorage` | High | If we add macOS/Linux production targets. |
| 3 | `number` minor units + safe-integer guard | High | If we ever need amounts > 9 × 10^15 minor units. |
| 4 | Vitest only | Medium | If a feature genuinely needs Jest-only ecosystem (jsdom-specific quirk, etc.). |
| 5 | Pinned snapshot codegen | High | When the live API is consistently reachable from CI. |
| 6 | ESLint + Prettier | Medium | When Biome's Electron rule story matures. |
| 7 | `windows-latest` runner | High | When CI cost becomes material; split jobs at that point. |
