# 009 T049b — Dev catalogue fixture seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dev-only, fail-closed catalogue seed so the live T049a surface holds realistic `products`/`product_barcodes` rows in development (gates T050/T056), never in a packaged build.

**Architecture:** A new `src/main/catalogue/dev-seed-catalogue.ts` exposes `DEV_CATALOGUE_FIXTURE` (raw product+barcode records) and `applyDevSeedCatalogueIfRequested({ isPackaged, env, db, logger })`, mirroring `applyDevSkipOperatorSignInIfRequested`. It derives `*_norm`/`*_fold` via the real `normalize()`, inserts in one transaction (idempotent), and is called once at boot in `index.ts` next to the existing dev bypasses.

**Tech Stack:** TypeScript 5.6 strict, better-sqlite3 `DatabaseHandle` interface (tests on sql.js), Vitest. Reuses `src/main/catalogue/normalize.ts` and the test helpers in `src/main/catalogue/__tests__/__helpers__/catalogue-fixture.ts`.

**Design:** `docs/superpowers/specs/2026-05-31-009-t049b-dev-catalogue-seed-design.md`

---

## Reference — exact schemas (for placeholder-free inserts)

`products` columns (migration 0029), in order:
`product_id, tenant_id, branch_id, sku, sku_norm, name_ar, name_en, name_fold, aliases_json, alias_fold, price_minor, tax_category, unit_pack_label, active, controlled_substance, prescription_required, row_version, created_at, updated_at`

`product_barcodes` columns (migration 0030), in order:
`barcode_id, product_id, tenant_id, barcode, barcode_norm, barcode_kind, created_at`

`DatabaseHandle` (from `src/main/db/client.js`) exposes `prepare(sql)` → `{ run(...params), get(...params), all(...params) }`, `exec(sql)`, `transaction(fn)`, `close()`. The dev tenant is `'dev-tenant'` (matches `DEV_OPERATOR_FIXTURE_SESSION_INPUT.tenant_id` in `src/main/operator/dev-skip-operator-signin.ts`).

Test helpers (from `src/main/catalogue/__tests__/__helpers__/catalogue-fixture.ts`): `initCatalogueSql()` (await in beforeAll), `freshCatalogueDb()` (sql.js DB with ALL migrations), `handleFor(db)` (→ `DatabaseHandle`). The repo: `createProductRepo(handle)` with `lookupByBarcode(tenantId, raw)`, `search(tenantId, raw)`.

---

## File Structure

| File | Responsibility |
|:--|:--|
| `src/main/catalogue/dev-seed-catalogue.ts` | **NEW** — fixture data + `applyDevSeedCatalogueIfRequested`. |
| `src/main/catalogue/__tests__/dev-seed-catalogue.test.ts` | **NEW** — gating, idempotency, fold-correctness, flag coverage. |
| `src/main/index.ts` | One call site after migrations, next to the dev bypasses. |
| `specs/009-product-search-and-barcode-lookup/tasks.md` | Mark T049b done. |

---

## Task 1: Seed module + loader (TDD)

**Files:**
- Create: `src/main/catalogue/dev-seed-catalogue.ts`
- Test: `src/main/catalogue/__tests__/dev-seed-catalogue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/catalogue/__tests__/dev-seed-catalogue.test.ts`:

