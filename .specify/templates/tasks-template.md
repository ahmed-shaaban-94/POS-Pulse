# Tasks: [FEATURE NAME]

**Feature:** [NNN-short-name]
**Plan:** [./plan.md](./plan.md)
**Spec:** [./spec.md](./spec.md)
**Created:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]

---

## Conventions

- **Format:** `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **`[P]`** marks parallelizable tasks (different files, no dependency on incomplete tasks).
- **`[USn]`** maps the task to a user story phase. Setup, Foundational, and Polish phases have no
  story label.
- File paths are repository-relative (e.g., `src/main/index.ts`).

## Phase 1 — Setup

[Project initialization. Configs, dependencies, build scripts. Nothing app-specific.]

## Phase 2 — Foundational (Blocking Prerequisites)

[Anything that MUST exist before any user-story work can start. Renderer scaffolding, main-process
shell, IPC pattern, test harness.]

## Phase 3+ — User Stories (in priority order)

For each story:

### US`n` — `<Title>` (`P1`/`P2`/`P3`)

**Goal:** [single sentence — what becomes true when this story is done]
**Independent test:** [how a reviewer verifies the story without depending on later stories]

- [ ] T0XX [P?] [USn] Test or implementation task with file path

## Phase Final — Polish & Cross-Cutting

[Cleanups, docs, verification runs, packaging smoke. Nothing that adds new feature behavior.]

## Dependency Graph

[Story → story dependencies. Ideally most stories are independent.]

## Parallel Execution Examples

[Worked examples of which task groups can run concurrently.]

## Implementation Strategy

[MVP scope, incremental delivery order, suggested checkpoints.]
