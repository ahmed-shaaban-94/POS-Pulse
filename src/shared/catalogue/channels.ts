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
} as const;

export type CatalogueIpcChannel =
  (typeof CATALOGUE_IPC_CHANNELS)[keyof typeof CATALOGUE_IPC_CHANNELS];
