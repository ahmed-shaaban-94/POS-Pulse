<!--
  specs/010-pos-catalog-read-down-consumption/security-review/s4-review.md
  §A4 bridge-security review — Catalogue Read-Down Consumption (feature 010)
  Scope: the catalogue:refresh / catalogue:freshness bridge surface (S4).
  Type: PRE-implementation gate (threat model + required controls). Authoring this
  file is the BLK-A4 blocker — it OPENS the S4 bridge lane; it does not CLEAR it.
-->

# §A4 — P8 Bridge-Security Review (010-pos-catalog-read-down-consumption)

## 1. Metadata

| Field | Value |
| :--- | :--- |
| Feature | 010-pos-catalog-read-down-consumption |
| Gate | §A4 — P8 Electron security boundary (preload-bridge expansion) |
| Slice gated | S4 — `catalogue:refresh` + `catalogue:freshness` bridge additions + FR-16 freshness UI |
| Bridge surface | `catalogue.refresh` / `catalogue.freshness` (the `catalogue.*` namespace, 009-owned) |
| Task range gated | T043 / T044 (bridge wiring) + the S4 freshness-UI tasks |
| Review type | **PRE-implementation gate** — threat model + required controls. The S4 handler code is not yet written; this file **opens** the lane, a post-implementation review verifies the controls landed. |
| Prepared by | implementing agent (Claude Code), 2026-06-05 |
| Base SHA at preparation | `a7bf216` (origin/main) |
| Constitution version pinned | v1.5.1 |
| Verdict | **LANE OPEN (conditional).** §A4 controls below are MANDATORY acceptance criteria for the S4 diff; a post-implementation walk confirms each lands before S4 merges. |

> This is the §A4 companion to 009's `security-review/s2-review.md`, applied to 010's **own** bridge
> expansion. Unlike 009's S2 file (a post-implementation line-by-line walk with code-line evidence), the
> `catalogue:refresh` / `catalogue:freshness` handlers **do not exist yet** — BLK-A4 is what opens that
> lane. Therefore this review is a **threat model + a binding set of required controls / acceptance
> criteria** drawn from the contract and plan, with a **conditional** verdict (Constitution P9 — it does
> not assert verified status for unwritten code). A short post-implementation review re-runs the §4 matrix
> against the actual diff and flips the verdict to CLEARED.

---

## 2. Inputs reviewed (authoritative sources)

| Source | What it pins |
| :--- | :--- |
| [contracts/catalogue-bridge-additions.md](../contracts/catalogue-bridge-additions.md) | The two channels, their `{}` requests, their response unions, and the "what these do NOT do" boundary. |
| [plan.md](../plan.md) §A4 (Blocks S4) | The gate's required checks: session gate first, no data/secret leak, no renderer-exposed write handler, tenant-scoped freshness, redaction extended. |
| [spec.md](../spec.md) FR-10 / FR-11 / FR-12 / FR-16 / FR-16a / FR-16b | One-way read-direction, no POS→ERP write path, non-blocking, truthful freshness states. |
| [migration-review/s1-migration-review.md](../migration-review/s1-migration-review.md) §8 | `catalogue_sync_state` holds timestamps + opaque snapshot id only — no token, no PII. The freshness read's backing store is secret-free by construction. |
| 009 `security-review/s2-review.md` | The `catalogue.*` namespace's existing gate (`requireCatalogueSession`), generic-refusal posture, and `FORBIDDEN_PAYLOAD_KEYS` redaction baseline this expansion inherits. |

---

## 3. Scope

### Covered by this gate

- `catalogue:refresh` — the cashier-invokable manual read-down trigger (request `{}` → status union).
- `catalogue:freshness` — the FR-16 last-updated read (request `{}` → `{ ok, last_success_at, is_empty }` | refused).
- The renderer "last updated" indicator + "refresh catalogue" affordance, **only** in respect of what
  data it consumes from the bridge (it consumes status + timestamp + `is_empty` — nothing else).
- The preload/channel-constant surface that registers these two channels (`CATALOGUE_IPC_CHANNELS`
  additions: `REFRESH` / `FRESHNESS`).

### Explicitly excluded (reviewed under other gates)

- The read-down **writer / driver / HTTP client** internals (fetch → validate → stage → promote). These
  are main-process-only and never cross the bridge; their atomicity/tenant-scoping is the §A2 concern
  ([migration-review/s1-migration-review.md](../migration-review/s1-migration-review.md) §5).
- The `0031`–`0033` staging + sync-state migrations and the promote transaction — §A2.
- The backend contract / `api-types.ts` re-pin / device-token transport — §A6 (the bridge never sees the
  token; see AD-4 below).
