# 009 T054 — Performance bring-up (NFR-1 / NFR-2)

> **Status: T054 RUN on target hardware 2026-06-01 — NFR-1 PASS, NFR-2 PASS.
> §A5 remains OPEN (owner sign-off gated).** The methodology, seed recipe, and
> measurement protocol are below; §2 (hardware) and §5 (results) are now filled
> with **real target-terminal measurements** the owner ran and supplied (two
> 1000-sample runs, agreed within noise). R-RISK-1 / FTS5-fallback review is
> **NOT** triggered. This document records evidence for the human reviewer — it
> is **NOT** an §A5 sign-off; §A5 stays owner-gated.
>
> Same bench-smoke posture as 008 (`a5-verification-findings.md`).

---

## 0. Why CI cannot do this (read first)

The two at-scale perf tests already in the suite —
[`perf.exact.test.ts`](../../src/main/catalogue/__tests__/perf.exact.test.ts) (T028)
and [`perf.search.test.ts`](../../src/main/catalogue/__tests__/perf.search.test.ts) (T035)
— **assert correctness at ~50k rows, NOT timing, by design.** Their headers say
why, and it is the single most important fact for this bring-up:

> The NFR-1/NFR-2 budget "is a property of the production **better-sqlite3**
> binding on the target Windows terminal — NOT of **sql.js** (pure-JS WASM)
> running inside a parallel Vitest runner where dozens of worker processes
> contend for CPU."

**Therefore: T054 does NOT mean "re-run the CI perf tests with timing on."**
That would time the wrong engine (sql.js) under the wrong conditions (runner
contention) and the artifact would be worthless. T054 measures the **production
`better-sqlite3` binding against a real on-disk `.sqlite` file** on the target
hardware. The first job of this harness is to stand that up.

---

## 1. Budgets under test (from spec NFR-1 / NFR-2)

| ID | Budget | Scope | Decision-critical? |
|:--|:--|:--|:--|
| **NFR-1** | Exact barcode **and** exact SKU lookup ≤ **50 ms p95** @ ≥ 50,000 active products | repo query | Low risk — index-served (see §5) |
| **NFR-2** | Partial folded text search returns its ranked, capped set ≤ **150 ms p95** @ same scale | repo query | **YES** — the `LIKE '%q%'` full scan (R4) is the one that may miss → R-RISK-1 |

**Out of scope for T054** (separate budgets, do not conflate):
- **NFR-4** result render ≤ 16 ms — a renderer concern, not a repo measurement.
- **IPC / bridge round-trip** — `catalogue.*` preload→main→preload latency is
  additional to the repo query and is NOT what NFR-1/NFR-2 bound.

### Timed boundary (what to wrap with the timer)
The **repo-level query only**: prepared-statement `exec` + row mapping on
`better-sqlite3`, i.e. one call into
[`product-repo.ts`](../../src/main/catalogue/product-repo.ts):

- NFR-1 → `repo.lookupByBarcode(tenant, code)` and `repo.lookupBySku(tenant, sku)`
- NFR-2 → `repo.search(tenant, query)`

Do **not** include `normalize()` of the query if you want the pure DB number;
do a separate run *including* `normalize()` if you want the realistic
cashier-path number. Record which. The FTS5 / R-RISK-1 decision (§6) hinges on
the repo number, not the full bridge round-trip.

---

## 2. Target hardware — recorded 2026-06-01 (owner-supplied)

SQLite performance is dominated by storage and single-core speed. As run on the
designated target POS terminal (owner-confirmed):

| Field | Value |
|:--|:--|
| Machine / model | LENOVO 82K2 |
| CPU (model + base clock) | AMD Ryzen 7 5800H with Radeon Graphics, MaxClockSpeed 3201 MHz |
| RAM | 13.9 GB |
| **Disk type (SSD vs HDD — load-bearing for SQLite)** | NVMe SSD — INTEL SSDPEKNW512GZL (512 GB) + Lexar SSD NM620 512 GB (both NVMe) |
| OS build | Microsoft Windows 11 Pro build 22631 (x64) |
| `better-sqlite3` version | 12.9.0 |
| Build under test | commit SHA `3461f00`; production `better-sqlite3` binding (`npm rebuild better-sqlite3` → system Node), real on-disk `.sqlite` via `npm run perf:seed` / `npx tsx scripts/perf-seed-catalogue.ts` |
| Power profile | AC / not battery-saver (owner-confirmed; exact power-plan query was denied by permissions — owner attests AC / not battery-saver) |

