/**
 * T172 — 008 Slice 2 IPC channel registration for the `receipts.*` namespace.
 *
 * Mirrors src/main/ipc/sales.ts. Thin wire-up: the PREVIEW channel delegates
 * to the receipts bridge handler. Semantic validation (session, tenant
 * isolation, forbidden fields, not-found) lives in `createReceiptsBridge` and
 * is tested there. A non-object payload (which cannot carry the required
 * sale_id) maps to the same terminal refusal the bridge would produce, without
 * invoking the handler.
 */

import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { RECEIPTS_IPC_CHANNELS } from '../../shared/receipts/channels.js';
import type { ReceiptsBridge } from '../receipts/receipts-bridge.js';
import type { ReceiptsPreviewRequest, ReceiptsPreviewResponse } from '../../shared/bridge-api.js';

export interface ReceiptsIpcDeps {
  receiptsBridge: ReceiptsBridge;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

export function registerReceiptsHandlers(ipcMain: IpcMain, deps: ReceiptsIpcDeps): void {
  const { receiptsBridge } = deps;

  ipcMain.handle(
    RECEIPTS_IPC_CHANNELS.PREVIEW,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<ReceiptsPreviewResponse> => {
      if (!isObject(request)) return { kind: 'refused', reason: 'sale_not_found' };
      return receiptsBridge.preview(request as unknown as ReceiptsPreviewRequest);
    },
  );
}
