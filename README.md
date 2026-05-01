# POS Pulse

Desktop Point-of-Sale terminal for the SmartDataPulse pharmacy platform.

**Platform:** Windows 10/11 x64 · **Stack:** Electron 40 + React 19 + Vite 8 + TypeScript 5 (strict)

## Quickstart

See [`specs/001-foundation/quickstart.md`](specs/001-foundation/quickstart.md) for the full
developer onboarding walkthrough (clone → install → dev → test → package dry-run).

```bash
npm install
npm run dev        # opens empty Electron window
npm test           # vitest run
npm run typecheck  # both tsconfigs
npm run package:dir  # unsigned Windows build --dir
```

## Project structure

```
src/main/       Electron main process
src/preload/    Typed preload bridge (contextBridge)
src/renderer/   React + Vite renderer
src/shared/     Types shared across all processes
migrations/     SQL migration files (applied by migrate.ts)
specs/          Spec Kit documents (spec, plan, tasks, contracts)
docs/           Hardware matrix and other documentation
```

## Active feature

**001-foundation** — see [`specs/001-foundation/`](specs/001-foundation/).