- Production-readiness, rollback, perf bring-up — §A5.

---

## 4. Required-Controls Matrix (S4 acceptance criteria — MANDATORY)

Each control is a **PASS condition the S4 implementation MUST satisfy**. "Required" = the S4 diff is not
mergeable until the post-implementation review observes it. Evidence column cites the **contract/plan**
that mandates it (not extant code — the code is unwritten).

| ID | Control | Required state | Mandated by |
| :--- | :--- | :--- | :--- |
| AD-1 | **Session gate is the FIRST statement** of both `refresh` and `freshness` handlers | `requireCatalogueSession({...})` runs before any driver call or DB read; a refusal short-circuits | contract "Gating — unchanged from 009"; plan §A4 "session gate first" |
| AD-2 | **Generic refusal** — no factor-distinguishing reason to the cashier | `{ kind: 'refused', reason: 'no_session' \| 'tenant_isolation' }`; reason logged for diagnostics only, never echoed to the cashier | contract Gating; 009 NFR-6a baseline |
| WR-1 | **No renderer-exposed catalogue-write handler** | `refresh` only *requests* a main-process tick (`runTickOnce()`); it exposes no INSERT/UPDATE/DELETE and accepts no catalogue payload to persist | contract "What these do NOT do" #1; plan §A4 / P8 "No renderer-exposed write handler" |
| WR-2 | **`refresh` returns NO catalogue data / no per-record content** | response is a status union only (`started` \| `already_running` \| `refused`); the tick outcome surfaces later via freshness + 009 lookups | contract Addition 1 "Effects" |
| RD-1 | **`freshness` is a pure read of secret-free state** | reads `catalogue_sync_state.last_success_at` + a tenant-scoped `products`-has-rows check; returns only `last_success_at` (ISO-8601 \| null) + `is_empty` (boolean) | contract Addition 2 "Effects"; §A2 §8 (store holds timestamps + opaque id only) |
| P17-1 | **Tenant scoping on the freshness read** | the freshness query is scoped to the session tenant (`catalogue_sync_state` PK `tenant_id`; the rows-check filters `tenant_id`); a `tenant_isolation` mismatch refuses | plan §A4 "tenant-scoped freshness"; §A2 §5 (every statement filters `tenant_id`) |
| INP-1 | **Input validation — minimal attack surface** | both requests are `{}`; the handler MUST NOT read terminal identity, tenant, or any path/cursor from the renderer payload (identity comes from session/pairing). A non-empty/garbage payload MUST be ignored or refused, never trusted | contract Addition 1/2 Request (`{}`); FR-15a (no renderer-supplied source) |
| IPC-1 | **Handler never throws across the bridge** | a driver/DB fault degrades to a typed union member (e.g. `refused` / a non-`ok` freshness), never an error string or stack to the renderer | 009 IPC-1 baseline; plan P8 boundary |
| SEC-1 | **No secret crosses the bridge** (P7) | the device token authenticating the read-down stays main-process; neither response carries it; `forbidden-keys.ts` covers any new secret-shaped field (append-only) | contract "What these do NOT do" #3 + Redaction; plan P7 "PASS-load-bearing" |
| RED-1 | **Redaction extended to the two new channels** | `refresh`/`freshness` diagnostics log only status + timestamp + counts; the raw backend snapshot body and the device token are never logged; redaction smoke covers the new payload shapes | contract Redaction (NFR-3/P7/P11); plan §A4 "redaction extended" |
| P9-1 | **Freshness is truthful in all three states** | `last_success_at=null` → "not yet downloaded"; non-null + `is_empty=false` → "last updated &lt;time&gt;"; non-null + `is_empty=true` → "updated &lt;time&gt; — no products available". Never a bare timestamp implying data when empty | FR-16 / FR-16b; contract Addition 2; SC-10 |
| P9-2 | **`refresh` does not fake completion** | the response returns immediately after kicking off the tick (`started`), NOT after the promote commits; no "done"/"synced" claim before the promote lands | contract Addition 1 "Effects" (FR-12 / P2); FR-16 (no false "synced") |
| FR-12 | **Non-blocking** | neither call freezes/delays the selling path; `refresh` is single-flight (`already_running` coalesces a concurrent tick) and does not await the read-down | FR-12; contract Addition 1; FR-14 single-writer |
| FR-10 | **Strictly read-direction — no POS→ERP / POS→backend write path** | the bridge surface sends NO sales/cart/inventory/price/POS-originated data upward; `refresh` triggers only a backend→local read-down; there is no upward write channel here | FR-10 / FR-11 (see §5 / §7) |

