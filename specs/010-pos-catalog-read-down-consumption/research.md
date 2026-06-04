# Phase 0 — Research: Catalog Read-Down Consumption

**Feature ID:** 010-pos-catalog-read-down-consumption
**Plan:** [./plan.md](./plan.md) v1.0
**Spec:** [./spec.md](./spec.md)
**Created:** 2026-06-04
**Constitution version pinned:** v1.5.1

> Phase 0 resolves the planning-level unknowns the spec's Clarifications left to `/speckit-plan`.
> Each decision records rationale + alternatives. **No source, SQL, or codegen is authored here.**
> The clarified architectural decisions (stage-and-promote, full-snapshot replace, separate state
> store, skip-and-log, paired-terminal trigger, timestamp-only freshness) are *inputs* to this phase
> from the spec's `## Clarifications` — they are not re-litigated; this phase pins their *mechanism*.

---

## As-built grounding (verified 2026-06-04)

Confirmed against the repo so the plan commits to reality, not assumption:

- **`normalize(input: string): string`** — `src/main/catalogue/normalize.ts:24`. Pure, idempotent
  (`normalize(normalize(x)) === normalize(x)`). The load-bearing fold (Arabic letter-form folding,
  diacritic/tatweel strip, lowercase, numeral fold, whitespace collapse). **R1 below depends on
  reusing this verbatim.**
- **`createProductRepo(db): ProductRepo`** — `src/main/catalogue/product-repo.ts`. Read-only:
  `lookupByBarcode` / `lookupBySku` / `search` / `resolveForSeam`, all tenant-scoped, `active`-filtered
  (except resolve). 010 adds a **separate writer**; it does not modify this repo.
- **Migration runner** — `src/main/db/migrate.ts`. Transactional per file (one tx wrapping DDL +
  `schema_migrations` bookkeeping; opt-out via a `-- @no-wrap-transaction` marker in the first 10
  lines). Tracks applied migrations in `schema_migrations(name, applied_at, checksum)`. Files
  `NNNN_*.sql`, discovered + sorted by name. **Latest is `0030_create_product_barcodes.sql`** → 010's
  migrations start at `0031`.
- **Backend HTTP client pattern** — `src/main/operator/backend-client.ts` and the voucher-authority
  clients (`src/main/payments/voucher-authority/{reverse,redeem,validate}.ts`). Pattern: a factory taking
  `{ baseUrl, fetch, timeoutMs }`; `fetch` injected (prod binds `globalThis.fetch`); **resolve on every
  reachable response (incl. non-2xx), reject only on transport failure** → typed discriminated-union
  outcome with a `no_connection` / `authority_unreachable` sentinel; `AbortSignal.timeout()`. The voucher
  clients consume **generated** `components['schemas']['…']` types from `src/shared/api-types.ts`
  (`reverse.ts:19,32-33`) — confirming Constitution V codegen is live and enforced.
- **Device-token attachment (verified, corrects an exploration inference).** The voucher clients send
  only `Content-Type` + `Idempotency-Key` headers — **no `X-Terminal-Token` header exists anywhere**.
  004's `signIn` attaches the device token as a **request-body field** (`device_token_attestation`,
  `backend-client.ts`), read from `secretStore.get(DEVICE_TOKEN_KEY)` at the composition root. So the
  as-built terminal-auth idiom is **body-field attestation**, not a bespoke header (see R6).
- **Background-task pattern** — `src/main/sales/finalize-listener.ts`: a factory returning
  `{ runTickOnce, start, stop }`; `start()` installs a `setInterval`, single-flight per tick; `stop()`
  clears it; cleanup runs **before** `dbHandle.close()` at app quit (`index.ts` `closeDbHandle`). R8
  reuses this shape.
- **Logger + redaction** — `pino` + `pino-roll` (`src/main/logging/logger.ts`); the append-only
  forbidden-key allowlist at `src/shared/audit/forbidden-keys.ts` is enforced at three layers (audit
  emitter, pino redaction, Sentry scrubber). R7 extends it.
