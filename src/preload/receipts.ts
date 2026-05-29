import { ipcRenderer } from 'electron';

import type {
  ReceiptsBridgeAPI,
  ReceiptsPreviewRequest,
  ReceiptsPreviewResponse,
  ReceiptsRetryPrintRequest,
  ReceiptsRetryPrintResponse,
} from '../shared/bridge-api.js';
import { RECEIPTS_IPC_CHANNELS } from '../shared/receipts/channels.js';

/**
 * T172 — 008 Slice 2 `receipts.*` preload bridge.
 *
 * Thin contextBridge surface; each handler delegates to `ipcRenderer.invoke`
 * with a typed channel constant. Main-process `requireOperatorSession` +
 * tenant-isolation gating is the load-bearing security boundary.
 *
 * Slice 2 exposes `receipts.preview` ONLY — the read-only HTML render. The
 * mutating handlers (reprint / retryPrint / manualOverride) join this surface
 * in Slices 3 / 5 / 6.
 */
export const receipts: ReceiptsBridgeAPI = {
  preview: (req: ReceiptsPreviewRequest) =>
    ipcRenderer.invoke(RECEIPTS_IPC_CHANNELS.PREVIEW, req) as Promise<ReceiptsPreviewResponse>,
  retryPrint: (req: ReceiptsRetryPrintRequest) =>
    ipcRenderer.invoke(
      RECEIPTS_IPC_CHANNELS.RETRY_PRINT,
      req,
    ) as Promise<ReceiptsRetryPrintResponse>,
};
