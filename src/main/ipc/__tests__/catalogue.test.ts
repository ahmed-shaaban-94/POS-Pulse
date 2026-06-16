import { describe, expect, it, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { registerCatalogueHandlers } from '../catalogue.js';
import { CATALOGUE_IPC_CHANNELS } from '../../../shared/catalogue/channels.js';
import type { CatalogueBridge } from '../../catalogue/catalogue-bridge.js';

/**
 * 010 (freshness wiring / T043 leg) — `catalogue:*` IPC registration.
 *
 * The thin wire-up: every channel delegates to the already-constructed
 * `CatalogueBridge` (which owns the session gate FIRST — AD-1). This file adds NO
 * business logic. Before this slice, NO `catalogue:*` channel was registered with
 * `ipcMain` at all (the whole surface was inert); this makes 009's four read
 * handlers + 010's `freshness` (and `refresh`, which refuses until the driver is
 * wired) reachable from the renderer.
 */

/** A minimal IpcMain stub that records handlers by channel. */
function fakeIpcMain(): {
  ipcMain: IpcMain;
  invoke: (channel: string, request: unknown) => Promise<unknown>;
  channels: () => string[];
} {
  const handlers = new Map<
    string,
    (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>
  >();
  const ipcMain = {
    handle(channel: string, fn: (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>) {
      handlers.set(channel, fn);
    },
  } as unknown as IpcMain;
  return {
    ipcMain,
    invoke: (channel, request) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`no handler for ${channel}`);
      return fn({} as IpcMainInvokeEvent, request);
    },
    channels: () => [...handlers.keys()],
  };
}

function fakeBridge(over: Partial<CatalogueBridge> = {}): CatalogueBridge {
  return {
    lookupBarcode: vi.fn(() => Promise.resolve({ kind: 'catalogue_unavailable' as const })),
    lookupSku: vi.fn(() => Promise.resolve({ kind: 'catalogue_unavailable' as const })),
    search: vi.fn(() => Promise.resolve({ kind: 'catalogue_unavailable' as const })),
    resolve: vi.fn(() => Promise.resolve({ kind: 'catalogue_unavailable' as const })),
    refresh: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, reason: 'no_session' as const }),
    ),
    freshness: vi.fn(() =>
      Promise.resolve({ kind: 'ok' as const, last_success_at: null, is_empty: true }),
    ),
    counts: vi.fn(() => Promise.resolve({ kind: 'ok' as const, products: 0, barcodes: 0 })),
    ...over,
  };
}

