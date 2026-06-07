# Implementation Plan: Sale Sync (Capture-UP)

**Feature ID:** 011-sale-sync-capture-up
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-06-07
**Last Updated:** 2026-06-07
**Constitution version pinned:** v1.5.1

---

## Summary

011 is the **capture-UP** leg of the sale-sync pipeline. A main-process engine drains 008's
read-only, enqueue-only `sale_sync_outbox`, reconstructs each sale's capture payload from the
durable Sale record (keyed by `sale_id`), and POSTs it to DP2 `captureSale`
(`POST /api/pos/v1/sales`) with an `Idempotency-Key`. All mutable sync/retry/dead-letter state
lives in a **new 011-owned `sale_sync_state` table** (008's table is never mutated — AD-11
preserved). The renderer gets a **read-only** sync-status surface via the typed preload bridge; it
never triggers the drain. The live HTTP client + composition-root wiring are gated on the backend
deploy (#349, HTTP 521); everything else is buildable + testable now behind a DI fake client.

This mirrors 010's shape: a new companion table (→ §A2-class migration review), a new bridge
channel (→ §A4-class P8 bridge-security review), and a #349-gated live leg over a buildable core.

## Technical Context

| Area | Choice | Source |
|:--|:--|:--|
| Runtime | Electron 40 main process (engine); React 19 renderer (read-only status only) | constitution v1.5.1 |
| Language | TypeScript 5.6 strict | constitution v1.5.1 |
| Local DB | `better-sqlite3`, WAL, custom transactional migration runner | constitution v1.5.1 |
| New table | `sale_sync_state` (011-owned), joined on `sale_id`; companion to 008's `sale_sync_outbox` | research.md R3 (clarify Q3) |
| HTTP client | DI seam (`SaleSyncClient` interface); fake injected for tests; live client gated on #349 | research.md R6 (clarify) |
| Auth | Operator session token, read in-process from 004's session store; never crosses the bridge | research.md R2 (clarify Q1) |
| Codegen | `api-types.ts` `captureSale` shape from the pinned snapshot; live re-pin deferred to deploy | constitution V / #349 |
| Money | integer minor units, `Number.isSafeInteger`-guarded | constitution II |
| Tests | Vitest only | constitution VI |
| Idempotency | `Idempotency-Key` + payload `externalId`, both deterministic from `sale_id` | research.md R4 |

No **NEEDS CLARIFICATION** items remain (3 resolved in spec §Clarifications 2026-06-07).

## Constitution Check (Initial)

### Core Principles (I–IX)

| Principle | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | **PASS** | Finalized sales queue durably (008); 011 drains when online + operator-session present. Offline = sales wait in the outbox; no loss (P3/P18). |
| II. Financial Precision | **PASS** | Payload money = integer minor units, `Number.isSafeInteger`-guarded; no floats in the serialisation path (SC-8). |
| III. Process-Boundary Discipline | **PASS** | Engine in main; renderer reaches it only via the typed preload bridge; status surface is read-only. |
| IV. Hardware Loud, Not Silent | **N/A** | 011 touches no hardware (no printer/drawer). |
| V. Type Safety End-to-End | **PASS** | Payload typed from `api-types.ts` (`captureSale`); DI client interface typed; no `any` at the boundary. |
| VI. Test-First, Coverage-Gated | **PASS** | DI fake client makes the full drain/retry/dead-letter logic unit-testable with no live endpoint (FR-13/SC-7). Test-first per task. |
| VII. Observability | **PASS** | Structured logs limited to `sale_id`, status code, error category, retry count (FR-12); no PII/cards. |
| VIII. Terminal Identity ≠ User | **PASS** | Capture is **operator-authed** (`PosOperatorAuthGuard`), distinct from the device-token read-down (010). 011 honours the human/terminal split: the operator token authenticates the sale, the device pairing identifies the terminal in the payload. |
| IX. Reference, Not Inheritance | **PASS** | No ERPNext code; terminal emits a sale fact only — the Connector owns ERPNext POS Invoice / consolidation server-side. |

### Cross-Feature POS Principles (P1–P18) — load-bearing rows

| Principle | Status | Notes |
|:--|:--:|:--|
| P3. No Silent Loss | **PASS** | Transient → retry w/ backoff; permanent (4xx) → dead-letter + operator notification; never silently dropped (FR-6/FR-7). |
| P5. Idempotency | **PASS** | Deterministic `Idempotency-Key` + `externalId` from `sale_id`; 409 treated as idempotent success (FR-5); backend dedups `(tenant, sourceSystem, externalId)`. |
| P8. Electron Security Boundary | **PASS-with-justified-expansion** | 011 adds a read-only `sales:syncStatus` bridge channel — reviewed line-by-line under a **P8 bridge-security review (§A4-class)**. No renderer-exposed write/trigger handler; operator token never crosses the bridge. |
| P17. Tenant Scoping | **PASS** | `sale_sync_state` carries `tenant_id`/`branch_id`; all reads/writes tenant-scoped; payload scope from the durable Sale + pairing, never renderer-supplied. |
| P18. Local Durability | **PASS** | All sync state in WAL SQLite; durable before and across network attempts (FR-8). |

No VIOLATIONs. One expansion (P8) is gated by §A4.

## Architectural Decisions

- **AD-1 — Companion sync-state table (not mutating 008's outbox).** `sale_sync_state` (011-owned)
  holds `sync_status`/`attempt_count`/`next_retry_at`/`last_error_category`/`synced_at`, joined on
  `sale_id`. 008's `sale_sync_outbox` stays enqueue-only (CHECK + UPDATE-refusing trigger, AD-11).
  Mirrors 010's `catalogue_sync_state` precedent. (Clarify Q3.)
- **AD-2 — Operator-authed capture, token in-process.** The engine reads the operator session token
  from 004's main-process store in-process; it is never copied to the renderer / never crosses the
  bridge. Drain pauses without a valid session, resumes on next sign-in. (Clarify Q1; Principle VIII.)
- **AD-3 — Deterministic idempotency from `sale_id`.** Both the `Idempotency-Key` header and the
  payload `externalId` derive deterministically from `sale_id` (stable across restarts/retries).
- **AD-4 — No tender in v1.** Payload carries line items + integer-minor totals + identity only; no
  tender, no placeholder. Gated by a pre-impl verification (see Risks). (Clarify Q2.)
- **AD-5 — DI client seam.** `SaleSyncClient` interface; fake injected for tests; live HTTP client +
  composition-root wiring land with the #349 deploy. The engine depends only on the interface.
- **AD-6 — Read-only status surface.** `sales:syncStatus` exposes pending / last-success / dead-letter
  counts to the renderer. The renderer cannot trigger or mutate the drain.

## Phase 0 — Research

See [./research.md](./research.md). Resolves the engine/queue model, auth acquisition, sync-state
ownership, idempotency derivation, backoff policy, and the DI client seam; records alternatives.

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md) — `sale_sync_state` schema, indexes, the state
  machine, tenant-scoping; reviewed under an **011 §A2-class migration review**.
- **Contracts:** [./contracts/](./contracts/) — the consumed DP2 `captureSale` request/response shape
  (mirror of `pos-sales/sales.yaml`, authoritative upstream) + the internal `SaleSyncClient` seam +
  the `sales:syncStatus` bridge contract.
- **Quickstart:** [./quickstart.md](./quickstart.md) — developer path to run the drain against the
  fake client and the test matrix.

## Project Layout

```
src/main/
  sync-outbox/
    sale-sync-outbox.repository.ts        EXISTING (008) — read-only to 011
  sales-sync/                             NEW (011)
    sale-sync-engine.ts                   drain orchestration, single-flight, backoff
    sale-sync-state-repo.ts               NEW table CRUD (tenant-scoped)
    sale-sync-client-types.ts             SaleSyncClient DI interface + result union
    capture-payload.ts                    Sale record → CaptureSalePayload (no tender; minor units)
    create-sale-sync-client.ts            live HTTP client — GATED on #349 (stub until then)
  ipc/
    sales-sync.ts                         NEW read-only sales:syncStatus handler (§A4)
  migrations/
    0034-sale-sync-state.ts               NEW (§A2-gated)
  preload/
    sales-sync.ts                         NEW preload bridge (read-only)
src/renderer/ui/sales-sync/               NEW read-only status indicator
```

## Test Strategy

- Vitest only. DI fake client drives the full engine: happy-path POST, offline-drain FIFO, 409
  idempotent success, 5xx backoff-retry (persisted across restart), 4xx dead-letter + notification,
  operator-session-expiry pause/resume.
- `sale-sync-state-repo` migration + tenant-scoping tests (§A2-class).
- Payload serialiser: no-tender boundary + integer-minor-units (no float coercion), ≥95% on the
  money-touching path.
- Bridge: read-only channel, no write handler, redaction smoke (no token / PII / cards) (§A4).

## CI / Build / Package

Standard four gates on `windows-latest` (self-hosted): typecheck, lint, tests, package dry-run.
No codegen change until the #349 re-pin (the `captureSale` shape is already in the pinned snapshot).

## Phase 2 — Implementation Outline (slices)

| Slice | Scope | Gate |
|:--|:--|:--|
| **S1: Migration** — `0034-sale-sync-state` (ship empty) | New table + indexes + tenant scoping; FK-safe single PR. **BUILDABLE NOW.** | §A2-class migration review |
| **S2: Sync-state repo + payload builder** | `sale-sync-state-repo`, `capture-payload` (no tender, minor units), `SaleSyncClient` interface. **BUILDABLE NOW** (fake client). | — |
| **S3: Engine (drain/retry/dead-letter/backoff/single-flight)** | Full orchestration against the fake; operator-session pause/resume; FIFO. **BUILDABLE NOW.** | — |
| **S4: Read-only bridge + status UI** — `sales:syncStatus` + preload + renderer indicator | Read-only surface; a11y/RTL. | §A4 (P8) |
| **S5: Live HTTP client + composition-root wiring** — `create-sale-sync-client`, real token read, interval/trigger | The live leg. **BLOCKED on #349** (HTTP 521). | §A4 refresh re-check; §A5 readiness |

## Constitution Check (Post-Design)

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| II. Financial Precision | **PASS** | data-model + payload builder keep integer minor units. |
| III / P8. Process Boundary | **PASS-with-justified-expansion** | One read-only bridge channel; §A4. |
| VI. Test-First | **PASS** | DI fake makes S1–S4 fully testable pre-deploy. |
| VIII. Terminal ≠ User | **PASS** | Operator-authed capture; token in-process only. |
| P3 / P5 / P17 / P18 | **PASS** | No silent loss; idempotent; tenant-scoped; durable. |

No status regressed from Initial.

## Approval Gates

> **§A2** = migration safety (the new `sale_sync_state` table + the read-side join). **§A4** = P8
> bridge-security (the new read-only `sales:syncStatus` channel). **§A5** = production readiness
> (runbook/rollback + the no-tender end-to-end verification + live-leg bring-up).

- **§A2 (migration safety) — REQUIRED, fresh.** Review `0034-sale-sync-state` schema, indexes,
  tenant-scoping, and that 008's enqueue-only invariant is untouched. Does not inherit any prior gate.
- **§A4 (P8 bridge-security) — REQUIRED.** Line-by-line review of `sales:syncStatus`: read-only,
  no write/trigger, no token/PII leakage across the bridge.
- **§A5 (production readiness) — rollout-time.** Includes the **no-tender end-to-end verification
  gate** (DP2 owners confirm a no-tender sale is captured + posted as outstanding-AR) and the
  live-leg bring-up. Blocked alongside #349.

## Risks & Open Items

- **#349 / HTTP 521 (backend undeployed)** — owner: backend-ops. S5 live leg blocked; S1–S4 proceed
  behind the fake client. Mitigation: DI seam isolates the live client.
- **No-tender tolerance (verification gate, not a design question)** — owner: DP2. Confirm a
  non-zero-total, no-tender sale is accepted end-to-end before wiring S5. If a placeholder is
  required, FR-9 + payload shape revisit.
- **Operator-session lifetime vs. drain duration** — a long offline backlog may outlive a session;
  the pause/resume design (AD-2) handles it, but bring-up should confirm no starvation under a large
  queue (NFR-3, 1000+ entries).

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task
generation MUST update this plan and re-run task generation.*
