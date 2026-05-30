# POS-Pulse — Agent Context

POS-Pulse is the desktop Point-of-Sale terminal for the SmartDataPulse pharmacy platform. It is
the POS surface of `smartdatapulse.tech`, packaged as an Electron application targeting Windows
10/11 x64.

## Authoritative documents (read these first)

| Document | Purpose |
|:--|:--|
| `.specify/memory/constitution.md` | Project constitution (v1.3.0). Highest-priority document; principles, hardware matrix, platform integration, governance. |
| `_reference/Data-Pulse/` | Read-only legacy reference. Gitignored. **Never copy-paste from here** (Constitution Principle IX). |

## Active feature

<!-- SPECKIT START -->
**Active feature:** [`specs/008-sale-finalization-and-receipts`](specs/008-sale-finalization-and-receipts/) — Sale finalization & receipts. **`/speckit-specify` ✅** (2026-05-26) · **`/speckit-clarify` ✅** (2026-05-27; OQ-1/2/3 + reprint-permission resolved) · **`/speckit-plan` v1.0 ✅** (2026-05-27; see [plan.md](specs/008-sale-finalization-and-receipts/plan.md)). Implementation **blocked** pending artifact review, owner approval, and gates §A1–§A5.

**§A5 status (2026-05-30):** **Done/closed (ticked in tasks.md):** **T520** coverage-floor ✅ · **T521** redaction ✅ (runtime done PR #309; support-bundle N/A-by-absence, owner-accepted 2026-05-30) · **T522** scrubber coverage ✅ (PR #299) · **T524/T525** runbook + rollback ✅ (PR #308) · **T527** safeStorage read-only ✅ · **T512** printer-banner manual-override `/impeccable` polish ✅ (run as polish not craft per §4.2 — green tests; spinner+aria-busy in-flight surface; §A1 red-bar = adopt-existing-pattern, owner accepts via merge). · **T526** §A4 security re-check ✅ (as-built verification, agent-performed — 7/8 PASS + 1 minor non-blocking drift; independent §A4 sign-off Ahmed 2026-05-26 stands underneath) · **T528** CI gates ✅ (typecheck/lint/test/codegen + `package:dir` via CI run 26683045246; note: CI skips package:dir on docs-only PRs). **Owner hardware-target decision (2026-05-30, Ahmed):** 008 §A5 is **printer-only / OS-print / BIXOLON SRP-330 II (Option A)**; cash-drawer/DK1 hardware validation **deferred** to a future peripheral spec (drawer code stays); ESC/POS **descoped**; scanner = wedge-input observed/tested only. **Owner bar-answer (2026-05-30, Ahmed): bench smoke is sufficient → T520a + T523 ✅ CLOSED** (owner-accepted, printer-only; honest record — no quantitative p95 captured and no automated CI hardware test, promotion rests on the owner-run bench smoke). **T529 — §A5 SIGNED OFF (caveated) 2026-05-30:** both gate conditions met — **(a)** the T529 PR #312 is merged, and **(b)** current-main CI is green incl. `package:dir` (run `26690694014` for `2ae4022`, `✓ Package (Windows --dir, unsigned)`). The sign-off RECORD (coordination.md §"T529 — §A5 production-readiness sign-off record") stands with every caveat enumerated at the point of signature (T520a no-p95, T523 not-CI-tested, T521 support-bundle-N/A, T526 agent-verified). **Gate (b) note:** the originally-pinned run `26684664263` (`282c436`) flaked on `forced-close-form.test.tsx` (5000ms timeout) so `package:dir` was skipped; PR #313 hardened the test (`userEvent.setup({ delay: null })`) and landed as `2ae4022`, whose run is the green-incl-`package:dir` referenced above. §A5 is therefore **CLOSED**. See [`a5-verification-findings.md`](specs/008-sale-finalization-and-receipts/a5-verification-findings.md) + coordination.md §§"Owner decision — 008 §A5 hardware target" / "Owner bar-answer" / "T526 — §A4 security-review handoff" / "T529 — §A5 production-readiness sign-off record".

**Recently closed:**
- `specs/007-pos-visual-system` — POS Visual System Recovery. Complete; all six slices (S0–S6) merged. Closeout: PR #118 (S6) + PR for T087 checkbox flip + this banner update.

**Previous features (complete)**:
- `specs/001-foundation` — Foundation (Electron + Vite + TS + tests + CI).
- `specs/002-terminal-pairing` — Terminal pairing (device token, branch scope).
- `specs/003-pos-ui-shell` — POS UI shell (design tokens, navigation, role-indicator slot).
- `specs/004-operator-session` — Operator session (complete, §A1 + §A2 gates cleared).
- `specs/005-sales-cart` — Sales cart (complete through S4-b handoff core).
- `specs/006-payments-tender` — Payments + tender (complete; §A5 production-readiness gate signed off in PR #234 on 2026-05-26).
- `specs/007-pos-visual-system` — POS Visual System Recovery (complete; six slices S0–S6 merged 2026-05-10; PRs #109, #113, #114, #115, #116, #117, #118).

**005/006 UI gate:** UNBLOCKED — S1 + S2 + S3 merged with reviewer-ticked T060 criteria. 005 and 006 both consumed the gate; 006 is now closed.
<!-- SPECKIT END -->

## Spec Kit workflow

```
/speckit-specify   →  spec.md                (✅ complete for 001)
/speckit-clarify   →  resolve [NEEDS CLARIFICATION]   (n/a — none open)
/speckit-plan      →  plan.md + research.md + data-model.md + contracts/ + quickstart.md   (✅ complete for 001)
/speckit-tasks     →  tasks.md               (next)
/speckit-analyze   →  cross-artifact validation
/speckit-implement →  execute tasks
```

Trivial fixes (typos, log-message tweaks, dependency bumps) MAY skip the pipeline.

## Key technical decisions (locked)

- Stack: Electron 40 + React 19 + Vite 8 + TypeScript 5.6 (strict) + Tailwind 4.
- Local DB: `better-sqlite3` with a custom transactional migration runner.
- Secrets: Electron `safeStorage` (DPAPI on Windows). Production refuses to start without it.
- Money: integer minor units, `Number.isSafeInteger` guarded; ≥ 95% coverage on the module.
- Tests: Vitest only.
- Codegen: `openapi-typescript` v7 from a pinned snapshot in 001; live fetch later.
- CI: GitHub Actions on `windows-latest`. Gates: typecheck, lint, tests, package dry-run.

See `specs/001-foundation/research.md` for the full rationale on each.

## Hard rules (always in force)

These come from the constitution and are repeated here for quick agent reference:

- **No floats for money.** Money is integer minor units only.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** on every BrowserWindow.
- **No upward-of-bridge IPC.** Renderer reaches the main process exclusively through the typed
  preload bridge defined in `src/shared/bridge-api.ts`.
- **No copy-paste from `_reference/Data-Pulse/`.** Re-derive instead.
- **Test-first.** Add the failing test before the implementation; tasks generated by
  `/speckit-tasks` make this explicit per-task.
- **PII / cards never in logs.**

## Useful commands

```bash
npm install                  # install deps
npm run dev                  # open empty Electron window
npm run codegen:api          # regenerate src/shared/api-types.ts
npm run codegen:verify       # CI helper: regen → diff
npm run typecheck            # both tsconfigs
npm run lint                 # eslint + prettier --check
npm test -- --coverage       # full vitest run
npm run package:dir          # electron-builder --win --dir (unsigned)
```
