# Contract: `catalogue.*` Bridge Additions (010)

**Feature ID:** 010-pos-catalog-read-down-consumption
**Plan:** [../plan.md](../plan.md) (R-bridge, R8)
**Upstream owner of the namespace:** 009 (`src/shared/bridge-api.ts` `catalogue.*`, read-only)
**Created:** 2026-06-04
**Constitution version pinned:** v1.5.1

> 010 makes a **small, additive, read-safe** expansion to 009's `catalogue.*` preload-bridge namespace.
> Every addition is **new preload-bridge surface → Constitution P8** (Electron security boundary). 010
> **owns** this expansion explicitly and ships it under a **P8 bridge-security review gate** (mirrors
> 009's S2 `catalogue.*` review). 010 is therefore **single-agent, sensitive-scope** — not renderer-only.
> The namespace remains free of any catalogue-write handler exposed to the renderer: the read-down writer
> lives entirely in the main process; the renderer can only *request* a refresh and *read* freshness.

---

## Gating — unchanged from 009

Both additions begin with `requireCatalogueSession({})` (009's gate, `requireCatalogueSession`). Same
generic-refusal posture: `{ kind: 'refused', reason: 'no_session' | 'tenant_isolation' }`, reason logged
for diagnostics, never echoed to the cashier.

> Note: the **background** read-down driver (R8) is NOT bridge-gated on an operator session — it runs on
> a paired terminal (Constitution VIII). These two **bridge** calls are session-gated because they are
> cashier-initiated/cashier-visible. There is no looser path.

---

## Addition 1 — `catalogue.refresh` (manual "refresh catalogue")

A cashier-invokable trigger that runs **one** read-down tick on demand (R8 `runTickOnce()`).

**Channel:** `catalogue:refresh` (added to `CATALOGUE_IPC_CHANNELS`).

**Request:** `{}` *(no payload; the terminal identity + tenant come from session/pairing, not the
renderer)*

**Response:**

```text
| { kind: 'started' }                          // a read-down tick was kicked off
| { kind: 'already_running' }                  // single-flight: a tick is in progress (R8)
| { kind: 'refused', reason: 'no_session' | 'tenant_isolation' }
```

**Effects:** triggers a background read-down tick in the main process. **Returns no catalogue data** and
**no per-record content** — only a generic status. The outcome of the tick surfaces later via the
freshness read (Addition 2) and the existing 009 lookup states (a successful promote simply makes
products findable). It never blocks the renderer: the response returns immediately after kicking off the
tick, not after the read-down completes (FR-12, P2 — no fake "done" before the promote commits).

## Addition 2 — `catalogue.freshness` (last-updated read)

Returns the truthful last-successful-promote timestamp for the FR-16 indicator.

**Channel:** `catalogue:freshness` (added to `CATALOGUE_IPC_CHANNELS`).

**Request:** `{}`

**Response:**

```text
| { kind: 'ok', last_success_at: string | null, is_empty: boolean }   // ISO-8601 UTC; is_empty = live products table has 0 rows for tenant
| { kind: 'refused', reason: 'no_session' | 'tenant_isolation' }
```

**Effects:** none (pure read of `catalogue_sync_state.last_success_at` + a tenant-scoped
`products`-has-rows check). `is_empty` closes the **empty-catalogue truthfulness hole** (SC-10): a
*successful empty* promote sets a non-null `last_success_at` while 009 still reports the catalogue
`unavailable`, so a bare timestamp would imply data exists when it doesn't. The renderer copy is honest in
all three states (P9):
- `last_success_at = null` → "catalogue not yet downloaded" (never synced).
- non-null + `is_empty = false` → "catalogue last updated &lt;time&gt;".
- non-null + `is_empty = true` → "catalogue updated &lt;time&gt; — no products available" (truthful
  synced-but-empty, distinct from both above).

A non-null `last_success_at` is guaranteed to reflect a **committed** promote (the timestamp is written
inside the promote transaction — SC-10), so the indicator never claims freshness for a read-down that
didn't land.

> **Design choice (plan-level).** Addition 2 MAY instead be folded into an existing renderer read rather
> than a dedicated channel; the dedicated channel is preferred (R-bridge) to keep 009's typed lookup
> unions clean. Either way it is a pure, secret-free, tenant-scoped read.

---

## What these additions do NOT do

- **No catalogue-write handler is exposed to the renderer.** The read-down writer (fetch → validate →
  stage → promote) is main-process only; `catalogue.refresh` only *requests* it.
- **No raw snapshot / product payload crosses the bridge** beyond what 009 already exposes via
  lookup/search/resolve. `refresh`/`freshness` return status + a timestamp, nothing else.
- **No secret crosses the bridge** (P7): the device token used to authenticate the read-down stays in
  the main process.
- **No money arithmetic, no audit emission** (read-down is not a sensitive action).

## Redaction (NFR-3 / P7 / P11)

`refresh`/`freshness` diagnostics log only status + timestamp + counts. The raw backend snapshot body and
the device token are never logged. If the backend issues any new secret-shaped token, it is appended to
`src/shared/audit/forbidden-keys.ts` (append-only).

## Review gate

This bridge expansion is reviewed under a **P8 bridge-security review** (`security-review/` package,
mirroring 009 S2): line-by-line `catalogue:refresh` / `catalogue:freshness` diff; confirm no data/secret
leak, no write handler exposed, session gate first, tenant-scoped freshness read, redaction extended.

---

**End of contract.** Final names/shapes are 010-side proposals co-resident with `/speckit-plan`. The
bridge additions land in the slice that wires the read-down driver, behind the P8 review gate.
