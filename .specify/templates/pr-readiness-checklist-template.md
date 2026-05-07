> **Optional reference template — not a mandatory gate.**
> Use only when it reduces risk or clarifies a non-trivial change.

# PR Readiness Checklist: [PR title]

## When to use

- Before merging any non-trivial feature slice, security change, or migration PR
- When a PR touches IPC, preload bridge, SQLite, safeStorage, or audit paths
- When a PR spans multiple tasks or files and scope creep is a risk

## When NOT to use

- Typo fixes, log-message tweaks, or single-line doc changes
- PRs that are obviously scoped to one file with no security or data surface

---

## Scope

| Field | Value |
|:--|:--|
| Task IDs in scope | T0XX, T0XX |
| Feature slice | S0 / S1 / S2 / … |
| Spec reference | `specs/004-operator-session/spec.md` |

**Explicit non-goals for this PR** (must not be started):
- [ ] `<next slice or deferred task>` — deferred to `<issue/task ID>`
- [ ] `<S4 / cashier / sales work>` — out of scope

---

## Files expected to change

List files that SHOULD be modified or created. Anything outside this list is a scope-creep signal.

```
src/main/<file>.ts
src/preload/<file>.ts
src/shared/bridge-api.ts         (if bridge shape changes)
tests/unit/<file>.test.ts
tests/integration/<file>.test.ts
migrations/<nnnn>_<name>.sql     (if a migration is included)
```

---

## Forbidden files / areas

The following MUST NOT appear in `git diff --name-only` for this PR:

- [ ] `package.json` / `package-lock.json` — unless a dep change is explicitly scoped
- [ ] `.github/workflows/` — no CI changes unless CI is the PR topic
- [ ] `specs/004-operator-session/tasks.md` / `coordination.md` — belong in a separate status PR
- [ ] `_reference/Data-Pulse/` — never modified (Constitution Principle IX)
- [ ] Any file outside `src/`, `tests/`, `migrations/`, `.specify/templates/` (for docs PRs)
- [ ] `CLAUDE.md` / `.specify/memory/constitution.md` — separate governance PR

---

## Validation commands

Run all of these locally before pushing:

```bash
npm run typecheck          # both tsconfigs — zero errors required
npm run lint               # eslint + prettier --check — zero errors required
npm test -- --coverage     # full vitest run — coverage gate must pass
npm run codegen:verify     # regen api-types → diff must be empty
```

If this PR includes a migration:

```bash
# Verify migration runner applies cleanly on a fresh DB
npm run dev -- --dev-fresh   # or equivalent local DB reset + migrate command
```

---

## Security boundary checks

- [ ] Renderer receives no Clerk JWT, device token, or `device_token_attestation` in any IPC response
- [ ] Renderer cannot supply `tenantId`, `operatorId`, `deviceId`, or any trusted identity field
- [ ] Preload bridge exposes only the methods added/changed in this PR — no accidental exposure
- [ ] IPC handlers validate input shape and return generic errors on failure
- [ ] No secret field (`token`, `secret`, `password`, `pin`) appears in pino log output for new paths
- [ ] No secret field appears in Sentry breadcrumbs for new paths
- [ ] `safeStorage` read/write confined to `src/main/` — not accessed in preload or renderer
- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` unchanged on all `BrowserWindow` instances

---

## Scope creep and staging hygiene

- [ ] `git diff --name-only` matches the expected file list above — no extras
- [ ] `git status --short` shows no untracked files that should not be in this PR
- [ ] Staged using named files only — **`git add -A` was NOT used**
- [ ] `specs/004-operator-session/a1-amendment/` untracked directory is NOT staged (it belongs to a separate amendment PR)
- [ ] S4 / cashier / sales work has NOT been started in this branch
- [ ] No next-slice task has been started (check task IDs in `tasks.md`)

---

## Merge readiness

- [ ] CI is green (typecheck + lint + tests + codegen:verify + package dry-run)
- [ ] PR description includes task IDs and explicit non-goals
- [ ] PR description includes a test-plan checklist
- [ ] All review comments resolved
- [ ] Branch is up to date with `main` (or rebased)