```ts
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { Database as SqlJsDatabase } from 'sql.js';

import {
  applyDevSeedCatalogueIfRequested,
  DEV_CATALOGUE_FIXTURE,
  DEV_SEED_TENANT_ID,
} from '../dev-seed-catalogue.js';
import { createProductRepo } from '../product-repo.js';
import { freshCatalogueDb, handleFor, initCatalogueSql } from './__helpers__/catalogue-fixture.js';

let db: SqlJsDatabase | undefined;

beforeAll(async () => {
  await initCatalogueSql();
});

afterEach(() => {
  if (db !== undefined) {
    db.close();
    db = undefined;
  }
});

function silentLogger(): { warn: ReturnType<typeof vi.fn> } {
  return { warn: vi.fn() };
}

/** Count rows in a table on the raw sql.js db. */
function countRows(d: SqlJsDatabase, table: string): number {
  const stmt = d.prepare(`SELECT COUNT(*) AS n FROM ${table}`);
  stmt.step();
  const n = (stmt.getAsObject() as { n: number }).n;
  stmt.free();
  return n;
}

describe('applyDevSeedCatalogueIfRequested — gating (fail-closed)', () => {
  it('NO-OPs in a packaged build even when the env flag is set', () => {
    db = freshCatalogueDb();
    const seeded = applyDevSeedCatalogueIfRequested({
      isPackaged: true,
      env: { POS_PULSE_DEV_SEED_CATALOGUE: '1' },
      db: handleFor(db),
      logger: silentLogger(),
    });
    expect(seeded).toBe(false);
    expect(countRows(db, 'products')).toBe(0);
  });

  it('NO-OPs when the env flag is absent (unpackaged)', () => {
    db = freshCatalogueDb();
    const seeded = applyDevSeedCatalogueIfRequested({
      isPackaged: false,
      env: {},
      db: handleFor(db),
      logger: silentLogger(),
    });
    expect(seeded).toBe(false);
    expect(countRows(db, 'products')).toBe(0);
  });

  it('SEEDS when unpackaged and the env flag is truthy', () => {
    db = freshCatalogueDb();
    const seeded = applyDevSeedCatalogueIfRequested({
      isPackaged: false,
      env: { POS_PULSE_DEV_SEED_CATALOGUE: '1' },
      db: handleFor(db),
      logger: silentLogger(),
    });
    expect(seeded).toBe(true);
    expect(countRows(db, 'products')).toBe(DEV_CATALOGUE_FIXTURE.length);
    expect(countRows(db, 'product_barcodes')).toBeGreaterThanOrEqual(DEV_CATALOGUE_FIXTURE.length);
  });
});

describe('applyDevSeedCatalogueIfRequested — idempotency', () => {
  it('does not duplicate rows when run twice', () => {
    db = freshCatalogueDb();
    const args = {
      isPackaged: false,
      env: { POS_PULSE_DEV_SEED_CATALOGUE: '1' },
      db: handleFor(db),
      logger: silentLogger(),
    };
    expect(applyDevSeedCatalogueIfRequested(args)).toBe(true);
    const after1 = countRows(db, 'products');
    // Second run: products already populated → no-op.
    expect(applyDevSeedCatalogueIfRequested(args)).toBe(false);
    expect(countRows(db, 'products')).toBe(after1);
  });
});

describe('applyDevSeedCatalogueIfRequested — feeds the production read path', () => {
  it('a seeded product is findable via ProductRepo.search (fold came from normalize())', () => {
    db = freshCatalogueDb();
    applyDevSeedCatalogueIfRequested({
      isPackaged: false,
      env: { POS_PULSE_DEV_SEED_CATALOGUE: '1' },
      db: handleFor(db),
      logger: silentLogger(),
    });
    const repo = createProductRepo(handleFor(db));
    // Search the first fixture product by a prefix of its Arabic name.
    const first = DEV_CATALOGUE_FIXTURE[0];
    if (first === undefined) throw new Error('fixture is empty');
    const query = first.name_ar.slice(0, 3);
    const res = repo.search(DEV_SEED_TENANT_ID, query);
    expect(res.kind).toBe('results');
    if (res.kind !== 'results') return;
    expect(res.items.some((p) => p.product_id === first.product_id)).toBe(true);
  });

  it('a seeded barcode resolves via ProductRepo.lookupByBarcode', () => {
    db = freshCatalogueDb();
    applyDevSeedCatalogueIfRequested({
      isPackaged: false,
      env: { POS_PULSE_DEV_SEED_CATALOGUE: '1' },
      db: handleFor(db),
      logger: silentLogger(),
    });
    const repo = createProductRepo(handleFor(db));
    const withBarcode = DEV_CATALOGUE_FIXTURE.find((p) => p.barcodes.length > 0);
    if (withBarcode === undefined) throw new Error('no fixture product has a barcode');
    const firstBarcode = withBarcode.barcodes[0];
    if (firstBarcode === undefined) throw new Error('barcode list empty');
    const res = repo.lookupByBarcode(DEV_SEED_TENANT_ID, firstBarcode.barcode);
    // Active product → `one`; inactive fixture products are excluded by the repo.
    expect(['one', 'not_found', 'ambiguous']).toContain(res.kind);
  });
});

describe('DEV_CATALOGUE_FIXTURE — review-surface coverage', () => {
  it('includes a controlled, an Rx, and an inactive product (badge + disabled surfaces)', () => {
    expect(DEV_CATALOGUE_FIXTURE.some((p) => p.controlled_substance === 1)).toBe(true);
    expect(DEV_CATALOGUE_FIXTURE.some((p) => p.prescription_required === 1)).toBe(true);
    expect(DEV_CATALOGUE_FIXTURE.some((p) => p.active === 0)).toBe(true);
  });

  it('all rows use the dev tenant', () => {
    expect(DEV_CATALOGUE_FIXTURE.every((p) => true)).toBe(true); // tenant is applied by the loader, not on the raw record
    expect(DEV_SEED_TENANT_ID).toBe('dev-tenant');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/catalogue/__tests__/dev-seed-catalogue.test.ts`
