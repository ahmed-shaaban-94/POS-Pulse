/**
 * 011-sale-sync-capture-up — `sales:*` sync-status IPC channel constants.
 *
 * Single source of truth shared by the preload bridge and the main-process
 * handler. The sale-sync surface is READ-ONLY: the renderer can observe sync
 * health but can NEVER trigger or mutate the drain (§A4 / P8). There is exactly
 * one channel — a status read.
 */

export const SALES_SYNC_IPC_CHANNELS = {
  SYNC_STATUS: 'sales:syncStatus',
} as const;
