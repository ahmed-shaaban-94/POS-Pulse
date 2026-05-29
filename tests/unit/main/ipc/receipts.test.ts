/* eslint-disable @typescript-eslint/unbound-method --
 * vi.fn-typed mock properties on the bridge spy trigger this rule on every
 * assertion. Same posture as tests/unit/main/ipc/sales.test.ts.
 */
/**
 * T172 — `receipts.*` IPC channel registration (RED).
 *
 * Mirrors src/main/ipc/sales.ts. Thin wire-up: the PREVIEW channel delegates
 * to the receipts bridge; a non-object request refuses without invoking the
 * handler (reusing the bridge's terminal refusal vocabulary).
 */

import { describe, expect, it, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { registerReceiptsHandlers } from '../../../../src/main/ipc/receipts.js';
import { RECEIPTS_IPC_CHANNELS } from '../../../../src/shared/receipts/channels.js';
import type { ReceiptsBridge } from '../../../../src/main/receipts/receipts-bridge.js';

function makeFakeIpcMain() {
  const handlers = new Map<
    string,
    (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>
  >();
  const ipcMain = {
    handle(channel: string, handler: (e: IpcMainInvokeEvent, r: unknown) => Promise<unknown>) {
      handlers.set(channel, handler);
    },
  } as unknown as IpcMain;
  return {
    ipcMain,
    invoke: (channel: string, request: unknown) => {
      const h = handlers.get(channel);
      if (h === undefined) throw new Error(`no handler for ${channel}`);
      return h({} as IpcMainInvokeEvent, request);
    },
    channels: () => [...handlers.keys()],
  };
}

function makeBridgeSpy(): ReceiptsBridge {
  return {
    preview: vi.fn(
      () =>
        Promise.resolve({
          kind: 'ok',
          preview: {
            html: '<div></div>',
            width_chars: 42,
            bilingual_locale: 'ar-EG-RTL-with-latin-en',
          },
        }) as never,
    ),
    retryPrint: vi.fn(
      () =>
        Promise.resolve({
          kind: 'ok',
          outcome: 'success',
          print_event_id: 'pe-1',
          purpose: 'retry_after_failure',
          render_path: 'escpos_direct',
          printed_at: '2026-05-27T10:00:09.000Z',
        }) as never,
    ),
  };
}

describe('T172 — registerReceiptsHandlers', () => {
  it('registers the receipts.preview channel', () => {
    const fake = makeFakeIpcMain();
    registerReceiptsHandlers(fake.ipcMain, { receiptsBridge: makeBridgeSpy() });
    expect(fake.channels()).toContain(RECEIPTS_IPC_CHANNELS.PREVIEW);
  });

  it('delegates receipts.preview to the bridge with the request payload', async () => {
    const fake = makeFakeIpcMain();
    const bridge = makeBridgeSpy();
    registerReceiptsHandlers(fake.ipcMain, { receiptsBridge: bridge });
    const req = { sale_id: 'sale-1', idempotency_key: 'idem-1' };
    await fake.invoke(RECEIPTS_IPC_CHANNELS.PREVIEW, req);
    expect(bridge.preview).toHaveBeenCalledWith(req);
  });

  it('refuses a non-object request without calling the bridge', async () => {
    const fake = makeFakeIpcMain();
    const bridge = makeBridgeSpy();
    registerReceiptsHandlers(fake.ipcMain, { receiptsBridge: bridge });
    const res = (await fake.invoke(RECEIPTS_IPC_CHANNELS.PREVIEW, null)) as {
      kind: string;
      reason: string;
    };
    expect(res.kind).toBe('refused');
    expect(res.reason).toBe('sale_not_found');
    expect(bridge.preview).not.toHaveBeenCalled();
  });

  // S3 — receipts.retryPrint channel.
  it('registers the receipts.retryPrint channel', () => {
    const fake = makeFakeIpcMain();
    registerReceiptsHandlers(fake.ipcMain, { receiptsBridge: makeBridgeSpy() });
    expect(fake.channels()).toContain(RECEIPTS_IPC_CHANNELS.RETRY_PRINT);
  });

  it('delegates receipts.retryPrint to the bridge with the request payload', async () => {
    const fake = makeFakeIpcMain();
    const bridge = makeBridgeSpy();
    registerReceiptsHandlers(fake.ipcMain, { receiptsBridge: bridge });
    const req = { sale_id: 'sale-1', idempotency_key: 'idem-1' };
    await fake.invoke(RECEIPTS_IPC_CHANNELS.RETRY_PRINT, req);
    expect(bridge.retryPrint).toHaveBeenCalledWith(req);
  });

  it('refuses a non-object retryPrint request without calling the bridge', async () => {
    const fake = makeFakeIpcMain();
    const bridge = makeBridgeSpy();
    registerReceiptsHandlers(fake.ipcMain, { receiptsBridge: bridge });
    const res = (await fake.invoke(RECEIPTS_IPC_CHANNELS.RETRY_PRINT, 42)) as {
      kind: string;
      reason: string;
    };
    expect(res.kind).toBe('refused');
    expect(res.reason).toBe('sale_not_found');
    expect(bridge.retryPrint).not.toHaveBeenCalled();
  });
});
