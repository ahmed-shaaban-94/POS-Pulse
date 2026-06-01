/**
 * 009 T054 — perf bring-up seed + p95 harness.
 *
 * Stands up a REAL on-disk SQLite catalogue at >= 50k rows through the
 * PRODUCTION seams (openDatabase -> migration runner -> createProductRepo),
 * then optionally times the repo queries that NFR-1 / NFR-2 bound. This is the
 * runnable companion to `specs/009-product-search-and-barcode-lookup/perf-bringup.md`
 * — it makes T054 "run + record" instead of "design + measure".
 *
 * WHY THIS IS NOT THE CI PERF TESTS (perf.exact / perf.search):
 *   Those assert correctness on sql.js under the parallel Vitest runner — by
 *   design, NO timing. The NFR-1/NFR-2 budgets are a property of the production
 *   better-sqlite3 binding on the target Windows terminal. This script uses that
 *   binding against an on-disk file so the numbers are meaningful. See §0 of the
 *   bring-up doc.
 *
 * ABI NOTE (load-bearing): better-sqlite3's native binary is rebuilt by
 * postinstall for ELECTRON's Node ABI (see src/main/db/client.ts R1). A plain
 * `tsx`/node run uses SYSTEM Node and may fail to load it with
 * NODE_MODULE_VERSION mismatch. If that happens, run against system Node's ABI:
 *     npx @electron/rebuild -f -w better-sqlite3   # for Electron (default state)
 *     npm rebuild better-sqlite3                   # to retarget system Node
 * ...or run the seed from inside an Electron main-process context. The script
 * catches the load failure and prints this guidance rather than crashing raw.
 *
 * USAGE (from repo root):
 *   npx tsx scripts/perf-seed-catalogue.ts --rows 50000 --out ./perf-catalogue.db
 *   npx tsx scripts/perf-seed-catalogue.ts --rows 50000 --measure --samples 1000
 *
 * FLAGS:
 *   --rows N        row count to seed (default 50000; NFR floor is 50k)
 *   --out PATH      on-disk db path (default ./perf-catalogue.db); deleted+recreated
 *   --measure       after seeding, run the p95 timing harness (§4/§5 of the doc)
 *   --samples N     timed iterations per scenario (default 1000); >=1000 recommended
 *   --warmup N      discarded warm-up iterations per scenario (default 50)
 *   --keep          do not delete an existing --out before seeding (resume/inspect)
 *
 * The script ONLY measures the repo-level query (prepared-statement exec + row
 * mapping). It does NOT measure render (NFR-4) or the IPC round-trip — those are
 * separate budgets per the doc. Numbers are PRINTED, never written into the doc:
 * the owner transcribes them into the §5 tables and decides the verdict.
 */

import { existsSync, rmSync } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

import type { DatabaseHandle } from '../src/main/db/client.js';
import { openDatabase } from '../src/main/db/client.js';
import { bindMigrationsDb, readMigrationsFromDisk, runMigrations } from '../src/main/db/migrate.js';
import { createProductRepo, type ProductRepo } from '../src/main/catalogue/product-repo.js';
import { normalize } from '../src/main/catalogue/normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'migrations');

const TENANT = 'tenant-1';

interface Args {
  rows: number;
  out: string;
  measure: boolean;
  samples: number;
  warmup: number;
  keep: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    rows: 50_000,
    out: path.join(REPO_ROOT, 'perf-catalogue.db'),
    measure: false,
    samples: 1000,
    warmup: 50,
    keep: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] ?? '';

    // npm's `--` separator forwarding is inconsistent across platforms/npm
    // versions — a bare `--` sometimes survives into argv. Skip it so
    // `npm run perf:seed -- --rows 50000` works regardless. (See the project
    // memory note: npm `--` is unreliable on this machine.)
    if (token === '--') continue;

    // Accept both `--rows 50000` (space form) and `--rows=50000` (equals form);
    // the equals form is robust to any npm reordering of forwarded args.
    const eq = token.indexOf('=');
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : token.slice(eq + 1);
    const next = (): string => {
      if (inlineValue !== undefined) return inlineValue;
      const v = argv[++i];
      if (v === undefined) throw new Error(`flag ${flag} needs a value`);
      return v;
    };

    if (flag === '--rows') a.rows = Number.parseInt(next(), 10);
    else if (flag === '--out') a.out = path.resolve(next());
    else if (flag === '--samples') a.samples = Number.parseInt(next(), 10);
    else if (flag === '--warmup') a.warmup = Number.parseInt(next(), 10);
    else if (flag === '--measure') a.measure = true;
    else if (flag === '--keep') a.keep = true;
    // Hard error on a genuinely unknown flag. Do NOT silently ignore: a typo'd
    // flag silently falling back to the default (e.g. 50k rows when you meant
    // something else) would corrupt the perf evidence without warning.
    else throw new Error(`unknown flag: ${token}`);
  }
  if (!Number.isInteger(a.rows) || a.rows < 1) throw new Error('--rows must be a positive integer');
  if (!Number.isInteger(a.samples) || a.samples < 1)
    throw new Error('--samples must be a positive integer');
  if (!Number.isInteger(a.warmup) || a.warmup < 0)
    throw new Error('--warmup must be a non-negative integer');
  return a;
}

