import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createProductRepo } from '../../product-repo.js';
import { createReadDownWriter } from '../read-down-writer.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';

/**
 * 010 T022 (RED) — fold-parity vs 009's `product-repo.search` (SC-9).
 *
 * Rows written via the writer (fold columns computed write-time via 009's
 * `normalize()`) MUST be found by 009's read-time `search`, across the
 * Arabic/English folded-variant corpus. This proves the write-time fold == the
 * read-time fold (the load-bearing R1 contract) — if the writer composed the
 * fold differently from 009's query fold, search recall would silently break.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function row(overrides: Partial<SellableCatalogRow> = {}): SellableCatalogRow {
  return {
    product_id: 'p-1',
    sku: 'SKU-1',
    name: 'بنادول إكسترا',
    aliases: [],
    price: { amount: '15.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: 'cur-1',
    ...overrides,
  };
}

function seedAndSearch(rows: SellableCatalogRow[], query: string) {
  const db = freshCatalogueDb();
  const handle = handleFor(db);
  const writer = createReadDownWriter({
    db: handle,
    syncStateRepo: createCatalogueSyncStateRepo(handle),
  });
  writer.run({
    tenantId: TENANT,
    branchId: BRANCH,
    sourceSnapshotId: 'snap-1',
    now: '2026-06-05T10:00:00.000Z',
    rows,
  });
  const repo = createProductRepo(handle);
  const result = repo.search(TENANT, query);
  db.close();
  return result;
}

describe('T022 — fold parity (writer write-fold == 009 search read-fold)', () => {
  it('finds an Arabic product by a diacritic/alef-variant query', () => {
    // Stored name has a plain alef; query uses alef-with-hamza (أ) + a haraka.
    const r = seedAndSearch([row({ name: 'اسبرين', product_id: 'p-asp' })], 'أسبرين');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items.map((i) => i.product_id)).toContain('p-asp');
    }
  });

  it('finds a product by an Arabic-Indic numeral variant in the name', () => {
    // Stored 'فيتامين ٥٠٠' should match a Latin-digit query 'فيتامين 500'.
    const r = seedAndSearch([row({ name: 'فيتامين ٥٠٠', product_id: 'p-vit' })], 'فيتامين 500');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items.map((i) => i.product_id)).toContain('p-vit');
    }
  });

  it('finds a product by a case-variant English substring (name maps to name_ar)', () => {
    const r = seedAndSearch([row({ name: 'Panadol Extra', product_id: 'p-pan' })], 'panadol');
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items.map((i) => i.product_id)).toContain('p-pan');
    }
  });

  it('finds a product by an alias substring (alias_fold parity)', () => {
    const r = seedAndSearch(
      [row({ name: 'دواء', product_id: 'p-al', aliases: ['Ibuprofen', '6221'] })],
      'ibuprofen',
    );
    expect(r.kind).toBe('results');
    if (r.kind === 'results') {
      expect(r.items.map((i) => i.product_id)).toContain('p-al');
    }
  });
});
