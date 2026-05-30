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
 * namespace is READ-ONLY (no insert/update/delete; AD-2) and carries no
 * idempotency_key (every handler is a pure read).
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
};