/** Targets we know exist in the seeded set, for the timing scenarios. */
interface SeedTargets {
  /** A mid-set barcode (not first/last row — avoids a fortunate cache position). */
  midBarcode: string;
  /** The matching mid-set SKU. */
  midSku: string;
  /** A token most rows share -> broad search hits the 20-cap + truncated. */
  broadToken: string;
  /** A query that matches the single uniquely-named row. */
  uniqueQuery: string;
  /** A token present in no row -> not_found. */
  absentToken: string;
}

/**
 * Bulk-seed `rows` active products + one barcode each in ONE transaction, via
 * the real better-sqlite3 handle. Mirrors `seedLargeCatalogue` in the CI perf
 * tests: most rows share a common token (capped/truncated search), one
 * uniquely-named row (single-match search), mid-set exact target. `*_norm` /
 * `*_fold` are derived with the REAL normalize() — never hand-typed.
 */
function seedLargeCatalogue(db: DatabaseHandle, rows: number): SeedTargets {
  const insertProduct = db.prepare(`
    INSERT INTO products
      (product_id, tenant_id, branch_id, sku, sku_norm, name_ar, name_en, name_fold,
       aliases_json, alias_fold, price_minor, tax_category, unit_pack_label, active,
       controlled_substance, prescription_required, row_version, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `) as { run(...p: unknown[]): unknown };
  const insertBarcode = db.prepare(`
    INSERT INTO product_barcodes
      (barcode_id, product_id, tenant_id, barcode, barcode_norm, barcode_kind, created_at)
    VALUES (?,?,?,?,?,?,?)
  `) as { run(...p: unknown[]): unknown };

  const ts = '2026-05-31T00:00:00.000Z';
  const uniqueIdx = Math.floor(rows / 2);

  const seed = db.transaction(() => {
    for (let i = 0; i < rows; i++) {
      const id = String(i);
      const isUnique = i === uniqueIdx;
      const nameAr = isUnique ? 'زنكتابليت فريد' : `منتج ${id}`;
      const nameEn = isUnique ? 'Zinctablet Unique' : `Product ${id}`;
      const sku = `SKU-${id}`;
      const code = `62210${id.padStart(8, '0')}`;
      insertProduct.run(
        `p-${id}`,
        TENANT,
        null,
        sku,
        normalize(sku),
        nameAr,
        nameEn,
        normalize(`${nameAr} ${nameEn}`),
        null,
        null,
        100 + (i % 1000),
        'standard',
        null,
        1,
        0,
        0,
        'v1',
        ts,
        ts,
      );
      insertBarcode.run(`bc-${id}`, `p-${id}`, TENANT, code, normalize(code), 'unit', ts);
    }
  });
  seed();

  const mid = String(uniqueIdx);
  return {
    midBarcode: `62210${mid.padStart(8, '0')}`,
    midSku: `SKU-${mid}`,
    broadToken: 'product',
    uniqueQuery: 'zinctablet',
    absentToken: 'zzzznomatchanywhere',
  };
}

interface Stats {
  min: number;
  p50: number;
  p95: number;
  max: number;
}

function stats(samplesMs: number[]): Stats {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  if (sorted.length === 0) return { min: 0, p50: 0, p95: 0, max: 0 };
  const at = (q: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[idx] ?? 0;
  };
  return { min: sorted[0] ?? 0, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0 };
}

/** Time one repo call `fn` over warmup (discarded) + samples (recorded) runs. */
function timeScenario(fn: () => void, warmup: number, samples: number): Stats {
  for (let i = 0; i < warmup; i++) fn();
  const ms: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    fn();
    ms.push(performance.now() - t0);
  }
  return stats(ms);
}

function fmt(s: Stats): string {
  const r = (n: number): string => n.toFixed(3).padStart(8);
  return `min ${r(s.min)} | p50 ${r(s.p50)} | p95 ${r(s.p95)} | max ${r(s.max)}  (ms)`;
}