---

## 3. Seed recipe — a real on-disk DB at ≥ 50k rows

> The `~12-row` [`dev-seed-catalogue.ts`](../../src/main/catalogue/dev-seed-catalogue.ts)
> is for the live happy-path demo (T049b) — it is **not** this. T054 needs ≥ 50k
> rows on disk, built **through the real migration runner** so the production
> indexes from migrations `0029`/`0030` exist:
> `idx_products_tenant_sku_norm WHERE active = 1` and the barcode-norm index.
> Without those indexes the NFR-1 number is meaningless.

**Requirements for the seed (mirror the CI tests' distribution so the scenarios
are comparable):**
1. Open a **real on-disk `.sqlite`** via the production `better-sqlite3` client
   ([`src/main/db/client.ts`](../../src/main/db/client.ts)), **not** sql.js.
2. Apply **all migrations through the production runner** (so `0029`/`0030`
   indexes + pragmas are present). Confirm with `PRAGMA index_list(products)`.
3. Match production pragmas/WAL config — record `journal_mode`, `synchronous`,
   `cache_size`, `mmap_size` actually in effect (the measured DB must match how
   production opens the file).
4. Insert **≥ 50,000 active products + one barcode each** in a single
   transaction, deriving `*_norm` / `*_fold` via the **real `normalize()`**
   (never hand-typed — a divergent fold seeds a product that cannot match its
   own search). Distribution, mirroring `seedLargeCatalogue` in the CI tests:
   - most rows share a common token (`"منتج"` / `"Product N"`) so a broad search
     hits the 20-cap and `truncated = true`;
   - **one** uniquely-named row (e.g. `"زنكتابليت فريد"` / `"Zinctablet Unique"`)
     for the single-exact-match search case;
   - the exact-lookup target is a **mid-set** barcode/SKU (`floor(ROWS/2)`), not
     the first/last row (avoid measuring a fortunate cache position).
5. Optionally include a slice of inactive rows to confirm the partial
   `WHERE active = 1` index is exercised, not bypassed.

### Runnable harness — `scripts/perf-seed-catalogue.ts`

The seed + p95 harness is **authored and lint/typecheck-clean** —
[`scripts/perf-seed-catalogue.ts`](../../scripts/perf-seed-catalogue.ts), exposed as
`npm run perf:seed`. It does §3 + §4 + §5 end-to-end through the production seams
(`openDatabase` → migration runner → `createProductRepo`), folds via the real
`normalize()`, confirms the `0029`/`0030` indexes, prints the pragmas in effect,
and (with `--measure`) prints the full min/p50/p95/max per scenario. It **prints**
numbers — it never writes them into this doc; you transcribe into §5 and decide §6.

```bash
# seed a 50k-row on-disk db (no timing)
npm run perf:seed -- --rows 50000 --out ./perf-catalogue.db
# seed + run the p95 harness (1000 samples/scenario, 50 warm-up discarded)
npm run perf:seed -- --rows 50000 --measure --samples 1000
```

> **ABI prerequisite (load-bearing — do this first on the target machine).**
> `better-sqlite3`'s native binary is built for **Electron**'s Node ABI by
> `postinstall` (`electron-rebuild`). A plain `tsx`/node run uses **system** Node,
> so the binding fails to load with `NODE_MODULE_VERSION` mismatch (confirmed on
> the dev box: binding=143 vs system-node=127). Before running the harness:
> ```bash
> npm rebuild better-sqlite3          # retarget the binding to system Node
> npm run perf:seed -- --rows 50000 --measure
> npx @electron/rebuild -f -w better-sqlite3   # restore the Electron build afterward
> ```
> The script catches the load failure and prints this exact guidance rather than
> crashing raw. (Alternatively, run the seed from inside an Electron main-process
> context, where the binding loads as-is.)

---

## 4. p95 measurement protocol

For each scenario in §5, on the seeded on-disk DB:

1. **Warm-up:** run the query **≥ 20 times and discard** (the first query pays
   page-cache + prepared-statement compile cost; it is not representative).
2. **Sample:** time **N ≥ 1000** iterations with a **monotonic** timer
   (`performance.now()` / `process.hrtime.bigint()` — never `Date.now()`).