- **Composition root** — `src/main/index.ts`: single process-lifetime `dbHandle`; `secretStore`,
  `pairingStore`, `operatorSessionManager`, `operatorBackend` (`createBackendClient({ baseUrl, fetch })`)
  all instantiated here; IPC handlers registered before window creation.

---

## R1. Fold-column population — reuse 009's `normalize()` verbatim

**Decision.** At write-time, 010 computes `name_fold` / `alias_fold` (and `sku_norm` / `barcode_norm`)
by calling **009's exported `normalize()`** (`src/main/catalogue/normalize.ts`) — the identical function
009's repo folds queries with. No second normalization is authored.

**Rationale.** FR-3 + 009 FR-12b: matching is a property of the *comparison*; query and stored text MUST
be folded identically. 009's data-model already states the fold columns are "maintained at write-time by
the sourcing feature using 009's published fold rules." `normalize()` is pure + idempotent, so calling it
at write-time and read-time is correctness-equivalent by construction. Divergence would silently break
search recall (SC-9).

**Alternatives rejected.** (a) A 010-local re-implementation of folding → guaranteed drift the moment
either copy changes; rejected. (b) Compute folds in SQL → SQLite lacks the Unicode NFD + Arabic
letter-folding `normalize()` performs; rejected.

## R2. Stage-and-promote mechanism — shadow tables + transaction-wrapped swap

**Decision.** 010 writes the validated snapshot into **staging tables** (`products_staging`,
`product_barcodes_staging`), then promotes inside **one better-sqlite3 transaction**: `DELETE FROM`
the live tables and `INSERT … SELECT` from staging (a transaction-wrapped replace), scoped to the
terminal's tenant. The promote is the only step that touches the live tables 009 reads.

**Rationale.** FR-6 atomicity + FR-7 failure-safety. better-sqlite3 transactions are synchronous and
atomic; a crash mid-promote rolls back, leaving the prior live catalogue intact. "Atomic table-swap"
is **not** a native SQLite primitive, so the concrete mechanism is the transaction-wrapped
delete-live + insert-from-staging (the same transactional idiom the migration runner uses). Staging
writes happen *outside* the promote transaction, so they never hold locks against 009's lookups (NFR-2).
A `DROP/ALTER TABLE RENAME` shadow-swap was considered but rejected: renaming tables out from under
009's prepared statements + indexes is riskier than an in-place transactional replace at ~50k rows,
which is well within budget.

**Alternatives rejected.** (a) Row-by-row `INSERT OR REPLACE` into live tables (the exploration
sketch) → exposes partially-applied state to lookups; violates FR-6; rejected. (b) `ATTACH` a second
SQLite file and swap files → cross-file atomicity + the existing single-handle/migration model make
this heavier than a transactional in-DB replace; rejected for MVP.

## R3. Full-snapshot replace — no delta/cursor/ordering machinery

**Decision.** Each read-down consumes a **complete per-tenant/branch sellable-catalogue snapshot** and
replaces the catalogue wholesale (via R2). No per-row version cursor, no ordering rules, no
conflict-resolution, no tombstones.

**Rationale.** Clarified decision (Q-RD-MODEL). At ~50k products a full snapshot is well within a
background read-down's budget; whole-replace makes FR-13 (idempotent — re-running converges to the same
state) and FR-14 (no interleave — single promote) hold by construction, and makes out-of-order/replayed
data impossible to regress (there is no order). Constitution P1/P3 bias: simplest thing that is
obviously correct over wire-efficiency.

**Alternatives rejected.** Incremental delta and snapshot-bootstrap-then-delta → both need a persisted
cursor, ordering + versioning rules, and a resync-on-drift fallback; deferred as a future
wire-efficiency optimization (its own feature-scope decision), to be revisited only if a measured
wire/latency problem appears.

## R4. Sync-state store — a separate `catalogue_sync_state` table, not new columns on `products`