---

## 5. Threat Model

**Trust boundary.** The renderer is **untrusted** (Constitution P8 — `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`). The two channels are the only new ways the renderer can reach
the main-process read-down subsystem. The main process (driver, HTTP client, SQLite, device token) is
trusted and never reachable except through these two enumerable, typed channels.

| # | Threat | Vector | Mitigation (required control) |
| :--- | :--- | :--- | :--- |
| T1 | **Renderer drives a catalogue write / poisons the read model** | renderer crafts a payload to insert/overwrite products via `refresh` | WR-1 / WR-2 — `refresh` only *requests* a main-process tick; no write handler, no payload accepted. The writer is main-process-only (§A2). |
| T2 | **Renderer injects a foreign tenant / forges identity** | renderer supplies `tenant_id`/`store_id`/cursor in the request to read or refresh another tenant's catalogue | INP-1 + P17-1 + AD-1 — requests are `{}`; identity comes from session/pairing; freshness is tenant-scoped; mismatch → `tenant_isolation` refusal. |
| T3 | **Secret exfiltration via the bridge** | renderer reads the device token / a credential out of a response or a log line | SEC-1 + RED-1 — token stays main-process; responses carry only status/timestamp/`is_empty`; redaction scrubs forbidden keys; raw snapshot never logged. |
| T4 | **Catalogue-data leak beyond 009's allowlist** | `refresh`/`freshness` return raw snapshot rows or per-record content the renderer shouldn't get | WR-2 + RD-1 — `refresh` returns status only; `freshness` returns a timestamp + boolean. No product payload crosses here beyond what 009 lookup/search/resolve already exposes. |
| T5 | **Error/stack disclosure** | a DB or network fault throws across the bridge, leaking a query echo / stack / table name | IPC-1 — faults degrade to a typed union member; the handler never rethrows to the renderer (009 baseline). |
| T6 | **Denial of selling (DoS via refresh spam)** | renderer calls `refresh` in a tight loop to starve the selling path | FR-12 + FR-14 — single-flight: a concurrent tick returns `already_running`; the call does not await the read-down, so it cannot block lookup/search/confirm. |
| T7 | **Untruthful freshness ("synced" lie)** | a successful-but-empty promote, or a kicked-off-but-uncommitted tick, makes the UI claim data exists | P9-1 + P9-2 — three explicit states incl. synced-but-empty; `last_success_at` is written inside the promote tx (SC-10), so it only reflects committed promotes; `refresh` returns `started`, not "done". |
| T8 | **Upward write path smuggled in (POS→backend / POS→ERP)** | a future edit repurposes `refresh` to also push POS-originated data upstream | FR-10 / §7 — the gate forbids any upward write channel on this surface; `refresh` is a backend→local read trigger only. Any upward path is out of scope and would re-open this gate. |

---

## 6. Renderer Exposure Statement

Through the two new channels, the renderer can observe **only**:

- `refresh`: a generic status — `started` | `already_running` | `refused{reason}`. No catalogue data, no
  per-record content, no counts of products.
- `freshness`: `last_success_at` (ISO-8601 UTC string or `null`) + `is_empty` (boolean), or
  `refused{reason}`.
- `reason` strings (`no_session`, `tenant_isolation`) — generic, non-factor-distinguishing.

**Not present** in either response: device token / JWT / session token / PIN / password / pairing code /
any credential / the raw backend snapshot body / per-product rows / `source_snapshot_id` (the opaque
backend cursor stays in `catalogue_sync_state`, main-process only). `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true` remain in force; S4 adds no `BrowserWindow`.

---

## 7. One-Way / No-POS→ERP Statement (FR-10 / FR-11)

The read-down is **strictly backend → local**. On this bridge surface specifically:

- `catalogue:refresh` triggers a **backend→local** read-down tick. It carries **no** sales, cart,
  inventory-movement, price, or POS-originated data, and opens **no** upward write channel.
- `catalogue:freshness` is a **local read** of local sync state. It contacts neither the backend nor any
  ERP.
- Neither channel posts to ERPNext/Frappe, mutates the cart, rings up or finalizes a sale, computes/stores
  tax, changes inventory/stock/batch state, prints/alters receipts, handles tender, or produces
  reports/analytics (FR-11). The surface only *requests* a catalogue fill and *reads* its freshness.

This control is also what keeps the surface **clear of the signed rider `011-DR-POSTING-R1`** (a posting /
upward-write concern) and clear of the **Console / architecture boundary**: 010 introduces no
POS→ERP and no POS→backend write path. If any future edit to this surface would add an upward write,
that is out of §A4 scope and a hard stop — it re-opens this gate.

