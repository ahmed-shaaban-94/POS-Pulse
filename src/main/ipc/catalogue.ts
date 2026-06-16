import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { CATALOGUE_IPC_CHANNELS } from '../../shared/catalogue/channels.js';
import type {
  CatalogueLookupBarcodeRequest,
  CatalogueLookupSkuRequest,
  CatalogueSearchRequest,
  CatalogueResolveRequest,
  CatalogueLookupResponse,
  CatalogueSearchResponse,
  CatalogueResolveResponse,
  CatalogueRefreshResponse,
  CatalogueFreshnessResponse,
  CatalogueCountsResponse,
} from '../../shared/bridge-api.js';
import type { CatalogueBridge } from '../catalogue/catalogue-bridge.js';

/**
 * 010 (freshness wiring / T043 leg) — `catalogue:*` IPC channel registration.
 *
 * Mirrors `registerCartHandlers`: a thin wire-up where every channel delegates to
 * the already-constructed `CatalogueBridge`, which owns the session gate as its
 * FIRST instruction (AD-1). No business logic lives here.
 *
 * **This file is what makes the catalogue surface reachable.** Before it, NO
 * `catalogue:*` channel was registered with `ipcMain` (009 shipped the bridge
 * factory + preload but never the registration), so the entire namespace was
 * inert. Registering here wires 009's four read handlers + 010's `freshness` and
 * `refresh`. `refresh` only does useful work once the read-down driver is
 * injected into the bridge (T039, #349-blocked); until then it refuses (the
 * bridge returns a generic refusal when no driver is wired — never a fake
 * "started").
 *
 * Malformed payloads collapse to a generic `no_session` refusal — we do NOT leak
 * the field that failed validation (Constitution VII / PR-2). The `refresh` /
 * `freshness` requests are `{}` so they take no validator (any payload is
 * ignored; identity comes from the session, INP-1).
 */

export interface CatalogueHandlerDeps {
  bridge: CatalogueBridge;
}

/** Generic refusal for a malformed request — never leaks the failed field. */
function refuseInvalidLookup(): CatalogueLookupResponse {
  return { kind: 'refused', reason: 'no_session' };
}

function asLookupBarcodeReq(value: unknown): CatalogueLookupBarcodeRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['barcode'] !== 'string') return null;
  return { barcode: v['barcode'] };
}

function asLookupSkuReq(value: unknown): CatalogueLookupSkuRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['sku'] !== 'string') return null;
  return { sku: v['sku'] };
}

function asSearchReq(value: unknown): CatalogueSearchRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['query'] !== 'string') return null;
  return { query: v['query'] };
}

function asResolveReq(value: unknown): CatalogueResolveRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['product_id'] !== 'string') return null;
  return { product_id: v['product_id'] };
}

export function registerCatalogueHandlers(ipcMain: IpcMain, deps: CatalogueHandlerDeps): void {
  const { bridge } = deps;

  ipcMain.handle(
    CATALOGUE_IPC_CHANNELS.LOOKUP_BARCODE,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<CatalogueLookupResponse> => {
      const req = asLookupBarcodeReq(request);
      if (req === null) return refuseInvalidLookup();
      return bridge.lookupBarcode(req);
    },
  );

  ipcMain.handle(
    CATALOGUE_IPC_CHANNELS.LOOKUP_SKU,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<CatalogueLookupResponse> => {
      const req = asLookupSkuReq(request);
      if (req === null) return refuseInvalidLookup();
      return bridge.lookupSku(req);
    },
  );

  ipcMain.handle(
    CATALOGUE_IPC_CHANNELS.SEARCH,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<CatalogueSearchResponse> => {
      const req = asSearchReq(request);
      if (req === null) return { kind: 'refused', reason: 'no_session' };
      return bridge.search(req);
    },
  );

  ipcMain.handle(
    CATALOGUE_IPC_CHANNELS.RESOLVE,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<CatalogueResolveResponse> => {
      const req = asResolveReq(request);
      if (req === null) return { kind: 'refused', reason: 'generic' };
      return bridge.resolve(req);
    },
  );

  // 010 read-down additions. Both requests are `{}` — identity comes from the
  // session (INP-1), so there is nothing to validate; any payload is ignored.
  ipcMain.handle(CATALOGUE_IPC_CHANNELS.REFRESH, async (): Promise<CatalogueRefreshResponse> => {
    return bridge.refresh({});
  });

  ipcMain.handle(
    CATALOGUE_IPC_CHANNELS.FRESHNESS,
    async (): Promise<CatalogueFreshnessResponse> => {
      return bridge.freshness({});
    },
  );

  // 010 diagnostics — read-only tenant-scoped counts. `{}` request (identity from
  // the session, INP-1); the bridge owns the session gate + tenant scope.
  ipcMain.handle(CATALOGUE_IPC_CHANNELS.COUNTS, async (): Promise<CatalogueCountsResponse> => {
    return bridge.counts({});
  });
}