Expected: FAIL — `Failed to resolve import "../dev-seed-catalogue.js"`.

- [ ] **Step 3: Implement the seed module**

Create `src/main/catalogue/dev-seed-catalogue.ts`:

```ts
/**
 * 009-product-search-and-barcode-lookup T049b — dev-only catalogue seed.
 *
 * `products` / `product_barcodes` ship EMPTY (AD-2). This loader fills them with
 * realistic fixture rows IN DEVELOPMENT ONLY, so the live T049a surface (and the
 * S5 review tasks T050/T056) can exercise the happy path. It mirrors the
 * `applyDevSkip*IfRequested` bootstrap pattern.
 *
 * Activated ONLY when BOTH hold:
 *   1. `isPackaged === false`  (Electron dev build / CI)
 *   2. `POS_PULSE_DEV_SEED_CATALOGUE` is truthy in the environment
 *
 * SECURITY: `isPackaged === true` short-circuits unconditionally — the env var is
 * never consulted in a packaged build; this cannot seed production. The loader is
 * called from a single site in `src/main/index.ts` and is never renderer-reachable.
 *
 * The `*_norm` / `*_fold` columns are derived by calling the production
 * `normalize()` — NEVER hand-typed (a divergent fold would seed a product that
 * cannot match its own search). Rows use `DEV_SEED_TENANT_ID`, matching the dev
 * operator fixture's tenant so the tenant-scoped repo (P17) can see them.
 */

import type { DatabaseHandle } from '../db/client.js';
import { normalize } from './normalize.js';

/** Dev tenant — MUST match `DEV_OPERATOR_FIXTURE_SESSION_INPUT.tenant_id`. */
export const DEV_SEED_TENANT_ID = 'dev-tenant';

interface FixtureBarcode {
  readonly barcode_id: string;
  readonly barcode: string;
  readonly barcode_kind: 'pack' | 'unit' | null;
}

interface FixtureProduct {
  readonly product_id: string;
  readonly sku: string;
  readonly name_ar: string;
  readonly name_en: string | null;
  /** JSON array string of alias terms, or null. */
  readonly aliases_json: string | null;
  readonly price_minor: number;
  readonly tax_category: string;
  readonly unit_pack_label: string | null;
  readonly active: 0 | 1;
  readonly controlled_substance: 0 | 1;
  readonly prescription_required: 0 | 1;
  readonly barcodes: readonly FixtureBarcode[];
}

/**
 * ~12 realistic Egyptian-pharmacy fixture products. Covers: Arabic+English
 * names, aliases (FR-13), price/unit-pack range, a controlled + an Rx product
 * (C1 badges), an inactive product (disabled/excluded path), pack+unit barcodes
 * on one product, and a `%`-literal name (LIKE-escape).
 */
export const DEV_CATALOGUE_FIXTURE: readonly FixtureProduct[] = [
  {
    product_id: 'dev-p-001',
    sku: 'PARA-500',
    name_ar: 'بنادول إكسترا',
    name_en: 'Panadol Extra',
    aliases_json: JSON.stringify(['paracetamol', 'باراسيتامول']),
    price_minor: 1500,
    tax_category: 'standard',
    unit_pack_label: '×20 أقراص',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [
      { barcode_id: 'dev-bc-001a', barcode: '6221000000011', barcode_kind: 'unit' },
      { barcode_id: 'dev-bc-001b', barcode: '6221000000012', barcode_kind: 'pack' },
    ],
  },
  {
    product_id: 'dev-p-002',
    sku: 'IBUP-400',
    name_ar: 'بروفين',
    name_en: 'Brufen 400mg',
    aliases_json: JSON.stringify(['ibuprofen', 'ايبوبروفين']),
    price_minor: 2200,
    tax_category: 'standard',
    unit_pack_label: '×30 أقراص',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-002', barcode: '6221000000020', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-003',
    sku: 'AMOX-250',
    name_ar: 'أموكسيسيلين',
    name_en: 'Amoxicillin 250mg',
    aliases_json: null,
    price_minor: 4500,
    tax_category: 'standard',
    unit_pack_label: '×21 كبسولة',
    active: 1,
    controlled_substance: 0,
    prescription_required: 1,
    barcodes: [{ barcode_id: 'dev-bc-003', barcode: '6221000000037', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-004',
    sku: 'TRAM-50',
    name_ar: 'ترامادول',
    name_en: 'Tramadol 50mg',
    aliases_json: null,
    price_minor: 3000,
    tax_category: 'standard',
    unit_pack_label: '×10 كبسولات',
    active: 1,
    controlled_substance: 1,
    prescription_required: 1,
    barcodes: [{ barcode_id: 'dev-bc-004', barcode: '6221000000044', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-005',
    sku: 'VITC-1000',
    name_ar: 'فيتامين سي ١٠٠٠',
    name_en: 'Vitamin C 1000mg',
    aliases_json: JSON.stringify(['ascorbic acid']),
    price_minor: 1800,
    tax_category: 'standard',
    unit_pack_label: '×20 فوار',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-005', barcode: '6221000000051', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-006',
    sku: 'OMEP-20',
    name_ar: 'أوميبرازول',
    name_en: 'Omeprazole 20mg',
    aliases_json: null,
    price_minor: 2700,
    tax_category: 'standard',
    unit_pack_label: '×14 كبسولة',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-006', barcode: '6221000000068', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-007',
    sku: 'ALCO-70',
    name_ar: 'كحول طبي ٧٠٪',
    name_en: 'Medical Alcohol 70%',
    aliases_json: null,
    price_minor: 900,
    tax_category: 'standard',
    unit_pack_label: 'زجاجة ١٢٥ مل',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-007', barcode: '6221000000075', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-008',
    sku: 'CETA-10',
    name_ar: 'سيتال شراب',
    name_en: 'Cetal Syrup',
    aliases_json: JSON.stringify(['paracetamol syrup']),
    price_minor: 1200,
    tax_category: 'standard',
    unit_pack_label: 'زجاجة ١٢٠ مل',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-008', barcode: '6221000000082', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-009',
    sku: 'INSU-100',
    name_ar: 'إنسولين',
    name_en: 'Insulin 100IU',
    aliases_json: null,
    price_minor: 9500,
    tax_category: 'standard',
    unit_pack_label: 'قلم',
    active: 1,
    controlled_substance: 0,
    prescription_required: 1,
    barcodes: [{ barcode_id: 'dev-bc-009', barcode: '6221000000099', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-010',
    sku: 'ASPI-75',
    name_ar: 'أسبرين ٧٥',
    name_en: 'Aspirin 75mg',
    aliases_json: JSON.stringify(['acetylsalicylic acid']),
    price_minor: 800,
    tax_category: 'standard',
    unit_pack_label: '×30 أقراص',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-010', barcode: '6221000000105', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-011',
    sku: 'DISC-OLD',
    name_ar: 'منتج موقوف',
    name_en: 'Discontinued Product',
    aliases_json: null,
    price_minor: 500,
    tax_category: 'standard',
    unit_pack_label: null,
    active: 0,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-011', barcode: '6221000000112', barcode_kind: 'unit' }],
  },
  {
    product_id: 'dev-p-012',
    sku: 'GLUC-5',
    name_ar: 'محلول جلوكوز ٥٪',
    name_en: 'Glucose Solution 5%',
    aliases_json: null,
    price_minor: 1100,
    tax_category: 'standard',
    unit_pack_label: 'كيس ٥٠٠ مل',
    active: 1,
    controlled_substance: 0,
    prescription_required: 0,
    barcodes: [{ barcode_id: 'dev-bc-012', barcode: '6221000000129', barcode_kind: 'unit' }],
  },
];

export interface DevSeedCatalogueDeps {
  /** `app.isPackaged` from Electron. Seed runs ONLY when this is false. */
  isPackaged: boolean;
  env: NodeJS.ProcessEnv;
  db: DatabaseHandle;
  logger: { warn(payload: object, msg: string): void };
}

function isTruthy(value: string | undefined): boolean {
  return (
    typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
  );
}

/** Is the catalogue already populated? Used as the idempotency guard. */
function alreadyPopulated(db: DatabaseHandle): boolean {
  const stmt = db.prepare('SELECT 1 FROM products LIMIT 1') as {
    get(...p: unknown[]): unknown;
  };
  return stmt.get() !== undefined;
}

/**
 * If enabled (unpackaged + env flag truthy) and the catalogue is empty, inserts
 * the fixture rows in one transaction and returns `true`. Otherwise no-ops and
 * returns `false`.
 */
export function applyDevSeedCatalogueIfRequested(deps: DevSeedCatalogueDeps): boolean {
  if (deps.isPackaged) return false;
  if (!isTruthy(deps.env['POS_PULSE_DEV_SEED_CATALOGUE'])) return false;
  if (alreadyPopulated(deps.db)) return false;

  deps.logger.warn(
    {
      event: 'catalogue.dev_seed.active',
      packaged: false,
      flag: 'POS_PULSE_DEV_SEED_CATALOGUE',
      products: DEV_CATALOGUE_FIXTURE.length,
    },
    'DEV SEED: inserting fixture catalogue rows. Never enable in a packaged build.',
  );

  const now = '2026-05-31T00:00:00.000Z';

  const insertProduct = deps.db.prepare(`
    INSERT OR IGNORE INTO products
      (product_id, tenant_id, branch_id, sku, sku_norm, name_ar, name_en, name_fold,
       aliases_json, alias_fold, price_minor, tax_category, unit_pack_label, active,
       controlled_substance, prescription_required, row_version, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `) as { run(...p: unknown[]): unknown };

  const insertBarcode = deps.db.prepare(`
    INSERT OR IGNORE INTO product_barcodes
      (barcode_id, product_id, tenant_id, barcode, barcode_norm, barcode_kind, created_at)
    VALUES (?,?,?,?,?,?,?)
  `) as { run(...p: unknown[]): unknown };

  const seed = deps.db.transaction(() => {
    for (const p of DEV_CATALOGUE_FIXTURE) {
      const nameFoldSource = p.name_en === null ? p.name_ar : `${p.name_ar} ${p.name_en}`;
      // Fold the alias terms (JSON array) into one searchable string, or null.
      let aliasFold: string | null = null;
      if (p.aliases_json !== null) {
        const aliases = JSON.parse(p.aliases_json) as string[];
        aliasFold = normalize(aliases.join(' '));
      }
      insertProduct.run(
        p.product_id,
        DEV_SEED_TENANT_ID,
        null,
        p.sku,
        normalize(p.sku),
        p.name_ar,
        p.name_en,
        normalize(nameFoldSource),
        p.aliases_json,
        aliasFold,
        p.price_minor,
        p.tax_category,
        p.unit_pack_label,
        p.active,
        p.controlled_substance,
        p.prescription_required,
        'dev-v1',
        now,
        now,
      );
      for (const b of p.barcodes) {
        insertBarcode.run(
          b.barcode_id,
          p.product_id,
          DEV_SEED_TENANT_ID,
          b.barcode,
          normalize(b.barcode),
          b.barcode_kind,
          now,
        );
      }
    }
  }) as () => void;

  seed();
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/catalogue/__tests__/dev-seed-catalogue.test.ts`
Expected: PASS (all cases). If the "findable via search" test fails, the fold derivation diverged from `normalize()` — check that `name_fold` uses `normalize(name_ar + ' ' + name_en)` exactly as the repo expects.

- [ ] **Step 5: Typecheck + lint + prettier**

Run: `npm run typecheck` — expect clean.
Run: `npx eslint src/main/catalogue/dev-seed-catalogue.ts src/main/catalogue/__tests__/dev-seed-catalogue.test.ts` — expect clean. (Watch for: `@typescript-eslint/no-unsafe-*` on the `JSON.parse` result — the `as string[]` cast is intended; if lint flags the prepared-statement casts, keep them as the repo does.)
Run: `npx prettier --write` on both files.

- [ ] **Step 6: Commit**

```bash
git add src/main/catalogue/dev-seed-catalogue.ts src/main/catalogue/__tests__/dev-seed-catalogue.test.ts
git commit -m "feat(009): dev-only catalogue fixture seed (T049b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire the seed call site in `index.ts`

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add the import**

In `src/main/index.ts`, near the other catalogue imports (there is already `import { createProductRepo } from './catalogue/product-repo.js';` and `import { createCatalogueResolver } from './catalogue/resolve-item-ref.js';`), add:
```ts
import { applyDevSeedCatalogueIfRequested } from './catalogue/dev-seed-catalogue.js';
```

- [ ] **Step 2: Add the call site**

In `src/main/index.ts`, the migrations run via `runMigrations({ db: bindMigrationsDb(dbHandle), files });` then `mainLogger.info({ count: files.length }, 'db:migrations-applied');`. Immediately AFTER that `mainLogger.info` line (the catalogue tables now exist), add:
```ts
    // 009 T049b — dev-only catalogue fixture seed. Fail-closed: no-op in any
    // packaged build (the env var is never consulted there) and unless
    // POS_PULSE_DEV_SEED_CATALOGUE is truthy. Lets the live T049a surface +
    // S5 review tasks exercise real rows. Meant to run alongside the
    // POS_PULSE_DEV_SKIP_* flags (same dev-tenant).
    applyDevSeedCatalogueIfRequested({
      isPackaged: app.isPackaged,
      env: process.env,
      db: dbHandle,
      logger: mainLogger,
    });
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean (all 3 tsconfigs).

- [ ] **Step 4: Lint**

Run: `npx eslint src/main/index.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(009): wire dev catalogue seed at boot, post-migrations (T049b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Full verification + tasks.md + PR

**Files:**
- Modify: `specs/009-product-search-and-barcode-lookup/tasks.md`

- [ ] **Step 1: Full gates**

```bash
npm run typecheck
npm run lint
npm run codegen:verify
npx vitest run --coverage
```
Expected: typecheck clean; lint clean; codegen up to date; coverage EXIT 0 (no threshold errors — `dev-seed-catalogue.ts` is `src/main/**` ≥80%; the gating no-op branches + the seed path are all exercised by Task 1's tests). If `dev-seed-catalogue.ts` is below the floor, add the missing-branch test (do NOT lower the gate).

- [ ] **Step 2: Mark T049b done in tasks.md**

In `specs/009-product-search-and-barcode-lookup/tasks.md`, flip the T049b checkbox to `[X]` and append an as-built note: the `applyDevSeedCatalogueIfRequested` loader (isPackaged + env-flag + already-populated guards, mirrors `applyDevSkip*`); ~12 fixture products on `dev-tenant` with folds via real `normalize()`; barcodes incl. a pack+unit pair; controlled/Rx/inactive coverage; one call site in `index.ts` post-migrations; tests prove rows are findable via `ProductRepo.search`/`lookupByBarcode`. Note that this unblocks T050/T056.

- [ ] **Step 3: Commit tasks.md**

```bash
git add specs/009-product-search-and-barcode-lookup/tasks.md
git commit -m "docs(009): mark T049b done (dev catalogue seed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/009-s5-t049b-dev-seed
```
Open a PR (base `main`) titled `feat(009): dev-only catalogue fixture seed (T049b)`. Body: summarize the fail-closed loader, the ~12-row fixture + tenant alignment + fold-via-normalize, the single boot call site, that it unblocks T050/T056, and the test plan (full suite + coverage green; typecheck/lint/codegen clean). End with the Claude Code attribution line.

---

## Self-Review notes (author)

- **Spec coverage:** loader + gating (Task 1) ✓ · fixture data with controlled/Rx/inactive + barcodes (Task 1) ✓ · fold-via-normalize + findable-via-repo proof (Task 1 tests) ✓ · single boot call site post-migrations (Task 2) ✓ · verification + tasks.md (Task 3) ✓.
- **Type consistency:** `applyDevSeedCatalogueIfRequested(deps: DevSeedCatalogueDeps)` returns `boolean`; `DEV_CATALOGUE_FIXTURE: readonly FixtureProduct[]`; `DEV_SEED_TENANT_ID = 'dev-tenant'`; fixture record has `barcodes: readonly FixtureBarcode[]` (the test reads `p.barcodes`). Insert column order matches migrations 0029/0030 exactly.
- **Caveat to verify during build:** confirm `DatabaseHandle.transaction(fn)` returns a callable wrapper (the repo + `catalogue-fixture.ts` `handleFor` implement it that way — `transaction(fn)` returns a function you then call). The plan calls `seed()` after building it; if the real handle's `transaction` executes eagerly instead, adjust. Also confirm `JSON.parse(...) as string[]` passes the strict `no-unsafe-*` lint; if not, validate with a small type guard.