---

## 8. Remaining Risks & Gate Dependencies

**R-FRESHNESS-WIRING (LOW):** the FR-16 indicator's three-state truthful copy (P9-1) is a renderer
concern; the bridge guarantees the *signals* (`last_success_at`, `is_empty`) are truthful, but the
post-implementation review MUST confirm the renderer copy maps each state correctly and shows no bare
timestamp on the empty state.

**R-SINGLEFLIGHT (LOW):** T6/FR-14 single-flight (`already_running`) is the load-bearing DoS mitigation;
the post-implementation review MUST confirm the coalesce actually prevents a second concurrent tick (not
just a UI debounce).

**R-REDACTION-SITE (LOW):** RED-1 requires the redaction smoke to be extended to the two new channels'
log sites *when* diagnostic logging is wired (009 deferred catalogue logging). If S4 wires no logger, the
control is satisfied vacuously, but the deferral MUST be stated in the post-implementation review.

### Gates not cleared by this review

| Gate | Condition |
| :--- | :--- |
| §A2 | Migration + promote safety (the writer behind `refresh`). Held `auth-pending` on `branch_id`/GAP-4 — see [s1-migration-review.md](../migration-review/s1-migration-review.md). Blocks S1–S3. |
| §A5 | Production readiness (runbook, rollback, perf bring-up). Blocks the rollout PR. |
| §A6 | Backend contract live re-pin (D-DEPLOY). Blocks the live-fetch HTTP client (T020/T021) + composition-root wiring. Does not block this bridge gate. |

---

## 9. Verdict

**§A4 LANE OPEN — CONDITIONAL.** The `catalogue:refresh` / `catalogue:freshness` bridge expansion is
**approved to be implemented in S4** under the §4 required-controls matrix as **binding acceptance
criteria**. The surface is, by contract: session-gated-first, generic-refusal, tenant-scoped on the
freshness read, write-handler-free (read-down writer is main-process-only), secret-free, redaction-covered,
non-blocking, truthful in all three freshness states, and strictly one-way (no POS→ERP / POS→backend write
path — FR-10/FR-11).

This **opens** the S4 bridge lane (it is the BLK-A4 blocker). It does **not** assert that the controls have
landed in code — the handlers are unwritten (Constitution P9). A short **post-implementation §A4 review**
re-runs the §4 matrix against the actual `catalogue:refresh` / `catalogue:freshness` diff and flips this
verdict to **CLEARED** before S4 merges. Any deviation from the §4 controls — and any introduction of an
upward write path — returns here.

---

**End of §A4 bridge-security review.** Prepared 2026-06-05 at base `a7bf216`; pre-implementation gate
for S4 (T043/T044 + freshness UI). Mirrors 009's `security-review/s2-review.md` in intent, adapted to a
pre-implementation gate per Constitution P9.

---

## 10. Post-implementation walk — 2026-06-07

The `catalogue:refresh` / `catalogue:freshness` surface is now implemented (the bridge factory + channel
constants + bridge-api types + preload exposure; the §4 matrix re-run against the actual diff below). Code
under review:
- `src/main/catalogue/catalogue-bridge.ts` — the `refresh` / `freshness` handlers.
- `src/shared/bridge-api.ts` — `CatalogueRefreshResponse` / `CatalogueFreshnessResponse` + the `{}` request types.
- `src/shared/catalogue/channels.ts` — `REFRESH` / `FRESHNESS` constants.
- `src/preload/catalogue.ts` — the two `ipcRenderer.invoke` exposures.
- `src/renderer/ui/catalogue/CatalogueFreshness.tsx` — the FR-16 indicator (P9-1 renderer copy).

### §4 matrix re-run (control → as-built evidence)

