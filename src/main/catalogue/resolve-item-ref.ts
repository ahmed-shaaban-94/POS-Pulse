/**
 * 009-product-search-and-barcode-lookup T041 — production R7 resolver.
 *
 * Wires a real catalogue resolver behind 005's FIXED `cart.resolveItemRef` seam
 * (contracts/resolver-seam.md). 005 stubbed this with a fixture and left it
 * unwired in production; 009 supplies the real read-model-backed resolver,
 * satisfying the LIVE signature WITHOUT changing it (005's fixture tests stay
 * green):
 *
 *   resolve(item_ref) →
 *     | { kind: 'ok', display_name, unit_price_minor }
 *     | { kind: 'refused', reason: 'unknown_item' | 'disabled' | 'no_connection' | 'generic' }
 *
 * **§A1: no `version` field** — the live seam never carried it (deferred per R9;
 * `products.row_version` stays in the read model, unconsumed).
 *
 * Field mapping (read model → seam):
 *   display_name      ← products.name_ar (the single Arabic-first name, AD-6)
 *   unit_price_minor  ← products.price_minor (verbatim, integer minor units, AD-5)
 *
 * Refusal mapping:
 *   unknown_item ← item_ref resolves to no product (FR-?)
 *   disabled     ← product exists but active = false (FR-18 sellable guard)
 *   generic      ← missing/corrupt required field (non-safe-integer price, FR-19)
 *                  OR an unavailable catalogue (empty/unreadable) — local lookup
 *                  has no `no_connection` use; an unresolvable read is generic to
 *                  the cashier (reason logged).
 *
 * SECURITY: the seam passes only `{ item_ref }`. The resolver re-reads
 * `name_ar` / `price_minor` AUTHORITATIVELY from the DB; no renderer-supplied
 * price or name is ever trusted (mirrors 005 S2 R7-SEAM). Tenant-scoped: the
 * `getTenantId` closure binds the live session's tenant (P17) — a tenant-A
 * `item_ref` never resolves for a tenant-B session. Pure read; no write, no
 * money math, no audit emission (resolver-seam.md invariant 2).
 */

import type { ItemRefResolver } from '../cart/cart-bridge.js';
import type { ProductRepo } from './product-repo.js';

/**
 * What an `item_ref` is, from 009's side of the seam: the stable, 1:1
 * `products.product_id`. The seam treats it as opaque; this constant pins the
 * scheme so the renderer add-call (T044/T045) and duplicate-merge (T046/FR-21)
 * cannot drift from what the resolver reads.
 */
export const CATALOGUE_ITEM_REF_KIND = 'product_id' as const;

export interface CatalogueResolverDeps {
  /** The read-only product repo (S2). */
  repo: ProductRepo;
  /** The current session's tenant id (P17). Bound at the composition root. */
  getTenantId: () => string;
}

type ResolvedSeam = Awaited<ReturnType<ItemRefResolver>>;

/**
 * Build the production `ItemRefResolver`. The returned function is async to
 * satisfy the seam (005's `ItemRefResolver` returns a `Promise`), even though
 * the underlying SQL read is synchronous.
 */
export function createCatalogueResolver(deps: CatalogueResolverDeps): ItemRefResolver {
  const { repo, getTenantId } = deps;

  return (item_ref: string): Promise<ResolvedSeam> => {
    const result = repo.resolveForSeam(getTenantId(), item_ref);

    if (result.kind === 'not_found') {
      return Promise.resolve({ kind: 'refused', reason: 'unknown_item' });
    }
    if (result.kind === 'unavailable') {
      // Local/offline lookup has no `no_connection` use; an unavailable
      // catalogue is a resolution failure → generic (reason logged upstream).
      return Promise.resolve({ kind: 'refused', reason: 'generic' });
    }

    const { product } = result;
    if (!product.active) {
      return Promise.resolve({ kind: 'refused', reason: 'disabled' });
    }
    // Money guard (FR-19 / AD-5): a corrupt read-model price never becomes a
    // cart line. The migration CHECK(price_minor >= 0) does not bound the upper
    // end; `Number.isSafeInteger` is the load-bearing guard on the resolve path.
    if (!Number.isSafeInteger(product.price_minor)) {
      return Promise.resolve({ kind: 'refused', reason: 'generic' });
    }

    return Promise.resolve({
      kind: 'ok',
      display_name: product.name_ar,
      unit_price_minor: product.price_minor,
    });
  };
}
