import { ipcRenderer } from 'electron';

import type {
  CatalogueBridgeAPI,
  CatalogueLookupBarcodeRequest,
  CatalogueLookupSkuRequest,
  CatalogueSearchRequest,
  CatalogueResolveRequest,
  CatalogueLookupResponse,
  CatalogueSearchResponse,
  CatalogueResolveResponse,
  CatalogueRefreshRequest,
  CatalogueFreshnessRequest,
  CatalogueRefreshResponse,
  CatalogueFreshnessResponse,
  CatalogueCountsRequest,
  CatalogueCountsResponse,
} from '../shared/bridge-api.js';
import { CATALOGUE_IPC_CHANNELS } from '../shared/catalogue/channels.js';

/**
 * 009-product-search-and-barcode-lookup Slice S1 (T016) — `catalogue.*` preload
 * bridge.
 *
 * Thin contextBridge surface — every handler delegates to
 * `ipcRenderer.invoke` with a typed channel constant. Main-process
 * `requireCatalogueSession` gating (NFR-6a) is the load-bearing security
 * boundary; renderer-side type checks are secondary UX defence only. The
 * namespace is READ-ONLY for 009's four handlers (no insert/update/delete;
 * AD-2). 010 adds `refresh` (a status-only trigger that requests a main-process
 * read-down tick — it exposes NO catalogue-write handler, WR-1) and `freshness`
 * (a pure secret-free read). Both requests are `{}` (INP-1) and carry no
 * idempotency_key (no money-bearing action).
 */
export const catalogue: CatalogueBridgeAPI = {
  lookupBarcode: (req: CatalogueLookupBarcodeRequest) =>
    ipcRenderer.invoke(
      CATALOGUE_IPC_CHANNELS.LOOKUP_BARCODE,
      req,
    ) as Promise<CatalogueLookupResponse>,
  lookupSku: (req: CatalogueLookupSkuRequest) =>
    ipcRenderer.invoke(CATALOGUE_IPC_CHANNELS.LOOKUP_SKU, req) as Promise<CatalogueLookupResponse>,
  search: (req: CatalogueSearchRequest) =>
    ipcRenderer.invoke(CATALOGUE_IPC_CHANNELS.SEARCH, req) as Promise<CatalogueSearchResponse>,
  resolve: (req: CatalogueResolveRequest) =>
    ipcRenderer.invoke(CATALOGUE_IPC_CHANNELS.RESOLVE, req) as Promise<CatalogueResolveResponse>,
  // 010 (T044) — read-down additions. `refresh` only REQUESTS a main-process
  // tick (no payload to persist, WR-1); `freshness` is a pure read.
  refresh: (req: CatalogueRefreshRequest) =>
    ipcRenderer.invoke(CATALOGUE_IPC_CHANNELS.REFRESH, req) as Promise<CatalogueRefreshResponse>,
  freshness: (req: CatalogueFreshnessRequest) =>
    ipcRenderer.invoke(
      CATALOGUE_IPC_CHANNELS.FRESHNESS,
      req,
    ) as Promise<CatalogueFreshnessResponse>,
  // 010 diagnostics — pure read of tenant-scoped local read-model counts.
  counts: (req: CatalogueCountsRequest) =>
    ipcRenderer.invoke(CATALOGUE_IPC_CHANNELS.COUNTS, req) as Promise<CatalogueCountsResponse>,
};
