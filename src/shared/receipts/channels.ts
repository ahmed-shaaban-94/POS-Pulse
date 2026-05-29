/**
 * 008-sale-finalization-and-receipts Slice 2 — `receipts.*` IPC channels.
 *
 * Mirrors `src/shared/sales/channels.ts`. Slice 2 lands `receipts.preview`
 * only; the mutating handlers (reprint / retryPrint / manualOverride) add
 * their channel keys here in Slices 3 / 5 / 6.
 */
export const RECEIPTS_IPC_CHANNELS = {
  PREVIEW: 'receipts:preview',
} as const;

export type ReceiptsIpcChannel = (typeof RECEIPTS_IPC_CHANNELS)[keyof typeof RECEIPTS_IPC_CHANNELS];
