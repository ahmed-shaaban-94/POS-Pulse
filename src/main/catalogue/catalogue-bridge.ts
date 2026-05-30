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
  CatalogueLookupResponse,
  CatalogueSearchResponse,
  CatalogueResolveResponse,
} from '../../shared/bridge-api.js';
import {
  requireCatalogueSession,
  type OperatorSessionForCatalogue,
} from './require-catalogue-session.js';

export type CatalogueBridge = CatalogueBridgeAPI;

export interface CatalogueBridgeDependencies {
  /** The current operator session, or null when none is active (NFR-6a gate). */
  getCurrentSession: () => OperatorSessionForCatalogue | null;
}

export function createCatalogueBridge(deps: CatalogueBridgeDependencies): CatalogueBridge {
  const { getCurrentSession } = deps;

  // S1 skeleton: each handler gates on an active session first (NFR-6a), then
  // returns the honest `catalogue_unavailable` stub (the read model lands in
  // S2). The `req` params the interface declares are intentionally omitted here
  // — there is nothing to read yet; S2/S3/S4 reintroduce them when the repo,
  // search, and resolver are wired. (`await Promise.resolve` keeps these async
  // per the interface without an unused-await lint, mirroring the sales bridge.)
  return {
    async lookupBarcode(): Promise<CatalogueLookupResponse> {
      const gate = requireCatalogueSession(getCurrentSession());
      if (gate.kind === 'refused') return gate;
      return await Promise.resolve({ kind: 'catalogue_unavailable' });
    },

    async lookupSku(): Promise<CatalogueLookupResponse> {
      const gate = requireCatalogueSession(getCurrentSession());
      if (gate.kind === 'refused') return gate;
      return await Promise.resolve({ kind: 'catalogue_unavailable' });
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