**Decision.** Read-down bookkeeping (last-successful-promote timestamp, source/snapshot identifier,
optional last-attempt outcome) lives in a **separate single-row-per-tenant `catalogue_sync_state`
table**, out of 009's hot lookup/search path. 009's existing `products.row_version` /
`created_at` / `updated_at` provenance columns are **populated** by the read-down but **not widened**
with sync-bookkeeping columns.

**Rationale.** Clarified decision (Q-RD-STATE) + NFR-1. Widening `products` (the table 009's tenant +
`active` partial indexes are tuned on) risks lookup regression and forces an ALTER on 009's hot table;
a tiny side table is read once for the freshness indicator (FR-16) and never on the lookup path.

**Alternatives rejected.** Sync columns on `products` → couples read-down bookkeeping to 009's hot
read path; risks NFR-1; rejected. A file on disk → loses transactional consistency with the promote;
rejected (the state row is updated *inside* the promote transaction so freshness can never claim a
success that didn't commit — SC-10).

## R5. Malformed-record handling — validate-then-skip, with a batch-abort threshold

**Decision.** Each incoming record is validated (required fields present; `price_minor` a safe integer
≥ 0; `name_ar` non-empty) before it enters staging. An invalid record is **skipped and recorded** for
diagnostics; the promote proceeds over the validated set. A **rejection-threshold guard**: if the
rejected fraction exceeds a configured limit, the run is treated as a **failed** read-down (no promote;
prior catalogue preserved per FR-7).

**Rationale.** Clarified decision (Q-RD-BATCH) + FR-9 + Constitution P3. One bad upstream row must not
blank a till; but a wholesale source-format break (most rows failing) should fail loudly rather than
promote a near-empty catalogue. Validation at the staging boundary keeps the live tables clean (P1
money guard runs here, mirroring 009's `Number.isSafeInteger` read guard).

**Open (planning detail, not blocking).** The threshold value (e.g. ">5% rejected" or ">N absolute").
Recorded in the plan's Risks as a tuning item; tests assert both the skip-one and abort-on-many paths.

## R6. Backend snapshot contract + terminal-token attachment — PROPOSED, backend-dependent (Constitution V)

**Decision (constrained).** The read-down consumes a backend operation returning a full per-tenant/branch
sellable-catalogue snapshot. The HTTP client reuses the established pattern (factory + injected `fetch`
+ `AbortSignal.timeout` + resolve-on-reachable / reject-on-transport + typed discriminated outcome).
**Response types MUST be generated** via `openapi-typescript` into `src/shared/api-types.ts`
(Constitution V — never hand-typed), exactly as the voucher clients consume
`components['schemas']['…']`.

**Blocking dependency (the implementation gate).** `src/shared/api-types.ts` currently has **no
`/products/*` (catalogue-snapshot) operation**. Therefore:
- The `contracts/backend-catalogue-snapshot.md` in this plan is **PROPOSED** — a request *to* the
  backend team for the operation shape, not a committed local contract.
- Implementation is **blocked** until the backend publishes the OpenAPI operation and codegen
  regenerates `api-types.ts` (a `src/shared/api-types.ts` change is itself forbidden/codegen-owned
  scope — another reason implementation is gated), **or** an explicit Constitution V waiver is filed
  for a temporary hand-typed shape with an expiry condition.

**Terminal-token attachment (verified options).** The as-built terminal-auth idiom is a **request-body
attestation field** (004 `device_token_attestation`), read from `secretStore.get(DEVICE_TOKEN_KEY)` at
the composition root — **not** a bespoke `X-Terminal-Token` header (that header does not exist in the
repo; the earlier exploration inference was wrong). The plan proposes the body-attestation idiom as the
default and names a header as the alternative the backend may instead require. The token is a secret:
it is read in the main process, attached to the outbound request, and **never** crosses the bridge to
the renderer or enters a log (P7 / forbidden-keys allowlist already lists `device_token` +
`device_token_attestation`).

**Alternatives rejected.** Hand-typing the response shape with no waiver → silent Constitution V
violation; rejected. Inventing the `X-Terminal-Token` header → not the as-built pattern; rejected
pending backend confirmation.

## R7. Read-down diagnostics — public fields only, redaction allowlist extended

**Decision.** Read-down log sites emit only public diagnostic fields: outcome
(`succeeded`/`failed`/`skipped-with-rejections`), counts (products written, records rejected), latency,
`tenant_id` / `branch_id`, promote timestamp, and (on failure) a transport/HTTP status category. The
**raw snapshot body, the device token, and any per-record PII are never logged.** If the backend issues
any new secret-shaped token for the snapshot, it is appended to
`src/shared/audit/forbidden-keys.ts` (append-only).

**Rationale.** Constitution VII / P7 / P11 + spec NFR-3. Mirrors the voucher clients' "never log the raw
response body" posture and 009's `catalogue.*` redaction smoke.

## R8. Read-down trigger + lifecycle — paired-terminal background driver, reusing the listener pattern

**Decision.** A main-process **read-down driver** modelled on `finalize-listener.ts`
(`{ runTickOnce, start, stop }`): `runTickOnce()` (or a startup run) fires on **app start and after
pairing**; `start()` installs a periodic `setInterval`; `stop()` is called **before** `dbHandle.close()`
at app quit. The driver runs on a **paired terminal** (keyed by the device's tenant/branch identity) and
does **NOT** require an active operator session (Constitution VIII "unattended terminal MAY perform
background sync"). It never blocks selling (FR-12) — the fetch + staging happen off the lookup path; only
the brief promote transaction touches the live tables. A **manual "refresh catalogue"** path (R-bridge,
below) invokes `runTickOnce()` on demand.

**Rationale.** Clarified decision (Q-RD-TRIGGER). The established background-task pattern already solves
single-flight ticking + clean shutdown ordering; reusing it avoids a bespoke scheduler.

**Open (planning detail).** The periodic interval value (e.g. hourly) and the precise app-start /
post-pairing hook points are tuning details for the slice, not scope-changing.

## R-bridge. New `catalogue.*` bridge surface — single new channel + a freshness read (P8 sensitive scope)

**Decision.** Two additive, read-safe bridge concerns:
1. A **manual refresh** trigger — a new `catalogue:refresh` IPC channel that gates on session and calls
   the driver's `runTickOnce()`, returning a generic ok/refused/in-progress result (never raw data).
2. A **freshness read** — either a new `catalogue:freshness` channel or a field surfaced through an
   existing read, returning the last-successful-promote timestamp from `catalogue_sync_state` (no secrets).

**Rationale.** Both are new preload-bridge surface → Constitution P8 (Electron security boundary). 010
**owns** this expansion explicitly and runs it under a **P8 bridge-security review** gate (mirrors 009's
S2 `catalogue.*` review). This makes 010 **single-agent sensitive-scope**, not renderer-only.

**Alternatives rejected.** Auto-refresh-only with no manual trigger → the clarified decision keeps the
manual affordance (known-price-changed case). Surfacing freshness by widening an existing lookup
response → muddies 009's typed lookup union; a dedicated read is cleaner.

---

## Resolved-unknowns summary

| Unknown (from spec planning-deferrals) | Resolution |
|:--|:--|
| Stage-and-promote SQLite mechanism | R2 — shadow staging tables + transaction-wrapped delete-live/insert-from-staging |
| Fold-column population | R1 — reuse 009's `normalize()` verbatim |
| Sync-state location | R4 — separate `catalogue_sync_state` table |
| Malformed-record threshold | R5 — validate-then-skip + batch-abort threshold (value = plan tuning) |
| Backend contract + token attachment | R6 — **PROPOSED, backend-dependent**; generated types (V); body-attestation token (verified) |
| Diagnostics redaction | R7 — public fields only; allowlist extended |
| Trigger + lifecycle | R8 — paired-terminal background driver (finalize-listener pattern) + manual refresh |
| New bridge surface | R-bridge — `catalogue:refresh` (+ freshness read); P8 review gate |

**The only true blocker is R6** (the backend catalogue-snapshot OpenAPI operation does not exist yet).
Everything else is locally designable now; R6 gates *implementation*, not planning.
