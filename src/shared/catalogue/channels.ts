/**
 * 009-product-search-and-barcode-lookup T016 — `catalogue.*` IPC channels.
 *
 * Single source of truth for the `catalogue.*` IPC channel constants shared by
 * the preload bridge and the main-process handlers. Mirrors
 * `src/shared/sales/channels.ts` (008) and `src/shared/payments/channels.ts`.
 *
 * Drift between this file and the handler-side / preload-side channel names
 * surfaces as a "no handler for channel" error at runtime — the manual smoke
 * catches it.
 */

export const CATALOGUE_IPC_CHANNELS = {
  LOOKUP_BARCODE: 'catalogue:lookupBarcode',
  LOOKUP_SKU: 'catalogue:lookupSku',
  SEARCH: 'catalogue:search',
  RESOLVE: 'catalogue:resolve',
  // 010-pos-catalog-read-down-consumption (T041) — read-down additions (§A4).
  // `REFRESH`: cashier-invokable manual read-down trigger (status only).
  // `FRESHNESS`: truthful last-updated read for the FR-16 indicator.
  REFRESH: 'catalogue:refresh',
  FRESHNESS: 'catalogue:freshness',
  // 010 diagnostics — read-only tenant-scoped local read-model counts (integers only).
  COUNTS: 'catalogue:counts',
} as const;

export type CatalogueIpcChannel =
  (typeof CATALOGUE_IPC_CHANNELS)[keyof typeof CATALOGUE_IPC_CHANNELS];