function measure(repo: ProductRepo, t: SeedTargets, warmup: number, samples: number): void {
  console.log(
    `\n=== p95 harness — ${String(samples)} samples / scenario, ${String(warmup)} warm-up discarded ===`,
  );
  console.log(
    '=== repo-level query only (NOT render / NOT IPC). Budgets: NFR-1 <=50ms, NFR-2 <=150ms p95 ===\n',
  );

  console.log('--- NFR-1 exact lookup (budget <=50ms p95) ---');
  console.log(
    'lookupByBarcode mid-set : ' +
      fmt(timeScenario(() => repo.lookupByBarcode(TENANT, t.midBarcode), warmup, samples)),
  );
  console.log(
    'lookupBySku     mid-set : ' +
      fmt(timeScenario(() => repo.lookupBySku(TENANT, t.midSku), warmup, samples)),
  );
  console.log(
    'lookupByBarcode absent  : ' +
      fmt(timeScenario(() => repo.lookupByBarcode(TENANT, 'no-such-barcode'), warmup, samples)),
  );

  console.log('\n--- NFR-2 partial search (budget <=150ms p95) — decision-critical ---');
  console.log(
    'broad -> 20-cap+trunc   : ' +
      fmt(timeScenario(() => repo.search(TENANT, t.broadToken), warmup, samples)),
  );
  console.log(
    'narrow -> single match  : ' +
      fmt(timeScenario(() => repo.search(TENANT, t.uniqueQuery), warmup, samples)),
  );
  console.log(
    'absent -> not_found     : ' +
      fmt(timeScenario(() => repo.search(TENANT, t.absentToken), warmup, samples)),
  );

  console.log("\nTranscribe these into perf-bringup.md §5. Verdict is the owner's call.");
  console.log('If any NFR-2 p95 > 150ms -> open R-RISK-1 / FTS5-fallback review.');
}

function openWithAbiGuard(dbPath: string): DatabaseHandle {
  try {
    return openDatabase(dbPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/NODE_MODULE_VERSION|was compiled against a different Node|invalid ELF|\.node/.test(msg)) {
      console.error('\n[ABI] better-sqlite3 failed to load — native binding ABI mismatch.');
      console.error(
        '[ABI] It is built for ELECTRON by postinstall; a plain tsx/node run uses system Node.',
      );
      console.error(
        '[ABI] Fix: `npm rebuild better-sqlite3` (system Node), then re-run this script;',
      );
      console.error(
        '[ABI] afterwards `npx @electron/rebuild -f -w better-sqlite3` to restore the Electron build.',
      );
      console.error(`[ABI] underlying error: ${msg}\n`);
    }
    throw err;
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (existsSync(args.out) && !args.keep) {
    rmSync(args.out, { force: true });
    // WAL sidecars from a prior run.
    rmSync(`${args.out}-wal`, { force: true });
    rmSync(`${args.out}-shm`, { force: true });
  }

  console.log(`[seed] opening on-disk db: ${args.out}`);
  const db = openWithAbiGuard(args.out);

  try {
    // Pragmas applied by openDatabase: journal_mode=WAL, foreign_keys=ON
    // (matches production). Record what is actually in effect for the doc §3/§5.
    const journal = db.pragma('journal_mode', { simple: true });
    const synchronous = db.pragma('synchronous', { simple: true });
    console.log(
      `[seed] pragmas in effect: journal_mode=${String(journal)} synchronous=${String(synchronous)}`,
    );

    console.log('[seed] applying migrations through the production runner...');
    const files = readMigrationsFromDisk(MIGRATIONS_DIR);
    runMigrations({ db: bindMigrationsDb(db), files });
    console.log(`[seed] migrations applied: ${String(files.length)} files`);

    // Confirm the NFR-relied-on indexes exist on THIS db (doc §3 step 2).
    const idx = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('products','product_barcodes')`,
    ) as {
      all(): Array<{ name: string }>;
    };
    const idxNames = idx.all().map((r) => r.name);
    console.log(`[seed] indexes present: ${idxNames.join(', ') || '(none)'}`);

    console.log(
      `[seed] seeding ${String(args.rows)} products + barcodes (real normalize() folds)...`,
    );
    const t0 = performance.now();
    const targets = seedLargeCatalogue(db, args.rows);
    console.log(
      `[seed] seeded ${String(args.rows)} rows in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
    );

    if (args.measure) {
      const repo = createProductRepo(db);
      measure(repo, targets, args.warmup, args.samples);
    } else {
      console.log(
        '\n[seed] done. Re-run with --measure to time NFR-1/NFR-2, or open the db with the repo.',
      );
    }
  } finally {
    db.close();
  }
}

main();
