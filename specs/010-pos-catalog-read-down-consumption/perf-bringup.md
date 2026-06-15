# 010 T054 — Performance bring-up (read-down completion / promote-window + NFR-1/NFR-2 @ 50k)

**Task:** T054 (§A5 production-readiness perf bring-up).
**Date measured:** 2026-06-15 · **Hardware:** target POS terminal (owner-confirmed — see §2).
**Status:** measured + recorded. **VERDICT IS THE OWNER'S CALL** (§7) — this doc records numbers + a
finding; it does NOT self-declare PASS/FAIL.

> **HEADLINE FINDING (read first).** NFR-1 (exact lookup) and NFR-2 (folded search) pass comfortably
> against a read-down-populated 50k catalogue (§5). **BUT the read-down itself blocks the Electron main
> thread for ~20 s at 50k rows** (§6) — because production shares ONE synchronous `better-sqlite3`
> connection on the main thread (no worker threads), every barcode scan / lookup / manual refresh freezes
> for the duration of a read-down. This is the **SC-8** concern made concrete and is a **likely sign-off
> blocker** pending the owner's verdict + the R-RISK-2 mitigation. See §6 + §8.

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

## 6. Read-down completion window (SC-8) — recorded 2026-06-15, target terminal · **THE FINDING**

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

---

## 7. Verdict — **OWNER'S CALL**

Per the 009 §A5 precedent, the owner verdicts. For the record:

- **NFR-1 / NFR-2:** indicatively PASS, comfortably (§5). R-RISK-1 not triggered.
- **SC-8 read-down window:** a **~20 s main-thread block** at 50k rows. There is no explicit numeric budget
  in the spec for read-down completion, but a ~20 s freeze of all cashier interaction is **not acceptable
  for an interactive POS surface** and contradicts the SC-8 intent (lookups stay responsive during a
  read-down). The author's recommendation: **treat as a sign-off blocker** pending the §8 mitigation — but
  the verdict + sequencing (ship-doc-then-fix vs fix-then-reverify) is the owner's.

---

## 8. Recommended fix (separate task — owner-sequenced, NOT done here)

The fix is **out of T054's measure-only scope** and is flagged for a follow-up task (own TDD + P8/review +
PR), because it touches the atomic stage/promote path (FR-7 "prior catalogue preserved", data-model
invariant-2 on staging leakage) and involves a real UX tradeoff:

1. **Wrap the staging loop in one `db.transaction()`** — collapses ~100k fsyncs to ~1, expected ~20 s → ~1 s.
   Simplest; but the thread still blocks **atomically** for that ~1 s (no lookup interleaves).
2. **Chunked staging** (plan **R-RISK-2** named mitigation) — stage in batches so queued lookups can run
   **between** chunks. Turns one ~20 s freeze into many short pauses — better worst-case scan latency, more
   complexity. **Single-big-tx vs chunked is a design/owner call** (one ~1 s freeze vs many short ones).

Either way: re-run §6 after the fix to confirm the block is within a cashier-tolerable bound, and confirm
the §5 NFR-1/NFR-2 lookups still pass (they will — the read path is unchanged).

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
