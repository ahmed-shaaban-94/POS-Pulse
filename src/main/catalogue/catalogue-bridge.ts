/**
 * 009-product-search-and-barcode-lookup T015 — `catalogue.*` bridge skeleton.
 *
 * The renderer-facing trust boundary for product lookup (read-only; AD-2 — no
 * insert/update/delete handler exists). Four handlers:
 *
 *   • `catalogue.lookupBarcode({ barcode })` — exact barcode lookup (FR-4).
 *   • `catalogue.lookupSku({ sku })`         — exact SKU lookup (FR-9).
 *   • `catalogue.search({ query })`          — folded substring search (FR-11/12/13).
 *   • `catalogue.resolve({ product_id })`    — resolve to confirm-and-add snapshot.
 *
 * Slice S1 ships the SKELETON only: every handler's first step is the session
 * gate (`requireCatalogueSession`, NFR-6a), then returns the honest
 * `catalogue_unavailable` stub — the read model is not wired until S2, so the
 * catalogue genuinely IS unavailable. The real lookup/search/resolve logic
 * lands in S2 (exact lookup + repo, §A2), S3 (folded search, §A2), and S4
 * (resolve + 005 seam wiring, §A1). Mirrors the `createSalesBridge` factory
 * discipline (008): DI'd `getCurrentSession`, discriminated-union responses
 * that never throw, generic refusals.
 */

import type {
  CatalogueBridgeAPI,
  CatalogueLookupBarcodeRequest,
  CatalogueLookupSkuRequest,
  CatalogueLookupResponse,
  CatalogueSearchResponse,
  CatalogueResolveResponse,
} from '../../shared/bridge-api.js';
import {
  requireCatalogueSession,
  type OperatorSessionForCatalogue,
} from './require-catalogue-session.js';
import type { ProductLookupResult, ProductRepo } from './product-repo.js';

export type CatalogueBridge = CatalogueBridgeAPI;

export interface CatalogueBridgeDependencies {
  /** The current operator session, or null when none is active (NFR-6a gate). */
  getCurrentSession: () => OperatorSessionForCatalogue | null;
  /**
   * The read-only product repo (S2). Tenant scoping flows through the session's
   * `tenant_id` into the repo's `WHERE tenant_id = ?` (P17). Optional: when
   * absent (the S1 skeleton), every lookup returns the honest
   * `catalogue_unavailable` stub — the read model is genuinely not wired.
   * `search` / `resolve` remain stubs until S3 / S4.
   */
  productRepo?: ProductRepo;
}

/** Map the repo's discriminated result to the bridge lookup response. */
function lookupResultToResponse(result: ProductLookupResult): CatalogueLookupResponse {
  switch (result.kind) {
    case 'one':
      return { kind: 'one', product: result.product };
    case 'not_found':
      return { kind: 'not_found' };
    case 'ambiguous':
      return { kind: 'ambiguous' };
    case 'unavailable':
      return { kind: 'catalogue_unavailable' };
  }
}

export function createCatalogueBridge(deps: CatalogueBridgeDependencies): CatalogueBridge {
  const { getCurrentSession, productRepo } = deps;

  // S2: `lookupBarcode` / `lookupSku` gate first (NFR-6a), then query the
  // tenant-scoped repo (the session's `tenant_id` is the only tenant the repo
  // ever sees, P17) and map the result. With no repo wired (S1 skeleton) the
  // catalogue is genuinely unavailable. `search` / `resolve` stay stubs until
  // S3 / S4. (`await Promise.resolve` on the stubs keeps them async per the
  // interface without an unused-await lint, mirroring the sales bridge.)
  return {
    async lookupBarcode(req: CatalogueLookupBarcodeRequest): Promise<CatalogueLookupResponse> {
      const gate = requireCatalogueSession(getCurrentSession());
      if (gate.kind === 'refused') return gate;
      if (productRepo === undefined)
        return await Promise.resolve({ kind: 'catalogue_unavailable' });
      const result = productRepo.lookupByBarcode(gate.session.tenant_id, req.barcode);
      return await Promise.resolve(lookupResultToResponse(result));
    },

    async lookupSku(req: CatalogueLookupSkuRequest): Promise<CatalogueLookupResponse> {
      const gate = requireCatalogueSession(getCurrentSession());
      if (gate.kind === 'refused') return gate;
      if (productRepo === undefined)
        return await Promise.resolve({ kind: 'catalogue_unavailable' });
      const result = productRepo.lookupBySku(gate.session.tenant_id, req.sku);
      return await Promise.resolve(lookupResultToResponse(result));
    },

    async search(): Promise<CatalogueSearchResponse> {
      const gate = requireCatalogueSession(getCurrentSession());
      if (gate.kind === 'refused') return gate;
      return await Promise.resolve({ kind: 'catalogue_unavailable' });
    },

    async resolve(): Promise<CatalogueResolveResponse> {
      const gate = requireCatalogueSession(getCurrentSession());
      if (gate.kind === 'refused') return gate;
      return await Promise.resolve({ kind: 'catalogue_unavailable' });
    },
  };
}
