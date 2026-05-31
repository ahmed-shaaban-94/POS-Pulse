import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';
import { normalize } from '../normalize.js';

/**
 * 009 T031a (RED, C2) — alias-only search.
 *
 * FR-13: a query that matches `alias_fold` but NOT `name_fold` MUST still
 * surface the product. Aliases are also where a cross-script / transliterated
 * common name lives (FR-12a) — e.g. an Arabic-script common name for a product
 * whose primary name is English-only.
 *
 * `alias_fold` is the fold of the product's aliases; the fixture does not derive
 * it automatically (aliases_json is free-form), so these tests set both
 * `aliases_json` (provenance) and `alias_fold` (the searched column) explicitly
 * via `normalize()`.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';

function ids(r: ReturnType<ReturnType<typeof createProductRepo>['search']>): string[] {
  return r.kind === 'results' ? r.items.map((p) => p.product_id) : [];
}

describe('T031a — alias-only search (FR-13 / C2)', () => {
  it('matches a query present in alias_fold but absent from name_fold', () => {
    const db = freshCatalogueDb();
    seedProduct(db, {
      product_id: 'p-1',
      name_ar: 'باراسيتامول',
      name_en: 'Paracetamol',
      aliases_json: JSON.stringify(['Panadol', 'Tylenol']),
      alias_fold: normalize('Panadol Tylenol'),
    });
    const repo = createProductRepo(handleFor(db));

    // "tylenol" is only in the alias, not the name.
    expect(ids(repo.search(TENANT, 'tylenol'))).toEqual(['p-1']);
    db.close();
  });

  it('resolves a cross-script (Arabic) common name carried in the alias for an English-named product', () => {
    const db = freshCatalogueDb();
    seedProduct(db, {
      product_id: 'p-1',
      name_ar: 'ايبوبروفين',
      name_en: 'Ibuprofen',
      aliases_json: JSON.stringify(['بروفين']),
      alias_fold: normalize('بروفين'),
    });
    const repo = createProductRepo(handleFor(db));

    // The Arabic common-name "بروفين" lives only in the alias.
    expect(ids(repo.search(TENANT, 'بروفين'))).toEqual(['p-1']);
    db.close();
  });

  it('a product with no aliases (null alias_fold) is unaffected and not matched by alias queries', () => {
    const db = freshCatalogueDb();
    seedProduct(db, {
      product_id: 'p-noalias',
      name_en: 'Aspirin',
      aliases_json: null,
      alias_fold: null,
    });
    const repo = createProductRepo(handleFor(db));

    // Name still matches; an alias-only term does not, and NULL alias_fold
    // must not throw or match-all.
    expect(ids(repo.search(TENANT, 'aspirin'))).toEqual(['p-noalias']);
    expect(repo.search(TENANT, 'tylenol').kind).toBe('not_found');
    db.close();
  });
});