3. Record the **full distribution**, not just p95 — a p95 with a sane
   min/median is trustworthy; a p95 near a huge max signals GC / contention
   noise that must be explained:

   | Stat | Why |
   |:--|:--|
   | min | floor — best-case index hit |
   | median (p50) | typical cashier experience |
   | **p95** | **the budget gate** |
   | max | tail / noise check |

4. Run with the machine **otherwise idle** (no other heavy processes), AC power.
5. Run each scenario **twice** (fresh process) and confirm the p95s agree within
   noise — a single run can be a fluke.

---

## 5. Scenarios + results — recorded 2026-06-01 (target hardware, owner-supplied)

> Two fresh-process runs, 1000 samples/scenario, 50 warm-up discarded. Numbers
> are verbatim from the `npx tsx scripts/perf-seed-catalogue.ts --rows 50000
> --measure --samples 1000` stdout the owner supplied; all times in **ms**.

### NFR-1 — exact lookup (budget ≤ 50 ms p95)

| Scenario | Run | min | p50 | **p95** | max | Budget | Verdict |
|:--|:--|:--|:--|:--|:--|:--|:--|
| `lookupByBarcode` — mid-set hit | 1 | 0.063 | 0.068 | **0.119** | 5.176 | ≤ 50 ms | ✅ PASS |
| `lookupByBarcode` — mid-set hit | 2 | 0.064 | 0.071 | **0.137** | 1.475 | ≤ 50 ms | ✅ PASS |
| `lookupBySku` — mid-set hit | 1 | 0.042 | 0.046 | **0.078** | 6.652 | ≤ 50 ms | ✅ PASS |
| `lookupBySku` — mid-set hit | 2 | 0.043 | 0.047 | **0.089** | 6.889 | ≤ 50 ms | ✅ PASS |
| `lookupByBarcode` — absent key (not_found) | 1 | 0.048 | 0.051 | **0.097** | 0.190 | ≤ 50 ms | ✅ PASS |
| `lookupByBarcode` — absent key (not_found) | 2 | 0.049 | 0.055 | **0.160** | 8.670 | ≤ 50 ms | ✅ PASS |

**NFR-1 worst p95 across both runs = 0.160 ms ≤ 50 ms → PASS** (~300× headroom; index-served, as the spec predicted).

### NFR-2 — partial folded search (budget ≤ 150 ms p95) — **decision-critical**

The `LIKE '%q%'` scan cost is ~constant (full scan, R4) but result-set assembly +
ranking differs between a capped broad match and a narrow one:

| Scenario | Run | min | p50 | **p95** | max | Budget | Verdict |
|:--|:--|:--|:--|:--|:--|:--|:--|
| broad token → 20-cap + `truncated` (`"product"`) | 1 | 12.422 | 13.244 | **15.170** | 21.898 | ≤ 150 ms | ✅ PASS |
| broad token → 20-cap + `truncated` (`"product"`) | 2 | 12.473 | 13.139 | **15.034** | 24.887 | ≤ 150 ms | ✅ PASS |
| narrow → single match (`"zinctablet"`) | 1 | 8.517 | 8.949 | **10.087** | 16.405 | ≤ 150 ms | ✅ PASS |
| narrow → single match (`"zinctablet"`) | 2 | 8.434 | 9.121 | **10.283** | 17.735 | ≤ 150 ms | ✅ PASS |
| absent token → not_found | 1 | 8.435 | 9.083 | **10.752** | 15.866 | ≤ 150 ms | ✅ PASS |
| absent token → not_found | 2 | 7.935 | 8.956 | **9.910** | 15.414 | ≤ 150 ms | ✅ PASS |
| Arabic folded query (alef/yaa variant) | — | — | — | — | — | ≤ 150 ms | ⚠️ not emitted — see note |

**NFR-2 worst p95 across both runs = 15.170 ms ≤ 150 ms → PASS** (~10× headroom). **R-RISK-1 / FTS5-fallback review NOT triggered.**

> **Honesty note (owner-directed).** The current T054 harness
> (`scripts/perf-seed-catalogue.ts`) does **not** emit a separate Arabic-folded-query
> metric — its three NFR-2 scenarios are `broad`, `narrow`, and `absent`. No separate
> Arabic-folded p95 was produced; it is recorded here as **not emitted by the current
> harness; no separate p95 produced** — deliberately **not** fabricated. Arabic-fold
> *correctness* is covered elsewhere (SC-9 folded-variant tests + the `normalize()`
> module); only a dedicated *timing* scenario is absent. A follow-up harness extension
> can add it if the owner wants the explicit metric.

