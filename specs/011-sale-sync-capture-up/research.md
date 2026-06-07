# Phase 0 Research — Sale Sync (Capture-UP)

All decisions trace to the clarified spec (§Clarifications 2026-06-07) or to existing-code facts.
No NEEDS CLARIFICATION items remain.

## R1 — Engine + queue model

- **Decision:** A single main-process `SaleSyncEngine` drains 008's `sale_sync_outbox` in FIFO
  (insertion) order, one sale at a time, with async single-flight (a tick already running coalesces
  the next trigger). Background interval + (later) a finalize-completion nudge.
- **Rationale:** FIFO preserves backend ordering; single-flight prevents overlapping drains racing on
  the same row; main-process keeps the renderer non-blocking (NFR-1). Mirrors 010's `read-down-driver`
  single-flight admission pattern.
- **Alternatives:** per-sale parallel POSTs (rejected — ordering + idempotency-race risk);
  renderer-driven drain (rejected — Principle III / P8, and ties sync to UI liveness).

## R2 — Operator-token acquisition (clarify Q1)

- **Decision:** Read the operator session token from 004's **main-process session store, in-process**.
  Never copy it to the renderer; never send across the bridge. Drain pauses when no valid session;
  resumes on next sign-in / token rotation.
- **Rationale:** Lowest attack surface; honours "no secrets across the bridge" + `safeStorage`
  discipline; capture is operator-authed (`PosOperatorAuthGuard`), distinct from 010's device token.
- **Alternatives:** IPC token-copy on sign-in (rejected — needless secret duplication into a second
  process surface); per-cycle token request (rejected — chattier, no benefit over in-process read).

## R3 — Sync-state ownership (clarify Q3)

- **Decision:** New 011-owned `sale_sync_state` table joined on `sale_id` holds all mutable
  sync/retry/dead-letter state. 008's `sale_sync_outbox` stays enqueue-only.
- **Rationale:** 008's table has `CHECK(state='pending')` + an UPDATE-refusing trigger (migration
  0024, AD-3). Relaxing that reopens a deliberately-closed invariant (migration-safety + security
  risk). Companion table is precedented by 010's `catalogue_sync_state`.
- **Alternatives:** relax 008's CHECK/trigger to allow a state machine on the original table. This is
  a **sanctioned path, not a violation** — `migrations/0024_create_sale_sync_outbox.sql` explicitly
  comments *"the future sync engine MAY relax these via additive migration"*. It is deferred for v1
  (not rejected): the companion table is lower-churn and keeps 008's table single-purpose, but if a
  later need favours one table, relaxing the triggers via additive migration is pre-blessed by 008.

## R4 — Idempotency derivation

- **Decision:** Both `Idempotency-Key` (header) and payload `externalId` derive deterministically
  from `sale_id` (e.g. a fixed namespacing of the sale id), stable across restarts and retries.
- **Rationale:** Backend dedups on `(tenant, sourceSystem, externalId)`; a stable key collapses all
  retries of a sale to one record and makes 409 a safe idempotent success.
- **Alternatives:** random UUID per attempt (rejected — defeats dedup, double-posts on retry).

## R5 — Backoff + dead-letter policy

- **Decision:** Exponential backoff on 5xx / network-timeout, persisted `attempt_count` +
  `next_retry_at` in `sale_sync_state` (survives restart), capped at a configurable max interval
  (default 5 min, NFR-4). 4xx (400/422) → `dead_letter` + non-blocking operator notification.
- **Rationale:** Persisted retry state means a restart doesn't reset the counter (FR-6); the cap
  bounds wait under sustained outage; dead-letter prevents silent loss (P3).
- **Alternatives:** in-memory retry (rejected — restart resets, violates FR-6); auto-drop on 4xx
  (rejected — silent loss, P3).

## R6 — DI client seam (clarify; #349)

- **Decision:** `SaleSyncClient` interface with `postSale(payload): Promise<SaleSyncResult>` where the
  result is a typed union (`ok` / `duplicate` (409) / `transient` (5xx/timeout) / `permanent` (4xx) /
  `no_connection`). Fake injected for tests; live HTTP client (`create-sale-sync-client`) implements
  the same interface and lands with the #349 deploy.
- **Rationale:** Lets S1–S4 build + test fully with no live endpoint (backend is HTTP 521). Mirrors
  010's `ReadDownClient` seam exactly. The client never rejects — transport faults map to the union.
- **Alternatives:** direct `fetch` in the engine (rejected — untestable pre-deploy, couples engine to
  transport).

## R7 — No-tender payload (clarify Q2)

- **Decision:** v1 payload = line items + integer-minor totals + identity (tenant/branch/terminal/
  operator/timestamp/`externalId`). No tender, no placeholder tender line.
- **Rationale:** `captureSale` carries no tender fields; the Connector posts outstanding-AR. Recorded
  as a **pre-implementation verification gate** (DP2 owners confirm end-to-end) — see plan §Risks.
- **Alternatives:** synthesize a placeholder tender (rejected for v1 — invents a backend shape we
  don't own; revisit only if verification says it's required).