describe('registerCatalogueHandlers', () => {
  it('registers all seven catalogue channels', () => {
    const { ipcMain, channels } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge() });
    expect(channels().sort()).toEqual(
      [
        CATALOGUE_IPC_CHANNELS.LOOKUP_BARCODE,
        CATALOGUE_IPC_CHANNELS.LOOKUP_SKU,
        CATALOGUE_IPC_CHANNELS.SEARCH,
        CATALOGUE_IPC_CHANNELS.RESOLVE,
        CATALOGUE_IPC_CHANNELS.REFRESH,
        CATALOGUE_IPC_CHANNELS.FRESHNESS,
        CATALOGUE_IPC_CHANNELS.COUNTS,
      ].sort(),
    );
  });

  it('counts channel delegates to bridge.counts and returns its integers', async () => {
    const { ipcMain, invoke } = fakeIpcMain();
    const counts = vi.fn(() =>
      Promise.resolve({ kind: 'ok' as const, products: 50, barcodes: 49 }),
    );
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ counts }) });
    const res = await invoke(CATALOGUE_IPC_CHANNELS.COUNTS, {});
    expect(res).toEqual({ kind: 'ok', products: 50, barcodes: 49 });
    expect(counts).toHaveBeenCalledOnce();
  });

  it('freshness delegates to the bridge and returns its response', async () => {
    const freshness = vi.fn(() =>
      Promise.resolve({
        kind: 'ok' as const,
        last_success_at: '2026-06-07T10:00:00.000Z',
        is_empty: false,
      }),
    );
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ freshness }) });
    const r = await invoke(CATALOGUE_IPC_CHANNELS.FRESHNESS, {});
    expect(freshness).toHaveBeenCalledOnce();
    expect(r).toEqual({ kind: 'ok', last_success_at: '2026-06-07T10:00:00.000Z', is_empty: false });
  });

  it('refresh delegates to the bridge', async () => {
    const refresh = vi.fn(() => Promise.resolve({ kind: 'started' as const }));
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ refresh }) });
    const r = await invoke(CATALOGUE_IPC_CHANNELS.REFRESH, {});
    expect(refresh).toHaveBeenCalledOnce();
    expect(r).toEqual({ kind: 'started' });
  });

  it('lookupBarcode forwards a valid request and refuses a malformed one generically', async () => {
    const lookupBarcode = vi.fn(() => Promise.resolve({ kind: 'not_found' as const }));
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ lookupBarcode }) });

    // Valid: { barcode: string } forwards.
    await invoke(CATALOGUE_IPC_CHANNELS.LOOKUP_BARCODE, { barcode: '6221000000001' });
    expect(lookupBarcode).toHaveBeenCalledWith({ barcode: '6221000000001' });

    // Malformed: missing barcode → generic refusal, bridge NOT called again.
    const r = await invoke(CATALOGUE_IPC_CHANNELS.LOOKUP_BARCODE, { nope: 1 });
    expect(r).toEqual({ kind: 'refused', reason: 'no_session' });
    expect(lookupBarcode).toHaveBeenCalledOnce(); // not called for the malformed payload
  });

  it('lookupBarcode refuses a non-object payload (null) generically', async () => {
    const lookupBarcode = vi.fn(() => Promise.resolve({ kind: 'not_found' as const }));
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ lookupBarcode }) });

    const r = await invoke(CATALOGUE_IPC_CHANNELS.LOOKUP_BARCODE, null);
    expect(r).toEqual({ kind: 'refused', reason: 'no_session' });
    expect(lookupBarcode).not.toHaveBeenCalled();
  });

  it('lookupSku forwards a valid request and refuses a malformed one generically', async () => {
    const lookupSku = vi.fn(() => Promise.resolve({ kind: 'not_found' as const }));
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ lookupSku }) });

    await invoke(CATALOGUE_IPC_CHANNELS.LOOKUP_SKU, { sku: 'SKU-1' });
    expect(lookupSku).toHaveBeenCalledWith({ sku: 'SKU-1' });

    const r = await invoke(CATALOGUE_IPC_CHANNELS.LOOKUP_SKU, { nope: 1 });
    expect(r).toEqual({ kind: 'refused', reason: 'no_session' });
    expect(lookupSku).toHaveBeenCalledOnce();
  });

  it('search forwards a valid request and refuses a malformed one generically', async () => {
    const search = vi.fn(() => Promise.resolve({ kind: 'not_found' as const }));
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ search }) });

    await invoke(CATALOGUE_IPC_CHANNELS.SEARCH, { query: 'para' });
    expect(search).toHaveBeenCalledWith({ query: 'para' });

    const r = await invoke(CATALOGUE_IPC_CHANNELS.SEARCH, { nope: 1 });
    expect(r).toEqual({ kind: 'refused', reason: 'no_session' });
    expect(search).toHaveBeenCalledOnce();
  });

  it('resolve forwards a valid request and refuses a malformed one with the generic reason', async () => {
    const resolve = vi.fn(() => Promise.resolve({ kind: 'catalogue_unavailable' as const }));
    const { ipcMain, invoke } = fakeIpcMain();
    registerCatalogueHandlers(ipcMain, { bridge: fakeBridge({ resolve }) });

    await invoke(CATALOGUE_IPC_CHANNELS.RESOLVE, { product_id: 'p1' });
    expect(resolve).toHaveBeenCalledWith({ product_id: 'p1' });

    // Resolve's malformed refusal uses reason 'generic' (distinct from lookups).
    const r = await invoke(CATALOGUE_IPC_CHANNELS.RESOLVE, { nope: 1 });
    expect(r).toEqual({ kind: 'refused', reason: 'generic' });
    expect(resolve).toHaveBeenCalledOnce();
  });
});
