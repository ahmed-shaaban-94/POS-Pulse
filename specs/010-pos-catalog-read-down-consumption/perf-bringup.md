# 010 T054 — Performance bring-up (read-down completion / promote-window + NFR-1/NFR-2 @ 50k)

**Task:** T054 (§A5 production-readiness perf bring-up).
**Date measured:** 2026-06-15 · **Hardware:** target POS terminal (owner-confirmed — see §2).
**Status:** measured + recorded. **VERDICT IS THE OWNER'S CALL** (§7) — this doc records numbers + a
finding; it does NOT self-declare PASS/FAIL.

> **HEADLINE FINDING (read first).** NFR-1 (exact lookup) and NFR-2 (folded search) pass comfortably
> against a read-down-populated 50k catalogue (§5). The read-down completion (write path) was the finding:
> it blocked the Electron main thread for **~20 s at 50k rows** (production shares ONE synchronous
> `better-sqlite3` connection on the main thread — no worker threads — so every barcode scan / lookup /
> manual refresh froze for the duration). This is the **SC-8** concern made concrete.
>
> **FIX LANDED (#411, single-transaction approach — owner-chosen).** Wrapping the staging loop in one
> `db.transaction()` (was ~100k autocommit INSERTs) cut the block to **~3.6 s p50 at 50k rows — a 5.4×
> improvement** (§6.1). The residual is the irreducible insert + index-maintenance + promote cost, not
> fsync overhead. It is ONE atomic ~3.6 s freeze (the single-transaction tradeoff the owner picked over
> chunked staging). **Whether ~3.6 s clears the §A5 bar — or warrants the chunked R-RISK-2 follow-up — is
> the owner's verdict.** See §6.1 + §8.

---

## 0. Why CI cannot do this (read first)

Same posture as 009 §0. The CI perf tests (`src/main/catalogue/__tests__/perf.exact.test.ts`,
`perf.search.test.ts`) assert **correctness at ~50k rows on sql.js** under the parallel Vitest runner —
**no timing assertion, by design**. The NFR budgets are a property of the production **better-sqlite3**
binding on the target Windows terminal, not of pure-JS sql.js under worker contention. Any wall-clock
assertion in CI is inherently flaky and proves nothing about the real budget. This bring-up is the
authoritative measurement, run on the real terminal through the production seams.

The read-down completion window (§6) is likewise **not** a CI assertion: it is the real production
`writer.run()` span on the real binding + real on-disk WAL db.

---

## 1. Budgets under test

| ID | Budget | Scope | Decision-critical? |
|:--|:--|:--|:--|
| **NFR-1** | Exact barcode **and** SKU lookup ≤ **50 ms p95** @ ≥ 50,000 active products | repo query | Low risk — index-served (§5) |
| **NFR-2** | Partial folded text search returns its ranked, capped set ≤ **150 ms p95** @ same scale | repo query | Medium — `LIKE '%q%'` full scan (R4); §5 |
| **SC-8 (read-down window)** | Read-down completion + promote-window at ~50k products; **NFR-1 lookups stay within budget when issued during an in-flight promote** | writer `run()` span (stage + promote) | **YES — see §6** |

### Timed boundary

- **NFR-1/NFR-2:** the repo query only (prepared-statement exec + row mapping) — NOT render (NFR-4), NOT
  the IPC round-trip. Those are separate budgets.
- **SC-8 read-down:** the **whole synchronous `writer.run()` span** — clear-staging → map+validate →
  stage (per-row INSERTs) → promote (DELETE live + INSERT…SELECT + freshness, one transaction). This span
  IS the production main-thread block (see §6 threading note).

---

## 2. Target hardware — recorded 2026-06-15 (owner-confirmed; same terminal as 009 §2)

SQLite performance is dominated by storage and single-core speed. As run on the designated target POS
terminal (owner-confirmed this is the target / 009 sign-off hardware):

| Field | Value |
|:--|:--|
| Machine / model | LENOVO 82K2 |
| CPU (model + base clock) | AMD Ryzen 7 5800H with Radeon Graphics, MaxClockSpeed 3201 MHz |
| RAM | 13.9 GB |
| **Disk type (SSD vs HDD — load-bearing for SQLite)** | NVMe SSD (per 009 §2 — INTEL SSDPEKNW512GZL + Lexar NM620, both NVMe) |
| OS build | Microsoft Windows 11 Pro build 22631 (x64) |
| `better-sqlite3` version | 12.9.0 |
| Build under test | commit SHA `8423a4c`; production `better-sqlite3` binding (`npm rebuild better-sqlite3` → system Node for the run, then `npx @electron/rebuild -f -w better-sqlite3` to restore the Electron ABI), real on-disk `.sqlite` via `npx tsx scripts/perf-seed-catalogue.ts` |
| Pragmas in effect (recorded) | `journal_mode=wal`, `synchronous=2` (FULL) — production defaults from `openDatabase` |
| Power profile | AC / not battery-saver (per 009 §2; owner attests) |

> Indicative-only caveat: numbers were captured on the target terminal but during an interactive session
> (other processes running). They are representative, not a hermetic bench. The owner re-runs / confirms
> for the formal §A5 sign-off.

---

## 3. Seed recipe — a real on-disk DB at ≥ 50k rows, populated BY THE PRODUCTION WRITER

The §6 read-down run replaces the catalogue through `createReadDownWriter` (the production stage+promote
path), so the §5 NFR-1/NFR-2 scenarios then run against a **read-down-populated** catalogue — exactly what
§A5 asks ("confirm 009's lookup budgets hold against a read-down-populated catalogue").

Migrations applied through the production runner: **36 files**. Indexes present on the seeded db (NFR-relied-on):
`idx_products_tenant_sku_norm`, `idx_products_tenant_name_fold`, `idx_products_tenant_alias_fold`,
`idx_product_barcodes_tenant_norm`, `idx_product_barcodes_product`.

### Runnable harness — `scripts/perf-seed-catalogue.ts`

```bash
# 50k rows, time the read-down completion window (5 full-replace runs) AND NFR-1/NFR-2 lookups:
npx tsx scripts/perf-seed-catalogue.ts --rows 50000 --read-down --read-down-runs 5 --measure --samples 1000

# read-down window only:
npx tsx scripts/perf-seed-catalogue.ts --rows 50000 --read-down --read-down-runs 5
```

**ABI note (load-bearing):** `better-sqlite3` is built for the Electron ABI by postinstall; a plain
`tsx`/node run uses system Node and fails to load it (NODE_MODULE_VERSION mismatch). Before running:
`npm rebuild better-sqlite3`. **After running, restore the Electron build:**
`npx @electron/rebuild -f -w better-sqlite3` — otherwise `npm run dev` + the packaged app cannot load the
binding. The script's ABI guard prints this guidance if the binding fails to load.

---

## 4. p95 measurement protocol

- **NFR-1/NFR-2:** 1000 timed samples/scenario, 50 warm-up discarded; mid-set targets (not first/last row);
  `performance.now()` around the single repo call. Two runs recommended (variance check).
- **SC-8 read-down:** N full-replace runs (default/used: 5), each replacing all 50k rows; `performance.now()`
  around the whole `writer.run()`. The FIRST run replaces a full prior catalogue (steady-state cost, not an
  empty-table first-fill). min/p50/p95/max reported.

---

## 5. Scenarios + results — NFR-1 / NFR-2 (recorded 2026-06-15, target terminal)

### NFR-1 — exact lookup (budget ≤ 50 ms p95)

| Scenario | min | p50 | **p95** | max | Budget | Indicative verdict |
|:--|--:|--:|--:|--:|:--|:--|
| `lookupByBarcode` — mid-set hit | 0.147 | 0.189 | **0.413** | 28.062 | ≤ 50 ms | ✅ well within |
| `lookupBySku` — mid-set hit | 0.101 | 0.108 | **0.219** | 0.550 | ≤ 50 ms | ✅ well within |
| `lookupByBarcode` — absent key (not_found) | 0.115 | 0.158 | **0.445** | 4.766 | ≤ 50 ms | ✅ well within |

Index-served, sub-ms p95 — three orders of magnitude under budget. The `max` outliers (28 ms) are
first-sample / OS-scheduling jitter, not the steady-state p95.

### NFR-2 — partial folded search (budget ≤ 150 ms p95)

| Scenario | min | p50 | **p95** | max | Budget | Indicative verdict |
|:--|--:|--:|--:|--:|:--|:--|
| broad token → 20-cap + `truncated` (`"product"`) | 29.112 | 34.909 | **47.907** | 84.757 | ≤ 150 ms | ✅ within (~3×) |
| narrow → single match (`"zinctablet"` analogue) | 20.608 | 24.999 | **36.956** | 50.476 | ≤ 150 ms | ✅ within |
| absent token → not_found | 20.373 | 24.022 | **34.992** | 62.059 | ≤ 150 ms | ✅ within |

The `LIKE '%q%'` full scan (R4) is comfortably within budget at 50k — R-RISK-1 / FTS5 fallback **NOT
triggered** (no NFR-2 p95 > 150 ms). Slightly higher than 009's run (009 p95 ~15 ms) but same order, same
verdict; the read-down-populated table is structurally identical.

---

## 6. Read-down completion window (SC-8) — recorded 2026-06-15, target terminal · **PRE-FIX baseline (the finding)**

5 full-replace runs @ 50,000 rows; products written/run = 50,000 (verified). Production `writer.run()` span:

| Metric | min | **p50** | **p95** | max |
|:--|--:|--:|--:|--:|
| read-down `writer.run()` (ms) | 17858.6 | **19539.1** | **19783.5** | 19783.5 |

**~20 seconds.** And it scales **dead-linearly per row** (the autocommit-staging signature):

| Rows | run() p50 (ms) | per-row (ms) |
|--:|--:|--:|
| 1,000 | 427.4 | 0.427 |
| 50,000 | 19539.1 | 0.391 |

### Threading note — why this is the SC-8 number (NOT a WAL reader/writer race)

Production opens **exactly one** `better-sqlite3` connection (`openDatabase`, `src/main/index.ts:357`),
shared by the read-down **writer**, the catalogue **repo** (009 lookups), and the **driver** — all on the
Electron main thread; **no worker threads** (grep-verified). better-sqlite3 is synchronous, so the
read-down's `writer.run()` holds the main thread for its whole span. A barcode-lookup IPC that arrives
**during** a read-down does **not** race the writer under WAL — it **queues behind** the writer's
synchronous span and runs after it. So:

- There is **no in-process WAL reader-vs-writer concurrency** to measure (a worker-thread harness would
  measure a mode production never enters).
- The honest SC-8 number is the **main-thread block** = the full `writer.run()` span. A scan landing
  mid-read-down inherits up to **~20 s** of latency before its (sub-ms) lookup even runs.
- This freezes **everything** on the surface for ~20 s: scans, lookups, the manual "تحديث الكتالوج"
  refresh, and the app-start read-down (which runs on a paired terminal before the cashier even transacts).

### Cause (proven by the scaling, no further split needed)

The dead-linear ~0.4 ms/row cost is the **staging loop** in `read-down-writer.ts`: it runs ~2 autocommit
`INSERT`s per row (product + barcode) = ~100k separate commits at `synchronous=FULL` on WAL, each forcing a
durability write. The promote itself is one batched `INSERT…SELECT` (a batched transaction cannot be ~19 s);
the staging loop — which is **NOT** wrapped in a `db.transaction()` (unlike the 009 seed and the promote) —
dominates. The staging/promote split was therefore **not separately measured**: the per-row linearity is
conclusive.

## 6.1 POST-FIX result (#411, single-transaction staging) — recorded 2026-06-15, target terminal

Fix landed: the staging loop is now wrapped in ONE `db.transaction()` (the owner-chosen single-transaction
approach over chunked R-RISK-2). Same harness, same 5 full-replace runs @ 50,000 rows; products written/run
= 50,000 (verified):

| Metric | min | **p50** | **p95** | max |
|:--|--:|--:|--:|--:|
| read-down `writer.run()` (ms) — **post-fix** | 3554.5 | **3639.3** | **3726.2** | 3726.2 |

**~20 s → ~3.6 s p50 = a 5.4× improvement.** The ~16 s of fsync overhead (the ~100k autocommit commits at
`synchronous=FULL`) is gone. The residual ~3.6 s is the **irreducible** cost the single transaction cannot
remove: 100k INSERTs + B-tree maintenance on 4 indexes + the promote's DELETE-50k + INSERT…SELECT-50k —
real CPU, not durability waiting. NFR-1 / NFR-2 (§5) are **unchanged** by the fix (the read path is
untouched; the post-fix run measured NFR-1 p95 ≤ 0.35 ms, NFR-2 p95 ≤ 47 ms — same as pre-fix).

**It is ONE atomic ~3.6 s freeze** — no lookup interleaves during it (the single-transaction tradeoff the
owner picked over chunked staging's many-short-pauses). Whether ~3.6 s clears the §A5 bar for an
interactive POS surface, or whether the chunked R-RISK-2 follow-up is warranted, is the **owner's verdict**.

---

## 7. Verdict — **OWNER'S CALL**

Per the 009 §A5 precedent, the owner verdicts. For the record:

- **NFR-1 / NFR-2:** indicatively PASS, comfortably (§5). R-RISK-1 not triggered. Unchanged by the #411 fix.
- **SC-8 read-down window:** was a ~20 s block (§6); the **#411 single-transaction fix cut it to ~3.6 s p50**
  (§6.1). The ~3.6 s is ONE atomic freeze (the residual irreducible insert + index + promote cost). The
  author's read: 5.4× better and likely acceptable for a background paired-terminal read-down (it is not
  session-gated and runs off-peak / on app-start), but a ~3.6 s freeze of cashier interaction during a
  manual mid-shift refresh is a judgement call. **Owner verdicts (a) T054 PASS/FAIL given ~3.6 s, and
  (b) whether the chunked R-RISK-2 follow-up is warranted.**

---

## 8. Fix status (#411 — single-transaction approach, LANDED)

The owner chose the **single-transaction** approach. **DONE** (this doc's §6.1 records the result):

1. ✅ **Staging loop wrapped in one `db.transaction()`** (`read-down-writer.ts` `stageAll`) — collapsed ~100k
   autocommit fsyncs to one commit, **~20 s → ~3.6 s p50** (§6.1). Prepared statements now hoisted once (a
   side win). FR-7 / data-model invariant-2 preserved (live tables are written ONLY in the promote tx, which
   is unchanged — grep-verified; the existing `promote-atomicity` + `happy` tests stay green as the guard).
   The thread still blocks **atomically** for ~3.6 s (no lookup interleaves) — the explicit single-tx
   tradeoff.
2. ⏸️ **Chunked staging** (plan **R-RISK-2**) — the alternative the owner did NOT pick (one ~3.6 s freeze vs
   chunked's many short pauses). Kept on the table as a follow-up IFF the owner finds ~3.6 s insufficient.

Re-ran §5 + §6 after the fix: §6.1 confirms the new block; §5 confirms NFR-1/NFR-2 still pass (read path
unchanged). The fix is a **pure perf refactor** — observable output (live rows, freshness, rejection counts,
failure outcome) is identical before/after, so no new behavioural test was warranted (the existing writer
suite is the regression guard; a "staging atomicity" test would not have failed pre-fix because FR-7 already
held via the promote tx).

---

## 9. Reproduction

```bash
# 1. Build the binding for system Node (a plain tsx run can't load the Electron ABI):
npm rebuild better-sqlite3
# 2. Seed 50k + read-down window + NFR-1/NFR-2:
npx tsx scripts/perf-seed-catalogue.ts --rows 50000 --read-down --read-down-runs 5 --measure --samples 1000
# 3. Transcribe the printed numbers into §5/§6 (numbers are PRINTED, never auto-written).
# 4. RESTORE the Electron ABI (else npm run dev / packaged app break):
npx @electron/rebuild -f -w better-sqlite3
```

The on-disk `perf-catalogue*.db` (+ `-wal`/`-shm` sidecars) are gitignored and may be deleted after the run.
