import { describe, expect, it, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { registerPairingHandlers } from '../pairing.js';
import { PAIRING_IPC_CHANNELS } from '../../../shared/pairing-types.js';
import type { PairingStatus } from '../../../shared/pairing-types.js';
import type { PairingStore } from '../../pairing/store.js';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/**
 * 002-terminal-pairing T012 — `pairing:get-status` IPC handler tests.
 *
 * The handler is the bridge between the renderer's
 * `window.api.pairing.getStatus()` and the main-process pairingStore.
 * Mirrors the Phase 9 `app:config` pattern: the store is INJECTED so the
 * handler under test never reaches into a process-global. Constitution
 * III (no ad-hoc strings): the channel name comes from the canonical
 * PAIRING_IPC_CHANNELS constant.
 *
 * US1 scope: this test file ONLY covers `pairing:get-status`. The
 * `pairing:submit` handler is a US2 task (T024+); registering it here
 * would leak scope.
 */

function makeFakeStore(status: PairingStatus): PairingStore {
  return {
    getStatus: vi.fn(() => Promise.resolve(status)),
    persist: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  };
}

describe('registerPairingHandlers — pairing:get-status (T012)', () => {
  it('registers the handler under PAIRING_IPC_CHANNELS.GET_STATUS', () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const store = makeFakeStore({ kind: 'unpaired' });

    registerPairingHandlers(ipcMain, store);

    expect(PAIRING_IPC_CHANNELS.GET_STATUS).toBe('pairing:get-status');
    const channels = handle.mock.calls.map((c) => c[0]);
    expect(channels).toContain(PAIRING_IPC_CHANNELS.GET_STATUS);
    // Each channel registered exactly once.
    expect(channels.filter((c) => c === PAIRING_IPC_CHANNELS.GET_STATUS)).toHaveLength(1);
  });

  it('forwards the store result for the unpaired branch unchanged', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const expected: PairingStatus = { kind: 'unpaired' };
    const store = makeFakeStore(expected);

    registerPairingHandlers(ipcMain, store);

    const captured = handle.mock.calls.find((c) => c[0] === PAIRING_IPC_CHANNELS.GET_STATUS)?.[1];
    if (!captured) throw new Error('GET_STATUS handler not registered');
    const result = await captured({} as IpcMainInvokeEvent);
    expect(result).toEqual(expected);
  });

  it('forwards the store result for the paired branch unchanged', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const expected: PairingStatus = {
      kind: 'paired',
      tenant_id: 'tenant-A',
      branch_id: 'branch-B',
      terminal_id: 'terminal-C',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    };
    const store = makeFakeStore(expected);

    registerPairingHandlers(ipcMain, store);

    const captured = handle.mock.calls.find((c) => c[0] === PAIRING_IPC_CHANNELS.GET_STATUS)?.[1];
    if (!captured) throw new Error('GET_STATUS handler not registered');
    const result = await captured({} as IpcMainInvokeEvent);
    expect(result).toEqual(expected);
  });

  it('forwards the store result for each invalid reason unchanged', async () => {
    for (const reason of ['missing_token', 'orphaned_row', 'decrypt_failed'] as const) {
      const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
      const ipcMain = { handle } as unknown as IpcMain;
      const expected: PairingStatus = { kind: 'invalid', reason };
      const store = makeFakeStore(expected);

      registerPairingHandlers(ipcMain, store);

      const captured = handle.mock.calls.find((c) => c[0] === PAIRING_IPC_CHANNELS.GET_STATUS)?.[1];
      if (!captured) throw new Error('GET_STATUS handler not registered');
      const result = await captured({} as IpcMainInvokeEvent);
      expect(result).toEqual(expected);
    }
  });

  it('does not register the SUBMIT channel yet (US2 scope, not US1)', () => {
    // US1 only ships `pairing:get-status`. The submit handler lands in
    // T024+ (US2). Registering it now would leak scope and silently
    // exercise an unwired code path on a renderer call.
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const store = makeFakeStore({ kind: 'unpaired' });

    registerPairingHandlers(ipcMain, store);

    const channels = handle.mock.calls.map((c) => c[0]);
    expect(channels).not.toContain(PAIRING_IPC_CHANNELS.SUBMIT);
  });

  it('calls the store on every invocation (no caching)', async () => {
    const handle = vi.fn<(channel: string, fn: IpcHandler) => void>();
    const ipcMain = { handle } as unknown as IpcMain;
    const getStatusMock = vi.fn<() => Promise<PairingStatus>>(() =>
      Promise.resolve({ kind: 'unpaired' }),
    );
    const store: PairingStore = {
      getStatus: getStatusMock,
      persist: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
    };

    registerPairingHandlers(ipcMain, store);

    const captured = handle.mock.calls.find((c) => c[0] === PAIRING_IPC_CHANNELS.GET_STATUS)?.[1];
    if (!captured) throw new Error('GET_STATUS handler not registered');
    await captured({} as IpcMainInvokeEvent);
    await captured({} as IpcMainInvokeEvent);
    expect(getStatusMock).toHaveBeenCalledTimes(2);
  });
});