| ID | As-built | Verdict |
| :--- | :--- | :--- |
| AD-1 | Both handlers' FIRST statement is `requireCatalogueSession(getCurrentSession())`; a `refused` short-circuits before any driver call / freshness read. The `refresh` no-session test asserts `driver.calls() === 0`. | ✅ PASS |
| AD-2 | Refusals are `{ kind:'refused', reason:'no_session'|'tenant_isolation' }` from the shared gate; the reason is never widened. The renderer (`CatalogueFreshness`) maps a refusal to a generic `unavailable` state and the test asserts the reason string is NOT in the DOM. | ✅ PASS |
| WR-1 | `refresh` only calls `readDownDriver.runTickOnce()` — it accepts no payload and exposes no INSERT/UPDATE/DELETE. The writer is main-process-only; the bridge dep is narrowed to `Pick<ReadDownDriver,'runTickOnce'>` (it cannot even reach the writer). | ✅ PASS |
| WR-2 | `refresh` returns a status union only (`started`|`already_running`|`refused`); `admission.completed` is explicitly dropped. No catalogue data crosses. | ✅ PASS |
| RD-1 | `freshness` reads only `freshness.readSyncState(tenantId)` (timestamps + opaque id) + `freshness.countProducts(tenantId)`; returns `last_success_at` + `is_empty` only. | ✅ PASS |
| P17-1 | Both freshness reads take `gate.session.tenant_id`; the tenant-isolation test injects a foreign-tenant row and asserts it returns never-synced (the foreign row never leaks). | ✅ PASS |
| INP-1 | Both request types are `Record<string,never>` (`{}`); the handlers read NOTHING from the request — identity comes from the session. | ✅ PASS |
| IPC-1 | Handlers never throw: no-driver / no-freshness-source degrade to a typed `refused`, asserted by the "not wired" tests. The renderer wraps the bridge calls and renders an `unavailable` state on refusal. | ✅ PASS |
| SEC-1 | Neither response carries the device token or any secret; the bridge dep surface (`runTickOnce`, `readSyncState`, `countProducts`) cannot reach the token (it stays in the driver/client, main-process). | ✅ PASS |
| RED-1 | **Satisfied vacuously + pinned.** The bridge/driver/handlers wire NO logger (verified: zero `console`/logger calls in `read-down/*.ts` and the new handlers). The read-down redaction smoke (T018, `read-down/__tests__/redaction.smoke.test.ts`) pins that `device_token`/forbidden keys are scrubbed and the `TickOutcome` carries no row content, so a leak is caught WHEN logging is later wired. **Deferral recorded** (R-REDACTION-SITE). | ✅ PASS (deferred-vacuous) |
| P9-1 | `CatalogueFreshness` renders the three states from `data-state` (`never-synced`/`updated`/`synced-empty`) with distinct Arabic copy + an icon (never colour-only); the synced-but-empty state shows "تم التحديث، لكن لا توجد منتجات" with the timestamp, never a bare time. Tested per state. | ✅ PASS |
| P9-2 | `refresh` returns `started` immediately after `runTickOnce()` admission (the driver's async single-flight resolves the read-down on `completed`, which the bridge ignores); the renderer shows "جارٍ التحديث…" / "جارٍ التحديث بالفعل" and the test asserts no "completed/success" copy appears. | ✅ PASS |
| FR-12 | Non-blocking: `refresh` does not await the read-down (admission is synchronous in the driver); single-flight (`already_running`) is the driver's, surfaced verbatim. | ✅ PASS |
| FR-10 | No upward write on this surface. The `no-outbound-write` test (T036) proves the full tick invokes ONLY `client.fetchSnapshot` (a Proxy spy asserts the invocation set is exactly `{fetchSnapshot}`); the bridge sends nothing upward. | ✅ PASS |

### Residuals (all LOW, carried to §A5 / wiring)

- **T043 ipcMain registration deferred.** The two channels are NOT yet registered with `ipcMain.handle` in
  the composition root — 009 never wired the catalogue bridge to `ipcMain` either, and the driver wiring
  (T039) needs `pairingStore` scope + the #349-blocked live client. The bridge factory + preload are
  complete and unit-tested; the registration lands with T039/T043 when #349 clears. **A post-wiring
  re-check of AD-1/SEC-1 against the live `ipcMain` handler is required before the rollout PR.**
- **R-REDACTION-SITE (RED-1):** redaction is satisfied vacuously (no logger wired). When diagnostic logging
  is added, extend the redaction smoke to the actual log sites.
- **R-FRESHNESS-WIRING / R-SINGLEFLIGHT:** the renderer copy maps each state correctly (tested) and
  single-flight is the driver's, tested in `read-down-driver.test.ts`.

### Verdict (post-implementation)

**§A4 CLEARED for the implemented bridge factory + preload + freshness UI** under the §4 matrix (all 13
controls PASS; RED-1 deferred-vacuous with the invariant pinned). The clearance is **scoped to the code
that exists**: it does NOT cover the `ipcMain.handle` registration (T043, deferred with T039 on #349) —
that registration re-opens AD-1/SEC-1 for a short post-wiring re-check before the rollout PR. No upward
write path was introduced (FR-10 proven by T036).

**End of post-implementation walk.** Prepared 2026-06-07 against the S4 diff on `feat/010-driver-bridge-ui`.
