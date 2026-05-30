/**
 * 008-sale-finalization-and-receipts Slice 2 — `receipts.*` IPC channels.
 *
 * Mirrors `src/shared/sales/channels.ts`. Slice 2 lands `receipts.preview`
 * only; the mutating handlers (reprint / retryPrint / manualOverride) add
 * their channel keys here in Slices 3 / 5 / 6.
 */
export const RECEIPTS_IPC_CHANNELS = {
  PREVIEW: 'receipts:preview',
  // S3 — retry a failed print (mutating; gated server-side).
  RETRY_PRINT: 'receipts:retryPrint',
  // S5 — reprint a previously-printed sale (mutating; gated server-side).
  REPRINT: 'receipts:reprint',
  // S6 — manual-receipt override after a print failure (mutating; gated).
  MANUAL_OVERRIDE: 'receipts:manualOverride',
} as const;

export type ReceiptsIpcChannel = (typeof RECEIPTS_IPC_CHANNELS)[keyof typeof RECEIPTS_IPC_CHANNELS];
