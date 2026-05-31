import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Database as SqlJsDatabase } from 'sql.js';

import { createProductRepo } from '../product-repo.js';
import { createCatalogueResolver, CATALOGUE_ITEM_REF_KIND } from '../resolve-item-ref.js';
import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';

/**
 * 009 T040 — production R7 resolver satisfies the §A1-ratified 005 seam.
 *
 * The seam signature (005's LIVE `ItemRefResolver`, cart-bridge.ts:78-83) is:
 *   resolve(item_ref) →
 *     | { kind: 'ok', display_name, unit_price_minor }
 *     | { kind: 'refused', reason: 'unknown_item' | 'disabled' | 'no_connection' | 'generic' }
 * There is NO `version` field (deferred per §A1 / R9).
 *
 * The resolver maps the read model → the seam:
 *   display_name      ← products.name_ar (the single Arabic-first name, AD-6)
 *   unit_price_minor  ← products.price_minor (verbatim, integer minor units, AD-5)
 * and the refusals:
 *   unknown_item ← item_ref resolves to no product
 *   disabled     ← product exists but active = 0 (FR-18 sellable guard)
 *   generic      ← missing/corrupt required field (e.g. non-safe-integer price, FR-19)
 *
 * SECURITY: the seam passes only `{ item_ref }` — the resolver re-reads
 * price/name authoritatively from the DB; no renderer value is trusted.
 * The resolver is tenant-scoped: a tenant-A item_ref never resolves for a
 * tenant-B session (P17).
 *
 * `item_ref` = `products.product_id` (the stable 1:1 identity already on every
 * snapshot; keeps 005's merge-by-item_ref honest for FR-21).
 */

const TENANT = 'tenant-1';

let db: SqlJsDatabase | undefined;

beforeAll(async () => {
  await initCatalogueSql();
});

afterEach(() => {
  // Some cases (the pure-constant assertion) never open a db.
  if (db !== undefined) {
    db.close();
    db = undefined;
  }
});

/** Build a resolver bound to the current seeded db for the given tenant. */
function resolverFor(tenantId = TENANT) {
  if (db === undefined) throw new Error('seed db (freshCatalogueDb) before building a resolver');
  const repo = createProductRepo(handleFor(db));
  return createCatalogueResolver({ repo, getTenantId: () => tenantId });
}

describe('catalogue resolver — seam shape + ok (T040)', () => {
  it('exposes product_id as the item_ref kind', () => {
    expect(CATALOGUE_ITEM_REF_KIND).toBe('product_id');
  });

  it('resolves an active product to { kind: ok, display_name, unit_price_minor } with NO version', async () => {
    db = freshCatalogueDb();
    seedProduct(db, {
      product_id: 'p-1',
      tenant_id: TENANT,
      name_ar: 'بنادول إكسترا',
      name_en: 'Panadol Extra',
      price_minor: 1500,
      active: 1,
    });

    const resolved = await resolverFor()('p-1');

    expect(resolved).toEqual({
      kind: 'ok',
      display_name: 'بنادول إكسترا',
      unit_price_minor: 1500,
    });
    // §A1: the live seam carries no `version`.
    expect(resolved).not.toHaveProperty('version');
  });

  it('threads the Arabic name (name_ar), never the English name', async () => {
    db = freshCatalogueDb();
    seedProduct(db, {
      product_id: 'p-1',
      tenant_id: TENANT,
      name_ar: 'أسبرين',
      name_en: 'Aspirin',
      price_minor: 800,
    });

    const resolved = await resolverFor()('p-1');
    expect(resolved).toEqual({ kind: 'ok', display_name: 'أسبرين', unit_price_minor: 800 });
  });
});

describe('catalogue resolver — refusals (T040)', () => {
  it('refuses unknown_item when the item_ref resolves to no product', async () => {
    db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-1', tenant_id: TENANT });

    const resolved = await resolverFor()('p-does-not-exist');
    expect(resolved).toEqual({ kind: 'refused', reason: 'unknown_item' });
  });

  it('refuses disabled when the product exists but is inactive (FR-18)', async () => {
    db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-inactive', tenant_id: TENANT, active: 0 });

    const resolved = await resolverFor()('p-inactive');
    expect(resolved).toEqual({ kind: 'refused', reason: 'disabled' });
  });

  it('refuses generic when price_minor is not a safe integer (FR-19)', async () => {
    db = freshCatalogueDb();
    // A corrupt read-model row: price beyond Number.MAX_SAFE_INTEGER. The
    // migration CHECK(price_minor >= 0) admits it; the money guard lives here.
    seedProduct(db, {
      product_id: 'p-corrupt',
      tenant_id: TENANT,
      price_minor: Number.MAX_SAFE_INTEGER + 2,
    });

    const resolved = await resolverFor()('p-corrupt');
    expect(resolved).toEqual({ kind: 'refused', reason: 'generic' });
  });
});

describe('catalogue resolver — tenant isolation (P17)', () => {
  it('does not resolve a tenant-A product for a tenant-B session', async () => {
    db = freshCatalogueDb();
    seedProduct(db, { product_id: 'p-a', tenant_id: 'tenant-A', active: 1 });

    // The session is tenant-B; the tenant-A product must be unknown_item.
    const resolved = await resolverFor('tenant-B')('p-a');
    expect(resolved).toEqual({ kind: 'refused', reason: 'unknown_item' });
  });
});

describe('catalogue resolver — catalogue unavailable → generic (FR-24)', () => {
  it('refuses generic when the read model is unavailable (empty/unreadable)', async () => {
    db = freshCatalogueDb(); // products table empty → unavailable signal
    const resolved = await resolverFor()('p-1');
    // The seam has no `no_connection` use by 009 (local/offline); an unavailable
    // catalogue is a resolution failure → generic to the cashier (reason logged).
    expect(resolved).toEqual({ kind: 'refused', reason: 'generic' });
  });
});
