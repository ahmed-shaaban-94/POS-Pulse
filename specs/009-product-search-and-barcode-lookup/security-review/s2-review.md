<!--
  specs/009-product-search-and-barcode-lookup/security-review/s2-review.md
  S2 post-implementation security review — Product Search & Barcode Lookup (feature 009)
  Reviewer: implementing agent (line-by-line walk of the S2 read-repo diff)
  Scope: T022–T030 (read repo + exact-lookup handlers + catalogue-unavailable + redaction smoke)
-->

# 009 Product-Search-and-Barcode-Lookup — S2 Security Review

## 1. Metadata

| Field           | Value                                                            |
| :-------------- | :--------------------------------------------------------------- |
| Feature         | 009-product-search-and-barcode-lookup                            |
| Slice           | S2 — `products`/`product_barcodes` read repo + exact lookup      |
| Review date     | 2026-05-31                                                       |
| Reviewer        | Implementing agent (line-by-line walk; mirrors 005 S2 review)    |
| Task range      | T022–T030                                                        |
| Gates relied on | §A0 ✅ · §A1 ✅ · §A2 ✅ (RATIFIED 2026-05-31)                  |
| Verdict         | **CLEARED** (S2 post-implementation gate only)                   |

---

## 2. Files Introduced / Modified

| File | Change |
| :--- | :----- |
| `src/main/catalogue/product-repo.ts` | **NEW** — read-only exact barcode/SKU lookup + catalogue-availability detection. |
| `src/main/catalogue/catalogue-bridge.ts` | **MODIFIED** (+44/−11) — `lookupBarcode`/`lookupSku` wired to the repo; `productRepo` optional dep; `lookupResultToResponse` mapper. |
| `src/main/catalogue/__tests__/product-repo.barcode.test.ts` | NEW (T022) |
| `src/main/catalogue/__tests__/product-repo.sku.test.ts` | NEW (T023) |
| `src/main/catalogue/__tests__/catalogue-unavailable.test.ts` | NEW (T026/T027) |
| `src/main/catalogue/__tests__/catalogue-bridge.lookup.test.ts` | NEW (T025) |
| `src/main/catalogue/__tests__/perf.exact.test.ts` | NEW (T028) |
| `src/main/catalogue/__tests__/redaction.smoke.test.ts` | NEW (T029) |
| `src/main/catalogue/__tests__/__helpers__/catalogue-fixture.ts` | NEW — sql.js fixture; folds `*_norm`/`*_fold` via the real `normalize()`. |