Pragmas in effect during the runs: `journal_mode=wal`, `synchronous=2` (FULL — WAL default), `foreign_keys=ON` (set by `openDatabase`). Sample size N: **1000** per scenario (50 warm-up discarded). Runs agreed within noise: **yes** (e.g. broad-search p95 15.170 vs 15.034; narrow 10.087 vs 10.283).

---

## 6. Decision gate — R-RISK-1 / FTS5 fallback

R4 chose a **precomputed normalized-fold column + `LIKE '%q%'` substring scan**
over FTS5 for the MVP. `LIKE '%q%'` is a **leading-wildcard, full-table scan** —
deliberately not index-served. R-RISK-1 is the risk that this misses NFR-2 at
50k rows.

**Trigger:** if the **NFR-2 p95 exceeds 150 ms** on target hardware (any
scenario in §5), this triggers the **R4 FTS5-fallback review** (R-RISK-1) — a
stack-amendment with rationale, per
[`quickstart.md` §perf](./quickstart.md). NFR-1 is index-served and very
unlikely to miss; if it *does*, first re-confirm the `0029`/`0030` indexes are
present on the measured DB (§3 step 2) before escalating.

| Outcome | Action |
|:--|:--|
| NFR-1 **and** NFR-2 both ≤ budget | Record numbers; feeds the §A5 sign-off as the perf evidence. |
| NFR-2 p95 > 150 ms | **Open R-RISK-1 / FTS5-fallback review** (stack amendment); §A5 stays blocked on it. |
| NFR-1 p95 > 50 ms | Re-verify indexes on the measured DB first; if still over, escalate. |

**Verdict (2026-06-01, target hardware — LENOVO 82K2, Ryzen 7 5800H, NVMe SSD):**
- **NFR-1 PASS** — worst p95 = 0.160 ms ≤ 50 ms.
- **NFR-2 PASS** — worst p95 = 15.170 ms ≤ 150 ms.
- **R-RISK-1 / FTS5-fallback review NOT triggered** — both budgets met with ample
  headroom across two within-noise runs.
- This is the **perf evidence** for §A5; it is **NOT** an §A5 sign-off. §A5 remains
  owner-gated (see §7).

---

## 7. Owner must clear (the non-CI gates)

- [x] Bring-up run on the **real target Windows terminal** (owner-confirmed: target
      POS terminal, LENOVO 82K2) with **production `better-sqlite3`** (12.9.0,
      `npm rebuild`→system Node; not sql.js). **Caveat:** run via
      `npx tsx scripts/perf-seed-catalogue.ts` (dev-build invocation of the real
      repo binding), **not** the packaged `package:dir` build. The measured path is
      the production `ProductRepo` query over a real on-disk SQLite with the real
      indexes — identical to packaged behaviour for the repo-level metric — but a
      packaged-build re-confirm is the owner's call at §A5 if desired.
- [x] Hardware spec recorded (§2), including **disk type** (NVMe SSD).
- [x] Seed built through the **real migration runner** (30 migrations applied);
      `0029`/`0030` indexes confirmed present on the measured DB
      (`idx_products_tenant_sku_norm`, `idx_product_barcodes_tenant_norm`, fold
      indexes — see the `[seed] indexes present` line).
- [x] §5 tables filled; §6 verdict decided on real numbers — **NFR-1 PASS, NFR-2 PASS**.
- [x] NFR-2 not missed → R-RISK-1 / FTS5-fallback review **NOT** needed.
- [ ] **§A5 sign-off** references this completed document as the perf evidence —
      **OWNER-GATED, not done in this PR.** §A5 remains OPEN pending owner sign-off.

---

*Authored 2026-06-01 (agent) as a scaffold; §2/§5/§6/§7 filled 2026-06-01 with
real target-hardware measurements the owner ran and supplied (two 1000-sample runs).
Methodology grounded in the as-built T028/T035 CI tests, `product-repo.ts`, the
`0029`/`0030` migrations, and spec NFR-1/NFR-2 + R4/R-RISK-1. No numbers fabricated;
the Arabic-folded timing scenario is recorded as not-emitted, not invented (§5 note).*
