import { ipcRenderer } from 'electron';

import type { SalesSyncBridgeAPI, SaleSyncStatusResponse } from '../shared/bridge-api.js';
import { SALES_SYNC_IPC_CHANNELS } from '../shared/sales-sync/channels.js';

/**
 * 011-sale-sync-capture-up — read-only `salesSync.*` preload bridge.
 *
 * A single channel: `syncStatus`. The renderer can OBSERVE sync health but has
 * NO way to trigger or mutate the drain (the engine is main-process background;
 * §A4 / P8 / WR-1). No idempotency key (not a money-bearing action); the request
 * is empty (scope comes from the resolved device principal main-side, INP-1).
 */
export const salesSync: SalesSyncBridgeAPI = {
  syncStatus: () =>
    ipcRenderer.invoke(SALES_SYNC_IPC_CHANNELS.SYNC_STATUS) as Promise<SaleSyncStatusResponse>,
};