No migration changes (the `0029`/`0030` DDL landed in PR #322, §A2-ratified). No renderer changes
(component shells were S1). No production composition-root wiring (see §8 R-WIRING).

---

## 3. Scope

### Covered

- `src/main/catalogue/product-repo.ts` — all read queries + the availability discriminator.
- `src/main/catalogue/catalogue-bridge.ts` — the `lookupBarcode` / `lookupSku` handler diff.
- The S2 test surface T022–T030.

### Explicitly Excluded

- `catalogue.search` — still the S1 `catalogue_unavailable` stub (folded search is S3, §A2).
- `catalogue.resolve` — still the S1 stub (005-seam resolution is S4, §A1).
- The production `ipcMain.handle` registration + `getCurrentSession` wiring in `src/main/index.ts`
  (deferred from T016; see §8 R-WIRING). S2's tests inject the repo/session directly and do not
  require it.
- Migration DDL — reviewed under §A2 (`migration-review/s2-migration-review.md`).

---

## 4. Security Matrix

| ID    | Control                                       | Finding | Evidence                                                               |
| :---- | :-------------------------------------------- | :------ | :--------------------------------------------------------------------- |
| AD-1  | Session gate is the FIRST step of each handler| PASS    | `requireCatalogueSession(getCurrentSession())` precedes any repo call. |
| AD-1b | Stub cannot bypass the gate                   | PASS    | `search`/`resolve` stubs gate first, then return `catalogue_unavailable`. |
| P17-1 | Tenant scoping enforced IN SQL                | PASS    | Every query has `WHERE … tenant_id = ?`; the session tenant is the only one passed. |
| P17-2 | Cross-tenant row never returned               | PASS    | `product-repo.sku/barcode` tests: tenant-2 row → `not_found` for tenant-1. |
| FR-18 | Inactive products excluded (sellable guard)   | PASS    | Every query has `p.active = 1`; inactive-only → `not_found`.           |
| FR-7  | Ambiguous barcode never auto-resolves         | PASS    | `COUNT(DISTINCT product_id) > 1` → `ambiguous`; never picks one.       |
| FR-24 | `catalogue_unavailable` distinct from not_found| PASS   | empty/missing/unreadable → `unavailable`; populated-no-match → `not_found`. |
| IPC-1 | Handler NEVER throws across the bridge         | PASS    | repo `try/catch` returns `unavailable`; handler returns a union, no throw. |
| NFR-6a| Refusals generic (no factor-distinguishing)   | PASS    | `{ kind:'refused', reason }`; reason for diagnostics only.            |
| NFR-7 | Redaction covers `catalogue.*` payloads        | PASS    | `redaction.smoke.test.ts`: forbidden keys scrubbed; snapshot is an allowlist. |
| RE-1  | No secrets/PII in the response surface         | PASS    | `ProductSnapshotDisplay` = name/price/flags/sku/barcode only.         |
| MN-1  | Money: integer minor units, carried verbatim   | PASS    | `price_minor` carried as-is (AD-5); CHECK(>=0) in DDL; no arithmetic.  |
| WR-1  | No write path (read-only namespace, AD-2)      | PASS    | repo exposes only `lookupByBarcode`/`lookupBySku`; no INSERT/UPDATE/DELETE. |

---

## 5. File-by-File Security Walk

### `src/main/catalogue/product-repo.ts`

**Read-only (AD-2 / WR-1).** The repo surface is exactly two methods — `lookupByBarcode`,
`lookupBySku`. There is no insert/update/delete; the module never constructs a mutating
statement. 009 cannot write the catalogue.

**Tenant isolation in SQL (P17-1/2).** Both queries filter `WHERE … tenant_id = ?` and the
caller (the handler) passes **only** `gate.session.tenant_id`. There is no fetch-then-compare
path where a cross-tenant row could transit memory before being rejected — the row never leaves
the query. The barcode JOIN binds `p.tenant_id = pb.tenant_id` so a mismatched-tenant mapping
cannot bridge tenants.

**Active guard (FR-18).** Both queries carry `p.active = 1`, aligned with the partial indexes
(`… WHERE active = 1`). An inactive product is not-found-for-selling and cannot resolve.

**Ambiguity (FR-7).** `discriminate()` counts DISTINCT `product_id`. Multiple barcode rows for one
product (pack + unit) collapse to one; ≥ 2 distinct **active** products return `ambiguous` and the
repo returns no product — it never silently picks one. The active+inactive-sharing-a-barcode case
resolves to the single active product (tested).

**Availability discriminator (FR-24, IPC-1).** `catalogueHasRows()` (a `SELECT 1 … LIMIT 1`)
distinguishes an empty read model from a populated-no-match. A thrown query — missing table or an
unreadable handle — is caught and returned as `{ kind: 'unavailable' }`. **The catch never rethrows
across the bridge**; a DB fault degrades to the generic unavailable state, never an error string or
stack to the renderer.

> *Note (defence-in-depth observation, non-blocking):* the broad `catch {}` initially masked a real
> SQL bug (`ambiguous column name: product_id` in the barcode JOIN) as `unavailable`. The TDD
> round-trip/tenant tests surfaced it and it was fixed by qualifying columns with the `p.` alias.
> The catch is correct for production resilience, but its breadth is why the test suite — not the
> catch — is the load-bearing correctness guarantee here.

**Money (MN-1).** `price_minor` is carried verbatim into the snapshot (AD-5); no arithmetic. The
`Number.isSafeInteger` refusal lives on the resolve path (S4 / FR-19) — surfacing a display snapshot
does not commit money, and the DDL `NOT NULL CHECK (price_minor >= 0)` guarantees a valid integer.

### `src/main/catalogue/catalogue-bridge.ts`

**Gate-first (AD-1).** `lookupBarcode` / `lookupSku` call `requireCatalogueSession` as the first
statement; a refusal short-circuits before the repo is touched. The `search` / `resolve` stubs are
unchanged and still gate first.

**Optional repo (AD-1b / ST-1).** `productRepo` is optional; absent → `catalogue_unavailable` (the
honest S1 posture). A stub path cannot leak data — it returns a kind, never product rows.

**Response mapping (NFR-6a / RE-1).** `lookupResultToResponse` maps the repo union to the bridge
union 1:1: `one|not_found|ambiguous` pass through; `unavailable` → `catalogue_unavailable`. The
only data returned on `one` is the `ProductSnapshotDisplay` the repo built.

### `src/shared/catalogue/product-snapshot.ts` (consumed, not modified)

`ProductSnapshotDisplay` is a display allowlist: `product_id`, `display_name_ar`,
`display_name_en?`, `price_minor`, `unit_pack_label?`, `tax_category?`, `selling_barcode?`, `sku?`,
`active`, `controlled_substance`, `prescription_required`. No credential, token, PIN, or PII field
exists in the type. The controlled/Rx flags are surfaced for awareness (display only — enforcement
is out of scope, per spec).

### `__tests__/__helpers__/catalogue-fixture.ts`

Test-only. Folds `sku_norm`/`name_fold`/`alias_fold`/`barcode_norm` via the **real** `normalize()`
so fixtures reflect production folding (FR-12b) rather than a hand-typed fiction. No production
import depends on this file.

---

## 6. Renderer Exposure Statement

The S2 read path exposes to the renderer (via the eventual preload bridge) only:

- Opaque `product_id` / `sku` / `selling_barcode` — identifiers / labels; no entropy leak.
- `display_name_ar` / `display_name_en` / `unit_pack_label` — display strings.
- `price_minor` — integer minor units.
- `active` / `controlled_substance` / `prescription_required` — booleans, awareness only.
- `reason` strings (`no_session`, `tenant_isolation`) — generic.

**Not present** in any S2 response: JWT / session token / device token / PIN / password / pairing
code / credential / card or voucher data / raw query echo under a sensitive key.

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` remain in force; S2 adds no
`BrowserWindow`.

---

## 7. Logging and Redaction Statement

S2 wires **no logger** into the catalogue bridge (no diagnostic logging emitted yet — the contract's
"log ambiguous for diagnostics" is deferred to when a logging surface is wired, avoiding speculative
code). NFR-7 is nonetheless protected on two fronts, both proven by `redaction.smoke.test.ts`:

1. The centralized pino redaction (`logger.ts` `REDACTION_PATHS`, derived from
   `FORBIDDEN_PAYLOAD_KEYS`) scrubs every forbidden key even when nested inside a
   `catalogue.*`-shaped payload at four wildcard depths.
2. The `one`-result snapshot surface carries **none** of `FORBIDDEN_PAYLOAD_KEYS` — verified by
   iterating the key list against `Object.keys(snapshot)`.

No new redaction key is required: the catalogue surface introduces no new sensitive field name. (If
a future slice adds catalogue diagnostic logging, that slice extends the redaction smoke to its log
sites.)

---

## 8. Remaining Risks and Gates

**R-WIRING (LOW):** The production `ipcMain.handle` registration + `getCurrentSession` wiring in
`src/main/index.ts` (deferred from T016) is NOT in this slice. Consequence: the handlers are
renderer-unreachable until wired — they cannot leak because nothing calls them in production yet.
This is a conscious deferral, not a gap; the wiring rides with S4 (when add-to-cart is wired) or a
dedicated follow-up, and that PR's review must confirm the live session provider is the only tenant
source.

**R-PERF-FIDELITY (LOW):** `perf.exact.test.ts` runs on sql.js, not production better-sqlite3, so
its bound is a generous full-scan-regression guardrail (300 ms), not the NFR-1 50 ms p95. The
authoritative p95 bring-up is **T054 at §A5** on target Windows hardware (mirrors 008's
owner-accepted bench-smoke posture). No security impact.

**R-CATCH-BREADTH (LOW):** The repo's `catch {}` correctly degrades DB faults to `unavailable` but
is broad enough to mask logic bugs (see §5 note). Mitigation: the TDD suite is the correctness
guarantee; future log-wiring should record the caught error server-side (redaction-safe) for
diagnostics.

### Gates not cleared by this review

| Gate | Condition |
| :--- | :-------- |
| §A5  | Production-readiness (runbook, rollback, perf bring-up @ 50k on target hardware). Gates S5. |

---

## 9. Final Verdict

**S2 SECURITY REVIEW CLEARED.** The read-repo + exact-lookup surface is session-gated, tenant-scoped
in SQL, read-only, never throws across the bridge, and exposes a display-only allowlist with redaction
proven. S3 (folded search) and S4 (resolve + 005 seam) carry their own reviews; §A5 remains open and
gates S5.
