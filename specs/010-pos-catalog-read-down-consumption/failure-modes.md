# Failure-Mode Catalogue — Read-Down (010)

Every way a read-down tick can fail, what the terminal does, and what the
operator sees. The governing invariant: **a failed read-down never corrupts or
empties a working catalogue, and never advances the freshness clock** (SC-4 /
SC-5 / SC-10). The prior catalogue stays fully usable offline.

| # | Failure | Where caught | Terminal behaviour | Operator-visible | Diagnostic |
| :- | :--- | :--- | :--- | :--- | :--- |
| F1 | **Transport: backend unreachable** (offline, DNS, refused, timeout) | Driver — client returns `no_connection` | Writer NOT called; prior catalogue intact; `last_success_at` unchanged | Freshness keeps showing the last good time (or "never downloaded") | `recordAttempt('failed')` → `catalogue_sync_state.last_attempt_at` + `last_outcome='failed'` |
| F2 | **Transport: reached but failed** (non-2xx, malformed body) | Driver — client returns `failed` | Same as F1 | Same as F1 | Same as F1 (driver `recordFetchFailure`) |
| F3 | **A few malformed rows** (below abort-threshold) | Writer — `mapSellableRow` / `validateRecord` reject per-row | Valid rows promote; bad rows skipped + counted (FR-9 skip-and-log) | Catalogue updates; freshness shows updated | `last_outcome='skipped_with_rejections'`; `recordsRejected` count |
| F4 | **Mostly malformed snapshot** (over abort-threshold — a source-format break) | Writer — rejected fraction > `ABORT_THRESHOLD_REJECTED_FRACTION` | NO promote; prior catalogue 100% preserved | Freshness unchanged (last good time) | `last_outcome='failed'`, `failureCategory='threshold-exceeded'` |
| F5 | **Interrupted / throwing promote** (DB error mid-transaction) | Writer — the single promote transaction rolls back | Live tables unchanged; staging never visible to readers (atomic) | Freshness unchanged | `failureCategory='db-error'` |
| F6 | **No resolvable store scope** (empty tenant/branch) | Writer — rejected before any write (§A2 NOT-NULL contract) | No write at all | (Should not occur in production — scope comes from the device principal) | `failureCategory='no-store-scope'` |
| F7 | **Successful but EMPTY snapshot** (backend has no sellable catalogue for the store) | Writer — promotes 0 rows | Live tables emptied for the tenant; `last_success_at` SET | "تم التحديث، لكن لا توجد منتجات" (synced-but-empty — SC-10) | `last_outcome='succeeded'`, 0 products |
| F8 | **Concurrent ticks** (interval fires while one runs, or manual refresh during a background tick) | Driver — async single-flight | Second tick coalesces (`already_running`); no double-write | "جارٍ التحديث بالفعل" on manual refresh | — |
| F9 | **Tenant drift** (a snapshot row carries a foreign tenant) | Writer — every statement is tenant-scoped; rows stamped with the device-principal tenant | Foreign-tenant rows never reach live tables | (No operator-visible effect) | Tenant-isolation test T026 |
| F10 | **Concurrent lookup during promote** (cashier scans while a promote commits) | SQLite WAL — readers see the pre-commit snapshot until commit | Lookup returns the OLD catalogue until the promote commits, then the NEW one; never a half-written state | None (seamless) | Verified at §A5 perf bring-up (SC-8, pending hardware) |

## Key guarantees

- **Atomicity (F5):** the promote is one transaction (DELETE + INSERT…SELECT +
  freshness write). A throw rolls back the whole thing — readers never see staging
  rows, and `last_success_at` is written inside the tx so it can only reflect a
  committed promote.
- **Preservation (F1/F2/F4/F5):** any failure leaves the prior catalogue 100%
  usable. The terminal keeps selling offline against the last good snapshot.
- **Truthfulness (F7):** a successful-but-empty promote is a distinct, honestly
  labelled state — never a bare timestamp implying data exists (SC-10).
- **Single-writer (F8):** single-flight in the driver prevents a second concurrent
  tick; the manual refresh cannot starve the selling path (FR-12 non-blocking).

## Not yet covered (deferred)

- **F10 under load** — the WAL concurrent-reader behaviour during a ~50k-product
  promote is asserted by design but the latency budget (NFR-1 held during a
  promote) is validated at the §A5 perf bring-up on target hardware (pending,
  same hardware dependency as 009 T054).
