import { ipcRenderer } from 'electron';

import type {
  ReceiptsBridgeAPI,
  ReceiptsPreviewRequest,
  ReceiptsPreviewResponse,
  ReceiptsRetryPrintRequest,
  ReceiptsRetryPrintResponse,
  ReceiptsReprintRequest,
  ReceiptsReprintResponse,
  ReceiptsManualOverrideRequest,
  ReceiptsManualOverrideResponse,
} from '../shared/bridge-api.js';
import { RECEIPTS_IPC_CHANNELS } from '../shared/receipts/channels.js';

/**
 * T172 — 008 Slice 2 `receipts.*` preload bridge.
 *
 * Thin contextBridge surface; each handler delegates to `ipcRenderer.invoke`
 * with a typed channel constant. Main-process `requireOperatorSession` +
 * tenant-isolation gating is the load-bearing security boundary.
 *
 * Slice 2 exposed `receipts.preview`; Slice 3 added `retryPrint`; Slice 5 added
 * `reprint`; Slice 6 adds `manualOverride` — the full mutating surface.
 */
export const receipts: ReceiptsBridgeAPI = {
  preview: (req: ReceiptsPreviewRequest) =>
    ipcRenderer.invoke(RECEIPTS_IPC_CHANNELS.PREVIEW, req) as Promise<ReceiptsPreviewResponse>,
  retryPrint: (req: ReceiptsRetryPrintRequest) =>
    ipcRenderer.invoke(
      RECEIPTS_IPC_CHANNELS.RETRY_PRINT,
      req,
    ) as Promise<ReceiptsRetryPrintResponse>,
  reprint: (req: ReceiptsReprintRequest) =>
    ipcRenderer.invoke(RECEIPTS_IPC_CHANNELS.REPRINT, req) as Promise<ReceiptsReprintResponse>,
  manualOverride: (req: ReceiptsManualOverrideRequest) =>
    ipcRenderer.invoke(
      RECEIPTS_IPC_CHANNELS.MANUAL_OVERRIDE,
      req,
    ) as Promise<ReceiptsManualOverrideResponse>,
};
